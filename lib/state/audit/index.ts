/** Exposes best-effort diagnostic persistence while keeping lock and retention mechanics internal. */

export { log } from "./repository.js";
export type { AuditEntry, AuditWarningReporter } from "./types.js";
export { configureAuditWarnings } from "./warnings.js";
