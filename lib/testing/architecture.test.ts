/** Verifies forbidden setup adapter dependencies across POSIX and Windows paths. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkApplicationDependencyDirection, checkSetupAdapterBoundary, checkToolsApiBoundary } from "../../scripts/architecture-rules.js";

describe("setup architecture boundaries", () => {
  it("rejects state and filesystem imports in all migrated adapters", () => {
    for (const source of ["lib/tools/setup/setup.ts", "lib/tools/setup/config.ts", "lib/tools/setup/onboard.ts", "lib/cli/commands/setup-command.ts", "lib/cli/commands/doctor-command.ts", "lib/cli/commands/issues-archive-command.ts"]) {
      for (const name of [source, source.replaceAll("/", "\\")]) {
        assert.ok(checkSetupAdapterBoundary(name, "state", "../../state/index.js"));
        for (const specifier of ["node:fs", "node:fs/promises", "fs", "fs/promises"]) {
          assert.ok(checkSetupAdapterBoundary(name, undefined, specifier));
        }
        assert.equal(checkSetupAdapterBoundary(name, "application", "../../application/index.js"), null);
      }
    }
  });
  it("allows filesystem persistence inside its owning layer", () => {
    assert.equal(checkSetupAdapterBoundary("lib/state/setup/workspace-files.ts", undefined, "node:fs/promises"), null);
  });
});

it("rejects reverse dependencies from state and application into their callers", () => {
  assert.ok(checkApplicationDependencyDirection("state", "application"));
  for (const layer of ["tools", "cli"]) {
    assert.ok(checkApplicationDependencyDirection("state", layer));
    assert.ok(checkApplicationDependencyDirection("application", layer));
    assert.equal(checkApplicationDependencyDirection(layer, "application"), null);
  }
  assert.equal(checkApplicationDependencyDirection("application", "state"), null);
});

it("enforces tools root, sibling and ancestor boundaries across Windows and POSIX paths", () => {
  for (const separator of ["/", "\\"]) {
    const path = (value: string) => value.replaceAll("/", separator);
    assert.ok(checkToolsApiBoundary(path("index.ts"), path("lib/tools/registration/registry.ts")));
    assert.equal(checkToolsApiBoundary(path("index.ts"), path("lib/tools/index.ts")), null);
    assert.ok(checkToolsApiBoundary(path("lib/tools/setup/setup.ts"), path("lib/tools/index.ts")));
    assert.ok(checkToolsApiBoundary(path("lib/tools/tasks/lifecycle/task-start.ts"), path("lib/tools/tasks/index.ts")));
    assert.ok(checkToolsApiBoundary(path("lib/tools/registration/registry.ts"), path("lib/tools/tasks/lifecycle/index.ts")));
    assert.equal(checkToolsApiBoundary(path("lib/tools/registration/registry.ts"), path("lib/tools/tasks/index.ts")), null);
    assert.ok(checkToolsApiBoundary(path("lib/tools/channels/channel-link.ts"), path("lib/tools/context/resolution.ts")));
    assert.equal(checkToolsApiBoundary(path("lib/tools/channels/channel-link.ts"), path("lib/tools/context/index.ts")), null);
    assert.equal(checkToolsApiBoundary(path("lib/tools/guidance/workflow-guide.ts"), path("lib/tools/guidance/schema.ts")), null);
  }
});
