"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cachedJson, invalidateClientQuery } from "@/lib/client-query";
import { Bell, CircleHelp, Sparkles, ArrowRight, BriefcaseBusiness } from "lucide-react";
import { instrumentSerif } from "@/lib/fonts";
import { HeroGlow } from "@/components/hero-glow";
import type { Application, InboxJob } from "@/lib/career-ops";
import type { DiscoveredOffer } from "@/lib/explore";
import { DiscoveryCard } from "@/components/explore/discovery-card";
import { useExplore } from "@/components/explore/explore-provider";
import { FollowUpCard, type FollowUp } from "@/components/home/follow-up-card";
import { DecisionCard } from "@/components/home/decision-card";
import { QuickEvaluate } from "@/components/quick-evaluate";

// The retention "Today": a dual-loop action queue (the maintainer's
// "N new matches this week · M follow-ups due"). SUPPLY loop = fresh free-scan
// matches (zero tokens, /api/whats-new); DEMAND loop = follow-ups due
// (/api/followups). Each item one-tap actionable. Home stays a VIEW over the
// canonical files — every action dispatches a real registry action / route.
export function TodayDashboard({
  applications,
  inbox,
  inBetween,
  initialDateLabel,
}: {
  applications: Application[];
  inbox: InboxJob[];
  inBetween: boolean;
  initialDateLabel: string;
}) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [fresh, setFresh] = useState<DiscoveredOffer[]>([]);
  const { passed } = useExplore();
  const router = useRouter();
  // A mount-once useMemo() here went stale if the tab stayed open across
  // midnight — a real report (still said "Thursday" a day later, no reload
  // in between). Recomputed from real wall-clock time on an interval instead
  // of once, so an idle tab self-corrects without needing a manual refresh.
  const [dateLabel, setDateLabel] = useState(initialDateLabel);
  useEffect(() => {
    const refreshDate = () => setDateLabel(new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }));
    const t = setInterval(refreshDate, 60_000);
    return () => clearInterval(t);
  }, []);

  const refetch = useCallback(() => {
    cachedJson<{ entries?: FollowUp[]; metadata?: { overdue?: number } }>("followups", "/api/followups", 30_000)
      .then((d) => {
        setFollowups(Array.isArray(d.entries) ? d.entries : []);
        setOverdue(d.metadata?.overdue ?? d.entries?.length ?? 0);
      })
      .catch(() => {});
    cachedJson<{ offers?: DiscoveredOffer[] }>("whats-new", "/api/whats-new", 60_000)
      .then((d) => setFresh(Array.isArray(d.offers) ? d.offers : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
    // A worker (evaluate/pdf) just wrote a real tracker row — refresh the server
    // snapshot (applications/inbox props) + the client loops so the freshly-scored
    // role appears in "Awaiting your decision" without a manual reload.
    const onDone = () => {
      invalidateClientQuery("followups");
      invalidateClientQuery("whats-new");
      router.refresh();
      refetch();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [refetch, router]);

  // Awaiting decision: scored (Evaluated) but no terminal status yet.
  const awaiting = useMemo(
    () => applications.filter((a) => /^evaluat/i.test(a.status)).slice(0, 6),
    [applications],
  );
  const activeApplications = useMemo(
    () => applications.filter((a) => /^(applied|responded|interview|offer)/i.test(a.status)).slice(0, 8),
    [applications],
  );

  // A passed-on offer stops counting as a "new match needing attention" — same
  // rule as any other terminal decision on this dashboard.
  const visibleFresh = useMemo(() => fresh.filter((o) => !passed.has(o.url)), [fresh, passed]);
  const newThisWeek = visibleFresh.length;
  const allClear = newThisWeek === 0 && overdue === 0 && awaiting.length === 0;
  const inboxUrls = useMemo(() => new Set(inbox.map((j) => j.url)), [inbox]);
  const pipelineMatches = useMemo(() => visibleFresh.filter((o) => inboxUrls.has(o.url)), [visibleFresh, inboxUrls]);
  const unqueuedMatches = useMemo(() => visibleFresh.filter((o) => !inboxUrls.has(o.url)), [visibleFresh, inboxUrls]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 max-sm:pb-24">
      <section className="dot-bg relative overflow-hidden rounded-2xl border border-border bg-surface/40 px-7 py-10 md:px-10 md:py-12">
        <HeroGlow />
        {/* Readability scrim between the animated glow (z-0) and the copy (z-10). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-surface/55 backdrop-blur-[2px] dark:bg-background/45" />
        <div className="relative z-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            <span className="text-faint">//</span> today · <span className="tabular-nums">{dateLabel}</span>
          </p>
          <h1 className={`${instrumentSerif.className} mt-3 text-4xl leading-[1.05] text-landing md:text-5xl`}>
            {allClear ? (
              <>You&apos;re all caught up.</>
            ) : (
              <>
                {newThisWeek > 0 && (
                  <>
                    <span className="text-brand tabular-nums">{newThisWeek}</span> new match{newThisWeek === 1 ? "" : "es"} this week
                  </>
                )}
                {newThisWeek > 0 && overdue > 0 && <span className="text-faint"> · </span>}
                {overdue > 0 && (
                  <>
                    <span className="text-brand tabular-nums">{overdue}</span> follow-up{overdue === 1 ? "" : "s"} due
                  </>
                )}
              </>
            )}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted">
            {allClear ? "I'll keep scanning the market in the background and surface anything that fits." : "Your action queue for today — discovery and follow-ups, in one place."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/explore" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition hover:bg-brand-200 max-sm:min-h-[44px]">
              Find new roles <ArrowRight className="size-4" />
            </Link>
            <Link href="/pipeline" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-brand/40 hover:text-brand max-sm:min-h-[44px]">
              Open pipeline
            </Link>
          </div>
          {inBetween && <QuickEvaluate />}
        </div>
      </section>

      {/* A. Follow-ups due (demand loop) */}
      {followups.length > 0 && (
        <Section icon={Bell} title="Follow-ups due" hint="Keep your applications alive — a nudge beats silence">
          <div className="grid gap-2.5">
            {followups.map((f) => (
              <FollowUpCard key={`${f.num}-${f.company}`} followup={f} onLogged={() => setOverdue((n) => Math.max(0, n - 1))} />
            ))}
          </div>
        </Section>
      )}

      {activeApplications.length > 0 && (
        <Section icon={BriefcaseBusiness} title="Applications in progress" hint="Applied roles and the next stages">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {activeApplications.map((app) => (
              <Link
                key={app.n}
                href={`/pipeline/${app.n}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-3.5 py-3 transition hover:border-brand/30"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{app.company}</span>
                  <span className="block truncate text-xs text-muted">{app.role}</span>
                </span>
                <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{app.status}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* B. Awaiting your decision */}
      {awaiting.length > 0 && (
        <Section icon={CircleHelp} title="Awaiting your decision" hint="Scored — apply or skip">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {awaiting.map((a) => (
              <DecisionCard key={a.n} app={a} />
            ))}
          </div>
        </Section>
      )}

      {pipelineMatches.length > 0 && (
        <Section icon={CircleHelp} title="In pipeline — choose the next step" hint="Evaluate to advance, or dismiss with a reason">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pipelineMatches.slice(0, 6).map((o) => <DiscoveryCard key={o.url} offer={o} inPipeline source="today" />)}
          </div>
        </Section>
      )}

      {/* C. Fresh matches this week (supply loop) */}
      {unqueuedMatches.length > 0 && (
        <Section icon={Sparkles} title="Fresh matches this week" hint="Found by your free scans · 0 tokens">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unqueuedMatches.slice(0, 6).map((o) => (
              <DiscoveryCard key={o.url} offer={o} inPipeline={false} source="today" />
            ))}
          </div>
          {unqueuedMatches.length > 6 && (
            <Link href="/explore" className="mt-3 inline-flex items-center text-sm text-muted transition hover:text-brand max-sm:min-h-[44px]">
              See all {unqueuedMatches.length} →
            </Link>
          )}
        </Section>
      )}

      {allClear && (
        <div className="mt-8 rounded-2xl border border-border bg-surface/30 px-6 py-10 text-center">
          <Sparkles className="mx-auto size-6 text-brand" />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            Nothing needs you right now. Run a <Link href="/explore" className="text-brand hover:underline">free scan</Link> to surface this week&apos;s roles, or check your <Link href="/pipeline" className="text-brand hover:underline">pipeline</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-brand" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">{title}</h2>
        <span className="text-xs text-faint">· {hint}</span>
      </div>
      {children}
    </section>
  );
}
