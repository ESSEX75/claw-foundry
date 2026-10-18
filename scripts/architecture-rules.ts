/** Pure adapter boundary policy shared by the architecture checker and regression tests. */

/** Tool adapters whose setup effects must pass through shared application commands. */
const APPLICATION_ADAPTERS = new Set([
  "lib/tools/adapters/setup/setup.ts", "lib/tools/adapters/setup/config.ts", "lib/tools/adapters/setup/onboard.ts",
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
  if ((importer.startsWith("lib/tools/context/") || importer.startsWith("lib/tools/validation/"))
    && (imported.startsWith("lib/tools/adapters/") || imported.startsWith("lib/tools/registration/"))) {
    return "shared tool infrastructure must not depend on adapters or registration";
  }
  if (importer.startsWith("lib/tools/adapters/") && imported.startsWith("lib/tools/registration/")) {
    return "tool adapters must not depend on registration";
  }
  const importedDirectory = imported.slice(0, imported.lastIndexOf("/"));
  if (imported.endsWith("/index.ts") && importer.startsWith(`${importedDirectory}/`)) {
    return "tool capabilities must not import their own or ancestor barrel";
  }
  if (!importer.startsWith("lib/tools/adapters/tasks/") && imported.startsWith("lib/tools/adapters/tasks/")
    && imported !== "lib/tools/adapters/tasks/index.ts") {
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
  if (importer.startsWith("lib/cli/parsing/")
    && (imported.startsWith("lib/cli/commands/") || imported.startsWith("lib/cli/runtime/"))) {
    return "CLI argument parsing must not depend on commands or runtime configuration";
  }
  if (importer.startsWith("lib/cli/runtime/") && imported.startsWith("lib/cli/commands/")) {
    return "CLI runtime configuration must not depend on command adapters";
  }
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

/** Enforce application ownership and its documented shared submodule APIs on either platform.
 * @param source - Repository-relative importer.
 * @param target - Resolved repository-relative imported file.
 */
export function checkApplicationApiBoundary(source: string, target: string): string | null {
  const importer = source.replaceAll("\\", "/");
  const imported = target.replaceAll("\\", "/");
  const root = "lib/application/";

  if (!imported.startsWith(root)) return null;
  if (!importer.startsWith(root)) {
    return imported === `${root}index.ts` ? null : "external callers must use lib/application/index.ts";
  }
  if (imported === `${root}index.ts`) return "application must not import its own root barrel";
  const targetOwner = imported.slice(0, imported.lastIndexOf("/"));
  const sourceOwner = importer.slice(0, importer.lastIndexOf("/"));

  if (imported.endsWith("/index.ts") && importer.startsWith(`${targetOwner}/`)) {
    return "application capabilities must not import their own or ancestor barrel";
  }
  const sourceCapability = importer.slice(root.length).split("/")[0];
  const targetCapability = imported.slice(root.length).split("/")[0];

  if (sourceCapability !== targetCapability && sourceCapability !== "index.ts") {
    const sharedWorkerInput = sourceCapability === "workers"
      && ["tasks/context/index.ts", "tasks/attachments/index.ts"].includes(imported.slice(root.length));
    const sharedHeartbeatSettings = sourceCapability === "setup" && imported === `${root}heartbeat/configuration/index.ts`;

    if (sharedWorkerInput || sharedHeartbeatSettings) return null;

    return imported === `${root}${targetCapability}/index.ts`
      ? null : "application siblings must use the target capability entrypoint";
  }
  if (sourceOwner === targetOwner || imported.endsWith("/index.ts")) return null;
  // Parent coordination owns root contracts; worker evidence and setup runtime ports intentionally stay there.
  if (targetOwner === `${root}${targetCapability}`) {
    const name = imported.slice(imported.lastIndexOf("/") + 1);
    const sharedParentContracts = ["const.ts", "types.ts"];
    const sharedWorkerEvidence = targetCapability === "workers" && ["delivery-state.ts", "session-budget.ts", "session-label.ts"].includes(name);

    if (sharedParentContracts.includes(name) || sharedWorkerEvidence) return null;
  }
  if (importer === `${root}setup/types.ts` && imported.endsWith("/types.ts")) return null;
  if (importer === `${root}heartbeat/types.ts` && imported === `${root}heartbeat/service/types.ts`) return null;

  return "application child capabilities must use the target child entrypoint";
}

/** Require aggregation barrels to delegate supported child APIs rather than repeat symbol lists.
 * Setup is an explicit facade and intentionally selects its supported child contracts.
 * @param source - Repository-relative barrel file.
 * @param content - Source text with comments removed by the checker.
 */
export function checkApplicationAggregation(source: string, content: string): string | null {
  const file = source.replaceAll("\\", "/");

  if (!file.startsWith("lib/application/") || !file.endsWith("/index.ts") || file === "lib/application/setup/index.ts") return null;

  return /export\s+(?:type\s+)?\{[^}]*\}\s+from\s+["']\.\/[^"']+\/index\.js["']/.test(content)
    ? "application aggregators must export * from supported child entrypoints" : null;
}
