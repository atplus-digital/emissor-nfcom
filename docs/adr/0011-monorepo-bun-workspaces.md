---
status: accepted
date: 2026-08-19
builds-on: [ADR-0007, ADR-0005, ADR-0006]
superseded-by: null
deciders: [gugacarbo]
---

# Monorepo Bun Workspaces: apps/backend, apps/viewer, packages/db, packages/generated

## Contexto e problema

O repo cresceu além do app: o frontend de visualização (`viewer/`) virou um
projeto React/Vite autônomo e `src/` acumula código de natureza diferente —
o schema/repositórios do DB de coordenação (`src/lib/db/`, ADR-0003/0007) e o
output do gerador de tipos (`src/generated/`, ADR-0006/0010) não são "backend",
são artefatos reutilizáveis. Mantê-los sob `src/` força a resolução por alias
`#/*` de tudo e impede que outro app (ex.: o próprio viewer) reutilize esses
artefatos sem acoplar ao backend.

## Direcionadores da decisão

- **Reuso**: `packages/db` (schema + repositórios do SQLite de coordenação) e
  `packages/generated` (types do NocoBase/IXC) são candidatos a consumo por
  outros apps do monorepo — devem ser pacotes com fronteira de dependência.
- **Frontend autônomo**: `viewer/` nunca importou do `src/` do backend (só o
  contrato HTTP de `/painel`); o move é de contêiner, não de acoplamento.
- **Custo de mudança**: o alias `#/*` (package.json `imports` + tsconfig
  `paths`) é a única costura — o restante é path constante em config/docs.
- **CI/DoD inalterados**: `bun test` na raiz já descobre testes em
  subdiretórios e lê `bunfig.toml` do cwd — o gate de cobertura de 95% por
  arquivo não precisa mudar de lugar.

## Opções consideradas

### Opção 1 — Workspaces com pacotes reais

`apps/*` + `packages/*` no `workspaces` do package.json raiz; `@emissor/db` e
`@emissor/generated` com `package.json` próprio; imports reescritos
(`#/lib/db/*` → `@emissor/db/*`).

**Prós:** fronteira de dependência real (o backend declara `@emissor/db`);
qualquer app do monorepo consome o pacote; hoisting mantém o bundle do
backend autocontido.
**Contras:** ~70 imports reescritos; 4 manifests novos; Dockerfile passa a
copiar manifests dos workspaces.

### Opção 2 — Só mover pastas, sem pacotes

`src/lib/db` e `src/generated` viram pastas em `packages/` resolvidas via
alias `#/`.

**Prós:** diff mínimo.
**Contras:** alias aponta para fora do app (dissonância); sem fronteira de
dependência; "packages/" vira só convenção de pasta.

## Decisão

**Opção 1.** O repo vira monorepo bun workspaces com layout:

```
apps/backend      — o app (Hono + workers); src/ e test/ de antes
apps/viewer       — frontend do painel (Vite + React), tsconfig próprio
packages/db       — @emissor/db: client/schema/idempotency/lease/outbox (ADR-0003)
packages/generated — @emissor/generated: output do gerador (ADR-0006/0010)
```

Regras que passam a valer:

- O alias `#/*` existe em **dois** package.json: raiz (aponta para
  `./apps/backend/src/*`, serve `scripts/`) e `apps/backend` (aponta para
  `./src/*`, serve o app). Subpath imports `#` resolvem pelo package.json mais
  próximo do arquivo importador.
- `packages/db` consome `DATABASE_URL` direto de `process.env` (default
  `./data/emissor.db`, espelhando o zod de `apps/backend/src/env.ts`) — é a
  única exceção à regra do env além dos scripts de tooling (ver
  CONVENTIONS.md). O pacote não importa nada do backend.
- `@emissor/db` exporta as fontes `.ts` via `exports` (bun runtime, `bun build`
  e tsc bundler resolvem direto no source; hoisting em `node_modules` da raiz
  preserva o bundle sem `--external`).
- O output do gerador passa a ser `packages/generated/types/<datasource>/`
  (pipeline do `scripts/nocobase` + `outputDirs` + pattern do locker +
  `coveragePathIgnorePatterns` do bunfig + `.vscode/settings.json` apontam
  para lá).
- `drizzle/` (migrations) e `drizzle.config.ts` ficam na raiz; o config aponta
  para `packages/db/src/schema.ts`. Migrations aplicadas no boot seguem via
  `bunx drizzle-kit migrate` (Dockerfile) / `migrate()` no index.
- `bunfig.toml` e os scripts `test*` ficam na raiz — `bun test` descobre
  `apps/backend/test/**` e `scripts/nocobase/**` a partir do cwd raiz.
- A prosa `src/...` nas ADRs anteriores (0003–0010) é **histórica**: descreve
  o layout da época; os caminhos atuais são os acima.

## Consequências

- Positivas: pacotes com fronteira de dependência; viewer e backend instalados
  por um único `bun install`/lockfile; o gerador e o DB saem do caminho do
  bundle sem mudar seus consumidores.
- Negativas/obrigatórias: imagem Docker copia os manifests dos 4 workspaces
  (o `--frozen-lockfile` falha sem eles); `packages/db` não pode importar do
  backend (regra de dependência: pacotes → apps, nunca o contrário); novo
  arquivo em `apps/backend/src/**` continua nascendo a 0% no gate de
  cobertura (regra antiga, caminho novo).

## Confirmação

```bash
# nenhum import legado do db antigo
git grep -n '#/lib/db' && exit 1
# pacotes resolvidos como workspace
test -e node_modules/@emissor/db -o -e apps/backend/node_modules/@emissor/db
# gerador e gate apontam para o novo output
grep -q 'packages/generated' bunfig.toml && grep -q 'packages/generated' .vscode/settings.json
# DoD intacto: typecheck, test, test:coverage (Redis local), build
```

## Notas

- O ADR-0007 (estrutura de pastas) vale para `apps/backend` — a hierarquia de
  camadas (`domain`/`modules`/`http`/`workers`/`lib`) não muda, muda o
  contêiner. `src/generated/` "permanece onde está" (ADR-0006) passa a ser
  `packages/generated/`.
- `viewer/.env` (cópia defasada do env do backend, gitignored) foi removido no
  move; o env único continua sendo o `.env` da raiz.
- Commits de renomeio preservam a história (`git mv`).
