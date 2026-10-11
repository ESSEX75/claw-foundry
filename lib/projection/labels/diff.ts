/**
 * Compares provider label sets with local truth without changing workflow state.
 */

import { isManagedLabel } from "./classification.js";
import { expectedManagedLabels } from "./render.js";
import type { ProjectionDiff, ProjectionInput } from "./types.js";

/** Compute a sorted set diff while retaining exact local labels across configuration drift.
 * Missing configured roles are rejected before a removal plan can be produced.
 * @param input - Authoritative state, observed labels, and explicit ownership rules.
 */
export function diffIssueProjection(input: ProjectionInput): ProjectionDiff {
  if (!Array.isArray(input.options.roles)) throw new Error("Projection requires an explicit configured role list.");
  const expected = expectedManagedLabels(input.state);
  const expectedSet = new Set(expected);
  const actualManaged: string[] = [];
  const unmanaged: string[] = [];

  for (const label of new Set(input.actualLabels)) {
    if (expectedSet.has(label) || isManagedLabel(label, input.options)) actualManaged.push(label);
    else unmanaged.push(label);
  }

  actualManaged.sort();
  unmanaged.sort();
  const actualSet = new Set(actualManaged);

  return {
    expectedManagedLabels: expected,
    actualManagedLabels: actualManaged,
    unmanagedLabels: unmanaged,
    missingManagedLabels: expected.filter(label => !actualSet.has(label)),
    unexpectedManagedLabels: actualManaged.filter(label => !expectedSet.has(label)),
  };
}
