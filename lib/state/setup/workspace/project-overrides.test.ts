/** Verifies exclusive create semantics for project-local documentation. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";

import { createTestHarness } from "../../../testing/index.js";
import { PROJECT_OVERRIDES_FILE_NAME } from "./const.js";
import { scaffoldProjectOverrides } from "./project-overrides.js";

/** Project documentation location within an isolated workspace. */
const PROJECT_PATH = ["devclaw", "projects", "test-project"];

it("creates documentation once under concurrent scaffolds and rejects invalid slugs", async () => {
  const h = await createTestHarness();
  try {
    const results = await Promise.all([scaffoldProjectOverrides(h.workspaceDir, h.project.slug, ["left"]),
      scaffoldProjectOverrides(h.workspaceDir, h.project.slug, ["right"])]);
    assert.equal(results.filter(Boolean).length, 1);
    const readme = path.join(h.workspaceDir, ...PROJECT_PATH, PROJECT_OVERRIDES_FILE_NAME);
    const saved = await fs.readFile(readme, "utf8");
    assert.equal(await scaffoldProjectOverrides(h.workspaceDir, h.project.slug, ["replacement"]), false);
    assert.equal(await fs.readFile(readme, "utf8"), saved);
    await assert.rejects(scaffoldProjectOverrides(h.workspaceDir, "../outside", []));
  } finally { await h.cleanup(); }
});
