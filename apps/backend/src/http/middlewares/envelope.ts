/**
 * src/http/middlewares/envelope.ts — envelope de erro HTTP canônico (CONVENTIONS).
 *
 * Toda resposta de erro das rotas usa `{ erro: { tipo, mensagem, detalhe } }`.
 * `tipo` é um código estável da taxonomia do app (não o nome da classe). Status
 * derivado do tipo (409/422/404/500/401). `HttpError` é o erro de domínio/rota que o
 * error-handler traduz — rotas lançam `HttpError` (ou ZodError) e o handler serializa.
 *
 * Compartilhado por error-handler e rotas (5b importa cá).
 */

/** Taxonomia canônica de tipos de erro (CONVENTIONS · Envelope de erro). */
export const TipoErro = {
	CONFLITO: "CONFLITO",
	VALIDACAO: "VALIDACAO",
	NAO_ENCONTRADO: "NAO_ENCONTRADO",
	ERRO_INTERNO: "ERRO_INTERNO",
	NAO_AUTORIZADO: "NAO_AUTORIZADO",
} as const;
export type TipoErro = (typeof TipoErro)[keyof typeof TipoErro];

/**
 * Detalhe estruturado do erro no envelope. Abreviação deliberada de
 * `Record<string, unknown>`: o detalhe é um objeto de payload livre (detalhe de
 * erro, não tipo de provedor). Intencional e local a este módulo — documenta a
 * exceção ao ADR-0004 (§ módulos) para o detalhe do envelope.
 */
export type ErroDetalhe = Record<string, unknown>;

/** Corpo do envelope canônico. */
export interface ErroCorpo {
	erro: { tipo: string; mensagem: string; detalhe: ErroDetalhe };
}

/** Status HTTP default por tipo (CONVENTIONS). */
const STATUS_POR_TIPO: Record<TipoErro, number> = {
	CONFLITO: 409,
	VALIDACAO: 422,
	NAO_ENCONTRADO: 404,
	ERRO_INTERNO: 500,
	NAO_AUTORIZADO: 401,
};

/**
 * Monta o envelope canônico + status. `status` default = derivado do `tipo`.
 */
export function erroResponse(
	tipo: TipoErro,
	mensagem: string,
	detalhe: ErroDetalhe = {},
	status: number = STATUS_POR_TIPO[tipo],
): { corpo: ErroCorpo; status: number } {
	return {
		corpo: { erro: { tipo, mensagem, detalhe } },
		status,
	};
}

/**
 * Erro de aplicação que rotas/domínio lançam; o error-handler o traduz para o envelope.
 * Carrega `tipo` (taxonomia), `status`, `mensagem`, `detalhe`.
 */
export class HttpError extends Error {
	readonly tipo: TipoErro;
	readonly status: number;
	readonly detalhe: ErroDetalhe;
	/** Mensagem de domínio (espelha Error.message para acesso nominal no envelope). */
	readonly mensagem: string;

	constructor(
		tipo: TipoErro,
		mensagem: string,
		detalhe: ErroDetalhe = {},
		status: number = STATUS_POR_TIPO[tipo],
	) {
		super(mensagem);
		this.name = "HttpError";
		this.tipo = tipo;
		this.mensagem = mensagem;
		this.status = status;
		this.detalhe = detalhe;
	}

	/** Serializa para o envelope canônico. */
	toResponse(): { corpo: ErroCorpo; status: number } {
		return erroResponse(this.tipo, this.mensagem, this.detalhe, this.status);
	}
}
