/** Validates setup notification transports and unknown channel-specific settings shapes. */

import { SETUP_NOTIFICATION_CHANNELS } from "./const.js";
import type { SetupNotificationChannel } from "./types.js";

/** Validate a supported setup channel.
 * @param value - Untrusted adapter input.
 */
export function isSetupNotificationChannel(value: unknown): value is SetupNotificationChannel {
  return SETUP_NOTIFICATION_CHANNELS.some(channel => channel === value);
}

/** Narrow channel-specific settings before reading group or topic inventories.
 * @param value - Unknown SDK channel settings or nested inventory.
 */
export function isRoutingSettingsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
