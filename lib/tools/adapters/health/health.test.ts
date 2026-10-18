/** Exercises manual health against persisted project policy and real application diagnosis. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { seedIssueRuntimeState } from "../../../testing/index.js";
import type { RunCommand } from "../../../context.js";
import { getRoleWorker, readIssueStateStore, readProjects } from "../../../state/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { createHealthTool } from "./health.js";

/** Workspace configuration fixture consumed through the production config loader. */
const CONFIG_PATH = ["devclaw", "workflow.yaml"];

describe("manual health project policy", () => {
  for (const scenario of ["custom-workflow", "stale-threshold", "stall-threshold", "nudge-agent"]) {
    it(`respects ${scenario}`, async () => {
      const startedAt = new Date(Date.now() - (scenario === "stall-threshold" ? 60_000 * 10 : 3 * 3_600_000)).toISOString();
      const h = await createTestHarness({ workers: { developer: {
        active: true, issueId: 42, level: "medior", sessionKey: "worker", startTime: startedAt, previousLabel: "To Do",
      } } });
      try {
        const custom = scenario === "custom-workflow";
        const nudge = scenario === "nudge-agent";
        const label = custom ? "Developing" : "Doing";
        await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH),
          `timeouts:\n  staleWorkerHours: 10\n  stallTimeoutMinutes: ${nudge ? 1 : 120}\n`
          + (custom ? "workflow:\n  states:\n    doing:\n      label: Developing\n" : ""));
        const workflow = structuredClone(h.workflow);
        if (custom && workflow.states.doing) workflow.states.doing.label = label;
        const issue = h.provider.seedIssue({ iid: 42, labels: [label] });
        await seedIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue,
          providerType: h.project.provider, workflow, workflowState: "doing", workflowLabel: label,
          activeWorker: { role: "developer", level: "medior", slotIndex: 0, sessionKey: "worker", startedAt } });
        const before = await readIssueStateStore(h.workspaceDir, h.project.slug);
        const submissions: unknown[] = [];
        const runCommand: RunCommand = async (argv) => {
          let output: unknown;
          if (argv[0] === "openclaw" && argv[3] === "status") {
            output = { sessions: { recent: [{ key: "worker", updatedAt: Date.now() - (scenario === "stale-threshold" ? 0 : 30 * 60_000),
              contextTokens: 100_000 }] } };
          } else if (argv[0] === "gh" && argv[1] === "issue" && argv[2] === "view") {
            output = { number: 42, title: issue.title, body: issue.description,
              labels: [{ name: label }], state: "OPEN", url: issue.web_url };
          } else if (argv[0] === "openclaw" && argv[3] === "agent") {
            const index = argv.indexOf("--params");
            submissions.push(JSON.parse(argv[index + 1] ?? "null"));
            output = {};
          } else {
            throw new Error(`Unexpected command: ${argv.join(" ")}`);
          }
          return { code: 0, stdout: JSON.stringify(output), stderr: "", signal: null, killed: false, termination: "exit" };
        };
        const tool = createHealthTool({ runCommand })({ config: {}, workspaceDir: h.workspaceDir });
        assert.ok(tool && !Array.isArray(tool));
        const result = await tool.execute("health-test", { fix: true });
        const data = result.details;
        assert.ok(data && typeof data === "object" && "issues" in data);
        if (nudge) {
          assert.equal(submissions.length, 1);
          assert.ok(submissions[0] && typeof submissions[0] === "object" && "agentId" in submissions[0]);
          assert.equal(submissions[0].agentId, h.project.agentId);
        } else {
          assert.deepEqual(data.issues, []);
          assert.deepEqual(await readIssueStateStore(h.workspaceDir, h.project.slug), before);
          assert.deepEqual(submissions, []);
        }
        const project = (await readProjects(h.workspaceDir)).projects[h.project.slug];
        assert.ok(project);
        assert.equal(getRoleWorker(project, "developer").levels.medior?.[0]?.active, true);
      } finally {
        await h.cleanup();
      }
    });
  }
});
