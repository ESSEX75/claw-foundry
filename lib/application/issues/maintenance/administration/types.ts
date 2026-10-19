/** Defines operator-scoped issue administration requests without adapter or provider construction details. */

import type { RunCommand } from "../../../../context.js";
import type { DeleteManagedIssueInput } from "../deletion/index.js";

/** Local project identity shared by archive inspection and explicit store recovery. */
export type ProjectIssueScope = {
  /** Workspace containing the project-local stores and configuration. */
  workspaceDir: string;
  /** Canonical project slug addressing the selected local stores. */
  projectSlug: string;
};

/** Explicit archive cleanup using resolved project retention policy. */
export type PurgeProjectIssueArchiveInput = ProjectIssueScope & {
  /** Whether to delete expired records; false is a read-only preview. */
  apply: boolean;
  /** Operator identity retained in cleanup audit evidence. */
  actor: string;
};

/** Deletion request whose persisted project selects the provider inside application. */
export type DeleteProjectIssueInput = Omit<DeleteManagedIssueInput, "provider"> & {
  /** Runtime-owned transport used to construct the persisted provider adapter. */
  runCommand: RunCommand;
};

/** Destructive recovery scoped to the two managed issue stores only. */
export type ResetProjectIssueStoresInput = ProjectIssueScope & {
  /** Exact project slug repeated by the operator to authorize replacement. */
  confirmProjectSlug: string;
};

/** Existing administrative JSON contract returned after both replacements complete. */
export type ResetProjectIssueStoresResult = {
  /** Canonical project whose active and archive stores were replaced. */
  projectSlug: string;
  /** Confirmation that both state-owned replacements completed. */
  reset: true;
};
