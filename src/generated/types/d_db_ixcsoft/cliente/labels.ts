/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const CLIENTE_FIELD_LABELS = {
	acesso_automatico_central: "acesso_automatico_central",
	alerta: "alerta",
	alterar_senha_primeiro_acesso: "alterar_senha_primeiro_acesso",
	antigo_acesso_central: "antigo_acesso_central",
	apartamento: "apartamento",
	ativo: "ativo",
	ativo_serasa: "ativo_serasa",
	atualizar_cadastro_galaxPay: "atualizar_cadastro_galaxPay",
	aviso_atraso: "aviso_atraso",
	bairro: "bairro",
	bairro_cob: "bairro_cob",
	bloco: "bloco",
	bloqueio_automatico: "bloqueio_automatico",
	cadastrado_no_galaxPay: "cadastrado_no_galaxPay",
	cadastrado_via_viabilidade: "cadastrado_via_viabilidade",
	cep: "cep",
	cep_cob: "cep_cob",
	cidade: "cidade",
	cidade_cob: "cidade_cob",
	cidade_naturalidade: "cidade_naturalidade",
	cif: "cif",
	cli_desconta_iss_retido_total: "cli_desconta_iss_retido_total",
	cnpj_cpf: "cnpj_cpf",
	cnpj_cpf_titular_conta: "cnpj_cpf_titular_conta",
	cob_envia_email: "cob_envia_email",
	cob_envia_sms: "cob_envia_sms",
	codigo_operacao: "codigo_operacao",
	cofins_retem: "cofins_retem",
	complemento: "complemento",
	complemento_cob: "complemento_cob",
	cond_pagamento: "cond_pagamento",
	contato: "contato",
	contribuinte_icms: "contribuinte_icms",
	convert_cliente_forn: "convert_cliente_forn",
	cpf_conjuge: "cpf_conjuge",
	cpf_mae: "cpf_mae",
	cpf_pai: "cpf_pai",
	cpf_representante_1: "cpf_representante_1",
	cpf_representante_2: "cpf_representante_2",
	crm: "crm",
	crm_data_abortamos: "crm_data_abortamos",
	crm_data_apresentando: "crm_data_apresentando",
	crm_data_negociando: "crm_data_negociando",
	crm_data_novo: "crm_data_novo",
	crm_data_perdemos: "crm_data_perdemos",
	crm_data_sem_porta_disponivel: "crm_data_sem_porta_disponivel",
	crm_data_sem_viabilidade: "crm_data_sem_viabilidade",
	crm_data_sondagem: "crm_data_sondagem",
	crm_data_vencemos: "crm_data_vencemos",
	csll_retem: "csll_retem",
	data: "data",
	data_cadastro: "data_cadastro",
	data_hash_redefinir_senha: "data_hash_redefinir_senha",
	data_nascimento: "data_nascimento",
	data_nascimento_conjuge: "data_nascimento_conjuge",
	data_reserva_auto_viab: "data_reserva_auto_viab",
	deb_agencia: "deb_agencia",
	deb_automatico: "deb_automatico",
	deb_conta: "deb_conta",
	desconto_irrf_valor_inferior: "desconto_irrf_valor_inferior",
	dia_vencimento: "dia_vencimento",
	email: "email",
	emp_cargo: "emp_cargo",
	emp_cep: "emp_cep",
	emp_cidade: "emp_cidade",
	emp_cnpj: "emp_cnpj",
	emp_contato: "emp_contato",
	emp_data_admissao: "emp_data_admissao",
	emp_empresa: "emp_empresa",
	emp_endereco: "emp_endereco",
	emp_fone: "emp_fone",
	emp_remuneracao: "emp_remuneracao",
	endereco: "endereco",
	endereco_cob: "endereco_cob",
	estado_civil: "estado_civil",
	external_id: "external_id",
	external_system: "external_system",
	facebook: "facebook",
	fantasia: "fantasia",
	filial_id: "filial_id",
	filtra_filial: "filtra_filial",
	fone: "fone",
	fone_conjuge: "fone_conjuge",
	freq_celular_calc_vel: "freq_celular_calc_vel",
	freq_computador_calc_vel: "freq_computador_calc_vel",
	freq_console_calc_vel: "freq_console_calc_vel",
	freq_pessoas_calc_vel: "freq_pessoas_calc_vel",
	freq_smart_calc_vel: "freq_smart_calc_vel",
	grau_satisfacao: "grau_satisfacao",
	hash_redefinir_senha: "hash_redefinir_senha",
	hotsite_acesso: "hotsite_acesso",
	hotsite_email: "hotsite_email",
	id: "id",
	id_campanha: "id_campanha",
	id_canal_venda: "id_canal_venda",
	id_candato_tipo: "id_candato_tipo",
	id_concorrente: "id_concorrente",
	id_condominio: "id_condominio",
	id_conta: "id_conta",
	id_contato_principal: "id_contato_principal",
	id_fornecedor_conversao: "id_fornecedor_conversao",
	id_galaxPay: "id_galaxPay",
	id_myauth: "id_myauth",
	id_operadora_celular: "id_operadora_celular",
	id_perfil: "id_perfil",
	id_segmento: "id_segmento",
	id_tipo_cliente: "id_tipo_cliente",
	id_vd_contrato_desejado: "id_vd_contrato_desejado",
	id_vendedor: "id_vendedor",
	id_vindi: "id_vindi",
	identidade_mae: "identidade_mae",
	identidade_pai: "identidade_pai",
	identidade_representante_1: "identidade_representante_1",
	identidade_representante_2: "identidade_representante_2",
	idx: "idx",
	ie_identidade: "ie_identidade",
	im: "im",
	indicado_por: "indicado_por",
	inscricao_municipal: "inscricao_municipal",
	inss_retem: "inss_retem",
	ip_sistema: "ip_sistema",
	irrf_retem: "irrf_retem",
	iss_classificacao: "iss_classificacao",
	iss_classificacao_padrao: "iss_classificacao_padrao",
	isuf: "isuf",
	latitude: "latitude",
	longitude: "longitude",
	melhor_periodo_reserva_auto_viab: "melhor_periodo_reserva_auto_viab",
	moradia: "moradia",
	nacionalidade: "nacionalidade",
	nao_avisar_ate: "nao_avisar_ate",
	nao_bloquear_ate: "nao_bloquear_ate",
	nascimento_mae: "nascimento_mae",
	nascimento_pai: "nascimento_pai",
	nome_conjuge: "nome_conjuge",
	nome_contador: "nome_contador",
	nome_mae: "nome_mae",
	nome_pai: "nome_pai",
	nome_representante_1: "nome_representante_1",
	nome_representante_2: "nome_representante_2",
	nome_social: "nome_social",
	num_dias_cob: "num_dias_cob",
	numero: "numero",
	numero_antigo: "numero_antigo",
	numero_cob: "numero_cob",
	numero_cob_antigo: "numero_cob_antigo",
	obs: "obs",
	operador_neutro: "operador_neutro",
	orgao_publico: "orgao_publico",
	participa_cobranca: "participa_cobranca",
	participa_pre_cobranca: "participa_pre_cobranca",
	percentual_reducao: "percentual_reducao",
	permite_armazenar_cartoes: "permite_armazenar_cartoes",
	pipe_id_organizacao: "pipe_id_organizacao",
	pis_retem: "pis_retem",
	plano_negociacao_auto_viab: "plano_negociacao_auto_viab",
	porta_ssh_sistema: "porta_ssh_sistema",
	primeiro_acesso_central: "primeiro_acesso_central",
	profissao: "profissao",
	prospeccao_proximo_contato: "prospeccao_proximo_contato",
	prospeccao_ultimo_contato: "prospeccao_ultimo_contato",
	qtd_celular_calc_vel: "qtd_celular_calc_vel",
	qtd_computador_calc_vel: "qtd_computador_calc_vel",
	qtd_console_calc_vel: "qtd_console_calc_vel",
	qtd_pessoas_calc_vel: "qtd_pessoas_calc_vel",
	qtd_smart_calc_vel: "qtd_smart_calc_vel",
	quantidade_dependentes: "quantidade_dependentes",
	ramal: "ramal",
	razao: "razao",
	rede_ativacao: "rede_ativacao",
	ref_com_empresa1: "ref_com_empresa1",
	ref_com_empresa2: "ref_com_empresa2",
	ref_com_fone1: "ref_com_fone1",
	ref_com_fone2: "ref_com_fone2",
	ref_pes_fone1: "ref_pes_fone1",
	ref_pes_fone2: "ref_pes_fone2",
	ref_pes_nome1: "ref_pes_nome1",
	ref_pes_nome2: "ref_pes_nome2",
	referencia: "referencia",
	referencia_cob: "referencia_cob",
	regime_fiscal_col: "regime_fiscal_col",
	regua_cobranca_considera: "regua_cobranca_considera",
	regua_cobranca_notificacao: "regua_cobranca_notificacao",
	regua_cobranca_wpp: "regua_cobranca_wpp",
	remessa_debito: "remessa_debito",
	responsavel: "responsavel",
	resultado_calc_vel: "resultado_calc_vel",
	rg_conjuge: "rg_conjuge",
	rg_orgao_emissor: "rg_orgao_emissor",
	senha: "senha",
	senha_hotsite_md5: "senha_hotsite_md5",
	senha_root_sistema: "senha_root_sistema",
	Sexo: "Sexo",
	skype: "skype",
	status_internet: "status_internet",
	status_prospeccao: "status_prospeccao",
	status_viabilidade: "status_viabilidade",
	substatus_prospeccao: "substatus_prospeccao",
	tabela_preco: "tabela_preco",
	telefone_celular: "telefone_celular",
	telefone_comercial: "telefone_comercial",
	telefone_contador: "telefone_contador",
	tipo_assinante: "tipo_assinante",
	tipo_cliente_scm: "tipo_cliente_scm",
	tipo_cobranca_auto_viab: "tipo_cobranca_auto_viab",
	tipo_documento_identificacao: "tipo_documento_identificacao",
	tipo_ente_governamental: "tipo_ente_governamental",
	tipo_localidade: "tipo_localidade",
	tipo_pessoa: "tipo_pessoa",
	tipo_pessoa_titular_conta: "tipo_pessoa_titular_conta",
	tipo_rede: "tipo_rede",
	tv_access_token: "tv_access_token",
	tv_code: "tv_code",
	tv_refresh_token: "tv_refresh_token",
	tv_token_expires_in: "tv_token_expires_in",
	uf: "uf",
	uf_cob: "uf_cob",
	ultima_atualizacao: "ultima_atualizacao",
	url_sistema: "url_sistema",
	url_site: "url_site",
	website: "website",
	whatsapp: "whatsapp",
	yapay_token_account: "yapay_token_account",
} as const;

export const FIELD_LABELS = CLIENTE_FIELD_LABELS;

export const CLIENTE_ALTERAR_SENHA_PRIMEIRO_ACESSO_LABELS = {
	S: "S",
	N: "N",
	P: "P",
} as const;

export const CLIENTE_ANTIGO_ACESSO_CENTRAL_LABELS = {
	S: "S",
	N: "N",
	A: "A",
} as const;

export const CLIENTE_ATIVO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_ATUALIZAR_CADASTRO_GALAX_PAY_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_AVISO_ATRASO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_BLOQUEIO_AUTOMATICO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CADASTRADO_NO_GALAX_PAY_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CADASTRADO_VIA_VIABILIDADE_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CLI_DESCONTA_ISS_RETIDO_TOTAL_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_COB_ENVIA_EMAIL_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_COB_ENVIA_SMS_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_COFINS_RETEM_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CONTRIBUINTE_ICMS_LABELS = {
	S: "S",
	N: "N",
	I: "I",
} as const;

export const CLIENTE_CONVERT_CLIENTE_FORN_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CRM_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CSLL_RETEM_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_DESCONTO_IRRF_VALOR_INFERIOR_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_ESTADO_CIVIL_LABELS = {
	Casado: "Casado",
	Solteiro: "Solteiro",
	Divorciado: "Divorciado",
	Viúvo: "Viúvo",
} as const;

export const CLIENTE_FILTRA_FILIAL_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_GRAU_SATISFACAO_LABELS = {
	1: "1",
	2: "2",
	3: "3",
	4: "4",
	5: "5",
} as const;

export const CLIENTE_INSS_RETEM_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_IRRF_RETEM_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_MELHOR_PERIODO_RESERVA_AUTO_VIAB_LABELS = {
	M: "M",
	N: "N",
	T: "T",
} as const;

export const CLIENTE_MORADIA_LABELS = {
	P: "P",
	A: "A",
} as const;

export const CLIENTE_ORGAO_PUBLICO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_PARTICIPA_COBRANCA_LABELS = {
	S: "S",
	N: "N",
	P: "P",
} as const;

export const CLIENTE_PARTICIPA_PRE_COBRANCA_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_PERMITE_ARMAZENAR_CARTOES_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_PIS_RETEM_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_REDE_ATIVACAO_LABELS = {
	P: "P",
	N: "N",
} as const;

export const CLIENTE_REGIME_FISCAL_COL_LABELS = {
	48: "48",
	49: "49",
} as const;

export const CLIENTE_REGUA_COBRANCA_CONSIDERA_LABELS = {
	S: "S",
	N: "N",
	P: "P",
} as const;

export const CLIENTE_REGUA_COBRANCA_NOTIFICACAO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_REGUA_COBRANCA_WPP_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_SENHA_HOTSITE_MD5_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_SEXO_LABELS = {
	F: "F",
	M: "M",
	NB: "NB",
	O: "O",
	PNI: "PNI",
} as const;

export const CLIENTE_STATUS_INTERNET_LABELS = {
	N: "N",
	A: "A",
	D: "D",
	CM: "CM",
	CA: "CA",
	CE: "CE",
	FA: "FA",
} as const;

export const CLIENTE_STATUS_PROSPECCAO_LABELS = {
	C: "C",
	S: "S",
	A: "A",
	N: "N",
	V: "V",
	P: "P",
	AB: "AB",
	SV: "SV",
	SP: "SP",
	AC: "AC",
} as const;

export const CLIENTE_STATUS_VIABILIDADE_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_TIPO_ASSINANTE_LABELS = {
	1: "1",
	2: "2",
	3: "3",
	4: "4",
	5: "5",
	6: "6",
} as const;

export const CLIENTE_TIPO_CLIENTE_SCM_LABELS = {
	"01": "01",
	"02": "02",
	"03": "03",
	"04": "04",
	"05": "05",
	"06": "06",
	"07": "07",
	"08": "08",
	99: "99",
	"0-13": "0-13",
	"0-15": "0-15",
	"0-23": "0-23",
	"0-47": "0-47",
	"R-99-PN": "R-99-PN",
} as const;

export const CLIENTE_TIPO_ENTE_GOVERNAMENTAL_LABELS = {
	1: "1",
	2: "2",
	3: "3",
	4: "4",
} as const;

export const CLIENTE_TIPO_LOCALIDADE_LABELS = {
	R: "R",
	U: "U",
} as const;

export const CLIENTE_TIPO_PESSOA_LABELS = {
	J: "J",
	F: "F",
	E: "E",
	1: "1",
	2: "2",
	3: "3",
} as const;

export const CLIENTE_TIPO_PESSOA_TITULAR_CONTA_LABELS = {
	F: "F",
	J: "J",
} as const;

export const CLIENTE_TIPO_REDE_LABELS = {
	P: "P",
	N: "N",
	A: "A",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	alterar_senha_primeiro_acesso: CLIENTE_ALTERAR_SENHA_PRIMEIRO_ACESSO_LABELS,
	antigo_acesso_central: CLIENTE_ANTIGO_ACESSO_CENTRAL_LABELS,
	ativo: CLIENTE_ATIVO_LABELS,
	atualizar_cadastro_galaxPay: CLIENTE_ATUALIZAR_CADASTRO_GALAX_PAY_LABELS,
	aviso_atraso: CLIENTE_AVISO_ATRASO_LABELS,
	bloqueio_automatico: CLIENTE_BLOQUEIO_AUTOMATICO_LABELS,
	cadastrado_no_galaxPay: CLIENTE_CADASTRADO_NO_GALAX_PAY_LABELS,
	cadastrado_via_viabilidade: CLIENTE_CADASTRADO_VIA_VIABILIDADE_LABELS,
	cli_desconta_iss_retido_total: CLIENTE_CLI_DESCONTA_ISS_RETIDO_TOTAL_LABELS,
	cob_envia_email: CLIENTE_COB_ENVIA_EMAIL_LABELS,
	cob_envia_sms: CLIENTE_COB_ENVIA_SMS_LABELS,
	cofins_retem: CLIENTE_COFINS_RETEM_LABELS,
	contribuinte_icms: CLIENTE_CONTRIBUINTE_ICMS_LABELS,
	convert_cliente_forn: CLIENTE_CONVERT_CLIENTE_FORN_LABELS,
	crm: CLIENTE_CRM_LABELS,
	csll_retem: CLIENTE_CSLL_RETEM_LABELS,
	desconto_irrf_valor_inferior: CLIENTE_DESCONTO_IRRF_VALOR_INFERIOR_LABELS,
	estado_civil: CLIENTE_ESTADO_CIVIL_LABELS,
	filtra_filial: CLIENTE_FILTRA_FILIAL_LABELS,
	grau_satisfacao: CLIENTE_GRAU_SATISFACAO_LABELS,
	inss_retem: CLIENTE_INSS_RETEM_LABELS,
	irrf_retem: CLIENTE_IRRF_RETEM_LABELS,
	melhor_periodo_reserva_auto_viab:
		CLIENTE_MELHOR_PERIODO_RESERVA_AUTO_VIAB_LABELS,
	moradia: CLIENTE_MORADIA_LABELS,
	orgao_publico: CLIENTE_ORGAO_PUBLICO_LABELS,
	participa_cobranca: CLIENTE_PARTICIPA_COBRANCA_LABELS,
	participa_pre_cobranca: CLIENTE_PARTICIPA_PRE_COBRANCA_LABELS,
	permite_armazenar_cartoes: CLIENTE_PERMITE_ARMAZENAR_CARTOES_LABELS,
	pis_retem: CLIENTE_PIS_RETEM_LABELS,
	rede_ativacao: CLIENTE_REDE_ATIVACAO_LABELS,
	regime_fiscal_col: CLIENTE_REGIME_FISCAL_COL_LABELS,
	regua_cobranca_considera: CLIENTE_REGUA_COBRANCA_CONSIDERA_LABELS,
	regua_cobranca_notificacao: CLIENTE_REGUA_COBRANCA_NOTIFICACAO_LABELS,
	regua_cobranca_wpp: CLIENTE_REGUA_COBRANCA_WPP_LABELS,
	senha_hotsite_md5: CLIENTE_SENHA_HOTSITE_MD5_LABELS,
	Sexo: CLIENTE_SEXO_LABELS,
	status_internet: CLIENTE_STATUS_INTERNET_LABELS,
	status_prospeccao: CLIENTE_STATUS_PROSPECCAO_LABELS,
	status_viabilidade: CLIENTE_STATUS_VIABILIDADE_LABELS,
	tipo_assinante: CLIENTE_TIPO_ASSINANTE_LABELS,
	tipo_cliente_scm: CLIENTE_TIPO_CLIENTE_SCM_LABELS,
	tipo_ente_governamental: CLIENTE_TIPO_ENTE_GOVERNAMENTAL_LABELS,
	tipo_localidade: CLIENTE_TIPO_LOCALIDADE_LABELS,
	tipo_pessoa: CLIENTE_TIPO_PESSOA_LABELS,
	tipo_pessoa_titular_conta: CLIENTE_TIPO_PESSOA_TITULAR_CONTA_LABELS,
	tipo_rede: CLIENTE_TIPO_REDE_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const clienteAlterarSenhaPrimeiroAcessoSchema = z.enum(["S", "N", "P"], {
	error: () => ({
		message: "alterar_senha_primeiro_acesso: valores válidos são [S, N, P]",
	}),
});

export const clienteAntigoAcessoCentralSchema = z.enum(["S", "N", "A"], {
	error: () => ({
		message: "antigo_acesso_central: valores válidos são [S, N, A]",
	}),
});

export const clienteAtivoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "ativo: valores válidos são [S, N]" }),
});

export const clienteAtualizarCadastroGalaxpaySchema = z.enum(["S", "N"], {
	error: () => ({
		message: "atualizar_cadastro_galaxPay: valores válidos são [S, N]",
	}),
});

export const clienteAvisoAtrasoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "aviso_atraso: valores válidos são [S, N]" }),
});

export const clienteBloqueioAutomaticoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "bloqueio_automatico: valores válidos são [S, N]" }),
});

export const clienteCadastradoNoGalaxpaySchema = z.enum(["S", "N"], {
	error: () => ({
		message: "cadastrado_no_galaxPay: valores válidos são [S, N]",
	}),
});

export const clienteCadastradoViaViabilidadeSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "cadastrado_via_viabilidade: valores válidos são [S, N]",
	}),
});

export const clienteCliDescontaIssRetidoTotalSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "cli_desconta_iss_retido_total: valores válidos são [S, N]",
	}),
});

export const clienteCobEnviaEmailSchema = z.enum(["S", "N"], {
	error: () => ({ message: "cob_envia_email: valores válidos são [S, N]" }),
});

export const clienteCobEnviaSmsSchema = z.enum(["S", "N"], {
	error: () => ({ message: "cob_envia_sms: valores válidos são [S, N]" }),
});

export const clienteCofinsRetemSchema = z.enum(["S", "N"], {
	error: () => ({ message: "cofins_retem: valores válidos são [S, N]" }),
});

export const clienteContribuinteIcmsSchema = z.enum(["S", "N", "I"], {
	error: () => ({
		message: "contribuinte_icms: valores válidos são [S, N, I]",
	}),
});

export const clienteConvertClienteFornSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "convert_cliente_forn: valores válidos são [S, N]",
	}),
});

export const clienteCrmSchema = z.enum(["S", "N"], {
	error: () => ({ message: "crm: valores válidos são [S, N]" }),
});

export const clienteCsllRetemSchema = z.enum(["S", "N"], {
	error: () => ({ message: "csll_retem: valores válidos são [S, N]" }),
});

export const clienteDescontoIrrfValorInferiorSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "desconto_irrf_valor_inferior: valores válidos são [S, N]",
	}),
});

export const clienteEstadoCivilSchema = z.enum(
	["Casado", "Solteiro", "Divorciado", "Viúvo"],
	{
		error: () => ({
			message:
				"estado_civil: valores válidos são [Casado, Solteiro, Divorciado, Viúvo]",
		}),
	},
);

export const clienteFiltraFilialSchema = z.enum(["S", "N"], {
	error: () => ({ message: "filtra_filial: valores válidos são [S, N]" }),
});

export const clienteGrauSatisfacaoSchema = z.enum(["1", "2", "3", "4", "5"], {
	error: () => ({
		message: "grau_satisfacao: valores válidos são [1, 2, 3, 4, 5]",
	}),
});

export const clienteInssRetemSchema = z.enum(["S", "N"], {
	error: () => ({ message: "inss_retem: valores válidos são [S, N]" }),
});

export const clienteIrrfRetemSchema = z.enum(["S", "N"], {
	error: () => ({ message: "irrf_retem: valores válidos são [S, N]" }),
});

export const clienteMelhorPeriodoReservaAutoViabSchema = z.enum(
	["M", "N", "T"],
	{
		error: () => ({
			message:
				"melhor_periodo_reserva_auto_viab: valores válidos são [M, N, T]",
		}),
	},
);

export const clienteMoradiaSchema = z.enum(["P", "A"], {
	error: () => ({ message: "moradia: valores válidos são [P, A]" }),
});

export const clienteOrgaoPublicoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "orgao_publico: valores válidos são [S, N]" }),
});

export const clienteParticipaCobrancaSchema = z.enum(["S", "N", "P"], {
	error: () => ({
		message: "participa_cobranca: valores válidos são [S, N, P]",
	}),
});

export const clienteParticipaPreCobrancaSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "participa_pre_cobranca: valores válidos são [S, N]",
	}),
});

export const clientePermiteArmazenarCartoesSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "permite_armazenar_cartoes: valores válidos são [S, N]",
	}),
});

export const clientePisRetemSchema = z.enum(["S", "N"], {
	error: () => ({ message: "pis_retem: valores válidos são [S, N]" }),
});

export const clienteRedeAtivacaoSchema = z.enum(["P", "N"], {
	error: () => ({ message: "rede_ativacao: valores válidos são [P, N]" }),
});

export const clienteRegimeFiscalColSchema = z.enum(["48", "49"], {
	error: () => ({ message: "regime_fiscal_col: valores válidos são [48, 49]" }),
});

export const clienteReguaCobrancaConsideraSchema = z.enum(["S", "N", "P"], {
	error: () => ({
		message: "regua_cobranca_considera: valores válidos são [S, N, P]",
	}),
});

export const clienteReguaCobrancaNotificacaoSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "regua_cobranca_notificacao: valores válidos são [S, N]",
	}),
});

export const clienteReguaCobrancaWppSchema = z.enum(["S", "N"], {
	error: () => ({ message: "regua_cobranca_wpp: valores válidos são [S, N]" }),
});

export const clienteSenhaHotsiteMd5Schema = z.enum(["S", "N"], {
	error: () => ({ message: "senha_hotsite_md5: valores válidos são [S, N]" }),
});

export const clienteSexoSchema = z.enum(["F", "M", "NB", "O", "PNI"], {
	error: () => ({ message: "Sexo: valores válidos são [F, M, NB, O, PNI]" }),
});

export const clienteStatusInternetSchema = z.enum(
	["N", "A", "D", "CM", "CA", "CE", "FA"],
	{
		error: () => ({
			message: "status_internet: valores válidos são [N, A, D, CM, CA, CE, FA]",
		}),
	},
);

export const clienteStatusProspeccaoSchema = z.enum(
	["C", "S", "A", "N", "V", "P", "AB", "SV", "SP", "AC"],
	{
		error: () => ({
			message:
				"status_prospeccao: valores válidos são [C, S, A, N, V, P, AB, SV, SP, AC]",
		}),
	},
);

export const clienteStatusViabilidadeSchema = z.enum(["S", "N"], {
	error: () => ({ message: "status_viabilidade: valores válidos são [S, N]" }),
});

export const clienteTipoAssinanteSchema = z.enum(
	["1", "2", "3", "4", "5", "6"],
	{
		error: () => ({
			message: "tipo_assinante: valores válidos são [1, 2, 3, 4, 5, 6]",
		}),
	},
);

export const clienteTipoClienteScmSchema = z.enum(
	[
		"01",
		"02",
		"03",
		"04",
		"05",
		"06",
		"07",
		"08",
		"99",
		"0-13",
		"0-15",
		"0-23",
		"0-47",
		"R-99-PN",
	],
	{
		error: () => ({
			message:
				"tipo_cliente_scm: valores válidos são [01, 02, 03, 04, 05, 06, 07, 08, 99, 0-13, 0-15, 0-23, 0-47, R-99-PN]",
		}),
	},
);

export const clienteTipoEnteGovernamentalSchema = z.enum(["1", "2", "3", "4"], {
	error: () => ({
		message: "tipo_ente_governamental: valores válidos são [1, 2, 3, 4]",
	}),
});

export const clienteTipoLocalidadeSchema = z.enum(["R", "U"], {
	error: () => ({ message: "tipo_localidade: valores válidos são [R, U]" }),
});

export const clienteTipoPessoaSchema = z.enum(["J", "F", "E", "1", "2", "3"], {
	error: () => ({
		message: "tipo_pessoa: valores válidos são [J, F, E, 1, 2, 3]",
	}),
});

export const clienteTipoPessoaTitularContaSchema = z.enum(["F", "J"], {
	error: () => ({
		message: "tipo_pessoa_titular_conta: valores válidos são [F, J]",
	}),
});

export const clienteTipoRedeSchema = z.enum(["P", "N", "A"], {
	error: () => ({ message: "tipo_rede: valores válidos são [P, N, A]" }),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type ClienteAlterarSenhaPrimeiroAcesso = z.infer<
	typeof clienteAlterarSenhaPrimeiroAcessoSchema
>;

export type ClienteAntigoAcessoCentral = z.infer<
	typeof clienteAntigoAcessoCentralSchema
>;

export type ClienteAtivo = z.infer<typeof clienteAtivoSchema>;

export type ClienteAtualizarCadastroGalaxpay = z.infer<
	typeof clienteAtualizarCadastroGalaxpaySchema
>;

export type ClienteAvisoAtraso = z.infer<typeof clienteAvisoAtrasoSchema>;

export type ClienteBloqueioAutomatico = z.infer<
	typeof clienteBloqueioAutomaticoSchema
>;

export type ClienteCadastradoNoGalaxpay = z.infer<
	typeof clienteCadastradoNoGalaxpaySchema
>;

export type ClienteCadastradoViaViabilidade = z.infer<
	typeof clienteCadastradoViaViabilidadeSchema
>;

export type ClienteCliDescontaIssRetidoTotal = z.infer<
	typeof clienteCliDescontaIssRetidoTotalSchema
>;

export type ClienteCobEnviaEmail = z.infer<typeof clienteCobEnviaEmailSchema>;

export type ClienteCobEnviaSms = z.infer<typeof clienteCobEnviaSmsSchema>;

export type ClienteCofinsRetem = z.infer<typeof clienteCofinsRetemSchema>;

export type ClienteContribuinteIcms = z.infer<
	typeof clienteContribuinteIcmsSchema
>;

export type ClienteConvertClienteForn = z.infer<
	typeof clienteConvertClienteFornSchema
>;

export type ClienteCrm = z.infer<typeof clienteCrmSchema>;

export type ClienteCsllRetem = z.infer<typeof clienteCsllRetemSchema>;

export type ClienteDescontoIrrfValorInferior = z.infer<
	typeof clienteDescontoIrrfValorInferiorSchema
>;

export type ClienteEstadoCivil = z.infer<typeof clienteEstadoCivilSchema>;

export type ClienteFiltraFilial = z.infer<typeof clienteFiltraFilialSchema>;

export type ClienteGrauSatisfacao = z.infer<typeof clienteGrauSatisfacaoSchema>;

export type ClienteInssRetem = z.infer<typeof clienteInssRetemSchema>;

export type ClienteIrrfRetem = z.infer<typeof clienteIrrfRetemSchema>;

export type ClienteMelhorPeriodoReservaAutoViab = z.infer<
	typeof clienteMelhorPeriodoReservaAutoViabSchema
>;

export type ClienteMoradia = z.infer<typeof clienteMoradiaSchema>;

export type ClienteOrgaoPublico = z.infer<typeof clienteOrgaoPublicoSchema>;

export type ClienteParticipaCobranca = z.infer<
	typeof clienteParticipaCobrancaSchema
>;

export type ClienteParticipaPreCobranca = z.infer<
	typeof clienteParticipaPreCobrancaSchema
>;

export type ClientePermiteArmazenarCartoes = z.infer<
	typeof clientePermiteArmazenarCartoesSchema
>;

export type ClientePisRetem = z.infer<typeof clientePisRetemSchema>;

export type ClienteRedeAtivacao = z.infer<typeof clienteRedeAtivacaoSchema>;

export type ClienteRegimeFiscalCol = z.infer<
	typeof clienteRegimeFiscalColSchema
>;

export type ClienteReguaCobrancaConsidera = z.infer<
	typeof clienteReguaCobrancaConsideraSchema
>;

export type ClienteReguaCobrancaNotificacao = z.infer<
	typeof clienteReguaCobrancaNotificacaoSchema
>;

export type ClienteReguaCobrancaWpp = z.infer<
	typeof clienteReguaCobrancaWppSchema
>;

export type ClienteSenhaHotsiteMd5 = z.infer<
	typeof clienteSenhaHotsiteMd5Schema
>;

export type ClienteSexo = z.infer<typeof clienteSexoSchema>;

export type ClienteStatusInternet = z.infer<typeof clienteStatusInternetSchema>;

export type ClienteStatusProspeccao = z.infer<
	typeof clienteStatusProspeccaoSchema
>;

export type ClienteStatusViabilidade = z.infer<
	typeof clienteStatusViabilidadeSchema
>;

export type ClienteTipoAssinante = z.infer<typeof clienteTipoAssinanteSchema>;

export type ClienteTipoClienteScm = z.infer<typeof clienteTipoClienteScmSchema>;

export type ClienteTipoEnteGovernamental = z.infer<
	typeof clienteTipoEnteGovernamentalSchema
>;

export type ClienteTipoLocalidade = z.infer<typeof clienteTipoLocalidadeSchema>;

export type ClienteTipoPessoa = z.infer<typeof clienteTipoPessoaSchema>;

export type ClienteTipoPessoaTitularConta = z.infer<
	typeof clienteTipoPessoaTitularContaSchema
>;

export type ClienteTipoRede = z.infer<typeof clienteTipoRedeSchema>;
