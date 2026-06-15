# Quiz content audit

Real numbers, generated from disk (`quizzes/tools/validate.mjs` validates them).
Counts are **actual unique pt-PT questions on disk** — not targets. The whole
bank now lives in the **unified per-topic layout** `quizzes/<topic>/pt/<diff>.json`
(the legacy `easy/medium/hard/<cat>.json` folders were retired in June 2026).

**Validation: 5058 questions (pt+en) across 30 topics — 0 malformed, 0 missing images.**

## Per-topic pt-PT banks

| Topic | Easy | Medium | Hard | Total | Images |
|-------|-----:|-------:|-----:|------:|-------:|
| geografia | 196 | 172 | 74 | **442** | 385 |
| portugal | 71 | 215 | 125 | **411** | — |
| simbolos | 48 | 53 | 101 | **202** | 4 |
| history | 50 | 70 | 67 | **187** | — |
| science | 55 | 67 | 63 | **185** | — |
| logos-tech | 30 | 95 | 59 | **184** | 184 |
| solar | 50 | 73 | 54 | **177** | 49 |
| gk | 59 | 53 | 49 | **161** | 11 |
| tecnologia | 50 | 55 | 51 | **156** | — |
| sport | 50 | 50 | 49 | **149** | — |
| music | 53 | 53 | 42 | **148** | — |
| animals | 46 | 50 | 47 | **143** | — |
| vehicles | 53 | 46 | 38 | **137** | — |
| body | 42 | 42 | 42 | **126** | — |
| mitologia | 22 | 22 | 22 | **66** | — |
| bandeiras-europa | 19 | 16 | 18 | **53** | 53 |
| logos-car | 20 | 21 | 10 | **51** | 51 |
| animais-img | 16 | 16 | 16 | **48** | 48 |
| leiria | 16 | 16 | 14 | **46** | — |
| alimentos-img | 14 | 14 | 14 | **42** | 42 |
| prof-img | 14 | 14 | 14 | **42** | 42 |
| desporto-img | 12 | 12 | 12 | **36** | 36 |
| monumentos | 9 | 19 | 8 | **36** | 33 |
| mitos-img | 10 | 10 | 10 | **30** | 30 |
| planetas-img | 10 | 10 | 10 | **30** | 30 |
| apps | 11 | 12 | 6 | **29** | 29 |
| carros | 8 | 9 | 8 | **25** | — |
| orgaos-img | 8 | 8 | 8 | **24** | 24 |
| f1 | 7 | 7 | 7 | **21** | — |
| sinais | 6 | 6 | 5 | **17** | 17 |

**Total: 3404 pt-PT questions, 1068 with images, across 30 topics.**

## Dynamic categories (generated at runtime, not in the per-topic DB)

These pull from `data/countries.json` (250 countries) or are procedurally
generated, so they already have large, low-repetition pools:

- **Bandeiras, Capitais, Continentes, Maior População** — 250 countries each.
- **Matemática, Tabuada, Relógios** — procedural (effectively infinite).
- **Emojis, Cores, Espaço** — embedded pt-PT sets.

## June 2026 normalisation

- Retired the legacy `quizzes/{easy,medium,hard}/<cat>.json` layout; everything
  is now per-topic (`quizzes/<topic>/pt|en/<diff>.json`). `quiz-data.js` no
  longer has a legacy fallback path.
- Salvaged **691 unique, valid pt-PT questions** that were stranded in
  now-shadowed legacy files (notably portugal +291, history +67, science +65,
  solar +55, gk +41) by merging them (deduped by question text) into the
  per-topic banks.
- Re-pointed every generator (`gen-solar`, `gen-monuments`, `gen-portugal`,
  `gen-simbolos`, `gen-logos`, `expand-*`) at the per-topic paths; removed the
  obsolete `gen-geografia.mjs` (v1) and `extract-trivia.mjs`.

## Weak categories (priority for future expansion)

Smallest first — mostly **image quizzes** (limited by available licensed
images) and tight-domain trivia: **sinais** (17), **f1** (21), **orgaos-img**
(24), **carros** (25), **apps** (29), **planetas-img/mitos-img** (30). The
image sets are bounded by how many distinct, properly-licensed images exist;
the text sets (f1, carros) can grow from sourced authoring.

## Tooling (`quizzes/tools/`)

- `validate.mjs` — scans `quizzes/<topic>/<lang>/<diff>.json`; fails if any
  question is malformed or references a missing local image. Run before shipping.
- `gen-logos.mjs`, `gen-monuments.mjs`, `gen-geografia-v2.mjs`, `gen-simbolos.mjs`,
  `gen-solar.mjs`, `gen-portugal.mjs` — regenerate categories from verified
  datasets/assets into the per-topic layout.
- `expand-banks.mjs`, `expand-trivia.mjs` — append hand-authored questions
  (deduped) to existing per-topic banks.
