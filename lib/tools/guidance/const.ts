/** Topic protocol used by workflow guidance selection and its public input schema. */

/** Supported guide sections in full-guide rendering order. */
export const WORKFLOW_GUIDE_TOPICS = [
  "overview", "states", "roles", "review", "testing", "timeouts", "overrides",
] as const;

/** Public SDK identifier for the workflow_guide adapter. */
export const WORKFLOW_GUIDE_TOOL_NAME = "workflow_guide";
