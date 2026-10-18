/** Reads terminal configuration without treating SDK failures as missing configuration. */

import type { CliConfigRuntime } from "./types.js";

/** Read one SDK snapshot, preserving the original failure as the error cause.
 * @param runtime - Read-only SDK configuration capability.
 */
export function readCliConfig(runtime: CliConfigRuntime): ReturnType<CliConfigRuntime["config"]["current"]> {
  try {
    return runtime.config.current();
  } catch (cause) {
    throw new Error("Unable to read OpenClaw configuration for CLI input.", { cause });
  }
}

/** Read the optional configured workspace without suppressing operational failures.
 * @param runtime - Read-only SDK configuration capability.
 */
export function getDefaultWorkspaceDir(runtime: CliConfigRuntime): string | undefined {
  return readCliConfig(runtime).agents?.defaults?.workspace;
}

/** Resolve an explicit or configured workspace and reject missing or blank targets.
 * @param explicit - Operator-selected workspace, taking precedence over configuration.
 * @param runtime - Configuration reader used only when the explicit target is omitted.
 */
export function requireWorkspace(explicit: string | undefined, runtime: CliConfigRuntime): string {
  const workspace = explicit ?? getDefaultWorkspaceDir(runtime);

  if (!workspace?.trim()) throw new Error("Workspace path is required. Pass --workspace or configure an agent default workspace.");

  return workspace;
}
