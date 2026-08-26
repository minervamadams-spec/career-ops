"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Plus, Users } from "lucide-react";

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
    {contacts.length ? <ul className="mt-3 space-y-2">{contacts.map(c => <li key={`${c.name}-${c.company}`} className="text-sm"><span className="font-medium">{c.name}</span>{c.title ? <span className="text-muted"> · {c.title}</span> : null}{c.linkedin ? <a className="ml-2 inline-flex text-brand" href={c.linkedin} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /></a> : null}</li>)}</ul> : <p className="mt-3 text-sm text-muted">No confirmed contact yet.</p>}
    <div className="mt-3 flex flex-wrap gap-2"><a href={search} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-brand">Find candidates on LinkedIn <ExternalLink className="size-3" /></a><button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-brand"><Plus className="size-3" /> Add confirmed</button></div>
    {open && <div className="mt-3 grid gap-2 sm:grid-cols-3"><input aria-label="Contact name" value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="rounded border border-border bg-background px-2 py-1.5 text-sm"/><input aria-label="Contact title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="rounded border border-border bg-background px-2 py-1.5 text-sm"/><input aria-label="LinkedIn profile" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="LinkedIn URL (optional)" className="rounded border border-border bg-background px-2 py-1.5 text-sm"/><button type="button" disabled={!name || saving} onClick={save} className="w-fit rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-50">{saving ? "Saving…" : "Confirm & save"}</button>{error && <p role="alert" className="text-xs text-red-600">{error}</p>}</div>}
  </section>;
}
