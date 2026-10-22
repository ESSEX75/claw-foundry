/** Exercises the real bootstrap hook with isolated SDK event fixtures. */

import path from "node:path";

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import { loadWorkerBootstrapInstructions, resolveWorkerBootstrapIdentity } from "../../application/index.js";
import { registerBootstrapHook } from "../../integrations/index.js";
import { BOOTSTRAP_FILE_NAME } from "./const.js";
import type { BootstrapResult } from "./types.js";

/** Fire the hook with mutable bootstrap resources and the caller-selected session.
 * @param workspaceDir - Isolated workspace containing registry and role instructions.
 * @param sessionKey - Exact identity supplied by the worker.
 */
export async function simulateBootstrap(workspaceDir: string, sessionKey: string): Promise<BootstrapResult> {
      const handlers: Parameters<OpenClawPluginApi["registerHook"]>[1][] = [];

      registerBootstrapHook({ /** Capture the handler installed by the real hook registration.
                               * @param _events - SDK hook events whose handler is being captured.
                               * @param handler - Real bootstrap handler to capture.
                               */
                              registerHook(_events, handler) { handlers.push(handler); } }, {
        logger: { /** Discard bootstrap debug diagnostics in the isolated fixture. */
                  debug() {}, /** Discard bootstrap informational diagnostics in the isolated fixture. */
                              info() {}, /** Discard bootstrap warning diagnostics in the isolated fixture. */
                                         warn() {}, /** Discard bootstrap error diagnostics in the isolated fixture. */
                                                    error() {} },
      }, { resolveWorkerBootstrapIdentity, loadWorkerBootstrapInstructions });
      const bootstrapFiles = [{ name: BOOTSTRAP_FILE_NAME, path: path.join(workspaceDir, BOOTSTRAP_FILE_NAME),
        content: "# Orchestrator instructions\nThis content should be stripped.", missing: false }];

      for (const handler of handlers) {
        await handler({ type: "agent", action: "bootstrap", sessionKey, timestamp: new Date(), messages: [],
          context: { workspaceDir, bootstrapFiles } });
      }

      return { agentsMdStripped: bootstrapFiles[0].missing && bootstrapFiles[0].content === "",
        agentsMdContent: bootstrapFiles[0].content };
}
