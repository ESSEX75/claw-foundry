/** Formats operational inspection failures without suppressing other projects or roles. */

import type { Project } from "../../../../domain/index.js";
import { getErrorMessage } from "../../../../errors/index.js";
import { HEALTH_ISSUE_SEVERITY, HEALTH_ISSUE_TYPE } from "./const.js";
import type { HealthFix } from "./types.js";

/** Retain a failed inspection as explicit evidence, never as an empty healthy result.
 * @param project - Persisted project identity whose inspection failed.
 * @param role - Exact role, or empty for a project-level dependency failure.
 * @param error - Operational failure observed while reading or inspecting.
 */
export function healthInspectionFailure(project: Project, role: string, error: unknown): HealthFix {
  const message = getErrorMessage(error);

  return { issue: { type: HEALTH_ISSUE_TYPE.INSPECTION_FAILED, severity: HEALTH_ISSUE_SEVERITY.CRITICAL,
    project: project.name, projectSlug: project.slug, role, message }, fixed: false, error: message };
}
