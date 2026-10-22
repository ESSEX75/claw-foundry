/** Owns contracts for project-routing. */

/** Stable diagnostic codes produced by strict route validation. */
export const ROUTE_DIAGNOSTIC_CODE = {
  AGENT_NOT_FOUND: "route.agent_not_found",
  CHANNEL_NOT_FOUND: "route.channel_not_found",
  CHANNEL_DISABLED: "route.channel_disabled",
  ACCOUNT_DISABLED: "route.account_disabled",
  BINDING_CONFLICT: "route.binding_conflict",
  ACCOUNT_NOT_FOUND: "route.account_not_found",
  BINDING_NOT_FOUND: "route.binding_not_found",
  BINDING_AGENT_MISMATCH: "route.binding_agent_mismatch",
  DESTINATION_CONFLICT: "route.destination_conflict",
} as const;

/** OpenClaw peer kinds accepted for exact notification destinations. */
export const ROUTE_PEER_KIND = {
  DIRECT: "direct",
  GROUP: "group",
  CHANNEL: "channel",
} as const;
