/* ══════════════════════════════════════════════════════════════════
   DCOP7 Photography — shell do microsite (/photography/)
   ──────────────────────────────────────────────────────────────────
   Substitui o que o portal dava à secção Fotografia: router (o Nav.go do
   portal), item ativo da navegação, tema, índice móvel e service worker.

   Rotas por HASH (o GitHub Pages não reescreve caminhos): /photography/#<rota>
   com as MESMAS rotas que a secção tinha no portal sem o prefixo
   "photography/" — g/<género>, aprender/<cap>[/<item>], edicao[/<ferr>],
   consulta[/…], laboratorio, estudio… A rota vazia é a home (hero +
   folha de contactos). O PhotographyPage.show(sub) não mudou de contrato.
   ══════════════════════════════════════════════════════════════════ */
const PhNav = (function () {
  'use strict';

  const TOP = new Set(['', 'fotografar', 'aprender', 'edicao', 'laboratorio', 'ferramentas', 'calc',
    'consulta', 'cs', 'cheatsheets', 'equipamento', 'cenarios', 'composicao', 'cores']);
  const _scroll = Object.create(null);   // posição por rota (para o "voltar")
  let _cur = null;

  /* Aceita "aprender/x", "#aprender/x", "photography/aprender/x" (forma do
     portal — ligações antigas e dados que a tenham guardado). */
  function norm(r) {
    let s = String(r == null ? '' : r).trim().replace(/^#/, '').replace(/^\/+/, '');
    if (s === 'photography') s = '';
    else if (s.startsWith('photography/')) s = s.slice(12);
    if (s === 'fotografar') s = '';
    return s.replace(/\/+$/, '');
  }
  const head = r => r.split('/')[0];

  function apply(r, how) {
    const home = r === '';
    if (_cur !== null) _scroll[_cur] = window.scrollY;
    const prev = _cur;
    _cur = r;

    document.body.dataset.route = home ? 'home' : 'page';
    document.body.dataset.depth = TOP.has(r) ? 'top' : 'deep';
    document.querySelectorAll('[data-home-only]').forEach(el => { el.hidden = !home; });
    PhShell.closeMenu();

    if (typeof PhotographyPage !== 'undefined') PhotographyPage.show(r || null);

    if (how === 'pop') {
      /* atrás/à frente: devolver a página onde estava (o render é síncrono
         só em parte — os dados chegam por fetch — por isso dois frames e uma
         segunda tentativa quando a altura já chega) */
      const y = _scroll[r];
      if (y != null) {
        const restore = (n) => requestAnimationFrame(() => {
          if (document.documentElement.scrollHeight >= y + innerHeight * .5 || n > 20) window.scrollTo({ top: y });
          else setTimeout(() => restore(n + 1), 60);
        });
        restore(0);
      }
    } else if (prev !== null && head(prev) !== head(r)) {
      window.scrollTo({ top: 0 });
    }
  }

  function go(route, opt) {
    const r = norm(route);
    const url = r ? '#' + r : location.pathname + location.search;
    if (opt && opt.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    apply(r, 'push');
  }

  function fromLocation(how) {
    const raw = location.hash.slice(1);
    let r;
    try { r = norm(decodeURIComponent(raw)); } catch (_) { r = norm(raw); }
    /* "#" sozinho ou forma antiga com prefixo → URL limpa, sem nova entrada */
    if ((raw === '' && location.href.endsWith('#')) || raw !== r) {
      history.replaceState(null, '', r ? '#' + r : location.pathname + location.search);
    }
    /* atrás/à frente disparam popstate E hashchange: pintar uma vez só */
    if (how === 'pop' && r === _cur) return;
    apply(r, how);
  }

  return { go, norm, fromLocation, current: () => _cur };
})();

const PhShell = (function () {
  'use strict';
  const SITE = 'DCOP7 Photography';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  /* ── navegação ativa + título ── */
  function setArea(id, label) {
    $$('[data-area]').forEach(a => {
      const on = a.dataset.area === id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = (document.body.dataset.route === 'home' || !label) ? SITE + ' — escola visual de fotografia' : label + ' · ' + SITE;
  }

  /* ── tema: câmara escura (predefinição) / prova em papel ── */
  function syncTheme() {
    const light = document.body.classList.contains('light');
    $$('[data-theme-toggle]').forEach(b => {
      if (b.classList.contains('dp-icon-btn')) b.setAttribute('aria-label', light ? 'Mudar para tema escuro' : 'Mudar para tema claro');
    });
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = light ? '#f3eee4' : '#0f0d0a';
  }
  function toggleTheme() {
    const light = document.body.classList.toggle('light');
    try { localStorage.setItem('dp-theme', light ? 'light' : 'dark'); } catch (_) {}
    syncTheme();
    /* os capítulos desenham alguns canvas com cores do tema: repintar a rota */
    const r = PhNav.current();
    if (r !== null && typeof PhotographyPage !== 'undefined') PhotographyPage.show(r || null);
  }

  /* ── índice móvel ── */
  let _lastFocus = null;
  function openMenu() {
    const m = $('#dp-menu'); if (!m) return;
    _lastFocus = document.activeElement;
    m.hidden = false;
    document.body.classList.add('dp-menu-open');
    $('[data-menu-open]')?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => ($('.dp-menu-list a.active', m) || $('.dp-menu-list a', m))?.focus());
  }
  function closeMenu() {
    const m = $('#dp-menu'); if (!m || m.hidden) return;
    m.hidden = true;
    document.body.classList.remove('dp-menu-open');
    $('[data-menu-open]')?.setAttribute('aria-expanded', 'false');
    if (_lastFocus && document.contains(_lastFocus)) _lastFocus.focus();
  }

  /* ── âncoras dentro da home (#folha) — não são rotas ── */
  function scrollToSheet() {
    const go = () => {
      const el = document.getElementById('folha');
      if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return !!el;
    };
    if (PhNav.current() !== '') PhNav.go('');
    if (!go()) { let n = 0; const t = setInterval(() => { if (go() || ++n > 40) clearInterval(t); }, 80); }
  }

  let _toastT = 0;
  function toast(msg, ms) {
    const t = $('#dp-toast'); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(_toastT);
    if (ms) _toastT = setTimeout(() => { t.hidden = true; }, ms);
  }

  function init() {
    syncTheme();
    $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
    $('[data-menu-open]')?.addEventListener('click', openMenu);
    $('[data-menu-close]')?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    /* um clique num item do índice que já é a rota atual não dispara
       hashchange — fechar o índice à mesma */
    $$('.dp-menu-list a').forEach(a => a.addEventListener('click', closeMenu));
    $$('[data-scroll]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); scrollToSheet(); }));
    /* Ligações internas (#rota) passam pelo router como navegação NOVA
       (pushState + topo da página). Assim o hashchange/popstate fica só para
       atrás/à frente, que restauram a posição. Corre em bubbling, depois dos
       handlers dos capítulos — se um deles já tratou o clique, não faz nada. */
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.target || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (href === '#main') {                  // ligação de salto: foco, não rota
        e.preventDefault();
        const m = document.getElementById('main');
        m.focus({ preventScroll: true }); m.scrollIntoView();
        return;
      }
      e.preventDefault();
      closeMenu();
      PhNav.go(href);
    });

    window.addEventListener('hashchange', () => PhNav.fromLocation('pop'));
    window.addEventListener('popstate', () => PhNav.fromLocation('pop'));
    PhNav.fromLocation('init');

    window.addEventListener('offline', () => toast('Sem ligação. O que já abriste continua disponível.'));
    window.addEventListener('online', () => toast('Ligação restabelecida.', 2500));

    /* Service worker PRÓPRIO, com âmbito /photography/: ganha ao /sw.js do
       portal para estas páginas (o âmbito mais específico manda) e tem cache
       própria (foto-*), que o SW do portal já não apaga. */
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/photography/sw.js', { scope: '/photography/' }).catch(() => {});
      });
    }
  }

  /* Os scripts defer correm com readyState já 'interactive' mas ANTES do
     DOMContentLoaded — e o photography.js ainda nem correu. Esperar pelo
     evento; só se ele já passou (script injetado tarde) arrancar no tick seguinte. */
  if (document.readyState === 'complete') setTimeout(init);
  else document.addEventListener('DOMContentLoaded', init);

  return { setArea, closeMenu, toast };
})();
