/** Raw terminal repair and policy selections; application owns managed state and freshness validation. */

/** Common repair scope with an explicit preview/apply choice. */
type RepairScopeOptions = {
  /** Canonical project slug supplied by the operator. */
  project: string;
  /** Explicit workspace overriding the configured default. */
  workspace?: string;
  /** Preview the selected operation. */
  dryRun?: boolean;
  /** Apply the explicitly selected operation. */
  apply?: boolean;
};

/** Exact issue repair selection with snapshot-bound apply authorization. */
export type IssueRepairOptions = RepairScopeOptions & {
  /** Raw provider-local issue identity. */
  issue: string;
  /** Explicit authority chosen for this administrative repair only. */
  source: string;
  /** Token from the matching reviewed dry-run. */
  planToken?: string;
  /** Operator explanation retained in audit evidence. */
  reason?: string;
};

/** Optional policy snapshots and strict comma-separated local issue selections. */
export type PolicyMigrationOptions = RepairScopeOptions & {
  /** Raw optional review policy. */
  review?: string;
  /** Raw optional test policy. */
  test?: string;
  /** Explicit comma-separated issue IDs, never silently discarded. */
  issue?: string;
  /** Explicit comma-separated configured workflow keys. */
  state?: string;
  /** Whether terminal or closed records are included. */
  includeClosed?: boolean;
};
