import { Redis } from "ioredis";
import { env } from "#/env";

/**
 * Conexão Redis compartilhada (single-instance, ADR-0002/0003). BullMQ precisa de uma
 * conexão ioredis; este factory cria uma instância única (lazy singleton) reusada por
 * filas e workers no mesmo processo.
 *
 * `lazyConnect` evita travar o boot (e o teste) esperando um redis real; o BullMQ
 * gerencia a conexão sob demanda.
 */
let _redis: Redis | null = null;

export function getRedis(): Redis {
	if (_redis) return _redis;
	_redis = new Redis(env.REDIS_URL, {
		lazyConnect: true,
		maxRetriesPerRequest: null,
	});
	return _redis;
}

/** Exposto para testes resetarem o singleton (não usar no app). */
export function _resetRedisForTests(): void {
	_redis = null;
}
