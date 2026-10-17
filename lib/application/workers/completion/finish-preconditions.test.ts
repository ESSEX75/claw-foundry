/** Verifies that current project PR evidence, including failed reads, gates worker completion. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestHarness } from "../../../testing/index.js";
import { loadFinishWorkContext } from "./finish-context.js";

describe("finish preconditions", () => {
  it("does not match a supplied session against an unbound active slot", async () => {
    const h = await createTestHarness({ workers: { developer: { active: true, issueId: 42, level: "medior", sessionKey: null } } });

    try {
      await assert.rejects(loadFinishWorkContext({ workspaceDir: h.workspaceDir, channelId: h.project.channels[0].channelId,
        role: "developer", result: "done", sessionKey: "another-session", runCommand: h.runCommand }), /worker not active/);
    } finally { await h.cleanup(); }
  });
});
