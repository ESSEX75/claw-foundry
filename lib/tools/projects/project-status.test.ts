/** Verifies local project output, reservation evidence and validation of untrusted execution policy. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { PluginContext } from "../../context.js";
import { readIssueStateStore } from "../../state/index.js";
import { createTestHarness } from "../../testing/index.js";
import { createProjectStatusTool } from "./project-status.js";

describe("project status adapter", () => {
  it("reports reservations without initializing issue state and rejects an invalid plugin execution mode", async () => {
    const h = await createTestHarness({ workers: { developer: { active: true, issueId: 42, level: "medior", sessionKey: "reserved" } } });
    try {
      const pluginConfig: Record<string, unknown> = { projectExecution: "sequential" };
      const ctx: PluginContext = { runCommand: h.runCommand, config: {}, pluginConfig,
        /** Local project inspection never accesses the gateway. */
        get runtime(): never { throw new Error("Unexpected runtime access"); },
        /** SDK logging is unnecessary for local inspection. */
        get logger(): never { throw new Error("Unexpected logging"); },
      };
      const tool = createProjectStatusTool(ctx)({ config: {}, workspaceDir: h.workspaceDir });
      assert.ok(tool && !Array.isArray(tool));
      const result = await tool.execute("inspect", { channelId: h.channelId });
      const data = z.object({ execution: z.object({ projectExecution: z.literal("sequential") }),
        workers: z.record(z.string(), z.object({ activeSlots: z.number() })) }).parse(result.details);
      assert.equal(data.workers.developer.activeSlots, 1);
      assert.deepEqual((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues, {});
      assert.equal(h.commands.commands.length, 0);
      pluginConfig.projectExecution = "invalid";
      await assert.rejects(tool.execute("invalid-config", { channelId: h.channelId }), /Invalid option/);
    } finally { await h.cleanup(); }
  });
});
