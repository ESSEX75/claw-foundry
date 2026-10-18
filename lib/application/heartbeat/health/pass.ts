/** Coordinates read-only worker diagnosis and optional remedies across configured roles. */

import { getConfiguredRoleIds } from "../../../state/index.js";
import { healthInspectionFailure } from "./inspection-failure.js";
import type { HealthFix, HealthPassInput } from "./types.js";
import { checkWorkerHealth } from "./worker-slot-health.js";

/** Inspect all health categories, applying remedies only when explicitly requested.
 * @param input - Project dependencies and explicit diagnosis/remediation mode.
 */
export async function performHealthPass(input: HealthPassInput): Promise<HealthFix[]> {
  const {
    workspaceDir,
    projectSlug,
    project,
    sessions,
    provider,
    resolvedConfig,
    staleWorkerHours,
    runCommand,
    stallTimeoutMinutes,
    agentId,
    autoFix,
  } = input;
  const findings: HealthFix[] = [];

  const collect = async (role: string, run: () => Promise<HealthFix[]>): Promise<void> => {
    try { findings.push(...await run()); }
    catch (error) {
      findings.push(healthInspectionFailure(project, role, error));
    }
  };

  const roles = new Set([...getConfiguredRoleIds(resolvedConfig, true), ...Object.keys(project.workers)]);

  for (const role of roles) {
    // Check worker health (session liveness, label consistency, etc)
    await collect(role, () => checkWorkerHealth({
      workspaceDir,
      projectSlug,
      project,
      role,
      roleEnabled: resolvedConfig.roles[role]?.enabled === true,
      sessions,
      autoFix,
      provider,
      workflow: resolvedConfig.workflow,
      staleWorkerHours,
      stallTimeoutMinutes,
      runCommand,
      agentId,
    }));
  }

  return findings;
}
