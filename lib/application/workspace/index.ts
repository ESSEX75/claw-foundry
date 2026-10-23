/** Exposes workspace administration while keeping setup composition and mutation helpers private. */

export type { SetupEndpointChoice, SetupNotificationChannel } from "./bindings/index.js";
export { isSetupNotificationChannel, SETUP_NOTIFICATION_CHANNELS } from "./bindings/index.js";
export { compareWorkspaceConfig, resetWorkspaceConfig } from "./configuration/index.js";
export { SETUP_OPERATION } from "./const.js";
export { SETUP_APPLY_STEP, SETUP_RECOVERY_ACTION } from "./const.js";
export { getOnboardingContext } from "./onboarding/index.js";
export { CLAW_FOUNDRY_AGENT_TOOLS, isScopeApprovalRejectedError, isScopeApprovalRequiredError, resolveProjectToolOwners } from "./permissions/index.js";
export { getSetupEndpointChoices, getSetupModels, runSetup, SetupApplyError } from "./setup/index.js";
export type { ModelConfig, SetupEndpointChoicesInput, SetupModelQueryInput, SetupOpts, SetupResult, SetupRuntime } from "./types.js";
export type { SetupIncompleteResult, SetupRecovery } from "./types.js";
