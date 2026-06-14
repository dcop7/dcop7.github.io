/* ══════════════════════════════════════════════════════════════════
   HumorPage — the "😂 Humor" section. Fully data-driven: categories live
   in data/humor/index.json and each category in data/humor/<id>.json
   (array of { id, t } one-liners or { id, q, a } two-part / Q&A jokes).
   Add thousands of jokes by editing JSON only — no code changes.
   Features: categories, random joke, joke of the day, search, favourites.
   Offline (service-worker cached); no third-party calls at runtime.
══════════════════════════════════════════════════════════════════ */
const HumorPage = (function () {
  'use strict';

  const BASE = 'data/humor/';
  let root, built = false, index = null;
  const cache = {};                 /* id → jokes[] */
  let favs = load('humor-favs', {});/* {jokeId: jokeObj} */

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lang = () => (typeof I18n !== 'undefined' && I18n.getLang() === 'en') ? 'en' : 'pt';

  async function getJSON(url) { try { const r = await fetch(url, { cache: 'force-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }

  async function loadIndex() {
    if (index) return index;
    const d = await getJSON(BASE + 'index.json');
    index = (d && d.categories) || [];
    return index;
  }
  async function loadCat(id) {
    if (cache[id]) return cache[id];
    const d = await getJSON(BASE + id + '.json');
    cache[id] = (Array.isArray(d) ? d : []).map(j => ({ ...j, cat: id }));
    return cache[id];
  }
  async function loadAll() {
    const idx = await loadIndex();
    const all = await Promise.all(idx.map(c => loadCat(c.id)));
    return all.flat();
  }
  const catName = id => { const c = (index || []).find(x => x.id === id); return c ? c.name : id; };
  const catIcon = id => { const c = (index || []).find(x => x.id === id); return c ? c.icon : '😂'; };

  /* ── lifecycle ─────────────────────────────────────────────────── */
  function init() {
    root = document.getElementById('view-humor');
    if (!root) return;
    injectCSS();
    renderHome();
    built = true;
  }
  function show() { if (!built) init(); }

  /* ── views ─────────────────────────────────────────────────────── */
  async function renderHome() {
    root.innerHTML = `
      <div class="view-inner">
        <div class="page-header">
          <h1 class="page-title">😂 Humor</h1>
          <p class="page-subtitle">Piadas, adivinhas e trocadilhos — escolhe uma categoria ou arrisca uma aleatória</p>
        </div>
        <div class="hm-toolbar">
          <button class="hm-tool primary" id="hm-random">🎲 Piada Aleatória</button>
          <button class="hm-tool" id="hm-daily">📅 Piada do Dia</button>
          <button class="hm-tool" id="hm-favs">⭐ Favoritas <span id="hm-favn">${Object.keys(favs).length || ''}</span></button>
          <div class="hm-search-wrap"><input class="hm-search" id="hm-search" type="search" placeholder="🔍 Pesquisar piadas…" aria-label="Pesquisar"></div>
        </div>
        <div id="hm-body"><div class="hm-loading">A carregar…</div></div>`;

    root.querySelector('#hm-random').addEventListener('click', showRandom);
    root.querySelector('#hm-daily').addEventListener('click', showDaily);
    root.querySelector('#hm-favs').addEventListener('click', showFavs);
    const s = root.querySelector('#hm-search');
    let tmr; s.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => doSearch(s.value.trim()), 250); });

    const idx = await loadIndex();
    const body = root.querySelector('#hm-body');
    if (!idx.length) { body.innerHTML = `<div class="hm-loading">Sem categorias.</div>`; return; }
    body.innerHTML = `<div class="hm-cat-grid">${idx.map(c => `
      <button class="hm-cat" data-id="${c.id}">
        <span class="hm-cat-ico">${c.icon}</span>
        <span class="hm-cat-name">${esc(c.name)}</span>
        ${c.desc ? `<span class="hm-cat-desc">${esc(c.desc)}</span>` : ''}
      </button>`).join('')}</div>`;
    body.querySelectorAll('.hm-cat').forEach(b => b.addEventListener('click', () => renderCategory(b.dataset.id)));
  }

  function backBar(title) {
    return `<div class="hm-detail-bar"><button class="hm-back" id="hm-back">← Voltar</button><h2 class="hm-detail-ttl">${title}</h2></div>`;
  }
  function wireBack() { root.querySelector('#hm-back')?.addEventListener('click', renderHome); }

  async function renderCategory(id) {
    const body = root.querySelector('#hm-body');
    body.innerHTML = `<div class="hm-loading">A carregar…</div>`;
    const jokes = await loadCat(id);
    body.innerHTML = backBar(`${catIcon(id)} ${esc(catName(id))} <span class="hm-count">${jokes.length}</span>`) +
      `<div class="hm-list">${jokes.map(jokeCard).join('')}</div>`;
    wireBack(); wireCards(body);
  }

  async function showFavs() {
    const body = root.querySelector('#hm-body');
    const list = Object.values(favs);
    body.innerHTML = backBar(`⭐ Favoritas <span class="hm-count">${list.length}</span>`) +
      (list.length ? `<div class="hm-list">${list.map(jokeCard).join('')}</div>`
                   : `<div class="hm-empty">Ainda não tens favoritas. Toca na ⭐ de uma piada para a guardar.</div>`);
    wireBack(); wireCards(body);
  }

  async function doSearch(q) {
    const body = root.querySelector('#hm-body');
    if (!q) { renderHome(); return; }
    body.innerHTML = `<div class="hm-loading">A pesquisar…</div>`;
    const all = await loadAll();
    const nq = q.toLowerCase();
    const hits = all.filter(j => ((j.t || '') + ' ' + (j.q || '') + ' ' + (j.a || '')).toLowerCase().includes(nq)).slice(0, 200);
    body.innerHTML = backBar(`🔍 "${esc(q)}" <span class="hm-count">${hits.length}</span>`) +
      (hits.length ? `<div class="hm-list">${hits.map(jokeCard).join('')}</div>` : `<div class="hm-empty">Sem resultados para “${esc(q)}”.</div>`);
    wireBack(); wireCards(body);
  }

  async function showRandom() {
    const all = await loadAll();
    if (!all.length) return;
    showSingle(all[Math.floor(Math.random() * all.length)], '🎲 Piada Aleatória', true);
  }
  async function showDaily() {
    const all = await loadAll();
    if (!all.length) return;
    const d = new Date(); const seed = d.getFullYear() * 1000 + (Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000));
    showSingle(all[seed % all.length], '📅 Piada do Dia', false);
  }
  function showSingle(j, title, again) {
    const body = root.querySelector('#hm-body');
    body.innerHTML = backBar(title) +
      `<div class="hm-single">${jokeCard(j, true)}</div>` +
      (again ? `<div class="hm-single-actions"><button class="hm-tool primary" id="hm-again">🎲 Outra</button></div>` : '');
    wireBack(); wireCards(body);
    root.querySelector('#hm-again')?.addEventListener('click', showRandom);
  }

  /* ── joke card ─────────────────────────────────────────────────── */
  function jokeCard(j, big) {
    const fav = !!favs[j.id];
    const star = `<button class="hm-star${fav ? ' on' : ''}" data-fav="${j.id}" title="Favorita" aria-label="Favorita">${fav ? '★' : '☆'}</button>`;
    const cat = `<span class="hm-tag">${catIcon(j.cat)} ${esc(catName(j.cat))}</span>`;
    let inner;
    if (j.q && j.a) {
      inner = `<div class="hm-q">${esc(j.q)}</div>
        <button class="hm-reveal">Ver resposta 👀</button>
        <div class="hm-a" hidden>${esc(j.a).replace(/\n/g, '<br>')}</div>`;
    } else {
      inner = `<div class="hm-t">${esc(j.t || '').replace(/\n/g, '<br>')}</div>`;
    }
    return `<article class="hm-joke${big ? ' big' : ''}" data-id="${j.id}" data-cat="${j.cat}">
      <div class="hm-joke-top">${cat}<div class="hm-joke-actions">${star}<button class="hm-copy" data-copy="${j.id}" title="Copiar">📋</button></div></div>
      ${inner}</article>`;
  }

  function wireCards(scope) {
    scope.querySelectorAll('.hm-reveal').forEach(b => b.addEventListener('click', () => {
      const a = b.nextElementSibling; if (a) a.hidden = false; b.remove();
    }));
    scope.querySelectorAll('.hm-star').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.fav;
      if (favs[id]) { delete favs[id]; b.classList.remove('on'); b.textContent = '☆'; }
      else {
        const art = b.closest('.hm-joke');
        const cat = art.dataset.cat, j = (cache[cat] || []).find(x => x.id === id);
        if (j) { favs[id] = j; b.classList.add('on'); b.textContent = '★'; }
      }
      save('humor-favs', favs);
      const n = root.querySelector('#hm-favn'); if (n) n.textContent = Object.keys(favs).length || '';
    }));
    scope.querySelectorAll('.hm-copy').forEach(b => b.addEventListener('click', () => {
      const art = b.closest('.hm-joke'); const id = b.dataset.copy, cat = art.dataset.cat;
      const j = (cache[cat] || Object.values(favs)).find(x => x.id === id) || favs[id];
      const txt = j ? (j.q ? `${j.q}\n${j.a}` : j.t) : '';
      if (txt) { navigator.clipboard?.writeText(txt).then(() => { b.textContent = '✅'; setTimeout(() => b.textContent = '📋', 1200); }).catch(() => {}); }
    }));
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
.hm-search-wrap{flex:1;min-width:160px}
.hm-search{width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);font:inherit;font-size:.85rem;padding:.5rem .9rem;border-radius:var(--radius-sm);outline:none}
.hm-search:focus{border-color:rgba(var(--accent-rgb),.4)}
.hm-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.8rem}
.hm-cat{display:flex;flex-direction:column;align-items:center;gap:.3rem;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:1.3rem .7rem;cursor:pointer;font:inherit;transition:all .18s}
.hm-cat:hover{border-color:rgba(var(--accent-rgb),.45);transform:translateY(-2px);background:var(--accent-soft)}
.hm-cat-ico{font-size:2rem}
.hm-cat-name{font-family:var(--font-head,inherit);font-weight:700;font-size:.92rem;color:var(--text)}
.hm-cat-desc{font-size:.66rem;color:var(--muted);text-align:center}
.hm-detail-bar{display:flex;align-items:center;gap:.8rem;margin-bottom:1rem}
.hm-back{background:var(--card2);border:1px solid var(--border);color:var(--text2);font:inherit;font-size:.8rem;font-weight:600;padding:.35rem .8rem;border-radius:var(--radius-sm);cursor:pointer}
.hm-back:hover{color:var(--accent);border-color:rgba(var(--accent-rgb),.4)}
.hm-detail-ttl{font-family:var(--font-head,inherit);font-size:1.2rem;font-weight:700;margin:0;display:flex;align-items:center;gap:.5rem}
.hm-count{font-size:.7rem;font-weight:700;color:var(--accent);background:var(--accent-soft);border:1px solid rgba(var(--accent-rgb),.3);padding:.1rem .5rem;border-radius:999px}
.hm-list{column-width:340px;column-gap:1rem}
.hm-joke{break-inside:avoid;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:.9rem 1rem;margin-bottom:1rem;display:inline-block;width:100%}
.hm-joke.big{font-size:1.1rem;max-width:560px;margin:0 auto}
.hm-joke-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
.hm-tag{font-size:.64rem;color:var(--muted);font-weight:600}
.hm-joke-actions{display:flex;gap:.3rem;align-items:center}
.hm-star,.hm-copy{background:none;border:none;cursor:pointer;font-size:1rem;color:var(--muted);padding:.1rem .2rem;line-height:1}
.hm-star.on{color:#f5b400}
.hm-star:hover,.hm-copy:hover{color:var(--accent)}
.hm-t{color:var(--text);font-size:.92rem;line-height:1.5}
.hm-q{color:var(--text);font-size:.92rem;line-height:1.5;font-weight:600;margin-bottom:.6rem}
.hm-reveal{background:var(--accent-soft);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);font:inherit;font-size:.78rem;font-weight:600;padding:.3rem .8rem;border-radius:999px;cursor:pointer}
.hm-a{margin-top:.6rem;color:var(--green,#34d399);font-size:.92rem;line-height:1.5;font-weight:600}
.hm-single{max-width:600px;margin:1rem auto}
.hm-single-actions{text-align:center;margin-top:1rem}
.hm-loading,.hm-empty{color:var(--muted);text-align:center;padding:2.5rem 1rem}
@media (max-width:600px){.hm-list{column-width:auto;column-count:1}}`;
    document.head.appendChild(s);
  }

  return { show };
})();
