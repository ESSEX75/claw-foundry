/** Owns the concrete adapter constructor contract shared by provider scenarios. */

import type { GitHubProvider, GitLabProvider } from "../../../integrations/index.js";

/** Either production provider facade accepted by the shared behavioral scenarios. */
export type ScenarioProvider = typeof GitHubProvider | typeof GitLabProvider;
