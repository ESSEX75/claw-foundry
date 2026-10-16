/** Renders application-provided endpoint choices and collects one exact terminal selection. */

import { getSetupEndpointChoices, type SetupEndpointChoicesInput } from "../../application/index.js";
import { NO_CHANNEL_BINDING } from "./const.js";
import type { SetupCliOptions } from "./types.js";
import type { TerminalQuestion } from "./types.js";

/** Display eligible exact endpoints and return the operator's explicit choice.
 * @param rl - Terminal question interface owned by the interactive setup session.
 * @param runtime - Read-only configuration source used by application discovery.
 * @param opts - Selected existing or proposed agent identity.
 */
export async function collectChannelBinding(
  rl: TerminalQuestion,
  runtime: SetupEndpointChoicesInput["runtime"],
  opts: SetupCliOptions,
): Promise<Pick<SetupCliOptions, "channelBinding" | "channelAccountId" | "channelPeerId">> {
  const choices = getSetupEndpointChoices({ runtime, agentId: opts.agent, newAgentName: opts.newAgent });

  console.log("\nCreate a binding for an existing channel endpoint:");
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.channel} / ${choice.accountId} / ${choice.peerId}`);
  });
  const noneIndex = choices.length + 1;

  console.log(`  ${noneIndex}. none`);

  const defaultIndex = choices.length > 0 ? 1 : noneIndex;
  const answer = (await rl.question(`Select [${defaultIndex}]: `)).trim();
  const selected = answer ? Number(answer) : defaultIndex;

  if (selected === noneIndex) return { channelBinding: NO_CHANNEL_BINDING };
  const choice = Number.isInteger(selected) ? choices[selected - 1] : undefined;

  if (!choice) throw new Error(`Invalid channel account option: ${answer}`);

  return {
    channelBinding: choice.channel,
    channelAccountId: choice.accountId,
    channelPeerId: choice.peerId,
  };
}
