/** Owns captured command evidence and the interceptor contract. */

import type { RunCommand } from "../../context.js";

/** Immutable-at-capture command arguments and validated gateway metadata. */
export type CapturedCommand = {
  /** Argument snapshot taken before the caller can mutate its input. */
  argv: string[];
  /** SDK execution options captured at invocation. */
  opts: Exclude<Parameters<RunCommand>[1], number>;
  /** Extracted from gateway `agent` call params, if applicable. */
  taskMessage?: string;
  /** Extracted from gateway `agent` call params, if applicable. */
  extraSystemPrompt?: string;
  /** Extracted from gateway `agent` call params, if applicable. */
  agentModel?: string;
  /** Extracted from gateway `sessions.patch` params, if applicable. */
  sessionPatch?: SessionPatch;
};

/** Inspection and reset operations for one isolated command transport. */
export type CommandInterceptor = {
  /** All captured commands, in order. */
  commands: CapturedCommand[];
  /** Filter commands by first argv element. */
  commandsFor(cmd: string): CapturedCommand[];
  /** Get all task messages sent via `openclaw gateway call agent`. */
  taskMessages(): string[];
  /** Get all extraSystemPrompt values sent via `openclaw gateway call agent`. */
  extraSystemPrompts(): string[];
  /** Get all agent models sent via `openclaw gateway call agent`. */
  agentModels(): string[];
  /** Get all session patches. */
  sessionPatches(): SessionPatch[];
  /** Reset captured commands. */
  reset(): void;
};


/** Command recorder and the SDK-compatible transport it controls. */
export type CommandCapture = {
  /** Inspection API for captured evidence. */
  interceptor: CommandInterceptor;
  /** Transport that records calls without running external commands. */
  handler: RunCommand;
};

/** Validated gateway session mutation shared by capture and inspection. */
export type SessionPatch = {
  /** Exact session selected by the command. */
  key: string;
  /** Requested provider/model identity. */
  model: string;
  /** Optional display label. */
  label?: string;
};
