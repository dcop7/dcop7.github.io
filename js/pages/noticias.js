/* ══════════════════════════════════════════════════════════════════
   NOTÍCIAS — source-centric discovery aggregator (Phase 1)
   Reads static JSON from data/news/ (built by build-news.mjs in a GitHub
   Action). NOT a chronological RSS reader: surfaces the most RELEVANT
   items per source using real, key-less signals (Hacker News points,
   Substack reactions); sources without a popularity signal stay
   chronological and are labelled as such (never invented metrics).

   Views: 🔥 Destaques · 📰 Fontes · 📩 Newsletters & Blogs · página por fonte
   (Hoje · 7 dias · 30 dias · Arquivo). Trends/clustering = Phase 2.
══════════════════════════════════════════════════════════════════ */
const NoticiasPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const BASE = 'data/news/';

  const TOPIC = {
    tecnologia: '💻', ia: '🧠', tldr: '📩', android: '📱', produtividade: '🧰',
    devops: '🧩', seguranca: '🔒', ciencia: '🔬', carros: '🚗', f1: '🏎️',
    gaming: '🎮', filmes: '🎬', trailers: '🎞️', factcheck: '✅',
    geral: '🇵🇹', mundo: '🌍', economia: '💶',
  };
  const TLABEL = {
    tecnologia: ['Technology', 'Tecnologia'], ia: ['AI', 'IA'], tldr: ['TLDR', 'TLDR'],
    android: ['Android', 'Android'], produtividade: ['Productivity', 'Produtividade'],
    devops: ['DevOps', 'DevOps'], seguranca: ['Security', 'Segurança'], ciencia: ['Science', 'Ciência'],
    carros: ['Cars', 'Carros'], f1: ['F1', 'F1 & Motorsport'], gaming: ['Gaming', 'Gaming'],
    filmes: ['Film & TV', 'Filmes & TV'], trailers: ['Trailers', 'Trailers'], factcheck: ['Fact Check', 'Fact Check'],
    geral: ['Portugal', 'Geral'], mundo: ['World', 'Mundo'], economia: ['Economy', 'Economia'],
  };
  const tIcon = (id) => TOPIC[id] || '🗞️';
  const tLabel = (id) => (TLABEL[id] ? _t(TLABEL[id][0], TLABEL[id][1]) : id);

  /* ── state ── */
  let _inited = false;
  let _sources = null, _highlights = null, _newsletters = null, _histIndex = null;
  const _srcCache = {}, _histCache = {};
  let _view = 'highlights', _win = 'today', _srcId = '', _srcTab = 'today';

  /* ── tiny helpers ── */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function getJSON(url) { const r = await fetch(BASE + url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000), l = _lang();
    if (s < 3600) { const m = Math.round(s / 60); return l === 'pt' ? `há ${m}m` : `${m}m ago`; }
    if (s < 86400) { const h = Math.round(s / 3600); return l === 'pt' ? `há ${h}h` : `${h}h ago`; }
    const d = Math.round(s / 86400); return l === 'pt' ? `há ${d}d` : `${d}d ago`;
  }
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };

  /* relevance badge — honest about WHERE the ranking came from */
  function badge(a) {
    if (a.signal === 'hn' && a.hn) return `<a class="nx-badge hot" href="${esc(a.hn.url)}" target="_blank" rel="noopener" title="${_t('Popularity from Hacker News', 'Popularidade via Hacker News')}">🔥 ${a.hn.points} pts${a.hn.comments ? ` · 💬 ${a.hn.comments}` : ''}</a>`;
    if (a.signal === 'eng' && a.eng) return `<span class="nx-badge eng" title="${_t('Engagement (reactions/comments)', 'Interação (reações/comentários)')}">❤ ${a.eng.reactions}${a.eng.comments ? ` · 💬 ${a.eng.comments}` : ''}</span>`;
    return `<span class="nx-badge plain" title="${_t('No popularity signal — chronological', 'Sem sinal de popularidade — cronológico')}">🕒 ${_t('recent', 'recente')}</span>`;
  }

  /* ── article card ── */
  function card(a, rank) {
    const thumb = a.image ? `<img class="nx-thumb" src="${esc(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
    const rk = rank ? `<span class="nx-rank">${rank}</span>` : '';
    const src = a.source ? `<span class="nx-src">${esc(a.source)}</span>` : '';
    const sum = a.summary ? `<p class="nx-sum">${esc(a.summary)}</p>` : '';
    return `<article class="nx-card">${rk}${thumb}<div class="nx-body">
      <a class="nx-title" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>
      ${sum}
      <div class="nx-meta">${src}<span class="nx-dot">·</span><span class="nx-time">${timeAgo(a.ts)}</span><span class="nx-sp"></span>${badge(a)}</div>
    </div></article>`;
  }

  /* ════════════════════ shell ════════════════════ */
  function shell(view) {
    const tab = (id, ico, en, pt) => `<button class="nx-tab${_view === id ? ' active' : ''}" data-view="${id}">${ico} ${_t(en, pt)}</button>`;
    const gen = _sources && _sources.generated ? `${_t('Updated', 'Atualizado')} ${timeAgo(Date.parse(_sources.generated))}` : '';
    view.innerHTML = `<div class="nx-wrap">
      <header class="nx-head">
        <div class="nx-tabs">
          ${tab('highlights', '🔥', 'Highlights', 'Destaques')}
          ${tab('sources', '📰', 'Sources', 'Fontes')}
          ${tab('newsletters', '📩', 'Newsletters', 'Newsletters')}
        </div>
        <span class="nx-gen">${gen}</span>
      </header>
      <main id="nx-main" class="nx-main"></main>
    </div>`;
    view.querySelectorAll('.nx-tab').forEach(b => b.addEventListener('click', () => { _view = b.dataset.view; _srcId = ''; renderMain(); syncTabs(); }));
  }
  function syncTabs() {
    document.querySelectorAll('.nx-tab').forEach(b => b.classList.toggle('active', b.dataset.view === _view));
  }
  const main = () => document.getElementById('nx-main');
  const loading = () => `<div class="nx-loading">${_t('Loading…', 'A carregar…')}</div>`;

  /* ════════════════════ Destaques ════════════════════ */
  async function renderHighlights() {
    const m = main(); m.innerHTML = loading();
    if (!_highlights) { try { _highlights = await getJSON('highlights.json'); } catch { m.innerHTML = empty(); return; } }
    const wins = [['today', 'Today', 'Hoje'], ['week', '7 days', '7 dias'], ['month', '30 days', '30 dias']];
    const items = _highlights[_win] || [];
    const seg = wins.map(([id, en, pt]) => `<button class="nx-seg${_win === id ? ' active' : ''}" data-win="${id}">${_t(en, pt)}</button>`).join('');
    m.innerHTML = `
      <div class="nx-section-h">
        <div><h2>🔥 ${_t('Highlights', 'Destaques')}</h2>
        <p class="nx-note">${_t('Most relevant across all news sources — ranked by real signals (Hacker News, engagement) then recency.', 'O mais relevante de todas as fontes noticiosas — ordenado por sinais reais (Hacker News, interação) e depois por recência.')}</p></div>
        <div class="nx-seg-group">${seg}</div>
      </div>
      <div class="nx-list">${items.length ? items.map((a, i) => card(a, i + 1)).join('') : `<div class="nx-empty-in">${_t('Nothing here for this window yet.', 'Ainda nada nesta janela.')}</div>`}</div>`;
    m.querySelectorAll('.nx-seg').forEach(b => b.addEventListener('click', () => { _win = b.dataset.win; renderHighlights(); }));
  }

  /* ════════════════════ Fontes ════════════════════ */
  async function renderSources() {
    const m = main(); m.innerHTML = loading();
    if (!_sources) { try { _sources = await getJSON('sources.json'); } catch { m.innerHTML = empty(); return; } }
    const all = _sources.sources.filter(s => s.count > 0);
    const news = all.filter(s => s.group === 'news');
    const blogs = all.filter(s => s.group === 'blog');

    /* news grouped by topic */
    const byTopic = {};
    for (const s of news) (byTopic[s.topic] ||= []).push(s);
    const topicOrder = Object.keys(TOPIC).filter(t => byTopic[t]);
    const newsHTML = topicOrder.map(tp => `
      <div class="nx-srcgroup">
        <h3 class="nx-srcgroup-h">${tIcon(tp)} ${tLabel(tp)}</h3>
        <div class="nx-srcgrid">${byTopic[tp].sort((a, b) => b.count - a.count).map(srcChip).join('')}</div>
      </div>`).join('');

    const blogsHTML = blogs.length ? `
      <div class="nx-srcgroup">
        <h3 class="nx-srcgroup-h">📩 ${_t('Newsletters & Blogs', 'Newsletters & Blogs')}</h3>
        <div class="nx-srcgrid">${blogs.sort((a, b) => b.count - a.count).map(s => srcChip(s, true)).join('')}</div>
      </div>` : '';

    m.innerHTML = `
      <div class="nx-section-h"><div><h2>📰 ${_t('Sources', 'Fontes')}</h2>
        <p class="nx-note">${_t('Click a source for its page: Today · 7 days · 30 days · Archive. ⚡ = has a real popularity signal.', 'Clica numa fonte para a sua página: Hoje · 7 dias · 30 dias · Arquivo. ⚡ = tem sinal de popularidade real.')}</p></div></div>
      <div class="nx-news-block">${newsHTML}</div>
      ${blogsHTML}`;
    m.querySelectorAll('[data-src]').forEach(el => el.addEventListener('click', () => openSource(el.dataset.src, el.dataset.blog === '1')));
  }
  function srcChip(s, blog) {
    const flag = s.pt ? '🇵🇹 ' : '';
    const sig = s.hasSignal ? `<span class="nx-sig" title="${_t('Has popularity signal', 'Tem sinal de popularidade')}">⚡</span>` : '';
    return `<button class="nx-srcchip" data-src="${esc(s.id)}" data-blog="${blog ? 1 : 0}">
      <span class="nx-srcname">${flag}${esc(s.name)}</span>
      <span class="nx-srcmeta">${sig}<span class="nx-srccount">${s.count}</span></span></button>`;
  }

  function openSource(id, blog) {
    if (blog) { _view = 'newsletters'; _srcId = id; syncTabs(); renderNewsletters(id); return; }
    _view = 'source'; _srcId = id; _srcTab = 'today'; syncTabs(); renderSource();
  }

  /* ════════════════════ Source page ════════════════════ */
  async function renderSource() {
    const m = main(); m.innerHTML = loading();
    let data;
    try { data = _srcCache[_srcId] || (_srcCache[_srcId] = await getJSON('source-' + _srcId + '.json')); }
    catch { m.innerHTML = empty(); return; }
    const tabs = [['today', 'Today', 'Hoje', 24], ['week', '7 days', '7 dias', 168], ['month', '30 days', '30 dias', 720], ['archive', 'Archive', 'Arquivo', 0]];
    const tabBar = tabs.map(([id, en, pt]) => `<button class="nx-seg${_srcTab === id ? ' active' : ''}" data-stab="${id}">${_t(en, pt)}</button>`).join('');
    let body;
    if (_srcTab === 'archive') {
      body = `<div id="nx-arch" class="nx-list">${loading()}</div>`;
    } else {
      const hours = tabs.find(t => t[0] === _srcTab)[3];
      const cut = Date.now() - hours * 3600000;
      const items = data.items.filter(a => a.ts >= cut);
      const sig = items.filter(a => a.signal !== 'date').sort((x, y) => y.score - x.score || y.ts - x.ts);
      const dat = items.filter(a => a.signal === 'date').sort((x, y) => y.ts - x.ts);
      const ordered = [...sig, ...dat];
      const note = data.hasSignal
        ? _t('Ranked by popularity (Hacker News) then recency.', 'Ordenado por popularidade (Hacker News) e depois recência.')
        : _t('No popularity signal for this source — shown chronologically.', 'Sem sinal de popularidade nesta fonte — mostrado por ordem cronológica.');
      body = `<p class="nx-note nx-note-src">${note}</p><div class="nx-list">${ordered.length ? ordered.map((a, i) => card(a, sig.length && i < sig.length ? i + 1 : 0)).join('') : `<div class="nx-empty-in">${_t('No articles in this window.', 'Sem artigos nesta janela.')}</div>`}</div>`;
    }
    m.innerHTML = `
      <div class="nx-srchead">
        <button class="nx-back" id="nx-back">← ${_t('Sources', 'Fontes')}</button>
        <h2>${esc(data.name)}</h2>
        <div class="nx-srchead-meta">${tIcon(data.topic)} ${tLabel(data.topic)} · <a href="${esc(data.site)}" target="_blank" rel="noopener">${esc(host(data.site) || _t('site', 'site'))} ↗</a></div>
      </div>
      <div class="nx-seg-group nx-seg-wide">${tabBar}</div>
      ${body}`;
    document.getElementById('nx-back').addEventListener('click', () => { _view = 'sources'; _srcId = ''; syncTabs(); renderSources(); });
    m.querySelectorAll('[data-stab]').forEach(b => b.addEventListener('click', () => { _srcTab = b.dataset.stab; renderSource(); }));
    if (_srcTab === 'archive') renderArchive(data);
  }

  async function renderArchive(data) {
    const box = document.getElementById('nx-arch'); if (!box) return;
    if (!_histIndex) { try { _histIndex = await getJSON('history/index.json'); } catch { _histIndex = { dates: [] }; } }
    const dates = (_histIndex.dates || []).slice(-30).reverse();
    if (!dates.length) { box.innerHTML = `<div class="nx-empty-in">${_t('The archive builds up over time — daily snapshots accumulate as the aggregator runs.', 'O arquivo cresce com o tempo — os instantâneos diários acumulam-se à medida que o agregador corre.')}</div>`; return; }
    const snaps = await Promise.all(dates.map(async d => {
      try { return _histCache[d] || (_histCache[d] = await getJSON('history/' + d + '.json')); } catch { return null; }
    }));
    const blocks = [];
    for (const snap of snaps) {
      if (!snap) continue;
      const items = (snap.sources && snap.sources[_srcId]) || [];
      if (!items.length) continue;
      const dl = new Date(snap.date + 'T00:00').toLocaleDateString(_lang() === 'pt' ? 'pt-PT' : 'en-GB', { day: 'numeric', month: 'long' });
      blocks.push(`<div class="nx-arch-day"><h4 class="nx-arch-date">${dl}</h4>${items.map(a => card(a, 0)).join('')}</div>`);
    }
    box.innerHTML = blocks.length ? blocks.join('') : `<div class="nx-empty-in">${_t('No archived highlights for this source yet.', 'Ainda sem destaques arquivados para esta fonte.')}</div>`;
  }

  /* ════════════════════ Newsletters & Blogs ════════════════════ */
  async function renderNewsletters(focusId) {
    const m = main(); m.innerHTML = loading();
    if (!_newsletters) { try { _newsletters = await getJSON('newsletters.json'); } catch { m.innerHTML = empty(); return; } }
    let list = _newsletters.sources.filter(s => s.count > 0);
    if (focusId) { const f = list.find(s => s.id === focusId); if (f) list = [f, ...list.filter(s => s !== f)]; }
    const blocks = list.map(nl => {
      const latest = nl.items[0];
      let inner;
      if (nl.tldr && latest && latest.headlines && latest.headlines.length) {
        const heads = latest.headlines.map(h => `<li><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a> <span class="nx-hsrc">${esc(host(h.url))}</span></li>`).join('');
        inner = `<a class="nx-nl-issue" href="${esc(latest.url)}" target="_blank" rel="noopener">${esc(latest.title)} ↗</a>
          <ul class="nx-nl-heads">${heads}</ul>
          ${nl.items.length > 1 ? `<details class="nx-nl-more"><summary>${_t('Earlier issues', 'Edições anteriores')}</summary>${nl.items.slice(1, 8).map(it => `<a class="nx-nl-old" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)} <span class="nx-time">${timeAgo(it.ts)}</span></a>`).join('')}</details>` : ''}`;
      } else {
        inner = `<div class="nx-nl-items">${nl.items.slice(0, 8).map(it => {
          const eng = it.eng ? `<span class="nx-badge eng">❤ ${it.eng.reactions}${it.eng.comments ? ` · 💬 ${it.eng.comments}` : ''}</span>` : '';
          const sum = it.summary ? `<p class="nx-sum">${esc(it.summary)}</p>` : '';
          return `<div class="nx-nl-item"><a class="nx-title" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>${sum}<div class="nx-meta"><span class="nx-time">${timeAgo(it.ts)}</span><span class="nx-sp"></span>${eng}</div></div>`;
        }).join('')}</div>`;
      }
      const kind = nl.tldr ? 'TLDR' : nl.substack ? 'Substack' : _t('Blog', 'Blog');
      return `<section class="nx-nl${focusId === nl.id ? ' focus' : ''}">
        <div class="nx-nl-h"><h3>${esc(nl.name)}</h3><span class="nx-nl-kind">${kind}</span>
          <a class="nx-nl-site" href="${esc(nl.site)}" target="_blank" rel="noopener">${esc(host(nl.site))} ↗</a></div>
        ${inner}</section>`;
    }).join('');
    m.innerHTML = `
      <div class="nx-section-h"><div><h2>📩 ${_t('Newsletters & Blogs', 'Newsletters & Blogs')}</h2>
        <p class="nx-note">${_t("Curated editorial content. TLDR shows the day's story headlines (links); summaries stay on the original site.", 'Conteúdo editorial já curado. A TLDR mostra as manchetes do dia (links); os resumos ficam no site original.')}</p></div></div>
      <div class="nx-nl-grid">${blocks}</div>`;
  }

  function empty() { return `<div class="nx-empty">😕 ${_t('News are being generated. Check back in a few minutes.', 'As notícias estão a ser geradas. Volta daqui a uns minutos.')}</div>`; }

  /* ════════════════════ dispatch ════════════════════ */
  function renderMain() {
    if (_view === 'highlights') return renderHighlights();
    if (_view === 'sources') return renderSources();
    if (_view === 'source') return renderSource();
    if (_view === 'newsletters') return renderNewsletters(_srcId || null);
  }

  /* ════════════════════ public ════════════════════ */
  async function show(sub) {
    const view = document.getElementById('view-noticias');
    if (!view) return;
    /* resolve sub → a view or a specific source; returns true if openSource handled it */
    const resolve = () => {
      if (['sources', 'newsletters', 'highlights'].includes(sub)) { _view = sub; _srcId = ''; return false; }
      if (sub && _sources) { const s = _sources.sources.find(x => x.id === sub); if (s) { openSource(s.id, s.group === 'blog'); return true; } }
      return false;
    };
    if (_inited) {
      if (sub) { if (!resolve()) { syncTabs(); renderMain(); } }
      return;
    }
    view.innerHTML = `<div class="nx-wrap"><div class="nx-loading">${_t('Loading…', 'A carregar…')}</div></div>`;
    try {
      _sources = await getJSON('sources.json');
      shell(view);
      if (!resolve()) await renderMain();
      _inited = true;
    } catch (e) {
      view.innerHTML = `<div class="nx-wrap">${empty()}</div>`;
    }
  }

  document.addEventListener('langchange', () => { if (_inited && document.getElementById('view-noticias')?.classList.contains('active')) { syncTabs(); renderMain(); } });

  return { show };
})();
