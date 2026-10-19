/**
 * Coordinates dispatch after an atomic local worker reservation. Provider projection,
 * gateway submission and runtime persistence are sequenced effects that may partially complete.
 * This application capability owns the dispatch use case while state retains worker-slot authority.
 */

import { randomUUID } from "node:crypto";

import { log as auditLog } from "../../../audit.js";
import type { WorkerDeliveryState } from "../../../domain/index.js";
import { emptySlot, ISSUE_INTEGRITY_STATUS, NOTIFICATION_CHANNEL, resolveQueuePickup, WORKER_DELIVERY_STATUS } from "../../../domain/index.js";
import { getErrorMessage } from "../../../errors/index.js";
import { AGENT_TURN_STATUS, deleteWorkerSession, ensureSessionModel } from "../../../integrations/index.js";
import { getFallbackEmoji } from "../../../roles/index.js";
import {
  getProject,
  getRoleWorker,
  isIssueCreationReady,
  loadConfig,
  readIssueStateStore,
  readProjects,
  readWorkerDeliveryResolution,
  withIssueOrchestrationLock,
} from "../../../state/index.js";
import { transitionWorkflowLabel } from "../../issue-projection/index.js";
import { getNotificationConfig, NOTIFICATION_EVENT, notify, resolveIssueNotificationEndpoint } from "../../notifications/index.js";
import { acknowledgeComments, confirmReviewSummaryDelivery, EYES_EMOJI, stageReviewSummaryDelivery } from "../../pull-request-feedback/index.js";
import { REVIEW_SUMMARY_RECEIPT_STEP, WORKER_AUDIT_EVENT } from "../const.js";
import { reconcileUncertainDispatch } from "../delivery-recovery/index.js";
import { recordIssueDelivery, recordSlotDelivery } from "../delivery-state.js";
import { shouldClearSession } from "../session-budget.js";
import { formatSessionLabel } from "../session-label.js";
import { auditDispatch } from "./audit.js";
import { settleDispatchDelivery } from "./delivery-settlement.js";
import { loadDispatchContext } from "./dispatch-context.js";
import { buildDispatchPlan } from "./plan.js";
import { beginWorkerDelivery } from "./session-delivery.js";
import { commitWorkerDispatch, completeDispatchRollback, releaseDispatchSlot, reserveDispatchSlot, restoreDispatchRuntime } from "./state.js";
import type { DispatchOpts, DispatchResult } from "./types.js";

/**
 * Dispatch a task to a worker session.
 *
 * Flow:
 *   1. Resolve model, session key, and task context.
 *   2. Atomically reserve the selected worker slot.
 *   3. Confirm the session model and project the selected transition.
 *   4. Persist the exact submitting worker intent before sending the task.
 *   5. Settle delivery evidence, notify, and audit without losing ownership.
 *
 * Failures before agent send release the slot and best-effort restore the provider label.
 * State update failures after dispatch are audited because the session is already running.
 *
 * @param opts - Validated project, issue, worker, provider, and runtime dispatch dependencies.
 */
export async function dispatchTask(
  opts: DispatchOpts,
): Promise<DispatchResult> {
  return withIssueOrchestrationLock(
    opts.workspaceDir,
    opts.project.slug,
    opts.issueId,
    () => dispatchTaskLocked(opts),
  );
}

/**
 * Dispatch while the caller already owns this issue's orchestration lock.
 *
 * @param opts - Validated project, issue, worker, provider, and runtime dispatch dependencies.
 */
export async function dispatchTaskLocked(
  opts: DispatchOpts,
): Promise<DispatchResult> {
  const {
    workspaceDir, agentId, project, issueId, issueTitle,
    issueUrl, role, level, fromLabel, toLabel,
    provider, pluginConfig, runtime,
  } = opts;

  const slotIndex = opts.slotIndex ?? 0;
  const rc = opts.runCommand;

  // ── Setup (no side effects — safe to fail) ──────────────────────────
  const existingState = (await readIssueStateStore(workspaceDir, project.slug)).issues[String(issueId)];

  if (!existingState) throw new Error(`Issue #${issueId} has no initialized local runtime state.`);
  const resolution = await readWorkerDeliveryResolution(workspaceDir, project.slug, issueId);

  if (resolution && !resolution.completed) throw new Error(`Issue #${issueId} has a pending operator delivery resolution.`);

  if (existingState?.activeWorker || existingState?.pendingWorkerRelease) throw new Error(`Issue #${issueId} already has an active worker.`);
  if (existingState?.integrityStatus === ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR) {
    throw new Error(`Issue #${issueId} has integrity_error and cannot be dispatched.`);
  }

  if (existingState && !await isIssueCreationReady(workspaceDir, project.slug, existingState.creationOperationId)) {
    throw new Error(`Issue #${issueId} has an unfinished creation operation.`);
  }

  const resolvedConfig = await loadConfig(workspaceDir, project.slug);
  const source = resolvedConfig.workflow.states[existingState.workflowState];
  const pickup = resolveQueuePickup(resolvedConfig.workflow, existingState.workflowState, role);

  if (!pickup || source.label !== existingState.workflowLabel || source.label !== fromLabel || pickup.toLabel !== toLabel) {
    throw new Error(`Issue #${issueId} no longer matches its configured queue/PICKUP transition.`);
  }

  if (existingState.providerMissing) throw new Error(`Issue #${issueId} is unavailable for dispatch.`);
  const resolvedRole = resolvedConfig.roles[role];

  if (!resolvedRole?.enabled) throw new Error(`Role "${role}" is not configured or is disabled.`);
  const { timeouts } = resolvedConfig;
  const freshProject = getProject(await readProjects(workspaceDir), project.slug);

  if (!freshProject) throw new Error(`Project not found: ${project.slug}`);
  const alreadyReserved = Object.values(freshProject.workers).some((worker) =>
    Object.values(worker.levels).some((slots) => slots?.some((candidate) => candidate.issueId === issueId)));

  if (alreadyReserved) throw new Error(`Issue #${issueId} already has a reserved worker slot.`);
  const roleWorker = getRoleWorker(freshProject, role);
  const slot = roleWorker.levels[level]?.[slotIndex] ?? emptySlot();

  if (slot.active || (slot.issueId !== null && slot.issueId !== issueId)) {
    throw new Error(`Worker slot ${role}:${level}:${slotIndex} is already reserved and requires reconciliation.`);
  }

  const clearExisting = Boolean(slot.sessionKey && timeouts.sessionContextBudget < 1
    && await shouldClearSession(slot.sessionKey, slot.issueId, issueId, timeouts, workspaceDir, project.name, rc));
  const plan = { ...buildDispatchPlan({
    project, agentId, issueId, role, level, slotIndex, slot, resolvedRole, clearExisting,
  }), deliveryId: randomUUID(), startedAt: new Date().toISOString() };
  const { model, botName, sessionKey, sessionKeyToDelete, sessionAction } = plan;

  const context = await loadDispatchContext(opts, resolvedConfig);
  const { comments, prFeedback, isConflictFix, taskMessage, roleInstructions } = context;

  await reserveDispatchSlot(opts, plan, resolvedConfig);
  let taskDispatched = false;
  let providerProjectionAttempted = false;

  try {
    if (sessionKeyToDelete) {
      await deleteWorkerSession(sessionKeyToDelete, rc).catch(() => {});
    }

    const sessionLabel = formatSessionLabel(project.name, role, level, botName);

    await ensureSessionModel(sessionKey, model, rc, timeouts.sessionPatchMs, sessionLabel);

    // ── Provider transition — compensated if agent send does not begin ──
    providerProjectionAttempted = true;
    await transitionWorkflowLabel(provider, resolvedConfig.workflow, issueId, fromLabel, toLabel);

    const issue = await provider.getIssue(issueId);
    const submitting: WorkerDeliveryState = { operationId: plan.deliveryId, status: WORKER_DELIVERY_STATUS.SUBMITTING,
      recordedAt: plan.startedAt, reason: "Worker intent committed before gateway submission." };

    await commitWorkerDispatch(opts, plan, resolvedConfig, issue.labels, submitting);
    await stageReviewSummaryDelivery({ workspaceDir, projectSlug: project.slug }, issueId, plan.deliveryId, plan, prFeedback);

    // Model is set on the session via sessions.patch, not on the agent RPC —
    // the gateway's agent endpoint rejects unknown properties like 'model'.
    const delivery = await beginWorkerDelivery(sessionKey, taskMessage, {
      submissionId: plan.deliveryId,
      agentId,
      orchestratorSessionKey: opts.sessionKey,
      dispatchTimeoutMs: timeouts.dispatchMs,
      extraSystemPrompt: roleInstructions.trim() || undefined,
      runCommand: rc,
    });

    if (delivery.initial.kind === AGENT_TURN_STATUS.REJECTED) throw new Error(delivery.initial.reason);
    taskDispatched = true;

    const deliveryStatus = delivery.initial.kind === WORKER_DELIVERY_STATUS.PENDING ? WORKER_DELIVERY_STATUS.PENDING
      : delivery.initial.kind === AGENT_TURN_STATUS.UNKNOWN ? AGENT_TURN_STATUS.UNKNOWN : AGENT_TURN_STATUS.ACCEPTED;
    const unresolved: WorkerDeliveryState | undefined = delivery.initial.kind === AGENT_TURN_STATUS.ACCEPTED ? undefined : {
      operationId: plan.deliveryId,
      status: delivery.initial.kind === WORKER_DELIVERY_STATUS.PENDING ? WORKER_DELIVERY_STATUS.PENDING : WORKER_DELIVERY_STATUS.UNKNOWN,
      recordedAt: plan.startedAt,
      reason: delivery.initial.kind === WORKER_DELIVERY_STATUS.PENDING
        ? "Gateway command is still running; turn acceptance is unconfirmed."
        : delivery.initial.reason,
    };

    // Settle local acceptance before removing the slot's durable submission protection.
    try {
      await recordIssueDelivery(workspaceDir, project.slug, issueId, sessionKey, plan.deliveryId, unresolved);
      await recordSlotDelivery(workspaceDir, project.slug, issueId, plan, unresolved);
    } catch (error) {
      await auditLog(workspaceDir, WORKER_AUDIT_EVENT.WARNING, { issue: issueId, role,
        step: "settleDelivery", error: getErrorMessage(error) }).catch(() => {});
    }

    // Notify only after the gateway did not explicitly reject delivery.
    const notifyConfig = getNotificationConfig(pluginConfig);
    const notifyTarget = await resolveIssueNotificationEndpoint(workspaceDir, project, issueId).catch(() => undefined);

    notify({
      type: NOTIFICATION_EVENT.WORKER_START, project: project.name, issueId, issueTitle, issueUrl,
      role, level, name: botName, sessionAction,
    }, {
      workspaceDir, config: notifyConfig,
      channelId: notifyTarget?.channelId,
      channel: notifyTarget?.channel ?? NOTIFICATION_CHANNEL.TELEGRAM,
      threadId: notifyTarget?.threadId, runtime,
      accountId: notifyTarget?.accountId,
      agentId: project.agentId, runCommand: rc,
    }).catch((err) => {
      auditLog(workspaceDir, WORKER_AUDIT_EVENT.WARNING, {
        step: "notify", issue: issueId, role, error: getErrorMessage(err),
      }).catch(() => { });
    });

    if (delivery.initial.kind === AGENT_TURN_STATUS.UNKNOWN) {
      await reconcileUncertainDispatch({
        workspaceDir, projectSlug: project.slug, role, level, slotIndex, issueId, sessionKey, deliveryId: plan.deliveryId,
        runCommand: rc, reason: delivery.initial.reason, outcomeUnknown: true,
      })
        .catch(() => { });
    }

    if (delivery.initial.kind === WORKER_DELIVERY_STATUS.PENDING) {
      delivery.settled.then((outcome) => settleDispatchDelivery(opts, plan, context, outcome)).catch(() => {});
    }

    if (delivery.initial.kind === AGENT_TURN_STATUS.ACCEPTED) {
      provider.reactToIssue(issueId, EYES_EMOJI).catch(() => {});
      provider.reactToPr(issueId, EYES_EMOJI).catch(() => {});
      if (prFeedback) {
        await confirmReviewSummaryDelivery({ workspaceDir, projectSlug: project.slug }, issueId, plan.deliveryId).catch(error =>
          auditLog(workspaceDir, WORKER_AUDIT_EVENT.WARNING, { step: REVIEW_SUMMARY_RECEIPT_STEP, issue: issueId,
            error: getErrorMessage(error) }).catch(() => {}));
      }

      acknowledgeComments(provider, issueId, isConflictFix ? [] : comments, prFeedback, workspaceDir).catch(() => {});
    }

    // Audit successful reservation and the observed delivery status.
    await auditDispatch(workspaceDir, {
      project: project.name, issueId, issueTitle,
      role, level, model, sessionAction, sessionKey,
      fromLabel, toLabel,
    }).catch(() => { });

    const presentation = { role, issueId, issueTitle, issueUrl, botName, emoji: resolvedRole.levels[level]?.emoji ?? getFallbackEmoji(role) };

    return { sessionAction, sessionKey, level, model, ...presentation, deliveryStatus, deliveryId: plan.deliveryId };
  } catch (error) {
    if (!taskDispatched) {
      if (providerProjectionAttempted) {
        try {
          await transitionWorkflowLabel(provider, resolvedConfig.workflow, issueId, toLabel, fromLabel);
        } catch (rollbackError) {
          await auditLog(workspaceDir, WORKER_AUDIT_EVENT.WARNING, {
            step: "restoreProviderLabel",
            issue: issueId,
            role,
            error: getErrorMessage(rollbackError),
          }).catch(() => { });
        }
      }

      try {
        await restoreDispatchRuntime(opts, plan, existingState);
        await releaseDispatchSlot(opts, plan);
        await completeDispatchRollback(opts, plan);
      } catch (rollbackError) {
        await auditLog(workspaceDir, WORKER_AUDIT_EVENT.WARNING, {
          step: "releaseWorkerReservation",
          issue: issueId,
          role,
          error: getErrorMessage(rollbackError),
        }).catch(() => { });
      }
    }

    throw error;
  }
}
