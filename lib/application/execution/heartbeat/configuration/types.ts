/** Validated heartbeat scheduling configuration shared by setup and service composition. */

/** Validated heartbeat schedule and pickup budget. */
export type HeartbeatConfig = {
  /** Whether periodic service ticks are enabled. */
  enabled: boolean;
  /** Interval between scheduled checks in seconds. */
  intervalSeconds: number;
  /** Maximum dispatches across all projects in one agent tick. */
  maxPickupsPerTick: number;
};
