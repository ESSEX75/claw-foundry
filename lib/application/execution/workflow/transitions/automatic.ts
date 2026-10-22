/** Executes an automatic workflow transition under the issue lock and fresh local preconditions. */

import { withIssueOrchestrationLock } from "../../../../state/index.js";
import { commitWorkflowTransitionLocked } from "./transition.js";
import type { AutomaticTransitionInput } from "./types.js";

/** Recheck the local source state under the issue lock before actions and commit.
 * @param opts - Planned heartbeat transition and policy-specific provider actions.
 */
export async function executeAutomaticTransition(opts: AutomaticTransitionInput): Promise<boolean> {
  return withIssueOrchestrationLock(opts.workspaceDir, opts.project.slug, opts.issueId, async () => {
    const issue = await opts.provider.getIssue(opts.issueId);

    return commitWorkflowTransitionLocked({
      workspaceDir: opts.workspaceDir,
      project: opts.project,
      issueId: opts.issueId,
      provider: opts.provider,
      workflow: opts.workflow,
      plan: { from: opts.fromLabel, toState: opts.workflowState, toLabel: opts.workflowLabel, actions: opts.actions ?? [] },
      owner: opts.owner,
      issue,
      closedAt: opts.closedAt,
      checkLocalState: true,
      archiveTerminal: true,
      beforeCommit: opts.beforeCommit,
      routing: opts.routing,
    });
  });
}
