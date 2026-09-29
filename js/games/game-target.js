/* ══════════════════════════════════════════════════════════════════
   Alvo (Target) — treino de pontaria: acerta nos alvos que surgem,
   o mais depressa e o mais ao centro possível. Anéis valem 10/5/2.
   Contra-relógio (30 s, alvos azuis são armadilha), Precisão (20 alvos,
   um de cada vez) e Sobrevivência (3 escapam e acabou).
══════════════════════════════════════════════════════════════════ */
const TargetGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const DIFF = {
    easy:   { r: 40, life: 2.3, max: 2 },
    medium: { r: 33, life: 1.75, max: 3 },
    hard:   { r: 27, life: 1.3, max: 3 },
  };
  const MODES = {
    rush:      { icon: '⏱️', name: 'Contra-relógio', desc: '30 segundos. Vários alvos ao mesmo tempo — os azuis tiram pontos.' },
    precision: { icon: '🎯', name: 'Precisão', desc: '20 alvos, um de cada vez. Conta a pontaria, não a pressa.' },
    survival:  { icon: '💀', name: 'Sobrevivência', desc: 'Cada vez mais alvos, cada vez mais depressa. 3 escapam e acabou.' },
  };

  function setup(api, o) {
    const mode = o.mode || 'rush';
    return { cfg: DIFF[o.diff] || DIFF.medium, mode, targets: [], holes: [], score: 0, hits: 0, shots: 0, misses: 0, escaped: 0, bulls: 0,
      streak: 0, bestStreak: 0, reacts: [], t: 0, time: mode === 'rush' ? 30 : 0, spawnT: .3, spawned: 0, mx: -99, my: -99, mouse: false };
  }

  function spawn(G, api) {
    const c = G.cfg, W = api.W, H = api.H;
    let r = c.r * (G.mode === 'precision' ? .72 : 1);
    if (G.mode === 'survival') r *= Math.max(.7, 1 - G.spawned * .006);
    const kind = G.mode === 'rush' && G.t > 6 && Math.random() < .2 ? 'decoy'
      : Math.random() < .06 ? 'gold'
      : (G.mode !== 'precision' && G.t > 10 && Math.random() < .3) ? 'mover' : 'normal';
    if (kind === 'gold') r *= .7;
    let x, y, tries = 0;
    do { x = U.rand(r + 16, W - r - 16); y = U.rand(r + 80, H - r - 30); tries++; }
    while (tries < 30 && G.targets.some(t => U.dist(t.x, t.y, x, y) < t.r + r + 20));
    const life = G.mode === 'precision' ? 99 : c.life * (G.mode === 'survival' ? Math.max(.55, 1 - G.spawned * .01) : 1) * (kind === 'gold' ? .8 : 1);
    const ang = Math.random() * 6.283;
    G.targets.push({ x, y, r, kind, age: 0, life, vx: kind === 'mover' ? Math.cos(ang) * U.rand(60, 110) : 0, vy: kind === 'mover' ? Math.sin(ang) * U.rand(60, 110) : 0, dead: false });
    G.spawned++;
  }

  function shoot(G, api, x, y) {
    if (G.done) return;
    G.shots++;
    /* o alvo mais "de cima" (último criado) primeiro */
    for (let i = G.targets.length - 1; i >= 0; i--) {
      const t = G.targets[i];
      if (t.dead || t.age < .05) continue;
      const scale = Math.min(1, t.age / .12);
      const d = U.dist(x, y, t.x, t.y), R = t.r * scale;
      if (d > R + 4) continue;
      t.dead = true;
      if (t.kind === 'decoy') {
        G.score = Math.max(0, G.score - 5); G.streak = 0;
        api.float(t.x, t.y, '−5', '#93c5fd', 22); api.flash('#3b82f6', .12); api.sfx.tone(200, .15, 'square', .06);
        burst(api, t, '#60a5fa'); return;
      }
      const q = d / R, ring = q < .25 ? 10 : q < .6 ? 5 : 2;
      let pts = ring * (t.kind === 'gold' ? 3 : 1);
      G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
      if (G.mode === 'rush' && G.streak >= 5) pts += Math.min(5, Math.floor(G.streak / 5));
      G.score += pts; G.hits++; if (ring === 10) G.bulls++;
      G.reacts.push(t.age);
      G.holes.push({ x, y, a: 1 });
      if (G.holes.length > 30) G.holes.shift();
      api.float(t.x, t.y - t.r - 8, (ring === 10 ? 'Mosca! ' : '') + '+' + pts, ring === 10 ? '#fde047' : '#fff', ring === 10 ? 22 : 18);
      burst(api, t, t.kind === 'gold' ? '#fbbf24' : '#f87171');
      api.sfx.noise(.07, .1, 0, 3500, 'highpass'); api.sfx.tone(ring === 10 ? 1320 : ring === 5 ? 990 : 740, .08, 'sine', .08);
      api.vibe(ring === 10 ? 18 : 8);
      if (G.mode === 'precision' && G.hits >= 20) finish(G, api);
      return;
    }
    G.streak = 0;
    api.sfx.tone(160, .05, 'square', .03);
    G.holes.push({ x, y, a: .6, miss: true });
  }

  function burst(api, t, col) {
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; api.spark({ x: t.x, y: t.y, vx: Math.cos(a) * U.rand(120, 260), vy: Math.sin(a) * U.rand(120, 260), color: i % 2 ? col : '#fff', size: U.rand(2, 4), life: .45, gravity: 300 }); }
  }

  function finish(G, api, why) {
    if (G.done) return;
    G.done = true;
    const acc = G.shots ? Math.round(100 * G.hits / G.shots) : 0;
    const avg = G.reacts.length ? Math.round(G.reacts.reduce((a, b) => a + b, 0) / G.reacts.length * 1000) : 0;
    api.over({ score: G.score, won: G.mode !== 'survival', delay: 500, title: why || (G.mode === 'rush' ? 'Tempo!' : G.mode === 'precision' ? 'Série completa' : 'Escaparam 3 alvos'), icon: '🎯',
      stats: [['Acertos', G.hits], ['Precisão', acc + '%'], ['Moscas', G.bulls], ['Reação média', avg ? avg + ' ms' : '—']],
      meta: { acc, bulls: G.bulls, hits: G.hits } });
  }

  function update(G, dt, api) {
    const c = G.cfg;
    G.t += dt;
    if (G.mode === 'rush') { G.time -= dt; if (G.time <= 0) { G.time = 0; finish(G, api); return; } }
    else G.time += dt;
    G.spawnT -= dt;
    const alive = G.targets.filter(t => !t.dead).length;
    let max = G.mode === 'precision' ? 1 : G.mode === 'survival' ? Math.min(6, 1 + Math.floor(G.t / 12)) : c.max;
    if (G.spawnT <= 0 && alive < max && !(G.mode === 'precision' && G.spawned >= 20)) {
      spawn(G, api);
      G.spawnT = G.mode === 'precision' ? .35 : G.mode === 'survival' ? Math.max(.35, .9 - G.t * .012) : U.rand(.25, .6);
    }
    for (const t of G.targets) {
      if (t.dead) continue;
      t.age += dt;
      if (t.kind === 'mover') { t.x += t.vx * dt; t.y += t.vy * dt; if (t.x < t.r || t.x > api.W - t.r) t.vx *= -1; if (t.y < t.r + 70 || t.y > api.H - t.r) t.vy *= -1; }
      if (t.age > t.life) {
        t.dead = true;
        if (t.kind !== 'decoy') {
          G.streak = 0; G.escaped++;
          api.float(t.x, t.y, 'fugiu', 'rgba(255,255,255,.6)', 14);
          if (G.mode === 'survival') { api.sfx.tone(220, .15, 'triangle', .06); api.flash('#ef4444', .1); if (G.escaped >= 3) { finish(G, api); return; } }
        }
      }
    }
    G.targets = G.targets.filter(t => !t.dead);
    G.holes.forEach(h => { h.a -= dt * .25; });
    G.holes = G.holes.filter(h => h.a > 0);
  }

  function draw(G, ctx, W, H, api) {
    const g = ctx.createRadialGradient(W / 2, H * .45, 30, W / 2, H * .5, Math.max(W, H) * .75);
    g.addColorStop(0, '#12343b'); g.addColorStop(1, '#050d12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(45,212,191,.07)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    G.holes.forEach(h => {
      ctx.globalAlpha = Math.max(0, h.a);
      ctx.fillStyle = h.miss ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.arc(h.x, h.y, 3.5, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(h.x, h.y, 5.5, 0, 6.3); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    G.targets.forEach(t => {
      const sc = Math.min(1, t.age / .12) * (t.age > t.life - .2 && t.life < 90 ? Math.max(0, (t.life - t.age) / .2) : 1);
      const R = t.r * sc;
      if (R <= 0) return;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(t.x + 4, t.y + 6, R, 0, 6.3); ctx.fill();
      const cols = t.kind === 'decoy' ? ['#1d4ed8', '#dbeafe'] : t.kind === 'gold' ? ['#d97706', '#fef3c7'] : ['#dc2626', '#fff7ed'];
      [1, .8, .6, .4, .2].forEach((k, i) => { ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.arc(t.x, t.y, R * k, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = t.kind === 'decoy' ? '#1e3a8a' : '#7f1d1d'; ctx.beginPath(); ctx.arc(t.x, t.y, R * .08, 0, 6.3); ctx.fill();
      if (t.kind === 'decoy') { ctx.strokeStyle = '#fff'; ctx.lineWidth = R * .1; ctx.beginPath(); ctx.moveTo(t.x - R * .45, t.y - R * .45); ctx.lineTo(t.x + R * .45, t.y + R * .45); ctx.moveTo(t.x + R * .45, t.y - R * .45); ctx.lineTo(t.x - R * .45, t.y + R * .45); ctx.stroke(); }
      if (t.life < 90) {
        const k = 1 - t.age / t.life;
        ctx.strokeStyle = k < .3 ? '#f87171' : 'rgba(45,212,191,.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(t.x, t.y, R + 6, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke();
      }
    });
    if (G.mode === 'rush') {
      const k = G.time / 30;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(14, H - 14, W - 28, 5);
      ctx.fillStyle = k < .2 ? '#ef4444' : '#2dd4bf'; ctx.fillRect(14, H - 14, (W - 28) * k, 5);
    }
    if (G.mode === 'survival') {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < G.escaped ? '#ef4444' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(W / 2 - 22 + i * 22, H - 18, 7, 0, 6.3); ctx.fill(); }
    }
    if (G.mouse) {
      ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(G.mx, G.my, 12, 0, 6.3);
      [[-20, -6], [6, 20]].forEach(([a, b]) => { ctx.moveTo(G.mx + a, G.my); ctx.lineTo(G.mx + b, G.my); ctx.moveTo(G.mx, G.my + a); ctx.lineTo(G.mx, G.my + b); });
      ctx.stroke(); ctx.fillStyle = '#5eead4'; ctx.beginPath(); ctx.arc(G.mx, G.my, 1.8, 0, 6.3); ctx.fill();
    }
  }

  return ArcadeKit.create({
    id: 'target', title: 'Alvo', icon: '🎯',
    accent: '#2dd4bf', accent2: '#f87171', bg: '#050d12', aspect: 'wide', cursor: 'none',
    tagline: 'Rapidez e pontaria. Acerta nos alvos antes que desapareçam — de preferência na mosca.',
    view: { w: 600 },
    modes: Object.keys(MODES).map(k => ({ id: k, ...MODES[k] })),
    how: [
      'Clica ou toca nos alvos. Centro = <b>10</b>, anel do meio = 5, fora = 2. O anel à volta mostra o tempo que falta.',
      'No Contra-relógio há alvos <b style="color:#60a5fa">azuis com ✕</b>: não lhes acertes (−5). Os <b style="color:#fbbf24">dourados</b> valem o triplo.',
      'Séries de acertos dão bónus. Tiros falhados baixam a precisão.',
    ],
    controls: ['🖱️ Clique', '👆 Toque'],
    ready: { title: 'Toca para começar', hint: 'Acerta nos alvos — quanto mais ao centro, mais pontos.' },
    setup, update, draw,
    down: (G, x, y, api, e) => { G.mouse = e.pointerType === 'mouse'; G.mx = x; G.my = y; shoot(G, api, x, y); },
    move: (G, x, y, api, e) => { if (e.pointerType === 'mouse') { G.mouse = true; G.mx = x; G.my = y; } },
    hud: G => [['Pontos', G.score], G.mode === 'rush' ? ['Tempo', Math.ceil(G.time) + 's', G.time < 6 ? 'hot' : ''] : G.mode === 'precision' ? ['Alvos', Math.min(20, G.hits) + '/20'] : ['Tempo', Math.floor(G.time) + 's'], ['Série', G.streak, G.streak >= 5 ? 'hot' : '']],
    achievements: [
      { id: 'tg.bull10', name: 'Olho de Águia', icon: '🦅', desc: '10 moscas numa só partida do Alvo.', test: c => ((c.result.meta || {}).bulls || 0) >= 10 },
      { id: 'tg.200',    name: 'Atirador de Elite', icon: '🎯', desc: 'Faz 200 pontos no Contra-relógio do Alvo.', test: c => /^rush/.test(c.result.mode || '') && (c.result.score || 0) >= 200 },
      { id: 'tg.acc',    name: 'Sem Desperdício', icon: '💯', desc: 'Termina uma partida com 95% de precisão (mín. 15 acertos).', test: c => ((c.result.meta || {}).acc || 0) >= 95 && ((c.result.meta || {}).hits || 0) >= 15 },
    ],
  });
})();
