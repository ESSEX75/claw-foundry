/** Parses administrative terminal selections without silently widening their scope. */

/** Parse an exact positive safe issue identifier before resolving dependencies.
 * @param value - Raw terminal identifier, allowing surrounding whitespace.
 */
export function parseIssueId(value: string): number {
  const normalized = value.trim();
  const issueId = Number(normalized);

  if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(issueId) || issueId <= 0) {
    throw new Error(`Invalid issue ID "${value}".`);
  }

  return issueId;
}

/** Parse an explicitly supplied list, refusing blank elements rather than omitting them.
 * @param value - Raw comma-separated option; only omission means no selection filter.
 * @param option - Terminal option name included in input diagnostics.
 */
export function parseSelection(value: string | undefined, option: string): string[] | undefined {
  if (value === undefined) return undefined;
  const entries = value.split(",").map(entry => entry.trim());

  if (entries.some(entry => !entry)) throw new Error(`${option} requires a non-empty comma-separated list without blank entries.`);

  return entries;
}

/** Parse every selected identifier, rejecting the entire list if any item is invalid.
 * @param value - Raw optional issue list from the terminal.
 */
export function parseIssueSelection(value: string | undefined): number[] | undefined {
  return parseSelection(value, "--issue")?.map(parseIssueId);
}

/** Require one explicit preview/apply mode before any command effects.
 * @param dryRun - Whether the preview flag was supplied.
 * @param apply - Whether the mutation flag was supplied.
 */
export function requireExclusiveMode(dryRun: boolean | undefined, apply: boolean | undefined): void {
  if (dryRun && apply) throw new Error("Choose either --dry-run or --apply.");
  if (!dryRun && !apply) throw new Error("Choose an explicit mode: --dry-run or --apply.");
}
