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

  return { load, attach, fit, detach, disposeScene, toScreen, coarse };
})();
