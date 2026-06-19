/* Enrich data/f1/circuits.json with length_km + turns for EVERY circuit that has
   ever hosted a championship round (78), so the Circuit tab shows length/turns
   for historic tracks too — not just the current season's curated+telemetry-
   validated set.

   - Existing entries (the current GP layouts, telemetry-validated to ~2% by
     tools/f1/validate-circuits.mjs) are KEPT untouched.
   - Missing circuits get length_km + turns parsed from the English Wikipedia
     infobox of the circuit's article (the page Jolpica/Ergast links to). This is
     the circuit's primary/current layout — the same source already cited for the
     curated set, just not telemetry-validated (no OpenF1 data exists pre-2023).
   - `of1` (OpenF1 circuit_short_name) is added for the few non-season circuits
     that DO have OpenF1 telemetry (Imola, Jeddah, Bahrain) so their map works.

   Run: node tools/f1/enrich-circuits.mjs   (then `node tools/f1/validate-circuits.mjs`)
*/
import { readFile, writeFile } from 'node:fs/promises';

const J = 'https://api.jolpi.ca/ergast/f1';
const UA = { 'User-Agent': 'dcop7.github.io F1 circuit enrichment (educational/non-commercial)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// non-season circuits that nonetheless have OpenF1 telemetry → give them a map
const OF1_EXTRA = { imola: 'Imola', jeddah: 'Jeddah', bahrain: 'Sakhir' };

/* Circuits whose Wikipedia infobox describes the CURRENT layout, not the one F1
   actually raced (or list several configs and the auto-parse picked the wrong
   one). These are the well-documented F1-era figures; turns left null where the
   exact count isn't certain (shown as "—" rather than a guess). */
const OVERRIDE = {
  indianapolis: { length_km: 4.192, turns: 13 },   // F1 road course 2000–2007 (infobox = the oval)
  sochi:        { length_km: 5.848, turns: 18 },   // Sochi Autodrom GP layout
  lemans:       { length_km: 4.185, turns: 14 },   // Bugatti Circuit (infobox = the 24h circuit)
  jacarepagua:  { length_km: 5.031, turns: null }, // Nelson Piquet GP layout (infobox = later short config)
  dallas:       { length_km: 3.901, turns: null }, // Fair Park, 1984 Dallas GP
  detroit:      { length_km: 4.023, turns: null }, // Detroit street circuit, F1 1982–88
  long_beach:   { length_km: 3.275, turns: null }, // Long Beach GP, F1 era (no infobox length)
  pescara:      { length_km: 25.801, turns: null },// longest circuit ever used in F1 (1957)
  watkins_glen: { length_km: 5.552, turns: 11 },   // Grand Prix long course
};

async function jget(p) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(J + p, { headers: UA });
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${p} → ${r.status}`);
    return r.json();
  }
  throw new Error(`${p} → 429`);
}

const titleFromUrl = u => decodeURIComponent((u || '').split('/wiki/')[1] || '').replace(/_/g, ' ');

async function wikiInfobox(title) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
  let wt = '';
  for (let i = 0; ; i++) {
    const r = await fetch(u, { headers: UA });
    const text = await r.text();
    if (r.ok && text[0] === '{') {              // got JSON, not a throttle HTML page
      const pages = JSON.parse(text).query?.pages || {};
      wt = pages[Object.keys(pages)[0]]?.revisions?.[0]?.slots?.main?.['*'] || '';
      break;
    }
    if (i >= 5) throw new Error('wiki throttled');
    await sleep(2000 * (i + 1));                // back off on 429 / throttle page
  }
  const km = wt.match(/\|\s*length_km\s*=\s*([\d.]+)/i);
  const mi = wt.match(/\|\s*length_mi\s*=\s*([\d.]+)/i);
  const turns = wt.match(/\|\s*turns\s*=\s*(\d+)/i);
  return {
    length_km: km ? +km[1] : (mi ? +(+mi[1] * 1.609344).toFixed(3) : null),
    turns: turns ? +turns[1] : null,
  };
}

const meta = JSON.parse(await readFile(new URL('../../data/f1/circuits.json', import.meta.url)));
const circuits = (await jget('/circuits.json?limit=100')).MRData.CircuitTable.Circuits;

let filled = 0, kept = 0, failed = [];
for (const c of circuits) {
  const id = c.circuitId;
  const cur = meta[id];
  // add of1 for telemetry-capable non-season circuits even if otherwise present
  if (OF1_EXTRA[id] && (!cur || !cur.of1)) meta[id] = { ...(cur || {}), of1: OF1_EXTRA[id] };

  if (cur && cur.length_km) { kept++; continue; }   // keep curated/validated entries
  try {
    const ib = await wikiInfobox(titleFromUrl(c.url));
    if (!ib.length_km) { failed.push(id); }
    meta[id] = { ...(meta[id] || {}), length_km: ib.length_km, turns: ib.turns, src: 'wikipedia' };
    filled++;
    console.log(`+ ${id.padEnd(16)} ${ib.length_km ? ib.length_km + ' km' : '—'} · ${ib.turns ?? '—'} turns`);
  } catch (e) { failed.push(id); console.warn(`⚠ ${id}: ${e.message}`); }
  await sleep(600);
}

// curated F1-era corrections always win (and fill the few the infobox can't)
for (const [id, v] of Object.entries(OVERRIDE)) { meta[id] = { ...(meta[id] || {}), ...v, src: 'curated-f1' }; }

meta._source = 'Comprimento e curvas: layouts atuais de GP validados com telemetria OpenF1 (1 unidade = 10 cm, tools/f1/validate-circuits.mjs); circuitos históricos a partir do infobox da Wikipedia (layout principal/atual — pode diferir do traçado exato usado pela F1), com correções curadas para a era F1 em alguns casos (Indianápolis, Sochi, Le Mans-Bugatti, etc.). Não validados por telemetria (sem dados OpenF1 antes de 2023). `of1` = circuit_short_name na OpenF1.';

// stable key order: _source first, then alphabetical
const ordered = { _source: meta._source };
for (const k of Object.keys(meta).filter(k => k !== '_source').sort()) ordered[k] = meta[k];
await writeFile(new URL('../../data/f1/circuits.json', import.meta.url), JSON.stringify(ordered, null, 2) + '\n');

console.log(`\nkept ${kept} · filled ${filled} · no length: ${failed.length ? failed.join(', ') : 'none'}`);
console.log(`total circuits in meta: ${Object.keys(ordered).length - 1}`);
