---
status: accepted
date: 2026-08-17
builds-on: [ADR-0003, ADR-0005]
superseded-by: null
deciders: [gugacarbo]
---

# Migrations de BD são geradas pelo drizzle-kit, nunca escritas à mão

## Contexto e problema

O estado de coordenação da emissão vive em SQLite (ADR-0003): `idempotency_keys`,
`outbox`, lease de fatura. O acesso é via Drizzle ORM (ADR-0005), cujo schema é código
TS em `src/lib/db/schema.ts` (ADR-0007). O `drizzle.config.ts` aponta `schema` para esse
arquivo e `out` para `drizzle/`, e o boot do pod roda `bunx drizzle-kit migrate`
(idempotente) antes do server (AGENTS.md).

Há duas formas de evoluir o schema de banco: (a) editar o schema TS e **gerar** a
migration com `drizzle-kit generate`, ou (b) escrever/editar o SQL da migration à mão.
O risco de (b) é o schema TS e o SQL migrado **divergirem** — o ORM tipa contra o
schema TS, mas o banco real é o que o SQL migrou; divergência gera bug silencioso (o app
acha que uma coluna/índice existe e falha em runtime, ou tipa um campo que o banco não
tem). Esse é exatamente o tipo de falha que a idempotência/outbox (ADR-0003) não pode
se dar ao luxo de ter, pois o SQLite de coordenação é a garantia anti-duplicação de
boletos/notas.

## Direcionadores da decisão

- **Fonte única de verdade**: o schema TS (`src/lib/db/schema.ts`) é a verdade; o SQL
  em `drizzle/` é **output derivado**, não fonte. Editar o output quebra a derivação.
- **Type-safety ponta-a-ponta** (ADR-0005): os tipos do Drizzle derivam do schema TS;
  se o SQL migrado diverge do schema, a tipagem mente.
- **Revisão no PR, não autorização manual**: o SQL gerado **é revisado** no PR
  (AGENTS.md) — revisar não significa reescrever; significa confirmar que a geração
  reflete a intenção do schema.
- **Reprodutibilidade**: dois devs com o mesmo schema TS geram o mesmo SQL; dois devs
  editando SQL à mão geram duas histórias incompatíveis.

## Opções consideradas

### Opção 1 — Gerar sempre, nunca editar à mão (escolhida)

Todo cambio de schema começa em `src/lib/db/schema.ts`; a migration é **sempre** gerada
por `bunx drizzle-kit generate`. Arquivos em `drizzle/*.sql` (e `drizzle/meta/`) são
**output de máquina**, tratados como build artifact versionado: commitam-se para
reprodutibilidade do boot, mas **nunca** são editados à mão. Para mudar o banco, muda-se
o schema TS e regenera.

**Prós:**

- Schema TS e banco real nunca divergem (um deriva do outro por construção).
- Tipagem do Drizzle é honesta (reflete o que o migrate aplica).
- Reprodutível: o PR mostra exatamente o SQL que vai rodar em prod.
- Revisão humana do SQL gerado no PR como **validação**, não como autorização de
  reescrita.

**Contras:**

- SQL gerado pode ser menos idiomático que SQL escrito à mão (ex.: drizzle-kit às vezes
  reescreve uma coluna via `new` em vez de `ALTER` direto em SQLite). Aceitável — a
  correção supera a elegância.
- Drizzle-kit não cobre toda migração possível (ex.: renomear coluna em SQLite é
  limitado); nesses raros casos, a saída é decompor a migração em passos que o
  drizzle-kit consiga gerar, não editar o SQL à mão.

### Opção 2 — Permitir edição manual do SQL migrado

Escrever/ajustar o SQL em `drizzle/*.sql` quando o gerado não agrada.

**Prós:**

- SQL mais idiomático quando o drizzle-kit é subótimo.

**Contras:**

- Schema TS e banco divergem — a tipagem mente, bugs silenciosos em runtime.
- Perde-se a garantia de reprodutibilidade (duas pessoas, duas histórias).
- Quebra o contrato "schema TS é a verdade" que sustenta ADR-0003/0005.

### Opção 3 — Migrations "code-first" manuais sem drizzle-kit

Escrever migrations à mão e manter o schema TS só como tipagem (sem gerar).

**Prós:**

- Controle total do SQL.

**Contras:**

- Mesma divergência da Opção 2, sem o benefício do gerador. Anula a razão de ter
  escolhido Drizzle (migrations first-class, ADR-0005).

## Decisão

**As migrations são sempre geradas pelo `drizzle-kit generate` a partir do schema TS;
nunca escritas ou editadas à mão (Opção 1).** Concretamente:

1. Para mudar o banco, edita-se `src/lib/db/schema.ts`.
2. Roda-se `bunx drizzle-kit generate` — o SQL é gerado em `drizzle/` (+ `drizzle/meta/`).
3. O SQL gerado é **revisado no PR** (confirmar que reflete a intenção), **não
   reescrito**.
4. `bunx drizzle-kit migrate` roda no boot do pod (idempotente) e aplica o estado
   versionado em `drizzle/`.
5. Arquivos em `drizzle/*.sql` e `drizzle/meta/*` são **output de máquina**: commitam-se
   (para o boot reprodutível), mas **nunca se editam à mão**. Para mudar algo, corrige-se
   o schema TS e regenera (deleta o snapshot errado + re-gera).

## Consequências

**Positivas:**

- Schema TS e banco real ficam alinhados por construção (sem divergência silenciosa).
- Tipagem Drizzle honesta — o que o ORM tipa é o que o migrate aplica.
- PRs de schema são revisáveis: o diff do SQL gerado é a prova do que vai rodar.

**Negativas:**

- Restrição de não editar SQL à mão pode parecer inibitória para migrações exóticas;
  mitigada decompondo em passos geráveis.
- Dependência do drizzle-kit para toda evolução de schema (já é o caso, ADR-0005).

**Obrigatório a partir de agora:**

- Toda mudança de schema começa em `src/lib/db/schema.ts`; a migration vem de
  `drizzle-kit generate`.
- Nenhum arquivo em `drizzle/*.sql` ou `drizzle/meta/*` é editado à mão — são output.
- O SQL gerado é revisado no PR, mas **não reescrito**; se o gerado estiver errado,
  corrige-se o schema TS e regenera.

## Confirmação

```bash
# O schema-fonte existe e o drizzle.config aponta para ele.
test -f drizzle.config.ts && grep -q "src/lib/db/schema.ts" drizzle.config.ts
# Nenhum SQL de migration é editado à mão: drizzle/ contém só saída do drizzle-kit
# (arquivos .sql + meta/_journal.json + snapshots). Não há contrato automatizável que
# distinga "editado à mão" de "gerado" — esta regra é de processo (revisão no PR), não
# de arquivo. O journal do drizzle-kit é a fonte da verdade do que foi gerado.
test -f drizzle/meta/_journal.json
```

## Notas

- Snapshot de migração errada: se o `drizzle-kit generate` produzir algo incorreto
  (antes de commit), deleta-se o arquivo `.sql` e o snapshot em `drizzle/meta/`, corrige-se
  o schema TS e re-gera. Depois de commitada/aplicada em prod, uma migration **não se
  edita** — cria-se uma nova migration (gerada) que a corrija, como qualquer schema migration.
- Esta ADR formaliza a prática já descrita no AGENTS.md ("migrations Drizzle:
  `bunx drizzle-kit generate` ao mudar `src/lib/db/schema.ts`; o SQL gerado é revisado
  no PR") como decisão arquitetural, elevando o "não editar à mão" de hábito a regra.
- `drizzle/meta/_journal.json` hoje tem `entries: []` (sem migrations, ADR-0003 ainda
  pré-implementação); o primeiro `generate` a partir do `schema.ts` inicial criará a
  migration `0000`.
