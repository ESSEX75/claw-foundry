/** Owns the bounded diagnostic journal's filename, retention and lock policy. */

import type { FileLockOptions } from "../persistence/index.js";

/** Diagnostic journal retained at the existing workspace log location. */
export const AUDIT_FILE_NAME = "audit.log";

/** Maximum nonempty records retained after each successful publication. */
export const MAX_AUDIT_RECORDS = 50;

/** Bounded contention wait; a live writer never expires due to age alone. */
export const AUDIT_LOCK_OPTIONS: FileLockOptions = {
  retryMs: 10,
  staleMs: 30_000,
  timeoutMs: 10_000,
};
