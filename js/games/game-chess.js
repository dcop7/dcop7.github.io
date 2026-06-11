/* ══════════════════════════════════════════════════════════════════
   ChessGame — full browser chess, no backend.
   Rules/move-generation: vendored chess.js (global `Chess`, BSD).
   AI: own negamax + alpha-beta with material + piece-square tables.
   Tap-to-select / tap-to-move board (mobile-first), promotion picker,
   undo, 3 AI levels + local 2-player. Integrates GameProgress.
══════════════════════════════════════════════════════════════════ */
const ChessGame = (function () {
  'use strict';

  const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
  const VAL   = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE  = 1000000;

  /* Piece-square tables, written a8 (top-left) … h1, i.e. board() order for
     White; mirrored vertically for Black. Classic mid-game values. */
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

  let root, game, mode = 'ai', diffKey = 'medium', humanColor = 'w';
  let selected = null, legalDests = [], lastMove = null, busy = false, pendingPromo = null;

  /* ── evaluation ─────────────────────────────────────────────────── */
  function evaluate(g) {
    /* score from the side-to-move's perspective */
    const board = g.board();
    let white = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const pc = board[row][col];
        if (!pc) continue;
        const idx = row * 8 + col;
        const base = VAL[pc.type] + PST[pc.type][pc.color === 'w' ? idx : (7 - row) * 8 + col];
        white += pc.color === 'w' ? base : -base;
      }
    }
    return g.turn() === 'w' ? white : -white;
  }

  function orderMoves(moves) {
    /* captures first (most-valuable-victim), then the rest — speeds alpha-beta */
    return moves.sort((a, b) => {
      const av = (a.captured ? VAL[a.captured] : 0) + (a.promotion ? 800 : 0);
      const bv = (b.captured ? VAL[b.captured] : 0) + (b.promotion ? 800 : 0);
      return bv - av;
    });
  }

  function negamax(g, depth, alpha, beta, ply) {
    if (g.in_checkmate()) return -MATE + ply;       /* side to move is mated */
    if (g.in_draw() || g.in_stalemate() || g.in_threefold_repetition() || g.insufficient_material()) return 0;
    if (depth === 0) return evaluate(g);
    let best = -Infinity;
    const moves = orderMoves(g.moves({ verbose: true }));
    for (const m of moves) {
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
    /* Easy occasionally just blunders with a random legal move. */
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
.ch-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0}
.ch-menu{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 16px;text-align:center}
.ch-logo{font-size:3rem;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}
.ch-title{font-family:var(--font-head,inherit);font-size:1.7rem;font-weight:900;color:var(--text,#fff)}
.ch-sub{font-size:.8rem;color:var(--muted,#9aa);letter-spacing:.08em;text-transform:uppercase}
.ch-opts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:340px}
.ch-opt{background:var(--card2,#1b1d33);border:1.5px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:10px;padding:9px 16px;font:inherit;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-opt:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5)}
.ch-opt.active{background:var(--accent-soft,rgba(124,92,255,.16));border-color:rgba(var(--accent-rgb,124,92,255),.7);color:var(--accent,#a98bff)}
.ch-play{background:linear-gradient(135deg,var(--accent,#7c5cff),#a855f7);color:#fff;border:none;border-radius:12px;padding:13px 44px;font:inherit;font-size:1.05rem;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(124,92,255,.35);transition:transform .15s}
.ch-play:hover{transform:scale(1.04)}

.ch-status{display:flex;align-items:center;gap:8px;font-size:.9rem;font-weight:700;color:var(--text,#fff);min-height:24px;text-align:center}
.ch-turn-dot{width:13px;height:13px;border-radius:50%;border:1.5px solid #888}
.ch-turn-w{background:#f1f1f1}.ch-turn-b{background:#222}
.ch-board{width:min(94vw,460px);aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);border-radius:8px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.45);touch-action:manipulation;border:2px solid #20222e}
.ch-sq{position:relative;display:flex;align-items:center;justify-content:center;border:none;padding:0;cursor:pointer;font-size:clamp(22px,7.5vw,40px);line-height:1;user-select:none;-webkit-tap-highlight-color:transparent}
.ch-light{background:#e8edf4}.ch-dark{background:#7b91b0}
.ch-pc{position:relative;z-index:2;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
.ch-w{color:#fff;text-shadow:0 0 1px #000,0 1px 2px rgba(0,0,0,.5)}
.ch-b{color:#1a1a1a}
.ch-sq.sel{box-shadow:inset 0 0 0 4px rgba(245,200,66,.9)}
.ch-sq.last::before{content:'';position:absolute;inset:0;background:rgba(245,200,66,.32);z-index:1}
.ch-sq.check::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(239,68,68,.7),transparent 70%);z-index:1}
.ch-dest::after{content:'';position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(40,40,40,.32);z-index:1}
.ch-dest.cap::after{width:84%;height:84%;background:transparent;border:4px solid rgba(40,40,40,.32);box-sizing:border-box}
.ch-coord{position:absolute;font-size:9px;font-weight:700;opacity:.6;z-index:1}
.ch-coord.f{right:2px;bottom:1px}.ch-coord.r{left:2px;top:1px}
.ch-light .ch-coord{color:#5a6b86}.ch-dark .ch-coord{color:#e8edf4}

.ch-ctrls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.ch-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:9px;padding:8px 16px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5);color:var(--accent,#a98bff)}
.ch-btn:disabled{opacity:.4;cursor:default}

.ch-promo-back{position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
.ch-promo{background:var(--card,#14162a);border:1px solid var(--border,#2a2c44);border-radius:16px;padding:18px;display:flex;gap:10px}
.ch-promo button{font-size:2.6rem;background:#e8edf4;border:2px solid transparent;border-radius:10px;width:64px;height:64px;cursor:pointer;color:#1a1a1a;transition:all .12s}
.ch-promo button:hover{border-color:var(--accent,#7c5cff);transform:scale(1.06)}
@media (prefers-reduced-motion:reduce){.ch-play,.ch-promo button{transition:none}}`;
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
    const opp = [
      { k: 'ai-easy',   t: '🟢 IA Fácil' }, { k: 'ai-medium', t: '🟡 IA Médio' },
      { k: 'ai-hard',   t: '🔴 IA Difícil' }, { k: '2p',       t: '👥 2 Jogadores' },
    ];
    const cur = mode === '2p' ? '2p' : 'ai-' + diffKey;
    root.innerHTML = `
      <div class="ch-menu">
        <div class="ch-logo">♟️</div>
        <div class="ch-title">Xadrez</div>
        <div class="ch-sub">Escolhe o adversário</div>
        <div class="ch-opts" id="ch-opp">
          ${opp.map(o => `<button class="ch-opt${o.k === cur ? ' active' : ''}" data-k="${o.k}">${o.t}</button>`).join('')}
        </div>
        <div class="ch-sub" style="margin-top:6px">Jogas com</div>
        <div class="ch-opts" id="ch-color">
          <button class="ch-opt${humanColor === 'w' ? ' active' : ''}" data-c="w">⚪ Brancas</button>
          <button class="ch-opt${humanColor === 'b' ? ' active' : ''}" data-c="b">⚫ Pretas</button>
          <button class="ch-opt" data-c="rand">🎲 Aleatório</button>
        </div>
        <button class="ch-play" id="ch-play">▶ Jogar</button>
      </div>`;

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

  function startGame() {
    game = new Chess();
    selected = null; legalDests = []; lastMove = null; busy = false; pendingPromo = null;
    renderGame();
    /* If the human is Black against the AI, let White (AI) open. */
    if (mode === 'ai' && humanColor === 'b') aiTurn();
  }

  /* ── render ─────────────────────────────────────────────────────── */
  function renderGame() {
    root.innerHTML = `
      <div class="ch-wrap">
        <div class="ch-status" id="ch-status"></div>
        <div class="ch-board" id="ch-board" role="grid" aria-label="Tabuleiro de xadrez"></div>
        <div class="ch-ctrls">
          <button class="ch-btn" id="ch-undo">↩ Desfazer</button>
          <button class="ch-btn" id="ch-new">🔄 Novo</button>
          <button class="ch-btn" id="ch-menu">☰ Menu</button>
        </div>
      </div>`;
    root.querySelector('#ch-new').addEventListener('click', startGame);
    root.querySelector('#ch-menu').addEventListener('click', showMenu);
    root.querySelector('#ch-undo').addEventListener('click', undo);
    drawBoard();
    updateStatus();
  }

  function drawBoard() {
    const bd = root.querySelector('#ch-board');
    if (!bd) return;
    const flip = (mode === 'ai' && humanColor === 'b');
    const files = ['a','b','c','d','e','f','g','h'];
    const ranks = [8,7,6,5,4,3,2,1];
    const board = game.board();
    let kingInCheckSq = null;
    if (game.in_check()) {
      const turn = game.turn();
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const pc = board[r][c]; if (pc && pc.type === 'k' && pc.color === turn) kingInCheckSq = files[c] + (8 - r);
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
        if (kingInCheckSq === sq) cls.push('check');
        const isDest = legalDests.includes(sq);
        if (isDest) { cls.push('ch-dest'); if (pc) cls.push('cap'); }
        const label = sq + (pc ? ', ' + (pc.color === 'w' ? 'branca' : 'preta') + ' ' + pieceName(pc.type) : ' vazio');
        const showFile = (flip ? r === 0 : r === 7);
        const showRank = (flip ? c === 7 : c === 0);
        html += `<button class="${cls.join(' ')}" data-sq="${sq}" role="gridcell" aria-label="${label}">
          ${pc ? `<span class="ch-pc ch-${pc.color}">${GLYPH[pc.type]}</span>` : ''}
          ${showFile ? `<span class="ch-coord f">${files[c]}</span>` : ''}
          ${showRank ? `<span class="ch-coord r">${8 - r}</span>` : ''}
        </button>`;
      });
    });
    bd.innerHTML = html;
    bd.querySelectorAll('.ch-sq').forEach(el => el.addEventListener('click', () => onSquare(el.dataset.sq)));
  }

  function pieceName(t) { return ({ p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' })[t] || t; }

  function updateStatus() {
    const el = root.querySelector('#ch-status'); if (!el) return;
    const undoBtn = root.querySelector('#ch-undo');
    if (undoBtn) undoBtn.disabled = busy || game.history().length === 0;
    if (game.game_over()) {
      let msg;
      if (game.in_checkmate()) {
        const winner = game.turn() === 'w' ? 'Pretas' : 'Brancas';
        msg = `♚ Xeque-mate — ${winner} ganham!`;
      } else if (game.in_stalemate()) msg = '🤝 Empate (afogamento)';
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
      selected = null; legalDests = []; drawBoard(); return;
    }
    if (pc && pc.color === turn) selectSquare(sq);
  }

  function selectSquare(sq) {
    selected = sq;
    legalDests = game.moves({ square: sq, verbose: true }).map(m => m.to);
    drawBoard();
  }

  function tryMove(from, to) {
    /* promotion? */
    const isPromo = game.moves({ square: from, verbose: true }).some(m => m.to === to && m.flags.includes('p'));
    if (isPromo) { promptPromotion(from, to); return; }
    applyMove({ from, to });
  }

  function applyMove(mv) {
    const res = game.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
    if (!res) { selected = null; legalDests = []; drawBoard(); return; }
    lastMove = { from: res.from, to: res.to };
    selected = null; legalDests = [];
    drawBoard(); updateStatus();
    if (game.game_over()) { finish(); return; }
    if (mode === 'ai' && game.turn() !== humanColor) aiTurn();
  }

  function promptPromotion(from, to) {
    const color = game.turn();
    const back = document.createElement('div');
    back.className = 'ch-promo-back';
    back.innerHTML = `<div class="ch-promo" role="dialog" aria-label="Escolhe a promoção">
      ${['q','r','b','n'].map(t => `<button data-t="${t}" aria-label="${pieceName(t)}"><span class="ch-${color}">${GLYPH[t]}</span></button>`).join('')}
    </div>`;
    document.body.appendChild(back);
    back.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      back.remove(); applyMove({ from, to, promotion: b.dataset.t });
    }));
    back.addEventListener('click', e => { if (e.target === back) { back.remove(); selected = null; legalDests = []; drawBoard(); } });
  }

  function aiTurn() {
    busy = true; updateStatus();
    /* defer so the board paints + "thinking" shows before the (sync) search */
    setTimeout(() => {
      const mv = chooseAIMove();
      busy = false;
      if (!mv) { updateStatus(); return; }
      const res = game.move(mv);
      lastMove = { from: res.from, to: res.to };
      selected = null; legalDests = [];
      drawBoard(); updateStatus();
      if (game.game_over()) finish();
    }, 220);
  }

  function undo() {
    if (busy || !game.history().length) return;
    game.undo();                                   /* undo last move */
    if (mode === 'ai' && game.history().length && game.turn() !== humanColor) game.undo();  /* and the AI's, so it's the human's turn */
    selected = null; legalDests = [];
    const h = game.history({ verbose: true });
    lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
    drawBoard(); updateStatus();
  }

  function finish() {
    if (typeof GameProgress === 'undefined') return;
    let won = null;
    if (mode === 'ai' && game.in_checkmate()) won = (game.turn() !== humanColor); /* side to move is mated */
    else if (mode === 'ai') won = false; /* draw counts as a non-win for stats */
    try {
      GameProgress.record('chess', {
        won: mode === 'ai' ? won : undefined,
        mode: mode === 'ai' ? diffKey : '2p',
        meta: { checkmate: game.in_checkmate(), draw: game.in_draw() },
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
