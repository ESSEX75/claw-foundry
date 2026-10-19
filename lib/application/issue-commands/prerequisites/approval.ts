/** Resolves a configured approval queue shared by activation and assignment commands. */

import { STATE_TYPE, WORKFLOW_EVENT, type WorkflowConfig, type WorkflowStateConfig } from "../../../domain/index.js";
import type { QueueTarget } from "./types.js";

/** Resolve and validate the configured approval transition from HOLD to QUEUE.
 * @param workflow - Effective project workflow including custom states.
 * @param currentState - Resolved configuration of the current authoritative state.
 */
export function resolveHoldQueueTarget(
  workflow: WorkflowConfig,
  currentState: WorkflowStateConfig,
): QueueTarget {
  if (currentState.type !== STATE_TYPE.HOLD) {
    throw new Error(`task_start only works on HOLD states. Current state is "${currentState.label}".`);
  }

  const approveTransition = currentState.on?.[WORKFLOW_EVENT.APPROVE];

  if (!approveTransition) {
    throw new Error(`HOLD state "${currentState.label}" has no APPROVE transition.`);
  }

  const targetState = workflow.states[approveTransition.target];

  if (!targetState) {
    throw new Error(`Transition target "${approveTransition.target}" not found in workflow.`);
  }

  if (targetState.type !== STATE_TYPE.QUEUE) {
    throw new Error(`Transition target "${approveTransition.target}" must be a queue state.`);
  }

  return { stateKey: approveTransition.target, state: targetState };
}
