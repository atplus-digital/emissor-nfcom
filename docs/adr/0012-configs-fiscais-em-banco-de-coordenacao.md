---
status: accepted
date: 2026-08-25
builds-on: [ADR-0003, ADR-0004, ADR-0009]
superseded-by: null
deciders: [gugacarbo]
---

# Configs fiscais (cClass/CFOP/ICMS) em banco de coordenação + natureza por cliente

## Contexto e problema

A emissão NFCom não autoriza ponta-a-ponta porque o app injeta **defaults fiscais
inválidos** no payload de emissão (issue #3). Hoje `DefaultsFiscais`
(`{cfop, cclass, aliqIcms}`) vem de **variáveis de ambiente** (`FISCAL_CFOP_DEFAULT`,
`FISCAL_CCLASS_DEFAULT`, `FISCAL_ICMS_ALIQUOTA`) e é aplicado **uniformemente a todos
os itens** — sem distinguir UF emitente × UF destinatário, nem a natureza do
destinatário, nem o tipo de serviço do plano. Resultado:

- `cClass` é `0000` (ou um único default) em vez de 7 dígitos da tabela NFCom por
  **tipo de serviço** (telefonia `0100101`, dados `0100201`, TV `0100301`...).
- `CFOP` é `6307` fixo — deveria ser 5.x (intraestadual) ou 6.x (interestadual)
  conforme a comparação de UF, e dentro de cada série, o subcódigo (`5307`/`6307`)
  depende da **natureza do destinatário** (contribuinte/industrial/comercial/
  transporte/energia/produtor rural/não contribuinte).
- `IE` (`rgie`) do destinatário isento usa um fallback único de env
  (`FISCAL_IE_ISENTO`), sem relação com a natureza do destinatário.

A natureza do destinatário **não existe** hoje no modelo de domínio nem no CRM
(`t_clientes` não tem `f_natureza`). E a regra intra/interestadual não está
implementada — `plano-cobrancas.ts` repassa a `uf` do destinatário mas nunca a
compara com a UF do emitente (parceiro).

Este ADR formaliza a arquitetura para armazenar configs fiscais em banco,
selecioná-las por item, e tratar a natureza do destinatário — refine da triagem
da issue #3.

## Direcionadores da decisão

- **Sem fallback silencioso**: config fiscal ausente deve falhar cedo (422), não
  emitir com default inválido que só será rejeitado pela SEFAZ opacamente
  (consistente com `SEM_CLIENTES`/`SOMA_DIVERGENTE`, SPEC-0002).
- **Domínio puro**: a seleção de `cfop`/`cclass`/`aliqIcms` por item é uma função
  pura de domínio — não lê DB nem env (ADR-0004). O caller carrega configs e injeta.
- **UF emitente já disponível**: `parceiro.endereco.uf` (emitente) já está no
  modelo; `nota.uf` (destinatário) também. A regra intra/inter é computada em
  runtime, não cadastrada.
- **cClass descreve o serviço, não o destinatário**: a tabela NFCom `cclass.txt`
  discrimina códigos por **tipo de serviço** — telefonia, dados, TV, serviço
  medido, serviços combinados (`0450101`), etc. Logo o cClass se amarra ao
  **plano** (tipo de serviço faturado), não à natureza/UF.
- **Editável operacionalmente**: o(a) contador(a) precisa classificar clientes e
  amarrar planos→cClass sem deploy. Exige CRUD + UI.

## Decisão

### 1. Configs fiscais como tabelas de referência no SQLite de coordenação

Quatro tabelas novas em `packages/db/src/schema.ts` (migration `0001`, gerada por
`drizzle-kit generate`, ADR-0009), **editáveis via painel**:

- **`config_cfop(natureza, escopo)` → `cfop`**: CFOP por `(natureza do destinatário,
"intra"|"interestadual")`. A regra intra/inter é computada em runtime comparando
  UF emitente × UF destinatário; a tabela só guarda o código resultante por natureza
  e escopo (não cadastra par-a-par por UF).
- **`config_cclass(plano_id)` → `cclass`**: cClass por **plano** (FK lógica para
  `t_planos_de_servico` no CRM Atacado; sem FK física — o plano vive em outro store).
  Confere com a tabela NFCom: cada plano é um tipo de serviço → um cClass. Plano que
  agrega serviços combinados → `0450101` (serviços combinados), um único código por
  plano — não há múltiplos cClass por item.
- **`config_icms(escopo)` → `aliq_icms`**: alíquota por escopo (intra/inter podem
  divergir; substitui a `FISCAL_ICMS_ALIQUOTA` única).
- **`classificacao_cliente(cliente_id)` → `natureza`**: natureza do destinatário
  classificada por cliente (FK lógica para `t_clientes`). Campo **não existe no CRM**
  hoje.

**Separação config × classificação**: `config_cfop`/`config_cclass`/`config_icms`
são tabelas fiscais de referência (normativas, estáticas) — config de coordenação
legítima, sem tensão com ADR-0003. `classificacao_cliente` carrega um atributo do
cliente (ver §4 abaixo sobre a tensão com o princípio de domínio).

### 2. `ieIsento` por natureza, não por cliente (refino do plano)

O `ieIsento` (antigo `FISCAL_IE_ISENTO`) mora em uma config por **natureza**
(`config_natureza(natureza)` → `ie_isento`), **não** por cliente. Motivo: a regra
de IE isento é determinada pela natureza do destinatário (todo "não contribuinte"
segue a mesma regra), não varia por cliente individual; replicar por cliente é
redundante e propenso a inconsistência. `classificacao_cliente` guarda **só** a
natureza; o `ieIsento` é resolvido lookup à `config_natureza`.

### 3. Cliente não classificado → 422 (proibir, não assumir default)

Cliente sem `classificacao_cliente` → erro `FALTA_CLASSIFICACAO` (422 fail-fast),
**não** assume `nao_contribuinte`. Consistente com o princípio de não-fallback
silencioso: assumir uma natureza default mascararia configs fiscais erradas
(o mesmo motivo que rejeita cClass/CFOP default implícito).

### 4. Natureza do destinatário é dado de domínio — débito técnico no SQLite

A natureza do destinatário (contribuinte/industrial/...) caracteriza o
destinatário — é **dado de domínio**, não metadado de coordenação de emissão.
O lugar canônico (alinhado a ADR-0003/0004) seria `f_natureza` em `t_clientes` no
CRM Atacado, lido pelo translator `cliente.ts` como já faz com IE/endereço.

**Exceção pragmática**: cadastrar `f_natureza` no NocoBase tem custo operacional
maior (schema do CRM); por isso a `classificacao_cliente` vive no SQLite de
coordenação **como débito técnico explícito**. Quando o CRM suportar `f_natureza`,
a classificação migra para lá (supersede futuro deste ADR). O tipo de domínio
`NaturezaDestinatario` (union literal) vive em `domain/types.ts` desde já.

### 5. `selecionarFiscal` — função pura de domínio por item

Nova função pura em `defaults-fiscais.ts` (refatorado):

```
selecionarFiscal({ ufEmitente, ufDestinatario, natureza, planoId, configs })
  → { cfop, cclass, aliqIcms } | ErroValidacao
```

- `escopo = ufEmitente === ufDestinatario ? "intra" : "interestadual"`.
- `cfop` = lookup `config_cfop` por `(natureza, escopo)`.
- `cclass` = lookup `config_cclass` por `planoId`.
- `aliqIcms` = lookup `config_icms` por `escopo` (default 0).
- Config ausente → erro `FALTA_CONFIG_FISCAL` (422), não fallback.

**Não lê DB nem env** — o caller carrega configs e injeta. O preparar (camada de
aplicação) torna-se **async**: carrega configs do DB de coordenação + classificações
de clientes **antes** do cálculo; `calcularFatura`/`construirPlanoCobrancas`
permanecem **síncronos e puros**, recebendo `ufEmitente` + `configs` +
`classificacoes: Map<clienteId, NaturezaDestinatario>` em vez de `defaultsFiscais`.

### 6. `rgie` resolvido na preparação, não no translator

A IE do destinatário (IE numérica normalizada, ou `ieIsento` da `config_natureza`
quando isento) é **resolvida e materializada no `rgie` da nota durante o cálculo**
(`notaParaCliente`/`notaParaParceiro`), persistida como `f_rgie`. O worker de
emissão lê a nota do CRM (já com `f_rgie`) e a repassa em
`EmitirNFComInput.destinatario.rgie`. O translator `montarPayloadEmitir` passa a
aplicar **só** `normalizarIE(destinatario.rgie)` — **remove** `opts.ieIsento`,
`OptsMontarPayloadEmitir.ieIsento` e `CriarNfcomRepositoryOptions.ieIsento`.

### 7. Remoção total das envs `FISCAL_*`

Remover `FISCAL_CFOP_DEFAULT`, `FISCAL_CCLASS_DEFAULT`, `FISCAL_ICMS_ALIQUOTA` e
`FISCAL_IE_ISENTO` de `env.ts`/`.env.example`, e `DEFAULTS_FISCAIS_PADRAO` de
`defaults-fiscais.ts`. Grade de busca confirma que nenhuma leitura adicional
existe fora do mapeado (src, index.ts, server.ts, preparar.handler, faturas.route,
painel-data.route, emitir.ts, nfcom.repository, e os testes que as setam via
`process.env` em boot — estes serão ajustados para semear configs no DB em vez de
env). Scripts de tooling (`generate:types`) validam subconjuntos próprios do `.env`
sem `FISCAL_*` — não afetados.

## Consequências

**Positivas:**

- Emissão intra/inter autorizada com CFOP 5.x/6.x por natureza; cClass 7 dígitos
  por plano; IE tratada por natureza.
- Configs editáveis pelo painel sem deploy; contador classifica sem mexer em env.
- Fail-fast explícito (422) em vez de rejeição SEFAZ opaca — a emissão já falha hoje
  de qualquer forma; falhar cedo com mensagem clara é estritamente melhor.
- Domínio permanece puro: `selecionarFiscal` é função pura testável; DB/env não
  cruzam o domínio.

**Negativas:**

- **FKs lógicas sem integridade referencial**: `config_cclass.plano_id` e
  `classificacao_cliente.cliente_id` referenciam `t_*` no CRM, outro store. Plano
  excluído/renomeado no CRM → config órfã (stale). Mitigação: o preparar já
  carrega `planos` (`buscarPlanosDeServico`) e filtra linhas de plano inexistente
  antes da resolução de cClass — stale não chega a quebrar a emissão, só apodrece
  silenciosamente; o painel de cClass lista planos ativos do CRM e sinaliza
  config faltante. Mesmo padrão já usado pelo `planoById` Map em `calculo.ts`.
- **Débito técnico**: `classificacao_cliente` no SQLite em vez do CRM (§4).
- **Tabelas vazias pós-deploy quebram emissão até cadastro** (ver §Rollout).

**Obrigatório a partir de agora:**

- Nenhum default fiscal vem de env — tudo do DB de coordenação.
- Nenhum item é emitido sem cClass por plano + CFOP por (natureza, escopo) +
  classificação do cliente — ausência = 422.
- `montarPayloadEmitir` não recebe mais `ieIsento` — o `rgie` já vem resolvido na
  nota.

## Alternativas consideradas

- **Config por env (status quo)**: rejeitado — default único não distingue UF/
  natureza/serviço, causa a rejeição atual; não é editável sem deploy.
- **Par-a-par por UF emitente (cadastrar RS→SP, RS→RJ...)**: rejeitado — a regra
  intra/inter é computável em runtime pela comparação de UF; cadastrar pares é
  redundante e explosão combinatória.
- **`ieIsento` por cliente (plano original)**: rejeitado em favor de por natureza
  — IE isento é função da natureza, não do cliente; por natureza é DRY e evita
  inconsistência.
- **Assumir `nao_contribuinte` para não classificado**: rejeitado — fallback
  silencioso, inconsistente com o fail-fast do resto.
- **Natureza no CRM (`f_natureza`)**: ideal mas adiado (custo operacional do
  schema do CRM); SQLite como exceção pragmática com débito explícito.

## Rollout

A migration `0001` é aditiva (`drizzle-kit migrate` no boot, idempotente): cria
tabelas + seed de CFOPs (5301..5307 intra, 6301..6307 inter) e ICMS=0.
`config_cclass`, `config_natureza` e `classificacao_cliente` nascem **vazias** —
logo, pós-deploy, toda emissão falha 422 (`FALTA_CONFIG_FISCAL` /
`FALTA_CLASSIFICACAO`) até o cadastro via painel. Como a emissão já está quebrada
hoje (rejeição SEFAZ por cClass inválido), o 422 local é melhoria, não regressão.

Sequência recomendada: (1) deploy com painel já funcional (rotas + UI no mesmo
PR); (2) pré-popular cClass dos planos ativos conhecidos + classificar clientes
em lote (listar por parceiro → classificar); (3) reabrir emissão. Não há feature
flag — o caminho de fallback seria reintroduzir o default inválido, o contrário
do objetivo. Em homologação, classificar antes de qualquer POST `/emitir`.

## Confirmação

```bash
# Sem env FISCAL_* no schema de env.
grep -rn "FISCAL_CFOP\|FISCAL_CCLASS\|FISCAL_ICMS\|FISCAL_IE_ISENTO" apps/backend/src/env.ts apps/backend/.env.example .env.example 2>/dev/null && exit 1 || true
# selecionarFiscal é pura: não importa db/env.
grep -rn "from.*@emissor/db\|from.*#/env\|process.env" apps/backend/src/domain/fatura/defaults-fiscais.ts && exit 1 || true
# O translator não recebe mais ieIsento.
grep -rn "ieIsento" apps/backend/src/modules/nfcom/ && exit 1 || true
# Tabelas de config no schema.
grep -q "configCfop\|configCclass\|configIcms\|classificacaoCliente" packages/db/src/schema.ts || exit 1
```

## Notas

- A separação entre config de referência (CFOP/cClass/ICMS — normativa) e
  classificação (atributo do cliente) reflete a tensão com ADR-0003: a primeira é
  metadado de coordenação legítimo; a segunda é dado de domínio abrigado no
  SQLite como exceção. A `config_natureza.ie_isento` é config de referência (regra
  fiscal por natureza), não atributo do cliente.
- cClass por plano cobre serviços combinados: a tabela NFCom tem `0450101 -
Serviços Combinados` — um plano agregador usa este código único. Não há
  multiplicidade de cClass por item/nota.
- A migração SQLite→Postgres futura (ADR-0003) transporta estas tabelas junto,
  atrás do mesmo contrato de repositório de coordenação.
- Referência ao plano de implementação: `.claude/plans/fiscal-configs-db.md`.
