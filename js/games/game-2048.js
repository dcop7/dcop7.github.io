/* ══════════════════════════════════════════════════════════════════
   2048 — desliza as peças; iguais juntam-se e somam. Tabuleiros 3×3,
   4×4 e 5×5. Deslizar com o dedo, arrastar com o rato ou usar as
   setas. Peças em DOM com transições (posição em %, por isso redimensiona
   sem contas), desfazer limitado pela dificuldade e partida guardada:
   sair a meio e voltar mais tarde continua onde ficou.
══════════════════════════════════════════════════════════════════ */
const Game2048 = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const ID = '2048';
  const DIFF = { easy: { undo: 3, p4: .08 }, medium: { undo: 1, p4: .1 }, hard: { undo: 0, p4: .2 } };
  const GOAL = { 3: 256, 4: 2048, 5: 2048 };
  const store = () => (typeof GameProgress !== 'undefined' ? GameProgress.store(ID) : { getPref: (k, d) => d, setPref: () => {} });
  let uid = 1;

  /* ── lógica pura do tabuleiro ── */
  function emptyCells(G) { const e = []; for (let r = 0; r < G.n; r++) for (let c = 0; c < G.n; c++) if (!G.cells[r][c]) e.push([r, c]); return e; }
  function spawn(G) {
    const e = emptyCells(G); if (!e.length) return null;
    const [r, c] = U.pick(e);
    const t = { id: uid++, v: Math.random() < G.cfg.p4 ? 4 : 2, r, c, fresh: true };
    G.cells[r][c] = t; G.tiles.push(t); return t;
  }
  function canMove(G) {
    if (emptyCells(G).length) return true;
    for (let r = 0; r < G.n; r++) for (let c = 0; c < G.n; c++) {
      const v = G.cells[r][c].v;
      if ((c + 1 < G.n && G.cells[r][c + 1].v === v) || (r + 1 < G.n && G.cells[r + 1][c].v === v)) return true;
    }
    return false;
  }
  function snapshot(G) { return { cells: G.cells.map(row => row.map(t => (t ? t.v : 0))), score: G.score }; }
  function fromSnap(G, s) {
    G.tiles = []; G.cells = s.cells.map((row, r) => row.map((v, c) => { if (!v) return null; const t = { id: uid++, v, r, c }; G.tiles.push(t); return t; }));
    G.score = s.score;
  }

  /* devolve true se algo mexeu */
  function slide(G, dir) {
    const n = G.n, vec = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
    const rows = [...Array(n).keys()], cols = [...Array(n).keys()];
    if (vec[0] === 1) rows.reverse(); if (vec[1] === 1) cols.reverse();
    const merged = new Set(); let moved = false, gained = 0;
    G.tiles.forEach(t => { t.fresh = false; t.pop = false; });
    for (const r of rows) for (const c of cols) {
      const t = G.cells[r][c]; if (!t) continue;
      let nr = r, nc = c;
      while (true) {
        const tr = nr + vec[0], tc = nc + vec[1];
        if (tr < 0 || tr >= n || tc < 0 || tc >= n) break;
        const o = G.cells[tr][tc];
        if (!o) { nr = tr; nc = tc; continue; }
        if (o.v === t.v && !merged.has(o.id)) {
          /* funde: t desliza para cima de o e morre; o dobra */
          G.cells[r][c] = null; t.r = tr; t.c = tc; t.dying = true;
          o.v *= 2; o.pop = true; merged.add(o.id); gained += o.v; moved = true;
          G.best = Math.max(G.best, o.v);
          nr = null; break;
        }
        break;
      }
      if (nr === null) continue;
      if (nr !== r || nc !== c) { G.cells[r][c] = null; G.cells[nr][nc] = t; t.r = nr; t.c = nc; moved = true; }
    }
    G.score += gained;
    return { moved, gained, merges: merged.size };
  }

  function save(G) {
    if (G.over) { store().setPref('save', null); return; }
    store().setPref('save', { n: G.n, diff: G.diff, mode: G.mode, score: G.score, best: G.best, undo: G.undo, won: G.won, cells: snapshot(G).cells, moves: G.moves, t: G.t });
  }

  function setup(api, o) {
    let mode = o.mode || '4', saved = null;
    if (mode === 'resume') { saved = store().getPref('save', null); if (saved) { mode = saved.mode; api.setMode(mode, saved.diff); } else mode = '4'; }
    const diff = saved ? saved.diff : (o.diff || 'medium');
    const n = +mode || 4;
    const G = { n, mode, diff, cfg: DIFF[diff] || DIFF.medium, cells: [], tiles: [], score: 0, best: 2, undo: 0, prev: null, won: false, over: false, moves: 0, t: 0, api };
    G.undo = G.cfg.undo;
    if (saved) { fromSnap(G, { cells: saved.cells, score: saved.score }); G.best = saved.best; G.undo = saved.undo; G.won = saved.won; G.moves = saved.moves || 0; G.t = saved.t || 0; }
    else { G.cells = Array.from({ length: n }, () => Array(n).fill(null)); spawn(G); spawn(G); G.best = Math.max(...G.tiles.map(t => t.v)); }
    build(G, api);
    return G;
  }

  function build(G, api) {
    injectCSS();
    const L = api.layer;
    L.innerHTML = `
      <div class="t48">
        <div class="t48-top">
          <div class="t48-goal">Objetivo: <b>${GOAL[G.n]}</b></div>
          <div class="t48-btns">
            <button type="button" class="t48-btn" data-act="undo">↶ Desfazer <span></span></button>
            <button type="button" class="t48-btn" data-act="new">Novo</button>
          </div>
        </div>
        <div class="t48-board" style="--n:${G.n}" tabindex="0" aria-label="Tabuleiro 2048">
          ${Array.from({ length: G.n * G.n }, (_, i) => `<div class="t48-cell" style="left:${(i % G.n) * 100 / G.n}%;top:${Math.floor(i / G.n) * 100 / G.n}%"></div>`).join('')}
          <div class="t48-tiles"></div>
        </div>
        <div class="t48-hint">Desliza o dedo, arrasta com o rato ou usa as setas.</div>
      </div>`;
    G.el = { tiles: L.querySelector('.t48-tiles'), board: L.querySelector('.t48-board'), undo: L.querySelector('[data-act="undo"]') };
    G.nodes = new Map();
    L.querySelector('.t48-top').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'undo') doUndo(G, api);
      if (b.dataset.act === 'new') { store().setPref('save', null); api.restart(); }
    });
    /* deslizar: toque e rato pelo mesmo caminho */
    const bd = G.el.board;
    let s = null;
    bd.addEventListener('pointerdown', e => { s = { x: e.clientX, y: e.clientY, done: false }; try { bd.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault(); });
    bd.addEventListener('pointermove', e => {
      if (!s || s.done) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.hypot(dx, dy) > 26) { s.done = true; move(G, api, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }
    });
    const end = () => { s = null; };
    bd.addEventListener('pointerup', end); bd.addEventListener('pointercancel', end);
    if (window.ResizeObserver) { G.ro = new ResizeObserver(() => bd.style.setProperty('--cell', (bd.clientWidth / G.n) + 'px')); G.ro.observe(bd); }
    render(G, true);
  }

  function tileColor(v) {
    const pal = { 2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'] };
    return pal[v] || ['#8b5cf6', '#fff'];
  }

  function render(G, instant) {
    const seen = new Set();
    G.tiles.forEach(t => {
      seen.add(t.id);
      let el = G.nodes.get(t.id);
      if (!el) {
        el = document.createElement('div'); el.className = 't48-tile' + (t.fresh && !instant ? ' new' : '');
        el.innerHTML = '<span></span>'; G.el.tiles.appendChild(el); G.nodes.set(t.id, el);
      }
      el.style.left = (t.c * 100 / G.n) + '%'; el.style.top = (t.r * 100 / G.n) + '%';
      const paint = () => {
        const [bg, fg] = tileColor(t.v), sp = el.firstChild;
        sp.textContent = t.v; sp.style.background = bg; sp.style.color = fg;
        sp.style.fontSize = `calc(var(--cell) * ${t.v < 100 ? .46 : t.v < 1000 ? .38 : t.v < 10000 ? .3 : .24})`;
        sp.classList.toggle('glow', t.v >= 128);
      };
      if (t.pop && !instant) { setTimeout(() => { paint(); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }, 95); }
      else paint();
      if (t.dying) setTimeout(() => { el.remove(); G.nodes.delete(t.id); }, 110);
    });
    G.nodes.forEach((el, id) => { if (!seen.has(id)) { el.remove(); G.nodes.delete(id); } });
    G.tiles = G.tiles.filter(t => !t.dying);
    const u = G.el.undo; u.querySelector('span').textContent = G.cfg.undo ? `(${G.undo})` : ''; u.disabled = !G.prev || G.undo <= 0; u.hidden = !G.cfg.undo;
    const w = G.el.board.clientWidth; G.el.board.style.setProperty('--cell', (w / G.n) + 'px');
  }

  function move(G, api, dir) {
    if (G.over || G.busy || api.state !== 'play') return;
    const before = snapshot(G);
    const r = slide(G, dir);
    if (!r.moved) { G.el.board.classList.remove('nudge-' + dir); void G.el.board.offsetWidth; G.el.board.classList.add('nudge-' + dir); return; }
    G.prev = before; G.moves++;
    spawn(G);
    render(G);
    G.busy = true; setTimeout(() => { G.busy = false; }, 70);
    if (r.merges) {
      const top = Math.log2(Math.max(4, ...G.tiles.map(t => t.v)));
      api.sfx.tone(220 * Math.pow(2, Math.min(top, 14) / 6), .09, 'sine', .07);
      if (r.merges > 1) api.sfx.tone(330 * Math.pow(2, Math.min(top, 14) / 6), .09, 'triangle', .04, .04);
      api.vibe(6);
    } else api.sfx.tone(180, .03, 'triangle', .03);
    save(G);
    if (!G.won && G.best >= GOAL[G.n]) {
      G.won = true; save(G);
      setTimeout(() => api.panel({ icon: '🏆', title: `Chegaste a ${GOAL[G.n]}!`, big: G.score, sub: 'Podes continuar a jogar para bater o recorde.',
        buttons: [{ label: '▶ Continuar a jogar', primary: true, fn: () => api.resume() },
          { label: 'Terminar aqui', fn: () => finish(G, api, true) }] }), 300);
      api.sfx.win();
      return;
    }
    if (!canMove(G)) setTimeout(() => finish(G, api, G.won), 350);
  }

  function doUndo(G, api) {
    if (!G.prev || G.undo <= 0 || G.over || api.state !== 'play') return;
    G.undo--; fromSnap(G, G.prev); G.prev = null;
    G.el.tiles.innerHTML = ''; G.nodes.clear();
    render(G, true); save(G);
    api.sfx.tone(500, .06, 'triangle', .05, 0, 300);
  }

  function finish(G, api, won) {
    if (G.over) return;
    G.over = true; save(G);
    api.over({ score: G.score, won: !!won, delay: won ? 0 : 500, title: won ? 'Grande jogo!' : 'Sem jogadas', icon: won ? '🏆' : '🔢',
      stats: [['Maior peça', G.best], ['Jogadas', G.moves], ['Tabuleiro', G.n + '×' + G.n]], meta: { best: G.best } });
  }

  function injectCSS() {
    if (document.getElementById('t48-css')) return;
    const s = document.createElement('style'); s.id = 't48-css';
    s.textContent = `
.t48{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:66px 14px 12px;background:radial-gradient(ellipse at 50% 0%,#3b2a1a,#140e09 70%)}
.t48-top{width:min(100%,calc(100dvh - 330px),520px);min-width:min(100%,300px);display:flex;align-items:center;justify-content:space-between;gap:8px}
.t48-goal{font-size:.8rem;color:#e7d3b8}
.t48-goal b{color:#edc22e}
.t48-btns{display:flex;gap:6px}
.t48-btn{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#f5ecdf;border-radius:10px;padding:8px 12px;font:700 .82rem system-ui;cursor:pointer}
.t48-btn:disabled{opacity:.4;cursor:default}
.t48-btn[hidden]{display:none}
.t48-board{position:relative;width:min(100%,calc(100dvh - 330px),520px);min-width:min(100%,300px);aspect-ratio:1;border-radius:14px;background:#bbada0;padding:0;box-shadow:0 14px 40px rgba(0,0,0,.45),inset 0 0 0 6px #bbada0;touch-action:none;user-select:none;outline:none}
.t48-cell,.t48-tile{position:absolute;width:calc(100% / var(--n));height:calc(100% / var(--n));padding:calc(10px / var(--n) * 4 / 2 + 2px);box-sizing:border-box}
.t48-cell::before{content:'';display:block;width:100%;height:100%;border-radius:8px;background:rgba(238,228,218,.35)}
.t48-tile{transition:left .1s ease-in-out,top .1s ease-in-out;z-index:2}
.t48-tile span{display:flex;width:100%;height:100%;align-items:center;justify-content:center;border-radius:8px;font-family:'Space Grotesk',system-ui,sans-serif;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;box-shadow:0 2px 0 rgba(0,0,0,.08)}
.t48-tile span.glow{box-shadow:0 0 18px rgba(243,215,116,.55),inset 0 0 0 1px rgba(255,255,255,.3)}
.t48-tile.new span{animation:t48In .2s .1s both}
.t48-tile.pop span{animation:t48Pop .2s}
@keyframes t48In{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes t48Pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
.t48-board.nudge-left{animation:t48NL .18s}.t48-board.nudge-right{animation:t48NR .18s}.t48-board.nudge-up{animation:t48NU .18s}.t48-board.nudge-down{animation:t48ND .18s}
@keyframes t48NL{50%{transform:translateX(-5px)}}@keyframes t48NR{50%{transform:translateX(5px)}}@keyframes t48NU{50%{transform:translateY(-5px)}}@keyframes t48ND{50%{transform:translateY(5px)}}
.t48-hint{font-size:.72rem;color:rgba(231,211,184,.55)}
@media (prefers-reduced-motion:reduce){.t48-tile{transition:none}.t48-tile.new span,.t48-tile.pop span,.t48-board[class*=nudge]{animation:none}}`;
    document.head.appendChild(s);
  }

  return ArcadeKit.create({
    id: ID, title: '2048', icon: '🔢',
    accent: '#edc22e', accent2: '#f67c5f', bg: '#140e09', canvas: false, ready: false,
    tagline: 'Junta peças iguais até chegares a 2048 — e depois continua, se tiveres coragem.',
    view: { w: 400 },
    modes: () => {
      const sv = store().getPref('save', null);
      return [
        ...(sv ? [{ id: 'resume', icon: '▶️', name: 'Continuar', desc: `${sv.n}×${sv.n} · ${sv.score} pontos · maior peça ${sv.best}`, noBest: true, note: 'guardado' }] : []),
        { id: '4', icon: '🟧', name: 'Clássico 4×4', desc: 'O original. Objetivo: 2048.' },
        { id: '5', icon: '🟨', name: 'Grande 5×5', desc: 'Mais espaço, partidas mais longas.' },
        { id: '3', icon: '🟥', name: 'Aperto 3×3', desc: 'Pouquíssimo espaço. Objetivo: 256.' },
      ];
    },
    how: [
      'Desliza o dedo (ou arrasta com o rato, ou usa as setas): todas as peças deslizam nesse sentido.',
      'Duas peças iguais que chocam juntam-se numa só com a soma. Cada jogada faz nascer uma peça nova.',
      'Chega ao objetivo sem encher o tabuleiro. A partida fica guardada — podes sair e continuar depois. Em Fácil podes desfazer 3 vezes; em Difícil nenhuma, e saem mais 4.',
    ],
    controls: ['🖱️ Arrastar', '👆 Deslizar', '⌨️ Setas'],
    setup, update: (G, dt) => { G.t += dt; },
    resize: G => { if (G.el) { const w = G.el.board.clientWidth; G.el.board.style.setProperty('--cell', (w / G.n) + 'px'); } },
    key: (G, e, api) => {
      const d = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' }[e.key];
      if (d) { move(G, api, d); return true; }
      if ((e.key === 'z' || e.key === 'u') && !e.ctrlKey) { doUndo(G, api); return true; }
    },
    hud: G => [['Pontos', G.score], ['Recorde', Math.max(G.api.best || 0, G.score)], ['Maior', G.best, G.best >= GOAL[G.n] ? 'hot' : '']],
    achievements: [
      { id: 't48.512',  name: 'A Aquecer',   icon: '🟧', desc: 'Faz uma peça de 512 no 2048.',  test: c => ((c.result.meta || {}).best || 0) >= 512 },
      { id: 't48.2048', name: '2048!',       icon: '🏆', desc: 'Faz a peça de 2048.',            test: c => ((c.result.meta || {}).best || 0) >= 2048 },
      { id: 't48.4096', name: 'Para Lá do Fim', icon: '🌌', desc: 'Faz uma peça de 4096 no 2048.', test: c => ((c.result.meta || {}).best || 0) >= 4096 },
    ],
  });
})();
