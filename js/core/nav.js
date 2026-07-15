const Nav = (function () {
  'use strict';

  const _pinned = false;

  const GAME_LIST = [
    { id: 'hangman',     key: 'game.hangman',     icon: '🪢' },
    { id: 'minesweeper', key: 'game.minesweeper', icon: '💣' },
    { id: 'memory',      key: 'game.memory',      icon: '🃏' },
    { id: 'wordle',      key: 'game.wordle',      icon: '📝' },
    { id: 'reaction',    key: 'game.reaction',    icon: '⚡' },
    { id: 'chess',       key: 'game.chess',       icon: '♟️' },
    { id: 'battleship',  key: 'game.battleship',  icon: '🚢' },
    { id: 'uno',         key: 'game.uno',         icon: '🃏' },
    { id: 'sueca',       key: 'game.sueca',       icon: '♠️' },
    { id: 'bomb',        key: 'game.bomb',        icon: '💥' },
    { id: 'gravity-lab', key: 'game.gravity-lab', icon: '🔬' },
    { id: 'neon-shooter',key: 'game.neon-shooter',icon: '🛸' },
    { id: 'dobble',      key: 'game.dobble',      icon: '👁️' },
  ];
  const TN = k => typeof I18n !== 'undefined' ? I18n.t(k) : k;


  // Bespoke duotone icon in a tinted tile (single set lives in js/core/icons.js).
  function navIcon(r) {
    return `<span class="sb-nav-ic" aria-hidden="true">${AppIcons.icon(r)}</span>`;
  }

  /* Kept for backwards compatibility — the set lives in AppIcons. */
  function icon(r, size) { return AppIcons.icon(r, size); }

  function buildSidebar() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;

    sb.innerHTML = `
      <div class="sb-scroll">
        <nav class="sb-main-nav">
          <a class="sb-nav-item" data-route="home"         href="#home">${navIcon('home')}<span>${TN('nav.home')}</span></a>
          <div class="sb-grp" data-grp="discover">${TN('nav.grp.discover')}</div>
          <a class="sb-nav-item" data-route="explorer"    href="#explorer">${navIcon('explorer')}<span>${TN('nav.explorer')}</span></a>
          <a class="sb-nav-item" data-route="noticias"    href="#noticias">${navIcon('noticias')}<span>${TN('nav.noticias')}</span></a>
          <a class="sb-nav-item" data-route="eventos"     href="#eventos">${navIcon('eventos')}<span>${TN('nav.eventos')}</span></a>
          <a class="sb-nav-item" data-route="ocorrencias" href="#ocorrencias">${navIcon('ocorrencias')}<span>${TN('nav.ocorrencias')}</span></a>
          <a class="sb-nav-item" data-route="f1"          href="#f1">${navIcon('f1')}<span>${TN('nav.f1')}</span></a>
          <a class="sb-nav-item" data-route="oss"         href="#oss">${navIcon('oss')}<span>${TN('nav.oss')}</span></a>
          <a class="sb-nav-item" data-route="discovery"   href="#discovery">${navIcon('discovery')}<span>${TN('nav.discovery')}</span></a>
          <div class="sb-grp" data-grp="tools">${TN('nav.grp.tools')}</div>
          <a class="sb-nav-item" data-route="links"        href="#links">${navIcon('links')}<span>${TN('nav.links')}</span></a>
          <a class="sb-nav-item" data-route="tools"        href="#tools">${navIcon('tools')}<span>${TN('nav.tools')}</span></a>
          <a class="sb-nav-item" data-route="visual"       href="#visual">${navIcon('visual')}<span>${TN('nav.visual')}</span></a>
          <a class="sb-nav-item" data-route="cheatsheets"  href="#cheatsheets">${navIcon('cheatsheets')}<span>${TN('nav.cheatsheets')}</span></a>
          <div class="sb-grp" data-grp="fun">${TN('nav.grp.fun')}</div>
          <a class="sb-nav-item" data-route="games"        href="#games">${navIcon('games')}<span>${TN('nav.games')}</span></a>
          <a class="sb-nav-item" data-route="quiz"         href="#quiz">${navIcon('quiz')}<span>${TN('nav.quiz')}</span></a>
          <a class="sb-nav-item" data-route="humor"        href="#humor">${navIcon('humor')}<span>${TN('nav.humor')}</span></a>
          <div class="sb-grp" data-grp="photo">${TN('nav.grp.photo')}</div>
          <a class="sb-nav-item" data-route="photography"  href="#photography">${navIcon('photography')}<span>${TN('nav.photography')}</span></a>
          <!-- Definições saiu da navegação: as preferências rápidas vivem no
               painel do header (a página/rota #settings mantém-se no código). -->
        </nav>
      </div>`;

    sb.addEventListener('click', onSidebarClick);
  }

  function onSidebarClick(e) {
    const a = e.target.closest('[data-route]');
    if (!a) return;
    e.preventDefault();
    go(a.dataset.route);
    if (window.innerWidth < 900 && !_pinned) closeSb();
  }

  function wireMobileNav() {
    document.getElementById('hdr-search-btn')?.addEventListener('click', () => {
      if (typeof CommandPalette !== 'undefined') CommandPalette.open();
    });
  }

  function wireEvents() {
    document.getElementById('sb-toggle')?.addEventListener('click', toggleSb);
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      if (!_pinned) closeSb();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !_pinned && document.body.classList.contains('sb-open')) closeSb();
    });
  }

  function toggleSb() {
    const open = document.body.classList.toggle('sb-open');
    syncOverlay(open);
  }

  function closeSb() {
    document.body.classList.remove('sb-open');
    syncOverlay(false);
  }

  function syncOverlay(open) {
    const ov = document.getElementById('sidebar-overlay');
    if (ov) ov.classList.toggle('show', open && !_pinned && window.innerWidth < 900);
  }

  function go(hash) {
    history.pushState(null, '', '#' + hash);
    renderView(hash);
    document.dispatchEvent(new CustomEvent('routechange', { detail: hash }));
  }

  function renderView(raw) {
    const hash = raw || 'home';
    const qIdx = hash.indexOf('?');
    const path  = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
    const qs    = qIdx >= 0 ? hash.slice(qIdx + 1) : '';
    const [page, sub] = path.split('/');
    const q = new URLSearchParams(qs).get('q') || '';

    document.querySelectorAll('[data-route]').forEach(el => {
      const r = el.dataset.route;
      el.classList.toggle('active', r === path || (r === page && !r.includes('/')));
    });

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    if (page === 'cheatsheets') {
      document.getElementById('view-cheatsheets')?.classList.add('active');
      typeof CheatsheetsPage !== 'undefined' && CheatsheetsPage.show();
    } else if (page === 'games') {
      document.getElementById('view-games')?.classList.add('active');
      typeof GameHost !== 'undefined' && GameHost.show(sub || null);
    } else if (page === 'links') {
      document.getElementById('view-links')?.classList.add('active');
      typeof LinksPage !== 'undefined' && LinksPage.show(sub || null);
    } else if (page === 'tools') {
      document.getElementById('view-tools')?.classList.add('active');
      typeof ToolsPage !== 'undefined' && ToolsPage.show();
    } else if (page === 'visual') {
      document.getElementById('view-visual')?.classList.add('active');
      typeof VisualPage !== 'undefined' && VisualPage.show();
    } else if (page === 'photography') {
      document.getElementById('view-photography')?.classList.add('active');
      /* sub completo (multi-segmento): "g/retrato", "agora/rua", "aprender/cores"… */
      const phSub = path.startsWith('photography/') ? path.slice(12) : null;
      typeof PhotographyPage !== 'undefined' && PhotographyPage.show(phSub);
    } else if (page === 'settings') {
      document.getElementById('view-settings')?.classList.add('active');
      typeof SettingsPage !== 'undefined' && SettingsPage.show();
    } else if (page === 'quiz') {
      document.getElementById('view-quiz')?.classList.add('active');
      typeof QuizPage !== 'undefined' && QuizPage.show(sub || null);
    } else if (page === 'humor') {
      document.getElementById('view-humor')?.classList.add('active');
      typeof HumorPage !== 'undefined' && HumorPage.show();
    } else if (page === 'explorer') {
      document.getElementById('view-explorer')?.classList.add('active');
      typeof ExplorerPage !== 'undefined' && ExplorerPage.show(sub || null);
    } else if (page === 'ocorrencias') {
      document.getElementById('view-ocorrencias')?.classList.add('active');
      typeof OcorrenciasPage !== 'undefined' && OcorrenciasPage.show();
    } else if (page === 'eventos') {
      document.getElementById('view-eventos')?.classList.add('active');
      typeof EventosPage !== 'undefined' && EventosPage.show();
    } else if (page === 'noticias') {
      document.getElementById('view-noticias')?.classList.add('active');
      typeof NoticiasPage !== 'undefined' && NoticiasPage.show(sub || null);
    } else if (page === 'f1') {
      document.getElementById('view-f1')?.classList.add('active');
      typeof F1Page !== 'undefined' && F1Page.show(sub || null);
    } else if (page === 'oss') {
      document.getElementById('view-oss')?.classList.add('active');
      const ossSub = path.startsWith('oss/') ? path.slice(4) : null;   // e.g. "search" or "owner/name"
      typeof OssPage !== 'undefined' && OssPage.show(ossSub);
    } else if (page === 'discovery') {
      document.getElementById('view-discovery')?.classList.add('active');
      const dSub = path.startsWith('discovery/') ? path.slice(10) : null;   // "gaming…"
      typeof DiscoveryPage !== 'undefined' && DiscoveryPage.show(dSub);
    } else if (page === 'search') {
      document.getElementById('view-search')?.classList.add('active');
      typeof Search !== 'undefined' && Search.renderPage(q);
    } else {
      document.getElementById('view-home')?.classList.add('active');
    }
  }

  function measureHeader() {
    const h = document.getElementById('site-header');
    /* CSS consumes --hdr-h (tokens.css default 56px); keep it in sync with the
       real header height so layouts stay correct at larger font sizes. */
    if (h && h.offsetHeight) document.documentElement.style.setProperty('--hdr-h', h.offsetHeight + 'px');
  }

  function init() {
    buildSidebar();
    wireEvents();
    wireMobileNav();

    if (_pinned) {
      document.body.classList.add('sb-open', 'sb-pinned');
    } else if (window.innerWidth >= 900) {
      document.body.classList.add('sb-open');
    }

    measureHeader();
    window.addEventListener('resize', measureHeader);
    window.addEventListener('hashchange', () => {
      const h = location.hash.slice(1) || 'home';
      renderView(h);
      document.dispatchEvent(new CustomEvent('routechange', { detail: h }));
    });
    const _initRoute = location.hash.slice(1) || 'home';
    renderView(_initRoute);
    document.dispatchEvent(new CustomEvent('routechange', { detail: _initRoute }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  document.addEventListener('langchange', () => {
    const routes = ['home','links','tools','cheatsheets','games','quiz','humor','explorer','ocorrencias','eventos','noticias','f1','oss','discovery','photography','visual','settings'];
    routes.forEach(r => {
      const el = document.querySelector(`.sb-nav-item[data-route="${r}"] span`);
      if (el) el.textContent = TN(`nav.${r}`);
    });
    /* Sidebar group labels. */
    document.querySelectorAll('.sb-grp').forEach(el => { el.textContent = TN(`nav.grp.${el.dataset.grp}`); });
  });

  return { go, renderView, icon };
})();
