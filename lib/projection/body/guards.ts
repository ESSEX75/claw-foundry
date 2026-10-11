/** Validates untrusted provider metadata against the compact positive issue identity contract. */

import type { ProjectionMetadata } from "./types.js";

/** Validate identity fields without trusting extra provider-supplied properties.
 * @param value - Unknown JSON decoded from a provider body block.
 */
export function isProjectionMetadata(value: unknown): value is ProjectionMetadata {
  if (typeof value !== "object" || value === null) return false;
  if (!("projectSlug" in value) || typeof value.projectSlug !== "string" || !value.projectSlug.trim()) return false;
  if (!("issueId" in value) || typeof value.issueId !== "number") return false;

  return Number.isSafeInteger(value.issueId) && value.issueId > 0;
}
