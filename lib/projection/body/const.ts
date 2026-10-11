/** Defines the managed HTML-comment protocol shared by body parsing and rendering. */

/** Reserved identity block identifier. */
export const ISSUE_BODY_METADATA_ID = "devclaw:issue-metadata";

/** Reserved durable creation-operation block identifier. */
export const ISSUE_BODY_CREATION_ID = "devclaw:issue-creation";

/** HTML comment opener used for canonical managed blocks. */
export const ISSUE_BODY_BLOCK_PREFIX = "<!-- ";

/** Canonical HTML comment closer shared by both block kinds. */
export const ISSUE_BODY_BLOCK_SUFFIX = " -->";

/** Any managed opener, including malformed or unterminated payloads. */
export const ISSUE_BODY_BLOCK_START_PATTERN = `<!-- (${ISSUE_BODY_METADATA_ID}|${ISSUE_BODY_CREATION_ID})\\b`;

/** Closed managed comments; opening counts detect nested or unterminated blocks. */
export const ISSUE_BODY_BLOCK_PATTERN = `${ISSUE_BODY_BLOCK_START_PATTERN}[\\s\\S]*?-->`;

/** Creation identifiers accepted by the existing durable marker protocol. */
export const ISSUE_CREATION_ID_PATTERN = /^[0-9a-f-]+$/;
