/** Owns GitHub shared resource paths and wire lifecycle identifiers and policies used by this capability. */

/** Shared API resource namespaces used across concrete capabilities. */
export const GITHUB_API_RESOURCE = {
  PULLS: "pulls",
  ISSUES: "issues",
  COMMENTS: "comments",
} as const;

/** Repository/project placeholder root understood by the concrete CLI. */
export const GITHUB_API_ROOT = "repos/:owner/:repo";

/** GitHub's confirmed lifecycle observations independent of local workflow states. */
export const GITHUB_REQUEST_STATE = {
  OPEN: "OPEN",
  MERGED: "MERGED",
  CLOSED: "CLOSED",
} as const;

/** REST collection filter names sent to the provider. */
export const GITHUB_API_QUERY = {
  /** Filter the provider lifecycle state. */
  STATE: "state",
  /** Filter by provider-visible labels. */
  LABELS: "labels",
} as const;

/** REST mutation fields sent through provider CLI arguments. */
export const GITHUB_API_FIELD = {
  /** Supply GitHub issue body content. */
  BODY: "body",
  /** Supply attachment bytes or reaction content. */
  CONTENT: "content",
} as const;
