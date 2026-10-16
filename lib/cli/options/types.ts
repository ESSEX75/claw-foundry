/** Terminal setup option and agent display contracts. */


/** Parsed terminal setup flags before application validation. */
export type SetupCliOptions = {
  /** Display name requested for a new agent. */
  newAgent?: string;
  /** Selected existing agent identifier. */
  agent?: string;
  /** Explicit workspace target. */
  workspace?: string;
  /** Selected notification transport. */
  channelBinding?: string;
  /** Exact channel account identifier. */
  channelAccountId?: string;
  /** Exact group or topic destination. */
  channelPeerId?: string;
  /** Whether missing defaults should be created. */
  ejectDefaults?: boolean;
  /** Whether defaults should be replaced with backups. */
  resetDefaults?: boolean;
  /** Whether system instructions should be replaced with backups. */
  refreshInstructions?: boolean;
  /** Requested project scheduling mode. */
  projectExecution?: string;
  /** Whether to preview without effects. */
  dryRun?: boolean;
  [key: string]: string | boolean | undefined;
};

/** Read-only agent identity displayed by terminal prompts. */
export type ConfiguredAgent = {
  /** Stable configured agent identifier. */
  id: string;
  /** Optional human-readable agent name. */
  name?: string;
  /** Explicit workspace target. */
  workspace?: string;
};
