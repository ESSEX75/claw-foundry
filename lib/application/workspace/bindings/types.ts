/** Owns contracts for bindings. */

import type { NOTIFICATION_CHANNEL, NotificationChannel } from "../../../domain/index.js";

/** Supported notification transports for setup binding requests. */
export type SetupNotificationChannel = Extract<
  NotificationChannel,
  typeof NOTIFICATION_CHANNEL.TELEGRAM | typeof NOTIFICATION_CHANNEL.WHATSAPP
>;

/** Exact configured destination currently eligible for the selected setup agent. */
export type SetupEndpointChoice = {
  /** Supported notification transport of the configured account. */
  channel: SetupNotificationChannel;
  /** Explicit configured channel account, never an inferred default. */
  accountId: string;
  /** Exact group or topic peer identity accepted by binding planning. */
  peerId: string;
};
