/** Verifies public CLI composition, preserved terminal syntax and lazy read-only command behavior. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { describe, it } from "node:test";
import { Command } from "commander";

import { CLAW_FOUNDRY_PLUGIN_ID } from "../shared/const.js";
import { createSetupRuntime, createTestHarness } from "../testing/index.js";
import { registerCli } from "./index.js";

describe("CLI registration facade", () => {
  it("registers one namespace and all five roots without reading SDK configuration", () => {
    const fixture = createSetupRuntime();
    fixture.runtime.config.current = () => { throw new Error("registration must remain lazy"); };
    const program = new Command();
    registerCli(program, fixture);

    assert.equal(program.commands.length, 1);
    const clawFoundry = program.commands[0];
    assert.ok(clawFoundry);
    assert.equal(clawFoundry.name(), CLAW_FOUNDRY_PLUGIN_ID);
    assert.deepEqual(clawFoundry.commands.map(command => command.name()).sort(), ["doctor", "issues", "repair", "setup", "worker-delivery"]);
    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
  });

  it("preserves administrative command nesting and exact confirmation options", () => {
    const program = new Command();
    registerCli(program, createSetupRuntime());
    const clawFoundry = program.commands[0];
    assert.ok(clawFoundry);
    const issues = clawFoundry.commands.find(command => command.name() === "issues");
    const repair = clawFoundry.commands.find(command => command.name() === "repair");
    assert.ok(issues && repair);
    assert.deepEqual(issues.commands.map(command => command.name()).sort(), ["archive", "delete", "reset-store"]);
    assert.deepEqual(repair.commands.map(command => command.name()).sort(), ["issue", "policies"]);
    const archive = issues.commands.find(command => command.name() === "archive");
    assert.deepEqual(archive?.commands.map(command => command.name()).sort(), ["purge", "status"]);
    assert.match(issues.commands.find(command => command.name() === "delete")?.helpInformation() ?? "", /--confirm-issue/);
    assert.match(issues.commands.find(command => command.name() === "reset-store")?.helpInformation() ?? "", /--confirm-project/);
    assert.match(repair.commands.find(command => command.name() === "issue")?.helpInformation() ?? "", /--plan-token/);
    const deliveryHelp = clawFoundry.commands.find(command => command.name() === "worker-delivery")?.helpInformation() ?? "";
    for (const flag of ["--session-key", "--delivery-id", "--decision", "--reason", "--dry-run", "--apply"]) assert.ok(deliveryHelp.includes(flag));
  });

  it("documents repeatable custom models and retained built-in overrides without stale model defaults", () => {
    const program = new Command();
    registerCli(program, createSetupRuntime());
    const help = program.commands[0]?.commands.find(command => command.name() === "setup")?.helpInformation() ?? "";

    for (const flag of ["--model <role.level=model>", "--developer-senior", "--new-agent", "--agent", "--workspace", "--eject-defaults", "--reset-defaults", "--refresh-instructions"]) {
      assert.ok(help.includes(flag), flag);
    }
    assert.ok(!help.includes("auto") && !help.includes("anthropic/"));
  });

  it("runs doctor through the namespace without writes and retains a failing report exit status", async t => {
    const h = await createTestHarness();
    t.after(h.cleanup);
    const fixture = createSetupRuntime();
    const previousExitCode = process.exitCode;
    t.after(() => { process.exitCode = previousExitCode; });
    const lines: string[] = [];
    t.mock.method(console, "log", (line: string) => { lines.push(line); });
    const before = await fs.readdir(h.workspaceDir, { recursive: true });
    const program = new Command();
    registerCli(program, fixture);
    await program.parseAsync([CLAW_FOUNDRY_PLUGIN_ID, "doctor", "--workspace", h.workspaceDir], { from: "user" });

    assert.equal(process.exitCode, 1);
    assert.ok(lines.some(line => line.startsWith("ERROR")));
    assert.ok(lines.some(line => line.includes("Issue archives")));
    assert.deepEqual(await fs.readdir(h.workspaceDir, { recursive: true }), before);
    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
  });

  it("parses archive previews and exact reset confirmation through the public namespace", async t => {
    const h = await createTestHarness();
    t.after(h.cleanup);
    const fixture = createSetupRuntime();
    const lines: string[] = [];
    t.mock.method(console, "log", (line: string) => { lines.push(line); });
    const before = await fs.readdir(h.workspaceDir, { recursive: true });

    for (const args of [["archive", "status"], ["archive", "purge", "--dry-run"]]) {
      const program = new Command();
      registerCli(program, fixture);
      await program.parseAsync([CLAW_FOUNDRY_PLUGIN_ID, "issues", ...args, "--project", h.project.slug, "--workspace", h.workspaceDir], { from: "user" });
    }
    assert.deepEqual(await fs.readdir(h.workspaceDir, { recursive: true }), before);
    const preview: unknown = JSON.parse(lines.at(-1) ?? "null");
    assert.deepEqual(preview, { dryRun: true, purge: [] });
    const program = new Command();
    registerCli(program, fixture);
    await assert.rejects(program.parseAsync([CLAW_FOUNDRY_PLUGIN_ID, "issues", "reset-store", "--project", h.project.slug,
      "--confirm-project", "different", "--workspace", h.workspaceDir], { from: "user" }), /confirmProjectSlug/);
    assert.deepEqual(await fs.readdir(h.workspaceDir, { recursive: true }), before);
    const confirmed = new Command();
    registerCli(confirmed, fixture);
    await confirmed.parseAsync([CLAW_FOUNDRY_PLUGIN_ID, "issues", "reset-store", "--project", h.project.slug,
      "--confirm-project", h.project.slug, "--workspace", h.workspaceDir], { from: "user" });
    const result: unknown = JSON.parse(lines.at(-1) ?? "null");
    assert.deepEqual(result, { projectSlug: h.project.slug, reset: true });
    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
  });
});
