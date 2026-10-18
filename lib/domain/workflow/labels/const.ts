/** Owns catalog colors and the complete set of provisioned policy labels. */

import { ROUTING_LABELS } from "../routing/index.js";

/** Default colors per role for role:level labels. */
export const ROLE_LABEL_COLORS = {
  /** Green label color for developer role. */
  DEVELOPER: "#0e8a16",
  /** Purple label color for tester role. */
  TESTER: "#5319e7",
  /** Blue label color for architect role. */
  ARCHITECT: "#0075ca",
  /** Orange label color for reviewer role. */
  REVIEWER: "#d93f0b",
} as const;

/** Color used for workflow step routing labels. */
export const STEP_ROUTING_COLOR = "#d93f0b";

/** Default fallback color for unknown roles. */
export const DEFAULT_ROLE_LABEL_COLOR = "#cccccc";

/** Provider-label catalog for every supported workflow routing policy. */
export const STEP_ROUTING_LABELS = Object.values(ROUTING_LABELS);
