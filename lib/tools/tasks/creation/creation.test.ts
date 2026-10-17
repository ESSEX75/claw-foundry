/** Verifies creation adapter formatting, stable keys and honest unresolved creation results through real application commands. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { PluginContext } from "../../../context.js";
import { GitHubProvider, ProviderOperationError, PROVIDER_OPERATION_ERROR } from "../../../integrations/index.js";
import { readIssueStateStore } from "../../../state/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { createResearchTaskTool } from "./research-task.js";
import { createTaskCreateTool } from "./task-create.js";

describe("creation adapters", () => {
  it("formats ready issue identity and resumes the same creation across distinct SDK invocation IDs", async t => {
    const h = await createTestHarness();
    try {
      t.mock.method(GitHubProvider.prototype, "createIssue", h.provider.createIssue.bind(h.provider));
      t.mock.method(GitHubProvider.prototype, "getIssue", h.provider.getIssue.bind(h.provider));
      t.mock.method(GitHubProvider.prototype, "editIssue", h.provider.editIssue.bind(h.provider));
      t.mock.method(GitHubProvider.prototype, "ensureLabel", h.provider.ensureLabel.bind(h.provider));
      t.mock.method(GitHubProvider.prototype, "addLabel", h.provider.addLabel.bind(h.provider));
      t.mock.method(GitHubProvider.prototype, "removeLabels", h.provider.removeLabels.bind(h.provider));
      t.mock.method(GitHubProvider.prototype, "reactToIssue", async () => {});
      const ctx: PluginContext = { runCommand: h.runCommand, config: {}, pluginConfig: undefined,
        /** Creation uses no gateway runtime. */
        get runtime(): never { throw new Error("Unexpected runtime"); },
        /** Creation audit does not use SDK logging. */
        get logger(): never { throw new Error("Unexpected SDK logging"); },
      };
      const tool = createTaskCreateTool(ctx)({ config: {}, workspaceDir: h.workspaceDir, agentId: h.project.agentId });
      assert.ok(tool && !Array.isArray(tool));
      const input = { channelId: h.channelId, title: "Implement search", description: "Search requirements", idempotencyKey: "stable-request" };
      const result = await tool.execute("first-invocation", input);
      const output = z.object({ success: z.literal(true), issue: z.object({ id: z.number(), url: z.string(), workflowState: z.string() }),
        announcement: z.string() }).parse(result.details);
      assert.equal(output.issue.workflowState, "planning"); assert.ok(output.announcement.includes(output.issue.url));
      assert.match(output.announcement, /Waiting in the initial hold state\. Use task_start/);
      const retry = await tool.execute("new-invocation", input);
      assert.equal(z.object({ issue: z.object({ id: z.number() }) }).parse(retry.details).issue.id, output.issue.id);
      assert.equal(h.provider.callsTo("createIssue").length, 1);
      const saved = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues[String(output.issue.id)];
      assert.equal(saved.workflowState, "planning");
    } finally { await h.cleanup(); }
  });

  it("previews research without effects and reports unknown creation honestly without replay", async t => {
    const h = await createTestHarness();
    try {
      let creates = 0;
      t.mock.method(GitHubProvider.prototype, "createIssue", async () => {
        creates++;
        throw new ProviderOperationError({ code: PROVIDER_OPERATION_ERROR.UNKNOWN, retryable: false,
          outcomeUnknown: true, message: "lost provider response" });
      });
      const tool = createResearchTaskTool({ runCommand: h.runCommand })({ config: {}, workspaceDir: h.workspaceDir });
      assert.ok(tool && !Array.isArray(tool));
      const input = { channelId: h.channelId, idempotencyKey: "research-request", title: "Research storage", description: "Compare durable storage" };
      const preview = await tool.execute("preview", { ...input, dryRun: true });
      assert.equal(z.object({ success: z.boolean(), status: z.string() }).parse(preview.details).status, "dry_run");
      assert.equal(creates, 0); assert.equal(h.commands.commands.length, 0);
      const failed = await tool.execute("first", input);
      const data = z.object({ success: z.literal(false), status: z.literal("creation_pending"),
        creation: z.object({ operationId: z.string(), status: z.literal("manual_repair_required") }),
        research: z.object({ status: z.literal("creation_pending") }) }).parse(failed.details);
      const retry = await tool.execute("second", input);
      assert.equal(z.object({ creation: z.object({ operationId: z.string() }) }).parse(retry.details).creation.operationId, data.creation.operationId);
      assert.equal(creates, 1);
      assert.deepEqual((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues, {});
    } finally { await h.cleanup(); }
  });
});
