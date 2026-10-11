/** Supported pure label rendering, ownership classification, and diff API. */

export { isManagedLabel } from "./classification.js";
export { diffIssueProjection } from "./diff.js";
export { expectedManagedLabels } from "./render.js";
export type { ManagedLabelOptions, ProjectionDiff, ProjectionInput } from "./types.js";
