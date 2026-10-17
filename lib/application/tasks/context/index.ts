/** Supported context operations for task consumers. */

export { TASK_COMMENT_LIMIT } from "./const.js";
export { buildConflictFixMessage, buildTaskMessage } from "./message-builder.js";
export { assertTaskInputFits, estimateTaskInputTokens, selectTaskContext } from "./selection.js";
export type { SelectTaskContextInput, TaskContextBudget, TaskContextSelection } from "./types.js";
