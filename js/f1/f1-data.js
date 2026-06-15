/* ══════════════════════════════════════════════════════════════════
   F1 DATA — offline-first data layer for the (experimental) Fórmula 1
   section. Pure browser fetch, no backend (both APIs send
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

  /* ── low-level fetch with in-memory + sessionStorage cache ── */
  async function _get(url, ttlMs = 60000) {
    const hit = _mem.get(url);
    if (hit && Date.now() - hit.t < ttlMs) return hit.data;
    try {
      const raw = sessionStorage.getItem('f1:' + url);
      if (raw) { const o = JSON.parse(raw); if (Date.now() - o.t < ttlMs) { _mem.set(url, o); return o.data; } }
    } catch {}
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
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
    return _get(ofq('/laps', 'session_key=' + sessionKey), 600000);
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

  /* Curated, telemetry-validated circuit metadata (length + turns). */
  async function circuitsMeta() {
    try { return await _get('data/f1/circuits.json', 86400000); } catch { return {}; }
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
    latestOrder, latestIntervals, circuitsMeta,
    driverStandings, constructorStandings, schedule, lastResults, splitSchedule,
  };
})();
