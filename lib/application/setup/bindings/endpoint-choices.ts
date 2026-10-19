/** Enumerates configured group/topic candidates using the same exact-route policy as binding planning. */

import type { RouteConfig } from "../../project-routing/index.js";
import { TOPIC_PEER_SEPARATOR } from "../../project-routing/index.js";
import { inspectPlannedChannelBinding } from "./binding-manager.js";
import { ROUTING_INVENTORY_WILDCARD, SETUP_NOTIFICATION_CHANNELS } from "./const.js";
import { isRoutingSettingsRecord } from "./guards.js";
import type { SetupEndpointChoice } from "./types.js";

/** List available configured endpoints, retaining own bindings and excluding conflicts and disabled accounts.
 * Wildcards never identify an exact destination. The supplied snapshot is never changed.
 * @param config - SDK routing snapshot including the existing or proposed target agent.
 * @param agentId - Exact owner for whom the binding would be planned.
 */
export function listChannelBindingChoices(config: RouteConfig, agentId: string): SetupEndpointChoice[] {
  const choices: SetupEndpointChoice[] = [];

  for (const channel of SETUP_NOTIFICATION_CHANNELS) {
    for (const [accountId, settings] of Object.entries(config.channels?.[channel]?.accounts ?? {})) {
      if (!accountId.trim() || !isRoutingSettingsRecord(settings) || !isRoutingSettingsRecord(settings.groups)) continue;

      for (const [groupId, group] of Object.entries(settings.groups)) {
        if (!groupId.trim() || groupId.trim() === ROUTING_INVENTORY_WILDCARD || !isRoutingSettingsRecord(group)) continue;
        const peers = [groupId.trim()];

        if (isRoutingSettingsRecord(group.topics)) {
          for (const topicId of Object.keys(group.topics)) {
            if (topicId.trim() && topicId.trim() !== ROUTING_INVENTORY_WILDCARD) peers.push(`${groupId.trim()}${TOPIC_PEER_SEPARATOR}${topicId.trim()}`);
          }
        }

        for (const peerId of peers) {
          if (inspectPlannedChannelBinding(config, channel, agentId, accountId, peerId).length > 0) continue;
          if (choices.some(choice => choice.channel === channel && choice.accountId === accountId.trim() && choice.peerId === peerId)) continue;
          choices.push({ channel, accountId: accountId.trim(), peerId });
        }
      }
    }
  }

  return choices;
}
