/** Verifies cross-project sequential exclusion is atomic with worker reservation. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { emptySlot } from "../../domain/index.js";
import { createTestHarness } from "../../testing/index.js";
import { activateWorker, deactivateWorker } from "./mutations.js";
import { readProjects } from "./repository.js";

it("reserves at most one project when concurrent dispatches require sequential execution", async () => {
  const h = await createTestHarness();
  try {
    await h.writeProjects({ projects: { [h.project.slug]: h.project,
      other: { ...h.project, slug: "other", name: "Other", channels: [{ ...h.project.channels[0], channelId: "other" }] } } });
    const outcomes = await Promise.allSettled([h.project.slug, "other"].map(slug => activateWorker(h.workspaceDir, slug, "architect", {
      issueId: 42, level: "junior", slotIndex: 0, maxWorkers: 1, projectExecution: "sequential",
    })));
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    const failed = outcomes.find(result => result.status === "rejected");
    assert.ok(failed && failed.status === "rejected");
    assert.match(String(failed.reason), /another project/);
  } finally { await h.cleanup(); }
});

it("automatically reserves past unresolved references and materializes configured capacity", async () => {
  const h = await createTestHarness();
  try {
    h.project.workers.architect = { levels: { custom: [
      { ...emptySlot(), issueId: 41 },
      { ...emptySlot(), sessionKey: "reusable", name: "Ada" },
    ] } };
    await h.writeProjects({ projects: { [h.project.slug]: h.project } });
    await activateWorker(h.workspaceDir, h.project.slug, "architect", { issueId: 42, level: "custom", maxWorkers: 3 });
    await activateWorker(h.workspaceDir, h.project.slug, "architect", { issueId: 43, level: "custom", maxWorkers: 3 });
    const slots = (await readProjects(h.workspaceDir)).projects[h.project.slug]?.workers.architect?.levels.custom;

    assert.deepEqual(slots?.map(slot => slot.issueId), [41, 42, 43]);
    assert.equal(slots?.[1]?.sessionKey, "reusable");
    assert.equal(slots?.[1]?.name, "Ada");
    await assert.rejects(activateWorker(h.workspaceDir, h.project.slug, "architect", {
      issueId: 44, level: "custom", maxWorkers: 3,
    }), /No free/);
  } finally { await h.cleanup(); }
});

it("does not overwrite delivery evidence and clears it only on explicit release", async () => {
  const h = await createTestHarness();
  try {
    h.project.workers.architect = { levels: { custom: [{ ...emptySlot(), sessionKey: "reusable", name: "Ada",
      delivery: { status: "unknown", recordedAt: "now", reason: "unconfirmed" } }] } };
    await h.writeProjects({ projects: { [h.project.slug]: h.project } });
    await assert.rejects(activateWorker(h.workspaceDir, h.project.slug, "architect", {
      issueId: 42, level: "custom", maxWorkers: 1,
    }), /No free/);
    await assert.rejects(activateWorker(h.workspaceDir, h.project.slug, "architect", {
      issueId: 42, level: "custom", slotIndex: 0, maxWorkers: 1,
    }), /unresolved delivery/);
    await deactivateWorker(h.workspaceDir, h.project.slug, "architect", { level: "custom", slotIndex: 0 });
    const slot = (await readProjects(h.workspaceDir)).projects[h.project.slug]?.workers.architect?.levels.custom?.[0];

    assert.equal(slot?.delivery, undefined);
    assert.equal(slot?.sessionKey, "reusable");
    assert.equal(slot?.name, "Ada");
    assert.equal(slot?.active, false);
  } finally { await h.cleanup(); }
});

it("atomically bounds concurrent automatic reservations by configured capacity", async () => {
  const h = await createTestHarness();
  try {
    h.project.workers.architect = { levels: {} };
    await h.writeProjects({ projects: { [h.project.slug]: h.project } });
    const outcomes = await Promise.allSettled([41, 42].map(issueId => activateWorker(h.workspaceDir, h.project.slug, "architect", {
      issueId, level: "custom", maxWorkers: 1,
    })));

    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    const slots = (await readProjects(h.workspaceDir)).projects[h.project.slug]?.workers.architect?.levels.custom;

    assert.equal(slots?.length, 1);
    assert.equal(slots?.[0]?.active, true);
  } finally { await h.cleanup(); }
});
