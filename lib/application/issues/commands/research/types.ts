/** Contracts for idempotent research creation and exact worker delivery. */

import type { RunCommand } from "../../../../context.js";
import type { ActiveIssueWorker } from "../../../../domain/index.js";
import type { Issue, IssueProvider } from "../../../../integrations/index.js";
import type { TaskComplexity } from "../../../../roles/index.js";
import type { ValueOf } from "../../../../types.js";
import type { DispatchOpts, DispatchResult } from "../../../execution/workers/index.js";
import type { CreatedManagedTask } from "../creation/index.js";
import type { RESEARCH_STATUS } from "./const.js";

/** Explicit request and integration capabilities used by the research command. */
export type ResearchTaskInput = {
  /** Workspace containing local issue and project state. */
  workspaceDir: string;
  /** Unambiguous channel-only project selector. */
  channelId: string;
  /** Stable caller key reused across SDK invocations. */
  idempotencyKey: string;
  /** User-supplied research title. */
  title: string;
  /** User-supplied background retained in the creation payload. */
  description: string;
  /** Optional research focus list. */
  focusAreas?: string[];
  /** Optional built-in complexity selector. */
  complexity?: TaskComplexity;
  /** Explicit architect queue key when the workflow offers multiple choices. */
  workflowState?: string;
  /** Validate the complete plan without creating or dispatching. */
  dryRun?: boolean;
  /** Caller identity used for audit attribution. */
  agentId?: string;
  /** Parent orchestrator session. */
  sessionKey?: string;
  /** Plugin scheduling and notification settings. */
  pluginConfig?: DispatchOpts["pluginConfig"];
  /** Optional notification transport. */
  runtime?: DispatchOpts["runtime"];
  /** External command capability. */
  runCommand: RunCommand;
  /** Explicit provider dependency; omitted by tools using persisted provider selection. */
  provider?: IssueProvider;
};

/** Honest research progress, including the complete creation recovery result. */
export type ResearchTaskResult = {
  /** True only for a valid preview or ready creation without an execution failure. */
  success: boolean;
  /** Caller-visible progress category. */
  status: ValueOf<typeof RESEARCH_STATUS>;
  /** Project display name. */
  project: string;
  /** Configured level selected for this creation. */
  level: string;
  /** Explicit model resolved before effects. */
  model: string;
  /** Local workflow label, never inferred from provider observations. */
  label: string;
  /** Durable creation and recovery identity when creation was attempted. */
  creation?: CreatedManagedTask;
  /** Known provider identity from the creation operation. */
  issue?: Issue;
  /** Exact dispatch outcome, including submission ID and uncertainty. */
  dispatch?: DispatchResult;
  /** Existing authoritative worker frame when a retry finds active work. */
  existingWorker?: ActiveIssueWorker;
  /** Unresolved delivery token retained by issue or slot state. */
  deliveryId?: string;
  /** Delivery observation kept separate from workflow and creation readiness. */
  deliveryStatus?: DispatchResult["deliveryStatus"];
  /** Explicit scheduling exclusion or recovery explanation. */
  reason?: string;
};

/** Internal display metadata shared by creation planning and locked scheduling. */
export type ResearchTaskBase = Pick<ResearchTaskResult, "project" | "level" | "model" | "label">;
