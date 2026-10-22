/** Runs provider effects in configured order, retaining a processed prefix on confirmed conflict. */

import { ACTION } from "../../../../domain/index.js";
import { isCompletedCommand, PROVIDER_CLOSED_ISSUE_STATE } from "../../../../integrations/index.js";
import { MERGE_EFFECT_OUTCOME, TRANSITION_GIT_PULL_COMMAND } from "./const.js";
import { applyMergeEffect } from "./merge.js";
import type { TransitionEffectsInput, TransitionEffectsResult } from "./types.js";

/** Execute transition actions under the caller's issue lock.
 * Lifecycle operations read fresh provider state so an interrupted attempt can skip applied setters.
 * @param input - Ordered actions and explicitly supplied capabilities and policy.
 */
export async function executeTransitionEffects(input: TransitionEffectsInput): Promise<TransitionEffectsResult> {
  const { provider, issueId } = input;
  const result: TransitionEffectsResult = { merge: null, processedActions: [], prUrl: input.prUrl ?? undefined };

  for (const action of input.actions) {
    switch (action) {
      case ACTION.MERGE_PR: {
        const selectedUrl = input.prUrl === null ? null : result.prUrl;
        const merge = await applyMergeEffect(provider, issueId, selectedUrl, input.allowedMergeStates);

        result.merge = merge;
        result.prUrl = merge.status.url ?? undefined;
        result.prTitle = merge.status.title;
        result.sourceBranch = merge.status.sourceBranch;
        if (merge.kind === MERGE_EFFECT_OUTCOME.CONFLICT) return result;
        if (merge.kind === MERGE_EFFECT_OUTCOME.NO_PR && !input.allowMissingPr) throw new Error(`No PR available to merge for #${issueId}.`);
        break;
      }

      case ACTION.CLOSE_ISSUE:
      case ACTION.REOPEN_ISSUE: {
        const closed = (await provider.getIssue(issueId)).state === PROVIDER_CLOSED_ISSUE_STATE;

        if (action === ACTION.CLOSE_ISSUE && !closed) await provider.closeIssue(issueId);
        if (action === ACTION.REOPEN_ISSUE && closed) await provider.reopenIssue(issueId);
        break;
      }

      case ACTION.GIT_PULL:
      case ACTION.DETECT_PR:
        try {
          if (action === ACTION.GIT_PULL) {
            if (!input.runCommand || !input.repoPath || input.gitPullMs === undefined) throw new Error("Checkout refresh capabilities are unavailable.");
            const command = await input.runCommand([...TRANSITION_GIT_PULL_COMMAND], { cwd: input.repoPath, timeoutMs: input.gitPullMs });

            if (!isCompletedCommand(command) || command.code !== 0) throw new Error("Checkout refresh did not complete successfully.");
          } else if (!result.prUrl) {
            const status = await provider.getPrStatus(issueId);

            result.prUrl = status.url ?? await provider.getMergedMRUrl(issueId) ?? undefined;
            result.prTitle = status.title;
            result.sourceBranch = status.sourceBranch;
          }
        } catch (error) {
          await input.onWarning?.(action, error).catch(() => {});
        }

        break;
    }

    result.processedActions.push(action);
  }

  return result;
}
