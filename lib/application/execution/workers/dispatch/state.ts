/** Owns worker-slot reservation and the authoritative issue runtime commit. */

import type { IssueRuntimeState, WorkerDeliveryState } from "../../../../domain/index.js";
import { EXECUTION_MODE, releasedWorkerSlot, sameWorkerRun, slotOwnsWorkerRun, WORKER_DELIVERY_STATUS } from "../../../../domain/index.js";
import type { ResolvedConfig } from "../../../../state/index.js";
import { activateWorker, getLevelMaxWorkers, readIssueStateStore, updateIssueRuntimeRecord, updateSlot } from "../../../../state/index.js";
import { reconcileManagedLabelsLocked } from "../../../issues/projection/index.js";
import { writeIssueRuntimeState } from "../../../issues/runtime/index.js";
import { WORKER_DISPATCH_OWNER } from "./const.js";
import type { DispatchAttempt, DispatchOpts } from "./types.js";

/**
 * Reserve a concrete slot before provider and gateway side effects begin.
 * @param opts - Dispatch identity and project state location.
 * @param plan - Selected role, level, slot, and session key.
 * @param config - Resolved project constraints enforced during the atomic reservation.
 */
export async function reserveDispatchSlot(opts: DispatchOpts, plan: DispatchAttempt, config: ResolvedConfig): Promise<void> {
  await activateWorker(opts.workspaceDir, opts.project.slug, plan.role, {
    issueId: opts.issueId,
    level: plan.level,
    sessionKey: plan.sessionKey,
    startTime: plan.startedAt,
    previousLabel: opts.fromLabel,
    slotIndex: plan.slotIndex,
    name: plan.botName,
    roleExecution: opts.roleExecution ?? config.workflow.roleExecution,
    projectExecution: opts.pluginConfig?.projectExecution === EXECUTION_MODE.SEQUENTIAL ? EXECUTION_MODE.SEQUENTIAL : EXECUTION_MODE.PARALLEL,
    maxWorkers: getLevelMaxWorkers(config.roles[plan.role])[plan.level] ?? 0,
    delivery: {
      operationId: plan.deliveryId,
      status: WORKER_DELIVERY_STATUS.SUBMITTING,
      recordedAt: plan.startedAt,
      reason: "Worker turn submission has not been confirmed.",
    },
  });
}

/**
 * Release only the slot still assigned to this issue after confirmed pre-delivery failure.
 * @param opts - Dispatch identity and project state location.
 * @param plan - Exact role, level, and slot reserved for this attempt.
 */
export async function releaseDispatchSlot(opts: DispatchOpts, plan: DispatchAttempt): Promise<void> {
  await updateSlot(opts.workspaceDir, opts.project.slug, plan.role, plan.level, plan.slotIndex, (slot) => {
    if (!slotOwnsWorkerRun(slot, opts.issueId, plan) || slot.delivery?.operationId !== plan.deliveryId) {
      throw new Error("Worker reservation changed before release.");
    }

    return releasedWorkerSlot(slot, opts.issueId);
  });
}

/**
 * Persist the intended active worker before gateway submission, then reconcile projection.
 * The caller holds the issue lock and compensates this intent if submission does not begin.
 * @param opts - Issue, project, provider, and ownership inputs.
 * @param plan - Worker identity selected before delivery.
 * @param config - Resolved workflow and roles used for projection.
 * @param providerLabels - Provider issue labels read after transition.
 * @param delivery - Unresolved submission marker, absent after confirmed acceptance.
 */
export async function commitWorkerDispatch(
  opts: DispatchOpts,
  plan: DispatchAttempt,
  config: ResolvedConfig,
  providerLabels: string[],
  delivery?: WorkerDeliveryState,
): Promise<void> {
  const { workspaceDir, project, issueId, role, level, fromLabel, toLabel, provider } = opts;
  const { workflow } = config;
  const current = (await readIssueStateStore(workspaceDir, project.slug)).issues[String(issueId)];

  if (!current) throw new Error(`Issue #${issueId} has no initialized local runtime state.`);
  const owner = current.owner ?? opts.instanceName ?? null;

  await writeIssueRuntimeState({
    workspaceDir,
    project,
    issue: {
      iid: issueId,
      labels: providerLabels
        .filter((label) => label !== fromLabel && !label.startsWith(`${role}:`))
        .concat(toLabel, `${role}:${level}`),
    },
    providerType: project.provider,
    workflow,
    workflowLabel: toLabel,
    assignedRole: role,
    assignedLevel: level,
    owner,
    activeWorker: {
      role, level, slotIndex: plan.slotIndex, sessionKey: plan.sessionKey,
      startedAt: plan.startedAt,
      delivery,
    },
  });
  await reconcileManagedLabelsLocked({
    workspaceDir,
    projectSlug: project.slug,
    issueId,
    workflow,
    roles: Object.keys(config.roles),
    provider,
    owner: WORKER_DISPATCH_OWNER,
  });
}

/** Persist a recoverable release intent before releasing a proven unsubmitted reservation.
 * @param opts - Original issue identity and transport context.
 * @param plan - Exact reservation whose gateway send did not begin or was rejected locally.
 * @param source - Authoritative source fields captured before reservation.
 */
export async function restoreDispatchRuntime(opts: DispatchOpts, plan: DispatchAttempt, source: IssueRuntimeState): Promise<void> {
  await updateIssueRuntimeRecord(opts.workspaceDir, opts.project.slug, opts.issueId, current => {
    if (!current) throw new Error("Issue disappeared before dispatch compensation.");
    if (!current.activeWorker) return current;
    if (!sameWorkerRun(current.activeWorker, plan) || current.activeWorker.delivery?.operationId !== plan.deliveryId) {
      throw new Error("Worker changed before dispatch compensation.");
    }

    return { ...current, workflowState: source.workflowState, workflowLabel: source.workflowLabel,
      assignedRole: source.assignedRole, assignedLevel: source.assignedLevel, owner: source.owner,
      activeWorker: null, pendingWorkerRelease: current.activeWorker,
      pendingReviewSummaryDelivery: current.pendingReviewSummaryDelivery?.operationId === plan.deliveryId ? undefined : current.pendingReviewSummaryDelivery,
      updatedAt: new Date().toISOString() };
  });
}

/** Clear only this compensation's release intent after its exact slot was released.
 * @param opts - Original issue store location.
 * @param plan - Reservation whose release finished.
 */
export async function completeDispatchRollback(opts: DispatchOpts, plan: DispatchAttempt): Promise<void> {
  await updateIssueRuntimeRecord(opts.workspaceDir, opts.project.slug, opts.issueId, current => {
    if (!current) throw new Error("Issue disappeared after dispatch compensation.");
    if (!sameWorkerRun(current.pendingWorkerRelease, plan)) return current;

    return { ...current, pendingWorkerRelease: null, updatedAt: new Date().toISOString() };
  });
}
