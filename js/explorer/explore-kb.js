/* ══════════════════════════════════════════════════════════════════
   EXPLORE — KNOWLEDGE BASE
   Área → Tema → Subtema → Conteúdo, with 3 cumulative tiers
   (Destaques · Explorar · Aprofundar), breadcrumbs, favourites, history,
   global search, tag filters, related content and daily discovery.
   Data: data/explore/index.json (taxonomy) + data/explore/<theme>.json
   (one file per theme, lazy-loaded). No backend, offline-first.
   ══════════════════════════════════════════════════════════════════ */
const ExploreKB = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const TIERS = [
    { id: 'destaque', en: 'Highlights', pt: 'Destaques', ic: '✨', rank: 1 },
    { id: 'explorar', en: 'Explore', pt: 'Explorar', ic: '🧭', rank: 2 },
    { id: 'aprofundar', en: 'Deep dive', pt: 'Aprofundar', ic: '📚', rank: 3 },
  ];
  const RANK = { destaque: 1, explorar: 2, aprofundar: 3 };

  let _root = null, _index = null, _cache = {}, _all = null, _stack = [], _view = null;
  let _fav = _load('kb:fav', []), _hist = _load('kb:hist', []);

  function _load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }
  function _save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

  /* ── data ── */
  async function ensureIndex() {
    if (_index) return _index;
    _index = await fetch('data/explore/index.json').then(r => r.json());
    return _index;
  }
  async function loadTheme(t) {
    if (_cache[t]) return _cache[t];
    let items = [];
    try { const d = await fetch(`data/explore/${t}.json`).then(r => r.ok ? r.json() : null); items = (d && d.items) || []; } catch {}
    items.forEach(it => { it.theme = t; });
    _cache[t] = items;
    return items;
  }
  async function loadAll() {
    await ensureIndex();
    await Promise.all(Object.keys(_index.themes).map(loadTheme));
    _all = [];
    for (const t in _cache) _all.push(..._cache[t]);
    return _all;
  }
  const theme = id => _index.themes[id] || { label: id, emoji: '•', color: '#6366f1', subthemes: [] };
  const areaOf = id => (_index.areas.find(a => a.themes.includes(id)) || { label: '', id: '' });
  const itemById = id => _all && _all.find(x => x.id === id);
  const tierRank = it => RANK[it.tier] || 2;
  const prettyPerson = slug => slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  /* ── navigation stack ── */
  function go(v, replace) {
    if (!replace && _view) _stack.push(_view);
    _view = v;
    render();
    const body = _root && _root.querySelector('#kb-body');
    if (body) body.scrollTop = 0;
  }
  function back() { _view = _stack.pop() || { page: 'hub' }; render(); }

  function pushHistory(id) {
    _hist = [id, ..._hist.filter(x => x !== id)].slice(0, 40);
    _save('kb:hist', _hist);
  }
  function toggleFav(id) {
    _fav = _fav.includes(id) ? _fav.filter(x => x !== id) : [id, ..._fav];
    _save('kb:fav', _fav);
  }

  /* ── daily discovery (deterministic by date) ── */
  function daySeed(offset = 0) {
    const d = new Date();
    return (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() + offset);
  }
  const pick = (arr, off) => arr.length ? arr[daySeed(off) % arr.length] : null;

  /* ════════════════════════════ RENDER ════════════════════════════ */
  function render() {
    if (!_root) return;
    const body = _root.querySelector('#kb-body');
    const p = _view.page;
    if (p === 'hub') body.innerHTML = hubHTML();
    else if (p === 'theme') body.innerHTML = themeHTML(_view.theme, _view);
    else if (p === 'item') body.innerHTML = itemHTML(_view.id);
    else if (p === 'search') body.innerHTML = searchHTML(_view.q);
    else if (p === 'list') body.innerHTML = listHTML(_view);
    wireBody();
  }

  function crumbs(parts) {
    return `<nav class="kb-crumbs">${parts.map((p, i) =>
      (i < parts.length - 1
        ? `<button class="kb-crumb" data-nav='${esc(JSON.stringify(p.to))}'>${esc(p.label)}</button><span class="kb-crumb-sep">›</span>`
        : `<span class="kb-crumb on">${esc(p.label)}</span>`)).join('')}</nav>`;
  }

  /* ── HUB ── */
  function hubHTML() {
    const allDest = _all.filter(i => i.tier === 'destaque');
    const people = [...new Set(_all.flatMap(i => i.people || []))];
    const places = _all.filter(i => i.place);
    const themeIds = Object.keys(_index.themes);

    const tOfDay = pick(themeIds, 0);
    const eOfDay = pick(allDest, 1);
    const pOfDay = pick(people, 2);
    const lOfDay = pick(places, 3);
    const pOfDayItem = pOfDay && _all.find(i => (i.people || []).includes(pOfDay));

    const card = (lbl, emoji, title, sub, nav, accent) => `
      <button class="kb-disco" data-nav='${esc(JSON.stringify(nav))}' style="--c:${accent || 'var(--accent)'}">
        <span class="kb-disco-lbl">${emoji} ${esc(lbl)}</span>
        <span class="kb-disco-title">${esc(title)}</span>
        ${sub ? `<span class="kb-disco-sub">${esc(sub)}</span>` : ''}
      </button>`;

    const discovery = `
      <section class="kb-section">
        <div class="kb-section-hd"><h2>${_t('Discover', 'Descobrir')}</h2>
          <button class="kb-btn" id="kb-random">🎲 ${_t('Something new', 'Descobre algo novo')}</button></div>
        <div class="kb-disco-grid">
          ${tOfDay ? card(_t('Topic of the day', 'Tema do dia'), theme(tOfDay).emoji, theme(tOfDay).label, areaOf(tOfDay).label, { page: 'theme', theme: tOfDay }, theme(tOfDay).color) : ''}
          ${eOfDay ? card(_t('Event of the day', 'Evento do dia'), '📅', eOfDay.title, theme(eOfDay.theme).label, { page: 'item', id: eOfDay.id }, theme(eOfDay.theme).color) : ''}
          ${pOfDayItem ? card(_t('Person of the day', 'Pessoa do dia'), '👤', prettyPerson(pOfDay), pOfDayItem.title, { page: 'item', id: pOfDayItem.id }) : ''}
          ${lOfDay ? card(_t('Place of the day', 'Local do dia'), '📍', lOfDay.place, lOfDay.title, { page: 'item', id: lOfDay.id }) : ''}
        </div>
      </section>`;

    const quick = (_fav.length || _hist.length) ? `
      <section class="kb-section kb-quick">
        ${_fav.length ? `<button class="kb-chip kb-chip-lg" data-nav='${esc(JSON.stringify({ page: 'list', kind: 'fav' }))}'>★ ${_t('Favourites', 'Favoritos')} <b>${_fav.length}</b></button>` : ''}
        ${_hist.length ? `<button class="kb-chip kb-chip-lg" data-nav='${esc(JSON.stringify({ page: 'list', kind: 'hist' }))}'>🕘 ${_t('History', 'Histórico')} <b>${_hist.length}</b></button>` : ''}
      </section>` : '';

    const areas = _index.areas.map(a => `
      <section class="kb-section">
        <div class="kb-area-hd"><span class="kb-area-emoji">${a.emoji}</span><h2>${esc(_lang() === 'en' ? a.label_en : a.label)}</h2></div>
        <div class="kb-theme-grid">
          ${a.themes.map(tid => {
            const th = theme(tid), items = _cache[tid] || [];
            const dn = items.filter(i => i.tier === 'destaque').length;
            return `<button class="kb-theme-card" data-nav='${esc(JSON.stringify({ page: 'theme', theme: tid }))}' style="--c:${th.color}">
              <span class="kb-theme-emoji">${th.emoji}</span>
              <span class="kb-theme-name">${esc(th.label)}</span>
              <span class="kb-theme-meta">${items.length} ${_t('items', 'itens')} · ${dn} ✨</span>
              <span class="kb-theme-subs">${(th.subthemes || []).slice(0, 5).map(s => esc(s.label)).join(' · ')}</span>
            </button>`;
          }).join('')}
        </div>
      </section>`).join('');

    return `
      <div class="kb-hub">
        <header class="kb-hero">
          <h1>${_t('Explore by topic', 'Explorar por temas')}</h1>
          <p>${_t('A growing knowledge base — from the Big Bang to video games. Pick an area, drill into a topic, choose how deep to go.', 'Uma base de conhecimento em crescimento — do Big Bang aos videojogos. Escolhe uma área, aprofunda um tema, decide o nível de detalhe.')}</p>
          <div class="kb-search-wrap">
            <input type="search" id="kb-search" class="kb-search" placeholder="${_t('Search everything…', 'Pesquisar tudo…')}" autocomplete="off">
          </div>
        </header>
        ${discovery}
        ${quick}
        ${areas}
      </div>`;
  }

  /* ── THEME ── */
  function themeHTML(tid, v) {
    const th = theme(tid), area = areaOf(tid);
    const items = (_cache[tid] || []).slice().sort((a, b) => (a.year || 0) - (b.year || 0));
    const maxRank = v.tier ? RANK[v.tier] : 3;
    const subFilter = v.sub || null, tagFilter = v.tag || null;
    let shown = items.filter(i => tierRank(i) <= maxRank);
    if (subFilter) shown = shown.filter(i => i.subtheme === subFilter);
    if (tagFilter) shown = shown.filter(i => (i.tags || []).includes(tagFilter));

    const subCounts = {};
    items.filter(i => tierRank(i) <= maxRank).forEach(i => { const k = i.subtheme || '_geral'; subCounts[k] = (subCounts[k] || 0) + 1; });
    const subs = (th.subthemes || []).filter(s => subCounts[s.id]);
    const hasGeral = subCounts._geral;

    const tierBar = `<div class="kb-tierbar">${TIERS.map(t =>
      `<button class="kb-tier${(v.tier || 'aprofundar') === t.id ? ' on' : ''}" data-nav='${esc(JSON.stringify({ page: 'theme', theme: tid, tier: t.id, sub: subFilter, tag: tagFilter }))}'>${t.ic} ${_t(t.en, t.pt)}</button>`).join('')}</div>`;

    const subBar = `<div class="kb-subbar">
      <button class="kb-subchip${!subFilter ? ' on' : ''}" data-nav='${esc(JSON.stringify({ page: 'theme', theme: tid, tier: v.tier, tag: tagFilter }))}'>${_t('All', 'Todos')}</button>
      ${subs.map(s => `<button class="kb-subchip${subFilter === s.id ? ' on' : ''}" data-nav='${esc(JSON.stringify({ page: 'theme', theme: tid, tier: v.tier, sub: s.id, tag: tagFilter }))}'>${s.emoji} ${esc(s.label)} <b>${subCounts[s.id]}</b></button>`).join('')}
      ${hasGeral ? `<button class="kb-subchip${subFilter === '_geral' ? ' on' : ''}" data-nav='${esc(JSON.stringify({ page: 'theme', theme: tid, tier: v.tier, sub: '_geral', tag: tagFilter }))}'>${_t('General', 'Geral')} <b>${subCounts._geral}</b></button>` : ''}
    </div>`;

    const tagChip = tagFilter ? `<div class="kb-activetag">${_t('Tag', 'Etiqueta')}: <b>#${esc(tagFilter)}</b> <button class="kb-tagx" data-nav='${esc(JSON.stringify({ page: 'theme', theme: tid, tier: v.tier, sub: subFilter }))}'>✕</button></div>` : '';

    const rows = shown.map(i => itemRow(i)).join('') || `<div class="kb-empty">${_t('Nothing at this level yet — try “Deep dive”.', 'Ainda nada neste nível — experimenta “Aprofundar”.')}</div>`;

    const related = area.themes.filter(x => x !== tid).map(x =>
      `<button class="kb-chip" data-nav='${esc(JSON.stringify({ page: 'theme', theme: x }))}' style="--c:${theme(x).color}">${theme(x).emoji} ${esc(theme(x).label)}</button>`).join('');

    const explorerLink = th.explorer ? `<button class="kb-btn kb-btn-accent" data-explorer="${esc(th.explorer)}">🧊 ${_t('Open 3D explorer', 'Abrir explorador 3D')}</button>` : '';

    return `
      <div class="kb-theme" style="--c:${th.color}">
        ${crumbs([{ label: _t('Explore', 'Explorar'), to: { page: 'hub' } }, { label: _lang() === 'en' ? area.label_en : area.label, to: { page: 'hub' } }, { label: th.label }])}
        <header class="kb-theme-hero">
          <span class="kb-theme-hero-emoji">${th.emoji}</span>
          <div><h1>${esc(th.label)}</h1>
            <p>${shown.length} ${_t('of', 'de')} ${items.length} ${_t('items', 'itens')}</p></div>
          ${explorerLink}
        </header>
        ${tierBar}
        ${subBar}
        ${tagChip}
        <div class="kb-list">${rows}</div>
        ${related ? `<div class="kb-related"><h3>${_t('Related topics', 'Temas relacionados')}</h3><div class="kb-chips">${related}</div></div>` : ''}
      </div>`;
  }

  function itemRow(i) {
    const th = theme(i.theme);
    const fav = _fav.includes(i.id);
    const yr = fmtYear(i.year);
    /* shared AI cover with the timeline (assets/timeline/<id>.jpg). When absent
       the <img> removes itself and the emoji placeholder shows through. */
    return `<button class="kb-row" data-nav='${esc(JSON.stringify({ page: 'item', id: i.id }))}' style="--c:${th.color}">
      <span class="kb-row-thumb"><span class="kb-row-thumb-em">${th.emoji}</span><img src="assets/timeline/${esc(i.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"></span>
      <span class="kb-row-year">${esc(yr)}</span>
      <span class="kb-row-main"><span class="kb-row-title">${esc(i.title)}</span>
        <span class="kb-row-desc">${esc(i.desc || '')}</span></span>
      <span class="kb-row-side">${i.tier === 'destaque' ? '<span class="kb-star">✨</span>' : ''}${fav ? '<span class="kb-faved">★</span>' : ''}</span>
    </button>`;
  }

  function fmtYear(y) {
    if (y == null) return '';
    if (y <= -1e8) return (Math.abs(y) / 1e9).toFixed(1).replace('.0', '') + ' ' + _t('Ga', 'mil M anos');
    if (y < -10000) return Math.round(Math.abs(y) / 1000) + ' ' + _t('kya', 'mil anos');
    if (y < 0) return Math.abs(y) + ' ' + _t('BC', 'a.C.');
    return String(y);
  }

  /* ── ITEM DETAIL ── */
  function itemHTML(id) {
    const i = itemById(id);
    if (!i) return `<div class="kb-empty">${_t('Not found', 'Não encontrado')}</div>`;
    pushHistory(id);
    const th = theme(i.theme), area = areaOf(i.theme);
    const sub = (th.subthemes || []).find(s => s.id === i.subtheme);
    const fav = _fav.includes(i.id);
    const related = (i.related || []).map(itemById).filter(Boolean);
    const tier = TIERS.find(t => t.id === i.tier) || TIERS[1];

    return `
      <article class="kb-detail" style="--c:${th.color}">
        ${crumbs([
          { label: _t('Explore', 'Explorar'), to: { page: 'hub' } },
          { label: th.label, to: { page: 'theme', theme: i.theme } },
          ...(sub ? [{ label: sub.label, to: { page: 'theme', theme: i.theme, sub: sub.id } }] : []),
          { label: i.title },
        ])}
        <div class="kb-detail-media"><span class="kb-detail-media-em">${th.emoji}</span><img src="assets/timeline/${esc(i.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"></div>
        <header class="kb-detail-hd">
          <div class="kb-detail-tags-top">
            <span class="kb-pill" style="background:${th.color}22;color:${th.color}">${th.emoji} ${esc(th.label)}</span>
            ${sub ? `<span class="kb-pill ghost">${sub.emoji} ${esc(sub.label)}</span>` : ''}
            <span class="kb-pill ghost">${tier.ic} ${_t(tier.en, tier.pt)}</span>
          </div>
          <h1>${esc(i.title)}</h1>
          <div class="kb-detail-meta">
            ${i.year != null ? `<span>🗓️ ${esc(fmtYear(i.year))}</span>` : ''}
            ${i.place ? `<span>📍 ${esc(i.place)}</span>` : ''}
            ${i.period ? `<span>📜 ${esc(i.period)}</span>` : ''}
          </div>
          <button class="kb-fav-btn${fav ? ' on' : ''}" id="kb-fav" data-id="${esc(i.id)}">${fav ? '★ ' + _t('Saved', 'Guardado') : '☆ ' + _t('Save', 'Guardar')}</button>
        </header>
        <p class="kb-detail-desc">${esc(i.desc || '')}</p>
        ${i.fact ? `<div class="kb-fact"><strong>💡 ${_t('Did you know?', 'Sabias que?')}</strong> ${esc(i.fact)}</div>` : ''}
        ${(i.people || []).length ? `<div class="kb-people"><h3>${_t('People', 'Pessoas')}</h3>${i.people.map(p => `<span class="kb-person">👤 ${esc(prettyPerson(p))}</span>`).join('')}</div>` : ''}
        ${(i.tags || []).length ? `<div class="kb-tags">${i.tags.map(t => `<button class="kb-tag" data-nav='${esc(JSON.stringify({ page: 'theme', theme: i.theme, tag: t }))}'>#${esc(t)}</button>`).join('')}</div>` : ''}
        ${related.length ? `<div class="kb-related"><h3>🔗 ${_t('Related', 'Relacionados')}</h3><div class="kb-list">${related.map(itemRow).join('')}</div></div>` : ''}
      </article>`;
  }

  /* ── SEARCH ── */
  function searchHTML(q) {
    const nq = q.trim().toLowerCase();
    const hits = !nq ? [] : _all.filter(i =>
      i.title.toLowerCase().includes(nq) ||
      (i.desc || '').toLowerCase().includes(nq) ||
      (i.tags || []).some(t => t.includes(nq)) ||
      theme(i.theme).label.toLowerCase().includes(nq)
    ).slice(0, 120);
    const byTheme = {};
    hits.forEach(i => (byTheme[i.theme] = byTheme[i.theme] || []).push(i));
    const groups = Object.entries(byTheme).map(([t, list]) => `
      <div class="kb-srch-group">
        <h3 style="--c:${theme(t).color}">${theme(t).emoji} ${esc(theme(t).label)} <b>${list.length}</b></h3>
        <div class="kb-list">${list.map(itemRow).join('')}</div>
      </div>`).join('');
    return `
      <div class="kb-search-page">
        ${crumbs([{ label: _t('Explore', 'Explorar'), to: { page: 'hub' } }, { label: `${_t('Search', 'Pesquisa')}: “${q}”` }])}
        <p class="kb-srch-count">${hits.length} ${_t('results', 'resultados')}</p>
        ${groups || `<div class="kb-empty">${_t('No results.', 'Sem resultados.')}</div>`}
      </div>`;
  }

  /* ── LIST (favourites / history) ── */
  function listHTML(v) {
    const ids = v.kind === 'fav' ? _fav : _hist;
    const items = ids.map(itemById).filter(Boolean);
    const title = v.kind === 'fav' ? '★ ' + _t('Favourites', 'Favoritos') : '🕘 ' + _t('History', 'Histórico');
    return `
      <div class="kb-listpage">
        ${crumbs([{ label: _t('Explore', 'Explorar'), to: { page: 'hub' } }, { label: title }])}
        <div class="kb-list">${items.map(itemRow).join('') || `<div class="kb-empty">${_t('Empty.', 'Vazio.')}</div>`}</div>
      </div>`;
  }

  /* ════════════════════════════ WIRING ════════════════════════════ */
  function wireBody() {
    const body = _root.querySelector('#kb-body');
    body.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => {
      try { go(JSON.parse(el.dataset.nav)); } catch {}
    }));
    const rnd = body.querySelector('#kb-random');
    if (rnd) rnd.onclick = () => discoverRandom();
    const fav = body.querySelector('#kb-fav');
    if (fav) fav.onclick = () => { toggleFav(fav.dataset.id); render(); };
    const exp = body.querySelector('[data-explorer]');
    if (exp) exp.onclick = () => { location.hash = 'explorer/' + exp.dataset.explorer; };
    const search = body.querySelector('#kb-search');
    if (search) {
      search.onkeydown = e => { if (e.key === 'Enter' && search.value.trim()) go({ page: 'search', q: search.value.trim() }); };
    }
  }

  function discoverRandom() {
    if (!_all || !_all.length) return;
    const i = _all[Math.floor(Math.random() * _all.length)];
    go({ page: 'item', id: i.id });
  }

  /* ════════════════════════════ PUBLIC ════════════════════════════ */
  async function mount(sub) {
    _root = sub;
    sub.innerHTML = `<div class="kb-wrap">
      <div class="kb-topbar">
        <button class="kb-back" id="kb-back">← ${_t('Back', 'Voltar')}</button>
        <button class="kb-home" id="kb-home">🧭 ${_t('Topics', 'Temas')}</button>
      </div>
      <div class="kb-body" id="kb-body"><div class="kb-loading">${_t('Loading…', 'A carregar…')}</div></div>
    </div>`;
    sub.querySelector('#kb-back').onclick = () => back();
    sub.querySelector('#kb-home').onclick = () => { _stack = []; go({ page: 'hub' }, true); };
    await loadAll();
    _view = { page: 'hub' };
    _stack = [];
    render();
  }
  function resume() { if (_root && !_root.querySelector('#kb-body').children.length) render(); }
  function stop() {}

  return { mount, resume, stop, discoverRandom };
})();
