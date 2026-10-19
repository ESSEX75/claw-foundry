/** Verifies document recovery when atomic backup or destination publication fails. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";

import { BACKUP_FILE_SUFFIX } from "./const.js";
import { backupAndWrite } from "./replacement.js";

it("preserves the document when backup or destination rename fails and permits retry", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-document-"));
  const destination = path.join(directory, "instructions.md");
  const backup = `${destination}${BACKUP_FILE_SUFFIX}`;
  const rename = fs.rename.bind(fs);
  let rejectedDestination = backup;

  try {
    await fs.writeFile(destination, "original");
    t.mock.method(fs, "rename", async (source: string, target: string) => {
      if (target === rejectedDestination) throw new Error("publication failed");
      return rename(source, target);
    });
    await assert.rejects(backupAndWrite(destination, "replacement"), /publication failed/);
    assert.equal(await fs.readFile(destination, "utf8"), "original");
    rejectedDestination = destination;
    await assert.rejects(backupAndWrite(destination, "replacement"), /publication failed/);
    assert.equal(await fs.readFile(destination, "utf8"), "original");
    assert.equal(await fs.readFile(backup, "utf8"), "original");
    assert.deepEqual((await fs.readdir(directory)).sort(), ["instructions.md", "instructions.md.bak"]);
    rejectedDestination = "";
    await backupAndWrite(destination, "replacement");
    assert.equal(await fs.readFile(destination, "utf8"), "replacement");
    assert.equal(await fs.readFile(backup, "utf8"), "original");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
