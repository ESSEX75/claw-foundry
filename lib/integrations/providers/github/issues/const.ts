/** Owns GitHub issue observations and explicit mutations identifiers and policies used by this capability. */

/** Issue observation and repository-access probe selectors. */
export const GITHUB_ISSUE_QUERY = {
  ISSUE_FIELDS: "number,title,body,labels,state,url",
  REPOSITORY_NAME_FIELD: "name",
} as const;

/** Confirmed issue URL returned by gh creation; the issue identifier must terminate the response. */
export const GITHUB_CREATED_ISSUE_URL_PATTERN = /\/issues\/(\d+)$/;
