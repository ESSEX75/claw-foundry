/** Owns filename limits and fallback names at the provider attachment boundary. */

/** Isolated upload staging resources; display names never become directory paths. */
export const PROVIDER_ATTACHMENT_STORAGE = {
  FALLBACK_NAME: "file",
  MAX_NAME_LENGTH: 180,
} as const;

/** HTTP schemes permitted for confirmed project and attachment URLs. */
export const PROVIDER_ATTACHMENT_URL_PROTOCOL = {
  /** Allow encrypted HTTP resource locations. */
  HTTPS: "https:",
  /** Allow plain HTTP locations supplied by the confirmed provider. */
  HTTP: "http:",
} as const;
