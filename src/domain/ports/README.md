# Portas de domínio (ADR-0004)

Uma interface por integração (`AtacadoPort`, `AsaasPort`, `NfcomPort`) + `QueuePort`
(filas). O domínio só conhece as portas; os módulos (`src/modules/`) as implementam
na Fase 3, traduzindo tipos externos `f_*`/provedores na fronteira.

## Logger — sem porta

`LoggerPort` **não existe** de propósito. ADR-0008 fixa **uma instância só** de
pino (`import { log } from '#/lib/logger'`) propagada por `AsyncLocalStorage`.
Criar uma `LoggerPort` seria duplicar essa decisão e acoplar o domínio a um tipo
extra — o domínio importa `log` direto (a instância, não pino), conforme ADR-0008.
Sem overhead de port p/ logger.
