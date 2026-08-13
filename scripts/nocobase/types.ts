import type { ListrTaskWrapper } from "listr2";

/**
 * Type alias for the Listr2 task wrapper used across pipeline orchestration.
 */
// biome-ignore lint/suspicious/noExplicitAny: Listr2 requires unconstrained renderer generics
export type TaskRunner = ListrTaskWrapper<any, any, any>;

export type OrchestrationTaskRunner = TaskRunner;
