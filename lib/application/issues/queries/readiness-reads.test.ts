/** Measures creation-store reads in collection queries while mutations retain their own fresh checks. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { it } from "node:test";
import { DEFAULT_WORKFLOW } from "../../../domain/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { getAutomaticTransitionCandidates } from "../../execution/workflow/automatic-transitions/queries.js";
import { createManagedTaskIssue } from "../commands/creation/index.js";
import { getManagedTaskStatus } from "./get-task-status.js";
import { listManagedTasks } from "./list-tasks.js";

/** Creation store filename whose physical reads are counted independently of issue reads. */
const CREATION_STORE_FIXTURE = "issue-creations.json";

it("status, listing and heartbeat each read one readiness snapshot for multiple managed issues", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  for (const key of ["a", "b", "c"]) await createManagedTaskIssue({
    workspaceDir: h.workspaceDir, project: h.project, providerType: h.project.provider, provider: h.provider,
    workflow: DEFAULT_WORKFLOW, roles: ["developer"], title: key, description: "ready", idempotencyKey: key, requestedBy: "test",
  });
  let reads = 0;
  const read = fs.readFile;

  t.mock.method(fs, "readFile", async (...args: Parameters<typeof fs.readFile>) => {
    if (String(args[0]).endsWith(CREATION_STORE_FIXTURE)) reads++;

    return read(...args);
  });
  const input = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug,
    provider: h.provider, workflow: DEFAULT_WORKFLOW, roles: ["developer"] };

  await getManagedTaskStatus(input);
  assert.equal(reads, 1);
  reads = 0;
  await listManagedTasks(input);
  assert.equal(reads, 1);
  reads = 0;
  assert.equal((await getAutomaticTransitionCandidates({ ...input, workflowLabel: "Planning" })).length, 3);
  assert.equal(reads, 1);
});

it("search reads each provider issue once per invocation and observes later title changes", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  const created = await createManagedTaskIssue({ workspaceDir: h.workspaceDir, project: h.project,
    providerType: h.project.provider, provider: h.provider, workflow: DEFAULT_WORKFLOW,
    roles: ["developer"], title: "Search needle", description: "body", idempotencyKey: "search", requestedBy: "test" });

  assert.ok(created.issue);
  const input = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug, workflow: DEFAULT_WORKFLOW,
    provider: h.provider, roles: ["developer"], search: "needle" };
  const before = h.provider.callsTo("getIssue").length;
  const result = await listManagedTasks(input);

  assert.equal(result.totalIssues, 1);
  assert.equal(h.provider.callsTo("getIssue").length - before, 1);
  await h.provider.editIssue(created.issue.iid, { title: "Changed" });
  assert.equal((await listManagedTasks(input)).totalIssues, 0);
});
