/* ══════════════════════════════════════════════════════════════════
   Lança-Facas (Knife Throw) — crava facas num tronco que gira sem
   acertar nas que já lá estão. 100% original, canvas procedural.
   Fases com padrões de rotação cada vez mais traiçoeiros; a cada 5.ª
   fase há um tronco-chefe. Colisão geométrica (segmento a segmento),
   não por ângulo mágico: o que se vê é o que conta.
══════════════════════════════════════════════════════════════════ */
const KnifeThrowGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;

  const R = 84;                 /* raio do tronco */
  const EMBED = 16;             /* quanto a faca entra na madeira */
  const BLADE = 58, HANDLE = 40, KLEN = BLADE + HANDLE + 6;
  const OUT = KLEN - EMBED;     /* parte visível fora do tronco */
  const SPEED = 2700;           /* velocidade da faca lançada */

  const DIFF = {
    easy:   { spd: .78, pre: s => (s < 3 ? 0 : Math.min(2, Math.floor(s / 3))), knives: s => Math.min(8, 5 + Math.floor(s / 2)) },
    medium: { spd: 1,   pre: s => Math.min(3, Math.floor((s + 1) / 3)),          knives: s => Math.min(10, 6 + Math.floor(s / 2)) },
    hard:   { spd: 1.22, pre: s => Math.min(4, 1 + Math.floor(s / 2)),           knives: s => Math.min(11, 7 + Math.floor(s / 2)) },
  };

  /* padrões de rotação: devolvem o multiplicador da velocidade base */
  const PATTERNS = [
    t => 1,
    t => 1 + .65 * Math.sin(t * 1.8),
    t => 1.7 * Math.sin(t * .95),
    t => (Math.sin(t * 2.3) > -.25 ? 1.55 : -.55),
    t => .25 + 1.9 * Math.max(0, Math.sin(t * 2.7)),
    t => (Math.floor(t / 1.6) % 2 ? -1.35 : 1.35),
  ];

  function newStage(G, n) {
    const cfg = DIFF[G.diff] || DIFF.medium;
    const boss = n % 5 === 0;
    G.stage = n; G.boss = boss;
    G.total = cfg.knives(n) + (boss ? 2 : 0);
    G.left = G.total;
    G.stuck = []; G.apples = [];
    G.rot = Math.random() * TAU;
    G.dir = Math.random() < .5 ? 1 : -1;
    G.base = Math.min(3.7, (1.65 + n * .075) * cfg.spd) * (boss ? 1.1 : 1);
    G.pat = n === 1 ? 0 : n === 2 ? 0 : n === 3 ? 1 : n === 4 ? 2 : boss ? 4 + (n / 5) % 2 : U.randi(1, PATTERNS.length - 1);
    G.omega = 0; G.pt = 0;
    const pre = cfg.pre(n) + (boss ? 1 : 0);
    let tries = 0;
    while (G.stuck.length < pre && tries++ < 200) {
      const a = Math.random() * TAU;
      if (G.stuck.every(k => Math.abs(U.angDiff(a, k.a)) > .55)) G.stuck.push({ a, wob: 0 });
    }
    const nA = n === 1 ? 1 : U.randi(0, boss ? 3 : 2);
    tries = 0;
    while (G.apples.length < nA && tries++ < 200) {
      const a = Math.random() * TAU;
      if (G.stuck.every(k => Math.abs(U.angDiff(a, k.a)) > .45) && G.apples.every(p => Math.abs(U.angDiff(a, p.a)) > .6)) G.apples.push({ a });
    }
    /* textura do tronco (fixa por fase, gira com ele) */
    G.rings = Array.from({ length: 5 }, (_, i) => ({ r: R * (.2 + i * .16) + U.rand(-3, 3), w: U.rand(.8, 2) }));
    G.knots = Array.from({ length: 3 }, () => ({ a: Math.random() * TAU, d: U.rand(20, R - 22), s: U.rand(4, 8) }));
    G.cracks = Array.from({ length: 4 }, () => ({ a: Math.random() * TAU, l: U.rand(.25, .55) }));
    G.hitFx = 0; G.clearT = 0; G.flying = null; G.cool = .15;
  }

  function setup(api, o) {
    const G = { diff: o.diff || 'medium', score: 0, applesTot: 0, thrown: 0, debris: [], flyOff: [], over: false, dead: null };
    newStage(G, 1);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[facas] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  /* altura virtual: em ecrãs baixos o palco encolhe (zoom < 1) em vez de a
     faca à espera ficar por baixo das facas cravadas no fundo do tronco */
  const MINH = 560;
  const VH = api => Math.max(api.H, MINH);
  const zoom = api => api.H / VH(api);
  const cx = (G, api) => api.W / 2;
  const cy = (G, api) => Math.max(R + OUT + 48, Math.min(VH(api) * .36, 300));
  const restY = api => VH(api) - KLEN - 26;
  /* coordenadas do jogo → ecrã (partículas e textos do kit não têm zoom) */
  const scr = (api, x, y) => { const z = zoom(api); return [api.W / 2 + (x - api.W / 2) * z, y * z]; };
  const spark = (api, o) => { const [x, y] = scr(api, o.x, o.y), z = zoom(api); o.x = x; o.y = y; o.vx *= z; o.vy *= z; api.spark(o); };
  const float = (api, x, y, t, c, s) => { const [a, b] = scr(api, x, y); api.float(a, b, t, c, s); };

  function throwKnife(G, api) {
    if (G.over || G.flying || G.cool > 0 || G.left <= 0 || G.clearT > 0) return;
    G.flying = { y: restY(api) };
    G.left--; G.thrown++;
    api.sfx.noise(.09, .06, 0, 2400, 'highpass');
    api.sfx.tone(520, .07, 'triangle', .04, 0, 900);
  }

  /* pontos ao longo de uma faca cravada no ângulo-mundo a (da ponta ao pomo) */
  function knifePts(x0, y0, a) {
    const c = Math.cos(a), s = Math.sin(a), pts = [];
    for (let i = 0; i <= 6; i++) { const r = R - EMBED + 8 + (OUT - 8) * i / 6; pts.push([x0 + c * r, y0 + s * r]); }
    return pts;
  }

  function update(G, dt, api) {
    const X = cx(G, api), Y = cy(G, api);
    G.pt += dt;
    const target = G.base * G.dir * PATTERNS[G.pat](G.pt);
    G.omega = U.lerp(G.omega, target, Math.min(1, dt * 7));
    if (!G.over) G.rot += G.omega * dt;
    G.cool = Math.max(0, G.cool - dt);
    G.hitFx = Math.max(0, G.hitFx - dt * 5);
    G.stuck.forEach(k => { k.wob = Math.max(0, k.wob - dt * 6); });

    /* faca em voo */
    const f = G.flying;
    if (f && !G.over) {
      const prev = f.y;
      f.y -= SPEED * dt;
      const rim = Y + R;
      /* colisão com cabos/lâminas de facas cravadas (e com maçãs) enquanto
         a lâmina atravessa a zona exterior ao tronco */
      if (f.y < rim + OUT + 6) {
        const top = Math.max(f.y, rim - 2), bot = Math.min(prev + KLEN, f.y + KLEN);
        for (const k of G.stuck) {
          const pts = knifePts(X, Y, k.a + G.rot);
          if (pts.some(([px, py]) => Math.abs(px - X) < 10 && py > top - 4 && py < bot)) { fail(G, api, k); return; }
        }
        for (let i = G.apples.length - 1; i >= 0; i--) {
          const a = G.apples[i].a + G.rot, ax = X + Math.cos(a) * (R + 10), ay = Y + Math.sin(a) * (R + 10);
          if (Math.abs(ax - X) < 16 && ay > top - 12 && ay < bot) {
            G.apples.splice(i, 1); G.applesTot++; G.score += 2;
            float(api, ax, ay - 10, '+2 🍎', '#ff6b6b', 18);
            for (let j = 0; j < 12; j++) spark(api, { x: ax, y: ay, vx: U.rand(-160, 160), vy: U.rand(-220, 40), color: j % 2 ? '#ef4444' : '#fca5a5', size: U.rand(2, 4), life: .6, gravity: 600 });
            api.sfx.tone(880, .08, 'sine', .08); api.sfx.tone(1320, .1, 'sine', .06, .05);
          }
        }
      }
      if (f.y <= rim - EMBED) {
        /* cravou */
        G.flying = null; G.cool = .08;
        G.stuck.push({ a: Math.PI / 2 - G.rot, wob: 1 });
        G.score += 1; G.hitFx = 1;
        api.shake(4, .12); api.vibe(12); api.hitstop(.035);
        api.sfx.noise(.08, .14, 0, 500, 'lowpass'); api.sfx.tone(140, .09, 'triangle', .1);
        for (let j = 0; j < 9; j++) spark(api, { x: X + U.rand(-6, 6), y: rim, vx: U.rand(-190, 190), vy: U.rand(-60, 160), color: j % 3 ? '#c98a4b' : '#f3c58a', size: U.rand(1.5, 3.5), life: .55, gravity: 700 });
        if (G.left === 0) G.clearT = .001;
      }
    }

    /* fase limpa → o tronco rebenta */
    if (G.clearT > 0) {
      G.clearT += dt;
      if (G.clearT > .28 && !G.burst) {
        G.burst = true;
        const bonus = G.boss ? 10 : 3;
        G.score += bonus;
        G.stuck.forEach(k => {
          const a = k.a + G.rot;
          G.flyOff.push({ x: X + Math.cos(a) * (R + 30), y: Y + Math.sin(a) * (R + 30), vx: Math.cos(a) * U.rand(160, 320), vy: Math.sin(a) * U.rand(160, 320) - 220, a: a - Math.PI / 2, va: U.rand(-9, 9), life: 1.4 });
        });
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * TAU + U.rand(-.2, .2);
          G.debris.push({ x: X, y: Y, vx: Math.cos(a) * U.rand(180, 300), vy: Math.sin(a) * U.rand(180, 300) - 150, a: a, va: U.rand(-6, 6), s: U.rand(22, 34), life: 1.3, boss: G.boss });
        }
        G.stuck = []; G.apples = [];
        api.shake(10, .3); api.vibe([20, 30, 40]);
        api.sfx.noise(.35, .2, 0, 300, 'lowpass'); api.sfx.arp([392, 523, 659], .06, .12, 'triangle', .08);
        float(api, X, Y, '+' + bonus, '#fde68a', 26);
      }
      if (G.clearT > 1.15) {
        G.burst = false;
        newStage(G, G.stage + 1);
        api.banner(G.boss ? 'Tronco-chefe!' : 'Fase ' + G.stage, G.boss ? 'Fase ' + G.stage : (G.total + ' facas'));
        if (G.boss) api.sfx.tone(110, .5, 'sawtooth', .07, 0, 80);
      }
    }

    stepBits(G, dt);
    if (G.dead) {
      const d = G.dead; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 1500 * dt; d.a += d.va * dt;
    }
  }

  function stepBits(G, dt) {
    [G.flyOff, G.debris].forEach(list => {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.a += b.va * dt; b.life -= dt;
        if (b.life <= 0) list.splice(i, 1);
      }
    });
  }

  function fail(G, api, k) {
    G.over = true;
    const f = G.flying; G.flying = null;
    G.dead = { x: cx(G, api), y: f.y, vx: U.rand(-1, 1) > 0 ? 260 : -260, vy: 180, a: 0, va: U.rand(14, 20) * (Math.random() < .5 ? -1 : 1) };
    if (k) k.wob = 1;
    api.shake(12, .35); api.flash('#ef4444', .2); api.vibe(120);
    api.sfx.tone(1900, .06, 'square', .06); api.sfx.tone(1250, .18, 'triangle', .07, .03, 700);
    api.over({
      score: G.score, won: false, delay: 950,
      title: 'Acertaste numa faca!', icon: '🔪',
      stats: [['Fase', G.stage], ['Facas cravadas', G.thrown - 1], ['Maçãs', G.applesTot]],
      meta: { stage: G.stage },
    });
  }

  /* ── desenho ─────────────────────────────────────────────────────── */
  function drawKnife(ctx, x, y, rot, alpha, boss) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha == null ? 1 : alpha;
    /* lâmina: ponta em (0,0), corpo para +y */
    const g = ctx.createLinearGradient(-6, 0, 6, 0);
    g.addColorStop(0, '#8d97a8'); g.addColorStop(.45, '#f5f7fb'); g.addColorStop(1, '#a9b2c1');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, 13); ctx.lineTo(6, BLADE); ctx.lineTo(-5, BLADE); ctx.lineTo(-5, 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(1, 8); ctx.lineTo(1, BLADE - 3); ctx.stroke();
    /* guarda */
    ctx.fillStyle = boss ? '#e5e7eb' : '#d4a64a'; U.rr(ctx, -10, BLADE - 1, 20, 6, 2); ctx.fill();
    /* cabo */
    ctx.fillStyle = '#2a2f3d'; U.rr(ctx, -5.5, BLADE + 5, 11, HANDLE - 4, 4); ctx.fill();
    ctx.strokeStyle = '#4b5569'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { const yy = BLADE + 11 + i * 8; ctx.beginPath(); ctx.moveTo(-5, yy); ctx.lineTo(5, yy + 4); ctx.stroke(); }
    ctx.fillStyle = '#d4a64a'; ctx.beginPath(); ctx.arc(0, BLADE + HANDLE + 2, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawLog(ctx, G, X, Y) {
    ctx.save(); ctx.translate(X, Y);
    /* sombra */
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(8, 14, R + 4, R + 4, 0, 0, TAU); ctx.fill();
    ctx.rotate(G.rot);
    const g = ctx.createRadialGradient(-20, -24, 6, 0, 0, R);
    if (G.boss) { g.addColorStop(0, '#9b4a3a'); g.addColorStop(.7, '#6a2a22'); g.addColorStop(1, '#3d1612'); }
    else { g.addColorStop(0, '#e1a768'); g.addColorStop(.65, '#b97a43'); g.addColorStop(1, '#8a5530'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = G.boss ? 'rgba(20,5,5,.35)' : 'rgba(92,52,22,.42)';
    G.rings.forEach(r => { ctx.lineWidth = r.w; ctx.beginPath(); ctx.arc(0, 0, r.r, 0, TAU); ctx.stroke(); });
    ctx.lineWidth = 1.6;
    G.cracks.forEach(c => { ctx.beginPath(); ctx.moveTo(Math.cos(c.a) * 6, Math.sin(c.a) * 6); ctx.lineTo(Math.cos(c.a + .08) * R * c.l, Math.sin(c.a + .08) * R * c.l); ctx.stroke(); });
    ctx.fillStyle = G.boss ? 'rgba(25,6,6,.5)' : 'rgba(90,50,20,.5)';
    G.knots.forEach(k => { ctx.beginPath(); ctx.ellipse(Math.cos(k.a) * k.d, Math.sin(k.a) * k.d, k.s, k.s * .6, k.a, 0, TAU); ctx.fill(); });
    /* casca / aro */
    if (G.boss) {
      ctx.strokeStyle = '#9aa3b2'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e5e7eb';
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3), 2.6, 0, TAU); ctx.fill(); }
    } else {
      ctx.strokeStyle = '#5b3719'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R - 2.5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,170,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R - 7, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    }
    if (G.hitFx > 0) { ctx.globalAlpha = G.hitFx * .35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  function drawApple(ctx, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 12);
    g.addColorStop(0, '#ff8a8a'); g.addColorStop(1, '#c81e1e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-4, 0, 9, 0, TAU); ctx.arc(4, 0, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5b3719'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(1, -13); ctx.stroke();
    ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.ellipse(5, -12, 5, 2.4, -.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════
     3D — tronco de madeira a sério (anéis e casca), facas com lâmina de
     aço e cabo, maçãs, lascas a voar quando o tronco rebenta, parede de
     tábuas com um foco de luz por cima. O plano do tronco bate certo com
     o desenho 2D (partículas e textos do kit caem no sítio certo).
  ════════════════════════════════════════════════════════════════ */
  function woodTex(boss) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(118, 112, 8, 128, 128, 128);
    if (boss) { g.addColorStop(0, '#a24b3a'); g.addColorStop(.7, '#6a2a22'); g.addColorStop(1, '#3d1612'); }
    else { g.addColorStop(0, '#e9b378'); g.addColorStop(.65, '#c08249'); g.addColorStop(1, '#8a5530'); }
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = boss ? 'rgba(20,5,5,.35)' : 'rgba(92,52,22,.45)';
    for (let r = 10; r < 124; r += 9 + Math.random() * 6) { x.lineWidth = .8 + Math.random() * 1.6; x.beginPath(); x.ellipse(128 + Math.random() * 3, 128 + Math.random() * 3, r, r * (.97 + Math.random() * .06), Math.random(), 0, 6.3); x.stroke(); }
    x.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = Math.random() * 6.3; x.beginPath(); x.moveTo(128 + Math.cos(a) * 8, 128 + Math.sin(a) * 8); x.lineTo(128 + Math.cos(a + .08) * (40 + Math.random() * 60), 128 + Math.sin(a + .08) * (40 + Math.random() * 60)); x.stroke(); }
    x.fillStyle = boss ? 'rgba(25,6,6,.5)' : 'rgba(90,50,20,.5)';
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.3, d = 30 + Math.random() * 70; x.beginPath(); x.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 7, 4, a, 0, 6.3); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function barkTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d');
    x.fillStyle = '#5b3719'; x.fillRect(0, 0, 256, 32);
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '30,15,5' : '140,95,55'},.5)`; x.fillRect(Math.random() * 256, 0, 1 + Math.random() * 3, 32); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 3; return t;
  }
  function knifeModel() {
    const g = new THREE.Group();
    /* lâmina: perfil com ponta (tip em y=0, corpo para −y) */
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(6, -13); s.lineTo(6, -BLADE); s.lineTo(-5, -BLADE); s.lineTo(-5, -11); s.lineTo(0, 0);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: true, bevelThickness: .8, bevelSize: .6, bevelSegments: 2 }), Arcade3D.std('#e5e9f0', { metalness: .95, roughness: .18 }));
    blade.position.z = -1.2; blade.castShadow = true; g.add(blade);
    const guard = new THREE.Mesh(Arcade3D.roundBox(.3), Arcade3D.std('#d4a64a', { metalness: .8, roughness: .3 })); guard.scale.set(20, 6, 7); guard.position.y = -BLADE - 2; guard.castShadow = true; g.add(guard);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, HANDLE - 4, 12), Arcade3D.std('#2a2f3d', { roughness: .7 })); handle.position.y = -BLADE - 5 - (HANDLE - 4) / 2; handle.castShadow = true; g.add(handle);
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(5.4, .7, 6, 16), Arcade3D.std('#4b5569', { roughness: .6 })); r.rotation.x = Math.PI / 2; r.position.y = -BLADE - 11 - i * 8; g.add(r); }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(5.5, 14, 10), Arcade3D.std('#d4a64a', { metalness: .8, roughness: .3 })); pommel.position.y = -BLADE - HANDLE - 2; g.add(pommel);
    return g;
  }
  function appleModel() {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 16), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: .35, metalness: .05 })); a.scale.set(1.08, .95, 1); a.castShadow = true; g.add(a);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, 7, 6), Arcade3D.std('#5b3719')); st.position.y = 12; g.add(st);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), Arcade3D.std('#4ade80')); lf.scale.set(1.3, .35, .7); lf.position.set(4.5, 13, 0); lf.rotation.z = -.5; g.add(lf);
    return g;
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const scene = new THREE.Scene(); scene.environment = Arcade3D.env();
    scene.add(new THREE.HemisphereLight('#ffe9d0', '#2a1c12', 1.1));
    const spot = new THREE.SpotLight('#fff1dc', 3.2, 0, .75, .6, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0004;
    scene.add(spot, spot.target);
    const cam = new THREE.PerspectiveCamera(40, 1, 10, 4000);
    /* parede de tábuas */
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) { x.fillStyle = ['#3a2a1d', '#33251a', '#3e2d20'][i % 3]; x.fillRect(0, i * 32, 256, 32); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, i * 32, 256, 2); for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(Math.random() * 256, i * 32 + Math.random() * 30, 20 + Math.random() * 40, 1); } }
    const wt = new THREE.CanvasTexture(c); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(3, 5);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2400), new THREE.MeshStandardMaterial({ map: wt, roughness: .9 }));
    wall.position.z = -70; wall.receiveShadow = true; scene.add(wall);
    const log = new THREE.Group();
    const T = { wood: woodTex(false), boss: woodTex(true), bark: barkTex() };
    const faceM = new THREE.MeshStandardMaterial({ map: T.wood, roughness: .75 });
    const sideM = new THREE.MeshStandardMaterial({ map: T.bark, roughness: .95 });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 44, 48), [sideM, faceM, faceM]);
    cyl.rotation.x = Math.PI / 2; cyl.castShadow = true; cyl.receiveShadow = true; log.add(cyl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 3, 4.2, 10, 48), Arcade3D.std('#9aa3b2', { metalness: .9, roughness: .25 })); ring.position.z = 22; ring.visible = false; log.add(ring);
    const rivets = new THREE.Group(); for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), Arcade3D.std('#e5e7eb', { metalness: .9, roughness: .2 })); const a = i / 10 * Math.PI * 2; r.position.set(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3), 25); rivets.add(r); } rivets.visible = false; log.add(rivets);
    scene.add(log);
    G.r3 = { renderer, scene, cam, spot, wall, wt, T, log, cyl, faceM, ring, rivets, pool: Arcade3D.pool(scene), stageKey: -1 };
    api.stage.style.background = '#0f0c0a';
  }

  function draw3D(G, ctx, W, H, api) {
    const R3 = G.r3, P = R3.pool, z = zoom(api);
    Arcade3D.fit(api.stage, R3.cam);
    /* coordenadas: as do desenho 2D (com zoom), plano z=0 = ecrã */
    const SX = x => (x - W / 2) * z, SY = y => H / 2 - y * z;
    const D = (H / 2) / Math.tan(R3.cam.fov * Math.PI / 360), [shx, shy] = api.shakeXY;
    R3.cam.position.set(-shx, shy, D); R3.cam.lookAt(-shx, shy, 0); R3.cam.far = D + 800; R3.cam.updateProjectionMatrix();
    const X0 = cx(G, api), Y0 = cy(G, api);
    R3.spot.position.set(SX(X0) - 120 * z, SY(Y0) + 380 * z, 520); R3.spot.target.position.set(SX(X0), SY(Y0), 0);
    /* tronco */
    if (R3.stageKey !== G.stage) {
      R3.stageKey = G.stage;
      R3.faceM.map.dispose(); R3.faceM.map = woodTex(G.boss); R3.faceM.needsUpdate = true;
      R3.ring.visible = R3.rivets.visible = G.boss;
    }
    const logVisible = G.clearT <= .28 || !G.burst;
    R3.log.visible = logVisible;
    R3.log.position.set(SX(X0), SY(Y0), 0); R3.log.rotation.z = -G.rot; R3.log.scale.setScalar(z * (1 + G.hitFx * .03));
    const place = (m, x, y, rot, a) => { m.position.set(SX(x), SY(y), 6 * z); m.rotation.set(0, 0, -rot); m.scale.setScalar(z); };
    P.begin();
    if (logVisible) G.stuck.forEach(k => { const a = k.a + G.rot, w = k.wob * Math.sin(api.t * 60) * .05; const m = P.get('knife', knifeModel); place(m, X0 + Math.cos(a) * (R - EMBED), Y0 + Math.sin(a) * (R - EMBED), a - Math.PI / 2 + w); });
    G.apples.forEach(pp => { const a = pp.a + G.rot, m = P.get('apple', appleModel); m.position.set(SX(X0 + Math.cos(a) * (R + 10)), SY(Y0 + Math.sin(a) * (R + 10)), 8 * z); m.rotation.set(0, api.t, -(a + Math.PI / 2)); m.scale.setScalar(z); });
    G.debris.forEach(d => { const m = P.get('chunk' + (d.boss ? 'B' : ''), () => { const mm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 30, 8, 1, false, -.45, .9), [new THREE.MeshStandardMaterial({ map: R3.T.bark, roughness: .9 }), new THREE.MeshStandardMaterial({ map: d.boss ? R3.T.boss : R3.T.wood }), new THREE.MeshStandardMaterial({ map: d.boss ? R3.T.boss : R3.T.wood })]); mm.castShadow = true; return mm; }); m.position.set(SX(d.x), SY(d.y), 0); m.rotation.set(Math.PI / 2 + d.a * .5, d.a * .3, -d.a); m.scale.set(d.s * z, z, d.s * z); });
    G.flyOff.forEach(k => { const m = P.get('knife', knifeModel); place(m, k.x, k.y, k.a); m.rotation.x = k.life * 4; });
    if (G.flying) { const m = P.get('knife', knifeModel); place(m, X0, G.flying.y, 0); }
    else if (!G.over && G.left > 0 && G.clearT === 0) { const lift = G.cool > 0 ? G.cool / .15 * 26 : 0; const m = P.get('knife', knifeModel); place(m, X0, restY(api) + lift, 0); }
    if (G.dead) { const m = P.get('knife', knifeModel); place(m, G.dead.x, G.dead.y, G.dead.a); m.rotation.y = G.dead.a * .7; }
    P.end();
    R3.renderer.render(R3.scene, R3.cam);
    /* contador de facas (2D, canto inferior esquerdo) */
    const n = G.total, top = H - 30 - n * 17;
    for (let i = 0; i < n; i++) {
      const used = i >= G.left;
      ctx.save(); ctx.translate(22, top + i * 17); ctx.rotate(-Math.PI / 4);
      ctx.globalAlpha = used ? .22 : .95;
      ctx.fillStyle = used ? '#6b7280' : '#e5e7eb';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3, -4); ctx.lineTo(3, 3); ctx.lineTo(-3, 3); ctx.lineTo(-3, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = used ? '#4b5563' : '#d4a64a'; ctx.fillRect(-2, 3, 4, 7);
      ctx.restore();
    }
  }

  function destroy(G) {
    const R3 = G.r3; if (!R3) return;
    Object.values(R3.T).forEach(t => t.dispose()); R3.wt.dispose();
    Arcade3D.disposeOwn(R3.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }
  function draw2D(G, ctx, W, H, api) {
    const X = cx(G, api), z = zoom(api), Y = cy(G, api);
    /* fundo: oficina escura, foco de luz sobre o tronco */
    const bg = ctx.createRadialGradient(X, Y * z, 20, X, Y * z, Math.max(W, H) * .9);
    bg.addColorStop(0, G.boss ? '#3a1715' : '#2c2118'); bg.addColorStop(.55, '#15110e'); bg.addColorStop(1, '#0a0807');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 8); ctx.stroke(); }
    ctx.save();
    if (z < 1) { ctx.translate(W / 2 * (1 - z), 0); ctx.scale(z, z); }
    H = VH(api);

    /* facas cravadas (por baixo do tronco, que esconde a parte enterrada) */
    G.stuck.forEach(k => {
      const a = k.a + G.rot, w = k.wob * Math.sin(api.t * 60) * .05;
      drawKnife(ctx, X + Math.cos(a) * (R - EMBED), Y + Math.sin(a) * (R - EMBED), a - Math.PI / 2 + w, 1, G.boss);
    });
    if (G.clearT <= .28 || !G.burst) drawLog(ctx, G, X, Y);
    G.apples.forEach(p => { const a = p.a + G.rot; drawApple(ctx, X + Math.cos(a) * (R + 10), Y + Math.sin(a) * (R + 10), a); });

    /* estilhaços do tronco */
    G.debris.forEach(d => {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a); ctx.globalAlpha = Math.min(1, d.life);
      ctx.fillStyle = d.boss ? '#7a3328' : '#b97a43';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, d.s, -.45, .45); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = d.boss ? '#3d1612' : '#5b3719'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, d.s - 1.5, -.45, .45); ctx.stroke();
      ctx.restore();
    });
    G.flyOff.forEach(k => drawKnife(ctx, k.x, k.y, k.a, Math.min(1, k.life)));

    /* faca em voo / à espera */
    if (G.flying) {
      ctx.globalAlpha = .18; drawKnife(ctx, X, G.flying.y + 40, 0); ctx.globalAlpha = 1;
      drawKnife(ctx, X, G.flying.y, 0);
    } else if (!G.over && G.left > 0 && G.clearT === 0) {
      const lift = G.cool > 0 ? G.cool / .15 * 26 : 0;
      drawKnife(ctx, X, restY(api) + lift, 0);
    }
    if (G.dead) drawKnife(ctx, G.dead.x, G.dead.y, G.dead.a);

    /* contador de facas (canto inferior esquerdo) */
    const n = G.total, top = H - 30 - n * 17;
    for (let i = 0; i < n; i++) {
      const used = i >= G.left;
      ctx.save(); ctx.translate(22, top + i * 17); ctx.rotate(-Math.PI / 4);
      ctx.globalAlpha = used ? .22 : .95;
      ctx.fillStyle = used ? '#6b7280' : '#e5e7eb';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3, -4); ctx.lineTo(3, 3); ctx.lineTo(-3, 3); ctx.lineTo(-3, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = used ? '#4b5563' : '#d4a64a'; ctx.fillRect(-2, 3, 4, 7);
      ctx.restore();
    }
    ctx.restore();
  }

  const game = ArcadeKit.create({
    id: 'knife-throw', title: 'Lança-Facas', icon: '🔪',
    accent: '#fb923c', accent2: '#f2b344', bg: '#0f0c0a', transparent: true, destroy,
    tagline: 'Crava todas as facas no tronco que gira — sem tocar nas que já lá estão.',
    view: { w: 400 },
    how: [
      'Toca, clica ou carrega em <b>Espaço</b> para lançar uma faca a direito.',
      'Se a faca bater noutra já cravada, acabou. Espera pela abertura certa.',
      'Acerta nas <b>maçãs</b> para +2. Cada 5.ª fase é um tronco-chefe com rotação traiçoeira.',
    ],
    controls: ['🖱️ Clique', '👆 Toque', '⌨️ Espaço'],
    ready: { title: 'Toca para lançar', hint: 'Cada toque lança uma faca. Crava-as todas para passar de fase.' },
    tapStarts: true,
    setup, update, draw,
    down: (G, x, y, api) => throwKnife(G, api),
    key: (G, e, api) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') { throwKnife(G, api); return true; } },
    hud: G => [['Pontos', G.score], ['Fase', G.stage + (G.boss ? ' 👑' : '')], ['🍎', G.applesTot]],
    achievements: [
      { id: 'kt.s5',   name: 'Mão Certeira',   icon: '🔪', desc: 'Chega à fase 5 do Lança-Facas.', test: c => ((c.result.meta || {}).stage || 0) >= 5 },
      { id: 'kt.s10',  name: 'Lenhador',       icon: '🪓', desc: 'Chega à fase 10 do Lança-Facas.', test: c => ((c.result.meta || {}).stage || 0) >= 10 },
      { id: 'kt.100',  name: 'Cem Lâminas',    icon: '⚔️', desc: 'Faz 100 pontos no Lança-Facas.', test: c => (c.result.score || 0) >= 100 },
    ],
  });

  return game;
})();
