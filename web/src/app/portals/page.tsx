import { Radar } from "lucide-react";
import { PortalsView } from "@/components/portals-view";

export const dynamic = "force-dynamic";

export default function PortalsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center gap-3">
        <Radar className="size-6 text-brand" />
        <h1 className="font-display text-2xl tracking-tight text-landing">Portals</h1>
      </div>
      <p className="mt-1.5 max-w-xl text-sm text-muted">
        The companies Offerly watches for new roles. Run a health check to catch company boards that have quietly
        broken — a broken link means that company silently disappears from every future scan.
      </p>
      <p className="mt-1.5 text-xs text-faint">
        Backed by <code className="text-muted">portals.yml</code> — edit it directly or ask the assistant.
      </p>
      <div className="mt-4 rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm text-muted">
        <p><span className="font-medium text-foreground">No-phone remote sources are active.</span> The 25 companies with supported ATS boards are checked in normal scans. The remaining 445 custom career pages rotate through the scheduled scan eight at a time.</p>
        <p className="mt-1.5 text-xs text-faint">When a live role passes your title, US-location, and fit filters, it is added to Pipeline → Inbox as a prospect. “Portal health” checks whether sources are reachable; it does not display their individual openings.</p>
      </div>
      <div className="mt-6">
        <PortalsView />
      </div>
    </div>
  );
}
