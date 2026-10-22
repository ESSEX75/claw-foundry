/**
 * workflow/completion.ts — Completion rules derived from workflow transitions.
 */

import { resolveCompletionTransition } from "./transitions.js";
import { type CompletionRule, type WorkflowDefinition, type WorkflowEvent } from "./types.js";

/**
 * Get completion rule for a role:result pair.
 * Derives entirely from workflow transitions — no hardcoded role:result mapping.
 *
 * @param workflow - Resolved workflow containing the active state and transitions.
 * @param role - Runtime-configured role completing its active work.
 * @param event - Validated workflow event produced by the completion result.
 */
export function getCompletionRule<
  TRoleId extends string,
  TStateKey extends string,
  TLabel extends string,
>(
  workflow: WorkflowDefinition<TRoleId, TStateKey, TLabel>,
  role: TRoleId,
  event: WorkflowEvent,
): CompletionRule<TLabel> | null {
  const transition = resolveCompletionTransition(workflow, role, event);

  return transition ? { from: transition.fromLabel, to: transition.toLabel, actions: transition.actions } : null;
}

/**
 * Get the target state's human-readable description, falling back to its label.
 * Returns an empty string when the completion event has no valid target.
 *
 * @param workflow - Resolved workflow containing the target state metadata.
 * @param role - Runtime-configured role completing its active work.
 * @param event - Validated workflow event produced by the completion result.
 */
export function getNextStateDescription<
  TRoleId extends string,
  TStateKey extends string,
  TLabel extends string,
>(
  workflow: WorkflowDefinition<TRoleId, TStateKey, TLabel>,
  role: TRoleId,
  event: WorkflowEvent,
): string {
  return resolveCompletionTransition(workflow, role, event)?.description ?? "";
}
