/** Collects explicit model choices from effective enabled assignments for the selected setup target. */

import { getSetupModels, type SetupRuntime } from "../../../application/index.js";
import { parseModelOverrides } from "./models.js";
import type { SetupCliOptions } from "./types.js";
import type { TerminalQuestion } from "./types.js";

/** Keep existing assignments by default and submit only operator-entered overrides.
 * @param opts - Selected setup target and any already-explicit terminal overrides.
 * @param rl - Terminal question interface owned by the interactive session.
 * @param runtime - Configuration capability used by the application model query.
 */
export async function collectModelOptions(opts: SetupCliOptions, rl: TerminalQuestion, runtime: SetupRuntime): Promise<SetupCliOptions> {
  if (parseModelOverrides(opts)) return opts;
  const models = await getSetupModels({ runtime, newAgentName: opts.newAgent, agentId: opts.agent, workspacePath: opts.workspace });
  const keep = (await rl.question("\nKeep current model configuration [Y/n]: ")).trim().toLowerCase();

  if (!keep || keep === "y" || keep === "yes") return opts;
  const assignments: string[] = [];

  for (const [role, levels] of Object.entries(models)) {
    for (const [level, current] of Object.entries(levels)) {
      const answer = (await rl.question(`${role}.${level} model [${current}]: `)).trim();

      if (answer) assignments.push(`${role}.${level}=${answer}`);
    }
  }

  return assignments.length ? { ...opts, model: assignments } : opts;
}
