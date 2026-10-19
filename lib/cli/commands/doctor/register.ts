/**
 * Registers the shared DevClaw doctor CLI and renders routing/isolation diagnostics.
 */

import type { Command } from "commander";

import { runWorkspaceDiagnostics } from "../../../application/index.js";
import { type AdministrativeCliContext, requireWorkspace } from "../../runtime/index.js";
import { printDoctorReport } from "./output.js";

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

      const report = await runWorkspaceDiagnostics(ctx.runtime, workspace);

      printDoctorReport(report);

      if (!report.ok) process.exitCode = 1;
    });
}
