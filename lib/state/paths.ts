/**
 * Defines filesystem names shared by every Claw Foundry state capability.
 */

/** Directory below a workspace that contains all Claw Foundry-managed state. */
export const DATA_DIR = "claw-foundry";

/** Previous data directory, detected only to require an explicit offline migration. */
export const UPSTREAM_DATA_DIR = "devclaw";

/** Directory for diagnostic journals and workspace logs. */
export const LOG_DIRECTORY_NAME = "log";

/** Directory below managed state that contains project-local state. */
export const PROJECTS_DIRECTORY_NAME = "projects";

/** Filename of the workspace projects registry. */
export const PROJECTS_FILE_NAME = "projects.json";

/** Filename of a workspace or project workflow configuration. */
export const WORKFLOW_FILE_NAME = "workflow.yaml";
