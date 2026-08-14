---
status: draft
date: 2026-08-14
builds-on: [ADR-0003, ADR-0004, ADR-0005]
implemented-by: []
---

# Preparação de fatura (cálculo + persistência da árvore por tipo de faturamento)

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Dado um parceiro, uma data de referência (mês de faturamento) e um **tipo de
faturamento**, o sistema **prepara** a fatura: lê os dados de domínio no CRM Atacado
(parceiro, clientes ativos, planos), calcula o plano de cobranças e notas conforme o
tipo, e persiste a árvore `fatura → cobranças → notas (com itens)` no Atacado, pronta
para emissão (SPEC-0001). A operação é **síncrona** e **idempotente por
`(parceiroId, dataReferencia)`**: re-preparar uma fatura ainda não emitida
**atualiza** a árvore (incluindo o `tipoFaturamento`, se diferente); re-preparar uma
fatura já emitida/emissão é recusada.

Esta spec cobre o **oque** emitir (cardinalidade e destinatários por tipo de
faturamento); a SPEC-0001 cobre o **como** emitir de forma confiável.

## Fluxo

1. **Disparo**: `POST /faturas/preparar` valida o body (`parceiroId` > 0,
   `dataReferencia` em formato de data, `tipoFaturamento` ∈ enum) e executa
   **síncrono** (não enfileira job — a emissão, sim, é assíncrona, SPEC-0001/ADR-0002).
2. **Resolução de existente (idempotência)**: consulta a fatura por
   `(parceiroId, dataReferencia)` (chave natural) via porta do módulo Atacado
   (ADR-0004).
   - **Não existe** → modo **criação**.
   - **Existe, status ∈ {`emitindo`, `emitida`, `parcial`, `erro`}** → `409 Conflict`
     (fatura já entrou na emissão; a árvore pode ter IDs externos — não é seguro
     recriar).
   - **Existe, status = `a-emitir`** → modo **atualização**: remove a
     árvore antiga (itens → notas → cobranças; a fatura é reutilizada) e recria a
     árvore nova. Retorna `200 OK` (não 201).
3. **Leitura de domínio (Atacado, ADR-0004)**: em paralelo, lê:
   - o parceiro (`buscarParceiroPorId`);
   - os clientes ativos com linhas do parceiro (`buscarClientesAtivosPorParceiro`);
   - os planos de serviço (`buscarPlanosDeServico`).
4. **Validação pré-persistência**: parceiro existe; ≥ 1 cliente ativo com linhas; ≥ 1
   plano; documentos (CPF/CNPJ) do devedor e dos destinatários das notas com dígito
   verificador válido (pipeline de documentos, ADR-0004). Documento mascarado vindo do
   Atacado é desmascarado antes de validar.
5. **Cálculo**: processa as linhas de cada cliente (descarta linhas sem plano/preço
   zero); totaliza por cliente; agrupa serviços; calcula o total da fatura; calcula a
   data de vencimento (dia do parceiro, ou default se o parceiro não o definir). Se
   todos os clientes ficarem sem linhas válidas → `422`.
6. **Plano de cobranças**: constrói o plano conforme `tipoFaturamento` (tabela de
   cardinalidade abaixo). Cada cobrança tem um devedor e 1..N notas (destinatários);
   cada nota tem seus itens. Cada nota é criada com os **campos de endereço do
   destinatário** (`f_endereco`, `f_endereco_numero`, `f_bairro`, `f_cep`, `f_cidade`,
   `f_uf` — exigidos pelo MOC da NFCom), copiados do cadastro do destinatário no
   Atacado (cliente ou parceiro).
7. **Persistência (direta, com rollback manual)**: cria a árvore no Atacado nesta
   ordem, pela porta do módulo Atacado: `fatura` (se criação) → `cobrança` →
   `nota` → `itens da nota`. Em falha em qualquer etapa, remove as entidades já
   criadas na árvore (itens → notas → cobranças → fatura, se criação) e propaga o
   erro. A fatura fica `a-emitir`; cobranças e notas ficam `a-emitir`.
8. **Resposta**: `201 Created` (criação) ou `200 OK` (atualização) com a árvore criada
   em termos de domínio (centavos inteiros, ADR-0004).

## Contrato

### `POST /faturas/preparar` → `201 Created` | `200 OK` | `409` | `422`

```json
// request
{
  "parceiroId": 42,
  "dataReferencia": "2026-08-01",
  "tipoFaturamento": "cofaturamento"
}

// response (201 criação / 200 atualização)
{
  "faturaId": 101,
  "status": "a-emitir",
  "dataReferencia": "2026-08-01",
  "dataVencimento": "2026-08-10",
  "valorTotal": 123456,
  "tipoFaturamento": "cofaturamento",
  "cobrancas": [
    {
      "id": 456,
      "valorTotal": 123456,
      "nomeDevedor": "Parceiro Ltda",
      "documentoDevedor": "12345678000199",
      "emailDevedor": "fin@parceiro.com",
      "status": "a-emitir",
      "notas": [
        {
          "id": 7,
          "nome": "Cliente Final",
          "cpfcnpj": "11122233344",
          "endereco": {
            "logradouro": "Rua Exemplo",
            "numero": "123",
            "bairro": "Centro",
            "cep": "80000000",
            "cidade": "Curitiba",
            "uf": "PR"
          },
          "cobrancaId": 456,
          "status": "a-emitir"
        }
      ]
    }
  ]
}
```

- `valorTotal` e `valorTotal` das cobranças são **centavos inteiros** (`number`,
  ADR-0004). A fronteira do módulo Atacado converte o número em unidade real do CRM
  (`123.45`, conforme tipos gerados) ↔ centavos, com arredondamento determinístico.
- `tipoFaturamento` ∈ {`parceiro`, `via-parceiro`, `cofaturamento`, `cliente-final`}.
- Status da fatura após preparação: `a-emitir`. Status de cobranças/notas: `a-emitir`.
  (A transição `a-emitir → emitindo` é da SPEC-0001; a fatura nasce `a-emitir`.)

### Garantias de cardinalidade por `tipoFaturamento`

A regra central desta spec: o tipo de faturamento define **quantas cobranças, quantas
notas, o devedor de cada cobrança e o destinatário de cada nota**.

| `tipoFaturamento` | Cobranças (boletos) | Notas (NFCom) | Devedor da cobrança | Destinatário da nota |
| ----------------- | ------------------ | ------------- | ------------------- | ------------------- |
| `parceiro`        | 1                  | 1             | parceiro            | parceiro (todos os serviços agrupados numa nota) |
| `via-parceiro`    | 1                  | N (1 por cliente) | parceiro         | cada cliente final |
| `cofaturamento`   | 1                  | N (1 por cliente) | parceiro         | cada cliente final |
| `cliente-final`   | N (1 por cliente)  | N (1 por cliente) | cada cliente     | cada cliente |

- Em `parceiro`, a nota única agrega todos os serviços (`groupedServices`), com o
  total de linhas de todos os clientes.
- Em `via-parceiro`/`cofaturamento`, a cobrança é única ao parceiro, mas cada cliente
  final recebe sua própria nota (com seus itens). Ambos têm **a mesma cardinalidade
  hoje**; são valores de enum distintos porque podem divergir no futuro (questão em
  aberto).
- Em `cliente-final`, cada cliente gera sua cobrança (boleto próprio) e sua nota.
- A soma dos `valorTotal` das cobranças **deve** igualar o `valorTotal` da fatura (até
  1 centavo; validação bloqueante, SPEC-0001 caso 3).

### Portas de leitura (módulo Atacado, ADR-0004)

O cálculo consome estas portas de domínio (não expostas como HTTP do app; são internas
ao módulo Atacado, consumidas pela preparação):

- `buscarParceiroPorId(parceiroId)` → `Parceiro` (razão social, fantasia, CNPJ, email
  de faturamento, dia de vencimento, endereço completo — logradouro, número, bairro,
  CEP, cidade, UF).
- `buscarClientesAtivosPorParceiro(parceiroId)` → `Cliente[]` (nome/razão, fantasia,
  CPF/CNPJ, email, endereço completo — logradouro, número, bairro, CEP, cidade, UF —,
  linhas: `planoId`, descrição, preço unitário, quantidade).
- `buscarPlanosDeServico()` → `Plano[]` (`id`, descrição, preço).

Tipos externos do Atacado (`f_*`, monetário em unidade real `number`, CPF/CNPJ
mascarado) **não saem do módulo** — o tradutor converte na fronteira (ADR-0004).

## Casos de borda

| #   | QUANDO ⟨gatilho⟩                                                                          | o sistema DEVE ⟨resposta⟩                                                                                         |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | `parceiroId` não corresponde a nenhum parceiro no Atacado                                 | `422` (validação bloqueante) com erro de domínio `Parceiro não encontrado`                                        |
| 2   | o parceiro não tem nenhum cliente ativo, ou nenhum com linhas válidas                     | `422` com `Nenhum cliente com linhas ativas encontrado para faturamento`                                           |
| 3   | não há planos de serviço cadastrados no Atacado                                           | `422` com `Planos de serviço não encontrados`                                                                     |
| 4   | o documento (CPF/CNPJ) do devedor ou de algum destinatário de nota tem dígito verificador inválido | `422` antes de persistir (pipeline de documentos, ADR-0004); não cria a árvore                                  |
| 5   | re-POST com `(parceiro, ref)` de fatura em `emitindo`/`emitida`/`parcial`/`erro`           | `409 Conflict` (fatura já entrou na emissão; árvore pode ter IDs externos). Fatura em `erro` **exige descarte** — o caminho de correção é cancelar/descartar a fatura e preparar outra, não re-preparar |
| 6   | re-POST com `(parceiro, ref)` de fatura em `a-emitir` (com qualquer `tipoFaturamento`) | **atualizar**: remover a árvore antiga (itens→notas→cobranças) e recriar conforme o novo tipo; retornar `200 OK` com a nova árvore |
| 7   | a persistência falha no meio (ex.: fatura criada, mas erro ao criar a 3ª cobrança)         | remover as entidades já criadas na árvore (rollback manual: itens→notas→cobranças→fatura, se criação) e propagar o erro (5xx/`RETRYABLE`) |
| 8   | `tipoFaturamento` fora do enum, ou `dataReferencia` inválida, ou `parceiroId` ≤ 0          | `422` (Zod, validação de schema)                                                                                   |
| 9   | um cliente ativo tem linhas cujo plano não existe ou preço zero                           | descartar as linhas inválidas do cliente; se o cliente ficar sem linhas, ele não entra no cálculo (caso 2 se todos ficarem) |
| 10  | o parceiro não define dia de vencimento                                                   | usar o dia de vencimento default (**dia 10**); calcular a data de vencimento sobre a `dataReferencia`   |
| 11  | a soma dos `valorTotal` das cobranças diverge do `valorTotal` da fatura além de 1 centavo | trata-se como erro interno de cálculo (não deveria ocorrer); falhar a preparação antes de persistir (`500` defensivo) |
| 12  | `via-parceiro` e `cofaturamento` produzem a mesma árvore para os mesmos dados             | aceito: cardinalidade idêntica hoje (ver Garantias); o valor de enum é preservado em `tipoFaturamento`              |
| 13  | o destinatário de uma nota não tem endereço completo no cadastro (logradouro, número, bairro, CEP, cidade ou UF ausente) | `422` antes de persistir (`Destinatário {nome} sem endereço completo para emissão da NFCom`) |

## Questões em aberto

- [ ] `via-parceiro` vs `cofaturamento`: **decidido manter separados** como valores de
      enum distintos — o negócio ainda não definiu a divergência, mas os tipos não
      devem ser fundidos. Cardinalidade idêntica hoje (caso 12); quando o negócio
      definir a divergência (ex.: `cofaturamento` particiona o total entre parceiro e
      AT+, ou gera nota adicional ao parceiro), atualizar a tabela de Garantias.
- [ ] Fluxo de **descarte/cancelamento de fatura** (necessário para o caso 5: fatura em
      `erro` exige descarte antes de re-preparar): fora do primeiro ciclo — SPEC
      futura (id a reservar), junto com o cancelamento de NFCom da SPEC-0001.

## Decisões fechadas nesta spec

- **Síncrona, não enfileirada**: a preparação executa na rota HTTP e retorna a árvore
  criada (`201`/`200`). Não cria job BullMQ — a emissão (SPEC-0001) é o fluxo
  assíncrono (ADR-0002). A resposta precisa dos IDs criados imediatamente.
- **Idempotência por chave natural**: `(parceiroId, dataReferencia)` é a chave de
  dedup — `tipoFaturamento` **não** faz parte da chave: um re-POST com tipo diferente
  numa fatura ainda não emitida **troca o tipo** (remove + recria a árvore conforme o
  novo tipo). Re-preparo de fatura emitida/emissão é **recusado** (`409`). Consistente
  com o rigor de ADR-0003 (sem duplicação por re-POST), sem usar o store de
  idempotência de emissão (que é para boleto/nota, não para criação de domínio).
- **Persistência direta com rollback manual** (desvio explícito de ADR-0003): a
  preparação escreve a árvore **diretamente** no Atacado, com rollback manual em
  falha — **não** via outbox. O outbox (ADR-0003) é para *atualizações de estado de
  emissão*; a criação da árvore é *domínio* e a resposta `201` precisa dos IDs criados
  agora. A idempotência por chave natural cobre o replay por crash (re-POST encontra a
  fatura `a-emitir` e atualiza).
- **Unidade monetária**: centavos inteiros no domínio (ADR-0004); número em unidade
  real (formato dos tipos gerados) só existe no módulo Atacado, convertido na
  fronteira com arredondamento determinístico.
- **Cardinalidade por tipo**: tabela de Garantias é a regra canônica — o cálculo do
  plano de cobranças deriva dela. `via-parceiro` e `cofaturamento` permanecem enums
  distintos (podem divergir no futuro), com cardinalidade idêntica por enquanto.
- **Fatura em `erro` exige descarte**: não há re-preparo de fatura que entrou na
  emissão e falhou por completo — o caminho de correção é descartar a fatura e
  preparar outra (fluxo de descarte é SPEC futura; casos 5).
- **Rollback da atualização é best-effort**: na recriação da árvore (caso 6), se a
  remoção da árvore antiga falhar parcialmente, o sistema registra o erro em log
  (pino) e prossegue com a recriação — resíduos da árvore antiga são órfãos sem IDs
  externos (a fatura ainda não entrou na emissão), inócuos à emissão. O rollback da
  **criação** (caso 7) permanece estrito: falha na criação aborta e remove tudo.
- **Dia de vencimento default = 10**: constante de domínio `DIA_VENCIMENTO_DEFAULT`
  (dia 10 do mês da `dataReferencia`).
- **Defaults fiscais via ambiente**: CFOP/cClass default e alíquota de ICMS por estado
  vêm de variáveis de ambiente (`FISCAL_CFOP_DEFAULT`, `FISCAL_CCLASS_DEFAULT`,
  `FISCAL_ICMS_ALIQUOTA`, em env validada por Zod — ADR-0005), não hardcoded. Valores
  provisórios até revisão com o contador (Revisão humana); a preparação aplica os
  defaults aos itens no momento do cálculo.
- **Endereço do destinatário**: a preparação persiste o endereço completo do
  destinatário na nota (`f_endereco`, `f_endereco_numero`, `f_bairro`, `f_cep`,
  `f_cidade`, `f_uf`), lido do cadastro no Atacado — a SPEC-0001 não preenche
  endereço no payload, apenas reusa o que está na nota. Destinatário sem endereço
  completo → `422` (caso 13).
- **Disparo é externo**: não há scheduler interno — a preparação é disparada por
  chamada à API (operador ou sistema do AT+). Agendamento mensal, se um dia for
  exigido, é SPEC/ADR futuros.
- **Fuso horário**: datas puras (`YYYY-MM-DD`) computadas em `America/Sao_Paulo`
  (decisão canônica em CONVENTIONS.md).

## Definition of Done

```bash
bun run typecheck                 # exit 0
# cada caso de borda tem teste nomeado que o exercita:
bun run test test/preparation      # casos 1-13 — N/N verdes
# a cardinalidade por TipoFaturamento é exercida por tipo:
# (um teste por tipo: parceiro/via-parceiro/cofaturamento/cliente-final)
# valores monetários no domínio são centavos inteiros (ADR-0004) — número em unidade
# real não vaza do módulo Atacado (conversão só no translator):
test -d src/preparation && (grep -rn "100\b" src/preparation/ --include='*.ts' \
  | grep -iE "valor|total|pre[çc]o|price|cents|centavos" | grep -v ".test." \
  | grep -v "translat" && exit 1 || true)
# o documento do devedor/destinatário é validado (dígito) antes de persistir
# (ADR-0004 pipeline, caso 4):
test -d src/preparation && (grep -rn "createFatura\|createCobranca\|createNFCom\|create " \
  src/preparation/ --include='*.ts' | grep -v "valid\|document\|cpf\|cnpj" \
  | grep -v ".test." && exit 1 || true)
# nenhuma preparação enfileira job de emissão (a emissão é SPEC-0001, disparada à parte):
test -d src/preparation && (grep -rn "queue.add\|\.add(" src/preparation/ \
  --include='*.ts' | grep -iE "emit|fatura" | grep -v ".test." && exit 1 || true)
```

Casos de borda exercitados (cada um com teste referenciado): 1, 2, 3, 4 (validação
pré-persistência: `test/preparation/validation.test.ts`); 5, 6 (idempotência
upsert/409: `test/preparation/upsert.test.ts`); 7 (rollback:
`test/preparation/rollback.test.ts`); 8 (schema: `test/preparation/schema.test.ts`);
9, 10 (linhas inválidas / vencimento default: `test/preparation/calculation.test.ts`);
11 (consistência do total); 12 (via-parceiro ≡ cofaturamento:
`test/preparation/billing-plan.test.ts`); 13 (endereço incompleto:
`test/preparation/validation.test.ts`). Os caminhos de teste são a convenção alvo;
ausência do `src/` antes da implementação não invalida o `status: draft`.

## Revisão humana

- Divergência `via-parceiro` vs `cofaturamento` — quando o negócio definir, atualizar
  a tabela de Garantias (enums já mantidos separados).
- Valores das envs fiscais (`FISCAL_CFOP_DEFAULT`, `FISCAL_CCLASS_DEFAULT`,
  `FISCAL_ICMS_ALIQUOTA`) — confirmar com contador antes de produzir (herda
  SPEC-0001); o mecanismo (env) já está decidido.
- Volume: para parceiros com centenas de clientes, a criação síncrona da árvore
  pode ser lenta. Avaliar se a resposta 201 sob timeout HTTP (ex.: 30s) é suficiente,
  ou se a preparação precisa virar assíncrona no futuro (caso 1 do AskUserQuestion
  — reabrir se necessário).

## Verificação

```text
(preencher no fechamento)
```
