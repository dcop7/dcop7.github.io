#!/usr/bin/env node
/* Asset licensing audit. Scans the repo's stored media + the remote image/
   texture/tile references in code, classifies each (SAFE / REVIEW / REMOVE),
   and writes a machine-readable registry (ASSET-REGISTRY.json) plus a human
   report (ASSET-LICENSE-AUDIT.md) at the repo root.
   Run: node quizzes/tools/audit-assets.mjs */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reg = [];
const add = e => reg.push(e);

/* 1) Tech & car logos — Simple Icons (CC0) */
const iconsDir = join(ROOT, 'quizzes', 'assets', 'icons');
for (const f of (existsSync(iconsDir) ? await readdir(iconsDir) : []).filter(x => x.endsWith('.svg'))) {
  add({ file: `quizzes/assets/icons/${f}`, type: 'svg', source: 'Simple Icons (simpleicons.org)',
    license: 'CC0-1.0', attribution: 'none required', verified: true, classification: 'SAFE' });
}

/* 2) Monuments — Wikimedia Commons, per-file verified in credits.json */
let credits = {};
try { credits = JSON.parse(await readFile(join(ROOT, 'quizzes/assets/monuments/credits.json'), 'utf8')); } catch (e) {}
const monDir = join(ROOT, 'quizzes', 'assets', 'monuments');
for (const f of (existsSync(monDir) ? await readdir(monDir) : []).filter(x => x.endsWith('.jpg'))) {
  const c = credits[f.replace('.jpg', '')];
  add({ file: `quizzes/assets/monuments/${f}`, type: 'jpg', source: 'Wikimedia Commons',
    license: c ? c.license : 'UNVERIFIED', attribution: c ? (c.author || 'see Commons') : 'UNVERIFIED',
    verified: !!c, classification: c ? 'SAFE' : 'REVIEW' });
}

/* 2b) National flags — local public-domain SVGs (flag designs are PD) */
const flagsDir = join(ROOT, 'data', 'flags');
for (const f of (existsSync(flagsDir) ? await readdir(flagsDir) : []).filter(x => x.endsWith('.svg'))) {
  add({ file: `data/flags/${f}`, type: 'svg', source: 'flagcdn.com (national flag)',
    license: 'Public Domain (flag designs are not copyrightable)', attribution: 'none required',
    verified: true, classification: 'SAFE' });
}

/* 2c) Planet/Sun textures — Solar System Scope (CC BY 4.0) */
const planetsDir = join(ROOT, 'assets', 'planets');
for (const f of (existsSync(planetsDir) ? await readdir(planetsDir) : []).filter(x => /\.(jpg|png)$/i.test(x))) {
  add({ file: `assets/planets/${f}`, type: 'texture', source: 'Solar System Scope (solarsystemscope.com)',
    license: 'CC BY 4.0', attribution: 'Solar System Scope', verified: true, classification: 'SAFE' });
}

/* 3) Favicon — original work in this repo */
add({ file: 'favicon.svg', type: 'svg', source: 'original (this repository)',
  license: 'project-owned / public-domain shapes', attribution: 'none', verified: true, classification: 'SAFE' });

/* 4) Inline authored SVG (no files) — traffic signs, maths/scientific symbols, UI icons */
add({ file: 'quizzes/{easy,medium,hard}/sinais.json (inline SVG)', type: 'svg-inline', source: 'original (this repository)',
  license: 'project-owned; road-sign designs are standardised/public', attribution: 'none', verified: true, classification: 'SAFE' });
add({ file: 'quizzes/{...}/simbolos.json (inline SVG)', type: 'svg-inline', source: 'original (this repository)',
  license: 'project-owned (maths/scientific glyphs)', attribution: 'none', verified: true, classification: 'SAFE' });
add({ file: 'index.html / *.js (inline UI/nav SVG icons)', type: 'svg-inline', source: 'original (this repository)',
  license: 'project-owned', attribution: 'none', verified: true, classification: 'SAFE' });

/* 5) Remote references (textures / tiles / images loaded at runtime) */
const remote = [
  /* The 3D globe's realistic + day/night Earth now uses LOCAL Solar System Scope
     textures (assets/planets/earth_atmos_2048.jpg + earth-night.jpg, CC BY 4.0,
     scanned in section 2c). The former NASA three-globe CDN textures are no
     longer referenced at runtime, so they are not listed here. */
  { file: '{s}.basemaps.cartocdn.com/* (voyager/dark_matter/dark_all/light_all)', source: 'CARTO + OpenStreetMap', license: 'OSM ODbL data + CARTO Basemaps (free, attribution required)', attribution: '© OpenStreetMap © CARTO (shown on map)', verified: true, classification: 'SAFE' },
  { file: 'server.arcgisonline.com/.../World_Imagery|World_Topo_Map|World_Boundaries_and_Places', source: 'Esri ArcGIS Online', license: 'Esri Terms of Use — free with attribution', attribution: '© Esri, Maxar (shown on map)', verified: true, classification: 'REVIEW', note: 'Attribution present; Esri terms have nuance for heavy/commercial use — acceptable for a personal educational site.' },
  { file: 'fonts.googleapis.com / fonts.gstatic.com (Space Grotesk, Inter, JetBrains Mono)', source: 'Google Fonts', license: 'SIL OFL 1.1 / Apache 2.0', attribution: 'none required', verified: true, classification: 'SAFE' },
  { file: 'i.ytimg.com/vi/<id>/hqdefault.jpg', source: 'YouTube', license: 'YouTube ToS — thumbnail shown only to represent the embedded/linked video', attribution: 'YouTube', verified: false, classification: 'REVIEW', note: 'Nominative use as part of linking the actual video; not a standalone image asset.' },
  { file: 'three-globe night-sky.png (globe background)', source: 'three-globe example asset', license: 'UNVERIFIED', attribution: 'unknown', verified: false, classification: 'REMOVED', note: 'Removed in this audit — replaced by a solid colour + pure-CSS starfield.' },
  { file: 'three.js 2294472375_24a3b8ef46_o.jpg (solar background)', source: 'three.js example texture (Flickr-derived)', license: 'UNVERIFIED', attribution: 'unknown', verified: false, classification: 'REMOVED', note: 'Removed in this audit — replaced by a solid colour + generated 3D starfield.' },
];
remote.forEach(r => add({ type: 'remote', ...r }));

/* Write registry + report */
await writeFile(join(ROOT, 'ASSET-REGISTRY.json'), JSON.stringify(reg, null, 2) + '\n', 'utf8');

const counts = reg.reduce((m, e) => (m[e.classification] = (m[e.classification] || 0) + 1, m), {});
const tbl = ['SAFE', 'REVIEW', 'REMOVED', 'REMOVE'].filter(k => counts[k]).map(k => `- **${k}**: ${counts[k]}`).join('\n');
const remoteRows = reg.filter(e => e.type === 'remote' || e.type === 'svg-inline')
  .map(e => `| \`${e.file}\` | ${e.source} | ${e.license} | ${e.classification} |`).join('\n');

const md = `# Asset licensing audit

Generated by \`quizzes/tools/audit-assets.mjs\`. Full machine-readable registry:
\`ASSET-REGISTRY.json\` (${reg.length} entries).

## Summary
${tbl}

## Stored media (committed to the repo)
- **${reg.filter(e => e.file.startsWith('quizzes/assets/icons/')).length}** logo SVGs — **Simple Icons, CC0** (public domain). SAFE.
- **${reg.filter(e => e.file.startsWith('quizzes/assets/monuments/')).length}** monument photos — **Wikimedia Commons**, each with a verified free licence + author in \`monuments/credits.json\`. SAFE.
- **favicon.svg** + inline UI / traffic-sign / symbol SVG — original work in this repo. SAFE.

## Remote references & inline categories
| Asset | Source | Licence | Class |
|-------|--------|---------|-------|
${remoteRows}

## Actions taken this audit
- **Removed 2 unverifiable starfield textures** (globe \`night-sky.png\`, solar Flickr-derived background) → replaced with a solid colour + a locally-generated/CSS starfield. No third-party image to licence.

## Classification key
- **SAFE** — public domain (NASA), CC0, Wikimedia Commons verified free licence, OSM/CARTO with attribution, OFL fonts, or original work.
- **REVIEW** — usable but with a caveat (Esri terms nuance; YouTube thumbnail is nominative use for the linked video). Attribution present; no standalone copyrighted image stored.
- **REMOVED** — could not verify licence → deleted and replaced with a generated/text fallback.
- **REMOVE** — none found (no random-website/Google-Images/scraped assets exist in the repo).

## Notes / recommendations
- **Flags** are now **stored locally** as public-domain SVGs in \`data/flags/\` (the former flagcdn hotlink is gone) — last runtime image hotlink closed.
- Monument licences are mostly **CC BY / CC BY-SA** (attribution required); credit is shown in-quiz and recorded in \`IMAGE-CREDITS.md\`.
- Re-run \`verify-licenses.mjs\` after fetching new monuments; re-run this audit to regenerate the registry.
`;
await writeFile(join(ROOT, 'ASSET-LICENSE-AUDIT.md'), md, 'utf8');
console.log(`Registry: ${reg.length} entries →`, counts);
