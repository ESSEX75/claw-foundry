/** Exercises real task lifecycle SDK adapters, authoritative local eligibility and provider effects. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, type TestContext } from "node:test";
import { z } from "zod";
import { seedIssueRuntimeState } from "../../../testing/index.js";
import type { PluginContext } from "../../../context.js";
import { ISSUE_INTEGRITY_STATUS } from "../../../domain/index.js";
import { GitHubProvider } from "../../../integrations/index.js";
import { composeManagedIssueBody, extractIssueMetadata } from "../../../projection/index.js";
import { loadConfig, readIssueStateStore, updateIssueRuntimeRecord } from "../../../state/index.js";
import { createTestHarness, type TestHarness } from "../../../testing/index.js";
import { createTaskEditBodyTool } from "./task-edit-body.js";
import { createTaskSetLevelTool } from "./task-set-level.js";
import { createTaskStartTool } from "./task-start.js";

/** Workspace configuration fixture for configured custom level validation. */
const CONFIG_PATH = ["devclaw", "workflow.yaml"];

/** Bind only external provider effects; orchestration, eligibility and local writes remain real.
 * @param t - Test-scoped mocks restored automatically after each scenario.
 * @param h - Isolated workspace and in-memory provider.
 */
function bindProvider(t: TestContext, h: TestHarness): void {
  t.mock.method(GitHubProvider.prototype, "getIssue", h.provider.getIssue.bind(h.provider));
  t.mock.method(GitHubProvider.prototype, "editIssue", h.provider.editIssue.bind(h.provider));
  t.mock.method(GitHubProvider.prototype, "ensureLabel", h.provider.ensureLabel.bind(h.provider));
  t.mock.method(GitHubProvider.prototype, "addLabel", h.provider.addLabel.bind(h.provider));
  t.mock.method(GitHubProvider.prototype, "addLabels", h.provider.addLabels.bind(h.provider));
  t.mock.method(GitHubProvider.prototype, "removeLabels", h.provider.removeLabels.bind(h.provider));
  t.mock.method(GitHubProvider.prototype, "reactToIssueComment", async () => {});
}

/** Supply plugin context while rejecting unused framework dependencies.
 * @param h - Workspace fixture whose command recorder detects accidental transport effects.
 */
function pluginContext(h: TestHarness): PluginContext {
  return { runCommand: h.runCommand, config: {}, pluginConfig: undefined,
    /** Lifecycle commands need no SDK runtime access. */
    get runtime(): never { throw new Error("Unexpected runtime dependency"); },
    /** Audit belongs to application and does not use SDK logging. */
    get logger(): never { throw new Error("Unexpected SDK logging"); },
  };
}

/** Initialize an explicit managed hold state independently of provider observations.
 * @param h - Isolated workspace and provider.
 */
async function seedManaged(h: TestHarness): Promise<void> {
  const config = await loadConfig(h.workspaceDir, h.project.slug);
  const issue = h.provider.seedIssue({ iid: 42, title: "Before",
    description: composeManagedIssueBody("Original body", { projectSlug: h.project.slug, issueId: 42 }),
    labels: ["Planning", "review:human", "test:skip"] });
  await seedIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue, providerType: h.project.provider,
    workflow: config.workflow, workflowState: "planning", workflowLabel: "Planning", owner: "local",
    assignedRole: null, assignedLevel: null, reviewPolicy: "human", testPolicy: "skip", integrityStatus: ISSUE_INTEGRITY_STATUS.OK });
}

describe("task lifecycle adapters", () => {
  it("validates a configured custom level, persists its assignment, and reports a repeated request as unchanged", async t => {
    const h = await createTestHarness();
    try {
      await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH), "roles:\n  developer:\n    levels:\n      expert:\n        rank: 4\n        model: test/expert\n");
      await seedManaged(h); bindProvider(t, h);
      const tool = createTaskSetLevelTool(pluginContext(h))({ config: {}, workspaceDir: h.workspaceDir });
      assert.ok(tool && !Array.isArray(tool));
      await assert.rejects(tool.execute("invalid-level", { channelId: h.channelId, issueId: 42, level: "unconfigured" }), /level/i);
      assert.equal(h.provider.callsTo("addLabel").length, 0);
      const args = { channelId: h.channelId, issueId: 42, level: "expert" };
      const first = await tool.execute("set", args);
      assert.equal(z.object({ changed: z.boolean() }).parse(first.details).changed, true);
      assert.equal(z.object({ announcement: z.string() }).parse(first.details).announcement, "🔧 Updated #42: level none → expert");
      const again = await tool.execute("retry", args);
      assert.equal(z.object({ changed: z.boolean() }).parse(again.details).changed, false);
      assert.equal(z.object({ announcement: z.string() }).parse(again.details).announcement, 'Issue #42 already has level "expert".');
      const local = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"];
      assert.equal(local.assignedRole, "developer"); assert.equal(local.assignedLevel, "expert");
      assert.equal(local.workflowState, "planning");
      assert.ok((await h.provider.getIssue(42)).labels.includes("developer:expert"));
    } finally { await h.cleanup(); }
  });

  it("edits actual user content, retains managed metadata, and publishes a real reasoned change comment", async t => {
    const h = await createTestHarness();
    try {
      await seedManaged(h); bindProvider(t, h);
      let commentAdded = () => {};
      const published = new Promise<void>(resolve => { commentAdded = resolve; });
      t.mock.method(GitHubProvider.prototype, "addComment", async (id: number, body: string) => {
        const result = await h.provider.addComment(id, body); commentAdded(); return result;
      });
      const tool = createTaskEditBodyTool(pluginContext(h))({ config: {}, workspaceDir: h.workspaceDir });
      assert.ok(tool && !Array.isArray(tool));
      const args = { channelId: h.channelId, issueId: 42, title: "After", body: "Updated body", reason: "Clarified requirements" };
      const first = await tool.execute("edit", args);
      await published;
      assert.equal(z.object({ changed: z.boolean() }).parse(first.details).changed, true);
      assert.match(z.object({ announcement: z.string() }).parse(first.details).announcement,
        /^✏️ Updated title and body of #42: "After" — Clarified requirements\n🔗/);
      const issue = await h.provider.getIssue(42);
      assert.equal(issue.title, "After"); assert.ok(issue.description.includes("Updated body"));
      assert.equal(extractIssueMetadata(issue.description)?.projectSlug, h.project.slug);
      const comment = h.provider.comments.get(42)?.[0]?.body ?? "";
      assert.match(comment, /Title.*updated/); assert.match(comment, /Description.*updated/);
      assert.match(comment, /Reason:.*Clarified requirements/); assert.match(comment, /\d{4}-\d\d-\d\dT/);
      const retry = await tool.execute("repeat-edit", { ...args, addComment: false });
      assert.equal(z.object({ changed: z.boolean() }).parse(retry.details).changed, false);
      assert.match(z.object({ announcement: z.string() }).parse(retry.details).announcement, /already has the requested content — no changes made/);
      assert.equal(h.provider.callsTo("editIssue").length, 1);
    } finally { await h.cleanup(); }
  });

  it("renders approval from the committed transition without dispatching a worker", async t => {
    const h = await createTestHarness();

    t.after(() => h.cleanup());
    await seedManaged(h);
    bindProvider(t, h);
    const tool = createTaskStartTool(pluginContext(h))({ config: {}, workspaceDir: h.workspaceDir });

    assert.ok(tool && !Array.isArray(tool));
    const output = await tool.execute("approve", { channelId: h.channelId, issueId: 42, level: "medior" });

    assert.equal(z.object({ announcement: z.string() }).parse(output.details).announcement,
      '▶️ #42 moved to "To Do" (level: medior) — heartbeat will dispatch.');
    assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"].workflowState, "todo");
    assert.equal(h.commands.commands.length, 0);
  });

  it("never initializes provider-only issues through edit, level, or approval tools", async t => {
    const h = await createTestHarness();
    try {
      bindProvider(t, h);
      h.provider.seedIssue({ iid: 42, labels: ["Planning", "developer:senior", "owner:foreign", "review:skip"] });
      const ctx = pluginContext(h); const sdk = { config: {}, workspaceDir: h.workspaceDir };
      const cases = [
        { tool: createTaskEditBodyTool(ctx)(sdk), extra: { body: "Must not edit" } },
        { tool: createTaskSetLevelTool(ctx)(sdk), extra: { level: "senior" } },
        { tool: createTaskStartTool(ctx)(sdk), extra: {} },
      ];
      for (const entry of cases) {
        assert.ok(entry.tool && !Array.isArray(entry.tool));
        await assert.rejects(entry.tool.execute("uninitialized", { channelId: h.channelId, issueId: 42, ...entry.extra }), /no local issue state/);
      }
      assert.deepEqual((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues, {});
      assert.equal(h.provider.callsTo("editIssue").length, 0); assert.equal(h.provider.callsTo("addLabel").length, 0);
    } finally { await h.cleanup(); }
  });

  it("rejects provider-edited hold labels when local state is active and preserves saved owner and policies", async t => {
    const h = await createTestHarness();
    try {
      await seedManaged(h); bindProvider(t, h);
      await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, state => {
        assert.ok(state); return { ...state, workflowState: "doing", workflowLabel: "Doing" };
      });
      h.provider.seedIssue({ iid: 42, labels: ["Planning", "owner:foreign", "review:skip"],
        description: "Provider body metadata was edited" });
      const before = await readIssueStateStore(h.workspaceDir, h.project.slug);
      const ctx = pluginContext(h); const sdk = { config: {}, workspaceDir: h.workspaceDir };
      const edit = createTaskEditBodyTool(ctx)(sdk); const start = createTaskStartTool(ctx)(sdk);
      assert.ok(edit && !Array.isArray(edit)); assert.ok(start && !Array.isArray(start));
      await assert.rejects(edit.execute("edit", { channelId: h.channelId, issueId: 42, title: "No" }), /Doing/);
      await assert.rejects(start.execute("start", { channelId: h.channelId, issueId: 42 }), /hold|HOLD|Doing/);
      assert.deepEqual(await readIssueStateStore(h.workspaceDir, h.project.slug), before);
      assert.equal(h.provider.callsTo("editIssue").length, 0);
      assert.equal(h.provider.callsTo("addLabel").length, 0);
    } finally { await h.cleanup(); }
  });

  it("propagates a provider failure without committing a prepared level", async t => {
    const h = await createTestHarness();
    try {
      await seedManaged(h); bindProvider(t, h);
      t.mock.method(GitHubProvider.prototype, "getIssue", async () => { throw new Error("provider unavailable"); });
      const before = await readIssueStateStore(h.workspaceDir, h.project.slug);
      const tool = createTaskSetLevelTool(pluginContext(h))({ config: {}, workspaceDir: h.workspaceDir });
      assert.ok(tool && !Array.isArray(tool));
      await assert.rejects(tool.execute("failure", { channelId: h.channelId, issueId: 42, level: "medior" }), /provider unavailable/);
      assert.deepEqual(await readIssueStateStore(h.workspaceDir, h.project.slug), before);
    } finally { await h.cleanup(); }
  });
});
