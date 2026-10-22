/** Owns configuration fixture snapshots and captured commit evidence. */

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import type { SetupRuntime } from "../../application/index.js";
import type { RunCommand } from "../../context.js";

/** One committed configuration snapshot retained independently from later mutations. */
export type SetupWrite = {
  /** Complete configuration after the mutation. */
  nextConfig: OpenClawConfig;
  /** Reload policy passed to the SDK boundary. */
  afterWrite: Parameters<SetupRuntime["config"]["mutateConfigFile"]>[0]["afterWrite"];
};

/** Isolated SDK configuration transport plus captured effects. */
export type SetupFixture = {
  /** Runtime consumed by real setup use cases. */
  runtime: SetupRuntime;
  /** Fake command transport recording scope requests. */
  runCommand: RunCommand;
  /** Successful changed configuration commits in order. */
  writes: SetupWrite[];
  /** External command arguments captured at invocation. */
  commands: string[][];
};
