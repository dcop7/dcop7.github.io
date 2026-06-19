/* ══════════════════════════════════════════════════════════════════
   F1 PAGE — experimental "Fórmula 1" section (a probe for a future Sport
   area). Tabs: Corrida · Pista (live/replay) · Campeonato · Calendário ·
   Estatísticas. Mobile-friendly, offline-first via F1Data, no backend.
   ══════════════════════════════════════════════════════════════════ */
const F1Page = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  let _root = null, _inited = false, _tab = 'race', _track = null, _ctrack = null, _liveTimer = null;

  const TABS = [
    { id: 'race',    ic: '🏁', en: 'Race',         pt: 'Corrida' },
    { id: 'track',   ic: '🏎️', en: 'Track',        pt: 'Pista' },
    { id: 'circuit', ic: '🗺️', en: 'Circuit',      pt: 'Circuito' },
    { id: 'champ',   ic: '🏆', en: 'Championship',  pt: 'Campeonato' },
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
          <div class="f1-title"><span class="f1-logo">🏎️</span> <span>Fórmula 1</span>
            <span class="f1-exp">${_t('experimental', 'experimental')}</span></div>
          <nav class="f1-tabs" id="f1-tabs" role="tablist">
            ${TABS.map(t => `<button class="f1-tab${t.id === 'race' ? ' on' : ''}" data-tab="${t.id}" role="tab">
              <span class="f1-tab-ic">${t.ic}</span><span>${_t(t.en, t.pt)}</span></button>`).join('')}
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
    const body = _root.querySelector('#f1-body');
    body.innerHTML = loading();
    ({ race: renderRace, track: renderTrack, circuit: renderCircuit, champ: renderChamp, cal: renderCal, stats: renderStats }[tab] || renderRace)(body);
  }

  /* ════════════════════════════ RACE ════════════════════════════ */
  async function renderRace(body) {
    try {
      const [races, last, session] = await Promise.all([
        F1Data.schedule().catch(() => []),
        F1Data.lastResults().catch(() => null),
        F1Data.latestSession().catch(() => null),
      ]);
      const sp = F1Data.splitSchedule(races);
      const next = sp.next;

      // live? a session running within ±30min
      let liveHTML = '';
      if (session) {
        const st = Date.parse(session.date_start), en = Date.parse(session.date_end);
        const now = Date.now();
        if (now >= st - 1800000 && now <= en + 1800000) {
          let w = null; try { const wr = await F1Data.weather(session.session_key); w = wr && wr[wr.length - 1]; } catch {}
          liveHTML = `
            <div class="f1-card f1-live">
              <div class="f1-live-badge">● ${_t('LIVE', 'AO VIVO')}</div>
              <div class="f1-gp">${esc(session.circuit_short_name)} — ${esc(session.country_name)}</div>
              <div class="f1-sess">${esc(session.session_name)}</div>
              ${w ? `<div class="f1-wx">🌡️ ${w.air_temperature}°C · ${_t('track', 'pista')} ${w.track_temperature}°C · 💧 ${w.humidity}% · ${w.rainfall ? '🌧️ '+_t('rain','chuva') : '☀️ '+_t('dry','seco')}</div>` : ''}
              <div class="f1-when">${localTime(session.date_start)}</div>
            </div>`;
        }
      }

      const nextHTML = next ? `
        <div class="f1-card">
          <div class="f1-card-lbl">${_t('Next Grand Prix', 'Próximo Grande Prémio')}</div>
          <div class="f1-gp">${flag(next.Circuit?.Location?.country)}${esc(next.raceName)}</div>
          <div class="f1-sub">${esc(next.Circuit?.circuitName)} · ${esc(next.Circuit?.Location?.locality)}, ${esc(next.Circuit?.Location?.country)}</div>
          <div class="f1-row2">
            <div class="f1-count"><span class="f1-count-n">${countdown(next._ts)}</span><span class="f1-count-l">${_t('to lights out', 'para a partida')}</span></div>
            <div class="f1-when">🕐 ${localTime(next._ts)} <span class="f1-tz">(${_t('your time', 'hora local')})</span></div>
          </div>
        </div>` : '';

      const lastHTML = last && last.Results ? renderResults(last) : '';

      body.innerHTML = `<div class="f1-grid">${liveHTML}${nextHTML}${lastHTML || ''}</div>` || err();
      if (!liveHTML && !nextHTML && !lastHTML) body.innerHTML = err();
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

  /* interpolate a point at parameter u∈[0,1) along a closed outline polyline */
  function outlineXY(pts, u) {
    const N = pts.length, fi = (((u % 1) + 1) % 1) * N;
    const i = Math.floor(fi) % N, j = (i + 1) % N, f = fi - Math.floor(fi);
    return { x: pts[i].x + (pts[j].x - pts[i].x) * f, y: pts[i].y + (pts[j].y - pts[i].y) * f };
  }

  async function renderTrack(body) {
    body.innerHTML = loading(_t('Loading races…', 'A carregar corridas…'));
    let races, liveSession = null;
    try {
      races = await seasonRaces();
      try {
        const s = await F1Data.latestSession();
        if (s) { const st = Date.parse(s.date_start), en = Date.parse(s.date_end);
          if (Date.now() >= st - 300000 && Date.now() <= en + 600000) liveSession = s; }
      } catch {}
    } catch { body.innerHTML = err(); return; }
    const past = (races || []).filter(r => Date.parse(r.date_start) < Date.now());
    if (!past.length && !liveSession) { body.innerHTML = err(_t('No race data yet.', 'Ainda sem dados de corrida.')); return; }

    const opts = past.slice().reverse().map(r =>
      `<option value="${r.session_key}">${esc(r.circuit_short_name)} · ${esc(r.country_name)} ${r.year || ''}</option>`).join('');

    body.innerHTML = `
      <div class="f1-track-head">
        <div class="f1-track-sel">
          ${liveSession ? `<button class="f1-live-pill" id="f1-go-live">● ${_t('LIVE', 'AO VIVO')}</button>` : ''}
          <select class="f1-select" id="f1-race-sel" aria-label="${_t('Choose race','Escolher corrida')}">${opts}</select>
        </div>
        <div class="f1-track-meta" id="f1-track-meta"></div>
        <div class="f1-weather" id="f1-weather"></div>
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
            <button class="f1-btn f1-toggle" id="f1-label" title="${_t('Toggle name / number','Alternar nome / número')}">ABC</button>
            <button class="f1-btn f1-icon-btn" id="f1-fs" title="${_t('Fullscreen','Ecrã inteiro')}" aria-label="${_t('Fullscreen','Ecrã inteiro')}">⛶</button>
          </div>
        </div>
        <aside class="f1-side">
          <h4>${_t('Race events', 'Eventos da corrida')}</h4>
          <div class="f1-events" id="f1-events"></div>
        </aside>
        <div class="f1-driver-pop" id="f1-driver-pop" hidden></div>
      </div>`;

    const sel = body.querySelector('#f1-race-sel');
    sel.value = String(past[past.length - 1].session_key);
    sel.addEventListener('change', () => loadRace(+sel.value));
    const goLive = body.querySelector('#f1-go-live');
    if (goLive) goLive.addEventListener('click', () => loadLive(liveSession));

    loadRace(+sel.value);

    /* ── load + wire a single race replay (WHOLE race) ──
       The full X/Y telemetry of a 90-min race is ~50 MB, so instead each car
       is placed on a real track outline by its lap progress (from /laps —
       only ~600 KB for the entire race). Position on the lap = how far through
       the current lap the car is; a small constant per-grid-slot offset keeps
       the field from overlapping at the start. */
    async function loadRace(sk) {
      clearInterval(_liveTimer); _liveTimer = null;
      if (_track) { _track.dispose(); _track = null; }
      const race = (races || []).find(r => r.session_key === sk) || {};
      const stage = body.querySelector('#f1-stage-load');
      const metaEl = body.querySelector('#f1-track-meta');
      const posEl = body.querySelector('#f1-pos');
      const evEl = body.querySelector('#f1-events');
      stage.style.display = ''; stage.innerHTML = loading(_t('Loading the full race…', 'A carregar a corrida completa…'));
      posEl.innerHTML = ''; evEl.innerHTML = '';
      metaEl.innerHTML = `<b>${esc(race.circuit_short_name)}</b> · ${esc(race.country_name)} ${race.year || ''}
        <span class="f1-replay-tag">${_t('full race', 'corrida completa')}</span>`;
      const fail = msg => { stage.style.display = ''; stage.innerHTML =
        `<div class="f1-empty">⚠ ${esc(msg || _t('Could not load data.', 'Não foi possível carregar os dados.'))}
          <button class="f1-btn f1-retry" id="f1-retry">↻ ${_t('Retry', 'Tentar de novo')}</button></div>`;
        const rb = stage.querySelector('#f1-retry'); if (rb) rb.onclick = () => loadRace(sk); };

      try {
        // fetches sequenced under the OpenF1 rate gate (no big telemetry pull)
        const [drv, posRows] = await Promise.all([F1Data.drivers(sk), F1Data.positions(sk).catch(() => [])]);
        const [lapRows, stintRows] = await Promise.all([F1Data.laps(sk), F1Data.stints(sk).catch(() => [])]);
        const [rcRows, wxRows] = await Promise.all([F1Data.raceControl(sk).catch(() => []), F1Data.weather(sk).catch(() => [])]);
        const penByDriver = parsePenalties(rcRows);

        const meta = {};
        (drv || []).forEach(d => { meta[d.driver_number] = { name: d.full_name, code: d.name_acronym, colour: d.team_colour, team: d.team_name, num: d.driver_number, country: d.country_code }; });

        // per-driver lap timeline {lap, t0, dur, end} (absolute ms)
        const lapsByDriver = {};
        for (const l of (lapRows || [])) {
          if (!l.date_start) continue;
          const t0 = Date.parse(l.date_start), dur = (l.lap_duration || 0) * 1000;
          (lapsByDriver[l.driver_number] = lapsByDriver[l.driver_number] || []).push({ lap: l.lap_number, t0, dur, end: t0 + (dur || 90000) });
        }
        for (const n in lapsByDriver) lapsByDriver[n].sort((a, b) => a.lap - b.lap);
        const allFirst = Object.values(lapsByDriver).map(a => a[0] && a[0].t0).filter(Boolean);
        if (!allFirst.length) { fail(_t('No lap data for this race.', 'Sem dados de voltas para esta corrida.')); return; }
        const lights = Math.min(...allFirst);
        const raceEnd = Math.max(...Object.values(lapsByDriver).map(a => a[a.length - 1].end));
        const raceDur = raceEnd - lights;
        const totalLaps = Math.max(...(lapRows || []).map(l => l.lap_number || 0));
        // when each lap begins in the race (earliest driver to reach it) → for the lap picker
        const lapStart = {};
        for (const l of (lapRows || [])) {
          if (!l.date_start) continue;
          const t = Date.parse(l.date_start) - lights, ln = l.lap_number;
          if (lapStart[ln] == null || t < lapStart[ln]) lapStart[ln] = t;
        }
        // last lap + retired? (stopped well before the race ended = DNF, kept in the list)
        const lastEndRel = {}, lastLapNum = {};
        for (const n in lapsByDriver) { const a = lapsByDriver[n]; lastEndRel[n] = a[a.length - 1].end - lights; lastLapNum[n] = a[a.length - 1].lap; }
        const isRetired = num => lastEndRel[num] < raceDur - 150000;   // ended >2.5 min before the finish

        // Trace a clean outline from one driver's location over a single fast lap,
        // trimmed to EXACTLY one lap (extra points would overlap past the start/
        // finish and make cars "jump back"). The telemetry feed can cut out before
        // the race ends (e.g. Monaco's stops ~1 h in while the race runs longer), so
        // the overall fastest lap may have NO location — try several candidates
        // (fastest, plus fast laps from earlier in the race) until one returns data.
        let outline = [];
        const clean = (lapRows || []).filter(l => l.lap_duration && l.lap_number > 1 && l.date_start);
        const fastestIn = max => clean.filter(l => l.lap_number <= max).reduce((a, b) => (!a || b.lap_duration < a.lap_duration) ? b : a, null);
        const cand = [];
        const seen = new Set();
        for (const c of [fastestIn(1e9), fastestIn(Math.ceil(totalLaps * 0.5)), fastestIn(Math.ceil(totalLaps * 0.33)), fastestIn(Math.ceil(totalLaps * 0.2))]) {
          if (c && !seen.has(c.driver_number + ':' + c.lap_number)) { seen.add(c.driver_number + ':' + c.lap_number); cand.push(c); }
        }
        for (const best of cand) {
          const lapEndMs = Date.parse(best.date_start) + best.lap_duration * 1000;
          const loc = await F1Data.location(sk, { driver: best.driver_number, from: best.date_start, to: new Date(lapEndMs + 1500).toISOString() }).catch(() => []);
          const pts = (loc || [])
            .filter(p => (p.x || p.y) && isFinite(p.x) && isFinite(p.y) && Date.parse(p.date) < lapEndMs)
            .map(p => ({ x: p.x, y: p.y }));
          if (pts.length >= 20) { outline = pts; break; }
        }
        // Fallback: windowed location can be empty even when data exists (Monaco's
        // feed dies after a few laps). Pull one driver's FULL location once and slice
        // the clean lap that has the most points from it.
        if (outline.length < 20) {
          const drvNum = (cand[0] && cand[0].driver_number) || +Object.keys(lapsByDriver)[0];
          const full = await F1Data.location(sk, { driver: drvNum }).catch(() => []);
          const nz = (full || []).filter(p => (p.x || p.y) && isFinite(p.x) && isFinite(p.y)).map(p => ({ t: Date.parse(p.date), x: p.x, y: p.y }));
          let bestPts = [];
          for (const l of (lapsByDriver[drvNum] || [])) {
            if (!l.dur) continue;
            const pts = nz.filter(p => p.t >= l.t0 && p.t < l.t0 + l.dur);
            if (pts.length > bestPts.length) bestPts = pts;
          }
          outline = bestPts.sort((a, b) => a.t - b.t).map(p => ({ x: p.x, y: p.y }));
        }
        if (outline.length < 20) { fail(_t('Could not trace the track.', 'Não foi possível traçar a pista.')); return; }

        // starting grid order → constant along-track offset so they don't overlap at the start
        const startPos = {};
        for (const r of (posRows || [])) {
          const t = Date.parse(r.date);
          if (!startPos[r.driver_number] || t < startPos[r.driver_number].t) startPos[r.driver_number] = { t, p: r.position };
        }
        const gridOrder = Object.keys(lapsByDriver).sort((a, b) => (startPos[a]?.p || 99) - (startPos[b]?.p || 99));
        const offset = {}; gridOrder.forEach((n, i) => { offset[n] = i * GRID_GAP; });

        // progress(absT) → {lap, f} (f = fraction through current lap); null once retired
        function progAbs(arr, absT) {
          if (absT < arr[0].t0) return { lap: 1, f: 0 };
          for (let i = 0; i < arr.length; i++) {
            const l = arr[i];
            if (absT < l.end) return { lap: l.lap, f: l.dur ? Math.min(1, Math.max(0, (absT - l.t0) / l.dur)) : 0 };
            if (i + 1 < arr.length && absT < arr[i + 1].t0) return { lap: l.lap, f: 1 };  // between laps (e.g. pit)
          }
          return null;                                          // past last lap → out
        }
        // float progress for gap maths
        function progFloat(num, ms) { const a = lapsByDriver[num]; if (!a) return null; const p = progAbs(a, lights + ms); return p ? (p.lap - 1) + p.f : null; }

        // build synthetic replay frames on the outline
        const frames = {};
        for (const num in lapsByDriver) {
          const arr = lapsByDriver[num], lastEnd = arr[arr.length - 1].end, fr = [];
          for (let t = 0; t <= raceDur; t += FRAME_MS) {
            const absT = lights + t;
            if (absT > lastEnd + 1500) break;                   // car retired/finished → stop (it disappears)
            const p = progAbs(arr, absT); if (!p) break;
            const xy = outlineXY(outline, p.f - offset[num]);
            fr.push({ t, x: xy.x, y: xy.y });
          }
          if (fr.length) frames[num] = fr;
        }

        // tyre compound at a given lap (from stints)
        const stintsByDriver = {};
        for (const s of (stintRows || [])) (stintsByDriver[s.driver_number] = stintsByDriver[s.driver_number] || []).push(s);
        function tyreAt(num, lap) {
          const ss = stintsByDriver[num]; if (!ss) return {};
          let cur = null;
          for (const s of ss) { if (lap >= s.lap_start && lap <= s.lap_end) return s; if (s.lap_start <= lap) cur = s; }
          return cur || ss[0] || {};
        }

        // running order over time (from /position)
        const posByDriver = {};
        for (const r of (posRows || [])) (posByDriver[r.driver_number] = posByDriver[r.driver_number] || []).push({ t: Date.parse(r.date) - lights, p: r.position });
        Object.values(posByDriver).forEach(a => a.sort((x, y) => x.t - y.t));

        // events feed — whole race, all seekable
        const events = (rcRows || []).map(rcEntry).filter(rcKeep).map(e => ({ ...e, t: Date.parse(e.date) - lights })).sort((a, b) => a.t - b.t);
        const flagRows = flagStateRows(rcRows || []).map(r => ({ t: Date.parse(r.date) - lights, s: r.s })).sort((a, b) => a.t - b.t);

        // ── build the track ──
        const canvas = body.querySelector('#f1-canvas');
        _track = F1Track.create(canvas);
        _track.setDrivers(meta);
        _track.setTrack(outline);
        _track.setReplay(frames);
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
            return `<div class="f1-pos-row${o.retired ? ' out' : ''}" data-num="${o.num}">
              <span class="f1-pos-p">${o.retired ? '–' : o.p}</span>
              <span class="f1-pos-num" style="border-color:${teamCol(m.colour)}">${esc(o.num)}</span>
              <span class="f1-pos-name">${esc(m.code || o.num)}</span>
              ${o.retired ? '' : `<span class="f1-tyre t-${comp.toLowerCase()}" title="${esc(comp)}">${ty.l}</span>`}
              ${penBadge}
              <span class="f1-pos-gap">${gap}</span></div>`;
          }).join('') || `<div class="f1-empty">${_t('No order', 'Sem ordem')}</div>`;
        }
        // events list built ONCE; ticks only toggle classes + autoscroll (no re-render,
        // so hover/scroll aren't disturbed)
        evEl.innerHTML = events.map((e, i) => {
          const mm = e.t < 0 ? '0:00' : `${Math.floor(e.t / 60000)}:${String(Math.floor(e.t % 60000 / 1000)).padStart(2, '0')}`;
          return `<div class="f1-ev k-${e.kind}" data-i="${i}" data-t="${e.t}">
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

        // weather time-series → chip in the header
        const wx = (wxRows || []).map(w => ({ t: Date.parse(w.date) - lights, air: w.air_temperature, trk: w.track_temperature, hum: w.humidity, rain: w.rainfall, wind: w.wind_speed }))
          .filter(w => isFinite(w.t)).sort((a, b) => a.t - b.t);
        const wxEl = body.querySelector('#f1-weather');
        function paintWx(ms) {
          let w = null; for (const r of wx) { if (r.t <= ms) w = r; else break; } if (!w) w = wx[0];
          if (!w) { wxEl.textContent = ''; return; }
          wxEl.innerHTML = `<span>${w.rain > 0 ? '🌧️' : '☀️'} ${Math.round(w.air)}°C</span>`
            + `<span>${_t('track', 'pista')} ${Math.round(w.trk)}°</span>`
            + `<span>💧 ${Math.round(w.hum)}%</span>`
            + (w.wind != null ? `<span>💨 ${Math.round(w.wind)} m/s</span>` : '');
        }

        // seek-bar markers — only the notable events, across the whole race
        const markKinds = { sc: 1, vsc: 1, red: 1, incident: 1, penalty: 1, chequered: 1 };
        body.querySelector('#f1-seek-marks').innerHTML = events.filter(e => markKinds[e.kind] && e.t >= 0).map(e =>
          `<i class="m-${e.kind}" style="left:${Math.min(100, e.t / raceDur * 100)}%"></i>`).join('');

        let curMs = 0;
        function onClock(frac) {
          const ms = frac * (_track.duration || 1); curMs = ms;
          seek.value = Math.round(frac * 1000);
          _track.setFlag(flagAt(ms));
          const lead = orderAt(ms).find(o => !o.retired);
          const lap = lead ? (progAbs(lapsByDriver[lead.num], lights + ms) || {}).lap || 1 : 1;
          if (document.activeElement !== lapIn) lapIn.value = Math.min(totalLaps, lap);
          paintPos(ms); updateEvents(ms); paintWx(ms);
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
        posEl.addEventListener('mouseover', e => { const row = e.target.closest('.f1-pos-row'); if (!row) return; popNum = +row.dataset.num; showPop(popNum); });
        posEl.addEventListener('mouseleave', () => { pop.hidden = true; popNum = null; });

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
        let showCode = true;
        const labelBtn = body.querySelector('#f1-label');
        labelBtn.onclick = () => { showCode = !showCode; _track.setLabelMode(showCode ? 'code' : 'num'); labelBtn.textContent = showCode ? 'ABC' : '#'; labelBtn.classList.toggle('on', !showCode); };
        // click an event → jump there and pause
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
      detail.innerHTML = `
        <div class="f1-circ-panel">
          <div class="f1-circ-panel-map">${track && track.length > 20 ? '<canvas id="f1-circ-canvas"></canvas>' : noMap}</div>
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
      if (track && track.length > 20) {
        const cv = detail.querySelector('#f1-circ-canvas');
        _ctrack = F1Track.create(cv);
        _ctrack.setTrack(track);
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
