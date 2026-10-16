/** Resolves effective enabled setup assignments and validates explicit overrides against workspace configuration. */

import { loadConfig } from "../../state/index.js";
import type { ModelConfig, SetupOpts } from "./types.js";

/** Resolve custom and built-in levels and reject overrides outside the configured value set.
 * @param workspacePath - Workspace containing the authoritative model configuration.
 * @param overrides - Only explicitly requested model assignments.
 */
export async function resolveSetupModels(workspacePath: string, overrides: SetupOpts["models"]): Promise<ModelConfig> {
  const resolved = await loadConfig(workspacePath);
  const models: ModelConfig = {};

  for (const [role, config] of Object.entries(resolved.roles)) {
    if (!config.enabled) continue;
    models[role] = Object.fromEntries(Object.entries(config.levels).map(([level, definition]) => [level, definition.model]));
  }

  for (const [role, levels] of Object.entries(overrides ?? {})) {
    for (const [level, model] of Object.entries(levels)) {
      if (!Object.hasOwn(resolved.roles, role) || !Object.hasOwn(resolved.roles[role].levels, level)) {
        throw new Error(`Unknown configured model level: ${role}.${level}`);
      }

      if (!resolved.roles[role].enabled) throw new Error(`Disabled configured role: ${role}`);
      if (!model?.trim()) throw new Error(`Empty model for ${role}.${level}`);
      models[role][level] = model;
    }
  }

  return models;
}
