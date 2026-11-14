/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — utilitários partilhados (global `Pr`)
   ──────────────────────────────────────────────────────────────────
   • esc / L / t      — escapar HTML, texto bilingue {pt,en}, I18n.t
   • dias simulados   — o mundo de exemplo tem um calendário fixo e
                        fictício: dia 0 = segunda, 26 out 2026
   • KINDS            — as quatro espécies (Ações, Informação, Hoje,
                        Estrutura): cor, nome, pergunta, lugar
   • fly / pop        — animações funcionais (Anime.js se houver e se o
                        utilizador não pediu menos movimento)
   ══════════════════════════════════════════════════════════════════ */
const Pr = (function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt') === 'en' ? 'en' : 'pt';
  /* texto bilingue: {pt,en} → língua atual; string → tal e qual (o que o
     utilizador escreveu fica na língua em que o escreveu) */
  const L = v => v == null ? '' : (typeof v === 'object' && !Array.isArray(v)) ? (v[lang()] != null ? v[lang()] : (v.pt != null ? v.pt : v.en || '')) : String(v);
  const t = (k, vars) => (typeof I18n !== 'undefined' ? I18n.t(k, vars) : k);
  /* frase curta inline, bilingue, sem chave: Pr.tx('Olá', 'Hello') */
  const tx = (pt, en) => lang() === 'en' ? en : pt;

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const uid = (p) => (p || 'x') + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ── calendário simulado ── */
  const BASE = new Date(2026, 9, 26);   // segunda-feira, 26 out 2026
  function dateOf(d) { const x = new Date(BASE); x.setDate(x.getDate() + d); return x; }
  const WD = { pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
  const WDL = { pt: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
  const MO = { pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  function fmtDay(d, opt) {
    if (d == null) return '';
    const x = dateOf(d), l = lang();
    if (opt === 'long') return `${WDL[l][x.getDay()]}, ${x.getDate()} ${MO[l][x.getMonth()]}`;
    if (opt === 'short') return `${x.getDate()} ${MO[l][x.getMonth()]}`;
    return `${WD[l][x.getDay()]} ${x.getDate()} ${MO[l][x.getMonth()]}`;
  }
  /* "hoje", "amanhã", "ontem", "há 3 d", "qui" */
  function relDay(d, now) {
    if (d == null) return '';
    const n = d - now;
    if (n === 0) return tx('hoje', 'today');
    if (n === 1) return tx('amanhã', 'tomorrow');
    if (n === -1) return tx('ontem', 'yesterday');
    if (n < 0) return tx(`há ${-n} d`, `${-n} d ago`);
    if (n < 7) return WD[lang()][dateOf(d).getDay()];
    return fmtDay(d, 'short');
  }
  const weekday = d => dateOf(d).getDay();

  /* ── as quatro espécies ── */
  const KINDS = {
    act:   { cls: 'k-act',   name: { pt: 'Ações', en: 'Actions' }, one: { pt: 'Ação', en: 'Action' },
             q: { pt: 'O que tenho de fazer, insistir ou verificar?', en: 'What do I need to do, chase or verify?' },
             place: { pt: 'Lista de tarefas', en: 'Task list' } },
    info:  { cls: 'k-info',  name: { pt: 'Informação', en: 'Information' }, one: { pt: 'Informação', en: 'Information' },
             q: { pt: 'O que ouvi, decidi ou aprendi — e onde o procuro?', en: 'What did I hear, decide or learn — and where do I look it up?' },
             place: { pt: 'Caixa de notas', en: 'Notes inbox' } },
    today: { cls: 'k-today', name: { pt: 'Hoje', en: 'Today' }, one: { pt: 'Hoje', en: 'Today' },
             q: { pt: 'Em que me foco hoje?', en: 'What am I focusing on today?' },
             place: { pt: 'Caderno (Big 3)', en: 'Notebook (Big 3)' } },
    str:   { cls: 'k-str',   name: { pt: 'Estrutura', en: 'Structure' }, one: { pt: 'Estrutura', en: 'Structure' },
             q: { pt: 'Quais são os meus projetos, equipas, pessoas — e como se ligam?', en: 'What are my projects, teams, people — and how do they link?' },
             place: { pt: 'Bases de dados', en: 'Databases' } },
  };
  const kindTag = k => `<span class="k-tag ${KINDS[k].cls}">${esc(L(KINDS[k].name))}</span>`;

  /* rótulos de origem: conceito estabelecido / escolha deste sistema / a verificar */
  function srcTag(kind) {
    if (kind === 'est') return `<span class="src-tag est" title="${esc(tx('Vem da literatura (GTD, PARA, BuJo…)', 'Comes from the literature (GTD, PARA, BuJo…)'))}">${esc(tx('conceito', 'concept'))}</span>`;
    if (kind === 'own') return `<span class="src-tag own" title="${esc(tx('Uma decisão de desenho do sistema de referência — adapta-a', 'A design decision of the reference system — adapt it'))}">${esc(tx('escolha do sistema', 'system choice'))}</span>`;
    return `<span class="src-tag chk" title="${esc(tx('Depende do produto e muda com o tempo', 'Depends on the product and changes over time'))}">${esc(tx('confirmar na app', 'check in the app'))}</span>`;
  }

  const ICON = {
    local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  };

  function localNote(extra) {
    return `<p class="pr-local">${ICON.local}<span>${esc(tx('Simulação local no teu browser — não liga a nenhuma conta nem sincroniza nada.', 'Local simulation in your browser — it does not connect to any account or sync anything.'))}${extra ? ' ' + esc(extra) : ''}</span></p>`;
  }

  /* ── movimento ── */
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOk = () => typeof anime !== 'undefined' && !reduced();
  function pop(el) {
    if (!el || !motionOk()) return;
    anime.remove(el);
    anime({ targets: el, scale: [.96, 1], opacity: [.4, 1], duration: 260, easing: 'easeOutBack', complete: () => { el.style.transform = ''; el.style.opacity = ''; } });
  }
  function stagger(els) {
    els = Array.from(els || []).slice(0, 24);
    if (!els.length || !motionOk()) return;
    anime({ targets: els, opacity: [0, 1], translateY: [8, 0], duration: 300, delay: anime.stagger(28), easing: 'cubicBezier(.22,.9,.32,1)',
      complete: () => els.forEach(e => { e.style.transform = ''; e.style.opacity = ''; }) });
  }
  /* um "fantasma" do elemento voa da origem ao destino — mostra para ONDE
     uma coisa foi (captura → caixa, nota → equipa…). Resolve sempre. */
  function fly(fromEl, toEl, opt) {
    return new Promise(res => {
      if (!fromEl || !toEl || !motionOk()) return res();
      const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
      if (!a.width || !b.width) return res();
      const g = document.createElement('div');
      g.className = 'pr-ghost ' + ((opt && opt.cls) || '');
      g.textContent = (opt && opt.text) || fromEl.textContent.trim().slice(0, 60);
      Object.assign(g.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: Math.min(a.width, 320) + 'px', zIndex: 500, pointerEvents: 'none' });
      document.body.appendChild(g);
      const dx = b.left + b.width / 2 - (a.left + Math.min(a.width, 320) / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      anime({ targets: g, translateX: [0, dx], translateY: [0, dy], scale: [1, .45], opacity: [1, .15], duration: 520, easing: 'cubicBezier(.5,0,.2,1)',
        complete: () => { g.remove(); res(); } });
    });
  }

  let _toastT = 0;
  function toast(msg, action) {
    const el = $('#pr-toast'); if (!el) return;
    el.innerHTML = esc(msg) + (action ? ` <button type="button">${esc(action.label)}</button>` : '');
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.run(); };
    clearTimeout(_toastT);
    _toastT = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2600);
  }

  /* guarda simples em localStorage (nunca rebenta) */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };

  const crumbs = (items) => `<nav class="pr-crumbs" aria-label="${esc(tx('Caminho', 'Breadcrumb'))}">${items.map((it, i) =>
    (i ? '<span aria-hidden="true">›</span>' : '') + (it.href ? `<a href="${esc(it.href)}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`)).join('')}</nav>`;

  /* registo de páginas: cada módulo regista os prefixos de rota que pinta.
     render(rest, el) recebe o resto da rota ("notion/notes") e o contentor. */
  const routes = {};
  const route = (prefix, render) => { routes[prefix] = render; };

  return { routes, route, esc, L, t, tx, lang, $, $$, uid, clone, BASE, dateOf, fmtDay, relDay, weekday, KINDS, kindTag, srcTag, ICON, localNote,
    motionOk, pop, stagger, fly, toast, store, crumbs };
})();
