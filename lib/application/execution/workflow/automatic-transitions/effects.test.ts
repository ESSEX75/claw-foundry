/** Exercises merge uncertainty, exact identity and ordered lifecycle through real heartbeat use cases. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { ACTION, DEFAULT_WORKFLOW, type ReviewPolicy, type TransitionAction, WORKFLOW_EVENT } from "../../../../domain/index.js";
import { PR_STATE } from "../../../../integrations/index.js";
import { readIssueStateStore, updateIssueRuntimeRecord } from "../../../../state/index.js";
import { createTestHarness, type TestHarness } from "../../../../testing/index.js";
import { testSkipPass } from "./test-skip.js";
import { reviewPass } from "./review.js";
import { reviewSkipPass } from "./review-skip.js";

/** Seed authoritative routing independently of provider policy labels.
 * @param h - Isolated managed project.
 * @param policy - Saved review selection.
 */
async function seedReview(h: TestHarness, policy: ReviewPolicy) {
  await h.seedManagedIssue({ iid: 42, labels: ["To Review"] });
  await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, state => {
    assert.ok(state);

    return { ...state, reviewPolicy: policy };
  });
  h.provider.setPrStatus(42, { state: PR_STATE.APPROVED, url: "https://example.test/pr/42", mergeable: true });
}

/** Select the real human or skip pass with the same project capabilities.
 * @param h - Managed fixture.
 * @param policy - Explicit review policy selecting orchestration.
 */
function runReview(h: TestHarness, policy: ReviewPolicy) {
  const input = { workspaceDir: h.workspaceDir, projectName: h.project.name, project: h.project,
    workflow: DEFAULT_WORKFLOW, provider: h.provider, repoPath: h.project.repo, runCommand: h.runCommand };

  return policy === "human" ? reviewPass(input) : reviewSkipPass(input);
}

for (const policy of ["human", "skip"] satisfies ReviewPolicy[]) {
  it(`${policy} review reconciles a successful merge with a lost response and never repeats it`, async t => {
    const h = await createTestHarness();

    t.after(() => h.cleanup());
    await seedReview(h, policy);
    const merge = h.provider.mergePr.bind(h.provider);

    t.mock.method(h.provider, "mergePr", async (issueId: number, prUrl?: string) => {
      await merge(issueId, prUrl);
      throw new Error("response lost");
    });
    assert.equal(await runReview(h, policy), 1);
    assert.equal(await runReview(h, policy), 0);
    assert.equal(h.provider.callsTo("mergePr").length, 1);
    assert.equal(h.provider.callsTo("mergePr")[0].args.prUrl, "https://example.test/pr/42");
    assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].workflowState, "toTest");
  });

  for (const readbackFails of [false, true]) it(`${policy} review preserves source after unknown merge${readbackFails ? " and failed read-back" : ""}`, async t => {
    const h = await createTestHarness();

    t.after(() => h.cleanup());
    await seedReview(h, policy);
    let submitted = false;
    const read = h.provider.getPrStatus.bind(h.provider);

    t.mock.method(h.provider, "mergePr", async () => { submitted = true; throw new Error("merge response unknown"); });
    t.mock.method(h.provider, "getPrStatus", async (id: number, url?: string) => {
      if (submitted && readbackFails) throw new Error("read-back unavailable");

      return read(id, url);
    });
    await assert.rejects(runReview(h, policy), readbackFails ? /read-back unavailable/ : /merge response unknown/);
    assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].workflowState, "toReview");
    assert.equal(h.provider.callsTo("addLabels").length, 0);
  });

  it(`${policy} review retries applied lifecycle and merge effects after projection interruption`, async t => {
    const h = await createTestHarness();

    t.after(() => h.cleanup());
    await seedReview(h, policy);
    const workflow = structuredClone(DEFAULT_WORKFLOW);
    const event = policy === "human" ? WORKFLOW_EVENT.APPROVED : WORKFLOW_EVENT.SKIP;

    workflow.states.toReview.on = { ...workflow.states.toReview.on,
      [event]: { target: "toTest", actions: [ACTION.CLOSE_ISSUE, ACTION.MERGE_PR] } };
    const input = { workspaceDir: h.workspaceDir, projectName: h.project.name, project: h.project,
      workflow, provider: h.provider, repoPath: h.project.repo, runCommand: h.runCommand };
    const run = () => policy === "human" ? reviewPass(input) : reviewSkipPass(input);
    const fault = t.mock.method(h.provider, "addLabels", async () => { throw new Error("projection interrupted"); });

    await assert.rejects(run(), /projection interrupted/);
    assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].workflowState, "toReview");
    fault.mock.restore();
    assert.equal(await run(), 1);
    assert.equal(h.provider.callsTo("closeIssue").length, 1);
    assert.equal(h.provider.callsTo("mergePr").length, 1);
    assert.ok((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].closedAt);
  });

  it(`${policy} recovery commits the processed lifecycle prefix and configured recovery actions`, async t => {
    const h = await createTestHarness();

    t.after(() => h.cleanup());
    await seedReview(h, policy);
    const workflow = structuredClone(DEFAULT_WORKFLOW);
    const event = policy === "human" ? WORKFLOW_EVENT.APPROVED : WORKFLOW_EVENT.SKIP;

    workflow.states.toReview.on = { ...workflow.states.toReview.on,
      [event]: { target: "toTest", actions: [ACTION.CLOSE_ISSUE, ACTION.MERGE_PR] },
      [WORKFLOW_EVENT.MERGE_FAILED]: { target: "toImprove", actions: [ACTION.REOPEN_ISSUE] } };
    h.provider.mergePrFailures.add(42);
    const input = { workspaceDir: h.workspaceDir, projectName: h.project.name, project: h.project,
      workflow, provider: h.provider, repoPath: h.project.repo, runCommand: h.runCommand };

    assert.equal(await (policy === "human" ? reviewPass(input) : reviewSkipPass(input)), 1);
    const state = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"];

    assert.equal(state.workflowState, "toImprove");
    assert.equal(state.closedAt, null);
    assert.equal((await h.provider.getIssue(42)).state, "opened");
    assert.equal(h.provider.callsTo("closeIssue").length, 1);
    assert.equal(h.provider.callsTo("reopenIssue").length, 1);
  });
}

it("human review retains captured PR A when discovery would now return PR B", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await seedReview(h, "human");
  let discoveries = 0;
  const reads: (string | undefined)[] = [];

  t.mock.method(h.provider, "getPrStatus", async (_id: number, url?: string) => {
    reads.push(url);
    if (url) return { state: PR_STATE.APPROVED, url, mergeable: true };
    discoveries++;

    return { state: PR_STATE.APPROVED, url: `https://example.test/pr/${discoveries === 1 ? "42" : "99"}`, mergeable: true };
  });
  assert.equal(await runReview(h, "human"), 1);
  assert.equal(discoveries, 1);
  assert.ok(reads.slice(1).every(url => url === "https://example.test/pr/42"));
  assert.equal(h.provider.callsTo("mergePr")[0].args.prUrl, "https://example.test/pr/42");
});

for (const replacement of [false, true]) it(`human review rejects ${replacement ? "replacement PR" : "withdrawn approval"} at the merge gate`, async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await seedReview(h, "human");
  let reads = 0;

  t.mock.method(h.provider, "getPrStatus", async () => {
    reads++;

    return { state: !replacement && reads >= 3 ? PR_STATE.OPEN : PR_STATE.APPROVED,
      url: replacement && reads >= 2 ? "https://example.test/pr/99" : "https://example.test/pr/42", mergeable: true };
  });
  await assert.rejects(runReview(h, "human"), replacement ? /PR changed/ : /review gate/);
  assert.equal(h.provider.callsTo("mergePr").length, 0);
  assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].workflowState, "toReview");
});

for (const mode of ["human", "skip", "test", "closed"]) {
  for (const actions of [[ACTION.CLOSE_ISSUE, ACTION.REOPEN_ISSUE], [ACTION.REOPEN_ISSUE, ACTION.CLOSE_ISSUE]] satisfies TransitionAction[][]) {
    it(`${mode} heartbeat commits the final lifecycle of ${actions.join(" then ")}`, async t => {
      const workflow = structuredClone(DEFAULT_WORKFLOW);
      const source = mode === "test" ? "toTest" : "toReview";
      const event = mode === "human" ? WORKFLOW_EVENT.APPROVED : mode === "closed" ? WORKFLOW_EVENT.PR_CLOSED : WORKFLOW_EVENT.SKIP;

      workflow.states[source].on = { ...workflow.states[source].on, [event]: { target: "toImprove", actions } };
      const h = await createTestHarness({ workflow });

      t.after(() => h.cleanup());
      await h.seedManagedIssue({ iid: 42, labels: [workflow.states[source].label], state: "closed" });
      await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, state => {
        assert.ok(state);

        return { ...state, reviewPolicy: mode === "skip" ? "skip" : "human", testPolicy: "skip", closedAt: "2026-01-01T00:00:00.000Z" };
      });
      h.provider.setPrStatus(42, { state: mode === "closed" ? PR_STATE.CLOSED : PR_STATE.APPROVED, url: "https://example.test/pr/42" });
      const input = { workspaceDir: h.workspaceDir, projectName: h.project.name, project: h.project,
        workflow, provider: h.provider, repoPath: h.project.repo, runCommand: h.runCommand };
      const run = () => mode === "test" ? testSkipPass(input) : mode === "skip" ? reviewSkipPass(input) : reviewPass(input);

      assert.equal(await run(), 1);
      const state = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"];
      const closed = actions.at(-1) === ACTION.CLOSE_ISSUE;

      assert.equal(state.closedAt !== null, closed);
      if (closed) assert.notEqual(state.closedAt, "2026-01-01T00:00:00.000Z");
      assert.equal((await h.provider.getIssue(42)).state, closed ? "closed" : "opened");
      assert.equal(await run(), 0);
    });
  }
}
