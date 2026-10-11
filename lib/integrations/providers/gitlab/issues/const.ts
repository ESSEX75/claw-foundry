/** Owns the CLI response pattern confirming newly created GitLab issue identities. */

/** Extract the HTTP issue URL and provider-local identifier from glab creation output. */
export const GITLAB_CREATED_ISSUE_URL_PATTERN = /https?:\/\/\S+\/issues\/(\d+)/;
