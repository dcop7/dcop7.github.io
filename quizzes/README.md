# Quiz database (`/quizzes`)

Lazy-loaded, offline-first question bank for the Quizzes feature. Files are
fetched on demand by `quiz-data.js` — they are **not** part of the initial
page bundle, so the database can grow to thousands of questions without
hurting load time.

## Layout

```
quizzes/
  easy/    <category>.json
  medium/  <category>.json
  hard/    <category>.json
```

Difficulty is a first-class axis (Fácil / Médio / Difícil) — the app no
longer uses age groups. To add content, drop a `<category>.json` into the
relevant difficulty folder and register a provider in `quiz-providers.js`
via `makeDataProvider('<category>')`, then list it in `quiz-page.js`.

## Question format (pt-PT)

Each file is a JSON array of items:

```json
{
  "q": "Pergunta em português de Portugal?",
  "a": "Resposta correcta",
  "opts": ["Resposta correcta", "Distrator 1", "Distrator 2", "Distrator 3"],
  "exp": "Explicação curta e educativa.",
  "img": "<svg …>…</svg>",
  "imgType": "svg",
  "imgCredit": "Autor — Licença (apenas para imagens externas)"
}
```

Rules enforced/validated:

- **Exactly 4 options**, all distinct, and `a` must be one of them.
- Distractors must be plausible and difficulty-appropriate.
- Content is written in **European Portuguese (pt-PT)** — avoid Brazilian
  terminology. English remains an optional fallback served by the embedded
  banks / external APIs.
- `img`/`imgType`/`imgCredit` are optional. `imgType` is `svg` (inline,
  authored locally — trusted), `img` (hotlinked educational photo), or
  `flag`.

## Loading & caching tiers (offline-first)

1. in-memory cache (per session)
2. `sessionStorage` (per tab)
3. network fetch of the JSON file
4. provider's small embedded fallback set (so a category never fully fails)

The service worker (`sw.js`) additionally runtime-caches every fetched file,
so each category becomes fully offline-capable after being played once.

## Image licensing policy

This project must stay legally safe and maintainable. **Do not** scrape,
hotlink arbitrary sites, or embed copyrighted images.

Allowed image sources, in order of preference:

1. **Inline SVG authored in this repo** (traffic signs, symbols, shapes) —
   zero copyright risk, fully offline. This is the default for visual quizzes.
2. **Public-domain / open-licence assets** — Wikimedia Commons, NASA, ESA,
   government open-data, Openverse-compatible sources.

When an external image is used (`imgType: "img"`):

- Verify its licence permits reuse before adding it.
- Record attribution in the `imgCredit` field **and** in `IMAGE-CREDITS.md`.
- The UI lazy-loads it and falls back to a labelled placeholder if it fails,
  so layouts never break.

### Deferred categories

Image-based **car logos** and **car model photos** are intentionally **not**
built from scraped/hotlinked assets. Manufacturer logos and press photos are
typically trademarked and/or not freely licensed. Until properly licensed
assets (or locally authored SVGs) are available, these ship as **text-based**
quizzes (`carros.json` — identify brand by origin, history, models). To
upgrade them later: add licensed SVGs/images under `quizzes/assets/`, set
`img`/`imgType`/`imgCredit`, and log the source in `IMAGE-CREDITS.md`.
