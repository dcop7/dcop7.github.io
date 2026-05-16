const ShootingGame = (function () {
  'use strict';

  function init(root) {
    if (!root) return;

    root.innerHTML = `
      <div class="game-card" style="padding:.6rem">
        <div class="sg-hdr">
          <div class="sg-stat"><span class="sg-lbl">Score</span><span class="sg-val" id="sg-score">0</span></div>
          <div class="sg-stat"><span class="sg-lbl">Level</span><span class="sg-val" id="sg-level">1</span></div>
          <div class="sg-stat"><span class="sg-lbl">Lives</span><span class="sg-val" id="sg-lives">❤️❤️❤️</span></div>
          <button class="hf-new-btn" id="sg-pause" style="padding:.3rem .75rem;font-size:.72rem">⏸ Pausa</button>
        </div>
        <div style="position:relative">
          <canvas id="sg-canvas" style="display:block;border-radius:var(--radius-sm);cursor:none;touch-action:none;width:100%"></canvas>
          <div id="sg-overlay" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(4,8,16,.85);border-radius:var(--radius-sm)">
            <div id="sg-over-title" style="font-family:var(--font-head);font-size:1.6rem;font-weight:800;color:#60a5fa;text-shadow:0 0 20px #60a5fa">SPACE SHOOTER</div>
            <div id="sg-over-score" style="color:var(--muted);font-size:.85rem;margin:.4rem 0 .8rem"></div>
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:.8rem;text-align:center">Move with mouse / touch · Auto-fires · A/D or ← → keys</div>
            <button id="sg-start" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:.6rem 2rem;font-size:1rem;font-weight:700;cursor:pointer;box-shadow:0 0 20px rgba(99,102,241,.5)">🚀 Jogar</button>
          </div>
        </div>
      </div>`;

    const canvas = root.querySelector('#sg-canvas');
    const ctx = canvas.getContext('2d');
    let W, H, dpr;
    const STARS = [];

    // State
    let running = false, paused = false;
    let score = 0, lives = 3, level = 1;
    let player = null;
    let bullets = [], enemies = [], particles = [];
    let keys = {}, mouseX = null;
    let frameId = null, lastTime = 0;
    let spawnTimer = 1.2, shootTimer = 0, levelTimer = 0;
    let combo = 0, comboTimer = 0;
    let highScore = parseInt(localStorage.getItem('sg-hi') || '0');

    function resize() {
      dpr = window.devicePixelRatio || 1;
      W = Math.min(canvas.parentElement.clientWidth, 900);
      H = Math.min(500, window.innerHeight * 0.58);
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
      if (!STARS.length) initStars();
    }

    function initStars() {
      STARS.length = 0;
      for (let i = 0; i < 100; i++) {
        STARS.push({
          x: Math.random() * 1200,
          y: Math.random() * 700,
          r: Math.random() < 0.25 ? 1.8 : 0.9,
          speed: 18 + Math.random() * 55,
          a: 0.3 + Math.random() * 0.7,
        });
      }
    }

    // ── Entities ──
    function mkPlayer() {
      return { x: W / 2, y: H - 60, w: 28, h: 26, speed: 240, cooldown: 0, invincible: 0 };
    }

    function mkBullet(x, y, vx, vy, color, size, fromPlayer) {
      return { x, y, vx, vy, color, size: size || 4, fromPlayer: fromPlayer !== false, alive: true };
    }

    const ETYPES = {
      basic:   { w: 32, h: 26, hp: 1, maxHp: 1, speed: 65,  color: '#ef4444', score: 10, pattern: 'straight', shoots: false },
      fast:    { w: 20, h: 18, hp: 1, maxHp: 1, speed: 140, color: '#f97316', score: 20, pattern: 'zigzag',   shoots: false },
      tank:    { w: 44, h: 36, hp: 3, maxHp: 3, speed: 38,  color: '#8b5cf6', score: 50, pattern: 'straight', shoots: false },
      shooter: { w: 28, h: 26, hp: 2, maxHp: 2, speed: 48,  color: '#ec4899', score: 35, pattern: 'straight', shoots: true  },
      bomber:  { w: 36, h: 30, hp: 2, maxHp: 2, speed: 55,  color: '#fbbf24', score: 40, pattern: 'wave',     shoots: false },
    };

    function mkEnemy(x, type) {
      const t = { ...ETYPES[type] };
      return { x, y: -40, type, ...t, vx: 0, vy: t.speed, alive: true, tick: 0, shootCd: 2.5 };
    }

    function spawnParticles(x, y, color, count, spd) {
      const n = count || 12;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i / n) + Math.random() * 0.8;
        const v = (spd || 100) * (0.5 + Math.random());
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, maxLife: 0.5 + Math.random() * 0.4, color, size: 2 + Math.random() * 4, alive: true, ring: false });
      }
    }

    function spawnRing(x, y, color) {
      particles.push({ ring: true, x, y, r: 5, maxR: 55, life: 1, color, alive: true });
    }

    // ── Update ──
    function update(dt) {
      if (!running || paused) return;

      // Stars scroll
      for (const s of STARS) {
        s.y += s.speed * dt;
        if (s.y > H + 2) s.y -= H + 4;
      }

      // Player movement
      if (mouseX !== null) {
        const dx = mouseX - player.x;
        player.x += Math.sign(dx) * Math.min(Math.abs(dx), player.speed * dt * 1.6);
      } else {
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= player.speed * dt;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += player.speed * dt;
      }
      player.x = Math.max(player.w / 2 + 4, Math.min(W - player.w / 2 - 4, player.x));
      if (player.invincible > 0) player.invincible -= dt;

      // Auto-shoot
      shootTimer -= dt;
      if (shootTimer <= 0) {
        const interval = Math.max(0.18, 0.48 - level * 0.022);
        shootTimer = interval;
        bullets.push(mkBullet(player.x, player.y - player.h / 2, 0, -560, '#60a5fa', 5, true));
        if (level >= 4) {
          bullets.push(mkBullet(player.x - 12, player.y - 4, -45, -510, '#a78bfa', 3.5, true));
          bullets.push(mkBullet(player.x + 12, player.y - 4,  45, -510, '#a78bfa', 3.5, true));
        }
      }

      // Spawn enemies
      spawnTimer -= dt;
      levelTimer += dt;
      if (levelTimer >= 22) { levelTimer = 0; level++; updateHUD(); }

      if (spawnTimer <= 0) {
        const rate = Math.max(0.45, 1.6 - level * 0.1);
        spawnTimer = rate * (0.6 + Math.random() * 0.8);
        const x = 40 + Math.random() * (W - 80);
        const pool = ['basic', 'basic', 'basic', 'basic', 'fast'];
        if (level >= 2) pool.push('shooter', 'shooter');
        if (level >= 3) pool.push('tank');
        if (level >= 4) pool.push('bomber', 'fast', 'fast');
        enemies.push(mkEnemy(x, pool[Math.floor(Math.random() * pool.length)]));
      }

      // Bullets
      for (const b of bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < -12 || b.y > H + 12 || b.x < -12 || b.x > W + 12) b.alive = false;
      }

      // Enemies
      for (const e of enemies) {
        e.tick += dt;
        if (e.pattern === 'zigzag') e.x += Math.sin(e.tick * 3.2) * 90 * dt;
        if (e.pattern === 'wave')   e.x += Math.sin(e.tick * 1.8) * 60 * dt;
        e.y += e.vy * dt;
        if (e.y > H + 60) { e.alive = false; continue; }

        // Enemy shoot
        if (e.shoots) {
          e.shootCd -= dt;
          if (e.shootCd <= 0) {
            e.shootCd = Math.max(1.5, 3.0 - level * 0.12);
            const dx = player.x - e.x, dy = player.y - e.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            bullets.push(mkBullet(e.x, e.y + e.h / 2, (dx / len) * 170, (dy / len) * 170, '#f87171', 4, false));
          }
        }

        // Bullet vs enemy
        for (const b of bullets) {
          if (!b.alive || !b.fromPlayer) continue;
          if (Math.abs(b.x - e.x) < e.w / 2 + b.size && Math.abs(b.y - e.y) < e.h / 2 + b.size) {
            b.alive = false;
            e.hp--;
            spawnParticles(b.x, b.y, e.color, 5, 70);
            if (e.hp <= 0) {
              e.alive = false;
              const pts = e.score * (1 + Math.min(4, Math.floor(combo / 3)));
              score += pts;
              if (score > highScore) { highScore = score; localStorage.setItem('sg-hi', highScore); }
              combo++; comboTimer = 2.2;
              spawnParticles(e.x, e.y, e.color, 20, 160);
              spawnRing(e.x, e.y, e.color);
              updateHUD();
            }
          }
        }

        // Enemy vs player
        if (player.invincible <= 0) {
          if (Math.abs(e.x - player.x) < e.w / 2 + 12 && Math.abs(e.y - player.y) < e.h / 2 + 12) {
            e.alive = false;
            hitPlayer();
          }
        }
      }

      // Enemy bullet vs player
      if (player.invincible <= 0) {
        for (const b of bullets) {
          if (!b.alive || b.fromPlayer) continue;
          if (Math.abs(b.x - player.x) < 14 && Math.abs(b.y - player.y) < 14) {
            b.alive = false;
            hitPlayer();
          }
        }
      }

      // Particles
      for (const p of particles) {
        if (p.ring) {
          p.r += 120 * dt;
          p.life -= dt / 0.45;
          if (p.r >= p.maxR || p.life <= 0) p.alive = false;
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vy += 60 * dt;
          p.life -= dt / p.maxLife;
          if (p.life <= 0) p.alive = false;
        }
      }

      if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }

      bullets   = bullets.filter(b => b.alive);
      enemies   = enemies.filter(e => e.alive);
      particles = particles.filter(p => p.alive);
    }

    function hitPlayer() {
      lives--;
      player.invincible = 2.2;
      spawnParticles(player.x, player.y, '#60a5fa', 22, 220);
      spawnRing(player.x, player.y, '#60a5fa');
      updateHUD();
      if (lives <= 0) endGame();
    }

    // ── Draw ──
    function drawEnemy(e) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color; ctx.shadowBlur = 14;
      if (e.type === 'tank') {
        ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
        ctx.strokeRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-e.w / 2, e.h / 2 + 3, e.w, 4);
        ctx.fillStyle = e.hp >= 2 ? '#22c55e' : '#ef4444';
        ctx.fillRect(-e.w / 2, e.h / 2 + 3, e.w * (e.hp / e.maxHp), 4);
      } else if (e.type === 'fast') {
        ctx.beginPath(); ctx.moveTo(0, e.h / 2); ctx.lineTo(-e.w / 2, -e.h / 2); ctx.lineTo(e.w / 2, -e.h / 2); ctx.closePath(); ctx.fill();
      } else if (e.type === 'bomber') {
        ctx.beginPath();
        ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(-e.w * 0.25, -e.h * 0.15, e.w * 0.12, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, e.h / 2);
        ctx.lineTo(-e.w / 2, -e.h / 3);
        ctx.lineTo(-e.w / 4, -e.h / 2);
        ctx.lineTo(e.w / 4, -e.h / 2);
        ctx.lineTo(e.w / 2, -e.h / 3);
        ctx.closePath(); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#02040e'); bg.addColorStop(1, '#050b1a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Stars
      for (const s of STARS) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s.x % W, s.y % H, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Enemy bullets (red/warn glow)
      for (const b of bullets) {
        if (b.fromPlayer) continue;
        ctx.shadowColor = b.color; ctx.shadowBlur = 10;
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Player bullets (blue laser beams)
      for (const b of bullets) {
        if (!b.fromPlayer) continue;
        ctx.shadowColor = b.color; ctx.shadowBlur = 14;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - b.size / 2, b.y - b.size * 2.8, b.size, b.size * 2.8);
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillRect(b.x - b.size / 4, b.y - b.size * 2.8, b.size / 2, b.size * 2.8);
        ctx.shadowBlur = 0;
      }

      // Enemies
      for (const e of enemies) drawEnemy(e);

      // Particles
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.ring) {
          ctx.strokeStyle = p.color; ctx.lineWidth = 2.5;
          ctx.shadowColor = p.color; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Player ship
      if (running && player) {
        const flash = player.invincible > 0 && Math.floor(player.invincible * 9) % 2 === 0;
        if (!flash) {
          ctx.save();
          ctx.translate(player.x, player.y);
          // Engine flame (animated)
          const flameH = 10 + Math.random() * 8;
          const flameGrad = ctx.createLinearGradient(0, player.h / 2, 0, player.h / 2 + flameH);
          flameGrad.addColorStop(0, '#f59e0b'); flameGrad.addColorStop(1, 'rgba(239,68,68,0)');
          ctx.fillStyle = flameGrad;
          ctx.beginPath(); ctx.ellipse(0, player.h / 2 + flameH / 2, 7, flameH / 2, 0, 0, Math.PI * 2); ctx.fill();
          // Ship body
          ctx.fillStyle = '#60a5fa';
          ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.moveTo(0, -player.h / 2);
          ctx.lineTo(-player.w / 2, player.h / 2);
          ctx.lineTo(-player.w / 5, player.h / 4);
          ctx.lineTo(0, player.h / 2 - 4);
          ctx.lineTo(player.w / 5, player.h / 4);
          ctx.lineTo(player.w / 2, player.h / 2);
          ctx.closePath(); ctx.fill();
          // Cockpit
          ctx.fillStyle = 'rgba(255,255,255,.45)';
          ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.ellipse(0, -player.h / 6, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }

      // Combo text
      if (combo >= 3 && comboTimer > 0 && running) {
        const a = Math.min(1, comboTimer * 1.8);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `bold ${Math.min(22, 14 + combo)}px Inter,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 16;
        ctx.fillText(`${combo}✕ COMBO!`, W / 2, 55);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Paused overlay
      if (paused && running) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 1.5rem Inter,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ PAUSADO', W / 2, H / 2);
        ctx.font = '.8rem Inter,sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.fillText('Clica em Continuar para retomar', W / 2, H / 2 + 28);
      }
    }

    function loop(ts) {
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      update(dt);
      draw();
      frameId = requestAnimationFrame(loop);
    }

    function updateHUD() {
      root.querySelector('#sg-score').textContent = score;
      root.querySelector('#sg-level').textContent = level;
      const lv = Math.max(0, lives), dead = Math.max(0, 3 - lives);
      root.querySelector('#sg-lives').textContent = '❤️'.repeat(lv) + (dead > 0 ? '🖤'.repeat(dead) : '');
    }

    function endGame() {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      const overlay = root.querySelector('#sg-overlay');
      root.querySelector('#sg-over-title').textContent = '💥 Game Over!';
      root.querySelector('#sg-over-score').textContent = `Score: ${score} · Level: ${level} · Best: ${highScore}`;
      root.querySelector('#sg-start').textContent = '🔄 Jogar de novo';
      overlay.style.display = 'flex';
    }

    function startGame() {
      score = 0; lives = 3; level = 1; combo = 0; comboTimer = 0;
      bullets = []; enemies = []; particles = [];
      spawnTimer = 1.2; shootTimer = 0; levelTimer = 0;
      player = mkPlayer();
      running = true; paused = false;
      root.querySelector('#sg-overlay').style.display = 'none';
      root.querySelector('#sg-pause').textContent = '⏸ Pausa';
      updateHUD();
      lastTime = performance.now();
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(loop);
    }

    root.querySelector('#sg-start').addEventListener('click', startGame);

    root.querySelector('#sg-pause').addEventListener('click', () => {
      if (!running) return;
      paused = !paused;
      root.querySelector('#sg-pause').textContent = paused ? '▶ Continuar' : '⏸ Pausa';
    });

    // Mouse
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      mouseX = (e.clientX - r.left) * (W / r.width);
    });
    canvas.addEventListener('mouseleave', () => { mouseX = null; });
    canvas.addEventListener('click', () => { if (!running && root.querySelector('#sg-overlay').style.display !== 'none') startGame(); });

    // Touch
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      mouseX = (e.touches[0].clientX - r.left) * (W / r.width);
    }, { passive: false });
    canvas.addEventListener('touchend', () => { mouseX = null; });

    // Keyboard
    document.addEventListener('keydown', e => {
      keys[e.key] = true;
      const pane = document.getElementById('pane-shooting');
      if (!pane || !pane.classList.contains('active')) return;
      if ((e.key === 'p' || e.key === 'P') && running) {
        paused = !paused;
        root.querySelector('#sg-pause').textContent = paused ? '▶ Continuar' : '⏸ Pausa';
      }
    });
    document.addEventListener('keyup', e => { keys[e.key] = false; });

    window.addEventListener('resize', () => {
      resize();
      if (player) { player.x = Math.min(Math.max(player.x, player.w), W - player.w); player.y = H - 60; }
    });

    resize();
    // Initial static frame
    draw();
  }

  return { init };
})();
