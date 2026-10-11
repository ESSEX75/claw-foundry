/** Owns GitLab associated request discovery identifiers and policies used by this capability. */

/** Associated-request endpoint owned by discovery. */
export const GITLAB_RELATED_MERGE_REQUESTS_RESOURCE = "related_merge_requests";

/** Merge conflict/readiness evidence supplied by GitLab. */
export const GITLAB_MERGEABILITY = {
  CONFLICT: "conflict",
  MERGEABLE: "mergeable",
  CI_REQUIRED: "ci_must_pass",
} as const;

/** Query parameters required for complete MR mergeability observations. */
export const GITLAB_INCLUDE_REBASE_QUERY = "include_rebase_in_progress";
