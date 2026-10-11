/** Owns GitHub health operations and their provider-specific API semantics. */

import type { ProviderRateLimitStatus } from "../../contracts/index.js";
import type { ProviderTransport } from "../../transport/index.js";
import { parseProviderJson, PROVIDER_CLI_COMMAND } from "../../transport/index.js";
import { GITHUB_EPOCH_SECOND_MS, GITHUB_RATE_LIMIT_RESOURCE } from "./const.js";
import { GhRateLimitSchema } from "./schema.js";

/** Implements the health capability using dependencies shared by one adapter instance. */
export class GitHubHealth {
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

  /** Read GitHub's current core API quota for repair mutation preflight. */
  async getRateLimitStatus(): Promise<ProviderRateLimitStatus> {
    const parsed = parseProviderJson(await this.transport.read([PROVIDER_CLI_COMMAND.API, GITHUB_RATE_LIMIT_RESOURCE]), GhRateLimitSchema);

    return {
      remaining: parsed.resources.core.remaining,
      resetAt: new Date(parsed.resources.core.reset * GITHUB_EPOCH_SECOND_MS).toISOString(),
    };
  }
}
