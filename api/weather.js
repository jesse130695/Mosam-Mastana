/**
 * Mosam Mastana — Weather + AQI API proxy (Vercel Serverless Function)
 *
 * Proxies WeatherAPI.com /v1/current.json so the WEATHERAPI_KEY stays server-side.
 * Computes the Indian National AQI (CPCB) from PM2.5 / PM10 concentrations using
 * the official CPCB sub-index breakpoints, so we never label a US EPA index as
 * the Indian AQI.
 *
 * Endpoint: GET /api/weather?q=Delhi
 */

const WEATHERAPI_BASE = 'https://api.weatherapi.com/v1/current.json';

// CPCB National AQI breakpoints (24h avg for PM2.5, PM10)
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
      return Math.round(
        ((b.iHigh - b.iLow) / (b.cHigh - b.cLow)) * (clamped - b.cLow) + b.iLow
      );
    }
  }
  return null;
}

function categorize(aqi) {
  if (aqi === null) return null;
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

/**
 * Indian AQI = max of PM2.5 and PM10 sub-indices (CPCB method).
 * Returns null when no valid pollutant data exists — never invents a value.
 */
function indianAqi(airQuality) {
  if (!airQuality) return null;
  const pm25 = subIndex(airQuality.pm2_5, CPCB_BREAKPOINTS);
  const pm10 = subIndex(airQuality.pm10, CPCB_PM10_BREAKPOINTS);
  const candidates = [pm25, pm10].filter((v) => v !== null);
  if (candidates.length === 0) return null;
  const aqi = Math.max(...candidates);
  return {
    aqi,
    category: categorize(aqi),
    dominantPollutant: pm25 !== null && (pm10 === null || pm25 >= pm10) ? 'PM2.5' : 'PM10',
    pm25,
    pm10,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CONFIG_ERROR', message: 'WeatherAPI key is not configured on the server.' });
  }

  const city = (req.query.q || 'Delhi').toString().trim().slice(0, 100);
  if (!city) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please provide a city name (?q=CityName).' });
  }

  let upstream;
  try {
    const url = `${WEATHERAPI_BASE}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city)}&aqi=yes`;
    const response = await fetch(url);
    upstream = response;
    if (!response.ok) {
      let body = {};
      try { body = await response.json(); } catch { /* non-JSON error */ }
      const code = body?.error?.code;
      if (code === 1006) {
        return res.status(404).json({ error: 'CITY_NOT_FOUND', message: `Could not find a city called "${city}". Try a nearby major city.` });
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

  const indian = indianAqi(data?.current?.air_quality);

  res.status(200).json({
    source: 'WeatherAPI.com',
    indianAqiStandard: 'CPCB (India National AQI)',
    location: {
      name: data?.location?.name,
      region: data?.location?.region,
      country: data?.location?.country,
      localtime: data?.location?.localtime,
    },
    weather: {
      tempC: data?.current?.temp_c,
      feelsLikeC: data?.current?.feelslike_c,
      condition: data?.current?.condition?.text,
      icon: data?.current?.condition?.icon,
      humidity: data?.current?.humidity,
      windKph: data?.current?.wind_kph,
      uv: data?.current?.uv,
      lastUpdated: data?.current?.last_updated,
    },
    // Explicitly available flag: false + null values when air quality data is missing.
    aqi: {
      available: indian !== null,
      ...indian,
      pm25Concentration: data?.current?.air_quality?.pm2_5 ?? null,
      pm10Concentration: data?.current?.air_quality?.pm10 ?? null,
    },
  });
}
