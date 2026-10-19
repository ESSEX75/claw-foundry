/** Defines results of explicit setup document writes. */

/** Structured record of filesystem paths actually written by a setup capability. */
export type WorkspaceWriteResult = {
  /** Workspace-relative paths created or replaced by an explicit operation. */
  written: string[];
};
