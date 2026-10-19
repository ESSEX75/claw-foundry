/** Coordinates explicit manual health scope, one gateway observation and independent project inspections. */

import { log as auditLog } from "../../../../audit.js";
import { fetchGatewaySessions } from "../../../../integrations/index.js";
import { loadConfig, parseProjectSlug, readProjects } from "../../../../state/index.js";
import { resolveProvider } from "../../../projects/context/index.js";
import { WORKER_HEALTH_AUDIT } from "./const.js";
import { healthInspectionFailure } from "./inspection-failure.js";
import { performHealthPass } from "./pass.js";
import type { HealthFix, InspectWorkerHealthInput, InspectWorkerHealthResult } from "./types.js";

/** Inspect an exact project or all registered projects, retaining each independent operational failure.
 * Diagnosis never imports provider-only issues. Only explicitly requested remedies mutate runtime state;
 * the manual command retains its audit event independently of issue/slot ownership.
 * @param input - Explicit scope, remediation mode and runtime-owned transport.
 */
export async function inspectWorkerHealth(input: InspectWorkerHealthInput): Promise<InspectWorkerHealthResult> {
  if (input.projectSlug !== undefined) parseProjectSlug(input.projectSlug);
  const data = await readProjects(input.workspaceDir);
  const selected = input.projectSlug !== undefined && Object.hasOwn(data.projects, input.projectSlug) ? data.projects[input.projectSlug] : undefined;

  if (input.projectSlug !== undefined && !selected) throw new Error(`Project "${input.projectSlug}" not found.`);
  const projects = selected ? [selected] : Object.values(data.projects);
  const fix = input.fix ?? false;
  const sessions = projects.length ? await fetchGatewaySessions(undefined, input.runCommand) : null;
  const issues: HealthFix[] = [];

  for (const project of projects) {
    try {
      const resolvedConfig = await loadConfig(input.workspaceDir, project.slug);
      const provider = input.providerForProject ? await input.providerForProject(project)
        : (await resolveProvider(input.workspaceDir, project, input.runCommand)).provider;

      issues.push(...await performHealthPass({ workspaceDir: input.workspaceDir, projectSlug: project.slug, project,
        provider, resolvedConfig, sessions, autoFix: fix, runCommand: input.runCommand, agentId: project.agentId,
        staleWorkerHours: resolvedConfig.timeouts.staleWorkerHours, stallTimeoutMinutes: resolvedConfig.timeouts.stallTimeoutMinutes }));
    } catch (error) {
      issues.push(healthInspectionFailure(project, "", error));
    }
  }

  await auditLog(input.workspaceDir, WORKER_HEALTH_AUDIT.INSPECTION, { projectCount: projects.length, fix,
    issuesFound: issues.length, issuesFixed: issues.filter(issue => issue.fixed).length,
    sessionsCached: sessions?.sessions.size ?? 0, sessionInventoryComplete: sessions?.complete ?? false });

  return { success: issues.every(issue => issue.error === undefined), fix, projectsScanned: projects.length,
    sessionsQueried: sessions?.sessions.size ?? 0, sessionInventoryComplete: sessions?.complete ?? false, issues };
}
