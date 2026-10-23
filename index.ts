/** Registers Claw Foundry tools, CLI, services, and SDK hooks at the plugin boundary. */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import {
  extractIssueReferences,
  loadWorkerBootstrapInstructions,
  processAttachmentMessage,
  registerHeartbeatService,
  resolveAttachmentProject,
  resolveProvider,
  resolveWorkerBootstrapIdentity,
} from "./lib/application/index.js";
// Infrastructure
import { registerCli } from "./lib/cli/index.js";
import { createPluginContext } from "./lib/context.js";
import { registerAttachmentHook, registerBootstrapHook } from "./lib/integrations/index.js";
import { CLAW_FOUNDRY_PLUGIN_ID } from "./lib/shared/const.js";
import { configureAuditWarnings } from "./lib/state/index.js";
import { toolRegistry } from "./lib/tools/index.js";
import manifest from "./openclaw.plugin.json" with { type: "json" };

/** Composes SDK registrations using the manifest as the canonical plugin settings schema. */
const plugin = {
  id: CLAW_FOUNDRY_PLUGIN_ID,
  name: "Claw Foundry",
  description:
    "Multi-project dev/qa pipeline orchestration with GitHub/GitLab integration, developer tiers, and audit logging.",
  configSchema: manifest.configSchema,

  /** Wire application callbacks and adapter registrations into one SDK plugin runtime.
   * @param api - SDK registration, configuration, runtime and diagnostic capabilities.
   */
  register(api: OpenClawPluginApi) {
    const ctx = createPluginContext(api);

    configureAuditWarnings(message => ctx.logger.warn(message));

    for (const entry of toolRegistry) {
      api.registerTool(entry.factory(ctx), { names: [...entry.names] });
    }

    // CLI, services & hooks
    api.registerCli(({ program }) => registerCli(program, ctx), {
      commands: [CLAW_FOUNDRY_PLUGIN_ID],
      descriptors: [
        {
          name: CLAW_FOUNDRY_PLUGIN_ID,
          description: "Claw Foundry development pipeline tools",
          hasSubcommands: true,
        },
      ],
    });
    registerHeartbeatService(api, ctx);
    registerBootstrapHook(api, ctx, { resolveWorkerBootstrapIdentity, loadWorkerBootstrapInstructions });
    registerAttachmentHook(api, ctx, { extractIssueReferences, processAttachmentMessage, resolveAttachmentProject, resolveProvider });

    api.logger.info(
      `Claw Foundry plugin registered (${toolRegistry.length} tools, 1 CLI command group, 1 service, 3 hooks)`,
    );
  },
};

export default plugin;
