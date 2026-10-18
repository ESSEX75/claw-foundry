/** Supported setup routing capabilities for coordinating use cases. */

export { ensureChannelBinding, planChannelBinding } from "./binding-manager.js";
export { SETUP_NOTIFICATION_CHANNELS } from "./const.js";
export { listChannelBindingChoices } from "./endpoint-choices.js";
export { isSetupNotificationChannel } from "./guards.js";
export { inspectConfiguredProjectRoutes, inspectProjectRoute, validateDestinationAvailability, validateProjectRoute } from "./route-validation.js";
export type { ProjectRouteInspection, RouteConfig, RouteDiagnostic, SetupEndpointChoice, SetupNotificationChannel } from "./types.js";
