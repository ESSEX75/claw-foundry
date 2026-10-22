/** Exposes the supported workflow state-machine API to the domain package. */

export { getCompletionRule, getNextStateDescription } from "./completion.js";
export {
  ACTION,
  COMPLETION_RESULT,
  EXECUTION_MODE,
  REVIEW_CHECK,
  STATE_TYPE,
  WORKFLOW_EVENT,
  WORKFLOW_STATE_KEYS,
  WORKFLOW_STATE_LABELS,
} from "./const.js";
export { DEFAULT_WORKFLOW } from "./defaults.js";
export { isBuiltInCompletionResult, isWorkflowEvent } from "./guards.js";
export * from "./labels/index.js";
export { resolveIssueClosedAt } from "./lifecycle.js";
export { getCompletionEmoji } from "./presentation.js";
export {
  detectRoleFromLabel,
  findStateByLabel,
  findStateKeyByLabel,
  getActiveLabel,
  getAllQueueLabels,
  getInitialStateLabel,
  getLabelColors,
  getProjectedStateLabel,
  getQueueLabels,
  getRevertLabel,
  getStateLabels,
  hasReviewCheck,
  hasTestPhase,
  hasWorkflowStates,
  isFeedbackState,
  producesReviewableWork,
} from "./queries.js";
export * from "./routing/index.js";
export { resolveCompletionTransition, resolveQueuePickup, resolveWorkflowTransition } from "./transitions.js";
export type {
  BuiltInWorkflowConfig,
  CompletionEventMap,
  CompletionResult,
  CompletionRule,
  ExecutionMode,
  ReviewCheckType,
  StateDefinition,
  TransitionAction,
  TransitionTarget,
  WorkflowConfig,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowLabel,
  WorkflowStateConfig,
  WorkflowStateKey,
  WorkflowTransition,
} from "./types.js";
