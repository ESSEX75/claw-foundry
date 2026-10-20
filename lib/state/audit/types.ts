/** Defines the flat diagnostic record written independently of runtime issue state. */

/** Caller fields plus repository-owned timestamp and event identity in each NDJSON line. */
export type AuditEntry = Record<string, unknown> & {
  /** UTC timestamp captured when the caller requests the diagnostic entry. */
  ts: string;
  /** Event selected explicitly by the caller; payload fields cannot replace it. */
  event: string;
};

/** Injected diagnostic sink; failures from the sink never propagate to application operations. */
export type AuditWarningReporter = (message: string) => void | Promise<void>;

/** Immutable intent persisted before touching archives or replacing the active journal. */
export type AuditRotationIntent = {
  /** Positive safe sequence selecting one canonical archive filename. */
  sequence: number;
  /** SHA-256 of the complete source journal before rotation. */
  sourceDigest: string;
  /** Single serialized NDJSON object that becomes the new active journal. */
  record: string;
};

/** One canonical archive discovered under the workspace audit directory. */
export type AuditArchive = {
  /** Monotonic sequence determining age independently of wall-clock changes. */
  sequence: number;
  /** Complete path validated as an ordinary file before use or deletion. */
  filePath: string;
};
