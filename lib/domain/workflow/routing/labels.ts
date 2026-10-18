/** Projects validated saved review/test policies into canonical provider labels. */

import { REVIEW_ROUTING_LABELS, TEST_ROUTING_LABELS } from "./const.js";
import type { ReviewPolicy, RoutingLabel, TestPolicy } from "./types.js";

/**
 * Determine the review routing label for an issue from its resolved policy.
 *
 * @param policy - Validated review policy selected for the issue.
 */
export function resolveReviewRouting(policy: ReviewPolicy): RoutingLabel {
  return REVIEW_ROUTING_LABELS[policy];
}

/** Resolve the provider-facing label for a saved test policy.
 * @param policy - Validated test policy selected for the issue.
 */
export function resolveTestRouting(policy: TestPolicy): RoutingLabel {
  return TEST_ROUTING_LABELS[policy];
}
