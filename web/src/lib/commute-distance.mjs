// Offline commute estimates. Network geocoders make the Today page slow and
// leak every viewed job location. Keep the user's origin in profile.yml and a
// compact coordinate catalog for their active search area instead. Distances
// are approximate road miles (great-circle distance × 1.18), clearly labeled.
const ORIGINS = { "07828": [40.8732, -74.7341] };
const PLACES = {
  "budd lake nj": [40.8732, -74.7341], "mount olive nj": [40.8518, -74.7327],
  "flanders nj": [40.8468, -74.6943], "netcong nj": [40.8987, -74.7066],
  "stanhope nj": [40.9029, -74.7091], "succasunna nj": [40.8684, -74.6404],
  "roxbury nj": [40.8684, -74.6404], "ledgewood nj": [40.8754, -74.6543],
  "kenvil nj": [40.8793, -74.6188], "wharton nj": [40.8932, -74.5818],
  "dover nj": [40.8837, -74.5621], "rockaway nj": [40.9012, -74.5143],
  "mine hill nj": [40.8784, -74.6021], "denville nj": [40.8923, -74.4774],
  "randolph nj": [40.8478, -74.5749], "mount arlington nj": [40.9301, -74.6363],
  "lake hopatcong nj": [40.9487, -74.6171], "hopatcong nj": [40.9329, -74.6593],
  "byram nj": [40.9493, -74.7182], "jefferson township nj": [41.0020, -74.5563],
  "chester nj": [40.7843, -74.6968], "mendham nj": [40.7759, -74.6007],
  "long valley nj": [40.7857, -74.7802], "hackettstown nj": [40.8534, -74.8291],
  "allamuchy nj": [40.9218, -74.8107], "andover nj": [40.9857, -74.7427],
  "sparta nj": [41.0335, -74.6385], "fredon nj": [41.0387, -74.7802],
  "green village nj": [40.7418, -74.4549], "dunellen nj": [40.5893, -74.4718],
  "marlton nj": [39.8912, -74.9218], "morristown nj": [40.7968, -74.4815],
  "newark nj": [40.7357, -74.1724], "jersey city nj": [40.7178, -74.0431],
  "new york ny": [40.7128, -74.0060], "new york city ny": [40.7128, -74.0060],
  "hyattsville md": [38.9559, -76.9455], "austin tx": [30.2672, -97.7431],
  "birmingham al": [33.5186, -86.8104],
};

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
