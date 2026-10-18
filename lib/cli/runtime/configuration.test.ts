/** Verifies workspace selection without hiding SDK configuration failures. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSetupRuntime } from "../../testing/index.js";
import { requireWorkspace } from "./configuration.js";

describe("CLI runtime configuration", () => {
  it("resolves explicit workspaces independently of SDK failures", () => {
    const fixture = createSetupRuntime();

    fixture.runtime.config.current = () => { throw new Error("SDK read failed"); };
    assert.equal(requireWorkspace("explicit-workspace", fixture.runtime), "explicit-workspace");
    assert.throws(() => requireWorkspace(undefined, fixture.runtime), /Unable to read OpenClaw configuration/);
    assert.throws(() => requireWorkspace(" ", fixture.runtime), /Workspace path is required/);
  });
});
