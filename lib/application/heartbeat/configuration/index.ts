/** Shared read-only settings API; importing it never registers or runs the heartbeat service. */

export { MILLISECONDS_PER_SECOND } from "./const.js";
export { HEARTBEAT_DEFAULTS } from "./defaults.js";
export { resolveHeartbeatConfig } from "./resolve.js";
export type { HeartbeatConfig } from "./types.js";
