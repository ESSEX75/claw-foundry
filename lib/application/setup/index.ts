/** Exposes the supported setup facade while keeping internal composition operations in their child APIs. */

export type { SetupEndpointChoice, SetupNotificationChannel } from "./bindings/index.js";
export { isSetupNotificationChannel, SETUP_NOTIFICATION_CHANNELS } from "./bindings/index.js";
export { SETUP_OPERATION } from "./const.js";
export { SETUP_APPLY_STEP, SETUP_RECOVERY_ACTION } from "./const.js";
export { getSetupEndpointChoices } from "./endpoint-choices.js";
export { SetupApplyError } from "./errors.js";
export { getSetupModels } from "./model-query.js";
export { getOnboardingContext } from "./onboarding/index.js";
export { DEVCLAW_AGENT_TOOLS, isScopeApprovalRejectedError, isScopeApprovalRequiredError, resolveProjectToolOwners } from "./permissions/index.js";
export { runSetup } from "./run-setup.js";
export type { ModelConfig, SetupEndpointChoicesInput, SetupModelQueryInput, SetupOpts, SetupResult, SetupRuntime } from "./types.js";
export type { SetupIncompleteResult, SetupRecovery } from "./types.js";
export { compareWorkspaceConfig, resetWorkspaceConfig } from "./workspace-config.js";
