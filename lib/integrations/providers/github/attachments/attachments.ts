/** Owns GitHub attachments operations and their provider-specific API semantics. */

import { randomUUID } from "node:crypto";

import { PROVIDER_ATTACHMENT_URL_PROTOCOL,sanitizeProviderAttachmentName } from "../../attachments/index.js";
import type { AttachmentUploadInput } from "../../contracts/index.js";
import { normalizeProviderFailure, PROVIDER_OPERATION_ERROR } from "../../errors/index.js";
import type { ProviderTransport } from "../../transport/index.js";
import { parseProviderJson, PROVIDER_CLI_COMMAND, PROVIDER_CLI_OPTION,PROVIDER_HTTP_METHOD } from "../../transport/index.js";
import { GITHUB_API_FIELD } from "../api/index.js";
import { GitHubRepository, githubRepositoryPath } from "../repository/index.js";
import {
  GITHUB_ATTACHMENT_ENCODING,
  GITHUB_ATTACHMENT_FIELD,
  GITHUB_ATTACHMENT_QUERY,
  GITHUB_ATTACHMENT_REF_PREFIX,
  GITHUB_ATTACHMENT_RESOURCE,
  GITHUB_ATTACHMENT_STORAGE,
} from "./const.js";
import { GhAttachmentSchema } from "./schema.js";

/** Implements the attachments capability using dependencies shared by one adapter instance. */
export class GitHubAttachments {
  /** Bind the concrete capability to its owning adapter.
   * @param transport - Instance-owned checked command transport.
   * @param repository - Shared repository capability for this adapter.
   */
  constructor(private readonly transport: ProviderTransport, private readonly repository: GitHubRepository) {}

  /** Publish bytes once and return only a location confirmed by the Contents API response.
   * Unavailable or unidentified uploads preserve application-owned local attachment bytes.
   * @param issueId - Provider issue identity used to isolate the repository resource.
   * @param file - Persisted bytes and untrusted display metadata.
   */
  async uploadAttachment(
    issueId: number,
    file: AttachmentUploadInput,
  ): Promise<string | null> {
    try {
      const branch = GITHUB_ATTACHMENT_STORAGE.BRANCH;
      const safeFilename = sanitizeProviderAttachmentName(file.filename);
      const filePath = `${GITHUB_ATTACHMENT_STORAGE.DIRECTORY}/${issueId}/${randomUUID()}-${safeFilename}`;
      const base64Content = file.buffer.toString(GITHUB_ATTACHMENT_ENCODING);

      // Get repo owner/name
      const repo = await this.repository.getRepoInfo();

      // Ensure branch exists
      let branchExists = false;

      try {
        await this.transport.read([
          PROVIDER_CLI_COMMAND.API,
          githubRepositoryPath(repo, GITHUB_ATTACHMENT_RESOURCE.GIT, GITHUB_ATTACHMENT_RESOURCE.REF, GITHUB_ATTACHMENT_RESOURCE.HEADS, branch),
        ]);
        branchExists = true;
      } catch (error) {
        const failure = normalizeProviderFailure(error);

        if (failure.code !== PROVIDER_OPERATION_ERROR.NOT_FOUND || failure.outcomeUnknown) throw error;
      }

      if (!branchExists) {
        const raw = await this.transport.read([
          PROVIDER_CLI_COMMAND.REPOSITORY, PROVIDER_CLI_COMMAND.VIEW,
          PROVIDER_CLI_OPTION.JSON, GITHUB_ATTACHMENT_QUERY.DEFAULT_BRANCH_FIELD,
          PROVIDER_CLI_OPTION.QUERY, GITHUB_ATTACHMENT_QUERY.DEFAULT_BRANCH_SELECTOR,
        ]);
        const defaultBranch = raw.trim();
        const shaRaw = await this.transport.read([
          PROVIDER_CLI_COMMAND.API, githubRepositoryPath(repo, GITHUB_ATTACHMENT_RESOURCE.GIT, GITHUB_ATTACHMENT_RESOURCE.REF, GITHUB_ATTACHMENT_RESOURCE.HEADS, defaultBranch),
          PROVIDER_CLI_OPTION.QUERY, GITHUB_ATTACHMENT_QUERY.OBJECT_SHA_SELECTOR,
        ]);

        await this.transport.once([
          PROVIDER_CLI_COMMAND.API, githubRepositoryPath(repo, GITHUB_ATTACHMENT_RESOURCE.GIT, GITHUB_ATTACHMENT_RESOURCE.REFS),
          PROVIDER_CLI_OPTION.METHOD, PROVIDER_HTTP_METHOD.POST,
          PROVIDER_CLI_OPTION.FIELD, `${GITHUB_ATTACHMENT_FIELD.REF}=${GITHUB_ATTACHMENT_REF_PREFIX}${branch}`,
          PROVIDER_CLI_OPTION.FIELD, `${GITHUB_ATTACHMENT_FIELD.SHA}=${shaRaw.trim()}`,
        ]);
      }

      // Upload via Contents API; a clean exit alone does not confirm the uploaded identity.
      const output = await this.transport.once([
        PROVIDER_CLI_COMMAND.API, githubRepositoryPath(repo, GITHUB_ATTACHMENT_RESOURCE.CONTENTS, filePath),
        PROVIDER_CLI_OPTION.METHOD, PROVIDER_HTTP_METHOD.PUT,
        PROVIDER_CLI_OPTION.FIELD, `${GITHUB_ATTACHMENT_FIELD.MESSAGE}=attachment: ${file.filename} for issue #${issueId}`,
        PROVIDER_CLI_OPTION.FIELD, `${GITHUB_API_FIELD.CONTENT}=${base64Content}`,
        PROVIDER_CLI_OPTION.FIELD, `${GITHUB_ATTACHMENT_FIELD.BRANCH}=${branch}`,
      ]);

      const uploaded = parseProviderJson(output, GhAttachmentSchema);

      if (uploaded.content.path !== filePath) return null;
      const url = new URL(uploaded.content.download_url);

      if ((url.protocol !== PROVIDER_ATTACHMENT_URL_PROTOCOL.HTTPS && url.protocol !== PROVIDER_ATTACHMENT_URL_PROTOCOL.HTTP)
        || url.username || url.password || url.search || url.hash) return null;

      return url.href;
    } catch {
      return null;
    }
  }
}
