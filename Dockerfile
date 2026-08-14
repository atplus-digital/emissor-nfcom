# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM oven/bun:1.3.14 AS build

WORKDIR /app

# Cache de dependências (só re-instala quando package.json/bun.lock mudam)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build do bundle
COPY src ./src
COPY tsconfig.json ./
RUN bun run build

# ---------- Runtime stage ----------
FROM oven/bun:1.3.14 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Bundle compilado (autocontido: bun build --target bun embute as deps)
COPY --from=build /app/dist ./dist

# drizzle-kit (runtime — roda as migrations do SQLite de coordenação, ADR-0003)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

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
