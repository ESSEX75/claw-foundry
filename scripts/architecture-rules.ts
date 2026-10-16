/** Pure adapter boundary policy shared by the architecture checker and regression tests. */

/** Tool adapters whose setup effects must pass through shared application commands. */
const APPLICATION_ADAPTERS = new Set([
  "lib/tools/setup/setup.ts", "lib/tools/setup/config.ts", "lib/tools/setup/onboard.ts",
]);

/** Detect direct persistence dependencies in adapters migrated to shared application commands.
 * @param source - Repository-relative source path, with either platform separator.
 * @param targetLayer - Resolved target layer for local imports.
 * @param specifier - Raw import specifier for external modules.
 */
export function checkApplicationAdapterBoundary(source: string, targetLayer: string | undefined, specifier: string): string | null {
  const normalized = source.replaceAll("\\", "/");

  if ((APPLICATION_ADAPTERS.has(normalized) || normalized.startsWith("lib/cli/")) &&
    (targetLayer === "state" || ["node:fs", "node:fs/promises", "fs", "fs/promises"].includes(specifier))) {
    return "CLI and setup tool adapters must use application commands instead of filesystem state";
  }
  return null;
}

/** Enforce orchestration direction independently of public entrypoint checks.
 * @param sourceLayer - Layer containing the importer.
 * @param targetLayer - Resolved imported layer, absent for external packages.
 */
export function checkApplicationDependencyDirection(sourceLayer: string, targetLayer: string | undefined): string | null {
  if (sourceLayer === "state" && ["application", "tools", "cli"].includes(targetLayer ?? "")) {
    return "state must not depend on application orchestration or adapters";
  }
  if (sourceLayer === "application" && ["tools", "cli"].includes(targetLayer ?? "")) {
    return "application must not depend on tool or CLI adapters";
  }
  return null;
}

/** Keep tool callers on the public root and internal capabilities on their owning APIs.
 * @param source - Repository-relative importing file with either platform separator.
 * @param target - Resolved repository-relative target file with either platform separator.
 */
export function checkToolsApiBoundary(source: string, target: string): string | null {
  const importer = source.replaceAll("\\", "/");
  const imported = target.replaceAll("\\", "/");
  if (!imported.startsWith("lib/tools/")) return null;
  if (!importer.startsWith("lib/tools/")) {
    return imported === "lib/tools/index.ts" ? null : "external callers must use lib/tools/index.ts";
  }
  if (imported === "lib/tools/index.ts") return "tools must not import their own root barrel";
  if (importer.startsWith("lib/tools/tasks/") && imported === "lib/tools/tasks/index.ts") {
    return "task adapters must not import their ancestor barrel";
  }
  if (!importer.startsWith("lib/tools/tasks/") && imported.startsWith("lib/tools/tasks/")
    && imported !== "lib/tools/tasks/index.ts") {
    return "sibling capabilities must use the task adapter entrypoint";
  }
  const importerOwner = importer.slice(0, importer.lastIndexOf("/"));
  const importedOwner = imported.slice(0, imported.lastIndexOf("/"));
  if (importerOwner !== importedOwner && !imported.endsWith("/index.ts")) {
    return "tool capabilities must use the target capability entrypoint";
  }
  return null;
}

/** Enforce the CLI facade and internal capability entrypoints independently of platform separators.
 * @param source - Repository-relative importing source file.
 * @param target - Repository-relative resolved local import target.
 */
export function checkCliApiBoundary(source: string, target: string): string | null {
  const importer = source.replaceAll("\\", "/");
  const imported = target.replaceAll("\\", "/");

  if (!imported.startsWith("lib/cli/")) return null;
  if (!importer.startsWith("lib/cli/")) {
    return imported === "lib/cli/index.ts" ? null : "external callers must use lib/cli/index.ts";
  }
  if (imported === "lib/cli/index.ts") return "CLI must not import its own root facade";
  if (imported === "lib/cli/const.ts") return null;
  const importerOwner = importer.slice(0, importer.lastIndexOf("/"));
  const importedOwner = imported.slice(0, imported.lastIndexOf("/"));

  if (imported.endsWith("/index.ts") && importer.startsWith(`${importedOwner}/`)) {
    return "CLI capabilities must not import their own or ancestor entrypoint";
  }
  if (importerOwner !== importedOwner && !imported.endsWith("/index.ts")) {
    return "CLI capabilities must use the target capability entrypoint";
  }
  return null;
}
