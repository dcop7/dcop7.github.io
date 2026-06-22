/* ══════════════════════════════════════════════════════════════════
   F1 PAGE — "Fórmula 1" section. Tabs: Corrida · Pista (live/replay) ·
   Live Timing · Piloto · Tempos · Circuito · Campeonato · Calendário ·
   Estatísticas. Mobile-friendly, offline-first via F1Data, no backend.
   ══════════════════════════════════════════════════════════════════ */
const F1Page = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  let _root = null, _inited = false, _tab = 'race', _track = null, _ctrack = null, _liveTimer = null, _pendingDriver = null, _circMap = null, _satMap = null;
  function _killMaps() { try { _circMap && _circMap.remove(); } catch {} try { _satMap && _satMap.remove(); } catch {} _circMap = null; _satMap = null; }

  /* Lazy-load Leaflet (same CDN the Explorer uses) for the real circuit map. */
  function _loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        document.head.appendChild(Object.assign(document.createElement('link'),
          { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }));
      }
      const ex = document.querySelector('script[src*="leaflet@1.9.4"]');
      if (ex) { ex.addEventListener('load', resolve); ex.addEventListener('error', reject); if (window.L) resolve(); return; }
      const s = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  /* Real map of a circuit (license-clean, keyless): CARTO (OSM) or Esri satellite,
     both with attribution — the same tile sources used by the Portugal explorer. */
  const REALMAP_TILES = {
    map: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', sub: 'abcd', attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>' },
    sat: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: '', attr: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics' },
  };
  /* A STATIC satellite map sized to sit *behind* the animated schematic: no
     pan/zoom, georeferenced from the telemetry outline (OpenF1 ≈ decimetres,
     north-up) so the real circuit lines up with the drawn track + cars. */
  async function makeSatMapBehind(container, outline, lat, lon, theta) {
    await _loadLeaflet();
    const map = L.map(container, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0, fadeAnimation: false });
    const t = REALMAP_TILES.sat;
    L.tileLayer(t.url, { attribution: t.attr, maxZoom: 20, opacity: 0.95 }).addTo(map);
    let cx = 0, cy = 0; for (const p of outline) { cx += p.x; cy += p.y; } cx /= outline.length; cy /= outline.length;
    const mLat = 111320, mLon = 111320 * Math.cos(lat * Math.PI / 180);
    const c = Math.cos(theta || 0), s = Math.sin(theta || 0);
    const bounds = L.latLngBounds();
    for (const p of outline) { const dx = p.x - cx, dy = p.y - cy, rx = dx * c - dy * s, ry = dx * s + dy * c; bounds.extend([lat + (ry / 10) / mLat, lon + (rx / 10) / mLon]); }
    const pad = () => [Math.max(8, container.clientWidth * 0.06), Math.max(8, container.clientHeight * 0.06)];
    map.fitBounds(bounds, { padding: pad(), animate: false });
    setTimeout(() => { try { map.invalidateSize(); map.fitBounds(bounds, { padding: pad(), animate: false }); } catch {} }, 70);
    return map;
  }

  /* Derive the rotation that turns the telemetry frame north-up, by matching the
     edge-orientation distribution of the lap outline to the real circuit geometry
     from OpenStreetMap (Overpass). Cached per circuit; 0 if OSM is unavailable or
     the fit is poor. */
  const _rotCache = new Map();
  async function circuitRotation(outline, lat, lon, key) {
    if (_rotCache.has(key)) return _rotCache.get(key);
    let res = { theta: 0, ok: false, clat: lat, clon: lon };
    try {
      const mLat = 111320, mLon = 111320 * Math.cos(lat * Math.PI / 180);
      const q = `[out:json][timeout:25];(way["highway"="raceway"](around:2600,${lat},${lon}););out geom;`;
      const d = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) }).then(r => r.json());
      const histO = new Float64Array(180), osmPts = [];
      for (const w of (d.elements || [])) {
        const g = w.geometry; if (!g || g.length < 2) continue;
        for (let i = 0; i < g.length - 1; i++) {
          const ax = (g[i].lon - lon) * mLon, ay = (g[i].lat - lat) * mLat, bx = (g[i + 1].lon - lon) * mLon, by = (g[i + 1].lat - lat) * mLat;
          osmPts.push([ax, ay]); const len = Math.hypot(bx - ax, by - ay); if (len < 1) continue;
          let a = Math.atan2(by - ay, bx - ax); a = ((a % Math.PI) + Math.PI) % Math.PI; histO[Math.min(179, Math.floor(a / Math.PI * 180))] += len;
        }
      }
      if (osmPts.length < 8) { _rotCache.set(key, res); return res; }
      let cx = 0, cy = 0; for (const p of outline) { cx += p.x; cy += p.y; } cx /= outline.length; cy /= outline.length;
      const tPts = outline.map(p => [(p.x - cx) / 10, (p.y - cy) / 10]);
      const histT = new Float64Array(180);
      for (let i = 0; i < tPts.length; i++) { const a0 = tPts[i], a1 = tPts[(i + 1) % tPts.length], len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]); if (len < 1) continue; let a = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]); a = ((a % Math.PI) + Math.PI) % Math.PI; histT[Math.min(179, Math.floor(a / Math.PI * 180))] += len; }
      let bestS = 0, bestV = -1;
      for (let sh = 0; sh < 180; sh++) { let v = 0; for (let b = 0; b < 180; b++) v += histT[b] * histO[(b + sh) % 180]; if (v > bestV) { bestV = v; bestS = sh; } }
      const cand = bestS * Math.PI / 180;
      let ox = 0, oy = 0; for (const p of osmPts) { ox += p[0]; oy += p[1]; } ox /= osmPts.length; oy /= osmPts.length;
      const oc = osmPts.map(p => [p[0] - ox, p[1] - oy]);
      const tStep = Math.max(1, Math.ceil(tPts.length / 60)), oStep = Math.max(1, Math.ceil(oc.length / 150));
      const score = th => { const c = Math.cos(th), s = Math.sin(th); let sum = 0, n = 0; for (let i = 0; i < tPts.length; i += tStep) { const x = tPts[i][0] * c - tPts[i][1] * s, y = tPts[i][0] * s + tPts[i][1] * c; let best = 1e18; for (let j = 0; j < oc.length; j += oStep) { const dx = x - oc[j][0], dy = y - oc[j][1], dd = dx * dx + dy * dy; if (dd < best) best = dd; } sum += Math.sqrt(best); n++; } return n ? sum / n : 1e9; };
      const sA = score(cand), sB = score(cand + Math.PI);
      const theta = sB < sA ? cand + Math.PI : cand, best = Math.min(sA, sB);
      // OK only when the racing line falls close to the real track (good alignment);
      // centre the satellite on the OSM track centroid, not the (sometimes offset) GP point.
      res = { theta: best < 30 ? theta : 0, ok: best < 30, score: best, clat: lat + oy / mLat, clon: lon + ox / mLon };
    } catch { res = { theta: 0, ok: false, clat: lat, clon: lon }; }
    _rotCache.set(key, res);
    return res;
  }

  /* Create a fresh Leaflet map in a container (caller owns the lifecycle). */
  async function makeSatMap(container, lat, lon, kind) {
    await _loadLeaflet();
    const map = L.map(container, { center: [lat, lon], zoom: 14, zoomControl: true, scrollWheelZoom: true, attributionControl: true });
    const t = REALMAP_TILES[kind] || REALMAP_TILES.sat;
    L.tileLayer(t.url, { attribution: t.attr, subdomains: t.sub, maxZoom: 19 }).addTo(map);
    setTimeout(() => { try { map.invalidateSize(); } catch {} }, 60);
    return map;
  }
  async function showCircuitRealMap(container, lat, lon, kind) {
    await _loadLeaflet();
    if (!_circMap) {
      _circMap = L.map(container, { center: [lat, lon], zoom: 14, zoomControl: true, scrollWheelZoom: true, attributionControl: true });
      _circMap.__layer = null;
    }
    if (_circMap.__layer) _circMap.removeLayer(_circMap.__layer);
    const t = REALMAP_TILES[kind] || REALMAP_TILES.sat;
    _circMap.__layer = L.tileLayer(t.url, { attribution: t.attr, subdomains: t.sub, maxZoom: 19 }).addTo(_circMap);
    _circMap.setView([lat, lon], _circMap.getZoom() || 14);
    setTimeout(() => _circMap && _circMap.invalidateSize(), 60);
  }

  const TABS = [
    { id: 'race',    ic: '🏁', en: 'Race',         pt: 'Corrida' },
    { id: 'track',   ic: '🏎️', en: 'Track',        pt: 'Pista' },
    { id: 'live',    ic: '📊', en: 'Timing',        pt: 'Tempos' },
    { id: 'driver',  ic: '👤', en: 'Driver',       pt: 'Piloto' },
    { id: 'circuit', ic: '🗺️', en: 'Circuit',      pt: 'Circuito' },
    { id: 'cal',     ic: '📅', en: 'Calendar',      pt: 'Calendário' },
    { id: 'stats',   ic: '📊', en: 'Stats',         pt: 'Estatísticas' },
  ];

  /* ── helpers ── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const teamCol = c => c ? ('#' + String(c).replace('#', '')) : '#888';
  function loading(msg) { return `<div class="f1-loading"><div class="ex-loading-spinner"></div><div>${msg || _t('Loading…', 'A carregar…')}</div></div>`; }
  function err(msg) { return `<div class="f1-empty">⚠ ${msg || _t('Could not load data.', 'Não foi possível carregar os dados.')}</div>`; }
  function localTime(d) { try { return new Date(d).toLocaleString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return d; } }
  function countdown(ts) {
    const s = Math.max(0, Math.floor((ts - Date.now()) / 1000));
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  /* Country name (as used by Jolpica/Ergast) → ISO2 → local flag SVG. Covers
     every country that has ever hosted a championship round + common variants. */
  const CTRY = {
    Argentina: 'ar', Australia: 'au', Austria: 'at', Azerbaijan: 'az', Bahrain: 'bh', Belgium: 'be',
    Brazil: 'br', Canada: 'ca', China: 'cn', France: 'fr', Germany: 'de', Hungary: 'hu', India: 'in',
    Italy: 'it', Japan: 'jp', Korea: 'kr', Malaysia: 'my', Mexico: 'mx', Monaco: 'mc', Morocco: 'ma',
    Netherlands: 'nl', Portugal: 'pt', Qatar: 'qa', Russia: 'ru', 'Saudi Arabia': 'sa', Singapore: 'sg',
    'South Africa': 'za', Spain: 'es', Sweden: 'se', Switzerland: 'ch', Turkey: 'tr', UAE: 'ae', UK: 'gb', USA: 'us',
    'United States': 'us', 'United Kingdom': 'gb', 'Great Britain': 'gb', 'United Arab Emirates': 'ae',
    'Abu Dhabi': 'ae', 'South Korea': 'kr', 'Czech Republic': 'cz', Indonesia: 'id', Thailand: 'th',
  };
  function flag(country, cls) {
    const code = CTRY[country];
    return code ? `<img class="f1-flag${cls ? ' ' + cls : ''}" src="data/flags/${code}.svg" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
  }

  /* Official team colour (constructor name → hex). Team LOGOS are trademarked,
     so each driver is marked with the team's signature colour (colours aren't
     copyrightable) instead. Best-effort across modern + historic constructors. */
  const TEAM_COL = [
    [/ferrari/i, '#E8002D'], [/mercedes/i, '#00D2BE'], [/red ?bull/i, '#3671C6'], [/mclaren/i, '#FF8000'],
    [/aston/i, '#229971'], [/alpine/i, '#0093CC'], [/williams/i, '#64C4FF'], [/haas/i, '#B6BABD'],
    [/audi/i, '#BB0A30'], [/cadillac/i, '#C9A24B'], [/(racing ?bull|alphatauri|toro ?rosso|\brb\b)/i, '#6692FF'],
    [/sauber|kick/i, '#52E252'], [/force ?india|racing ?point/i, '#F596C8'], [/renault/i, '#FFF500'],
    [/lotus/i, '#FFB800'], [/jordan/i, '#FFA100'], [/brawn/i, '#B6FF00'], [/benetton/i, '#00A14B'],
    [/jaguar/i, '#0B5C2E'], [/\bbmw\b/i, '#005195'], [/toyota|honda/i, '#CC0000'], [/tyrrell/i, '#1E40AF'],
  ];
  function teamColour(name) { const s = String(name || ''); for (const [re, c] of TEAM_COL) if (re.test(s)) return c; return '#9aa3b2'; }
  const teamDot = name => `<span class="f1-team-dot" style="background:${teamColour(name)}" title="${esc(name)}"></span>`;

  /* Season race sessions (OpenF1) — used for the replay race picker. */
  async function seasonRaces() {
    const yr = new Date().getFullYear();
    let races = [];
    try { races = await F1Data.racesOfYear(yr); } catch {}
    if (!races || !races.length) { try { races = await F1Data.racesOfYear(yr - 1); } catch {} }
    return (races || []).filter(r => r.session_key).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  }

  /* Unified season race list (any year): the authoritative Jolpica schedule
     (every round, incl. those not yet run) merged with OpenF1 race sessions
     (2023→) by date, so each round carries a session_key when telemetry exists.
     Future-proof — a new season appears automatically. */
  async function seasonRacesFull(year) {
    const [sched, of1] = await Promise.all([
      F1Data.scheduleFor(year).catch(() => []),
      F1Data.racesOfYear(year).catch(() => []),
    ]);
    const ofR = (of1 || []).filter(r => r.session_key);
    const now = Date.now();
    return (sched || []).map(r => {
      const ts = Date.parse(`${r.date}T${r.time || '13:00:00Z'}`);
      let m = null, best = 4 * 86400000;
      for (const o of ofR) { const d = Math.abs(Date.parse(o.date_start) - ts); if (d < best) { best = d; m = o; } }
      return {
        round: +r.round, raceName: r.raceName,
        country: r.Circuit?.Location?.country, locality: r.Circuit?.Location?.locality,
        circuitName: r.Circuit?.circuitName, circuitId: r.Circuit?.circuitId,
        lat: +r.Circuit?.Location?.lat, lon: +r.Circuit?.Location?.long,
        date: r.date, _ts: ts, year: +year,
        session_key: m ? m.session_key : null,
        circuit_short_name: m ? m.circuit_short_name : null,
        country_name: m ? m.country_name : r.Circuit?.Location?.country,
        status: ts < now ? 'past' : 'upcoming',
      };
    }).sort((a, b) => a.round - b.round);
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ── tyres ── */
  const TYRE = {
    SOFT:    { c: '#e8002d', l: 'S' }, MEDIUM: { c: '#f6c700', l: 'M' }, HARD: { c: '#e6e6e6', l: 'H' },
    INTERMEDIATE: { c: '#3fb950', l: 'I' }, WET: { c: '#2d7dff', l: 'W' }, UNKNOWN: { c: '#888', l: '?' },
  };
  const tyre = c => TYRE[String(c || '').toUpperCase()] || TYRE.UNKNOWN;

  /* ── race-control event → feed entry ── */
  const RC_NOISE = /(AIR TEMPERATURE|TRACK TEMPERATURE|HEAD PADDING|RISK OF RAIN|DRS (ENABLED|DISABLED)|PIT (EXIT|ENTRY)|MESSAGE FROM)/i;
  function rcEntry(r) {
    const cat = r.category, msg = r.message || '', fl = r.flag;
    let icon = 'ℹ️', kind = 'info';
    if (cat === 'SafetyCar') {
      const vsc = /VIRTUAL/i.test(msg);
      icon = '🚗'; kind = vsc ? 'vsc' : 'sc';
    } else if (cat === 'Flag') {
      if (fl === 'RED') { icon = '🔴'; kind = 'red'; }
      else if (/YELLOW/.test(fl)) { icon = '🟡'; kind = 'yellow'; }
      else if (fl === 'GREEN' || fl === 'CLEAR') { icon = '🟢'; kind = 'green'; }
      else if (fl === 'BLUE') { icon = '🔵'; kind = 'blue'; }
      else if (fl === 'CHEQUERED') { icon = '🏁'; kind = 'chequered'; }
      else if (fl === 'BLACK AND WHITE') { icon = '⚠️'; kind = 'warn'; }
    } else if (cat === 'SessionStatus') {
      icon = '🏁'; kind = 'session';
    } else if (/PENALT/i.test(msg)) { icon = '⏱️'; kind = 'penalty'; }
    else if (/INCIDENT|INVESTIGAT|NOTED|UNDER REVIEW/i.test(msg)) { icon = '🔎'; kind = 'incident'; }
    else if (/DELETED/i.test(msg)) { icon = '🚫'; kind = 'deleted'; }
    return { icon, kind, msg, cat, scope: r.scope, lap: r.lap_number, date: r.date };
  }
  // worth showing in the feed? (drop routine per-sector flag spam)
  function rcKeep(e) {
    if (e.cat === 'SafetyCar' || e.cat === 'SessionStatus') return true;
    if (e.cat === 'Flag') return e.kind === 'red' || e.kind === 'chequered' || e.scope === 'Track';
    return !RC_NOISE.test(e.msg) && /PENALT|INCIDENT|INVESTIGAT|NOTED|DELETED|REVIEW|RETIR|STOP/i.test(e.msg);
  }
  // track-wide state for the canvas overlay (precedence red > sc/vsc > yellow)
  function flagStateRows(rcs) {
    const out = [];
    for (const r of rcs) {
      if (r.category === 'SafetyCar') {
        const vsc = /VIRTUAL/i.test(r.message || '');
        const ending = /ENDING|IN THIS LAP/i.test(r.message || '');
        out.push({ date: r.date, s: ending ? null : (vsc ? 'vsc' : 'sc') });
      } else if (r.category === 'Flag' && (r.scope === 'Track' || !r.scope)) {
        if (r.flag === 'RED') out.push({ date: r.date, s: 'red' });
        else if (r.flag === 'GREEN' || r.flag === 'CHEQUERED' || r.flag === 'CLEAR') out.push({ date: r.date, s: null });
        else if (/YELLOW/.test(r.flag)) out.push({ date: r.date, s: 'yellow' });
      } else if (r.category === 'Flag' && r.scope === 'Sector' && /YELLOW/.test(r.flag)) {
        out.push({ date: r.date, s: 'yellow' });
      } else if (r.category === 'Flag' && r.scope === 'Sector' && r.flag === 'CLEAR') {
        out.push({ date: r.date, s: null });
      }
    }
    return out;
  }

  /* ════════════════════════════ SHELL ════════════════════════════ */
  function show() {
    const view = document.getElementById('view-f1');
    if (!view) return;
    if (_inited) { if (_tab === 'track' && _track) _track.resize(); return; }
    _inited = true;
    _root = view;
    view.innerHTML = `
      <div class="f1-wrap">
        <header class="f1-head">
          <div class="f1-title"><span class="f1-logo"><img class="f1-logo-img" src="data/f1/icons/logo.jpg" alt="" onerror="this.outerHTML='🏎️'"></span> <span>Fórmula 1</span></div>
          <nav class="f1-tabs" id="f1-tabs" role="tablist">
            ${TABS.map(t => `<button class="f1-tab${t.id === 'race' ? ' on' : ''}" data-tab="${t.id}" role="tab">
              <span class="f1-tab-ic"><img class="f1-tab-img" src="data/f1/icons/${t.id}.jpg" alt="" loading="lazy" onerror="this.outerHTML='${t.ic}'"></span><span>${_t(t.en, t.pt)}</span></button>`).join('')}
          </nav>
        </header>
        <div class="f1-body" id="f1-body"></div>
        <footer class="f1-disclaimer">${_t(
          'Unofficial fan project — not associated with Formula 1. Data: OpenF1 &amp; Jolpica/Ergast.',
          'Projeto de fã não-oficial — sem ligação à Formula 1. Dados: OpenF1 e Jolpica/Ergast.')}</footer>
      </div>`;
    view.querySelector('#f1-tabs').addEventListener('click', e => {
      const b = e.target.closest('.f1-tab'); if (!b) return;
      _go(b.dataset.tab);
    });
    _go('race');
  }

  function _go(tab) {
    _tab = tab;
    _root.querySelectorAll('.f1-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    clearInterval(_liveTimer); _liveTimer = null;
    if (_track) { _track.dispose(); _track = null; }
    if (_ctrack) { _ctrack.dispose(); _ctrack = null; }
    _killMaps();
    document.getElementById('f1-lv-backdrop')?.remove();
    const body = _root.querySelector('#f1-body');
    body.innerHTML = loading();
    ({ race: renderRace, track: renderTrack, live: renderLive, driver: renderDriver, timing: renderTiming, circuit: renderCircuit, champ: renderChamp, cal: renderCal, stats: renderStats }[tab] || renderRace)(body);
  }

  /* ════════════════════════════ RACE ════════════════════════════ */
  async function renderRace(body) {
    body.innerHTML = loading(_t('Loading championship…', 'A carregar o campeonato…'));
    try {
      const [races, last, session, ds, cs, winners] = await Promise.all([
        F1Data.schedule().catch(() => []),
        F1Data.lastResults().catch(() => null),
        F1Data.latestSession().catch(() => null),
        F1Data.driverStandings().catch(() => []),
        F1Data.constructorStandings().catch(() => []),
        F1Data.seasonWinners().catch(() => []),
      ]);
      const sp = F1Data.splitSchedule(races);
      const next = sp.next;
      const now = Date.now();
      const year = (races[0]?.season) || new Date().getFullYear();

      // live? a session running within ±30min
      let liveHTML = '';
      if (session) {
        const st = Date.parse(session.date_start), en = Date.parse(session.date_end);
        if (now >= st - 1800000 && now <= en + 1800000) {
          let w = null; try { const wr = await F1Data.weather(session.session_key); w = wr && wr[wr.length - 1]; } catch {}
          liveHTML = `
            <div class="f1-hub-live">
              <div class="f1-live-badge">● ${_t('LIVE', 'AO VIVO')}</div>
              <div class="f1-hub-live-gp">${esc(session.circuit_short_name)} — ${esc(session.country_name)} · <b>${esc(session.session_name)}</b></div>
              ${w ? `<div class="f1-wx">🌡️ ${w.air_temperature}°C · ${_t('track', 'pista')} ${w.track_temperature}°C · 💧 ${w.humidity}%${w.rainfall ? ' · 🌧️' : ''}</div>` : ''}
              <button class="f1-hub-live-cta" data-goto="live">${_t('Open Live Timing', 'Abrir Live Timing')} →</button>
            </div>`;
        }
      }

      // ── HERO: next race ──
      const heroHTML = next ? `
        <div class="f1-hub-hero">
          <div class="f1-hub-hero-tag">${_t('Next Grand Prix', 'Próximo Grande Prémio')} · ${_t('Round', 'Ronda')} ${next.round}/${races.length}</div>
          <div class="f1-hub-hero-gp">${flag(next.Circuit?.Location?.country)}${esc(next.raceName)}</div>
          <div class="f1-hub-hero-sub">${esc(next.Circuit?.circuitName)} · ${esc(next.Circuit?.Location?.locality)}, ${esc(next.Circuit?.Location?.country)}</div>
          <div class="f1-hub-hero-cd">
            <div class="f1-hub-cd-big">${countdown(next._ts)}</div>
            <div class="f1-hub-cd-when">🕐 ${localTime(next._ts)} <span class="f1-tz">(${_t('your time', 'hora local')})</span></div>
          </div>
        </div>` : `<div class="f1-hub-hero"><div class="f1-hub-hero-tag">${_t('Season complete', 'Época terminada')}</div><div class="f1-hub-hero-gp">${year}</div></div>`;

      // ── STANDINGS (drivers + constructors) with bars ──
      const dLead = +(ds[0]?.points || 0) || 1;
      const dRows = (ds || []).map(s => {
        const pts = +s.points, team = s.Constructors?.[0]?.name || '', gap = +ds[0].points - pts;
        return `<div class="f1-sd-row${+s.position <= 3 ? ' p' + s.position : ''}">
          <span class="f1-sd-pos">${s.position}</span>
          <span class="f1-sd-nm"><b>${esc(s.Driver.familyName)}</b><small>${esc(team)}</small></span>
          <span class="f1-sd-bar"><i style="width:${Math.max(3, pts / dLead * 100)}%;background:${teamColour(team)}"></i></span>
          <span class="f1-sd-pts">${pts}${gap ? `<small>−${gap}</small>` : ''}</span>
        </div>`;
      }).join('');
      const cLead = +(cs[0]?.points || 0) || 1;
      const cRows = (cs || []).map(s => {
        const pts = +s.points, name = s.Constructor.name, gap = +cs[0].points - pts;
        return `<div class="f1-sd-row${+s.position <= 3 ? ' p' + s.position : ''}">
          <span class="f1-sd-pos">${s.position}</span>
          <span class="f1-sd-nm">${teamDot(name)}<b>${esc(name)}</b></span>
          <span class="f1-sd-bar"><i style="width:${Math.max(3, pts / cLead * 100)}%;background:${teamColour(name)}"></i></span>
          <span class="f1-sd-pts">${pts}${gap ? `<small>−${gap}</small>` : ''}</span>
        </div>`;
      }).join('');
      const standHTML = (ds.length || cs.length) ? `
        <div class="f1-hub-stand">
          <div class="f1-sd-card">
            <div class="f1-sd-hd"><h3>🏆 ${_t('Drivers', 'Pilotos')}</h3></div>
            ${dRows || err()}
          </div>
          <div class="f1-sd-card">
            <div class="f1-sd-hd"><h3>🏭 ${_t('Constructors', 'Construtores')}</h3></div>
            ${cRows || err()}
          </div>
        </div>` : '';

      // ── VISUAL CALENDAR strip ──
      const winBy = {};
      for (const r of (winners || [])) { const w = r.Results?.[0]?.Driver; if (w) winBy[+r.round] = w.code || w.familyName.slice(0, 3).toUpperCase(); }
      const calCards = sp.all.map(r => {
        const done = r._ts < now, isNext = next && r.round === next.round;
        const state = done ? 'done' : isNext ? 'next' : 'future';
        const days = Math.ceil((r._ts - now) / 86400000);
        const badge = done ? (winBy[+r.round] ? `🏆 ${winBy[+r.round]}` : '✓')
          : isNext ? `⏱ ${countdown(r._ts)}`
          : `${_t('in', 'em')} ${days}d`;
        return `<div class="f1-cs-card ${state}"${isNext ? ' data-next="1"' : ''}>
          <span class="f1-cs-rd">R${r.round}</span>
          ${flag(r.Circuit?.Location?.country, 'f1-cs-flag')}
          <span class="f1-cs-gp">${esc(r.Circuit?.Location?.country || r.raceName)}</span>
          <span class="f1-cs-dt">${new Date(r._ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short' })}</span>
          <span class="f1-cs-badge">${badge}</span>
        </div>`;
      }).join('');
      const calHTML = sp.all.length ? `
        <div class="f1-hub-cal">
          <div class="f1-sd-hd"><h3>📅 ${_t('Season', 'Época')} ${year} · ${sp.past.length}/${sp.all.length} ${_t('done', 'feitas')}</h3><button class="f1-seeall" data-goto="cal">${_t('details', 'detalhes')} →</button></div>
          <div class="f1-cs-strip" id="f1-cs-strip">${calCards}</div>
        </div>` : '';

      const lastHTML = last && last.Results ? renderResults(last) : '';

      body.innerHTML = `<div class="f1-hub">${liveHTML}
        <div class="f1-hub-top">${heroHTML}${standHTML}</div>
        ${calHTML}${lastHTML}</div>`;
      if (!next && !standHTML && !lastHTML) { body.innerHTML = err(); return; }

      body.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => _go(b.dataset.goto)));
      const strip = body.querySelector('#f1-cs-strip'), nx = strip && strip.querySelector('[data-next]');
      if (nx) strip.scrollLeft = Math.max(0, nx.offsetLeft - strip.clientWidth / 2 + nx.clientWidth / 2);
    } catch (e) { body.innerHTML = err(); }
  }

  /* full classification of a race (all finishers + points + gaps + grid moves) */
  function renderResults(race) {
    const rows = (race.Results || []).map(r => {
      const pos = r.positionText, finished = /^\d+$/.test(pos);
      const grid = +r.grid || 0, fin = +r.position || 0;
      const delta = (finished && grid) ? grid - fin : 0;             // +ve = gained places
      const move = delta > 0 ? `<span class="f1-up">▲${delta}</span>` : delta < 0 ? `<span class="f1-dn">▼${-delta}</span>` : `<span class="f1-eq">–</span>`;
      // gap to winner, or lapped/retirement status ("+1 Lap", "Accident", DNF…)
      const status = fin === 1 ? (r.Time?.time || '')
        : finished ? (r.Time?.time || r.status)
        : (pos === 'R' ? _t('DNF', 'Abandono') : r.status);
      const fl = r.FastestLap?.rank === '1';
      const pts = +r.points || 0;
      return `<tr${fin === 1 ? ' class="win"' : ''}>
        <td class="f1-r-pos">${esc(pos)}</td>
        <td class="f1-r-mv">${move}</td>
        <td class="f1-r-num">${esc(r.number)}</td>
        <td class="f1-r-drv"><b>${esc(r.Driver.code || r.Driver.familyName.slice(0,3).toUpperCase())}</b>
          <span class="f1-r-full">${esc(r.Driver.givenName)} ${esc(r.Driver.familyName)}</span>
          ${fl ? `<span class="f1-fl" title="${_t('Fastest lap','Volta mais rápida')}: ${esc(r.FastestLap?.Time?.time)}">FL</span>` : ''}</td>
        <td class="f1-r-team">${esc(r.Constructor.name)}</td>
        <td class="f1-r-gap">${esc(status)}</td>
        <td class="f1-r-pts">${pts ? '+' + pts : ''}</td>
      </tr>`;
    }).join('');
    return `
      <div class="f1-card f1-results-card">
        <div class="f1-card-lbl">${flag(race.Circuit?.Location?.country)}${_t('Last race — full classification', 'Última corrida — classificação completa')} · ${esc(race.raceName)}</div>
        <div class="f1-results-scroll">
          <table class="f1-results">
            <thead><tr>
              <th>${_t('Pos','Pos')}</th><th></th><th>#</th><th>${_t('Driver','Piloto')}</th>
              <th>${_t('Team','Equipa')}</th><th>${_t('Time / Gap','Tempo / Gap')}</th><th>${_t('Pts','Pts')}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="f1-results-legend">▲/▼ ${_t('places vs grid','lugares vs grelha')} · <span class="f1-fl">FL</span> ${_t('fastest lap','volta mais rápida')}</div>
      </div>`;
  }

  /* penalties from race control, e.g.
     "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 27 (HUL) - SPEEDING IN THE PIT LANE" */
  function parsePenalties(rcRows) {
    const byDriver = {};
    for (const r of (rcRows || [])) {
      const m = r.message || '';
      if (!/PENALTY|DRIVE.?THROUGH|STOP.?GO/i.test(m)) continue;
      if (/PENALTY SERVED/i.test(m)) continue;                 // skip the "served" echo (dupes the announcement)
      const carM = m.match(/CAR (\d+)/); if (!carM) continue;
      const num = +carM[1];
      let type = 'pen', label = 'PEN';
      const secM = m.match(/(\d+)\s*SECOND TIME PENALTY/i);
      if (secM) { type = 'time'; label = '+' + secM[1] + 's'; }
      else if (/DRIVE.?THROUGH/i.test(m)) { type = 'dt'; label = 'DT'; }
      else if (/STOP.?GO/i.test(m)) { type = 'sg'; label = 'S&G'; }
      else if (/GRID/i.test(m)) { type = 'grid'; label = 'GRID'; }
      const reason = (m.split(/ - (.+)/)[1] || m.replace(/^FIA STEWARDS:\s*/i, '')).trim();
      (byDriver[num] = byDriver[num] || []).push({ lap: r.lap_number, t: Date.parse(r.date), type, label, reason });
    }
    return byDriver;
  }

  /* ── Incident markers on the circuit (🟡🔴🚗💥🚜🚨) ──
     Built from OpenF1 race-control messages; placed on the outline at the
     involved car's position (or the marshal sector) at the message time. */
  /* Map layers for the Pista (toggleable) + quick presets. */
  const TRACK_LAYERS = [
    { id: 'sectors',   en: 'Sectors',    pt: 'Setores' },
    { id: 'corners',   en: 'Corners',    pt: 'Curvas' },
    { id: 'flags',     en: 'Flag zones', pt: 'Zonas de bandeira' },
    { id: 'speed',     en: 'Speed map',  pt: 'Mapa de velocidade' },
    { id: 'incidents', en: 'Incidents',  pt: 'Incidentes' },
  ];
  const TRACK_PRESETS = {
    clean:    { en: 'Clean',    pt: 'Limpo',   layers: ['flags'] },
    analysis: { en: 'Analysis', pt: 'Análise', layers: ['sectors', 'corners', 'flags', 'speed'] },
    all:      { en: 'All',      pt: 'Tudo',    layers: ['sectors', 'corners', 'flags', 'speed', 'incidents'] },
  };

  const INCIDENTS = {
    yellow:    { icon: '🟡', col: '#ffd60a', en: 'Yellow flag',  pt: 'Bandeira amarela' },
    accident:  { icon: '🔴', col: '#ff2d24', en: 'Accident',     pt: 'Acidente' },
    stopped:   { icon: '🚗', col: '#ff9f1c', en: 'Stopped car',  pt: 'Carro parado' },
    collision: { icon: '💥', col: '#ff5d8f', en: 'Collision',    pt: 'Colisão' },
    recovery:  { icon: '🚜', col: '#8ecae6', en: 'Recovery',     pt: 'Recuperação de carro' },
    sc:        { icon: '🚨', col: '#ff6b35', en: 'Safety Car',   pt: 'Safety Car' },
  };
  function classifyIncident(r) {
    const msg = String(r.message || '').toUpperCase();
    // Stewards' admin / penalties / track-limits are NOT on-track incidents — skip them
    // (e.g. "...NOTED - YELLOW FLAG INFRINGEMENT", "...TIME DELETED - TRACK LIMITS").
    if (/INFRINGEMENT|TRACK LIMITS|DELETED|INVESTIGAT|REVIEWED|NO FURTHER|NOTED|PENALTY|REMINDER|BLACK|WHITE/.test(msg)) return null;
    // Only genuine point incidents get a marker. Yellow flags & Safety Car are
    // shown as ZONES (the flag-zones layer + the yellow border), not as dots.
    if (/COLLISION|CONTACT/.test(msg)) return 'collision';
    if (/ACCIDENT|CRASH/.test(msg)) return 'accident';
    if (/RECOVER|CRANE|MARSHALS WORKING|VEHICLE RECOVERY|BARRIER REPAIR/.test(msg)) return 'recovery';
    if (/CAR STOPPED|STOPPED ON|HAS STOPPED|STOPPED AT/.test(msg)) return 'stopped';
    return null;
  }
  function computeIncidentMarkers(rcRows, model) {
    const { outline, progFloat, offset, lights, flagRows } = model;
    const maxSector = Math.max(1, ...(rcRows || []).map(r => +r.sector || 0));
    // how long a marker stays "active": flags/SC last until the next green/clear;
    // point incidents (accident/collision/stopped/recovery) show for a short window.
    const fr = flagRows || [];
    const durFor = (type, t) => {
      if (type === 'yellow' || type === 'sc') { const clear = fr.find(f => f.t > t + 200 && f.s == null); return clear ? Math.max(3000, clear.t - t) : 20000; }
      return 12000;
    };
    const out = [], seen = new Set();
    for (const r of (rcRows || [])) {
      const type = classifyIncident(r); if (!type) continue;
      const tRel = Date.parse(r.date) - lights; if (!isFinite(tRel)) continue;
      let drv = +r.driver_number || 0;
      if (!drv) { const m = String(r.message || '').match(/CAR (\d+)/); if (m) drv = +m[1]; }
      let u = null;
      if (drv) { const pf = progFloat(drv, Math.max(0, tRel)); if (pf != null) u = pf - (offset[drv] || 0); }
      if (u == null && +r.sector) u = (+r.sector - 1) / maxSector;
      if (u == null) continue;
      const xy = outlineXY(outline, u);
      const key = type + ':' + (r.lap_number || 0) + ':' + Math.round((((u % 1) + 1) % 1) * 30);
      if (seen.has(key)) continue; seen.add(key);
      const cfg = INCIDENTS[type];
      out.push({ t: tRel, dur: durFor(type, tRel), x: xy.x, y: xy.y, type, icon: cfg.icon, col: cfg.col, lap: r.lap_number || 0 });
    }
    return out.sort((a, b) => a.t - b.t);
  }

  /* Time windows when a track segment is under a flag, for the live "flag zones"
     map layer: yellow per marshal sector, Safety Car / red over the whole track. */
  function computeFlagZones(rcRows, lights) {
    const zones = []; let maxSector = 1;
    const openY = {}; let sc = null, red = null;
    for (const r of (rcRows || [])) {
      const t = Date.parse(r.date) - lights; if (!isFinite(t)) continue;
      const sec = +r.sector || 0; if (sec) maxSector = Math.max(maxSector, sec);
      const msg = String(r.message || '').toUpperCase();
      if (r.category === 'SafetyCar') {
        if (/DEPLOYED/.test(msg)) sc = { t0: t, type: /VIRTUAL/.test(msg) ? 'vsc' : 'sc' };
        else if (/ENDING|IN THIS LAP/.test(msg) && sc) { zones.push({ t0: sc.t0, t1: t + (sc.type === 'sc' ? 25000 : 5000), type: sc.type, sector: null }); sc = null; }
      } else if (r.category === 'Flag') {
        if (r.flag === 'RED') red = { t0: t };
        else if (r.flag === 'YELLOW' || r.flag === 'DOUBLE YELLOW') { if (sec && openY[sec] == null) openY[sec] = t; }
        else if (r.flag === 'GREEN' || r.flag === 'CLEAR' || r.flag === 'CHEQUERED') {
          if (red) { zones.push({ t0: red.t0, t1: t, type: 'red', sector: null }); red = null; }
          if (sec && openY[sec] != null) { zones.push({ t0: openY[sec], t1: t, type: 'yellow', sector: sec }); openY[sec] = null; }
          else if (!sec) { for (const s in openY) if (openY[s] != null) { zones.push({ t0: openY[s], t1: t, type: 'yellow', sector: +s }); openY[s] = null; } }
        }
      }
    }
    return { zones, maxSector };
  }

  /* Position-over-laps for every driver, for the evolution chart. */
  function positionEvolution(model) {
    const { posByDriver, lapStart, totalLaps, meta } = model;
    const laps = []; for (let L = 1; L <= totalLaps; L++) if (lapStart[L] != null) laps.push(L);
    const series = [];
    for (const num in posByDriver) {
      const arr = posByDriver[num]; if (!arr || !arr.length) continue;
      const pts = []; let idx = 0;
      for (const L of laps) { const t = lapStart[L]; while (idx < arr.length && arr[idx].t <= t) idx++; const p = idx > 0 ? arr[idx - 1].p : arr[0].p; if (p != null) pts.push({ lap: L, pos: +p }); }
      if (pts.length > 1) series.push({ num: +num, team: meta[num] && meta[num].colour, pts });
    }
    const maxPos = Math.max(10, ...series.flatMap(s => s.pts.map(p => p.pos)));
    return { series, totalLaps, maxPos };
  }
  function posEvoSVG(model) {
    const { series, totalLaps, maxPos } = positionEvolution(model);
    if (!series.length) return '';
    const W = 700, H = 200, padL = 20, padR = 8, padT = 8, padB = 8;
    const sx = lap => padL + (totalLaps > 1 ? (lap - 1) / (totalLaps - 1) : 0) * (W - padL - padR);
    const sy = pos => padT + (maxPos > 1 ? (pos - 1) / (maxPos - 1) : 0) * (H - padT - padB);
    const grid = [1, 5, 10, 15, 20].filter(p => p <= maxPos).map(p => `<line x1="${padL}" y1="${sy(p).toFixed(1)}" x2="${W - padR}" y2="${sy(p).toFixed(1)}" stroke="rgba(255,255,255,.06)"/><text x="2" y="${(sy(p) + 3).toFixed(1)}" class="f1-pe-ax">${p}</text>`).join('');
    const lines = series.map(s => `<path d="${s.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.lap).toFixed(1)} ${sy(p.pos).toFixed(1)}`).join(' ')}" fill="none" stroke="${teamCol(s.team)}" stroke-width="1.6" opacity=".88"/>`).join('');
    return `<svg class="f1-pe-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${lines}</svg>`;
  }

  /* ════════════════════════════ TRACK ════════════════════════════
     Whole-race replay: cars run the full race placed on a real outline by
     lap progress, with live order (number · code · tyre · gap · penalties),
     weather, a synced race-control feed, flag/SC overlays, a driver popup,
     lap picker and fullscreen. Race picker + auto live detection.
     ════════════════════════════════════════════════════════════════ */
  const SPEEDS = [3, 6, 12, 24, 48];
  const DEF_SPEED = 12;
  const FRAME_MS = 1500;                 // sampling step for the synthetic replay
  const GRID_GAP = 0.009;                // along-track spacing per grid place (de-overlap)

  /* Detect the major corners of a circuit from its telemetry outline: find the
     local peaks of heading-change (curvature) around the lap, number them from
     the start/finish line. Approximate (derived from the racing line). */
  function detectCorners(pts) {
    const N = pts.length; if (N < 30) return [];
    const span = Math.max(2, Math.round(N / 90));
    const headAt = i => { const a = pts[(i - span + N) % N], c = pts[(i + span) % N]; return Math.atan2(c.y - a.y, c.x - a.x); };
    const curv = new Array(N);
    for (let i = 0; i < N; i++) { let d = headAt((i + span) % N) - headAt((i - span + N) % N); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; curv[i] = Math.abs(d); }
    const thr = 0.33, lo = thr * 0.5, minSep = Math.max(3, Math.round(N * 0.02));
    const idxs = []; let i = 0, guard = 0;
    while (i < N && guard++ < N * 2) {
      if (curv[i] > thr) { let j = i, peak = i, len = 0; while (curv[j % N] > lo && len < N) { if (curv[j % N] > curv[peak % N]) peak = j; j++; len++; } idxs.push(peak % N); i = j + minSep; }
      else i++;
    }
    const uniq = [...new Set(idxs)].sort((a, b) => a - b).filter((v, k, arr) => k === 0 || v - arr[k - 1] > minSep);
    return uniq.map((idx, k) => ({ x: pts[idx].x, y: pts[idx].y, num: k + 1 }));
  }

  /* interpolate a point at parameter u∈[0,1) along a closed outline polyline */
  function outlineXY(pts, u) {
    const N = pts.length, fi = (((u % 1) + 1) % 1) * N;
    const i = Math.floor(fi) % N, j = (i + 1) % N, f = fi - Math.floor(fi);
    return { x: pts[i].x + (pts[j].x - pts[i].x) * f, y: pts[i].y + (pts[j].y - pts[i].y) * f };
  }

  /* Build the whole-race replay MODEL (no UI): outline + per-driver synthetic
     frames + lap timeline + order/events/weather. Shared by the Pista replay
     and the Piloto focused replay. Returns { ...model } or { error }.
     Results are memoised per session_key so switching drivers is instant. */
  const _modelCache = new Map();
  async function buildRaceModel(sk) {
    if (_modelCache.has(sk)) return _modelCache.get(sk);
    const [drv, posRows] = await Promise.all([F1Data.drivers(sk), F1Data.positions(sk).catch(() => [])]);
    const [lapRows, stintRows] = await Promise.all([F1Data.laps(sk), F1Data.stints(sk).catch(() => [])]);
    const [rcRows, wxRows] = await Promise.all([F1Data.raceControl(sk).catch(() => []), F1Data.weather(sk).catch(() => [])]);
    const penByDriver = parsePenalties(rcRows);
    const meta = {};
    (drv || []).forEach(d => { meta[d.driver_number] = { name: d.full_name, code: d.name_acronym, colour: d.team_colour, team: d.team_name, num: d.driver_number, country: d.country_code }; });
    const lapsByDriver = {};
    for (const l of (lapRows || [])) { if (!l.date_start) continue; const t0 = Date.parse(l.date_start), dur = (l.lap_duration || 0) * 1000; (lapsByDriver[l.driver_number] = lapsByDriver[l.driver_number] || []).push({ lap: l.lap_number, t0, dur, end: t0 + (dur || 90000) }); }
    for (const n in lapsByDriver) lapsByDriver[n].sort((a, b) => a.lap - b.lap);
    const allFirst = Object.values(lapsByDriver).map(a => a[0] && a[0].t0).filter(Boolean);
    if (!allFirst.length) return { error: _t('No lap data for this race.', 'Sem dados de voltas para esta corrida.') };
    const lights = Math.min(...allFirst);
    const raceEnd = Math.max(...Object.values(lapsByDriver).map(a => a[a.length - 1].end));
    const raceDur = raceEnd - lights;
    const totalLaps = Math.max(...(lapRows || []).map(l => l.lap_number || 0));
    const lapStart = {};
    for (const l of (lapRows || [])) { if (!l.date_start) continue; const t = Date.parse(l.date_start) - lights, ln = l.lap_number; if (lapStart[ln] == null || t < lapStart[ln]) lapStart[ln] = t; }
    const lastEndRel = {}, lastLapNum = {};
    for (const n in lapsByDriver) { const a = lapsByDriver[n]; lastEndRel[n] = a[a.length - 1].end - lights; lastLapNum[n] = a[a.length - 1].lap; }
    const isRetired = num => lastEndRel[num] < raceDur - 150000;
    // trace outline from a clean fast lap (with fallbacks for broken telemetry feeds)
    let outline = [];
    const clean = (lapRows || []).filter(l => l.lap_duration && l.lap_number > 1 && l.date_start);
    const fastestIn = max => clean.filter(l => l.lap_number <= max).reduce((a, b) => (!a || b.lap_duration < a.lap_duration) ? b : a, null);
    const cand = []; const seen = new Set();
    for (const c of [fastestIn(1e9), fastestIn(Math.ceil(totalLaps * 0.5)), fastestIn(Math.ceil(totalLaps * 0.33)), fastestIn(Math.ceil(totalLaps * 0.2))]) {
      if (c && !seen.has(c.driver_number + ':' + c.lap_number)) { seen.add(c.driver_number + ':' + c.lap_number); cand.push(c); }
    }
    for (const best of cand) {
      const lapEndMs = Date.parse(best.date_start) + best.lap_duration * 1000;
      const loc = await F1Data.location(sk, { driver: best.driver_number, from: best.date_start, to: new Date(lapEndMs + 1500).toISOString() }).catch(() => []);
      const pts = (loc || []).filter(p => (p.x || p.y) && isFinite(p.x) && isFinite(p.y) && Date.parse(p.date) < lapEndMs).map(p => ({ x: p.x, y: p.y }));
      if (pts.length >= 20) { outline = pts; break; }
    }
    if (outline.length < 20) {
      const drvNum = (cand[0] && cand[0].driver_number) || +Object.keys(lapsByDriver)[0];
      const full = await F1Data.location(sk, { driver: drvNum }).catch(() => []);
      const nz = (full || []).filter(p => (p.x || p.y) && isFinite(p.x) && isFinite(p.y)).map(p => ({ t: Date.parse(p.date), x: p.x, y: p.y }));
      let bestPts = [];
      for (const l of (lapsByDriver[drvNum] || [])) { if (!l.dur) continue; const pts = nz.filter(p => p.t >= l.t0 && p.t < l.t0 + l.dur); if (pts.length > bestPts.length) bestPts = pts; }
      outline = bestPts.sort((a, b) => a.t - b.t).map(p => ({ x: p.x, y: p.y }));
    }
    if (outline.length < 20) return { error: _t('Could not trace the track.', 'Não foi possível traçar a pista.') };
    const startPos = {};
    for (const r of (posRows || [])) { const t = Date.parse(r.date); if (!startPos[r.driver_number] || t < startPos[r.driver_number].t) startPos[r.driver_number] = { t, p: r.position }; }
    const gridOrder = Object.keys(lapsByDriver).sort((a, b) => (startPos[a]?.p || 99) - (startPos[b]?.p || 99));
    const offset = {}; gridOrder.forEach((n, i) => { offset[n] = i * GRID_GAP; });
    function progAbs(arr, absT) {
      if (absT < arr[0].t0) return { lap: 1, f: 0 };
      for (let i = 0; i < arr.length; i++) { const l = arr[i]; if (absT < l.end) return { lap: l.lap, f: l.dur ? Math.min(1, Math.max(0, (absT - l.t0) / l.dur)) : 0 }; if (i + 1 < arr.length && absT < arr[i + 1].t0) return { lap: l.lap, f: 1 }; }
      return null;
    }
    function progFloat(num, ms) { const a = lapsByDriver[num]; if (!a) return null; const p = progAbs(a, lights + ms); return p ? (p.lap - 1) + p.f : null; }
    const frames = {};
    for (const num in lapsByDriver) {
      const arr = lapsByDriver[num], lastEnd = arr[arr.length - 1].end, fr = [];
      for (let t = 0; t <= raceDur; t += FRAME_MS) { const absT = lights + t; if (absT > lastEnd + 1500) break; const p = progAbs(arr, absT); if (!p) break; const xy = outlineXY(outline, p.f - offset[num]); fr.push({ t, x: xy.x, y: xy.y }); }
      if (fr.length) frames[num] = fr;
    }
    const stintsByDriver = {};
    for (const s of (stintRows || [])) (stintsByDriver[s.driver_number] = stintsByDriver[s.driver_number] || []).push(s);
    function tyreAt(num, lap) { const ss = stintsByDriver[num]; if (!ss) return {}; let cur = null; for (const s of ss) { if (lap >= s.lap_start && lap <= s.lap_end) return s; if (s.lap_start <= lap) cur = s; } return cur || ss[0] || {}; }
    const posByDriver = {};
    for (const r of (posRows || [])) (posByDriver[r.driver_number] = posByDriver[r.driver_number] || []).push({ t: Date.parse(r.date) - lights, p: r.position });
    Object.values(posByDriver).forEach(a => a.sort((x, y) => x.t - y.t));
    const events = (rcRows || []).map(rcEntry).filter(rcKeep).map(e => ({ ...e, t: Date.parse(e.date) - lights })).sort((a, b) => a.t - b.t);
    const flagRows = flagStateRows(rcRows || []).map(r => ({ t: Date.parse(r.date) - lights, s: r.s })).sort((a, b) => a.t - b.t);
    const wx = (wxRows || []).map(w => ({ t: Date.parse(w.date) - lights, air: w.air_temperature, trk: w.track_temperature, hum: w.humidity, rain: w.rainfall, wind: w.wind_speed })).filter(w => isFinite(w.t)).sort((a, b) => a.t - b.t);
    const model = { meta, lapsByDriver, lights, raceDur, totalLaps, lapStart, lastEndRel, lastLapNum, isRetired, outline, offset, progAbs, progFloat, frames, stintsByDriver, tyreAt, posByDriver, events, flagRows, penByDriver, wx };
    model.markers = computeIncidentMarkers(rcRows, model);
    model.flagZones = computeFlagZones(rcRows, lights);
    _modelCache.set(sk, model);
    return model;
  }

  async function renderTrack(body, year) {
    const curYear = new Date().getFullYear();
    year = +year || curYear;
    body.innerHTML = loading(_t('Loading races…', 'A carregar corridas…'));
    let races, liveSession = null;
    try {
      races = await seasonRacesFull(year);
      if (year === curYear) try {
        const s = await F1Data.latestSession();
        if (s) { const st = Date.parse(s.date_start), en = Date.parse(s.date_end);
          if (Date.now() >= st - 300000 && Date.now() <= en + 600000) liveSession = s; }
      } catch {}
    } catch { body.innerHTML = err(); return; }
    if (!races.length && !liveSession) { body.innerHTML = err(_t('No race data yet.', 'Ainda sem dados de corrida.')); return; }

    // OpenF1 telemetry only exists from 2023 → that's the range for the replay
    const years = []; for (let y = curYear; y >= 2023; y--) years.push(y);
    const yrOpts = years.map(y => `<option value="${y}"${y === year ? ' selected' : ''}>${y}</option>`).join('');
    const tag = r => r.status === 'upcoming' ? '⏳ ' : !r.session_key ? '∅ ' : '';
    const raceOpts = races.map(r =>
      `<option value="${r.round}">${tag(r)}R${r.round} · ${esc(r.country || r.country_name)}${r.status === 'upcoming' ? ' — ' + _t('upcoming', 'por correr') : ''}</option>`).join('');

    body.innerHTML = `
      <div class="f1-track-head">
        <div class="f1-track-sel">
          ${liveSession ? `<button class="f1-live-pill" id="f1-go-live">● ${_t('LIVE', 'AO VIVO')}</button>` : ''}
          <select class="f1-select f1-year-sel" id="f1-track-year" aria-label="${_t('Season','Época')}">${yrOpts}</select>
          <select class="f1-select" id="f1-race-sel" aria-label="${_t('Choose race','Escolher corrida')}">${raceOpts}</select>
        </div>
        <div class="f1-track-meta" id="f1-track-meta"></div>
        <div class="f1-track-presets" id="f1-track-presets">
          ${Object.entries(TRACK_PRESETS).map(([k, p]) => `<button class="f1-preset-chip" data-preset="${k}">${_t(p.en, p.pt)}</button>`).join('')}
        </div>
      </div>
      <div class="f1-stage-grid" id="f1-stage-grid">
        <aside class="f1-side">
          <h4>${_t('Order', 'Classificação')}</h4>
          <div class="f1-pos" id="f1-pos"></div>
        </aside>
        <div class="f1-center">
          <div class="f1-track-stage">
            <canvas id="f1-canvas"></canvas>
            <div class="f1-track-hint" id="f1-track-hint"></div>
            <div class="f1-stage-load" id="f1-stage-load">${loading()}</div>
          </div>
          <div class="f1-controls">
            <button class="f1-btn" id="f1-play">▶ ${_t('Play', 'Reproduzir')}</button>
            <div class="f1-seek-wrap"><input type="range" id="f1-seek" min="0" max="1000" value="0" class="f1-seek">
              <div class="f1-seek-marks" id="f1-seek-marks"></div></div>
            <div class="f1-lap" title="${_t('Jump to lap', 'Ir para a volta')}">
              <button class="f1-lap-btn" id="f1-lap-prev" aria-label="${_t('Previous lap','Volta anterior')}">◀</button>
              <span class="f1-lap-lbl">${_lang() === 'en' ? 'L' : 'V'}</span>
              <input class="f1-lap-in" id="f1-lap-in" type="number" min="1" value="1" inputmode="numeric">
              <span class="f1-lap-tot" id="f1-lap-tot"></span>
              <button class="f1-lap-btn" id="f1-lap-next" aria-label="${_t('Next lap','Volta seguinte')}">▶</button>
            </div>
            <div class="f1-speed" id="f1-speed">${SPEEDS.map(s => `<button data-s="${s}" class="${s === DEF_SPEED ? 'on' : ''}">${s}×</button>`).join('')}</div>
            <button class="f1-btn f1-icon-btn f1-toggle" id="f1-layers-btn" title="${_t('Map layers','Camadas do mapa')}">☰ <span>${_t('Layers','Camadas')}</span></button>
            <button class="f1-btn f1-icon-btn" id="f1-fs" title="${_t('Fullscreen','Ecrã inteiro')}" aria-label="${_t('Fullscreen','Ecrã inteiro')}">⛶</button>
            <div class="f1-layers-panel" id="f1-layers-panel" hidden></div>
          </div>
        </div>
        <aside class="f1-side">
          <h4>${_t('Race events', 'Eventos da corrida')}</h4>
          <div class="f1-events" id="f1-events"></div>
        </aside>
        <div class="f1-driver-pop" id="f1-driver-pop" hidden></div>
      </div>`;

    const yrSel = body.querySelector('#f1-track-year');
    yrSel.addEventListener('change', () => renderTrack(body, +yrSel.value));

    // ── map layers: state, panel, presets ──
    const _layDef = { sectors: false, corners: false, flags: true, speed: false, incidents: true, satellite: false, labels: 'code' };
    let layers; try { const a = JSON.parse(localStorage.getItem('f1:track:layers2')); layers = (a && typeof a === 'object') ? { ..._layDef, ...a } : { ..._layDef }; } catch { layers = { ..._layDef }; }
    const saveLayers = () => { try { localStorage.setItem('f1:track:layers2', JSON.stringify(layers)); } catch {} };
    let _curOutline = null, _curLatLon = null, _curSk = null, _speedFor = null;
    function applyLayers() {
      if (!_track) return;
      _track.setShowSectors(layers.sectors);
      _track.setShowCorners(layers.corners);
      _track.setShowFlagZones(layers.flags);
      _track.setShowMarkers(layers.incidents);
      _track.setLabelMode(layers.labels);
      if (layers.speed) { _track.setShowSpeed(true); if (_speedFor !== _curSk && _curSk) loadSpeed(_curSk); } else _track.setShowSpeed(false);
    }
    function syncPanelChecks() { const p = body.querySelector('#f1-layers-panel'); if (p) p.querySelectorAll('input[data-lay]').forEach(cb => cb.checked = !!layers[cb.dataset.lay]); }
    function syncPresetChips() { const cur = Object.keys(TRACK_PRESETS).find(k => { const set = new Set(TRACK_PRESETS[k].layers); return TRACK_LAYERS.every(l => !!layers[l.id] === set.has(l.id)); }); body.querySelectorAll('.f1-preset-chip').forEach(c => c.classList.toggle('on', c.dataset.preset === cur)); }
    function buildLayerPanel() {
      const p = body.querySelector('#f1-layers-panel'); if (!p) return;
      p.innerHTML = `<div class="f1-lay-hd"><b>${_t('Map layers', 'Camadas do mapa')}</b><button class="f1-lay-x" id="f1-lay-x" aria-label="${_t('Close', 'Fechar')}">✕</button></div>
        ${TRACK_LAYERS.map(l => `<label class="f1-lay-row"><span>${_t(l.en, l.pt)}</span><input type="checkbox" data-lay="${l.id}"${layers[l.id] ? ' checked' : ''}></label>`).join('')}
        <label class="f1-lay-row"><span>${_t('Labels', 'Etiquetas')}</span><select class="f1-select" id="f1-lay-labels"><option value="code"${layers.labels === 'code' ? ' selected' : ''}>${_t('Code', 'Código')}</option><option value="num"${layers.labels === 'num' ? ' selected' : ''}>${_t('Number', 'Número')}</option></select></label>`;
      p.querySelector('#f1-lay-x').onclick = () => { p.hidden = true; };
      p.querySelectorAll('input[data-lay]').forEach(cb => cb.onchange = () => { layers[cb.dataset.lay] = cb.checked; saveLayers(); applyLayers(); syncPresetChips(); });
      p.querySelector('#f1-lay-labels').onchange = e => { layers.labels = e.target.value; saveLayers(); _track && _track.setLabelMode(layers.labels); };
    }
    body.querySelector('#f1-layers-btn').onclick = () => { const p = body.querySelector('#f1-layers-panel'); p.hidden = !p.hidden; };
    body.querySelector('#f1-track-presets').addEventListener('click', e => { const c = e.target.closest('[data-preset]'); if (!c) return; const set = new Set(TRACK_PRESETS[c.dataset.preset].layers); TRACK_LAYERS.forEach(l => layers[l.id] = set.has(l.id)); saveLayers(); syncPanelChecks(); syncPresetChips(); applyLayers(); });
    buildLayerPanel(); syncPresetChips();

    async function loadSpeed(sk) {
      if (!_track) return;
      try {
        const lapRows = await F1Data.laps(sk).catch(() => []);
        const valid = (lapRows || []).filter(l => l.lap_duration && l.lap_number > 1 && l.date_start);
        if (!valid.length) return;
        const best = valid.reduce((a, b) => b.lap_duration < a.lap_duration ? b : a);
        const from = best.date_start, to = new Date(Date.parse(best.date_start) + (best.lap_duration + 2) * 1000).toISOString();
        await new Promise(r => setTimeout(r, 400));
        const [loc, car] = await Promise.all([
          F1Data.location(sk, { driver: best.driver_number, from, to }).catch(() => []),
          F1Data.carData(sk, { driver: best.driver_number, from, to }).catch(() => []),
        ]);
        const locP = (loc || []).filter(p => (p.x || p.y) && isFinite(p.x) && isFinite(p.y)).map(p => ({ t: Date.parse(p.date), x: p.x, y: p.y }));
        const carP = (car || []).filter(c => c.speed != null).map(c => ({ t: Date.parse(c.date), v: c.speed })).sort((a, b) => a.t - b.t);
        if (locP.length < 8 || !carP.length) return;
        let maxV = -1e9, minV = 1e9;
        const pts = locP.map(p => { let lo = 0, hi = carP.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; carP[m].t <= p.t ? lo = m : hi = m; } const v = Math.abs(carP[lo].t - p.t) <= Math.abs(carP[hi].t - p.t) ? carP[lo].v : carP[hi].v; if (v > maxV) maxV = v; if (v < minV) minV = v; return { x: p.x, y: p.y, v }; });
        const range = (maxV - minV) || 1; pts.forEach(p => p.v = (p.v - minV) / range);
        if (_track) { _track.setSpeedData(pts); _speedFor = sk; }
      } catch {}
    }
    const sel = body.querySelector('#f1-race-sel');
    const pastData = races.filter(r => r.session_key && r.status === 'past');
    const def = pastData[pastData.length - 1] || races.find(r => r.status === 'upcoming') || races[0];
    if (def) sel.value = String(def.round);
    sel.addEventListener('change', () => loadRound(+sel.value));
    const goLive = body.querySelector('#f1-go-live');
    if (goLive) goLive.addEventListener('click', () => loadLive(liveSession));

    if (liveSession && !def) loadLive(liveSession);
    else if (def) loadRound(def.round);

    function loadRound(round) {
      const r = races.find(x => x.round === round); if (!r) return;
      if (r.status === 'upcoming') return loadUpcoming(r);
      if (r.session_key) return loadRace(r.session_key);
      return showNoData(r);
    }
    function _resetSat() {
      if (_satMap) { try { _satMap.remove(); } catch {} _satMap = null; }
      const se = body.querySelector('#f1-track-satmap'), sb = body.querySelector('#f1-track-sat');
      if (se) { se.hidden = true; se.innerHTML = ''; } if (sb) sb.classList.remove('on');
    }
    function _resetStage() {
      clearInterval(_liveTimer); _liveTimer = null;
      if (_track) { _track.dispose(); _track = null; }
      _resetSat();
      const pos = body.querySelector('#f1-pos'), ev = body.querySelector('#f1-events');
      if (pos) pos.innerHTML = ''; if (ev) ev.innerHTML = '';
    }
    function showNoData(r) {
      _resetStage();
      body.querySelector('#f1-track-meta').innerHTML = `<b>${esc(r.raceName)}</b> · ${esc(r.country)} ${r.year}`;
      const stage = body.querySelector('#f1-stage-load'); stage.style.display = '';
      stage.innerHTML = `<div class="f1-empty f1-nodata">🛰️ <span>${_t('Live telemetry (map · timing · incidents) only exists from 2023.', 'A telemetria ao vivo (mapa · tempos · incidentes) só existe a partir de 2023.')}</span><small>${_t('Results & lap times are in Championship / Timing.', 'Resultados e tempos por volta estão em Campeonato / Tempos.')}</small></div>`;
    }
    async function loadUpcoming(r) {
      _resetStage();
      body.querySelector('#f1-track-meta').innerHTML = `<b>${esc(r.country)}</b> · ${esc(r.circuitName || '')}`;
      const stage = body.querySelector('#f1-stage-load'); stage.style.display = '';
      const days = Math.max(0, Math.ceil((r._ts - Date.now()) / 86400000));
      stage.innerHTML = `<div class="f1-upcoming">
        <div class="f1-up-tag">⏳ ${_t('Upcoming', 'Por correr')}</div>
        <div class="f1-up-gp">${flag(r.country)}${esc(r.raceName)}</div>
        <div class="f1-up-when">🗓️ ${new Date(r._ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })} · <b>${_t('in', 'daqui a')} ${days} ${days === 1 ? _t('day', 'dia') : _t('days', 'dias')}</b></div>
        <div class="f1-up-cd">${countdown(r._ts)}</div>
        <div class="f1-circ-views f1-up-views" id="f1-up-views">
          <button data-uv="schema" class="on">📐 ${_t('Schematic', 'Esquema')}</button>
          <button data-uv="sat"${isFinite(r.lat) && isFinite(r.lon) ? '' : ' disabled'}>🛰️ ${_t('Satellite', 'Satélite')}</button>
        </div>
        <div class="f1-up-canvas-wrap" id="f1-up-canvas-wrap"><canvas id="f1-up-canvas"></canvas></div>
        <div class="f1-up-map" id="f1-up-map" hidden></div>
        <div class="f1-up-note">${_t('The live map, timing & incidents appear once the race runs.', 'O mapa ao vivo, tempos e incidentes ficam disponíveis depois da corrida.')}</div>
      </div>`;
      const upViews = stage.querySelector('#f1-up-views');
      if (upViews && isFinite(r.lat) && isFinite(r.lon)) {
        const cwrap = stage.querySelector('#f1-up-canvas-wrap'), mapEl = stage.querySelector('#f1-up-map');
        upViews.addEventListener('click', async e => {
          const b = e.target.closest('[data-uv]'); if (!b || b.disabled) return;
          upViews.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
          if (b.dataset.uv === 'schema') { cwrap.hidden = false; mapEl.hidden = true; _track && _track.resize(); }
          else { cwrap.hidden = true; mapEl.hidden = false; if (_satMap) { try { _satMap.remove(); } catch {} _satMap = null; } mapEl.innerHTML = ''; try { _satMap = await makeSatMap(mapEl, r.lat, r.lon, 'sat'); } catch { mapEl.innerHTML = err(); } }
        });
      }
      // draw the circuit outline from the most recent past edition at this venue
      try {
        const meta = await F1Data.circuitsMeta(); const of1 = meta[r.circuitId] && meta[r.circuitId].of1;
        if (of1) {
          let outline = null;
          for (const y of [curYear, curYear - 1, curYear - 2]) {
            const rs = await F1Data.racesOfYear(y).catch(() => []);
            const pasts = (rs || []).filter(x => x.circuit_short_name === of1 && Date.parse(x.date_start) < Date.now());
            if (pasts.length) { const M = await buildRaceModel(pasts[pasts.length - 1].session_key); if (!M.error) { outline = M.outline; break; } }
          }
          const cv = stage.querySelector('#f1-up-canvas');
          if (outline && cv) { const t = F1Track.create(cv); t.setTrack(outline); t.setCorners(detectCorners(outline)); t.setShowCorners(true); _track = t; }
          else if (cv) cv.closest('.f1-up-canvas-wrap').style.display = 'none';
        }
      } catch {}
    }

    /* ── load + wire a single race replay (WHOLE race) ──
       The full X/Y telemetry of a 90-min race is ~50 MB, so instead each car
       is placed on a real track outline by its lap progress (from /laps —
       only ~600 KB for the entire race). Position on the lap = how far through
       the current lap the car is; a small constant per-grid-slot offset keeps
       the field from overlapping at the start. */
    async function loadRace(sk) {
      clearInterval(_liveTimer); _liveTimer = null;
      if (_track) { _track.dispose(); _track = null; }
      _resetSat();
      const race = (races || []).find(r => r.session_key === sk) || {};
      const stage = body.querySelector('#f1-stage-load');
      const metaEl = body.querySelector('#f1-track-meta');
      const posEl = body.querySelector('#f1-pos');
      const evEl = body.querySelector('#f1-events');
      stage.style.display = ''; stage.innerHTML = loading(_t('Loading the full race…', 'A carregar a corrida completa…'));
      posEl.innerHTML = ''; evEl.innerHTML = '';
      const raceLabel = `<b>${esc(race.circuit_short_name)}</b> · ${esc(race.country_name)} ${race.year || ''} <span class="f1-replay-tag">${_t('full race', 'corrida completa')}</span> `;
      metaEl.innerHTML = raceLabel;
      const fail = msg => { stage.style.display = ''; stage.innerHTML =
        `<div class="f1-empty">⚠ ${esc(msg || _t('Could not load data.', 'Não foi possível carregar os dados.'))}
          <button class="f1-btn f1-retry" id="f1-retry">↻ ${_t('Retry', 'Tentar de novo')}</button></div>`;
        const rb = stage.querySelector('#f1-retry'); if (rb) rb.onclick = () => loadRace(sk); };

      try {
        const M = await buildRaceModel(sk);
        if (M.error) { fail(M.error); return; }
        const { meta, lapsByDriver, lights, raceDur, totalLaps, lapStart, lastEndRel, lastLapNum,
          isRetired, outline, progAbs, progFloat, frames, tyreAt, posByDriver, events, flagRows, penByDriver, wx } = M;

        // ── build the track + its data layers ──
        const canvas = body.querySelector('#f1-canvas');
        _track = F1Track.create(canvas);
        _track.setDrivers(meta);
        _track.setTrack(outline);
        _track.setReplay(frames);
        _track.setMarkers(M.markers || []);
        _track.setCorners(detectCorners(outline));
        _track.setSectorSplit([Math.floor(outline.length / 3), Math.floor(outline.length * 2 / 3)]);
        if (M.flagZones) _track.setFlagZones(M.flagZones.zones, M.flagZones.maxSector);
        // expose race context for the satellite + speed layers, then apply the chosen layers
        _curOutline = outline; _curSk = sk; _speedFor = null;
        _curLatLon = (isFinite(race.lat) && isFinite(race.lon)) ? { lat: race.lat, lon: race.lon, key: race.circuit_short_name || String(sk) } : null;
        applyLayers();
        stage.style.display = 'none';
        body.querySelector('#f1-track-hint').textContent = _t('Drag the bar · play to watch the whole race', 'Arrasta a barra · play para ver a corrida toda');

        const seek = body.querySelector('#f1-seek');
        const lapIn = body.querySelector('#f1-lap-in');
        const playBtn = body.querySelector('#f1-play');
        lapIn.max = totalLaps;
        body.querySelector('#f1-lap-tot').textContent = '/' + totalLaps;

        function latestAt(arr, ms, key) { let v; for (const e of arr || []) { if (e.t <= ms) v = e[key]; else break; } return v; }
        function orderAt(ms) {
          const run = [], out = [];
          for (const num in posByDriver) {
            const p = latestAt(posByDriver[num], ms, 'p'); if (p == null) continue;
            if (isRetired(num) && ms > lastEndRel[num]) out.push({ num, p, retired: true });
            else run.push({ num, p });
          }
          run.sort((a, b) => a.p - b.p); out.sort((a, b) => a.p - b.p);
          return run.concat(out);
        }
        function fmtGap(num, aheadNum, ms) {
          const self = progFloat(num, ms), ah = progFloat(aheadNum, ms);
          if (self == null || ah == null) return '';
          const d = ah - self;
          if (d >= 0.85) return '+' + Math.round(d) + (_lang() === 'en' ? ' lap' : ' v');   // laps down
          const lapMs = (lapsByDriver[num]?.find(l => l.lap === (Math.floor(self) + 1))?.dur) || 90000;
          return '+' + Math.max(0, d * lapMs / 1000).toFixed(1);
        }
        const pensUntil = (num, ms) => (penByDriver[num] || []).filter(p => p.t <= lights + ms);
        function paintPos(ms) {
          const ord = orderAt(ms);
          const lead = ord.find(o => !o.retired); if (lead) _track.setLeader(lead.num);
          let runIdx = -1;
          posEl.innerHTML = ord.map(o => {
            const m = meta[o.num] || {};
            const lap = Math.min(lastLapNum[o.num] || 1, (progAbs(lapsByDriver[o.num], lights + ms) || { lap: lastLapNum[o.num] }).lap || 1);
            const comp = (tyreAt(o.num, lap).compound || '');
            const ty = tyre(comp);
            if (!o.retired) runIdx++;
            const gap = o.retired ? _t('DNF', 'Abandono') : runIdx === 0 ? _t('LEADER', 'LÍDER') : fmtGap(o.num, ord[runIdx - 1] ? ord[runIdx - 1].num : o.num, ms);
            const pen = pensUntil(o.num, ms);
            const penBadge = pen.length ? `<span class="f1-pen f1-pen-${pen[pen.length - 1].type}">${esc(pen[pen.length - 1].label)}</span>` : '';
            // extra info shown when the panel is wide (hidden on narrow via container query)
            let llDur = 0; for (const l of (lapsByDriver[o.num] || [])) { if (l.end <= lights + ms && l.dur) llDur = l.dur; }
            const st = tyreAt(o.num, lap), age = st.lap_start != null ? (lap - st.lap_start + (st.tyre_age_at_start || 0)) : null;
            return `<div class="f1-pos-row${o.retired ? ' out' : ''}" data-num="${o.num}">
              <span class="f1-pos-p">${o.retired ? '–' : o.p}</span>
              <span class="f1-pos-num" style="border-color:${teamCol(m.colour)}">${esc(o.num)}</span>
              <span class="f1-pos-name">${esc(m.code || o.num)}</span>
              ${o.retired ? '' : `<span class="f1-tyre t-${comp.toLowerCase()}" title="${esc(comp)}${age != null ? ' · ' + age + 'v' : ''}">${ty.l}</span>`}
              ${o.retired ? '' : `<span class="f1-pos-age">${age != null ? age + 'v' : ''}</span>`}
              ${penBadge}
              <span class="f1-pos-ll">${llDur ? fmtLapTime(llDur / 1000) : ''}</span>
              <span class="f1-pos-gap">${gap}</span></div>`;
          }).join('') || `<div class="f1-empty">${_t('No order', 'Sem ordem')}</div>`;
        }
        // events list built ONCE; ticks only toggle classes + autoscroll (no re-render,
        // so hover/scroll aren't disturbed)
        evEl.innerHTML = events.map((e, i) => {
          const mm = e.t < 0 ? '0:00' : `${Math.floor(e.t / 60000)}:${String(Math.floor(e.t % 60000 / 1000)).padStart(2, '0')}`;
          const car = +e.driver_number || +((String(e.msg || '').match(/CAR (\d+)/) || [])[1]) || 0;
          return `<div class="f1-ev k-${e.kind}" data-i="${i}" data-t="${e.t}"${car ? ` data-car="${car}"` : ''}>
            <span class="f1-ev-ic">${e.icon}</span>
            <span class="f1-ev-tx"><b>${esc(e.msg)}</b><small>${mm}${e.lap ? ' · ' + _t('lap ', 'V') + e.lap : ''}</small></span></div>`;
        }).join('') || `<div class="f1-empty">${_t('No notable events', 'Sem eventos relevantes')}</div>`;
        const evNodes = [...evEl.querySelectorAll('.f1-ev')];
        let lastCur = -1;
        function updateEvents(ms) {
          let cur = -1;
          for (let i = 0; i < events.length; i++) { const done = events[i].t <= ms; evNodes[i].classList.toggle('done', done); if (done) cur = i; }
          if (cur !== lastCur) {
            if (lastCur >= 0) evNodes[lastCur].classList.remove('cur');
            if (cur >= 0) { evNodes[cur].classList.add('cur'); if (_track.playing) evNodes[cur].scrollIntoView({ block: 'nearest' }); }
            lastCur = cur;
          }
        }
        function flagAt(ms) { let s = null; for (const r of flagRows) { if (r.t <= ms) s = r.s; else break; } return s; }

        // weather (wx from the model) → inline chip next to the race name, like the Piloto tab
        function paintWx(ms) {
          let w = null; for (const r of wx) { if (r.t <= ms) w = r; else break; } if (!w) w = wx[0];
          const chip = w ? `<span class="f1-dr-wx">${w.rain > 0 ? '🌧️' : '☀️'} ${Math.round(w.air)}°C · ${_t('track', 'pista')} ${Math.round(w.trk)}° · 💧 ${Math.round(w.hum)}%${w.wind != null ? ' · 💨 ' + Math.round(w.wind) + ' m/s' : ''}</span>` : '';
          metaEl.innerHTML = raceLabel + chip;
        }

        // seek-bar markers — only the notable events, across the whole race
        const markKinds = { sc: 1, vsc: 1, red: 1, incident: 1, penalty: 1, chequered: 1 };
        body.querySelector('#f1-seek-marks').innerHTML = events.filter(e => markKinds[e.kind] && e.t >= 0).map(e =>
          `<i class="m-${e.kind}" style="left:${Math.min(100, e.t / raceDur * 100)}%"></i>`).join('');

        let curMs = 0;
        function onClock(frac) {
          if (!_track) return;
          const ms = frac * (_track.duration || 1); curMs = ms;
          seek.value = Math.round(frac * 1000);
          _track.setFlag(flagAt(ms));
          const lead = orderAt(ms).find(o => !o.retired);
          const lap = lead ? (progAbs(lapsByDriver[lead.num], lights + ms) || {}).lap || 1 : 1;
          if (document.activeElement !== lapIn) lapIn.value = Math.min(totalLaps, lap);
          paintPos(ms); updateEvents(ms); paintWx(ms);
          const peC = body.querySelector('#f1-pe-cursor');
          if (peC) peC.style.left = (totalLaps > 1 ? (Math.min(totalLaps, lap) - 1) / (totalLaps - 1) * 100 : 0) + '%';
          if (!pop.hidden && popNum != null) showPop(popNum);     // keep popup fresh while open
        }
        _track.setOnTick(onClock);
        _track.setSpeed(DEF_SPEED);

        // ── driver popup (hover) ──
        const pop = body.querySelector('#f1-driver-pop'); let popNum = null;
        function showPop(num) {
          const m = meta[num] || {}; const ms = curMs;
          const lap = (progAbs(lapsByDriver[num], lights + ms) || { lap: lastLapNum[num] }).lap || 1;
          const st = tyreAt(num, lap), comp = st.compound || '';
          const age = st.lap_start != null ? (lap - st.lap_start + (st.tyre_age_at_start || 0)) : null;
          const pos = latestAt(posByDriver[num], ms, 'p');
          const pens = pensUntil(num, ms);
          pop.innerHTML = `
            <div class="f1-dp-head"><span class="f1-dp-num" style="background:${teamCol(m.colour)}">${esc(num)}</span>
              <div><div class="f1-dp-name">${esc(m.name || m.code || num)}</div>
              <div class="f1-dp-team">${esc(m.team || '')}${m.country ? ' · ' + esc(m.country) : ''}</div></div></div>
            <div class="f1-dp-rows">
              <div><span>${_t('Position', 'Posição')}</span><b>${isRetired(num) && ms > lastEndRel[num] ? _t('DNF', 'Abandono') : 'P' + (pos || '—')}</b></div>
              ${comp ? `<div><span>${_t('Tyre', 'Pneu')}</span><b><span class="f1-tyre t-${comp.toLowerCase()}">${tyre(comp).l}</span> ${esc(comp[0] + comp.slice(1).toLowerCase())}${age != null ? ' · ' + age + ' ' + _t('laps', 'voltas') : ''}</b></div>` : ''}
            </div>
            ${pens.length ? `<div class="f1-dp-pens"><div class="f1-dp-lbl">${_t('Penalties', 'Penalizações')}</div>${pens.map(p =>
              `<div class="f1-dp-pen"><span class="f1-pen f1-pen-${p.type}">${esc(p.label)}</span><span>${_t('lap ', 'V')}${p.lap || '?'} · ${esc(p.reason || '')}</span></div>`).join('')}</div>` : ''}`;
          pop.hidden = false;
          const row = posEl.querySelector(`.f1-pos-row[data-num="${num}"]`);
          if (row) { const rr = row.getBoundingClientRect(), gr = body.querySelector('#f1-stage-grid').getBoundingClientRect();
            pop.style.top = (rr.bottom - gr.top + 4) + 'px'; pop.style.left = Math.max(0, rr.left - gr.left) + 'px'; }
        }
        posEl.addEventListener('mouseover', e => { const row = e.target.closest('.f1-pos-row'); if (!row) return; popNum = +row.dataset.num; showPop(popNum); _track && _track.setHighlightCar(+row.dataset.num); });
        posEl.addEventListener('mouseleave', () => { pop.hidden = true; popNum = null; _track && _track.setHighlightCar(null); });
        // click a driver → open the Piloto tab focused on them, same race
        posEl.style.cursor = 'pointer';
        posEl.addEventListener('click', e => { const row = e.target.closest('.f1-pos-row'); if (!row) return; _pendingDriver = { sk, num: +row.dataset.num }; _go('driver'); });
        // hover a race event mentioning a car → highlight that car on the map
        evEl.addEventListener('mouseover', e => { const row = e.target.closest('.f1-ev'); if (!row || !row.dataset.car) return; _track && _track.setHighlightCar(+row.dataset.car); });
        evEl.addEventListener('mouseleave', () => { _track && _track.setHighlightCar(null); });

        onClock(0);

        function seekToLap(L) {
          L = Math.max(1, Math.min(totalLaps, Math.round(L) || 1));
          let t = lapStart[L]; if (t == null) return;
          const tn = lapStart[L + 1];                          // nudge a little into the lap so the read-out matches
          t += (tn != null ? (tn - t) : 6000) * 0.15;
          _track.seek(Math.max(0, t) / (_track.duration || 1));
        }
        lapIn.onchange = () => seekToLap(+lapIn.value);
        body.querySelector('#f1-lap-prev').onclick = () => seekToLap((+lapIn.value || 1) - 1);
        body.querySelector('#f1-lap-next').onclick = () => seekToLap((+lapIn.value || 1) + 1);

        playBtn.onclick = () => { const on = _track.toggle(); playBtn.textContent = on ? '⏸ ' + _t('Pause', 'Pausa') : '▶ ' + _t('Play', 'Reproduzir'); };
        seek.oninput = () => _track.seek(seek.value / 1000);
        body.querySelector('#f1-speed').onclick = e => { const b = e.target.closest('button'); if (!b) return; _track.setSpeed(+b.dataset.s); body.querySelectorAll('#f1-speed button').forEach(x => x.classList.toggle('on', x === b)); };
        // click an event → jump there and pause; hover an event → pulse its spot on the map
        evEl.onclick = e => { const row = e.target.closest('.f1-ev'); if (!row) return;
          _track.pause(); playBtn.textContent = '▶ ' + _t('Play', 'Reproduzir');
          _track.seek(Math.max(0, +row.dataset.t) / (_track.duration || 1)); };
        // fullscreen
        body.querySelector('#f1-fs').onclick = () => {
          const g = body.querySelector('#f1-stage-grid');
          if (!document.fullscreenElement) (g.requestFullscreen || g.webkitRequestFullscreen || (() => {})).call(g);
          else document.exitFullscreen && document.exitFullscreen();
        };

        _track.play(); playBtn.textContent = '⏸ ' + _t('Pause', 'Pausa');
      } catch (e) { fail(); }
    }

    /* ── live mode (best-effort; only active on a real session weekend) ── */
    async function loadLive(session) {
      clearInterval(_liveTimer); _liveTimer = null;
      if (_track) { _track.dispose(); _track = null; }
      const sk = session.session_key;
      const stage = body.querySelector('#f1-stage-load');
      const metaEl = body.querySelector('#f1-track-meta');
      const posEl = body.querySelector('#f1-pos');
      const evEl = body.querySelector('#f1-events');
      stage.style.display = ''; stage.innerHTML = loading(_t('Connecting live…', 'A ligar ao vivo…'));
      metaEl.innerHTML = `<b>${esc(session.circuit_short_name)}</b> · ${esc(session.session_name)}
        <span class="f1-replay-tag live">● ${_t('LIVE', 'AO VIVO')}</span>`;
      body.querySelectorAll('.f1-controls, #f1-seek-marks').forEach(el => el.style.display = 'none');

      let meta = {}, t0 = null;
      try {
        const drv = await F1Data.drivers(sk);
        (drv || []).forEach(d => { meta[d.driver_number] = { name: d.full_name, code: d.name_acronym, colour: d.team_colour, team: d.team_name, num: d.driver_number, country: d.country_code }; });
      } catch {}
      const canvas = body.querySelector('#f1-canvas');
      _track = F1Track.create(canvas);
      _track.setDrivers(meta);
      const buf = {};                                        // rolling location buffer

      // live state for the hover popup (kept fresh each poll)
      let liveOrder = [], liveIv = new Map(), livePen = {}, livePopNum = null;
      const pop = body.querySelector('#f1-driver-pop');
      function showLivePop(num) {
        const m = meta[num] || {};
        const o = liveOrder.find(x => x.driver_number === num);
        const iv = liveIv.get(num);
        const pens = livePen[num] || [];
        const gapLead = iv && typeof iv.gap_to_leader === 'number' ? '+' + iv.gap_to_leader.toFixed(1) + 's' : '—';
        const gapAhead = iv && typeof iv.interval === 'number' ? '+' + iv.interval.toFixed(1) + 's' : '—';
        pop.innerHTML = `
          <div class="f1-dp-head"><span class="f1-dp-num" style="background:${teamCol(m.colour)}">${esc(num)}</span>
            <div><div class="f1-dp-name">${esc(m.name || m.code || num)}</div>
            <div class="f1-dp-team">${esc(m.team || '')}${m.country ? ' · ' + esc(m.country) : ''}</div></div></div>
          <div class="f1-dp-rows">
            <div><span>${_t('Position', 'Posição')}</span><b>${o ? 'P' + o.position : '—'}</b></div>
            <div><span>${_t('Gap to leader', 'Diferença p/ líder')}</span><b>${o && o.position === 1 ? _t('LEADER', 'LÍDER') : gapLead}</b></div>
            <div><span>${_t('Interval', 'Intervalo')}</span><b>${o && o.position === 1 ? '—' : gapAhead}</b></div>
          </div>
          ${pens.length ? `<div class="f1-dp-pens"><div class="f1-dp-lbl">${_t('Penalties', 'Penalizações')}</div>${pens.map(p =>
            `<div class="f1-dp-pen"><span class="f1-pen f1-pen-${p.type}">${esc(p.label)}</span><span>${_t('lap ', 'V')}${p.lap || '?'} · ${esc(p.reason || '')}</span></div>`).join('')}</div>` : ''}`;
        pop.hidden = false;
        const row = posEl.querySelector(`.f1-pos-row[data-num="${num}"]`);
        if (row) { const rr = row.getBoundingClientRect(), gr = body.querySelector('#f1-stage-grid').getBoundingClientRect();
          pop.style.top = (rr.bottom - gr.top + 4) + 'px'; pop.style.left = Math.max(0, rr.left - gr.left) + 'px'; }
      }
      posEl.addEventListener('mouseover', e => { const row = e.target.closest('.f1-pos-row'); if (!row || !row.dataset.num) return; livePopNum = +row.dataset.num; showLivePop(livePopNum); });
      posEl.addEventListener('mouseleave', () => { pop.hidden = true; livePopNum = null; });

      async function poll() {
        try {
          const now = Date.now();
          const fromISO = new Date(now - 45000).toISOString();
          const [posRows, loc, rcRows, ivRows] = await Promise.all([
            F1Data.positions(sk).catch(() => []),
            F1Data.location(sk, { from: fromISO }).catch(() => []),
            F1Data.raceControl(sk).catch(() => []),
            F1Data.intervalsWindow(sk, fromISO).catch(() => []),
          ]);
          if (loc && loc.length) {
            if (t0 == null) t0 = Date.parse(loc[0].date);
            for (const p of loc) { if (!isFinite(p.x) || (p.x === 0 && p.y === 0)) continue; (buf[p.driver_number] = buf[p.driver_number] || []).push({ t: Date.parse(p.date) - t0, x: p.x, y: p.y }); }
            for (const n in buf) buf[n] = buf[n].slice(-60);
            let lead = Object.keys(buf).sort((a, b) => buf[b].length - buf[a].length)[0];
            if (!_track._hasTrack && buf[lead]) { _track.setTrack(buf[lead].map(p => ({ x: p.x, y: p.y }))); _track._hasTrack = true; }
            _track.setReplay(buf); _track.setLiveClock(_track.duration);
          }
          const order = F1Data.latestOrder(posRows);
          const ivMap = F1Data.latestIntervals(ivRows);
          liveOrder = order; liveIv = ivMap; livePen = parsePenalties(rcRows);
          if (order[0]) _track.setLeader(order[0].driver_number);
          posEl.innerHTML = order.map(o => {
            const m = meta[o.driver_number] || {}, iv = ivMap.get(o.driver_number);
            const gap = o.position === 1 ? _t('LEADER', 'LÍDER') : (iv && typeof iv.interval === 'number' ? '+' + iv.interval.toFixed(1) : '');
            const pens = livePen[o.driver_number] || [];
            const penBadge = pens.length ? `<span class="f1-pen f1-pen-${pens[pens.length - 1].type}">${esc(pens[pens.length - 1].label)}</span>` : '';
            return `<div class="f1-pos-row" data-num="${o.driver_number}"><span class="f1-pos-p">${o.position}</span>
              <span class="f1-pos-num" style="border-color:${teamCol(m.colour)}">${esc(o.driver_number)}</span>
              <span class="f1-pos-name">${esc(m.code || o.driver_number)}</span>
              ${penBadge}
              <span class="f1-pos-gap">${gap}</span></div>`;
          }).join('') || `<div class="f1-empty">${_t('Waiting for data…', 'À espera de dados…')}</div>`;
          if (livePopNum != null && !pop.hidden) showLivePop(livePopNum);  // keep popup fresh + repositioned
          const evs = (rcRows || []).map(rcEntry).filter(rcKeep).slice(-30).reverse();
          evEl.innerHTML = evs.map(e => `<div class="f1-ev k-${e.kind} inwin"><span class="f1-ev-ic">${e.icon}</span>
            <span class="f1-ev-tx"><b>${esc(e.msg)}</b><small>${e.lap ? _t('lap ', 'volta ') + e.lap : ''}</small></span></div>`).join('') || `<div class="f1-empty">—</div>`;
          // flag overlay from the most recent state
          const fr = flagStateRows(rcRows || []); _track.setFlag(fr.length ? fr[fr.length - 1].s : null);
          stage.style.display = 'none';
        } catch { /* keep last frame */ }
      }
      await poll(); _track.start();
      _liveTimer = setInterval(poll, 5000);
    }
  }

  /* ══════════ shared: lap-time format, race list, race picker, sparkline ══════════ */
  const fmtLapTime = s => { if (s == null || !isFinite(s) || s <= 0) return '—'; const m = Math.floor(s / 60), sec = (s % 60).toFixed(3); return m > 0 ? `${m}:${sec.padStart(6, '0')}` : sec; };
  async function pastRacesAndLive(year) {
    const cur = new Date().getFullYear(); year = +year || cur;
    const races = await seasonRacesFull(year);
    let live = null;
    if (year === cur) try { const s = await F1Data.latestSession(); if (s) { const st = Date.parse(s.date_start), en = Date.parse(s.date_end); if (Date.now() >= st - 300000 && Date.now() <= en + 600000) live = s; } } catch {}
    const past = (races || []).filter(r => r.status === 'past' && r.session_key);   // these tabs need telemetry (2023→)
    return { races, past, live, year };
  }
  function raceSelect(past, live, id, year) {
    const cur = new Date().getFullYear(); year = +year || cur;
    const years = []; for (let y = cur; y >= 2023; y--) years.push(y);
    const yrOpts = years.map(y => `<option value="${y}"${y === year ? ' selected' : ''}>${y}</option>`).join('');
    const opts = past.slice().reverse().map(r => `<option value="${r.session_key}">R${r.round} · ${esc(r.country || r.country_name || r.circuit_short_name)}</option>`).join('');
    return `<div class="f1-track-sel">${live ? `<button class="f1-live-pill" data-golive="1">● ${_t('LIVE', 'AO VIVO')}</button>` : ''}<select class="f1-select f1-year-sel" id="${id}-yr" aria-label="${_t('Season', 'Época')}">${yrOpts}</select><select class="f1-select" id="${id}" aria-label="${_t('Choose race', 'Escolher corrida')}">${opts}</select></div>`;
  }
  /* tiny SVG line chart from [{x,y}] (y already screen-oriented or via invert) */
  function spark(pts, w, h, { color = '#ff2d24', invert = false, pad = 3, fill = false } = {}) {
    if (!pts || pts.length < 2) return '';
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sx = v => pad + (x1 === x0 ? 0 : (v - x0) / (x1 - x0)) * (w - 2 * pad);
    const sy = v => { const t = y1 === y0 ? 0.5 : (v - y0) / (y1 - y0); return pad + (invert ? t : 1 - t) * (h - 2 * pad); };
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
    const area = fill ? `<path d="${d} L${sx(x1).toFixed(1)} ${h} L${sx(x0).toFixed(1)} ${h} Z" fill="${color}" opacity=".12"/>` : '';
    return `<svg class="f1-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  }
  const COMP_HEX = { SOFT: '#e8002d', MEDIUM: '#f6c700', HARD: '#e6e6e6', INTERMEDIATE: '#3fb950', WET: '#2d7dff' };

  /* ════════════════════════════ LIVE TIMING ════════════════════════════
     F1-TV-style configurable timing screen. Reuses F1Data (drivers, positions,
     intervals, laps, stints, pit, race_control) — no extra API surface; the
     data layer caches/serialises every call. Live polling + replay of the
     latest race. User-configurable columns with quick presets, sector/tyre
     colours, auto highlights and a per-driver detail drawer. Mobile: identity
     columns stay pinned, the rest scroll horizontally. */
  const LIVE_DEFAULT = ['team', 'tyre', 'tyreAge', 'last', 'best', 'gapLeader', 'interval'];

  async function renderLive(body, year) {
    body.innerHTML = loading(_t('Loading races…', 'A carregar corridas…'));
    let info; try { info = await pastRacesAndLive(year); } catch { body.innerHTML = err(); return; }
    const { past, live } = info;
    if (!past.length && !live) { body.innerHTML = err(_t('No race data yet.', 'Ainda sem dados de corrida.')); return; }

    /* ── column registry (id-only ones are pinned identity; rest toggle) ── */
    const GRP = { tempos: ['Times', 'Tempos'], pneus: ['Tyres & strategy', 'Pneus & estratégia'], perf: ['Performance', 'Performance'], estado: ['Status', 'Estado'], id: ['Identity', 'Identidade'] };
    const fmtGapVal = (v, pos, iv) => {
      if (v == null || v === '') return pos === 1 ? (iv ? '—' : _t('LEADER', 'LÍDER')) : '—';
      if (typeof v === 'string') return esc(v);
      if (v === 0) return pos === 1 ? (iv ? '—' : _t('LEADER', 'LÍDER')) : '—';
      return '+' + v.toFixed(3);
    };
    const secCell = (v, best, pb) => {
      if (!v) return { h: '—' };
      const c = best && Math.abs(v - best) < 0.0015 ? 'f1-purple' : (pb && v <= pb + 0.0015 ? 'f1-green' : '');
      return { h: fmtLapTime(v), c };
    };
    const lapCell = (v, d, ctx) => {
      if (!v) return { h: '—' };
      const c = ctx.bLap && Math.abs(v - ctx.bLap) < 0.0015 ? 'f1-purple' : (d.best && Math.abs(v - d.best) < 0.0015 ? 'f1-green' : '');
      return { h: fmtLapTime(v), c };
    };
    function stintBar(d) {
      const total = (model && model.ctx.leaderLaps) || 1;
      if (!d.stints.length) return '—';
      return d.stints.map(s => {
        const end = s.lap_end || total, laps = Math.max(1, end - s.lap_start + 1);
        return `<span class="f1-lv-stint t-${String(s.compound || 'unknown').toLowerCase()}" title="${esc(s.compound || '?')} · ${_t('laps', 'voltas')} ${s.lap_start}–${end}">${tyre(s.compound).l}<small>${laps}</small></span>`;
      }).join('<span class="f1-lv-pit">⛽</span>');
    }
    const C = {
      team:    { grp: 'id', en: 'Team', pt: 'Equipa', cell: d => ({ h: esc(d.team || '') }) },
      last:    { grp: 'tempos', en: 'Last lap', pt: 'Última volta', cell: (d, x) => lapCell(d.last, d, x) },
      best:    { grp: 'tempos', en: 'Best lap', pt: 'Melhor volta', cell: (d, x) => ({ h: fmtLapTime(d.best), c: d.best && x.bLap && Math.abs(d.best - x.bLap) < 0.0015 ? 'f1-purple' : '' }) },
      avg:     { grp: 'tempos', en: 'Avg (5)', pt: 'Média (5)', cell: d => ({ h: fmtLapTime(d.avg) }) },
      gapLeader: { grp: 'tempos', en: 'Gap', pt: 'Gap líder', cell: d => ({ h: fmtGapVal(d.gapLeader, d.pos, false) }) },
      interval: { grp: 'tempos', en: 'Interval', pt: 'Intervalo', cell: d => ({ h: fmtGapVal(d.interval, d.pos, true) }) },
      s1:      { grp: 'tempos', en: 'S1', pt: 'S1', cell: (d, x) => secCell(d.s1, x.b1, d.pb1) },
      s2:      { grp: 'tempos', en: 'S2', pt: 'S2', cell: (d, x) => secCell(d.s2, x.b2, d.pb2) },
      s3:      { grp: 'tempos', en: 'S3', pt: 'S3', cell: (d, x) => secCell(d.s3, x.b3, d.pb3) },
      tyre:    { grp: 'pneus', en: 'Tyre', pt: 'Pneu', cell: d => ({ h: d.tyreCompound ? `<span class="f1-tyre t-${d.tyreCompound.toLowerCase()}">${tyre(d.tyreCompound).l}</span>` : '—' }) },
      tyreAge: { grp: 'pneus', en: 'Age', pt: 'Idade', cell: d => ({ h: d.tyreAge != null ? d.tyreAge + 'L' : '—' }) },
      stops:   { grp: 'pneus', en: 'Stops', pt: 'Paragens', cell: d => ({ h: String(d.pitCount) }) },
      stints:  { grp: 'pneus', en: 'Stints', pt: 'Stints', cell: d => ({ h: stintBar(d), c: 'f1-lv-stintcell' }) },
      topSpeed: { grp: 'perf', en: 'Top km/h', pt: 'Vel máx', cell: (d, x) => ({ h: d.topSpeed || '—', c: d.topSpeed && d.topSpeed === x.topMax ? 'f1-purple' : '' }) },
      consistency: { grp: 'perf', en: 'Consistency', pt: 'Consistência', cell: d => ({ h: d.consistency != null ? '±' + d.consistency.toFixed(2) + 's' : '—' }) },
      paceDelta: { grp: 'perf', en: 'Δ pace', pt: 'Δ ritmo', cell: d => { if (!d.last || !d.best) return { h: '—' }; const dl = d.last - d.best; return dl <= 0.0015 ? { h: 'PB', c: 'f1-up' } : { h: '+' + dl.toFixed(3), c: '' }; } },
      status:  { grp: 'estado', en: 'Status', pt: 'Estado', cell: d => d.dnf ? { h: 'DNF', c: 'f1-dn' } : d.lapsDown ? { h: esc(d.lapsDown), c: '' } : { h: '●', c: 'f1-up' } },
      penalty: { grp: 'estado', en: 'Penalties', pt: 'Penalizações', cell: d => ({ h: d.penalties.length ? d.penalties.map(p => `<span class="f1-lv-pen">${esc(p.label)}</span>`).join(' ') : '' }) },
    };
    const ALL = Object.keys(C);
    const PRESETS = {
      basico:     { ic: '🏁', en: 'Basic', pt: 'Básico', cols: ['tyre', 'last', 'gapLeader'] },
      estrategia: { ic: '🏎', en: 'Strategy', pt: 'Estratégia', cols: ['tyre', 'tyreAge', 'stops', 'stints'] },
      ritmo:      { ic: '⏱', en: 'Pace', pt: 'Ritmo', cols: ['last', 'best', 'avg', 's1', 's2', 's3', 'interval'] },
      engenheiro: { ic: '🧑‍🔧', en: 'Engineer', pt: 'Engenheiro', cols: ALL.slice() },
    };
    // Engineer view by default (all data); the user can trim it via "Customise data".
    const loadCols = () => { try { const a = JSON.parse(localStorage.getItem('f1:live:cols2')); if (Array.isArray(a)) return a.filter(x => C[x]); } catch {} return PRESETS.engenheiro.cols.slice(); };
    const saveCols = c => { try { localStorage.setItem('f1:live:cols2', JSON.stringify(c)); } catch {} };
    let cols = loadCols();
    let model = null;

    body.innerHTML = `
      <div class="f1-live-timing">
        <div class="f1-track-head f1-lv-head">
          ${raceSelect(past, live, 'f1-lv-sel', info.year)}
          <div class="f1-track-meta" id="f1-lv-meta"></div>
          <div class="f1-weather" id="f1-lv-wx"></div>
          <button class="f1-lv-cfg-btn" id="f1-lv-cfg">⚙️ <span>${_t('Customise data', 'Personalizar dados')}</span></button>
        </div>
        <div class="f1-lv-legend">${_t('🟣 session best · 🟢 personal best · ⚡ fastest lap · tap a driver for detail', '🟣 melhor da sessão · 🟢 melhor pessoal · ⚡ volta mais rápida · toca num piloto para detalhe')}</div>
        <div id="f1-lv-body">${loading()}</div>
        <div class="f1-lv-analysis" id="f1-lv-analysis" hidden></div>
        <div class="f1-lv-cfg-panel" id="f1-lv-cfg-panel" hidden></div>
        <div class="f1-lv-driver" id="f1-lv-driver" hidden></div>
      </div>`;

    const yrSel = body.querySelector('#f1-lv-sel-yr');
    if (yrSel) yrSel.addEventListener('change', () => renderLive(body, +yrSel.value));
    const sel = body.querySelector('#f1-lv-sel');
    if (sel && past.length) sel.value = String(past[past.length - 1].session_key);
    if (sel) sel.addEventListener('change', () => { sel.disabled = false; load(+sel.value, false); });
    const gl = body.querySelector('[data-golive]'); if (gl) gl.addEventListener('click', () => load(live.session_key, true));
    body.querySelector('#f1-lv-cfg').addEventListener('click', toggleCfg);

    load(live ? live.session_key : +sel.value, !!live);

    function load(sk, isLive) {
      clearInterval(_liveTimer); _liveTimer = null;
      const host = body.querySelector('#f1-lv-body');
      async function run() {
        try {
          model = await buildModel(sk);
          const metaEl = body.querySelector('#f1-lv-meta');
          if (metaEl) metaEl.innerHTML = `<b>${esc(model.race.circuit_short_name || '')}</b> · ${esc(model.race.country_name || '')} ${model.race.year || ''} ${isLive ? '<span class="f1-replay-tag live">● ' + _t('LIVE', 'AO VIVO') + '</span>' : ''}`;
          const wxEl = body.querySelector('#f1-lv-wx'), w = model.wx;
          if (w && wxEl) wxEl.innerHTML = `<span>${w.rainfall ? '🌧️' : '☀️'} ${Math.round(w.air_temperature)}°C</span><span>${_t('track', 'pista')} ${Math.round(w.track_temperature)}°</span>`;
          if (!model.drivers.length) { host.innerHTML = err(_t('No timing data for this race.', 'Sem dados de tempos para esta corrida.')); return; }
          paint(); renderAnalysis();
        } catch (e) { host.innerHTML = err(); }
      }
      run();
      if (isLive) _liveTimer = setInterval(run, 5000);
    }

    async function buildModel(sk) {
      const [drv, lapRows, stintRows, pitRows, posRows, intRows, rcRows, wxRows] = await Promise.all([
        F1Data.drivers(sk), F1Data.laps(sk).catch(() => []), F1Data.stints(sk).catch(() => []),
        F1Data.pit(sk).catch(() => []), F1Data.positions(sk).catch(() => []),
        F1Data.intervals(sk).catch(() => []), F1Data.raceControl(sk).catch(() => []), F1Data.weather(sk).catch(() => []),
      ]);
      const meta = {}; (drv || []).forEach(d => meta[d.driver_number] = d);
      const order = F1Data.latestOrder(posRows), posOf = {}; order.forEach(o => posOf[o.driver_number] = o.position);
      const intMap = F1Data.latestIntervals(intRows), pen = parsePenalties(rcRows);
      const posByD = {}; for (const r of (posRows || [])) (posByD[r.driver_number] = posByD[r.driver_number] || []).push(r);
      for (const n in posByD) posByD[n].sort((a, b) => (a.date < b.date ? -1 : 1));
      const stintsByD = {}; for (const s of (stintRows || [])) (stintsByD[s.driver_number] = stintsByD[s.driver_number] || []).push(s);
      for (const n in stintsByD) stintsByD[n].sort((a, b) => a.lap_start - b.lap_start);
      const pitByD = {}; for (const p of (pitRows || [])) (pitByD[p.driver_number] = pitByD[p.driver_number] || []).push(p);
      const lapsByD = {}; for (const l of (lapRows || [])) (lapsByD[l.driver_number] = lapsByD[l.driver_number] || []).push(l);
      for (const n in lapsByD) lapsByD[n].sort((a, b) => a.lap_number - b.lap_number);
      const minOf = (a, k) => { let m = Infinity; for (const x of a) if (x[k] && x[k] < m) m = x[k]; return m === Infinity ? null : m; };
      const stdev = a => { const mu = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / a.length); };

      let leaderLaps = 0;
      const drivers = (drv || []).map(m => {
        const num = m.driver_number, ls = lapsByD[num] || [], done = ls.filter(l => l.lap_duration > 0);
        const lapsCount = ls.length ? Math.max(...ls.map(l => l.lap_number || 0)) : 0;
        leaderLaps = Math.max(leaderLaps, lapsCount);
        const lastLap = [...done].reverse()[0] || null;
        const best = done.length ? Math.min(...done.map(l => l.lap_duration)) : null;
        const recent = done.slice(-5).map(l => l.lap_duration);
        const st = stintsByD[num] || [], cur = st[st.length - 1];
        let topSpeed = 0; for (const l of ls) for (const sp of [l.i1_speed, l.i2_speed, l.st_speed]) if (sp && sp > topSpeed) topSpeed = sp;
        const iv = intMap.get(num) || {};
        return {
          num, code: m.name_acronym || String(num), name: m.full_name || '', team: m.team_name || '', colour: m.team_colour,
          pos: posOf[num] || null, startPos: posByD[num] ? posByD[num][0].position : null,
          gapLeader: iv.gap_to_leader, interval: iv.interval,
          last: lastLap ? lastLap.lap_duration : null,
          s1: lastLap ? lastLap.duration_sector_1 : null, s2: lastLap ? lastLap.duration_sector_2 : null, s3: lastLap ? lastLap.duration_sector_3 : null,
          pb1: minOf(done, 'duration_sector_1'), pb2: minOf(done, 'duration_sector_2'), pb3: minOf(done, 'duration_sector_3'),
          best, bestLapNum: best ? (done.find(l => l.lap_duration === best) || {}).lap_number : null,
          lapsCount, avg: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null,
          consistency: recent.length >= 3 ? stdev(recent) : null, topSpeed: topSpeed || null,
          tyreCompound: cur ? cur.compound : null, tyreAge: cur ? (cur.tyre_age_at_start || 0) + Math.max(0, lapsCount - cur.lap_start + 1) : null,
          stints: st.map(s => ({ compound: s.compound, lap_start: s.lap_start, lap_end: s.lap_end })),
          pitCount: (pitByD[num] || []).length, pitLaps: (pitByD[num] || []).map(p => p.lap_number),
          penalties: pen[num] || [], inOrder: posOf[num] != null,
          posTrace: (posByD[num] || []).map((r, i) => ({ x: i, y: r.position })),
          lapTrace: done.map(l => ({ x: l.lap_number, y: l.lap_duration })),
        };
      });
      drivers.forEach(d => {
        d.dnf = !d.inOrder && leaderLaps > 3;
        d.lapsDown = typeof d.gapLeader === 'string' && /LAP/i.test(d.gapLeader) ? d.gapLeader.toUpperCase() : null;
      });
      drivers.sort((a, b) => (a.pos || 999) - (b.pos || 999) || b.lapsCount - a.lapsCount);
      const mn = arr => { const v = arr.filter(x => x); return v.length ? Math.min(...v) : null; };
      const ctx = { bLap: mn(drivers.map(d => d.best)), b1: mn(drivers.map(d => d.pb1)), b2: mn(drivers.map(d => d.pb2)), b3: mn(drivers.map(d => d.pb3)), topMax: Math.max(0, ...drivers.map(d => d.topSpeed || 0)) || null, leaderLaps, fastestNum: null };
      let bv = Infinity; drivers.forEach(d => { if (d.best && d.best < bv) { bv = d.best; ctx.fastestNum = d.num; } });
      let scN = 0, ylN = 0, rdN = 0;
      for (const r of (rcRows || [])) { const msg = String(r.message || '').toUpperCase(); if (r.category === 'SafetyCar' && /DEPLOYED/.test(msg) && !/VIRTUAL/.test(msg)) scN++; else if (r.flag === 'YELLOW' || r.flag === 'DOUBLE YELLOW') ylN++; else if (r.flag === 'RED') rdN++; }
      return { drivers, ctx, race: (past.find(r => r.session_key === sk)) || live || {}, wx: (wxRows || [])[wxRows.length - 1], flags: { sc: scN, yellow: ylN, red: rdN } };
    }

    function paint() {
      if (!model) return;
      const host = body.querySelector('#f1-lv-body');
      const ids = ALL.filter(id => cols.includes(id));
      const ths = `<th class="f1-lv-stick">${_t('Pos', 'Pos')}</th><th class="f1-lv-stick2">${_t('Driver', 'Piloto')}</th>` + ids.map(id => `<th>${_t(C[id].en, C[id].pt)}</th>`).join('');
      const rows = model.drivers.map(d => {
        const cells = ids.map(id => { const r = C[id].cell(d, model.ctx) || {}; return `<td class="${r.c || ''}">${r.h != null ? r.h : ''}</td>`; }).join('');
        const fast = d.num === model.ctx.fastestNum, gain = (d.startPos && d.pos) ? d.startPos - d.pos : 0;
        const badges = `${fast ? `<span class="f1-lv-fl" title="${_t('Fastest lap', 'Volta mais rápida')}">⚡</span>` : ''}${gain >= 2 ? `<span class="f1-up">▲${gain}</span>` : gain <= -2 ? `<span class="f1-dn">▼${-gain}</span>` : ''}`;
        return `<tr data-num="${d.num}" class="${d.dnf ? 'f1-lv-dnf' : ''}">
          <td class="f1-lv-pos f1-lv-stick" style="border-left-color:${teamCol(d.colour)}">${d.pos || '–'}</td>
          <td class="f1-lv-drv f1-lv-stick2"><span class="f1-lv-num">${d.num}</span><b>${esc(d.code)}</b>${badges ? `<span class="f1-lv-badges">${badges}</span>` : ''}</td>
          ${cells}</tr>`;
      }).join('');
      host.innerHTML = `<div class="f1-lv-wrap"><table class="f1-lv-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
      host.querySelectorAll('tr[data-num]').forEach(tr => tr.addEventListener('click', () => openDriver(+tr.dataset.num)));
    }

    /* analysis blocks below the table: lap-time distribution · best sectors · session stats */
    function renderAnalysis() {
      const el = body.querySelector('#f1-lv-analysis'); if (!el || !model) return;
      const durs = []; for (const d of model.drivers) for (const p of (d.lapTrace || [])) if (p.y) durs.push(p.y);
      const best = model.ctx.bLap || (durs.length ? Math.min(...durs) : 0);
      const labels = ['≤+0.5', '+0.5–1', '+1–2', '+2–3', '>+3'], bk = [0, 0, 0, 0, 0];
      for (const t of durs) { const d = t - best; bk[d < 0.5 ? 0 : d < 1 ? 1 : d < 2 ? 2 : d < 3 ? 3 : 4]++; }
      const maxB = Math.max(1, ...bk);
      const dist = bk.map((b, i) => `<div class="f1-an-bar" title="${b}"><div class="f1-an-bar-track"><div class="f1-an-bar-fill" style="height:${Math.round(b / maxB * 100)}%"></div></div><span class="f1-an-bar-n">${b}</span><span class="f1-an-bar-l">${labels[i]}</span></div>`).join('');
      const who = (key, bv) => { const d = model.drivers.find(x => x[key] === bv); return d ? d.code : '—'; };
      const c = model.ctx, theo = (c.b1 && c.b2 && c.b3) ? c.b1 + c.b2 + c.b3 : null;
      const secRow = (lbl, bv, key, col) => `<div class="f1-an-sec"><span class="f1-an-sec-l">${lbl}</span><b class="${col}">${bv ? bv.toFixed(3) : '—'}</b><span class="f1-an-sec-w">${bv ? who(key, bv) : ''}</span></div>`;
      const fast = model.drivers.find(d => d.num === c.fastestNum);
      const pits = model.drivers.reduce((a, d) => a + (d.pitCount || 0), 0);
      const fl = model.flags || {};
      const stat = (v, l) => `<div class="f1-an-stat"><span class="f1-an-stat-v">${v}</span><span class="f1-an-stat-l">${l}</span></div>`;
      el.innerHTML = `
        <div class="f1-an-card">
          <h4>📊 ${_t('Lap-time distribution', 'Distribuição de tempos')}</h4>
          <div class="f1-an-dist">${dist}</div>
          <div class="f1-an-note">${_t('seconds off the fastest lap', 'segundos acima da volta mais rápida')} (${durs.length} ${_t('laps', 'voltas')})</div>
        </div>
        <div class="f1-an-card">
          <h4>🟪 ${_t('Best sectors', 'Análise de setores')}</h4>
          ${secRow('S1', c.b1, 'pb1', 'f1-an-s1')}${secRow('S2', c.b2, 'pb2', 'f1-an-s2')}${secRow('S3', c.b3, 'pb3', 'f1-an-s3')}
          <div class="f1-an-sec f1-an-theo"><span class="f1-an-sec-l">${_t('Theoretical best', 'Volta teórica')}</span><b class="f1-purple">${theo ? fmtLapTime(theo) : '—'}</b><span class="f1-an-sec-w">${c.bLap ? fmtLapTime(c.bLap) + ' ' + _t('real', 'real') : ''}</span></div>
        </div>
        <div class="f1-an-card">
          <h4>📋 ${_t('Session stats', 'Estatísticas da sessão')}</h4>
          <div class="f1-an-stats">
            ${stat(fast ? fmtLapTime(c.bLap) : '—', _t('Fastest lap', 'Volta mais rápida') + (fast ? ' · ' + fast.code : ''))}
            ${stat(c.leaderLaps || '—', _t('Laps', 'Voltas'))}
            ${stat(pits, _t('Pit stops', 'Paragens'))}
            ${stat(c.topMax ? c.topMax + ' km/h' : '—', _t('Top speed', 'Vel. máxima'))}
            ${stat('🚨 ' + (fl.sc || 0), 'Safety Car')}
            ${stat('🟡 ' + (fl.yellow || 0) + (fl.red ? ' · 🔴 ' + fl.red : ''), _t('Flags', 'Bandeiras'))}
          </div>
        </div>`;
      el.hidden = false;
    }

    const _esc = e => { if (e.key === 'Escape') closeCfg(); };
    function closeCfg() {
      const p = body.querySelector('#f1-lv-cfg-panel'); if (!p || p.hidden) return;
      p.classList.remove('open'); setTimeout(() => { p.hidden = true; }, 180);
      const bd = document.getElementById('f1-lv-backdrop'); if (bd) { bd.classList.remove('open'); setTimeout(() => bd.remove(), 220); }
      document.removeEventListener('keydown', _esc);
    }
    function toggleCfg() {
      const p = body.querySelector('#f1-lv-cfg-panel');
      if (!p.hidden) { closeCfg(); return; }
      const groups = ['tempos', 'pneus', 'perf', 'estado', 'id'];
      p.innerHTML = `<button class="f1-lv-dclose" id="f1-lv-cfg-x" aria-label="${_t('Close', 'Fechar')}">✕</button>
        <div class="f1-lv-cfg-hd"><b>${_t('Customise columns', 'Personalizar colunas')}</b></div>
        <p class="f1-lv-cfg-note">${_t('Pos, number and driver are always shown.', 'Posição, número e piloto são sempre mostrados.')}</p>
        ${groups.map(g => `<div class="f1-lv-cfg-grp"><h4>${_t(GRP[g][0], GRP[g][1])}</h4><div class="f1-lv-cfg-cols">${ALL.filter(id => C[id].grp === g).map(id => `<label class="f1-lv-cfg-chk"><input type="checkbox" data-col="${id}"${cols.includes(id) ? ' checked' : ''}> ${_t(C[id].en, C[id].pt)}</label>`).join('')}</div></div>`).join('')}`;
      p.hidden = false; requestAnimationFrame(() => p.classList.add('open'));
      let bd = document.getElementById('f1-lv-backdrop');
      if (!bd) { bd = document.createElement('div'); bd.id = 'f1-lv-backdrop'; bd.className = 'f1-lv-backdrop'; document.body.appendChild(bd); }
      bd.onclick = closeCfg; requestAnimationFrame(() => bd.classList.add('open'));
      document.addEventListener('keydown', _esc);
      p.querySelector('#f1-lv-cfg-x').onclick = closeCfg;
      p.querySelectorAll('input[data-col]').forEach(cb => cb.onchange = () => {
        const id = cb.dataset.col;
        if (cb.checked) { if (!cols.includes(id)) cols.push(id); } else cols = cols.filter(x => x !== id);
        saveCols(cols);
        paint();
      });
    }

    function openDriver(num) {
      const d = model.drivers.find(x => x.num === num); if (!d) return;
      const p = body.querySelector('#f1-lv-driver'), x = model.ctx;
      p.innerHTML = `
        <button class="f1-lv-dclose" id="f1-lv-dx" aria-label="${_t('Close', 'Fechar')}">✕</button>
        <div class="f1-lv-dhead"><span class="f1-lv-num big" style="border-color:${teamCol(d.colour)}">${d.num}</span>
          <div><div class="f1-lv-dname">${esc(d.code)} — ${esc(d.name)}</div><div class="f1-lv-dteam"><span class="f1-team-dot" style="background:${teamCol(d.colour)}"></span>${esc(d.team)} · P${d.pos || '–'}${d.dnf ? ' · DNF' : ''}</div></div></div>
        <div class="f1-lv-dstat">
          <div><b class="f1-purple">${fmtLapTime(d.best)}</b><span>${_t('Best lap', 'Melhor volta')}</span></div>
          <div><b>${d.topSpeed || '—'}</b><span>${_t('Top km/h', 'Vel máx')}</span></div>
          <div><b>${d.pitCount}</b><span>${_t('Stops', 'Paragens')}</span></div>
          <div><b>${d.tyreCompound ? tyre(d.tyreCompound).l + ' · ' + d.tyreAge + 'L' : '—'}</b><span>${_t('Tyre', 'Pneu')}</span></div>
        </div>
        <div class="f1-lv-dsec"><h4>${_t('Lap times', 'Tempos por volta')}</h4>${spark(d.lapTrace, 320, 70, { color: '#ff2d24', invert: true, fill: true }) || '<div class="f1-lv-none">—</div>'}</div>
        <div class="f1-lv-dsec"><h4>${_t('Position over the race', 'Posição ao longo da corrida')}</h4>${spark(d.posTrace, 320, 56, { color: '#7fd3ff', invert: true }) || '<div class="f1-lv-none">—</div>'}</div>
        <div class="f1-lv-dsec"><h4>${_t('Tyre strategy', 'Estratégia de pneus')}</h4><div class="f1-lv-stints">${stintBar(d)}</div></div>
        <div class="f1-lv-dsec"><h4>${_t('Best sectors', 'Melhores setores')}</h4><div class="f1-lv-dsectors">
          <span class="${d.pb1 && d.pb1 === x.b1 ? 'f1-purple' : ''}">S1 ${fmtLapTime(d.pb1)}</span>
          <span class="${d.pb2 && d.pb2 === x.b2 ? 'f1-purple' : ''}">S2 ${fmtLapTime(d.pb2)}</span>
          <span class="${d.pb3 && d.pb3 === x.b3 ? 'f1-purple' : ''}">S3 ${fmtLapTime(d.pb3)}</span></div></div>
        ${d.penalties.length ? `<div class="f1-lv-dsec"><h4>${_t('Penalties', 'Penalizações')}</h4>${d.penalties.map(pn => `<div class="f1-lv-dpen"><b>${esc(pn.label)}</b> ${esc(pn.reason || '')}</div>`).join('')}</div>` : ''}`;
      p.hidden = false; requestAnimationFrame(() => p.classList.add('open'));
      p.querySelector('#f1-lv-dx').onclick = () => { p.classList.remove('open'); setTimeout(() => p.hidden = true, 200); };
    }
  }

  /* ════════════════════════════ TIMING (Tempos) ════════════════════════════
     Full per-race stats with NO track: best lap, sectors, top speed, pit stops,
     tyres and live order for every driver. Works for finished races and live. */
  async function renderTiming(body, year) {
    body.innerHTML = loading(_t('Loading races…', 'A carregar corridas…'));
    let info; try { info = await pastRacesAndLive(year); } catch { body.innerHTML = err(); return; }
    const { past, live } = info;
    if (!past.length && !live) { body.innerHTML = err(_t('No race data yet.', 'Ainda sem dados de corrida.')); return; }
    body.innerHTML = `
      <div class="f1-timing">
        <div class="f1-track-head">${raceSelect(past, live, 'f1-tm-sel', info.year)}<div class="f1-track-meta" id="f1-tm-meta"></div><div class="f1-weather" id="f1-tm-wx"></div></div>
        <div class="f1-tm-legend">${_t('Purple = session best · S1/S2/S3 = sectors · tap a header to sort', 'Roxo = melhor da sessão · S1/S2/S3 = setores · toca num cabeçalho para ordenar')}</div>
        <div id="f1-tm-body">${loading()}</div>
      </div>`;
    const tmYr = body.querySelector('#f1-tm-sel-yr');
    if (tmYr) tmYr.addEventListener('change', () => renderTiming(body, +tmYr.value));
    const sel = body.querySelector('#f1-tm-sel');
    if (sel && past.length) sel.value = String(past[past.length - 1].session_key);
    if (sel) sel.addEventListener('change', () => loadTiming(+sel.value, false));
    const gl = body.querySelector('[data-golive]'); if (gl) gl.addEventListener('click', () => { if (sel) sel.disabled = true; loadTiming(live.session_key, true); });
    loadTiming(live ? live.session_key : +sel.value, !!live);

    async function loadTiming(sk, isLive) {
      clearInterval(_liveTimer); _liveTimer = null;
      const host = body.querySelector('#f1-tm-body');
      const metaEl = body.querySelector('#f1-tm-meta');
      let sortKey = 'best';
      async function run() {
        try {
          const [drv, lapRows, stintRows, pitRows, posRows, wxRows] = await Promise.all([
            F1Data.drivers(sk), F1Data.laps(sk).catch(() => []), F1Data.stints(sk).catch(() => []),
            F1Data.pit(sk).catch(() => []), F1Data.positions(sk).catch(() => []), F1Data.weather(sk).catch(() => []),
          ]);
          const meta = {}; (drv || []).forEach(d => meta[d.driver_number] = d);
          const order = F1Data.latestOrder(posRows);
          const posOf = {}; order.forEach(o => posOf[o.driver_number] = o.position);
          const race = (info.past.find(r => r.session_key === sk)) || live || {};
          metaEl.innerHTML = `<b>${esc(race.circuit_short_name || '')}</b> · ${esc(race.country_name || '')} ${race.year || ''} ${isLive ? '<span class="f1-replay-tag live">● ' + _t('LIVE', 'AO VIVO') + '</span>' : ''}`;
          const w = (wxRows || [])[wxRows.length - 1]; const wxEl = body.querySelector('#f1-tm-wx');
          if (w && wxEl) wxEl.innerHTML = `<span>${w.rainfall ? '🌧️' : '☀️'} ${Math.round(w.air_temperature)}°C</span><span>${_t('track', 'pista')} ${Math.round(w.track_temperature)}°</span>`;

          // aggregate per driver
          const D = {};
          for (const l of (lapRows || [])) {
            const d = D[l.driver_number] || (D[l.driver_number] = { n: l.driver_number, laps: 0, best: Infinity, bestLapNum: 0, s1: Infinity, s2: Infinity, s3: Infinity, top: 0 });
            if (l.lap_duration) { d.laps++; if (l.lap_duration < d.best) { d.best = l.lap_duration; d.bestLapNum = l.lap_number; } }
            if (l.duration_sector_1 && l.duration_sector_1 < d.s1) d.s1 = l.duration_sector_1;
            if (l.duration_sector_2 && l.duration_sector_2 < d.s2) d.s2 = l.duration_sector_2;
            if (l.duration_sector_3 && l.duration_sector_3 < d.s3) d.s3 = l.duration_sector_3;
            for (const sp of [l.i1_speed, l.i2_speed, l.st_speed]) if (sp && sp > d.top) d.top = sp;
          }
          const stintsByD = {}; for (const s of (stintRows || [])) (stintsByD[s.driver_number] = stintsByD[s.driver_number] || []).push(s);
          const pitByD = {}; for (const p of (pitRows || [])) (pitByD[p.driver_number] = pitByD[p.driver_number] || []).push(p);
          const rows = Object.values(D);
          if (!rows.length) { host.innerHTML = err(_t('No timing data for this race.', 'Sem dados de tempos para esta corrida.')); return; }
          const ov = { best: Math.min(...rows.map(r => r.best)), s1: Math.min(...rows.map(r => r.s1)), s2: Math.min(...rows.map(r => r.s2)), s3: Math.min(...rows.map(r => r.s3)), top: Math.max(...rows.map(r => r.top)) };

          function tbody() {
            const sorted = rows.slice().sort((a, b) => {
              if (sortKey === 'pos') return (posOf[a.n] || 99) - (posOf[b.n] || 99);
              if (sortKey === 'top') return b.top - a.top;
              if (sortKey === 'stops') return (pitByD[b.n] || []).length - (pitByD[a.n] || []).length;
              return a.best - b.best;
            });
            const pp = (v, best) => `<td class="${v === best ? 'f1-purple' : ''}">${fmtLapTime(v === Infinity ? null : v)}</td>`;
            return sorted.map(r => {
              const m = meta[r.n] || {}; const pit = pitByD[r.n] || []; const st = stintsByD[r.n] || [];
              const tyres = st.map(s => `<span class="f1-tyre t-${(s.compound || '').toLowerCase()}" title="${esc(s.compound)} · ${_t('laps', 'voltas')} ${s.lap_start}-${s.lap_end}">${tyre(s.compound).l}</span>`).join('');
              const gap = r.best === ov.best ? '' : '+' + (r.best - ov.best).toFixed(3);
              return `<tr>
                <td class="f1-tm-pos">${posOf[r.n] || '–'}</td>
                <td class="f1-tm-num" style="border-color:${teamCol(m.team_colour)}">${r.n}</td>
                <td class="f1-tm-drv"><b>${esc(m.name_acronym || r.n)}</b></td>
                <td class="f1-tm-team">${esc(m.team_name || '')}</td>
                <td class="f1-tm-best ${r.best === ov.best ? 'f1-purple' : ''}">${fmtLapTime(r.best === Infinity ? null : r.best)}</td>
                <td class="f1-tm-gap">${gap}</td>
                ${pp(r.s1, ov.s1)}${pp(r.s2, ov.s2)}${pp(r.s3, ov.s3)}
                <td class="${r.top === ov.top ? 'f1-purple' : ''}">${r.top || '—'}</td>
                <td>${pit.length}</td>
                <td class="f1-tm-tyres">${tyres || '—'}</td>
              </tr>`;
            }).join('');
          }
          const head = [['pos', '#'], ['', '#'], ['', _t('Drv', 'Pil')], ['', _t('Team', 'Equipa')], ['best', _t('Best lap', 'Melhor volta')], ['', _t('Gap', 'Dif')], ['', 'S1'], ['', 'S2'], ['', 'S3'], ['top', _t('Top km/h', 'Vel máx')], ['stops', _t('Stops', 'Par')], ['', _t('Tyres', 'Pneus')]];
          host.innerHTML = `<div class="f1-tm-wrap"><table class="f1-tm-table"><thead><tr>${head.map(([k, l]) => `<th${k ? ` class="f1-sortable${k === sortKey ? ' on' : ''}" data-sort="${k}"` : ''}>${l}</th>`).join('')}</tr></thead><tbody id="f1-tm-tb">${tbody()}</tbody></table></div>`;
          host.querySelectorAll('.f1-sortable').forEach(th => th.addEventListener('click', () => { sortKey = th.dataset.sort; host.querySelectorAll('.f1-sortable').forEach(x => x.classList.toggle('on', x === th)); host.querySelector('#f1-tm-tb').innerHTML = tbody(); }));
        } catch (e) { host.innerHTML = err(); }
      }
      await run();
      if (isLive) _liveTimer = setInterval(run, 12000);
    }
  }

  /* ════════════════════════════ DRIVER (Piloto) ════════════════════════════
     One driver in focus: position + the cars just ahead/behind, tyre strategy,
     pit stops, best lap + sectors, top speed, lap-time chart, position trace,
     and the speed telemetry of their fastest lap. Live or finished race. */
  async function renderDriver(body, year) {
    body.innerHTML = loading(_t('Loading races…', 'A carregar corridas…'));
    let info; try { info = await pastRacesAndLive(year); } catch { body.innerHTML = err(); return; }
    const { past, live } = info;
    if (!past.length && !live) { body.innerHTML = err(_t('No race data yet.', 'Ainda sem dados de corrida.')); return; }
    body.innerHTML = `
      <div class="f1-driverpg">
        <div class="f1-track-head">
          ${raceSelect(past, live, 'f1-dr-race', info.year)}
          <select class="f1-select" id="f1-dr-driver" aria-label="${_t('Driver', 'Piloto')}"></select>
          <div class="f1-track-meta" id="f1-dr-meta"></div>
        </div>
        <div id="f1-dr-body">${loading()}</div>
      </div>`;
    const drYr = body.querySelector('#f1-dr-race-yr');
    if (drYr) drYr.addEventListener('change', () => renderDriver(body, +drYr.value));
    const raceSel = body.querySelector('#f1-dr-race');
    const drvSel = body.querySelector('#f1-dr-driver');
    // honour a driver clicked from the Pista tab (same race + driver pre-selected)
    const pend = _pendingDriver; _pendingDriver = null;
    const initSk = pend ? pend.sk : (live ? live.session_key : (past.length ? past[past.length - 1].session_key : null));
    if (raceSel && initSk && [...raceSel.options].some(o => +o.value === initSk)) raceSel.value = String(initSk);
    const gl = body.querySelector('[data-golive]'); if (gl) gl.addEventListener('click', () => { if (raceSel) raceSel.disabled = true; loadRaceDrivers(live.session_key, true); });
    let _curSk = null, _curDrivers = {}, _curOrder = [], _curLive = false;
    raceSel && raceSel.addEventListener('change', () => loadRaceDrivers(+raceSel.value, false));
    drvSel.addEventListener('change', () => paintDriver(+drvSel.value));
    loadRaceDrivers(initSk, !!live && !pend, pend ? pend.num : null);

    async function loadRaceDrivers(sk, isLive, preNum) {
      clearInterval(_liveTimer); _liveTimer = null;
      if (_track) { _track.dispose(); _track = null; }
      _curSk = sk; _curLive = isLive;
      const host = body.querySelector('#f1-dr-body'); host.innerHTML = loading();
      const metaEl = body.querySelector('#f1-dr-meta');
      const race = (info.past.find(r => r.session_key === sk)) || live || {};
      if (metaEl) { metaEl.dataset.race = `<b>${esc(race.circuit_short_name || '')}</b> · ${esc(race.country_name || '')} ${race.year || ''} ${isLive ? '<span class="f1-replay-tag live">● ' + _t('LIVE', 'AO VIVO') + '</span>' : ''} `; metaEl.innerHTML = metaEl.dataset.race; }
      const [drv, posRows] = await Promise.all([F1Data.drivers(sk).catch(() => []), F1Data.positions(sk).catch(() => [])]);
      _curDrivers = {}; (drv || []).forEach(d => _curDrivers[d.driver_number] = d);
      _curOrder = F1Data.latestOrder(posRows);
      const sorted = _curOrder.length ? _curOrder.map(o => _curDrivers[o.driver_number]).filter(Boolean) : Object.values(_curDrivers);
      drvSel.innerHTML = sorted.map(d => `<option value="${d.driver_number}">${esc(d.name_acronym)} · ${esc(d.full_name)}</option>`).join('');
      const pick = (preNum != null && sorted.some(d => d.driver_number === preNum)) ? preNum : (sorted[0] && sorted[0].driver_number);
      if (pick != null) { drvSel.value = String(pick); paintDriver(pick); }
      else host.innerHTML = err();
    }

    async function paintDriver(num) {
      clearInterval(_liveTimer); _liveTimer = null;
      if (_track) { _track.dispose(); _track = null; }
      const sk = _curSk, host = body.querySelector('#f1-dr-body');
      host.innerHTML = loading(_t('Loading driver…', 'A carregar piloto…'));
      try {
        const [lapRows, stintRows, pitRows, posRows, rcRows] = await Promise.all([
          F1Data.laps(sk).catch(() => []), F1Data.stints(sk).catch(() => []), F1Data.pit(sk).catch(() => []),
          F1Data.positions(sk).catch(() => []), F1Data.raceControl(sk).catch(() => []),
        ]);
        const meta = _curDrivers; const m = meta[num] || {};
        const order = F1Data.latestOrder(posRows); _curOrder = order;
        const idx = order.findIndex(o => o.driver_number === num);
        const myPos = idx >= 0 ? order[idx].position : null;
        const ahead = idx > 0 ? order[idx - 1] : null, behind = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
        const myLaps = (lapRows || []).filter(l => l.driver_number === num && l.lap_duration).sort((a, b) => a.lap_number - b.lap_number);
        const allBest = Math.min(...((lapRows || []).filter(l => l.lap_duration).map(l => l.lap_duration)) || [Infinity]);
        const best = myLaps.reduce((a, b) => (!a || b.lap_duration < a.lap_duration) ? b : a, null);
        const top = Math.max(0, ...myLaps.flatMap(l => [l.i1_speed, l.i2_speed, l.st_speed].filter(Boolean)));
        const myStints = (stintRows || []).filter(s => s.driver_number === num).sort((a, b) => a.stint_number - b.stint_number);
        const myPits = (pitRows || []).filter(p => p.driver_number === num).sort((a, b) => a.lap_number - b.lap_number);
        const pens = parsePenalties(rcRows)[num] || [];
        const posByLap = {}; for (const l of (lapRows || [])) if (l.driver_number === num) posByLap[l.lap_number] = l;
        // position trace from /position over time → approximate per-lap by sampling
        const myPosRows = (posRows || []).filter(p => p.driver_number === num).sort((a, b) => a.date < b.date ? -1 : 1);

        const totalLaps = Math.max(0, ...(lapRows || []).map(l => l.lap_number || 0));
        const compoundAt = lap => { const s = myStints.find(s => lap >= s.lap_start && lap <= s.lap_end); return s ? s.compound : ''; };
        const neighbour = (o, label) => o ? `<div class="f1-nb"><span class="f1-nb-lbl">${label}</span><span class="f1-nb-pos">P${o.position}</span><span class="f1-nb-num" style="border-color:${teamCol((meta[o.driver_number] || {}).team_colour)}">${o.driver_number}</span><span class="f1-nb-code">${esc((meta[o.driver_number] || {}).name_acronym || o.driver_number)}</span></div>` : `<div class="f1-nb f1-nb-empty">—</div>`;

        // lap-time bar chart
        const maxLap = Math.max(...myLaps.map(l => l.lap_duration), 1), minLap = Math.min(...myLaps.map(l => l.lap_duration), maxLap);
        const lapBars = myLaps.map(l => {
          const t = (l.lap_duration - minLap) / ((maxLap - minLap) || 1); // 0 fast .. 1 slow
          const hgt = 12 + (1 - t) * 70;
          const comp = compoundAt(l.lap_number); const col = COMP_HEX[(comp || '').toUpperCase()] || '#888';
          const isBest = best && l.lap_number === best.lap_number, isPit = myPits.some(p => p.lap_number === l.lap_number || p.lap_number === l.lap_number - 1);
          return `<span class="f1-lapbar${isBest ? ' best' : ''}${isPit ? ' pit' : ''}" style="height:${hgt.toFixed(0)}%;--c:${col}" title="${_t('Lap', 'Volta')} ${l.lap_number}: ${fmtLapTime(l.lap_duration)}${comp ? ' · ' + comp : ''}${isPit ? ' · PIT' : ''}"></span>`;
        }).join('');

        // tyre strategy bar
        const stintBar = myStints.map(s => {
          const span = (s.lap_end - s.lap_start + 1) / (totalLaps || 1) * 100;
          const col = COMP_HEX[(s.compound || '').toUpperCase()] || '#888';
          return `<span class="f1-stint" style="width:${span.toFixed(1)}%;--c:${col}" title="${esc(s.compound)} · ${_t('laps', 'voltas')} ${s.lap_start}-${s.lap_end} · ${_t('age', 'idade')} ${s.tyre_age_at_start}"><b>${tyre(s.compound).l}</b><small>${s.lap_end - s.lap_start + 1}</small></span>`;
        }).join('');

        // position trace
        const posPts = myLaps.map(l => ({ x: l.lap_number, y: (myPosRows.filter(p => Date.parse(p.date) <= Date.parse(l.date_start)).pop() || {}).position || myPos || 10 }));

        // ── race-story data: grid→finish, fastest, SC windows, key moments ──
        const startPos = myPosRows.length ? +myPosRows[0].position : null;
        const finishPos = myPos;
        const gained = (startPos && finishPos) ? startPos - finishPos : 0;
        const isFastestOverall = !!(best && best.lap_duration === allBest);
        const pitLaps = myPits.map(p => p.lap_number);
        const scRanges = []; { let open = null; for (const r of (rcRows || [])) { if (r.category !== 'SafetyCar') continue; const msg = String(r.message || '').toUpperCase(); const lap = r.lap_number || 0; if (/DEPLOYED/.test(msg) && !open) open = { s: lap }; else if (/ENDING|IN THIS LAP/.test(msg) && open) { open.e = lap || open.s; scRanges.push(open); open = null; } } if (open) { open.e = totalLaps; scRanges.push(open); } }
        // key moments (discrete, clickable)
        const moments = [];
        myPits.forEach(p => moments.push({ lap: p.lap_number, type: 'pit', icon: '🅿️', label: `${_t('Pit stop', 'Paragem')} · ${(p.stop_duration || p.pit_duration || 0).toFixed(1)}s` }));
        if (best) moments.push({ lap: best.lap_number, type: 'fast', icon: '⚡', label: `${_t('Best lap', 'Melhor volta')} ${fmtLapTime(best.lap_duration)}${isFastestOverall ? ' (' + _t('race fastest', 'mais rápida da corrida') + ')' : ''}` });
        scRanges.forEach(r => moments.push({ lap: r.s || 1, type: 'sc', icon: '🚨', label: `Safety Car · V${r.s}–${r.e}` }));
        pens.forEach(p => moments.push({ lap: p.lap || 1, type: 'pen', icon: '⚠️', label: esc(p.label) + (p.reason ? ' · ' + esc(p.reason) : '') }));
        for (const r of (rcRows || [])) { const t = classifyIncident(r); if (!t) continue; const cn = +r.driver_number || +((String(r.message || '').match(/CAR (\d+)/) || [])[1]); if (cn !== num) continue; moments.push({ lap: r.lap_number || 1, type: 'incident', icon: INCIDENTS[t].icon, label: _t(INCIDENTS[t].en, INCIDENTS[t].pt) }); }
        moments.sort((a, b) => a.lap - b.lap);
        // annotated position chart (SC bands · pit ticks · fastest star)
        const maxPos = Math.max(10, ...posPts.map(p => p.y));
        function annotatedPosChart() {
          if (posPts.length < 2) return '';
          const W = 580, H = 190, padL = 18, padR = 8, padT = 10, padB = 8;
          const sx = lap => padL + (totalLaps > 1 ? (lap - 1) / (totalLaps - 1) : 0) * (W - padL - padR);
          const sy = pos => padT + (maxPos > 1 ? (pos - 1) / (maxPos - 1) : 0) * (H - padT - padB);
          const bands = scRanges.map(r => `<rect x="${sx(r.s).toFixed(1)}" y="0" width="${Math.max(2, sx(r.e) - sx(r.s)).toFixed(1)}" height="${H}" fill="rgba(255,140,40,.16)"/>`).join('');
          const grid = [1, 5, 10, 15, 20].filter(p => p <= maxPos).map(p => `<line x1="${padL}" y1="${sy(p).toFixed(1)}" x2="${W - padR}" y2="${sy(p).toFixed(1)}" stroke="rgba(255,255,255,.06)"/><text x="2" y="${(sy(p) + 3).toFixed(1)}" class="f1-pe-ax">${p}</text>`).join('');
          const pits = pitLaps.map(lp => `<line x1="${sx(lp).toFixed(1)}" y1="${padT}" x2="${sx(lp).toFixed(1)}" y2="${H - padB}" stroke="rgba(127,211,255,.55)" stroke-width="1" stroke-dasharray="2 3"/>`).join('');
          const line = posPts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
          const fp = posPts.find(p => p.x === (best && best.lap_number));
          const star = fp ? `<circle cx="${sx(fp.x).toFixed(1)}" cy="${sy(fp.y).toFixed(1)}" r="3.6" fill="#c026d3" stroke="#fff" stroke-width="1.2"/>` : '';
          return `<svg class="f1-pe-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bands}${grid}${pits}<path d="${line}" fill="none" stroke="${teamCol(m.team_colour)}" stroke-width="2" stroke-linejoin="round"/>${star}</svg>`;
        }
        const posChart = annotatedPosChart();
        const momentsBar = moments.length ? moments.map(mo => `<button class="f1-mom m-${mo.type}" data-lap="${mo.lap}" style="left:${(totalLaps > 1 ? (mo.lap - 1) / (totalLaps - 1) : 0) * 100}%" title="V${mo.lap} · ${mo.label.replace(/"/g, '')}">${mo.icon}</button>`).join('') : '';

        const nbChip = (o, label, self) => o ? `<span class="f1-nbc${self ? ' self' : ''}" style="--c:${teamCol((meta[o.driver_number] || {}).team_colour)}"><small>${label}</small> P${o.position} <b>${esc((meta[o.driver_number] || {}).name_acronym || o.driver_number)}</b></span>` : `<span class="f1-nbc empty">${label}: —</span>`;
        const controls = `
          <div class="f1-controls f1-dr-controls" id="f1-dr-controls">
            <button class="f1-btn" id="f1-dr-play">▶ ${_t('Play', 'Reproduzir')}</button>
            <div class="f1-seek-wrap"><input type="range" id="f1-dr-seek" min="0" max="1000" value="0" class="f1-seek"></div>
            <div class="f1-lap"><button class="f1-lap-btn" id="f1-dr-lapprev">◀</button><span class="f1-lap-lbl">${_lang() === 'en' ? 'L' : 'V'}</span><input class="f1-lap-in" id="f1-dr-lapin" type="number" min="1" value="1" inputmode="numeric"><span class="f1-lap-tot" id="f1-dr-laptot"></span><button class="f1-lap-btn" id="f1-dr-lapnext">▶</button></div>
            <div class="f1-speed" id="f1-dr-speed">${SPEEDS.map(s => `<button data-s="${s}" class="${s === DEF_SPEED ? 'on' : ''}">${s}×</button>`).join('')}</div>
            <button class="f1-btn f1-toggle" id="f1-dr-label" title="${_t('Toggle name / number', 'Alternar nome / número')}">ABC</button>
            <button class="f1-btn f1-icon-btn" id="f1-dr-fs" title="${_t('Fullscreen', 'Ecrã inteiro')}">⛶</button>
          </div>`;

        const statusTxt = finishPos ? ('P' + finishPos) : _t('DNF', 'ABD');
        host.innerHTML = `
          <div class="f1-dr-grid2">
            <div class="f1-dr-card f1-dr-hero" style="--c:${teamCol(m.team_colour)}">
              <div class="f1-dr-hero-id">
                <span class="f1-dr-bignum">${num}</span>
                <div class="f1-dr-id"><div class="f1-dr-name">${esc(m.full_name || m.name_acronym || num)}</div>
                  <div class="f1-dr-team">${esc(m.team_name || '')}${m.country_code ? ' · ' + esc(m.country_code) : ''}</div></div>
              </div>
              <div class="f1-dr-story">
                <div class="f1-dr-sg f1-dr-sg-main"><span class="f1-dr-sg-v">${startPos ? 'P' + startPos : '—'}<span class="f1-dr-arrow">→</span><b>${statusTxt}</b></span><span class="f1-dr-sg-l">${_t('Grid → Finish', 'Grelha → Final')} ${gained ? `<b class="f1-delta ${gained > 0 ? 'up' : 'down'}">${gained > 0 ? '▲' : '▼'} ${Math.abs(gained)}</b>` : ''}</span></div>
                <div class="f1-dr-sg"><span class="f1-dr-sg-v ${isFastestOverall ? 'f1-purple' : ''}">${best ? fmtLapTime(best.lap_duration) : '—'}</span><span class="f1-dr-sg-l">${_t('Best lap', 'Melhor volta')}${best ? ' · V' + best.lap_number : ''}${isFastestOverall ? ' ⚡' : ''}</span></div>
                <div class="f1-dr-sg"><span class="f1-dr-sg-v">${myPits.length}</span><span class="f1-dr-sg-l">${_t('Pit stops', 'Paragens')}</span></div>
                <div class="f1-dr-sg"><span class="f1-dr-sg-v">${top || '—'}<small> km/h</small></span><span class="f1-dr-sg-l">${_t('Top speed', 'Vel. máxima')}</span></div>
                <div class="f1-dr-sg"><span class="f1-dr-sg-v">${myLaps.length}</span><span class="f1-dr-sg-l">${_t('Laps', 'Voltas')}</span></div>
              </div>
            </div>
            <div class="f1-dr-analysis">
              <div class="f1-dr-card">
                <h4>⏱️ ${_t('Key moments', 'Momentos decisivos')} <small class="f1-dr-hint">${_t('click to jump', 'clica para saltar')}</small></h4>
                <div class="f1-mom-wrap"><div class="f1-mom-track" id="f1-dr-moments">${momentsBar || `<span class="f1-empty-sm">${_t('No notable moments', 'Sem momentos relevantes')}</span>`}</div></div>
                <div class="f1-mom-x"><span>V1</span><span>V${totalLaps}</span></div>
              </div>
              <div class="f1-dr-card">
                <h4>📈 ${_t('Position through the race', 'Posição ao longo da corrida')}</h4>
                <div class="f1-dr-pe">${posChart}<div class="f1-pe-cursor" id="f1-dr-pe-cursor"></div></div>
                <div class="f1-dr-legend"><span><i class="lg lg-line" style="background:${teamCol(m.team_colour)}"></i>${_t('position', 'posição')}</span><span><i class="lg lg-sc"></i>Safety Car</span><span><i class="lg lg-pit"></i>${_t('pit', 'boxes')}</span><span><i class="lg lg-fast"></i>${_t('best lap', 'melhor volta')}</span></div>
              </div>
              <div class="f1-dr-card">
                <h4>📊 ${_t('Lap times & tyres', 'Tempos por volta e pneus')}</h4>
                <div class="f1-lapchart" id="f1-dr-lapchart">${lapBars || '—'}</div>
                <div class="f1-lapchart-x"><span>V1</span><span>V${totalLaps}</span></div>
                <div class="f1-stintbar f1-dr-stintbar">${stintBar || ''}</div>
              </div>
            </div>
            <div class="f1-dr-aside">
              <div class="f1-dr-card f1-dr-track" id="f1-dr-track">
                <div class="f1-dr-track-top"><h4>📍 ${_t('Around on track', 'À volta na pista')}${_curLive ? ' <span class="f1-replay-tag live">● ' + _t('LIVE', 'AO VIVO') + '</span>' : ''}<span class="f1-dr-pos-mini" id="f1-dr-posn">${myPos ? 'P' + myPos : '—'}</span></h4>
                  <div class="f1-dr-nbstrip" id="f1-dr-nbstrip">${nbChip(ahead, _t('Ahead', 'Frente'))}${nbChip({ driver_number: num, position: myPos }, _t('Driver', 'Piloto'), true)}${nbChip(behind, _t('Behind', 'Atrás'))}</div></div>
                <div class="f1-track-stage f1-dr-stage"><canvas id="f1-dr-canvas"></canvas><div class="f1-stage-load" id="f1-dr-stageload">${loading()}</div></div>
                ${controls}
              </div>
              <div class="f1-dr-card f1-dr-tele"><h4>⚡ ${_t('Fastest lap telemetry', 'Telemetria da volta mais rápida')}</h4><div id="f1-dr-tele">${loading()}</div></div>
              ${pens.length ? `<div class="f1-dr-card"><h4>⚠️ ${_t('Penalties', 'Penalizações')}</h4><div class="f1-pitlist">${pens.map(p => `<span class="f1-pen f1-pen-${p.type}">${esc(p.label)}</span>`).join(' ')}</div></div>` : ''}
            </div>
          </div>`;

        // fastest-lap speed trace (car_data over that lap window)
        const teleEl = host.querySelector('#f1-dr-tele');
        if (best && best.date_start) {
          const from = best.date_start, to = new Date(Date.parse(best.date_start) + (best.lap_duration + 1) * 1000).toISOString();
          F1Data.carData(sk, { driver: num, from, to }).then(car => {
            const pts = (car || []).filter(c => c.speed != null).map(c => ({ x: Date.parse(c.date), y: c.speed }));
            if (pts.length < 4) { teleEl.innerHTML = `<div class="f1-empty-sm">${_t('Telemetry unavailable', 'Telemetria indisponível')}</div>`; return; }
            const maxS = Math.max(...pts.map(p => p.y));
            teleEl.innerHTML = `${spark(pts, 320, 90, { color: '#22d3ee', fill: true })}
              <div class="f1-tele-row"><span>🏁 ${_t('Max', 'Máx')} <b>${maxS}</b> km/h</span><span>⚙️ ${_t('gears', 'mudanças')} ${Math.max(...(car || []).map(c => c.n_gear || 0))}</span><span>🔧 ${_t('max rpm', 'rpm máx')} ${Math.max(...(car || []).map(c => c.rpm || 0))}</span></div>`;
          }).catch(() => { teleEl.innerHTML = `<div class="f1-empty-sm">${_t('Telemetry unavailable', 'Telemetria indisponível')}</div>`; });
        } else teleEl.innerHTML = `<div class="f1-empty-sm">${_t('No fastest lap yet', 'Ainda sem volta rápida')}</div>`;

        // ── the focused track: live polling, or whole-race replay of driver + neighbours ──
        const metaEl = body.querySelector('#f1-dr-meta');
        const stageLoad = host.querySelector('#f1-dr-stageload');
        if (_curLive) {
          host.querySelector('#f1-dr-controls').style.display = 'none';
          startDriverLive(sk, num, stageLoad);
        } else {
          buildRaceModel(sk).then(model => {
            if (!model || model.error) { stageLoad.innerHTML = err(model && model.error); return; }
            const canvas = host.querySelector('#f1-dr-canvas');
            _track = F1Track.create(canvas);
            _track.setDrivers(model.meta); _track.setTrack(model.outline); _track.setLeader(num); _track.setSpeed(DEF_SPEED);
            stageLoad.style.display = 'none';
            const seek = host.querySelector('#f1-dr-seek'), lapIn = host.querySelector('#f1-dr-lapin'), playBtn = host.querySelector('#f1-dr-play');
            const posnEl = host.querySelector('#f1-dr-posn'), nbEl = host.querySelector('#f1-dr-nbstrip');
            lapIn.max = model.totalLaps; host.querySelector('#f1-dr-laptot').textContent = '/' + model.totalLaps;
            const raceLabel = metaEl ? metaEl.dataset.race || '' : '';
            // order at a given replay time (from /position), so position + neighbours track the playback
            const latestP = (rows, ms) => { let v; for (const e of rows || []) { if (e.t <= ms) v = e.p; else break; } return v; };
            function orderAt(ms) { const a = []; for (const n in model.posByDriver) { const p = latestP(model.posByDriver[n], ms); if (p == null) continue; a.push({ num: +n, p }); } a.sort((x, y) => x.p - y.p); return a; }
            const chip = (n, p, label, self) => n != null ? `<span class="f1-nbc${self ? ' self' : ''}" style="--c:${teamCol((model.meta[n] || {}).colour)}"><small>${label}</small> P${p} <b>${esc((model.meta[n] || {}).code || n)}</b></span>` : `<span class="f1-nbc empty">${label}: —</span>`;
            let lastFocusKey = '', lastNb = '', lastPos = '';
            function paintWx(ms) {
              let w = null; for (const r of model.wx) { if (r.t <= ms) w = r; else break; } if (!w) w = model.wx[0];
              const wchip = w ? `<span class="f1-dr-wx">${w.rain > 0 ? '🌧️' : '☀️'} ${Math.round(w.air)}°C · ${_t('track', 'pista')} ${Math.round(w.trk)}° · 💧 ${Math.round(w.hum)}%</span>` : '';
              if (metaEl) metaEl.innerHTML = `${raceLabel}${wchip}`;
            }
            function onClock(frac) {
              if (!_track) return;
              const ms = frac * (_track.duration || 1);
              seek.value = Math.round(frac * 1000);
              const arr = model.lapsByDriver[num];
              const lap = arr ? ((model.progAbs(arr, model.lights + ms) || {}).lap || 1) : 1;
              if (document.activeElement !== lapIn) lapIn.value = Math.min(model.totalLaps, lap);
              paintWx(ms);
              const drCur = host.querySelector('#f1-dr-pe-cursor');
              if (drCur) drCur.style.left = (model.totalLaps > 1 ? (Math.min(model.totalLaps, lap) - 1) / (model.totalLaps - 1) * 100 : 0) + '%';
              // live position + the cars currently just ahead/behind at this moment
              const ord = orderAt(ms);
              const i = ord.findIndex(o => o.num === num);
              const myP = i >= 0 ? ord[i].p : null;
              const ah = i > 0 ? ord[i - 1] : null, be = (i >= 0 && i < ord.length - 1) ? ord[i + 1] : null;
              const posStr = myP ? 'P' + myP : '—';
              if (posnEl && posStr !== lastPos) { posnEl.textContent = posStr; lastPos = posStr; }
              const nbHtml = chip(ah ? ah.num : null, ah && ah.p, _t('Ahead', 'Frente')) + chip(num, myP, _t('Driver', 'Piloto'), true) + chip(be ? be.num : null, be && be.p, _t('Behind', 'Atrás'));
              if (nbEl && nbHtml !== lastNb) { nbEl.innerHTML = nbHtml; lastNb = nbHtml; }
              // swap the focused cars to the current neighbours (without restarting the clock)
              const key = (ah ? ah.num : '-') + '/' + (be ? be.num : '-');
              if (key !== lastFocusKey) {
                lastFocusKey = key;
                const f = {}; for (const fn of [ah && ah.num, num, be && be.num].filter(v => v != null)) if (model.frames[fn]) f[fn] = model.frames[fn];
                if (Object.keys(f).length) _track.setReplay(f, true);
              }
            }
            _track.setOnTick(onClock);
            playBtn.onclick = () => { const on = _track.toggle(); playBtn.textContent = on ? '⏸ ' + _t('Pause', 'Pausa') : '▶ ' + _t('Play', 'Reproduzir'); };
            seek.oninput = () => _track.seek(seek.value / 1000);
            host.querySelector('#f1-dr-speed').onclick = e => { const b = e.target.closest('button'); if (!b) return; _track.setSpeed(+b.dataset.s); host.querySelectorAll('#f1-dr-speed button').forEach(x => x.classList.toggle('on', x === b)); };
            let showCode = true; const labelBtn = host.querySelector('#f1-dr-label');
            labelBtn.onclick = () => { showCode = !showCode; _track.setLabelMode(showCode ? 'code' : 'num'); labelBtn.textContent = showCode ? 'ABC' : '#'; labelBtn.classList.toggle('on', !showCode); };
            function seekToLap(L) { L = Math.max(1, Math.min(model.totalLaps, Math.round(L) || 1)); let t = model.lapStart[L]; if (t == null) return; const tn = model.lapStart[L + 1]; t += (tn != null ? (tn - t) : 6000) * 0.15; _track.seek(Math.max(0, t) / (_track.duration || 1)); }
            lapIn.onchange = () => seekToLap(+lapIn.value);
            host.querySelector('#f1-dr-lapprev').onclick = () => seekToLap((+lapIn.value || 1) - 1);
            host.querySelector('#f1-dr-lapnext').onclick = () => seekToLap((+lapIn.value || 1) + 1);
            // key-moments timeline → jump the replay (and pause to inspect)
            host.querySelectorAll('.f1-mom').forEach(bm => bm.onclick = () => { _track && _track.pause(); playBtn.textContent = '▶ ' + _t('Play', 'Reproduzir'); seekToLap(+bm.dataset.lap); host.querySelectorAll('.f1-mom').forEach(x => x.classList.remove('on')); bm.classList.add('on'); });
            host.querySelector('#f1-dr-fs').onclick = () => { const g = host.querySelector('#f1-dr-track'); if (!document.fullscreenElement) (g.requestFullscreen || g.webkitRequestFullscreen || (() => {})).call(g); else document.exitFullscreen && document.exitFullscreen(); };
            onClock(0); _track.play(); playBtn.textContent = '⏸ ' + _t('Pause', 'Pausa');
          }).catch(() => { stageLoad.innerHTML = err(); });
        }
      } catch (e) { host.innerHTML = err(); }
    }

    /* live: focused track with the driver + the cars just ahead/behind, refreshed */
    async function startDriverLive(sk, num, stageLoad) {
      const canvas = body.querySelector('#f1-dr-canvas'); if (!canvas) return;
      _track = F1Track.create(canvas);
      const meta = _curDrivers; const buf = {}; let t0 = null;
      _track.setDrivers(Object.fromEntries(Object.entries(meta).map(([k, d]) => [k, { code: d.name_acronym, colour: d.team_colour, num: d.driver_number }])));
      const metaEl = body.querySelector('#f1-dr-meta');
      F1Data.weather(sk).then(wx => { const w = (wx || [])[wx.length - 1]; if (w && metaEl) metaEl.innerHTML = (metaEl.dataset.race || '') + `<span class="f1-dr-wx">${w.rainfall ? '🌧️' : '☀️'} ${Math.round(w.air_temperature)}°C · ${_t('track', 'pista')} ${Math.round(w.track_temperature)}° · 💧 ${Math.round(w.humidity)}%</span>`; }).catch(() => {});
      async function poll() {
        try {
          const posRows = await F1Data.positions(sk).catch(() => []);
          const order = F1Data.latestOrder(posRows);
          const idx = order.findIndex(o => o.driver_number === num);
          const focus = [order[idx - 1], order[idx], order[idx + 1]].filter(Boolean).map(o => o.driver_number);
          const from = new Date(Date.now() - 45000).toISOString();
          const loc = await F1Data.location(sk, { from }).catch(() => []);
          if (loc && loc.length) {
            if (t0 == null) t0 = Date.parse(loc[0].date);
            for (const p of loc) { if (!isFinite(p.x) || (p.x === 0 && p.y === 0)) continue; (buf[p.driver_number] = buf[p.driver_number] || []).push({ t: Date.parse(p.date) - t0, x: p.x, y: p.y }); }
            for (const n in buf) buf[n] = buf[n].slice(-80);
            const lead = Object.keys(buf).sort((a, b) => buf[b].length - buf[a].length)[0];
            if (!_track._hasTrack && buf[lead]) { _track.setTrack(buf[lead].map(p => ({ x: p.x, y: p.y }))); _track._hasTrack = true; }
            const sub = {}; for (const n of focus) if (buf[n]) sub[n] = buf[n];
            _track.setReplay(sub); _track.setLiveClock(_track.duration); _track.setLeader(num);
            if (stageLoad) stageLoad.style.display = 'none';
          }
        } catch {}
      }
      await poll(); _track.start();
      _liveTimer = setInterval(poll, 6000);
    }
  }

  /* ════════════════════════════ CIRCUIT ════════════════════════════ */
  async function renderCircuit(body) {
    try {
      const [races, all, meta] = await Promise.all([F1Data.schedule(), F1Data.allCircuits(), F1Data.circuitsMeta()]);
      // this season's circuits (in calendar order, deduped), then everyone else
      const seasonIds = new Set();
      const season = [];
      (races || []).forEach(r => { const c = r.Circuit; if (c && !seasonIds.has(c.circuitId)) { seasonIds.add(c.circuitId); season.push({ ...c, round: +r.round }); } });
      season.sort((a, b) => a.round - b.round);
      const others = (all || []).filter(c => !seasonIds.has(c.circuitId))
        .sort((a, b) => (a.Location?.country || '').localeCompare(b.Location?.country || '') || a.circuitName.localeCompare(b.circuitName));
      if (!season.length && !others.length) { body.innerHTML = err(); return; }

      const card = (c, badge) => {
        const m = meta[c.circuitId] || {};
        return `<button class="f1-circ-card" data-id="${c.circuitId}">
          ${badge || ''}
          <div class="f1-circ-name">${esc(c.circuitName)}</div>
          <div class="f1-circ-loc">${flag(c.Location?.country)}${esc(c.Location?.locality)}, ${esc(c.Location?.country)}</div>
          <div class="f1-circ-stats">
            <span>${m.length_km ? m.length_km.toFixed(3) + ' km' : '—'}</span>
            <span>${m.turns ? m.turns + ' ' + _t('turns', 'curvas') : '—'}</span>
          </div></button>`;
      };
      const grp = (title, n, html) => `
        <div class="f1-circ-grouphd"><h3>${title}</h3><span class="f1-circ-count">${n}</span></div>
        <div class="f1-circ-grid">${html}</div>`;

      body.innerHTML = `
        <div class="f1-circ-note">${_t('All 78 circuits ever raced. Current-layout lengths cross-checked against OpenF1 telemetry (~2%); historic ones from Wikipedia. Tap a circuit for its map, most wins &amp; history.',
          'Todos os 78 circuitos já usados. Comprimentos dos traçados atuais validados com telemetria OpenF1 (~2%); históricos a partir da Wikipedia. Toca num circuito para mapa, vitórias e histórico.')}</div>
        <div id="f1-circ-detail"></div>
        ${season.length ? grp(_t('This season', 'Esta época'), season.length, season.map(c => card(c, `<span class="f1-circ-rd">${_t('Round', 'Ronda')} ${c.round}</span>`)).join('')) : ''}
        ${others.length ? grp(_t('All circuits in F1 history', 'Todos os circuitos da história da F1'), others.length, others.map(c => card(c)).join('')) : ''}`;

      const detail = body.querySelector('#f1-circ-detail');
      const byId = id => season.find(x => x.circuitId === id) || others.find(x => x.circuitId === id);
      body.querySelectorAll('.f1-circ-grid').forEach(grid => grid.addEventListener('click', e => {
        const cardEl = e.target.closest('.f1-circ-card'); if (!cardEl) return;
        const c = byId(cardEl.dataset.id); if (!c) return;
        body.querySelectorAll('.f1-circ-card').forEach(x => x.classList.toggle('on', x === cardEl));
        openCircuit(c, meta[c.circuitId] || {}, detail);
      }));
    } catch (e) { body.innerHTML = err(); }
  }

  async function openCircuit(circ, m, detail) {
    if (_ctrack) { _ctrack.dispose(); _ctrack = null; }
    if (_circMap) { try { _circMap.remove(); } catch {} _circMap = null; }
    detail.innerHTML = `<div class="f1-circ-panel">${loading(_t('Loading circuit…', 'A carregar o circuito…'))}</div>`;
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      // season history of this circuit (Jolpica) → first/last GP + how many held
      let firstGP = '', lastGP = '', heldCount = 0;
      try {
        const d = await fetch(`https://api.jolpi.ca/ergast/f1/circuits/${circ.circuitId}/seasons.json?limit=100`).then(r => r.json());
        const ss = d?.MRData?.SeasonTable?.Seasons || [];
        if (ss.length) { firstGP = ss[0].season; lastGP = ss[ss.length - 1].season; heldCount = ss.length; }
      } catch {}

      // most successful driver here — winners of every GP held at this circuit
      let topWin = null;
      try {
        const d = await fetch(`https://api.jolpi.ca/ergast/f1/circuits/${circ.circuitId}/results/1.json?limit=100`).then(r => r.json());
        const wins = {};
        for (const r of (d?.MRData?.RaceTable?.Races || [])) {
          const w = r.Results?.[0]?.Driver; if (!w) continue;
          const k = w.givenName + ' ' + w.familyName;
          wins[k] = (wins[k] || 0) + 1;
        }
        const top = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
        if (top) topWin = { who: top[0], n: top[1] };
      } catch {}

      // OpenF1 session for the map + fastest lap (latest past race at this circuit)
      let track = null, fastest = null;
      if (m.of1) {
        let race = null;
        for (const yr of [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]) {
          const rs = await F1Data.racesOfYear(yr).catch(() => []);
          const past = (rs || []).filter(r => r.circuit_short_name === m.of1 && Date.parse(r.date_start) < Date.now());
          if (past.length) { race = past[past.length - 1]; break; }
        }
        if (race) {
          const sk = race.session_key;
          const lapRows = await F1Data.laps(sk).catch(() => []);
          const valid = (lapRows || []).filter(l => l.lap_duration && l.lap_number > 1);
          if (valid.length) {
            const best = valid.reduce((a, b) => b.lap_duration < a.lap_duration ? b : a);
            const drvs = await F1Data.drivers(sk).catch(() => []);
            const dr = (drvs || []).find(d => d.driver_number === best.driver_number);
            fastest = { time: best.lap_duration, who: dr ? dr.full_name : '#' + best.driver_number, year: race.year, lap: best.lap_number };
            // outline from that driver's best lap
            const next = lapRows.find(l => l.driver_number === best.driver_number && l.lap_number === best.lap_number + 1);
            const from = best.date_start, to = (next && next.date_start) || new Date(Date.parse(best.date_start) + (best.lap_duration + 5) * 1000).toISOString();
            await new Promise(r => setTimeout(r, 450));   // dodge OpenF1's 3 req/s limit after the laps+drivers calls
            const loc = await F1Data.location(sk, { driver: best.driver_number, from, to }).catch(() => []);
            track = (loc || []).filter(p => p.x || p.y).map(p => ({ x: p.x, y: p.y }));
          }
        }
      }

      const fmtLap = s => { const m2 = Math.floor(s / 60), sec = (s % 60).toFixed(3); return `${m2}:${sec.padStart(6, '0')}`; };
      const noMap = `<div class="f1-empty f1-circ-nomap">🗺️<span>${m.of1
        ? _t('Map unavailable', 'Mapa indisponível')
        : _t('No map — telemetry only exists from 2023 (historic circuit)', 'Sem mapa — telemetria só existe desde 2023 (circuito histórico)')}</span></div>`;
      const lat = +circ.Location?.lat, lon = +circ.Location?.long;
      const hasGeo = isFinite(lat) && isFinite(lon);
      const hasSchema = track && track.length > 20;
      const schemaInner = hasSchema ? `
        <div class="f1-circ-opts">
          <label><input type="checkbox" id="f1-cc-corners">${_t('Corners', 'Curvas')}</label>
          <label><input type="checkbox" id="f1-cc-sectors">${_t('Sectors', 'Setores')}</label>
        </div>
        <canvas id="f1-circ-canvas"></canvas>
        <div class="f1-circ-maphint">${_t('Layout, corners &amp; sectors derived from OpenF1 telemetry (approx).', 'Traçado, curvas e setores derivados da telemetria OpenF1 (aprox.).')}</div>` : noMap;
      detail.innerHTML = `
        <div class="f1-circ-panel">
          <div class="f1-circ-panel-map">
            ${(hasGeo || hasSchema) ? `<div class="f1-circ-views" id="f1-circ-views">
              <button data-view="schema"${hasSchema ? ' class="on"' : ' disabled'}>📐 ${_t('Schematic', 'Esquema')}</button>
              <button data-view="map"${(!hasSchema && hasGeo) ? ' class="on"' : ''}${hasGeo ? '' : ' disabled'}>🗺️ ${_t('Map', 'Mapa')}</button>
              <button data-view="sat"${hasGeo ? '' : ' disabled'}>🛰️ ${_t('Satellite', 'Satélite')}</button>
            </div>` : ''}
            <div class="f1-circ-schema" id="f1-circ-schema"${hasSchema ? '' : ' hidden'}>${schemaInner}</div>
            <div class="f1-circ-realmap" id="f1-circ-realmap"${hasSchema ? ' hidden' : ''}></div>
          </div>
          <div class="f1-circ-panel-info">
            <h3>${flag(circ.Location?.country)}${esc(circ.circuitName)}</h3>
            <div class="f1-circ-loc">${esc(circ.Location?.locality)}, ${esc(circ.Location?.country)}</div>
            <dl class="f1-circ-dl">
              <div><dt>${_t('Length', 'Comprimento')}</dt><dd>${m.length_km ? m.length_km.toFixed(3) + ' km' : '—'}</dd></div>
              <div><dt>${_t('Turns', 'Curvas')}</dt><dd>${m.turns || '—'}</dd></div>
              <div><dt>${_t('Grands Prix held', 'GPs realizados')}</dt><dd>${heldCount || '—'}</dd></div>
              <div><dt>${_t('First / last GP', 'Primeiro / último GP')}</dt><dd>${firstGP ? firstGP + (lastGP && lastGP !== firstGP ? ' – ' + lastGP : '') : '—'}</dd></div>
              <div><dt>${_t('Most wins here', 'Mais vitórias aqui')}</dt><dd>${topWin ? `${topWin.n}<small> ${esc(topWin.who)}</small>` : '—'}</dd></div>
              <div><dt>${_t('Fastest lap', 'Volta mais rápida')}</dt><dd>${fastest ? `${fmtLap(fastest.time)}<small> ${esc(fastest.who)} · ${fastest.year}</small>` : '—'}</dd></div>
            </dl>
            ${fastest ? `<p class="f1-circ-src">${_t('Fastest lap from OpenF1 race data (2023→).', 'Volta mais rápida dos dados de corrida OpenF1 (2023→).')}</p>` : ''}
          </div>
        </div>`;
      if (hasSchema) {
        const cv = detail.querySelector('#f1-circ-canvas');
        _ctrack = F1Track.create(cv);
        _ctrack.setTrack(track);
        _ctrack.setCorners(detectCorners(track));
        _ctrack.setSectorSplit([Math.floor(track.length / 3), Math.floor(track.length * 2 / 3)]);
        const cc = detail.querySelector('#f1-cc-corners'), scb = detail.querySelector('#f1-cc-sectors');
        cc && cc.addEventListener('change', () => _ctrack && _ctrack.setShowCorners(cc.checked));
        scb && scb.addEventListener('change', () => _ctrack && _ctrack.setShowSectors(scb.checked));
      }
      // real-map (CARTO/OSM or Esri satellite) — keyless, attributed, works for every circuit
      const views = detail.querySelector('#f1-circ-views');
      if (views && hasGeo) {
        const schemaEl = detail.querySelector('#f1-circ-schema'), realEl = detail.querySelector('#f1-circ-realmap');
        views.addEventListener('click', async e => {
          const b = e.target.closest('[data-view]'); if (!b || b.disabled) return;
          views.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
          if (b.dataset.view === 'schema') { schemaEl.hidden = false; realEl.hidden = true; _ctrack && _ctrack.resize(); }
          else { schemaEl.hidden = true; realEl.hidden = false; realEl.innerHTML = realEl.innerHTML || ''; try { await showCircuitRealMap(realEl, lat, lon, b.dataset.view); } catch { realEl.innerHTML = err(); } }
        });
        if (!hasSchema) { try { await showCircuitRealMap(realEl, lat, lon, 'sat'); } catch { realEl.innerHTML = err(); } }
      }
    } catch (e) { detail.innerHTML = `<div class="f1-circ-panel">${err()}</div>`; }
  }

  /* ════════════════════════════ CHAMPIONSHIP ════════════════════════════ */
  async function renderChamp(body) {
    try {
      const [ds, cs] = await Promise.all([F1Data.driverStandings(), F1Data.constructorStandings()]);
      const drivers = (ds || []).map(s => `
        <div class="f1-standing">
          <span class="f1-pos-p">${s.position}</span>
          ${teamDot(s.Constructors?.[0]?.name || '')}
          <span class="f1-st-name">${esc(s.Driver.givenName)} <b>${esc(s.Driver.familyName)}</b></span>
          <span class="f1-st-team">${esc(s.Constructors?.[0]?.name || '')}</span>
          <span class="f1-st-pts">${s.points}</span>
        </div>`).join('');
      const cons = (cs || []).map(s => `
        <div class="f1-standing">
          <span class="f1-pos-p">${s.position}</span>
          ${teamDot(s.Constructor.name)}
          <span class="f1-st-name"><b>${esc(s.Constructor.name)}</b></span>
          <span class="f1-st-pts">${s.points}</span>
        </div>`).join('');
      body.innerHTML = `
        <div class="f1-cols">
          <section class="f1-col"><h3>${_t('Drivers', 'Pilotos')}</h3>${drivers || err()}</section>
          <section class="f1-col"><h3>${_t('Constructors', 'Construtores')}</h3>${cons || err()}</section>
        </div>`;
    } catch (e) { body.innerHTML = err(); }
  }

  /* ════════════════════════════ CALENDAR ════════════════════════════ */
  async function renderCal(body) {
    try {
      const races = await F1Data.schedule();
      const sp = F1Data.splitSchedule(races);
      const row = (r, done) => `
        <div class="f1-cal-row${done ? ' done' : ''}${sp.next && r.round === sp.next.round ? ' next' : ''}">
          <span class="f1-cal-rd">${r.round}</span>
          ${flag(r.Circuit?.Location?.country, 'f1-cal-flag')}
          <span class="f1-cal-name">${esc(r.raceName)}<small>${esc(r.Circuit?.Location?.locality)}, ${esc(r.Circuit?.Location?.country)}</small></span>
          <span class="f1-cal-date">${new Date(r._ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short' })}</span>
          <span class="f1-cal-tick">${done ? '✓' : (sp.next && r.round === sp.next.round ? '▶' : '')}</span>
        </div>`;
      body.innerHTML = `<div class="f1-cal">${sp.all.map(r => row(r, r._ts < Date.now())).join('')}</div>`;
    } catch (e) { body.innerHTML = err(); }
  }

  /* ════════════════════════════ STATS ════════════════════════════
     Rich season dashboard from computed aggregates (wins/podiums/poles/FL/
     DNF/avg per driver + constructors), with a year picker, sortable table,
     team-colour markers and per-column hover descriptions. Current season is
     served from cache; past years are computed live on demand. */
  const STAT_COLS = [
    { k: 'points', en: 'Pts', pt: 'Pts', de: 'Championship points', dp: 'Pontos no campeonato' },
    { k: 'wins', en: 'Wins', pt: 'Vit', de: 'Race wins', dp: 'Vitórias em corrida' },
    { k: 'podiums', en: 'Pod', pt: 'Pód', de: 'Podium finishes (top 3)', dp: 'Pódios (top 3)' },
    { k: 'poles', en: 'Pole', pt: 'Pole', de: 'Pole positions — fastest in qualifying', dp: 'Poles — 1.º na qualificação' },
    { k: 'fl', en: 'FL', pt: 'VR', de: 'Fastest laps set in a race', dp: 'Voltas mais rápidas em corrida' },
    { k: 'top10', en: 'Top10', pt: 'Top10', de: 'Top-10 finishes (points-paying)', dp: 'Chegadas no top 10 (zona de pontos)' },
    { k: 'best', en: 'Best', pt: 'Melhor', de: 'Best finishing position of the year', dp: 'Melhor posição final do ano' },
    { k: 'avg', en: 'Avg', pt: 'Média', de: 'Average finishing position', dp: 'Posição final média' },
    { k: 'dnf', en: 'DNF', pt: 'Aban', de: 'Did Not Finish — retirements', dp: 'Abandonos — não terminou a corrida' },
  ];
  const STAT_ASC = { best: 1, avg: 1 };

  async function renderStats(body) {
    const cur = new Date().getFullYear();
    const years = []; for (let y = cur; y >= 1950; y--) years.push(y);
    body.innerHTML = `
      <div class="f1-stats">
        <div class="f1-stats-head">
          <span class="f1-year-lbl">${_t('Season', 'Época')}</span>
          <select class="f1-select f1-year-sel" id="f1-year" aria-label="${_t('Choose season', 'Escolher época')}">
            ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </div>
        <div id="f1-stats-body">${loading()}</div>
        <div class="f1-th-pop" id="f1-th-pop" hidden></div>
      </div>`;
    const sel = body.querySelector('#f1-year');
    const host = body.querySelector('#f1-stats-body');
    const thPop = body.querySelector('#f1-th-pop');
    const statsRoot = body.querySelector('.f1-stats');
    sel.addEventListener('change', () => paint(+sel.value));
    paint(cur);

    async function paint(year) {
      host.innerHTML = loading(_t('Loading season…', 'A carregar época…'));
      let st = null;
      try { st = await F1Data.seasonStatsFor(year); } catch {}
      if (!st || !(st.drivers || []).length) {
        if (year === cur) return renderStatsFallback(host);
        host.innerHTML = err(_t('No data for this season yet.', 'Ainda sem dados para esta época.'));
        return;
      }
      const D = st.drivers, C = st.constructors || [];
      const maxPts = Math.max(1, D[0].points);
      const leaderBy = key => D.reduce((a, b) => (a == null || b[key] > a[key]) ? b : a, null);
      const leader = D[0], mw = leaderBy('wins'), mp = leaderBy('poles'), mpod = leaderBy('podiums'), mfl = leaderBy('fl');
      const hi = (lbl, d, val, emoji) => (d && val > 0) ? `
        <div class="f1-hi">
          <div class="f1-hi-lbl">${emoji} ${lbl}</div>
          <div class="f1-hi-name">${teamDot(d.team)}${esc(d.given)} <b>${esc(d.family)}</b></div>
          <div class="f1-hi-val">${val}</div>
        </div>` : '';

      function rowsHTML(sortKey) {
        const asc = !!STAT_ASC[sortKey];
        const arr = D.slice().sort((a, b) => {
          let av = a[sortKey], bv = b[sortKey];
          if (av == null) return 1; if (bv == null) return -1;
          return asc ? av - bv : bv - av;
        });
        const cell = v => v || '';
        return arr.map((d, i) => `
          <tr>
            <td class="f1-stat-pos">${i + 1}</td>
            <td class="f1-stat-drv">${teamDot(d.team)}<b>${esc(d.code)}</b><span>${esc(d.given)} ${esc(d.family)}</span></td>
            <td class="f1-stat-team">${esc(d.team)}</td>
            <td class="f1-stat-pts"><b>${d.points}</b><span class="f1-ptsbar"><i style="width:${(d.points / maxPts * 100).toFixed(1)}%"></i></span></td>
            <td>${cell(d.wins)}</td><td>${cell(d.podiums)}</td><td>${cell(d.poles)}</td><td>${cell(d.fl)}</td>
            <td>${cell(d.top10)}</td><td>${d.best ?? '—'}</td><td>${d.avg ?? '—'}</td><td class="f1-stat-dnf">${cell(d.dnf)}</td>
          </tr>`).join('');
      }

      const maxCpts = Math.max(1, (C[0] || {}).points || 1);
      const consHTML = C.map((c, i) => `
        <div class="f1-cbar">
          <span class="f1-cbar-pos">${i + 1}</span>
          <span class="f1-cbar-name">${teamDot(c.name)}${esc(c.name)}</span>
          <span class="f1-cbar-track"><i style="width:${(c.points / maxCpts * 100).toFixed(1)}%"></i></span>
          <span class="f1-cbar-pts">${c.points}</span>
          <span class="f1-cbar-sub">${c.wins} ${_t('win', 'vit')}${c.wins === 1 ? '' : (_lang() === 'en' ? 's' : '')} · ${c.podiums} ${_t('pod', 'pód')}</span>
        </div>`).join('');

      host.innerHTML = `
        <div class="f1-stats-sub">${st.rounds} ${_t(st.rounds === 1 ? 'round' : 'rounds', 'rondas')} · ${D.length} ${_t('drivers', 'pilotos')}${year === cur ? ' · ' + _t('in progress', 'em curso') : ''}</div>
        <div class="f1-hi-row">
          ${hi(_t('Championship leader', 'Líder do campeonato'), leader, leader.points, '🏆')}
          ${hi(_t('Most wins', 'Mais vitórias'), mw, mw && mw.wins, '🥇')}
          ${hi(_t('Most poles', 'Mais poles'), mp, mp && mp.poles, '⚡')}
          ${hi(_t('Most podiums', 'Mais pódios'), mpod, mpod && mpod.podiums, '🍾')}
          ${hi(_t('Most fastest laps', 'Mais voltas rápidas'), mfl, mfl && mfl.fl, '⏱️')}
        </div>
        <div class="f1-stat-tablewrap">
          <table class="f1-stat-table">
            <thead><tr>
              <th>#</th><th>${_t('Driver', 'Piloto')}</th><th>${_t('Team', 'Equipa')}</th>
              ${STAT_COLS.map(c => `<th class="f1-sortable${c.k === 'points' ? ' on' : ''}" data-sort="${c.k}" data-desc="${esc(_t(c.de, c.dp))}" title="${esc(_t(c.de, c.dp))}">${_t(c.en, c.pt)}</th>`).join('')}
            </tr></thead>
            <tbody id="f1-stat-body">${rowsHTML('points')}</tbody>
          </table>
        </div>
        <div class="f1-stat-legend">${_t('Hover a column header for what it means · tap it to sort',
          'Passa o rato num cabeçalho para ver o que significa · toca para ordenar')}</div>
        <h3 class="f1-stats-h">${_t('Constructors', 'Construtores')}</h3>
        <div class="f1-cbars">${consHTML}</div>
        <p class="f1-note">${_t('Aggregated from race results &amp; qualifying (Jolpica/Ergast). Coloured dot = team colour (logos are trademarked).',
          'Agregado de resultados e qualificação (Jolpica/Ergast). Ponto colorido = cor da equipa (os logótipos são marcas registadas).')}</p>`;

      const tbody = host.querySelector('#f1-stat-body');
      host.querySelectorAll('.f1-sortable').forEach(th => {
        th.addEventListener('click', () => {
          host.querySelectorAll('.f1-sortable').forEach(x => x.classList.toggle('on', x === th));
          tbody.innerHTML = rowsHTML(th.dataset.sort);
        });
        // hover description popup (positioned relative to .f1-stats, outside the scroll clip)
        th.addEventListener('mouseenter', () => {
          thPop.textContent = th.dataset.desc; thPop.hidden = false;
          const tr = th.getBoundingClientRect(), sr = statsRoot.getBoundingClientRect();
          thPop.style.left = Math.max(4, Math.min(sr.width - thPop.offsetWidth - 4, tr.left - sr.left)) + 'px';
          thPop.style.top = (tr.bottom - sr.top + 4) + 'px';
        });
        th.addEventListener('mouseleave', () => { thPop.hidden = true; });
      });
    }
  }

  /* resilient fallback when the computed aggregates are unavailable */
  async function renderStatsFallback(body) {
    try {
      const ds = await F1Data.driverStandings();
      const wins = (ds || []).filter(s => +s.wins > 0).sort((a, b) => b.wins - a.wins);
      const top = (ds || []).slice(0, 10);
      body.innerHTML = `
        <div class="f1-cols">
          <section class="f1-col"><h3>${_t('Wins this season', 'Vitórias esta época')}</h3>
            ${wins.length ? wins.map(s => `<div class="f1-standing"><span class="f1-st-name">${esc(s.Driver.givenName)} <b>${esc(s.Driver.familyName)}</b></span><span class="f1-st-pts">${s.wins} 🏆</span></div>`).join('') : err()}
          </section>
          <section class="f1-col"><h3>${_t('Points leaders', 'Líderes de pontos')}</h3>
            ${top.map(s => `<div class="f1-standing"><span class="f1-pos-p">${s.position}</span><span class="f1-st-name">${esc(s.Driver.familyName)}</span><span class="f1-st-pts">${s.points}</span></div>`).join('')}
          </section>
        </div>`;
    } catch (e) { body.innerHTML = err(); }
  }

  return { show };
})();
