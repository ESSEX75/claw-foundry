/**
 * Pipeline service — declarative completion rules.
 *
 * Uses workflow config to determine transitions and side effects.
 */

import { isDeepStrictEqual } from "node:util";

import { log as auditLog } from "../../audit.js";
import { COMPLETION_RESULT, DEFAULT_ROLES, findStateByLabel, resolveIssueClosedAt, sameWorkerRun, STATE_TYPE, type WorkflowConfig } from "../../domain/index.js";
import {
  getProject, getRoleWorker, isIssueCreationReady, loadConfig, readIssueStateStore, readProjects, readWorkerDeliveryResolution, withIssueOrchestrationLock,
} from "../../state/index.js";
import { reconcileManagedLabelsLocked } from "../projection/index.js";
import { confirmReviewSummaryDelivery } from "../review/index.js";
import { renderCompletionAnnouncement } from "./announcement.js";
import { resumeCompletionArchive } from "./completion-archive.js";
import { notifyCompletion } from "./completion-notifications.js";
import { PIPELINE_AUDIT, PIPELINE_OWNER } from "./const.js";
import { planCompletion, planMergeFailure } from "./plan.js";
import { requireCompletionPullRequest, validateCompletionFrame } from "./preconditions.js";
import { executeCompletionActions } from "./provider-actions.js";
import { releaseTransitionWorkerLocked } from "./recovery.js";
import { archiveTerminalIssueLocked } from "./terminal-archive.js";
import { commitWorkflowTransitionLocked } from "./transition.js";
import type { CompletionInput, CompletionOutput } from "./types.js";

/**
 * Execute the completion side-effects for a role:result pair.
 * @param opts - Resolved worker completion request and runtime dependencies.
 */
export async function executeCompletion(opts: CompletionInput): Promise<CompletionOutput> {
  return withIssueOrchestrationLock(
    opts.workspaceDir,
    opts.projectSlug,
    opts.issueId,
    () => executeCompletionLocked(opts),
  );
}

/** Plan, execute, commit, release, and notify while holding the issue lock.
 * @param opts - Worker completion request whose source state must still be current.
 */
async function executeCompletionLocked(opts: CompletionInput): Promise<CompletionOutput> {
  const {
    workspaceDir, projectSlug, role, result, issueId, provider,
    projectName,
  } = opts;

  const key = `${role}:${result}`;
  const config = await loadConfig(workspaceDir, projectSlug);

  const workflow: WorkflowConfig = config.workflow;
  const completion = config.roles[role]?.completion;

  if (!completion) throw new Error(`No completion event configured for ${key}`);
  const completionPlan = planCompletion(workflow, role, result, completion);

  if (opts.workflow && !isDeepStrictEqual(planCompletion(opts.workflow, role, result, completion).transition, completionPlan.transition)) {
    throw new Error("Workflow changed before completion; reload project configuration and retry.");
  }

  const { rule } = completionPlan;

  const project = getProject(await readProjects(workspaceDir), projectSlug);

  if (!project) {
    throw new Error(`Project "${projectSlug}" not found.`);
  }

  const currentState = (await readIssueStateStore(workspaceDir, projectSlug)).issues[String(issueId)];

  if (!currentState) throw new Error(`Issue #${issueId} has no initialized local runtime state.`);

  const expected = opts.expectedWorker;
  const receipt = validateCompletionFrame(currentState, project, opts, workflow, rule.from);
  const resuming = receipt !== undefined;

  if (!resuming && !await isIssueCreationReady(workspaceDir, projectSlug, currentState.creationOperationId)) {
    throw new Error(`Issue #${issueId} is not ready for completion.`);
  }

  const effectivePlan = resuming ? { ...completionPlan, rule: { ...rule, to: receipt.toLabel, actions: [...receipt.actions] },
    transition: { ...completionPlan.transition, toState: receipt.toState, toLabel: receipt.toLabel, actions: receipt.actions },
    nextState: receipt.toLabel === rule.to ? completionPlan.nextState : receipt.toLabel } : completionPlan;
  const deliveryResolution = await readWorkerDeliveryResolution(workspaceDir, projectSlug, issueId);

  if (deliveryResolution && !deliveryResolution.completed) throw new Error(`Issue #${issueId} has a pending operator delivery resolution.`);

  if (receipt) {
    const archived = await resumeCompletionArchive({ ...opts, workflow }, currentState, receipt, effectivePlan);

    if (archived) return archived;
  }

  const pendingSummaries = currentState.pendingReviewSummaryDelivery;

  if (pendingSummaries && sameWorkerRun(pendingSummaries.worker, expected)) {
    await confirmReviewSummaryDelivery({ workspaceDir, projectSlug }, issueId, pendingSummaries.operationId);
  }

  const currentIssue = await provider.getIssue(issueId);

  const selectedPrUrl = !resuming && role === DEFAULT_ROLES.DEVELOPER && result === COMPLETION_RESULT.DONE
    ? await requireCompletionPullRequest(provider, issueId, opts.prUrl) : resuming ? receipt?.prUrl ?? opts.prUrl : opts.prUrl;
  const actions = resuming
    ? { prUrl: selectedPrUrl, mergedPr: false, mergeFailure: null }
    : await executeCompletionActions({ ...opts, prUrl: selectedPrUrl }, rule, config.timeouts.gitPullMs);
  const { prUrl, mergeFailure } = actions;

  const issue = currentIssue;

  if (mergeFailure) {
    const failedTransition = planMergeFailure(workflow, rule.from);

    if (!failedTransition) {
      throw new Error(`mergePr failed for #${issueId}, and workflow has no MERGE_FAILED recovery transition: ${mergeFailure.error}`);
    }

    const recovery = await executeCompletionActions({ ...opts, prUrl },
      { from: failedTransition.from, to: failedTransition.toLabel, actions: [...failedTransition.actions] }, config.timeouts.gitPullMs);

    if (recovery.mergeFailure) throw new Error(`Recovery merge failed: ${recovery.mergeFailure.error}`);
    const lifecycleActions = [...(actions.processedActions ?? []), ...failedTransition.actions];
    const closedAt = resolveIssueClosedAt(lifecycleActions, currentState.closedAt, new Date().toISOString());

    await commitWorkflowTransitionLocked({
      workspaceDir,
      project,
      issueId,
      provider,
      issue,
      workflow,
      plan: failedTransition,
      closedAt,
      completion: { worker: { role: expected.role, level: expected.level, slotIndex: expected.slotIndex,
        sessionKey: expected.sessionKey, startedAt: expected.startedAt }, result, fromState: currentState.workflowState,
        toState: failedTransition.toState, toLabel: failedTransition.toLabel, prUrl, actions: lifecycleActions },
      roles: Object.keys(config.roles),
      owner: PIPELINE_OWNER.MERGE_FAILURE,
    });

    await auditLog(workspaceDir, PIPELINE_AUDIT.TRANSITION, {
      project: projectName,
      issue: issueId,
      role,
      from: rule.from,
      to: failedTransition.toLabel,
      reason: "merge_failed",
      error: mergeFailure.error,
    });

    return {
      labelTransition: `${rule.from} → ${failedTransition.toLabel}`,
      announcement: `⚠️ MERGE FAILED #${issueId} — ${mergeFailure.error}\n📋 [Issue #${issueId}](${issue.web_url})\n→ ${failedTransition.toLabel}.`,
      nextState: failedTransition.toLabel,
      prUrl,
      issueUrl: issue.web_url,
      issueClosed: (closedAt === undefined ? currentState.closedAt : closedAt) !== null,
      issueReopened: closedAt === null,
    };
  }

  // Get next state description from workflow
  const nextState = effectivePlan.nextState;

  // Retrieve worker name from project state (best-effort)
  let workerName: string | undefined;

  try {
    if (opts.level !== undefined && opts.slotIndex !== undefined) {
      const roleWorker = getRoleWorker(project, role);
      const slot = roleWorker.levels[opts.level]?.[opts.slotIndex];

      workerName = slot?.name;
    }
  } catch {
    // Best-effort — don't fail notification if name retrieval fails
  }

  if (!resuming) await commitWorkflowTransitionLocked({
    workspaceDir,
    project,
    issueId,
    provider,
    workflow,
    plan: completionPlan.transition,
    completion: { worker: { role: expected.role, level: expected.level, slotIndex: expected.slotIndex,
      sessionKey: expected.sessionKey, startedAt: expected.startedAt }, result, fromState: currentState.workflowState,
      toState: completionPlan.transition.toState, toLabel: rule.to, prUrl, actions: [...rule.actions] },
    owner: PIPELINE_OWNER.COMPLETION,
    issue,
    roles: Object.keys(config.roles),
  });
  if (resuming) {
    await releaseTransitionWorkerLocked(workspaceDir, projectSlug, issueId);
    await reconcileManagedLabelsLocked({ workspaceDir, projectSlug, issueId, provider, workflow, roles: Object.keys(config.roles), owner: PIPELINE_OWNER.COMPLETION });
  }

  const runtimeState = (await readIssueStateStore(workspaceDir, projectSlug)).issues[String(issueId)];

  if (!runtimeState) throw new Error(`Completion state for #${issueId} was not persisted.`);

  await notifyCompletion({ opts: { ...opts, workflow }, project, issue, runtimeState, plan: effectivePlan, actions, workerName, notifyAuxiliary: !resuming });
  const targetState = findStateByLabel(workflow, effectivePlan.rule.to);

  if (targetState?.type === STATE_TYPE.TERMINAL) {
    await archiveTerminalIssueLocked({
      workspaceDir,
      projectSlug,
      issueId,
      workflow,
      issue,
      actor: PIPELINE_OWNER.COMPLETION,
      workflowState: runtimeState.workflowState,
    });
  }

  const announcement = renderCompletionAnnouncement(opts, issue.web_url, prUrl, nextState);

  return {
    labelTransition: `${rule.from} → ${effectivePlan.rule.to}`,
    announcement,
    nextState,
    prUrl,
    issueUrl: issue.web_url,
    issueClosed: runtimeState.closedAt !== null,
    issueReopened: resolveIssueClosedAt(effectivePlan.rule.actions, currentState.closedAt, new Date().toISOString()) === null,
  };
}
