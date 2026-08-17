# Plano geral de implementação — emissor-nfcom

> Estratégia: **camadas horizontais** (aprovada) + **TDD estrito** (aprovado).
> Construir toda uma camada antes da próxima; máximo paralelismo de subagents dentro de
> cada fase; integração end-to-end emerge na Fase 6 (composition root). Cada fase
> entrega `bun run typecheck` + testes da camada verdes antes de destravar a próxima.
>
> **TDD estrito (red → green → refactor) em toda sub-tarefa**: o subagent escreve
> primeiro o teste que **falha** (descreve o comportamento esperado, antes do código
> existir), depois a implementação **mínima** que faz o teste passar (verde), depois
> refactor mantendo o verde. Os **casos de borda das SPECs são testes escritos antes da
> feature correspondente**, na fase onde a feature nasce — não há "Fase 7 de casos de
> borda" pós-hoc; cada caso vira um teste red-green quando a camada que o cobre é
> implementada. `bun run test --watch` acompanha o verde contínuo.
>
> Docs de referência (contrato): ADR-0001..0009, SPEC-0001, SPEC-0002, CONVENTIONS.md.
> ADR-0007 fixa o layout; ADR-0003/0002 a semântica de idempotência/outbox/filas; ADR-0008
> o logging; ADR-0004 os limites de módulo (ACL por integração).

## Estado atual

- Scaffold mínimo: `src/env.ts` (env validada, completa), `src/index.ts` (placeholder
  `console.log`), `drizzle.config.ts` (aponta `./src/lib/db/schema.ts` que **não
  existe** ainda). Sem `src/lib/`, `src/domain/`, `src/modules/`, `src/http/`,
  `src/workers/`.
- Tipos gerados do CRM (NocoBase/IXC) já presentes em `src/generated/` — base dos
  translators do módulo `atacado` (faturas/cobranças/notas/itens/parceiros/clientes).
- `pino-pretty` ainda **não** está em devDependencies (nota ADR-0008) — Fase 1 adiciona.
- DoD global do repo: `bun run typecheck` exit 0 + `bun run test` tudo verde.

## Princípios de execução (valem para toda fase)

- **TDD estrito (red → green → refactor)**: toda sub-tarefa começa pelo teste que
  descreve o comportamento esperado (incluindo o caso de borda da SPEC que aquela
  sub-tarefa cobre), roda-o e vê **falhar** (o código ainda não existe). Depois
  implementa o **mínimo** que faz passar. Depois refactor mantendo o verde. Nenhum
  código de `src/` é escrito sem um teste vermelho correspondente.
- **Casos de borda das SPECs viram testes antes da feature**: cada caso nomeado nas
  DoDs das SPECs (SPEC-0001 casos 1-18, SPEC-0002 casos 1-14) é um teste escrito **na
  fase onde a camada que o cobre é implementada**, red → green. Não há fase posterior
  dedicada a "adicionar casos de borda" — eles são a especificação executável que guia
  a implementação, não um adendo final.
- **Sem dependência circular de camada**: `domain → ∅`, `modules → {domain/ports, lib}`,
  `http/workers → {domain, lib}`, `index → tudo`. Grep anti-import do ADR-0004/0007
  deve passar a cada fase.
- **Toda escrita externa (Asaas/NFCom) precedida pela idempotency key**; toda escrita de
  estado no Atacado via outbox. Sem `process.env` direto (só `src/env.ts`).
- **Sem `console.*` em `src/`**; sem instanciar pino fora do factory. Logger via ALS.
- **Tipos externos não cruzam a borda do módulo** (translators na fronteira).
- **Monetário no domínio = centavos inteiros**; conversão só no translator do `atacado`.
- Cada fase roda `./scripts/docs-check` se tocar docs, e `bun run typecheck`.
- **Verde contínuo**: cada commit/fim de sub-tarefa deixa `bun run test` (da camada)
  verde; nunca acumula vermelho entre fases.

---

## Fase 1 — Fundação (`src/lib/`)

**Paralelismo: 3 subagents.** Sem dependências entre si (todos só de stdlib + deps já
instaladas).

### 1a — Logger (ADR-0008)
- `src/lib/logger/index.ts`: factory pino, JSON em prod / `pino-pretty` em dev
  (`NODE_ENV !== 'production'`), redação por allowlist (CPF/CNPJ + headers
  `access_token`/`X-API-Key`/`X-Webhook-Signature`/`Authorization`), nível por `LOG_LEVEL`.
- `src/lib/logger/context.ts`: `AsyncLocalStorage` store (`faturaId`, `jobId`, `fila`,
  `metodo`, `rota`), `runWithLogContext(ctx, fn)`, `log` mescla o store.
- Adicionar `pino-pretty` a `devDependencies` (Fase 1 instala).
- Teste: `test/lib/logger.test.ts` — redação de CPF/CNPJ, mescla de contexto via ALS,
  formato dev vs prod.

### 1b — DB SQLite + schema de coordenação (ADR-0003, ADR-0009)
- `src/lib/db/schema.ts`: tabelas `idempotency_keys` (`key`, `target`, `external_id`,
  `status`, `created_at`, `updated_at`), `outbox` (`id`, `aggregate`, `aggregate_id`,
  `payload`, `status`, `attempts`, `created_at`), `fatura_lease` (`fatura_id`,
  `emitindo_since`). **Gerar migration** via `bunx drizzle-kit generate` (ADR-0009:
  nunca editar SQL à mão).
- `src/lib/db/client.ts`: drizzle `better-sqlite3`/driver sqlite do drizzle, conexão por
  `env.DATABASE_URL`.
- `src/lib/db/idempotency.ts`: helper `acquireKey(key, target)` / `resolveKey(key,
  externalId)` / `getKey(key)` — aquisição + resolução transacional.
- `src/lib/db/outbox.ts`: `enqueueOutbox(msg)` (na mesma tx do job-state),
  `drainOutbox(limit)`.
- Teste: `test/lib/db.test.ts` (schema existe, key acquire/resolve, outbox enq/drain).
- **Validação ADR-0009**: `drizzle/*.sql` e `drizzle/meta/_journal.json` gerados, não
  editados à mão; SQL revisado no PR.

### 1c — Redis + filas BullMQ (ADR-0002)
- `src/lib/redis.ts`: `ioredis` connection por `env.REDIS_URL`.
- `src/lib/queues.ts`: declara filas `emissao` (fatura/cobranca/nfcom — parent/child via
  Flows), `outbox`, `webhook`; rate-limiter por fila (`RATE_LIMIT_ASAAS/NFCOM/ATACADO`);
  factory `getQueue(name)`.
- `src/lib/queue-names.ts`: constantes de nome de fila/job.
- Teste: `test/lib/queues.test.ts` (filas declaradas, rate-limit config).

**Saída da Fase 1:** `bun run typecheck` verde; `bun run test` (testes de lib) verdes;
`./scripts/docs-check` verde; `drizzle/` com a 1ª migration gerada.

---

## Fase 2 — Domínio + portas (`src/domain/`)

**Paralelismo: 2 subagents.** Depende da Fase 1 (usa tipos de lib, mas só tipos — não
runtime, pra desacoplar).

### 2a — Tipos de domínio + portas (ADR-0004)
- `src/domain/types.ts`: `Fatura`, `Cobranca`, `Nota`, `Item`, `Parceiro`, `Cliente`,
  `Plano`, `TipoFaturamento` enum, `StatusFatura`/`StatusCobranca`/`StatusInternoNota`/
  `SituacaoNota` — em **centavos inteiros**, documentos desmascarados.
- `src/domain/ports/atacado.port.ts`: `buscarParceiroPorId`,
  `buscarClientesAtivosPorParceiro`, `buscarPlanosDeServico`, criar/ remover árvore
  (fatura/cobrança/nota/itens), `atualizarStatusFatura/Cobranca/Nota`, `registrarErro`.
- `src/domain/ports/asaas.port.ts`: `buscarCustomerPorDocumento`, `criarCustomer`,
  `atualizarCustomer`, `criarBoleto`, `consultarBoletoPorExternalReference`.
- `src/domain/ports/nfcom.port.ts`: `autenticar`, `emitirNFCom`, `consultarLista`.
- `src/domain/ports/queue.port.ts`: enfileirar `emit-fatura`/jobs filhos (abstração
  sobre BullMQ, pro domínio não importar `bullmq`).
- `src/domain/ports/logger.port.ts`: `log` (tipo, pra domínio não acoplar a pino).

### 2b — Agregados de domínio (TDD: teste vermelho primeiro, por caso de SPEC)
- `src/domain/fatura/`: cálculo (centavos, descarte de linhas sem plano/preço zero,
  agrupar serviços, total), `dataVencimento` = dia do parceiro (default 10) **no mês
  seguinte** (SPEC-0002 caso 10), normalização `dataReferencia` → `YYYY-MM-01`, plano de
  cobranças por `tipoFaturamento` (tabela de cardinalidade da SPEC-0002), validação
  pré-persistência (documento com dígito, endereço completo do destinatário).
- `src/domain/emissao/`: máquina de estados
  (`a-emitir → emitindo → emitida | parcial | erro`), mapeamento gateway→nota
  (`autorizada`/`rejeitada`/`cancelada`/`processando`/erro-local →
  `f_situacao`+`f_status_interno`), consolidação final da fatura (emitida/parcial/erro
  pela árvore BullMQ).
- **Sem import de `src/modules/`** (grep do ADR-0004/0007 deve passar).
- **Testes escritos em TDD nesta fase** (cada um red → green, guiando a implementação):
  - `test/domain/fatura/calculation.test.ts` — descarte de linhas sem plano/preço zero,
    total em centavos, **SPEC-0002 casos 9, 11** (consistência do total).
  - `test/domain/fatura/vencimento.test.ts` — vencimento no mês seguinte, dia do
    parceiro vs default 10, **SPEC-0002 caso 10**.
  - `test/domain/fatura/billing-plan.test.ts` — cardinalidade por
    `tipoFaturamento` (parceiro/via-parceiro/cofaturamento/cliente-final), **SPEC-0002
    casos 12** (via-parceiro ≡ cofaturamento).
  - `test/domain/fatura/validation.test.ts` — documento com dígito inválido,
    endereço completo do destinatário, **SPEC-0002 casos 4, 13**.
  - `test/domain/emissao/situacao-mapping.test.ts` — mapeamento
    `autorizada`/`rejeitada`/`cancelada`/`processando`/erro-local →
    `f_situacao`+`f_status_interno`, **SPEC-0001 casos 6, 7** (processando retry / fatal).
  - `test/domain/emissao/consolidacao.test.ts` — emitida/parcial/erro pela árvore,
    **SPEC-0001 casos 10, 11, 18** (rollback / parcial vs erro / nota com boleto falho).
  - **Nota**: os casos que exigem integração real (Atacado/Asaas/NFCom/HTTP/filas) —
    SPEC-0002 casos 1, 2, 3, 5, 6, 7, 8, 14 e SPEC-0001 casos 1, 2, 3, 4, 5, 8, 9, 15, 16,
    17, 12, 13, 14 — são testados red-green nas **fases onde a camada que os cobre
    nasce** (Fases 3/4/5), não aqui.

**Saída da Fase 2:** typecheck verde; testes de domínio verdes; greps anti-import
passam.

---

## Fase 3 — Módulos ACL (`src/modules/`)

**Paralelismo: 3 subagents.** Cada um consome as portas da Fase 2 e os tipos gerados.

### 3a — `modules/atacado` (ADR-0004)
- `atacado.client.ts`: HTTP NocoBase (ação `:get`/`:list`/`:create`/`:destroy`,
  `filterByTk`, `appends`, paginação fake, FKs duplicadas em creates aninhados).
- `translators/`: tipos `f_*` (monetário string com vírgula, CPF/CNPJ mascarado) ↔
  domínio (centavos, documento limpo). Arredondamento determinístico.
- `atacado.repository.ts`: implementa `AtacadoPort` (leitura + criação/remoção da
  árvore com rollback manual + atualização de status via outbox).
- Teste: `test/modules/atacado/*.test.ts` (translators, árvore, rollback).

### 3b — `modules/asaas`
- `asaas.client.ts`: API v3, header `access_token`, `errors[]`, `billingType: BOLETO`.
- `translators/`: domínio ↔ Asaas (centavos ↔ número do Asaas, externalReference
  `cobranca:{id}`).
- `asaas.repository.ts`: implementa `AsaasPort` (buscar/criar/atualizar customer por
  documento, criar boleto, consultar por externalReference).
- Teste: `test/modules/asaas/*.test.ts`.

### 3c — `modules/nfcom` (ADR-0001, swagger verificado)
- `nfcom.client.ts`: `POST /api/auth` (bearer TTL 12h, cache), `POST /api/emitir`,
  `POST /api/consulta`, `GET /api/lista`, `GET /api/seleciona`, `POST /api/status`,
  `DELETE /api/cancela`. `ApiNFComEmitir` `additionalProperties: false` (sem
  referência própria).
- `translators/`: normaliza case de `situacao` (uppercase swagger → lowercase domínio);
  mapeia `AUTORIZADA/CANCELADA/PROCESSANDO/REJEITADA`.
- `nfcom.repository.ts`: implementa `NfcomPort` (autenticar com cache TTL 12h, emitir,
  consultar lista por cpfcnpj+data).
- Teste: `test/modules/nfcom/*.test.ts` (auth/cache, emitir, normalização situacao).

**Saída da Fase 3:** typecheck verde; testes de módulo verdes; nenhum tipo externo
vaza (grep ADR-0004: domain não importa modules).

---

## Fase 4 — Workers (`src/workers/`)

**Paralelismo: 3 subagents.** Orquestração BullMQ; consome domain + ports + lib.

### 4a — `emissao.worker.ts` (SPEC-0001, ADR-0002, ADR-0003)
- Jobs `emit-fatura` (parent, lease `fatura:{id}:emitir`, marca `emitindo` via outbox),
  `emit-cobranca` (child; idempotency `cobranca:{id}:boleto`; customer buscar/atualizar
  por documento; criar boleto `externalReference=cobranca:{id}`; caso 5
  consult-before-re-emit; caso 16 atualizar divergente; caso 18 nota independe do
  boleto), `emit-nfcom` (child do `emit-cobranca`; idempotency `nfcom:{id}:emitir`;
  caso 15 não-re-emite → erro+inspeção; mapeamento situacao; caso 6 processando retry,
  caso 7 fatal, caso 9 reauth TTL 12h). **Flow em árvore**; callback do parent
  consolida `emitida/parcial/erro`.
- Wrapper com ALS (contexto `faturaId`/`jobId`/`fila`), catch loga uma vez (ADR-0008),
  retry 5 backoff exponencial, exaurido → `erro` via outbox (caso 17).
- **Testes TDD red-green (casos de SPEC que vivem no worker):**
  - `test/emission/orphan-lease.test.ts` — **SPEC-0001 caso 2** (lease/órfão reassume,
    keys filhas pulam emitidas).
  - `test/emission/idempotency-boleto.test.ts` — **SPEC-0001 caso 5** (crash pós-boleto,
    consult-before-re-emit, sem duplicar).
  - `test/emission/idempotency-nota.test.ts` — **SPEC-0001 caso 15** (crash pós-POST,
    não re-emite → erro+inspeção).
  - `test/emission/nfcom-reauth.test.ts` — **SPEC-0001 caso 9** (401 → reauth TTL 12h).
  - `test/emission/asaas-customer.test.ts` — **SPEC-0001 caso 16** (customer divergente
    atualiza).
  - `test/emission/retry-exausto.test.ts` — **SPEC-0001 caso 17** (5 tentativas → erro).
  - `test/emission/cobranca-boleto-falho.test.ts` — **SPEC-0001 caso 18** (boleto falha,
    nota emite).
  - `test/emission/processando-retry.test.ts` / `nfcom-fatal.test.ts` — **casos 6, 7**.
  - `test/workers/emissao.worker.test.ts` — unitário do wrapper (ALS, árvore, callback).

### 4b — `outbox.worker.ts` (ADR-0002/0003)
- Drena `outbox` do SQLite e entrega ao Atacado via `AtacadoPort` (entrega
  ao-menos-uma-vez, idempotente por update por id). Retry/backoff do BullMQ.
- **Testes TDD:** `test/workers/outbox.worker.test.ts` (drain, idempotência por id,
  retry em falha do Atacado, ordem de entrega).

### 4c — `webhook.worker.ts` (SPEC-0001 passo 6)
- Empurra `POST {WEBHOOK_URL}` com `X-Webhook-Signature` HMAC (`WEBHOOK_SECRET`);
  `eventoId` determinístico `(faturaId, alvo, estado, timestamp-do-evento)`; entrega
  ao-menos-uma-vez; `WEBHOOK_URL` vazia → não empurra (caso 14); cliente não-2xx →
  retry backoff, exaurido → falho (caso 12); cliente dedup por `eventoId` (caso 13).
- **Testes TDD red-green:**
  - `test/webhook/delivery.test.ts` — **SPEC-0001 casos 12, 13** (retry em não-2xx,
    `eventoId` determinístico p/ dedup no receptor).
  - `test/webhook/disabled.test.ts` — **SPEC-0001 caso 14** (WEBHOOK_URL vazia → não
    empurra).

**Saída da Fase 4:** typecheck + testes de worker verdes; greps ADR-0002 passam.

---

## Fase 5 — HTTP (`src/http/`)

**Paralelismo: 2 subagents.**

### 5a — Middlewares
- `middlewares/api-key.ts` (`X-API-Key` vs `EMISSOR_API_KEY`, 401), `request-log.ts`
  (ALS com metodo/rota, ADR-0008), `error-handler.ts` (envelope canônico
  `{ erro: { tipo, mensagem, detalhe } }`, taxonomia `CONFLITO/VALIDACAO/
  NAO_ENCONTRADO/ERRO_INTERNO`, status 409/422/404/500; loga erro uma vez).

### 5b — Rotas (SPEC-0001/0002) — TDD red-green
- `routes/faturas.route.ts`:
  - `POST /faturas/preparar` (SPEC-0002) — síncrono; valida body Zod; idempotência por
    `(parceiroId, dataReferencia normalizada)`; 409 se emitindo/emitida/parcial/erro/
    pago/cancelada (casos 5/14); 200 atualização (remove+recria árvore) / 201 criação;
    422 validações (casos 1-4, 8, 13); rollback manual (caso 7).
  - `POST /faturas/{id}/emitir` (SPEC-0001) — 409 se emitindo/emitida (caso 1), valida
    soma cobranças ≤ R$0,01 (caso 3) e ≥1 nota por cobrança (caso 4) e doc válido
    (caso 8); enfileira `emit-fatura` (não executa síncrono); retorna `202` + jobId +
    statusUrl.
  - `GET /faturas/{id}/emissao` — estado atual (fatura/cobranças/notas/erros), fallback.
  - `GET /health` (liveness: processo + SQLite ping, ADR-0002).
- Rotas **não** importam repositories/SDK externos (só domain/ports + lib) — grep
  ADR-0007.
- **Testes TDD red-green (casos de SPEC que vivem na rota):**
  - `test/preparation/validation.test.ts` — **SPEC-0002 casos 1, 2, 3, 4, 13**
    (parceiro/clientes/planos/doc/endereço).
  - `test/preparation/upsert.test.ts` — **SPEC-0002 casos 5, 6, 14** (409
    emitindo/emitida/.../pago/cancelada; atualização 200).
  - `test/preparation/rollback.test.ts` — **SPEC-0002 caso 7** (rollback manual estrito).
  - `test/preparation/schema.test.ts` — **SPEC-0002 caso 8** (Zod 422).
  - `test/preparation/calculation.test.ts` — **SPEC-0002 casos 9, 10** (linhas
    inválidas / vencimento default).
  - `test/preparation/billing-plan.test.ts` — **SPEC-0002 caso 12** (via-parceiro ≡
    cofaturamento) — confirma em nível de rota o que o domínio já testa.
  - `test/emission/emit-trigger.test.ts` — **SPEC-0001 casos 1, 3, 4, 8** (409 / soma /
    nota-por-cobrança / doc inválido) + asserção de que enfileira (não executa síncrono).
  - `test/http/health.test.ts`, `test/http/emissao-query.test.ts` (`GET .../emissao`),
    `test/http/error-envelope.test.ts` (envelope + taxonomia + status).

**Saída da Fase 5:** typecheck + testes HTTP verdes.

---

## Fase 6 — Composition root + integração

**1 subagent (sequencial, orquestra tudo).**

- `src/index.ts`: cria logger/db/redis; injeta ports→repositories (atacado/asaas/nfcom);
  registra rotas + middlewares; sobe workers (emissao/outbox/webhook) no mesmo processo
  (ADR-0002 single-instance); roda `bunx drizzle-kit migrate` no boot (idempotente,
  CMD Dockerfile); graceful shutdown 30s (drena jobs).
- Validação end-to-end: todos os greps das DoDs das SPECs/ADRs passam; `bun run
  typecheck` + `bun run test` (suite completa) verdes.
- **Promover docs** `proposed`/`draft` → `accepted` conforme a camada correspondente
  for fechada (validar com `./scripts/docs-check`).

**Saída da Fase 6:** app integrado, DoD global do repo verde, docs promoted.

---

## Consolidação & DoD final (não é "Fase 7" — é a verificação de que o TDD fechou)

Não há fase posterior de "adicionar casos de borda": cada caso das SPECs foi escrito
**red → green na fase onde a camada que o cobre nasceu** (ver mapeamento por fase
acima). Após a Fase 6, só a verificação final:

- `bun run typecheck` exit 0.
- `bun run test` (suite completa) tudo verde — todos os casos das SPECs (SPEC-0001
  1-18, SPEC-0002 1-14) exercitados por testes nomeados já escritos.
- Greps das DoDs das SPECs/ADRs passam (validação de presença e regras anti-import).
- `./scripts/docs-check` verde; ADRs/SPECs promoted a `accepted`.
- **Cobertura de casos**: mapear cada caso da SPEC → arquivo de teste que o exercita
  (tabela de rastreabilidade), confirmar que nenhum ficou sem teste.

Se algum caso da SPEC não tiver teste correspondente ao final, isso é um bug do plano
— o caso deveria ter sido red-green na fase da sua camada. Reabrir ali, não numa
fase tardia.

---

## Ordem de execução (dependências entre fases)

```
Fase 1 (lib) ──┬─ 1a logger
               ├─ 1b db+schema+idempotency+outbox
               └─ 1c redis+queues
                     │
Fase 2 (domain) ──── 2a types+ports  ─ 2b fatura/emissao (TDD: casos 6,7,9,10,11,12,13,18)
                     │
Fase 3 (modules) ─── 3a atacado  3b asaas  3c nfcom
                     │
Fase 4 (workers) ─── 4a emissao (TDD: casos 2,5,6,7,9,15,16,17,18)  4b outbox  4c webhook (TDD: 12,13,14)
                     │
Fase 5 (http) ────── 5a middlewares  5b routes (TDD: S2 casos 1-8,10,12,13,14; S1 casos 1,3,4,8)
                     │
Fase 6 (composition root) ─── integração end-to-end
                     │
Consolidação ─── verificação final (todos os casos red-green, DoDs, docs)
```

## Notas / riscos

- **TDD estrito não é "mais testes", é ordem**: a mesma suite final do plano original;
  a diferença é que cada teste é escrito **antes** do código que satisfaz, guiando o
  design. Custo: cada sub-tarefa faz um ciclo red-green-refactor extra; ganho: a
  especificação executável emerge junto com o código, e os casos de borda não viram
  dívida técnica no fim.
- **Subagent TDD**: o prompt de cada subagent deve instruir red → green → refactor
  explicitamente (escrever o teste, rodar `bun test` e ver falhar, implementar o
  mínimo, ver verde, refactor). Sem isso, o subagent tende a escrever código+teste
  juntos e pular o vermelho — perdendo o ponto do TDD.
- **Fase 2a porta de queue**: domínio abstrai BullMQ pra `domain/` não importar `bullmq`
  (regra ADR-0004/0007). Workers (Fase 4) ligam a porta ao BullMQ.
- **Atraso de feedback (risco da estratégia horizontal)**: o caminho end-to-end só
  funciona na Fase 6. Mitigação: cada fase tem testes de camada (unidade) em TDD que
  exercitam o contrato da camada isoladamente; a Fase 6 é cola, não reimplementação.
- **Tipos gerados do CRM** já estão prontos — Fase 3a os consome direto; se algum campo
  esperado faltar, volta pro `generate:types` (ADR-0006), não editar à mão.
- **Docs**: promover status das ADRs/SPECs a `accepted` conforme cada camada fecha,
  rodando `./scripts/docs-check` (Python: `./scripts/docs-check`, não `bun`).
