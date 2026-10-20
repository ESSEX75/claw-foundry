/** Exposes reusable provider contract scenarios without registering tests on import. */

export { registerCommentCreationTests } from "./comment.js";
export { registerProviderCompositionTests } from "./composition.js";
export { registerIssueIdentityTests } from "./identity.js";
export { createPullRequestFixture, createPullRequestTransport, registerPullRequestSelectionTests } from "./request.js";
