/** Verifies serialization, independence, cleanup, and stale recovery for issue orchestration locks. */
import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  issueOrchestrationLockPath,
  withIssueOrchestrationLock,
} from "./orchestration/lock.js";

describe("issue orchestration lock", () => {
  it("serializes operations for the same issue", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-issue-lock-"));
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    try {
      const first = withIssueOrchestrationLock(workspaceDir, "app", 79, async () => {
        events.push("first:start");
        await firstMayFinish;
        events.push("first:end");
      });
      await waitUntil(() => events.includes("first:start"));

      const second = withIssueOrchestrationLock(workspaceDir, "app", 79, () => {
        events.push("second:start");
      });
      await new Promise((resolve) => setTimeout(resolve, 30));

      assert.deepEqual(events, ["first:start"]);
      releaseFirst?.();
      await Promise.all([first, second]);
      assert.deepEqual(events, ["first:start", "first:end", "second:start"]);
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("does not block a different issue", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-issue-lock-parallel-"));
    let secondEntered = false;
    let releaseFirst: (() => void) | undefined;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    try {
      const first = withIssueOrchestrationLock(workspaceDir, "app", 79, () => firstMayFinish);
      await waitUntil(() => fs.access(issueOrchestrationLockPath(workspaceDir, "app", 79)).then(() => true, () => false));

      await withIssueOrchestrationLock(workspaceDir, "app", 80, () => {
        secondEntered = true;
      });

      assert.equal(secondEntered, true);
      releaseFirst?.();
      await first;
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("releases the lock after an operation fails", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-issue-lock-error-"));

    try {
      await assert.rejects(
        withIssueOrchestrationLock(workspaceDir, "app", 79, () => {
          throw new Error("boom");
        }),
        /boom/,
      );

      const result = await withIssueOrchestrationLock(workspaceDir, "app", 79, () => "recovered");

      assert.equal(result, "recovered");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("refuses an unidentified stale lock until explicit repair", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-issue-lock-stale-"));
    const lockPath = issueOrchestrationLockPath(workspaceDir, "app", 79);

    try {
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      await fs.writeFile(lockPath, JSON.stringify({ token: "dead", acquiredAt: 1 }), "utf-8");

      await assert.rejects(withIssueOrchestrationLock(
        workspaceDir, "app", 79, () => assert.fail("unidentified owner"),
        { staleMs: 1, retryMs: 1, timeoutMs: 100 },
      ), /Cannot inspect state lock/);
      assert.equal(await fs.readFile(lockPath, "utf8"), JSON.stringify({ token: "dead", acquiredAt: 1 }));
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});

/**
 * Poll a test predicate until it succeeds or reaches a short deterministic deadline.
 *
 * @param predicate - Condition indicating that the asynchronous test setup is ready.
 */
async function waitUntil(predicate: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 1_000;

  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error("Timed out waiting for test condition.");
}
