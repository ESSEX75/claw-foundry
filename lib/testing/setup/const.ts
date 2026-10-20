/** Owns SDK setup fixture resource identity and default scope evidence. */

/** In-memory configuration snapshot resource, never an actual file path. */
export const CONFIG_SNAPSHOT_PATH = "test";

/** Serialized successful scope approval returned by the fake setup transport. */
export const APPROVED_SCOPES_RESPONSE = JSON.stringify({ status: "approved", approved: ["operator.read", "operator.write"] });
