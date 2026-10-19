/** Verifies reservation observations remain distinct from active worker ownership and execution capacity. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { hasOtherProjectReservation } from "./execution.js";
import { findProjectIssueReservation, hasProjectWorkerSlot, reservationMatchesWorkerRun } from "./reservations.js";
import { emptySlot } from "./slots.js";
import type { Project } from "./types.js";

/** Build an incomplete retained reservation, independent of any issue runtime record.
 * @param slug - Project whose capacity is observed.
 */
function projectWithReservation(slug: string): Project {
  return { slug, name: slug, agentId: "agent", repo: "repo", baseBranch: "main", deployBranch: "main",
    channels: [], provider: "github", workers: { custom: { levels: { specialist: [
      { ...emptySlot(), issueId: 7 },
    ] } } } };
}

it("retains incomplete inactive reservations without inventing worker start identity", () => {
  const project = projectWithReservation("one");
  const reservation = findProjectIssueReservation(project, 7);

  assert.equal(hasProjectWorkerSlot(project, 7), true);
  assert.equal(reservation?.role, "custom");
  assert.equal(reservation?.slot.active, false);
  assert.equal(reservation?.slot.startTime, null);
  assert.equal(findProjectIssueReservation(project, 8), null);
  assert.equal(findProjectIssueReservation(undefined, 7), null);
});

it("rejects ambiguous reservations across roles instead of selecting the first slot", () => {
  const project = projectWithReservation("one");

  project.workers.other = { levels: { extra: [{ ...emptySlot(), issueId: 7 }] } };
  assert.throws(() => findProjectIssueReservation(project, 7), /ambiguous worker slot ownership/);
});

it("compares a reservation only with a supplied issue frame, preserving timestamp and slot identity rules", () => {
  const project = projectWithReservation("one");
  const reservation = findProjectIssueReservation(project, 7);
  const worker = { role: "custom", level: "specialist", slotIndex: 0, sessionKey: null, startedAt: "" };

  assert.equal(reservationMatchesWorkerRun(reservation, 7, worker), true);
  assert.equal(reservationMatchesWorkerRun(reservation, 8, worker), false);
  assert.equal(reservationMatchesWorkerRun(reservation, 7, { ...worker, startedAt: "replacement" }), false);
  assert.equal(reservationMatchesWorkerRun(reservation, 7, { ...worker, slotIndex: 1 }), false);
  assert.equal(reservationMatchesWorkerRun(null, 7, worker), false);
  assert.equal(reservation?.slot.startTime, null);
});

it("checks other-project execution capacity independently of inactive retained issue references", () => {
  const one = projectWithReservation("one");
  const two = projectWithReservation("two");
  const slot = two.workers.custom?.levels.specialist?.[0];

  assert.ok(slot);
  assert.equal(hasOtherProjectReservation({ one, two }, "one"), false);
  slot.active = true;
  assert.equal(hasOtherProjectReservation({ one, two }, "one"), true);
  assert.equal(hasOtherProjectReservation({ one, two }, "two"), false);
});
