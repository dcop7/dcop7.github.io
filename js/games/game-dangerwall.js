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
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { const G = api.G3; if (G && !G.r3) try { build3D(G, api); } catch (e) { console.warn('[parede] 3D falhou', e); } }).catch(() => {});
    return api.G3 = { cfg, lives: cfg.lives, px: 0, py: 0, tx: 0, ty: 0, vx: 0, walls: [], n: 0, spawned: 0, score: 0, tights: 0, inv: 0, level: 1, t: 0, next: .6,
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

  /* ════════════════════════════════════════════════════════════════
     3D — túnel de néon com grelha a correr, paredes de vidro escuro com
     buracos recortados (ExtrudeGeometry com "holes") e arestas a brilhar,
     nave low-poly com reator. A câmara é calculada para o plano da nave
     coincidir com a arena 2D (o rato/dedo continua a mapear igual).
  ════════════════════════════════════════════════════════════════ */
  const S3 = 4, DEPTH = 70;
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const scene = new THREE.Scene();
    /* fundo: nebulosa e estrelas (fora da boca do túnel já não é preto liso) */
    scene.background = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 1024; const x = c.getContext('2d');
      x.fillStyle = '#04050d'; x.fillRect(0, 0, 512, 1024);
      [['#3b0764', 120, 220, 300], ['#1e3a8a', 380, 520, 340], ['#701a75', 160, 820, 260], ['#0e7490', 420, 120, 200]].forEach(([col, cx, cy, r]) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 512, 1024); });
      for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .8})`; const s = Math.random() < .08 ? 2 : 1; x.fillRect(Math.random() * 512, Math.random() * 1024, s, s); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    scene.fog = new THREE.Fog('#04050d', 30, DEPTH + 8);
    scene.add(new THREE.HemisphereLight('#c7d2fe', '#0b0b1a', .9));
    const key = new THREE.PointLight('#ffffff', 60, 30, 1.6); key.position.set(0, 2, 5); scene.add(key);
    const cam = new THREE.PerspectiveCamera(60, 1, .1, 200);
    /* túnel: 4 painéis com grelha (a textura corre para dar velocidade) */
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#05060f'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#ffffff'; x.globalAlpha = .6; x.lineWidth = 2; x.strokeRect(1, 1, 126, 126);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, DEPTH / 4);
    const tunM = new THREE.MeshBasicMaterial({ map: tex, color: '#38bdf8', side: THREE.BackSide });
    const tun = new THREE.Mesh(new THREE.BoxGeometry(S3 * 2 + .02, S3 * 2 + .02, DEPTH), tunM);
    tun.position.z = -DEPTH / 2 - .01; scene.add(tun);
    /* molduras a vir (como no 2D) */
    const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(S3 * 2, S3 * 2));
    const frames = Array.from({ length: 9 }, () => { const l = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: .5 })); scene.add(l); return l; });
    /* estrelas em "warp" à frente */
    const sv = []; for (let i = 0; i < 300; i++) { const a = Math.random() * 6.28, r = .3 + Math.random() * 3.6; sv.push(Math.cos(a) * r, Math.sin(a) * r, -Math.random() * DEPTH); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dbeafe', size: .06, transparent: true, opacity: .8 })); scene.add(stars);
    /* moldura metálica da boca do túnel (com riscas de perigo e aresta a brilhar) */
    {
      const sh = new THREE.Shape(), E = S3 + .55, I = S3 + .02;
      sh.moveTo(-E, -E); sh.lineTo(E, -E); sh.lineTo(E, E); sh.lineTo(-E, E); sh.lineTo(-E, -E);
      const hole = new THREE.Path(); hole.moveTo(-I, -I); hole.lineTo(-I, I); hole.lineTo(I, I); hole.lineTo(I, -I); hole.lineTo(-I, -I); sh.holes.push(hole);
      /* textura em coordenadas da forma (−E..E → 0..1): metal escuro com rebites e uma faixa fina de perigo junto à abertura */
      const ft = (() => {
        const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const y = c.getContext('2d'), px = v => (v / E + 1) / 2 * N;
        y.fillStyle = '#23283a'; y.fillRect(0, 0, N, N);
        for (let i = 0; i < 40; i++) { y.strokeStyle = 'rgba(255,255,255,.05)'; y.beginPath(); y.moveTo(i * N / 40, 0); y.lineTo(i * N / 40, N); y.stroke(); }
        const a = px(-I - .2), b = px(I + .2);
        y.save(); y.beginPath(); y.rect(a, a, b - a, b - a); y.rect(px(I), px(-I), px(-I) - px(I), px(I) - px(-I)); y.clip('evenodd');
        y.fillStyle = '#16181f'; y.fillRect(0, 0, N, N); y.fillStyle = 'rgba(250,204,21,.85)';
        for (let i = -40; i < 80; i++) { y.beginPath(); y.moveTo(i * 12, N); y.lineTo(i * 12 + 6, N); y.lineTo(i * 12 + 6 + N, 0); y.lineTo(i * 12 + N, 0); y.fill(); }
        y.restore();
        y.fillStyle = 'rgba(0,0,0,.45)'; for (let k = 0; k < 24; k++) { const t2 = k / 24 * N; [[t2, px(-E + .14)], [t2, px(E - .14)], [px(-E + .14), t2], [px(E - .14), t2]].forEach(([u, v]) => { y.beginPath(); y.arc(u, v, 2.4, 0, 6.3); y.fill(); }); }
        const t = new THREE.CanvasTexture(c); t.repeat.set(1 / (2 * E), 1 / (2 * E)); t.offset.set(.5, .5); t.colorSpace = THREE.SRGBColorSpace; return t;
      })();
      const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .6, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ map: ft, metalness: .55, roughness: .45 }));
      frame.position.z = -.3; scene.add(frame);
      const lip = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(I * 2, I * 2)), new THREE.LineBasicMaterial({ color: '#7dd3fc' })); lip.position.z = .32; scene.add(lip);
    }
    /* nave: fuselagem, cabine de vidro, asas em delta com motores e pontas a brilhar */
    const ship = new THREE.Group();
    const hullM = new THREE.MeshStandardMaterial({ color: '#e8eef6', metalness: .6, roughness: .28, flatShading: true });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(.08, .26, 1.15, 8), hullM); hull.rotation.x = -Math.PI / 2; hull.scale.set(1, 1, .7); ship.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.08, .35, 8), hullM); nose.rotation.x = -Math.PI / 2; nose.position.z = -.75; ship.add(nose);
    const wingM = new THREE.MeshStandardMaterial({ color: '#0ea5e9', metalness: .5, roughness: .3, flatShading: true });
    const wsh = new THREE.Shape(); wsh.moveTo(0, -.25); wsh.lineTo(.78, .32); wsh.lineTo(.74, .44); wsh.lineTo(0, .3); wsh.lineTo(-.74, .44); wsh.lineTo(-.78, .32); wsh.lineTo(0, -.25);
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wsh, { depth: .05, bevelEnabled: false }), wingM); wing.rotation.x = Math.PI / 2; wing.position.set(0, -.02, .06); ship.add(wing);
    const stripeM = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: .3, roughness: .4 });
    [-1, 1].forEach(sd => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(.075, .09, .5, 8), hullM); pod.rotation.x = -Math.PI / 2; pod.position.set(sd * .34, -.02, .32); ship.add(pod);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.085, .018, 6, 12), stripeM); ring.position.set(sd * .34, -.02, .58); ship.add(ring);
      const eng = new THREE.Sprite(Arcade3D.glowSprite('#38bdf8')); eng.position.set(sd * .34, -.02, .66); eng.scale.set(.5, .5, 1); ship.add(eng);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), Arcade3D.glowMat(sd < 0 ? '#ef4444' : '#22c55e')); tip.position.set(sd * .77, -.02, .44); ship.add(tip);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(.04, .26, .3), wingM); fin.position.set(sd * .74, .1, .38); ship.add(fin);
    });
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#0891b2', emissiveIntensity: .8, roughness: .05, metalness: .3 })); cockpit.scale.set(.85, .65, 1.9); cockpit.position.set(0, .1, -.2); ship.add(cockpit);
    const flame = new THREE.Sprite(Arcade3D.glowSprite('#fb923c')); flame.position.set(0, 0, .62); flame.scale.set(.9, .9, 1); ship.add(flame);
    const halo = new THREE.Sprite(Arcade3D.glowSprite('#38bdf8')); halo.scale.set(2.2, 2.2, 1); halo.material.opacity = .35; ship.add(halo);
    ship.scale.setScalar(SR * S3 * 1.9);
    scene.add(ship);
    G.r3 = { renderer, scene, cam, tun, tex, frames, stars, ship, flame, walls: new Map() };
  }

  function wallMesh(R, w, hue) {
    /* geometria do painel com buracos; recalculada se os buracos se mexem */
    const keyOf = () => w.holes.map(h => { const [hx, hy] = holePos(w, h); return hx.toFixed(3) + ',' + hy.toFixed(3); }).join('|');
    let o = R.walls.get(w);
    const k = keyOf();
    if (!o) {
      const g = new THREE.Group();
      /* textura do painel: chapas com rebites e riscas de perigo à volta de cada buraco
         (as UV da ExtrudeGeometry são as coordenadas da forma: −S3..S3 → 0..1) */
      const tc = document.createElement('canvas'); tc.width = tc.height = 256; const tx = tc.getContext('2d');
      const paint = () => { tx.fillStyle = '#9aa3b5'; tx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { tx.fillStyle = (i + j) % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'; tx.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); tx.strokeStyle = 'rgba(0,0,0,.35)'; tx.strokeRect(i * 64 + 2, j * 64 + 2, 60, 60); tx.fillStyle = 'rgba(0,0,0,.4)'; [[6, 6], [56, 6], [6, 56], [56, 56]].forEach(([a, b]) => { tx.beginPath(); tx.arc(i * 64 + 2 + a, j * 64 + 2 + b, 2, 0, 6.3); tx.fill(); }); }
      w.holes.forEach(h => {
        const [hx, hy] = holePos(w, h), cx = (hx + 1) * 128, cy = (hy + 1) * 128;
        tx.save(); tx.beginPath();
        if (h.s === 'c') { tx.arc(cx, cy, h.r * 128 + 12, 0, 6.3); tx.arc(cx, cy, h.r * 128, 0, 6.3, true); }
        else { const hw = h.w * 64, hh = h.h * 64; tx.rect(cx - hw - 12, cy - hh - 12, hw * 2 + 24, hh * 2 + 24); tx.rect(cx + hw, cy - hh, -hw * 2, hh * 2); }
        tx.clip('evenodd'); tx.fillStyle = '#111827'; tx.fillRect(0, 0, 256, 256); tx.fillStyle = '#facc15';
        for (let i = -20; i < 40; i++) { tx.beginPath(); tx.moveTo(i * 14, 256); tx.lineTo(i * 14 + 7, 256); tx.lineTo(i * 14 + 263, 0); tx.lineTo(i * 14 + 256, 0); tx.fill(); }
        tx.restore();
      }); wt.needsUpdate = true; };
      const wt = new THREE.CanvasTexture(tc); wt.colorSpace = THREE.SRGBColorSpace; wt.repeat.set(1 / (S3 * 2), 1 / (S3 * 2)); wt.offset.set(.5, .5);
      const mat = new THREE.MeshStandardMaterial({ map: wt, color: `hsl(${hue},40%,62%)`, emissive: `hsl(${hue},80%,30%)`, emissiveIntensity: .25, roughness: .5, metalness: .35, transparent: true, opacity: .96 });
      const edgeM = new THREE.LineBasicMaterial({ color: `hsl(${hue},95%,62%)`, transparent: true });
      o = { g, mat, edgeM, key: '', mesh: null, edge: null, paint, tex: wt };
      R.scene.add(g); R.walls.set(w, o);
    }
    if (o.key !== k) {
      o.key = k; o.paint();
      if (o.mesh) { o.g.remove(o.mesh, o.edge); o.mesh.geometry.dispose(); o.edge.geometry.dispose(); }
      const sh = new THREE.Shape(); const E = S3 * 1.0;
      sh.moveTo(-E, -E); sh.lineTo(E, -E); sh.lineTo(E, E); sh.lineTo(-E, E); sh.lineTo(-E, -E);
      w.holes.forEach(h => {
        const [hx, hy] = holePos(w, h), cx = hx * S3, cy = -hy * S3;
        const path = new THREE.Path();
        if (h.s === 'c') path.absarc(cx, cy, h.r * S3, 0, Math.PI * 2, true);
        else { const hw = h.w / 2 * S3, hh = h.h / 2 * S3; path.moveTo(cx - hw, cy - hh); path.lineTo(cx - hw, cy + hh); path.lineTo(cx + hw, cy + hh); path.lineTo(cx + hw, cy - hh); path.lineTo(cx - hw, cy - hh); }
        sh.holes.push(path);
      });
      const geo = new THREE.ExtrudeGeometry(sh, { depth: .35, bevelEnabled: false, curveSegments: 20 });
      geo.translate(0, 0, -.35);
      o.mesh = new THREE.Mesh(geo, o.mat);
      o.edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), o.edgeM);
      o.g.add(o.mesh, o.edge);
    }
    return o;
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, A = arena(api);
    const hue = 175 + ((G.level - 1) * 37) % 125;
    Arcade3D.fit(api.stage, R.cam);
    /* câmara: o plano z=0 coincide com a arena 2D */
    const u = S3 / A.h, fovR = R.cam.fov * Math.PI / 180, D = (H / 2 * u) / Math.tan(fovR / 2);
    const [shx, shy] = api.shakeXY;
    R.cam.position.set((W / 2 - A.cx) * u + shx * u, (A.cy - H / 2) * u - shy * u, D);
    R.cam.lookAt(R.cam.position.x, R.cam.position.y, 0);
    R.tun.material.color.setHSL(hue / 360, .9, .55);
    R.tex.offset.y = (G.t * (1.2 + G.level * .15)) % 1;
    R.frames.forEach((f, i) => { const z = ((i + 1 - (G.t * (1.2 + G.level * .15)) % 1) / 9); f.position.z = -z * DEPTH; f.material.color.setHSL(hue / 360, .9, .6); f.material.opacity = Math.min(.55, (1 - z) * .6); });
    const sp = R.stars.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) { let z = sp.getZ(i) + (20 + G.level * 4) * (1 / 60); if (z > 2) z -= DEPTH; sp.setZ(i, z); }
    sp.needsUpdate = true;
    /* paredes */
    const live = new Set();
    G.walls.forEach(w => {
      live.add(w);
      const o = wallMesh(R, w, hue);
      const z = w.z <= 0 ? (w.pass ? (w.fx || 0) * 14 : 0) : -w.z * DEPTH;
      o.g.position.set(0, 0, z); o.g.rotation.z = -w.rot;
      const a = w.z <= 0 ? Math.max(0, 1 - (w.fx || 0) / .45) : Math.min(1, (1 - w.z) * 2.5);
      o.mat.opacity = .93 * a * (w.pass ? .6 : 1); o.edgeM.opacity = a;
      const danger = w.z < .25 && w.z > 0 && clearance(w, G.px, G.py) < 0;
      o.edgeM.color.set(danger || w.hit ? '#f87171' : `hsl(${hue},95%,62%)`);
      o.mat.emissive.set(w.hit ? '#b91c1c' : `hsl(${hue},80%,30%)`);
    });
    R.walls.forEach((o, w) => { if (!live.has(w)) { R.scene.remove(o.g); o.mesh && o.mesh.geometry.dispose(); o.edge && o.edge.geometry.dispose(); o.mat.dispose(); o.edgeM.dispose(); o.tex && o.tex.dispose(); R.walls.delete(w); } });
    /* nave */
    const sh = R.ship;
    sh.visible = !(G.inv > 0 && Math.floor(G.t * 14) % 2);
    sh.position.set(G.px * S3, -G.py * S3, .2);
    /* vista de cima-trás (de trás seria só uma linha): nariz inclinado para o túnel */
    sh.rotation.set(1.05 - G.py * .15, 0, -U.clamp(G.vx * .12, -.6, .6));
    R.flame.scale.setScalar(.7 + Math.random() * .4);
    R.renderer.render(R.scene, R.cam);
    /* 2D por cima: mira, escudos, dica */
    const x = A.cx + G.px * A.h, y = A.cy + G.py * A.h, r = SR * A.h;
    ctx.strokeStyle = 'rgba(125,211,252,.35)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < G.cfg.lives; i++) {
      const sx = W / 2 - (G.cfg.lives - 1) * 16 + i * 32, sy = H - 30;
      ctx.globalAlpha = i < G.lives ? 1 : .2;
      ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.moveTo(sx, sy - 11); ctx.lineTo(sx + 10, sy - 6); ctx.lineTo(sx + 8, sy + 5); ctx.lineTo(sx, sy + 11); ctx.lineTo(sx - 8, sy + 5); ctx.lineTo(sx - 10, sy - 6); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (G.t < 3.5) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '600 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(G.touchMode ? 'Arrasta o dedo em qualquer lado para mover a nave' : 'A nave segue o cursor', W / 2, A.cy + A.h + 34); }
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    R.walls.forEach(o => { o.mesh && o.mesh.geometry.dispose(); o.edge && o.edge.geometry.dispose(); o.mat.dispose(); o.edgeM.dispose(); o.tex && o.tex.dispose(); });
    R.tex.dispose();
    Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }
  function draw2D(G, ctx, W, H, api) {
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
    accent: '#ef4444', accent2: '#38bdf8', bg: '#04050d', transparent: true, destroy,
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
