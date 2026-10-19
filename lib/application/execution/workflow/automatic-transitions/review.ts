/**
 * review.ts — Poll review-type states for PR status changes.
 *
 * Scans review states in the workflow and transitions issues
 * whose PR check condition (merged/approved) is met.
 * Called by the heartbeat service during its periodic sweep.
 */

import { log as auditLog } from "../../../../audit.js";
import { REVIEW_CHECK, REVIEW_POLICY, REVIEW_ROUTING_FIELD, type TransitionAction, WORKFLOW_EVENT } from "../../../../domain/index.js";
import { getErrorMessage } from "../../../../errors/index.js";
import { PR_STATE } from "../../../../integrations/index.js";
import { observePrStatusWithReceipts } from "../../feedback/index.js";
import { executeTransitionEffects, MERGE_EFFECT_OUTCOME } from "../effects/index.js";
import { planWorkflowEvent } from "../planning/index.js";
import { executeAutomaticTransition } from "../transitions/index.js";
import { DEFAULT_REVIEW_GIT_PULL_TIMEOUT_MS, REVIEW_AUDIT_EVENT, REVIEW_OUTCOME, REVIEW_TRANSITION_OWNER, REVIEW_TRANSITION_REASON } from "./const.js";
import { getAutomaticTransitionCandidates } from "./queries.js";
import { classifyReviewOutcome } from "./review-outcome.js";
import type { ReviewEffectsCapture, ReviewPassInput } from "./types.js";

/**
 * Scan review-type states and transition issues whose PR check condition is met.
 * Returns the number of transitions made.
 * @param opts - Project workflow, provider, and callbacks invoked after committed transitions.
 */
export async function reviewPass(opts: ReviewPassInput): Promise<number> {
  const { workspaceDir, projectName, project, workflow, provider, repoPath,
    gitPullTimeoutMs = DEFAULT_REVIEW_GIT_PULL_TIMEOUT_MS, baseBranch, onMerge, onFeedback, onPrClosed } = opts;
  let transitions = 0;

  // Find all states with a review check (e.g. toReview with check: prApproved)
  const reviewStates = Object.values(workflow.states).filter((state) => state.check != null);

  for (const state of reviewStates) {
    if (!state.on || !state.check) continue;

    const candidates = await getAutomaticTransitionCandidates({
      workspaceDir,
      projectSlug: project.slug,
      workflowLabel: state.label,
      provider,
      routing: { field: REVIEW_ROUTING_FIELD, value: REVIEW_POLICY.HUMAN },
    });

    for (const { issue } of candidates) {

      const status = await observePrStatusWithReceipts(provider, issue.iid, { workspaceDir, projectSlug: project.slug });
      const syncTransitionState = async (
        targetKey: string,
        targetLabel: string,
        actions: readonly TransitionAction[] = [],
        beforeCommit?: () => Promise<void>,
      ): Promise<boolean> => {
        return executeAutomaticTransition({
          workspaceDir,
          project,
          issueId: issue.iid,
          provider,
          workflow,
          fromLabel: state.label,
          workflowState: targetKey,
          workflowLabel: targetLabel,
          actions,
          owner: REVIEW_TRANSITION_OWNER.REVIEW,
          beforeCommit: beforeCommit ?? (async () => {
            const result = await executeTransitionEffects({ provider, issueId: issue.iid, actions, prUrl: status.url,
              runCommand: opts.runCommand, repoPath, gitPullMs: gitPullTimeoutMs });

            if (result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT) throw new Error(`Unresolved merge conflict: ${result.prUrl}`);
          }),
          routing: { field: REVIEW_ROUTING_FIELD, value: REVIEW_POLICY.HUMAN },
        });
      };

      // Fallback: no PR found, but work may have been committed directly to base branch.
      // Check git history for commits mentioning this issue number.
      if (!status.url && status.state === PR_STATE.CLOSED && baseBranch) {
        try {
          const isOnBranch = await provider.isCommitOnBaseBranch(issue.iid, baseBranch);

          if (isOnBranch) {
            status.state = PR_STATE.MERGED;
            await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.GIT_FALLBACK, {
              project: projectName, issueId: issue.iid,
              reason: REVIEW_TRANSITION_REASON.COMMIT_ON_BASE_BRANCH,
              baseBranch,
            });
          }
        } catch { /* best-effort — don't block on git failure */ }
      }

      const outcome = classifyReviewOutcome(
        status,
        state.check,
        planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.CHANGES_REQUESTED) !== null,
        planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.MERGE_CONFLICT) !== null,
      );

      // Changes requested or PR has comment feedback → transition to toImprove
      if (outcome.kind === REVIEW_OUTCOME.CHANGES_REQUESTED) {
        const changesTransition = planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.CHANGES_REQUESTED);

        if (changesTransition) {
          const targetKey = changesTransition.toState;
          const targetState = workflow.states[targetKey];

          if (targetState) {
            if (!await syncTransitionState(targetKey, targetState.label, changesTransition.actions)) continue;
            await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.TRANSITION, {
              project: projectName, issueId: issue.iid,
              from: state.label, to: targetState.label,
              reason: status.state === PR_STATE.HAS_COMMENTS
                ? REVIEW_TRANSITION_REASON.PR_COMMENTS : REVIEW_TRANSITION_REASON.CHANGES_REQUESTED,
              prUrl: status.url,
            });
            onFeedback?.(issue.iid, REVIEW_TRANSITION_REASON.CHANGES_REQUESTED, status.url, issue.title, issue.web_url, targetState.label);
            transitions++;
            continue;
          }
        }
      }

      // Merge conflict → transition to toImprove
      if (outcome.kind === REVIEW_OUTCOME.CONFLICT) {
        const conflictTransition = planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.MERGE_CONFLICT);

        if (conflictTransition) {
          const targetKey = conflictTransition.toState;
          const targetState = workflow.states[targetKey];

          if (targetState) {
            if (!await syncTransitionState(targetKey, targetState.label, conflictTransition.actions)) continue;
            await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.TRANSITION, {
              project: projectName, issueId: issue.iid,
              from: state.label, to: targetState.label,
              reason: REVIEW_TRANSITION_REASON.MERGE_CONFLICT,
              prUrl: status.url,
            });
            onFeedback?.(issue.iid, REVIEW_TRANSITION_REASON.MERGE_CONFLICT, status.url, issue.title, issue.web_url, targetState.label);
            transitions++;
            continue;
          }
        }
      }

      // PR closed without merging → execute configured transition + actions
      // status.url non-null distinguishes "PR was explicitly closed" from "no PR exists"
      if (outcome.kind === REVIEW_OUTCOME.CLOSED_UNMERGED) {
        const closedTransition = planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.PR_CLOSED);

        if (closedTransition) {
          const targetKey = closedTransition.toState;
          const closedActions = closedTransition.actions;
          const targetState = workflow.states[targetKey];

          if (targetState) {
            if (!await syncTransitionState(
              targetKey,
              targetState.label,
              closedActions,
              async () => {
                const fresh = await provider.getPrStatus(issue.iid, status.url ?? undefined);

                if (fresh.url !== status.url || fresh.state !== PR_STATE.CLOSED) throw new Error("Selected PR is no longer closed.");
                const result = await executeTransitionEffects({ provider, issueId: issue.iid, actions: closedActions, prUrl: status.url,
                  runCommand: opts.runCommand, repoPath, gitPullMs: gitPullTimeoutMs });

                if (result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT) throw new Error(`Unresolved merge conflict: ${result.prUrl}`);
              },
            )) continue;
            await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.TRANSITION, {
              project: projectName, issueId: issue.iid,
              from: state.label, to: targetState.label,
              reason: REVIEW_TRANSITION_REASON.PR_CLOSED,
              prUrl: status.url,
              actions: closedActions,
            });
            onPrClosed?.(issue.iid, status.url, issue.title, issue.web_url, targetState.label);
            transitions++;
            continue;
          }
        }
      }

      if (outcome.kind !== REVIEW_OUTCOME.APPROVED) continue;

      // Find the success transition — use the APPROVED event (matches check condition)
      const transition = planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.APPROVED);

      if (!transition) continue;

      const targetKey = transition.toState;
      const actions = transition.actions;
      const targetState = workflow.states[targetKey];

      if (!targetState) continue;

      let mergeFailure: unknown;
      const effects: ReviewEffectsCapture = {};
      let transitioned: boolean;

      try {
        transitioned = await syncTransitionState(targetKey, targetState.label, actions, async () => {
          const fresh = await provider.getPrStatus(issue.iid, status.url ?? undefined);

          if (fresh.url !== status.url) throw new Error("Selected PR changed before review transition.");
          if (!fresh.url && baseBranch && await provider.isCommitOnBaseBranch(issue.iid, baseBranch)) fresh.state = PR_STATE.MERGED;
          if (!state.check || classifyReviewOutcome(fresh, state.check, true, true).kind !== REVIEW_OUTCOME.APPROVED) {
            throw new Error("PR no longer satisfies the configured review gate.");
          }

          effects.result = await executeTransitionEffects({
            provider, issueId: issue.iid, actions, prUrl: status.url,
            allowMissingPr: !fresh.url && fresh.state === PR_STATE.MERGED,
            allowedMergeStates: state.check === REVIEW_CHECK.PR_MERGED ? [PR_STATE.MERGED] : [PR_STATE.APPROVED, PR_STATE.MERGED],
            runCommand: opts.runCommand, repoPath, gitPullMs: gitPullTimeoutMs,
          });
          if (effects.result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT) {
            mergeFailure = new Error(`Confirmed merge conflict: ${effects.result.prUrl}`);
            throw mergeFailure;
          }
        });
      } catch (error) {
        if (mergeFailure === undefined) throw error;
        await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.MERGE_FAILED, {
          project: projectName, issueId: issue.iid, from: state.label,
          error: getErrorMessage(error),
        });
        const failed = planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.MERGE_FAILED);

        if (failed && await syncTransitionState(failed.toState, failed.toLabel,
          [...(effects.result?.processedActions ?? []), ...failed.actions], async () => {
            const result = await executeTransitionEffects({ provider, issueId: issue.iid, actions: failed.actions,
              prUrl: effects.result?.prUrl, runCommand: opts.runCommand, repoPath, gitPullMs: gitPullTimeoutMs });

            if (result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT) throw new Error(`Unresolved recovery merge conflict: ${result.prUrl}`);
          })) {
          await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.TRANSITION, {
            project: projectName, issueId: issue.iid, from: state.label,
            to: failed.toLabel, reason: REVIEW_TRANSITION_REASON.MERGE_FAILED,
          });
          transitions++;
        }

        continue;
      }

      if (!transitioned) continue;
      if (effects.result?.merge?.kind === MERGE_EFFECT_OUTCOME.MERGED) onMerge?.(issue.iid, status.url, status.title, status.sourceBranch);

      await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.TRANSITION, {
        project: projectName,
        issueId: issue.iid,
        from: state.label,
        to: targetState.label,
        check: state.check,
        prState: status.state,
        prUrl: status.url,
      });

      transitions++;
    }
  }

  return transitions;
}
