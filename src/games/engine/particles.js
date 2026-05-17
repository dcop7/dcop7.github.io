/* ── Particles — lightweight particle system ── */
const Particles = (function () {
  function create() {
    let _particles = [];

    function spawn(opts = {}) {
      const p = {
        x:    opts.x    || 0,
        y:    opts.y    || 0,
        vx:   opts.vx   != null ? opts.vx : (Math.random() - .5) * 120,
        vy:   opts.vy   != null ? opts.vy : (Math.random() - .5) * 120 - 60,
        life: opts.life || 1,
        maxLife: opts.life || 1,
        size: opts.size || 4,
        color: opts.color || '#ffffff',
        gravity: opts.gravity != null ? opts.gravity : 200,
        fade: opts.fade != null ? opts.fade : true,
        shrink: opts.shrink != null ? opts.shrink : true,
      };
      _particles.push(p);
    }

    function spawnBurst(x, y, count = 12, opts = {}) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = (opts.speed || 80) + Math.random() * 40;
        spawn({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ...opts,
        });
      }
    }

    function update(dt) {
      for (let i = _particles.length - 1; i >= 0; i--) {
        const p = _particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.life -= dt;
        if (p.life <= 0) _particles.splice(i, 1);
      }
    }

    function draw(ctx) {
      _particles.forEach(p => {
        const t = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = p.fade ? t : 1;
        ctx.fillStyle = p.color;
        const s = p.shrink ? p.size * t : p.size;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(s, 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    function clear() { _particles = []; }
    function count()  { return _particles.length; }

    return { spawn, spawnBurst, update, draw, clear, count };
  }

  return { create };
})();
