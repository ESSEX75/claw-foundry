/** Resolves an architect queue and its exact PICKUP target without depending on label text. */

import { DEFAULT_ROLES, resolveQueuePickup, STATE_TYPE, type WorkflowConfig } from "../../../../domain/index.js";

/** Select one valid architect queue; ambiguity requires an explicit state key.
 * @param workflow - Resolved workflow whose queue graph is authoritative.
 * @param requested - Explicit queue state key, when supplied.
 */
export function planResearchWorkflow(workflow: WorkflowConfig, requested?: string) {
  const role = DEFAULT_ROLES.ARCHITECT;
  const queues = Object.entries(workflow.states).filter(([key, state]) => state.type === STATE_TYPE.QUEUE
    && state.role === role && (requested === undefined || key === requested));
  const selected = queues[0];

  if (queues.length !== 1 || !selected) throw new Error("Select exactly one configured architect queue with workflowState.");
  const [queueState, queue] = selected;
  const target = resolveQueuePickup(workflow, queueState, role);

  if (!target) throw new Error("Research queue PICKUP must target an active architect state.");

  return { role, queueState, queueLabel: queue.label, activeLabel: target.toLabel };
}
