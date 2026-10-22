/** Defines contracts shared by state persistence primitives and repositories. */

/** Timing policy selected by the repository that owns a filesystem lock. */
export type FileLockOptions = {
  /** Maximum time to wait before rejecting lock acquisition. */
  timeoutMs: number;
  /** Delay between attempts while another valid owner holds the lock. */
  retryMs: number;
  /** Minimum age before checking whether a local owner exited; live owners never expire. */
  staleMs: number;
};

/** Immutable ownership published with a nonempty lock directory. */
export type FileLockRecord = {
  /** Unique filename token, never reused by another acquisition. */
  token: string;
  /** Local operating-system process holding the lock. */
  processId: number;
  /** Host on which process liveness can be checked. */
  hostname: string;
  /** Acquisition time used only to delay abandoned-owner inspection. */
  createdAt: number;
};
