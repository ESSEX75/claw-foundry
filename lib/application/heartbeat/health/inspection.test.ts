/** Verifies manual health scope, retained role diagnostics and independent inspection failures. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import type { RunCommand } from "../../../context.js";
import { readIssueStateStore } from "../../../state/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { writeIssueRuntimeState } from "../../issue-runtime/index.js";
import { inspectWorkerHealth } from "./inspection.js";
import { diagnoseWorkerHealth } from "./worker-diagnosis.js";
import { remediateWorkerHealth } from "./worker-remediation.js";

/** Workspace configuration fixture used to disable a persisted role. */
const CONFIG_PATH = ["devclaw", "workflow.yaml"];

describe("manual health inspection", () => {
  it("rejects invalid and unknown explicit scopes before gateway or provider observations", async () => {
    const h = await createTestHarness();
    try {
      for (const projectSlug of ["", " ", "../other", "unknown", "constructor"]) {
        await assert.rejects(inspectWorkerHealth({ workspaceDir: h.workspaceDir, projectSlug, runCommand: h.runCommand }));
      }
      assert.deepEqual(h.commands.commands, []);
    } finally { await h.cleanup(); }
  });

  for (const role of ["developer", "removed-role"]) {
    it(`reports retained ${role} reservations without implicitly releasing or requeueing them`, async () => {
      const startedAt = new Date(Date.now() - 3_600_000).toISOString();
      const h = await createTestHarness({ workers: { [role]: { active: true, issueId: 42, level: "medior", sessionKey: "worker", startTime: startedAt } } });
      try {
        if (role === "developer") await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH), "roles:\n  developer: false\n");
        const issue = h.provider.seedIssue({ iid: 42, labels: ["Doing"] });
        await writeIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue,
          providerType: h.project.provider, workflow: h.workflow, workflowState: "doing", workflowLabel: "Doing", assignedRole: role,
          activeWorker: { role, level: "medior", slotIndex: 0, sessionKey: "worker", startedAt } });
        const before = await readIssueStateStore(h.workspaceDir, h.project.slug);
        const slots = await h.readProjects();
        const result = await inspectWorkerHealth({ workspaceDir: h.workspaceDir, fix: true, runCommand: h.runCommand,
          providerForProject: async () => h.provider });
        const finding = result.issues.find(fix => fix.issue.role === role);
        assert.equal(finding?.issue.type, "role_unavailable");
        assert.equal(finding?.plannedAction, undefined);
        assert.equal(finding?.fixed, false);
        assert.deepEqual(await readIssueStateStore(h.workspaceDir, h.project.slug), before);
        assert.deepEqual(await h.readProjects(), slots);
        assert.equal(h.provider.calls.length, 0);
        assert.equal(h.commands.taskMessages().length, 0);
      } finally { await h.cleanup(); }
    });
  }

  it("retains a later project's findings after a provider dependency fails and reads gateway inventory once", async () => {
    const h = await createTestHarness();
    try {
      const other = { ...h.project, slug: "other", name: "Other", channels: [{ ...h.project.channels[0], channelId: "other" }],
        workers: { developer: { levels: { medior: [{ active: true, issueId: 99, sessionKey: "other", startTime: null }] } } } };
      await h.writeProjects({ projects: { [h.project.slug]: h.project, other } });
      const result = await inspectWorkerHealth({ workspaceDir: h.workspaceDir, runCommand: h.runCommand,
        providerForProject: async project => {
          if (project.slug === h.project.slug) throw new Error("");
          return h.provider;
        } });
      assert.equal(result.success, false);
      assert.equal(result.projectsScanned, 2);
      assert.ok(result.issues.some(fix => fix.issue.projectSlug === h.project.slug && fix.issue.type === "inspection_failed"));
      assert.ok(result.issues.some(fix => fix.issue.projectSlug === "other" && fix.issue.type === "issue_state_missing"));
      assert.equal(h.commands.commands.filter(command => command.argv[3] === "status").length, 1);
    } finally { await h.cleanup(); }
  });

  it("rechecks role availability under the issue lock before applying an old finding", async () => {
    const startedAt = new Date(Date.now() - 3_600_000).toISOString();
    const h = await createTestHarness({ workers: { developer: {
      active: true, issueId: 42, level: "medior", sessionKey: "worker", startTime: startedAt,
    } } });
    try {
      const issue = h.provider.seedIssue({ iid: 42, labels: ["Doing"] });
      await writeIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue,
        providerType: h.project.provider, workflow: h.workflow, workflowState: "doing", workflowLabel: "Doing",
        activeWorker: { role: "developer", level: "medior", slotIndex: 0, sessionKey: "worker", startedAt } });
      const input = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug, project: h.project,
        role: "developer", roleEnabled: true, workflow: h.workflow, provider: h.provider, runCommand: h.runCommand,
        sessions: { sessions: new Map(), complete: true } };
      const finding = (await diagnoseWorkerHealth(input))[0];
      assert.ok(finding);
      assert.equal(finding.plannedAction, "requeue");
      await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH), "roles:\n  developer: false\n");
      const before = await readIssueStateStore(h.workspaceDir, h.project.slug);
      const result = await remediateWorkerHealth(input, finding);
      assert.equal(result.fixed, false);
      assert.match(result.error ?? "", /became disabled/);
      assert.deepEqual(await readIssueStateStore(h.workspaceDir, h.project.slug), before);
      assert.equal(h.provider.callsTo("addLabels").length, 0);
    } finally { await h.cleanup(); }
  });

  it("retains later role findings after an issue read fails and ignores provider-only issues", async () => {
    const h = await createTestHarness({ workers: {
      developer: { active: true, issueId: 42, level: "medior", sessionKey: "worker" },
      reviewer: { active: true, issueId: 43, level: "junior", sessionKey: "reviewer" },
    } });
    try {
      const issue = h.provider.seedIssue({ iid: 42, labels: ["Doing"] });
      h.provider.seedIssue({ iid: 400, labels: ["Doing"] });
      await writeIssueRuntimeState({ workspaceDir: h.workspaceDir, project: h.project, issue,
        providerType: h.project.provider, workflow: h.workflow, workflowState: "doing", workflowLabel: "Doing" });
      h.provider.getIssue = async () => { throw new Error("read unavailable"); };
      const runCommand: RunCommand = async (argv, options) => h.runCommand(argv, options);
      const result = await inspectWorkerHealth({ workspaceDir: h.workspaceDir, runCommand, providerForProject: async () => h.provider });
      assert.ok(result.issues.some(fix => fix.issue.role === "developer" && fix.issue.type === "inspection_failed"));
      assert.ok(result.issues.some(fix => fix.issue.role === "reviewer" && fix.issue.type === "issue_state_missing"));
      assert.ok(!result.issues.some(fix => fix.issue.issueId === 400));
      assert.equal(h.provider.callsTo("listIssues").length, 0);
      assert.equal(h.provider.callsTo("listIssuesByLabel").length, 0);
      assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["400"], undefined);
    } finally { await h.cleanup(); }
  });
});
