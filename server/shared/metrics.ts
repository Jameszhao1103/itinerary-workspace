export type RuntimeMetricsSnapshot = {
  requests: {
    total: number;
    by_key: Record<string, number>;
  };
  provider_calls: {
    total: number;
    by_key: Record<string, number>;
    cache_hits: number;
    cache_misses: number;
  };
  durations_ms: {
    request_avg: number;
    provider_avg: number;
  };
};

export class RuntimeMetrics {
  private readonly requestCounters = new Map<string, number>();
  private readonly providerCounters = new Map<string, number>();
  private requestTotal = 0;
  private providerTotal = 0;
  private providerCacheHits = 0;
  private providerCacheMisses = 0;
  private requestDurationTotal = 0;
  private providerDurationTotal = 0;

  recordRequest(input: {
    method: string;
    route: string;
    status: number;
    durationMs: number;
  }): void {
    this.requestTotal += 1;
    this.requestDurationTotal += Math.max(0, input.durationMs);
    const key = `${input.method} ${input.route} ${input.status}`;
    this.requestCounters.set(key, (this.requestCounters.get(key) ?? 0) + 1);
  }

  recordProviderCall(input: {
    provider: string;
    operation: string;
    durationMs: number;
    cacheHit?: boolean;
    status?: "ok" | "error";
  }): void {
    this.providerTotal += 1;
    this.providerDurationTotal += Math.max(0, input.durationMs);
    if (input.cacheHit) {
      this.providerCacheHits += 1;
    } else {
      this.providerCacheMisses += 1;
    }
    const status = input.status ?? "ok";
    const key = `${input.provider}.${input.operation}.${status}`;
    this.providerCounters.set(key, (this.providerCounters.get(key) ?? 0) + 1);
  }

  snapshot(): RuntimeMetricsSnapshot {
    return {
      requests: {
        total: this.requestTotal,
        by_key: Object.fromEntries(this.requestCounters.entries()),
      },
      provider_calls: {
        total: this.providerTotal,
        by_key: Object.fromEntries(this.providerCounters.entries()),
        cache_hits: this.providerCacheHits,
        cache_misses: this.providerCacheMisses,
      },
      durations_ms: {
        request_avg: this.requestTotal > 0 ? round(this.requestDurationTotal / this.requestTotal) : 0,
        provider_avg: this.providerTotal > 0 ? round(this.providerDurationTotal / this.providerTotal) : 0,
      },
    };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
