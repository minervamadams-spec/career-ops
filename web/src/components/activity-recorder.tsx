"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type EventKind = "navigation" | "click" | "api" | "error";

function record(kind: EventKind, path: string, label?: string, status?: number) {
  const body = JSON.stringify({ kind, path, label, status });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/activity", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
}

/** Local-only, content-minimizing telemetry requested for a 72-hour diagnosis window. */
export function ActivityRecorder() {
  const pathname = usePathname();

  useEffect(() => record("navigation", pathname), [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button,a,[role='button']") : null;
      if (!target) return;
      const label = target.getAttribute("aria-label") || target.textContent || target.getAttribute("title") || target.tagName.toLowerCase();
      record("click", location.pathname, label);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
