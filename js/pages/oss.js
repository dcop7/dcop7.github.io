/* ══════════════════════════════════════════════════════════════════
   DESCOBRIR TECH (oss) — open-source discovery
   Hub of horizontal rails (trending / new / community / gems / popular /
   collections) + advanced search/filters + per-project detail page.
   Reads only static JSON built by data/oss/build-oss.mjs (a GitHub Action) —
   no browser API calls, no keys, offline-first. Mirrors the F1/News page style.
   Data: data/oss/index.json · projects.json · p/<owner__name>.json
   ══════════════════════════════════════════════════════════════════ */
const OssPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  let _root = null, _index = null, _projects = null, _detail = {};
  let _filters = null;
  let _shown = 60;

  function defFilters() { return { q: '', lang: '', cat: '', sort: 'rel', onlyNew: false, hasHn: false, maxStars: 0, license: '' }; }

  /* ── formatting ── */
  const nf = n => (n || 0).toLocaleString(_lang() === 'en' ? 'en' : 'pt-PT');
  function fmt(n) {
    n = n || 0;
    if (n >= 1000) { const k = n / 1000; return (k >= 10 ? Math.round(k) : k.toFixed(1).replace('.0', '')) + 'k'; }
    return '' + n;
  }
  function ago(d) {
    const t = Date.parse(d); if (!t) return '';
    const days = Math.floor((Date.now() - t) / 86400e3);
    if (days <= 0) return _t('today', 'hoje');
    if (days === 1) return _t('yesterday', 'ontem');
    if (days < 30) return _t(days + 'd ago', 'há ' + days + ' dias');
    const mo = Math.floor(days / 30);
    if (mo < 12) return _t(mo + 'mo ago', 'há ' + mo + (mo === 1 ? ' mês' : ' meses'));
    const y = Math.floor(days / 365);
    return _t(y + 'y ago', 'há ' + y + (y > 1 ? ' anos' : ' ano'));
  }

  /* ── data loaders (cached) ── */
  async function ensureIndex() { if (_index) return _index; _index = await fetch('data/oss/index.json').then(r => r.json()); return _index; }
  async function ensureProjects() { if (_projects) return _projects; const d = await fetch('data/oss/projects.json').then(r => r.json()); _projects = d.projects || []; return _projects; }
  async function ensureDetail(id) { if (_detail[id] !== undefined) return _detail[id]; _detail[id] = await fetch('data/oss/p/' + id + '.json').then(r => r.ok ? r.json() : null).catch(() => null); return _detail[id]; }

  const catOf = id => (_index ? _index.categories.find(c => c.id === id) : null);
  const catLabel = id => { const c = catOf(id); return c ? (_lang() === 'en' ? c.label_en : c.label) : id; };

  /* ── project card ── */
  function avatar(owner, cls) {
    const mono = (owner || '?')[0].toUpperCase();
    return `<span class="${cls}">${esc(mono)}<img loading="lazy" src="https://github.com/${encodeURIComponent(owner)}.png?size=120" alt="" onerror="this.remove()"></span>`;
  }
  function cardHTML(p) {
    const delta = p.d7 > 0
      ? `<span class="oss-delta${p.boot ? ' boot' : ''}" title="${_t('recent star growth', 'crescimento recente de estrelas')}">▲ ${fmt(p.d7)}${p.boot ? '~' : ''}/${_t('wk', 'sem')}</span>`
      : '';
    const hn = p.hn ? `<span class="oss-hnbadge" title="Hacker News">Y ${fmt(p.hn.points)}</span>` : '';
    return `<button class="oss-card" data-proj="${esc(p.id)}">
      <div class="oss-card-top">
        ${avatar(p.owner, 'oss-card-ava')}
        <div class="oss-card-id"><div class="oss-card-owner">${esc(p.owner)}</div><div class="oss-card-name">${esc(p.name)}</div></div>
        ${p.isNew ? `<span class="oss-card-new">${_t('new', 'novo')}</span>` : ''}
      </div>
      <div class="oss-card-desc">${esc(p.desc || '')}</div>
      ${(p.topics || []).length ? `<div class="oss-card-tags">${p.topics.slice(0, 3).map(t => `<span class="oss-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="oss-card-foot">
        ${p.lang ? `<span class="oss-lang"><span class="oss-lang-dot" style="--d:${esc(p.langColor || '#8b949e')}"></span>${esc(p.lang)}</span>` : ''}
        <span class="oss-stat">★ ${fmt(p.stars)}</span>
        <span class="oss-stat">⑂ ${fmt(p.forks)}</span>
        ${delta}${hn}
      </div>
    </button>`;
  }

  /* ════════════════════════════ HUB ════════════════════════════ */
  function railHTML(emoji, title, sub, items, railKey) {
    if (!items || !items.length) return '';
    return `<section class="oss-rail">
      <div class="oss-rail-hd"><h2>${emoji} ${esc(title)}</h2><p>${esc(sub)}</p>
        <button class="oss-rail-more" data-rail="${railKey}">${_t('See all', 'Ver todos')} →</button></div>
      <div class="oss-rail-track">${items.map(cardHTML).join('')}</div>
    </section>`;
  }

  function renderHub() {
    const ix = _index, b = ix.bundles;
    const cats = ix.categories.filter(c => c.count > 0)
      .map(c => `<button class="oss-cat" data-cat="${c.id}"><span>${c.emoji}</span>${esc(_lang() === 'en' ? c.label_en : c.label)} <b>${c.count}</b></button>`).join('');

    const rails = [
      railHTML('🔥', _t('Trending', 'Em tendência'), _t('Growing fast right now', 'A crescer depressa agora'), b.trending, 'trending'),
      railHTML('🚀', _t('New & promising', 'Novos promissores'), _t('Recent projects gaining traction', 'Projetos recentes com tração'), b.new, 'new'),
      railHTML('🧠', _t('Community picks', 'Descobertas da comunidade'), _t('Buzzing on Hacker News', 'Em destaque no Hacker News'), b.community, 'community'),
      railHTML('💎', _t('Hidden gems', 'Joias escondidas'), _t('High quality, still under the radar', 'Qualidade alta, ainda pouco conhecidos'), b.gems, 'gems'),
      railHTML('🏆', _t('Most popular', 'Mais populares'), _t('All-time favourites', 'Os favoritos de sempre'), b.popular, 'popular'),
    ].join('');

    const coll = (b.collections || []).map(c => `
      <button class="oss-coll" data-cat="${esc(c.category)}">
        <span class="oss-coll-em">${c.emoji}</span>
        <span class="oss-coll-name">${esc(c.label)}</span>
        <span class="oss-coll-sub">${c.items.length} ${_t('projects', 'projetos')}</span>
        <span class="oss-coll-names">${c.items.slice(0, 5).map(i => esc(i.name)).join(' · ')}</span>
      </button>`).join('');
    const collSec = coll ? `<section class="oss-rail"><div class="oss-rail-hd"><h2>⭐ ${_t('Collections', 'Coleções')}</h2><p>${_t('Curated from Awesome Lists', 'Curadas de Awesome Lists')}</p></div><div class="oss-coll-grid">${coll}</div></section>` : '';

    _root.innerHTML = `<div class="oss-wrap">
      <header class="oss-hero">
        <h1>⚡ ${_t('Tech Discovery', 'Descobrir Tech')}</h1>
        <p>${_t('Discover open-source projects that are exploding, brand-new tools and hidden gems — from GitHub, Hacker News and the best Awesome Lists.', 'Descobre projetos open source a explodir, ferramentas acabadas de sair e joias escondidas — do GitHub, Hacker News e das melhores Awesome Lists.')}</p>
        <div class="oss-hero-row">
          <label class="oss-search"><span aria-hidden="true">🔍</span><input id="oss-q" type="search" placeholder="${_t('Search projects, languages, topics…', 'Pesquisar projetos, linguagens, tópicos…')}" autocomplete="off" aria-label="${_t('Search', 'Pesquisar')}"></label>
          <button class="oss-btn oss-btn-accent" id="oss-surprise">🎲 ${_t('Surprise me', 'Surpreende-me')}</button>
        </div>
        <div class="oss-meta">
          <span><b>${nf(ix.count)}</b> ${_t('projects', 'projetos')}</span>
          <span>${ix.categories.length} ${_t('categories', 'categorias')} · ${ix.languages.length} ${_t('languages', 'linguagens')}</span>
          <span>${_t('Updated', 'Atualizado')} ${ago(ix.generatedAt)}</span>
          ${!ix.authed ? `<span title="${_t('Built without a token — full catalog comes from the daily Action', 'Construído sem token — o catálogo completo vem da Action diária')}">⚠ ${_t('seed data', 'dados iniciais')}</span>` : ''}
        </div>
      </header>
      <div class="oss-cats">${cats}</div>
      ${rails}
      ${collSec}
    </div>`;
    wireCommon();
    const q = _root.querySelector('#oss-q');
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && q.value.trim()) { _filters = defFilters(); _filters.q = q.value.trim(); location.hash = 'oss/search'; } });
    _root.querySelector('#oss-surprise').onclick = surprise;
    _root.querySelectorAll('[data-rail]').forEach(btn => btn.onclick = () => {
      _filters = defFilters();
      const k = btn.dataset.rail;
      if (k === 'trending') _filters.sort = 'vel';
      else if (k === 'new') { _filters.onlyNew = true; _filters.sort = 'vel'; }
      else if (k === 'community') { _filters.hasHn = true; _filters.sort = 'hn'; }
      else if (k === 'gems') { _filters.maxStars = 5000; _filters.sort = 'rel'; }
      else if (k === 'popular') _filters.sort = 'stars';
      location.hash = 'oss/search';
    });
  }

  /* ════════════════════════════ SEARCH ════════════════════════════ */
  function applyFilters() {
    let list = _projects.slice();
    const f = _filters;
    if (f.cat) list = list.filter(p => (p.cats || []).includes(f.cat));
    if (f.lang) list = list.filter(p => p.lang === f.lang);
    if (f.onlyNew) list = list.filter(p => p.isNew);
    if (f.hasHn) list = list.filter(p => p.hn);
    if (f.maxStars) list = list.filter(p => p.stars <= f.maxStars);
    if (f.license) list = list.filter(p => p.license === f.license);
    const q = norm(f.q);
    if (q) list = list.filter(p => norm(p.name + ' ' + p.owner + ' ' + (p.desc || '') + ' ' + (p.topics || []).join(' ') + ' ' + (p.lang || '')).includes(q));
    const sorters = {
      rel: (a, b) => b.score - a.score,
      stars: (a, b) => b.stars - a.stars,
      vel: (a, b) => (b.d7 - a.d7) || (b.stars - a.stars),
      recent: (a, b) => Date.parse(b.pushed) - Date.parse(a.pushed),
      new: (a, b) => Date.parse(b.created) - Date.parse(a.created),
    };
    list.sort(sorters[f.sort] || sorters.rel);
    return list;
  }

  function renderSearch() {
    _root.innerHTML = `<div class="oss-wrap"><div class="oss-loading"><div class="ex-loading-spinner"></div><div>${_t('Loading…', 'A carregar…')}</div></div></div>`;
    ensureProjects().then(() => {
      const ix = _index, f = _filters;
      const langOpts = ['<option value="">' + _t('All languages', 'Todas as linguagens') + '</option>']
        .concat(ix.languages.map(l => `<option value="${esc(l.name)}"${f.lang === l.name ? ' selected' : ''}>${esc(l.name)} (${l.count})</option>`)).join('');
      const catOpts = ['<option value="">' + _t('All categories', 'Todas as categorias') + '</option>']
        .concat(ix.categories.filter(c => c.count).map(c => `<option value="${esc(c.id)}"${f.cat === c.id ? ' selected' : ''}>${c.emoji} ${esc(_lang() === 'en' ? c.label_en : c.label)} (${c.count})</option>`)).join('');
      const licenses = [...new Set(_projects.map(p => p.license).filter(Boolean))].sort();
      const licOpts = ['<option value="">' + _t('Any license', 'Qualquer licença') + '</option>']
        .concat(licenses.map(l => `<option value="${esc(l)}"${f.license === l ? ' selected' : ''}>${esc(l)}</option>`)).join('');
      const sortOpts = [['rel', _t('Relevance', 'Relevância')], ['vel', _t('Star velocity', 'Velocidade de estrelas')], ['stars', _t('Stars', 'Estrelas')], ['recent', _t('Recently active', 'Atividade recente')], ['new', _t('Newest', 'Mais recentes')]]
        .map(([v, l]) => `<option value="${v}"${f.sort === v ? ' selected' : ''}>${esc(l)}</option>`).join('');

      _root.innerHTML = `<div class="oss-wrap">
        <div class="oss-topbar">
          <button class="oss-back" id="oss-back">← ${_t('Discover', 'Descobrir')}</button>
          <label class="oss-search" style="flex:1"><span aria-hidden="true">🔍</span><input id="oss-q" type="search" value="${esc(f.q)}" placeholder="${_t('Search…', 'Pesquisar…')}" autocomplete="off"></label>
        </div>
        <div class="oss-filters">
          <select id="oss-f-cat">${catOpts}</select>
          <select id="oss-f-lang">${langOpts}</select>
          <select id="oss-f-lic">${licOpts}</select>
          <select id="oss-f-sort">${sortOpts}</select>
          <label class="oss-chk"><input type="checkbox" id="oss-f-new"${f.onlyNew ? ' checked' : ''}> ${_t('New only', 'Só novos')}</label>
          <label class="oss-chk"><input type="checkbox" id="oss-f-hn"${f.hasHn ? ' checked' : ''}> Hacker News</label>
          ${f.maxStars ? `<label class="oss-chk"><input type="checkbox" id="oss-f-gem" checked> ${_t('< 5k stars', '< 5k estrelas')}</label>` : ''}
        </div>
        <div class="oss-count" id="oss-count"></div>
        <div class="oss-grid" id="oss-grid"></div>
        <div class="oss-more-wrap" id="oss-more"></div>
      </div>`;

      _shown = 60;
      paintResults();
      wireCommon();
      const q = _root.querySelector('#oss-q');
      let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { _filters.q = q.value.trim(); _shown = 60; paintResults(); }, 160); });
      _root.querySelector('#oss-back').onclick = () => { location.hash = 'oss'; };
      const bind = (id, fn) => { const el = _root.querySelector(id); if (el) el.onchange = e => { fn(e.target); _shown = 60; paintResults(); }; };
      bind('#oss-f-cat', t => _filters.cat = t.value);
      bind('#oss-f-lang', t => _filters.lang = t.value);
      bind('#oss-f-lic', t => _filters.license = t.value);
      bind('#oss-f-sort', t => _filters.sort = t.value);
      bind('#oss-f-new', t => _filters.onlyNew = t.checked);
      bind('#oss-f-hn', t => _filters.hasHn = t.checked);
      bind('#oss-f-gem', t => _filters.maxStars = t.checked ? 5000 : 0);
    }).catch(failLoad);
  }

  function paintResults() {
    const list = applyFilters();
    const grid = _root.querySelector('#oss-grid');
    const count = _root.querySelector('#oss-count');
    const more = _root.querySelector('#oss-more');
    if (!grid) return;
    count.textContent = `${nf(list.length)} ${_t('projects', 'projetos')}`;
    grid.innerHTML = list.slice(0, _shown).map(cardHTML).join('') || `<div class="oss-empty">${_t('No projects match your filters.', 'Nenhum projeto corresponde aos filtros.')}</div>`;
    more.innerHTML = list.length > _shown ? `<button class="oss-btn" id="oss-loadmore">${_t('Load more', 'Carregar mais')} (${nf(list.length - _shown)})</button>` : '';
    const lm = _root.querySelector('#oss-loadmore');
    if (lm) lm.onclick = () => { _shown += 60; paintResults(); };
  }

  /* ════════════════════════════ DETAIL ════════════════════════════ */
  function statBox(v, k) { return `<div class="oss-statbox"><div class="v">${v}</div><div class="k">${esc(k)}</div></div>`; }

  function starChart(series) {
    if (!series || series.length < 2) return `<div class="oss-chart-note">${_t('Star history will appear as daily snapshots accumulate.', 'O histórico de estrelas aparece à medida que os snapshots diários acumulam.')}</div>`;
    const W = 600, H = 120, pad = 6;
    const xs = series.map(p => Date.parse(p[0]));
    const ys = series.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sx = t => pad + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * (W - 2 * pad);
    const sy = v => H - pad - (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0)) * (H - 2 * pad);
    const pts = series.map(p => `${sx(Date.parse(p[0])).toFixed(1)},${sy(p[1]).toFixed(1)}`);
    const area = `M${pts[0]} L${pts.join(' L')} L${sx(x1).toFixed(1)},${H - pad} L${sx(x0).toFixed(1)},${H - pad} Z`;
    const gained = ys[ys.length - 1] - ys[0];
    return `<svg class="oss-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="star history">
        <defs><linearGradient id="ossg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#ossg)"/>
        <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <div class="oss-chart-note">${_t('Gained', 'Ganhou')} <b style="color:#34d399">+${nf(gained)}</b> ★ ${_t('over the tracked period', 'no período registado')}.</div>`;
  }

  function renderDetail(id) {
    _root.innerHTML = `<div class="oss-wrap"><div class="oss-loading"><div class="ex-loading-spinner"></div><div>${_t('Loading…', 'A carregar…')}</div></div></div>`;
    ensureDetail(id).then(d => {
      if (!d) { _root.innerHTML = `<div class="oss-wrap"><button class="oss-back" id="oss-back">← ${_t('Discover', 'Descobrir')}</button><div class="oss-empty">${_t('Project not found.', 'Projeto não encontrado.')}</div></div>`; const b = _root.querySelector('#oss-back'); if (b) b.onclick = () => location.hash = 'oss'; return; }
      const langs = d.langs || [];
      const langbar = langs.length ? `<div class="oss-langbar">${langs.map(l => `<span style="width:${l.pct}%;background:${esc(l.color || '#8b949e')}"></span>`).join('')}</div>
        <div class="oss-langlegend">${langs.map(l => `<span><span class="oss-lang-dot" style="--d:${esc(l.color || '#8b949e')}"></span>${esc(l.name)} ${l.pct}%</span>`).join('')}</div>` : `<p class="oss-chart-note">${_t('Language breakdown is added by the authenticated build.', 'A repartição por linguagem é adicionada pela build autenticada.')}</p>`;
      const hn = (d.hnPosts || []).length ? d.hnPosts.map(h => `<a class="oss-hnpost" href="${esc(h.url || ('https://news.ycombinator.com/item?id=' + h.objectID))}" target="_blank" rel="noopener"><div class="t">${esc(h.title)}</div><div class="m">▲ ${nf(h.points)} ${_t('points', 'pontos')} · 💬 ${nf(h.comments)} · ${ago(h.date)} · <span style="color:var(--accent)">${_t('discuss ↗', 'discutir ↗')}</span></div></a>`).join('') : '';
      const awe = (d.awesomeIn || []).length ? `<div class="oss-awe-chips">${d.awesomeIn.map(a => `<span class="oss-awe">${a.emoji || '⭐'} ${esc(a.label)}${a.heading && a.heading !== a.label ? ' · ' + esc(a.heading) : ''}</span>`).join('')}</div>` : '';
      const related = (((_index.bundles.topByCat || {})[(d.cats || [])[0]]) || []).filter(p => p.id !== id).slice(0, 12);

      _root.innerHTML = `<div class="oss-wrap"><div class="oss-detail">
        <div class="oss-topbar"><button class="oss-back" id="oss-back">← ${_t('Discover', 'Descobrir')}</button></div>
        <div class="oss-d-head">
          ${avatar(d.owner, 'oss-d-ava')}
          <div class="oss-d-titles">
            <div class="oss-d-owner">${esc(d.owner)} /</div>
            <div class="oss-d-name">${esc(d.name)}</div>
          </div>
        </div>
        <div class="oss-d-badges">
          ${d.lang ? `<span class="oss-pill"><span class="oss-lang-dot" style="--d:${esc(d.langColor || '#8b949e')}"></span>${esc(d.lang)}</span>` : ''}
          ${d.license ? `<span class="oss-pill">⚖ ${esc(d.license)}</span>` : ''}
          ${d.isNew ? `<span class="oss-pill" style="color:#34d399">🚀 ${_t('New', 'Novo')}</span>` : ''}
          ${d.d7 > 0 ? `<span class="oss-pill" style="color:#34d399">▲ ${fmt(d.d7)}${d.boot ? '~' : ''} ★/${_t('wk', 'sem')}</span>` : ''}
          ${(d.cats || []).map(c => `<span class="oss-pill" data-cat="${esc(c)}" style="cursor:pointer">${esc(catOf(c)?.emoji || '#')} ${esc(catLabel(c))}</span>`).join('')}
        </div>
        <div class="oss-d-actions">
          <a class="oss-btn oss-btn-accent" href="${esc(d.ghUrl)}" target="_blank" rel="noopener">${_t('Open on GitHub', 'Abrir no GitHub')} ↗</a>
          ${d.homepage ? `<a class="oss-btn" href="${esc(d.homepage)}" target="_blank" rel="noopener">🌐 ${_t('Website', 'Website')}</a>` : ''}
          <button class="oss-btn" id="oss-clone">📋 ${_t('Copy clone', 'Copiar clone')}</button>
        </div>
        <p class="oss-d-desc">${esc(d.descFull || d.desc || '')}</p>

        <section class="oss-sec"><h3>📊 ${_t('Popularity', 'Popularidade')}</h3>
          <div class="oss-stats-grid">
            ${statBox('★ ' + nf(d.stars), _t('Stars', 'Estrelas'))}
            ${statBox('⑂ ' + nf(d.forks), 'Forks')}
            ${d.watchers != null ? statBox('👁 ' + nf(d.watchers), 'Watchers') : ''}
            ${statBox('⊙ ' + nf(d.issues), _t('Open issues', 'Issues abertas'))}
          </div></section>

        <section class="oss-sec"><h3>🧩 ${_t('Technology', 'Tecnologia')}</h3>${langbar}</section>

        <section class="oss-sec"><h3>📈 ${_t('Evolution', 'Evolução')}</h3>${starChart(d.starsSeries)}</section>

        ${hn ? `<section class="oss-sec"><h3>🧠 ${_t('On Hacker News', 'No Hacker News')}</h3>${hn}</section>` : ''}
        ${awe ? `<section class="oss-sec"><h3>⭐ ${_t('Featured in', 'Aparece em')}</h3>${awe}</section>` : ''}

        <section class="oss-sec"><h3>🗓️ ${_t('Timeline', 'Datas')}</h3>
          <div class="oss-stats-grid">
            ${statBox(esc((d.created || '').slice(0, 7)), _t('Created', 'Criado'))}
            ${statBox(ago(d.pushed), _t('Last push', 'Último push'))}
          </div></section>

        ${related.length ? `<section class="oss-rail"><div class="oss-rail-hd"><h2>🔗 ${_t('Related', 'Relacionados')}</h2></div><div class="oss-rail-track">${related.map(cardHTML).join('')}</div></section>` : ''}
      </div></div>`;

      wireCommon();
      _root.querySelector('#oss-back').onclick = () => { if (history.length > 1) history.back(); else location.hash = 'oss'; };
      const clone = _root.querySelector('#oss-clone');
      if (clone) clone.onclick = () => { navigator.clipboard?.writeText(`git clone ${d.ghUrl}.git`).then(() => { clone.textContent = '✓ ' + _t('Copied', 'Copiado'); setTimeout(() => clone.textContent = '📋 ' + _t('Copy clone', 'Copiar clone'), 1500); }); };
    }).catch(failLoad);
  }

  /* ── shared wiring (card clicks, category pills) ── */
  function wireCommon() {
    _root.querySelectorAll('[data-proj]').forEach(el => el.onclick = () => {
      const [owner, ...rest] = el.dataset.proj.split('__');
      location.hash = 'oss/' + owner + '/' + rest.join('__');
    });
    _root.querySelectorAll('[data-cat]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      _filters = defFilters(); _filters.cat = el.dataset.cat; location.hash = 'oss/search';
    });
  }

  function surprise() {
    const pool = (_index.bundles.surprise || []);
    const id = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    if (!id) return;
    const [owner, ...rest] = id.split('__');
    location.hash = 'oss/' + owner + '/' + rest.join('__');
  }

  function failLoad() {
    _root.innerHTML = `<div class="oss-wrap"><div class="oss-empty">⚠ ${_t('Could not load the catalog.', 'Não foi possível carregar o catálogo.')}<br><small>${_t('It is generated daily by a GitHub Action.', 'É gerado diariamente por uma GitHub Action.')}</small></div></div>`;
  }

  /* ── public ── */
  function show(sub) {
    _root = document.getElementById('view-oss');
    if (!_root) return;
    if (!_filters) _filters = defFilters();
    ensureIndex().then(() => {
      if (!sub) renderHub();
      else if (sub === 'search' || sub.indexOf('search') === 0) renderSearch();
      else renderDetail(sub.replace('/', '__'));
    }).catch(failLoad);
  }

  return { show };
})();
