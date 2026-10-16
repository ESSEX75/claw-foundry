/** Exposes explicit, audited worker-delivery recovery through the DevClaw CLI. */

import type { Command } from "commander";

import { resolveWorkerDelivery } from "../../application/index.js";
import { WORKER_DELIVERY_RESOLUTION } from "../../domain/index.js";
import { type AdministrativeCliContext, parseIssueId, requireExclusiveMode, requireWorkspace } from "../input/index.js";
import type { WorkerDeliveryCommandOptions } from "./types.js";

/**
 * Register a preview and apply command for a verified uncertain worker turn.
 * @param parent - DevClaw command group receiving the recovery command.
 * @param ctx - Plugin runtime supplying workspace and provider command access.
 */
export function registerWorkerDeliveryCommand(parent: Command, ctx: AdministrativeCliContext): void {
  parent.command("worker-delivery")
    .description("Resolve an uncertain worker turn after inspecting its run")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--issue <id>", "Issue ID")
    .requiredOption("--session-key <key>", "Exact worker session key shown by task status")
    .requiredOption("--delivery-id <id>", "Exact delivery operation ID shown by task status")
    .requiredOption("--decision <decision>", "confirmed-started or confirmed-not-started")
    .requiredOption("--reason <text>", "Operator evidence written to the audit log")
    .option("--dry-run", "Preview the fresh issue and slot decision")
    .option("--apply", "Apply the explicitly verified decision")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: WorkerDeliveryCommandOptions) => {
      requireExclusiveMode(opts.dryRun, opts.apply);
      const issueId = parseIssueId(opts.issue);

      if (opts.decision !== WORKER_DELIVERY_RESOLUTION.CONFIRMED_STARTED
        && opts.decision !== WORKER_DELIVERY_RESOLUTION.CONFIRMED_NOT_STARTED) {
        throw new Error(`Invalid worker delivery decision: ${opts.decision}`);
      }

      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);
      const result = await resolveWorkerDelivery({
        workspaceDir, projectSlug: opts.project, issueId,
        sessionKey: opts.sessionKey, deliveryId: opts.deliveryId, decision: opts.decision,
        reason: opts.reason, apply: opts.apply === true,
        runCommand: ctx.runCommand,
      });

      console.log(JSON.stringify(result, null, 2));
    });
}
