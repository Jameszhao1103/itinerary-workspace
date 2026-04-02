import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveMapsBrowserApiKey,
  resolveRuntimeMode,
  resolveCommandPlannerMode,
} from "../server/app/runtime-config.mjs";

test("browser map key does not fall back to the server google key", () => {
  assert.equal(
    resolveMapsBrowserApiKey({
      GOOGLE_MAPS_API_KEY: "server-only-key",
    }),
    null
  );

  assert.equal(
    resolveMapsBrowserApiKey({
      GOOGLE_MAPS_BROWSER_API_KEY: "browser-key",
      GOOGLE_MAPS_API_KEY: "server-only-key",
    }),
    "browser-key"
  );
});

test("runtime mode and command planner mode still infer from server env", () => {
  assert.equal(
    resolveRuntimeMode({
      GOOGLE_MAPS_API_KEY: "server-only-key",
    }),
    "google"
  );

  assert.equal(
    resolveCommandPlannerMode({
      OPENAI_API_KEY: "openai-key",
    }),
    "openai"
  );
});
