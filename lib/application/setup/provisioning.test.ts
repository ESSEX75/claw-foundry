/** Exercises setup recovery after committed SDK registration without deleting or duplicating the agent. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it, type TestContext } from "node:test";
import { findConfiguredAgent, resolveNewAgentResources } from "../../integrations/index.js";
import { loadConfig } from "../../state/index.js";
import { createSetupRuntime } from "../../testing/index.js";
import { SETUP_APPLY_STEP, SETUP_RECOVERY_ACTION } from "./const.js";
import { SetupApplyError } from "./errors.js";
import { runSetup } from "./run-setup.js";

/** Give the SDK an isolated actual state root and restore the environment after the test.
 * @param t - Test scope owning environment and filesystem cleanup.
 */
async function scopedHome(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "devclaw-setup-recovery-"));
  const previous = process.env.OPENCLAW_STATE_DIR;

  process.env.OPENCLAW_STATE_DIR = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  });

  return root;
}

it("keeps implicit SDK resource creation with the host during ordinary existing-agent setup", async t => {
  const root = await scopedHome(t);
  const workspacePath = path.join(root, "existing-workspace");
  const fixture = createSetupRuntime({ agents: { entries: { existing: { workspace: workspacePath } } } });

  await runSetup({ ...fixture, agentId: "existing" });
  await fs.access(path.join(workspacePath, "AGENTS.md"));
  await assert.rejects(fs.access(path.join(root, "agents", "existing", "agent")));
});

it("retains registration after mkdir failure and resumes directories and scaffolding through the existing agent", async t => {
  await scopedHome(t);
  const fixture = createSetupRuntime();
  const resources = await resolveNewAgentResources("recover-agent");
  const mkdir = fs.mkdir;
  const failure = new Error("agent directory unavailable");
  const fault = t.mock.method(fs, "mkdir", async (...args: Parameters<typeof fs.mkdir>) => {
    if (String(args[0]) === resources.agentDirectory) throw failure;

    return mkdir(...args);
  });

  await assert.rejects(runSetup({ ...fixture, newAgentName: "Recover Agent" }), error => {
    assert.ok(error instanceof SetupApplyError);
    assert.equal(error.cause, failure);
    assert.equal(error.result.agentCreated, true);
    assert.equal(error.result.recovery.step, SETUP_APPLY_STEP.RESOURCES);
    assert.equal(error.result.recovery.action, SETUP_RECOVERY_ACTION.RESUME_TARGET);
    assert.match(error.message, /without newAgentName/);

    return true;
  });
  assert.ok(findConfiguredAgent(fixture.runtime.config.current(), "recover-agent"));
  assert.equal(fixture.writes.length, 1);
  fault.mock.restore();
  const resumed = await runSetup({ ...fixture, agentId: "recover-agent" });

  assert.equal(resumed.agentCreated, false);
  assert.equal(resumed.recovery, undefined);
  assert.equal(fixture.runtime.config.current().agents?.list?.filter(agent => agent.id === "recover-agent").length, 1);
  await fs.access(resources.agentDirectory);
  await fs.access(resources.sessionsDirectory);
  await fs.access(path.join(resources.workspacePath, "devclaw", "projects.json"));
});

it("does not provision files when SDK registration fails and supports a retry after verified non-commit", async t => {
  await scopedHome(t);
  const fixture = createSetupRuntime();
  const resources = await resolveNewAgentResources("retry-agent");
  const fault = t.mock.method(fixture.runtime.config, "mutateConfigFile", async () => { throw new Error("SDK write rejected"); });

  await assert.rejects(runSetup({ ...fixture, newAgentName: "Retry Agent" }), error => {
    assert.ok(error instanceof SetupApplyError);
    assert.equal(error.result.agentCreated, false);
    assert.equal(error.result.recovery.action, SETUP_RECOVERY_ACTION.INSPECT_REGISTRATION);

    return true;
  });
  assert.equal(fixture.writes.length, 0);
  assert.equal(findConfiguredAgent(fixture.runtime.config.current(), "retry-agent"), undefined);
  await assert.rejects(fs.access(resources.workspacePath));
  fault.mock.restore();
  assert.equal((await runSetup({ ...fixture, newAgentName: "Retry Agent" })).agentCreated, true);
});

for (const step of [SETUP_APPLY_STEP.SCAFFOLD, SETUP_APPLY_STEP.MODELS]) {
  it(`reports and resumes ${step} failure after registration and configuration commit`, async t => {
    await scopedHome(t);
    const fixture = createSetupRuntime();
    const resources = await resolveNewAgentResources("partial-agent");
    const write = fs.writeFile;
    const fault = t.mock.method(fs, "writeFile", async (...args: Parameters<typeof fs.writeFile>) => {
      if (step === SETUP_APPLY_STEP.SCAFFOLD && String(args[0]) === path.join(resources.workspacePath, "AGENTS.md")) throw new Error("scaffold failed");
      if (step === SETUP_APPLY_STEP.MODELS && String(args[0]).startsWith(path.join(resources.workspacePath, "devclaw", "workflow.yaml."))
        && typeof args[1] === "string" && args[1].includes("model/recovered")) throw new Error("model persistence failed");

      return write(...args);
    });
    const models = { developer: { senior: "model/recovered" } };

    await assert.rejects(runSetup({ ...fixture, newAgentName: "Partial Agent", models }), error => {
      assert.ok(error instanceof SetupApplyError);
      assert.equal(error.result.agentCreated, true);
      assert.equal(error.result.recovery.step, step);

      return true;
    });
    assert.ok(findConfiguredAgent(fixture.runtime.config.current(), "partial-agent"));
    fault.mock.restore();
    await runSetup({ ...fixture, agentId: "partial-agent", models });
    assert.equal((await loadConfig(resources.workspacePath)).roles.developer.levels.senior.model, "model/recovered");
    assert.equal(fixture.runtime.config.current().agents?.list?.filter(agent => agent.id === "partial-agent").length, 1);
  });
}
