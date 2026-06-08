/* Build a searchable catalogue of World Bank WDI indicators (code + name).
   Searched locally; selecting one live-fetches its data from the World Bank API
   (CORS open) and renders it. World Bank Open Data — CC BY 4.0.
   Run: node data/worlddata/build-wb-catalog.mjs */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const out = [];
let page = 1, pages = 1;
do {
  const url = `https://api.worldbank.org/v2/indicator?format=json&source=2&per_page=500&page=${page}`;
  const j = await (await fetch(url)).json();
  pages = j[0].pages;
  for (const it of j[1]) if (it.id && it.name) out.push([it.id, it.name]);
  process.stdout.write(`page ${page}/${pages} (${out.length})\r`);
  page++;
} while (page <= pages);

fs.writeFileSync(path.join(OUT, 'wb-catalog.json'), JSON.stringify(out));
console.log('\nWB indicators:', out.length, '| size', (fs.statSync(path.join(OUT, 'wb-catalog.json')).size / 1024).toFixed(0) + 'KB');
