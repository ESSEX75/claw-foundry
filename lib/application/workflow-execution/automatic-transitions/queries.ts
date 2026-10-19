/** Selects initialized local issues and observes their provider context for automatic transitions. */

import { ISSUE_INTEGRITY_STATUS } from "../../../domain/index.js";
import { readIssueStateStore, readReadyIssueCreationIds } from "../../../state/index.js";
import type { AutomaticTransitionCandidate, AutomaticTransitionCandidateInput } from "./types.js";

/** Select initialized local issues and fetch provider context without importing provider labels as state.
 * @param opts - Local selection, optional saved policy, and provider read capability.
 */
export async function getAutomaticTransitionCandidates(opts: AutomaticTransitionCandidateInput): Promise<AutomaticTransitionCandidate[]> {
  const store = await readIssueStateStore(opts.workspaceDir, opts.projectSlug);
  const states = Object.values(store.issues)
    .filter((state) =>
      state.integrityStatus !== ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR
      && state.providerMissing == null
      && state.workflowLabel === opts.workflowLabel
      && (!opts.routing || state[opts.routing.field] === opts.routing.value),
    )
    .sort((a, b) => a.issueId - b.issueId);

  const candidates: AutomaticTransitionCandidate[] = [];
  const ready = states.some(state => state.creationOperationId)
    ? await readReadyIssueCreationIds(opts.workspaceDir, opts.projectSlug) : new Set<string>();

  for (const localState of states) {
    if (localState.creationOperationId && !ready.has(localState.creationOperationId)) continue;
    const issue = await opts.provider.getIssue(localState.issueId);

    candidates.push({ issue, localState });
  }

  return candidates;
}
