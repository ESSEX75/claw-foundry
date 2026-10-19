/** Contracts owned by setup coordination. */

import type { RunCommand } from "../../context.js";
import type { ExecutionMode } from "../../domain/index.js";
import type { AgentConfigurationRuntime } from "../../integrations/index.js";
import type { ValueOf } from "../../types.js";
import type { SetupNotificationChannel } from "./bindings/types.js";
import type { SETUP_APPLY_STEP, SETUP_OPERATION, SETUP_RECOVERY_ACTION } from "./const.js";
import type { ScopePreflightResult } from "./permissions/types.js";

/** Model identifiers indexed by configured role and level. */
export type ModelConfig = Record<string, Record<string, string>>;

/** Shared setup command inputs, independent of tool and terminal adapters. */
export type SetupOpts = {
  /** OpenClaw plugin runtime for config access. */
  runtime: SetupRuntime;
  /** Command transport used for the shared approval preflight. */
  runCommand: RunCommand;
  /** Create a new agent with this name. Mutually exclusive with agentId. */
  newAgentName?: string;
  /** Channel binding for the selected or newly-created agent. */
  channelBinding?: SetupNotificationChannel | null;
  /** Explicit account id required whenever a channel binding is requested. */
  channelAccountId?: string;
  /** Exact peer id required whenever a channel binding is requested. */
  channelPeerId?: string;
  /** Use an existing agent by ID. Mutually exclusive with newAgentName. */
  agentId?: string;
  /** Override workspace path (auto-detected from agent if not given). */
  workspacePath?: string;
  /** Model overrides per role.level. Unspecified assignments preserve resolved configuration. */
  models?: ModelConfig;
  /** Explicitly write packaged defaults into the workspace. Existing files are preserved. */
  ejectDefaults?: boolean;
  /** Explicitly replace packaged defaults with backups. */
  resetDefaults?: boolean;
  /** Explicitly refresh system instructions with backups. */
  refreshInstructions?: boolean;
  /** Plugin-level project execution mode: parallel or sequential. Default: parallel. */
  projectExecution?: ExecutionMode;
  /** Compute and validate the setup plan without writing configuration or workspace files. */
  dryRun?: boolean;
};

/** Outcome of a validated setup operation or preview. */
export type SetupResult = {
  /** Partial-apply details carried by SetupApplyError; successful results omit them. */
  recovery?: SetupRecovery;
  /** Requested operation; file operations do not configure an agent. */
  operation: ValueOf<typeof SETUP_OPERATION>;
  /** Scope preflight outcome; absent for preview and file-only operations. */
  scopePreflight?: ScopePreflightResult;
  /** Resolved agent identifier, or unknown for a workspace-only operation. */
  agentId: string;
  /** Whether this invocation confirmed agent registration (planned during preview); failures may remain unconfirmed. */
  agentCreated: boolean;
  /** Resolved filesystem workspace target. */
  workspacePath: string;
  /** Effective models after explicit overrides; empty for file-only operations. */
  models: ModelConfig;
  /** Workspace-relative paths from completed write phases; a failed phase may have additional partial files. Empty during preview. */
  filesWritten: string[];
  /** Nonfatal operation diagnostics. */
  warnings: string[];
  /** Selected notification transport. */
  channelBinding?: SetupNotificationChannel | null;
  /** Exact channel account identifier. */
  channelAccountId?: string;
  /** Exact group or topic destination. */
  channelPeerId?: string;
  /** Whether create-only defaults were requested. */
  defaultsEjected?: boolean;
  /** True when no effects were applied. */
  dryRun: boolean;
  /** Human-readable validated operation plan. */
  plannedChanges: string[];
};

/** Concrete target and stopped effect retained after an incomplete setup apply. */
export type SetupRecovery = {
  /** Effect that failed; preceding effects may already be committed. */
  step: ValueOf<typeof SETUP_APPLY_STEP>;
  /** Original diagnostic without discarding the thrown cause. */
  reason: string;
  /** Whether registration needs inspection before selecting an existing target. */
  action: ValueOf<typeof SETUP_RECOVERY_ACTION>;
  /** Agent to inspect or resume, absent for workspace-only setup. */
  agentId?: string;
  /** Exact workspace selected before any effects. */
  workspacePath: string;
};

/** Runtime capabilities needed by setup; SDK-owned persistence supplies writable drafts. */
export type SetupRuntime = Pick<AgentConfigurationRuntime, "config">;

/** Read-only SDK configuration capability for setup endpoint discovery. */
type SetupConfigReader = {
  /** Configuration access without a mutation transport. */
  config: Pick<SetupRuntime["config"], "current">;
};

/** Existing or proposed agent whose available destinations should be inspected. */
export type SetupEndpointChoicesInput = Pick<SetupOpts, "agentId" | "newAgentName"> & {
  /** Read-only SDK snapshot source; failed reads remain errors. */
  runtime: SetupConfigReader;
};

/** Read-only target selection shared by setup planning and effective model queries. */
export type SetupModelQueryInput = Pick<SetupOpts, "runtime" | "newAgentName" | "agentId" | "workspacePath">;

/** Partial setup result always contains a concrete stopped effect and recovery target. */
export type SetupIncompleteResult = SetupResult & Required<Pick<SetupResult, "recovery">>;
