/** Reports diagnostic storage failures through an injected sink without recursive logging or unbounded throttling state. */

import { performance } from "node:perf_hooks";

import { getErrorMessage } from "../../shared/errors/index.js";
import { AUDIT_WARNING_INTERVAL_MS } from "./const.js";
import type { AuditWarningReporter } from "./types.js";

/** Current process-wide diagnostic sink; plugin composition replaces the console fallback. */
let reporter: AuditWarningReporter = console.warn;

/** Monotonic time of the last attempt, including sink failures, so clock changes cannot defeat throttling. */
let lastWarningAt: number | undefined;

/** Set the host logger callback without retaining SDK types or altering storage policy.
 * The latest registration replaces the sink and resets its process-wide warning window.
 * @param sink - Logger callback, or undefined to restore the console fallback.
 */
export function configureAuditWarnings(sink?: AuditWarningReporter): void {
  reporter = sink ?? console.warn;
  lastWarningAt = undefined;
}

/** Attempt at most one warning per minute across this process; sink failures are also suppressed.
 * Asynchronous sinks are detached with rejection handling so a slow logger cannot block work.
 * @param workspaceDir - Workspace whose diagnostic operation failed.
 * @param event - Event identity, without its potentially sensitive payload.
 * @param error - Serialization, rotation, retention, lock or filesystem failure.
 */
export function reportAuditFailure(workspaceDir: string, event: string, error: unknown): void {
  const now = performance.now();

  if (lastWarningAt !== undefined && now >= lastWarningAt && now - lastWarningAt < AUDIT_WARNING_INTERVAL_MS) return;
  lastWarningAt = now;
  try {
    const message = `[Claw Foundry audit] Operation failed for ${JSON.stringify(event)} in ${JSON.stringify(workspaceDir)}: ${getErrorMessage(error)}`;

    void Promise.resolve(reporter(message)).catch(() => {});
  } catch {
    // A diagnostic sink must never change the outcome of the observed application operation.
  }
}
