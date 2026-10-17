/** Exposes the pipeline completion use case to sibling application capabilities. */

export { executeCompletion } from "./completion.js";
export * from "./effects/index.js";
export { getRule, planWorkflowEvent } from "./plan.js";
export { recoverTransitionWorkers, releaseTransitionWorkerLocked } from "./recovery.js";
export { commitWorkflowTransitionLocked } from "./transition.js";
export type { CompletionInput, CompletionOutput } from "./types.js";
