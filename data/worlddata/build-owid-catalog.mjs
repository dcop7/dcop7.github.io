/* Build a searchable catalogue of every Our World in Data grapher chart from
   their public sitemap. Stores just the slugs (titles are derived at runtime);
   selecting a result live-fetches that chart's CSV (CORS is open) and renders
   it inside the explorer. CC BY 4.0.
   Run: node data/worlddata/build-owid-catalog.mjs */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SITEMAPS = [
  'https://ourworldindata.org/sitemap.xml',
];
const slugs = new Set();
for (const sm of SITEMAPS) {
  try {
    const txt = await (await fetch(sm)).text();
    const re = /\/grapher\/([a-z0-9][a-z0-9-]*)/g; let m;
    while ((m = re.exec(txt))) slugs.add(m[1]);
  } catch (e) { console.log('sitemap fail', sm, e.message); }
}
const out = [...slugs].sort();
fs.writeFileSync(path.join(OUT, 'owid-catalog.json'), JSON.stringify(out));
console.log('charts:', out.length, '| size', (fs.statSync(path.join(OUT, 'owid-catalog.json')).size / 1024).toFixed(0) + 'KB');
