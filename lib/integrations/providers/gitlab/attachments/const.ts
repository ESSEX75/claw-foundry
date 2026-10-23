/** Owns GitLab attachment publication identifiers and policies used by this capability. */

/** GitLab resource paths resolved against confirmed installation/project context. */
export const GITLAB_UPLOAD_PATH = {
  API: "/api/v4/projects/",
  ENDPOINT: "/uploads",
  FILES: "/uploads/",
  PROJECT: "/-/project/",
} as const;

/** Temporary resources and cleanup bounds owned exclusively by GitLab multipart transport. */
export const GITLAB_ATTACHMENT_STORAGE = {
  TEMP_PREFIX: "claw-foundry-upload-",
  FILE_PREFIX: "attachment-",
  CREATE_FLAG: "wx",
  FILE_MODE: 0o600,
  CLEANUP_RETRIES: 3,
  CLEANUP_DELAY_MS: 100,
} as const;

/** Project upload resource pattern with an opaque secret and one filename. */
export const GITLAB_UPLOAD_PATH_PATTERN = /^\/uploads\/[a-fA-F0-9]{32}\/[^/?#\\]+$/;

/** Control characters cannot identify an externally published attachment filename. */
export const GITLAB_FILENAME_CONTROL_LIMIT = 32;

/** Host-scoped GitLab credential lookup command identifiers. */
export const GITLAB_CREDENTIAL_CLI = {
  /** Select CLI configuration operations. */
  CONFIG: "config",
  /** Read a configured credential. */
  GET: "get",
  /** Select the authentication credential. */
  TOKEN: "token",
  /** Scope credentials to the confirmed GitLab host. */
  HOST: "--host",
} as const;

/** Curl multipart submission command and flags; uploads execute once. */
export const GITLAB_UPLOAD_CLI = {
  /** Submit multipart bytes through curl. */
  EXECUTABLE: "curl",
  /** Ignore local curl configuration. */
  DISABLE: "--disable",
  /** Suppress progress output. */
  SILENT: "--silent",
  /** Fail for rejected HTTP requests. */
  FAIL: "--fail",
  /** Preserve failure diagnostics in silent mode. */
  SHOW_ERROR: "--show-error",
  /** Supply the host-scoped authentication header. */
  HEADER: "--header",
  /** Supply multipart file content. */
  FORM: "--form",
} as const;

/** Host-scoped authentication header used for GitLab multipart submission. */
export const GITLAB_UPLOAD_TOKEN_HEADER = "PRIVATE-TOKEN";

/** Multipart form field accepted by GitLab project uploads. */
export const GITLAB_UPLOAD_FILE_FIELD = "file";
