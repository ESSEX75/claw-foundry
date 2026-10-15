/** Exercises ownership partial failures, lock-time eligibility and local-only selection. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ISSUE_INTEGRITY_STATUS, ISSUE_PROVIDER } from "../../../domain/index.js";
import { loadConfig, readIssueStateStore, updateIssueRuntimeRecord } from "../../../state/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { writeIssueRuntimeState } from "../../issue-runtime/index.js";
import { claimManagedTasks } from "./claim-tasks.js";

/** Seed an initialized queue record independently of provider label observations.
 * @param h - Isolated project fixture.
 * @param issueId - Provider-local identity.
 */
async function setup(h: Awaited<ReturnType<typeof createTestHarness>>, issueId: number) {
  const config = await loadConfig(h.workspaceDir, h.project.slug);
  const issue = h.provider.seedIssue({ iid: issueId, labels: ["To Do"] });
  await writeIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue,
    providerType: ISSUE_PROVIDER.GITHUB, workflow: config.workflow, workflowState: "todo", workflowLabel: "To Do",
    owner: null, integrityStatus: ISSUE_INTEGRITY_STATUS.OK });
  return { workspaceDir: h.workspaceDir, project: h.project, provider: h.provider, providerType: ISSUE_PROVIDER.GITHUB,
    workflow: config.workflow, roles: Object.keys(config.roles), instanceName: "local", force: false };
}

describe("ownership commands", () => {
  it("retains a fetch failure while independent local candidates succeed and provider-only issues stay untouched", async () => {
    const h = await createTestHarness();
    try {
      const input = await setup(h, 1);
      await setup(h, 2);
      h.provider.seedIssue({ iid: 3, labels: ["To Do"] });
      const getIssue = h.provider.getIssue.bind(h.provider);
      h.provider.getIssue = async id => { if (id === 1) throw new Error("rate limit exceeded"); return getIssue(id); };
      const result = await claimManagedTasks(input);
      assert.equal(result.success, false);
      assert.deepEqual(result.claimed, [2]);
      assert.deepEqual(result.failed, [{ issueId: 1, reason: "rate limit exceeded" }]);
      assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["1"].owner, null);
      assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["3"], undefined);
    } finally { await h.cleanup(); }
  });

  it("repairs a projection failure on bulk retry without repeating the ownership transfer", async () => {
    const h = await createTestHarness();
    try {
      const input = await setup(h, 1);
      const add = h.provider.addLabel.bind(h.provider);
      h.provider.addLabel = async () => { throw new Error("labels forbidden"); };
      const first = await claimManagedTasks(input);
      assert.match(first.failed[0].reason, /Ownership saved locally.*labels forbidden/);
      const state = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["1"];
      assert.equal(state.owner, "local");
      assert.equal(state.integrityStatus, ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR);
      h.provider.addLabel = add;
      const retry = await claimManagedTasks(input);
      assert.equal(retry.success, true);
      assert.equal(retry.skipped.length, 1);
      assert.ok((await h.provider.getIssue(1)).labels.includes("owner:local"));
      assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["1"].integrityStatus, ISSUE_INTEGRITY_STATUS.OK);
    } finally { await h.cleanup(); }
  });

  it("rechecks queue eligibility after an earlier bulk candidate changed another task", async () => {
    const h = await createTestHarness();
    try {
      const input = await setup(h, 1);
      await setup(h, 2);
      const getIssue = h.provider.getIssue.bind(h.provider);
      h.provider.getIssue = async id => {
        if (id === 1) await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 2, state => {
          assert.ok(state);
          return { ...state, workflowState: "done", workflowLabel: "Done" };
        });
        return getIssue(id);
      };
      const result = await claimManagedTasks({ ...input, force: true });
      assert.deepEqual(result.claimed, [1]);
      assert.match(result.skipped[0].reason, /no longer/);
      assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["2"].owner, null);
      assert.equal(h.provider.callsTo("getIssue").filter(call => call.args.issueId === 2).length, 0);
    } finally { await h.cleanup(); }
  });
});
