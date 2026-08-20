<!-- Managed by agent: keep sections and order; edit content, not structure. Last updated: 2026-08-19 -->
<!-- Parent: ../../AGENTS.md -->

# AGENTS.md — pipelines/generate-types

## Overview

NocoBase + IXC type generation pipeline — fetches collection schemas from both datasources, builds TypeScript interfaces, generates `.ts` source files, and writes validated output to `packages/generated/types/`. Registrada no kernel como `GeneratorPipeline` (`flag: --types`, roda por padrão).

<!-- AGENTS-GENERATED:START structure -->

## Structure

```
generate-types/
├── index.ts              # Barrel: exporta generateTypesPipeline
├── pipeline.ts           # generateTypesPipeline (GeneratorPipeline) + fan-out por datasource
├── @types/
│   ├── generation.ts          # Tipos do resultado da geração (GeneratedTypes, EnumOption, …)
│   ├── script-config.ts       # DataSourceGenerationConfig (config por datasource)
│   ├── script-data-source.ts  # DataSourceCollection / DataSourceField (shapes da API)
│   └── script.ts              # Re-export dos types acima
├── stages/
│   ├── fetch-schemas.ts       # Stage 1: GET /api/dataSources/{key}/collections:list
│   ├── build-types.ts         # Stage 2: split de collections (pasta própria por collection)
│   ├── generate-content.ts    # Stage 3: chama os módulos de content/
│   └── write-files.ts         # Stage 4: escreve em .temp/ via atomic-writer
├── content/
│   ├── enums.ts               # Enum type generation (from uiSchema.enum)
│   ├── interfaces.ts          # Interface generation
│   ├── sorting.ts             # Sort utilities for generated content
│   ├── assembly.ts            # File assembly (header, merge, relation schemas)
│   ├── collections-index.ts   # generateCollectionsFile (collections.ts)
│   ├── split-index.ts         # generateIndexWithAllExportsWithPaths (index.ts raiz)
│   ├── import-injector.ts     # Import injection logic
│   ├── field-mapper.ts        # Field mapping + type resolution
│   └── relations.ts           # Relation type resolution
├── utils/
│   ├── naming.ts              # Naming conventions (toValidIdentifier, strip*Prefix, toFileName, …)
│   ├── output-folder.ts       # toDataSourceOutputFolder (main → nocobase)
│   └── resolve-label.ts       # Rótulos PT: collection.title / uiSchema.title → label
└── test/                     # Testes da pipeline (helpers, stages, generation, utils)

Cada `{collection}/schemas.ts` exporta `TABLE_NAME` (slug) e `TABLE_LABEL` (título NocoBase).
Importe com alias quando usar várias collections no mesmo arquivo: `import { TABLE_NAME as X_TABLE } from "…/schemas"`.
```

<!-- AGENTS-GENERATED:END structure -->

<!-- AGENTS-GENERATED:START stages -->

## Pipeline Stages

| Stage | File                  | Description                                                                                                                                     |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `fetch-schemas.ts`    | Fetches all collections from datasource via single endpoint, extracts enums from `uiSchema.enum`, extracts relations from `belongsTo`/`hasMany` |
| 2     | `build-types.ts`      | Splits collections into per-collection folders (`splitCollections`), propagando nomes reais da API                                              |
| 3     | `generate-content.ts` | Generates `.ts` source code per collection via `content/` modules                                                                               |
| 4     | `write-files.ts`      | Writes all files to `.temp/` (never directly to outputDir)                                                                                      |

O contexto do pipeline (`GenerateTypesPipelineCtx`, em `stages/fetch-schemas.ts`) é construído pelo orquestrador em `pipeline.ts` (`client`, `dataSource`, `relations = dataSource.relationsMapping ?? {}`) e propagado entre stages por spread — campos de saída de cada stage são opcionais.

<!-- AGENTS-GENERATED:END stages -->

<!-- AGENTS-GENERATED:START datasources -->

## Datasources

| Name        | DataSource key   | Output Dir                           | Collections                          |
| ----------- | ---------------- | ------------------------------------ | ------------------------------------ |
| `nocobase`  | `main`           | `packages/generated/types/nocobase/`     | subset configurado em `config/datasources.ts` |
| `ixc`       | `d_db_ixcsoft`   | `packages/generated/types/d_db_ixcsoft/` | subset configurado em `config/datasources.ts` |

<!-- AGENTS-GENERATED:END datasources -->
