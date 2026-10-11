/** Owns GitLab health operations and their provider-specific API semantics. */

import type { ProviderTransport } from "../../transport/index.js";
import { PROVIDER_CLI_COMMAND } from "../../transport/index.js";

/** Implements the health capability using dependencies shared by one adapter instance. */
export class GitLabHealth {
  /** Bind the concrete capability to its owning adapter.
   * @param transport - Instance-owned checked command transport.
   */
  constructor(private readonly transport: ProviderTransport) {}

  /** Probe CLI authentication; unavailability is a failed health observation.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.transport.read([PROVIDER_CLI_COMMAND.AUTH, PROVIDER_CLI_COMMAND.STATUS]);

      return true;
    } catch { return false; }
  }
}
