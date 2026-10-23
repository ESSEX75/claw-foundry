/** Exercises the offline migration command against real files without invoking a shell. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { it } from "node:test";

it("previews without writes, moves bytes intact, and refuses conflicting state", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-migration-"));
  const workspace = path.join(root, "workspace");
  const originalArgs = process.argv;
  const bytes = Buffer.from([0, 1, 2, 10, 13, 255]);
  const evidencePath = path.join("projects", "existing", "evidence");
  try {
    await fs.mkdir(path.join(workspace, "devclaw", "projects", "existing"), { recursive: true });
    await fs.writeFile(path.join(workspace, "devclaw", evidencePath), bytes);
    process.argv = ["node", "migration", workspace];
    await import("./migrate-devclaw-state.mjs?preview");
    await assert.rejects(fs.stat(path.join(workspace, "claw-foundry")), { code: "ENOENT" });
    assert.deepEqual(await fs.readFile(path.join(workspace, "devclaw", evidencePath)), bytes);
    process.argv = ["node", "migration", workspace, "--apply"];
    await import("./migrate-devclaw-state.mjs?apply");
    assert.deepEqual(await fs.readFile(path.join(workspace, "claw-foundry", evidencePath)), bytes);
    await assert.rejects(fs.stat(path.join(workspace, "devclaw")), { code: "ENOENT" });
    await fs.mkdir(path.join(workspace, "devclaw"));
    await assert.rejects(import("./migrate-devclaw-state.mjs?conflict"), /Destination already exists/);
    assert.deepEqual(await fs.readFile(path.join(workspace, "claw-foundry", evidencePath)), bytes);
    await fs.rmdir(path.join(workspace, "devclaw"));
    await assert.rejects(import("./migrate-devclaw-state.mjs?missing"), { code: "ENOENT" });
    process.argv = ["node", "migration", "relative-workspace"];
    await assert.rejects(import("./migrate-devclaw-state.mjs?relative"), /absolute path/);
  } finally {
    process.argv = originalArgs;
    await fs.rm(root, { recursive: true, force: true });
  }
});
