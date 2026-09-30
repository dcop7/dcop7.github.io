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
  let _env = null;
  function env() {
    if (_env || !R) return _env;
    const s = new THREE.Scene();
    const g = new THREE.SphereGeometry(50, 32, 16), col = [], c = new THREE.Color(), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50; c.setRGB(.16 + Math.max(0, y) * .32, .17 + Math.max(0, y) * .34, .2 + Math.max(0, y) * .38); if (y < 0) c.multiplyScalar(.55 + y * .35); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    [[0, 40, 0, 40, 40], [34, 18, 20, 18, 26], [-30, 14, -24, 14, 20]].forEach(([x, y, z, w, h]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); });
    const pm = new THREE.PMREMGenerator(R);
    _env = pm.fromScene(s, .04).texture; pm.dispose();
    s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return _env;
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

  return { load, attach, fit, detach, disposeScene, disposeOwn, toScreen, coarse,
    stdScene, sunAt, roundBox, env, mat, std, glowMat, glowTex, glowSprite, emojiTex, pool };
})();
