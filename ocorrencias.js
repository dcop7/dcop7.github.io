/* ══════════════════════════════════════════════════════════════════
   OCORRÊNCIAS PORTUGAL — Civil alerts & incidents dashboard
   Providers: USGS (earthquakes), NASA EONET (wildfires), IPMA (weather warnings)
══════════════════════════════════════════════════════════════════ */
const OcorrenciasPage = (function () {
  'use strict';

  /* ── API endpoints ── */
  const USGS_URL  = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=39.5&longitude=-8&maxradiuskm=1200&minmagnitude=1.0&limit=50&orderby=time';
  const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&bbox=-9.5,36.9,-6.1,42.2';
  const IPMA_URL  = 'https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json';
  const TTL       = 10 * 60 * 1000;
  const CACHE     = { eq: 'oc2-eq', fire: 'oc2-fire', warn: 'oc2-warn' };

  /* ── Provider status ── */
  const _prov = {
    eq:   { ok: null, time: null },
    fire: { ok: null, time: null },
    warn: { ok: null, time: null },
  };

  /* ── State ── */
  let _map       = null;
  let _inited    = false;
  let _layers    = { earthquake: true, fire: true, weather: true };
  let _incidents = [];
  let _activeFilter = 'all';
  let _lEq = null, _lFire = null, _lWarn = null;
  let _tileLayer = null;
  let _themeObs  = null;
  let _refreshing = false;

  /* ── Cache ── */
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

  /* ── Fetch with timeout ── */
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
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
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
    });
    _themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ════════════════════════════════ PROVIDERS ══════════════════════ */

  async function _fetchEarthquakes() {
    const cached = _fromCache(CACHE.eq);
    if (cached) { _prov.eq.ok = true; return cached; }
    try {
      const r = await _fetch(USGS_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const data = (json.features || []).map(f => ({
        type:    'earthquake',
        id:      `eq-${f.id}`,
        mag:     parseFloat(f.properties.mag  || 0),
        magType: f.properties.magType || 'M',
        lat:     f.geometry.coordinates[1],
        lon:     f.geometry.coordinates[0],
        depth:   Math.round(f.geometry.coordinates[2] || 0),
        time:    new Date(f.properties.time).toISOString(),
        title:   f.properties.place || 'Sismo',
        district: f.properties.place || '—',
        url:     f.properties.url   || '',
      })).filter(e => !isNaN(e.lat) && !isNaN(e.lon));
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
      const r = await _fetch(EONET_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const data = (json.events || []).flatMap(ev => {
        const geomArr = Array.isArray(ev.geometry) ? ev.geometry : [ev.geometry];
        const g = geomArr[0];
        if (!g?.coordinates) return [];
        const [lon, lat] = g.coordinates;
        if (isNaN(lat) || isNaN(lon)) return [];
        return [{
          type:     'fire',
          id:       `fire-${ev.id}`,
          lat, lon,
          title:    ev.title || 'Incêndio',
          district: ev.title || '—',
          time:     g.date || new Date().toISOString(),
          source:   ev.sources?.[0]?.url || '',
        }];
      });
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
          const areaId = w.idAreaAviso ?? w.area?.id ?? w.district?.id;
          return {
            type:     'weather',
            id:       `wx-${w.idAreaAviso || w.warningId || Math.random()}`,
            title:    `${w.awarenessTypeName || w.awarenessType || 'Aviso'} — ${w.area?.name || w.district?.name || w.local || '—'}`,
            level:    (w.awarenessLevel || w.level || 'yellow').toLowerCase(),
            warnType: w.awarenessTypeName || w.awarenessType || '',
            district: w.area?.name || w.district?.name || w.local || '—',
            time:     w.startTime || '',
            endTime:  w.endTime   || '',
            lat:      _districtLat(areaId),
            lon:      _districtLon(areaId),
          };
        })
        .filter(w => w.lat);
      _toCache(CACHE.warn, data);
      _prov.warn = { ok: true, time: _nowTime() };
      return data;
    } catch (err) {
      _prov.warn = { ok: false, time: null };
      return _fromCache(CACHE.warn) || [];
    }
  }

  /* ── District centroids ── */
  const DISTRICT_COORDS = {
    AVR: [40.64, -8.65], BJA: [37.96, -7.87], BRG: [41.55, -8.42], BGC: [40.67, -7.50],
    CBR: [40.21, -8.43], CTB: [39.83, -7.49], FAR: [37.01, -7.93], GRD: [40.53, -7.27],
    LEI: [39.74, -8.81], LIS: [38.72, -9.14], PTM: [39.30, -8.57], PRT: [41.16, -8.62],
    STB: [38.52, -8.89], STM: [39.23, -8.69], VST: [38.57, -7.91], VRL: [41.30, -7.74],
    VIS: [40.66, -7.91], MAD: [32.75, -17.00], AZR: [37.74, -25.67],
    '1': [38.72, -9.14],  '2': [38.52, -8.89],  '3': [40.21, -8.43],
    '4': [41.55, -8.42],  '5': [41.30, -7.74],  '6': [39.83, -7.49],
    '7': [37.96, -7.87],  '8': [37.01, -7.93],  '9': [39.74, -8.81],
    '10': [41.16, -8.62], '11': [38.72, -9.14], '12': [39.30, -8.57],
    '13': [41.55, -8.42], '14': [40.67, -7.50], '15': [40.53, -7.27],
    '16': [40.66, -7.91], '17': [38.57, -7.91], '18': [40.64, -8.65],
  };
  function _districtLat(id) { return DISTRICT_COORDS[String(id)]?.[0] ?? null; }
  function _districtLon(id) { return DISTRICT_COORDS[String(id)]?.[1] ?? null; }

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
    _lWarn = L.layerGroup().addTo(_map);
    _watchTheme();
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
        .bindPopup(`<div class="oc-eq-popup-inner">
          <div class="oc-eq-popup-header">
            <div class="oc-mag-badge mag-${cls}">${eq.mag.toFixed(1)}</div>
            <div class="oc-eq-popup-title">${eq.title}</div>
          </div>
          <div class="oc-eq-popup-rows">
            <div class="oc-eq-popup-row"><span>Profundidade</span><span class="oc-eq-popup-val">${eq.depth} km</span></div>
            <div class="oc-eq-popup-row"><span>Tipo</span><span class="oc-eq-popup-val">${eq.magType}</span></div>
            <div class="oc-eq-popup-row"><span>Data/hora</span><span class="oc-eq-popup-val">${_fmtTime(eq.time)}</span></div>
            <div class="oc-eq-popup-row"><span>Fonte</span><span class="oc-eq-popup-val">USGS</span></div>
          </div>
          ${eq.url ? `<a class="oc-eq-popup-link" href="${eq.url}" target="_blank" rel="noopener">Ver detalhe ↗</a>` : ''}
        </div>`, { className: 'oc-eq-popup' })
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
        html: `<div style="font-size:18px;line-height:1;filter:drop-shadow(0 0 6px #ff6600cc);cursor:pointer" title="${f.title}">🔥</div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      L.marker([f.lat, f.lon], { icon })
        .bindPopup(`<div class="oc-eq-popup-inner">
          <div class="oc-eq-popup-header">
            <div style="font-size:1.5rem;line-height:1">🔥</div>
            <div class="oc-eq-popup-title">${f.title}</div>
          </div>
          <div class="oc-eq-popup-rows">
            <div class="oc-eq-popup-row"><span>Data/hora</span><span class="oc-eq-popup-val">${_fmtTime(f.time)}</span></div>
            <div class="oc-eq-popup-row"><span>Fonte</span><span class="oc-eq-popup-val">NASA EONET</span></div>
          </div>
          ${f.source ? `<a class="oc-eq-popup-link" href="${f.source}" target="_blank" rel="noopener">Ver fonte ↗</a>` : ''}
        </div>`, { className: 'oc-eq-popup' })
        .addTo(_lFire);
    });
  }

  function _renderWarnMarkers(warns) {
    if (!_lWarn) return;
    _lWarn.clearLayers();
    if (!_layers.weather) return;
    warns.forEach(w => {
      if (!w.lat || !w.lon) return;
      const clrMap = { yellow: '#eab308', orange: '#f97316', red: '#ef4444', amarelo: '#eab308', laranja: '#f97316', vermelho: '#ef4444' };
      const clr  = clrMap[w.level] || '#eab308';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid ${clr};filter:drop-shadow(0 0 5px ${clr}88);cursor:pointer"></div>`,
        iconSize: [18, 16], iconAnchor: [9, 16],
      });
      L.marker([w.lat, w.lon], { icon })
        .bindPopup(`<div class="oc-eq-popup-inner">
          <div class="oc-eq-popup-header">
            <div style="font-size:1.3rem;line-height:1">⚠</div>
            <div class="oc-eq-popup-title">${w.title}</div>
          </div>
          <div class="oc-eq-popup-rows">
            <div class="oc-eq-popup-row"><span>Tipo</span><span class="oc-eq-popup-val">${w.warnType || '—'}</span></div>
            <div class="oc-eq-popup-row"><span>Nível</span><span class="oc-eq-popup-val" style="color:${clr}">${w.level}</span></div>
            <div class="oc-eq-popup-row"><span>Início</span><span class="oc-eq-popup-val">${_fmtTime(w.time)}</span></div>
            <div class="oc-eq-popup-row"><span>Fim</span><span class="oc-eq-popup-val">${w.endTime ? _fmtTime(w.endTime) : '—'}</span></div>
            <div class="oc-eq-popup-row"><span>Fonte</span><span class="oc-eq-popup-val">IPMA</span></div>
          </div>
        </div>`, { className: 'oc-eq-popup' })
        .addTo(_lWarn);
    });
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
    const big  = eqs.filter(e => e.mag >= 3).length;
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
    el.innerHTML = [
      { key: 'eq',   icon: '🔴', name: 'USGS — Sismos' },
      { key: 'fire', icon: '🔥', name: 'NASA EONET — Incêndios' },
      { key: 'warn', icon: '⚠',  name: 'IPMA — Avisos' },
    ].map(p => {
      const s   = _prov[p.key];
      const cls = s.ok === null ? 'loading' : s.ok ? 'ok' : 'err';
      const lbl = s.ok === null ? '…' : s.ok ? `OK · ${s.time}` : 'Erro';
      return `<div class="oc-provider-item">
        <span class="oc-provider-dot ${cls}"></span>
        <span class="oc-provider-name">${p.icon} ${p.name}</span>
        <span class="oc-provider-time">${lbl}</span>
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
      return `<div class="oc-incident-item" data-lat="${inc.lat}" data-lon="${inc.lon}" data-id="${inc.id}">
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
        const lat = parseFloat(item.dataset.lat);
        const lon = parseFloat(item.dataset.lon);
        if (_map && !isNaN(lat) && !isNaN(lon)) {
          _map.flyTo([lat, lon], 9, { duration: 0.8 });
          list.querySelectorAll('.oc-incident-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
        }
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

  /* ── Wire layer toggles ── */
  function _wireLayerBar() {
    document.querySelectorAll('.oc-layer-btn').forEach(btn => {
      const layer = btn.dataset.layer;
      btn.classList.toggle('active', _layers[layer] !== false);
      btn.addEventListener('click', () => {
        _layers[layer] = !_layers[layer];
        btn.classList.toggle('active', _layers[layer]);
        const lg = { earthquake: _lEq, fire: _lFire, weather: _lWarn }[layer];
        if (!lg || !_map) return;
        if (_layers[layer]) lg.addTo(_map); else _map.removeLayer(lg);
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
    _renderWarnMarkers(warns);
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
                <div class="oc-legend-row"><div class="oc-legend-tri" style="border-bottom-color:#eab308"></div>Aviso amarelo</div>
                <div class="oc-legend-row"><div class="oc-legend-tri" style="border-bottom-color:#f97316"></div>Aviso laranja</div>
                <div class="oc-legend-row"><div class="oc-legend-tri" style="border-bottom-color:#ef4444"></div>Aviso vermelho</div>
              </div>
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
