/** Performs a single exact PR merge and reconciles an ambiguous command response by observation. */

import { type IssueProvider, PR_STATE,type PrState } from "../../../integrations/index.js";
import { MERGE_EFFECT_OUTCOME } from "./const.js";
import type { MergeEffectResult } from "./types.js";

/** Merge only the selected PR; never translate an unknown response into a conflict.
 * @param provider - Exact PR observation and mutation capabilities.
 * @param issueId - Issue identifying the request when no URL has been captured yet.
 * @param prUrl - Previously captured identity, including null for captured absence.
 * @param allowedStates - Fresh states permitted by a caller's review gate.
 */
export async function applyMergeEffect(provider: Pick<IssueProvider, "getPrStatus" | "mergePr">,
  issueId: number, prUrl?: string | null, allowedStates?: readonly PrState[]): Promise<MergeEffectResult> {
  const observed = await provider.getPrStatus(issueId, prUrl ?? undefined);

  if (prUrl !== undefined && observed.url !== prUrl) throw new Error("Selected PR changed before merge.");
  if (!observed.url) return { kind: MERGE_EFFECT_OUTCOME.NO_PR, status: observed };
  if (observed.state === PR_STATE.MERGED) return { kind: MERGE_EFFECT_OUTCOME.MERGED, status: observed };
  if (allowedStates && !allowedStates.includes(observed.state)) throw new Error("PR no longer satisfies the configured review gate.");
  if (observed.state === PR_STATE.CLOSED) throw new Error(`Selected PR is closed: ${observed.url}`);
  if (observed.mergeable === false) return { kind: MERGE_EFFECT_OUTCOME.CONFLICT, status: observed };
  const selectedUrl = observed.url;

  try {
    await provider.mergePr(issueId, selectedUrl);

    return { kind: MERGE_EFFECT_OUTCOME.MERGED, status: { ...observed, state: PR_STATE.MERGED } };
  } catch (error) {
    const current = await provider.getPrStatus(issueId, selectedUrl);

    if (current.url !== selectedUrl) throw new Error("Selected PR changed while reconciling merge.", { cause: error });
    if (current.state === PR_STATE.MERGED) return { kind: MERGE_EFFECT_OUTCOME.MERGED, status: current };
    if (current.state !== PR_STATE.CLOSED && current.mergeable === false) return { kind: MERGE_EFFECT_OUTCOME.CONFLICT, status: current };
    throw error;
  }
}
