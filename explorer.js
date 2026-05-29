/* ══════════════════════════════════════════════════════════════════
   EXPLORER PAGE — World Map, Canvas Globe, Solar System
══════════════════════════════════════════════════════════════════ */
const ExplorerPage = (function () {
  'use strict';

  /* ── Shared data ── */
  let _countries   = [];
  let _geoJson     = null;    // memory-only, no sessionStorage (too large)
  let _favorites   = [];
  let _recent      = [];
  let _countriesOk = false;
  let _geoJsonOk   = false;

  /* ── Globe state (module-level for projection helpers) ── */
  let _gRotX    = 0.3;
  let _gRotY    = 0;
  let _gRotYVel = 0.0015;
  let _gPolygons = [];
  let _gHovered  = null;
  let _gRaf      = null;
  let _gCanvas   = null;
  let _gInited   = false;

  /* ── Leaflet state ── */
  let _lMap      = null;
  let _lTile     = null;
  let _lLayer    = null;
  let _lInited   = false;
  let _lDataLoaded = false;
  let _contFilter  = 'all';
  let _themeObs    = null;

  /* ── Tab/shell ── */
  let _shell   = null;
  let _curTab  = 'hub';

  /* ── Constants ── */
  const TTL = 86400000;
  const COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,flag,capital,population,currencies,languages,area,continents,flags,timezones,borders';
  const GEOJSON_URL   = 'https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json';

  /* ════════════════════════════════ UTILS ══════════════════════════ */
  function _byCode() {
    const m = {};
    _countries.forEach(c => { m[c.cca3] = c; });
    return m;
  }

  async function _fetchTimeout(url, ms) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), ms || 12000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } finally { clearTimeout(tid); }
  }

  function _isDark() { return !document.body.classList.contains('light'); }
  function _tileUrl() {
    return _isDark()
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  }

  /* ════════════════════════════════ STORAGE ════════════════════════ */
  function _loadStorage() {
    try { _favorites = JSON.parse(localStorage.getItem('ex-faves')  || '[]'); } catch (e) { _favorites = []; }
    try { _recent    = JSON.parse(localStorage.getItem('ex-recent') || '[]'); } catch (e) { _recent    = []; }
  }
  function _saveFaves()  { try { localStorage.setItem('ex-faves',  JSON.stringify(_favorites)); } catch (e) {} }
  function _saveRecent() { try { localStorage.setItem('ex-recent', JSON.stringify(_recent));    } catch (e) {} }

  function _addRecent(cca3) {
    _recent = [cca3, ..._recent.filter(x => x !== cca3)].slice(0, 12);
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
        if (Date.now() - ts < TTL && Array.isArray(data) && data.length > 100) return data;
      }
    } catch (e) {}
    const r    = await _fetchTimeout(COUNTRIES_URL, 15000);
    const data = await r.json();
    try { localStorage.setItem('ex-countries', JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    return data;
  }

  async function _fetchGeoJson() {
    if (_geoJson) return _geoJson;
    const r = await _fetchTimeout(GEOJSON_URL, 25000);
    return r.json();
  }

  async function _fetchWiki(name) {
    const key = `ex-wiki-${name}`;
    try { const c = sessionStorage.getItem(key); if (c) return c; } catch (e) {}
    try {
      const r = await _fetchTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`, 6000);
      const d = await r.json();
      const text = d.extract_html
        ? d.extract_html.replace(/<[^>]+>/g, '').slice(0, 300)
        : (d.extract || '').slice(0, 300);
      if (text) try { sessionStorage.setItem(key, text); } catch (e) {}
      return text || null;
    } catch (e) { return null; }
  }

  async function _loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = Object.assign(document.createElement('link'),
          { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
        document.head.appendChild(link);
      }
      const s = Object.assign(document.createElement('script'),
        { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function _buildPolygons(gj) {
    return (gj.features || []).map(f => {
      const rings = [];
      const g = f.geometry;
      if (!g) return null;
      if (g.type === 'Polygon')           rings.push(...g.coordinates);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => rings.push(...p));
      return { cca3: f.id, rings };
    }).filter(Boolean);
  }

  /* ════════════════════════════════ COUNTRY PANEL ══════════════════ */
  function _countryFacts(c) {
    const facts = [];
    const langs = Object.values(c.languages || {});
    if (langs.length >= 3) facts.push(`Tem ${langs.length} línguas oficiais.`);
    if (c.area > 1000000) facts.push(`Um dos 20 maiores países do mundo por área.`);
    if (c.population > 100000000) facts.push(`Com mais de ${Math.round(c.population / 1e6)} milhões de habitantes.`);
    if ((c.borders || []).length === 0 && c.area < 1000000) facts.push(`Nação ilha — sem fronteiras terrestres.`);
    if ((c.timezones || []).length > 3) facts.push(`Abrange ${c.timezones.length} fusos horários.`);
    if (c.area && c.population) {
      const density = Math.round(c.population / c.area);
      if (density > 500) facts.push(`Densidade populacional muito elevada: ${density} hab/km².`);
      if (density < 5 && c.area > 100000) facts.push(`Um dos países menos densamente povoados: ${density} hab/km².`);
    }
    return facts.slice(0, 3);
  }

  function showCountryPanel(country, panelSel) {
    const panel = document.querySelector(panelSel || '#ex-country-panel');
    if (!panel) return;
    _addRecent(country.cca3);

    const name    = country.name?.common || '?';
    const capital = (country.capital || [])[0] || '—';
    const pop     = country.population > 0 ? country.population.toLocaleString('pt') : '—';
    const area    = country.area > 0 ? country.area.toLocaleString('pt') + ' km²' : '—';
    const curr    = Object.values(country.currencies || {}).map(c => `${c.name}${c.symbol ? ` (${c.symbol})` : ''}`).join(', ') || '—';
    const langs   = Object.values(country.languages || {}).join(', ') || '—';
    const cont    = (country.continents || [])[0] || '—';
    const tz      = (country.timezones || []).slice(0, 2).join(', ') || '—';
    const isFave  = _favorites.includes(country.cca3);
    const flag    = country.flags?.svg || country.flags?.png || '';
    const facts   = _countryFacts(country);

    panel.innerHTML = `
      <button class="ex-panel-close" id="ex-panel-close">✕</button>
      ${flag
        ? `<img class="ex-panel-flag" src="${flag}" alt="${name}" loading="lazy"/>`
        : `<div class="ex-panel-flag-placeholder">${country.flag || '🏳'}</div>`}
      <div class="ex-panel-body">
        <div class="ex-panel-name">${name}</div>
        ${country.name?.official && country.name.official !== name
          ? `<div class="ex-panel-official">${country.name.official}</div>` : ''}
        <div class="ex-panel-actions">
          <button class="ex-fave-btn${isFave ? ' active' : ''}" id="ex-fave-btn">
            <span class="ex-fave-btn-icon">${isFave ? '❤' : '🤍'}</span> ${isFave ? 'Guardado' : 'Favorito'}
          </button>
          <a class="ex-wiki-btn" href="https://en.wikipedia.org/wiki/${encodeURIComponent(name)}"
             target="_blank" rel="noopener">📖 Wikipedia</a>
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
        ${facts.length ? `<div class="ex-panel-facts">
          ${facts.map(f => `<div class="ex-panel-fact">💡 ${f}</div>`).join('')}
        </div>` : ''}
        <div class="ex-panel-excerpt" id="ex-panel-excerpt">
          <div class="ex-panel-excerpt-loading">A carregar…</div>
        </div>
        ${(country.borders || []).length ? `
          <div class="ex-panel-borders-label">Fronteiras</div>
          <div class="ex-panel-borders">
            ${country.borders.map(b => `<button class="ex-panel-border-chip" data-cca3="${b}">${b}</button>`).join('')}
          </div>` : ''}
      </div>`;

    panel.classList.add('open');

    panel.querySelector('#ex-panel-close').onclick  = () => panel.classList.remove('open');
    panel.querySelector('#ex-fave-btn').onclick      = () => _toggleFave(country.cca3, panel);
    panel.querySelectorAll('.ex-panel-border-chip').forEach(btn => {
      btn.onclick = () => {
        const c = _countries.find(x => x.cca3 === btn.dataset.cca3);
        if (c) showCountryPanel(c, panelSel);
      };
    });

    _fetchWiki(name).then(text => {
      const el = panel.querySelector('#ex-panel-excerpt');
      if (el) el.innerHTML = text
        ? `<p>${text}${text.length >= 298 ? '…' : ''}</p>`
        : '';
    });
  }

  /* ════════════════════════════════ HUB ════════════════════════════ */
  function _renderHub(sub) {
    const byCca3  = _countriesOk ? _byCode() : {};
    const recents = _recent.map(c => byCca3[c]).filter(Boolean).slice(0, 8);
    const faves   = _favorites.map(c => byCca3[c]).filter(Boolean).slice(0, 8);

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
            <div class="ex-feature-card-desc">Clica em qualquer país para ver informações, capitais, moedas, línguas e factos.</div>
          </div>
          <div class="ex-feature-card" data-tab="globe">
            <span class="ex-feature-card-icon">🌍</span>
            <div class="ex-feature-card-title">Globo 3D</div>
            <div class="ex-feature-card-desc">Roda o globo interativo, clica nos países e explora o mundo em perspetiva.</div>
          </div>
          <div class="ex-feature-card" data-tab="solar">
            <span class="ex-feature-card-icon">☀</span>
            <div class="ex-feature-card-title">Sistema Solar</div>
            <div class="ex-feature-card-desc">Vê os planetas em órbita e descobre factos, luas e comparações.</div>
          </div>
        </div>
        ${recents.length ? `
          <div class="ex-recent-section">
            <div class="ex-section-label">Visto recentemente</div>
            <div class="ex-chips-row">
              ${recents.map(c => `<button class="ex-country-chip" data-cca3="${c.cca3}">
                <span class="ex-country-chip-flag">${c.flag || ''}</span>${c.name.common}</button>`).join('')}
            </div>
          </div>` : ''}
        ${faves.length ? `
          <div class="ex-faves-section">
            <div class="ex-section-label">Favoritos</div>
            <div class="ex-chips-row">
              ${faves.map(c => `<button class="ex-country-chip" data-cca3="${c.cca3}">
                <span class="ex-country-chip-flag">${c.flag || ''}</span>${c.name.common}</button>`).join('')}
            </div>
          </div>` : ''}
      </div>`;

    sub.querySelector('#ex-discover-btn').onclick = () => {
      if (!_countriesOk) return;
      const c = _countries[Math.floor(Math.random() * _countries.length)];
      _switchTab('map');
      setTimeout(() => showCountryPanel(c, '#ex-country-panel'), 400);
    };
    sub.querySelectorAll('.ex-feature-card').forEach(card => {
      card.onclick = () => _switchTab(card.dataset.tab);
    });
    sub.querySelectorAll('.ex-country-chip').forEach(chip => {
      chip.onclick = () => {
        const c = _countries.find(x => x.cca3 === chip.dataset.cca3);
        if (c) { _switchTab('map'); setTimeout(() => showCountryPanel(c, '#ex-country-panel'), 400); }
      };
    });
  }

  /* ════════════════════════════════ MAP ═════════════════════════════ */
  function _renderMapShell(sub) {
    sub.innerHTML = `
      <div class="ex-map-wrap">
        <div id="ex-leaflet-map"></div>
        <div class="ex-loading" id="ex-map-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-loading-text" id="ex-map-loading-txt">A inicializar o mapa…</div>
        </div>
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
        <div class="ex-data-status" id="ex-data-status"></div>
        <div class="ex-country-panel" id="ex-country-panel"></div>
      </div>`;
  }

  function _setLoadingText(txt) {
    const el = document.getElementById('ex-map-loading-txt');
    if (el) el.textContent = txt;
  }

  function _setDataStatus(state, msg, retry) {
    const el = document.getElementById('ex-data-status');
    if (!el) return;
    if (!state) { el.style.display = 'none'; return; }
    el.style.cssText = 'display:flex;align-items:center;gap:.5rem;position:absolute;bottom:3rem;left:50%;transform:translateX(-50%);background:rgba(8,12,20,.88);backdrop-filter:blur(12px);border:1px solid var(--border2);border-radius:var(--radius);padding:.4rem .85rem;font-size:.72rem;color:var(--muted);z-index:10;white-space:nowrap;pointer-events:auto';
    if (state === 'loading') {
      el.innerHTML = `<span style="width:10px;height:10px;border:1.5px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;display:inline-block"></span> ${msg}`;
    } else {
      el.innerHTML = `<span>⚠ ${msg}</span>${retry ? `<button onclick="(${retry})()" style="background:var(--accent-soft);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);font-size:.68rem;padding:.2rem .55rem;border-radius:4px;cursor:pointer;margin-left:.25rem">Tentar</button>` : ''}`;
    }
  }

  async function _initMap() {
    if (_lInited) {
      setTimeout(() => { _lMap?.invalidateSize(); }, 80);
      return;
    }

    _setLoadingText('A carregar biblioteca de mapas…');

    try {
      await _loadLeaflet();
    } catch (e) {
      const ld = document.getElementById('ex-map-loading');
      if (ld) ld.innerHTML = `
        <div class="ex-error-icon">⚠</div>
        <div class="ex-error-msg">Erro ao carregar Leaflet.<br>Verifica a ligação à internet.</div>
        <button class="ex-retry-btn" id="ex-map-retry">Tentar novamente</button>`;
      document.getElementById('ex-map-retry')?.addEventListener('click', _initMap);
      return;
    }

    /* Create base map (always works after Leaflet loads) */
    const mapEl = document.getElementById('ex-leaflet-map');
    if (!mapEl) return;

    _lMap = L.map(mapEl, { center: [20, 10], zoom: 2, minZoom: 1, maxZoom: 6, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(_lMap);

    _lTile = L.tileLayer(_tileUrl(), {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
      subdomains: 'abcd',
    }).addTo(_lMap);

    /* Watch for theme changes */
    if (_themeObs) _themeObs.disconnect();
    _themeObs = new MutationObserver(() => {
      if (!_lMap || !_lTile) return;
      _lMap.removeLayer(_lTile);
      _lTile = L.tileLayer(_tileUrl(), { attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd' }).addTo(_lMap);
    });
    _themeObs.observe(document.body, { attributeFilter: ['class'] });

    /* Map is showing — remove the full-screen overlay */
    document.getElementById('ex-map-loading')?.remove();
    _lInited = true;

    /* Wire controls that work without data */
    document.getElementById('ex-map-random')?.addEventListener('click', () => {
      if (_countriesOk) showCountryPanel(_countries[Math.floor(Math.random() * _countries.length)], '#ex-country-panel');
    });

    /* Phase 2: load data in background */
    _loadMapData();
  }

  async function _loadMapData() {
    if (_lDataLoaded) return;
    _setDataStatus('loading', 'A carregar dados dos países…');

    const [cr, gr] = await Promise.allSettled([
      _countriesOk ? Promise.resolve(_countries) : _fetchCountries(),
      _geoJsonOk   ? Promise.resolve(_geoJson)   : _fetchGeoJson(),
    ]);

    if (cr.status === 'fulfilled') { _countries = cr.value; _countriesOk = true; }
    if (gr.status === 'fulfilled') {
      _geoJson   = gr.value;
      _geoJsonOk = true;
      _gPolygons = _buildPolygons(_geoJson);
    }

    if (!_geoJsonOk) {
      _setDataStatus('error', 'Erro ao carregar contornos dos países.', _loadMapData);
      if (_countriesOk) _wireMapSearch(_byCode());
      return;
    }

    _setDataStatus(null);
    _addCountryLayer();
    _lDataLoaded = true;
  }

  function _addCountryLayer() {
    if (!_lMap || !_geoJson) return;
    const byCca3 = _byCode();

    _lLayer = L.geoJSON(_geoJson, {
      style: () => ({ fillColor: '#6366f1', fillOpacity: 0.12, color: _isDark() ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)', weight: 0.8 }),
      onEachFeature(feature, layer) {
        const c = byCca3[feature.id];
        if (!c) return;
        layer.on({
          mouseover(e) { e.target.setStyle({ fillOpacity: 0.42, color: 'rgba(99,102,241,0.85)', weight: 1.4 }); },
          mouseout(e)  { _lLayer?.resetStyle(e.target); },
          click()      { showCountryPanel(c, '#ex-country-panel'); },
        });
      },
    }).addTo(_lMap);

    _wireMapSearch(byCca3);
    _wireContinent(byCca3);
  }

  function _wireContinent(byCca3) {
    const bar = document.getElementById('ex-continent-filter');
    if (!bar) return;
    bar.addEventListener('click', e => {
      const btn = e.target.closest('.ex-continent-btn');
      if (!btn) return;
      _contFilter = btn.dataset.c;
      bar.querySelectorAll('.ex-continent-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (!_lLayer) return;
      _lLayer.eachLayer(layer => {
        const c = byCca3[layer.feature?.id];
        const ok = _contFilter === 'all' || (c?.continents || []).includes(_contFilter);
        layer.setStyle({ fillOpacity: ok ? 0.12 : 0.03, color: ok ? (_isDark() ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.15)') : 'rgba(128,128,128,.05)' });
      });
    });
  }

  function _wireMapSearch(byCca3) {
    const input   = document.getElementById('ex-map-search');
    const results = document.getElementById('ex-map-search-results');
    const clear   = document.getElementById('ex-map-search-clear');
    if (!input || !results) return;
    let _fi = -1;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.classList.remove('open'); return; }
      const hits = _countries.filter(c => c.name.common.toLowerCase().includes(q) || (c.cca3 || '').toLowerCase().includes(q)).slice(0, 8);
      if (!hits.length) { results.classList.remove('open'); return; }
      results._hits = hits;
      results.innerHTML = hits.map((c, i) => `
        <div class="ex-search-result" data-i="${i}">
          <span class="ex-search-result-flag">${c.flag || ''}</span>
          <span class="ex-search-result-name">${c.name.common}</span>
          <span class="ex-search-result-region">${(c.continents || [])[0] || ''}</span>
        </div>`).join('');
      results.classList.add('open'); _fi = -1;
    });
    results.addEventListener('click', e => {
      const row = e.target.closest('.ex-search-result');
      if (!row || !results._hits) return;
      const c = results._hits[+row.dataset.i];
      if (c) { showCountryPanel(c, '#ex-country-panel'); results.classList.remove('open'); input.value = ''; }
    });
    input.addEventListener('keydown', e => {
      const items = results.querySelectorAll('.ex-search-result');
      if (e.key === 'ArrowDown')  _fi = Math.min(_fi + 1, items.length - 1);
      else if (e.key === 'ArrowUp')   _fi = Math.max(_fi - 1, 0);
      else if (e.key === 'Enter') { items[Math.max(_fi, 0)]?.click(); return; }
      else if (e.key === 'Escape'){ results.classList.remove('open'); return; }
      items.forEach((it, i) => it.classList.toggle('focused', i === _fi));
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
          <div class="ex-loading-text" id="ex-globe-loading-txt">A carregar o globo…</div>
        </div>
        <div class="ex-globe-hint">Arrasta para rodar · Clica num país para explorar</div>
        <div class="ex-globe-stats">
          <div class="ex-globe-stat">Países <span class="ex-globe-stat-val" id="ex-globe-count">—</span></div>
          <div class="ex-globe-stat">Em destaque <span class="ex-globe-stat-val" id="ex-globe-sel">—</span></div>
        </div>
        <div class="ex-country-panel" id="ex-country-panel-globe"></div>
      </div>`;
  }

  /* Inverse projection: screen → lon/lat */
  function _globeInverseProject(mx, my, rect) {
    const W = rect.width, H = rect.height;
    const R = Math.min(W, H) * 0.42;
    const cx = W / 2, cy = H / 2;
    const nx = (mx - cx) / R;
    const ny = (cy - my) / R;
    const z2 = 1 - nx * nx - ny * ny;
    if (z2 < 0) return null;
    const nz = Math.sqrt(z2);
    /* undo X rotation */
    const cxr = Math.cos(-_gRotX), sxr = Math.sin(-_gRotX);
    const y1  = ny * cxr - nz * sxr;
    const z1  = ny * sxr + nz * cxr;
    /* undo Y rotation */
    const cyr = Math.cos(-_gRotY), syr = Math.sin(-_gRotY);
    const x1  = nx * cyr - z1 * syr;
    const z0  = nx * syr + z1 * cyr;
    return {
      lat: Math.asin(Math.max(-1, Math.min(1, y1))) * 180 / Math.PI,
      lon: Math.atan2(z0, x1) * 180 / Math.PI,
    };
  }

  function _lonLatPip(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }

  function _globePickCountry(mx, my) {
    const rect = _gCanvas?.getBoundingClientRect();
    if (!rect) return null;
    const geo = _globeInverseProject(mx, my, rect);
    if (!geo) return null;
    for (const { cca3, rings } of _gPolygons) {
      for (const ring of rings) {
        if (_lonLatPip(geo.lon, geo.lat, ring)) return cca3;
      }
    }
    return null;
  }

  async function _initGlobe() {
    if (_gInited) {
      if (!_gRaf) _startGlobeTick();
      document.getElementById('ex-globe-loading')?.remove();
      return;
    }

    const setTxt = t => { const el = document.getElementById('ex-globe-loading-txt'); if (el) el.textContent = t; };
    setTxt('A carregar dados dos países…');

    try {
      if (!_countriesOk) { _countries = await _fetchCountries(); _countriesOk = true; }
    } catch (e) {
      /* countries optional for globe */
    }
    try {
      setTxt('A carregar mapa do mundo…');
      if (!_geoJsonOk) {
        _geoJson   = await _fetchGeoJson();
        _geoJsonOk = true;
        _gPolygons = _buildPolygons(_geoJson);
      }
    } catch (e) {
      const ld = document.getElementById('ex-globe-loading');
      if (ld) ld.innerHTML = `
        <div class="ex-error-icon">⚠</div>
        <div class="ex-error-msg">Erro ao carregar dados do globo.</div>
        <button class="ex-retry-btn" id="ex-globe-retry">Tentar novamente</button>`;
      document.getElementById('ex-globe-retry')?.addEventListener('click', _initGlobe);
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
    const lonR = lon * Math.PI / 180, latR = lat * Math.PI / 180;
    let x = Math.cos(latR) * Math.cos(lonR);
    let y = Math.sin(latR);
    let z = Math.cos(latR) * Math.sin(lonR);
    const cy = Math.cos(_gRotY), sy = Math.sin(_gRotY);
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    const cx = Math.cos(_gRotX), sx = Math.sin(_gRotX);
    const y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
    return { x: x1, y: y1, z: z2 };
  }

  function _startGlobeTick() {
    const canvas = _gCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      const W = canvas.width / dpr, H = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2;
      ctx.clearRect(0, 0, W, H);

      /* Base globe */
      const g = ctx.createRadialGradient(cx + R * 0.12, cy - R * 0.18, 0, cx, cy, R);
      g.addColorStop(0, '#1e2d5c'); g.addColorStop(1, '#040810');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

      /* Country polygons */
      _gPolygons.forEach(({ cca3, rings }) => {
        const hov  = cca3 === _gHovered;
        const fave = _favorites.includes(cca3);
        rings.forEach(ring => {
          ctx.beginPath();
          let started = false;
          for (let k = 0; k < ring.length; k++) {
            const p = _gProject(ring[k][0], ring[k][1]);
            if (p.z < 0) { started = false; continue; }
            const sx = cx + p.x * R, sy = cy - p.y * R;
            if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
          }
          if (!started) return;
          ctx.closePath();
          ctx.fillStyle   = hov ? 'rgba(99,102,241,.65)' : fave ? 'rgba(239,68,68,.35)' : 'rgba(55,78,150,.4)';
          ctx.strokeStyle = hov ? 'rgba(99,102,241,1)'   : 'rgba(100,140,220,.3)';
          ctx.lineWidth   = hov ? 1.2 : 0.5;
          ctx.fill(); ctx.stroke();
        });
      });

      /* Glow rim */
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99,102,241,.2)'; ctx.lineWidth = 3; ctx.stroke();

      /* Night side subtle gradient */
      const ng = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
      ng.addColorStop(0, 'rgba(0,0,20,.28)'); ng.addColorStop(0.48, 'rgba(0,0,0,0)'); ng.addColorStop(1, 'rgba(0,0,10,.12)');
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = ng; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.restore();

      /* Hover label */
      if (_gHovered && _countriesOk) {
        const c = _countries.find(x => x.cca3 === _gHovered);
        if (c) {
          const lbl = `${c.flag || ''} ${c.name.common}`;
          ctx.font = `600 ${Math.max(11, Math.min(13, W / 55))}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          const tw = ctx.measureText(lbl).width;
          ctx.fillStyle = 'rgba(8,12,20,.82)';
          ctx.beginPath(); ctx.roundRect(cx - tw / 2 - 10, H - 44, tw + 20, 26, 6); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(lbl, cx, H - 26);
        }
      }
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

    canvas.addEventListener('mousedown', e => {
      dragging = true; lx = e.clientX; ly = e.clientY; _gRotYVel = 0;
      canvas.classList.add('dragging');
    });
    window.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      if (dragging) {
        _gRotY += (e.clientX - lx) * 0.005;
        _gRotX  = Math.max(-1.4, Math.min(1.4, _gRotX + (e.clientY - ly) * 0.005));
        lx = e.clientX; ly = e.clientY;
      } else {
        _gHovered = _globePickCountry(e.clientX - r.left, e.clientY - r.top);
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
      const cca3 = _globePickCountry(e.clientX - r.left, e.clientY - r.top);
      if (!cca3) return;
      const sel = document.getElementById('ex-globe-sel');
      if (sel) {
        const c = _countries.find(x => x.cca3 === cca3);
        if (sel) sel.textContent = c ? c.name.common : cca3;
        if (c) showCountryPanel(c, '#ex-country-panel-globe');
      }
    });
  }

  /* ════════════════════════════════ TAB SYSTEM ══════════════════════ */
  function _buildShell(view) {
    view.innerHTML = `
      <div class="ex-shell">
        <div class="ex-tabs" id="ex-tabs">
          <button class="ex-tab active" data-tab="hub"><span class="ex-tab-icon">🏠</span> Início</button>
          <button class="ex-tab" data-tab="map"><span class="ex-tab-icon">🗺</span> Mapa</button>
          <button class="ex-tab" data-tab="globe"><span class="ex-tab-icon">🌍</span> Globo</button>
          <button class="ex-tab" data-tab="solar"><span class="ex-tab-icon">☀</span> Sistema Solar</button>
        </div>
        <div class="ex-content">
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
  }

  function _switchTab(tab) {
    if (!_shell) return;
    if (tab !== 'globe') _stopGlobeTick();
    if (tab !== 'solar' && _curTab === 'solar' && typeof SolarExplorer !== 'undefined') SolarExplorer.stop();
    _curTab = tab;

    _shell.querySelectorAll('.ex-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    _shell.querySelectorAll('.ex-sub').forEach(s => s.classList.toggle('active', s.id === `ex-sub-${tab}`));

    const sub = _shell.querySelector(`#ex-sub-${tab}`);
    if (!sub) return;

    if (tab === 'hub') {
      _renderHub(sub);
    } else if (tab === 'map') {
      if (!_lInited) { _renderMapShell(sub); _initMap(); }
      else setTimeout(() => _lMap?.invalidateSize(), 80);
    } else if (tab === 'globe') {
      if (!_gInited) { _renderGlobeShell(sub); _initGlobe(); }
      else if (!_gRaf) _startGlobeTick();
    } else if (tab === 'solar') {
      if (typeof SolarExplorer !== 'undefined') {
        if (!sub.querySelector('.ex-solar-wrap')) SolarExplorer.mount(sub);
        else SolarExplorer.resume();
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
