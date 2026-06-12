/* ══════════════════════════════════════════════════════════════════
   ChessGame — full browser chess, no backend, 2D (mobile-first).
   Rules/move-generation: vendored chess.js (global `Chess`, BSD).
   AI: own negamax + alpha-beta with material + piece-square tables.
   Polished 2D board: themed wooden frame, crisp outlined SVG pieces,
   sliding move animation, selectable light/dark themes (wood default),
   optional move hints, per-side clocks + move counter, captured-piece
   trays, promotion picker, undo, 3 AI levels + local 2-player.
   Integrates GameProgress.
══════════════════════════════════════════════════════════════════ */
const ChessGame = (function () {
  'use strict';

  const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
  const VAL   = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE  = 1000000;

  const PST = {
    p: [ 0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
         5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
         5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0 ],
    n: [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
         -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
         -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
    b: [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
         -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
         -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
    r: [ 0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
         -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
    q: [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
         -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
         -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
    k: [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
         -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
         20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ],
  };

  const LEVELS = {
    easy:   { depth: 1, blunder: 0.45, label: 'Fácil',   dot: '🟢' },
    medium: { depth: 2, blunder: 0.10, label: 'Médio',   dot: '🟡' },
    hard:   { depth: 3, blunder: 0.0,  label: 'Difícil', dot: '🔴' },
  };

  /* Board + piece themes. light/dark = squares, pcLight/pcDark = pieces,
     frame = board border. Applied via CSS variables on the board wrapper. */
  const THEMES = {
    /* ── claros ── */
    wood:   { name: 'Madeira', emoji: '🪵', group: 'light', light: '#f0d9b5', dark: '#b58863', frame: '#6d4326', pcLight: '#f7ecd6', pcDark: '#4a2f1c' },
    marble: { name: 'Mármore', emoji: '🏛️', group: 'light', light: '#eceae3', dark: '#a39a88', frame: '#6f685b', pcLight: '#fcfbf8', pcDark: '#3b362f' },
    ice:    { name: 'Gelo',    emoji: '❄️', group: 'light', light: '#dbe7f1', dark: '#7ba0c0', frame: '#3f5a72', pcLight: '#fbfdff', pcDark: '#22303c' },
    /* ── escuros ── */
    night:  { name: 'Noturno', emoji: '🌙', group: 'dark', light: '#5c6479', dark: '#333a4f', frame: '#1a1f30', pcLight: '#eef1f8', pcDark: '#0c0f1a' },
    forest: { name: 'Floresta',emoji: '🌲', group: 'dark', light: '#566b4e', dark: '#34492c', frame: '#172414', pcLight: '#eef3e6', pcDark: '#0b1707' },
    coffee: { name: 'Café',    emoji: '☕', group: 'dark', light: '#7c6650', dark: '#4c3526', frame: '#23160d', pcLight: '#f1e7d9', pcDark: '#150b05' },
  };

  let root, game, mode = 'ai', diffKey = 'medium', humanColor = 'w';
  let selected = null, legalDests = [], lastMove = null, busy = false, animMove = null;
  function loadPref(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function savePref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  let showHints = loadPref('chess-hints', '0') === '1';
  let themeKey  = (THEMES[loadPref('chess-theme', 'wood')] ? loadPref('chess-theme', 'wood') : 'wood');
  let clock = { w: 0, b: 0 }, clockTimer = null, lastTick = 0;
  function theme() { return THEMES[themeKey] || THEMES.wood; }

  /* ── evaluation / search ────────────────────────────────────────── */
  function evaluate(g) {
    const board = g.board();
    let white = 0;
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const pc = board[row][col]; if (!pc) continue;
      const idx = row * 8 + col;
      const base = VAL[pc.type] + PST[pc.type][pc.color === 'w' ? idx : (7 - row) * 8 + col];
      white += pc.color === 'w' ? base : -base;
    }
    return g.turn() === 'w' ? white : -white;
  }
  function orderMoves(moves) {
    return moves.sort((a, b) => {
      const av = (a.captured ? VAL[a.captured] : 0) + (a.promotion ? 800 : 0);
      const bv = (b.captured ? VAL[b.captured] : 0) + (b.promotion ? 800 : 0);
      return bv - av;
    });
  }
  function negamax(g, depth, alpha, beta, ply) {
    if (g.in_checkmate()) return -MATE + ply;
    if (g.in_draw() || g.in_stalemate() || g.in_threefold_repetition() || g.insufficient_material()) return 0;
    if (depth === 0) return evaluate(g);
    let best = -Infinity;
    for (const m of orderMoves(g.moves({ verbose: true }))) {
      g.move(m);
      const score = -negamax(g, depth - 1, -beta, -alpha, ply + 1);
      g.undo();
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function chooseAIMove() {
    const lvl = LEVELS[diffKey] || LEVELS.medium;
    const moves = g_moves();
    if (!moves.length) return null;
    if (lvl.blunder && Math.random() < lvl.blunder) return moves[Math.floor(Math.random() * moves.length)];
    let best = -Infinity, bestMoves = [];
    for (const m of orderMoves(moves)) {
      game.move(m);
      const score = -negamax(game, lvl.depth - 1, -Infinity, Infinity, 1);
      game.undo();
      if (score > best) { best = score; bestMoves = [m]; }
      else if (score === best) bestMoves.push(m);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }
  function g_moves() { return game.moves({ verbose: true }); }

  /* ── CSS ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('ch-css')) return;
    const s = document.createElement('style'); s.id = 'ch-css';
    s.textContent = `
.ch-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0;width:100%;
  --sql:#f0d9b5;--sqd:#b58863;--frm:#6d4326;--pcl:#f7ecd6;--pcd:#4a2f1c}
.ch-menu{display:flex;flex-direction:column;align-items:center;gap:14px;padding:26px 16px;text-align:center}
.ch-logo{font-size:3.2rem;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}
.ch-title{font-family:var(--font-head,inherit);font-size:1.8rem;font-weight:900;color:var(--text,#fff)}
.ch-sub{font-size:.8rem;color:var(--muted,#9aa);letter-spacing:.08em;text-transform:uppercase}
.ch-opts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:360px}
.ch-opt{background:var(--card2,#1b1d33);border:1.5px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:10px;padding:9px 16px;font:inherit;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-opt:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5)}
.ch-opt.active{background:var(--accent-soft,rgba(124,92,255,.16));border-color:rgba(var(--accent-rgb,124,92,255),.7);color:var(--accent,#a98bff)}
.ch-play{background:linear-gradient(135deg,var(--accent,#7c5cff),#a855f7);color:#fff;border:none;border-radius:12px;padding:13px 44px;font:inherit;font-size:1.05rem;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(124,92,255,.35);transition:transform .15s}
.ch-play:hover{transform:scale(1.04)}

.ch-status{display:flex;align-items:center;gap:8px;font-size:.92rem;font-weight:700;color:var(--text,#fff);min-height:24px;text-align:center}
.ch-turn-dot{width:13px;height:13px;border-radius:50%;border:1.5px solid #888}
.ch-turn-w{background:#f1f1f1}.ch-turn-b{background:#222}
/* clocks + move counter */
.ch-bar{display:flex;align-items:stretch;gap:8px;width:min(94vw,480px);justify-content:space-between}
.ch-clock{display:flex;align-items:center;gap:7px;background:var(--card2,#1b1d33);border:1.5px solid var(--border,#2a2c44);border-radius:11px;padding:7px 14px;min-width:92px;justify-content:center;transition:all .15s}
.ch-clock.active{border-color:rgba(var(--accent-rgb,124,92,255),.85);background:var(--accent-soft,rgba(124,92,255,.14));box-shadow:0 0 0 1px rgba(var(--accent-rgb,124,92,255),.4)}
.ch-clock .pip{width:14px;height:14px;border-radius:50%;border:1.5px solid #777}
.ch-clock .pip.w{background:#f1f1f1}.ch-clock .pip.b{background:#1c1c1c}
.ch-clock .t{font-variant-numeric:tabular-nums;font-weight:800;font-size:1rem;color:var(--text,#fff);letter-spacing:.5px}
.ch-moves{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:var(--muted,#9aa);font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.ch-moves b{font-size:1.1rem;color:var(--text,#fff);font-variant-numeric:tabular-nums}
/* captured trays */
.ch-tray{display:flex;align-items:center;gap:0;flex-wrap:wrap;justify-content:flex-start;min-height:24px;width:min(94vw,480px);padding:0 2px}
.ch-tray.bot{align-items:flex-start}
.ch-cap{width:20px;height:24px;display:inline-flex;align-items:center;justify-content:center;margin-right:-3px}
.ch-cap svg{width:100%;height:100%;overflow:visible}
.ch-adv{font-size:.8rem;font-weight:800;color:var(--muted,#9aa);margin-left:8px;align-self:center}
/* board */
.ch-board{width:min(94vw,480px);aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);
  border:7px solid var(--frm);border-radius:10px;overflow:hidden;touch-action:manipulation;
  box-shadow:0 16px 44px rgba(0,0,0,.5),0 2px 0 rgba(255,255,255,.06) inset,inset 0 0 0 1px rgba(0,0,0,.25)}
.ch-sq{position:relative;display:flex;align-items:center;justify-content:center;border:none;padding:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;overflow:visible}
.ch-light{background:var(--sql)}.ch-dark{background:var(--sqd)}
.ch-pc{position:relative;z-index:2;width:92%;height:92%;pointer-events:none;will-change:transform;
  filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
.ch-pc-w{fill:var(--pcl);stroke:var(--pcd)}
.ch-pc-b{fill:var(--pcd);stroke:var(--pcl)}
.ch-pc text{paint-order:stroke;stroke-width:3px;stroke-linejoin:round;
  font-family:'Segoe UI Symbol','Apple Symbols','Noto Sans Symbols2','DejaVu Sans',sans-serif}
.ch-sq.sel::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 4px rgba(120,210,120,.95);z-index:1}
.ch-sq.last::before{content:'';position:absolute;inset:0;background:rgba(245,205,80,.42);z-index:0}
.ch-sq.check::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(239,68,68,.85),rgba(239,68,68,.2) 65%,transparent 72%);z-index:0}
.ch-dest::after{content:'';position:absolute;width:32%;height:32%;border-radius:50%;background:rgba(60,180,75,.5);z-index:1;box-shadow:0 0 0 2px rgba(255,255,255,.18)}
.ch-dest.cap::after{width:90%;height:90%;background:transparent;border:5px solid rgba(60,180,75,.55);box-sizing:border-box}
.ch-coord{position:absolute;font-size:clamp(8px,2vw,11px);font-weight:800;opacity:.65;z-index:1;pointer-events:none}
.ch-coord.f{right:3px;bottom:1px}.ch-coord.r{left:3px;top:1px}
.ch-light .ch-coord{color:var(--sqd)}.ch-dark .ch-coord{color:var(--sql)}

.ch-ctrls{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;max-width:480px}
.ch-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:9px;padding:9px 15px;font:inherit;font-size:.83rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5);color:var(--accent,#a98bff)}
.ch-btn.on{background:var(--accent-soft,rgba(124,92,255,.16));border-color:rgba(var(--accent-rgb,124,92,255),.7);color:var(--accent,#a98bff)}
.ch-btn:disabled{opacity:.4;cursor:default}

/* modals (promotion + theme picker) */
.ch-back{position:fixed;inset:0;z-index:9997;background:rgba(6,8,16,.82);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px}
.ch-promo{background:#161a2c;border:1px solid var(--border,#2a2c44);border-radius:16px;padding:18px;display:flex;gap:10px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.ch-promo button{background:var(--sql,#e8edf4);border:2px solid transparent;border-radius:12px;width:66px;height:66px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s}
.ch-promo button:hover{border-color:var(--accent,#7c5cff);transform:scale(1.06)}
.ch-promo button svg{width:54px;height:54px}
.ch-pop{background:#161a2c;border:1px solid var(--border,#2a2c44);border-radius:16px;padding:18px 18px 20px;max-width:min(92vw,400px);box-shadow:0 24px 70px rgba(0,0,0,.65)}
.ch-pop-title{font-weight:800;color:var(--text,#fff);font-size:1.05rem;text-align:center;margin-bottom:8px}
.ch-pop-grp{font-size:.72rem;font-weight:700;letter-spacing:.06em;color:var(--muted,#9aa);margin:12px 0 6px;text-transform:uppercase}
.ch-themes{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.ch-theme{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;border:2px solid transparent;border-radius:12px;padding:6px 7px;transition:all .15s}
.ch-theme:hover{background:rgba(255,255,255,.05)}
.ch-theme.active{border-color:var(--accent,#7c5cff);background:var(--accent-soft,rgba(124,92,255,.12))}
.ch-sw{width:54px;height:36px;border-radius:8px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;box-shadow:0 2px 8px rgba(0,0,0,.45);border:2px solid rgba(0,0,0,.3)}
.ch-sw i{display:block}
.ch-theme-lbl{font-size:.68rem;color:var(--text2,#ccd);font-weight:700}
@media (prefers-reduced-motion:reduce){.ch-pc,.ch-play,.ch-promo button{transition:none!important}}`;
    document.head.appendChild(s);
  }

  /* ── init / menu ────────────────────────────────────────────────── */
  function init(r) {
    root = r; if (!root) return;
    if (typeof Chess === 'undefined') { root.innerHTML = '<p style="padding:1rem;color:#f87171">Motor de xadrez indisponível.</p>'; return; }
    injectCSS();
    showMenu();
  }

  function showMenu() {
    stopClock();
    const opp = [
      { k: 'ai-easy',   t: '🟢 IA Fácil' }, { k: 'ai-medium', t: '🟡 IA Médio' },
      { k: 'ai-hard',   t: '🔴 IA Difícil' }, { k: '2p',       t: '👥 2 Jogadores' },
    ];
    const cur = mode === '2p' ? '2p' : 'ai-' + diffKey;
    root.innerHTML = `
      <div class="ch-wrap">
        <div class="ch-menu">
          <div class="ch-logo">♟️</div>
          <div class="ch-title">Xadrez</div>
          <div class="ch-sub">Adversário</div>
          <div class="ch-opts" id="ch-opp">
            ${opp.map(o => `<button class="ch-opt${o.k === cur ? ' active' : ''}" data-k="${o.k}">${o.t}</button>`).join('')}
          </div>
          <div class="ch-sub">Jogas com</div>
          <div class="ch-opts" id="ch-color">
            <button class="ch-opt${humanColor === 'w' ? ' active' : ''}" data-c="w">⚪ Brancas</button>
            <button class="ch-opt${humanColor === 'b' ? ' active' : ''}" data-c="b">⚫ Pretas</button>
            <button class="ch-opt" data-c="rand">🎲 Aleatório</button>
          </div>
          <div class="ch-sub" style="font-size:.72rem;opacity:.8;max-width:300px">⚙️ Tema do tabuleiro e dicas escolhem-se durante o jogo</div>
          <button class="ch-play" id="ch-play">▶ Jogar</button>
        </div>
      </div>`;
    applyThemeVars();
    root.querySelectorAll('#ch-opp .ch-opt').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === '2p') mode = '2p'; else { mode = 'ai'; diffKey = k.split('-')[1]; }
      root.querySelectorAll('#ch-opp .ch-opt').forEach(x => x.classList.toggle('active', x === b));
    }));
    root.querySelectorAll('#ch-color .ch-opt').forEach(b => b.addEventListener('click', () => {
      humanColor = b.dataset.c === 'rand' ? (Math.random() < 0.5 ? 'w' : 'b') : b.dataset.c;
      root.querySelectorAll('#ch-color .ch-opt').forEach(x => x.classList.toggle('active', x.dataset.c === humanColor));
    }));
    root.querySelector('#ch-play').addEventListener('click', startGame);
  }

  function setHints(on) {
    showHints = on; savePref('chess-hints', on ? '1' : '0');
    const btn = root.querySelector('#ch-hint-btn'); if (btn) btn.classList.toggle('on', on);
    draw2D();
  }

  function startGame() {
    game = new Chess();
    selected = null; legalDests = []; lastMove = null; busy = false; animMove = null;
    startClock();
    renderGame();
    if (mode === 'ai' && game.turn() !== humanColor) aiTurn();
  }

  /* ── render shell ───────────────────────────────────────────────── */
  function applyThemeVars() {
    const wrap = root.querySelector('.ch-wrap'); if (!wrap) return;
    const t = theme();
    wrap.style.setProperty('--sql', t.light); wrap.style.setProperty('--sqd', t.dark);
    wrap.style.setProperty('--frm', t.frame);
    wrap.style.setProperty('--pcl', t.pcLight); wrap.style.setProperty('--pcd', t.pcDark);
  }

  function renderGame() {
    root.innerHTML = `
      <div class="ch-wrap">
        <div class="ch-status" id="ch-status"></div>
        <div class="ch-bar">
          <div class="ch-clock" id="ch-clk-w"><span class="pip w"></span><span class="t">0:00</span></div>
          <div class="ch-moves"><span>Jogadas</span><b id="ch-moveno">0</b></div>
          <div class="ch-clock" id="ch-clk-b"><span class="pip b"></span><span class="t">0:00</span></div>
        </div>
        <div class="ch-tray top" id="ch-tray-top"></div>
        <div class="ch-board" id="ch-board" role="grid" aria-label="Tabuleiro de xadrez"></div>
        <div class="ch-tray bot" id="ch-tray-bot"></div>
        <div class="ch-ctrls">
          <button class="ch-btn${showHints ? ' on' : ''}" id="ch-hint-btn">💡 Dicas</button>
          <button class="ch-btn" id="ch-theme-btn">🎨 Tema</button>
          <button class="ch-btn" id="ch-undo">↩ Desfazer</button>
          <button class="ch-btn" id="ch-new">🔄 Novo</button>
          <button class="ch-btn" id="ch-menu">☰ Menu</button>
        </div>
      </div>`;
    applyThemeVars();
    root.querySelector('#ch-hint-btn').addEventListener('click', () => setHints(!showHints));
    root.querySelector('#ch-theme-btn').addEventListener('click', openThemePicker);
    root.querySelector('#ch-undo').addEventListener('click', undo);
    root.querySelector('#ch-new').addEventListener('click', startGame);
    root.querySelector('#ch-menu').addEventListener('click', showMenu);
    draw2D();
    updateStatus();
    renderTrays();
    updateClock();
  }

  /* ── theme picker ───────────────────────────────────────────────── */
  function themeSwatch(t) {
    return `<span class="ch-sw"><i style="background:${t.light}"></i><i style="background:${t.dark}"></i><i style="background:${t.dark}"></i><i style="background:${t.light}"></i></span>`;
  }
  function setTheme(k) {
    if (!THEMES[k]) return;
    themeKey = k; savePref('chess-theme', themeKey);
    applyThemeVars(); draw2D(); renderTrays();
  }
  function openThemePicker() {
    const back = document.createElement('div');
    back.className = 'ch-back';
    const groups = { light: '☀️ Claros', dark: '🌙 Escuros' };
    let html = '<div class="ch-pop"><div class="ch-pop-title">🎨 Tema do tabuleiro</div>';
    ['light', 'dark'].forEach(gr => {
      html += `<div class="ch-pop-grp">${groups[gr]}</div><div class="ch-themes">`
        + Object.keys(THEMES).filter(k => THEMES[k].group === gr).map(k =>
          `<div class="ch-theme${themeKey === k ? ' active' : ''}" data-t="${k}" role="button" aria-label="${THEMES[k].name}">
             ${themeSwatch(THEMES[k])}<span class="ch-theme-lbl">${THEMES[k].emoji} ${THEMES[k].name}</span>
           </div>`).join('') + '</div>';
    });
    html += '</div>';
    back.innerHTML = html;
    document.body.appendChild(back);
    back.querySelectorAll('.ch-theme').forEach(el => el.addEventListener('click', () => { setTheme(el.dataset.t); back.remove(); }));
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
  }

  /* ── clocks + move counter ──────────────────────────────────────── */
  function startClock() { clock = { w: 0, b: 0 }; lastTick = performance.now(); stopClock(); clockTimer = setInterval(tick, 250); }
  function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }
  function accrue() {
    if (!game) return;
    const now = performance.now();
    let dt = (now - lastTick) / 1000; lastTick = now;
    if (dt > 5) dt = 5;                      /* tab was backgrounded — don't dump a huge chunk */
    if (!game.game_over()) clock[game.turn()] += dt;
  }
  function tick() { if (!game || game.game_over()) { stopClock(); return; } accrue(); updateClock(); }
  function fmt(sec) { sec = Math.floor(sec); const m = Math.floor(sec / 60); return m + ':' + String(sec % 60).padStart(2, '0'); }
  function updateClock() {
    if (!game) return;
    const cw = root.querySelector('#ch-clk-w'), cb = root.querySelector('#ch-clk-b'), mv = root.querySelector('#ch-moveno');
    const over = game.game_over(), turn = game.turn();
    if (cw) { cw.querySelector('.t').textContent = fmt(clock.w); cw.classList.toggle('active', !over && turn === 'w'); }
    if (cb) { cb.querySelector('.t').textContent = fmt(clock.b); cb.classList.toggle('active', !over && turn === 'b'); }
    if (mv) mv.textContent = game.history().length;
  }

  /* ── captured trays ─────────────────────────────────────────────── */
  function capturedState() {
    const cap = { w: [], b: [] };
    if (game) game.history({ verbose: true }).forEach(m => { if (m.captured) cap[m.color].push(m.captured); });
    return cap;
  }
  function renderTrays() {
    const top = root.querySelector('#ch-tray-top'), bot = root.querySelector('#ch-tray-bot');
    if (!top || !bot) return;
    const cap = capturedState();
    const sortV = a => a.slice().sort((x, y) => VAL[y] - VAL[x]);
    const sumV = a => a.reduce((s, t) => s + VAL[t], 0);
    const bottomColor = (mode === 'ai') ? humanColor : 'w';
    const topColor = bottomColor === 'w' ? 'b' : 'w';
    const whiteLead = sumV(cap.w) - sumV(cap.b);
    const lead = { w: whiteLead, b: -whiteLead };
    const trayHTML = (capturer) => {
      const victims = sortV(cap[capturer]);
      const vColor = capturer === 'w' ? 'b' : 'w';
      const pts = lead[capturer];
      return victims.map(t => `<span class="ch-cap">${pieceSVG(t, vColor)}</span>`).join('')
        + (pts > 0 ? `<span class="ch-adv">+${Math.round(pts / 100)}</span>` : '');
    };
    top.innerHTML = trayHTML(topColor);
    bot.innerHTML = trayHTML(bottomColor);
  }

  /* ── 2D renderer ────────────────────────────────────────────────── */
  function pieceSVG(type, color) {
    return `<svg class="ch-pc ch-pc-${color}" viewBox="0 0 100 100" aria-hidden="true">
      <text x="50" y="82" text-anchor="middle" font-size="92">${GLYPH[type]}</text></svg>`;
  }

  function draw2D() {
    const bd = root.querySelector('#ch-board'); if (!bd) return;
    const flip = (mode === 'ai' && humanColor === 'b');
    const files = ['a','b','c','d','e','f','g','h'];
    const board = game.board();
    let checkSq = null;
    if (game.in_check()) {
      const turn = game.turn();
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const pc = board[r][c]; if (pc && pc.type === 'k' && pc.color === turn) checkSq = files[c] + (8 - r);
      }
    }
    const rowOrder = flip ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
    const colOrder = flip ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
    let html = '';
    rowOrder.forEach(r => {
      colOrder.forEach(c => {
        const sq = files[c] + (8 - r);
        const pc = board[r][c];
        const dark = (r + c) % 2 === 1;
        const cls = ['ch-sq', dark ? 'ch-dark' : 'ch-light'];
        if (selected === sq) cls.push('sel');
        if (lastMove && (lastMove.from === sq || lastMove.to === sq)) cls.push('last');
        if (checkSq === sq) cls.push('check');
        if (showHints && legalDests.includes(sq)) { cls.push('ch-dest'); if (pc) cls.push('cap'); }
        const label = sq + (pc ? ', ' + (pc.color === 'w' ? 'branca' : 'preta') + ' ' + pieceName(pc.type) : ' vazio');
        const showFile = (flip ? r === 0 : r === 7);
        const showRank = (flip ? c === 7 : c === 0);
        html += `<button class="${cls.join(' ')}" data-sq="${sq}" role="gridcell" aria-label="${label}">
          ${pc ? pieceSVG(pc.type, pc.color) : ''}
          ${showFile ? `<span class="ch-coord f">${files[c]}</span>` : ''}
          ${showRank ? `<span class="ch-coord r">${8 - r}</span>` : ''}
        </button>`;
      });
    });
    bd.innerHTML = html;
    bd.querySelectorAll('.ch-sq').forEach(el => el.addEventListener('click', () => onSquare(el.dataset.sq)));

    /* slide the moved piece from its origin (FLIP) */
    if (animMove) {
      const a = animMove; animMove = null;
      const fromEl = bd.querySelector(`.ch-sq[data-sq="${a.from}"]`);
      const toEl = bd.querySelector(`.ch-sq[data-sq="${a.to}"]`);
      const pcEl = toEl && toEl.querySelector('.ch-pc');
      if (fromEl && toEl && pcEl && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches)) {
        const fr = fromEl.getBoundingClientRect(), tr = toEl.getBoundingClientRect();
        const dx = fr.left - tr.left, dy = fr.top - tr.top;
        pcEl.style.transform = `translate(${dx}px,${dy}px)`;
        pcEl.getBoundingClientRect();                 /* force reflow */
        requestAnimationFrame(() => {
          pcEl.style.transition = 'transform .24s cubic-bezier(.22,.68,.32,1)';
          pcEl.style.transform = 'translate(0,0)';
        });
      }
    }
  }

  function pieceName(t) { return ({ p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' })[t] || t; }

  function updateStatus() {
    const el = root.querySelector('#ch-status'); if (!el) return;
    const undoBtn = root.querySelector('#ch-undo');
    if (undoBtn) undoBtn.disabled = busy || game.history().length === 0;
    if (game.game_over()) {
      stopClock();
      let msg;
      if (game.in_checkmate()) { const winner = game.turn() === 'w' ? 'Pretas' : 'Brancas'; msg = `♚ Xeque-mate — ${winner} ganham!`; }
      else if (game.in_stalemate()) msg = '🤝 Empate (afogamento)';
      else if (game.in_threefold_repetition()) msg = '🤝 Empate (repetição)';
      else if (game.insufficient_material()) msg = '🤝 Empate (material insuficiente)';
      else msg = '🤝 Empate';
      el.innerHTML = `<span>${msg}</span>`;
      return;
    }
    const turn = game.turn();
    let who;
    if (mode === '2p') who = turn === 'w' ? 'Vez das Brancas' : 'Vez das Pretas';
    else who = busy ? 'IA a pensar…' : (turn === humanColor ? 'A tua vez' : 'IA a pensar…');
    const check = game.in_check() ? ' · Xeque!' : '';
    el.innerHTML = `<span class="ch-turn-dot ch-turn-${turn}"></span><span>${who}${check}</span>`;
  }

  /* ── interaction ────────────────────────────────────────────────── */
  function onSquare(sq) {
    if (busy || game.game_over()) return;
    const turn = game.turn();
    if (mode === 'ai' && turn !== humanColor) return;
    const pc = game.get(sq);
    if (selected) {
      if (legalDests.includes(sq)) { tryMove(selected, sq); return; }
      if (pc && pc.color === turn) { selectSquare(sq); return; }
      selected = null; legalDests = []; draw2D(); return;
    }
    if (pc && pc.color === turn) selectSquare(sq);
  }
  function selectSquare(sq) {
    selected = sq;
    legalDests = game.moves({ square: sq, verbose: true }).map(m => m.to);
    draw2D();
  }
  function tryMove(from, to) {
    const isPromo = game.moves({ square: from, verbose: true }).some(m => m.to === to && m.flags.includes('p'));
    if (isPromo) { promptPromotion(from, to); return; }
    applyMove({ from, to });
  }
  function applyMove(mv) {
    accrue();                                          /* bank the mover's think time */
    const res = game.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
    if (!res) { selected = null; legalDests = []; draw2D(); return; }
    lastMove = { from: res.from, to: res.to };
    selected = null; legalDests = [];
    commitMove(res);
  }
  function commitMove(res) {
    animMove = { from: res.from, to: res.to };
    draw2D(); updateStatus(); renderTrays(); updateClock();
    if (game.game_over()) { finish(); return; }
    if (mode === 'ai' && game.turn() !== humanColor) aiTurn();
  }

  function promptPromotion(from, to) {
    const color = game.turn();
    const back = document.createElement('div');
    back.className = 'ch-back';
    back.innerHTML = `<div class="ch-promo" role="dialog" aria-label="Escolhe a promoção">
      ${['q','r','b','n'].map(t => `<button data-t="${t}" aria-label="${pieceName(t)}">${pieceSVG(t, color)}</button>`).join('')}
    </div>`;
    applyThemeVarsTo(back);
    document.body.appendChild(back);
    back.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { back.remove(); applyMove({ from, to, promotion: b.dataset.t }); }));
    back.addEventListener('click', e => { if (e.target === back) { back.remove(); selected = null; legalDests = []; draw2D(); } });
  }
  function applyThemeVarsTo(node) {
    const t = theme();
    node.style.setProperty('--sql', t.light); node.style.setProperty('--sqd', t.dark);
    node.style.setProperty('--pcl', t.pcLight); node.style.setProperty('--pcd', t.pcDark);
  }

  function aiTurn() {
    busy = true; updateStatus();
    setTimeout(() => {
      const mv = chooseAIMove();
      busy = false;
      if (!mv) { updateStatus(); return; }
      accrue();                                        /* bank the AI's think time */
      const res = game.move(mv);
      lastMove = { from: res.from, to: res.to };
      selected = null; legalDests = [];
      commitMove(res);
    }, 240);
  }

  function undo() {
    if (busy || !game.history().length) return;
    game.undo();
    if (mode === 'ai' && game.history().length && game.turn() !== humanColor) game.undo();
    selected = null; legalDests = []; animMove = null;
    const h = game.history({ verbose: true });
    lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
    if (game.game_over() === false && !clockTimer) { lastTick = performance.now(); clockTimer = setInterval(tick, 250); }
    draw2D(); updateStatus(); renderTrays(); updateClock();
  }

  function finish() {
    stopClock();
    if (typeof GameProgress === 'undefined') return;
    let won = null;
    if (mode === 'ai' && game.in_checkmate()) won = (game.turn() !== humanColor);
    else if (mode === 'ai') won = false;
    try {
      GameProgress.record('chess', {
        won: mode === 'ai' ? won : undefined,
        mode: mode === 'ai' ? diffKey : '2p',
        meta: { checkmate: game.in_checkmate(), draw: game.in_draw(), moves: game.history().length },
      });
    } catch (e) {}
  }

  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('chess', [
      { id: 'ch.win',  name: 'Xeque-mate!',   icon: '♟️', desc: 'Ganha uma partida contra a IA.', test: c => c.gameId === 'chess' && c.result.won === true },
      { id: 'ch.hard', name: 'Grande Mestre', icon: '👑', desc: 'Ganha a IA no nível Difícil.',    test: c => c.gameId === 'chess' && c.result.won === true && c.result.mode === 'hard' },
    ]);
  }

  return { init };
})();
