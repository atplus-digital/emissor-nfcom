/**
 * test/lib/logger.test.ts — ADR-0008: logging estruturado com pino.
 *
 * TDD: este arquivo descreve o comportamento esperado de src/lib/logger ANTES
 * da implementação. Cada caso abaixo deve falhar até src/lib/logger existir.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Writable } from "node:stream";
import { createLogger, runWithLogContext, getLogContext } from "#/lib/logger";

/**
 * Captura linhas de log num array. Retorna um Writable real (pino-pretty exige um
 * stream com .on/.end) que acumula os chunks num array. Cada chunk do pino é uma
 * linha (JSON em prod; texto pretty em dev).
 */
function captureLines(): {
	dest: Writable;
	lines: string[];
	reset(): void;
} {
	const lines: string[] = [];
	const dest = new Writable({
		write(chunk, _enc, cb) {
			lines.push(chunk.toString());
			cb();
		},
	});
	return {
		dest,
		lines,
		reset() {
			lines.length = 0;
		},
	};
}

const REAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
	// restaura NODE_ENV entre testes (factory lê env em tempo de criação)
	if (REAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = REAL_NODE_ENV;
});

describe("logger — redação (ADR-0008 redação por allowlist)", () => {
	test("CPF/CNPJ no payload é redigido", () => {
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest });
		log.info({ cpfcnpj: "11122233344", documento: "12345678000199" }, "emissão");
		// pino redact emite o caminho original com valor "[Redacted]"
		expect(lines.join("")).toContain("[Redacted]");
		expect(lines.join("")).not.toContain("11122233344");
		expect(lines.join("")).not.toContain("12345678000199");
	});

	test("headers de autenticação são redigidos", () => {
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest });
		log.info(
			{
				access_token: "secret-token-xyz",
				"X-API-Key": "key-abc",
				"X-Webhook-Signature": "sig-def",
				Authorization: "Bearer abc",
			},
			"req",
		);
		const out = lines.join("");
		expect(out).not.toContain("secret-token-xyz");
		expect(out).not.toContain("key-abc");
		expect(out).not.toContain("sig-def");
		expect(out).not.toContain("Bearer abc");
		expect(out).toContain("[Redacted]");
	});
});

describe("logger — contexto por AsyncLocalStorage (ADR-0008 ALS)", () => {
	test("campos do store aparecem em cada linha de log dentro do contexto", () => {
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest });
		runWithLogContext({ faturaId: 123 }, () => {
			log.info("inicio");
		});
		const out = lines.join("");
		// formato-agnóstico (dev pretty: "faturaId: 123"; prod JSON: "faturaId":123)
		expect(out).toMatch(/faturaId[:\s]+123/);
	});

	test("fora do contexto, os campos não aparecem", () => {
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest });
		log.info("sem contexto");
		const out = lines.join("");
		expect(out).not.toContain('"faturaId"');
	});

	test("getLogContext retorna o contexto corrente (ou undefined fora)", () => {
		const { dest } = captureLines();
		createLogger({ destination: dest });
		expect(getLogContext()).toBeUndefined();
		runWithLogContext({ jobId: "job-7" }, () => {
			expect(getLogContext()?.jobId).toBe("job-7");
		});
		expect(getLogContext()).toBeUndefined();
	});

	test("contexto aninhado — filho sobrescreve, pai restaura", () => {
		const { dest } = captureLines();
		createLogger({ destination: dest });
		const seen: (number | undefined)[] = [];
		runWithLogContext({ faturaId: 1 }, () => {
			runWithLogContext({ faturaId: 2 }, () => {
				seen.push(getLogContext()?.faturaId);
			});
			seen.push(getLogContext()?.faturaId);
		});
		seen.push(getLogContext()?.faturaId);
		expect(seen).toEqual([2, 1, undefined]);
	});
});

describe("logger — formato por ambiente (ADR-0008 JSON prod / pretty dev)", () => {
	test("produção → JSON (linha parseável como JSON)", () => {
		process.env.NODE_ENV = "production";
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest });
		log.info({ ok: true }, "msg");
		const parsed = JSON.parse(lines.join("").trim());
		expect(parsed.ok).toBe(true);
		expect(parsed.msg).toBe("msg");
	});

	test("dev → pretty (não é JSON puro)", () => {
		delete process.env.NODE_ENV;
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest });
		log.info({ ok: true }, "msg");
		const out = lines.join("");
		// pretty tem marca ANSI / "INFO" em texto; não é uma linha JSON estrita
		expect(out).not.toMatch(/^\{.*\}$/s);
	});
});

describe("logger — nível (ADR-0008 LOG_LEVEL)", () => {
	test("nível default info — debug não é emitido", () => {
		process.env.NODE_ENV = "production";
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest });
		log.debug("nao-emite");
		expect(lines.length).toBe(0);
		log.info("emite");
		expect(lines.length).toBe(1);
	});

	test("nível respeita opção level", () => {
		process.env.NODE_ENV = "production";
		const { dest, lines } = captureLines();
		const log = createLogger({ destination: dest, level: "debug" });
		log.debug("emite-debug");
		expect(lines.join("")).toContain("emite-debug");
	});
});
