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

  // 2. Cold path: IndexedDB
  const idbEntry = await idbGet(key);
  if (idbEntry && now - idbEntry.timestamp < ttlMs) {
    // Hydrate hot cache from IDB
    cache.set(key, { data: idbEntry.data, timestamp: idbEntry.timestamp });
    return idbEntry.data as T;
  }

  // 3. Stale-while-revalidate: return stale IDB data immediately, refresh in background
  const hasStaleData = idbEntry && idbEntry.data != null;

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

/** Invalidate a specific cache key or all keys matching a prefix */
export function invalidateCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    cache.clear();
    idbClear();
    notifySubscribers();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(urlPrefix)) cache.delete(key);
  }
  idbDeleteByPrefix(urlPrefix);
  notifySubscribers(urlPrefix);
}
