/* ══════════════════════════════════════════════════════════════════
   Diogo Photography — shell do microsite (/photography/)
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

  /* Transição de página nativa (View Transitions, Baseline desde o Firefox
     144): um cruzamento curto em vez de um corte. Sem suporte, ou com
     movimento reduzido, a página troca como sempre trocou. */
  const _noMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function apply(r, how) {
    const sameArea = _cur !== null && head(_cur) === head(r);
    if (how === 'push' && !sameArea && document.startViewTransition && !_noMotion.matches && !document.body.classList.contains('dk-on')) {
      document.startViewTransition(() => paint(r, how));
    } else paint(r, how);
  }
  function paint(r, how) {
    const home = r === '';
    if (_cur !== null) _scroll[_cur] = window.scrollY;
    const prev = _cur;
    _cur = r;

    document.body.dataset.route = home ? 'home' : 'page';
    document.body.dataset.depth = TOP.has(r) || /^laboratorio\/(?!camara)[a-z]+$/.test(r) ? 'top' : 'deep';
    document.querySelectorAll('[data-home-only]').forEach(el => { el.hidden = !home; });
    PhShell.closeMenu();

    if (typeof PhotographyPage !== 'undefined') PhotographyPage.show(r || null);
    PhShell.routeChanged(r);

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
  const SITE = 'Diogo Photography';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  /* ── navegação ativa + título ── */
  function setArea(id, label) {
    $$('[data-area]').forEach(a => {
      const on = a.dataset.area === id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    _area = label || '';
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

  /* ── página guardada + título da página ── */
  let _area = '';
  function routeChanged(r) {
    const b = $('[data-fav-toggle]');
    if (b) {
      const on = PhFav.has(r);
      b.hidden = r === '';
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', on ? 'Tirar esta página dos guardados' : 'Guardar esta página');
      b.title = on ? 'Guardada — clica para tirar' : 'Guardar esta página';
    }
    if (!r) return;
    /* o título do separador passa a dizer a página e não só a área */
    PhSearch.titleFor(r).then(it => {
      if (!it || PhNav.current() !== r) return;
      document.title = it.t + ' · ' + SITE;
      /* dentro de um item o <h1> da área fica escondido à vista: passa a dizer
         o nome da página, para quem navega por cabeçalhos */
      const h1 = $('.dp-head-t');
      if (h1 && document.body.dataset.depth === 'deep') h1.textContent = it.t;
    });
  }
  function toggleFav() {
    const r = PhNav.current(); if (!r) return;
    PhSearch.titleFor(r).then(it => {
      const added = PhFav.toggle({ r, t: it ? it.t : (document.title.split(' · ')[0] || r), s: it ? it.s : _area });
      routeChanged(r);
      toast(added ? 'Guardada. Encontras as páginas guardadas no índice e na pesquisa.' : 'Tirada dos guardados.', 2600);
    });
  }
  function renderFavs() {
    const favs = PhFav.all();
    const html = favs.map(f => `<a href="#${f.r}"><b>${f.t.replace(/[&<>"]/g, '')}</b><small>${(f.s || '').replace(/[&<>"]/g, '')}</small></a>`).join('');
    $$('.dp-menu-fav, .dp-favs').forEach(box => {
      box.hidden = !favs.length;
      const l = box.querySelector('.dp-menu-fav-list, .dp-favs-list'); if (l) l.innerHTML = html;
    });
  }

  let _toastT = 0;
  function toast(msg, ms) {
    const t = $('#dp-toast'); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(_toastT);
    if (ms) _toastT = setTimeout(() => { t.hidden = true; }, ms);
  }

  /* Deslizar a página com o dedo a começar em cima de um cursor: o browser
     muda logo o valor (toque na calha) e só depois percebe que era scroll,
     altura em que cancela o gesto (pointercancel). Sem isto, percorrer um
     painel cheio de cursores no telemóvel mudava definições sem querer.
     Guarda-se o valor ao tocar e, se o gesto for cancelado para scroll,
     repõe-se — com os eventos normais, para quem ouve o cursor redesenhar. */
  function guardRanges() {
    let held = null;
    document.addEventListener('pointerdown', e => {
      const t = e.target;
      held = e.pointerType === 'touch' && t && t.matches && t.matches('input[type="range"]') ? { el: t, v: t.value } : null;
    }, true);
    document.addEventListener('pointerup', () => { held = null; }, true);
    document.addEventListener('pointercancel', e => {
      const h = held; held = null;
      if (!h || e.target !== h.el || h.el.value === h.v) return;
      h.el.value = h.v;
      h.el.dispatchEvent(new Event('input', { bubbles: true }));
      h.el.dispatchEvent(new Event('change', { bubbles: true }));
      h.el.dispatchEvent(new CustomEvent('ph:range-revert', { bubbles: true }));
    }, true);
  }

  function init() {
    syncTheme();
    guardRanges();
    $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
    $('[data-fav-toggle]')?.addEventListener('click', toggleFav);
    document.addEventListener('ph:favs', renderFavs);
    renderFavs();
    /* atalho de pesquisa: ⌘K nos Mac */
    if (/Mac|iPhone|iPad/.test(navigator.platform || '')) $$('.dp-search-btn kbd').forEach(k => { k.textContent = '⌘K'; });
    $('[data-menu-open]')?.addEventListener('click', openMenu);
    $('[data-menu-close]')?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') return closeMenu();
      const m = $('#dp-menu');
      if (e.key !== 'Tab' || !m || m.hidden) return;
      const f = $$('a[href], button:not([disabled])', m).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    /* um clique num item do índice que já é a rota atual não dispara
       hashchange — fechar o índice à mesma */
    $$('.dp-menu-list a, .dp-menu-fav-list').forEach(a => a.addEventListener('click', closeMenu));
    $$('[data-scroll]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); closeMenu(); scrollToSheet(); }));
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

    /* emojis herdados → ícones de traço, em tudo o que os capítulos desenharem */
    PhIcon.watch(document.body);

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

  return { setArea, closeMenu, toast, routeChanged, renderFavs };
})();
