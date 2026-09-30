/* ══════════════════════════════════════════════════════════════════
   Parte-Tijolos (Brick Breaker) — raquete, bola, parede de tijolos.
   12 níveis desenhados à mão e depois níveis gerados. Tijolos de 1 a
   4 toques, metal (indestrutível), explosivos e de prenda; 7 cápsulas
   (larga, multibola, lenta, laser, fogo, vida, e a má: encolhe).
   Rato: raquete segue o cursor. Toque: arrasto relativo (o dedo não
   tapa a bola). Colisão bola–tijolo em sub-passos, eixo pela menor
   penetração.
══════════════════════════════════════════════════════════════════ */
const BrickBreakerGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const COLS = 10, BW = 37.2, BH = 16, TOP = 92, LEFT = 14, BR = 6;
  const LEVELS = [
    ['..........', '.11111111.', '.11111111.', '.22222222.', '.22222222.', '..........', '...G..G...'],
    ['1.1.1.1.1.', '.2.2.2.2.2', '1.1.1.1.1.', '.2.2.2.2.2', '1.1.1.1.1.', '.G.2.2.G.2'],
    ['3333333333', '2........2', '2.111111.2', '2.1GXX1.2.', '2.111111.2', '2........2', '3333333333'],
    ['....11....', '...1221...', '..123321..', '.12344321.', '..123321..', '...1G21...', '....11....'],
    ['MM......MM', '1111111111', '2222XX2222', '3333333333', '..MMMMMM..', '..G....G..'],
    ['1.........', '12........', '123.......', '1234......', '12341.....', '123412....', '1234123...', '12341234GX'],
    ['X1X1X1X1X1', '1111111111', '2222222222', 'M2M2M2M2M2', '3333333333', '..G....G..'],
    ['4........4', '.4......4.', '..4XXXX4..', '...4GG4...', '..4....4..', '.4......4.', '4........4'],
    ['1111111111', 'M.M.M.M.M.', '2222222222', '.M.M.M.M.M', '3333333333', 'M.M.GG.M.M', '4444444444'],
    ['..333333..', '.3......3.', '3..4..4..3', '3........3', '3.4....4.3', '3..4444..3', '.3..GX..3.', '..333333..'],
    ['MMMMMMMMMM', '4X4X4X4X4X', '3333333333', '2222222222', '1111111111', 'MMMM..MMMM', '....GG....'],
    ['4444444444', '4MMMMMMMM4', '4M333333M4', '4M3XXXX3M4', '4M3GGGG3M4', '4M333333M4', '4MMM..MMM4', '4444444444'],
  ];
  const COL = { 1: ['#60a5fa', '#1d4ed8'], 2: ['#4ade80', '#15803d'], 3: ['#fbbf24', '#b45309'], 4: ['#f472b6', '#be185d'], X: ['#fb923c', '#c2410c'], G: ['#c084fc', '#7e22ce'] };
  const PW = { easy: 98, medium: 82, hard: 68 };
  const SPD = { easy: .85, medium: 1, hard: 1.18 };
  const POW = { wide: ['↔', '#38bdf8'], multi: ['⁂', '#f472b6'], slow: ['🐢', '#4ade80'], laser: ['⚡', '#f87171'], fire: ['🔥', '#fb923c'], life: ['❤', '#ef4444'], shrink: ['↘', '#94a3b8'] };
  const store = () => (typeof GameProgress !== 'undefined' ? GameProgress.store('brick-breaker') : { getPref: (k, d) => d, setPref: () => {} });

  function genLevel(n) {
    const rows = [], hp = Math.min(4, 1 + Math.floor(n / 4));
    const sym = Math.random() < .6;
    for (let r = 0; r < 8; r++) {
      let row = '';
      for (let c = 0; c < COLS; c++) {
        const cc = sym && c >= 5 ? 9 - c : c;
        const seed = Math.sin((r + 1) * 12.9 + (cc + 1) * 78.2 + n * 3.1) * 43758.5; const f = seed - Math.floor(seed);
        row += f < .12 ? '.' : f < .17 ? 'M' : f < .21 ? 'X' : f < .24 ? 'G' : String(U.clamp(Math.ceil(f * hp * 1.2), 1, 4));
      }
      rows.push(row);
    }
    return rows;
  }

  function loadLevel(G, n) {
    const def = n <= LEVELS.length ? LEVELS[n - 1] : genLevel(n);
    G.level = n; G.bricks = [];
    def.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const hp = ch === 'M' ? Infinity : ch === 'X' || ch === 'G' ? 1 : +ch;
      G.bricks.push({ x: LEFT + c * BW, y: TOP + r * (BH + 4), w: BW - 3, h: BH, t: ch, hp, max: hp, hit: 0 });
    }));
    G.caps = []; G.shots = []; G.effects = {};
    G.pw = G.basePw;
    resetBall(G);
    if (n > (store().getPref('maxLevel', 1))) store().setPref('maxLevel', n);
  }

  function resetBall(G) { G.balls = [{ x: G.px, y: G.py - BR - 1, vx: 0, vy: 0, stuck: true, trail: [] }]; G.combo = 0; }
  const speed = G => Math.min(640, (320 + G.level * 12) * SPD[G.diff] * (G.effects.slow > 0 ? .7 : 1));

  function setup(api, o) {
    const diff = o.diff || 'medium';
    const G = { diff, basePw: PW[diff], pw: PW[diff], px: api.W / 2, py: api.H - 58, lives: 3, score: 0, bestCombo: 0, t: 0, pause: 0, bricksBroken: 0 };
    const start = o.mode === 'cont' ? Math.max(1, store().getPref('maxLevel', 1)) : 1;
    loadLevel(G, start);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[tijolos] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  function launch(G, api) {
    const b = G.balls.find(b => b.stuck); if (!b) return;
    const s = speed(G), a = U.rand(-.35, .35);
    b.stuck = false; b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s;
    api.sfx.tone(520, .06, 'triangle', .06);
  }

  function hitBrick(G, api, br, ball) {
    if (br.hp === Infinity) { br.hit = .15; api.sfx.tone(1400, .04, 'square', .03); return false; }
    br.hp--; br.hit = .15;
    if (br.hp > 0) { api.sfx.tone(400 + br.hp * 90, .05, 'triangle', .05); G.score += 5; return false; }
    breakBrick(G, api, br);
    return true;
  }
  function breakBrick(G, api, br) {
    if (br.dead) return;
    br.dead = true; G.bricksBroken++;
    G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
    const pts = (10 * br.max === Infinity ? 0 : 10 * Math.min(br.max, 4)) + Math.min(G.combo, 12) * 2;
    G.score += pts;
    const cx = br.x + br.w / 2, cy = br.y + br.h / 2, c = (COL[br.t] || COL[1])[0];
    for (let i = 0; i < 10; i++) api.spark({ x: cx, y: cy, vx: U.rand(-150, 150), vy: U.rand(-120, 120), color: c, size: U.rand(1.5, 3.5), life: .45, gravity: 400 });
    api.sfx.tone(600 + Math.min(G.combo, 16) * 45, .06, 'sine', .07);
    if (G.combo >= 5 && G.combo % 5 === 0) api.float(cx, cy, 'Combo ×' + G.combo, '#fde047', 16);
    if (br.t === 'X') {
      api.shake(7, .25); api.hitstop(.05); api.sfx.noise(.25, .12, 0, 400, 'lowpass');
      G.bricks.forEach(o => { if (!o.dead && o !== br && Math.abs(o.x - br.x) < BW * 1.6 && Math.abs(o.y - br.y) < (BH + 4) * 1.6 && o.hp !== Infinity) { o.hp = 0; setTimeout(() => breakBrick(G, api, o), 60); } });
    }
    const chance = br.t === 'G' ? 1 : .11;
    if (Math.random() < chance) {
      const pool = ['wide', 'multi', 'slow', 'laser', 'fire', 'wide', 'multi', 'shrink'];
      if (Math.random() < .12) pool.push('life');
      G.caps.push({ x: cx, y: cy, k: U.pick(pool), vy: 110 });
    }
  }

  function catchCap(G, api, k) {
    api.sfx.arp([660, 880], .05, .1, 'sine', .07);
    const names = { wide: 'Raquete larga', multi: 'Multibola', slow: 'Bola lenta', laser: 'Laser', fire: 'Bola de fogo', life: '+1 vida', shrink: 'Raquete curta!' };
    api.float(G.px, G.py - 30, names[k], POW[k][1], 16);
    if (k === 'wide') { G.pw = Math.min(G.basePw * 1.6, G.pw * 1.35); G.effects.wide = 12; }
    if (k === 'shrink') { G.pw = Math.max(44, G.pw * .7); G.effects.wide = 10; }
    if (k === 'slow') { G.effects.slow = 8; G.balls.forEach(b => { const s = Math.hypot(b.vx, b.vy) || 1, ns = speed(G); b.vx *= ns / s; b.vy *= ns / s; }); }
    if (k === 'laser') G.effects.laser = 8;
    if (k === 'fire') G.effects.fire = 6;
    if (k === 'life') G.lives = Math.min(6, G.lives + 1);
    if (k === 'multi') {
      const src = G.balls.filter(b => !b.stuck).slice(0, 3);
      src.forEach(b => [-.4, .4].forEach(da => { const a = Math.atan2(b.vy, b.vx) + da, s = Math.hypot(b.vx, b.vy); G.balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, trail: [] }); }));
    }
  }

  function update(G, dt, api) {
    const W = api.W;
    G.py = api.H - 58;
    G.t += dt;
    if (G.pause > 0) { G.pause -= dt; return; }
    for (const k in G.effects) { G.effects[k] -= dt; if (G.effects[k] <= 0) { delete G.effects[k]; if (k === 'wide') G.pw = G.basePw; } }
    if (G.kl || G.kr) G.px += ((G.kr ? 1 : 0) - (G.kl ? 1 : 0)) * 560 * dt;   /* teclado: movimento contínuo enquanto a tecla está premida */
    G.px = U.clamp(G.px, G.pw / 2 + 4, W - G.pw / 2 - 4);
    G.bricks.forEach(b => { if (b.hit > 0) b.hit -= dt; });

    /* laser */
    if (G.effects.laser) {
      G.laserT = (G.laserT || 0) - dt;
      if (G.laserT <= 0) { G.laserT = .32; G.shots.push({ x: G.px - G.pw / 2 + 6, y: G.py - 8 }, { x: G.px + G.pw / 2 - 6, y: G.py - 8 }); api.sfx.tone(1200, .04, 'square', .03, 0, 700); }
    }
    for (let i = G.shots.length - 1; i >= 0; i--) {
      const s = G.shots[i]; s.y -= 620 * dt;
      const br = G.bricks.find(b => !b.dead && s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h);
      if (br) { hitBrick(G, api, br, null); G.shots.splice(i, 1); } else if (s.y < 60) G.shots.splice(i, 1);
    }

    /* bolas */
    const sub = 4, sdt = dt / sub;
    for (const b of G.balls) {
      if (b.stuck) { b.x = G.px; b.y = G.py - BR - 1; continue; }
      for (let k = 0; k < sub; k++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        if (b.x < BR + 2) { b.x = BR + 2; b.vx = Math.abs(b.vx); api.sfx.tone(300, .02, 'sine', .02); }
        if (b.x > W - BR - 2) { b.x = W - BR - 2; b.vx = -Math.abs(b.vx); api.sfx.tone(300, .02, 'sine', .02); }
        if (b.y < 64 + BR) { b.y = 64 + BR; b.vy = Math.abs(b.vy); }
        /* raquete */
        if (b.vy > 0 && b.y + BR >= G.py - 6 && b.y + BR <= G.py + 8 && Math.abs(b.x - G.px) <= G.pw / 2 + BR) {
          const off = U.clamp((b.x - G.px) / (G.pw / 2), -1, 1), a = off * 1.05, s = Math.min(speed(G) * 1.12, Math.hypot(b.vx, b.vy) * 1.012 + 2);
          b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s; b.y = G.py - 6 - BR;
          G.combo = 0; api.sfx.tone(330, .05, 'triangle', .06); api.vibe(6);
        }
        /* tijolos */
        let best = null, bp = Infinity;
        for (const br of G.bricks) {
          if (br.dead) continue;
          const cx = U.clamp(b.x, br.x, br.x + br.w), cy = U.clamp(b.y, br.y, br.y + br.h);
          const d = Math.hypot(b.x - cx, b.y - cy);
          if (d < BR && d < bp) { bp = d; best = { br, cx, cy }; }
        }
        if (best) {
          const { br } = best;
          const broke = hitBrick(G, api, br, b);
          if (!(broke && G.effects.fire)) {
            const ox = Math.min(b.x + BR - br.x, br.x + br.w - (b.x - BR)), oy = Math.min(b.y + BR - br.y, br.y + br.h - (b.y - BR));
            if (ox < oy) { b.vx = b.x < br.x + br.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.vx > 0 ? ox : -ox; }
            else { b.vy = b.y < br.y + br.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.vy > 0 ? oy : -oy; }
          }
        }
      }
      /* evita bolas "horizontais" presas para sempre */
      if (Math.abs(b.vy) < 60) b.vy = (b.vy < 0 ? -1 : 1) * 60;
      b.trail.unshift([b.x, b.y]); if (b.trail.length > 7) b.trail.pop();
    }
    const before = G.balls.length;
    G.balls = G.balls.filter(b => b.y < api.H + 20);
    if (before && !G.balls.length) {
      G.lives--; G.effects = {}; G.pw = G.basePw;
      api.shake(8, .3); api.vibe(80); api.sfx.lose();
      if (G.lives <= 0) { api.over({ score: G.score, won: false, delay: 600, title: 'Sem bolas', icon: '🟦', stats: [['Nível', G.level], ['Tijolos', G.bricksBroken], ['Melhor combo', '×' + G.bestCombo]], meta: { level: G.level } }); return; }
      resetBall(G); G.pause = .5;
      api.banner(G.lives === 1 ? 'Última bola!' : G.lives + ' bolas', 'Toca para lançar');
    }
    /* cápsulas */
    for (let i = G.caps.length - 1; i >= 0; i--) {
      const c = G.caps[i]; c.y += c.vy * dt;
      if (c.y > G.py - 10 && c.y < G.py + 10 && Math.abs(c.x - G.px) < G.pw / 2 + 10) { catchCap(G, api, c.k); G.caps.splice(i, 1); }
      else if (c.y > api.H + 20) G.caps.splice(i, 1);
    }
    /* nível limpo */
    if (!G.bricks.some(b => !b.dead && b.hp !== Infinity)) {
      const bonus = 100 + G.lives * 50;
      G.score += bonus;
      api.sfx.win(); api.vibe([20, 30, 40]);
      const next = G.level + 1;
      api.panel({ icon: '🧱', title: `Nível ${G.level} limpo!`, big: '+' + bonus, sub: `Pontuação: ${G.score}`,
        buttons: [{ label: '▶ Nível ' + next, primary: true, fn: () => { loadLevel(G, next); api.resume(); api.banner('Nível ' + next, next > LEVELS.length ? 'Nível gerado' : ''); } },
          { label: 'Terminar aqui', fn: () => api.over({ score: G.score, won: true, delay: 0, title: 'Boa partida!', icon: '🧱', stats: [['Níveis', G.level], ['Tijolos', G.bricksBroken], ['Melhor combo', '×' + G.bestCombo]], meta: { level: G.level } }) }] });
    }
  }

  /* ── desenho ── */
  /* ════════════════════════════════════════════════════════════════
     3D — câmara a pique sobre a mesa (o plano do jogo coincide com o 2D,
     por isso o rato continua exato). Tijolos em relevo com arestas
     arredondadas, raquete-cápsula metálica, bola que brilha, cápsulas
     de poder com ícone, mesa com grelha e bermas de néon.
     1 unidade = 1 px lógico; x = lx − W/2, y = H/2 − ly.
  ════════════════════════════════════════════════════════════════ */
  const BZ = 18;                                          /* altura dos tijolos */
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#c7d2fe', ground: '#0b1026', hemi: .7, sunI: 2.8, fillC: '#f472b6', fillI: .5, normalBias: .5 });
    const cam = new THREE.PerspectiveCamera(52, 1, 10, 4000);
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#070b1d'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(96,165,250,.18)'; x.lineWidth = 2; x.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, color: '#6b7aa8', roughness: .9 }));
    floor.receiveShadow = true; scene.add(floor);
    const rail = Arcade3D.glowMat('#60a5fa');
    const rails = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), rail); scene.add(m); return m; });
    const bricks = new THREE.InstancedMesh(Arcade3D.roundBox(.18), new THREE.MeshStandardMaterial({ roughness: .28, metalness: .05 }), 200);
    bricks.castShadow = true; bricks.receiveShadow = true; bricks.frustumCulled = false;
    const metal = new THREE.InstancedMesh(Arcade3D.roundBox(.18), new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: .18, metalness: .9 }), 80);
    metal.castShadow = true; metal.frustumCulled = false;
    const paddle = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 6, 16), new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: .2, metalness: .6, emissive: '#1d4ed8', emissiveIntensity: .35 }));
    paddle.rotation.z = Math.PI / 2; paddle.castShadow = true; scene.add(paddle);
    const pglow = new THREE.Sprite(Arcade3D.glowSprite('#60a5fa')); scene.add(pglow);
    scene.add(bricks, metal);
    G.r3 = { renderer, scene, sun, cam, floor, tex, rails, bricks, metal, paddle, pglow, pool: Arcade3D.pool(scene), m4: new THREE.Matrix4(), v: new THREE.Vector3(), sc: new THREE.Vector3(), c: new THREE.Color(), q: new THREE.Quaternion() };
    api.stage.style.background = 'radial-gradient(120% 80% at 50% 0%, #0f1a3d, #05060f 70%)';
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, P = R.pool, { m4, v, sc, c } = R, q0 = R.q.identity();
    Arcade3D.fit(api.stage, R.cam);
    const X = lx => lx - W / 2, Y = ly => H / 2 - ly;
    /* câmara: o plano z=0 bate certo com o ecrã lógico */
    const D = (H / 2) / Math.tan(R.cam.fov * Math.PI / 360);
    const [shx, shy] = api.shakeXY;
    R.cam.position.set(-shx, shy, D); R.cam.lookAt(-shx, shy, 0);
    R.cam.near = D * .5; R.cam.far = D * 1.6; R.cam.updateProjectionMatrix();
    R.floor.scale.set(W, H, 1); R.floor.position.set(0, 0, -1); R.tex.repeat.set(W / 37.2, H / 37.2);
    R.rails[0].scale.set(4, H, 6); R.rails[0].position.set(X(2), 0, 3);
    R.rails[1].scale.set(4, H, 6); R.rails[1].position.set(X(W - 2), 0, 3);
    R.rails[2].scale.set(W, 4, 6); R.rails[2].position.set(0, Y(62), 3);
    Arcade3D.sunAt(R.sun, 0, 0, 0, Math.max(W, H) * .6, [-.55, .45, 1]);
    /* tijolos */
    let nb = 0, nm = 0;
    G.bricks.forEach(b => {
      if (b.dead) return;
      const hit = b.hit > 0 ? b.hit / .15 : 0;
      v.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), BZ / 2 + hit * 2); sc.set(b.w, b.h, BZ);
      /* a caixa arredondada é "de pé" em y: roda para ficar deitada na mesa */
      m4.compose(v, R.q.setFromAxisAngle(R.v2 || (R.v2 = new THREE.Vector3(1, 0, 0)), Math.PI / 2), sc.set(b.w, BZ, b.h));
      if (b.t === 'M') { R.metal.setMatrixAt(nm++, m4); return; }
      const col = (COL[b.t === 'X' || b.t === 'G' ? b.t : Math.min(b.hp, 4)] || COL[1])[0];
      c.set(col); if (b.hp < b.max && b.hp !== Infinity) c.multiplyScalar(.82); if (hit) c.lerp(R.white || (R.white = new THREE.Color('#ffffff')), hit * .7);
      R.bricks.setMatrixAt(nb, m4); R.bricks.setColorAt(nb, c); nb++;
    });
    R.bricks.count = nb; R.bricks.instanceMatrix.needsUpdate = true; if (R.bricks.instanceColor) R.bricks.instanceColor.needsUpdate = true;
    R.metal.count = nm; R.metal.instanceMatrix.needsUpdate = true;
    P.begin();
    /* ícones nos tijolos especiais (✸ explosivo, ★ prenda) */
    G.bricks.forEach(b => {
      if (b.dead || (b.t !== 'X' && b.t !== 'G')) return;
      const s = P.get('ico' + b.t, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.emojiTex(b.t === 'X' ? '💥' : '⭐', 64), depthTest: false })));
      s.position.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), BZ + 2); s.scale.set(14, 14, 1);
    });
    /* raquete */
    const pw = G.pw;
    R.paddle.scale.set(7, Math.max(1, (pw - 14) / 2), 7); R.paddle.position.set(X(G.px), Y(G.py), 7);
    R.paddle.material.color.set(G.effects.laser ? '#fca5a5' : '#93c5fd'); R.paddle.material.emissive.set(G.effects.laser ? '#b91c1c' : '#1d4ed8');
    R.pglow.position.set(X(G.px), Y(G.py), 2); R.pglow.scale.set(pw * 1.6, 40, 1); R.pglow.material.opacity = .55;
    /* bolas (com rasto) */
    const fire = !!G.effects.fire;
    G.balls.forEach(b => {
      const m = P.get(fire ? 'ballF' : 'ball', () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(BR, 20, 14), fire ? Arcade3D.glowMat('#fed7aa') : new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e0f2fe', emissiveIntensity: .6, roughness: .1, metalness: .3 }))); const s = new THREE.Sprite(Arcade3D.glowSprite(fire ? '#fb923c' : '#bae6fd')); s.scale.set(BR * 7, BR * 7, 1); g.add(s); g.children[0].castShadow = true; return g; });
      m.position.set(X(b.x), Y(b.y), BR + 1);
      b.trail.forEach((p, i) => { const t = P.get('trail' + (fire ? 'F' : ''), () => new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: fire ? '#fb923c' : '#7dd3fc', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }))); t.position.set(X(p[0]), Y(p[1]), BR); const k = 1 - i / b.trail.length; t.scale.set(BR * 3.4 * k + 1, BR * 3.4 * k + 1, 1); t.material.opacity = .5 * k; });
    });
    /* cápsulas de poder */
    G.caps.forEach(cp => {
      const m = P.get('cap:' + cp.k, () => {
        const g = new THREE.Group();
        const pill = new THREE.Mesh(new THREE.CapsuleGeometry(7, 16, 6, 12), new THREE.MeshStandardMaterial({ color: POW[cp.k][1], roughness: .25, metalness: .3, emissive: POW[cp.k][1], emissiveIntensity: .25 }));
        pill.rotation.z = Math.PI / 2; pill.castShadow = true; g.add(pill);
        const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.emojiTex(POW[cp.k][0], 64), depthTest: false })); ic.position.z = 9; ic.scale.set(13, 13, 1); g.add(ic);
        return g;
      });
      m.position.set(X(cp.x), Y(cp.y), 9); m.children[0].rotation.x = api.t * 3;
    });
    /* laser */
    G.shots.forEach(sh => { const m = P.get('laser', () => new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), Arcade3D.glowMat('#fca5a5'))); m.position.set(X(sh.x), Y(sh.y - 3), 6); });
    P.end();
    R.renderer.render(R.scene, R.cam);
    /* 2D por cima: dica, vidas, efeitos */
    if (G.balls.some(b => b.stuck)) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Toca para lançar', W / 2, G.py - 44); }
    for (let i = 0; i < G.lives; i++) { ctx.fillStyle = '#93c5fd'; ctx.beginPath(); ctx.arc(16 + i * 16, H - 16, 5, 0, 6.3); ctx.fill(); }
    let ex = W - 14; Object.keys(G.effects).forEach(k => { if (!POW[k]) return; ctx.fillStyle = POW[k][1]; ctx.font = '700 12px system-ui'; ctx.textAlign = 'right'; ctx.fillText(POW[k][0] + ' ' + Math.ceil(G.effects[k]), ex, H - 12); ex -= 44; });
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    R.tex.dispose(); Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }
  function draw2D(G, ctx, W, H, api) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#05060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(96,165,250,.06)'; ctx.lineWidth = 1;
    for (let x = LEFT; x < W; x += BW) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(96,165,250,.35)'; ctx.lineWidth = 2; ctx.strokeRect(2, 62, W - 4, H + 10);
    /* tijolos */
    G.bricks.forEach(b => {
      if (b.dead) return;
      const [c0, c1] = b.t === 'M' ? ['#e2e8f0', '#64748b'] : COL[b.t === 'X' || b.t === 'G' ? b.t : Math.min(b.hp, 4)] || COL[1];
      const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); bg.addColorStop(0, c0); bg.addColorStop(1, c1);
      ctx.fillStyle = bg; U.rr(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 2.5);
      if (b.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${b.hit * 3})`; U.rr(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill(); }
      if (b.hp !== Infinity && b.hp < b.max) { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x + b.w * .3, b.y + 2); ctx.lineTo(b.x + b.w * .45, b.y + b.h * .6); ctx.lineTo(b.x + b.w * .38, b.y + b.h - 2); ctx.stroke(); }
      if (b.t === 'X' || b.t === 'G' || b.t === 'M') { ctx.fillStyle = b.t === 'M' ? '#334155' : '#fff'; ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.t === 'X' ? '✸' : b.t === 'G' ? '★' : '▪', b.x + b.w / 2, b.y + b.h / 2 + 1); }
      else if (b.max > 1) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.hp, b.x + b.w / 2, b.y + b.h / 2 + 1); }
    });
    /* cápsulas */
    G.caps.forEach(c => { const [ch, col] = POW[c.k]; ctx.fillStyle = col; U.rr(ctx, c.x - 15, c.y - 8, 30, 16, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, c.x, c.y + 1); });
    ctx.fillStyle = '#fca5a5'; G.shots.forEach(s => ctx.fillRect(s.x - 1.5, s.y - 8, 3, 10));
    /* raquete */
    const pg = ctx.createLinearGradient(0, G.py - 7, 0, G.py + 7);
    pg.addColorStop(0, G.effects.laser ? '#fca5a5' : '#93c5fd'); pg.addColorStop(1, G.effects.laser ? '#b91c1c' : '#1d4ed8');
    ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 14; ctx.fillStyle = pg; U.rr(ctx, G.px - G.pw / 2, G.py - 7, G.pw, 14, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(G.px - G.pw / 2 + 8, G.py - 5, G.pw - 16, 2);
    /* bolas */
    G.balls.forEach(b => {
      b.trail.forEach((p, i) => { ctx.globalAlpha = .25 * (1 - i / 7); ctx.fillStyle = G.effects.fire ? '#fb923c' : '#e0f2fe'; ctx.beginPath(); ctx.arc(p[0], p[1], BR * (1 - i / 9), 0, 6.3); ctx.fill(); });
      ctx.globalAlpha = 1;
      ctx.shadowColor = G.effects.fire ? '#fb923c' : '#e0f2fe'; ctx.shadowBlur = 12;
      ctx.fillStyle = G.effects.fire ? '#fed7aa' : '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
    });
    if (G.balls.some(b => b.stuck)) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Toca para lançar', W / 2, G.py - 40); }
    /* vidas e efeitos */
    for (let i = 0; i < G.lives; i++) { ctx.fillStyle = '#93c5fd'; ctx.beginPath(); ctx.arc(16 + i * 16, H - 16, 5, 0, 6.3); ctx.fill(); }
    let ex = W - 14; Object.keys(G.effects).forEach(k => { if (!POW[k]) return; ctx.fillStyle = POW[k][1]; ctx.font = '700 12px system-ui'; ctx.textAlign = 'right'; ctx.fillText(POW[k][0] + ' ' + Math.ceil(G.effects[k]), ex, H - 12); ex -= 44; });
  }

  return ArcadeKit.create({
    id: 'brick-breaker', title: 'Parte-Tijolos', icon: '🟦',
    accent: '#60a5fa', accent2: '#f472b6', bg: '#05060f', transparent: true, destroy,
    tagline: 'Raquete, bola e uma parede de tijolos por partir. 12 níveis desenhados e depois muitos mais.',
    view: { w: 400 },
    modes: () => {
      const mx = store().getPref('maxLevel', 1);
      return [
        { id: 'new', icon: '🧱', name: 'Campanha', desc: 'Do nível 1 em diante. 3 bolas para ir o mais longe possível.' },
        ...(mx > 1 ? [{ id: 'cont', icon: '⏩', name: `Continuar no nível ${mx}`, desc: 'Retoma a partir do nível mais alto a que chegaste.', noBest: true, noDiff: true }] : []),
      ];
    },
    how: [
      '<b>Rato:</b> a raquete segue o cursor. <b>Toque:</b> arrasta o dedo em qualquer lado — a raquete acompanha sem ficares a tapar a bola. Toca/clica para lançar.',
      'Onde a bola bate na raquete decide o ângulo. Tijolos com número precisam de vários toques; os de metal não partem; ✸ explode à volta; ★ larga sempre uma cápsula.',
      'Apanha cápsulas: ↔ larga, ⁂ multibola, 🐢 lenta, ⚡ laser, 🔥 fogo, ❤ vida. Cuidado com ↘, que encolhe a raquete.',
    ],
    controls: ['🖱️ Mover + clicar', '👆 Arrastar + tocar', '⌨️ ← → + Espaço'],
    ready: { title: 'Toca para começar', hint: 'Depois toca outra vez para lançar a bola.' },
    setup, update, draw,
    down: (G, x, y, api, e) => { if (e.pointerType === 'mouse') G.px = x; G.drag = { x, px: G.px }; launch(G, api); },
    move: (G, x, y, api, e, isDown) => {
      if (e.pointerType === 'mouse') { G.px = x; return; }
      if (isDown && G.drag) G.px = G.drag.px + (x - G.drag.x) * 1.35;
    },
    up: G => { G.drag = null; },
    key: (G, e, api) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { G.kl = 1; return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { G.kr = 1; return true; }
      if (e.key === ' ' || e.key === 'ArrowUp') { launch(G, api); return true; }
    },
    keyup: (G, e) => {
      if (/^(ArrowLeft|a|A)$/.test(e.key)) G.kl = 0;
      if (/^(ArrowRight|d|D)$/.test(e.key)) G.kr = 0;
    },
    hud: G => [['Pontos', G.score], ['Nível', G.level], ['Combo', G.combo > 1 ? '×' + G.combo : '—', G.combo >= 5 ? 'hot' : '']],
    achievements: [
      { id: 'bb.l5',  name: 'Demolidor',  icon: '🧱', desc: 'Chega ao nível 5 do Parte-Tijolos.', test: c => ((c.result.meta || {}).level || 0) >= 5 },
      { id: 'bb.l12', name: 'Muralha Abaixo', icon: '🏗️', desc: 'Limpa os 12 níveis desenhados.', test: c => ((c.result.meta || {}).level || 0) >= 13 },
      { id: 'bb.5k',  name: 'Mão Pesada', icon: '💥', desc: 'Faz 5000 pontos no Parte-Tijolos.', test: c => (c.result.score || 0) >= 5000 },
    ],
  });
})();
