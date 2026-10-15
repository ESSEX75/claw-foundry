/** Exercises durable research creation, exact replay and configured scheduling through real worker dispatch. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import type { RunCommand } from "../../../context.js";
import { ISSUE_PROVIDER } from "../../../domain/index.js";
import { ProviderOperationError, PROVIDER_OPERATION_ERROR } from "../../../integrations/index.js";
import { readIssueStateStore, updateIssueRuntimeRecord, updateSlot } from "../../../state/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { researchTask } from "./command.js";
import type { ResearchTaskInput } from "./types.js";

/** Project configuration fixture path for renamed workflow states and worker capacities. */
const CONFIG_PATH = ["devclaw", "workflow.yaml"];

/** Bind a stable research request to an isolated provider and command transport.
 * @param h - Isolated project, provider and external command recorder.
 */
function request(h: Awaited<ReturnType<typeof createTestHarness>>): ResearchTaskInput {
  return { workspaceDir: h.workspaceDir, channelId: h.channelId, title: "Research storage", description: "Choose storage guarantees",
    idempotencyKey: "request", complexity: "simple", provider: h.provider, runCommand: h.runCommand,
    pluginConfig: { notifications: { workerStart: false, workerComplete: false } } };
}

describe("research command", () => {
  it("uses renamed workflow labels and a free second slot, then deduplicates concurrent retries", async () => {
    const h = await createTestHarness({ workers: { architect: { active: true, issueId: 99, level: "junior", sessionKey: "busy" } } });
    try {
      await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH),
        "roles:\n  architect:\n    levels:\n      junior:\n        maxWorkers: 2\nworkflow:\n  states:\n    toResearch:\n      label: Investigate\n    researching:\n      label: Investigating\n");
      const input = request(h);
      const results = await Promise.all([researchTask(input), researchTask(input)]);
      assert.equal(h.provider.callsTo("createIssue").length, 1);
      assert.equal(h.commands.taskMessages().length, 1);
      assert.equal(results.filter(result => result.status === "dispatched").length, 1);
      assert.equal(results.filter(result => result.status === "already_started").length, 1);
      const issue = results[0].issue;
      assert.ok(issue);
      const local = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues[String(issue.iid)];
      assert.equal(local?.workflowLabel, "Investigating");
      assert.equal(local?.activeWorker?.slotIndex, 1);
      await assert.rejects(researchTask({ ...input, title: "Changed payload" }), /different creation payload/);
      assert.equal(h.provider.callsTo("createIssue").length, 1);
    } finally { await h.cleanup(); }
  });

  it("returns unknown delivery identity and never resends it on another invocation", async () => {
    const h = await createTestHarness();
    try {
      const runCommand: RunCommand = async (argv, options) => {
        const result = await h.runCommand(argv, options);
        return argv[0] === "openclaw" && argv[3] === "agent" ? { ...result, code: 1, stderr: "response lost" } : result;
      };
      const input = { ...request(h), runCommand };
      const first = await researchTask(input);
      assert.equal(first.deliveryStatus, "unknown");
      assert.ok(first.deliveryId);
      const again = await researchTask(input);
      assert.equal(again.status, "delivery_pending");
      assert.equal(again.deliveryStatus, "unknown");
      assert.equal(again.deliveryId, first.deliveryId);
      assert.equal(h.commands.taskMessages().length, 1);
      assert.equal(h.provider.callsTo("createIssue").length, 1);
    } finally { await h.cleanup(); }
  });

  it("keeps pending delivery distinct and never restarts a completed research request", { timeout: 15_000 }, async t => {
    const h = await createTestHarness();
    let accept = () => {};
    const response = new Promise<void>(resolve => { accept = resolve; });
    try {
      const runCommand: RunCommand = async (argv, options) => {
        const result = await h.runCommand(argv, options);
        if (argv[0] === "openclaw" && argv[3] === "agent") await response;
        return result;
      };
      const input = { ...request(h), runCommand };
      const first = await researchTask(input);
      assert.equal(first.deliveryStatus, "pending");
      const retry = await researchTask(input);
      assert.equal(retry.status, "delivery_pending");
      assert.equal(retry.deliveryId, first.deliveryId);
      assert.equal(h.commands.taskMessages().length, 1);
      const issueId = first.issue?.iid;
      assert.ok(issueId);
      const reactToIssue = h.provider.reactToIssue.bind(h.provider);
      let settlementObserved = () => {};
      const settled = new Promise<void>(resolve => { settlementObserved = resolve; });
      t.mock.method(h.provider, "reactToIssue", async (...args: Parameters<typeof reactToIssue>) => {
        await reactToIssue(...args);
        settlementObserved();
      });
      // Accepted delivery persists both ownership views before acknowledging the issue.
      accept();
      await settled;
      assert.equal((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues[String(issueId)]?.activeWorker?.delivery, undefined);
      await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, issueId, state => {
        assert.ok(state);
        return { ...state, workflowState: "refining", workflowLabel: "Refining", activeWorker: null };
      });
      await updateSlot(h.workspaceDir, h.project.slug, "architect", "junior", 0, slot => ({ ...slot, active: false, issueId: null, startTime: null }));
      const completed = await researchTask(input);
      assert.equal(completed.status, "already_processed");
      assert.equal(completed.label, "Refining");
      assert.equal(h.commands.taskMessages().length, 1);
    } finally { accept(); await h.cleanup(); }
  });

  it("retains a ready queued issue after proven model setup failure and resumes without creating another issue", async () => {
    const h = await createTestHarness();
    try {
      const runCommand: RunCommand = async (argv, options) => {
        const result = await h.runCommand(argv, options);
        return argv[3] === "sessions.patch" ? { ...result, code: 1, stderr: "model setup failed" } : result;
      };
      const first = await researchTask({ ...request(h), runCommand });
      assert.equal(first.status, "dispatch_failed");
      assert.equal(first.creation?.success, true);
      assert.equal(h.commands.taskMessages().length, 0);
      const retried = await researchTask(request(h));
      assert.equal(retried.deliveryStatus, "accepted");
      assert.equal(h.provider.callsTo("createIssue").length, 1);
      assert.equal(h.commands.taskMessages().length, 1);
    } finally { await h.cleanup(); }
  });

  it("reports unresolved provider creation with recovery details and does not replay an unknown create", async () => {
    const h = await createTestHarness();
    try {
      let creates = 0;
      h.provider.createIssue = async () => {
        creates++;
        throw new ProviderOperationError({ code: PROVIDER_OPERATION_ERROR.UNKNOWN, retryable: false, outcomeUnknown: true, message: "lost create response" });
      };
      const first = await researchTask(request(h));
      const second = await researchTask(request(h));
      assert.equal(first.success, false);
      assert.equal(first.creation?.status, "manual_repair_required");
      assert.equal(second.creation?.operationId, first.creation?.operationId);
      assert.equal(creates, 1);
      assert.equal(h.commands.taskMessages().length, 0);
    } finally { await h.cleanup(); }
  });

  it("validates ambiguous queues and malformed bodies in dry-run without mutations", async () => {
    const h = await createTestHarness();
    try {
      await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH), "workflow:\n  states:\n    extraResearch:\n      type: queue\n      role: architect\n      label: Extra Research\n      color: '#ffffff'\n      on:\n        PICKUP:\n          target: researching\n");
      await assert.rejects(researchTask({ ...request(h), dryRun: true }), /exactly one/);
      const preview = await researchTask({ ...request(h), workflowState: "extraResearch", dryRun: true });
      assert.equal(preview.status, "dry_run");
      assert.equal(preview.label, "Extra Research");
      await assert.rejects(researchTask({ ...request(h), workflowState: "extraResearch", dryRun: true,
        description: "<!-- devclaw:issue-metadata" }));
      assert.equal(h.provider.calls.length, 0);
      assert.deepEqual(h.commands.commands, []);
    } finally { await h.cleanup(); }
  });

  it("queues research while another project owns sequential execution", async () => {
    const h = await createTestHarness();
    try {
      await h.writeProjects({ projects: { [h.project.slug]: h.project, other: { ...h.project, slug: "other", name: "Other",
        provider: ISSUE_PROVIDER.GITHUB, channels: [{ ...h.project.channels[0], channelId: "other" }],
        workers: { developer: { levels: { medior: [{ active: true, issueId: 9, sessionKey: "other", startTime: null }] } } } } } });
      const result = await researchTask({ ...request(h), pluginConfig: { projectExecution: "sequential" } });
      assert.equal(result.status, "queued");
      assert.match(result.reason ?? "", /another project/);
      assert.equal(result.creation?.success, true);
      assert.equal(h.commands.taskMessages().length, 0);
    } finally { await h.cleanup(); }
  });
});
