/* ============================================================
   MOSAM MASTANA — Frontend logic (v1.2)
   India-first search · AQI · cold commentary (Hinglish/English)
   · rain forecast · storm awareness
   All data is fetched live from /api/weather and /api/search.
   No hardcoded or mock weather data.
   ============================================================ */

import { POPULAR_ZONES, STATES_AND_UTS, STATE_PLACES } from './places.js';

const DEFAULT_QUERY = 'Delhi,India'; // FR-02: Delhi loads on launch (disambiguated from Delhi, Canada)

/* ---------------- Cold thresholds (configurable, per PRD F5) ---------------- */
const COLD_RULES = [
  { max: 5, level: 'Very Cold' },
  { max: 10, level: 'Cold' },
  { max: 18, level: 'Chilly' },
];

const COLD_MESSAGES = {
  'Very Cold': {
    hi: 'Bhai kitni thand hai, lagta hai, barf jam jayegi!',
    en: "Bro, it's so cold—it feels like everything might freeze!",
  },
  'Cold': {
    hi: 'Bhai, thand badh gayi hai — garam kapde pehen lena.',
    en: "It's getting cold — wear warm clothes.",
  },
  'Chilly': {
    hi: 'Bhai, halki thand hai — jacket le lena.',
    en: "It's a bit chilly — carry a jacket.",
  },
};

/* ---------------- Indian AQI (CPCB) alert pairs (PRD F4/F8) ---------------- */
const AQI_MESSAGES = [
  { max: 50,  category: 'Good',         color: 'var(--aqi-good)',         hi: 'Hawa badiya hai bhai! Mausam ka maza lo.', en: 'Air is great, bro! Enjoy the weather.' },
  { max: 100, category: 'Satisfactory', color: 'var(--aqi-satisfactory)', hi: 'Sab theek hai! Bas apna khayal rakhna.', en: "All good! Just take care of yourself." },
  { max: 200, category: 'Moderate',     color: 'var(--aqi-moderate)',     hi: 'Thoda sambhal ke bhai! Sensitive log outdoor activity kam rakhein.', en: 'Take it easy, bro! Sensitive people should reduce outdoor activity.' },
  { max: 300, category: 'Poor',         color: 'var(--aqi-poor)',         hi: 'Mask laga lo bhai! Pollution zyada hai.', en: 'Wear a mask, bro! Pollution is high.' },
  { max: 400, category: 'Very Poor',    color: 'var(--aqi-very-poor)',    hi: 'Bhai, hawa ki haalat kharab hai! Outdoor activities limit karo.', en: 'Bro, the air is in bad shape! Limit outdoor activities.' },
  { max: 500, category: 'Severe',       color: 'var(--aqi-severe)',       hi: 'MASK LAGA LO BHAI! Zaroori na ho toh bahar mat niklo.', en: 'WEAR A MASK, BRO! Do not go outside unless necessary.' },
];

/* US EPA categories — factual English messages for non-Indian locations only */
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
  aqiPm25: el('aqi-pm25'), aqiPm10: el('aqi-pm10'), aqiDominant: el('aqi-dominant'), aqiDominantWrap: el('aqi-dominant-wrap'), aqiUpdated: el('aqi-updated'), aqiScale: el('aqi-scale'),
  rainCard: el('rain-card'), rainIssue: el('rain-issue'), rainMessage: el('rain-message'), rainBars: el('rain-bars'),
  rainNext: el('rain-next'), rainChance: el('rain-chance'), rainAmount: el('rain-amount'),
  dailyCard: el('daily-card'), dailyList: el('daily-list'),
  weatherCard: el('weather-card'), weatherLocation: el('weather-location'), weatherIcon: el('weather-icon'),
  weatherTemp: el('weather-temp'), weatherCondition: el('weather-condition'), weatherFeels: el('weather-feels'),
  weatherHumidity: el('weather-humidity'), weatherWind: el('weather-wind'), weatherGust: el('weather-gust'),
  weatherUv: el('weather-uv'), weatherVis: el('weather-vis'), weatherUpdated: el('weather-updated'),
  statesModal: el('states-modal'), statesGrid: el('states-grid'), statesTitle: el('states-title'),
  statePlaces: el('state-places'), statePlacesTitle: el('state-places-title'), statePlacesList: el('state-places-list'),
  closeStates: el('close-states'), backStates: el('back-states'),
};

/* ---------------- State ---------------- */
let lang = 'hi';          // 'hi' (Hinglish) | 'en'
let lastData = null;      // last successful /api/weather payload
let searchTimer = null;
let activeStateName = null;
let activeQuery = null;   // query of the currently displayed location

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
  activeQuery = query;
  hideStatus();
  hideAllCards();
  const submitBtn = els.form.querySelector('button');
  submitBtn.disabled = true;
  submitBtn.textContent = 'LOADING…';
  try {
    const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) {
      showStatus(data.message || 'Something went wrong. Please try again.');
      return;
    }
    lastData = data;
    renderAll(data);
  } catch {
    showStatus('Network error. Could not fetch weather data. Check your connection and try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'SEARCH';
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

/* ---------------- Current weather ---------------- */
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
  els.weatherUpdated.textContent = weather.lastUpdated || '—';
  els.weatherCard.classList.remove('hidden');
  markActiveChip(location);
}

/* ---------------- AQI ---------------- */
function renderAqi(data) {
  const aqi = data.aqi;
  if (!aqi.available) {
    // Data rule: never invent a pollution status.
    els.aqiBadge.textContent = aqi.isIndia ? 'CPCB AQI' : 'LOCAL AQI';
    els.aqiValue.textContent = 'N/A';
    els.aqiValue.style.background = 'var(--bg)';
    els.aqiValue.style.color = 'var(--ink)';
    els.aqiCategory.textContent = 'Data unavailable';
    els.aqiCategory.style.color = 'inherit';
    els.aqiPm25.textContent = fmt(aqi.pm25Concentration, ' µg/m³');
    els.aqiPm10.textContent = fmt(aqi.pm10Concentration, ' µg/m³');
    els.aqiDominantWrap.classList.add('hidden');
    els.aqiUpdated.textContent = data.weather.lastUpdated || '—';
    els.aqiScale.classList.add('hidden');
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
    els.aqiValue.style.background = rule.color;
    els.aqiValue.style.color = (aqi.aqi >= 200 && aqi.aqi <= 300) ? 'var(--ink)' : '#fff';
    els.aqiCategory.textContent = rule.category;
    els.aqiCategory.style.color = rule.color;
    els.aqiDominantWrap.classList.remove('hidden');
    els.aqiDominant.textContent = aqi.dominantPollutant || '—';
    els.aqiScale.querySelectorAll('.seg').forEach((seg, i) => {
      seg.classList.toggle('active', i === AQI_MESSAGES.indexOf(rule));
    });
  } else {
    // US EPA categorical index — clearly labelled, category shown as the headline.
    els.aqiValue.textContent = aqi.aqi !== null ? aqi.aqi : 'N/A';
    els.aqiValue.style.background = 'var(--bg)';
    els.aqiValue.style.color = 'var(--ink)';
    els.aqiCategory.textContent = aqi.category || '—';
    els.aqiCategory.style.color = 'inherit';
    els.aqiDominantWrap.classList.add('hidden');
    els.aqiScale.querySelectorAll('.seg').forEach((seg) => seg.classList.remove('active'));
  }
  els.aqiCard.classList.remove('hidden');
}

function renderPollutionAlert(data) {
  const aqi = data.aqi;
  if (!aqi.available) { els.alertCard.classList.add('hidden'); return; }

  if (aqi.isIndia) {
    const rule = AQI_MESSAGES.find((r) => aqi.aqi <= r.max) || AQI_MESSAGES[AQI_MESSAGES.length - 1];
    els.alertLevel.textContent = 'POLLUTION ALERT';
    els.alertCategory.textContent = rule.category;
    els.alertCategory.style.color = rule.color;
    els.alertMessage.textContent = rule[lang];
    els.alertMessage.style.color = aqi.aqi >= 301 ? rule.color : 'var(--ink)';
    els.alertCard.style.background = aqi.aqi >= 401 ? '#ffe9e9' : 'var(--surface)';
  } else {
    els.alertLevel.textContent = 'AIR QUALITY';
    els.alertCategory.textContent = aqi.category || '';
    els.alertCategory.style.color = 'inherit';
    els.alertMessage.textContent = EPA_MESSAGES[aqi.category] || 'Air quality information available.';
    els.alertMessage.style.color = 'var(--ink)';
    els.alertCard.style.background = 'var(--surface)';
  }
  els.alertCard.classList.remove('hidden');
}

/* ---------------- Cold / winter commentary (F5) ---------------- */
function computeCold(data) {
  const w = data.weather;
  if (w.windChillC === null && w.feelsLikeC === null) return null; // missing data → no guessed alert
  const value = w.windChillC !== null ? w.windChillC : w.feelsLikeC;
  const rule = COLD_RULES.find((r) => value <= r.max);
  return rule ? { value, measure: w.windChillC !== null ? 'WIND CHILL' : 'FEELS-LIKE', rule } : null;
}

function renderCold(data) {
  const cold = computeCold(data);
  if (!cold) { els.coldCard.classList.add('hidden'); return; }
  const pair = COLD_MESSAGES[cold.rule.level];
  els.coldMeasure.textContent = cold.measure;
  els.coldMessage.textContent = pair[lang];
  els.coldValue.textContent = `${Math.round(cold.value)}°C (${cold.measure.toLowerCase()} · measured ${Math.round(data.weather.tempC)}°C)`;
  els.coldTranslate.textContent = lang === 'hi' ? 'Translate to English' : 'Hinglish mein padho';
  els.coldCard.classList.remove('hidden');
}

/* ---------------- Rain forecast (F6) ---------------- */
function next24Hours(data) {
  const fc = data.forecast;
  if (!fc.available) return [];
  const currentHourPrefix = (data.location.localtime || '').slice(0, 13); // "2026-11-16 08"
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
    els.rainIssue.textContent = 'FORECAST UNAVAILABLE';
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

  // Hourly probability bars (probability, not certainty)
  els.rainBars.innerHTML = '';
  hours.forEach((h) => {
    const pct = h.chanceOfRain;
    const wrap = document.createElement('div');
    wrap.className = 'rain-bar' + (nextRain && h === nextRain ? ' next' : '');
    const label = document.createElement('span');
    label.className = 'pct';
    label.textContent = pct === null ? '?' : `${Math.round(pct)}%`;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = pct === null ? '3px' : `${Math.max(3, Math.round((pct / 100) * 68))}px`;
    const hr = document.createElement('span');
    hr.className = 'hr';
    hr.textContent = h.time ? h.time.slice(11) : '—';
    wrap.append(label, bar, hr);
    els.rainBars.appendChild(wrap);
  });

  els.rainIssue.textContent = `LOCAL TIME ${(data.location.localtime || '—').slice(11)}`;
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
      <img src="https:${d.icon || ''}" width="28" height="28" alt="" />
      <div class="d-cond">${d.condition || '—'}</div>
      <div class="d-temps">${d.maxTempC === null ? '?' : Math.round(d.maxTempC)}° / ${d.minTempC === null ? '?' : Math.round(d.minTempC)}°</div>
      <div class="d-rain">🌧 ${d.chanceOfRain === null ? '—' : Math.round(d.chanceOfRain) + '%'}</div>
    `;
    els.dailyList.appendChild(item);
  });
  els.dailyCard.classList.remove('hidden');
}

/* ---------------- Official warnings & storm indicators (F7) ---------------- */
function renderWarnings(data) {
  els.warningList.innerHTML = '';
  const alerts = data.alerts;
  if (!alerts || !alerts.available) {
    // Data rule: unavailable warning data must never read as "No warning".
    els.warningCard.classList.remove('hidden');
    els.warningList.innerHTML = '<p class="storm-unavailable">Storm warning data unavailable — the official warning feed could not be retrieved for this location.</p>';
    return;
  }
  if (alerts.warnings.length === 0) {
    els.warningCard.classList.remove('hidden');
    els.warningList.innerHTML = `<p class="storm-unavailable">No active official warnings (checked ${data.location.localtime || '—'} local time).</p>`;
    return;
  }
  alerts.warnings.forEach((w) => {
    const item = document.createElement('div');
    item.className = 'warning-item';
    const validity = [w.effectiveLocal, w.expiresLocal].filter(Boolean).join(' → ');
    item.innerHTML = `
      <div class="warning-event">⚠️ ${w.event || 'Weather warning'}</div>
      <div class="warning-meta">Severity: ${w.severity || '—'} · Areas: ${w.areas || '—'}</div>
      ${validity ? `<div class="warning-meta">Valid: ${validity} (local time)</div>` : ''}
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
    const hourNum = h.time ? parseInt(h.time.slice(11, 13), 10) : null;
    if (/thunder/.test(text)) {
      indicators.push(`⚡ Thunderstorm possible around ${h.time.slice(11)} — forecast indicator`);
    } else if (/heavy (rain|showers)/.test(text)) {
      indicators.push(`🌧 Heavy rain possible around ${h.time.slice(11)} — forecast indicator`);
    }
  });
  const gust = data.weather.windGustKph;
  if (gust !== null && gust >= 50) {
    indicators.push(`💨 High wind gusts up to ${Math.round(gust)} km/h — forecast indicator`);
  }

  if (indicators.length === 0) {
    els.stormCard.classList.add('hidden');
    return;
  }
  indicators.slice(0, 6).forEach((t) => {
    const p = document.createElement('p');
    p.className = 'storm-item';
    p.textContent = t;
    els.stormList.appendChild(p);
  });
  const note = document.createElement('p');
  note.className = 'storm-note';
  note.textContent = 'Forecast-based indicator only — not an official warning. Official warnings appear separately above.';
  els.stormList.appendChild(note);
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
  btn.addEventListener('click', () => {
    selectPlace(place);
  });
  return btn;
}

function selectPlace(place) {
  els.input.value = [place.name, place.region].filter(Boolean).join(', ');
  els.suggestions.classList.add('hidden');
  // Use stable coordinates rather than a possibly ambiguous name (FR-01 rule 8)
  fetchWeather(`${place.lat},${place.lon}`);
}

function renderSuggestions(payload, rawQuery) {
  els.suggestions.innerHTML = '';
  const hasIndia = payload.india && payload.india.length > 0;
  const hasGlobal = payload.global && payload.global.length > 0;

  if (!hasIndia && !hasGlobal) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = `Location not found. Try the district name or a nearby supported town.`;
    els.suggestions.appendChild(empty);
    els.suggestions.classList.remove('hidden');
    return;
  }

  if (hasIndia) {
    const lbl = document.createElement('div');
    lbl.className = 'group-label india';
    lbl.textContent = '🇮🇳 INDIA';
    els.suggestions.appendChild(lbl);
    payload.india.slice(0, 6).forEach((p) => els.suggestions.appendChild(placeButton(p)));
  }
  if (hasGlobal) {
    const lbl = document.createElement('div');
    lbl.className = 'group-label global';
    lbl.textContent = '🌍 GLOBAL';
    els.suggestions.appendChild(lbl);
    payload.global.slice(0, 6).forEach((p) => els.suggestions.appendChild(placeButton(p)));
  }
  els.suggestions.classList.remove('hidden');
}

async function runSearch(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderSuggestions(data, query);
  } catch {
    els.suggestions.innerHTML = '<p class="empty">Search service unavailable — you can still press SEARCH.</p>';
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
    // Enter with suggestions uses the first (best-ranked) result; otherwise raw query
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
    zl.textContent = zone.zone.toUpperCase();
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
  els.statesTitle.textContent = stateName.toUpperCase();
  els.statesGrid.classList.add('hidden');
  els.statePlaces.classList.remove('hidden');
  els.statePlacesTitle.textContent = `LOCALITIES IN ${stateName.toUpperCase()}`;
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
          if (pick) { els.statesModal.classList.add('hidden'); selectPlace(pick); }
          else { fetchWeather(`${placeName},India`); els.statesModal.classList.add('hidden'); }
        } catch {
          fetchWeather(`${placeName},India`);
          els.statesModal.classList.add('hidden');
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
  els.statesTitle.textContent = 'SELECT A STATE OR UNION TERRITORY';
  els.statesGrid.classList.remove('hidden');
  els.statePlaces.classList.add('hidden');
});
els.closeStates.addEventListener('click', () => els.statesModal.classList.add('hidden'));
els.backStates.addEventListener('click', () => {
  els.statePlaces.classList.add('hidden');
  els.statesGrid.classList.remove('hidden');
  els.statesTitle.textContent = 'SELECT A STATE OR UNION TERRITORY';
});
els.statesModal.addEventListener('click', (e) => {
  if (e.target === els.statesModal) els.statesModal.classList.add('hidden');
});

/* ============================================================
   Language toggle (F8)
   ============================================================ */

function setLang(next) {
  lang = next;
  els.langHi.classList.toggle('active', lang === 'hi');
  els.langEn.classList.toggle('active', lang === 'en');
  if (lastData) {
    // Re-render only message-bearing cards; data values stay untouched (FR-04 #3)
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
buildPopularStrip();
buildStatesGrid();
fetchWeather(DEFAULT_QUERY);
