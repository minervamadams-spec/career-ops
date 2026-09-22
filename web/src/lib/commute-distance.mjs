import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Offline commute estimates. Network geocoders make the Today page slow and
// leak every viewed job location. Keep the user's origin in profile.yml and a
// bundled coordinate catalog instead. Distances are approximate road miles
// (great-circle distance × 1.18), clearly labeled.
const ORIGINS = { "07828": [40.8732, -74.7341] };

// Base catalog: all ~700 NJ Census-gazetteer "Place" entries (2021 Gazetteer
// files, public domain — see nj-places.json's header comment), covering
// incorporated cities/boroughs/towns/villages and CDPs statewide. Added
// 2026-09-22 after Trenton and Cedar Knolls silently passed the commute-radius
// gate (estimateCommuteMiles returned null — unresolved, not "far" — for any
// town missing from what was then a 35-entry hand list, so the gate never
// fired) — Minerva: "build the zip coordinate which I thought was done."
const NJ_PLACES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "nj-places.json"), "utf-8"),
);

// Gap-fill layer, takes precedence over NJ_PLACES. Two reasons an entry lives
// here instead of the bundled file:
//   1. NJ townships (Denville, Roxbury, Mine Hill, Jefferson, ...) are absent
//      from the Census "Places" gazetteer entirely — in NJ, townships are
//      also county subdivisions and that geography type isn't in the file
//      this catalog was built from. Hand-verified so Minerva's actual local
//      radius (Morris/Sussex/Warren county townships) stays covered.
//   2. Non-NJ locations her search history has touched (NYC, and a handful of
//      one-off out-of-state postings) — the bundled catalog is NJ-only by
//      design (her active search area), so these stay a short manual list.
const OVERRIDES = {
  "denville nj": [40.8923, -74.4774], "randolph nj": [40.8478, -74.5749],
  "roxbury nj": [40.8684, -74.6404], "mine hill nj": [40.8784, -74.6021],
  "jefferson township nj": [41.0020, -74.5563], "byram nj": [40.9493, -74.7182],
  "mount arlington nj": [40.9301, -74.6363], "lake hopatcong nj": [40.9487, -74.6171],
  "green village nj": [40.7418, -74.4549],
  "new york ny": [40.7128, -74.0060], "new york city ny": [40.7128, -74.0060],
  "hyattsville md": [38.9559, -76.9455], "austin tx": [30.2672, -97.7431],
  "birmingham al": [33.5186, -86.8104],
};

const PLACES = { ...NJ_PLACES, ...OVERRIDES };

const normalize = (s) => String(s || "").toLowerCase().replace(/\b(united states|usa|us)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const rad = (n) => n * Math.PI / 180;
function airMiles(a, b) {
  const dLat = rad(b[0] - a[0]); const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function estimateCommuteMiles(location, originZip) {
  if (/remote|hybrid/i.test(String(location || ""))) return null;
  const origin = ORIGINS[String(originZip || "")];
  if (!origin) return null;
  const text = normalize(location);
  const key = Object.keys(PLACES).find((place) => text === place || text.startsWith(place + " ") || text.includes(" " + place));
  if (!key) return null;
  return Math.max(0, Math.round(airMiles(origin, PLACES[key]) * 1.18));
}
