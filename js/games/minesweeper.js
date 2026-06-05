const MinesweeperGame = (function () {
  'use strict';

  /* Board sizes + UI strings live in games/minesweeper/{config,i18n}.json,
     loaded at runtime; these are the offline fallback. */
  const FB_I18N = {
    pt: { title:'💣 Campo de Minas', easy:'Fácil', medium:'Médio', hard:'Difícil', start:'▶ Iniciar', kaboom:'💥 Kaboom! Tenta novamente.', won:'🏆 Ganhou em {t}s!' },
    en: { title:'💣 Minesweeper', easy:'Easy', medium:'Medium', hard:'Hard', start:'▶ Start', kaboom:'💥 Kaboom! Try again.', won:'🏆 Solved in {t}s!' },
  };
  let DIFFS = {
    easy:   { rows: 9,  cols: 9,  mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard:   { rows: 16, cols: 30, mines: 99 },
  };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));

  let container, diff = 'easy', board = [], rows, cols, mines;
  let revealed = 0, flagged = 0, gameState = 'idle'; // idle|running|won|lost
  let timerEl, minesEl, gridEl, statusEl, startTime, timerInt;

  function init(cont) {
    container = cont;
    container.innerHTML = `
      <div class="hf-card ms-card">
        <div class="hf-top">
          <span class="hf-title">${t('title')}</span>
          <div class="ms-diff-btns">
            <button class="ms-db${diff==='easy'?' active':''}" data-d="easy">${t('easy')}</button>
            <button class="ms-db${diff==='medium'?' active':''}" data-d="medium">${t('medium')}</button>
            <button class="ms-db${diff==='hard'?' active':''}" data-d="hard">${t('hard')}</button>
          </div>
        </div>
        <div class="ms-hud">
          <span class="ms-stat">💣 <span id="ms-mines">10</span></span>
          <button class="ms-reset" id="ms-reset">${t('start')}</button>
          <span class="ms-stat">⏱ <span id="ms-timer">0</span>s</span>
        </div>
        <div class="ms-grid-wrap">
          <div class="ms-grid" id="ms-grid"></div>
        </div>
        <div class="ms-status" id="ms-status"></div>
      </div>`;

    timerEl  = container.querySelector('#ms-timer');
    minesEl  = container.querySelector('#ms-mines');
    gridEl   = container.querySelector('#ms-grid');
    statusEl = container.querySelector('#ms-status');

    container.querySelector('#ms-reset').addEventListener('click', startGame);
    container.querySelectorAll('.ms-db').forEach(b => {
      b.addEventListener('click', () => {
        container.querySelectorAll('.ms-db').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        diff = b.dataset.d;
        resetGame();
      });
    });

    resetGame();
  }

  function resetGame() {
    clearInterval(timerInt);
    const d = DIFFS[diff];
    rows = d.rows; cols = d.cols; mines = d.mines;
    gameState = 'idle';
    revealed = 0; flagged = 0;
    board = [];
    minesEl.textContent = mines;
    timerEl.textContent = '0';
    statusEl.textContent = '';
    buildGrid();
  }

  function buildGrid() {
    const wrap = container.querySelector('.ms-grid-wrap');
    const availW = (wrap ? wrap.clientWidth : container.clientWidth || 380) - 8;
    const availH = Math.min(window.innerHeight * 0.52, 440);
    const cellSize = Math.max(18, Math.min(32, Math.floor(availW / cols), Math.floor(availH / rows)));

    gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    gridEl.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      board[r] = [];
      for (let c = 0; c < cols; c++) {
        board[r][c] = { mine: false, revealed: false, flagged: false, adj: 0 };
        const cell = document.createElement('div');
        cell.className = 'ms-cell';
        cell.style.cssText = `width:${cellSize}px;height:${cellSize}px;font-size:${Math.max(9,Math.floor(cellSize*.58))}px`;
        cell.dataset.r = r; cell.dataset.c = c;
        cell.addEventListener('click', onLeft);
        cell.addEventListener('contextmenu', onRight);
        cell.addEventListener('touchend', onTouch, { passive: false });
        gridEl.appendChild(cell);
      }
    }
  }

  function startGame() {
    diff = container.querySelector('.ms-db.active').dataset.d;
    resetGame();
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (board[r][c].mine) continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      board[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine) continue;
        let n = 0;
        eachNeighbor(r, c, (nr, nc) => { if (board[nr][nc].mine) n++; });
        board[r][c].adj = n;
      }
    }
  }

  function eachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
    }
  }

  let longPressTimer = null;
  function onTouch(e) {
    e.preventDefault();
    const cell = e.currentTarget;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    if (e.type === 'touchend' && longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    handleLeft(r, c);
  }

  function onLeft(e) {
    const r = +e.currentTarget.dataset.r, c = +e.currentTarget.dataset.c;
    handleLeft(r, c);
  }

  function onRight(e) {
    e.preventDefault();
    const r = +e.currentTarget.dataset.r, c = +e.currentTarget.dataset.c;
    handleFlag(r, c);
  }

  function handleLeft(r, c) {
    if (gameState === 'won' || gameState === 'lost') return;
    const cell = board[r][c];
    if (cell.flagged || cell.revealed) return;

    if (gameState === 'idle') {
      gameState = 'running';
      placeMines(r, c);
      startTime = Date.now();
      timerInt = setInterval(() => {
        timerEl.textContent = Math.floor((Date.now() - startTime) / 1000);
      }, 500);
    }

    if (cell.mine) { explode(r, c); return; }
    reveal(r, c);
    checkWin();
  }

  function handleFlag(r, c) {
    if (gameState === 'idle' || gameState === 'won' || gameState === 'lost') return;
    const cell = board[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagged += cell.flagged ? 1 : -1;
    minesEl.textContent = mines - flagged;
    renderCell(r, c);
  }

  function reveal(r, c) {
    const cell = board[r][c];
    if (cell.revealed || cell.flagged || cell.mine) return;
    cell.revealed = true;
    revealed++;
    renderCell(r, c);
    if (cell.adj === 0) {
      eachNeighbor(r, c, (nr, nc) => reveal(nr, nc));
    }
  }

  function renderCell(r, c) {
    const cell = board[r][c];
    const el = gridEl.children[r * cols + c];
    const savedStyle = el.style.cssText;
    el.className = 'ms-cell';
    el.style.cssText = savedStyle;
    el.textContent = '';
    if (cell.flagged) { el.classList.add('ms-flag'); el.textContent = '🚩'; return; }
    if (!cell.revealed) return;
    el.classList.add('ms-revealed');
    if (cell.mine) { el.classList.add('ms-mine'); el.textContent = '💥'; return; }
    if (cell.adj > 0) {
      el.textContent = cell.adj;
      el.classList.add('ms-n' + cell.adj);
    }
  }

  function explode(hitR, hitC) {
    clearInterval(timerInt);
    gameState = 'lost';
    board[hitR][hitC].revealed = true;
    renderCell(hitR, hitC);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine && !board[r][c].flagged) {
          board[r][c].revealed = true;
          renderCell(r, c);
        }
      }
    }
    statusEl.textContent = t('kaboom');
    statusEl.style.color = '#f87171';
  }

  function checkWin() {
    const safe = rows * cols - mines;
    if (revealed === safe) {
      clearInterval(timerInt);
      gameState = 'won';
      const secs = Math.floor((Date.now() - startTime) / 1000);
      statusEl.textContent = t('won').replace('{t}', secs);
      statusEl.style.color = '#4ade80';
    }
  }

  function _apply() {
    return GameData.load('minesweeper').then(d => {
      if (t.use) t.use(d.i18n);                 /* re-resolves for the current language */
      if (d.config && d.config.diffs) DIFFS = d.config.diffs;
      if (container) init(container);
    });
  }
  if (_has) {
    _apply();
    document.addEventListener('langchange', _apply);
  }

  return { init };
})();
