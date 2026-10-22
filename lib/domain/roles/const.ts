/** Owns built-in role and capability-level identifiers independently of workflow graphs. */

/** Default built-in roles for the worker pipeline. */
export const DEFAULT_ROLES = {
  /** Developer role responsible for writing code and resolving issues. */
  DEVELOPER: "developer",
  /** Reviewer role responsible for inspecting pull requests. */
  REVIEWER: "reviewer",
  /** Tester role responsible for verifying builds and test suites. */
  TESTER: "tester",
  /** Architect role responsible for research and system design. */
  ARCHITECT: "architect",
} as const;

/** Built-in worker level identifiers shared by role definitions. */
export const DEFAULT_LEVELS = {
  /** Entry-level worker tier. */
  JUNIOR: "junior",
  /** Mid-level worker tier. */
  MEDIOR: "medior",
  /** Senior-level worker tier. */
  SENIOR: "senior",
} as const;
