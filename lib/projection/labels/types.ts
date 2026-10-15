/** Defines inputs and deterministic results for authoritative issue label projection. */

import type { IssueRuntimeState } from "../../domain/index.js";

/** Provider labels partitioned by ownership and compared with local truth. */
export type ProjectionDiff = {
  /** Sorted labels rendered from authoritative local fields. */
  expectedManagedLabels: string[];
  /** Sorted distinct observed labels owned by configuration or expected local fields. */
  actualManagedLabels: string[];
  /** Sorted distinct observed labels outside DevClaw ownership. */
  unmanagedLabels: string[];
  /** Expected labels absent from the provider snapshot. */
  missingManagedLabels: string[];
  /** Owned provider labels inconsistent with local truth. */
  unexpectedManagedLabels: string[];
};

/** Resolved configuration used to classify labels without importing provider state. */
export type ManagedLabelOptions = {
  /** Workflow labels owned by the current configuration. */
  stateLabels: readonly string[];
  /** Explicit configured role IDs; an empty list owns no role namespace. */
  roles: readonly string[];
};

/** Local truth and provider evidence used for a pure label comparison. */
export type ProjectionInput = {
  /** Initialized local record; provider observations never override its fields. */
  state: IssueRuntimeState;
  /** Observed provider label names, which are treated as a set. */
  actualLabels: readonly string[];
  /** Current ownership rules; exact expected local labels remain owned across drift. */
  options: ManagedLabelOptions;
};
