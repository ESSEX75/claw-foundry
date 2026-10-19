/** Contracts owned by heartbeat provider projection maintenance. */

import type { Project, WorkflowConfig } from "../../../domain/index.js";
import type { ISSUE_ARCHIVE_REASON } from "../../../domain/index.js";
import type { ProjectionDiff } from "../../../projection/index.js";
import type { ValueOf } from "../../../types.js";
import type { ProjectionProvider } from "../reconciliation/index.js";
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
  /** Composition-owned archive effects; verification never imports issue maintenance. */
  archive: ProjectionArchiveEffects;
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

/** Narrow archive request after confirmed provider absence. */
export type ProjectionArchiveRequest = {
  /** Owning workspace. */
  workspaceDir: string;
  /** Owning project. */
  projectSlug: string;
  /** Managed issue. */
  issueId: number;
  /** Explicit provider-deletion reason. */
  archiveReason: typeof ISSUE_ARCHIVE_REASON.PROVIDER_DELETED;
  /** Confirmed deletion observation timestamp. */
  providerDeletedAt: string;
  /** Diagnostic actor. */
  actor: string;
  /** Stable retry correlation. */
  correlationId: string;
};

/** Archive callbacks injected by composition without a reverse maintenance dependency. */
export type ProjectionArchiveEffects = {
  /** Archive a missing provider issue while retaining ownership and notification guards. */
  archiveManagedIssueLocked: (input: ProjectionArchiveRequest) => Promise<{ archived: boolean }>;
  /** Resume an exact archive-first snapshot before projection can change it. */
  recoverArchivedIssueLocked: (workspaceDir: string, projectSlug: string, issueId: number, workflow: WorkflowConfig) => Promise<boolean>;
};
