/** Selects local bulk ownership candidates and retains independent task failures. */

import { STATE_TYPE } from "../../../domain/index.js";
import { getErrorMessage } from "../../../errors/index.js";
import { readIssueStateStore } from "../../../state/index.js";
import { claimManagedTask } from "./claim-task.js";
import type { ClaimManagedTasksInput, ClaimManagedTasksResult } from "./types.js";

/** Claim one explicit issue or a snapshot of local queues, rechecking each candidate under its lock.
 * An already-owned queue remains a candidate so a retry can repair a failed label projection.
 * @param input - Resolved ownership intent, configuration and provider transport.
 */
export async function claimManagedTasks(input: ClaimManagedTasksInput): Promise<ClaimManagedTasksResult> {
  const store = input.issueId === undefined ? await readIssueStateStore(input.workspaceDir, input.project.slug) : undefined;
  const ids = input.issueId === undefined
    ? Object.values(store?.issues ?? {}).filter(state => Object.hasOwn(input.workflow.states, state.workflowState)
      && input.workflow.states[state.workflowState].type === STATE_TYPE.QUEUE)
      .map(state => state.issueId).sort((a, b) => a - b)
    : [input.issueId];
  const result: ClaimManagedTasksResult = { success: true, claimed: [], skipped: [], failed: [] };

  for (const issueId of ids) {
    try {
      const claim = await claimManagedTask({ ...input, issueId, queuedOnly: input.issueId === undefined });

      if (claim.claimed) result.claimed.push(issueId);
      else result.skipped.push({ issueId, reason: claim.reason });
    } catch (error) {
      result.failed.push({ issueId, reason: getErrorMessage(error) });
      result.success = false;
    }
  }

  return result;
}
