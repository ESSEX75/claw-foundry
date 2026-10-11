/** Owns GitLab shared resource paths and wire lifecycle identifiers and policies used by this capability. */

/** Shared issue/request/note namespaces used across concrete capabilities. */
export const GITLAB_API_RESOURCE = {
  ISSUES: "issues",
  MERGE_REQUESTS: "merge_requests",
  NOTES: "notes",
} as const;

/** Repository/project placeholder root understood by the concrete CLI. */
export const GITLAB_API_ROOT = "projects/:id";

/** GitLab lifecycle values, distinct from application workflow states. */
export const GITLAB_REQUEST_STATE = {
  OPEN: "opened",
  MERGED: "merged",
  CLOSED: "closed",
} as const;

/** REST collection filter names sent to the provider. */
export const GITLAB_API_QUERY = {
  /** Filter the provider lifecycle state. */
  STATE: "state",
  /** Filter by provider-visible labels. */
  LABELS: "labels",
} as const;

/** REST mutation fields sent through provider CLI arguments. */
export const GITLAB_API_FIELD = {
  /** Supply the issue or merge-request note body. */
  BODY: "body",
  /** Supply label or reaction identity. */
  NAME: "name",
  /** Supply label color. */
  COLOR: "color",
} as const;
