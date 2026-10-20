/**
 * Verifies token ownership, serialization, stale recovery, and failure cleanup for state locks.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { withFileLock } from "./file-lock.js";
import type { FileLockRecord } from "./types.js";

/** Lock policy used by ordinary persistence primitive tests. */
const LOCK_OPTIONS = { retryMs: 5, staleMs: 1_000, timeoutMs: 500 };

/** Temporary directories removed after each persistence primitive test. */
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { force: true, recursive: true })));
});

/** Create an isolated lock path and register its directory for cleanup. */
async function createLockPath(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-file-lock-"));

  temporaryDirectories.push(directory);

  return path.join(directory, "state.lock");
}

describe("withFileLock", () => {
  it("serializes operations contending for one path", async () => {
    const lockPath = await createLockPath();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withFileLock(lockPath, LOCK_OPTIONS, async () => {
      events.push("first:start");
      await firstMayFinish;
      events.push("first:end");
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = withFileLock(lockPath, LOCK_OPTIONS, () => {
      events.push("second");
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(events, ["first:start"]);
    releaseFirst?.();
    await Promise.all([first, second]);
    assert.deepEqual(events, ["first:start", "first:end", "second"]);
  });

  it("releases its lock after the operation fails", async () => {
    const lockPath = await createLockPath();

    await assert.rejects(withFileLock(lockPath, LOCK_OPTIONS, () => {
      throw new Error("failed operation");
    }), /failed operation/);
    assert.equal(await withFileLock(lockPath, LOCK_OPTIONS, () => "recovered"), "recovered");
  });

  it("retries publication when a contending owner disappears before inspection", async t => {
    const lockPath = await createLockPath();
    const rename = fs.rename.bind(fs);
    let contended = false;

    t.mock.method(fs, "rename", async (source: string, target: string) => {
      if (target === lockPath && !contended) {
        contended = true;
        throw Object.assign(new Error("owner released after rename contention"), { code: "EPERM" });
      }

      return rename(source, target);
    });
    assert.equal(await withFileLock(lockPath, LOCK_OPTIONS, () => "acquired"), "acquired");
    assert.deepEqual(await fs.readdir(path.dirname(lockPath)), []);
  });

  for (const code of ["EPERM", "EACCES"]) {
    it(`waits without entering or removing ownership when marker reads return ${code}`, async t => {
      const lockPath = await createLockPath();
      const readFile = fs.readFile.bind(fs);
      let attempts = 0;
      let entered = false;

      await withFileLock(lockPath, LOCK_OPTIONS, async () => {
        const originalEntries = await fs.readdir(lockPath);
        const deniedRead = t.mock.method(fs, "readFile", async (...args: Parameters<typeof fs.readFile>) => {
          if (args[0] === path.join(lockPath, originalEntries[0]!)) {
            attempts++;
            throw Object.assign(new Error("marker access denied"), { code });
          }
          return readFile(...args);
        });

        try {
          await assert.rejects(withFileLock(lockPath, { retryMs: 5, staleMs: 0, timeoutMs: 40 }, () => { entered = true; }), /Timed out/);
          assert.ok(attempts > 1);
          assert.equal(entered, false);
          assert.deepEqual(await fs.readdir(lockPath), originalEntries);
        } finally {
          deniedRead.mock.restore();
        }
      });
      assert.equal(await withFileLock(lockPath, LOCK_OPTIONS, () => "recovered"), "recovered");
    });
  }

  it("backs off and retries denied removal of an empty ownership directory", async t => {
    const lockPath = await createLockPath();
    const rmdir = fs.rmdir.bind(fs);
    let denied = false;

    await fs.mkdir(lockPath);
    t.mock.method(fs, "rmdir", async (target: string) => {
      if (target === lockPath && !denied) {
        denied = true;
        throw Object.assign(new Error("directory handle still open"), { code: "EPERM" });
      }
      return rmdir(target);
    });
    assert.equal(await withFileLock(lockPath, LOCK_OPTIONS, () => "acquired"), "acquired");
    assert.equal(denied, true);
    assert.deepEqual(await fs.readdir(path.dirname(lockPath)), []);
  });

  it("does not enter the operation when an empty lock directory remains inaccessible", async t => {
    const lockPath = await createLockPath();
    const rmdir = fs.rmdir.bind(fs);
    let entered = false;

    await fs.mkdir(lockPath);
    t.mock.method(fs, "rmdir", async (target: string) => {
      if (target === lockPath) throw Object.assign(new Error("access denied"), { code: "EACCES" });
      return rmdir(target);
    });
    await assert.rejects(withFileLock(lockPath, { retryMs: 5, staleMs: 0, timeoutMs: 30 }, () => { entered = true; }), /Timed out/);
    assert.equal(entered, false);
    assert.deepEqual(await fs.readdir(lockPath), []);
  });

  it("defers empty-directory cleanup after releasing its token and allows a later acquisition", async t => {
    const lockPath = await createLockPath();
    const rmdir = fs.rmdir.bind(fs);
    const failure = t.mock.method(fs, "rmdir", async (target: string) => {
      if (target === lockPath) throw Object.assign(new Error("directory handle still open"), { code: "EPERM" });
      return rmdir(target);
    });

    assert.equal(await withFileLock(lockPath, LOCK_OPTIONS, () => "committed"), "committed");
    assert.deepEqual(await fs.readdir(lockPath), []);
    failure.mock.restore();
    assert.equal(await withFileLock(lockPath, LOCK_OPTIONS, () => "next"), "next");
    assert.deepEqual(await fs.readdir(path.dirname(lockPath)), []);
  });

  it("recovers only a confirmed dead local owner", async t => {
    const lockPath = await createLockPath();

    await installOwner(lockPath, { processId: DEAD_PROCESS_ID });
    const kill = process.kill.bind(process);

    t.mock.method(process, "kill", (pid: number, signal: NodeJS.Signals | number = 0) => {
      if (pid === DEAD_PROCESS_ID) throw Object.assign(new Error("exited"), { code: "ESRCH" });
      return kill(pid, signal);
    });
    assert.equal(await withFileLock(lockPath, LOCK_OPTIONS, () => "recovered"), "recovered");
  });

  it("never expires a live process while an operation exceeds staleMs", async () => {
    const lockPath = await createLockPath();
    const options = { retryMs: 5, staleMs: 30, timeoutMs: 500 };
    const events: string[] = [];
    const first = withFileLock(lockPath, options, async () => {
      events.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 90));
      events.push("first:end");
    });

    await new Promise((resolve) => setTimeout(resolve, 45));
    const second = withFileLock(lockPath, options, () => {
      events.push("second");
    });

    await Promise.all([first, second]);
    assert.deepEqual(events, ["first:start", "first:end", "second"]);
  });

  it("leaves a replacement ownership marker intact on release", async () => {
    const lockPath = await createLockPath();
    let replacementToken = "";

    await withFileLock(lockPath, LOCK_OPTIONS, async () => {
      const [marker] = await fs.readdir(lockPath);
      assert.ok(marker);
      await fs.unlink(path.join(lockPath, marker));
      replacementToken = (await installOwner(lockPath)).token;
    });
    assert.deepEqual(await fs.readdir(lockPath), [replacementToken + ".json"]);
  });

  it("preserves a new owner when a delayed stale reaper resumes", async t => {
    const lockPath = await createLockPath();
    const abandoned = await installOwner(lockPath, { processId: DEAD_PROCESS_ID });
    const kill = process.kill.bind(process);
    const unlink = fs.unlink.bind(fs);
    let resumeReaper: (() => void) | undefined;
    let reportReaper: (() => void) | undefined;
    let releaseOwner: (() => void) | undefined;
    let reportOwner: (() => void) | undefined;
    const reaperPaused = new Promise<void>(resolve => { reportReaper = resolve; });
    const reaperMayResume = new Promise<void>(resolve => { resumeReaper = resolve; });
    const ownerEntered = new Promise<void>(resolve => { reportOwner = resolve; });
    const ownerMayFinish = new Promise<void>(resolve => { releaseOwner = resolve; });
    let paused = false;

    t.mock.method(process, "kill", (pid: number, signal: NodeJS.Signals | number = 0) => {
      if (pid === DEAD_PROCESS_ID) throw Object.assign(new Error("exited"), { code: "ESRCH" });
      return kill(pid, signal);
    });
    t.mock.method(fs, "unlink", async (candidate: string) => {
      if (candidate === path.join(lockPath, abandoned.token + ".json") && !paused) {
        paused = true;
        reportReaper?.();
        await reaperMayResume;
      }
      return unlink(candidate);
    });
    const first = withFileLock(lockPath, LOCK_OPTIONS, () => "first");
    await reaperPaused;
    const second = withFileLock(lockPath, LOCK_OPTIONS, async () => {
      reportOwner?.();
      await ownerMayFinish;
      return "second";
    });
    await ownerEntered;
    const current = await fs.readdir(lockPath);
    resumeReaper?.();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(await fs.readdir(lockPath), current);
    releaseOwner?.();
    assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
  });

  it("never reclaims unknown hosts, access-denied owners or malformed lock files", async t => {
    const lockPath = await createLockPath();
    const options = { retryMs: 1, staleMs: 0, timeoutMs: 20 };

    await installOwner(lockPath, { hostname: "another-host" });
    await assert.rejects(withFileLock(lockPath, options, () => assert.fail("foreign owner")), /Timed out/);
    await fs.rm(lockPath, { recursive: true });
    await installOwner(lockPath, { processId: DEAD_PROCESS_ID });
    t.mock.method(process, "kill", () => { throw Object.assign(new Error("denied"), { code: "EPERM" }); });
    await assert.rejects(withFileLock(lockPath, options, () => assert.fail("unknown owner")), /Timed out/);
    await fs.rm(lockPath, { recursive: true });
    await fs.writeFile(lockPath, "unidentified owner");
    await assert.rejects(withFileLock(lockPath, options, () => assert.fail("invalid owner")), /Cannot inspect state lock/);
    assert.equal(await fs.readFile(lockPath, "utf8"), "unidentified owner");
  });
});

/** Reserved fixture PID whose liveness is controlled explicitly by each recovery test. */
const DEAD_PROCESS_ID = 2_000_000_000;

/** Install a complete immutable ownership marker for interrupted-operation tests.
 * @param lockPath - Isolated lock directory.
 * @param overrides - Ownership details whose liveness the test controls.
 */
async function installOwner(lockPath: string, overrides: Partial<FileLockRecord> = {}): Promise<FileLockRecord> {
  const owner: FileLockRecord = {
    token: randomUUID(), processId: process.pid, hostname: os.hostname(), createdAt: Date.now() - 2_000, ...overrides,
  };

  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, owner.token + ".json"), JSON.stringify(owner));
  return owner;
}
