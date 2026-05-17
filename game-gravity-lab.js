const GravityLabGame = (function () {
  'use strict';

  let root, cv, cx, raf, W, H, G;
  let _keyHandler = null;

  const TILE = 40;

  const LEVELS = [
    { title:'Level 1', hint:'Use arrow keys or tap to change gravity!',
      grid:['#####','#S  #','#   #','# E #','#####'],
      flips:3, gravStart:'down' },
    { title:'Level 2', hint:'Use the switch to restore flip charges',
      grid:['######','#S   #','## # #','#W   #','# E  #','######'],
      flips:3, gravStart:'down' },
    { title:'Level 3', hint:'Time your flips carefully',
      grid:['#######','#S    #','#  ## #','# ##  #','#    E#','#######'],
      flips:4, gravStart:'down' },
    { title:'Level 4', hint:'Multiple platforms to navigate',
      grid:['########','#S     #','# #### #','#      #','# #### #','#     E#','########'],
      flips:5, gravStart:'down' },
    { title:'Level 5', hint:'Gravity goes sideways too!',
      grid:['########','#S  ## #','#      #','## ##  #','#      #','# E    #','########'],
      flips:5, gravStart:'down' },
    { title:'Level 6', hint:'Complex route — plan your flips!',
      grid:['#########','#S      #','# #####W#','#       #','#W##### #','#      E#','#########'],
      flips:6, gravStart:'down' },
    { title:'Level 7', hint:'Advanced — use every flip wisely',
      grid:['##########','#S       #','## ##### #','#        #','# ##### ##','#       E#','##########'],
      flips:7, gravStart:'down' },
    { title:'Level 8', hint:'Master challenge!',
      grid:['###########','#S        #','# #######W#','#         #','#W####### #','#        E#','###########'],
      flips:8, gravStart:'down' },
  ];

  const GRAVS = { down:[0,1], up:[0,-1], left:[-1,0], right:[1,0] };
  const GRAV_LABELS = { down:'↓', up:'↑', left:'←', right:'→' };

  function injectCSS() {
    if (document.getElementById('gl-css')) return;
    const s = document.createElement('style'); s.id = 'gl-css';
    s.textContent = `
.gl-host{position:relative;width:100%;height:100%;min-height:500px;background:#020814;overflow:hidden;display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;color:#e0f2fe}
.gl-cv{display:block;width:100%;flex:1;min-height:0;cursor:pointer;touch-action:none}
.gl-hud{position:absolute;top:0;left:0;right:0;padding:8px 14px;display:flex;align-items:center;gap:10px;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:5;pointer-events:none}
.gl-hud-title{font-size:.85rem;font-weight:700;color:#38bdf8;flex:1}
.gl-hud-grav{font-size:1.1rem;font-weight:900;color:#22d3ee;text-shadow:0 0 10px #22d3ee;min-width:24px;text-align:center}
.gl-hud-flips{font-size:.8rem;color:#7dd3fc;display:flex;gap:4px;align-items:center}
.gl-flip-dot{width:9px;height:9px;border-radius:50%;background:#22d3ee;box-shadow:0 0 6px #22d3ee}
.gl-flip-dot.used{background:#1e293b;box-shadow:none}
.gl-hud-btn{background:transparent;border:1px solid #1e40af;color:#7dd3fc;border-radius:6px;padding:3px 8px;font-size:.75rem;cursor:pointer;pointer-events:all;flex-shrink:0;transition:all .15s}
.gl-hud-btn:hover{border-color:#22d3ee;color:#22d3ee}
.gl-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 40%,#020d1c 0%,#000 80%);z-index:10}
.gl-title{font-size:2rem;font-weight:900;background:linear-gradient(120deg,#22d3ee,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center}
.gl-btn{background:linear-gradient(135deg,#0891b2,#22d3ee);color:#fff;border:none;border-radius:12px;padding:13px 36px;font-size:1.05rem;font-weight:700;cursor:pointer;box-shadow:0 0 20px rgba(34,211,238,.35);transition:transform .15s}
.gl-btn:hover{transform:scale(1.05)}
.gl-btn-sm{background:transparent;border:1.5px solid #22d3ee;color:#22d3ee;border-radius:10px;padding:9px 24px;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .15s}
.gl-btn-sm:hover{background:rgba(34,211,238,.1)}
.gl-tip{font-size:.75rem;color:#334155;text-align:center;max-width:260px;line-height:1.5}
.gl-level-num{font-size:3rem;filter:drop-shadow(0 0 16px #22d3ee)}
.gl-lv-done{font-size:2.5rem;filter:drop-shadow(0 0 20px #22d3ee)}
.gl-complete-title{font-size:1.6rem;font-weight:900;color:#22d3ee;text-align:center}
.gl-progress{display:flex;gap:6px}
.gl-prog-dot{width:10px;height:10px;border-radius:50%;background:#1e293b;border:1.5px solid #1e40af}
.gl-prog-dot.done{background:#22d3ee;box-shadow:0 0 6px #22d3ee}
.gl-prog-dot.curr{background:rgba(34,211,238,.3);border-color:#22d3ee;animation:gl-pulse .8s ease-in-out infinite alternate}
@keyframes gl-pulse{from{box-shadow:0 0 2px #22d3ee}to{box-shadow:0 0 10px #22d3ee}}
.gl-hint{font-size:.78rem;color:#334155;text-align:center;font-style:italic;max-width:240px}`;
    document.head.appendChild(s);
  }

  function init(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  function showMenu() {
    _removeKeyHandler();
    const saved = +localStorage.getItem('gl-lvl') || 0;
    root.innerHTML = `<div class="gl-host"><div class="gl-overlay">
      <div class="gl-level-num">🔬</div>
      <div class="gl-title">Gravity Lab</div>
      <div class="gl-progress">${LEVELS.map((_,i)=>`<div class="gl-prog-dot ${i<saved?'done':''}"></div>`).join('')}</div>
      <button class="gl-btn" id="gl-play">▶ ${saved>0?'Continue':'Play'}</button>
      ${saved>0?`<button class="gl-btn-sm" id="gl-reset">↺ Restart from Level 1</button>`:''}
      <div class="gl-tip">Arrow keys ↑↓←→ to set gravity<br>Or tap / click to cycle direction<br>Guide the ball to the exit portal</div>
    </div></div>`;
    root.querySelector('#gl-play').addEventListener('click', () => playLevel(saved));
    root.querySelector('#gl-reset')?.addEventListener('click', () => { localStorage.removeItem('gl-lvl'); showMenu(); });
  }

  function playLevel(idx) {
    if (idx >= LEVELS.length) { showAllDone(); return; }
    _removeKeyHandler();
    const lvl = LEVELS[idx];
    root.innerHTML = `<div class="gl-host">
      <canvas class="gl-cv" id="gl-cv"></canvas>
      <div class="gl-hud">
        <div class="gl-hud-title">${lvl.title}</div>
        <div class="gl-hud-grav" id="gl-grav">${GRAV_LABELS[lvl.gravStart]}</div>
        <div class="gl-hud-flips" id="gl-flips"></div>
        <button class="gl-hud-btn" id="gl-hud-new">↺ New</button>
      </div>
    </div>`;
    cv = root.querySelector('#gl-cv');
    cx = cv.getContext('2d');
    resize(); window.addEventListener('resize', resize);
    G = buildLevel(idx, lvl);
    updateFlipHUD();
    cv.addEventListener('click', flipGravity);
    cv.addEventListener('touchstart', e => { e.preventDefault(); flipGravity(); }, { passive: false });
    root.querySelector('#gl-hud-new').addEventListener('click', () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      _removeKeyHandler();
      showMenu();
    });
    _keyHandler = function(e) {
      const map = { ArrowDown:'down', ArrowUp:'up', ArrowLeft:'left', ArrowRight:'right' };
      if (map[e.key]) { e.preventDefault(); setGrav(map[e.key]); return; }
      if (e.key === ' ') { e.preventDefault(); flipGravity(); }
    };
    document.addEventListener('keydown', _keyHandler);
    raf = requestAnimationFrame(loop);
  }

  function _removeKeyHandler() {
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
  }

  function setGrav(dir) {
    if (!G || G.state !== 'playing' || dir === G.grav) return;
    if (G.flipsLeft <= 0) { shakeHUD(); return; }
    G.grav = dir;
    G.flipsLeft--; G.flipsUsed++;
    updateFlipHUD();
    spawnGravParticles();
  }

  function resize() {
    W = cv.offsetWidth || 360; H = cv.offsetHeight || 500;
    cv.width = W; cv.height = H;
    if (G) scaleLevel();
  }

  function buildLevel(idx, lvl) {
    const rows = lvl.grid;
    const gridH = rows.length, gridW = rows[0].length;
    const tileW = Math.floor(Math.min(W, H * (gridW/gridH)) / gridW);
    const tileH = Math.floor(Math.min(H, W * (gridH/gridW)) / gridH);
    const tile = Math.min(tileW, tileH, TILE);
    const offX = (W - tile * gridW) / 2;
    const offY = (H - tile * gridH) / 2;

    let ball = null, exit = null, switches = [];
    const walls = [];

    rows.forEach((row, ri) => {
      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci];
        const wx = offX + ci * tile, wy = offY + ri * tile;
        if (ch === '#') walls.push({ x: wx, y: wy, w: tile, h: tile });
        if (ch === 'S') ball = { x: wx + tile/2, y: wy + tile/2, vx: 0, vy: 0, r: tile*0.28 };
        if (ch === 'E') exit = { x: wx, y: wy, w: tile, h: tile };
        if (ch === 'W') switches.push({ x: wx + tile/2, y: wy + tile/2, r: tile*0.32, used: false, idx: ci, row: ri });
      }
    });

    return {
      idx, lvl,
      tile, offX, offY, gridW, gridH,
      walls, ball, exit, switches,
      grav: lvl.gravStart,
      flipsLeft: lvl.flips, flipsUsed: 0,
      startBall: { ...ball },
      state: 'playing',
      particles: [], resetTimer: 0,
      trail: [],
      switchFlash: []
    };
  }

  function scaleLevel() {
    const rows = G.lvl.grid;
    const gridH = rows.length, gridW = rows[0].length;
    const tile = Math.min(Math.floor(Math.min(W, H*(gridW/gridH))/gridW), Math.floor(Math.min(H, W*(gridH/gridW))/gridH), TILE);
    G.tile = tile;
    G.offX = (W - tile * gridW) / 2;
    G.offY = (H - tile * gridH) / 2;
    G.walls = []; G.exit = null; G.switches = [];
    rows.forEach((row, ri) => {
      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci];
        const wx = G.offX + ci * tile, wy = G.offY + ri * tile;
        if (ch === '#') G.walls.push({ x: wx, y: wy, w: tile, h: tile });
        if (ch === 'E') G.exit = { x: wx, y: wy, w: tile, h: tile };
        if (ch === 'W') G.switches.push({ x: wx + tile/2, y: wy + tile/2, r: tile*0.32, used: false });
      }
    });
  }

  function flipGravity() {
    if (!G || G.state !== 'playing') return;
    if (G.flipsLeft <= 0) { shakeHUD(); return; }
    const dirs = ['down','up','left','right'];
    const idx = dirs.indexOf(G.grav);
    G.grav = dirs[(idx+1) % 4];
    G.flipsLeft--; G.flipsUsed++;
    updateFlipHUD();
    spawnGravParticles();
  }

  function updateFlipHUD() {
    const fd = root.querySelector('#gl-flips');
    if (fd) fd.innerHTML = Array.from({length:G.lvl.flips}, (_,i) =>
      `<div class="gl-flip-dot ${i >= G.flipsLeft ? 'used' : ''}"></div>`).join('');
    const gd = root.querySelector('#gl-grav');
    if (gd) gd.textContent = GRAV_LABELS[G.grav];
  }

  function shakeHUD() {
    const fd = root.querySelector('#gl-flips');
    if (!fd) return;
    fd.style.cssText += ';filter:drop-shadow(0 0 4px red)';
    setTimeout(() => fd.style.filter = '', 400);
  }

  let lastTs = 0;
  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05); lastTs = ts;
    if (G.state === 'playing') updatePhysics(dt);
    updateParticles(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  const BALL_SPEED = 220, GRAV_FORCE = 420, FRICTION = 0.92, BOUNCE = 0.1;

  function updatePhysics(dt) {
    const b = G.ball;
    const [gx, gy] = GRAVS[G.grav];
    b.vx += gx * GRAV_FORCE * dt;
    b.vy += gy * GRAV_FORCE * dt;
    const spd = Math.sqrt(b.vx*b.vx+b.vy*b.vy);
    if (spd > BALL_SPEED) { b.vx = b.vx/spd*BALL_SPEED; b.vy = b.vy/spd*BALL_SPEED; }

    b.x += b.vx * dt;
    resolveWalls(b, 'x');
    b.y += b.vy * dt;
    resolveWalls(b, 'y');

    G.trail.unshift({ x: b.x, y: b.y });
    if (G.trail.length > 14) G.trail.pop();

    if (G.exit && b.x > G.exit.x && b.x < G.exit.x+G.exit.w && b.y > G.exit.y && b.y < G.exit.y+G.exit.h) {
      G.state = 'won'; spawnWinParticles();
      cancelAnimationFrame(raf);
      setTimeout(() => levelComplete(), 900);
      return;
    }

    G.switches.forEach(sw => {
      if (!sw.used && dist(b.x, b.y, sw.x, sw.y) < b.r + sw.r) {
        sw.used = true; G.flipsLeft = Math.min(G.lvl.flips, G.flipsLeft + 2);
        G.switchFlash.push({ x: sw.x, y: sw.y, life: 0.6 });
        updateFlipHUD();
      }
    });

    if (b.x < G.offX - 20 || b.x > G.offX + G.gridW*G.tile + 20 ||
        b.y < G.offY - 20 || b.y > G.offY + G.gridH*G.tile + 20) {
      resetBall();
    }
  }

  function resolveWalls(b, axis) {
    for (const w of G.walls) {
      if (b.x + b.r > w.x && b.x - b.r < w.x+w.w && b.y + b.r > w.y && b.y - b.r < w.y+w.h) {
        if (axis === 'x') {
          if (b.vx > 0) { b.x = w.x - b.r; b.vx *= -BOUNCE; }
          else           { b.x = w.x + w.w + b.r; b.vx *= -BOUNCE; }
        } else {
          if (b.vy > 0) { b.y = w.y - b.r; b.vy *= -BOUNCE; b.vx *= FRICTION; }
          else           { b.y = w.y + w.h + b.r; b.vy *= -BOUNCE; b.vx *= FRICTION; }
        }
      }
    }
  }

  function resetBall() {
    G.ball = { ...G.startBall, vx:0, vy:0 };
    G.grav = G.lvl.gravStart; G.flipsLeft = G.lvl.flips; G.flipsUsed = 0;
    G.trail = []; updateFlipHUD();
    G.switches.forEach(s => s.used = false);
    spawnGravParticles();
  }

  function updateParticles(dt) {
    G.particles = G.particles.filter(p => {
      p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 100*dt; p.life -= dt; return p.life > 0;
    });
    G.switchFlash = G.switchFlash.filter(f => { f.life -= dt; return f.life > 0; });
  }

  function spawnGravParticles() {
    const b = G.ball;
    for (let i=0;i<12;i++) {
      const a=Math.random()*Math.PI*2, spd=60+Math.random()*80;
      G.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:.4+Math.random()*.3,color:'#22d3ee',size:3+Math.random()*3});
    }
  }

  function spawnWinParticles() {
    const b = G.ball;
    for (let i=0;i<28;i++) {
      const a=i/28*Math.PI*2, spd=100+Math.random()*100;
      const cols=['#22d3ee','#38bdf8','#a855f7','#ffdd00'];
      G.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:.6+Math.random()*.5,color:cols[i%4],size:4+Math.random()*4});
    }
  }

  function dist(ax,ay,bx,by){const dx=ax-bx,dy=ay-by;return Math.sqrt(dx*dx+dy*dy);}

  function levelComplete() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    _removeKeyHandler();
    const next = G.idx + 1;
    if (next > +localStorage.getItem('gl-lvl')||0) localStorage.setItem('gl-lvl', next);
    root.innerHTML = `<div class="gl-host"><div class="gl-overlay">
      <div class="gl-lv-done">✅</div>
      <div class="gl-complete-title">Level Complete!</div>
      <div style="font-size:.85rem;color:#334155">Flips used: ${G.flipsUsed} / ${G.lvl.flips}</div>
      <div class="gl-progress">${LEVELS.map((_,i)=>`<div class="gl-prog-dot ${i<next?'done':i===next?'curr':''}"></div>`).join('')}</div>
      ${next < LEVELS.length
        ? `<button class="gl-btn" id="gl-next">▶ Next Level</button>`
        : `<button class="gl-btn" id="gl-next">🏆 All Done!</button>`}
      <button class="gl-btn-sm" id="gl-retry">↺ Replay</button>
      <button class="gl-btn-sm" id="gl-menu2">☰ Menu</button>
    </div></div>`;
    root.querySelector('#gl-next').addEventListener('click', () => playLevel(next));
    root.querySelector('#gl-retry').addEventListener('click', () => playLevel(G.idx));
    root.querySelector('#gl-menu2').addEventListener('click', showMenu);
  }

  function showAllDone() {
    _removeKeyHandler();
    root.innerHTML = `<div class="gl-host"><div class="gl-overlay">
      <div style="font-size:3rem">🏆</div>
      <div class="gl-title">Lab Complete!</div>
      <div style="font-size:.85rem;color:#334155">All ${LEVELS.length} levels cleared!</div>
      <button class="gl-btn" id="gl-restart">▶ Play Again</button>
    </div></div>`;
    root.querySelector('#gl-restart').addEventListener('click', () => { localStorage.removeItem('gl-lvl'); showMenu(); });
  }

  /* ── RENDER ───────────────────────────── */
  function render() {
    if (!cx) return;
    cx.fillStyle = '#020814'; cx.fillRect(0, 0, W, H);
    drawGrid(); drawSwitches(); drawExit(); drawTrail(); drawBall(); drawParticles();
    drawHint();
  }

  function glow(color, blur) { cx.shadowColor = color; cx.shadowBlur = blur; }
  function noGlow() { cx.shadowBlur = 0; }

  function drawGrid() {
    G.walls.forEach(w => {
      const grad = cx.createLinearGradient(w.x, w.y, w.x+w.w, w.y+w.h);
      grad.addColorStop(0,'#0a1628'); grad.addColorStop(1,'#0f1f3a');
      cx.fillStyle = grad; cx.fillRect(w.x, w.y, w.w, w.h);
      glow('#1e40af', 4);
      cx.strokeStyle = '#1e3a5f'; cx.lineWidth = 1;
      cx.strokeRect(w.x+.5, w.y+.5, w.w-1, w.h-1);
      noGlow();
    });
  }

  function drawExit() {
    if (!G.exit) return;
    const e = G.exit, t = performance.now()/1000;
    glow('#22d3ee', 20);
    cx.fillStyle = `rgba(34,211,238,${0.3+Math.sin(t*3)*.15})`;
    cx.fillRect(e.x, e.y, e.w, e.h);
    cx.strokeStyle = '#22d3ee'; cx.lineWidth = 2;
    cx.strokeRect(e.x+1, e.y+1, e.w-2, e.h-2);
    cx.fillStyle = '#22d3ee'; cx.font = `${G.tile*.6}px serif`;
    cx.textAlign='center'; cx.textBaseline='middle';
    cx.fillText('🚪', e.x+e.w/2, e.y+e.h/2);
    noGlow();
  }

  function drawSwitches() {
    G.switches.forEach(sw => {
      if (sw.used) return;
      const t = performance.now()/1000;
      glow('#fbbf24', 14);
      cx.fillStyle = `rgba(251,191,36,${0.6+Math.sin(t*4)*.2})`;
      cx.beginPath(); cx.arc(sw.x, sw.y, sw.r, 0, Math.PI*2); cx.fill();
      cx.fillStyle = '#fff'; cx.font = `${sw.r}px serif`;
      cx.textAlign='center'; cx.textBaseline='middle';
      cx.fillText('+', sw.x, sw.y+1);
      noGlow();
    });
    G.switchFlash.forEach(f => {
      glow('#fbbf24', 24);
      cx.globalAlpha = f.life;
      cx.fillStyle = 'rgba(251,191,36,.3)';
      cx.beginPath(); cx.arc(f.x, f.y, 40*(1-f.life)+15, 0, Math.PI*2); cx.fill();
      cx.globalAlpha = 1; noGlow();
    });
  }

  function drawTrail() {
    G.trail.forEach((t, i) => {
      const a = (1 - i/G.trail.length) * 0.5;
      glow('#22d3ee', 4);
      cx.globalAlpha = a; cx.fillStyle = '#22d3ee';
      cx.beginPath(); cx.arc(t.x, t.y, G.ball.r*(1-i/G.trail.length)*.7, 0, Math.PI*2); cx.fill();
    });
    cx.globalAlpha = 1; noGlow();
  }

  function drawBall() {
    const b = G.ball, t = performance.now()/1000;
    glow('#22d3ee', 22);
    cx.fillStyle = '#22d3ee';
    cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, Math.PI*2); cx.fill();
    glow('#ffffff', 8); cx.fillStyle = '#ffffff';
    cx.beginPath(); cx.arc(b.x, b.y, b.r*0.55, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#0891b2';
    cx.beginPath(); cx.arc(b.x, b.y, b.r*0.25, 0, Math.PI*2); cx.fill();
    noGlow();
    drawGravIndicator(b.x, b.y + b.r + 14);
  }

  function drawGravIndicator(x, y) {
    const [gx, gy] = GRAVS[G.grav];
    const len = 12, hw = 5;
    glow('#22d3ee', 6);
    cx.strokeStyle = '#22d3ee'; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x+gx*len, y+gy*len); cx.stroke();
    const angle = Math.atan2(gy, gx);
    cx.fillStyle = '#22d3ee'; cx.beginPath();
    cx.moveTo(x+gx*len, y+gy*len);
    cx.lineTo(x+gx*len+Math.cos(angle+2.5)*hw, y+gy*len+Math.sin(angle+2.5)*hw);
    cx.lineTo(x+gx*len+Math.cos(angle-2.5)*hw, y+gy*len+Math.sin(angle-2.5)*hw);
    cx.closePath(); cx.fill();
    noGlow();
  }

  function drawParticles() {
    G.particles.forEach(p => {
      const a = p.life / 0.6;
      glow(p.color, 8); cx.globalAlpha = Math.min(1, a);
      cx.fillStyle = p.color; cx.beginPath(); cx.arc(p.x, p.y, p.size*Math.min(1,a), 0, Math.PI*2); cx.fill();
    });
    cx.globalAlpha = 1; noGlow();
  }

  function drawHint() {
    const t = performance.now()/1000;
    if (t < 3) {
      cx.globalAlpha = Math.min(1, Math.min(t, 3-t)*2);
      cx.fillStyle = '#334155'; cx.font = '13px sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'bottom';
      cx.fillText(G.lvl.hint, W/2, H - 10);
      cx.globalAlpha = 1;
    }
  }

  return { init };
})();
