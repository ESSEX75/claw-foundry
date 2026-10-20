/** Verifies package ownership and adapter dependency boundaries across POSIX and Windows paths. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkApplicationAggregation, checkApplicationApiBoundary, checkApplicationDependencyDirection, checkCliApiBoundary, checkApplicationAdapterBoundary, checkSharedApiBoundary, checkToolsApiBoundary } from "../../scripts/architecture-rules.js";

it("keeps shared primitives independent and enforces their capability APIs on both platforms", () => {
  for (const separator of ["/", "\\"]) {
    const check = (source: string, target: string) => checkSharedApiBoundary(source.replaceAll("/", separator), target.replaceAll("/", separator));
    const formatter = "lib/shared/errors/message.ts";

    for (const target of ["index.ts", "lib/context.ts", "lib/domain/index.ts", "lib/state/index.ts", "lib/application/index.ts", "lib/integrations/index.ts", "lib/tools/index.ts", "lib/cli/index.ts", "lib/testing/index.ts"]) {
      assert.ok(check(formatter, target), target);
    }
    assert.equal(checkSharedApiBoundary(formatter, undefined), null);
    assert.equal(check(formatter, "lib/shared/errors/types.ts"), null);
    assert.equal(check(formatter, "lib/shared/hashing/index.ts"), null);
    assert.ok(check(formatter, "lib/shared/errors/index.ts"));
    assert.ok(check(formatter, "lib/shared/hashing/const.ts"));
    for (const source of ["index.ts", "lib/domain/workflow/types.ts", "lib/state/config/schema.ts", "lib/application/diagnostics/report.ts"]) {
      assert.equal(check(source, "lib/shared/types.ts"), null);
      assert.equal(check(source, "lib/shared/const.ts"), null);
      assert.ok(check(source, "lib/shared/index.ts"));
      for (const capability of ["errors", "hashing", "duration"]) {
        assert.equal(check(source, `lib/shared/${capability}/index.ts`), null);
        assert.ok(check(source, `lib/shared/${capability}/const.ts`));
        assert.ok(check(source, `lib/shared/${capability}/nested/index.ts`));
      }
    }
    assert.equal(check("lib/application/diagnostics/report.ts", "lib/state/index.ts"), null);
  }
});

describe("setup architecture boundaries", () => {
  it("rejects state and filesystem imports in all migrated adapters", () => {
    for (const source of ["lib/tools/adapters/setup/setup.ts", "lib/tools/adapters/setup/config.ts", "lib/tools/adapters/setup/onboard.ts", "lib/cli/commands/setup/register.ts", "lib/cli/commands/doctor/register.ts", "lib/cli/commands/issues/archive.ts", "lib/cli/commands/issues/delete.ts", "lib/cli/commands/issues/reset.ts"]) {
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
    assert.equal(checkApplicationAdapterBoundary("lib/state/setup/workspace/initialization.ts", undefined, "node:fs/promises"), null);
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
    assert.ok(checkToolsApiBoundary(path("lib/tools/adapters/setup/setup.ts"), path("lib/tools/registration/index.ts")));
    for (const capability of ["context", "validation"]) {
      const source = path(`lib/tools/${capability}/index.ts`);
      assert.ok(checkToolsApiBoundary(source, path("lib/tools/adapters/setup/index.ts")));
      assert.ok(checkToolsApiBoundary(source, path("lib/tools/registration/index.ts")));
    }
    assert.ok(checkToolsApiBoundary(path("lib/tools/adapters/setup/setup.ts"), path("lib/tools/adapters/setup/index.ts")));
    assert.ok(checkToolsApiBoundary(path("lib/tools/adapters/setup/setup.ts"), path("lib/tools/index.ts")));
    assert.ok(checkToolsApiBoundary(path("lib/tools/adapters/tasks/lifecycle/task-start.ts"), path("lib/tools/adapters/tasks/index.ts")));
    assert.ok(checkToolsApiBoundary(path("lib/tools/registration/registry.ts"), path("lib/tools/adapters/tasks/lifecycle/index.ts")));
    assert.equal(checkToolsApiBoundary(path("lib/tools/registration/registry.ts"), path("lib/tools/adapters/tasks/index.ts")), null);
    assert.ok(checkToolsApiBoundary(path("lib/tools/adapters/channels/channel-link.ts"), path("lib/tools/context/resolution.ts")));
    assert.equal(checkToolsApiBoundary(path("lib/tools/adapters/channels/channel-link.ts"), path("lib/tools/context/index.ts")), null);
    assert.equal(checkToolsApiBoundary(path("lib/tools/adapters/guidance/workflow-guide.ts"), path("lib/tools/adapters/guidance/schema.ts")), null);
  }
});

it("enforces CLI facade, siblings and ancestor boundaries across Windows and POSIX paths", () => {
  for (const separator of ["/", "\\"]) {
    const path = (value: string) => value.replaceAll("/", separator);
    assert.ok(checkCliApiBoundary(path("index.ts"), path("lib/cli/register.ts")));
    assert.equal(checkCliApiBoundary(path("index.ts"), path("lib/cli/index.ts")), null);
    assert.ok(checkCliApiBoundary(path("lib/tools/adapters/setup/setup.test.ts"), path("lib/cli/commands/setup/register.ts")));
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

    assert.ok(check("lib/tools/adapters/worker/work-finish.ts", "lib/application/execution/workflow/completion/completion.ts"));
    assert.equal(check("index.ts", "lib/application/index.ts"), null);
    assert.ok(check("lib/application/execution/scheduling/tick.ts", "lib/application/index.ts"));
    assert.ok(check("lib/application/execution/workers/dispatch/dispatch-task.ts", "lib/application/execution/workers/index.ts"));
    assert.ok(check("lib/application/execution/workers/dispatch/plan.ts", "lib/application/execution/workers/dispatch/index.ts"));
    assert.ok(check("lib/application/execution/heartbeat/tick-runner.ts", "lib/application/execution/scheduling/tick.ts"));
    assert.equal(check("lib/application/execution/heartbeat/tick-runner.ts", "lib/application/execution/scheduling/index.ts"), null);
    assert.ok(check("lib/application/issues/commands/research/command.ts", "lib/application/issues/commands/creation/command.ts"));
    assert.equal(check("lib/application/issues/commands/research/command.ts", "lib/application/issues/commands/creation/index.ts"), null);
    assert.equal(check("lib/application/execution/workers/dispatch/dispatch-context.ts", "lib/application/execution/context/index.ts"), null);
    assert.ok(check("lib/application/execution/workers/dispatch/dispatch-context.ts", "lib/application/execution/context/selection.ts"));
    assert.equal(check("lib/application/workspace/configuration/plugin-config.ts", "lib/application/execution/heartbeat/configuration/index.ts"), null);
    assert.ok(check("lib/application/workspace/configuration/plugin-config.ts", "lib/application/execution/heartbeat/configuration/defaults.ts"));
    assert.equal(check("lib/application/execution/workers/dispatch/dispatch-task.ts", "lib/application/execution/workers/session-budget.ts"), null);
    assert.equal(check("lib/application/workspace/bindings/binding-manager.ts", "lib/application/workspace/types.ts"), null);
    assert.equal(check("lib/application/workspace/types.ts", "lib/application/workspace/bindings/types.ts"), null);
    assert.ok(check("lib/application/issues/commands/research/command.ts", "lib/application/issues/commands/hidden.ts"));
    assert.ok(check("lib/application/execution/heartbeat/service/agent-runner.ts", "lib/application/execution/heartbeat/tick-runner.ts"));
  }
});

it("rejects hand-picked child aggregation while retaining leaf exports and the workspace facade", () => {
  const named = 'export { startTask } from "./activation/index.js";';

  assert.ok(checkApplicationAggregation("lib/application/issues/commands/index.ts", named));
  assert.equal(checkApplicationAggregation("lib/application/issues/commands/index.ts", 'export * from "./activation/index.js";'), null);
  assert.equal(checkApplicationAggregation("lib/application/workspace/index.ts", named), null);
  assert.equal(checkApplicationAggregation("lib/application/issues/commands/activation/index.ts", 'export { startTask } from "./start-task.js";'), null);
});

it("preserves capability boundaries across application groups on both platforms", () => {
  for (const separator of ["/", "\\"]) {
    const check = (source: string, target: string) => checkApplicationApiBoundary(source.replaceAll("/", separator), target.replaceAll("/", separator));
    const research = "lib/application/issues/commands/research/command.ts";
    const heartbeat = "lib/application/execution/heartbeat/maintenance-passes.ts";

    assert.equal(check(research, "lib/application/execution/workers/index.ts"), null);
    assert.ok(check(research, "lib/application/execution/workers/dispatch/index.ts"));
    assert.ok(check(research, "lib/application/execution/index.ts"));
    assert.equal(check(heartbeat, "lib/application/issues/commands/index.ts"), null);
    assert.ok(check(heartbeat, "lib/application/issues/commands/creation/command.ts"));
    assert.ok(check(heartbeat, "lib/application/issues/index.ts"));
    assert.ok(check("lib/application/issues/queries/list-tasks.ts", "lib/application/issues/commands/creation/command.ts"));
    assert.equal(check("lib/application/issues/queries/list-tasks.ts", "lib/application/issues/commands/index.ts"), null);
    assert.ok(check("lib/application/projects/registration/command.ts", "lib/application/projects/channels/commands.ts"));
    assert.equal(check("lib/application/projects/registration/command.ts", "lib/application/projects/routing/index.ts"), null);
    assert.ok(check("lib/application/workspace/setup/run-setup.ts", "lib/application/workspace/configuration/plugin-config.ts"));
    assert.equal(check("lib/application/workspace/setup/run-setup.ts", "lib/application/workspace/configuration/index.ts"), null);
    for (const group of ["workspace", "projects", "issues", "execution"]) {
      assert.ok(check("lib/tools/adapters/setup/setup.ts", `lib/application/${group}/index.ts`));
      assert.ok(check(`lib/application/${group}/nested/operation.ts`, `lib/application/${group}/index.ts`));
      assert.equal(check("lib/application/index.ts", `lib/application/${group}/index.ts`), null);
    }
    assert.equal(check("lib/application/issues/index.ts", "lib/application/issues/queries/index.ts"), null);
    assert.ok(check("lib/application/issues/index.ts", "lib/application/issues/queries/list-tasks.ts"));
    assert.ok(check("lib/application/diagnostics/report.ts", "lib/application/workspace/types.ts"));
  }
});
