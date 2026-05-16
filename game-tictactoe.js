const TicTacToeGame = (function () {
  'use strict';

  const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  function checkWin(b, p) { return WINS.some(([a,b_,c]) => b[a]===p && b[b_]===p && b[c]===p); }

  function minimax(board, isMax, depth) {
    if (checkWin(board, 'O')) return 10 - depth;
    if (checkWin(board, 'X')) return depth - 10;
    if (board.every(Boolean)) return 0;
    let best = isMax ? -Infinity : Infinity;
    board.forEach((v, i) => {
      if (v) return;
      board[i] = isMax ? 'O' : 'X';
      const score = minimax(board, !isMax, depth + 1);
      board[i] = null;
      best = isMax ? Math.max(best, score) : Math.min(best, score);
    });
    return best;
  }

  function aiMove(board) {
    let best = -Infinity, move = -1;
    board.forEach((v, i) => {
      if (v) return;
      board[i] = 'O';
      const score = minimax(board, false, 0);
      board[i] = null;
      if (score > best) { best = score; move = i; }
    });
    return move;
  }

  function init(root) {
    if (!root) return;

    let board, turn, gameOver, score = {X:0, O:0, D:0};

    function render() {
      root.innerHTML = `
        <div class="game-card" style="max-width:380px;margin:0 auto">
          <div class="ttt-hdr">
            <div class="ttt-score">Tu (X): <strong id="ttt-sx">${score.X}</strong></div>
            <div class="ttt-score">IA (O): <strong id="ttt-so">${score.O}</strong></div>
            <div class="ttt-score">Empates: <strong id="ttt-sd">${score.D}</strong></div>
          </div>
          <div class="ttt-status" id="ttt-status">A tua vez (X)</div>
          <div class="ttt-grid" id="ttt-grid">
            ${Array(9).fill(0).map((_,i)=>`<button class="ttt-cell" data-i="${i}"></button>`).join('')}
          </div>
          <button class="hf-new-btn" id="ttt-new">🔄 Novo Jogo</button>
        </div>`;

      root.querySelector('#ttt-new').addEventListener('click', startGame);
      root.querySelector('#ttt-grid').addEventListener('click', e => {
        const cell = e.target.closest('.ttt-cell');
        if (!cell || gameOver || turn !== 'X' || board[+cell.dataset.i]) return;
        play(+cell.dataset.i);
      });
    }

    function startGame() {
      board = Array(9).fill(null);
      turn = 'X'; gameOver = false;
      updateBoard();
      root.querySelector('#ttt-status').textContent = 'A tua vez (X)';
    }

    function updateBoard() {
      root.querySelectorAll('.ttt-cell').forEach((cell, i) => {
        cell.textContent = board[i] || '';
        cell.className = 'ttt-cell' + (board[i] === 'X' ? ' ttt-x' : board[i] === 'O' ? ' ttt-o' : '');
      });
    }

    function play(i) {
      if (board[i] || gameOver) return;
      board[i] = turn;
      updateBoard();
      if (checkWin(board, turn)) {
        score[turn]++;
        updateScore();
        root.querySelector('#ttt-status').textContent = turn === 'X' ? '🎉 Ganhaste!' : '🤖 A IA ganhou!';
        gameOver = true;
        return;
      }
      if (board.every(Boolean)) {
        score.D++;
        updateScore();
        root.querySelector('#ttt-status').textContent = '🤝 Empate!';
        gameOver = true;
        return;
      }
      turn = turn === 'X' ? 'O' : 'X';
      if (turn === 'O') {
        root.querySelector('#ttt-status').textContent = 'IA a pensar…';
        setTimeout(() => { play(aiMove(board)); }, 350);
      } else {
        root.querySelector('#ttt-status').textContent = 'A tua vez (X)';
      }
    }

    function updateScore() {
      root.querySelector('#ttt-sx').textContent = score.X;
      root.querySelector('#ttt-so').textContent = score.O;
      root.querySelector('#ttt-sd').textContent = score.D;
    }

    render();
    startGame();
  }

  return { init };
})();
