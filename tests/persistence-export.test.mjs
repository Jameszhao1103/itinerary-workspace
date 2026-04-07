import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSampleTrip } from "../server/demo/sample-trip.ts";
import { buildCalendarExport, buildPrintableDocument, FileTripRepository } from "../server/planner/index.ts";

test("file trip repository persists and reloads trips", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "planner-repo-"));
  try {
    const repository = new FileTripRepository(rootDir);
    const trip = createSampleTrip();
    trip.title = "Persistent test trip";

    await repository.saveTrip(trip);
    const loaded = await repository.getTripById(trip.trip_id);

    assert.ok(loaded);
    assert.equal(loaded.title, "Persistent test trip");
    assert.equal(loaded.trip_id, trip.trip_id);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("calendar export generates Apple Calendar compatible ICS", () => {
  const trip = createSampleTrip();
  const exportPayload = buildCalendarExport(trip, {
    dayDate: "2026-04-12",
  });

  assert.equal(exportPayload.fileName.endsWith(".ics"), true);
  assert.match(exportPayload.content, /BEGIN:VCALENDAR/);
  assert.match(exportPayload.content, /BEGIN:VEVENT/);
  assert.match(exportPayload.content, /SUMMARY:Lunch at White Duck Taco Shop/);
  assert.match(exportPayload.content, /END:VCALENDAR/);
});

test("printable export returns print-friendly HTML", () => {
  const trip = createSampleTrip();
  const exportPayload = buildPrintableDocument(trip, {
    dayDate: "2026-04-13",
  });

  assert.equal(exportPayload.fileName.endsWith(".html"), true);
  assert.match(exportPayload.content, /Print \/ Save PDF/);
  assert.match(exportPayload.content, /Day 2/);
  assert.match(exportPayload.content, /Battery Park Book Exchange/);
});
