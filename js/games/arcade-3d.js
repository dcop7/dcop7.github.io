/* ══════════════════════════════════════════════════════════════════
   Arcade3D — peças comuns para os jogos arcade desenhados em three.js
   (out/2026). O Buraco Guloso tem o seu próprio motor; isto é a versão
   pequena para os outros: carregar o three.js a pedido, um renderer
   WebGL único partilhado (os browsers limitam contextos WebGL), encaixar
   no palco do ArcadeKit por baixo do canvas 2D (que fica para HUD,
   partículas e textos) e redimensionar com a nitidez certa.

   Uso num jogo do kit (spec.transparent = true):
     Arcade3D.load().then(() => { const r = Arcade3D.attach(api.stage); … })
     no draw: Arcade3D.fit(api.stage, cam); r.render(scene, cam)
     no destroy: Arcade3D.detach()
══════════════════════════════════════════════════════════════════ */
const Arcade3D = (function () {
  'use strict';
  const SRC = 'js/vendor/three.min.js';
  let _p = null, R = null;

  function load() {
    if (window.THREE) return Promise.resolve();
    if (_p) return _p;
    return (_p = new Promise((res, rej) => {
      const ex = document.querySelector(`script[src="${SRC}"]`);
      if (ex) { if (window.THREE) return res(); ex.addEventListener('load', res); ex.addEventListener('error', rej); return; }
      const s = Object.assign(document.createElement('script'), { src: SRC });
      s.onload = res; s.onerror = () => { _p = null; rej(new Error('three.js')); };
      document.head.appendChild(s);
    }));
  }

  const coarse = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  function renderer() {
    if (R) return R;
    R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    R.setClearColor(0x000000, 0);                 /* fundo transparente: o gradiente é CSS no palco */
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.08;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.domElement.className = 'ak3d';
    R.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none';
    return R;
  }

  /* põe o canvas WebGL no palco, por baixo do canvas 2D do kit */
  function attach(stage) {
    const r = renderer();
    stage.insertBefore(r.domElement, stage.firstChild);
    const cv2d = stage.querySelector('.ak-cv'); if (cv2d) { cv2d.style.position = 'absolute'; cv2d.style.zIndex = '1'; }
    r._w = r._h = 0;
    return r;
  }

  /* acerta tamanho/nitidez ao palco; devolve o aspeto (largura/altura) */
  function fit(stage, cam) {
    const r = R; if (!r) return 1;
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1, dpr = Math.min(window.devicePixelRatio || 1, coarse() ? 1.75 : 2);
    if (w !== r._w || h !== r._h || dpr !== r._d) {
      r._w = w; r._h = h; r._d = dpr;
      r.setPixelRatio(dpr); r.setSize(w, h, false);
      if (cam && cam.isPerspectiveCamera) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    }
    return w / h;
  }

  function detach() {
    if (!R) return;
    R.renderLists.dispose();
    R.domElement.remove();
  }

  /* liberta geometrias/materiais/texturas de uma cena */
  function disposeScene(scene) {
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { ['map', 'emissiveMap', 'alphaMap'].forEach(k => m[k] && m[k].dispose()); m.dispose(); });
    });
  }

  /* ponto do mundo → coordenadas lógicas do kit (0..W, 0..H) */
  const _v = { x: 0, y: 0 };
  function toScreen(cam, x, y, z, W, H) {
    const v = new THREE.Vector3(x, y, z).project(cam);
    _v.x = (v.x + 1) / 2 * W; _v.y = (1 - v.y) / 2 * H;
    return _v;
  }

  /* ── mapa de ambiente de "estúdio" (reflexos nos metais e vernizes) ──
     Sem isto, materiais metálicos ficam quase pretos. Uma esfera com um
     gradiente discreto e três "softboxes" claras, pré-filtrada com PMREM
     (do núcleo do three.js) — gerada uma vez e partilhada. */
  const _envs = new WeakMap();
  /* r: um renderer próprio (ex.: Xadrez, General); por defeito o partilhado */
  function env(r) {
    r = r || R; if (!r) return null;
    if (_envs.has(r)) return _envs.get(r);
    const s = new THREE.Scene();
    const g = new THREE.SphereGeometry(50, 32, 16), col = [], c = new THREE.Color(), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50; c.setRGB(.16 + Math.max(0, y) * .32, .17 + Math.max(0, y) * .34, .2 + Math.max(0, y) * .38); if (y < 0) c.multiplyScalar(.55 + y * .35); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    [[0, 40, 0, 40, 40], [34, 18, 20, 18, 26], [-30, 14, -24, 14, 20]].forEach(([x, y, z, w, h]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); });
    const pm = new THREE.PMREMGenerator(r);
    const tex = pm.fromScene(s, .04).texture; pm.dispose(); _envs.set(r, tex);
    s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return tex;
  }

  /* ── cena "de estúdio": céu/chão (hemisfério) + sol com sombras suaves ── */
  function stdScene(o = {}) {
    const scene = new THREE.Scene();
    if (o.env !== false) scene.environment = env();
    const hemi = new THREE.HemisphereLight(o.sky || '#eef4ff', o.ground || '#3b3f58', o.hemi != null ? o.hemi : 1.3);
    const sun = new THREE.DirectionalLight(o.sun || '#fff4e6', o.sunI != null ? o.sunI : 2.2);
    if (o.shadow !== false) {
      sun.castShadow = true;
      const sm = coarse() ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
      sun.shadow.bias = -.0005; sun.shadow.normalBias = o.normalBias != null ? o.normalBias : .6;
    }
    scene.add(hemi, sun, sun.target);
    if (o.fill !== false) { const f = new THREE.DirectionalLight(o.fillC || '#b4c6ff', o.fillI != null ? o.fillI : .5); f.position.set(-300, 150, 260); scene.add(f); }
    return { scene, sun, hemi };
  }
  /* o sol (e a caixa da sombra) segue um ponto de interesse */
  function sunAt(sun, x, y, z, ext, dir) {
    const d = dir || [-.35, 1, .5];
    sun.position.set(x + d[0] * ext * 2, y + d[1] * ext * 2, z + d[2] * ext * 2); sun.target.position.set(x, y, z);
    const c = sun.shadow.camera; c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 1; c.far = ext * 6; c.updateProjectionMatrix();
  }

  /* ── caixa unitária de arestas arredondadas (luz a correr nas arestas) ── */
  const _rb = {};
  function roundBox(r) {
    r = r || .08; if (_rb[r]) return _rb[r];
    const s = new THREE.Shape(), h = .5, q = Math.min(r, .45);
    s.moveTo(-h + q, -h); s.lineTo(h - q, -h); s.quadraticCurveTo(h, -h, h, -h + q); s.lineTo(h, h - q);
    s.quadraticCurveTo(h, h, h - q, h); s.lineTo(-h + q, h); s.quadraticCurveTo(-h, h, -h, h - q); s.lineTo(-h, -h + q); s.quadraticCurveTo(-h, -h, -h + q, -h);
    const b = q * .6;
    const g = new THREE.ExtrudeGeometry(s, { depth: 1 - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: 0, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, -.5 + b, 0); g.computeVertexNormals();
    g.userData.shared = true;
    return (_rb[r] = g);
  }

  /* ── materiais partilhados por chave ── */
  const _mats = new Map();
  function mat(key, make) {
    let m = _mats.get(key);
    if (!m) { m = make ? make() : new THREE.MeshStandardMaterial({ color: key, roughness: .5, metalness: .05 }); m.userData.shared = true; _mats.set(key, m); }
    return m;
  }
  const std = (color, o) => mat('std:' + color + ':' + JSON.stringify(o || {}), () => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .5, metalness: .05 }, o || {})));
  const glowMat = color => mat('glow:' + color, () => new THREE.MeshBasicMaterial({ color, toneMapped: false }));

  /* ── textura de brilho radial (sprites aditivos: luzes, faíscas, halos) ── */
  let _glow = null;
  function glowTex() {
    if (_glow) return _glow;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace;
    return _glow;
  }
  const glowSprite = color => mat('gsp:' + color, () => new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));

  /* ── textura com um emoji/texto (ícones de power-ups, rótulos) ── */
  const _emo = new Map();
  function emojiTex(ch, px) {
    const k = ch + ':' + (px || 96); if (_emo.has(k)) return _emo.get(k);
    const s = px || 96, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${Math.round(s * .78)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    x.fillText(ch, s / 2, s / 2 + s * .04);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _emo.set(k, t); return t;
  }

  /* ── "pool" de meshes para desenhar em modo imediato (como no canvas 2D):
       begin() → get(chave, fábrica) por objeto → end() esconde os que sobraram ── */
  function pool(scene) {
    const groups = new Map();
    return {
      begin() { groups.forEach(g => { g.used = 0; }); },
      get(key, make) {
        let g = groups.get(key); if (!g) groups.set(key, g = { list: [], used: 0 });
        let m = g.list[g.used];
        if (!m) { m = make(); scene.add(m); g.list.push(m); }
        m.visible = true; g.used++;
        return m;
      },
      end() { groups.forEach(g => { for (let i = g.used; i < g.list.length; i++) g.list[i].visible = false; }); },
    };
  }

  /* liberta tudo o que não é partilhado (geometrias/materiais em cache ficam) */
  function disposeOwn(scene) {
    scene.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { if (!m.userData.shared) m.dispose(); });
    });
  }

  /* ── carro partilhado (Drift, Faixa Rápida, …) ──
     Carroçaria = perfil lateral extrudido (com as cavas das rodas recortadas e arestas boleadas),
     habitáculo de vidro com painéis laterais com janelas recortadas (pilares A/B/C), tejadilho,
     rodas com pneu + jante de 5 raios + cubo, faróis/farolins, grelha, para-choques, matrículas,
     espelhos e puxadores. Tipos: sport, sedan, hatch, suv, van, taxi, police.
     Construído com comprimento 1 e frente para +x; opts.len escala, opts.forward '-z' roda a frente.
     userData: wheels (rodar: rotation.z), front (virar: rotation.y), chassis (inclinar), body (material),
     siren (polícia: [vermelho, azul]) */
  const CAR_T = {
    sport: { w: .44, r: .074, wx: [.33, -.32], bot: .045, nose: .115, hood: .165, belt: .195, tail: .205, cab: [-.3, -.11, .03, .17], roof: .285 },
    sedan: { w: .42, r: .074, wx: [.32, -.31], bot: .05, nose: .13, hood: .19, belt: .215, tail: .22, cab: [-.25, -.15, .07, .19], roof: .33 },
    hatch: { w: .43, r: .076, wx: [.31, -.31], bot: .05, nose: .13, hood: .19, belt: .22, tail: .23, cab: [-.43, -.38, .07, .19], roof: .34 },
    suv: { w: .44, r: .09, wx: [.31, -.31], bot: .075, nose: .19, hood: .26, belt: .29, tail: .3, cab: [-.45, -.43, .11, .22], roof: .44 },
    van: { w: .42, r: .08, wx: [.32, -.32], bot: .065, nose: .2, hood: .27, belt: .3, tail: .3, cab: [-.47, -.465, .26, .37], roof: .53 },
  };
  CAR_T.taxi = CAR_T.sedan; CAR_T.police = CAR_T.sedan;
  const _carTex = {};
  function carTex(key, draw, w, h) {
    if (_carTex[key]) return _carTex[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (_carTex[key] = t);
  }
  function car(o) {
    o = o || {};
    const type = o.type || 'sedan', T = CAR_T[type] || CAR_T.sedan, W = o.wid || T.w;
    const color = o.color || (type === 'taxi' ? '#facc15' : type === 'police' ? '#f8fafc' : '#dc2626');
    const outer = new THREE.Group(), root = new THREE.Group(); outer.add(root);
    if (o.forward === '-z') root.rotation.y = Math.PI / 2;
    const chassis = new THREE.Group(); root.add(chassis);
    const paint = mat('carpaint:' + color + (o.matte ? 'm' : ''), () => new THREE.MeshPhysicalMaterial({ color, metalness: o.matte ? .1 : .45, roughness: o.matte ? .6 : .32, clearcoat: o.matte ? 0 : 1, clearcoatRoughness: .08 }));
    const glass = mat('carglass', () => new THREE.MeshPhysicalMaterial({ color: '#0b1424', metalness: .6, roughness: .06, clearcoat: 1 }));
    const plastic = std('#16181d', { roughness: .7 }), chrome = std('#e5e7eb', { metalness: .95, roughness: .18 });
    const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };
    const extr = (pts, depth, bevel, holes) => {
      const s = new THREE.Shape(); pts.forEach((p, i) => (p.arc ? s.absarc(p.arc[0], p.arc[1], p.arc[2], Math.PI, 0, true) : p.q ? s.quadraticCurveTo(p.q[0], p.q[1], p.q[2], p.q[3]) : i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
      (holes || []).forEach(h => { const pa = new THREE.Path(); h.forEach((p, i) => (i ? pa.lineTo(p[0], p[1]) : pa.moveTo(p[0], p[1]))); s.holes.push(pa); });
      const b = bevel || 0, g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, depth - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * .8, bevelSegments: 3, curveSegments: 14 });
      g.translate(0, 0, -depth / 2 + b); return g;
    };
    /* carroçaria (abaixo da linha de cintura) com cavas */
    const ar = T.r * 1.18, [fx, rx] = T.wx, [c0, c1, c2, c3] = T.cab;
    const body = [[-.49, T.bot + .012], { arc: [rx, T.r, ar] }, { arc: [fx, T.r, ar] }, [.48, T.bot + .012], { q: [.502, T.bot + .016, .5, T.bot + .04] }, [.5, T.nose - .02], { q: [.5, T.nose + .012, .465, T.hood - .012] }, { q: [(.465 + c3) / 2 + .05, T.hood + .01, c3 + .03, T.hood] }, [c3, T.belt], [c0, T.belt], { q: [-.43, T.tail + .012, -.475, T.tail - .008] }, { q: [-.502, T.tail - .02, -.5, T.tail - .05] }, [-.5, T.bot + .04], { q: [-.502, T.bot + .016, -.49, T.bot + .012] }];
    chassis.add(sh(new THREE.Mesh(extr(body, W, .02), paint)));
    /* habitáculo: vidro + painéis laterais com janelas + tejadilho */
    const cab = [[c0, T.belt - .01], [c1, T.roof], [c2, T.roof], [c3, T.belt - .01]];
    const gm = new THREE.Mesh(extr(cab, W * .84, .012), glass); chassis.add(gm);
    const xAt = (xa, xb, y) => xa + (xb - xa) * (y - T.belt) / (T.roof - T.belt);
    const y0 = T.belt + .012, y1 = T.roof - .016, mid = type === 'van' ? (c1 + c2) / 2 : (c1 + c2) / 2 - .01;
    const holes = [
      [[xAt(c0, c1, y0) + .025, y0], [xAt(c0, c1, y1) + .02, y1], [mid - .015, y1], [mid - .015, y0]],
      [[mid + .015, y0], [mid + .015, y1], [xAt(c3, c2, y1) - .02, y1], [xAt(c3, c2, y0) - .025, y0]],
    ];
    [-1, 1].forEach(sd => { const p = new THREE.Mesh(extr(cab, .012, 0, holes), paint); p.position.z = sd * W * .425; chassis.add(p); });
    const roofM = sh(new THREE.Mesh(extr([[c1 - .01, T.roof - .018], [c1 + .005, T.roof + .006], [c2 - .005, T.roof + .006], [c2 + .01, T.roof - .018]], W * .86, .008), paint)); chassis.add(roofM);
    /* frente e traseira */
    const box = (m, x, y, z, sx, sy, sz, p) => { const b = new THREE.Mesh(roundBox(.25), m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); (p || chassis).add(b); return b; };
    box(plastic, .512, T.bot + .03, 0, .02, .05, W * .96);                        /* para-choques */
    box(plastic, -.512, T.bot + .03, 0, .02, .05, W * .96);
    box(plastic, .514, (T.nose + T.bot) / 2 + .018, 0, .01, .034, W * .38);         /* grelha */
    const hl = glowMat(o.night ? '#fffbe6' : '#f8fafc'), tl = glowMat('#ef1d3a');
    [-1, 1].forEach(sd => {
      box(hl, .516, T.nose - .022, sd * W * .31, .01, .026, W * .19);
      box(chrome, .514, T.nose - .022, sd * W * .31, .01, .034, W * .22);
      box(tl, -.517, T.tail - .06, sd * W * .32, .01, .028, W * .22);
      /* espelhos */
      box(paint, c3 - .02, T.belt + .03, sd * (W / 2 + .018), .035, .022, .03);
      /* puxadores */
      box(chrome, mid + .05, T.belt - .02, sd * (W / 2 + .002), .028, .006, .004);
      box(chrome, mid - .09, T.belt - .02, sd * (W / 2 + .002), .028, .006, .004);
    });
    const plateT = carTex('plate', (x, w, h) => { x.fillStyle = '#f8fafc'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d4ed8'; x.fillRect(0, 0, w * .12, h); x.fillStyle = '#111'; x.font = `bold ${h * .7}px monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DU-26', w * .56, h * .54); }, 128, 32);
    const plate = new THREE.MeshBasicMaterial({ map: plateT });
    [[.523, 1], [-.523, -1]].forEach(([x, sd]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(W * .3, .028), plate); p.position.set(x, T.bot + .045, 0); p.rotation.y = sd * Math.PI / 2; chassis.add(p); });
    /* extras por tipo */
    if (type === 'sport') {
      [-1, 1].forEach(sd => box(plastic, -.44, T.tail + .02, sd * W * .3, .02, .04, .012));
      box(plastic, -.45, T.tail + .045, 0, .06, .01, W * .9);
    }
    if (type === 'suv') [-1, 1].forEach(sd => box(chrome, (c1 + c2) / 2, T.roof + .02, sd * W * .36, (c2 - c1) * .9, .01, .012));
    if (type === 'taxi') {
      const sT = carTex('taxi', (x, w, h) => { x.fillStyle = '#facc15'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = `900 ${h * .62}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TAXI', w / 2, h * .55); }, 128, 40);
      const s = new THREE.Mesh(new THREE.BoxGeometry(.09, .035, W * .4), [std('#facc15'), std('#facc15'), std('#facc15'), std('#facc15'), new THREE.MeshBasicMaterial({ map: sT }), new THREE.MeshBasicMaterial({ map: sT })]);
      s.position.set((c1 + c2) / 2, T.roof + .022, 0); s.rotation.y = Math.PI / 2; chassis.add(s);
      [-1, 1].forEach(sd => box(std('#111'), (c0 + c3) / 2, T.belt - .045, sd * (W / 2 + .001), .5, .012, .003));
    }
    if (type === 'police') {
      [-1, 1].forEach(sd => box(std('#1e3a8a'), 0, (T.bot + T.belt) / 2, sd * (W / 2 + .002), .62, .05, .004));
      box(plastic, (c1 + c2) / 2, T.roof + .015, 0, .06, .02, W * .62);
      const red = new THREE.Mesh(roundBox(.25), glowMat('#ef4444')), blue = new THREE.Mesh(roundBox(.25), glowMat('#3b82f6'));
      [[red, 1], [blue, -1]].forEach(([m, sd]) => { m.position.set((c1 + c2) / 2, T.roof + .032, sd * W * .17); m.scale.set(.05, .02, W * .26); chassis.add(m); });
      outer.userData.siren = [red, blue];
    }
    /* rodas */
    const tireG = new THREE.CylinderGeometry(T.r, T.r, .06, 22); tireG.rotateX(Math.PI / 2);
    const rimG = new THREE.CylinderGeometry(T.r * .64, T.r * .64, .062, 18); rimG.rotateX(Math.PI / 2);
    const tire = std('#14151a', { roughness: .85 }), rimM = o.rim ? std(o.rim, { metalness: .9, roughness: .25 }) : chrome, dark = std('#3a3d45', { metalness: .6, roughness: .4 });
    const wheels = [], front = [];
    [[fx, 1], [fx, -1], [rx, 1], [rx, -1]].forEach(([x, sd], i) => {
      const steer = new THREE.Group(); steer.position.set(x, T.r, sd * (W / 2 - .022)); root.add(steer);
      const wheel = new THREE.Group(); steer.add(wheel);
      wheel.add(sh(new THREE.Mesh(tireG, tire)));
      const rim = new THREE.Mesh(rimG, dark); wheel.add(rim);
      for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(T.r * .58, T.r * .13, .01), rimM); sp.position.z = sd * .032; sp.rotation.z = k / 5 * Math.PI * 2; sp.geometry.translate(T.r * .29, 0, 0); wheel.add(sp); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(T.r * .16, T.r * .16, .066, 10), rimM); hub.rotation.x = Math.PI / 2; wheel.add(hub);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(T.r * .62, T.r * .05, 6, 20), rimM); ring.position.z = sd * .031; wheel.add(ring);
      wheels.push(wheel); if (i < 2) front.push(steer);
    });
    /* sombra de contacto (mancha escura por baixo) */
    if (o.blob !== false) {
      const bl = new THREE.Mesh(new THREE.PlaneGeometry(1.08, W * 1.25), new THREE.MeshBasicMaterial({ map: glowTex(), color: '#000', transparent: true, opacity: .45, depthWrite: false }));
      bl.rotation.x = -Math.PI / 2; bl.position.y = .004; root.add(bl);
    }
    outer.userData.wheels = wheels; outer.userData.front = front; outer.userData.chassis = chassis; outer.userData.paint = paint; outer.userData.r = T.r;
    outer.scale.setScalar(o.len || 1);
    return outer;
  }

  return { load, attach, fit, detach, disposeScene, disposeOwn, toScreen, coarse,
    stdScene, sunAt, roundBox, env, mat, std, glowMat, glowTex, glowSprite, emojiTex, pool, car, CAR_T };
})();
