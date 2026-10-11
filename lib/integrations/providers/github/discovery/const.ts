/** Owns GitHub associated request discovery identifiers and policies used by this capability. */

/** GraphQL selector used for complete associated-request discovery. */
export const GITHUB_GRAPHQL_ENDPOINT = "graphql";

/** GitHub PR fields shared by status, diff, merge and feedback discovery. */
export const GITHUB_PR_FIELDS = "number,title,body,headRefName,url,state,mergedAt,reviewDecision,mergeable";

/** Native/fallback discovery filters used consistently across request capabilities. */
export const GITHUB_DISCOVERY_STATE = {
  OPEN: "open",
  MERGED: "merged",
  ALL: "all",
} as const;

/** GraphQL request argument names used for linked PR discovery. */
export const GITHUB_GRAPHQL_QUERY_FIELD = "query";

/** Pull-request browser resource used to reject cross-repository timeline references. */
export const GITHUB_PULL_REQUEST_URL_RESOURCE = "pull";

/** Supported branch categories used by fallback issue-reference discovery. */
export const GITHUB_ISSUE_BRANCH_CATEGORIES = ["fix", "feat", "feature", "chore", "bugfix", "hotfix", "refactor", "docs", "test"] as const;
