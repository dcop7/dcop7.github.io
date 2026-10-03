/* ══════════════════════════════════════════════════════════════════
   Torre (Stack) — larga o bloco em movimento em cima do anterior; o que
   sobra fora é cortado e cai. Isometria própria em canvas 2D (nada de
   three.js): cada bloco são três faces. "Perfeito" encaixa ao píxel e,
   em série, o bloco volta a crescer.
══════════════════════════════════════════════════════════════════ */
const StackGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const BASE = 100, LH = 20, RANGE = 150;
  const C30 = Math.cos(Math.PI / 6), S30 = .5;
  const DIFF = {
    easy:   { tol: 7,   spd: .82 },
    medium: { tol: 5,   spd: 1 },
    hard:   { tol: 3.5, spd: 1.22 },
  };

  function setup(api, o) {
    const hue0 = U.randi(0, 359);
    const G = {
      cfg: DIFF[o.diff] || DIFF.medium, hue0,
      layers: [{ x: 0, z: 0, w: BASE, d: BASE, hue: hue0 }],
      falling: [], ripples: [],
      score: 0, perfects: 0, combo: 0, bestCombo: 0,
      cam: 0, k: 1.1, over: false, overT: 0,
    };
    spawn(G);
    /* 3D (three.js) chega a seguir; até lá — ou se falhar — desenha a versão 2D */
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { if (api.state !== 'over' || G.layers) try { build3D(G, api); } catch (e) { G.fail3d = e; console.warn('[torre] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  function spawn(G) {
    const top = G.layers[G.layers.length - 1], i = G.layers.length;
    const axis = i % 2 ? 'x' : 'z';
    const from = (Math.floor(i / 2) % 2 ? 1 : -1) * RANGE;
    G.mv = {
      axis, x: axis === 'x' ? top.x + from : top.x, z: axis === 'z' ? top.z + from : top.z,
      w: top.w, d: top.d, dir: from < 0 ? 1 : -1,
      spd: Math.min(340, (128 + i * 2.4) * G.cfg.spd), hue: G.hue0 + i * 7,
    };
  }

  function place(G, api) {
    if (G.over || !G.mv) return;
    const m = G.mv, top = G.layers[G.layers.length - 1];
    const ax = m.axis, size = ax === 'x' ? m.w : m.d;
    let delta = m[ax] - top[ax];
    const y = G.layers.length * LH;
    if (Math.abs(delta) <= G.cfg.tol) {
      /* perfeito */
      delta = 0; m[ax] = top[ax];
      G.combo++; G.perfects++; G.bestCombo = Math.max(G.bestCombo, G.combo); G.perfectFlash = true;
      if (G.combo >= 3) {           /* recompensa: o bloco volta a crescer */
        const grow = Math.min(BASE - size, 6);
        if (ax === 'x') m.w += grow; else m.d += grow;
      }
      G.ripples.push({ x: m.x, z: m.z, w: m.w, d: m.d, y: y + LH, t: 0 });
      api.sfx.tone(440 * Math.pow(2, Math.min(G.combo, 14) / 12), .16, 'sine', .11);
      api.sfx.tone(660 * Math.pow(2, Math.min(G.combo, 14) / 12), .12, 'triangle', .04, .03);
      api.vibe(10);
      if (G.combo >= 3) api.float(api.W / 2, api.H * .4, 'Perfeito ×' + G.combo, '#fde68a', 22);
    } else {
      G.combo = 0; G.perfectFlash = false;
      const over = size - Math.abs(delta);
      if (over <= 0) {
        /* falhou por completo */
        G.falling.push({ x: m.x, z: m.z, w: m.w, d: m.d, y, vy: 0, hue: m.hue, a: 1 });
        G.mv = null; G.over = true;
        api.shake(8, .3); api.vibe(90);
        api.sfx.noise(.25, .12, 0, 300, 'lowpass');
        api.over({ score: G.score, won: false, delay: 1500, title: 'A torre acabou aqui', icon: '🏗️',
          stats: [['Blocos', G.score], ['Perfeitos', G.perfects], ['Melhor série', G.bestCombo]], meta: { perfects: G.perfects } });
        return;
      }
      /* corta: o pedaço de fora cai */
      const keepC = top[ax] + delta / 2;                           /* centro da parte que fica */
      const piece = { x: m.x, z: m.z, w: m.w, d: m.d, y, vy: 0, hue: m.hue, a: 1 };
      if (ax === 'x') { piece.w = Math.abs(delta); piece.x = m.x + Math.sign(delta) * (size - Math.abs(delta)) / 2; m.w = over; m.x = keepC; }
      else            { piece.d = Math.abs(delta); piece.z = m.z + Math.sign(delta) * (size - Math.abs(delta)) / 2; m.d = over; m.z = keepC; }
      G.falling.push(piece);
      api.sfx.tone(300, .08, 'triangle', .08); api.sfx.noise(.06, .06, 0, 900);
    }
    G.layers.push({ x: m.x, z: m.z, w: m.w, d: m.d, hue: m.hue });
    G.score = G.layers.length - 1;
    if (G.score % 25 === 0) { api.banner(G.score + ' blocos!', 'Continua'); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .07); }
    spawn(G);
  }

  function update(G, dt, api) {
    const m = G.mv;
    if (m) {
      const ax = m.axis, top = G.layers[G.layers.length - 1];
      m[ax] += m.dir * m.spd * dt;
      if (m[ax] > top[ax] + RANGE) { m[ax] = top[ax] + RANGE; m.dir = -1; }
      if (m[ax] < top[ax] - RANGE) { m[ax] = top[ax] - RANGE; m.dir = 1; }
    }
    stepFx(G, dt);
    const topY = G.layers.length * LH;
    G.cam = U.lerp(G.cam, topY, Math.min(1, dt * 4));
  }

  function stepFx(G, dt) {
    for (let i = G.falling.length - 1; i >= 0; i--) {
      const f = G.falling[i]; f.vy -= 900 * dt; f.y += f.vy * dt; f.a -= dt * .7;
      if (f.a <= 0) G.falling.splice(i, 1);
    }
    for (let i = G.ripples.length - 1; i >= 0; i--) { G.ripples[i].t += dt; if (G.ripples[i].t > .6) G.ripples.splice(i, 1); }
  }

  /* depois de perder: afasta a câmara para mostrar a torre inteira */
  function idleOver(G, dt, api) {
    stepFx(G, dt);
    G.overT += dt;
    const n = G.layers.length, towerH = n * LH + 120;
    const kT = Math.min(1.1, (api.H * .62) / (towerH * 1 + BASE * 1.0));
    G.k = U.lerp(G.k, kT, Math.min(1, dt * 2));
    G.cam = U.lerp(G.cam, n * LH * .5, Math.min(1, dt * 2));
  }

  /* ── desenho ── */
  function proj(G, api, x, y, z) {
    const k = G.k;
    return [api.W / 2 + (x - z) * C30 * k, api.H * .6 + (x + z) * S30 * k - (y - G.cam) * k];
  }
  function poly(ctx, pts, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); }
  function block(ctx, G, api, b, y0, y1, alpha) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, h = b.hue;
    const P = (x, y, z) => proj(G, api, x, y, z);
    if (alpha != null) ctx.globalAlpha = Math.max(0, alpha);
    poly(ctx, [P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)], `hsl(${h},52%,47%)`);
    poly(ctx, [P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0)], `hsl(${h},55%,36%)`);
    poly(ctx, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], `hsl(${h},68%,64%)`);
    /* aresta de luz */
    const a = P(x0, y1, z1), b2 = P(x1, y1, z1), c = P(x1, y1, z0);
    ctx.strokeStyle = `hsla(${h},90%,85%,.45)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ════════════════════════════════════════════════════════════════
     3D — câmara ortográfica isométrica, sombras suaves, blocos com
     arestas biseladas e brilho no topo. A lógica do jogo não muda: são
     as mesmas coordenadas (x, z no chão; y para cima).
  ════════════════════════════════════════════════════════════════ */
  function bevelBox() {
    /* caixa unitária com arestas ligeiramente arredondadas (luz a correr nas arestas) */
    const s = new THREE.Shape(), r = .06, h = .5;
    s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r);
    s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1 - .08, bevelEnabled: true, bevelThickness: .04, bevelSize: .0, bevelSegments: 2, curveSegments: 3 });
    g.rotateX(-Math.PI / 2); g.translate(0, -.5 + .04, 0);   /* extrusão ao longo de y, centrada */
    g.computeVertexNormals();
    return g;
  }

  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
    scene.add(new THREE.HemisphereLight('#f8fbff', '#3b3f58', 1.35));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
    sun.castShadow = true;
    const sm = Arcade3D.coarse() ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
    sun.shadow.bias = -.0005; sun.shadow.normalBias = .8; sun.shadow.radius = 4;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#b4c6ff', .55); fill.position.set(-300, 120, 260); scene.add(fill);
    const geo = bevelBox();
    const R3 = { renderer, scene, cam, sun, geo, meshes: [], falls: new Map(), rips: new Map(), mv: null };
    /* pedestal alto por baixo da 1.ª camada */
    /* pedestal: mesma cor da 1.ª camada no topo, a escurecer para o fundo (antes era um bloco azul-escuro desligado da torre) */
    const pt = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#ffffff'); g.addColorStop(.06, '#d9d9d9'); g.addColorStop(.35, '#6b6b6b'); g.addColorStop(1, '#141414'); x.fillStyle = g; x.fillRect(0, 0, 8, 256); for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 8 + i * 6, 8, 1); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [0, 1, 2, 3, 4, 5].map(i => new THREE.MeshStandardMaterial({ map: i === 2 || i === 3 ? null : pt, color: '#ffffff', roughness: .6 })));
    ped.receiveShadow = true; scene.add(ped); R3.ped = ped;
    G.r3 = R3;
  }

  const col3 = (h, l) => new THREE.Color().setHSL((((h % 360) + 360) % 360) / 360, .62, l);
  function blockMesh(R3, b, light) {
    const m = new THREE.Mesh(R3.geo, new THREE.MeshStandardMaterial({ color: col3(b.hue, light || .56), roughness: .42, metalness: .05 }));
    m.castShadow = true; m.receiveShadow = true;
    R3.scene.add(m); return m;
  }
  const place3 = (m, b, y0, y1) => { m.scale.set(b.w, y1 - y0, b.d); m.position.set(b.x, (y0 + y1) / 2, b.z); };

  function sync3D(G, dt, api) {
    const R3 = G.r3, n = G.layers.length;
    /* camadas: cria as que faltam; só as que a câmara vê ficam visíveis */
    const lowY = G.cam - (R3.hh || 300) / G.k * 1.8;
    for (let i = 0; i < n; i++) {
      let m = R3.meshes[i];
      if (!m && i > 0) { m = R3.meshes[i] = blockMesh(R3, G.layers[i]); place3(m, G.layers[i], i * LH, (i + 1) * LH); m.userData.born = G.t3 || 0; }
      if (m) m.visible = (i + 1) * LH > lowY;
    }
    if (!R3.meshes[0]) { const m = R3.meshes[0] = blockMesh(R3, G.layers[0], .5); place3(m, G.layers[0], 0, LH); }
    const b0 = G.layers[0]; R3.ped.scale.set(b0.w - 2, 900, b0.d - 2); R3.ped.position.set(b0.x, -450, b0.z);
    if (R3.pedHue !== b0.hue) { R3.pedHue = b0.hue; R3.ped.material.forEach(m => m.color.copy(col3(b0.hue, .5))); }
    /* bloco em movimento (um só mesh reutilizado) */
    if (G.mv) {
      if (!R3.mv) R3.mv = blockMesh(R3, G.mv);
      R3.mv.visible = true; R3.mv.material.color.copy(col3(G.mv.hue, .58));
      place3(R3.mv, G.mv, n * LH, (n + 1) * LH);
    } else if (R3.mv) R3.mv.visible = false;
    /* peças cortadas a cair (e a rodar) */
    const seen = new Set();
    G.falling.forEach(f => {
      seen.add(f);
      let m = R3.falls.get(f);
      if (!m) { m = blockMesh(R3, f); m.material.transparent = true; m.userData.spin = (Math.random() - .5) * 3; R3.falls.set(f, m); }
      place3(m, f, f.y, f.y + LH); m.rotation.x += m.userData.spin * dt * .6; m.rotation.z += m.userData.spin * dt;
      m.material.opacity = Math.max(0, f.a);
    });
    R3.falls.forEach((m, f) => { if (!seen.has(f)) { R3.scene.remove(m); m.material.dispose(); R3.falls.delete(f); } });
    /* ondas do "perfeito": moldura branca que cresce e desvanece */
    const rs = new Set();
    G.ripples.forEach(r => {
      rs.add(r);
      let m = R3.rips.get(r);
      if (!m) {
        const sh = new THREE.Shape(); sh.moveTo(-.5, -.5); sh.lineTo(.5, -.5); sh.lineTo(.5, .5); sh.lineTo(-.5, .5);
        const hole = new THREE.Path(); const q = .44; hole.moveTo(-q, -q); hole.lineTo(-q, q); hole.lineTo(q, q); hole.lineTo(q, -q); sh.holes.push(hole);
        m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false }));
        m.rotation.x = -Math.PI / 2; R3.scene.add(m); R3.rips.set(r, m);
      }
      const g = 1.04 + r.t * .9;
      m.scale.set(r.w * g, r.d * g, 1); m.position.set(r.x, r.y + .6, r.z);
      m.material.opacity = .9 * (1 - r.t / .6);
    });
    R3.rips.forEach((m, r) => { if (!rs.has(r)) { R3.scene.remove(m); m.geometry.dispose(); m.material.dispose(); R3.rips.delete(r); } });
    /* o último bloco pousado brilha um instante */
    const top = R3.meshes[n - 1];
    if (top && top.userData.flash !== n) { top.userData.flash = n; top.userData.ft = G.perfectFlash ? .5 : .18; top.material.emissive = new THREE.Color('#ffffff'); }
    R3.meshes.forEach(m => { if (m && m.userData.ft > 0) { m.userData.ft = Math.max(0, m.userData.ft - dt); m.material.emissiveIntensity = m.userData.ft * 1.4; } });
  }

  function draw3D(G, ctx, W, H, api) {
    const R3 = G.r3, n = G.layers.length, hue = G.hue0 + n * 7;
    const dt = Math.min(.05, Math.max(0, api.t - (G.t3 || api.t))); G.t3 = api.t;
    /* fundo: gradiente CSS no palco (muda com a altura da torre) */
    const key = Math.round(hue);
    if (R3.bgKey !== key) {
      R3.bgKey = key;
      api.stage.style.background = `radial-gradient(120% 90% at 50% 20%, hsl(${hue + 30},55%,34%) 0%, hsl(${hue + 10},48%,18%) 55%, hsl(${hue},45%,8%) 100%)`;
    }
    const aspect = Arcade3D.fit(api.stage, null);
    /* janela ortográfica: cabe o curso do bloco (±RANGE) na largura, mesmo ao alto */
    const hh = Math.max(205, 212 / aspect) / G.k, hw = hh * aspect;
    R3.hh = hh * G.k;
    const cam = R3.cam;
    cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.updateProjectionMatrix();
    const ty = G.cam + hh * .05;
    cam.position.set(420, ty + 420 * .82, 420); cam.lookAt(0, ty, 0);
    const sun = R3.sun, ext = Math.max(hw, hh) * 1.2;
    sun.position.set(-160, ty + 520, 260); sun.target.position.set(0, ty - 60, 0);
    const sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 1600; sc.updateProjectionMatrix();
    sync3D(G, dt, api);
    R3.renderer.render(R3.scene, cam);
    /* por cima (canvas 2D): contador grande */
    ctx.save(); ctx.textAlign = 'center'; ctx.font = "800 64px 'Space Grotesk', system-ui, sans-serif";
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillText(G.score, W / 2, 128);
    ctx.restore();
  }

  function destroy(G) {
    const R3 = G.r3; if (!R3) return;
    const geo = R3.geo;
    R3.scene.traverse(o => { if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== geo) o.geometry.dispose(); });
    geo.dispose();
    Arcade3D.detach();
    G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }

  function draw2D(G, ctx, W, H, api) {
    const n = G.layers.length, h = G.hue0 + n * 7;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `hsl(${h + 30},45%,24%)`); bg.addColorStop(1, `hsl(${h},40%,9%)`);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    /* partículas de ambiente */
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 18; i++) { const x = (i * 97 + api.t * 8 * (1 + i % 3)) % W, y = (i * 173 + G.cam * .3) % H; ctx.beginPath(); ctx.arc(x, y, 1 + i % 3, 0, 6.3); ctx.fill(); }

    /* pedestal */
    const b0 = G.layers[0];
    block(ctx, G, api, b0, -420, LH);
    const from = Math.max(1, Math.floor((G.cam - api.H / G.k) / LH) - 2);
    for (let i = from; i < n; i++) block(ctx, G, api, G.layers[i], i * LH, (i + 1) * LH);
    G.falling.forEach(f => block(ctx, G, api, f, f.y, f.y + LH, f.a));
    if (G.mv) block(ctx, G, api, G.mv, n * LH, (n + 1) * LH);
    /* ondas do "perfeito" */
    G.ripples.forEach(r => {
      const g = 1 + r.t * .9, x0 = r.x - r.w / 2 * g, x1 = r.x + r.w / 2 * g, z0 = r.z - r.d / 2 * g, z1 = r.z + r.d / 2 * g;
      const pts = [proj(G, api, x0, r.y, z0), proj(G, api, x1, r.y, z0), proj(G, api, x1, r.y, z1), proj(G, api, x0, r.y, z1)];
      ctx.strokeStyle = `rgba(255,255,255,${.8 * (1 - r.t / .6)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
    });
    /* contador grande no topo */
    ctx.save(); ctx.textAlign = 'center'; ctx.font = "800 64px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(G.score, W / 2, 128);
    ctx.restore();
  }

  return ArcadeKit.create({
    id: 'stack', title: 'Torre', icon: '🏗️',
    accent: '#2dd4bf', accent2: '#a78bfa', bg: '#0c1320', transparent: true, destroy,
    tagline: 'Empilha blocos o mais alto que conseguires. O que ficar de fora é cortado.',
    view: { w: 400 },
    how: [
      'Toca, clica ou carrega em <b>Espaço</b> para largar o bloco que desliza.',
      'A parte que não ficar em cima do bloco de baixo é cortada — a torre vai estreitando.',
      'Encaixa ao milímetro para um <b>Perfeito</b>: três seguidos e o bloco volta a crescer.',
    ],
    controls: ['🖱️ Clique', '👆 Toque', '⌨️ Espaço'],
    ready: { title: 'Toca para largar', hint: 'Larga cada bloco quando estiver alinhado com o de baixo.' },
    setup, draw,
    update, after: idleOver,
    down: (G, x, y, api) => place(G, api),
    key: (G, e, api) => { if (e.key === ' ' || e.key === 'Enter') { place(G, api); return true; } },
    hud: G => [['Blocos', G.score], ['Série', G.combo ? '×' + G.combo : '—', G.combo >= 3 ? 'hot' : '']],
    achievements: [
      { id: 'st.30',  name: 'Arquiteto',    icon: '🏗️', desc: 'Empilha 30 blocos na Torre.', test: c => (c.result.score || 0) >= 30 },
      { id: 'st.60',  name: 'Arranha-Céus', icon: '🏙️', desc: 'Empilha 60 blocos na Torre.', test: c => (c.result.score || 0) >= 60 },
      { id: 'st.p10', name: 'Nível de Bolha', icon: '📐', desc: '10 perfeitos numa só torre.', test: c => ((c.result.meta || {}).perfects || 0) >= 10 },
    ],
  });
})();
