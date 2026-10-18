/** Verifies cross-project sequential exclusion is atomic with worker reservation. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { createTestHarness } from "../../testing/index.js";
import { activateWorker } from "./mutations.js";

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
