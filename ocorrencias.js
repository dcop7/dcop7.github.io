/* ══════════════════════════════════════════════════════════════════
   OCORRÊNCIAS PORTUGAL — Civil alerts & incidents dashboard
   Providers: IPMA earthquakes, IPMA weather warnings
══════════════════════════════════════════════════════════════════ */
const OcorrenciasPage = (function () {
  'use strict';

  /* ── API endpoints ── */
  const IPMA_EQ_URL   = 'https://api.ipma.pt/open-data/observation/seismology/list-observations-hour.json';
  const IPMA_WARN_URL = 'https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json';
  const CACHE_EQ      = 'oc-cache-eq';
  const CACHE_WARN    = 'oc-cache-warn';
  const TTL           = 10 * 60 * 1000; // 10 min

  /* ── State ── */
  let _map       = null;
  let _inited    = false;
  let _layers    = { earthquake: true, weather: true };
  let _incidents = [];
  let _activeFilter = 'all';
  let _lEq = null, _lWarn = null;
  let _refreshing = false;

  /* ── Cache helpers ── */
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

  /* ── Leaflet lazy load ── */
  async function _loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
        document.head.appendChild(link);
      }
      const script = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /* ════════════════════════════════ PROVIDERS ══════════════════════ */

  async function _fetchEarthquakes() {
    const cached = _fromCache(CACHE_EQ);
    if (cached) return cached;
    try {
      const r    = await fetch(IPMA_EQ_URL);
      const json = await r.json();
      const data = (json.data || json || []).map(e => ({
        type:   'earthquake',
        id:     `eq-${e.time || Math.random()}`,
        mag:    parseFloat(e.mag || e.magnitude || 0),
        magType: e.magType || 'ML',
        lat:    parseFloat(e.lat || e.latitude),
        lon:    parseFloat(e.lon || e.longitude),
        depth:  parseFloat(e.depth || 0),
        time:   e.time || e.dataUpdate || '',
        title:  e.local || e.obsRegion || 'Sismo',
        district: e.obsRegion || e.local || '—',
      })).filter(e => !isNaN(e.lat) && !isNaN(e.lon));
      _toCache(CACHE_EQ, data);
      return data;
    } catch (err) {
      return _fromCache(CACHE_EQ) || [];
    }
  }

  async function _fetchWarnings() {
    const cached = _fromCache(CACHE_WARN);
    if (cached) return cached;
    try {
      const r    = await fetch(IPMA_WARN_URL);
      const json = await r.json();
      const raw  = json.data || json || [];
      const now  = Date.now();
      const data = raw
        .filter(w => {
          const end = w.endTime ? new Date(w.endTime).getTime() : Infinity;
          return end > now && w.level !== 'green';
        })
        .map(w => ({
          type:     'weather',
          id:       `wx-${w.idAreaAviso || Math.random()}`,
          title:    `${w.awarenessType || 'Aviso'} — ${(w.area || w.district || {}).name || '—'}`,
          level:    w.level || 'yellow',
          warnType: w.awarenessType || '',
          district: (w.area || w.district || {}).name || '—',
          time:     w.startTime || '',
          endTime:  w.endTime   || '',
          lat:      w.lat || _districtLat(w.area?.id || w.idAreaAviso),
          lon:      w.lon || _districtLon(w.area?.id || w.idAreaAviso),
        }))
        .filter(w => w.lat);
      _toCache(CACHE_WARN, data);
      return data;
    } catch (err) {
      return _fromCache(CACHE_WARN) || [];
    }
  }

  /* Portugal district centroids (approx) */
  const DISTRICT_COORDS = {
    AVR: [40.64, -8.65], BJA: [37.96, -7.87], BRG: [41.55, -8.42], BGC: [40.67, -7.50],
    CBR: [40.21, -8.43], CTB: [39.83, -7.49], FAR: [37.01, -7.93], GRD: [40.53, -7.27],
    LEI: [39.74, -8.81], LIS: [38.72, -9.14], PTM: [39.30, -8.57], PRT: [41.16, -8.62],
    STB: [38.52, -8.89], STM: [39.23, -8.69], VST: [38.57, -7.91], VRL: [41.30, -7.74],
    VIS: [40.66, -7.91], MAD: [32.75, -17.00], AZR: [37.74, -25.67],
  };
  function _districtLat(id) { return DISTRICT_COORDS[id]?.[0] || null; }
  function _districtLon(id) { return DISTRICT_COORDS[id]?.[1] || null; }

  /* ════════════════════════════════ MAP ═════════════════════════════ */

  function _initMap() {
    const el = document.getElementById('oc-leaflet-map');
    if (!el || _map) return;

    _map = L.map(el, { center: [39.5, -8.0], zoom: 6, minZoom: 5, maxZoom: 12 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
    }).addTo(_map);

    _lEq   = L.layerGroup().addTo(_map);
    _lWarn = L.layerGroup().addTo(_map);
  }

  function _magClass(mag) {
    if (mag < 2) return 'low';
    if (mag < 3.5) return 'mod';
    if (mag < 5)   return 'high';
    return 'severe';
  }

  function _renderEqMarkers(eqs) {
    _lEq?.clearLayers();
    eqs.forEach(eq => {
      const cls = _magClass(eq.mag);
      const szMap = { low: 8, mod: 12, high: 16, severe: 22 };
      const sz  = szMap[cls] || 10;
      const clr = { low: '#22c55e', mod: '#eab308', high: '#f97316', severe: '#ef4444' }[cls];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${clr};border:2px solid ${clr}44;box-shadow:0 0 ${sz}px ${clr}88;cursor:pointer"></div>`,
        iconSize:   [sz, sz],
        iconAnchor: [sz / 2, sz / 2],
      });
      L.marker([eq.lat, eq.lon], { icon })
        .bindPopup(_eqPopup(eq), { className: 'oc-eq-popup' })
        .addTo(_lEq);
    });
  }

  function _eqPopup(eq) {
    const cls = _magClass(eq.mag);
    const t   = eq.time ? new Date(eq.time).toLocaleString('pt-PT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—';
    return `<div class="oc-eq-popup-inner">
      <div class="oc-eq-popup-header">
        <div class="oc-mag-badge mag-${cls}">${eq.mag.toFixed(1)}</div>
        <div class="oc-eq-popup-title">${eq.title}</div>
      </div>
      <div class="oc-eq-popup-rows">
        <div class="oc-eq-popup-row"><span>Profundidade</span><span class="oc-eq-popup-val">${eq.depth} km</span></div>
        <div class="oc-eq-popup-row"><span>Tipo</span><span class="oc-eq-popup-val">${eq.magType}</span></div>
        <div class="oc-eq-popup-row"><span>Hora</span><span class="oc-eq-popup-val">${t}</span></div>
      </div>
    </div>`;
  }

  function _renderWarnMarkers(warns) {
    _lWarn?.clearLayers();
    warns.forEach(w => {
      if (!w.lat || !w.lon) return;
      const clrMap = { yellow: '#eab308', orange: '#f97316', red: '#ef4444' };
      const clr = clrMap[w.level] || '#eab308';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid ${clr};filter:drop-shadow(0 0 5px ${clr}88);cursor:pointer"></div>`,
        iconSize: [18, 16], iconAnchor: [9, 16],
      });
      L.marker([w.lat, w.lon], { icon })
        .bindPopup(`<div class="oc-wx-popup-inner">
          <div class="oc-wx-popup-title"><span class="oc-wx-popup-icon">⚠</span>${w.title}</div>
          <div style="font-size:.7rem;color:var(--muted)">Até ${w.endTime ? new Date(w.endTime).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
        </div>`, { className: 'oc-eq-popup' })
        .addTo(_lWarn);
    });
  }

  /* ════════════════════════════════ UI ══════════════════════════════ */

  function _renderStats(eqs, warns) {
    const total = eqs.length + warns.length;
    const statGrid = document.querySelector('.oc-stat-grid');
    if (!statGrid) return;
    statGrid.innerHTML = `
      <div class="oc-stat-card all">
        <div class="oc-stat-header"><span class="oc-stat-icon">📊</span></div>
        <div class="oc-stat-num">${total}</div>
        <div class="oc-stat-label">Total</div>
      </div>
      <div class="oc-stat-card eq">
        <div class="oc-stat-header"><span class="oc-stat-icon">🔴</span></div>
        <div class="oc-stat-num">${eqs.length}</div>
        <div class="oc-stat-label">Sismos</div>
      </div>
      <div class="oc-stat-card wx">
        <div class="oc-stat-header"><span class="oc-stat-icon">⚠</span></div>
        <div class="oc-stat-num">${warns.length}</div>
        <div class="oc-stat-label">Avisos</div>
      </div>
      <div class="oc-stat-card eq">
        <div class="oc-stat-header"><span class="oc-stat-icon">💥</span></div>
        <div class="oc-stat-num">${eqs.filter(e => e.mag >= 3).length}</div>
        <div class="oc-stat-label">Mag ≥ 3</div>
      </div>`;
  }

  function _renderList(incidents) {
    const list = document.querySelector('.oc-incidents-list');
    const countEl = document.querySelector('.oc-incidents-count');
    if (!list) return;

    const filtered = _activeFilter === 'all'
      ? incidents
      : incidents.filter(i => i.type === _activeFilter || (_activeFilter === 'earthquake' && i.type === 'earthquake') || (_activeFilter === 'weather' && i.type === 'weather'));

    if (countEl) countEl.textContent = filtered.length;

    if (!filtered.length) {
      list.innerHTML = `<div class="oc-no-data"><div class="oc-no-data-icon">📭</div><div class="oc-no-data-msg">Sem ocorrências nesta categoria neste momento.</div></div>`;
      return;
    }

    list.innerHTML = filtered.map(inc => {
      const dotCls = inc.type === 'earthquake' ? 'eq' : 'weather';
      const magHtml = inc.type === 'earthquake'
        ? `<span class="oc-incident-mag ${_magClass(inc.mag)}">${inc.mag?.toFixed(1) || '?'}</span>` : '';
      const t = inc.time ? _relTime(inc.time) : '';
      return `<div class="oc-incident-item" data-id="${inc.id}">
        <div class="oc-incident-dot ${dotCls}"></div>
        <div class="oc-incident-body">
          <div class="oc-incident-title">${inc.title}</div>
          <div class="oc-incident-meta">
            <span class="oc-incident-district">📍 ${inc.district}</span>
            ${magHtml}
            ${t ? `<span class="oc-incident-time">${t}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.oc-incident-item').forEach(item => {
      item.onclick = () => {
        const inc = filtered.find(i => i.id === item.dataset.id);
        if (inc && _map && inc.lat && inc.lon) {
          _map.flyTo([inc.lat, inc.lon], 9, { duration: 0.8 });
          list.querySelectorAll('.oc-incident-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
        }
      };
    });
  }

  function _relTime(iso) {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const m    = Math.floor(diff / 60000);
      if (m < 1) return 'agora mesmo';
      if (m < 60) return `há ${m}m`;
      const h = Math.floor(m / 60);
      if (h < 24) return `há ${h}h`;
      return `há ${Math.floor(h / 24)}d`;
    } catch (e) { return ''; }
  }

  function _setLastUpdate() {
    const el = document.querySelector('.oc-last-update');
    if (el) el.textContent = `Atualizado: ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
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
    const btn = document.querySelector('.oc-refresh-btn');
    if (btn) btn.classList.toggle('loading', on);
  }

  /* ── Wire layer toggles ── */
  function _wireLayerBar() {
    document.querySelectorAll('.oc-layer-btn').forEach(btn => {
      const layer = btn.dataset.layer;
      btn.classList.toggle('active', _layers[layer] !== false);
      btn.addEventListener('click', () => {
        _layers[layer] = !_layers[layer];
        btn.classList.toggle('active', _layers[layer]);
        if (layer === 'earthquake') {
          if (_layers.earthquake) _lEq?.addTo(_map); else _map?.removeLayer(_lEq);
        } else if (layer === 'weather') {
          if (_layers.weather) _lWarn?.addTo(_map); else _map?.removeLayer(_lWarn);
        }
      });
    });
  }

  function _wireFilters() {
    document.querySelectorAll('.oc-filter-btn').forEach(btn => {
      btn.onclick = () => {
        _activeFilter = btn.dataset.filter || 'all';
        document.querySelectorAll('.oc-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
        _renderList(_incidents);
      };
    });
  }

  /* ════════════════════════════════ LOAD ════════════════════════════ */

  async function _load() {
    if (_refreshing) return;
    _setRefreshing(true);
    _showSkeleton();

    let eqs = [], warns = [];
    const results = await Promise.allSettled([_fetchEarthquakes(), _fetchWarnings()]);
    if (results[0].status === 'fulfilled') eqs   = results[0].value;
    if (results[1].status === 'fulfilled') warns = results[1].value;

    _incidents = [...eqs, ...warns].sort((a, b) => (b.time || '') > (a.time || '') ? 1 : -1);

    _renderEqMarkers(eqs);
    _renderWarnMarkers(warns);
    _renderStats(eqs, warns);
    _renderList(_incidents);
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
              <button class="oc-layer-btn active" data-layer="earthquake"><span class="oc-layer-btn-icon">🔴</span> Sismos</button>
              <button class="oc-layer-btn active" data-layer="weather"><span class="oc-layer-btn-icon">⚠</span> Avisos</button>
            </div>
            <div class="oc-map-legend">
              <div class="oc-legend-row"><div class="oc-legend-dot eq"></div> Sismo</div>
              <div class="oc-legend-row"><div class="oc-legend-dot wx"></div> Aviso meteorológico</div>
            </div>
          </div>
          <div class="oc-stats-panel">
            <div class="oc-stat-section">
              <div class="oc-stat-section-label">Estatísticas</div>
              <div class="oc-stat-grid">
                ${Array(4).fill('<div class="oc-stat-card all"><div class="oc-stat-num">—</div><div class="oc-stat-label">…</div></div>').join('')}
              </div>
            </div>
            <div class="oc-incidents-section">
              <div class="oc-incidents-header">
                <span class="oc-incidents-title">Ocorrências</span>
                <span class="oc-incidents-count">—</span>
              </div>
              <div class="oc-incidents-filter">
                <button class="oc-filter-btn active" data-filter="all">Todos</button>
                <button class="oc-filter-btn" data-filter="earthquake">Sismos</button>
                <button class="oc-filter-btn" data-filter="weather">Avisos</button>
              </div>
              <div class="oc-incidents-list"></div>
            </div>
          </div>
        </div>
      </div>`;

    document.querySelector('#oc-refresh').onclick = () => {
      sessionStorage.removeItem(CACHE_EQ);
      sessionStorage.removeItem(CACHE_WARN);
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
