/** Owns the plugin identity shared by registration, configuration, CLI, and protocol namespaces. */

/** Stable plugin identifier and namespace; agent addresses and storage paths have separate contracts. */
export const CLAW_FOUNDRY_PLUGIN_ID = "claw-foundry";

/** Persisted upstream protocol namespace; changing it would orphan issue markers and replay receipts. */
export const PERSISTED_PROTOCOL_NAMESPACE = "devclaw";
