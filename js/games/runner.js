const RunnerGame = (function () {
  'use strict';

  let canvas, ctx, scoreEl, btnEl, animId;
  let state = 'idle';
  let score = 0, speed = 3.2, frame = 0;
  let lane = 1, targetLane = 1, charY = 0;
  let obstacles = [], nextObs = 100;
  let LANES, W, H;
  const CHAR_X = 72, OBS_W = 32;

  function init(container) {
    container.innerHTML = `
      <div class="hf-card">
        <div class="hf-top">
          <span class="hf-title">🦊 Corredor Infinito</span>
          <span style="font-size:.65rem;color:var(--muted)">▲ ▼ ou W/S para mudar via</span>
        </div>
        <div class="runner-wrap">
          <canvas id="runner-cv"></canvas>
          <div class="runner-hud">
            <div><span style="font-size:.55rem;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">Pontos</span>
            <div style="font-size:1.4rem;font-weight:700;font-family:'Space Grotesk',sans-serif" id="runner-score">0</div></div>
            <button class="hf-new-btn" id="runner-btn">▶ Iniciar</button>
          </div>
        </div>
      </div>`;

    canvas = container.querySelector('#runner-cv');
    ctx    = canvas.getContext('2d');
    scoreEl = container.querySelector('#runner-score');
    btnEl   = container.querySelector('#runner-btn');

    function resize() {
      const pw = canvas.parentElement.clientWidth || 500;
      W = Math.min(pw - 2, 640); H = Math.round(W * 0.37);
      canvas.width = W; canvas.height = H;
      LANES = [Math.round(H * 0.22), Math.round(H * 0.5), Math.round(H * 0.78)];
      charY = LANES[lane];
      if (state !== 'running') drawIdle();
    }
    resize();
    window.addEventListener('resize', resize);

    btnEl.addEventListener('click', () => {
      if (state !== 'running') startGame();
      else stopGame();
    });

    document.addEventListener('keydown', e => {
      const pane = document.getElementById('pane-runner');
      if (!pane || !pane.classList.contains('active')) return;
      if (e.key === 'ArrowUp'   || e.key === 'w' || e.key === 'W') { e.preventDefault(); moveLane(-1); }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); moveLane(1); }
    });

    let ty0 = 0;
    canvas.addEventListener('touchstart', e => { ty0 = e.touches[0].clientY; }, { passive: true });
    canvas.addEventListener('touchend',   e => {
      const dy = e.changedTouches[0].clientY - ty0;
      if (Math.abs(dy) > 22) moveLane(dy > 0 ? 1 : -1);
      else if (state !== 'running') startGame();
    }, { passive: true });
  }

  function moveLane(d) {
    if (state !== 'running') return;
    targetLane = Math.max(0, Math.min(2, targetLane + d));
  }

  function startGame() {
    state = 'running'; score = 0; speed = 3.2; frame = 0;
    lane = 1; targetLane = 1; charY = LANES[1]; obstacles = []; nextObs = 100;
    scoreEl.textContent = '0';
    btnEl.textContent = '⏹ Parar';
    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  function stopGame() {
    state = 'idle';
    if (animId) cancelAnimationFrame(animId);
    btnEl.textContent = '▶ Iniciar';
    drawIdle();
  }

  function loop() {
    update(); draw();
    if (state === 'running') animId = requestAnimationFrame(loop);
  }

  function update() {
    frame++;
    score = Math.floor(frame * speed / 6);
    scoreEl.textContent = score;
    if (frame % 380 === 0 && speed < 13) speed += 0.5;

    charY += (LANES[targetLane] - charY) * 0.16;
    lane = targetLane;

    nextObs--;
    if (nextObs <= 0) {
      obstacles.push({
        x: W + 10,
        lane: Math.floor(Math.random() * 3),
        h: 28 + Math.random() * 28,
        type: Math.floor(Math.random() * 3)
      });
      nextObs = Math.round(Math.max(55, 160 - speed * 8) + Math.random() * 60);
    }

    for (const o of obstacles) o.x -= speed;
    obstacles = obstacles.filter(o => o.x > -OBS_W - 10);

    for (const o of obstacles) {
      const oy = LANES[o.lane];
      if (Math.abs(o.x - CHAR_X) < (OBS_W + 36) / 2 - 5 && Math.abs(oy - charY) < (o.h + 28) / 2 - 6) {
        die(); return;
      }
    }
  }

  function die() {
    state = 'dead';
    btnEl.textContent = '↺ Reiniciar';
    draw();
    let f = 0;
    const fl = setInterval(() => {
      ctx.fillStyle = `rgba(239,68,68,${0.35 * Math.abs(Math.sin(f * 1.4))})`;
      ctx.fillRect(0, 0, W, H);
      if (++f > 8) clearInterval(fl);
    }, 70);
  }

  function drawIdle() {
    if (!ctx || !LANES) return;
    bg();
    drawFox(CHAR_X, LANES[1], 0);
    ctx.fillStyle = 'rgba(0,0,0,.52)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(H * .15)}px "Space Grotesk", sans-serif`;
    ctx.fillText('▶  Iniciar', W / 2, H / 2 + H * .05);
  }

  function draw() {
    bg();
    for (const o of obstacles) drawObs(o);
    drawFox(CHAR_X, charY, state === 'running' ? frame / 7 : 0);
    if (state === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,.52)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f87171';
      ctx.font = `bold ${Math.round(H * .17)}px "Space Grotesk", sans-serif`;
      ctx.fillText('💥 Game Over!', W / 2, H / 2);
      ctx.fillStyle = '#fca5a5';
      ctx.font = `${Math.round(H * .10)}px Inter, sans-serif`;
      ctx.fillText(`Pontos: ${score}`, W / 2, H / 2 + H * .16);
    }
  }

  function bg() {
    const grad = ctx.createLinearGradient(0, 0, 0, H * .65);
    grad.addColorStop(0, '#172554');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 22; i++) {
      const sx = ((i * 137 + frame * 0.08) % W);
      ctx.fillRect(sx, (i * 31) % (H * .55), 1.5, 1.5);
    }

    // Ground
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, H * .62, W, H * .38);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, H * .62, W, H * .07);

    // Lane lines
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1; ctx.setLineDash([10, 12]);
    [.38, .62].forEach(y => {
      ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function drawFox(x, y, phase) {
    const s = H / 230;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);

    // Tail
    ctx.save();
    ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.quadraticCurveTo(-32, -16, -22, -30); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-20, -24); ctx.quadraticCurveTo(-26, -32, -22, -30); ctx.stroke();
    ctx.restore();

    // Body
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath(); ctx.ellipse(4, 3, 12, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Head
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.ellipse(23, -6, 14, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Ear
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.moveTo(15, -16); ctx.lineTo(21, -29); ctx.lineTo(27, -16); ctx.fill();
    ctx.fillStyle = '#fda4af';
    ctx.beginPath(); ctx.moveTo(17, -17); ctx.lineTo(21, -25); ctx.lineTo(25, -17); ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(29, -9, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.arc(30, -9, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(31, -10.5, .9, 0, Math.PI * 2); ctx.fill();

    // Nose
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.ellipse(36, -6, 2.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();

    // Legs
    ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    [[-8, 0], [4, Math.PI]].forEach(([ox, ph]) => {
      const a = Math.sin(phase + ph) * 10;
      ctx.beginPath(); ctx.moveTo(ox, 10); ctx.lineTo(ox + a * .5, 23); ctx.lineTo(ox + a, 23); ctx.stroke();
    });

    ctx.restore();
  }

  function drawObs(o) {
    const x = o.x, oy = LANES[o.lane];
    const s = H / 230, w = OBS_W * s, h = o.h * s;
    ctx.save();
    if (o.type === 0) {
      // Stump
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); rrect(x - w/2, oy - h, w, h, 3 * s); ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.beginPath(); ctx.ellipse(x, oy - h, w * .85, w * .6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === 1) {
      // Rock
      ctx.fillStyle = '#4b5563';
      ctx.beginPath(); ctx.ellipse(x, oy - h * .55, w * .68, h * .55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b7280';
      ctx.beginPath(); ctx.ellipse(x - 3 * s, oy - h * .72, w * .28, h * .26, .3, 0, Math.PI * 2); ctx.fill();
    } else {
      // Hurdle
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - w * .42, oy - h, 4 * s, h);
      ctx.fillRect(x + w * .42 - 4 * s, oy - h, 4 * s, h);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(x - w * .42, oy - h * .55, w * .84, 5 * s);
      ctx.fillRect(x - w * .42, oy - h * .75, w * .84, 4 * s);
    }
    ctx.restore();
  }

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  return { init };
})();
