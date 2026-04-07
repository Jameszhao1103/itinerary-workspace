import { stableKey, TtlCache } from "../../shared/cache.ts";
import type { RuntimeMetrics } from "../../shared/metrics.ts";
import type {
  PlaceCandidate,
  PlaceDetailsRequest,
  PlaceSearchRequest,
  PlaceSnapshot,
  PlacesAdapter,
} from "../google/index.ts";

export class CachedPlacesAdapter implements PlacesAdapter {
  private readonly inner: PlacesAdapter;
  private readonly searchCache: TtlCache<PlaceCandidate[]>;
  private readonly detailsCache: TtlCache<PlaceSnapshot>;
  private readonly metrics?: RuntimeMetrics;

  constructor(
    inner: PlacesAdapter,
    options: {
      searchTtlMs: number;
      detailsTtlMs: number;
      metrics?: RuntimeMetrics;
    }
  ) {
    this.inner = inner;
    this.searchCache = new TtlCache(options.searchTtlMs);
    this.detailsCache = new TtlCache(options.detailsTtlMs);
    this.metrics = options.metrics;
  }

  async searchByText(input: PlaceSearchRequest): Promise<PlaceCandidate[]> {
    const key = stableKey(input);
    const cached = this.searchCache.get(key);
    if (cached) {
      this.metrics?.recordProviderCall({
        provider: "places",
        operation: "searchByText",
        durationMs: 0,
        cacheHit: true,
      });
      return cached;
    }

    const startedAt = Date.now();
    try {
      const result = await this.inner.searchByText(input);
      this.searchCache.set(key, result);
      this.metrics?.recordProviderCall({
        provider: "places",
        operation: "searchByText",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });
      return result;
    } catch (error) {
      this.metrics?.recordProviderCall({
        provider: "places",
        operation: "searchByText",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
        status: "error",
      });
      throw error;
    }
  }

  async getPlaceDetails(input: PlaceDetailsRequest): Promise<PlaceSnapshot> {
    const key = stableKey(input);
    const cached = this.detailsCache.get(key);
    if (cached) {
      this.metrics?.recordProviderCall({
        provider: "places",
        operation: "getPlaceDetails",
        durationMs: 0,
        cacheHit: true,
      });
      return cached;
    }

    const startedAt = Date.now();
    try {
      const result = await this.inner.getPlaceDetails(input);
      this.detailsCache.set(key, result);
      this.metrics?.recordProviderCall({
        provider: "places",
        operation: "getPlaceDetails",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });
      return result;
    } catch (error) {
      this.metrics?.recordProviderCall({
        provider: "places",
        operation: "getPlaceDetails",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
        status: "error",
      });
      throw error;
    }
  }

  snapshot() {
    return {
      search: this.searchCache.snapshot(),
      details: this.detailsCache.snapshot(),
    };
  }
}
