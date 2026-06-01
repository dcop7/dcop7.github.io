const NeonShooterGame = (function () {
  'use strict';

  let root, cv, cx, raf, W, H, G;
  let mx = 200, my = 400, touching = false;

  function injectCSS() {
    if (document.getElementById('ns-css')) return;
    const s = document.createElement('style'); s.id = 'ns-css';
    s.textContent = `
.ns-host{position:relative;width:100%;height:100%;min-height:520px;background:#000;overflow:hidden;display:flex;flex-direction:column}
.ns-cv{display:block;width:100%;flex:1;min-height:0;cursor:none}
.ns-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.ns-hud{position:absolute;top:0;left:0;right:0;padding:10px 14px;display:flex;align-items:center;gap:12px;background:linear-gradient(to bottom,rgba(0,0,0,.6),transparent)}
.ns-hud-score{font-size:1.1rem;font-weight:900;color:#00ffff;font-family:monospace;text-shadow:0 0 10px #00ffff;flex:1}
.ns-hud-wave{font-size:.8rem;color:#a855f7;font-weight:700;text-shadow:0 0 8px #a855f7}
.ns-hud-lives{display:flex;gap:4px;align-items:center}
.ns-hud-combo{font-size:.8rem;color:#ffdd00;font-weight:700;text-shadow:0 0 8px #ffdd00;min-width:54px;text-align:right}
.ns-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 40%,#0d0028 0%,#000 75%);z-index:10}
.ns-title{font-size:2rem;font-weight:900;background:linear-gradient(120deg,#00ffff,#a855f7,#ff00ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center;letter-spacing:.05em;line-height:1.1}
.ns-score-big{font-size:2.4rem;font-weight:900;color:#a855f7;text-shadow:0 0 20px rgba(168,85,247,.6);font-family:monospace}
.ns-stats-row{display:flex;gap:24px;font-size:.8rem;color:#555}
.ns-stat-item{display:flex;flex-direction:column;align-items:center;gap:2px}
.ns-stat-val{font-size:1rem;font-weight:700;color:#a855f7}
.ns-play-btn{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:12px;padding:14px 40px;font-size:1.1rem;font-weight:700;cursor:pointer;pointer-events:all;box-shadow:0 0 24px rgba(168,85,247,.4);transition:transform .15s}
.ns-play-btn:hover{transform:scale(1.05)}
.ns-tip{font-size:.75rem;color:#333;text-align:center;max-width:240px;line-height:1.5}
.ns-hi{font-size:.8rem;color:#555}
.ns-boss-bar{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:min(340px,80%);pointer-events:none}
.ns-boss-lbl{font-size:.65rem;color:#ff3333;text-align:center;letter-spacing:.15em;text-transform:uppercase;text-shadow:0 0 8px #ff3333;margin-bottom:3px}
.ns-boss-track{height:8px;background:rgba(255,0,0,.12);border-radius:4px;border:1px solid rgba(255,51,51,.3);overflow:hidden}
.ns-boss-fill{height:100%;background:linear-gradient(90deg,#ff3333,#ff6666);border-radius:4px;transition:width .2s}
.ns-power-badge{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);font-size:.75rem;color:#ffdd00;background:rgba(0,0,0,.7);padding:4px 14px;border-radius:20px;border:1px solid rgba(255,221,0,.3);text-shadow:0 0 8px #ffdd00;pointer-events:none;animation:ns-fade-badge 2s ease forwards}
@keyframes ns-fade-badge{0%{opacity:0;transform:translateX(-50%) translateY(8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1}100%{opacity:0}}`;
    document.head.appendChild(s);
  }

  function init(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  function showMenu() {
    const hi = localStorage.getItem('ns-hi') || 0;
    root.innerHTML = `<div class="ns-host"><div class="ns-overlay">
      <div style="font-size:3rem;filter:drop-shadow(0 0 20px #a855f7)">🚀</div>
      <div class="ns-title">Neon Space<br>Shooter</div>
      <div class="ns-hi">Recorde: ${hi} pts</div>
      <button class="ns-play-btn" id="ns-start">▶ Jogar</button>
      <div class="ns-tip">Move o rato / arrasta o dedo para voar<br>A tua nave dispara automaticamente</div>
    </div></div>`;
    root.querySelector('#ns-start').addEventListener('click', startGame);
  }

  function startGame() {
    root.innerHTML = `<div class="ns-host">
      <canvas class="ns-cv" id="ns-cv"></canvas>
      <div class="ns-ui">
        <div class="ns-hud">
          <div class="ns-hud-score" id="ns-score">0</div>
          <div class="ns-hud-wave" id="ns-wave">WAVE 1</div>
          <div class="ns-hud-lives" id="ns-lives"></div>
          <div class="ns-hud-combo" id="ns-combo"></div>
        </div>
      </div>
    </div>`;
    cv = root.querySelector('#ns-cv');
    cx = cv.getContext('2d');
    resize(); window.addEventListener('resize', resize);
    G = newG(); setupControls();
    raf = requestAnimationFrame(loop);
  }

  function resize() {
    W = cv.offsetWidth || 400; H = cv.offsetHeight || 520;
    cv.width = W; cv.height = H;
    if (G) { G.px = W / 2; }
    mx = W / 2; my = H * 0.8;
  }

  function newG() {
    return {
      running: true, score: 0, combo: 1, maxCombo: 1, wave: 1,
      lives: 3, shield: 0, weapon: 'normal', weaponTimer: 0,
      px: W/2, py: H*0.82, pvx: 0, pvy: 0,
      invTimer: 0, fireTimer: 0,
      bullets: [], eBullets: [], enemies: [], parts: [], powerups: [],
      boss: null, bossActive: false,
      waveTimer: 0, spawnTimer: 0, spawnCount: 0, spawnMax: 0, waveDone: false,
      stars: Array.from({length:120}, () => ({
        x: Math.random()*999, y: Math.random()*999,
        s: Math.random()*2+.5, sp: Math.random()*2+.5, br: Math.random()
      })),
      hiScore: +localStorage.getItem('ns-hi') || 0,
      killCount: 0, lastKillTime: 0
    };
  }

  let lastTs = 0;
  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05); lastTs = ts;
    if (G.running) { update(dt); render(); raf = requestAnimationFrame(loop); }
  }

  function update(dt) {
    G.invTimer = Math.max(0, G.invTimer - dt);
    G.fireTimer = Math.max(0, G.fireTimer - dt);
    if (G.weaponTimer > 0) { G.weaponTimer -= dt; if (G.weaponTimer <= 0) G.weapon = 'normal'; }

    // Player movement (smooth follow)
    const dx = mx - G.px, dy = my - G.py;
    G.px += dx * 8 * dt; G.py += dy * 8 * dt;
    G.px = Math.max(16, Math.min(W-16, G.px));
    G.py = Math.max(60, Math.min(H-20, G.py));

    // Auto fire
    const fireRate = G.weapon === 'rapid' ? 0.12 : 0.32;
    if (G.fireTimer <= 0) {
      spawnBullet();
      G.fireTimer = fireRate;
    }

    // Stars
    G.stars.forEach(s => { s.y += s.sp * dt * 80; if (s.y > H) { s.y = 0; s.x = Math.random()*W; } });

    // Bullets
    G.bullets = G.bullets.filter(b => {
      b.x += b.vx * dt; b.y += b.vy * dt;
      return b.y > -20 && b.x > -10 && b.x < W+10;
    });

    // Enemy bullets
    G.eBullets = G.eBullets.filter(b => {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H || b.y < -10 || b.x < -10 || b.x > W+10) return false;
      if (G.invTimer <= 0 && dist(b.x, b.y, G.px, G.py) < 14) {
        hitPlayer(); return false;
      }
      return true;
    });

    // Powerups
    G.powerups = G.powerups.filter(p => {
      p.y += 80 * dt; p.rot = (p.rot||0) + 2*dt;
      if (p.y > H+20) return false;
      if (dist(p.x, p.y, G.px, G.py) < 24) { applyPower(p.type); return false; }
      return true;
    });

    // Enemies
    spawnEnemies(dt);
    G.enemies.forEach(e => moveEnemy(e, dt));

    // Bullet-enemy collisions
    G.bullets.forEach((b, bi) => {
      G.enemies.forEach((e, ei) => {
        if (b._dead || e._dead) return;
        if (dist(b.x, b.y, e.x, e.y) < e.r + 4) {
          b._dead = true; e.hp -= b.dmg || 1;
          spawnHit(e.x, e.y, e.color);
          if (e.hp <= 0) { killEnemy(e, ei); }
        }
      });
      // Boss
      if (!b._dead && G.boss && G.bossActive) {
        if (dist(b.x, b.y, G.boss.x, G.boss.y) < G.boss.r) {
          b._dead = true; G.boss.hp--;
          spawnHit(G.boss.x + (Math.random()-0.5)*G.boss.r, G.boss.y + (Math.random()-0.5)*G.boss.r, '#ff3333');
          if (G.boss.hp <= 0) killBoss();
        }
      }
    });
    G.bullets = G.bullets.filter(b => !b._dead);
    G.enemies = G.enemies.filter(e => !e._dead);

    // Enemy-player collision
    G.enemies.forEach(e => {
      if (G.invTimer <= 0 && dist(e.x, e.y, G.px, G.py) < e.r + 12) hitPlayer();
    });

    // Boss update
    if (G.boss && G.bossActive) updateBoss(dt);

    // Particles
    G.parts = G.parts.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 40 * dt; // light gravity
      p.life -= dt; return p.life > 0;
    });

    // Wave management
    if (!G.bossActive && G.enemies.length === 0 && G.waveDone) {
      G.waveTimer += dt;
      if (G.waveTimer > 2) { nextWave(); }
    }

    // HUD update
    updateHUD();
  }

  function spawnBullet() {
    const spd = -620;
    if (G.weapon === 'spread') {
      [-12,0,12].forEach(dx => G.bullets.push({x:G.px+dx, y:G.py-10, vx:dx*8, vy:spd, dmg:1, color:'#00ffff'}));
    } else {
      G.bullets.push({x:G.px, y:G.py-10, vx:0, vy:spd, dmg:1, color:'#00ffff'});
    }
  }

  function spawnEnemies(dt) {
    if (G.bossActive || G.waveDone) return;
    G.spawnTimer -= dt;
    if (G.spawnTimer > 0 || G.spawnCount >= G.spawnMax) {
      if (G.spawnCount >= G.spawnMax && G.enemies.length === 0) G.waveDone = true;
      return;
    }
    G.spawnTimer = 0.6 - Math.min(0.45, G.wave * 0.04);
    G.spawnCount++;
    const types = ['basic','basic','zigzag','circle','fast'];
    const t = G.wave < 3 ? 'basic' : types[Math.floor(Math.random()*Math.min(G.wave+1, types.length))];
    spawnEnemy(t);
  }

  function spawnEnemy(type) {
    const x = 30 + Math.random() * (W - 60);
    const e = { x, y: -20, type, _dead: false, timer: 0, origX: x };
    if (type === 'basic')  { e.r=14; e.hp=1+Math.floor(G.wave/3); e.vx=0; e.vy=60+G.wave*8; e.color='#a855f7'; e.fireRate=0; }
    if (type === 'zigzag') { e.r=13; e.hp=2+Math.floor(G.wave/2); e.vx=80; e.vy=50+G.wave*6; e.color='#ff00ff'; e.fireRate=3; e.ft=0; }
    if (type === 'circle') { e.r=15; e.hp=3+G.wave; e.vx=0; e.vy=30; e.color='#ff6600'; e.fireRate=2; e.ft=0; e.angle=0; }
    if (type === 'fast')   { e.r=10; e.hp=1; e.vx=0; e.vy=180+G.wave*12; e.color='#00ff88'; e.fireRate=0; }
    G.enemies.push(e);
  }

  function moveEnemy(e, dt) {
    e.timer += dt;
    if (e.type === 'basic' || e.type === 'fast') {
      e.y += e.vy * dt;
    } else if (e.type === 'zigzag') {
      e.x += Math.sin(e.timer * 2.5) * 90 * dt;
      e.y += e.vy * dt;
      e.x = Math.max(16, Math.min(W-16, e.x));
      e.ft -= dt;
      if (e.ft <= 0 && e.y > 0) { fireAtPlayer(e); e.ft = e.fireRate; }
    } else if (e.type === 'circle') {
      e.angle += dt * 2;
      e.x = e.origX + Math.cos(e.angle) * 60;
      e.y += e.vy * dt;
      e.ft -= dt;
      if (e.ft <= 0 && e.y > 0) { fireAtPlayer(e); e.ft = e.fireRate; }
    }
    if (e.y > H + 20) { e._dead = true; G.combo = 1; }
  }

  function fireAtPlayer(e) {
    const dx = G.px - e.x, dy = G.py - e.y;
    const l = Math.sqrt(dx*dx+dy*dy) || 1;
    const spd = 180;
    G.eBullets.push({ x:e.x, y:e.y, vx:dx/l*spd, vy:dy/l*spd, color:'#ff4444' });
  }

  function killEnemy(e) {
    e._dead = true;
    G.killCount++;
    const now = performance.now();
    if (now - G.lastKillTime < 1200) G.combo = Math.min(16, G.combo + 1);
    else G.combo = 1;
    G.lastKillTime = now;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    const pts = (10 + G.wave * 5) * G.combo;
    G.score += pts;
    spawnExplosion(e.x, e.y, e.color);
    if (Math.random() < 0.12 + G.wave * 0.01) spawnPower(e.x, e.y);
    floatScore(e.x, e.y, `+${pts}`);
  }

  function hitPlayer() {
    if (G.invTimer > 0) return;
    if (G.shield > 0) { G.shield = 0; G.invTimer = 1.5; spawnExplosion(G.px, G.py, '#00ffff'); return; }
    G.lives--; G.invTimer = 2; G.combo = 1;
    spawnExplosion(G.px, G.py, '#ffffff');
    if (G.lives <= 0) { setTimeout(gameOver, 400); }
  }

  function applyPower(type) {
    showPowerBadge(type);
    if (type === 'shield') { G.shield = 1; }
    if (type === 'spread') { G.weapon = 'spread'; G.weaponTimer = 8; }
    if (type === 'rapid')  { G.weapon = 'rapid';  G.weaponTimer = 6; }
    if (type === 'bomb')   { G.enemies.forEach(e => killEnemy(e)); }
  }

  function showPowerBadge(type) {
    const el = root.querySelector('.ns-ui');
    const old = el?.querySelector('.ns-power-badge');
    if (old) old.remove();
    const map = {shield:'🛡️ Shield Active', spread:'💥 Spread Shot', rapid:'⚡ Rapid Fire', bomb:'💣 Bomb!'};
    if (!el) return;
    const d = document.createElement('div'); d.className = 'ns-power-badge';
    d.textContent = map[type] || type;
    el.appendChild(d); setTimeout(() => d.remove(), 2100);
  }

  function spawnPower(x, y) {
    const types = ['shield','spread','rapid','bomb'];
    G.powerups.push({ x, y, type: types[Math.floor(Math.random()*types.length)], rot: 0 });
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 18; i++) {
      const a = (i/18)*Math.PI*2, spd = 80+Math.random()*120;
      G.parts.push({ x, y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, life:0.5+Math.random()*0.4, color, size:2+Math.random()*4 });
    }
    G.parts.push({ x, y, vx:0, vy:0, life:0.35, color:'#ffffff', size:20, ring:true, maxLife:0.35 });
  }

  function spawnHit(x, y, color) {
    for (let i=0; i<6; i++) {
      const a = Math.random()*Math.PI*2, spd = 40+Math.random()*60;
      G.parts.push({ x, y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, life:0.25, color, size:2 });
    }
  }

  function floatScore(x, y, text) {
    G.parts.push({ x, y, vx:0, vy:-50, life:1, color:'#ffdd00', size:13, text, maxLife:1 });
  }

  function nextWave() {
    G.wave++; G.waveDone = false; G.waveTimer = 0; G.spawnCount = 0;
    G.spawnMax = 5 + G.wave * 4; G.spawnTimer = 1.5;
    if (G.wave % 5 === 0) spawnBoss();
    updateHUD();
  }

  function spawnBoss() {
    const hp = 30 + G.wave * 8;
    G.boss = { x: W/2, y: 80, vx: 80, vy: 0, r: 38, hp, maxHp: hp, timer: 0, phase: 0, ft: 0 };
    G.bossActive = true;
  }

  function updateBoss(dt) {
    const b = G.boss;
    b.timer += dt;
    b.x += b.vx * dt;
    if (b.x < 50 || b.x > W-50) b.vx *= -1;
    b.y = 80 + Math.sin(b.timer * 1.2) * 30;
    b.ft -= dt;
    if (b.ft <= 0) {
      // Boss fire pattern
      if (b.phase === 0) { for (let i=0;i<3;i++) { const a = Math.PI/2 + (i-1)*0.3; G.eBullets.push({x:b.x,y:b.y+b.r,vx:Math.cos(a)*140,vy:Math.sin(a)*140,color:'#ff3333'}); } b.ft = 1.2; }
      if (b.phase === 1) { for (let i=0;i<6;i++) { const a = (i/6)*Math.PI*2; G.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*120,vy:Math.sin(a)*120,color:'#ff6600'}); } b.ft = 0.8; }
      if (b.hp < b.maxHp/2 && b.phase < 2) b.phase = 2;
      if (b.phase === 2) { for (let i=0;i<8;i++) { const a = (i/8)*Math.PI*2+b.timer; G.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*150,vy:Math.sin(a)*150,color:'#ff00ff'}); } b.ft = 0.5; }
    }
    if (G.invTimer <= 0 && dist(b.x, b.y, G.px, G.py) < b.r + 12) hitPlayer();
    // Update boss bar
    let bar = root.querySelector('.ns-boss-bar');
    if (!bar) { bar = document.createElement('div'); bar.className = 'ns-boss-bar'; bar.innerHTML = `<div class="ns-boss-lbl">⚠ BOSS</div><div class="ns-boss-track"><div class="ns-boss-fill" id="ns-bf"></div></div>`; root.querySelector('.ns-ui').appendChild(bar); }
    const fill = root.querySelector('#ns-bf');
    if (fill) fill.style.width = Math.max(0, b.hp/b.maxHp*100) + '%';
  }

  function killBoss() {
    spawnExplosion(G.boss.x, G.boss.y, '#ff3333');
    spawnExplosion(G.boss.x-30, G.boss.y+20, '#ff6600');
    spawnExplosion(G.boss.x+30, G.boss.y-20, '#ffdd00');
    G.score += 500 * G.wave;
    floatScore(G.boss.x, G.boss.y, `+${500*G.wave} BOSS!`);
    G.boss = null; G.bossActive = false;
    root.querySelector('.ns-boss-bar')?.remove();
    G.waveDone = true;
    G.spawnCount = G.spawnMax;
  }

  function updateHUD() {
    const sc = root.querySelector('#ns-score'); if (sc) sc.textContent = G.score;
    const wv = root.querySelector('#ns-wave');  if (wv) wv.textContent = `WAVE ${G.wave}`;
    const lv = root.querySelector('#ns-lives'); if (lv) lv.innerHTML = Array.from({length:G.lives}).map(()=>'<span style="font-size:.9rem">❤️</span>').join('') + (G.shield?'<span style="font-size:.9rem;filter:drop-shadow(0 0 4px #00ffff)">🛡️</span>':'');
    const cb = root.querySelector('#ns-combo');  if (cb) cb.textContent = G.combo > 1 ? `×${G.combo}` : '';
  }

  function gameOver() {
    G.running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (G.score > G.hiScore) { localStorage.setItem('ns-hi', G.score); G.hiScore = G.score; }
    const hi = localStorage.getItem('ns-hi') || 0;
    root.innerHTML = `<div class="ns-host"><div class="ns-overlay">
      <div style="font-size:2.5rem">💥</div>
      <div class="ns-title" style="font-size:1.6rem">Fim de Jogo</div>
      <div class="ns-score-big">${G.score}</div>
      <div class="ns-stats-row">
        <div class="ns-stat-item"><span class="ns-stat-val">Vaga ${G.wave}</span><span>alcançada</span></div>
        <div class="ns-stat-item"><span class="ns-stat-val">${G.killCount}</span><span>inimigos</span></div>
        <div class="ns-stat-item"><span class="ns-stat-val">×${G.maxCombo}</span><span>combo máx.</span></div>
      </div>
      <div class="ns-hi">Recorde: ${hi} pts</div>
      <button class="ns-play-btn" id="ns-retry">🔄 Jogar de Novo</button>
      <button style="background:transparent;border:1px solid #333;color:#555;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:.8rem" id="ns-menu">Menu</button>
    </div></div>`;
    root.querySelector('#ns-retry').addEventListener('click', startGame);
    root.querySelector('#ns-menu').addEventListener('click', showMenu);
  }

  /* ── RENDER ──────────────────────────────── */
  function render() {
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#000011'; cx.fillRect(0, 0, W, H);
    drawStars(); drawPowerups(); drawBoss();
    drawEnemies(); drawPlayer(); drawBullets(); drawParticles();
  }

  function glow(color, blur) { cx.shadowColor = color; cx.shadowBlur = blur; }
  function noGlow() { cx.shadowBlur = 0; }

  function drawStars() {
    G.stars.forEach(s => {
      const a = 0.3 + s.br * 0.7;
      cx.fillStyle = `rgba(255,255,255,${a})`;
      cx.beginPath(); cx.arc(s.x % W, s.y % H, s.s, 0, Math.PI*2); cx.fill();
    });
  }

  function drawPlayer() {
    const { px, py, invTimer, shield } = G;
    if (invTimer > 0 && Math.floor(invTimer * 10) % 2 === 0) return;
    cx.save();
    cx.translate(px, py);
    if (shield) { glow('#00ffff', 20); cx.strokeStyle = 'rgba(0,255,255,.4)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, 22, 0, Math.PI*2); cx.stroke(); }
    glow('#00ffff', 14);
    cx.fillStyle = '#00ffff'; cx.beginPath();
    cx.moveTo(0, -18); cx.lineTo(-12, 10); cx.lineTo(0, 6); cx.lineTo(12, 10); cx.closePath(); cx.fill();
    glow('#ffffff', 8); cx.fillStyle = '#ffffff';
    cx.beginPath(); cx.moveTo(0,-14); cx.lineTo(-5,4); cx.lineTo(0,2); cx.lineTo(5,4); cx.closePath(); cx.fill();
    // Thrust
    glow('#a855f7', 16); cx.fillStyle = '#a855f7';
    const th = 6 + Math.random() * 8;
    cx.beginPath(); cx.moveTo(-6,8); cx.lineTo(6,8); cx.lineTo(0,8+th); cx.closePath(); cx.fill();
    noGlow(); cx.restore();
  }

  function drawEnemies() {
    G.enemies.forEach(e => {
      cx.save(); cx.translate(e.x, e.y);
      glow(e.color, 12);
      cx.fillStyle = e.color;
      if (e.type === 'basic') {
        cx.beginPath(); cx.moveTo(0,-e.r); cx.lineTo(e.r*.7,e.r*.7); cx.lineTo(0,e.r*.3); cx.lineTo(-e.r*.7,e.r*.7); cx.closePath(); cx.fill();
      } else if (e.type === 'zigzag') {
        for (let i=0;i<6;i++) { const a=i*Math.PI/3; cx.beginPath(); cx.moveTo(0,0); cx.lineTo(Math.cos(a)*e.r,Math.sin(a)*e.r); cx.stroke(); }
        cx.beginPath(); for(let i=0;i<6;i++){const a=i*Math.PI/3;i===0?cx.moveTo(Math.cos(a)*e.r,Math.sin(a)*e.r):cx.lineTo(Math.cos(a)*e.r,Math.sin(a)*e.r);} cx.closePath(); cx.fill();
      } else if (e.type === 'circle') {
        cx.beginPath(); cx.arc(0,0,e.r,0,Math.PI*2); cx.fill();
        cx.fillStyle = '#000'; cx.beginPath(); cx.arc(0,0,e.r*.5,0,Math.PI*2); cx.fill();
        cx.fillStyle = e.color; cx.beginPath(); cx.arc(0,0,e.r*.2,0,Math.PI*2); cx.fill();
      } else {
        cx.beginPath(); cx.moveTo(0,-e.r); cx.lineTo(e.r,0); cx.lineTo(0,e.r); cx.lineTo(-e.r,0); cx.closePath(); cx.fill();
      }
      // HP bar
      if (e.hp > 1) {
        cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(-e.r,-e.r-10,e.r*2,4);
        cx.fillStyle = e.color; cx.fillRect(-e.r,-e.r-10,e.r*2*(e.hp/(1+Math.floor(G.wave/3)+(e.type==='circle'?3:e.type==='zigzag'?2:0))),4);
      }
      noGlow(); cx.restore();
    });
  }

  function drawBoss() {
    if (!G.boss) return;
    const b = G.boss;
    cx.save(); cx.translate(b.x, b.y);
    glow('#ff3333', 24);
    cx.fillStyle = '#cc0000';
    cx.beginPath();
    for (let i=0;i<8;i++) { const a=i*Math.PI/4, r=i%2===0?b.r:b.r*.6; cx.lineTo(Math.cos(a)*r,Math.sin(a)*r); }
    cx.closePath(); cx.fill();
    glow('#ff6600', 14); cx.fillStyle = '#ff6600';
    cx.beginPath(); cx.arc(0, 0, b.r*.5, 0, Math.PI*2); cx.fill();
    glow('#ffffff', 10); cx.fillStyle = '#ff3333';
    cx.beginPath(); cx.arc(0, 0, b.r*.2, 0, Math.PI*2); cx.fill();
    noGlow(); cx.restore();
  }

  function drawBullets() {
    G.bullets.forEach(b => {
      glow(b.color, 8);
      cx.strokeStyle = b.color; cx.lineWidth = 3;
      cx.beginPath(); cx.moveTo(b.x, b.y); cx.lineTo(b.x+b.vx*.04, b.y+b.vy*.04); cx.stroke();
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(b.x, b.y, 2.5, 0, Math.PI*2); cx.fill();
    });
    G.eBullets.forEach(b => {
      glow(b.color, 10);
      cx.fillStyle = b.color; cx.beginPath(); cx.arc(b.x, b.y, 4, 0, Math.PI*2); cx.fill();
    });
    noGlow();
  }

  function drawPowerups() {
    G.powerups.forEach(p => {
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot||0);
      const map = {shield:'🛡️',spread:'💥',rapid:'⚡',bomb:'💣'};
      cx.font = '20px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      glow('#ffdd00', 16); cx.fillText(map[p.type]||'⭐', 0, 0);
      noGlow(); cx.restore();
    });
  }

  function drawParticles() {
    G.parts.forEach(p => {
      const a = Math.min(1, p.life / (p.maxLife || 0.5));
      if (p.text) {
        cx.globalAlpha = a; cx.fillStyle = p.color;
        cx.font = `bold ${p.size}px sans-serif`; cx.textAlign = 'center';
        glow(p.color, 8); cx.fillText(p.text, p.x, p.y); noGlow();
        cx.globalAlpha = 1; return;
      }
      if (p.ring) {
        const r = (1 - a) * 40 + 5;
        glow(p.color, 10);
        cx.strokeStyle = `rgba(255,255,255,${a})`;
        cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y, r, 0, Math.PI*2); cx.stroke();
        noGlow(); return;
      }
      glow(p.color, 6);
      cx.globalAlpha = a; cx.fillStyle = p.color;
      cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, Math.PI*2); cx.fill();
      cx.globalAlpha = 1; noGlow();
    });
  }

  function setupControls() {
    const host = root.querySelector('.ns-host');
    host.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    host.addEventListener('touchstart', e => { e.preventDefault(); touching = true; const t = e.touches[0]; const r = cv.getBoundingClientRect(); mx = t.clientX - r.left; my = t.clientY - r.top; }, {passive:false});
    host.addEventListener('touchmove',  e => { e.preventDefault(); const t = e.touches[0]; const r = cv.getBoundingClientRect(); mx = t.clientX - r.left; my = t.clientY - r.top; }, {passive:false});
    host.addEventListener('touchend', () => touching = false);
  }

  function dist(ax, ay, bx, by) { const dx=ax-bx,dy=ay-by; return Math.sqrt(dx*dx+dy*dy); }

  // Init wave
  function initWave() { G.spawnMax = 5 + G.wave * 4; G.spawnTimer = 1; G.spawnCount = 0; G.waveDone = false; }

  // Override newG to include wave init
  const _newG = newG;
  function newG2() { const g = _newG(); g.spawnMax = 9; g.spawnTimer = 1.2; return g; }

  function init2(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  return { init: init2 };
})();
