/**
 * Defines the persisted projects-registry envelope owned by the state layer.
 */

import type { Project } from "../../domain/index.js";

/** Data structure persisted in the projects registry store. */
export type ProjectsData = {
  /** Map of project slugs to project configurations. */
  projects: Record<string, Project>;
};

/** Canonical workspace identity and optional validated registry observed in one read. */
export type ManagedWorkspaceSnapshot = {
  /** Existing workspace resolved through realpath before registry access. */
  workspace: string;
  /** Registry snapshot, absent only when its file does not exist. */
  projects: ProjectsData | undefined;
};

/** Immutable replacement returned by a projects-registry transaction. */
export type ProjectsUpdate<T> = {
  /** Complete registry value to persist after validation. */
  data: ProjectsData;
  /** Operation-specific result returned to the caller. */
  result: T;
};
