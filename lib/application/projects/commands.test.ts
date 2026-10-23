/** Exercises registration recovery, route ownership and locked endpoint allocation. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import type { RunCommand } from "../../context.js";
import { NOTIFICATION_CHANNEL } from "../../domain/index.js";
import { createTestHarness } from "../../testing/index.js";
import type { RouteConfig } from "./routing/index.js";
import { linkProjectChannel } from "./channels/commands.js";
import { registerProject } from "./registration/command.js";

/** Canonical paths of scaffold resources exercised by failure/recovery tests. */
const PROJECT_PATH = ["claw-foundry", "projects"];

/** Build exact SDK bindings for a project owner's requested destinations.
 * @param peers - Conversation identifiers accepted by the configured owner.
 */
function routing(peers: string[]): RouteConfig {
  return { agents: { list: [{ id: "test-agent" }] },
    channels: { telegram: { enabled: true, accounts: { default: {} } } },
    bindings: peers.map(id => ({ agentId: "test-agent", match: { channel: "telegram", accountId: "default", peer: { kind: "group", id } } })) };
}

describe("project commands", () => {
  it("rejects existing repository, branch and owner mismatches before provider effects", async () => {
    const h = await createTestHarness();
    try {
      for (const mismatch of [{ repo: "other-repo" }, { baseBranch: "other" }, { deployBranch: "other" }, { agentId: "other" }]) {
        await assert.rejects(registerProject({ workspaceDir: h.workspaceDir, name: h.project.name, repo: h.project.repo,
          baseBranch: h.project.baseBranch, agentId: h.project.agentId, route: h.project.channels[0],
          getConfig: () => routing([h.channelId]), runCommand: h.runCommand, ...mismatch }));
      }
      assert.deepEqual(h.commands.commands, []);
    } finally { await h.cleanup(); }
  });

  it("allocates distinct names under lock and rejects a foreign agent", async () => {
    const h = await createTestHarness();
    try {
      const getConfig = () => routing(["left", "right"]);
      const input = { workspaceDir: h.workspaceDir, projectRef: h.project.slug, agentId: h.project.agentId, getConfig };
      const results = await Promise.all(["left", "right"].map(channelId => linkProjectChannel({ ...input,
        route: { channel: NOTIFICATION_CHANNEL.TELEGRAM, accountId: "default", channelId } })));
      assert.equal(new Set(results.map(result => result.endpoint.name)).size, 2);
      const again = await linkProjectChannel({ ...input, route: results[0].endpoint });
      assert.equal(again.changed, false);
      await assert.rejects(linkProjectChannel({ ...input, agentId: "other", route: results[0].endpoint }), /belongs/);
      assert.equal((await h.readProjects()).projects[h.project.slug]?.channels.length, 3);
    } finally { await h.cleanup(); }
  });

  it("returns a committed registration after scaffold failure and completes the same request on retry", async () => {
    const h = await createTestHarness();
    try {
      const projectDir = path.join(h.workspaceDir, ...PROJECT_PATH, "new-project");
      await fs.mkdir(projectDir, { recursive: true });
      const collision = path.join(projectDir, "prompts");
      await fs.writeFile(collision, "user file");
      const runCommand: RunCommand = async (argv, options) => argv[0] === "git"
        ? { code: 0, stdout: "git@github.com:example/project.git", stderr: "", signal: null, killed: false, termination: "exit" }
        : h.runCommand(argv, options);
      const input = { workspaceDir: h.workspaceDir, name: "new-project", repo: h.project.repo,
        baseBranch: "main", agentId: h.project.agentId,
        route: { channel: NOTIFICATION_CHANNEL.TELEGRAM, accountId: "default", channelId: "new-peer" },
        getConfig: () => routing(["new-peer"]), runCommand };
      const first = await registerProject(input);
      assert.equal(first.isNewProject, true);
      assert.ok(first.scaffoldError);
      assert.equal((await h.readProjects()).projects["new-project"]?.channels.length, 1);
      assert.equal(await fs.readFile(collision, "utf8"), "user file");
      await fs.unlink(collision);
      const retried = await registerProject(input);
      assert.equal(retried.scaffoldError, undefined);
      assert.equal(retried.changed, false);
      assert.equal(retried.promptsScaffolded, true);
      assert.equal(retried.project.repo, input.repo);
      assert.equal((await h.readProjects()).projects["new-project"]?.channels.length, 1);
      const readme = path.join(projectDir, "README.md");
      await fs.writeFile(readme, "custom documentation");
      const repeated = await registerProject(input);
      assert.equal(repeated.promptsScaffolded, false);
      assert.equal(await fs.readFile(readme, "utf8"), "custom documentation");
    } finally { await h.cleanup(); }
  });
});
