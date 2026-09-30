/* ══════════════════════════════════════════════════════════════════
   Parede Mortal (Dangerwall) — paredes vêm do fundo do túnel com
   buracos; mete a nave inteira dentro de um buraco antes do impacto.
   Diferente do Muro das Setas: aqui não há regra a decifrar, é
   pontaria contínua em 2D. Rato: a nave segue o cursor (com velocidade
   máxima). Toque: arrasto relativo (o dedo não tapa a nave).
   Buracos que deslizam, paredes que rodam, buracos duplos.
══════════════════════════════════════════════════════════════════ */
const DangerwallGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const SR = .085;                      /* raio da nave (coord. normalizadas, arena = [-1,1]²) */
  const F = .16;
  const DIFF = {
    easy:   { lives: 4, d0: 2.6, dMin: 1.25, hole: 1.18, spd: 3.4 },
    medium: { lives: 3, d0: 2.3, dMin: 1.0,  hole: 1,    spd: 3.1 },
    hard:   { lives: 2, d0: 2.0, dMin: .82,  hole: .86,  spd: 2.9 },
  };

  function arena(api) { const A = Math.min(api.W - 36, api.H - 190); return { cx: api.W / 2, cy: api.H * .53, h: A / 2 }; }

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    return { cfg, lives: cfg.lives, px: 0, py: 0, tx: 0, ty: 0, vx: 0, walls: [], n: 0, spawned: 0, score: 0, tights: 0, inv: 0, level: 1, t: 0, next: .6,
      stars: Array.from({ length: 70 }, () => ({ a: Math.random() * 6.283, d: Math.random(), s: U.rand(.4, 1) })) };
  }

  function mkWall(G) {
    const n = G.spawned + 1, c = G.cfg;
    const types = ['one'];
    if (n > 4) types.push('small');
    if (n > 8) types.push('two', 'slide');
    if (n > 14) types.push('rot', 'circle');
    if (n > 22) types.push('slide', 'rot', 'twoSmall');
    const ty = U.pick(types);
    const k = c.hole * (1 - Math.min(.28, n * .008));
    const rect = (w, h) => ({ s: 'r', w, h, x: U.rand(-1 + w / 2 + .04, 1 - w / 2 - .04), y: U.rand(-1 + h / 2 + .04, 1 - h / 2 - .04) });
    let holes = [];
    if (ty === 'one') holes = [rect(U.rand(.55, .75) * k, U.rand(.55, .75) * k)];
    if (ty === 'small') holes = [rect(U.rand(.36, .46) * k, U.rand(.36, .46) * k)];
    if (ty === 'two' || ty === 'twoSmall') {
      const w = (ty === 'two' ? .44 : .34) * k;
      const a = rect(w, w); let b; let tries = 0;
      do { b = rect(w, w); } while (Math.hypot(a.x - b.x, a.y - b.y) < w * 1.4 && tries++ < 30);
      holes = [a, b];
    }
    if (ty === 'circle') { const r = U.rand(.24, .3) * k; holes = [{ s: 'c', r, x: U.rand(-1 + r + .05, 1 - r - .05), y: U.rand(-1 + r + .05, 1 - r - .05) }]; }
    if (ty === 'slide') { const h = rect(.42 * k, .42 * k); h.ax = Math.random() < .5 ? 'x' : 'y'; h.base = h[h.ax]; h.amp = 1 - (h.ax === 'x' ? h.w : h.h) / 2 - .06; h.ph = Math.random() * 6; holes = [h]; }
    if (ty === 'rot') { const w = .38 * k; holes = [{ s: 'r', w, h: w * 1.6, x: U.rand(.25, .5), y: 0 }]; }
    const dur = Math.max(c.dMin, c.d0 - n * .045);
    G.spawned++;
    return { ty, holes, z: 1, age: 0, dur, rot: ty === 'rot' ? Math.random() * 6.283 : 0, vr: ty === 'rot' ? U.rand(.8, 1.4) * (Math.random() < .5 ? -1 : 1) : 0, hit: 0, pass: 0 };
  }

  /* posição atual dos buracos (deslizantes) */
  function holePos(w, h) {
    if (h.ax) { const v = h.base * 0 + Math.sin(w.age * 1.7 + h.ph) * h.amp; return h.ax === 'x' ? [v, h.y] : [h.x, v]; }
    return [h.x, h.y];
  }
  /* distância (com sinal) da nave à borda do buraco — >0 quando cabe */
  function clearance(w, px, py) {
    const c = Math.cos(-w.rot), s = Math.sin(-w.rot);
    const lx = px * c - py * s, ly = px * s + py * c;
    let best = -9;
    w.holes.forEach(h => {
      const [hx, hy] = holePos(w, h);
      let m;
      if (h.s === 'c') m = h.r - Math.hypot(lx - hx, ly - hy) - SR;
      else m = Math.min(h.w / 2 - Math.abs(lx - hx), h.h / 2 - Math.abs(ly - hy)) - SR;
      best = Math.max(best, m);
    });
    return best;
  }

  function update(G, dt, api) {
    const c = G.cfg, A = arena(api);
    G.t += dt; G.inv = Math.max(0, G.inv - dt);
    /* estrelas em warp: avançam com o tempo de jogo (não com os frames, nem em pausa) */
    G.stars.forEach(st => { st.d = (st.d + .24 * dt * (1 + G.level * .2) * st.s) % 1; });
    /* nave: persegue o alvo com velocidade máxima */
    const dx = G.tx - G.px, dy = G.ty - G.py, d = Math.hypot(dx, dy), mx = c.spd * dt;
    const k = d > mx ? mx / d : 1;
    G.vx = U.lerp(G.vx, dx * k / dt, Math.min(1, dt * 10));
    G.px = U.clamp(G.px + dx * k, -1 + SR, 1 - SR); G.py = U.clamp(G.py + dy * k, -1 + SR, 1 - SR);
    if (G.keys) { G.tx = U.clamp(G.tx + G.keys[0] * c.spd * dt, -1, 1); G.ty = U.clamp(G.ty + G.keys[1] * c.spd * dt, -1, 1); }

    G.next -= dt;
    const last = G.walls[G.walls.length - 1];
    if (G.next <= 0 && (!last || last.z < .5)) { G.walls.push(mkWall(G)); G.next = .15; }

    for (const w of G.walls) {
      if (w.hit || w.pass) { w.fx = (w.fx || 0) + dt; continue; }
      w.age += dt; w.z = 1 - w.age / w.dur; w.rot += w.vr * dt;
      if (w.z <= 0) {
        w.z = 0;
        const m = clearance(w, G.px, G.py);
        if (m >= 0 || G.inv > 0) {
          w.pass = 1; G.n++;
          let pts = 10 + Math.floor(G.level * 2);
          if (m >= 0 && m < .045) { pts += 5; G.tights++; api.float(A.cx + G.px * A.h, A.cy + G.py * A.h - 40, 'Rente! +5', '#fde047', 18); }
          G.score += pts;
          api.sfx.noise(.25, .09, 0, 1800, 'bandpass'); api.sfx.tone(300 + G.n * 6, .12, 'triangle', .06, 0, 900);
          if (G.n % 8 === 0) { G.level++; api.banner('Setor ' + G.level, 'Paredes mais rápidas'); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .07); }
        } else {
          w.hit = 1; G.lives--; G.inv = .9;
          api.shake(14, .4); api.flash('#ef4444', .25); api.vibe([60, 30, 60]);
          api.sfx.noise(.45, .22, 0, 350, 'lowpass'); api.sfx.tone(120, .3, 'sawtooth', .07, 0, 50);
          for (let i = 0; i < 30; i++) api.spark({ x: A.cx + G.px * A.h, y: A.cy + G.py * A.h, vx: U.rand(-300, 300), vy: U.rand(-300, 300), color: U.pick(['#f87171', '#fde047', '#fff']), size: U.rand(2, 4), life: U.rand(.4, .8), gravity: 0 });
          if (G.lives <= 0) {
            api.over({ score: G.score, won: false, delay: 900, title: 'Esmagado pela parede', icon: '🚀',
              stats: [['Paredes', G.n], ['Setor', G.level], ['Passagens rentes', G.tights]], meta: { walls: G.n } });
            return;
          }
        }
      }
    }
    G.walls = G.walls.filter(w => !(w.fx > .45));
  }

  /* ── desenho ── */
  function wallPath(ctx, w, A, s, alphaHole) {
    const half = A.h * s;
    ctx.save(); ctx.translate(A.cx, A.cy); ctx.rotate(w.rot);
    ctx.beginPath(); ctx.rect(-half, -half, half * 2, half * 2);
    w.holes.forEach(h => {
      const [hx, hy] = holePos(w, h);
      if (h.s === 'c') { ctx.moveTo(hx * half + h.r * half, hy * half); ctx.arc(hx * half, hy * half, h.r * half, 0, 6.283, true); }
      else { const x0 = (hx - h.w / 2) * half, y0 = (hy - h.h / 2) * half; ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + h.h * half); ctx.lineTo(x0 + h.w * half, y0 + h.h * half); ctx.lineTo(x0 + h.w * half, y0); ctx.closePath(); }
    });
    return half;
  }

  function draw(G, ctx, W, H, api) {
    const A = arena(api);
    /* tons frios (ciano → violeta): o vermelho fica reservado ao aviso de colisão */
    const lvlHue = 175 + ((G.level - 1) * 37) % 125;
    ctx.fillStyle = '#04050d'; ctx.fillRect(0, 0, W, H);
    /* estrelas em warp */
    G.stars.forEach(st => {
      const r0 = st.d * st.d * W * .8, r1 = r0 * 1.08 + 2;
      ctx.strokeStyle = `rgba(200,220,255,${st.d * .8})`; ctx.lineWidth = st.s * 1.4;
      ctx.beginPath(); ctx.moveTo(A.cx + Math.cos(st.a) * r0, A.cy + Math.sin(st.a) * r0); ctx.lineTo(A.cx + Math.cos(st.a) * r1, A.cy + Math.sin(st.a) * r1); ctx.stroke();
    });
    /* moldura da arena e túnel */
    ctx.strokeStyle = `hsla(${lvlHue},90%,60%,.12)`; ctx.lineWidth = 1;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(A.cx + a * A.h * F / (1 + F), A.cy + b * A.h * F / (1 + F)); ctx.lineTo(A.cx + a * A.h, A.cy + b * A.h); ctx.stroke(); });
    ctx.strokeStyle = `hsla(${lvlHue},90%,60%,.35)`; ctx.lineWidth = 2; ctx.strokeRect(A.cx - A.h, A.cy - A.h, A.h * 2, A.h * 2);

    /* paredes, da mais longe para a mais perto */
    const ws = G.walls.slice().sort((a, b) => b.z - a.z);
    const drawShip = () => {
      const x = A.cx + G.px * A.h, y = A.cy + G.py * A.h, r = SR * A.h;
      if (G.inv > 0 && Math.floor(G.t * 14) % 2) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(U.clamp(G.vx * .12, -.5, .5));
      ctx.fillStyle = 'rgba(56,189,248,.25)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 1.05, r * .55); ctx.lineTo(r * .35, r * .35); ctx.lineTo(0, r * .7); ctx.lineTo(-r * .35, r * .35); ctx.lineTo(-r * 1.05, r * .55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.moveTo(0, -r * .55); ctx.lineTo(r * .25, r * .1); ctx.lineTo(-r * .25, r * .1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(251,146,60,${.6 + Math.random() * .4})`; ctx.beginPath(); ctx.arc(0, r * .75, r * .28, 0, 6.3); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(125,211,252,.35)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    };
    let shipDrawn = false;
    ws.forEach(w => {
      if (!shipDrawn && w.z <= .001 && !w.pass && !w.hit) { drawShip(); shipDrawn = true; }
      const s = w.z <= 0 ? 1 + (w.fx || 0) * (w.pass ? 2.2 : .3) : F / (w.z + F);
      const a = w.z <= 0 ? Math.max(0, 1 - (w.fx || 0) / .45) : Math.min(1, (1 - w.z) * 2.5);
      const danger = w.z < .25 && w.z > 0 ? clearance(w, G.px, G.py) < 0 : false;
      ctx.globalAlpha = a * (w.pass ? .5 : 1);
      const half = wallPath(ctx, w, A, s);
      const g = ctx.createLinearGradient(0, -half, 0, half);
      g.addColorStop(0, `hsla(${lvlHue},70%,${w.hit ? 45 : 22}%,.92)`); g.addColorStop(1, `hsla(${lvlHue + 20},70%,${w.hit ? 35 : 12}%,.92)`);
      ctx.fillStyle = g; ctx.fill('evenodd');
      ctx.strokeStyle = danger ? '#f87171' : `hsl(${lvlHue},95%,62%)`; ctx.lineWidth = 2 + s * 2; ctx.stroke();
      /* grelha no painel */
      ctx.strokeStyle = `hsla(${lvlHue},90%,70%,.12)`; ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * half / 4, -half); ctx.lineTo(i * half / 4, half); ctx.stroke(); }
      ctx.restore();
      ctx.globalAlpha = 1;
    });
    if (!shipDrawn) drawShip();
    /* escudos */
    for (let i = 0; i < G.cfg.lives; i++) {
      const x = W / 2 - (G.cfg.lives - 1) * 16 + i * 32, y = H - 30;
      ctx.globalAlpha = i < G.lives ? 1 : .2;
      ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 10, y - 6); ctx.lineTo(x + 8, y + 5); ctx.lineTo(x, y + 11); ctx.lineTo(x - 8, y + 5); ctx.lineTo(x - 10, y - 6); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (G.t < 3.5) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '600 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(G.touchMode ? 'Arrasta o dedo em qualquer lado para mover a nave' : 'A nave segue o cursor', W / 2, A.cy + A.h + 34); }
  }

  function toArena(api, x, y) { const A = arena(api); return [(x - A.cx) / A.h, (y - A.cy) / A.h]; }

  return ArcadeKit.create({
    id: 'dangerwall', title: 'Parede Mortal', icon: '🚀',
    accent: '#ef4444', accent2: '#38bdf8', bg: '#04050d',
    tagline: 'As paredes vêm a toda a velocidade. Encontra o buraco e mete lá a nave inteira.',
    view: { w: 400 },
    how: [
      '<b>Rato:</b> a nave segue o cursor. <b>Toque:</b> arrasta o dedo em qualquer lado — a nave mexe-se como o dedo (sem o tapar). Também há setas.',
      'A nave tem de caber <b>inteira</b> dentro de um buraco no momento do impacto. Contorno vermelho = vais bater.',
      'Há buracos que deslizam e paredes que rodam. Passar rente à borda dá +5. Tens escudos limitados.',
    ],
    controls: ['🖱️ Mover o rato', '👆 Arrastar', '⌨️ Setas'],
    ready: { title: 'Toca para começar', hint: 'Mete a nave dentro dos buracos das paredes.' },
    setup, update, draw,
    down: (G, x, y, api, e) => {
      G.touchMode = e.pointerType !== 'mouse';
      if (G.touchMode) { G.drag = { x, y, tx: G.tx, ty: G.ty }; }
      else { const [ax, ay] = toArena(api, x, y); G.tx = U.clamp(ax, -1, 1); G.ty = U.clamp(ay, -1, 1); }
    },
    move: (G, x, y, api, e, isDown) => {
      if (e.pointerType === 'mouse') { const [ax, ay] = toArena(api, x, y); G.tx = U.clamp(ax, -1, 1); G.ty = U.clamp(ay, -1, 1); G.touchMode = false; return; }
      if (isDown && G.drag) { const A = arena(api); G.tx = U.clamp(G.drag.tx + (x - G.drag.x) / A.h * 1.3, -1, 1); G.ty = U.clamp(G.drag.ty + (y - G.drag.y) / A.h * 1.3, -1, 1); }
    },
    up: G => { G.drag = null; },
    key: (G, e) => {
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (m) { G.keys = G.keys || [0, 0]; if (m[0]) G.keys[0] = m[0]; if (m[1]) G.keys[1] = m[1]; return true; }
    },
    keyup: (G, e) => { if (!G.keys) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') G.keys[0] = 0; if (e.key === 'ArrowUp' || e.key === 'ArrowDown') G.keys[1] = 0; },
    hud: G => [['Pontos', G.score], ['Paredes', G.n], ['Setor', G.level]],
    achievements: [
      { id: 'dw.30', name: 'Piloto de Túnel', icon: '🚀', desc: 'Passa 30 paredes na Parede Mortal.', test: c => ((c.result.meta || {}).walls || 0) >= 30 },
      { id: 'dw.80', name: 'Agulha no Palheiro', icon: '🪡', desc: 'Passa 80 paredes na Parede Mortal.', test: c => ((c.result.meta || {}).walls || 0) >= 80 },
    ],
  });
})();
