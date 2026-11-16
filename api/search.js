/**
 * Mosam Mastana — India-First Location Search (Vercel Serverless Function)
 *
 * FR-01: proxies WeatherAPI /v1/search.json and groups results so matching
 * INDIAN locations always appear before matching global locations.
 * Each result carries a stable id + lat/lon so selection never relies on a
 * possibly ambiguous place name.
 *
 * Endpoint: GET /api/search?q=Rampur
 */

const WEATHERAPI_SEARCH = 'https://api.weatherapi.com/v1/search.json';

function relevanceRank(place, query) {
  const name = (place.name || '').toLowerCase();
  const q = query.toLowerCase();
  if (name === q) return 0;          // exact name match
  if (name.startsWith(q)) return 1;  // prefix match
  if (name.includes(q)) return 2;    // partial match
  return 3;
}

function normalize(place) {
  return {
    id: place.id,
    name: place.name,
    region: place.region || null,
    country: place.country || null,
    lat: place.lat,
    lon: place.lon,
    url: place.url || null,
    // Administrative context string for disambiguation (e.g. "Shimla district, Himachal Pradesh, India")
    context: [place.region, place.country].filter(Boolean).join(', '),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300'); // geocoding results are stable enough to cache briefly

  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CONFIG_ERROR', message: 'Location service is not configured on the server.' });
  }

  const query = (req.query.q || '').toString().trim().slice(0, 100);
  if (query.length < 2) {
    return res.status(200).json({ india: [], global: [] });
  }

  let results;
  try {
    const url = `${WEATHERAPI_SEARCH}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(200).json({ india: [], global: [], error: 'SEARCH_UNAVAILABLE' });
    }
    results = await response.json();
  } catch {
    return res.status(200).json({ india: [], global: [], error: 'SEARCH_UNAVAILABLE' });
  }

  if (!Array.isArray(results)) {
    return res.status(200).json({ india: [], global: [], error: 'SEARCH_UNAVAILABLE' });
  }

  const norm = results.map(normalize);
  const india = norm
    .filter((p) => /india/i.test(p.country || ''))
    .sort((a, b) => relevanceRank(a, query) - relevanceRank(b, query));
  const global = norm
    .filter((p) => !/india/i.test(p.country || ''))
    .sort((a, b) => relevanceRank(a, query) - relevanceRank(b, query));

  // FR-01 rule 9: never fabricate Indian results — groups only contain real matches.
  res.status(200).json({ india, global });
}
