/**
 * Tick runner — main heartbeat loop that processes each project.
 */

import { log as auditLog } from "../../audit.js";
import { EXECUTION_MODE } from "../../domain/index.js";
import { loadInstanceName } from "../../instance.js";
import { createProvider } from "../../integrations/index.js";
import { loadConfig } from "../../state/index.js";
import { readProjects } from "../../state/index.js";
import { projectTick } from "../queue/index.js";
import { HEARTBEAT_AUDIT_EVENT, HEARTBEAT_PASS, HEARTBEAT_PASS_FAILURE_POLICY } from "./const.js";
import { performHealthPass } from "./health/index.js";
import { performIssueArchivePass, performIssueCreationPass, performProjectionIntegrityPass } from "./maintenance-passes.js";
import { runHeartbeatPasses } from "./pass-runner.js";
import { performReviewPass, performReviewSkipPass } from "./review/index.js";
import { mayScheduleProject } from "./scheduler.js";
import { testSkipPass } from "./test/index.js";
import type { HeartbeatRunInput, HeartbeatTickResult } from "./types.js";

const MAX_SKIP_REASON_LENGTH = 300;

function auditSkipReason(reason: string): string {
  return reason
    .replace(/\b(Bearer|Basic)\s+\S+/gi, "$1 [REDACTED]")
    .replace(/(https?:\/\/)[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/([?&](?:token|key|secret|password|access_token|api_key)=)[^\s&#]+/gi, "$1[REDACTED]")
    .replace(/\b(authorization|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, MAX_SKIP_REASON_LENGTH);
}

// ---------------------------------------------------------------------------
// Tick (Main Heartbeat Loop)
// ---------------------------------------------------------------------------

/** Coordinate ordered project maintenance and queue scheduling with project failure isolation.
 * @param opts - Workspace, gateway observations, scheduling limits, and runtime capabilities.
 */
export async function tick(opts: HeartbeatRunInput): Promise<HeartbeatTickResult> {
  const { workspaceDir, agentId, config, pluginConfig, sessions, runtime, runCommand } = opts;

  // Load instance name for ownership filtering and auto-claiming
  const resolvedWorkspaceConfig = await loadConfig(workspaceDir);
  const instanceName = await loadInstanceName(workspaceDir, resolvedWorkspaceConfig.instanceName);

  const data = await readProjects(workspaceDir);
  const slugs = Object.keys(data.projects);

  if (slugs.length === 0) {
    return {
      totalPickups: 0,
      totalHealthFixes: 0,
      totalSkipped: 0,
      skipDetails: [],
      totalReviewTransitions: 0,
      totalReviewSkipTransitions: 0,
      totalTestSkipTransitions: 0,
      totalArchived: 0,
      totalCreationsReady: 0,
      totalCreationsPending: 0,
      totalCreationsManual: 0,
      passes: [],
    };
  }

  const result: HeartbeatTickResult = {
    totalPickups: 0,
    totalHealthFixes: 0,
    totalSkipped: 0,
    skipDetails: [],
    totalReviewTransitions: 0,
    totalReviewSkipTransitions: 0,
    totalTestSkipTransitions: 0,
    totalArchived: 0,
    totalCreationsReady: 0,
    totalCreationsPending: 0,
    totalCreationsManual: 0,
    passes: [],
  };

  const projectExecution =
    pluginConfig?.projectExecution === EXECUTION_MODE.SEQUENTIAL ? EXECUTION_MODE.SEQUENTIAL : EXECUTION_MODE.PARALLEL;

  for (const slug of slugs) {
    try {
      const project = data.projects[slug];

      if (!project || (agentId && project.agentId !== agentId)) continue;

      const resolvedConfig = await loadConfig(workspaceDir, project.slug);
      const provider = opts.providerFactory ? await opts.providerFactory(project) : (await createProvider({ repo: project.repo, provider: project.provider, runCommand })).provider;

      const recovered = await runHeartbeatPasses(slug, [
        { name: HEARTBEAT_PASS.CREATION, run: async () => {
          const creations = await performIssueCreationPass(workspaceDir, project, provider, resolvedConfig);

          result.totalCreationsReady += creations.ready;
          result.totalCreationsPending += creations.pending;
          result.totalCreationsManual += creations.manual;
        } },
        { name: HEARTBEAT_PASS.PROJECTION, run: async () => {
          await performProjectionIntegrityPass(workspaceDir, project, provider, resolvedConfig);
        } },
        { name: HEARTBEAT_PASS.ARCHIVE, run: async () => {
          result.totalArchived += await performIssueArchivePass(workspaceDir, project, provider, resolvedConfig, pluginConfig, runtime, runCommand);
        } },
        { name: HEARTBEAT_PASS.HEALTH, run: async () => {
          const fixes = await performHealthPass({
            workspaceDir, projectSlug: slug, project, sessions, provider, resolvedConfig,
            staleWorkerHours: resolvedConfig.timeouts.staleWorkerHours, runCommand,
            stallTimeoutMinutes: resolvedConfig.timeouts.stallTimeoutMinutes, agentId, autoFix: true,
          });

          result.totalHealthFixes += fixes.filter((fix) => fix.fixed).length;

          return fixes;
        } },
      ], result.passes);

      if (!recovered) {
        const failedPass = result.passes.at(-1);
        const reason = `${failedPass?.name ?? "unknown"}: ${failedPass?.errors.join("; ") ?? "unknown error"}`;

        opts.logger.warn(`Heartbeat pass failed for project ${slug}: ${reason}`);

        result.skipDetails.push({ project: slug, code: "pass_failed", reason: auditSkipReason(reason) });
        result.totalSkipped++;
        continue;
      }

      const workflowReportStart = result.passes.length;
      const advanced = await runHeartbeatPasses(slug, [
        { name: HEARTBEAT_PASS.REVIEW, run: async () => {
          result.totalReviewTransitions += await performReviewPass(workspaceDir, slug, project, provider, resolvedConfig, pluginConfig, runtime, runCommand);
        } },
        { name: HEARTBEAT_PASS.REVIEW_SKIP, run: async () => {
          result.totalReviewSkipTransitions += await performReviewSkipPass(workspaceDir, slug, project, provider, resolvedConfig, pluginConfig, runtime, runCommand);
        } },
        { name: HEARTBEAT_PASS.TEST_SKIP, run: async () => {
          result.totalTestSkipTransitions += await testSkipPass({
            workspaceDir, projectName: slug, project, provider, workflow: resolvedConfig.workflow,
          });
        } },
      ], result.passes, HEARTBEAT_PASS_FAILURE_POLICY.CONTINUE);

      if (!advanced) {
        const failures = result.passes.slice(workflowReportStart)
          .filter((pass) => pass.errors.length > 0)
          .map((pass) => `${pass.name}: ${pass.errors.join("; ")}`);

        opts.logger.warn(`Heartbeat workflow failed for project ${slug}: ${failures.join("; ")}`);
        result.skipDetails.push({ project: slug, code: "workflow_pass_failed", reason: auditSkipReason(failures.join("; ")) });
        result.totalSkipped++;
        continue;
      }

      // Budget limits dispatch only; later projects still receive maintenance.
      const remaining = config.maxPickupsPerTick - result.totalPickups;

      if (remaining <= 0) continue;

      // Include all currently active projects, including projects later in registry order.
      // Re-read after maintenance so completed workers no longer block scheduling.
      const freshProjects = await readProjects(workspaceDir);

      if (!mayScheduleProject(slug, freshProjects.projects, projectExecution)) {
        result.skipDetails.push({ project: slug, code: "project_blocked", reason: "Project execution limit reached" });
        result.totalSkipped++;
        continue;
      }

      // Tick pass: fill free worker slots
      const tickResult = await projectTick({
        workspaceDir,
        projectSlug: slug,
        agentId,
        provider,
        pluginConfig,
        maxPickups: remaining,
        instanceName,
        runtime,
        runCommand,
      });

      result.totalPickups += tickResult.pickups.length;
      result.totalSkipped += tickResult.skipped.length;
      result.skipDetails.push(...tickResult.skipped.map((skip) => ({
        project: slug,
        ...(skip.role === undefined ? {} : { role: skip.role }),
        ...(skip.issueId === undefined ? {} : { issueId: skip.issueId }),
        code: skip.code ?? "queue_skipped",
        reason: auditSkipReason(skip.reason),
      })));

    } catch (err) {
      // Per-project isolation: one failing project doesn't crash the entire tick
      const reason = err instanceof Error ? err.message : String(err);

      opts.logger.warn(`Heartbeat tick failed for project ${slug}: ${reason}`);

      result.skipDetails.push({ project: slug, code: "tick_failed", reason: auditSkipReason(reason) });
      result.totalSkipped++;
    }
  }

  await auditLog(workspaceDir, HEARTBEAT_AUDIT_EVENT.TICK, {
    projectsScanned: slugs.length,
    healthFixes: result.totalHealthFixes,
    reviewTransitions: result.totalReviewTransitions,
    reviewSkipTransitions: result.totalReviewSkipTransitions,
    testSkipTransitions: result.totalTestSkipTransitions,
    archived: result.totalArchived,
    pickups: result.totalPickups,
    skipped: result.totalSkipped,
    skipDetails: result.skipDetails,
  });

  return result;
}
