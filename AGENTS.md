# AGENTS.md

```yaml
casa-repo-id: emissor-nfcom # usado em referências cross-repo (repo:ADR-0001)
casa-tier: T1 # T0 (leve) | T1 (padrão) — STANDARD §3
casa-version: 1.8 # versão do contrato CASA adotado (promessa do repo, ADR-0010)
casa-standard-ref: 7cdb964 # versão do casa-standard de origem — o casa-init carimba
```

> Padrão: https://github.com/atplus-digital/casa-standard (STANDARD.md)
> ROUTER (CASA §4): carga sempre, teto ~150 linhas. Só alto-ROI transversal.
> Estourou o teto → conteúdo desce para docs/context/, fica o ponteiro.
> ⚠️ NÃO usar @import para colar capítulos: @import expande tudo no launch.
> Regras de um pacote específico → <subdir>/AGENTS.md (lazy nativo, nearest-wins).

## Contexto em 5 linhas

<!-- O que este sistema é, pra quem, e qual o stack principal. Máximo 5 linhas. -->
Emissor de **NFCom** (modelo 62 — comunicação/telecom). Orquestra fatura → cobrança
(Asaas) → nota (gateway `api.nfcom.com.br` → SEFAZ) de forma assíncrona (BullMQ + Redis)
com idempotência/outbox (SQLite). Stack: Bun + Hono + Drizzle + Zod 4. Interno ao AT+.

## Infra & ambientes

- Pod **single-instance** (Docker, `Dockerfile`): Hono (:3000) + workers BullMQ no
  mesmo processo. SQLite (volume `/app/data`) e Redis **não** sobem no pod — são
  dependências externas (Redis gerenciado ou container irmão).
- **Nunca** escalar para N réplicas: SQLite de coordenação não é compartilhável
  (ADR-0002/0003). Escalar = ADR futuro de migração para Postgres.
- Env validada por Zod em `src/env.ts` (`@t3-oss/env-core`, ADR-0005) — nunca
  `process.env` direto (exceção: scripts de tooling fora do app).

## Como rodar localmente

```bash
cp .env.example .env            # preencher keys (Asaas, NFCom, Atacado...)
bun install
docker run -d -p 6379:6379 redis:7   # Redis local p/ BullMQ
bunx drizzle-kit migrate         # cria/migra o SQLite de coordenação
bun run dev                     # Hono :3000 + workers (bun --watch)
```

## Como validar (DoD global do repo)

```bash
bun run typecheck        # exit 0
bun run test             # tudo verde (bun test --isolate, script canônico)
```

## Como deployar

- `docker build` → imagem `oven/bun` (build em 2 stages; bundle autocontido em
  `dist/`). O CMD roda `bunx drizzle-kit migrate` (idempotente) antes do server.
- **Obrigatório**: volume persistente em `/app/data` (SQLite de coordenação — perdê-lo
  = perder a garantia anti-duplicação de boletos/notas, ADR-0003) e `REDIS_URL`
  apontando para um Redis durável (BullMQ perde jobs em Redis volátil, ADR-0002).

## Git & PRs

<!-- Convenções; quando comitar; se há remote; se o agente abre PR sem ser pedido. -->

## Gotchas

<!-- Conhecimento NÃO-INFERÍVEL que já custou tentativas falhas. Todo gotcha
     descoberto pelo agente DEVE ser registrado aqui. -->

- `scripts/docs-check` é **Python** (`#!/usr/bin/env python3`), não bun — rodar
  `./scripts/docs-check` direto, não `bun scripts/docs-check`.
- `src/generated/` é output do gerador (`bun run generate:types`) — **nunca** editar
  à mão (ADR-0006); ajustes vivem em `scripts/nocobase/src/pipelines/generate-types/`.
- Monetário no domínio é **centavos inteiros**; o CRM entrega `number` em unidade real
  — conversão só no translator do módulo `atacado` (ADR-0004).
- Nota tem DOIS campos de status: `f_status_interno` (máquina interna) e `f_situacao`
  (espelho do gateway) — não misturar (SPEC-0001).
- `bun test --isolate` é o runner canônico (script `test`).

## Mapa de contexto

<!-- Índice dos capítulos (docs/context/), cada um com QUANDO carregar.
     Capítulo = estado atual, imperativo, atemporal. Decisão datada = ADR. -->

| Capítulo | Quando carregar |
| -------- | --------------- |
| `docs/context/CONVENTIONS.md` | ao tocar envelope de erro, autorização, acesso a dados, ou variáveis de ambiente |

## Mapa de docs

- Decisões: `docs/adr/` · Comportamento: `docs/specs/` (READMEs GERADOS — não editar)
- Validar: `scripts/docs-check` · Regenerar índices: `scripts/docs-check --emit-index`
