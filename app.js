/* ============================================================
   MOSAM MASTANA — Frontend logic (v1.7, Night Radar)
   India-first search · AQI · cold commentary (Hinglish/English)
   · rain forecast · storm awareness · weather-responsive accents
   · Leaflet location map (F9: clearly labelled fallback — no fake radar)
   All data is fetched live from /api/weather and /api/search.
   No hardcoded or mock weather data.
   ============================================================ */

import { POPULAR_ZONES, STATES_AND_UTS, STATE_PLACES } from './places.js';

const DEFAULT_QUERY = 'Delhi,India'; // FR-02: Delhi loads on launch (disambiguated from Delhi, Canada)

/* ---------------- Configurable thresholds ---------------- */
const COLD_RULES = [           // Wind-chill/feels-like °C → level
  { max: 5, level: 'Very Cold' },
  { max: 10, level: 'Cold' },
  { max: 18, level: 'Chilly' },
];
const HEAT_THRESHOLD_C = 35;   // 7.4: Hot / Heat mode (configurable, validate before launch)

/* ---------------- Message pairs ---------------- */
const COLD_MESSAGES = {
  'Very Cold': { hi: 'Bhai kitni thand hai, lagta hai, barf jam jayegi!', en: "Bro, it's so cold—it feels like everything might freeze!" },
  'Cold': { hi: 'Bhai, thand badh gayi hai — garam kapde pehen lena.', en: "It's getting cold — wear warm clothes." },
  'Chilly': { hi: 'Bhai, halki thand hai — jacket le lena.', en: "It's a bit chilly — carry a jacket." },
};

const AQI_MESSAGES = [
  { max: 50,  category: 'Good',         color: 'var(--aqi-good)',         hi: 'Hawa badiya hai bhai! Mausam ka maza lo.', en: 'Air is great, bro! Enjoy the weather.' },
  { max: 100, category: 'Satisfactory', color: 'var(--aqi-satisfactory)', hi: 'Sab theek hai! Bas apna khayal rakhna.', en: 'All good! Just take care of yourself.' },
  { max: 200, category: 'Moderate',     color: 'var(--aqi-moderate)',     hi: 'Thoda sambhal ke bhai! Sensitive log outdoor activity kam rakhein.', en: 'Take it easy, bro! Sensitive people should reduce outdoor activity.' },
  { max: 300, category: 'Poor',         color: 'var(--aqi-poor)',         hi: 'Mask laga lo bhai! Pollution zyada hai.', en: 'Wear a mask, bro! Pollution is high.' },
  { max: 400, category: 'Very Poor',    color: 'var(--aqi-very-poor)',    hi: 'Bhai, hawa ki haalat kharab hai! Outdoor activities limit karo.', en: 'Bro, the air is in bad shape! Limit outdoor activities.' },
  { max: 500, category: 'Severe',       color: 'var(--aqi-severe)',       hi: 'MASK LAGA LO BHAI! Zaroori na ho toh bahar mat niklo.', en: 'WEAR A MASK, BRO! Do not go outside unless necessary.' },
];

/* Dark chip treatment for AQI categories (7.5): semantic text colour
   on a dark tinted chip — colour is never the only signal. */
const AQI_CHIP_DARK = {
  'Good':         { bg: '#102B25', text: 'var(--aqi-good)' },
  'Satisfactory': { bg: '#293016', text: 'var(--aqi-satisfactory)' },
  'Moderate':     { bg: '#392D13', text: 'var(--aqi-moderate)' },
  'Poor':         { bg: '#3E261A', text: 'var(--aqi-poor)' },
  'Very Poor':    { bg: '#3D2026', text: 'var(--aqi-very-poor)' },
  'Severe':       { bg: '#3A171D', text: 'var(--aqi-severe)' },
};

const EPA_MESSAGES = {
  'Good': 'Air quality is good.',
  'Moderate': 'Air quality is moderate — unusually sensitive people should take care.',
  'Unhealthy for Sensitive Groups': 'Sensitive groups should reduce prolonged outdoor exertion.',
  'Unhealthy': 'Everyone may begin to feel effects — limit prolonged outdoor exertion.',
  'Very Unhealthy': 'Health alert — avoid outdoor exertion.',
  'Hazardous': 'Emergency conditions — stay indoors if possible.',
};

const RAIN_NONE = {
  hi: 'Agle 24 ghante mein baarish ka koi khaas chance nahi dikh raha.',
  en: 'No significant rain expected in the next 24 hours.',
};
const RAIN_LOW = {
  hi: 'Baarish ke chances kam hain — phir bhi chhatri rakh lo toh bura nahi.',
  en: 'Rain chances are low — an umbrella would not hurt, though.',
};

/* ---------------- Small consistent SVG icon set (7.8) ---------------- */
const ICONS = {
  bolt: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  rain: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M7 15a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 8.5 3.8 3.8 0 0 1 17.5 15H7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 18.5v2m3-3.5v3.5m3-4v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  wind: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M3 8h9a3 3 0 1 0-3-3M3 12h13a3 3 0 1 1-3 3M3 16h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  drop: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 3.2c3.1 3.4 5.6 6.3 5.6 9.4a5.6 5.6 0 1 1-11.2 0c0-3.1 2.5-6 5.6-9.4Z" fill="currentColor"/></svg>',
};

/* ---------------- Elements ---------------- */
const el = (id) => document.getElementById(id);
const els = {
  langHi: el('lang-hi'), langEn: el('lang-en'),
  form: el('search-form'), input: el('search-input'), suggestions: el('suggestions'),
  popularStrip: el('popular-strip'), openStates: el('open-states'),
  warningCard: el('warning-card'), warningList: el('warning-list'),
  stormCard: el('storm-indicator-card'), stormList: el('storm-indicator-list'),
  alertCard: el('alert-card'), alertLevel: el('alert-level'), alertCategory: el('alert-category'), alertMessage: el('alert-message'),
  coldCard: el('cold-card'), coldMeasure: el('cold-measure'), coldMessage: el('cold-message'), coldValue: el('cold-value'), coldTranslate: el('cold-translate'),
  statusCard: el('status-card'), statusMessage: el('status-message'),
  aqiCard: el('aqi-card'), aqiBadge: el('aqi-standard-badge'), aqiValue: el('aqi-value'), aqiCategory: el('aqi-category'),
  aqiScale: el('aqi-scale'), aqiPointer: el('aqi-pointer'),
  aqiPm25: el('aqi-pm25'), aqiPm10: el('aqi-pm10'), aqiDominant: el('aqi-dominant'), aqiDominantWrap: el('aqi-dominant-wrap'), aqiUpdated: el('aqi-updated'),
  rainCard: el('rain-card'), rainIssue: el('rain-issue'), rainMessage: el('rain-message'), rainBars: el('rain-bars'),
  rainNext: el('rain-next'), rainChance: el('rain-chance'), rainAmount: el('rain-amount'),
  dailyCard: el('daily-card'), dailyList: el('daily-list'),
  weatherCard: el('weather-card'), weatherLocation: el('weather-location'), weatherIcon: el('weather-icon'), heroChip: el('hero-mode-chip'),
  weatherTemp: el('weather-temp'), weatherCondition: el('weather-condition'), weatherFeels: el('weather-feels'),
  weatherHumidity: el('weather-humidity'), weatherWind: el('weather-wind'), weatherGust: el('weather-gust'),
  weatherUv: el('weather-uv'), weatherVis: el('weather-vis'), weatherPressure: el('weather-pressure'), weatherUpdated: el('weather-updated'),
  statesModal: el('states-modal'), statesGrid: el('states-grid'), statesTitle: el('states-title'),
  statePlaces: el('state-places'), statePlacesTitle: el('state-places-title'), statePlacesList: el('state-places-list'),
  closeStates: el('close-states'), backStates: el('back-states'),
  mapNoteText: el('map-note-text'), mapFrame: document.querySelector('.map-frame'),
};

/* ---------------- Leaflet location map (F9) ---------------- */
let map = null;
let mapMarker = null;
let mapLabel = null;

function initMap() {
  const host = document.getElementById('map');
  if (map || !host || typeof window.L === 'undefined') return; // Leaflet CDN failed → note explains fallback
  // A revived page can restore the old map DOM with a fresh script context.
  // Clear it so the previous screen's map can never be mounted twice.
  if (host._leaflet_id || host.childElementCount > 0) {
    host.innerHTML = '';
    if (host._leaflet_id) delete host._leaflet_id;
  }
  try {
    map = window.L.map(host, { zoomControl: true, attributionControl: true }).setView([20.59, 78.96], 4);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
  } catch {
    map = null;
  }
}

function updateMap(location) {
  if (!map || !location || location.lat === null || location.lat === undefined) return;
  const pos = [location.lat, location.lon];
  if (!mapMarker) {
    mapMarker = window.L.circleMarker(pos, {
      radius: 8,
      color: '#31C7E8',
      weight: 2,
      fillColor: '#31C7E8',
      fillOpacity: 0.55,
    }).addTo(map);
    mapLabel = window.L.tooltip({ permanent: true, direction: 'top', offset: [0, -10], className: 'location-marker-label' });
    mapMarker.bindTooltip(mapLabel);
  }
  mapMarker.setLatLng(pos);
  mapLabel.setContent(location.name || 'Selected location');
  map.setView(pos, 9, { animate: true });
}

/* The map belongs to the dashboard screen only. Tear it down when this
   screen is left (so no map from the previous screen can remain), and
   remount it when the browser restores this page on back/forward. */
function destroyMap() {
  const host = document.getElementById('map');
  if (map) {
    try { map.remove(); } catch { /* already detached */ }
  }
  map = null;
  mapMarker = null;
  mapLabel = null;
  if (host) {
    host.innerHTML = '';
    host.className = ''; // drop Leaflet's container classes too
    if (host._leaflet_id) delete host._leaflet_id;
  }
}

window.addEventListener('pagehide', destroyMap);
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return; // initial load is handled at boot
  destroyMap();
  initMap();
  if (lastData) updateMap(lastData.location);
});

/* ---------------- State ---------------- */
let lang = 'hi';
let lastData = null;
let lastDataMode = null;   // avoid re-applying accents on minor refreshes (7.4)
let searchTimer = null;
let activeStateName = null;
try { lang = localStorage.getItem('mm-lang') === 'en' ? 'en' : 'hi'; } catch { /* storage unavailable */ }

/* ---------------- Helpers ---------------- */
const fmt = (v, unit = '') => (v === null || v === undefined ? '—' : `${Math.round(v)}${unit}`);

function showStatus(message) {
  els.statusMessage.textContent = message;
  els.statusCard.classList.remove('hidden');
}
function hideStatus() { els.statusCard.classList.add('hidden'); }

function hideAllCards() {
  ['warning-card', 'storm-indicator-card', 'alert-card', 'cold-card', 'aqi-card', 'rain-card', 'daily-card', 'weather-card']
    .forEach((id) => el(id).classList.add('hidden'));
}

/* ============================================================
   Fetch & render
   ============================================================ */

async function fetchWeather(query) {
  if (!query) return;
  hideStatus();
  hideAllCards();
  els.mapNoteText.textContent = 'Loading location…';
  const submitBtn = els.form.querySelector('button');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Loading…';
  try {
    const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) {
      showStatus(data.message || 'Something went wrong. Please try again.');
      return;
    }
    lastData = data;
    applyWeatherMode(data);
    renderAll(data);
    updateMap(data.location);
    els.mapNoteText.textContent = 'Location map — live radar not connected. Precipitation overlay will appear only after a validated radar provider is integrated.';
  } catch {
    showStatus('Network error. Could not fetch weather data. Check your connection and try again.');
    els.mapNoteText.textContent = 'Location map unavailable — weather data could not be fetched.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Search';
  }
}

function renderAll(data) {
  renderWeather(data);
  renderAqi(data);
  renderPollutionAlert(data);
  renderCold(data);
  renderRain(data);
  renderDaily(data);
  renderWarnings(data);
  renderStormIndicators(data);
}

/* ---------------- Weather-responsive accents (7.4) ---------------- */

function computeWeatherMode(data) {
  // Priority: storm (official warning or severe storm condition) > rain > cold > hot > clear.
  const condText = (data.weather.condition || '').toLowerCase();
  const activeWarnings = data.alerts && data.alerts.available && data.alerts.warnings.length > 0;

  if (activeWarnings || /thunder|storm|hurricane|cyclone|tornado|blizzard/.test(condText)) return 'storm';
  if (/rain|drizzle|shower|sleet|freezing/.test(condText) || (data.weather.tempC !== null && data.forecast.available === false && false)) return 'rain';
  const coldValue = data.weather.windChillC !== null ? data.weather.windChillC : data.weather.feelsLikeC;
  if (coldValue !== null && coldValue <= COLD_RULES[COLD_RULES.length - 1].max) return 'cold';
  if (data.weather.tempC !== null && data.weather.tempC >= HEAT_THRESHOLD_C) return 'hot';
  return 'clear';
}

function applyWeatherMode(data) {
  const mode = computeWeatherMode(data);
  if (mode !== lastDataMode) {
    lastDataMode = mode;
    document.body.dataset.mode = mode; // CSS drives the accent tokens
  }
  els.heroChip.textContent =
    { storm: 'Storm watch', rain: 'Monsoon', cold: 'Winter', hot: 'Heat', clear: 'Clear' }[mode] || 'Clear';
}

/* ---------------- Current weather hero ---------------- */
function renderWeather(data) {
  const { location, weather } = data;
  els.weatherLocation.textContent = [location.name, location.country].filter(Boolean).join(', ') || '—';
  els.weatherTemp.textContent = fmt(weather.tempC);
  els.weatherCondition.textContent = weather.condition || '—';
  els.weatherIcon.src = weather.icon ? `https:${weather.icon}` : '';
  els.weatherIcon.alt = weather.condition || '';
  els.weatherFeels.textContent = weather.feelsLikeC === null ? '—' : `${Math.round(weather.feelsLikeC)}°C`;
  els.weatherHumidity.textContent = fmt(weather.humidity, '%');
  els.weatherWind.textContent =
    weather.windKph === null ? '—' : `${Math.round(weather.windKph)} km/h${weather.windDir ? ' ' + weather.windDir : ''}`;
  els.weatherGust.textContent = weather.windGustKph === null ? '—' : `${Math.round(weather.windGustKph)} km/h`;
  els.weatherUv.textContent = fmt(weather.uv);
  els.weatherVis.textContent = weather.visibilityKm === null ? '—' : `${weather.visibilityKm} km`;
  els.weatherPressure.textContent = weather.pressureMb === null ? '—' : `${weather.pressureMb} mb`;
  els.weatherUpdated.textContent = weather.lastUpdated || '—';
  els.weatherCard.classList.remove('hidden');
  markActiveChip(location);
}

/* ---------------- AQI panel ---------------- */
function renderAqi(data) {
  const aqi = data.aqi;
  if (!aqi.available) {
    els.aqiBadge.textContent = aqi.isIndia ? 'CPCB AQI' : 'Local AQI';
    els.aqiValue.textContent = '—';
    els.aqiValue.style.color = 'var(--haze)';
    els.aqiCategory.textContent = 'Data unavailable';
    els.aqiCategory.style.color = 'var(--haze)';
    els.aqiScale.classList.add('hidden');
    els.aqiPm25.textContent = fmt(aqi.pm25Concentration, ' µg/m³');
    els.aqiPm10.textContent = fmt(aqi.pm10Concentration, ' µg/m³');
    els.aqiDominantWrap.classList.add('hidden');
    els.aqiUpdated.textContent = data.weather.lastUpdated || '—';
    els.aqiCard.classList.remove('hidden');
    return;
  }

  els.aqiScale.classList.remove('hidden');
  els.aqiBadge.textContent = aqi.standard;
  els.aqiPm25.textContent = fmt(aqi.pm25Concentration, ' µg/m³');
  els.aqiPm10.textContent = fmt(aqi.pm10Concentration, ' µg/m³');
  els.aqiUpdated.textContent = data.weather.lastUpdated || '—';

  if (aqi.isIndia) {
    const rule = AQI_MESSAGES.find((r) => aqi.aqi <= r.max) || AQI_MESSAGES[AQI_MESSAGES.length - 1];
    els.aqiValue.textContent = Math.round(aqi.aqi);
    els.aqiValue.style.color = rule.color;
    els.aqiCategory.textContent = rule.category;
    els.aqiCategory.style.color = rule.color;
    els.aqiDominantWrap.classList.remove('hidden');
    els.aqiDominant.textContent = aqi.dominantPollutant || '—';

    // Scale pointer + segment emphasis (never colour-only: number & label in text)
    const idx = AQI_MESSAGES.indexOf(rule);
    els.aqiPointer.style.left = `${(idx * 100) / 6 + 100 / 12}%`;
    els.aqiPointer.style.borderTopColor = rule.color;
    els.aqiScale.querySelectorAll('.seg').forEach((seg, i) => {
      seg.classList.toggle('dim', i !== idx);
    });
    els.aqiScale.parentElement.querySelectorAll('.aqi-labels span').forEach((l, i) => {
      l.classList.toggle('current', i === idx);
    });
  } else {
    // US EPA categorical index — clearly labelled, never presented as Indian AQI.
    els.aqiValue.textContent = aqi.aqi !== null ? aqi.aqi : '—';
    els.aqiValue.style.color = 'var(--text)';
    els.aqiCategory.textContent = aqi.category || '—';
    els.aqiCategory.style.color = 'var(--text)';
    els.aqiDominantWrap.classList.add('hidden');
    els.aqiPointer.style.left = '50%';
    els.aqiPointer.style.borderTopColor = 'var(--haze)';
    els.aqiScale.querySelectorAll('.seg').forEach((seg) => seg.classList.remove('dim'));
  }
  els.aqiCard.classList.remove('hidden');
}

function renderPollutionAlert(data) {
  const aqi = data.aqi;
  if (!aqi.available) { els.alertCard.classList.add('hidden'); return; }

  if (aqi.isIndia) {
    const rule = AQI_MESSAGES.find((r) => aqi.aqi <= r.max) || AQI_MESSAGES[AQI_MESSAGES.length - 1];
    const chip = AQI_CHIP_DARK[rule.category];
    els.alertLevel.textContent = 'Pollution alert';
    els.alertCategory.textContent = rule.category;
    // Dark tinted chip + semantic text (7.5) — never a full-card fill
    els.alertCategory.style.background = chip.bg;
    els.alertCategory.style.borderColor = rule.color;
    els.alertCategory.style.color = rule.color;
    els.alertCard.style.borderLeftColor = rule.color;
    els.alertMessage.textContent = rule[lang];
    els.alertMessage.style.color = 'var(--text)';
  } else {
    // US EPA categorical index — clearly labelled, never presented as Indian AQI.
    els.alertLevel.textContent = 'Air quality';
    els.alertCategory.textContent = aqi.category || '';
    els.alertCategory.style.background = 'var(--slate2)';
    els.alertCategory.style.borderColor = 'var(--line)';
    els.alertCategory.style.color = 'var(--mist)';
    els.alertCard.style.borderLeftColor = 'var(--cyan)';
    els.alertMessage.textContent = EPA_MESSAGES[aqi.category] || 'Air quality information available.';
    els.alertMessage.style.color = 'var(--text)';
  }
  els.alertCard.classList.remove('hidden');
}

/* ---------------- Cold / winter commentary (F5) ---------------- */
function computeCold(data) {
  const w = data.weather;
  if (w.windChillC === null && w.feelsLikeC === null) return null; // missing data → no guessed alert
  const value = w.windChillC !== null ? w.windChillC : w.feelsLikeC;
  const rule = COLD_RULES.find((r) => value <= r.max);
  return rule ? { value, measure: w.windChillC !== null ? 'Wind chill' : 'Feels-like', rule } : null;
}

function renderCold(data) {
  const cold = computeCold(data);
  if (!cold) { els.coldCard.classList.add('hidden'); return; }
  const pair = COLD_MESSAGES[cold.rule.level];
  els.coldMeasure.textContent = cold.measure;
  els.coldMessage.textContent = pair[lang];
  els.coldValue.textContent = `${Math.round(cold.value)}°C ${cold.measure.toLowerCase()} · measured ${Math.round(data.weather.tempC)}°C`;
  els.coldTranslate.textContent = lang === 'hi' ? 'Translate to English' : 'Hinglish mein padho';
  els.coldCard.classList.remove('hidden');
}

/* ---------------- Rain forecast (F6) ---------------- */
function next24Hours(data) {
  const fc = data.forecast;
  if (!fc.available) return [];
  const currentHourPrefix = (data.location.localtime || '').slice(0, 13);
  let start = fc.hourly.findIndex((h) => h.time && h.time.slice(0, 13) === currentHourPrefix);
  if (start < 0) start = 0;
  return fc.hourly.slice(start, start + 24);
}

function partOfDay(hourNum) {
  if (hourNum >= 5 && hourNum < 12) return { hi: 'subah', en: 'the morning' };
  if (hourNum >= 12 && hourNum < 17) return { hi: 'dopahar', en: 'the afternoon' };
  if (hourNum >= 17 && hourNum < 21) return { hi: 'shaam', en: 'the evening' };
  return { hi: 'raat', en: 'the night' };
}

function renderRain(data) {
  const fc = data.forecast;
  if (!fc.available) {
    els.rainCard.classList.remove('hidden');
    els.rainMessage.textContent = 'Forecast unavailable — provider did not return hourly data.';
    els.rainBars.innerHTML = '';
    els.rainNext.textContent = '—';
    els.rainChance.textContent = '—';
    els.rainAmount.textContent = '—';
    els.rainIssue.textContent = 'Forecast unavailable';
    els.dailyCard.classList.add('hidden');
    return;
  }

  const hours = next24Hours(data);
  const nextRain = hours.find((h) => h.chanceOfRain !== null && h.chanceOfRain >= 30) || null;
  const anyChance = hours.some((h) => (h.chanceOfRain ?? 0) > 0);

  if (nextRain) {
    const hourNum = parseInt(nextRain.time.slice(11, 13), 10);
    const part = partOfDay(hourNum);
    const pct = Math.round(nextRain.chanceOfRain);
    els.rainMessage.textContent = lang === 'hi'
      ? `Bhai, ${part.hi} ko baarish ke chances hain (${pct}%) — umbrella rakh lena.`
      : `Bro, rain is possible in ${part.en} (${pct}% chance) — carry an umbrella.`;
    els.rainNext.textContent = nextRain.time.slice(11) || '—';
    els.rainChance.textContent = fmt(nextRain.chanceOfRain, '%');
    els.rainAmount.textContent = nextRain.precipMm === null ? 'Forecast unavailable' : `${nextRain.precipMm} mm (expected)`;
  } else {
    els.rainMessage.textContent = anyChance ? RAIN_LOW[lang] : RAIN_NONE[lang];
    els.rainNext.textContent = 'None in next 24h';
    els.rainChance.textContent = '—';
    els.rainAmount.textContent = '—';
  }

  // Hourly probability bars — probability, never certainty (F6)
  els.rainBars.innerHTML = '';
  hours.forEach((h) => {
    const pct = h.chanceOfRain;
    const wrap = document.createElement('div');
    wrap.className = 'rain-bar' + (nextRain && h === nextRain ? ' next' : '');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', h.time ? `${h.time.slice(11)} — rain chance ${pct === null ? 'unavailable' : Math.round(pct) + '%'}` : 'forecast hour');
    const label = document.createElement('span');
    label.className = 'pct';
    label.textContent = pct === null ? '?' : `${Math.round(pct)}%`;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = pct === null ? '3px' : `${Math.max(3, Math.round((pct / 100) * 62))}px`;
    const hr = document.createElement('span');
    hr.className = 'hr';
    hr.textContent = h.time ? h.time.slice(11) : '—';
    wrap.append(label, bar, hr);
    els.rainBars.appendChild(wrap);
  });

  els.rainIssue.textContent = `Local time ${(data.location.localtime || '—').slice(11)}`;
  els.rainCard.classList.remove('hidden');
}

function renderDaily(data) {
  const fc = data.forecast;
  if (!fc.available || fc.daily.length === 0) { els.dailyCard.classList.add('hidden'); return; }
  els.dailyList.innerHTML = '';
  fc.daily.slice(0, 7).forEach((d) => {
    let dayName = d.date || '—';
    try { dayName = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); } catch { /* keep raw */ }
    const item = document.createElement('div');
    item.className = 'daily-item';
    item.innerHTML = `
      <div class="d-name">${dayName}</div>
      <img src="https:${d.icon || ''}" width="30" height="30" alt="" />
      <div class="d-cond">${d.condition || '—'}</div>
      <div class="d-temps num">${d.maxTempC === null ? '?' : Math.round(d.maxTempC)}° / ${d.minTempC === null ? '?' : Math.round(d.minTempC)}°</div>
      <div class="d-rain">${ICONS.drop} ${d.chanceOfRain === null ? '—' : Math.round(d.chanceOfRain) + '%'}</div>
    `;
    els.dailyList.appendChild(item);
  });
  els.dailyCard.classList.remove('hidden');
}

/* ---------------- Official warnings & storm indicators (F7) ---------------- */
function renderWarnings(data) {
  els.warningList.innerHTML = '';
  const alerts = data.alerts;
  // 7.7/FR-06: warning region collapses cleanly when there are no ACTIVE
  // warnings. Unavailable data is never shown as "No warning" here — the
  // note moves into the storm indicator card instead.
  const hasActive = alerts && alerts.available && alerts.warnings.length > 0;
  if (!hasActive) { els.warningCard.classList.add('hidden'); return; }

  alerts.warnings.forEach((w) => {
    const item = document.createElement('div');
    item.className = 'warning-item';
    const validity = [w.effectiveLocal, w.expiresLocal].filter(Boolean).join(' → ');
    item.innerHTML = `
      <div class="warning-event">${w.event || 'Weather warning'}</div>
      <div class="warning-meta">Severity: <strong>${w.severity || '—'}</strong> · Areas: <strong>${w.areas || '—'}</strong></div>
      ${validity ? `<div class="warning-meta">Valid: <strong>${validity}</strong> (local time)</div>` : ''}
      <div class="warning-meta">Source: ${w.source || '—'}</div>
      ${w.instruction ? `<div class="warning-instruction">${w.instruction}</div>` : ''}
    `;
    els.warningList.appendChild(item);
  });
  els.warningCard.classList.remove('hidden');
}

function renderStormIndicators(data) {
  els.stormList.innerHTML = '';
  const hours = next24Hours(data);
  const indicators = [];

  hours.forEach((h) => {
    const text = (h.condition || '').toLowerCase();
    const time = h.time ? h.time.slice(11) : '';
    if (/thunder/.test(text)) {
      indicators.push({ icon: ICONS.bolt, text: `Thunderstorm possible around ${time} — forecast indicator` });
    } else if (/heavy (rain|showers)/.test(text)) {
      indicators.push({ icon: ICONS.rain, text: `Heavy rain possible around ${time} — forecast indicator` });
    }
  });
  const gust = data.weather.windGustKph;
  if (gust !== null && gust >= 50) {
    indicators.push({ icon: ICONS.wind, text: `High wind gusts up to ${Math.round(gust)} km/h — forecast indicator` });
  }

  // Warning-data status line: unavailable ≠ "No warning" (FR-06 data rule)
  const alerts = data.alerts;
  let warningStatus = null;
  if (!alerts || !alerts.available) {
    warningStatus = 'Storm warning data unavailable — the official warning feed could not be retrieved for this location.';
  } else if (alerts.warnings.length === 0) {
    warningStatus = `No active official warnings for this location (checked ${data.location.localtime || '—'} local time).`;
  }

  if (indicators.length === 0) {
    if (warningStatus) {
      els.stormList.innerHTML = `<p class="storm-unavailable">${warningStatus}</p>`;
      els.stormCard.classList.remove('hidden');
    } else {
      els.stormCard.classList.add('hidden');
    }
    return;
  }
  indicators.slice(0, 6).forEach((ind) => {
    const p = document.createElement('p');
    p.className = 'storm-item';
    p.innerHTML = `${ind.icon}<span>${ind.text}</span>`;
    els.stormList.appendChild(p);
  });
  const note = document.createElement('p');
  note.className = 'storm-note';
  note.textContent = 'Forecast-based indicator only — not an official warning.';
  els.stormList.appendChild(note);
  if (warningStatus) {
    const st = document.createElement('p');
    st.className = 'storm-note';
    st.textContent = warningStatus;
    els.stormList.appendChild(st);
  }
  els.stormCard.classList.remove('hidden');
}

/* ============================================================
   Location search (FR-01: India-first)
   ============================================================ */

function placeButton(place) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'suggestion';
  btn.innerHTML = `<span class="s-name">${place.name}</span><span class="s-context">${place.context || place.country || ''}</span>`;
  btn.addEventListener('click', () => selectPlace(place));
  return btn;
}

function selectPlace(place) {
  els.input.value = [place.name, place.region].filter(Boolean).join(', ');
  els.suggestions.classList.add('hidden');
  // Stable coordinates rather than a possibly ambiguous name (FR-01 rule 8)
  fetchWeather(`${place.lat},${place.lon}`);
}

function renderSuggestions(payload) {
  els.suggestions.innerHTML = '';
  const hasIndia = payload.india && payload.india.length > 0;
  const hasGlobal = payload.global && payload.global.length > 0;

  if (!hasIndia && !hasGlobal) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Location not found. Try the district name or a nearby supported town.';
    els.suggestions.appendChild(empty);
    els.suggestions.classList.remove('hidden');
    return;
  }

  if (hasIndia) {
    const lbl = document.createElement('div');
    lbl.className = 'group-label india';
    lbl.textContent = 'India';
    els.suggestions.appendChild(lbl);
    payload.india.slice(0, 6).forEach((p) => els.suggestions.appendChild(placeButton(p)));
  }
  if (hasGlobal) {
    const lbl = document.createElement('div');
    lbl.className = 'group-label';
    lbl.textContent = 'Global';
    els.suggestions.appendChild(lbl);
    payload.global.slice(0, 6).forEach((p) => els.suggestions.appendChild(placeButton(p)));
  }
  els.suggestions.classList.remove('hidden');
}

async function runSearch(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderSuggestions(data);
  } catch {
    els.suggestions.innerHTML = '<p class="empty">Search service unavailable — you can still press Search.</p>';
    els.suggestions.classList.remove('hidden');
  }
}

els.input.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = els.input.value.trim();
  if (q.length < 2) { els.suggestions.classList.add('hidden'); return; }
  searchTimer = setTimeout(() => runSearch(q), 350);
});

els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const first = els.suggestions.querySelector('.suggestion');
    els.suggestions.classList.add('hidden');
    if (first) first.click();
    else fetchWeather(els.input.value.trim());
  }
});

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  els.suggestions.classList.add('hidden');
  const q = els.input.value.trim();
  if (q) fetchWeather(q);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) els.suggestions.classList.add('hidden');
});

/* ============================================================
   Popular strip & States/UT browsing (F1)
   ============================================================ */

function buildPopularStrip() {
  els.popularStrip.innerHTML = '';
  POPULAR_ZONES.forEach((zone) => {
    const zl = document.createElement('span');
    zl.className = 'chip-zone';
    zl.textContent = zone.zone;
    els.popularStrip.appendChild(zl);
    zone.cities.forEach((city) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = city;
      chip.dataset.city = city;
      chip.addEventListener('click', () => fetchWeather(`${city},India`));
      els.popularStrip.appendChild(chip);
    });
  });
}

function markActiveChip(location) {
  els.popularStrip.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', location && chip.dataset.city === location.name);
  });
}

function buildStatesGrid() {
  els.statesGrid.innerHTML = '';
  STATES_AND_UTS.forEach((name) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'state-chip';
    chip.textContent = name;
    chip.addEventListener('click', () => openStatePlaces(name));
    els.statesGrid.appendChild(chip);
  });
}

// F1 rule 2: selecting a state opens its localities — never silently maps to the capital.
function openStatePlaces(stateName) {
  activeStateName = stateName;
  els.statesTitle.textContent = stateName;
  els.statesGrid.classList.add('hidden');
  els.statePlaces.classList.remove('hidden');
  els.statePlacesTitle.textContent = `Localities in ${stateName}`;
  renderStateChips('');
}

function renderStateChips(filter) {
  const list = els.statePlacesList;
  list.innerHTML = '';
  const curated = STATE_PLACES[activeStateName] || [];
  const f = filter.trim().toLowerCase();
  curated
    .filter((p) => !f || p.toLowerCase().includes(f))
    .forEach((placeName) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = placeName;
      chip.addEventListener('click', async () => {
        // Resolve via geocoder → stable coordinates for the exact locality
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(placeName)}`);
          const data = await res.json();
          const norm = (s) => (s || '').toLowerCase();
          const candidates = [...(data.india || []), ...(data.global || [])];
          const inState = candidates.find((p) => norm(p.region).includes(norm(activeStateName).replace(/\s*\(nct\)/, '')));
          const pick = inState || candidates.find((p) => norm(p.country) === 'india');
          els.statesModal.classList.add('hidden');
          if (pick) selectPlace(pick);
          else fetchWeather(`${placeName},India`);
        } catch {
          els.statesModal.classList.add('hidden');
          fetchWeather(`${placeName},India`);
        }
      });
      list.appendChild(chip);
    });

  if (list.children.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'state-empty';
    empty.textContent = 'No curated matches — try the provider search below or a nearby district.';
    list.appendChild(empty);
  }
}

els.openStates.addEventListener('click', () => {
  els.statesModal.classList.remove('hidden');
  els.statesTitle.textContent = 'Select a state or Union Territory';
  els.statesGrid.classList.remove('hidden');
  els.statePlaces.classList.add('hidden');
});
els.closeStates.addEventListener('click', () => els.statesModal.classList.add('hidden'));
els.backStates.addEventListener('click', () => {
  els.statePlaces.classList.add('hidden');
  els.statesGrid.classList.remove('hidden');
  els.statesTitle.textContent = 'Select a state or Union Territory';
});
els.statesModal.addEventListener('click', (e) => {
  if (e.target === els.statesModal) els.statesModal.classList.add('hidden');
});

/* ============================================================
   Language toggle (F8)
   ============================================================ */

function setLang(next) {
  lang = next;
  try { localStorage.setItem('mm-lang', next); } catch { /* storage unavailable */ }
  els.langHi.classList.toggle('active', lang === 'hi');
  els.langEn.classList.toggle('active', lang === 'en');
  if (lastData) {
    // Re-render only message-bearing cards; data values stay untouched (FR-04)
    renderPollutionAlert(lastData);
    renderCold(lastData);
    renderRain(lastData);
  }
}
els.langHi.addEventListener('click', () => setLang('hi'));
els.langEn.addEventListener('click', () => setLang('en'));
els.coldTranslate.addEventListener('click', () => setLang(lang === 'hi' ? 'en' : 'hi'));

/* ============================================================
   Boot
   ============================================================ */
initMap();
els.langHi.classList.toggle('active', lang === 'hi');
els.langEn.classList.toggle('active', lang === 'en');
buildPopularStrip();
buildStatesGrid();
fetchWeather(DEFAULT_QUERY);
