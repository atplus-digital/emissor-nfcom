<!-- Managed by agent: keep sections and order; edit content, not structure. Last updated: 2026-08-19 -->
<!-- Parent: ../../AGENTS.md -->

# AGENTS.md — scripts/nocobase/src

## Overview

Kernel compartilhado do framework de geração de código: lifecycle (lock → pipeline → diff → validar → swap), I/O atômico, HTTP, validação e CLI. Agnóstico de pipeline — nada aqui conhece `generate-types`; pipelines em `../pipelines/` dependem do kernel, nunca o contrário.

<!-- AGENTS-GENERATED:START structure -->

## Structure

```
src/
├── types.ts                  # TaskRunner (alias Listr2 TaskWrapper)
├── cli/
│   ├── cli-output.ts         # stderr helpers (erros, avisos)
│   ├── flags.ts              # flags de runtime do CLI (--skip-validate, --diff-debug)
│   ├── format-error.ts       # formatErrorMessage(unknown)
│   └── listr-config.ts       # Listr2 renderer options compartilhados
├── http/
│   ├── http-client.ts        # fetchJsonWithAuth genérico (auth + timeout)
│   └── nocobase-client.ts    # NocoBaseApiClient (fetchCollections por datasource)
├── io/
│   ├── atomic-writer.ts      # computeDiff, swapTempToOutput, cleanupTempSessionDir, runValidation
│   ├── diff-debug.ts         # diff unificado temp vs output (--diff-debug)
│   └── locker.ts             # Workspace lock/unlock
├── lifecycle/
│   ├── lifecycle.ts          # runStandardPipeline (orquestração padrão)
│   └── lifecycle-tasks.ts    # tasks Listr2: diff, validar, swap, resumo
├── pipeline/
│   ├── context.ts            # PipelineExecutionContext { tempDir, outputDirs, pipelineContext }
│   ├── types.ts              # GeneratorPipeline (definição de pipeline)
│   └── runner.ts             # runPipelineStages
├── utils/
│   ├── args.ts               # parseCliArgs / resolveCliArgv (flags fixas)
│   ├── env.ts                # env Zod (NOCOBASE_API_URL/KEY/APP)
│   └── strings.ts            # jsonToSingleQuotedString
└── validation/
    ├── tsc-validator.ts      # validação tsc (TS7 nativo via CLI, cache incremental)
    └── linter-runner.ts      # biome --write nos dirs de saída
```

<!-- AGENTS-GENERATED:END structure -->

<!-- AGENTS-GENERATED:START conventions -->

## Conventions

- **Nenhum barrel**: importe direto do arquivo (ex.: `@generators/io/locker`)
- **No Logger**: Listr2 `task` é a única saída do orquestrador
- **Dependência unidirecional**: `src/` ← `pipelines/`, nunca o contrário
- **Mensagens em português**: todas as strings voltadas ao usuário
- **Flags de runtime em `cli/flags.ts`**: setters no entry (`../index.ts`), getters no kernel
- **`pipelineContext` é `unknown` no kernel**: cada pipeline define o próprio tipo e faz o cast na fronteira do stage

<!-- AGENTS-GENERATED:END conventions -->

<!-- AGENTS-GENERATED:START key-patterns -->

## Key Patterns

| For                       | Reference                                  |
| ------------------------- | ------------------------------------------ |
| CLI stderr / Listr config | `src/cli/`                                 |
| Flags de runtime          | `src/cli/flags.ts`                         |
| Pipeline lifecycle        | `src/lifecycle/lifecycle.ts`               |
| Pipeline context type     | `src/pipeline/context.ts`                  |
| Definição de pipeline     | `src/pipeline/types.ts` (GeneratorPipeline)|
| Atomic write to .temp/    | `src/io/atomic-writer.ts`                  |
| Workspace lock            | `src/io/locker.ts`                         |
| NocoBase API calls        | `src/http/nocobase-client.ts`              |
| Parse de flags CLI        | `src/utils/args.ts`                        |

<!-- AGENTS-GENERATED:END key-patterns -->
