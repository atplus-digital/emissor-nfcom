# ADRs

<!-- GERADO por scripts/docs-check — não editar à mão -->

| id | título | status |
|---|---|---|
| [ADR-0001](0001-integracao-sefaz-via-gateway-saas.md) | Integração com a SEFAZ via gateway SaaS em vez de motor fiscal próprio | accepted |
| [ADR-0002](0002-orquestracao-assincrona-bullmq.md) | Orquestração de emissão assíncrona via BullMQ + Redis | accepted |
| [ADR-0003](0003-estado-local-sqlite-idempotencia-outbox.md) | Estado local SQLite para idempotência e outbox | accepted |
| [ADR-0004](0004-limites-de-modulo-anti-corruption-layers.md) | Limites de módulo como anti-corruption layers para cada integração externa | accepted |
| [ADR-0005](0005-stack-tecnologica.md) | Stack tecnológica: Bun + Hono + Drizzle + Zod 4 | accepted |
| [ADR-0006](0006-tipos-de-crm-gerados-por-script.md) | Tipos de CRM/Atacado/IXC sempre gerados por script, nunca escritos à mão | superseded |
| [ADR-0007](0007-estrutura-de-pastas-camadas.md) | Estrutura de pastas: camadas com domínio no centro | accepted |
| [ADR-0008](0008-logging-estruturado-pino.md) | Logging estruturado com pino: correlação por AsyncLocalStorage e redação explícita | accepted |
| [ADR-0009](0009-migrations-drizzle-geradas-sem-edicao-manual.md) | Migrations de BD são geradas pelo drizzle-kit, nunca escritas à mão | accepted |
| [ADR-0010](0010-supersede-0006-tipos-translators-hand-written.md) | Regra do ADR-0006 supersedida para tipos de translators: shapes hand-written são exceção documentada | accepted |
| [ADR-0011](0011-monorepo-bun-workspaces.md) | Monorepo Bun Workspaces: apps/backend, apps/viewer, packages/db, packages/generated | accepted |
| [ADR-0012](0012-configs-fiscais-em-banco-de-coordenacao.md) | Configs fiscais (cClass/CFOP/ICMS) em banco de coordenação + natureza por cliente | accepted |
