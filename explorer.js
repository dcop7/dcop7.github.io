/* ══════════════════════════════════════════════════════════════════
   EXPLORER PAGE — World Map, WebGL Globe, Solar System
══════════════════════════════════════════════════════════════════ */
const ExplorerPage = (function () {
  'use strict';

  /* ── Shared data ── */
  let _countries   = [];
  let _geoJson     = null;
  let _favorites   = [];
  let _recent      = [];
  let _countriesOk = false;
  let _geoJsonOk   = false;

  /* ── Globe state (globe.gl) ── */
  let _globeGL         = null;
  let _globeInited     = false;
  let _globeResizeObs  = null;
  let _globeView       = 'realistic';   /* 'realistic' | 'daynight' | 'political' */
  let _globeHovered    = null;
  let _byCca3          = {};
  let _updateGlobeColors = null;
  let _globeMatUniforms = null;         /* day/night ShaderMaterial uniforms, if active */
  let _globeSunTimer    = null;
  let _cloudsMesh       = null;
  let _cloudsRAF        = null;

  /* ── Leaflet state ── */
  let _lMap        = null;
  let _lTile       = null;
  let _lLayer      = null;
  let _lLabels     = null;          /* country-name label layer (progressive by zoom) */
  let _lSatLabels  = null;          /* Esri reference overlay shown in satellite mode */
  let _lInited     = false;
  let _lDataLoaded = false;
  let _contFilter  = 'all';
  let _themeObs    = null;
  let _mapView     = 'political';   /* 'political' | 'satellite' | 'night' */
  let _nightOverlay = null;
  let _nightLayer   = null;

  /* ── Tab/shell ── */
  let _shell  = null;
  let _curTab = 'hub';

  /* ── Constants ── */
  const TTL = 86400000;
  /* Country data + boundaries are bundled locally (data/*) — no runtime dependency
     on third-party APIs, instant load, works offline. Generated from mledoze/countries
     + World Bank population + moment-timezone (see git history). */
  const COUNTRIES_URL = 'data/countries.json';
  const GEOJSON_URL   = 'data/world-countries.geojson';

  /* three-globe CDN — confirmed working 2025 */
  const GLOBE_TEX = {
    day:   'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
    night: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
    bump:  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
    space: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png',
  };

  /* Day/night globe shader (after vasturiano's globe.gl night-day example).
     Blends day + night textures by the real sun direction; the `dayNight`
     uniform forces full daylight (0) or the live terminator (1). */
  const GLOBE_VERT = `
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const GLOBE_FRAG = `
    #define PI 3.1415926538
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform vec2 sunPosition;
    uniform vec2 globeRotation;
    uniform float dayNight;
    varying vec3 vNormal;
    varying vec2 vUv;
    float toRad(in float a) { return a * PI / 180.0; }
    vec3 polar2Cartesian(in vec2 c) {
      float theta = toRad(90.0 - c.x);
      float phi   = toRad(90.0 - c.y);
      return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
    }
    void main() {
      float invLon = toRad(globeRotation.x);
      float invLat = -toRad(globeRotation.y);
      mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
      mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
      vec3 sunDir = rotX * rotY * polar2Cartesian(sunPosition);
      float intensity = dot(normalize(vNormal), normalize(sunDir));
      vec3 dayColor   = texture2D(dayTexture, vUv).rgb;
      vec3 nightColor = texture2D(nightTexture, vUv).rgb;
      float blend = mix(1.0, smoothstep(-0.12, 0.18, intensity), dayNight);
      vec3 col = mix(nightColor, dayColor, blend);
      /* The raw texture rendered unlit looks flat and overexposed. Deepen it
         with a gentle gamma + contrast so oceans/land/terrain read naturally. */
      col = pow(col, vec3(1.13));
      col = (col - 0.5) * 1.10 + 0.5;
      /* Limb darkening — darken grazing-angle edges so the sphere reads as a
         3D Earth instead of a glowing white disc. vNormal is the view-space
         normal; the view direction in view space is +Z. */
      float facing = clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
      col *= mix(0.70, 1.0, pow(facing, 0.55));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;

  const CONT_COLORS = {
    Africa:     'rgba(245,158,11,.55)',
    Americas:   'rgba(34,197,94,.55)',
    Asia:       'rgba(239,68,68,.55)',
    Europe:     'rgba(99,102,241,.55)',
    Oceania:    'rgba(6,182,212,.55)',
    Antarctica: 'rgba(148,163,184,.45)',
  };

  const MAP_TILES = {
    political: {
      dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attr:  '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
      sub:   'abcd',
    },
    satellite: {
      url:  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attr: '© <a href="https://esri.com">Esri</a>, Maxar, Earthstar Geographics',
      sub:  '',
      /* Place/boundary reference labels drawn on top of the imagery. */
      ref:  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    },
  };

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

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = Object.assign(document.createElement('script'), { src });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function _isDark() { return !document.body.classList.contains('light'); }

  function _cartoPoliticalUrl() {
    return _isDark() ? MAP_TILES.political.dark : MAP_TILES.political.light;
  }

  /* ── Solar position (Julian day math) ── */
  function _sunPos() {
    const d = Date.now() / 86400000 + 2440587.5 - 2451545;
    const M = (357.5291 + 0.98560028 * d) * Math.PI / 180;
    const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * Math.PI / 180;
    const lsun = M + C + (283.0 + 180) * Math.PI / 180;
    const dec  = Math.asin(Math.sin(23.4397 * Math.PI / 180) * Math.sin(lsun));
    const ra   = Math.atan2(Math.cos(23.4397 * Math.PI / 180) * Math.sin(lsun), Math.cos(lsun));
    const LMST = (280.46061837 + 360.98564736629 * d) * Math.PI / 180;
    return {
      lat: dec * 180 / Math.PI,
      lon: (180 - ((LMST - ra) * 180 / Math.PI % 360 + 360) % 360),
    };
  }

  function _sunAlt(sunLat, sunLon, lat, lon) {
    const φ1 = sunLat * Math.PI / 180, φ2 = lat * Math.PI / 180;
    const Δλ = (lon - sunLon) * Math.PI / 180;
    return Math.asin(Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * 180 / Math.PI;
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
    if (btn) {
      const on = _favorites.includes(cca3);
      btn.classList.toggle('active', on);
      btn.innerHTML = `<span class="ex-fave-btn-icon">${on ? '❤' : '🤍'}</span> ${on ? 'Guardado' : 'Favorito'}`;
    }
    _updateGlobeColors?.();
  }

  /* ════════════════════════════════ DATA FETCH ══════════════════════ */
  async function _fetchCountries() {
    /* Bundled same-origin file — fast, cached by the SW, available offline. */
    const r = await _fetchTimeout(COUNTRIES_URL, 12000);
    return r.json();
  }

  async function _fetchGeoJson() {
    if (_geoJson) return _geoJson;
    const r = await _fetchTimeout(GEOJSON_URL, 12000);
    return r.json();
  }

  /* Wikipedia summary → short excerpt + lead image (Wikimedia Commons,
     freely-licensed). Returns { text, image } (either may be null). */
  async function _fetchWiki(name) {
    const key = `ex-wiki2-${name}`;
    try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch (e) {}
    try {
      const r = await _fetchTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`, 6000);
      const d = await r.json();
      const text = d.extract_html
        ? d.extract_html.replace(/<[^>]+>/g, '').slice(0, 300)
        : (d.extract || '').slice(0, 300);
      const image = (d.thumbnail && d.thumbnail.source) || null;
      const out = { text: text || null, image };
      try { sessionStorage.setItem(key, JSON.stringify(out)); } catch (e) {}
      return out;
    } catch (e) { return { text: null, image: null }; }
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
    const tzList  = country.timezones || [];
    const tz      = tzList.length ? tzList.join(', ') : '—';
    const region  = [country.region, country.subregion].filter(Boolean).join(' · ') || '—';
    const ll      = country.latlng || [];
    const coords  = ll.length === 2
      ? `${Math.abs(ll[0]).toFixed(1)}°${ll[0] >= 0 ? 'N' : 'S'}, ${Math.abs(ll[1]).toFixed(1)}°${ll[1] >= 0 ? 'E' : 'W'}`
      : '—';
    const density = (country.area > 0 && country.population > 0)
      ? Math.round(country.population / country.area).toLocaleString('pt') + ' hab/km²' : '—';
    const isFave  = _favorites.includes(country.cca3);
    const flag    = country.flags?.svg || country.flags?.png || '';
    const facts   = _countryFacts(country);
    /* Resolve neighbour codes to {flag, name} for richer border chips. */
    const byCca3  = (_byCca3 && Object.keys(_byCca3).length) ? _byCca3 : _byCode();
    const neighbours = (country.borders || []).map(code => {
      const n = byCca3[code];
      return { code, name: n?.name?.common || code, flag: n?.flag || '' };
    });

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
          <a class="ex-wiki-btn" href="https://commons.wikimedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}"
             target="_blank" rel="noopener">🖼 Commons</a>
        </div>
        <div class="ex-panel-rows">
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🏙</span><span class="ex-panel-label">Capital</span><span class="ex-panel-value">${capital}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">👥</span><span class="ex-panel-label">População</span><span class="ex-panel-value">${pop}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">📐</span><span class="ex-panel-label">Área</span><span class="ex-panel-value">${area}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">💰</span><span class="ex-panel-label">Moeda</span><span class="ex-panel-value">${curr}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🗣</span><span class="ex-panel-label">Línguas</span><span class="ex-panel-value">${langs}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">👣</span><span class="ex-panel-label">Densidade</span><span class="ex-panel-value">${density}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🌍</span><span class="ex-panel-label">Continente</span><span class="ex-panel-value">${cont}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🗺</span><span class="ex-panel-label">Região</span><span class="ex-panel-value">${region}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">📍</span><span class="ex-panel-label">Coordenadas</span><span class="ex-panel-value" style="font-family:var(--font-mono);font-size:.76rem">${coords}</span></div>
          <div class="ex-panel-row"><span class="ex-panel-row-icon">🕐</span><span class="ex-panel-label">Fuso${tzList.length > 1 ? 's' : ''} horário${tzList.length > 1 ? 's' : ''}</span><span class="ex-panel-value">${tz}</span></div>
        </div>
        ${facts.length ? `<div class="ex-panel-facts">
          ${facts.map(f => `<div class="ex-panel-fact">💡 ${f}</div>`).join('')}
        </div>` : ''}
        <div class="ex-panel-excerpt" id="ex-panel-excerpt">
          <div class="ex-panel-excerpt-loading">A carregar…</div>
        </div>
        ${neighbours.length ? `
          <div class="ex-panel-borders-label">Países vizinhos (${neighbours.length})</div>
          <div class="ex-panel-borders">
            ${neighbours.map(n => `<button class="ex-panel-border-chip" data-cca3="${n.code}">${n.flag ? `<span class="ex-border-chip-flag">${n.flag}</span>` : ''}${n.name}</button>`).join('')}
          </div>`
          : `<div class="ex-panel-borders-label">Fronteiras</div>
             <div class="ex-panel-island-note">🏝 Sem fronteiras terrestres${country.area && country.area < 1000000 ? ' — nação ilha' : ''}.</div>`}
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

    _fetchWiki(name).then(({ text }) => {
      const el = panel.querySelector('#ex-panel-excerpt');
      if (!el) return;
      /* Text-only excerpt. We deliberately do NOT render the Wikipedia lead
         image: its per-file licence cannot be verified at runtime, and the
         project's policy is "if licence is unverified, do not use the image" —
         the Wikipedia/Commons links below are the compliant visual fallback. */
      el.innerHTML = text ? `<p>${text}${text.length >= 298 ? '…' : ''}</p>` : '';
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
            <div class="ex-feature-card-desc">Globo WebGL realista com atmosfera, texturas e modos político e noturno.</div>
          </div>
          <div class="ex-feature-card ex-feature-card--portugal" data-tab="portugal">
            <span class="ex-feature-card-icon">🇵🇹</span>
            <div class="ex-feature-card-title">Portugal</div>
            <div class="ex-feature-card-desc">Explora os 20 distritos com história, gastronomia, tradições e curiosidades de cada região.</div>
          </div>
          <div class="ex-feature-card" data-tab="solar">
            <span class="ex-feature-card-icon">☀</span>
            <div class="ex-feature-card-title">Sistema Solar</div>
            <div class="ex-feature-card-desc">Vê os planetas em 3D com texturas reais, clica para explorar factos e comparações.</div>
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

    sub.querySelector('#ex-discover-btn').onclick = () => _discoverRandom();
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
        <div class="ex-map-view-btns" id="ex-map-view-btns">
          <button class="ex-map-view-btn active" data-view="political">Político</button>
          <button class="ex-map-view-btn" data-view="satellite">Satélite</button>
          <button class="ex-map-view-btn" data-view="night">Dia/Noite</button>
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

  /* ── Night overlay (custom Leaflet layer) ── */
  function _createNightOverlayClass() {
    return L.Layer.extend({
      onAdd(map) {
        this._map = map;
        const pane = map.getPane('overlayPane');
        this._canvas = document.createElement('canvas');
        Object.assign(this._canvas.style, {
          position: 'absolute', top: '0', left: '0',
          pointerEvents: 'none', zIndex: '300',
        });
        pane.appendChild(this._canvas);
        map.on('moveend zoomend resize viewreset', this._draw, this);
        this._draw();
        this._tid = setInterval(() => this._draw(), 60000);
      },
      onRemove(map) {
        this._canvas?.remove();
        map.off('moveend zoomend resize viewreset', this._draw, this);
        clearInterval(this._tid);
      },
      _draw() {
        if (!this._map) return;
        const sz  = this._map.getSize();
        const cvs = this._canvas;
        cvs.width  = sz.x; cvs.height = sz.y;
        cvs.style.width  = sz.x + 'px';
        cvs.style.height = sz.y + 'px';
        const ctx = cvs.getContext('2d');
        const sun = _sunPos();
        const RES = 6;
        for (let y = 0; y < sz.y; y += RES) {
          for (let x = 0; x < sz.x; x += RES) {
            const ll  = this._map.containerPointToLatLng([x + RES / 2, y + RES / 2]);
            const alt = _sunAlt(sun.lat, sun.lon, ll.lat, ll.lng);
            if (alt < 6) {
              const t = Math.max(0, Math.min(1, (-alt + 6) / 12));
              ctx.fillStyle = `rgba(0,5,25,${(t * 0.72).toFixed(3)})`;
              ctx.fillRect(x, y, RES, RES);
            }
          }
        }
      },
    });
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

    const mapEl = document.getElementById('ex-leaflet-map');
    if (!mapEl) return;

    _lMap = L.map(mapEl, { center: [20, 10], zoom: 2, minZoom: 1, maxZoom: 6, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(_lMap);

    _lTile = L.tileLayer(_cartoPoliticalUrl(), {
      attribution: MAP_TILES.political.attr,
      subdomains: MAP_TILES.political.sub,
    }).addTo(_lMap);

    _nightOverlay = _createNightOverlayClass();

    if (_themeObs) _themeObs.disconnect();
    _themeObs = new MutationObserver(() => {
      if (!_lMap || !_lTile) return;
      if (_mapView === 'political') {
        _lMap.removeLayer(_lTile);
        _lTile = L.tileLayer(_cartoPoliticalUrl(), {
          attribution: MAP_TILES.political.attr,
          subdomains: MAP_TILES.political.sub,
        }).addTo(_lMap);
      }
    });
    _themeObs.observe(document.body, { attributeFilter: ['class'] });

    document.getElementById('ex-map-loading')?.remove();
    _lInited = true;

    document.getElementById('ex-map-random')?.addEventListener('click', () => {
      if (_countriesOk) showCountryPanel(_countries[Math.floor(Math.random() * _countries.length)], '#ex-country-panel');
    });

    _wireMapViewBtns();
    _loadMapData();
  }

  function _wireMapViewBtns() {
    const bar = document.getElementById('ex-map-view-btns');
    if (!bar) return;
    bar.addEventListener('click', e => {
      const btn = e.target.closest('.ex-map-view-btn');
      if (!btn) return;
      _setMapView(btn.dataset.view);
      bar.querySelectorAll('.ex-map-view-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  }

  function _setMapView(view) {
    if (!_lMap) return;
    _mapView = view;

    /* Remove existing tile, satellite labels, and night layer */
    if (_lTile) { _lMap.removeLayer(_lTile); _lTile = null; }
    if (_lSatLabels) { _lMap.removeLayer(_lSatLabels); _lSatLabels = null; }
    if (_nightLayer) { _lMap.removeLayer(_nightLayer); _nightLayer = null; }

    if (view === 'satellite') {
      _lTile = L.tileLayer(MAP_TILES.satellite.url, {
        attribution: MAP_TILES.satellite.attr,
        maxZoom: 18,
      }).addTo(_lMap);
      /* Reference labels overlay so satellite mode isn't label-less. */
      _lSatLabels = L.tileLayer(MAP_TILES.satellite.ref, { maxZoom: 18, pane: 'shadowPane' }).addTo(_lMap);
    } else if (view === 'night') {
      _lTile = L.tileLayer(_cartoPoliticalUrl(), {
        attribution: MAP_TILES.political.attr,
        subdomains: MAP_TILES.political.sub,
      }).addTo(_lMap);
      _nightLayer = new _nightOverlay().addTo(_lMap);
    } else {
      _lTile = L.tileLayer(_cartoPoliticalUrl(), {
        attribution: MAP_TILES.political.attr,
        subdomains: MAP_TILES.political.sub,
      }).addTo(_lMap);
    }

    /* Bring country layer to front if present */
    if (_lLayer) _lLayer.bringToFront();
  }

  async function _loadMapData() {
    if (_lDataLoaded) return;
    _setDataStatus('loading', 'A carregar dados dos países…');

    const [cr, gr] = await Promise.allSettled([
      _countriesOk ? Promise.resolve(_countries) : _fetchCountries(),
      _geoJsonOk   ? Promise.resolve(_geoJson)   : _fetchGeoJson(),
    ]);

    if (cr.status === 'fulfilled') { _countries = cr.value; _countriesOk = true; }
    if (gr.status === 'fulfilled') { _geoJson = gr.value; _geoJsonOk = true; }

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
    _lLabels = L.layerGroup();

    _lLayer = L.geoJSON(_geoJson, {
      style: () => ({
        fillColor: '#6366f1',
        fillOpacity: 0.12,
        color: _isDark() ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)',
        weight: 0.8,
      }),
      onEachFeature(feature, layer) {
        const c = byCca3[feature.id];
        layer.on({
          mouseover(e) { e.target.setStyle({ fillOpacity: 0.42, color: 'rgba(99,102,241,0.85)', weight: 1.4 }); },
          mouseout(e)  { _lLayer?.resetStyle(e.target); },
          click() {
            /* Fly to country bounds */
            try { _lMap.flyToBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 6, duration: 0.7 }); } catch (e) {}
            if (c) {
              showCountryPanel(c, '#ex-country-panel');
            } else {
              _showMapMinimalPanel(feature);
            }
          },
        });
        /* Progressive label: flag emoji + name, placed at the polygon centre.
           minZoom scales with country size so large countries label first. */
        if (c) {
          let center;
          try { center = layer.getBounds().getCenter(); } catch (e) { return; }
          const area = c.area || 0;
          const minZoom = area > 3e6 ? 2 : area > 7e5 ? 3 : area > 1.2e5 ? 4 : 5;
          const marker = L.marker(center, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: 'ex-country-label',
              html: `<span class="ex-cl-flag">${c.flag || ''}</span><span class="ex-cl-name">${c.name.common}</span>`,
              iconSize: [0, 0],
            }),
          });
          marker._minZoom = minZoom;
          _lLabels.addLayer(marker);
        }
      },
    }).addTo(_lMap);

    _lLabels.addTo(_lMap);
    _lMap.on('zoomend', _updateLabelVisibility);
    _updateLabelVisibility();

    _wireMapSearch(byCca3);
    _wireContinent(byCca3);
  }

  /* Show only labels whose size-based threshold is met at the current zoom. */
  function _updateLabelVisibility() {
    if (!_lLabels || !_lMap) return;
    const z = _lMap.getZoom();
    _lLabels.eachLayer(m => {
      const el = m.getElement();
      if (el) el.style.display = z >= (m._minZoom || 5) ? '' : 'none';
    });
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
        const c  = byCca3[layer.feature?.id];
        const ok = _contFilter === 'all' || (c?.continents || []).includes(_contFilter);
        layer.setStyle({
          fillOpacity: ok ? 0.12 : 0.03,
          color: ok ? (_isDark() ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.15)') : 'rgba(128,128,128,.05)',
        });
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
      const hits = _countries.filter(c =>
        c.name.common.toLowerCase().includes(q) || (c.cca3 || '').toLowerCase().includes(q)
      ).slice(0, 8);
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
      else if (e.key === 'ArrowUp')  _fi = Math.max(_fi - 1, 0);
      else if (e.key === 'Enter') { items[Math.max(_fi, 0)]?.click(); return; }
      else if (e.key === 'Escape') { results.classList.remove('open'); return; }
      items.forEach((it, i) => it.classList.toggle('focused', i === _fi));
    });
    clear.onclick = () => { input.value = ''; results.classList.remove('open'); };
    document.addEventListener('click', e => {
      if (!e.target.closest('.ex-search-bar')) results.classList.remove('open');
    }, { capture: true });
  }

  /* ════════════════════════════════ GLOBE (globe.gl) ════════════════ */
  function _renderGlobeShell(sub) {
    sub.innerHTML = `
      <div class="ex-globe-wrap">
        <div id="ex-globe-container"></div>
        <div class="ex-loading" id="ex-globe-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-loading-text" id="ex-globe-loading-txt">A carregar o globo…</div>
        </div>
        <div class="ex-globe-view-bar" id="ex-globe-view-bar">
          <button class="ex-globe-view-btn active" data-view="realistic">Realista</button>
          <button class="ex-globe-view-btn" data-view="daynight">☀ Dia/Noite</button>
          <button class="ex-globe-view-btn" data-view="political">Político</button>
        </div>
        <div class="ex-globe-hint">Arrasta para rodar · Clica num país para explorar</div>
        <div class="ex-globe-stats">
          <div class="ex-globe-stat">Países <span class="ex-globe-stat-val" id="ex-globe-count">—</span></div>
          <div class="ex-globe-stat">Em destaque <span class="ex-globe-stat-val" id="ex-globe-sel">—</span></div>
        </div>
        <div class="ex-country-panel" id="ex-country-panel-globe"></div>
      </div>`;
  }

  /* Wait until an element has non-zero clientWidth (rAF poll, max ~2 s) */
  function _waitForSize(el) {
    return new Promise(resolve => {
      if (el.clientWidth > 0 && el.clientHeight > 0) { resolve(); return; }
      let tries = 0;
      const check = () => {
        if (el.clientWidth > 0 && el.clientHeight > 0) { resolve(); return; }
        if (++tries < 60) requestAnimationFrame(check); else resolve();
      };
      requestAnimationFrame(check);
    });
  }

  async function _initGlobe() {
    if (_globeInited) {
      document.getElementById('ex-globe-loading')?.remove();
      return;
    }

    const setTxt = t => { const el = document.getElementById('ex-globe-loading-txt'); if (el) el.textContent = t; };
    setTxt('A carregar dados dos países…');

    /* Load data */
    try {
      if (!_countriesOk) { _countries = await _fetchCountries(); _countriesOk = true; }
    } catch (e) { /* globe works without country data */ }

    try {
      setTxt('A carregar mapa do mundo…');
      if (!_geoJsonOk) { _geoJson = await _fetchGeoJson(); _geoJsonOk = true; }
    } catch (e) {
      const ld = document.getElementById('ex-globe-loading');
      if (ld) ld.innerHTML = `
        <div class="ex-error-icon">⚠</div>
        <div class="ex-error-msg">Erro ao carregar dados do globo.</div>
        <button class="ex-retry-btn" id="ex-globe-retry">Tentar novamente</button>`;
      document.getElementById('ex-globe-retry')?.addEventListener('click', _initGlobe);
      return;
    }

    /* Load globe.gl (pinned version — confirmed working) */
    setTxt('A inicializar globo 3D…');
    /* Load THREE first (same version SolarExplorer uses, usually cached) so we
       can build the day/night ShaderMaterial. Non-fatal if it fails. */
    try { await _loadScript('https://unpkg.com/three@0.160.0/build/three.min.js'); } catch (e) {}
    try {
      await _loadScript('https://unpkg.com/globe.gl@2.27.2/dist/globe.gl.min.js');
    } catch (e) {
      const ld = document.getElementById('ex-globe-loading');
      if (ld) ld.innerHTML = `
        <div class="ex-error-icon">⚠</div>
        <div class="ex-error-msg">Erro ao carregar globo WebGL.<br>Verifica a ligação à internet.</div>
        <button class="ex-retry-btn" id="ex-globe-retry2">Tentar novamente</button>`;
      document.getElementById('ex-globe-retry2')?.addEventListener('click', _initGlobe);
      return;
    }

    const container = document.getElementById('ex-globe-container');
    if (!container || typeof Globe === 'undefined') return;

    /* Wait for container to have real pixel dimensions before WebGL init */
    await _waitForSize(container);

    _byCca3 = _byCode();

    const getCapColor = f => {
      if (!f) return 'rgba(0,0,0,0)';
      if (f === _globeHovered) return 'rgba(255,255,255,0.85)';
      if (_favorites.includes(f.id)) return 'rgba(239,68,68,0.55)';
      if (_globeView === 'political') {
        const c = _byCca3[f.id];
        return CONT_COLORS[(c?.continents || [''])[0]] || 'rgba(150,150,150,0.45)';
      }
      /* Realistic / day-night: transparent caps so the Earth texture shows through. */
      return 'rgba(0,0,0,0)';
    };
    const getCapAlt = f => f === _globeHovered ? 0.006 : (_globeView === 'political' ? 0.003 : 0.001);

    _globeGL = Globe({ animateIn: true })(container)
      .width(container.clientWidth)
      .height(container.clientHeight)
      .backgroundImageUrl(GLOBE_TEX.space)
      .showAtmosphere(true)
      .atmosphereColor('#5a8fd0')
      .atmosphereAltitude(0.12)
      .polygonsData(_geoJson.features)
      .polygonCapColor(getCapColor)
      .polygonSideColor(() => 'rgba(0,0,0,0.1)')
      .polygonStrokeColor(() => 'rgba(255,255,255,0.22)')
      .polygonAltitude(getCapAlt)
      .onPolygonHover(f => {
        _globeHovered = f;
        _globeGL.polygonCapColor(getCapColor);
        const sel = document.getElementById('ex-globe-sel');
        if (sel) sel.textContent = f ? (_byCca3[f.id]?.name.common || f.id) : '—';
      })
      .onPolygonClick(f => {
        if (!f) return;
        const c = _byCca3[f.id];
        /* Smooth fly-to using the country's bundled centroid when available. */
        const ll = c?.latlng;
        if (ll && ll.length === 2) {
          _globeGL.pointOfView({ lat: ll[0], lng: ll[1], altitude: 1.6 }, 900);
        }
        if (c) showCountryPanel(c, '#ex-country-panel-globe');
        else   _showGlobeMinimalPanel(f);
      });

    /* Vivid day/night globe material (raw textures, no Phong wash). Falls back to
       the classic textured material if THREE / the shader is unavailable. */
    _setupGlobeMaterial();
    _setupClouds();

    _updateGlobeColors = () => {
      if (!_globeGL) return;
      _globeGL.polygonCapColor(getCapColor);
    };

    /* Wire view buttons */
    const bar = document.getElementById('ex-globe-view-bar');
    if (bar) {
      bar.addEventListener('click', e => {
        const btn = e.target.closest('.ex-globe-view-btn');
        if (!btn) return;
        bar.querySelectorAll('.ex-globe-view-btn').forEach(b => b.classList.toggle('active', b === btn));
        _setGlobeView(btn.dataset.view);
      });
    }

    /* ResizeObserver — stored so it can be disconnected on shell rebuild */
    _globeResizeObs = new ResizeObserver(() => {
      if (!_globeGL || !container) return;
      _globeGL.width(container.clientWidth).height(container.clientHeight);
    });
    _globeResizeObs.observe(container);

    /* Force correct size after init (handles late-layout edge cases) */
    setTimeout(() => {
      if (_globeGL && container.clientWidth > 0) {
        _globeGL.width(container.clientWidth).height(container.clientHeight);
      }
    }, 300);

    const countEl = document.getElementById('ex-globe-count');
    if (countEl) countEl.textContent = _countries.length;

    /* Neutral startup: no country selected/highlighted, panel closed, and a
       calm ocean-centred view so nothing reads as a default selection. */
    _globeHovered = null;
    _globeGL.pointOfView({ lat: 20, lng: -40, altitude: 2.5 }, 0);
    const selEl = document.getElementById('ex-globe-sel');
    if (selEl) selEl.textContent = '—';
    const gPanel = document.getElementById('ex-country-panel-globe');
    if (gPanel) { gPanel.classList.remove('open'); gPanel.innerHTML = ''; }
    _updateGlobeColors?.();

    document.getElementById('ex-globe-loading')?.remove();
    _globeInited = true;
  }

  /* Build the day/night ShaderMaterial and wire its uniforms. Falls back to the
     classic textured globe if THREE or the shader is unavailable. */
  function _setupGlobeMaterial() {
    const T = window.THREE;
    if (!T || !_globeGL) { _globeFallbackMaterial(); return; }
    try {
      const loader   = new T.TextureLoader();
      const dayTex   = loader.load(GLOBE_TEX.day);
      const nightTex = loader.load(GLOBE_TEX.night);
      if (T.SRGBColorSpace) { dayTex.colorSpace = T.SRGBColorSpace; nightTex.colorSpace = T.SRGBColorSpace; }
      const uniforms = {
        dayTexture:    { value: dayTex },
        nightTexture:  { value: nightTex },
        sunPosition:   { value: new T.Vector2() },
        globeRotation: { value: new T.Vector2() },
        dayNight:      { value: 0 },
      };
      const mat = new T.ShaderMaterial({ uniforms, vertexShader: GLOBE_VERT, fragmentShader: GLOBE_FRAG });
      _globeGL.globeMaterial(mat);
      _globeMatUniforms = uniforms;
      /* Keep the shader's sun direction aligned with the camera POV. */
      _globeGL.onZoom(pov => {
        if (_globeMatUniforms && pov) _globeMatUniforms.globeRotation.value.set(pov.lng, pov.lat);
      });
      _updateSunUniform();
      if (_globeSunTimer) clearInterval(_globeSunTimer);
      _globeSunTimer = setInterval(_updateSunUniform, 60000);
    } catch (e) {
      _globeFallbackMaterial();
    }
  }

  function _updateSunUniform() {
    if (!_globeMatUniforms) return;
    const s = _sunPos();
    _globeMatUniforms.sunPosition.value.set(s.lon, s.lat);
  }

  /* Translucent, slowly-drifting cloud layer for realism (three-globe asset,
     MIT). Lazy and managed: the rAF is cancelled on globe teardown. The 5 MB
     texture loads only when the globe view is opened. */
  const CLOUDS_URL = 'https://unpkg.com/three-globe/example/clouds/clouds.png';
  function _setupClouds() {
    const T = window.THREE;
    if (!T || !_globeGL || _cloudsMesh) return;
    try {
      const R = _globeGL.getGlobeRadius ? _globeGL.getGlobeRadius() : 100;
      const mat = new T.MeshLambertMaterial({ transparent: true, opacity: 0.42, depthWrite: false });
      _cloudsMesh = new T.Mesh(new T.SphereGeometry(R * 1.015, 64, 64), mat);
      new T.TextureLoader().load(CLOUDS_URL, tex => {
        if (!_cloudsMesh) return;
        mat.map = tex; mat.alphaMap = tex; mat.needsUpdate = true;
      });
      _globeGL.scene().add(_cloudsMesh);
      const drift = () => {
        if (!_cloudsMesh) return;
        _cloudsMesh.rotation.y += 0.0004;
        /* Hidden in the flat "political" view where realism isn't the point. */
        _cloudsMesh.visible = _globeView !== 'political';
        _cloudsRAF = requestAnimationFrame(drift);
      };
      _cloudsRAF = requestAnimationFrame(drift);
    } catch (e) { _cloudsMesh = null; }
  }

  function _globeFallbackMaterial() {
    /* No shader — use the classic textured material so the globe still works. */
    try { _globeGL.globeImageUrl(GLOBE_TEX.day).bumpImageUrl(GLOBE_TEX.bump); } catch (e) {}
  }

  function _setGlobeView(view) {
    if (!_globeGL) return;
    _globeView = view;
    if (_globeMatUniforms) {
      _globeMatUniforms.dayNight.value = (view === 'daynight') ? 1 : 0;
      _updateSunUniform();
    } else {
      /* Fallback material mode (no shader). */
      if (view === 'daynight') _globeGL.globeImageUrl(GLOBE_TEX.night).bumpImageUrl(null);
      else                     _globeGL.globeImageUrl(GLOBE_TEX.day).bumpImageUrl(GLOBE_TEX.bump);
    }
    _updateGlobeColors?.();
  }

  /* ════════════════════════════════ DISCOVER ════════════════════════ */
  function _discoverRandom() {
    const modes = ['map', 'globe', 'portugal', 'solar'];
    if (typeof PortugalExplorer === 'undefined') modes.splice(modes.indexOf('portugal'), 1);

    const mode = modes[Math.floor(Math.random() * modes.length)];

    if ((mode === 'map' || mode === 'globe') && _countriesOk && _countries.length) {
      const c = _countries[Math.floor(Math.random() * _countries.length)];
      const panelSel = mode === 'globe' ? '#ex-country-panel-globe' : '#ex-country-panel';
      _switchTab(mode);
      setTimeout(() => showCountryPanel(c, panelSel), 500);
    } else if (mode === 'portugal' && typeof PortugalExplorer !== 'undefined') {
      _switchTab('portugal');
      setTimeout(() => PortugalExplorer.discoverRandom(), 500);
    } else if (mode === 'solar') {
      _switchTab('solar');
    } else if (_countriesOk && _countries.length) {
      /* Fallback: show random country on map */
      const c = _countries[Math.floor(Math.random() * _countries.length)];
      _switchTab('map');
      setTimeout(() => showCountryPanel(c, '#ex-country-panel'), 500);
    }
  }

  function _showMapMinimalPanel(feature) {
    const panel = document.querySelector('#ex-country-panel');
    if (!panel) return;
    const name = feature.properties?.name || feature.id || 'País desconhecido';
    panel.innerHTML = `
      <button class="ex-panel-close" id="ex-panel-close">✕</button>
      <div class="ex-panel-flag-placeholder" style="font-size:3rem;display:flex;align-items:center;justify-content:center;height:120px;background:linear-gradient(135deg,var(--accent-soft),var(--bg2))">🌍</div>
      <div class="ex-panel-body">
        <div class="ex-panel-name">${name}</div>
        <div class="ex-panel-rows" style="margin-top:.75rem">
          <div class="ex-panel-row"><span class="ex-panel-row-icon">⚠</span><span class="ex-panel-label" style="color:var(--muted);font-size:.78rem">Dados detalhados indisponíveis. A ligar ao servidor…</span></div>
        </div>
        <a class="ex-wiki-btn" href="https://pt.wikipedia.org/wiki/${encodeURIComponent(name)}" target="_blank" rel="noopener" style="margin-top:1rem;display:inline-flex">📖 Wikipedia</a>
      </div>`;
    panel.classList.add('open');
    panel.querySelector('#ex-panel-close').onclick = () => panel.classList.remove('open');
  }

  function _showGlobeMinimalPanel(feature) {
    const panel = document.querySelector('#ex-country-panel-globe');
    if (!panel) return;
    const name = feature.properties?.name || feature.id || 'País desconhecido';
    panel.innerHTML = `
      <button class="ex-panel-close" id="ex-panel-close">✕</button>
      <div class="ex-panel-flag-placeholder" style="font-size:3rem;display:flex;align-items:center;justify-content:center;height:120px;background:linear-gradient(135deg,var(--accent-soft),var(--bg2))">🌍</div>
      <div class="ex-panel-body">
        <div class="ex-panel-name">${name}</div>
        <div style="font-size:.8rem;color:var(--muted);margin:.5rem 0 1rem">ID GeoJSON: ${feature.id || '—'}</div>
        <div class="ex-panel-rows">
          <div class="ex-panel-row"><span class="ex-panel-row-icon">⚠</span><span class="ex-panel-label" style="color:var(--muted)">Dados detalhados indisponíveis de momento. Tenta novamente mais tarde.</span></div>
        </div>
        <a class="ex-wiki-btn" href="https://pt.wikipedia.org/wiki/${encodeURIComponent(name)}" target="_blank" rel="noopener" style="margin-top:1rem;display:inline-flex">📖 Wikipedia</a>
      </div>`;
    panel.classList.add('open');
    panel.querySelector('#ex-panel-close').onclick = () => panel.classList.remove('open');
  }

  /* ════════════════════════════════ TAB SYSTEM ══════════════════════ */
  function _buildShell(view) {
    view.innerHTML = `
      <div class="ex-shell">
        <div class="ex-tabs" id="ex-tabs">
          <button class="ex-tab active" data-tab="hub"><span class="ex-tab-icon">🏠</span> Início</button>
          <button class="ex-tab" data-tab="map"><span class="ex-tab-icon">🗺</span> Mapa</button>
          <button class="ex-tab" data-tab="globe"><span class="ex-tab-icon">🌍</span> Globo</button>
          <button class="ex-tab" data-tab="portugal"><span class="ex-tab-icon">🇵🇹</span> Portugal</button>
          <button class="ex-tab" data-tab="solar"><span class="ex-tab-icon">☀</span> Sistema Solar</button>
        </div>
        <div class="ex-content">
          <div class="ex-sub active" id="ex-sub-hub"></div>
          <div class="ex-sub" id="ex-sub-map"></div>
          <div class="ex-sub" id="ex-sub-globe"></div>
          <div class="ex-sub" id="ex-sub-portugal"></div>
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
    if (tab !== 'solar' && _curTab === 'solar' && typeof SolarExplorer !== 'undefined') SolarExplorer.stop();
    if (tab !== 'portugal' && _curTab === 'portugal' && typeof PortugalExplorer !== 'undefined') PortugalExplorer.stop();
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
      if (!_globeInited) { _renderGlobeShell(sub); _initGlobe(); }
    } else if (tab === 'portugal') {
      if (typeof PortugalExplorer !== 'undefined') {
        if (!sub.querySelector('.pt-explorer-wrap')) PortugalExplorer.mount(sub);
        else PortugalExplorer.resume();
      }
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
      /* Disconnect old globe observer and reset state before rebuilding DOM */
      if (_globeResizeObs) { _globeResizeObs.disconnect(); _globeResizeObs = null; }
      if (_globeSunTimer) { clearInterval(_globeSunTimer); _globeSunTimer = null; }
      if (_cloudsRAF) { cancelAnimationFrame(_cloudsRAF); _cloudsRAF = null; }
      _cloudsMesh = null;
      _globeMatUniforms = null;
      _globeGL         = null;
      _globeInited     = false;
      _globeHovered    = null;
      _updateGlobeColors = null;
      _buildShell(view);
    }
    _switchTab(sub || 'hub');
  }

  return { show };
})();
