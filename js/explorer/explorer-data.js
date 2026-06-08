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
  let _cities = null, _geo = null, _geoPaths = null;
  const _series = {};                               // indId -> {key:[[y,v]]}

  /* view + scope state */
  let _view = 'home';                               // home | indicator | entity | compare
  let _ind = null, _entity = null;
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
    _geo = await fetch('data/world-countries.geojson').then(r => r.json());
    buildGeoPaths();
  }

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
    _geoPaths = [];
    for (const f of _geo.features) {
      const iso = geoIso(f.properties.name); if (!iso) continue;
      const g = f.geometry; let d = '';
      if (g.type === 'Polygon') g.coordinates.forEach(r => d += ringPath(r));
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => d += ringPath(r)));
      if (d) _geoPaths.push({ iso, d });
    }
  }

  /* ── colour scale for the choropleth ── */
  const LOG_INDS = { population:1, gdppc:1, density:1, doctors:0 };
  function colorFor(ind, v) {
    if (v == null) return 'var(--card2)';
    let lo = ind.min, hi = ind.max, t;
    if (LOG_INDS[ind.id]) { lo = Math.log10(Math.max(lo, 1)); hi = Math.log10(Math.max(hi, 1)); t = (Math.log10(Math.max(v, 1)) - lo) / (hi - lo); }
    else t = (v - lo) / (hi - lo);
    t = Math.max(0, Math.min(1, t));
    if (ind.dir === -1) t = 1 - t;                  // lower is better → flip so green=good
    /* ramp: red(0) → amber → green(1) for good/bad; neutral uses blue ramp */
    if (ind.dir === 0) { const h = 205, l = 88 - t * 56; return `hsl(${h} 70% ${l}%)`; }
    const h = t * 130;                              // 0 red → 130 green
    return `hsl(${h} 65% ${46 + (1 - Math.abs(t - .5) * 2) * 6}%)`;
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
    const seg = [['world', '🌍', _t('World', 'Mundo')], ['continent', '🗺️', _t('Continent', 'Continente')],
      ['country', '🏳️', _t('Country', 'País')], ['city', '🏙️', _t('City', 'Cidade')]];
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
        ${lv === 'city' ? `<select class="wd-pick" id="wd-pick-city"></select>` : ''}
      </div>`;
    el.querySelectorAll('.wd-seg-b').forEach(b => b.onclick = () => setLevel(b.dataset.level));
    const pc = el.querySelector('#wd-pick-cont'); if (pc) pc.onchange = () => { _scope.cont = pc.value; goHome(); };
    const pk = el.querySelector('#wd-pick-country'); if (pk) pk.onchange = () => { _scope.country = pk.value; _entity = pk.value; _view = 'entity'; render(); };
    const pcity = el.querySelector('#wd-pick-city');
    if (pcity) { fillCityPicker(pcity); pcity.onchange = () => { _scope.city = pcity.value; _entity = pcity.value; _view = 'entity'; render(); }; }
  }
  function entityNameC(c) { return _lang() === 'en' ? c.name.common : (c.namePt || c.name.common); }
  async function fillCityPicker(sel) {
    await ensureCities();
    const list = _cities.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!_scope.city) { const lei = _cities.find(c => /leiria/i.test(c.name) && c.cc === 'PT'); _scope.city = lei ? lei.id : _cities[0].id; }
    sel.innerHTML = list.map(c => `<option value="${c.id}"${_scope.city === c.id ? ' selected' : ''}>${esc(c.name)} (${c.cc})</option>`).join('');
  }

  function setLevel(lv) {
    _scope.level = lv;
    if (lv === 'world') { _view = 'home'; }
    else if (lv === 'continent') { _view = 'home'; }
    else if (lv === 'country') { _entity = _scope.country; _view = 'entity'; }
    else if (lv === 'city') { _view = 'home'; ensureCities().then(() => { if (!_scope.city && _cities[0]) _scope.city = _cities[0].id; render(); }); }
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
      ${highlightsBlock(scopeKey, pool)}
      ${popularBlock()}
      ${comparisonsTeaser()}
      ${sourceFooter()}`;
  }

  function scopeSummary(scopeKey) {
    const big = ['population', 'life', 'gdppc', 'happiness'];
    const cells = big.map(id => { const ind = _byId[id]; const v = val(id, scopeKey); return v == null ? '' :
      `<button class="wd-sum-cell" data-ind="${id}"><span class="wd-sum-em">${ind.emoji}</span><span class="wd-sum-v">${fmtVal(ind, v)}</span><span class="wd-sum-l">${esc(indName(ind))}</span></button>`; }).join('');
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
    return `<button class="wd-ind-card" data-ind="${ind.id}">
      <span class="wd-ind-em">${ind.emoji}</span>
      <span class="wd-ind-name">${esc(indName(ind))}</span>
      <span class="wd-ind-val">${v == null ? '' : fmtVal(ind, v)}</span></button>`;
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
    const pool = scopePool();
    const m = _vals[_ind];
    const focus = _scope.level === 'continent' ? null : (_scope.level === 'country' ? _scope.country : 'PRT');
    body.innerHTML = `
      <button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button>
      <div class="wd-ind-head">
        <span class="wd-ind-head-em">${ind.emoji}</span>
        <div><h2 class="wd-ind-head-name">${esc(indName(ind))}</h2>
        <div class="wd-ind-head-meta">${esc(catName(ind.cat))} · ${ind.latestYear} · ${esc(_t('source', 'fonte'))}: OWID</div></div>
      </div>
      ${choroplethBlock(ind)}
      ${rankingBlock(ind, pool, focus)}
      ${trendBlock(ind, focus)}
      ${sourceFooter()}`;
    wireIndicator();
  }

  function choroplethBlock(ind) {
    const m = _vals[ind.id];
    const paths = _geoPaths.map(p => {
      const v = m[p.iso] ? m[p.iso].v : null;
      return `<path d="${p.d}" fill="${colorFor(ind, v)}" class="wd-geo" data-iso="${p.iso}"><title>${esc(entityName(p.iso))}${v == null ? '' : ': ' + fmtVal(ind, v)}</title></path>`;
    }).join('');
    const loLabel = ind.dir === -1 ? _t('high', 'alto') : _t('low', 'baixo');
    const hiLabel = ind.dir === -1 ? _t('low', 'baixo') : _t('high', 'alto');
    return `<div class="wd-map-wrap">
      <svg class="wd-map" viewBox="0 40 1000 430" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(indName(ind))}">${paths}</svg>
      <div class="wd-map-legend"><span>${esc(loLabel)}</span><i class="wd-legend-ramp wd-legend-${ind.dir}"></i><span>${esc(hiLabel)}</span></div>
      <div class="wd-map-tip" id="wd-map-tip" hidden></div>
    </div>`;
  }

  function rankingBlock(ind, pool, focus) {
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
    const scopeLbl = pool ? entityName(_scope.cont) : _t('the world', 'o mundo');
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
    /* load sparkline series for all indicators (small, parallel) */
    await Promise.all(_inds.map(i => ensureSeries(i.id)));
    const cards = _inds.map(ind => {
      const v = val(ind.id, key); const r = rankOf(ind.id, key);
      const s = (_series[ind.id] || {})[key];
      return `<button class="wd-prof-card" data-ind="${ind.id}">
        <div class="wd-prof-top"><span class="wd-prof-em">${ind.emoji}</span><span class="wd-prof-name">${esc(indName(ind))}</span></div>
        <div class="wd-prof-val">${fmtVal(ind, v)}</div>
        ${r ? `<div class="wd-prof-rank">#${r.rank} <small>/ ${r.total} ${_t('worldwide', 'no mundo')}</small></div>` : ''}
        ${sparkline(s, ind.dir === -1 ? '#ef4444' : 'var(--accent)')}</button>`;
    }).join('');
    const sub = c ? `${esc(c.capital ? c.capital[0] : '')} · ${esc(_lang() === 'en' ? (c.regionPt ? c.region : c.region) : (c.regionPt || c.region))}` : '';
    body.innerHTML = `
      <button class="wd-back" id="wd-back">← ${_t('Back', 'Voltar')}</button>
      <div class="wd-hero">
        <div class="wd-hero-top"><span class="wd-hero-flag">${entityFlag(key)}</span>
          <div><div class="wd-hero-kick">${esc(sub)}</div><h2 class="wd-hero-name">${esc(entityName(key))}</h2></div>
          <button class="wd-cmp-add" id="wd-cmp-add">⚖️ ${_t('Compare', 'Comparar')}</button>
        </div>
      </div>
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

  /* ══════════════════════ SEARCH ══════════════════════ */
  function buildSearchIndex(q) {
    const out = [];
    _inds.forEach(i => { if (norm(indName(i)).includes(q)) out.push({ type: 'ind', id: i.id, label: indName(i), em: i.emoji, sub: catName(i.cat) }); });
    (_countries || []).forEach(c => { if (norm(entityNameC(c)).includes(q)) out.push({ type: 'country', id: c.cca3, label: entityNameC(c), em: c.flag, sub: _t('Country', 'País') }); });
    CONTS.forEach(c => { if (norm(_t(c, CONT_PT[c])).includes(q)) out.push({ type: 'cont', id: c, label: _t(c, CONT_PT[c]), em: '🗺️', sub: _t('Continent', 'Continente') }); });
    if (_cities) (_cities).forEach(c => { if (norm(c.name).includes(q)) out.push({ type: 'city', id: c.id, label: c.name, em: '🏙️', sub: (_cIso[c.iso3] ? entityNameC(_cIso[c.iso3]) : c.cc) }); });
    return out.slice(0, 10);
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
        const res = buildSearchIndex(q);
        if (!res.length) { box.innerHTML = `<div class="wd-sug-empty">${_t('No matches', 'Sem resultados')}</div>`; box.hidden = false; return; }
        box.innerHTML = res.map(r => `<button class="wd-sug" data-type="${r.type}" data-id="${r.id}"><span class="wd-sug-em">${r.em}</span><span class="wd-sug-l">${esc(r.label)}</span><span class="wd-sug-sub">${esc(r.sub)}</span></button>`).join('');
        box.hidden = false;
        box.querySelectorAll('.wd-sug').forEach(b => b.onclick = () => { pickSearch(b.dataset.type, b.dataset.id); inp.value = ''; close(); });
      }, 140);
    });
    inp.addEventListener('blur', () => setTimeout(close, 180));
  }
  function pickSearch(type, id) {
    if (type === 'ind') { _ind = id; _view = 'indicator'; }
    else if (type === 'country') { _entity = id; _scope.level = 'country'; _scope.country = id; _view = 'entity'; }
    else if (type === 'cont') { _scope.level = 'continent'; _scope.cont = id; _view = 'home'; }
    else if (type === 'city') { _scope.level = 'city'; _scope.city = id; _entity = id; _view = 'entity'; }
    render();
  }

  /* ══════════════════════ WIRING ══════════════════════ */
  function wireHome() {
    _root.querySelectorAll('[data-ind]').forEach(b => b.onclick = () => { _ind = b.dataset.ind; _view = 'indicator'; render(); });
    _root.querySelectorAll('.wd-hl[data-entity]').forEach(b => b.onclick = () => { _ind = b.dataset.ind; _view = 'indicator'; render(); });
    _root.querySelectorAll('.wd-cmp-card[data-keys]').forEach(b => b.onclick = () => { _compare = b.dataset.keys.split(','); _view = 'compare'; render(); });
    _root.querySelectorAll('.wd-rank-row[data-city]').forEach(b => b.onclick = () => { _entity = b.dataset.city; _view = 'entity'; render(); });
  }
  function wireIndicator() {
    _root.querySelector('#wd-back').onclick = () => { _view = (_scope.level === 'country') ? 'entity' : 'home'; render(); };
    _root.querySelectorAll('.wd-rank-row[data-entity]').forEach(b => b.onclick = () => { _entity = b.dataset.entity; _scope.level = isCountry(b.dataset.entity) ? 'country' : _scope.level; if (isCountry(b.dataset.entity)) _scope.country = b.dataset.entity; _view = 'entity'; render(); });
    _root.querySelectorAll('.wd-toggle [data-rank]').forEach(b => b.onclick = () => { _rankDir = b.dataset.rank; indicatorView(); });
    /* map: hover tip + click to focus a country */
    const tip = _root.querySelector('#wd-map-tip'), ind = _byId[_ind], m = _vals[_ind];
    _root.querySelectorAll('.wd-geo').forEach(p => {
      p.addEventListener('mousemove', e => { const iso = p.dataset.iso; const v = m[iso] ? m[iso].v : null;
        tip.innerHTML = `${entityFlag(iso)} ${esc(entityName(iso))}<b>${v == null ? ' —' : ' ' + fmtVal(ind, v)}</b>`;
        const r = _root.querySelector('.wd-map-wrap').getBoundingClientRect();
        tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; tip.hidden = false; });
      p.addEventListener('mouseleave', () => { tip.hidden = true; });
      p.addEventListener('click', () => { const iso = p.dataset.iso; _entity = iso; _scope.level = 'country'; _scope.country = iso; _view = 'entity'; render(); });
    });
  }
  function wireEntity(key) {
    _root.querySelector('#wd-back').onclick = () => { _view = 'home'; render(); };
    _root.querySelectorAll('.wd-prof-card[data-ind]').forEach(b => b.onclick = () => { _ind = b.dataset.ind; _view = 'indicator'; render(); });
    const add = _root.querySelector('#wd-cmp-add'); if (add) add.onclick = () => { _compare = [key]; _view = 'compare'; render(); };
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
