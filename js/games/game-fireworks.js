const FireworksGame = (function () {
  'use strict';

  function init(root) {
    if (!root) return;

    root.innerHTML = `
      <div style="position:relative;border-radius:var(--radius);overflow:hidden;background:#000;user-select:none">
        <canvas id="fw-canvas" style="display:block;width:100%;cursor:crosshair"></canvas>
        <div style="position:absolute;top:.6rem;left:0;right:0;text-align:center;color:rgba(255,255,255,.4);font-size:.7rem;pointer-events:none">
          Clica para lançar fogos ✨
        </div>
      </div>`;

    const canvas = root.querySelector('#fw-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [], rockets = [], animFrame;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.parentElement.clientWidth;
      const H = Math.max(420, window.innerHeight * 0.55);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();

    function hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }

    function explode(x, y, hue) {
      for (let i = 0; i < 80; i++) {
        const angle = (Math.PI * 2 / 80) * i;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x, y, hue,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, decay: 0.012 + Math.random() * 0.01,
          size: 2 + Math.random() * 2,
          trail: []
        });
      }
    }

    function launch(tx, ty) {
      const cW = canvas.width / (window.devicePixelRatio || 1);
      const cH = canvas.height / (window.devicePixelRatio || 1);
      rockets.push({
        x: tx + (Math.random() - 0.5) * 60,
        y: cH, tx, ty,
        vx: 0, vy: -12 - Math.random() * 6,
        hue: Math.random() * 360,
        trail: []
      });
    }

    function loop() {
      const cW = canvas.width / (window.devicePixelRatio || 1);
      const cH = canvas.height / (window.devicePixelRatio || 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, cW, cH);

      rockets = rockets.filter(r => {
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();
        r.trail.forEach((p, i) => {
          ctx.beginPath(); ctx.arc(p.x, p.y, 2 * (i / r.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${r.hue},100%,75%,${i / r.trail.length * 0.6})`;
          ctx.fill();
        });
        ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = hsl(r.hue, 100, 80);
        ctx.fill();
        r.y += r.vy; r.vy += 0.15;
        if (r.y <= r.ty || r.vy >= 0) {
          explode(r.x, r.y, r.hue);
          return false;
        }
        return true;
      });

      particles = particles.filter(p => {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 5) p.trail.shift();
        p.trail.forEach((t, i) => {
          ctx.beginPath(); ctx.arc(t.x, t.y, p.size * (i / p.trail.length) * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue},100%,65%,${p.life * i / p.trail.length * 0.5})`;
          ctx.fill();
        });
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue + 30},100%,70%,${p.life})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.97; p.vy *= 0.97; p.vy += 0.08;
        p.life -= p.decay;
        return p.life > 0;
      });

      animFrame = requestAnimationFrame(loop);
    }

    function getPos(e) {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    }

    canvas.addEventListener('click', e => {
      const p = getPos(e);
      for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) launch(p.x, p.y * (0.7 + Math.random() * 0.3));
    });
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const p = getPos(e);
      for (let i = 0; i < 2; i++) launch(p.x, p.y * (0.7 + Math.random() * 0.3));
    }, { passive: false });

    window.addEventListener('resize', resize);
    loop();

    setTimeout(() => {
      const cW = canvas.width / (window.devicePixelRatio || 1);
      const cH = canvas.height / (window.devicePixelRatio || 1);
      for (let i = 0; i < 4; i++) setTimeout(() => launch(cW * (.2 + Math.random() * .6), cH * (.2 + Math.random() * .3)), i * 300);
    }, 500);
  }

  return { init };
})();
