---
status: proposed
date: 2026-08-14
builds-on: [ADR-0004, ADR-0002, ADR-0005]
superseded-by: null
deciders: [gugacarbo]
---

# Estrutura de pastas: camadas com domínio no centro

## Contexto e problema

ADR-0004 define os limites de módulo (uma ACL por integração: `atacado`, `asaas`,
`nfcom`) e cita pastas de domínio (`src/domain`, `src/workers`, `src/lib/db`)
sem fixar o layout completo. Antes do primeiro commit de código de
implementação, falta decidir **onde vive cada tipo de arquivo em `src/`** — rotas
HTTP, workers BullMQ, composição de dependências, infraestrutura compartilhada —
e a organização de `test/`, citada pelas DoDs das SPECs (`test/<dir>/`).

## Direcionadores da decisão

- **Dependência unidirecional** (ADR-0004): o domínio não importa nada dos
  módulos de integração; isso precisa ser visível na estrutura de pastas e
  lintável por path.
- **Dois modos de entrada, um processo** (ADR-0002): HTTP (Hono) e workers
  (BullMQ) no mesmo pod — camadas separadas para `http/` e `workers/` espelham
  essa dualidade sem duplicar domínio.
- **Composition root único**: o wiring (portas → repositories, filas → workers)
  deve ter um lugar óbvio, lêvel de cima a baixo.
- **Correlação teste↔código**: as DoDs das SPECs nomeiam testes por caso de
  borda em `test/<dir>/`; a estrutura de teste deve espelhar `src/`.

## Opções consideradas

### Opção 1 — Camadas: domain + modules + http + workers

`src/domain/` (regras de emissão, portas), `src/modules/<acl>/` (ADR-0004),
`src/http/` (rotas + middlewares Hono), `src/workers/` (jobs BullMQ), `src/lib/`
(logger, db, redis). Wiring em `src/index.ts`.

**Prós:** dependência unidirecional visível no `tree`; `http/` e `workers/`
são adaptadores simétricos que consomem o mesmo domínio; greps anti-import do
ADR-0004 viram paths simples (`src/domain` não importa `src/modules`).
**Contras:** mais pastas; arquivos de um fluxo (ex.: emissão) espalhados por
`domain/`, `workers/` e `modules/`.

### Opção 2 — Por feature

`src/faturas/`, `src/cobrancas/`, `src/notas/`, cada uma com handlers + workers
+ repositório; `src/modules/` mantém as ACLs.

**Prós:** tudo de um fluxo numa pasta; menos hierarquia.
**Contras:** mistura domínio com infraestrutura; o domínio da emissão atravessa
faturas/cobranças/notas (SPEC-0001) e não tem feature única; os greps
anti-import do ADR-0004 ficam diffusos (domínio espalhado por features).

## Decisão

**Layout em camadas com domínio no centro (Opção 1).**

```
src/
├── domain/                  # núcleo: sem dependência de modules/http/workers
│   ├── emissao/             # máquina de estados da emissão (SPEC-0001)
│   ├── fatura/              # agregado de fatura (SPEC-0002)
│   └── ports/               # interfaces que modules implementam (ADR-0004)
├── modules/                 # uma ACL por integração (ADR-0004)
│   ├── atacado/
│   │   ├── atacado.port.ts
│   │   ├── atacado.repository.ts
│   │   └── translators/
│   ├── asaas/
│   └── nfcom/
├── http/
│   ├── routes/              # POST /faturas/:id/emitir etc. (SPEC-0001/0002)
│   └── middlewares/          # api-key, request-log, error-handler
├── workers/                 # um arquivo por fila BullMQ (ADR-0002)
│   ├── emissao.worker.ts
│   ├── webhook.worker.ts
│   └── outbox.worker.ts
├── lib/                     # logger (ADR-0008), db (Drizzle), redis, outbox helper
├── env.ts                   # único ponto de acesso a process.env (CONVENTIONS)
└── index.ts                 # composition root: monta tudo e sobe o server+workers
```

- **`src/index.ts` é o composition root**: cria logger/db/redis, injeta portas
  nos repositories, registra rotas e workers, sobe Hono + workers no mesmo
  processo (ADR-0002). Sem container DI — wiring explícito num arquivo só.

- **`test/` espelha `src/`**: `test/http/`, `test/workers/`, `test/modules/
  <acl>/`, `test/domain/<agregado>/`. Um arquivo de teste por unidade em `src/`
  (`emissao.worker.ts` → `test/workers/emissao.worker.test.ts`). **Casos de borda de
  fluxo** (os enumerados nas SPECs, que atravessam camadas) ficam em `test/<fluxo>/`
  (`test/emission/`, `test/preparation/`, `test/webhook/` — alvo das DoDs das SPECs),
  mapeando o fluxo de domínio em vez do agregado.
- **Naming**: rotas `*.route.ts`, workers `*.worker.ts`, portas `*.port.ts`,
  repositórios `*.repository.ts`, translators em `modules/<acl>/translators/`.

## Consequências

**Positivas:**
- Regra de dependência do ADR-0004 vira assertion de path: `src/domain` não
  importa `src/modules` (grep no CI/DoD).
- Trocar Hono ou BullMQ, ou adicionar uma CLI, é tocar numa camada só.
- Onboarding: a estrutura conta a arquitetura sem ler os ADRs.

**Negativas:**
- Um fluxo de ponta a ponta exige navegar 3–4 pastas.
- Camada `http/` fina exige disciplina para lógica não vazar das rotas — regra:
  rota valida (Zod), chama domínio/porta, serializa; nada mais.

**Obrigatório/proibido:**
- `src/domain/` não importa `src/modules/`, `src/http/`, `src/workers/`.
- Tipos externos (Atacado/Asaas/NFCom) não cruzam a borda do módulo (ADR-0004).
- Novo job BullMQ = novo `*.worker.ts` em `src/workers/` + registro no
  composition root.

## Confirmação

```bash
# Domínio não importa módulos (regra central do ADR-0004, agora por path)
test -d src/domain && ! grep -rn "from.*modules/" src/domain/
# Rotas não importam repositories/SDKs externos direto — só domínio/portas/lib
test -d src/http && ! grep -rln "modules/atacado\|modules/asaas\|modules/nfcom" src/http/
# Toda rota declarada tem arquivo correspondente; todo worker registrado no index
grep -c "worker" src/index.ts
```

## Notas

- O `src/db/client.ts` do scaffold inicial foi removido (relocado para
  `src/lib/db/`, commit `29db738`); o schema/migrations de coordenação vivem em
  `src/lib/db/` (ADR-0003). `src/generated/` permanece onde está (ADR-0006).
- Diagrama de dependência aceito: `index.ts → {http, workers, modules, lib,
  domain}`, `http/workers → {domain, lib}`, `modules → {domain/ports, lib}`,
  `domain → ∅` (só tipos stdlib/Zod).
