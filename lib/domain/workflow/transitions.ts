/** Resolves configured workflow edges without provider observations or runtime effects. */

import { STATE_TYPE, WORKFLOW_EVENT } from "./const.js";
import type { WorkflowDefinition, WorkflowEvent, WorkflowTransition } from "./types.js";

/** Resolve a queue pickup only when its configured destination is active for the same role.
 * @param workflow - Resolved workflow graph, including custom identifiers.
 * @param fromState - Canonical queue key from authoritative issue state.
 * @param role - Configured role requesting the pickup.
 */
export function resolveQueuePickup<TRoleId extends string, TStateKey extends string, TLabel extends string>(
  workflow: WorkflowDefinition<TRoleId, TStateKey, TLabel>, fromState: TStateKey, role: TRoleId,
): WorkflowTransition<TStateKey, TLabel> | null {
  const source = workflow.states[fromState];

  if (source?.type !== STATE_TYPE.QUEUE || source.role !== role) return null;
  const transition = resolveWorkflowTransition(workflow, fromState, WORKFLOW_EVENT.PICKUP);
  const target = transition ? workflow.states[transition.toState] : undefined;

  return target?.type === STATE_TYPE.ACTIVE && target.role === role ? transition : null;
}

/** Resolve an event from its canonical source key; absent edges or states return null.
 * The returned action list is independent of the configuration snapshot.
 * @param workflow - Validated workflow graph.
 * @param fromState - Canonical source key selected from local issue state.
 * @param event - Event whose configured edge should be resolved.
 */
export function resolveWorkflowTransition<TRoleId extends string, TStateKey extends string, TLabel extends string>(
  workflow: WorkflowDefinition<TRoleId, TStateKey, TLabel>, fromState: TStateKey, event: WorkflowEvent,
): WorkflowTransition<TStateKey, TLabel> | null {
  const source = workflow.states[fromState];
  const edge = source?.on?.[event];
  const target = edge ? workflow.states[edge.target] : undefined;

  if (!source || !edge || !target) return null;

  return { fromState, fromLabel: source.label, toState: edge.target, toLabel: target.label,
    description: target.description ?? target.label, actions: [...(edge.actions ?? [])] };
}

/** Resolve completion from the role's configured active state, preserving canonical keys.
 * @param workflow - Validated graph with at most one active state per role.
 * @param role - Runtime-configured role completing work.
 * @param event - Validated completion event selected by application.
 */
export function resolveCompletionTransition<TRoleId extends string, TStateKey extends string, TLabel extends string>(
  workflow: WorkflowDefinition<TRoleId, TStateKey, TLabel>, role: TRoleId, event: WorkflowEvent,
): WorkflowTransition<TStateKey, TLabel> | null {
  for (const key in workflow.states) {
    if (!Object.hasOwn(workflow.states, key)) continue;
    const state = workflow.states[key];

    if (state.type === STATE_TYPE.ACTIVE && state.role === role) return resolveWorkflowTransition(workflow, key, event);
  }

  return null;
}
