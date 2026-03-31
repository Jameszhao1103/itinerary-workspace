import { GooglePlacesAdapter } from "./places/google-places-adapter.ts";
import { GoogleRoutesAdapter } from "./routes/google-routes-adapter.ts";
import { GoogleHttpClient } from "./shared/http-client.ts";
import {
  resolveGoogleAdaptersConfig,
  type GoogleAdaptersConfig,
  type ResolvedGoogleAdaptersConfig,
} from "./config.ts";

export type GoogleAdapters = {
  placesAdapter: GooglePlacesAdapter;
  routesAdapter: GoogleRoutesAdapter;
};

export function createGoogleAdapters(
  input: Partial<GoogleAdaptersConfig> = {}
): GoogleAdapters {
  const config: ResolvedGoogleAdaptersConfig = resolveGoogleAdaptersConfig(input);

  const placesClient = new GoogleHttpClient({
    apiKey: config.apiKey,
    baseUrl: config.placesBaseUrl,
    timeoutMs: config.timeoutMs,
  });

  const routesClient = new GoogleHttpClient({
    apiKey: config.apiKey,
    baseUrl: config.routesBaseUrl,
    timeoutMs: config.timeoutMs,
  });

  return {
    placesAdapter: new GooglePlacesAdapter(placesClient),
    routesAdapter: new GoogleRoutesAdapter(routesClient),
  };
}
