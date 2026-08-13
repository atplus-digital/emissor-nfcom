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

# Usuário não-root (a imagem oven/bun já traz o usuário `bun`, UID 1000)
USER bun

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
