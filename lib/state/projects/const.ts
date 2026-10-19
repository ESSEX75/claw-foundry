/** Defines persistence policies owned by the projects registry. */

import type { FileLockOptions } from "../persistence/index.js";

/** Device basenames Windows reserves even when they satisfy lowercase kebab-case. */
export const RESERVED_PROJECT_SLUG_PATTERN = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/** Lock policy applied to immutable projects-registry transactions. */
export const PROJECTS_LOCK_OPTIONS: FileLockOptions = {
  retryMs: 50,
  staleMs: 30_000,
  timeoutMs: 10_000,
};
