---
status: accepted
date: 2026-08-13
builds-on: [ADR-0001, ADR-0002, ADR-0003]
superseded-by: null
deciders: [gugacarbo]
---

# Stack tecnológica: Bun + Hono + Drizzle + Zod 4

## Contexto e problema

O repo já vem com uma stack de tooling escolhida (Bun como runtime, Biome, Zod 4,
Knip, husky, CASA Standard). Mas o **framework HTTP, o ORM e a biblioteca de filas** ainda
não estão definidos. Precisamos fixar as escolhas de forma consistente com (a) o que já
está no repo e (b) as decisões de arquitetura (ADR-0002 BullMQ, ADR-0003 SQLite,
ADR-0004 módulos).

## Direcionadores da decisão

- **Consistência com o repo**: o repo já é Bun + Zod 4 + Biome (testes com o runner nativo
  `bun test`). Stack do app deve
  alinhar, não introduzir runtime/framework paralelo.
- **Idiomático para Bun**: evitar frameworks pensados para Node se há equivalente nativo.
- **Type-safety first**: ORM TS-first, validação Zod 4, sem geradores opacos.
- **Simplicidade operacional**: menos dependências, menos config.

## Opções consideradas

### Framework HTTP

**Hono** (escolhido) — nativo do Bun (roda sobre `Bun.serve`), middleware leve,
type-safe, routing idiomático, tamanho pequeno. Alinhado ao runtime do repo.

- vs **Fastify 5**: maduro e rápido, mas pensado para o ecossistema Node; roda em Bun via
  adaptador, perdendo o "nativo".

**Decisão: Hono.**

### ORM / acesso a dados (SQLite, ADR-0003)

**Drizzle ORM** (escolhido) — TS-first, schema como código, migrations explícitas,
queries tipadas, sem gerador de runtime opaco (diferente do Prisma), bom suporte a
SQLite (`drizzle-orm/libsql` + `@libsql/client`).

- vs **Prisma**: mais popular, mas schema declarativo + gerador opaco + peso de runtime;
  Drizzle é mais "código que você lê".
- vs **Kysely**: query builder TS-first excelente, mas sem schema/ migrations first-class
  para SQLite; Drizzle cobre schema + migrations nativamente.

**Decisão: Drizzle ORM** sobre SQLite via driver `libsql` (`drizzle-orm/libsql` + `@libsql/client`).

### Filas (ADR-0002)

**BullMQ** sobre **Redis** (escolhido) — justificado no ADR-0002. Não há alternativa que
dê persistência + retry + rate-limit com a mesma maturidade para TS.

- vs fila em SQLite (Opção 3 do ADR-0002): rejeitado pela reimplementação de primitivas.

**Decisão: BullMQ + Redis (ioredis).**

### HTTP client

**`fetch` nativo do Bun** (escolhido) — já embutido, sem dependência de cliente HTTP. Um
wrapper leve em `src/lib/http` dá timeout (`AbortController`), retry e classificação de
erro, padronizando num único estilo o acesso HTTP do app.

**Decisão: fetch nativo + wrapper próprio** (sem axios).

### Logging

**pino** (escolhido) — estruturado, rápido, com suporte nativo a redaction de dados
sensíveis (documentos, segredos).

**Decisão: pino** (+ redação de documentos/segredos).

### Validação

**Zod 4** (escolhido) — já no repo; usado em rotas (Hono + `zod-openapi` ou validator),
schemas de env (`@t3-oss/env-core`) e contratos de domínio.

**Decisão: Zod 4.**

## Decisão

| Camada         | Escolha                                         |
| -------------- | ----------------------------------------------- |
| Runtime        | **Bun** (já no repo)                            |
| Framework HTTP | **Hono**                                        |
| ORM            | **Drizzle ORM** sobre SQLite via `libsql`              |
| Filas          | **BullMQ** + **Redis** (`ioredis`)              |
| HTTP client    | **fetch** nativo + wrapper em `src/lib/http` |
| Logging        | **pino** (com redação)                          |
| Validação      | **Zod 4**                                       |
| Testes         | **`bun test`** (nativo do runtime)              |
| Lint/format    | **Biome** (já no repo)                          |

## Consequências

**Positivas:**

- Stack coesa e idiomática para Bun; sem runtime/framework paralelo ao do repo.
- Type-safety ponta-a-ponta (Drizzle + Zod + Hono).
- Poucas dependências externas (fetch e sqlite já vêm com o runtime).

**Negativas:**

- Redis como nova dependência de infra (já aceito no ADR-0002).
- Hono é mais novo que Fastify — ecossistema menor, mas suficiente para o escopo.

**Obrigatório a partir de agora:**

- Sem `axios` no projeto — todo HTTP via fetch + wrapper.
- Acesso a SQLite exclusivamente via Drizzle (sem SQL cru espalhado).
- Env validado por Zod (`@t3-oss/env-core`), nunca `process.env` direto. Única
  exceção permitida e registrada: `process.env.NODE_ENV` no factory do logger
  (`src/lib/logger/index.ts`), usado só para alternar JSON/pretty — importar
  `src/env.ts` aí dispararia a validação completa de env em todo teste, então
  `NODE_ENV` (convenção canônica do Node, não config do app) é lida direto.

## Confirmação

```bash
# Sem axios; HTTP só via wrapper de fetch.
test -d src && (grep -rn "from \"axios\"\|from 'axios'" src/ package.json && exit 1 || true)
# SQLite acessado só via Drizzle.
grep -rln "drizzle-orm" src/lib/db/ | wc -l | grep -qv '^0$' || exit 1
# Hono como framework HTTP.
grep -rn "from \"hono\"" src/http/ | wc -l | grep -qv '^0$' || exit 1
```

## Notas

- `libsql` (via `drizzle-orm/libsql` + `@libsql/client`) é single-instance — adequado ao
  volume de um microserviço single-instance. Se virar gargalo, migra-se para outro driver
  Drizzle ou Postgres (escala, ADR-0003/ADR futuro).
- BullMQ Board (UI) pode ser exposto em modo admin para observabilidade das filas.
