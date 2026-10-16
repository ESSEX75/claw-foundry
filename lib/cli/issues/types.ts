/** Parsed terminal requests owned by issue archive, deletion and store recovery adapters. */

/** Exact local project scope before terminal workspace resolution. */
export type IssueProjectOptions = {
  /** Canonical project slug supplied by the operator. */
  project: string;
  /** Optional workspace overriding the SDK default. */
  workspace?: string;
};

/** Explicit archive preview/apply selection. */
export type ArchivePurgeOptions = IssueProjectOptions & {
  /** Preview retention without writes. */
  dryRun?: boolean;
  /** Apply bounded retention. */
  apply?: boolean;
};

/** Exact deletion identity and numeric confirmation before parsing. */
export type DeleteIssueOptions = ArchivePurgeOptions & {
  /** Raw provider-local issue ID. */
  issue: string;
  /** Exact repeated issue ID required for apply. */
  confirmIssue?: string;
};

/** Explicit confirmation authorizing replacement of the selected project stores. */
export type ResetIssueStoreOptions = IssueProjectOptions & {
  /** Exact repeated canonical project slug. */
  confirmProject: string;
};
