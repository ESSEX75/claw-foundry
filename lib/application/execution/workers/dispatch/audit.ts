/** Writes worker dispatch audit records without owning dispatch decisions. */

import { log as auditLog } from "../../../../state/index.js";
import { WORKER_AUDIT_EVENT } from "../const.js";
import type { AuditDispatchOptions } from "./types.js";

/**
 * Record dispatch identity and model selection after the worker receives its task.
 * @param workspaceDir - Workspace whose audit log receives the events.
 * @param opts - Complete dispatch metadata persisted for diagnostics.
 */
export async function auditDispatch(workspaceDir: string, opts: AuditDispatchOptions): Promise<void> {
  await auditLog(workspaceDir, WORKER_AUDIT_EVENT.DISPATCH, {
    project: opts.project,
    issue: opts.issueId, issueTitle: opts.issueTitle,
    role: opts.role, level: opts.level,
    sessionAction: opts.sessionAction, sessionKey: opts.sessionKey,
    labelTransition: `${opts.fromLabel} → ${opts.toLabel}`,
  });
  await auditLog(workspaceDir, WORKER_AUDIT_EVENT.MODEL_SELECTION, {
    issue: opts.issueId, role: opts.role, level: opts.level, model: opts.model,
  });
}
