# Image licensing assessment (zero-tolerance policy)

Policy: **legal certainty over visual richness.** If a licence cannot be
verified with high confidence, the image is not used — the quiz falls back to a
text card with Wikipedia/Commons links. All used images are stored **locally**
(no runtime hotlinking) except national flags (see below).

Verification tooling: `quizzes/tools/verify-licenses.mjs` queries each monument
image's licence on Wikimedia Commons and **deletes any file that is non-free,
off-Commons, or unverifiable**. `validate.mjs` then fails the build if any quiz
references a missing local image.

| Category | Image source | Licence confidence | Coverage | Fallback |
|----------|-------------|--------------------|----------|----------|
| **Monumentos** | Wikimedia Commons (auto-verified) | **High** — each file's Commons licence checked (CC0/CC BY/CC BY-SA/PD); per-image author+licence shown in-UI and in IMAGE-CREDITS.md | 33 verified local images + 3 text-only | Text card + Wikipedia link |
| **Logótipos Tecnológicos** | Simple Icons | **High** — CC0 1.0 (public domain) blanket licence | 184 local SVGs | Placeholder → never broken |
| **Logótipos de Automóveis** | Simple Icons | **High** — CC0 1.0 | 51 local SVGs | Placeholder |
| **Sinais de Trânsito** | Inline SVG authored in-repo | **High** — original work; sign designs are standard/public | 17 | n/a |
| **Símbolos** | Inline SVG / text in-repo | **High** — original work | 134 | n/a |
| **Bandeiras / país (flag)** | flagcdn.com (hotlink) | **Medium** — national flags are PD/not copyrightable (legally safe) **but hotlinked**, not local | 250 | Placeholder |
| **País — foto** | _(removed)_ | n/a — Wikipedia lead image could not be per-file verified at runtime | 0 | **Text excerpt + Wikipedia + Commons links** |
| Geografia, Ciência, História, Portugal, F1, Carros, Tecnologia, Animais, Espaço | text-only | n/a | — | text |

## Verification outcomes

- The verifier is **incremental**: once a file's Commons licence is confirmed
  (recorded in `monuments/credits.json`) it is trusted on later runs, so
  transient API rate-limits never drop an already-verified image.
- **Burj Khalifa** — its Wikipedia lead image was **not** on the Commons free
  repository → permanently excluded (text card + Wikipedia link instead).
- **Coliseu** (and any monument whose image isn't fetched) ships as a text
  card with a Wikipedia link — never a broken image.
- Atomium / Cristo Redentor: their Commons files declare free licences
  (CC BY 4.0 / CC BY-SA), which the tool confirmed, so they are included with
  attribution. (Belgium adopted freedom of panorama in 2016.)

## Known limitations / recommendations

1. **Flags are still hotlinked** from flagcdn. They are public-domain national
   flags (legally safe), but to fully satisfy the "no hotlinking / store
   locally" rule they should be downloaded into `assets/flags/`. Deferred
   (250 files) — tracked as the main remaining licensing-hygiene item.
2. **Monument licences are mostly CC BY / CC BY-SA**, which require
   attribution. Attribution is recorded in `IMAGE-CREDITS.md`; a visible
   credit line is shown under each monument image in the quiz.
3. Re-run `verify-licenses.mjs` after any monument fetch to re-confirm
   licences (Commons files can, rarely, be re-licensed or deleted).
