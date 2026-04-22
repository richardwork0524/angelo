/**
 * Client-side fetch cache with TTL + IndexedDB persistence.
 * Hot path: in-memory Map. Cold path: IndexedDB (survives refresh).
 * Deduplicates concurrent requests. Pub/sub for invalidation events.
 */

// --- Types ---

interface CacheEntry {
  data: unknown;
  timestamp: number;
  promise?: Promise<unknown>;
}

interface IDBEntry {
  key: string;
  data: unknown;
  timestamp: number;
}

// --- In-memory hot cache ---

const cache = new Map<string, CacheEntry>();

// --- Pub/sub for invalidation events ---

type Listener = () => void;
const subscribers = new Map<string, Set<Listener>>();

export function cacheSubscribe(prefix: string, callback: Listener): () => void {
  let set = subscribers.get(prefix);
  if (!set) {
    set = new Set();
    subscribers.set(prefix, set);
  }
  set.add(callback);
  return () => {
    set!.delete(callback);
    if (set!.size === 0) subscribers.delete(prefix);
  };
}

function notifySubscribers(urlPrefix?: string) {
  if (!urlPrefix) {
    subscribers.forEach((set) => set.forEach((fn) => fn()));
    return;
  }
  subscribers.forEach((set, prefix) => {
    if (urlPrefix.includes(prefix) || prefix.includes(urlPrefix)) {
      set.forEach((fn) => fn());
    }
  });
}

// --- IndexedDB cold cache ---

const DB_NAME = 'angelo-cache';
const STORE_NAME = 'responses';
const DB_VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.reject(new Error('No IndexedDB'));
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<IDBEntry | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as IDBEntry | undefined);
      req.onerror = () => resolve(undefined);
    });
  } catch { return undefined; }
}

async function idbSet(key: string, data: unknown, timestamp: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ key, data, timestamp } satisfies IDBEntry);
  } catch { /* swallow — IDB is best-effort */ }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
  } catch { /* swallow */ }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch { /* swallow */ }
}

async function idbDeleteByPrefix(prefix: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if ((cursor.key as string).includes(prefix)) cursor.delete();
      cursor.continue();
    };
  } catch { /* swallow */ }
}

// --- Cleanup stale IDB entries on load ---

async function cleanupStaleEntries(): Promise<void> {
  try {
    const db = await openDB();
    const cutoff = Date.now() - MAX_AGE_MS;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const entry = cursor.value as IDBEntry;
      if (entry.timestamp < cutoff) cursor.delete();
      cursor.continue();
    };
  } catch { /* swallow */ }
}

if (typeof window !== 'undefined') {
  cleanupStaleEntries();
}

// --- Recently-invalidated guard ---
// Tracks prefixes that were just invalidated. Prevents cachedFetch from
// returning stale IDB data before the async IDB delete completes.
const invalidatedPrefixes = new Set<string>();

function markInvalidated(prefix: string) {
  invalidatedPrefixes.add(prefix);
  setTimeout(() => invalidatedPrefixes.delete(prefix), 5000);
}

function isRecentlyInvalidated(key: string): boolean {
  if (invalidatedPrefixes.has('__all__')) return true;
  for (const prefix of invalidatedPrefixes) {
    if (key.includes(prefix) || prefix.includes(key)) return true;
  }
  return false;
}

// --- Public API ---

export async function cachedFetch<T = unknown>(
  url: string,
  ttlMs: number = 30000,
  init?: RequestInit
): Promise<T> {
  const key = `${init?.method || "GET"}:${url}`;
  const now = Date.now();

  // 1. Hot path: in-memory Map
  const memEntry = cache.get(key);
  if (memEntry && !memEntry.promise && now - memEntry.timestamp < ttlMs) {
    return memEntry.data as T;
  }

  // Deduplicate in-flight requests
  if (memEntry?.promise) {
    return memEntry.promise as Promise<T>;
  }

  // 2. Cold path: IndexedDB (skip if recently invalidated — async IDB delete may not be done)
  const recentlyInvalidated = isRecentlyInvalidated(key);
  const idbEntry = recentlyInvalidated ? undefined : await idbGet(key);
  if (idbEntry && now - idbEntry.timestamp < ttlMs) {
    // Hydrate hot cache from IDB
    cache.set(key, { data: idbEntry.data, timestamp: idbEntry.timestamp });
    return idbEntry.data as T;
  }

  // 3. Stale-while-revalidate: return stale IDB data immediately, refresh in background
  // Skip if recently invalidated — stale data would undo the mutation
  const hasStaleData = !recentlyInvalidated && idbEntry && idbEntry.data != null;

  const promise = fetch(url, init)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ts = Date.now();
      cache.set(key, { data, timestamp: ts });
      idbSet(key, data, ts); // fire-and-forget
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  if (hasStaleData) {
    // Return stale data now, revalidate in background
    cache.set(key, { data: idbEntry!.data, timestamp: idbEntry!.timestamp });
    promise.then((freshData) => {
      cache.set(key, { data: freshData, timestamp: Date.now() });
      // Notify subscribers so components can pick up fresh data
      notifySubscribers(url);
    }).catch(() => {});
    return idbEntry!.data as T;
  }

  // No cached data at all — wait for network
  cache.set(key, { data: null, timestamp: now, promise });
  return promise as Promise<T>;
}

/** Directly inject data into cache (used by Realtime to push without fetch) */
export function cacheSet(url: string, data: unknown): void {
  const key = `GET:${url}`;
  const ts = Date.now();
  cache.set(key, { data, timestamp: ts });
  idbSet(key, data, ts);
}

// --- Row-level cache primitives ---

export type UpsertOpts = { listPath?: string; idKey?: string };

/**
 * Walk a dotted path on an object and return the nested value.
 * Returns undefined if any segment is missing.
 */
function walkPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce<unknown>((cur, seg) => {
    if (cur != null && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[seg];
    }
    return undefined;
  }, obj);
}

/**
 * Write a mutated copy of a nested path back onto obj (shallow-clone each level).
 * Returns the new root object.
 */
function setPath(obj: unknown, path: string, value: unknown): unknown {
  if (!path) return value;
  const segments = path.split('.');
  function recurse(cur: unknown, segs: string[]): unknown {
    const [head, ...tail] = segs;
    const parent = (cur != null && typeof cur === 'object' ? cur : {}) as Record<string, unknown>;
    return {
      ...parent,
      [head]: tail.length === 0 ? value : recurse(parent[head], tail),
    };
  }
  return recurse(obj, segments);
}

/**
 * Read current CacheEntry from the in-memory hot cache.
 * Falls through to IDB if not present in memory.
 * Returns null if nothing is cached for this key.
 */
async function readEntry(cacheKey: string): Promise<{ data: unknown; timestamp: number } | null> {
  const memKey = `GET:${cacheKey}`;
  const memEntry = cache.get(memKey);
  if (memEntry && !memEntry.promise) {
    return { data: memEntry.data, timestamp: memEntry.timestamp };
  }
  const idbEntry = await idbGet(memKey);
  if (idbEntry) {
    return { data: idbEntry.data, timestamp: idbEntry.timestamp };
  }
  return null;
}

/** Merge one row into a cached list response.
 *
 * @param cacheKey  URL like '/api/handoffs'
 * @param row       Full row from realtime payload.new (must include idKey field)
 * @param opts.listPath  Dotted path to the array inside the cached response.
 *                       Undefined / empty string = top-level array (response IS the array).
 *                       'handoffs' = response is { handoffs: [...] }.
 * @param opts.idKey     Column used to identify the row (default 'id').
 *
 * If the path doesn't resolve: warns in dev, no-ops in prod.
 * Replaces existing row (same idKey) at the same index; prepends if not found.
 */
export function upsertInCache(
  cacheKey: string,
  row: Record<string, unknown>,
  opts: UpsertOpts = {}
): void {
  const { listPath = '', idKey = 'id' } = opts;

  readEntry(cacheKey).then((entry) => {
    if (!entry) return; // nothing cached yet — no-op

    const list = walkPath(entry.data, listPath);

    if (!Array.isArray(list)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[cache] upsertInCache: "${listPath || '<root>'}" on "${cacheKey}" did not resolve to an array`,
          entry.data
        );
      }
      return;
    }

    const rowId = row[idKey];
    const idx = list.findIndex((item) => {
      return (item as Record<string, unknown>)[idKey] === rowId;
    });

    let newList: unknown[];
    if (idx >= 0) {
      // Replace at same index
      newList = [...list];
      newList[idx] = row;
    } else {
      // Prepend
      newList = [row, ...list];
    }

    const newData = listPath ? setPath(entry.data, listPath, newList) : newList;
    cacheSet(cacheKey, newData);
    notifySubscribers(cacheKey);
  }).catch(() => { /* best-effort */ });
}

/** Remove one row from a cached list response.
 *
 * @param cacheKey  URL like '/api/handoffs'
 * @param rowId     Value of idKey to filter out
 * @param opts.listPath  Same dotted-path semantics as upsertInCache.
 * @param opts.idKey     Column to match against (default 'id').
 *
 * No-ops gracefully if nothing is cached or the path doesn't resolve.
 */
export function removeFromCache(
  cacheKey: string,
  rowId: string | number,
  opts: UpsertOpts = {}
): void {
  const { listPath = '', idKey = 'id' } = opts;

  readEntry(cacheKey).then((entry) => {
    if (!entry) return;

    const list = walkPath(entry.data, listPath);

    if (!Array.isArray(list)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[cache] removeFromCache: "${listPath || '<root>'}" on "${cacheKey}" did not resolve to an array`,
          entry.data
        );
      }
      return;
    }

    const newList = list.filter(
      (item) => (item as Record<string, unknown>)[idKey] !== rowId
    );

    if (newList.length === list.length) return; // nothing removed — no-op, skip re-write + notify

    const newData = listPath ? setPath(entry.data, listPath, newList) : newList;
    cacheSet(cacheKey, newData);
    notifySubscribers(cacheKey);
  }).catch(() => { /* best-effort */ });
}

/**
 * Synchronously read current cached data from the in-memory hot cache only.
 * Returns undefined if not present or still loading (has pending promise).
 * Used by mutateOptimistic to snapshot before optimistic writes.
 */
export function getCachedData(cacheKey: string): unknown | undefined {
  const memKey = `GET:${cacheKey}`;
  const entry = cache.get(memKey);
  if (entry && !entry.promise) return entry.data;
  return undefined;
}

/** Invalidate a specific cache key or all keys matching a prefix */
export function invalidateCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    cache.clear();
    idbClear();
    markInvalidated('__all__');
    notifySubscribers();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(urlPrefix)) cache.delete(key);
  }
  markInvalidated(urlPrefix);
  idbDeleteByPrefix(urlPrefix);
  notifySubscribers(urlPrefix);
}
