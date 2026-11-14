# DCOP7 Productivity (`/productivity/`)

A microsite inside Diogo Universe that teaches visitors to build a personal productivity system: capture, triage, review; GTD and PARA; Notion-style databases. It is static, has no build step and works offline. Everything a visitor does stays in their own browser (`localStorage`). There are no accounts, nothing syncs, and it connects to no external tool.

The conceptual source is the local file `personal-productivity-system.md` (in `.gitignore`, never committed). The site keeps its principles and terms, and labels each idea as an **established concept** (`est`), a **choice of the reference system** (`own`) or **product-dependent** (`chk`). The "Fontes" chapter lists the gaps found in the document.

## Areas and routes (hash router)

| Area | Routes |
|---|---|
| 01 Aprender | `#aprender`, `#aprender/<chapter>` (12 chapters + `fontes`) |
| 02 Explorar | `#explorar/mapa`, `#explorar/relacoes`, `#explorar/ferramentas[/<tool>\|/@<role>]`, `#explorar/combinar` |
| 03 Experimentar | `#experimentar/notion[/<db>[/<view>[/<rec>]]]`, `#experimentar/notion/mapa`, `#experimentar/captura`, `#experimentar/pagina-ou-base` |
| 04 Aplicar | `#aplicar/semana`, `#aplicar/revisao`, `#aplicar/hoje`, `#aplicar/triagem`, `#aplicar/para`, `#aplicar/projeto`, `#aplicar/sistema` |
| — | `#mundo` (manage the sample world) |

The portal redirects `#produtividade[/…]` and `#productivity[/…]` to `/productivity/#…` (`js/core/nav.js`).

## Files

- `js/pr-core.js` (`Pr`): helpers, kinds, icons, the toast, the router registry.
- `js/pr-seed.js` (`PrSeed`): two scenarios, **work** (from the document: Atlas/Beacon/Cobalt, Ana, Elena…) and **study**. Also holds the schemas, views, templates and guided-week events.
- `js/pr-world.js` (`PrWorld`): the **event-sourced sample world**. State = seed + a log of ops, and each op is tagged with the experiment (`src`) that made it. *Reset one experiment* rebuilds the state without that experiment's ops. *Reset all* clears the log. There is one log per scenario (`pr-world-v1:<scenario>`).
- `js/pr-notion.js`: the database playground (properties, filters, sorts, views, relations, rollups, templates, relation map, missions).
- `js/pr-capture.js`: quick-add parser + capture lab. `js/pr-week.js`: Big 3, the 7-step weekly review and the guided week. `js/pr-apply.js`: triage quiz, PARA, project builder and the page-or-database ladder. `js/pr-explore.js`: system map, relations, directory, combiner and the "Design your system" builder.
- `js/pr-tools-data.js` (`PrTools`): the tool directory data (see below).
- `sw.js`: scope `/productivity/`, caches `prod-*` only. **Bump `CACHE` whenever code changes.**

The microsite reuses `/js/core/i18n.js` (PT default, EN through `I18n.add`), `/css/components.css` and `/js/vendor/anime.min.js`. It adds no framework, backend or build dependency.

## Tool directory rules

- No scores. Each tool is checked against the requirements for its role, taken from the document's "What to look for in any tool" table. Calendar requirements are this site's own choice. Each requirement gets one of these states: `y` yes · `l` limited on free · `p` paid only · `n` no · `c` not verified.
- Every free-plan or limit claim carries the official source URL and its own verification date (`SRC` in `pr-tools-data.js`). A claim that was not confirmed in an official source stays `c`, never guessed.
- Only tools with a permanent free plan (or that are free outright) are included. Trial-only services are excluded. No brand logos.
- **To re-verify:** read each `SRC` URL, update the facts, and set that source's `d` to the date of the check.

## Testing (headless Chrome, local server on :8321)

```
ROUTES=a,b node node_modules/.pr-flow.mjs [pt|en] [width]
STEPS_FILE=<abs path to steps .mjs> node node_modules/.pr-flow.mjs pt 1400
node node_modules/.pr-shot.mjs <route> [width] [out.png] [lang] [theme] [js]
node node_modules/.pr-pwa.mjs      # SW install + offline navigation
node node_modules/.pr-portal.mjs   # portal sidebar item + redirect
```

## Assets

The icon (`icon.svg`) is original. The PNG icons are rasterised from it by `tools/photogen/_prod-icons.mjs`. All diagrams are inline SVG drawn by code. Everything is registered in `ASSET-REGISTRY.json`. No ComfyUI images are used.
