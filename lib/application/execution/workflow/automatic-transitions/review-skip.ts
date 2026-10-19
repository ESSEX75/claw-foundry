/**
 * review-skip.ts — Auto-merge and transition review:skip issues through the review queue.
 *
 * When local reviewPolicy is "skip", issues arrive in the review queue
 * through issues.json state. This pass auto-merges their PR and
 * transitions them to the next state (e.g. toTest), executing the
 * SKIP event's configured actions (mergePr, gitPull).
 */

import { log as auditLog } from "../../../../audit.js";
import { DEFAULT_ROLES, REVIEW_POLICY, REVIEW_ROUTING_FIELD, ROUTING_LABELS, STATE_TYPE, WORKFLOW_EVENT } from "../../../../domain/index.js";
import { getErrorMessage } from "../../../../errors/index.js";
import { executeTransitionEffects, MERGE_EFFECT_OUTCOME } from "../effects/index.js";
import { planWorkflowEvent } from "../planning/index.js";
import { executeAutomaticTransition } from "../transitions/index.js";
import { DEFAULT_REVIEW_GIT_PULL_TIMEOUT_MS, REVIEW_AUDIT_EVENT, REVIEW_TRANSITION_OWNER } from "./const.js";
import { getAutomaticTransitionCandidates } from "./queries.js";
import type { ReviewEffectsCapture, ReviewSkipPassInput } from "./types.js";

/**
 * Scan review queue states and auto-merge + transition issues with reviewPolicy=skip.
 * Returns the number of transitions made.
 * @param opts - Project workflow and provider actions for the explicit skip policy.
 */
export async function reviewSkipPass(opts: ReviewSkipPassInput): Promise<number> {
  const { workspaceDir, projectName, project, workflow, provider, repoPath,
    gitPullTimeoutMs = DEFAULT_REVIEW_GIT_PULL_TIMEOUT_MS, onMerge } = opts;
  let transitions = 0;

  //TODO: The behavior of the tester, reviewer, etc. is hard-coded.
  // Find review queue states (role=reviewer, type=queue) that have a SKIP event
  const reviewQueueStates = Object.entries(workflow.states)
    .filter(([, state]) => state.role === DEFAULT_ROLES.REVIEWER && state.type === STATE_TYPE.QUEUE);

  for (const [, state] of reviewQueueStates) {
    const skipTransition = planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.SKIP);

    if (!skipTransition) continue;

    const targetKey = skipTransition.toState;
    const actions = skipTransition.actions;
    const targetState = workflow.states[targetKey];

    if (!targetState) continue;

    const candidates = await getAutomaticTransitionCandidates({
      workspaceDir,
      projectSlug: project.slug,
      workflowLabel: state.label,
      provider,
      routing: { field: REVIEW_ROUTING_FIELD, value: REVIEW_POLICY.SKIP },
    });

    for (const { issue } of candidates) {

      let mergeFailure: unknown;
      const effects: ReviewEffectsCapture = {};
      let transitioned: boolean;

      try {
        transitioned = await executeAutomaticTransition({
          workspaceDir, project, issueId: issue.iid, provider, workflow,
          fromLabel: state.label, workflowState: targetKey, actions,
          workflowLabel: targetState.label, owner: REVIEW_TRANSITION_OWNER.REVIEW_SKIP,
          routing: { field: REVIEW_ROUTING_FIELD, value: REVIEW_POLICY.SKIP },
          beforeCommit: async () => {
            effects.result = await executeTransitionEffects({
              provider, issueId: issue.iid, actions, allowMissingPr: true,
              runCommand: opts.runCommand, repoPath, gitPullMs: gitPullTimeoutMs,
            });
            if (effects.result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT) {
              mergeFailure = new Error(`Confirmed merge conflict: ${effects.result.prUrl}`);
              throw mergeFailure;
            }
          },
        });
      } catch (error) {
        if (mergeFailure === undefined) throw error;
        await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.SKIP_MERGE_FAILED, {
          project: projectName, issueId: issue.iid, from: state.label,
          error: getErrorMessage(error),
        });
        const failed = planWorkflowEvent(workflow, state.label, WORKFLOW_EVENT.MERGE_FAILED);

        if (failed && await executeAutomaticTransition({
          workspaceDir, project, issueId: issue.iid, provider, workflow,
          fromLabel: state.label, workflowState: failed.toState, actions: [...(effects.result?.processedActions ?? []), ...failed.actions],
          workflowLabel: failed.toLabel, owner: REVIEW_TRANSITION_OWNER.REVIEW_SKIP_MERGE_FAILURE,
          routing: { field: REVIEW_ROUTING_FIELD, value: REVIEW_POLICY.SKIP },
          beforeCommit: async () => {
            const result = await executeTransitionEffects({ provider, issueId: issue.iid, actions: failed.actions,
              prUrl: effects.result?.prUrl, runCommand: opts.runCommand, repoPath, gitPullMs: gitPullTimeoutMs });

            if (result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT) throw new Error(`Unresolved recovery merge conflict: ${result.prUrl}`);
          },
        })) transitions++;
        continue;
      }

      if (!transitioned) continue;
      if (effects.result?.merge?.kind === MERGE_EFFECT_OUTCOME.MERGED) {
        const status = effects.result.merge.status;

        onMerge?.(issue.iid, status.url, status.title, status.sourceBranch);
      }

      await auditLog(workspaceDir, REVIEW_AUDIT_EVENT.SKIP_TRANSITION, {
        project: projectName,
        issueId: issue.iid,
        from: state.label,
        to: targetState.label,
        reason: ROUTING_LABELS.REVIEW_SKIP,
      });

      transitions++;
    }
  }

  return transitions;
}
