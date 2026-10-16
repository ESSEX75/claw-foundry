/** Exposes the supported setup facade while keeping internal composition operations in their child APIs. */

export { getSetupEndpointChoices } from "./endpoint-choices.js";
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
export type { SetupEndpointChoicesInput, SetupOpts, SetupResult, SetupRuntime } from "./types.js";
export { compareWorkspaceConfig, resetWorkspaceConfig } from "./workspace-config.js";
