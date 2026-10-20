/** Defines review/test policies and type-safe selectors of authoritative issue fields. */

import type { ValueOf } from "../../../shared/types.js";
import {
  REVIEW_POLICY,
  REVIEW_ROUTING_FIELD,
  ROUTING_LABELS,
  TEST_POLICY,
  TEST_ROUTING_FIELD,
} from "./const.js";

/** Union type for review policy (human, agent, or skip). */
export type ReviewPolicy = ValueOf<typeof REVIEW_POLICY>;

/** Union type for test policy (skip or agent). */
export type TestPolicy = ValueOf<typeof TEST_POLICY>;

/** Union of possible routing label strings (e.g. review:human, test:agent). */
export type RoutingLabel = ValueOf<typeof ROUTING_LABELS>;

/** Selects a saved review policy for workflow eligibility or a transition recheck. */
type ReviewPolicyRouting = {
  /** Local issue field holding the saved review policy. */
  field: typeof REVIEW_ROUTING_FIELD;
  /** Expected review policy. */
  value: ReviewPolicy;
};

/** Selects a saved test policy for workflow eligibility or a transition recheck. */
type TestPolicyRouting = {
  /** Local issue field holding the saved test policy. */
  field: typeof TEST_ROUTING_FIELD;
  /** Expected test policy. */
  value: TestPolicy;
};

/** Saved policy selector pairing each local field with its allowed policy values. */
export type WorkflowPolicyRouting = ReviewPolicyRouting | TestPolicyRouting;
