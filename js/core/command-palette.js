const CommandPalette = (function () {
  'use strict';

  const NAV_ITEMS = [
    { name: 'Home',         desc: 'Go to home',             icon: '🏠', type: 'nav',  action: () => Nav.go('home') },
    { name: 'Feed',         desc: 'Hacker News & RSS feed', icon: '📰', type: 'nav',  action: () => Nav.go('feed') },
    { name: 'Cheatsheets',  desc: 'Dev command cheatsheets',icon: '📋', type: 'nav',  action: () => Nav.go('cheatsheets') },
    { name: 'Games',        desc: 'Play mini-games',        icon: '🎮', type: 'nav',  action: () => Nav.go('games') },
    { name: 'Links',        desc: 'Useful sites & bookmarks',icon: '🔗', type: 'nav', action: () => Nav.go('links') },
    { name: 'Tools',        desc: 'Developer tools',        icon: '🔧', type: 'nav',  action: () => Nav.go('tools') },
    { name: 'Formula 1',    desc: 'Live race, track & standings', icon: '🏎️', type: 'nav', action: () => Nav.go('f1') },
    { name: 'Media',        desc: 'Entertainment dashboard', icon: '🎬', type: 'nav', action: () => Nav.go('media') },
  ];

  const THEME_ITEMS = [
    { name: 'Theme: Dark',      desc: 'Default dark theme',     icon: '🌙', type: 'theme', action: () => ThemeManager.apply('dark') },
    { name: 'Theme: Light',     desc: 'Light mode',             icon: '☀️', type: 'theme', action: () => ThemeManager.apply('light') },
    { name: 'Theme: Cyberpunk', desc: 'Neon purple & magenta',  icon: '💜', type: 'theme', action: () => ThemeManager.apply('cyberpunk') },
    { name: 'Theme: Terminal',  desc: 'Green monochrome',       icon: '💚', type: 'theme', action: () => ThemeManager.apply('terminal') },
    { name: 'Theme: Retro',     desc: 'Amber warm tones',       icon: '🟡', type: 'theme', action: () => ThemeManager.apply('retro') },
  ];

  function getBookmarkItems() {
    if (typeof LINKS_DATA === 'undefined') return [];
    const items = [];
    LINKS_DATA.forEach(cat => {
      (cat.links || []).forEach(link => {
        items.push({
          name: link.name,
          desc: cat.cat,
          icon: cat.icon || '🔗',
          type: 'link',
          action: () => window.open(link.url, '_blank', 'noopener'),
        });
      });
    });
    return items;
  }

  function buildIndex() {
    const bookmarks = getBookmarkItems();
    return [...NAV_ITEMS, ...THEME_ITEMS, ...bookmarks];
  }

  function fuzzy(str, q) {
    const sl = str.toLowerCase();
    const ql = q.toLowerCase();
    let score = 0;
    let si = 0;
    for (let qi = 0; qi < ql.length; qi++) {
      const idx = sl.indexOf(ql[qi], si);
      if (idx < 0) return -1;
      score += idx === si ? 2 : 1;
      si = idx + 1;
    }
    return score;
  }

  function highlightMatch(text, q) {
    if (!q) return text;
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  function badgeClass(type) {
    return { nav:'cp-badge-nav', link:'cp-badge-link', theme:'cp-badge-theme', search:'cp-badge-search' }[type] || 'cp-badge-nav';
  }

  const overlay = document.getElementById('cp-overlay');
  const input   = document.getElementById('cp-input');
  const results = document.getElementById('cp-results');
  let _focused  = -1;
  let _items    = [];

  function open() {
    if (!overlay) return;
    overlay.hidden = false;
    input?.focus();
    _focused = -1;
    filter('');
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    if (input) input.value = '';
    if (results) results.innerHTML = '';
  }

  function filter(q) {
    const index = buildIndex();
    const ql = q.trim().toLowerCase();

    let matched;
    if (!ql) {
      matched = NAV_ITEMS.slice(0, 8);
    } else {
      matched = index
        .map(item => {
          const s = Math.max(
            fuzzy(item.name, ql) * 3,
            fuzzy(item.desc, ql)
          );
          return { item, score: s };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(x => x.item);

      if (ql.length >= 2) {
        matched.push({
          name:   `Search web for "${q}"`,
          desc:   'Open in browser',
          icon:   '🔎',
          type:   'search',
          action: () => window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener'),
        });
      }
    }

    _items = matched;
    _focused = -1;

    if (!results) return;
    if (!matched.length) {
      results.innerHTML = '<div class="cp-empty">No results</div>';
      return;
    }

    const groupLabel = ql ? '' : '<div class="cp-section-label">Quick navigation</div>';
    results.innerHTML = groupLabel + matched.map((item, i) => `
      <div class="cp-item" data-idx="${i}" role="option">
        <div class="cp-item-icon">${item.icon}</div>
        <div class="cp-item-body">
          <div class="cp-item-name">${highlightMatch(item.name, ql)}</div>
          <div class="cp-item-desc">${highlightMatch(item.desc, ql)}</div>
        </div>
        <span class="cp-badge ${badgeClass(item.type)}">${item.type}</span>
      </div>`).join('');

    results.querySelectorAll('.cp-item').forEach((el, i) => {
      el.addEventListener('click', () => select(i));
      el.addEventListener('mousemove', () => { _focused = i; updateFocus(); });
    });
  }

  function updateFocus() {
    results?.querySelectorAll('.cp-item').forEach((el, i) => {
      el.classList.toggle('focused', i === _focused);
      if (i === _focused) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function select(idx) {
    const item = _items[idx];
    if (!item) return;
    close();
    item.action();
  }

  if (overlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }

  if (input) {
    input.addEventListener('input', () => filter(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); _focused = Math.min(_focused + 1, _items.length - 1); updateFocus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); _focused = Math.max(_focused - 1, 0); updateFocus(); }
      else if (e.key === 'Enter') { e.preventDefault(); select(_focused >= 0 ? _focused : 0); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  document.addEventListener('cp:open',  open);
  document.addEventListener('cp:close', close);

  return { open, close };
})();
