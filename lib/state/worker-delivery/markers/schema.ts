/** Defines the shared persisted submission marker for issue workers and registry slots. */

import { z } from "zod";

import { WORKER_DELIVERY_STATUS } from "../../../domain/index.js";
import { TimestampSchema } from "../../persistence/index.js";

/** Unresolved delivery evidence; operation identity is distinct from a reusable session. */
export const WorkerDeliveryMarkerSchema = z.object({
  operationId: z.string().uuid().optional(),
  status: z.enum(WORKER_DELIVERY_STATUS),
  recordedAt: TimestampSchema,
  reason: z.string(),
  checkedAt: TimestampSchema.optional(),
  sessionObserved: z.boolean().nullable().optional(),
}).strict();
