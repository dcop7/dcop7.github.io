/* ══════════════════════════════════════════════════════════════════
   EXPLORER · CORPO HUMANO — system-first 3D anatomy atlas
   ----------------------------------------------------------------------
   Real, co-registered anatomy from BodyParts3D (CC-BY-SA): every structure
   is its own named, pickable mesh — navigation, search, isolate, x-ray,
   labels and highlight come straight from the data.

   The real SKIN surface (pele.glb) is the translucent body silhouette every
   system sits in, so organs, vessels and nerves read against the true body
   outline. Where the dataset has gaps (limb/head vessels, spinal cord,
   peripheral nerves, tongue, iris) the geometry is built procedurally and
   ANCHORED on real parts: vessels start at the real iliac / subclavian /
   carotid ends and run along each bone's own axis, clamped inside the skin.

   Navigation:  Corpo → Sistema → Estrutura → Detalhes
   Data:        assets/models/anatomy/<system>.glb + pele.glb + data/anatomy/manifest.json
   Engine:      three.js (ESM via esm.sh, module-scoped so it won't clash with
                the other explorers' UMD THREE). Renders on demand.
   ══════════════════════════════════════════════════════════════════ */
const HumanBodyExplorer = (function () {
  'use strict';

  const ESM = {
    three:  'https://esm.sh/three@0.160.0',
    gltf:   'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
    meshopt:'https://esm.sh/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js',
    room:   'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js',
  };
  const MODEL_BASE = 'assets/models/anatomy/';
  const MANIFEST_URL = 'data/anatomy/manifest.json';

  let THREE = null, _GLTFLoader = null, _MeshoptDecoder = null, _RoomEnvironment = null;

  /* ── i18n ── */
  function _lang() { return (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'); }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }
  const _f = (s, field) => s[field + '_' + _lang()] ?? s[field + '_pt'];
  const _nm = (s) => (_lang() === 'en' ? s.en : s.pt);
  const _sn = (sys) => (_lang() === 'en' ? sys.en : sys.pt);
  const _esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ── manifest ── */
  let MANIFEST = null, SYS = [], SYS_BY_ID = {}, STRUCT = [], STRUCT_BY_KEY = {};

  /* Anatomical colours (the UI keeps each system's accent colour; the 3D
     model uses what the tissue actually looks like). */
  const REAL = {
    esqueletico: 0xe7dcc6, muscular: 0xa8423b,
    coracao: 0xa52f37, aorta: 0xc22f38, arterias: 0xc8303a, veias: 0x3b62b5, pulmonar: 0x7559c2,
    pulmoes: 0xe29b9b, traqueia: 0xe6d3bd, laringe: 0xdfc8ae, diafragma: 0xab4a44,
    cerebro: 0xe3b3a8, cerebelo: 0xd49c94, troncocerebral: 0xd7ae95,
    medula: 0xf0cf6a, nervos: 0xf3d36b,
    esofago: 0xd2857c, estomago: 0xdc9a8a, figado: 0x8b3a2e, vesicula: 0x5d8a3c,
    intestinodelgado: 0xe7a594, intestinogrosso: 0xc98a73, baco: 0x7b2d3b,
    rins: 0x96392f, ureteres: 0xdcbc72, bexiga: 0xe2ad88,
    olhos: 0xf3f1ec, ouvido: 0xe2ad94, nariz: 0xe2ad94, paladar: 0xd36c76,
    coronarias: 0xbf333c, vasos_cabeca: 0xc8303a, vasos_tronco: 0xc8303a, vasos_bracos: 0xc8303a, vasos_maos: 0xc8303a, vasos_pernas: 0xc8303a, vasos_pes: 0xc8303a,
    dentes: 0xf1ead8, nervootico: 0xf2d36e, palpebras: 0xb5534b, musculos_olho: 0xb04a42,
    ouvido_medio: 0xf0e4c6, ouvido_interno: 0xeccab4, olfato: 0xf3dc8e, tato: 0xe8b49a,
  };
  /* real vessel meshes: artery or vein (drives colour of mixed groups + the A/V filter) */
  const _vesselKind = part => /vein|vena cava|sinus/i.test(part) ? 'V' : /arter|aorta|trunk|branch/i.test(part) ? 'A' : null;
  /* per-muscle hue/lightness jitter so neighbouring muscles read apart */
  const MUSCLE_TINT = { peitoral: 0.02, deltoide: -0.03, biceps: 0.05, triceps: -0.05, abdominal: 0.04,
    trapezio: -0.02, grandedorsal: 0.03, ecm: -0.04, gluteo: 0.0, quadriceps: 0.05, isquiotibiais: -0.04,
    gemeos: 0.03, sartorio: 0.08, masseter: -0.02 };

  /* ── DOM / scene ── */
  let _host = null, _vp = null, _panel = null, _crumb = null, _searchInput = null, _labelsEl = null, _tipEl = null;
  let _renderer = null, _scene = null, _camera = null, _raf = null, _envTex = null;
  let _mounted = false, _built = false;

  /* ── loaded model state ── */
  const _sysGroup = {};        // sysId → THREE.Group
  const _meshByKey = {};       // structureKey → [mesh, …]
  const _loaded = new Set();
  const _loading = new Map();  // sysId → Promise
  let _shell = null;           // skin (pele.glb) group
  let _shellMeshes = [];
  let _shadow = null;

  /* ── view state ── */
  let _curSys = null;
  let _selKey = null, _hoverKey = null;
  let _isolate = false, _xray = false, _labelsOn = true;
  let _autoX = false;           // x-ray switched on by selecting a buried structure
  let _vesselFilter = 'all';     // circulatory: 'all' | 'A' arteries | 'V' veins

  /* ── camera (spherical around a focus point) ── */
  let _az = 0.35, _pol = 1.42, _dist = 34;
  let _azT = 0.35, _polT = 1.42, _distT = 34;
  let _focus = null, _focusT = null;
  let _autoSpin = true, _dirty = true, _lastInteract = 0;

  const GHOST_SYS = 'esqueletico';   // skeleton doubles as spatial context

  /* ════════════════════════════ LOADERS ════════════════════════════ */
  async function _loadThree() {
    try {
      const [T, G, M, R] = await Promise.all([import(ESM.three), import(ESM.gltf), import(ESM.meshopt), import(ESM.room)]);
      THREE = T; _GLTFLoader = G.GLTFLoader; _MeshoptDecoder = M.MeshoptDecoder; _RoomEnvironment = R.RoomEnvironment;
      if (_MeshoptDecoder.ready) await _MeshoptDecoder.ready;
      return true;
    } catch (e) { return false; }
  }

  async function _loadManifest() {
    try {
      const r = await fetch(MANIFEST_URL);
      MANIFEST = await r.json();
      SYS = MANIFEST.systems || [];
      STRUCT = MANIFEST.structures || [];
      SYS.forEach(s => SYS_BY_ID[s.id] = s);
      STRUCT.forEach(s => STRUCT_BY_KEY[s.key] = s);
      /* keep each system's structures in a sensible reading order */
      const order = ['coracao', 'coronarias', 'aorta', 'arterias', 'veias', 'pulmonar', 'vasos_cabeca', 'vasos_tronco', 'vasos_bracos', 'vasos_maos', 'vasos_pernas', 'vasos_pes',
        'cerebro', 'cerebelo', 'troncocerebral', 'medula', 'nervos',
        'olhos', 'musculos_olho', 'palpebras', 'nervootico', 'ouvido', 'ouvido_medio', 'ouvido_interno', 'nariz', 'olfato', 'paladar', 'tato'];
      const ord = k => { const i = order.indexOf(k); return i < 0 ? -1 : i; };
      STRUCT.forEach((s, i) => s._i = i);
      STRUCT.sort((a, b) => (SYS.findIndex(s => s.id === a.system) - SYS.findIndex(s => s.id === b.system)) ||
        (ord(a.key) - ord(b.key)) || (a._i - b._i));
      return SYS.length > 0;
    } catch (e) { return false; }
  }

  function _loadGLB(url) {
    return new Promise((resolve, reject) => {
      const loader = new _GLTFLoader();
      if (_MeshoptDecoder) loader.setMeshoptDecoder(_MeshoptDecoder);
      loader.load(url, g => resolve(g.scene), undefined, reject);
    });
  }

  /* Material per mesh (selection changes emissive per structure). */
  function _material(sysId, key, col) {
    const base = { color: col.clone(), transparent: false, opacity: 1, envMapIntensity: 0.7 };
    if (sysId === 'esqueletico')
      return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.58, metalness: 0, sheen: 0.25, sheenColor: new THREE.Color(0xfff4e0), sheenRoughness: 0.6 });
    if (sysId === 'muscular')
      return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.5, metalness: 0, sheen: 0.55, sheenColor: new THREE.Color(0xff9a8a), sheenRoughness: 0.45, clearcoat: 0.15, clearcoatRoughness: 0.6 });
    if (key === 'olhos')
      return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    /* organs, vessels, nerves: moist tissue → soft clearcoat sheen */
    return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.35 });
  }

  function _colorFor(sysId, key) {
    if (sysId === 'muscular') {
      const c = new THREE.Color(REAL.muscular);
      const k = MUSCLE_TINT[key] || 0;
      c.offsetHSL(k * 0.25, k * 0.8, k * 0.9);
      return c;
    }
    const hex = REAL[key] ?? REAL[sysId];
    return new THREE.Color(hex != null ? hex : SYS_BY_ID[sysId].color);
  }

  function _register(o, sysId, key, col, mat) {
    o.material = mat || _material(sysId, key, col);
    o.userData.key = key;
    o.userData.sys = sysId;
    o.userData.baseColor = col.clone();
    o.userData.pickable = true;
    if (key) (_meshByKey[key] = _meshByKey[key] || []).push(o);
  }

  /* Load one system's GLB, recolour its meshes and index them by structure key. */
  function _ensureSystem(sysId) {
    if (_loaded.has(sysId)) return Promise.resolve();
    if (_loading.has(sysId)) return _loading.get(sysId);
    const p = (async () => {
      try {
        const root = await _loadGLB(MODEL_BASE + sysId + '.glb');
        const grp = new THREE.Group();
        grp.name = sysId;
        root.traverse(o => {
          if (!o.isMesh) return;
          const key = _structureKeyOf(o);
          const kind = sysId === 'circulatorio' ? _vesselKind(o.userData.part || '') : null;
          const col = key === 'coronarias' && kind ? new THREE.Color(kind === 'V' ? REAL.veias : REAL.arterias) : _colorFor(sysId, key);
          _register(o, sysId, key, col);
          if (kind) o.userData.kind = kind;
          /* the orbicularis is a thin sheet round the eye: translucent, so the eyeball and its muscles stay readable */
          if (key === 'palpebras') o.userData.alpha = 0.42;
        });
        grp.add(root);
        _sysGroup[sysId] = grp;
        _scene.add(grp);
        _loaded.add(sysId);
      } catch (e) {
        console.warn('anatomy: failed to load system', sysId, e);
      } finally { _loading.delete(sysId); }
    })();
    _loading.set(sysId, p);
    return p;
  }

  /* The skin silhouette: Fresnel "x-ray" shader — almost clear facing the
     camera, glowing at the outline — so it reads as the body's shape without
     hiding anything inside. uTouch blends to a warm skin tone for "Tato". */
  function _shellMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x9cc2ff) }, uSkin: { value: new THREE.Color(0xe8b49a) },
                  uOpacity: { value: 1 }, uTouch: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uSkin; uniform float uOpacity; uniform float uTouch;
        varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
          vec3 c = mix(uColor, uSkin, uTouch);
          float a = (mix(0.025, 0.12, uTouch) + f * mix(0.55, 0.75, uTouch)) * uOpacity;
          gl_FragColor = vec4(c * (0.75 + f * 0.6), a); }`,
      transparent: true, depthWrite: false, side: THREE.FrontSide,
    });
  }
  async function _ensureShell() {
    if (_shell) return;
    try {
      const root = await _loadGLB(MODEL_BASE + 'pele.glb');
      const mat = _shellMaterial();
      root.traverse(o => {
        if (!o.isMesh) return;
        o.material = mat; o.renderOrder = 10;
        o.userData.key = 'tato'; o.userData.sys = 'sentidos'; o.userData.pickable = false; o.userData.shell = true;
        _shellMeshes.push(o);
      });
      _shell = new THREE.Group(); _shell.name = 'pele'; _shell.add(root);
      _scene.add(_shell);
      _meshByKey.tato = _shellMeshes.slice();
      _skinF = null;
    } catch (e) { console.warn('anatomy: no skin shell', e); }
  }

  /* Walk up to the nearest ancestor whose name is a known structure key. */
  function _structureKeyOf(mesh) {
    let n = mesh;
    while (n) {
      const name = (n.name || '').replace(/_\d+$/, '');
      if (STRUCT_BY_KEY[name]) return name;
      n = n.parent;
    }
    return null;
  }

  /* ════════════════════════ GEOMETRY HELPERS ═══════════════════════ */
  const _V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* World-space vertices of the meshes of a loaded system whose source part
     name matches `re` (decimated to ~max points). */
  function _partPts(sysId, re, max) {
    const out = [], v = new THREE.Vector3();
    const grp = _sysGroup[sysId]; if (!grp) return out;
    const meshes = [];
    grp.traverse(o => { if (o.isMesh && re.test(o.userData.part || '')) meshes.push(o); });
    let total = 0; meshes.forEach(m => total += m.geometry.attributes.position.count);
    const step = Math.max(1, Math.ceil(total / (max || 2500)));
    meshes.forEach(m => {
      const pos = m.geometry.attributes.position;
      m.updateWorldMatrix(true, false);
      for (let i = 0; i < pos.count; i += step) out.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
    });
    return out;
  }
  function _keyPts(key, max) {
    const out = [], v = new THREE.Vector3();
    (_meshByKey[key] || []).forEach(m => {
      const pos = m.geometry && m.geometry.attributes.position; if (!pos) return;
      m.updateWorldMatrix(true, false);
      const step = Math.max(1, Math.ceil(pos.count / (max || 600)));
      for (let i = 0; i < pos.count; i += step) out.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
    });
    return out;
  }
  const _centroid = pts => { const c = new THREE.Vector3(); pts.forEach(p => c.add(p)); return pts.length ? c.multiplyScalar(1 / pts.length) : null; };
  const _argmax = (pts, f) => { let b = null, bv = -Infinity; for (const p of pts) { const v = f(p); if (v > bv) { bv = v; b = p; } } return b; };

  /* Principal axis of a long bone (PCA by power iteration). a = proximal
     (upper) end, b = distal end, measured on the bone's own vertices. */
  function _axis(pts) {
    if (!pts || pts.length < 8) return null;
    const c = _centroid(pts);
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    for (const p of pts) { const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z; xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z; }
    let d = _V(0, 1, 0);
    for (let i = 0; i < 24; i++) {
      d = _V(xx * d.x + xy * d.y + xz * d.z, xy * d.x + yy * d.y + yz * d.z, xz * d.x + yz * d.y + zz * d.z).normalize();
    }
    if (d.y > 0) d.negate();                 // point downward (proximal → distal)
    let lo = Infinity, hi = -Infinity, rad = 0;
    for (const p of pts) { const t = p.clone().sub(c).dot(d); if (t < lo) lo = t; if (t > hi) hi = t; }
    for (const p of pts) { const q = p.clone().sub(c); rad += q.sub(d.clone().multiplyScalar(q.dot(d))).length(); }
    return { a: c.clone().addScaledVector(d, lo), b: c.clone().addScaledVector(d, hi), dir: d, len: hi - lo, r: rad / pts.length, c };
  }
  /* Local frame on a bone at parameter t: m = toward the body midline,
     f = anterior (+Z), both perpendicular to the bone. */
  function _frame(ax, t, sx) {
    const p = ax.a.clone().addScaledVector(ax.dir, ax.len * t);
    const M = _V(-sx, 0, 0); const m = M.sub(ax.dir.clone().multiplyScalar(M.dot(ax.dir))).normalize();
    const F = _V(0, 0, 1); F.sub(ax.dir.clone().multiplyScalar(F.dot(ax.dir))); F.sub(m.clone().multiplyScalar(F.dot(m))); F.normalize();
    return { p, m, f: F };
  }

  /* ═══════════════ SKIN FIELD — keep procedural geometry inside the body ═══════════════
     The real skin (pele.glb) as a triangle soup in a uniform grid. A nearest-
     triangle query gives an exact signed distance (+ = outside), so every
     sample of every procedural vessel / nerve is pulled back under the skin —
     nothing can poke out, even where the bone-relative guesses overshoot. */
  let _skinF = null, _stamp = null, _qid = 0;
  const _GK = (i, j, k) => ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512);
  function _skinField() {
    if (_skinF) return _skinF;
    const tri = [], v = new THREE.Vector3();
    _shellMeshes.forEach(m => {
      const g = m.geometry, pos = g.attributes.position, ix = g.index;
      m.updateWorldMatrix(true, false);
      const W = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z; }
      const n = ix ? ix.count : pos.count;
      for (let k = 0; k < n; k++) { const a = ix ? ix.getX(k) : k; tri.push(W[a * 3], W[a * 3 + 1], W[a * 3 + 2]); }
    });
    const T = new Float32Array(tri), nt = T.length / 9, N = new Float32Array(nt * 3);
    const cs = 0.09, grid = new Map();
    let orient = 0;
    for (let t = 0; t < nt; t++) {
      const o = t * 9;
      const ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2];
      const wx = T[o + 6] - T[o], wy = T[o + 7] - T[o + 1], wz = T[o + 8] - T[o + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
      N[t * 3] = nx / l; N[t * 3 + 1] = ny / l; N[t * 3 + 2] = nz / l;
      const cx = (T[o] + T[o + 3] + T[o + 6]) / 3, cz = (T[o + 2] + T[o + 5] + T[o + 8]) / 3;
      orient += nx * cx + nz * cz;                       // outward ≈ away from the body's vertical axis
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let c = 0; c < 9; c += 3) {
        x0 = Math.min(x0, T[o + c]); x1 = Math.max(x1, T[o + c]);
        y0 = Math.min(y0, T[o + c + 1]); y1 = Math.max(y1, T[o + c + 1]);
        z0 = Math.min(z0, T[o + c + 2]); z1 = Math.max(z1, T[o + c + 2]);
      }
      for (let i = Math.floor(x0 / cs); i <= Math.floor(x1 / cs); i++)
        for (let j = Math.floor(y0 / cs); j <= Math.floor(y1 / cs); j++)
          for (let k = Math.floor(z0 / cs); k <= Math.floor(z1 / cs); k++) {
            const key = _GK(i, j, k); let L = grid.get(key); if (!L) grid.set(key, L = []); L.push(t);
          }
    }
    if (orient < 0) for (let i = 0; i < N.length; i++) N[i] = -N[i];
    /* dense companion grid: which cells touch the skin, which are inside the
       body (flood fill from the outside), and each cell's distance (in cells)
       to the nearest skin cell → deep points skip the search entirely */
    let i0 = Infinity, j0 = Infinity, k0 = Infinity, i1 = -Infinity, j1 = -Infinity, k1 = -Infinity;
    grid.forEach((_, key) => {
      const i = Math.floor(key / 1048576) - 512, j = Math.floor(key / 1024) % 1024 - 512, k = key % 1024 - 512;
      if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; if (k < k0) k0 = k; if (k > k1) k1 = k;
    });
    i0 -= 1; j0 -= 1; k0 -= 1; i1 += 1; j1 += 1; k1 += 1;
    const nx = i1 - i0 + 1, ny = j1 - j0 + 1, nz = k1 - k0 + 1, NC = nx * ny * nz;
    const at = (i, j, k) => (i * ny + j) * nz + k;
    const occ = new Uint8Array(NC), outside = new Uint8Array(NC), dist = new Uint8Array(NC).fill(255);
    grid.forEach((_, key) => {
      const i = Math.floor(key / 1048576) - 512 - i0, j = Math.floor(key / 1024) % 1024 - 512 - j0, k = key % 1024 - 512 - k0;
      occ[at(i, j, k)] = 1;
    });
    const q = new Int32Array(NC); let qh = 0, qt = 0;
    const push = (c, arr, v) => { arr[c] = v; q[qt++] = c; };
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++)
      if ((i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) && !occ[at(i, j, k)] && !outside[at(i, j, k)]) push(at(i, j, k), outside, 1);
    while (qh < qt) {
      const c = q[qh++], k = c % nz, j = Math.floor(c / nz) % ny, i = Math.floor(c / (ny * nz));
      for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const a = i + di, b = j + dj, cc = k + dk;
        if (a < 0 || b < 0 || cc < 0 || a >= nx || b >= ny || cc >= nz) continue;
        const n = at(a, b, cc); if (!occ[n] && !outside[n]) push(n, outside, 1);
      }
    }
    qh = qt = 0;
    for (let c = 0; c < NC; c++) if (occ[c]) push(c, dist, 0);
    while (qh < qt) {
      const c = q[qh++], k = c % nz, j = Math.floor(c / nz) % ny, i = Math.floor(c / (ny * nz)), dv = dist[c] + 1;
      if (dv > 12) continue;                           // only near-skin distances matter; 255 = far
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
        const a = i + di, b = j + dj, cc = k + dk;
        if (a < 0 || b < 0 || cc < 0 || a >= nx || b >= ny || cc >= nz) continue;
        const n = at(a, b, cc); if (dist[n] > dv) push(n, dist, dv);
      }
    }
    return (_skinF = { T, N, nt, cs, grid, i0, j0, k0, nx, ny, nz, at, outside, dist });
  }
  /* closest point on triangle (Ericson, Real-Time Collision Detection 5.1.5) */
  function _closestTri(p, T, o, out) {
    const ax = T[o], ay = T[o + 1], az = T[o + 2];
    const abx = T[o + 3] - ax, aby = T[o + 4] - ay, abz = T[o + 5] - az;
    const acx = T[o + 6] - ax, acy = T[o + 7] - ay, acz = T[o + 8] - az;
    const apx = p.x - ax, apy = p.y - ay, apz = p.z - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) return out.set(ax, ay, az);
    const bpx = p.x - T[o + 3], bpy = p.y - T[o + 4], bpz = p.z - T[o + 5];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) return out.set(T[o + 3], T[o + 4], T[o + 5]);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); return out.set(ax + abx * t, ay + aby * t, az + abz * t); }
    const cpx = p.x - T[o + 6], cpy = p.y - T[o + 7], cpz = p.z - T[o + 8];
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) return out.set(T[o + 6], T[o + 7], T[o + 8]);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); return out.set(ax + acx * t, ay + acy * t, az + acz * t); }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
      const t = (d4 - d3) / ((d4 - d3) + (d5 - d6));
      return out.set(T[o + 3] + (T[o + 6] - T[o + 3]) * t, T[o + 4] + (T[o + 7] - T[o + 4]) * t, T[o + 5] + (T[o + 8] - T[o + 5]) * t);
    }
    const den = 1 / (va + vb + vc), sv = vb * den, sw = vc * den;
    return out.set(ax + abx * sv + acx * sw, ay + aby * sv + acy * sw, az + abz * sv + acz * sw);
  }
  const _cpt = () => new THREE.Vector3();
  const _cp0 = { v: null };
  /* nearest skin point → { q, n (outward), d (signed: + outside) }.
     With `need`: a point already deeper than `need` inside the body returns
     { deep: true } straight from the dense grid. */
  const _DEEP = { deep: true, d: -Infinity };
  function _skinNear(p, need) {
    const F = _skinField(); if (!F.nt) return null;
    if (!_stamp || _stamp.length !== F.nt) _stamp = new Int32Array(F.nt);
    if (!_cp0.v) _cp0.v = _cpt();
    const cp = _cp0.v, cs = F.cs, qid = ++_qid;
    const ci = Math.floor(p.x / cs), cj = Math.floor(p.y / cs), ck = Math.floor(p.z / cs);
    let r0 = 0;
    const li = ci - F.i0, lj = cj - F.j0, lk = ck - F.k0;
    if (li >= 0 && lj >= 0 && lk >= 0 && li < F.nx && lj < F.ny && lk < F.nz) {
      const c = F.at(li, lj, lk), dc = F.dist[c];
      if (need != null && !F.outside[c] && dc > 1 && (dc - 1) * cs > need) return _DEEP;
      r0 = Math.max(0, Math.min(dc, 12) - 1);
    }
    let best = Infinity, bt = -1, bx = 0, by = 0, bz = 0;
    for (let r = r0; r <= Math.max(10, r0 + 4); r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
        const L = F.grid.get(_GK(ci + i, cj + j, ck + k)); if (!L) continue;
        for (let n = 0; n < L.length; n++) {
          const t = L[n]; if (_stamp[t] === qid) continue; _stamp[t] = qid;
          _closestTri(p, F.T, t * 9, cp);
          const d2 = p.distanceToSquared(cp);
          if (d2 < best) { best = d2; bt = t; bx = cp.x; by = cp.y; bz = cp.z; }
        }
      }
      if (bt >= 0 && best <= r * cs * r * cs) break;
    }
    if (bt < 0) return null;
    const n = _V(F.N[bt * 3], F.N[bt * 3 + 1], F.N[bt * 3 + 2]), q = _V(bx, by, bz);
    return { q, n, d: (p.x - bx) * n.x + (p.y - by) * n.y + (p.z - bz) * n.z };
  }
  /* p, pulled to at least `inset` under the skin */
  function _keepIn(p, inset) {
    const s = _skinNear(p, inset);
    if (!s || s.d < -inset) return p;
    const q = s.q.clone().addScaledVector(s.n, -inset);
    const s2 = _skinNear(q);                          // thin finger/toe: don't punch out the far side
    if (s2 && s2.d > -inset * 0.4) return s.q.clone().addScaledVector(s.n, -inset * 0.45);
    return q;
  }
  /* point at bone parameter t, offset toward the midline (om) and to the front (of) */
  function _at(ax, t, sx, om, of) {
    const fr = _frame(ax, t, sx);
    return fr.p.addScaledVector(fr.m, om).addScaledVector(fr.f, of);
  }
  /* arc around a bone at parameter t (radius rr): angle 0 = front, +90° =
     toward the midline, ±180° = back → vessels that wrap round a bone
     (circumflex, genicular, perforating) instead of cutting across it */
  function _arc(ax, t0, t1, sx, rr, a0, a1, n) {
    const out = [];
    n = n || 6;
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = (a0 + (a1 - a0) * u) * Math.PI / 180;
      out.push(_at(ax, t0 + (t1 - t0) * u, sx, Math.sin(a) * rr, Math.cos(a) * rr));
    }
    return out;
  }
  /* march from p (inside the body) along d until leaving it, then `depth` under that skin */
  function _surfRay(p, d, depth) {
    const F = _skinField(); if (!F.nt) return p;
    const q = p.clone(), st = d.clone().normalize().multiplyScalar(F.cs * 0.5);
    for (let i = 0; i < 80; i++) {
      q.add(st);
      const li = Math.floor(q.x / F.cs) - F.i0, lj = Math.floor(q.y / F.cs) - F.j0, lk = Math.floor(q.z / F.cs) - F.k0;
      if (li < 0 || lj < 0 || lk < 0 || li >= F.nx || lj >= F.ny || lk >= F.nz || F.outside[F.at(li, lj, lk)]) break;
    }
    return _under(q, depth);
  }
  /* p snapped to `depth` under the nearest skin (superficial veins, scalp vessels) */
  function _under(p, depth) {
    if (!p) return p;
    const s = _skinNear(p);
    return s ? s.q.clone().addScaledVector(s.n, -depth) : p;
  }

  /* ═══════════════════ TUBES (merged per structure + kind) ═══════════════════ */
  /* One builder per system; every tube lands in a shared buffer keyed by
     structure + kind (A artery, V vein, N nerve, …) → a handful of meshes
     instead of hundreds, each still pickable and highlightable per structure. */
  function _builder(sysId) {
    const bufs = new Map();
    return {
      tube(key, kind, pts, r0, r1, o) {
        let b = bufs.get(key + '|' + kind);
        if (!b) bufs.set(key + '|' + kind, b = { key, kind, pos: [], nrm: [], idx: [] });
        return _tubeInto(b, pts, r0, r1, o || {});
      },
      flush(grp, matFor) {
        bufs.forEach(b => {
          if (!b.idx.length) return;
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
          g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
          g.setIndex(b.idx);
          g.computeBoundingSphere();
          const mat = matFor(b.key, b.kind);
          const m = new THREE.Mesh(g, mat);
          _register(m, sysId, b.key, mat.color.clone(), mat);
          m.userData.kind = b.kind; m.userData.proc = true;
          grp.add(m);
        });
        bufs.clear();
      },
    };
  }

  /* Tapered tube along a smooth curve, sampled, kept inside the skin and
     lightly smoothed. Returns the final centre-line (for branching off it).
     o: { prof(t)→r, inset, free (no skin clamp), flat:{k, hint}, rad } */
  function _tubeInto(b, pts, r0, r1, o) {
    pts = pts.filter(Boolean);
    for (let i = pts.length - 1; i > 0; i--) if (pts[i].distanceToSquared(pts[i - 1]) < 1e-8) pts.splice(i, 1);
    if (pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength(); if (L < 1e-4) return null;
    const R = o.prof || (t => r0 + (r1 - r0) * t);
    const rMax = Math.max(R(0), R(0.5), R(1));
    const seg = Math.max(4, Math.min(260, Math.round(L / Math.max(0.013, rMax * 1.6))));
    let P = curve.getSpacedPoints(seg);
    if (!o.free) {
      const ins = i => (o.inset != null ? o.inset : 0.005) + R(i / seg) * 1.3;
      /* correction needed to stay under the skin, measured on every 3rd sample
         and interpolated (the exact nearest-triangle test is the costly part) */
      const disp = Q => {
        const D = new Array(seg + 1), K = 3;
        let any = false;
        for (let i = 0; i <= seg; i = i === seg ? seg + 1 : Math.min(seg, i + K)) {
          D[i] = _keepIn(Q[i], ins(i)).clone().sub(Q[i]);     // _keepIn may return Q[i] itself
          if (D[i].lengthSq() > 1e-10) any = true;
        }
        let prev = 0;
        for (let i = 1; i <= seg; i++) if (D[i]) {
          for (let j = prev + 1; j < i; j++) D[j] = D[prev].clone().lerp(D[i], (j - prev) / (i - prev));
          prev = i;
        }
        return any ? D : null;
      };
      let Dp = disp(P);
      if (Dp) {
        /* spread the push along the line so a stretch that leaves the skin
           bends back in smoothly instead of being snapped point by point */
        for (let pass = 0; pass < 10; pass++) {
          const E = Dp.map(d => d.clone());
          for (let i = 0; i <= seg; i++) {
            const m = E[i].copy(Dp[Math.max(0, i - 1)]).add(Dp[Math.min(seg, i + 1)]).addScaledVector(Dp[i], 2).multiplyScalar(0.25);
            if (Dp[i].lengthSq() > m.lengthSq()) m.copy(Dp[i]);     // never weaken a needed push
          }
          Dp = E;
        }
        P = P.map((p, i) => p.clone().add(Dp[i]));
        const D2 = disp(P);
        if (D2) P = P.map((p, i) => p.add(D2[i]));
      }
    }
    const n = P.length, Tn = [];
    for (let i = 0; i < n; i++) Tn.push(P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize());
    const perp = t => (Math.abs(t.y) < 0.9 ? _V(0, 1, 0) : _V(1, 0, 0)).sub(t.clone().multiplyScalar(Math.abs(t.y) < 0.9 ? t.y : t.x)).normalize();
    let N = perp(Tn[0]);
    const rad = o.rad || (rMax > 0.03 ? 12 : rMax > 0.012 ? 9 : 7);
    const base = b.pos.length / 3;
    const B = new THREE.Vector3(), d = new THREE.Vector3(), h = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      if (i) { N.sub(Tn[i].clone().multiplyScalar(N.dot(Tn[i]))); if (N.lengthSq() < 1e-10) N = perp(Tn[i]); N.normalize(); }
      B.crossVectors(Tn[i], N);
      const r = Math.max(0.0014, R(i / (n - 1)));
      let hk = 0;
      if (o.flat) {
        h.copy(typeof o.flat.hint === 'function' ? o.flat.hint(P[i]) : o.flat.hint);
        h.sub(Tn[i].clone().multiplyScalar(h.dot(Tn[i])));
        if (h.lengthSq() > 1e-8) { h.normalize(); hk = o.flat.k; }
      }
      for (let j = 0; j < rad; j++) {
        const a = j / rad * Math.PI * 2;
        d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        nn.copy(d);
        if (hk) { const c = d.dot(h); d.addScaledVector(h, c * (hk - 1)); nn.addScaledVector(h, c * (1 / hk - 1)).normalize(); }
        b.pos.push(P[i].x + d.x * r, P[i].y + d.y * r, P[i].z + d.z * r);
        b.nrm.push(nn.x, nn.y, nn.z);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * rad + j, b2 = base + i * rad + (j + 1) % rad, c = base + (i + 1) * rad + (j + 1) % rad, e = base + (i + 1) * rad + j;
      b.idx.push(a, b2, e, b2, c, e);
    }
    /* rounded caps so free ends never show a hole */
    const cap = (i, sg) => {
      const ci = b.pos.length / 3, r = Math.max(0.0014, R(i / (n - 1)));
      const tip = P[i].clone().addScaledVector(Tn[i], sg * r * 0.7);
      b.pos.push(tip.x, tip.y, tip.z); b.nrm.push(Tn[i].x * sg, Tn[i].y * sg, Tn[i].z * sg);
      const ring = base + i * rad;
      for (let j = 0; j < rad; j++) {
        if (sg > 0) b.idx.push(ring + j, ring + (j + 1) % rad, ci); else b.idx.push(ring + (j + 1) % rad, ring + j, ci);
      }
    };
    cap(0, -1); cap(n - 1, 1);
    return P;
  }
  /* point at fraction t along a returned centre-line */
  const _on = (P, t) => P && P.length ? P[Math.max(0, Math.min(P.length - 1, Math.round(t * (P.length - 1))))].clone() : null;

  /* ═══════════════════ RIG: bones, digits, frames ═══════════════════ */
  const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
  const FINGERS = ['thumb', 'index finger', 'middle finger', 'ring finger', 'little finger'];
  const TOES = ['big toe', 'second toe', 'third toe', 'fourth toe', 'little toe'];
  const _rigCache = {};
  const _B = (re, max) => _partPts(GHOST_SYS, re, max || 1500);

  /* bone axis, oriented so `a` is the end nearest `ref` (proximal) */
  function _axisRef(pts, ref) {
    const ax = _axis(pts); if (!ax) return null;
    if (ref && ax.a.distanceTo(ref) > ax.b.distanceTo(ref)) { const t = ax.a; ax.a = ax.b; ax.b = t; ax.dir.negate(); }
    return ax;
  }
  const _ptOn = (ax, t) => ax.a.clone().addScaledVector(ax.dir, ax.len * t);

  /* dominant / second principal directions → plane normal (power iteration) */
  function _plane(pts) {
    const c = _centroid(pts);
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    for (const p of pts) { const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z; xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z; }
    const mul = (M, v) => _V(M[0] * v.x + M[1] * v.y + M[2] * v.z, M[1] * v.x + M[3] * v.y + M[4] * v.z, M[2] * v.x + M[4] * v.y + M[5] * v.z);
    const M = [xx, xy, xz, yy, yz, zz];
    let v1 = _V(0.3, 1, 0.2).normalize(); for (let i = 0; i < 40; i++) v1 = mul(M, v1).normalize();
    const l1 = mul(M, v1).dot(v1);
    const M2 = [xx - l1 * v1.x * v1.x, xy - l1 * v1.x * v1.y, xz - l1 * v1.x * v1.z, yy - l1 * v1.y * v1.y, yz - l1 * v1.y * v1.z, zz - l1 * v1.z * v1.z];
    let v2 = _V(1, 0.1, 0.4).normalize(); for (let i = 0; i < 40; i++) { v2 = mul(M2, v2); v2.sub(v1.clone().multiplyScalar(v2.dot(v1))).normalize(); }
    return { c, n: v1.clone().cross(v2).normalize(), v1, v2 };
  }

  /* Hand / foot: every digit as a chain of real bones (metacarpal/metatarsal +
     phalanges) with joint centres, mean bone radius, and the palmar/plantar
     normal of the whole hand/foot plane. */
  function _digits(side, foot, ref) {
    const id = side + (foot ? 'F' : 'H');
    if (_rigCache[id]) return _rigCache[id];
    const meta = foot ? 'metatarsal' : 'metacarpal';
    const names = foot ? TOES : FINGERS;
    const planePts = [];
    const digits = names.map((nm, i) => {
      const mp = _B(new RegExp('^' + side + ' ' + ORD[i] + ' ' + meta + ' bone$', 'i'), 500);
      const mc = _axisRef(mp, ref); if (!mc) return null;
      if (i > 0) planePts.push(...mp);
      const bones = [mc];
      for (const ph of ['proximal', 'middle', 'distal']) {
        const pp = _B(new RegExp('^' + ph + ' phalanx of ' + side + ' ' + nm + '$', 'i'), 400);
        if (pp.length >= 8) bones.push(_axisRef(pp, ref));
      }
      if (bones.length < 3) return null;
      const joints = [mc.a.clone()];
      for (let k = 0; k < bones.length - 1; k++) joints.push(bones[k].b.clone().lerp(bones[k + 1].a, 0.5));
      joints.push(bones[bones.length - 1].b.clone());
      const r = bones.slice(1).reduce((s, b) => s + b.r, 0) / (bones.length - 1);
      return { i, nm, mc, bones, joints, r };
    });
    if (!digits[0] || planePts.length < 30) return (_rigCache[id] = null);
    const pl = _plane(planePts);
    let n = pl.n;
    if (foot) { if (n.y > 0) n.negate(); }                                 // plantar = down
    else if (n.dot(digits[0].mc.c.clone().sub(pl.c)) < 0) n.negate();       // thenar lies palmar to the palm plane
    const mid = digits[2] || digits[1];
    /* the side vector s = dir × n is globally consistent; which sign points to digit 1 (thumb / big toe)? */
    const s0 = mid.mc.dir.clone().cross(n).normalize();
    const sThumb = Math.sign(s0.dot(digits[0].mc.c.clone().sub(mid.mc.c))) || 1;
    return (_rigCache[id] = { digits, n, foot, sThumb, c: pl.c });
  }
  /* frame on digit d at joint k: dir along the digit, p palmar/plantar, s side */
  function _dFrame(d, k, n) {
    const J = d.joints, k0 = Math.max(0, Math.min(J.length - 2, k));
    const dir = J[k0 + 1].clone().sub(J[k0]).normalize();
    const p = n.clone().sub(dir.clone().multiplyScalar(n.dot(dir))).normalize();
    return { dir, p, s: dir.clone().cross(p).normalize() };
  }
  /* point near joint k of digit d (k may be fractional), offset sideways / palmar */
  function _dPt(d, k, n, lat, pal, along) {
    const J = d.joints, k0 = Math.floor(Math.min(J.length - 1, Math.max(0, k))), f = Math.min(J.length - 1, Math.max(0, k)) - k0;
    const P = f > 0 && k0 + 1 < J.length ? J[k0].clone().lerp(J[k0 + 1], f) : J[k0].clone();
    const F = _dFrame(d, k0, n);
    return P.addScaledVector(F.s, lat).addScaledVector(F.p, pal).addScaledVector(F.dir, along || 0);
  }
  /* point on a metacarpal/metatarsal at t, offset palmar & sideways */
  function _mPt(d, t, n, pal, lat) {
    const p = n.clone().sub(d.mc.dir.clone().multiplyScalar(n.dot(d.mc.dir))).normalize();
    const s = d.mc.dir.clone().cross(p).normalize();
    return _ptOn(d.mc, t).addScaledVector(p, pal).addScaledVector(s, lat || 0);
  }

  function _limbRig(sx) {
    const id = 'L' + sx; if (_rigCache[id]) return _rigCache[id];
    const side = sx < 0 ? 'right' : 'left';
    const S = '^' + side + ' ';
    const hum = _axis(_B(new RegExp(S + 'humerus$', 'i')));
    const rad = _axis(_B(new RegExp(S + 'radius$', 'i')));
    const uln = _axis(_B(new RegExp(S + 'ulna$', 'i')));
    const fem = _axis(_B(new RegExp(S + 'femur$', 'i')));
    const tib = _axis(_B(new RegExp(S + 'tibia$', 'i')));
    const fib = _axis(_B(new RegExp(S + 'fibula$', 'i')));
    const rig = { sx, side, hum, rad, uln, fem, tib, fib };
    if (rad) rig.hand = _digits(side, false, rad.b);
    if (tib) rig.foot = _digits(side, true, tib.b);
    return (_rigCache[id] = rig);
  }

  /* Forearm / lower-leg frame: centre between the two bones at t, `lat`
     toward bone A (radius / fibula), `ant` toward `front` (palm / +Z). */
  function _pairFrame(A, Bn, front) {
    return (t, lat, ant) => {
      const pa = _ptOn(A, t), pb = _ptOn(Bn, t), c = pa.clone().lerp(pb, 0.5);
      const ax = A.dir.clone().add(Bn.dir).normalize();
      const L = pa.clone().sub(pb); L.sub(ax.clone().multiplyScalar(L.dot(ax))).normalize();
      const F = front.clone().sub(ax.clone().multiplyScalar(front.dot(ax))); F.sub(L.clone().multiplyScalar(F.dot(L))).normalize();
      return c.addScaledVector(L, lat).addScaledVector(F, ant);
    };
  }

  /* ═════════════════════ PROCEDURAL: VESSELS ═══════════════════════ */
  const _augmented = new Set();

  function _vesselMat(kind) {
    return new THREE.MeshPhysicalMaterial({ color: kind === 'V' ? REAL.veias : REAL.arterias, roughness: 0.34,
      clearcoat: 0.8, clearcoatRoughness: 0.25, envMapIntensity: 0.8 });
  }
  /* two companion veins either side of an artery (venae comitantes) */
  function _beside(P, off) {
    if (!P || P.length < 2) return [null, null];
    const L = [], R = [];
    for (let i = 0; i < P.length; i += Math.max(1, Math.floor(P.length / 14))) {
      const t = P[Math.min(P.length - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize();
      let s = t.clone().cross(_V(0, 0, 1)); if (s.lengthSq() < 0.05) s = t.clone().cross(_V(1, 0, 0)); s.normalize();
      L.push(P[i].clone().addScaledVector(s, off)); R.push(P[i].clone().addScaledVector(s, -off));
    }
    const e = P[P.length - 1];
    return [[...L, e.clone()], [...R, e.clone()]];
  }

  function _addVessels(grp) {
    if (!_sysGroup[GHOST_SYS]) return;
    const T = _builder('circulatorio');
    const C = 'circulatorio';
    const A = (key, pts, r0, r1, o) => T.tube(key, 'A', pts, r0, r1, o);
    const Vn = (key, pts, r0, r1, o) => T.tube(key, 'V', pts, r0, r1, o);
    const real = re => _partPts(C, re, 2500);

    for (const sx of [-1, 1]) {
      const R = _limbRig(sx), side = R.side;
      const ends = {};
      if (R.hum && R.rad && R.uln) _armVessels(A, Vn, R, sx, real, ends);
      if (R.hand && ends.wristR) _handVessels(A, Vn, R, sx, ends);
      if (R.fem && R.tib && R.fib) _legVessels(A, Vn, R, sx, real, ends);
      if (R.foot && ends.ankleA) _footVessels(A, Vn, R, sx, ends);
      _headVessels(A, Vn, sx, side, real);
    }
    _brainVessels(A, Vn, real);
    _trunkVessels(A, Vn, real);
    T.flush(grp, (key, kind) => _vesselMat(kind));
  }

  /* ── ARM: axillary → brachial → radial / ulnar / interosseous; deep
        companion veins; cephalic, basilic, median cubital & antebrachial ── */
  function _armVessels(A, Vn, R, sx, real, ends) {
    const K = 'vasos_bracos', side = R.side, h = R.hum, ra = R.rad, ul = R.uln;
    const out = p => Math.abs(p.x);
    const subA = real(new RegExp('^' + side + ' subclavian artery$', 'i'));
    const subV = real(new RegExp('^' + side + ' subclavian vein$', 'i'));
    const palm = R.hand ? R.hand.n : _V(0, 0, 1);
    const fa = _pairFrame(ra, ul, palm);
    const at = (t, om, of) => _at(h, t, sx, om, of);

    const a0 = subA.length ? _argmax(subA, out) : at(-0.05, 0.4, 0.15);
    const axil = A(K, [a0, a0.clone().lerp(at(0.04, 0.3, 0.05), 0.5).add(_V(0, -0.05, 0)), at(0.05, 0.27, 0.04), at(0.12, 0.2, 0.06)], 0.034, 0.03);
    const brach = A(K, [at(0.12, 0.2, 0.06), at(0.35, 0.17, 0.07), at(0.6, 0.14, 0.08), at(0.85, 0.08, 0.12), at(1.0, 0.02, 0.15)], 0.03, 0.026);
    /* branches of the axillary: circumflex humeral ring, lateral thoracic, subscapular → thoracodorsal */
    const ax1 = _on(axil, 0.75);
    A(K, [ax1, ..._arc(h, 0.09, 0.08, sx, 0.17, 130, 290, 6)], 0.011, 0.007);    // posterior circumflex humeral
    A(K, [ax1, ..._arc(h, 0.08, 0.07, sx, 0.16, 60, -80, 5)], 0.009, 0.006);       // anterior circumflex humeral
    const ax0 = _on(axil, 0.45);
    A(K, [ax0, ax0.clone().add(_V(-sx * 0.12, -0.35, 0.12)), ax0.clone().add(_V(-sx * 0.15, -1.0, 0.18)), ax0.clone().add(_V(-sx * 0.12, -1.6, 0.18))], 0.012, 0.006);
    const scap = _B(new RegExp('^' + side + ' scapula$', 'i'), 800);
    if (scap.length) {
      const inf = _argmax(scap, p => -p.y), lat = scap.filter(p => p.y > inf.y + 0.2 && p.y < inf.y + 0.8);
      const latB = lat.length ? _argmax(lat, p => Math.abs(p.x)) : inf;
      A(K, [_on(axil, 0.9), latB.clone().add(_V(0, 0.15, 0.08)), latB.clone().add(_V(0, -0.1, 0.06)), inf.clone().add(_V(0, 0.05, 0.05))], 0.014, 0.007);
    }
    /* deep brachial: spirals behind the humerus with the radial nerve */
    A(K, [_on(brach, 0.12), at(0.3, 0.06, -0.15), at(0.55, -0.12, -0.13), at(0.8, -0.16, 0.02), at(0.95, -0.12, 0.1)], 0.014, 0.008);
    /* forearm */
    const fossa = _on(brach, 1);
    const radial = A(K, [fossa, fa(0.08, 0.06, 0.1), fa(0.3, 0.09, 0.1), fa(0.6, 0.1, 0.1), fa(0.97, 0.1, 0.09)], 0.022, 0.016);
    const ulnar = A(K, [fossa, fa(0.1, -0.03, 0.09), fa(0.3, -0.08, 0.08), fa(0.6, -0.09, 0.08), fa(0.97, -0.08, 0.08)], 0.023, 0.017);
    const ci = _on(ulnar, 0.12);
    A(K, [ci, fa(0.2, 0.0, 0.03), fa(0.5, 0.0, 0.025), fa(0.85, 0.0, 0.025)], 0.01, 0.006);      // anterior interosseous
    A(K, [ci, fa(0.18, 0.0, -0.06), fa(0.5, 0.0, -0.06), fa(0.85, 0.01, -0.05)], 0.01, 0.006);   // posterior interosseous
    A(K, [_on(radial, 0.08), at(0.92, -0.14, 0.06), at(0.85, -0.16, 0.0)], 0.008, 0.005);         // radial recurrent
    A(K, [_on(ulnar, 0.1), at(0.95, 0.14, -0.02), at(0.86, 0.17, -0.06)], 0.008, 0.005);           // ulnar recurrent
    ends.wristR = _on(radial, 1); ends.wristU = _on(ulnar, 1); ends.fa = fa;

    /* deep veins: paired brachial / radial / ulnar, axillary into the real subclavian */
    const v0 = subV.length ? _argmax(subV, out) : null;
    for (const P of [brach, radial, ulnar]) { const [l, r] = _beside(P, 0.028); Vn(K, l, 0.012, 0.009); Vn(K, r, 0.012, 0.009); }
    const axV = Vn(K, [at(0.14, 0.27, 0.0), at(0.06, 0.32, 0.0), v0 ? v0.clone().lerp(at(0.04, 0.32, 0.05), 0.5) : null, v0], 0.036, 0.04);
    ends.axV = axV;
    /* superficial veins, just under the skin */
    const U = (t, om, of) => _under(at(t, om, of), 0.022);
    const F = (t, lat, ant) => _under(fa(t, lat, ant), 0.022);
    /* cephalic: thumb side of the wrist → front of the forearm → lateral arm → deltopectoral groove;
       basilic: little-finger side → medial forearm → pierces the fascia mid-arm → axillary vein */
    ends.ceph = F(0.97, 0.13, -0.03); ends.bas = F(0.97, -0.12, -0.04);
    ends.cephArm = [ends.ceph, F(0.8, 0.15, 0.0), F(0.55, 0.16, 0.06), F(0.3, 0.15, 0.1), F(0.15, 0.14, 0.12), U(0.95, -0.14, 0.14), U(0.7, -0.17, 0.12), U(0.4, -0.15, 0.12), U(0.12, 0.02, 0.24), _on(axV, 0.75)];
    ends.basArm = [ends.bas, F(0.8, -0.14, -0.04), F(0.55, -0.15, 0.02), F(0.3, -0.14, 0.06), F(0.12, -0.13, 0.08), U(0.95, 0.17, 0.06), U(0.7, 0.2, 0.03), at(0.5, 0.2, 0.0), at(0.25, 0.25, 0.01), _on(axV, 0.05)];
    Vn(K, ends.cephArm, 0.02, 0.026);
    Vn(K, ends.basArm, 0.022, 0.03);
    Vn(K, [F(0.06, 0.13, 0.12), F(0.0, 0.05, 0.13), U(0.93, 0.12, 0.1), U(0.9, 0.17, 0.06)], 0.016, 0.018);   // median cubital
    Vn(K, [F(0.92, 0.0, 0.11), F(0.6, 0.0, 0.12), F(0.3, 0.01, 0.12), F(0.05, 0.03, 0.13)], 0.011, 0.014);   // median antebrachial
  }

  /* ── HAND: superficial + deep palmar arches, common & proper palmar digital
        arteries along BOTH sides of every finger (pulp loop at the tip),
        palmar digital veins, dorsal digital & metacarpal veins → dorsal
        venous network → cephalic (thumb side) and basilic (little-finger side) ── */
  function _handVessels(A, Vn, R, sx, ends) {
    const K = 'vasos_maos', H = R.hand, n = H.n, D = H.digits, fa = ends.fa;
    if (D.filter(Boolean).length < 5) return;
    const sT = H.sThumb;
    const pr = d => d.mc.r;
    /* palm landmarks */
    const sup = t => [4, 3, 2, 1].map(i => _mPt(D[i], t, n, pr(D[i]) + 0.1));
    const supArch = A(K, [ends.wristU, _mPt(D[4], -0.12, n, pr(D[4]) + 0.08, -sT * 0.04), ...sup(0.45), _mPt(D[1], 0.25, n, pr(D[1]) + 0.1, sT * 0.08), _mPt(D[0], 0.45, n, pr(D[0]) + 0.05)], 0.011, 0.009);
    A(K, [ends.wristR, _mPt(D[0], 0.1, n, pr(D[0]) + 0.07), _mPt(D[0], 0.45, n, pr(D[0]) + 0.05)], 0.007, 0.006);   // superficial palmar branch of radial
    /* radial artery → anatomical snuffbox (dorsal) → between 1st & 2nd metacarpals → deep arch */
    const snuff = _mPt(D[0], -0.15, n, -(pr(D[0]) + 0.05), -sT * 0.02);
    const pierce = _ptOn(D[0].mc, 0.12).lerp(_ptOn(D[1].mc, 0.08), 0.5);
    const deepArch = A(K, [ends.wristR, ends.wristR.clone().lerp(snuff, 0.6), snuff, pierce, _mPt(D[1], 0.1, n, pr(D[1]) + 0.035),
      _mPt(D[2], 0.08, n, pr(D[2]) + 0.035), _mPt(D[3], 0.08, n, pr(D[3]) + 0.035), _mPt(D[4], 0.1, n, pr(D[4]) + 0.035)], 0.011, 0.008);
    A(K, [_on(supArch, 0.12), _mPt(D[4], 0.05, n, pr(D[4]) + 0.05), _mPt(D[4], 0.1, n, pr(D[4]) + 0.035)], 0.006, 0.006);   // deep branch of ulnar closes the deep arch

    const tipPt = d => _dPt(d, d.joints.length - 1, n, 0, d.r * 0.7, -d.r * 0.25);
    const propA = (d, sg, src) => {
      const J = d.joints, pts = [src];
      for (let k = 1; k < J.length - 1; k++) pts.push(_dPt(d, k + 0.5, n, sg * (d.r * 1.25 + 0.006), d.r * 0.55));
      pts.push(tipPt(d));
      return A(K, pts, 0.0072, 0.0045, { inset: 0.003 });
    };
    const propV = (d, sg, dst) => {
      const J = d.joints, pts = [tipPt(d).addScaledVector(n, 0.004)];
      for (let k = J.length - 2; k >= 1; k--) pts.push(_dPt(d, k + 0.5, n, sg * (d.r * 0.9 + 0.004), d.r * 0.85));
      pts.push(dst);
      Vn(K, pts, 0.0035, 0.005, { inset: 0.003 });
    };
    /* dorsal digital veins, under the skin of the back of each finger */
    const dorsV = (d, sg, dst) => {
      const J = d.joints, pts = [];
      for (let k = J.length - 2; k >= 1; k--) pts.push(_under(_dPt(d, k + (k === J.length - 2 ? 0.6 : 0.4), n, sg * d.r * 0.75, -d.r * 1.6), 0.009));
      pts.push(dst);
      Vn(K, pts, 0.0045, 0.0065, { inset: 0.003 });
    };
    /* the side of digit i facing its neighbour j */
    const facing = (i, j) => Math.sign(_dFrame(D[i], 1, n).s.dot(D[j].mc.b.clone().sub(D[i].mc.b))) || 1;
    const webPal = (i, j) => D[i].mc.b.clone().lerp(D[j].mc.b, 0.5).addScaledVector(n, (pr(D[i]) + pr(D[j])) / 2 + 0.045).addScaledVector(D[i].mc.dir, 0.07);
    const webDor = (i, j) => _under(D[i].mc.b.clone().lerp(D[j].mc.b, 0.5).addScaledVector(n, -0.12).addScaledVector(D[i].mc.dir, 0.06), 0.012);
    const dorsArchPt = i => _under(_mPt(D[i], 0.45, n, -(pr(D[i]) + 0.1)), 0.014);

    /* dorsal venous network (arch across the back of the hand) */
    const arch = [ends.bas, _under(_mPt(D[4], 0.1, n, -(pr(D[4]) + 0.08), -sT * 0.06), 0.014), dorsArchPt(4), dorsArchPt(3), dorsArchPt(2), dorsArchPt(1),
      _under(_mPt(D[0], 0.35, n, -(pr(D[0]) + 0.06), sT * 0.03), 0.014), _under(snuff, 0.014), ends.ceph];
    const archP = Vn(K, arch, 0.009, 0.009);

    /* webs between fingers 2–5: common palmar digital artery, metacarpal veins */
    for (let i = 1; i <= 3; i++) {
      const j = i + 1, w = webPal(i, j);
      A(K, [_on(supArch, 0.32 + (3 - i) * 0.17), _mPt(D[i], 0.75, n, pr(D[i]) + 0.08, -sT * 0.05), w], 0.0085, 0.008);
      A(K, [_mPt(D[i], 0.12, n, pr(D[i]) + 0.035, -sT * 0.05), _mPt(D[i], 0.6, n, pr(D[i]) + 0.035, -sT * 0.06), w], 0.0055, 0.005);   // palmar metacarpal
      const wd = webDor(i, j);
      Vn(K, [wd, _under(_mPt(D[i], 0.75, n, -(pr(D[i]) + 0.08), -sT * 0.05), 0.013), _on(archP, 0.3 + (3 - i) * 0.12)], 0.006, 0.008);
      Vn(K, [w.clone().addScaledVector(n, 0.004), _ptOn(D[i].mc, 1.02).lerp(_ptOn(D[j].mc, 1.02), 0.5), wd], 0.004, 0.0045);   // intercapitular vein
      for (const [d, o] of [[D[i], j], [D[j], i]]) {
        const sg = facing(d.i, o);
        propA(d, sg, w); propV(d, sg, w); dorsV(d, sg, wd);
      }
    }
    /* borders: index (thumb side) from the deep arch, little finger (ulnar side) from the superficial arch */
    const ri = _mPt(D[1], 0.55, n, pr(D[1]) + 0.05, sT * 0.07);
    A(K, [_on(deepArch, 0.42), ri], 0.0065, 0.006);
    propA(D[1], sT, ri); propV(D[1], sT, ri);
    dorsV(D[1], sT, _on(archP, 0.62));
    const ul = _mPt(D[4], 0.8, n, pr(D[4]) + 0.06, -sT * 0.07);
    A(K, [_on(supArch, 0.05), _mPt(D[4], 0.4, n, pr(D[4]) + 0.08, -sT * 0.07), ul], 0.0068, 0.006);
    propA(D[4], -sT, ul); propV(D[4], -sT, ul);
    dorsV(D[4], -sT, _on(archP, 0.18));
    /* thumb: princeps pollicis from the deep arch, both sides */
    const pp = A(K, [_on(deepArch, 0.36), _mPt(D[0], 0.4, n, pr(D[0]) + 0.04), _mPt(D[0], 0.9, n, pr(D[0]) + 0.05)], 0.0085, 0.0075);
    const ppEnd = _on(pp, 1);
    for (const sg of [-1, 1]) { propA(D[0], sg, ppEnd); propV(D[0], sg, ppEnd); dorsV(D[0], sg, _on(archP, 0.82)); }
  }

  /* ── LEG: femoral → popliteal → anterior/posterior tibial & fibular, deep
        femoral with circumflex and perforating branches, genicular ring,
        gluteal arteries; paired deep veins; great & small saphenous ── */
  function _legVessels(A, Vn, R, sx, real, ends) {
    const K = 'vasos_pernas', side = R.side, fm = R.fem, tb = R.tib, fb = R.fib;
    const at = (t, om, of) => _at(fm, t, sx, om, of);
    const bt = (t, om, of) => _at(tb, t, sx, om, of);
    const lg = _pairFrame(fb, tb, _V(0, 0, 1));                   // lat + → fibula (lateral)
    const ilA = real(new RegExp('^' + side + ' external iliac artery$', 'i'));
    const ilV = real(new RegExp('^' + side + ' external iliac vein$', 'i'));
    const iiA = real(new RegExp('^' + side + ' internal iliac artery$', 'i'));
    const a0 = ilA.length ? _argmax(ilA, p => -p.y) : at(0, 0.3, 0.25);
    const fem = A(K, [a0, at(0.06, 0.25, 0.25), at(0.2, 0.24, 0.2), at(0.4, 0.22, 0.1), at(0.6, 0.19, 0.0), at(0.75, 0.15, -0.08), at(0.9, 0.06, -0.16), at(1.0, 0.0, -0.18)], 0.04, 0.034);
    const pop = A(K, [_on(fem, 1), bt(0.04, 0.0, -0.17), bt(0.1, 0.0, -0.15)], 0.034, 0.032);
    const bif = _on(pop, 1);
    const prof = A(K, [_on(fem, 0.1), at(0.15, 0.2, 0.06), at(0.35, 0.12, -0.08), at(0.6, 0.08, -0.12), at(0.78, 0.05, -0.14)], 0.026, 0.012);
    const pf0 = _on(prof, 0.08);
    const lcf = A(K, [pf0, ..._arc(fm, 0.12, 0.13, sx, 0.22, 30, -70, 4)], 0.014, 0.011);
    A(K, [_on(lcf, 1), at(0.05, -0.24, 0.06), at(-0.02, -0.2, 0.0)], 0.009, 0.006);                 // ascending
    A(K, [_on(lcf, 1), at(0.3, -0.26, 0.1), at(0.6, -0.26, 0.05), at(0.88, -0.2, 0.03)], 0.011, 0.006);   // descending
    A(K, [pf0, ..._arc(fm, 0.1, 0.05, sx, 0.22, 90, 230, 6)], 0.012, 0.007);                       // medial circumflex
    for (const t of [0.35, 0.5, 0.65]) A(K, [_on(prof, (t - 0.12) / 0.66), ..._arc(fm, t, t + 0.03, sx, 0.2, 150, 260, 5)], 0.009, 0.006);   // perforating
    /* knee: descending + 4 genicular arteries */
    A(K, [_on(fem, 0.78), at(0.88, 0.2, 0.05), at(0.97, 0.16, 0.12), bt(0.04, 0.1, 0.14)], 0.0075, 0.005);
    const popM = _on(pop, 0.2), popL = _on(pop, 0.8);
    A(K, [popM, ..._arc(fm, 0.93, 0.95, sx, 0.2, 170, 40, 6)], 0.0075, 0.005);       // superior medial genicular
    A(K, [popM, ..._arc(fm, 0.93, 0.95, sx, 0.2, 190, 320, 6)], 0.0075, 0.005);      // superior lateral genicular
    A(K, [popL, ..._arc(tb, 0.07, 0.06, sx, 0.2, 170, 45, 6)], 0.0075, 0.005);       // inferior medial genicular
    A(K, [popL, ..._arc(tb, 0.04, 0.03, sx, 0.22, 190, 315, 6)], 0.0075, 0.005);     // inferior lateral genicular
    /* below the knee */
    const antTib = A(K, [bif, lg(0.12, 0.02, -0.02), lg(0.16, 0.0, 0.07), lg(0.4, -0.01, 0.09), lg(0.7, -0.02, 0.1), lg(0.97, -0.08, 0.15)], 0.02, 0.016);
    const postTib = A(K, [bif, lg(0.15, -0.06, -0.12), lg(0.5, -0.1, -0.12), lg(0.85, -0.14, -0.1), bt(0.99, 0.17, -0.08)], 0.022, 0.016);
    A(K, [_on(postTib, 0.12), lg(0.25, 0.08, -0.1), lg(0.6, 0.11, -0.08), lg(0.95, 0.13, -0.06)], 0.014, 0.009);   // fibular
    /* gluteal arteries from the real internal iliac, out through the sciatic notch */
    if (iiA.length) {
      const ii = _argmax(iiA, p => -p.y);
      A(K, [ii, at(-0.12, 0.3, -0.38), at(-0.15, 0.05, -0.5), at(-0.2, -0.22, -0.42)], 0.016, 0.008);
      A(K, [ii, at(-0.02, 0.28, -0.4), at(0.06, 0.05, -0.55), at(0.12, -0.18, -0.48)], 0.014, 0.007);
      A(K, [ii, at(-0.05, 0.4, -0.1), at(0.04, 0.38, 0.02)], 0.009, 0.006);                     // obturator
    }
    ends.ankleA = _on(antTib, 1); ends.ankleP = _on(postTib, 1); ends.lg = lg;

    /* deep veins */
    const v0 = ilV.length ? _argmax(ilV, p => -p.y) : null;
    const femV = Vn(K, [v0, at(0.06, 0.34, 0.2), at(0.2, 0.31, 0.13), at(0.4, 0.28, 0.04), at(0.6, 0.24, -0.06), at(0.75, 0.2, -0.13), at(0.9, 0.1, -0.2), at(1.0, 0.04, -0.23), bt(0.08, 0.04, -0.21)], 0.045, 0.034);
    Vn(K, [_on(femV, 0.12), at(0.2, 0.14, -0.03), at(0.45, 0.1, -0.15), at(0.7, 0.08, -0.17)], 0.022, 0.012);   // deep femoral vein
    for (const P of [antTib, postTib]) { const [l, r] = _beside(P.slice(Math.floor(P.length * 0.1)), 0.026); Vn(K, l, 0.012, 0.009); Vn(K, r, 0.012, 0.009); }
    ends.popV = _on(femV, 0.97); ends.femV = femV;
    /* great saphenous: in front of the medial malleolus → inner leg → behind the knee → saphenous opening */
    const UB = (t, om, of) => _under(bt(t, om, of), 0.024), UF = (t, om, of) => _under(at(t, om, of), 0.026);
    ends.gsLeg = [UB(0.97, 0.25, 0.22), UB(0.75, 0.5, 0.05), UB(0.45, 0.55, -0.05), UB(0.12, 0.5, -0.15), UF(0.92, 0.5, -0.15),
      UF(0.65, 0.5, 0.0), UF(0.35, 0.42, 0.14), UF(0.12, 0.3, 0.26), _on(femV, 0.1)];
    Vn(K, ends.gsLeg, 0.02, 0.028);
    /* small saphenous: behind the lateral malleolus → middle of the calf → popliteal vein */
    ends.ssLeg = [_under(lg(0.98, 0.18, -0.12), 0.024), _under(lg(0.75, 0.1, -0.5), 0.024), _under(lg(0.45, 0.0, -0.6), 0.026), _under(lg(0.18, -0.02, -0.55), 0.03), bt(0.03, 0.02, -0.23), _on(femV, 0.93)];
    Vn(K, ends.ssLeg, 0.016, 0.02);
  }

  /* ── FOOT: dorsalis pedis + arcuate → dorsal metatarsal & digital arteries;
        posterior tibial → medial / lateral plantar → plantar arch →
        plantar digital arteries on both sides of every toe; dorsal venous
        arch → great (medial) and small (lateral) saphenous ── */
  function _footVessels(A, Vn, R, sx, ends) {
    const K = 'vasos_pes', Fo = R.foot, n = Fo.n, D = Fo.digits, side = R.side;
    if (D.filter(Boolean).length < 5) return;
    const up = n.clone().negate();                                          // dorsal
    const sT = Fo.sThumb;
    const pr = d => d.mc.r;
    const top = (re, lift) => { const p = _B(re, 400); return p.length ? _argmax(p, q => q.dot(up)).clone().addScaledVector(up, lift) : null; };
    const tal = top(new RegExp('^' + side + ' talus$', 'i'), 0.04);
    const nav = top(new RegExp('^navicular bone of ' + side + ' foot$', 'i'), 0.04);
    const cun = top(new RegExp('^' + side + ' intermediate cuneiform bone$', 'i'), 0.04);
    const dorsM = (i, t, lat) => _mPt(D[i], t, n, -(pr(D[i]) + 0.04), lat || 0);
    const plantM = (i, t, lat, x) => _mPt(D[i], t, n, pr(D[i]) + (x || 0.06), lat || 0);
    /* dorsalis pedis to the 1st intermetatarsal space, then the deep plantar branch */
    const gap1 = (t, pal) => _ptOn(D[0].mc, t).lerp(_ptOn(D[1].mc, t), 0.5).addScaledVector(n, pal);
    const dp = A(K, [ends.ankleA, tal, nav, cun, gap1(0.08, -0.08)], 0.016, 0.013);
    A(K, [_on(dp, 1), gap1(0.12, 0.0), gap1(0.12, 0.1)], 0.01, 0.009);                         // deep plantar branch
    const arc = A(K, [_on(dp, 0.92), dorsM(1, 0.06), dorsM(2, 0.08), dorsM(3, 0.1), dorsM(4, 0.12)], 0.009, 0.006);
    /* plantar: posterior tibial divides under the medial malleolus */
    const calc = _B(new RegExp('^' + side + ' calcaneus$', 'i'), 500);
    const heelM = calc.length ? _argmax(calc, p => p.dot(n) * 0.6 + p.x * -sx * 0.4).clone().addScaledVector(n, 0.03) : ends.ankleP;
    const medP = A(K, [ends.ankleP, heelM, plantM(0, 0.2, sT * 0.04), plantM(0, 0.7, sT * 0.04)], 0.012, 0.008);
    const latP = A(K, [ends.ankleP, heelM.clone().lerp(plantM(4, 0.0, 0, 0.05), 0.4), plantM(4, 0.05, 0, 0.05)], 0.014, 0.011);
    const parch = A(K, [_on(latP, 1), plantM(3, 0.08, 0, 0.045), plantM(2, 0.08, 0, 0.045), plantM(1, 0.1, 0, 0.045), gap1(0.12, 0.1)], 0.011, 0.009);
    /* calcaneal branches + fibular end at the lateral heel */
    A(K, [ends.ankleP, heelM.clone().addScaledVector(n, 0.04).add(_V(0, 0, -0.12))], 0.007, 0.005);

    const tipPt = d => _dPt(d, d.joints.length - 1, n, 0, d.r * 0.6, -d.r * 0.2);
    const prop = (d, sg, src, plantar) => {
      const J = d.joints, pts = [src];
      for (let k = 1; k < J.length - 1; k++) pts.push(_dPt(d, k + 0.5, n, sg * (d.r * 1.2 + 0.005), plantar ? d.r * 0.55 : -d.r * 0.6));
      if (plantar) pts.push(tipPt(d));
      return A(K, pts, plantar ? 0.0068 : 0.0055, 0.004, { inset: 0.003 });
    };
    const dorsV = (d, sg, dst) => {
      const J = d.joints, pts = [];
      for (let k = J.length - 2; k >= 1; k--) pts.push(_under(_dPt(d, k + 0.5, n, sg * d.r * 0.7, -d.r * 1.5), 0.009));
      pts.push(dst);
      Vn(K, pts, 0.0045, 0.0065, { inset: 0.003 });
    };
    const plantV = (d, sg, dst) => {
      const J = d.joints, pts = [tipPt(d).addScaledVector(n, 0.004)];
      for (let k = J.length - 2; k >= 1; k--) pts.push(_dPt(d, k + 0.5, n, sg * (d.r * 0.85), d.r * 0.85));
      pts.push(dst);
      Vn(K, pts, 0.0035, 0.0048, { inset: 0.003 });
    };
    const facing = (i, j) => Math.sign(_dFrame(D[i], 1, n).s.dot(D[j].mc.b.clone().sub(D[i].mc.b))) || 1;
    const webD = (i, j) => D[i].mc.b.clone().lerp(D[j].mc.b, 0.5).addScaledVector(up, 0.06).addScaledVector(D[i].mc.dir, 0.06);
    const webP = (i, j) => D[i].mc.b.clone().lerp(D[j].mc.b, 0.5).addScaledVector(n, 0.07).addScaledVector(D[i].mc.dir, 0.06);
    /* dorsal venous arch over the metatarsals */
    const archPts = [_under(_mPt(D[0], 0.3, n, -0.05, sT * 0.12), 0.016), _under(dorsM(0, 0.6), 0.016), _under(dorsM(1, 0.65), 0.016),
      _under(dorsM(2, 0.65), 0.016), _under(dorsM(3, 0.62), 0.016), _under(dorsM(4, 0.55), 0.016), _under(_mPt(D[4], 0.2, n, -0.03, -sT * 0.12), 0.016)];
    const varch = Vn(K, archPts, 0.01, 0.01);
    const plArch = Vn(K, [_on(latP, 0.85), plantM(3, 0.12, 0, 0.06), plantM(2, 0.12, 0, 0.06), plantM(1, 0.14, 0, 0.06), plantM(0, 0.2, 0, 0.06), heelM.clone().addScaledVector(up, 0.03), ends.ankleP], 0.007, 0.009);
    for (let i = 0; i <= 3; i++) {
      const j = i + 1, wd = webD(i, j), wp = webP(i, j);
      const dm = A(K, [i === 0 ? _on(dp, 0.95) : _on(arc, 0.1 + (i - 1) * 0.3), dorsM(i, 0.6, -sT * 0.07 * (i === 0 ? -1 : 1)), wd], 0.0065, 0.006);
      const pm = A(K, [i === 0 ? _on(parch, 1) : _on(parch, 1 - i * 0.25), plantM(i, 0.6, -sT * 0.07, 0.06), wp], 0.0075, 0.0068);
      const vd = Vn(K, [_under(wd, 0.012), _under(dorsM(i, 0.8, -sT * 0.06), 0.013), _on(varch, 0.15 + i * 0.2)], 0.0055, 0.0075);
      for (const [d, o] of [[D[i], j], [D[j], i]]) {
        const sg = facing(d.i, o);
        prop(d, sg, _on(dm, 1), false);
        prop(d, sg, _on(pm, 1), true);
        dorsV(d, sg, _on(vd, 0));
        plantV(d, sg, wp.clone().addScaledVector(n, 0.01));
      }
      Vn(K, [wp.clone().addScaledVector(n, 0.01), plantM(i, 0.3, -sT * 0.07, 0.07), _on(plArch, 0.8 - i * 0.18)], 0.004, 0.006);
    }
    /* borders: big toe medial side (medial plantar), little toe lateral side (lateral plantar / arcuate) */
    prop(D[0], -facing(0, 1), _on(medP, 1), true);
    prop(D[0], -facing(0, 1), _on(dp, 0.95), false);
    dorsV(D[0], -facing(0, 1), _on(varch, 0.05));
    prop(D[4], -facing(4, 3), _on(latP, 1), true);
    prop(D[4], -facing(4, 3), _on(arc, 1), false);
    dorsV(D[4], -facing(4, 3), _on(varch, 0.95));
    /* marginal veins → saphenous veins */
    Vn(K, [_on(varch, 0), _under(_mPt(D[0], -0.25, n, -0.02, sT * 0.12), 0.018), ends.gsLeg ? ends.gsLeg[0] : null], 0.012, 0.018);
    Vn(K, [_on(varch, 1), _under(_mPt(D[4], -0.3, n, -0.0, -sT * 0.12), 0.018), ends.ssLeg ? ends.ssLeg[0] : null], 0.011, 0.015);
  }

  /* ── HEAD & NECK: external carotid branches (sup. thyroid, lingual, facial,
        occipital, post. auricular, maxillary → middle meningeal, superficial
        temporal), internal carotid up to the skull base & siphon, vertebral
        arteries through the cervical transverse foramina; jugular, facial,
        retromandibular, superficial temporal and anterior jugular veins ── */
  let _headCache = null;
  function _headRig() {
    if (_headCache) return _headCache;
    const vault = _B(/^(left |right )?(frontal|parietal|occipital) bone$/i, 4000);
    const skull = _B(/(frontal|parietal|temporal|occipital|sphenoid|ethmoid|zygomatic|maxilla|nasal bone|palatine)/i, 6000);
    const mand = _B(/^mandible$/i, 1500);
    if (vault.length < 50 || mand.length < 50) return (_headCache = null);
    const hc = _centroid(vault);
    /* inner table of the skull along direction d (nearest skull vertex inside a narrow cone) */
    const inner = (d, inset, from) => {
      d = d.clone().normalize();
      const o = from || hc;
      let best = Infinity; const q = new THREE.Vector3();
      for (const s of skull) { q.subVectors(s, o); const al = q.dot(d); if (al <= 0) continue; const pp = q.lengthSq() - al * al; if (pp < Math.pow(0.03 + al * 0.08, 2) && al < best) best = al; }
      return o.clone().addScaledVector(d, (isFinite(best) ? best : 0.8) - (inset || 0.03));
    };
    const surf = (d, depth) => _surfRay(hc, d, depth || 0.03);
    const per = sx => {
      const sm = mand.filter(p => p.x * sx > 0.05);
      const mc = _centroid(mand);
      const post = sm.filter(p => p.z < mc.z);
      const condyle = post.length ? _argmax(post, p => p.y) : _argmax(sm, p => p.y);
      const angle = _argmax(sm, p => -p.y - p.z * 0.9);
      const eam = condyle.clone().add(_V(sx * 0.04, 0.0, -0.13));          // external acoustic meatus, just behind the condyle
      return { condyle, angle, eam };
    };
    const chin = _argmax(mand, p => p.z - p.y * 0.2);
    const chinTop = _argmax(mand, p => p.z + p.y * 0.35);
    const nasal = _B(/nasal bone$/i, 300);
    const nasion = nasal.length ? _argmax(nasal, p => p.y) : hc.clone().add(_V(0, -0.2, 0.9));
    const sides = { '-1': per(-1), '1': per(1) };
    const eamY = (sides['-1'].eam.y + sides['1'].eam.y) / 2, eamZ = (sides['-1'].eam.z + sides['1'].eam.z) / 2;
    const sella = _V(0, eamY + 0.18, eamZ + 0.22);
    return (_headCache = { hc, inner, surf, sides, chin, chinTop, nasion, sella, mandC: _centroid(mand) });
  }

  /* centre of the transverse foramen (vertebral artery) of a cervical vertebra */
  function _transForamen(name, sx, canal) {
    const pts = _B(new RegExp('^' + name + '$', 'i'), 1500);
    if (pts.length < 40) return null;
    const c = _centroid(pts);
    const sl = pts.filter(p => Math.abs(p.y - c.y) < 0.05 && p.x * sx > 0.03);
    if (sl.length < 15) return null;
    const cz = canal ? canal.z : c.z;
    let best = null, bd = -1;
    for (let ix = 0; ix <= 12; ix++) for (let iz = 0; iz <= 12; iz++) {
      const x = sx * (0.08 + ix * 0.012), z = cz + 0.0 + iz * 0.02;
      let md = Infinity, q1 = 0, q2 = 0, q3 = 0, q4 = 0;
      for (const p of sl) {
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
        if (d < md) md = d;
        if (d < 0.1) { if (dx * sx > 0.01) q1 = 1; if (dx * sx < -0.01) q2 = 1; if (dz > 0.01) q3 = 1; if (dz < -0.01) q4 = 1; }
      }
      if (q1 && q2 && q3 && q4 && md > bd) { bd = md; best = _V(x, c.y, z); }
    }
    return best;
  }

  function _headVessels(A, Vn, sx, side, real) {
    const K = 'vasos_cabeca', H = _headRig(); if (!H) return;
    const S = H.sides[sx];
    const car = real(new RegExp('^' + side + ' common carotid artery$', 'i'));
    const jug = real(new RegExp('^' + side + ' internal jugular vein$', 'i'));
    const sub = real(new RegExp('^' + side + ' subclavian artery$', 'i'));
    const subV = real(new RegExp('^' + side + ' subclavian vein$', 'i'));
    if (!car.length) return;
    const ct = _argmax(car, p => p.y);
    const dir = (x, y, z) => _V(x * sx, y, z);
    /* internal carotid: up to the carotid canal, petrous bend, cavernous siphon */
    const canal = _V(sx * (Math.abs(S.eam.x) - 0.26), S.eam.y - 0.09, S.eam.z + 0.02);
    const sel = H.sella;
    const sip = _V(sx * 0.13, sel.y - 0.02, sel.z + 0.02);
    const ica = A(K, [ct, ct.clone().add(_V(sx * 0.02, 0.22, -0.06)), canal.clone().add(_V(0, -0.3, -0.02)), canal,
      canal.clone().lerp(sip, 0.5).add(_V(0, -0.02, 0)), sip, sip.clone().add(_V(0, 0.05, 0.12)), sip.clone().add(_V(-sx * 0.01, 0.13, 0.08)), sip.clone().add(_V(sx * 0.0, 0.14, -0.01))], 0.024, 0.018);
    /* ophthalmic artery: forward to the orbit */
    A(K, [_on(ica, 0.88), sip.clone().add(_V(sx * 0.06, 0.12, 0.35)), H.nasion.clone().add(_V(sx * 0.3, -0.12, -0.25))], 0.006, 0.004);
    /* external carotid and its branches */
    const ecaTop = S.condyle.clone().add(_V(0, -0.14, -0.02));
    const eca = A(K, [ct, ct.clone().add(_V(sx * 0.0, 0.14, 0.07)), S.angle.clone().lerp(ecaTop, 0.4).add(_V(-sx * 0.04, 0, -0.05)), ecaTop], 0.02, 0.016);
    const e = t => _on(eca, t);
    A(K, [e(0.05), ct.clone().add(_V(-sx * 0.08, -0.15, 0.12)), ct.clone().add(_V(-sx * 0.14, -0.33, 0.14))], 0.008, 0.005);           // superior thyroid
    A(K, [e(0.14), H.chin.clone().lerp(ct, 0.55).add(_V(sx * 0.12, 0.1, 0)), H.chinTop.clone().add(_V(sx * 0.07, 0.02, -0.25))], 0.009, 0.006);   // lingual
    const mouth = H.chinTop.clone().add(_V(sx * 0.24, 0.16, -0.12));
    const eyeIn = H.nasion.clone().add(_V(sx * 0.12, -0.08, -0.03));
    const fac = A(K, [e(0.22), S.angle.clone().lerp(H.chin, 0.25).add(_V(-sx * 0.05, 0.02, 0.02)), _under(S.angle.clone().lerp(H.chin, 0.42), 0.04),
      _under(mouth.clone().add(_V(sx * 0.03, -0.06, 0)), 0.04), _under(mouth, 0.04), _under(H.nasion.clone().add(_V(sx * 0.17, -0.38, 0)), 0.035), _under(eyeIn, 0.03)], 0.011, 0.006);
    A(K, [_on(fac, 0.66), _under(H.chinTop.clone().add(_V(0, 0.19, 0)), 0.035)], 0.006, 0.004);       // labial
    const H1 = H.hc;
    /* occipital + posterior auricular */
    A(K, [e(0.45), S.eam.clone().add(_V(-sx * 0.05, -0.18, -0.12)), H.surf(dir(0.6, -0.25, -0.8), 0.035), H.surf(dir(0.3, 0.25, -0.95), 0.035), H.surf(dir(0.15, 0.65, -0.7), 0.035)], 0.011, 0.005);
    A(K, [e(0.75), S.eam.clone().add(_V(sx * 0.02, -0.05, -0.1)), H.surf(dir(0.92, 0.25, -0.45), 0.035)], 0.007, 0.004);
    /* maxillary (deep) → middle meningeal onto the inner skull */
    const maxA = A(K, [e(1), S.condyle.clone().add(_V(-sx * 0.14, -0.09, 0.12)), S.condyle.clone().add(_V(-sx * 0.22, -0.1, 0.32)), S.condyle.clone().add(_V(-sx * 0.25, -0.14, 0.45))], 0.011, 0.007);
    const mm0 = _on(maxA, 0.3), fs = S.condyle.clone().add(_V(-sx * 0.15, 0.08, 0.06));
    const mm = A(K, [mm0, fs, H.inner(dir(1, 0.0, 0.25), 0.02)], 0.007, 0.006);
    A(K, [_on(mm, 1), H.inner(dir(0.95, 0.45, 0.35), 0.02), H.inner(dir(0.75, 0.85, 0.2), 0.02)], 0.006, 0.004);
    A(K, [_on(mm, 1), H.inner(dir(0.95, 0.35, -0.3), 0.02), H.inner(dir(0.75, 0.6, -0.6), 0.02)], 0.006, 0.004);
    /* superficial temporal: in front of the ear onto the scalp (frontal + parietal branches) */
    const st0 = S.eam.clone().add(_V(sx * 0.03, 0.02, 0.1));
    const st = A(K, [e(1), _under(st0, 0.035), H.surf(dir(1, 0.25, 0.05), 0.035), H.surf(dir(0.95, 0.5, 0.1), 0.035)], 0.011, 0.008);
    A(K, [_on(st, 1), H.surf(dir(0.75, 0.6, 0.55), 0.035), H.surf(dir(0.4, 0.55, 0.85), 0.035), H.surf(dir(0.15, 0.5, 0.95), 0.035)], 0.008, 0.004);
    A(K, [_on(st, 1), H.surf(dir(0.8, 0.85, -0.05), 0.035), H.surf(dir(0.45, 1, -0.25), 0.035)], 0.008, 0.004);

    /* vertebral artery through the transverse foramina C6 → C1, round the atlas, into the skull */
    const cord = _cordPath();
    const canalAt = y => cord && cord.length ? cord.reduce((m, p) => Math.abs(p.y - y) < Math.abs(m.y - y) ? p : m, cord[0]) : null;
    const levels = ['sixth cervical vertebra', 'fifth cervical vertebra', 'fourth cervical vertebra', 'third cervical vertebra', 'axis', 'atlas'];
    const fo = levels.map(l => { const pts = _B(new RegExp('^' + l + '$', 'i'), 300); if (!pts.length) return null; return _transForamen(l, sx, canalAt(_centroid(pts).y)); }).filter(Boolean);
    if (sub.length && fo.length >= 3) {
      const med = sub.filter(p => Math.abs(p.x) < Math.abs(fo[0].x) + 0.15);
      const v0 = med.length ? _argmax(med, p => p.y - Math.abs(p.x) * 0.5) : _argmax(sub, p => p.y);
      const at1 = fo[fo.length - 1];
      const fm = canalAt(at1.y + 0.1) || at1;
      const vert = A(K, [v0, fo[0].clone().add(_V(0, -0.25, 0.02)), ...fo, at1.clone().add(_V(-sx * 0.04, 0.04, -0.1)),
        _V(sx * 0.08, at1.y + 0.1, fm.z - 0.01), _V(sx * 0.05, at1.y + 0.22, fm.z + 0.08), _V(sx * 0.02, sel.y - 0.3, sel.z - 0.25)], 0.014, 0.012);
      _hv['vert' + sx] = _on(vert, 1);
    }
    /* veins: internal jugular is real; sigmoid sinus reaches its top */
    const jt = jug.length ? _argmax(jug, p => p.y) : null;
    const jf = S.eam.clone().add(_V(-sx * 0.12, -0.1, -0.08));
    Vn(K, [H.inner(dir(0.1, 0.05, -1), 0.03), H.inner(dir(0.55, 0.0, -0.85), 0.03), H.inner(dir(0.88, -0.05, -0.45), 0.03),
      S.eam.clone().add(_V(-sx * 0.12, 0.05, -0.2)), jf, jt], 0.016, 0.02, { free: true });
    /* external jugular: behind the mandible down the side of the neck to the subclavian vein */
    const svO = subV.length ? _argmax(subV, p => Math.abs(p.x)) : null;
    const rm = Vn(K, [_under(st0.clone().add(_V(0, 0.05, -0.02)), 0.04), S.condyle.clone().add(_V(0, -0.2, -0.05)), S.angle.clone().add(_V(0, 0.05, -0.04))], 0.011, 0.013);
    Vn(K, [_on(rm, 1), _under(S.angle.clone().add(_V(sx * 0.05, -0.15, -0.1)), 0.03), _under(ct.clone().lerp(svO || ct, 0.5).add(_V(sx * 0.15, 0, -0.05)), 0.03), svO], 0.012, 0.016);
    /* facial vein: medial eye corner → behind the facial artery → internal jugular */
    Vn(K, [_under(eyeIn.clone().add(_V(sx * 0.03, 0.02, 0)), 0.035), _under(H.nasion.clone().add(_V(sx * 0.21, -0.36, 0)), 0.04), _under(mouth.clone().add(_V(sx * 0.09, 0.0, -0.04)), 0.045),
      _under(S.angle.clone().lerp(H.chin, 0.38).add(_V(0, 0.02, -0.03)), 0.045), _on(rm, 1).lerp(ct, 0.4), jt ? jt.clone().lerp(ct, 0.5) : null], 0.008, 0.012);
    /* superficial temporal vein alongside the artery */
    Vn(K, [H.surf(dir(0.82, 0.62, 0.0), 0.04), H.surf(dir(1, 0.28, 0.0), 0.04), _under(st0.clone().add(_V(0, 0.02, -0.03)), 0.04), _on(rm, 0.05)], 0.007, 0.01);
    /* anterior jugular: down the front of the neck, near the midline */
    const sn = H.chin.clone().add(_V(sx * 0.1, -0.3, -0.35));
    Vn(K, [_under(sn, 0.03), _under(sn.clone().add(_V(sx * 0.02, -0.4, 0.05)), 0.03), _under(ct.clone().add(_V(-sx * 0.02, -0.35, 0.18)), 0.03), svO], 0.006, 0.008);
  }
  const _hv = {};                // anchors shared between head and brain vessels

  /* ── BRAIN: circle of Willis (carotid terminals + basilar from the two
        vertebrals), anterior / middle / posterior cerebral arteries, and the
        dural venous sinuses on the inner skull ── */
  function _brainVessels(A, Vn) {
    const K = 'vasos_cabeca', H = _headRig(); if (!H) return;
    const sel = H.sella, dir = (x, y, z) => _V(x, y, z);
    const bTop = _V(0, sel.y + 0.0, sel.z - 0.14), bBot = _V(0, sel.y - 0.3, sel.z - 0.24);
    A(K, [bBot, bBot.clone().lerp(bTop, 0.5).add(_V(0, 0, 0.02)), bTop], 0.014, 0.013, { free: true });       // basilar
    for (const sx of [-1, 1]) {
      const term = _V(sx * 0.13, sel.y + 0.12, sel.z - 0.01);
      /* middle cerebral: out along the lateral sulcus, branches over the hemisphere */
      const mca = A(K, [term, _V(sx * 0.3, sel.y + 0.15, sel.z + 0.02), _V(sx * 0.48, sel.y + 0.2, sel.z - 0.08)], 0.011, 0.009, { free: true });
      const m1 = _on(mca, 1);
      for (const [x, y, z] of [[0.85, 0.35, 0.45], [0.95, 0.55, 0.1], [0.9, 0.5, -0.35], [0.8, 0.15, -0.55]]) {
        const tgt = H.inner(dir(x * sx, y, z), 0.06);
        A(K, [m1, m1.clone().lerp(tgt, 0.5).add(_V(sx * 0.06, 0.04, 0)), tgt], 0.007, 0.003, { free: true });
      }
      /* anterior cerebral: forward to the midline, round the corpus callosum */
      const fwd = _V(sx * 0.03, sel.y + 0.16, sel.z + 0.2);
      A(K, [term, fwd, _V(sx * 0.03, sel.y + 0.45, sel.z + 0.38), H.inner(dir(sx * 0.03, 0.8, 0.45), 0.12).setX(sx * 0.03), H.inner(dir(sx * 0.03, 1, -0.15), 0.14).setX(sx * 0.03), H.inner(dir(sx * 0.03, 0.6, -0.8), 0.16).setX(sx * 0.03)], 0.009, 0.004, { free: true });
      /* posterior cerebral from the basilar top, back under the occipital lobe */
      const pca = A(K, [bTop, _V(sx * 0.12, bTop.y + 0.02, bTop.z - 0.02), _V(sx * 0.25, bTop.y + 0.08, bTop.z - 0.25), H.inner(dir(sx * 0.35, 0.05, -0.95), 0.1)], 0.01, 0.005, { free: true });
      A(K, [_on(pca, 0.2), term], 0.005, 0.005, { free: true });                                               // posterior communicating
      if (_hv['vert' + sx]) A(K, [_hv['vert' + sx], bBot], 0.012, 0.012, { free: true });
    }
    A(K, [_V(-0.03, sel.y + 0.16, sel.z + 0.2), _V(0.03, sel.y + 0.16, sel.z + 0.2)], 0.004, 0.004, { free: true });   // anterior communicating
    /* dural venous sinuses */
    const sag = [];
    for (let k = 0; k <= 10; k++) { const a = -0.15 + k / 10 * (Math.PI * 0.98); sag.push(H.inner(dir(0, Math.sin(a), Math.cos(a)), 0.035)); }
    const ssp = Vn(K, sag, 0.012, 0.024, { free: true });
    const conf = _on(ssp, 1);
    Vn(K, [conf, H.hc.clone().add(_V(0, 0.1, -0.35)), H.hc.clone().add(_V(0, 0.25, -0.05))], 0.012, 0.01, { free: true });               // straight sinus
    Vn(K, [H.hc.clone().add(_V(0, 0.25, -0.05)), H.hc.clone().add(_V(0, 0.42, 0.25)), H.hc.clone().add(_V(0, 0.42, 0.5))], 0.007, 0.005, { free: true });   // inferior sagittal
  }

  /* ── TRUNK: internal thoracic → superior epigastric ↔ inferior epigastric,
        musculophrenic; intercostal arteries/veins under ribs 2–11 joined to
        the real aorta behind and the internal thoracic in front; lumbar
        arteries; azygos & hemiazygos veins ── */
  function _trunkVessels(A, Vn, real) {
    const K = 'vasos_tronco';
    const aorta = real(/^descending aorta$/i);
    const ster = _B(/(manubrium|sternum|xiphoid)/i, 1500);
    const ribs = _ribPaths();
    const svc = real(/^superior vena cava$/i);
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'right' : 'left';
      const sub = real(new RegExp('^' + side + ' subclavian artery$', 'i'));
      const ilA = real(new RegExp('^' + side + ' external iliac artery$', 'i'));
      let itaEnd = null;
      if (ster.length && sub.length) {
        const yT = _argmax(ster, p => p.y).y, yB = _argmax(ster, p => -p.y).y;
        const lane = y => {
          const sl = ster.filter(p => Math.abs(p.y - y) < 0.12);
          const hw = sl.length ? Math.max(...sl.map(p => Math.abs(p.x))) : 0.2;
          const bz = sl.length ? Math.min(...sl.map(p => p.z)) : 0;
          return _V(sx * (hw + 0.12), y, bz - 0.02);
        };
        const s0 = _argmax(sub.filter(p => Math.abs(p.x) < 0.6), p => -p.y) || _argmax(sub, p => -p.y);
        const ita = [s0];
        for (let k = 0; k <= 6; k++) ita.push(lane(yT - 0.05 - (yT - yB) * k / 6 * 0.95));
        const itaP = A(K, ita, 0.012, 0.01);
        itaEnd = _on(itaP, 1);
        Vn(K, ita.map(p => p.clone().add(_V(sx * 0.035, 0, -0.01))), 0.011, 0.009);
        /* anterior intercostal branches to each rib's front */
        ribs.filter(r => r.side === side).forEach(r => {
          const fr = r.path[r.path.length - 1];
          const p = itaP.reduce((m, q) => Math.abs(q.y - fr.y) < Math.abs(m.y - fr.y) ? q : m, itaP[0]);
          A(K, [p, fr.clone().add(_V(0, -0.025, -0.01))], 0.006, 0.005);
        });
        /* musculophrenic along the costal margin */
        A(K, [itaEnd, itaEnd.clone().add(_V(sx * 0.35, -0.25, -0.05)), itaEnd.clone().add(_V(sx * 0.7, -0.6, -0.2)), itaEnd.clone().add(_V(sx * 0.9, -1.0, -0.4))], 0.008, 0.005);
      }
      /* epigastric: superior (from the internal thoracic) meets inferior (from the external iliac) in the rectus sheath */
      if (itaEnd && ilA.length) {
        const ie0 = _argmax(ilA, p => -p.y);
        const umb = _V(sx * 0.32, (itaEnd.y + ie0.y) / 2, 0);
        const ant = y => _surfRay(_V(sx * 0.32, y, -0.2), _V(0, 0, 1), 0.1);
        A(K, [itaEnd, ant(itaEnd.y - 0.3), ant(umb.y + 0.3), ant(umb.y)], 0.009, 0.006);
        A(K, [ie0, ie0.clone().add(_V(-sx * 0.08, 0.2, 0.1)), ant(ie0.y + 0.6), ant(umb.y - 0.3), ant(umb.y)], 0.01, 0.006);
        Vn(K, [ant(umb.y).add(_V(sx * 0.03, 0, 0)), ant(umb.y - 0.3).add(_V(sx * 0.03, 0, 0)), ant(ie0.y + 0.6).add(_V(sx * 0.03, 0, 0)), ie0.clone().add(_V(sx * 0.04, 0.05, 0))], 0.008, 0.01);
      }
    }
    /* intercostals: aorta (behind) → under each rib → front; veins → azygos / hemiazygos */
    const vb = _B(/^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (thoracic|lumbar) vertebra$/i, 6000);
    const bodyFront = y => { const sl = vb.filter(p => Math.abs(p.y - y) < 0.06 && Math.abs(p.x) < 0.25); return sl.length ? _argmax(sl, p => p.z).z : null; };
    const aAt = y => aorta.length ? aorta.reduce((m, p) => Math.abs(p.y - y) < Math.abs(m.y - y) ? p : m, aorta[0]) : null;
    ribs.forEach(r => {
      const sx = r.side === 'right' ? -1 : 1;
      const back = r.path[0];
      const ao = aAt(back.y - 0.05);
      A(K, [ao, ao ? _V(sx * 0.2, back.y - 0.04, ao.z - 0.08) : null, ...r.path.map(p => p.clone().add(_V(0, -0.03, 0)))], 0.009, 0.005);
      Vn(K, [...r.path.map(p => p.clone().add(_V(0, -0.012, -0.012))).reverse(), _V(sx * 0.13, back.y - 0.02, (bodyFront(back.y) || back.z) - 0.06)], 0.005, 0.009);
    });
    /* azygos (right of the vertebral bodies) arching over to the real SVC; hemiazygos crossing at T8 */
    if (vb.length) {
      const yTop = _argmax(vb, p => p.y).y;
      const lum = _B(/^first lumbar vertebra$/i, 300); const yBot = lum.length ? _centroid(lum).y : yTop - 3.4;
      const lane = (x, y) => { const z = bodyFront(y); return z != null ? _V(x, y, z - 0.06) : null; };
      const az = [];
      for (let k = 0; k <= 8; k++) az.push(lane(-0.13, yBot + (yTop - 0.85 - yBot) * k / 8));
      const svcB = svc.length ? _argmax(svc.filter(p => p.y < _centroid(svc).y + 0.1), p => -p.z) : null;
      const azP = Vn(K, [...az, svcB ? az[az.length - 1].clone().lerp(svcB, 0.5).add(_V(0, 0.15, 0)) : null, svcB], 0.016, 0.022);
      const hz = [];
      for (let k = 0; k <= 4; k++) hz.push(lane(0.12, yBot + (yTop - yBot) * 0.42 * k / 4));
      Vn(K, [...hz, _on(azP, 0.5)], 0.011, 0.012);
      /* lumbar arteries from the abdominal aorta */
      const abd = real(/^abdominal aorta$|^descending aorta$/i);
      for (const nm of ['first', 'second', 'third', 'fourth']) {
        const L = _B(new RegExp('^' + nm + ' lumbar vertebra$', 'i'), 400); if (!L.length) continue;
        const c = _centroid(L), fz = _argmax(L, p => p.z).z;
        const ao = abd.length ? abd.reduce((m, p) => Math.abs(p.y - c.y) < Math.abs(m.y - c.y) ? p : m, abd[0]) : null;
        if (!ao || Math.abs(ao.y - c.y) > 0.2) continue;
        for (const sx of [-1, 1]) A(K, [ao, _V(sx * 0.2, c.y, fz - 0.15), _V(sx * 0.3, c.y - 0.02, c.z - 0.2), _V(sx * 0.35, c.y - 0.04, c.z - 0.45)], 0.008, 0.005);
      }
    }
  }

  /* Each rib (2nd–11th, both sides) as an ordered path following its lower
     border, from the spine round to the front — for intercostal vessels and
     nerves. */
  function _ribPaths() {
    if (_ribCache) return _ribCache;
    const names = ['second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh'];
    const out = [];
    for (const side of ['right', 'left']) for (const n of names) {
      const pts = _partPts(GHOST_SYS, new RegExp('^' + side + ' ' + n + ' rib$', 'i'), 900);
      if (pts.length < 30) continue;
      const c = _centroid(pts);
      const cx = 0, cz = c.z - 0.05;
      const bins = new Array(18).fill(null);
      const ang = p => Math.atan2(p.z - cz, Math.abs(p.x - cx));     // −π/2 (back) … +π/2 (front)
      let lo = Infinity, hi = -Infinity;
      pts.forEach(p => { const a = ang(p); if (a < lo) lo = a; if (a > hi) hi = a; });
      pts.forEach(p => {
        const i = Math.min(17, Math.floor((ang(p) - lo) / (hi - lo + 1e-6) * 18));
        if (!bins[i] || p.y < bins[i].y) bins[i] = p;     // lower border
      });
      const path = bins.filter(Boolean);
      if (path.length > 5) out.push({ side, n, path });
    }
    _ribCache = out;
    return out;
  }
  let _ribCache = null;

  /* ═════════════════ PROCEDURAL: SPINAL CORD + NERVES ═══════════════ */
  let _cordCache;
  function _cordPath() {
    if (_cordCache !== undefined) return _cordCache;
    const vert = _partPts(GHOST_SYS, /^(atlas|axis|(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (cervical|thoracic|lumbar) vertebra)$/i, 9000);
    if (vert.length < 100) return (_cordCache = null);
    const lumbar1 = _partPts(GHOST_SYS, /^first lumbar vertebra$/i, 300);
    const atlas = _partPts(GHOST_SYS, /^(atlas|axis)$/i, 400);
    const yTop = atlas.length ? _argmax(atlas, p => p.y).y : _argmax(vert, p => p.y).y;
    const yEnd = lumbar1.length ? _centroid(lumbar1).y : yTop - 5;
    const path = [];
    const SL = 0.06;
    for (let y = yTop; y >= yEnd; y -= 0.16) {
      const sl = vert.filter(p => Math.abs(p.y - y) < SL && Math.abs(p.x) < 0.45);
      if (sl.length < 12) continue;
      let zmin = Infinity, zmax = -Infinity; sl.forEach(p => { if (p.z < zmin) zmin = p.z; if (p.z > zmax) zmax = p.z; });
      /* the vertebral canal = the largest empty disc between body and spine */
      let best = null, bd = -1;
      for (let k = 1; k < 40; k++) {
        const z = zmin + (zmax - zmin) * k / 40;
        let md = Infinity;
        for (const p of sl) { const d = Math.hypot(p.x, p.z - z); if (d < md) md = d; }
        if (md > bd) { bd = md; best = z; }
      }
      if (best != null && bd > 0.03) path.push(_V(0, y, best));
    }
    /* smooth out slice noise */
    return (_cordCache = path.map((p, i) => {
      const w = path.slice(Math.max(0, i - 2), i + 3);
      return _V(0, p.y, w.reduce((s, q) => s + q.z, 0) / w.length);
    }));
  }

  function _addNerves(grp) {
    if (!_sysGroup[GHOST_SYS]) return;
    const T = _builder('nervoso');
    const nerve = (pts, r0, r1, o) => T.tube('nervos', 'N', pts, r0, r1, o);

    const cord = _cordPath();
    const stem = _keyPts('troncocerebral', 400);
    if (cord && cord.length > 4) {
      const start = stem.length ? _argmax(stem, p => -p.y) : null;
      T.tube('medula', 'N', [start, ...cord], 0.06, 0.042, { free: true });
      /* cauda equina: a fan of roots down to the sacrum */
      const sac = _partPts(GHOST_SYS, /^sacrum$/i, 600);
      const end = cord[cord.length - 1];
      if (sac.length) {
        const sc = _centroid(sac);
        for (let i = -2; i <= 2; i++) nerve([end, end.clone().lerp(sc, 0.5).add(_V(i * 0.025, 0, -0.02)), sc.clone().add(_V(i * 0.05, -0.15, -0.05))], 0.012, 0.008, { free: true });
      }
    }
    const cordAt = y => {
      if (!cord || !cord.length) return null;
      return cord.reduce((m, p) => Math.abs(p.y - y) < Math.abs(m.y - y) ? p : m, cord[0]);
    };

    for (const sx of [-1, 1]) {
      const R = _limbRig(sx);
      /* ── arm: brachial plexus → median, ulnar, radial ── */
      if (R.hum && R.rad && R.uln) {
        const h = R.hum, palm = R.hand ? R.hand.n : _V(0, 0, 1), fa = _pairFrame(R.rad, R.uln, palm);
        const at = (t, om, of) => _at(h, t, sx, om, of);
        const root = cordAt(h.a.y + 0.55);
        const axilla = at(0.08, 0.3, 0.0);
        nerve(root ? [root, root.clone().lerp(axilla, 0.45).add(_V(0, -0.05, 0.08)), axilla] : [axilla, at(0.1, 0.28, 0)], 0.04, 0.035);
        const median = nerve([axilla, at(0.3, 0.2, 0.08), at(0.65, 0.15, 0.1), at(1.0, 0.05, 0.17), fa(0.3, 0.0, 0.1), fa(0.75, 0.0, 0.1), fa(0.99, 0.01, 0.1)], 0.028, 0.02);
        const ulnar = nerve([axilla, at(0.35, 0.22, -0.02), at(0.75, 0.2, -0.08), at(0.98, 0.17, -0.1), fa(0.2, -0.08, 0.02), fa(0.6, -0.09, 0.05), fa(0.99, -0.08, 0.07)], 0.024, 0.018);
        nerve([axilla, at(0.25, 0.05, -0.17), at(0.5, -0.12, -0.12), at(0.8, -0.15, 0.06), at(0.98, -0.1, 0.12), fa(0.3, 0.1, 0.02), fa(0.7, 0.11, -0.02), fa(0.99, 0.1, -0.05)], 0.026, 0.017);
        nerve([axilla, at(0.2, 0.02, 0.15), at(0.5, -0.04, 0.16), at(0.85, -0.06, 0.14)], 0.016, 0.01);          // musculocutaneous
        nerve([axilla, at(0.06, 0.05, -0.18), at(0.08, -0.15, -0.12), at(0.1, -0.2, 0.02)], 0.016, 0.01);        // axillary
        /* median → palm → common & proper palmar digital nerves (thumb to half the ring finger);
           ulnar → the rest — both sides of every finger */
        const H = R.hand;
        if (H && H.digits.every(Boolean)) {
          const n = H.n, D = H.digits, sT = H.sThumb;
          const palmM = _mPt(D[2], 0.2, n, D[2].mc.r + 0.08, sT * 0.05), palmU = _mPt(D[4], 0.2, n, D[4].mc.r + 0.07, sT * 0.04);
          nerve([_on(median, 1), palmM], 0.018, 0.015);
          nerve([_on(ulnar, 1), palmU], 0.015, 0.012);
          D.forEach(d => {
            for (const sg of [-1, 1]) {
              const toThumb = sg === sT;
              const fromU = d.i === 4 || (d.i === 3 && !toThumb);
              const src = d.i === 0 ? _mPt(D[0], 0.2, n, D[0].mc.r + 0.05) : fromU ? palmU : palmM;
              const pts = [src, _mPt(d, 0.75, n, d.mc.r + 0.06, sg * 0.035)];
              for (let k = 1; k < d.joints.length - 1; k++) pts.push(_dPt(d, k + 0.5, n, sg * (d.r * 1.05 + 0.004), d.r * 0.75));
              pts.push(_dPt(d, d.joints.length - 1, n, 0, d.r * 0.55, -d.r * 0.3));
              nerve(pts, 0.0065, 0.004, { inset: 0.003 });
            }
          });
          nerve([palmM, _mPt(D[0], 0.2, n, D[0].mc.r + 0.05)], 0.008, 0.007);
        }
      }
      /* ── leg: lumbar plexus → femoral; sacral plexus → sciatic → tibial / common fibular ── */
      if (R.fem && R.tib && R.fib) {
        const fm = R.fem, tb = R.tib, fb = R.fib;
        const at = (t, om, of) => _at(fm, t, sx, om, of), bt = (t, om, of) => _at(tb, t, sx, om, of);
        const lg = _pairFrame(fb, tb, _V(0, 0, 1));
        const l1 = cord && cord.length ? cord[cord.length - 1] : null;
        const groin = at(0.06, 0.15, 0.28);
        if (l1) nerve([l1, _V(sx * 0.32, (l1.y + groin.y) / 2, l1.z + 0.15), groin], 0.034, 0.03);
        nerve([groin, at(0.2, 0.15, 0.3), at(0.4, 0.05, 0.32)], 0.026, 0.014);
        nerve([groin, at(0.18, 0.35, 0.2), at(0.6, 0.38, 0.08), at(0.95, 0.3, -0.05), bt(0.3, 0.3, 0.02), bt(0.7, 0.22, 0.04), bt(0.95, 0.12, 0.08)], 0.016, 0.01);   // saphenous nerve
        const sac = _partPts(GHOST_SYS, /^sacrum$/i, 600);
        const sacL = sac.length ? _argmax(sac, p => p.x * sx - Math.abs(p.y - _centroid(sac).y) * 0.6) : null;
        const sci = nerve([sacL, at(0.0, 0.25, -0.35), at(0.12, 0.12, -0.32), at(0.45, 0.05, -0.28), at(0.82, 0.02, -0.22)], 0.055, 0.045);
        const split = _on(sci, 1);
        const tib = nerve([split, bt(0.08, 0.0, -0.2), bt(0.4, 0.03, -0.17), bt(0.7, 0.08, -0.15), bt(0.9, 0.12, -0.12), bt(0.98, 0.14, -0.09)], 0.036, 0.022);
        nerve([split, fb.a.clone().add(_V(sx * 0.07, -0.05, -0.05)), _ptOn(fb, 0.12).add(_V(sx * 0.06, 0, 0.05)), lg(0.3, 0.03, 0.09), lg(0.6, 0.0, 0.1), lg(0.97, -0.05, 0.14)], 0.026, 0.016);
        /* tibial → medial & lateral plantar nerves → plantar digital nerves on both sides of every toe */
        const F = R.foot;
        if (F && F.digits.every(Boolean)) {
          const n = F.n, D = F.digits, sT = F.sThumb, ank = _on(tib, 1);
          const pl = (i, t, lat, x) => _mPt(D[i], t, n, D[i].mc.r + (x || 0.03), lat || 0);
          const split = ank.clone().lerp(pl(0, -0.15), 0.45);
          const medT = nerve([ank, split, pl(0, 0.05, -sT * 0.03), pl(1, 0.35)], 0.014, 0.011);
          const latT = nerve([ank, split, pl(2, -0.1), pl(4, 0.05), pl(3, 0.3, -sT * 0.03)], 0.012, 0.01);
          D.forEach(d => {
            for (const sg of [-1, 1]) {
              const toBig = sg === sT;
              const fromLat = d.i === 4 || (d.i === 3 && !toBig);
              const pts = [_on(fromLat ? latT : medT, 1), pl(d.i, 0.65, sg * 0.03, 0.03)];
              for (let k = 1; k < d.joints.length - 1; k++) pts.push(_dPt(d, k + 0.5, n, sg * (d.r * 1.05 + 0.004), d.r * 0.6));
              pts.push(_dPt(d, d.joints.length - 1, n, 0, d.r * 0.5, -d.r * 0.3));
              nerve(pts, 0.0058, 0.0038, { inset: 0.003 });
            }
          });
        }
      }
    }
    /* intercostal nerves follow each rib's lower border back to the cord */
    _ribPaths().forEach(r => {
      const root = cordAt(r.path[0].y + 0.08);
      nerve([root, ...r.path.map(p => p.clone().add(_V(0, -0.045, 0.01)))].filter(Boolean), 0.014, 0.007);
    });
    T.flush(grp, key => new THREE.MeshPhysicalMaterial({ color: key === 'medula' ? REAL.medula : REAL.nervos, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.8 }));
  }

  /* ═══════════════════ PROCEDURAL: SENSE ORGANS ═══════════════════ */
  function _senseMat(kind) {
    const c = { M: 0xb04a42, T: 0xeee6d6, N: 0xf2d36e, B: 0xf0e4c6, L: 0xeccab4, C: 0xd99c86, O: 0xf3dc8e }[kind] || 0xffffff;
    const extra = kind === 'M' ? { sheen: 0.5, sheenColor: new THREE.Color(0xff9a8a), sheenRoughness: 0.45, roughness: 0.5 } : { roughness: 0.42 };
    return new THREE.MeshPhysicalMaterial({ color: c, clearcoat: 0.55, clearcoatRoughness: 0.35, envMapIntensity: 0.75, ...extra });
  }
  /* the two eyes from the real eyeball mesh: centre, radius, gaze direction */
  function _eyes() {
    const pts = _partPts('sentidos', /^eyeball$/i, 3000);
    const out = {};
    for (const sx of [-1, 1]) {
      const e = pts.filter(p => p.x * sx > 0);
      if (e.length < 20) continue;
      const c = _centroid(e), front = _argmax(e, p => p.z);
      out[sx] = { c, r: front.distanceTo(c), f: front.clone().sub(c).normalize() };
    }
    return out;
  }

  function _addSenses(grp) {
    const T = _builder('sentidos');
    const E = _eyes();
    _addTongue(grp);
    _addIrises(grp, E);
    const H = _headRig();

    /* ── eye muscles: 4 recti + 2 obliques + levator, from the orbital apex ── */
    const optic = {};
    for (const sx of [-1, 1]) {
      const e = E[sx]; if (!e) continue;
      const { c, r, f } = e;
      const u = _V(0, 1, 0).sub(f.clone().multiplyScalar(f.y)).normalize();
      const m = _V(-sx, 0, 0); m.sub(f.clone().multiplyScalar(m.dot(f))).sub(u.clone().multiplyScalar(m.dot(u))).normalize();
      const on = _partPts('sentidos', new RegExp('^' + (sx < 0 ? 'right' : 'left') + ' optic nerve$', 'i'), 1500);
      optic[sx] = on;
      const near = on.filter(p => { const d = p.distanceTo(c); return d > r * 2.3 && d < r * 2.9; });
      const apex = near.length > 3 ? _centroid(near) : c.clone().addScaledVector(f, -2.6 * r).addScaledVector(m, 0.5 * r);
      const globe = (deg, w, k) => { const a = deg * Math.PI / 180; return c.clone().addScaledVector(f, Math.cos(a) * r * k).addScaledVector(w, Math.sin(a) * r * k); };
      const radial = p => { const q = p.clone().sub(c); return q.sub(f.clone().multiplyScalar(q.dot(f))); };
      const belly = (r0) => t => r0 * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.8)) + 0.002;
      const o = { free: true, flat: { k: 0.38, hint: radial }, prof: belly(r * 0.17), rad: 10 };
      for (const w of [u, u.clone().negate(), m, m.clone().negate()]) {
        T.tube('musculos_olho', 'M', [apex.clone().addScaledVector(w, 0.22 * r), c.clone().addScaledVector(f, -1.9 * r).addScaledVector(w, 0.95 * r), globe(118, w, 1.1), globe(90, w, 1.08), globe(62, w, 1.02)], 0, 0, o);
      }
      /* superior oblique: belly along the upper-inner orbit wall → trochlea → tendon back over the eye */
      const um = u.clone().add(m).normalize();
      const troch = c.clone().addScaledVector(f, 0.72 * r).addScaledVector(u, 1.22 * r).addScaledVector(m, 1.12 * r);
      T.tube('musculos_olho', 'M', [apex.clone().addScaledVector(um, 0.3 * r), c.clone().addScaledVector(f, -1.7 * r).addScaledVector(u, 1.1 * r).addScaledVector(m, 1.0 * r), c.clone().addScaledVector(f, -0.3 * r).addScaledVector(u, 1.2 * r).addScaledVector(m, 1.15 * r), troch], 0, 0,
        { free: true, prof: t => r * (0.04 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.25))) + 0.002, rad: 9 });
      T.tube('musculos_olho', 'T', [troch, globe(55, u.clone().multiplyScalar(0.9).addScaledVector(m, 0.3).normalize(), 1.12), globe(100, u.clone().multiplyScalar(0.7).addScaledVector(m, -0.7).normalize(), 1.03)], r * 0.05, r * 0.07, { free: true });
      /* inferior oblique: from the front of the orbital floor, under the eye to its back-outer side */
      const io = c.clone().addScaledVector(f, 0.78 * r).addScaledVector(u, -1.15 * r).addScaledVector(m, 0.95 * r);
      T.tube('musculos_olho', 'M', [io, globe(78, u.clone().multiplyScalar(-0.9).addScaledVector(m, 0.35).normalize(), 1.13), globe(102, u.clone().multiplyScalar(-0.65).addScaledVector(m, -0.75).normalize(), 1.09), globe(118, u.clone().multiplyScalar(-0.2).addScaledVector(m, -0.98).normalize(), 1.02)], 0, 0,
        { free: true, prof: t => r * (0.05 + 0.1 * Math.sin(Math.PI * t)) + 0.002, rad: 9 });
      /* levator of the upper eyelid, above the superior rectus */
      T.tube('musculos_olho', 'M', [apex.clone().addScaledVector(u, 0.35 * r), c.clone().addScaledVector(f, -1.8 * r).addScaledVector(u, 1.25 * r), c.clone().addScaledVector(f, 0.15 * r).addScaledVector(u, 1.32 * r), c.clone().addScaledVector(f, 0.95 * r).addScaledVector(u, 0.75 * r)], 0, 0,
        { free: true, flat: { k: 0.25, hint: radial }, prof: t => r * (0.06 + 0.1 * Math.sin(Math.PI * t)) + 0.002, rad: 10 });
    }

    /* ── visual pathway: optic nerves → chiasm → optic tracts → radiations to the occipital lobe ── */
    if (E[-1] && E[1] && optic[-1].length && optic[1].length) {
      const endR = _argmax(optic[-1], p => p.distanceTo(E[-1].c)), endL = _argmax(optic[1], p => p.distanceTo(E[1].c));
      const ch = endR.clone().lerp(endL, 0.5).add(_V(0, 0.01, -0.04));
      for (const [sx, end] of [[-1, endR], [1, endL]]) {
        T.tube('nervootico', 'N', [end, end.clone().lerp(ch, 0.6), ch.clone().add(_V(sx * 0.03, 0, 0.02))], 0.022, 0.024, { free: true });
        const lgn = ch.clone().add(_V(sx * 0.24, 0.05, -0.32));
        T.tube('nervootico', 'N', [ch.clone().add(_V(sx * 0.03, 0, -0.02)), ch.clone().add(_V(sx * 0.13, 0.02, -0.14)), lgn], 0.022, 0.016, { free: true });
        if (H) {
          const occ = H.inner(_V(sx * 0.25, 0.05, -1), 0.09, _V(0, ch.y + 0.08, ch.z - 0.3));
          for (const k of [-1, 0, 1]) T.tube('nervootico', 'N', [lgn, lgn.clone().add(_V(sx * (0.1 + Math.abs(k) * 0.04), 0.05 + k * 0.08, -0.25)), lgn.clone().lerp(occ, 0.7).add(_V(sx * 0.1, k * 0.1, 0)), occ.clone().add(_V(0, k * 0.07, 0))], 0.008, 0.005, { free: true });
        }
      }
      T.tube('nervootico', 'N', [ch.clone().add(_V(-0.04, 0, 0)), ch.clone().add(_V(0.04, 0, 0))], 0.03, 0.03, { free: true });
    }

    /* ── ear: canal, eardrum, ossicles, cochlea, semicircular canals, VIII nerve ── */
    const ear = _partPts('sentidos', /^ear$/i, 4000);
    for (const sx of [-1, 1]) {
      const pts = ear.filter(p => p.x * sx > 0);
      if (pts.length < 30) continue;
      /* the canal opens at the skull's external acoustic meatus (just behind the
         jaw joint), at the depth where the auricle meets the head */
      const eam = H ? H.sides[sx].eam : _centroid(pts);
      const near = pts.filter(p => Math.abs(p.y - eam.y) < 0.07 && Math.abs(p.z - eam.z) < 0.07);
      const ox = (near.length ? near : pts).reduce((m, p) => Math.min(m, Math.abs(p.x)), Infinity);
      const open = _V(sx * ox, eam.y, eam.z);
      const M = _V(-sx, 0, 0), U = _V(0, 1, 0), Af = _V(0, 0, 1);
      const cd = M.clone().addScaledVector(Af, 0.22).addScaledVector(U, 0.04).normalize();
      const tm = open.clone().addScaledVector(cd, 0.19);
      /* external acoustic meatus: gentle S, ~2.5 cm */
      T.tube('ouvido', 'C', [open.clone().addScaledVector(cd, 0.015), open.clone().addScaledVector(cd, 0.07).add(_V(0, 0.01, 0)), open.clone().addScaledVector(cd, 0.13).add(_V(0, 0.004, -0.004)), tm.clone().addScaledVector(cd, -0.012)],
        0.034, 0.027, { free: true, rad: 14 });
      /* tympanic membrane: tilted disc, umbo drawn inward */
      const nT = _V(sx, -0.55, 0.35).normalize();
      const dg = new THREE.CircleGeometry(0.046, 40);
      const dp = dg.attributes.position;
      for (let i = 0; i < dp.count; i++) { const x = dp.getX(i), y = dp.getY(i), rr = Math.hypot(x, y) / 0.046; dp.setZ(i, -0.016 * Math.pow(1 - Math.min(1, rr), 1.4)); }
      dg.computeVertexNormals();
      const drumMat = new THREE.MeshPhysicalMaterial({ color: 0xd8cfc2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
      const drum = new THREE.Mesh(dg, drumMat);
      drum.position.copy(tm); drum.lookAt(tm.clone().add(nT));
      _register(drum, 'sentidos', 'ouvido_medio', drumMat.color.clone(), drumMat);
      drum.userData.alpha = 0.82;
      grp.add(drum);
      /* ossicles: malleus (handle on the drum) → incus → stapes into the oval window */
      const mU = U.clone().sub(nT.clone().multiplyScalar(U.dot(nT))).normalize();
      const umbo = tm.clone().addScaledVector(nT, -0.016);
      const mHead = tm.clone().addScaledVector(mU, 0.085).addScaledVector(M, 0.03);
      T.tube('ouvido_medio', 'B', [umbo, tm.clone().addScaledVector(mU, 0.035).addScaledVector(nT, -0.006), tm.clone().addScaledVector(mU, 0.062).addScaledVector(M, 0.012), mHead], 0, 0,
        { free: true, prof: t => 0.0035 + 0.0085 * Math.pow(Math.max(0, (t - 0.55) / 0.45), 1.5), rad: 9 });
      const ib = mHead.clone().addScaledVector(Af, -0.02).addScaledVector(M, 0.006);
      T.tube('ouvido_medio', 'B', [mHead.clone().addScaledVector(Af, -0.004), ib, ib.clone().addScaledVector(Af, -0.028).addScaledVector(U, 0.004)], 0.008, 0.0035, { free: true, rad: 9 });
      const lp = ib.clone().addScaledVector(U, -0.055).addScaledVector(M, 0.014).addScaledVector(Af, 0.004);
      T.tube('ouvido_medio', 'B', [ib, ib.clone().addScaledVector(U, -0.03).addScaledVector(M, 0.006), lp], 0.005, 0.0032, { free: true, rad: 8 });
      const sHead = lp.clone().addScaledVector(M, 0.006), ow = sHead.clone().addScaledVector(M, 0.03);
      for (const k of [-1, 1]) T.tube('ouvido_medio', 'B', [sHead, sHead.clone().addScaledVector(M, 0.016).addScaledVector(Af, k * 0.009), ow.clone().addScaledVector(Af, k * 0.011)], 0.0022, 0.002, { free: true, rad: 6 });
      T.tube('ouvido_medio', 'B', [ow.clone().addScaledVector(Af, -0.015), ow.clone().addScaledVector(Af, 0.015)], 0.004, 0.004, { free: true, rad: 8, flat: { k: 0.4, hint: M } });
      /* inner ear: vestibule, cochlea (2.5 turns), three semicircular canals */
      const vb = ow.clone().addScaledVector(M, 0.022);
      T.tube('ouvido_interno', 'L', [vb.clone().addScaledVector(Af, -0.012), vb.clone().addScaledVector(Af, 0.012)], 0.017, 0.017, { free: true, rad: 12 });
      const k = Af.clone().multiplyScalar(0.65).addScaledVector(M, -0.55).addScaledVector(U, -0.25).normalize();
      const e1 = U.clone().sub(k.clone().multiplyScalar(U.dot(k))).normalize(), e2 = k.clone().cross(e1);
      const cb = vb.clone().addScaledVector(Af, 0.036).addScaledVector(M, 0.016).addScaledVector(U, -0.01);
      const sp = [vb.clone().addScaledVector(Af, 0.012)];
      const TH = 2.6 * Math.PI * 2;
      for (let i = 0; i <= 64; i++) { const th = i / 64 * TH, rr = 0.04 * (1 - 0.78 * i / 64); sp.push(cb.clone().addScaledVector(e1, Math.cos(th) * rr).addScaledVector(e2, Math.sin(th) * rr).addScaledVector(k, 0.042 * i / 64)); }
      T.tube('ouvido_interno', 'L', sp, 0.011, 0.0045, { free: true, rad: 10 });
      const pa = M.clone().add(Af).normalize();                                         // petrous axis (antero-medial)
      const canals = [
        { n: U.clone().addScaledVector(Af, 0.45).normalize(), ctr: vb.clone().addScaledVector(M, -0.032).addScaledVector(Af, -0.012).addScaledVector(U, 0.006) },   // lateral
        { n: pa, ctr: vb.clone().addScaledVector(U, 0.042).addScaledVector(Af, 0.004) },                                                                                // anterior (superior)
        { n: pa.clone().cross(U).normalize(), ctr: vb.clone().addScaledVector(Af, -0.04).addScaledVector(U, 0.016).addScaledVector(M, 0.004) },                    // posterior
      ];
      for (const cn of canals) {
        const toV = vb.clone().sub(cn.ctr); toV.sub(cn.n.clone().multiplyScalar(toV.dot(cn.n)));
        const rho = Math.max(0.026, Math.min(0.036, toV.length()));
        const a1 = toV.normalize(), a2 = cn.n.clone().cross(a1);
        const loop = [vb];
        for (let i = 0; i <= 24; i++) { const th = 0.45 + i / 24 * (Math.PI * 2 - 0.9); loop.push(cn.ctr.clone().addScaledVector(a1, Math.cos(th) * rho).addScaledVector(a2, Math.sin(th) * rho)); }
        loop.push(vb);
        T.tube('ouvido_interno', 'L', loop, 0, 0, { free: true, rad: 8, prof: t => 0.0042 + 0.006 * Math.exp(-Math.pow((t - 0.1) / 0.05, 2)) });
      }
      /* vestibulocochlear nerve through the internal acoustic meatus to the brainstem */
      const bs = _V(sx * 0.12, vb.y + 0.01, vb.z + 0.03);
      T.tube('ouvido_interno', 'N', [cb.clone().addScaledVector(M, 0.01), vb.clone().addScaledVector(M, 0.03), vb.clone().addScaledVector(M, 0.1).add(_V(0, 0.01, 0.01)), bs], 0.009, 0.011, { free: true });
    }

    /* ── smell: olfactory bulbs on the cribriform plate, nerve filaments into the nasal roof, tracts back ── */
    if (E[-1] && E[1]) {
      const c = E[-1].c.clone().lerp(E[1].c, 0.5), r = (E[-1].r + E[1].r) / 2;
      for (const sx of [-1, 1]) {
        const b0 = _V(sx * 0.03, c.y + r * 0.95, c.z + 0.03), b1 = _V(sx * 0.04, c.y + r * 1.0, c.z - 0.1);
        T.tube('olfato', 'O', [b0, b0.clone().lerp(b1, 0.5), b1], 0, 0, { free: true, prof: t => 0.008 + 0.014 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.6), flat: { k: 0.6, hint: _V(0, 1, 0) }, rad: 12 });
        T.tube('olfato', 'O', [b1, _V(sx * 0.07, c.y + r * 1.05, c.z - 0.24), _V(sx * 0.13, c.y + r * 1.1, c.z - 0.4)], 0.008, 0.007, { free: true });
        for (let i = 0; i < 7; i++) {
          const t = i / 6, top = b0.clone().lerp(b1, t).add(_V(0, -0.012, 0));
          T.tube('olfato', 'O', [top, top.clone().add(_V(sx * (0.004 + (i % 3) * 0.004), -0.05, 0.004)), top.clone().add(_V(sx * (0.008 + (i % 3) * 0.008), -0.1, 0.012 - t * 0.02))], 0.0024, 0.0016, { free: true, rad: 5 });
        }
      }
    }

    T.flush(grp, (key, kind) => _senseMat(kind));
  }

  /* Tongue with a painted dorsum: fungiform papillae (red dots), filiform
     speckle, median sulcus, the V of circumvallate papillae and the lingual
     tonsil at the root. */
  function _tongueTexture() {
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, S);             // v: 0 = root, 1 = tip
    g.addColorStop(0, '#b45763'); g.addColorStop(0.35, '#d87885'); g.addColorStop(1, '#e48c97');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,${210 + rnd() * 30 | 0},${215 + rnd() * 30 | 0},${0.12 + rnd() * 0.12})`; x.fillRect(rnd() * S, S * 0.3 + rnd() * S * 0.7, 1.5, 1.5); }
    for (let i = 0; i < 520; i++) {
      const v = 0.3 + Math.pow(rnd(), 0.6) * 0.7, u = rnd();
      const edge = Math.abs(u - 0.5) * 2;
      if (rnd() > 0.35 + edge * 0.5 + (v - 0.3)) continue;
      x.fillStyle = `rgba(${200 + rnd() * 40 | 0},60,80,0.75)`;
      x.beginPath(); x.arc(u * S, v * S, 2 + rnd() * 2.2, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(120,40,50,.45)'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(S / 2, S * 0.27); x.bezierCurveTo(S / 2 - 2, S * 0.55, S / 2 + 2, S * 0.75, S / 2, S * 0.93); x.stroke();
    for (let i = -5; i <= 5; i++) {
      const u = 0.5 + i * 0.065, v = 0.26 - Math.abs(i) * 0.022;
      x.fillStyle = '#c0606c'; x.beginPath(); x.arc(u * S, v * S, 9, 0, 7); x.fill();
      x.strokeStyle = 'rgba(110,35,45,.6)'; x.lineWidth = 2.5; x.stroke();
    }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(150,60,70,${0.25 + rnd() * 0.25})`; x.beginPath(); x.arc(S * (0.2 + rnd() * 0.6), S * rnd() * 0.18, 4 + rnd() * 6, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  function _addTongue(grp) {
    const mand = _keyPts('mandibula', 1500);
    const mandG = mand.length ? mand : _partPts(GHOST_SYS, /^mandible$/i, 1500);
    if (mandG.length < 20) return;
    const box = new THREE.Box3().setFromPoints(mandG);
    const sz = box.getSize(new THREE.Vector3());
    const W = sz.x * 0.5, L = sz.z * 0.66, Th = sz.y * 0.3;
    const g = new THREE.SphereGeometry(1, 72, 44);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      uv.setXY(i, (x + 1) / 2, (z + 1) / 2);                       // top-view projection: v 0 = root, 1 = tip
      const front = (z + 1) / 2;
      x *= 1 - 0.42 * Math.pow(front, 1.7);
      const thick = 1 - 0.55 * Math.pow(front, 1.4);
      y *= (y > 0 ? 0.7 : 0.9) * thick;
      if (y > 0) y -= 0.1 * Math.exp(-x * x / 0.02) * (0.3 + front * 0.7);
      y -= 0.35 * Math.pow(1 - front, 3);
      y += 0.08 * Math.sin(front * Math.PI);
      p.setXYZ(i, x * W / 2, y * Th / 2, z * L / 2);
    }
    g.computeVertexNormals();
    const tex = _tongueTexture();
    const col = new THREE.Color(0xffffff);
    const mat = new THREE.MeshPhysicalMaterial({ color: col, map: tex, bumpMap: tex, bumpScale: 0.6, roughness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.35, envMapIntensity: 0.7 });
    const mesh = new THREE.Mesh(g, mat);
    _register(mesh, 'sentidos', 'paladar', new THREE.Color(REAL.paladar), mat);
    mesh.position.set((box.min.x + box.max.x) / 2, box.min.y + sz.y * 0.4, box.max.z - sz.z * 0.55);
    mesh.rotation.x = -0.06;
    grp.add(mesh);
  }

  function _irisTexture() {
    const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
    const x = c.getContext('2d'), R = s / 2;
    const g = x.createRadialGradient(R, R, R * 0.2, R, R, R);
    g.addColorStop(0, '#2c1a0e'); g.addColorStop(0.35, '#6b4223'); g.addColorStop(0.75, '#8a5a2e'); g.addColorStop(0.93, '#3a2414'); g.addColorStop(1, 'rgba(20,12,6,0)');
    x.fillStyle = g; x.beginPath(); x.arc(R, R, R, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,220,160,.18)'; x.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; x.beginPath(); x.moveTo(R + Math.cos(a) * R * 0.32, R + Math.sin(a) * R * 0.32); x.lineTo(R + Math.cos(a) * R * 0.86, R + Math.sin(a) * R * 0.86); x.stroke(); }
    x.fillStyle = '#050302'; x.beginPath(); x.arc(R, R, R * 0.3, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /* iris disc + clear corneal dome on each real eyeball */
  function _addIrises(grp, E) {
    const tex = _irisTexture();
    for (const sx of [-1, 1]) {
      const e = E[sx]; if (!e) continue;
      const { c, r, f } = e;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.52, 48), new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, roughness: 0.3 }));
      disc.position.copy(c).addScaledVector(f, r * 0.93);
      disc.lookAt(disc.position.clone().add(f));
      disc.userData = { key: 'olhos', sys: 'sentidos', baseColor: new THREE.Color(0xffffff), pickable: true, iris: true };
      (_meshByKey.olhos = _meshByKey.olhos || []).push(disc);
      grp.add(disc);
      /* cornea: a clear cap with a tighter curvature (≈ 7.8 mm vs 12 mm) */
      const rc = r * 0.65, half = Math.asin(Math.min(1, (r * 0.56) / rc));
      const cg = new THREE.SphereGeometry(rc, 40, 16, 0, Math.PI * 2, 0, half);
      cg.rotateX(Math.PI / 2);
      const cm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.18, depthWrite: false });
      const cornea = new THREE.Mesh(cg, cm);
      cornea.position.copy(c).addScaledVector(f, r * 1.04 - rc);
      cornea.lookAt(cornea.position.clone().add(f));
      cornea.userData = { key: 'olhos', sys: 'sentidos', baseColor: new THREE.Color(0xffffff), pickable: false, iris: true, alpha: 0.18 };
      (_meshByKey.olhos = _meshByKey.olhos || []).push(cornea);
      grp.add(cornea);
    }
  }

  const _augMs = {};
  function _augmentSystem(sysId) {
    const add = id => {
      if (_augmented.has(id) || !_sysGroup[id]) return;
      const t0 = performance.now();
      if (id === 'circulatorio') _addVessels(_sysGroup[id]);
      else if (id === 'nervoso') _addNerves(_sysGroup[id]);
      else if (id === 'sentidos') _addSenses(_sysGroup[id]);
      else return;
      _augMs[id] = Math.round(performance.now() - t0);
      _augmented.add(id);
    };
    if (sysId === '__all') ['circulatorio', 'nervoso', 'sentidos'].forEach(add); else add(sysId);
  }

  /* ════════════════════════════ SCENE ══════════════════════════════ */
  function _shadowTexture() {
    const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.45, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }

  function _buildScene() {
    const W = _vp.clientWidth || 800, H = _vp.clientHeight || 600;
    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    _renderer.setSize(W, H);
    _renderer.setClearColor(0x000000, 0);
    _renderer.outputColorSpace = THREE.SRGBColorSpace;
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.05;
    _vp.appendChild(_renderer.domElement);

    _scene = new THREE.Scene();
    /* soft studio reflections (no HDR download — generated room environment) */
    try {
      const pm = new THREE.PMREMGenerator(_renderer);
      _envTex = pm.fromScene(new _RoomEnvironment(), 0.04).texture;
      _scene.environment = _envTex;
      pm.dispose();
    } catch (e) { /* env is a nicety */ }

    _camera = new THREE.PerspectiveCamera(36, W / H, 0.02, 400);
    _focus = _V(0, 8, 0);
    _focusT = _focus.clone();

    _scene.add(new THREE.HemisphereLight(0xe4ecff, 0x2a1d1a, 0.55));
    const key = new THREE.DirectionalLight(0xfff3e8, 1.6); key.position.set(9, 20, 18); _scene.add(key);
    const fill = new THREE.DirectionalLight(0xa9c4ff, 0.5); fill.position.set(-16, 8, 10); _scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd2c4, 0.9); rim.position.set(-4, 14, -18); _scene.add(rim);

    _shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: _shadowTexture(), transparent: true, depthWrite: false }));
    _shadow.rotation.x = -Math.PI / 2; _shadow.position.y = 0.01; _shadow.scale.set(6, 3.2, 1);
    _shadow.renderOrder = -1;
    _scene.add(_shadow);

    new ResizeObserver(() => _resize()).observe(_vp);
    _built = true;
  }

  /* ════════════════════════════ FRAMING ════════════════════════════ */
  function _bounds(objects) {
    const box = new THREE.Box3();
    let any = false;
    objects.forEach(o => { if (o) { box.expandByObject(o); any = true; } });
    return any && !box.isEmpty() ? box : null;
  }

  function _frameBox(box, pad = 1.2, instant = false) {
    if (!box) return;
    const size = new THREE.Vector3(), ctr = new THREE.Vector3();
    box.getSize(size); box.getCenter(ctr);
    const vfov = _camera.fov * Math.PI / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * _camera.aspect);
    const dH = (size.y / 2) / Math.tan(vfov / 2);
    const dW = (Math.max(size.x, size.z) / 2) / Math.tan(hfov / 2);
    _focusT.copy(ctr);
    _distT = Math.max(0.45, Math.max(dH, dW) * pad + Math.max(size.x, size.z) * 0.5);
    if (instant) { _focus.copy(_focusT); _dist = _distT; _az = _azT; _pol = _polT; }
    _dirty = true;
  }

  /* tiny paired structures: frame ONE side (the person's right, −X) from the side */
  const AUTO_XRAY = new Set(['ouvido_medio', 'ouvido_interno', 'olfato', 'musculos_olho', 'nervootico']);
  const FRAME_SIDE = { ouvido_medio: -1.25, ouvido_interno: -1.25, ouvido: -1.2, vasos_maos: -0.35, vasos_pes: -0.6, musculos_olho: -0.5 };
  function _frameStructure(key, instant) {
    let box;
    if (FRAME_SIDE[key] != null) {
      const pts = _keyPts(key, 3000).filter(p => p.x < 0);
      if (pts.length) box = new THREE.Box3().setFromPoints(pts);
      _azT = FRAME_SIDE[key];
    }
    if (!box) box = key === 'tato' ? _bounds([_shell]) : _bounds(_meshByKey[key] || []);
    _frameBox(box, key === 'tato' ? 1.05 : /^ouvido/.test(key) ? 3.2 : FRAME_SIDE[key] != null ? 1.5 : 2.3, instant);
    _polT = 1.42; _autoSpin = false;
  }

  function _frameSystem(sysId, instant) {
    let box;
    if (sysId === '__all' || sysId === 'esqueletico' || sysId === 'muscular' || sysId === 'circulatorio' || sysId === 'nervoso') box = _bounds([_shell || _sysGroup[GHOST_SYS]]);
    else box = _bounds([_sysGroup[sysId]]);
    _frameBox(box, sysId === 'sentidos' ? 1.5 : sysId === '__all' || sysId === 'esqueletico' || sysId === 'muscular' || sysId === 'circulatorio' || sysId === 'nervoso' ? 1.05 : 1.75, instant);
    _polT = 1.42;
  }

  function _setView(az) { _azT = az; _polT = 1.48; _autoSpin = false; _dirty = true; }

  /* ════════════════════════════ VISIBILITY ═════════════════════════ */
  /* System / isolate / x-ray / selection / hover → every loaded mesh. The
     skin shell and (for organ systems) a faint skeleton give spatial context
     without being pickable. */
  /* toggling `transparent` changes the shader program → needsUpdate */
  function _setTransp(mat, on, opacity, depthWrite) {
    if (mat.transparent !== on) { mat.transparent = on; mat.needsUpdate = true; }
    mat.opacity = opacity; mat.depthWrite = depthWrite;
  }
  function _applyView() {
    const all = _curSys === '__all';
    const ghostOn = !all && _curSys !== GHOST_SYS;
    const accent = new THREE.Color(_curSys && SYS_BY_ID[_curSys] ? SYS_BY_ID[_curSys].color : '#fb7185');

    Object.entries(_sysGroup).forEach(([sysId, grp]) => {
      const sysActive = all || _curSys === sysId;
      const ghost = sysId === GHOST_SYS && ghostOn;
      grp.visible = sysActive || ghost;
      grp.traverse(o => {
        if (!o.isMesh) return;
        const key = o.userData.key;
        const mat = o.material;
        if (ghost) {
          o.visible = _curSys !== 'muscular'; o.userData.pickable = false;
          _setTransp(mat, true, 0.075, false);
          if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
          return;
        }
        o.userData.pickable = true;
        const selected = _selKey && key === _selKey;
        const hovered = !selected && _hoverKey && key === _hoverKey;
        let visible = sysActive;
        if (_isolate && _selKey) visible = selected;
        if (sysId === 'circulatorio' && _vesselFilter !== 'all' && o.userData.kind && o.userData.kind !== _vesselFilter) visible = false;
        o.visible = visible;
        const alpha = o.userData.alpha;
        if (_xray && _selKey && !selected) _setTransp(mat, true, alpha != null ? alpha * 0.4 : 0.12, false);
        else _setTransp(mat, !!o.userData.iris || alpha != null, alpha != null ? alpha : 1, alpha == null);
        if (mat.emissive) {
          if (selected) mat.emissive.copy(accent).multiplyScalar(0.42);
          else if (hovered) mat.emissive.copy(accent).multiplyScalar(0.2);
          else mat.emissive.setRGB(0, 0, 0);
        }
      });
    });

    /* skin silhouette */
    if (_shell) {
      const touch = _curSys === 'sentidos' && _selKey === 'tato';
      const u = _shellMeshes[0] && _shellMeshes[0].material.uniforms;
      _shell.visible = !(_isolate && _selKey && _selKey !== 'tato');
      if (u) {
        u.uTouch.value = touch ? 1 : 0;
        u.uOpacity.value = touch ? 1 : _curSys === 'esqueletico' ? 0.7 : _curSys === 'muscular' ? 0.45 : all ? 0.5 : 1;
        if (_xray && _selKey && !touch) u.uOpacity.value *= 0.5;
      }
    }
    _dirty = true;
    _labelsStale = true;
  }

  /* ════════════════════════════ SELECTION ══════════════════════════ */
  let _selToken = 0;
  async function selectSystem(sysId, instant) {
    const tok = ++_selToken;
    _curSys = sysId; _selKey = null; _isolate = false; _xray = false; _autoX = false;
    if (sysId !== 'circulatorio') _vesselFilter = 'all';
    _highlightRail();
    _renderPanelSystem(sysId);
    _updateCrumb();
    _syncToolbar();
    _setBusy(true);
    const jobs = [_ensureShell(), _ensureSystem(GHOST_SYS)];
    if (sysId === '__all') SYS.forEach(s => jobs.push(_ensureSystem(s.id)));
    else jobs.push(_ensureSystem(sysId));
    await Promise.all(jobs);
    if (tok !== _selToken) return;
    _augmentSystem(sysId);
    _setBusy(false);
    _applyView();
    _frameSystem(sysId, instant);
    _anchors = {};
    _renderPanelSystem(sysId);
  }

  function selectStructure(key) {
    const s = STRUCT_BY_KEY[key]; if (!s) return;
    if (_curSys !== '__all' && s.system !== _curSys) {
      selectSystem(s.system).then(() => selectStructure(key));
      return;
    }
    _selKey = key;
    /* structures buried inside the head read best with everything else ghosted */
    if (AUTO_XRAY.has(key)) { _xray = true; _autoX = true; }
    else if (_autoX) { _xray = false; _autoX = false; }
    _applyView();
    _frameStructure(key);
    _renderPanelStructure(s);
    _updateCrumb();
    _syncToolbar();
  }
  function _clearSelection() {
    if (!_selKey) return;
    _selKey = null; _isolate = false; _xray = false;
    _applyView(); _renderPanelSystem(_curSys); _updateCrumb(); _syncToolbar();
  }

  /* ════════════════════════════ PANEL ══════════════════════════════ */
  function _dot(key, sysId) {
    const c = _colorFor(sysId, key);
    return `<span class="hb-struct-dot" style="--c:#${c.getHexString()}"></span>`;
  }
  function _statsHTML(sys) {
    if (!sys || !sys.stats || !sys.stats.length) return '';
    return `<div class="hb-stats">${sys.stats.map(st => `<div class="hb-stat"><b>${_esc(st.v)}</b><span>${_esc(_lang() === 'en' ? st.en : st.pt)}</span></div>`).join('')}</div>`;
  }
  /* circulatory: show everything, only arteries or only veins */
  function _vesselFilterHTML() {
    const opt = [['all', _t('All', 'Tudo'), ''], ['A', _t('Arteries', 'Artérias'), '#c8303a'], ['V', _t('Veins', 'Veias'), '#3b62b5']];
    return `<div class="hb-vf" role="group" aria-label="${_t('Show vessels', 'Mostrar vasos')}">
        ${opt.map(([id, lb, c]) => `<button class="hb-vf-btn${_vesselFilter === id ? ' on' : ''}" data-vf="${id}" aria-pressed="${_vesselFilter === id}">${c ? `<span class="hb-struct-dot" style="--c:${c}"></span>` : ''}${lb}</button>`).join('')}
      </div>
      <p class="hb-legend">${_t('<b class="a">Arteries</b> carry blood away from the heart; <b class="v">veins</b> bring it back. In the lungs it is the other way round: the pulmonary arteries carry oxygen-poor blood.',
        '<b class="a">Artérias</b> levam o sangue para fora do coração; <b class="v">veias</b> trazem-no de volta. Nos pulmões é ao contrário: as artérias pulmonares levam sangue pobre em oxigénio.')}</p>`;
  }
  function _renderPanelSystem(sysId) {
    if (!_panel) return;
    if (sysId === '__all') {
      _panel.innerHTML = `
        <div class="hb-info-hd"><span class="hb-info-emoji">🧍</span>
          <div><div class="hb-info-ttl">${_t('Whole body', 'Corpo completo')}</div>
          <div class="hb-info-sub">${SYS.length} ${_t('systems', 'sistemas')} · ${STRUCT.length} ${_t('structures', 'estruturas')}</div></div></div>
        <div class="hb-info-desc">${_t('Every system overlaid in one co-registered body. Tap any part, or pick a system to study it on its own.', 'Todos os sistemas sobrepostos num só corpo, à escala. Toca numa parte, ou escolhe um sistema para o estudar isolado.')}</div>
        <div class="hb-sys-cards">${SYS.map(s => `<button class="hb-sys-card" data-sys="${s.id}" style="--c:${s.color}"><span>${s.emoji}</span><b>${_esc(_sn(s))}</b><i>${STRUCT.filter(x => x.system === s.id).length}</i></button>`).join('')}</div>`;
      _panel.querySelectorAll('.hb-sys-card').forEach(b => b.addEventListener('click', () => selectSystem(b.dataset.sys)));
      _panel.style.setProperty('--sys', '#fb7185');
      return;
    }
    const sys = SYS_BY_ID[sysId];
    const members = STRUCT.filter(s => s.system === sysId);
    _panel.style.setProperty('--sys', sys.color);
    _panel.innerHTML = `
      <div class="hb-info-hd"><span class="hb-info-emoji">${sys.emoji}</span>
        <div><div class="hb-info-ttl">${_esc(_sn(sys))}</div>
        <div class="hb-info-sub">${members.length} ${_t('structures', 'estruturas')}</div></div></div>
      <div class="hb-info-desc">${_esc(_lang() === 'en' ? sys.desc_en : sys.desc_pt)}</div>
      ${_statsHTML(sys)}
      ${sysId === 'circulatorio' ? _vesselFilterHTML() : ''}
      <div class="hb-panel-h">${_t('Structures', 'Estruturas')} <span>${_t('tap to explore', 'toca para explorar')}</span></div>
      ${_structureListHTML(members)}`;
    _wireStructureList();
    _panel.querySelectorAll('[data-vf]').forEach(b => b.addEventListener('click', () => {
      _vesselFilter = b.dataset.vf;
      _panel.querySelectorAll('[data-vf]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      _applyView();
    }));
  }

  /* bilingual helpers for the long-form copy (DETAILS -> manifest `more`) */
  const _L = pair => pair ? (_lang() === 'en' ? pair[1] : pair[0]) : '';
  const _L4 = q => _lang() === 'en' ? [q[2], q[3]] : [q[0], q[1]];
  let _tab = 'over';
  function _renderPanelStructure(s) {
    const sys = SYS_BY_ID[s.system];
    const facts = _f(s, 'facts') || [];
    const more = s.more || {};
    const sib = STRUCT.filter(x => x.system === s.system && x.key !== s.key);
    const rel = (more.related || []).map(k => STRUCT_BY_KEY[k]).filter(Boolean);
    const parts = more.parts || [], health = more.health || [];
    if (_tab === 'parts' && !parts.length) _tab = 'over';
    if (_tab === 'health' && !health.length) _tab = 'over';
    const tabs = [['over', _t('Overview', 'Visão geral')]];
    if (parts.length) tabs.push(['parts', _t('Parts', 'Partes') + ` <i>${parts.length}</i>`]);
    if (health.length) tabs.push(['health', _t('Health', 'Saúde')]);
    const nums = more.nums || [];
    _panel.style.setProperty('--sys', sys.color);
    _panel.innerHTML = `
      <button class="hb-back" data-back="1">← ${_esc(_sn(sys))}</button>
      <div class="hb-info-hd">${_dot(s.key, s.system).replace('hb-struct-dot', 'hb-struct-dot hb-dot-lg')}
        <div><div class="hb-info-ttl">${_esc(_nm(s))}</div>
        <div class="hb-info-sub">${sys.emoji} ${_esc(_sn(sys))}${_lang() === 'en' ? '' : ` · <i>${_esc(s.en)}</i>`}</div></div></div>
      <div class="hb-info-desc">${_esc(_f(s, 'fn'))}</div>
      <div class="hb-meta-row"><span class="hb-meta-ic" aria-hidden="true">📍</span><span><b>${_t('Where', 'Onde')}:</b> ${_esc(_f(s, 'loc'))}</span></div>
      ${nums.length ? `<div class="hb-stats">${nums.map(n => `<div class="hb-stat"><b>${_esc(n[0])}</b><span>${_esc(_lang() === 'en' ? n[2] : n[1])}</span></div>`).join('')}</div>` : ''}
      <div class="hb-struct-actions">
        <button class="hb-act ${_isolate ? 'on' : ''}" data-act="isolate" aria-pressed="${_isolate}">${_t('Isolate', 'Isolar')}</button>
        <button class="hb-act ${_xray ? 'on' : ''}" data-act="xray" aria-pressed="${_xray}">${_t('X-ray', 'Raio-X')}</button>
      </div>
      ${tabs.length > 1 ? `<div class="hb-tabs" role="tablist">${tabs.map(([id, lb]) => `<button class="hb-tab${_tab === id ? ' on' : ''}" role="tab" aria-selected="${_tab === id}" data-tab="${id}">${lb}</button>`).join('')}</div>` : ''}
      <div class="hb-pane" data-pane="over"${_tab === 'over' ? '' : ' hidden'}>
        ${more.how ? `<div class="hb-panel-h">${_t('How it works', 'Como funciona')}</div><p class="hb-how">${_esc(_L(more.how))}</p>` : ''}
        ${facts.length ? `<div class="hb-panel-h">${_t('Did you know?', 'Sabias que…')}</div><ul class="hb-info-facts">${facts.map(f => `<li>${_esc(f)}</li>`).join('')}</ul>` : ''}
      </div>
      ${parts.length ? `<div class="hb-pane" data-pane="parts"${_tab === 'parts' ? '' : ' hidden'}>
        <ul class="hb-parts">${parts.map(q => { const [n, d] = _L4(q); return `<li><b>${_esc(n)}</b><span>${_esc(d)}</span></li>`; }).join('')}</ul></div>` : ''}
      ${health.length ? `<div class="hb-pane" data-pane="health"${_tab === 'health' ? '' : ' hidden'}>
        <ul class="hb-parts hb-health">${health.map(q => { const [n, d] = _L4(q); return `<li><b>${_esc(n)}</b><span>${_esc(d)}</span></li>`; }).join('')}</ul>
        ${more.care ? `<div class="hb-care"><b>${_t('Looking after it', 'Cuidar')}</b> ${_esc(_L(more.care))}</div>` : ''}
        <p class="hb-note">${_t('General information — not a substitute for medical advice.', 'Informação geral — não substitui o aconselhamento médico.')}</p></div>` : ''}
      ${rel.length ? `<div class="hb-panel-h">${_t('Related', 'Relacionado')}</div>
        <div class="hb-chips">${rel.map(x => `<button class="hb-chip" data-key="${x.key}">${_dot(x.key, x.system)}${_esc(_nm(x))}${x.system !== s.system ? ` <i aria-hidden="true">${SYS_BY_ID[x.system].emoji}</i>` : ''}</button>`).join('')}</div>` : ''}
      ${sib.length ? `<div class="hb-panel-h">${_t('Also in this system', 'Também neste sistema')}</div>
        <div class="hb-chips">${sib.map(x => `<button class="hb-chip" data-key="${x.key}">${_dot(x.key, x.system)}${_esc(_nm(x))}</button>`).join('')}</div>` : ''}`;
    _panel.querySelector('[data-back]')?.addEventListener('click', _clearSelection);
    _panel.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => _toggleMode(b.dataset.act)));
    _panel.querySelectorAll('.hb-chip').forEach(b => b.addEventListener('click', () => selectStructure(b.dataset.key)));
    _panel.querySelectorAll('.hb-tab').forEach(b => b.addEventListener('click', () => {
      _tab = b.dataset.tab;
      _panel.querySelectorAll('.hb-tab').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
      _panel.querySelectorAll('.hb-pane').forEach(p => { p.hidden = p.dataset.pane !== _tab; });
    }));
    _panel.scrollTop = 0;
  }

  function _toggleMode(mode) {
    if (!_selKey) return;
    if (mode === 'isolate') _isolate = !_isolate;
    if (mode === 'xray') _xray = !_xray;
    _applyView(); _syncToolbar();
    _panel.querySelectorAll('[data-act]').forEach(b => {
      const on = b.dataset.act === 'isolate' ? _isolate : _xray;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
  }

  function _structureListHTML(list) {
    return `<div class="hb-struct-list">${list.map(s =>
      `<button class="hb-struct-item" data-key="${s.key}">
         ${_dot(s.key, s.system)}
         <span class="hb-struct-name">${_esc(_nm(s))}</span>
         <span class="hb-struct-loc">${_esc(_f(s, 'loc'))}</span>
       </button>`).join('')}</div>`;
  }
  function _wireStructureList() {
    _panel.querySelectorAll('.hb-struct-item').forEach(b => {
      b.addEventListener('click', () => selectStructure(b.dataset.key));
      b.addEventListener('pointerenter', () => _setHover(b.dataset.key));
      b.addEventListener('pointerleave', () => _setHover(null));
    });
  }

  /* ════════════════════════════ SEARCH ═════════════════════════════ */
  const _norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function _runSearch(q) {
    q = _norm(q.trim());
    const box = _host.querySelector('#hb-results');
    if (!q) { box.innerHTML = ''; box.classList.remove('on'); _searchInput.setAttribute('aria-expanded', 'false'); return; }
    const score = s => _norm(_nm(s)).startsWith(q) ? 0 : _norm(_nm(s)).includes(q) ? 1 : (_norm(s.pt).includes(q) || _norm(s.en).includes(q)) ? 2 : _norm(_f(s, 'fn')).includes(q) ? 3 : 9;
    const hits = STRUCT.map(s => [s, score(s)]).filter(x => x[1] < 9).sort((a, b) => a[1] - b[1]).slice(0, 8).map(x => x[0]);
    box.classList.add('on');
    _searchInput.setAttribute('aria-expanded', 'true');
    box.innerHTML = hits.length ? hits.map((s, i) =>
      `<button class="hb-result" role="option" data-key="${s.key}" id="hb-r${i}">
         ${_dot(s.key, s.system)}
         <b>${_esc(_nm(s))}</b><span class="hb-result-sys">${SYS_BY_ID[s.system].emoji} ${_esc(_sn(SYS_BY_ID[s.system]))}</span>
       </button>`).join('') : `<div class="hb-result-empty">${_t('No match', 'Sem resultados')}</div>`;
    box.querySelectorAll('.hb-result').forEach(b => b.addEventListener('click', () => {
      selectStructure(b.dataset.key);
      _searchInput.value = ''; box.innerHTML = ''; box.classList.remove('on');
    }));
  }

  /* ════════════════════════════ RAIL / CRUMB / TOOLBAR ═════════════ */
  function _highlightRail() {
    _host.querySelectorAll('.hb-sys').forEach(b => {
      const on = b.dataset.sys === _curSys;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const sys = SYS_BY_ID[_curSys];
    _host.style.setProperty('--sys', sys ? sys.color : '#fb7185');
  }
  function _updateCrumb() {
    const parts = [`<button class="hb-cr" data-cr="__all">${_t('Body', 'Corpo')}</button>`];
    if (_curSys && _curSys !== '__all') {
      const sys = SYS_BY_ID[_curSys];
      parts.push(`<span class="hb-cr-sep">›</span><button class="hb-cr${_selKey ? '' : ' on'}" data-cr="sys">${sys.emoji} ${_esc(_sn(sys))}</button>`);
    }
    if (_selKey) parts.push(`<span class="hb-cr-sep">›</span><span class="hb-cr on">${_esc(_nm(STRUCT_BY_KEY[_selKey]))}</span>`);
    _crumb.innerHTML = parts.join('');
    _crumb.querySelectorAll('[data-cr]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.cr === '__all') selectSystem('__all');
      else _clearSelection();
    }));
  }
  function _syncToolbar() {
    if (!_host) return;
    _host.querySelectorAll('[data-tool="isolate"],[data-tool="xray"]').forEach(b => {
      const on = b.dataset.tool === 'isolate' ? _isolate : _xray;
      b.disabled = !_selKey; b.classList.toggle('on', on && !!_selKey); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const lb = _host.querySelector('[data-tool="labels"]');
    if (lb) { lb.classList.toggle('on', _labelsOn); lb.setAttribute('aria-pressed', _labelsOn ? 'true' : 'false'); }
  }
  function _setBusy(on) { _host?.querySelector('#hb-busy')?.classList.toggle('on', !!on); }

  /* ════════════════════════════ LABELS ═════════════════════════════ */
  /* Leader-line labels on the model for the current system's structures.
     Anchors are real surface vertices; labels are decluttered by collision
     (bigger structures win) and re-laid out only when the camera moves. */
  let _anchors = {}, _labelsStale = true, _lastCamSig = '';
  function _anchorFor(key) {
    if (_anchors[key]) return _anchors[key];
    const meshes = key === 'tato' ? [] : (_meshByKey[key] || []).filter(m => !m.userData.iris);
    if (!meshes.length) return null;
    const box = _bounds(meshes); if (!box) return null;
    const ctr = box.getCenter(new THREE.Vector3());
    const pts = _keyPts(key, 400);
    /* the vertex nearest the bbox centre, nudged toward the front */
    const target = ctr.clone().add(_V(0, 0, (box.max.z - box.min.z) * 0.35));
    const a = pts.reduce((m, p) => p.distanceToSquared(target) < m.distanceToSquared(target) ? p : m, pts[0]);
    const size = box.getSize(new THREE.Vector3()).length();
    return (_anchors[key] = { p: a, size });
  }
  function _layoutLabels(force) {
    if (!_labelsEl) return;
    const show = _labelsOn && _curSys && _curSys !== '__all' && !(_isolate && _selKey);
    _labelsEl.hidden = !show;
    if (!show) return;
    const sig = _camera.position.toArray().map(v => v.toFixed(2)).join() + _focus.toArray().map(v => v.toFixed(2)).join();
    if (!force && !_labelsStale && sig === _lastCamSig) return;
    _lastCamSig = sig; _labelsStale = false;
    const W = _vp.clientWidth, H = _vp.clientHeight;
    const list = STRUCT.filter(s => s.system === _curSys && s.key !== 'tato')
      .map(s => ({ s, a: _anchorFor(s.key) })).filter(x => x.a)
      .sort((x, y) => (y.s.key === _selKey) - (x.s.key === _selKey) || y.a.size - x.a.size);
    if (!_labelsEl.__made) _labelsEl.__made = {};
    const made = _labelsEl.__made;
    const placed = [];
    const v = new THREE.Vector3();
    const seen = new Set();
    for (const { s, a } of list) {
      seen.add(s.key);
      let el = made[s.key];
      if (!el) {
        el = document.createElement('button');
        el.className = 'hb-lbl'; el.type = 'button'; el.dataset.key = s.key;
        el.innerHTML = `<i></i><span>${_esc(_nm(s))}</span>`;
        el.addEventListener('click', e => { e.stopPropagation(); selectStructure(s.key); });
        _labelsEl.appendChild(el); made[s.key] = el;
      }
      v.copy(a.p).project(_camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const left = x < W / 2;
      const lw = _nm(s).length * 6.6 + 30, lh = 22;
      const bx0 = left ? x - lw - 34 : x + 34, by0 = y - 34 - lh / 2;
      let ok = v.z < 1 && x > 0 && x < W && y > 0 && y < H && bx0 > 2 && bx0 + lw < W - 2 && by0 > 2;
      if (ok) for (const r of placed) if (bx0 < r[2] + 4 && bx0 + lw > r[0] - 4 && by0 < r[3] + 3 && by0 + lh > r[1] - 3) { ok = false; break; }
      if (ok) placed.push([bx0, by0, bx0 + lw, by0 + lh]);
      el.classList.toggle('off', !ok);
      el.classList.toggle('left', left);
      el.classList.toggle('sel', s.key === _selKey);
      if (ok) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
    Object.keys(made).forEach(k => { if (!seen.has(k)) made[k].classList.add('off'); });
  }

  /* ════════════════════════════ HOVER / PICK ═══════════════════════ */
  const _ray = () => new THREE.Raycaster();
  function _pickAt(clientX, clientY, includeShell) {
    if (!_camera) return null;
    const r = _vp.getBoundingClientRect();
    const m = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = _ray(); ray.setFromCamera(m, _camera);
    const targets = [];
    Object.values(_sysGroup).forEach(g => g.visible && g.traverse(o => {
      if (o.isMesh && o.visible && o.userData.pickable !== false && !(o.material.transparent && o.material.opacity < 0.5 && !o.userData.iris)) targets.push(o);
    }));
    const hit = ray.intersectObjects(targets, false)[0];
    if (hit && hit.object.userData.key) return hit.object.userData.key;
    if (includeShell && _shell && _shell.visible && _curSys === 'sentidos' && ray.intersectObjects(_shellMeshes, false).length) return 'tato';
    return null;
  }
  function _setHover(key) {
    if (key === _hoverKey) return;
    _hoverKey = key;
    _applyView();
  }
  let _hoverRaf = 0, _hoverEv = null;
  function _onHoverMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    _hoverEv = e;
    if (_hoverRaf) return;
    _hoverRaf = requestAnimationFrame(() => {
      _hoverRaf = 0;
      const ev = _hoverEv; if (!ev || _dragging) return;
      const key = _pickAt(ev.clientX, ev.clientY, true);
      _setHover(key);
      _vp.style.cursor = key ? 'pointer' : '';
      if (!_tipEl) return;
      if (key && STRUCT_BY_KEY[key]) {
        const s = STRUCT_BY_KEY[key], r = _vp.getBoundingClientRect();
        _tipEl.innerHTML = `${_dot(key, s.system)}<b>${_esc(_nm(s))}</b>`;
        _tipEl.hidden = false;
        _tipEl.style.transform = `translate(${Math.min(ev.clientX - r.left + 14, r.width - 200)}px, ${ev.clientY - r.top + 16}px)`;
      } else _tipEl.hidden = true;
    });
  }

  /* ════════════════════════════ CONTROLS ═══════════════════════════ */
  let _dragging = false;
  function _pinchDist(pts) { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }

  function _wireControls() {
    const pts = new Map();
    let lx = 0, ly = 0, moved = 0, pinchD = 0, ptype = 'mouse', button = 0;
    _vp.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      ptype = e.pointerType; button = e.button; moved = 0; lx = e.clientX; ly = e.clientY;
      _autoSpin = false; _lastInteract = performance.now();
      if (pts.size === 2) pinchD = _pinchDist(pts);
      _vp.classList.add('grabbing'); _vp.setPointerCapture?.(e.pointerId);
      if (_tipEl) _tipEl.hidden = true;
    });
    _vp.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) { _onHoverMove(e); return; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const d = _pinchDist(pts);
        if (pinchD) _distT = Math.max(0.4, Math.min(90, _distT * (pinchD / (d || 1))));
        pinchD = d; _dirty = true; return;
      }
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) _dragging = true;
      if (button === 2 || e.shiftKey) {           // pan
        const k = _dist * 0.0018;
        const right = _V(Math.cos(_az), 0, -Math.sin(_az));
        _focusT.addScaledVector(right, -dx * k); _focusT.y += dy * k;
        _focus.copy(_focusT);
      } else {
        const k = ptype === 'touch' ? 0.012 : 0.0085;
        _azT -= dx * k;
        _polT = Math.max(0.25, Math.min(Math.PI - 0.25, _polT - dy * k));
      }
      _dirty = true;
    });
    const end = e => {
      const had = pts.has(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchD = 0;
      if (!had) return;
      if (pts.size === 0) {
        _vp.classList.remove('grabbing');
        if (moved < 6) {
          const key = _pickAt(e.clientX, e.clientY, true);
          if (key) selectStructure(key); else _clearSelection();
        }
        setTimeout(() => { _dragging = false; }, 0);
      } else { const p = pts.values().next().value; lx = p.x; ly = p.y; }
    };
    _vp.addEventListener('pointerup', end);
    _vp.addEventListener('pointercancel', end);
    _vp.addEventListener('pointerleave', () => { if (!pts.size) { _setHover(null); if (_tipEl) _tipEl.hidden = true; } });
    _vp.addEventListener('contextmenu', e => e.preventDefault());
    _vp.addEventListener('wheel', e => {
      e.preventDefault();
      _autoSpin = false;
      _distT = Math.max(0.4, Math.min(90, _distT * (e.deltaY > 0 ? 1.1 : 0.9)));
      _dirty = true;
    }, { passive: false });
    /* keyboard: arrows rotate, +/- zoom, Esc clears the selection */
    _vp.tabIndex = 0;
    _vp.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowLeft') _azT += 0.2; else if (k === 'ArrowRight') _azT -= 0.2;
      else if (k === 'ArrowUp') _polT = Math.max(0.25, _polT - 0.15); else if (k === 'ArrowDown') _polT = Math.min(Math.PI - 0.25, _polT + 0.15);
      else if (k === '+' || k === '=') _distT *= 0.88; else if (k === '-') _distT *= 1.12;
      else return;
      e.preventDefault(); _autoSpin = false; _dirty = true;
    });
  }

  /* ════════════════════════════ ANIMATION ══════════════════════════ */
  function _updateCamera() {
    const sp = Math.sin(_pol), cp = Math.cos(_pol);
    _camera.position.set(_focus.x + _dist * sp * Math.sin(_az), _focus.y + _dist * cp, _focus.z + _dist * sp * Math.cos(_az));
    _camera.lookAt(_focus);
  }

  function _resize() {
    if (!_renderer || !_camera || !_vp) return;
    const W = _vp.clientWidth, H = _vp.clientHeight;
    if (!W || !H) return;
    _renderer.setSize(W, H); _camera.aspect = W / H; _camera.updateProjectionMatrix();
    _dirty = true; _labelsStale = true;
  }

  let _t0 = 0;
  function _tick(ts) {
    _raf = requestAnimationFrame(_tick);
    const t = ts * 0.001; if (!_t0) _t0 = t; const dt = Math.min(0.05, t - _t0); _t0 = t;
    const lf = 1 - Math.pow(0.0006, dt);
    if (_autoSpin) _azT += dt * 0.1;
    const before = _az + _pol + _dist + _focus.x + _focus.y + _focus.z;
    _az += (_azT - _az) * lf; _pol += (_polT - _pol) * lf;
    _dist += (_distT - _dist) * lf;
    _focus.lerp(_focusT, lf);
    const moving = Math.abs(before - (_az + _pol + _dist + _focus.x + _focus.y + _focus.z)) > 1e-5;
    /* render on demand: only while something moves or changed */
    if (moving || _dirty || _autoSpin) {
      _updateCamera();
      _renderer.render(_scene, _camera);
      _layoutLabels(_dirty);
      _dirty = false;
    }
  }
  function _start() { if (!_raf) { _t0 = 0; _dirty = true; _raf = requestAnimationFrame(_tick); } }

  /* ════════════════════════════ PUBLIC ═════════════════════════════ */
  const ICON = {
    front: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="2.2"/><path d="M8 21l1-7-2-4 5-2 5 2-2 4 1 7"/></svg>',
    side: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="2.2"/><path d="M11 21l1-7-1-4 2-2 1 4-1 9"/></svg>',
    labels: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9l3 3-3 3H4z"/><path d="M8 17h12"/></svg>',
    xray: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 7v10M9 9h6M9 12h6M9 15h6"/></svg>',
    isolate: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/></svg>',
  };

  async function mount(host) {
    _mounted = true;
    host.innerHTML = `<div class="hb-wrap"><div class="hb3d-loading" style="position:static;flex:1">
      <div class="ex-loading-spinner"></div><div>${_t('Loading the 3D atlas…', 'A carregar o atlas 3D…')}</div></div></div>`;

    if (!(await _loadThree()) || !(await _loadManifest())) {
      host.innerHTML = `<div class="hb-wrap"><div class="hb3d-loading" style="position:static;flex:1">
        <div class="ex-error-icon">⚠</div><div>${_t('Could not load the 3D atlas.', 'Não foi possível carregar o atlas 3D.')}</div></div></div>`;
      return;
    }

    let labelsPref = null; try { labelsPref = localStorage.getItem('hb-labels'); } catch (e) {}
    _labelsOn = labelsPref == null ? window.innerWidth > 820 : labelsPref === '1';

    host.innerHTML = `
      <div class="hb-wrap hb2">
        <div class="hb-top">
          <nav class="hb-crumb" id="hb-crumb" aria-label="${_t('Location', 'Localização')}"></nav>
          <div class="hb-search" role="combobox" aria-haspopup="listbox">
            <svg class="hb-search-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input id="hb-search-input" type="search" aria-expanded="false" aria-controls="hb-results" aria-label="${_t('Search the body', 'Pesquisar no corpo')}" placeholder="${_t('Search a bone, muscle, organ…', 'Procurar osso, músculo, órgão…')}" autocomplete="off">
            <div class="hb-results" id="hb-results" role="listbox"></div>
          </div>
        </div>
        <div class="hb-body">
          <nav class="hb-rail2" id="hb-rail" aria-label="${_t('Body systems', 'Sistemas do corpo')}">
            <button class="hb-sys" data-sys="__all" style="--c:#fb7185"><span class="hb-sys-ic">🧍</span><span class="hb-sys-lbl">${_t('Whole body', 'Corpo completo')}</span></button>
            ${SYS.map(s => `<button class="hb-sys" data-sys="${s.id}" style="--c:${s.color}"><span class="hb-sys-ic">${s.emoji}</span><span class="hb-sys-lbl">${_esc(_sn(s))}</span></button>`).join('')}
          </nav>
          <div class="hb-stage2">
            <div class="hb3d-viewport" id="hb3d-vp" aria-label="${_t('3D model — drag to rotate, scroll to zoom, click a part', 'Modelo 3D — arrasta para rodar, scroll para zoom, clica numa parte')}"></div>
            <div class="hb-labels" id="hb-labels"></div>
            <div class="hb-tip" id="hb-tip" hidden></div>
            <div class="hb-busy" id="hb-busy"><span></span>${_t('Loading…', 'A carregar…')}</div>
            <div class="hb-tools" role="toolbar" aria-label="${_t('View tools', 'Ferramentas de vista')}">
              <div class="hb-tool-grp">
                <button class="hb-tool" data-view="0" title="${_t('Front', 'Frente')}">${ICON.front}<span>${_t('Front', 'Frente')}</span></button>
                <button class="hb-tool" data-view="1.5708" title="${_t('Side', 'Lado')}">${ICON.side}<span>${_t('Side', 'Lado')}</span></button>
                <button class="hb-tool" data-view="3.1416" title="${_t('Back', 'Costas')}">${ICON.front}<span>${_t('Back', 'Costas')}</span></button>
              </div>
              <div class="hb-tool-grp">
                <button class="hb-tool" data-tool="labels" title="${_t('Labels', 'Etiquetas')}">${ICON.labels}<span>${_t('Labels', 'Etiquetas')}</span></button>
                <button class="hb-tool" data-tool="xray" title="${_t('X-ray (select a part first)', 'Raio-X (escolhe uma parte)')}" disabled>${ICON.xray}<span>${_t('X-ray', 'Raio-X')}</span></button>
                <button class="hb-tool" data-tool="isolate" title="${_t('Isolate (select a part first)', 'Isolar (escolhe uma parte)')}" disabled>${ICON.isolate}<span>${_t('Isolate', 'Isolar')}</span></button>
                <button class="hb-tool" data-tool="reset" title="${_t('Reset view', 'Repor vista')}">${ICON.reset}</button>
              </div>
            </div>
            <div class="hb-credit">BodyParts3D © DBCLS · CC BY-SA 2.1 JP</div>
            <div class="hb3d-loading" id="hb3d-loading">
              <div class="ex-loading-spinner"></div>
              <div>${_t('Loading the 3D atlas…', 'A carregar o atlas 3D…')}</div>
            </div>
          </div>
          <aside class="hb-info hb-info2" id="hb-info" aria-live="polite"></aside>
        </div>
      </div>`;

    _host = host.querySelector('.hb-wrap');
    _vp = host.querySelector('#hb3d-vp');
    _panel = host.querySelector('#hb-info');
    _crumb = host.querySelector('#hb-crumb');
    _searchInput = host.querySelector('#hb-search-input');
    _labelsEl = host.querySelector('#hb-labels');
    _tipEl = host.querySelector('#hb-tip');

    _host.querySelector('#hb-rail').addEventListener('click', e => {
      const b = e.target.closest('.hb-sys'); if (b) selectSystem(b.dataset.sys);
    });
    _host.querySelector('.hb-tools').addEventListener('click', e => {
      const b = e.target.closest('.hb-tool'); if (!b || b.disabled) return;
      if (b.dataset.view != null) { _setView(parseFloat(b.dataset.view)); return; }
      const t = b.dataset.tool;
      if (t === 'labels') { _labelsOn = !_labelsOn; try { localStorage.setItem('hb-labels', _labelsOn ? '1' : '0'); } catch (er) {} _labelsStale = true; _dirty = true; _syncToolbar(); }
      else if (t === 'xray' || t === 'isolate') _toggleMode(t);
      else if (t === 'reset') { _azT = 0.35; if (_selKey) _frameStructure(_selKey); else _frameSystem(_curSys); _autoSpin = !_selKey; }
    });
    _searchInput.addEventListener('input', () => _runSearch(_searchInput.value));
    _searchInput.addEventListener('focus', () => _runSearch(_searchInput.value));
    _searchInput.addEventListener('keydown', e => {
      const box = _host.querySelector('#hb-results');
      const items = [...box.querySelectorAll('.hb-result')];
      if (!items.length) return;
      let i = items.findIndex(x => x.classList.contains('focused'));
      if (e.key === 'ArrowDown') i = Math.min(items.length - 1, i + 1);
      else if (e.key === 'ArrowUp') i = Math.max(0, i - 1);
      else if (e.key === 'Enter') { (items[i] || items[0]).click(); e.preventDefault(); return; }
      else if (e.key === 'Escape') { box.classList.remove('on'); return; }
      else return;
      e.preventDefault();
      items.forEach((x, k) => x.classList.toggle('focused', k === i));
      _searchInput.setAttribute('aria-activedescendant', items[i]?.id || '');
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.hb-search')) _host?.querySelector('#hb-results')?.classList.remove('on');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _selKey && _host && _host.isConnected && _host.offsetParent && !e.target.closest('input')) _clearSelection();
    });

    _buildScene();
    _wireControls();
    _syncToolbar();
    _start();
    host.querySelector('#hb3d-loading')?.remove();

    await selectSystem(SYS[0]?.id || '__all', true);
  }

  function resume() { if (_mounted && _built && !_raf) _start(); setTimeout(_resize, 60); }
  function stop() { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } }

  /* Headless verification probe: camera / state. */
  function _dbg(o) {
    o = o || {};
    if (o.az != null) { _az = _azT = o.az; } if (o.pol != null) { _pol = _polT = o.pol; }
    if (o.dist != null) { _dist = _distT = o.dist; }
    if (o.fy != null && _focus) { _focus.y = _focusT.y = o.fy; }
    if (o.fx != null && _focus) { _focus.x = _focusT.x = o.fx; }
    if (o.fz != null && _focus) { _focus.z = _focusT.z = o.fz; }
    if (o.spin != null) _autoSpin = o.spin;
    if (o.key) {   // bounds of one structure's geometry, per side
      const pts = _keyPts(o.key, 4000), f = v => v.toArray().map(x => +x.toFixed(2));
      const bx = q => { if (!q.length) return null; const b = new THREE.Box3().setFromPoints(q); return [f(b.min), f(b.max)]; };
      return { right: bx(pts.filter(p => p.x < 0)), left: bx(pts.filter(p => p.x >= 0)) };
    }
    _dirty = true;
    const box = _bounds(Object.values(_sysGroup).concat(_shell ? [_shell] : []));
    return { box: box ? [box.min.toArray().map(v => +v.toFixed(2)), box.max.toArray().map(v => +v.toFixed(2))] : null,
      focus: _focus.toArray().map(v => +v.toFixed(2)), dist: +_dist.toFixed(2), sys: _curSys, sel: _selKey, augMs: _augMs,
      meshes: Object.fromEntries(Object.entries(_meshByKey).map(([k, v]) => [k, v.length])) };
  }

  return { mount, resume, stop, _dbg };
})();
