/** Verifies comment role validation and publication independently of workflow initialization. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readIssueStateStore } from "../../../../state/index.js";
import { createTestHarness } from "../../../../testing/index.js";
import { commentOnTask } from "./command.js";

describe("task discussion", () => {
  it("rejects unknown attribution before provider effects and treats reaction failure as cosmetic", async () => {
    const h = await createTestHarness();
    try {
      h.provider.seedIssue({ iid: 1 });
      const input = { workspaceDir: h.workspaceDir, channelId: h.channelId, issueId: 1,
        body: "Reviewed", provider: h.provider, runCommand: h.runCommand };
      await assert.rejects(commentOnTask({ ...input, authorRole: "unknown" }), /Unknown comment author role/);
      assert.equal(h.provider.calls.length, 0);
      h.provider.reactToIssueComment = async () => { throw new Error("reaction unavailable"); };
      const result = await commentOnTask({ ...input, authorRole: "developer" });
      assert.equal(result.commentAdded, true);
      assert.equal(h.provider.callsTo("addComment").length, 1);
      assert.match(h.provider.comments.get(1)?.[0].body ?? "", /DEVELOPER.*Reviewed/);
      assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["1"], undefined);
      h.provider.addComment = async () => { throw new Error("comment forbidden"); };
      await assert.rejects(commentOnTask(input), /comment forbidden/);
    } finally { await h.cleanup(); }
  });
});
