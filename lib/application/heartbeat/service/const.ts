/** Stable service identity, configuration key, and timer limits. */

/** Built-in agent when no explicit inventory exists. */
export const HEARTBEAT_AGENT_ID = { MAIN: "main" } as const;

/** Scheduled service identity and startup delay. */
export const HEARTBEAT_SERVICE = { ID: "devclaw-heartbeat", STARTUP_DELAY_MS: 2_000 } as const;
