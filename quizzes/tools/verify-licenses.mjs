#!/usr/bin/env node
/* Zero-tolerance image-licence verification for monument photos.
   For every downloaded monument image, this resolves the Wikipedia lead image,
   confirms it lives on Wikimedia COMMONS (the free repository), and queries the
   Commons file's licence metadata. Only files with a verifiably FREE licence
   (CC0 / CC BY / CC BY-SA / Public Domain) are kept; anything non-free,
   off-Commons, or unverifiable is DELETED so it can never ship.
   Verified attribution is written to IMAGE-CREDITS.md.
   Run: node quizzes/tools/verify-licenses.mjs */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MON = join(ROOT, 'quizzes', 'assets', 'monuments');
const manifest = JSON.parse(await readFile(join(ROOT, 'quizzes', 'assets', 'manifest.json'), 'utf8'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { 'User-Agent': 'dcop7-quiz-licence-check/1.0 (educational; verifies Commons licences)' };
/* Retry on 429 so transient rate-limiting never causes a false "unverified". */
async function get(u) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = await fetch(u, { headers: UA });
    if (r.ok) return r.json();
    if (r.status === 429 && attempt < 5) { await sleep(3000 * attempt); continue; }
    throw new Error('HTTP ' + r.status);
  }
}

/* A licence string counts as free only if it clearly matches a known free tag. */
function isFree(code, short) {
  const s = `${code || ''} ${short || ''}`.toLowerCase();
  if (/all rights reserved|non-free|fair use|copyright|©|no known copyright holder/.test(s)) {
    /* "no known copyright holder" usually accompanies PD — only reject if no PD signal */
    if (!/public domain|\bpd\b|cc0|cc[- ]by/.test(s)) return false;
  }
  return /cc0|cc[- ]by(?:[- ]sa)?[- ]?\d|public domain|\bpd-|\bpd\b|pdm|gfdl/.test(s);
}

/* Incremental + idempotent: an image already recorded in credits.json had its
   licence confirmed on a previous run, so we trust it and skip re-querying
   (this avoids transient 429s dropping already-verified images on re-runs).
   Only newly-fetched / unrecorded images are checked online. */
let PRIOR = {};
try { PRIOR = JSON.parse(await readFile(join(MON, 'credits.json'), 'utf8')); } catch (e) {}

const kept = [], removed = [];
for (const it of manifest.monuments.items) {
  const dest = join(MON, `${it.slug}.jpg`);
  if (!existsSync(dest)) continue;
  if (PRIOR[it.slug]) {            // already verified previously → carry forward
    const p = PRIOR[it.slug];
    kept.push({ it, ok: true, file: p.file, short: p.license, artist: p.author });
    console.log(`  • ${it.slug} — already verified (${p.license})`);
    continue;
  }
  let verdict = null;
  try {
    await sleep(500);
    const sum = await get(`https://${it.wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(it.title)}`);
    const src = (sum.thumbnail && sum.thumbnail.source) || (sum.originalimage && sum.originalimage.source) || '';
    if (!/\/wikipedia\/commons\//.test(src)) throw new Error('not on Commons repo');
    const m = src.match(/\/commons\/(?:thumb\/)?(?:[0-9a-f]\/[0-9a-f]{2}\/)?([^/]+?\.(?:jpe?g|png|svg))/i);
    const file = m ? decodeURIComponent(m[1]) : null;
    if (!file) throw new Error('cannot parse file name');
    await sleep(400);
    const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(file)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`;
    const j = await get(api);
    const pages = j.query.pages; const pg = pages[Object.keys(pages)[0]];
    const em = (pg.imageinfo && pg.imageinfo[0] && pg.imageinfo[0].extmetadata) || {};
    const code = em.License && em.License.value;
    const short = em.LicenseShortName && em.LicenseShortName.value;
    const artist = ((em.Artist && em.Artist.value) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (isFree(code, short)) {
      verdict = { ok: true, file, short: short || code, artist };
    } else {
      verdict = { ok: false, reason: `licence "${short || code || 'unknown'}"` };
    }
  } catch (e) { verdict = { ok: false, reason: e.message }; }

  if (verdict.ok) {
    kept.push({ it, ...verdict });
    console.log(`  ✓ ${it.slug} — ${verdict.short}${verdict.artist ? ' · ' + verdict.artist : ''}`);
  } else {
    await unlink(dest).catch(() => {});
    removed.push({ it, reason: verdict.reason });
    console.log(`  ✗ ${it.slug} REMOVED — ${verdict.reason}`);
  }
}

/* Rewrite the monuments section of IMAGE-CREDITS.md with verified rows only. */
const header = `# Image credits

Attribution log for external images. Inline SVG authored in this repo needs no
entry. Logos come from **Simple Icons (CC0)** — public domain, no attribution
required. Monument photos below were **automatically licence-verified** against
Wikimedia Commons by \`quizzes/tools/verify-licenses.mjs\`; only free licences
were kept.

## Monuments (\`assets/monuments/\`) — verified free licences

| File | Subject | Commons file | Licence | Author |
|------|---------|--------------|---------|--------|
`;
const rows = kept.map(k => `| monuments/${k.it.slug}.jpg | ${k.it.name} | ${k.file} | ${k.short} | ${k.artist || '—'} |`).join('\n');
await writeFile(join(ROOT, 'quizzes', 'IMAGE-CREDITS.md'), header + rows + '\n', 'utf8');

/* Machine-readable per-image attribution so the quiz can show CC BY credit. */
const creditsMap = {};
for (const k of kept) creditsMap[k.it.slug] = { license: k.short, author: k.artist || '', file: k.file };
await writeFile(join(MON, 'credits.json'), JSON.stringify(creditsMap, null, 2) + '\n', 'utf8');

console.log(`\nKept ${kept.length} verified-free, removed ${removed.length}.`);
if (removed.length) console.log('Removed:', removed.map(r => r.it.slug).join(', '));
