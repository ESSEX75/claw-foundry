/** Exercises configured model prompts, exact overrides, target resolution and effect-free input rejection. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, type TestContext } from "node:test";
import { Command } from "commander";

import { getSetupModels } from "../../application/index.js";
import { DATA_DIR, loadConfig } from "../../state/index.js";
import { createSetupRuntime, createTestHarness } from "../../testing/index.js";
import { registerSetupCommand } from "./register.js";
import { collectModelOptions } from "./model-prompts.js";
import { collectInteractiveSetupDetails } from "./interactive.js";
import { resolveSetupCliOptions } from "./target-prompts.js";
import { parseModelOverrides } from "./models.js";

/** Workspace model configuration file used by integration fixtures. */
const WORKFLOW_FILE_NAME = "workflow.yaml";

/** Effective model fixture includes custom, disabled, overridden, and removed identifiers. */
const MODEL_CONFIGURATION = `roles:
  developer:
    defaultLevel: senior
    levels:
      medior: false
      senior:
        model: model/current
  tester: false
  security_auditor:
    levels:
      expert:
        rank: 3
        model: model/security
    defaultLevel: expert
    completion:
      done: COMPLETE
      blocked: BLOCKED
`;

/** Create one isolated configured target, retaining all writes/commands for side-effect assertions.
 * @param t - Test lifecycle responsible for temporary workspace cleanup.
 */
async function configuredTarget(t: TestContext) {
  const h = await createTestHarness();
  t.after(h.cleanup);
  const file = path.join(h.workspaceDir, DATA_DIR, WORKFLOW_FILE_NAME);
  await fs.writeFile(file, MODEL_CONFIGURATION);
  const fixture = createSetupRuntime({ agents: { entries: { dev: { workspace: h.workspaceDir } } } });

  return { ...fixture, h, file };
}

describe("setup configured CLI models", () => {
  it("parses repeated custom overrides and rejects malformed or repeated destinations", () => {
    assert.deepEqual(parseModelOverrides({ model: ["security_auditor.expert=model/custom", "developer.senior=provider/model=a"] }),
      { security_auditor: { expert: "model/custom" }, developer: { senior: "provider/model=a" } });
    assert.equal(parseModelOverrides({ model: [] }), undefined);
    for (const model of ["bad", "a.b.c=model", "a.=model", ".b=model", "a.b= "]) {
      assert.throws(() => parseModelOverrides({ model: [model] }));
    }
    assert.throws(() => parseModelOverrides({ model: ["a.b=one", "a.b=two"] }), /Duplicate/);
    assert.throws(() => parseModelOverrides({ developerSenior: ["one", "two"] }), /Duplicate/);
    assert.throws(() => parseModelOverrides({ developerSenior: "one", model: ["developer.senior=one"] }), /Duplicate/);
  });

  it("reads only effective enabled levels through the same target planning without effects", async t => {
    const fixture = await configuredTarget(t);
    const before = await fs.readFile(fixture.file);
    const models = await getSetupModels({ runtime: fixture.runtime, agentId: "dev" });

    assert.equal(models.security_auditor?.expert, "model/security");
    assert.equal(models.developer?.senior, "model/current");
    assert.equal(models.developer?.medior, undefined);
    assert.equal(models.tester, undefined);
    await assert.rejects(getSetupModels({ runtime: fixture.runtime, agentId: "missing", workspacePath: fixture.h.workspaceDir }), /does not exist/);
    assert.deepEqual(await fs.readFile(fixture.file), before);
    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
  });

  it("uses explicit workspace precedence over the agent's saved workspace", async t => {
    const fixture = await configuredTarget(t);
    const other = await configuredTarget(t);
    await fs.writeFile(other.file, MODEL_CONFIGURATION.replace("model/current", "model/other"));

    assert.equal((await getSetupModels({ runtime: fixture.runtime, agentId: "dev", workspacePath: other.h.workspaceDir })).developer?.senior, "model/other");
  });

  it("prompts with actual assignments, includes custom levels and submits only explicit answers", async t => {
    const fixture = await configuredTarget(t);
    const questions: string[] = [];
    const opts = await collectModelOptions({ agent: "dev" }, { question: async text => {
      questions.push(text);
      return text.includes("[Y/n]") ? "n" : text.includes("security_auditor.expert") ? "model/new" : "";
    } }, fixture.runtime);

    assert.ok(questions.some(text => text.includes("developer.senior model [model/current]")));
    assert.ok(questions.some(text => text.includes("security_auditor.expert model [model/security]")));
    assert.ok(!questions.some(text => text.includes("tester.") || text.includes("developer.medior")));
    assert.deepEqual(parseModelOverrides(opts), { security_auditor: { expert: "model/new" } });
    assert.deepEqual(fixture.writes, []);
    assert.deepEqual(fixture.commands, []);
    const kept = await collectModelOptions({ agent: "dev" }, { question: async () => "" }, fixture.runtime);
    assert.equal(parseModelOverrides(kept), undefined);
  });

  it("preserves explicit partial overrides without asking additional model questions", async t => {
    const fixture = await configuredTarget(t);
    const opts = { model: ["security_auditor.expert=model/explicit"] };

    assert.equal(await collectModelOptions(opts, { question: async () => { throw new Error("must not ask"); } }, fixture.runtime), opts);
  });

  it("accepts custom assignments through Commander and preserves other configuration on apply", async t => {
    const fixture = await configuredTarget(t);
    t.mock.method(console, "log", () => {});
    const before = await fs.readFile(fixture.file);
    const preview = new Command();
    registerSetupCommand(preview, fixture);
    await preview.parseAsync(["setup", "--workspace", fixture.h.workspaceDir, "--model", "security_auditor.expert=model/new", "--dry-run"], { from: "user" });
    assert.deepEqual(await fs.readFile(fixture.file), before);
    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
    const command = new Command();
    registerSetupCommand(command, fixture);
    await command.parseAsync(["setup", "--workspace", fixture.h.workspaceDir, "--model", "security_auditor.expert=model/new", "--developer-senior", "model/override"], { from: "user" });

    const config = await loadConfig(fixture.h.workspaceDir);
    assert.equal(config.roles.security_auditor?.levels.expert?.model, "model/new");
    assert.equal(config.roles.developer?.levels.senior?.model, "model/override");
    assert.equal(config.roles.tester?.enabled, false);
    assert.equal(config.roles.developer?.levels.medior, undefined);
  });

  it("rejects disabled/removed levels and conflicting inputs before writes or scope requests", async t => {
    const fixture = await configuredTarget(t);
    t.mock.method(console, "log", () => {});
    const before = await fs.readFile(fixture.file);
    for (const args of [
      ["--model", "security_auditor.unknown=model/x"], ["--model", "tester.senior=model/x"],
      ["--model", "developer.medior=model/x"], ["--model", "developer.senior= "],
      ["--developer-senior", "one", "--model", "developer.senior=two"],
      ["--developer-senior", "one", "--developer-senior", "two"],
      ["--eject-defaults", "--model", "developer.senior=model/x"],
    ]) {
      const command = new Command();
      registerSetupCommand(command, fixture);
      await assert.rejects(command.parseAsync(["setup", "--workspace", fixture.h.workspaceDir, ...args], { from: "user" }));
    }
    assert.deepEqual(await fs.readFile(fixture.file), before);
    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
  });

  it("keeps file recovery independent of malformed workflow and noninteractive target selection explicit", async t => {
    const fixture = await configuredTarget(t);
    t.mock.method(console, "log", () => {});
    await fs.writeFile(fixture.file, "[invalid");
    const command = new Command();
    registerSetupCommand(command, fixture);
    await command.parseAsync(["setup", "--workspace", fixture.h.workspaceDir, "--reset-defaults", "--dry-run"], { from: "user" });
    assert.equal(await fs.readFile(fixture.file, "utf8"), "[invalid");
    const opts = { workspace: fixture.h.workspaceDir, refreshInstructions: true };
    assert.equal(await collectInteractiveSetupDetails(opts, fixture.runtime), opts);
    assert.equal(await resolveSetupCliOptions(opts, fixture.runtime), opts);
    if (!process.stdin.isTTY) await assert.rejects(resolveSetupCliOptions({}, fixture.runtime), /requires a terminal/);
  });
});
