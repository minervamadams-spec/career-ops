"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CoMark } from "@/components/co-mark";
import { AssistantConsole } from "@/components/assistant-console";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { JobsProvider } from "@/components/jobs/job-store";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { FirstScoreView } from "@/components/explore/first-score-view";
import { BetaBanner } from "@/components/beta/beta-banner";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { UsageMeter } from "@/components/usage-meter";
import { instrumentSerif } from "@/lib/fonts";
import { NAV_ITEMS, isActivePath } from "@/lib/nav-items";
import { ActivityRecorder } from "@/components/activity-recorder";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Dev-only self-defense: this machine runs several local-first products
  // (Firefly, ProSe LP, …) on the same localhost port, and their PWAs register
  // service workers scoped to the whole origin. A stale foreign SW keeps
  // intercepting this app's fetches — including RSC navigation requests — and
  // wedges the client router into a silent, indefinite hang. This app registers
  // no SW of its own, so in dev any registration here is foreign by definition:
  // unregister, then reload AT MOST ONCE per tab session if one was actively
  // controlling the page. Two layers enforce "once": a ref (React Strict Mode
  // double-invokes effects in dev) and a sessionStorage flag (survives the
  // guard's own reload, so it can never reload-loop). The effect runs at mount
  // — before any user-driven route transition can be pending.
  const swGuardRan = useRef(false);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !("serviceWorker" in navigator)) return;
    if (swGuardRan.current) return; // Strict Mode double-fire
    swGuardRan.current = true;
    const FLAG = "offerly:sw-purged";
    try {
      if (sessionStorage.getItem(FLAG)) return; // already purged this tab session
    } catch {
      /* storage unavailable — probe anyway, the unregister is still safe */
    }
    void navigator.serviceWorker.getRegistrations().then(async (regs) => {
      if (regs.length === 0) return;
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {
        /* ignore */
      }
      const wasControlled = !!navigator.serviceWorker.controller;
      await Promise.all(regs.map((r) => r.unregister()));
      console.warn(`[offerly] removed ${regs.length} foreign service worker(s) left by another app on this origin — one-time reload to escape its control`);
      if (wasControlled) window.location.reload();
    });
  }, []);
  return (
    <JobsProvider>
      <ActivityRecorder />
      <PipelineProvider>
      <ApplyProvider>
      <ExploreProvider>
      <MobileNav />
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface/30 p-4 md:flex">
          <Link href="/" className="mb-8 flex items-center gap-2.5 px-1">
            <CoMark size={32} />
            <span className={`${instrumentSerif.className} relative -top-px text-2xl font-normal tracking-tight text-landing`}>
              Offerly
            </span>
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon, chip }) => {
              const active = isActivePath(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-soft text-brand-text"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                  {chip && (
                    <span className="ml-auto rounded-full border border-brand/30 bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-text">
                      {chip}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <WorkerPills />

          <div className="mt-auto space-y-3 pt-4">
            <UsageMeter />
            <div className="flex items-center justify-between px-1">
              <span className={`${instrumentSerif.className} text-sm text-faint`}>local-first · v0</span>
              <ThemeToggle />
            </div>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden">{children}</main>
        <AssistantConsole />
        <FirstScoreView />
        <BetaBanner />
      </div>
      </ExploreProvider>
      </ApplyProvider>
      </PipelineProvider>
    </JobsProvider>
  );
}
