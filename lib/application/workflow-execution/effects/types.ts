/** Contracts for exact PR observations and ordered transition effects. */

import type { RunCommand } from "../../../context.js";
import type { TransitionAction } from "../../../domain/index.js";
import type { IssueProvider, PrState, PrStatus } from "../../../integrations/index.js";
import type { MERGE_EFFECT_OUTCOME } from "./const.js";

/** Confirmed merge or conflict with the exact observed request. */
type ObservedMergeEffect = {
  /** Provider evidence for the selected PR. */
  status: PrStatus;
  /** Confirmed result suitable for workflow routing. */
  kind: typeof MERGE_EFFECT_OUTCOME.MERGED | typeof MERGE_EFFECT_OUTCOME.CONFLICT;
};

/** Explicit absence, permitted only by an orchestration policy supporting direct commits. */
type MissingMergeEffect = {
  /** No PR was found for this issue. */
  kind: typeof MERGE_EFFECT_OUTCOME.NO_PR;
  /** Observation retaining the provider's absence evidence. */
  status: PrStatus;
};

/** Merge evidence; unknown outcomes are propagated as errors. */
export type MergeEffectResult = ObservedMergeEffect | MissingMergeEffect;

/** Capabilities and selected actions; the caller must hold the issue orchestration lock. */
export type TransitionEffectsInput = {
  /** Provider scoped to the owning project. */
  provider: IssueProvider;
  /** Managed issue identity. */
  issueId: number;
  /** Ordered actions selected by the configured event. */
  actions: readonly TransitionAction[];
  /** Captured request whose identity must not change; null captures absence. */
  prUrl?: string | null;
  /** Fresh review states that may authorize a merge, when a review gate applies. */
  allowedMergeStates?: readonly PrState[];
  /** Explicit policy permitting an issue with no PR to proceed. */
  allowMissingPr?: boolean;
  /** Optional command transport for checkout refresh actions. */
  runCommand?: RunCommand;
  /** Checkout resolved by the caller. */
  repoPath?: string;
  /** Optional refresh timeout resolved by the caller. */
  gitPullMs?: number;
  /** Receives best-effort action diagnostics without changing transition success. */
  onWarning?: (action: TransitionAction, error: unknown) => Promise<void>;
};

/** Observations and successfully processed prefix before a confirmed conflict. */
export type TransitionEffectsResult = {
  /** Exact merge result, or null when no merge action was requested. */
  merge: MergeEffectResult | null;
  /** Actions processed in configuration order; optional actions may have warned. */
  processedActions: TransitionAction[];
  /** Selected or detected PR URL. */
  prUrl?: string;
  /** Display title observed for that request. */
  prTitle?: string;
  /** Observed source branch. */
  sourceBranch?: string;
};
