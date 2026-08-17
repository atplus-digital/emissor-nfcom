import { describe, expect, it } from "bun:test";
import { erroResponse, HttpError, TipoErro } from "#/http/middlewares/envelope";

describe("envelope", () => {
	describe("TipoErro", () => {
		it("expõe a taxonomia canônica do app", () => {
			expect(TipoErro).toEqual({
				CONFLITO: "CONFLITO",
				VALIDACAO: "VALIDACAO",
				NAO_ENCONTRADO: "NAO_ENCONTRADO",
				ERRO_INTERNO: "ERRO_INTERNO",
				NAO_AUTORIZADO: "NAO_AUTORIZADO",
			});
		});
	});

	describe("erroResponse", () => {
		it("monta o envelope canônico com detalhe default {}", () => {
			const { corpo, status } = erroResponse(TipoErro.CONFLITO, "emissão em curso");
			expect(status).toBe(409);
			expect(corpo).toEqual({ erro: { tipo: "CONFLITO", mensagem: "emissão em curso", detalhe: {} } });
		});

		it("aceita detalhe custom e status custom", () => {
			const { corpo, status } = erroResponse(
				TipoErro.VALIDACAO,
				"campo inválido",
				{ campos: ["parceiroId"] },
				422,
			);
			expect(status).toBe(422);
			expect(corpo.erro.detalhe).toEqual({ campos: ["parceiroId"] });
		});

		it("deriva o status default por tipo", () => {
			expect(erroResponse(TipoErro.CONFLITO, "x").status).toBe(409);
			expect(erroResponse(TipoErro.VALIDACAO, "x").status).toBe(422);
			expect(erroResponse(TipoErro.NAO_ENCONTRADO, "x").status).toBe(404);
			expect(erroResponse(TipoErro.ERRO_INTERNO, "x").status).toBe(500);
			expect(erroResponse(TipoErro.NAO_AUTORIZADO, "x").status).toBe(401);
		});
	});

	describe("HttpError", () => {
		it("carrega tipo, mensagem, status e detalhe", () => {
			const err = new HttpError(TipoErro.CONFLITO, "emissão em curso");
			expect(err.tipo).toBe("CONFLITO");
			expect(err.status).toBe(409);
			expect(err.mensagem).toBe("emissão em curso");
			expect(err.detalhe).toEqual({});
			expect(err instanceof Error).toBe(true);
		});

		it("aceita detalhe e status custom", () => {
			const err = new HttpError(TipoErro.VALIDACAO, "x", { campo: "dataReferencia" }, 422);
			expect(err.status).toBe(422);
			expect(err.detalhe).toEqual({ campo: "dataReferencia" });
		});

		it("toResponse retorna o envelope canônico", () => {
			const err = new HttpError(TipoErro.NAO_ENCONTRADO, "fatura não existe");
			const { corpo, status } = err.toResponse();
			expect(status).toBe(404);
			expect(corpo).toEqual({ erro: { tipo: "NAO_ENCONTRADO", mensagem: "fatura não existe", detalhe: {} } });
		});
	});
});
