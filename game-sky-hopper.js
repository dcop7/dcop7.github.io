const SkyHopperGame = (function () {
  'use strict';

  let root, cv, cx, raf, W, H, G;

  const DIFFS = {
    easy:   { speed: 2.4, gravity: 0.42, jumpForce: -8.5,  gapMin: 145, gapMax: 210, pipeInterval: 130 },
    medium: { speed: 3.2, gravity: 0.55, jumpForce: -9.5,  gapMin: 110, gapMax: 180, pipeInterval: 105 },
    hard:   { speed: 4.2, gravity: 0.68, jumpForce: -10.5, gapMin: 75,  gapMax: 120, pipeInterval: 80  },
  };

  function injectCSS() {
    if (document.getElementById('sh-css')) return;
    const s = document.createElement('style'); s.id = 'sh-css';
    s.textContent = `
.sh-host{position:relative;width:100%;height:100%;min-height:500px;background:#000;overflow:hidden;display:flex;flex-direction:column}
.sh-cv{display:block;width:100%;flex:1;min-height:0;cursor:pointer;touch-action:none}
.sh-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:10;background:radial-gradient(ellipse at 50% 40%,#020018 0%,#000 80%)}
.sh-title{font-size:2.2rem;font-weight:900;background:linear-gradient(120deg,#00ffdd,#a855f7,#00bbff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center;letter-spacing:.04em;line-height:1}
.sh-best{font-size:.85rem;color:#444}
.sh-btn{background:linear-gradient(135deg,#06b6d4,#a855f7);color:#fff;border:none;border-radius:12px;padding:14px 40px;font-size:1.1rem;font-weight:700;cursor:pointer;box-shadow:0 0 24px rgba(6,182,212,.35);transition:transform .15s}
.sh-btn:hover{transform:scale(1.05)}
.sh-tip{font-size:.75rem;color:#333;text-align:center;line-height:1.6}
.sh-score-live{position:absolute;top:14px;left:50%;transform:translateX(-50%);font-size:1.4rem;font-weight:900;color:#00ffdd;font-family:monospace;text-shadow:0 0 12px #00ffdd;pointer-events:none;z-index:5}
.sh-score-big{font-size:2.5rem;font-weight:900;color:#00ffdd;font-family:monospace;text-shadow:0 0 16px rgba(0,255,221,.5)}
.sh-medal{font-size:3rem;filter:drop-shadow(0 0 16px #a855f7)}
.sh-new-btn{position:absolute;top:12px;right:12px;background:rgba(0,0,0,.5);border:1px solid #222;color:#555;border-radius:8px;padding:6px 12px;font-size:.75rem;cursor:pointer;z-index:6;transition:all .15s}
.sh-new-btn:hover{border-color:#444;color:#888}
.sh-diff-row{display:flex;gap:8px;justify-content:center}
.sh-diff-btn{background:transparent;border:1.5px solid #222;color:#444;border-radius:8px;padding:7px 18px;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}
.sh-diff-btn.active{border-color:#06b6d4;color:#00ffdd;background:rgba(6,182,212,.12)}
.sh-diff-btn:hover:not(.active){border-color:#333;color:#666}
.sh-diff-label{font-size:.7rem;color:#333;text-align:center;letter-spacing:.08em;text-transform:uppercase}`;
    document.head.appendChild(s);
  }

  function init(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  function showMenu() {
    const best = localStorage.getItem('sh-best') || 0;
    const diff = localStorage.getItem('sh-diff') || 'medium';
    root.innerHTML = `<div class="sh-host"><div class="sh-overlay">
      <div style="font-size:3.2rem;filter:drop-shadow(0 0 18px #06b6d4)">🌟</div>
      <div class="sh-title">Sky Hopper</div>
      <div class="sh-best">Best: ${best}</div>
      <div class="sh-diff-label">Difficulty</div>
      <div class="sh-diff-row">
        <button class="sh-diff-btn ${diff==='easy'?'active':''}" data-d="easy">Easy</button>
        <button class="sh-diff-btn ${diff==='medium'?'active':''}" data-d="medium">Medium</button>
        <button class="sh-diff-btn ${diff==='hard'?'active':''}" data-d="hard">Hard</button>
      </div>
      <button class="sh-btn" id="sh-play">▶ Play</button>
      <div class="sh-tip">Tap / click to fly upward<br>Collect ⚡ orbs for bonus points</div>
    </div></div>`;
    root.querySelectorAll('.sh-diff-btn').forEach(b => {
      b.addEventListener('click', () => {
        localStorage.setItem('sh-diff', b.dataset.d);
        root.querySelectorAll('.sh-diff-btn').forEach(x => x.classList.toggle('active', x === b));
      });
    });
    root.querySelector('#sh-play').addEventListener('click', () => startGame(localStorage.getItem('sh-diff') || 'medium'));
  }

  function startGame(diff) {
    root.innerHTML = `<div class="sh-host">
      <canvas class="sh-cv" id="sh-cv"></canvas>
      <div class="sh-score-live" id="sh-slive">0</div>
      <button class="sh-new-btn" id="sh-new">↺ New</button>
    </div>`;
    cv = root.querySelector('#sh-cv');
    cx = cv.getContext('2d');
    resize(); window.addEventListener('resize', resize);
    G = newG(diff || 'medium');
    root.querySelector('#sh-new').addEventListener('click', () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      showMenu();
    });
    setupControls();
    raf = requestAnimationFrame(loop);
  }

  function resize() {
    W = cv.offsetWidth || 360; H = cv.offsetHeight || 520;
    cv.width = W; cv.height = H;
  }

  function newG(diff) {
    const d = DIFFS[diff] || DIFFS.medium;
    return {
      diff,
      alive: true, score: 0, frame: 0,
      speed: d.speed,
      gravity: d.gravity,
      jumpForce: d.jumpForce,
      px: W * 0.28, py: H * 0.5, pvy: 0, pRadius: 13, pAngle: 0,
      trail: [],
      pipes: [],
      pipeTimer: 0, pipeInterval: d.pipeInterval, gapMin: d.gapMin, gapMax: d.gapMax,
      orbs: [],
      bgStars: Array.from({length:80}, () => ({
        x: Math.random()*1000, y: Math.random()*1000,
        s: Math.random()*1.8+.3, sp: Math.random()*0.6+0.1, br: Math.random()
      })),
      bgClouds: Array.from({length:6}, () => ({
        x: Math.random()*1000, y: 50+Math.random()*(800-100),
        w: 60+Math.random()*80, sp: 0.3+Math.random()*0.4, a: 0.06+Math.random()*0.1
      })),
      particles: [],
      highScore: +localStorage.getItem('sh-best') || 0
    };
  }

  function setupControls() {
    cv.addEventListener('mousedown', doJump);
    cv.addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
  }

  function doJump() {
    if (!G.alive) return;
    G.pvy = G.jumpForce;
    spawnJumpParticles();
  }

  let lastTs = 0;
  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 16.67, 3); lastTs = ts;
    if (G.alive) { update(dt); }
    render();
    if (G.alive || G.particles.length > 0) raf = requestAnimationFrame(loop);
    else if (!G.alive) setTimeout(showDead, 600);
  }

  function update(dt) {
    G.frame++;

    G.speed = DIFFS[G.diff].speed + G.score * 0.008;
    const maxSpeed = G.diff === 'hard' ? 12 : G.diff === 'medium' ? 9 : 7;
    if (G.speed > maxSpeed) G.speed = maxSpeed;

    G.pvy += G.gravity * dt;
    G.py += G.pvy * dt;
    G.pAngle = G.pvy * 3;

    G.trail.unshift({ x: G.px, y: G.py, a: 1 });
    if (G.trail.length > 18) G.trail.pop();

    if (G.py - G.pRadius < 0 || G.py + G.pRadius > H) { die(); return; }

    G.bgStars.forEach(s => { s.x -= s.sp * dt * G.speed * 0.15; if (s.x < 0) { s.x = W; s.y = Math.random()*H; } });
    G.bgClouds.forEach(c => { c.x -= c.sp * dt * G.speed * 0.25; if (c.x + c.w < 0) { c.x = W + c.w; c.y = 40+Math.random()*(H-80); } });

    G.pipeTimer++;
    if (G.pipeTimer >= G.pipeInterval) {
      G.pipeTimer = 0;
      const gapSize = G.gapMin + Math.random() * (G.gapMax - G.gapMin);
      const gapY = 80 + Math.random() * (H - gapSize - 160);
      G.pipes.push({ x: W + 20, gapY, gapH: gapSize, w: 52, scored: false });
      if (Math.random() < 0.7) G.orbs.push({ x: W + 46, y: gapY + gapSize * 0.5, r: 9, collected: false, rot: 0 });
    }
    G.pipes.forEach(p => { p.x -= G.speed * dt; });
    G.pipes = G.pipes.filter(p => p.x + p.w > -10);

    G.orbs.forEach(o => { o.x -= G.speed * dt; o.rot += 0.06 * dt; });
    G.orbs = G.orbs.filter(o => { if (o.collected) return false; if (o.x + o.r < 0) return false; return true; });

    for (const p of G.pipes) {
      if (!p.scored && p.x + p.w < G.px) { p.scored = true; G.score++; const sl = root.querySelector('#sh-slive'); if (sl) sl.textContent = G.score; }
      if (G.px + G.pRadius > p.x && G.px - G.pRadius < p.x + p.w) {
        if (G.py - G.pRadius < p.gapY || G.py + G.pRadius > p.gapY + p.gapH) { die(); return; }
      }
    }

    for (const o of G.orbs) {
      const dx = o.x - G.px, dy = o.y - G.py;
      if (Math.sqrt(dx*dx+dy*dy) < G.pRadius + o.r + 4) {
        o.collected = true; G.score += 3;
        spawnOrbParticles(o.x, o.y);
        const sl = root.querySelector('#sh-slive'); if (sl) sl.textContent = G.score;
      }
    }

    G.particles = G.particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.18 * dt;
      p.life -= dt; p.vx *= 0.98; return p.life > 0;
    });
  }

  function die() {
    G.alive = false;
    spawnDeathParticles();
    if (G.score > G.highScore) { localStorage.setItem('sh-best', G.score); G.highScore = G.score; }
  }

  function spawnJumpParticles() {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.5 + (Math.random()-0.5) * 1.2;
      G.particles.push({ x: G.px, y: G.py + G.pRadius, vx: Math.cos(a)*2, vy: Math.sin(a)*3+1, life: 0.4+Math.random()*0.3, color: '#00ffdd', size: 3+Math.random()*3 });
    }
  }

  function spawnOrbParticles(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, spd = 1.5 + Math.random() * 2.5;
      G.particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, life: 0.5, color: '#ffdd00', size: 3+Math.random()*3 });
    }
  }

  function spawnDeathParticles() {
    for (let i = 0; i < 20; i++) {
      const a = Math.random()*Math.PI*2, spd = 2+Math.random()*5;
      G.particles.push({ x: G.px, y: G.py, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, life: 0.7+Math.random()*0.5, color: i%2===0?'#a855f7':'#00ffdd', size: 4+Math.random()*5 });
    }
  }

  /* ── RENDER ───────────────────────────── */
  function render() {
    if (!cx) return;
    const bg = cx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0, '#000118'); bg.addColorStop(1, '#000a1a');
    cx.fillStyle = bg; cx.fillRect(0,0,W,H);
    drawBG();
    G.pipes.forEach(drawPipe);
    G.orbs.forEach(drawOrb);
    drawTrail();
    if (G.alive) drawPlayer();
    drawParticles();
  }

  function glow(color, blur) { cx.shadowColor = color; cx.shadowBlur = blur; }
  function noGlow() { cx.shadowBlur = 0; }

  function drawBG() {
    G.bgStars.forEach(s => {
      cx.fillStyle = `rgba(255,255,255,${0.3+s.br*0.6})`;
      cx.beginPath(); cx.arc(s.x%W, s.y%H, s.s, 0, Math.PI*2); cx.fill();
    });
    G.bgClouds.forEach(c => {
      const grad = cx.createRadialGradient(c.x+c.w/2, c.y, 0, c.x+c.w/2, c.y, c.w);
      grad.addColorStop(0, `rgba(100,0,200,${c.a})`); grad.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = grad; cx.beginPath(); cx.ellipse(c.x+c.w/2, c.y, c.w, c.w*0.4, 0, 0, Math.PI*2); cx.fill();
    });
    glow('#a855f7', 4);
    cx.strokeStyle = 'rgba(168,85,247,.25)'; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(0, H-1); cx.lineTo(W, H-1); cx.stroke();
    cx.beginPath(); cx.moveTo(0, 1); cx.lineTo(W, 1); cx.stroke();
    noGlow();
  }

  function drawPipe(p) {
    const grad1 = cx.createLinearGradient(p.x, 0, p.x+p.w, 0);
    grad1.addColorStop(0,'#0a0a2a'); grad1.addColorStop(0.5,'#151540'); grad1.addColorStop(1,'#0a0a2a');
    cx.fillStyle = grad1;
    cx.fillRect(p.x, 0, p.w, p.gapY);
    cx.fillRect(p.x, p.gapY + p.gapH, p.w, H - p.gapY - p.gapH);
    glow('#06b6d4', 8);
    cx.strokeStyle = '#06b6d4'; cx.lineWidth = 1.5;
    cx.strokeRect(p.x, 0, p.w, p.gapY);
    cx.strokeRect(p.x, p.gapY + p.gapH, p.w, H - p.gapY - p.gapH);
    glow('#00ffdd', 14);
    cx.strokeStyle = '#00ffdd'; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(p.x, p.gapY); cx.lineTo(p.x+p.w, p.gapY); cx.stroke();
    cx.beginPath(); cx.moveTo(p.x, p.gapY+p.gapH); cx.lineTo(p.x+p.w, p.gapY+p.gapH); cx.stroke();
    noGlow();
  }

  function drawOrb(o) {
    cx.save(); cx.translate(o.x, o.y);
    glow('#ffdd00', 18);
    cx.fillStyle = '#ffdd00';
    cx.beginPath(); cx.arc(0, 0, o.r, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#fff';
    cx.beginPath(); cx.arc(-o.r*.3, -o.r*.3, o.r*.3, 0, Math.PI*2); cx.fill();
    glow('#ffdd00', 6); cx.font = `${o.r}px serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('⚡', 0, 1);
    noGlow(); cx.restore();
  }

  function drawTrail() {
    G.trail.forEach((t, i) => {
      const a = (1 - i / G.trail.length) * 0.5;
      const r = G.pRadius * (1 - i / G.trail.length) * 0.8;
      cx.globalAlpha = a;
      glow('#a855f7', 6);
      cx.fillStyle = '#a855f7';
      cx.beginPath(); cx.arc(t.x, t.y, Math.max(1, r), 0, Math.PI*2); cx.fill();
    });
    cx.globalAlpha = 1; noGlow();
  }

  function drawPlayer() {
    cx.save(); cx.translate(G.px, G.py); cx.rotate(G.pAngle * Math.PI / 180);
    glow('#00ffdd', 20);
    cx.fillStyle = '#00ffdd';
    cx.beginPath(); cx.arc(0, 0, G.pRadius, 0, Math.PI*2); cx.fill();
    glow('#ffffff', 8); cx.fillStyle = '#ffffff';
    cx.beginPath(); cx.arc(0, 0, G.pRadius * 0.55, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#a855f7'; cx.beginPath(); cx.arc(0, 0, G.pRadius * 0.25, 0, Math.PI*2); cx.fill();
    noGlow(); cx.restore();
  }

  function drawParticles() {
    G.particles.forEach(p => {
      const a = Math.min(1, p.life / 0.5);
      glow(p.color, 8);
      cx.globalAlpha = a; cx.fillStyle = p.color;
      cx.beginPath(); cx.arc(p.x, p.y, p.size * a, 0, Math.PI*2); cx.fill();
    });
    cx.globalAlpha = 1; noGlow();
  }

  function showDead() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    const best = localStorage.getItem('sh-best') || 0;
    const diff = G.diff || 'medium';
    const medal = G.score >= 20 ? '🥇' : G.score >= 10 ? '🥈' : G.score >= 5 ? '🥉' : '🌟';
    root.innerHTML = `<div class="sh-host"><div class="sh-overlay">
      <div class="sh-medal">${medal}</div>
      <div class="sh-title" style="font-size:1.7rem">Nice Flight!</div>
      <div class="sh-score-big">${G.score}</div>
      <div style="font-size:.8rem;color:#444">Best: ${best} · Orbs are worth 3 pts</div>
      <div class="sh-diff-label">Difficulty</div>
      <div class="sh-diff-row">
        <button class="sh-diff-btn ${diff==='easy'?'active':''}" data-d="easy">Easy</button>
        <button class="sh-diff-btn ${diff==='medium'?'active':''}" data-d="medium">Medium</button>
        <button class="sh-diff-btn ${diff==='hard'?'active':''}" data-d="hard">Hard</button>
      </div>
      <button class="sh-btn" id="sh-retry">🔄 Fly Again</button>
      <button style="background:transparent;border:1px solid #222;color:#444;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:.8rem" id="sh-menu">Menu</button>
    </div></div>`;
    root.querySelectorAll('.sh-diff-btn').forEach(b => {
      b.addEventListener('click', () => {
        localStorage.setItem('sh-diff', b.dataset.d);
        root.querySelectorAll('.sh-diff-btn').forEach(x => x.classList.toggle('active', x === b));
      });
    });
    root.querySelector('#sh-retry').addEventListener('click', () => startGame(localStorage.getItem('sh-diff') || diff));
    root.querySelector('#sh-menu').addEventListener('click', showMenu);
  }

  return { init };
})();
