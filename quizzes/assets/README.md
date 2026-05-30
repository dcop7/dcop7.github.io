# Quiz image assets (local-first)

Image-based quizzes reference **local** files under this folder, e.g.
`quizzes/assets/icons/github.svg`. The running site never reaches out to a
remote image host — assets are committed to the repo and (after first load)
runtime-cached by the service worker.

If an asset is missing, the quiz UI shows a labelled placeholder and the
layout never breaks. So the site is fully functional before any asset is
fetched; populating assets simply *adds* the pictures.

## Populating assets

```bash
node quizzes/assets/fetch-assets.mjs      # Node 18+
```

This reads `manifest.json` and downloads:

| Folder | Source | Licence |
|--------|--------|---------|
| `icons/` | [Simple Icons](https://simpleicons.org) (tech + car-brand logos) | **CC0 1.0** — public domain, no attribution required |
| `monuments/` | Wikipedia REST summary → article lead image (normally Wikimedia Commons) | per-file; the script logs each URL to `../IMAGE-CREDITS.md` to verify |

The script is idempotent (skips existing files), tolerates 404s (Simple
Icons removes some logos at a trademark holder's request — those simply
stay as placeholders), and appends attribution rows for monument images.

## Licensing rules

- **Only** add assets from sources that clearly permit reuse (see the root
  `quizzes/README.md` policy).
- After running the script, **review `IMAGE-CREDITS.md`** and verify each
  monument image's licence on its Commons page before publishing.
- Simple Icons logos are CC0 and used here purely for educational
  identification; no attribution is legally required.
- Do **not** commit assets whose licence you have not confirmed.

## Why local instead of hotlinking

- No dependence on remote uptime or CDN changes.
- No risk of a third party swapping/removing an image under us.
- Works fully offline (PWA) once cached.
- Licences are reviewed once, at fetch time, and recorded.
