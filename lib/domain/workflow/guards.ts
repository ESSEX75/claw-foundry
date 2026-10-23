/**
 * Validates membership in Claw Foundry's closed built-in workflow value sets.
 */

import { COMPLETION_RESULT, WORKFLOW_EVENT } from "./const.js";
import type { CompletionResult, WorkflowEvent } from "./types.js";

/**
 * Check whether a value matches a built-in completion result.
 * Configured custom results must be checked against the resolved role's event map.
 *
 * @param value - Untrusted value to validate.
 */
export function isBuiltInCompletionResult(value: unknown): value is CompletionResult {
  return typeof value === "string"
    && Object.values(COMPLETION_RESULT).some((result) => result === value);
}

/**
 * Check whether a value matches a supported workflow event.
 *
 * @param value - Untrusted value to validate.
 */
export function isWorkflowEvent(value: unknown): value is WorkflowEvent {
  return typeof value === "string"
    && Object.values(WORKFLOW_EVENT).some((event) => event === value);
}
