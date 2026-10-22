/** Owns one timer lifecycle and serializes composition-injected heartbeat ticks. */

import { getErrorMessage } from "../../../../shared/errors/index.js";
import { MILLISECONDS_PER_SECOND,resolveHeartbeatConfig } from "../configuration/index.js";
import { discoverAgents } from "./agent-discovery.js";
import { logTickResult, processAllAgents } from "./agent-runner.js";
import { HEARTBEAT_SERVICE } from "./const.js";
import type { HeartbeatLifecycle, HeartbeatServiceDependencies, ServiceContext } from "./types.js";

/** Create an isolated timer lifecycle with one in-flight tick at most.
 * @param pluginCtx - Plugin configuration, gateway command, and runtime capabilities.
 * @param projectTick - Project coordinator supplied by the heartbeat composition boundary.
 * @param runTick - Optional supplied tick for lifecycle integration tests.
 */
export function createHeartbeatLifecycle(pluginCtx: HeartbeatServiceDependencies, runTick?: () => Promise<void>,
  projectTick?: Parameters<typeof processAllAgents>[1]): HeartbeatLifecycle {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let startupTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let warnedNoAgents = false;
  let generation = 0;

  const clearTimers = (): void => {
    if (intervalId) clearInterval(intervalId);
    if (startupTimeoutId) clearTimeout(startupTimeoutId);
    intervalId = null;
    startupTimeoutId = null;
  };

  return {
    start: async (svcCtx: ServiceContext) => {
      const currentGeneration = ++generation;

      clearTimers();
      if (inFlight) await inFlight;
      if (generation !== currentGeneration) return;
      const heartbeatConfig = resolveHeartbeatConfig(pluginCtx.pluginConfig);

      if (!heartbeatConfig.enabled) {
        svcCtx.logger.info("work_heartbeat service disabled");

        return;
      }

      const run = (): void => {
        if (inFlight || generation !== currentGeneration) return;
        const running = (async () => {
          try {
            if (runTick) {
              await runTick();

              return;
            }

            const config = resolveHeartbeatConfig(pluginCtx.pluginConfig);

            if (!config.enabled || generation !== currentGeneration) return;
            const discovery = await discoverAgents(pluginCtx.runtime?.config.current() ?? svcCtx.config ?? pluginCtx.config);

            for (const error of discovery.errors) svcCtx.logger.warn(error);
            if (discovery.agents.length === 0) {
              if (!warnedNoAgents) svcCtx.logger.warn("work_heartbeat tick skipped: no DevClaw project workspaces discovered");
              warnedNoAgents = true;

              return;
            }

            warnedNoAgents = false;
            if (generation !== currentGeneration) return;
            if (!projectTick) throw new Error("Heartbeat lifecycle requires a project tick coordinator.");
            const result = await processAllAgents(discovery.agents, projectTick, config, pluginCtx.pluginConfig,
              svcCtx.logger, pluginCtx.runCommand, pluginCtx.runtime);

            logTickResult(result, svcCtx.logger);
          } catch (error) {
            svcCtx.logger.error(`work_heartbeat tick failed: ${getErrorMessage(error)}`);
          }
        })();

        inFlight = running;
        running.finally(() => { if (inFlight === running) inFlight = null; }).catch(() => {});
      };

      intervalId = setInterval(run, heartbeatConfig.intervalSeconds * MILLISECONDS_PER_SECOND);
      intervalId.unref?.();
      startupTimeoutId = setTimeout(run, HEARTBEAT_SERVICE.STARTUP_DELAY_MS);
      startupTimeoutId.unref?.();
      svcCtx.logger.info(`work_heartbeat service started: interval=${heartbeatConfig.intervalSeconds}s maxPickupsPerTick=${heartbeatConfig.maxPickupsPerTick}`);
    },
    stop: async (svcCtx: ServiceContext) => {
      generation++;
      clearTimers();
      if (inFlight) await inFlight;
      svcCtx.logger.info("work_heartbeat service stopped");
    },
  };
}
