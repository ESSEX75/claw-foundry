/** Resolves persisted project providers and synchronizes independent label catalogs. */

import { log as auditLog } from "../../../audit.js";
import { createProvider } from "../../../integrations/index.js";
import { getErrorMessage } from "../../../shared/errors/index.js";
import { loadConfig, readProjects } from "../../../state/index.js";
import { provisionLabelCatalog } from "./catalog.js";
import { SYNC_LABELS_EVENT } from "./const.js";
import type { ProjectLabelsResult, SyncProjectLabelsInput, SyncProjectLabelsResult } from "./types.js";

/** Provision selected catalogs using persisted provider identity; one failure does not suppress other projects.
 * Failed results contain no completed catalog: earlier provider effects may exist and are safe to retry.
 * @param input - Exact optional scope and plugin-owned provider transport.
 */
export async function syncProjectLabels(input: SyncProjectLabelsInput): Promise<SyncProjectLabelsResult> {
  const data = await readProjects(input.workspaceDir);

  if (input.projectSlug !== undefined && !Object.hasOwn(data.projects, input.projectSlug)) {
    throw new Error(`No project found for slug "${input.projectSlug}". Register a new project with project_register first.`);
  }

  const slugs = input.projectSlug === undefined ? Object.keys(data.projects) : [input.projectSlug];
  const synced: ProjectLabelsResult[] = [];

  for (const slug of slugs) {
    const project = data.projects[slug];

    try {
      const config = await loadConfig(input.workspaceDir, project.slug);
      const { provider } = await createProvider({ repo: project.repo, provider: project.provider, runCommand: input.runCommand });
      const catalog = await provisionLabelCatalog({ provider, workflow: config.workflow, roles: config.roles });

      synced.push({ project: slug, ...catalog });
    } catch (error) {
      synced.push({ project: slug, stateLabels: [], roleLabels: [], routingLabels: [],
        error: getErrorMessage(error) });
    }
  }

  let auditError: string | undefined;

  try {
    await auditLog(input.workspaceDir, SYNC_LABELS_EVENT, { projects: slugs, errors: synced.filter(result => result.error !== undefined).length });
  } catch (error) {
    auditError = getErrorMessage(error);
  }

  return { success: synced.every(result => result.error === undefined), synced,
    ...(slugs.length === 0 ? { message: "No projects registered." } : {}), ...(auditError !== undefined ? { auditError } : {}) };
}
