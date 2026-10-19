/** Exposes the supported project-routing capability API. */

export { ROUTE_PEER_KIND } from "./const.js";
export { ROUTE_DIAGNOSTIC_CODE } from "./const.js";
export { isDirectDestination, matchesExactDestination } from "./route-matching.js";
export { inspectConfiguredProjectRoutes, inspectExactRoute, inspectProjectRoute, validateDestinationAvailability, validateProjectRoute } from "./route-validation.js";
export type { ProjectRouteInspection, RouteConfig, RouteDiagnostic } from "./types.js";
