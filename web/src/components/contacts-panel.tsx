"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, FileEdit, Loader2, Plus, Users } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

type Contact = { name: string; company: string; type: string; title: string; linkedin: string; tracker: string | null };

export function ContactsPanel({ company, tracker }: { company: string; tracker: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [title, setTitle] = useState(""); const [linkedin, setLinkedin] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = async () => { const r = await fetch(`/api/contacts?company=${encodeURIComponent(company)}`); const d = await r.json(); setContacts(d.contacts || []); };
  useEffect(() => { void load(); }, [company]);
  const save = async () => {
    setSaving(true); setError("");
    const r = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, company, type: "hiring-manager", title, linkedin, tracker, confirmed: true }) });
    setSaving(false);
    if (!r.ok) { setError("Could not save this confirmed contact."); return; }
    setName(""); setTitle(""); setLinkedin(""); setOpen(false); void load();
  };
  const search = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${company} ${title || "hiring manager"}`)}`;
  return <section className="mt-4 rounded-2xl border border-border bg-surface/30 p-4">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Hiring-manager contact</p><p className="text-xs text-muted">Candidates are never saved until you confirm them.</p></div><Users className="size-4 text-brand" /></div>
    {contacts.length
      ? <ul className="mt-3 space-y-3">{contacts.map(c => (
          <li key={`${c.name}-${c.company}`} className="text-sm">
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-medium">{c.name}</span>
              {c.title ? <span className="text-muted"> · {c.title}</span> : null}
              {c.linkedin ? <a className="ml-1 inline-flex text-brand" href={c.linkedin} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /></a> : null}
            </div>
            <OutreachDraft n={tracker} contactName={c.name} contactTitle={c.title} />
          </li>
        ))}</ul>
      : <p className="mt-3 text-sm text-muted">No confirmed contact yet.</p>}
    <div className="mt-3 flex flex-wrap gap-2"><a href={search} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-brand">Find candidates on LinkedIn <ExternalLink className="size-3" /></a><button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-brand"><Plus className="size-3" /> Add confirmed</button></div>
    {open && <div className="mt-3 grid gap-2 sm:grid-cols-3"><input aria-label="Contact name" value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="rounded border border-border bg-background px-2 py-1.5 text-sm"/><input aria-label="Contact title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="rounded border border-border bg-background px-2 py-1.5 text-sm"/><input aria-label="LinkedIn profile" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="LinkedIn URL (optional)" className="rounded border border-border bg-background px-2 py-1.5 text-sm"/><button type="button" disabled={!name || saving} onClick={save} className="w-fit rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-50">{saving ? "Saving…" : "Confirm & save"}</button>{error && <p role="alert" className="text-xs text-red-600">{error}</p>}</div>}
  </section>;
}

// Drafts a ≤300-char LinkedIn-style outreach note for ONE confirmed contact,
// via the same worker pipeline evaluate/pdf already use (kind "outreach").
// Contact discovery is already done (the name/title came from a confirmed
// contact, not a fresh lookup) — this only ever produces a draft; sending it
// is the user's own action, same as GeneratePdfButton never opens an ATS form.
function OutreachDraft({ n, contactName, contactTitle }: { n: string; contactName: string; contactTitle: string }) {
  const { jobs, startJob } = useJobs();
  const [draft, setDraft] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const job = jobs.filter((j) => j.kind === "outreach" && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0];

  useEffect(() => {
    if (job?.status !== "done") return;
    setLoadingDraft(true);
    fetch(`/api/outreach?n=${encodeURIComponent(n)}`)
      .then((r) => r.json())
      .then((d) => setDraft(typeof d.draft === "string" ? d.draft : null))
      .finally(() => setLoadingDraft(false));
    // job.id — a re-run gets a fresh id, so this refetches instead of showing the stale draft.
  }, [job?.status, job?.id, n]);

  const generate = () => {
    setDraft(null);
    startJob({ title: `Outreach · ${contactName}`, subtitle: "draft note", kind: "outreach", input: n, page: `/pipeline/${n}`, contactName, contactTitle });
  };

  const copy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  if (job?.status === "running" || loadingDraft) {
    return (
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="size-3 animate-spin" /> Drafting a note…
      </p>
    );
  }

  if (draft) {
    return (
      <div className="mt-1.5 rounded-lg border border-border bg-surface/50 p-2.5">
        <p className="text-xs text-foreground">{draft}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-[11px] text-faint tabular-nums">{draft.length}/300 · you send this, nothing here does</span>
          <button type="button" onClick={copy} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline">
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={generate} className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-brand">
            Redraft
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={generate}
      className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-brand"
      title="Draft a short outreach note for this contact — you review and send it"
    >
      <FileEdit className="size-3" /> Draft outreach note <CostBadge kind="spend" size="xs" />
    </button>
  );
}
