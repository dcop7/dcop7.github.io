/* ══════════════════════════════════════════════════════════════════
   OCORRÊNCIAS PORTUGAL — Civil alerts & incidents dashboard
   Providers: USGS (earthquakes), fogos.pt (wildfires), IPMA (weather warnings)
══════════════════════════════════════════════════════════════════ */
const OcorrenciasPage = (function () {
  'use strict';

  /* ── API endpoints ── */
  /* USGS real-time feed — filtered client-side to Portugal/Atlantic bbox */
  const USGS_URL  = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_week.geojson';
  const FOGOS_URL = 'https://api.fogos.pt/v2/incidents/active';
  const IPMA_URL  = 'https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json';
  const TTL       = 10 * 60 * 1000;
  const CACHE     = { eq: 'oc3-eq', fire: 'oc3-fire', warn: 'oc3-warn' };

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
      name: 'fogos.pt',
      icon: '🔥',
      official: false,
      freq: 'Tempo real (sistema SADO da ANEPC)',
      scope: 'Portugal continental — ocorrências ativas de proteção civil',
      note: 'Projeto cívico de código aberto. Agrega dados do sistema SADO da ANEPC — não é uma fonte governamental direta.',
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
    'Braga':            [41.55, -8.42],  'Bragança':         [40.67, -7.50],
    'Castelo Branco':   [39.83, -7.49],  'Coimbra':          [40.21, -8.43],
    'Évora':            [38.57, -7.91],  'Faro':             [37.01, -7.93],
    'Guarda':           [40.53, -7.27],  'Leiria':           [39.74, -8.81],
    'Lisboa':           [38.72, -9.14],  'Porto':            [41.16, -8.62],
    'Portalegre':       [39.30, -8.57],  'Setúbal':          [38.52, -8.89],
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

  /* ── Module state ── */
  let _map               = null;
  let _inited            = false;
  let _layers            = { earthquake: true, fire: true, weather: true };
  let _incidents         = [];
  let _activeFilter      = 'all';
  let _lEq               = null;
  let _lFire             = null;
  let _districtGeoData   = null;
  let _districtBorderLayer = null;
  let _warnFillLayer     = null;
  let _tileLayer         = null;
  let _themeObs          = null;
  let _refreshing        = false;
  let _detailInc         = null;

  /* ── Session cache ── */
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
  function _fetch(url, ms = 12000) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
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
  function _tileUrl() {
    return _isDark()
      ? 'https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  }
  function _watchTheme() {
    if (_themeObs) return;
    _themeObs = new MutationObserver(() => {
      if (!_map || !_tileLayer) return;
      _map.removeLayer(_tileLayer);
      _tileLayer = L.tileLayer(_tileUrl(), {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
      }).addTo(_map);
      _renderDistrictBorders();
    });
    _themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── District boundary GeoJSON (click_that_hood, 18 mainland districts) ── */
  const PT_DISTRICTS_GEO = 'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/portugal.geojson';

  async function _loadDistrictGeoData() {
    if (_districtGeoData || !_map) return;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(PT_DISTRICTS_GEO, { signal: ctrl.signal });
      if (!r.ok) return;
      _districtGeoData = await r.json();
      _renderDistrictBorders();
    } catch (e) { /* silently skip — map still functional without boundary overlay */ }
  }

  function _renderDistrictBorders() {
    if (!_map || !_districtGeoData) return;
    if (_districtBorderLayer) { _districtBorderLayer.remove(); _districtBorderLayer = null; }
    _districtBorderLayer = L.geoJSON(_districtGeoData, {
      style: () => ({
        fillColor:   'transparent',
        color:       _isDark() ? 'rgba(180,200,255,.35)' : 'rgba(60,80,140,.3)',
        weight:      1.2,
        fillOpacity: 0,
        interactive: false,
      }),
      interactive: false,
    }).addTo(_map);
    _lEq?.bringToFront();
    _lFire?.bringToFront();
    _warnFillLayer?.bringToFront();
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
    if (cached) { _prov.eq.ok = true; return cached; }
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

  async function _fetchWildfires() {
    const cached = _fromCache(CACHE.fire);
    if (cached) { _prov.fire.ok = true; return cached; }
    try {
      const r = await _fetch(FOGOS_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const raw  = Array.isArray(json) ? json : (json.data || json.incidents || []);
      const data = raw.map(ev => {
        const lat = parseFloat(ev.lat);
        const lon = parseFloat(ev.lon);
        if (isNaN(lat) || isNaN(lon)) return null;
        /* fogos.pt API uses man/terrain/aerial; fall back to legacy field names */
        return {
          type:         'fire',
          id:           `fire-${ev.id || Math.random()}`,
          lat, lon,
          title:        ev.natureza  || ev.tipo || 'Incêndio',
          municipio:    ev.concelho  || ev.municipio  || null,
          freguesia:    ev.freguesia || null,
          status:       ev.status    || null,
          operacionais: ev.man     != null ? +ev.man     : ev.operacionais != null ? +ev.operacionais : null,
          veiculos:     ev.terrain != null ? +ev.terrain : ev.veiculos     != null ? +ev.veiculos     : null,
          aereos:       ev.aerial  != null ? +ev.aerial  : ev.aereos       != null ? +ev.aereos       : null,
          area:         ev.area    != null ? +ev.area    : null,
          time:         ev.criacao     || null,
          lastUpdate:   ev.atualizacao || null,
          district:     ev.district || ev.concelho || ev.municipio || ev.freguesia || '—',
          source:       'fogos.pt',
        };
      }).filter(Boolean);
      _toCache(CACHE.fire, data);
      _prov.fire = { ok: true, time: _nowTime() };
      return data;
    } catch (err) {
      _prov.fire = { ok: false, time: null };
      return _fromCache(CACHE.fire) || [];
    }
  }

  async function _fetchWarnings() {
    const cached = _fromCache(CACHE.warn);
    if (cached) { _prov.warn.ok = true; return cached; }
    try {
      const r = await _fetch(IPMA_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const raw  = Array.isArray(json) ? json : (json.data || []);
      const now  = Date.now();
      const data = raw
        .filter(w => {
          const end = w.endTime ? new Date(w.endTime).getTime() : Infinity;
          const lvl = (w.awarenessLevel || w.level || '').toLowerCase();
          return end > now && lvl !== 'green' && lvl !== 'verde';
        })
        .map(w => {
          const areaCode     = w.idAreaAviso ?? w.area?.id ?? null;
          const districtName = IPMA_AREA_TO_DISTRICT[areaCode] || w.area?.name || w.district?.name || w.local || '—';
          const centroid     = DISTRICT_CENTROIDS[districtName];
          const level        = (w.awarenessLevel || w.level || 'yellow').toLowerCase();
          return {
            type:     'weather',
            id:       `wx-${areaCode || w.warningId || Math.random()}`,
            title:    `${w.awarenessTypeName || w.awarenessType || 'Aviso'} — ${districtName}`,
            level,
            warnType: w.awarenessTypeName || w.awarenessType || '',
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
      center: [39.5, -8.0], zoom: 6, minZoom: 5, maxZoom: 13,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(_map);
    _tileLayer = L.tileLayer(_tileUrl(), {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
    }).addTo(_map);

    _lEq   = L.layerGroup().addTo(_map);
    _lFire = L.layerGroup().addTo(_map);
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
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${clr};border:2px solid ${clr}44;box-shadow:0 0 ${sz}px ${clr}88;cursor:pointer"></div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      });
      L.marker([eq.lat, eq.lon], { icon })
        .on('click', () => _openDetail(eq))
        .addTo(_lEq);
    });
  }

  function _renderFireMarkers(fires) {
    if (!_lFire) return;
    _lFire.clearLayers();
    if (!_layers.fire) return;
    fires.forEach(f => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 0 6px #ff6600cc);cursor:pointer" title="${f.title}">🔥</div>`,
        iconSize: [22, 22], iconAnchor: [11, 11],
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

    _lEq?.bringToFront();
    _lFire?.bringToFront();
  }

  /* ════════════════════════════════ DETAIL PANEL ═══════════════════ */

  function _openDetail(inc) {
    _detailInc = inc;
    if (inc.lat != null && inc.lon != null) {
      _map?.flyTo([inc.lat, inc.lon], Math.max(_map.getZoom(), 9), { duration: 0.7 });
    }
    _renderDetail(inc, null);
    if (inc.lat != null && inc.lon != null) {
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
      const statusMap = { active: 'Ativo', resolved: 'Resolvido', 'em curso': 'Em curso', 'conclusão': 'Em conclusão', despacho: 'Em despacho' };
      const statusLbl = statusMap[(inc.status || '').toLowerCase()] || inc.status;
      const hasResources = inc.operacionais != null || inc.veiculos != null || inc.aereos != null;
      content = `
        <div class="oc-detail-hero fire">
          <div class="oc-detail-fire-icon">🔥</div>
          <div>
            <div class="oc-detail-type-lbl">Incêndio Florestal</div>
            ${statusLbl ? `<div class="oc-detail-status-badge">${statusLbl}</div>` : ''}
          </div>
        </div>
        <div class="oc-detail-rows">
          <div class="oc-detail-row"><span class="oc-detail-label">Natureza</span><span>${_val(inc.title)}</span></div>
          ${_geoRows(geo || { district: inc.district, municipality: inc.municipio, parish: inc.freguesia })}
          <div class="oc-detail-row"><span class="oc-detail-label">Área ardida</span><span>${_val(inc.area != null ? inc.area.toFixed(2) : null, ' ha')}</span></div>
          ${hasResources ? `
          <div class="oc-detail-row oc-detail-row--highlight"><span class="oc-detail-label">👷 Operacionais</span><span>${_val(inc.operacionais)}</span></div>
          <div class="oc-detail-row oc-detail-row--highlight"><span class="oc-detail-label">🚒 Veículos</span><span>${_val(inc.veiculos)}</span></div>
          <div class="oc-detail-row oc-detail-row--highlight"><span class="oc-detail-label">✈️ Meios aéreos</span><span>${_val(inc.aereos)}</span></div>` : ''}
          <div class="oc-detail-row"><span class="oc-detail-label">Coordenadas</span><span style="font-family:var(--font-mono);font-size:.78rem">${inc.lat.toFixed(4)}°N, ${Math.abs(inc.lon).toFixed(4)}°W</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Início</span><span>${_fmtTime(inc.time)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Última atualização</span><span>${_fmtTime(inc.lastUpdate)}</span></div>
          <div class="oc-detail-row"><span class="oc-detail-label">Fonte</span><span class="oc-detail-source">fogos.pt</span></div>
        </div>
        <div class="oc-detail-notice">Dados via fogos.pt (integra sistema SADO da ANEPC).</div>`;

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
        </div>`;
    }

    panel.querySelector('.oc-detail-content').innerHTML = content;
    panel.classList.add('open');
  }

  /* ════════════════════════════════ UI ══════════════════════════════ */

  function _nowTime() {
    return new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  function _fmtTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '—'; }
  }

  function _relTime(iso) {
    if (!iso) return '';
    try {
      const diff = Date.now() - new Date(iso).getTime();
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
    const big = eqs.filter(e => e.mag >= 3).length;
    statGrid.innerHTML = `
      <div class="oc-stat-card all">
        <div class="oc-stat-header"><span class="oc-stat-icon">📊</span></div>
        <div class="oc-stat-num">${eqs.length + fires.length + warns.length}</div>
        <div class="oc-stat-label">Total</div>
      </div>
      <div class="oc-stat-card eq">
        <div class="oc-stat-header"><span class="oc-stat-icon">🔴</span></div>
        <div class="oc-stat-num">${eqs.length}</div>
        <div class="oc-stat-label">Sismos</div>
      </div>
      <div class="oc-stat-card fire">
        <div class="oc-stat-header"><span class="oc-stat-icon">🔥</span></div>
        <div class="oc-stat-num">${fires.length}</div>
        <div class="oc-stat-label">Incêndios</div>
      </div>
      <div class="oc-stat-card wx">
        <div class="oc-stat-header"><span class="oc-stat-icon">⚠</span></div>
        <div class="oc-stat-num">${warns.length}</div>
        <div class="oc-stat-label">Avisos</div>
      </div>
      <div class="oc-stat-card eq">
        <div class="oc-stat-header"><span class="oc-stat-icon">💥</span></div>
        <div class="oc-stat-num">${big}</div>
        <div class="oc-stat-label">Mag ≥ 3</div>
      </div>`;
  }

  function _renderProviders() {
    const el = document.querySelector('.oc-providers');
    if (!el) return;
    el.innerHTML = ['eq', 'fire', 'warn'].map(key => {
      const p   = PROVIDERS[key];
      const s   = _prov[key];
      const cls = s.ok === null ? 'loading' : s.ok ? 'ok' : 'err';
      const tim = s.ok === null ? 'A carregar…' : s.ok ? `Atualizado às ${s.time}` : 'Falha na ligação';
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
    }).join('');
  }

  function _renderList() {
    const list    = document.querySelector('.oc-incidents-list');
    const countEl = document.querySelector('.oc-incidents-count');
    if (!list) return;

    const filtered = _activeFilter === 'all'
      ? _incidents
      : _incidents.filter(i => i.type === _activeFilter);

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
      return `<div class="oc-incident-item" data-id="${inc.id}">
        <div class="oc-incident-dot ${dotCls}"></div>
        <div class="oc-incident-body">
          <div class="oc-incident-title">${inc.title}</div>
          <div class="oc-incident-meta">
            <span class="oc-incident-district">📍 ${inc.district}</span>
            ${extra}
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
    const el = document.querySelector('.oc-last-update');
    if (el) el.textContent = `Atualizado: ${_nowTime()}`;
    const dot = document.querySelector('.oc-status-dot');
    if (dot) dot.className = 'oc-status-dot';
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
        }
      });
    });
  }

  function _wireFilters() {
    document.querySelectorAll('.oc-filter-btn').forEach(btn => {
      btn.onclick = () => {
        _activeFilter = btn.dataset.filter || 'all';
        document.querySelectorAll('.oc-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
        _renderList();
      };
    });
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
      .sort((a, b) => (b.time || '') > (a.time || '') ? 1 : -1);

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
            <button class="oc-refresh-btn" id="oc-refresh">
              <span class="oc-refresh-icon">↻</span> Atualizar
            </button>
          </div>
        </div>

        <div class="oc-body">
          <div class="oc-map-side">
            <div id="oc-leaflet-map"></div>

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
            </div>

            <div class="oc-map-legend">
              <div class="oc-legend-title">Legenda</div>
              <div class="oc-legend-section">
                <div class="oc-legend-label">Sismos (Mag.)</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#22c55e"></div>&lt; 2.0</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#eab308"></div>2.0 – 3.4</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#f97316"></div>3.5 – 4.9</div>
                <div class="oc-legend-row"><div class="oc-legend-dot" style="background:#ef4444"></div>≥ 5.0</div>
              </div>
              <div class="oc-legend-section">
                <div class="oc-legend-label">Outros</div>
                <div class="oc-legend-row"><span style="font-size:11px;line-height:1">🔥</span>Incêndio ativo</div>
                <div class="oc-legend-row"><div class="oc-legend-fill" style="background:#eab30855;border-color:#eab308"></div>Aviso amarelo</div>
                <div class="oc-legend-row"><div class="oc-legend-fill" style="background:#f9731655;border-color:#f97316"></div>Aviso laranja</div>
                <div class="oc-legend-row"><div class="oc-legend-fill" style="background:#ef444455;border-color:#ef4444"></div>Aviso vermelho</div>
              </div>
            </div>

            <div class="oc-detail-panel" id="oc-detail-panel">
              <button class="oc-detail-close" id="oc-detail-close">✕</button>
              <div class="oc-detail-content"></div>
            </div>
          </div>

          <div class="oc-stats-panel">
            <div class="oc-stat-section">
              <div class="oc-stat-section-label">Estatísticas</div>
              <div class="oc-stat-grid">
                ${Array(5).fill('<div class="oc-stat-card all"><div class="oc-stat-num">—</div><div class="oc-stat-label">…</div></div>').join('')}
              </div>
            </div>

            <div class="oc-providers-section">
              <div class="oc-providers-label">Fontes de dados</div>
              <div class="oc-providers"></div>
            </div>

            <div class="oc-incidents-section">
              <div class="oc-incidents-header">
                <span class="oc-incidents-title">Ocorrências</span>
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
      _inited = true;
      _load();
    } else {
      _map?.invalidateSize();
    }
  }

  return { show };
})();
