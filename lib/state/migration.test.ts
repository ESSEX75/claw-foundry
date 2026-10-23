/** Verifies that rebranding cannot silently hide existing managed state during setup or discovery. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";

import { loadInstanceName } from "../instance.js";
import { loadConfig } from "./config/index.js";
import { readIssueStateStore } from "./issues/index.js";
import { readOptionalProjects } from "./projects/index.js";
import { initializeWorkspaceFiles, scaffoldWorkspace } from "./setup/index.js";

it("refuses upstream and ambiguous state without creating files or treating it as absent", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-migration-"));
  try {
    const source = path.join(workspace, "devclaw");
    await fs.mkdir(source);
    const evidence = '{"preserved":"runtime evidence"}';
    await fs.writeFile(path.join(source, "projects.json"), evidence);
    for (const operation of [initializeWorkspaceFiles, scaffoldWorkspace, readOptionalProjects]) {
      await assert.rejects(operation(workspace), /Existing DevClaw state/);
    }
    await assert.rejects(loadConfig(workspace), /Existing DevClaw state/);
    await assert.rejects(loadInstanceName(workspace), /Existing DevClaw state/);
    await assert.rejects(readIssueStateStore(workspace, "example"), /Existing DevClaw state/);
    assert.deepEqual(await fs.readdir(workspace), ["devclaw"]);
    assert.equal(await fs.readFile(path.join(source, "projects.json"), "utf8"), evidence);
    await fs.mkdir(path.join(workspace, "claw-foundry"));
    await assert.rejects(initializeWorkspaceFiles(workspace), /Existing DevClaw state/);
    assert.deepEqual(await fs.readdir(path.join(workspace, "claw-foundry")), []);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
