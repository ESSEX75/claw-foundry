/** Classifies provider labels using explicit configuration and reserved domain namespaces. */

import { NOTIFY_LABEL_PREFIX, OWNER_LABEL_PREFIX, POLICY_LABEL_PREFIX } from "../../domain/index.js";
import { DEVCLAW_LABEL_PREFIX } from "./const.js";
import type { ManagedLabelOptions } from "./types.js";

/** Determine configuration ownership; missing role configuration is an input error.
 * Role namespaces include obsolete levels so reconciliation can remove them.
 * @param label - Observed provider label to classify.
 * @param options - Explicit current workflow and role ownership rules.
 */
export function isManagedLabel(label: string, options: ManagedLabelOptions): boolean {
  if (!Array.isArray(options.roles)) throw new Error("Projection requires an explicit configured role list.");
  if (options.stateLabels.includes(label)) return true;
  if (label.startsWith(OWNER_LABEL_PREFIX)) return true;
  if (label.startsWith(NOTIFY_LABEL_PREFIX)) return true;
  if (label.startsWith(DEVCLAW_LABEL_PREFIX)) return true;
  if (Object.values(POLICY_LABEL_PREFIX).some(prefix => label.startsWith(prefix))) return true;
  const separator = label.indexOf(":");

  if (separator <= 0 || separator === label.length - 1) return false;

  return options.roles.includes(label.slice(0, separator));
}
