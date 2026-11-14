/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — shell do microsite (/productivity/)
   ──────────────────────────────────────────────────────────────────
   Mesmo padrão do microsite da Fotografia: router por HASH (o GitHub
   Pages não reescreve caminhos), área ativa na navegação 01–04, tema,
   língua (o I18n partilhado do portal), índice móvel e service worker
   próprio (caches prod-*).
   ══════════════════════════════════════════════════════════════════ */
const PrNav = (function () {
  'use strict';
  const _scroll = Object.create(null);
  let _cur = null;

  function norm(r) {
    let s = String(r == null ? '' : r).trim().replace(/^#/, '').replace(/^\/+/, '');
    if (s === 'produtividade' || s === 'productivity') s = '';
    else if (/^(produtividade|productivity)\//.test(s)) s = s.replace(/^[^/]+\//, '');
    return s.replace(/\/+$/, '');
  }
  const head = r => r.split('/')[0];

  function apply(r, how) {
    if (_cur !== null) _scroll[_cur] = window.scrollY;
    const prev = _cur;
    _cur = r;
    PrShell.closeMenu();
    if (typeof PrApp !== 'undefined') PrApp.show(r, { how, prev });
    if (how === 'pop') {
      const y = _scroll[r];
      if (y != null) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
    } else if (prev !== null && (head(prev) !== head(r) || r.split('/').length !== prev.split('/').length || !PrApp.sameScreen(prev, r))) {
      window.scrollTo({ top: 0 });
    }
  }

  function go(route, opt) {
    const r = norm(route);
    const url = r ? '#' + r : location.pathname + location.search;
    if (opt && opt.replace) history.replaceState(null, '', url);
    else if (r !== _cur) history.pushState(null, '', url);
    apply(r, opt && opt.keep ? 'keep' : 'push');
  }

  function fromLocation(how) {
    const raw = location.hash.slice(1);
    let r;
    try { r = norm(decodeURIComponent(raw)); } catch (_) { r = norm(raw); }
    if ((raw === '' && location.href.endsWith('#')) || raw !== r) {
      history.replaceState(null, '', r ? '#' + r : location.pathname + location.search);
    }
    if (how === 'pop' && r === _cur) return;
    apply(r, how);
  }

  return { go, norm, fromLocation, current: () => _cur, refresh: () => { if (_cur !== null) PrApp.show(_cur, { how: 'refresh' }); } };
})();

const PrShell = (function () {
  'use strict';
  const SITE = 'DCOP7 Productivity';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  function setArea(id, label) {
    $$('[data-area]').forEach(a => {
      const on = a.dataset.area === id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = label ? label + ' · ' + SITE : SITE + ' — ' + Pr.t('pr.site.tag');
  }

  function syncChrome() {
    const dark = document.body.classList.contains('dark');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#14171d' : '#f7f4ee';
    $$('[data-theme-toggle].pr-icon-btn').forEach(b => b.setAttribute('aria-label', Pr.tx(dark ? 'Mudar para tema claro' : 'Mudar para tema escuro', dark ? 'Switch to light theme' : 'Switch to dark theme')));
    $$('[data-lang-toggle].pr-icon-btn').forEach(b => { b.textContent = Pr.t('pr.lang.btn'); b.setAttribute('aria-label', Pr.t('pr.lang.title')); });
    $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', Pr.t(el.dataset.i18nAria)));
    $('[data-menu-open]')?.setAttribute('aria-label', Pr.t('pr.menu.open'));
    $('[data-menu-close]')?.setAttribute('aria-label', Pr.t('pr.menu.close'));
    const sk = document.querySelector('.pr-skip'); if (sk) sk.textContent = Pr.t('pr.skip');
  }
  function toggleTheme() {
    const dark = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('light', !dark);
    try { localStorage.setItem('pr-theme', dark ? 'dark' : 'light'); } catch (_) {}
    syncChrome();
    document.dispatchEvent(new CustomEvent('pr:theme'));
  }

  let _lastFocus = null;
  function openMenu() {
    const m = $('#pr-menu'); if (!m) return;
    _lastFocus = document.activeElement;
    m.hidden = false;
    document.body.classList.add('pr-menu-open');
    $('[data-menu-open]')?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => ($('.pr-menu-list a.active', m) || $('.pr-menu-list a', m))?.focus());
  }
  function closeMenu() {
    const m = $('#pr-menu'); if (!m || m.hidden) return;
    m.hidden = true;
    document.body.classList.remove('pr-menu-open');
    $('[data-menu-open]')?.setAttribute('aria-expanded', 'false');
    if (_lastFocus && document.contains(_lastFocus)) _lastFocus.focus();
  }

  function init() {
    syncChrome();
    $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
    $$('[data-lang-toggle]').forEach(b => b.addEventListener('click', () => I18n.toggle()));
    $('[data-menu-open]')?.addEventListener('click', openMenu);
    $('[data-menu-close]')?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    $$('.pr-menu-list a').forEach(a => a.addEventListener('click', closeMenu));

    document.addEventListener('langchange', () => {
      document.documentElement.lang = I18n.getLang();
      syncChrome();
      PrNav.refresh();
    });

    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.target || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (href === '#main') {
        e.preventDefault();
        const m = document.getElementById('main');
        m.focus({ preventScroll: true }); m.scrollIntoView();
        return;
      }
      e.preventDefault();
      closeMenu();
      PrNav.go(href);
    });

    window.addEventListener('hashchange', () => PrNav.fromLocation('pop'));
    window.addEventListener('popstate', () => PrNav.fromLocation('pop'));
    PrNav.fromLocation('init');

    window.addEventListener('offline', () => Pr.toast(Pr.t('pr.offline')));
    window.addEventListener('online', () => Pr.toast(Pr.t('pr.online')));

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/productivity/sw.js', { scope: '/productivity/' }).catch(() => {});
      });
    }
  }

  if (document.readyState === 'complete') setTimeout(init);
  else document.addEventListener('DOMContentLoaded', init);

  return { setArea, closeMenu };
})();
