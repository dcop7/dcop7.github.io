/* ══════════════════════════════════════════════════════════════════
   EXPLORER PAGE — World Map, Canvas Globe, Solar System hub
══════════════════════════════════════════════════════════════════ */
const ExplorerPage = (function () {
  'use strict';

  /* ── Data ── */
  let _countries  = [];
  let _geoJson    = null;
  let _favorites  = [];
  let _recent     = [];
  let _dataLoaded = false;
  let _dataLoading = null;

  /* ── Globe state (module-level so projection helpers can read them) ── */
  let _gRotX     = 0.3;
  let _gRotY     = 0;
  let _gRotYVel  = 0.0015;
  let _gPolygons = [];  // [{ cca3, rings: [[[lon,lat]]] }]
  let _gHovered  = null;
  let _gRaf      = null;
  let _gCanvas   = null;
  let _gInited   = false;

  /* ── Leaflet state ── */
  let _lMap      = null;
  let _lLayer    = null;
  let _contFilter = 'all';
  let _lInited   = false;

  /* ── Constants ── */
  const TTL = 86400000; // 24 h
  const COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,flag,capital,population,currencies,languages,area,continents,flags,timezones,borders';
  const GEOJSON_URL   = 'https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json';

  /* ════════════════════════════════ STORAGE ════════════════════════ */
  function _loadStorage() {
    try {
      _favorites = JSON.parse(localStorage.getItem('ex-faves')  || '[]');
      _recent    = JSON.parse(localStorage.getItem('ex-recent') || '[]');
    } catch (e) { _favorites = []; _recent = []; }
  }
  function _saveFaves()  { try { localStorage.setItem('ex-faves',  JSON.stringify(_favorites)); } catch (e) {} }
  function _saveRecent() { try { localStorage.setItem('ex-recent', JSON.stringify(_recent));    } catch (e) {} }

  function _addRecent(cca3) {
    _recent = _recent.filter(x => x !== cca3);
    _recent.unshift(cca3);
    _recent = _recent.slice(0, 12);
    _saveRecent();
  }

  function _toggleFave(cca3, panel) {
    const idx = _favorites.indexOf(cca3);
    if (idx >= 0) _favorites.splice(idx, 1); else _favorites.unshift(cca3);
    _saveFaves();
    const btn = panel?.querySelector('#ex-fave-btn');
    if (!btn) return;
    const on = _favorites.includes(cca3);
    btn.classList.toggle('active', on);
    btn.innerHTML = `<span class="ex-fave-btn-icon">${on ? '❤' : '🤍'}</span> ${on ? 'Guardado' : 'Favorito'}`;
  }

  /* ════════════════════════════════ DATA FETCH ══════════════════════ */
  async function _fetchCountries() {
    try {
      const raw = localStorage.getItem('ex-countries');
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < TTL) return data;
      }
    } catch (e) {}
    const r    = await fetch(COUNTRIES_URL);
    const data = await r.json();
    try { localStorage.setItem('ex-countries', JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    return data;
  }

  async function _fetchGeoJson() {
    try {
      const raw = sessionStorage.getItem('ex-geojson');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const r    = await fetch(GEOJSON_URL);
    const data = await r.json();
    try { sessionStorage.setItem('ex-geojson', JSON.stringify(data)); } catch (e) {}
    return data;
  }

  async function _fetchWiki(name) {
    try {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
      const d = await r.json();
      return d.extract || null;
    } catch (e) { return null; }
  }

  async function _loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      const link   = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
      const script = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      script.onload  = resolve;
      script.onerror = reject;
      document.head.appendChild(link);
      document.head.appendChild(script);
    });
  }

  async function _ensureData() {
    if (_dataLoaded) return;
    if (_dataLoading) return _dataLoading;
    _dataLoading = (async () => {
      [_countries, _geoJson] = await Promise.all([_fetchCountries(), _fetchGeoJson()]);
      _gPolygons = _buildPolygons(_geoJson);
      _dataLoaded = true;
    })();
    return _dataLoading;
  }

  function _buildPolygons(geojson) {
    const out = [];
    geojson.features.forEach(f => {
      const rings = [];
      const g = f.geometry;
      if (g.type === 'Polygon')      rings.push(...g.coordinates);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => rings.push(...p));
      out.push({ cca3: f.id, rings });
    });
    return out;
  }

  function _byCode() {
    const m = {};
    _countries.forEach(c => { m[c.cca3] = c; });
    return m;
  }

  /* ════════════════════════════════ COUNTRY PANEL ══════════════════ */
  function showCountryPanel(country, panelSel) {
    const sel   = panelSel || '#ex-country-panel';
    const panel = document.querySelector(sel);
    if (!panel) return;
    _addRecent(country.cca3);

    const name     = country.name?.common || '?';
    const official = country.name?.official || '';
    const capital  = (country.capital || [])[0] || '—';
    const pop      = country.population?.toLocaleString('pt') || '—';
    const area     = country.area ? country.area.toLocaleString('pt') + ' km²' : '—';
    const curr     = Object.values(country.currencies || {}).map(c => `${c.name}${c.symbol ? ` (${c.symbol})` : ''}`).join(', ') || '—';
    const langs    = Object.values(country.languages || {}).join(', ') || '—';
    const cont     = (country.continents || [])[0] || '—';
    const tz       = (country.timezones || []).slice(0, 2).join(', ') || '—';
    const isFave   = _favorites.includes(country.cca3);
    const flag     = country.flags?.svg || country.flags?.png || '';

    panel.innerHTML = `
      <button class="ex-panel-close" id="ex-panel-close">✕</button>
      ${flag
        ? `<img class="ex-panel-flag" src="${flag}" alt="${name}" loading="lazy"/>`
        : `<div class="ex-panel-flag-placeholder">${country.flag || '🏳'}</div>`}
      <div class="ex-panel-body">
        <div class="ex-panel-name">${name}</div>
        ${official && official !== name ? `<div class="ex-panel-official">${official}</div>` : ''}
        <div class="ex-panel-actions">
          <button class="ex-fave-btn${isFave ? ' active' : ''}" id="ex-fave-btn">
            <span class="ex-fave-btn-icon">${isFave ? '❤' : '🤍'}</span> ${isFave ? 'Guardado' : 'Favorito'}
          </button>
          <a class="ex-wiki-btn" href="https://en.wikipedia.org/wiki/${encodeURIComponent(name)}" target="_blank" rel="noopener">
            📖 Wikipedia
          </a>
        </div>
        <div class="ex-panel-rows">
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🏙</span><span class="ex-panel-label">Capital</span><span class="ex-panel-value">${capital}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">👥</span><span class="ex-panel-label">População</span><span class="ex-panel-value">${pop}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">📐</span><span class="ex-panel-label">Área</span><span class="ex-panel-value">${area}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">💰</span><span class="ex-panel-label">Moeda</span><span class="ex-panel-value">${curr}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🗣</span><span class="ex-panel-label">Línguas</span><span class="ex-panel-value">${langs}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🌍</span><span class="ex-panel-label">Continente</span><span class="ex-panel-value">${cont}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🕐</span><span class="ex-panel-label">Fuso horário</span><span class="ex-panel-value">${tz}</span></div>
        </div>
        <div class="ex-panel-excerpt" id="ex-panel-excerpt">A carregar excerpt…</div>
        ${country.borders?.length ? `
          <div class="ex-panel-borders-label">Fronteiras</div>
          <div class="ex-panel-borders" id="ex-panel-borders">
            ${country.borders.map(b => `<button class="ex-panel-border-chip" data-cca3="${b}">${b}</button>`).join('')}
          </div>` : ''}
      </div>`;

    panel.classList.add('open');

    panel.querySelector('#ex-panel-close').onclick = () => panel.classList.remove('open');
    panel.querySelector('#ex-fave-btn').onclick    = () => _toggleFave(country.cca3, panel);

    panel.querySelectorAll('.ex-panel-border-chip').forEach(btn => {
      btn.onclick = () => {
        const c = _countries.find(x => x.cca3 === btn.dataset.cca3);
        if (c) showCountryPanel(c, sel);
      };
    });

    _fetchWiki(name).then(text => {
      const el = panel.querySelector('#ex-panel-excerpt');
      if (el) el.textContent = text || 'Sem resumo disponível.';
    });
  }

  /* ════════════════════════════════ HUB PAGE ════════════════════════ */
  function _renderHub(sub) {
    const byCca3   = _dataLoaded ? _byCode() : {};
    const recents  = _recent.map(c => byCca3[c]).filter(Boolean).slice(0, 8);
    const faves    = _favorites.map(c => byCca3[c]).filter(Boolean).slice(0, 8);

    sub.innerHTML = `
      <div class="ex-hub">
        <div class="ex-hub-header">
          <h1 class="ex-hub-title">Explorar o Mundo</h1>
          <p class="ex-hub-subtitle">Descobre países, navega o globo e explora o sistema solar.</p>
          <button class="ex-discover-btn" id="ex-discover-btn">
            <span class="ex-discover-btn-icon">🎲</span> Descobrir algo novo
          </button>
        </div>
        <div class="ex-feature-grid">
          <div class="ex-feature-card" data-tab="map">
            <span class="ex-feature-card-icon">🗺</span>
            <div class="ex-feature-card-title">Mapa Mundial</div>
            <div class="ex-feature-card-desc">Clica em qualquer país para ver informações detalhadas, capitais, moedas e muito mais.</div>
          </div>
          <div class="ex-feature-card" data-tab="globe">
            <span class="ex-feature-card-icon">🌍</span>
            <div class="ex-feature-card-title">Globo 3D</div>
            <div class="ex-feature-card-desc">Roda o globo interativo, clica nos países e explora o mundo de uma perspetiva diferente.</div>
          </div>
          <div class="ex-feature-card" data-tab="solar">
            <span class="ex-feature-card-icon">☀</span>
            <div class="ex-feature-card-title">Sistema Solar</div>
            <div class="ex-feature-card-desc">Vê os planetas em órbita, compara tamanhos e distâncias, e descobre factos fascinantes.</div>
          </div>
        </div>
        ${recents.length ? `
          <div class="ex-recent-section">
            <div class="ex-section-label">Visto recentemente</div>
            <div class="ex-chips-row">
              ${recents.map(c => `<button class="ex-country-chip" data-cca3="${c.cca3}">
                <span class="ex-country-chip-flag">${c.flag || ''}</span>${c.name.common}
              </button>`).join('')}
            </div>
          </div>` : ''}
        ${faves.length ? `
          <div class="ex-faves-section">
            <div class="ex-section-label">Favoritos</div>
            <div class="ex-chips-row">
              ${faves.map(c => `<button class="ex-country-chip" data-cca3="${c.cca3}">
                <span class="ex-country-chip-flag">${c.flag || ''}</span>${c.name.common}
              </button>`).join('')}
            </div>
          </div>` : ''}
      </div>`;

    sub.querySelector('#ex-discover-btn').onclick = () => {
      if (!_dataLoaded || !_countries.length) return;
      const c = _countries[Math.floor(Math.random() * _countries.length)];
      _switchTab('map');
      setTimeout(() => showCountryPanel(c), 350);
    };

    sub.querySelectorAll('.ex-feature-card').forEach(card => {
      card.onclick = () => _switchTab(card.dataset.tab);
    });

    sub.querySelectorAll('.ex-country-chip').forEach(chip => {
      chip.onclick = () => {
        const c = _countries.find(x => x.cca3 === chip.dataset.cca3);
        if (c) { _switchTab('map'); setTimeout(() => showCountryPanel(c), 350); }
      };
    });
  }

  /* ════════════════════════════════ MAP ═════════════════════════════ */
  function _renderMapShell(sub) {
    sub.innerHTML = `
      <div class="ex-map-wrap">
        <div class="ex-loading" id="ex-map-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-loading-text">A carregar o mapa…</div>
        </div>
        <div id="ex-leaflet-map"></div>
        <div class="ex-search-bar">
          <div class="ex-search-inner">
            <span class="ex-search-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input type="text" class="ex-search-input" id="ex-map-search" placeholder="Pesquisar país…" autocomplete="off"/>
            <button class="ex-search-clear" id="ex-map-search-clear" aria-label="Limpar">✕</button>
          </div>
          <div class="ex-search-results" id="ex-map-search-results"></div>
        </div>
        <div class="ex-map-controls">
          <button class="ex-map-btn" id="ex-map-random"><span class="ex-map-btn-icon">🎲</span> Aleatório</button>
        </div>
        <div class="ex-continent-filter" id="ex-continent-filter">
          <button class="ex-continent-btn active" data-c="all">Todos</button>
          <button class="ex-continent-btn" data-c="Africa">África</button>
          <button class="ex-continent-btn" data-c="Americas">Américas</button>
          <button class="ex-continent-btn" data-c="Asia">Ásia</button>
          <button class="ex-continent-btn" data-c="Europe">Europa</button>
          <button class="ex-continent-btn" data-c="Oceania">Oceânia</button>
        </div>
        <div class="ex-country-panel" id="ex-country-panel"></div>
      </div>`;
  }

  async function _initMap() {
    if (_lInited) {
      _lMap?.invalidateSize();
      document.getElementById('ex-map-loading')?.remove();
      return;
    }
    try {
      await Promise.all([_loadLeaflet(), _ensureData()]);
    } catch (err) {
      const ld = document.getElementById('ex-map-loading');
      if (ld) ld.innerHTML = `<div class="ex-error-icon">⚠</div><div class="ex-error-msg">Erro ao carregar o mapa. Verifica a ligação à internet.</div>`;
      return;
    }

    const mapEl = document.getElementById('ex-leaflet-map');
    if (!mapEl) return;

    _lMap = L.map(mapEl, { center: [20, 10], zoom: 2, minZoom: 1, maxZoom: 6 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
    }).addTo(_lMap);

    const byCca3 = _byCode();

    _lLayer = L.geoJSON(_geoJson, {
      style: () => ({ fillColor: '#6366f1', fillOpacity: 0.15, color: 'rgba(255,255,255,0.18)', weight: 0.8 }),
      onEachFeature(feature, layer) {
        const c = byCca3[feature.id];
        if (!c) return;
        layer.on({
          mouseover(e) { e.target.setStyle({ fillOpacity: 0.42, color: 'rgba(99,102,241,0.85)', weight: 1.4 }); },
          mouseout(e)  { _lLayer.resetStyle(e.target); },
          click()      { showCountryPanel(c, '#ex-country-panel'); },
        });
      },
    }).addTo(_lMap);

    document.getElementById('ex-map-loading')?.remove();
    _lInited = true;

    _wireMapSearch(byCca3);

    document.getElementById('ex-map-random').onclick = () => {
      const c = _countries[Math.floor(Math.random() * _countries.length)];
      showCountryPanel(c, '#ex-country-panel');
    };

    document.getElementById('ex-continent-filter')?.addEventListener('click', e => {
      const btn = e.target.closest('.ex-continent-btn');
      if (!btn) return;
      _contFilter = btn.dataset.c;
      document.querySelectorAll('#ex-continent-filter .ex-continent-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      _applyContinent(byCca3);
    });
  }

  function _applyContinent(byCca3) {
    if (!_lLayer) return;
    _lLayer.eachLayer(layer => {
      const c       = byCca3[layer.feature?.id];
      const matches = _contFilter === 'all' || (c?.continents || []).includes(_contFilter);
      layer.setStyle({ fillOpacity: matches ? 0.15 : 0.04, color: matches ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)' });
    });
  }

  function _wireMapSearch(byCca3) {
    const input   = document.getElementById('ex-map-search');
    const results = document.getElementById('ex-map-search-results');
    const clear   = document.getElementById('ex-map-search-clear');
    if (!input || !results) return;

    let _focusIdx = -1;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.classList.remove('open'); return; }
      const hits = _countries.filter(c => c.name.common.toLowerCase().includes(q)).slice(0, 8);
      if (!hits.length) { results.classList.remove('open'); return; }
      results._hits = hits;
      results.innerHTML = hits.map((c, i) => `
        <div class="ex-search-result" data-i="${i}">
          <span class="ex-search-result-flag">${c.flag || ''}</span>
          <span class="ex-search-result-name">${c.name.common}</span>
          <span class="ex-search-result-region">${(c.continents || [])[0] || ''}</span>
        </div>`).join('');
      results.classList.add('open');
      _focusIdx = -1;
    });

    results.addEventListener('click', e => {
      const row = e.target.closest('.ex-search-result');
      if (!row || !results._hits) return;
      const c = results._hits[+row.dataset.i];
      if (c) { showCountryPanel(c, '#ex-country-panel'); results.classList.remove('open'); input.value = ''; }
    });

    input.addEventListener('keydown', e => {
      const items = results.querySelectorAll('.ex-search-result');
      if (e.key === 'ArrowDown')  { _focusIdx = Math.min(_focusIdx + 1, items.length - 1); }
      else if (e.key === 'ArrowUp')   { _focusIdx = Math.max(_focusIdx - 1, 0); }
      else if (e.key === 'Enter') { items[Math.max(_focusIdx, 0)]?.click(); return; }
      else if (e.key === 'Escape'){ results.classList.remove('open'); return; }
      items.forEach((it, i) => it.classList.toggle('focused', i === _focusIdx));
    });

    clear.onclick = () => { input.value = ''; results.classList.remove('open'); };

    document.addEventListener('click', e => {
      if (!e.target.closest('.ex-search-bar')) results.classList.remove('open');
    }, { capture: true });
  }

  /* ════════════════════════════════ GLOBE ═══════════════════════════ */
  function _renderGlobeShell(sub) {
    sub.innerHTML = `
      <div class="ex-globe-wrap">
        <canvas id="ex-globe-canvas"></canvas>
        <div class="ex-loading" id="ex-globe-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-loading-text">A carregar o globo…</div>
        </div>
        <div class="ex-globe-hint">Arrasta para rodar · Clica num país</div>
        <div class="ex-globe-stats">
          <div class="ex-globe-stat">Países <span class="ex-globe-stat-val" id="ex-globe-count">—</span></div>
          <div class="ex-globe-stat">Selecionado <span class="ex-globe-stat-val" id="ex-globe-sel">—</span></div>
        </div>
        <div class="ex-country-panel" id="ex-country-panel-globe"></div>
      </div>`;
  }

  async function _initGlobe() {
    if (_gInited) {
      if (!_gRaf) _startGlobeTick();
      document.getElementById('ex-globe-loading')?.remove();
      return;
    }
    try {
      await _ensureData();
    } catch (e) {
      const ld = document.getElementById('ex-globe-loading');
      if (ld) ld.innerHTML = `<div class="ex-error-icon">⚠</div><div class="ex-error-msg">Erro ao carregar dados do globo.</div>`;
      return;
    }

    _gCanvas = document.getElementById('ex-globe-canvas');
    if (!_gCanvas) return;

    const countEl = document.getElementById('ex-globe-count');
    if (countEl) countEl.textContent = _countries.length;

    document.getElementById('ex-globe-loading')?.remove();
    _gInited = true;

    _wireGlobeEvents();
    _startGlobeTick();
  }

  function _gProject(lon, lat) {
    const lonR = lon * Math.PI / 180;
    const latR = lat * Math.PI / 180;
    let x  = Math.cos(latR) * Math.cos(lonR);
    let y  = Math.sin(latR);
    let z  = Math.cos(latR) * Math.sin(lonR);
    const cy = Math.cos(_gRotY), sy = Math.sin(_gRotY);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const cx = Math.cos(_gRotX), sx = Math.sin(_gRotX);
    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    return { x: x1, y: y1, z: z2 };
  }

  function _startGlobeTick() {
    const canvas = _gCanvas;
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const dpr    = window.devicePixelRatio || 1;

    function resize() {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R  = Math.min(W, H) * 0.42;
      const cx = W / 2, cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      /* Globe base */
      const g = ctx.createRadialGradient(cx + R * 0.15, cy - R * 0.2, 0, cx, cy, R);
      g.addColorStop(0, '#1a2550');
      g.addColorStop(1, '#050810');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();

      /* Countries */
      _gPolygons.forEach(({ cca3, rings }) => {
        const hov  = cca3 === _gHovered;
        const fave = _favorites.includes(cca3);
        rings.forEach(ring => {
          ctx.beginPath();
          let started = false;
          ring.forEach(([lon, lat]) => {
            const p = _gProject(lon, lat);
            if (p.z < 0) return;
            const sx = cx + p.x * R, sy = cy - p.y * R;
            if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
          });
          if (!started) return;
          ctx.closePath();
          ctx.fillStyle   = hov ? 'rgba(99,102,241,0.6)' : fave ? 'rgba(239,68,68,0.35)' : 'rgba(55,75,140,0.4)';
          ctx.strokeStyle = hov ? 'rgba(99,102,241,1)'   : 'rgba(100,130,200,0.35)';
          ctx.lineWidth   = hov ? 1.2 : 0.5;
          ctx.fill(); ctx.stroke();
        });
      });

      /* Rim glow */
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99,102,241,0.22)'; ctx.lineWidth = 2.5;
      ctx.stroke();

      /* Night overlay */
      const ng = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
      ng.addColorStop(0, 'rgba(0,0,20,0.3)');
      ng.addColorStop(0.45, 'rgba(0,0,0,0)');
      ng.addColorStop(1, 'rgba(0,0,10,0.15)');
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = ng; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
    }

    function tick() {
      _gRotY += _gRotYVel;
      draw();
      _gRaf = requestAnimationFrame(tick);
    }
    _gRaf = requestAnimationFrame(tick);
  }

  function _stopGlobeTick() {
    if (_gRaf) { cancelAnimationFrame(_gRaf); _gRaf = null; }
  }

  function _wireGlobeEvents() {
    const canvas = _gCanvas;
    if (!canvas) return;
    let dragging = false, lx = 0, ly = 0;

    function _pickCountry(mx, my) {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const R = Math.min(W, H) * 0.42;
      const cx = W / 2, cy = H / 2;
      const dx = mx - cx, dy = my - cy;
      if (dx * dx + dy * dy > R * R) return null;
      for (const { cca3, rings } of _gPolygons) {
        for (const ring of rings) {
          const pts = ring.map(([lon, lat]) => {
            const p = _gProject(lon, lat);
            if (p.z < 0) return null;
            return { x: cx + p.x * R, y: cy - p.y * R };
          }).filter(Boolean);
          if (pts.length >= 3 && _pip(mx, my, pts)) return cca3;
        }
      }
      return null;
    }

    canvas.addEventListener('mousedown', e => {
      dragging = true; lx = e.clientX; ly = e.clientY;
      _gRotYVel = 0; canvas.classList.add('dragging');
    });
    window.addEventListener('mousemove', e => {
      if (dragging) {
        _gRotY += (e.clientX - lx) * 0.005;
        _gRotX = Math.max(-1.4, Math.min(1.4, _gRotX + (e.clientY - ly) * 0.005));
        lx = e.clientX; ly = e.clientY;
      } else {
        const r = canvas.getBoundingClientRect();
        _gHovered = _pickCountry(e.clientX - r.left, e.clientY - r.top);
      }
    });
    window.addEventListener('mouseup', () => {
      dragging = false; canvas.classList.remove('dragging'); _gRotYVel = 0.0015;
    });

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0]; lx = t.clientX; ly = t.clientY; _gRotYVel = 0;
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      _gRotY += (t.clientX - lx) * 0.005;
      _gRotX  = Math.max(-1.4, Math.min(1.4, _gRotX + (t.clientY - ly) * 0.005));
      lx = t.clientX; ly = t.clientY;
    }, { passive: false });
    canvas.addEventListener('touchend', () => { _gRotYVel = 0.0015; });

    canvas.addEventListener('click', e => {
      const r    = canvas.getBoundingClientRect();
      const cca3 = _pickCountry(e.clientX - r.left, e.clientY - r.top);
      if (!cca3) return;
      const sel  = document.getElementById('ex-globe-sel');
      if (sel) sel.textContent = cca3;
      const c = _countries.find(x => x.cca3 === cca3);
      if (c) showCountryPanel(c, '#ex-country-panel-globe');
    });
  }

  function _pip(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }

  /* ════════════════════════════════ TAB SYSTEM ══════════════════════ */
  let _shell = null;
  let _curTab = 'hub';

  function _buildShell(view) {
    view.innerHTML = `
      <div class="ex-shell">
        <div class="ex-tabs" id="ex-tabs">
          <button class="ex-tab active" data-tab="hub"><span class="ex-tab-icon">🏠</span> Início</button>
          <button class="ex-tab" data-tab="map"><span class="ex-tab-icon">🗺</span> Mapa</button>
          <button class="ex-tab" data-tab="globe"><span class="ex-tab-icon">🌍</span> Globo</button>
          <button class="ex-tab" data-tab="solar"><span class="ex-tab-icon">☀</span> Sistema Solar</button>
        </div>
        <div class="ex-content" id="ex-content">
          <div class="ex-sub active" id="ex-sub-hub"></div>
          <div class="ex-sub" id="ex-sub-map"></div>
          <div class="ex-sub" id="ex-sub-globe"></div>
          <div class="ex-sub" id="ex-sub-solar"></div>
        </div>
      </div>`;

    _shell = view.querySelector('.ex-shell');
    view.querySelector('#ex-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.ex-tab');
      if (btn) _switchTab(btn.dataset.tab);
    });

    _renderHub(view.querySelector('#ex-sub-hub'));

    _ensureData().then(() => {
      const hubSub = view.querySelector('#ex-sub-hub');
      if (hubSub?.classList.contains('active')) _renderHub(hubSub);
    }).catch(() => {});
  }

  function _switchTab(tab) {
    if (!_shell) return;

    /* Stop animations when leaving their tab */
    if (tab !== 'globe') _stopGlobeTick();
    if (tab !== 'solar' && _curTab === 'solar' && typeof SolarExplorer !== 'undefined') SolarExplorer.stop();
    _curTab = tab;

    _shell.querySelectorAll('.ex-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    _shell.querySelectorAll('.ex-sub').forEach(s => {
      const on = s.id === `ex-sub-${tab}`;
      s.classList.toggle('active', on);
      if (on && s.style.display === 'none') s.style.display = '';
    });

    const sub = _shell.querySelector(`#ex-sub-${tab}`);
    if (!sub) return;

    if (tab === 'hub') {
      _renderHub(sub);
    } else if (tab === 'map' && !_lInited) {
      _renderMapShell(sub);
      _initMap();
    } else if (tab === 'map' && _lInited) {
      setTimeout(() => _lMap?.invalidateSize(), 80);
    } else if (tab === 'globe') {
      if (!_gInited) { _renderGlobeShell(sub); _initGlobe(); }
      else if (!_gRaf) _startGlobeTick();
    } else if (tab === 'solar') {
      if (typeof SolarExplorer !== 'undefined') {
        if (!sub.querySelector('.ex-solar-wrap')) SolarExplorer.mount(sub);
        else SolarExplorer.resume();
      } else {
        sub.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:.9rem">Sistema solar a carregar…</div>`;
      }
    }
  }

  /* ════════════════════════════════ PUBLIC ══════════════════════════ */
  function show(sub) {
    const view = document.getElementById('view-explorer');
    if (!view) return;

    if (!_shell || !view.contains(_shell)) {
      _loadStorage();
      _buildShell(view);
    }

    _switchTab(sub || 'hub');
  }

  return { show };
})();
