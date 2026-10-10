import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<unknown>>();

export function dataUrl(name: string): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}data/${name}.json`;
}

export function loadJson<T>(name: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  if (!cache.has(name)) {
    const p = fetchImpl(dataUrl(name))
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${name}.json (${r.status})`);
        return r.json();
      })
      .catch((e: unknown) => {
        cache.delete(name);
        throw e;
      });
    cache.set(name, p);
  }
  return cache.get(name) as Promise<T>;
}

export function clearCache(): void {
  cache.clear();
}

export interface Loaded<T> { data: T | null; error: string | null }

/** Loads one pipeline output file once, and shares it between views. */
export function useData<T>(name: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    loadJson<T>(name)
      .then((data) => live && setState({ data, error: null }))
      .catch((e: unknown) => live && setState({ data: null, error: e instanceof Error ? e.message : 'Load failed' }));
    return () => {
      live = false;
    };
  }, [name]);
  return state;
}
