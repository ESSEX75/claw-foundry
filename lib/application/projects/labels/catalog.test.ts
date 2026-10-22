/** Exercises shared catalog provisioning and independent persisted-provider synchronization. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import type { RunCommand } from "../../../context.js";
import { getStateLabels, ISSUE_PROVIDER } from "../../../domain/index.js";
import { loadConfig, readIssueStateStore } from "../../../state/index.js";
import { createTestHarness } from "../../../testing/index.js";
import { provisionLabelCatalog } from "./catalog.js";
import { syncProjectLabels } from "./sync.js";

/** Workspace override fixture for custom enabled/disabled levels and workflow labels. */
const CONFIG_PATH = ["devclaw", "workflow.yaml"];

describe("project label catalogs", () => {
  it("provisions custom workflow and role levels, then resumes an interrupted catalog without touching issues", async () => {
    const h = await createTestHarness();
    try {
      await fs.writeFile(path.join(h.workspaceDir, ...CONFIG_PATH),
        "roles:\n  security:\n    levels:\n      expert:\n        rank: 1\n        model: test/expert\n"
        + "    defaultLevel: expert\n    completion:\n      done: COMPLETE\n  tester: false\n"
        + "workflow:\n  states:\n    todo:\n      label: Ready for work\n");
      const config = await loadConfig(h.workspaceDir, h.project.slug);
      const input = { provider: h.provider, workflow: config.workflow, roles: config.roles };
      const ensure = h.provider.ensureLabel.bind(h.provider);
      let calls = 0;
      h.provider.ensureLabel = async (name, color) => {
        if (++calls === 3) throw new Error("catalog temporarily forbidden");
        return ensure(name, color);
      };
      await assert.rejects(provisionLabelCatalog(input), /catalog temporarily forbidden/);
      assert.equal(h.provider.labels.size, 2);
      h.provider.ensureLabel = ensure;
      const catalog = await provisionLabelCatalog(input);
      assert.ok(catalog.stateLabels.includes("Ready for work"));
      assert.ok(catalog.roleLabels.includes("security:expert"));
      assert.equal(catalog.roleLabels.some(label => label.startsWith("tester:")), false);
      const before = [...h.provider.labels];
      assert.deepEqual(await provisionLabelCatalog(input), catalog);
      assert.deepEqual([...h.provider.labels], before);
      assert.equal(h.provider.calls.some(call => call.method !== "ensureLabel"), false);
      assert.deepEqual((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues, {});
    } finally { await h.cleanup(); }
  });

  it("uses persisted GitLab/GitHub providers and retains independent failures for explicit retry", async () => {
    const h = await createTestHarness();
    try {
      const data = await h.readProjects();
      data.projects[h.project.slug].provider = ISSUE_PROVIDER.GITLAB;
      data.projects.other = { ...structuredClone(h.project), slug: "other", name: "Other", repo: "/tmp/other",
        channels: [{ ...h.project.channels[0], channelId: "other" }] };
      await h.writeProjects(data);
      let fail = true;
      const runCommand: RunCommand = async (argv, options) => {
        const result = await h.runCommand(argv, options);
        return argv[0] === "glab" && fail ? { ...result, code: 1, stderr: "403 forbidden catalog" } : result;
      };
      await assert.rejects(syncProjectLabels({ workspaceDir: h.workspaceDir, projectSlug: "constructor", runCommand }), /No project found/);
      assert.equal(h.commands.commands.length, 0);
      const first = await syncProjectLabels({ workspaceDir: h.workspaceDir, runCommand });
      assert.equal(first.success, false);
      assert.match(first.synced.find(result => result.project === h.project.slug)?.error ?? "", /forbidden catalog/);
      assert.ok(first.synced.find(result => result.project === "other")?.stateLabels.length);
      assert.equal(h.commands.commandsFor("git").length, 0);
      assert.ok(h.commands.commandsFor("glab").length);
      assert.ok(h.commands.commandsFor("gh").length);
      fail = false;
      h.commands.reset();
      const retry = await syncProjectLabels({ workspaceDir: h.workspaceDir, projectSlug: h.project.slug, runCommand });
      assert.equal(retry.success, true);
      assert.equal(retry.synced.length, 1);
      assert.equal(h.commands.commandsFor("gh").length, 0);
      const config = await loadConfig(h.workspaceDir, h.project.slug);
      assert.deepEqual(retry.synced[0].stateLabels, getStateLabels(config.workflow));
      assert.deepEqual((await readIssueStateStore(h.workspaceDir, h.project.slug)).issues, {});
    } finally { await h.cleanup(); }
  });
});
