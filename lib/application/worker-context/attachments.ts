/** Loads persisted attachment references for worker task context. */

import { getAttachmentPath, listAttachments } from "../../state/index.js";
import { formatAttachmentSize } from "../issue-attachments/index.js";
import type { AttachmentDisplay } from "./types.js";

/** Enrich the worker message with current persisted attachments; absence produces no section.
 * @param workspaceDir - Configured workspace root.
 * @param projectSlug - Canonical project identifier.
 * @param issueId - Provider-local issue identifier.
 */
export async function formatAttachmentsForTask(workspaceDir: string, projectSlug: string, issueId: number): Promise<string> {
  const attachments = await listAttachments(workspaceDir, projectSlug, issueId);
  const display = await Promise.all(attachments.map(async file => ({
    ...file,
    fullPath: await getAttachmentPath(workspaceDir, projectSlug, issueId, file.localPath)
  })));

  return renderAttachmentsForTask(display);
}

/** Render attachment references for a worker task message.
 * @param attachments - Metadata with validated local paths.
 */
export function renderAttachmentsForTask(attachments: AttachmentDisplay[]): string {
  if (attachments.length === 0) return "";

  const lines = ["", "## Attachments", ""];

  for (const a of attachments) {
    const sizeStr = formatAttachmentSize(a.size);
    const date = new Date(a.uploadedAt).toLocaleString();

    if (a.publicUrl) {
      lines.push(`- [${a.filename}](${a.publicUrl}) (${a.mimeType}, ${sizeStr}) — by ${a.uploader} on ${date}`);
    } else {
      const fullPath = a.fullPath;

      lines.push(`- ${a.filename} (${a.mimeType}, ${sizeStr}) — by ${a.uploader} on ${date}`);
      lines.push(`  Local path: ${fullPath}`);
    }
  }

  return lines.join("\n");
}
