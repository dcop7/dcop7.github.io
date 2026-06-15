/* Validate data/f1/circuits.json — cross-check each curated track LENGTH against
   the OpenF1 location telemetry (1 unit = 10 cm, established empirically). For a
   circuit's most recent race it finds a clean mid-race lap from /laps, sums the
   /location path over that lap and compares km vs the curated value. Prints a
   PASS/FAIL report (tolerance 3%). Turns can't be derived, so they stay sourced.
   Run: node tools/f1/validate-circuits.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const circuits = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'f1', 'circuits.json'), 'utf8'));
const OF1 = 'https://api.openf1.org/v1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (path) => { const r = await fetch(OF1 + path); if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); };

// most recent Race session per circuit_short_name across 2023-2025
const sessByName = {};
for (const yr of [2023, 2024, 2025]) {
  try { for (const s of await get(`/sessions?session_name=Race&year=${yr}`)) sessByName[s.circuit_short_name] = s; }
  catch (e) { console.warn('sessions', yr, e.message); }
  await sleep(2300);
}

async function deriveKm(session) {
  // find a clean mid-race lap of one driver
  const laps = await get(`/laps?session_key=${session.session_key}`);
  await sleep(2300);
  const valid = laps.filter(l => l.lap_duration && l.lap_number > 3 && l.date_start);
  if (!valid.length) throw new Error('no laps');
  // a typical (median-ish) lap to avoid SC/pit laps
  const sorted = valid.slice().sort((a, b) => a.lap_duration - b.lap_duration);
  const ref = sorted[Math.floor(sorted.length * 0.25)];
  const drv = ref.driver_number, ln = ref.lap_number;
  const next = laps.find(l => l.driver_number === drv && l.lap_number === ln + 1);
  if (!next) throw new Error('no next lap');
  const from = ref.date_start, to = next.date_start;
  const loc = await get(`/location?session_key=${session.session_key}&driver_number=${drv}&date%3E${encodeURIComponent(from)}&date%3C${encodeURIComponent(to)}`);
  await sleep(2300);
  const pts = loc.filter(p => p.x || p.y).sort((a, b) => a.date < b.date ? -1 : 1);
  let units = 0;
  for (let i = 1; i < pts.length; i++) units += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return units * 0.10 / 1000;   // 1 unit = 10 cm → km
}

let pass = 0, fail = 0, skip = 0;
console.log('circuit         curated  derived   diff   result');
for (const [id, c] of Object.entries(circuits)) {
  if (id.startsWith('_')) continue;
  const s = c.of1 && sessByName[c.of1];
  if (!s) { console.log(`${id.padEnd(15)} ${String(c.length_km).padStart(6)}      —      —     SKIP (no OpenF1)`); skip++; continue; }
  try {
    const km = await deriveKm(s);
    const diff = (km - c.length_km) / c.length_km * 100;
    const ok = Math.abs(diff) <= 3;
    console.log(`${id.padEnd(15)} ${String(c.length_km).padStart(6)} ${km.toFixed(3).padStart(7)} ${(diff >= 0 ? '+' : '') + diff.toFixed(1)}%   ${ok ? 'PASS' : 'FAIL ⚠'}`);
    ok ? pass++ : fail++;
  } catch (e) { console.log(`${id.padEnd(15)} ${String(c.length_km).padStart(6)}      —      —     ERR (${e.message})`); skip++; }
}
console.log(`\n${pass} pass · ${fail} fail · ${skip} skip`);
