import { ExternalLink } from "lucide-react";
import { humanReviewLinks } from "@/lib/human-review-links";

export function HumanReviewSources({ roles }: { roles: string[] }) {
  return <section className="rounded-2xl border border-dashed border-border bg-surface/25 p-4">
    <p className="text-sm font-medium">Other places to check</p>
    <p className="mt-1 text-xs text-muted">Offerly has not scanned these sources. Each link opens a pre-filled search in a new tab; review a posting, then add it to your Pipeline.</p>
    <div className="mt-3 flex flex-wrap gap-2">{humanReviewLinks(roles).map(link => <a key={link.id} href={link.href} target="_blank" rel="noreferrer" title={link.note} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-brand/40 hover:text-brand">{link.label}<ExternalLink className="size-3" /></a>)}</div>
  </section>;
}
