/** Audit operations owned by project and exact channel ownership commands. */

/** Stable persisted audit names for project mutations. */
export const PROJECT_AUDIT_EVENT = {
  REGISTER: "project_register",
  CHANNEL_LINK: "channel_link",
  CHANNEL_UNLINK: "channel_unlink",
} as const;
