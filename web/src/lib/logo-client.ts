"use client";

import { useEffect, useState } from "react";

type LogoRequest = { kind: "domain" | "company"; value: string };
type LogoResult = { logos?: Record<string, string | null> };

const resolved = new Map<string, string | null>();
const listeners = new Map<string, Set<(src: string | null) => void>>();
const queued = new Map<string, LogoRequest>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function logoKey(request: LogoRequest): string {
  return `${request.kind}:${request.value.trim().toLowerCase()}`;
}

async function flush(): Promise<void> {
  timer = null;
  const requests = [...queued.values()];
  queued.clear();
  if (!requests.length) return;
  try {
    const response = await fetch("/api/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });
    if (!response.ok) throw new Error(`logo batch returned ${response.status}`);
    const body = (await response.json()) as LogoResult;
    for (const request of requests) publish(logoKey(request), body.logos?.[logoKey(request)] ?? null);
  } catch {
    for (const request of requests) publish(logoKey(request), null);
  }
}

function publish(key: string, src: string | null): void {
  resolved.set(key, src);
  listeners.get(key)?.forEach((listener) => listener(src));
}

export function useBatchedLogo(request: LogoRequest | null): { src: string | null; pending: boolean } {
  const key = request ? logoKey(request) : "";
  const [src, setSrc] = useState<string | null>(() => (key && resolved.has(key) ? resolved.get(key)! : null));
  const [pending, setPending] = useState(() => Boolean(key && !resolved.has(key)));

  useEffect(() => {
    if (!request || !key) {
      setPending(false);
      return;
    }
    if (resolved.has(key)) {
      setSrc(resolved.get(key)!);
      setPending(false);
      return;
    }
    const listener = (next: string | null) => {
      setSrc(next);
      setPending(false);
    };
    const group = listeners.get(key) ?? new Set();
    group.add(listener);
    listeners.set(key, group);
    queued.set(key, request);
    if (!timer) timer = setTimeout(() => void flush(), 20);
    return () => {
      group.delete(listener);
      if (!group.size) listeners.delete(key);
    };
  }, [key, request?.kind, request?.value]);

  return { src, pending };
}
