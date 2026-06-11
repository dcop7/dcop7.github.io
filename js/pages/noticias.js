/* ══════════════════════════════════════════════════════════════════
   NOTÍCIAS — static RSS news aggregator (reader)
   Reads the static JSON produced by data/news/build-news.mjs (refreshed
   every 4h by a GitHub Action). No live RSS in the browser, no database.
   Layout: topics on the LEFT (vertical, all visible), articles in the
   middle, feeds/sources on the RIGHT (collapsed, toggled). Date filter +
   article-count limit; per-feed counts reflect the active date filter.
══════════════════════════════════════════════════════════════════ */
const NoticiasPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const BASE = 'data/news/';

  const TOPIC = {
    tecnologia:    { icon: '💻', en: 'Technology',    pt: 'Tecnologia',    color: '#3b82f6' },
    ia:            { icon: '🧠', en: 'AI',            pt: 'IA',            color: '#a855f7' },
    tldr:          { icon: '📩', en: 'TLDR',          pt: 'TLDR',          color: '#0891b2' },
    android:       { icon: '📱', en: 'Android',       pt: 'Android',       color: '#84cc16' },
    produtividade: { icon: '🧰', en: 'Productivity',  pt: 'Produtividade', color: '#14b8a6' },
    devops:        { icon: '🧩', en: 'DevOps',        pt: 'DevOps',        color: '#06b6d4' },
    seguranca:     { icon: '🔒', en: 'Security',      pt: 'Segurança',     color: '#dc2626' },
    ciencia:       { icon: '🔬', en: 'Science',       pt: 'Ciência',       color: '#0ea5e9' },
    carros:        { icon: '🚗', en: 'Cars',          pt: 'Carros',        color: '#f97316' },
    f1:            { icon: '🏎️', en: 'F1 & Motorsport', pt: 'F1 & Motorsport', color: '#e11d48' },
    gaming:        { icon: '🎮', en: 'Gaming',        pt: 'Gaming',        color: '#8b5cf6' },
    filmes:        { icon: '🎬', en: 'Film & TV',     pt: 'Filmes & TV',   color: '#ec4899' },
    trailers:      { icon: '🎞️', en: 'Trailers',      pt: 'Trailers',      color: '#d946ef' },
    factcheck:     { icon: '✅', en: 'Fact Check',    pt: 'Fact Check',    color: '#10b981' },
    geral:         { icon: '🇵🇹', en: 'Portugal',     pt: 'Geral',         color: '#16a34a' },
    mundo:         { icon: '🌍', en: 'World',         pt: 'Mundo',         color: '#f59e0b' },
    economia:      { icon: '💶', en: 'Economy',       pt: 'Economia',      color: '#a16207' },
  };
  const tLabel = (id) => (TOPIC[id] ? _t(TOPIC[id].en, TOPIC[id].pt) : id);
  const tColor = (id) => (TOPIC[id] ? TOPIC[id].color : '#64748b');
  const tIcon  = (id) => (TOPIC[id] ? TOPIC[id].icon : '🗞️');

  const VIEW_MODES = [
    ['cards',   '▦', 'Cards',         'Cartões'],
    ['listimg', '▤', 'List + thumbs', 'Lista'],
    ['listc',   '≣', 'Compact list',  'Lista compacta'],
    ['list',    '☰', 'Minimal list',  'Lista mínima'],
  ];
  const DATE_OPTS = [
    ['0', 'Any time', 'Qualquer altura'], ['6', 'Last 6h', 'Últimas 6h'],
    ['24', 'Last 24h', 'Últimas 24h'], ['48', 'Last 48h', 'Últimas 48h'],
    ['168', 'Last 7 days', 'Últimos 7 dias'], ['336', 'Last 14 days', 'Últimos 14 dias'],
  ];
  const LIMIT_OPTS = [['30', '30'], ['60', '60'], ['100', '100'], ['250', '250'], ['500', '500']];

  /* ── State ── */
  let _inited = false, _index = null, _cache = {}, _srcSite = {};
  let _topic = null, _source = '', _query = '';
  let _maxAge = 48, _limit = 100, _feedsOpen = false;
  const _ls = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
  let _mode = _ls('nw-mode', 'cards');
  if (!['cards', 'listimg', 'listc', 'list'].includes(_mode)) _mode = 'cards';   /* migrate old 'compact' */
  let _scale = parseFloat(_ls('nw-scale', '1')) || 1;        /* text size multiplier 0.85..1.3 */

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
  function fmtUpdated(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function dayKey(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dayLabel(ts) {
    const today = dayKey(Date.now()), k = dayKey(ts);
    const diff = Math.round((today - k) / 86400000);
    if (diff <= 0) return _t('Today', 'Hoje');
    if (diff === 1) return _t('Yesterday', 'Ontem');
    if (diff < 7) return new Date(ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { weekday: 'long' });
    return new Date(ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'long' });
  }
  function favURL(site) { let h = ''; try { h = new URL(site).host; } catch { return ''; } return h ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64` : ''; }
  function favicon(a) { const u = favURL(a.site || a.url); return u ? `<img class="nw-fav" src="${u}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''; }

  /* ── data ── */
  async function ensureIndex() {
    if (_index) return _index;
    _index = await _fetchJSON(BASE + 'index.json');
    (_index.sources || []).forEach(s => { if (s.site) _srcSite[s.name] = s.site; });
    return _index;
  }
  async function loadTopic(id) {
    if (_cache[id]) return _cache[id];
    const data = await _fetchJSON(BASE + `topic-${id}.json`);
    _cache[id] = data.articles || [];
    return _cache[id];
  }

  /* date + search filter (NOT source) — used both for the list and to count
     per-feed matches so the feed counts always reflect the date filter. */
  function dateSearch(arts) {
    const minTs = _maxAge ? Date.now() - _maxAge * 3600000 : 0;
    const q = norm(_query);
    return arts.filter(a => {
      if (minTs && a.ts < minTs) return false;
      if (q && !(norm(a.title).includes(q) || norm(a.summary).includes(q) || norm(a.source).includes(q))) return false;
      return true;
    });
  }

  /* ════════════════════════════ CARDS ════════════════════════════ */
  function articleCard(a) {
    const top = a.topics && a.topics[0] || _topic;
    const chips = (a.topics || []).map(t => `<span class="nw-chip" style="--tc:${tColor(t)}">${tIcon(t)} ${esc(tLabel(t))}</span>`).join('');
    const thumb = a.image ? `<a class="nw-c-thumb" href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.image)}" alt="" loading="lazy" onerror="this.closest('.nw-c-thumb').remove()"></a>` : '';
    return `<article class="nw-card${a.image ? ' nw-has-img' : ''}" style="--tc:${tColor(top)}">
      ${thumb}
      <div class="nw-c-body">
        <div class="nw-c-top">${favicon(a)}<span class="nw-c-src">${esc(a.source)}</span><span class="nw-c-time" title="${esc(new Date(a.ts).toLocaleString())}">${esc(relTime(a.ts))}</span></div>
        <a class="nw-c-title" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>
        ${a.summary ? `<p class="nw-c-sum">${esc(a.summary)}</p>` : ''}
        <div class="nw-c-foot">${chips}<a class="nw-c-read" href="${esc(a.url)}" target="_blank" rel="noopener">${_t('Read', 'Ler')} ↗</a></div>
      </div>
    </article>`;
  }
  function articleListItem(a) {
    const top = a.topics && a.topics[0] || _topic;
    const thumb = a.image ? `<img class="nw-li-img" src="${esc(a.image)}" alt="" loading="lazy" onerror="this.closest('.nw-li').classList.add('nw-li--noimg'); this.remove()">` : '';
    return `<a class="nw-li${a.image ? '' : ' nw-li--noimg'}" href="${esc(a.url)}" target="_blank" rel="noopener" style="--tc:${tColor(top)}">
      ${thumb}
      <div class="nw-li-body">
        <div class="nw-li-top">${favicon(a)}<span class="nw-li-src">${esc(a.source)}</span><span class="nw-li-time">${esc(relTime(a.ts))}</span></div>
        <div class="nw-li-title">${esc(a.title)}</div>
        ${a.summary ? `<p class="nw-li-sum">${esc(a.summary)}</p>` : ''}
      </div>
    </a>`;
  }
  function articleRow(a) {
    const top = a.topics && a.topics[0] || _topic;
    return `<a class="nw-row" href="${esc(a.url)}" target="_blank" rel="noopener" style="--tc:${tColor(top)}">
      ${favicon(a)}<span class="nw-r-src">${esc(a.source)}</span><span class="nw-r-title">${esc(a.title)}</span><span class="nw-r-time">${esc(relTime(a.ts))}</span></a>`;
  }
  function skeleton(n = 9) {
    const c = `<div class="nw-skel"><span class="nw-sk-ln nw-sk-sm"></span><span class="nw-sk-ln"></span><span class="nw-sk-ln"></span><span class="nw-sk-ln nw-sk-md"></span></div>`;
    return `<div class="nw-loading"><span class="nw-spin"></span> ${_t('Loading…', 'A carregar…')}</div>` + Array.from({ length: n }, () => c).join('');
  }

  /* ════════════════════════════ RAILS ════════════════════════════ */
  function topicListHTML() {
    if (!_index) return '';
    let html = '', sep = false;
    for (const t of _index.topics) {
      if (!t.feature && !sep) { html += `<div class="nw-topic-sep"></div>`; sep = true; }
      html += `<button class="nw-topic${t.id === _topic ? ' active' : ''}" data-topic="${t.id}" style="--tc:${tColor(t.id)}">
        <span class="nw-topic-ic">${tIcon(t.id)}</span><span class="nw-topic-n">${esc(tLabel(t.id))}</span></button>`;
    }
    return html;
  }
  function renderTopics() {
    const el = document.getElementById('nw-topics');
    if (el) el.innerHTML = topicListHTML();
    const mob = document.getElementById('nw-topic-mob');
    if (mob) mob.innerHTML = `<span>${tIcon(_topic)} ${esc(tLabel(_topic))}</span> <span class="nw-tm-caret">▾</span>`;
  }

  function renderFeeds(dsFiltered) {
    const rail = document.getElementById('nw-rail');
    if (!rail) return;
    const counts = {};
    for (const a of dsFiltered) counts[a.source] = (counts[a.source] || 0) + 1;
    const names = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'pt'));
    const btn = (name, count, active) => {
      const ic = name ? (favURL(_srcSite[name]) ? `<img class="nw-fav" src="${favURL(_srcSite[name])}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '🗞️') : '🗞️';
      return `<button class="nw-src${active ? ' active' : ''}" data-src="${esc(name)}">${ic}<span class="nw-src-n">${esc(name || _t('All feeds', 'Todos os feeds'))}</span><span class="nw-src-c">${count}</span></button>`;
    };
    rail.innerHTML = `<div class="nw-rail-h"><span>📡 ${_t('Feeds', 'Feeds')}</span><button class="nw-rail-x" id="nw-rail-x" aria-label="${_t('Close', 'Fechar')}">✕</button></div>`
      + btn('', dsFiltered.length, !_source)
      + names.map(n => btn(n, counts[n], _source === n)).join('');
  }

  /* ════════════════════════════ MAIN RENDER ════════════════════════════ */
  async function renderTopic() {
    const grid = document.getElementById('nw-grid');
    const count = document.getElementById('nw-count');
    if (grid) grid.innerHTML = skeleton();
    let arts = [];
    try { arts = await loadTopic(_topic); }
    catch (e) { if (grid) grid.innerHTML = `<div class="nw-empty">😕 ${_t('Could not load this topic. Try again shortly.', 'Não foi possível carregar este tema. Tenta novamente daqui a pouco.')}</div>`; return; }

    const ds = dateSearch(arts);                                  /* date + search */
    const matching = _source ? ds.filter(a => a.source === _source) : ds;
    const shown = matching.slice(0, _limit);                      /* count-limit */

    if (grid) {
      grid.className = 'nw-grid nw-grid--' + _mode;
      grid.style.setProperty('--nw-scale', _scale);
      const render = _mode === 'list' ? articleRow : ((_mode === 'listimg' || _mode === 'listc') ? articleListItem : articleCard);
      if (!shown.length) {
        grid.innerHTML = `<div class="nw-empty">😶 ${_t('No articles in this range. Try a wider date filter.', 'Sem artigos neste intervalo. Experimenta um filtro de data maior.')}</div>`;
      } else {
        /* Insert day separators only when the results span more than one day. */
        const multiDay = new Set(shown.map(a => dayKey(a.ts))).size > 1;
        let html = '', last = null;
        for (const a of shown) {
          if (multiDay) { const dk = dayKey(a.ts); if (dk !== last) { html += `<div class="nw-day">${esc(dayLabel(a.ts))}</div>`; last = dk; } }
          html += render(a);
        }
        grid.innerHTML = html;
      }
    }
    if (count) {
      const unit = matching.length === 1 ? _t('article', 'artigo') : _t('articles', 'artigos');
      count.textContent = shown.length < matching.length ? `${shown.length} / ${matching.length} ${unit}` : `${matching.length} ${unit}`;
    }
    renderFeeds(ds);     /* feed counts reflect date+search (not the source filter) */
    renderTopics();
  }

  function renderMeta() {
    const up = document.getElementById('nw-updated');
    const foot = document.getElementById('nw-foot');
    if (up && _index) up.innerHTML = `🕒 ${_t('Updated', 'Atualizado')} ${esc(fmtUpdated(_index.generated))}`;
    if (foot && _index) foot.innerHTML = `${_index.total} ${_t('articles from', 'artigos de')} ${_index.feeds.ok}/${_index.feeds.total} ${_t('feeds', 'feeds')} · `
      + _t('Refreshed every 4h from your OPML subscriptions.', 'Atualizado a cada 4h a partir das tuas subscrições OPML.');
  }

  /* ════════════════════════════ SHELL ════════════════════════════ */
  function _buildShell(view) {
    view.innerHTML = `
      <div class="nw-wrap">
        <header class="nw-head">
          <div>
            <h1>🗞️ ${_t('News', 'Notícias')}</h1>
            <p class="nw-sub">${_t('Your RSS feeds, by topic — pick a topic on the left.', 'Os teus feeds RSS, por tema — escolhe um tema à esquerda.')}</p>
          </div>
          <div class="nw-updated" id="nw-updated"></div>
        </header>

        <div class="nw-toolbar">
          <input id="nw-q" class="nw-search" type="search" placeholder="${_t('Search headlines…', 'Pesquisar notícias…')}">
          <label class="nw-fl"><span>${_t('Date', 'Data')}</span>
            <select id="nw-date" class="nw-sel">${DATE_OPTS.map(([v, en, pt]) => `<option value="${v}"${v === String(_maxAge) ? ' selected' : ''}>${_t(en, pt)}</option>`).join('')}</select></label>
          <label class="nw-fl"><span>${_t('Show', 'Mostrar')}</span>
            <select id="nw-limit" class="nw-sel">${LIMIT_OPTS.map(([v, l]) => `<option value="${v}"${v === String(_limit) ? ' selected' : ''}>${l === '∞' ? _t('All', 'Todos') : l}</option>`).join('')}</select></label>
          <div class="nw-view" id="nw-view" role="group" aria-label="${_t('View mode', 'Modo de visualização')}">
            ${VIEW_MODES.map(([id, ic, en, pt]) => `<button class="nw-view-b${id === _mode ? ' active' : ''}" data-mode="${id}" title="${_t(en, pt)}" aria-label="${_t(en, pt)}">${ic}</button>`).join('')}
          </div>
          <div class="nw-dens-wrap">
            <button class="nw-icon-btn" id="nw-dens-btn" aria-label="${_t('Density', 'Densidade')}" title="${_t('Size & columns', 'Tamanho e colunas')}">⚙</button>
            <div class="nw-pop nw-dens" id="nw-dens" hidden>
              <label class="nw-pop-row"><span>${_t('Text size', 'Tamanho do texto')}</span>
                <input type="range" id="nw-scale" min="0.85" max="1.3" step="0.05" value="${_scale}"></label>
            </div>
          </div>
          <button class="nw-feeds-btn" id="nw-feeds-btn" aria-pressed="false">📡 ${_t('Feeds', 'Fontes')}</button>
          <span class="nw-count" id="nw-count"></span>
        </div>

        <button class="nw-topic-mob" id="nw-topic-mob" aria-haspopup="true"></button>

        <div class="nw-layout" id="nw-layout">
          <aside class="nw-topics" id="nw-topics" aria-label="${_t('Topics', 'Temas')}"></aside>
          <div class="nw-grid nw-grid--${_mode}" id="nw-grid"></div>
          <aside class="nw-rail" id="nw-rail" aria-label="${_t('Feeds', 'Feeds')}" hidden></aside>
        </div>

        <div class="nw-topic-pop" id="nw-topic-pop" hidden>
          <div class="nw-topic-pop-card">
            <div class="nw-topic-pop-h">${_t('Choose a topic', 'Escolher tema')} <button class="nw-rail-x" id="nw-topic-pop-x" aria-label="${_t('Close', 'Fechar')}">✕</button></div>
            <div class="nw-topic-pop-list" id="nw-topic-pop-list"></div>
          </div>
        </div>

        <footer class="nw-foot" id="nw-foot"></footer>
      </div>`;
    _wire(view);
  }

  /* ════════════════════════════ WIRING ════════════════════════════ */
  function goTopic(id) {
    closeTopicPop();
    if (!id || id === _topic) return;
    /* Topic lives in the URL (#noticias/<topic>) so refresh keeps the category. */
    location.hash = '#noticias/' + id;
  }
  function openTopicPop() {
    const pop = document.getElementById('nw-topic-pop');
    const list = document.getElementById('nw-topic-pop-list');
    if (!pop || !list) return;
    list.innerHTML = topicListHTML();
    pop.hidden = false;
  }
  function closeTopicPop() { const p = document.getElementById('nw-topic-pop'); if (p) p.hidden = true; }

  function _wire(view) {
    const onTopicClick = (e) => { const b = e.target.closest('.nw-topic'); if (b) goTopic(b.dataset.topic); };
    view.querySelector('#nw-topics').addEventListener('click', onTopicClick);
    view.querySelector('#nw-topic-pop-list').addEventListener('click', onTopicClick);
    view.querySelector('#nw-topic-mob').addEventListener('click', openTopicPop);
    view.querySelector('#nw-topic-pop-x').addEventListener('click', closeTopicPop);
    view.querySelector('#nw-topic-pop').addEventListener('click', (e) => { if (e.target.id === 'nw-topic-pop') closeTopicPop(); });
    view.querySelector('#nw-rail').addEventListener('click', (e) => {
      if (e.target.closest('#nw-rail-x')) { _toggleFeeds(false); return; }
      const b = e.target.closest('.nw-src'); if (!b) return;
      _source = b.dataset.src || '';
      renderTopic();
    });
    view.querySelector('#nw-feeds-btn').addEventListener('click', () => _toggleFeeds(!_feedsOpen));
    let qt;
    view.querySelector('#nw-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { _query = e.target.value; renderTopic(); }, 200); });
    view.querySelector('#nw-date').addEventListener('change', (e) => { _maxAge = parseInt(e.target.value, 10) || 0; renderTopic(); });
    view.querySelector('#nw-limit').addEventListener('change', (e) => { _limit = parseInt(e.target.value, 10) || 60; renderTopic(); });
    view.querySelector('#nw-view').addEventListener('click', (e) => {
      const b = e.target.closest('.nw-view-b'); if (!b) return;
      _mode = b.dataset.mode;
      try { localStorage.setItem('nw-mode', _mode); } catch {}
      view.querySelectorAll('#nw-view .nw-view-b').forEach(x => x.classList.toggle('active', x === b));
      renderTopic();
    });
    /* density popover */
    const densBtn = view.querySelector('#nw-dens-btn'), densPop = view.querySelector('#nw-dens');
    densBtn.addEventListener('click', (e) => { e.stopPropagation(); densPop.hidden = !densPop.hidden; });
    document.addEventListener('click', (e) => { if (densPop && !densPop.hidden && !e.target.closest('.nw-dens-wrap')) densPop.hidden = true; });
    view.querySelector('#nw-scale').addEventListener('input', (e) => {
      _scale = parseFloat(e.target.value) || 1;
      try { localStorage.setItem('nw-scale', _scale); } catch {}
      const g = document.getElementById('nw-grid'); if (g) g.style.setProperty('--nw-scale', _scale);
    });
  }

  function _toggleFeeds(open) {
    _feedsOpen = open;
    const rail = document.getElementById('nw-rail');
    const layout = document.getElementById('nw-layout');
    const btn = document.getElementById('nw-feeds-btn');
    if (rail) rail.hidden = !open;
    if (layout) layout.classList.toggle('nw-feeds-open', open);
    if (btn) { btn.classList.toggle('active', open); btn.setAttribute('aria-pressed', String(open)); }
  }

  /* ════════════════════════════ PUBLIC ════════════════════════════ */
  const validTopic = (id) => id && _index && _index.topics.some(t => t.id === id);

  async function show(sub) {
    const view = document.getElementById('view-noticias');
    if (!view) return;
    if (_inited) {
      /* URL changed to a different topic (refresh / back / topic click). */
      if (validTopic(sub) && sub !== _topic) { _topic = sub; _source = ''; closeTopicPop(); renderTopic(); }
      return;
    }
    view.innerHTML = `<div class="nw-wrap"><div class="nw-grid">${skeleton()}</div></div>`;
    try {
      await ensureIndex();
      _topic = validTopic(sub) ? sub : ((_index.topics[0] && _index.topics[0].id) || 'tecnologia');
      _buildShell(view);
      renderMeta();
      renderTopics();
      await renderTopic();
      _inited = true;
    } catch (e) {
      view.innerHTML = `<div class="nw-wrap"><div class="nw-empty">😕 ${_t('News are being generated. Check back in a few minutes.', 'As notícias estão a ser geradas. Volta daqui a uns minutos.')}</div></div>`;
    }
  }

  return { show };
})();
