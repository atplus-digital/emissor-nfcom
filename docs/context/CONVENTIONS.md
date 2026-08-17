# Convenções compartilhadas

Capítulo de contexto: convenções imperativas e atemporais que SPECs e ADRs **apontam**
em vez de repetir. Apenas decisões já estabilizadas; pendência vai a `docs/BACKLOG.md`,
não aqui.

## Envelope de erro HTTP

Toda resposta de erro das rotas (`POST /faturas/{id}/emitir`, `GET .../emissao`) usa o
envelope canônico, serializado por Hono (ADR-0005):

```json
{ "erro": { "tipo": "string", "mensagem": "string", "detalhe": {} } }
```

- `tipo` é um código estável da taxonomia do app (`CONFLITO`, `VALIDACAO`,
  `NAO_ENCONTRADO`, `ERRO_INTERNO`), não o nome da classe de erro.
- Códigos de status HTTP: `409` (emissão em curso/concluída — SPEC-0001 caso 1),
  `422` (validação bloqueante — casos 3, 4, 8), `404` (fatura inexistente), `500`
  (erro interno não-classificado).
- Erros de validação do Zod (rota) viram `422` com `detalhe` listando os campos.

## Autorização

- A API do emissor é interna (chamada por sistemas do AT+). Autenticação por API key
  no header `X-API-Key`, validada por Zod (`EMISSOR_API_KEY`, ADR-0005). Sem key/errada
  → `401`.
- O endpoint de webhook de saída é autenticado por um `X-Webhook-Signature` (HMAC do
  corpo com segredo `WEBHOOK_SECRET`) para que o cliente verifique a origem.
  `WEBHOOK_SECRET` é **obrigatório quando `WEBHOOK_URL` está configurada** (validado em
  `src/env.ts`); com `WEBHOOK_URL` vazia, o push é desativado (SPEC-0001 caso 14) e o
  segredo é opcional.
- As credenciais dos provedores externos (Asaas, NFCom, Atacado) vivem só em env e
  nunca saem nas respostas/logs (redação pino, ADR-0005).

## Variáveis de ambiente

- Toda variável de ambiente usada pelo app é declarada e validada em `src/env.ts`
  via `@t3-oss/env-core` + Zod (ADR-0005) — `process.env` direto fora de
  `src/env.ts` é proibido no app (exceção: scripts de tooling fora do app).
- Env nova (novo provedor, feature flag, default fiscal) entra primeiro no schema
  de `src/env.ts`, com validação/default lá — nunca no call site.

## Datas e fuso horário

- O fuso horário do domínio é **`America/Sao_Paulo`**, declarado como constante —
  nunca o fuso do container (UTC em produção). `dataReferencia`/`dataVencimento` e
  janelas de faturamento mensal são computadas nesse fuso.
- Datas de domínio sem hora do dia são representadas como **datas puras**
  (`YYYY-MM-DD`); timestamps de eventos (webhook, outbox) são ISO 8601 UTC no wire e
  convertidos ao fuso do domínio no uso.

## Migrations Drizzle (ADR-0009)

Migrations são **sempre geradas** via `bunx drizzle-kit generate` a partir de
`src/lib/db/schema.ts` — nunca escritas/editadas à mão (ADR-0009). A regra abaixo é
**processo de PR**, não auto-validável por inspeção de arquivo.

- **Nomear AO GERAR**: o drizzle-kit atribui um nome aleatório (ex.: `0000_nervous_dexter_bennett`).
  **Renomeie imediatamente** para um nome descritivo do que a migration introduz,
  antes de commitá-la — formato `<seq>_<slug_descritivo>` (ex.:
  `0000_init_coordination_schema`, `0001_add_nfcom_erros_index`). O slug descreve a
  mudança de schema, não o autor/hora.
- **Consistência do `meta/`**: ao renomear, atualize **junto** o `tag` em
  `drizzle/meta/_journal.json` e qualquer referência ao nome em `drizzle/meta/`. Não
  altere hashes internos (`id`/`prevId` do snapshot) — só o rótulo `tag`. Valide com
  `bunx drizzle-kit generate` ("No schema changes") e `bunx drizzle-kit migrate` (aplica
  limpo num DB temporário).
- **Nunca editar SQL gerado**: o conteúdo de `drizzle/*.sql` é saída de máquina. Se o SQL
  estiver errado, corrija `src/lib/db/schema.ts` e regenere. Após aplicada em produção,
  uma migration **nunca** é editada — gera-se uma corretiva.
- **Revisão no PR**: o SQL gerado é revisado no PR (validação, não reescrita).

## Acesso a dados

- **CRM Atacado** é a fonte de domínio (faturas, cobranças, notas). O app lê e escreve
  no Atacado pela porta do módulo `atacado` (ADR-0004).
- **SQLite local** guarda só metadado de coordenação (idempotency keys, outbox, lease
  de fatura — ADR-0003). Nunca define o que é uma fatura; apenas o estado de
  coordenação da sua emissão.
- **Writes ao Atacado de mudança de estado de emissão** passam pelo outbox (entrega
  ao-menos-uma-vez, ADR-0003/ADR-0002). Reads são diretos pela porta `atacado`.
- **Writes a Asaas/NFCom** são precedidos pela consulta à idempotency key (ADR-0003).

## Logging

Decisão de arquitetura em ADR-0008 (pino, ALS, redação). Regras de uso:

- **Uma instância só**: `import { log } from 'src/lib/logger'` — nunca
  instanciar pino ou usar `console.*` em `src/**`.
- **Formato**: JSON em produção, pretty em dev (`pino-pretty`), decidido pelo
  factory — nunca no call site.
- **Contexto de correlação** (faturaId, jobId, fila, metodo/rota) entra via
  `AsyncLocalStorage` populado pelo middleware Hono e pelo wrapper de jobs
  BullMQ — nunca como campo avulso no call site. Buscar por `faturaId` no
  agregador deve recuperar o fluxo inteiro.
- **Níveis**: `error` = falha com stack (`log.error({ err }, "msg")` — objeto,
  não interpolação); `warn` = retry, degradação, caso de borda previsto;
  `info` = transição de estado e evento de negócio; `debug` = verbosidade de
  diagnóstico (`LOG_LEVEL`).
- **Redação (lista canônica)**: CPF/CNPJ e headers de autenticação
  (`access_token`, `X-API-Key`, `X-Webhook-Signature`, `Authorization`) são
  redigidos no factory, por allowlist — payloads externos nunca são logados
  crus; logar referências (`cobrancaId`, `notaId`), não corpos.
- **Erro logado uma vez**: rota loga no error handler canônico (com `tipo` do
  envelope de erro e status); worker loga no catch do wrapper (com fila e
  `jobId`). Camada intermediária não repita.
- **Eventos de mudança de estado** (SPEC-0001) logam `info` com
  `faturaId` + estado novo, correlacionando com o webhook empurrado.

## Comandos canônicos de teste

```bash
bun run typecheck   # exit 0
bun run test        # N/N verdes (bun test --isolate, script canônico)
```
