/** Shares managed-comment framing and lossless removal within the body capability. */

import { ISSUE_BODY_BLOCK_PATTERN, ISSUE_BODY_BLOCK_PREFIX, ISSUE_BODY_BLOCK_START_PATTERN, ISSUE_BODY_BLOCK_SUFFIX } from "./const.js";
import type { ManagedBodyBlockId } from "./types.js";

/** Read closed blocks, rejecting nested or unterminated blocks before destructive rebuilding.
 * @param body - Provider or submitted content whose user text must be retained.
 */
function readManagedBodyBlocks(body: string): string[] {
  const openings = [...body.matchAll(new RegExp(ISSUE_BODY_BLOCK_START_PATTERN, "g"))];
  const blocks = [...body.matchAll(new RegExp(ISSUE_BODY_BLOCK_PATTERN, "g"))].map(match => match[0]);

  if (openings.length !== blocks.length) throw new Error("Managed issue body contains nested or unterminated blocks.");

  return blocks;
}

/** Extract one canonical payload; missing, malformed, or duplicated blocks return null.
 * @param body - Provider text observed for identity verification.
 * @param identifier - Block kind owned by this capability.
 */
export function readSingleManagedBodyPayload(body: string, identifier: ManagedBodyBlockId): string | null {
  const blocks = readManagedBodyBlocks(body).filter(block => block.startsWith(`${ISSUE_BODY_BLOCK_PREFIX}${identifier}`));
  const block = blocks[0];
  const prefix = `${ISSUE_BODY_BLOCK_PREFIX}${identifier} `;

  if (blocks.length !== 1 || !block || !block.startsWith(prefix) || !block.endsWith(ISSUE_BODY_BLOCK_SUFFIX)) return null;

  return block.slice(prefix.length, -ISSUE_BODY_BLOCK_SUFFIX.length);
}

/** Remove selected closed blocks, preserving all text outside them and rejecting unsafe framing.
 * @param body - Content containing user prose and possibly submitted managed blocks.
 * @param identifiers - Block kinds to remove without affecting other managed kinds.
 */
export function removeManagedBodyBlocks(body: string, identifiers: readonly ManagedBodyBlockId[]): string {
  let content = body;

  for (const block of readManagedBodyBlocks(body)) {
    if (identifiers.some(identifier => block.startsWith(`${ISSUE_BODY_BLOCK_PREFIX}${identifier}`))) {
      content = content.replace(block, "");
    }
  }

  return content.trimEnd();
}

/** Append a canonical managed block with stable separation from user content.
 * @param body - Existing text whose trailing whitespace is normalized.
 * @param block - Canonical rendered block supplied by this capability.
 */
export function appendManagedBodyBlock(body: string, block: string): string {
  const content = body.trimEnd();

  return content ? `${content}\n\n${block}` : block;
}
