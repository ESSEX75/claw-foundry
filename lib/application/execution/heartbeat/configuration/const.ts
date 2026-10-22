/** Protocol fields and timing limits owned by heartbeat configuration. */

/** OpenClaw plugin setting read by the heartbeat configuration boundary. */
export const HEARTBEAT_CONFIG_KEY = "work_heartbeat";

/** Field names accepted inside the heartbeat plugin setting. */
export const HEARTBEAT_CONFIG_FIELD = {
  ENABLED: "enabled",
  INTERVAL_SECONDS: "intervalSeconds",
  MAX_PICKUPS_PER_TICK: "maxPickupsPerTick",
} as const;

/** Maximum signed 32-bit timer delay accepted by Node without interval rollover. */
export const HEARTBEAT_TIMER_MAX_MS = 2_147_483_647;

/** Milliseconds in one second for validating and scheduling heartbeat timers. */
export const MILLISECONDS_PER_SECOND = 1_000;
