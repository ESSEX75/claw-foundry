/** Applies explicit lifecycle updates to fresh local truth under the state transaction lock. */

import { findStateKeyByLabel, type IssueRuntimeState } from "../../../domain/index.js";
import { updateIssueRuntimeRecord } from "../../../state/index.js";
import type { IssueStateWriteInput } from "./types.js";

/** Persist explicit changes, preserving omitted fields and meaningful nulls on existing records.
 * Missing records reject the update; provider labels never initialize runtime implicitly.
 * Invalid explicit workflow key/label pairs reject the write without replacing persisted state.
 * @param input - Issue identity, resolved workflow, and explicit lifecycle changes.
 */
export async function writeIssueRuntimeState(input: IssueStateWriteInput): Promise<IssueRuntimeState> {
  return updateIssueRuntimeRecord(input.workspaceDir, input.project.slug, input.issue.iid, (previous) => {
    if (!previous) throw new Error(`Issue #${input.issue.iid} has no initialized local runtime state.`);
    const workflow = resolveWriteWorkflow(input, previous);
    const base = previous;

    if (base.provider !== input.providerType) throw new Error("Issue provider cannot change through a runtime update.");

    return {
      ...base,
      ...workflow,
      ...(input.lastCompletion !== undefined ? { lastCompletion: input.lastCompletion } : {}),
      ...(input.creationOperationId !== undefined ? { creationOperationId: input.creationOperationId } : {}),
      assignedRole: input.assignedRole !== undefined ? input.assignedRole : base.assignedRole,
      assignedLevel: input.assignedLevel !== undefined ? input.assignedLevel : base.assignedLevel,
      owner: input.owner !== undefined ? input.owner : base.owner,
      reviewPolicy: input.reviewPolicy !== undefined ? input.reviewPolicy : base.reviewPolicy,
      testPolicy: input.testPolicy !== undefined ? input.testPolicy : base.testPolicy,
      notifyTarget: input.notifyTarget !== undefined ? input.notifyTarget : base.notifyTarget,
      activeWorker: input.activeWorker !== undefined ? input.activeWorker : base.activeWorker,
      ...(input.pendingWorkerRelease !== undefined ? { pendingWorkerRelease: input.pendingWorkerRelease } : {}),
      pipelineNotification: input.pipelineNotification !== undefined ? input.pipelineNotification : base.pipelineNotification,
      integrityStatus: input.integrityStatus ?? base.integrityStatus,
      closedAt: input.closedAt !== undefined ? input.closedAt : base.closedAt,
      updatedAt: new Date().toISOString(),
    };
  });
}

/** Resolve an explicit transition or preserve the stored workflow pair without reading labels.
 * @param input - Workflow overrides and configuration validating an intended transition.
 * @param previous - Fresh authoritative persisted record.
 */
function resolveWriteWorkflow(
  input: IssueStateWriteInput,
  previous: IssueRuntimeState,
): Pick<IssueRuntimeState, "workflowState" | "workflowLabel"> {
  if ((input.workflowState === undefined || input.workflowState === previous.workflowState)
    && (input.workflowLabel === undefined || input.workflowLabel === previous.workflowLabel)) {
    return { workflowState: previous.workflowState, workflowLabel: previous.workflowLabel };
  }

  let workflowLabel = input.workflowLabel;

  if (workflowLabel === undefined && input.workflowState !== undefined) workflowLabel = input.workflow.states[input.workflowState]?.label;

  if (!workflowLabel) throw new Error(`Issue #${input.issue.iid} has no recognized workflow label for issue state write.`);
  const workflowState = input.workflowState ?? findStateKeyByLabel(input.workflow, workflowLabel);

  if (!workflowState || input.workflow.states[workflowState]?.label !== workflowLabel) {
    throw new Error(`Workflow state and label do not match current configuration: ${workflowState ?? "unknown"} / ${workflowLabel}.`);
  }

  return { workflowState, workflowLabel };
}
