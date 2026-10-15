/** Owns locked channel linking and removal while adapters format the committed results. */

import { log as auditLog } from "../../audit.js";
import { parseNotificationEndpoint, readProjects, updateProjects } from "../../state/index.js";
import { validateDestinationAvailability, validateProjectRoute } from "../setup/index.js";
import { allocateEndpointName, matchesProjectRoute, selectProject } from "./selection.js";
import type { LinkProjectChannelInput, ProjectChannelInput, ProjectChannelResult } from "./types.js";

/** Link an exact route, rechecking owner, conflicts and binding names under the registry lock.
 * @param input - Explicit owner, destination and current routing configuration.
 */
export async function linkProjectChannel(input: LinkProjectChannelInput): Promise<ProjectChannelResult> {
  const result = await updateProjects(input.workspaceDir, current => {
    const data = structuredClone(current);
    const project = selectProject(data, input.projectRef);

    if (project.agentId !== input.agentId) throw new Error(`Project "${project.slug}" belongs to agent "${project.agentId}".`);
    const existing = project.channels.find(endpoint => matchesProjectRoute(endpoint, input.route));
    const endpoint = existing ?? parseNotificationEndpoint({ ...input.route,
      name: allocateEndpointName(project, input.name, input.route.channel) });

    validateProjectRoute(input.getConfig(), input.agentId, endpoint);
    validateDestinationAvailability(data, project.slug, endpoint);
    if (!existing) project.channels.push(endpoint);

    return { data, result: { project, endpoint, changed: !existing } };
  });

  if (result.changed) await auditLog(input.workspaceDir, "channel_link", {
    projectSlug: result.project.slug, agentId: input.agentId, ...result.endpoint,
  });

  return result;
}

/** Preview or remove one route; the final endpoint cannot be removed even by concurrent calls.
 * This preserves the existing administrative authorization policy.
 * @param input - Exact project and route selection plus explicit confirmation.
 */
export async function unlinkProjectChannel(input: ProjectChannelInput & { confirm: boolean }): Promise<ProjectChannelResult> {
  const inspect = (data: Awaited<ReturnType<typeof readProjects>>) => {
    const project = selectProject(data, input.projectRef);
    const index = project.channels.findIndex(endpoint => matchesProjectRoute(endpoint, input.route));
    const endpoint = project.channels[index];

    if (!endpoint) throw new Error(`Channel ${input.route.channelId} not found in project "${project.name}".`);
    if (project.channels.length === 1) throw new Error("Cannot remove the last project channel.");

    return { project, endpoint, index };
  };

  if (!input.confirm) {
    const { project, endpoint } = inspect(await readProjects(input.workspaceDir));

    return { project, endpoint, changed: false };
  }

  const result = await updateProjects(input.workspaceDir, current => {
    const data = structuredClone(current);
    const { project, endpoint, index } = inspect(data);

    project.channels.splice(index, 1);

    return { data, result: { project, endpoint, changed: true } };
  });

  await auditLog(input.workspaceDir, "channel_unlink", { projectSlug: result.project.slug, ...result.endpoint });

  return result;
}
