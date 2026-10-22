/** Pure workflow queries for agent completion and heartbeat review transitions. */

import {
  type CompletionEventMap,
  type CompletionRule,
  DEFAULT_WORKFLOW,
  findStateKeyByLabel,
  getCompletionRule,
  resolveCompletionTransition,
  resolveWorkflowTransition,
  WORKFLOW_EVENT,
  type WorkflowConfig,
  type WorkflowEvent,
} from "../../../../domain/index.js";
import type { CompletionPlan, TransitionPlan } from "./types.js";

/** Resolve a configured event without restricting custom state keys or labels.
 * @param workflow - Validated runtime workflow.
 * @param fromLabel - Current workflow label.
 * @param event - Event to resolve from the current state.
 */
export function planWorkflowEvent(workflow: WorkflowConfig, fromLabel: string, event: WorkflowEvent): TransitionPlan | null {
  const source = findStateKeyByLabel(workflow, fromLabel);
  const transition = source === null ? null : resolveWorkflowTransition(workflow, source, event);

  return transition ? { from: transition.fromLabel, toState: transition.toState, toLabel: transition.toLabel, actions: transition.actions } : null;
}

/** Validate a role result and resolve its complete transition before effects.
 * @param workflow - Validated runtime workflow.
 * @param role - Configured role identifier.
 * @param result - Configured result identifier.
 * @param completion - Role-specific result-to-event mapping.
 */
export function planCompletion(workflow: WorkflowConfig, role: string, result: string, completion: CompletionEventMap): CompletionPlan {
  const event = completion[result];

  if (!event) throw new Error(`No completion event configured for ${role}:${result}`);
  const resolved = resolveCompletionTransition(workflow, role, event);

  if (!resolved) throw new Error(`No completion rule for ${role}:${result}`);

  return {
    event,
    rule: { from: resolved.fromLabel, to: resolved.toLabel, actions: resolved.actions },
    transition: { from: resolved.fromLabel, toState: resolved.toState, toLabel: resolved.toLabel, actions: resolved.actions },
    nextState: resolved.description,
  };
}

/** Resolve only the explicitly configured merge-failure recovery destination.
 * @param workflow - Validated runtime workflow.
 * @param fromLabel - Label from which merge failed.
 */
export function planMergeFailure(workflow: WorkflowConfig, fromLabel: string): TransitionPlan | null {
  return planWorkflowEvent(workflow, fromLabel, WORKFLOW_EVENT.MERGE_FAILED);
}

/**
 * Get completion rule for a role:result pair.
 * Uses workflow config when available.
 * @param role - Configured completing role.
 * @param result - Configured role result.
 * @param completion - Result-to-event mapping.
 * @param workflow - Resolved workflow, or built-in defaults.
 */
export function getRule(
  role: string,
  result: string,
  completion: CompletionEventMap,
  workflow: WorkflowConfig = DEFAULT_WORKFLOW,
): CompletionRule<string> | undefined {
  const event = completion[result];

  return event
    ? getCompletionRule(workflow, role, event) ?? undefined
    : undefined;
}
