/** Captures gateway command evidence without invoking external processes. */

import type { RunCommand } from "../../context.js";
import { AGENT_RPC_METHOD, GATEWAY_CALL_COMMAND, GATEWAY_COMMAND, GATEWAY_PARAMS_FLAG, OPENCLAW_EXECUTABLE, SESSION_PATCH_RPC_METHOD } from "./const.js";
import { completedCommand } from "./responses.js";
import type { CapturedCommand, CommandCapture, CommandInterceptor } from "./types.js";

/** Create an isolated recorder and its SDK-compatible command handler. */
export function createCommandInterceptor(): CommandCapture {
  const commands: CapturedCommand[] = [];

  const handler: RunCommand = async (argv, optsOrTimeout) => {
    const opts = typeof optsOrTimeout === "number"
      ? { timeoutMs: optsOrTimeout }
      : optsOrTimeout;

    const captured: CapturedCommand = { argv: [...argv], opts: structuredClone(opts) };

    // Parse gateway agent calls to extract task message
    if (argv[0] === OPENCLAW_EXECUTABLE && argv[1] === GATEWAY_COMMAND && argv[2] === GATEWAY_CALL_COMMAND) {
      const rpcMethod = argv[3];
      const paramsIdx = argv.indexOf(GATEWAY_PARAMS_FLAG);

      if (paramsIdx !== -1 && argv[paramsIdx + 1]) {
        try {
          const params: unknown = JSON.parse(argv[paramsIdx + 1]);

          if (typeof params !== "object" || params === null || Array.isArray(params)) throw new Error("Invalid gateway params");

          if (rpcMethod === AGENT_RPC_METHOD && "message" in params && typeof params.message === "string") {
            captured.taskMessage = params.message;
            if ("extraSystemPrompt" in params && typeof params.extraSystemPrompt === "string") {
              captured.extraSystemPrompt = params.extraSystemPrompt;
            }

            if ("model" in params && typeof params.model === "string") {
              captured.agentModel = params.model;
            }
          }

          if (rpcMethod === SESSION_PATCH_RPC_METHOD && "key" in params && typeof params.key === "string"
            && "model" in params && typeof params.model === "string"
            && (!("label" in params) || typeof params.label === "string")) {
            captured.sessionPatch = { key: params.key, model: params.model, label: "label" in params && typeof params.label === "string" ? params.label : undefined };
          }
        } catch { /* ignore parse errors */ }
      }
    }

    commands.push(captured);

    const patch = captured.sessionPatch;
    const separator = patch?.model.indexOf("/") ?? -1;
    const stdout = patch ? JSON.stringify({
      ok: true,
      key: patch.key,
      resolved: {
        modelProvider: separator > 0 ? patch.model.slice(0, separator) : "test",
        model: separator > 0 ? patch.model.slice(separator + 1) : patch.model,
      },
    }) : "{}";

    return completedCommand(stdout);
  };

  const interceptor: CommandInterceptor = {
    commands,
    /** Select captured commands by their executable name.
     * @param cmd - Executable name used to select invocation evidence.
     */
    commandsFor(cmd: string) {
      return commands.filter((c) => c.argv[0] === cmd);
    },
    /** Read validated task messages in invocation order. */
    taskMessages() {
      return commands
        .filter((c) => c.taskMessage !== undefined)
        .map((c) => c.taskMessage!);
    },
    /** Read validated additional worker instructions in invocation order. */
    extraSystemPrompts() {
      return commands
        .filter((c) => c.extraSystemPrompt !== undefined)
        .map((c) => c.extraSystemPrompt!);
    },
    /** Read requested agent model identities in invocation order. */
    agentModels() {
      return commands
        .filter((c) => c.agentModel !== undefined)
        .map((c) => c.agentModel!);
    },
    /** Read validated session patches in invocation order. */
    sessionPatches() {
      return commands
        .filter((c) => c.sessionPatch !== undefined)
        .map((c) => c.sessionPatch!);
    },
    /** Clear captured commands while keeping the same recording transport. */
    reset() {
      commands.length = 0;
    },
  };

  return { interceptor, handler };
}
