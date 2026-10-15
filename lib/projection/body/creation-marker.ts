/** Encodes durable creation identity without deciding publication or recovery eligibility. */

import { readSingleManagedBodyPayload } from "./blocks.js";
import { ISSUE_BODY_BLOCK_PREFIX, ISSUE_BODY_BLOCK_SUFFIX, ISSUE_BODY_CREATION_ID, ISSUE_CREATION_ID_PATTERN } from "./const.js";

/** Render a creation identifier using the durable marker protocol; invalid identifiers throw.
 * @param operationId - Trusted durable operation identity supplied by application code.
 */
export function renderIssueCreationMarker(operationId: string): string {
  if (!ISSUE_CREATION_ID_PATTERN.test(operationId)) throw new Error("Invalid issue creation operation identifier.");

  return `${ISSUE_BODY_BLOCK_PREFIX}${ISSUE_BODY_CREATION_ID} ${operationId}${ISSUE_BODY_BLOCK_SUFFIX}`;
}

/** Read a single valid creation marker; ambiguity or malformed framing returns null.
 * @param body - Provider description used only as creation verification evidence.
 */
export function extractIssueCreationMarker(body: string): string | null {
  try {
    const value = readSingleManagedBodyPayload(body, ISSUE_BODY_CREATION_ID);

    return value !== null && ISSUE_CREATION_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}
