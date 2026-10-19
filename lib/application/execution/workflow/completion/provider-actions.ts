/** Adapts shared ordered effects to completion diagnostics and result observations. */

import { log as auditLog } from "../../../../audit.js";
import { ACTION, type CompletionRule } from "../../../../domain/index.js";
import { getErrorMessage } from "../../../../errors/index.js";
import { executeTransitionEffects, MERGE_EFFECT_OUTCOME } from "../effects/index.js";
import { COMPLETION_EFFECT_AUDIT } from "./const.js";
import type { CompletionActions, CompletionInput } from "./types.js";

/** Perform configured actions; uncertain provider responses preserve the local source for retry.
 * @param opts - Command identity and provider capabilities.
 * @param rule - Validated ordered workflow actions.
 * @param gitPullMs - Best-effort checkout refresh timeout.
 */
export async function executeCompletionActions(opts: Omit<CompletionInput, "expectedWorker">, rule: CompletionRule<string>, gitPullMs: number): Promise<CompletionActions> {
  const result = await executeTransitionEffects({
    provider: opts.provider, issueId: opts.issueId, actions: rule.actions, prUrl: opts.prUrl,
    runCommand: opts.runCommand, repoPath: opts.repoPath, gitPullMs,
    onWarning: async (step, error) => { await auditLog(opts.workspaceDir, COMPLETION_EFFECT_AUDIT.WARNING, {
      step, issue: opts.issueId, role: opts.role, error: getErrorMessage(error),
    }); },
  });
  const mergeFailure = result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT ? { error: `Merge conflict: ${result.prUrl}` } : null;

  if (mergeFailure) await auditLog(opts.workspaceDir, COMPLETION_EFFECT_AUDIT.ACTION_FAILED, {
    step: ACTION.MERGE_PR, issue: opts.issueId, role: opts.role, from: rule.from, attemptedTo: rule.to, error: mergeFailure.error,
  });

  return { ...result, mergedPr: result.merge?.kind === MERGE_EFFECT_OUTCOME.MERGED, mergeFailure };
}
