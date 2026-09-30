/* ══════════════════════════════════════════════════════════════════
   Xadrez — procura da IA num Web Worker (set/2026).
   A procura em chess.js demora até ~1,5 s no meio-jogo; no thread
   principal isso congelava a página (relógios, animações, cliques).
   Aqui corre à parte: recebe {fen, depth, blunder, id} e devolve
   {id, move:{from,to,promotion}}. A lógica é a mesma do fallback em
   game-chess.js (negamax + alpha-beta, material + tabelas de casas).
══════════════════════════════════════════════════════════════════ */
importScripts('vendor/chess.min.js');

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 1000000;
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
      5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
      5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
      -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
      -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
      -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
      -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
      -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
      -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};

function evaluate(g) {
  const board = g.board();
  let white = 0;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const pc = board[row][col]; if (!pc) continue;
    const base = VAL[pc.type] + PST[pc.type][pc.color === 'w' ? row * 8 + col : (7 - row) * 8 + col];
    white += pc.color === 'w' ? base : -base;
  }
  return g.turn() === 'w' ? white : -white;
}
/* capturas primeiro (vítima mais valiosa, atacante mais barato), depois promoções */
function orderMoves(moves) {
  const k = m => (m.captured ? VAL[m.captured] * 10 - VAL[m.piece] / 10 : 0) + (m.promotion ? 8000 : 0);
  return moves.sort((a, b) => k(b) - k(a));
}
/* uma só geração de lances por nó: sem lances = mate (em xeque) ou afogado */
function negamax(g, depth, alpha, beta, ply) {
  if (depth === 0) { if (g.in_check() && !g.moves().length) return -MATE + ply; return evaluate(g); }
  const moves = g.moves({ verbose: true });
  if (!moves.length) return g.in_check() ? -MATE + ply : 0;
  let best = -Infinity;
  for (const m of orderMoves(moves)) {
    g.move(m);
    const s = -negamax(g, depth - 1, -beta, -alpha, ply + 1);
    g.undo();
    if (s > best) best = s;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

onmessage = e => {
  const { id, fen, depth, blunder } = e.data;
  const g = new Chess(fen);
  const moves = g.moves({ verbose: true });
  let pick = null;
  if (moves.length) {
    if (blunder && Math.random() < blunder) pick = moves[Math.floor(Math.random() * moves.length)];
    else {
      let best = -Infinity, bestMoves = [];
      for (const m of orderMoves(moves)) {
        g.move(m);
        const s = -negamax(g, depth - 1, -Infinity, Infinity, 1);
        g.undo();
        if (s > best) { best = s; bestMoves = [m]; } else if (s === best) bestMoves.push(m);
      }
      pick = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }
  }
  postMessage({ id, move: pick ? { from: pick.from, to: pick.to, promotion: pick.promotion } : null });
};
