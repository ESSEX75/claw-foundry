/** Closed topic contract derived from the guidance protocol registry. */

import type { WORKFLOW_GUIDE_TOPICS } from "./const.js";

/** Valid guide topic selected at the SDK boundary. */
export type WorkflowGuideTopic = typeof WORKFLOW_GUIDE_TOPICS[number];
