/** Interprets provider labels only for a previously absent runtime record. */

import { findStateKeyByLabel, getStateLabels, type IssueRuntimeState, resolveReviewRouting, resolveTestRouting, REVIEW_POLICY, TEST_POLICY } from "../../domain/index.js";
import { updateIssueRuntimeRecord } from "../../state/index.js";
import { buildInitialIssueRuntimeState } from "./creation.js";
import type { IssueStateInitializeInput } from "./types.js";

/** Build a new record from explicit inputs and projection values allowed by resolved roles.
 * No role registry means no inferred assignment; lifecycle callers can supply explicit choices.
 * @param input - Initialization choices and optional resolved role definitions for label import.
 * @param workflow - Validated canonical state and label selected for the initial record.
 */
function initializeRuntimeFromProjection(
  input: IssueStateInitializeInput,
  workflow: Pick<IssueRuntimeState, "workflowState" | "workflowLabel">,
): IssueRuntimeState {
  const labels = new Set(input.issue.labels);
  const assignments = Object.entries(input.initializationRoles ?? {}).flatMap(([role, config]) =>
    Object.keys(config.levels).filter((level) => labels.has(`${role}:${level}`)
      && (input.assignedRole === undefined || input.assignedRole === role)
      && (input.assignedLevel === undefined || input.assignedLevel === level)).map((level) => ({ role, level })));

  if ((input.assignedRole === undefined || input.assignedLevel === undefined) && assignments.length > 1) {
    throw new Error("Provider labels contain multiple configured role/level assignments; explicit initialization choices are required.");
  }

  const assignment = assignments[0];
  const reviewPolicies = Object.values(REVIEW_POLICY).filter(policy => labels.has(resolveReviewRouting(policy)));
  const testPolicies = Object.values(TEST_POLICY).filter(policy => labels.has(resolveTestRouting(policy)));

  if ((input.reviewPolicy === undefined && reviewPolicies.length > 1)
    || (input.testPolicy === undefined && testPolicies.length > 1)) {
    throw new Error("Provider labels contain conflicting routing policies; explicit initialization choices are required.");
  }

  return buildInitialIssueRuntimeState({
    provider: input.providerType,
    ...workflow,
    assignedRole: input.assignedRole !== undefined ? input.assignedRole : assignment?.role ?? null,
    assignedLevel: input.assignedLevel !== undefined ? input.assignedLevel : assignment?.level ?? null,
    owner: input.owner ?? null,
    reviewPolicy: input.reviewPolicy !== undefined ? input.reviewPolicy : reviewPolicies[0] ?? null,
    testPolicy: input.testPolicy !== undefined ? input.testPolicy : testPolicies[0] ?? null,
    notifyTarget: input.notifyTarget ?? null,
  }, input.project.slug, input.issue.iid);
}

/** Initialize only an explicitly selected issue; creation retries preserve an existing matching operation.
 * Existing unrelated records cannot be replaced through initialization.
 * @param input - Operator or creation-owned initialization choices and provider snapshot.
 */
export async function initializeIssueRuntimeState(input: IssueStateInitializeInput): Promise<IssueRuntimeState> {
  return updateIssueRuntimeRecord(input.workspaceDir, input.project.slug, input.issue.iid, previous => {
    if (previous) {
      if (input.creationOperationId && previous.creationOperationId === input.creationOperationId
        && previous.provider === input.providerType) return previous;
      throw new Error(`Issue #${input.issue.iid} already has initialized local runtime state.`);
    }

    const labels = [...new Set(input.issue.labels)].filter(label => getStateLabels(input.workflow).includes(label));
    const workflowState = input.workflowState ?? findStateKeyByLabel(input.workflow, input.workflowLabel ?? labels[0] ?? "");
    const workflowLabel = input.workflowLabel ?? (input.workflowState ? input.workflow.states[input.workflowState]?.label : labels.length === 1 ? labels[0] : undefined);

    if (!workflowState || !workflowLabel || input.workflow.states[workflowState]?.label !== workflowLabel) {
      throw new Error("Initialization requires exactly one configured workflow label or a matching explicit state-label pair.");
    }

    const base = initializeRuntimeFromProjection(input, { workflowState, workflowLabel });

    return { ...base,
      ...(input.creationOperationId !== undefined ? { creationOperationId: input.creationOperationId } : {}),
      activeWorker: input.activeWorker ?? null,
      ...(input.pendingWorkerRelease !== undefined ? { pendingWorkerRelease: input.pendingWorkerRelease } : {}),
      pipelineNotification: input.pipelineNotification ?? null,
      integrityStatus: input.integrityStatus ?? base.integrityStatus,
      closedAt: input.closedAt ?? null,
    };
  });
}
