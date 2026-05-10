const Search = (function () {
  'use strict';

  let index = [];
  let dropdown, input;

  const SECTIONS = [
    { name: 'Meteorologia', section: 'weather',    icon: '🌤', tags: ['tempo', 'meteorologia', 'chuva', 'temperatura', 'previsão'] },
    { name: 'Pensamento do Dia', section: 'thought', icon: '💭', tags: ['pensamento', 'citação', 'frase', 'filosofia'] },
    { name: 'Física Pessoal', section: 'pt',         icon: '🏋️', tags: ['treino', 'pt', 'física', 'exercício', 'personal trainer'] },
    { name: 'Piada do Dia',  section: 'joke',        icon: '😄', tags: ['piada', 'humor', 'engraçado', 'comédia'] },
  ];

  const GAMES = [
    { name: 'Jogo da Forca',    game: 'hangman',     icon: '🪢', tags: ['forca', 'palavras', 'jogo', 'adivinhar', 'hangman'] },
    { name: 'Corredor Infinito',game: 'runner',      icon: '🦊', tags: ['runner', 'correr', 'raposa', 'obstáculos', 'jogo'] },
    { name: 'Campo de Minas',   game: 'minesweeper', icon: '💣', tags: ['minesweeper', 'minas', 'campo', 'jogo', 'clássico'] },
    { name: 'Desarmar Bomba',   game: 'bomb',        icon: '💥', tags: ['bomba', 'desarmar', 'desafio', 'jogo', 'tempo'] },
  ];

  function buildIndex() {
    index = [];

    SECTIONS.forEach(s => {
      index.push({ type: 'section', label: s.name, icon: s.icon, id: s.section, tags: s.tags, cat: 'Secção' });
    });

    GAMES.forEach(g => {
      index.push({ type: 'game', label: g.name, icon: g.icon, id: g.game, tags: g.tags, cat: 'Jogo' });
    });

    if (typeof LINKS_DATA !== 'undefined') {
      LINKS_DATA.forEach(cat => {
        cat.links.forEach(link => {
          index.push({
            type: 'link',
            label: link.name,
            icon: cat.icon,
            url: link.url,
            desc: link.desc,
            tags: link.tags || [],
            cat: cat.cat,
          });
        });
      });
    }
  }

  function score(item, q) {
    const ql = q.toLowerCase();
    const nl = item.label.toLowerCase();
    let s = 0;
    if (nl.startsWith(ql)) s += 10;
    else if (nl.includes(ql)) s += 6;
    if ((item.tags || []).some(t => t.toLowerCase().includes(ql))) s += 5;
    if ((item.desc || '').toLowerCase().includes(ql)) s += 3;
    if ((item.cat || '').toLowerCase().includes(ql)) s += 2;
    return s;
  }

  function search(q) {
    if (!q || q.trim().length < 1) return [];
    const ql = q.trim();
    return index
      .map(item => ({ item, s: score(item, ql) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map(x => x.item);
  }

  function positionDropdown() {
    if (!input || !dropdown) return;
    const r = input.getBoundingClientRect();
    dropdown.style.top  = (r.bottom + 4) + 'px';
    dropdown.style.left = r.left + 'px';
    dropdown.style.width = Math.max(r.width, 280) + 'px';
  }

  function showDropdown(results) {
    if (!dropdown) return;
    if (results.length === 0) { hideDropdown(); return; }

    dropdown.innerHTML = results.map((item, i) => {
      const desc = item.desc ? `<span class="sr-desc">${item.desc}</span>` : '';
      const cat  = item.cat  ? `<span class="sr-cat">${item.cat}</span>` : '';
      return `<div class="sr-item" tabindex="0" data-i="${i}" role="option">
        <span class="sr-icon">${item.icon}</span>
        <div class="sr-text"><span class="sr-name">${item.label}</span>${desc}</div>
        ${cat}
      </div>`;
    }).join('');

    dropdown.dataset.results = JSON.stringify(results.map(r => ({
      type: r.type, id: r.id, game: r.game, url: r.url
    })));

    dropdown.querySelectorAll('.sr-item').forEach((el, i) => {
      el.addEventListener('click', () => activate(results[i]));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') activate(results[i]);
        if (e.key === 'ArrowDown') { e.preventDefault(); (el.nextElementSibling || dropdown.firstElementChild).focus(); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); (el.previousElementSibling || dropdown.lastElementChild).focus(); }
        if (e.key === 'Escape')    { hideDropdown(); input.focus(); }
      });
    });

    positionDropdown();
    dropdown.classList.add('show');
  }

  function hideDropdown() {
    if (dropdown) dropdown.classList.remove('show');
  }

  function activate(item) {
    hideDropdown();
    if (input) { input.value = ''; input.blur(); }

    if (item.type === 'game') {
      if (typeof GameHost !== 'undefined') GameHost.switchTo(item.id);
      const pane = document.getElementById('pane-' + item.id);
      if (pane) pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (item.type === 'section') {
      const el = document.getElementById('section-' + item.id) || document.querySelector('[data-section="' + item.id + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (item.type === 'link') {
      if (item.url && item.url !== '#') window.open(item.url, '_blank', 'noopener');
    }
  }

  function init() {
    input    = document.getElementById('search-input');
    dropdown = document.getElementById('search-dropdown');
    if (!input || !dropdown) return;

    buildIndex();

    input.addEventListener('input', () => {
      const results = search(input.value);
      showDropdown(results);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim()) showDropdown(search(input.value));
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const first = dropdown.querySelector('.sr-item');
        if (first) first.focus();
      }
      if (e.key === 'Escape') hideDropdown();
    });

    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target) && e.target !== input) hideDropdown();
    });

    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
