const SnakeGame = (function () {
  'use strict';

  const COLS = 20, ROWS = 20;
  let _pane, canvas, ctx;
  let CELL;
  let snake, dir, nextDir, food, score, hiScore, loop, state;

  const C = {
    head: '#6366f1', body: '#818cf8',
    food: '#f43f5e', eye: '#fff',
    grid: 'rgba(255,255,255,0.03)',
  };

  let _touchStart = null;

  function init(pane) {
    _pane = pane;
    hiScore = parseInt(localStorage.getItem('snake-hi') || '0');
    render();
  }

  function render() {
    _pane.innerHTML = `
      <div class="snake-wrap" id="snake-root">
        <div class="snake-hdr">
          <span class="snake-title">🐍 Snake</span>
          <div class="snake-scores">
            <span class="snake-score-lbl">Score: <strong id="sn-score">0</strong></span>
            <span class="snake-score-lbl">Melhor: <strong id="sn-hi">${hiScore}</strong></span>
          </div>
        </div>
        <div style="position:relative">
          <canvas id="snake-canvas"></canvas>
          <div class="snake-msg" id="snake-msg">
            <div class="snake-msg-title">🐍 Snake</div>
            <div class="snake-msg-sub">Usa as setas ou WASD para jogar</div>
            <button class="snake-start-btn" id="sn-start">▶ Começar</button>
          </div>
        </div>
        <div class="snake-hint">
          <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para mover &nbsp;·&nbsp; <kbd>Space</kbd> para pausar
        </div>
      </div>`;

    canvas = _pane.querySelector('#snake-canvas');
    ctx    = canvas.getContext('2d');
    state  = 'idle';

    _resize();
    _pane.querySelector('#sn-start').addEventListener('click', _start);

    document.addEventListener('keydown', _onKey);
    canvas.addEventListener('touchstart', _onTouchStart, { passive: true });
    canvas.addEventListener('touchend',   _onTouchEnd,   { passive: true });

    _drawIdle();
  }

  function _resize() {
    const w   = Math.min((_pane.offsetWidth || 420) - 40, 400);
    CELL       = Math.floor(w / COLS);
    canvas.width  = CELL * COLS;
    canvas.height = CELL * ROWS;
  }

  function _start() {
    const msg = _pane.querySelector('#snake-msg');
    if (msg) msg.style.display = 'none';
    snake   = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    dir     = {x:1,y:0};
    nextDir = {x:1,y:0};
    score   = 0;
    state   = 'running';
    _updateScore();
    _placeFood();
    clearInterval(loop);
    loop = setInterval(_tick, 130);
  }

  function _tick() {
    dir = nextDir;
    const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { _die(); return; }
    if (snake.some(s => s.x === head.x && s.y === head.y))             { _die(); return; }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      _updateScore();
      _placeFood();
      if (score % 50 === 0) {
        clearInterval(loop);
        loop = setInterval(_tick, Math.max(55, 130 - Math.floor(score / 50) * 12));
      }
    } else {
      snake.pop();
    }
    _draw();
  }

  function _die() {
    clearInterval(loop);
    state = 'dead';
    const isHi = score > hiScore && score > 0;
    if (isHi) {
      hiScore = score;
      localStorage.setItem('snake-hi', hiScore);
      const hiEl = _pane.querySelector('#sn-hi');
      if (hiEl) hiEl.textContent = hiScore;
    }
    _draw();
    const msg = _pane.querySelector('#snake-msg');
    if (msg) {
      msg.style.display = '';
      msg.innerHTML = `
        <div class="snake-msg-title">💀 Game Over</div>
        <div class="snake-msg-sub">Pontuação: ${score}${isHi ? ' · 🏆 Novo recorde!' : ''}</div>
        <button class="snake-start-btn" id="sn-start">↺ Jogar Novamente</button>`;
      msg.querySelector('#sn-start').addEventListener('click', _start);
    }
  }

  function _placeFood() {
    const empty = [];
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        if (!snake.some(s => s.x === x && s.y === y)) empty.push({x, y});
    food = empty[Math.floor(Math.random() * empty.length)];
  }

  function _updateScore() {
    const el = _pane.querySelector('#sn-score');
    if (el) el.textContent = score;
  }

  function _onKey(e) {
    if (!_pane?.closest('body')) { document.removeEventListener('keydown', _onKey); return; }
    const pane = document.getElementById('pane-snake');
    if (!pane?.classList.contains('active')) return;

    if (e.key === ' ') {
      e.preventDefault();
      if (state === 'running') { clearInterval(loop); state = 'paused'; }
      else if (state === 'paused') { loop = setInterval(_tick, 130); state = 'running'; }
      return;
    }

    if (state === 'dead') {
      if (e.key === 'Enter' || e.key === ' ') _start();
      return;
    }
    if (state !== 'running') return;

    const map = {
      ArrowUp:{x:0,y:-1}, w:{x:0,y:-1}, W:{x:0,y:-1},
      ArrowDown:{x:0,y:1}, s:{x:0,y:1}, S:{x:0,y:1},
      ArrowLeft:{x:-1,y:0}, a:{x:-1,y:0}, A:{x:-1,y:0},
      ArrowRight:{x:1,y:0}, d:{x:1,y:0}, D:{x:1,y:0},
    };
    const nd = map[e.key];
    if (!nd) return;
    if (nd.x !== -dir.x || nd.y !== -dir.y) nextDir = nd;
    if (e.key.startsWith('Arrow')) e.preventDefault();
  }

  function _onTouchStart(e) {
    _touchStart = {x: e.touches[0].clientX, y: e.touches[0].clientY};
  }

  function _onTouchEnd(e) {
    if (!_touchStart || state !== 'running') return;
    const dx = e.changedTouches[0].clientX - _touchStart.x;
    const dy = e.changedTouches[0].clientY - _touchStart.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20 && dir.x !== -1) nextDir = {x:1,y:0};
      if (dx < -20 && dir.x !== 1)  nextDir = {x:-1,y:0};
    } else {
      if (dy > 20 && dir.y !== -1) nextDir = {x:0,y:1};
      if (dy < -20 && dir.y !== 1)  nextDir = {x:0,y:-1};
    }
    _touchStart = null;
  }

  function _drawIdle() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _drawGrid();
  }

  function _draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _drawGrid();

    // Food — pulsing apple
    ctx.fillStyle = C.food;
    ctx.shadowColor = C.food;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake body
    snake.forEach((seg, i) => {
      const alpha = Math.max(0.35, 1 - i * 0.015);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i === 0 ? C.head : C.body;
      _roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Eyes
    if (snake.length) {
      const h  = snake[0];
      const cx = h.x * CELL + CELL / 2;
      const cy = h.y * CELL + CELL / 2;
      const ex = cx + dir.x * 3;
      const ey = cy + dir.y * 3;
      ctx.fillStyle = C.eye;
      ctx.beginPath(); ctx.arc(ex + dir.y * 3, ey - dir.x * 3, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex - dir.y * 3, ey + dir.x * 3, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function _drawGrid() {
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
    }
  }

  function _roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  return { init };
})();
