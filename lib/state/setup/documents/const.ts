/** Owns filesystem and protocol identifiers for setup documents. */

import type { FileLockOptions } from "../../persistence/index.js";

/** Suffix used for recoverable backups created during explicit replacement. */
export const BACKUP_FILE_SUFFIX = ".bak";

/** Shared lock policy for create, patch, refresh and reset of one document. */
export const DOCUMENT_LOCK_OPTIONS: FileLockOptions = {
  retryMs: 20,
  staleMs: 30_000,
  timeoutMs: 10_000,
};
