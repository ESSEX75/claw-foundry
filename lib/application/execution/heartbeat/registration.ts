/** Composes the timer lifecycle with project maintenance without reverse service dependencies. */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { PluginContext } from "../../../context.js";
import { createHeartbeatLifecycle, HEARTBEAT_SERVICE } from "./service/index.js";
import { tick } from "./tick-runner.js";

/** Register the configured heartbeat timer with the exact project coordinator.
 * @param api - OpenClaw plugin registration boundary.
 * @param pluginCtx - Current plugin transport and runtime dependencies.
 */
export function registerHeartbeatService(api: OpenClawPluginApi, pluginCtx: PluginContext): void {
  api.registerService({ id: HEARTBEAT_SERVICE.ID, ...createHeartbeatLifecycle(pluginCtx, undefined, tick) });
}
