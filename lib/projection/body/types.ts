/** Owns compact body identity and internal managed-comment identifiers. */

import type { IssueRuntimeState } from "../../domain/index.js";
import type { ISSUE_BODY_CREATION_ID, ISSUE_BODY_METADATA_ID } from "./const.js";

/** Compact local identity; body metadata cannot carry workflow or worker authority. */
export type ProjectionMetadata = Pick<IssueRuntimeState, "projectSlug" | "issueId">;

/** Internal block kinds recognized by this capability, not an external extension point. */
export type ManagedBodyBlockId = typeof ISSUE_BODY_METADATA_ID | typeof ISSUE_BODY_CREATION_ID;
