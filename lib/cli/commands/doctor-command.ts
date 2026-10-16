/**
 * Registers the shared DevClaw doctor CLI and renders routing/isolation diagnostics.
 */

import type { Command } from "commander";

import { runRoutingDoctor } from "../../application/index.js";
import { type AdministrativeCliContext,requireWorkspace } from "../input/index.js";

/** Register read-only routing diagnostics and a failing exit code for blocking findings.
 * @param parent - Parent DevClaw command group.
 * @param ctx - Configuration and command capabilities supplied by the plugin.
 */
export function registerDoctorCommand(parent: Command, ctx: AdministrativeCliContext): void {
  parent
    .command("doctor")
    .description("Validate DevClaw configuration, routing, and agent isolation")
    .option("--workspace <path>", "Workspace containing devclaw/projects.json")
    .action(async (opts: { workspace?: string }) => {
      const workspace = requireWorkspace(opts.workspace, ctx.runtime);

      const report = await runRoutingDoctor(ctx.runtime, workspace);

      console.log("DevClaw doctor — routing and isolation");
      for (const finding of report.findings) {
        console.log(`${finding.severity === "error" ? "ERROR" : "OK"} [${finding.code}] ${finding.message}`);
      }

      console.log("\nAgent tool access:");
      for (const agent of report.agents) {
        console.log(`  ${agent.agentId}: ${agent.devclawToolsAllowed ? "allowed" : "denied"}`);
      }

      console.log("\nIssue archives:");
      for (const archive of report.archives) {
        console.log(
          `  ${archive.projectSlug}: active=${archive.active}, terminalWaiting=${archive.terminalWaitingArchive}, `
          + `archived=${archive.archived}, providerDeleted=${archive.providerDeleted}, `
          + `purgeEligible=${archive.purgeEligible}, attachmentsBytes=${archive.attachmentsRetainedBytes}`,
        );
      }

      if (!report.ok) process.exitCode = 1;
    });
}
