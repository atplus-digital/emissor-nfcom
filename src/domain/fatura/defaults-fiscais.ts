/**
 * Defaults fiscais aplicados aos itens no cálculo (SPEC-0002 "Decisões fechadas"):
 * CFOP, CCLASS e alíquota de ICMS por estado vêm de **variáveis de ambiente**
 * (`FISCAL_CFOP_DEFAULT`, `FISCAL_CCLASS_DEFAULT`, `FISCAL_ICMS_ALIQUOTA`, em env
 * validada por Zod — ADR-0005), não hardcoded. O domínio não lê env (ADR-0004),
 * então estes defaults são **passados** à `calcularFatura` pelo caller (rota →
 * composition root lê `env.FISCAL_*`). Valores provisórios até revisão com
 * contador (Revisão humana da SPEC-0002).
 */
export interface DefaultsFiscais {
	cfop: string;
	cclass: string;
	aliqIcms: number;
}

/**
 * Default de fallback usado quando o caller não injeta (ex.: testes de rotas que
 * não exercitam o cálculo). Em produção o composition root injeta `env.FISCAL_*`.
 * Valores provisórios (Revisão humana da SPEC-0002).
 */
export const DEFAULTS_FISCAIS_PADRAO: DefaultsFiscais = {
	cfop: "6102",
	cclass: "",
	aliqIcms: 0,
};

