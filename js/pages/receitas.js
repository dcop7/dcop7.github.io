/* ── Receitas ──────────────────────────────────────────────────────────────
   Explorador de receitas integrado, pt-PT, offline-first.
   Arquitetura: base local em JSON (primária, com região/história das portuguesas)
   + TheMealDB (variedade internacional) com cache em localStorage e fallback
   total para a base local quando não há rede.
   Nenhuma receita está hardcoded no código: o conteúdo vive em /receitas/*.json. */
const ReceitasPage = (function () {
  'use strict';

  const FILES = ['portuguesas', 'pratos', 'entradas', 'sobremesas'];
  const API = 'https://www.themealdb.com/api/json/v1/1/';
  const CACHE_TTL = 864e5; // 24 h

  let _built = false;
  let _loaded = false;
  let _all = [];

  // estado de navegação/filtros
  let _cat = 'todas';            // todas | entrada | prato | sobremesa | pt | intl
  let _search = '';
  let _diff = 'todas';           // todas | Fácil | Médio | Difícil
  let _tempo = '';               // '' | 30 | 60 | 90+
  let _cozinha = 'todas';
  let _matchMode = false;
  let _have = new Set();
  let _intlCat = 'Seafood';

  // ingredientes selecionáveis no "Tenho estes ingredientes"
  // (os tokens correspondem ao campo `principais` das receitas)
  const PANTRY = [
    ['frango','🍗','Frango'], ['vaca','🥩','Carne de vaca'], ['porco','🥓','Porco'],
    ['peixe','🐟','Peixe'], ['bacalhau','🎣','Bacalhau'], ['atum','🐟','Atum'],
    ['camarao','🦐','Camarão'], ['polvo','🐙','Polvo'], ['ovos','🥚','Ovos'],
    ['arroz','🍚','Arroz'], ['massa','🍝','Massa'], ['batata','🥔','Batata'],
    ['pao','🍞','Pão'], ['farinha','🌾','Farinha'], ['cebola','🧅','Cebola'],
    ['alho','🧄','Alho'], ['tomate','🍅','Tomate'], ['cenoura','🥕','Cenoura'],
    ['pimento','🫑','Pimento'], ['courgette','🥒','Courgette'], ['cogumelos','🍄','Cogumelos'],
    ['couve','🥬','Couve'], ['feijao','🫘','Feijão'], ['grao','🟤','Grão'],
    ['milho','🌽','Milho'], ['leite','🥛','Leite'], ['natas','🍶','Natas'],
    ['queijo','🧀','Queijo'], ['iogurte','🥛','Iogurte'], ['acucar','🍬','Açúcar'],
    ['chocolate','🍫','Chocolate'], ['limao','🍋','Limão'], ['laranja','🍊','Laranja'],
    ['maca','🍎','Maçã'], ['banana','🍌','Banana'], ['morango','🍓','Morango'],
    ['chourico','🌭','Chouriço'], ['fiambre','🍖','Fiambre'], ['salsicha','🌭','Salsicha'],
  ];

  const CATS = [
    { id:'todas',     label:'Todas',         icon:'🍳' },
    { id:'entrada',   label:'Entradas',      icon:'🥗' },
    { id:'prato',     label:'Pratos',        icon:'🍽️' },
    { id:'sobremesa', label:'Sobremesas',    icon:'🍰' },
    { id:'pt',        label:'Portuguesas',   icon:'🇵🇹' },
    { id:'intl',      label:'Internacionais',icon:'🌍' },
  ];

  // ── helpers ──────────────────────────────────────────────────────────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const catLabel = c => ({ entrada:'Entrada', prato:'Prato', sobremesa:'Sobremesa' }[c] || '');
  const catEmoji = c => ({ entrada:'🥗', prato:'🍽️', sobremesa:'🍰' }[c] || '🍴');
  const diffDot = d => ({ 'Fácil':'🟢', 'Médio':'🟡', 'Difícil':'🔴' }[d] || '⚪');

  function hashHue(str) {
    let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }
  function thumbStyle(r) {
    const hue = hashHue(r.id || r.nome || '');
    return `background:linear-gradient(135deg,hsl(${hue} 55% 32%),hsl(${(hue + 40) % 360} 50% 20%))`;
  }

  function $(sel) { return document.getElementById('view-receitas')?.querySelector(sel); }

  // ── dados locais ───────────────────────────────────────────────────────────
  async function ensureData() {
    if (_loaded) return;
    let parts = [];
    try {
      parts = await Promise.all(FILES.map(f =>
        fetch('receitas/' + f + '.json').then(r => r.ok ? r.json() : []).catch(() => [])
      ));
    } catch { parts = []; }
    const seen = new Set();
    _all = [];
    parts.forEach(arr => (arr || []).forEach(r => {
      if (r && r.id && !seen.has(r.id)) { seen.add(r.id); _all.push(r); }
    }));
    _loaded = true;
  }

  // ── TheMealDB com cache + fallback offline ──────────────────────────────────
  async function apiGet(path) {
    const key = 'rcp:' + path;
    let stale = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const v = JSON.parse(raw);
        stale = v.d;
        if (Date.now() - v.t < CACHE_TTL) return v.d;
      }
    } catch {}
    try {
      const r = await fetch(API + path);
      if (r.ok) {
        const d = await r.json();
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch {}
        return d;
      }
    } catch {}
    return stale; // offline: devolve cache antiga se existir, senão null
  }

  function normalizeMeal(m) {
    const ing = [];
    for (let i = 1; i <= 20; i++) {
      const n = m['strIngredient' + i], me = m['strMeasure' + i];
      if (n && n.trim()) ing.push(((me && me.trim()) ? me.trim() + ' ' : '') + n.trim());
    }
    const steps = (m.strInstructions || '').split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    return {
      id: 'mdb-' + m.idMeal, nome: m.strMeal, categoria: '', cozinha: m.strArea || '',
      tempo: 0, dificuldade: '', porcoes: 0, ingredientes: ing, preparacao: steps,
      img: m.strMealThumb, _mealdb: true,
    };
  }

  // ── shell ────────────────────────────────────────────────────────────────
  function buildShell(view) {
    if (_built) return;
    _built = true;
    view.innerHTML = `
      <div class="view-inner rcp">
        <div class="page-header">
          <h1 class="page-title">🍳 Receitas</h1>
          <p class="page-subtitle">Cozinha portuguesa e do mundo — pesquisa, filtra e descobre o que fazer com o que tens em casa.</p>
        </div>

        <div id="rcp-browse">
          <div class="rcp-toolbar">
            <div class="rcp-search">
              <span class="rcp-search-ic">🔍</span>
              <input id="rcp-q" type="search" placeholder="Pesquisar receita ou ingrediente…" autocomplete="off">
            </div>
            <button class="rcp-btn" id="rcp-random">🎲 Aleatória</button>
            <button class="rcp-btn rcp-btn-accent" id="rcp-have-toggle">🧺 Tenho estes ingredientes</button>
          </div>

          <div class="rcp-cats" id="rcp-cats">
            ${CATS.map(c => `<button class="rcp-chip" data-cat="${c.id}"><span>${c.icon}</span>${c.label}</button>`).join('')}
          </div>

          <div class="rcp-filters" id="rcp-filters">
            <label>Dificuldade
              <select id="rcp-f-diff">
                <option value="todas">Todas</option><option>Fácil</option><option>Médio</option><option>Difícil</option>
              </select>
            </label>
            <label>Tempo
              <select id="rcp-f-tempo">
                <option value="">Qualquer</option>
                <option value="30">Até 30 min</option>
                <option value="60">Até 1 h</option>
                <option value="90">Mais de 1 h</option>
              </select>
            </label>
            <label>Cozinha
              <select id="rcp-f-cozinha"><option value="todas">Todas</option></select>
            </label>
            <button class="rcp-clear" id="rcp-clear">Limpar</button>
          </div>

          <div class="rcp-pantry" id="rcp-pantry" hidden></div>
          <div id="rcp-results"></div>
        </div>

        <div id="rcp-detail" hidden></div>
      </div>`;

    // eventos
    const q = view.querySelector('#rcp-q');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { _search = q.value.trim(); applyAndRender(); }, 160); });

    view.querySelector('#rcp-random').addEventListener('click', randomRecipe);
    view.querySelector('#rcp-have-toggle').addEventListener('click', toggleHave);
    view.querySelector('#rcp-clear').addEventListener('click', clearFilters);

    view.querySelector('#rcp-cats').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      _cat = b.dataset.cat; applyAndRender();
    });
    view.querySelector('#rcp-f-diff').addEventListener('change', e => { _diff = e.target.value; applyAndRender(); });
    view.querySelector('#rcp-f-tempo').addEventListener('change', e => { _tempo = e.target.value; applyAndRender(); });
    view.querySelector('#rcp-f-cozinha').addEventListener('change', e => { _cozinha = e.target.value; applyAndRender(); });

    view.querySelector('#rcp-results').addEventListener('click', e => {
      const card = e.target.closest('.rcp-card'); if (!card) return;
      location.hash = '#receitas/' + card.dataset.id;
    });
    view.querySelector('#rcp-pantry').addEventListener('click', e => {
      const chip = e.target.closest('[data-ing]'); if (!chip) return;
      const ing = chip.dataset.ing;
      if (_have.has(ing)) _have.delete(ing); else _have.add(ing);
      chip.classList.toggle('on', _have.has(ing));
      const c = view.querySelector('#rcp-have-count');
      if (c) c.textContent = _have.size ? `${_have.size} selecionado(s)` : 'Escolhe o que tens';
      applyAndRender();
    });
  }

  function populateCuisines() {
    const sel = $('#rcp-f-cozinha'); if (!sel) return;
    const set = [...new Set(_all.map(r => r.cozinha).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
    sel.innerHTML = '<option value="todas">Todas</option>' + set.map(c => `<option>${esc(c)}</option>`).join('');
  }

  // ── filtragem ──────────────────────────────────────────────────────────────
  function currentList() {
    let list = _all.slice();
    if (_cat === 'pt') list = list.filter(r => r.cozinha === 'Portuguesa');
    else if (_cat === 'entrada' || _cat === 'prato' || _cat === 'sobremesa') list = list.filter(r => r.categoria === _cat);
    if (_diff !== 'todas') list = list.filter(r => r.dificuldade === _diff);
    if (_tempo === '30') list = list.filter(r => r.tempo && r.tempo <= 30);
    else if (_tempo === '60') list = list.filter(r => r.tempo && r.tempo <= 60);
    else if (_tempo === '90') list = list.filter(r => r.tempo && r.tempo > 60);
    if (_cozinha !== 'todas') list = list.filter(r => r.cozinha === _cozinha);
    if (_search) {
      const qn = norm(_search);
      list = list.filter(r =>
        norm(r.nome).includes(qn) ||
        norm(r.regiao || '').includes(qn) ||
        (r.ingredientes || []).some(i => norm(i).includes(qn)));
    }
    return list;
  }

  function matchList() {
    if (!_have.size) return [];
    return _all.map(r => {
      const P = r.principais || [];
      if (!P.length) return null;
      const have = P.filter(p => _have.has(p));
      if (!have.length) return null;
      return { r, score: have.length / P.length, have: have.length, total: P.length, missing: P.filter(p => !_have.has(p)) };
    }).filter(Boolean)
      .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length || b.have - a.have);
  }

  // ── render ─────────────────────────────────────────────────────────────────
  function syncControls() {
    $('#rcp-cats')?.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === _cat));
    const filters = $('#rcp-filters');
    if (filters) filters.style.display = (_cat === 'intl' || _matchMode) ? 'none' : '';
  }

  function applyAndRender() {
    syncControls();
    const out = $('#rcp-results'); if (!out) return;

    if (_matchMode) { renderMatch(out); return; }
    if (_cat === 'intl') { renderIntl(out); return; }

    const list = currentList();
    const isDefault = _cat === 'todas' && !_search && _diff === 'todas' && !_tempo && _cozinha === 'todas';

    if (isDefault) {
      const pop = _all.filter(r => r.popular);
      const trad = _all.filter(r => r.tradicional);
      out.innerHTML =
        gridSection('🔥 Populares', pop) +
        gridSection('🇵🇹 Tradicionais Portuguesas', trad) +
        gridSection('📚 Todas as receitas', _all);
    } else {
      out.innerHTML = list.length
        ? `<p class="rcp-count">${list.length} receita(s)</p><div class="rcp-grid">${list.map(card).join('')}</div>`
        : `<p class="rcp-empty">Sem receitas para estes critérios. Tenta limpar os filtros.</p>`;
    }
  }

  function gridSection(title, list) {
    if (!list.length) return '';
    return `<section class="rcp-sec"><h2 class="rcp-sec-title">${title} <span class="rcp-sec-n">${list.length}</span></h2>
      <div class="rcp-grid">${list.map(card).join('')}</div></section>`;
  }

  function card(r) {
    const tag = r.regiao ? esc(r.regiao) : esc(r.cozinha || '');
    return `<button class="rcp-card" data-id="${esc(r.id)}">
      <div class="rcp-thumb" style="${thumbStyle(r)}">
        ${r.img ? `<img loading="lazy" src="${esc(r.img)}" alt="">` : `<span class="rcp-emoji">${catEmoji(r.categoria)}</span>`}
        ${r.cozinha === 'Portuguesa' ? '<span class="rcp-flag">🇵🇹</span>' : ''}
      </div>
      <div class="rcp-card-body">
        <h3 class="rcp-name">${esc(r.nome)}</h3>
        <div class="rcp-meta">${r.tempo ? `<span>⏱ ${r.tempo} min</span>` : ''}${r.dificuldade ? `<span>${diffDot(r.dificuldade)} ${r.dificuldade}</span>` : ''}</div>
        <div class="rcp-tags">${r.categoria ? `<span class="rcp-cat">${catLabel(r.categoria)}</span>` : ''}${tag ? `<span class="rcp-cuis">${tag}</span>` : ''}</div>
      </div>
    </button>`;
  }

  // ── "Tenho estes ingredientes" ──────────────────────────────────────────────
  function toggleHave() {
    _matchMode = !_matchMode;
    const panel = $('#rcp-pantry');
    const btn = $('#rcp-have-toggle');
    btn?.classList.toggle('on', _matchMode);
    if (_matchMode) {
      panel.hidden = false;
      panel.innerHTML = `
        <div class="rcp-pantry-hdr">
          <strong>O que tens em casa?</strong>
          <span id="rcp-have-count" class="rcp-have-count">${_have.size ? `${_have.size} selecionado(s)` : 'Escolhe o que tens'}</span>
          <button class="rcp-clear" id="rcp-pantry-clear">Limpar seleção</button>
        </div>
        <div class="rcp-ings">
          ${PANTRY.map(([t, e, l]) => `<button class="rcp-ing ${_have.has(t) ? 'on' : ''}" data-ing="${t}"><span>${e}</span>${l}</button>`).join('')}
        </div>`;
      panel.querySelector('#rcp-pantry-clear').addEventListener('click', () => {
        _have.clear();
        panel.querySelectorAll('.rcp-ing').forEach(c => c.classList.remove('on'));
        const c = $('#rcp-have-count'); if (c) c.textContent = 'Escolhe o que tens';
        applyAndRender();
      });
    } else {
      panel.hidden = true;
    }
    applyAndRender();
  }

  function renderMatch(out) {
    if (!_have.size) {
      out.innerHTML = `<p class="rcp-empty">Seleciona os ingredientes que tens em casa para veres o que podes cozinhar.</p>`;
      return;
    }
    const ranked = matchList();
    if (!ranked.length) { out.innerHTML = `<p class="rcp-empty">Nenhuma receita corresponde a esses ingredientes.</p>`; return; }
    const canMake = ranked.filter(x => x.score === 1);
    out.innerHTML =
      (canMake.length ? `<p class="rcp-count">✅ Podes fazer ${canMake.length} receita(s) já!</p>` : `<p class="rcp-count">${ranked.length} sugestão(ões) ordenadas por compatibilidade</p>`) +
      `<div class="rcp-grid">${ranked.map(matchCard).join('')}</div>`;
  }

  function matchCard(x) {
    const r = x.r, pct = Math.round(x.score * 100);
    const badge = x.score === 1
      ? `<span class="rcp-match rcp-match-ok">✅ Tens tudo</span>`
      : `<span class="rcp-match">${x.have}/${x.total} • faltam ${x.missing.length}</span>`;
    const miss = x.missing.length ? `<div class="rcp-miss">Faltam: ${x.missing.map(m => esc(panLabel(m))).join(', ')}</div>` : '';
    return `<button class="rcp-card" data-id="${esc(r.id)}">
      <div class="rcp-thumb" style="${thumbStyle(r)}">
        <span class="rcp-emoji">${catEmoji(r.categoria)}</span>
        ${r.cozinha === 'Portuguesa' ? '<span class="rcp-flag">🇵🇹</span>' : ''}
        <span class="rcp-pct" style="--p:${pct}">${pct}%</span>
      </div>
      <div class="rcp-card-body">
        <h3 class="rcp-name">${esc(r.nome)}</h3>
        <div class="rcp-meta">${badge}</div>
        ${miss}
      </div>
    </button>`;
  }
  function panLabel(t) { const f = PANTRY.find(p => p[0] === t); return f ? f[2] : t; }

  // ── Internacionais (TheMealDB) ──────────────────────────────────────────────
  async function renderIntl(out) {
    out.innerHTML = `<p class="rcp-loading">A carregar receitas internacionais…</p>`;
    const cats = await apiGet('categories.php');
    if (!cats || !cats.categories) {
      out.innerHTML = `<p class="rcp-empty">Sem ligação para carregar receitas internacionais. As receitas portuguesas e locais continuam disponíveis offline. 🔌</p>`;
      return;
    }
    const list = cats.categories.map(c => c.strCategory);
    if (!list.includes(_intlCat)) _intlCat = list[0];
    const data = await apiGet('filter.php?c=' + encodeURIComponent(_intlCat));
    const meals = (data && data.meals) || [];
    out.innerHTML = `
      <div class="rcp-intl-note">🌍 Receitas internacionais via <strong>TheMealDB</strong> (em inglês). Guardadas em cache para uso offline.</div>
      <div class="rcp-intl-cats">${list.map(c => `<button class="rcp-ichip ${c === _intlCat ? 'on' : ''}" data-icat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${meals.length ? `<div class="rcp-grid">${meals.map(intlCard).join('')}</div>` : `<p class="rcp-empty">Sem receitas nesta categoria.</p>`}`;
    out.querySelector('.rcp-intl-cats').addEventListener('click', e => {
      const b = e.target.closest('[data-icat]'); if (!b) return;
      _intlCat = b.dataset.icat; renderIntl(out);
    }, { once: true });
    out.querySelectorAll('.rcp-card').forEach(c => c.addEventListener('click', () => {
      location.hash = '#receitas/mdb-' + c.dataset.mid;
    }));
  }

  function intlCard(m) {
    return `<button class="rcp-card" data-mid="${esc(m.idMeal)}">
      <div class="rcp-thumb"><img loading="lazy" src="${esc(m.strMealThumb)}" alt=""></div>
      <div class="rcp-card-body"><h3 class="rcp-name">${esc(m.strMeal)}</h3></div>
    </button>`;
  }

  // ── aleatória ───────────────────────────────────────────────────────────────
  function randomRecipe() {
    if (!_all.length) return;
    const r = _all[Math.floor(Math.random() * _all.length)];
    location.hash = '#receitas/' + r.id;
  }

  // ── detalhe ────────────────────────────────────────────────────────────────
  function showBrowse() {
    const b = $('#rcp-browse'), d = $('#rcp-detail');
    if (b) b.hidden = false;
    if (d) { d.hidden = true; d.innerHTML = ''; }
  }

  async function openDetail(id) {
    const b = $('#rcp-browse'), d = $('#rcp-detail');
    if (!d) return;
    if (b) b.hidden = true;
    d.hidden = false;
    if (id.indexOf('mdb-') === 0) {
      d.innerHTML = `<p class="rcp-loading">A carregar receita…</p>`;
      const data = await apiGet('lookup.php?i=' + encodeURIComponent(id.slice(4)));
      const m = data && data.meals && data.meals[0];
      if (!m) { d.innerHTML = `<p class="rcp-empty">Não foi possível carregar esta receita.</p><p><a class="rcp-back" href="#receitas">← Voltar</a></p>`; return; }
      renderDetail(d, normalizeMeal(m));
      return;
    }
    const r = _all.find(x => x.id === id);
    if (!r) { location.hash = '#receitas'; return; }
    renderDetail(d, r);
  }

  function renderDetail(d, r) {
    const meta = [];
    if (r.categoria) meta.push(`<span>${catEmoji(r.categoria)} ${catLabel(r.categoria)}</span>`);
    if (r.cozinha) meta.push(`<span>🌍 ${esc(r.cozinha)}</span>`);
    if (r.regiao) meta.push(`<span>📍 ${esc(r.regiao)}</span>`);
    if (r.tempo) meta.push(`<span>⏱ ${r.tempo} min</span>`);
    if (r.dificuldade) meta.push(`<span>${diffDot(r.dificuldade)} ${r.dificuldade}</span>`);
    if (r.porcoes) meta.push(`<span>🍽️ ${r.porcoes} porções</span>`);

    d.innerHTML = `
      <a class="rcp-back" href="#receitas">← Voltar às receitas</a>
      <article class="rcp-detail">
        <div class="rcp-d-hero" style="${r.img ? '' : thumbStyle(r)}">
          ${r.img ? `<img src="${esc(r.img)}" alt="${esc(r.nome)}">` : `<span class="rcp-emoji rcp-emoji-lg">${catEmoji(r.categoria)}</span>`}
          ${r.cozinha === 'Portuguesa' ? '<span class="rcp-flag rcp-flag-lg">🇵🇹</span>' : ''}
        </div>
        <h1 class="rcp-d-title">${esc(r.nome)}</h1>
        <div class="rcp-d-meta">${meta.join('')}</div>
        ${r._mealdb ? `<p class="rcp-d-src">Receita via TheMealDB (conteúdo em inglês).</p>` : ''}
        ${r.historia ? `<div class="rcp-d-hist"><h2>📖 História</h2><p>${esc(r.historia)}</p></div>` : ''}
        <div class="rcp-d-cols">
          <section class="rcp-d-ings">
            <h2>🧺 Ingredientes</h2>
            <ul>${(r.ingredientes || []).map(i => `<li><label><input type="checkbox"> <span>${esc(i)}</span></label></li>`).join('')}</ul>
          </section>
          <section class="rcp-d-steps">
            <h2>👨‍🍳 Preparação</h2>
            <ol>${(r.preparacao || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          </section>
        </div>
        ${r.tradicional ? `<p class="rcp-d-badge">🇵🇹 Receita tradicional portuguesa</p>` : ''}
      </article>`;

    // riscar ingredientes ao clicar
    d.querySelectorAll('.rcp-d-ings input').forEach(cb =>
      cb.addEventListener('change', () => cb.closest('label').classList.toggle('done', cb.checked)));
    d.scrollIntoView ? window.scrollTo(0, 0) : null;
  }

  // ── entrada ────────────────────────────────────────────────────────────────
  async function show(sub) {
    const view = document.getElementById('view-receitas');
    if (!view) return;
    buildShell(view);
    await ensureData();
    populateCuisines();
    if (sub) {
      openDetail(sub);
    } else {
      showBrowse();
      applyAndRender();
    }
  }

  function clearFilters() {
    _cat = 'todas'; _search = ''; _diff = 'todas'; _tempo = ''; _cozinha = 'todas';
    const v = document.getElementById('view-receitas');
    if (v) {
      v.querySelector('#rcp-q').value = '';
      v.querySelector('#rcp-f-diff').value = 'todas';
      v.querySelector('#rcp-f-tempo').value = '';
      v.querySelector('#rcp-f-cozinha').value = 'todas';
    }
    if (_matchMode) toggleHave();
    else applyAndRender();
  }

  return { show };
})();
