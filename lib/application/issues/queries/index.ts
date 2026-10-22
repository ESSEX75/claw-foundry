/** Supported queries operations for task consumers. */

export { ALL_TASK_STATES } from "./const.js";
export { getManagedTaskStatus } from "./get-task-status.js";
export { summarizeTaskIssue } from "./issue-summary.js";
export { listManagedTasks } from "./list-tasks.js";
export type { ProjectionViewContext, TaskIssueSummary } from "./types.js";
