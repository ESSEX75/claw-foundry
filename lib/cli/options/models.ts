/** Owns supported model flags and exact conversion of terminal model overrides to application input. */

import type { ModelConfig } from "../../application/index.js";
import { getAllRoleIds, getBuiltInLevelsForRole } from "../../roles/index.js";
import type { BuiltInModelOption, SetupCliOptions } from "./types.js";

/** Build one descriptor inventory for registering and reading built-in model flags. */
export function getBuiltInModelOptions(): BuiltInModelOption[] {
  return getAllRoleIds().flatMap(role => getBuiltInLevelsForRole(role).map(level => ({
    role, level, flag: `--${role}-${level}`, key: `${role}${level.charAt(0).toUpperCase()}${level.slice(1)}`,
  })));
}

/** Append a repeated assignment without interpreting its untrusted contents.
 * @param value - Raw role.level=model option occurrence.
 * @param previous - Earlier option occurrences owned by this parser invocation.
 */
export function collectModelAssignment(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** Parse explicit assignments, refusing empty values and duplicate or conflicting destinations.
 * Application alone validates configured role/level membership after the target is resolved.
 * @param opts - Raw Commander model flags and repeated assignments.
 */
export function parseModelOverrides(opts: SetupCliOptions): ModelConfig | undefined {
  const assignments = new Map<string, Map<string, string>>();

  /** Retain one exact destination once, avoiding special object-property names during parsing.
   * @param role - Requested role identifier, validated against configuration by application.
   * @param level - Requested level identifier, validated against configuration by application.
   * @param model - Explicit assignment; whitespace-only models are invalid.
   */
  function add(role: string, level: string, model: string): void {
    if (!role || !level || !model.trim()) throw new Error("Model overrides require role.level=non-empty-model.");
    const levels = assignments.get(role) ?? new Map<string, string>();

    if (levels.has(level)) throw new Error(`Duplicate model override for ${role}.${level}.`);
    levels.set(level, model.trim());
    assignments.set(role, levels);
  }

  for (const option of getBuiltInModelOptions()) {
    const model = opts[option.key];

    if (typeof model === "string") add(option.role, option.level, model);
    else if (Array.isArray(model)) {
      for (const value of model) add(option.role, option.level, value);
    }
  }

  for (const assignment of opts.model ?? []) {
    const separator = assignment.indexOf("=");
    const destination = assignment.slice(0, separator).trim();
    const parts = destination.split(".");
    const role = parts[0]?.trim();
    const level = parts[1]?.trim();

    if (separator < 0 || parts.length !== 2 || !role || !level) throw new Error(`Invalid model override "${assignment}". Use role.level=model.`);
    add(role, level, assignment.slice(separator + 1));
  }

  return assignments.size > 0
    ? Object.fromEntries([...assignments].map(([role, levels]) => [role, Object.fromEntries(levels)]))
    : undefined;
}
