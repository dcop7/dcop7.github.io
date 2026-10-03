/* ══════════════════════════════════════════════════════════════════
   Faixa Rápida (Lane Rush) — estrada de 3 faixas em pseudo-3D; troca de
   faixa para fugir aos obstáculos enquanto a velocidade não pára de subir.
   Perspetiva própria em canvas 2D (profundidade z → escala F/(z+F)).
   Linha de obstáculos gerada sempre com pelo menos uma faixa livre e com
   tempo de reação mínimo garantido pela velocidade atual.
══════════════════════════════════════════════════════════════════ */
const LaneRushGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const ZMAX = 70, F = 7, LANE = 124;
  /* v em unidades/s (km/h = v·6). Afinado para toque (out/2026): antes o médio
     arrancava a 114 km/h, chegava ao máximo em ~80 s e as filas podiam vir a
     0,56 s umas das outras — no telemóvel o dedo não acompanhava. */
  const DIFF = {
    easy:   { v0: 12, vMax: 30, acc: .14, tMin: 1.0 },
    medium: { v0: 14, vMax: 36, acc: .19, tMin: .82 },
    hard:   { v0: 17, vMax: 44, acc: .26, tMin: .66 },
  };

  function setup(api, o) {
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { const G = api.G3; if (G && !G.r3) try { build3D(G, api); } catch (e) { console.warn('[faixa] 3D falhou', e); } }).catch(() => {});
    return api.G3 = {
      cfg: DIFF[o.diff] || DIFF.medium,
      lane: 1, px: 1, tilt: 0,
      v: (DIFF[o.diff] || DIFF.medium).v0, dist: 0, time: 0,
      objs: [], nextRow: 26, rows: 0,
      score: 0, coins: 0, nears: 0, shield: false, shieldFx: 0,
      stripe: 0, over: false, boom: null,
    };
  }

  /* projeção: z (distância) → escala e y no ecrã */
  const scale = z => F / (Math.max(z, -F + .5) + F);
  function rowY(api, z) { const hz = api.H * .34, by = api.H - 96; return hz + (by - hz) * scale(z); }
  function laneX(api, lane, z) { return api.W / 2 + (lane - 1) * LANE * scale(z); }
  /* ponto no ecrã (lógico) de uma faixa/distância, `up` px acima — em 3D projeta pela câmara */
  let cur3 = null;
  function P2(api, lane, z, up) {
    if (cur3) { const p = Arcade3D.toScreen(cur3.cam, (lane - 1) * LW, .9, -z * ZS, api.W, api.H); return [p.x, p.y - up * .5]; }
    return [laneX(api, lane, z), rowY(api, z) - up];
  }

  function spawnRow(G) {
    /* trânsito a sério: carros (um a mudar de faixa, ou dois lado a lado com uma faixa livre) tão frequentes como as barreiras */
    const kinds = G.rows < 3 ? ['one', 'coins'] : G.rows < 8 ? ['one', 'two', 'coins', 'car', 'mix'] : ['one', 'two', 'two', 'coins', 'car', 'car', 'cars2', 'mix'];
    const k = U.pick(kinds);
    const z = ZMAX;
    /* duas filas de barreiras seguidas nunca obrigam a saltar 2 faixas de uma vez */
    const free = G.lastFree == null ? U.randi(0, 2) : U.pick([0, 1, 2].filter(l => Math.abs(l - G.lastFree) <= 1));
    G.lastFree = k === 'two' || k === 'mix' || k === 'cars2' ? free : null;
    if (k === 'one') G.objs.push({ t: 'bar', lane: U.randi(0, 2), z });
    else if (k === 'two') [0, 1, 2].filter(l => l !== free).forEach(l => G.objs.push({ t: 'bar', lane: l, z }));
    else if (k === 'coins') { const l = U.randi(0, 2); for (let i = 0; i < 4; i++) G.objs.push({ t: 'coin', lane: l, z: z + i * 3 }); }
    else if (k === 'car') {
      const l = U.randi(0, 2), to = l === 0 ? 1 : l === 2 ? 1 : U.pick([0, 2]);
      G.objs.push({ t: 'car', lane: l, from: l, to, z, hue: U.pick([200, 280, 30, 140, 330, 60, 0]) });
    } else if (k === 'cars2') {
      [0, 1, 2].filter(l => l !== free).forEach((l, i) => G.objs.push({ t: 'car', lane: l, from: l, to: l, z: z + i * 2.5, hue: U.pick([200, 280, 30, 140, 330, 60, 0]) }));
      G.objs.push({ t: 'coin', lane: free, z: z + 1 });
    } else {
      G.objs.push({ t: 'bar', lane: free === 0 ? 1 : 0, z });
      G.objs.push({ t: 'coin', lane: free, z: z + 1 });
      if (Math.random() < .08 && !G.shield) G.objs.push({ t: 'shield', lane: free, z: z + 5 });
    }
    G.rows++;
  }

  function steer(G, d, api) {
    if (G.over) return;
    const nl = U.clamp(G.lane + d, 0, 2);
    if (nl === G.lane) { G.tilt = d * .5; return; }
    G.lane = nl;
    api.sfx.tone(d < 0 ? 520 : 600, .06, 'triangle', .05, 0, d < 0 ? 420 : 760);
  }

  function crash(G, api, o) {
    if (G.shield) {
      G.shield = false; G.shieldFx = 1; o.dead = true;
      api.shake(6, .2); api.flash('#67e8f9', .15);
      api.sfx.noise(.2, .12, 0, 1800); api.float(...P2(api, G.px, 0, 70), 'Escudo!', '#67e8f9', 20);
      return;
    }
    G.over = true;
    const [x, y] = P2(api, G.px, 0, 20);
    G.boom = { x, y, t: 0 };
    for (let i = 0; i < 36; i++) api.spark({ x, y, vx: U.rand(-320, 320), vy: U.rand(-380, 60), color: U.pick(['#f472b6', '#fb923c', '#fde047', '#fff']), size: U.rand(2, 5), life: U.rand(.5, 1), gravity: 600 });
    api.shake(14, .45); api.flash('#f472b6', .25); api.vibe([60, 40, 100]);
    api.sfx.noise(.5, .22, 0, 400, 'lowpass'); api.sfx.tone(160, .4, 'sawtooth', .07, 0, 50);
    api.over({ score: G.score, won: false, delay: 1100, title: 'Batida!', icon: '💥',
      stats: [['Distância', Math.floor(G.dist) + ' m'], ['Velocidade', Math.round(G.v * 6) + ' km/h'], ['Moedas', G.coins], ['Por um triz', G.nears]],
      meta: { dist: Math.floor(G.dist) } });
  }

  function update(G, dt, api) {
    const c = G.cfg;
    G.time += dt;
    G.v = Math.min(c.vMax, G.v + c.acc * dt);
    const dz = G.v * dt;
    G.dist += dz * .8;
    G.score = Math.floor(G.dist / 2) + G.coins * 5 + G.nears * 3;
    G.stripe = (G.stripe + dz) % 6;
    G.post = ((G.post || 0) + dz) % 12;
    G.px = U.lerp(G.px, G.lane, Math.min(1, dt * 16));
    G.tilt = U.lerp(G.tilt, (G.lane - G.px) * 1.4, Math.min(1, dt * 12));
    G.shieldFx = Math.max(0, G.shieldFx - dt * 2);

    G.nextRow -= dz;
    if (G.nextRow <= 0) {
      spawnRow(G);
      const T = Math.max(c.tMin, 1.45 - G.time * .006);
      G.nextRow = G.v * T + U.rand(0, 4);
      /* os carros andam (a .35 v): a fila seguinte não os pode apanhar antes
         de passarem por ti, senão carro + barreiras fechavam as 3 faixas */
      if (G.objs.some(o => o.t === 'car' && o.z > ZMAX - 2)) G.nextRow = Math.max(G.nextRow, 42);
    }
    if (Math.floor(G.dist / 500) > Math.floor((G.dist - dz * .8) / 500)) { api.banner(Math.floor(G.dist / 500) * 500 + ' m', 'Mais rápido!'); api.sfx.arp([523, 784], .07, .1, 'triangle', .06); }

    for (let i = G.objs.length - 1; i >= 0; i--) {
      const o = G.objs[i], z0 = o.z;
      o.z -= dz;
      if (o.t === 'car') {
        o.z += G.v * .35 * dt;           /* os carros andam, mas mais devagar que tu */
        if (o.z < 34 && o.from !== o.to) { o.lane = U.lerp(o.lane, o.to, Math.min(1, dt * 2.2)); }
      }
      if (o.dead) { G.objs.splice(i, 1); continue; }
      const near = o.z < .9 && z0 > -.9;       /* atravessou a zona do carro neste passo (fps baixo não salta obstáculos) */
      const dl = Math.abs(o.lane - G.px);
      if (near && dl < .55) {
        if (o.t === 'coin') { G.coins++; o.dead = true; api.sfx.tone(988, .06, 'sine', .07); api.sfx.tone(1319, .08, 'sine', .05, .05); api.float(...P2(api, o.lane, 0, 60), '+5', '#fde047', 16); continue; }
        if (o.t === 'shield') { G.shield = true; o.dead = true; api.sfx.arp([660, 880, 1100], .05, .1, 'sine', .07); api.banner('Escudo', 'Aguenta uma batida'); continue; }
        if (!G.over) crash(G, api, o);
        if (G.over) return;
      }
      if (o.z < -1 && !o.passed) {
        o.passed = true;
        if ((o.t === 'bar' || o.t === 'car') && dl < 1.25 && dl >= .55) { G.nears++; api.float(...P2(api, G.px, 0, 80), 'Por um triz +3', '#a5f3fc', 15); }
      }
      if (o.z < -6) G.objs.splice(i, 1);
    }
  }

  /* ════════════════════════════════════════════════════════════════
     3D synthwave — estrada de asfalto escuro com bermas néon, grelha a
     correr no chão, sol listrado e montanhas no horizonte, postes com
     luz, carros low-poly com farolins e néon por baixo.
  ════════════════════════════════════════════════════════════════ */
  const LW = 3, ZS = 1.6;                 /* largura de faixa e escala da distância (unidades 3D) */
  function canvasTex(w, h, paint, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function carModel(body, player) {
    /* carro partilhado (Arcade3D.car): carroçaria em perfil, vidros, jantes, faróis; o trânsito varia de modelo */
    const g = new THREE.Group();
    const types = ['sedan', 'hatch', 'suv', 'van', 'sedan', 'taxi'], hue = parseInt(String(body).replace(/\D+/g, ' ').trim().split(' ')[0], 10) || 0;
    const type = player ? 'sport' : types[Math.floor(hue / 37) % types.length];
    const c = Arcade3D.car({ type, color: type === 'taxi' ? undefined : body, len: type === 'van' ? 4.3 : 3.9, wid: type === 'sport' ? .48 : .46, forward: '-z', night: true });
    g.add(c); g.userData.car = c;
    const sp = (col, x, y, z, s) => { const o = new THREE.Sprite(Arcade3D.glowSprite(col)); o.position.set(x, y, z); o.scale.set(s, s, 1); g.add(o); return o; };
    sp('#ff2d55', .6, .62, 2.02, .9); sp('#ff2d55', -.6, .62, 2.02, .9);                 /* brilho dos farolins */
    sp('#fffbe6', .55, .45, -2.02, .7); sp('#fffbe6', -.55, .45, -2.02, .7);
    if (player) { const u = sp('#f472b6', 0, .08, 0, 4.2); u.scale.set(4.2, 2.2, 1); g.userData.under = u; }
    g.userData.bodyM = c.userData.paint;
    g.userData.blinkL = sp('#fbbf24', -.95, .55, -1.7, 0); g.userData.blinkR = sp('#fbbf24', .95, .55, -1.7, 0);
    return g;
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#c084fc', ground: '#1e1030', hemi: .9, sun: '#ffd1f0', sunI: 1.4, fillC: '#22d3ee', fillI: .6 });
    scene.background = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#07021a'); g.addColorStop(.55, '#2a0a4a'); g.addColorStop(.72, '#6d1a6e'); g.addColorStop(.74, '#12051f'); g.addColorStop(1, '#12051f'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    scene.fog = new THREE.Fog('#3a0d55', 55, 125);
    const cam = new THREE.PerspectiveCamera(58, 1, .1, 400);
    /* chão com grelha néon (a textura corre com a distância) */
    const gridT = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#12051f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f472b6'; x.globalAlpha = .55; x.lineWidth = 3; x.strokeRect(0, 0, w, h); }, [60, 60]);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshBasicMaterial({ map: gridT, fog: true }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.02, -100); scene.add(ground);
    /* estrada */
    const roadT = canvasTex(64, 256, (x, w, h) => { x.fillStyle = '#0d0a18'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); } }, [1, 20]);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(LW * 3 + 1.4, 240), new THREE.MeshStandardMaterial({ map: roadT, roughness: .75, metalness: .1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -100); road.receiveShadow = true; scene.add(road);
    const edgeM = Arcade3D.glowMat('#f472b6');
    [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.BoxGeometry(.18, .12, 240), edgeM); e.position.set(sd * (LW * 1.5 + .7), .06, -100); scene.add(e); });
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(.14, .02, 4.2), Arcade3D.glowMat('#67e8f9'), 60); dash.frustumCulled = false; scene.add(dash);
    /* sol listrado + montanhas */
    const sunT = canvasTex(512, 512, (x, w) => {
      const g = x.createLinearGradient(0, 0, 0, w); g.addColorStop(0, '#fde047'); g.addColorStop(1, '#f43f5e');
      x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2); x.fillStyle = g; x.fill();
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) { const y = w * .56 + i * w * .065; x.fillRect(0, y, w, 4 + i * 3.2); }
    });
    const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: sunT, transparent: true, fog: false, toneMapped: false, depthWrite: false }));
    sunMesh.position.set(0, 24, -190); scene.add(sunMesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#fb7185', blending: THREE.AdditiveBlending, transparent: true, fog: false, depthWrite: false, opacity: .55 })); halo.scale.set(150, 150, 1); halo.position.set(0, 24, -195); scene.add(halo);
    const mtT = canvasTex(1024, 128, (x, w, h) => {
      x.fillStyle = '#1a0526'; x.beginPath(); x.moveTo(0, h);
      for (let X = 0; X <= w; X += 8) x.lineTo(X, h - 30 - Math.abs(Math.sin(X * .012)) * 60 - Math.abs(Math.sin(X * .031 + 1)) * 30);
      x.lineTo(w, h); x.fill();
      x.strokeStyle = 'rgba(244,114,182,.7)'; x.lineWidth = 2; x.beginPath();
      for (let X = 0; X <= w; X += 8) x.lineTo(X, h - 30 - Math.abs(Math.sin(X * .012)) * 60 - Math.abs(Math.sin(X * .031 + 1)) * 30);
      x.stroke();
    });
    const mts = new THREE.Mesh(new THREE.PlaneGeometry(420, 52), new THREE.MeshBasicMaterial({ map: mtT, transparent: true, fog: false, depthWrite: false }));
    mts.position.set(0, 12, -170); scene.add(mts);
    /* estrelas */
    const sv = []; for (let i = 0; i < 420; i++) sv.push((Math.random() - .5) * 500, 30 + Math.random() * 120, -150 - Math.random() * 60);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.1, sizeAttenuation: true, fog: false, transparent: true, opacity: .8 })));
    /* carro do jogador + pool de objetos */
    const player = carModel('#22d3ee', true); scene.add(player);
    const shieldM = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 2), new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: .18, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, wireframe: true }));
    shieldM.scale.set(1, .6, 1.4); scene.add(shieldM);
    G.r3 = { renderer, scene, sun, cam, gridT, roadT, dash, player, shieldM, pool: Arcade3D.pool(scene), m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), sc: new THREE.Vector3(), carCache: new Map(), lean: 0 };
  }

  function barModel() {
    const g = new THREE.Group();
    const stripes = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#111'; x.fillRect(0, 0, w, h); x.fillStyle = '#fb923c'; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 16, h); x.fill(); } });
    const face = new THREE.MeshStandardMaterial({ map: stripes, roughness: .5, emissive: '#fb923c', emissiveIntensity: .12 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(LW * .84, .7, .18), [Arcade3D.std('#2a1340'), Arcade3D.std('#2a1340'), Arcade3D.std('#2a1340'), Arcade3D.std('#2a1340'), face, face]);
    board.position.y = 1.0; board.castShadow = true; g.add(board);
    [-1, 1].forEach(sd => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.0, .16), Arcade3D.std('#3b1b5a')); leg.position.set(sd * LW * .36, .5, 0); leg.castShadow = true; g.add(leg);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), Arcade3D.glowMat('#fde047')); lamp.position.set(sd * LW * .36, 1.45, 0); g.add(lamp);
      const gl = new THREE.Sprite(Arcade3D.glowSprite('#fde047')); gl.scale.set(1.3, 1.3, 1); gl.position.copy(lamp.position); g.add(gl); g.userData['l' + sd] = gl;
    });
    return g;
  }
  function coinModel() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .1, 24), new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: .85, roughness: .25, emissive: '#b45309', emissiveIntensity: .35 }));
    c.rotation.x = Math.PI / 2; g.add(c);
    const gl = new THREE.Sprite(Arcade3D.glowSprite('#fde047')); gl.scale.set(1.5, 1.5, 1); g.add(gl);
    return g;
  }
  function shieldModel() {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .14, 6), new THREE.MeshStandardMaterial({ color: '#67e8f9', emissive: '#0891b2', emissiveIntensity: 1, transparent: true, opacity: .85 }));
    h.rotation.x = Math.PI / 2; g.add(h);
    const gl = new THREE.Sprite(Arcade3D.glowSprite('#67e8f9')); gl.scale.set(2.2, 2.2, 1); g.add(gl);
    return g;
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3; cur3 = R;
    Arcade3D.fit(api.stage, R.cam);
    const { m4, q, v, sc } = R, qI = new THREE.Quaternion();
    R.gridT.offset.y = (G.dist / ZS * .8) % 1 * -1 * 0 + (G.dist * .5 % 4) / 4;
    R.roadT.offset.y = (G.dist * .25) % 1;
    /* tracejado das faixas a correr */
    let n = 0;
    for (const l of [.5, 1.5]) for (let z = -G.stripe - 6; z < ZMAX; z += 6) {
      if (n >= 60) break;
      v.set((l - 1) * LW, .02, -(z + 1.5) * ZS); sc.set(1, 1, 1); m4.compose(v, qI, sc); R.dash.setMatrixAt(n++, m4);
    }
    R.dash.count = n; R.dash.instanceMatrix.needsUpdate = true;
    /* jogador */
    const px = (G.px - 1) * LW, pl = R.player;
    pl.visible = !G.boom;
    pl.position.set(px, 0, 0);
    R.lean = U.lerp(R.lean, (G.lane - G.px) * .5, .25);
    pl.rotation.set(0, -R.lean * .5, R.lean * .12);
    pl.userData.under.material.opacity = .55 + Math.sin(api.t * 7) * .12;
    pl.userData.car.userData.wheels.forEach(w => { w.rotation.z = -api.t * (6 + G.v * .02); });
    R.shieldM.visible = !G.boom && (G.shield || G.shieldFx > 0);
    R.shieldM.position.set(px, .8, 0); R.shieldM.material.opacity = G.shield ? .38 + .14 * Math.sin(api.t * 6) : G.shieldFx * .8; R.shieldM.rotation.y = api.t * .6;
    /* obstáculos, moedas, carros */
    const P = R.pool; P.begin();
    const blink = Math.floor(api.t * 6) % 2;
    for (const o of G.objs) {
      if (o.z < -4 || o.dead) continue;
      const x = (o.lane - 1) * LW, z = -o.z * ZS;
      if (o.t === 'bar') { const m = P.get('bar', barModel); m.position.set(x, 0, z); const k = .8 + Math.sin(api.t * 8 + o.z) * .3; m.userData.l1.scale.set(k * 1.3, k * 1.3, 1); m.userData['l-1'].scale.set(k * 1.3, k * 1.3, 1); }
      else if (o.t === 'coin') { const m = P.get('coin', coinModel); m.position.set(x, .9 + Math.sin(api.t * 4 + o.z) * .12, z); m.rotation.y = api.t * 4 + o.z; }
      else if (o.t === 'shield') { const m = P.get('shield', shieldModel); m.position.set(x, 1.1, z); m.children[0].rotation.z = api.t * 2; }
      else if (o.t === 'car') {
        const m = P.get('car' + o.hue, () => carModel(`hsl(${o.hue},70%,48%)`, false));
        m.position.set(x, 0, z); m.rotation.y = (o.to - o.lane) * -.25;
        m.userData.car.userData.wheels.forEach(w => { w.rotation.z = -api.t * 7; });
        const turning = o.from !== o.to && o.z < 50;
        m.userData.blinkL.scale.setScalar(turning && o.to < o.from && blink ? 1.4 : 0);
        m.userData.blinkR.scale.setScalar(turning && o.to > o.from && blink ? 1.4 : 0);
      }
    }
    /* postes néon nas bermas */
    for (let z = ZMAX - ((ZMAX + (G.post || 0)) % 12); z > -6; z -= 12) {
      [-1, 1].forEach(sd => {
        const m = P.get('post', () => {
          const g = new THREE.Group();
          const pole = new THREE.Mesh(new THREE.BoxGeometry(.16, 4.2, .16), Arcade3D.std('#2a1340')); pole.position.y = 2.1; pole.castShadow = true; g.add(pole);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, .1, .1), Arcade3D.std('#2a1340')); arm.position.set(0, 4.15, 0); g.add(arm); g.userData.arm = arm;
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), Arcade3D.glowMat('#ffffff')); bulb.position.set(0, 4.05, 0); g.add(bulb); g.userData.bulb = bulb;
          const gl = new THREE.Sprite(Arcade3D.glowSprite('#ffffff')); gl.scale.set(2.4, 2.4, 1); gl.position.set(0, 4.05, 0); g.add(gl); g.userData.gl = gl;
          /* palmeira em silhueta com rebordo néon, um pouco para fora da estrada */
          const palm = new THREE.Group(); palm.position.set(0, 0, -6); g.add(palm); g.userData.palm = palm;
          const trunkM = Arcade3D.std('#1b0b2a', { roughness: .8 }), edge = Arcade3D.glowMat('#f472b6');
          for (let k = 0; k < 6; k++) { const s2 = new THREE.Mesh(new THREE.CylinderGeometry(.16 - k * .012, .2 - k * .012, 1.05, 7), trunkM); s2.position.set(Math.sin(k * .35) * .5, .5 + k * .98, 0); s2.rotation.z = -.12 - k * .03; palm.add(s2); }
          const top = new THREE.Vector3(Math.sin(5 * .35) * .5 + .1, 6.3, 0);
          for (let k = 0; k < 7; k++) {
            const a = k / 7 * Math.PI * 2, fr = new THREE.Group(); fr.position.copy(top); fr.rotation.y = a; palm.add(fr);
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), trunkM); leaf.scale.set(1.7, .07, .32); leaf.position.set(1.5, -.35, 0); leaf.rotation.z = -.42; fr.add(leaf);
            const rim = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), edge); rim.scale.set(1.7, .02, .05); rim.position.set(1.5, -.3, 0); rim.rotation.z = -.42; fr.add(rim);
          }
          return g;
        });
        const x = sd * (LW * 1.5 + 1.6);
        m.position.set(x, 0, -z * ZS);
        m.userData.arm.position.x = -sd * .5; m.userData.bulb.position.x = -sd * 1; m.userData.gl.position.x = -sd * 1;
        m.userData.palm.position.x = sd * 2.2; m.userData.palm.rotation.y = sd > 0 ? Math.PI : 0; m.userData.palm.visible = Math.round((z + G.dist / .8) / 12) % 2 === 0;
        const c = sd < 0 ? '#22d3ee' : '#f472b6'; m.userData.bulb.material = Arcade3D.glowMat(c); m.userData.gl.material = Arcade3D.glowSprite(c);
      });
    }
    P.end();
    /* câmara: atrás e acima, puxa para trás com a velocidade, inclina nas curvas */
    const k = (G.v - G.cfg.v0) / (G.cfg.vMax - G.cfg.v0);
    const [shx, shy] = api.shakeXY;
    R.cam.position.set(px * .7 + shx * .02, 4.3 + shy * .02, 10.2 + k * .8);
    R.cam.lookAt(px * .55, 1.2, -14);
    R.cam.rotateZ(R.lean * .06);
    R.cam.fov = 56 + k * 12; R.cam.updateProjectionMatrix();
    Arcade3D.sunAt(R.sun, px, 0, -10, 14, [.2, 1, -.6]);
    R.renderer.render(R.scene, R.cam);
    /* linhas de velocidade (2D, por cima) */
    if (k > .3) {
      ctx.strokeStyle = `rgba(255,255,255,${(k - .3) * .3})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) { const a = (i * 2.4 + api.t * 9) % 1, sd = i % 2 ? 1 : -1, xx = W / 2 + sd * (W * .3 + a * W * .25), yy = H * .45 + a * H * .5; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + sd * 18, yy + 44); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.font = '700 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('‹', 24, H - 24); ctx.fillText('›', W - 24, H - 24);
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    cur3 = null;
    R.scene.traverse(o => { const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(mm => { if (mm.map && !mm.userData.shared && mm.map !== Arcade3D.glowTex()) mm.map.dispose(); }); });
    if (R.scene.background) R.scene.background.dispose();
    Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  /* ── desenho ── */
  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    cur3 = null;
    draw2D(G, ctx, W, H, api);
  }
  function drawCar(ctx, x, y, s, body, glow, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(tilt || 0);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(0, 4, 50, 9, 0, 0, 6.3); ctx.fill();
    if (glow) { ctx.fillStyle = glow; ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(0, 6, 56, 11, 0, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#111'; U.rr(ctx, -44, -12, 14, 16, 3); ctx.fill(); U.rr(ctx, 30, -12, 14, 16, 3); ctx.fill();
    ctx.fillStyle = body; U.rr(ctx, -46, -40, 92, 38, 12); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; U.rr(ctx, -30, -60, 60, 24, 9); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,.35)'; U.rr(ctx, -25, -56, 50, 16, 6); ctx.fill();
    ctx.fillStyle = '#ff2d55'; U.rr(ctx, -40, -30, 22, 7, 3); ctx.fill(); U.rr(ctx, 18, -30, 22, 7, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-12, -20, 24, 8);
    ctx.restore();
  }

  function draw2D(G, ctx, W, H, api) {
    const hz = H * .34;
    /* céu + sol synthwave */
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#0b0322'); sky.addColorStop(1, '#4a0f55');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    /* estrelas */
    for (let i = 0; i < 42; i++) {
      const x = (i * 97.3) % W, y = (i * 53.7) % (hz - 40);
      ctx.globalAlpha = .25 + .5 * Math.abs(Math.sin(api.t * (.6 + i % 5 * .3) + i));
      ctx.fillStyle = i % 7 ? '#fff' : '#f9a8d4'; ctx.fillRect(x, y, i % 3 ? 1.2 : 2, i % 3 ? 1.2 : 2);
    }
    ctx.globalAlpha = 1;
    const sunR = 70, sy = hz - 18;
    const sg = ctx.createLinearGradient(0, sy - sunR, 0, sy + sunR);
    sg.addColorStop(0, '#fde047'); sg.addColorStop(1, '#f43f5e');
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, sy, sunR, Math.PI, 0); ctx.closePath(); ctx.clip();
    ctx.fillStyle = sg; ctx.fillRect(W / 2 - sunR, sy - sunR, sunR * 2, sunR);
    ctx.fillStyle = '#2a0838';
    for (let i = 0; i < 6; i++) { const yy = sy - 6 - i * 10; ctx.fillRect(W / 2 - sunR, yy, sunR * 2, 2 + i * .7); }
    ctx.restore();
    ctx.fillStyle = '#1a0526';
    ctx.beginPath(); ctx.moveTo(0, hz);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hz - 14 - Math.abs(Math.sin(x * .031) * 26) - Math.abs(Math.sin(x * .011)) * 20);
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    /* chão */
    const gr = ctx.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, '#12051f'); gr.addColorStop(1, '#070211');
    ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = 'rgba(244,114,182,.18)'; ctx.lineWidth = 1;
    for (let z = 6 - G.stripe; z < ZMAX; z += 6) { const y = rowY(api, z); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    /* estrada */
    const zN = -2.5, zF = ZMAX;
    const hw = z => LANE * 1.55 * scale(z);
    ctx.fillStyle = '#0d0a18';
    ctx.beginPath(); ctx.moveTo(W / 2 - hw(zF), rowY(api, zF)); ctx.lineTo(W / 2 + hw(zF), rowY(api, zF));
    ctx.lineTo(W / 2 + hw(zN), rowY(api, zN)); ctx.lineTo(W / 2 - hw(zN), rowY(api, zN)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 3; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 10;
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(W / 2 + sd * hw(zF), rowY(api, zF)); ctx.lineTo(W / 2 + sd * hw(zN), rowY(api, zN)); ctx.stroke(); });
    ctx.shadowBlur = 0;
    /* postes néon nas bermas (do fundo para a frente) */
    for (let z = ZMAX - ((ZMAX + (G.post || 0)) % 12); z > zN; z -= 12) {
      const s = scale(z), y = rowY(api, z), ph = 70 * s, fade = Math.min(1, (ZMAX - z) / 12);
      ctx.globalAlpha = fade;
      [-1, 1].forEach(sd => {
        const x = W / 2 + sd * hw(z) * 1.18;
        ctx.fillStyle = '#2a1340'; ctx.fillRect(x - 1.6 * s - .4, y - ph, 3.2 * s + .8, ph);
        ctx.fillStyle = sd < 0 ? '#22d3ee' : '#f472b6';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12 * s;
        ctx.beginPath(); ctx.arc(x, y - ph, 4.5 * s + .6, 0, 6.3); ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
    ctx.globalAlpha = 1;
    /* tracejado das faixas */
    ctx.fillStyle = 'rgba(103,232,249,.75)';
    [.5, 1.5].forEach(l => {
      for (let z = -G.stripe; z < ZMAX; z += 6) {
        const z1 = z + 3; if (z1 < zN) continue;
        const a = Math.max(z, zN);
        const x0 = laneX(api, l, a), x1 = laneX(api, l, z1), y0 = rowY(api, a), y1 = rowY(api, z1), w0 = 3 * scale(a), w1 = 3 * scale(z1);
        ctx.beginPath(); ctx.moveTo(x0 - w0, y0); ctx.lineTo(x0 + w0, y0); ctx.lineTo(x1 + w1, y1); ctx.lineTo(x1 - w1, y1); ctx.closePath(); ctx.fill();
      }
    });

    /* objetos, do fundo para a frente */
    const list = G.objs.filter(o => o.z > -3).sort((a, b) => b.z - a.z);
    list.forEach(o => {
      const s = scale(o.z), x = laneX(api, o.lane, o.z), y = rowY(api, o.z);
      const fade = Math.min(1, (ZMAX - o.z) / 10);
      ctx.globalAlpha = fade;
      if (o.t === 'bar') {
        const w = LANE * .82 * s, h = 46 * s;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x - w / 2, y - 3 * s, w, 6 * s);
        ctx.fillStyle = '#1f1235'; ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h * .8, w, h * .45); ctx.clip();
        for (let i = -2; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fb923c' : '#111'; ctx.beginPath(); const bx = x - w / 2 + i * w / 6; ctx.moveTo(bx, y - h * .35); ctx.lineTo(bx + w / 12, y - h * .8); ctx.lineTo(bx + w / 6 + w / 12, y - h * .8); ctx.lineTo(bx + w / 6, y - h * .35); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2 * s + .5; ctx.strokeRect(x - w / 2, y - h, w, h);
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x - w * .38, y - h, 4 * s, 0, 6.3); ctx.arc(x + w * .38, y - h, 4 * s, 0, 6.3); ctx.fill();
      } else if (o.t === 'coin') {
        const r = 13 * s, sp = Math.abs(Math.sin(api.t * 5 + o.z));
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(x, y - 26 * s, r * (.25 + .75 * sp), r, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(x, y - 26 * s, r * .55 * (.25 + .75 * sp), r * .55, 0, 0, 6.3); ctx.fill();
      } else if (o.t === 'shield') {
        const r = 16 * s; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3 * s + .5; ctx.fillStyle = 'rgba(103,232,249,.25)';
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + api.t; ctx.lineTo(x + Math.cos(a) * r, y - 30 * s + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (o.t === 'car') {
        drawCar(ctx, x, y, s * .92, `hsl(${o.hue},70%,45%)`, null, 0);
        if (o.from !== o.to && o.z < 50 && Math.floor(api.t * 6) % 2) {
          const sd = o.to > o.from ? 1 : -1; ctx.fillStyle = '#fbbf24';
          ctx.beginPath(); ctx.arc(x + sd * 40 * s, y - 28 * s, 5 * s + .5, 0, 6.3); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });

    /* jogador */
    if (!G.boom) {
      const x = laneX(api, G.px, 0), y = rowY(api, 0);
      drawCar(ctx, x, y, 1, '#22d3ee', '#f472b6', G.tilt * .12);
      if (G.shield || G.shieldFx > 0) {
        ctx.strokeStyle = `rgba(103,232,249,${G.shield ? .55 + .25 * Math.sin(api.t * 6) : G.shieldFx})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y - 26, 66, 44, 0, 0, 6.3); ctx.stroke();
      }
    }
    /* velocímetro de linhas (sensação de velocidade) */
    const k = (G.v - G.cfg.v0) / (G.cfg.vMax - G.cfg.v0);
    if (k > .3) {
      ctx.strokeStyle = `rgba(255,255,255,${(k - .3) * .25})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) { const a = (i * 2.4 + api.t * 9) % 1; const sd = i % 2 ? 1 : -1; const xx = W / 2 + sd * (W * .35 + a * W * .2); ctx.beginPath(); ctx.moveTo(xx, hz + a * (H - hz)); ctx.lineTo(xx + sd * 14, hz + a * (H - hz) + 40); ctx.stroke(); }
    }
    /* zonas de toque (dica subtil) */
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.font = "700 26px system-ui"; ctx.textAlign = 'center';
    ctx.fillText('‹', 24, H - 24); ctx.fillText('›', W - 24, H - 24);
  }

  return ArcadeKit.create({
    id: 'lane-rush', title: 'Faixa Rápida', icon: '🏎️',
    accent: '#f472b6', accent2: '#22d3ee', bg: '#08020f', transparent: true, destroy,
    tagline: 'Três faixas, obstáculos a vir e a velocidade sempre a subir. Até onde chegas?',
    view: { w: 400 },
    how: [
      'Toca/clica na <b>metade esquerda</b> ou <b>direita</b> do ecrã para mudar de faixa (ou usa ← →).',
      'Foge às barreiras e aos carros — os carros com pisca aceso vão mudar de faixa.',
      'Apanha moedas (+5), passa rente aos obstáculos (+3) e agarra o <b>escudo</b> quando aparecer.',
    ],
    controls: ['🖱️ Clique esq./dir.', '👆 Toque esq./dir.', '⌨️ ← →'],
    ready: { title: 'Toca para arrancar', hint: 'Toca à esquerda ou à direita do carro para trocar de faixa.' },
    setup, update, draw,
    down: (G, x, y, api) => steer(G, x < api.W / 2 ? -1 : 1, api),
    key: (G, e, api) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { steer(G, -1, api); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { steer(G, 1, api); return true; }
    },
    hud: G => [['Pontos', G.score], ['km/h', Math.round(G.v * 6)], ['🪙', G.coins], ...(G.shield ? [['Escudo', '🛡️', 'hot']] : [])],
    achievements: [
      { id: 'lr.1k',  name: 'Na Autoestrada', icon: '🏎️', desc: 'Percorre 1000 m na Faixa Rápida.', test: c => ((c.result.meta || {}).dist || 0) >= 1000 },
      { id: 'lr.3k',  name: 'Piloto Neon',    icon: '🌆', desc: 'Percorre 3000 m na Faixa Rápida.', test: c => ((c.result.meta || {}).dist || 0) >= 3000 },
      { id: 'lr.500', name: 'Pé no Fundo',    icon: '🔥', desc: 'Faz 500 pontos na Faixa Rápida.', test: c => (c.result.score || 0) >= 500 },
    ],
  });
})();
