/** Composes user content with application-supplied identity for creation and managed edits. */

import { appendManagedBodyBlock, removeManagedBodyBlocks } from "./blocks.js";
import { ISSUE_BODY_CREATION_ID, ISSUE_BODY_METADATA_ID } from "./const.js";
import { renderIssueCreationMarker } from "./creation-marker.js";
import { replaceIssueMetadata } from "./metadata.js";
import type { ProjectionMetadata } from "./types.js";

/** Remove submitted managed blocks while retaining user text; unsafe framing throws.
 * @param body - Submitted or provider content to interpret without trusting its managed fields.
 */
export function stripManagedIssueBody(body: string): string {
  return removeManagedBodyBlocks(body, [ISSUE_BODY_METADATA_ID, ISSUE_BODY_CREATION_ID]);
}

/** Compose a pre-create body before a provider issue ID exists, discarding copied identity.
 * @param userBody - Original submitted description, retained separately for idempotency.
 * @param operationId - Durable creation identity bound to the current operation.
 */
export function composeIssueCreationBody(userBody: string, operationId: string): string {
  return appendManagedBodyBlock(stripManagedIssueBody(userBody), renderIssueCreationMarker(operationId));
}

/** Rebuild metadata and optional creation identity exclusively from trusted application inputs.
 * Nested or unterminated managed blocks throw; callers own all provider effects.
 * @param userBody - Requested content, possibly copied from another provider issue.
 * @param metadata - Authoritative identity derived from local state.
 * @param creationOperationId - Trusted durable creation identity, omitted when none exists locally.
 */
export function composeManagedIssueBody(userBody: string, metadata: ProjectionMetadata, creationOperationId?: string | null): string {
  const content = creationOperationId ? composeIssueCreationBody(userBody, creationOperationId) : stripManagedIssueBody(userBody);

  return replaceIssueMetadata(content, metadata);
}
