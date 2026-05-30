#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   fetch-assets.mjs — populate local quiz image assets from reusable
   sources declared in manifest.json.

   Usage:   node quizzes/assets/fetch-assets.mjs
   Needs:   Node 18+ (global fetch).

   - icons:     Simple Icons (CC0) SVGs → quizzes/assets/icons/<slug>.svg
   - monuments: Wikipedia lead images   → quizzes/assets/monuments/<slug>.jpg

   The script is idempotent (skips files that already exist), tolerates
   404s (logs and continues), and appends an attribution row to
   IMAGE-CREDITS.md for every monument image it resolves. Assets are
   committed to the repo once fetched — the running site never reaches
   out to these remote sources.
══════════════════════════════════════════════════════════════════ */
import { readFile, writeFile, mkdir, access, appendFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(HERE, 'manifest.json'), 'utf8'));

const exists = p => access(p, constants.F_OK).then(() => true, () => false);

async function get(url, asText) {
  const r = await fetch(url, { headers: { 'User-Agent': 'dcop7-quiz-assets/1.0 (educational)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return asText ? r.text() : Buffer.from(await r.arrayBuffer());
}

let ok = 0, skip = 0, miss = 0;

/* ── Icons (Simple Icons, CC0) ── */
async function fetchIcons(slugs, label) {
  const dir = join(HERE, 'icons');
  await mkdir(dir, { recursive: true });
  for (const slug of slugs) {
    const dest = join(dir, `${slug}.svg`);
    if (await exists(dest)) { skip++; continue; }
    const url = manifest.icons.cdn.replace('{slug}', slug);
    try {
      const svg = await get(url, true);
      await writeFile(dest, svg, 'utf8');
      ok++; console.log(`  ✓ ${label}: ${slug}`);
    } catch (e) {
      miss++; console.log(`  ✗ ${label}: ${slug} (${e.message}) — skipped`);
    }
  }
}

/* ── Monuments (Wikipedia lead image) ── */
async function fetchMonuments(items) {
  const dir = join(HERE, 'monuments');
  await mkdir(dir, { recursive: true });
  const credits = [];
  for (const it of items) {
    const dest = join(dir, `${it.slug}.jpg`);
    if (await exists(dest)) { skip++; continue; }
    try {
      const api = manifest.monuments.api
        .replace('{wiki}', it.wiki).replace('{title}', encodeURIComponent(it.title));
      const meta = JSON.parse(await get(api, true));
      const src = (meta.originalimage && meta.originalimage.source) ||
                  (meta.thumbnail && meta.thumbnail.source);
      if (!src) throw new Error('no lead image');
      const img = await get(src, false);
      await writeFile(dest, img);
      credits.push(`| Monumentos | monuments/${it.slug}.jpg | ${it.title} | ${src} | verify on Commons | via ${it.wiki}.wikipedia.org |`);
      ok++; console.log(`  ✓ monument: ${it.title}`);
    } catch (e) {
      miss++; console.log(`  ✗ monument: ${it.title} (${e.message}) — skipped`);
    }
  }
  if (credits.length) {
    await appendFile(join(HERE, '..', 'IMAGE-CREDITS.md'),
      '\n<!-- auto-added by fetch-assets.mjs — VERIFY each licence -->\n' + credits.join('\n') + '\n');
    console.log(`  → ${credits.length} credit row(s) appended to IMAGE-CREDITS.md (verify licences).`);
  }
}

console.log('Fetching tech logos (Simple Icons, CC0)…');
await fetchIcons(manifest.icons.slugs, 'tech');
console.log('Fetching car-brand logos (Simple Icons, CC0)…');
await fetchIcons(manifest.icons.carSlugs, 'car');
console.log('Fetching monument images (Wikipedia / Commons)…');
await fetchMonuments(manifest.monuments.items);

console.log(`\nDone. downloaded=${ok} skipped(existing)=${skip} missing=${miss}`);
console.log('Review IMAGE-CREDITS.md and verify monument image licences before publishing.');
