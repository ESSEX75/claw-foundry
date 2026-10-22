/** Provides an in-memory SDK config mutation transport for setup and adapter tests. */

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import type { SetupRuntime } from "../../application/index.js";
import type { RunCommand } from "../../context.js";
import { completedCommand } from "../commands/index.js";
import { APPROVED_SCOPES_RESPONSE, CONFIG_SNAPSHOT_PATH } from "./const.js";
import type { SetupFixture, SetupWrite } from "./types.js";

/** Create isolated config state and record committed mutations and external commands.
 * @param initialConfig - Configuration snapshot to clone for the test.
 */
export function createSetupRuntime(initialConfig: OpenClawConfig = {}): SetupFixture {
  let config = structuredClone(initialConfig);
  const writes: SetupWrite[] = [];
  const commands: string[][] = [];
  let pending = Promise.resolve();
  const runtime: SetupRuntime = {
    config: {
      current: () => structuredClone(config),
      mutateConfigFile: ({ mutate, afterWrite }) => {
        const operation = pending.then(async () => {
          const draft = structuredClone(config);

          await mutate(draft, {
            snapshot: {
              path: CONFIG_SNAPSHOT_PATH, exists: true, raw: "", parsed: structuredClone(config), sourceConfig: structuredClone(config),
              resolved: structuredClone(config), runtimeConfig: structuredClone(config), valid: true, config: structuredClone(config), issues: [], warnings: [], legacyIssues: [],
            },
            previousHash: null,
          });
          if (JSON.stringify(draft) !== JSON.stringify(config)) {
            config = structuredClone(draft);
            writes.push({ nextConfig: structuredClone(config), afterWrite: structuredClone(afterWrite) });
          }
        });

        pending = operation.catch(() => {});

        return operation;
      },
    },
  };
  const runCommand: RunCommand = async (args) => {
    commands.push([...args]);

    return completedCommand(APPROVED_SCOPES_RESPONSE);
  };

  return { runtime, runCommand, writes, commands };
}
