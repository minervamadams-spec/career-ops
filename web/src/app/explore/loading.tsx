import { Compass } from "lucide-react";
import { instrumentSerif } from "@/lib/fonts";

// Shown the moment a navigation to /explore starts, while the Server Component
// reads live data — the user always lands on a visible shell in one frame, and
// the real UI streams in behind it (bounded by the page's read budget).
export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8" aria-busy="true" aria-label="Loading Explore">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <Compass className="size-6 text-brand" />
          <h1 className={`${instrumentSerif.className} text-3xl text-foreground`}>Explore</h1>
        </div>
      </header>
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-2/3 rounded bg-surface" />
        <div className="rounded-2xl border border-border bg-surface/30 p-5">
          <div className="space-y-3">
            <div className="h-3 w-1/4 rounded bg-surface" />
            <div className="h-9 w-full rounded-lg bg-surface" />
            <div className="h-3 w-1/3 rounded bg-surface" />
            <div className="h-9 w-full rounded-lg bg-surface" />
          </div>
          <div className="mt-5 h-10 w-40 rounded-xl bg-surface" />
        </div>
      </div>
    </div>
  );
}
