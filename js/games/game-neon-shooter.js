const NeonShooterGame = (function () {
  'use strict';

  let root, cv, cx, raf, W, H, G;
  let mx = 200, my = 400, touching = false;

  /* UI strings live in games/neon-shooter/i18n.json (offline fallback below). */
  const FB_I18N = {
    pt: { record:'Recorde', pts:'pts', play:'▶ Jogar', tip:'Move o rato / arrasta o dedo para voar<br>A tua nave dispara automaticamente', gameOver:'Fim de Jogo', wave:'Vaga', reached:'alcançada', enemies:'inimigos', maxCombo:'combo máx.', retry:'🔄 Jogar de Novo', menu:'Menu', paused:'Pausa', resume:'▶ Continuar' },
    en: { record:'Best', pts:'pts', play:'▶ Play', tip:'Move the mouse / drag to fly<br>Your ship fires automatically', gameOver:'Game Over', wave:'Wave', reached:'reached', enemies:'enemies', maxCombo:'max combo', retry:'🔄 Play Again', menu:'Menu', paused:'Paused', resume:'▶ Resume' },
  };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));

  function injectCSS() {
    if (document.getElementById('ns-css')) return;
    const s = document.createElement('style'); s.id = 'ns-css';
    s.textContent = `
.ns-host{position:relative;width:100%;max-width:720px;margin:0 auto;height:min(760px,calc(100dvh - 170px));min-height:480px;background:#000;overflow:hidden;display:flex;flex-direction:column;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.45);border:1px solid rgba(168,85,247,.18)}
.ns-cv{display:block;width:100%;flex:1;min-height:0;cursor:none}
.ns-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.ns-hud{position:absolute;top:0;left:0;right:0;padding:10px 14px;display:flex;align-items:center;gap:12px;background:linear-gradient(to bottom,rgba(0,0,0,.6),transparent)}
.ns-hud-score{font-size:1.1rem;font-weight:900;color:#00ffff;font-family:monospace;text-shadow:0 0 10px #00ffff;flex:1}
.ns-hud-wave{font-size:.8rem;color:#a855f7;font-weight:700;text-shadow:0 0 8px #a855f7}
.ns-hud-lives{display:flex;gap:4px;align-items:center}
.ns-hud-combo{font-size:.8rem;color:#ffdd00;font-weight:700;text-shadow:0 0 8px #ffdd00;min-width:54px;text-align:right}
.ns-pbtn{pointer-events:all;width:34px;height:34px;border-radius:10px;border:1px solid rgba(168,85,247,.45);background:rgba(10,0,30,.6);color:#e9d5ff;cursor:pointer;font-size:.9rem}
.ns-pause{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,12,.72);backdrop-filter:blur(3px)}
.ns-pause b{font-size:1.6rem;color:#e9d5ff;letter-spacing:.08em}
.ns-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 40%,#0d0028 0%,#000 75%);z-index:10}
.ns-title{font-size:2rem;font-weight:900;background:linear-gradient(120deg,#00ffff,#a855f7,#ff00ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center;letter-spacing:.05em;line-height:1.1}
.ns-score-big{font-size:2.4rem;font-weight:900;color:#a855f7;text-shadow:0 0 20px rgba(168,85,247,.6);font-family:monospace}
.ns-stats-row{display:flex;gap:24px;font-size:.8rem;color:#555}
.ns-stat-item{display:flex;flex-direction:column;align-items:center;gap:2px}
.ns-stat-val{font-size:1rem;font-weight:700;color:#a855f7}
.ns-play-btn{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:12px;padding:14px 40px;font-size:1.1rem;font-weight:700;cursor:pointer;pointer-events:all;box-shadow:0 0 24px rgba(168,85,247,.4);transition:transform .15s}
.ns-play-btn:hover{transform:scale(1.05)}
.ns-tip{font-size:.75rem;color:#7c7c9c;text-align:center;max-width:240px;line-height:1.5}
.ns-hi{font-size:.8rem;color:#8b8ba7}
.ns-diff{display:flex;gap:6px;padding:4px;border-radius:12px;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.25)}
.ns-diff button{border:0;border-radius:9px;padding:7px 14px;background:transparent;color:#c4b5fd;font-weight:700;cursor:pointer;font-size:.85rem}
.ns-diff button.on{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;box-shadow:0 0 14px rgba(168,85,247,.45)}
.ns-diff button:focus-visible{outline:2px solid #22d3ee;outline-offset:2px}
.ns-boss-bar{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:min(340px,80%);pointer-events:none}
.ns-boss-lbl{font-size:.65rem;color:#ff3333;text-align:center;letter-spacing:.15em;text-transform:uppercase;text-shadow:0 0 8px #ff3333;margin-bottom:3px}
.ns-boss-track{height:8px;background:rgba(255,0,0,.12);border-radius:4px;border:1px solid rgba(255,51,51,.3);overflow:hidden}
.ns-boss-fill{height:100%;background:linear-gradient(90deg,#ff3333,#ff6666);border-radius:4px;transition:width .2s}
.ns-power-badge{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);font-size:.75rem;color:#ffdd00;background:rgba(0,0,0,.7);padding:4px 14px;border-radius:20px;border:1px solid rgba(255,221,0,.3);text-shadow:0 0 8px #ffdd00;pointer-events:none;animation:ns-fade-badge 2s ease forwards}
@keyframes ns-fade-badge{0%{opacity:0;transform:translateX(-50%) translateY(8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1}100%{opacity:0}}`;
    document.head.appendChild(s);
  }

  function init(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  /* dificuldade: vidas, velocidade/cadência dos inimigos e ritmo das vagas */
  const DIFF = {
    easy:   { name: 'Fácil',   lives: 5, spd: .78, fire: 1.45, bullet: .8, spawn: 1.25, power: 1.4 },
    medium: { name: 'Médio',   lives: 3, spd: 1,   fire: 1,    bullet: 1,  spawn: 1,    power: 1 },
    hard:   { name: 'Difícil', lives: 2, spd: 1.22, fire: .72, bullet: 1.2, spawn: .82, power: .75 },
  };
  let diffKey = (() => { try { return localStorage.getItem('ns-diff') || 'medium'; } catch (e) { return 'medium'; } })();
  const DF = () => DIFF[diffKey] || DIFF.medium;
  const hiKey = () => diffKey === 'medium' ? 'ns-hi' : 'ns-hi-' + diffKey;
  function showMenu() {
    destroy3D();
    const hi = localStorage.getItem(hiKey()) || 0;
    root.innerHTML = `<div class="ns-host"><div class="ns-overlay">
      <div style="font-size:3rem;filter:drop-shadow(0 0 20px #a855f7)">🚀</div>
      <div class="ns-title">Neon Space<br>Shooter</div>
      <div class="ns-diff" role="radiogroup" aria-label="Dificuldade">${Object.keys(DIFF).map(k => `<button type="button" role="radio" aria-checked="${k === diffKey}" data-d="${k}" class="${k === diffKey ? 'on' : ''}">${DIFF[k].name}</button>`).join('')}</div>
      <div class="ns-hi">${t('record')}: ${hi} ${t('pts')}</div>
      <button class="ns-play-btn" id="ns-start">${t('play')}</button>
      <div class="ns-tip">${t('tip')}</div>
    </div></div>`;
    root.querySelector('#ns-start').addEventListener('click', startGame);
    root.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { diffKey = b.dataset.d; try { localStorage.setItem('ns-diff', diffKey); } catch (e) {} showMenu(); }));
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
          <button class="ns-pbtn" id="ns-pause" aria-label="Pausa">⏸</button>
        </div>
      </div>
    </div>`;
    cv = root.querySelector('#ns-cv');
    cx = cv.getContext('2d');
    cancelAnimationFrame(raf);
    G = null;
    resize(); window.removeEventListener('resize', resize); window.addEventListener('resize', resize);
    /* newG2: a 1.ª vaga já tem inimigos (antes spawnMax era 0 e a vaga 1 ficava vazia) */
    destroy3D();
    G = newG2(); setupControls();
    const g0 = G;
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { if (G === g0 && G.running) try { build3D(); } catch (e) { console.warn('[neon] 3D falhou', e); } }).catch(() => {});
    root.querySelector('#ns-pause').addEventListener('click', () => pause(true));
    lastTs = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* pausa: botão, Esc/P, e sozinha quando o jogo sai do ecrã (outra secção,
     outro separador) — antes continuava a correr e perdias vidas sem ver */
  function pause(on) {
    if (!G || !G.running) return;
    G.paused = on;
    const ui = root.querySelector('.ns-ui'); if (!ui) return;
    ui.querySelector('.ns-pause')?.remove();
    if (on) {
      const d = document.createElement('div'); d.className = 'ns-pause';
      d.innerHTML = `<b>${t('paused')}</b><button class="ns-play-btn" id="ns-resume">${t('resume')}</button>`;
      ui.appendChild(d);
      d.querySelector('#ns-resume').addEventListener('click', () => pause(false));
    } else lastTs = performance.now();
  }
  document.addEventListener('keydown', e => {
    if (!G || !G.running || !root || !root.getClientRects().length) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); pause(!G.paused); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.running && !G.paused) pause(true); });

  function resize() {
    if (!cv || !cv.isConnected) return;
    const w = cv.offsetWidth || 400, h = cv.offsetHeight || 520, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (G && w === W && h === H) return;
    W = w; H = h;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);          /* nítido em ecrãs retina */
    if (G) { G.px = Math.min(G.px, W - 16); G.py = Math.min(G.py, H - 20); }
    else { mx = W / 2; my = H * 0.8; }
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
    if (!G.running) return;
    if (!root.isConnected) return;
    if (!root.getClientRects().length && !G.paused) pause(true);
    if (!G.paused) { if (cv.offsetWidth !== W || cv.offsetHeight !== H) resize(); update(dt); render(); }
    raf = requestAnimationFrame(loop);
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
    G.spawnTimer = (0.6 - Math.min(0.45, G.wave * 0.04)) * DF().spawn;
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
    e.vy *= DF().spd; e.vx *= DF().spd; if (e.fireRate) e.fireRate *= DF().fire;
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
    const spd = 180 * DF().bullet;
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
    if (Math.random() < (0.12 + G.wave * 0.01) * DF().power) spawnPower(e.x, e.y);
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
    const map = {shield:'🛡️ Escudo ativo', spread:'💥 Tiro triplo', rapid:'⚡ Tiro rápido', bomb:'💣 Bomba!'};
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
    const wv = root.querySelector('#ns-wave');  if (wv) wv.textContent = `${t('wave').toUpperCase()} ${G.wave}`;
    const lv = root.querySelector('#ns-lives'); if (lv) lv.innerHTML = Array.from({length:G.lives}).map(()=>'<span style="font-size:.9rem">❤️</span>').join('') + (G.shield?'<span style="font-size:.9rem;filter:drop-shadow(0 0 4px #00ffff)">🛡️</span>':'');
    const cb = root.querySelector('#ns-combo');  if (cb) cb.textContent = G.combo > 1 ? `×${G.combo}` : '';
  }

  function gameOver() {
    G.running = false;
    destroy3D();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (G.score > G.hiScore) { localStorage.setItem(hiKey(), G.score); G.hiScore = G.score; }
    if (typeof GameProgress !== 'undefined') {
      try { GameProgress.record('neon-shooter', { score: G.score, mode: diffKey, meta: { wave: G.wave, diff: diffKey } }); } catch (e) {}
    }
    const hi = localStorage.getItem(hiKey()) || 0;
    root.innerHTML = `<div class="ns-host"><div class="ns-overlay">
      <div style="font-size:2.5rem">💥</div>
      <div class="ns-title" style="font-size:1.6rem">${t('gameOver')}</div>
      <div class="ns-score-big">${G.score}</div>
      <div class="ns-stats-row">
        <div class="ns-stat-item"><span class="ns-stat-val">${t('wave')} ${G.wave}</span><span>${t('reached')}</span></div>
        <div class="ns-stat-item"><span class="ns-stat-val">${G.killCount}</span><span>${t('enemies')}</span></div>
        <div class="ns-stat-item"><span class="ns-stat-val">×${G.maxCombo}</span><span>${t('maxCombo')}</span></div>
      </div>
      <div class="ns-hi">${t('record')}: ${hi} ${t('pts')}</div>
      <button class="ns-play-btn" id="ns-retry">${t('retry')}</button>
      <button style="background:transparent;border:1px solid #333;color:#555;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:.8rem" id="ns-menu">${t('menu')}</button>
    </div></div>`;
    root.querySelector('#ns-retry').addEventListener('click', startGame);
    root.querySelector('#ns-menu').addEventListener('click', showMenu);
  }

  /* ── RENDER ──────────────────────────────── */
  /* ════════════════════════════════════════════════════════════════
     3D — naves low-poly com luz e brilho aditivo, inimigos com volume
     (dardo, hexágono a rodar, anel, cristal), chefe com anel a girar,
     balas de plasma, campo de estrelas em profundidade e nebulosas.
     O plano z=0 coincide com o ecrã (o rato/dedo continua exato).
  ════════════════════════════════════════════════════════════════ */
  let R3 = null;
  function build3D() {
    const host = root.querySelector('.ns-host'); if (!host) return;
    const renderer = Arcade3D.attach(host);
    cv.style.position = 'relative'; cv.style.zIndex = '1';
    const { scene, sun } = Arcade3D.stdScene({ sky: '#c4b5fd', ground: '#0b0322', hemi: .85, sun: '#e0f2fe', sunI: 1.8, fillC: '#f0abfc', fillI: .6, shadow: false });
    const cam = new THREE.PerspectiveCamera(50, 1, 10, 6000);
    /* estrelas em 3 camadas de profundidade */
    const layers = [0, 1, 2].map(k => {
      const n = 160, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 2400; pos[i * 3 + 1] = (Math.random() - .5) * 2400; pos[i * 3 + 2] = -200 - k * 500 - Math.random() * 300; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: k ? '#c7d2fe' : '#ffffff', size: 2.6 - k * .6, transparent: true, opacity: .9 - k * .2, depthWrite: false }));
      scene.add(pts); return pts;
    });
    const neb = ['#7c3aed', '#db2777', '#0891b2'].map((c, i) => { const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: c, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); s2.scale.set(1400, 1400, 1); s2.position.set((i - 1) * 600, (i % 2 ? 1 : -1) * 300, -1400); scene.add(s2); return s2; });
    const pt = (() => { const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 256; const y = c2.getContext('2d'); const cols = ['#4c1d95', '#6d28d9', '#5b21b6', '#7c3aed', '#3b0764', '#a855f7', '#4c1d95']; let yy = 0; while (yy < 256) { const hgt = 8 + Math.random() * 30; y.fillStyle = cols[Math.floor(Math.random() * cols.length)]; y.fillRect(0, yy, 512, hgt); yy += hgt; } for (let i = 0; i < 40; i++) { y.strokeStyle = 'rgba(255,255,255,.06)'; y.lineWidth = 2 + Math.random() * 4; y.beginPath(); const by = Math.random() * 256; y.moveTo(0, by); for (let x = 0; x <= 512; x += 16) y.lineTo(x, by + Math.sin(x * .03 + i) * 4); y.stroke(); } y.fillStyle = 'rgba(244,114,182,.5)'; y.beginPath(); y.ellipse(330, 150, 34, 16, 0, 0, 6.3); y.fill(); const t2 = new THREE.CanvasTexture(c2); t2.colorSpace = THREE.SRGBColorSpace; return t2; })();
    const planet = new THREE.Mesh(new THREE.SphereGeometry(260, 40, 28), new THREE.MeshStandardMaterial({ map: pt, roughness: .85, emissive: '#1e1b4b', emissiveIntensity: .35 }));
    const atm = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#a78bfa', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); atm.scale.set(760, 760, 1); planet.add(atm);
    planet.position.set(700, -300, -1300); scene.add(planet);
    const ringP = new THREE.Mesh(new THREE.TorusGeometry(420, 26, 6, 60), new THREE.MeshBasicMaterial({ color: '#a78bfa', transparent: true, opacity: .25 })); ringP.rotation.x = 1.2; planet.add(ringP);
    /* jogador */
    const ship = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(9, 34, 6), new THREE.MeshStandardMaterial({ color: '#e0f2fe', metalness: .7, roughness: .22, flatShading: true }));
    ship.add(body);
    const wingS = new THREE.Shape(); wingS.moveTo(0, 8); wingS.lineTo(22, -12); wingS.lineTo(18, -16); wingS.lineTo(0, -8); wingS.lineTo(-18, -16); wingS.lineTo(-22, -12); wingS.lineTo(0, 8);
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingS, { depth: 3, bevelEnabled: true, bevelSize: .8, bevelThickness: .8, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: '#06b6d4', metalness: .5, roughness: .3, emissive: '#0e7490', emissiveIntensity: .5 }));
    wing.position.z = -1.5; ship.add(wing);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(4.2, 14, 10), new THREE.MeshStandardMaterial({ color: '#a855f7', emissive: '#7c3aed', emissiveIntensity: .8, roughness: .1 })); canopy.scale.set(1, 1.8, .9); canopy.position.set(0, 3, 4); ship.add(canopy);
    const flame = new THREE.Sprite(Arcade3D.glowSprite('#c084fc')); flame.position.set(0, -20, 0); ship.add(flame);
    const shieldM = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16), new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: .16, depthWrite: false })); ship.add(shieldM);
    ship.scale.setScalar(1.35); scene.add(ship);
    R3 = { renderer, scene, cam, layers, neb, planet, ship, flame, shieldM, pool: Arcade3D.pool(scene), host };
  }
  function destroy3D() {
    if (!R3) return;
    Arcade3D.disposeOwn(R3.scene); Arcade3D.detach();
    if (cv) { cv.style.position = ''; cv.style.zIndex = ''; }
    R3 = null;
  }

  function enemyModel(type, color) {
    /* 4 inimigos com silhueta própria (lê-se o tipo de relance): caça, drone, disco e intercetor */
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .35, metalness: .55, roughness: .3, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#1e1b2e', metalness: .7, roughness: .35, flatShading: true });
    const eye = c2 => new THREE.MeshBasicMaterial({ color: c2 });
    const ws = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelSize: .6, bevelThickness: .6, bevelSegments: 1 }); };
    if (type === 'basic') {
      /* caça: fuselagem, asas em flecha para trás (nariz para baixo, para o jogador), cabine vermelha, motores */
      const f = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 6), m); f.rotation.z = Math.PI; g.add(f);
      const w = new THREE.Mesh(ws([[0, -6], [17, 8], [15, 12], [0, 6], [-15, 12], [-17, 8]]), dark); w.position.z = -1.5; g.add(w);
      [-1, 1].forEach(sd => { const tip = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 3), m); tip.position.set(sd * 16, 9, 0); g.add(tip); const en = new THREE.Sprite(Arcade3D.glowSprite('#f472b6')); en.position.set(sd * 5, 14, 0); en.scale.set(12, 12, 1); g.add(en); });
      const ck = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), eye('#fb7185')); ck.scale.set(1, 1.6, .8); ck.position.set(0, -2, 4); g.add(ck);
    } else if (type === 'zigzag') {
      /* drone: hexágono com olho vermelho e 3 hélices em braços (roda) */
      const h = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 6, 6), m); h.rotation.x = Math.PI / 2; g.add(h);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 1.4, 6, 6), dark); g.add(ring);
      const e = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 10), eye('#ffffff')); e.position.z = 3.5; g.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), eye('#ef4444')); p.position.z = 7; g.add(p);
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, arm = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 2), dark); arm.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0); arm.rotation.z = a; g.add(arm); const rot = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, .6, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .45 })); rot.rotation.x = Math.PI / 2; rot.position.set(Math.cos(a) * 20, Math.sin(a) * 20, 1); g.add(rot); }
      g.userData.spin = true;
    } else if (type === 'circle') {
      /* disco voador: prato metálico, cúpula de vidro e anel de luzes a piscar */
      const d = new THREE.Mesh(new THREE.SphereGeometry(15, 20, 10), dark); d.scale.set(1, .32, 1); d.rotation.x = Math.PI / 2 - .5; g.add(d);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 1.6, 8, 28), m); rim.rotation.x = -.5; g.add(rim);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#a5f3fc', emissive: '#0891b2', emissiveIntensity: .6, transparent: true, opacity: .8, roughness: .05 })); dome.rotation.x = Math.PI / 2 - .5; dome.position.set(0, 1.5, 2.5); g.add(dome);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 5), eye(i % 2 ? '#fde047' : color)); l.position.set(Math.cos(a) * 14, Math.sin(a) * 14 * Math.cos(.5), Math.sin(a) * 14 * Math.sin(-.5) + 2); g.add(l); }
    } else {
      /* intercetor: agulha comprida com asas finas e rasto verde */
      const o = new THREE.Mesh(new THREE.ConeGeometry(4, 30, 4), m); o.rotation.z = Math.PI; g.add(o);
      const w = new THREE.Mesh(ws([[0, -2], [12, 10], [10, 12], [0, 6], [-10, 12], [-12, 10]]), m); w.position.z = -1.5; g.add(w);
      const tr = new THREE.Sprite(Arcade3D.glowSprite('#00ff88')); tr.position.set(0, 20, 0); tr.scale.set(12, 30, 1); g.add(tr);
    }
    const s2 = new THREE.Sprite(Arcade3D.glowSprite(color)); s2.scale.set(52, 52, 1); s2.material.opacity = .3; g.add(s2);
    return g;
  }
  function bossModel() {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#b91c1c', emissive: '#7f1d1d', emissiveIntensity: .6, metalness: .6, roughness: .3, flatShading: true });
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(30, 0), m); b.scale.set(1.3, .9, .7); g.add(b);
    const core = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: '#fb923c' })); core.position.z = 16; g.add(core); g.userData.core = core;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(46, 3, 8, 40), new THREE.MeshStandardMaterial({ color: '#ff6600', emissive: '#ff3300', emissiveIntensity: 1 })); g.add(ring); g.userData.ring = ring;
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 5), m); const a = i / 8 * Math.PI * 2; sp.position.set(Math.cos(a) * 40, Math.sin(a) * 30, 0); sp.rotation.z = a - Math.PI / 2; g.add(sp); }
    const s2 = new THREE.Sprite(Arcade3D.glowSprite('#ff3333')); s2.scale.set(220, 220, 1); s2.material.opacity = .5; g.add(s2);
    return g;
  }

  function render3D() {
    const R = R3, P = R.pool;
    Arcade3D.fit(R.host, R.cam);
    const X = x => x - W / 2, Y = y => H / 2 - y;
    const D = (H / 2) / Math.tan(R.cam.fov * Math.PI / 360);
    R.cam.position.set(0, 0, D); R.cam.lookAt(0, 0, 0); R.cam.far = D + 3000; R.cam.updateProjectionMatrix();
    const t = performance.now() / 1000;
    R.layers.forEach((l, k) => { l.position.y = -((t * (40 - k * 12)) % 1200) + 600; });
    R.planet.rotation.y = t * .05;
    /* jogador */
    const sh = R.ship;
    sh.visible = !(G.invTimer > 0 && Math.floor(G.invTimer * 10) % 2 === 0);
    sh.position.set(X(G.px), Y(G.py), 0);
    const vx = (mx - G.px);
    sh.rotation.set(-.5, U_clamp(vx * .01, -.7, .7), 0);
    R.flame.scale.setScalar(16 + Math.random() * 10);
    R.shieldM.visible = !!G.shield; R.shieldM.material.opacity = .12 + Math.sin(t * 6) * .05;
    P.begin();
    G.enemies.forEach(e => {
      const m = P.get('en:' + e.type, () => enemyModel(e.type, e.color));
      m.position.set(X(e.x), Y(e.y), 0);
      if (m.userData.spin) m.rotation.z = e.timer * 3; else m.rotation.set(-.4, Math.sin(e.timer * 3) * .5, 0);
    });
    if (G.boss) {
      const b = P.get('boss', bossModel), bb = G.boss;
      b.position.set(X(bb.x), Y(bb.y), 0); b.rotation.set(-.3, Math.sin(bb.timer) * .3, 0);
      b.userData.ring.rotation.z = bb.timer * 2; b.userData.core.scale.setScalar(1 + Math.sin(bb.timer * 8) * .15);
      b.scale.setScalar(bb.r / 38);
    }
    G.bullets.forEach(b => { const m = P.get('pb', () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 12, 4, 8), new THREE.MeshBasicMaterial({ color: '#e0ffff' })); g.add(c); const s2 = new THREE.Sprite(Arcade3D.glowSprite('#00ffff')); s2.scale.set(22, 34, 1); g.add(s2); return g; }); m.position.set(X(b.x), Y(b.y), 2); m.rotation.z = Math.atan2(b.vx, -b.vy); });
    G.eBullets.forEach(b => { const m = P.get('eb:' + b.color, () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff1f2' }))); const s2 = new THREE.Sprite(Arcade3D.glowSprite(b.color)); s2.scale.set(26, 26, 1); g.add(s2); return g; }); m.position.set(X(b.x), Y(b.y), 1); });
    G.powerups.forEach(p => { const m = P.get('pw:' + p.type, () => { const g = new THREE.Group(); const box = new THREE.Mesh(Arcade3D.roundBox(.3), new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#ca8a04', emissiveIntensity: .5, metalness: .4, roughness: .2, transparent: true, opacity: .55 })); box.scale.setScalar(24); g.add(box); const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.emojiTex({ shield: '🛡️', spread: '💥', rapid: '⚡', bomb: '💣' }[p.type] || '⭐', 64), depthTest: false })); ic.scale.set(20, 20, 1); ic.position.z = 14; g.add(ic); return g; }); m.position.set(X(p.x), Y(p.y), 0); m.children[0].rotation.set(t * 1.5, t * 2, 0); });
    P.end();
    R.renderer.render(R.scene, R.cam);
  }
  function U_clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function render() {
    if (R3) {
      cx.clearRect(0, 0, W, H);
      render3D();
      drawParticles();
      /* barras de vida dos inimigos por cima (2D) */
      G.enemies.forEach(e => { if (e.hp > 1) { const full = 1 + Math.floor(G.wave / 3) + (e.type === 'circle' ? 3 : e.type === 'zigzag' ? 2 : 0); cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(e.x - e.r, e.y - e.r - 14, e.r * 2, 4); cx.fillStyle = e.color; cx.fillRect(e.x - e.r, e.y - e.r - 14, e.r * 2 * Math.min(1, e.hp / full), 4); } });
      return;
    }
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
        cx.rotate(Math.PI);                 /* os inimigos descem: nariz para baixo */
        cx.beginPath(); cx.moveTo(0,-e.r); cx.lineTo(e.r*.7,e.r*.7); cx.lineTo(0,e.r*.3); cx.lineTo(-e.r*.7,e.r*.7); cx.closePath(); cx.fill();
        cx.rotate(-Math.PI);
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
    cx.globalCompositeOperation = 'lighter';
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
      cx.globalAlpha = a; cx.fillStyle = p.color;
      cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, Math.PI*2); cx.fill();
      cx.globalAlpha = a * .25; cx.beginPath(); cx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI*2); cx.fill();
      cx.globalAlpha = 1;
    });
    cx.globalCompositeOperation = 'source-over';
  }

  function setupControls() {
    const host = root.querySelector('.ns-host');
    host.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    /* toque: arrasto relativo — a nave mexe-se como o dedo, sem ficar tapada por ele */
    let t0 = null;
    host.addEventListener('touchstart', e => {
      if (e.target.closest('button')) return;
      e.preventDefault(); touching = true; const t = e.touches[0];
      t0 = { x: t.clientX, y: t.clientY, sx: G ? G.px : mx, sy: G ? G.py : my };
    }, {passive:false});
    host.addEventListener('touchmove',  e => {
      if (!t0) return;
      e.preventDefault(); const t = e.touches[0];
      mx = Math.max(16, Math.min(W - 16, t0.sx + (t.clientX - t0.x) * 1.25));
      my = Math.max(60, Math.min(H - 20, t0.sy + (t.clientY - t0.y) * 1.25));
    }, {passive:false});
    host.addEventListener('touchend', () => { touching = false; t0 = null; });
  }

  function dist(ax, ay, bx, by) { const dx=ax-bx,dy=ay-by; return Math.sqrt(dx*dx+dy*dy); }

  // Init wave
  function initWave() { G.spawnMax = 5 + G.wave * 4; G.spawnTimer = 1; G.spawnCount = 0; G.waveDone = false; }

  // Override newG to include wave init
  const _newG = newG;
  function newG2() { const g = _newG(); g.spawnMax = 9; g.spawnTimer = 1.2; g.lives = DF().lives; g.hiScore = +localStorage.getItem(hiKey()) || 0; return g; }

  function init2(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  if (_has) {
    const apply = () => GameData.load('neon-shooter').then(d => {
      if (t.use) t.use(d.i18n);
      if (root) { try { cancelAnimationFrame(raf); } catch (e) {} showMenu(); }
    });
    apply();
    document.addEventListener('langchange', apply);
  }

  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('neon-shooter', [
      { id: 'ns.1k', name: 'Artilheiro',  icon: '🛸', desc: 'Faz 1000 pontos no Neon Shooter.', test: c => c.gameId === 'neon-shooter' && c.result.score >= 1000 },
      { id: 'ns.5k', name: 'Ás Espacial', icon: '🌌', desc: 'Faz 5000 pontos no Neon Shooter.', test: c => c.gameId === 'neon-shooter' && c.result.score >= 5000 },
    ]);
  }

  return { init: init2 };
})();
