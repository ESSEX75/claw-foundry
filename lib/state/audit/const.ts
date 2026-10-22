/** Owns diagnostic journal resources, rotation limits, warning cadence and lock policy. */

import type { FileLockOptions } from "../persistence/index.js";

/** Diagnostic journal retained at the existing workspace log location. */
export const AUDIT_FILE_NAME = "audit.log";

/** UTF-8 byte limit for the active file and each newly admitted record, including its newline. */
export const MAX_AUDIT_BYTES = 10 * 1024 * 1024;

/** Number of completed archive files retained in addition to the active journal. */
export const MAX_AUDIT_ARCHIVES = 5;

/** Filename prefix and suffix for immutable, monotonically numbered archives. */
export const AUDIT_ARCHIVE_PREFIX = "audit.";

/** Extension of archived NDJSON files. */
export const AUDIT_ARCHIVE_SUFFIX = ".log";

/** Fixed width preserves numeric archive ordering in file listings. */
export const AUDIT_ARCHIVE_SEQUENCE_WIDTH = 16;

/** Only canonical archive names participate in retention; unrelated files are preserved. */
export const AUDIT_ARCHIVE_PATTERN = /^audit\.(\d{16})\.log$/;

/** Durable plan connecting the source journal, archive and replacement record. */
export const AUDIT_ROTATION_FILE_NAME = "audit.rotation.json";

/** Exact-byte source digest used to resume an interrupted rotation without guessing. */
export const AUDIT_DIGEST_PATTERN = /^[a-f0-9]{64}$/;

/** At most one warning per process per minute, across all workspaces and failure kinds. */
export const AUDIT_WARNING_INTERVAL_MS = 60_000;

/** Bounded contention wait; a live writer never expires due to age alone. */
export const AUDIT_LOCK_OPTIONS: FileLockOptions = {
  retryMs: 10,
  staleMs: 30_000,
  timeoutMs: 10_000,
};
