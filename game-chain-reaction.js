const ChainReactionGame = (function () {
  'use strict';

  let root, cv, cx, raf, W, H, G;

  // Piece types the player places on the grid
  // Ball travels until it hits a piece or wall, then reacts
  // L = mirror /, R = mirror \, B = bouncer (reverses), X = splitter, + = extra ball

  const LEVELS = [
    { title:'Level 1 — First Reaction', hint:'Place a mirror to redirect the ball to the target',
      launcher:{ x:0, y:2, dir:'right' }, target:{ x:7, y:2 },
      walls:[], given:{ '/':2, '\\':2 }, grid:8, rows:5 },
    { title:'Level 2 — Double Bounce', hint:'Bounce the ball twice to reach the target',
      launcher:{ x:0, y:1, dir:'right' }, target:{ x:5, y:4 },
      walls:[{x:3,y:2}], given:{ '/':2, '\\':2 }, grid:7, rows:6 },
    { title:'Level 3 — The Wall', hint:'Navigate around the wall',
      launcher:{ x:0, y:0, dir:'right' }, target:{ x:6, y:5 },
      walls:[{x:2,y:0},{x:2,y:1},{x:2,y:2},{x:4,y:3},{x:4,y:4},{x:4,y:5}],
      given:{ '/':3, '\\':3 }, grid:8, rows:7 },
    { title:'Level 4 — Splitter', hint:'Use the splitter to hit two targets!',
      launcher:{ x:0, y:3, dir:'right' }, target:{ x:6, y:0 }, target2:{ x:6, y:5 },
      walls:[], given:{ '/':2, '\\':2, 'X':1 }, grid:8, rows:7 },
    { title:'Level 5 — Maze', hint:'Use all the pieces to solve the maze',
      launcher:{ x:0, y:0, dir:'right' }, target:{ x:7, y:6 },
      walls:[{x:2,y:0},{x:2,y:1},{x:4,y:2},{x:4,y:3},{x:6,y:4},{x:6,y:5}],
      given:{ '/':4, '\\':3 }, grid:9, rows:8 },
    { title:'Level 6 — Advanced', hint:'Think several steps ahead',
      launcher:{ x:0, y:4, dir:'right' }, target:{ x:8, y:0 },
      walls:[{x:2,y:1},{x:2,y:2},{x:5,y:3},{x:5,y:4},{x:5,y:5}],
      given:{ '/':4, '\\':3, 'X':1 }, grid:10, rows:7 },
  ];

  const PIECE_COLORS = { '/':'#22d3ee', '\\':'#a855f7', 'B':'#f59e0b', 'X':'#22c55e', '+':'#f43f5e' };

  function injectCSS() {
    if (document.getElementById('cr-css')) return;
    const s = document.createElement('style'); s.id = 'cr-css';
    s.textContent = `
.cr-host{position:relative;width:100%;min-height:500px;background:#080610;overflow:hidden;display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;color:#e0e7ff}
.cr-cv{display:block;width:100%;flex:1;min-height:0;touch-action:none}
.cr-hud{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,.5);flex-shrink:0;flex-wrap:wrap;gap:6px}
.cr-hud-title{font-size:.82rem;font-weight:700;color:#818cf8;flex:1;min-width:100px}
.cr-piece-tray{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cr-piece-btn{width:36px;height:36px;border-radius:8px;border:1.5px solid;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;transition:all .15s;position:relative}
.cr-piece-btn.sel{box-shadow:0 0 14px currentColor;transform:scale(1.12)}
.cr-piece-count{position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;background:#1e1b4b;font-size:.6rem;color:#a5b4fc;display:flex;align-items:center;justify-content:center;font-weight:700;border:1px solid #312e81}
.cr-actions{display:flex;gap:6px;margin-left:auto}
.cr-fire-btn{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:.85rem;font-weight:700;cursor:pointer;transition:transform .15s}
.cr-fire-btn:hover{transform:scale(1.05)}
.cr-reset-btn{background:transparent;border:1.5px solid #4338ca;color:#818cf8;border-radius:8px;padding:8px 12px;font-size:.85rem;cursor:pointer;transition:all .15s}
.cr-reset-btn:hover{background:rgba(67,56,202,.2)}
.cr-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 40%,#09061a 0%,#000 80%);z-index:10}
.cr-title{font-size:2rem;font-weight:900;background:linear-gradient(120deg,#818cf8,#a855f7,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center}
.cr-btn{background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;padding:13px 36px;font-size:1.05rem;font-weight:700;cursor:pointer;box-shadow:0 0 20px rgba(99,102,241,.35);transition:transform .15s}
.cr-btn:hover{transform:scale(1.05)}
.cr-btn-sm{background:transparent;border:1.5px solid #6366f1;color:#818cf8;border-radius:10px;padding:9px 22px;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .15s}
.cr-btn-sm:hover{background:rgba(99,102,241,.12)}
.cr-hint{font-size:.75rem;color:#312e81;text-align:center;max-width:260px;font-style:italic}
.cr-prog{display:flex;gap:5px}
.cr-prog-d{width:9px;height:9px;border-radius:50%;background:#1e1b4b;border:1.5px solid #312e81}
.cr-prog-d.done{background:#6366f1;box-shadow:0 0 6px #6366f1}`;
    document.head.appendChild(s);
  }

  function init(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  function showMenu() {
    const saved = +localStorage.getItem('cr-lvl') || 0;
    root.innerHTML = `<div class="cr-host"><div class="cr-overlay">
      <div style="font-size:3rem;filter:drop-shadow(0 0 18px #6366f1)">⚙️</div>
      <div class="cr-title">Chain Reaction<br>Factory</div>
      <div class="cr-prog">${LEVELS.map((_,i)=>`<div class="cr-prog-d ${i<saved?'done':''}"></div>`).join('')}</div>
      <button class="cr-btn" id="cr-play">▶ ${saved>0?'Continue':'Play'}</button>
      ${saved>0?`<button class="cr-btn-sm" id="cr-reset">↺ Start Over</button>`:''}
      <div class="cr-hint">Place mirrors to redirect the ball · Hit the target to win</div>
    </div></div>`;
    root.querySelector('#cr-play').addEventListener('click', () => playLevel(saved));
    root.querySelector('#cr-reset')?.addEventListener('click', () => { localStorage.removeItem('cr-lvl'); showMenu(); });
  }

  function playLevel(idx) {
    if (idx >= LEVELS.length) { showAllDone(); return; }
    const lvl = LEVELS[idx];
    const cols = lvl.grid, rows = lvl.rows;

    root.innerHTML = `<div class="cr-host">
      <div class="cr-hud">
        <div class="cr-hud-title">${lvl.title}</div>
        <div class="cr-piece-tray" id="cr-tray"></div>
        <div class="cr-actions">
          <button class="cr-reset-btn" id="cr-r">↺</button>
          <button class="cr-fire-btn" id="cr-f">🚀 Launch</button>
        </div>
      </div>
      <canvas class="cr-cv" id="cr-cv"></canvas>
    </div>`;

    cv = root.querySelector('#cr-cv');
    cx = cv.getContext('2d');
    resize(cols, rows);
    window.addEventListener('resize', () => resize(cols, rows));

    G = buildLevel(idx, lvl);
    buildTray();

    cv.addEventListener('click', onGridClick);
    cv.addEventListener('touchstart', e => {
      e.preventDefault();
      const t=e.touches[0]; const r=cv.getBoundingClientRect();
      const sx=cv.width/r.width, sy=cv.height/r.height;
      onGridClickAt((t.clientX-r.left)*sx, (t.clientY-r.top)*sy);
    }, {passive:false});
    // Recalculate tile sizes after first paint to get actual canvas dimensions
    requestAnimationFrame(() => resize(cols, rows));

    root.querySelector('#cr-f').addEventListener('click', launch);
    root.querySelector('#cr-r').addEventListener('click', () => { cancelAnimationFrame(raf); playLevel(idx); });

    raf = requestAnimationFrame(loop);
  }

  function resize(cols, rows) {
    W = cv.offsetWidth || 360; H = cv.offsetHeight || 420;
    cv.width = W; cv.height = H;
    if (G) {
      G.tileW = Math.floor(W / G.cols); G.tileH = Math.floor(H / G.rows);
      G.tile = Math.min(G.tileW, G.tileH, 56);
      G.offX = (W - G.tile * G.cols) / 2; G.offY = (H - G.tile * G.rows) / 2;
    }
  }

  function buildLevel(idx, lvl) {
    const g = {
      idx, lvl, cols: lvl.grid, rows: lvl.rows,
      tile: 0, offX: 0, offY: 0,
      pieces: {}, // key: 'x,y' → type
      walls: new Set(lvl.walls.map(w=>`${w.x},${w.y}`)),
      ball: null, ballTrail: [],
      particles: [],
      selectedPiece: Object.keys(lvl.given)[0] || '/',
      inventory: { ...lvl.given },
      state: 'place', // 'place', 'running', 'won', 'fail'
      targetsHit: 0, targetsTotal: lvl.target2 ? 2 : 1,
    };
    const cols = lvl.grid, rows = lvl.rows;
    g.tile = Math.min(Math.floor(Math.min(W/cols, H/rows)), 56);
    g.offX = (W - g.tile * cols) / 2; g.offY = (H - g.tile * rows) / 2;
    return g;
  }

  function buildTray() {
    const tray = root.querySelector('#cr-tray');
    if (!tray) return;
    const pieceNames = { '/':'/ Mirror', '\\':'\\ Mirror', 'B':'Bouncer', 'X':'Splitter', '+':'Extra' };
    tray.innerHTML = Object.entries(G.inventory).map(([type, count]) => `
      <div class="cr-piece-btn ${type===G.selectedPiece?'sel':''}" data-type="${type}"
        style="color:${PIECE_COLORS[type]||'#818cf8'};border-color:${PIECE_COLORS[type]||'#818cf8'}">
        ${escT(type)}<div class="cr-piece-count">${count}</div>
      </div>`).join('');
    tray.querySelectorAll('.cr-piece-btn').forEach(b => b.addEventListener('click', () => {
      G.selectedPiece = b.dataset.type; buildTray();
    }));
  }

  function escT(t) { return t === '<' ? '&lt;' : t === '>' ? '&gt;' : t; }

  function onGridClick(e) {
    const r = cv.getBoundingClientRect();
    const scaleX = cv.width / r.width, scaleY = cv.height / r.height;
    onGridClickAt((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
  }

  function onGridClickAt(px, py) {
    if (G.state !== 'place') return;
    const gx = Math.floor((px - G.offX) / G.tile);
    const gy = Math.floor((py - G.offY) / G.tile);
    if (gx < 0 || gy < 0 || gx >= G.cols || gy >= G.rows) return;
    const key = `${gx},${gy}`;
    if (G.walls.has(key)) return;
    const isLauncher = gx === G.lvl.launcher.x && gy === G.lvl.launcher.y;
    const isTarget = (gx === G.lvl.target.x && gy === G.lvl.target.y) ||
                     (G.lvl.target2 && gx === G.lvl.target2.x && gy === G.lvl.target2.y);
    if (isLauncher || isTarget) return;

    if (G.pieces[key]) {
      G.inventory[G.pieces[key]] = (G.inventory[G.pieces[key]] || 0) + 1;
      delete G.pieces[key];
    } else if (G.inventory[G.selectedPiece] > 0) {
      G.pieces[key] = G.selectedPiece;
      G.inventory[G.selectedPiece]--;
    }
    buildTray();
  }

  function launch() {
    if (G.state !== 'place') return;
    G.state = 'running';
    G.targetsHit = 0;
    const l = G.lvl.launcher;
    const dirs = { right:[1,0], left:[-1,0], up:[0,-1], down:[0,1] };
    const [dx, dy] = dirs[l.dir] || [1,0];
    G.ball = { gx: l.x, gy: l.y, dx, dy, x: G.offX+(l.x+.5)*G.tile, y: G.offY+(l.y+.5)*G.tile, step: 0, maxStep: 200, trail: [], split: null };
    G.balls = [G.ball];
    G.ballTrail = [];
  }

  let lastTs = 0;
  function loop(ts) {
    const dt = Math.min((ts-lastTs)/1000, 0.05); lastTs = ts;
    if (G.state === 'running') updateBalls();
    updateParticles(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function updateBalls() {
    G.balls = G.balls.filter(ball => {
      ball.step++;
      if (ball.step > ball.maxStep) return false;
      const nextGX = ball.gx + ball.dx, nextGY = ball.gy + ball.dy;
      // Move world position smoothly (animated over ticks)
      ball.x = G.offX + (ball.gx + ball.dx * (ball.step % 6) / 6 + .5) * G.tile;
      ball.y = G.offY + (ball.gy + ball.dy * (ball.step % 6) / 6 + .5) * G.tile;

      if (ball.step % 6 !== 0) return true; // update grid pos every 6 ticks

      ball.gx = nextGX; ball.gy = nextGY;
      ball.x = G.offX + (ball.gx + .5) * G.tile;
      ball.y = G.offY + (ball.gy + .5) * G.tile;

      // Add trail point
      ball.trail.push({ x: ball.x, y: ball.y, life: 1 });
      if (ball.trail.length > 20) ball.trail.shift();

      // Out of bounds
      if (ball.gx < 0 || ball.gx >= G.cols || ball.gy < 0 || ball.gy >= G.rows) {
        spawnExplode(ball.x, ball.y, '#f43f5e');
        if (G.balls.length <= 1 && G.targetsHit < G.targetsTotal) setTimeout(() => failLevel(), 400);
        return false;
      }

      // Wall
      if (G.walls.has(`${ball.gx},${ball.gy}`)) {
        spawnExplode(ball.x, ball.y, '#f43f5e'); return false;
      }

      // Target check
      if ((ball.gx===G.lvl.target.x&&ball.gy===G.lvl.target.y) ||
          (G.lvl.target2&&ball.gx===G.lvl.target2.x&&ball.gy===G.lvl.target2.y)) {
        G.targetsHit++;
        spawnExplode(ball.x, ball.y, '#22c55e');
        spawnExplode(ball.x, ball.y, '#ffdd00');
        if (G.targetsHit >= G.targetsTotal) { setTimeout(() => winLevel(), 500); }
        return false;
      }

      // Piece interaction
      const pk = `${ball.gx},${ball.gy}`;
      const piece = G.pieces[pk];
      if (piece) {
        if (piece === '/') { [ball.dx, ball.dy] = [-ball.dy, -ball.dx]; spawnExplode(ball.x, ball.y, PIECE_COLORS['/']); }
        if (piece === '\\') { [ball.dx, ball.dy] = [ball.dy, ball.dx]; spawnExplode(ball.x, ball.y, PIECE_COLORS['\\']); }
        if (piece === 'B') { ball.dx = -ball.dx; ball.dy = -ball.dy; spawnExplode(ball.x, ball.y, PIECE_COLORS['B']); }
        if (piece === 'X') {
          // Splitter: spawn a second ball perpendicular
          const [px, py] = [ball.dy, ball.dx];
          G.balls.push({ gx:ball.gx, gy:ball.gy, dx:px, dy:py, x:ball.x, y:ball.y, step:0, maxStep:200, trail:[], split:true });
          spawnExplode(ball.x, ball.y, PIECE_COLORS['X']);
        }
      }
      return true;
    });

    // Update trails
    G.balls.forEach(b => b.trail.forEach(t => t.life -= 0.06));

    if (G.balls.length === 0 && G.targetsHit < G.targetsTotal) {
      setTimeout(() => failLevel(), 600);
    }
  }

  function spawnExplode(x, y, color) {
    for (let i=0;i<10;i++) {
      const a=Math.random()*Math.PI*2, spd=50+Math.random()*80;
      G.particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:.4+Math.random()*.3,color,size:3+Math.random()*3});
    }
  }

  function updateParticles(dt) {
    G.particles = G.particles.filter(p => {
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=60*dt; p.life-=dt; return p.life>0;
    });
  }

  function winLevel() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    G.state = 'won';
    const next = G.idx + 1;
    if (next > +localStorage.getItem('cr-lvl')||0) localStorage.setItem('cr-lvl', next);
    root.innerHTML = `<div class="cr-host"><div class="cr-overlay">
      <div style="font-size:2.8rem">✅</div>
      <div class="cr-title" style="font-size:1.6rem">Chain Complete!</div>
      <div class="cr-prog">${LEVELS.map((_,i)=>`<div class="cr-prog-d ${i<next?'done':i===next?'done':''}"></div>`).join('')}</div>
      ${next < LEVELS.length
        ? `<button class="cr-btn" id="cr-next">▶ Next Level</button>`
        : `<button class="cr-btn" id="cr-next">🏆 All Done!</button>`}
      <button class="cr-btn-sm" id="cr-re">↺ Replay</button>
    </div></div>`;
    root.querySelector('#cr-next').addEventListener('click', () => playLevel(next));
    root.querySelector('#cr-re').addEventListener('click', () => playLevel(G.idx));
  }

  function failLevel() {
    if (G.state !== 'running') return;
    G.state = 'fail';
    root.innerHTML = `<div class="cr-host"><div class="cr-overlay">
      <div style="font-size:2.8rem">💥</div>
      <div class="cr-title" style="font-size:1.5rem">Miss!</div>
      <div class="cr-hint">The ball didn't reach the target. Rearrange your pieces!</div>
      <button class="cr-btn" id="cr-re">↺ Try Again</button>
    </div></div>`;
    root.querySelector('#cr-re').addEventListener('click', () => playLevel(G.idx));
  }

  function showAllDone() {
    root.innerHTML = `<div class="cr-host"><div class="cr-overlay">
      <div style="font-size:3rem">🏆</div>
      <div class="cr-title">Factory Mastered!</div>
      <button class="cr-btn" id="cr-ag">▶ Play Again</button>
    </div></div>`;
    root.querySelector('#cr-ag').addEventListener('click', () => { localStorage.removeItem('cr-lvl'); showMenu(); });
  }

  /* ── RENDER ───────────────────────────── */
  function render() {
    if (!cx) return;
    cx.fillStyle = '#080610'; cx.fillRect(0,0,W,H);
    drawGrid(); drawPieces(); drawLauncher(); drawTargets();
    drawBallTrails(); drawBalls(); drawParticles();
  }

  function glow(color, blur) { cx.shadowColor=color; cx.shadowBlur=blur; }
  function noGlow() { cx.shadowBlur=0; }

  function drawGrid() {
    const { offX, offY, tile, cols, rows } = G;
    for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) {
      const x=offX+c*tile, y=offY+r*tile;
      const isWall = G.walls.has(`${c},${r}`);
      cx.fillStyle = isWall ? '#0d0d24' : '#0a0a1e';
      cx.fillRect(x, y, tile, tile);
      cx.strokeStyle = '#1e1b4b'; cx.lineWidth=1;
      cx.strokeRect(x+.5, y+.5, tile-1, tile-1);
      if (isWall) { glow('#312e81',6); cx.strokeStyle='#3730a3'; cx.strokeRect(x+1,y+1,tile-2,tile-2); noGlow(); }
    }
  }

  function drawPieces() {
    Object.entries(G.pieces).forEach(([key, type]) => {
      const [gx, gy] = key.split(',').map(Number);
      const x=G.offX+(gx+.5)*G.tile, y=G.offY+(gy+.5)*G.tile;
      const color = PIECE_COLORS[type] || '#818cf8';
      glow(color, 12);
      cx.strokeStyle = color; cx.lineWidth = 3; cx.lineCap = 'round';
      if (type === '/') {
        cx.beginPath(); cx.moveTo(x+G.tile*.4,y+G.tile*.4); cx.lineTo(x-G.tile*.4,y-G.tile*.4); cx.stroke();
      } else if (type === '\\') {
        cx.beginPath(); cx.moveTo(x-G.tile*.4,y+G.tile*.4); cx.lineTo(x+G.tile*.4,y-G.tile*.4); cx.stroke();
      } else if (type === 'B') {
        cx.strokeStyle=color; cx.beginPath(); cx.arc(x,y,G.tile*.35,0,Math.PI*2); cx.stroke();
        cx.fillStyle=color; cx.beginPath(); cx.arc(x,y,G.tile*.12,0,Math.PI*2); cx.fill();
      } else if (type === 'X') {
        cx.beginPath(); cx.moveTo(x,y-G.tile*.38); cx.lineTo(x,y+G.tile*.38); cx.stroke();
        cx.beginPath(); cx.moveTo(x-G.tile*.38,y); cx.lineTo(x+G.tile*.38,y); cx.stroke();
      }
      noGlow();
    });
  }

  function drawLauncher() {
    const l = G.lvl.launcher;
    const x=G.offX+(l.x+.5)*G.tile, y=G.offY+(l.y+.5)*G.tile;
    glow('#f59e0b', 16);
    cx.fillStyle = '#f59e0b';
    cx.beginPath(); cx.arc(x, y, G.tile*.3, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#fff'; cx.font=`${G.tile*.4}px serif`; cx.textAlign='center'; cx.textBaseline='middle';
    cx.fillText('🚀', x, y+1);
    noGlow();
  }

  function drawTargets() {
    const drawT = (t) => {
      if (!t) return;
      const x=G.offX+(t.x+.5)*G.tile, y=G.offY+(t.y+.5)*G.tile, ts=performance.now()/1000;
      glow('#22c55e', 18);
      cx.strokeStyle = `rgba(34,197,94,${0.5+Math.sin(ts*4)*.3})`;
      cx.lineWidth = 3;
      cx.beginPath(); cx.arc(x,y,G.tile*.38+Math.sin(ts*4)*3,0,Math.PI*2); cx.stroke();
      cx.fillStyle='rgba(34,197,94,.15)'; cx.beginPath(); cx.arc(x,y,G.tile*.38,0,Math.PI*2); cx.fill();
      cx.fillStyle='#22c55e'; cx.font=`${G.tile*.4}px serif`; cx.textAlign='center'; cx.textBaseline='middle';
      cx.fillText('🎯', x, y+1);
      noGlow();
    };
    drawT(G.lvl.target); drawT(G.lvl.target2);
  }

  function drawBallTrails() {
    G.balls.forEach(ball => {
      ball.trail.forEach((t, i) => {
        const a = (i/ball.trail.length) * t.life;
        glow('#818cf8', 4); cx.globalAlpha = a * 0.5;
        cx.fillStyle = '#818cf8';
        cx.beginPath(); cx.arc(t.x, t.y, 4*(i/ball.trail.length), 0, Math.PI*2); cx.fill();
      });
    });
    cx.globalAlpha = 1; noGlow();
  }

  function drawBalls() {
    G.balls.forEach(ball => {
      glow('#818cf8', 16);
      cx.fillStyle = '#818cf8';
      cx.beginPath(); cx.arc(ball.x, ball.y, G.tile*.22, 0, Math.PI*2); cx.fill();
      glow('#fff', 6); cx.fillStyle='#fff';
      cx.beginPath(); cx.arc(ball.x, ball.y, G.tile*.1, 0, Math.PI*2); cx.fill();
      noGlow();
    });
  }

  function drawParticles() {
    G.particles.forEach(p => {
      const a = p.life / 0.5;
      glow(p.color, 8); cx.globalAlpha = Math.min(1, a);
      cx.fillStyle = p.color; cx.beginPath(); cx.arc(p.x, p.y, p.size*Math.min(1,a), 0, Math.PI*2); cx.fill();
    });
    cx.globalAlpha = 1; noGlow();
  }

  return { init };
})();
