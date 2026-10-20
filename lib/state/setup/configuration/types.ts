/** Defines explicit configuration reset scopes and read-only documents. */

import type { ValueOf } from "../../../shared/types.js";
import type { DEFAULTS_SCOPE } from "./const.js";

/** Explicit subset of packaged defaults selected for replacement. */
export type DefaultsScope = ValueOf<typeof DEFAULTS_SCOPE>;

/** Raw workflow documents available for a read-only application comparison. */
export type WorkflowDocuments = {
  /** Current workspace document, absent when defaults are implicit. */
  current: string | null;
  /** Packaged reference document for comparison. */
  template: string;
};
