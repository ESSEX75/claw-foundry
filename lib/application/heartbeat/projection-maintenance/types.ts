/** Contracts owned by heartbeat provider projection maintenance. */

import type { Project, WorkflowConfig } from "../../../domain/index.js";
import type { ProjectionDiff } from "../../../projection/index.js";
import type { ValueOf } from "../../../types.js";
import type { ProjectionProvider } from "../../projection/index.js";
import type { PROJECTION_INTEGRITY_ACTION } from "./const.js";

/** Provider/metadata observations emitted by heartbeat projection inspection. */
export type ProjectionIntegrityAction = ValueOf<typeof PROJECTION_INTEGRITY_ACTION>;

/** One heartbeat projection observation. */
export type ProjectionIntegrityEvent = {
  /** Inspected provider issue. */
  issueId: number;
  /** Observed or applied action. */
  action: ProjectionIntegrityAction;
  /** Label diff, when reconciliation was required. */
  diff?: ProjectionDiff;
  /** Diagnostics belonging to this observation. */
  errors?: string[];
};

/** Counts and observations from one project projection pass. */
export type ProjectionIntegrityResult = {
  /** Ready managed issues inspected under their locks. */
  checked: number;
  /** Issues removed through confirmed provider absence or exact archive-first recovery. */
  removed: number;
  /** Issues whose labels required changes. */
  repaired: number;
  /** Failed provider or metadata checks. */
  errors: number;
  /** Closed or not-yet-archivable issues skipped. */
  skipped: number;
  /** Detailed outcomes in inspection order. */
  events: ProjectionIntegrityEvent[];
};

/** Resolved dependencies for heartbeat projection verification. */
export type ProjectionIntegrityInput = {
  /** Workspace containing authoritative issue storage. */
  workspaceDir: string;
  /** Canonical project identity. */
  project: Pick<Project, "slug">;
  /** Provider reads and managed label operations only. */
  provider: ProjectionProvider;
  /** Resolved workflow including custom states. */
  workflow: WorkflowConfig;
  /** Resolved roles allowed in managed labels. */
  roles: string[];
  /** Timestamp used for confirmed provider-missing observations. */
  now?: Date;
};
