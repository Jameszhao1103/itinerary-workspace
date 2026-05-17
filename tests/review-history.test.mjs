import test from "node:test";
import assert from "node:assert/strict";
import { collectReviewHistoryEntries, renderReviewHistory } from "../public/app/review-history.js";

test("review history entries merge persisted decisions with active conflicts", () => {
  const trip = {
    conflicts: [
      {
        id: "conflict_active",
        type: "meal_window_missing",
        severity: "warning",
        message: "No dinner is scheduled.",
        item_ids: ["item_dinner"],
      },
    ],
    review_decisions: [
      {
        id: "review_old",
        conflict_id: "conflict_archived",
        decision: "accepted",
        decided_at: "2026-05-17T10:00:00Z",
        decided_by: "user",
        conflict_message: "Archived conflict",
        conflict_type: "opening_hours_conflict",
        day_date: "2026-06-11",
        item_ids: ["item_old"],
      },
      {
        id: "review_new",
        conflict_id: "conflict_active",
        decision: "accepted",
        decided_at: "2026-05-17T12:00:00Z",
        decided_by: "assistant",
        reason: "Lunch timing is intentional.",
      },
    ],
  };

  const entries = collectReviewHistoryEntries(trip);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, "review_new");
  assert.equal(entries[0].active, true);
  assert.equal(entries[0].message, "No dinner is scheduled.");
  assert.equal(entries[1].active, false);
  assert.equal(entries[1].message, "Archived conflict");
});

test("review history renders locate and reopen controls", () => {
  const html = renderReviewHistory({
    conflicts: [],
    review_decisions: [
      {
        id: "review_1",
        conflict_id: "conflict_1",
        decision: "accepted",
        decided_at: "2026-05-17T12:00:00Z",
        decided_by: "user",
        conflict_message: "Dinner is outside the meal window.",
        conflict_type: "meal_window_missing",
        day_date: "2026-06-11",
        item_ids: ["item_dinner"],
        reason: "Late dinner reservation is confirmed.",
      },
    ],
  });

  assert.match(html, /Review history/);
  assert.match(html, /Dinner is outside the meal window/);
  assert.match(html, /Late dinner reservation is confirmed/);
  assert.match(html, /data-review-action="locate"/);
  assert.match(html, /data-conflict-action="reopen-review"/);
});

test("review history stays hidden when no decisions exist", () => {
  assert.equal(renderReviewHistory({ conflicts: [], review_decisions: [] }), "");
});
