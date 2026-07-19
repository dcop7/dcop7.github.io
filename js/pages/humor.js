/* ══════════════════════════════════════════════════════════════════
   HumorPage — the "😂 Humor" section. Fully data-driven: categories live
   in data/humor/index.json and each category in data/humor/<id>.json
   (array of { t } one-liners or { q, a } two-part / Q&A jokes).
   Add thousands of jokes by editing JSON only — no code changes.

   UX model: the home shows the joke of the day + 5 group cards (not the
   28 categories). Opening a group shows a mixed feed of its jokes,
   shuffled fresh on every visit with not-yet-seen jokes surfaced first
   ("seen" ids persist in localStorage), paged in batches. Category
   chips filter within the group. Joke ids are content hashes, so
   favourites stay stable when the JSON files are edited or reordered.
   Offline (service-worker cached); no third-party calls at runtime.
══════════════════════════════════════════════════════════════════ */
const HumorPage = (function () {
  'use strict';

  const BASE = 'data/humor/';
  const PAGE = 24;                  /* jokes per feed batch */
  let root, built = false, index = null, groups = null;
  const cache = {};                 /* cat id → jokes[] */
  let favs = load('humor-favs', {});/* {jokeId: jokeObj} */
  /* v2: chave nova para o default voltar a ser "ocultas" para quem já tinha
     ligado o toggle antigo (que parecia não fazer nada). */
  let revealAll = load('humor-reveal-all-v2', false);
  let seen = load('humor-seen', []);/* [jokeId] in first-seen order */
  let seenSet = new Set(seen);
  let feed = null;                  /* current group feed state */

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Stable content-based id: survives edits/reordering of the JSON files
     (the old ids were array indexes, which favourites depended on). */
  function jid(cat, j) {
    const s = (j.t || '') + '|' + (j.q || '') + '|' + (j.a || '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return cat + '-' + (h >>> 0).toString(36);
  }
  /* Re-key favourites saved under the old index-based ids. */
  (function migrateFavs() {
    let changed = false; const out = {};
    Object.entries(favs).forEach(([k, j]) => {
      const id = (j && j.cat) ? jid(j.cat, j) : k;
      if (id !== k) changed = true;
      out[id] = { ...j, id };
    });
    if (changed) { favs = out; save('humor-favs', favs); }
  })();

  async function getJSON(url) { try { const r = await fetch(url, { cache: 'force-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }

  async function loadIndex() {
    if (index) return index;
    const d = await getJSON(BASE + 'index.json');
    index = (d && d.categories) || [];
    groups = (d && d.groups) || [];
    return index;
  }
  async function loadCat(id) {
    if (cache[id]) return cache[id];
    const d = await getJSON(BASE + id + '.json');
    cache[id] = (Array.isArray(d) ? d : []).map(j => ({ ...j, cat: id, id: jid(id, j) }));
    return cache[id];
  }
  async function loadGroupJokes(gid) {
    const idx = await loadIndex();
    const cats = gid ? idx.filter(c => c.group === gid) : idx;
    const all = await Promise.all(cats.map(c => loadCat(c.id)));
    return all.flat();
  }
  const catName = id => { const c = (index || []).find(x => x.id === id); return c ? c.name : id; };
  const catIcon = id => { const c = (index || []).find(x => x.id === id); return c ? c.icon : '😂'; };
  const groupOf = gid => (groups || []).find(g => g.id === gid);
  /* Só os enigmas (adivinhas/cúmulos) escondem a resposta — nas restantes
     piadas Q&A o remate aparece logo, sem obrigar a clicar. */
  function isRiddle(cat) { const c = (index || []).find(x => x.id === cat); return !!c && c.group === 'enigmas'; }
  const findJoke = (cat, id) => (cache[cat] || []).find(x => x.id === id) || favs[id] || null;

  /* ── shuffle & discovery ───────────────────────────────────────── */
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
    return a;
  }
  /* Fresh random order on every visit, with never-seen jokes first, so
     returning to a category surfaces new content instead of the same top. */
  function freshOrder(list) {
    const un = [], sn = [];
    list.forEach(j => (seenSet.has(j.id) ? sn : un).push(j));
    return shuffle(un).concat(shuffle(sn));
  }
  function markSeen(list) {
    let dirty = false;
    list.forEach(j => { if (!seenSet.has(j.id)) { seenSet.add(j.id); seen.push(j.id); dirty = true; } });
    if (seen.length > 3000) { seen = seen.slice(-2000); seenSet = new Set(seen); }
    if (dirty) save('humor-seen', seen);
  }
  function pickRandom(list) {
    const un = list.filter(j => !seenSet.has(j.id));
    const pool = un.length ? un : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ── lifecycle ─────────────────────────────────────────────────── */
  function init() {
    root = document.getElementById('view-humor');
    if (!root) return;
    injectCSS();
    renderShell();
    renderHub();
    built = true;
  }
  function show() { if (!built) init(); }

  /* ── shell (head + persistent toolbar) ─────────────────────────── */
  function renderShell() {
    root.innerHTML = `
      <div class="view-inner">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('humor', 22)}</span>
          <div class="ph-titles">
            <h1 class="ph-title">Humor</h1>
            <p class="ph-sub">Piadas, secas, adivinhas, cúmulos e piropos — todos os dias por uma ordem diferente</p>
          </div>
        </div>
        <div class="hm-toolbar">
          <button class="hm-tool primary" id="hm-lucky">🎲 Surpreende-me</button>
          <button class="hm-tool" id="hm-favs">⭐ Favoritas <span id="hm-favn">${Object.keys(favs).length || ''}</span></button>
          <button class="hm-tool${revealAll ? ' on' : ''}" id="hm-reveal-all" aria-pressed="${revealAll}" hidden>${revealLabel()}</button>
          <div class="hm-search-wrap"><input class="hm-search" id="hm-search" type="search" placeholder="🔍 Pesquisar em todo o humor…" aria-label="Pesquisar"></div>
        </div>
        <div id="hm-body"><div class="hm-loading">A carregar…</div></div>`;
    root.querySelector('#hm-lucky').addEventListener('click', () => showRandom(null));
    root.querySelector('#hm-favs').addEventListener('click', showFavs);
    root.querySelector('#hm-reveal-all').addEventListener('click', toggleRevealAll);
    const s = root.querySelector('#hm-search');
    let tmr; s.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => doSearch(s.value.trim()), 250); });
  }
  const body = () => root.querySelector('#hm-body');

  /* ── mostrar/ocultar todas as respostas dos enigmas ────────────── */
  const revealLabel = () => revealAll ? '🙈 Ocultar respostas' : '👀 Mostrar respostas';
  function toggleRevealAll() {
    revealAll = !revealAll;
    save('humor-reveal-all-v2', revealAll);
    const b = root.querySelector('#hm-reveal-all');
    if (b) { b.textContent = revealLabel(); b.classList.toggle('on', revealAll); b.setAttribute('aria-pressed', revealAll); }
    applyReveal(body());
  }
  /* O toggle só faz sentido em vistas que tenham enigmas (adivinhas/cúmulos);
     nas restantes a resposta está sempre à vista, por isso o botão esconde-se
     em vez de ficar ali a não fazer nada. */
  function refreshRevealBtn() {
    const b = root && root.querySelector('#hm-reveal-all');
    if (b) b.hidden = !body()?.querySelector('.hm-reveal');
  }
  /* Aplica o estado global aos cartões já em ecrã. Um "Ver resposta"
     clicado à mão (data-open) fica revelado até se ocultar tudo. */
  function applyReveal(scope) {
    scope.querySelectorAll('.hm-reveal').forEach(btn => {
      const a = btn.closest('.hm-joke')?.querySelector('.hm-a');
      if (revealAll) { btn.hidden = true; if (a) a.hidden = false; }
      else { delete btn.dataset.open; btn.hidden = false; if (a) a.hidden = true; }
    });
  }

  /* ── home hub: joke of the day + group cards ───────────────────── */
  async function renderHub() {
    feed = null;
    body().innerHTML = `
      <section class="hm-daily">
        <h2 class="hm-sec-ttl">📅 Piada do dia</h2>
        <div id="hm-daily-card" class="hm-single"><div class="hm-loading">A escolher…</div></div>
      </section>
      <h2 class="hm-sec-ttl">Explorar</h2>
      <div class="hm-hub" id="hm-hub"><div class="hm-loading">A carregar…</div></div>`;
    refreshRevealBtn();
    const idx = await loadIndex();
    const hub = root.querySelector('#hm-hub');
    if (!idx.length) { hub.innerHTML = `<div class="hm-empty">Sem categorias.</div>`; return; }
    hub.innerHTML = (groups || []).map(g => {
      const cats = idx.filter(c => c.group === g.id);
      if (!cats.length) return '';
      return `
        <button class="hm-gcard" data-group="${g.id}">
          <span class="hm-gcard-ico">${g.icon}</span>
          <span class="hm-gcard-body">
            <span class="hm-gcard-name">${esc(g.name)}</span>
            <span class="hm-gcard-cats">${cats.map(c => esc(c.name)).join(' · ')}</span>
          </span>
          <span class="hm-gcard-arrow">›</span>
        </button>`;
    }).join('');
    hub.querySelectorAll('.hm-gcard').forEach(b => b.addEventListener('click', () => renderGroup(b.dataset.group)));
    fillDaily();
  }
  async function fillDaily() {
    const idx = await loadIndex();
    const el = root.querySelector('#hm-daily-card');
    if (!idx.length || !el) return;
    const d = new Date();
    const seed = d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const cat = idx[seed % idx.length];
    const jokes = await loadCat(cat.id);
    if (!jokes.length || !root.querySelector('#hm-daily-card')) return;
    const j = jokes[seed % jokes.length];
    el.innerHTML = jokeCard(j, { big: true });
    wireCards(el);
  }

  /* ── group view: chips + shuffled feed ─────────────────────────── */
  function backBar(title) {
    return `<div class="hm-detail-bar"><button class="hm-back" id="hm-back">← Voltar</button><h2 class="hm-detail-ttl">${title}</h2></div>`;
  }
  function wireBack() { root.querySelector('#hm-back')?.addEventListener('click', renderHub); }

  async function renderGroup(gid, keepFilter) {
    const idx = await loadIndex();
    const g = groupOf(gid);
    if (!g) return renderHub();
    const cats = idx.filter(c => c.group === gid);
    const filter = keepFilter && cats.some(c => c.id === keepFilter) ? keepFilter : null;
    body().innerHTML = backBar(`${g.icon} ${esc(g.name)} <span class="hm-count" id="hm-gcount">…</span>`) + `
      <div class="hm-chips" role="tablist">
        <button class="chip${filter ? '' : ' active'}" data-cat="">Tudo</button>
        ${cats.map(c => `<button class="chip${filter === c.id ? ' active' : ''}" data-cat="${c.id}" title="${esc(c.desc || '')}">${c.icon} ${esc(c.name)}</button>`).join('')}
        <button class="chip hm-chip-rand" id="hm-grand">🎲 Aleatória</button>
      </div>
      <div class="hm-list" id="hm-feed"></div>
      <div class="hm-more-wrap" id="hm-more-wrap"></div>`;
    wireBack();
    const all = await loadGroupJokes(gid);
    if (!root.querySelector('#hm-feed')) return;   /* user navigated away */
    feed = { gid, all, filter, list: [], shown: 0 };
    root.querySelectorAll('.hm-chips .chip[data-cat]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('.hm-chips .chip[data-cat]').forEach(x => x.classList.toggle('active', x === b));
      applyFilter(b.dataset.cat || null);
    }));
    root.querySelector('#hm-grand').addEventListener('click', () => showRandom(gid));
    applyFilter(filter);
  }
  function applyFilter(catId) {
    if (!feed) return;
    feed.filter = catId;
    const pool = catId ? feed.all.filter(j => j.cat === catId) : feed.all;
    feed.list = freshOrder(pool);
    feed.shown = 0;
    const n = root.querySelector('#hm-gcount'); if (n) n.textContent = pool.length;
    const fe = root.querySelector('#hm-feed'); if (fe) fe.innerHTML = '';
    renderBatch();
  }
  function renderBatch() {
    if (!feed) return;
    const fe = root.querySelector('#hm-feed'), mw = root.querySelector('#hm-more-wrap');
    if (!fe) return;
    const batch = feed.list.slice(feed.shown, feed.shown + PAGE);
    feed.shown += batch.length;
    const frag = document.createElement('div');
    frag.innerHTML = batch.map(j => jokeCard(j, { hideTag: !!feed.filter })).join('');
    while (frag.firstChild) fe.appendChild(frag.firstChild);
    wireCards(fe, batch.map(j => j.id));
    markSeen(batch);
    const left = feed.list.length - feed.shown;
    mw.innerHTML = left > 0 ? `<button class="hm-tool" id="hm-more">Mostrar mais (${left})</button>` : (feed.list.length ? `<div class="hm-end">🎉 Viste tudo — volta amanhã ou baralha outra vez.</div>` : `<div class="hm-empty">Sem piadas nesta categoria.</div>`);
    root.querySelector('#hm-more')?.addEventListener('click', renderBatch);
  }

  /* ── favourites / search / single ──────────────────────────────── */
  async function showFavs() {
    await loadIndex();
    feed = null;
    const list = Object.values(favs);
    body().innerHTML = backBar(`⭐ Favoritas <span class="hm-count">${list.length}</span>`) +
      (list.length ? `<div class="hm-list">${list.map(j => jokeCard(j)).join('')}</div>`
                   : `<div class="hm-empty">Ainda não tens favoritas. Toca na ⭐ de uma piada para a guardar.</div>`);
    wireBack(); wireCards(body());
  }

  async function doSearch(q) {
    if (!q) { renderHub(); return; }
    feed = null;
    body().innerHTML = `<div class="hm-loading">A pesquisar…</div>`;
    const all = await loadGroupJokes(null);
    const nq = q.toLowerCase();
    const hits = all.filter(j => ((j.t || '') + ' ' + (j.q || '') + ' ' + (j.a || '')).toLowerCase().includes(nq)).slice(0, 200);
    body().innerHTML = backBar(`🔍 "${esc(q)}" <span class="hm-count">${hits.length}</span>`) +
      (hits.length ? `<div class="hm-list">${hits.map(j => jokeCard(j)).join('')}</div>` : `<div class="hm-empty">Sem resultados para “${esc(q)}”.</div>`);
    wireBack(); wireCards(body());
  }

  async function showRandom(gid) {
    const all = await loadGroupJokes(gid);
    if (!all.length) return;
    const g = groupOf(gid);
    showSingle(pickRandom(all), g ? `${g.icon} ${esc(g.name)} — aleatória` : '🎲 Humor aleatório', gid);
  }
  function showSingle(j, title, againGid) {
    feed = null;
    body().innerHTML = backBar(title) +
      `<div class="hm-single">${jokeCard(j, { big: true })}</div>
       <div class="hm-single-actions"><button class="hm-tool primary" id="hm-again">🎲 Outra</button></div>`;
    wireCards(body());
    markSeen([j]);
    root.querySelector('#hm-again')?.addEventListener('click', () => showRandom(againGid));
    root.querySelector('#hm-back')?.addEventListener('click', () => againGid ? renderGroup(againGid) : renderHub());
  }

  /* ── joke card ─────────────────────────────────────────────────── */
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  function jokeCard(j, opts) {
    opts = opts || {};
    const fav = !!favs[j.id];
    const star = `<button class="hm-star${fav ? ' on' : ''}" data-fav="${j.id}" title="Favorita" aria-label="Favorita">${fav ? '★' : '☆'}</button>`;
    const share = canShare ? `<button class="hm-copy" data-share="${j.id}" title="Partilhar" aria-label="Partilhar">📤</button>` : '';
    const tag = opts.hideTag ? '' : `<span class="hm-tag">${catIcon(j.cat)} ${esc(catName(j.cat))}</span>`;
    let inner;
    if (j.q && j.a) {
      const ans = `<div class="hm-a"${isRiddle(j.cat) && !revealAll ? ' hidden' : ''}>${esc(j.a).replace(/\n/g, '<br>')}</div>`;
      inner = `<div class="hm-q">${esc(j.q)}</div>
        ${isRiddle(j.cat) ? `<button class="hm-reveal"${revealAll ? ' hidden' : ''}>Ver resposta 👀</button>` : ''}
        ${ans}`;
    } else {
      inner = `<div class="hm-t">${esc(j.t || '').replace(/\n/g, '<br>')}</div>`;
    }
    return `<article class="hm-joke${opts.big ? ' big' : ''}" data-id="${j.id}" data-cat="${j.cat}">
      <div class="hm-joke-top">${tag}<div class="hm-joke-actions">${star}${share}<button class="hm-copy" data-copy="${j.id}" title="Copiar">📋</button></div></div>
      ${inner}</article>`;
  }

  function wireCards(scope, onlyIds) {
    const sel = suffix => onlyIds
      ? onlyIds.map(id => `[data-${suffix}="${id}"]`).join(',')
      : `[data-${suffix}]`;
    scope.querySelectorAll('.hm-reveal').forEach(b => {
      if (b.dataset.wired) return; b.dataset.wired = '1';
      b.addEventListener('click', () => {
        const a = b.closest('.hm-joke')?.querySelector('.hm-a');
        if (a) a.hidden = false;
        b.dataset.open = '1'; b.hidden = true;   /* fica no DOM para o toggle global o poder repor */
      });
    });
    scope.querySelectorAll(sel('fav')).forEach(b => {
      if (b.dataset.wired) return; b.dataset.wired = '1';
      b.addEventListener('click', e => {
        e.stopPropagation();
        const id = b.dataset.fav;
        if (favs[id]) { delete favs[id]; b.classList.remove('on'); b.textContent = '☆'; }
        else {
          const art = b.closest('.hm-joke');
          const j = findJoke(art.dataset.cat, id);
          if (j) { favs[id] = j; b.classList.add('on'); b.textContent = '★'; }
        }
        save('humor-favs', favs);
        const n = root.querySelector('#hm-favn'); if (n) n.textContent = Object.keys(favs).length || '';
      });
    });
    const jokeText = b => {
      const art = b.closest('.hm-joke');
      const j = findJoke(art.dataset.cat, b.dataset.copy || b.dataset.share);
      return j ? (j.q ? `${j.q}\n${j.a}` : j.t) : '';
    };
    scope.querySelectorAll(sel('copy')).forEach(b => {
      if (b.dataset.wired) return; b.dataset.wired = '1';
      b.addEventListener('click', () => {
        const txt = jokeText(b);
        if (txt) navigator.clipboard?.writeText(txt).then(() => { b.textContent = '✅'; setTimeout(() => b.textContent = '📋', 1200); }).catch(() => {});
      });
    });
    scope.querySelectorAll(sel('share')).forEach(b => {
      if (b.dataset.wired) return; b.dataset.wired = '1';
      b.addEventListener('click', () => {
        const txt = jokeText(b);
        if (txt) navigator.share({ text: txt }).catch(() => {});
      });
    });
    refreshRevealBtn();
  }

  /* ── CSS ───────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('hm-css')) return;
    const s = document.createElement('style'); s.id = 'hm-css';
    s.textContent = `
.hm-toolbar{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:1.2rem}
.hm-tool{background:var(--card2);border:1px solid var(--border);color:var(--text2);font:inherit;font-size:.85rem;font-weight:600;padding:.5rem 1rem;border-radius:var(--radius-sm);cursor:pointer;transition:all .15s}
.hm-tool:hover{border-color:rgba(var(--accent-rgb),.5);color:var(--text)}
.hm-tool.primary{background:linear-gradient(135deg,var(--accent),#a855f7);color:#fff;border:none}
.hm-tool.on{background:var(--accent-soft);border-color:rgba(var(--accent-rgb),.45);color:var(--accent)}
.hm-search-wrap{flex:1;min-width:160px}
.hm-search{width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);font:inherit;font-size:.85rem;padding:.5rem .9rem;border-radius:var(--radius-sm);outline:none}
.hm-search:focus{border-color:rgba(var(--accent-rgb),.4)}
.hm-sec-ttl{display:flex;align-items:center;gap:.5rem;font-family:var(--font-head,inherit);font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 .7rem}
.hm-daily{margin-bottom:1.6rem}
.hm-hub{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.8rem}
.hm-gcard{display:flex;align-items:center;text-align:left;gap:.85rem;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:1rem 1.1rem;cursor:pointer;font:inherit;transition:all .18s;min-width:0}
.hm-gcard:hover{border-color:rgba(var(--accent-rgb),.45);transform:translateY(-2px);box-shadow:var(--shadow-2, 0 4px 16px rgba(0,0,0,.28))}
.hm-gcard-ico{font-size:1.5rem;flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(var(--accent-rgb),.14),rgba(var(--accent-rgb),.03));border:1px solid rgba(var(--accent-rgb),.22);border-radius:12px}
.hm-gcard-body{min-width:0;display:flex;flex-direction:column;gap:.2rem;flex:1}
.hm-gcard-name{font-family:var(--font-head,inherit);font-weight:700;font-size:.95rem;color:var(--text)}
.hm-gcard-cats{font-size:.68rem;color:var(--muted);line-height:1.45;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.hm-gcard-arrow{color:var(--muted);font-size:1.2rem;flex-shrink:0}
.hm-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1rem;align-items:center}
.hm-chip-rand{margin-left:auto}
.hm-detail-bar{display:flex;align-items:center;gap:.8rem;margin-bottom:1rem}
.hm-back{background:var(--card2);border:1px solid var(--border);color:var(--text2);font:inherit;font-size:.8rem;font-weight:600;padding:.35rem .8rem;border-radius:var(--radius-sm);cursor:pointer}
.hm-back:hover{color:var(--accent);border-color:rgba(var(--accent-rgb),.4)}
.hm-detail-ttl{font-family:var(--font-head,inherit);font-size:1.2rem;font-weight:700;margin:0;display:flex;align-items:center;gap:.5rem}
.hm-count{font-size:.7rem;font-weight:700;color:var(--accent);background:var(--accent-soft);border:1px solid rgba(var(--accent-rgb),.3);padding:.1rem .5rem;border-radius:999px}
.hm-list{column-width:340px;column-gap:1rem}
.hm-joke{break-inside:avoid;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:.9rem 1rem;margin-bottom:1rem;display:inline-block;width:100%}
.hm-joke.big{font-size:1.1rem;max-width:560px;margin:0 auto;display:block}
.hm-joke-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;min-height:1.2rem}
.hm-tag{font-size:.64rem;color:var(--muted);font-weight:600}
.hm-joke-actions{display:flex;gap:.3rem;align-items:center;margin-left:auto}
.hm-star,.hm-copy{background:none;border:none;cursor:pointer;font-size:1rem;color:var(--muted);padding:.1rem .2rem;line-height:1}
.hm-star.on{color:#f5b400}
.hm-star:hover,.hm-copy:hover{color:var(--accent)}
.hm-t{color:var(--text);font-size:.92rem;line-height:1.5}
.hm-q{color:var(--text);font-size:.92rem;line-height:1.5;font-weight:600;margin-bottom:.6rem}
.hm-reveal{background:var(--accent-soft);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);font:inherit;font-size:.78rem;font-weight:600;padding:.3rem .8rem;border-radius:999px;cursor:pointer}
.hm-a{margin-top:.6rem;color:var(--green,#34d399);font-size:.92rem;line-height:1.5;font-weight:600}
.hm-single{max-width:600px;margin:0 auto}
.hm-single-actions{text-align:center;margin-top:1rem}
.hm-more-wrap{text-align:center;margin:.4rem 0 1rem}
.hm-end{color:var(--muted);font-size:.8rem;text-align:center;padding:.8rem}
.hm-loading,.hm-empty{color:var(--muted);text-align:center;padding:2.5rem 1rem}
@media (max-width:600px){.hm-list{column-width:auto;column-count:1}.hm-chip-rand{margin-left:0}}`;
    document.head.appendChild(s);
  }

  return { show };
})();
