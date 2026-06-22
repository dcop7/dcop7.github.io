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
    { id: 'bomb',        key: 'game.bomb',        icon: '💥' },
    { id: 'gravity-lab', key: 'game.gravity-lab', icon: '🔬' },
    { id: 'neon-shooter',key: 'game.neon-shooter',icon: '🛸' },
  ];
  const TN = k => typeof I18n !== 'undefined' ? I18n.t(k) : k;

  function svg(d, w, h) {
    return `<svg width="${w||16}" height="${h||16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  }
  const ICONS = {
    home:        svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    feed:        svg('<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>'),
    cheatsheets: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>'),
    games:       svg('<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M7 10v4M5 12h4M17 11l2 1-2 1"/>'),
    links:       svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    explorer:    svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    ocorrencias: svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    eventos:     svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>'),
    noticias:    svg('<path d="M4 4h13a1 1 0 0 1 1 1v14a1 1 0 0 0 1 1 1 1 0 0 0 1-1V8h2v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1z"/><path d="M7 8h7M7 12h7M7 16h4"/>'),
    f1:          svg('<line x1="5" y1="21" x2="5" y2="3"/><rect x="5" y="4" width="14" height="9"/><path d="M9.7 4v9M14.3 4v9M5 8.5h14"/>'),
    oss:         svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="13" y1="4" x2="11" y2="20"/>'),
    discovery:   svg('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
    books:       svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    tools:       svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    quiz:        svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    humor:       svg('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
    visual:      svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
    photography: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    settings:    svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    pin:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  };

  // Premium generated tile icon, with the line-art SVG as a graceful fallback (theme-safe).
  function navIcon(r) {
    return `<span class="sb-nav-ic"><img class="sb-nav-img" src="img/nav/${r}.webp" alt="" loading="lazy" decoding="async" onerror="this.closest('.sb-nav-ic').classList.add('img-fail')"><span class="sb-nav-fb" aria-hidden="true">${ICONS[r] || ''}</span></span>`;
  }

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
          <a class="sb-nav-item" data-route="cheatsheets"  href="#cheatsheets">${navIcon('cheatsheets')}<span>${TN('nav.cheatsheets')}</span></a>
          <div class="sb-grp" data-grp="fun">${TN('nav.grp.fun')}</div>
          <a class="sb-nav-item" data-route="games"        href="#games">${navIcon('games')}<span>${TN('nav.games')}</span></a>
          <a class="sb-nav-item" data-route="quiz"         href="#quiz">${navIcon('quiz')}<span>${TN('nav.quiz')}</span></a>
          <a class="sb-nav-item" data-route="humor"        href="#humor">${navIcon('humor')}<span>${TN('nav.humor')}</span></a>
          <div class="sb-grp" data-grp="personal">${TN('nav.grp.personal')}</div>
          <a class="sb-nav-item" data-route="photography"  href="#photography">${navIcon('photography')}<span>${TN('nav.photography')}</span></a>
          <a class="sb-nav-item" data-route="visual"       href="#visual">${navIcon('visual')}<span>${TN('nav.visual')}</span></a>
          <div class="sb-sep"></div>
          <a class="sb-nav-item" data-route="settings"     href="#settings">${navIcon('settings')}<span>${TN('nav.settings')}</span></a>
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
    const mob = document.getElementById('mob-nav');
    if (!mob) return;
    mob.addEventListener('click', e => {
      const btn = e.target.closest('[data-route]');
      if (!btn) return;
      go(btn.dataset.route);
    });
    document.addEventListener('routechange', e => {
      const page = (e.detail || '').split('/')[0] || 'home';
      mob.querySelectorAll('.mob-nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.route === page);
      });
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
      typeof PhotographyPage !== 'undefined' && PhotographyPage.show(sub || null);
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
      typeof F1Page !== 'undefined' && F1Page.show();
    } else if (page === 'oss') {
      document.getElementById('view-oss')?.classList.add('active');
      const ossSub = path.startsWith('oss/') ? path.slice(4) : null;   // e.g. "search" or "owner/name"
      typeof OssPage !== 'undefined' && OssPage.show(ossSub);
    } else if (page === 'discovery') {
      document.getElementById('view-discovery')?.classList.add('active');
      const dSub = path.startsWith('discovery/') ? path.slice(10) : null;   // "gaming…" | "books…"
      if (dSub === 'books' || (dSub && dSub.startsWith('books/'))) {        // Books = a category of Product Discovery
        const bSub = dSub === 'books' ? null : dSub.slice(6);              // "search" | "<leafId>" | "b/<olid>"
        typeof BookDiscovery !== 'undefined' && BookDiscovery.show(bSub);
      } else {
        typeof DiscoveryPage !== 'undefined' && DiscoveryPage.show(dSub);
      }
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
    /* Mobile bottom-nav labels follow the same keys. */
    document.querySelectorAll('#mob-nav .mob-nav-btn').forEach(btn => {
      const span = btn.querySelector('span');
      if (span) span.textContent = TN(`nav.${btn.dataset.route}`);
    });
  });

  return { go, renderView };
})();
