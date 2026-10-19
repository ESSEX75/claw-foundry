/** Owns contracts for bindings. */

import { NOTIFICATION_CHANNEL } from "../../../domain/index.js";

/** Channels supported by the setup adapter. */
export const SETUP_NOTIFICATION_CHANNELS = [NOTIFICATION_CHANNEL.TELEGRAM, NOTIFICATION_CHANNEL.WHATSAPP] as const;

/** SDK group/topic inventory marker that cannot identify an exact binding destination. */
export const ROUTING_INVENTORY_WILDCARD = "*";
