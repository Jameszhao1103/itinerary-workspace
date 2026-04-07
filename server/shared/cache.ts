export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = Math.max(0, ttlMs);
  }

  get(key: string, now = Date.now()): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }

    return structuredClone(entry.value);
  }

  set(key: string, value: T, now = Date.now()): void {
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: now + this.ttlMs,
    });
  }

  snapshot(): { size: number; ttl_ms: number } {
    return {
      size: this.entries.size,
      ttl_ms: this.ttlMs,
    };
  }
}

export function stableKey(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}
