/* Build data/f1/cache.json — the slow F1 data (standings, calendar, last
   results, full circuit list and computed season stats) snapshotted
   server-side by the f1-refresh GitHub Action so the browser reads one local
   JSON first (fast, offline) and only hits the live API as a fallback.

   Source: Jolpica (api.jolpi.ca, the Ergast successor) — free, open, no key.
   Run: node data/f1/build-f1.mjs */
import { writeFile } from 'node:fs/promises';

const JOL = 'https://api.jolpi.ca/ergast/f1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async path => {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(JOL + path, { headers: { 'User-Agent': 'dcop7.github.io F1 cache' } });
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }   // be polite to the shared API
    if (!r.ok) throw new Error(`${path} → ${r.status}`);
    return r.json();
  }
  throw new Error(`${path} → 429 (gave up)`);
};

/* fetch every page of a paginated Ergast list (results / qualifying) */
async function jAll(path) {
  const sep = path.includes('?') ? '&' : '?';
  const first = await j(`${path}${sep}limit=100&offset=0`);
  const total = +first.MRData.total;
  const races = [...(first.MRData.RaceTable.Races || [])];
  for (let off = 100; off < total; off += 100) {
    await sleep(700);
    const pg = await j(`${path}${sep}limit=100&offset=${off}`);
    races.push(...(pg.MRData.RaceTable.Races || []));
  }
  // merge Races split across pages by round
  const byRound = new Map();
  for (const r of races) {
    const cur = byRound.get(r.round);
    if (!cur) byRound.set(r.round, r);
    else {
      if (r.Results) cur.Results = (cur.Results || []).concat(r.Results);
      if (r.QualifyingResults) cur.QualifyingResults = (cur.QualifyingResults || []).concat(r.QualifyingResults);
    }
  }
  return [...byRound.values()];
}

const classified = pt => /^\d+$/.test(pt);

/* season aggregates per driver + per constructor from full results + qualifying */
async function computeSeasonStats() {
  const resRaces = await jAll('/current/results.json');
  await sleep(700);
  let qRaces = [];
  try { qRaces = await jAll('/current/qualifying.json'); } catch (e) { console.warn('quali:', e.message); }

  const polesByDriver = {};
  for (const race of qRaces) {
    for (const q of (race.QualifyingResults || [])) {
      if (q.position === '1') polesByDriver[q.Driver.driverId] = (polesByDriver[q.Driver.driverId] || 0) + 1;
    }
  }

  const D = {}, C = {};
  let rounds = 0;
  for (const race of resRaces) {
    rounds = Math.max(rounds, +race.round || 0);
    for (const r of (race.Results || [])) {
      const id = r.Driver.driverId;
      const d = D[id] || (D[id] = { id, code: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(),
        given: r.Driver.givenName, family: r.Driver.familyName, nat: r.Driver.nationality,
        team: r.Constructor.name, points: 0, wins: 0, podiums: 0, fl: 0, dnf: 0, top10: 0,
        races: 0, best: 99, _sumFin: 0, _nFin: 0 });
      d.team = r.Constructor.name;
      d.points += +r.points || 0;
      d.races += 1;
      const pos = +r.position;
      if (classified(r.positionText)) {
        d._sumFin += pos; d._nFin += 1;
        if (pos < d.best) d.best = pos;
        if (pos === 1) d.wins += 1;
        if (pos <= 3) d.podiums += 1;
        if (pos <= 10) d.top10 += 1;
      } else { d.dnf += 1; }
      if (r.FastestLap?.rank === '1') d.fl += 1;

      const cid = r.Constructor.constructorId;
      const c = C[cid] || (C[cid] = { id: cid, name: r.Constructor.name, nat: r.Constructor.nationality,
        points: 0, wins: 0, podiums: 0, best: 99 });
      c.points += +r.points || 0;
      if (classified(r.positionText)) {
        if (pos < c.best) c.best = pos;
        if (pos === 1) c.wins += 1;
        if (pos <= 3) c.podiums += 1;
      }
    }
  }

  const drivers = Object.values(D).map(d => ({
    id: d.id, code: d.code, given: d.given, family: d.family, nat: d.nat, team: d.team,
    points: d.points, wins: d.wins, podiums: d.podiums, poles: polesByDriver[d.id] || 0,
    fl: d.fl, dnf: d.dnf, top10: d.top10, races: d.races,
    best: d.best === 99 ? null : d.best,
    avg: d._nFin ? +(d._sumFin / d._nFin).toFixed(1) : null,
  })).sort((a, b) => b.points - a.points || b.wins - a.wins);

  const constructors = Object.values(C).map(c => ({ ...c, best: c.best === 99 ? null : c.best }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  return { rounds, drivers, constructors, generatedAt: new Date().toISOString() };
}

const out = { generatedAt: new Date().toISOString() };
async function safe(label, fn, fallback) {
  try { out[label] = await fn(); console.log(`✓ ${label}`); }
  catch (e) { out[label] = fallback; console.warn(`⚠ ${label}: ${e.message}`); }
}

await safe('driverStandings', async () => (await j('/current/driverStandings.json')).MRData.StandingsTable.StandingsLists?.[0]?.DriverStandings || [], []);
await sleep(500);
await safe('constructorStandings', async () => (await j('/current/constructorStandings.json')).MRData.StandingsTable.StandingsLists?.[0]?.ConstructorStandings || [], []);
await sleep(500);
await safe('schedule', async () => (await j('/current.json')).MRData.RaceTable.Races || [], []);
await sleep(500);
await safe('lastResults', async () => (await j('/current/last/results.json')).MRData.RaceTable.Races?.[0] || null, null);
await sleep(500);
// every circuit that has ever hosted a championship round (78), for the Circuit tab's "all circuits" group
await safe('circuits', async () => (await j('/circuits.json?limit=100')).MRData.CircuitTable.Circuits || [], []);
await sleep(500);
await safe('seasonStats', computeSeasonStats, null);

await writeFile(new URL('./cache.json', import.meta.url), JSON.stringify(out));
console.log('wrote data/f1/cache.json');
