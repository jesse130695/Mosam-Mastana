/* ============================================================
   MOSAM MASTANA — Frontend logic
   Fetches live data from /api/weather (WeatherAPI proxy).
   No hardcoded or mock weather data.
   ============================================================ */

// FR-10: Delhi loads automatically on launch.
// "Delhi, India" disambiguates from Delhi (Canada) in WeatherAPI's geocoder.
const DEFAULT_CITY = 'Delhi, India';

// India National AQI (CPCB) categories → alert messages (from PRD F4)
const ALERTS = [
  { max: 50,  category: 'Good',        color: 'var(--aqi-good)',         message: 'Hawa badiya hai bhai! Mausam ka maza lo.' },
  { max: 100, category: 'Satisfactory', color: 'var(--aqi-satisfactory)', message: 'Sab theek hai! Bas apna khayal rakhna.' },
  { max: 200, category: 'Moderate',    color: 'var(--aqi-moderate)',     message: 'Thoda sambhal ke bhai! Sensitive log outdoor activity kam rakhein.' },
  { max: 300, category: 'Poor',        color: 'var(--aqi-poor)',         message: 'Mask laga lo bhai! Pollution zyada hai.' },
  { max: 400, category: 'Very Poor',   color: 'var(--aqi-very-poor)',    message: 'Bhai, hawa ki haalat kharab hai! Outdoor activities limit karo.' },
  { max: 500, category: 'Severe',      color: 'var(--aqi-severe)',       message: 'MASK LAGA LO BHAI! Zaroori na ho toh bahar mat niklo.' },
];

const el = (id) => document.getElementById(id);
const els = {
  form: el('search-form'),
  input: el('search-input'),
  alertCard: el('alert-card'),
  alertLevel: el('alert-level'),
  alertCategory: el('alert-category'),
  alertMessage: el('alert-message'),
  statusCard: el('status-card'),
  statusMessage: el('status-message'),
  aqiCard: el('aqi-card'),
  aqiValue: el('aqi-value'),
  aqiCategory: el('aqi-category'),
  aqiPm25: el('aqi-pm25'),
  aqiPm10: el('aqi-pm10'),
  aqiDominant: el('aqi-dominant'),
  aqiUpdated: el('aqi-updated'),
  weatherCard: el('weather-card'),
  weatherLocation: el('weather-location'),
  weatherIcon: el('weather-icon'),
  weatherTemp: el('weather-temp'),
  weatherCondition: el('weather-condition'),
  weatherFeels: el('weather-feels'),
  weatherHumidity: el('weather-humidity'),
  weatherWind: el('weather-wind'),
  weatherUv: el('weather-uv'),
};

const fmt = (v, unit = '') =>
  v === null || v === undefined ? '—' : `${Math.round(v)}${unit}`;

function showStatus(message) {
  els.statusMessage.textContent = message;
  els.statusCard.classList.remove('hidden');
}

function hideStatus() {
  els.statusCard.classList.add('hidden');
}

function renderWeather(data) {
  const { location, weather } = data;
  els.weatherLocation.textContent =
    [location.name, location.country].filter(Boolean).join(', ') || '—';
  els.weatherTemp.textContent = fmt(weather.tempC);
  els.weatherCondition.textContent = weather.condition || '—';
  els.weatherIcon.src = weather.icon ? `https:${weather.icon}` : '';
  els.weatherIcon.alt = weather.condition || '';
  els.weatherFeels.textContent = fmt(weather.feelsLikeC, '°C');
  els.weatherHumidity.textContent = fmt(weather.humidity, '%');
  els.weatherWind.textContent = fmt(weather.windKph, ' km/h');
  els.weatherUv.textContent = fmt(weather.uv);
  els.weatherCard.classList.remove('hidden');
}

function renderAqi(data) {
  const aqi = data.aqi;
  if (!aqi.available || aqi.aqi === null || aqi.aqi === undefined) {
    // Data rule: never invent a pollution status — show unavailable message.
    els.aqiValue.textContent = 'N/A';
    els.aqiCategory.textContent = 'Data unavailable';
    els.aqiCategory.style.color = 'inherit';
    els.aqiValue.style.background = 'var(--bg)';
    els.aqiValue.style.color = 'var(--ink)';
    els.alertCard.classList.add('hidden');
    els.aqiCard.classList.remove('hidden');
    els.aqiPm25.textContent = fmt(aqi.pm25Concentration, ' µg/m³');
    els.aqiPm10.textContent = fmt(aqi.pm10Concentration, ' µg/m³');
    els.aqiDominant.textContent = '—';
    els.aqiUpdated.textContent = data.weather.lastUpdated || '—';
    showStatus(`Air quality data is currently unavailable for ${data.location.name || 'this city'}. Please check back later.`);
    return;
  }

  hideStatus();
  const rule = ALERTS.find((r) => aqi.aqi <= r.max) || ALERTS[ALERTS.length - 1];

  els.aqiValue.textContent = Math.round(aqi.aqi);
  els.aqiValue.style.background = rule.color;
  els.aqiValue.style.color = aqi.aqi >= 200 && aqi.aqi <= 300 ? 'var(--ink)' : '#ffffff';
  els.aqiCategory.textContent = rule.category;
  els.aqiCategory.style.color = rule.color;

  document.querySelectorAll('.seg').forEach((seg, i) => {
    seg.classList.toggle('active', i === ALERTS.indexOf(rule));
  });

  els.aqiPm25.textContent = fmt(aqi.pm25Concentration, ' µg/m³');
  els.aqiPm10.textContent = fmt(aqi.pm10Concentration, ' µg/m³');
  els.aqiDominant.textContent = aqi.dominantPollutant || '—';
  els.aqiUpdated.textContent = data.weather.lastUpdated || '—';
  els.aqiCard.classList.remove('hidden');

  // Pollution alert — strong visual prominence
  els.alertLevel.textContent = 'POLLUTION ALERT';
  els.alertCategory.textContent = rule.category;
  els.alertCategory.style.color = rule.color;
  els.alertMessage.textContent = rule.message;
  els.alertMessage.style.color = aqi.aqi >= 301 ? rule.color : 'var(--ink)';
  els.alertCard.style.background = aqi.aqi >= 401 ? '#ffe9e9' : 'var(--surface)';
  els.alertCard.classList.remove('hidden');
}

async function fetchWeather(city) {
  hideStatus();
  const submitBtn = els.form.querySelector('button');
  submitBtn.disabled = true;
  submitBtn.textContent = 'LOADING…';

  try {
    const res = await fetch(`/api/weather?q=${encodeURIComponent(city)}`);
    const data = await res.json();

    if (!res.ok) {
      els.weatherCard.classList.add('hidden');
      els.aqiCard.classList.add('hidden');
      els.alertCard.classList.add('hidden');
      showStatus(data.message || 'Something went wrong. Please try again.');
      return;
    }

    renderWeather(data);
    renderAqi(data);
  } catch {
    els.weatherCard.classList.add('hidden');
    els.aqiCard.classList.add('hidden');
    els.alertCard.classList.add('hidden');
    showStatus('Network error. Could not fetch weather data. Check your connection and try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'SEARCH';
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const city = els.input.value.trim();
  if (!city) return;
  fetchWeather(city);
});

// FR-10: Delhi weather loads automatically on application launch
fetchWeather(DEFAULT_CITY);
