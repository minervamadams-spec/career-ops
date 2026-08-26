"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CostBadge } from "@/components/cost/cost-badge";

type Item = { question: string; answer: string };

export function ApplicationQuestions({ id }: { id: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"idle" | "drafting" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/application-questions?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data.draft?.items) ? data.draft.items : []))
      .catch(() => setState("error"))
      .finally(() => setLoaded(true));
  }, [id]);

  const update = (index: number, key: keyof Item, value: string) => {
    setItems((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
    setState("idle");
  };

  const save = async () => {
    setState("saving");
    try {
      const response = await fetch("/api/application-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, items }),
      });
      if (!response.ok) throw new Error("save failed");
      setState("saved");
      setTimeout(() => setState("idle"), 2_000);
    } catch { setError("Couldn’t save. Try again."); setState("error"); }
  };

  const draft = async () => {
    if (!items.some((item) => item.question.trim())) return;
    if (items.some((item) => item.answer.trim()) && !window.confirm("Rewrite the answers already here? Your saved version remains unchanged until this draft finishes.")) return;
    setState("drafting");
    setError("");
    let cliId = "";
    try { cliId = JSON.parse(localStorage.getItem("career-ops:config") ?? "{}").cliId ?? ""; } catch { /* */ }
    try {
      const response = await fetch("/api/application-questions/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, items, cliId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Drafting failed");
      const drafted = items.map((item, index) => ({ ...item, answer: String(data.answers?.[String(index)] ?? item.answer) }));
      setItems(drafted);
      const saved = await fetch("/api/application-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, items: drafted }) });
      if (!saved.ok) throw new Error("Answers were drafted but couldn’t be saved");
      setState("saved");
      setTimeout(() => setState("idle"), 2_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Drafting failed. Try again.");
      setState("error");
    }
  };

  return (
    <details className="group mt-4 overflow-hidden rounded-xl border border-border bg-surface/30">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-4 py-3 hover:bg-surface-hover">
        <span className="text-sm font-medium">Application questions</span>
        <span className="text-xs text-faint">{items.length ? `${items.length} saved` : "paste questions and draft answers"}</span>
        <ChevronDown className="ml-auto size-4 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-4">
        {!loaded ? <p className="text-xs text-faint">Loading…</p> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/20 bg-brand-soft/35 p-3">
              <Button onClick={draft} disabled={state === "drafting" || !items.some((item) => item.question.trim())}>
                {state === "drafting" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {state === "drafting" ? "Writing in your voice…" : "Draft answers for me"}
              </Button>
              <CostBadge kind="spend" size="xs" />
              <span className="text-xs text-muted">Uses your CV, this job’s report, and your voice rules. You review every answer.</span>
            </div>
            {items.map((item, index) => (
              <div key={index} className="rounded-lg border border-border/70 bg-background/50 p-3">
                <div className="flex items-start gap-2">
                  <label className="flex-1 text-xs font-medium text-muted">
                    Question {index + 1}
                    <textarea value={item.question} onChange={(e) => update(index, "question", e.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-brand/50" />
                  </label>
                  <button onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label={`Remove question ${index + 1}`} className="mt-5 rounded-md p-2 text-faint hover:bg-surface-hover hover:text-red-500"><Trash2 className="size-4" /></button>
                </div>
                <label className="mt-3 block text-xs font-medium text-muted">
                  Your answer
                  <textarea value={item.answer} onChange={(e) => update(index, "answer", e.target.value)} placeholder="Draft or paste your answer here…" rows={5} className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm font-normal leading-6 text-foreground outline-none focus:border-brand/50" />
                </label>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setItems((current) => [...current, { question: "", answer: "" }])}><Plus className="size-3.5" /> Add question</Button>
              <Button size="sm" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save answers"}</Button>
              {state === "error" && <span className="text-xs text-red-500">{error || "Couldn’t save. Try again."}</span>}
              <span className="text-xs text-faint">Saved locally with this job.</span>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
