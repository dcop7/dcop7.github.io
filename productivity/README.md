# DCOP7 Productivity (`/productivity/`)

A microsite inside Diogo Universe that teaches visitors to build a personal productivity system: capture, triage, review; GTD and PARA; Notion-style databases. It is static, has no build step and works offline. Everything a visitor does stays in their own browser (`localStorage`). There are no accounts, nothing syncs, and it connects to no external tool.

The conceptual source is the local file `personal-productivity-system.md` (in `.gitignore`, never committed). The site keeps its principles and terms, and labels each idea as an **established concept** (`est`), a **choice of the reference system** (`own`) or **product-dependent** (`chk`). The "Fontes" chapter lists the gaps found in the document.

## Areas and routes (hash router)

| Area | Routes |
|---|---|
| 01 Aprender | `#aprender`, `#aprender/<chapter>` — track 1 *Organizar* (12 chapters + `fontes`), track 2 *Executar e dirigir* (`habitos`, `adiar`, `foco`, `decidir`, `motivacao`, `importante`) |
| 02 Explorar | `#explorar/mapa`, `#explorar/relacoes`, `#explorar/ferramentas[/<tool>\|/@<role>]`, `#explorar/combinar` |
| 03 Experimentar | `#experimentar/notion[/<db>[/<view>[/<rec>]]]`, `#experimentar/notion/mapa`, `#experimentar/captura`, `#experimentar/pagina-ou-base`; track 2 labs: `#experimentar/habito[/quebrar]`, `#experimentar/adiar`, `#experimentar/foco[/dia]`, `#experimentar/decidir[/enquadramento\|/premortem]`, `#experimentar/motivacao`, `#experimentar/prioridades[/urgencia\|/tras]` |
| 04 Aplicar | `#aplicar/semana`, `#aplicar/revisao`, `#aplicar/hoje`, `#aplicar/triagem`, `#aplicar/para`, `#aplicar/projeto`, `#aplicar/sistema`, `#aplicar/revisao-pessoal` |
| — | `#mundo` (manage the sample world) |

The portal redirects `#produtividade[/…]` and `#productivity[/…]` to `/productivity/#…` (`js/core/nav.js`).

## Files

- `js/pr-core.js` (`Pr`): helpers, kinds, icons, the toast, the router registry.
- `js/pr-seed.js` (`PrSeed`): two scenarios, **work** (from the document: Atlas/Beacon/Cobalt, Ana, Elena…) and **study**. Also holds the schemas, views, templates and guided-week events.
- `js/pr-world.js` (`PrWorld`): the **event-sourced sample world**. State = seed + a log of ops, and each op is tagged with the experiment (`src`) that made it. *Reset one experiment* rebuilds the state without that experiment's ops. *Reset all* clears the log. There is one log per scenario (`pr-world-v1:<scenario>`).
- `js/pr-notion.js`: the database playground (properties, filters, sorts, views, relations, rollups, templates, relation map, missions).
- `js/pr-capture.js`: quick-add parser + capture lab. `js/pr-week.js`: Big 3, the 7-step weekly review and the guided week. `js/pr-apply.js`: triage quiz, PARA, project builder and the page-or-database ladder. `js/pr-explore.js`: system map, relations, directory, combiner and the "Design your system" builder.
- `js/pr-tools-data.js` (`PrTools`): the tool directory data (see below).
- `js/pr-mind-content.js`: track 2 (`TRACKS`, blocks `executar`/`dirigir`, six chapters with `refs`). `js/pr-mind.js` (`PrMind`): shared lab helpers, the chapter demos (`m-loop`, `m-discount`, `m-sys12`, `m-reward`) and the habit, procrastination and focus labs. `js/pr-mind-dir.js`: decision, motivation and priorities labs plus the personal review. `css/pr-mind.css`.
- `sw.js`: scope `/productivity/`, caches `prod-*` only. **Bump `CACHE` whenever code changes.**

## Track 2: Executing & directing

The human side of the system (habits, procrastination, focus, decisions, motivation, priorities). It is not a set of book summaries: each chapter links back to the Organizing track (weekly review, Big 3, GTD next action, project page) instead of repeating it.

- **Evidence tags** (`Pr.srcTag`): `res` published research · `est` established framework · `auth` an author's model (Clear, Covey, Pink, Fogg, Newport, Klein) · `tip` this site's practical advice · `weak` popular claim with weak or failed evidence (ego depletion, "21 days", 90-minute cycles, the "be a voter" identity effect, behavioural priming). Each chapter lists its sources at the end (`refs`). Sources were checked in Nov 2026.
- **Simulations are illustrations**: the habit curve, the temporal-motivation chart, the workday and the motivation profile take their *shape* from the cited research, but their parameters are invented, and every one says so on the page. The switch-cost test is a real but informal self-measurement (52 trials).
- **Personal data**: everything a visitor types in these labs lives only in `localStorage['pr-mind-v1']`, one part per lab, and each lab has a two-tap "delete my data" button. The sample world only changes when the visitor presses a "take to the sample world" button; those ops carry `src: 'mind'` and can be reset like any other experiment.

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
