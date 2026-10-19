/** Composes explicit issue deletion with the provider selected by the persisted project. */

import { readProjects } from "../../../../state/index.js";
import { resolveProvider } from "../../../projects/context/index.js";
import { deleteManagedIssue, type DeleteManagedIssueResult } from "../deletion/index.js";
import type { DeleteProjectIssueInput } from "./types.js";

/** Resolve deletion dependencies without weakening local ownership, confirmation, or recovery rules.
 * @param input - Exact issue selection, operator confirmation, and command transport.
 */
export async function deleteProjectIssue(input: DeleteProjectIssueInput): Promise<DeleteManagedIssueResult> {
  if (!Number.isSafeInteger(input.issueId) || input.issueId <= 0) throw new Error("issueId must be a positive safe integer.");
  if (input.dryRun === false && input.confirmIssueId !== input.issueId) {
    throw new Error("confirmIssueId must exactly match issueId for deletion apply.");
  }

  const projects = await readProjects(input.workspaceDir);
  const project = projects.projects[input.projectSlug];

  if (!project) throw new Error(`Project "${input.projectSlug}" not found.`);
  const { provider } = await resolveProvider(input.workspaceDir, project, input.runCommand);

  return deleteManagedIssue({ ...input, projectSlug: project.slug, provider });
}
