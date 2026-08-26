"use client";

import { CvIngest } from "@/components/cv/cv-ingest";

export function WizardCvStep({ onSaved }: { onSaved: () => void }) {
  return (
    <div>
      <h2 className="font-display text-xl text-landing">Drop your CV</h2>
      <p className="mt-1.5 text-sm text-muted">
        Parsed once on your own AI, right on your machine. This becomes your canonical <code>cv.md</code> — every
        tailored resume and fit-check reads from it.
      </p>
      <div className="mt-5">
        <CvIngest onSaved={onSaved} />
      </div>
    </div>
  );
}
