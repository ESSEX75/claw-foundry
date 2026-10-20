/** Exposes shared error diagnostics and structural guards without layer dependencies. */

export { hasErrorCode } from "./guards.js";
export { getErrorMessage } from "./message.js";
export type { CodedError } from "./types.js";
