# Image audit

Per-category status of visual content, sources, licensing and fallbacks.
Reviewed for the content-scale / license-first expansion.

| Category | Image status | Mechanism | Source & licence | Fallback | Notes |
|----------|--------------|-----------|------------------|----------|-------|
| Bandeiras (Flags) | ✅ images | remote (flag CDN) | flagcdn.com — public flags | placeholder | National flags are not copyrightable. |
| Sinais de Trânsito | ✅ images | inline SVG | authored locally | — | Road-sign designs are standardised/public; zero licensing risk. |
| Símbolos | ✅ partial | inline SVG + text | authored locally | text | Chemistry/maths symbols; some text-only. |
| Logótipos Tecnológicos | 🟡 after fetch | local asset | Simple Icons — **CC0** | placeholder → text question still names options | Run `assets/fetch-assets.mjs`. A few logos removed upstream stay as placeholders. |
| Logótipos de Automóveis | 🟡 after fetch | local asset | Simple Icons — **CC0** | placeholder | Same pipeline as tech logos. |
| Monumentos | 🟡 after fetch | local asset | Wikipedia/Commons | placeholder; **questions are text-answerable** | Verify each licence in IMAGE-CREDITS after fetch. |
| Cores | ✅ images | inline (CSS swatch) | authored | — | — |
| Emoji / Profissões / Alimentos | ✅ glyphs | emoji | Unicode | — | — |
| Tecnologia (PT) / Portugal / Geografia / Ciência / História / Fórmula 1 / Marcas de Automóveis | ⬜ text | — | — | n/a | Text categories; no images needed. |

## Legend

- ✅ images present and offline-capable now
- 🟡 images appear after running the local-asset fetch script (text/placeholder until then; layout never breaks)
- ⬜ intentionally text-only

## Known limitations

- **Binary images cannot be added in the authoring environment.** The
  pipeline (`assets/manifest.json` + `assets/fetch-assets.mjs`) lets a
  maintainer populate them locally from verified-reusable sources.
- **No broken images by design:** every image type falls back to a labelled
  placeholder via `onerror`, so a missing/blocked asset never breaks layout.
- **Car logos/models as photographs** are deliberately not built from
  scraped/hotlinked sources. Logos come from CC0 Simple Icons; full vehicle
  *photos* remain deferred until a reusable dataset is confirmed.
- **Monument licences** are per-file and must be verified post-fetch
  (recorded in IMAGE-CREDITS.md); the text questions work regardless.
