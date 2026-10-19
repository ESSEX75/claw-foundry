/** Exercises exact completion identity, locked PR checks and durable retry against real local stores. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";
import type { ActiveIssueWorker } from "../../../domain/index.js";
import { DATA_DIR, loadConfig, readIssueStateStore, updateIssueRuntimeRecord, updateProjects, withIssueOrchestrationLock } from "../../../state/index.js";
import { createTestHarness, type TestHarness } from "../../../testing/index.js";
import { projectionIntegrityPass } from "../../issue-projection/index.js";
import { executeCompletion } from "./completion.js";
import type { CompletionInput } from "./types.js";
import { archiveManagedIssueLocked, recoverArchivedIssueLocked } from "../../issue-maintenance/index.js";

/** Workspace workflow fixture changed only for self-transition coverage. */
const WORKFLOW_FIXTURE_FILE = "workflow.yaml";

/** Build the real request with a frame captured before any race or provider mutation.
 * @param h - Isolated managed fixture.
 * @param worker - Exact run observed by the caller.
 * @param result - Role-specific completion result.
 */
function request(h: TestHarness, worker: ActiveIssueWorker, result = "pass"): CompletionInput {
  return { workspaceDir: h.workspaceDir, projectSlug: h.project.slug, projectName: h.project.name,
    channels: h.project.channels, issueId: 42, role: worker.role, result, expectedWorker: worker,
    provider: h.provider, repoPath: h.project.repo, runCommand: h.runCommand };
}

/** Read a fixture frame explicitly so tests never substitute slot-only ownership.
 * @param h - Managed active issue fixture.
 */
async function captured(h: TestHarness): Promise<ActiveIssueWorker> {
  const worker = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"]?.activeWorker;

  assert.ok(worker);

  return worker;
}

it("rejects provider labels and a supplied frame when local state is missing", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  h.provider.seedIssue({ iid: 42, labels: ["Testing"] });
  await assert.rejects(executeCompletion(request(h, { role: "tester", level: "medior", slotIndex: 0,
    sessionKey: "uninitialized", startedAt: "2026-10-18T00:00:00.000Z" })), /no initialized local/);
  assert.equal(h.provider.calls.length, 0);
});

it("rejects a stale run with a reused session and a changed local start time", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Testing"] });
  const worker = await captured(h);

  await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, state => {
    assert.ok(state?.activeWorker);

    return { ...state, activeWorker: { ...state.activeWorker, startedAt: "replacement-run" } };
  });
  await assert.rejects(executeCompletion(request(h, worker)), /Worker changed/);
  assert.equal(h.provider.calls.length, 0);
});

it("rejects multiple slot references before any provider effect", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Testing"] });
  const worker = await captured(h);

  await updateProjects(h.workspaceDir, current => {
    const data = structuredClone(current);
    const slots = data.projects[h.project.slug].workers.tester.levels.medior;

    assert.ok(slots);
    slots.push({ ...slots[0] });

    return { data, result: undefined };
  });
  await assert.rejects(executeCompletion(request(h, worker)), /ambiguous worker/);
  assert.equal(h.provider.calls.length, 0);
});

it("reads the exact PR inside the issue lock and rejects a newly closed PR", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Doing"] });
  const worker = await captured(h);
  const url = "https://example.test/pr/42";

  h.provider.setPrStatus(42, { state: "open", url, mergeable: true });
  let complete: Promise<unknown> | undefined;

  await withIssueOrchestrationLock(h.workspaceDir, h.project.slug, 42, async () => {
    complete = executeCompletion({ ...request(h, worker, "done"), prUrl: url });
    h.provider.setPrStatus(42, { state: "closed", url });
  });
  assert.ok(complete);
  await assert.rejects(complete, /without an open PR/);
  assert.equal(h.provider.callsTo("getPrStatus").length, 1);
  assert.equal(h.provider.callsTo("addLabels").length, 0);
  assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].workflowLabel, "Doing");
});

it("resumes a committed run after release without requiring its PR to remain open", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Doing"] });
  const worker = await captured(h);

  h.provider.setPrStatus(42, { state: "open", url: "https://example.test/pr/42" });
  const input = request(h, worker, "done");
  const first = await executeCompletion(input);

  h.provider.setPrStatus(42, { state: "merged", url: "https://example.test/pr/42" });
  const reads = h.provider.callsTo("getPrStatus").length;
  const labels = h.provider.callsTo("addLabels").length;
  const replayed = await executeCompletion(input);

  assert.equal(replayed.labelTransition, first.labelTransition);
  assert.equal(h.provider.callsTo("getPrStatus").length, reads);
  assert.equal(h.provider.callsTo("addLabels").length, labels);
  await assert.rejects(executeCompletion({ ...input, expectedWorker: { ...worker, startedAt: "another-run" } }), /Worker changed/);
});

for (const recovery of ["completion", "heartbeat"]) it(`resumes archive-first interruption through ${recovery} without changing its snapshot`, async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Testing"] });
  const worker = await captured(h);
  const rename = fs.rename;
  let archived = false;
  const fault = t.mock.method(fs, "rename", async (...args: Parameters<typeof fs.rename>) => {
    if (archived && path.basename(String(args[1])) === "issues.json") throw new Error("active removal unavailable");
    await rename(...args);
    if (path.basename(String(args[1])) === "issues.archive.json") archived = true;
  });
  const input = { ...request(h, worker), runtime: {
    config: { current: () => ({ agents: { list: [{ id: h.project.agentId }] },
      channels: { telegram: { enabled: true, accounts: { default: {} } } },
      bindings: [{ agentId: h.project.agentId, match: { channel: "telegram", accountId: "default",
        peer: { kind: "group", id: h.channelId } } }] }) },
    channel: { outbound: { loadAdapter: async () => ({}) } },
  } };

  await assert.rejects(executeCompletion(input), /active removal unavailable/);
  fault.mock.restore();
  assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].workflowLabel, "Done");
  if (recovery === "completion") await executeCompletion(input);
  else await projectionIntegrityPass({ archive: { archiveManagedIssueLocked, recoverArchivedIssueLocked }, workspaceDir: h.workspaceDir, project: h.project,
    provider: h.provider, workflow: h.workflow, roles: ["developer", "tester", "reviewer", "architect"] });
  assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"], undefined);
  assert.equal(h.provider.callsTo("closeIssue").length, 1);
});

it("deduplicates a same-state completion through its receipt rather than the workflow label", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await fs.writeFile(path.join(h.workspaceDir, DATA_DIR, WORKFLOW_FIXTURE_FILE),
    "workflow:\n  states:\n    testing:\n      on:\n        PASS:\n          target: testing\n          actions: []\n");
  await h.seedManagedIssue({ iid: 42, labels: ["Testing"] });
  const worker = await captured(h);
  const input = request(h, worker);

  await executeCompletion(input);
  const state = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"];

  assert.equal(state.workflowLabel, "Testing");
  assert.equal(state.activeWorker, null);
  assert.equal(state.lastCompletion?.worker.startedAt, worker.startedAt);
  const mutations = h.provider.callsTo("addLabels").length;

  await executeCompletion(input);
  assert.equal(h.provider.callsTo("addLabels").length, mutations);
});

it("rejects a captured completion transition changed by configuration before any provider effects", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Testing"] });
  const worker = await captured(h);
  const workflow = (await loadConfig(h.workspaceDir, h.project.slug)).workflow;

  await fs.writeFile(path.join(h.workspaceDir, DATA_DIR, WORKFLOW_FIXTURE_FILE),
    "workflow:\n  states:\n    testing:\n      on:\n        PASS:\n          target: toImprove\n          actions: []\n");
  await assert.rejects(executeCompletion({ ...request(h, worker), workflow }), /Workflow changed/);
  assert.equal(h.provider.calls.length, 0);
  assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].activeWorker?.startedAt, worker.startedAt);
});
