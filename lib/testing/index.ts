/**
 * testing/ — Test infrastructure for DevClaw integration tests.
 *
 * Exports:
 * - TestProvider: In-memory IssueProvider with call tracking
 * - createTestHarness: Scaffolds temp workspace + mock runCommand
 */

export { completeWorkerForTesting } from "./completion-fixture.js";
export {
  type BootstrapResult,
  type CapturedCommand,
  type CommandInterceptor,
  createTestHarness,
  type HarnessOptions,
  type TestHarness,
} from "./harness.js";
export { registerCommentCreationTests } from "./provider-comment-scenarios.js";
export { registerProviderCompositionTests } from "./provider-composition-scenarios.js";
export { registerIssueIdentityTests } from "./provider-identity-scenarios.js";
export { createPullRequestFixture, createPullRequestTransport, registerPullRequestSelectionTests } from "./provider-request-scenarios.js";
export { createSetupRuntime } from "./setup-runtime.js";
export {
  bindWorkerForTesting,
  createEmptyIssueStateStoreForTesting,
  replaceIssueArchiveStoreForTesting,
  replaceIssueStateStoreForTesting,
  seedIssueRuntimeState,
} from "./state-fixtures.js";
export { TestProvider } from "./test-provider.js";
export type { ProviderCall } from "./types.js";
