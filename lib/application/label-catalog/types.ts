/** Label-definition provisioning contracts, independent of issue projection. */

import type { RunCommand } from "../../context.js";
import type { RoleDefinition, WorkflowConfig } from "../../domain/index.js";
import type { LabelProjector } from "../../integrations/index.js";

/** Provider and resolved configuration defining a project's label catalog. */
export type ProvisionLabelCatalogInput = {
  /** Explicit label-definition effects; issue read/write capabilities are unnecessary. */
  provider: Pick<LabelProjector, "ensureLabel">;
  /** Effective workflow, including project overrides. */
  workflow: WorkflowConfig;
  /** Configured role levels; disabled roles are excluded. */
  roles: Readonly<Record<string, RoleDefinition<string>>>;
};

/** Complete label catalog after successful idempotent provisioning. */
export type LabelCatalog = {
  /** Configured workflow label names. */
  stateLabels: string[];
  /** Enabled configured role/level label names. */
  roleLabels: string[];
  /** Supported review/test projection label names. */
  routingLabels: string[];
};

/** Explicit administrative scope and transport for catalog synchronization. */
export type SyncProjectLabelsInput = {
  /** Workspace containing the project registry and configuration. */
  workspaceDir: string;
  /** Exact registered slug; omitted selects all projects. */
  projectSlug?: string;
  /** Plugin provider command capability. */
  runCommand: RunCommand;
};

/** Independent project catalog result, retaining the original failure cause. */
export type ProjectLabelsResult = LabelCatalog & {
  /** Persisted canonical project slug. */
  project: string;
  /** Failure of a catalog attempt; effects before failure may already exist and are safe to repeat. */
  error?: string;
};

/** Aggregate provisioning result; provider labels never become runtime state. */
export type SyncProjectLabelsResult = {
  /** Whether every selected project's provisioning completed. */
  success: boolean;
  /** Independent project results, including failures. */
  synced: ProjectLabelsResult[];
  /** Empty-registry guidance. */
  message?: string;
  /** Best-effort audit failure, separate from provider effects. */
  auditError?: string;
};
