---
status: proposed
date: 2026-08-13
builds-on: [ADR-0002]
superseded-by: null
deciders: [gugacarbo]
---

# Estado local SQLite para idempotência e outbox

## Contexto e problema

O app integra três sistemas de escrita que **não participam de uma transação distribuída**:
o CRM Atacado (fonte de domínio), o Asaas (cobrança) e o gateway NFCom (SEFAZ). Em qualquer
ponto do fluxo uma escrita pode ter sucesso no serviço externo e falhar na persistência do
estado — ou o processo pode cair entre as duas. Numa arquitetura stateless (toda
persistência via API do Atacado), isso produz um bug concreto:

> Boleto emitido com sucesso no Asaas → processo cai antes de persistir `f_id_externo` →
> no retry, a cobrança aparece como `erro` e é **reemitida, gerando boleto duplicado**.

O mesmo vale para NFCom (nota autorizada na SEFAZ mas não persistida = nota duplicada).
Ter uma `externalReference = cobranca.id` no Asaas não basta se ela **nunca é consultada
antes de reemitir** — é correlação a posteriori, não dedup.

Precisamos de um mecanismo que **garanta que um mesmo trabalho (emitir cobrança X / nota Y)
execute exatamente uma vez** mesmo com retries, restarts e falhas parciais.

## Direcionadores da decisão

- **Exactly-once efetivo**: reprocessar um job (BullMQ, ADR-0002) nunca duplica boleto ou
  nota no mundo externo.
- **Sem transação distribuída**: não podemos envolver Asaas/SEFAZ numa transação de BD.
- **Fonte de domínio preservada**: o CRM Atacado segue como fonte de verdade de domínio
  (faturas, cobranças, notas); o estado local é **metadado de coordenação**, não domínio.
- **Outbox**: atualizações no Atacado precisam ser confiáveis; uma escrita de outbox
  local + relay assíncrono dá entrega ao-menos-uma-vez idempotente.
- **Baixo custo operacional**: sem DB server adicional.

## Opções consideradas

### Opção 1 — SQLite local: idempotency keys + outbox

Um banco SQLite no processo guarda:

- `idempotency_keys`: `(key, target, external_id, status, created_at)` — `key` é
  determinístico (ex.: `cobranca:{id}:boleto`, `nfcom:{id}:emitir`). Antes de chamar o
  Asaas/SEFAZ, o job tenta inserir/lock a chave; se já houver `external_id` resolvido,
  retorna o resultado sem re-chamar o serviço.
- `outbox`: mensagens a aplicar no Atacado (update de status, gravar `f_id_externo`,
  registrar erro) — escritas locais transacionais com a mudança de estado do job;
  um relay assíncrono entrega ao Atacado com retry.

**Prós:**

- Idempotência real: o lookup da chave antes de emitir impede duplicação por retry/crash.
- Outbox dá entrega confiável ao Atacado desacoplada da latência/queda do CRM.
- SQLite é zero-config, embutido, bom para um microserviço single-instance.
- Transação local (job-state + outbox) é atômica em SQLite.

**Contras:**

- State divergence se o app escalar para múltiplas instâncias (SQLite multi-escritor é
  limitado). Para já, single-instance é aceitável; escalar é ADR futuro.
- Mais um store para modelar/migrar.

### Opção 2 — Stateless (CRM Atacado como única verdade)

Sem DB próprio; toda persistência via Atacado; dedup só por status local.

**Prós:**

- Sem DB próprio; menos código.

**Contras:**

- Mantém a duplicação (sem lookup pré-emissão).
- Não há outbox: falha de rede no Atacado no meio do fluxo vira estado inconsistente sem
  retomada confiável.

### Opção 3 — Postgres como DB local

Mesma semântica da Opção 1, mas em Postgres.

**Prós:**

- Suporta multi-instância e concorrência de escrita; futuro-proof.

**Contras:**

- Custo operacional de um DB server para o que hoje é single-instance.
- Overkill para o volume atual.

## Decisão

**Estado local em SQLite (Opção 1)** para chaves de idempotência e outbox. O CRM Atacado
continua como fonte de domínio; o SQLite guarda apenas metadado de coordenação de emissão.

Concretamente:

1. Todo job de escrita externa (emitir boleto, emitir nota) deriva uma **idempotency key**
   determinística. Antes de chamar o serviço, o job verifica a chave: se resolvida,
   reutiliza o `external_id`; se em-progresso (com lock), espera/falha-para-retry; senão,
   marca em-progresso e prossegue.
2. Toda escrita no Atacado (status, external_id, erro) passa pelo **outbox** local — a
   mudança de estado do job e a mensagem outbox são escritas na mesma transação SQLite.
   Um relay (fila `outbox`/`outbox-relay`, ADR-0002) entrega ao Atacado com retry
   (entrega ao-menos-uma-vez, idempotente por update direcionado por `id`).
3. **Coordenação por fatura** (lease): além das keys por cobrança/nota, há uma key de
   coordenação `fatura:{id}:emitir` com um `emitindo-since`. O job `emit-fatura` a adquire
   ao iniciar; um novo job só reassume se o anterior for detectado como morto (BullMQ
   stalled/failed), não por timer de relógio. As idempotency keys filhas
   (`cobranca:{id}:boleto`, `nfcom:{id}:emitir`) garantem que, ao reassumir, cobranças/notas
   já emitidas são puladas — sem duplicação.
4. **Referência própria nos serviços externos (dedup no buraco pós-POST)**: a
   idempotency key local não cobre o crash **entre** o POST ao serviço externo e a
   resolução da key (a escrita aconteceu no mundo, mas o estado local não sabe). Para
   fechar esse buraco, toda escrita carrega uma **referência própria determinística**
   (`externalReference`): `cobranca:{id}` no boleto Asaas, `nfcom:{id}` na emissão do
   gateway NFCom. No retry pós-crash, o job **consulta o serviço pela referência antes
   de re-emitir**: se a consulta encontra a escrita anterior, resolve a key com o
   retorno dela; só re-emite se a consulta não encontrar nada. Correlação a posteriori
   que é consultada **antes** de agir — não dedup a posteriori (SPEC-0001 casos 5/15).

## Consequências

**Positivas:**

- Fim do boleto/nota duplicado por crash ou retry.
- Entrega confiável de estado ao CRM via outbox (sobrevive a queda temporária do Atacado).
- Transação local simples (SQLite) para consistência job-state + outbox.

**Negativas:**

- Single-instance por enquanto (SQLite). Escalar para N pods exige trocar o store de
  coordenação (Postgres) — prever migração via mesmo contrato de repositório.
- Modelo extra (schema, migrations) para manter.

**Obrigatório a partir de agora:**

- Nenhuma escrita direta no Asaas/SEFAZ sem antes consultar a idempotency key.
- Nenhuma escrita direta no Atacado que não venha do outbox (para atualizações de estado
  de emissão; reads continuam diretas).
- O CRM Atacado permanece fonte de domínio: o SQLite nunca define o que é uma fatura, só
  o **estado de coordenação** da sua emissão.

## Confirmação

```bash
# Existe schema/migration de idempotency_keys, outbox e lease de fatura.
grep -rln "idempotency_keys\|outbox\|emitindo-since" src/lib/db/ | wc -l | grep -qv '^0$' || exit 1
# Nenhum job de emissão chama Asaas/SEFAZ sem o helper de idempotência.
test -d src/domain/emissao && (grep -rn "POST\|payments\|api/emitir" src/domain/emissao/ | grep -v "idempotency" && exit 1 || true)
```

## Notas

- A idempotency key deve codificar o **alvo + operação + id de domínio**, não só o id
  (ex.: `cobranca:42:boleto` distinto de `nfcom:7:emitir`).
- O relay do outbox precisa de chave de idempotência própria no Atacado (updates por
  `id` são idempotentes; creates via outbox exigem cuidado — preferir updates de entidades
  já criadas).
- Migração SQLite → Postgres no futuro é contida atrás do repositório de coordenação
  (ADR-0004), sem mexer no domínio.
