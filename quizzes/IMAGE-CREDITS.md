# Image credits

Attribution log for external images used in the quiz database. Inline SVG
authored within this repository (traffic signs, mathematical/scientific
symbols) is original work and needs no entry.

## Logos — tech & car brands (`assets/icons/`)

- **Source:** [Simple Icons](https://simpleicons.org)
- **Licence:** **CC0 1.0 Universal** (public domain dedication) — reuse for
  any purpose, **no attribution required**.
- **Use:** brand/technology logos shown solely for educational
  identification ("which logo is this?"). Trademarks remain property of
  their respective owners; inclusion here is nominative/educational.
- Populated by `assets/fetch-assets.mjs` into `assets/icons/`.

## Monuments (`assets/monuments/`)

Resolved per-monument from the Wikipedia article lead image (normally hosted
on Wikimedia Commons). The fetch script appends one row per downloaded image
below — **each licence must be verified on its Commons page** before relying
on it. Monument *questions are text-answerable*, so images are illustrative;
a missing/unverified image just falls back to a placeholder.

| Category | File | Subject | Source URL | Licence | Notes |
|----------|------|---------|-----------|---------|-------|
| _(populated by fetch-assets.mjs)_ | — | — | — | — | run the script, then verify |

## How to add an external image manually

1. Confirm the licence explicitly permits reuse (PD / CC / open data).
2. Save it under `assets/` and reference the local path in the quiz JSON
   (`imgType: "img"` or `"logo"`).
3. Add a row above with the source URL and licence.

Never add an image whose licence you cannot verify.
