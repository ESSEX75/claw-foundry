/** Defines the packaged setup resource snapshot. */

import type { RoleId } from "../../../domain/index.js";

/** Complete packaged template set consumed by setup and runtime fallbacks. */
export type SetupTemplates = {
  /** Root agent instructions. */
  agents: string;
  /** Heartbeat instructions. */
  heartbeat: string;
  /** Initial identity document. */
  identity: string;
  /** Agent persona document. */
  soul: string;
  /** Tool instructions. */
  tools: string;
  /** Current workflow configuration example. */
  workflow: string;
  /** Built-in role instructions from the packaged resource set. */
  roleInstructions: Readonly<Record<RoleId, string>>;
};
