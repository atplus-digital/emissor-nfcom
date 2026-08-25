# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM oven/bun:1.3.14 AS build

WORKDIR /app

# Cache de dependências (só re-instala quando package.json/bun.lock mudam)
COPY package.json bun.lock ./
# O bunfig define `linker = "hoisted"` — sem ele o `bun install` na imagem usa
# `isolated` (default em workspaces) e o bundle não resolve o pacote nativo
# `@libsql/linux-x64-gnu` a partir de dist/ (ADR-0011)
COPY bunfig.toml ./
# Manifests dos workspaces (o lockfile os referencia — sem eles o
# --frozen-lockfile falha; ADR-0011)
COPY apps/backend/package.json apps/backend/
COPY apps/viewer/package.json apps/viewer/
COPY packages/db/package.json packages/db/
COPY packages/generated/package.json packages/generated/
RUN bun install --frozen-lockfile

# Build do bundle
COPY apps/backend/src ./apps/backend/src
COPY packages/db/src ./packages/db/src
COPY packages/generated/types ./packages/generated/types
COPY tsconfig.json ./
# Migrations Drizzle (ADR-0003): o runtime copia deste stage para aplicar no boot
# (`bunx drizzle-kit migrate` no CMD). Sem isso, o COPY do runtime falha.
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
RUN bun run build
# Build do viewer (Vite → estáticos em apps/viewer/dist). O runtime os serve
# via VIEWER_DIST=/app/viewer (mesmo origin do /painel → cookie HttpOnly ok).
COPY apps/viewer/src ./apps/viewer/src
COPY apps/viewer/index.html ./apps/viewer/index.html
COPY apps/viewer/vite.config.ts ./apps/viewer/vite.config.ts
COPY apps/viewer/tsconfig.json ./apps/viewer/tsconfig.json
COPY apps/viewer/components.json ./apps/viewer/components.json
RUN bun run viewer:build

# ---------- Runtime stage ----------
FROM oven/bun:1.3.14 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Bundle compilado (autocontido: bun build --target bun embute as deps)
COPY --from=build /app/dist ./dist
# Estáticos do viewer (Vite build): servidos pelo próprio backend em
# VIEWER_DIST=/app/viewer — mesmo origin do /painel (cookie HttpOnly ok).
COPY --from=build /app/apps/viewer/dist /app/viewer
ENV VIEWER_DIST=/app/viewer

# drizzle-kit (runtime — roda as migrations do SQLite de coordenação, ADR-0003)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
# Schema do @emissor/db (drizzle.config.ts aponta para packages/db/src/schema.ts —
# `bunx drizzle-kit migrate` no boot precisa lê-lo; ADR-0011)
COPY --from=build /app/packages/db ./packages/db

# SQLite de coordenação em volume persistente (idempotency keys, outbox, lease)
# — perder esse arquivo = perder a garantia anti-duplicação (ADR-0003).
VOLUME ["/app/data"]
ENV DATABASE_URL="/app/data/emissor.db"
RUN mkdir -p /app/data && chown -R bun:bun /app/data

# Usuário não-root (a imagem oven/bun já traz o usuário `bun`, UID 1000)
USER bun

EXPOSE 3000

# Migra o SQLite via drizzle-kit antes de subir o server (shell form: && é operador real)
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun run dist/index.js"]
