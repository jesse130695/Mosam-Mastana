# MOSAM MASTANA 🌧️🌙

**Weather, Air Quality, Forecast & Trip Preparation Platform** — real-time weather, Indian AQI (CPCB), a location-map/radar module, cold commentary, rain forecast, official warnings **and a Trip Planner with weather-based packing + a First-Aid & Travel Safety checklist**.

**Design theme (PRD v1.7): Night Radar** — dark-first, radar-led, data-focused. Midnight Navy `#071827` canvas, Deep Ocean `#0C2238` cards, Harbour Blue `#102A43` raised surfaces, Radar Slate `#173A58`, Ocean Line `#24465F`, Signal Cyan `#31C7E8` accent, Current Blue `#3798F5` (rain/radar), Radar Amber `#FFC857` (attention), Frost Lilac `#B9A8FF` (winter), Storm Coral `#FF766B` on Deep Brick `#3D2026` (official warnings only). Typography: Manrope (headings/numeric, tabular) + Inter (body) + Noto Sans Devanagari (Hinglish/Hindi). Weather-responsive accent modes (clear / rain / cold / heat / storm) change only a few accents; AQI semantic colours stay fixed; most of the screen stays calm and dark.

## Features (PRD v1.7)

**Dashboard**
- **F1 India-first location search** — popular Indian city chips, States/UTs browsing, city/state/district/town/village search with Indian matches grouped before global matches; selection uses exact coordinates.
- **F2 Current weather hero** — temperature, feels-like, condition, humidity, wind/gust, UV, visibility, pressure, local observation time.
- **F3 Indian AQI (CPCB)** — CPCB National AQI computed server-side from PM2.5/PM10 breakpoints; PM2.5/PM10 and dominant pollutant; dark-tinted semantic chips. Non-Indian locations show the clearly labelled US EPA index — never presented as Indian AQI.
- **F4 Pollution alerts** — "Mask laga lo bhai!" at AQI 201+, full Hinglish/English message pairs.
- **F5 Cold commentary** — feels-like / wind-chill thresholds (≤5 / ≤10 / ≤18 °C), Hinglish ↔ English toggle, measured temperature always visible.
- **F6 Rain forecast** — 24-hour hourly rain-chance bars (Current Blue), next rain period, probability and amount shown separately; missing values show "Forecast unavailable".
- **F7 Storm awareness** — forecast-based indicators (thunderstorm / heavy rain / high gusts) kept visually distinct from official warnings; Deep Brick warning panel shown **only when an active warning exists**; unavailable warning data never displays as "No Warning".
- **F9 Radar / location map** — Leaflet + OpenStreetMap as a clearly labelled **"Location map"** fallback; a live precipitation overlay will only appear after a validated radar provider is integrated. No fake sweeps, rings or precipitation patches.

**Trip Planner (`trip.html`)** — separate flow on the same Night Radar system
- **F10** destination via the same India-first search (coordinates), departure date, return date **or** trip days (1–30) with automatic duration/nights calculation (same-day = 1 day, 0 nights), traveller type, adults + children steppers, optional child age bands (0–2 / 3–5 / 6–12 / 13–17, hidden when no children), optional activity (Sightseeing / Road Trip / Trekking).
- **Day-by-day outlook** with provider-verified data: dates within the 14-day forecast horizon are labelled **Forecast**; dates beyond it use WeatherAPI `future.json` (14–300 days) labelled **Extended outlook** with an uncertainty note; anything further shows **"Forecast not available yet"** — no values are ever invented or interpolated. Extended days show "Forecast unavailable" for rain probability the provider doesn't supply.
- **Weather-based packing assistant** — deterministic rules traceable to returned data (jacket ≤12 °C, thermals ≤8 °C, gloves+cap ≤8 °C or wind ≥25 km/h, rain ≥40% or ≥1 mm, heat ≥33 °C or UV ≥7, windcheater ≥35 km/h, snow gear only on explicit snow forecast), with Hinglish + English item names, per-item reasons, group-aware wording (extra dry layer / spare socks for children) and a "Suggested" (never mandatory) tone.
- **First-Aid & Travel Safety** — separate category with a 12-item non-medicine baseline (bandages, gauze, tape, antiseptic wipes, non-stick dressing, gloves, crepe bandage, blister plasters, thermometer, tweezers, sanitiser, ORS), activity-aware additions (trekking → blister plasters, first-aid pouch), waterproof-pouch note for rain, child-suitability reminder for guardians, and neutral personal-medicines reminder. **No medicines, doses, combinations or child-specific treatments are ever recommended; no diagnoses, allergies, histories or names/DOBs are collected.**
- **Editable checklist** — tick as packed, remove items, add your own per category; safety notes cover expiry checks, airline rules for sharp items, emergency-services guidance and the non-exhaustive nature of the list.
- Language preference (`mm-lang` in localStorage) is shared between the dashboard and the Trip Planner.

### Indian AQI (Data Rule)

The app **never** labels a US EPA index as Indian AQI. It computes the **CPCB National AQI** server-side from PM2.5 / PM10 concentrations using the official CPCB sub-index breakpoints (Indian AQI = max of sub-indices). When air-quality data is unavailable, a "data unavailable" message is shown — no assumed status is ever generated.

## Architecture

```
├── index.html      # Night Radar dashboard (hero 4 / map 5 / AQI 3, rain 8 / cold 4, daily 8 / alert 4)
├── trip.html       # Trip Planner: progressive form + outlook + packing/first-aid checklist
├── styles.css      # Night Radar tokens, weather modes, AQI semantics, trip components
├── app.js          # Dashboard logic: search, AQI, cold/rain/storm rules, Leaflet map, accents
├── app-trip.js     # Trip logic: validation, outlook render, packing rules, checklist
├── places.js       # Curated popular cities, states/UTs, per-state localities
├── api/weather.js  # Vercel serverless: WeatherAPI proxy + CPCB AQI logic + alerts
├── api/search.js   # Vercel serverless: India-first geocoding proxy
├── api/trip.js     # Vercel serverless: trip outlook (forecast.json + labelled future.json)
├── vercel.json     # Minimal config (no function runtime overrides)
├── .env.example    # Placeholder env vars
└── .env            # WEATHERAPI_KEY (gitignored — never committed)
```

The `WEATHERAPI_KEY` stays **server-side** in the Vercel function environment; the browser only talks to `/api/*`. No tokens or keys are present in this repository (FR-08).

## Alert Mapping (F4)

| AQI | Category | Message |
|-----|----------|---------|
| 0–50 | Good | Hawa badiya hai bhai! Mausam ka maza lo. |
| 51–100 | Satisfactory | Sab theek hai! Bas apna khayal rakhna. |
| 101–200 | Moderate | Thoda sambhal ke bhai! Sensitive log outdoor activity kam rakhein. |
| 201–300 | Poor | Mask laga lo bhai! Pollution zyada hai. |
| 301–400 | Very Poor | Bhai, hawa ki haalat kharab hai! Outdoor activities limit karo. |
| 401–500 | Severe | MASK LAGA LO BHAI! Zaroori na ho toh bahar mat niklo. |

## Local development

```bash
npm i -g vercel
vercel dev          # runs the site + /api/* locally with .env
```

## Deployment

Deployed on Vercel (https://mosam-mastana.vercel.app). Set `WEATHERAPI_KEY` in the Vercel project environment variables — never commit it.

---

Design principle: **"Midnight clarity. Live weather signals. Indian personality."**
