/** Shares exact endpoint matching and locked name allocation across project commands. */

import type { NotificationEndpoint, Project } from "../../domain/index.js";
import type { ProjectRoute } from "./types.js";

/** Compare every persisted route coordinate, including an absent thread.
 * @param endpoint - Candidate registered destination.
 * @param route - Explicit destination selected by the caller.
 */
export function matchesProjectRoute(endpoint: NotificationEndpoint, route: ProjectRoute): boolean {
  return endpoint.channel === route.channel && endpoint.accountId === route.accountId
    && endpoint.channelId === route.channelId && endpoint.threadId === route.threadId;
}

/** Allocate an unused binding name from the fresh registry snapshot.
 * @param project - Project being changed under its registry lock.
 * @param requested - Explicit binding name, if supplied.
 * @param channel - Transport whose binding namespace must remain unique.
 */
export function allocateEndpointName(project: Project, requested: string | undefined, channel: string): string {
  const names = new Set(project.channels.filter(endpoint => endpoint.channel === channel).map(endpoint => endpoint.name));

  if (requested) {
    if (names.has(requested)) throw new Error(`Endpoint name "${requested}" already exists for ${channel}.`);

    return requested;
  }

  let index = project.channels.length + 1;

  while (names.has(`channel-${index}`)) index++;

  return `channel-${index}`;
}
