/** Supported lifecycle operations for task consumers. */

export { claimManagedTask } from "./claim-task.js";
export { claimManagedTasks } from "./claim-tasks.js";
export { editTaskBody } from "./edit-task-body.js";
export { setTaskLevel } from "./set-task-level.js";
export { startTask } from "./start-task.js";
export type {
  ClaimManagedTasksInput,
  ClaimManagedTasksResult,
  EditTaskBodyInput,
  SetTaskLevelInput,
  SetTaskLevelResult,
  StartTaskInput,
  StartTaskResult,
  TaskClaimDiagnostic,
} from "./types.js";
