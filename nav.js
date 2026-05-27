const Nav = (function () {
  'use strict';

  const _pinned = false;

  const GAME_LIST = [
    { id: 'hangman',    key: 'game.hangman',    icon: '🪢' },
    { id: 'minesweeper',key: 'game.minesweeper',icon: '💣' },
    { id: 'bomb',       key: 'game.bomb',       icon: '💥' },
    { id: 'memory',     key: 'game.memory',     icon: '🃏' },
    { id: 'tictactoe',  key: 'game.tictactoe',  icon: '⭕' },
    { id: 'wordle',     key: 'game.wordle',     icon: '📝' },
    { id: 'shooting',   key: 'game.shooting',   icon: '🚀' },
    { id: 'reaction',   key: 'game.reaction',   icon: '⚡' },
    { id: 'neon',       key: 'game.neon',       icon: '✨' },
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
    tools:       svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    quiz:        svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    workout:     svg('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
    media:       svg('<path d="M19.82 2H4.18A2.18 2.18 0 0 0 2 4.18v15.64A2.18 2.18 0 0 0 4.18 22h15.64A2.18 2.18 0 0 0 22 19.82V4.18A2.18 2.18 0 0 0 19.82 2z"/><polygon points="10 15 15 12 10 9 10 15"/>'),
    visual:      svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
    photography: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    settings:    svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    pin:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  };

  function buildSidebar() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;

    sb.innerHTML = `
      <div class="sb-scroll">
        <nav class="sb-main-nav">
          <a class="sb-nav-item" data-route="home"         href="#home">${ICONS.home}<span>${TN('nav.home')}</span></a>
          <a class="sb-nav-item" data-route="links"        href="#links">${ICONS.links}<span>${TN('nav.links')}</span></a>
          <a class="sb-nav-item" data-route="tools"        href="#tools">${ICONS.tools}<span>${TN('nav.tools')}</span></a>
          <a class="sb-nav-item" data-route="cheatsheets"  href="#cheatsheets">${ICONS.cheatsheets}<span>${TN('nav.cheatsheets')}</span></a>
          <a class="sb-nav-item" data-route="games"        href="#games">${ICONS.games}<span>${TN('nav.games')}</span></a>
          <a class="sb-nav-item" data-route="quiz"         href="#quiz">${ICONS.quiz}<span>${TN('nav.quiz')}</span></a>
          <div class="sb-sep"></div>
          <a class="sb-nav-item" data-route="media"        href="#media">${ICONS.media}<span>${TN('nav.media')}</span></a>
          <a class="sb-nav-item" data-route="workout"      href="#workout">${ICONS.workout}<span>${TN('nav.workout')}</span></a>
          <a class="sb-nav-item" data-route="photography"  href="#photography">${ICONS.photography}<span>${TN('nav.photography')}</span></a>
          <a class="sb-nav-item" data-route="visual"       href="#visual">${ICONS.visual}<span>${TN('nav.visual')}</span></a>
          <div class="sb-sep"></div>
          <a class="sb-nav-item" data-route="settings"     href="#settings">${ICONS.settings}<span>${TN('nav.settings')}</span></a>
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
      typeof PhotographyPage !== 'undefined' && PhotographyPage.show();
    } else if (page === 'workout') {
      document.getElementById('view-workout')?.classList.add('active');
      typeof WorkoutPage !== 'undefined' && WorkoutPage.show();
    } else if (page === 'media') {
      document.getElementById('view-media')?.classList.add('active');
      typeof MediaPage !== 'undefined' && MediaPage.show();
    } else if (page === 'settings') {
      document.getElementById('view-settings')?.classList.add('active');
      typeof SettingsPage !== 'undefined' && SettingsPage.show();
    } else if (page === 'quiz') {
      document.getElementById('view-quiz')?.classList.add('active');
      typeof QuizPage !== 'undefined' && QuizPage.show(sub || null);
    } else if (page === 'search') {
      document.getElementById('view-search')?.classList.add('active');
      typeof Search !== 'undefined' && Search.renderPage(q);
    } else {
      document.getElementById('view-home')?.classList.add('active');
    }
  }

  function measureHeader() {
    const h = document.getElementById('site-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
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
    const routes = ['home','links','tools','cheatsheets','games','quiz','media','workout','photography','visual','settings'];
    routes.forEach(r => {
      const el = document.querySelector(`.sb-nav-item[data-route="${r}"] span`);
      if (el) el.textContent = TN(`nav.${r}`);
    });
  });

  return { go, renderView };
})();
