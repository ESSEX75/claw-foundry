/** Defines one read-only agent inventory for registry queries and SDK workspace resolution. */

/** SDK agent fields used by this adapter; generic callers may retain additional metadata. */
export type AgentRegistryEntry = {
  /** Configured identity; entries-map keys supply it when the stored value omits it. */
  readonly id: string;
  /** Explicit SDK workspace override. */
  readonly workspace?: string;
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
