---
status: draft
date: 2026-08-13
builds-on: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005]
# A fatura é preparada (cálculo + árvore por tipo de faturamento) pela SPEC-0002.
implemented-by: []
---

# Fluxo de emissão de fatura (fatura → cobranças → notas)

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Dado o id de uma **fatura** já preparada no CRM Atacado (com cobranças e notas pré-criadas
em estado `a-emitir` — preparação definida em **SPEC-0002**), o sistema emite de forma
confiável: para cada cobrança, gera o boleto no Asaas e, para cada nota da cobrança,
autoriza a NFCom na SEFAZ via gateway, persistindo os resultados. O processo sobrevive a
retries, restarts e falhas parciais sem duplicar boletos ou notas.

## Fluxo

1. **Disparo**: `POST /faturas/{id}/emitir` valida a fatura (estado, soma de cobranças,
   existência de notas) e **enfileira** um job `emit-fatura` (BullMQ). Retorna `202
Accepted` com o id do job e a URL de consulta de status.
2. **Job `emit-fatura`**: adquire um **lease** sobre a fatura (key de coordenação
   `fatura:{id}:emitir` + `emitindo-since`, ADR-0003) e marca a fatura como `emitindo` no
   Atacado (via outbox). Carrega a fatura com sua árvore (cobranças + notas). Para cada
   cobrança em `a-emitir`, enfileira um job `emit-cobranca` (passo 3). Ao final de todos os
   jobs filho, deriva o estado final da fatura: `emitida` (tudo ok), `parcial` (algum erro)
   ou `erro` (tudo falhou).
3. **Job `emit-cobranca`**: idempotente (ADR-0003). Toda escrita externa e toda
   persistência de estado no Atacado saem pela porta do módulo `asaas` / `atacado`
   (ADR-0004) e passam pelo outbox (ADR-0003).
   a. Verifica a idempotency key `cobranca:{id}:boleto`. Se já resolvida, reutiliza o
   `f_id_externo` e pula a chamada ao Asaas.
   b. Caso contrário, cria/busca o customer no Asaas e `POST /payments` (boleto).
   c. Persiste `f_id_externo`, `f_link_fatura`, `f_data_emissao`, status `emitida`
   (cobrança) via outbox. Em falha, status `erro` + registro em `t_nfcom_erros`.
   d. Para cada nota da cobrança em `a-emitir`, enfileira `emit-nfcom` (passo 4).
4. **Job `emit-nfcom`**: idempotente (ADR-0003). Escrita externa pela porta `nfcom`
   (ADR-0004).
   a. Verifica a idempotency key `nfcom:{id}:emitir`. Se resolvida (nota já emitida),
   reutiliza chave/protocolo e pula.
   b. Autentica no gateway (token cache, TTL 2h) e `POST /api/emitir` com o payload
   (destinatário, itens, CFOP/cClass).
   c. Mapeia a resposta para os dois campos da nota: `f_situacao` espelha a situação
   do gateway (`autorizada`/`cancelada`/`rejeitada`/`processando`) e
   `f_status_interno` é a máquina interna (`a-emitir`/`emitida`/`erro`/`cancelada`,
   conforme o enum do CRM). `autorizada` → persiste número, série, chave, protocolo,
   pdf, xml; `f_situacao=autorizada`, `f_status_interno=emitida`.
   `cancelada`/`rejeitada` → `f_status_interno=erro` (fatal) + erro em `t_nfcom_erros`.
   `processando` → retry (backoff), `f_status_interno` permanece `a-emitir`.
   Persistência via outbox.
5. **Estado final da fatura**: após todos os jobs `emit-cobranca`/`emit-nfcom` resolvidos,
   a fatura é consolidada: `emitida` / `parcial` / `erro`, persistida no Atacado.
6. **Notificação (webhook ativo)**: a cada mudança de estado relevante da fatura, cobrança
   ou nota, o sistema empurra um `POST` de webhook ao endpoint do cliente. Entrega
   ao-menos-uma-vez, idempotente; o `eventoId` é **determinístico** por
   `(faturaId, alvo, estado, timestamp-do-evento)` — consistente com o ADR-0003 — de modo
   que a idempotency key `webhook:{faturaId}:{eventoId}` seja estável entre retries e o
   cliente possa dedup. O sistema retenta com backoff (BullMQ, fila `webhook`) e tolera
   queda temporária do cliente. A URL de webhook é lida da env `WEBHOOK_URL` (global por
   ambiente, ADR-0005); se não configurada, o evento não é empurrado (caso 14).
7. **Consulta (fallback)**: `GET /faturas/{id}/emissao` retorna o estado atual (status da
   fatura, por cobrança/nota, erros registrados) — disponível como fallback caso o webhook
   não seja entregue/confirmado.

## Contrato

### `POST /faturas/{id}/emitir` → `202 Accepted`

```json
{ "jobId": "string", "statusUrl": "/faturas/{id}/emissao" }
```

### Webhook de evento → `POST {WEBHOOK_URL}`

Enviado a cada mudança de estado da fatura/cobrança/nota. Entrega ao-menos-uma-vez; o
cliente dedup por `eventoId` (determinístico, ver passo 6).

```json
{
  "eventoId": "string-determinístico",
  "faturaId": 123,
  "tipo": "fatura.status | cobranca.status | nfcom.situacao",
  "alvo": { "faturaId": 123, "cobrancaId": 456, "nfcomId": 7 },
  "estado": "emitindo | emitida | parcial | erro | autorizada | rejeitada | ...",
  "erros": [
    { "cobrancaId": 789, "tipo": "RETRYABLE", "mensagem": "Timeout NFCom" }
  ],
  "timestamp": "2026-08-13T12:00:00Z"
}
```

`eventoId` é derivado de `(faturaId, alvo, estado, timestamp)` — estável entre retries do
sistema (o `timestamp` é o do evento gerado, não o de cada tentativa de entrega). O sistema
retenta a entrega com backoff exponencial (fila `webhook`, BullMQ) e marca como falho após
exaurir tentativas (o cliente reconsulta via `GET`). A URL alvo é a env `WEBHOOK_URL`
(global por ambiente); sem URL configurada, o evento não é empurrado (caso 14).

### `GET /faturas/{id}/emissao` → `200 OK` (fallback)

```json
{
  "faturaId": 123,
  "status": "emitindo",
  "cobrancas": [
    {
      "id": 456,
      "status": "emitida",
      "boletoUrl": "...",
      "notas": [
        {
          "id": 7,
          "situacao": "autorizada",
          "chave": "...",
          "protocolo": "..."
        }
      ]
    }
  ],
  "erros": [
    { "cobrancaId": 789, "tipo": "RETRYABLE", "mensagem": "Timeout NFCom" }
  ]
}
```

Status possíveis da fatura (`f_status`, conforme enum do CRM): `criada`, `a-emitir`,
`emitindo`, `emitida`, `parcial`, `erro` (os estados `pago`/`cancelada` de fatura são
fora deste ciclo — SPEC futura de cancelamento; a transição `criada → a-emitir →
emitindo` é da SPEC-0002/emissão).
Status possíveis da NFCom — **dois campos**:
- `f_status_interno` (máquina interna, conforme enum do CRM): `a-emitir`, `emitida`,
  `erro`, `cancelada`.
- `f_situacao` (espelho da situação reportada pelo gateway SEFAZ): `autorizada`,
  `rejeitada`, `cancelada`, `processando` (`rejeitada`/`cancelada` são situações
  reportadas pelo gateway, não transições iniciadas pelo app neste ciclo).

Mapeamento gateway → nota: `autorizada` ↔ `f_situacao=autorizada` +
`f_status_interno=emitida`; `rejeitada`/`cancelada` ↔ `f_situacao` correspondente +
`f_status_interno=erro` (fatal); `processando` ↔ `f_situacao=processando` +
`f_status_interno=a-emitir` (aguardando retry).

## Casos de borda

| #   | QUANDO ⟨gatilho⟩                                                                          | o sistema DEVE ⟨resposta⟩                                                                                 |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | a fatura está em `emitindo` ou `emitida` ao receber `POST /emitir`                         | rejeitar com `409 Conflict` (emissão já em curso/concluída)                                               |
| 2   | o job `emit-fatura` cai (órfão) — detectado por lease BullMQ stalled/failed, não por relógio | o novo `emit-fatura` adquire o lease `fatura:{id}:emitir` e reassume; cobranças/notas já emitidas são puladas pelas idempotency keys filhas (ADR-0003) |
| 3   | a soma dos `valor_total` das cobranças diverge do `valor_total` da fatura além de R$ 0,01 | rejeitar com `422` antes de enfileirar (validação bloqueante)                                             |
| 4   | uma cobrança não tem nenhuma NFCom em `a-emitir`                                          | rejeitar com `422` (toda cobrança precisa de nota)                                                        |
| 5   | o boleto foi criado no Asaas mas a persistência falhou (crash antes do outbox relay)      | no reprocessamento, a idempotency key resolve e o `f_id_externo` é reutilizado — **sem boleto duplicado** |
| 6   | a NFCom retorna `processando` do gateway                                                  | o job `emit-nfcom` entra em retry com backoff exponencial (BullMQ)                                        |
| 7   | a NFCom retorna `rejeitada` ou `cancelada` do gateway                                    | marcar a nota como erro fatal (não retryar) e registrar em `t_nfcom_erros`; a fatura tende a `parcial`    |
| 8   | o documento do devedor (CPF/CNPJ) é inválido (dígito verificador)                         | rejeitar com `422` (validação pré-emissão, pipeline de documentos ADR-0004), sem chamar o Asaas          |
| 9   | o token do gateway expira (401) durante a emissão                                         | invalidar o cache de token, reautenticar e retryar a nota (transparente)                                  |
| 10  | todos os jobs de cobrança/nota falham                                                     | a fatura vai para `erro`; nenhum efeito parcial indesejado (rollback de estado via outbox)                |
| 11  | um job `emit-cobranca` falha mas outro da mesma fatura tem sucesso                       | a fatura vai para `parcial` (não `erro`), com a cobrança falhada elegível para retry isolado              |
| 12  | o webhook de evento é entregue mas o cliente retorna não-2xx (ou cai)                     | retentar com backoff exponencial; após exaurir tentativas, marcar como falho (cliente reconsulta via `GET`) |
| 13  | o cliente recebe o mesmo webhook duas vezes (retry do sistema)                           | o cliente deve dedup por `eventoId` — o sistema garante ao-menos-uma-vez, não exactly-once, na entrega   |
| 14  | não há URL de webhook configurada (`WEBHOOK_URL` vazia)                                   | o evento não é empurrado; o estado segue disponível via `GET` (fallback) e registrado em log              |

## Questões em aberto

- [ ] Cancelamento/substituição de NFCom (até 120h) é um fluxo separado, **fora deste
      primeiro ciclo** (só emissão). Será modelado em SPEC futura (id a reservar),
      condicionado a confirmar que o gateway `api.nfcom.com.br` expõe o endpoint de
      evento.

## Decisões fechadas nesta spec

- **Notificação de estado**: webhook ativo (entrega ao-menos-uma-vez + idempotência por
  `eventoId` determinístico no receptor); `GET /faturas/{id}/emissao` é fallback, não
  primário.
- **`eventoId` determinístico**: derivado de `(faturaId, alvo, estado, timestamp-do-evento)`
  — estável entre retries, consistente com as idempotency keys determinísticas do
  ADR-0003.
- **URL de webhook**: env `WEBHOOK_URL` global por ambiente (ADR-0005); sem URL
  configurada, o evento não é empurrado (caso 14).
- **Rate-limit por gateway**: configurado por variáveis de ambiente com defaults
  conservadores (decisão canônica no ADR-0002; ex.: `RATE_LIMIT_ASAS`,
  `RATE_LIMIT_NFCOM`, `RATE_LIMIT_ATACADO` em req/s), ajustado em produção conforme
  observação de 429s.
- **Unidade monetária no domínio**: centavos inteiros (ADR-0004) — a fronteira do módulo
  Atacado converte o número em unidade real do CRM → `number` de centavos ao entrar no
  domínio.
- **Escopo do primeiro ciclo**: somente emissão (sem cancelamento/substituição).

## Definition of Done

```bash
bun run typecheck                 # exit 0
# cada caso de borda tem teste nomeado que o exercita:
bun test src/emission            # casos 1-11 (emissão) — N/N verdes
bun test src/webhook              # casos 12,13,14 (webhook) — N/N verdes
# job de emissão enfileira (não executa síncrono) — ADR-0002
test -d src/http && (grep -rn "queue.add\|\.add(" src/http/ | grep -i emit | wc -l | grep -qv '^0$' || exit 1)
# nenhum boleto/nota é emitido sem consulta à idempotency key — ADR-0003
# (caso 5: test/emission/idempotency-boleto.test.ts; caso 2: test/emission/orphan-lease.test.ts)
test -d src/emission && (grep -rn "payments\|api/emitir" src/emission/ | grep -v "idempotency" && exit 1 || true)
```

Casos de borda exercitados (cada um com teste referenciado): 1, 3, 4 (validação
pré-emissão); 2 (lease/órfão: `test/emission/orphan-lease.test.ts`); 5 (idempotência de
boleto: `test/emission/idempotency-boleto.test.ts`); 6, 7 (retry/fatal NFCom); 8
(documento inválido); 10 (rollback), 11 (parcial vs erro); 9 (reauth:
`test/emission/nfcom-reauth.test.ts`); 12, 13, 14 (entrega de webhook). Os caminhos de
teste são a convenção alvo; ausência do `src/` antes da implementação não invalida o
`status: draft`.

## Revisão humana

- Regras fiscais (CFOP/cClass defaults, ICMS) por estado — os defaults vivem em
  variáveis de ambiente (SPEC-0002); revisar os valores com contador antes de
  produzir.
- Limiar de stalled-job do BullMQ (caso 2) — revisar `stalledInterval`/`maxStalledCount`
  contra o tempo real de uma fatura grande.

## Verificação

```text
(preencher no fechamento)
```
