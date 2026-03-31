import test from "node:test";
import assert from "node:assert/strict";
import { createRuntime } from "../server/app/create-runtime.mjs";

test("planner service can preview and apply a dinner replacement", async () => {
  const previousProvider = process.env.PLANNER_PROVIDER;
  process.env.PLANNER_PROVIDER = "mock";
  const runtime = await createRuntime();
  try {
    const trip = await runtime.tripRepository.getTripById(runtime.sampleTripId);
    assert.ok(trip);

    const preview = await runtime.plannerService.previewCommand({
      tripId: runtime.sampleTripId,
      baseVersion: trip.version,
      input: {
        utterance: "把周六晚餐换成评分高一点的美式餐厅",
      },
    });

    const dinner = preview.trip_preview.days[0].items.find((item) => item.id === "item_dinner");
    assert.ok(dinner);
    assert.notEqual(dinner.place_id, "place_curate");
    assert.equal(preview.base_version, 1);
    assert.equal(preview.result_version, 2);

    const applied = await runtime.plannerService.applyPreview({
      tripId: runtime.sampleTripId,
      baseVersion: trip.version,
      previewId: preview.preview_id,
    });

    const appliedDinner = applied.trip.days[0].items.find((item) => item.id === "item_dinner");
    assert.ok(appliedDinner);
    assert.equal(applied.trip.version, 2);
    assert.notEqual(appliedDinner.place_id, "place_curate");
  } finally {
    if (previousProvider === undefined) {
      delete process.env.PLANNER_PROVIDER;
    } else {
      process.env.PLANNER_PROVIDER = previousProvider;
    }
  }
});

test("planner service can reorder an item within the day", async () => {
  const previousProvider = process.env.PLANNER_PROVIDER;
  process.env.PLANNER_PROVIDER = "mock";
  const runtime = await createRuntime();
  try {
    const trip = await runtime.tripRepository.getTripById(runtime.sampleTripId);
    assert.ok(trip);

    const preview = await runtime.plannerService.previewCommand({
      tripId: runtime.sampleTripId,
      baseVersion: trip.version,
      input: {
        commands: [
          {
            command_id: "cmd_reorder_test",
            action: "reorder_item",
            day_date: "2026-04-12",
            item_id: "item_lunch",
            target_item_id: "item_walk_river_arts",
            reason: "Move lunch later in the afternoon",
            payload: {
              position: "after",
            },
          },
        ],
      },
    });

    const day = preview.trip_preview.days.find((item) => item.date === "2026-04-12");
    const walkIndex = day.items.findIndex((item) => item.id === "item_walk_river_arts");
    const lunch = day.items.find((item) => item.id === "item_lunch");
    const lunchIndex = day.items.findIndex((item) => item.id === "item_lunch");

    assert.ok(day);
    assert.ok(lunch);
    assert.ok(walkIndex !== -1);
    assert.ok(lunchIndex > walkIndex);
    assert.equal(lunch.start_at, "2026-04-12T16:00:00-04:00");
  } finally {
    if (previousProvider === undefined) {
      delete process.env.PLANNER_PROVIDER;
    } else {
      process.env.PLANNER_PROVIDER = previousProvider;
    }
  }
});
