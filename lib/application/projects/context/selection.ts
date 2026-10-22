/** Resolves explicit project references without guessing between matching names. */

import type { Project } from "../../../domain/index.js";
import type { ProjectsData } from "../../../state/index.js";

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
