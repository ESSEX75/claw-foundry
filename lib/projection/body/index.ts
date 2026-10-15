/** Supported deterministic body composition and compact identity verification API. */

export { composeIssueCreationBody, composeManagedIssueBody, stripManagedIssueBody } from "./compose.js";
export { extractIssueCreationMarker, renderIssueCreationMarker } from "./creation-marker.js";
export { extractIssueMetadata, metadataMatches, renderIssueMetadata, replaceIssueMetadata } from "./metadata.js";
export type { ProjectionMetadata } from "./types.js";
