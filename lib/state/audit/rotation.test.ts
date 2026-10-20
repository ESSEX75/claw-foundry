/** Verifies byte-based rotation, bounded archives and resumable publication failures using real files. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";

import { configureAuditWarnings, log } from "../index.js";
import { DATA_DIR, LOG_DIRECTORY_NAME } from "../paths.js";
import { AUDIT_FILE_NAME, MAX_AUDIT_BYTES } from "./const.js";
import { archivePath, listAuditArchives, rotationPath } from "./files.js";

/** Construct a real multibyte event whose serialized record exactly fills the configured file limit.
 * @param sequence - Small identity distinguishing archived history in each test.
 */
function fullPayload(sequence: number): Record<string, unknown> {
  const data: Record<string, unknown> = { sequence, padding: "" };
  const overhead = Buffer.byteLength(JSON.stringify({ ...data, ts: "2026-10-20T00:00:00.000Z", event: "large" }) + "\n", "utf8");
  const bytes = MAX_AUDIT_BYTES - overhead;

  data.padding = "é".repeat(Math.floor(bytes / 2)) + "x".repeat(bytes % 2);
  return data;
}

/** Extract event identities without trusting parsed test output as a declared entry type.
 * @param file - Active or archived journal published by the real repository.
 */
async function events(file: string): Promise<unknown[]> {
  return (await fs.readFile(file, "utf8")).trim().split("\n").map(line => {
    const value: unknown = JSON.parse(line);

    assert.ok(typeof value === "object" && value !== null && "event" in value);
    return value.event;
  });
}

it("rotates only when the next complete UTF-8 record would exceed 10 MiB", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-rotation-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await log(workspace, "large", fullPayload(0));
  assert.equal((await fs.stat(file)).size, 10 * 1024 * 1024);
  assert.equal((await listAuditArchives(file)).length, 0);
  const original = await fs.readFile(file, "utf8");

  await log(workspace, "next", {});
  assert.equal(await fs.readFile(archivePath(file, 1), "utf8"), original);
  assert.deepEqual(await events(file), ["next"]);
  assert.ok((await fs.stat(file)).size <= MAX_AUDIT_BYTES);
  await assert.rejects(fs.access(rotationPath(file)), { code: "ENOENT" });
});

it("keeps five completed archives and retries failed expiration without losing the new history", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-rotation-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);
  const unlink = fs.unlink.bind(fs);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await log(workspace, "large", fullPayload(0));
  await fs.writeFile(path.join(path.dirname(file), "unrelated.log"), "preserve");
  for (let sequence = 1; sequence <= 5; sequence++) await log(workspace, "large", fullPayload(sequence));
  assert.equal((await listAuditArchives(file)).length, 5);
  const failure = t.mock.method(fs, "unlink", async (target: string) => {
    if (target === archivePath(file, 1)) throw new Error("retention denied");
    return unlink(target);
  });

  await assert.doesNotReject(log(workspace, "new", {}));
  assert.equal((await listAuditArchives(file)).length, 6);
  assert.deepEqual(await events(file), ["new"]);
  failure.mock.restore();
  await log(workspace, "retry", {});
  assert.deepEqual((await listAuditArchives(file)).map(archive => archive.sequence), [6, 5, 4, 3, 2]);
  assert.deepEqual(await events(file), ["new", "retry"]);
  assert.equal(await fs.readFile(path.join(path.dirname(file), "unrelated.log"), "utf8"), "preserve");
});

for (const phase of ["intent", "archive", "active"]) {
  it(`preserves history after ${phase} publication failure and resumes the exact rotation`, async t => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-rotation-"));
    const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);
    const rename = fs.rename.bind(fs);

    t.after(() => fs.rm(workspace, { recursive: true, force: true }));
    await log(workspace, "large", fullPayload(0));
    const original = await fs.readFile(file, "utf8");
    const rejectedTarget = phase === "intent" ? rotationPath(file) : phase === "archive" ? archivePath(file, 1) : file;
    const failure = t.mock.method(fs, "rename", async (source: string, target: string) => {
      if (target === rejectedTarget) throw new Error("publication failed");
      return rename(source, target);
    });

    await assert.doesNotReject(log(workspace, "pending", {}));
    assert.equal(await fs.readFile(file, "utf8"), original);
    failure.mock.restore();
    await log(workspace, "retry", {});
    assert.equal(await fs.readFile(archivePath(file, 1), "utf8"), original);
    assert.deepEqual(await events(file), phase === "intent" ? ["retry"] : ["pending", "retry"]);
    assert.equal((await listAuditArchives(file)).length, 1);
    await assert.rejects(fs.access(rotationPath(file)), { code: "ENOENT" });
  });
}

it("resumes failed plan cleanup without resetting an already published active journal", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-rotation-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);
  const unlink = fs.unlink.bind(fs);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await log(workspace, "large", fullPayload(0));
  const failure = t.mock.method(fs, "unlink", async (target: string) => {
    if (target === rotationPath(file)) throw new Error("cleanup denied");
    return unlink(target);
  });

  await log(workspace, "pending", {});
  assert.deepEqual(await events(file), ["pending"]);
  failure.mock.restore();
  await log(workspace, "retry", {});
  assert.deepEqual(await events(file), ["pending", "retry"]);
  assert.equal((await listAuditArchives(file)).length, 1);
});

for (const drift of ["active", "archive"]) {
  it(`does not overwrite history after ${drift} drift outside an interrupted rotation`, async t => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-rotation-"));
    const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);
    const rename = fs.rename.bind(fs);

    t.after(() => fs.rm(workspace, { recursive: true, force: true }));
    await log(workspace, "large", fullPayload(0));
    const original = await fs.readFile(file, "utf8");
    const failure = t.mock.method(fs, "rename", async (source: string, target: string) => {
      if (target === file) throw new Error("publication failed");
      return rename(source, target);
    });

    await log(workspace, "pending", {});
    failure.mock.restore();
    const changed = drift === "active" ? file : archivePath(file, 1);

    await fs.writeFile(changed, "unexpected external content\n");
    await assert.doesNotReject(log(workspace, "retry", {}));
    assert.equal(await fs.readFile(file, "utf8"), drift === "active" ? "unexpected external content\n" : original);
    assert.equal(await fs.readFile(archivePath(file, 1), "utf8"), drift === "archive" ? "unexpected external content\n" : original);
    await fs.access(rotationPath(file));
  });
}

it("rejects oversized individual records without changing existing history", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-rotation-"));
  const messages: string[] = [];
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

  t.after(() => { configureAuditWarnings(); });
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  configureAuditWarnings(message => { messages.push(message); });
  await log(workspace, "small", {});
  const original = await fs.readFile(file, "utf8");

  await assert.doesNotReject(log(workspace, "oversized", { padding: "x".repeat(MAX_AUDIT_BYTES) }));
  assert.equal(await fs.readFile(file, "utf8"), original);
  assert.equal((await listAuditArchives(file)).length, 0);
  assert.match(messages[0] ?? "", /10 MiB/);
});

it("preserves undecodable UTF-8 and invalid rotation evidence instead of resetting history", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-rotation-"));
  const file = path.join(workspace, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await log(workspace, "first", {});
  const invalid = Buffer.from([0xff, 0xfe, 0x00]);

  await fs.writeFile(file, invalid);
  await assert.doesNotReject(log(workspace, "dropped", {}));
  assert.deepEqual(await fs.readFile(file), invalid);
  await fs.writeFile(file, "original text\n");
  const malformed = JSON.stringify({ sequence: "../escape", sourceDigest: "invalid", record: "{}" });

  await fs.writeFile(rotationPath(file), malformed);
  await assert.doesNotReject(log(workspace, "dropped", {}));
  assert.equal(await fs.readFile(file, "utf8"), "original text\n");
  assert.equal(await fs.readFile(rotationPath(file), "utf8"), malformed);
  assert.equal((await listAuditArchives(file)).length, 0);
});
