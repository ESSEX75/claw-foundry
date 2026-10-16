/** Collects interactive terminal setup choices without applying configuration. */

import { createInterface } from "node:readline/promises";

import type { SetupRuntime } from "../../application/index.js";
import { getAllBuiltInDefaultModels, getAllRoleIds, getBuiltInLevelsForRole } from "../../roles/index.js";
import { getDefaultWorkspaceDir } from "../input/index.js";
import {
  formatAgentLabel,
  formatSelectedChannelBinding,
  getConfiguredAgents,
} from "../options/setup-options.js";
import type { SetupCliOptions } from "../options/types.js";
import { collectChannelBinding } from "./binding-prompts.js";

async function askYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultValue: boolean,
): Promise<boolean> {
  const suffix = defaultValue ? " [Y/n]: " : " [y/N]: ";
  const answer = (await rl.question(question + suffix)).trim().toLowerCase();

  if (!answer) return defaultValue;

  return answer === "y" || answer === "yes";
}

function hasModelOverrides(opts: SetupCliOptions): boolean {
  for (const role of getAllRoleIds()) {
    for (const level of getBuiltInLevelsForRole(role)) {
      const key = `${role}${level.charAt(0).toUpperCase()}${level.slice(1)}`;

      if (opts[key]) return true;
    }
  }

  return false;
}

async function collectModelOptions(
  opts: SetupCliOptions,
  rl: ReturnType<typeof createInterface>,
): Promise<SetupCliOptions> {
  if (hasModelOverrides(opts)) return opts;

  const useDefaults = await askYesNo(rl, "\nKeep current model configuration", true);

  if (useDefaults) return opts;

  const defaults = getAllBuiltInDefaultModels();
  const next = { ...opts };

  for (const role of getAllRoleIds()) {
    for (const level of getBuiltInLevelsForRole(role)) {
      const key = `${role}${level.charAt(0).toUpperCase()}${level.slice(1)}`;
      const defaultModel = defaults[role]?.[level] ?? "";
      const answer = (await rl.question(`${role}.${level} model [${defaultModel}]: `)).trim();

      if (answer) next[key] = answer;
    }
  }

  return next;
}

export async function collectInteractiveSetupDetails(
  opts: SetupCliOptions,
  runtime: SetupRuntime,
): Promise<SetupCliOptions> {
  if (!process.stdin.isTTY || opts.ejectDefaults || opts.resetDefaults || opts.refreshInstructions) return opts;

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    let next = { ...opts };

    if ((next.newAgent || next.agent) && !next.channelBinding) {
      next = { ...next, ...await collectChannelBinding(rl, runtime, next) };
    }

    next = await collectModelOptions(next, rl);

    return next;
  } finally {
    rl.close();
  }
}

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
    console.log("DevClaw setup target:");
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

export function printSelectedSetupTarget(opts: SetupCliOptions, runtime: SetupRuntime): void {
  const agents = getConfiguredAgents(runtime);

  if (opts.agent) {
    const agent = agents.find((entry) => entry.id === opts.agent);

    console.log("\nSelected setup target:");
    console.log(`  Agent: ${agent ? formatAgentLabel(agent) : opts.agent}`);
    if (agent?.workspace) console.log(`  Workspace: ${agent.workspace}`);
    console.log(`  Channel binding: ${formatSelectedChannelBinding(opts)}`);

    return;
  }

  if (opts.newAgent) {
    console.log("\nSelected setup target:");
    console.log(`  New agent: ${opts.newAgent}`);
    console.log(`  Channel binding: ${formatSelectedChannelBinding(opts)}`);

    return;
  }

  if (opts.workspace) {
    console.log("\nSelected setup target:");
    console.log(`  Workspace: ${opts.workspace}`);
  }
}
