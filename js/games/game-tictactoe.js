const TicTacToeGame = (function () {
  'use strict';

  const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  /* UI strings + AI difficulty live in games/tictactoe/{i18n,config}.json,
     loaded at runtime; these are the offline fallback. */
  const FB_I18N = {
    pt: { youX:'Tu (X)', aiO:'IA (O)', draws:'Empates', yourTurn:'A tua vez (X)', newGame:'🔄 Novo Jogo', youWon:'🎉 Ganhaste!', aiWon:'🤖 A IA ganhou!', drawMsg:'🤝 Empate!', aiThinking:'IA a pensar…' },
    en: { youX:'You (X)', aiO:'AI (O)', draws:'Draws', yourTurn:'Your turn (X)', newGame:'🔄 New Game', youWon:'🎉 You won!', aiWon:'🤖 The AI won!', drawMsg:'🤝 Draw!', aiThinking:'AI thinking…' },
  };
  const FB_RAND = { easy: 0.8, medium: 0.35, hard: 0 };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  let _rand = FB_RAND;

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
    const empty = board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (!empty.length) return -1;
    /* Difficulty: sometimes play a random move instead of the optimal one. */
    const diff = _has ? GameData.difficulty() : 'medium';
    if (Math.random() < (_rand[diff] != null ? _rand[diff] : 0)) {
      return empty[Math.floor(Math.random() * empty.length)];
    }
    let best = -Infinity, move = empty[0];
    empty.forEach(i => {
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
            <div class="ttt-score">${t('youX')}: <strong id="ttt-sx">${score.X}</strong></div>
            <div class="ttt-score">${t('aiO')}: <strong id="ttt-so">${score.O}</strong></div>
            <div class="ttt-score">${t('draws')}: <strong id="ttt-sd">${score.D}</strong></div>
          </div>
          <div class="ttt-status" id="ttt-status">${t('yourTurn')}</div>
          <div class="ttt-grid" id="ttt-grid">
            ${Array(9).fill(0).map((_,i)=>`<button class="ttt-cell" data-i="${i}"></button>`).join('')}
          </div>
          <button class="hf-new-btn" id="ttt-new">${t('newGame')}</button>
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
      root.querySelector('#ttt-status').textContent = t('yourTurn');
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
        root.querySelector('#ttt-status').textContent = turn === 'X' ? t('youWon') : t('aiWon');
        gameOver = true;
        return;
      }
      if (board.every(Boolean)) {
        score.D++;
        updateScore();
        root.querySelector('#ttt-status').textContent = t('drawMsg');
        gameOver = true;
        return;
      }
      turn = turn === 'X' ? 'O' : 'X';
      if (turn === 'O') {
        root.querySelector('#ttt-status').textContent = t('aiThinking');
        setTimeout(() => { play(aiMove(board)); }, 350);
      } else {
        root.querySelector('#ttt-status').textContent = t('yourTurn');
      }
    }

    function updateScore() {
      root.querySelector('#ttt-sx').textContent = score.X;
      root.querySelector('#ttt-so').textContent = score.O;
      root.querySelector('#ttt-sd').textContent = score.D;
    }

    render();
    startGame();

    /* Load external strings + difficulty config, then re-render. */
    if (_has) {
      const apply = () => {
        GameData.load('tictactoe').then(d => {
          if (t.use) t.use(d.i18n);
          if (d.config && d.config.randomChance) _rand = d.config.randomChance;
          render(); startGame();
        });
      };
      apply();
      document.addEventListener('langchange', apply);
    }
  }

  return { init };
})();
