/* ══════════════════════════════════════════════════════════════════
   PRODUCT DISCOVERY — deal/offer discovery, modular by category.
   First category: 🎮 Gaming (free games, best discounts, historic lows,
   ending soon, stats, search, per-game analysis). Reads only static JSON
   built by data/discovery/<cat>/build-*.mjs (a GitHub Action) — no API
   calls in the browser. Mobile-first; mirrors the OSS/F1 visual language.
   ══════════════════════════════════════════════════════════════════ */
const DiscoveryPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const CATS = [
    { id: 'gaming', emoji: '🎮', en: 'Gaming', pt: 'Gaming', ready: true },
  ];
  const VERDICT = {
    great: { ic: '🟢', en: 'Great buy', pt: 'Excelente compra', cls: 'great' },
    ok:    { ic: '🟡', en: 'Decent discount', pt: 'Desconto razoável', cls: 'ok' },
    wait:  { ic: '🔴', en: 'Wait', pt: 'Esperar', cls: 'wait' },
  };

  let _root = null, _cat = 'gaming', _index = null, _games = null, _detail = {}, _filters = null, _shown = 48;
  const _idxCache = {}, _gamesCache = {};
  function defFilters() { return { q: '', store: '', genre: '', freeOnly: false, minCut: 0, verdict: '', sort: 'score' }; }

  /* ── formatting ── */
  function price(v, cur) {
    if (v == null) return '—';
    if (+v === 0) return _t('Free', 'Grátis');
    const n = (+v).toFixed(2);
    return cur === '€' ? n.replace('.', ',') + '€' : '$' + n;
  }
  function ago(ts) { if (!ts) return ''; const d = new Date(ts); return d.toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function countdown(end) {
    const ms = Date.parse(end) - Date.now(); if (!(ms > 0)) return _t('ending', 'a terminar');
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    if (d > 0) return _t(`${d}d ${h}h left`, `${d}d ${h}h`);
    if (h > 0) return _t(`${h}h ${m}m left`, `${h}h ${m}m`);
    return _t(`${m}m left`, `${m}m`);
  }

  async function ensureIndex(cat) { if (_idxCache[cat]) return _idxCache[cat]; _idxCache[cat] = await fetch(`data/discovery/${cat}/index.json`).then(r => r.json()); return _idxCache[cat]; }
  async function ensureGames(cat) { if (_gamesCache[cat]) return _gamesCache[cat]; const d = await fetch(`data/discovery/${cat}/games.json`).then(r => r.json()); _gamesCache[cat] = d.games || []; return _gamesCache[cat]; }
  async function ensureDetail(cat, id) { const k = cat + '/' + id; if (_detail[k] !== undefined) return _detail[k]; _detail[k] = await fetch(`data/discovery/${cat}/g/${id}.json`).then(r => r.ok ? r.json() : null).catch(() => null); return _detail[k]; }

  /* ── category tab bar — hidden while there is a single category ── */
  function catBar() {
    if (CATS.length < 2) return '';
    return `<div class="dc-cats">${CATS.map(c =>
      `<button class="dc-cat${c.id === _cat ? ' on' : ''}" data-cat="${c.id}"><span>${c.emoji}</span>${_t(c.en, c.pt)}</button>`).join('')}</div>`;
  }

  /* ── cards ── */
  function dealCard(g) {
    const v = g.verdict && VERDICT[g.verdict];
    return `<button class="dc-card" data-game="${esc(g.id)}">
      <div class="dc-card-img"><img src="${esc(g.thumb || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        ${g.cut > 0 ? `<span class="dc-cut">-${g.cut}%</span>` : ''}</div>
      <div class="dc-card-body">
        <div class="dc-card-title">${esc(g.title)}</div>
        <div class="dc-card-meta"><span class="dc-store"><span class="dc-dot" style="background:${esc(g.storeColor || '#888')}"></span>${esc(g.store || '')}</span>${g.steamRating ? `<span class="dc-rating">👍 ${g.steamRating}%</span>` : ''}</div>
        <div class="dc-card-price">
          <span class="dc-now">${price(g.sale, g.cur)}</span>
          ${g.normal && g.cut > 0 ? `<span class="dc-was">${price(g.normal, g.cur)}</span>` : ''}
          ${v ? `<span class="dc-verdict ${v.cls}" title="${_t(v.en, v.pt)}">${v.ic}</span>` : ''}
        </div>
        ${g.pctLow != null && g.pctLow <= 0.15 ? `<div class="dc-lowtag">📉 ${g.pctLow <= 0.001 ? _t('all-time low', 'mínimo histórico') : _t(`${Math.round(g.pctLow * 100)}% above low`, `${Math.round(g.pctLow * 100)}% acima do mínimo`)}</div>` : ''}
      </div>
    </button>`;
  }
  function freeCard(f) {
    return `<a class="dc-free" href="${esc(f.url)}" target="_blank" rel="noopener">
      <div class="dc-free-img"><img src="${esc(f.image || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span class="dc-free-tag">${_t('FREE', 'GRÁTIS')}</span></div>
      <div class="dc-free-body">
        <div class="dc-free-title">${esc(f.title)}</div>
        <div class="dc-free-store"><span class="dc-dot" style="background:${esc(f.storeColor || '#888')}"></span>${esc(f.store)}</div>
        <div class="dc-free-prices">${f.orig ? `<span class="dc-free-orig">${esc(f.orig)}</span>` : ''}<span class="dc-free-now">${_t('Free', 'Grátis')}</span></div>
        ${f.end ? `<div class="dc-free-end">⏳ ${countdown(f.end)}</div>` : ''}
        <span class="dc-btn">${_t('Get', 'Obter')} →</span>
      </div>
    </a>`;
  }

  /* ── rails with hover arrows (same UX as the OSS section) ── */
  function rail(emoji, title, sub, html, cls) {
    if (!html) return '';
    return `<section class="dc-rail">
      <div class="dc-rail-hd"><h2>${emoji} ${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      <div class="dc-rail-wrap">
        <button class="dc-rail-nav prev" aria-label="‹" hidden>‹</button>
        <div class="dc-rail-track ${cls || ''}">${html}</div>
        <button class="dc-rail-nav next" aria-label="›">›</button>
      </div></section>`;
  }
  function wireRails(root) {
    root.querySelectorAll('.dc-rail-wrap').forEach(wrap => {
      const track = wrap.querySelector('.dc-rail-track'), prev = wrap.querySelector('.prev'), next = wrap.querySelector('.next');
      if (!track) return;
      const sync = () => { const max = track.scrollWidth - track.clientWidth - 2; prev.hidden = track.scrollLeft <= 2; next.hidden = track.scrollLeft >= max; };
      const step = () => Math.max(260, Math.round(track.clientWidth * 0.8));
      prev.onclick = () => track.scrollBy({ left: -step(), behavior: 'smooth' });
      next.onclick = () => track.scrollBy({ left: step(), behavior: 'smooth' });
      track.addEventListener('scroll', sync, { passive: true });
      requestAnimationFrame(sync);
    });
  }

  /* ════════════════════════════ HUB ════════════════════════════ */
  function renderHub() {
    _root.innerHTML = `<div class="dc-wrap"><div class="dc-loading"><div class="ex-loading-spinner"></div></div></div>`;
    Promise.all([ensureIndex(_cat), ensureGames(_cat)]).then(([ix, games]) => {
      _index = ix; _games = games; const b = ix.bundles, s = ix.stats, cur = ix.currency;
      const free = b.freeNow || [];
      const statCard = (ic, v, lbl) => `<div class="dc-stat"><span class="dc-stat-ic">${ic}</span><b>${v}</b><span>${esc(lbl)}</span></div>`;
      const stats = `<div class="dc-stats">
        ${statCard('🎁', s.freeCount, _t('free now', 'grátis agora'))}
        ${statCard('💰', (s.freeValue ? s.freeValue.toFixed(2).replace('.', ',') + (s.freeValueCur || '€') : '—'), _t('value given away', 'valor oferecido'))}
        ${statCard('🔥', (s.biggestCut || 0) + '%', _t('biggest discount', 'maior desconto'))}
        ${statCard('📉', s.historicLowCount, _t('at historic low', 'em mínimo histórico'))}
        ${s.best ? statCard('🏆', '-' + s.best.cut + '%', esc(s.best.title)) : ''}
      </div>`;

      const freeSec = free.length ? `<section class="dc-rail"><div class="dc-rail-hd"><h2>🎁 ${_t('Free now', 'Grátis Agora')}</h2><p>${_t('Claim them before they are gone', 'Garante-os antes que desapareçam')}</p></div>
        <div class="dc-free-grid">${free.map(freeCard).join('')}</div></section>` : '';

      // genre chip bar (browse discounts/lows by game category, not all mixed)
      const genres = (ix.genres || []).filter(g => g.count >= 3);
      const genreBar = `<div class="dc-genres" id="dc-genres">
        <button class="dc-genre on" data-g="">${_t('All', 'Todos')}</button>
        ${genres.map(g => `<button class="dc-genre" data-g="${esc(g.name)}">${esc(g.name)}</button>`).join('')}</div>`;

      _root.innerHTML = `<div class="dc-wrap">
        <header class="dc-hero">
          <h1>🛍️ ${_t('Product Discovery', 'Product Discovery')}</h1>
          <p>${_t('Discover deals, free games and all-time-low prices — updated automatically.', 'Descobre promoções, jogos grátis e mínimos históricos — atualizado automaticamente.')}</p>
          <label class="dc-search"><span aria-hidden="true">🔍</span><input id="dc-q" type="search" placeholder="${_t('Search a game…', 'Pesquisar um jogo…')}" autocomplete="off"></label>
          <div class="dc-meta">${_t('Updated', 'Atualizado')} ${ago(Date.parse(ix.generatedAt))} · ${ix.count} ${_t('deals tracked', 'promoções')}</div>
        </header>
        ${catBar()}
        ${stats}
        ${freeSec}
        ${genreBar}
        <div id="dc-genre-rails"></div>
        ${rail('⏳', _t('Ending soon', 'Promoções a terminar'), _t('Last chance', 'Última oportunidade'), (b.endingSoon || []).map(freeCard).join(''), 'dc-rail-free')}
        <div class="dc-credit">${_t('Data', 'Dados')}: CheapShark · Epic Games · Steam${ix.hasHistory ? ' · IsThereAnyDeal' : ''} — ${_t('prices may vary; always confirm on the store.', 'os preços podem variar; confirma sempre na loja.')}</div>
      </div>`;
      paintGenreRails('');
      _root.querySelector('#dc-genres').addEventListener('click', e => {
        const btn = e.target.closest('[data-g]'); if (!btn) return;
        _root.querySelectorAll('.dc-genre').forEach(x => x.classList.toggle('on', x === btn));
        paintGenreRails(btn.dataset.g);
      });
      wireCommon();
      const q = _root.querySelector('#dc-q');
      q.addEventListener('keydown', e => { if (e.key === 'Enter' && q.value.trim()) { _filters = defFilters(); _filters.q = q.value.trim(); location.hash = 'discovery/gaming/search'; } });
    }).catch(failLoad);
  }
  /* recompute the discount + historic-low rails for the chosen genre (client-side from games.json) */
  function paintGenreRails(genre) {
    const host = _root.querySelector('#dc-genre-rails'); if (!host) return;
    const inG = c => !genre || (c.genres || []).includes(genre);
    const by = (arr, f, n) => arr.slice().sort(f).slice(0, n);
    const best = by(_games.filter(c => inG(c) && c.cut > 0), (a, b) => b.score - a.score, 40);
    const lows = by(_games.filter(c => inG(c) && c.pctLow != null && c.pctLow <= 0.15 && c.cut > 0), (a, b) => a.pctLow - b.pctLow, 40);
    const label = genre ? ' · ' + genre : '';
    host.innerHTML =
      rail('🔥', _t('Best discounts', 'Melhores descontos') + label, _t('Quality games worth grabbing', 'Jogos de qualidade que valem a pena'), best.map(dealCard).join('')) +
      rail('📉', _t('New historic lows', 'Novos mínimos históricos') + label, _t('At or near their lowest price ever', 'No mínimo de sempre ou perto dele'), lows.map(dealCard).join(''));
    if (!best.length && !lows.length) host.innerHTML = `<div class="dc-empty">${_t('No deals in this category right now.', 'Sem promoções nesta categoria de momento.')}</div>`;
    wireCommon(); wireRails(host);
  }

  /* ════════════════════════════ SEARCH ════════════════════════════ */
  function renderSearch() {
    _root.innerHTML = `<div class="dc-wrap"><div class="dc-loading"><div class="ex-loading-spinner"></div></div></div>`;
    ensureGames(_cat).then(games => {
      _games = games; const ix = _index || {};
      const stores = [...new Set(games.map(g => g.store).filter(Boolean))].sort();
      const f = _filters || (_filters = defFilters());
      const storeOpts = ['<option value="">' + _t('All stores', 'Todas as lojas') + '</option>'].concat(stores.map(s => `<option value="${esc(s)}"${f.store === s ? ' selected' : ''}>${esc(s)}</option>`)).join('');
      const genreOpts = ['<option value="">' + _t('All genres', 'Todos os géneros') + '</option>'].concat((ix.genres || []).map(g => `<option value="${esc(g.name)}"${f.genre === g.name ? ' selected' : ''}>${esc(g.name)} (${g.count})</option>`)).join('');
      const sortOpts = [['score', _t('Relevance', 'Relevância')], ['cut', _t('Discount', 'Desconto')], ['price', _t('Price', 'Preço')], ['low', _t('Closest to low', 'Perto do mínimo')]].map(([v, l]) => `<option value="${v}"${f.sort === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
      _root.innerHTML = `<div class="dc-wrap">
        <div class="dc-topbar"><button class="dc-back" id="dc-back">← ${_t('Discover', 'Descobrir')}</button>
          <label class="dc-search" style="flex:1"><span aria-hidden="true">🔍</span><input id="dc-q" type="search" value="${esc(f.q)}" placeholder="${_t('Search…', 'Pesquisar…')}" autocomplete="off"></label></div>
        <div class="dc-filters">
          <select id="dc-f-store">${storeOpts}</select>
          <select id="dc-f-genre">${genreOpts}</select>
          <select id="dc-f-sort">${sortOpts}</select>
          <label class="dc-chk"><input type="checkbox" id="dc-f-cut"${f.minCut ? ' checked' : ''}> ${_t('≥50% off', '≥50% desc.')}</label>
          <label class="dc-chk"><input type="checkbox" id="dc-f-great"${f.verdict === 'great' ? ' checked' : ''}> 🟢 ${_t('Great buys', 'Excelentes')}</label>
        </div>
        <div class="dc-count" id="dc-count"></div>
        <div class="dc-grid" id="dc-grid"></div>
        <div class="dc-more" id="dc-more"></div>
      </div>`;
      _shown = 48; paintResults(); wireCommon();
      const q = _root.querySelector('#dc-q'); let t;
      q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { _filters.q = q.value.trim(); _shown = 48; paintResults(); }, 150); });
      _root.querySelector('#dc-back').onclick = () => { location.hash = 'discovery/gaming'; };
      const bind = (id, fn) => { const el = _root.querySelector(id); if (el) el.onchange = e => { fn(e.target); _shown = 48; paintResults(); }; };
      bind('#dc-f-store', t => _filters.store = t.value);
      bind('#dc-f-genre', t => _filters.genre = t.value);
      bind('#dc-f-sort', t => _filters.sort = t.value);
      bind('#dc-f-cut', t => _filters.minCut = t.checked ? 50 : 0);
      bind('#dc-f-great', t => _filters.verdict = t.checked ? 'great' : '');
    }).catch(failLoad);
  }
  function applyFilters() {
    let list = _games.slice(); const f = _filters;
    if (f.store) list = list.filter(g => g.store === f.store);
    if (f.genre) list = list.filter(g => (g.genres || []).includes(f.genre));
    if (f.minCut) list = list.filter(g => (g.cut || 0) >= f.minCut);
    if (f.verdict) list = list.filter(g => g.verdict === f.verdict);
    const q = norm(f.q); if (q) list = list.filter(g => norm(g.title).includes(q));
    const sorters = { score: (a, b) => b.score - a.score, cut: (a, b) => (b.cut || 0) - (a.cut || 0), price: (a, b) => (a.sale ?? 1e9) - (b.sale ?? 1e9), low: (a, b) => (a.pctLow ?? 9) - (b.pctLow ?? 9) };
    return list.sort(sorters[f.sort] || sorters.score);
  }
  function paintResults() {
    const list = applyFilters(), grid = _root.querySelector('#dc-grid'); if (!grid) return;
    _root.querySelector('#dc-count').textContent = `${list.length} ${_t('games', 'jogos')}`;
    grid.innerHTML = list.slice(0, _shown).map(dealCard).join('') || `<div class="dc-empty">${_t('No games match.', 'Nenhum jogo corresponde.')}</div>`;
    const more = _root.querySelector('#dc-more');
    more.innerHTML = list.length > _shown ? `<button class="dc-btn ghost" id="dc-loadmore">${_t('Load more', 'Carregar mais')}</button>` : '';
    const lm = _root.querySelector('#dc-loadmore'); if (lm) lm.onclick = () => { _shown += 48; paintResults(); };
    wireCommon();
  }

  /* ════════════════════════════ DETAIL ════════════════════════════ */
  function priceChart(history) {
    if (!history || history.length < 2) return '';
    const W = 600, H = 130, pad = 8;
    const xs = history.map(p => p[0]), ys = history.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = 0, y1 = Math.max(...ys) * 1.05 || 1;
    const sx = t => pad + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * (W - 2 * pad);
    const sy = v => H - pad - (v - y0) / (y1 - y0) * (H - 2 * pad);
    const pts = history.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`);
    const lowV = Math.min(...ys);
    return `<svg class="dc-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="0" y1="${sy(lowV).toFixed(1)}" x2="${W}" y2="${sy(lowV).toFixed(1)}" stroke="#3fb950" stroke-dasharray="4 4" stroke-width="1" opacity=".6"/>
      <path d="M${pts[0]} L${pts.join(' L')} L${sx(x1).toFixed(1)},${H - pad} L${sx(x0).toFixed(1)},${H - pad} Z" fill="rgba(88,166,255,.15)"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#58a6ff" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }
  function renderDetail(id) {
    _root.innerHTML = `<div class="dc-wrap"><div class="dc-loading"><div class="ex-loading-spinner"></div></div></div>`;
    ensureDetail(_cat, id).then(d => {
      if (!d) { _root.innerHTML = `<div class="dc-wrap"><button class="dc-back" id="dc-back">← ${_t('Discover', 'Descobrir')}</button><div class="dc-empty">${_t('Game not found.', 'Jogo não encontrado.')}</div></div>`; const b = _root.querySelector('#dc-back'); if (b) b.onclick = () => location.hash = 'discovery/gaming'; return; }
      const v = d.verdict && VERDICT[d.verdict];
      const verdictBox = v ? `<div class="dc-verdict-box ${v.cls}"><span class="dc-vbig">${v.ic} ${_t(v.en, v.pt)}</span>
        <span>${d.verdict === 'great' ? _t('Current price is at/near its all-time low.', 'O preço atual está no/perto do mínimo histórico.') : d.verdict === 'ok' ? _t('It has been cheaper before — a decent but not best deal.', 'Já esteve mais barato — bom desconto, mas não o melhor.') : _t('Far from its best discounts — better to wait.', 'Longe dos melhores descontos — melhor esperar.')}</span></div>` : '';
      const stores = (d.deals || []).map((s, i) => `<a class="dc-store-row${i === 0 ? ' best' : ''}" href="${esc(s.url)}" target="_blank" rel="noopener">
        <span class="dc-store"><span class="dc-dot" style="background:${esc(s.storeColor)}"></span>${esc(s.store)}</span>
        <span class="dc-store-price">${s.cut > 0 ? `<span class="dc-cut sm">-${s.cut}%</span>` : ''}<b>${price(s.sale, d.cur)}</b>${s.cut > 0 ? `<span class="dc-was">${price(s.normal, d.cur)}</span>` : ''}</span>
        <span class="dc-btn sm">${_t('Get', 'Obter')} →</span></a>`).join('');
      const hasHist = d.history && d.history.length >= 2;
      const histSec = hasHist ? `<section class="dc-sec"><div class="dc-sec-hd"><h3>📈 ${_t('Price history', 'Histórico de preços')}</h3>
          <div class="dc-ranges" id="dc-ranges">${[['30', _t('1m', '1 mês')], ['90', _t('3m', '3 meses')], ['365', _t('1y', '1 ano')], ['1095', _t('3y', '3 anos')], ['', _t('All', 'Tudo')]].map(([val, l], i) => `<button class="dc-range${i === 1 ? ' on' : ''}" data-d="${val}">${l}</button>`).join('')}</div></div>
          <div id="dc-chart-host"></div>
          <div class="dc-chart-note">${_t('Green dashed = all-time low', 'Tracejado verde = mínimo histórico')}</div></section>`
        : d.low != null ? `<section class="dc-sec"><h3>📉 ${_t('Current vs all-time low', 'Atual vs mínimo histórico')}</h3>
          <div class="dc-lowbars"><div><span>${_t('Now', 'Agora')}</span><div class="dc-bar"><i style="width:100%"></i></div><b>${price(d.sale, d.cur)}</b></div>
          <div><span>${_t('Lowest ever', 'Mínimo de sempre')}</span><div class="dc-bar low"><i style="width:${d.sale ? Math.round(d.low / d.sale * 100) : 100}%"></i></div><b>${price(d.low, d.cur)}</b></div></div>
          <div class="dc-chart-note">${d.lowDate ? _t('Lowest on ', 'Mínimo em ') + ago(d.lowDate) : ''}</div></section>` : '';

      _root.innerHTML = `<div class="dc-wrap"><article class="dc-detail">
        <div class="dc-topbar"><button class="dc-back" id="dc-back">← ${_t('Discover', 'Descobrir')}</button></div>
        <div class="dc-d-hero">
          <div class="dc-d-cover"><img src="${esc(d.thumb || '')}" alt="" onerror="this.style.visibility='hidden'"></div>
          <div class="dc-d-info">
            <h1>${esc(d.title)}</h1>
            <div class="dc-d-tags">${(d.genres || []).map(g => `<span class="dc-tag">${esc(g)}</span>`).join('')}${d.release ? `<span class="dc-tag ghost">${esc(d.release)}</span>` : ''}${(d.platforms || []).map(p => `<span class="dc-tag ghost">${p === 'windows' ? '🪟' : p === 'mac' ? '🍎' : p === 'linux' ? '🐧' : p}</span>`).join('')}</div>
            <div class="dc-d-price"><span class="dc-now">${price(d.sale, d.cur)}</span>${d.cut > 0 ? `<span class="dc-was">${price(d.normal, d.cur)}</span><span class="dc-cut">-${d.cut}%</span>` : ''}${d.steamRating ? `<span class="dc-rating">👍 ${d.steamRating}%</span>` : ''}</div>
            ${verdictBox}
          </div>
        </div>
        ${d.descFull ? `<p class="dc-d-desc">${esc(d.descFull)}</p>` : ''}
        <section class="dc-sec"><h3>🏬 ${_t('Where to buy', 'Onde comprar')}</h3><div class="dc-stores">${stores || '<div class="dc-empty">—</div>'}</div></section>
        ${histSec}
      </article></div>`;
      const b = _root.querySelector('#dc-back'); if (b) b.onclick = () => { if (history.length > 1) history.back(); else location.hash = 'discovery/gaming'; };
      if (hasHist) {
        const paintChart = days => {
          const host = _root.querySelector('#dc-chart-host'); if (!host) return;
          let h = d.history;
          if (days) { const cut = Date.now() - (+days) * 864e5; const f = h.filter(p => p[0] >= cut); h = f.length >= 2 ? f : h; }
          host.innerHTML = priceChart(h) || `<div class="dc-chart-note">${_t('Not enough data for this range yet.', 'Ainda sem dados suficientes para este intervalo.')}</div>`;
        };
        paintChart(90);
        _root.querySelector('#dc-ranges').addEventListener('click', e => { const btn = e.target.closest('[data-d]'); if (!btn) return; _root.querySelectorAll('.dc-range').forEach(x => x.classList.toggle('on', x === btn)); paintChart(btn.dataset.d); });
      }
    }).catch(failLoad);
  }

  /* ── shared wiring ── */
  function wireCommon() {
    _root.querySelectorAll('[data-game]').forEach(el => el.onclick = () => { location.hash = 'discovery/gaming/' + el.dataset.game; });
    _root.querySelectorAll('.dc-cat[data-cat]').forEach(el => el.onclick = () => { location.hash = 'discovery/' + el.dataset.cat; });
  }
  function failLoad() {
    _root.innerHTML = `<div class="dc-wrap"><div class="dc-empty">⚠ ${_t('Could not load deals.', 'Não foi possível carregar as promoções.')}<br><small>${_t('Generated periodically by a GitHub Action.', 'Gerado periodicamente por uma GitHub Action.')}</small></div></div>`;
  }

  /* ── public ── */
  function show(sub) {
    _root = document.getElementById('view-discovery'); if (!_root) return;
    if (!_filters) _filters = defFilters();
    // sub forms: null | "gaming" | "gaming/search" | "gaming/<id>"
    const parts = (sub || 'gaming').split('/');
    _cat = CATS.find(c => c.id === parts[0] && c.ready) ? parts[0] : 'gaming';
    const rest = parts.slice(1).join('/');
    if (!rest) renderHub();
    else if (rest === 'search') renderSearch();
    else renderDetail(rest);
  }
  return { show };
})();
