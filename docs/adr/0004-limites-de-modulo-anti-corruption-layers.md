---
status: accepted
date: 2026-08-13
builds-on: [ADR-0001, ADR-0003]
superseded-by: null
deciders: [gugacarbo]
---

# Limites de módulo como anti-corruption layers para cada integração externa

## Contexto e problema

O app integra três sistemas externos com contratos distintos e instáveis:

- **Atacado** (NocoBase/AT+): API REST com convenções específicas (ação como sufixo de
  rota `:get`/`:list`/`:create`, `filterByTk`, `appends` na query, destroy via POST,
  FKs enviadas duplicadas em creates aninhados, campos com nome de hash como
  `f_c8flsp9105w`, monetários como string com vírgula, paginação fake `pageSize: 9999`).
- **Asaas**: API v3, header `access_token`, resposta com `errors[]`, cobranças sempre
  `billingType: BOLETO`.
- **NFCom** (`api.nfcom.com.br`, [swagger](https://api.nfcom.com.br/swagger/index.html)):
  auth `login`/`senha` (`POST /api/auth`, bearer TTL 12h), `situacao` como string
  (uppercase no swagger — `AUTORIZADA`/`CANCELADA` confirmados; `PROCESSANDO`/
  `REJEITADA` TBC em runtime) — a ACL **normaliza case** ao traduzir para o domínio,
  campos snake/mistos.

Sem uma fronteira clara, esses contratos tendem a vazar para o domínio: tipos do provedor
NFCom circulam fora do módulo, repositórios expõem `Record<string, unknown>` e
`T | null | undefined`, e a tipagem frouxa faz o backend externo mudar e o app falhar
silenciosamente (`undefined`). É o "mal feito": o domínio acoplado aos caprichos de três
APIs externas.

## Direcionadores da decisão

- **Isolamento de mudança**: o Atacado renomear uma coluna, ou trocar de provedor NFCom
  (ADR-0001), deve ser uma alteração localizada — não uma mudança transversal.
- **Type-safety real**: o domínio opera sobre tipos próprios, determinísticos; nada de
  `any`, `as`, `Record<string, unknown>`.
- **Conversão na fronteira**: formatos externos (string monetária com vírgula, CPF/CNPJ
  mascarado, envelopes) são normalizados ao entrar.
- **Testabilidade**: cada ACL é testável isoladamente com seu contrato externo.

## Opções consideradas

### Opção 1 — Um módulo ACL por integração, com tipos de domínio próprios

Três módulos — `modules/atacado`, `modules/asaas`, `modules/nfcom` — cada um composto por:

- **cliente externo** (HTTP puro do contrato real do provedor);
- **tradutor** (mapper bidirecional: tipos externos ↔ tipos de domínio próprios);
- **porta de domínio** (interface que o resto do app consome, em termos de domínio).

O domínio (`domain/`, `workers/`, `lib/db/`) só conhece as portas, nunca os tipos externos.

**Prós:**

- Mudança externa isolada no módulo; troca de provedor é local (ADR-0001).
- Type-safety ponta-a-ponta no domínio.
- Ponto único de normalização (monetário, documentos, envelopes).

**Contras:**

- Mais código (mappers, interfaces) que uma passagem direta.
- Disciplina de não importar tipos externos fora do módulo (lintável).

### Opção 2 — Tipos externos compartilhados, validados por schema no uso

Importar os tipos do provedor, validar com Zod na fronteira de uso.

**Prós:**

- Menos código de mapper.

**Contras:**

- Acoplamento direto: mudança de contrato do provedor ainda atravessa o app.
- Tipos do provedor viram "domínio" — acoplamento direto ao contrato externo.

### Opção 3 — Repository genérico (um `ExternalApiRepository<T>`)

Um repositório genérico tipado cobrindo os três.

**Prós:**

- Reutilização.

**Contras:**

- Esconde diferenças reais dos contratos (envelopes, auth, paginação); gera abstrações
  furadas (ex.: retornos `T | null | undefined` que mascaram falhas).

## Decisão

**Um módulo anti-corruption layer por integração (Opção 1).** Cada módulo
(`atacado`, `asaas`, `nfcom`) expõe uma **porta de domínio** em termos próprios e esconde
o contrato externo. Os tipos de domínio vivem num núcleo compartilhado
(`src/domain`), agnóstico a provedor.

Estrutura de cada módulo:

```
src/modules/<integration>/
  client/         # contratos e chamadas HTTP do provedor (brutos)
  translators/    # external ↔ domain
  <integration>.repository.ts   # implementa a porta de domínio
```

O domínio declara portas (interfaces); os módulos as implementam. A composição (wiring)
faz a ligação.

**Representação monetária no domínio (canônica)**: valores monetários são **centavos
inteiros** (`number`, ex.: `12345` = R$ 123,45). Os tipos gerados do Atacado
(ADR-0006) tipam os campos monetários como `number` (unidade real, ex.: `123.45`,
não string com vírgula) — a fronteira do módulo Atacado converte esse número em
centavos inteiros ao entrar no domínio (e de volta em número ao sair), com
arredondamento explícito e determinístico (`Math.round(valor * 100)`). Isso elimina
erros de ponto flutuante nos cálculos de fatura e mantém a aritmética exata em todo o
domínio. Esta é a **decisão canônica** sobre representação monetária — referenciada
por SPEC-0001/SPEC-0002; mudá-la exige novo ADR que a supersede.

**Pipeline de documentos (CPF/CNPJ)**: a normalização de documentos vive na fronteira do
módulo Atacado (translator), numa pipeline determinística: **desmascarar** (remover
`/\D/`) → **validar dígito verificador** (CPF/CNPJ) → **normalizar** para o tipo de domínio
(sempre dígitos, sem máscara) → **formatar** no payload do gateway NFCom conforme o provedor
exigir. A validação de dígito (SPEC-0001 caso 8) é feita **antes** de chamar o Asaas, sobre
o valor já desmascarado; documento mascarado vindo do Atacado é desmascarado primeiro.
Implementação em `modules/atacado/translators/` (ou helper de domínio compartilhado se
reusado fora do módulo); nunca inline nas rotas.

**Enums de status (fatura/cobrança/nota) são slugs no CRM**: os campos `f_status`
(fatura e cobrança) e `f_status_interno` (nota) do Atacado armazenam **slugs**
(`a-emitir`, `emitida`, `parcial`, `erro`, `pago`, `cancelada`...) — as labels humanas
("A Emitir", "Fatura e NF Emitida") são **apenas exibição** no NocoBase, não o valor
persistido. O domínio e o CRM falam a mesma língua (slug); o tradutor **não converte
status** — qualquer label vista num dump do CRM é apresentação, não dado de domínio.
Atenção ao validar os tipos gerados (ADR-0006): o `z.enum` carrega os **valores**
(slugs); as labels aparecem só na mensagem de erro / mapa de labels.

## Consequências

**Positivas:**

- Trocar provedor NFCom ou migrar Atacado/Asaas é local ao módulo.
- O domínio é 100% type-safe, sem `any`/`as`/`Record<string,unknown>`.
- Normalização centralizada (monetário string→number, documentos, datas).

**Negativas:**

- Overhead de mappers/interfaces (aceitável pelo isolamento).
- Exige convenção enforced por lint: tipos externos não saem do módulo.

**Obrigatório a partir de agora:**

- `src/domain/` não importa nada de `src/modules/*` (dependência unidirecional).
- Tipos externos (do Atacado/Asaas/NFCom) não aparecem em `src/domain`, `src/workers`,
  `src/lib/db`, nem `src/http` — só tipos de domínio.
- Valores monetários do domínio são sempre **centavos inteiros** (`number`); número em
  unidade real só existe no módulo Atacado, convertido na fronteira
  (número↔centavos, arredondamento determinístico).

## Confirmação

```bash
# O domínio não importa nada dos módulos de integração.
test -d src/domain && (grep -rn "from.*modules/atacado\|from.*modules/asaas\|from.*modules/nfcom" src/domain/ && exit 1 || true)
# Nada de any/as/Record<string,unknown> fora dos módulos externos (tolerância só em translators).
test -d src && (grep -rn ": any\|as any\|Record<string, unknown>" src/ --include='*.ts' \
  | grep -v "src/modules/" | grep -v ".test." && exit 1 || true)
```

## Notas

- **Estratégia de teste das ACLs**: cada módulo é testado contra **fixtures capturadas**
  dos provedores (sandbox/homologação) — requisições/respostas reais congeladas em
  arquivos versionados no repo, com fetch mockado fazendo replay. Garante que o
  contrato simulado bate no real (divergência aparece na próxima captura), sem
  chamadas de rede no teste.
- Os tipos de domínio podem ser **gerados** do NocoBase (já existe `scripts/nocobase/`
  gerando tipos), mas consumidos apenas dentro de `modules/atacado/translators/` e
  traduzidos para tipos de domínio — nunca importados diretamente pelo resto do app.
  A regra impeditiva que governa `src/generated/` (sempre gerados, nunca editados à
  mão) é o ADR-0006.
- Centavos inteiros (não decimal `number`): o cálculo de fatura é sensível a arredondamento
  e a representação em centavos evita a classe inteira de erros de float. Conversões
  número↔centavos (unidade real do CRM ↔ centavos do domínio) vivem no translator do
  Atacado, isoladas.
- Histórico: a premissa original era monetário como string com vírgula (`"123,45"`);
  os tipos gerados do NocoBase mostram `number` (unidade real). A conversão na
  fronteira permanece obrigatória — só mudou o formato de origem.
