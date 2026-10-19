/** Owns contracts for planning. */

import type { CompletionRule, TransitionAction } from "../../../../domain/index.js";

/** A validated workflow transition with its provider actions. */
export type TransitionPlan = {
  /** Source state label expected before any provider effect. */
  from: string;
  /** Resolved destination state key. */
  toState: string;
  /** Resolved destination label. */
  toLabel: string;
  /** Actions selected by the configured workflow event. */
  actions: readonly TransitionAction[];
};

/** Planned agent completion, including its configured result description. */
export type CompletionPlan = {
  /** Configured completion event for the role result. */
  event: string;
  /** Rule selected from the resolved workflow. */
  rule: CompletionRule<string>;
  /** State transition selected by that rule. */
  transition: TransitionPlan;
  /** Description used by the completion announcement. */
  nextState: string;
};
