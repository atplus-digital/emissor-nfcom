---
status: superseded
date: 2026-08-14
builds-on: [ADR-0004]
superseded-by: ADR-0010
deciders: [gugacarbo]
---

> ⚠️ VERDADE ATUAL: `src/generated/` segue sendo output do gerador (`bun run
> generate:types`), nunca editado à mão (intacto). Supersedido por ADR-0010 em
> 2026-08-18 quanto aos **shapes de translators** (`*Externo`/`*Gateway`): ficam
> hand-written, confinados a `modules/<integração>/translators/` (ADR-0004).

# Tipos de CRM/Atacado/IXC sempre gerados por script, nunca escritos à mão

## Contexto e problema

O app consome o CRM Atacado (NocoBase) — e, no futuro, o IXC — como fonte de domínio
externa. Esses CRMs expõem centenas de tabelas com convenções hostis ao domínio:
campos com nome de hash (`f_c8flsp9105w`), monetários como string com vírgula,
CPF/CNPJ mascarado, FKs duplicadas em creates aninhados. Já existe um script
(`scripts/nocobase/`, comando `bun run generate:types`) que lê os schemas das
coleções e gera as interfaces base de cada tabela em `src/generated/types/`.

O problema: nada impede um dev de "consertar" ou estender uma interface gerada à
mão em `src/generated/` — adicionar um campo que falta, ajustar um tipo, corrigir um
nome. Na próxima execução do `generate:types` (ou de um CI de regeneração), a edição
manual é silenciosamente **destruída**, e o "conserto" vira um bug intermitente que
só aparece quando alguém roda o script. Ou pior: ninguém roda o script, e os tipos
driftam dos schemas reais do CRM — o app valida contra um contrato que não existe
mais, e a tipagem forte vira falsa segurança.

A fronteira do ADR-0004 diz que tipos externos só vivem dentro dos translators. Mas
ela não responde: **como esses tipos externos nascem e se mantêm?** Esta decisão
fecha isso.

## Direcionadores da decisão

- **Verdade única**: o schema do CRM é a única fonte; tipos hand-written inevitavelmente
  driftam dele (campos renomeados, adicionados, tipagem errada).
- **Regenerabilidade**: rodar `generate:types` a qualquer momento deve ser uma operação
  segura e idempotente — nunca um evento destrutivo.
- **Type-safety real**: os tipos que os translators consomem precisam refletir o
  contrato real do provedor, não uma cópia envelhecida.
- **Baixa fricção**: a geração deve ser parte do workflow normal (setup, após mudança
  de schema no CRM), não um evento especial.

## Opções consideradas

### Opção 1 — Geração por script como única fonte (`src/generated` é output)

Todo tipo base de tabela do CRM vive em `src/generated/types/`, gerado exclusivamente
por `bun run generate:types`. Edição manual é proibida.

**Prós:**

- Zero drift: os tipos sempre refletem o schema real do CRM no momento da geração.
- Regeneração é segura e idempotente; nunca destrói trabalho (não há trabalho manual
  a destruir).
- O script pode evoluir (normalização de nomes, tipagem mais rica) e todos os tipos
  se beneficiam de uma vez.

**Contras:**

- Se o schema do CRM não descreve algo (ex.: um campo opcional na prática), o tipo
  gerado pode ficar impreciso — a correção precisa acontecer **no script** (ou num
  overlay), não no arquivo gerado.
- Dependência de rodar o script quando o CRM muda (mitigável por CI/regeneração
  periódica).

### Opção 2 — Tipos escritos à mão (sem geração)

Interfaces hand-written para as tabelas consumidas, mantidas manualmente.

**Prós:**

- Controle total da forma do tipo; sem dependência do script.

**Contras:**

- Drift silencioso: CRM renomeia `f_nome_razao` → `f_razao_social` e ninguém percebe
  até o `undefined` em produção (exatamente o "mal feito" que o ADR-0004 cita).
- Custo manual proporcional ao número de tabelas (o Atacado tem centenas).

### Opção 3 — Misto (gerado como base + edições manuais por cima)

Gerar a base, mas permitir ajustes manuais pontuais nos arquivos gerados.

**Prós:**

- Flexibilidade para casos onde o schema não dá conta.

**Contras:**

- É o pior dos dois mundos: a edição manual é destruída na próxima geração (bug
  intermitente) ou o script para de ser rodado para "preservar" as edições (drift
  total). Sem uma camada de overlay formalizada, insustentável.

## Decisão

**Geração por script como única fonte (Opção 1).** As interfaces base de tabelas do
CRM/Atacado/IXC são **sempre** geradas por `bun run generate:types` para
`src/generated/types/`, e **nunca** editadas manualmente. `src/generated/` é output
de build, não fonte de trabalho.

Ajustes à forma dos tipos (tipagem mais precisa, renomeação, campos de praxe) são
feitos **no gerador** (`scripts/nocobase/src/pipelines/generate-types/`) — nunca nos
arquivos gerados. Ajustes de **domínio** (tradução para tipos próprios) seguem na
fronteira ADR-0004: os tipos gerados são consumidos apenas dentro de
`modules/<integração>/translators/` e traduzidos para tipos de domínio; o resto do
app nunca os importa.

## Consequências

**Positivas:**

- `bun run generate:types` vira operação segura e idempotente — parte do workflow
  normal (setup, pós-mudança de schema no CRM), não evento destrutivo.
- Zero drift entre tipos e schema real do CRM; tipagem forte de verdade.
- Evolução do gerador benéfica a todas as tabelas de uma vez.

**Negativas:**

- Imprecisões do schema do CRM refletem nos tipos; corrigir exige mexer no gerador
  (ou introduzir overlay — decisão futura se o caso aparecer).
- Quando o CRM muda de schema, é preciso rodar o script para sincronizar (checagem
  de drift em CI é a mitigação natural, fora do escopo desta decisão).

**Obrigatório a partir de agora:**

- Nenhuma interface base de tabela do CRM/Atacado/IXC em `src/generated/` é escrita
  ou alterada à mão — só o gerador escreve lá.
- Toda mudança na forma dos tipos gerados acontece no gerador
  (`scripts/nocobase/src/pipelines/generate-types/`), nunca no output.
- Tipos gerados são consumidos apenas dentro de `modules/<integração>/translators/`
  (ADR-0004); nunca importados por `src/domain`, `src/workers`, `src/http` etc.

## Confirmação

```bash
# src/generated é tratado como output: a fonte é o gerador. Checa que nenhum
# arquivo de src/generated foi alterado em relação à última geração:
bun run generate:types && git diff --exit-code src/generated/
# Tipos gerados não saem dos translators (ADR-0004):
test -d src && (grep -rn "from.*src/generated\|from.*generated/types" src/ --include='*.ts' \
  | grep -v "src/modules/" | grep -v ".test." && exit 1 || true)
```

## Notas

- O comando é `bun run generate:types` → `bun ./scripts/nocobase/src/index.ts`
  (pipeline `generate-types` em `scripts/nocobase/src/pipelines/generate-types/`).
- Se um dia surgir a necessidade de overlay (ex.: campo do CRM que o schema não
  descreve), é ADR novo que estende este — nunca edição manual no gerado.
- Se `src/generated/` passar a ser regenerado em CI (checagem de drift), a checagem
  valida o **gerador**, não o output commitado.
