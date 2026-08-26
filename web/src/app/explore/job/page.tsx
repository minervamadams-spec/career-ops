import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, CalendarDays, Database } from "lucide-react";
import { instrumentSerif } from "@/lib/fonts";
import { DiscoveryCard } from "@/components/explore/discovery-card";
import type { DiscoveredOffer } from "@/lib/explore";

export const dynamic = "force-dynamic";
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function DiscoveredJobPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const offer: DiscoveredOffer = {
    url: one(p.url), company: one(p.company), title: one(p.title), location: one(p.location),
    ats: one(p.ats) || "other", postedAt: one(p.posted), source: "detail", why: one(p.why) || undefined, note: one(p.note) || undefined,
    compensation: one(p.compensation) || undefined,
    commuteMiles: Number.isFinite(Number(one(p.commute))) ? Number(one(p.commute)) : undefined,
    commuteApprox: one(p.commuteApprox) === "1",
  };
  if (!/^https?:\/\//i.test(offer.url) || !offer.company || !offer.title) {
    return <div className="mx-auto max-w-3xl px-6 py-10"><Link href="/explore" className="text-sm text-brand">← Back to Explore</Link><p className="mt-8 text-muted">This role link is incomplete.</p></div>;
  }
  return (
    <div className="mx-auto max-w-4xl px-6 py-9 max-sm:pb-24">
      <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-brand"><ArrowLeft className="size-4" /> Explore</Link>
      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_300px]">
        <main className="rounded-2xl border border-border bg-surface/40 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">Role details</p>
          <h1 className={`${instrumentSerif.className} mt-2 text-3xl leading-tight text-foreground`}>{offer.title}</h1>
          <p className="mt-1 text-base text-muted">{offer.company}</p>
          <div className="mt-5 grid gap-2 text-sm text-muted sm:grid-cols-3">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-brand" /> {offer.location || "Location not listed"}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-brand" /> {offer.postedAt || "Date not listed"}</span>
            <span className="inline-flex items-center gap-1.5"><Database className="size-4 text-brand" /> {offer.ats}</span>
          </div>
          {offer.compensation && <p className="mt-4 text-sm font-medium text-foreground">Compensation: {offer.compensation}</p>}
          <section className="mt-7 border-t border-border pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">What we know</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{offer.why || offer.note || `${offer.title} role at ${offer.company}. Evaluate it for a source-grounded fit score, requirements analysis, and full report.`}</p>
            <p className="mt-3 text-xs leading-relaxed text-faint">Offerly shows only facts captured by the scanner here. The original posting remains available separately for the complete description.</p>
            <a href={offer.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-brand/40 hover:text-brand">Open original posting <ExternalLink className="size-4" /></a>
          </section>
        </main>
        <aside><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Next step</p><DiscoveryCard offer={offer} inPipeline={false} /></aside>
      </div>
    </div>
  );
}
