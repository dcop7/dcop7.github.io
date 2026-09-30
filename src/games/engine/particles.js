/* ── Particles — sistema de partículas leve (usado pelo ArcadeKit) ──
   out/2026: brilho aditivo (halo suave por trás de cada faísca), atrito
   do ar, faíscas rápidas desenhadas como traço ao longo da velocidade e
   um fim de vida em "ease-out" (encolhem e desvanecem no fim, não de
   forma linear desde o início). Tudo opcional por partícula:
     glow: false  → sem halo       drag: 0..1 → atrito por segundo
     streak: false → nunca traço   shape: 'square' → confetti a rodar */
const Particles = (function () {
  function create() {
    let _particles = [];

    function spawn(opts = {}) {
      _particles.push({
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
        glow: opts.glow != null ? opts.glow : true,
        drag: opts.drag != null ? opts.drag : 1.4,
        streak: opts.streak != null ? opts.streak : true,
        shape: opts.shape || 'dot',
        rot: Math.random() * 6.28, vr: (Math.random() - .5) * 14,
      });
      if (_particles.length > 900) _particles.splice(0, _particles.length - 900);   /* teto de segurança */
    }

    function spawnBurst(x, y, count = 12, opts = {}) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - .5) * .4;
        const speed = (opts.speed || 80) + Math.random() * 40;
        spawn({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ...opts });
      }
    }

    function update(dt) {
      for (let i = _particles.length - 1; i >= 0; i--) {
        const p = _particles[i];
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy *= k;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;
        if (p.life <= 0) _particles.splice(i, 1);
      }
    }

    function draw(ctx) {
      if (!_particles.length) return;
      ctx.save();
      /* halos primeiro, em modo aditivo (brilho), depois os núcleos */
      ctx.globalCompositeOperation = 'lighter';
      for (const p of _particles) {
        if (!p.glow || p.shape !== 'dot') continue;
        const t = p.life / p.maxLife, e = t < .35 ? t / .35 : 1;
        ctx.globalAlpha = (p.fade ? e : 1) * .28;
        ctx.fillStyle = p.color;
        const s = (p.shrink ? p.size * (.4 + .6 * e) : p.size) * 2.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(s, 1), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of _particles) {
        const t = p.life / p.maxLife, e = t < .35 ? t / .35 : 1;       /* só desvanece no último terço */
        ctx.globalAlpha = p.fade ? e : 1;
        ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
        const s = Math.max(.5, p.shrink ? p.size * (.4 + .6 * e) : p.size);
        if (p.shape === 'square') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s, -s * .6, s * 2, s * 1.2); ctx.restore();
          continue;
        }
        const sp = Math.hypot(p.vx, p.vy);
        if (p.streak && sp > 260) {
          /* faísca rápida: traço na direção do movimento */
          const L = Math.min(22, sp * .035);
          ctx.lineWidth = s * 1.3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / sp * L, p.y - p.vy / sp * L); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    function clear() { _particles = []; }
    function count()  { return _particles.length; }

    return { spawn, spawnBurst, update, draw, clear, count };
  }

  return { create };
})();
