# Geradores de código

Scripts que buscam schemas e metadados no **NocoBase** (e datasource IXC) e geram artefatos TypeScript em `packages/generated/`. O frontend importa esses arquivos — **não edite `packages/generated/` manualmente**.

Documentação técnica detalhada (pipelines, estágios, convenções para agentes): [`src/AGENTS.md`](src/AGENTS.md) e os `AGENTS.md` em cada pipeline em `src/pipelines/`.

## Pré-requisitos

Credenciais do NocoBase para os scripts (distintas das `VITE_*` do build do app). O script lê a `.env` da raiz do repositório:

```bash
NOCOBASE_API_URL=https://seu-nocobase.com/api
NOCOBASE_API_KEY=seu-token-admin
```

Opcional: `NOCOBASE_APP=<app>` para enviar o header `X-App` (necessário quando a API exige multi-app, ex.: `a_atacado`). `VITE_LOG_LEVEL=debug` para stack trace em falhas. Timeout fixo de 15s.

## Comandos

| Comando               | O que gera                                              |
| --------------------- | ------------------------------------------------------- |
| `pnpm generate`       | Todos os geradores padrão (types)                       |
| `pnpm generate:types` | Tipos e labels das collections → `packages/generated/types/` |

Flags diretas no orquestrador:

```bash
pnpm generate --types          # só tipos
pnpm generate --all            # todos explicitamente
pnpm generate --concurrent     # execução paralela
pnpm generate --diff-debug     # escreve diff unificado temp vs output em .reports/generate-types/diff-debug.txt
```

`--diff-debug` é modo de diagnóstico: quando o pipeline reporta mudança entre gerações consecutivas com a mesma entrada, essa flag grava, para cada arquivo alterado, um diff unificado (`@@ ... @@`) apontando as linhas exatas que diferem. Útil para localizar não-determinismo na geração.

Testes e lint dos scripts: `pnpm test:scripts`, `pnpm biome:scripts`.

## Quando usar

| Situação                                            | Comando               | O que configurar antes                                           |
| --------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Campo, enum ou collection alterados no NocoBase/IXC | `pnpm generate:types` | Se for collection nova no subset gerado: `config/datasources.ts` |

Após regenerar tipos, rode `pnpm typecheck` (ou o subset de testes afetado) antes de comitar.

## O que cada pipeline produz

### Tipos (`generate:types`)

- **Entrada:** schemas das datasources `main` (NocoBase) e `d_db_ixcsoft` (IXC).
- **Saída:** `packages/generated/types/nocobase/` e `packages/generated/types/d_db_ixcsoft/`.
- **Config:** [`config/datasources.ts`](config/datasources.ts) — collections incluídas, splits (ex.: `t_pessoas` → PF/PJ), dependentes.
- **Uso no app:** interfaces (`Pessoas`, `Cliente`, …), `*_LABELS`, `TABLE_NAME` / `TABLE_LABEL` em `schemas.ts`.

## Fluxo interno (resumo)

1. Busca dados no NocoBase (quando aplicável).
2. Gera arquivos em diretório temporário (`.temp/`).
3. Valida com TypeScript e Biome.
4. Compara diff; em sucesso, substitui `packages/generated/`.

## Regras

- **Não** comitar edições manuais em `packages/generated/`.
- **Sempre** alterar o config correspondente e rodar o gerador de novo.
- Tipos de collections devem ser importados de `#/generated/types/...`, nunca redefinidos no código da feature.
- Labels de enum devem vir dos `*_LABELS` gerados, não de mapas manuais.

## Estrutura

```
scripts/nocobase/
├── README.md                 # este arquivo
├── config/
│   └── datasources.ts        # collections para generate:types
└── src/
    ├── index.ts              # orquestrador (pnpm generate)
    ├── generator-registry.ts
    ├── lib/                  # lifecycle, HTTP, validação
    └── pipelines/
        └── generate-types/
```
