---
status: accepted
date: 2026-08-13
builds-on: [ADR-0001]
superseded-by: null
deciders: [gugacarbo]
---

# Orquestração de emissão assíncrona via BullMQ + Redis

## Contexto e problema

A emissão de uma fatura é um processo de longa duração e multi-etapa: para cada fatura,
processa-se N cobranças (criar/update no CRM, emitir boleto no Asaas, persistir) e, para
cada cobrança, M NFCom (emitir no gateway SEFAZ, persistir retorno). Cada chamada externa
(Atacado, Asaas, NFCom) é sujeita a timeout, rate-limit e falha transitória.

Num modelo síncrono in-process — a rota HTTP executando o processamento direto, quebrando
as cobranças em chunks de 5 (`Promise.all`) e rodando sequencial entre chunks — aparecem
problemas concretos:

- **Sem sobrevivência a crash**: se o processo morre no meio de uma fatura, o estado fica
  inconsistente (cobrança emitida no Asaas mas não persistida) e não há retomada automática.
- **Sem retry isolado por item**: uma falha numa cobrança força lógica manual de
  classificação (FATAL vs RETRYABLE) e o retry vira um orquestrador paralelo frágil.
- **Rate-limit dos gateways**: o chunk fixo de 5 não respeita limites reais dos provedores.
- **Acoplamento do retry com a orquestração**: um executor de retry que engole erros e os
  converte em `RETRYABLE` silencioso esconde bugs.

Precisamos de um modelo de processamento que **isole cada unidade de trabalho**, sobreviva
a restarts, e dê retry/backoff/rate-limit de primeira classe.

## Direcionadores da decisão

- **Durabilidade**: uma fatura em processamento não pode se perder se o pod reinicia.
- **Granularidade de retry**: retryar uma cobrança/nota falha sem repor a fatura inteira.
- **Rate-limit por gateway**: Asaas, NFCom e Atacado têm limites distintos.
- **Observabilidade**: saber o estado de cada job (waiting/active/completed/failed).
- **Idempotência** (ADR-0003): o modelo de fila casa naturalmente com chaves de
  idempotência por cobrança/nota.

## Opções consideradas

### Opção 1 — BullMQ + Redis (fila persistida)

Jobs em filas Redis; workers consumidores. Cada fatura gera um job `emit-fatura` que
fan-out em jobs `emit-cobranca`, que fan-out em jobs `emit-nfcom`. BullMQ dá retry com
backoff exponencial, rate-limiter por fila, delayed jobs, prioridades e UI (BullMQ Board).

**Prós:**

- Persistência em Redis (sobrevive a restart).
- Retry/backoff/rate-limit de primeira classe, isolados por job.
- Fan-out natural para o modelo fatura→cobrança→nota.
- Maduro, amplo uso em Node/TS, ecossistema (dashboard, métricas).

**Contras:**

- Novo operacional: Redis como dependência de infra.
- Complexidade de concorrência (locks, órfãos em restart controlado — graceful shutdown).

### Opção 2 — Síncrono in-process

Rota HTTP dispara o processamento direto, em `Promise.all` dentro do processo.

**Prós:**

- Sem Redis; menos infra.

**Contras:**

- Sem durabilidade (crash = estado inconsistente, sem retomada).
- Retry manual frágil; rate-limit artesanal.
- Sem primitivas de fila: backoff, retry isolado e rate-limit precisariam ser
  reimplementados no app.

### Opção 3 — Fila leve em SQLite (sem Redis)

Job queue sobre o SQLite local (ex.: `better-queue`, ou tabela `jobs` caseira).

**Prós:**

- Sem Redis; persistência no mesmo DB de idempotência (ADR-0003).

**Contras:**

- Sem primitivas de fila maduras (backoff exponencial, rate-limiter, delayed jobs,
  stalled-job detection, dashboard) — custo não trivial de reimplementar; mesmo
  single-instance, BullMQ dá tudo isso pronto.
- Concorrência de workers sobre SQLite é limitada (lock de escrita) — aceitável
  single-instance, mas restringe futura escala horizontal.

## Decisão

**Orquestração assíncrona com BullMQ sobre Redis (Opção 1).** A rota HTTP apenas
**enfileira** o job `emit-fatura` e retorna imediatamente (202 Accepted + id do job).
Workers processam com fan-out hierárquico:

```
emit-fatura ─┬─ emit-cobranca ─┬─ emit-nfcom
             ├─ emit-cobranca ─┼─ emit-nfcom
             └─ ...            └─ ...
```

Cada job é uma unidade idempotente (ADR-0003). Filas separadas por gateway permitem
rate-limit independente (`atacado`, `asaas`, `nfcom`).

**Outbox relay**: além das filas de emissão, há uma fila `outbox` cujo job drena a tabela
`outbox` do SQLite (ADR-0003) e entrega as mudanças de estado ao Atacado (entrega
ao-menos-uma-vez, idempotente por update direcionado por `id`). O relay lê novos registros
de outbox num loop curto (poll do SQLite) e enfileira cada entrega como job `outbox-relay`,
com retry/backoff do BullMQ. Sem isso, a transação local "job-state + outbox" do ADR-0003
não teria quem a drenasse.

**Rate-limit por gateway**: configurado por variáveis de ambiente com defaults
conservadores (`RATE_LIMIT_ASAAS`, `RATE_LIMIT_NFCOM`, `RATE_LIMIT_ATACADO` em req/s),
validadas por Zod (`@t3-oss/env-core`, ADR-0005). Defaults ajustados em produção conforme
observação de 429s. Cada fila BullMQ usa o rate-limiter nativo com o valor da env
correspondente. O rate-limiter do BullMQ é **por fila**, não por gateway global: a fila
`asaas` agrupa jobs cujas escritas externas são no Asaas, a `nfcom` no gateway NFCom e a
`atacado`/`outbox-relay` no Atacado. Cada job de emissão escreve primariamente num único
provedor (as escritas no Atacado saem pelo outbox-relay), então o rate-limit da fila
aproxima o limite do provedor; se um provedor vier a ser tocado de duas filas, o limite
agregado é a soma das filas — observar em produção (429s).

**Workers e single-instance**: por ora, workers BullMQ rodam no mesmo processo
single-instance do SQLite (ADR-0003). SQLite não é compartilhado entre pods; escalar a
múltiplas instâncias exige migrar o store de coordenação (Postgres) — ADR futuro.

**Fan-out via Flows (parent/child, em árvore)**: `emit-fatura` é o **parent** de um
Flow BullMQ; os children são os jobs `emit-cobranca`, e cada `emit-nfcom` é **child do
seu `emit-cobranca`** — a árvore é `emit-fatura → emit-cobranca → emit-nfcom` (não um
fan-out plano). O callback do parent dispara quando **toda a árvore** resolve (o BullMQ
só completa um parent quando os children transitivos resolvem), consolidando o estado
final da fatura (`emitida`/`parcial`/`erro`, SPEC-0001) — sem contador de conclusão
próprio no SQLite e **sem consolidação prematura** antes de as notas terminarem.
Primitiva nativa do BullMQ; a alternativa rejeitada (contador transacional local)
duplicaria estado que o Redis já tem e seria suscetível a contagem presa.

**Política de retry e item falho**: jobs de emissão usam padrão de **5 tentativas**
com backoff exponencial. Exauridas, o item vai para `erro` no Atacado via outbox e o
job permanece visível como `failed` no BullMQ (Board) para inspeção/reprocesso manual
— **sem DLQ dedicada** (um componente a menos para operar; o Board cumpre o papel de
inspeção).

**Healthcheck e graceful shutdown**: `GET /health` (liveness) responde 200 se o
processo está de pé e o SQLite responde a um ping — sem readiness que dependa dos
provedores externos (a disponibilidade deles não tira o pod do ar). Shutdown drena o
job em andamento com **timeout de 30s** antes de sair.

## Consequências

**Positivas:**

- Emissão sobrevive a restart; jobs órfãos são retomados.
- Retry isolado por cobrança/nota, com backoff exponencial.
- Rate-limit por gateway configurável por fila.
- Observabilidade de estado por job (BullMQ Board / métricas).

**Negativas:**

- Redis passa a ser dependência de infra (um processo a mais para operar).
- Fluxo assíncrono exige que o cliente consulte status do job (websocket/polling/webhook).
- Necessário graceful shutdown dos workers (drenar job ativo antes de sair).

**Obrigatório a partir de agora:**

- Nenhuma rota HTTP executa emissão síncrona; apenas enfileira.
- Cada job de emissão é idempotente (ADR-0003) — reprocessar um job nunca duplica.
- Workers têm graceful shutdown (drenar job em andamento, timeout controlado).

## Confirmação

```bash
# Nenhuma rota executa emissão síncrona; ela apenas enfileira o job.
test -d src/http && (grep -rn "queue.add\|\.add(" src/http/ | grep -i emit | wc -l | grep -qv '^0$' || exit 1)
# Filas e workers existem; inclui a fila outbox e rate-limit por gateway.
test -d src/workers && (grep -rn "new Queue\|new Worker" src/workers/ | wc -l | grep -qv '^0$' || exit 1)
# Rate-limit por gateway declarado no schema de env (RATE_LIMIT_ASAAS/NFCOM/ATACADO).
grep -rn "RATE_LIMIT_ASAAS\|RATE_LIMIT_NFCOM\|RATE_LIMIT_ATACADO" src/env.ts | wc -l | grep -qv '^0$' || exit 1
# Fila outbox existe (drena o outbox do ADR-0003).
grep -rn "outbox" src/workers/ | wc -l | grep -qv '^0$' || exit 1
```

## Notas

- O contrato de eventos da NFCom (cancelamento/substituição) também vira jobs
  (`cancel-nfcom`) na mesma estrutura de filas.
- A máquina de estados da fatura (`a-emitir → emitindo → emitida | parcial | erro`)
  é **atualizada pelo worker**, não pelo handler HTTP.
