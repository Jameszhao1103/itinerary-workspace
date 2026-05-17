import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyConflict,
  conflictFilterLabel,
  countConflictGrades,
  filterConflictsForView,
  normalizeConflictFilter,
} from "../public/app/conflict-controls.js";

test("conflict controls classify must-fix and review conflicts", () => {
  assert.equal(classifyConflict(conflict({ type: "overlap_conflict", severity: "warning" })).level, "must-fix");
  assert.equal(classifyConflict(conflict({ type: "meal_window_missing", severity: "warning" })).level, "review");
  assert.equal(classifyConflict(conflict({ type: "note", severity: "info" })).level, "fyi");
});

test("conflict controls filter and count visible conflicts", () => {
  const conflicts = [
    conflict({ id: "must", type: "travel_time_underestimated", severity: "warning" }),
    conflict({ id: "review", type: "opening_hours_conflict", severity: "warning" }),
    conflict({ id: "fyi", type: "note", severity: "info" }),
  ];

  assert.deepEqual(filterConflictsForView(conflicts, "must-fix").map((item) => item.id), ["must"]);
  assert.deepEqual(filterConflictsForView(conflicts, "review").map((item) => item.id), ["review"]);
  assert.deepEqual(filterConflictsForView(conflicts, "all").map((item) => item.id), ["must", "review", "fyi"]);
  assert.deepEqual(countConflictGrades(conflicts), { "must-fix": 1, review: 1 });
});

test("conflict controls normalize unknown filters", () => {
  assert.equal(normalizeConflictFilter("bad"), "all");
  assert.equal(conflictFilterLabel("must-fix"), "Must fix");
  assert.equal(conflictFilterLabel("review"), "Review");
  assert.equal(conflictFilterLabel("anything"), "All");
});

function conflict(overrides = {}) {
  return {
    id: "conflict",
    type: "meal_window_missing",
    severity: "warning",
    message: "Needs review",
    item_ids: [],
    ...overrides,
  };
}
