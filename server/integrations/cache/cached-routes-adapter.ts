import { stableKey, TtlCache } from "../../shared/cache.ts";
import type { RuntimeMetrics } from "../../shared/metrics.ts";
import type {
  ComputeLegRequest,
  RouteMatrixElement,
  RouteMatrixRequest,
  RouteSnapshot,
  RoutesAdapter,
} from "../google/index.ts";

export class CachedRoutesAdapter implements RoutesAdapter {
  private readonly inner: RoutesAdapter;
  private readonly legCache: TtlCache<RouteSnapshot>;
  private readonly matrixCache: TtlCache<RouteMatrixElement[]>;
  private readonly metrics?: RuntimeMetrics;

  constructor(
    inner: RoutesAdapter,
    options: {
      legTtlMs: number;
      matrixTtlMs: number;
      metrics?: RuntimeMetrics;
    }
  ) {
    this.inner = inner;
    this.legCache = new TtlCache(options.legTtlMs);
    this.matrixCache = new TtlCache(options.matrixTtlMs);
    this.metrics = options.metrics;
  }

  async computeLeg(input: ComputeLegRequest): Promise<RouteSnapshot> {
    const key = stableKey(input);
    const cached = this.legCache.get(key);
    if (cached) {
      this.metrics?.recordProviderCall({
        provider: "routes",
        operation: "computeLeg",
        durationMs: 0,
        cacheHit: true,
      });
      return cached;
    }

    const startedAt = Date.now();
    try {
      const result = await this.inner.computeLeg(input);
      this.legCache.set(key, result);
      this.metrics?.recordProviderCall({
        provider: "routes",
        operation: "computeLeg",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });
      return result;
    } catch (error) {
      this.metrics?.recordProviderCall({
        provider: "routes",
        operation: "computeLeg",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
        status: "error",
      });
      throw error;
    }
  }

  async computeMatrix(input: RouteMatrixRequest): Promise<RouteMatrixElement[]> {
    const key = stableKey(input);
    const cached = this.matrixCache.get(key);
    if (cached) {
      this.metrics?.recordProviderCall({
        provider: "routes",
        operation: "computeMatrix",
        durationMs: 0,
        cacheHit: true,
      });
      return cached;
    }

    const startedAt = Date.now();
    try {
      const result = await this.inner.computeMatrix(input);
      this.matrixCache.set(key, result);
      this.metrics?.recordProviderCall({
        provider: "routes",
        operation: "computeMatrix",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });
      return result;
    } catch (error) {
      this.metrics?.recordProviderCall({
        provider: "routes",
        operation: "computeMatrix",
        durationMs: Date.now() - startedAt,
        cacheHit: false,
        status: "error",
      });
      throw error;
    }
  }

  snapshot() {
    return {
      leg: this.legCache.snapshot(),
      matrix: this.matrixCache.snapshot(),
    };
  }
}
