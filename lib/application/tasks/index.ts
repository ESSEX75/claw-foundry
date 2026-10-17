/** Supported task creation, lifecycle, query, attachment, and worker-context APIs. */

export { extractIssueReferences, formatAttachmentsForTask, manageTaskAttachments, processAttachmentMessage, resolveAttachmentProject } from "./attachments/index.js";
export type { SelectTaskContextInput, TaskContextBudget, TaskContextSelection } from "./context/index.js";
export { buildConflictFixMessage, buildTaskMessage, TASK_COMMENT_LIMIT } from "./context/index.js";
export { assertTaskInputFits, estimateTaskInputTokens, selectTaskContext } from "./context/index.js";
export { createManagedTaskIssue, reconcileManagedTaskCreations } from "./creation/index.js";
export * from "./discussion/index.js";
export * from "./lifecycle/index.js";
export type { ProjectionViewContext } from "./queries/index.js";
export type { TaskIssueSummary } from "./queries/index.js";
export { ALL_TASK_STATES, getManagedTaskStatus, listManagedTasks, summarizeTaskIssue } from "./queries/index.js";
export * from "./research/index.js";
