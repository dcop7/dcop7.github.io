# Diogo's Dev Hub

A personal productivity dashboard and playground hosted on GitHub Pages. Zero backend, zero build step — pure HTML, CSS, and JavaScript.

**Live:** [dcop7.github.io](https://dcop7.github.io)

---

## What's Inside

| Section | What it does |
|---------|-------------|
| **Home** | Greeting, hero search, bookmarks, world times, RSS/HN feed, holidays, daily quote/riddle |
| **Tools** | Calculator, stopwatch, pomodoro, countdown, markdown editor, regex tester, diff viewer, color picker, UUID, timestamp, age, unit converter, dice/coin |
| **Games** | Hangman, Minesweeper, Snake, Memory, Tic-Tac-Toe, Wordle, Aim Trainer, Reaction Test, Space Shooter, Bomb Defusal, and 10+ premium games |
| **Links** | Curated resource library organized by category |
| **Cheatsheets** | Command references for Git, Linux, Vim, regex, Docker, keyboard shortcuts |
| **Photography** | Exposure calculator, depth of field, composition guide, color wheel |
| **Workout** | Exercise library with stick-figure animations and a guided workout player |
| **Media** | Track movies, TV shows, and trailers you want to watch |
| **Visual Tools** | Whiteboard (Excalidraw), Eisenhower matrix, SWOT analysis |
| **Settings** | Theme, font size, icon style, bookmarks manager |

---

## Architecture

### No framework, no bundler

Everything is vanilla HTML/CSS/JS served directly by GitHub Pages. There is no `package.json`, no build step, no minification pipeline.

```
dcop7.github.io/
├── index.html                 ← single HTML shell, all views inline
├── css/
│   ├── tokens.css             ← CSS custom properties (design tokens)
│   ├── base.css               ← reset, body, keyframes, background orbs
│   ├── layout.css             ← header, sidebar, views, mobile nav
│   ├── components.css         ← command palette, search, modals, badges
│   └── views/
│       ├── home.css           ← hero, widgets, bookmarks, world times
│       ├── games.css          ← game hub grid, all per-game styles
│       ├── tools.css          ← tools layout, all per-tool styles
│       └── features.css       ← links, cheatsheets, photography, workout, media, settings, visual
├── src/
│   ├── core/
│   │   ├── store.js           ← localStorage abstraction with pub/sub
│   │   └── events.js          ← lightweight event bus
│   └── games/
│       └── engine/
│           ├── canvas.js      ← responsive canvas + RAF loop
│           ├── particles.js   ← particle system
│           ├── audio.js       ← Web Audio API sound primitives
│           ├── input.js       ← keyboard tracker + touch D-pad
│           └── storage.js     ← per-game highscore/level/prefs
├── js/                        ← all application modules, grouped by area
│   ├── core/                  ← i18n, nav, main, search, settings, parallax, command-palette
│   ├── games/                 ← game-host + every game implementation (game-*.js, hangman, …)
│   ├── quiz/                  ← quiz-engine, quiz-data (loader), quiz-providers, quiz-page
│   ├── explorer/              ← explorer (world map/globe), explorer-portugal, explorer-solar, ocorrencias
│   └── pages/                 ← tools, cheatsheets, photography, workout, media, visual, links-*, rss
├── quizzes/                   ← offline question database: {easy,medium,hard}/{category}.json
├── data/                      ← bundled GeoJSON + country data (offline-first)
└── sw.js                      ← service worker (stays at root for scope)
```

> `i18n.js` loads in `<head>` (so the language is set before render); all other
> modules load with `defer` at the end of `<body>`. Load order in `index.html`
> still handles dependencies (no ES module imports).

### Module pattern

All JS files use the IIFE module pattern — each exports a single global object:

```javascript
const ModuleName = (function () {
  // private state
  return { publicAPI };
})();
```

Cross-module communication happens via those globals (e.g. `Nav.go('tools')`, `I18n.t('key')`). No ES module imports are needed; script load order in `index.html` handles dependencies.

### CSS architecture

Design tokens (`css/tokens.css`) define 28 custom properties:

```css
:root {
  --bg, --card, --card2, --card-solid   /* surfaces */
  --border, --border2                    /* borders */
  --text, --text2, --muted              /* typography */
  --accent, --accent-rgb, --accent-soft, --accent-glow, --accent2
  --red, --green, --amber               /* semantic colors */
  --radius, --radius-sm, --radius-xs    /* border radius */
  --sb-w, --hdr-h                       /* layout dimensions */
  --font-sans, --font-head, --font-mono /* typefaces */
  --ease, --ease-out                    /* transitions */
}
```

Light theme is applied by adding `body.light`; accent themes via `body.theme-purple` etc.

---

## Shared Utilities

### Store (`src/core/store.js`)

Unified localStorage wrapper with pub/sub and namespaced access:

```javascript
Store.set('key', value);
Store.get('key', defaultValue);
Store.on('key', fn);       // fires on change
Store.ns('games').get('level', 1);  // namespaced
```

### Events (`src/core/events.js`)

Global event bus for decoupled communication:

```javascript
Events.on('nav:change', route => { ... });
Events.emit('nav:change', 'tools');
Events.once('app:ready', fn);
```

### Game Engine (`src/games/engine/`)

Opt-in utilities for game files:

| Module | API |
|--------|-----|
| `CanvasEngine` | `create(canvas, { update, draw, onResize })` — RAF loop + ResizeObserver |
| `Particles` | `create()` → `spawn`, `spawnBurst`, `update(dt)`, `draw(ctx)` |
| `GameAudio` | `beep()`, `success()`, `fail()`, `pop()`, `shoot()`, `levelUp()`, `explosion()` |
| `GameInput` | `createKeyboard()` — held/pressed/released; `createTouchControls(el)` — virtual D-pad |
| `GameStorage` | `forGame(id)` → `getHighScore`, `setLevel`, `getPref`, `updateStats` |

---

## Design System

### Themes

| Class | Accent color |
|-------|-------------|
| *(default)* | Indigo `#6366f1` |
| `body.theme-blue` | Blue `#3b82f6` |
| `body.theme-purple` | Purple `#a855f7` |
| `body.theme-green` | Green `#22c55e` |
| `body.theme-amber` | Amber `#f59e0b` |
| `body.theme-red` | Red `#ef4444` |
| `body.theme-cyan` | Cyan `#06b6d4` |
| `body.theme-terminal` | Green terminal |
| `body.light` | Light mode |

### Fonts

| Variable | Font | Used for |
|----------|------|---------|
| `--font-head` | Space Grotesk | Titles, card headings |
| `--font-sans` | Inter | All UI text |
| `--font-mono` | JetBrains Mono | Code, timers, monospace displays |

### Responsive breakpoints

| Max-width | Change |
|-----------|--------|
| 1400px | Home grid narrows right column |
| 1100px | Home grid goes single column |
| 900px | Sidebar hides; mobile bottom nav appears; tools sidebar collapses to pill row |
| 600px | Game hub 1-column; calculator stays 4-col |
| 480px | Media grid 2-col; header controls hide |

---

## Routing

Navigation is hash-based via `nav.js`. Routes:

```
home · tools · games · links · cheatsheets · photography · workout · media · visual · settings
```

Each route shows one `.view[data-view="<route>"]` and updates the sidebar active state. Deep-links work via URL hash (e.g. `#tools`).

### Game routing

Games use a two-level route: `#games` shows the hub grid; clicking a card calls `GameHost.open(id)` which shows the pane, initializes the game (once), and updates the breadcrumb.

---

## I18n

Two locales: Portuguese (`pt`, default) and English (`en`). `i18n.js` loads synchronously (before `defer` scripts) so the page never flickers. Switch with `I18n.set('en')` or the lang button in the header.

---

## PWA

A manifest (`manifest.json`) and service worker (`sw.js`) enable "Add to Home Screen" on mobile. The install prompt appears once and can be dismissed permanently.

---

## Development

No install required. Open `index.html` in a browser or run a local static server:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

All CSS files and scripts are loaded from their filesystem paths — no bundling needed.

### Adding a new tool

1. Add a `<button class="tool-nav-btn">` to the tools sidebar in `index.html`
2. Add a `<div id="tool-<name>" class="tool-panel">` to the tools content area
3. Add the JS logic to `tools.js` inside the `Tools` IIFE

### Adding a new game

1. Create `game-<id>.js` with an IIFE exporting `{ init(container) }`
2. Add the game entry to `game-host.js` — `GAMES` array and `registry` map
3. Add `<div id="pane-<id>" class="game-pane">` to `index.html`
4. Add a `<script src="game-<id>.js" defer>` before `game-host.js`

---

## Constraints

- **Frontend-only** — no server, no backend, no database
- **GitHub Pages compatible** — no server-side rendering, no build required
- **No heavy frameworks** — no React, Vue, Next.js
- Lightweight external resources: Google Fonts (CSS), optional CDN embeds for Excalidraw
