/** Proves bounded creation recovery progresses past blocked records and rotates durable retries. */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { it } from "node:test";
import { DEFAULT_WORKFLOW } from "../../../domain/index.js";
import { ISSUE_CREATION_ERROR, ISSUE_CREATION_STATUS, readIssueCreationStore, updateIssueCreationStore, withIssueCreationLock } from "../../../state/index.js";
import { createTestHarness, type TestHarness } from "../../../testing/index.js";
import { createManagedTaskIssue } from "./command.js";
import { reconcileManagedTaskCreations } from "./reconcile.js";

/** Original immutable request reused by recovery fixtures and the reconciliation pass.
 * @param h - Isolated project and deterministic provider.
 */
function context(h: TestHarness) {
  return { workspaceDir: h.workspaceDir, project: h.project, providerType: h.project.provider,
    provider: h.provider, workflow: DEFAULT_WORKFLOW, roles: ["developer", "architect", "tester", "reviewer"] };
}

/** Construct known provider identities before placing operations at explicit recovery checkpoints.
 * @param h - Isolated managed fixture.
 * @param keys - Stable idempotency identities in initial priority order.
 */
async function seedOperations(h: TestHarness, keys: string[]) {
  for (const key of keys) await createManagedTaskIssue({ ...context(h), idempotencyKey: key,
    title: key, description: "recover known issue", requestedBy: "test" });
  await updateIssueCreationStore(h.workspaceDir, h.project.slug, store => {
    for (const operation of Object.values(store.operations)) operation.status = ISSUE_CREATION_STATUS.PROVIDER_CREATED;

    return { store, result: undefined };
  });
}

it("manual, permanent failures and backoff do not consume the runnable recovery budget", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await seedOperations(h, ["a-manual", "b-permanent", "c-backoff", "d-runnable"]);
  await updateIssueCreationStore(h.workspaceDir, h.project.slug, store => {
    store.operations["a-manual"].status = ISSUE_CREATION_STATUS.MANUAL_REPAIR_REQUIRED;
    store.operations["b-permanent"].status = ISSUE_CREATION_STATUS.CREATION_FAILED;
    store.operations["b-permanent"].lastError = { code: ISSUE_CREATION_ERROR.PROVIDER_CREATE_FAILED, message: "permanent", retryable: false };
    store.operations["c-backoff"].retryAfter = "2999-01-01T00:00:00.000Z";

    return { store, result: undefined };
  });
  const before = await readIssueCreationStore(h.workspaceDir, h.project.slug);
  const result = await reconcileManagedTaskCreations({ ...context(h), maxItems: 1 });

  assert.deepEqual(result.ready, [before.operations["d-runnable"].providerIssue?.issueId]);
  assert.deepEqual(new Set(result.manual), new Set([before.operations["a-manual"].operationId, before.operations["b-permanent"].operationId]));
  assert.deepEqual(result.waiting, [before.operations["c-backoff"].operationId]);
  assert.equal(h.provider.callsTo("createIssue").length, 4);
  assert.deepEqual((await readIssueCreationStore(h.workspaceDir, h.project.slug)).operations["c-backoff"], before.operations["c-backoff"]);
});

it("a repeated recoverable failure cannot starve a later runnable operation across passes", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await seedOperations(h, ["a", "b"]);
  const before = await readIssueCreationStore(h.workspaceDir, h.project.slug);
  const read = h.provider.getIssue.bind(h.provider);

  t.mock.method(h.provider, "getIssue", async (id: number) => {
    if (id === before.operations.a.providerIssue?.issueId) throw new Error("first issue unavailable");

    return read(id);
  });
  const first = await reconcileManagedTaskCreations({ ...context(h), maxItems: 1 });
  const second = await reconcileManagedTaskCreations({ ...context(h), maxItems: 1 });

  assert.deepEqual(first.pending, [before.operations.a.operationId]);
  assert.deepEqual(second.ready, [before.operations.b.providerIssue?.issueId]);
  const after = await readIssueCreationStore(h.workspaceDir, h.project.slug);

  assert.equal(after.operations.a.reconciliationAttempts, 1);
  assert.equal(after.operations.b.reconciliationAttempts, 1);
  assert.equal(h.provider.callsTo("createIssue").length, 2);
  assert.equal(after.operations.a.payloadHash, before.operations.a.payloadHash);
});

it("rechecks readiness after lock wait and spends the unchanged budget on the next operation", async t => {
  const h = await createTestHarness();

  await seedOperations(h, ["a", "b"]);
  const before = await readIssueCreationStore(h.workspaceDir, h.project.slug);
  let release = () => {};
  let entered = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  const acquired = new Promise<void>(resolve => { entered = resolve; });
  const blocker = withIssueCreationLock(h.workspaceDir, h.project.slug, "a", async () => { entered(); await held; });

  t.after(async () => { release(); await blocker; await h.cleanup(); });
  await acquired;
  let attempted = () => {};
  const lockAttempt = new Promise<void>(resolve => { attempted = resolve; });
  const write = fs.writeFile;
  const lockName = `${createHash("sha256").update("a").digest("hex")}.lock`;

  t.mock.method(fs, "writeFile", async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).endsWith(lockName)) attempted();

    return write(...args);
  });
  const pass = reconcileManagedTaskCreations({ ...context(h), maxItems: 1 });

  await lockAttempt;
  await updateIssueCreationStore(h.workspaceDir, h.project.slug, store => {
    store.operations.a.status = ISSUE_CREATION_STATUS.READY;

    return { store, result: undefined };
  });
  release();
  await blocker;
  assert.deepEqual((await pass).ready, [before.operations.b.providerIssue?.issueId]);
  assert.equal((await readIssueCreationStore(h.workspaceDir, h.project.slug)).operations.a.reconciliationAttempts, undefined);
});
