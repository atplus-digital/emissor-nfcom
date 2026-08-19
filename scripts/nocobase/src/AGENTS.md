<!-- Managed by agent: keep sections and order; edit content, not structure. Last updated: 2026-08-19 -->
<!-- Parent: ../../AGENTS.md -->

# AGENTS.md — scripts/nocobase/src

## Overview

Shared library layer for the code generation framework — utilities, pipeline lifecycle, I/O, and CLI runner. Used by the `generate-types` pipeline.

<!-- AGENTS-GENERATED:START structure -->

## Structure

```
src/
├── index.ts                  # Main entry: runOrchestrator
├── generator-registry.ts     # Pipeline registry
├── http/                     # HTTP client + NocoBase API client
├── utils/                    # Environment utilities
├── types.ts                  # Shared Listr2 task types
├── lib/
│   ├── types.ts              # Shared CLI types (no Logger)
│   ├── io/
│   │   ├── atomic-writer.ts  # computeDiff, swapTempToOutput, removeDir, runValidation
│   │   └── locker.ts         # Workspace lock/unlock (merged from 4 old files)
│   ├── lifecycle/
│   │   ├── lifecycle.ts      # runStandardPipeline orchestration
│   │   └── lifecycle-tasks.ts # Listr2 task wrappers
│   ├── pipeline/
│   │   ├── context.ts        # PipelineExecutionContext<TRuntime, TPipeline>
│   │   ├── runner.ts         # runPipelineStages, createOrchestrationRunner
│   │   ├── orchestrator.ts   # Orchestrator runner
│   │   └── create-script-definition.ts # Script definition factory
│   ├── cli/
│   │   ├── cli-output.ts     # stderr helpers (erros, avisos)
│   │   ├── format-error.ts   # formatErrorMessage(unknown)
│   │   └── listr-config.ts   # Listr2 renderer options compartilhados
│   ├── utils/
│   │   ├── args.ts           # CLI argument parser
│   │   ├── path-utils.ts     # Path utilities
│   │   └── strings.ts        # String utilities
│   └── validation/
│       ├── tsc-validator.ts  # TypeScript validation
│       └── linter-runner.ts  # Biome linter runner
└── pipelines/
    └── generate-types/       # NocoBase + IXC type generation
```

<!-- AGENTS-GENERATED:END structure -->

<!-- AGENTS-GENERATED:START conventions -->

## Conventions

- **No barrel exports in lib**: Import directly from specific files (e.g., `#/lib/io/locker`)
- **No Logger**: Listr2 `task` replaces Logger for output
- **One-way dependency**: `lib/` ← pipelines, never reverse
- **Portuguese messages**: All user-facing strings in Portuguese
- **No adapter code**: Enum inference from `uiSchema.enum` only — no IXC wiki adapters or data inference

<!-- AGENTS-GENERATED:END conventions -->

<!-- AGENTS-GENERATED:START key-patterns -->

## Key Patterns

| For                       | Reference                                  |
| ------------------------- | ------------------------------------------ |
| CLI stderr / Listr config | `src/lib/cli/`                             |
| Pipeline lifecycle        | `src/lib/lifecycle/lifecycle.ts`           |
| Pipeline context type     | `src/lib/pipeline/context.ts`              |
| Atomic write to .temp/    | `src/lib/io/atomic-writer.ts`              |
| Workspace lock            | `src/lib/io/locker.ts`                     |
| NocoBase API calls        | `src/http/nocobase-client.ts`              |
| Generate types pipeline   | `src/pipelines/generate-types/pipeline.ts` |

<!-- AGENTS-GENERATED:END key-patterns -->
