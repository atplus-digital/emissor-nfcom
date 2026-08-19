/**
 * E2E completo do boot: fatura → cobrança (Asaas) → nota (NFCom) → consolidação
 * → webhook `fatura.status=emitida` empurrado pelo composition root.
 *
 * Diferente do boot-emitir (que só enfileira), este deixa a árvore BullMQ
 * COMPLETA rodar contra stubs HTTP locais dos 3 provedores e um servidor
 * webhook-receptor. O alvo de cobertura é o closure `queue.enfileirarWebhook`
 * do composition root (src/index.ts 88-93) — ele só é chamado pelo worker de
 * emissão quando o fluxo real chega a um commit de estado, com `env.WEBHOOK_URL`
 * apontando para o receptor.
 *
 * Ports: app no PORT; stubs em PORT+1 (atacado/NocoBase), PORT+2 (asaas),
 * PORT+3 (nfcom); receptor webhook em PORT+4. Faixa 40000+ para não colidir
 * com o boot-emitir (39000+).
 */
import { describe, expect, test, afterEach } from "bun:test";
import { createHmac } from "node:crypto";

import { redisDisponivel } from "./helpers";

const REDIS_URL = "redis://localhost:6379";
const redisOk = await redisDisponivel(REDIS_URL);
if (!redisOk) {
	console.warn("Redis não disponível — E2E de boot pulado.");
}

const PORT = 40000 + Math.floor(Math.random() * 900);
const ATACADO_PORT = PORT + 1;
const ASAAS_PORT = PORT + 2;
const NFCOM_PORT = PORT + 3;
const WEBHOOK_PORT = PORT + 4;
const SECRET = "hook-secret";
const CPF = "11144477735";

process.env.PORT = String(PORT);
process.env.DATABASE_URL = `/tmp/emissor-boote2e-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
process.env.EMISSOR_API_KEY = "e2e-key";
process.env.REDIS_URL = REDIS_URL;
process.env.NOCOBASE_API_KEY = "e2e";
process.env.NOCOBASE_API_URL = `http://127.0.0.1:${ATACADO_PORT}/api`;
process.env.NOCOBASE_APP = "a_atacado";
process.env.ASAAS_API_KEY = "e2e";
process.env.ASAAS_API_URL = `http://127.0.0.1:${ASAAS_PORT}`;
process.env.NFCOM_API_URL = `http://127.0.0.1:${NFCOM_PORT}`;
process.env.NFCOM_LOGIN = "e2e";
process.env.NFCOM_SENHA = "e2e";
process.env.WEBHOOK_URL = `http://127.0.0.1:${WEBHOOK_PORT}/hook`;
process.env.WEBHOOK_SECRET = SECRET;
process.env.RATE_LIMIT_ASAAS = "100";
process.env.RATE_LIMIT_NFCOM = "100";
process.env.RATE_LIMIT_ATACADO = "100";
process.env.FISCAL_CFOP_DEFAULT = "6307";
process.env.FISCAL_CCLASS_DEFAULT = "0100201";
process.env.FISCAL_ICMS_ALIQUOTA = "0";
process.env.LOG_LEVEL = "silent";

const exitOriginal = process.exit.bind(process) as unknown as typeof process.exit;

/** Árvore NocoBase (f_*) devolvida pelo stub do Atacado. */
function arvoreNocoBase() {
	return {
		id: 8001,
		f_fk_parceiro: 1,
		f_data_referencia: "2026-08-01",
		f_data_vencimento: "2026-09-10",
		f_valor_total: 100.0,
		f_tipo_de_faturamento: "parceiro",
		f_status: "a-emitir",
		f_cobrancas: [
			{
				id: 8002,
				f_fk_fatura: 8001,
				f_valor_total: 100.0,
				f_nome_devedor: "Maria Silva",
				f_documento_devedor: CPF,
				f_email_devedor: "maria@example.com",
				f_status: "a-emitir",
				f_data_vencimento: "2026-09-10",
				f_id_externo: "",
				f_link_fatura: "",
				f_data_emissao: "",
				f_notas_fiscais: [
					{
						id: 8010,
						f_fk_cobranca: 8002,
						f_nome: "Maria Silva",
						f_cpfcnpj: CPF,
						f_email: "maria@example.com",
						f_endereco: "Rua A",
						f_endereco_numero: "100",
						f_bairro: "Centro",
						f_cep: "80000000",
						f_cidade: "Curitiba",
						f_uf: "PR",
						f_rgie: "",
						f_telefone: "",
						f_status_interno: "a-emitir",
						f_total: 100.0,
						f_nota_itens: [
							{
								f_item: 1,
								f_descricao: "Plano de internet 500MB",
								f_cfop: "6102",
								f_cclass: "0100201",
								f_quantidade: 1,
								f_unitario: 100.0,
								f_total: 100.0,
								f_aliq_icms: 0,
								f_bc_icms: 0,
								f_icms: 0,
								f_incide_aliquota: false,
							},
						],
					},
				],
			},
		],
	};
}

interface WebhookRecebido {
	body: unknown;
	signature: string;
}

describe("E2E — boot real: emissão completa + webhook emitida (composition root)", () => {
	test.skipIf(!redisOk)(
		"fluxo fatura→boleto→nota→emitida empurra webhook fatura.status=emitida",
		{ timeout: 90_000 },
		async () => {
			const guarda = setTimeout(() => {
				throw new Error("E2E excedeu 90s (timeout duro)");
			}, 90_000);

			let exitCode: number | undefined;
			process.exit = ((code?: number) => {
				exitCode = code;
			}) as unknown as typeof process.exit;

			// Stub do Atacado (NocoBase): só a árvore da fatura tem id; o resto → {data:null}.
			const atacado = Bun.serve({
				port: ATACADO_PORT,
				fetch: async (req) => {
					const u = new URL(req.url);
					if (u.pathname.endsWith("t_nfcom_faturas:get")) {
						return Response.json({ data: arvoreNocoBase() });
					}
					return Response.json({ data: null });
				},
			});

			// Stub do Asaas: customer inexistente → criado; payment ok.
			const asaas = Bun.serve({
				port: ASAAS_PORT,
				fetch: async (req) => {
					const u = new URL(req.url);
					if (u.pathname.startsWith("/v3/customers") && req.method === "GET") {
						return Response.json({ data: [], totalCount: 0 });
					}
					if (u.pathname.startsWith("/v3/customers")) {
						const body = JSON.parse(await req.text());
						return Response.json({
							id: "cus_1",
							name: body.name,
							email: body.email,
							cpfCnpj: body.cpfCnpj,
						});
					}
					if (u.pathname.startsWith("/v3/payments")) {
						// GET ?externalReference (consulta de idempotência) → envelope de list.
						if (req.method === "GET") {
							return Response.json({ data: [], totalCount: 0 });
						}
						// POST (criar boleto) → payment DTO.
						return Response.json({ id: "pay_1", invoiceUrl: "http://asaas.test/bol" });
					}
					return Response.json({ erro: "rota não stubada" }, { status: 500 });
				},
			});

			// Stub do NFCom: auth → token; emitir → autorizada com chave/protocolo.
			const nfcom = Bun.serve({
				port: NFCOM_PORT,
				fetch: async (req) => {
					const u = new URL(req.url);
					if (u.pathname === "/api/auth") {
						return Response.json({ token: "tok" });
					}
					if (u.pathname === "/api/emitir") {
						return Response.json({
							situacao: "autorizada",
							numero: 1,
							serie: 1,
							chave: "35260800000000000000000000000000000000000000",
							protocolo: "P1",
							ambiente: 2,
						});
					}
					if (u.pathname.startsWith("/api/lista")) {
						return Response.json({ dados: [] });
					}
					return Response.json({ erro: "rota não stubada" }, { status: 500 });
				},
			});

			// Receptor do webhook (o alvo do closure enfileirarWebhook do index.ts).
			const recebidos: WebhookRecebido[] = [];
			const webhook = Bun.serve({
				port: WEBHOOK_PORT,
				fetch: async (req) => {
					const text = await req.text();
					recebidos.push({
						body: JSON.parse(text),
						signature: req.headers.get("x-webhook-signature") ?? "",
					});
					return Response.json({ ok: true });
				},
			});

			try {
				// Boot real — main() roda no import.
				await import("#/index.ts");

				// /health 200.
				let healthOk = false;
				const t0 = Date.now();
				while (Date.now() - t0 < 15_000) {
					try {
						const res = await fetch(`http://localhost:${PORT}/health`);
						if (res.status === 200) {
							healthOk = true;
							break;
						}
					} catch {
						// ainda subindo
					}
					await new Promise((r) => setTimeout(r, 250));
				}
				expect(healthOk, "health deveria subir").toBe(true);

				// Dispara a emissão.
				const res = await fetch(`http://localhost:${PORT}/faturas/8001/emitir`, {
					method: "POST",
					headers: { "X-API-Key": "e2e-key" },
				});
				expect(res.status).toBe(202);

				// Aguarda o webhook fatura.status=emitida (fluxo completo concluiu).
				let emitida: WebhookRecebido | undefined;
				const t1 = Date.now();
				while (Date.now() - t1 < 45_000 && !emitida) {
					emitida = recebidos.find(
						(r) =>
							(r.body as { tipo?: string; estado?: string })?.tipo === "fatura.status" &&
							(r.body as { estado?: string })?.estado === "emitida",
					);
					if (!emitida) await new Promise((r) => setTimeout(r, 500));
				}
				expect(
					emitida,
					`webhook fatura.status=emitida deveria chegar; recebidos=${JSON.stringify(recebidos.map((r) => (r.body as { tipo?: string; estado?: string })?.tipo + ":" + (r.body as { estado?: string })?.estado))}`,
				).toBeTruthy();

				// Assinatura HMAC válida (X-Webhook-Signature do header).
				const corpo = JSON.stringify(emitida!.body);
				const esperado = createHmac("sha256", SECRET).update(corpo).digest("hex");
				expect(emitida!.signature).toBe(esperado);

				// Query de status (GET /faturas/:id/emissao) responde 200. O status
				// refletido vem do stub do Atacado (árvore fixa `a-emitir`) — a
				// mudança real é escrita via outbox p/ o CRM, fora do escopo do E2E.
				const q = await fetch(`http://localhost:${PORT}/faturas/8001/emissao`, {
					headers: { "X-API-Key": "e2e-key" },
				});
				expect(q.status).toBe(200);
			} finally {
				clearTimeout(guarda);
				// Shutdown gracioso via SIGINT (o smoke cobre SIGTERM — entre os
				// dois arquivos os dois handlers do index.ts são exercitados; a
				// coverage agrega entre arquivos na mesma run).
				// Disconnect ANTES do sinal: faz `redis.quit()` rejeitar no
				// shutdown e exercitar o catch defensivo (index.ts 144).
				const { getRedis } = await import("#/lib/redis");
				getRedis().disconnect();
				process.emit("SIGINT");
				await new Promise((r) => setTimeout(r, 2_000));
				expect(exitCode).toBe(0);
				process.exit = exitOriginal;
				atacado.stop();
				asaas.stop();
				nfcom.stop();
				webhook.stop();
			}
		},
	);
});

afterEach(() => {
	process.exit = exitOriginal;
});
