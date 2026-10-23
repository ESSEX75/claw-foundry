/** Selects an existing agent, proposed agent, or explicit workspace without applying configuration. */

import { createInterface } from "node:readline/promises";

import type { SetupRuntime } from "../../../application/index.js";
import { getDefaultWorkspaceDir } from "../../runtime/index.js";
import { formatAgentLabel, getConfiguredAgents } from "./options.js";
import type { SetupCliOptions } from "./types.js";

/** Resolve an explicit target or collect one through an owned terminal session.
 * @param opts - Raw terminal options; noninteractive setup requires an explicit target.
 * @param runtime - Read-only configuration used to display active agents.
 */
export async function resolveSetupCliOptions(
  opts: SetupCliOptions,
  runtime: SetupRuntime,
): Promise<SetupCliOptions> {
  if (opts.newAgent || opts.agent || opts.workspace) return opts;
  if (!process.stdin.isTTY) {
    throw new Error(
      "Interactive setup requires a terminal. Use --new-agent <name>, --agent <id>, or --workspace <path> for non-interactive setup.",
    );
  }

  const agents = getConfiguredAgents(runtime);
  const defaultWorkspace = getDefaultWorkspaceDir(runtime);
  const defaultAgentIndex = Math.max(
    0,
    agents.findIndex((agent) => agent.workspace === defaultWorkspace),
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    console.log("Claw Foundry setup target:");
    agents.forEach((agent, index) => {
      const label = formatAgentLabel(agent);
      const workspace = agent.workspace ? ` — ${agent.workspace}` : "";

      console.log(`  ${index + 1}. Configure existing agent: ${label}${workspace}`);
    });
    const createNewOption = agents.length + 1;
    const workspaceOption = agents.length + 2;

    console.log(`  ${createNewOption}. Create a new agent`);
    console.log(`  ${workspaceOption}. Configure a workspace path directly`);

    const answer = (
      await rl.question(`Select [${defaultAgentIndex + 1}]: `)
    ).trim();
    const selected = answer ? Number(answer) : defaultAgentIndex + 1;

    if (Number.isInteger(selected) && selected >= 1 && selected <= agents.length) {
      return { ...opts, agent: agents[selected - 1]?.id };
    }

    if (selected === createNewOption) {
      const name = (await rl.question("New agent name: ")).trim();

      if (!name) throw new Error("New agent name is required");

      return { ...opts, newAgent: name };
    }

    if (selected === workspaceOption) {
      const workspace = (await rl.question("Workspace path: ")).trim();

      if (!workspace) throw new Error("Workspace path is required");

      return { ...opts, workspace };
    }

    throw new Error(`Invalid setup target: ${answer}`);
  } finally {
    rl.close();
  }
}
