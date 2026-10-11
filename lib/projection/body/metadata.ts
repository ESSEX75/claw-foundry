/** Renders, verifies, and replaces compact local identity in provider body metadata. */

import { appendManagedBodyBlock, readSingleManagedBodyPayload, removeManagedBodyBlocks } from "./blocks.js";
import { ISSUE_BODY_BLOCK_PREFIX, ISSUE_BODY_BLOCK_SUFFIX, ISSUE_BODY_METADATA_ID } from "./const.js";
import { isProjectionMetadata } from "./guards.js";
import type { ProjectionMetadata } from "./types.js";

/** Render only supported identity fields, escaping HTML framing characters inside JSON.
 * @param metadata - Trusted identity derived from local state by the application.
 */
export function renderIssueMetadata(metadata: ProjectionMetadata): string {
  const payload = JSON.stringify({ projectSlug: metadata.projectSlug, issueId: metadata.issueId })
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  return `${ISSUE_BODY_BLOCK_PREFIX}${ISSUE_BODY_METADATA_ID} ${payload}${ISSUE_BODY_BLOCK_SUFFIX}`;
}

/** Read one valid identity; ambiguous, malformed, or unterminated blocks return null.
 * Extra JSON fields are discarded and never become runtime authority.
 * @param body - Untrusted provider issue description.
 */
export function extractIssueMetadata(body: string): ProjectionMetadata | null {
  try {
    const raw = readSingleManagedBodyPayload(body, ISSUE_BODY_METADATA_ID);

    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);

    return isProjectionMetadata(value) ? { projectSlug: value.projectSlug, issueId: value.issueId } : null;
  } catch {
    return null;
  }
}

/** Replace every closed metadata block with one trusted identity, retaining other content.
 * Nested or unterminated managed comments throw rather than consume unknown user text.
 * @param body - Current provider description to repair.
 * @param metadata - Authoritative local identity to project.
 */
export function replaceIssueMetadata(body: string, metadata: ProjectionMetadata): string {
  const content = removeManagedBodyBlocks(body, [ISSUE_BODY_METADATA_ID]);

  return appendManagedBodyBlock(content, renderIssueMetadata(metadata));
}

/** Compare observed compact identity with the application-supplied local identity.
 * @param metadata - Valid extracted identity, or null for absent or ambiguous evidence.
 * @param expected - Identity derived from authoritative local state.
 */
export function metadataMatches(metadata: ProjectionMetadata | null, expected: ProjectionMetadata): boolean {
  return metadata !== null && metadata.projectSlug === expected.projectSlug && metadata.issueId === expected.issueId;
}
