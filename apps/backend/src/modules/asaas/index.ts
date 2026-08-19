/**
 * Barrel do módulo Asaas (ADR-0004).
 *
 * A ACL do Asaas expõe o repository (que implementa `AsaasPort`) e o factory
 * do cliente. Tipos externos do Asaas (DTOs) NÃO são reexportados — não cruzam
 * a fronteira do módulo (ADR-0004).
 */
export { AsaasRepository } from "./asaas.repository";
export { createAsaasClient, AsaasApiError } from "./asaas.client";
export type { AsaasClient } from "./asaas.client";
