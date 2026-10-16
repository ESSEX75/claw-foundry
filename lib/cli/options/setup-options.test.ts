/** Ensures interactive setup displays only agents from the active registry. */
import assert from "node:assert/strict";
import { it } from "node:test";

import { createSetupRuntime } from "../../testing/index.js";
import { getDefaultWorkspaceDir } from "../input/index.js";
import { getConfiguredAgents, normalizeChannelBinding, normalizeProjectExecution } from "./setup-options.js";

it("shows entries agents and ignores legacy list when both exist", () => {
  const { runtime } = createSetupRuntime({ agents: {
    entries: { "dev-agent": { name: "Developer" } },
    list: [{ id: "legacy" }],
  } });

  assert.deepEqual(getConfiguredAgents(runtime).map(agent => agent.id), ["dev-agent"]);
  assert.equal(getConfiguredAgents(runtime)[0]?.name, "Developer");
});

it("distinguishes an empty configuration from an SDK read failure", () => {
  const fixture = createSetupRuntime();
  assert.equal(getDefaultWorkspaceDir(fixture.runtime), undefined);
  assert.deepEqual(getConfiguredAgents(fixture.runtime), []);
  const cause = new Error("SDK configuration is inaccessible");

  fixture.runtime.config.current = () => { throw cause; };
  for (const read of [getDefaultWorkspaceDir, getConfiguredAgents]) {
    assert.throws(() => read(fixture.runtime), error => error instanceof Error && error.cause === cause);
  }
});

it("validates raw terminal enums before creating an application payload", () => {
  assert.throws(() => normalizeChannelBinding("invalid"), /Invalid channel binding/);
  assert.throws(() => normalizeProjectExecution("invalid"), /Invalid project execution mode/);
  assert.equal(normalizeChannelBinding("none"), null);
  assert.equal(normalizeProjectExecution("sequential"), "sequential");
});
