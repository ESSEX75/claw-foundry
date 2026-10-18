/** Collects interactive terminal setup choices without applying configuration. */

import { createInterface } from "node:readline/promises";

import type { SetupRuntime } from "../../../application/index.js";
import { collectChannelBinding } from "./binding-prompts.js";
import { collectModelOptions } from "./model-prompts.js";
import type { SetupCliOptions } from "./types.js";

/** Own the interactive detail session and close readline on success or failure.
 * @param opts - Selected target and explicit CLI flags.
 * @param runtime - Configuration capabilities for application-backed menus.
 */
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

    next = await collectModelOptions(next, rl, runtime);

    return next;
  } finally {
    rl.close();
  }
}
