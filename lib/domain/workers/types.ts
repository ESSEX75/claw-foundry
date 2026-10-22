/** Shared issue and slot contract for an unresolved worker submission. */

import type { ValueOf } from "../../shared/types.js";
import { WORKER_DELIVERY_STATUS, WORKER_SESSION_ACTION } from "./const.js";

/** Durable evidence that a worker-turn submission has no confirmed outcome. */
export type WorkerDeliveryState = {
  /** Unique submission identity, retained across uncertain outcomes and reconciliation. */
  operationId?: string;
  /** Current investigation stage; only explicit success removes this marker. */
  status: ValueOf<typeof WORKER_DELIVERY_STATUS>;
  /** First reservation or uncertain response time in ISO format. */
  recordedAt: string;
  /** Diagnostic explaining the latest uncertainty. */
  reason: string;
  /** Most recent reconciliation time, when available. */
  checkedAt?: string;
  /** Whether the gateway session was observed; existence does not prove turn acceptance. */
  sessionObserved?: boolean | null;
};

/** Exact reusable-session run identity shared by local issue ownership and captured commands. */
export type WorkerRunIdentity = {
  /** Configured role owning the run. */
  role: string;
  /** Configured worker level. */
  level: string;
  /** Concrete capacity reservation. */
  slotIndex: number;
  /** Session identity; alone it cannot distinguish replacement runs. */
  sessionKey: string | null;
  /** Timestamp selected when this run reserved its slot. */
  startedAt: string;
};

/** Whether a worker turn creates a session identity or reuses one. */
export type WorkerSessionAction = ValueOf<typeof WORKER_SESSION_ACTION>;
