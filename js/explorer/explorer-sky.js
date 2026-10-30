/* ══════════════════════════════════════════════════════════════════
   CÉU ESTA NOITE — Explorar ▸ #explorer/sky
   ──────────────────────────────────────────────────────────────────
   O que dá para ver hoje à noite, de onde estás:
     • resumo da noite (pôr do sol, noite escura, nuvens por hora)
     • a Lua (fase desenhada, nascer/pôr, próximas fases)
     • mapa do céu em tempo real com régua de hora (do pôr ao nascer)
     • planetas visíveis: quando, para onde olhar, brilho
     • passagens visíveis da ISS nos próximos 5 dias
     • este mês no céu: fases da Lua e chuvas de estrelas

   As contas são todas do SkyAstro (js/explorer/sky-astro.js, código
   próprio validado contra a JPL Horizons). De fora vêm só dados vivos:
     – nuvens: Open-Meteo (sem chave, CORS aberto)
     – órbita da ISS: CelesTrak (TLE do dia, CORS aberto), em cache 12 h
   Se algum falhar, essa caixa explica-o e o resto continua a funcionar.
   ══════════════════════════════════════════════════════════════════ */
const SkyTonight = (function () {
  'use strict';

  const A = () => SkyAstro;
  const CITIES = [
    ['Lisboa', 38.7223, -9.1393], ['Porto', 41.1579, -8.6291], ['Braga', 41.5454, -8.4265], ['Coimbra', 40.2033, -8.4103],
    ['Leiria', 39.7436, -8.8071], ['Aveiro', 40.6405, -8.6538], ['Viseu', 40.6566, -7.9125], ['Guarda', 40.5373, -7.2676],
    ['Bragança', 41.8061, -6.7567], ['Castelo Branco', 39.8222, -7.4909], ['Évora', 38.5714, -7.9135], ['Beja', 38.0151, -7.8632],
    ['Faro', 37.0194, -7.9304], ['Funchal', 32.6669, -16.9241], ['Ponta Delgada', 37.7412, -25.6756],
  ];
  const PLANETS = [
    { id: 'mercury', name: 'Mercúrio', col: '#c9c3b8', hint: 'Sempre baixo e perto do horizonte, só no crepúsculo — o mais difícil de apanhar.' },
    { id: 'venus',   name: 'Vénus',    col: '#fff1bf', hint: 'Depois da Lua, é o ponto mais brilhante do céu. Impossível de confundir.' },
    { id: 'mars',    name: 'Marte',    col: '#ff8a5c', hint: 'Reconhece-se pela cor alaranjada, como uma brasa.' },
    { id: 'jupiter', name: 'Júpiter',  col: '#ffd9a6', hint: 'Muito brilhante e de luz firme — não cintila como as estrelas. Com binóculos vêem-se as luas.' },
    { id: 'saturn',  name: 'Saturno',  col: '#f0d48c', hint: 'Amarelado e calmo. Os anéis aparecem com um pequeno telescópio.' },
  ];
  /* Chuvas de estrelas anuais (datas típicas da IMO; o pico pode variar ±1 dia). */
  const SHOWERS = [
    { name: 'Quadrântidas',  from: [12, 28], to: [1, 12],  peak: [1, 3],   zhr: 110, note: 'Pico curto, de poucas horas.' },
    { name: 'Líridas',       from: [4, 14],  to: [4, 30],  peak: [4, 22],  zhr: 18 },
    { name: 'Eta Aquáridas', from: [4, 19],  to: [5, 28],  peak: [5, 6],   zhr: 50, note: 'Melhor antes do amanhecer; restos do cometa Halley.' },
    { name: 'Delta Aquáridas do Sul', from: [7, 12], to: [8, 23], peak: [7, 30], zhr: 25 },
    { name: 'Perseidas',     from: [7, 17],  to: [8, 24],  peak: [8, 12],  zhr: 100, note: 'A mais famosa do verão.' },
    { name: 'Dracónidas',    from: [10, 6],  to: [10, 10], peak: [10, 8],  zhr: 10, note: 'Atividade muito variável de ano para ano.' },
    { name: 'Oriónidas',     from: [10, 2],  to: [11, 7],  peak: [10, 21], zhr: 20, note: 'Também restos do cometa Halley.' },
    { name: 'Táuridas',      from: [9, 10],  to: [12, 10], peak: [11, 5],  zhr: 10, note: 'Lentas, com bolas de fogo ocasionais.' },
    { name: 'Leónidas',      from: [11, 6],  to: [11, 30], peak: [11, 17], zhr: 15 },
    { name: 'Gemínidas',     from: [12, 4],  to: [12, 20], peak: [12, 14], zhr: 150, note: 'A mais forte do ano — começa logo ao serão.' },
    { name: 'Úrsidas',       from: [12, 17], to: [12, 26], peak: [12, 22], zhr: 10 },
  ];
  const LIMITS = [['cidade', 'Cidade', 3.2], ['suburbio', 'Subúrbio', 4.2], ['campo', 'Campo', 5.0]];

  let _root = null, _wrap = null, _data = null, _loc = null;
  let _night = null, _t = null, _stars = null, _raf = 0, _playing = false, _timer = 0;
  let _opt = { lines: true, labels: true, limit: 'suburbio' };
  try { Object.assign(_opt, JSON.parse(localStorage.getItem('sky-opt')) || {}); } catch (e) {}

  /* ── utilitários ─────────────────────────────────────────────── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = (n, d = 0) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const hm = d => d ? d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—';
  const now = () => (typeof AppTime !== 'undefined' ? AppTime.now() : new Date());
  const DIRS = ['Norte', 'Nordeste', 'Este', 'Sudeste', 'Sul', 'Sudoeste', 'Oeste', 'Noroeste'];
  const DIRS_S = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const dir = az => DIRS[Math.round(az / 45) % 8];
  const dirS = az => DIRS_S[Math.round(az / 45) % 8];
  const height = alt => alt < 15 ? 'baixo no horizonte' : alt < 40 ? 'a meia altura' : alt < 70 ? 'bem alto' : 'quase por cima da cabeça';
  function dayLabel(d) {
    const n = now(), a = new Date(n.getFullYear(), n.getMonth(), n.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((b - a) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const longDate = d => d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

  function loadLoc() {
    for (const k of ['sky-loc', 'weather-loc']) {
      try { const w = JSON.parse(localStorage.getItem(k)); if (w && isFinite(w.lat) && isFinite(w.lon)) return { name: w.name || 'Local', lat: +w.lat, lon: +w.lon }; } catch (e) {}
    }
    return { name: 'Lisboa', lat: 38.7223, lon: -9.1393 };
  }
  const saveOpt = () => { try { localStorage.setItem('sky-opt', JSON.stringify(_opt)); } catch (e) {} };

  /* ── dados ───────────────────────────────────────────────────── */
  async function loadData() {
    if (_data) return _data;
    const r = await fetch('data/sky/stars.json');
    if (!r.ok) throw new Error('stars.json');
    _data = await r.json();
    return _data;
  }
  /* estrelas precessadas para a data (uma vez por sessão chega: 26 anos dão 0,36°) */
  function prepStars() {
    if (_stars) return _stars;
    const d = now();
    _stars = _data.stars.map(([ra, dec, mag, k, con], i) => {
      const p = A().precess(ra, dec, d);
      return { i, ra: p.ra, dec: p.dec, mag, k, con, name: _data.names[i] || null };
    });
    return _stars;
  }

  /* ── shell ───────────────────────────────────────────────────── */
  function shell() {
    _wrap.innerHTML = `
      <div class="sk-inner">
        <header class="sk-head">
          <div>
            <h1>O céu desta noite</h1>
            <p id="sk-sub"></p>
          </div>
          <div class="sk-loc">
            <label class="sr-only" for="sk-city">Local</label>
            <select id="sk-city" class="sk-select">
              ${CITIES.map(([n]) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
              <option value="__geo">📍 A minha localização</option>
            </select>
          </div>
        </header>
        <div class="sk-top">
          <section class="sk-card" id="sk-night"></section>
          <section class="sk-card" id="sk-moon"></section>
          <section class="sk-card" id="sk-clouds"></section>
        </div>
        <div class="sk-main">
          <section class="sk-card sk-mapcard">
            <div class="sk-card-hd">
              <h2>Mapa do céu</h2>
              <div class="sk-toggles">
                <button class="chip${_opt.lines ? ' active' : ''}" data-opt="lines" aria-pressed="${_opt.lines}">Constelações</button>
                <button class="chip${_opt.labels ? ' active' : ''}" data-opt="labels" aria-pressed="${_opt.labels}">Nomes</button>
                <span class="sk-seg" role="group" aria-label="Céu escuro">
                  ${LIMITS.map(([id, l]) => `<button class="chip${_opt.limit === id ? ' active' : ''}" data-lim="${id}" aria-pressed="${_opt.limit === id}">${l}</button>`).join('')}
                </span>
              </div>
            </div>
            <div class="sk-chart" id="sk-chart"></div>
            <div class="sk-time">
              <button class="btn btn-sm" id="sk-play" aria-label="Animar a noite">▶</button>
              <input type="range" id="sk-slider" min="0" max="100" step="1" aria-label="Hora no mapa">
              <output id="sk-tlabel"></output>
              <button class="btn btn-sm" id="sk-now">Agora</button>
            </div>
            <p class="sk-help">Segura o mapa por cima da cabeça com o <strong>Norte</strong> para cima: o centro é o ponto mesmo por cima de ti e a borda é o horizonte. Por isso o Este fica à esquerda. Passa o rato ou toca num ponto para saber o que é.</p>
          </section>
          <section class="sk-card sk-planets" id="sk-planets"></section>
        </div>
        <section class="sk-card" id="sk-iss"></section>
        <section class="sk-card" id="sk-month"></section>
        <section class="sk-tips">
          <h2>Dicas para observar</h2>
          <ul>
            <li><strong>Dá 20 minutos aos olhos.</strong> É o tempo que demoram a habituar-se ao escuro — e um ecrã de telemóvel desfaz tudo num segundo.</li>
            <li><strong>Planetas não cintilam.</strong> Se um "estrela" brilhante tem luz firme, provavelmente é um planeta.</li>
            <li><strong>Binóculos chegam para muito:</strong> as crateras da Lua, as luas de Júpiter e as Plêiades.</li>
            <li><strong>A ISS não pisca</strong> e atravessa o céu em poucos minutos, sem luzes coloridas — se piscar, é um avião.</li>
          </ul>
        </section>
      </div>`;

    const sel = _wrap.querySelector('#sk-city');
    const match = CITIES.find(([n]) => n === _loc.name);
    if (match) sel.value = match[0];
    else { sel.insertAdjacentHTML('afterbegin', `<option value="__cur">${esc(_loc.name)}</option>`); sel.value = '__cur'; }
    sel.addEventListener('change', () => {
      if (sel.value === '__geo') return geolocate(sel);
      const c = CITIES.find(([n]) => n === sel.value);
      if (c) setLoc({ name: c[0], lat: c[1], lon: c[2] });
    });

    _wrap.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.opt; _opt[k] = !_opt[k]; saveOpt();
      b.classList.toggle('active', _opt[k]); b.setAttribute('aria-pressed', _opt[k]);
      drawChart();
    }));
    _wrap.querySelectorAll('[data-lim]').forEach(b => b.addEventListener('click', () => {
      _opt.limit = b.dataset.lim; saveOpt();
      _wrap.querySelectorAll('[data-lim]').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); });
      drawChart();
    }));
    const sl = _wrap.querySelector('#sk-slider');
    sl.addEventListener('input', () => { stopPlay(); _t = sliderToTime(+sl.value); drawChart(); });
    _wrap.querySelector('#sk-now').addEventListener('click', () => { stopPlay(); _t = defaultTime(); syncSlider(); drawChart(); });
    _wrap.querySelector('#sk-play').addEventListener('click', () => (_playing ? stopPlay() : startPlay()));
  }

  function geolocate(sel) {
    if (!navigator.geolocation) { sel.value = CITIES[0][0]; return; }
    sel.disabled = true;
    navigator.geolocation.getCurrentPosition(p => {
      sel.disabled = false;
      setLoc({ name: 'A tua localização', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) });
    }, () => {
      sel.disabled = false;
      const c = CITIES.find(([n]) => n === _loc.name);
      sel.value = c ? c[0] : (sel.querySelector('option[value="__cur"]') ? '__cur' : CITIES[0][0]);
    }, { timeout: 10000, maximumAge: 3600000 });
  }

  function setLoc(loc) {
    _loc = loc;
    try { localStorage.setItem('sky-loc', JSON.stringify(loc)); } catch (e) {}
    shell();
    computeAll();
  }

  /* ── régua de tempo: do pôr do sol ao nascer ─────────────────── */
  function span() {
    const n = _night;
    const a = n.sunset ? new Date(n.sunset.getTime() - 30 * 60000) : new Date(n.from.getTime() + 6 * 3600000);
    const b = n.sunrise ? new Date(n.sunrise.getTime() + 30 * 60000) : new Date(n.to.getTime() - 4 * 3600000);
    return [a, b];
  }
  const sliderToTime = v => { const [a, b] = span(); return new Date(a.getTime() + (b - a) * v / 100); };
  function syncSlider() {
    const [a, b] = span(), sl = _wrap.querySelector('#sk-slider');
    const v = Math.max(0, Math.min(100, (_t - a) / (b - a) * 100));
    sl.value = v;
  }
  /* "agora" se já for noite; de dia, a primeira hora de noite escura */
  function defaultTime() {
    const n = now(), [a, b] = span();
    if (n >= a && n <= b) return n;
    const dark = _night.civilEnd || _night.sunset;
    return dark ? new Date(dark.getTime() + 60 * 60000) : a;
  }
  function startPlay() {
    if (_playing) return;
    _playing = true;
    _wrap.querySelector('#sk-play').textContent = '⏸';
    const sl = _wrap.querySelector('#sk-slider');
    if (+sl.value >= 99.5) { sl.value = 0; }
    let last = 0;
    const tick = ts => {
      if (!_playing) return;
      if (ts - last > 45) {
        last = ts;
        const v = +sl.value + 0.25;
        if (v > 100) { stopPlay(); return; }
        sl.value = v; _t = sliderToTime(v); drawChart();
      }
      _raf = requestAnimationFrame(tick);
    };
    _raf = requestAnimationFrame(tick);
  }
  function stopPlay() {
    _playing = false; if (_raf) cancelAnimationFrame(_raf); _raf = 0;
    const b = _wrap && _wrap.querySelector('#sk-play'); if (b) b.textContent = '▶';
  }

  /* ── cálculo de tudo para a noite ────────────────────────────── */
  let _planetInfo = null, _moonInfo = null;
  function computeAll() {
    const n = now(), { lat, lon } = _loc;
    _night = A().nightInfo(n, lat, lon);
    _t = defaultTime();
    _wrap.querySelector('#sk-sub').textContent = `${longDate(_night.from).replace(/^./, c => c.toUpperCase())} à noite · visto de ${_loc.name}`;
    renderNight();
    _moonInfo = moonInfo();
    renderMoon();
    _planetInfo = PLANETS.map(planetInfo);
    renderPlanets();
    syncSlider();
    drawChart();
    renderMonth();
    loadClouds();
    loadISS();
  }

  function renderNight() {
    const n = _night;
    _wrap.querySelector('#sk-night').innerHTML = `
      <div class="sk-kicker">🌇 Esta noite</div>
      <ul class="sk-times">
        <li><span>Pôr do sol</span><b>${hm(n.sunset)}</b></li>
        <li><span>Fim do crepúsculo</span><b>${hm(n.civilEnd)}</b></li>
        <li class="sk-dark"><span>Noite escura</span><b>${n.darkStart && n.darkEnd ? `${hm(n.darkStart)} – ${hm(n.darkEnd)}` : 'não chega a escurecer'}</b></li>
        <li><span>Nascer do sol</span><b>${hm(n.sunrise)}</b></li>
      </ul>
      <p class="sk-small">${n.darkStart && n.darkEnd ? `${nf((n.darkEnd - n.darkStart) / 3600000, 1)} horas de céu realmente escuro.` : ''}</p>`;
  }

  /* ── Lua ─────────────────────────────────────────────────────── */
  const PHASES = [[6, 'Lua Nova'], [84, 'Lua Crescente'], [96, 'Quarto Crescente'], [174, 'Crescente Gibosa'], [186, 'Lua Cheia'], [264, 'Minguante Gibosa'], [276, 'Quarto Minguante'], [354, 'Lua Minguante'], [361, 'Lua Nova']];
  const phaseName = e => PHASES.find(([lim]) => e < lim)[1];
  function moonSVG(illum, waxing, size = 92) {
    const r = 40, k = illum, rx = r * Math.abs(2 * k - 1);
    const sweep = k < 0.5 ? 0 : 1;
    const lit = k < 0.02 ? '' : k > 0.98 ? `<circle r="${r}" fill="url(#skmoon)"/>`
      : `<path d="M0,${-r} A${r},${r} 0 0 1 0,${r} A${rx},${r} 0 0 ${sweep} 0,${-r}Z" fill="url(#skmoon)"/>`;
    return `<svg viewBox="-46 -46 92 92" width="${size}" height="${size}" aria-hidden="true">
      <defs><radialGradient id="skmoon" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#fffbe9"/><stop offset="1" stop-color="#d9d2b8"/></radialGradient></defs>
      <circle r="${r}" fill="#1b2232" stroke="rgba(255,255,255,.08)"/>
      <g${waxing ? '' : ' transform="scale(-1,1)"'}>${lit}</g>
    </svg>`;
  }
  function moonInfo() {
    const { lat, lon } = _loc, t = _t;
    const m = A().moon(t, lat, lon);
    const rs = A().riseSet(A().moonAlt(lat, lon), _night.from, _night.to, 0.125);
    const n = now();
    const next = [[0, 'Lua Nova'], [90, 'Quarto Crescente'], [180, 'Lua Cheia'], [270, 'Quarto Minguante']]
      .map(([tg, name]) => ({ name, t: A().nextPhase(n, tg) })).filter(x => x.t).sort((a, b) => a.t - b.t);
    return { m, rs, next };
  }
  function renderMoon() {
    const { m, rs, next } = _moonInfo;
    const name = phaseName(m.elong);
    const ev = [rs.rise && { k: 'Nasce', t: rs.rise }, rs.set && { k: 'Põe-se', t: rs.set }].filter(Boolean).sort((a, b) => a.t - b.t);
    _wrap.querySelector('#sk-moon').innerHTML = `
      <div class="sk-kicker">🌙 A Lua</div>
      <div class="sk-moon">
        ${moonSVG(m.illum, m.waxing)}
        <div>
          <div class="sk-big">${name}</div>
          <div class="sk-small">${nf(m.illum * 100)}% iluminada · a ${nf(m.distKm)} km</div>
          <ul class="sk-times sk-times-tight">${ev.map(e => `<li><span>${e.k}</span><b>${dayLabel(e.t) === 'Hoje' ? '' : dayLabel(e.t).toLowerCase() + ' '}${hm(e.t)}</b></li>`).join('') || '<li><span>Não nasce nem se põe esta noite</span></li>'}</ul>
        </div>
      </div>
      <ul class="sk-phases">${next.map(x => `<li><span>${x.name}</span><b>${x.t.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</b></li>`).join('')}</ul>`;
  }

  /* ── planetas ────────────────────────────────────────────────── */
  function nearestCon(ra, dec) {
    let best = null, bd = 1e9;
    for (const s of prepStars()) {
      if (s.mag > 4.5) continue;
      const d = Math.acos(Math.min(1, Math.sin(dec * A().D2R) * Math.sin(s.dec * A().D2R) + Math.cos(dec * A().D2R) * Math.cos(s.dec * A().D2R) * Math.cos((ra - s.ra) * A().D2R)));
      if (d < bd) { bd = d; best = s; }
    }
    return best ? (_data.cons[best.con] || best.con) : '';
  }
  function planetInfo(P) {
    const { lat, lon } = _loc, S = A();
    const [a, b] = [_night.sunset || _night.from, _night.sunrise || _night.to];
    let vis = null, best = null;
    for (let t = a.getTime(); t <= b.getTime(); t += 10 * 60000) {
      const d = new Date(t), p = S.planet(P.id, d), h = S.toHorizon(p.ra, p.dec, lat, lon, d);
      const sAlt = S.sunAlt(lat, lon)(d);
      /* Mercúrio e Vénus vêem-se no crepúsculo — exigir noite escura escondia-os */
      const ok = h.alt > 5 && sAlt < (P.id === 'mercury' || P.id === 'venus' ? -3 : -8);
      if (ok) {
        vis = vis || { from: d }; vis.to = d;
        if (!best || h.alt > best.alt) best = { t: d, alt: h.alt, az: h.az };
      }
    }
    const mid = best ? best.t : _t;
    const p = S.planet(P.id, mid), s = S.sun(mid);
    const elong = Math.acos(Math.sin(p.dec * S.D2R) * Math.sin(s.dec * S.D2R) + Math.cos(p.dec * S.D2R) * Math.cos(s.dec * S.D2R) * Math.cos((p.ra - s.ra) * S.D2R)) * S.R2D;
    return { ...P, vis, best, mag: p.mag, elong, con: nearestCon(p.ra, p.dec), distAU: p.dist };
  }
  const brightWord = m => m < -3 ? 'brilhantíssimo' : m < -1 ? 'muito brilhante' : m < 0.5 ? 'brilhante' : m < 2 ? 'visível a olho nu' : 'fraco';
  function renderPlanets() {
    const list = _planetInfo;
    const visN = list.filter(p => p.vis).length;
    _wrap.querySelector('#sk-planets').innerHTML = `
      <div class="sk-card-hd"><h2>Planetas</h2><span class="sk-small">${visN ? `${visN} visíve${visN === 1 ? 'l' : 'is'} esta noite` : 'Nenhum visível esta noite'}</span></div>
      <ul class="sk-plist">
        ${list.map(p => `
          <li class="${p.vis ? 'on' : 'off'}">
            <button class="sk-pbtn" data-planet="${p.id}" ${p.best ? '' : 'disabled'} title="${p.best ? 'Mostrar no mapa à melhor hora' : ''}">
              <span class="sk-pdot" style="--c:${p.col}"></span>
              <span class="sk-pbody">
                <span class="sk-pname">${p.name} <small>${p.vis ? brightWord(p.mag) : ''}</small></span>
                ${p.vis
                  ? `<span class="sk-pline">${p.vis.to - p.vis.from < 25 * 60000
                      ? `Só por volta das ${hm(p.best.t)}${p.best.t.getHours() < 12 ? ', pouco antes do nascer do sol' : ', logo depois do pôr do sol'}, ${height(p.best.alt)}, a <b>${dir(p.best.az)}</b>`
                      : `Das ${hm(p.vis.from)} às ${hm(p.vis.to)} · melhor às ${hm(p.best.t)}, ${height(p.best.alt)}, a <b>${dir(p.best.az)}</b>`}</span>
                     <span class="sk-pline sk-muted">Em ${esc(p.con)} · magnitude ${nf(p.mag, 1)}</span>`
                  : `<span class="sk-pline sk-muted">${p.elong < 15 ? 'Demasiado perto do Sol — perde-se no brilho dele.' : 'Só está acima do horizonte de dia.'}</span>`}
              </span>
            </button>
            ${p.vis ? `<p class="sk-phint">${esc(p.hint)}</p>` : ''}
          </li>`).join('')}
      </ul>`;
    _wrap.querySelectorAll('.sk-pbtn[data-planet]').forEach(b => b.addEventListener('click', () => {
      const p = _planetInfo.find(x => x.id === b.dataset.planet);
      if (!p || !p.best) return;
      stopPlay(); _t = p.best.t; _focus = p.id; syncSlider(); drawChart();
      _wrap.querySelector('#sk-chart').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  }

  /* ── mapa do céu (SVG) ───────────────────────────────────────── */
  let _focus = null, _objs = [];
  const SZ = 640, CX = 320, CY = 320, R = 300;
  function proj(alt, az) {
    const r = R * (90 - alt) / 90;
    return [CX - r * Math.sin(az * Math.PI / 180), CY - r * Math.cos(az * Math.PI / 180)];
  }
  function starCol(k) { return k >= 100 ? '#c9dcff' : k >= 75 ? '#e9f0ff' : k >= 60 ? '#fff8ea' : k >= 50 ? '#ffe6bf' : k >= 40 ? '#ffcf9a' : '#ffb27a'; }
  function skyFill(sunAlt) {
    if (sunAlt > 0) return ['#3d6fb0', '#87b3e6'];
    if (sunAlt > -6) return ['#1d3358', '#5b6f97'];
    if (sunAlt > -12) return ['#0f1b33', '#28385a'];
    if (sunAlt > -18) return ['#0a1224', '#152039'];
    return ['#060b17', '#0c1426'];
  }

  function drawChart() {
    const host = _wrap && _wrap.querySelector('#sk-chart');
    if (!host || !_data) return;
    const S = A(), { lat, lon } = _loc, t = _t;
    const lim = (LIMITS.find(l => l[0] === _opt.limit) || LIMITS[1])[2];
    const sAlt = S.sunAlt(lat, lon)(t);
    const [c1, c2] = skyFill(sAlt);
    _objs = [];
    const H = (ra, dec) => S.toHorizon(ra, dec, lat, lon, t);

    let g = '';
    /* grelha de altitude 30°/60° + linhas N-S/E-O */
    g += [30, 60].map(a => `<circle cx="${CX}" cy="${CY}" r="${R * (90 - a) / 90}" class="sk-alt"/>`).join('');
    g += `<line x1="${CX}" y1="${CY - R}" x2="${CX}" y2="${CY + R}" class="sk-alt"/><line x1="${CX - R}" y1="${CY}" x2="${CX + R}" y2="${CY}" class="sk-alt"/>`;

    const stars = prepStars();
    const hz = stars.map(s => H(s.ra, s.dec));

    /* constelações */
    if (_opt.lines) {
      let ln = '', lb = '';
      for (const [con, pairs] of Object.entries(_data.lines)) {
        const pts = [];
        for (const [i, j] of pairs) {
          if (hz[i].alt < -1 || hz[j].alt < -1) continue;
          const [x1, y1] = proj(Math.max(hz[i].alt, 0), hz[i].az), [x2, y2] = proj(Math.max(hz[j].alt, 0), hz[j].az);
          ln += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
          pts.push([x1, y1], [x2, y2]);
        }
        if (_opt.labels && pts.length >= 2) {
          const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
          lb += `<text x="${mx.toFixed(1)}" y="${(my + 16).toFixed(1)}" class="sk-con-lbl" text-anchor="middle">${esc(_data.cons[con] || con)}</text>`;
        }
      }
      g += `<path d="${ln}" class="sk-con"/>${lb}`;
    }

    /* objetos de céu profundo */
    for (const [ra, dec, name, kind] of _data.dso) {
      const p = S.precess(ra, dec, t), h = H(p.ra, p.dec);
      if (h.alt < 3) continue;
      const [x, y] = proj(h.alt, h.az);
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="sk-dso"/>`;
      _objs.push({ x, y, r: 7, title: name, sub: `${kind[0].toUpperCase() + kind.slice(1)} · ${dir(h.az)}, ${nf(h.alt)}° de altura` });
    }

    /* estrelas (as mais fracas primeiro, para as brilhantes ficarem por cima) */
    let st = '', names = '';
    for (let k = stars.length - 1; k >= 0; k--) {
      const s = stars[k], h = hz[k];
      if (h.alt < 0 || s.mag > lim) continue;
      const [x, y] = proj(h.alt, h.az);
      const r = Math.max(0.7, 3.9 - 0.72 * s.mag);
      st += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${starCol(s.k)}"/>`;
      if (s.mag < 3.5) _objs.push({ x, y, r: Math.max(5, r + 3), title: s.name || `Estrela de ${_data.cons[s.con] || s.con}`, sub: `${s.name ? `${_data.cons[s.con] || s.con} · ` : ''}magnitude ${nf(s.mag, 1)} · ${dir(h.az)}, ${nf(h.alt)}°` });
      if (_opt.labels && s.name && s.mag < 1.6) names += `<text x="${(x + r + 3).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" class="sk-star-lbl">${esc(s.name)}</text>`;
    }
    g += `<g class="sk-stars">${st}</g>${names}`;

    /* planetas */
    for (const P of PLANETS) {
      const p = S.planet(P.id, t), h = H(p.ra, p.dec);
      if (h.alt < -0.5) continue;
      const [x, y] = proj(Math.max(0, h.alt), h.az);
      const r = Math.max(3, 5.5 - 0.6 * p.mag);
      const foc = _focus === P.id;
      g += `${foc ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 9}" class="sk-focus"/>` : ''}
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${P.col}" class="sk-planet"/>
        <text x="${(x + r + 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" class="sk-pl-lbl">${P.name}</text>`;
      _objs.push({ x, y, r: r + 6, title: P.name, sub: `Planeta · ${brightWord(p.mag)} (mag ${nf(p.mag, 1)}) · ${dir(h.az)}, ${nf(h.alt)}° de altura` });
    }

    /* Lua */
    const m = S.moon(t, lat, lon), mh = H(m.ra, m.dec);
    if (mh.alt > -0.5) {
      const [x, y] = proj(Math.max(0, mh.alt), mh.az);
      g += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(.28)" class="sk-moon-g">${moonSVG(m.illum, m.waxing).replace(/<svg[^>]*>|<\/svg>/g, '').replace('id="skmoon"', 'id="skmoon2"').replace(/url\(#skmoon\)/g, 'url(#skmoon2)')}</g>
        <text x="${(x + 15).toFixed(1)}" y="${(y + 4).toFixed(1)}" class="sk-pl-lbl">Lua</text>`;
      _objs.push({ x, y, r: 14, title: 'Lua', sub: `${phaseName(m.elong)}, ${nf(m.illum * 100)}% iluminada · ${dir(mh.az)}, ${nf(mh.alt)}°` });
    }
    /* Sol (só se estiver acima do horizonte) */
    const s = S.sun(t), sh = H(s.ra, s.dec);
    if (sh.alt > -0.5) {
      const [x, y] = proj(Math.max(0, sh.alt), sh.az);
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="#ffd34d" class="sk-sun"/>`;
      _objs.push({ x, y, r: 14, title: 'Sol', sub: 'Nunca olhes diretamente para o Sol.' });
    }

    /* pontos cardeais */
    const card = DIRS_S.map((d, i) => {
      const [x, y] = proj(-6.5, i * 45);
      return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="sk-card-lbl${i % 2 ? ' minor' : ''}" text-anchor="middle">${d}</text>`;
    }).join('');

    host.innerHTML = `
      <svg viewBox="-24 -24 ${SZ + 48} ${SZ + 48}" role="img" aria-label="Mapa do céu às ${hm(t)}">
        <defs>
          <radialGradient id="sk-bg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
          <clipPath id="sk-clip"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
        </defs>
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#sk-bg)"/>
        <g clip-path="url(#sk-clip)">${g}</g>
        <circle cx="${CX}" cy="${CY}" r="${R}" class="sk-horizon"/>
        ${card}
      </svg>
      <div class="sk-tip" hidden></div>`;
    _wrap.querySelector('#sk-tlabel').textContent = `${dayLabel(t)} · ${hm(t)}`;
    wireTip(host);
  }

  function wireTip(host) {
    const svg = host.querySelector('svg'), tip = host.querySelector('.sk-tip');
    const pick = e => {
      const r = svg.getBoundingClientRect();
      const k = (SZ + 48) / r.width;
      const x = (e.clientX - r.left) * k - 24, y = (e.clientY - r.top) * k - 24;
      let best = null, bd = 1e9;
      for (const o of _objs) { const d = Math.hypot(o.x - x, o.y - y); if (d < o.r * 1.4 && d < bd) { bd = d; best = o; } }
      if (!best) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(best.title)}</b><span>${esc(best.sub)}</span>`;
      const px = (best.x + 24) / k, py = (best.y + 24) / k;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 6, Math.max(6, px + 14)) + 'px';
      tip.style.top = Math.max(6, py - tip.offsetHeight - 10) + 'px';
    };
    svg.addEventListener('pointermove', pick);
    svg.addEventListener('pointerdown', pick);
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tip.hidden = true; });
  }

  /* ── nuvens (Open-Meteo) ─────────────────────────────────────── */
  async function loadClouds() {
    const el = _wrap.querySelector('#sk-clouds');
    el.innerHTML = `<div class="sk-kicker">☁️ Nuvens</div><p class="sk-small">A ver a previsão…</p>`;
    const { lat, lon } = _loc, key = `sky-clouds:${lat},${lon}`;
    let d = null;
    try { const c = JSON.parse(sessionStorage.getItem(key)); if (c && Date.now() - c.t < 3600000) d = c.d; } catch (e) {}
    if (!d) {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloud_cover&timezone=auto&forecast_days=3`);
        if (!r.ok) throw new Error(r.status);
        d = await r.json();
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
      } catch (e) {
        el.innerHTML = `<div class="sk-kicker">☁️ Nuvens</div><p class="sk-small">Não foi possível obter a previsão de nuvens agora.</p>`;
        return;
      }
    }
    if (!_wrap.contains(el)) return;
    /* As horas vêm no fuso do local; o offset da resposta converte-as para instantes reais. */
    const off = (d.utc_offset_seconds || 0) * 1000;
    const hours = (d.hourly.time || []).map((s, i) => ({ t: new Date(Date.parse(s + 'Z') - off), c: d.hourly.cloud_cover[i] }));
    const [a, b] = [_night.sunset || _night.from, _night.sunrise || _night.to];
    const night = hours.filter(h => h.t >= new Date(a.getTime() - 3600000) && h.t <= b);
    if (!night.length) { el.innerHTML = `<div class="sk-kicker">☁️ Nuvens</div><p class="sk-small">Sem previsão para esta noite.</p>`; return; }
    const avg = night.reduce((s, h) => s + h.c, 0) / night.length;
    const verdict = avg < 25 ? ['😍', 'Céu limpo', 'Ótima noite para observar.'] : avg < 60 ? ['🌤️', 'Nuvens a passar', 'Vai haver abertas — escolhe as horas com barras baixas.'] : ['☁️', 'Muito nublado', 'Pouco se vai ver. Talvez noutra noite.'];
    el.innerHTML = `
      <div class="sk-kicker">☁️ Nuvens esta noite</div>
      <div class="sk-verdict"><span>${verdict[0]}</span><div><div class="sk-big">${verdict[1]}</div><div class="sk-small">${verdict[2]} Média de ${nf(avg)}% de céu coberto.</div></div></div>
      <div class="sk-cloudbars" role="img" aria-label="Nebulosidade por hora">
        ${night.map(h => `<div class="sk-cb" title="${hm(h.t)}: ${h.c}% coberto"><i style="height:${Math.max(4, h.c)}%;"></i><small>${h.t.getHours()}h</small></div>`).join('')}
      </div>
      <p class="sk-src">Previsão: Open-Meteo</p>`;
  }

  /* ── ISS ─────────────────────────────────────────────────────── */
  async function getTLE() {
    try { const c = JSON.parse(localStorage.getItem('sky-iss-tle')); if (c && Date.now() - c.t < 12 * 3600000) return c; } catch (e) {}
    const r = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE');
    if (!r.ok) throw new Error(r.status);
    const lines = (await r.text()).trim().split(/\r?\n/).map(s => s.trimEnd());
    const l1 = lines.find(l => l.startsWith('1 ')), l2 = lines.find(l => l.startsWith('2 '));
    if (!l1 || !l2) throw new Error('TLE');
    const c = { t: Date.now(), l1, l2 };
    try { localStorage.setItem('sky-iss-tle', JSON.stringify(c)); } catch (e) {}
    return c;
  }
  async function loadISS() {
    const el = _wrap.querySelector('#sk-iss');
    el.innerHTML = `<div class="sk-card-hd"><h2>🛰️ Estação Espacial Internacional</h2></div><p class="sk-small">A calcular as passagens…</p>`;
    let tle;
    try { tle = await getTLE(); } catch (e) {
      el.innerHTML = `<div class="sk-card-hd"><h2>🛰️ Estação Espacial Internacional</h2></div><p class="sk-small">Não foi possível obter a órbita da ISS agora (CelesTrak). Tenta mais tarde.</p>`;
      return;
    }
    if (!_wrap.contains(el)) return;
    /* deixa o resto da página pintar antes das contas (~50 ms) */
    await new Promise(r => setTimeout(r, 30));
    const S = A(), s = S.parseTLE(tle.l1, tle.l2), { lat, lon } = _loc;
    const list = S.passes(s, lat, lon, now(), 5).slice(0, 6);
    const sp = S.subPoint(s, now());
    const coord = (v, p, n) => `${nf(Math.abs(v), 1)}° ${v >= 0 ? p : n}`;
    el.innerHTML = `
      <div class="sk-card-hd"><h2>🛰️ Estação Espacial Internacional</h2>
        <span class="sk-small">Agora sobre ${coord(sp.lat, 'N', 'S')}, ${coord(sp.lon, 'E', 'O')} · a ${nf(sp.altKm)} km de altura</span></div>
      <p class="sk-lead">A ISS dá uma volta à Terra a cada hora e meia. Só se vê quando está iluminada pelo Sol e tu estás no escuro — por isso aparece pouco depois do pôr do sol ou antes do nascer. Parece uma estrela brilhante a atravessar o céu, sem piscar.</p>
      ${list.length ? `
      <ul class="sk-passes">
        ${list.map(p => {
          const dur = Math.max(1, Math.round((p.visEnd - p.visStart) / 60000));
          const great = p.max >= 45;
          return `<li class="${great ? 'great' : ''}">
            <div class="sk-pass-when"><b>${dayLabel(p.visStart)}</b><span>${hm(p.visStart)}</span></div>
            <div class="sk-pass-body">
              <div>Aparece a <b>${dir(p.visStartAz)}</b> e ${p.visEnd < p.end ? 'desaparece na sombra da Terra' : 'põe-se'} a <b>${dir(p.visEndAz)}</b></div>
              <div class="sk-muted">${dur} min visível · sobe até ${nf(p.max)}° ${great ? '· passagem excelente ⭐' : p.max < 25 ? '· baixa no horizonte' : ''}</div>
            </div>
            <div class="sk-pass-arc" aria-hidden="true">${arcSVG(p)}</div>
          </li>`;
        }).join('')}
      </ul>` : `<p class="sk-empty">Nenhuma passagem visível nos próximos 5 dias a partir de ${esc(_loc.name)} — nestes dias a ISS passa de dia ou dentro da sombra da Terra.</p>`}
      <p class="sk-src">Órbita: CelesTrak (elementos de ${s.epoch.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}) · horas calculadas aqui, com precisão de cerca de um minuto.</p>`;
  }
  /* mini-diagrama da passagem (de onde para onde, e a altura máxima) */
  function arcSVG(p) {
    const P = (alt, az) => { const r = 26 * (90 - alt) / 90; return [30 - r * Math.sin(az * Math.PI / 180), 30 - r * Math.cos(az * Math.PI / 180)]; };
    const [x1, y1] = P(Math.max(0, 10), p.visStartAz), [x2, y2] = P(Math.max(0, 10), p.visEndAz), [xm, ym] = P(p.max, p.maxAz);
    return `<svg viewBox="0 0 60 60" width="56" height="56"><circle cx="30" cy="30" r="26" class="sk-arc-h"/>
      <path d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${(2 * xm - (x1 + x2) / 2).toFixed(1)},${(2 * ym - (y1 + y2) / 2).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" class="sk-arc"/>
      <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="2.4" class="sk-arc-end"/><text x="30" y="8" class="sk-arc-n" text-anchor="middle">N</text></svg>`;
  }

  /* ── este mês no céu ─────────────────────────────────────────── */
  function renderMonth() {
    const n = now(), y = n.getFullYear(), S = A(), { lat, lon } = _loc;
    const dt = (yy, [m, d]) => new Date(yy, m - 1, d);
    const rows = [];
    for (const sh of SHOWERS) {
      for (const yy of [y - 1, y, y + 1]) {
        const from = dt(yy, sh.from), to = dt(sh.to[0] < sh.from[0] ? yy + 1 : yy, sh.to);
        const peak = dt(sh.peak[0] < sh.from[0] ? yy + 1 : yy, sh.peak);
        const end = new Date(to.getTime() + 86400000);
        const days = (from - n) / 86400000;
        if (n >= from && n < end) rows.push({ sh, from, to, peak, active: true });
        else if (days > 0 && days < 45) rows.push({ sh, from, to, peak, active: false });
      }
    }
    rows.sort((a, b) => a.peak - b.peak);
    const moonAt = d => S.moon(new Date(d.getTime() + 2 * 3600000 + 86400000 * 0), lat, lon).illum;
    const fm = d => d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
    _wrap.querySelector('#sk-month').innerHTML = `
      <div class="sk-card-hd"><h2>☄️ Chuvas de estrelas</h2><span class="sk-small">Ativas agora e nas próximas semanas</span></div>
      ${rows.length ? `<ul class="sk-showers">
        ${rows.map(r => {
          const mi = moonAt(r.peak);
          const peakPast = r.peak < new Date(n.getFullYear(), n.getMonth(), n.getDate());
          return `<li class="${r.active ? 'on' : ''}">
            <div class="sk-sh-name"><b>${r.sh.name}</b>${r.active ? '<span class="sk-badge">ativa</span>' : ''}</div>
            <div class="sk-sh-line">Pico ${peakPast ? 'foi a' : 'a'} <b>${fm(r.peak)}</b> · ativa de ${fm(r.from)} a ${fm(r.to)} · até ~${r.sh.zhr} meteoros/hora em céu perfeito</div>
            <div class="sk-sh-line sk-muted">${mi > 0.6 ? `🌕 A Lua estará ${nf(mi * 100)}% iluminada no pico e vai apagar os meteoros mais fracos.` : mi < 0.3 ? `🌑 Lua discreta no pico (${nf(mi * 100)}%) — boas condições.` : `🌓 Lua a ${nf(mi * 100)}% no pico.`}${r.sh.note ? ' ' + esc(r.sh.note) : ''}</div>
          </li>`;
        }).join('')}
      </ul>` : '<p class="sk-empty">Nenhuma chuva de estrelas importante nas próximas semanas.</p>'}
      <p class="sk-src">Contagens por hora são o máximo teórico com o radiante por cima da cabeça e céu muito escuro; na prática vê-se bem menos.</p>`;
  }

  /* ── ciclo de vida ───────────────────────────────────────────── */
  async function mount(sub) {
    _root = sub;
    sub.innerHTML = `<div class="sk-wrap"><div class="sk-loading">A preparar o céu…</div></div>`;
    _wrap = sub.querySelector('.sk-wrap');
    _loc = loadLoc();
    try { await loadData(); } catch (e) {
      _wrap.innerHTML = `<div class="empty-state"><div class="es-title">Não foi possível carregar o catálogo de estrelas</div><div class="es-hint">Verifica a ligação e volta a abrir este separador.</div></div>`;
      return;
    }
    shell();
    computeAll();
    /* o mapa segue o relógio enquanto estiver em "agora" */
    clearInterval(_timer);
    _timer = setInterval(() => {
      if (!_wrap || !_wrap.isConnected || _playing) return;
      const n = now();
      if (Math.abs(_t - n) < 5 * 60000 + 60000) { _t = n; syncSlider(); drawChart(); }
    }, 60000);
  }
  function resume() {
    if (!_wrap || !_data) return;
    /* noite nova (voltou-se ao separador noutro dia) → recalcula tudo */
    if (now() > _night.to) computeAll();
  }
  function stop() { stopPlay(); }

  return { mount, resume, stop };
})();
