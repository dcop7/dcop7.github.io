/* ══════════════════════════════════════════════════════════════════
   PhSearch — pesquisa global e páginas guardadas.

   O microsite tem ~300 destinos (géneros, lições, ferramentas, instrumentos,
   cenas) e só se chegava a eles sabendo em que área viviam. A pesquisa
   abre com Ctrl/⌘+K ou "/", procura sem acentos em títulos e descrições, e
   anda-se nela só com o teclado. Sem texto, mostra as páginas guardadas e
   meia dúzia de atalhos.

   O índice vem de PhotographyPage.searchIndex() (os JSON que o site já
   usa), carregado na primeira abertura.

   PhFav — páginas guardadas (localStorage['ph-favs'] = [{ r, t, s }]).
   ══════════════════════════════════════════════════════════════════ */
const PhFav = (function () {
  'use strict';
  const KEY = 'ph-favs';
  const all = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(0, 40))); } catch (_) {} document.dispatchEvent(new CustomEvent('ph:favs')); };
  return {
    all,
    has: r => all().some(f => f.r === r),
    toggle(item) {
      const v = all(), i = v.findIndex(f => f.r === item.r);
      if (i >= 0) v.splice(i, 1); else v.unshift(item);
      save(v);
      return i < 0;
    },
  };
})();

const PhSearch = (function () {
  'use strict';
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let _index = null, _loading = null, _el = null, _items = [], _sel = 0, _last = null;

  function index() {
    if (_index) return Promise.resolve(_index);
    if (_loading) return _loading;
    _loading = (typeof PhotographyPage !== 'undefined' && PhotographyPage.searchIndex ? PhotographyPage.searchIndex() : Promise.resolve([]))
      .then(list => (_index = list.map(it => Object.assign(it, { nt: norm(it.t), nk: norm((it.s || '') + ' ' + (it.k || '')) }))))
      .catch(() => { _loading = null; return []; });
    return _loading;
  }
  /* título de uma rota, para a barra do browser e para os guardados */
  function titleFor(route) { return index().then(ix => ix.find(it => it.r === route) || null); }

  function score(it, words) {
    let sc = 0;
    for (const w of words) {
      const i = it.nt.indexOf(w);
      if (i === 0) sc += 100;
      else if (i > 0 && /[\s\-/(]/.test(it.nt[i - 1])) sc += 60;
      else if (i > 0) sc += 30;
      else if (it.nk.includes(w)) sc += 8;
      else return 0;
    }
    return sc + (it.w || 0) - it.nt.length * 0.05;
  }

  function build() {
    const d = document.createElement('div');
    d.className = 'ps'; d.hidden = true;
    d.innerHTML = `<div class="ps-box" role="dialog" aria-modal="true" aria-label="Pesquisar no site">
        <div class="ps-in">${PhIcon.svg('search')}
          <input class="ps-q" type="search" autocomplete="off" spellcheck="false" placeholder="Géneros, lições, ferramentas…" aria-label="Pesquisar" role="combobox" aria-expanded="true" aria-controls="ps-list" aria-autocomplete="list"/>
          <button type="button" class="ps-x" aria-label="Fechar a pesquisa">Esc</button></div>
        <div class="ps-list" id="ps-list" role="listbox" aria-label="Resultados"></div>
        <p class="ps-foot dp-mono"><span><kbd>↑</kbd><kbd>↓</kbd> escolher</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></p>
      </div>`;
    document.body.appendChild(d);
    const q = d.querySelector('.ps-q');
    q.addEventListener('input', () => render(q.value));
    d.addEventListener('mousedown', e => { if (e.target === d) close(); });
    d.querySelector('.ps-x').addEventListener('click', close);
    d.querySelector('.ps-list').addEventListener('click', e => { const a = e.target.closest('[data-i]'); if (a) { e.preventDefault(); go(+a.dataset.i); } });
    d.querySelector('.ps-list').addEventListener('mousemove', e => { const a = e.target.closest('[data-i]'); if (a && +a.dataset.i !== _sel) select(+a.dataset.i, true); });
    d.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); select(Math.min(_sel + 1, _items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(Math.max(_sel - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); go(_sel); }
      else if (e.key === 'Tab') { e.preventDefault(); q.focus(); }          // o foco fica preso na caixa
    });
    return d;
  }

  const QUICK = [
    { t: 'Câmara escura', s: 'Laboratório · simulador de exposição', r: 'laboratorio/camara' },
    { t: 'Mesa de revelação', s: 'Editar · todos os ajustes numa fotografia', r: 'edicao/mesa' },
    { t: 'Consulta rápida', s: 'Fotografar · cartões de bolso', r: 'consulta' },
    { t: 'Composição', s: 'Aprender · capítulo', r: 'aprender/composicao' },
    { t: 'Profundidade de campo', s: 'Laboratório · instrumento', r: 'laboratorio/dof' },
    { t: 'Estúdio 3D', s: 'Laboratório', r: 'estudio' },
  ];
  function row(it, i) {
    return `<a class="ps-it" role="option" id="ps-o${i}" data-i="${i}" href="#${esc(it.r)}" aria-selected="${i === _sel}">
      <span class="ps-it-t">${esc(it.t)}</span><span class="ps-it-s">${esc(it.s || '')}</span></a>`;
  }
  function render(text) {
    const list = _el.querySelector('.ps-list');
    const words = norm(text).split(/\s+/).filter(Boolean);
    _sel = 0;
    if (!words.length) {
      const favs = PhFav.all();
      _items = favs.concat(QUICK.filter(qk => !favs.some(f => f.r === qk.r)));
      list.innerHTML = (favs.length ? `<p class="ps-h dp-mono">Guardados</p>${favs.map(row).join('')}` : '')
        + `<p class="ps-h dp-mono">Atalhos</p>${_items.slice(favs.length).map((it, i) => row(it, i + favs.length)).join('')}`;
      return sync();
    }
    if (!_index) { list.innerHTML = '<p class="ps-empty">A preparar o índice…</p>'; index().then(() => { if (!_el.hidden) render(_el.querySelector('.ps-q').value); }); return; }
    _items = _index.map(it => [score(it, words), it]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 24).map(x => x[1]);
    list.innerHTML = _items.length ? _items.map(row).join('')
      : `<p class="ps-empty">Nada encontrado para «${esc(text)}». Experimenta um género (retrato, praia), um conceito (abertura, curva) ou uma ferramenta.</p>`;
    sync();
  }
  function sync() {
    const q = _el.querySelector('.ps-q');
    if (_items.length) q.setAttribute('aria-activedescendant', 'ps-o' + _sel); else q.removeAttribute('aria-activedescendant');
  }
  function select(i, quiet) {
    _sel = i;
    _el.querySelectorAll('.ps-it').forEach(a => a.setAttribute('aria-selected', +a.dataset.i === i));
    if (!quiet) { const a = _el.querySelector(`.ps-it[data-i="${i}"]`); if (a) a.scrollIntoView({ block: 'nearest' }); }
    sync();
  }
  function go(i) { const it = _items[i]; if (!it) return; close(true); PhNav.go(it.r); }

  function open() {
    if (!_el) _el = build();
    if (!_el.hidden) return;
    _last = document.activeElement;
    if (typeof PhShell !== 'undefined') PhShell.closeMenu();
    _el.hidden = false; _el.classList.add('ps-open'); document.body.classList.add('ps-lock');
    const q = _el.querySelector('.ps-q'); q.value = '';
    render('');
    index();
    requestAnimationFrame(() => q.focus());
  }
  function close(silent) {
    if (!_el || _el.hidden) return;
    _el.hidden = true; _el.classList.remove('ps-open'); document.body.classList.remove('ps-lock');
    if (!silent && _last && document.contains(_last)) _last.focus();
  }

  document.addEventListener('keydown', e => {
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'k' || k === 'K')) { e.preventDefault(); open(); }
    else if (k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target.closest && e.target.closest('input,textarea,select,[contenteditable]'))) { e.preventDefault(); open(); }
  });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-search-open]')) { e.preventDefault(); open(); } });

  return { open, close, index, titleFor };
})();
