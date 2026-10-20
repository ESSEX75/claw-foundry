/** Constructs complete successful process evidence for fake transports. */

import type { RunCommand } from "../../context.js";

/** Construct a successful response without invoking a process or decoding its payload.
 * @param stdout - Exact response bytes represented as text.
 */
export function completedCommand(stdout: string): Awaited<ReturnType<RunCommand>> {
  return { stdout, stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}
