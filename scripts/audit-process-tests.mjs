/** Verifies audit rotation with independent processes before the main Node test runner starts. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "node:test";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

/** Actors import the public state API and start after both processes have reached the barrier. */
const ACTOR_SOURCE = `
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";
import { log } from ${JSON.stringify(new URL("../lib/state/index.ts", import.meta.url).href)};
const [workspace, actor] = process.argv.slice(2);
it("isolated audit writer", async () => {
  await fs.writeFile(path.join(workspace, actor + ".ready"), "ready");
  const deadline = Date.now() + 15000;
  while ((await fs.readdir(workspace)).filter(name => name.endsWith(".ready")).length !== 2) {
    assert.ok(Date.now() < deadline, "other audit actor did not become ready");
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  for (let sequence = 0; sequence < 5; sequence++) await log(workspace, "process", { actor, sequence });
});
`;

/** Prove that both writers' records survive one byte-limit rotation of a shared journal. */
export async function verifyAuditProcessWriters() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-audit-process-"));
  const actorFile = path.join(workspace, "actor.mjs");
  const file = path.join(workspace, "devclaw", "log", "audit.log");

  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const seed = { ts: "2026-10-20T00:00:00.000Z", event: "seed", padding: "" };
    const overhead = Buffer.byteLength(JSON.stringify(seed) + "\n", "utf8");

    seed.padding = "x".repeat(10 * 1024 * 1024 - overhead);
    const original = JSON.stringify(seed) + "\n";

    await fs.writeFile(file, original);
    await fs.writeFile(actorFile, ACTOR_SOURCE);
    const outcomes = await Promise.allSettled([runActor(actorFile, workspace, "first"), runActor(actorFile, workspace, "second")]);

    for (const outcome of outcomes) if (outcome.status === "rejected") throw outcome.reason;
    const records = (await fs.readFile(file, "utf8")).trim().split("\n");
    const identities = new Set();

    assert.equal(records.length, 10);
    for (const line of records) {
      const value = JSON.parse(line);

      assert.ok(typeof value === "object" && value !== null && "event" in value);
      if (value.event !== "process") continue;
      assert.equal(typeof value.actor, "string");
      assert.equal(typeof value.sequence, "number");
      identities.add(`${value.actor}:${value.sequence}`);
    }

    assert.deepEqual(identities, new Set(["first", "second"].flatMap(actor => Array.from({ length: 5 }, (_, sequence) => `${actor}:${sequence}`))));
    assert.equal(await fs.readFile(path.join(path.dirname(file), "audit.0000000000000001.log"), "utf8"), original);
    assert.deepEqual((await fs.readdir(path.dirname(file))).sort(), ["audit.0000000000000001.log", "audit.log"]);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

/** Run one genuine writer process and propagate its test failures to the verification gate.
 * @param file - Temporary ESM test importing the supported state entrypoint.
 * @param workspace - Workspace whose journal is shared across actors.
 * @param actor - Identity included in every record written by this process.
 */
async function runActor(file, workspace, actor) {
  const events = await Array.fromAsync(run({ files: [file], execArgv: ["--import", "tsx"], argv: [workspace, actor] }));

  assert.equal(events.some(event => event.type === "test:fail"), false, inspect(events, { depth: 8 }));
  assert.ok(events.some(event => event.type === "test:pass"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyAuditProcessWriters();
  console.log("Audit process checks passed (concurrent rotation).");
}
