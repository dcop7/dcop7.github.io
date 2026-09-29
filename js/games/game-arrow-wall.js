/* ══════════════════════════════════════════════════════════════════
   Muro das Setas (Arrow Wall) — paredes vêm pelo túnel com uma seta;
   antes do impacto tens de ir para a posição certa:
     • seta VERDE  → vai para onde aponta
     • seta VERMELHA → vai para o lado OPOSTO
     • círculo AZUL → fica no centro (não te mexas)
     • seta a GIRAR → só vale quando parar
   Toque/clique na direção, deslizar, ou setas do teclado.
══════════════════════════════════════════════════════════════════ */
const ArrowWallGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const OFF = 96;                                       /* distância das 4 posições ao centro */
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], center: [0, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left', center: 'center' };
  const ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
  const COL = { go: '#22c55e', flip: '#ef4444', stay: '#60a5fa', spin: '#eab308' };
  const DIFF = {
    easy:   { lives: 4, d0: 2.0, dMin: .95, flip: 6, stay: 12, spin: 24 },
    medium: { lives: 3, d0: 1.75, dMin: .76, flip: 5, stay: 10, spin: 16 },
    hard:   { lives: 2, d0: 1.5, dMin: .6,  flip: 3, stay: 7,  spin: 11 },
  };

  function setup(api, o) {
    const G = { cfg: DIFF[o.diff] || DIFF.medium, lives: 0, n: 0, score: 0, streak: 0, best: 0, pos: [0, 0], choice: null, wall: null, gap: .4, scroll: 0, hurt: 0, reacts: [], level: 1, trail: [] };
    G.lives = G.cfg.lives;
    return G;
  }

  function newWall(G) {
    const c = G.cfg, n = G.n + 1;
    const pool = ['go'];
    if (n >= c.flip) pool.push('flip', 'flip');
    if (n >= c.stay) pool.push('stay');
    if (n >= c.spin) pool.push('spin');
    let type = U.pick(pool);
    const dir = U.pick(['up', 'down', 'left', 'right']);
    let correct = type === 'go' ? dir : type === 'flip' ? OPP[dir] : type === 'stay' ? 'center' : dir;
    const dur = Math.max(c.dMin, c.d0 - (n - 1) * .028);
    G.wall = { type, dir, correct, z: 1, dur, age: 0, spinLock: type === 'spin' ? U.rand(.42, .55) : 0, shown: dir, open: 0, spinFlip: type === 'spin' && n >= c.spin + 6 && Math.random() < .4 };
    if (G.wall.spinFlip) { G.wall.correct = OPP[dir]; }
    G.choice = null; G.chosenAt = null;
  }

  function choose(G, d, api) {
    const w = G.wall;
    if (!w || G.choice || w.z <= 0) return;
    if (w.type === 'spin' && w.z > w.spinLock) { G.wait = .35; api.sfx.tone(200, .05, 'square', .03); return; }
    G.choice = d; G.chosenAt = w.age;
    api.sfx.tone(d === 'center' ? 440 : 620, .06, 'triangle', .05, 0, d === 'center' ? 440 : 880);
  }

  function impact(G, api) {
    const w = G.wall, ch = G.choice || 'center';
    const cx = api.W / 2, cy = api.H * .5;
    if (ch === w.correct) {
      G.n++; G.streak++; G.best = Math.max(G.best, G.streak);
      const mult = Math.min(5, 1 + Math.floor(G.streak / 5));
      const quick = G.chosenAt != null ? U.clamp(1 - G.chosenAt / w.dur, 0, 1) : .2;
      const pts = Math.round((10 + 15 * quick) * mult);
      G.score += pts;
      if (G.chosenAt != null) G.reacts.push(G.chosenAt);
      w.open = 1;
      api.float(cx + G.pos[0], cy + G.pos[1] - 40, '+' + pts + (mult > 1 ? ' ×' + mult : ''), '#86efac', 18);
      api.sfx.noise(.18, .08, 0, 2600, 'highpass'); api.sfx.tone(700 + Math.min(G.streak, 20) * 18, .1, 'sine', .08);
      if (G.n % 10 === 0) { G.level++; api.banner('Nível ' + G.level, 'Mais rápido'); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .07); }
    } else {
      G.streak = 0; G.lives--; G.hurt = 1;
      w.open = 1; w.bad = true;
      api.shake(12, .35); api.flash('#ef4444', .22); api.vibe(110);
      api.sfx.noise(.3, .18, 0, 300, 'lowpass'); api.sfx.tone(140, .25, 'sawtooth', .07, 0, 70);
      const need = { go: 'Seta verde: vai para onde aponta', flip: 'Seta vermelha: vai para o lado oposto', stay: 'Círculo azul: fica no centro', spin: w.spinFlip ? 'Seta vermelha a girar: lado oposto quando parar' : 'Seta a girar: segue-a quando parar' }[w.type];
      api.float(cx, cy + 150, need, '#fecaca', 14);
      if (G.lives <= 0) {
        const avg = G.reacts.length ? (G.reacts.reduce((a, b) => a + b, 0) / G.reacts.length) : 0;
        api.over({ score: G.score, won: false, delay: 900, title: 'Contra a parede!', icon: '🧱',
          stats: [['Paredes', G.n], ['Melhor série', G.best], ['Reação média', avg ? Math.round(avg * 1000) + ' ms' : '—']],
          meta: { walls: G.n } });
      }
    }
  }

  function update(G, dt, api) {
    G.scroll = (G.scroll + dt * (1.2 + G.level * .15)) % 1;
    G.hurt = Math.max(0, G.hurt - dt * 2);
    G.wait = Math.max(0, (G.wait || 0) - dt);
    const tgt = DIRS[G.choice || 'center'];
    const back = G.wall && G.wall.z <= 0 && G.wall.open < .4;
    const tx = back ? 0 : tgt[0] * OFF, ty = back ? 0 : tgt[1] * OFF;
    G.pos[0] = U.lerp(G.pos[0], tx, Math.min(1, dt * 18));
    G.pos[1] = U.lerp(G.pos[1], ty, Math.min(1, dt * 18));
    G.trail.unshift([G.pos[0], G.pos[1]]); if (G.trail.length > 8) G.trail.pop();

    if (!G.wall) { G.gap -= dt; if (G.gap <= 0) newWall(G); return; }
    const w = G.wall;
    if (w.z > 0) {
      w.age += dt;
      w.z = 1 - w.age / w.dur;
      if (w.type === 'spin') {
        if (w.z > w.spinLock) { w.shown = ['up', 'right', 'down', 'left'][Math.floor(w.age * 9) % 4]; }
        else w.shown = w.dir;
      }
      if (w.z <= 0) { w.z = 0; impact(G, api); }
    } else {
      w.open -= dt * 2.2;
      if (w.open <= 0) { G.wall = null; G.choice = null; G.gap = .28; }
    }
  }

  /* ── desenho ── */
  function arrow(ctx, x, y, s, ang, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.fillStyle = '#fff'; ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(8, -44); ctx.lineTo(8, -18); ctx.lineTo(-52, -18); ctx.lineTo(-52, 18); ctx.lineTo(8, 18); ctx.lineTo(8, 44); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function draw(G, ctx, W, H, api) {
    const cx = W / 2, cy = H * .5;
    ctx.fillStyle = '#050b16'; ctx.fillRect(0, 0, W, H);
    /* túnel: molduras concêntricas a vir */
    for (let i = 0; i < 9; i++) {
      const z = ((i + 1 - G.scroll) / 9);
      const s = .12 / (z + .12), half = 170 * s * 1.25;
      ctx.strokeStyle = `rgba(34,211,238,${Math.min(.5, (1 - z) * .55)})`; ctx.lineWidth = 1 + 2 * (1 - z);
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
    }
    ctx.strokeStyle = 'rgba(34,211,238,.12)'; ctx.lineWidth = 1;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + a * W, cy + b * W); ctx.stroke(); });
    /* 5 posições no chão do túnel */
    Object.keys(DIRS).forEach(k => {
      const [dx, dy] = DIRS[k];
      ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(cx + dx * OFF, cy + dy * OFF, 26, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    });

    /* jogador (por trás da parede enquanto ela ainda está longe) */
    const drawOrb = () => {
      G.trail.forEach((p, i) => { ctx.globalAlpha = .18 * (1 - i / 8); ctx.fillStyle = '#67e8f9'; ctx.beginPath(); ctx.arc(cx + p[0], cy + p[1], 20 - i, 0, 6.3); ctx.fill(); });
      ctx.globalAlpha = 1;
      const x = cx + G.pos[0], y = cy + G.pos[1];
      const g = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, 24);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.35, G.hurt > 0 ? '#fca5a5' : '#a5f3fc'); g.addColorStop(1, G.hurt > 0 ? '#b91c1c' : '#0891b2');
      ctx.shadowColor = G.hurt > 0 ? '#ef4444' : '#22d3ee'; ctx.shadowBlur = 22;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22 + (G.wait ? Math.sin(api.t * 60) * 2 : 0), 0, 6.3); ctx.fill();
      ctx.shadowBlur = 0;
    };

    const w = G.wall;
    if (w && w.z > .02) drawOrb();
    if (w) {
      const s = .12 / (w.z + .12), half = 150 * s;
      const col = COL[w.type];
      const alpha = w.z <= 0 ? Math.max(0, w.open) : Math.min(1, (1 - w.z) * 3);
      ctx.globalAlpha = alpha;
      /* painel */
      const pg = ctx.createLinearGradient(cx, cy - half, cx, cy + half);
      pg.addColorStop(0, '#1b2438'); pg.addColorStop(1, '#0d1322');
      ctx.fillStyle = pg; U.rr(ctx, cx - half, cy - half, half * 2, half * 2, 14 * s); ctx.fill();
      ctx.strokeStyle = w.bad ? '#ef4444' : col; ctx.lineWidth = 5 * s + 1; ctx.shadowColor = col; ctx.shadowBlur = 16;
      U.rr(ctx, cx - half, cy - half, half * 2, half * 2, 14 * s); ctx.stroke(); ctx.shadowBlur = 0;
      /* portas: todas iguais até ao impacto; a certa abre-se */
      Object.keys(DIRS).forEach(k => {
        const [dx, dy] = DIRS[k], ds = 30 * s, px = cx + dx * OFF * s, py = cy + dy * OFF * s;
        const isOk = k === w.correct && w.z <= 0;
        ctx.fillStyle = isOk ? (w.bad ? 'rgba(239,68,68,.35)' : 'rgba(134,239,172,.55)') : 'rgba(0,0,0,.35)';
        U.rr(ctx, px - ds, py - ds, ds * 2, ds * 2, 6 * s); ctx.fill();
      });
      /* símbolo */
      if (w.z > 0) {
        if (w.type === 'stay') {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 12 * s; ctx.shadowColor = col; ctx.shadowBlur = 18;
          ctx.beginPath(); ctx.arc(cx, cy, 44 * s, 0, 6.3); ctx.stroke(); ctx.shadowBlur = 0;
        } else {
          const ac = w.type === 'spin' ? (w.z > w.spinLock ? COL.spin : (w.spinFlip ? COL.flip : COL.go)) : col;
          arrow(ctx, cx, cy, s * 1.05, ANG[w.shown], ac);
          /* a cor do painel também passa a dizer a regra quando a seta pára */
          if (w.type === 'spin' && w.z <= w.spinLock) {
            ctx.strokeStyle = ac; ctx.lineWidth = 5 * s + 1; U.rr(ctx, cx - half, cy - half, half * 2, half * 2, 14 * s); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    if (!w || w.z <= .02) drawOrb();

    /* vidas */
    for (let i = 0; i < G.cfg.lives; i++) {
      ctx.globalAlpha = i < G.lives ? 1 : .2;
      ctx.fillStyle = '#f43f5e'; const x = W / 2 - (G.cfg.lives - 1) * 13 + i * 26, y = H - 34;
      ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.bezierCurveTo(x - 12, y - 4, x - 6, y - 14, x, y - 6); ctx.bezierCurveTo(x + 6, y - 14, x + 12, y - 4, x, y + 6); ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* legenda das regras (os primeiros segundos de cada tipo novo) */
    if (w && w.z > 0 && G.n < G.cfg.stay + 3) {
      const t = { go: 'Verde: segue a seta', flip: 'Vermelha: lado oposto!', stay: 'Azul: fica no centro', spin: 'Espera que pare…' }[w.type];
      ctx.fillStyle = COL[w.type]; ctx.font = "700 15px system-ui"; ctx.textAlign = 'center';
      ctx.fillText(t, cx, cy + OFF + 70);
    }
  }

  /* entrada: toque/clique = direção a partir do centro; arrastar = deslize */
  function down(G, x, y, api) { G.sw = { x, y, done: false }; }
  function move(G, x, y, api, e, isDown) {
    if (!isDown || !G.sw || G.sw.done) return;
    const dx = x - G.sw.x, dy = y - G.sw.y;
    if (Math.hypot(dx, dy) > 28) { G.sw.done = true; choose(G, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), api); }
  }
  function up(G, x, y, api) {
    if (!G.sw || G.sw.done) { G.sw = null; return; }
    G.sw = null;
    const dx = x - api.W / 2, dy = y - api.H * .5;
    if (Math.hypot(dx, dy) < 52) choose(G, 'center', api);
    else choose(G, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), api);
  }

  return ArcadeKit.create({
    id: 'arrow-wall', title: 'Muro das Setas', icon: '🧱',
    accent: '#22c55e', accent2: '#22d3ee', bg: '#050b16',
    tagline: 'Lê a parede, decide num instante e mete-te na posição certa antes do impacto.',
    view: { w: 400 },
    how: [
      '<b style="color:#22c55e">Seta verde</b>: vai para onde aponta. <b style="color:#ef4444">Seta vermelha</b>: vai para o lado oposto.',
      '<b style="color:#60a5fa">Círculo azul</b>: fica no centro. <b style="color:#eab308">Seta a girar</b>: só conta quando parar.',
      'Toca/clica na direção (ou no centro), desliza o dedo, ou usa as setas e o Espaço. Quanto mais cedo acertares, mais pontos.',
    ],
    controls: ['🖱️ Clique na direção', '👆 Toque ou deslizar', '⌨️ Setas + Espaço'],
    ready: { title: 'Toca para começar', hint: 'Verde segue, vermelha oposto, azul fica. Decide antes do impacto!' },
    setup, update, draw, down, move, up,
    key: (G, e, api) => {
      const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ' ': 'center', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
      if (m) { choose(G, m, api); return true; }
    },
    hud: G => [['Pontos', G.score], ['Paredes', G.n], ['Série', G.streak >= 5 ? '×' + Math.min(5, 1 + Math.floor(G.streak / 5)) : G.streak, G.streak >= 5 ? 'hot' : '']],
    achievements: [
      { id: 'aw.25',  name: 'Olhos de Lince',   icon: '🧱', desc: 'Passa 25 paredes no Muro das Setas.', test: c => ((c.result.meta || {}).walls || 0) >= 25 },
      { id: 'aw.60',  name: 'Cabeça Fria',      icon: '🧊', desc: 'Passa 60 paredes no Muro das Setas.', test: c => ((c.result.meta || {}).walls || 0) >= 60 },
      { id: 'aw.1k',  name: 'Reflexo Invertido', icon: '🔄', desc: 'Faz 1000 pontos no Muro das Setas.', test: c => (c.result.score || 0) >= 1000 },
    ],
  });
})();
