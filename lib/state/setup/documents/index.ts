/** Exposes setup-internal document creation and atomic replacement contracts. */

export { copyIfMissing, fileExists, writeIfMissing } from "./create-only.js";
export { backupAndWrite, updateDocument } from "./replacement.js";
export type { WorkspaceWriteResult } from "./types.js";
