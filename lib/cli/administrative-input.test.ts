/** Exercises the public CLI and rejects malformed administrative input before dependency effects. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Command } from "commander";

import { DEVCLAW_PLUGIN_ID } from "../const.js";
import { createSetupRuntime } from "../testing/index.js";
import { registerCli } from "./index.js";

describe("administrative CLI input", () => {
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

      registerCli(parent, fixture);
      await assert.rejects(parent.parseAsync([DEVCLAW_PLUGIN_ID, ...args, workspace, missing], { from: "user" }),
        /Invalid issue ID|non-empty comma-separated list|--confirm-issue must exactly match/);
    }

    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.writes, []);
  });
});
