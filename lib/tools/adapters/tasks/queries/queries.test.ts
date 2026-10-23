/** Exercises real browsing adapters while keeping local issue state authoritative over provider projection. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { seedIssueRuntimeState } from "../../../../testing/index.js";
import type { PluginContext } from "../../../../context.js";
import { GitHubProvider } from "../../../../integrations/index.js";
import { readIssueStateStore } from "../../../../state/index.js";
import { createTestHarness } from "../../../../testing/index.js";
import { createTaskListTool } from "./task-list.js";
import { createTasksStatusTool } from "./tasks-status.js";

describe("task browsing adapters", () => {
  it("groups by local state, excludes provider-only issues and preserves totals with limit zero", async t => {
    const h = await createTestHarness();
    try {
      const issue = h.provider.seedIssue({ iid: 42, title: "Managed", labels: ["Planning"] });
      await seedIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue, providerType: h.project.provider,
        workflow: h.workflow, workflowState: "planning", workflowLabel: "Planning", owner: "local", reviewPolicy: "human", testPolicy: "skip" });
      h.provider.seedIssue({ iid: 42, title: "Managed", labels: ["Doing", "owner:foreign", "review:skip"] });
      h.provider.seedIssue({ iid: 99, title: "Provider only", labels: ["To Do"] });
      t.mock.method(GitHubProvider.prototype, "getIssue", h.provider.getIssue.bind(h.provider));
      const ctx: PluginContext = { runCommand: h.runCommand, config: {}, pluginConfig: undefined,
        /** Browsing has no gateway dependency. */
        get runtime(): never { throw new Error("Unexpected gateway dependency"); },
        /** Audit does not use SDK logging. */
        get logger(): never { throw new Error("Unexpected SDK logging"); },
      };
      const sdk = { config: {}, workspaceDir: h.workspaceDir };
      const status = createTasksStatusTool(ctx)(sdk); const list = createTaskListTool(ctx)(sdk);
      assert.ok(status && !Array.isArray(status)); assert.ok(list && !Array.isArray(list));
      const before = await readIssueStateStore(h.workspaceDir, h.project.slug);
      const result = await status.execute("status", { channelId: h.channelId });
      const output = z.object({ summary: z.object({ totalHold: z.number(), totalActive: z.number(), totalQueued: z.number() }),
        hold: z.record(z.string(), z.object({ count: z.number(), issues: z.array(z.object({ projection: z.object({ repairHint: z.string().nullable() }) })) })) }).parse(result.details);
      assert.deepEqual(output.summary, { totalHold: 1, totalActive: 0, totalQueued: 0 });
      assert.equal(output.hold.Planning.count, 1);
      assert.equal(output.hold.Planning.issues[0].projection.repairHint, "claw-foundry issue_repair 42 --source local-state --dry-run");
      const limited = await list.execute("list", { channelId: h.channelId, label: "Planning", limit: 0 });
      const listed = z.object({ totalIssues: z.number(), states: z.array(z.object({ total: z.number(), issues: z.array(z.unknown()) })) }).parse(limited.details);
      assert.equal(listed.totalIssues, 1); assert.equal(listed.states[0].total, 1); assert.deepEqual(listed.states[0].issues, []);
      assert.deepEqual(await readIssueStateStore(h.workspaceDir, h.project.slug), before);
      assert.equal(h.commands.commands.length, 0);
      assert.equal(h.provider.callsTo("getIssue").some(call => call.args.issueId === 99), false);
      await assert.rejects(list.execute("unknown-label", { channelId: h.channelId, label: "Unknown" }), /Unknown state label/);
      t.mock.method(GitHubProvider.prototype, "getIssue", async () => { throw new Error("provider unavailable"); });
      await assert.rejects(status.execute("failure", { channelId: h.channelId }), /provider unavailable/);
    } finally { await h.cleanup(); }
  });
});
