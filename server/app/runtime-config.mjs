import { loadWorkspaceEnv } from "../shared/env.ts";

export function resolveRuntimeEnv(env = loadWorkspaceEnv()) {
  return env;
}

export function resolveRuntimeMode(env = resolveRuntimeEnv()) {
  const provider = env.PLANNER_PROVIDER ?? inferProvider(env);
  return provider === "google" ? "google" : "mock";
}

export function resolveCommandPlannerMode(env = resolveRuntimeEnv()) {
  const mode = env.PLANNER_COMMAND_TRANSLATOR ?? inferCommandPlannerMode(env);
  return mode === "openai" ? "openai" : "rules";
}

export function resolveMapsBrowserApiKey(env = resolveRuntimeEnv()) {
  return (
    env.GOOGLE_MAPS_BROWSER_API_KEY ??
    env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    env.GOOGLE_MAPS_API_KEY ??
    env.GOOGLE_API_KEY ??
    null
  );
}

export function resolveOpenAiConfig(env = resolveRuntimeEnv()) {
  return {
    apiKey: env.OPENAI_API_KEY ?? null,
    model: env.OPENAI_MODEL ?? "gpt-4.1-mini",
    baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  };
}

function inferProvider(env) {
  if (env.GOOGLE_USE_REAL === "1" || env.GOOGLE_ENABLE_REAL === "1") {
    return "google";
  }

  return env.GOOGLE_MAPS_API_KEY || env.GOOGLE_API_KEY ? "google" : "mock";
}

function inferCommandPlannerMode(env) {
  return env.OPENAI_API_KEY ? "openai" : "rules";
}
