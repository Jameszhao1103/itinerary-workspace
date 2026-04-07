import { resolve } from "node:path";
import {
  FallbackCommandTranslator,
  FileTripRepository,
  InMemoryPreviewRepository,
  InMemoryTripRepository,
  OpenAiCommandTranslator,
  PlannerService,
  recomputeDerivedState,
} from "../planner/index.ts";
import { RuleBasedCommandTranslator } from "../planner/rule-based-command-translator.ts";
import { MockPlacesAdapter, MockRoutesAdapter } from "../integrations/mock/index.ts";
import { createGoogleAdapters } from "../integrations/google/index.ts";
import { CachedPlacesAdapter, CachedRoutesAdapter } from "../integrations/cache/index.ts";
import {
  createSamplePlaceCatalog,
  createSampleTrip,
  SAMPLE_TRIP_ID,
} from "../demo/sample-trip.ts";
import { createLogger } from "../shared/logger.ts";
import { RuntimeMetrics } from "../shared/metrics.ts";
import {
  resolveCommandPlannerMode,
  resolveMapsBrowserApiKey,
  resolveObservabilityConfig,
  resolveOpenAiConfig,
  resolveStorageDirectory,
  resolveStorageMode,
  resolveRuntimeEnv,
  resolveRuntimeMode,
} from "./runtime-config.mjs";

export async function createRuntime() {
  const env = resolveRuntimeEnv();
  const provider = resolveRuntimeMode(env);
  const mapsBrowserApiKey = resolveMapsBrowserApiKey(env);
  const commandPlannerMode = resolveCommandPlannerMode(env);
  const openAiConfig = resolveOpenAiConfig(env);
  const storageMode = resolveStorageMode(env);
  const storageDirectory = resolve(resolveStorageDirectory(env));
  const observability = resolveObservabilityConfig(env);
  const logger = createLogger({
    enabled: observability.logRequests,
    level: observability.logLevel,
    bindings: {
      app: "planner-workspace",
    },
  });
  const metrics = new RuntimeMetrics();
  const catalog = createSamplePlaceCatalog();
  const seedTrip = createSampleTrip();
  const baseAdapters =
    provider === "google"
      ? createGoogleAdapters()
      : {
          placesAdapter: new MockPlacesAdapter(catalog),
          routesAdapter: new MockRoutesAdapter(catalog),
        };
  const placesAdapter = new CachedPlacesAdapter(baseAdapters.placesAdapter, {
    searchTtlMs: observability.cacheTtlMs,
    detailsTtlMs: observability.placeDetailsCacheTtlMs,
    metrics,
  });
  const routesAdapter = new CachedRoutesAdapter(baseAdapters.routesAdapter, {
    legTtlMs: observability.cacheTtlMs,
    matrixTtlMs: observability.cacheTtlMs,
    metrics,
  });
  const seedNow = new Date("2026-03-30T21:00:00-04:00");

  await recomputeDerivedState(seedTrip, {
    placesAdapter,
    routesAdapter,
    now: seedNow,
  });

  const tripRepository =
    storageMode === "file"
      ? new FileTripRepository(storageDirectory)
      : new InMemoryTripRepository([seedTrip]);
  if (storageMode === "file") {
    const existing = await tripRepository.getTripById(seedTrip.trip_id);
    if (!existing) {
      await tripRepository.saveTrip(seedTrip);
    }
  }
  const previewRepository = new InMemoryPreviewRepository();
  const ruleTranslator = new RuleBasedCommandTranslator();
  const commandTranslator =
    commandPlannerMode === "openai" && openAiConfig.apiKey
      ? new FallbackCommandTranslator(
          new OpenAiCommandTranslator({
            apiKey: openAiConfig.apiKey,
            model: openAiConfig.model,
            baseUrl: openAiConfig.baseUrl,
          }),
          ruleTranslator
        )
      : ruleTranslator;
  const assistantProvider =
    commandPlannerMode === "openai" && openAiConfig.apiKey ? "openai" : "rules";
  const plannerService = new PlannerService(tripRepository, previewRepository, {
    placesAdapter,
    routesAdapter,
    commandTranslator,
    clock: () => new Date(),
  });

  const runtime = {
    provider,
    assistantProvider,
    storageMode,
    storageDirectory,
    logger,
    metrics,
    mapsBrowserApiKey,
    sampleTripId: SAMPLE_TRIP_ID,
    catalog,
    placesAdapter,
    routesAdapter,
    tripRepository,
    previewRepository,
    plannerService,
    async reset() {
      await tripRepository.saveTrip(structuredClone(seedTrip));
      return createRuntime();
    },
    snapshot() {
      return {
        provider,
        assistant_provider: assistantProvider,
        sample_trip_id: SAMPLE_TRIP_ID,
        storage_mode: storageMode,
        storage_directory: storageDirectory,
        maps_browser_key_present: Boolean(mapsBrowserApiKey),
        metrics: metrics.snapshot(),
        cache: {
          places: placesAdapter.snapshot(),
          routes: routesAdapter.snapshot(),
        },
      };
    },
  };

  return runtime;
}
