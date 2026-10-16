/** Verifies CLI exit status and JSON output through real administrative use cases and a fake GitHub transport. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, type TestContext } from "node:test";
import { Command } from "commander";
import { z } from "zod";

import type { RunCommand } from "../../context.js";
import { ISSUE_INTEGRITY_STATUS, ISSUE_PROVIDER, type IssueRuntimeState } from "../../domain/index.js";
import { renderIssueMetadata } from "../../projection/index.js";
import { DATA_DIR, PROJECTS_DIRECTORY_NAME, readIssueStateStore } from "../../state/index.js";
import { createEmptyIssueStateStoreForTesting, createSetupRuntime, createTestHarness, replaceIssueStateStoreForTesting } from "../../testing/index.js";
import { registerIssuesArchiveCommand } from "./issues-archive-command.js";
import { registerRepairIssueCommand } from "./repair-issue-command.js";

/** Archive collision fixture used to force a recoverable local archival failure. */
const ARCHIVE_COLLISION_FILE_NAME = "issues.archive.json";

/** Create a real local issue, fake only process I/O, and isolate console/exit state.
 * @param t - Test lifecycle owning temporary storage and process-global cleanup.
 * @param occupied - Whether a persisted worker slot reserves the issue.
 */
async function createCliFixture(t: TestContext, occupied = false) {
  const h = await createTestHarness(occupied ? { workers: {
    developer: { active: true, issueId: 123, sessionKey: "exact-owner" },
  } } : undefined);
  const previousExitCode = process.exitCode;

  t.after(async () => {
    process.exitCode = previousExitCode;
    await h.cleanup();
  });
  const state: IssueRuntimeState = {
    projectSlug: h.project.slug, issueId: 123, provider: ISSUE_PROVIDER.GITHUB,
    workflowState: "todo", workflowLabel: "To Do", assignedRole: null, assignedLevel: null,
    owner: null, reviewPolicy: null, testPolicy: null, notifyTarget: null, activeWorker: null,
    integrityStatus: ISSUE_INTEGRITY_STATUS.OK, integrityErrors: [],
    createdAt: "2026-10-16T00:00:00.000Z", updatedAt: "2026-10-16T00:00:00.000Z",
    closedAt: null, providerMissing: null, pipelineNotification: null,
  };
  const store = createEmptyIssueStateStoreForTesting(h.project.slug);

  store.issues["123"] = state;
  await replaceIssueStateStoreForTesting(h.workspaceDir, h.project.slug, store);
  const wire = {
    labels: ["To Do"],
    body: renderIssueMetadata({ projectSlug: h.project.slug, issueId: 123 }),
    missing: false,
    stillVisible: false,
    rejectEdits: false,
  };
  const calls: string[][] = [];
  const runCommand: RunCommand = async args => {
    calls.push([...args]);
    let stdout = "";
    let stderr = "";
    let code = 0;

    if (args[0] !== "gh") throw new Error(`Unexpected transport: ${args[0]}`);
    if (args[1] === "issue" && args[2] === "view") {
      if (wire.missing) {
        code = 1;
        stderr = "HTTP 404: Not Found";
      } else {
        stdout = JSON.stringify({ number: 123, title: "Managed issue", body: wire.body,
          labels: wire.labels.map(name => ({ name })), state: "OPEN", url: "https://github.com/test/repo/issues/123" });
      }
    } else if (args[1] === "repo" && args[2] === "view") {
      stdout = JSON.stringify({ name: "repo", owner: { login: "test" } });
    } else if (args[1] === "api" && args[2] === "rate_limit") {
      stdout = JSON.stringify({ resources: { core: { remaining: 5000, reset: 2000000000 } } });
    } else if (args[1] === "issue" && args[2] === "delete") {
      wire.missing = !wire.stillVisible;
    } else if (args[1] === "label" && args[2] === "create") {
      stdout = "";
    } else if (args[1] === "issue" && args[2] === "edit" && wire.rejectEdits) {
      code = 1;
      stderr = "HTTP 403: Forbidden";
    } else {
      throw new Error(`Unexpected provider request: ${args.join(" ")}`);
    }

    return { code, stdout, stderr, signal: null, killed: false, termination: "exit" };
  };
  const { runtime } = createSetupRuntime();
  const lines: string[] = [];

  t.mock.method(console, "log", (line: string) => { lines.push(line); });

  /** Execute one fresh command parser and validate its printed JSON envelope.
   * @param args - Terminal command and explicit preview/apply flags.
   * @param initialExitCode - Prior command failure that successful output must preserve.
   */
  async function execute(args: string[], initialExitCode?: number) {
    const parent = new Command();

    registerRepairIssueCommand(parent, { runtime, runCommand });
    registerIssuesArchiveCommand(parent, { runtime, runCommand });
    lines.length = 0;
    process.exitCode = initialExitCode;
    await parent.parseAsync([...args, "--project", h.project.slug, "--issue", "123", "--workspace", h.workspaceDir], { from: "user" });
    assert.equal(lines.length, 1, "the application result remains a single JSON output");
    const output: unknown = JSON.parse(lines[0] ?? "null");

    return z.record(z.string(), z.unknown()).parse(output);
  }

  return { h, wire, calls, execute };
}

describe("administrative CLI result status", () => {
  it("keeps repair previews and already-consistent apply successful", async t => {
    const fixture = await createCliFixture(t);
    const preview = await fixture.execute(["repair", "issue", "--source", "local-state", "--dry-run"]);

    assert.equal(preview.success, true);
    assert.equal(process.exitCode, undefined);
    const applied = await fixture.execute(["repair", "issue", "--source", "local-state", "--apply", "--plan-token", z.string().parse(preview.planToken)]);

    assert.equal(applied.success, true);
    assert.equal(process.exitCode, undefined);
  });

  it("returns the stale-plan JSON with a failing exit code and no provider edits", async t => {
    const fixture = await createCliFixture(t);
    const result = await fixture.execute(["repair", "issue", "--source", "local-state", "--apply", "--plan-token", "stale"]);

    assert.equal(result.success, false);
    assert.equal(result.status, "blocked");
    assert.equal(process.exitCode, 1);
    assert.ok(!fixture.calls.some(args => args[2] === "edit"));
  });

  it("reports an exact worker-slot refusal as failure", async t => {
    const fixture = await createCliFixture(t, true);
    const preview = await fixture.execute(["repair", "issue", "--source", "local-state", "--dry-run"]);
    const result = await fixture.execute(["repair", "issue", "--source", "local-state", "--apply", "--plan-token", z.string().parse(preview.planToken)]);

    assert.equal(result.success, false);
    assert.equal(result.status, "blocked");
    assert.equal(process.exitCode, 1);
  });

  it("retains recovery JSON and integrity state after projection failure", async t => {
    const fixture = await createCliFixture(t);

    fixture.wire.labels = ["Doing"];
    fixture.wire.rejectEdits = true;
    const preview = await fixture.execute(["repair", "issue", "--source", "local-state", "--dry-run"]);
    const result = await fixture.execute(["repair", "issue", "--source", "local-state", "--apply", "--plan-token", z.string().parse(preview.planToken)]);

    assert.equal(result.success, false);
    assert.equal(result.status, "partial_failure");
    assert.ok(Array.isArray(result.recoveryPlan));
    assert.equal(process.exitCode, 1);
    assert.equal((await readIssueStateStore(fixture.h.workspaceDir, fixture.h.project.slug)).issues["123"]?.integrityStatus,
      ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR);
  });

  it("keeps deletion previews successful without deleting or archiving", async t => {
    const fixture = await createCliFixture(t);
    const result = await fixture.execute(["issues", "delete", "--dry-run"]);

    assert.equal(result.deleted, false);
    assert.equal(result.archived, false);
    assert.equal(result.dryRun, true);
    assert.equal(process.exitCode, undefined);
    assert.ok(!fixture.calls.some(args => args[2] === "delete"));
  });

  it("fails apply while the provider still returns the issue", async t => {
    const fixture = await createCliFixture(t);

    fixture.wire.stillVisible = true;
    const result = await fixture.execute(["issues", "delete", "--apply", "--confirm-issue", "123"]);

    assert.equal(result.deleted, false);
    assert.equal(result.archived, false);
    assert.ok(Array.isArray(result.recoveryPlan));
    assert.equal(process.exitCode, 1);
  });

  it("fails apply when provider deletion succeeded but local archival failed", async t => {
    const fixture = await createCliFixture(t);
    const archivePath = path.join(fixture.h.workspaceDir, DATA_DIR, PROJECTS_DIRECTORY_NAME, fixture.h.project.slug, ARCHIVE_COLLISION_FILE_NAME);

    await fs.mkdir(archivePath);
    const result = await fixture.execute(["issues", "delete", "--apply", "--confirm-issue", "123"]);

    assert.equal(result.deleted, true);
    assert.equal(result.archived, false);
    assert.ok(Array.isArray(result.recoveryPlan));
    assert.equal(process.exitCode, 1);
    assert.ok((await readIssueStateStore(fixture.h.workspaceDir, fixture.h.project.slug)).issues["123"]);
  });

  it("preserves an existing process failure after a successful preview", async t => {
    const fixture = await createCliFixture(t);

    await fixture.execute(["issues", "delete", "--dry-run"], 7);
    assert.equal(process.exitCode, 7);
  });

  it("keeps worker-owned migration skips successful", async t => {
    const fixture = await createCliFixture(t, true);
    const result = await fixture.execute(["repair", "policies", "--review", "human", "--dry-run"]);

    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.skipped, [{ issueId: 123, reason: "active_worker" }]);
    assert.equal(process.exitCode, undefined);
    assert.deepEqual(fixture.calls, []);
  });

  it("keeps policy no-change outcomes successful", async t => {
    const fixture = await createCliFixture(t);
    const store = await readIssueStateStore(fixture.h.workspaceDir, fixture.h.project.slug);
    const issue = store.issues["123"];

    assert.ok(issue);
    store.issues["123"] = { ...issue, reviewPolicy: "human" };
    await replaceIssueStateStoreForTesting(fixture.h.workspaceDir, fixture.h.project.slug, store);
    const result = await fixture.execute(["repair", "policies", "--review", "human", "--dry-run"]);

    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.skipped, [{ issueId: 123, reason: "no_change" }]);
    assert.equal(process.exitCode, undefined);
    assert.deepEqual(fixture.calls, []);
  });

  it("keeps fully completed deletion successful", async t => {
    const fixture = await createCliFixture(t);
    const result = await fixture.execute(["issues", "delete", "--apply", "--confirm-issue", "123"]);

    assert.equal(result.deleted, true);
    assert.equal(result.archived, true);
    assert.equal(process.exitCode, undefined);
  });
});
