/* Build data/f1/cache.json — the slow F1 data (standings, calendar, last
   results) snapshotted server-side by the f1-refresh GitHub Action so the
   browser reads one local JSON first (fast, offline) and only hits the live
   API as a fallback / background refresh.

   Source: Jolpica (api.jolpi.ca, the Ergast successor) — free, open, no key.
   Run: node data/f1/build-f1.mjs */
import { writeFile } from 'node:fs/promises';

const JOL = 'https://api.jolpi.ca/ergast/f1';
const j = async path => {
  const r = await fetch(JOL + path, { headers: { 'User-Agent': 'dcop7.github.io F1 cache' } });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
};

const out = { generatedAt: new Date().toISOString() };
async function safe(label, fn, fallback) {
  try { out[label] = await fn(); console.log(`✓ ${label}`); }
  catch (e) { out[label] = fallback; console.warn(`⚠ ${label}: ${e.message}`); }
}

await safe('driverStandings', async () => (await j('/current/driverStandings.json')).MRData.StandingsTable.StandingsLists?.[0]?.DriverStandings || [], []);
await safe('constructorStandings', async () => (await j('/current/constructorStandings.json')).MRData.StandingsTable.StandingsLists?.[0]?.ConstructorStandings || [], []);
await safe('schedule', async () => (await j('/current.json')).MRData.RaceTable.Races || [], []);
await safe('lastResults', async () => (await j('/current/last/results.json')).MRData.RaceTable.Races?.[0] || null, null);

await writeFile(new URL('./cache.json', import.meta.url), JSON.stringify(out));
console.log('wrote data/f1/cache.json');
