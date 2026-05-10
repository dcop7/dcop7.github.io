const Nav = (function () {
  'use strict';

  let _pinned = localStorage.getItem('sb-pinned') === 'true';

  const GAME_LIST = [
    { id: 'hangman',     name: 'Jogo da Forca',    icon: '🪢' },
    { id: 'runner',      name: 'Corredor Infinito', icon: '🦊' },
    { id: 'minesweeper', name: 'Campo de Minas',    icon: '💣' },
    { id: 'bomb',        name: 'Desarmar Bomba',    icon: '💥' },
  ];

  function svg(d, w, h) {
    return `<svg width="${w||16}" height="${h||16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  }
  const ICONS = {
    home:    svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    games:   svg('<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M7 10v4M5 12h4M17 11l2 1-2 1"/>'),
    links:   svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    tools:   svg('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>'),
    workout: svg('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
    pin:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  };

  function buildSidebar() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;

    const linkCats = typeof LINKS_DATA !== 'undefined'
      ? LINKS_DATA.map(c => `
          <a class="sb-item" data-route="links/${c.id}" href="#links/${c.id}">
            <span class="sb-item-icon">${c.icon}</span>
            <span class="sb-item-label">${c.cat}</span>
          </a>`).join('')
      : '';

    sb.innerHTML = `
      <div class="sb-head">
        <button class="sb-pin-btn${_pinned ? ' pinned' : ''}" id="sb-pin" title="${_pinned ? 'Desafixar' : 'Fixar'} painel">
          ${ICONS.pin}
        </button>
      </div>
      <div class="sb-scroll">
        <nav class="sb-main-nav">
          <a class="sb-nav-item" data-route="home" href="#home">${ICONS.home}<span>Início</span></a>
          <a class="sb-nav-item" data-route="games" href="#games">${ICONS.games}<span>Jogos</span></a>
          <a class="sb-nav-item" data-route="links" href="#links">${ICONS.links}<span>Sites Úteis</span></a>
          <a class="sb-nav-item" data-route="tools" href="#tools">${ICONS.tools}<span>Ferramentas</span></a>
          <a class="sb-nav-item" data-route="workout" href="#workout">${ICONS.workout}<span>Treino</span></a>
        </nav>
        <div class="sb-divider"></div>
        <div class="sb-group">
          <div class="sb-group-label">Jogos</div>
          ${GAME_LIST.map(g => `
            <a class="sb-item" data-route="games/${g.id}" href="#games/${g.id}">
              <span class="sb-item-icon">${g.icon}</span>
              <span class="sb-item-label">${g.name}</span>
            </a>`).join('')}
        </div>
        <div class="sb-divider"></div>
        <div class="sb-group">
          <div class="sb-group-label">Sites Úteis</div>
          ${linkCats}
        </div>
      </div>`;

    sb.addEventListener('click', onSidebarClick);
    document.getElementById('sb-pin')?.addEventListener('click', togglePin);
  }

  function onSidebarClick(e) {
    const a = e.target.closest('[data-route]');
    if (!a) return;
    e.preventDefault();
    go(a.dataset.route);
    if (window.innerWidth < 900 && !_pinned) closeSb();
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

  function togglePin() {
    _pinned = !_pinned;
    localStorage.setItem('sb-pinned', _pinned);
    document.body.classList.toggle('sb-pinned', _pinned);
    const btn = document.getElementById('sb-pin');
    if (btn) {
      btn.classList.toggle('pinned', _pinned);
      btn.title = (_pinned ? 'Desafixar' : 'Fixar') + ' painel';
    }
    syncOverlay(document.body.classList.contains('sb-open'));
  }

  function go(hash) {
    history.pushState(null, '', '#' + hash);
    renderView(hash);
  }

  function renderView(raw) {
    const hash = raw || 'home';
    const qIdx = hash.indexOf('?');
    const path  = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
    const qs    = qIdx >= 0 ? hash.slice(qIdx + 1) : '';
    const [page, sub] = path.split('/');
    const q = new URLSearchParams(qs).get('q') || '';

    // Active states
    document.querySelectorAll('[data-route]').forEach(el => {
      const r = el.dataset.route;
      el.classList.toggle('active', r === path || (r === page && !r.includes('/')));
    });

    // Switch view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    if (page === 'games') {
      document.getElementById('view-games')?.classList.add('active');
      typeof GameHost !== 'undefined' && GameHost.show(sub || null);
    } else if (page === 'links') {
      document.getElementById('view-links')?.classList.add('active');
      typeof LinksPage !== 'undefined' && LinksPage.show(sub || null);
    } else if (page === 'tools') {
      document.getElementById('view-tools')?.classList.add('active');
      typeof ToolsPage !== 'undefined' && ToolsPage.show();
    } else if (page === 'workout') {
      document.getElementById('view-workout')?.classList.add('active');
      typeof WorkoutPage !== 'undefined' && WorkoutPage.show();
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

    if (_pinned) {
      document.body.classList.add('sb-open', 'sb-pinned');
    } else if (window.innerWidth >= 900) {
      document.body.classList.add('sb-open');
    }

    measureHeader();
    window.addEventListener('resize', measureHeader);
    window.addEventListener('hashchange', () => renderView(location.hash.slice(1) || 'home'));
    renderView(location.hash.slice(1) || 'home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { go, renderView };
})();
