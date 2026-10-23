/** Creates project override documentation without replacing user-owned files. */

import fs from "node:fs/promises";
import path from "node:path";

import { hasErrorCode } from "../../../shared/errors/index.js";
import { assertWorkspaceMigrated } from "../../migration.js";
import { DATA_DIR, PROJECTS_DIRECTORY_NAME } from "../../paths.js";
import { CREATE_ONLY_FILE_FLAG, FILESYSTEM_ERROR_CODE, STATE_TEXT_ENCODING } from "../../persistence/index.js";
import { parseProjectSlug } from "../../projects/index.js";
import { PROMPTS_DIRECTORY_NAME } from "../resources/index.js";
import { PROJECT_OVERRIDES_FILE_NAME } from "./const.js";

/**
 * Scaffold a canonical project directory with a prompts folder and override documentation.
 * Reports whether the project documentation was created by this call.
 *
 * @param workspaceDir - Workspace receiving the project-local configuration directory.
 * @param projectSlug - Canonical lowercase kebab-case project slug used for the directory.
 * @param roleIds - Configured roles listed in the generated override documentation.
 */
export async function scaffoldProjectOverrides(
  workspaceDir: string,
  projectSlug: string,
  roleIds: readonly string[],
): Promise<boolean> {
  assertWorkspaceMigrated(workspaceDir);

  parseProjectSlug(projectSlug);
  const projectDir = path.join(workspaceDir, DATA_DIR, PROJECTS_DIRECTORY_NAME, projectSlug);
  const promptsDir = path.join(projectDir, PROMPTS_DIRECTORY_NAME);

  await fs.mkdir(promptsDir, { recursive: true });

  const readmePath = path.join(projectDir, PROJECT_OVERRIDES_FILE_NAME);

  const roles = roleIds.join(", ");

  try {
    await fs.writeFile(readmePath, `# Project Overrides

This directory holds project-specific configuration that overrides the workspace defaults.

## Prompt Overrides

To override default worker instructions, create \`prompts/<role>.md\`:

Available roles: ${roles}

Example: \`prompts/developer.md\` overrides the default developer instructions for this project only.
Files here take priority over the workspace defaults in \`claw-foundry/prompts/\`.

## Workflow Overrides

To override the default workflow configuration, create \`workflow.yaml\` in this directory.

Only include the keys you want to override — everything else inherits from the workspace-level \`claw-foundry/workflow.yaml\`. The three-layer system is:

1. **Built-in defaults** (code)
2. **Workspace** — \`claw-foundry/workflow.yaml\`
3. **Project** — \`claw-foundry/projects/${projectSlug}/workflow.yaml\` (this directory)

Example — use a different review policy for this project:

\`\`\`yaml
workflow:
  reviewPolicy: agent
\`\`\`

This policy default applies to new issue snapshots. Existing managed issues keep their local
policies until an explicit \`issue_policy_migrate\` command (preview with \`dryRun: true\`,
then apply the same selection). Provider labels and body metadata only project local state.

Example — override model for senior developer:

\`\`\`yaml
roles:
  developer:
    levels:
      senior:
        model: claude-sonnet-4-5-20250514
\`\`\`

Call \`workflow_guide\` for the full config reference.
`, { encoding: STATE_TEXT_ENCODING, flag: CREATE_ONLY_FILE_FLAG });

    return true;
  } catch (error) {
    if (hasErrorCode(error, FILESYSTEM_ERROR_CODE.ALREADY_EXISTS)) {
      if ((await fs.lstat(readmePath)).isFile()) return false;
      throw new Error(`Project documentation path is not a regular file: ${readmePath}`, { cause: error });
    }

    throw error;
  }
}
