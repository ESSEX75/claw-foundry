/** Verifies SDK resource ownership, explicit registration and environment-aware paths without application filesystem rules. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";

import { createSetupRuntime } from "../../../testing/index.js";
import { registerAgentConfiguration } from "./registration.js";
import { provisionAgentResources, resolveConfiguredAgentResources, resolveNewAgentResources } from "./resources.js";

it("registers through one SDK mutation and provisions explicit resources separately", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-agent-resources-"));

  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { runtime, writes } = createSetupRuntime({ agents: { defaults: { model: "model/default" }, list: [] } });
  const resources = await resolveNewAgentResources("new-agent", { openClawHome: root });

  await registerAgentConfiguration({ runtime, agentId: "new-agent", name: "New Agent", resources, afterWrite: { mode: "none", reason: "test owns reload" } });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].nextConfig.agents?.list?.[0].model, "model/default");
  assert.equal(writes[0].nextConfig.agents?.list?.[0].workspace, resources.workspacePath);
  await assert.rejects(fs.access(resources.workspacePath));
  await provisionAgentResources(resources);
  await provisionAgentResources(resources);
  for (const directory of [resources.workspacePath, resources.agentDirectory, resources.sessionsDirectory]) await fs.access(directory);
});

it("uses the active entries registry and rejects a concurrent duplicate before provisioning", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-agent-entries-"));

  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { runtime, writes } = createSetupRuntime({ agents: { entries: { owner: {} }, list: [{ id: "legacy" }] } });
  const resources = await resolveNewAgentResources("new-agent", { openClawHome: root });
  const input = { runtime, agentId: "new-agent", name: "New Agent", resources, afterWrite: { mode: "none", reason: "test owns reload" } } satisfies
    Parameters<typeof registerAgentConfiguration>[0];

  await registerAgentConfiguration(input);
  assert.equal(writes[0].nextConfig.agents?.entries?.["new-agent"]?.workspace, resources.workspacePath);
  assert.deepEqual(writes[0].nextConfig.agents?.list?.map(agent => agent.id), ["legacy"]);
  await assert.rejects(registerAgentConfiguration(input), /already exists/);
  assert.equal(writes.length, 1);
  await assert.rejects(fs.access(resources.workspacePath));
});

it("honors SDK state-root environment and configured custom paths without new-name guards on existing IDs", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claw-foundry-sdk-home-"));
  const previous = process.env.OPENCLAW_STATE_DIR;

  process.env.OPENCLAW_STATE_DIR = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  });
  const proposed = await resolveNewAgentResources("new-agent");

  assert.equal(proposed.workspacePath, path.join(root, "agents", "new-agent", "workspace"));
  await assert.rejects(fs.access(proposed.workspacePath));
  await assert.rejects(resolveNewAgentResources("../outside"), /Invalid new agent/);
  const workspacePath = path.join(root, "custom-workspace");
  const agentDir = path.join(root, "custom-config");
  const existing = await resolveConfiguredAgentResources({ agents: { entries: { custom_agent: { workspace: workspacePath, agentDir } } } }, "custom_agent");

  assert.equal(existing.workspacePath, workspacePath);
  assert.equal(existing.agentDirectory, agentDir);
  await provisionAgentResources(existing);
  await fs.access(workspacePath);
  await fs.access(agentDir);
});
