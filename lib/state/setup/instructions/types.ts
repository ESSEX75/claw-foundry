/** Defines resolved role instruction diagnostics. */

/** Role instruction content together with its resolved source for diagnostics. */
export type RoleInstructionsResult = {
  /** Complete instruction content, empty when no source exists. */
  content: string;
  /** Filesystem path or package-default marker supplying the content. */
  source: string | null;
};
