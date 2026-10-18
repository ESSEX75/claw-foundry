/** Selects locally eligible queue candidates before provider or creation reads. */

import { ISSUE_INTEGRITY_STATUS, type IssueRuntimeState,STATE_TYPE, WORKFLOW_EVENT, type WorkflowConfig } from "../../domain/index.js";
import { queuePolicyBlock } from "./policy.js";

/**
 * Select healthy, owned issues in configured queue priority then stable issue-id order.
 * Creation readiness and provider availability remain I/O checks in the scanner.
 * @param states - Authoritative active runtime state snapshot.
 * @param queueLabels - Workflow labels eligible for the requested role.
 * @param workflow - Resolved state machine used to verify the canonical source pair and PICKUP target.
 * @param instanceName - Optional local owner identity restricting selection.
 * @param role - Role evaluated against each issue's saved policy before priority selection.
 */
export function selectLocalQueueCandidates(
  states: readonly IssueRuntimeState[],
  queueLabels: readonly string[],
  workflow: WorkflowConfig,
  instanceName: string | undefined,
  role: string,
): IssueRuntimeState[] {
  return states
    .filter((state) => state.integrityStatus !== ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR
      && state.providerMissing === null
      && !state.activeWorker
      && !state.pendingWorkerRelease
      && queuePolicyBlock(state, role) === null
      && queueLabels.includes(state.workflowLabel)
      && workflow.states[state.workflowState]?.label === state.workflowLabel
      && workflow.states[state.workflowState]?.type === STATE_TYPE.QUEUE
      && workflow.states[state.workflowState]?.role === role
      && validPickup(workflow, state.workflowState, role)
      && (!instanceName || state.owner === null || state.owner === instanceName))
    .sort((a, b) => queueLabels.indexOf(a.workflowLabel) - queueLabels.indexOf(b.workflowLabel) || a.issueId - b.issueId);
}

/** Verify that the selected queue leads to an active state of the same role.
 * @param workflow - Resolved state machine.
 * @param source - Canonical queue key.
 * @param role - Configured dispatch role.
 */
function validPickup(workflow: WorkflowConfig, source: string, role: string): boolean {
  const target = workflow.states[source]?.on?.[WORKFLOW_EVENT.PICKUP]?.target;
  const state = target ? workflow.states[target] : undefined;

  return state?.type === STATE_TYPE.ACTIVE && state.role === role;
}
