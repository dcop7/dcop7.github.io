# Diogo's Website

A single-file personal dashboard hosted on GitHub Pages. It combines a full-featured weather experience (inspired by Windy.com), a live world/Portugal/science history feed, Portuguese holiday tracking, and a Windy.com radar map — all with no backend, no build step, and no API keys required.

**Live URL:** `https://dcop7.github.io`  
**Repo:** `D:\claude.ai\dcop7.github.io` (Windows) / GitHub Pages repo

---

## File Structure

```
dcop7.github.io/
└── index.html       ← entire app: HTML + CSS + JavaScript in one file
```

There is intentionally **no framework, no bundler, no dependencies, no package.json**. Everything is vanilla HTML/CSS/JS loaded directly by the browser. Google Fonts are loaded via `<link>` tag.

---

## Purpose & Goals

- Personal weather dashboard defaulting to **Leiria, Portugal**
- Dark, modern UI (dark navy theme, `#07101F` background)
- Works on desktop and mobile (responsive)
- No API keys, no server — purely client-side
- Fast load: one file, async data fetching

---

## Fonts

Loaded from Google Fonts:

| Font | Used for |
|---|---|
| **Space Grotesk** (700) | Brand name "Diogo's website" in header |
| **Inter** (300–700) | All other UI text |

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
```

---

## CSS Design System

All colours and spacing use CSS custom properties defined in `:root`:

```css
:root {
  --bg:      #07101F;   /* page background */
  --card:    #0E1A2E;   /* card background */
  --card2:   #152238;   /* card hover / secondary */
  --border:  rgba(255,255,255,.07);
  --border2: rgba(255,255,255,.13);
  --text:    #E4EAF6;
  --muted:   #6B7DA0;
  --accent:  #3B82F6;   /* blue — links, highlights */
  --amber:   #F59E0B;   /* section headers */
  --green:   #10B981;
  --red:     #EF4444;
}
```

**Responsive breakpoints:**

| Breakpoint | Change |
|---|---|
| ≤1280px | History: 4→2 columns |
| ≤1024px | Main layout: 2→1 column; holidays go side-by-side |
| ≤768px | Stat grid 4→2 cols; map height reduced; header smaller |
| ≤540px | History: 1 column; forecast wraps 2-per-row |
| ≤380px | Further padding reductions |
| `pointer:coarse` | Hover popups hidden (touch devices) |

---

## Page Structure (HTML)

```
<header>                    sticky, blurred — brand + live clock
<section.history-section>   "Hoje na História" — 4 fixed-height scrollable columns
<div.layout>                CSS grid: weather-col (1fr) | holidays-col (300px)
  <div.weather-col>
    <div#weather-hero>      gradient hero card — city select, temp, 8-stat grid
    <div>                   hourly strip (next 24h, horizontally scrollable)
    <div>                   7-day forecast row
    <div.map-card>          Windy.com embed with 5 overlay tabs
  <aside.holidays-col>
    <div.hol-card>          National holidays (next 3 months)
    <div.hol-card>          Municipal holidays (next 3 months)
<div#popup>                 shared fixed-position popup for hover details
```

---

## APIs Used (all free, no keys)

### 1. Open-Meteo — Weather Data
**Docs:** https://open-meteo.com/en/docs  
**CORS:** Yes (browser-safe)

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=temperature_2m,apparent_temperature,precipitation,
           wind_speed_10m,wind_direction_10m,relative_humidity_2m,
           weather_code,surface_pressure,cloud_cover
  &hourly=temperature_2m,apparent_temperature,precipitation_probability,
          precipitation,weather_code,wind_speed_10m,wind_direction_10m,
          wind_gusts_10m,cloud_cover
  &daily=weather_code,temperature_2m_max,temperature_2m_min,
         apparent_temperature_max,precipitation_probability_max,
         precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,
         relative_humidity_2m_max,uv_index_max,sunrise,sunset
  &timezone=Europe/Lisbon
  &forecast_days=7
```

Used for: current conditions, next 24h hourly, 7-day daily forecast.

### 2. IPMA — Portuguese Weather Warnings
**Docs:** https://api.ipma.pt  
**CORS:** Yes

```
GET https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json
```

Returns array of active/upcoming alerts. Each alert has:
- `awarenessLevelID` — `"yellow"` / `"orange"` / `"red"`
- `awarenessTypeName` — e.g. `"Vento"`, `"Chuva"`, `"Trovoada"`
- `startTime`, `endTime` — ISO datetime strings
- `area_name_pt` / `regionName` — geographic area

**Deduplication logic:** Alerts are grouped by `${lvl}|${type}|${startTime}|${endTime}`. Duplicate entries (same event across multiple area records) have their areas merged into one alert object.

### 3. Wikipedia REST API — "On This Day" History
**CORS:** Yes (both EN and PT)

| Endpoint | Used for |
|---|---|
| `https://pt.wikipedia.org/api/rest_v1/feed/onthisday/events/{MM}/{DD}` | Mundo + Portugal columns |
| `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{MM}/{DD}` | Ciência & Tecnologia column |
| `https://v2.jokeapi.dev/joke/Any?lang=pt&amount=8&safe-mode` | Piadas column (PT, fallback EN) |

Response shape:
```json
{
  "events": [
    {
      "year": 1974,
      "text": "Revolução dos Cravos em Portugal...",
      "pages": [{ "title": "...", "content_urls": { "desktop": { "page": "https://..." } } }]
    }
  ]
}
```

**Column filtering logic:**
- **Portugal**: PT events where `text.toLowerCase()` includes any of `PT_KEYS`
- **Mundo**: PT events NOT in the Portugal set
- **Ciência & Tecnologia**: EN events matching `TECH_KEYS`, excluding already-shown events
- **Piadas**: 8 random jokes from JokeAPI (Portuguese first, English fallback); new jokes on every page load

### 4. Windy.com Embed
**Docs:** https://api.windy.com/embed

```
https://embed.windy.com/embed2.html
  ?lat={lat}&lon={lon}&detailLat={lat}&detailLon={lon}
  &zoom=6&level=surface&overlay={overlay}
  &product=ecmwf&menu=&message=true&marker=true
  &calendar=now&pressure=&type=map&location=coordinates
  &metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1
```

`overlay` options: `rain` | `wind` | `clouds` | `temp` | `pressure`

---

## JavaScript Architecture

All JS is inline in `<script>` at bottom of `<body>`. No modules, no imports.

### Global State Variables

```javascript
let mapLatLon = [39.7436, -8.8071]; // current map center [lat, lon]
let activeAlerts = [];               // deduplicated IPMA alerts
let hourlyStore = null;              // Open-Meteo hourly response, used by hourly popup
```

### Key Constants

```javascript
const WD = ['Domingo','Segunda-feira',...];  // full weekday names
const MO = ['janeiro','fevereiro',...];      // full month names
const MS = ['Jan','Fev',...];               // short month names
const DS = ['Dom','Seg',...];               // short weekday names (for forecast cards)

const WMO_MAP = { 0:{l:'Sol',i:'☀️'}, 1:{...}, ... };
// Maps WMO weather codes → { l: Portuguese label, i: emoji icon }
```

### Key Functions

```javascript
// Utilities
wmo(code)              // → {l, i} from WMO_MAP, fallback {l:'Desconhecido',i:'🌡️'}
compass(degrees)       // wind direction → 'N','NNE','NE',...
uvCls(value)           // UV index → CSS class for colouring
fmtT(isoString)        // 'YYYY-MM-DDTHH:mm' → 'HH:mm'

// Clock
tick()                 // updates #date-el and #time-el; called every 30s

// History
loadHistory()          // 3 parallel Wikipedia fetches → populates 4 columns
hEventHTML(ev, base)   // renders one history event as <a.h-event> HTML string

// IPMA
fetchAlerts()          // fetches + deduplicates → sets activeAlerts[]
getAlertsForDay(dateStr) // returns alerts overlapping a given date ('YYYY-MM-DD')

// Weather
loadWeather(latlon)    // main function: fetches weather + alerts, renders all sections
                       // latlon is "lat,lon" string matching <option value>

// Popup
positionPopup(anchor)  // positions #popup above/below anchor using getBoundingClientRect
hidePopup()            // 130ms debounced hide
showForecastPopup(anchor, data, dayAlerts) // 7-day card popup
showHourlyPopup(anchor, idx)              // hourly card popup using hourlyStore

// Map
setMap(lat, lon, overlay) // sets windy-map iframe src

// Holidays
getEaster(year)        // Meeus algorithm → Date object
ptNat(year)            // → array of {d:Date, n:string} national holidays
renderHolidays()       // populates #nat-hols and #mun-hols
holHTML(date, name, sub) // renders one holiday row as HTML string
```

### City Select / Event Listener Pattern

The city `<select>` lives inside `#weather-hero` whose `innerHTML` is rebuilt on every `loadWeather()` call. To avoid stacking duplicate listeners, a **single delegated listener** is attached to the persistent `#weather-hero` div:

```javascript
document.getElementById('weather-hero').addEventListener('change', e => {
  if (e.target.matches('.hero-city-select')) loadWeather(e.target.value);
});
```

City options are stored in `const CITY_OPTIONS` (HTML string) and injected each time the hero is rebuilt.

### Hourly Popup Event Delegation

The `.hourly-scroll` container persists; its children are rebuilt each city change. Delegation is set up once:

```javascript
document.getElementById('hourly-scroll').addEventListener('mouseover', e => {
  const card = e.target.closest('.h-card');
  if (!card || !('idx' in card.dataset)) return;
  showHourlyPopup(card, +card.dataset.idx);
});
```

Each hourly card has `data-idx="{index}"` corresponding to its position in the raw `hourlyStore.time[]` array.

### Popup Positioning

The single `#popup` div is reused for both hourly and forecast popups.

```javascript
function positionPopup(anchor) {
  // 1. Place popup above anchor (400px estimated height)
  // 2. Clamp left to viewport edges
  // 3. requestAnimationFrame: if getBoundingClientRect().top < 8, flip below anchor
}
```

The popup uses `pointer-events:none` so it never interferes with mouse events.

---

## WMO Weather Code Reference

| Code(s) | Label | Icon |
|---|---|---|
| 0 | Sol | ☀️ |
| 1 | Principalmente sol | 🌤️ |
| 2 | Parcialmente nublado | ⛅ |
| 3 | Nublado | ☁️ |
| 45, 48 | Nevoeiro | 🌫️ |
| 51–55 | Chuvisco | 🌦️/🌧️ |
| 61–65 | Chuva | 🌧️ |
| 71–75 | Neve | 🌨️/❄️ |
| 80–82 | Aguaceiros | 🌦️/🌧️/⛈️ |
| 95, 96, 99 | Trovoada | ⛈️ |

---

## Cities Available

| Label | lat,lon |
|---|---|
| Lisboa | 38.7223,-9.1393 |
| Porto | 41.1579,-8.6291 |
| Braga | 41.5454,-8.4265 |
| Coimbra | 40.2033,-8.4103 |
| Faro | 37.0193,-7.9304 |
| Évora | 38.5667,-7.9000 |
| Aveiro | 40.6405,-8.6538 |
| Setúbal | 38.5244,-8.8882 |
| Viseu | 40.6566,-7.9122 |
| **Leiria** *(default)* | 39.7436,-8.8071 |
| Santarém | 39.2333,-8.6833 |
| Funchal | 32.6669,-16.9241 |
| Ponta Delgada | 37.7412,-25.6756 |

To add a city: add an `<option value="lat,lon">Name</option>` to **both** the initial `<select>` in the HTML and the `CITY_OPTIONS` constant in the JS.

---

## Portuguese Holidays Logic

### National Holidays (`ptNat(year)`)
Fixed dates (Jan 1, Apr 25, May 1, Jun 10, Aug 15, Oct 5, Nov 1, Dec 1, Dec 8, Dec 25) plus Easter-relative:
- Carnaval = Easter − 47 days
- Sexta-feira Santa = Easter − 2 days
- Páscoa = Easter (Meeus algorithm)
- Corpo de Deus = Easter + 60 days

### Municipal Holidays (`MUN` array)
Hardcoded array of `{m, d, n, c}` entries (month, day, name, city/district). Currently includes:

| Date | Name | City |
|---|---|---|
| 15 Mar | Mártires de Marrocos | Santarém |
| 22 Mai | Nossa Srª da Encarnação | Leiria |
| 13 Jun | Santo António | Lisboa |
| 24 Jun | São João | Porto · Braga · Guimarães |
| 1 Jul | Dia da Região Autónoma | Funchal |
| 4 Jul | Rainha Santa Isabel | Coimbra |
| 7 Set | Feriado Municipal | Faro |
| 15 Set | Nossa Srª da Boa Viagem | Setúbal |
| 27 Nov | Nossa Srª das Dores | Viseu |
| 12 Dez | Nossa Srª da Conceição | Évora |

Both lists show holidays in the **next 3 months** from today.

---

## History Keyword Filter Lists

### `PT_KEYS` (Portugal column filter — applied to PT Wikipedia events)
```
'portugal','português','portuguesa','portugueses','porto','lisboa','lisbon',
'coimbra','braga','algarve','alentejo','madeira','açores','lusíada','lusitano',
'tejo','douro','sagres','aljubarrota','alcácer','leiria','setúbal','aveiro',
'évora','faro','guimarães','viseu','beja','castelo branco','viana','barcelos',
'batalha','óbidos','monsaraz','marvão','sintra','cascais','nazaré','fátima'
```

### `TECH_KEYS` (Science & Tech column filter — applied to EN Wikipedia events)
```
'computer','software','internet','web','game','video game','digital','technology',
'apple','microsoft','google','ibm','linux','nintendo','atari','iphone','android',
'artificial intelligence','invention','telescope','space','nasa','moon landing',
'mars','satellite','discovery','vaccine','dna','quantum','electricity','radio',
'television','broadcast','film','cinema','tetris','pac-man','robot','programming',
'algorithm','rocket','nuclear','atom','processor','microchip','world wide web',
'email','twitter','facebook','youtube','smartphone','tablet'
```

---

## Known Constraints & Edge Cases

- **PT Wikipedia events are fewer than EN** — on some dates Portugal column may show fewer than 20 items.
- **Hourly popup requires `hourlyStore`** — if weather hasn't loaded yet, hovering hourly cards does nothing (graceful no-op).
- **Touch devices**: popups are hidden via `@media(pointer:coarse)`. All essential data is visible directly on cards without needing hover.
- **IPMA warnings API** sometimes returns empty or malformed JSON — `fetchAlerts()` has a try/catch that silently sets `activeAlerts = []`.
- **Windy embed** reloads every time the city or overlay changes (iframe src is replaced). This is expected behaviour.
- **City select value preservation**: when hero is rebuilt after `loadWeather()`, the select value must be manually re-set via `.value = curVal` after injecting `CITY_OPTIONS`.

---

## Potential Improvements / TODO

- Add geolocation button (detect user location automatically using `navigator.geolocation`)
- Add a search input to find cities not in the dropdown list
- Add hourly wind direction arrows on the hourly strip cards
- Persist selected city to `localStorage` so it survives page refresh
- Add a "feels like" row to hourly cards
- Expand municipal holidays to cover more Portuguese cities
- Add a "share" or "screenshot" button
- Add PWA manifest + service worker for offline support
- Add more Wikipedia language support (e.g. filter births for notable Portuguese people)
- Add UV index trend or chart in the popup
- Dark/light mode toggle
- Internationalise city list beyond Portugal (user may want other countries)

---

## Development Notes for AI Agents

1. **The entire app is `index.html`** — do not create separate CSS or JS files unless explicitly asked. The single-file constraint is intentional for GitHub Pages simplicity.

2. **No build step** — do not introduce npm, webpack, vite, or any bundler. The file is served as-is.

3. **No backend** — all data fetching is client-side. Do not add server routes, serverless functions, or proxies unless a specific API requires it (currently none do).

4. **Preserve the dark theme variables** — UI changes should use `var(--accent)`, `var(--muted)`, `var(--card)`, etc. Do not hardcode colours unless adding a new semantic variable to `:root`.

5. **City select pattern** — both the HTML `<select id="city-select">` and the JS `const CITY_OPTIONS` string must stay in sync. Adding a city requires updating both.

6. **Event listener hygiene** — `loadWeather()` rebuilds `#weather-hero` innerHTML on every call. Do not add event listeners inside `loadWeather()` for elements that are recreated — use delegation on the persistent parent container instead (see the `#weather-hero` change event and `#hourly-scroll` mouseover).

7. **Popup is shared** — `#popup` is one div used for both hourly and forecast popups. Set `.innerHTML` before calling `positionPopup()` + `classList.add('show')`.

8. **Wikipedia API month/day format** — the REST API expects zero-padded `MM/DD` in the URL path. Use `String(n.getMonth()+1).padStart(2,'0')`.

9. **IPMA alert levels** — the API field is `awarenessLevelID` (string: `"yellow"`, `"orange"`, `"red"`). Always `.toLowerCase()` before comparing.

10. **WMO codes** — not all codes are in `WMO_MAP`. The fallback `wmo(c)` returns `{l:'Desconhecido',i:'🌡️'}` — this is intentional and safe.
