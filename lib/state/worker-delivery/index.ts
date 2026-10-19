/** Exposes durable worker recovery records to the state root API. */

export { readWorkerDeliveryResolution, writeWorkerDeliveryResolution } from "./repository.js";
export type { WorkerDeliveryResolution } from "./types.js";
