# MOSAM MASTANA 🌤️😷

**Weather & Air Quality Awareness Platform** — real-time weather, Indian AQI (CPCB) and pollution alerts in one bold, Neo-Brutalist dashboard.

## Features (PRD v1.1)

- **F1 City Search** — search any city, live data via WeatherAPI (default: Delhi, loads on launch)
- **F2 Weather Dashboard** — temperature, feels-like, condition, humidity, wind, UV
- **F3 AQI Monitoring** — Indian National AQI (CPCB), PM2.5 / PM10 concentrations, last-updated time
- **F4 Dynamic Pollution Alerts** — AQI-category-mapped messages ("Mask laga lo bhai!" at 201+)

### Indian AQI (Data Rule)

The app **never** labels a US EPA index as Indian AQI. It computes the **CPCB National AQI** server-side from PM2.5 / PM10 concentrations using the official CPCB sub-index breakpoints (Indian AQI = max of sub-indices). When air-quality data is unavailable, a "data unavailable" message is shown — no assumed status is ever generated.

## Architecture

```
├── index.html      # Neo-Brutalist dashboard UI
├── styles.css      # Design system (bold borders, flat colours, hard shadows)
├── app.js          # Frontend logic, AQI→category→alert mapping
├── api/weather.js  # Vercel serverless function: WeatherAPI proxy + CPCB AQI logic
├── vercel.json     # Function runtime config
└── .env            # WEATHERAPI_KEY (gitignored — never committed)
```

The `WEATHERAPI_KEY` stays **server-side** in the Vercel function environment; the browser only talks to `/api/weather`.

## Alert Mapping (PRD F4)

| AQI | Category | Message |
|-----|----------|---------|
| 0–50 | Good | Hawa badiya hai bhai! Mausam ka maza lo. |
| 51–100 | Satisfactory | Sab theek hai! Bas apna khayal rakhna. |
| 101–200 | Moderate | Thoda sambhal ke bhai! Sensitive log outdoor activity kam rakhein. |
| 201–300 | Poor | Mask laga lo bhai! Pollution zyada hai. |
| 301–400 | Very Poor | Bhai, hawa ki haalat kharab hai! Outdoor activities limit karo. |
| 401–500 | Severe | MASK LAGA LO BHAI! Zaroori na ho toh bahar mat niklo. |

## Local development

Vercel Functions require the Vercel CLI (or any static server for UI-only work):

```bash
npm i -g vercel
vercel dev          # runs the site + /api/weather locally with .env
```

## Deployment

Deployed on Vercel. Set `WEATHERAPI_KEY` in the Vercel project environment variables — never commit it.

---

Design principle: **"Bold visuals. Minimal clutter. Maximum clarity."**
