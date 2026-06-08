/* ══════════════════════════════════════════════════════════════════
   NOTÍCIAS — static RSS news aggregator (reader)
   Reads the static JSON produced by data/news/build-news.mjs (refreshed
   every 4h by a GitHub Action). No live RSS in the browser, no database.
   Topic tabs (Portugal first), source filter, search, article cards.
   Mirrors the top-level-section pattern of ocorrencias.js / eventos.js.
══════════════════════════════════════════════════════════════════ */
const NoticiasPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);

  const BASE = 'data/news/';
  /* Topic metadata (ids match build-news.mjs). */
  const TOPIC = {
    portugal:   { icon: '🇵🇹', en: 'Portugal',      pt: 'Portugal',      color: '#16a34a' },
    tecnologia: { icon: '💻', en: 'Technology',     pt: 'Tecnologia',    color: '#3b82f6' },
    devops:     { icon: '🧩', en: 'DevOps & Cloud', pt: 'DevOps & Cloud', color: '#06b6d4' },
    mundo:      { icon: '🌍', en: 'World',          pt: 'Mundo',         color: '#f59e0b' },
    economia:   { icon: '💶', en: 'Economy',        pt: 'Economia',      color: '#a16207' },
    automovel:  { icon: '🚗', en: 'Cars',           pt: 'Automóvel',     color: '#ef4444' },
    gaming:     { icon: '🎮', en: 'Gaming',         pt: 'Gaming',        color: '#8b5cf6' },
    cinema:     { icon: '🎬', en: 'Film & TV',      pt: 'Cinema & TV',   color: '#ec4899' },
  };
  const tLabel = (id) => (TOPIC[id] ? _t(TOPIC[id].en, TOPIC[id].pt) : id);
  const tColor = (id) => (TOPIC[id] ? TOPIC[id].color : '#64748b');
  const tIcon  = (id) => (TOPIC[id] ? TOPIC[id].icon : '🗞️');

  /* ── State ── */
  let _inited = false;
  let _index = null;                 /* index.json */
  let _cache = {};                   /* tab id → articles[] (loaded JSON) */
  let _tab = 'principal';
  let _source = '';                  /* source-name filter */
  let _query = '';
  let _mode = (() => { try { return localStorage.getItem('nw-mode') || 'cards'; } catch { return 'cards'; } })();  /* cards | compact | list */
  const VIEW_MODES = [
    ['cards',   '▢', 'Cards',   'Cartões'],
    ['compact', '▦', 'Compact', 'Compacto'],
    ['list',    '☰', 'List',    'Lista'],
  ];

  /* ── helpers ── */
  const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function _fetchJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    return fetch(url, { signal: ctrl.signal }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).finally(() => clearTimeout(t));
  }
  function relTime(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return _t('just now', 'agora mesmo');
    const m = s / 60; if (m < 60) return _t(`${m | 0} min ago`, `há ${m | 0} min`);
    const h = m / 60; if (h < 24) return _t(`${h | 0}h ago`, `há ${h | 0}h`);
    const d = h / 24; if (d < 7) return _t(`${d | 0}d ago`, `há ${d | 0} dias`);
    return new Date(ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short' });
  }
  /* Source favicon from the site host (Google's service; hidden if it fails). */
  function favicon(a) {
    let host = '';
    try { host = new URL(a.site || a.url).host; } catch { return ''; }
    if (!host) return '';
    const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    return `<img class="nw-fav" src="${url}" alt="" loading="lazy" onerror="this.style.display='none'">`;
  }

  function fmtUpdated(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /* ── data loading (lazy per tab) ── */
  async function ensureIndex() { if (!_index) _index = await _fetchJSON(BASE + 'index.json'); return _index; }
  async function loadTab(id) {
    if (_cache[id]) return _cache[id];
    const file = id === 'principal' ? 'latest.json' : `topic-${id}.json`;
    const data = await _fetchJSON(BASE + file);
    _cache[id] = data.articles || [];
    return _cache[id];
  }

  /* ── filtering ── */
  function filtered(articles) {
    const q = norm(_query);
    return articles.filter(a => {
      if (_source && a.source !== _source) return false;
      if (q && !(norm(a.title).includes(q) || norm(a.summary).includes(q) || norm(a.source).includes(q))) return false;
      return true;
    });
  }

  /* ════════════════════════════ RENDER ════════════════════════════ */
  function _buildShell(view) {
    const topics = (_index && _index.topics) || [];
    const tabs = [['principal', '🗞️', _t('Top stories', 'Principal')]]
      .concat(topics.map(t => [t.id, tIcon(t.id), tLabel(t.id) + (t.count ? ` <small>${t.count}</small>` : '')]));
    const srcOpts = ((_index && _index.sources) || []).filter(s => s.count > 0)
      .map(s => `<option value="${esc(s.name)}">${esc(s.name)} (${s.count})</option>`).join('');
    view.innerHTML = `
      <div class="nw-wrap">
        <header class="nw-head">
          <div>
            <h1>🗞️ ${_t('News', 'Notícias')}</h1>
            <p class="nw-sub">${_t('Your RSS feeds, aggregated and sorted by topic — Portugal, tech, world and more.', 'Os teus feeds RSS, agregados e organizados por tema — Portugal, tecnologia, mundo e mais.')}</p>
          </div>
          <div class="nw-updated" id="nw-updated"></div>
        </header>

        <div class="nw-tabs" id="nw-tabs" role="tablist">
          ${tabs.map(([id, icon, label]) => `<button class="nw-tab${id === _tab ? ' active' : ''}" role="tab" data-tab="${id}">${icon} ${label}</button>`).join('')}
        </div>

        <div class="nw-toolbar">
          <input id="nw-q" class="nw-search" type="search" placeholder="${_t('Search headlines…', 'Pesquisar notícias…')}">
          <select id="nw-source" class="nw-source"><option value="">${_t('All sources', 'Todas as fontes')}</option>${srcOpts}</select>
          <div class="nw-view" id="nw-view" role="group" aria-label="${_t('View mode', 'Modo de visualização')}">
            ${VIEW_MODES.map(([id, ic, en, pt]) => `<button class="nw-view-b${id === _mode ? ' active' : ''}" data-mode="${id}" title="${_t(en, pt)}" aria-label="${_t(en, pt)}">${ic}</button>`).join('')}
          </div>
          <span class="nw-count" id="nw-count"></span>
        </div>

        <div class="nw-grid nw-grid--${_mode}" id="nw-grid"></div>

        <footer class="nw-foot" id="nw-foot"></footer>
      </div>`;
    _wire(view);
  }

  function articleCard(a) {
    const top = a.topics && a.topics[0] || 'mundo';
    const chips = (a.topics || []).map(t => `<span class="nw-chip" style="--tc:${tColor(t)}">${tIcon(t)} ${esc(tLabel(t))}</span>`).join('');
    return `<article class="nw-card" style="--tc:${tColor(top)}">
      <div class="nw-c-top">
        ${favicon(a)}<span class="nw-c-src">${esc(a.source)}</span>
        <span class="nw-c-time" title="${esc(new Date(a.ts).toLocaleString())}">${esc(relTime(a.ts))}</span>
      </div>
      <a class="nw-c-title" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>
      ${a.summary ? `<p class="nw-c-sum">${esc(a.summary)}</p>` : ''}
      <div class="nw-c-foot">${chips}<a class="nw-c-read" href="${esc(a.url)}" target="_blank" rel="noopener">${_t('Read', 'Ler')} ↗</a></div>
    </article>`;
  }

  /* Dense single-line row for "list" mode. */
  function articleRow(a) {
    const top = a.topics && a.topics[0] || 'mundo';
    return `<a class="nw-row" href="${esc(a.url)}" target="_blank" rel="noopener" style="--tc:${tColor(top)}">
      ${favicon(a)}
      <span class="nw-r-src">${esc(a.source)}</span>
      <span class="nw-r-title">${esc(a.title)}</span>
      <span class="nw-r-time">${esc(relTime(a.ts))}</span>
    </a>`;
  }

  async function renderTab() {
    const grid = document.getElementById('nw-grid');
    const count = document.getElementById('nw-count');
    if (grid) grid.innerHTML = skeleton();
    let arts = [];
    try { arts = await loadTab(_tab); }
    catch (e) { if (grid) grid.innerHTML = `<div class="nw-empty">😕 ${_t('Could not load the news. Try again shortly.', 'Não foi possível carregar as notícias. Tenta novamente daqui a pouco.')}</div>`; return; }
    const list = filtered(arts);
    if (count) count.textContent = `${list.length} ${_t('articles', 'artigos')}`;
    if (grid) {
      grid.className = 'nw-grid nw-grid--' + _mode;
      const render = _mode === 'list' ? articleRow : articleCard;
      grid.innerHTML = list.length ? list.map(render).join('')
        : `<div class="nw-empty">😶 ${_t('Nothing matches your filters.', 'Nada corresponde aos filtros.')}</div>`;
    }
  }

  function skeleton(n = 9) {
    const c = `<div class="nw-skel"><span class="nw-sk-ln nw-sk-sm"></span><span class="nw-sk-ln"></span><span class="nw-sk-ln"></span><span class="nw-sk-ln nw-sk-md"></span></div>`;
    return `<div class="nw-loading"><span class="nw-spin"></span> ${_t('Loading…', 'A carregar…')}</div>` + Array.from({ length: n }, () => c).join('');
  }

  function renderMeta() {
    const up = document.getElementById('nw-updated');
    const foot = document.getElementById('nw-foot');
    if (up && _index) up.innerHTML = `🕒 ${_t('Updated', 'Atualizado')} ${esc(fmtUpdated(_index.generated))}`;
    if (foot && _index) {
      foot.innerHTML = `${_index.total} ${_t('articles from', 'artigos de')} ${_index.feeds.ok}/${_index.feeds.total} ${_t('feeds', 'feeds')} · `
        + _t('Refreshed every 4h from your OPML subscriptions.', 'Atualizado a cada 4h a partir das tuas subscrições OPML.');
    }
  }

  /* ════════════════════════════ WIRING ════════════════════════════ */
  function _wire(view) {
    view.querySelector('#nw-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.nw-tab'); if (!b) return;
      _tab = b.dataset.tab;
      view.querySelectorAll('#nw-tabs .nw-tab').forEach(x => x.classList.toggle('active', x === b));
      renderTab();
    });
    let qt;
    view.querySelector('#nw-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { _query = e.target.value; renderTab(); }, 200); });
    view.querySelector('#nw-source').addEventListener('change', (e) => { _source = e.target.value; renderTab(); });
    view.querySelector('#nw-view').addEventListener('click', (e) => {
      const b = e.target.closest('.nw-view-b'); if (!b) return;
      _mode = b.dataset.mode;
      try { localStorage.setItem('nw-mode', _mode); } catch {}
      view.querySelectorAll('#nw-view .nw-view-b').forEach(x => x.classList.toggle('active', x === b));
      renderTab();
    });
  }

  /* ════════════════════════════ PUBLIC ════════════════════════════ */
  async function show() {
    const view = document.getElementById('view-noticias');
    if (!view) return;
    if (_inited) return;

    /* Minimal shell first (so the section paints instantly), then hydrate. */
    view.innerHTML = `<div class="nw-wrap"><div class="nw-grid">${skeleton()}</div></div>`;
    try {
      await ensureIndex();
      _buildShell(view);
      renderMeta();
      await renderTab();
      _inited = true;
    } catch (e) {
      view.innerHTML = `<div class="nw-wrap"><div class="nw-empty">😕 ${_t('News are being generated. Check back in a few minutes.', 'As notícias estão a ser geradas. Volta daqui a uns minutos.')}</div></div>`;
    }
  }

  return { show };
})();
