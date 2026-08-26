import Link from "next/link";
import { ArrowLeft, MapPin, WalletCards } from "lucide-react";
import { readInbox, readInboxIntake } from "@/lib/career-ops";
import { ProspectActions } from "@/components/inbox/prospect-actions";

export const dynamic = "force-dynamic";

export default async function InboxProspectPage({ searchParams }: { searchParams: Promise<{ url?: string | string[] }> }) {
  const raw = (await searchParams).url;
  const url = Array.isArray(raw) ? raw[0] : raw;
  const job = url ? readInbox().find((candidate) => candidate.url === url) ?? null : null;
  if (!job) return <div className="mx-auto max-w-3xl px-6 py-10"><Link href="/pipeline" className="text-sm text-brand">← Back to Pipeline</Link><p className="mt-8 text-muted">This prospect is no longer in the inbox.</p></div>;
  const intake = readInboxIntake(job);
  const email = intake?.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  const notes = intake?.replace(/^#.*$/gm, "").replace(/^Added:.*$/gm, "").replace(/^Platform:.*$/gm, "").replace(/^Work arrangement:.*$/gm, "").replace(/^Salary:.*$/gm, "").replace(/^## Notes\s*/m, "").trim();

  return (
    <div className="mx-auto max-w-3xl px-6 py-9 max-sm:pb-24">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand"><ArrowLeft className="size-4" /> Pipeline</Link>
      <main className="mt-5 rounded-2xl border border-border bg-surface/40 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">Inbox prospect</p>
        <h1 className="mt-2 font-display text-3xl text-landing">{job.role}</h1>
        <p className="mt-1 text-base text-muted">{job.company}</p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-brand" />{job.location || "Location not listed"}</span>
          <span className="inline-flex items-center gap-1.5"><WalletCards className="size-4 text-brand" />{job.compensation || "Compensation not listed"}</span>
        </div>
        {notes && <section className="mt-6 border-t border-border pt-5"><h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Captured notes</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{notes}</p></section>}
        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-sm text-muted">Evaluate to create the scored tracker record and tailored-CV workflow. Email-only opportunities can also be prepared directly; you still review and send them yourself.</p>
          <ProspectActions url={job.url} company={job.company} role={job.role} email={email} />
        </div>
      </main>
    </div>
  );
}
