/** Verifies ordered provider effects and exact merge read-back across interrupted attempts. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { ACTION } from "../../../domain/index.js";
import { PR_STATE } from "../../../integrations/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { MERGE_EFFECT_OUTCOME } from "./const.js";
import { executeTransitionEffects } from "./execute.js";

it("does not accept merged read-back for another PR after an unknown merge", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  let reads = 0;

  t.mock.method(h.provider, "getPrStatus", async () => ++reads === 1
    ? { state: PR_STATE.OPEN, url: "https://example.test/pr/1" }
    : { state: PR_STATE.MERGED, url: "https://example.test/pr/2" });
  t.mock.method(h.provider, "mergePr", async () => { throw new Error("response lost"); });
  await assert.rejects(executeTransitionEffects({ provider: h.provider, issueId: 42,
    actions: [ACTION.MERGE_PR], prUrl: "https://example.test/pr/1" }), /PR changed/);
});

it("retains a successfully processed close prefix when the following merge confirms a conflict", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  h.provider.seedIssue({ iid: 42 });
  h.provider.setPrStatus(42, { state: PR_STATE.OPEN, url: "https://example.test/pr/42" });
  h.provider.mergePrFailures.add(42);
  const result = await executeTransitionEffects({ provider: h.provider, issueId: 42,
    actions: [ACTION.CLOSE_ISSUE, ACTION.MERGE_PR, ACTION.REOPEN_ISSUE] });

  assert.equal(result.merge?.kind, MERGE_EFFECT_OUTCOME.CONFLICT);
  assert.deepEqual(result.processedActions, [ACTION.CLOSE_ISSUE]);
  assert.equal(h.provider.callsTo("reopenIssue").length, 0);
  assert.equal((await h.provider.getIssue(42)).state, "closed");
});

it("skips an applied close and merged PR when retrying after the next required effect failed", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  h.provider.seedIssue({ iid: 42 });
  h.provider.setPrStatus(42, { state: PR_STATE.OPEN, url: "https://example.test/pr/42" });
  const input = { provider: h.provider, issueId: 42, actions: [ACTION.CLOSE_ISSUE, ACTION.MERGE_PR, ACTION.REOPEN_ISSUE] };
  const reopen = t.mock.method(h.provider, "reopenIssue", async () => { throw new Error("reopen unavailable"); });

  await assert.rejects(executeTransitionEffects(input), /reopen unavailable/);
  reopen.mock.restore();
  await executeTransitionEffects(input);
  assert.equal(h.provider.callsTo("closeIssue").length, 1);
  assert.equal(h.provider.callsTo("mergePr").length, 1);
  assert.equal((await h.provider.getIssue(42)).state, "opened");
});

it("reports a failed optional checkout refresh and continues required lifecycle actions", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  h.provider.seedIssue({ iid: 42 });
  const warnings: string[] = [];

  await executeTransitionEffects({ provider: h.provider, issueId: 42, actions: [ACTION.GIT_PULL, ACTION.CLOSE_ISSUE],
    runCommand: async () => ({ stdout: "", stderr: "failed", code: 1, signal: null, killed: false, termination: "exit" }),
    repoPath: h.project.repo, gitPullMs: 1_000, onWarning: async action => { warnings.push(action); } });
  assert.deepEqual(warnings, [ACTION.GIT_PULL]);
  assert.equal((await h.provider.getIssue(42)).state, "closed");
});

it("never merges a closed request or a newly discovered PR after captured absence", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  h.provider.setPrStatus(42, { state: PR_STATE.CLOSED, url: "https://example.test/pr/42" });
  await assert.rejects(executeTransitionEffects({ provider: h.provider, issueId: 42, actions: [ACTION.MERGE_PR] }), /PR is closed/);
  h.provider.setPrStatus(42, { state: PR_STATE.OPEN, url: "https://example.test/pr/42" });
  await assert.rejects(executeTransitionEffects({ provider: h.provider, issueId: 42, actions: [ACTION.MERGE_PR], prUrl: null, allowMissingPr: true }), /PR changed/);
  await assert.rejects(executeTransitionEffects({ provider: h.provider, issueId: 42,
    actions: [ACTION.DETECT_PR, ACTION.MERGE_PR], prUrl: null, allowMissingPr: true }), /PR changed/);
  assert.equal(h.provider.callsTo("mergePr").length, 0);
});
