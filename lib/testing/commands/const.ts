/** Owns the gateway command framing understood by the test recorder. */

/** Executable whose gateway invocations carry structured metadata. */
export const OPENCLAW_EXECUTABLE = "openclaw";

/** Gateway command group used by worker transports. */
export const GATEWAY_COMMAND = "gateway";

/** RPC invocation subcommand. */
export const GATEWAY_CALL_COMMAND = "call";

/** Argument introducing serialized RPC parameters. */
export const GATEWAY_PARAMS_FLAG = "--params";

/** Worker submission RPC method. */
export const AGENT_RPC_METHOD = "agent";

/** Session mutation RPC method. */
export const SESSION_PATCH_RPC_METHOD = "sessions.patch";
