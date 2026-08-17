---
status: accepted
date: 2026-08-14
builds-on: [ADR-0005, ADR-0007, ADR-0002]
superseded-by: null
deciders: [gugacarbo]
---

# Logging estruturado com pino: correlação por AsyncLocalStorage e redação explícita

## Contexto e problema

ADR-0005 escolheu **pino** como biblioteca de logging, mas só isso não define um
sistema de logging. Falta decidir: formato de saída por ambiente, como cada linha
carrega o contexto de correlação (`faturaId`, `jobId`, …) num app onde o mesmo
fluxo atravessa rota HTTP → fila BullMQ → 3 integrações externas (SPEC-0001),
quais campos são redigidos (CONVENTIONS promete "redação pino" sem lista), e
como o log se correlaciona com a taxonomia de erro do envelope HTTP.

## Direcionadores da decisão

- **Rastreabilidade de fluxo assíncrono**: um incidente de emissão exige reunir
  as linhas de rota + workers + ACLs para uma `faturaId` — sem correlação
  automática, é grep manual multi-passo.
- **Ambientes distintos**: prod é consumido por máquina (Loki/Datadog); dev é
  lido por humano no terminal ao lado do `bun --watch`.
- **Segurança**: CPF/CNPJ circulam pelo fluxo (SPEC-0001/0002) e credenciais
  dos provedores vivem em headers/env — a redação precisa ser estrutural, não
  boa-vontade por call site.
- **Ergonomia**: se propagar contexto exigir parâmetro em toda função, os devs
  vão pular o contexto — a mecânica tem que ser invisível.

## Opções consideradas

### Propagação de contexto

**Opção A — `AsyncLocalStorage` (escolhida).** Middleware Hono (request) e
wrapper de jobs BullMQ (worker) abrem um store com o contexto de correlação;
`log.info(...)` em qualquer camada mescla o store automaticamente.

**Prós:** invisível nos call sites; profundidade arbitrária de chamadas; zero
poluição de assinaturas; testável (o store é populável no teste).
**Contras:** magia implícita — quem lê o código não vê o contexto chegando;
depende de o runtime não quebrar a async context (Bun suporta ALS).

**Opção B — child logger passado como parâmetro.** Logger filho criado no
início do request/job e injetado pelas camadas.

**Prós:** explícito, trivial de testar.
**Contras:** parâmetro `logger` em toda assinatura do domínio; o domínio do
ADR-0007 ficaria acoplado a pino; fácil de "esquecer" e logar sem contexto.

### Formato de saída

**JSON sempre** — simples, uniforme, mas ilegível em dev local.
**JSON em prod, pretty em dev (`pino-pretty`)** — cada ambiente no seu formato.
Custo: uma condição no factory do logger.

## Decisão

1. **Contexto por `AsyncLocalStorage`** (Opção A). Um único store
   (`src/lib/logger/`) com os campos de correlação do fluxo corrente; o logger
   mescla o store em cada linha. Domínio e ACLs chamam `log.info(...)` sem
   saber da mecânica.
2. **JSON estruturado em produção, `pino-pretty` em dev**, decidido pela env
   (`NODE_ENV !== 'production'` → pretty). Factory única em
   `src/lib/logger/`, exposta como `log`.
3. **Redação por allowlist no nível do logger**: serialização de erro e paths
   de redação pino configurados no factory — CPF/CNPJ e headers de
   autenticação (`access_token`, `X-API-Key`, `X-Webhook-Signature`,
   `Authorization`) nunca chegam ao output, independentemente do call site.
   A lista canônica vive no CONVENTIONS.md (capítulo Logging) e o factory é a
   única implementação.
4. **Correlação com a taxonomia de erro**: o error handler HTTP loga o erro
   com o `tipo` do envelope (`CONFLITO`, `VALIDACAO`, …) e o status; erros de
   worker logam a fila e o `jobId`. Erro de rota é logado **uma vez**, no
   handler canônico — middleware e handler não duplicam.

## Consequências

**Positivas:**
- Uma busca por `faturaId` no agregador recupera o fluxo inteiro, rota +
  workers + integrações.
- Redação estrutural: novo endpoint logging um payload externo não vaza dados
  por descuido.
- Dev local legível; prod parseável.

**Negativas:**
- ALS é implícito — mitigado por convenção: contexto novo entra no store,
  nunca como campo avulso no call site.
- `pino-pretty` é dependência de dev a mais (adicioná-la como devDependency no
  primeiro commit de implementação — ainda não está no `package.json`).
- Testes que validam output de log precisam do transporte de teste do pino
  (`pino.prettyFalse`/destino em memória).

**Obrigatório/proibido:**
- Nenhuma camada instancia pino direto — só `import { log } from
  'src/lib/logger'` (uma instância, um config).
- `console.log/warn/error` proibidos no app (`src/**`).
- Log de erro sempre com objeto: `log.error({ err, faturaId }, "msg")` —
  string interpolation de erro perde stack.
- Contexto de correlação entra via store (middleware/wrapper), não via
  parâmetros.

## Confirmação

```bash
# Nenhuma instância direta de pino fora do factory
! grep -rn "from 'pino'" src/ | grep -v "src/lib/logger"
# console.* proibido em src/
! grep -rn "console\.\(log\|warn\|error\)" src/
# Middleware e wrapper populam o store
grep -q "AsyncLocalStorage" src/lib/logger/*.ts
grep -rn "runWithLogContext\|als.run" src/http/ src/workers/ | head -3
```

## Notas

- O campo `faturaId` nos logs segue o ID de domínio do Atacado (ADR-0004);
  IDs de cobrança/nota (externos) logam como `cobrancaId`/`notaId` apenas
  após existirem.
- Nível default `info`; `debug` habilitável por env (`LOG_LEVEL`) se a
  operação pedir, sem ADR novo (é config, não decisão de arquitetura).
- A seção imperativa (campos obrigatórios, níveis, exemplos) vive em
  `docs/context/CONVENTIONS.md` → capítulo Logging, que aponta para cá.
