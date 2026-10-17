/** SDK resource layout used only by the OpenClaw agent provisioning adapter. */

/** Named agent resources below the SDK-resolved state root. */
export const AGENTS_DIRECTORY = "agents";

/** Agent-local configuration directory. */
export const AGENT_DIRECTORY = "agent";

/** Explicit workspace assigned to newly registered agents. */
export const WORKSPACE_DIRECTORY = "workspace";

/** Agent transcript directory beside its default configuration directory. */
export const SESSIONS_DIRECTORY = "sessions";

/** New names are normalized by the caller before reaching the resource boundary. */
export const NEW_AGENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
