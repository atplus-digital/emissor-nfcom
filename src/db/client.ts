import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { env } from "../env";

/**
 * SQLite de coordenação (ADR-0003): idempotency keys, outbox, lease de fatura.
 * Nunca define domínio — apenas estado de coordenação da emissão.
 */
const databaseUrl = env.DATABASE_URL;

export const sqlite = new Database(databaseUrl, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite);
