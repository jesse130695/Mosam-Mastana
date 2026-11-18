/* ============================================================
   MOSAM MASTANA — Trip Planner logic (v1.7, FR-09)
   Night Radar · destination/day-range/group form · day-by-day
   outlook with forecast / extended-outlook / unavailable labels
   · deterministic weather-based packing rules · separate
   First-Aid & Travel Safety checklist · editable list.

   Data rules honoured here:
   - Provider dates only; no interpolated or invented weather values.
   - "Extended outlook" clearly labelled (future.json 14–300 days).
   - Missing rain probability on extended days → "Forecast unavailable".
   - No medicines, doses, diagnoses or personal health data.
   ============================================================ */

/* ---------------- Shared language preference ---------------- */
let lang = 'hi';
try { lang = localStorage.getItem('mm-lang') === 'en' ? 'en' : 'hi'; } catch { /* ignore */ }

const els = (id) => document.getElementById(id);
const ui = {
  dest: els('trip-destination'), destSug: els('trip-suggestions'),
  start: els('trip-start'), ret: els('trip-return'),
  modeReturn: els('mode-return'), modeDays: els('mode-days'), daysCount: els('trip-days-count'),
  durationLine: els('duration-line'),
  groupType: els('group-type'), adults: els('adults'), children: els('children'),
  adultsMinus: els('adults-minus'), adultsPlus: els('adults-plus'),
  childrenMinus: els('children-minus'), childrenPlus: els('children-plus'),
  ageBandsRow: els('age-bands-row'), ageBands: els('age-bands'),
  activity: els('activity'),
  form: els('trip-form'), generate: els('trip-generate'),
  status: els('trip-status'), statusMsg: els('trip-status-message'),
  results: els('trip-results'), empty: els('trip-empty'),
  summary: els('trip-summary'), meta: els('trip-meta'),
  days: els('trip-days'), refresh: els('trip-refresh'),
  itemsClothing: els('items-clothing'), itemsEquipment: els('items-equipment'),
  itemsFirstaid: els('items-firstaid'), itemsProtection: els('items-protection'),
  firstaidNotes: els('firstaid-notes'), safetyNotes: els('safety-notes'),
  langHi: els('lang-hi'), langEn: els('lang-en'),
};

/* ---------------- Form state ---------------- */
let selectedPlace = null;
let returnMode = 'return';   // 'return' | 'days'
let tripData = null;         // last /api/trip response
let checklist = [];          // {id, category, en, hi, reason, packed, personal}

/* ============================================================
   Helpers
   ============================================================ */
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const fmtDate = (iso) => {
  try { return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return iso; }
};
const fmtNum = (v, unit = '') => (v === null || v === undefined ? 'Forecast unavailable' : `${Math.round(v)}${unit}`);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showStatus(msg) {
  ui.statusMsg.textContent = msg;
  ui.status.classList.remove('hidden');
  ui.results.classList.add('hidden');
  ui.empty.classList.add('hidden');
}
function hideStatus() { ui.status.classList.add('hidden'); }

/* ============================================================
   Destination search — reuse India-first /api/search (FR-01)
   ============================================================ */
let searchTimer = null;

function suggestionButton(place) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'suggestion';
  btn.innerHTML = `<span class="s-name">${escapeHtml(place.name)}</span><span class="s-context">${escapeHtml(place.context || place.country || '')}</span>`;
  btn.addEventListener('click', () => {
    selectedPlace = place;
    ui.dest.value = [place.name, place.region].filter(Boolean).join(', ');
    ui.destSug.classList.add('hidden');
    ui.dest.classList.remove('invalid');
  });
  return btn;
}

function renderDestSuggestions(payload) {
  ui.destSug.innerHTML = '';
  const hasIndia = payload.india && payload.india.length > 0;
  const hasGlobal = payload.global && payload.global.length > 0;
  if (!hasIndia && !hasGlobal) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Location not found. Try the district name or a nearby supported town.';
    ui.destSug.appendChild(p);
    ui.destSug.classList.remove('hidden');
    return;
  }
  if (hasIndia) {
    const lbl = document.createElement('div');
    lbl.className = 'group-label';
    lbl.textContent = 'India';
    ui.destSug.appendChild(lbl);
    payload.india.slice(0, 6).forEach((p) => ui.destSug.appendChild(suggestionButton(p)));
  }
  if (hasGlobal) {
    const lbl = document.createElement('div');
    lbl.className = 'group-label global';
    lbl.textContent = 'Search worldwide';
    ui.destSug.appendChild(lbl);
    payload.global.slice(0, 6).forEach((p) => ui.destSug.appendChild(suggestionButton(p)));
  }
  ui.destSug.classList.remove('hidden');
}

ui.dest.addEventListener('input', () => {
  selectedPlace = null;
  clearTimeout(searchTimer);
  const q = ui.dest.value.trim();
  if (q.length < 2) { ui.destSug.classList.add('hidden'); return; }
  searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      renderDestSuggestions(await res.json());
    } catch {
      ui.destSug.innerHTML = '<p class="empty">Search service unavailable — try again.</p>';
      ui.destSug.classList.remove('hidden');
    }
  }, 350);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#trip-destination') && !e.target.closest('#trip-suggestions')) {
    ui.destSug.classList.add('hidden');
  }
});

/* ============================================================
   Dates: return date ↔ duration, one drives the other
   ============================================================ */
ui.modeReturn.addEventListener('click', () => setReturnMode('return'));
ui.modeDays.addEventListener('click', () => setReturnMode('days'));

function setReturnMode(mode) {
  returnMode = mode;
  ui.modeReturn.classList.toggle('active', mode === 'return');
  ui.modeDays.classList.toggle('active', mode === 'days');
  ui.ret.classList.toggle('hidden', mode !== 'return');
  ui.daysCount.classList.toggle('hidden', mode !== 'days');
  updateDurationLine();
}

function readGroup() {
  const adults = Math.max(0, Math.min(20, parseInt(ui.adults.value, 10) || 0));
  const children = Math.max(0, Math.min(20, parseInt(ui.children.value, 10) || 0));
  return { adults, children };
}

function activeSegment(groupEl) {
  const active = groupEl.querySelector('.seg-option.active');
  return active ? active.dataset.value : '';
}

function updateDurationLine() {
  const start = ui.start.value;
  let end = null;
  let days = null;
  if (start) {
    if (returnMode === 'return' && ui.ret.value) {
      end = ui.ret.value;
      days = end < start ? null : daysBetween(start, end) + 1;
    } else if (returnMode === 'days' && ui.daysCount.value) {
      days = Math.min(Math.max(parseInt(ui.daysCount.value, 10) || 0, 0), 30);
      end = addDaysISO(start, days - 1);
    }
  }
  if (!start) { ui.durationLine.textContent = 'Trip length will appear here after dates are set.'; return; }
  if (days === null || days < 1) {
    ui.durationLine.textContent = 'Return date cannot be earlier than the departure date.';
    return;
  }
  const nights = days - 1;
  const g = readGroup();
  ui.durationLine.textContent =
    `${days} day${days === 1 ? '' : 's'} · ${nights} night${nights === 1 ? '' : 's'} — ${fmtDate(start)} → ${fmtDate(end)} · ${g.adults + g.children} traveller${g.adults + g.children === 1 ? '' : 's'} (${g.adults} adult${g.adults === 1 ? '' : 's'}, ${g.children} child${g.children === 1 ? '' : 'ren'})`;
}

ui.start.addEventListener('change', () => {
  ui.start.min = todayISO();
  updateDurationLine();
});
ui.ret.addEventListener('change', updateDurationLine);
ui.daysCount.addEventListener('input', updateDurationLine);
ui.adults.addEventListener('input', updateDurationLine);
ui.children.addEventListener('input', updateDurationLine);

/* Steppers */
function bindStepper(input, minusBtn, plusBtn, min, onChange) {
  const set = (v) => {
    input.value = Math.max(min, Math.min(20, v));
    onChange();
  };
  minusBtn.addEventListener('click', () => set((parseInt(input.value, 10) || min) - 1));
  plusBtn.addEventListener('click', () => set((parseInt(input.value, 10) || min) + 1));
}
bindStepper(ui.adults, ui.adultsMinus, ui.adultsPlus, 0, () => { updateDurationLine(); updateAgeBands(); });
bindStepper(ui.children, ui.childrenMinus, ui.childrenPlus, 0, () => { updateDurationLine(); updateAgeBands(); });

/* Age bands visible only when children > 0 (optional, never blocking) */
function updateAgeBands() {
  const g = readGroup();
  ui.ageBandsRow.classList.toggle('hidden', g.children === 0);
  if (g.children === 0) {
    ui.ageBands.querySelectorAll('.seg-option').forEach((b) => b.classList.remove('active'));
  }
}

/* Generic segmented-control wiring */
function wireSegments(groupEl) {
  groupEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-option');
    if (!btn) return;
    const multi = groupEl === ui.ageBands;
    if (multi) {
      btn.classList.toggle('active');
    } else {
      groupEl.querySelectorAll('.seg-option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
}
wireSegments(ui.groupType);
wireSegments(ui.ageBands);
wireSegments(ui.activity);

/* ============================================================
   Fetch trip outlook
   ============================================================ */
ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  generateTrip();
});
ui.refresh.addEventListener('click', generateTrip);

function validateForm() {
  const problems = [];
  if (!selectedPlace) {
    problems.push('Choose a destination from the search suggestions.');
    ui.dest.classList.add('invalid');
  } else {
    ui.dest.classList.remove('invalid');
  }
  const start = ui.start.value;
  if (!start) problems.push('Select a departure date.');
  if (start && start < todayISO()) problems.push('Departure date cannot be in the past.');

  let days = null;
  if (returnMode === 'return') {
    if (!ui.ret.value) problems.push('Enter a return date, or switch to "Trip days".');
    else if (ui.ret.value < start) problems.push('Return date cannot be earlier than the departure date.');
    else days = daysBetween(start, ui.ret.value) + 1;
  } else {
    days = parseInt(ui.daysCount.value, 10);
    if (!days || days < 1) problems.push('Enter the number of trip days (1–30), or switch to "Return date".');
    else days = Math.min(days, 30);
  }

  const g = readGroup();
  if (g.adults + g.children < 1) problems.push('Add at least one traveller (adult or child).');

  return { problems, start, days, group: g };
}

async function generateTrip() {
  const v = validateForm();
  if (v.problems.length) {
    showStatus(v.problems.join(' '));
    return;
  }
  hideStatus();
  ui.generate.disabled = true;
  ui.generate.textContent = 'Fetching outlook…';
  ui.days.innerHTML = '';
  try {
    const q = `${selectedPlace.lat},${selectedPlace.lon}`;
    const res = await fetch(`/api/trip?q=${encodeURIComponent(q)}&start=${v.start}&days=${v.days}`);
    const data = await res.json();
    if (!res.ok) {
      showStatus(data.message || 'Could not fetch the trip outlook. Please try again.');
      return;
    }
    tripData = data;
    renderTrip(data, { start: v.start, days: v.days, group: v.group, activity: activeSegment(ui.activity), ageBands: [...ui.ageBands.querySelectorAll('.seg-option.active')].map((b) => b.dataset.value) });
  } catch {
    showStatus('Network error. Could not fetch the trip outlook. Check your connection and try again.');
  } finally {
    ui.generate.disabled = false;
    ui.generate.textContent = 'Generate trip outlook & packing list';
  }
}

/* ============================================================
   Rendering: trip outlook
   ============================================================ */
function renderTrip(data, formVals) {
  buildChecklist(data.days, formVals);

  // Overall summary — only from returned values (FR-09 certainty rule)
  ui.summary.textContent = buildSummarySentence(data.days);
  ui.results.classList.remove('hidden');
  ui.empty.classList.add('hidden');

  const g = formVals.group;
  const range = data.forecastRange || {};
  const covered = data.days.filter((d) => d.status !== 'unavailable').length;
  ui.meta.innerHTML = `
    <span>Destination: <strong>${escapeHtml([data.location?.name, data.location?.region].filter(Boolean).join(', ') || selectedPlace.name)}</strong></span>
    <span>Group: <strong>${g.adults + g.children}</strong> (${g.adults} adult${g.adults === 1 ? '' : 's'}, ${g.children} child${g.children === 1 ? '' : 'ren'})${formVals.activity ? ` · <strong>${escapeHtml(labelActivity(formVals.activity))}</strong>` : ''}</span>
    <span>Source: <strong>${escapeHtml(data.source || 'WeatherAPI.com')}</strong></span>
    <span>Provider forecast horizon: <strong>${range.horizonDays ?? '—'} days</strong> (${range.first || '—'} → ${range.last || '—'})</span>
    <span>Covered: <strong>${covered}/${data.days.length}</strong> trip days</span>
    <span>Updated: <strong>${escapeHtml((data.fetchedAt || '').replace('T', ' ').slice(0, 16))} UTC</strong></span>
  `;

  renderTripDays(data.days);
  renderChecklist();
}

function labelActivity(v) {
  return { sightseeing: 'Sightseeing', road: 'Road Trip', trekking: 'Trekking / Outdoor' }[v] || 'General';
}

function buildSummarySentence(days) {
  const parts = [];
  const covered = days.filter((d) => d.status !== 'unavailable' && d.minTempC !== null);
  if (covered.length) {
    const minOfMin = Math.min(...covered.map((d) => d.minTempC));
    const maxOfMax = Math.max(...covered.map((d) => d.maxTempC ?? -Infinity));
    if (minOfMin <= 10) parts.push(`Cold mornings/nights (down to ${Math.round(minOfMin)}°C)`);
    else if (minOfMin <= 18) parts.push(`Cool mornings (down to ${Math.round(minOfMin)}°C)`);
    else parts.push(`Mild mornings (min around ${Math.round(minOfMin)}°C)`);
    if (maxOfMax !== -Infinity) parts.push(`daytime up to ${Math.round(maxOfMax)}°C`);
    const rainDays = covered
      .filter((d) => (d.chanceOfRain ?? 0) >= 40 || (d.totalPrecipMm ?? 0) >= 1)
      .map((d) => `Day ${days.indexOf(d) + 1}`);
    if (rainDays.length) parts.push(`a rain chance on ${rainDays.join(', ')}`);
    const snowDays = covered
      .filter((d) => (d.chanceOfSnow ?? 0) >= 30 || /snow|blizzard/i.test(d.condition || ''))
      .map((d) => `Day ${days.indexOf(d) + 1}`);
    if (snowDays.length) parts.push(`possible snow on ${snowDays.join(', ')}`);
    const gusty = covered.filter((d) => (d.maxWindKph ?? 0) >= 35);
    if (gusty.length) parts.push(`strong winds up to ${Math.round(Math.max(...gusty.map((d) => d.maxWindKph)))} km/h`);
  }
  const missing = days.filter((d) => d.status === 'unavailable').map((d) => `Day ${days.indexOf(d) + 1}`);
  if (missing.length) parts.push(`forecast not available yet for ${missing.join(', ')} — check again closer to departure`);

  return parts.length ? `Outlook: ${parts.join('; ')}.` : 'Outlook could not be determined from the returned forecast data.';
}

function renderTripDays(days) {
  ui.days.innerHTML = '';
  days.forEach((d, i) => {
    const row = document.createElement('div');
    const cls = ['trip-day'];
    let labelText = d.label || 'Forecast';
    if (d.status === 'extended') { cls.push('extended'); labelText = 'Extended outlook'; }
    else if (d.status === 'unavailable') { cls.push('unavailable'); labelText = 'Forecast not available yet'; }
    row.className = cls.join(' ');

    const dateBits = `
      <div>
        <div class="td-date">Day ${i + 1}</div>
        <div class="td-sub">${fmtDate(d.date)}</div>
      </div>`;

    if (d.status === 'unavailable') {
      row.innerHTML = `${dateBits}
        <span class="td-label unavail">Not yet</span>
        <div class="td-temps-wrap">
          <div class="td-meta">Forecast not available yet — this date is beyond the provider's range. No values are estimated. Check again closer to departure.</div>
        </div>`;
      ui.days.appendChild(row);
      return;
    }

    const chanceRain = d.chanceOfRain === null || d.chanceOfRain === undefined
      ? 'Rain chance: Forecast unavailable'
      : `Rain chance: ${Math.round(d.chanceOfRain)}%`;
    const precip = d.totalPrecipMm === null || d.totalPrecipMm === undefined
      ? 'Amount: Forecast unavailable'
      : `Amount: ${d.totalPrecipMm} mm`;
    const snow = (d.chanceOfSnow ?? 0) >= 30 || /snow|blizzard/i.test(d.condition || '')
      ? `<span class="sep">·</span> Snow: ${d.chanceOfSnow === null || d.chanceOfSnow === undefined ? 'Forecast unavailable' : Math.round(d.chanceOfSnow) + '%'}`
      : '';
    const wind = d.maxWindKph === null || d.maxWindKph === undefined
      ? ''
      : `<span class="sep">·</span> Wind up to ${Math.round(d.maxWindKph)} km/h`;
    const feels = d.avgTempC !== null && d.avgTempC !== undefined ? `<span class="sep">·</span> Avg ${Math.round(d.avgTempC)}°C` : '';

    const labelCls = d.status === 'extended' ? 'td-label ext' : 'td-label';
    row.innerHTML = `${dateBits}
      <span class="${labelCls}">${labelText}</span>
      <div class="td-temps-wrap">
        <div class="td-temps num">${d.maxTempC === null ? '—' : Math.round(d.maxTempC)}° / ${d.minTempC === null ? '—' : Math.round(d.minTempC)}°C</div>
        <div class="td-meta">${escapeHtml(d.condition || '—')}${feels}</div>
        <div class="td-meta num">${chanceRain}<span class="sep">·</span>${precip}${snow}${wind}</div>
      </div>`;
    if (d.status === 'extended') {
      const note = document.createElement('div');
      note.className = 'td-meta';
      note.style.gridColumn = '1 / -1';
      note.textContent = 'Extended outlook — longer-range weather is less certain and may change. Not a guaranteed day-by-day forecast.';
      row.appendChild(note);
    }
    ui.days.appendChild(row);
  });
}

/* ============================================================
   Packing rules (deterministic, testable — FR-09)
   Each suggestion carries a traceable reason from returned fields.
   ============================================================ */
const dayRef = (idx) => `Day ${idx + 1}`;

function ruleMatches(days, test) {
  const hits = [];
  days.forEach((d, i) => {
    if (d.status === 'unavailable') return;
    const reason = test(d);
    if (reason) hits.push({ idx: i, reason });
  });
  return hits;
}

function reasonText(hits, formatter) {
  return formatter
    ? formatter(hits)
    : `${hits.map((h) => dayRef(h.idx)).join(', ')} — ${hits[0].reason}`;
}

function buildChecklist(days, formVals) {
  checklist = [];
  const g = formVals.group;
  const activity = formVals.activity;
  let idc = 0;
  const add = (category, en, hi, reason) => checklist.push({
    id: `it${idc++}`, category, en, hi, reason, packed: false,
  });

  const covered = days.map((d, i) => ({ d, i })).filter((x) => x.d.status !== 'unavailable');
  const mins = covered.map((x) => x.d.minTempC).filter((v) => v !== null && v !== undefined);
  const maxes = covered.map((x) => x.d.maxTempC).filter((v) => v !== null && v !== undefined);
  const minTemp = mins.length ? Math.min(...mins) : null;
  const maxTemp = maxes.length ? Math.max(...maxes) : null;

  /* ---- Clothing (PRD 6.1 clothing table) ---- */
  const coldHits = ruleMatches(days, (d) =>
    d.minTempC !== null && d.minTempC <= 12 ? `min temperature ${Math.round(d.minTempC)}°C` : null);
  if (coldHits.length) add('clothing', 'Warm / insulated jacket', 'Garam jacket — thand rokne wali jacket',
    reasonText(coldHits, (h) => `Low minimum on ${h.map((x) => dayRef(x.idx)).join(', ')} (${h[0].reason})`));

  const thermalHits = ruleMatches(days, (d) =>
    d.minTempC !== null && d.minTempC <= 8 ? `min temperature ${Math.round(d.minTempC)}°C` : null);
  if (thermalHits.length) add('clothing', 'Thermal base layers', 'Thermals — andar pehenne wale garam kapde',
    reasonText(thermalHits, (h) => `Cold mornings/nights on ${h.map((x) => dayRef(x.idx)).join(', ')}`));

  const sockHits = ruleMatches(days, (d) =>
    d.minTempC !== null && d.minTempC <= 12 ? `min temperature ${Math.round(d.minTempC)}°C` : null);
  if (sockHits.length) add('clothing', 'Woollen socks', 'Oon ke moze',
    reasonText(sockHits, (h) => `Cold conditions on ${h.map((x) => dayRef(x.idx)).join(', ')}`));

  const gloveHits = ruleMatches(days, (d) =>
    (d.minTempC !== null && d.minTempC <= 8) ? `min temperature ${Math.round(d.minTempC)}°C`
      : (d.maxWindKph !== null && d.maxWindKph >= 25) ? `wind up to ${Math.round(d.maxWindKph)} km/h` : null);
  if (gloveHits.length) add('clothing', 'Gloves and warm cap', 'Dastane aur garam topi',
    reasonText(gloveHits, (h) => `${h.map((x) => dayRef(x.idx)).join(', ')} — ${h[0].reason}`));

  const rainHits = ruleMatches(days, (d) => {
    if (d.chanceOfRain !== null && d.chanceOfRain >= 40) return `rain chance ${Math.round(d.chanceOfRain)}%`;
    if (d.totalPrecipMm !== null && d.totalPrecipMm >= 1) return `expected rain ${d.totalPrecipMm} mm`;
    return null;
  });
  if (rainHits.length) {
    add('clothing', 'Waterproof jacket / raincoat', 'Baarish se bachne wali jacket / raincoat',
      reasonText(rainHits, (h) => `Rain expected on ${h.map((x) => dayRef(x.idx)).join(', ')}`));
    add('clothing', 'Waterproof footwear', 'Paani na ghusne wale jootey',
      reasonText(rainHits, (h) => `Rain / wet ground on ${h.map((x) => dayRef(x.idx)).join(', ')}`));
  }

  const heatHits = ruleMatches(days, (d) => {
    if (d.maxTempC !== null && d.maxTempC >= 33) return `max temperature ${Math.round(d.maxTempC)}°C`;
    if (d.uv !== null && d.uv >= 7) return `UV index ${d.uv}`;
    return null;
  });
  if (heatHits.length) add('clothing', 'Light breathable clothing + sun cap', 'Hawa-daar halke kapde aur dhoop wali topi',
    reasonText(heatHits, (h) => `Hot / high-UV on ${h.map((x) => dayRef(x.idx)).join(', ')}`));

  const windHits = ruleMatches(days, (d) =>
    d.maxWindKph !== null && d.maxWindKph >= 35 ? `wind up to ${Math.round(d.maxWindKph)} km/h` : null);
  if (windHits.length) add('clothing', 'Windcheater / windproof layer', 'Hawa rokne wali jacket',
    reasonText(windHits, (h) => `Strong wind on ${h.map((x) => dayRef(x.idx)).join(', ')}`));

  const snowHits = ruleMatches(days, (d) => {
    if (d.chanceOfSnow !== null && d.chanceOfSnow >= 30) return `snow chance ${Math.round(d.chanceOfSnow)}%`;
    if (/snow|blizzard/i.test(d.condition || '')) return `forecast: ${d.condition}`;
    return null;
  });
  if (snowHits.length) {
    add('clothing', 'Warm waterproof layers', 'Garam waterproof kapde',
      reasonText(snowHits, (h) => `Snow/ice conditions on ${h.map((x) => dayRef(x.idx)).join(', ')}`));
    add('equipment', 'Grip footwear', 'Phisalne se bachne wali grip ke jootey',
      reasonText(snowHits, (h) => `Snow/ice conditions on ${h.map((x) => dayRef(x.idx)).join(', ')}`));
  }

  /* Children present → simple general additions (no medical/child-specific advice) */
  if (g.children > 0 && (rainHits.length || coldHits.length)) {
    const bands = (formVals.ageBands || []).join(', ');
    add('clothing', `Extra dry layer for each child (${g.children})`, 'Har bachche ke liye ek extra dry layer',
      `${g.children} child${g.children === 1 ? '' : 'ren'} in group${bands ? ` (age band${formVals.ageBands.length === 1 ? '' : 's'}: ${bands})` : ''} · ${rainHits.length ? 'wet' : 'cold'} conditions forecast`);
    add('clothing', `Spare socks for children (${g.children})`, 'Bachchon ke liye extra moze',
      `${g.children} child${g.children === 1 ? '' : 'ren'} in group · ${rainHits.length ? 'wet' : 'cold'} conditions forecast`);
  }

  /* ---- Tools & Equipment (PRD equipment table) ---- */
  if (rainHits.length) {
    add('equipment', 'Umbrella', 'Chhata',
      reasonText(rainHits, (h) => `Rain expected on ${h.map((x) => dayRef(x.idx)).join(', ')}`));
    add('equipment', 'Backpack rain cover', 'Bag ko baarish se bachane wala cover',
      reasonText(rainHits, (h) => `Rain expected on ${h.map((x) => dayRef(x.idx)).join(', ')}`));
  }
  if (heatHits.length) {
    add('equipment', 'Sunglasses', 'Dhoop ka chashma',
      reasonText(heatHits, (h) => `Strong sun / high UV on ${h.map((x) => dayRef(x.idx)).join(', ')}`));
  }
  if (g.children > 0) {
    add('equipment', "Small daypack for children's snacks & spares", 'Bachchon ke saamaan ke liye chhota bag',
      `${g.children} child${g.children === 1 ? '' : 'ren'} in group — carry spares easily`);
  }

  /* General trip essentials */
  add('equipment', 'Reusable water bottle', 'Baar-baar bharne wali paani ki bottle', 'General trip essential');
  add('equipment', 'Power bank', 'Phone charge rakhne wali battery', 'General trip essential');
  add('equipment', 'Compact travel first-aid kit', 'Safar ke liye chhota first-aid kit', 'General trip essential — see First-Aid & Travel Safety below');
  if (coldHits.length || activity === 'trekking') {
    add('equipment', 'Emergency blanket', 'Emergency blanket — bahar rukne par garam rakhne wali sheet',
      coldHits.length ? `Cold conditions (min ${minTemp === null ? '—' : Math.round(minTemp)}°C)` : 'Outdoor activity selected');
  }
  if (activity === 'trekking') {
    add('equipment', 'Trekking pole', 'Chadhai/trek ke liye walking stick', 'Trekking / Outdoor activity selected');
    add('equipment', 'Headlamp / torch', 'Sir par lagne wali light / torch', 'Trekking / Outdoor activity selected');
  }

  /* ---- Health & Outdoor Protection ---- */
  if (heatHits.length) {
    add('protection', 'Sunscreen', 'Dhoop se bachne wali cream',
      reasonText(heatHits, (h) => `Strong sun / high UV on ${h.map((x) => dayRef(x.idx)).join(', ')} — follow product label`));
  }
  if (activity === 'trekking' || rainHits.length || (maxTemp !== null && maxTemp >= 25)) {
    add('protection', 'Insect repellent', 'Insect se bachne wali cream/spray',
      `${activity === 'trekking' ? 'Outdoor activity selected' : 'Warm/wet outdoor conditions'} — follow product label`);
  }

  /* ---- First-Aid & Travel Safety baseline (12 non-medicine items) ---- */
  const FA = [
    ['Adhesive bandages / plasters', 'Band-aid / chhoti chot par chipkane wali patti', 'For covering minor cuts and scrapes'],
    ['Sterile gauze pads', 'Saaf sterile gauze patti', 'For covering minor wounds'],
    ['Medical adhesive tape', 'Medical tape / patti chipkane wali tape', 'To secure dressings'],
    ['Antiseptic wipes', 'Antiseptic wipes / chot saaf karne wale wipes', 'For basic wound-cleaning supplies; follow product instructions'],
    ['Non-stick wound dressing', 'Zakhm par chipke bina lagne wali dressing', 'For covering a wound without the pad sticking'],
    ['Disposable non-latex gloves', 'Ek baar istemaal hone wale gloves', 'Basic barrier protection when helping with a wound'],
    ['Elastic bandage', 'Crepe bandage / lachili patti', 'For basic support — not a treatment for serious injury'],
    ['Digital thermometer', 'Digital bukhar naapne wala thermometer', 'General travel-health item; not a diagnostic feature'],
    ['Tweezers', 'Chhoti chimti', 'For superficial splinters only; do not remove embedded objects'],
    ['Hand sanitiser', 'Haath saaf karne ka sanitiser', 'General hygiene item'],
    ['Oral rehydration salts (ORS) sachets', 'ORS / paani mein gholne wala solution', 'Optional travel-health supply; follow packet instructions'],
  ];
  FA.forEach(([en, hi, note]) => add('firstaid', en, hi, note));

  /* Context-aware first-aid additions (activity / trip duration) */
  const tripDaysN = days.length;
  if (activity === 'trekking') {
    add('firstaid', 'Blister plasters', 'Chhale se bachane wali patti', 'Suggested because you selected Trekking / Outdoor — long walking or new footwear');
    add('firstaid', 'Small first-aid pouch', 'Chhota first-aid pouch', 'Suggested because you selected Trekking / Outdoor — keeps supplies together');
  } else if (tripDaysN >= 4) {
    add('firstaid', 'Blister plasters', 'Chhale se bachane wali patti', `${tripDaysN}-day trip with likely walking — helpful for new footwear`);
  }
  if (g.children > 0) {
    add('firstaid', 'Child-appropriate supply check (parent/guardian)', 'Bachchon ke liye samaan suitable hai ya nahi — khud check karein',
      `${g.children} child${g.children === 1 ? '' : 'ren'} in group — check that the kit and any personal medicines suit the child's age and needs`);
  }

  /* First-aid notes (context-aware, non-medical) */
  const faNotes = [];
  faNotes.push('Pack your regular prescribed medicines and any personal medical supplies you already use. · Apni roz ki prescribed dawaai aur zaroori personal medical samaan saath rakhna.');
  if (rainHits.length) faNotes.push('Rain is forecast — store first-aid supplies in a waterproof pouch or dry bag.');
  if (tripDaysN >= 5) faNotes.push('Longer trip — check kit completeness and restock anything used, before departure.');
  renderFirstAidNotes(faNotes);
}

function renderFirstAidNotes(notes) {
  ui.firstaidNotes.innerHTML = '';
  const ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8h.01M12 11v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  notes.forEach((t) => {
    const div = document.createElement('div');
    div.className = 'safety-note';
    div.innerHTML = `${ICON}<span>${escapeHtml(t)}</span>`;
    ui.firstaidNotes.appendChild(div);
  });
}

/* ============================================================
   Checklist rendering & editing
   ============================================================ */
const CATEGORIES = [
  { key: 'clothing', node: () => ui.itemsClothing },
  { key: 'equipment', node: () => ui.itemsEquipment },
  { key: 'firstaid', node: () => ui.itemsFirstaid },
  { key: 'protection', node: () => ui.itemsProtection },
];

function renderChecklist() {
  CATEGORIES.forEach(({ key, node }) => {
    const host = node();
    host.innerHTML = '';
    checklist.filter((it) => it.category === key).forEach((it) => host.appendChild(itemRow(it)));
  });
  renderSafetyNotes();
}

function itemRow(it) {
  const row = document.createElement('div');
  row.className = 'pack-item' + (it.packed ? ' packed' : '');
  const name = lang === 'hi' && it.hi ? it.hi : it.en;
  row.innerHTML = `
    <input type="checkbox" class="tick" ${it.packed ? 'checked' : ''} aria-label="Mark packed" />
    <div class="pi-main">
      <div class="pi-name">${escapeHtml(name)}</div>
      ${(lang === 'hi' ? it.en : it.hi) ? `<div class="pi-hi">${escapeHtml(lang === 'hi' ? it.en : it.hi)}</div>` : ''}
      <div class="pi-reason">${escapeHtml(it.reason)}</div>
    </div>
    <button type="button" class="rm" aria-label="Remove ${escapeHtml(name)}">✕</button>`;
  row.querySelector('.tick').addEventListener('change', (e) => {
    it.packed = e.target.checked;
    row.classList.toggle('packed', it.packed);
  });
  row.querySelector('.rm').addEventListener('click', () => {
    checklist = checklist.filter((x) => x.id !== it.id);
    renderChecklist();
  });
  return row;
}

function renderSafetyNotes() {
  ui.safetyNotes.innerHTML = '';
  const notes = [
    'A first-aid kit is for basic preparation and minor incidents — not emergencies. For serious injury, severe symptoms or urgent concerns, contact local emergency services (India: 112) or seek professional medical help.',
    'Check expiry dates, replace used supplies and follow product instructions on every item.',
    'Small scissors, tweezers and other sharp items may be restricted in aircraft cabin baggage — check current airline, airport and destination rules before packing them.',
    'This checklist is a general prompt, not an exhaustive list, and never a substitute for professional medical care.',
  ];
  const ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9.5v4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1" fill="currentColor"/></svg>';
  notes.forEach((t) => {
    const div = document.createElement('div');
    div.className = 'safety-note';
    div.innerHTML = `${ICON}<span>${escapeHtml(t)}</span>`;
    ui.safetyNotes.appendChild(div);
  });
}

/* Add personal items (per category, generic — no health data collected) */
document.querySelectorAll('.add-personal').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    const cat = input.dataset.cat;
    const text = input.value.trim();
    if (!text) return;
    checklist.push({ id: `p${Date.now()}`, category: cat, en: text, hi: '', reason: 'Added by you', packed: false, personal: true });
    input.value = '';
    renderChecklist();
  });
});

/* ============================================================
   Language toggle — shared localStorage key with dashboard
   ============================================================ */
function setLang(next) {
  lang = next;
  try { localStorage.setItem('mm-lang', next); } catch { /* ignore */ }
  ui.langHi.classList.toggle('active', lang === 'hi');
  ui.langEn.classList.toggle('active', lang === 'en');
  if (tripData) renderChecklist(); // item names only — forecast values unchanged
}
ui.langHi.addEventListener('click', () => setLang('hi'));
ui.langEn.addEventListener('click', () => setLang('en'));
ui.langHi.classList.toggle('active', lang === 'hi');
ui.langEn.classList.toggle('active', lang === 'en');

/* Boot defaults */
ui.start.min = todayISO();
ui.ret.min = todayISO();
