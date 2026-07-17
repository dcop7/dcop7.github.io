/* ══════════════════════════════════════════════════════════════════
   OCORRÊNCIAS PORTUGAL — Civil alerts & incidents dashboard
   Providers: USGS (earthquakes), ANEPC incidents (3-tier: API Aberta
   live w/ user key → fogos.pt direct → same-origin Action snapshot),
   IPMA (weather warnings). Satellite layers: NASA GIBS daily imagery,
   EFFIS/Copernicus fire hotspots + burnt areas.
══════════════════════════════════════════════════════════════════ */
const OcorrenciasPage = (function () {
  'use strict';

  /* ── API endpoints ── */
  /* USGS real-time feed — filtered client-side to Portugal/Atlantic bbox */
  const USGS_URL  = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_week.geojson';
  /* fogos.pt only sends Access-Control-Allow-Origin to its own origin now, so
     the direct call fails on GitHub Pages — kept as tier 2 (works in local dev
     and again if they ever reopen CORS). Tier 1 is API Aberta (open CORS,
     free X-API-Key, proxies the same SADO/fogos.pt data every 5 min); tier 3
     is the same-origin snapshot a GitHub Action refreshes every 15 min. */
  const APIABERTA_URL = 'https://api.apiaberta.pt/v1/anpc/incidents/active';
  const FOGOS_URL     = 'https://api.fogos.pt/v2/incidents/active';
  const SNAPSHOT_URL  = 'data/ocorrencias/ocorrencias.json';
  const IPMA_URL  = 'https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json';
  const KEY_LS    = 'apiaberta-key';
  const TTL       = 10 * 60 * 1000;
  const CACHE     = { eq: 'oc3-eq', fire: 'oc3-fire2', warn: 'oc3-warn' };

  /* Portugal + Atlantic seismic zones bounding box (covers mainland, Azores, Madeira) */
  const PT_BBOX = { minLat: 30, maxLat: 43, minLon: -31, maxLon: -6 };

  /* IPMA official area codes → district name (18 mainland + island groups) */
  const IPMA_AREA_TO_DISTRICT = {
    AVR: 'Aveiro',           BJA: 'Beja',             BRG: 'Braga',
    BGC: 'Bragança',         CBO: 'Castelo Branco',   CBR: 'Coimbra',
    EVR: 'Évora',            FAR: 'Faro',             GDA: 'Guarda',
    LRA: 'Leiria',           LSB: 'Lisboa',           PTO: 'Porto',
    PTG: 'Portalegre',       STB: 'Setúbal',          STM: 'Santarém',
    VCT: 'Viana do Castelo', VIS: 'Viseu',            VRL: 'Vila Real',
    MCN: 'Madeira',          MCS: 'Madeira',          MRM: 'Madeira',  MPS: 'Madeira',
    ACE: 'Açores',           AOC: 'Açores',           AOR: 'Açores',
  };

  /* Severity ordering and fill colours for warning polygon fills */
  const WARN_SEV = { red: 4, vermelho: 4, orange: 3, laranja: 3, yellow: 2, amarelo: 2 };
  const WARN_CLR = { red: '#ef4444', vermelho: '#ef4444', orange: '#f97316', laranja: '#f97316', yellow: '#eab308', amarelo: '#eab308' };

  /* Provider metadata for transparency panel */
  const PROVIDERS = {
    eq: {
      name: 'USGS Earthquake Hazards',
      icon: '🔴',
      official: true,
      freq: 'Tempo real (5 min)',
      scope: 'Sismos M≥1.0 — últimos 7 dias, Portugal e Atlântico',
      note: null,
    },
    fire: {
      name: 'ANEPC (via fogos.pt)',
      icon: '🔥',
      official: false,
      freq: 'Tempo real (sistema SADO da ANEPC)',
      scope: 'Portugal continental — ocorrências ativas de proteção civil',
      note: 'Dados do sistema SADO da ANEPC agregados pelo projeto cívico fogos.pt — não é uma fonte governamental direta.',
    },
    warn: {
      name: 'IPMA',
      icon: '⚠',
      official: true,
      freq: 'Contínua (avisos emitidos e retirados em tempo real)',
      scope: 'Portugal — avisos por distrito (18 continentais + ilhas)',
      note: null,
    },
  };

  /* Approximate district centroids for flyTo when clicking a warning in the list */
  const DISTRICT_CENTROIDS = {
    'Aveiro':           [40.64, -8.65],  'Beja':             [37.96, -7.87],
    'Braga':            [41.55, -8.42],  'Bragança':         [41.81, -6.76],
    'Castelo Branco':   [39.83, -7.49],  'Coimbra':          [40.21, -8.43],
    'Évora':            [38.57, -7.91],  'Faro':             [37.01, -7.93],
    'Guarda':           [40.53, -7.27],  'Leiria':           [39.74, -8.81],
    'Lisboa':           [38.72, -9.14],  'Porto':            [41.16, -8.62],
    'Portalegre':       [39.29, -7.43],  'Setúbal':          [38.52, -8.89],
    'Santarém':         [39.23, -8.69],  'Viana do Castelo': [41.69, -8.83],
    'Viseu':            [40.66, -7.91],  'Vila Real':        [41.30, -7.74],
    'Madeira':          [32.75, -17.00], 'Açores':           [37.74, -25.67],
  };

  /* ── Provider fetch status ── */
  const _prov = {
    eq:   { ok: null, time: null },
    fire: { ok: null, time: null },
    warn: { ok: null, time: null },
  };

  /* Which tier actually delivered the fire data (for the transparency panel):
     mode: 'live-key' (API Aberta) | 'live' (fogos.pt direct) | 'snapshot' | null.
     updated: epoch-ms of when that data was produced (snapshot build time). */
  let _fireSrc = { mode: null, updated: null };

  /* ── Module state ── */
  let _map               = null;
  let _inited            = false;
  let _layers            = { earthquake: true, fire: true, weather: true, hotspots: false, burnt: false };
  let _incidents         = [];
  let _activeFilter      = 'all';
  let _lEq               = null;
  let _lFire             = null;
  let _lHotspots         = null;   /* EFFIS satellite heat detections (WMS) */
  let _lBurnt            = null;   /* EFFIS near-real-time burnt areas (WMS) */
  let _gibsDate          = null;   /* resolved date of the newest GIBS imagery */
  let _districtGeoData   = null;
  let _districtBorderLayer = null;
  let _districtLabelLayer = null;
  let _warnFillLayer     = null;
  let _baseTile          = null;
  let _satLabelTile      = null;
  let _baseStyle         = 'standard';
  let _themeObs          = null;
  let _refreshing        = false;
  let _keyInvalid        = false;   /* last API Aberta call rejected the key */
  let _detailInc         = null;
  let _sortMode          = 'time';   /* 'time' | 'sev' — list ordering */
  let _lastLoadTs        = null;     /* epoch-ms of the last successful load */

  /* ── Session cache ── */
  function _cacheTimeStr(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts } = JSON.parse(raw);
      if (!ts) return null;
      return new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
  }
  function _fromCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > TTL) return null;
      return data;
    } catch (e) { return null; }
  }
  function _toCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
  }

  /* ── Fetch with abort timeout ── */
  function _fetch(url, ms = 12000, headers = null) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), ms);
    const opts = { signal: ctrl.signal };
    if (headers) opts.headers = headers;
    return fetch(url, opts).finally(() => clearTimeout(tid));
  }

  /* ── API Aberta key (stored only in this browser) ── */
  function _apiKey() {
    try { return (localStorage.getItem(KEY_LS) || '').trim() || null; } catch { return null; }
  }
  function _setApiKey(k) {
    try { k ? localStorage.setItem(KEY_LS, k.trim()) : localStorage.removeItem(KEY_LS); } catch (e) {}
  }

  /* ── Leaflet lazy load ── */
  async function _loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = Object.assign(document.createElement('link'), {
          rel: 'stylesheet',
          href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        });
        document.head.appendChild(link);
      }
      const s = Object.assign(document.createElement('script'), {
        src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ── Theme helpers ── */
  function _isDark() { return !document.body.classList.contains('light'); }

  /* ── Basemaps (user-selectable layer styles for geographic context) ── */
  const CARTO_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>';
  const ESRI_ATTR  = 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';
  const GIBS_ATTR  = 'Imagery © <a href="https://worldview.earthdata.nasa.gov/">NASA EOSDIS GIBS</a> (VIIRS)';
  const BASEMAPS = {
    standard: { name: 'Padrão',   url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', sub: 'abcd', attr: CARTO_ATTR },
    dark:     { name: 'Escuro',   url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',             sub: 'abcd', attr: CARTO_ATTR },
    satellite:{ name: 'Satélite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: '', attr: ESRI_ATTR },
  };
  /* Esri reference overlay (boundaries + place names) for the satellite+labels mode */
  const SAT_LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

  /* ── NASA GIBS daily true-colour imagery (the "what does the country look
     like from space TODAY" view — smoke plumes read instantly). VIIRS is
     375 m/px, native max zoom 9; today's pass lands mid-afternoon UTC, so we
     probe today → D-1 → D-2 with a single test tile over Portugal. ── */
  const GIBS_LAYER = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor';
  function _gibsUrl(date) {
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  }
  function _isoDaysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  }
  function _probeTile(url) {
    return new Promise(res => {
      const img = new Image();
      const t = setTimeout(() => { img.src = ''; res(false); }, 8000);
      img.onload  = () => { clearTimeout(t); res(true); };
      img.onerror = () => { clearTimeout(t); res(false); };
      img.src = url;
    });
  }
  async function _resolveGibsDate() {
    if (_gibsDate) return _gibsDate;
    try {
      const c = JSON.parse(sessionStorage.getItem('oc-gibs-date') || 'null');
      if (c && Date.now() - c.ts < 30 * 60 * 1000) { _gibsDate = c.date; return c.date; }
    } catch (e) {}
    for (let n = 0; n <= 2; n++) {
      const d = _isoDaysAgo(n);
      /* z6/y24/x30 covers mainland Portugal — one tiny probe per candidate day. */
      if (await _probeTile(_gibsUrl(d).replace('{z}/{y}/{x}', '6/24/30'))) {
        _gibsDate = d;
        try { sessionStorage.setItem('oc-gibs-date', JSON.stringify({ date: d, ts: Date.now() })); } catch (e) {}
        return d;
      }
    }
    return null;
  }

  /* ── EFFIS/Copernicus WMS overlays (satellite fire detections + burnt areas) ── */
  const EFFIS_WMS  = 'https://maps.effis.emergency.copernicus.eu/effis';
  const EFFIS_ATTR = '<a href="https://forest-fire.emergency.copernicus.eu/">EFFIS</a> © Copernicus';

  /* Apply a basemap style. Satellite modes disable the tile dimming filter and
     switch district borders/labels to a light, high-contrast treatment. */
  async function _setBasemap(style) {
    if (!_map) return;
    if (!BASEMAPS[style] && style !== 'satellite-labels' && style !== 'gibs') style = 'standard';
    _baseStyle = style;
    try { localStorage.setItem('oc-basemap', style); } catch (e) {}
    const sat = style === 'satellite' || style === 'satellite-labels' || style === 'gibs';

    if (_baseTile)     { _map.removeLayer(_baseTile);     _baseTile = null; }
    if (_satLabelTile) { _map.removeLayer(_satLabelTile); _satLabelTile = null; }

    if (style === 'gibs') {
      const date = await _resolveGibsDate();
      if (_baseStyle !== 'gibs') return;   /* user switched again while probing */
      if (!date) { _setBasemap('satellite'); return; }
      const isToday = date === _isoDaysAgo(0);
      _baseTile = L.tileLayer(_gibsUrl(date), {
        attribution: `${GIBS_ATTR} · ${isToday ? 'hoje' : date}`,
        maxNativeZoom: 9, maxZoom: 19,
      });
      const btn = document.querySelector('.oc-basemap-btn[data-base="gibs"]');
      if (btn) btn.title = `Imagem VIIRS de ${date}${isToday ? ' (hoje)' : ''} — 375 m/px, nitidez até zoom 9`;
    } else {
      const base = BASEMAPS[sat ? 'satellite' : style];
      _baseTile = L.tileLayer(base.url, { attribution: base.attr, subdomains: base.sub, maxZoom: 19 });
    }
    _baseTile.addTo(_map);
    _baseTile.bringToBack();

    if (style === 'satellite-labels') {
      _satLabelTile = L.tileLayer(SAT_LABELS_URL, { attribution: ESRI_ATTR, maxZoom: 19, pane: 'shadowPane' });
      _satLabelTile.addTo(_map);
    }

    const el = document.getElementById('oc-leaflet-map');
    if (el) el.classList.toggle('oc-sat', sat);
    document.querySelectorAll('.oc-basemap-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.base === style));

    _renderDistrictBorders();
    _renderDistrictLabels();
  }

  function _watchTheme() {
    if (_themeObs) return;
    /* The basemap is user-controlled now; the theme observer only restyles the
       vector overlays (borders + labels) so they stay legible after a theme flip. */
    _themeObs = new MutationObserver(() => {
      if (!_map) return;
      _renderDistrictBorders();
      _renderDistrictLabels();
    });
    _themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── District boundary GeoJSON (click_that_hood, 18 mainland districts) ── */
  const PT_DISTRICTS_GEO = 'data/pt-districts.geojson';

  async function _loadDistrictGeoData() {
    if (_districtGeoData || !_map) return;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(PT_DISTRICTS_GEO, { signal: ctrl.signal });
      if (!r.ok) return;
      _districtGeoData = await r.json();
      _renderDistrictBorders();
      _renderDistrictLabels(); // now we have polygons → place labels at centroids
    } catch (e) { /* silently skip — map still functional without boundary overlay */ }
  }

  function _renderDistrictBorders() {
    if (!_map || !_districtGeoData) return;
    if (_districtBorderLayer) { _districtBorderLayer.remove(); _districtBorderLayer = null; }
    const sat = _baseStyle === 'satellite' || _baseStyle === 'satellite-labels' || _baseStyle === 'gibs';
    const color = sat ? 'rgba(255,255,255,.6)'
                : _isDark() ? 'rgba(180,200,255,.45)' : 'rgba(60,80,140,.4)';
    _districtBorderLayer = L.geoJSON(_districtGeoData, {
      style: () => ({
        fillColor:   'transparent',
        color,
        weight:      sat ? 1.4 : 1.2,
        fillOpacity: 0,
        interactive: false,
      }),
      interactive: false,
    }).addTo(_map);
    _districtBorderLayer.bringToFront();
    _warnFillLayer?.bringToFront();
  }

  /* ── Always-visible district name labels (scale with zoom, no overlap) ── */
  const _LABEL_MAJOR = new Set(['Lisboa', 'Porto', 'Faro', 'Braga', 'Coimbra', 'Évora', 'Bragança', 'Funchal']);

  function _renderDistrictLabels() {
    if (!_map) return;
    if (_districtLabelLayer) { _districtLabelLayer.remove(); _districtLabelLayer = null; }
    /* The Esri 'satellite-labels' overlay already prints place names — skip
       ours there to avoid double labelling. On every other style we render
       district names as distinct REGION labels (uppercase, spaced) placed at
       each district's polygon centroid, not on the capital city, so they don't
       duplicate the basemap's city point-labels. */
    if (_baseStyle === 'satellite-labels') return;
    /* Light voyager basemap needs dark text; dark/satellite needs light text. */
    const cls = 'oc-region-label' + (_baseStyle === 'standard' ? ' light' : '');
    _districtLabelLayer = L.layerGroup();
    const place = (name, lat, lng) => {
      const icon = L.divIcon({ className: cls, html: `<span>${name}</span>`, iconSize: [94, 14], iconAnchor: [47, 7] });
      L.marker([lat, lng], { icon, interactive: false, keyboard: false }).addTo(_districtLabelLayer);
    };
    if (_districtGeoData && _districtGeoData.features) {
      _districtGeoData.features.forEach(f => {
        const name = f.properties && f.properties.name;
        if (!name) return;
        try { const c = L.geoJSON(f).getBounds().getCenter(); place(name, c.lat, c.lng); } catch (e) {}
      });
    } else {
      Object.entries(DISTRICT_CENTROIDS).forEach(([name, ll]) => place(name, ll[0], ll[1]));
    }
    _districtLabelLayer.addTo(_map);
    _updateDistrictLabelZoom();
  }

  /* Our district labels are an OVERVIEW aid. Once zoomed in (z >= 9) the CARTO
     basemap prints its own town/region names, so we hide ours to avoid the
     "name shown twice" effect. Font scales gently while visible. */
  function _updateDistrictLabelZoom() {
    if (!_districtLabelLayer || !_map) return;
    const z = _map.getZoom();
    const hide = z >= 9;
    const fs = z >= 8 ? '.7rem' : z >= 7 ? '.66rem' : '.6rem';
    _districtLabelLayer.eachLayer(m => {
      const el = m.getElement();
      if (!el) return;
      el.style.display = hide ? 'none' : '';
      el.style.fontSize = fs;
    });
  }

  /* ── Nominatim reverse geocoding ── */
  async function _reverseGeocode(lat, lon) {
    const key = `oc-geo-${lat.toFixed(4)}-${lon.toFixed(4)}`;
    try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch (e) {}
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'diogo-website-explorer/1.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) return null;
      const d = await r.json();
      const result = {
        district:     d.address?.county || d.address?.state_district || null,
        municipality: d.address?.municipality || d.address?.city || d.address?.town || d.address?.village || null,
        parish:       d.address?.suburb || d.address?.neighbourhood || d.address?.hamlet || null,
        region:       d.address?.state || null,
        display:      d.display_name || null,
      };
      try { sessionStorage.setItem(key, JSON.stringify(result)); } catch (e) {}
      return result;
    } catch (e) { return null; }
  }

  /* ════════════════════════════════ DATA PROVIDERS ═════════════════ */

  async function _fetchEarthquakes() {
    const cached = _fromCache(CACHE.eq);
    if (cached) { _prov.eq = { ok: true, time: _cacheTimeStr(CACHE.eq) || _nowTime() }; return cached; }
    try {
      const r = await _fetch(USGS_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const data = (json.features || [])
        .filter(f => {
          const lat = f.geometry?.coordinates?.[1];
          const lon = f.geometry?.coordinates?.[0];
          return lat != null && lon != null &&
            lat >= PT_BBOX.minLat && lat <= PT_BBOX.maxLat &&
            lon >= PT_BBOX.minLon && lon <= PT_BBOX.maxLon;
        })
        .map(f => ({
          type:     'earthquake',
          id:       `eq-${f.id}`,
          mag:      parseFloat(f.properties.mag || 0),
          magType:  f.properties.magType || 'M',
          lat:      f.geometry.coordinates[1],
          lon:      f.geometry.coordinates[0],
          depth:    Math.round(f.geometry.coordinates[2] || 0),
          time:     new Date(f.properties.time).toISOString(),
          title:    f.properties.place || 'Sismo',
          district: f.properties.place || '—',
          url:      f.properties.url   || '',
        }))
        .filter(e => !isNaN(e.lat) && !isNaN(e.lon));
      _toCache(CACHE.eq, data);
      _prov.eq = { ok: true, time: _nowTime() };
      return data;
    } catch (err) {
      _prov.eq = { ok: false, time: null };
      return _fromCache(CACHE.eq) || [];
    }
  }

  /* fogos.pt sends numbers as comma-decimal strings ("39,4738") and counts as
     strings; normalise to JS numbers. Returns null when not parseable. */
  function _num(v) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  /* Timestamps arrive as { sec, usec } (Unix) or as ISO strings — normalise to ms epoch. */
  function _fogosTime(v) {
    if (v == null) return null;
    if (typeof v === 'object' && v.sec != null) return Number(v.sec) * 1000;
    const n = Number(v);
    if (!isNaN(n) && n > 1e9) return n < 1e12 ? n * 1000 : n;
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }

  /* Normalise an API Aberta /v1/anpc incident (own schema: nested location,
     resources.ground = ground VEHICLES — it does not expose operacionais). */
  function _parseApiAbertaList(raw) {
    return raw.map(ev => {
      const loc = ev.location || {};
      const lat = _num(loc.lat), lon = _num(loc.lng);
      if (lat == null || lon == null) return null;
      /* address is "Distrito, Concelho, Freguesia" — the concelho only lives there. */
      const parts = (loc.address || '').split(',').map(s => s.trim());
      return {
        type:         'fire',
        id:           `fire-${ev.id || Math.random()}`,
        rawId:        ev.id || null,
        lat, lon,
        title:        ev.type || 'Ocorrência',
        especie:      null,
        familia:      null,
        district:     loc.district || '—',
        municipio:    parts[1] || null,
        freguesia:    loc.freguesia || null,
        localidade:   null,
        regiao:       loc.region || null,
        status:       ev.status || null,
        statusColor:  null,
        important:    false,
        operacionais: null,
        veiculos:     _num(ev.resources?.ground),
        aereos:       _num(ev.resources?.aerial),
        aquaticos:    _num(ev.resources?.water),
        heli:         null,
        aviao:        null,
        time:         ev.datetime || null,
        lastUpdate:   null,
        url:          ev.id ? `https://fogos.pt/fogo/${ev.id}` : null,
        source:       'apiaberta',
      };
    }).filter(Boolean);
  }

  /* Normalise one raw fogos.pt incident list into our shape. */
  function _parseFireList(raw) {
    return raw.map(ev => {
        /* Real fogos.pt v2 fields: lng (not lon), comma-decimal strings,
           man/terrain/aerial/meios_aquaticos resources, created/updated {sec}. */
        const lat = _num(ev.lat);
        const lon = _num(ev.lng != null ? ev.lng : ev.lon);
        if (lat == null || lon == null) return null;
        return {
          type:         'fire',
          id:           `fire-${ev.id || ev.sadoId || Math.random()}`,
          rawId:        ev.id || null,
          lat, lon,
          title:        ev.natureza || ev.especieName || ev.tipo || 'Ocorrência',
          especie:      ev.especieName || null,
          familia:      ev.familiaName || null,
          district:     ev.district  || '—',
          municipio:    ev.concelho  || ev.municipio || null,
          freguesia:    ev.freguesia || null,
          localidade:   ev.localidade || ev.detailLocation || null,
          regiao:       ev.regiao    || null,
          status:       ev.status    || null,
          statusColor:  ev.statusColor || null,
          important:    !!ev.important,
          operacionais: _num(ev.man),
          veiculos:     _num(ev.terrain),
          aereos:       _num(ev.aerial),
          aquaticos:    _num(ev.meios_aquaticos),
          heli:         _num(ev.heliFight),
          aviao:        _num(ev.planeFight),
          time:         _fogosTime(ev.created),
          lastUpdate:   _fogosTime(ev.updated),
          url:          ev.id ? `https://fogos.pt/fogo/${ev.id}` : null,
          source:       'fogos.pt',
        };
      }).filter(Boolean);
  }

  function _extractFireRaw(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.incidents)) return json.incidents;
    return null;
  }

  /* Multi-source fire fetch, all in parallel:
       · fogos.pt direct    — richest fields + live, but CORS-blocked on
                              GitHub Pages since jul/2026 (works in local dev)
       · API Aberta         — live (~5 min) with open CORS; works without a
                              key, a saved key raises the rate limits. Its
                              schema is poorer (no operacionais/important).
       · Action snapshot    — same-origin JSON a GitHub Action refreshes
                              every ~15 min; zero-config fallback, full fields.
     Preference: fogos direct → API Aberta ENRICHED with snapshot fields
     (matched by incident id) → snapshot alone → stale session cache. */
  async function _fetchWildfires() {
    const cached = _fromCache(CACHE.fire);
    if (cached && Array.isArray(cached.list)) {
      _fireSrc   = cached.src || { mode: null, updated: null };
      _prov.fire = { ok: true, time: _cacheTimeStr(CACHE.fire) || _nowTime() };
      return cached.list;
    }

    const done = (list, src) => {
      _fireSrc   = src;
      _toCache(CACHE.fire, { list, src });
      _prov.fire = { ok: true, time: _nowTime() };
      _renderKeyStatus();
      return list;
    };

    const key = _apiKey();
    const [rFogos, rAberta, rSnap] = await Promise.allSettled([
      _fetch(FOGOS_URL, 8000).then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return _extractFireRaw(await r.json());
      }),
      _fetch(APIABERTA_URL, 12000, key ? { 'X-API-Key': key } : null).then(async r => {
        if (key && (r.status === 401 || r.status === 403)) { _keyInvalid = true; throw new Error('key rejected'); }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        return { raw: _extractFireRaw(json), asOf: json.as_of ? Date.parse(json.as_of) : null };
      }),
      _fetch(`${SNAPSHOT_URL}?t=${Math.floor(Date.now() / 60000)}`, 12000).then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const upd  = json.updated ? Date.parse(json.updated) : null;
        return { raw: _extractFireRaw(json), updated: isNaN(upd) ? null : upd };
      }),
    ]);

    if (_apiKey() && rAberta.status === 'fulfilled') _keyInvalid = false;

    /* fogos.pt direct: live AND complete — nothing to merge. */
    if (rFogos.status === 'fulfilled' && rFogos.value) {
      return done(_parseFireList(rFogos.value), { mode: 'live', updated: Date.now() });
    }

    const snap = rSnap.status === 'fulfilled' && rSnap.value.raw
      ? { list: _parseFireList(rSnap.value.raw), updated: rSnap.value.updated }
      : null;

    /* API Aberta live list, enriched with the snapshot's richer fields
       (operacionais, significativo, localidade…) for the same incident ids. */
    if (rAberta.status === 'fulfilled' && rAberta.value.raw) {
      let list = _parseApiAbertaList(rAberta.value.raw);
      if (snap) {
        const byId = {};
        snap.list.forEach(f => { if (f.rawId) byId[f.rawId] = f; });
        list = list.map(f => {
          const s = f.rawId && byId[f.rawId];
          if (!s) return f;
          return {
            ...s, ...f,
            /* live feed wins for status + resource counts; snapshot fills the rest */
            operacionais: s.operacionais,
            statusColor:  s.statusColor,
            important:    s.important,
            especie:      s.especie,   familia: s.familia,
            localidade:   s.localidade,
            municipio:    f.municipio || s.municipio,
            heli:         s.heli,      aviao:   s.aviao,
            time:         s.time || f.time,
            lastUpdate:   s.lastUpdate,
          };
        });
      }
      return done(list, { mode: key ? 'live-key' : 'live-open', updated: rAberta.value.asOf || Date.now() });
    }

    /* Snapshot alone — still full fields, just up to ~15 min behind. */
    if (snap) return done(snap.list, { mode: 'snapshot', updated: snap.updated });

    _prov.fire = { ok: false, time: null };
    _fireSrc   = { mode: null, updated: null };
    _renderKeyStatus();
    const stale = _fromCache(CACHE.fire);
    return (stale && stale.list) || [];
  }

  async function _fetchWarnings() {
    const cached = _fromCache(CACHE.warn);
    if (cached) { _prov.warn = { ok: true, time: _cacheTimeStr(CACHE.warn) || _nowTime() }; return cached; }
    try {
      const r = await _fetch(IPMA_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const raw  = Array.isArray(json) ? json : (json.data || []);
      const now  = Date.now();
      const data = raw
        .filter(w => {
          const end = w.endTime ? new Date(w.endTime).getTime() : Infinity;
          /* Real IPMA field is awarenessLevelID (e.g. "yellow"); keep legacy fallbacks. */
          const lvl = (w.awarenessLevelID || w.awarenessLevel || w.level || '').toLowerCase();
          return end > now && lvl !== 'green' && lvl !== 'verde';
        })
        .map(w => {
          const areaCode     = w.idAreaAviso ?? w.area?.id ?? null;
          const districtName = IPMA_AREA_TO_DISTRICT[areaCode] || w.area?.name || w.district?.name || w.local || '—';
          const centroid     = DISTRICT_CENTROIDS[districtName];
          const level        = (w.awarenessLevelID || w.awarenessLevel || w.level || 'yellow').toLowerCase();
          return {
            type:     'weather',
            id:       `wx-${areaCode || w.warningId || Math.random()}-${level}-${w.awarenessTypeName || ''}`,
            title:    `${w.awarenessTypeName || w.awarenessType || 'Aviso'} — ${districtName}`,
            level,
            warnType: w.awarenessTypeName || w.awarenessType || '',
            descr:    w.text || '',
            areaCode,
            district: districtName,
            time:     w.startTime || '',
            endTime:  w.endTime   || '',
            lat:      centroid?.[0] ?? null,
            lon:      centroid?.[1] ?? null,
          };
        });
      _toCache(CACHE.warn, data);
      _prov.warn = { ok: true, time: _nowTime() };
      return data;
    } catch (err) {
      _prov.warn = { ok: false, time: null };
      return _fromCache(CACHE.warn) || [];
    }
  }

  /* ════════════════════════════════ MAP ═════════════════════════════ */

  function _initMap() {
    const el = document.getElementById('oc-leaflet-map');
    if (!el || _map) return;

    _map = L.map(el, {
      center: [39.6, -8.2], zoom: 7, minZoom: 5, maxZoom: 17,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(_map);

    /* Restore the saved style; otherwise match the app theme (dark map in
       dark mode) so the map integrates with the rest of the UI. */
    let _savedBase; try { _savedBase = localStorage.getItem('oc-basemap'); } catch (e) {}
    _setBasemap(_savedBase || (_isDark() ? 'dark' : 'standard'));

    /* EFFIS WMS overlays sit above the district polygons (overlayPane, 400)
       but below the incident markers (markerPane, 600). */
    _map.createPane('oc-effis').style.zIndex = 450;
    _lHotspots = L.tileLayer.wms(EFFIS_WMS, {
      layers: 'all.hs', format: 'image/png', transparent: true, version: '1.1.1',
      pane: 'oc-effis', opacity: .85, attribution: EFFIS_ATTR,
    });
    _lBurnt = L.tileLayer.wms(EFFIS_WMS, {
      layers: 'effis.nrt.ba', format: 'image/png', transparent: true, version: '1.1.1',
      pane: 'oc-effis', opacity: .7, attribution: EFFIS_ATTR,
    });

    _lEq   = L.layerGroup().addTo(_map);
    _lFire = L.layerGroup().addTo(_map);
    _map.on('zoomend', _updateDistrictLabelZoom);
    _watchTheme();
    _loadDistrictGeoData();
  }

  function _magClass(mag) {
    if (mag < 2)   return 'low';
    if (mag < 3.5) return 'mod';
    if (mag < 5)   return 'high';
    return 'severe';
  }

  function _renderEqMarkers(eqs) {
    if (!_lEq) return;
    _lEq.clearLayers();
    if (!_layers.earthquake) return;
    eqs.forEach(eq => {
      const cls = _magClass(eq.mag);
      const sz  = { low: 8, mod: 12, high: 16, severe: 22 }[cls] || 10;
      const clr = { low: '#22c55e', mod: '#eab308', high: '#f97316', severe: '#ef4444' }[cls];
      /* Quakes in the last 6h pulse — fresh activity reads at a glance. */
      const recent = Date.now() - _ts(eq.time) < 6 * 3600 * 1000;
      const icon = L.divIcon({
        className: '',
        html: `<div${recent ? ' class="oc-marker-pulse"' : ''} style="--pc:${clr};width:${sz}px;height:${sz}px;border-radius:50%;background:${clr};border:2px solid ${clr}44;box-shadow:0 0 ${sz}px ${clr}88;cursor:pointer"></div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      });
      L.marker([eq.lat, eq.lon], { icon })
        .on('click', () => _openDetail(eq))
        .addTo(_lEq);
    });
  }

  /* Map a fogos.pt occurrence status consistently to a colour + severity.
     Same status → same colour everywhere (markers, list, legend).
     Palette: novo=azul, em resolução=amarelo, em curso=laranja,
     significativo=vermelho, grande dispositivo=vermelho-escuro,
     vigilância=verde, encerrada=cinza. */
  const FIRE_STATUS = [
    { m: /vigil/,                         color: '#22c55e', sev: 1, label: 'Vigilância' },
    { m: /conclus/,                       color: '#9ca3af', sev: 1, label: 'Em conclusão' },
    { m: /resolu/,                        color: '#eab308', sev: 2, label: 'Em resolução' },
    { m: /curso|chegada|teatro|operac/,   color: '#f97316', sev: 3, label: 'Em curso' },
    { m: /alerta|despacho|acionament/,    color: '#3b82f6', sev: 1, label: 'Novo / Despacho' },
    { m: /encerr|rescaldo|extint/,        color: '#9ca3af', sev: 0, label: 'Encerrada' },
  ];
  /* operacionais when known; otherwise a ~4× estimate from ground vehicles
     (the observed SADO ratio) so API Aberta-only incidents still size sanely. */
  function _fireMen(inc) {
    return inc.operacionais != null ? inc.operacionais : (inc.veiculos || 0) * 4;
  }

  function _fireStatus(inc) {
    const s = (inc.status || '').toLowerCase();
    let st = FIRE_STATUS.find(x => x.m.test(s)) || { color: '#f97316', sev: 3, label: inc.status || 'Ativa' };
    st = { ...st };
    const heavy = _fireMen(inc) >= 50 || (inc.aereos || 0) >= 1;
    if (inc.important && heavy) { st.color = '#b91c1c'; st.sev = 5; st.label = 'Significativo · grande dispositivo'; }
    else if (inc.important)     { st.color = '#ef4444'; st.sev = Math.max(st.sev, 4); st.label = 'Incêndio significativo'; }
    return st;
  }

  /* Fire size tiers by the number of operacionais deployed (the real magnitude
     proxy fogos.pt provides — there is no burned-area field). Each tier has a
     distinct marker diameter so the scale of the response reads at a glance. */
  const FIRE_SIZE_TIERS = [
    { min: 0,   d: 16, label: 'Pequena (< 6 operacionais)' },
    { min: 6,   d: 24, label: 'Média (6–19 operacionais)' },
    { min: 20,  d: 34, label: 'Grande (20–49 operacionais)' },
    { min: 50,  d: 46, label: 'Muito grande (50–99 operacionais)' },
    { min: 100, d: 60, label: 'Grande dispositivo (100+ operacionais)' },
  ];
  function _fireSizeTier(inc) {
    const op = _fireMen(inc);
    let t = FIRE_SIZE_TIERS[0];
    for (const tier of FIRE_SIZE_TIERS) if (op >= tier.min) t = tier;
    return t;
  }

  function _renderFireMarkers(fires) {
    if (!_lFire) return;
    _lFire.clearLayers();
    if (!_layers.fire) return;
    /* Draw biggest fires last so they sit on top of small ones. */
    const sorted = fires.slice().sort((a, b) => _fireMen(a) - _fireMen(b));
    sorted.forEach(f => {
      const st   = _fireStatus(f);
      const tier = _fireSizeTier(f);
      const sz   = tier.d;
      const glow = 4 + Math.round(sz * 0.22);
      const fs   = Math.round(sz * 0.46);
      const op   = f.operacionais || 0;
      const loc  = f.district && f.district !== '—' ? ` · ${f.district}` : '';
      const tip  = `${f.title}${loc} · ${st.label} · ${tier.label}`.replace(/"/g, '&quot;');
      /* Ring thickness also grows with size; a tiny operacionais badge on big ones. */
      const badge = op >= 20 ? `<span style="position:absolute;bottom:-5px;right:-5px;background:rgba(8,12,20,.92);color:#fff;font-size:9px;font-weight:700;line-height:1;padding:1px 3px;border-radius:6px;border:1px solid rgba(255,255,255,.4)">${op}</span>` : '';
      /* Significant fires pulse so they stand out among the small ones. */
      const pulse = st.sev >= 4 ? ' class="oc-marker-pulse"' : '';
      const icon = L.divIcon({
        className: '',
        html: `<div${pulse} title="${tip}" style="--pc:${st.color};position:relative;width:${sz}px;height:${sz}px;border-radius:50%;background:${st.color};border:2px solid rgba(255,255,255,.92);box-shadow:0 0 ${glow}px ${st.color},0 0 3px rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;font-size:${fs}px;line-height:1;cursor:pointer">🔥${badge}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      });
      L.marker([f.lat, f.lon], { icon })
        .on('click', () => _openDetail(f))
        .addTo(_lFire);
    });
  }

  /* Warning areas rendered as district polygon fills, not point markers */
  function _renderWarnPolygons(warns) {
    if (_warnFillLayer) { _warnFillLayer.remove(); _warnFillLayer = null; }
    if (!_layers.weather || !_districtGeoData || !_map) return;

    /* Reduce to worst warning per district */
    const districtWorst = {};
    warns.forEach(w => {
      const name = w.district;
      if (!name || name === '—') return;
      const sev = WARN_SEV[w.level] || 0;
      if (!districtWorst[name] || sev > districtWorst[name].sev) {
        districtWorst[name] = { sev, warning: w };
      }
    });

    if (!Object.keys(districtWorst).length) return;

    _warnFillLayer = L.geoJSON(_districtGeoData, {
      filter: f => Boolean(districtWorst[f.properties?.name]),
      style: f => {
        const dw  = districtWorst[f.properties?.name];
        const clr = dw ? (WARN_CLR[dw.warning.level] || '#eab308') : '#eab308';
        return { fillColor: clr, fillOpacity: 0.35, color: clr, weight: 2 };
      },
      onEachFeature: (f, layer) => {
        const dw = districtWorst[f.properties?.name];
        if (dw) layer.on('click', () => _openDetail(dw.warning));
      },
    }).addTo(_map);
    /* Markers live in Leaflet's markerPane (z-index 600), above the overlayPane
       (400) where these polygons render, so they already sit on top. */
  }

  /* ════════════════════════════════ DETAIL PANEL ═══════════════════ */

  function _openDetail(inc) {
    _detailInc = inc;
    /* On mobile the list and map are separate panes — when an occurrence is
       picked from the list, switch to the map so the detail sheet + pin show. */
    if (window.innerWidth <= 900) _setMobileView('map');
    if (inc.lat != null && inc.lon != null) {
      _map?.flyTo([inc.lat, inc.lon], Math.max(_map.getZoom(), 9), { duration: 0.7 });
    }
    _renderDetail(inc, null);
    /* Only earthquakes need reverse geocoding — fogos fires already carry the full
       district/concelho/freguesia hierarchy, and IPMA warnings carry their district.
       This avoids hammering the rate-limited Nominatim service. */
    if (inc.type === 'earthquake' && inc.lat != null && inc.lon != null) {
      _reverseGeocode(inc.lat, inc.lon).then(geo => {
        if (geo && _detailInc === inc) _renderDetail(inc, geo);
      });
    }
  }

  function _val(v, unit) {
    if (v == null || v === '' || v === '—' || (typeof v === 'number' && isNaN(v))) {
      return '<span class="oc-detail-na">Dados indisponíveis</span>';
    }
    return `${v}${unit || ''}`;
  }

  function _geoRows(geo) {
    if (!geo) return `<div class="oc-detail-row oc-geo-loading"><span class="oc-detail-label">📍 Localização</span><span style="color:var(--muted);font-size:.78rem">A identificar…</span></div>`;
    const rows = [];
    if (geo.district)     rows.push(`<div class="oc-detail-row"><span class="oc-detail-label">🗺 Distrito</span><span>${geo.district}</span></div>`);
    if (geo.municipality) rows.push(`<div class="oc-detail-row"><span class="oc-detail-label">🏙 Município</span><span>${geo.municipality}</span></div>`);
    if (geo.parish)       rows.push(`<div class="oc-detail-row"><span class="oc-detail-label">🏘 Freguesia</span><span>${geo.parish}</span></div>`);
    if (geo.region)       rows.push(`<div class="oc-detail-row"><span class="oc-detail-label">📌 Região</span><span>${geo.region}</span></div>`);
    return rows.join('');
  }

  function _renderDetail(inc, geo) {
    const panel = document.querySelector('.oc-detail-panel');
    if (!panel) return;

    let content = '';

    if (inc.type === 'earthquake') {
      const cls = _magClass(inc.mag);
      const clr = { low: '#22c55e', mod: '#eab308', high: '#f97316', severe: '#ef4444' }[cls];
      content = `
        <div class="oc-detail-hero eq">
          <div class="oc-detail-mag-badge" style="background:${clr}22;color:${clr};border-color:${clr}44">
            ${inc.mag.toFixed(1)} ${inc.magType || 'M'}
          </div>
          <div class="oc-detail-type-lbl">Sismo</div>
        </div>
        <div class="oc-detail-rows">
          <div class="oc-detail-row"><span class="oc-detail-label">Local</span><span>${_val(inc.title)}</span></div>
          ${_geoRows(geo)}
          <div class="oc-detail-row"><span class="oc-detail-label">Magnitude</span><span style="color:${clr};font-weight:700">${_val(inc.mag?.toFixed(1))} ${inc.magType || ''}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Profundidade</span><span>${_val(inc.depth, ' km')}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Coordenadas</span><span style="font-family:var(--font-mono);font-size:.78rem">${inc.lat.toFixed(4)}°N, ${Math.abs(inc.lon).toFixed(4)}°W</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Data/hora</span><span>${_fmtTime(inc.time)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Fonte</span><span class="oc-detail-source">USGS</span></div>
        </div>
        ${inc.url ? `<a class="oc-detail-link" href="${inc.url}" target="_blank" rel="noopener">Ver relatório USGS ↗</a>` : ''}`;

    } else if (inc.type === 'fire') {
      const statusLbl = inc.status || null;
      const statusClr = inc.statusColor || null;
      const hasResources = [inc.operacionais, inc.veiculos, inc.aereos, inc.aquaticos].some(v => v != null);
      const typeLbl = inc.familia || 'Ocorrência de Proteção Civil';
      content = `
        <div class="oc-detail-hero fire">
          <div class="oc-detail-fire-icon">🔥</div>
          <div>
            <div class="oc-detail-type-lbl">${typeLbl}</div>
            ${statusLbl ? `<div class="oc-detail-status-badge"${statusClr ? ` style="background:${statusClr}22;color:${statusClr};border-color:${statusClr}55"` : ''}>${statusLbl}</div>` : ''}
            ${inc.important ? `<div class="oc-detail-status-badge" style="background:#ef444422;color:#ef4444;border-color:#ef444455">⚠ Significativa</div>` : ''}
          </div>
        </div>
        <div class="oc-detail-rows">
          <div class="oc-detail-row"><span class="oc-detail-label">Natureza</span><span>${_val(inc.title)}</span></div>
          ${_geoRows(geo || { district: inc.district, municipality: inc.municipio, parish: inc.freguesia })}
          ${inc.localidade ? `<div class="oc-detail-row"><span class="oc-detail-label">📍 Localidade</span><span>${inc.localidade}</span></div>` : ''}
          ${hasResources ? `
          <div class="oc-detail-row oc-detail-row--highlight"><span class="oc-detail-label">👷 Operacionais</span><span>${_val(inc.operacionais)}</span></div>
          <div class="oc-detail-row oc-detail-row--highlight"><span class="oc-detail-label">🚒 Veículos terrestres</span><span>${_val(inc.veiculos)}</span></div>
          <div class="oc-detail-row oc-detail-row--highlight"><span class="oc-detail-label">✈️ Meios aéreos</span><span>${_val(inc.aereos)}</span></div>
          ${inc.aquaticos ? `<div class="oc-detail-row oc-detail-row--highlight"><span class="oc-detail-label">🚤 Meios aquáticos</span><span>${_val(inc.aquaticos)}</span></div>` : ''}` : ''}
          <div class="oc-detail-row"><span class="oc-detail-label">Coordenadas</span><span style="font-family:var(--font-mono);font-size:.78rem">${inc.lat.toFixed(4)}°N, ${Math.abs(inc.lon).toFixed(4)}°W</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Início</span><span>${_fmtTime(inc.time)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Última atualização</span><span>${_fmtTime(inc.lastUpdate)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Fonte</span><span class="oc-detail-source">${inc.source === 'apiaberta' ? 'API Aberta (ANEPC)' : 'fogos.pt'}</span></div>
        </div>
        ${inc.url ? `<a class="oc-detail-link" href="${inc.url}" target="_blank" rel="noopener">Ver em fogos.pt ↗</a>` : ''}
        <div class="oc-detail-notice">Dados do sistema SADO da ANEPC${inc.source === 'apiaberta' ? ' via API Aberta/fogos.pt' : ' via fogos.pt'}.</div>`;

    } else if (inc.type === 'weather') {
      const clrMap = { yellow: '#eab308', orange: '#f97316', red: '#ef4444', amarelo: '#eab308', laranja: '#f97316', vermelho: '#ef4444' };
      const clr    = clrMap[inc.level] || '#eab308';
      content = `
        <div class="oc-detail-hero weather">
          <div class="oc-detail-warn-icon" style="color:${clr}">⚠</div>
          <div>
            <div class="oc-detail-type-lbl">Aviso Meteorológico</div>
            <div class="oc-detail-warn-level" style="color:${clr}">${inc.level?.toUpperCase() || ''}</div>
          </div>
        </div>
        <div class="oc-detail-rows">
          <div class="oc-detail-row"><span class="oc-detail-label">Tipo</span><span>${_val(inc.warnType)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">🗺 Distrito</span><span>${_val(inc.district)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Início</span><span>${_fmtTime(inc.time)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Fim previsto</span><span>${_fmtTime(inc.endTime)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Fonte</span><span class="oc-detail-source">IPMA</span></div>
        </div>
        ${inc.descr ? `<div class="oc-detail-notice">${inc.descr}</div>` : ''}`;
    }

    panel.querySelector('.oc-detail-content').innerHTML = content;
    panel.classList.add('open');
  }

  /* ════════════════════════════════ UI ══════════════════════════════ */

  function _nowTime() {
    return new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  /* Normalise any timestamp (ms-epoch number, ISO string, or null) to ms; 0 if unknown. */
  function _ts(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }

  function _fmtTime(iso) {
    const t = _ts(iso);
    if (!t) return '—';
    return new Date(t).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function _relTime(iso) {
    const t0 = _ts(iso);
    if (!t0) return '';
    try {
      const diff = Date.now() - t0;
      const m = Math.floor(diff / 60000);
      if (m < 1)  return 'agora mesmo';
      if (m < 60) return `há ${m}m`;
      const h = Math.floor(m / 60);
      if (h < 24) return `há ${h}h`;
      return `há ${Math.floor(h / 24)}d`;
    } catch (e) { return ''; }
  }

  function _renderStats(eqs, fires, warns) {
    const statGrid = document.querySelector('.oc-stat-grid');
    if (!statGrid) return;
    /* Stat cards double as one-tap filters for the list. */
    statGrid.innerHTML = `
      <button class="oc-stat-card all" data-filter="all" title="Mostrar tudo">
        <div class="oc-stat-num">${eqs.length + fires.length + warns.length}</div>
        <div class="oc-stat-label">Total</div>
      </button>
      <button class="oc-stat-card eq" data-filter="earthquake" title="Só sismos">
        <div class="oc-stat-num">${eqs.length}</div>
        <div class="oc-stat-label">Sismos</div>
      </button>
      <button class="oc-stat-card fire" data-filter="fire" title="Só incêndios">
        <div class="oc-stat-num">${fires.length}</div>
        <div class="oc-stat-label">Incêndios</div>
      </button>
      <button class="oc-stat-card wx" data-filter="weather" title="Só avisos">
        <div class="oc-stat-num">${warns.length}</div>
        <div class="oc-stat-label">Avisos</div>
      </button>`;
    statGrid.querySelectorAll('.oc-stat-card').forEach(c => {
      c.onclick = () => _setFilter(c.dataset.filter);
      c.classList.toggle('selected', c.dataset.filter === _activeFilter);
    });
  }

  /* The fire provider card reflects which tier actually delivered the data. */
  function _fireProviderView() {
    const p = { ...PROVIDERS.fire };
    const m = _fireSrc.mode;
    if (m === 'live-key') {
      p.name = 'ANEPC — em direto via API Aberta';
      p.freq = 'Tempo real (≈ 5 min, chave própria)';
    } else if (m === 'live-open') {
      p.name = 'ANEPC — em direto via API Aberta';
      p.freq = 'Tempo real (≈ 5 min)';
      p.note = 'Ligação em direto sem chave. Detalhe extra (operacionais, «significativo») vem do snapshot e pode atrasar alguns minutos em ocorrências novas.';
    } else if (m === 'live') {
      p.name = 'ANEPC — em direto via fogos.pt';
    } else if (m === 'snapshot') {
      p.name = 'ANEPC — snapshot (GitHub Action)';
      p.freq = 'Snapshot automático a cada ≈ 15 min';
      const age = _fireSrc.updated ? Math.round((Date.now() - _fireSrc.updated) / 60000) : null;
      p.note = `Dados recolhidos do fogos.pt no servidor${age != null ? ` há ${age} min` : ''}. Para tempo real, adiciona uma chave gratuita da API Aberta acima.`;
    } else if (_prov.fire.ok === false) {
      p.note = 'Nenhuma das fontes respondeu (API Aberta, fogos.pt, snapshot). Tenta atualizar dentro de momentos.';
    }
    return p;
  }

  /* Static cards for the satellite layers (no fetch status — tiles load on demand). */
  const SAT_PROVIDERS = [
    { icon: '🛰', name: 'NASA GIBS — imagem diária', official: true,
      freq: 'Diária (passagem VIIRS ~13:30 local)',
      scope: 'Mapa base «🛰 Hoje» — cor real, fumo e nuvens visíveis (375 m/px)' },
    { icon: '🔥', name: 'EFFIS · Copernicus', official: true,
      freq: 'Várias vezes por dia (MODIS/VIIRS)',
      scope: 'Camadas «Focos satélite» e «Área ardida» no mapa' },
  ];

  function _renderProviders() {
    const el = document.querySelector('.oc-providers');
    if (!el) return;
    el.innerHTML = ['eq', 'fire', 'warn'].map(key => {
      const p   = key === 'fire' ? _fireProviderView() : PROVIDERS[key];
      const s   = _prov[key];
      const cls = s.ok === null ? 'loading' : s.ok ? 'ok' : 'err';
      let tim = s.ok === null ? 'A carregar…' : s.ok ? `Atualizado às ${s.time || '—'}` : 'Falha na ligação';
      if (key === 'fire' && s.ok && _fireSrc.mode === 'snapshot' && _fireSrc.updated) {
        tim = `Snapshot das ${new Date(_fireSrc.updated).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return `<div class="oc-provider-card ${cls}">
        <div class="oc-provider-header">
          <span class="oc-provider-dot ${cls}"></span>
          <span class="oc-provider-name">${p.icon} ${p.name}</span>
          <span class="oc-provider-badge ${p.official ? 'official' : 'civic'}">${p.official ? 'Oficial' : 'Cívico'}</span>
        </div>
        <div class="oc-provider-meta">
          <div class="oc-provider-row"><span class="oc-provider-label">Atualização:</span> ${p.freq}</div>
          <div class="oc-provider-row"><span class="oc-provider-label">Âmbito:</span> ${p.scope}</div>
          <div class="oc-provider-row oc-provider-status"><span class="oc-provider-label">Estado:</span> ${tim}</div>
          ${p.note ? `<div class="oc-provider-note">${p.note}</div>` : ''}
        </div>
      </div>`;
    }).join('') + SAT_PROVIDERS.map(p => `
      <div class="oc-provider-card">
        <div class="oc-provider-header">
          <span class="oc-provider-name">${p.icon} ${p.name}</span>
          <span class="oc-provider-badge official">Oficial</span>
        </div>
        <div class="oc-provider-meta">
          <div class="oc-provider-row"><span class="oc-provider-label">Atualização:</span> ${p.freq}</div>
          <div class="oc-provider-row"><span class="oc-provider-label">Âmbito:</span> ${p.scope}</div>
        </div>
      </div>`).join('');
  }

  /* ── API Aberta key panel ── */
  function _renderKeyStatus() {
    const st = document.getElementById('oc-key-status');
    const clearBtn = document.getElementById('oc-key-clear');
    if (!st) return;
    const key = _apiKey();
    if (clearBtn) clearBtn.hidden = !key;
    if (!key) {
      st.className = 'oc-key-status';
      st.textContent = '';
      return;
    }
    if (_keyInvalid) {
      st.className = 'oc-key-status err';
      st.textContent = '✗ A chave foi rejeitada pela API Aberta — verifica se a copiaste completa.';
    } else if (_fireSrc.mode === 'live-key') {
      st.className = 'oc-key-status ok';
      st.textContent = '✓ Ligado em direto à API Aberta com a tua chave.';
    } else {
      st.className = 'oc-key-status';
      st.textContent = 'Chave guardada — será usada na próxima atualização.';
    }
  }

  function _wireKeyPanel() {
    const input = document.getElementById('oc-key-input');
    const save  = document.getElementById('oc-key-save');
    const clear = document.getElementById('oc-key-clear');
    const st    = document.getElementById('oc-key-status');
    if (!input || !save) return;
    if (_apiKey()) input.value = _apiKey();

    const refresh = () => {
      /* Force a fresh fire fetch through the new key. */
      sessionStorage.removeItem(CACHE.fire);
      _load();
    };

    save.onclick = async () => {
      const k = input.value.trim();
      if (!k) return;
      save.disabled = true;
      st.className = 'oc-key-status';
      st.textContent = 'A validar a chave…';
      try {
        const r = await _fetch(APIABERTA_URL, 12000, { 'X-API-Key': k });
        if (r.status === 401 || r.status === 403) {
          st.className = 'oc-key-status err';
          st.textContent = '✗ Chave inválida — a API Aberta rejeitou-a.';
        } else if (!r.ok) {
          /* Service hiccup, not the key's fault — save it anyway. */
          _setApiKey(k); _keyInvalid = false;
          st.className = 'oc-key-status';
          st.textContent = `Chave guardada (API Aberta respondeu HTTP ${r.status} — tentará de novo).`;
          refresh();
        } else {
          _setApiKey(k); _keyInvalid = false;
          st.className = 'oc-key-status ok';
          st.textContent = '✓ Chave guardada e aceite — a carregar dados em direto…';
          refresh();
        }
      } catch (e) {
        st.className = 'oc-key-status err';
        st.textContent = '✗ Não foi possível contactar a API Aberta. Tenta de novo.';
      }
      save.disabled = false;
      if (clear) clear.hidden = !_apiKey();
    };

    if (clear) clear.onclick = () => {
      _setApiKey(null);
      _keyInvalid = false;
      input.value = '';
      clear.hidden = true;
      st.className = 'oc-key-status';
      st.textContent = 'Chave removida — volta ao snapshot automático.';
      refresh();
    };
  }

  /* Cross-type severity score so "Severidade" ordering can rank a red IPMA
     warning against an M5 quake against a 100-operacionais fire sensibly. */
  function _sevScore(inc) {
    if (inc.type === 'earthquake') return (inc.mag || 0) * 12;                       /* M5 → 60 */
    if (inc.type === 'weather')    return (WARN_SEV[inc.level] || 1) * 16;           /* red → 64 */
    if (inc.type === 'fire') {
      const st = _fireStatus(inc);
      return st.sev * 18 + Math.min(_fireMen(inc), 200) * 0.3;                       /* grande dispositivo → 90+ */
    }
    return 0;
  }

  function _renderList() {
    const list    = document.querySelector('.oc-incidents-list');
    const countEl = document.querySelector('.oc-incidents-count');
    if (!list) return;

    let filtered = _activeFilter === 'all'
      ? _incidents.slice()
      : _incidents.filter(i => i.type === _activeFilter);
    if (_sortMode === 'sev') filtered.sort((a, b) => _sevScore(b) - _sevScore(a));

    if (countEl) countEl.textContent = filtered.length;

    if (!filtered.length) {
      list.innerHTML = `<div class="oc-no-data"><div class="oc-no-data-icon">📭</div><div class="oc-no-data-msg">Sem ocorrências nesta categoria neste momento.</div></div>`;
      return;
    }

    list.innerHTML = filtered.map(inc => {
      const dotCls = { earthquake: 'eq', fire: 'fire', weather: 'weather' }[inc.type] || 'eq';
      const extra  = inc.type === 'earthquake'
        ? `<span class="oc-incident-mag ${_magClass(inc.mag)}">${inc.mag?.toFixed(1) || '?'}</span>` : '';
      const t = _relTime(inc.time);
      /* Fire dots use the same status colour as their map marker. */
      const dotStyle = inc.type === 'fire' ? ` style="background:${_fireStatus(inc).color};box-shadow:none"` : '';
      const statusTag = inc.type === 'fire' && inc.status ? `<span class="oc-incident-status">${_fireStatus(inc).label}</span>` : '';
      return `<div class="oc-incident-item" data-id="${inc.id}">
        <div class="oc-incident-dot ${dotCls}"${dotStyle}></div>
        <div class="oc-incident-body">
          <div class="oc-incident-title">${inc.title}</div>
          <div class="oc-incident-meta">
            <span class="oc-incident-district">📍 ${inc.district}</span>
            ${extra}
            ${statusTag}
            ${t ? `<span class="oc-incident-time">${t}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.oc-incident-item').forEach(item => {
      item.onclick = () => {
        const inc = filtered.find(i => i.id === item.dataset.id);
        if (!inc) return;
        list.querySelectorAll('.oc-incident-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        _openDetail(inc);
      };
    });
  }

  function _showSkeleton() {
    const list = document.querySelector('.oc-incidents-list');
    if (!list) return;
    list.innerHTML = Array(5).fill(`
      <div class="oc-incident-skel">
        <div class="oc-skel-dot"></div>
        <div class="oc-skel-body">
          <div class="oc-skel-line"></div>
          <div class="oc-skel-line short"></div>
        </div>
      </div>`).join('');
  }

  function _setRefreshing(on) {
    _refreshing = on;
    document.querySelector('.oc-refresh-btn')?.classList.toggle('loading', on);
  }

  function _setLastUpdate() {
    _lastLoadTs = Date.now();
    _renderLastUpdate();
    const dot = document.querySelector('.oc-status-dot');
    if (dot) dot.className = 'oc-status-dot';
  }

  /* "Atualizado há Xm" — re-rendered every 30s so the freshness never lies. */
  function _renderLastUpdate() {
    const el = document.querySelector('.oc-last-update');
    if (!el || !_lastLoadTs) return;
    const mins = Math.floor((Date.now() - _lastLoadTs) / 60000);
    const abs  = new Date(_lastLoadTs).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    el.textContent = mins < 1 ? `Atualizado às ${abs}` : `Atualizado às ${abs} · há ${mins} min`;
  }

  /* ── Layer toggle buttons ── */
  function _wireLayerBar() {
    document.querySelectorAll('.oc-layer-btn').forEach(btn => {
      const layer = btn.dataset.layer;
      btn.classList.toggle('active', _layers[layer] !== false);
      btn.addEventListener('click', () => {
        _layers[layer] = !_layers[layer];
        btn.classList.toggle('active', _layers[layer]);
        if (layer === 'earthquake') {
          if (_layers.earthquake) _lEq?.addTo(_map); else _lEq && _map?.removeLayer(_lEq);
        } else if (layer === 'fire') {
          if (_layers.fire) _lFire?.addTo(_map); else _lFire && _map?.removeLayer(_lFire);
        } else if (layer === 'weather') {
          if (_warnFillLayer) {
            if (_layers.weather) _warnFillLayer.addTo(_map); else _map?.removeLayer(_warnFillLayer);
          }
        } else if (layer === 'hotspots') {
          if (_layers.hotspots) _lHotspots?.addTo(_map); else _lHotspots && _map?.removeLayer(_lHotspots);
        } else if (layer === 'burnt') {
          if (_layers.burnt) _lBurnt?.addTo(_map); else _lBurnt && _map?.removeLayer(_lBurnt);
        }
      });
    });
  }

  /* Single source of truth for the active list filter — keeps the filter chips
     and the (clickable) stat cards in sync no matter which one was tapped. */
  function _setFilter(f) {
    _activeFilter = f || 'all';
    document.querySelectorAll('.oc-filter-btn').forEach(b =>
      b.classList.toggle('active', (b.dataset.filter || 'all') === _activeFilter));
    document.querySelectorAll('.oc-stat-card').forEach(c =>
      c.classList.toggle('selected', c.dataset.filter === _activeFilter));
    _renderList();
  }

  function _wireFilters() {
    document.querySelectorAll('.oc-filter-btn').forEach(btn => {
      btn.onclick = () => _setFilter(btn.dataset.filter || 'all');
    });
    document.querySelectorAll('.oc-sort-btn').forEach(btn => {
      btn.onclick = () => {
        _sortMode = btn.dataset.sort || 'time';
        document.querySelectorAll('.oc-sort-btn').forEach(b => b.classList.toggle('active', b === btn));
        _renderList();
      };
    });
  }

  /* ── Basemap style selector ── */
  function _wireBasemapBar() {
    document.querySelectorAll('.oc-basemap-btn').forEach(btn => {
      btn.onclick = () => _setBasemap(btn.dataset.base);
    });
  }

  /* ── Collapsible "Fontes de dados" (data sources) — collapsed by default ── */
  function _wireProvidersToggle() {
    const sec = document.getElementById('oc-providers-section');
    const btn = document.getElementById('oc-providers-toggle');
    if (!sec || !btn) return;
    btn.onclick = () => {
      const collapsed = sec.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
    };
  }

  /* ════════════════════════════════ LOAD ════════════════════════════ */

  async function _load() {
    if (_refreshing) return;
    _setRefreshing(true);
    _showSkeleton();
    _renderProviders();

    const [r0, r1, r2] = await Promise.allSettled([
      _fetchEarthquakes(),
      _fetchWildfires(),
      _fetchWarnings(),
    ]);
    const eqs   = r0.status === 'fulfilled' ? r0.value : [];
    const fires = r1.status === 'fulfilled' ? r1.value : [];
    const warns = r2.status === 'fulfilled' ? r2.value : [];

    _incidents = [...eqs, ...fires, ...warns]
      .sort((a, b) => _ts(b.time) - _ts(a.time));

    _renderEqMarkers(eqs);
    _renderFireMarkers(fires);
    _renderWarnPolygons(warns);
    _renderStats(eqs, fires, warns);
    _renderProviders();
    _renderList();
    _setLastUpdate();
    _setRefreshing(false);
  }

  /* ════════════════════════════════ BUILD SHELL ═════════════════════ */

  function _buildShell(view) {
    view.innerHTML = `
      <div class="oc-shell">
        <div class="oc-header">
          <div class="oc-header-title">
            <span class="oc-header-title-icon">🚨</span>
            Ocorrências Portugal
          </div>
          <div class="oc-header-meta">
            <div class="oc-status-dot" id="oc-status-dot"></div>
            <span class="oc-last-update">A carregar…</span>
          </div>
          <div class="oc-header-right">
            <div class="oc-view-toggle" id="oc-view-toggle" role="tablist" aria-label="Ver mapa ou lista">
              <button class="oc-vt-btn active" data-view="map" role="tab">🗺 Mapa</button>
              <button class="oc-vt-btn" data-view="list" role="tab">📋 Lista</button>
            </div>
            <button class="oc-refresh-btn" id="oc-refresh">
              <span class="oc-refresh-icon">↻</span> Atualizar
            </button>
          </div>
        </div>

        <div class="oc-body oc-show-map">
          <div class="oc-map-side">
            <div id="oc-leaflet-map"></div>

            <div class="oc-basemap-bar">
              <button class="oc-basemap-btn active" data-base="standard">Padrão</button>
              <button class="oc-basemap-btn" data-base="dark">Escuro</button>
              <button class="oc-basemap-btn" data-base="satellite">Satélite</button>
              <button class="oc-basemap-btn" data-base="satellite-labels">Satélite + Rótulos</button>
              <button class="oc-basemap-btn" data-base="gibs" title="Imagem de satélite VIIRS do próprio dia (NASA) — vê fumo e nuvens reais">🛰 Hoje</button>
            </div>

            <div class="oc-layer-bar">
              <button class="oc-layer-btn active" data-layer="earthquake">
                <span class="oc-layer-btn-dot eq"></span>Sismos
              </button>
              <button class="oc-layer-btn active" data-layer="fire">
                <span class="oc-layer-btn-dot fire"></span>Incêndios
              </button>
              <button class="oc-layer-btn active" data-layer="weather">
                <span class="oc-layer-btn-dot wx"></span>Avisos
              </button>
              <button class="oc-layer-btn" data-layer="hotspots" title="Deteções térmicas por satélite (EFFIS/Copernicus)">
                <span class="oc-layer-btn-dot hs"></span>Focos satélite
              </button>
              <button class="oc-layer-btn" data-layer="burnt" title="Áreas ardidas recentes (EFFIS/Copernicus)">
                <span class="oc-layer-btn-dot ba"></span>Área ardida
              </button>
            </div>

            <div class="oc-map-legend" id="oc-map-legend">
              <button class="oc-legend-title" id="oc-legend-toggle" aria-expanded="true">Legenda <span class="oc-legend-chevron">▾</span></button>
              <div class="oc-legend-body">
              <div class="oc-legend-section">
                <div class="oc-legend-label">Incêndios (dimensão)</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#f97316;width:8px;height:8px"></div>Pequena</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#f97316;width:13px;height:13px"></div>Média / grande</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#f97316;width:18px;height:18px"></div>Grande dispositivo</div>
                <div class="oc-legend-note">Tamanho = nº de operacionais</div>
              </div>
              <div class="oc-legend-section">
                <div class="oc-legend-label">Sismos (Mag.)</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#22c55e"></div>&lt; 2.0</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#eab308"></div>2.0 – 3.4</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#f97316"></div>3.5 – 4.9</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#ef4444"></div>≥ 5.0</div>
              </div>
              <div class="oc-legend-section">
                <div class="oc-legend-label">Incêndios (estado)</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#3b82f6"></div>Novo / despacho</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#f97316"></div>Em curso</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#eab308"></div>Em resolução</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#ef4444"></div>Significativo</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#b91c1c"></div>Grande dispositivo</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#22c55e"></div>Vigilância</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#9ca3af"></div>Conclusão / encerrada</div>
              </div>
              <div class="oc-legend-section">
                <div class="oc-legend-label">Avisos IPMA</div>
                <div class="oc-legend-row"><div class="oc-legend-fill" style="background:#eab30855;border-color:#eab308"></div>Amarelo</div>
                <div class="oc-legend-row"><div class="oc-legend-fill" style="background:#f9731655;border-color:#f97316"></div>Laranja</div>
                <div class="oc-legend-row"><div class="oc-legend-fill" style="background:#ef444455;border-color:#ef4444"></div>Vermelho</div>
              </div>
              <div class="oc-legend-section">
                <div class="oc-legend-label">Satélite (EFFIS)</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#ff3d00"></div>Foco de calor</div>
                <div class="oc-legend-row"><div class="oc-legend-fill" style="background:#7f1d1d88;border-color:#7f1d1d"></div>Área ardida</div>
                <div class="oc-legend-note">Ativa nas camadas do mapa</div>
              </div>
              </div>
            </div>

            <div class="oc-detail-panel" id="oc-detail-panel">
              <button class="oc-detail-close" id="oc-detail-close">✕</button>
              <div class="oc-detail-content"></div>
            </div>
          </div>

          <div class="oc-stats-panel">
            <!-- Map-first priority: Occurrences are the primary side content -->
            <div class="oc-incidents-section">
              <div class="oc-incidents-header">
                <span class="oc-incidents-title">Ocorrências ativas</span>
                <div class="oc-sort-toggle" role="group" aria-label="Ordenar lista">
                  <button class="oc-sort-btn active" data-sort="time" title="Mais recentes primeiro">Recentes</button>
                  <button class="oc-sort-btn" data-sort="sev" title="Mais graves primeiro">Gravidade</button>
                </div>
                <span class="oc-incidents-count">—</span>
              </div>
              <div class="oc-incidents-filter">
                <button class="oc-filter-btn active" data-filter="all">Todos</button>
                <button class="oc-filter-btn" data-filter="earthquake">Sismos</button>
                <button class="oc-filter-btn" data-filter="fire">Incêndios</button>
                <button class="oc-filter-btn" data-filter="weather">Avisos</button>
              </div>
              <div class="oc-incidents-list"></div>
            </div>

            <div class="oc-stat-section">
              <div class="oc-stat-grid oc-stat-grid--compact">
                ${Array(4).fill('<div class="oc-stat-card all"><div class="oc-stat-num">—</div><div class="oc-stat-label">…</div></div>').join('')}
              </div>
            </div>

            <div class="oc-providers-section collapsed" id="oc-providers-section">
              <button class="oc-providers-toggle" id="oc-providers-toggle" aria-expanded="false">
                <span class="oc-providers-label">Fontes de dados</span>
                <span class="oc-providers-chevron">▸</span>
              </button>
              <div class="oc-providers-body">
                <div class="oc-key-panel" id="oc-key-panel">
                  <div class="oc-key-title">🔑 Chave API Aberta (opcional)</div>
                  <div class="oc-key-desc">
                    Os incêndios já vêm <b>em direto</b> da API Aberta, com o snapshot automático
                    (≈ 15 min) como reserva. Uma chave gratuita dá <b>limites de utilização maiores</b>
                    e garante a ligação em direto se o acesso sem chave for restringido.
                  </div>
                  <ol class="oc-key-steps">
                    <li>Cria uma conta gratuita em <a href="https://apiaberta.pt" target="_blank" rel="noopener">apiaberta.pt</a></li>
                    <li>No painel de developer, copia a tua <b>API key</b></li>
                    <li>Cola-a aqui — fica guardada <b>só neste browser</b> (localStorage)</li>
                  </ol>
                  <div class="oc-key-row">
                    <input type="password" class="oc-key-input" id="oc-key-input"
                           placeholder="A tua X-API-Key…" autocomplete="off" spellcheck="false">
                    <button class="oc-key-btn" id="oc-key-save">Guardar</button>
                    <button class="oc-key-btn ghost" id="oc-key-clear" hidden>Remover</button>
                  </div>
                  <div class="oc-key-status" id="oc-key-status"></div>
                </div>
                <div class="oc-providers"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.querySelector('#oc-refresh').onclick = () => {
      Object.values(CACHE).forEach(k => sessionStorage.removeItem(k));
      _load();
    };

    document.querySelector('#oc-detail-close').onclick = () => {
      document.querySelector('.oc-detail-panel')?.classList.remove('open');
      _detailInc = null;
    };

    /* Mobile Mapa/Lista toggle — switches which pane the .oc-body shows. */
    const vt = document.getElementById('oc-view-toggle');
    vt?.addEventListener('click', e => {
      const btn = e.target.closest('.oc-vt-btn');
      if (!btn) return;
      _setMobileView(btn.dataset.view);
    });

    /* Collapsible legend (handy on small screens). */
    const lt = document.getElementById('oc-legend-toggle');
    lt?.addEventListener('click', () => {
      const lg = document.getElementById('oc-map-legend');
      const open = lg.classList.toggle('collapsed');
      lt.setAttribute('aria-expanded', String(!open));
    });
    /* Start collapsed on phones so the legend doesn't cover the small map. */
    if (window.innerWidth <= 600) {
      document.getElementById('oc-map-legend')?.classList.add('collapsed');
      lt?.setAttribute('aria-expanded', 'false');
    }
  }

  /* Toggle the mobile single-pane view (map vs list). On desktop both show, so
     this only affects the <=900px layout via the .oc-show-map/.oc-show-list class. */
  function _setMobileView(view) {
    const body = document.querySelector('.oc-body');
    if (!body) return;
    const showList = view === 'list';
    body.classList.toggle('oc-show-list', showList);
    body.classList.toggle('oc-show-map', !showList);
    document.querySelectorAll('#oc-view-toggle .oc-vt-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.view === view));
    /* The map needs a resize nudge when it becomes visible again. */
    if (!showList) setTimeout(() => { try { _map?.invalidateSize(); } catch (e) {} }, 60);
  }

  /* ════════════════════════════════ AUTO-REFRESH ════════════════════ */

  let _autoTimer = null, _tickTimer = null;
  function _startAutoRefresh() {
    if (_autoTimer) return;
    /* Re-fetch every TTL so the panel stays current; the TTL-aware cache
       prevents unnecessary network calls if the user is jumping back and forth. */
    _autoTimer = setInterval(() => {
      const view = document.getElementById('view-ocorrencias');
      if (!view?.classList.contains('active')) return;
      /* Invalidate caches so we get fresh data on this tick. */
      Object.values(CACHE).forEach(k => sessionStorage.removeItem(k));
      _load();
    }, TTL);
    _tickTimer = setInterval(_renderLastUpdate, 30000);
  }

  /* ════════════════════════════════ PUBLIC ══════════════════════════ */

  async function show() {
    const view = document.getElementById('view-ocorrencias');
    if (!view) return;

    if (!_inited) {
      _buildShell(view);
      await _loadLeaflet();
      _initMap();
      _wireLayerBar();
      _wireFilters();
      _wireBasemapBar();
      _wireProvidersToggle();
      _wireKeyPanel();
      _inited = true;
      _load();
      _startAutoRefresh();
    } else {
      _map?.invalidateSize();
    }
  }

  return { show };
})();
