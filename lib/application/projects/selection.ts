/** Selects projects and exact routes without inferring ownership from endpoint order. */

import type { NotificationEndpoint, Project } from "../../domain/index.js";
import type { ProjectsData } from "../../state/index.js";
import type { ProjectRoute } from "./types.js";

/** Resolve a canonical slug or one unambiguous project display name.
 * @param data - Validated registry snapshot.
 * @param reference - Explicit project selection.
 */
export function selectProject(data: ProjectsData, reference: string): Project {
  const slug = reference.toLowerCase().trim().replace(/\s+/g, "-");
  const exact = data.projects[slug];

  if (exact) return exact;
  const matches = Object.values(data.projects).filter(project => project.name.toLowerCase() === reference.trim().toLowerCase());

  if (matches.length !== 1 || !matches[0]) throw new Error(`Project "${reference}" not found or ambiguous.`);

  return matches[0];
}

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
