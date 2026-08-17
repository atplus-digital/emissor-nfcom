import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "#/env";
import * as schema from "#/lib/db/schema";

/**
 * Cliente Drizzle sobre SQLite (libsql) para o DB de coordenação (ADR-0003).
 *
 * Conexão por `env.DATABASE_URL` (default `./data/emissor.db`, ADR-0005). O pod roda
 * `bunx drizzle-kit migrate` no boot (CMD do Dockerfile, idempotente) antes de subir o
 * server — a conexão aqui assume o schema já aplicado.
 *
 * Single-instance (ADR-0002/0003): SQLite de coordenação não é compartilhável entre
 * pods. Escalar = ADR futuro de migração para Postgres.
 */

export type CoordDB = LibSQLDatabase<typeof schema>;

let _db: CoordDB | null = null;

/**
 * Retorna a instância singleton do DB de coordenação. Cria o diretório-pai do arquivo
 * SQLite se ainda não existir (para o default `./data/emissor.db`).
 */
export function getDb(): CoordDB {
	if (_db) return _db;
	const url = env.DATABASE_URL;
	// Garante o diretório do arquivo para caminhos locais. libsql exige scheme
	// `file:` para arquivos locais (um path puro como `./data/emissor.db` é
	// rejeitado); `:memory:` e URLs remotas (`libsql://`, `http(s)://`) passam direto.
	const isLocalPath =
		url !== ":memory:" &&
		!url.startsWith("file:") &&
		!url.startsWith("libsql://") &&
		!url.startsWith("http");
	if (isLocalPath) {
		const dir = dirname(url);
		if (dir && !existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}
	const connection = isLocalPath ? `file:${url}` : url;
	_db = drizzle({ connection, schema });
	return _db;
}

/**
 * Reseta o singleton (uso em testes que precisam recriar a conexão).
 */
export function resetDbForTests(): void {
	_db = null;
}
