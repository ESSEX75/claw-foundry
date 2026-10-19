/** Formats attachment comments and task context without filesystem or provider I/O. */

import type { AttachmentMeta } from "../../state/index.js";
import { ATTACHMENT_SIZE_UNIT, IMAGE_MIME_PREFIX } from "./const.js";

/** Render provider-facing attachment references.
 * @param attachments - Successfully persisted file metadata.
 */
export function formatAttachmentComment(attachments: AttachmentMeta[]): string {
  if (attachments.length === 0) return "";

  const lines = ["📎 **Attachment(s) added via DevClaw:**", ""];

  for (const a of attachments) {
    const sizeStr = formatAttachmentSize(a.size);
    const isImage = a.mimeType.startsWith(IMAGE_MIME_PREFIX);

    if (isImage && a.publicUrl) {
      lines.push(`![${a.filename}](${a.publicUrl})`);
      lines.push(`*${a.filename}* (${sizeStr}) — uploaded by ${a.uploader}`);
    } else if (a.publicUrl) {
      lines.push(`- [${a.filename}](${a.publicUrl}) (${a.mimeType}, ${sizeStr}) — uploaded by ${a.uploader}`);
    } else {
      lines.push(`- **${a.filename}** (${a.mimeType}, ${sizeStr}) — uploaded by ${a.uploader}`);
      lines.push(`  _File stored locally. Use \`task_attach\` tool to access._`);
    }
  }

  lines.push("", `_Attached at ${new Date().toISOString()}_`);

  return lines.join("\n");
}

/** Render byte size for user and worker context.
 * @param bytes - Persisted file size.
 */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < ATTACHMENT_SIZE_UNIT) return `${bytes} B`;
  if (bytes < ATTACHMENT_SIZE_UNIT * ATTACHMENT_SIZE_UNIT) return `${(bytes / ATTACHMENT_SIZE_UNIT).toFixed(1)} KB`;

  return `${(bytes / (ATTACHMENT_SIZE_UNIT * ATTACHMENT_SIZE_UNIT)).toFixed(1)} MB`;
}
