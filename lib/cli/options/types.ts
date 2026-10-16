/** Terminal setup option and model-flag contracts. */

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
  /** Repeatable explicit role.level=model assignments before parsing. */
  model?: string[];
  /** Whether to preview without effects. */
  dryRun?: boolean;
  /** Named Commander flags, including built-in model assignment arrays. */
  [key: string]: string | string[] | boolean | undefined;
};


/** One built-in model flag, retained as supported terminal syntax. */
export type BuiltInModelOption = {
  /** Built-in role addressed by the flag. */
  role: string;
  /** Built-in level addressed by the flag. */
  level: string;
  /** Commander option spelling, including the leading dashes. */
  flag: string;
  /** Commander attribute name storing the raw model value. */
  key: string;
};
