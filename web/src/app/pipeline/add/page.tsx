import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AddJobForm } from "@/components/add-job-form";

export default function AddJobPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
        <ArrowLeft className="size-4" /> Pipeline
      </Link>
      <h1 className="font-display mt-4 text-2xl tracking-tight text-landing">Add a job</h1>
      <p className="mt-1 text-sm text-muted">For a posting the daily scan didn&apos;t catch — a referral, something behind a login, or pasted from an email.</p>
      <div className="mt-6">
        <AddJobForm />
      </div>
    </div>
  );
}
