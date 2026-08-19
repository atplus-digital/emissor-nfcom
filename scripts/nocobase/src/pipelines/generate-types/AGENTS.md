<!-- Managed by agent: keep sections and order; edit content, not structure. Last updated: 2026-08-19 -->
<!-- Parent: ../../AGENTS.md -->

# AGENTS.md — pipelines/generate-types

## Overview

NocoBase + IXC type generation pipeline — fetches collection schemas from both datasources, builds TypeScript interfaces, generates `.ts` source files, and writes validated output to `packages/generated/types/`.

<!-- AGENTS-GENERATED:START structure -->

## Structure

```
generate-types/
├── index.ts              # Entry: executeEntry(import.meta.url, createGenerateTypesTasks)
├── pipeline.ts           # createGenerateTypesTasks, runDatasourcePipeline
├── @types/
│   ├── generation.ts          # Generation result types
│   ├── script-config.ts       # Pipeline config types
│   ├── script-data-source.ts  # Datasource config types
│   └── script.ts              # Script context types
├── stages/
│   ├── fetch-schemas.ts       # Stage 1: GET /api/dataSources/{key}/collections:list
│   ├── build-types.ts         # Stage 2: merge build-types + split-collections
│   ├── generate-content.ts    # Stage 3: call content/ modules
│   └── write-files.ts         # Stage 4: write to .temp/ via atomic-writer
├── content/
│   ├── enums.ts               # Enum type generation (from uiSchema.enum)
│   ├── interfaces.ts          # Interface generation
│   ├── sorting.ts             # Sort utilities for generated content
│   ├── assembly.ts            # File assembly (header, merge, relation schemas)
│   ├── collections-index.ts   # Collections index file generation
│   ├── split-index.ts         # Split collection index generation
│   ├── import-injector.ts     # Import injection logic
│   ├── field-mapper.ts        # Field mapping + type resolution
│   ├── relations.ts           # Relation type generation
│   └── content.ts             # Main content generation orchestrator
└── utils/
    ├── naming.ts                    # Naming conventions for generated types
    └── resolve-collection-label.ts  # `collection.title` → `TABLE_LABEL`

Cada `{collection}/schemas.ts` exporta `TABLE_NAME` (slug) e `TABLE_LABEL` (título NocoBase).
Importe com alias quando usar várias collections no mesmo arquivo: `import { TABLE_NAME as X_TABLE } from "…/schemas"`.
```

<!-- AGENTS-GENERATED:END structure -->

<!-- AGENTS-GENERATED:START stages -->

## Pipeline Stages

| Stage | File                  | Description                                                                                                                                     |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `fetch-schemas.ts`    | Fetches all collections from datasource via single endpoint, extracts enums from `uiSchema.enum`, extracts relations from `belongsTo`/`hasMany` |
| 2     | `build-types.ts`      | Maps schemas → TS interfaces, applies split logic (e.g., `t_pessoas` → PF/PJ), builds relation types                                            |
| 3     | `generate-content.ts` | Generates `.ts` source code per collection via `content/` modules                                                                               |
| 4     | `write-files.ts`      | Writes all files to `.temp/` (never directly to outputDir)                                                                                      |

<!-- AGENTS-GENERATED:END stages -->

<!-- AGENTS-GENERATED:START datasources -->

## Datasources

| Key        | Output Dir                          | Collections                          |
| ---------- | ----------------------------------- | ------------------------------------ |
| `nocobase` | `packages/generated/types/nocobase/`     | ~118 collections (configured subset) |
| `ixc`      | `packages/generated/types/d_db_ixcsoft/` | ~881 collections (configured subset) |

<!-- AGENTS-GENERATED:END datasources -->
