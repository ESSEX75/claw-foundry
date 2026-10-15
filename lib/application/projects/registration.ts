/** Coordinates provider provisioning, locked registration and resumable create-only scaffolding. */

import { log as auditLog } from "../../audit.js";
import { emptyRoleWorkerState, type Project, type RoleWorkerState } from "../../domain/index.js";
import { createProvider } from "../../integrations/index.js";
import {
  getConfiguredRoleIds, getLevelMaxWorkers, loadConfig, parseNotificationEndpoint, parseProjectSlug,
  readProjects, resolveRepoPath, scaffoldProjectOverrides, updateProjects,
} from "../../state/index.js";
import { provisionLabelCatalog } from "../labels/index.js";
import { validateDestinationAvailability, validateProjectRoute } from "../setup/index.js";
import { allocateEndpointName, matchesProjectRoute } from "./selection.js";
import type { RegisterProjectInput, RegisterProjectResult } from "./types.js";

/** Reject reuse of a project slug for a different repository, branch set or owner.
 * @param project - Existing registry identity.
 * @param input - Requested registration intent.
 */
function validateRegistrationIdentity(project: Project, input: RegisterProjectInput): void {
  if (project.agentId !== input.agentId) throw new Error(`Project "${project.slug}" belongs to agent "${project.agentId}".`);
  if (resolveRepoPath(project.repo) !== resolveRepoPath(input.repo) || project.baseBranch !== input.baseBranch
    || project.deployBranch !== (input.deployBranch ?? input.baseBranch)) {
    throw new Error(`Project "${project.slug}" repository or branches differ; use channel_link to add a route without changing its identity.`);
  }
}

/** Register a project or idempotently link a matching existing identity; scaffold failures remain retryable.
 * Provider provisioning precedes registry commit and is idempotent, not transactional with local state.
 * @param input - Validated registration intent and plugin-owned transports.
 */
export async function registerProject(input: RegisterProjectInput): Promise<RegisterProjectResult> {
  const slug = parseProjectSlug(input.name.toLowerCase().trim().replace(/\s+/g, "-"));
  const snapshot = await readProjects(input.workspaceDir);
  const existing = snapshot.projects[slug];

  if (existing) validateRegistrationIdentity(existing, input);
  const requested = parseNotificationEndpoint({ ...input.route, name: "primary" });

  validateProjectRoute(input.getConfig(), input.agentId, requested);
  validateDestinationAvailability(snapshot, slug, requested);
  const config = await loadConfig(input.workspaceDir, slug);
  const { provider, type } = await createProvider({ repo: existing?.repo ?? input.repo,
    provider: existing?.provider, runCommand: input.runCommand });

  if (!await provider.healthCheck()) throw new Error(`Provider health check failed for ${input.repo}. Verify repository access and CLI authentication.`);
  const catalog = await provisionLabelCatalog({ provider, workflow: config.workflow, roles: config.roles });
  const workers: Record<string, RoleWorkerState> = {};

  for (const role of getConfiguredRoleIds(config)) workers[role] = emptyRoleWorkerState(getLevelMaxWorkers(config.roles[role]));
  const committed = await updateProjects(input.workspaceDir, current => {
    const data = structuredClone(current);
    let project = data.projects[slug];
    const isNewProject = !project;

    if (project) validateRegistrationIdentity(project, input);
    else {
      project = { slug, name: input.name, agentId: input.agentId, repo: input.repo, provider: type,
        baseBranch: input.baseBranch, deployBranch: input.deployBranch ?? input.baseBranch, channels: [], workers };
      data.projects[slug] = project;
    }

    const previous = project.channels.find(endpoint => matchesProjectRoute(endpoint, input.route));
    const endpoint = previous ?? parseNotificationEndpoint({ ...input.route,
      name: isNewProject ? "primary" : allocateEndpointName(project, undefined, input.route.channel) });

    validateProjectRoute(input.getConfig(), input.agentId, endpoint);
    validateDestinationAvailability(data, slug, endpoint);
    if (!previous) project.channels.push(endpoint);

    return { data, result: { project, endpoint, changed: !previous, isNewProject } };
  });
  let promptsScaffolded = false;
  let scaffoldError: string | undefined;

  try {
    promptsScaffolded = await scaffoldProjectOverrides(input.workspaceDir, slug, getConfiguredRoleIds(config));
  } catch (error) {
    scaffoldError = error instanceof Error ? error.message : String(error);
  }

  await auditLog(input.workspaceDir, "project_register", { projectSlug: slug, isNewProject: committed.isNewProject, scaffoldError });

  return { ...committed, workflow: config.workflow,
    labelsEnsured: catalog.stateLabels.length + catalog.roleLabels.length + catalog.routingLabels.length,
    promptsScaffolded, scaffoldError };
}
