/* ══════════════════════════════════════════════════════════════════
   MILKY WAY EXPLORER — premium 3D galaxy (three.js, vendored locally)
   A "Google Earth of the Universe": procedural barred spiral + a curated
   catalog (data/galaxy/objects.json) of stars (coloured by spectral type),
   nebulae (volumetric), black holes (Sgr A*, Cygnus X-1), exoplanets and
   nearby galaxies. Global search with fly-to, category filters, and a smart
   label system (tier + zoom LOD + anti-overlap). Mobile-friendly, offline.
   Reuses the .ex-solar-* CSS for panel/controls (sibling of SolarExplorer).
══════════════════════════════════════════════════════════════════ */
const MilkyWayExplorer = (function () {
  'use strict';

  const THREE_SRC = 'js/vendor/three.min.js';
  const D2R = Math.PI / 180;
  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nf = n => Number(n).toLocaleString(_lang() === 'en' ? 'en' : 'pt-PT');

  /* ── catalog (loaded from JSON; tiny fallback so it never breaks) ── */
  let CAT = null;
  const FALLBACK = { meta: { milkyway: { name: 'Via Láctea', color: '#ffe2a8', info: {}, facts: [] } },
    stars: [{ id: 'sol', name: 'Sol', spectral: 'G2V', distLy: 0, radiusSun: 1, tier: 1, sun: true, facts: [] }],
    nebulae: [], blackholes: [], exoplanets: [], galaxies: [] };

  /* category meta: emoji + colour + label (for filters / search / labels) */
  const CATS = {
    star:      { emoji: '⭐', label: 'Estrelas',      label_en: 'Stars' },
    nebula:    { emoji: '🌌', label: 'Nebulosas',     label_en: 'Nebulae' },
    blackhole: { emoji: '⚫', label: 'Buracos negros', label_en: 'Black holes' },
    exoplanet: { emoji: '🪐', label: 'Exoplanetas',   label_en: 'Exoplanets' },
    galaxy:    { emoji: '🌀', label: 'Galáxias',      label_en: 'Galaxies' },
  };
  const FILTER_ORDER = ['star', 'nebula', 'blackhole', 'exoplanet', 'galaxy'];

  /* spectral type → star colour (O blue … M red) */
  const SPEC_COL = { O: '#9bb0ff', B: '#aabfff', A: '#e2e9ff', F: '#fff6ea', G: '#ffe6a0', K: '#ffc070', M: '#ff8f5e' };
  function starColor(o) { if (o.color) return o.color; const c = (o.spectral || 'G')[0].toUpperCase(); return SPEC_COL[c] || '#fff0d0'; }
  function starBaseR(o) { return Math.max(0.85, Math.min(4.6, 0.85 + Math.log10(1 + (o.radiusSun || 1)) * 1.15)); }

  /* ── State ── */
  let _renderer = null, _scene = null, _camera = null, _raf = null;
  let _mounted = false, _container = null, _glowTex = null;
  let _markers = [];          /* {mesh, data, cat, tier, labelEl, halo, detail} */
  let _byId = {};
  let _galaxyGroup = null, _miniGals = [], _coreSprites = [];
  let _selBody = null, _searchTarget = null, _curTab = 'overview';
  let _rotate = true, _labelsOn = true;
  let _filter = { star: true, nebula: true, blackhole: true, exoplanet: true, galaxy: true };
  let _constFilter = '';      /* highlight a constellation's stars */
  let _SUN = null;            /* THREE.Vector3 of the Sun marker (neighborhood centre) */

  /* Camera orbit */
  let _camTheta = 0.6, _camPhi = 0.85, _camDist = 460;
  let _camThetaT = 0.6, _camPhiT = 0.85, _camDistT = 460;
  let _fx = 0, _fy = 0, _fz = 0, _fxT = 0, _fyT = 0, _fzT = 0;
  let _dragging = false, _lastX = 0, _lastY = 0, _hovered = null, _labelFrame = 0;

  function _reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function _quality() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 720;
    const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    if (small && (lowMem || lowCpu)) return 0.32;
    if (small) return 0.45;
    if (lowMem || lowCpu) return 0.7;
    return 1;
  }
  let _q = 1;
  function _pixelRatio() { return Math.min(window.devicePixelRatio || 1, _q < 0.5 ? 1.25 : 1.75); }
  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.THREE) { resolve(); return; }
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = Object.assign(document.createElement('script'), { src });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ═════════════════════════════ MOUNT ══════════════════════════════ */
  async function mount(container) {
    _container = container;
    container.innerHTML = `
      <div class="ex-solar-wrap gx-wrap">
        <div class="ex-solar-viewport" id="gx-viewport"></div>
        <div class="ex-solar-loading" id="gx-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-solar-loading-txt">A inicializar a Via Láctea 3D…</div>
        </div>

        <div class="gx-search" id="gx-search">
          <span class="gx-search-ic" aria-hidden="true">🔍</span>
          <input id="gx-search-input" type="search" autocomplete="off" placeholder="Pesquisar estrela, nebulosa, galáxia…" aria-label="Pesquisar no Universo">
          <div class="gx-results" id="gx-results" hidden></div>
        </div>

        <div class="gx-filters" id="gx-filters">
          ${FILTER_ORDER.map(c => `<button class="gx-chip on" data-cat="${c}"><span>${CATS[c].emoji}</span>${CATS[c].label}</button>`).join('')}
          <select class="gx-const" id="gx-const" aria-label="Realçar constelação"><option value="">✦ Constelações…</option></select>
        </div>

        <div class="ex-solar-controls">
          <button class="ex-solar-btn" id="gx-galaxy" title="Sobre a Via Láctea">🌌</button>
          <button class="ex-solar-btn active" id="gx-rotate" title="Parar rotação">⏸</button>
          <button class="ex-solar-btn active" id="gx-labels" title="Mostrar/ocultar nomes">🏷</button>
          <div class="ex-solar-divider"></div>
          <button class="ex-solar-btn" id="gx-zoom-out" title="Afastar">−</button>
          <button class="ex-solar-btn" id="gx-zoom-in"  title="Aproximar">+</button>
          <button class="ex-solar-btn" id="gx-reset"    title="Repor">↺</button>
        </div>

        <div class="ex-solar-panel" id="gx-panel">
          <button class="ex-solar-panel-close" id="gx-panel-close" title="Fechar">✕</button>
          <div class="ex-solar-panel-header" id="gx-panel-header"></div>
          <div class="ex-solar-panel-tabs" id="gx-panel-tabs">
            <button class="ex-solar-panel-tab active" data-tab="overview">Geral</button>
            <button class="ex-solar-panel-tab" data-tab="facts">Curiosidades</button>
          </div>
          <div class="ex-solar-panel-body" id="gx-panel-body"></div>
        </div>

        <div class="ex-solar-hint" id="gx-hint">Pesquisa, arrasta para rodar, scroll para zoom · clica num objeto</div>
        <div class="ex-solar-credit">Dados astronómicos aproximados · posições estilizadas para clareza</div>
      </div>`;

    _mounted = true;
    _wireControls(container);
    _wirePanel(container);
    _wireSearch(container);
    _wireFilters(container);

    if (!CAT) {
      try { CAT = await fetch('data/galaxy/objects.json').then(r => r.json()); }
      catch (e) { CAT = FALLBACK; }
    }

    try { await _loadScript(THREE_SRC); }
    catch (e) {
      const ld = document.getElementById('gx-loading');
      if (ld) ld.innerHTML = `<div class="ex-error-icon">⚠</div><div class="ex-error-msg">Erro ao carregar o motor 3D.</div>`;
      return;
    }

    _buildScene(container);
    _buildLabels(container);
    _populateConstellations(container);
    document.getElementById('gx-loading')?.remove();
    _wirePointer(container);
    _start();
  }

  function resume() { if (!_raf && _mounted) _start(); }
  function stop() { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } }

  /* ═════════════════════════════ TEXTURES ═══════════════════════════ */
  function _glowTexture() {
    if (_glowTex) return _glowTex;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _glowTex = new THREE.CanvasTexture(cv);
    return _glowTex;
  }

  /* ═════════════════════════════ SCENE ══════════════════════════════ */
  const GAL_R = 200;

  function _buildScene(container) {
    const viewport = container.querySelector('#gx-viewport');
    const W = viewport.clientWidth || 800, H = viewport.clientHeight || 600;
    _markers = []; _miniGals = []; _coreSprites = []; _byId = {};

    _q = _quality();
    _renderer = new THREE.WebGLRenderer({ antialias: _q >= 0.7, alpha: false });
    _renderer.setPixelRatio(_pixelRatio());
    _renderer.setSize(W, H);
    _renderer.setClearColor(0x070912, 1);
    viewport.appendChild(_renderer.domElement);

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x070912);

    /* Distant background starfield. */
    const bgN = Math.round(6000 * _q), bgPos = new Float32Array(bgN * 3), bgCol = new Float32Array(bgN * 3);
    const sc = new THREE.Color();
    for (let i = 0; i < bgN; i++) {
      const r = 700 + Math.random() * 800, a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * Math.PI;
      bgPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      bgPos[i * 3 + 1] = Math.sin(e) * r;
      bgPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      const h = Math.random() < 0.85 ? 0 : (Math.random() < 0.5 ? 0.08 : 0.6);
      sc.setHSL(h, h ? 0.5 : 0, 0.7 + Math.random() * 0.3);
      bgCol[i * 3] = sc.r; bgCol[i * 3 + 1] = sc.g; bgCol[i * 3 + 2] = sc.b;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCol, 3));
    _scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({ map: _glowTexture(), size: 2.2, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })));

    _scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    _camera = new THREE.PerspectiveCamera(55, W / H, 0.5, 5000);
    _updateCamera();

    _galaxyGroup = new THREE.Group();
    _miniGals = [];
    _scene.add(_galaxyGroup);

    _buildGalaxyHaze();
    _buildGalaxyDisc();
    _buildArmDust();
    _buildHIIRegions();
    _buildCoreGlow();
    _placeObjects();

    new ResizeObserver(() => {
      if (!_renderer || !_camera) return;
      const el = container.querySelector('#gx-viewport');
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      _camera.aspect = w / h; _camera.updateProjectionMatrix();
      _renderer.setSize(w, h);
    }).observe(viewport);
  }

  function _g() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
  function _smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  function _sprite(color, scale, opacity, blend) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: _glowTexture(), color, transparent: true, opacity,
      blending: blend == null ? THREE.AdditiveBlending : blend, depthWrite: false,
    }));
    sp.scale.setScalar(scale);
    return sp;
  }

  /* Procedural barred-spiral (unchanged — looks great). */
  function _buildGalaxyDisc() {
    const cCore = new THREE.Color('#fff0c8'), cMid = new THREE.Color('#ffd2a0'),
          cArm = new THREE.Color('#bcd2ff'), cEdge = new THREE.Color('#8fb4ff');
    const tmp = new THREE.Color();
    const ARMS = [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3];
    const ARM_W = 0.42, WIND = 1.85;
    function fill(geo, N, sizeBias, brightness) {
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        let r, ang, t, faint = 1;
        const roll = Math.random();
        if (roll < 0.15) { r = Math.pow(Math.random(), 1.4) * GAL_R * 0.3; ang = Math.random() * Math.PI * 2; t = r / GAL_R; }
        else if (roll < 0.23) { const along = (Math.random() - 0.5) * GAL_R * 0.5; const wide = _g() * GAL_R * 0.06; r = Math.hypot(along, wide); ang = Math.atan2(wide, along) + 0.5; t = r / GAL_R; }
        else if (roll < 0.42) { t = Math.pow(Math.random(), 1.1); r = 16 + t * (GAL_R - 16); ang = Math.random() * Math.PI * 2; faint = 0.5; }
        else { const ai = i % ARMS.length; t = Math.pow(Math.random(), 1.15); r = 16 + t * (GAL_R - 16); const base = ARMS[ai] + Math.log(r / 16) * WIND; ang = base + _g() * ARM_W * (1 - t * 0.35); }
        const thick = (roll < 0.15 ? 16 : 5.5) * (1 - t * 0.7);
        pos[i * 3] = Math.cos(ang) * r; pos[i * 3 + 1] = _g() * thick; pos[i * 3 + 2] = Math.sin(ang) * r;
        if (t < 0.18) tmp.copy(cCore);
        else if (t < 0.45) tmp.copy(cMid).lerp(cArm, (t - 0.18) / 0.27);
        else tmp.copy(cArm).lerp(cEdge, Math.min(1, (t - 0.45) / 0.55));
        const edge = 1 - _smooth(0.55, 1.0, t) * 0.9;
        const tw = (0.6 + Math.random() * 0.4) * brightness * edge * faint;
        col[i * 3] = tmp.r * tw; col[i * 3 + 1] = tmp.g * tw; col[i * 3 + 2] = tmp.b * tw;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const g1 = new THREE.BufferGeometry(); fill(g1, Math.round(60000 * _q), 0, 0.85);
    _galaxyGroup.add(new THREE.Points(g1, new THREE.PointsMaterial({ size: 1.1, sizeAttenuation: true, vertexColors: true, map: _glowTexture(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
    const g2 = new THREE.BufferGeometry(); fill(g2, Math.round(9000 * _q), 0, 1.25);
    _galaxyGroup.add(new THREE.Points(g2, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: true, vertexColors: true, map: _glowTexture(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  function _buildArmDust() {
    const N = Math.round(9000 * _q), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const ARMS = [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3];
    const cDust = new THREE.Color('#7a4a36');
    for (let i = 0; i < N; i++) {
      const ai = i % ARMS.length; const t = Math.pow(Math.random(), 0.9); const r = 22 + t * (GAL_R - 22);
      const ang = ARMS[ai] + Math.log(r / 16) * 1.85 - 0.14 + _g() * 0.2;
      pos[i * 3] = Math.cos(ang) * r; pos[i * 3 + 1] = _g() * 4; pos[i * 3 + 2] = Math.sin(ang) * r;
      const k = 0.5 + Math.random() * 0.5;
      col[i * 3] = cDust.r * k; col[i * 3 + 1] = cDust.g * k; col[i * 3 + 2] = cDust.b * k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    _galaxyGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: true, vertexColors: true, map: _glowTexture(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  function _buildHIIRegions() {
    const group = new THREE.Group();
    const cols = ['#ff7eb6', '#ff9ecb', '#7fe3ff', '#b59bff', '#ffd27f'];
    const ARMS = [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3];
    for (let i = 0; i < Math.round(64 * _q); i++) {
      const ai = i % ARMS.length; const t = 0.2 + Math.random() * 0.62; const r = 16 + t * (GAL_R - 16);
      const ang = ARMS[ai] + Math.log(r / 16) * 1.85 + (Math.random() - 0.5) * 0.3;
      const knot = _sprite(new THREE.Color(cols[i % cols.length]), 6 + Math.random() * 10, 0.55 + Math.random() * 0.3);
      knot.position.set(Math.cos(ang) * r, _g() * 4, Math.sin(ang) * r);
      group.add(knot);
    }
    _galaxyGroup.add(group);
  }

  function _buildGalaxyHaze() {
    _scene.add(_sprite(new THREE.Color('#4a5a9a'), GAL_R * 3.6, 0.12));
    _scene.add(_sprite(new THREE.Color('#ffcaa0'), GAL_R * 1.5, 0.16));
    const cols = ['#3a4f8f', '#6a3f8c', '#2f6f7a', '#7a3f5f', '#4060a0'];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2; const r = GAL_R * (2.2 + Math.random() * 2.2); const y = (Math.random() - 0.5) * GAL_R * 2.0;
      const cloud = _sprite(new THREE.Color(cols[i % cols.length]), GAL_R * (1.0 + Math.random() * 1.4), 0.05 + Math.random() * 0.06);
      cloud.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _scene.add(cloud);
    }
  }

  function _buildCoreGlow() {
    _coreSprites = [];
    [{ color: 0xfff2d4, scale: 15, opacity: 0.8 }, { color: 0xffd591, scale: 46, opacity: 0.5 }, { color: 0xffb25e, scale: 108, opacity: 0.28 }]
      .forEach(l => { const sp = _sprite(new THREE.Color(l.color), l.scale, l.opacity); sp.userData.base = l.scale; _galaxyGroup.add(sp); _coreSprites.push(sp); });
  }

  /* ── markers ── */
  function _addMarker(data, cat, x, y, z, baseR, glowScale, color, parent) {
    const col = new THREE.Color(color || data.color || '#fff0d0');
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(baseR, 12, 12), new THREE.MeshBasicMaterial({ color: col }));
    mesh.position.set(x, y, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(glowScale); mesh.add(halo);
    (parent || _scene).add(mesh);
    const mk = { mesh, data, cat, tier: data.tier || 2, halo, baseHalo: glowScale };
    _markers.push(mk); _byId[data.id] = mk;
    return mk;
  }

  /* volumetric nebula puff (a soft cloud of tinted sprites) */
  function _nebulaPuff(color, scale, parent, x, y, z) {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const n = Math.max(4, Math.round(7 * _q));
    for (let i = 0; i < n; i++) {
      const sp = _sprite(new THREE.Color(color), scale * (0.5 + Math.random() * 0.9), 0.12 + Math.random() * 0.16);
      sp.position.set((Math.random() - 0.5) * scale, (Math.random() - 0.5) * scale * 0.5, (Math.random() - 0.5) * scale);
      grp.add(sp);
    }
    (parent || _scene).add(grp);
    return grp;
  }

  function _buildMiniGalaxy(data, x, y, z, size) {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const core = new THREE.Color('#fff1d2'), edge = new THREE.Color(data.color || '#cdd9ff');
    const N = Math.max(160, Math.round(520 * _q));
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const t = Math.pow(Math.random(), 0.7); const r = 2 + t * size; const arm = (i % 2) * Math.PI;
      const ang = arm + t * 5.5 + (Math.random() - 0.5) * 0.7;
      pos[i * 3] = Math.cos(ang) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * size * 0.14 * (1 - t * 0.6); pos[i * 3 + 2] = Math.sin(ang) * r;
      tmp.copy(core).lerp(edge, Math.min(1, t * 1.2)); const b = (0.6 + Math.random() * 0.4) * (1 - t * 0.35);
      col[i * 3] = tmp.r * b; col[i * 3 + 1] = tmp.g * b; col[i * 3 + 2] = tmp.b * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    grp.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: size * 0.1, sizeAttenuation: true, vertexColors: true, map: _glowTexture(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
    grp.add(_sprite(new THREE.Color('#fff0cf'), size * 0.7, 0.95));
    grp.add(_sprite(edge.clone(), size * 2.2, 0.18));
    grp.rotation.set((Math.random() - 0.5) * 1.6, Math.random() * Math.PI, (Math.random() - 0.5) * 1.0);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(size * 0.9, 10, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    grp.add(hit); _scene.add(grp); _miniGals.push(grp);
    const mk = { mesh: hit, data, cat: 'galaxy', tier: data.tier || 2, halo: null };
    _markers.push(mk); _byId[data.id] = mk;
  }

  /* Sgr A* — a dark core, bright thin accretion ring + faint jets. */
  function _buildSagA(data) {
    const grp = new THREE.Group();
    grp.add(_sprite(new THREE.Color('#ffe9c0'), 9, 0.95));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 1.1, 8, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd591'), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2.3; grp.add(ring);
    const jet = (s) => { const j = _sprite(new THREE.Color('#bcd2ff'), 10, 0.18); j.position.y = s * 22; j.scale.set(6, 30, 1); grp.add(j); };
    jet(1); jet(-1);
    _galaxyGroup.add(grp);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    grp.add(hit);
    const mk = { mesh: hit, data, cat: 'blackhole', tier: data.tier || 1, halo: null, spin: ring };
    _markers.push(mk); _byId[data.id] = mk;
  }

  /* RA/Dec → unit direction; neighborhood placement around the Sun. */
  function _dir(ra, dec) { const a = (ra || 0) * D2R, d = (dec || 0) * D2R; return { x: Math.cos(d) * Math.cos(a), y: Math.sin(d), z: Math.cos(d) * Math.sin(a) }; }
  function _neighborPos(o) {
    const dir = _dir(o.ra, o.dec);
    const sd = 7 + 70 * (Math.log10(1 + (o.distLy || 0)) / Math.log10(1 + 3000));
    return new THREE.Vector3(_SUN.x + dir.x * sd, _SUN.y + dir.y * sd * 0.55, _SUN.z + dir.z * sd);
  }
  function _discPos(o, i, n) {
    if (o.r != null && o.ang != null) return new THREE.Vector3(Math.cos(o.ang) * o.r, _g() * 6, Math.sin(o.ang) * o.r);
    const a = (i / n) * Math.PI * 2 + 0.6, r = 55 + (i % 3) * 45;
    return new THREE.Vector3(Math.cos(a) * r, (Math.random() - 0.5) * 14, Math.sin(a) * r);
  }

  function _placeObjects() {
    const c = CAT || FALLBACK;

    /* Sun marker — on the Orion arm; centre of the solar neighborhood. */
    const sunR = GAL_R * 0.62, sunA = 0.9;
    _SUN = new THREE.Vector3(Math.cos(sunA) * sunR, 2, Math.sin(sunA) * sunR);

    /* Stars — Sun at its disc spot; the rest in the neighborhood bubble. */
    (c.stars || []).forEach(s => {
      const col = starColor(s), baseR = starBaseR(s);
      const glow = baseR * (s.radiusSun > 100 ? 7 : 5);
      const p = s.sun ? _SUN.clone() : _neighborPos(s);
      _addMarker(s, 'star', p.x, p.y, p.z, baseR, glow, col, _galaxyGroup);
    });

    /* Nebulae — curated spots in the disc, with a volumetric puff. */
    (c.nebulae || []).forEach((nb, i) => {
      const p = _discPos(nb, i, (c.nebulae || []).length);
      const mk = _addMarker(nb, 'nebula', p.x, p.y, p.z, 2.2, 15, nb.color, _galaxyGroup);
      mk.detail = _nebulaPuff(nb.color || '#ff9ad2', 9 + Math.min(18, (nb.sizeLy || 20) / 12), _galaxyGroup, p.x, p.y, p.z);
    });

    /* Black holes — Sgr A* at the centre, others in the disc. */
    (c.blackholes || []).forEach((bh, i) => {
      if (bh.center) { _buildSagA(bh); return; }
      const p = _discPos(bh, i, (c.blackholes || []).length);
      const mk = _addMarker(bh, 'blackhole', p.x, p.y, p.z, 1.8, 11, bh.color || '#9ab8ff', _galaxyGroup);
      mk.detail = _sprite(new THREE.Color(bh.color || '#9ab8ff'), 9, 0.5); mk.detail.position.copy(p); _galaxyGroup.add(mk.detail);
    });

    /* Exoplanets — at the host star if known, else by their own direction. */
    (c.exoplanets || []).forEach(ex => {
      let p;
      const host = ex.hostId && _byId[ex.hostId];
      if (host) { p = host.mesh.position.clone(); p.x += 3.5; p.y += 1.5; }
      else p = _neighborPos(ex);
      _addMarker(ex, 'exoplanet', p.x, p.y, p.z, 1.25, 8, ex.color || '#8fd6a0', _galaxyGroup);
    });

    /* Galaxies — mini-spirals beyond the disc. */
    (c.galaxies || []).forEach((gx, i) => {
      const a = (i / (c.galaxies || []).length) * Math.PI * 2 + 0.3;
      const r = GAL_R + 110 + (i % 3) * 80, y = (i % 2 ? 1 : -1) * (80 + (i % 3) * 55), size = 22 + (i % 3) * 8;
      _buildMiniGalaxy(gx, Math.cos(a) * r, y, Math.sin(a) * r, size);
    });
  }

  /* ═════════════════════════════ CAMERA ═════════════════════════════ */
  function _updateCamera() {
    if (!_camera) return;
    const x = _camDist * Math.sin(_camPhi) * Math.sin(_camTheta) + _fx;
    const y = _camDist * Math.cos(_camPhi) + _fy;
    const z = _camDist * Math.sin(_camPhi) * Math.cos(_camTheta) + _fz;
    _camera.position.set(x, y, z);
    _camera.lookAt(_fx, _fy, _fz);
  }
  function _focus(p, dist) { _fxT = p.x; _fyT = p.y; _fzT = p.z; if (dist) _camDistT = dist; }

  /* fly-to an object (from search or related-chip): frame + open panel. */
  function flyTo(id) {
    const mk = _byId[id]; if (!mk) return;
    _selBody = mk.data; _searchTarget = mk;
    const wp = new THREE.Vector3(); mk.mesh.getWorldPosition(wp);
    const dist = mk.cat === 'galaxy' ? 120 : (mk.cat === 'star' || mk.cat === 'exoplanet' ? 90 : 70);
    _focus(wp, dist);
    _openPanel(mk.data, mk.cat, _container);
  }

  /* ═════════════════════════════ ANIMATION ══════════════════════════ */
  function _start() {
    function tick() {
      _raf = requestAnimationFrame(tick);
      if (!_renderer || !_scene || !_camera) return;
      const spin = _rotate && !_reducedMotion();
      if (spin) {
        if (_galaxyGroup && _selBody === null) _galaxyGroup.rotation.y += 0.0012;
        for (const g of _miniGals) g.rotateY(0.003);
      }
      const pulse = 1 + Math.sin(performance.now() * 0.0012) * 0.06;
      _coreSprites.forEach(sp => sp.scale.setScalar(sp.userData.base * pulse));
      const sgr = _byId['sgra']; if (sgr && sgr.spin) sgr.spin.rotation.z += 0.01;
      if (_selBody === null && !_dragging && spin) _camThetaT += 0.0002;

      const lf = 0.07;
      _camDist += (_camDistT - _camDist) * lf;
      _camTheta += (_camThetaT - _camTheta) * lf;
      _camPhi += (_camPhiT - _camPhi) * lf;
      _fx += (_fxT - _fx) * lf; _fy += (_fyT - _fy) * lf; _fz += (_fzT - _fz) * lf;
      _updateCamera();
      if ((_labelFrame++ % 3) === 0) _layoutLabels();
      _renderer.render(_scene, _camera);
    }
    _raf = requestAnimationFrame(tick);
  }

  /* ═════════════════════════════ LABELS ═════════════════════════════ */
  function _buildLabels(container) {
    const viewport = container.querySelector('#gx-viewport');
    if (!viewport) return;
    _markers.forEach(mk => {
      const el = document.createElement('div');
      el.className = 'gx-label gx-tier' + (mk.tier || 2);
      el.innerHTML = `<span class="gx-label-ic">${CATS[mk.cat] ? CATS[mk.cat].emoji : '•'}</span>${esc(mk.data.name)}`;
      el.style.display = 'none';
      viewport.appendChild(el);
      mk.labelEl = el;
      mk.labelW = mk.data.name.length * 6.4 + 22;   /* rough px width incl. icon */
    });
  }

  const TIER_DIST = { 1: Infinity, 2: 560, 3: 230 };

  /* Smart labels: project visible markers, cull, then place greedily by
     priority avoiding overlap. Runs every ~3 frames (called from _start). */
  function _layoutLabels() {
    if (!_camera || !_renderer) return;
    const canvas = _renderer.domElement;
    const W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
    const mobile = Math.min(W, H) < 640;
    const fh = mobile ? 15 : 17;
    const v = new THREE.Vector3();
    const cands = [];
    for (const mk of _markers) {
      const el = mk.labelEl; if (!el) continue;
      const hiddenByFilter = !_filter[mk.cat];
      const forced = (mk === _hovered || mk === _searchTarget || (_selBody && mk.data === _selBody));
      const constActive = _constFilter && mk.cat === 'star';
      const constMiss = constActive && mk.data.constellation !== _constFilter;
      if (hiddenByFilter && !forced) { el.style.display = 'none'; continue; }
      if (!_labelsOn && !forced) { el.style.display = 'none'; continue; }
      mk.mesh.getWorldPosition(v); v.project(_camera);
      if (v.z > 1) { el.style.display = 'none'; continue; }
      const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      if (sx < -60 || sx > W + 60 || sy < -10 || sy > H + 20) { el.style.display = 'none'; continue; }
      const eligible = forced || (_camDist <= (TIER_DIST[mk.tier] || 560) && !constMiss) || (_constFilter && mk.cat === 'star' && !constMiss);
      if (!eligible) { el.style.display = 'none'; continue; }
      const pr = forced ? -1 : (_constFilter && mk.cat === 'star' && !constMiss ? 0 : mk.tier);
      cands.push({ mk, el, sx, sy, depth: v.z, pr, hl: forced || (_constFilter && mk.cat === 'star' && !constMiss) });
    }
    cands.sort((a, b) => (a.pr - b.pr) || (a.depth - b.depth));
    const taken = [];
    for (const c of cands) {
      const w = c.mk.labelW, h = fh;
      const l = c.sx - w / 2, r = c.sx + w / 2, t = c.sy - 14 - h, bo = c.sy - 14;
      let clash = false;
      for (const o of taken) { if (l < o.r && r > o.l && t < o.b && bo > o.t) { clash = true; break; } }
      if (clash) { c.el.style.display = 'none'; continue; }
      taken.push({ l, r, t, b: bo });
      c.el.style.display = '';
      c.el.style.left = c.sx + 'px';
      c.el.style.top = (c.sy - 14) + 'px';
      c.el.classList.toggle('gx-hl', c.hl);
    }
  }

  /* ═════════════════════════════ POINTER ════════════════════════════ */
  function _wirePointer(container) {
    const viewport = container.querySelector('#gx-viewport');
    if (!viewport) return;
    viewport.addEventListener('mousedown', e => { _dragging = true; _lastX = e.clientX; _lastY = e.clientY; });
    window.addEventListener('mousemove', e => {
      if (!_dragging) return;
      _camThetaT += (e.clientX - _lastX) * 0.005;
      _camPhiT = Math.max(0.15, Math.min(Math.PI - 0.15, _camPhiT + (e.clientY - _lastY) * 0.005));
      _lastX = e.clientX; _lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { _dragging = false; });

    let _pinch = 0;
    const _dist2 = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { _dragging = true; _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY; }
      else if (e.touches.length === 2) { _dragging = false; _pinch = _dist2(e); }
    }, { passive: true });
    viewport.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && _pinch) { const d = _dist2(e); _camDistT = Math.max(40, Math.min(1200, _camDistT * (_pinch / d))); _pinch = d; return; }
      if (!_dragging || e.touches.length !== 1) return;
      _camThetaT += (e.touches[0].clientX - _lastX) * 0.005;
      _camPhiT = Math.max(0.15, Math.min(Math.PI - 0.15, _camPhiT + (e.touches[0].clientY - _lastY) * 0.005));
      _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', e => { _dragging = false; if (e.touches.length < 2) _pinch = 0; });

    viewport.addEventListener('wheel', e => { e.preventDefault(); _camDistT = Math.max(40, Math.min(1200, _camDistT + e.deltaY * 0.5)); }, { passive: false });

    viewport.addEventListener('pointermove', e => {
      if (_dragging || !_camera) return;
      const mk = _pick(e, viewport);
      if (mk !== _hovered) { _hovered = mk; viewport.style.cursor = mk ? 'pointer' : ''; }
    });
    viewport.addEventListener('click', e => {
      if (_dragging) return;
      const mk = _pick(e, viewport);
      if (mk) {
        _selBody = mk.data; _searchTarget = mk;
        const wp = new THREE.Vector3(); mk.mesh.getWorldPosition(wp);
        _focus(wp, mk.cat === 'galaxy' ? 120 : 70);
        _openPanel(mk.data, mk.cat, container);
      } else { _deselect(container); }
    });
  }

  function _pick(e, viewport) {
    const cvs = viewport.querySelector('canvas'); if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.params.Points = ray.params.Points || {};
    ray.setFromCamera(mouse, _camera);
    const visible = _markers.filter(m => _filter[m.cat] && m.mesh.visible);
    const hits = ray.intersectObjects(visible.map(m => m.mesh), false);
    if (!hits.length) return null;
    return visible.find(m => m.mesh === hits[0].object) || null;
  }

  function _deselect(container) {
    _selBody = null; _searchTarget = null;
    container.querySelector('#gx-panel')?.classList.remove('open');
  }

  /* ═════════════════════════════ CONTROLS ═══════════════════════════ */
  function _wireControls(container) {
    container.querySelector('#gx-galaxy').onclick = () => {
      const mw = (CAT || FALLBACK).meta?.milkyway; if (!mw) return;
      _selBody = { ...mw, id: 'milkyway' }; _searchTarget = null;
      _fxT = 0; _fyT = 0; _fzT = 0; _camDistT = 520;
      _openPanel(_selBody, 'milkyway', container);
    };
    container.querySelector('#gx-rotate').onclick = e => {
      _rotate = !_rotate; const b = e.currentTarget; b.classList.toggle('active', _rotate);
      b.textContent = _rotate ? '⏸' : '⟳'; b.title = _rotate ? 'Parar rotação' : 'Retomar rotação';
    };
    container.querySelector('#gx-labels').onclick = e => { _labelsOn = !_labelsOn; e.currentTarget.classList.toggle('active', _labelsOn); };
    container.querySelector('#gx-zoom-in').onclick = () => { _camDistT = Math.max(40, _camDistT * 0.7); };
    container.querySelector('#gx-zoom-out').onclick = () => { _camDistT = Math.min(1200, _camDistT * 1.4); };
    container.querySelector('#gx-reset').onclick = () => {
      _camThetaT = 0.6; _camPhiT = 0.85; _camDistT = 460; _fxT = 0; _fyT = 0; _fzT = 0;
      _deselect(container);
    };
  }

  /* ═════════════════════════════ SEARCH ═════════════════════════════ */
  function _allSearchable() {
    const c = CAT || FALLBACK; const out = [];
    FILTER_ORDER.forEach(cat => {
      const key = cat === 'star' ? 'stars' : cat === 'nebula' ? 'nebulae' : cat === 'blackhole' ? 'blackholes' : cat === 'exoplanet' ? 'exoplanets' : 'galaxies';
      (c[key] || []).forEach(o => out.push({ o, cat }));
    });
    if (c.meta?.milkyway) out.push({ o: { ...c.meta.milkyway, id: 'milkyway' }, cat: 'milkyway' });
    return out;
  }
  function _wireSearch(container) {
    const input = container.querySelector('#gx-search-input');
    const results = container.querySelector('#gx-results');
    if (!input) return;
    const render = () => {
      const q = norm(input.value.trim());
      if (!q) { results.hidden = true; results.innerHTML = ''; return; }
      const all = _allSearchable();
      const hits = all.filter(x => norm(x.o.name).includes(q) || norm(x.o.constellation || '').includes(q)).slice(0, 8);
      if (!hits.length) { results.hidden = false; results.innerHTML = `<div class="gx-result gx-result-empty">Sem resultados</div>`; return; }
      results.hidden = false;
      results.innerHTML = hits.map(h => `<button class="gx-result" data-id="${esc(h.o.id)}" data-cat="${h.cat}">
        <span class="gx-result-ic">${CATS[h.cat] ? CATS[h.cat].emoji : '🌌'}</span>
        <span class="gx-result-tx"><b>${esc(h.o.name)}</b><small>${esc(CATS[h.cat] ? CATS[h.cat].label : 'Galáxia') + (h.o.constellation && h.o.constellation !== '—' ? ' · ' + h.o.constellation : '')}</small></span>
      </button>`).join('');
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { const first = results.querySelector('.gx-result[data-id]'); if (first) first.click(); } else if (e.key === 'Escape') { results.hidden = true; input.blur(); } });
    results.addEventListener('click', e => {
      const b = e.target.closest('.gx-result[data-id]'); if (!b) return;
      const id = b.dataset.id;
      if (id === 'milkyway') { container.querySelector('#gx-galaxy').click(); }
      else flyTo(id);
      results.hidden = true; input.value = ''; input.blur();
    });
    document.addEventListener('click', e => { if (!e.target.closest('#gx-search')) results.hidden = true; });
  }

  /* ═════════════════════════════ FILTERS ════════════════════════════ */
  function _wireFilters(container) {
    container.querySelector('#gx-filters').addEventListener('click', e => {
      const chip = e.target.closest('.gx-chip[data-cat]'); if (!chip) return;
      const cat = chip.dataset.cat; _filter[cat] = !_filter[cat];
      chip.classList.toggle('on', _filter[cat]);
      _applyFilters();
    });
    const sel = container.querySelector('#gx-const');
    if (sel) sel.addEventListener('change', () => {
      _constFilter = sel.value;
      if (_constFilter) {                       /* frame the neighborhood so its stars are legible */
        if (_SUN) { _focus(_SUN, 150); }
      }
    });
  }
  function _populateConstellations(container) {
    const sel = container.querySelector('#gx-const'); if (!sel) return;
    const set = [...new Set((CAT.stars || []).map(s => s.constellation).filter(c => c && c !== '—'))].sort((a, b) => a.localeCompare(b));
    sel.insertAdjacentHTML('beforeend', set.map(c => `<option value="${esc(c)}">✦ ${esc(c)}</option>`).join(''));
  }
  function _applyFilters() {
    for (const mk of _markers) {
      const on = _filter[mk.cat];
      mk.mesh.visible = on;
      if (mk.detail) mk.detail.visible = on;
    }
    /* mini-galaxy groups carry their own visuals (hit mesh is hidden anyway) */
    _miniGals.forEach(g => { g.visible = _filter.galaxy; });
  }

  /* ═════════════════════════════ PANEL ══════════════════════════════ */
  function _wirePanel(container) {
    container.addEventListener('click', e => {
      const tab = e.target.closest('#gx-panel-tabs .ex-solar-panel-tab');
      if (!tab) return;
      container.querySelectorAll('#gx-panel-tabs .ex-solar-panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active'); _curTab = tab.dataset.tab; _renderBody(container);
    });
    const close = container.querySelector('#gx-panel-close');
    if (close) close.onclick = () => _deselect(container);
  }

  /* value formatters → display strings (pt) */
  const fDist = ly => ly == null ? '' : (ly < 1 ? nf(ly) : nf(ly)) + ' anos-luz';
  const fLy = v => v == null ? '' : nf(v) + ' anos-luz';
  function _infoRows(o, cat) {
    if (cat === 'star') return {
      'Tipo espectral': o.spectral, 'Temperatura': o.tempK != null ? nf(o.tempK) + ' K' : '',
      'Raio': o.radiusSun != null ? (o.radiusSun < 2 ? nf(o.radiusSun) + ' × o Sol' : '~' + nf(Math.round(o.radiusSun)) + ' × o raio do Sol') : '',
      'Massa': o.massSun != null ? '~' + nf(o.massSun) + ' × o Sol' : '',
      'Distância': fDist(o.distLy), 'Idade': o.ageGyr != null ? (o.ageGyr >= 1 ? nf(o.ageGyr) + ' mil M anos' : nf(Math.round(o.ageGyr * 1000)) + ' M anos') : '',
      'Magnitude': o.mag != null ? nf(o.mag) : '', 'Constelação': o.constellation && o.constellation !== '—' ? o.constellation : '',
    };
    if (cat === 'nebula') return { 'Tipo': o.nebType, 'Distância': fDist(o.distLy), 'Dimensão': o.sizeLy != null ? '~' + fLy(o.sizeLy) : '', 'Constelação': o.constellation };
    if (cat === 'blackhole') return { 'Tipo': o.bhType, 'Massa': o.massSun >= 1e6 ? '~' + nf(+(o.massSun / 1e6).toFixed(2)) + ' milhões de massas solares' : '~' + nf(o.massSun) + ' massas solares', 'Distância': fDist(o.distLy), 'Descoberta': o.discovered, 'Constelação': o.constellation };
    if (cat === 'exoplanet') return { 'Estrela hospedeira': o.host, 'Tipo de planeta': o.planetType, 'Distância': fDist(o.distLy), 'Habitabilidade': o.habitability, 'Constelação': o.constellation };
    if (cat === 'galaxy') return { 'Tipo': o.galType, 'Distância': o.distMly != null ? nf(o.distMly) + ' milhões de anos-luz' : '', 'Diâmetro': fLy(o.diameterLy) };
    return o.info || {};
  }
  function _subtitle(o, cat) {
    if (cat === 'star') return (o.spectral || '') + (o.constellation && o.constellation !== '—' ? ' · ' + o.constellation : '');
    if (cat === 'nebula') return o.nebType || '';
    if (cat === 'blackhole') return o.bhType || '';
    if (cat === 'exoplanet') return o.planetType || '';
    if (cat === 'galaxy') return o.galType || '';
    return o.info?.type || '';
  }

  function _openPanel(body, cat, container) {
    _curTab = 'overview';
    const hint = container.querySelector('#gx-hint'); if (hint) hint.style.display = 'none';
    const panel = container.querySelector('#gx-panel'); if (!panel) return;
    panel.classList.add('open');
    panel.dataset.cat = cat;
    container.querySelectorAll('#gx-panel-tabs .ex-solar-panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'overview'));
    const color = body.color || (cat === 'star' ? starColor(body) : '#ffd700');
    const el = container.querySelector('#gx-panel-header');
    const sub = _subtitle(body, cat);
    if (el) el.innerHTML = `
      <div class="ex-solar-panel-color" style="background:${color}"></div>
      <div>
        <div class="ex-solar-panel-name">${CATS[cat] ? CATS[cat].emoji + ' ' : ''}${esc(body.name)}</div>
        ${sub ? `<div class="ex-solar-panel-type">${esc(sub)}</div>` : ''}
      </div>`;
    _selBody = body;
    _renderBody(container, cat);
  }

  function _renderBody(container, cat) {
    const bodyEl = container.querySelector('#gx-panel-body');
    const body = _selBody;
    if (!bodyEl || !body) return;
    cat = cat || container.querySelector('#gx-panel')?.dataset.cat || 'star';
    if (_curTab === 'overview') {
      const rows = Object.entries(_infoRows(body, cat)).filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `<div class="ex-solar-info-row"><span class="ex-solar-info-label">${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
      const desc = body.desc ? `<p class="gx-desc">${esc(body.desc)}</p>` : '';
      bodyEl.innerHTML = `${desc}<div class="ex-solar-overview">${rows || '<div class="ex-solar-empty">Sem dados.</div>'}</div>`;
    } else {
      const items = (body.facts || []).map(f => `<div class="ex-solar-fact-item">${esc(f)}</div>`).join('');
      bodyEl.innerHTML = `<div class="ex-solar-facts">${items || '<div class="ex-solar-empty">Sem dados.</div>'}</div>`;
    }
  }

  return { mount, resume, stop, flyTo };
})();
