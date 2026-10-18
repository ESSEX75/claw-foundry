/**
 * Builds role/level and policy label catalogs from validated domain configuration.
 */

import type { RoleDefinition } from "../../roles/index.js";
import { DEFAULT_ROLES } from "../../roles/index.js";
import { DEFAULT_ROLE_LABEL_COLOR, ROLE_LABEL_COLORS, STEP_ROUTING_COLOR, STEP_ROUTING_LABELS } from "./const.js";
import type { LabelDefinition } from "./types.js";

/**
 * Generate all role:level label definitions from resolved config roles.
 *
 * @param roles - Resolved runtime role definitions used by the workflow.
 */
export function getRoleLabels(
  roles: Readonly<Record<string, RoleDefinition<string>>>,
): LabelDefinition[] {
  const labels: LabelDefinition[] = [];

  for (const [roleId, role] of Object.entries(roles)) {
    if (role.enabled === false) continue;
    const color = getRoleLabelColor(roleId);

    for (const level of Object.keys(role.levels)) {
      labels.push({
        name: `${roleId}:${level}`,
        color,
      });
    }
  }

  return labels;
}

/** Generate the fixed review and test routing labels understood by the workflow engine. */
export function getStepRoutingLabels(): LabelDefinition[] {
  return STEP_ROUTING_LABELS.map((name) => ({ name, color: STEP_ROUTING_COLOR }));
}

//TODO: The behavior of the tester, reviewer, etc. is hard-coded.
/**
 * Get the label color for a role. Falls back to gray for unknown roles.
 *
 * @param role - Runtime-configured role identifier to present.
 */
export function getRoleLabelColor(role: string): string {
  if (role === DEFAULT_ROLES.DEVELOPER) return ROLE_LABEL_COLORS.DEVELOPER;
  if (role === DEFAULT_ROLES.TESTER) return ROLE_LABEL_COLORS.TESTER;
  if (role === DEFAULT_ROLES.ARCHITECT) return ROLE_LABEL_COLORS.ARCHITECT;
  if (role === DEFAULT_ROLES.REVIEWER) return ROLE_LABEL_COLORS.REVIEWER;

  return DEFAULT_ROLE_LABEL_COLOR;
}
