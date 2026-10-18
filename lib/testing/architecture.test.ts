/** Verifies forbidden setup adapter dependencies across POSIX and Windows paths. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkApplicationAggregation, checkApplicationApiBoundary, checkApplicationDependencyDirection, checkCliApiBoundary, checkApplicationAdapterBoundary, checkToolsApiBoundary } from "../../scripts/architecture-rules.js";

describe("setup architecture boundaries", () => {
  it("rejects state and filesystem imports in all migrated adapters", () => {
    for (const source of ["lib/tools/setup/setup.ts", "lib/tools/setup/config.ts", "lib/tools/setup/onboard.ts", "lib/cli/commands/setup/register.ts", "lib/cli/commands/doctor/register.ts", "lib/cli/commands/issues/archive.ts", "lib/cli/commands/issues/delete.ts", "lib/cli/commands/issues/reset.ts"]) {
      for (const name of [source, source.replaceAll("/", "\\")]) {
        assert.ok(checkApplicationAdapterBoundary(name, "state", "../../state/index.js"));
        for (const specifier of ["node:fs", "node:fs/promises", "fs", "fs/promises"]) {
          assert.ok(checkApplicationAdapterBoundary(name, undefined, specifier));
        }
        assert.equal(checkApplicationAdapterBoundary(name, "application", "../../application/index.js"), null);
      }
    }
  });
  it("allows filesystem persistence inside its owning layer", () => {
    assert.equal(checkApplicationAdapterBoundary("lib/state/setup/workspace-files.ts", undefined, "node:fs/promises"), null);
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

it("enforces CLI facade, siblings and ancestor boundaries across Windows and POSIX paths", () => {
  for (const separator of ["/", "\\"]) {
    const path = (value: string) => value.replaceAll("/", separator);
    assert.ok(checkCliApiBoundary(path("index.ts"), path("lib/cli/register.ts")));
    assert.equal(checkCliApiBoundary(path("index.ts"), path("lib/cli/index.ts")), null);
    assert.ok(checkCliApiBoundary(path("lib/tools/setup/setup.test.ts"), path("lib/cli/commands/setup/register.ts")));
    assert.ok(checkCliApiBoundary(path("lib/cli/commands/setup/register.ts"), path("lib/cli/index.ts")));
    assert.ok(checkCliApiBoundary(path("lib/cli/commands/setup/register.ts"), path("lib/cli/commands/setup/index.ts")));
    assert.ok(checkCliApiBoundary(path("lib/cli/commands/setup/nested/file.ts"), path("lib/cli/commands/setup/index.ts")));
    assert.ok(checkCliApiBoundary(path("lib/cli/commands/issues/delete.ts"), path("lib/cli/parsing/parsers.ts")));
    assert.equal(checkCliApiBoundary(path("lib/cli/commands/issues/delete.ts"), path("lib/cli/parsing/index.ts")), null);
    assert.equal(checkCliApiBoundary(path("lib/cli/commands/setup/register.ts"), path("lib/cli/commands/setup/models.ts")), null);
    assert.equal(checkCliApiBoundary(path("lib/cli/commands/setup/index.ts"), path("lib/cli/commands/setup/register.ts")), null);
    assert.equal(checkCliApiBoundary(path("lib/cli/register.ts"), path("lib/cli/commands/setup/index.ts")), null);
    assert.equal(checkCliApiBoundary(path("lib/cli/commands/repair/issue.ts"), path("lib/cli/const.ts")), null);
    assert.ok(checkCliApiBoundary(path("lib/cli/commands/issues/delete.ts"), path("lib/cli/runtime/configuration.ts")));
    assert.equal(checkCliApiBoundary(path("lib/cli/commands/issues/delete.ts"), path("lib/cli/runtime/index.ts")), null);
    assert.ok(checkCliApiBoundary(path("lib/cli/parsing/parsers.ts"), path("lib/cli/runtime/index.ts")));
    assert.ok(checkCliApiBoundary(path("lib/cli/parsing/parsers.ts"), path("lib/cli/commands/issues/index.ts")));
    assert.ok(checkCliApiBoundary(path("lib/cli/runtime/configuration.ts"), path("lib/cli/commands/setup/index.ts")));
    assert.equal(checkCliApiBoundary(path("lib/cli/runtime/index.ts"), path("lib/cli/runtime/configuration.ts")), null);
  }
});

it("enforces application public, sibling, child and ancestor APIs on Windows and POSIX paths", () => {
  for (const separator of ["/", "\\"]) {
    const path = (value: string) => value.replaceAll("/", separator);
    const check = (source: string, target: string) => checkApplicationApiBoundary(path(source), path(target));

    assert.ok(check("lib/tools/worker/work-finish.ts", "lib/application/pipeline/completion.ts"));
    assert.equal(check("index.ts", "lib/application/index.ts"), null);
    assert.ok(check("lib/application/queue/tick.ts", "lib/application/index.ts"));
    assert.ok(check("lib/application/workers/dispatch/dispatch-task.ts", "lib/application/workers/index.ts"));
    assert.ok(check("lib/application/workers/dispatch/plan.ts", "lib/application/workers/dispatch/index.ts"));
    assert.ok(check("lib/application/heartbeat/tick-runner.ts", "lib/application/queue/tick.ts"));
    assert.equal(check("lib/application/heartbeat/tick-runner.ts", "lib/application/queue/index.ts"), null);
    assert.ok(check("lib/application/tasks/research/command.ts", "lib/application/tasks/creation/command.ts"));
    assert.equal(check("lib/application/tasks/research/command.ts", "lib/application/tasks/creation/index.ts"), null);
    assert.equal(check("lib/application/workers/dispatch/dispatch-context.ts", "lib/application/tasks/context/index.ts"), null);
    assert.ok(check("lib/application/workers/dispatch/dispatch-context.ts", "lib/application/tasks/context/selection.ts"));
    assert.equal(check("lib/application/setup/plugin-config.ts", "lib/application/heartbeat/configuration/index.ts"), null);
    assert.ok(check("lib/application/setup/plugin-config.ts", "lib/application/heartbeat/configuration/defaults.ts"));
    assert.equal(check("lib/application/workers/dispatch/dispatch-task.ts", "lib/application/workers/session-budget.ts"), null);
    assert.equal(check("lib/application/setup/routing/binding-manager.ts", "lib/application/setup/types.ts"), null);
    assert.equal(check("lib/application/setup/types.ts", "lib/application/setup/routing/types.ts"), null);
    assert.ok(check("lib/application/tasks/research/command.ts", "lib/application/tasks/hidden.ts"));
    assert.ok(check("lib/application/heartbeat/service/agent-runner.ts", "lib/application/heartbeat/tick-runner.ts"));
  }
});

it("rejects hand-picked child aggregation while retaining leaf exports and the setup facade", () => {
  const named = 'export { startTask } from "./lifecycle/index.js";';

  assert.ok(checkApplicationAggregation("lib/application/tasks/index.ts", named));
  assert.equal(checkApplicationAggregation("lib/application/tasks/index.ts", 'export * from "./lifecycle/index.js";'), null);
  assert.equal(checkApplicationAggregation("lib/application/setup/index.ts", named), null);
  assert.equal(checkApplicationAggregation("lib/application/tasks/lifecycle/index.ts", 'export { startTask } from "./start-task.js";'), null);
});
