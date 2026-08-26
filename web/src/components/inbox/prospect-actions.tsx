"use client";

import { Coins, ExternalLink, Mail } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";

export function ProspectActions({ url, company, role, email }: { url: string; company: string; role: string; email?: string }) {
  const { startJob } = useJobs();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => startJob({ title: `Evaluate · ${company}`, subtitle: role, kind: "evaluate", input: url, page: "/pipeline" })}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-200"
      >
        Full evaluation · 2–5 min <Coins className="size-4" />
      </button>
      {email && (
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(`Application — ${role}`)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-brand/40 hover:text-brand"
        >
          Prepare email application <Mail className="size-4" />
        </a>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:border-brand/40 hover:text-brand">
        Open source <ExternalLink className="size-4" />
      </a>
    </div>
  );
}
