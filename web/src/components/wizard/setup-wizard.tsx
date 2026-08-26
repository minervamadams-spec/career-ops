"use client";

import { useEffect, useState } from "react";
import { instrumentSerif } from "@/lib/fonts";
import { HeroGlow } from "@/components/hero-glow";
import { cn } from "@/lib/cn";
import { WizardCliStep } from "./wizard-cli-step";
import { WizardCvStep } from "./wizard-cv-step";
import { WizardProfileStep, type ProfileStepResult } from "./wizard-profile-step";
import { WizardSourcesStep, type SourcesStepResult } from "./wizard-sources-step";
import { WizardReviewStep } from "./wizard-review-step";

const STEPS = ["AI engine", "CV", "Profile", "Sources", "Done"] as const;

// First-run setup wizard — replaces the old bare CV-upload takeover
// (FirstRunHome) with the full onboarding flow: AI engine -> CV -> profile
// -> job sources -> review. Each step writes its own real file via the
// existing safe-write API routes (no parallel state store); the wizard just
// sequences them and carries what one step's output the next step needs
// (roles/location from Profile into Sources, everything into Review's
// generated daily-scan prompt).
export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [cliReady, setCliReady] = useState(false);
  const [profile, setProfile] = useState<ProfileStepResult | null>(null);
  const [sources, setSources] = useState<SourcesStepResult | null>(null);
  const [checkoutPath, setCheckoutPath] = useState("");

  useEffect(() => {
    fetch("/api/checkout-path")
      .then((r) => r.json())
      .then((d) => setCheckoutPath(d.path || ""))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 md:py-16">
      <div className="mb-6 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1.5">
            <div className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-brand" : "bg-surface-hover")} />
          </div>
        ))}
      </div>
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-faint">
        step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

      <section className="dot-bg relative overflow-hidden rounded-2xl border border-border bg-surface/40 px-7 py-8 md:px-10 md:py-10">
        <HeroGlow />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-surface/55 backdrop-blur-[2px] dark:bg-background/45" />
        <div className="relative z-10">
          {step === 0 && <WizardCliStep onReady={setCliReady} />}
          {step === 1 && <WizardCvStep onSaved={() => setStep(2)} />}
          {step === 2 && <WizardProfileStep onSaved={(p) => { setProfile(p); setStep(3); }} />}
          {step === 3 && profile && (
            <WizardSourcesStep profile={profile} onSaved={(s) => { setSources(s); setStep(4); }} />
          )}
          {step === 4 && profile && sources && (
            <WizardReviewStep profile={profile} sources={sources} checkoutPath={checkoutPath || "~/path/to/this/checkout"} />
          )}
        </div>
      </section>

      {step === 0 && (
        <button
          onClick={() => setStep(1)}
          disabled={!cliReady}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      )}
      {step > 0 && step < 4 && (
        <button onClick={() => setStep((s) => s - 1)} className="mt-5 text-xs text-faint hover:text-muted">
          ← Back
        </button>
      )}
    </div>
  );
}
