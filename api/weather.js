/**
 * Mosam Mastana — Weather + AQI + Forecast + Alerts API (Vercel Serverless Function)
 *
 * v1.2: single upstream call to WeatherAPI /v1/forecast.json
 * (returns current weather + hourly/daily forecast + air quality + official alerts)
 * so the dashboard renders within the performance target with one round-trip.
 *
 * The WEATHERAPI_KEY stays server-side (FR-07). Never exposed to the browser.
 *
 * Endpoint: GET /api/weather?q=Delhi,India   (name or "lat,lon" — coordinates are
 * the stable place identifier recommended by FR-01)
 */

const WEATHERAPI_BASE = 'https://api.weatherapi.com/v1/forecast.json';

/* ---------------- Indian National AQI (CPCB) ---------------- */

// CPCB sub-index breakpoints (PM2.5: 24h avg, PM10: 24h avg)
const CPCB_BREAKPOINTS = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },        // Good
  { cLow: 30, cHigh: 60, iLow: 51, iHigh: 100 },     // Satisfactory
  { cLow: 60, cHigh: 90, iLow: 101, iHigh: 200 },    // Moderate
  { cLow: 90, cHigh: 120, iLow: 201, iHigh: 300 },   // Poor
  { cLow: 120, cHigh: 250, iLow: 301, iHigh: 400 },  // Very Poor
  { cLow: 250, cHigh: 380, iLow: 401, iHigh: 500 },  // Severe
];

const CPCB_PM10_BREAKPOINTS = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 250, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 350, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 430, cHigh: 510, iLow: 401, iHigh: 500 },
];

function subIndex(concentration, breakpoints) {
  if (concentration === null || concentration === undefined || concentration < 0) return null;
  const clamped = Math.min(concentration, breakpoints[breakpoints.length - 1].cHigh);
  for (const b of breakpoints) {
    if (clamped <= b.cHigh) {
      return Math.round(((b.iHigh - b.iLow) / (b.cHigh - b.cLow)) * (clamped - b.cLow) + b.iLow);
    }
  }
  return null;
}

function categorizeIndian(aqi) {
  if (aqi === null) return null;
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

/** Indian AQI = max of PM2.5 / PM10 sub-indices (CPCB method). Never invents a value. */
function indianAqi(airQuality) {
  if (!airQuality) return null;
  const pm25 = subIndex(airQuality.pm2_5, CPCB_BREAKPOINTS);
  const pm10 = subIndex(airQuality.pm10, CPCB_PM10_BREAKPOINTS);
  const candidates = [pm25, pm10].filter((v) => v !== null);
  if (candidates.length === 0) return null;
  const aqi = Math.max(...candidates);
  return {
    aqi,
    category: categorizeIndian(aqi),
    dominantPollutant: pm25 !== null && (pm10 === null || pm25 >= pm10) ? 'PM2.5' : 'PM10',
  };
}

// US EPA AQI scale (1–6 categorical index) — used ONLY for non-Indian locations,
// always clearly labelled. Never presented as Indian AQI.
const US_EPA_CATEGORIES = {
  1: 'Good',
  2: 'Moderate',
  3: 'Unhealthy for Sensitive Groups',
  4: 'Unhealthy',
  5: 'Very Unhealthy',
  6: 'Hazardous',
};

/* ---------------- Alerts normalization ---------------- */

function normalizeAlerts(alertsPayload, tz) {
  // alertsPayload may be undefined (missing field), null or an object with .alert[]
  const list = (alertsPayload && Array.isArray(alertsPayload.alert)) ? alertsPayload.alert : null;
  if (list === null) {
    return { available: false, reason: 'SOURCE_UNAVAILABLE', warnings: [] };
  }
  return {
    available: true,
    reason: null,
    warnings: list.slice(0, 5).map((a) => ({
      event: a.event || null,
      headline: a.headline || null,
      severity: a.severity || null,
      urgency: a.urgency || null,
      areas: a.areas || null,
      source: a.source || 'WeatherAPI.com alert feed',
      effective: a.effective || null,
      expires: a.expires || null,
      effectiveLocal: a.effective ? utcToLocal(a.effective, tz) : null,
      expiresLocal: a.expires ? utcToLocal(a.expires, tz) : null,
      instruction: a.instruction || null,
      note: a.note ? String(a.note).slice(0, 200) : null,
    })),
  };
}

function utcToLocal(utcString, tz) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: tz, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(utcString));
  } catch {
    return utcString;
  }
}

/* ---------------- Forecast normalization ---------------- */

function normalizeForecast(forecast, tz) {
  if (!forecast || !Array.isArray(forecast.forecastday)) {
    return { available: false, reason: 'FORECAST_UNAVAILABLE', hourly: [], daily: [] };
  }
  const hourly = [];
  for (const day of forecast.forecastday) {
    if (!Array.isArray(day.hour)) continue;
    for (const h of day.hour) {
      hourly.push({
        time: h.time || null, // provider local time string, e.g. "2026-11-16 09:00"
        chanceOfRain: (h.chance_of_rain ?? null),
        chanceOfSnow: (h.chance_of_snow ?? null),
        precipMm: (h.precip_mm ?? null),
        condition: h.condition ? h.condition.text : null,
        icon: h.condition ? h.condition.icon : null,
        isDay: (h.is_day ?? null),
        willItRain: (h.will_it_rain ?? null),
      });
    }
  }
  const daily = forecast.forecastday.map((d) => ({
    date: d.date || null,
    maxTempC: d.day && d.day.maxtemp_c !== undefined ? d.day.maxtemp_c : null,
    minTempC: d.day && d.day.mintemp_c !== undefined ? d.day.mintemp_c : null,
    chanceOfRain: d.day && d.day.daily_chance_of_rain !== undefined ? d.day.daily_chance_of_rain : null,
    chanceOfSnow: d.day && d.day.daily_chance_of_snow !== undefined ? d.day.daily_chance_of_snow : null,
    totalPrecipMm: d.day && d.day.totalprecip_mm !== undefined ? d.day.totalprecip_mm : null,
    condition: d.day && d.day.condition ? d.day.condition.text : null,
    icon: d.day && d.day.condition ? d.day.condition.icon : null,
  }));
  return { available: true, reason: null, hourly, daily };
}

/* ---------------- Handler ---------------- */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CONFIG_ERROR', message: 'WeatherAPI key is not configured on the server.' });
  }

  const query = (req.query.q || 'Delhi,India').toString().trim().slice(0, 120);
  if (!query) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please provide a location (?q=CityName or ?q=lat,lon).' });
  }

  let upstream;
  try {
    const url = `${WEATHERAPI_BASE}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&days=7&aqi=yes&alerts=yes`;
    const response = await fetch(url);
    upstream = response;
    if (!response.ok) {
      let body = {};
      try { body = await response.json(); } catch { /* non-JSON */ }
      const code = body?.error?.code;
      if (code === 1006) {
        return res.status(404).json({ error: 'LOCATION_NOT_FOUND', message: `Could not find a location matching that search. Try the district or a nearby supported town.` });
      }
      if (code === 2007 || code === 2008 || code === 2009) {
        return res.status(502).json({ error: 'API_LIMIT', message: 'Weather data quota is exhausted. Please try again later.' });
      }
      return res.status(502).json({ error: 'UPSTREAM_ERROR', message: 'Weather service returned an error. Please try again.' });
    }
  } catch {
    return res.status(504).json({ error: 'NETWORK_ERROR', message: 'Could not reach the weather service. Check your connection and try again.' });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return res.status(502).json({ error: 'UPSTREAM_ERROR', message: 'Weather service returned invalid data. Please try again.' });
  }

  const tz = data?.location?.tz_id || 'UTC';
  const isIndia = /india/i.test(data?.location?.country || '');
  const air = data?.current?.air_quality || null;

  let aqi;
  if (isIndia) {
    const indian = indianAqi(air);
    aqi = {
      available: indian !== null,
      standard: indian !== null ? 'CPCB (India National AQI)' : null,
      ...indian,
      pm25Concentration: air ? air.pm2_5 : null,
      pm10Concentration: air ? air.pm10 : null,
      isIndia,
    };
  } else {
    // Non-India: clearly labelled US EPA categorical index only (never "Indian AQI").
    const idx = air ? air['us-epa-index'] : null;
    aqi = {
      available: idx !== null && idx !== undefined,
      standard: (idx !== null && idx !== undefined) ? 'US EPA AQI' : null,
      aqi: idx ?? null,
      category: US_EPA_CATEGORIES[idx] || null,
      dominantPollutant: null,
      pm25Concentration: air ? air.pm2_5 : null,
      pm10Concentration: air ? air.pm10 : null,
      isIndia: false,
    };
  }

  const current = data?.current || {};
  res.status(200).json({
    source: 'WeatherAPI.com',
    location: {
      name: data?.location?.name,
      region: data?.location?.region,
      country: data?.location?.country,
      lat: data?.location?.lat,
      lon: data?.location?.lon,
      tzId: tz,
      localtime: data?.location?.localtime,
    },
    weather: {
      tempC: current.temp_c ?? null,
      feelsLikeC: current.feelslike_c ?? null,
      windChillC: current.windchill_c ?? null,
      condition: current.condition ? current.condition.text : null,
      icon: current.condition ? current.condition.icon : null,
      humidity: current.humidity ?? null,
      windKph: current.wind_kph ?? null,
      windDir: current.wind_dir ?? null,
      windGustKph: current.gust_kph ?? null,
      uv: current.uv ?? null,
      visibilityKm: current.vis_km ?? null,
      pressureMb: current.pressure_mb ?? null,
      lastUpdated: current.last_updated ?? null,
    },
    aqi,
    forecast: normalizeForecast(data?.forecast, tz),
    alerts: normalizeAlerts(data?.alerts, tz),
    fetchedAt: new Date().toISOString(),
  });
}
