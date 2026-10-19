/** Owns gateway session display metadata independently of worker prompt contents. */

/**
 * Build a human-friendly session label from project name, role, and level.
 * e.g. "my-project", "developer", "medior" → "My Project — Developer (Medior)"
 *
 * @param projectName - Project display name included in worker context.
 * @param role - Configured role responsible for the workflow state or worker task.
 * @param level - Requested or resolved level from the effective role configuration.
 * @param botName - Optional worker display name.
 */
export function formatSessionLabel(projectName: string, role: string, level: string, botName?: string): string {
  const titleCase = (s: string) => s.replace(/(^|\s|-)\S/g, (c) => c.toUpperCase()).replace(/-/g, " ");
  const nameLabel = botName ? ` ${botName}` : "";

  return `${titleCase(projectName)} — ${titleCase(role)}${nameLabel} (${titleCase(level)})`;
}
