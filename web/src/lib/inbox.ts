// Pure, client-side derivations for the inbox triage view. Every signal here is
// FREE — parsed from data the raw posting already carries (URL host, title text,
// first_seen date). 🔴 None of this ranks or scores relevance; it only labels and
// buckets so the cheap facet filters can narrow the firehose with zero tokens.

import type { AtsSource } from "@/lib/explore";

/** Which ATS a posting lives on, derived from its URL host (0 tokens, no network).
 *  Matches on the registrable domain anchored at a dot boundary (host === base OR
 *  host ends with ".base") — never a bare substring, so "greenhouse.io.evil.com"
 *  or "notlever.co" can't be misread as that ATS. */
export function sourceFromUrl(url: string): AtsSource | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const domainIs = (base: string) => host === base || host.endsWith(`.${base}`);
  if (domainIs("greenhouse.io")) return "greenhouse";
  if (domainIs("lever.co")) return "lever";
  if (domainIs("ashbyhq.com")) return "ashby";
  if (domainIs("myworkdayjobs.com") || domainIs("workday.com")) return "workday";
  if (domainIs("icims.com")) return "icims";
  return null;
}

// Coarse seniority buckets, detected from the title. Ordered senior→junior so the
// facet chips read top-down; a title that matches nothing gets no tag (still shows,
// just untagged). We only ever surface buckets that actually appear in the data.
export type Seniority = "lead" | "staff" | "senior" | "mid" | "junior" | "intern";
export const SENIORITY_ORDER: Seniority[] = ["lead", "staff", "senior", "mid", "junior", "intern"];
export const SENIORITY_LABEL: Record<Seniority, string> = {
  lead: "Lead / Mgr",
  staff: "Staff+",
  senior: "Senior",
  mid: "Mid",
  junior: "Junior",
  intern: "Intern",
};

export function seniorityFromTitle(title: string): Seniority | null {
  const t = ` ${title.toLowerCase()} `;
  if (/\b(head|vp|vice president|director|chief|manager|mgr|lead)\b/.test(t)) return "lead";
  if (/\b(staff|principal|distinguished|fellow|architect)\b/.test(t)) return "staff";
  if (/\b(senior|sr\.?|snr)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry|graduate|associate)\b/.test(t)) return "junior";
  if (/\b(intern|internship|working student|apprentice)\b/.test(t)) return "intern";
  // an untagged IC role sits in the broad middle
  if (/\b(engineer|developer|scientist|designer|analyst|manager|specialist|consultant)\b/.test(t)) return "mid";
  return null;
}

/** Whole days between an ISO date (YYYY-MM-DD) and now; null if unparseable. */
export function daysSince(iso: string | undefined, now: number): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

// Freshness windows mirror the Explore "posted within" segmented control so the two
// surfaces feel like one system. A posting passes a window if its age ≤ the window.
export const FRESHNESS_WINDOWS = [
  { label: "24h", days: 1 },
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
] as const;

// A NEGATIVE classifier by design: postings rarely spell out "USA", but they DO
// spell out a non-US country/region — OR, far more often, just a bare non-US
// city with no country at all ("Berlin", "Warszawa") — when that's what they
// are. Fail OPEN (US) on empty or genuinely ambiguous locations — same "don't
// penalize missing data" rule the core scanner filters use — so this only
// screens out postings CONFIRMED elsewhere, never ones we simply couldn't
// classify. The city list can't be exhaustive; it covers the ATS postings
// this actually sees often enough to matter (major EU/UK/APAC/LatAm hubs).
// Diacritics are stripped before matching (see stripDiacritics), so ONE ASCII
// spelling per city covers its accented form too ("Kraków" → "krakow") — only
// the handful whose ASCII postings use a different English name entirely
// (München/Munich, Köln/Cologne) need a second alternation.
const NON_US_MARKERS =
  /\b(canada|mexico|u\.?k\.?|united kingdom|england|scotland|wales|northern ireland|\bireland\b|germany|france|spain|italy|netherlands|portugal|poland|sweden|norway|denmark|finland|switzerland|austria|belgium|\bindia\b|singapore|philippines|australia|new zealand|\bjapan\b|\bchina\b|hong kong|brazil|argentina|colombia|chile|peru|south africa|nigeria|kenya|egypt|\buae\b|abu dhabi|israel|turkey|greece|romania|hungary|czech|ukraine|russia|vietnam|thailand|indonesia|malaysia|pakistan|bangladesh|sri lanka|nepal|\bemea\b|\bapac\b|\blatam\b|london|manchester|edinburgh|glasgow|dublin|belfast|berlin|munich|munchen|hamburg|frankfurt|cologne|koln|stuttgart|dusseldorf|paris|lyon|marseille|toulouse|madrid|barcelona|valencia|seville|milan|milano|rome|roma|turin|naples|amsterdam|rotterdam|the hague|brussels|antwerp|zurich|geneva|basel|vienna|wien|stockholm|gothenburg|oslo|copenhagen|helsinki|warsaw|warszawa|krakow|wroclaw|poznan|gdansk|prague|praha|budapest|bucharest|athens|lisbon|lisboa|porto|dubai|abu dhabi|riyadh|doha|tel aviv|istanbul|moscow|kyiv|kiev|toronto|vancouver|montreal|ottawa|calgary|mexico city|sao paulo|rio de janeiro|buenos aires|bogota|santiago|lima|johannesburg|cape town|lagos|nairobi|cairo|mumbai|bengaluru|bangalore|delhi|hyderabad|pune|chennai|gurugram|gurgaon|noida|singapore|hong kong|shanghai|beijing|shenzhen|tokyo|osaka|seoul|manila|jakarta|kuala lumpur|bangkok|hanoi|ho chi minh|sydney|melbourne|brisbane|perth|auckland|wellington)\b/i;

/** Strips combining diacritics (café→cafe) plus a few base letters NFKD can't
 *  decompose (ł→l, ø→o, đ→d) so one ASCII city-name spelling matches both
 *  its accented and unaccented forms. */
function stripDiacritics(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[łŁ]/g, "l")
    .replace(/[øØ]/g, "o")
    .replace(/[đĐ]/g, "d");
}

/** Best-effort "is this US-based" check for a free-text posting location. */
export function isUsLocation(location: string | undefined): boolean {
  const l = (location || "").trim();
  if (!l) return true;
  return !NON_US_MARKERS.test(stripDiacritics(l));
}
