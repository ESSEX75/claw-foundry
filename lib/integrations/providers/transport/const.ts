/** Owns checked CLI protocol identifiers, collection limits and replay policies. */

/** Explicit replay safety selected by each provider operation. */
export const PROVIDER_COMMAND_MODE = {
  READ: "read",
  IDEMPOTENT: "idempotent",
  ONCE: "once",
} as const;

/** Transport limits shared by the concrete CLI adapters. */
export const PROVIDER_TRANSPORT_POLICY = {
  TIMEOUT_MS: 30_000,
  REMOTE_TIMEOUT_MS: 5_000,
  RETRIES: 3,
  INITIAL_DELAY_MS: 500,
  MAX_DELAY_MS: 5_000,
  BREAKER_FAILURES: 5,
  BREAKER_RESET_MS: 30_000,
} as const;

/** Page size used with provider-owned CLI pagination; abnormal completion never exposes partial results. */
export const PROVIDER_PAGE_SIZE = 100;

/** Concrete CLI identities used by shared checked transport. */
export const PROVIDER_CLI = {
  GITHUB: "gh",
  GITLAB: "glab",
} as const;

/** HTTP methods shared by provider CLI REST calls; replay safety is still explicitly chosen per operation. */
export const PROVIDER_HTTP_METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

/** Provider collection page-size query identifier. */
export const PROVIDER_PAGE_QUERY = "per_page";

/** Provider CLI command identifiers shared by capability adapters. */
export const PROVIDER_CLI_COMMAND = {
  /** Invoke the provider REST or GraphQL API. */
  API: "api",
  /** Select authentication operations. */
  AUTH: "auth",
  /** Inspect current authentication state. */
  STATUS: "status",
  /** Select issue operations. */
  ISSUE: "issue",
  /** Select repository observations. */
  REPOSITORY: "repo",
  /** Select GitHub pull-request operations. */
  PULL_REQUEST: "pr",
  /** Select GitLab merge-request operations. */
  MERGE_REQUEST: "mr",
  /** Read a selected resource. */
  VIEW: "view",
  /** Create a provider resource. */
  CREATE: "create",
  /** Edit a GitHub resource. */
  EDIT: "edit",
  /** Update a GitLab resource. */
  UPDATE: "update",
  /** Close the selected issue. */
  CLOSE: "close",
  /** Reopen the selected issue. */
  REOPEN: "reopen",
  /** Delete the selected resource. */
  DELETE: "delete",
  /** Merge the selected request. */
  MERGE: "merge",
  /** Read the selected request diff. */
  DIFF: "diff",
  /** Select label operations. */
  LABEL: "label",
} as const;

/** Provider CLI argument flags shared by capability adapters. */
export const PROVIDER_CLI_OPTION = {
  /** Supply the issue title. */
  TITLE: "--title",
  /** Supply GitHub issue body content. */
  BODY: "--body",
  /** Supply GitLab issue description content. */
  DESCRIPTION: "--description",
  /** Select label operations. */
  LABEL: "--label",
  /** Remove a GitLab issue label. */
  UNLABEL: "--unlabel",
  /** Supply issue assignees. */
  ASSIGNEE: "--assignee",
  /** Request structured JSON output. */
  JSON: "--json",
  /** Select the GitLab output format. */
  OUTPUT: "--output",
  /** Select the HTTP method. */
  METHOD: "--method",
  /** Supply a typed REST request field. */
  FIELD: "--field",
  /** Supply a literal GraphQL request field. */
  RAW_FIELD: "-f",
  /** Read every advertised provider page. */
  PAGINATE: "--paginate",
  /** Collect GitHub page responses into a JSON array. */
  SLURP: "--slurp",
  /** Select fields from JSON using jq. */
  QUERY: "--jq",
  /** Supply label color. */
  COLOR: "--color",
  /** Update an existing label when creating it. */
  FORCE: "--force",
  /** Add a GitHub issue label. */
  ADD_LABEL: "--add-label",
  /** Remove a GitHub issue label. */
  REMOVE_LABEL: "--remove-label",
  /** Confirm deletion without an interactive prompt. */
  CONFIRM: "--confirm",
  /** Merge the selected request. */
  MERGE: "--merge",
} as const;

/** Structured output formats understood by the provider CLIs. */
export const PROVIDER_JSON_OUTPUT_FORMAT = "json";
