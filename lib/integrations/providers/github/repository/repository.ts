/** Owns GitHub repository operations and their provider-specific API semantics. */

import { ISSUE_PROVIDER } from "../../../../domain/index.js";
import { classifyProviderLookupFailure } from "../../errors/index.js";
import type { ProviderTransport } from "../../transport/index.js";
import { PROVIDER_CLI_COMMAND, PROVIDER_CLI_OPTION } from "../../transport/index.js";
import { GITHUB_REPOSITORY_FIELDS } from "./const.js";
import { GhRepositorySchema } from "./schema.js";
import type { GitHubRepositoryInfo } from "./types.js";

/** Implements the repository capability using dependencies shared by one adapter instance. */
export class GitHubRepository {
  /** Successful repository identity cache; rejected reads never populate it. */
  private repoInfo: GitHubRepositoryInfo | undefined;
  /** Bind the concrete capability to its owning adapter.
   * @param transport - Instance-owned checked command transport.
   */
  constructor(private readonly transport: ProviderTransport) {}

  /** Cache only confirmed repository identity; failures leave future observations recoverable. */
  async getRepoInfo(): Promise<GitHubRepositoryInfo> {
    if (this.repoInfo !== undefined) return this.repoInfo;
    try {
      const raw: unknown = JSON.parse(await this.transport.read([
        PROVIDER_CLI_COMMAND.REPOSITORY, PROVIDER_CLI_COMMAND.VIEW, PROVIDER_CLI_OPTION.JSON, GITHUB_REPOSITORY_FIELDS,
      ]));
      const data = GhRepositorySchema.parse(raw);

      this.repoInfo = { owner: data.owner.login, name: data.name };

      return this.repoInfo;
    } catch (error) {
      throw classifyProviderLookupFailure(ISSUE_PROVIDER.GITHUB, error);
    }
  }
}
