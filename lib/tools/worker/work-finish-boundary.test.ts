/** Verifies custom configured completion results through the public worker adapter and local state commit. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { z } from "zod";

import { writeIssueRuntimeState } from "../../application/index.js";
import type { RunCommand } from "../../context.js";
import { getRoleWorker, loadConfig, readIssueStateStore } from "../../state/index.js";
import { createTestHarness } from "../../testing/index.js";
import { createWorkFinishTool } from "./work-finish.js";

/** Workspace override fixture consumed by the actual resolved role configuration. */
const CONFIG_PATH = ["devclaw", "workflow.yaml"];

describe("work_finish configured results", () => {
  it("accepts a custom result, commits its transition and rejects an unconfigured result", async () => {
    const startedAt = new Date().toISOString();
    const h = await createTestHarness({ workers: { architect: {
      active: true, issueId: 42, level: "junior", sessionKey: "research-worker", startTime: startedAt,
    } } });
    try {
      await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH), "roles:\n  architect:\n    completion:\n      findings_ready: BLOCKED\n");
      const config = await loadConfig(h.workspaceDir, h.project.slug);
      const issue = h.provider.seedIssue({ iid: 42, labels: ["Researching"] });
      await writeIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue,
        providerType: h.project.provider, workflow: config.workflow, workflowState: "researching", workflowLabel: "Researching",
        activeWorker: { role: "architect", level: "junior", slotIndex: 0, sessionKey: "research-worker", startedAt } });
      const labels = new Set(issue.labels);
      const commands: string[][] = [];
      const runCommand: RunCommand = async (argv) => {
        commands.push(argv);
        let stdout = "";
        if (argv[0] === "gh" && argv[1] === "issue" && argv[2] === "view") {
          stdout = JSON.stringify({ number: 42, title: issue.title, body: issue.description,
            labels: [...labels].map(name => ({ name })), state: "OPEN", url: issue.web_url });
        } else if (argv[0] === "gh" && argv[1] === "issue" && argv[2] === "edit") {
          for (let index = 0; index < argv.length - 1; index++) {
            if (argv[index] === "--add-label") labels.add(argv[index + 1]);
            if (argv[index] === "--remove-label") labels.delete(argv[index + 1]);
          }
        } else throw new Error(`Unexpected command: ${argv.join(" ")}`);
        return { code: 0, stdout, stderr: "", signal: null, killed: false, termination: "exit" };
      };
      const tool = createWorkFinishTool({ runCommand, pluginConfig: { notifications: { workerComplete: false } } })({
        config: {}, workspaceDir: h.workspaceDir, sessionKey: "research-worker",
      });
      assert.ok(tool && !Array.isArray(tool));
      const schema = z.object({ properties: z.object({ result: z.object({ type: z.literal("string"), enum: z.never().optional() }) }) }).parse(tool.parameters);
      assert.equal(schema.properties.result.type, "string");
      await assert.rejects(tool.execute("unknown-result", { channelId: h.channelId, role: "architect", result: "not_configured" }), /cannot complete/);
      assert.deepEqual(commands, []);
      const result = await tool.execute("finish", { channelId: h.channelId, role: "architect", result: "findings_ready" });
      assert.ok(result.details && typeof result.details === "object" && "success" in result.details);
      assert.equal(result.details.success, true);
      const local = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"];
      assert.equal(local?.workflowState, "refining");
      assert.equal(local?.activeWorker, null);
      assert.ok(labels.has("Refining"));
      const project = (await h.readProjects()).projects[h.project.slug];
      assert.ok(project);
      assert.equal(getRoleWorker(project, "architect").levels.junior?.[0]?.active, false);
    } finally { await h.cleanup(); }
  });
});
