/**
 * Mosam Mastana — Trip Planner API (Vercel Serverless Function) — FR-09
 *
 * Given a destination and a date range, returns a day-by-day weather outlook:
 *  - dates within the provider's standard forecast horizon (14 days on this plan)
 *    → fetched from /v1/forecast.json, labelled "forecast"
 *  - dates beyond the horizon but 14–300 days ahead → fetched from /v1/future.json,
 *    labelled "extended" (client must display the uncertainty note)
 *  - anything else → labelled "unavailable"; NEVER interpolated or invented.
 *
 * WEATHERAPI_KEY stays server-side (FR-08).
 *
 * Endpoint: GET /api/trip?q=lat,lon&start=YYYY-MM-DD&days=N
 */

const BASE = 'https://api.weatherapi.com/v1';
const STANDARD_HORIZON_DAYS = 14;   // verified against this subscription (2026-11)
const MAX_EXTENDABLE_DATE_OFFSET = 300; // future.json supports 14–300 days ahead
const MAX_FUTURE_CALLS = 10;        // cap extended-outlook API calls per request

function dayKey(dateStr) {
  // WeatherAPI returns dates as YYYY-MM-DD in destination-local terms
  return (dateStr || '').slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

function normalizeDay(fd) {
  if (!fd || !fd.day) return null;
  const cond = fd.day.condition ? fd.day.condition.text : null;
  const condLower = (cond || '').toLowerCase();
  return {
    date: fd.date,
    status: 'forecast',
    label: 'Forecast',
    condition: cond,
    icon: fd.day.condition ? fd.day.condition.icon : null,
    maxTempC: fd.day.maxtemp_c ?? null,
    minTempC: fd.day.mintemp_c ?? null,
    avgTempC: fd.day.avgtemp_c ?? null,
    chanceOfRain: fd.day.daily_chance_of_rain ?? null,
    chanceOfSnow: fd.day.daily_chance_of_snow ?? null,
    totalPrecipMm: fd.day.totalprecip_mm ?? null,
    maxWindKph: fd.day.maxwind_kph ?? null,
    avgHumidity: fd.day.avghumidity ?? null,
    uv: fd.day.uv ?? null,
    thunderIndicator: /thunder|storm/.test(condLower) ? cond : null,
  };
}

function normalizeFutureDay(fd) {
  if (!fd || !fd.day) return null;
  const cond = fd.day.condition ? fd.day.condition.text : null;
  const condLower = (cond || '').toLowerCase();
  return {
    date: fd.date,
    status: 'extended',
    label: 'Extended outlook',
    condition: cond,
    icon: fd.day.condition ? fd.day.condition.icon : null,
    maxTempC: fd.day.maxtemp_c ?? null,
    minTempC: fd.day.mintemp_c ?? null,
    avgTempC: fd.day.avgtemp_c ?? null,
    // future.json does not return rain probability on this plan — keep it
    // explicitly unavailable rather than inferring it (PRD data rule).
    chanceOfRain: fd.day.daily_chance_of_rain ?? null,
    chanceOfSnow: fd.day.daily_chance_of_snow ?? null,
    totalPrecipMm: fd.day.totalprecip_mm ?? null,
    maxWindKph: fd.day.maxwind_kph ?? null,
    avgHumidity: fd.day.avghumidity ?? null,
    uv: fd.day.uv ?? null,
    thunderIndicator: /thunder|storm/.test(condLower) ? cond : null,
  };
}

async function fetchJson(url) {
  const res = await fetch(url);
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, body };
}

function normalizeAlerts(alertsPayload, tz) {
  const list = (alertsPayload && Array.isArray(alertsPayload.alert)) ? alertsPayload.alert : null;
  if (list === null) return { available: false, warnings: [] };
  return {
    available: true,
    warnings: list.slice(0, 5).map((a) => ({
      event: a.event || null,
      headline: a.headline || null,
      severity: a.severity || null,
      areas: a.areas || null,
      source: a.source || 'WeatherAPI.com alert feed',
      effective: a.effective || null,
      expires: a.expires || null,
    })),
  };
}

function utcToLocal(utcString, tz) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: tz, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(utcString));
  } catch { return utcString; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CONFIG_ERROR', message: 'WeatherAPI key is not configured on the server.' });
  }

  const query = (req.query.q || '').toString().trim().slice(0, 120);
  const start = (req.query.start || '').toString().trim();
  const days = Math.min(Math.max(parseInt(req.query.days || '1', 10) || 1, 1), 30);

  if (!query || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Provide ?q=<location>&start=YYYY-MM-DD&days=N (1–30 days).' });
  }

  const end = addDays(start, days - 1);

  // 1. Anchor: fetch the standard forecast window (destination-local dates).
  let anchor;
  try {
    anchor = await fetchJson(`${BASE}/forecast.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&days=${STANDARD_HORIZON_DAYS}&aqi=yes&alerts=yes`);
  } catch {
    return res.status(504).json({ error: 'NETWORK_ERROR', message: 'Could not reach the weather service. Check your connection and try again.' });
  }
  if (!anchor.ok) {
    const code = anchor.body?.error?.code;
    if (code === 1006) return res.status(404).json({ error: 'LOCATION_NOT_FOUND', message: 'Could not find that destination. Try the district or a nearby supported town.' });
    if (code === 2007 || code === 2008 || code === 2009) return res.status(502).json({ error: 'API_LIMIT', message: 'Weather data quota is exhausted. Please try again later.' });
    return res.status(502).json({ error: 'UPSTREAM_ERROR', message: 'Weather service returned an error. Please try again.' });
  }
  const A = anchor.body;
  const tz = A?.location?.tz_id || 'UTC';
  const fcDays = (A?.forecast?.forecastday) || [];
  const forecastByDate = new Map(fcDays.map((d) => [dayKey(d.date), d]));
  const rangeFirst = fcDays.length ? dayKey(fcDays[0].date) : null;
  const rangeLast = fcDays.length ? dayKey(fcDays[fcDays.length - 1].date) : null;

  // 2. Resolve each requested date.
  const out = [];
  let futureCallsLeft = MAX_FUTURE_CALLS;
  const today = rangeFirst; // destination-local "today" per provider

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    if (forecastByDate.has(date)) {
      const n = normalizeDay(forecastByDate.get(date));
      if (n) { out.push(n); continue; }
    }
    // Beyond standard horizon → extended outlook if within future.json's 14–300 day window.
    const offset = today ? daysBetween(today, date) : null;
    if (offset !== null && offset >= STANDARD_HORIZON_DAYS && offset <= MAX_EXTENDABLE_DATE_OFFSET && futureCallsLeft > 0) {
      futureCallsLeft--;
      try {
        const f = await fetchJson(`${BASE}/future.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&dt=${date}`);
        const fd = f.ok ? f.body?.forecast?.forecastday?.[0] : null;
        const n = normalizeFutureDay(fd);
        if (n) { out.push(n); continue; }
      } catch { /* fall through to unavailable */ }
    }
    out.push({ date, status: 'unavailable', label: 'Forecast not available yet' });
  }

  res.status(200).json({
    source: 'WeatherAPI.com',
    location: {
      name: A?.location?.name,
      region: A?.location?.region,
      country: A?.location?.country,
      lat: A?.location?.lat,
      lon: A?.location?.lon,
      tzId: tz,
      localtime: A?.location?.localtime,
    },
    forecastRange: { first: rangeFirst, last: rangeLast, horizonDays: STANDARD_HORIZON_DAYS },
    requestedRange: { start, end, days },
    days: out,
    alerts: normalizeAlerts(A?.alerts, tz) ,
    alertsTz: tz,
    alertsUtcToLocal: (A?.alerts?.alert || []).length ? (A?.alerts?.alert[0]?.expires ? utcToLocal(A.alerts.alert[0].expires, tz) : null) : null,
    fetchedAt: new Date().toISOString(),
  });
}
