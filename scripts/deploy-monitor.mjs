#!/usr/bin/env node
/**
 * deploy-monitor.mjs — trigger de deploy no EasyPanel + monitoração (CI).
 *
 * Fluxo ("opção 3" — combinado):
 *   1. Snapshot das actions recentes do serviço (baseline pré-trigger).
 *   2. GET em DEPLOY_TRIGGER_URL (dispara o deploy no EasyPanel).
 *   3. Poll em actions.listActions até a action do deploy novo aparecer.
 *   4. Poll em actions.getAction até a action terminar (success/failed).
 *      Em falha/timeout: grava o JSON completo da action (inclui o log do
 *      build/deploy) em deploy-failure.log para virar artifact da Action.
 *   5. Poll em HEALTHCHECK_URL (GET /health do app) até HTTP 200.
 *
 * API: tRPC do EasyPanel v2 — GET/POST <EASY_PANEL_URL>/api/trpc/<proc>,
 * header `Authorization: Bearer <EASY_PANEL_KEY>`, resposta
 * `{"result":{"data":{"json": ...}}}`. A superfície de procedures foi
 * confirmada via o MCP comunitário (dray-supadev/easypanel-mcp); é API
 * interna e pode mudar entre versões do painel — se a procedure não existir
 * ("Procedure not found"), o script DEGRADA para trigger+health com aviso
 * (o health pode passar no pod antigo; o aviso fica no log).
 *
 * Uso: node scripts/deploy-monitor.mjs
 *
 * Env obrigatórias:
 *   DEPLOY_TRIGGER_URL   URL de trigger de deploy do EasyPanel (GET)
 *   EASY_PANEL_KEY       token Bearer do painel (Painel → API)        [secret]
 *   EASY_PANEL_URL       URL base do painel, ex.: https://panel.x.com
 *   EASY_PANEL_PROJECT   nome do projeto no painel
 *   EASY_PANEL_SERVICE   nome do serviço (stack) compose no painel
 *   HEALTHCHECK_URL      URL pública de /health do app
 * Env opcionais:
 *   MONITOR_TIMEOUT_MIN  timeout da action do deploy (padrão: 15)
 */
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const env = process.env;
const REQUIRED = [
	"DEPLOY_TRIGGER_URL",
	"EASY_PANEL_URL",
	"EASY_PANEL_KEY",
	"EASY_PANEL_PROJECT",
	"EASY_PANEL_SERVICE",
	"HEALTHCHECK_URL",
];
const missing = REQUIRED.filter((k) => !env[k]?.trim());
if (missing.length > 0) {
	console.error(`::error::Variáveis ausentes: ${missing.join(", ")}`);
	console.error(
		"EASY_PANEL_KEY como secret; DEPLOY_TRIGGER_URL, EASY_PANEL_URL, EASY_PANEL_PROJECT, EASY_PANEL_SERVICE e HEALTHCHECK_URL como variables — em Settings → Secrets and variables → Actions.",
	);
	process.exit(2);
}

const PANEL = env.EASY_PANEL_URL.replace(/\/+$/, "");
const SVC = {
	projectName: env.EASY_PANEL_PROJECT,
	serviceName: env.EASY_PANEL_SERVICE,
};
const POLL_MS = 10_000;
const WAIT_NEW_ACTION_MS = 3 * 60_000; // action nova deve aparecer logo após o trigger
const ACTION_TIMEOUT_MS = (Number(env.MONITOR_TIMEOUT_MIN) || 15) * 60_000;
const HEALTH_TIMEOUT_MS = 3 * 60_000;

/* ---------- tRPC do EasyPanel ---------- */

async function trpc(proc, input, isMutation = false) {
	const url = isMutation
		? `${PANEL}/api/trpc/${proc}`
		: `${PANEL}/api/trpc/${proc}${
				input !== undefined
					? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
					: ""
			}`;
	const init = isMutation
		? {
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.EASY_PANEL_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ json: input ?? {} }),
			}
		: { method: "GET", headers: { Authorization: `Bearer ${env.EASY_PANEL_KEY}` } };
	const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(`tRPC ${proc}: resposta não-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
	}
	if (json.error) {
		const msg =
			json.error?.json?.message ?? json.error?.message ?? JSON.stringify(json.error);
		throw new Error(`tRPC ${proc}: ${msg}`);
	}
	return json.result?.data?.json;
}

function isProcedureNotFound(e) {
	return /procedure not found|no procedure|notfound/i.test(String(e?.message ?? ""));
}

/* ---------- shape defensivo (API interna) ---------- */

function extractArray(data) {
	if (Array.isArray(data)) return data;
	if (data && typeof data === "object") {
		for (const v of Object.values(data)) if (Array.isArray(v)) return v;
	}
	return [];
}
function idOf(a) {
	return String(a?.id ?? a?._id ?? "");
}
function pickLatest(cands) {
	const withDate = cands.filter((a) => a.startedAt || a.createdAt);
	if (withDate.length > 0) {
		return withDate.reduce((m, a) =>
			new Date(a.startedAt ?? a.createdAt) > new Date(m.startedAt ?? m.createdAt) ? a : m,
		);
	}
	return cands[cands.length - 1]; // assume ordem mais recente primeiro
}

const SUCCESS = new Set(["success", "succeeded", "completed", "complete", "done", "finished", "ok"]);
const FAILED = new Set([
	"failed",
	"failure",
	"error",
	"errored",
	"stopped",
	"cancelled",
	"canceled",
	"timeout",
	"timed_out",
]);
const PENDING = new Set([
	"pending",
	"queued",
	"running",
	"inprogress",
	"in_progress",
	"started",
	"building",
	"deploying",
]);
function classifyAction(a) {
	const candidates = [a?.status, a?.state, a?.phase, a?.result, a?.data?.status, a?.data?.state];
	for (const v of candidates) {
		if (typeof v !== "string") continue;
		const s = v.toLowerCase();
		if (SUCCESS.has(s)) return "success";
		if (FAILED.has(s)) return "failed";
		if (PENDING.has(s)) return "pending";
	}
	return "unknown";
}

function writeFailure(detail) {
	try {
		const pretty =
			typeof detail === "string"
				? detail
				: (JSON.stringify(detail, null, 2) ?? JSON.stringify(String(detail)));
		writeFileSync("deploy-failure.log", pretty.slice(0, 500_000));
		console.error("[failure] Log completo gravado em deploy-failure.log");
	} catch {
		// não falhar por cima do problema real
	}
}

/* ---------- passos ---------- */

async function baselineActionIds() {
	const data = await trpc("actions.listActions", { ...SVC, limit: 10 });
	return new Set(extractArray(data).map(idOf).filter(Boolean));
}

async function waitNewAction(baseline) {
	const deadline = Date.now() + WAIT_NEW_ACTION_MS;
	while (Date.now() < deadline) {
		await sleep(POLL_MS);
		const data = await trpc("actions.listActions", { ...SVC, limit: 10 });
		const fresh = extractArray(data).filter((a) => {
			const id = idOf(a);
			return id !== "" && !baseline.has(id);
		});
		if (fresh.length > 0) return pickLatest(fresh);
	}
	return null;
}

async function waitForAction(action) {
	const id = idOf(action);
	const deadline = Date.now() + ACTION_TIMEOUT_MS;
	let first = true;
	while (true) {
		const detail = await trpc("actions.getAction", { id });
		// primeira leitura: imprime o shape real (a API é interna — facilita ajustar os sets acima)
		if (first) {
			first = false;
			const s = typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
			console.log(`[panel] action ${id} — shape bruto (truncado):\n${s.slice(0, 2000)}`);
		}
		const cls = classifyAction(detail);
		if (cls === "success") return;
		if (cls === "failed") {
			writeFailure(detail);
			throw new Error(`Action do deploy terminou em falha (detalhe no artifact easypanel-deploy-log)`);
		}
		if (Date.now() > deadline) {
			writeFailure(detail);
			throw new Error(`Timeout (${Math.round(ACTION_TIMEOUT_MS / 60000)}min) aguardando a action do deploy terminar — última classificação: ${cls}`);
		}
		console.log(`[monitor] action ${id}: ${cls} — ${Math.max(0, Math.round((deadline - Date.now()) / 1000))}s de timeout restantes`);
		await sleep(POLL_MS);
	}
}

async function triggerDeploy() {
	const res = await fetch(env.DEPLOY_TRIGGER_URL, { signal: AbortSignal.timeout(30_000) });
	const body = (await res.text()).slice(0, 500);
	console.log(`[trigger] HTTP ${res.status}: ${body}`);
	if (res.status < 200 || res.status >= 400) {
		throw new Error(`Trigger de deploy respondeu HTTP ${res.status}`);
	}
}

async function waitForHealth() {
	const deadline = Date.now() + HEALTH_TIMEOUT_MS;
	let last = "";
	while (true) {
		let code = 0;
		let body = "";
		try {
			const res = await fetch(env.HEALTHCHECK_URL, { signal: AbortSignal.timeout(10_000) });
			code = res.status;
			body = (await res.text()).slice(0, 300);
		} catch (e) {
			body = String(e?.message ?? e);
		}
		last = `HTTP ${code} ${body}`;
		if (code === 200) {
			console.log(`[health] OK: ${body}`);
			return;
		}
		if (Date.now() > deadline) {
			throw new Error(`Timeout no healthcheck (${env.HEALTHCHECK_URL}) — última resposta: ${last}`);
		}
		console.log(`[health] ${last} — retry em ${POLL_MS / 1000}s`);
		await sleep(POLL_MS);
	}
}

async function main() {
	console.log("== 1/5 Baseline de actions no painel ==");
	let panelAvailable = true;
	let baseline;
	try {
		baseline = await baselineActionIds();
		console.log(`[panel] ${baseline.size} action(s) anterior(es) — ok`);
	} catch (e) {
		if (isProcedureNotFound(e)) {
			console.log("::warning::actions.listActions indisponível nesta versão do EasyPanel — monitoração do painel desativada (segue trigger+health)");
			panelAvailable = false;
			baseline = new Set();
		} else {
			throw e;
		}
	}

	console.log("== 2/5 Disparando trigger de deploy (GET) ==");
	await triggerDeploy();

	let actionDone = false;
	if (panelAvailable) {
		console.log("== 3/5 Aguardando a action do deploy aparecer ==");
		let fresh = null;
		try {
			fresh = await waitNewAction(baseline);
		} catch (e) {
			if (!isProcedureNotFound(e)) throw e;
			console.log("::warning::actions.listActions indisponível — degrada para trigger+health");
			panelAvailable = false;
		}
		if (!fresh) {
			console.log("::warning::Nenhuma action nova apareceu em 3min após o trigger — não confirmo o início do deploy pelo painel");
		} else {
			console.log(`[panel] action do deploy: ${idOf(fresh)}`);
			console.log("== 4/5 Aguardando a action terminar ==");
			await waitForAction(fresh);
			console.log("[panel] action do deploy terminou com sucesso");
			actionDone = true;
		}
	} else if (!actionDone) {
		console.log("::warning::Sem monitoração do painel — o health abaixo pode estar passando no pod ANTIGO");
	}

	console.log("== 5/5 Healthcheck do app (novo pod no ar) ==");
	await waitForHealth();

	console.log("::group::Resumo");
	console.log(`Deploy ${panelAvailable && actionDone ? "disparado e confirmado no painel" : "disparado (sem confirmação de action)"}`);
	console.log(`App saudável em ${env.HEALTHCHECK_URL}`);
	console.log("::endgroup::");
}

main().catch((e) => {
	console.error(`::error::${e?.message ?? e}`);
	process.exit(1);
});
