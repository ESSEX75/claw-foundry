/** Reports and execution contracts shared by heartbeat coordinators. */

import type { RunCommand } from "../../../context.js";
import type { Project } from "../../../domain/index.js";
import type { IssueProvider, SessionLookup } from "../../../integrations/index.js";
import type { ValueOf } from "../../../shared/types.js";
import type { NotificationRuntime } from "../../notifications/index.js";
import type { QueueSkipReason } from "../scheduling/index.js";
import type { HealthFix, HealthIssue } from "../workers/index.js";
import type { HeartbeatConfig } from "./configuration/index.js";
import type { HEARTBEAT_PASS_FAILURE_POLICY, HEARTBEAT_SKIP_REASON } from "./const.js";
import type { ServiceContext } from "./service/types.js";

/** One project tick's resolved application and transport dependencies. */
export type HeartbeatRunInput = {
  /** Workspace containing all project stores. */
  workspaceDir: string;
  /** Configured agent whose projects may run. */
  agentId?: string;
  /** Resolved service pickup budget. */
  config: HeartbeatConfig;
  /** Plugin settings including project execution mode. */
  pluginConfig?: Record<string, unknown>;
  /** Gateway session observations, possibly unavailable. */
  sessions: SessionLookup | null;
  /** Project failure logger. */
  logger: Pick<ServiceContext["logger"], "info" | "warn">;
  /** Runtime for exact routed notifications. */
  runtime?: NotificationRuntime;
  /** Provider and gateway command capability. */
  runCommand: RunCommand;
  /** Optional provider capability supplied by a caller already owning an adapter. */
  providerFactory?: (project: Project) => Promise<IssueProvider>;
};

/** A pass operation or a concrete health remedy represented in a report. */
export type HeartbeatAction = {
  /** Operation or remediation identifier. */
  kind: string;
  /** Issue affected by a concrete remedy. */
  issueId?: number | null;
};

/** Observable outcome of one named project pass. */
export type HeartbeatPassReport = {
  /** Stable name of the pass. */
  name: string;
  /** Project whose data was inspected. */
  projectSlug: string;
  /** Diagnostics collected before remediation. */
  findings: HealthIssue[];
  /** Health actions selected by diagnosis. */
  plannedActions: HeartbeatAction[];
  /** Health actions whose remediation completed. */
  appliedActions: HeartbeatAction[];
  /** Failures retained even if a later project continues. */
  errors: string[];
};

/** One sequential pass with an explicit application operation. */
export type HeartbeatPass = {
  /** Name used in diagnostics and errors. */
  name: string;
  /** Application operation, optionally returning detailed health results. */
  run: () => Promise<HealthFix[] | void>;
};

/** Error handling policy for an ordered group of project passes. */
export type HeartbeatPassFailurePolicy = ValueOf<typeof HEARTBEAT_PASS_FAILURE_POLICY>;

/** Aggregated counters and retained pass reports for one heartbeat tick. */
export type HeartbeatTickResult = {
  /** Workers picked up by queue operations. */
  totalPickups: number;
  /** Applied health remedies. */
  totalHealthFixes: number;
  /** Skipped projects and queue candidates. */
  totalSkipped: number;
  /** Bounded diagnostics for each counted skip. */
  skipDetails: HeartbeatSkipDetail[];
  /** Successful human review transitions. */
  totalReviewTransitions: number;
  /** Successful review skip transitions. */
  totalReviewSkipTransitions: number;
  /** Successful test skip transitions. */
  totalTestSkipTransitions: number;
  /** Issues archived by recovery. */
  totalArchived: number;
  /** Creations completed by recovery. */
  totalCreationsReady: number;
  /** Creations still awaiting recovery. */
  totalCreationsPending: number;
  /** Creations requiring intervention. */
  totalCreationsManual: number;
  /** Per-project pass outcomes, including failures. */
  passes: HeartbeatPassReport[];
};

/** Bounded refusal detail combining heartbeat and queue-owned reason registries. */
type HeartbeatSkipDetail = {
  /** Project whose scheduling was skipped. */
  project: string;
  /** Role, when a concrete queue was inspected. */
  role?: string;
  /** Issue, when a concrete candidate was selected. */
  issueId?: number;
  /** Stable owner-derived diagnostic code. */
  code: ValueOf<typeof HEARTBEAT_SKIP_REASON> | QueueSkipReason;
  /** Redacted operator diagnostic. */
  reason: string;
};
