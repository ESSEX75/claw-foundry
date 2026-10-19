/** Supported attachment orchestration and context enrichment API. */

export { manageTaskAttachments } from "./command.js";
export { processAttachmentMessage } from "./process.js";
export { formatAttachmentSize } from "./render.js";
export { extractIssueReferences, resolveAttachmentProject } from "./routing.js";
export type { AttachmentWorkspace } from "./types.js";
