/* ══════════════════════════════════════════════════════════════════
   TIMELINE EXPLORER — Linha do Tempo interativa
   Do Big Bang ao presente. Orientada a dados (data/timeline.json),
   offline-first, mobile-first. Nenhum evento está hardcoded no código.
══════════════════════════════════════════════════════════════════ */
const TimelineExplorer = (function () {
  'use strict';

  let _data = null, _loaded = false, _root = null, _lastFocus = null, _escBound = false;
  let _cat = 'all', _era = 'all', _q = '', _keyOnly = false;
  const PRESENT = new Date().getFullYear();

  function _lang() { return typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'; }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nf = n => n.toLocaleString(_lang() === 'en' ? 'en' : 'pt-PT');

  /* Category presentation (config — not event content). */
  let CATS = {};
  function _buildCats() {
    CATS = {
      universo: { emoji:'🌌', label:_t('Universe','Universo'),               color:'#8b5cf6' },
      solar:    { emoji:'☀️', label:_t('Solar System','Sistema Solar'),       color:'#f59e0b' },
      terra:    { emoji:'🌍', label:_t('Earth','Terra'),                     color:'#3b82f6' },
      vida:     { emoji:'🦠', label:_t('Life','Vida'),                       color:'#10b981' },
      dinos:    { emoji:'🦕', label:_t('Dinosaurs','Dinossauros'),           color:'#84cc16' },
      humana:   { emoji:'🦣', label:_t('Human evolution','Evolução Humana'), color:'#d97706' },
      civil:    { emoji:'🏺', label:_t('Ancient civilisations','Civilizações Antigas'), color:'#eab308' },
      mundial:  { emoji:'⚔️', label:_t('World history','História Mundial'),   color:'#ef4444' },
      portugal: { emoji:'🇵🇹', label:'Portugal',                             color:'#16a34a' },
      espaco:   { emoji:'🚀', label:_t('Space','Espaço'),                    color:'#06b6d4' },
      tech:     { emoji:'💻', label:_t('Technology','Tecnologia'),           color:'#6366f1' },
      medicina: { emoji:'🧬', label:_t('Medicine','Medicina'),              color:'#ec4899' },
      ambiente: { emoji:'🌱', label:_t('Environment','Ambiente'),            color:'#14b8a6' },
      cultura:  { emoji:'🎨', label:_t('Culture','Cultura'),                color:'#a855f7' },
    };
  }
  const cat = e => CATS[e.cat] || { emoji:'•', label:'', color:'#6366f1' };

  /* Temporal zoom presets — each sets a "from this year onwards" window. */
  function _eras() {
    return [
      { id:'all',    label:_t('All time','Tudo'),        from:-Infinity },
      { id:'earth',  label:'🌍 4,5 Ga',                  from:-4600000000 },
      { id:'life',   label:'🦠 541 Ma',                  from:-541000000 },
      { id:'dino',   label:'🦕 252 Ma',                  from:-252000000 },
      { id:'human',  label:'🦣 300 ka',                  from:-300000 },
      { id:'civ',    label:'🏺 6000 ' + _t('BCE','a.C.'), from:-6000 },
      { id:'ce',     label:'📜 ' + _t('Common era','Era comum'), from:0 },
      { id:'modern', label:'⚙️ 1700+',                   from:1700 },
    ];
  }

  /* "X ago" in human terms (the most intuitive label across 13.8 Gy). */
  function agoStr(y) {
    const a = PRESENT - y;
    if (a >= 1e9) return _t('', 'há ') + (a / 1e9).toLocaleString('pt-PT', { maximumFractionDigits: 2 }) + _t(' billion years ago', ' mil milhões de anos');
    if (a >= 1e6) return _t('', 'há ') + Math.round(a / 1e6).toLocaleString('pt-PT') + _t(' million years ago', ' milhões de anos');
    if (a >= 1e4) return _t('', 'há ') + Math.round(a / 1e3).toLocaleString('pt-PT') + _t(' thousand years ago', ' mil anos');
    if (a > 1) return _t('', 'há ') + nf(a) + _t(' years ago', ' anos');
    if (a === 1) return _t('1 year ago', 'há 1 ano');
    return _t('this year', 'este ano');
  }
  /* Compact calendar-style label for the card. */
  function cardDate(y) {
    if (y < -10000) return agoStr(y);
    if (y < 0) return nf(Math.abs(y)) + ' ' + _t('BCE', 'a.C.');
    return String(y);
  }

  async function _ensure() {
    if (_loaded) return;
    try { const r = await fetch('data/timeline.json'); _data = r.ok ? await r.json() : []; }
    catch (e) { _data = []; }
    _loaded = true;
  }

  /* ── filtering ── */
  function filtered() {
    const eraFrom = (_eras().find(e => e.id === _era) || {}).from;
    const from = (eraFrom == null) ? -Infinity : eraFrom;
    const qn = norm(_q);
    return _data.filter(e => {
      if (_cat !== 'all' && e.cat !== _cat) return false;
      if (e.year < from) return false;
      if (_keyOnly && !e.key) return false;
      if (qn) {
        const hay = norm(e.title) + ' ' + norm(e.desc || '') + ' ' + norm(e.period || '') + ' ' + norm(cat(e).label);
        if (!hay.includes(qn)) return false;
      }
      return true;
    }).sort((a, b) => a.year - b.year);
  }

  /* ── render ── */
  function render() {
    if (!_root) return;
    _root.querySelectorAll('#tl-cats [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === _cat));
    _root.querySelectorAll('#tl-eras [data-era]').forEach(b => b.classList.toggle('on', b.dataset.era === _era));
    const out = _root.querySelector('#tl-results');
    if (!out) return;

    const list = filtered();
    const isDefault = _cat === 'all' && _era === 'all' && !_q && !_keyOnly;
    let html = '';
    if (isDefault) html += todayStrip() + scaleStrip();
    if (!list.length) {
      html += `<p class="tl-empty">${_t('No events match your filters.', 'Sem eventos para estes filtros.')}</p>`;
    } else {
      html += `<p class="tl-count">${nf(list.length)} ${_t('events', 'eventos')}</p>`;
      html += `<div class="tl-list">${list.map(card).join('')}</div>`;
    }
    out.innerHTML = html;
  }

  function todayStrip() {
    const d = new Date();
    const md = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hits = _data.filter(e => e.date === md);
    if (!hits.length) return '';
    const day = d.toLocaleDateString(_lang() === 'en' ? 'en' : 'pt-PT', { day: 'numeric', month: 'long' });
    return `<section class="tl-strip tl-today">
      <h2 class="tl-strip-title">📅 ${_t('On this day', 'Hoje na história')} · ${day}</h2>
      <div class="tl-strip-row">${hits.map(e => `<button class="tl-chip" data-id="${esc(e.id)}" style="--c:${cat(e).color}"><span>${cat(e).emoji}</span>${esc(e.title)} <em>${e.year}</em></button>`).join('')}</div>
    </section>`;
  }

  function scaleStrip() {
    const get = id => _data.find(e => e.id === id);
    const items = ['big-bang', 'formacao-terra', 'extincao-dinos', 'homo-sapiens', 'revolucao-industrial']
      .map(get).filter(Boolean);
    if (!items.length) return '';
    return `<section class="tl-strip tl-scale">
      <h2 class="tl-strip-title">📏 ${_t('Sense of scale', 'Escala do tempo')}</h2>
      <div class="tl-scale-grid">${items.map(e => `
        <button class="tl-scale-item" data-id="${esc(e.id)}" style="--c:${cat(e).color}">
          <span class="tl-scale-emoji">${cat(e).emoji}</span>
          <span class="tl-scale-t">${esc(e.title)}</span>
          <span class="tl-scale-ago">${agoStr(e.year)}</span>
        </button>`).join('')}</div>
      <p class="tl-scale-fact">🌌 ${_t('If the whole history of the Universe were a single year, modern humans would appear only in the last minutes of 31 December.', 'Se toda a história do Universo coubesse num único ano, os humanos modernos surgiriam apenas nos últimos minutos de 31 de dezembro.')}</p>
    </section>`;
  }

  function card(e) {
    const c = cat(e);
    return `<button class="tl-event" data-id="${esc(e.id)}" style="--c:${c.color}">
      <span class="tl-rail"><span class="tl-dot">${c.emoji}</span></span>
      <span class="tl-ev-body">
        <span class="tl-ev-date">${cardDate(e.year)}</span>
        <span class="tl-ev-title">${esc(e.title)}${e.key ? ' <span class="tl-star" title="' + _t('Highlight', 'Destaque') + '">★</span>' : ''}</span>
        ${e.period ? `<span class="tl-ev-period">${esc(e.period)}</span>` : ''}
        <span class="tl-ev-desc">${esc(e.desc || '')}</span>
      </span>
    </button>`;
  }

  /* ── detail ── */
  function openDetail(id) {
    const e = _data.find(x => x.id === id);
    if (!e || !_root) return;
    const d = _root.querySelector('#tl-detail');
    if (!d) return;
    const c = cat(e);
    const related = (e.related || []).map(r => _data.find(x => x.id === r)).filter(Boolean);
    d.style.setProperty('--c', c.color);
    d.innerHTML = `
      <button class="tl-d-close" aria-label="${_t('Close', 'Fechar')}">✕</button>
      <div class="tl-d-head">
        <span class="tl-d-emoji">${c.emoji}</span>
        <div><span class="tl-d-cat">${esc(c.label)}</span><h2 class="tl-d-title" id="tl-d-title">${esc(e.title)}</h2></div>
      </div>
      <div class="tl-d-meta">
        <span>🕓 ${cardDate(e.year)}</span>
        <span>⏳ ${agoStr(e.year)}</span>
        ${e.period ? `<span>📜 ${esc(e.period)}</span>` : ''}
        ${e.place ? `<span>📍 ${esc(e.place)}</span>` : ''}
      </div>
      <p class="tl-d-desc">${esc(e.desc || '')}</p>
      ${e.fact ? `<div class="tl-d-fact"><strong>💡 ${_t('Did you know?', 'Curiosidade')}</strong> ${esc(e.fact)}</div>` : ''}
      ${related.length ? `<div class="tl-d-rel-label">🔗 ${_t('Related events', 'Eventos relacionados')}</div>
        <div class="tl-d-rel">${related.map(r => `<button class="tl-chip" data-id="${esc(r.id)}" style="--c:${cat(r).color}"><span>${cat(r).emoji}</span>${esc(r.title)}</button>`).join('')}</div>` : ''}`;
    d.hidden = false; d.scrollTop = 0;
    d.querySelector('.tl-d-close').onclick = closeDetail;
    d.querySelectorAll('[data-id]').forEach(b => b.onclick = () => openDetail(b.dataset.id));
    _lastFocus = document.activeElement;
    requestAnimationFrame(() => d.querySelector('.tl-d-close')?.focus());
  }
  function closeDetail() {
    const d = _root && _root.querySelector('#tl-detail');
    if (d) d.hidden = true;
    if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (e) {} _lastFocus = null; }
  }

  /* ── shell + wiring ── */
  function shell() {
    const cats = [['all', '🕓', _t('All', 'Todas')]].concat(Object.keys(CATS).map(k => [k, CATS[k].emoji, CATS[k].label]));
    return `
      <div class="tl-wrap">
        <div class="tl-toolbar">
          <div class="tl-search">
            <span class="tl-search-ic" aria-hidden="true">🔍</span>
            <input id="tl-q" type="search" placeholder="${_t('Search events, people, periods…', 'Pesquisar eventos, pessoas, períodos…')}" autocomplete="off" aria-label="${_t('Search the timeline', 'Pesquisar na linha do tempo')}">
          </div>
          <button class="tl-btn" id="tl-random">🎲 ${_t('Random', 'Aleatório')}</button>
          <button class="tl-btn" id="tl-key" aria-pressed="false">✨ ${_t('Highlights', 'Destaques')}</button>
        </div>
        <div class="tl-chips tl-cats" id="tl-cats" role="group" aria-label="${_t('Filter by category', 'Filtrar por categoria')}">
          ${cats.map(([id, em, lb]) => `<button class="tl-fchip" data-cat="${id}"><span>${em}</span>${esc(lb)}</button>`).join('')}
        </div>
        <div class="tl-chips tl-eras" id="tl-eras" role="group" aria-label="${_t('Temporal zoom', 'Zoom temporal')}">
          ${_eras().map(e => `<button class="tl-fchip" data-era="${e.id}">${esc(e.label)}</button>`).join('')}
        </div>
        <div class="tl-results" id="tl-results"><p class="tl-loading">${_t('Loading the timeline…', 'A carregar a linha do tempo…')}</p></div>
        <div class="tl-detail" id="tl-detail" role="dialog" aria-modal="true" aria-labelledby="tl-d-title" hidden></div>
      </div>`;
  }

  function wire() {
    const r = _root;
    const q = r.querySelector('#tl-q');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { _q = q.value.trim(); render(); }, 150); });
    r.querySelector('#tl-random').onclick = () => discoverRandom();
    r.querySelector('#tl-key').onclick = e => {
      _keyOnly = !_keyOnly;
      e.currentTarget.classList.toggle('on', _keyOnly);
      e.currentTarget.setAttribute('aria-pressed', _keyOnly ? 'true' : 'false');
      render();
    };
    r.querySelector('#tl-cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { _cat = b.dataset.cat; render(); } });
    r.querySelector('#tl-eras').addEventListener('click', e => { const b = e.target.closest('[data-era]'); if (b) { _era = b.dataset.era; render(); } });
    r.querySelector('#tl-results').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) openDetail(b.dataset.id); });
    const det = r.querySelector('#tl-detail');
    det.addEventListener('click', e => { if (e.target === det) closeDetail(); });
    if (!_escBound) {
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || !_root) return;
        const d = _root.querySelector('#tl-detail');
        if (d && !d.hidden) closeDetail();
      });
      _escBound = true;
    }
  }

  /* ── public ── */
  function mount(sub) {
    _root = sub;
    _buildCats();
    sub.innerHTML = shell();
    wire();
    _ensure().then(() => render());
  }
  function resume() {
    if (!_root) return;
    _root = document.getElementById('ex-sub-timeline') || _root;
    render();   /* refresh "on this day" in case the day changed */
  }
  function stop() { closeDetail(); }
  function discoverRandom() {
    _ensure().then(() => { if (_data && _data.length) openDetail(_data[Math.floor(Math.random() * _data.length)].id); });
  }

  return { mount, resume, stop, discoverRandom };
})();
