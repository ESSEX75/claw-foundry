/** Defines the flat diagnostic record written independently of runtime issue state. */

/** Caller fields plus repository-owned timestamp and event identity in each NDJSON line. */
export type AuditEntry = Record<string, unknown> & {
  /** UTC timestamp captured when the caller requests the diagnostic entry. */
  ts: string;
  /** Event selected explicitly by the caller; payload fields cannot replace it. */
  event: string;
};
