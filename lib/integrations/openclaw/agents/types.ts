/** Defines SDK agent inventory, configuration transport and resource provisioning contracts. */

import type { PluginRuntime } from "openclaw/plugin-sdk/core";

/** SDK agent fields used by this adapter; generic callers may retain additional metadata. */
export type AgentRegistryEntry = {
  /** Configured identity; entries-map keys supply it when the stored value omits it. */
  readonly id: string;
  /** Explicit SDK workspace override. */
  readonly workspace?: string;
  /** Explicit SDK agent configuration directory override. */
  readonly agentDir?: string;
  /** SDK default-agent marker used during workspace inheritance. */
  readonly default?: boolean;
};

/** Active SDK inventory; an explicitly present entries map takes precedence over list. */
type AgentInventory<T extends object> = {
  /** Default workspace inherited when no per-agent override exists. */
  readonly defaults?: Pick<AgentRegistryEntry, "workspace">;
  /** Key-derived identity allows omitted IDs while the direct T branch preserves entries-only metadata inference. */
  readonly entries?: Readonly<Record<string, (T | Omit<T, "id">) & Omit<AgentRegistryEntry, "id">>>;
  /** List entries carrying their own identities, used only when entries is absent. */
  readonly list?: readonly (T & AgentRegistryEntry)[];
};

/** Shared SDK configuration view; T adds caller metadata to the common identity/workspace fields. */
export type AgentRegistryConfig<T extends object = object> = {
  /** Active inventory and SDK workspace defaults observed without mutation. */
  readonly agents?: AgentInventory<T>;
};

/** Cloned metadata with its original identity replaced by the active representation's read-only string ID. */
export type ConfiguredAgent<T extends object> = Omit<T, "id"> & AgentRegistryEntry;

/** SDK configuration capability shared by registration and setup coordination. */
export type AgentConfigurationRuntime = {
  /** Read current configuration and perform one SDK-protected transaction. */
  config: {
    /** Current immutable configuration snapshot. */
    current: PluginRuntime["config"]["current"];
    /** Focused mutation; SDK owns persistence and reload effects. */
    mutateConfigFile: (params: Parameters<PluginRuntime["config"]["mutateConfigFile"]>[0]) => Promise<unknown>;
  };
};

/** Optional state root for an explicitly scoped provisioning request. */
export type AgentResourceOptions = {
  /** OpenClaw state root, defaulting to the SDK's environment-aware resolution. */
  openClawHome?: string;
};

/** Exact SDK-owned directories associated with one selected agent. */
export type AgentResourcePaths = {
  /** Normalized or SDK-configured identity. */
  agentId: string;
  /** Agent workspace receiving DevClaw scaffolding from state. */
  workspacePath: string;
  /** SDK agent configuration directory. */
  agentDirectory: string;
  /** SDK transcript persistence directory. */
  sessionsDirectory: string;
};

/** Explicit absent-agent registration request; does not provision resources. */
export type AgentRegistrationInput = {
  /** SDK configuration transaction transport. */
  runtime: AgentConfigurationRuntime;
  /** Normalized identity selected by setup. */
  agentId: string;
  /** Requested display name. */
  name: string;
  /** Resource paths assigned by the integration resolver. */
  resources: AgentResourcePaths;
  /** Caller-owned reload policy for a multi-write coordination flow. */
  afterWrite: Parameters<PluginRuntime["config"]["mutateConfigFile"]>[0]["afterWrite"];
};
