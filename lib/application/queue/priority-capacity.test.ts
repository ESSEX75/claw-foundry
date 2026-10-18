/** Exercises queue priority, capacity skips and canonical state validation through real dispatch. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";

import { DEFAULT_WORKFLOW } from "../../domain/index.js";
import { DATA_DIR, updateIssueRuntimeRecord } from "../../state/index.js";
import { createTestHarness } from "../../testing/index.js";
import { projectTick } from "./tick.js";

/** Workspace configuration fixture for explicit worker limits. */
const CONFIG_FIXTURE = "workflow.yaml";

it("honors queue priority before issue ID and keeps stable order within each queue", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  for (const [iid, label] of [[1, "To Do"], [8, "To Improve"], [4, "To Improve"]] satisfies [number, string][]) {
    await h.seedManagedIssue({ iid, labels: [label] });
  }

  const result = await projectTick({ workspaceDir: h.workspaceDir, projectSlug: h.project.slug,
    provider: h.provider, targetRole: "developer", dryRun: true });

  assert.deepEqual(result.pickups.map(pickup => pickup.issueId), [4]);
  assert.equal(h.provider.callsTo("listIssuesByLabel").length, 0);
  const workflow = structuredClone(DEFAULT_WORKFLOW);

  workflow.states.todo.priority = 100;
  workflow.states.toImprove.priority = 1;
  const custom = await projectTick({ workspaceDir: h.workspaceDir, projectSlug: h.project.slug,
    provider: h.provider, targetRole: "developer", dryRun: true, workflow });

  assert.deepEqual(custom.pickups.map(pickup => pickup.issueId), [1]);
});

for (const reserved of [false, true]) it(`continues to a runnable level after ${reserved ? "an existing reservation" : "a capacity-blocked candidate"}`, async t => {
  const h = await createTestHarness({ workers: { developer: { level: "senior", active: true, issueId: reserved ? 1 : 90 } } });

  t.after(() => h.cleanup());
  await fs.writeFile(path.join(h.workspaceDir, DATA_DIR, CONFIG_FIXTURE),
    "roles:\n  developer:\n    levels:\n      senior:\n        maxWorkers: 1\n");
  for (const [iid, level] of [[1, "senior"], [2, "junior"]] satisfies [number, string][]) {
    await h.seedManagedIssue({ iid, labels: ["To Do"] });
    await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, iid, state => {
      assert.ok(state);

      return { ...state, activeWorker: null, assignedRole: "developer", assignedLevel: level };
    });
  }

  const result = await projectTick({ workspaceDir: h.workspaceDir, projectSlug: h.project.slug,
    provider: h.provider, targetRole: "developer", maxPickups: 1, runCommand: h.runCommand });

  assert.deepEqual(result.pickups.map(pickup => pickup.issueId), [2]);
  assert.equal(h.commands.taskMessages().length, 1);
  assert.ok(result.skipped.some(skip => skip.issueId === 1));
});

it("rejects reused labels with a stale key and invalid role PICKUP targets before provider reads", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await h.seedManagedIssue({ iid: 1, labels: ["To Do"] });
  await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 1, state => {
    assert.ok(state);

    return { ...state, workflowState: "removedQueue" };
  });
  const input = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug, provider: h.provider,
    targetRole: "developer", dryRun: true };
  const reads = h.provider.callsTo("getIssue").length;

  assert.equal((await projectTick(input)).pickups.length, 0);
  await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 1, state => {
    assert.ok(state);

    return { ...state, workflowState: "todo" };
  });
  const workflow = structuredClone(DEFAULT_WORKFLOW);

  workflow.states.todo.on = { PICKUP: { target: "testing" } };
  assert.equal((await projectTick({ ...input, workflow })).pickups.length, 0);
  assert.equal(h.provider.callsTo("getIssue").length, reads);
});
