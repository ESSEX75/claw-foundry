/** Exercises routing races and shared lifecycle refusals against real registry, runtime and issue locks. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { it } from "node:test";
import { DEFAULT_WORKFLOW, WORKER_DELIVERY_RESOLUTION } from "../../../domain/index.js";
import { GitHubProvider } from "../../../integrations/index.js";
import { updateIssueRuntimeRecord, updateProjects, withIssueOrchestrationLock, writeWorkerDeliveryResolution } from "../../../state/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { claimManagedTask } from "../assignment/index.js";
import { editTaskBody } from "../content/index.js";
import { setTaskLevel } from "../assignment/index.js";
import { startTask } from "../activation/index.js";
import type { TaskLifecycleInput } from "./types.js";

/** Exact issue lock directory observed to synchronize the route race without timing sleeps. */
const ISSUE_LOCK_FIXTURE = "42.lock";

/** Three real lifecycle commands share the route capture and common prerequisite contract. */
const commands = [
  { name: "start", run: (input: TaskLifecycleInput) => startTask(input) },
  { name: "level", run: (input: TaskLifecycleInput) => setTaskLevel({ ...input, level: "senior" }) },
  { name: "edit", run: (input: TaskLifecycleInput) => editTaskBody({ ...input, body: "new content", addComment: false }) },
];

for (const command of commands) {
  it(`${command.name} rejects route reassignment while waiting for its original project's lock`, async t => {
    const h = await createTestHarness();

    await h.seedManagedIssue({ iid: 42, labels: ["Planning"] });
    let release = () => {};
    let entered = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    const acquired = new Promise<void>(resolve => { entered = resolve; });
    const blocker = withIssueOrchestrationLock(h.workspaceDir, h.project.slug, 42, async () => { entered(); await held; });

    t.after(async () => { release(); await blocker; await h.cleanup(); });
    await acquired;
    let attempted = () => {};
    const lockAttempted = new Promise<void>(resolve => { attempted = resolve; });
    const prepareClaim = fs.mkdtemp;

    t.mock.method(fs, "mkdtemp", async (...args: Parameters<typeof fs.mkdtemp>) => {
      if (String(args[0]).endsWith(`${ISSUE_LOCK_FIXTURE}.claim-`)) attempted();

      return prepareClaim(...args);
    });
    const get = t.mock.method(GitHubProvider.prototype, "getIssue", (id: number) => h.provider.getIssue(id));
    const pending = command.run({ workspaceDir: h.workspaceDir, channelId: h.project.channels[0].channelId,
      issueId: 42, runCommand: h.runCommand });
    const rejection = assert.rejects(pending, /Project route changed/);

    await lockAttempted;
    await updateProjects(h.workspaceDir, data => {
      const original = data.projects[h.project.slug];

      data.projects.other = { ...original, slug: "other", name: "Other", repo: "/other", workers: {} };
      original.channels = [{ ...original.channels[0], channelId: "remaining-channel" }];

      return { data, result: undefined };
    });
    release();
    await blocker;
    await rejection;
    assert.equal(get.mock.callCount(), 0);
    assert.equal(h.commands.taskMessages().length, 0);
  });

  for (const blocker of ["drift", "release", "resolution"]) {
    it(`${command.name} rejects ${blocker} before provider effects`, async t => {
      const h = await createTestHarness();

      t.after(() => h.cleanup());
      await h.seedManagedIssue({ iid: 42, labels: ["Planning"] });
      if (blocker === "resolution") {
        await writeWorkerDeliveryResolution(h.workspaceDir, h.project.slug, {
          deliveryId: "00000000-0000-4000-8000-000000000042", issueId: 42, sessionKey: "worker",
          role: "developer", level: "senior", slotIndex: 0, startedAt: "2026-01-01T00:00:00.000Z",
          decision: WORKER_DELIVERY_RESOLUTION.CONFIRMED_NOT_STARTED, reason: "verified rejection", fromState: "planning", fromLabel: "Planning",
          toState: "planning", toLabel: "Planning", completed: false,
        });
      } else {
        await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, state => {
          assert.ok(state);

          return blocker === "drift" ? { ...state, workflowState: "retiredPlanning" } : { ...state, pendingWorkerRelease: {
            role: "developer", level: "senior", slotIndex: 0, sessionKey: "worker", startedAt: "2026-01-01T00:00:00.000Z",
          } };
        });
      }

      const get = t.mock.method(GitHubProvider.prototype, "getIssue", (id: number) => h.provider.getIssue(id));

      await assert.rejects(command.run({ workspaceDir: h.workspaceDir, channelId: h.project.channels[0].channelId,
        issueId: 42, runCommand: h.runCommand }), blocker === "drift" ? /does not match/ : /pending worker/);
      assert.equal(get.mock.callCount(), 0);
    });
  }
}

it("preserves architect editing while its exact local worker is active", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Researching"] });
  t.mock.method(GitHubProvider.prototype, "getIssue", (id: number) => h.provider.getIssue(id));
  t.mock.method(GitHubProvider.prototype, "editIssue", (...args: Parameters<GitHubProvider["editIssue"]>) => h.provider.editIssue(...args));
  const result = await editTaskBody({ workspaceDir: h.workspaceDir, channelId: h.project.channels[0].channelId,
    issueId: 42, runCommand: h.runCommand, body: "refined task", addComment: false });

  assert.equal(result.changed, true);
  assert.match((await h.provider.getIssue(42)).description, /refined task/);
});

it("refuses ownership changes during pending worker release", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 42, labels: ["Planning"] });
  await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, state => {
    assert.ok(state);

    return { ...state, pendingWorkerRelease: { role: "developer", level: "senior", slotIndex: 0,
      sessionKey: "worker", startedAt: "2026-01-01T00:00:00.000Z" } };
  });
  const reads = h.provider.callsTo("getIssue").length;
  const result = await claimManagedTask({ workspaceDir: h.workspaceDir, project: h.project, issueId: 42,
    instanceName: "new-owner", force: true, provider: h.provider, providerType: h.project.provider,
    workflow: DEFAULT_WORKFLOW, roles: ["developer"] });

  assert.equal(result.claimed, false);
  assert.equal(h.provider.callsTo("getIssue").length, reads);
});
