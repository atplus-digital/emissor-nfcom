/**
 * Boot real de src/index.ts + emissão via rota HTTP (QueuePort do composition root).
 *
 * O smoke (boot.smoke.test.ts) cobre health 200 + SIGTERM → exit 0; este cobre o
 * caminho que exercita a QueuePort construída no composition root (src/index.ts
 * linhas 81-93): `POST /faturas/:id/emitir` → `queue.enfileirarEmissaoFatura` →
 * `getQueue(EMISSAO).add(...)` → 202 com jobId.
 *
 * Para isso o Atacado (NocoBase) é um STUB HTTP local: o repository real monta a
 * árvore `getFaturaPorId` a partir do response do stub (translator `faturaToDomain`
 * + `cobrancaToDomain` + `notaToDomain`). O stub devolve 404 quando a coleção não
 * tem o id, e a árvore quando tem — sem NocoBase de verdade.
 *
 * Isolado (próprio boot/porta) porque o processo já sobe um app no smoke.
 */
import { describe, expect, test, afterEach } from "bun:test";

import { redisDisponivel } from "./helpers";

const REDIS_URL = "redis://localhost:6379";
const redisOk = await redisDisponivel(REDIS_URL);
if (!redisOk) {
	console.warn(
		"Redis não disponível em " + REDIS_URL + " — teste de boot+emitir pulado.",
	);
}

const PORT = 39000 + Math.floor(Math.random() * 900);
const DATABASE_URL = `/tmp/emissor-bootemit-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;

process.env.PORT = String(PORT);
process.env.DATABASE_URL = DATABASE_URL;
process.env.EMISSOR_API_KEY = "smoke-key";
process.env.REDIS_URL = REDIS_URL;
process.env.NOCOBASE_API_KEY = "smoke";
process.env.NOCOBASE_API_URL = `http://127.0.0.1:${PORT + 1}`;
process.env.NOCOBASE_APP = "a_atacado";
process.env.ASAAS_API_KEY = "smoke";
process.env.ASAAS_API_URL = "https://example.com";
process.env.NFCOM_API_URL = "https://example.com";
process.env.NFCOM_LOGIN = "smoke";
process.env.NFCOM_SENHA = "smoke";
process.env.WEBHOOK_URL = "";
process.env.WEBHOOK_SECRET = "";
process.env.RATE_LIMIT_ASAAS = "5";
process.env.RATE_LIMIT_NFCOM = "2";
process.env.RATE_LIMIT_ATACADO = "10";
process.env.FISCAL_CFOP_DEFAULT = "6307";
process.env.FISCAL_CCLASS_DEFAULT = "0100201";
process.env.FISCAL_ICMS_ALIQUOTA = "0";
process.env.LOG_LEVEL = "silent";

const exitOriginal = process.exit.bind(process) as unknown as typeof process.exit;

/** Árvore NocoBase (f_*) que o stub devolve para o `get` de t_nfcom_faturas. */
const CPF = "11144477735";
function arvoreNocoBase() {
	return {
		id: 7001,
		f_fk_parceiro: 1,
		f_data_referencia: "2026-08-01",
		f_data_vencimento: "2026-09-10",
		f_valor_total: 100.0,
		f_tipo_de_faturamento: "parceiro",
		f_status: "a-emitir",
		f_cobrancas: [
			{
				id: 7002,
				f_fk_fatura: 7001,
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
						id: 7010,
						f_fk_cobranca: 7002,
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

describe("smoke — boot real + POST /faturas/:id/emitir (QueuePort)", () => {
	test.skipIf(!redisOk)(
		"enfileira a fatura e responde 202 com jobId",
		{ timeout: 60_000 },
		async () => {
			const guarda = setTimeout(() => {
				throw new Error("boot+emitir excedeu 60s (timeout duro)");
			}, 60_000);

			let exitCode: number | undefined;
			const exitSpy = ((code?: number) => {
				exitCode = code;
			}) as unknown as typeof process.exit;
			process.exit = exitSpy;

			// Stub NocoBase: `t_nfcom_faturas:get` devolve o envelope `{ data: ... }`.
			const stub = Bun.serve({
				port: PORT + 1,
				fetch: async (req) => {
					const u = new URL(req.url);
					if (u.pathname.endsWith("t_nfcom_faturas:get")) {
						return Response.json({ data: arvoreNocoBase() }, { status: 200 });
					}
					return Response.json({ data: null }, { status: 200 });
				},
			});

			try {
				// Boot real — main() roda no import.
				await import("#/index.ts");

				// Aguarda o server /health subir.
				let healthOk = false;
				const inicio = Date.now();
				while (Date.now() - inicio < 15_000) {
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

				// POST /faturas/7001/emitir (X-API-Key correto).
				const res = await fetch(`http://localhost:${PORT}/faturas/7001/emitir`, {
					method: "POST",
					headers: { "X-API-Key": "smoke-key" },
				});
				expect(res.status).toBe(202);
				const corpo = await res.json();
				expect(corpo.jobId).toBeTruthy();
				expect(typeof corpo.statusUrl).toBe("string");
			} finally {
				clearTimeout(guarda);
				process.exit = exitOriginal;
				stub.stop();
			}
		},
	);
});

afterEach(() => {
	process.exit = exitOriginal;
});
