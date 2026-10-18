/** Owns saved workflow policy identifiers and their provider-label protocol. */

import type { ValueOf } from "../../../types.js";

/** Managed workflow policy label namespaces shared by rendering, parsing, and provider effects. */
export const POLICY_LABEL_PREFIX = {
  REVIEW: "review:",
  TEST: "test:",
} as const;

/** Routing labels applied to issues to delegate tests or reviews. */
export const ROUTING_LABELS = {
  /** Require human code review. */
  REVIEW_HUMAN: "review:human",
  /** Delegate code review to an AI reviewer agent. */
  REVIEW_AGENT: "review:agent",
  /** Skip code review step. */
  REVIEW_SKIP: "review:skip",
  /** Skip testing step. */
  TEST_SKIP: "test:skip",
  /** Delegate testing to an AI QA agent. */
  TEST_AGENT: "test:agent",
} as const;

/** Review policy for PR review after developer completion. */
export const REVIEW_POLICY = {
  /** Code review delegated to human engineer. */
  HUMAN: "human",
  /** Code review delegated to AI agent. */
  AGENT: "agent",
  /** Code review skipped. */
  SKIP: "skip",
} as const;

/** Test policy for automated testing after review. */
export const TEST_POLICY = {
  /** Automated testing skipped. */
  SKIP: "skip",
  /** Automated testing delegated to AI agent. */
  AGENT: "agent",
} as const;

/** Saved review-policy field used for local workflow selection and rechecks. */
export const REVIEW_ROUTING_FIELD = "reviewPolicy";

/** Saved test-policy field used for local workflow selection and rechecks. */
export const TEST_ROUTING_FIELD = "testPolicy";

/** Exhaustive review-policy projection shared by rendering and explicit import. */
export const REVIEW_ROUTING_LABELS: Readonly<Record<ValueOf<typeof REVIEW_POLICY>, ValueOf<typeof ROUTING_LABELS>>> = {
  [REVIEW_POLICY.HUMAN]: ROUTING_LABELS.REVIEW_HUMAN,
  [REVIEW_POLICY.AGENT]: ROUTING_LABELS.REVIEW_AGENT,
  [REVIEW_POLICY.SKIP]: ROUTING_LABELS.REVIEW_SKIP,
};

/** Exhaustive test-policy projection shared by rendering and explicit import. */
export const TEST_ROUTING_LABELS: Readonly<Record<ValueOf<typeof TEST_POLICY>, ValueOf<typeof ROUTING_LABELS>>> = {
  [TEST_POLICY.SKIP]: ROUTING_LABELS.TEST_SKIP,
  [TEST_POLICY.AGENT]: ROUTING_LABELS.TEST_AGENT,
};
