/** Validates unknown values against the workflow routing-policy registries. */

import { REVIEW_POLICY, TEST_POLICY } from "./const.js";
import type { ReviewPolicy, TestPolicy } from "./types.js";

/**
 * Check whether a value matches a supported review policy.
 *
 * @param value - Untrusted value to validate.
 */
export function isReviewPolicy(value: unknown): value is ReviewPolicy {
  return typeof value === "string" && Object.values(REVIEW_POLICY).some((policy) => policy === value);
}

/**
 * Check whether a value matches a supported test policy.
 *
 * @param value - Untrusted value to validate.
 */
export function isTestPolicy(value: unknown): value is TestPolicy {
  return typeof value === "string" && Object.values(TEST_POLICY).some((policy) => policy === value);
}
