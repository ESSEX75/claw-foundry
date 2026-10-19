/** Exercises policy resolution and the exact destructive recovery scope of operator issue commands. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { ATTACHMENT_DISPOSITION, ISSUE_ARCHIVE_REASON, ISSUE_INTEGRITY_STATUS, ISSUE_PROVIDER } from "../../../domain/index.js";
import { DATA_DIR, PROJECTS_DIRECTORY_NAME, readIssueArchiveStore, readIssueStateStore } from "../../../state/index.js";
import { createTestHarness, replaceIssueArchiveStoreForTesting } from "../../../testing/index.js";
import { inspectProjectIssueArchive, purgeProjectIssueArchive } from "./archive-commands.js";
import { deleteProjectIssue } from "./deletion-command.js";
import { resetProjectIssueStores } from "./reset-command.js";

/** Project configuration fixture for explicit retention resolution. */
const WORKFLOW_FIXTURE_FILE_NAME = "workflow.yaml";

/** Workspace registry filename used to simulate missing or corrupt registry recovery. */
const REGISTRY_FIXTURE_FILE_NAME = "projects.json";

/** Active/archive files are the only entries reset is allowed to replace. */
const ISSUE_STORE_FIXTURE_NAMES = ["issues.json", "issues.archive.json"];

/** Adjacent evidence and attachment bytes must survive a scoped store reset. */
const PRESERVED_FIXTURE_NAMES = ["issue-creations.json", "worker-delivery-resolutions.json", "attachment-proof.bin"];

describe("operator issue administration", () => {
  it("keeps status and purge previews read-only without a registry", async t => {
    const h = await createTestHarness();
    t.after(h.cleanup);
    await fs.unlink(path.join(h.workspaceDir, DATA_DIR, REGISTRY_FIXTURE_FILE_NAME));
    const before = await fs.readdir(h.workspaceDir, { recursive: true });
    const scope = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug };

    assert.equal((await inspectProjectIssueArchive(scope)).active, 0);
    assert.deepEqual(await purgeProjectIssueArchive({ ...scope, apply: false, actor: "test" }), { dryRun: true, purge: [] });
    assert.deepEqual(await fs.readdir(h.workspaceDir, { recursive: true }), before);
  });

  it("resolves project retention windows and budget while retaining worker-owned records", async t => {
    const h = await createTestHarness({ workers: { developer: { active: true, issueId: 42, sessionKey: "owner" } } });
    t.after(h.cleanup);
    const directory = path.join(h.workspaceDir, DATA_DIR, PROJECTS_DIRECTORY_NAME, h.project.slug);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, WORKFLOW_FIXTURE_FILE_NAME), "issueArchiveMaintenance:\n  archiveRetention: 0d\n  deletedProviderRetention: 0d\n  maxPerHeartbeat: 1\n");
    const record = {
      projectSlug: h.project.slug, issueId: 42, provider: ISSUE_PROVIDER.GITHUB,
      finalWorkflowState: "done", finalWorkflowLabel: "Done", archiveReason: ISSUE_ARCHIVE_REASON.TERMINAL,
      archivedAt: "2020-01-01T00:00:00.000Z", lastIntegrityStatus: ISSUE_INTEGRITY_STATUS.OK,
      attachmentDisposition: ATTACHMENT_DISPOSITION.RETAINED, sourceSnapshotHash: "a".repeat(64),
    };
    await replaceIssueArchiveStoreForTesting(h.workspaceDir, h.project.slug, { projectSlug: h.project.slug,
      issues: { [`github:${h.project.slug}:42`]: record, [`github:${h.project.slug}:43`]: { ...record, issueId: 43 } } });
    const scope = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug };

    assert.equal((await inspectProjectIssueArchive(scope)).purgeEligible, 2);
    assert.deepEqual(await purgeProjectIssueArchive({ ...scope, apply: false, actor: "test" }), { dryRun: true, purge: [42] });
    assert.deepEqual(await purgeProjectIssueArchive({ ...scope, apply: true, actor: "test" }), { dryRun: false, purge: [] });
    assert.equal(Object.keys((await readIssueArchiveStore(h.workspaceDir, h.project.slug)).issues).length, 2);
  });

  it("rejects unknown projects and bad deletion confirmation before provider commands", async t => {
    const h = await createTestHarness();
    t.after(h.cleanup);
    const request = { workspaceDir: h.workspaceDir, projectSlug: "unknown", issueId: 42,
      dryRun: false, confirmIssueId: 43, actor: "test", runCommand: h.runCommand };

    await assert.rejects(deleteProjectIssue(request), /confirmIssueId/);
    await assert.rejects(deleteProjectIssue({ ...request, confirmIssueId: 42 }), /Project "unknown" not found/);
    assert.deepEqual(h.commands.commands, []);
  });

  it("rejects damaged local stores instead of reporting empty status", async t => {
    const h = await createTestHarness();
    t.after(h.cleanup);
    const directory = path.join(h.workspaceDir, DATA_DIR, PROJECTS_DIRECTORY_NAME, h.project.slug);
    await fs.mkdir(directory, { recursive: true });
    const file = path.join(directory, ISSUE_STORE_FIXTURE_NAMES[0]!);
    await fs.writeFile(file, "corrupt state");

    await assert.rejects(inspectProjectIssueArchive({ workspaceDir: h.workspaceDir, projectSlug: h.project.slug }));
    assert.equal(await fs.readFile(file, "utf8"), "corrupt state");
  });

  it("requires exact reset confirmation and preserves every adjacent store and registry", async t => {
    const h = await createTestHarness({ workers: { developer: { active: true, issueId: 42, sessionKey: "owner" } } });
    t.after(h.cleanup);
    const directory = path.join(h.workspaceDir, DATA_DIR, PROJECTS_DIRECTORY_NAME, h.project.slug);
    await fs.mkdir(directory, { recursive: true });
    const registry = path.join(h.workspaceDir, DATA_DIR, REGISTRY_FIXTURE_FILE_NAME);
    const registryBefore = await fs.readFile(registry);

    for (const name of [...ISSUE_STORE_FIXTURE_NAMES, ...PRESERVED_FIXTURE_NAMES, WORKFLOW_FIXTURE_FILE_NAME]) {
      await fs.writeFile(path.join(directory, name), "preserve or explicitly reset");
    }
    const scope = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug };
    await assert.rejects(resetProjectIssueStores({ ...scope, confirmProjectSlug: "different" }), /confirmProjectSlug/);
    for (const name of ISSUE_STORE_FIXTURE_NAMES) {
      assert.equal(await fs.readFile(path.join(directory, name), "utf8"), "preserve or explicitly reset");
    }
    assert.deepEqual(await resetProjectIssueStores({ ...scope, confirmProjectSlug: h.project.slug }), { projectSlug: h.project.slug, reset: true });
    assert.deepEqual((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues, {});
    assert.deepEqual((await readIssueArchiveStore(h.workspaceDir, h.project.slug)).issues, {});
    assert.deepEqual(await fs.readFile(registry), registryBefore);
    for (const name of [...PRESERVED_FIXTURE_NAMES, WORKFLOW_FIXTURE_FILE_NAME]) {
      assert.equal(await fs.readFile(path.join(directory, name), "utf8"), "preserve or explicitly reset");
    }
    await fs.writeFile(registry, "corrupt registry");
    await resetProjectIssueStores({ ...scope, confirmProjectSlug: h.project.slug });
    assert.equal(await fs.readFile(registry, "utf8"), "corrupt registry");
    await fs.unlink(registry);
    await resetProjectIssueStores({ ...scope, confirmProjectSlug: h.project.slug });
    await assert.rejects(fs.access(registry));
  });
});
