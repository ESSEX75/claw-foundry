/** Verifies duplicate rejection and read-only setup preview at the application boundary. */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import { createSetupRuntime as createRuntime } from "../../../testing/index.js";
import { runSetup } from "../run-setup.js";

describe("agent setup preview", () => {
  it("rejects a duplicate in entries during setup preview", async () => {
    const { runtime } = createRuntime({ agents: { entries: { "new-agent": {} }, list: [] } });

    await assert.rejects(runSetup({ runtime, runCommand: async () => { throw new Error("Unexpected command"); },
      newAgentName: "New Agent", dryRun: true }), /already exists/);
  });

  it("previews setup without writing OpenClaw config or workspace files", async () => {
    const { runtime, writes } = createRuntime({
      agents: {
        defaults: { model: "openai/gpt-5.4" },
        list: [],
      },
    });

    const result = await runSetup({
      runtime,
      runCommand: async () => { throw new Error("Preview must not invoke commands"); },
      newAgentName: "Preview Agent",
      dryRun: true,
    });

    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(result.agentId, "preview-agent");
    assert.strictEqual(writes.length, 0);
    assert.ok(result.plannedChanges.some((change) => change.includes("Create OpenClaw agent")));

    await assert.rejects(fs.access(result.workspacePath));
  });
});
