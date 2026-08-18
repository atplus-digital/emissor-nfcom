---
status: accepted
date: 2026-08-18
builds-on: [ADR-0006, ADR-0004]
superseded-by: null
deciders: [gugacarbo]
---

# Regra do ADR-0006 supersedida para tipos de translators: shapes hand-written são exceção documentada

## Contexto e problema

O ADR-0006 manda que os tipos base do CRM/Atacado/IXC sejam **sempre** gerados por
`bun run generate:types` para `src/generated/types/` e consumidos pelos translators
como única fonte. Na prática, porém, os translators (`src/modules/atacado/translators/*`
e `src/modules/nfcom/translators/emitir.ts`) re-declaram manualmente os shapes `f_*`
que consomem (`ClienteExterno`, `FaturaExterna`, `CobrancaExterna`, `NotaExterna`,
`ParceiroExterno`, `ItemExterno`, `LinhaFixaExterna`) e os shapes do gateway NFCom
(`ApiNFComEmitir`, `ItemGateway`, `NFComResposta`). Nenhum arquivo de `src/` importa
`src/generated/` — o output do gerador é código morto, e a checagem de confirmação do
ADR-0006 passa vacuamente.

Ao investigar a viabilidade de conectar os translators aos tipos gerados, descobriu-se
que a refatoração não é segura nem redutora de drift:

- **Incompatibilidade estrutural (append profundo).** Os gerados modelam relações como
  *base schemas planos*: `clientesSchema.f_linhas_fixas` é `linhas_fixasBaseSchema.array()`
  **sem** `f_planos_de_servico`; `nfcom_faturasSchema.f_cobrancas` é
  `nfcom_cobrancasBaseSchema.array()` **sem** `f_notas_fiscais`/`f_nota_itens`. Os
  translators, porém, consomem shapes **deep-appended** — o repositório pede
  `f_linhas_fixas.f_planos_de_servico` e `f_cobrancas.f_notas_fiscais.f_nota_itens`.
  Triangular os gerados para esse formato exigiria re-declarar os mesmos picks
  aninhados à mão — a mesma fricção de hoje, com cerimônia adicional (`Omit`/`Pick`
  compostos) e sem ganho de verdade única real.
- **Quebra de testes sem ganho de tipo.** Os tipos gerados são 100% obrigatórios, mas
  os testes dos translators passam literais parciais; aliasar (ex.:
  `type ClienteExterno = Clientes`) forçaria casts `as` (anulando a type-safety) ou
  reescrita de todos os testes.
- **Gerador não-determinístico e driftante.** A primeira execução do
  `generate:types` neste repo crashou (`_toBaseSchemaName is not defined` — bug pré-existente)
  e a regeneração produz drift em relação ao output commitado (ex.: `f_anexos_servicosBaseSchema`
  renomeado para `anexos_servicosBaseSchema`). Ou seja, a própria checagem canônica do
  ADR-0006 (`generate:types && git diff --exit-code src/generated/`) já não está limpa.

O achado confirma que os **tipos base de tabela** devem continuar sendo gerados (ADR-0006
segue valendo para `src/generated/`), mas que os **shapes finos de fronteira que os
translators consomem** não são bem servidos pelo gerador neste momento.

## Direcionadores da decisão

- **Não forçar refatoração arriscada**: conectar os translators aos gerados hoje
  quebraria testes e adicionaria `Omit`/`Pick`/casts sem reduzir drift real.
- **Verdade única onde ela paga**: `src/generated/` continua sendo output do gerador —
  ninguém edita à mão lá; a checagem de drift via `generate:types` + `git diff` é a
  mitigação ativa.
- **Fronteira ADR-0004 preservada**: os shapes de translator continuam como cópia fina
  e explícita do que a integração realmente lê/escreve, localizados dentro de
  `modules/<integração>/translators/`.
- **Decisão registrada, não silenciosa**: em vez de deixar a exceção implícita (o estado
  atual), registrá-la num ADR que supersede o 0006 para este caso.

## Opções consideradas

### Opção 1 — Refatorar translators para importar dos gerados (cumprir ADR-0006 à risca)

Aliase cada `*Externo` ao type gerado (`type ClienteExterno = Clientes`, etc.) e derive
os shapes de itens/relações via `Omit`/`Pick`/`Intersection`.

**Prós:**
- Cumpre a letra do ADR-0006; zero re-declaração top-level.

**Contras:**
- Os gerados não cobrem os picks aninhados que os translators usam — a "derivação"
  ainda seria mão na massa e frágil.
- Tipos gerados all-required quebram os testes (literais parciais) → casts ou reescrita.
- O gerador está driftante/não-determinístico; amarrar a fronteira a ele hoje acoplaria
  os translators a um output que não está estável.
- **Risco alto de quebrar tradução e testes — descartada.**

### Opção 2 — Novo ADR que supersede o 0006 para shapes de translators (exceção documentada)

Manter os translators hand-written como exceção explícita, registrando o porquê e
definindo a checagem de drift como mitigação.

**Prós:**
- Translators continuam finos e legíveis; a verdade do que a integração lê fica explícita.
- Sem risco de quebrar tradução/testes.
- O estado atual (que já é este) deixa de ser vacuidade e vira decisão registrada.
- `src/generated/` segue gerado; a checagem de drift passa a ser feita de verdade (e já
  revelou drift pré-existente).

**Contras:**
- Top-level `ClienteExterno` etc. continuam duplicados à mão; a proteção contra drift de
  campo depende de revisão + checagem de regeneração.

## Decisão

**Opção 2.** O ADR-0006 permanece válido para `src/generated/` como única fonte, mas é
**supersedido** quanto à exigência de que os types base do CRM sejam consumidos nos
translators: os shapes de fronteira dos translators (`ClienteExterno`, `FaturaExterna`,
`CobrancaExterna`, `NotaExterna`, `ParceiroExterno`, `ItemExterno`, `LinhaFixaExterna`,
`ApiNFComEmitir`, `ItemGateway`, `NFComResposta`) são **exceção documentada** e seguem
hand-written, isolados em `modules/<integração>/translators/` (ADR-0004).

Racional: os tipos gerados não modelam o append profundo consumido pelos translators, a
derivação forçaria cerimônia sem reduzir drift, os testes quebrariam, e o gerador está
atualmente driftante/não-determinístico. Conectar a fronteira a ele agora seria acoplar a
um output instável. A retomada da geração como fonte para os translators (volta à letra
do 0006) é decisão futura, atrelada à estabilização do gerador (ex.: suporte a append
profundo / overlays), documentada na seção Notas.

## Consequências

**Positivas:**
- Translators finos e explícitos; sem risco de quebra.
- `src/generated/` segue sendo output — ninguém edita à mão lá (ADR-0006 segue proibitivo
  nesse ponto).
- A checagem de drift (`generate:types` + `git diff`) passa a ser a guarda ativa e já
  expôs drift pré-existente.

**Negativas:**
- Formas `*Externo` continuam duplicadas à mão; drift de campo longo a longo depende de
  revisão e da checagem de regeneração.
- Um campo que a integração lê mas o schema não descreve não é pego automaticamente.

**Obrigatório a partir de agora:**
- `src/generated/` continua gerado exclusivamente por `bun run generate:types`; nunca
  editado à mão (ADR-0006 — inalterado neste ponto).
- Rodar `bun run generate:types` e conferir `git diff --exit-code src/generated/` ao
  tocar o gerador ou o schema do CRM; qualquer drift é resolvido no gerador, não no output.
- Shapes `*Externo`/`*Gateway` de translators: hand-written, confinados a
  `modules/<integração>/translators/` (ADR-0004) — não saem para `src/domain`,
  `src/workers`, `src/http` etc.

## Confirmação

```bash
# src/generated é output: regenerar e checar drift (mitigação ativa do ADR-0006):
bun run generate:types && git diff --exit-code src/generated/
# Formas externas de translator não escapam dos translators (ADR-0004):
grep -rn "src/generated\|generated/types" src/ --include='*.ts' \
  | grep -v "src/modules/" | grep -v ".test." && exit 1 || true
```

## Notas

- **Como reverter a exceção (futuro):** quando o gerador suportar append profundo ou
  overlays formalizados para os picks que os translators consomem, e a regeneração for
  determinística e limpa (`git diff --exit-code`), retomar a letra do ADR-0006 — novo ADR
  que supersede este.
- **Bug pré-existente registrado:** a primeira execução do `generate:types` nesta
  investigação crashou com `_toBaseSchemaName is not defined`; a execução seguinte
  passou. O gerador precisa de determinismo/estabilidade antes de virar fonte dos
  translators.
- **Drift pré-existente registrado:** a regeneração renomeia `f_anexos_servicosBaseSchema`
  → `anexos_servicosBaseSchema` em relação ao commitado — corrigir no gerador (ou commitar
  a regeneração), não no output.
