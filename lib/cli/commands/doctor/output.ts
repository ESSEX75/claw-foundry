/** Renders the complete read-only application doctor report for terminal operators. */

import { DOCTOR_SEVERITY, type WorkspaceDiagnosticsReport } from "../../../application/index.js";

/** Display routing, tool isolation and archive diagnostics without deriving new health state.
 * @param report - Application-owned diagnostic evidence and counters.
 */
export function printDoctorReport(report: WorkspaceDiagnosticsReport): void {
  console.log("Claw Foundry doctor — routing and isolation");
  for (const finding of report.findings) {
    console.log(`${finding.severity === DOCTOR_SEVERITY.ERROR ? "ERROR" : "OK"} [${finding.code}] ${finding.message}`);
  }

  console.log("\nAgent tool access:");
  for (const agent of report.agents) {
    console.log(`  ${agent.agentId}: ${agent.clawFoundryToolsAllowed ? "allowed" : "denied"}`);
  }

  console.log("\nIssue archives:");
  for (const archive of report.archives) {
    console.log(
      `  ${archive.projectSlug}: active=${archive.active}, terminalWaiting=${archive.terminalWaitingArchive}, `
      + `archived=${archive.archived}, providerDeleted=${archive.providerDeleted}, `
      + `purgeEligible=${archive.purgeEligible}, attachmentsBytes=${archive.attachmentsRetainedBytes}`,
    );
  }
}
