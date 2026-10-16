/** Exposes the supported setup facade while keeping internal composition operations in their child APIs. */

export { SETUP_OPERATION } from "./const.js";
export { getSetupEndpointChoices } from "./endpoint-choices.js";
export { getSetupModels } from "./model-query.js";
export { getOnboardingContext } from "./onboarding/index.js";
export { DEVCLAW_AGENT_TOOLS, isScopeApprovalRejectedError, isScopeApprovalRequiredError, resolveProjectToolOwners } from "./permissions/index.js";
export type { RouteConfig, RouteDiagnostic, SetupEndpointChoice, SetupNotificationChannel } from "./routing/index.js";
export {
  inspectConfiguredProjectRoutes,
  inspectProjectRoute,
  isSetupNotificationChannel,
  SETUP_NOTIFICATION_CHANNELS,
  validateDestinationAvailability,
  validateProjectRoute,
} from "./routing/index.js";
export { runSetup } from "./run-setup.js";
export type { ModelConfig, SetupEndpointChoicesInput, SetupModelQueryInput, SetupOpts, SetupResult, SetupRuntime } from "./types.js";
export { compareWorkspaceConfig, resetWorkspaceConfig } from "./workspace-config.js";
