"use client";

type Entry = { value?: unknown; expiresAt: number; promise?: Promise<unknown> };

const cache = new Map<string, Entry>();

/** Deduplicate concurrent client reads and reuse fresh results across route mounts. */
export function cachedJson<T>(key: string, url: string, ttlMs = 60_000): Promise<T> {
  const now = Date.now();
  const current = cache.get(key);
  if (current?.value !== undefined && current.expiresAt > now) return Promise.resolve(current.value as T);
  if (current?.promise) return current.promise as Promise<T>;

  const promise = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      const value = (await response.json()) as T;
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, { expiresAt: 0, promise });
  return promise;
}

export function invalidateClientQuery(key: string): void {
  cache.delete(key);
}
