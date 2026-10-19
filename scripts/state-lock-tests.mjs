/** Verifies process contention, event-loop pauses and abandoned-owner recovery using isolated Node actors. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "node:test";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";


/** Actor source imports the real implementation and shares only files with the parent process. */
const ACTOR_SOURCE = `
import fs from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";
import { withFileLock } from ${JSON.stringify(new URL("../lib/state/persistence/file-lock.ts", import.meta.url).href)};
const [lock, counter, mode] = process.argv.slice(2);
it("isolated lock actor", async () => {
  if (mode === "increment") {
    await fs.writeFile(counter + "." + process.pid + ".ready", "ready");
    const deadline = Date.now() + 10000;
    while ((await fs.readdir(path.dirname(counter))).filter(name => name.endsWith(".ready")).length < 2) {
      if (Date.now() > deadline) throw new Error("Contending actor did not become ready");
      await new Promise(resolve => setTimeout(resolve, 2));
    }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    await withFileLock(lock, { retryMs: 2, staleMs: 1, timeoutMs: 10000 }, async () => {
      if (mode === "exit") process.exit(0);
      const value = Number(await fs.readFile(counter, "utf8"));
      const pauseUntil = Date.now() + 15;
      while (Date.now() < pauseUntil) { /* Simulate an event-loop pause beyond staleMs. */ }
      await new Promise(resolve => setTimeout(resolve, 5));
      await fs.writeFile(counter, String(value + 1));
    });
  }
});
`;

/** Check real process isolation and recover only after an actor has exited. */
export async function verifyStateProcessLocks() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-process-lock-"));
  const actor = path.join(directory, "actor.mjs");
  const lock = path.join(directory, "state.lock");
  const counter = path.join(directory, "counter.txt");

  try {
    await fs.writeFile(actor, ACTOR_SOURCE);
    await fs.writeFile(counter, "0");
    const outcomes = await Promise.all([runActor(actor, lock, counter, "increment"), runActor(actor, lock, counter, "increment")]);

    for (const events of outcomes) {
      assert.equal(events.some(event => event.type === "test:fail"), false, inspect(events, { depth: 8 }));
      assert.ok(events.some(event => event.type === "test:pass"));
    }

    assert.equal(await fs.readFile(counter, "utf8"), "8");
    await runActor(actor, lock, counter, "exit");
    assert.equal((await fs.readdir(lock)).length, 1);
    const recovery = await runActor(actor, lock, counter, "recover");

    assert.equal(recovery.some(event => event.type === "test:fail"), false);
    assert.ok(recovery.some(event => event.type === "test:pass"));
    await assert.rejects(fs.access(lock), { code: "ENOENT" });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

/** Run an actor as an isolated test process without shell construction or subprocess imports.
 * @param actor - Temporary JavaScript file importing the real TypeScript lock.
 * @param lock - Lock path shared by all actors.
 * @param counter - Counter protected by the lock across process boundaries.
 * @param mode - Normal increments or deliberate process exit before lock release.
 */
async function runActor(actor, lock, counter, mode) {
  const events = run({ files: [actor], execArgv: ["--import", "tsx"], argv: [lock, counter, mode] });

  return Array.fromAsync(events);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyStateProcessLocks();
  console.log("State process-lock checks passed.");
}
