---
name: nocobase-docs
description: >-
  Query the NocoBase instance configured in this project — collection schemas,
  field definitions, swagger docs, and read-only data exploration. Use this skill
  whenever you need to understand what collections exist, what fields a collection
  has, inspect sample data, or look up API endpoint details. Always use this skill
  before making any NocoBase API call — it loads the correct URL/token and enforces
  read-only safety. Triggers on: questions about database schema, collection structure,
  field types, API endpoints, data exploration, or any mention of NocoBase, collections,
  or the CRM backend. Also use when generating types, writing API integrations, or
  debugging data-related issues in this project.
metadata:
  authors:
    - copilot
  tags:
    - nocobase
    - documentation
    - api
    - schema
    - collections
  version: 5.1.0
user-invocable: true
---

# NocoBase Documentation Skill

This skill gives you read-only access to the project's NocoBase instance so you can
explore schemas, inspect data, and understand the API — without risking accidental writes.

All API calls go through a bundled TypeScript script that **blocks write operations**
and logs every request for auditing. Never call the NocoBase API directly with curl or
fetch — the script is the only authorized path.

---

## Quick Start

### First-time setup (install dependencies)

```bash
cd .agents/skills/nocobase-docs/scripts && pnpm install
```

If you skip this, the script will fail with a module-not-found error. Always run
`pnpm install` once before first use.

### Run commands

```bash
npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts <command> [args...]
```

### Command reference

| Command                              | What it does                       | Example                                 |
| ------------------------------------ | ---------------------------------- | --------------------------------------- |
| `swagger`                            | Fetch the full OpenAPI spec        | `swagger`                               |
| `swagger --ns=collections`           | Fetch spec for all collections     | `swagger --ns=collections`              |
| `swagger --ns=collections/t_pessoas` | Fetch spec for one collection      | `swagger --ns=collections/t_pessoas`    |
| `collections`                        | List all collections               | `collections`                           |
| `collections --name=t_pessoas`       | Get one collection with its fields | `collections --name=t_pessoas`          |
| `list <collection>`                  | List records (paginated)           | `list t_pessoas --page=1 --pageSize=20` |
| `get <collection> <id>`              | Get a single record by ID          | `get t_pessoas 42`                      |
| `count <collection>`                 | Count records in a collection      | `count t_pessoas`                       |
| `raw <endpoint>`                     | Raw GET to any read-only endpoint  | `raw "swagger:get?ns=collections"`      |
| `help`                               | Show usage help                    | `help`                                  |

### Query parameters

These work with `list`, `get`, and `count`:

| Parameter          | Example                       | Description                      |
| ------------------ | ----------------------------- | -------------------------------- |
| `--page=N`         | `--page=1`                    | Page number                      |
| `--pageSize=N`     | `--pageSize=20`               | Items per page                   |
| `--sort=<field>`   | `--sort=-id`                  | Sort (prefix `-` for descending) |
| `--fields=<list>`  | `--fields=id,name`            | Only return these fields         |
| `--appends=<list>` | `--appends=createdBy`         | Include related records          |
| `--except=<list>`  | `--except=password`           | Exclude these fields             |
| `--filter=<json>`  | `--filter='{"id":{"$eq":1}}'` | Advanced filter (JSON)           |

---

## Workflow Guide

Here's how to use each command in practice:

### When someone asks "what collections exist?" or "what's the schema?"

1. Run `collections` to list all collections
2. If they ask about a specific one, run `collections --name=<name>` to see its fields
3. For detailed API specs, use `swagger --ns=collections/<name>`
4. If the collection is from a non-main datasource (for example IXC), query it through
   `dataSources/<dataSourceKey>/...` using `raw` (examples below)

### When someone asks "show me the data" or "what does this collection contain?"

1. Run `list <collection> --page=1 --pageSize=5` for a quick sample
2. Use `--fields=<important_fields>` to narrow the output if it's too verbose
3. Use `count <collection>` to find out how many records exist before paginating

### When someone asks about API endpoints or integration

1. Run `swagger --ns=collections` to see all collection endpoints
2. The swagger spec shows available actions, parameters, and response shapes
3. Remember: only `:list`, `:get`, `:count`, `swagger:get`, and `collections:list/get`
   are permitted — the script blocks all mutations

### When generating TypeScript types

1. Run `swagger --ns=collections` to get all collection schemas
2. Cross-reference with `collections --name=<name>` for field details
3. Check `scripts/generate-types/` for the project's type generation tooling
4. Remember that `generate-types` is datasource-aware: it queries
   `dataSources/<dataSourceKey>/collections:list?paginate=false` for each datasource key
   (for example `main` and `d_db_ixcsoft`)

### Reading field metadata from non-main datasources

Use these patterns when you need collection fields outside `main` (for example `d_db_ixcsoft`).

1. List collections of a specific datasource:

```bash
npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts raw "dataSources/d_db_ixcsoft/collections:list?paginate=false"
```

2. Read fields for one collection by filtering the datasource collection list:

```bash
npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts raw "dataSources/d_db_ixcsoft/collections:list?paginate=false"
```

Then select the target collection from the returned array/object (example: `cidade`)
and inspect its `fields`.

3. Optional: inspect only field names and labels from the collection object:

- `name` is the technical field name
- `uiSchema.title` is the label used by generators/UI when present
- if `uiSchema.title` is missing, generator fallback is usually the field `name`

Notes:

- The same pattern works for `main`: replace `d_db_ixcsoft` with `main`.
- This is read-only and allowed by the skill because the endpoint action is `:list`/`:get`.

### Datasource-aware endpoints (generate-types)

The `nocobase-docs` client and the `generate-types` pipeline use different read paths:

- `nocobase-docs` skill focuses on generic read-only resources/actions:
  - `collections:list`
  - `collections:get`
  - `/{collection}:list`
  - `/{collection}:get`
  - `/{collection}:count`
  - `swagger:get`
- `generate-types` fetches schemas through datasource-keyed endpoints:
  - `GET /api/dataSources/main/collections:list?paginate=false`
  - `GET /api/dataSources/d_db_ixcsoft/collections:list?paginate=false`

Important:

- The host/base URL is the same; what changes is the datasource key in the path.
- In this project both configured datasources use NocoBase-style APIs, so endpoint
  shape is the same and only `dataSourceKey` changes.

---

## Credentials

The script loads credentials **only** from
`.agents/skills/nocobase-docs/.env.local`. It does not fall back to `.env`
or `.env.local` in the project root — the skill is self-contained.

If `.env.local` is missing or incomplete, try these steps in order:

1. **Check the project root** for `.env.local` or `.env` — if `CRM_NOCOBASE_URL` and
   `CRM_NOCOBASE_TOKEN` exist there, copy them into `.agents/skills/nocobase-docs/.env.local`.
   The skill's script only reads from its own `.env.local`, but the credentials may already
   be configured elsewhere in the project.

2. **Ask the user** if credentials aren't found anywhere:

> I need your NocoBase credentials to continue. Please provide:
>
> - NocoBase API base URL (e.g., https://your-instance.com/api)
> - JWT authentication token

Then create `.agents/skills/nocobase-docs/.env.local` with the values so future
invocations work without asking again.

| Variable                  | Description                            | Example                        |
| ------------------------- | -------------------------------------- | ------------------------------ |
| `CRM_NOCOBASE_URL`        | Base API URL                           | `https://crm.atplus.cloud/api` |
| `CRM_NOCOBASE_TOKEN`      | JWT token for auth                     | `eyJhbGci...`                  |
| `CRM_NOCOBASE_TIMEOUT_MS` | Request timeout in ms (default: 15000) | `15000`                        |

---

## Output and Logging

The script outputs JSON to stdout. Logs go to stderr (structured JSON + human-readable)
and are appended to `.agents/skills/nocobase-docs/nocobase-client.log` for auditing.
You can pipe stdout to files or parse it programmatically — log noise stays on stderr.

Every request produces two log entries: `status: "pending"` at start, then
`status: "success"` or `status: "error"` at completion.

### Error handling

If the script exits with an error, check these common causes:

- **CREDENTIALS_REQUIRED** → `.env.local` is missing or incomplete. Ask the user
  for their NocoBase URL and token, then create the file.
- **BLOCKED: Endpoint is not read-only** → You tried a mutation endpoint. The script
  only permits `:list`, `:get`, `:count`, `swagger:get`, `collections:list`, and
  `collections:get`.
- **HTTP 401** → Token expired or invalid. Ask the user to provide a fresh token.
- **HTTP 404** → Collection name is wrong. Run `collections` to see valid names.
- **Timeout** → The server is slow or unreachable. Try increasing
  `CRM_NOCOBASE_TIMEOUT_MS` in `.env.local`.

---

## API Reference (read-only endpoints)

These are the only endpoints the script permits, following NocoBase's
`/{resource}:{action}` convention:

| Method | Endpoint                     | Description                                       |
| ------ | ---------------------------- | ------------------------------------------------- |
| `GET`  | `swagger:get`                | Full OpenAPI spec                                 |
| `GET`  | `swagger:get?ns=<namespace>` | Filtered spec                                     |
| `GET`  | `collections:list`           | List all collections                              |
| `POST` | `collections:get`            | Collection with fields (sends filterByTk in body) |
| `GET`  | `/{collection}:list`         | List records (paginated)                          |
| `POST` | `/{collection}:get`          | Get record by ID (NocoBase uses POST for :get)    |
| `GET`  | `/{collection}:count`        | Count records                                     |

**Blocked actions:** `:create`, `:update`, `:destroy`, and all other mutation
endpoints. The script enforces this at the HTTP level — no workaround exists.

---

## Reference Documentation

- `docs/integracao-api-client.md` — Full API integration guide (Portuguese)
- `scripts/generate-types/README.md` — Type generation script documentation
- `scripts/generate-types/ARCHITECTURE.md` — Type generator architecture
- `src/@types/types.generated.ts` — Generated TypeScript types

## External Links

- [NocoBase API Documentation](https://docs.nocobase.com/integration/api-doc/)
- [NocoBase Auth SDK](https://docs.nocobase.com/api/sdk/auth)
- [Filter Operators](https://docs.nocobase.com/api/database/operators)
