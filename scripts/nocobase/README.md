# Geradores de código

Scripts que buscam schemas e metadados no **NocoBase** (e datasource IXC) e geram artefatos TypeScript em `packages/generated/`. O frontend importa esses arquivos — **não edite `packages/generated/` manualmente**.

Documentação técnica detalhada (kernel, pipelines, convenções para agentes): [`src/AGENTS.md`](src/AGENTS.md) e [`pipelines/generate-types/AGENTS.md`](pipelines/generate-types/AGENTS.md).

## Pré-requisitos

Credenciais do NocoBase para os scripts (distintas das `VITE_*` do build do app). O script lê a `.env` da raiz do repositório:

```bash
NOCOBASE_API_URL=https://seu-nocobase.com/api
NOCOBASE_API_KEY=seu-token-admin
```

Opcional: `NOCOBASE_APP=<app>` para enviar o header `X-App` (necessário quando a API exige multi-app, ex.: `a_atacado`). `VITE_LOG_LEVEL=debug` para stack trace em falhas. Timeout fixo de 15s.

## Comandos

| Comando              | O que gera                                                          |
| -------------------- | ------------------------------------------------------------------- |
| `bun run generate:types` | Tipos e labels das collections → `packages/generated/types/`      |

Flags aceitas (todas combináveis):

```bash
bun run generate:types --types          # só a pipeline de tipos (padrão quando nenhuma flag de pipeline é passada)
bun run generate:types --all            # todas as pipelines explicitamente
bun run generate:types --concurrent     # execução paralela das pipelines
bun run generate:types --skip-validate  # pula validação tsc + biome da saída (não recomendado)
bun run generate:types --diff-debug     # escreve diff unificado temp vs output em .reports/generate-types/diff-debug.txt
```

`--diff-debug` é modo de diagnóstico: quando o pipeline reporta mudança entre gerações consecutivas com a mesma entrada, essa flag grava, para cada arquivo alterado, um diff unificado (`@@ ... @@`) apontando as linhas exatas que diferem. Útil para localizar não-determinismo na geração.

Testes e lint dos scripts: `bun run test`, `bunx biome check scripts/nocobase/src scripts/nocobase/pipelines`.

## Quando usar

| Situação                                            | Comando              | O que configurar antes                                           |
| --------------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| Campo, enum ou collection alterados no NocoBase/IXC | `bun run generate:types` | Se for collection nova no subset gerado: `config/datasources.ts` |

Após regenerar tipos, rode `bun run typecheck` (ou o subset de testes afetado) antes de comitar.

## O que a pipeline produz

### Tipos (`generate:types`)

- **Entrada:** schemas das datasources `main` (NocoBase) e `d_db_ixcsoft` (IXC).
- **Saída:** `packages/generated/types/nocobase/` e `packages/generated/types/d_db_ixcsoft/`.
- **Config:** [`config/datasources.ts`](config/datasources.ts) — collections incluídas, splits (pasta própria por collection), dependentes.
- **Uso no app:** interfaces (`Clientes`, `PlanosDeServico`, …), `*_LABELS`, `TABLE_NAME` / `TABLE_LABEL` em `schemas.ts`.

## Fluxo interno (resumo)

1. Bloqueia o workspace (lock) e busca schemas nas datasources (paralelo).
2. Gera arquivos em diretório temporário (`.temp/`).
3. Compara diff temp vs output vigente.
4. Valida a saída gerada (tsc + biome) e, se houve mudança, substitui `packages/generated/`.

## Regras

- **Não** comitar edições manuais em `packages/generated/`.
- **Sempre** alterar o config correspondente e rodar o gerador de novo.
- Tipos de collections devem ser importados de `#/generated/types/...`, nunca redefinidos no código da feature.
- Labels de enum devem vir dos `*_LABELS` gerados, não de mapas manuais.

## Estrutura

```
scripts/nocobase/
├── README.md                 # este arquivo
├── index.ts                  # entry CLI (`bun run generate:types`)
├── config/
│   └── datasources.ts        # datasources/collections da pipeline de tipos
├── src/                      # kernel compartilhado (nada de pipeline específica aqui)
│   ├── cli/                  # saída CLI, flags de runtime, config do listr
│   ├── http/                 # http-client genérico + NocoBaseApiClient
│   ├── io/                   # atomic writer/diff, locker, diff-debug
│   ├── lifecycle/            # lock → pipeline → diff → validar → swap
│   ├── pipeline/             # runner de estágios Listr2 (GeneratorPipeline)
│   ├── utils/                # args, env, strings
│   └── validation/           # tsc-validator, linter-runner (biome)
└── pipelines/
    └── generate-types/       # pipeline de geração de tipos (stages, content, utils, @types, test)
```
