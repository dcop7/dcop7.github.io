/* ══════════════════════════════════════════════════════════════════
   F1 PAGE — experimental "Fórmula 1" section (a probe for a future Sport
   area). Tabs: Corrida · Pista (live/replay) · Campeonato · Calendário ·
   Estatísticas. Mobile-friendly, offline-first via F1Data, no backend.
   ══════════════════════════════════════════════════════════════════ */
const F1Page = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  let _root = null, _inited = false, _tab = 'race', _track = null, _liveTimer = null;

  const TABS = [
    { id: 'race',    ic: '🏁', en: 'Race',         pt: 'Corrida' },
    { id: 'track',   ic: '🏎️', en: 'Track',        pt: 'Pista' },
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

  async function latestRaceSession() {
    const yr = new Date().getFullYear();
    let races = [];
    try { races = await F1Data.racesOfYear(yr); } catch {}
    if (!races || !races.length) { try { races = await F1Data.racesOfYear(yr - 1); } catch {} }
    const now = Date.now();
    const past = (races || []).filter(r => Date.parse(r.date_start) < now);
    return past.length ? past[past.length - 1] : (races && races[races.length - 1]) || null;
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
    const body = _root.querySelector('#f1-body');
    body.innerHTML = loading();
    ({ race: renderRace, track: renderTrack, champ: renderChamp, cal: renderCal, stats: renderStats }[tab] || renderRace)(body);
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
          <div class="f1-gp">${esc(next.raceName)}</div>
          <div class="f1-sub">${esc(next.Circuit?.circuitName)} · ${esc(next.Circuit?.Location?.locality)}, ${esc(next.Circuit?.Location?.country)}</div>
          <div class="f1-row2">
            <div class="f1-count"><span class="f1-count-n">${countdown(next._ts)}</span><span class="f1-count-l">${_t('to lights out', 'para a partida')}</span></div>
            <div class="f1-when">🕐 ${localTime(next._ts)} <span class="f1-tz">(${_t('your time', 'hora local')})</span></div>
          </div>
        </div>` : '';

      const lastHTML = last && last.Results ? `
        <div class="f1-card">
          <div class="f1-card-lbl">${_t('Last race', 'Última corrida')} — ${esc(last.raceName)}</div>
          <ol class="f1-podium">
            ${last.Results.slice(0, 5).map((r, i) => `
              <li><span class="f1-pos">${r.position}</span>
                <span class="f1-drv">${esc(r.Driver.givenName[0])}. ${esc(r.Driver.familyName)}</span>
                <span class="f1-team">${esc(r.Constructor.name)}</span>
                <span class="f1-gap">${i === 0 ? '🏆' : (r.Time?.time || r.status || '')}</span></li>`).join('')}
          </ol>
        </div>` : '';

      body.innerHTML = `<div class="f1-grid">${liveHTML}${nextHTML}${lastHTML || ''}</div>` || err();
      if (!liveHTML && !nextHTML && !lastHTML) body.innerHTML = err();
    } catch (e) { body.innerHTML = err(); }
  }

  /* ════════════════════════════ TRACK (POC) ════════════════════════════ */
  async function renderTrack(body) {
    body.innerHTML = loading(_t('Loading race replay…', 'A carregar o replay da corrida…'));
    try {
      const race = await latestRaceSession();
      if (!race) { body.innerHTML = err(); return; }
      const sk = race.session_key;
      const start = race.date_start;
      const winStart = start;
      const winEnd = new Date(Date.parse(start) + 120000).toISOString().replace('.000', '');
      // outline lap from a single driver over a clean ~3-min mid-race window
      const lapFrom = new Date(Date.parse(start) + 1500000).toISOString().replace('.000', '');
      const lapTo = new Date(Date.parse(start) + 1700000).toISOString().replace('.000', '');

      // sequence the fetches — OpenF1 limits to 3 req/s, and the location
      // payloads are large, so firing everything at once gets the small calls
      // rate-limited (429). Small/metadata first, then the big location pulls.
      const [drv, posRows] = await Promise.all([
        F1Data.drivers(sk),
        F1Data.positions(sk).catch(() => []),
      ]);
      const [loc, lapLoc] = await Promise.all([
        F1Data.location(sk, { from: winStart, to: winEnd }),
        F1Data.location(sk, { driver: null, from: lapFrom, to: lapTo }).catch(() => []),
      ]);

      const meta = {};
      (drv || []).forEach(d => { meta[d.driver_number] = { name: d.full_name, code: d.name_acronym, colour: d.team_colour, team: d.team_name }; });

      // build replay frames per driver (t = ms from window start)
      const t0 = Date.parse(winStart);
      const per = {};
      for (const p of (loc || [])) {
        if (!isFinite(p.x) || !isFinite(p.y) || (p.x === 0 && p.y === 0)) continue;
        (per[p.driver_number] = per[p.driver_number] || []).push({ t: Date.parse(p.date) - t0, x: p.x, y: p.y });
      }
      // track outline = one driver's lap window (fallback: the replay points)
      let outline = [];
      if (lapLoc && lapLoc.length) {
        const one = lapLoc.find(p => p.driver_number) ? lapLoc[0].driver_number : null;
        outline = lapLoc.filter(p => p.driver_number === lapLoc[0].driver_number && p.x !== 0).map(p => ({ x: p.x, y: p.y }));
      }

      if (!Object.keys(per).length) { body.innerHTML = err(_t('No position data for this session.', 'Sem dados de posição para esta sessão.')); return; }

      body.innerHTML = `
        <div class="f1-track-head">
          <div><b>${esc(race.circuit_short_name)}</b> · ${esc(race.country_name)} ${race.year || ''}
            <span class="f1-replay-tag">${_t('replay · race start', 'replay · partida')}</span></div>
        </div>
        <div class="f1-track-stage"><canvas id="f1-canvas"></canvas>
          <div class="f1-track-hint">${_t('Drag the slider · play to watch the cars', 'Arrasta a barra · play para ver os carros')}</div>
        </div>
        <div class="f1-controls">
          <button class="f1-btn" id="f1-play">▶ ${_t('Play', 'Reproduzir')}</button>
          <input type="range" id="f1-seek" min="0" max="1000" value="0" class="f1-seek">
          <div class="f1-speed" id="f1-speed">${[3, 6, 12].map(s => `<button data-s="${s}" class="${s === 6 ? 'on' : ''}">${s}×</button>`).join('')}</div>
        </div>
        <div class="f1-pos" id="f1-pos"></div>`;

      const canvas = body.querySelector('#f1-canvas');
      _track = F1Track.create(canvas);
      _track.setDrivers(meta);
      if (outline.length > 20) _track.setTrack(outline);
      _track.setReplay(per);

      // running order synced to the replay clock (from /position rows)
      const posByDriver = {};
      for (const r of (posRows || [])) (posByDriver[r.driver_number] = posByDriver[r.driver_number] || []).push({ t: Date.parse(r.date) - t0, p: r.position });
      Object.values(posByDriver).forEach(a => a.sort((x, y) => x.t - y.t));
      const posEl = body.querySelector('#f1-pos');
      const seek = body.querySelector('#f1-seek');
      function orderAt(ms) {
        const out = [];
        for (const num in posByDriver) {
          const a = posByDriver[num]; let p = a[0]?.p;
          for (const e of a) { if (e.t <= ms) p = e.p; else break; }
          if (p != null) out.push({ num, p });
        }
        return out.sort((x, y) => x.p - y.p).slice(0, 20);
      }
      function paintPos(frac) {
        const ms = frac * (_track.duration || 1);
        posEl.innerHTML = orderAt(ms).map(o => {
          const m = meta[o.num] || {};
          return `<div class="f1-pos-row"><span class="f1-pos-p">${o.p}</span>
            <span class="f1-dot" style="background:${teamCol(m.colour)}"></span>
            <span class="f1-pos-name">${esc(m.code || o.num)}</span>
            <span class="f1-pos-team">${esc(m.team || '')}</span></div>`;
        }).join('') || `<div class="f1-empty">${_t('No live order', 'Sem ordem')}</div>`;
      }
      _track.setOnTick(f => { seek.value = Math.round(f * 1000); paintPos(f); });
      paintPos(0);

      const playBtn = body.querySelector('#f1-play');
      playBtn.addEventListener('click', () => { const on = _track.toggle(); playBtn.textContent = on ? '⏸ ' + _t('Pause', 'Pausa') : '▶ ' + _t('Play', 'Reproduzir'); });
      seek.addEventListener('input', () => _track.seek(seek.value / 1000));
      body.querySelector('#f1-speed').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; _track.setSpeed(+b.dataset.s); body.querySelectorAll('#f1-speed button').forEach(x => x.classList.toggle('on', x === b)); });
      _track.play(); playBtn.textContent = '⏸ ' + _t('Pause', 'Pausa');
    } catch (e) { body.innerHTML = err(); }
  }

  /* ════════════════════════════ CHAMPIONSHIP ════════════════════════════ */
  async function renderChamp(body) {
    try {
      const [ds, cs] = await Promise.all([F1Data.driverStandings(), F1Data.constructorStandings()]);
      const drivers = (ds || []).map(s => `
        <div class="f1-standing">
          <span class="f1-pos-p">${s.position}</span>
          <span class="f1-st-name">${esc(s.Driver.givenName)} <b>${esc(s.Driver.familyName)}</b></span>
          <span class="f1-st-team">${esc(s.Constructors?.[0]?.name || '')}</span>
          <span class="f1-st-pts">${s.points}</span>
        </div>`).join('');
      const cons = (cs || []).map(s => `
        <div class="f1-standing">
          <span class="f1-pos-p">${s.position}</span>
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
          <span class="f1-cal-name">${esc(r.raceName)}<small>${esc(r.Circuit?.Location?.country)}</small></span>
          <span class="f1-cal-date">${new Date(r._ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short' })}</span>
          <span class="f1-cal-tick">${done ? '✓' : (sp.next && r.round === sp.next.round ? '▶' : '')}</span>
        </div>`;
      body.innerHTML = `<div class="f1-cal">${sp.all.map(r => row(r, r._ts < Date.now())).join('')}</div>`;
    } catch (e) { body.innerHTML = err(); }
  }

  /* ════════════════════════════ STATS ════════════════════════════ */
  async function renderStats(body) {
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
        </div>
        <p class="f1-note">${_t('More stats (poles, fastest laps, all-time history) coming as the section grows.', 'Mais estatísticas (poles, voltas rápidas, histórico) à medida que a secção cresce.')}</p>`;
    } catch (e) { body.innerHTML = err(); }
  }

  return { show };
})();
