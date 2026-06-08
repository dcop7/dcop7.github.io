/* ══════════════════════════════════════════════════════════════════
   DADOS DO MUNDO — World Data / Global Statistics explorer
   Discover, explore and compare statistics at four levels: World ▸
   Continent ▸ Country ▸ City. Indicators come from Our World in Data
   (CC BY 4.0); cities from GeoNames (CC BY 4.0); base country facts &
   geometry are bundled in the repo. Everything is offline & lazy-loaded:
   only indicators.json (~4 KB) + values.json (~80 KB) load up front; each
   indicator's full time series and the world map load on demand.
   Charts are inline SVG (no chart lib); the choropleth is drawn from the
   bundled geojson (no tiles / network). Vanilla IIFE module.
══════════════════════════════════════════════════════════════════ */
const WorldDataExplorer = (function () {
  'use strict';

  const BASE = 'data/worlddata';
  let _root = null, _mounted = false;
  let _inds = null, _vals = null, _byId = {};
  let _countries = null, _cIso = {}, _cName = {};   // iso3 -> country, name lookups
  let _cities = null, _geo = null, _geoPaths = null, _geoBbox = {};
  const _series = {};                               // indId -> {key:[[y,v]]}
  let _catalog = null;                              // OWID chart slugs (live search)
  let _wbCat = null;                                // World Bank indicators [[code,name]]

  /* view + scope state */
  let _view = 'home';                               // home | indicator | entity | compare | web
  let _ind = null, _entity = null, _web = null;
  let _compare = [];
  const _scope = { level: 'world', cont: 'Europe', country: 'PRT', city: null };
  let _rankDir = 'top';                              // ranking order in indicator view
  let _searchT = 0;

  /* ── i18n / format ── */
  function _lang() { return typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'; }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function nf(n) { try { return Number(n).toLocaleString(_lang() === 'en' ? 'en' : 'pt-PT'); } catch { return '' + n; } }
  function compact(n) {
    const a = Math.abs(n);
    if (a >= 1e9) return round(n / 1e9, 2) + _t(' B', ' mil M');
    if (a >= 1e6) return round(n / 1e6, 2) + ' M';
    if (a >= 1e3) return round(n / 1e3, 1) + _t(' K', ' mil');
    return nf(round(n, 0));
  }
  function round(v, d) { const m = 10 ** d; return Math.round(v * m) / m; }
  const CONT_PT = { 'World':'Mundo', Africa:'África', Asia:'Ásia', Europe:'Europa',
    'North America':'América do Norte', 'South America':'América do Sul', Oceania:'Oceânia' };
  const CONTS = ['Africa','Asia','Europe','North America','South America','Oceania'];
  const SPECIALS = { 'World':'WORLD', Africa:'Africa', Asia:'Asia', Europe:'Europe', 'North America':'North America', 'South America':'South America', Oceania:'Oceania' };

  /* what each indicator actually measures (shown in the indicator view & popup) */
  const DESC = {
    life:        { pt:'Número médio de anos que um recém-nascido viveria se as condições de mortalidade de hoje se mantivessem.', en:'Average years a newborn would live if today’s mortality patterns stayed the same.' },
    gdppc:       { pt:'Valor de toda a produção económica do país por pessoa, ajustado ao custo de vida (paridade de poder de compra).', en:'Total economic output per person, adjusted for the cost of living (purchasing power parity).' },
    hdi:         { pt:'Índice de 0 a 1 que combina esperança de vida, educação e rendimento.', en:'A 0–1 index combining life expectancy, education and income.' },
    happiness:   { pt:'Avaliação média que as pessoas dão à própria vida, de 0 a 10 (World Happiness Report).', en:'Average self-reported life satisfaction, 0–10 (World Happiness Report).' },
    internet:    { pt:'Percentagem da população que usou a Internet nos últimos meses.', en:'Share of the population that used the Internet in recent months.' },
    schooling:   { pt:'Número médio de anos de escolaridade dos adultos.', en:'Average number of years of schooling among adults.' },
    doctors:     { pt:'Número de médicos por cada 1000 habitantes.', en:'Number of physicians per 1,000 people.' },
    electricity: { pt:'Percentagem da população com acesso a eletricidade.', en:'Share of the population with access to electricity.' },
    co2:         { pt:'Toneladas de CO₂ emitidas por pessoa por ano (combustíveis fósseis e indústria).', en:'Tonnes of CO₂ emitted per person per year (fossil fuels & industry).' },
    medage:      { pt:'Idade que divide a população em duas metades iguais — metade é mais nova, metade mais velha.', en:'The age that splits the population into two equal halves.' },
    fertility:   { pt:'Número médio de filhos que uma mulher teria ao longo da vida.', en:'Average number of children a woman would have over her lifetime.' },
    urban:       { pt:'Percentagem da população que vive em áreas urbanas (cidades).', en:'Share of the population living in urban areas.' },
    population:  { pt:'Número total de habitantes.', en:'Total number of inhabitants.' },
    density:     { pt:'Número de habitantes por quilómetro quadrado.', en:'Number of inhabitants per square kilometre.' },
  };
  function indDesc(ind) { const d = DESC[ind.id]; return d ? (_lang() === 'en' ? d.en : d.pt) : ''; }

  function indName(ind) { return _lang() === 'en' ? ind.en : ind.pt; }
  function indUnit(ind) { return _lang() === 'en' ? (ind.unitEn || '') : (ind.unit || ''); }
  function catName(c) {
    const M = { saude:['Health','Saúde'], economia:['Economy','Economia'], sociedade:['Society','Sociedade'],
      tecnologia:['Technology','Tecnologia'], educacao:['Education','Educação'], ambiente:['Environment','Ambiente'],
      demografia:['Demographics','Demografia'], infra:['Infrastructure','Infraestrutura'] };
    return (M[c] || [c, c])[_lang() === 'en' ? 0 : 1];
  }
  const CAT_EMOJI = { saude:'🩺', economia:'💰', sociedade:'🌍', tecnologia:'💻', educacao:'🎓', ambiente:'🌱', demografia:'👥', infra:'🏗️' };

  /* format an indicator value with its unit */
  function fmtVal(ind, v) {
    if (v == null) return '—';
    const u = indUnit(ind);
    let num;
    if (ind.id === 'population') num = compact(v);
    else if (ind.id === 'gdppc') num = '$' + nf(round(v, 0));
    else if (ind.id === 'density') num = nf(round(v, 1));
    else num = nf(round(v, ind.dec));
    return u ? `${num} ${u}` : num;
  }

  /* ── entity helpers ── */
  function isCountry(key) { return /^[A-Z]{3}$/.test(key); }
  function entityName(key) {
    if (key === 'WORLD') return _t('World', 'Mundo');
    if (CONT_PT[key]) return _t(key, CONT_PT[key]);
    if (isCountry(key)) { const c = _cIso[key]; return c ? (_lang() === 'en' ? c.name.common : (c.namePt || c.name.common)) : key; }
    const ct = (_cities || []).find(x => x.id === key); return ct ? ct.name : key;
  }
  function entityFlag(key) {
    if (key === 'WORLD') return '🌍';
    if (CONT_PT[key]) return { Africa:'🌍', Asia:'🌏', Europe:'🇪🇺', 'North America':'🌎', 'South America':'🌎', Oceania:'🌏' }[key] || '🗺️';
    if (isCountry(key)) { const c = _cIso[key]; return c ? c.flag : '🏳️'; }
    const ct = (_cities || []).find(x => x.id === key); return ct ? (_cIso[ct.iso3]?.flag || '🏙️') : '🏙️';
  }
  function val(indId, key) { const m = _vals[indId]; const e = m && m[key]; return e ? e.v : null; }
  function yearOf(indId, key) { const m = _vals[indId]; const e = m && m[key]; return e ? e.y : null; }

  /* countries that belong to a continent (by countries.json continents[0]) */
  function countriesOf(cont) {
    return (_countries || []).filter(c => (c.continents && c.continents.includes(cont))).map(c => c.cca3);
  }
  /* pool of entity keys for the current scope used in rankings */
  function scopePool() {
    if (_scope.level === 'continent') return countriesOf(_scope.cont).filter(k => _vals && _ind && _vals[_ind] && _vals[_ind][k] != null);
    return null; // world → all countries
  }

  function rankOf(indId, key, poolKeys) {
    const ind = _byId[indId]; if (!ind) return null;
    const m = _vals[indId]; if (!m || m[key] == null) return null;
    const keys = (poolKeys || Object.keys(m).filter(isCountry));
    const arr = keys.filter(k => m[k] != null).map(k => [k, m[k].v]);
    arr.sort((a, b) => ind.dir === -1 ? a[1] - b[1] : b[1] - a[1]);
    const idx = arr.findIndex(x => x[0] === key);
    return idx < 0 ? null : { rank: idx + 1, total: arr.length };
  }

  /* ── data loading ── */
  async function ensureBase() {
    if (_inds) return;
    const [inds, vals, countries] = await Promise.all([
      fetch(`${BASE}/indicators.json`).then(r => r.json()),
      fetch(`${BASE}/values.json`).then(r => r.json()),
      fetch('data/countries.json').then(r => r.json()),
    ]);
    _inds = inds; _vals = vals; _countries = countries;
    inds.forEach(i => _byId[i.id] = i);
    countries.forEach(c => { _cIso[c.cca3] = c; _cName[norm(c.name.common)] = c.cca3; if (c.namePt) _cName[norm(c.namePt)] = c.cca3; });
  }
  async function ensureCities() {
    if (_cities) return; try { _cities = await fetch(`${BASE}/cities.json`).then(r => r.json()); } catch { _cities = []; }
  }
  async function ensureSeries(indId) {
    if (_series[indId]) return _series[indId];
    try { _series[indId] = await fetch(`${BASE}/series/${indId}.json`).then(r => r.json()); }
    catch { _series[indId] = {}; }
    return _series[indId];
  }
  async function ensureGeo() {
    if (_geo) return;
    _geo = await fetch(`${BASE}/world-50m.geojson`).then(r => r.json());
    buildGeoPaths();
  }
  async function ensureCatalog() {
    if (_catalog && _wbCat) return;
    await Promise.all([
      _catalog ? null : fetch(`${BASE}/owid-catalog.json`).then(r => r.json()).then(d => _catalog = d).catch(() => _catalog = []),
      _wbCat ? null : fetch(`${BASE}/wb-catalog.json`).then(r => r.json()).then(d => _wbCat = d).catch(() => _wbCat = []),
    ]);
  }

  /* minimal CSV parser (handles quoted fields) — for live OWID chart CSVs */
  function parseCSV(text) {
    const rows = []; let i = 0, field = '', row = [], inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
      else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
      i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  /* "co-emissions-per-capita" → "Co emissions per capita" */
  function slugTitle(s) { const t = s.replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); }

  /* geojson name → iso3 (with a few aliases for names that differ) */
  const GEO_ALIAS = { 'the bahamas':'BHS', macedonia:'MKD', swaziland:'SWZ', 'east timor':'TLS', turkey:'TUR', 'west bank':'PSE' };
  function geoIso(name) { return _cName[norm(name)] || GEO_ALIAS[norm(name)] || null; }

  /* equirectangular projection cropped to ~ -56..84 lat (skip Antarctica) */
  const MAPW = 1000, MAPH = 500;
  const projX = lon => (lon + 180) / 360 * MAPW;
  const projY = lat => (1 - (lat + 90) / 180) * MAPH;
  function ringPath(ring) {
    let d = '';
    for (let i = 0; i < ring.length; i++) { const x = projX(ring[i][0]).toFixed(1), y = projY(ring[i][1]).toFixed(1); d += (i ? 'L' : 'M') + x + ',' + y; }
    return d + 'Z';
  }
  function buildGeoPaths() {
    _geoPaths = []; _geoBbox = {};
    for (const f of _geo.features) {
      const iso = f.properties.iso || geoIso(f.properties.name); if (!iso) continue;
      const g = f.geometry; let d = '';
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const acc = ring => { ring.forEach(pt => { const x = projX(pt[0]), y = projY(pt[1]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }); };
      if (g.type === 'Polygon') g.coordinates.forEach(r => { d += ringPath(r); acc(r); });
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => { d += ringPath(r); acc(r); }));
      if (d) { _geoPaths.push({ iso, d }); _geoBbox[iso] = { x0, y0, x1, y1 }; }
    }
  }
  /* viewBox framing the CORE of a continent. Uses country centroids with
     percentile clipping so transcontinental outliers (Russia in Europe, French
     overseas territories, etc.) don't blow the frame out to the whole world. */
  function continentViewBox(cont) {
    const lons = [], lats = [];
    countriesOf(cont).forEach(iso => { const c = _cIso[iso]; if (c && c.latlng && c.latlng.length === 2) { lats.push(c.latlng[0]); lons.push(c.latlng[1]); } });
    if (!lons.length) return '0 40 1000 430';
    lons.sort((a, b) => a - b); lats.sort((a, b) => a - b);
    const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * p)))];
    let lon0 = pct(lons, 0.08), lon1 = pct(lons, 0.92), lat0 = pct(lats, 0.08), lat1 = pct(lats, 0.92);
    if (lon1 - lon0 < 24) { const m = (lon0 + lon1) / 2; lon0 = m - 14; lon1 = m + 14; }
    if (lat1 - lat0 < 18) { const m = (lat0 + lat1) / 2; lat0 = m - 11; lat1 = m + 11; }
    let x0 = projX(lon0), x1 = projX(lon1), y0 = projY(lat1), y1 = projY(lat0);  // projY inverts
    const padX = (x1 - x0) * 0.14 + 12, padY = (y1 - y0) * 0.14 + 12;
    x0 = Math.max(0, x0 - padX); y0 = Math.max(0, y0 - padY);
    x1 = Math.min(MAPW, x1 + padX); y1 = Math.min(MAPH, y1 + padY);
    return `${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}`;
  }

  /* ── colour scales for the choropleth (discrete, quantile-binned) ──
     Neutral indicators → white→blue sequential; good/bad indicators →
     red→green diverging (flipped for "lower is better"). Quantile bins make
     differences visible even when the distribution is skewed. */
  const RAMP_SEQ = ['#e8f1fb', '#c4ddf4', '#9bc4ea', '#6ba3da', '#3f7fc4', '#225a9c', '#123a6b']; // white→blue
  const RAMP_DIV = ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#c7e89a', '#86cb66', '#3fa551', '#157a3a']; // red→green
  function makeScale(vals, dir) {
    const arr = vals.filter(v => v != null).sort((a, b) => a - b); const n = arr.length || 1;
    const base = dir === 0 ? RAMP_SEQ : RAMP_DIV;
    const ramp = dir === -1 ? base.slice().reverse() : base;
    const th = [];
    for (let i = 1; i < ramp.length; i++) th.push(arr[Math.min(n - 1, Math.floor(n * i / ramp.length))]);
    return { ramp, th, min: arr[0], max: arr[n - 1], dir };
  }
  function pickColor(v, scale) { if (v == null || !scale) return 'var(--card2)'; let i = 0; while (i < scale.th.length && v >= scale.th[i]) i++; return scale.ramp[i]; }
  function indScale(ind) {
    if (ind._scale) return ind._scale;
    const m = _vals[ind.id] || {};
    ind._scale = makeScale(Object.keys(m).filter(isCountry).map(k => m[k].v), ind.dir);
    return ind._scale;
  }
  function colorFor(ind, v) { return pickColor(v, indScale(ind)); }
  /* short value for on-map labels */
  function mapLabelVal(ind, v) {
    if (v == null) return '';
    if (ind.id === 'population' || ind.unit === '' && v > 1e6) return compact(v);
    if (ind.id === 'gdppc') return '$' + (v >= 1000 ? round(v / 1000, 0) + 'k' : round(v, 0));
    if (Math.abs(v) >= 10000) return compact(v);
    return nf(round(v, v < 10 ? (ind.dec > 1 ? 1 : ind.dec) : 0));
  }
  function legendBinned(ind, year) {
    const s = indScale(ind);
    const sw = s.ramp.map(c => `<span class="wd-lg-sw" style="background:${c}"></span>`).join('');
    const ths = s.th.map(t => `<span class="wd-lg-th">${esc(mapLabelVal(ind, t))}</span>`).join('');
    return `<div class="wd-legend2"><div class="wd-lg-row">${sw}</div><div class="wd-lg-ths">${ths}</div>${year ? `<div class="wd-lg-yr">${year}</div>` : ''}</div>`;
  }

  /* ══════════════════════ CHART HELPERS (inline SVG) ══════════════════════ */
  function lineChart(lines, opts) {
    opts = opts || {};
    const W = 640, H = 240, P = { l: 46, r: 14, t: 14, b: 24 };
    const pts = lines.flatMap(l => l.points);
    if (!pts.length) return `<div class="wd-chart-empty">${_t('No data', 'Sem dados')}</div>`;
    let minY = Math.min(...pts.map(p => p[0])), maxY = Math.max(...pts.map(p => p[0]));
    let minV = Math.min(...pts.map(p => p[1])), maxV = Math.max(...pts.map(p => p[1]));
    if (opts.zeroBase && minV > 0) minV = 0;
    if (minV === maxV) { maxV += 1; minV -= 1; }
    const x = y => P.l + (maxY === minY ? 0.5 : (y - minY) / (maxY - minY)) * (W - P.l - P.r);
    const yp = v => P.t + (1 - (v - minV) / (maxV - minV)) * (H - P.t - P.b);
    const gx = [];
    const yticks = 4;
    for (let i = 0; i <= yticks; i++) { const v = minV + (maxV - minV) * i / yticks; gx.push(`<line x1="${P.l}" y1="${yp(v).toFixed(1)}" x2="${W - P.r}" y2="${yp(v).toFixed(1)}" class="wd-grid"/><text x="${P.l - 6}" y="${(yp(v) + 3).toFixed(1)}" class="wd-axis" text-anchor="end">${shortNum(v)}</text>`); }
    const xlabels = [minY, Math.round((minY + maxY) / 2), maxY].map(yr => `<text x="${x(yr).toFixed(1)}" y="${H - 6}" class="wd-axis" text-anchor="middle">${yr}</text>`).join('');
    const paths = lines.map(l => {
      if (!l.points.length) return '';
      const d = l.points.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + yp(p[1]).toFixed(1)).join('');
      const last = l.points[l.points.length - 1];
      return `<path d="${d}" fill="none" stroke="${l.color}" stroke-width="2.4" stroke-linejoin="round"/>` +
             `<circle cx="${x(last[0]).toFixed(1)}" cy="${yp(last[1]).toFixed(1)}" r="3.2" fill="${l.color}"/>`;
    }).join('');
    const legend = lines.length > 1 ? `<div class="wd-legend">${lines.map(l => `<span class="wd-leg"><i style="background:${l.color}"></i>${esc(l.label)}</span>`).join('')}</div>` : '';
    return `<div class="wd-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(opts.label || '')}">${gx.join('')}${xlabels}${paths}</svg></div>${legend}`;
  }
  function shortNum(v) { const a = Math.abs(v); if (a >= 1e9) return round(v / 1e9, 1) + 'B'; if (a >= 1e6) return round(v / 1e6, 1) + 'M'; if (a >= 1e3) return round(v / 1e3, 0) + 'k'; return round(v, a < 10 ? 1 : 0); }
  function sparkline(points, color) {
    if (!points || points.length < 2) return '';
    const W = 120, H = 30, P = 3;
    const ys = points.map(p => p[1]); const minV = Math.min(...ys), maxV = Math.max(...ys);
    const minY = points[0][0], maxY = points[points.length - 1][0];
    const x = y => P + (y - minY) / (maxY - minY || 1) * (W - 2 * P);
    const yp = v => P + (1 - (v - minV) / (maxV - minV || 1)) * (H - 2 * P);
    const d = points.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + yp(p[1]).toFixed(1)).join('');
    return `<svg class="wd-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }
  const PALETTE = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#a855f7'];

  /* Pan/zoom a choropleth <svg> by mutating its viewBox. Drag to pan, wheel or
     the +/−/⟲ buttons to zoom. Sets svg.__moved during a real drag so the
     country click handler can ignore it. Returns control handles. */
  function enableMapZoom(svg, onChange) {
    if (!svg) return null;
    const base = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    let vb = base.slice(), _raf = 0;
    const apply = () => { svg.setAttribute('viewBox', vb.map(n => n.toFixed(1)).join(' ')); if (onChange) { cancelAnimationFrame(_raf); _raf = requestAnimationFrame(onChange); } };
    const minW = base[2] * 0.12, maxW = base[2];
    function clampPan() {
      const mx = base[2] * 0.12, my = base[3] * 0.12;
      vb[0] = Math.max(base[0] - mx, Math.min(vb[0], base[0] + base[2] - vb[2] + mx));
      vb[1] = Math.max(base[1] - my, Math.min(vb[1], base[1] + base[3] - vb[3] + my));
    }
    function zoomAt(factor, cx, cy) {
      let nw = vb[2] * factor; nw = Math.max(minW, Math.min(maxW, nw));
      const k = nw / vb[2], nh = vb[3] * k;
      vb[0] = cx - (cx - vb[0]) * k; vb[1] = cy - (cy - vb[1]) * k; vb[2] = nw; vb[3] = nh;
      clampPan(); apply();
    }
    const toUser = (clientX, clientY) => { const r = svg.getBoundingClientRect(); return [vb[0] + (clientX - r.left) / r.width * vb[2], vb[1] + (clientY - r.top) / r.height * vb[3]]; };
    svg.addEventListener('wheel', e => { e.preventDefault(); const [cx, cy] = toUser(e.clientX, e.clientY); zoomAt(e.deltaY > 0 ? 1.18 : 0.85, cx, cy); }, { passive: false });
    let drag = null;
    svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vx: vb[0], vy: vb[1] }; svg.__moved = false; try { svg.setPointerCapture(e.pointerId); } catch (_) {} svg.style.cursor = 'grabbing'; });
    svg.addEventListener('pointermove', e => { if (!drag) return; const r = svg.getBoundingClientRect(); const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) svg.__moved = true; vb[0] = drag.vx - dx / r.width * vb[2]; vb[1] = drag.vy - dy / r.height * vb[3]; clampPan(); apply(); });
    const end = () => { drag = null; svg.style.cursor = ''; setTimeout(() => { svg.__moved = false; }, 30); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    return { zoomIn: () => zoomAt(0.72, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2), zoomOut: () => zoomAt(1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2), reset: () => { vb = base.slice(); apply(); } };
  }
  const ZOOM_BTNS = `<div class="wd-map-zoom"><button data-z="in" aria-label="+">+</button><button data-z="out" aria-label="−">−</button><button data-z="reset" aria-label="⟲">⟲</button></div>`;
  function wireZoom(svg, onChange) {
    const z = enableMapZoom(svg, onChange); if (!z) return;
    const wrap = svg.closest('.wd-map-wrap'); if (!wrap) return;
    wrap.querySelectorAll('.wd-map-zoom [data-z]').forEach(b => b.onclick = () => { const a = b.dataset.z; if (a === 'in') z.zoomIn(); else if (a === 'out') z.zoomOut(); else z.reset(); });
  }

  /* labels that ADAPT to the current zoom: font-size scales with the viewBox
     width and smaller countries appear as you zoom in. svg.__labelData holds
     precomputed entries {x,y,code,val,area}; redrawn on every zoom/pan. */
  function buildLabelData(getVal, set) {
    const out = [];
    for (const p of _geoPaths) {
      if (set && !set.has(p.iso)) continue;
      const e = getVal(p.iso); if (e == null) continue;
      const c = _cIso[p.iso]; if (!c || !c.latlng) continue;
      const b = _geoBbox[p.iso];
      out.push({ x: projX(c.latlng[1]).toFixed(1), y: projY(c.latlng[0]).toFixed(1), code: esc(c.cca2), val: esc(e), area: b ? (b.x1 - b.x0) * (b.y1 - b.y0) : 0 });
    }
    return out;
  }
  function renderLabels(svg) {
    const data = svg && svg.__labelData; const g = svg && svg.querySelector('.wd-lbls'); if (!data || !g) return;
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number), vbW = vb[2];
    const fs = Math.max(1.2, Math.min(13, vbW * 0.013));
    const areaMin = vbW * vbW * 0.00060;
    const halo = (fs * 0.16).toFixed(2);
    g.innerHTML = data.filter(d => d.area >= areaMin).map(d =>
      `<text class="wd-lbl" x="${d.x}" y="${d.y}" font-size="${fs.toFixed(2)}" stroke-width="${halo}"><tspan x="${d.x}" dy="-0.05em" class="wd-lbl-c">${d.code}</tspan><tspan x="${d.x}" dy="1.05em" class="wd-lbl-v">${d.val}</tspan></text>`).join('');
  }

  /* ══════════════════════ SHELL ══════════════════════ */
  function shell() {
    return `
      <div class="wd-wrap">
        <div class="wd-top">
          <div class="wd-scopebar" id="wd-scopebar"></div>
          <div class="wd-searchbox">
            <span class="wd-search-ic">🔍</span>
            <input id="wd-search" type="search" autocomplete="off" placeholder="${_t('Search statistics, countries, cities…', 'Pesquisar estatísticas, países, cidades…')}" aria-label="${_t('Search', 'Pesquisar')}">
            <div class="wd-suggest" id="wd-suggest" hidden></div>
          </div>
        </div>
        <div class="wd-body" id="wd-body"></div>
      </div>`;
  }

  function renderScopeBar() {
    const el = _root.querySelector('#wd-scopebar'); if (!el) return;
    const lv = _scope.level;
    /* City was removed as a top level — a country's cities now live inside its
       profile (which is where "see this country's cities" belongs). */
    const seg = [['world', '🌍', _t('World', 'Mundo')], ['continent', '🗺️', _t('Continent', 'Continente')],
      ['country', '🏳️', _t('Country', 'País')]];
    const contOpts = CONTS.map(c => `<option value="${c}"${_scope.cont === c ? ' selected' : ''}>${esc(_t(c, CONT_PT[c]))}</option>`).join('');
    const countryList = (_countries || []).slice().sort((a, b) => entityNameC(a).localeCompare(entityNameC(b)));
    const countryOpts = countryList.map(c => `<option value="${c.cca3}"${_scope.country === c.cca3 ? ' selected' : ''}>${esc(entityNameC(c))}</option>`).join('');
    el.innerHTML = `
      <div class="wd-seg" role="tablist">
        ${seg.map(([id, em, lb]) => `<button class="wd-seg-b${lv === id ? ' on' : ''}" data-level="${id}">${em} <span>${lb}</span></button>`).join('')}
      </div>
      <div class="wd-pickers">
        ${lv === 'continent' ? `<select class="wd-pick" id="wd-pick-cont">${contOpts}</select>` : ''}
        ${lv === 'country' ? `<select class="wd-pick" id="wd-pick-country">${countryOpts}</select>` : ''}
      </div>`;
    el.querySelectorAll('.wd-seg-b').forEach(b => b.onclick = () => setLevel(b.dataset.level));
    const pc = el.querySelector('#wd-pick-cont'); if (pc) pc.onchange = () => { _scope.cont = pc.value; goHome(); };
    const pk = el.querySelector('#wd-pick-country'); if (pk) pk.onchange = () => { _scope.country = pk.value; _entity = pk.value; _view = 'entity'; render(); };
  }
  function entityNameC(c) { return _lang() === 'en' ? c.name.common : (c.namePt || c.name.common); }

  function setLevel(lv) {
    _scope.level = lv;
    if (lv === 'country') { _entity = _scope.country; _view = 'entity'; }
    else _view = 'home';
    render();
  }

  /* ══════════════════════ HOME / DISCOVERY ══════════════════════ */
  function goHome() { _view = 'home'; render(); }

  function homeView() {
    if (_scope.level === 'city') return cityHomeView();
    const scopeKey = _scope.level === 'continent' ? _scope.cont : 'WORLD';
    const pool = _scope.level === 'continent' ? countriesOf(_scope.cont) : null;
    return `
      ${scopeSummary(scopeKey)}
      ${spotlightBlock()}
      ${highlightsBlock(scopeKey, pool)}
      ${popularBlock()}
      ${comparisonsTeaser()}
      ${sourceFooter()}`;
  }

  /* a prominent "Portugal in detail" spotlight (the user lives there) */
  function spotlightBlock() {
    const key = 'PRT';
    const stats = ['life', 'gdppc', 'happiness', 'internet'].map(id => {
      const ind = _byId[id], v = val(id, key), r = rankOf(id, key);
      return v == null ? '' : `<div class="wd-spot-cell"><span class="wd-spot-em">${ind.emoji}</span><span class="wd-spot-v">${fmtVal(ind, v)}</span><span class="wd-spot-r">${r ? '#' + r.rank : ''}</span><span class="wd-spot-l">${esc(indName(ind))}</span></div>`;
    }).join('');
    return `<section class="wd-sec"><h3 class="wd-sec-h">🇵🇹 ${_t('Portugal in detail', 'Portugal em detalhe')}</h3>
      <button class="wd-spot" id="wd-spot-pt">
        <div class="wd-spot-grid">${stats}</div>
        <div class="wd-spot-go">${_t('Open full Portugal profile', 'Ver perfil completo de Portugal')} →</div>
      </button></section>`;
  }

  function scopeSummary(scopeKey) {
    const big = ['population', 'life', 'gdppc', 'happiness'];
    const cells = big.map(id => { const ind = _byId[id]; const v = val(id, scopeKey); const y = yearOf(id, scopeKey); return v == null ? '' :
      `<button class="wd-sum-cell" data-ind="${id}"><span class="wd-sum-em">${ind.emoji}</span><span class="wd-sum-v">${fmtVal(ind, v)}</span><span class="wd-sum-l">${esc(indName(ind))}${y ? ` <em class="wd-yr">${y}</em>` : ''}</span></button>`; }).join('');
    return `<div class="wd-hero">
        <div class="wd-hero-top"><span class="wd-hero-flag">${entityFlag(scopeKey)}</span>
          <div><div class="wd-hero-kick">${_t('Exploring', 'A explorar')}</div><h2 class="wd-hero-name">${esc(entityName(scopeKey))}</h2></div></div>
        <div class="wd-sum-grid">${cells}</div>
      </div>`;
  }

  /* discovery: notable facts + where the scope country sits */
  function highlightsBlock(scopeKey, pool) {
    const cards = [];
    const focus = _scope.level === 'continent' ? null : _scope.country;
    /* top of a few indicators within scope */
    ['life', 'gdppc', 'happiness', 'internet', 'co2'].forEach(id => {
      const ind = _byId[id]; const m = _vals[id]; if (!m) return;
      const keys = (pool || Object.keys(m).filter(isCountry)).filter(k => m[k] != null);
      if (!keys.length) return;
      keys.sort((a, b) => ind.dir === -1 ? m[a].v - m[b].v : m[b].v - m[a].v);
      const top = keys[0];
      cards.push(`<button class="wd-hl" data-ind="${id}"><div class="wd-hl-em">${ind.emoji}</div>
        <div class="wd-hl-txt"><div class="wd-hl-lead">${ind.dir === -1 ? _t('Lowest', 'Menor') : _t('Highest', 'Maior')} ${esc(indName(ind).toLowerCase())}</div>
        <div class="wd-hl-main">${entityFlag(top)} ${esc(entityName(top))}</div>
        <div class="wd-hl-sub">${fmtVal(ind, m[top].v)}</div></div></button>`);
    });
    /* where the focus country ranks */
    if (focus) {
      ['life', 'gdppc', 'happiness'].forEach(id => {
        const ind = _byId[id]; const r = rankOf(id, focus, pool); if (!r) return;
        cards.push(`<button class="wd-hl wd-hl-you" data-ind="${id}" data-entity="${focus}"><div class="wd-hl-em">${entityFlag(focus)}</div>
          <div class="wd-hl-txt"><div class="wd-hl-lead">${esc(entityName(focus))} · ${esc(indName(ind))}</div>
          <div class="wd-hl-main">#${r.rank} <span class="wd-hl-of">/ ${r.total}</span></div>
          <div class="wd-hl-sub">${fmtVal(ind, val(id, focus))}</div></div></button>`);
      });
    }
    return `<section class="wd-sec"><h3 class="wd-sec-h">✨ ${_t('Highlights & curiosities', 'Destaques e curiosidades')}</h3>
      <div class="wd-hl-row">${cards.join('')}</div></section>`;
  }

  function popularBlock() {
    const cats = {};
    _inds.forEach(i => (cats[i.cat] = cats[i.cat] || []).push(i));
    const order = ['demografia', 'saude', 'economia', 'sociedade', 'tecnologia', 'educacao', 'ambiente', 'infra'];
    const groups = order.filter(c => cats[c]).map(c => `
      <div class="wd-catgroup"><div class="wd-catlbl">${CAT_EMOJI[c] || '•'} ${esc(catName(c))}</div>
        <div class="wd-ind-grid">${cats[c].map(indCard).join('')}</div></div>`).join('');
    return `<section class="wd-sec"><h3 class="wd-sec-h">📊 ${_t('Explore indicators', 'Explorar indicadores')}</h3>${groups}</section>`;
  }
  function indCard(ind) {
    const scopeKey = _scope.level === 'continent' ? _scope.cont : 'WORLD';
    const v = val(ind.id, scopeKey);
    const y = yearOf(ind.id, scopeKey);
    return `<button class="wd-ind-card" data-ind="${ind.id}">
      <span class="wd-ind-em">${ind.emoji}</span>
      <span class="wd-ind-name">${esc(indName(ind))}</span>
      <span class="wd-ind-val">${v == null ? '' : fmtVal(ind, v)}${y ? ` <em class="wd-yr">${y}</em>` : ''}</span></button>`;
  }

  function comparisonsTeaser() {
    const sets = _scope.level === 'continent'
      ? [countriesOf(_scope.cont).slice(0, 0)] // handled below
      : [];
    const presets = [];
    if (_scope.level !== 'continent') {
      presets.push({ title: _t('Portugal vs neighbours', 'Portugal vs vizinhos'), keys: ['PRT', 'ESP', 'FRA'] });
      presets.push({ title: _t('Largest economies', 'Maiores economias'), keys: ['USA', 'CHN', 'DEU', 'JPN'] });
    } else {
      const top = countriesOf(_scope.cont).filter(k => val('gdppc', k) != null).sort((a, b) => val('gdppc', b) - val('gdppc', a)).slice(0, 4);
      presets.push({ title: _t('Top economies in ', 'Maiores economias em ') + entityName(_scope.cont), keys: top });
    }
    const cards = presets.map(p => `<button class="wd-cmp-card" data-keys="${p.keys.join(',')}">
      <div class="wd-cmp-flags">${p.keys.map(k => `<span>${entityFlag(k)}</span>`).join('')}</div>
      <div class="wd-cmp-title">${esc(p.title)}</div>
      <div class="wd-cmp-go">${_t('Compare', 'Comparar')} →</div></button>`).join('');
    return `<section class="wd-sec"><h3 class="wd-sec-h">⚖️ ${_t('Featured comparisons', 'Comparações em destaque')}</h3>
      <div class="wd-cmp-row">${cards}</div></section>`;
  }

  function sourceFooter() {
    return `<div class="wd-source">${_t('Data', 'Dados')}: Our World in Data, GeoNames (CC BY 4.0) · ${_t('latest available year', 'ano mais recente disponível')}</div>`;
  }

  /* ══════════════════════ CITY HOME ══════════════════════ */
  function cityHomeView() {
    if (!_cities) { ensureCities().then(render); return `<div class="wd-loading">…</div>`; }
    const inCountry = _scope.country;
    const list = _cities.slice().sort((a, b) => b.pop - a.pop);
    const ptList = list.filter(c => c.iso3 === inCountry);
    const top = list.slice(0, 12);
    const rows = (arr, title) => `<section class="wd-sec"><h3 class="wd-sec-h">${title}</h3>
      <div class="wd-rank">${arr.map((c, i) => cityRow(c, i + 1, arr[0].pop)).join('')}</div></section>`;
    return `<div class="wd-hero"><div class="wd-hero-top"><span class="wd-hero-flag">🏙️</span>
        <div><div class="wd-hero-kick">${_t('Exploring', 'A explorar')}</div><h2 class="wd-hero-name">${_t('Cities', 'Cidades')}</h2></div></div>
        <p class="wd-note">${_t('City data is currently limited to population (GeoNames).', 'Os dados de cidades estão por agora limitados à população (GeoNames).')}</p></div>
      ${ptList.length ? rows(ptList.slice(0, 12), '🇵🇹 ' + _t('Largest cities in ', 'Maiores cidades de ') + (_cIso[inCountry] ? entityNameC(_cIso[inCountry]) : '')) : ''}
      ${rows(top, '🌍 ' + _t('Largest cities in the world', 'Maiores cidades do mundo'))}
      ${sourceFooter()}`;
  }
  function cityRow(c, rank, maxPop) {
    const w = Math.max(3, Math.round(c.pop / maxPop * 100));
    return `<button class="wd-rank-row" data-city="${c.id}">
      <span class="wd-rank-n">${rank}</span>
      <span class="wd-rank-flag">${_cIso[c.iso3] ? _cIso[c.iso3].flag : '🏙️'}</span>
      <span class="wd-rank-name">${esc(c.name)}<small>${esc(_cIso[c.iso3] ? entityNameC(_cIso[c.iso3]) : c.cc)}</small></span>
      <span class="wd-rank-bar"><i style="width:${w}%"></i></span>
      <span class="wd-rank-val">${compact(c.pop)}</span></button>`;
  }

  /* ══════════════════════ INDICATOR VIEW ══════════════════════ */
  async function indicatorView() {
    const ind = _byId[_ind]; if (!ind) { goHome(); return; }
    const body = _root.querySelector('#wd-body');
    body.innerHTML = `<div class="wd-loading">${_t('Loading…', 'A carregar…')}</div>`;
    await Promise.all([ensureSeries(_ind), ensureGeo()]);
    /* scope: continent → that continent; country → the country's continent
       (so "país" gives a regional map with the country highlighted, not the
       whole world); world → no framing, no default highlight */
    let cont = null, focus = null;
    if (_scope.level === 'continent') cont = _scope.cont;
    else if (_scope.level === 'country') { const c = _cIso[_scope.country]; cont = c && c.continents ? c.continents[0] : null; focus = _scope.country; }
    const pool = cont ? countriesOf(cont) : null;
    /* In País scope keep it country-focused: a stat hero + trend + regional
       ranking, NOT a continent choropleth (that confused "país" with the map). */
    const countryFocus = _scope.level === 'country';
    body.innerHTML = `
      <button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button>
      <div class="wd-ind-head">
        <span class="wd-ind-head-em">${ind.emoji}</span>
        <div><h2 class="wd-ind-head-name">${esc(indName(ind))}</h2>
        <div class="wd-ind-head-meta">${esc(catName(ind.cat))} · ${ind.latestYear} · ${esc(_t('source', 'fonte'))}: OWID${cont ? ' · ' + esc(entityName(cont)) : ''}</div></div>
      </div>
      ${indDesc(ind) ? `<p class="wd-ind-desc">${esc(indDesc(ind))}</p>` : ''}
      ${countryFocus ? countryStatHero(ind, _scope.country, cont) : choroplethBlock(ind, focus, cont)}
      ${trendBlock(ind, focus)}
      ${rankingBlock(ind, pool, focus, cont)}
      ${sourceFooter()}`;
    wireIndicator(cont);
  }

  /* country-focused stat hero (used for an indicator viewed in País scope) */
  function countryStatHero(ind, key, cont) {
    const v = val(ind.id, key), y = yearOf(ind.id, key);
    const rW = rankOf(ind.id, key), rC = cont ? rankOf(ind.id, key, countriesOf(cont)) : null;
    const wv = val(ind.id, 'WORLD'); const cmp = (v != null && wv != null) ? (v >= wv ? 'up' : 'dn') : '';
    return `<div class="wd-hero">
      <div class="wd-hero-top"><span class="wd-hero-flag">${entityFlag(key)}</span>
        <div><div class="wd-hero-kick">${ind.emoji} ${esc(indName(ind))}</div>
        <h2 class="wd-hero-name">${fmtVal(ind, v)}${y ? ` <em class="wd-yr">${y}</em>` : ''}</h2></div></div>
      <div class="wd-pop-ranks" style="margin-top:.7rem">
        ${rW ? `<span class="wd-pop-rank">🌍 #${rW.rank}<small>/${rW.total}</small></span>` : ''}
        ${rC ? `<span class="wd-pop-rank">${entityFlag(cont)} #${rC.rank}<small>/${rC.total}</small></span>` : ''}
        ${cmp ? `<span class="wd-vs wd-vs-${cmp}">${cmp === 'up' ? '▲' : '▼'} ${_t('vs world', 'vs mundo')} (${fmtVal(ind, wv)})</span>` : ''}
      </div></div>`;
  }

  /* a map of one country with its cities plotted (the País landing map) */
  function countryMapBlock(iso) {
    const b = _geoBbox[iso];
    const cities = (_cities || []).filter(c => c.iso3 === iso).sort((a, b) => b.pop - a.pop);
    /* frame to the bulk of the cities (percentile-clipped) so distant islands
       — e.g. the Azores/Madeira for Portugal — don't squash the mainland */
    let vbox = '0 40 1000 430';
    if (cities.length >= 5) {
      const lons = cities.map(c => c.lon).sort((a, b) => a - b), lats = cities.map(c => c.lat).sort((a, b) => a - b);
      const pct = (a, p) => a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
      let lo0 = pct(lons, 0.05), lo1 = pct(lons, 0.95), la0 = pct(lats, 0.05), la1 = pct(lats, 0.95);
      if (lo1 - lo0 < 1.5) { const m = (lo0 + lo1) / 2; lo0 = m - 1.2; lo1 = m + 1.2; }
      if (la1 - la0 < 1.5) { const m = (la0 + la1) / 2; la0 = m - 1.2; la1 = m + 1.2; }
      let x0 = projX(lo0), x1 = projX(lo1), y0 = projY(la1), y1 = projY(la0);
      const padX = (x1 - x0) * 0.14 + 3, padY = (y1 - y0) * 0.14 + 3;
      vbox = `${(x0 - padX).toFixed(1)} ${(y0 - padY).toFixed(1)} ${(x1 - x0 + padX * 2).toFixed(1)} ${(y1 - y0 + padY * 2).toFixed(1)}`;
    } else if (b) { const padX = (b.x1 - b.x0) * 0.2 + 4, padY = (b.y1 - b.y0) * 0.2 + 4; vbox = `${(b.x0 - padX).toFixed(1)} ${(b.y0 - padY).toFixed(1)} ${(b.x1 - b.x0 + padX * 2).toFixed(1)} ${(b.y1 - b.y0 + padY * 2).toFixed(1)}`; }
    const vbW = parseFloat(vbox.split(' ')[2]) || 100;
    const paths = _geoPaths.map(p => { const me = p.iso === iso; return `<path d="${p.d}" class="wd-geo${me ? ' wd-cm-self' : ' wd-geo-out'}" fill="${me ? 'rgba(99,102,241,.20)' : 'var(--card2)'}" data-iso="${p.iso}"></path>`; }).join('');
    const maxPop = cities.length ? cities[0].pop : 1;
    const dots = cities.map(c => { const r = (vbW * (0.009 + 0.038 * Math.sqrt(c.pop / maxPop))).toFixed(2); return `<circle class="wd-cm-dot" cx="${projX(c.lon).toFixed(1)}" cy="${projY(c.lat).toFixed(1)}" r="${r}" data-city="${c.id}"><title>${esc(c.name)}: ${compact(c.pop)}</title></circle>`; }).join('');
    const fs = (vbW * 0.026).toFixed(2), halo = (vbW * 0.026 * 0.16).toFixed(2);
    const labels = cities.slice(0, 8).map(c => `<text class="wd-lbl wd-cm-lbl" x="${projX(c.lon).toFixed(1)}" y="${(projY(c.lat) - vbW * 0.02).toFixed(1)}" font-size="${fs}" stroke-width="${halo}">${esc(c.name)}</text>`).join('');
    return `<div class="wd-map-wrap wd-cm-wrap">
      <svg class="wd-map" viewBox="${vbox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(entityName(iso))}">${paths}${dots}${labels}</svg>
      ${ZOOM_BTNS}
      <div class="wd-map-tip" id="wd-map-tip" hidden></div>
    </div>`;
  }

  function choroplethBlock(ind, focus, cont) {
    const m = _vals[ind.id];
    const set = cont ? new Set(countriesOf(cont)) : null;
    const vbox = cont ? continentViewBox(cont) : '0 40 1000 430';
    const paths = _geoPaths.map(p => {
      const out = set && !set.has(p.iso);
      const v = m[p.iso] ? m[p.iso].v : null;
      const fill = out ? 'var(--card2)' : colorFor(ind, v);
      const cls = 'wd-geo' + (out ? ' wd-geo-out' : '') + (p.iso === focus ? ' wd-geo-focus' : '');
      return `<path d="${p.d}" fill="${fill}" class="${cls}" data-iso="${p.iso}" data-out="${out ? 1 : 0}"><title>${esc(entityName(p.iso))}${(m[p.iso] && !out) ? ': ' + fmtVal(ind, m[p.iso].v) : ''}</title></path>`;
    }).join('');
    return `<div class="wd-map-wrap">
      <svg class="wd-map" viewBox="${vbox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(indName(ind))}">${paths}<g class="wd-lbls"></g></svg>
      ${ZOOM_BTNS}
      ${legendBinned(ind, ind.latestYear)}
      <div class="wd-map-tip" id="wd-map-tip" hidden></div>
    </div>`;
  }

  function rankingBlock(ind, pool, focus, cont) {
    const m = _vals[ind.id];
    let keys = (pool || Object.keys(m).filter(isCountry)).filter(k => m[k] != null);
    keys.sort((a, b) => ind.dir === -1 ? m[a].v - m[b].v : m[b].v - m[a].v);
    if (_rankDir === 'bottom') keys = keys.slice().reverse();
    const maxV = Math.max(...keys.map(k => Math.abs(m[k].v))) || 1;
    const show = keys.slice(0, 20);
    const rows = show.map((k, i) => {
      const rank = _rankDir === 'top' ? i + 1 : keys.length - i;
      const w = Math.max(3, Math.round(Math.abs(m[k].v) / maxV * 100));
      return `<button class="wd-rank-row${k === focus ? ' is-focus' : ''}" data-entity="${k}">
        <span class="wd-rank-n">${rank}</span><span class="wd-rank-flag">${entityFlag(k)}</span>
        <span class="wd-rank-name">${esc(entityName(k))}</span>
        <span class="wd-rank-bar"><i style="width:${w}%"></i></span>
        <span class="wd-rank-val">${fmtVal(ind, m[k].v)}</span></button>`;
    }).join('');
    const scopeLbl = cont ? entityName(cont) : _t('the world', 'o mundo');
    return `<section class="wd-sec"><div class="wd-sec-bar"><h3 class="wd-sec-h">🏆 ${_t('Ranking', 'Ranking')} — ${esc(scopeLbl)}</h3>
        <div class="wd-toggle"><button class="${_rankDir === 'top' ? 'on' : ''}" data-rank="top">${_t('Top', 'Topo')}</button><button class="${_rankDir === 'bottom' ? 'on' : ''}" data-rank="bottom">${_t('Bottom', 'Fundo')}</button></div></div>
      <div class="wd-rank">${rows}</div></section>`;
  }

  function trendBlock(ind, focus) {
    const s = _series[ind.id] || {};
    const keys = [];
    if (focus && s[focus]) keys.push(focus);
    if (s.WORLD) keys.push('WORLD');
    if (_scope.level === 'continent' && s[_scope.cont]) keys.push(_scope.cont);
    const lines = keys.map((k, i) => ({ key: k, label: entityName(k), color: PALETTE[i % PALETTE.length], points: s[k] }));
    if (!lines.length) return '';
    return `<section class="wd-sec"><h3 class="wd-sec-h">📈 ${_t('Evolution over time', 'Evolução ao longo do tempo')}</h3>
      ${lineChart(lines, { label: indName(ind), zeroBase: ind.dir !== 0 && ind.id !== 'gdppc' })}</section>`;
  }

  /* ══════════════════════ ENTITY (country / city) PROFILE ══════════════════════ */
  async function entityView() {
    const key = _entity;
    const body = _root.querySelector('#wd-body');
    if (!isCountry(key) && key !== 'WORLD' && !CONT_PT[key]) { await ensureCities(); return cityProfile(key); }
    body.innerHTML = `<div class="wd-loading">${_t('Loading…', 'A carregar…')}</div>`;
    const c = _cIso[key];
    const cont = c && c.continents ? c.continents[0] : null;
    const pool = cont ? countriesOf(cont) : null;
    /* load sparkline series for all indicators + cities + map (parallel) */
    await Promise.all([..._inds.map(i => ensureSeries(i.id)), ensureCities(), ensureGeo()]);
    const contFlag = cont ? entityFlag(cont) : '';
    const cards = _inds.map(ind => {
      const v = val(ind.id, key), y = yearOf(ind.id, key);
      const r = rankOf(ind.id, key), rc = pool ? rankOf(ind.id, key, pool) : null;
      const s = (_series[ind.id] || {})[key];
      const wv = val(ind.id, 'WORLD');
      const cmp = (v != null && wv != null) ? (v >= wv ? '▲' : '▼') : '';
      return `<button class="wd-prof-card" data-ind="${ind.id}">
        <div class="wd-prof-top"><span class="wd-prof-em">${ind.emoji}</span><span class="wd-prof-name">${esc(indName(ind))}</span></div>
        <div class="wd-prof-val">${fmtVal(ind, v)}${y ? ` <em class="wd-yr">${y}</em>` : ''}</div>
        ${r ? `<div class="wd-prof-rank">🌍 #${r.rank}<small>/${r.total}</small>${rc ? ` · ${contFlag} #${rc.rank}<small>/${rc.total}</small>` : ''}` +
          `${cmp ? ` <span class="wd-vs wd-vs-${cmp === '▲' ? 'up' : 'dn'}">${cmp} ${_t('vs world', 'vs mundo')}</span>` : ''}</div>` : ''}
        ${sparkline(s, ind.dir === -1 ? '#ef4444' : 'var(--accent)')}</button>`;
    }).join('');
    const cityList = (_cities || []).filter(x => x.iso3 === key).sort((a, b) => b.pop - a.pop).slice(0, 15);
    const citiesSec = cityList.length ? `<section class="wd-sec"><h3 class="wd-sec-h">🏙️ ${_t('Largest cities', 'Maiores cidades')} <small class="wd-sec-sub">${_t('by population', 'por população')}</small></h3>
        <div class="wd-rank">${cityList.map((ct, i) => cityRow(ct, i + 1, cityList[0].pop)).join('')}</div></section>` : '';
    const sub = c ? `${esc(c.capital ? c.capital[0] : '')} · ${esc(_lang() === 'en' ? (c.regionPt ? c.region : c.region) : (c.regionPt || c.region))}` : '';
    body.innerHTML = `
      <button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button>
      <div class="wd-hero">
        <div class="wd-hero-top"><span class="wd-hero-flag">${entityFlag(key)}</span>
          <div><div class="wd-hero-kick">${esc(sub)}</div><h2 class="wd-hero-name">${esc(entityName(key))}</h2></div>
          <button class="wd-cmp-add" id="wd-cmp-add">⚖️ ${_t('Compare', 'Comparar')}</button>
        </div>
      </div>
      ${_geoBbox[key] ? `<section class="wd-sec"><h3 class="wd-sec-h">🗺️ ${_t('Cities', 'Cidades')}</h3>${countryMapBlock(key)}</section>` : ''}
      ${citiesSec}
      <section class="wd-sec"><h3 class="wd-sec-h">📋 ${_t('All indicators', 'Todos os indicadores')}</h3>
        <div class="wd-prof-grid">${cards}</div></section>
      ${sourceFooter()}`;
    wireEntity(key);
  }

  function cityProfile(id) {
    const body = _root.querySelector('#wd-body');
    const c = (_cities || []).find(x => x.id === id);
    if (!c) { goHome(); return; }
    const country = _cIso[c.iso3];
    const worldRank = (_cities || []).slice().sort((a, b) => b.pop - a.pop).findIndex(x => x.id === id) + 1;
    const inC = (_cities || []).filter(x => x.iso3 === c.iso3).sort((a, b) => b.pop - a.pop);
    const cRank = inC.findIndex(x => x.id === id) + 1;
    body.innerHTML = `
      <button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button>
      <div class="wd-hero"><div class="wd-hero-top"><span class="wd-hero-flag">${country ? country.flag : '🏙️'}</span>
        <div><div class="wd-hero-kick">${esc(country ? entityNameC(country) : c.cc)}</div><h2 class="wd-hero-name">${esc(c.name)}</h2></div></div>
        <div class="wd-sum-grid">
          <div class="wd-sum-cell"><span class="wd-sum-em">👥</span><span class="wd-sum-v">${compact(c.pop)}</span><span class="wd-sum-l">${_t('Population', 'População')}</span></div>
          <div class="wd-sum-cell"><span class="wd-sum-em">🌍</span><span class="wd-sum-v">#${worldRank}</span><span class="wd-sum-l">${_t('World rank', 'Posição mundial')}</span></div>
          <div class="wd-sum-cell"><span class="wd-sum-em">${country ? country.flag : '🏳️'}</span><span class="wd-sum-v">#${cRank}</span><span class="wd-sum-l">${_t('In country', 'No país')}</span></div>
          <div class="wd-sum-cell"><span class="wd-sum-em">📍</span><span class="wd-sum-v">${c.lat}, ${c.lon}</span><span class="wd-sum-l">${_t('Coordinates', 'Coordenadas')}</span></div>
        </div></div>
      ${country ? `<section class="wd-sec"><h3 class="wd-sec-h">🏳️ ${esc(entityNameC(country))} — ${_t('country profile', 'perfil do país')}</h3>
        <button class="wd-cmp-card" id="wd-city-country"><div class="wd-cmp-title">${_t('Open country', 'Abrir país')} ${country.flag} ${esc(entityNameC(country))}</div><div class="wd-cmp-go">→</div></button></section>` : ''}
      ${sourceFooter()}`;
    _root.querySelector('#wd-back').onclick = () => { _view = 'home'; render(); };
    const oc = _root.querySelector('#wd-city-country'); if (oc) oc.onclick = () => { _entity = c.iso3; _scope.level = 'country'; _scope.country = c.iso3; _view = 'entity'; render(); };
  }

  /* ══════════════════════ COMPARE ══════════════════════ */
  function compareView() {
    const body = _root.querySelector('#wd-body');
    Promise.all(_inds.map(i => ensureSeries(i.id))).then(() => {
      const keys = _compare.length ? _compare : ['PRT', 'ESP'];
      const rows = _inds.map(ind => {
        const cells = keys.map(k => `<td>${fmtVal(ind, val(ind.id, k))}</td>`).join('');
        return `<tr><th><button class="wd-cmp-indbtn" data-ind="${ind.id}">${ind.emoji} ${esc(indName(ind))}</button></th>${cells}</tr>`;
      }).join('');
      const head = keys.map((k, i) => `<th class="wd-cmp-th"><span style="color:${PALETTE[i % PALETTE.length]}">${entityFlag(k)}</span> ${esc(entityName(k))} <button class="wd-cmp-rm" data-rm="${k}">✕</button></th>`).join('');
      const chartInd = _byId['life'];
      const lines = keys.map((k, i) => ({ key: k, label: entityName(k), color: PALETTE[i % PALETTE.length], points: (_series['life'] || {})[k] || [] }));
      body.innerHTML = `
        <button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button>
        <section class="wd-sec"><h3 class="wd-sec-h">⚖️ ${_t('Comparison', 'Comparação')}</h3>
          <div class="wd-cmp-add-row"><input id="wd-cmp-search" placeholder="${_t('Add a country…', 'Adicionar país…')}" autocomplete="off"><div class="wd-suggest" id="wd-cmp-suggest" hidden></div></div>
          <div class="wd-table-wrap"><table class="wd-table"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
        </section>
        <section class="wd-sec"><h3 class="wd-sec-h">📈 ${esc(indName(chartInd))}</h3>${lineChart(lines, { label: indName(chartInd) })}</section>
        ${sourceFooter()}`;
      wireCompare();
    });
  }

  /* ══════════════════════ LIVE WEB CHART (Our World in Data / World Bank) ══════════════════════ */
  const NOWY = new Date().getFullYear();
  async function fetchOWID(slug) {
    const txt = await fetch(`https://ourworldindata.org/grapher/${slug}.csv?csvType=full&useColumnShortNames=true`).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
    const rows = parseCSV(txt); const series = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; if (row.length <= 3) continue;
      const entity = row[0], code = row[1], year = parseInt(row[2], 10), v = parseFloat(row[3]);
      if (!isFinite(v) || !isFinite(year) || year > NOWY) continue;
      const key = /^[A-Z]{3}$/.test(code) && code !== 'OWID' ? code : (SPECIALS[entity] || null);
      if (key) (series[key] = series[key] || []).push([year, v]);
    }
    return { series, updated: null };
  }
  async function fetchWB(code) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=20000&date=1970:${NOWY}`;
    const j = await fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    const series = {};
    (j[1] || []).forEach(row => {
      if (row.value == null) return;
      const iso = row.countryiso3code, year = parseInt(row.date, 10), v = +row.value;
      let key = iso === 'WLD' ? 'WORLD' : (/^[A-Z]{3}$/.test(iso) && _cIso[iso] ? iso : null);
      if (key) (series[key] = series[key] || []).push([year, v]);
    });
    return { series, updated: j[0] && j[0].lastupdated };
  }
  async function webView() {
    const web = _web || {};
    const body = _root.querySelector('#wd-body');
    const srcName = web.src === 'wb' ? 'World Bank' : 'Our World in Data';
    const link = web.src === 'wb' ? `https://data.worldbank.org/indicator/${web.id}` : `https://ourworldindata.org/grapher/${web.id}`;
    const title = web.src === 'wb' ? web.name : slugTitle(web.id);
    body.innerHTML = `<button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button><div class="wd-loading">${_t('Fetching live data from', 'A obter dados em direto de')} ${esc(srcName)}…</div>`;
    _root.querySelector('#wd-back').onclick = () => { _view = 'home'; render(); };
    let series, updated;
    try { const res = await (web.src === 'wb' ? fetchWB(web.id) : fetchOWID(web.id)); series = res.series; updated = res.updated; if (!Object.keys(series).length) throw new Error('empty'); }
    catch (e) {
      body.innerHTML = `<button class="wd-back" id="wd-backe">← ${_t('Back', 'Voltar')}</button>
        <div class="wd-loading">${_t('Could not load this chart live.', 'Não foi possível carregar este gráfico em direto.')}<br>
        <a class="wd-extlink" href="${link}" target="_blank" rel="noopener">${_t('Open on', 'Abrir em')} ${esc(srcName)} ↗</a></div>`;
      _root.querySelector('#wd-backe').onclick = () => { _view = 'home'; render(); };
      return;
    }
    await ensureGeo();
    Object.keys(series).forEach(k => series[k].sort((a, b) => a[0] - b[0]));
    const latest = {}; let latestYear = 0;
    Object.keys(series).forEach(k => { const last = series[k][series[k].length - 1]; latest[k] = { v: last[1], y: last[0] }; if (last[0] > latestYear) latestYear = last[0]; });
    const countryKeys = Object.keys(latest).filter(isCountry);
    const scale = makeScale(countryKeys.map(k => latest[k].v), 0);
    const fmt = v => v == null ? '—' : (Math.abs(v) >= 10000 ? compact(v) : nf(round(v, Math.abs(v) < 10 ? 2 : (Math.abs(v) < 1000 ? 1 : 0))));
    /* choropleth (white→blue) with labels for the larger countries */
    let mapHtml = '';
    if (countryKeys.length >= 8) {
      const paths = _geoPaths.map(p => { const e = latest[p.iso]; return `<path d="${p.d}" fill="${e ? pickColor(e.v, scale) : 'var(--card2)'}" class="wd-geo" data-iso="${p.iso}"><title>${esc(entityName(p.iso))}${e ? ': ' + fmt(e.v) : ''}</title></path>`; }).join('');
      const sw = scale.ramp.map(c => `<span class="wd-lg-sw" style="background:${c}"></span>`).join('');
      const ths = scale.th.map(t => `<span class="wd-lg-th">${esc(fmt(t))}</span>`).join('');
      mapHtml = `<div class="wd-map-wrap"><svg class="wd-map" viewBox="0 40 1000 430" preserveAspectRatio="xMidYMid meet">${paths}<g class="wd-lbls"></g></svg>
        ${ZOOM_BTNS}
        <div class="wd-legend2"><div class="wd-lg-row">${sw}</div><div class="wd-lg-ths">${ths}</div>${latestYear ? `<div class="wd-lg-yr">${latestYear}</div>` : ''}</div>
        <div class="wd-map-tip" id="wd-map-tip" hidden></div></div>`;
    }
    let rankHtml = '';
    if (countryKeys.length) {
      const ks = countryKeys.slice().sort((a, b) => latest[b].v - latest[a].v).slice(0, 15);
      const mx = Math.max(...ks.map(k => Math.abs(latest[k].v))) || 1;
      rankHtml = `<section class="wd-sec"><h3 class="wd-sec-h">🏆 ${_t('Ranking', 'Ranking')}</h3><div class="wd-rank">${ks.map((k, i) =>
        `<div class="wd-rank-row${k === 'PRT' ? ' is-focus' : ''}"><span class="wd-rank-n">${i + 1}</span><span class="wd-rank-flag">${entityFlag(k)}</span><span class="wd-rank-name">${esc(entityName(k))}</span><span class="wd-rank-bar"><i style="width:${Math.max(3, Math.round(Math.abs(latest[k].v) / mx * 100))}%"></i></span><span class="wd-rank-val">${fmt(latest[k].v)}</span></div>`).join('')}</div></section>`;
    }
    const lineKeys = [];
    if (series.WORLD) lineKeys.push('WORLD');
    if (series.PRT) lineKeys.push('PRT');
    countryKeys.slice().sort((a, b) => latest[b].v - latest[a].v).slice(0, 2).forEach(k => { if (!lineKeys.includes(k)) lineKeys.push(k); });
    if (!lineKeys.length) Object.keys(series).slice(0, 3).forEach(k => lineKeys.push(k));
    const lines = lineKeys.map((k, i) => ({ key: k, label: entityName(k), color: PALETTE[i % PALETTE.length], points: series[k] }));
    body.innerHTML = `
      <button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button>
      <div class="wd-ind-head"><span class="wd-ind-head-em">🌐</span>
        <div><h2 class="wd-ind-head-name">${esc(title)}</h2>
        <div class="wd-ind-head-meta">${_t('Live', 'Em direto')} · ${esc(srcName)}${latestYear ? ' · ' + latestYear : ''}${updated ? ' · ' + _t('updated', 'atual.') + ' ' + esc(updated) : ''}</div></div></div>
      ${mapHtml}
      ${lines.length ? `<section class="wd-sec"><h3 class="wd-sec-h">📈 ${_t('Evolution over time', 'Evolução ao longo do tempo')}</h3>${lineChart(lines, { label: title })}</section>` : ''}
      ${rankHtml}
      <a class="wd-extlink" href="${link}" target="_blank" rel="noopener">${_t('View original on', 'Ver original em')} ${esc(srcName)} ↗</a>
      <div class="wd-source">${_t('Data fetched live', 'Dados obtidos em direto')} · ${esc(srcName)} (CC BY 4.0)</div>`;
    _root.querySelector('#wd-back').onclick = () => { _view = 'home'; render(); };
    const svg = _root.querySelector('.wd-map');
    if (svg) { svg.__labelData = buildLabelData(iso => (latest[iso] ? fmt(latest[iso].v) : null), null); wireZoom(svg, () => renderLabels(svg)); renderLabels(svg); }
    const tip = _root.querySelector('#wd-map-tip');
    if (tip) _root.querySelectorAll('.wd-geo').forEach(p => {
      p.addEventListener('mousemove', e => { const iso = p.dataset.iso, ee = latest[iso]; tip.innerHTML = `${entityFlag(iso)} ${esc(entityName(iso))}<b>${ee ? ' ' + fmt(ee.v) : ' —'}</b>`; const r = _root.querySelector('.wd-map-wrap').getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; tip.hidden = false; });
      p.addEventListener('mouseleave', () => { tip.hidden = true; });
      p.addEventListener('click', () => { if (svg && svg.__moved) return; if (latest[p.dataset.iso] && _cIso[p.dataset.iso]) { _entity = p.dataset.iso; _scope.level = 'country'; _scope.country = p.dataset.iso; _view = 'entity'; render(); } });
    });
  }

  /* ══════════════════════ SEARCH ══════════════════════ */
  function buildSearchIndex(q) {
    const out = [];
    _inds.forEach(i => { if (norm(indName(i)).includes(q)) out.push({ type: 'ind', id: i.id, label: indName(i), em: i.emoji, sub: catName(i.cat) }); });
    (_countries || []).forEach(c => { if (norm(entityNameC(c)).includes(q)) out.push({ type: 'country', id: c.cca3, label: entityNameC(c), em: c.flag, sub: _t('Country', 'País') }); });
    CONTS.forEach(c => { if (norm(_t(c, CONT_PT[c])).includes(q)) out.push({ type: 'cont', id: c, label: _t(c, CONT_PT[c]), em: '🗺️', sub: _t('Continent', 'Continente') }); });
    if (_cities) (_cities).forEach(c => { if (norm(c.name).includes(q)) out.push({ type: 'city', id: c.id, label: c.name, em: '🏙️', sub: (_cIso[c.iso3] ? entityNameC(_cIso[c.iso3]) : c.cc) }); });
    return out.slice(0, 8);
  }
  /* live catalogue search across Our World in Data (~4.5k charts) */
  function buildWebIndex(q) {
    if (!_catalog) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const hits = [];
    for (const slug of _catalog) {
      const n = slug.replace(/-/g, ' ');
      if (terms.every(t => n.includes(t))) { hits.push(slug); if (hits.length >= 40) break; }
    }
    hits.sort((a, b) => a.length - b.length);
    return hits.slice(0, 6).map(slug => ({ type: 'web', id: slug, label: slugTitle(slug), em: '🌐', sub: 'Our World in Data' }));
  }
  /* live catalogue search across World Bank WDI indicators (~1.5k) */
  function buildWBIndex(q) {
    if (!_wbCat) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const hits = [];
    for (const [code, name] of _wbCat) {
      const n = norm(name);
      if (terms.every(t => n.includes(t))) { hits.push([code, name]); if (hits.length >= 40) break; }
    }
    hits.sort((a, b) => a[1].length - b[1].length);
    return hits.slice(0, 6).map(([code, name]) => ({ type: 'wb', id: code, label: name, em: '🏦', sub: 'World Bank' }));
  }
  function wireSearch() {
    const inp = _root.querySelector('#wd-search'), box = _root.querySelector('#wd-suggest');
    if (!inp) return;
    const close = () => { box.hidden = true; box.innerHTML = ''; };
    inp.addEventListener('input', () => {
      clearTimeout(_searchT);
      _searchT = setTimeout(async () => {
        const q = norm(inp.value.trim());
        if (q.length < 2) return close();
        if (!_cities) await ensureCities();
        if (!_catalog) await ensureCatalog();
        const res = buildSearchIndex(q);
        const web = buildWebIndex(q);
        const wb = buildWBIndex(q);
        const sug = r => `<button class="wd-sug" data-type="${r.type}" data-id="${esc(r.id)}" data-name="${esc(r.label)}"><span class="wd-sug-em">${r.em}</span><span class="wd-sug-l">${esc(r.label)}</span><span class="wd-sug-sub">${esc(r.sub)}</span></button>`;
        let html = '';
        if (res.length) html += `<div class="wd-sug-head">${_t('On this site', 'Neste site')}</div>` + res.map(sug).join('');
        if (web.length) html += `<div class="wd-sug-head">🌐 ${_t('Live · Our World in Data', 'Em direto · Our World in Data')}</div>` + web.map(sug).join('');
        if (wb.length) html += `<div class="wd-sug-head">🏦 ${_t('Live · World Bank', 'Em direto · World Bank')}</div>` + wb.map(sug).join('');
        if (!html) html = `<div class="wd-sug-empty">${_t('No matches', 'Sem resultados')}</div>`;
        box.innerHTML = html; box.hidden = false;
        box.querySelectorAll('.wd-sug').forEach(b => b.onclick = () => { pickSearch(b.dataset.type, b.dataset.id, b.dataset.name); inp.value = ''; close(); });
      }, 160);
    });
    inp.addEventListener('blur', () => setTimeout(close, 180));
  }
  function pickSearch(type, id, name) {
    if (type === 'ind') { _ind = id; _view = 'indicator'; }
    else if (type === 'country') { _entity = id; _scope.level = 'country'; _scope.country = id; _view = 'entity'; }
    else if (type === 'cont') { _scope.level = 'continent'; _scope.cont = id; _view = 'home'; }
    else if (type === 'city') { _entity = id; _view = 'entity'; }
    else if (type === 'web') { _web = { src: 'owid', id }; _view = 'web'; }
    else if (type === 'wb') { _web = { src: 'wb', id, name }; _view = 'web'; }
    render();
  }

  /* ══════════════════════ WIRING ══════════════════════ */
  function wireHome() {
    _root.querySelectorAll('[data-ind]').forEach(b => b.onclick = () => { _ind = b.dataset.ind; _view = 'indicator'; render(); });
    _root.querySelectorAll('.wd-hl[data-entity]').forEach(b => b.onclick = () => { _ind = b.dataset.ind; _view = 'indicator'; render(); });
    _root.querySelectorAll('.wd-cmp-card[data-keys]').forEach(b => b.onclick = () => { _compare = b.dataset.keys.split(','); _view = 'compare'; render(); });
    _root.querySelectorAll('.wd-rank-row[data-city]').forEach(b => b.onclick = () => { _entity = b.dataset.city; _view = 'entity'; render(); });
    const spt = _root.querySelector('#wd-spot-pt'); if (spt) spt.onclick = () => { _entity = 'PRT'; _scope.level = 'country'; _scope.country = 'PRT'; _view = 'entity'; render(); };
  }
  function wireIndicator(cont) {
    _root.querySelector('#wd-back').onclick = () => { _view = (_scope.level === 'country') ? 'entity' : 'home'; render(); };
    _root.querySelectorAll('.wd-rank-row[data-entity]').forEach(b => b.onclick = () => { _entity = b.dataset.entity; _scope.level = isCountry(b.dataset.entity) ? 'country' : _scope.level; if (isCountry(b.dataset.entity)) _scope.country = b.dataset.entity; _view = 'entity'; render(); });
    _root.querySelectorAll('.wd-toggle [data-rank]').forEach(b => b.onclick = () => { _rankDir = b.dataset.rank; indicatorView(); });
    /* map: pan/zoom + adaptive labels + hover tip + click → popup */
    const ind = _byId[_ind], m = _vals[_ind];
    const svg = _root.querySelector('.wd-map');
    if (svg) { svg.__labelData = buildLabelData(iso => (m[iso] ? mapLabelVal(ind, m[iso].v) : null), cont ? new Set(countriesOf(cont)) : null); wireZoom(svg, () => renderLabels(svg)); renderLabels(svg); }
    const tip = _root.querySelector('#wd-map-tip');
    _root.querySelectorAll('.wd-geo').forEach(p => {
      p.addEventListener('mousemove', e => { const iso = p.dataset.iso; const v = m[iso] ? m[iso].v : null;
        tip.innerHTML = `${entityFlag(iso)} ${esc(entityName(iso))}<b>${v == null ? ' —' : ' ' + fmtVal(ind, v)}</b>`;
        const r = _root.querySelector('.wd-map-wrap').getBoundingClientRect();
        tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; tip.hidden = false; });
      p.addEventListener('mouseleave', () => { tip.hidden = true; });
      p.addEventListener('click', () => { if (svg && svg.__moved) return; if (m[p.dataset.iso]) showStatPopup(p.dataset.iso, ind, cont); });
    });
  }

  /* popup with the statistic detail for one country (opened from the map) */
  function showStatPopup(iso, ind, cont) {
    closePopup();
    const v = val(ind.id, iso), y = yearOf(ind.id, iso);
    const rW = rankOf(ind.id, iso), rC = cont ? rankOf(ind.id, iso, countriesOf(cont)) : null;
    const wv = val(ind.id, 'WORLD');
    const cmp = (v != null && wv != null) ? (v >= wv ? 'up' : 'dn') : '';
    const s = (_series[ind.id] || {})[iso];
    const ov = document.createElement('div');
    ov.className = 'wd-pop-ov'; ov.id = 'wd-pop';
    ov.innerHTML = `<div class="wd-pop" role="dialog" aria-modal="true">
      <button class="wd-pop-x" aria-label="${_t('Close', 'Fechar')}">✕</button>
      <div class="wd-pop-head"><span class="wd-pop-flag">${entityFlag(iso)}</span>
        <div><div class="wd-pop-name">${esc(entityName(iso))}</div><div class="wd-pop-ind">${ind.emoji} ${esc(indName(ind))}</div></div></div>
      ${indDesc(ind) ? `<p class="wd-pop-desc">${esc(indDesc(ind))}</p>` : ''}
      <div class="wd-pop-val">${fmtVal(ind, v)}${y ? ` <em class="wd-yr">${y}</em>` : ''}</div>
      <div class="wd-pop-ranks">
        ${rW ? `<span class="wd-pop-rank">🌍 #${rW.rank}<small>/${rW.total}</small></span>` : ''}
        ${rC ? `<span class="wd-pop-rank">${entityFlag(cont)} #${rC.rank}<small>/${rC.total}</small></span>` : ''}
        ${cmp ? `<span class="wd-vs wd-vs-${cmp}">${cmp === 'up' ? '▲' : '▼'} ${_t('vs world', 'vs mundo')}</span>` : ''}
      </div>
      ${s ? `<div class="wd-pop-spark">${sparkline(s, ind.dir === -1 ? '#ef4444' : 'var(--accent)')}</div>` : ''}
      <div class="wd-pop-acts">
        <button class="wd-pop-btn" data-act="profile">${_t('Full profile', 'Perfil completo')} →</button>
        <button class="wd-pop-btn wd-pop-btn-ghost" data-act="compare">⚖️ ${_t('Compare', 'Comparar')}</button>
      </div></div>`;
    _root.appendChild(ov);
    const close = () => closePopup();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.wd-pop-x').onclick = close;
    ov.querySelector('[data-act="profile"]').onclick = () => { closePopup(); _entity = iso; _scope.level = 'country'; _scope.country = iso; _view = 'entity'; render(); };
    ov.querySelector('[data-act="compare"]').onclick = () => { closePopup(); _compare = [iso]; _view = 'compare'; render(); };
  }
  function closePopup() { const p = _root && _root.querySelector('#wd-pop'); if (p) p.remove(); }
  function wireEntity(key) {
    _root.querySelector('#wd-back').onclick = () => { _view = 'home'; render(); };
    _root.querySelectorAll('.wd-prof-card[data-ind]').forEach(b => b.onclick = () => { _ind = b.dataset.ind; _view = 'indicator'; render(); });
    _root.querySelectorAll('.wd-rank-row[data-city]').forEach(b => b.onclick = () => { _entity = b.dataset.city; _view = 'entity'; render(); });
    const add = _root.querySelector('#wd-cmp-add'); if (add) add.onclick = () => { _compare = [key]; _view = 'compare'; render(); };
    /* country map: pan/zoom + city markers */
    const svg = _root.querySelector('.wd-map'); if (svg) wireZoom(svg);
    const tip = _root.querySelector('#wd-map-tip');
    _root.querySelectorAll('.wd-cm-dot').forEach(d => {
      if (tip) { d.addEventListener('mousemove', e => { const ct = (_cities || []).find(x => x.id === d.dataset.city); if (!ct) return; tip.innerHTML = `🏙️ ${esc(ct.name)}<b> ${compact(ct.pop)}</b>`; const r = _root.querySelector('.wd-map-wrap').getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; tip.hidden = false; }); d.addEventListener('mouseleave', () => { tip.hidden = true; }); }
      d.addEventListener('click', () => { if (svg && svg.__moved) return; _entity = d.dataset.city; _view = 'entity'; render(); });
    });
  }
  function wireCompare() {
    _root.querySelector('#wd-back').onclick = () => { _view = (_scope.level === 'country') ? 'entity' : 'home'; render(); };
    _root.querySelectorAll('.wd-cmp-rm').forEach(b => b.onclick = () => { _compare = _compare.filter(k => k !== b.dataset.rm); compareView(); });
    _root.querySelectorAll('.wd-cmp-indbtn').forEach(b => b.onclick = () => { _ind = b.dataset.ind; _view = 'indicator'; render(); });
    const inp = _root.querySelector('#wd-cmp-search'), box = _root.querySelector('#wd-cmp-suggest');
    if (inp) inp.addEventListener('input', () => { clearTimeout(_searchT); _searchT = setTimeout(() => {
      const q = norm(inp.value.trim()); if (q.length < 2) { box.hidden = true; return; }
      const res = (_countries || []).filter(c => norm(entityNameC(c)).includes(q)).slice(0, 8);
      box.innerHTML = res.map(c => `<button class="wd-sug" data-id="${c.cca3}"><span class="wd-sug-em">${c.flag}</span><span class="wd-sug-l">${esc(entityNameC(c))}</span></button>`).join('');
      box.hidden = !res.length;
      box.querySelectorAll('.wd-sug').forEach(b => b.onclick = () => { if (!_compare.includes(b.dataset.id) && _compare.length < 5) _compare.push(b.dataset.id); inp.value = ''; box.hidden = true; compareView(); });
    }, 140); });
  }

  /* ══════════════════════ RENDER ══════════════════════ */
  function render() {
    if (!_root) return;
    renderScopeBar();
    const body = _root.querySelector('#wd-body');
    if (_view === 'indicator') { indicatorView(); return; }
    if (_view === 'entity') { entityView(); return; }
    if (_view === 'compare') { compareView(); return; }
    if (_view === 'web') { webView(); return; }
    body.innerHTML = homeView();
    wireHome();
  }

  /* ══════════════════════ LIFECYCLE ══════════════════════ */
  async function mount(sub) {
    _root = sub;
    sub.innerHTML = `<div class="wd-loading">${_t('Loading world data…', 'A carregar dados do mundo…')}</div>`;
    try { await ensureBase(); } catch (e) { sub.innerHTML = `<div class="wd-loading">${_t('Failed to load data.', 'Falha ao carregar os dados.')}</div>`; return; }
    sub.innerHTML = shell();
    _mounted = true;
    wireSearch();
    render();
  }
  function resume() { /* state preserved in DOM; nothing heavy to restart */ }
  function stop() { const b = _root && _root.querySelector('#wd-suggest'); if (b) b.hidden = true; }

  return { mount, resume, stop };
})();
