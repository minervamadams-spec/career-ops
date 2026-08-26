import { careerOpsRoot } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The absolute local checkout path — read-only, used by the setup wizard's
// Review step to generate a copy-paste daily-scan prompt with a real
// "Working directory" the user's own AI CLI can actually cd into.
export async function GET() {
  return Response.json({ path: careerOpsRoot() });
}
