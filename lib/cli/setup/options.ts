/** Normalizes terminal choices and formats read-only agent configuration. */

import {
  isSetupNotificationChannel,
  type SetupNotificationChannel,
} from "../../application/index.js";
import { EXECUTION_MODE, type ExecutionMode } from "../../domain/index.js";
import { type ConfiguredAgent, listConfiguredAgents } from "../../integrations/index.js";
import { type CliConfigRuntime, readCliConfig } from "../input/index.js";
import { NO_CHANNEL_BINDING } from "./const.js";
import type { SetupCliOptions } from "./types.js";

/** Optional presentation metadata retained from the canonical integration agent type. */
type AgentDisplayMetadata = {
  /** Configured human-readable name displayed beside the canonical identity. */
  name?: string;
};

/** Read configured agents without suppressing configuration failures.
 * @param runtime - Read-only configuration source.
 */
export function getConfiguredAgents(runtime: CliConfigRuntime): readonly ConfiguredAgent<AgentDisplayMetadata>[] {
  return listConfiguredAgents(readCliConfig(runtime));
}

/** Format an agent choice without changing its identifier.
 * @param agent - Configured agent to display.
 */
export function formatAgentLabel(agent: ConfiguredAgent<AgentDisplayMetadata>): string {
  return agent.name && agent.name !== agent.id ? `${agent.name} (${agent.id})` : agent.id;
}

/** Format the selected exact destination for terminal output.
 * @param opts - Selected channel, account, and peer options.
 */
export function formatSelectedChannelBinding(opts: Pick<SetupCliOptions, "channelBinding" | "channelAccountId" | "channelPeerId">): string {
  if (!opts.channelBinding || opts.channelBinding === NO_CHANNEL_BINDING) return NO_CHANNEL_BINDING;
  const account = opts.channelAccountId?.trim() || "missing-account";

  return opts.channelPeerId?.trim()
    ? `${opts.channelBinding}/${account}/${opts.channelPeerId.trim()}`
    : `${opts.channelBinding}/${account}`;
}

/** Convert the explicit none selection and validate channel membership.
 * @param value - Parsed terminal channel option.
 */
export function normalizeChannelBinding(
  value: SetupCliOptions["channelBinding"],
): SetupNotificationChannel | null | undefined {
  if (value === undefined) return undefined;
  if (value === NO_CHANNEL_BINDING) return null;
  if (isSetupNotificationChannel(value)) return value;
  throw new Error(`Invalid channel binding: ${value}. Use telegram, whatsapp, or none.`);
}

/** Validate the terminal execution-mode option.
 * @param value - Parsed execution-mode selection.
 */
export function normalizeProjectExecution(value: SetupCliOptions["projectExecution"]): ExecutionMode | undefined {
  if (value === undefined) return undefined;
  if (value === EXECUTION_MODE.PARALLEL || value === EXECUTION_MODE.SEQUENTIAL) return value;
  throw new Error(`Invalid project execution mode: ${value}. Use parallel or sequential.`);
}
