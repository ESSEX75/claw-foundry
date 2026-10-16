/** Exercises terminal parsing before administrative commands can resolve storage or provider effects. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Command } from "commander";

import { createSetupRuntime } from "../../testing/index.js";
import { registerIssuesArchiveCommand } from "../commands/issues-archive-command.js";
import { registerRepairIssueCommand } from "../commands/repair-issue-command.js";
import { registerWorkerDeliveryCommand } from "../commands/worker-delivery-command.js";
import { requireWorkspace } from "./configuration.js";
import { parseIssueId, parseIssueSelection, parseSelection, requireExclusiveMode } from "./parsers.js";

describe("administrative CLI input", () => {
  it("rejects the entire issue selection when any decimal ID is invalid", () => {
    for (const value of ["", " ", "12,typo", "12,", ",12", "0", "-1", "1.5", "9007199254740993", "1e2", "0x10"]) {
      assert.throws(() => parseIssueSelection(value), /Invalid issue ID|non-empty comma-separated list/, value);
    }

    assert.deepEqual(parseIssueSelection(" 12, 34 "), [12, 34]);
    assert.equal(parseIssueSelection(undefined), undefined);
    assert.equal(parseIssueId("9007199254740991"), Number.MAX_SAFE_INTEGER);
  });

  it("keeps explicit state selections distinct from omitted filters", () => {
    for (const value of ["", " ", "queued,", "queued,,custom"]) {
      assert.throws(() => parseSelection(value, "--state"), /--state/);
    }

    assert.deepEqual(parseSelection(" queued, custom ", "--state"), ["queued", "custom"]);
    assert.equal(parseSelection(undefined, "--state"), undefined);
  });

  it("requires exactly one mode, whether the other flag is false or omitted", () => {
    assert.throws(() => requireExclusiveMode(undefined, undefined));
    assert.throws(() => requireExclusiveMode(false, false));
    assert.throws(() => requireExclusiveMode(true, true));
    requireExclusiveMode(true, undefined);
    requireExclusiveMode(undefined, true);
  });

  it("resolves explicit workspaces independently of SDK failures", () => {
    const fixture = createSetupRuntime();

    fixture.runtime.config.current = () => { throw new Error("SDK read failed"); };
    assert.equal(requireWorkspace("explicit-workspace", fixture.runtime), "explicit-workspace");
    assert.throws(() => requireWorkspace(undefined, fixture.runtime), /Unable to read OpenClaw configuration/);
    assert.throws(() => requireWorkspace(" ", fixture.runtime), /Workspace path is required/);
  });

  it("rejects malformed filters and unsafe IDs before touching storage or provider transport", async () => {
    const fixture = createSetupRuntime();
    // This deliberately missing workspace makes an accidental dependency read observable.
    const workspace = "--workspace";
    const missing = "missing-cli-validation-workspace";
    const cases = [
      ["repair", "policies", "--project", "test", "--review", "agent", "--apply", "--issue", "12,typo"],
      ["repair", "policies", "--project", "test", "--review", "agent", "--apply", "--issue", ""],
      ["repair", "policies", "--project", "test", "--review", "agent", "--apply", "--state", ""],
      ["repair", "issue", "--project", "test", "--source", "local-state", "--dry-run", "--issue", "9007199254740993"],
      ["issues", "delete", "--project", "test", "--apply", "--issue", "9007199254740993", "--confirm-issue", "9007199254740993"],
      ["issues", "delete", "--project", "test", "--apply", "--issue", "12", "--confirm-issue", "9007199254740993"],
      ["issues", "delete", "--project", "test", "--apply", "--issue", "12", "--confirm-issue", "13"],
      ["worker-delivery", "--project", "test", "--issue", "9007199254740993", "--session-key", "s", "--delivery-id", "d", "--decision", "confirmed-started", "--reason", "verified", "--dry-run"],
    ];

    for (const args of cases) {
      const parent = new Command();

      registerRepairIssueCommand(parent, fixture);
      registerIssuesArchiveCommand(parent, fixture);
      registerWorkerDeliveryCommand(parent, fixture);
      await assert.rejects(parent.parseAsync([...args, workspace, missing], { from: "user" }),
        /Invalid issue ID|non-empty comma-separated list|--confirm-issue must exactly match/);
    }

    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
  });
});
