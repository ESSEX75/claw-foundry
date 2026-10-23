/** Exercises journal retention, concurrent updates and failure isolation through the public state API. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";

import { log } from "../index.js";
import { DATA_DIR, LOG_DIRECTORY_NAME } from "../paths.js";
import { LOCK_FILE_SUFFIX } from "../persistence/index.js";
import { AUDIT_FILE_NAME } from "./const.js";
import type { AuditEntry } from "./types.js";

/** Validate records read from disk rather than asserting an untrusted JSON shape.
 * @param value - Parsed NDJSON entry whose envelope must be present.
 */
function isAuditEntry(value: unknown): value is AuditEntry {
  return typeof value === "object" && value !== null && "ts" in value && typeof value.ts === "string"
    && "event" in value && typeof value.event === "string";
}

/** Read and validate every nonempty persisted journal record.
 * @param file - Diagnostic journal produced by the real repository.
 */
async function entries(file: string): Promise<AuditEntry[]> {
  return (await fs.readFile(file, "utf8")).trim().split("\n").map(line => {
    const value: unknown = JSON.parse(line);

    assert.ok(isAuditEntry(value));
    return value;
  });
}

/** Prepare existing valid records without depending on the writer under test.
 * @param file - Journal to seed before a retention or failure scenario.
 * @param count - Existing ordered records, including deliberately oversized journals.
 */
async function seed(file: string, count: number): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Array.from({ length: count }, (_, sequence) => JSON.stringify({
    ts: "2026-10-20T00:00:00.000Z", event: "seed", sequence,
  })).join("\n") + "\n");
}

it("creates the existing journal location and reserves timestamp and event identity", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await log(workspace, "created", { project: "example", ts: "payload", event: "payload" });
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);
  const [entry] = await entries(file);

  assert.ok(entry);
  assert.equal(entry.event, "created");
  assert.equal(entry.project, "example");
  assert.ok(Number.isFinite(Date.parse(entry.ts)));
  assert.deepEqual(await fs.readdir(path.dirname(file)), [AUDIT_FILE_NAME]);
});

it("preserves existing records beyond the former 50-line limit", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await seed(file, 55);
  await log(workspace, "new", {});
  const records = await entries(file);

  assert.equal(records.length, 56);
  assert.deepEqual(records.slice(0, -1).map(entry => entry.sequence), Array.from({ length: 55 }, (_, index) => index));
  assert.equal(records.at(-1)?.event, "new");
});

it("preserves every concurrent record below the byte rotation limit", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await seed(file, 45);
  await Promise.all(Array.from({ length: 20 }, (_, sequence) => log(workspace, "parallel", { sequence })));
  const records = await entries(file);

  assert.equal(records.length, 65);
  assert.deepEqual(new Set(records.filter(entry => entry.event === "parallel").map(entry => entry.sequence)), new Set(Array.from({ length: 20 }, (_, i) => i)));
  assert.deepEqual(records.filter(entry => entry.event === "seed").map(entry => entry.sequence), Array.from({ length: 45 }, (_, i) => i));
  assert.deepEqual(await fs.readdir(path.dirname(file)), [AUDIT_FILE_NAME]);
});

it("suppresses unsupported payload serialization without creating files", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));
  const circular: Record<string, unknown> = {};

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  circular.self = circular;
  await assert.doesNotReject(log(workspace, "bad", circular));
  await assert.doesNotReject(log(workspace, "bad", { value: 1n }));
  await assert.doesNotReject(log(workspace, "bad", { toJSON: () => undefined }));
  await assert.doesNotReject(log(workspace, "bad", { toJSON: () => ({ event: "spoofed" }) }));
  assert.deepEqual(await fs.readdir(workspace), []);
});

it("suppresses directory creation failure and allows a later successful retry", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const failure = t.mock.method(fs, "mkdir", async () => { throw new Error("storage unavailable"); });

  await assert.doesNotReject(log(workspace, "dropped", {}));
  failure.mock.restore();
  await log(workspace, "retry", {});
  assert.deepEqual((await entries(path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME))).map(entry => entry.event), ["retry"]);
});

it("does not replace a journal that cannot be read", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await seed(file, 2);
  const original = await fs.readFile(file, "utf8");
  const failure = t.mock.method(fs, "readFile", async () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); });

  await assert.doesNotReject(log(workspace, "dropped", {}));
  failure.mock.restore();
  assert.equal(await fs.readFile(file, "utf8"), original);
  assert.deepEqual(await fs.readdir(path.dirname(file)), [AUDIT_FILE_NAME]);
});

it("preserves the prior journal on publication failure, cleans up and permits retry", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);
  const rename = fs.rename.bind(fs);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await seed(file, 2);
  const original = await fs.readFile(file, "utf8");
  const failure = t.mock.method(fs, "rename", async (source: string, target: string) => {
    if (target === file) throw new Error("publication failed");
    return rename(source, target);
  });

  await assert.doesNotReject(log(workspace, "dropped", {}));
  assert.equal(await fs.readFile(file, "utf8"), original);
  assert.deepEqual(await fs.readdir(path.dirname(file)), [AUDIT_FILE_NAME]);
  failure.mock.restore();
  await log(workspace, "retry", {});
  assert.deepEqual((await entries(file)).map(entry => entry.event), ["seed", "seed", "retry"]);
});

it("suppresses lock acquisition failure without deleting unknown ownership evidence", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-audit-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);
  const lock = `${file}${LOCK_FILE_SUFFIX}`;

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await seed(file, 2);
  await fs.writeFile(lock, "operator repair required");
  const original = await fs.readFile(file, "utf8");

  await assert.doesNotReject(log(workspace, "dropped", {}));
  assert.equal(await fs.readFile(file, "utf8"), original);
  assert.equal(await fs.readFile(lock, "utf8"), "operator repair required");
});
