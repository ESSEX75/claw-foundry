/** Registers DevClaw tools, CLI, services, and SDK hooks at the plugin boundary. */

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
import { DEVCLAW_PLUGIN_ID } from "./lib/shared/const.js";
import { configureAuditWarnings } from "./lib/state/index.js";
import { toolRegistry } from "./lib/tools/index.js";

const plugin = {
  id: DEVCLAW_PLUGIN_ID,
  name: "DevClaw",
  description:
    "Multi-project dev/qa pipeline orchestration with GitHub/GitLab integration, developer tiers, and audit logging.",
  configSchema: {
    type: "object",
    properties: {
      projectExecution: {
        type: "string",
        enum: ["parallel", "sequential"],
        description:
          "Plugin-level: parallel (each project independent) or sequential (one project at a time)",
        default: "parallel",
      },
      notifications: {
        type: "object",
        description:
          "Per-event-type notification toggles. All default to true — set to false to suppress.",
        properties: {
          workerStart: { type: "boolean", default: true },
          workerComplete: { type: "boolean", default: true },
        },
      },
      work_heartbeat: {
        type: "object",
        description:
          "Token-free interval-based heartbeat service. Runs health checks + queue dispatch automatically. " +
          "Discovers all DevClaw agents from openclaw.json and processes each independently.",
        properties: {
          enabled: {
            type: "boolean",
            default: true,
            description: "Enable automatic periodic heartbeat service.",
          },
          intervalSeconds: {
            type: "number",
            default: 60,
            description: "Seconds between automatic heartbeat ticks.",
          },
          maxPickupsPerTick: {
            type: "number",
            default: 4,
            description: "Max worker dispatches per agent per tick. Applied to each DevClaw agent independently.",
          },
        },
      },
    },
  },

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
      commands: [DEVCLAW_PLUGIN_ID],
      descriptors: [
        {
          name: DEVCLAW_PLUGIN_ID,
          description: "DevClaw development pipeline tools",
          hasSubcommands: true,
        },
      ],
    });
    registerHeartbeatService(api, ctx);
    registerBootstrapHook(api, ctx, { resolveWorkerBootstrapIdentity, loadWorkerBootstrapInstructions });
    registerAttachmentHook(api, ctx, { extractIssueReferences, processAttachmentMessage, resolveAttachmentProject, resolveProvider });

    api.logger.info(
      `DevClaw plugin registered (${toolRegistry.length} tools, 1 CLI command group, 1 service, 3 hooks)`,
    );
  },
};

export default plugin;
