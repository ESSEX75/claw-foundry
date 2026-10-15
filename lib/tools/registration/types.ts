/** Registration contract owned by the SDK tool composition boundary. */

import type { OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";

import type { PluginContext } from "../../context.js";

/** One supported SDK registration, preserving the factory's concrete tool result contract. */
export type ToolRegistryEntry = {
  /** Nonempty public names passed to the SDK registration API. */
  readonly names: readonly [string, ...string[]];
  /** Bind plugin capabilities to an SDK tool factory. */
  readonly factory: (ctx: PluginContext) => OpenClawPluginToolFactory;
};
