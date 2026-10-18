/** Output shapes owned by the project status adapter. */

/** Minimal reservation details exposed in a project dashboard. */
export type ProjectWorkerSlotSummary = {
  /** Whether the project registry reserves this slot. */
  active: boolean;
  /** Reserved provider issue, or null for an empty slot. */
  issueId: number | null;
  /** Start timestamp retained by the registry. */
  startTime: string | null;
};

/** Configured capacities and current reservations for one persisted role. */
export type ProjectWorkerSummary = {
  /** Effective capacity per configured level, including custom scales. */
  levelMaxWorkers: Partial<Record<string, number>>;
  /** Number of active slot reservations across levels. */
  activeSlots: number;
  /** Reservation details grouped by their persisted level identifier. */
  levels: Record<string, ProjectWorkerSlotSummary[]>;
};
