/** Defines filesystem identifiers shared by state persistence primitives. */

/** Suffix appended to a protected state file to derive its lock path. */
export const LOCK_FILE_SUFFIX = ".lock";

/** Suffix identifying an incomplete sibling used during atomic replacement. */
export const TEMPORARY_FILE_SUFFIX = ".tmp";

/** Prefix for unpublished ownership directories prepared beside their lock. */
export const LOCK_CLAIM_SUFFIX = ".claim-";

/** Extension of the uniquely named ownership marker within a lock directory. */
export const LOCK_RECORD_EXTENSION = ".json";

/** Encoding used by persisted text documents and registries. */
export const STATE_TEXT_ENCODING = "utf-8";

/** Filesystem outcomes that repositories explicitly handle. */
export const FILESYSTEM_ERROR_CODE = {
  NOT_FOUND: "ENOENT",
  ALREADY_EXISTS: "EEXIST",
} as const;

/** Exclusive create mode preserving existing workspace files. */
export const CREATE_ONLY_FILE_FLAG = "wx";
