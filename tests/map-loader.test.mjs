import test from "node:test";
import assert from "node:assert/strict";
import { buildGoogleMapsScriptUrl, resolveGoogleMapsMapId } from "../public/app/map.js";

test("google maps loader requests async marker and geometry libraries", () => {
  const url = new URL(buildGoogleMapsScriptUrl("browser key"));
  assert.equal(url.origin, "https://maps.googleapis.com");
  assert.equal(url.pathname, "/maps/api/js");
  assert.equal(url.searchParams.get("key"), "browser key");
  assert.equal(url.searchParams.get("v"), "weekly");
  assert.equal(url.searchParams.get("loading"), "async");
  assert.equal(url.searchParams.get("libraries"), "geometry,marker");
});

test("google maps map id resolves to local demo fallback", () => {
  assert.equal(resolveGoogleMapsMapId(null), "DEMO_MAP_ID");
  assert.equal(resolveGoogleMapsMapId("custom-id"), "custom-id");
});
