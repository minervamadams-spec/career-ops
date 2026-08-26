import { ExplorerView } from "@/components/explore/explorer-view";
import { seedExploreFilters } from "@/lib/core/portals";
import { readInboxAsync, readApplicationsAsync, careerOpsRootExistsAsync, type InboxJob, type Application } from "@/lib/career-ops";
import { DEFAULT_FILTERS } from "@/lib/explore";

// Read live data at request time so a bare checkout (or `next build` with no
// CAREER_OPS_ROOT) never fails — discovery seeds are best-effort.
export const dynamic = "force-dynamic";

// Hard ceiling on request-time data reads. Local reads land in ~1ms, so this
// only bites when the data root is genuinely sick (network mount, sleeping
// external drive, first-touch AV scan) — then the page renders with safe
// defaults in bounded time instead of stalling the RSC stream indefinitely.
const READ_BUDGET_MS = 4_000;

async function withBudget<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), READ_BUDGET_MS)),
    ]);
  } catch {
    /* stale/misconfigured CAREER_OPS_ROOT or corrupted data → safe default */
    return fallback;
  }
}

export default async function ExplorePage() {
  let seed: { filters: typeof DEFAULT_FILTERS; seededFrom: string[] } = { filters: DEFAULT_FILTERS, seededFrom: [] };
  try {
    seed = seedExploreFilters();
  } catch {
    /* bare checkout → defaults */
  }
  const [rootExists, inboxSnapshot, appsSnapshot] = await Promise.all([
    withBudget(careerOpsRootExistsAsync(), false),
    withBudget(readInboxAsync(), [] as InboxJob[]),
    withBudget(readApplicationsAsync(), [] as Application[]),
  ]);
  return (
    <ExplorerView seed={seed} inboxSnapshot={inboxSnapshot} appsSnapshot={appsSnapshot} rootExists={rootExists} />
  );
}
