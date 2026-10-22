/** Exposes the supported bindings capability API. */

export { ensureChannelBinding, planChannelBinding } from "./binding-manager.js";
export { SETUP_NOTIFICATION_CHANNELS } from "./const.js";
export { listChannelBindingChoices } from "./endpoint-choices.js";
export { isSetupNotificationChannel } from "./guards.js";
export type { SetupEndpointChoice, SetupNotificationChannel } from "./types.js";
