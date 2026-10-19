/** Attachment persistence API exposed through the state root. */

export * from "./cleanup/index.js";
export { getAttachmentPath, listAttachments, readAttachmentSource, saveAttachment, updateAttachmentPublicUrl } from "./repository.js";
export type { AttachmentFile, AttachmentMeta } from "./types.js";
