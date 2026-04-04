/**
 * Lightweight client-side fetch cache with TTL.
 * Deduplicates concurrent requests to the same URL.
 * Usage: const data = await cachedFetch('/api/projects', 30000);
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
  promise?: Promise<unknown>;
}

const cache = new Map<string, CacheEntry>();

export async function cachedFetch<T = unknown>(
  url: string,
  ttlMs: number = 30000,
  init?: RequestInit
): Promise<T> {
  const key = `${init?.method || "GET"}:${url}`;
  const now = Date.now();
  const entry = cache.get(key);

  // Return cached data if still fresh
  if (entry && !entry.promise && now - entry.timestamp < ttlMs) {
    return entry.data as T;
  }

  // Deduplicate: if a request is already in-flight, wait for it
  if (entry?.promise) {
    return entry.promise as Promise<T>;
  }

  // Start new request
  const promise = fetch(url, init)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, { data: null, timestamp: now, promise });
  return promise as Promise<T>;
}

/** Invalidate a specific cache key or all keys matching a prefix */
export function invalidateCache(urlPrefix?: string) {
  if (!urlPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(urlPrefix)) cache.delete(key);
  }
}
