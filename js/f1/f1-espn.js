/* ══════════════════════════════════════════════════════════════════
   F1 ESPN — free live source used WHEN OpenF1 is unavailable.

   As of 2026 OpenF1 blocks unauthenticated/global API access *during* a
   live session (HTTP 401: "Live F1 session in progress … restricted to
   authenticated users until the session ends") — i.e. exactly when live
   timing matters. ESPN's public racing API stays open during the race
   (CORS `*`, HTTPS, no key) and gives the live running order, current lap,
   gap-to-leader, pit count and team colours — everything except the car
   X/Y telemetry (the animated map), which only OpenF1 streams.

   So this module powers a live timing board on the Pista/Tempos/Piloto
   tabs while a race is running; once the session ends OpenF1 frees up and
   the full telemetry replay/map takes over again.

   Unofficial — not associated with Formula 1 or ESPN. Endpoints used:
     • site.api.espn.com  …/racing/f1/scoreboard        (live order + lap)
     • sports.core.api.espn.com …/competitors            (team · colour · #)
     • …/competitors/{id}/statistics                     (gap · laps · pits)
   ══════════════════════════════════════════════════════════════════ */
const F1Espn = (function () {
  'use strict';

  const SB = 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard';
  const CORE = 'https://sports.core.api.espn.com/v2/sports/racing/leagues/f1';

  const _mem = new Map();                              // url -> { t, data }
  async function _get(url, ttl = 8000) {
    const hit = _mem.get(url);
    if (hit && Date.now() - hit.t < ttl) return hit.data;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('espn ' + r.status);
    const data = await r.json();
    _mem.set(url, { t: Date.now(), data });
    return data;
  }
  // run fn over arr with at most n in flight (keep the per-driver stat fan-out polite)
  async function _mapLimit(arr, n, fn) {
    const out = new Array(arr.length); let i = 0;
    const worker = async () => { while (i < arr.length) { const k = i++; out[k] = await fn(arr[k], k); } };
    await Promise.all(Array.from({ length: Math.min(n, arr.length) || 1 }, worker));
    return out;
  }
  const isRace = c => /race/i.test((c && c.type && (c.type.abbreviation || c.type.text)) || '');

  /* The race running RIGHT NOW from the public scoreboard (one request, CORS-open
     even mid-session). Returns null unless a Race competition is actually live. */
  async function liveRace() {
    let d; try { d = await _get(SB, 8000); } catch { return null; }
    for (const e of (d.events || [])) {
      const c = (e.competitions || []).find(isRace);
      if (!c || !c.status || !c.status.type || c.status.type.state !== 'in') continue;
      const drivers = (c.competitors || []).map(cm => ({
        id: String(cm.id),
        order: +cm.order || 99,
        winner: !!cm.winner,
        name: (cm.athlete && (cm.athlete.displayName || cm.athlete.fullName)) || '',
        short: (cm.athlete && cm.athlete.shortName) || '',
        flag: (cm.athlete && cm.athlete.flag && cm.athlete.flag.href) || '',
      })).sort((a, b) => a.order - b.order);
      if (!drivers.length) continue;
      return {
        eventId: String(e.id), compId: String(c.id),
        name: e.shortName || e.name || '', full: e.name || '',
        circuit: (e.circuit && e.circuit.fullName) || '',
        lap: +c.status.period || 0, drivers, source: 'ESPN',
      };
    }
    return null;
  }

  /* Per-athlete team · colour · number (changes rarely → cache for the session). */
  const _roster = new Map();
  async function roster(eventId, compId) {
    const key = eventId + '/' + compId;
    if (_roster.has(key)) return _roster.get(key);
    const m = {};
    try {
      const d = await _get(`${CORE}/events/${eventId}/competitions/${compId}/competitors?lang=en&limit=50`, 600000);
      for (const it of (d.items || [])) {
        const v = it.vehicle || {};
        m[String(it.id)] = {
          num: v.number || '',
          team: v.manufacturer || '',
          colour: v.teamColor ? ('#' + String(v.teamColor).replace('#', '')) : '',
        };
      }
    } catch {}
    _roster.set(key, m);
    return m;
  }

  /* Live per-driver stats: laps completed, pit stops, place, gap to leader. */
  async function stats(eventId, compId, athleteId) {
    const d = await _get(`${CORE}/events/${eventId}/competitions/${compId}/competitors/${athleteId}/statistics?lang=en`, 6000);
    const cats = (d.splits && d.splits.categories) || d.categories || [];
    const out = {};
    for (const c of cats) for (const s of (c.stats || [])) {
      if (s.name === 'lapsCompleted') out.laps = +s.value || +s.displayValue || 0;
      else if (s.name === 'pitsTaken') out.pits = +s.value || 0;
      else if (s.name === 'place') out.place = +s.value || 0;
      else if (s.name === 'lapsLead') out.lapsLead = +s.value || 0;
      else if (s.name === 'gapToLeader') out.gap = s.displayValue || '';
    }
    return out;
  }

  /* Full live board: order · driver · team/colour · lap · gap · pits.
     One scoreboard call + one stats call per driver (≤8 in flight). */
  async function liveBoard() {
    const lr = await liveRace(); if (!lr) return null;
    const ros = await roster(lr.eventId, lr.compId);
    const rows = await _mapLimit(lr.drivers, 8, async d => {
      let s = {}; try { s = await stats(lr.eventId, lr.compId, d.id); } catch {}
      const r = ros[d.id] || {};
      // scoreboard `order` is the authoritative live position; the per-driver
      // `place` stat goes stale for retired/lapped cars (can duplicate P1).
      const pos = d.order || s.place || 99;
      return {
        id: d.id, pos, name: d.name, short: d.short, flag: d.flag,
        num: r.num, team: r.team, colour: r.colour,
        laps: s.laps || 0, pits: s.pits || 0,
        gap: pos === 1 ? '' : (s.gap || ''), leader: pos === 1, winner: d.winner,
      };
    });
    rows.sort((a, b) => (a.pos || 99) - (b.pos || 99));
    return { eventId: lr.eventId, compId: lr.compId, name: lr.name, full: lr.full, circuit: lr.circuit, lap: lr.lap, rows, source: 'ESPN' };
  }

  return { liveRace, liveBoard };
})();
