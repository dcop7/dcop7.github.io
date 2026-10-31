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
    warmRender(R);
    R.domElement.className = 'ak3d';
    R.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none';
    return R;
  }

  /* Aquecimento de shaders. Na primeira vez que uma cena é desenhada, o three.js
     compila todos os materiais de uma vez e a página congela (0,3–1,5 s medidos
     nos jogos). Aqui essa primeira vez passa a ser compileAsync: os shaders
     compilam em paralelo (KHR_parallel_shader_compile) e, enquanto não estão
     prontos, render() dessa cena não desenha nada — o resto do jogo continua a
     correr. O alvo conta (ecrã ≠ render target muda o shader), por isso há um
     estado para cada. compile() percorre também os objetos invisíveis: efeitos
     criados escondidos à partida ficam logo prontos. */
  function warmRender(r) {
    const draw = r.render.bind(r);
    r.render = (scene, cam) => {
      const w = scene.userData[warmKey()];
      if (w === 1) return draw(scene, cam);
      if (!w) warm(scene, cam);
    };
  }
  /* um alvo marcado como XR usa os shaders do ecrã (r160) — conta como ecrã */
  const warmKey = () => { const t = R.getRenderTarget(); return t && !t.isXRRenderTarget ? '_warmT' : '_warmS'; };
  /* compila sem bloquear para o alvo atual; a promessa resolve com os shaders prontos */
  function warm(scene, cam) {
    const k = warmKey(), u = scene.userData;
    if (u[k] === 1) return Promise.resolve();
    if (u[k + 'P']) return u[k + 'P'];
    u[k] = 2;
    const done = () => { u[k] = 1; u[k + 'P'] = null; };
    return (u[k + 'P'] = compileAsync(scene, cam).then(done));
  }
  /* o compileAsync do r160 rebenta (e nunca resolve) se um material for libertado
     enquanto compila; esta versão ignora-os e desiste ao fim de 8 s */
  function compileAsync(scene, cam) {
    let mats;
    try { mats = R.compile(scene, cam); } catch (e) { console.warn('[3d] compile', e); return Promise.resolve(); }
    const par = !!R.extensions.get('KHR_parallel_shader_compile'), t0 = performance.now();
    return new Promise(res => {
      const tick = () => {
        for (const m of mats) { const p = R.properties.get(m).currentProgram; if (!p || p.isReady()) mats.delete(m); }
        if (!mats.size || performance.now() - t0 > 8000) res(); else setTimeout(tick, 10);
      };
      if (par) tick(); else setTimeout(tick, 10);
    });
  }
  /* Objetos criados a meio do jogo (moedas, ondas de choque, inimigos novos):
     se trazem um shader que ainda não existe, compila-se em paralelo e o objeto
     fica escondido até estar pronto (~0,1 s, só na primeira vez) em vez de
     parar o jogo. Se o shader já existe, aparece logo. */
  let _wcam = null;
  function coldCheck(obj, scene) {
    if (!R || !R.properties) return;
    if (!_wcam) _wcam = new THREE.Camera();
    let mats;
    try { mats = R.compile(obj, _wcam, scene); } catch (e) { return; }
    const pending = () => { for (const m of mats) { const p = R.properties.get(m).currentProgram; if (!p || p.isReady()) mats.delete(m); } return mats.size > 0; };
    if (!pending()) return;
    obj.userData._cold = true; const t0 = performance.now();
    const tick = () => { if (pending() && performance.now() - t0 < 4000) setTimeout(tick, 10); else obj.userData._cold = false; };
    setTimeout(tick, 10);
  }

  /* true quando a cena já foi aquecida para o ecrã (os jogos podem esperar por isto) */
  const warmed = scene => scene.userData._warmS === 1;

  /* põe o canvas WebGL no palco, por baixo do canvas 2D do kit */
  function attach(stage) {
    const r = renderer();
    stage.insertBefore(r.domElement, stage.firstChild);
    r.setRenderTarget(null); r.clear();          /* não mostrar o último frame do jogo anterior enquanto este aquece */
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
      r.setPixelRatio(dpr); r.setSize(w, h, false); outlineRes(w * dpr, h * dpr);
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
        if (!m) { m = make(); scene.add(m); g.list.push(m); coldCheck(m, scene); }
        m.visible = !m.userData._cold; g.used++;
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
    /* pormenores: frisos das portas, embaladeiras, entrada de ar e faróis de nevoeiro, escape, antena */
    const seam = std('#0b0d12', { roughness: .6 });
    [-1, 1].forEach(sd => {
      const zs = sd * (W / 2 + .0015);
      box(seam, mid + .005, (T.bot + T.belt) / 2 + .01, zs, .004, (T.belt - T.bot) * .78, .002);                 /* entre portas */
      if (type !== 'van') box(seam, c3 + .015, (T.bot + T.belt) / 2 + .02, zs, .004, (T.belt - T.bot) * .6, .002);  /* frente da porta da frente */
      box(seam, c0 - .01, (T.bot + T.belt) / 2 + .02, zs, .004, (T.belt - T.bot) * .6, .002);                   /* trás da porta de trás */
      box(plastic, (fx + rx) / 2, T.bot + .012, sd * (W / 2 - .004), (fx - rx) - ar * 2.1, .022, .012);          /* embaladeira */
      box(chrome, (c0 + c3) / 2, T.belt + .004, sd * (W / 2 - .003), (c3 - c0) * .96, .005, .006);             /* friso cromado da janela */
      box(glowMat('#fff7d6'), .514, T.bot + .028, sd * W * .36, .006, .014, .05);                                  /* nevoeiro */
    });
    box(seam, .513, T.bot + .03, 0, .006, .03, W * .5);                                                          /* entrada de ar */
    box(chrome, -.51, T.bot + .02, -W * .26, .03, .016, .03); if (type === 'sport') box(chrome, -.51, T.bot + .02, W * .26, .03, .016, .03);   /* escape */
    if (type !== 'police' && type !== 'taxi') { const fin = new THREE.Mesh(new THREE.ConeGeometry(.014, .03, 4), seam); fin.scale.set(1.6, 1, .5); fin.position.set(c1 + .02, T.roof + .018, 0); fin.rotation.z = .6; chassis.add(fin); }
    /* piscas (âmbar) nos 4 cantos e brilho dos farolins/faróis (para travar, piscar e circular de noite) */
    const amber = glowMat('#ffb020'), blinkL = [], blinkR = [];
    [[.5, 1], [-.5, 1], [.5, -1], [-.5, -1]].forEach(([x, sd]) => { const b = box(amber, x + Math.sign(x) * .012, x > 0 ? T.nose - .022 : T.tail - .06, sd * W * .47, .012, .022, W * .07); b.visible = false; (sd > 0 ? blinkL : blinkR).push(b); });
    const spr = (col, x, y, z, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); m.position.set(x, y, z); m.scale.set(s, s, 1); chassis.add(m); return m; };
    const tailGlow = [-1, 1].map(sd => spr('#ff2040', -.54, T.tail - .06, sd * W * .32, .12));
    const headGlow = [-1, 1].map(sd => spr('#fff4d0', .54, T.nose - .022, sd * W * .31, .1));
    const blinkGlow = [[.53, 1], [-.53, 1], [.53, -1], [-.53, -1]].map(([x, sd]) => { const s2 = spr('#ffb020', x, x > 0 ? T.nose - .022 : T.tail - .06, sd * W * .47, .16); s2.visible = false; (sd > 0 ? blinkL : blinkR).push(s2); return s2; });
    outer.userData.blinkL = blinkL; outer.userData.blinkR = blinkR; outer.userData.tailGlow = tailGlow; outer.userData.headGlow = headGlow;
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
    /* junta as peças fixas por material (de ~80 malhas para ~25): muitos carros no ecrã sem pesar */
    if (o.merge !== false) {
      const keep = new Set([...blinkL, ...blinkR, ...(outer.userData.siren || [])]);
      mergeStatic(chassis, keep); wheels.forEach(w => mergeStatic(w, keep));
    }
    outer.scale.setScalar(o.len || 1);
    return outer;
  }

  /* junta as malhas descendentes de `parent` que partilham material numa só (coordenadas relativas ao parent);
     ignora sprites, malhas com vários materiais e as que estão em `keep` */
  function mergeStatic(parent, keep) {
    parent.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert(), byMat = new Map(), victims = [];
    parent.traverse(m => {
      if (m === parent || !m.isMesh || Array.isArray(m.material) || (keep && keep.has(m))) return;
      const g = m.geometry; if (!g.attributes.normal || !g.attributes.uv) return;
      const rel = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      (byMat.get(m.material) || byMat.set(m.material, []).get(m.material)).push([g, rel, m.castShadow]);
      victims.push(m);
    });
    byMat.forEach((list, mat) => {
      if (list.length < 2) return;
      let n = 0; const gs = list.map(([g, rel]) => { const c = g.index ? g.toNonIndexed() : g.clone(); c.applyMatrix4(rel); n += c.attributes.position.count; return c; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o3 = 0, o2 = 0;
      gs.forEach(c => { pos.set(c.attributes.position.array, o3); nor.set(c.attributes.normal.array, o3); uv.set(c.attributes.uv.array, o2); o3 += c.attributes.position.count * 3; o2 += c.attributes.position.count * 2; c.dispose(); });
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const mm = new THREE.Mesh(out, mat); mm.castShadow = list.some(l => l[2]); mm.receiveShadow = true; parent.add(mm);
      victims.forEach(v => { if (v.material === mat) { v.parent.remove(v); if (!v.geometry.userData.shared) v.geometry.dispose(); } });
    });
  }

  /* ════════════════════════════════════════════════════════════════
     texturas sem padrão repetido e água (partilhado por todos os jogos 3D)
  ════════════════════════════════════════════════════════════════ */
  /* ruído de valor barato em GLSL (sem texturas) */
  const GLSL_NOISE = `
    float a3h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float a3n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(a3h(i), a3h(i + vec2(1., 0.)), f.x), mix(a3h(i + vec2(0., 1.)), a3h(i + vec2(1., 1.)), f.x), f.y); }`;

  /* tira o "papel de parede" a uma textura repetida (relva, terra, areia, betão…): cada zona usa um
     pedaço deslocado da textura (técnica "texture no-tile" do Inigo Quilez, com mistura suave entre zonas),
     uma segunda amostra larga e rodada quebra a repetição de longe e um ruído lento varia o tom.
     o: { macro (0..1 variação de tom), wide (peso da amostra larga), cells (tamanho das zonas, em repetições) } */
  function noTile(mat, o = {}) {
    if (mat._a3nt) return mat;   /* (propriedade fora do userData: o clone() não a copia, tal como não copia o onBeforeCompile) */
    mat._a3nt = o;
    const macro = (o.macro != null ? o.macro : .22).toFixed(3), wide = (o.wide != null ? o.wide : .4).toFixed(3), cells = (1 / (o.cells || 3.5)).toFixed(4);
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', GLSL_NOISE + `
    vec4 a3NoTile(sampler2D s, vec2 uv){
      vec2 dx = dFdx(uv), dy = dFdy(uv);
      float k = (a3n(uv * ${cells}) * .7 + a3n(uv * ${cells} * 2.3 + 7.1) * .3) * 7.;
      float ia = floor(k), f = fract(k);
      vec2 oa = sin(vec2(3., 7.) * ia), ob = sin(vec2(3., 7.) * (ia + 1.));
      vec4 ca = textureGrad(s, uv + oa, dx, dy), cb = textureGrad(s, uv + ob, dx, dy);
      vec4 c = mix(ca, cb, smoothstep(.2, .8, f - .1 * dot(ca.rgb - cb.rgb, vec3(1.))));
      mat2 R = mat2(.82, -.57, .57, .82);
      vec4 w = textureGrad(s, R * uv * .19 + .37, R * dx * .19, R * dy * .19);
      vec3 avg = textureLod(s, vec2(.5), 12.).rgb;
      c.rgb *= mix(vec3(1.), w.rgb / max(avg, vec3(.03)), ${wide});
      c.rgb *= 1. + (a3n(uv * .045) * .65 + a3n(uv * .13 + 3.3) * .35 - .5) * ${macro} * 2.;
      return c;
    }
    void main() {`).replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'a3NoTile( map, vMapUv )'));
    };
    const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null;
    mat.customProgramCacheKey = () => (key ? key() : '') + 'a3nt' + macro + wide + cells;
    mat.needsUpdate = true;
    return mat;
  }

  /* textura da ondulação: soma de ondas direcionais periódicas (espectro de mar com vento dominante e
     ondas cruzadas); RG = declive, B = altura. Gera-se uma vez e partilha-se. */
  let _wn = null;
  function waterWaves() {
    if (_wn) return _wn;
    const N = 256, h = new Float32Array(N * N), W = [];
    let s = 977; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let c = 0; c < 110; c++) {
      const crossW = c % 4 === 3, th = (crossW ? 1.9 : .35) + (r() - .5) * (crossW ? 2.4 : 2.1), km = 2 + Math.pow(r(), 1.4) * 38;
      const kx = Math.round(Math.cos(th) * km), ky = Math.round(Math.sin(th) * km); if (!kx && !ky) continue;
      const TAU = Math.PI * 2; W.push([kx * TAU / N, ky * TAU / N, Math.pow(Math.hypot(kx, ky), -1.45) * (crossW ? .35 : 1), r() * TAU]);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0; for (const [a, b, A, p] of W) v += A * Math.sin(a * i + b * j + p); h[j * N + i] = v; }
    /* cristas mais vivas e cavas largas (como o mar a sério) */
    let mx = 0; for (let k = 0; k < h.length; k++) mx = Math.max(mx, Math.abs(h[k]));
    for (let k = 0; k < h.length; k++) { const v = h[k] / mx; h[k] = v - .35 * v * v; }
    const sx = new Float32Array(N * N), sz = new Float32Array(N * N); let rms = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i; sx[k] = (h[j * N + (i + 1) % N] - h[j * N + (i + N - 1) % N]); sz[k] = (h[((j + 1) % N) * N + i] - h[((j + N - 1) % N) * N + i]); rms += sx[k] * sx[k] + sz[k] * sz[k];
    }
    rms = Math.sqrt(rms / (N * N * 2)); let hmin = 1e9, hmax = -1e9; for (let k = 0; k < h.length; k++) { hmin = Math.min(hmin, h[k]); hmax = Math.max(hmax, h[k]); }
    const d = new Uint8Array(N * N * 4), K = .13 / rms;
    for (let k = 0; k < N * N; k++) { d[k * 4] = Math.max(0, Math.min(255, (.5 + sx[k] * K) * 255)); d[k * 4 + 1] = Math.max(0, Math.min(255, (.5 + sz[k] * K) * 255)); d[k * 4 + 2] = (h[k] - hmin) / (hmax - hmin) * 255; d[k * 4 + 3] = 255; }
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
    t.userData.shared = true;
    return (_wn = t);
  }

  /* água a sério: ondulação sem repetição (4 escalas rodadas + rajadas de vento lentas), cor que passa de
     turquesa na areia a azul fundo, espuma a rebentar na margem e borda transparente — a linha da costa
     deixa de tremer (o "z-fighting" com a areia fica escondido por baixo da transição).
     o: { color, shallow, tile (comprimento de onda base em m), chop, env, opacity, roughness, clear (m até ficar
          fundo), foam (0..1), depth: { fn(x,z) altura do fundo, x, z, size, res } }
     A cada frame: Arcade3D.waterTick(material, tempo, câmara). */
  function water(o = {}) {
    const u = {
      uA3T: { value: 0 }, uA3Tile: { value: o.tile || 30 }, uA3Chop: { value: o.chop != null ? o.chop : 1 }, uA3WN: { value: waterWaves() },
      uA3Dep: { value: null }, uA3Box: { value: new THREE.Vector4(0, 0, 0, 0) }, uA3Sh: { value: new THREE.Color(o.shallow || '#3fb8b0') },
      uA3Foam: { value: o.foam != null ? o.foam : 1 }, uA3Near: { value: 1e-7 }, uA3Clear: { value: o.clear || 4 },
    };
    const mat = new THREE.MeshStandardMaterial({ color: o.color || '#1d5f7a', roughness: o.roughness != null ? o.roughness : .12, metalness: .02, envMap: o.env || null, envMapIntensity: o.envI || 1, transparent: true, opacity: o.opacity != null ? o.opacity : .94, depthWrite: true });
    mat._a3w = u;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vA3W;\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vA3W = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying vec3 vA3W;
    uniform float uA3T, uA3Tile, uA3Chop, uA3Foam, uA3Near, uA3Clear; uniform sampler2D uA3WN, uA3Dep; uniform vec4 uA3Box; uniform vec3 uA3Sh;
    ${GLSL_NOISE}
    void main() {`).replace('#include <color_fragment>', `#include <color_fragment>
      float a3D = length(vViewPosition), a3t = uA3T;
      vec2 a3P = vA3W.xz / uA3Tile;
      vec4 a3s1 = texture2D(uA3WN, a3P + a3t * vec2(.021, .013));
      vec4 a3s2 = texture2D(uA3WN, mat2(.974, -.225, .225, .974) * a3P * 1.618 + a3t * vec2(-.017, .026));
      vec4 a3s3 = texture2D(uA3WN, mat2(.956, .292, -.292, .956) * a3P * .382 + a3t * vec2(.008, -.006));
      vec4 a3s4 = texture2D(uA3WN, mat2(.988, .156, -.156, .988) * a3P * 3.7 + a3t * vec2(.04, .05));
      float a3g = a3n(vA3W.xz / (uA3Tile * 19.) + a3t * .012) * .65 + a3n(vA3W.xz / (uA3Tile * 5.3) - a3t * .02) * .35;
      float a3fine = 1. - smoothstep(uA3Tile * 6., uA3Tile * 50., a3D);
      vec2 a3sl = (a3s1.xy - .5) + (a3s2.xy - .5) * .8 + (a3s3.xy - .5) * 1.1 + (a3s4.xy - .5) * .6 * a3fine;
      float a3gr = abs(dot(normalize(vViewPosition), (viewMatrix * vec4(0., 1., 0., 0.)).xyz));
      a3sl *= .8 * uA3Chop * mix(.4, 1.4, a3g) * mix(1., .35, smoothstep(uA3Tile * 6., uA3Tile * 150., a3D)) * mix(.4, 1., smoothstep(.02, .45, a3gr));
      vec3 a3N = normalize((viewMatrix * vec4(normalize(vec3(-a3sl.x, 1., -a3sl.y)), 0.)).xyz);
      float a3crest = a3s1.b * .45 + a3s2.b * .35 + a3s3.b * .2;
      /* profundidade: altura da água menos a do fundo (se houver mapa do fundo) */
      float a3dep = 1e4;
      if (uA3Box.w > .5) { vec2 du = (vA3W.xz - uA3Box.xy) * uA3Box.z; if (du.x > 0. && du.y > 0. && du.x < 1. && du.y < 1.) a3dep = vA3W.y - texture2D(uA3Dep, du).r; }
      float a3dk = 1. - exp(-max(a3dep, 0.) / uA3Clear);
      diffuseColor.rgb = mix(uA3Sh, diffuseColor.rgb, a3dk);
      /* cristas um pouco mais claras (luz a atravessar a onda) */
      diffuseColor.rgb *= .9 + a3crest * .25;
      float a3fade = .3 + a3D * a3D * uA3Near;
      float a3band = max(.8, a3fade * 2.5);
      float a3fn = a3n(vA3W.xz * .32 + vec2(a3t * .25, 0.)) * .55 + a3n(vA3W.xz * 1.1 - a3t * .35) * .45;
      a3fn = mix(a3fn, .5, smoothstep(150., 2500., a3D));
      float a3foam = (1. - smoothstep(0., a3band, a3dep)) * smoothstep(.32, .78, a3fn + .4 * sin(a3dep / a3band * 9. - a3t * 1.8));
      a3foam += (1. - smoothstep(0., a3band * .35, a3dep)) * .6;
      a3foam = clamp(a3foam * uA3Foam, 0., 1.);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.9, .94, .95), a3foam);
      diffuseColor.a = max(diffuseColor.a * mix(.55, 1., a3dk), a3foam * .9) * smoothstep(0., a3fade, a3dep);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, .3, smoothstep(uA3Tile * 25., uA3Tile * 500., a3D));
      roughnessFactor = mix(roughnessFactor, .85, a3foam);`)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n      normal = a3N;');
    };
    mat.customProgramCacheKey = () => 'a3water';
    if (o.depth) waterDepth(mat, o.depth);
    return mat;
  }
  /* (re)gera o mapa do fundo: d = { fn(x,z), x, z (centro), size, res } */
  function waterDepth(mat, d) {
    const u = mat._a3w; if (!u) return;
    const N = d.res || 256, x0 = d.x - d.size / 2, z0 = d.z - d.size / 2, a = new Uint16Array(N * N), toH = THREE.DataUtils.toHalfFloat;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) a[j * N + i] = toH(d.fn(x0 + (i + .5) / N * d.size, z0 + (j + .5) / N * d.size));
    let t = u.uA3Dep.value;
    if (t && t.image.width === N) { t.image.data.set(a); t.needsUpdate = true; }
    else {
      if (t) t.dispose();
      t = new THREE.DataTexture(a, N, N, THREE.RedFormat, THREE.HalfFloatType);
      t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; u.uA3Dep.value = t;
    }
    u.uA3Box.value.set(x0, z0, 1 / d.size, 1);
  }
  function waterTick(mat, t, cam) {
    const u = mat && mat._a3w; if (!u) return;
    u.uA3T.value = t;
    /* erro do z-buffer cresce com d²/near: a borda transparente acompanha-o para a costa não tremer */
    if (cam) u.uA3Near.value = 5 / (cam.near * 16777216);
  }

  /* ── contorno ("inverted hull"): cópia das faces de trás empurrada X píxeis para fora no ecrã.
        Normais suavizadas por posição (senão as arestas vivas abrem buracos no contorno). ── */
  const OL_RES = { value: null };   /* THREE só existe depois do load() */
  const _olGeo = new WeakMap(), _olMat = new Map();
  function outlineGeo(g) {
    let o = _olGeo.get(g); if (o) return o;
    o = new THREE.BufferGeometry(); const p = g.attributes.position; o.setAttribute('position', p); if (g.index) o.setIndex(g.index);
    const n = new Float32Array(p.count * 3), acc = new Map(), key = i => `${Math.round(p.getX(i) * 500)},${Math.round(p.getY(i) * 500)},${Math.round(p.getZ(i) * 500)}`;
    const src = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const k = key(i); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]); if (src) { a[0] += src.getX(i); a[1] += src.getY(i); a[2] += src.getZ(i); } }
    for (let i = 0; i < p.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n[i * 3] = a[0] / l; n[i * 3 + 1] = a[1] / l; n[i * 3 + 2] = a[2] / l; }
    o.setAttribute('normal', new THREE.BufferAttribute(n, 3)); o.userData.shared = true;
    _olGeo.set(g, o); return o;
  }
  function outlineMat(color, px) {
    if (!OL_RES.value) OL_RES.value = new THREE.Vector2(1280, 720);
    const k = color + ':' + px; let m = _olMat.get(k); if (m) return m;
    m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.uOlRes = OL_RES;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform vec2 uOlRes;\nvoid main() {').replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 c = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.); vec2 d = c.xy; float l = length(d);
          if (l > 1e-5) gl_Position.xy += d / l * ${px.toFixed(2)} * 2. / uOlRes * gl_Position.w; }`);
    };
    m.customProgramCacheKey = () => 'a3ol' + px;
    m.userData.shared = true; _olMat.set(k, m); return m;
  }
  /* põe contorno em todas as malhas de `root` (menos brilhos, transparentes e peças minúsculas) */
  function outline(root, o = {}) {
    const color = o.color || '#0d1117', px = o.px || 1.2, min = o.min || 24, list = [];
    root.traverse(m => { if (m.isMesh && !m.isInstancedMesh && !m.userData.noOutline && !Array.isArray(m.material) && !m.material.transparent && !m.material.isMeshBasicMaterial && m.geometry.attributes.position.count >= min) list.push(m); });
    list.forEach(m => { const ol = new THREE.Mesh(outlineGeo(m.geometry), outlineMat(color, px)); ol.userData.noOutline = true; ol.castShadow = false; ol.receiveShadow = false; ol.name = ''; m.add(ol); });
    return root;
  }
  const outlineRes = (w, h) => { if (OL_RES.value) OL_RES.value.set(w, h); };

  return { load, attach, fit, detach, disposeScene, disposeOwn, toScreen, coarse, warm, warmed,
    stdScene, sunAt, roundBox, env, mat, std, glowMat, glowTex, glowSprite, emojiTex, pool, car, CAR_T, mergeStatic,
    noTile, water, waterDepth, waterTick, waterWaves, outline, outlineRes };
})();
