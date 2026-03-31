import {
  FallbackCommandTranslator,
  InMemoryPreviewRepository,
  InMemoryTripRepository,
  OpenAiCommandTranslator,
  PlannerService,
  recomputeDerivedState,
} from "../planner/index.ts";
import { RuleBasedCommandTranslator } from "../planner/rule-based-command-translator.ts";
import { MockPlacesAdapter, MockRoutesAdapter } from "../integrations/mock/index.ts";
import { createGoogleAdapters } from "../integrations/google/index.ts";
import {
  createSamplePlaceCatalog,
  createSampleTrip,
  SAMPLE_TRIP_ID,
} from "../demo/sample-trip.ts";
import {
  resolveCommandPlannerMode,
  resolveMapsBrowserApiKey,
  resolveOpenAiConfig,
  resolveRuntimeEnv,
  resolveRuntimeMode,
} from "./runtime-config.mjs";

export async function createRuntime() {
  const env = resolveRuntimeEnv();
  const provider = resolveRuntimeMode(env);
  const mapsBrowserApiKey = resolveMapsBrowserApiKey(env);
  const commandPlannerMode = resolveCommandPlannerMode(env);
  const openAiConfig = resolveOpenAiConfig(env);
  const catalog = createSamplePlaceCatalog();
  const seedTrip = createSampleTrip();
  const adapters =
    provider === "google"
      ? createGoogleAdapters()
      : {
          placesAdapter: new MockPlacesAdapter(catalog),
          routesAdapter: new MockRoutesAdapter(catalog),
        };
  const { placesAdapter, routesAdapter } = adapters;
  const seedNow = new Date("2026-03-30T21:00:00-04:00");

  await recomputeDerivedState(seedTrip, {
    placesAdapter,
    routesAdapter,
    now: seedNow,
  });

  const tripRepository = new InMemoryTripRepository([seedTrip]);
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
    mapsBrowserApiKey,
    sampleTripId: SAMPLE_TRIP_ID,
    catalog,
    placesAdapter,
    routesAdapter,
    tripRepository,
    previewRepository,
    plannerService,
    async reset() {
      return createRuntime();
    },
  };

  return runtime;
}
