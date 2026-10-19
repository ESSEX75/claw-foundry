/** Exercises concurrent model patches and resets against the same workflow document. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";

import YAML from "yaml";

import { DATA_DIR, WORKFLOW_FILE_NAME } from "../../paths.js";
import { BACKUP_FILE_SUFFIX } from "../documents/const.js";
import { loadSetupTemplates } from "../resources/index.js";
import { DEFAULTS_SCOPE } from "./const.js";
import { writeWorkspaceModels } from "./models.js";
import { resetWorkspaceConfiguration } from "./workspace.js";

it("preserves both concurrent model patches, unrelated settings and comments", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-model-patches-"));
  const workflow = path.join(workspace, DATA_DIR, WORKFLOW_FILE_NAME);

  try {
    await fs.mkdir(path.dirname(workflow));
    await fs.writeFile(workflow, "# Keep this comment\ninstance:\n  name: custom\nroles: {}\n");
    await Promise.all([
      writeWorkspaceModels(workspace, { developer: { junior: "model-a" } }),
      writeWorkspaceModels(workspace, { tester: { junior: "model-b" } }),
    ]);
    const content = await fs.readFile(workflow, "utf8");
    const doc = YAML.parseDocument(content);

    assert.equal(doc.getIn(["roles", "developer", "levels", "junior", "model"]), "model-a");
    assert.equal(doc.getIn(["roles", "tester", "levels", "junior", "model"]), "model-b");
    assert.equal(doc.getIn(["instance", "name"]), "custom");
    assert.match(content, /# Keep this comment/);
    const backup = await fs.readFile(`${workflow}${BACKUP_FILE_SUFFIX}`, "utf8");

    assert.equal(Number(backup.includes("model-a")) + Number(backup.includes("model-b")), 1);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

it("serializes reset after an in-flight patch and backs up the patched document", async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-model-reset-"));
  const workflow = path.join(workspace, DATA_DIR, WORKFLOW_FILE_NAME);
  const rename = fs.rename.bind(fs);
  let publish: (() => void) | undefined;
  let reportPublication: (() => void) | undefined;
  const publicationPaused = new Promise<void>(resolve => { reportPublication = resolve; });
  const publicationAllowed = new Promise<void>(resolve => { publish = resolve; });
  let paused = false;

  try {
    await fs.mkdir(path.dirname(workflow));
    await fs.writeFile(workflow, "roles: {}\n");
    t.mock.method(fs, "rename", async (source: string, target: string) => {
      if (target === workflow && !paused) {
        paused = true;
        reportPublication?.();
        await publicationAllowed;
      }
      return rename(source, target);
    });
    const patch = writeWorkspaceModels(workspace, { developer: { junior: "model-a" } });
    await publicationPaused;
    const reset = resetWorkspaceConfiguration(workspace, DEFAULTS_SCOPE.WORKFLOW);

    publish?.();
    await Promise.all([patch, reset]);
    assert.equal(await fs.readFile(workflow, "utf8"), (await loadSetupTemplates()).workflow);
    assert.match(await fs.readFile(`${workflow}${BACKUP_FILE_SUFFIX}`, "utf8"), /model-a/);
  } finally {
    publish?.();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
