const Search = (function () {
  'use strict';

  let index = [];
  let _input, _dropdown;

  const SECTIONS = [
    { label: 'Início',       id: 'home',  icon: '🏠', tags: ['início','home','tempo','meteorologia','clima','previsão'] },
    { label: 'Jogos',        id: 'games', icon: '🎮', tags: ['jogos','games','jogar'] },
    { label: 'Sites Úteis',  id: 'links', icon: '🔗', tags: ['sites','links','úteis'] },
  ];

  const GAMES = [
    { label: 'Jogo da Forca',    id: 'games/hangman',     icon: '🪢', tags: ['forca','palavras','adivinhar','hangman'] },
    { label: 'Corredor Infinito',id: 'games/runner',      icon: '🦊', tags: ['runner','correr','raposa','obstáculos'] },
    { label: 'Campo de Minas',   id: 'games/minesweeper', icon: '💣', tags: ['minesweeper','minas','campo'] },
    { label: 'Desarmar Bomba',   id: 'games/bomb',        icon: '💥', tags: ['bomba','desarmar','desafio'] },
  ];

  function buildIndex() {
    index = [];
    SECTIONS.forEach(s => index.push({ type: 'section', label: s.label, icon: s.icon, id: s.id, tags: s.tags }));
    GAMES.forEach(g => index.push({ type: 'game', label: g.label, icon: g.icon, id: g.id, tags: g.tags }));
    if (typeof LINKS_DATA !== 'undefined') {
      LINKS_DATA.forEach(cat => {
        cat.links.forEach(link => {
          index.push({
            type: 'link', label: link.name, icon: cat.icon,
            id: 'links/' + cat.id, url: link.url,
            desc: link.desc, tags: link.tags || [], cat: cat.cat,
          });
        });
      });
    }
  }

  function score(item, q) {
    const ql = q.toLowerCase(), nl = item.label.toLowerCase();
    let s = 0;
    if (nl.startsWith(ql)) s += 10;
    else if (nl.includes(ql)) s += 6;
    if ((item.tags || []).some(t => t.toLowerCase().includes(ql))) s += 5;
    if ((item.desc || '').toLowerCase().includes(ql)) s += 3;
    if ((item.cat || '').toLowerCase().includes(ql)) s += 2;
    return s;
  }

  function query(q) {
    if (!q || !q.trim()) return [];
    const ql = q.trim();
    return index
      .map(item => ({ item, s: score(item, ql) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map(x => x.item);
  }

  const TYPE_LABEL = { section: 'Secção', game: 'Jogo', link: 'Site' };

  function showDropdown(results) {
    if (!_dropdown) return;
    if (!results.length) { hideDropdown(); return; }

    _dropdown.innerHTML = results.map((item, i) => `
      <div class="sr-row" tabindex="0" data-i="${i}" role="option">
        <span class="sr-icon">${item.icon}</span>
        <div class="sr-body">
          <span class="sr-name">${item.label}</span>
          ${item.desc ? `<span class="sr-desc">${item.desc}</span>` : ''}
        </div>
        <span class="sr-badge">${TYPE_LABEL[item.type] || ''}</span>
      </div>`).join('');

    _dropdown.querySelectorAll('.sr-row').forEach((el, i) => {
      el.addEventListener('click', () => activate(results[i]));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); activate(results[i]); }
        if (e.key === 'ArrowDown') { e.preventDefault(); (el.nextElementSibling || _dropdown.firstElementChild)?.focus(); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); (el.previousElementSibling || _dropdown.lastElementChild)?.focus(); }
        if (e.key === 'Escape')    { hideDropdown(); _input?.focus(); }
      });
    });

    positionDropdown();
    _dropdown.classList.add('show');
  }

  function hideDropdown() {
    _dropdown?.classList.remove('show');
  }

  function positionDropdown() {
    if (!_input || !_dropdown) return;
    const r = _input.getBoundingClientRect();
    _dropdown.style.top   = r.bottom + 6 + 'px';
    _dropdown.style.left  = r.left + 'px';
    _dropdown.style.width = Math.max(r.width, 300) + 'px';
  }

  function activate(item) {
    hideDropdown();
    if (_input) { _input.value = ''; _input.blur(); }
    if (item.type === 'link' && item.url && item.url !== '#') {
      window.open(item.url, '_blank', 'noopener');
    } else {
      Nav.go(item.id);
    }
  }

  function renderPage(q) {
    const el = document.getElementById('search-results-page');
    if (!el) return;

    if (!q) {
      el.innerHTML = '<div class="sp-empty">Introduz um termo de pesquisa.</div>';
      return;
    }

    const results = index
      .map(item => ({ item, s: score(item, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.item);

    if (!results.length) {
      el.innerHTML = `<div class="sp-empty">Sem resultados para <strong>"${q}"</strong>.</div>`;
      return;
    }

    const groups = {};
    results.forEach(r => {
      const key = r.type === 'section' ? 'Secções' : r.type === 'game' ? 'Jogos' : 'Sites';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Resultados para "<em>${q}</em>"</h1>
        <p class="page-subtitle">${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}</p>
      </div>
      ${Object.entries(groups).map(([grp, items]) => `
        <div class="sp-group">
          <div class="sp-group-label">${grp}</div>
          <div class="sp-items">
            ${items.map(item => `
              <div class="sp-item">
                <span class="sp-item-icon">${item.icon}</span>
                <div class="sp-item-body">
                  <div class="sp-item-name">${item.label}</div>
                  ${item.desc ? `<div class="sp-item-desc">${item.desc}</div>` : ''}
                  ${item.cat ? `<div class="sp-item-cat">${item.cat}</div>` : ''}
                </div>
                <div class="sp-item-actions">
                  ${item.type === 'link' && item.url !== '#'
                    ? `<a class="sp-btn" href="${item.url}" target="_blank" rel="noopener">Visitar ↗</a>`
                    : `<button class="sp-btn sp-btn-nav" data-id="${item.id}">Ir →</button>`}
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}`;

    el.querySelectorAll('.sp-btn-nav').forEach(btn => {
      btn.addEventListener('click', () => Nav.go(btn.dataset.id));
    });
  }

  function init() {
    _input    = document.getElementById('search-input');
    _dropdown = document.getElementById('search-dropdown');
    buildIndex();
    if (!_input) return;

    _input.addEventListener('input', () => showDropdown(query(_input.value)));
    _input.addEventListener('focus', () => { if (_input.value.trim()) showDropdown(query(_input.value)); });
    _input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); _dropdown?.querySelector('.sr-row')?.focus(); }
      if (e.key === 'Escape')    hideDropdown();
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = _input.value.trim();
        hideDropdown();
        if (q) Nav.go('search?' + new URLSearchParams({ q }).toString());
      }
    });
    document.addEventListener('click', e => {
      if (!_dropdown?.contains(e.target) && e.target !== _input) hideDropdown();
    });
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { renderPage };
})();
