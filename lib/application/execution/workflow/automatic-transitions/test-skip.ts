/**
 * test-skip.ts — Auto-transition test:skip issues through the test queue.
 *
 * When local testPolicy is "skip" (default), issues arrive in the test queue
 * through issues.json state. This pass auto-transitions them to done,
 * executing the SKIP event's configured actions (e.g. closeIssue).
 */

import { DEFAULT_ROLES, ROUTING_LABELS, STATE_TYPE, TEST_POLICY, TEST_ROUTING_FIELD, WORKFLOW_EVENT } from "../../../../domain/index.js";
import { log as auditLog } from "../../../../state/index.js";
import {
  executeTransitionEffects,
  MERGE_EFFECT_OUTCOME,
} from "../effects/index.js";
import { planWorkflowEvent } from "../planning/index.js";
import { executeAutomaticTransition } from "../transitions/index.js";
import { TEST_SKIP_AUDIT_EVENT, TEST_SKIP_TRANSITION_OWNER } from "./const.js";
import { getAutomaticTransitionCandidates } from "./queries.js";
import type { TestSkipPassInput } from "./types.js";

/**
 * Scan test queue states and auto-transition issues with testPolicy=skip.
 * Returns the number of transitions made.
 * @param opts - Project workflow and provider for the explicit test skip policy.
 */
export async function testSkipPass(opts: TestSkipPassInput): Promise<number> {
  const { workspaceDir, projectName, project, workflow, provider } = opts;
  let transitions = 0;

  //TODO: The behavior of the tester, reviewer, etc. is hard-coded.
  // Find test queue states (role=tester, type=queue) that have a SKIP event
  const testQueueStates = Object.entries(workflow.states)
    .filter(([, state]) => state.role === DEFAULT_ROLES.TESTER && state.type === STATE_TYPE.QUEUE);

  for (const [, state] of testQueueStates) {
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
      routing: { field: TEST_ROUTING_FIELD, value: TEST_POLICY.SKIP },
    });

    for (const { issue } of candidates) {

      const transitioned = await executeAutomaticTransition({
        workspaceDir,
        project,
        issueId: issue.iid,
        provider,
        workflow,
        fromLabel: state.label,
        workflowState: targetKey,
        workflowLabel: targetState.label,
        actions,
        owner: TEST_SKIP_TRANSITION_OWNER,
        routing: { field: TEST_ROUTING_FIELD, value: TEST_POLICY.SKIP },
        beforeCommit: async () => {
          const result = await executeTransitionEffects({ provider, issueId: issue.iid, actions });

          if (result.merge?.kind === MERGE_EFFECT_OUTCOME.CONFLICT) throw new Error(`Test skip merge conflict for #${issue.iid}.`);
        },
      });

      if (!transitioned) continue;

      await auditLog(workspaceDir, TEST_SKIP_AUDIT_EVENT, {
        project: projectName,
        issueId: issue.iid,
        from: state.label,
        to: targetState.label,
        reason: ROUTING_LABELS.TEST_SKIP,
      });

      transitions++;
    }
  }

  return transitions;
}
