/* ══════════════════════════════════════════════════════════════════
   F1 DATA — offline-first data layer for the Fórmula 1 section.
   Pure browser fetch, no backend (both APIs send
   `access-control-allow-origin: *`).

   Sources:
     • OpenF1  (api.openf1.org)  — live + historical timing: sessions,
       drivers (+team colour), running order, intervals, weather and the
       car X/Y location stream used to draw the track and the live cars.
     • Jolpica (api.jolpi.ca, the Ergast successor) — standings, calendar,
       results, qualifying; 1950→present.

   Slow data (standings/calendar/results) is cached daily into
   data/f1/cache.json by a GitHub Action and read from there first (fast,
   offline); it falls back to live Jolpica. Live data (session, weather,
   location) is always fetched live from OpenF1.

   Unofficial — not associated with Formula 1. F1, FORMULA 1 are trademarks
   of Formula One Licensing BV; used here nominatively for a fan/education
   project.
   ══════════════════════════════════════════════════════════════════ */
const F1Data = (function () {
  'use strict';

  const OF1 = 'https://api.openf1.org/v1';
  const JOL = 'https://api.jolpi.ca/ergast/f1';
  const CACHE_URL = 'data/f1/cache.json';

  const _mem = new Map();           // url -> { t, data }
  let _staticCache = null;          // the Action-built cache.json (or null)

  /* OpenF1 caps at 3 req/s (and 30/min). Serialise every OpenF1 network call
     through a ~360 ms spacing gate so bursts (Promise.all, startup) can't trip
     a 429 regardless of how callers issue them. */
  let _of1NextSlot = 0;
  function _of1Slot() {
    const now = Date.now(), at = Math.max(now, _of1NextSlot);
    _of1NextSlot = at + 360;
    return at <= now ? Promise.resolve() : new Promise(r => setTimeout(r, at - now));
  }

  /* ── low-level fetch with in-memory + sessionStorage cache ── */
  async function _get(url, ttlMs = 60000) {
    const hit = _mem.get(url);
    if (hit && Date.now() - hit.t < ttlMs) return hit.data;
    try {
      const raw = sessionStorage.getItem('f1:' + url);
      if (raw) { const o = JSON.parse(raw); if (Date.now() - o.t < ttlMs) { _mem.set(url, o); return o.data; } }
    } catch {}
    const isOF1 = url.startsWith(OF1);
    let data;
    for (let attempt = 0; ; attempt++) {
      if (isOF1) await _of1Slot();
      const r = await fetch(url, { cache: 'no-store' });
      if (r.status === 429 && attempt < 2) {                 // backoff + retry on rate limit
        const ra = parseFloat(r.headers.get('retry-after')) || 1.2;
        _of1NextSlot = Date.now() + ra * 1000 + 360;
        await new Promise(res => setTimeout(res, ra * 1000));
        continue;
      }
      // OpenF1 answers 404 "No results found" for an empty match — treat as []
      if (r.status === 404 && isOF1) { data = []; break; }
      if (!r.ok) throw new Error('http ' + r.status);
      data = await r.json();
      break;
    }
    const o = { t: Date.now(), data };
    _mem.set(url, o);
    try { sessionStorage.setItem('f1:' + url, JSON.stringify(o)); } catch {}
    return data;
  }

  async function _staticOr(key, liveFn) {
    if (_staticCache === null) {
      try { _staticCache = await _get(CACHE_URL, 3600000); } catch { _staticCache = false; }
    }
    if (_staticCache && _staticCache[key]) {
      // refresh in the background but return the cached value immediately
      liveFn().then(d => { if (d) _staticCache[key] = d; }).catch(() => {});
      return _staticCache[key];
    }
    return liveFn();
  }

  /* ════════════════════ OpenF1 (live + historical) ════════════════════ */
  const ofq = (path, params) => OF1 + path + (params ? '?' + params : '');

  async function latestSession() {
    const a = await _get(ofq('/sessions', 'session_key=latest'), 30000);
    return a && a[0];
  }
  async function latestMeeting() {
    const a = await _get(ofq('/meetings', 'meeting_key=latest'), 30000);
    return a && a[0];
  }
  async function sessionsForMeeting(meetingKey) {
    return _get(ofq('/sessions', 'meeting_key=' + meetingKey), 300000);
  }
  async function racesOfYear(year) {
    return _get(ofq('/sessions', 'session_name=Race&year=' + year), 600000);
  }
  async function drivers(sessionKey) {
    return _get(ofq('/drivers', 'session_key=' + sessionKey), 600000);
  }
  async function positions(sessionKey) {
    return _get(ofq('/position', 'session_key=' + sessionKey), 8000);
  }
  async function intervals(sessionKey) {
    return _get(ofq('/intervals', 'session_key=' + sessionKey), 8000);
  }
  async function weather(sessionKey) {
    return _get(ofq('/weather', 'session_key=' + sessionKey), 60000);
  }
  async function laps(sessionKey) {
    return _get(ofq('/laps', 'session_key=' + sessionKey), 30000);   // short TTL so live timing refreshes
  }
  /* Lights-out moment of a race = the lap 1 date_start (identical for every
     driver). The session's own date_start is ~3-4 min earlier (formation lap),
     which is why a window opened there shows cars spread out, not on the grid. */
  async function firstLapStart(sessionKey) {
    const a = await _get(ofq('/laps', 'session_key=' + sessionKey + '&lap_number=1'), 600000);
    const ts = (a || []).map(l => l.date_start && Date.parse(l.date_start)).filter(Boolean);
    return ts.length ? new Date(Math.min(...ts)).toISOString() : null;
  }
  /* Tyre stints (compound + lap range per driver). Small payload. */
  async function stints(sessionKey) {
    return _get(ofq('/stints', 'session_key=' + sessionKey), 30000);
  }
  /* Race control feed: flags, safety car, incidents, penalties. */
  async function raceControl(sessionKey) {
    return _get(ofq('/race_control', 'session_key=' + sessionKey), 8000);
  }
  /* Gaps. The full feed is ~25k rows, so callers should pass a date window. */
  async function intervalsWindow(sessionKey, from, to) {
    let p = 'session_key=' + sessionKey;
    if (from) p += '&date%3E' + encodeURIComponent(from);
    if (to) p += '&date%3C' + encodeURIComponent(to);
    return _get(ofq('/intervals', p), 8000);
  }
  /* Pit stops: lap, pit_duration (in pit lane) + stop_duration (stationary). */
  async function pit(sessionKey) {
    return _get(ofq('/pit', 'session_key=' + sessionKey), 8000);
  }
  /* Car telemetry: speed, throttle, brake, n_gear, rpm, drs (~3.7 Hz). HUGE for a
     whole race, so callers MUST pass a date window (e.g. one lap). */
  async function carData(sessionKey, { driver, from, to } = {}) {
    let p = 'session_key=' + sessionKey;
    if (driver != null) p += '&driver_number=' + driver;
    if (from) p += '&date%3E' + encodeURIComponent(from);
    if (to) p += '&date%3C' + encodeURIComponent(to);
    return _get(ofq('/car_data', p), 600000);
  }

  /* raw location points (for the track + cars). Optional ISO date window. */
  async function location(sessionKey, { driver, from, to } = {}) {
    let p = 'session_key=' + sessionKey;
    if (driver != null) p += '&driver_number=' + driver;
    if (from) p += '&date%3E' + encodeURIComponent(from);
    if (to) p += '&date%3C' + encodeURIComponent(to);
    return _get(ofq('/location', p), 600000);
  }

  /* Latest running order: keep the most recent position per driver. */
  function latestOrder(positionRows) {
    const byDriver = new Map();
    for (const r of (positionRows || [])) {
      const cur = byDriver.get(r.driver_number);
      if (!cur || r.date > cur.date) byDriver.set(r.driver_number, r);
    }
    return [...byDriver.values()].sort((a, b) => a.position - b.position);
  }
  function latestIntervals(intervalRows) {
    const byDriver = new Map();
    for (const r of (intervalRows || [])) {
      const cur = byDriver.get(r.driver_number);
      if (!cur || r.date > cur.date) byDriver.set(r.driver_number, r);
    }
    return byDriver;
  }

  /* ════════════════════ Jolpica (standings/calendar/etc.) ═══════════════ */
  const jol = path => _get(JOL + path, 600000);

  async function driverStandings() {
    return _staticOr('driverStandings', async () => {
      const d = await jol('/current/driverStandings.json');
      return d?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    });
  }
  async function constructorStandings() {
    return _staticOr('constructorStandings', async () => {
      const d = await jol('/current/constructorStandings.json');
      return d?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
    });
  }
  async function schedule() {
    return _staticOr('schedule', async () => {
      const d = await jol('/current.json');
      return d?.MRData?.RaceTable?.Races || [];
    });
  }
  async function lastResults() {
    return _staticOr('lastResults', async () => {
      const d = await jol('/current/last/results.json');
      return d?.MRData?.RaceTable?.Races?.[0] || null;
    });
  }
  /* Every round's winner in one light call (only position 1). Future-proof:
     pass a year, or omit for the current season. */
  async function seasonWinners(year) {
    const scope = (!year || +year === new Date().getFullYear()) ? 'current' : String(year);
    const run = async () => {
      const d = await jol(`/${scope}/results/1.json?limit=100`);
      return d?.MRData?.RaceTable?.Races || [];
    };
    return scope === 'current' ? _staticOr('seasonWinners', run) : run();
  }
  /* Standings for any season (current is cached). */
  async function driverStandingsFor(year) {
    if (!year || +year === new Date().getFullYear()) return driverStandings();
    const d = await jol(`/${year}/driverStandings.json`);
    return d?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
  }
  async function constructorStandingsFor(year) {
    if (!year || +year === new Date().getFullYear()) return constructorStandings();
    const d = await jol(`/${year}/constructorStandings.json`);
    return d?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
  }
  async function scheduleFor(year) {
    if (!year || +year === new Date().getFullYear()) return schedule();
    const d = await jol(`/${year}.json`);
    return d?.MRData?.RaceTable?.Races || [];
  }

  /* Curated, telemetry-validated circuit metadata (length + turns). */
  async function circuitsMeta() {
    try { return await _get('data/f1/circuits.json', 86400000); } catch { return {}; }
  }

  /* Every circuit that has ever hosted a championship round (~78). */
  async function allCircuits() {
    return _staticOr('circuits', async () => {
      const d = await jol('/circuits.json?limit=100');
      return d?.MRData?.CircuitTable?.Circuits || [];
    });
  }

  /* Computed season aggregates (wins/podiums/poles/FL/DNF/avg per driver +
     constructors) for ANY year. Cached by the Action for the current season;
     other years are paginated + computed live in the browser on demand. */
  function _computeStats(resRaces, qRaces) {
    const classified = pt => /^\d+$/.test(pt);
    const poles = {};
    for (const r of (qRaces || [])) for (const q of (r.QualifyingResults || [])) if (q.position === '1') poles[q.Driver.driverId] = (poles[q.Driver.driverId] || 0) + 1;
    const D = {}, C = {}; let rounds = 0;
    for (const race of (resRaces || [])) {
      rounds = Math.max(rounds, +race.round || 0);
      for (const r of (race.Results || [])) {
        const id = r.Driver.driverId, pos = +r.position, cl = classified(r.positionText);
        const d = D[id] || (D[id] = { id, code: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(), given: r.Driver.givenName, family: r.Driver.familyName, nat: r.Driver.nationality, team: r.Constructor.name, points: 0, wins: 0, podiums: 0, fl: 0, dnf: 0, top10: 0, races: 0, best: 99, _s: 0, _n: 0 });
        d.team = r.Constructor.name; d.points += +r.points || 0; d.races += 1;
        if (cl) { d._s += pos; d._n += 1; if (pos < d.best) d.best = pos; if (pos === 1) d.wins++; if (pos <= 3) d.podiums++; if (pos <= 10) d.top10++; } else d.dnf++;
        if (r.FastestLap?.rank === '1') d.fl++;
        const cid = r.Constructor.constructorId;
        const c = C[cid] || (C[cid] = { id: cid, name: r.Constructor.name, nat: r.Constructor.nationality, points: 0, wins: 0, podiums: 0, best: 99 });
        c.points += +r.points || 0;
        if (cl) { if (pos < c.best) c.best = pos; if (pos === 1) c.wins++; if (pos <= 3) c.podiums++; }
      }
    }
    const drivers = Object.values(D).map(d => ({ id: d.id, code: d.code, given: d.given, family: d.family, nat: d.nat, team: d.team, points: d.points, wins: d.wins, podiums: d.podiums, poles: poles[d.id] || 0, fl: d.fl, dnf: d.dnf, top10: d.top10, races: d.races, best: d.best === 99 ? null : d.best, avg: d._n ? +(d._s / d._n).toFixed(1) : null }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
    const constructors = Object.values(C).map(c => ({ ...c, best: c.best === 99 ? null : c.best })).sort((a, b) => b.points - a.points || b.wins - a.wins);
    return { rounds, drivers, constructors };
  }
  async function _pageAll(scope, kind) {
    const first = await jol(`/${scope}/${kind}.json?limit=100&offset=0`);
    const total = +first.MRData.total, races = [...(first.MRData.RaceTable.Races || [])];
    for (let off = 100; off < total; off += 100) {
      const pg = await jol(`/${scope}/${kind}.json?limit=100&offset=${off}`);
      races.push(...(pg.MRData.RaceTable.Races || []));
    }
    return races;
  }
  async function _statsLive(scope) {
    const resRaces = await _pageAll(scope, 'results');
    let qRaces = []; try { qRaces = await _pageAll(scope, 'qualifying'); } catch {}
    return _computeStats(resRaces, qRaces);
  }
  async function seasonStats() {
    return _staticOr('seasonStats', () => _statsLive('current'));
  }
  /* Stats for a specific year — current season comes from cache, past years are
     computed live (paginated). Year strings are used directly as the Ergast scope. */
  async function seasonStatsFor(year) {
    const cur = new Date().getFullYear();
    if (!year || +year === cur) return seasonStats();
    return _statsLive(String(year));
  }

  /* From the schedule, the next upcoming race and the most recent past one. */
  function splitSchedule(races) {
    const now = Date.now();
    const withTs = (races || []).map(r => {
      const t = Date.parse(`${r.date}T${r.time || '12:00:00Z'}`);
      return { ...r, _ts: t };
    });
    const past = withTs.filter(r => r._ts < now).sort((a, b) => b._ts - a._ts);
    const upcoming = withTs.filter(r => r._ts >= now).sort((a, b) => a._ts - b._ts);
    return { next: upcoming[0] || null, last: past[0] || null, past, upcoming, all: withTs };
  }

  return {
    latestSession, latestMeeting, sessionsForMeeting, racesOfYear,
    drivers, positions, intervals, weather, location, laps,
    firstLapStart, stints, raceControl, intervalsWindow, pit, carData,
    latestOrder, latestIntervals, circuitsMeta, allCircuits, seasonStats, seasonStatsFor,
    driverStandings, constructorStandings, schedule, lastResults, splitSchedule,
    seasonWinners, driverStandingsFor, constructorStandingsFor, scheduleFor,
  };
})();
