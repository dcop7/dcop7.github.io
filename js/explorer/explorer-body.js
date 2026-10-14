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

  /* Structures with no BodyParts3D mesh, built procedurally at runtime and
     injected into the manifest so search / lists / labels treat them alike. */
  const EXTRA_STRUCT = [
    { key: 'medula', system: 'nervoso', pt: 'Medula espinal', en: 'Spinal cord',
      fn_pt: 'A "autoestrada" de sinais entre o cérebro e o corpo — e centro dos reflexos, que respondem sem esperar pelo cérebro.',
      fn_en: 'The signal highway between brain and body — and the centre of reflexes, which react without waiting for the brain.',
      loc_pt: 'Dentro da coluna vertebral', loc_en: 'Inside the spine',
      facts_pt: ['Mede ~45 cm e termina por volta da 1.ª vértebra lombar.', 'Abaixo dela, as raízes nervosas formam a "cauda de cavalo".'],
      facts_en: ['It is ~45 cm long and ends around the 1st lumbar vertebra.', 'Below it, the nerve roots form the "horse’s tail" (cauda equina).'] },
    { key: 'nervos', system: 'nervoso', pt: 'Nervos periféricos', en: 'Peripheral nerves',
      fn_pt: 'Levam as ordens do cérebro aos músculos e trazem as sensações da pele e dos órgãos.',
      fn_en: 'Carry the brain’s orders to the muscles and bring back sensations from skin and organs.',
      loc_pt: 'Por todo o corpo', loc_en: 'Throughout the body',
      facts_pt: ['O nervo ciático é o maior do corpo — na origem, tem quase a largura de um polegar.', 'Os sinais mais rápidos viajam a ~120 m/s, mais de 400 km/h.', 'Entre as costelas correm os nervos intercostais.'],
      facts_en: ['The sciatic nerve is the body’s largest — almost a thumb wide where it starts.', 'The fastest signals travel at ~120 m/s, over 400 km/h.', 'Intercostal nerves run between the ribs.'] },
    { key: 'paladar', system: 'sentidos', pt: 'Língua (paladar)', en: 'Tongue (taste)',
      fn_pt: 'Deteta cinco sabores — doce, salgado, ácido, amargo e umami — e ajuda a mastigar, engolir e falar.',
      fn_en: 'Senses five tastes — sweet, salty, sour, bitter and umami — and helps chewing, swallowing and speech.',
      loc_pt: 'Boca', loc_en: 'Mouth',
      facts_pt: ['Tem ~10 000 papilas gustativas, renovadas a cada 1–2 semanas.', 'Grande parte do "sabor" é, na verdade, olfato.'],
      facts_en: ['It has ~10,000 taste buds, renewed every 1–2 weeks.', 'Much of what we call "flavour" is really smell.'] },
    { key: 'tato', system: 'sentidos', pt: 'Pele (tato)', en: 'Skin (touch)',
      fn_pt: 'O maior órgão do corpo: sente toque, pressão, vibração, calor, frio e dor — e protege-nos do exterior.',
      fn_en: 'The body’s largest organ: senses touch, pressure, vibration, heat, cold and pain — and shields us from the outside.',
      loc_pt: 'Todo o corpo', loc_en: 'The whole body',
      facts_pt: ['Num adulto cobre ~2 m² e pesa ~4 kg.', 'As pontas dos dedos estão entre as zonas mais sensíveis do corpo.'],
      facts_en: ['In an adult it covers ~2 m² and weighs ~4 kg.', 'The fingertips are among the most sensitive areas of the body.'] },
  ];

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
  };
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
      STRUCT = (MANIFEST.structures || []).concat(EXTRA_STRUCT.map(s => ({ ...s, procedural: true })));
      SYS.forEach(s => SYS_BY_ID[s.id] = s);
      STRUCT.forEach(s => STRUCT_BY_KEY[s.key] = s);
      /* keep each system's structures in a sensible reading order */
      const order = ['medula', 'nervos'];
      STRUCT.sort((a, b) => (SYS.findIndex(s => s.id === a.system) - SYS.findIndex(s => s.id === b.system)) ||
        (order.indexOf(a.key) - order.indexOf(b.key)));
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
          _register(o, sysId, key, _colorFor(sysId, key));
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
      _skinPts = null;
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

  /* Skin points (for "stay inside the body" clamping + superficial vessels). */
  let _skinPts = null;
  function _skin() {
    if (_skinPts) return _skinPts;
    _skinPts = [];
    const v = new THREE.Vector3();
    _shellMeshes.forEach(m => {
      const pos = m.geometry.attributes.position; m.updateWorldMatrix(true, false);
      const step = Math.max(1, Math.ceil(pos.count / 9000));
      for (let i = 0; i < pos.count; i += step) _skinPts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
    });
    return _skinPts;
  }
  /* Distance from p to the skin along unit direction d (nearest skin vertex
     inside a narrow cone). Infinity if no skin data. */
  function _skinDist(p, d) {
    const pts = _skin(); if (!pts.length) return Infinity;
    let best = Infinity;
    const q = new THREE.Vector3();
    for (const s of pts) {
      q.subVectors(s, p);
      const along = q.dot(d); if (along <= 0) continue;
      const perp2 = q.lengthSq() - along * along;
      if (perp2 < Math.pow(0.05 + along * 0.18, 2) && along < best) best = along;
    }
    return best;
  }
  /* Point at bone parameter t, offset by (medial om, anterior of), clamped to
     stay `inset` inside the skin. sup=true → pushed out to just under the
     skin (superficial veins). */
  function _at(ax, t, sx, om, of, sup, inset) {
    const fr = _frame(ax, t, sx);
    const o = fr.m.clone().multiplyScalar(om).addScaledVector(fr.f, of);
    const L = o.length(); if (L < 1e-6) return fr.p;
    const d = o.clone().divideScalar(L);
    const sd = _skinDist(fr.p, d);
    const ins = inset == null ? 0.07 : inset;
    const len = sup ? (isFinite(sd) ? sd - ins : L) : Math.min(L, isFinite(sd) ? sd - ins : L);
    return fr.p.addScaledVector(d, Math.max(0.02, len));
  }

  /* Tapered tube along a smooth curve (TubeGeometry can't taper). */
  function _tube(grp, pts, r0, r1, mat, key, sysId) {
    pts = pts.filter(Boolean);
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength();
    const seg = Math.max(12, Math.min(160, Math.round(L * 22))), rad = 10;
    const fr = curve.computeFrenetFrames(seg, false);
    const pos = [], idx = [], P = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      curve.getPointAt(i / seg, P);
      const t = i / seg, r = r0 + (r1 - r0) * t;
      const N = fr.normals[i], B = fr.binormals[i];
      for (let j = 0; j < rad; j++) {
        const a = j / rad * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        pos.push(P.x + ca * N.x + sa * B.x, P.y + ca * N.y + sa * B.y, P.z + ca * N.z + sa * B.z);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * rad + j, b = i * rad + (j + 1) % rad, c = (i + 1) * rad + (j + 1) % rad, d = (i + 1) * rad + j;
      idx.push(a, d, b, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.userData.proc = true;
    _register(m, sysId, key, mat.color.clone(), mat);   // one shared material per tree
    grp.add(m);
  }

  /* ═════════════════════ PROCEDURAL: VESSELS ═══════════════════════ */
  const _augmented = new Set();

  function _limbRig(sx) {
    const side = sx < 0 ? 'right' : 'left';
    const S = '^' + side + ' ';
    const P = re => _partPts(GHOST_SYS, re, 1800);
    const hand = P(new RegExp('^' + side + ' \\w+ metacarpal|phalanx of ' + side + ' (thumb|\\w+ finger)|^' + side + ' (scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)', 'i'));
    const foot = P(new RegExp('^' + side + ' (\\w+ metatarsal|calcaneus|talus|navicular|cuboid|\\w+ cuneiform)|phalanx of ' + side + ' \\w+ toe', 'i'));
    const digit = (re, base) => {
      const tipPts = P(new RegExp('distal phalanx of ' + side + ' ' + re, 'i'));
      const proxPts = P(new RegExp('proximal phalanx of ' + side + ' ' + re, 'i'));
      if (!tipPts.length || !proxPts.length) return null;
      const far = p => p.distanceTo(base);
      return { base: proxPts.reduce((m, p) => far(p) < far(m) ? p : m, proxPts[0]), tip: _argmax(tipPts, far) };
    };
    const rig = {
      sx, hum: _axis(P(new RegExp(S + 'humerus$', 'i'))), rad: _axis(P(new RegExp(S + 'radius$', 'i'))),
      uln: _axis(P(new RegExp(S + 'ulna$', 'i'))), fem: _axis(P(new RegExp(S + 'femur$', 'i'))),
      tib: _axis(P(new RegExp(S + 'tibia$', 'i'))), fib: _axis(P(new RegExp(S + 'fibula$', 'i'))),
      handC: _centroid(hand), footC: _centroid(foot), hand, foot,
    };
    if (rig.rad && rig.handC) {
      const wrist = rig.rad.b;
      rig.fingers = ['thumb', 'index finger', 'middle finger', 'ring finger', 'little finger'].map(n => digit(n, wrist)).filter(Boolean);
    }
    if (rig.tib && rig.footC) {
      const ankle = rig.tib.b;
      rig.toes = ['big toe', 'second toe', 'third toe', 'fourth toe', 'little toe'].map(n => digit(n, ankle)).filter(Boolean);
    }
    return rig;
  }

  function _vesselMats() {
    const mk = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25, envMapIntensity: 0.8 });
    return { A: mk(REAL.arterias), V: mk(REAL.veias) };
  }

  function _addVessels(grp) {
    if (!_sysGroup[GHOST_SYS]) return;
    const { A, V } = _vesselMats();
    const art = (pts, r0, r1) => _tube(grp, pts, r0, r1, A, 'arterias', 'circulatorio');
    const vein = (pts, r0, r1) => _tube(grp, pts, r0, r1, V, 'veias', 'circulatorio');
    const C = 'circulatorio';

    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'right' : 'left';
      const R = _limbRig(sx);
      const outward = p => Math.abs(p.x);

      /* ── ARM ── */
      const subA = _partPts(C, new RegExp('^' + side + ' subclavian artery$', 'i'));
      const subV = _partPts(C, new RegExp('^' + side + ' subclavian vein$', 'i'));
      if (R.hum && R.rad && R.uln) {
        const h = R.hum, ra = R.rad, ul = R.uln;
        const a0 = subA.length ? _argmax(subA, outward) : null;
        /* axillary → brachial (medial to the humerus) → cubital fossa */
        const brach = [a0, _at(h, 0.06, sx, 0.2, 0.06), _at(h, 0.3, sx, 0.17, 0.05), _at(h, 0.6, sx, 0.14, 0.07),
                       _at(h, 0.88, sx, 0.08, 0.12), _at(h, 1.0, sx, 0.02, 0.15)];
        art(brach, 0.042, 0.032);
        const fossa = brach[brach.length - 1];
        /* radial (thumb side) and ulnar (little-finger side) arteries */
        const radialA = [fossa, _at(ra, 0.12, sx, -0.02, 0.09), _at(ra, 0.5, sx, -0.04, 0.07), _at(ra, 0.97, sx, -0.02, 0.06)];
        const ulnarA = [fossa, _at(ul, 0.15, sx, 0.03, 0.1), _at(ul, 0.5, sx, 0.05, 0.08), _at(ul, 0.97, sx, 0.04, 0.06)];
        art(radialA, 0.028, 0.02); art(ulnarA, 0.03, 0.021);
        /* deep veins alongside (venae comitantes) */
        const v0 = subV.length ? _argmax(subV, outward) : null;
        vein([v0, _at(h, 0.06, sx, 0.24, 0.02), _at(h, 0.3, sx, 0.21, 0.01), _at(h, 0.6, sx, 0.18, 0.03), _at(h, 0.88, sx, 0.12, 0.08), _at(h, 1.0, sx, 0.05, 0.11)], 0.04, 0.03);
        vein([_at(h, 1.0, sx, 0.05, 0.11), _at(ul, 0.15, sx, 0.07, 0.06), _at(ul, 0.5, sx, 0.09, 0.05), _at(ul, 0.97, sx, 0.08, 0.03)], 0.026, 0.02);
        /* superficial veins just under the skin: cephalic (lateral) and basilic (medial) */
        vein([_at(ra, 0.97, sx, -0.5, 0.25, true, 0.05), _at(ra, 0.5, sx, -0.5, 0.2, true, 0.05), _at(ra, 0.05, sx, -0.6, 0.3, true, 0.05),
              _at(h, 0.6, sx, -0.6, 0.45, true, 0.05), _at(h, 0.15, sx, -0.3, 0.8, true, 0.06), v0], 0.022, 0.03);
        vein([_at(ul, 0.97, sx, 0.6, 0.15, true, 0.05), _at(ul, 0.5, sx, 0.7, 0.1, true, 0.05), _at(h, 0.95, sx, 0.8, 0.15, true, 0.05),
              _at(h, 0.55, sx, 0.4, 0.05)], 0.02, 0.026);
        /* palm: arch + digital vessels to every fingertip (palmar side) */
        if (R.fingers && R.fingers.length) {
          const wristR = radialA[radialA.length - 1], wristU = ulnarA[ulnarA.length - 1];
          const bases = R.fingers.map(fg => fg.base.clone().add(_V(0, 0, 0.04)));
          const archMid = _centroid(bases.slice(1)).lerp(_centroid([wristR, wristU]), 0.45).add(_V(0, 0, 0.05));
          art([wristU, archMid, wristR], 0.018, 0.015);
          R.fingers.forEach((fg, i) => {
            const start = i === 0 ? wristR : archMid;
            const mid = fg.base.clone().lerp(fg.tip, 0.5).add(_V(0, 0, 0.03));
            art([start, fg.base.clone().add(_V(0, 0, 0.035)), mid, fg.tip.clone().add(_V(0, 0.01, 0.015))], 0.013, 0.006);
            vein([archMid.clone().add(_V(0, 0.02, -0.05)), fg.base.clone().add(_V(0.012 * sx, 0, -0.02)), fg.tip.clone().add(_V(0.01 * sx, 0.015, -0.01))], 0.011, 0.005);
          });
        }
      }

      /* ── LEG ── */
      const ilA = _partPts(C, new RegExp('^' + side + ' external iliac artery$', 'i'));
      const ilV = _partPts(C, new RegExp('^' + side + ' external iliac vein$', 'i'));
      if (R.fem && R.tib) {
        const fm = R.fem, tb = R.tib, fb = R.fib || R.tib;
        const a0 = ilA.length ? _argmax(ilA, p => -p.y) : _at(fm, 0, sx, 0.3, 0.2);
        /* femoral (anteromedial) → adductor canal → popliteal (behind the knee) */
        const fem = [a0, _at(fm, 0.08, sx, 0.26, 0.24), _at(fm, 0.3, sx, 0.24, 0.14), _at(fm, 0.55, sx, 0.2, 0.04),
                     _at(fm, 0.78, sx, 0.14, -0.1), _at(fm, 0.95, sx, 0.03, -0.17)];
        art(fem, 0.052, 0.042);
        const pop = _at(tb, 0.06, sx, 0.0, -0.15);
        art([fem[fem.length - 1], pop], 0.042, 0.04);
        /* deep femoral branch (profunda femoris) */
        art([_at(fm, 0.12, sx, 0.25, 0.2), _at(fm, 0.3, sx, 0.1, -0.08), _at(fm, 0.6, sx, 0.05, -0.12)], 0.034, 0.018);
        /* anterior tibial → dorsalis pedis; posterior tibial → behind the medial malleolus */
        const between = t => tb.a.clone().addScaledVector(tb.dir, tb.len * t).lerp(fb.a.clone().addScaledVector(fb.dir, fb.len * t), 0.45);
        const antTib = [pop, between(0.12).add(_V(0, 0, 0.08)), between(0.5).add(_V(0, 0, 0.1)), _at(tb, 0.97, sx, -0.05, 0.16)];
        art(antTib, 0.03, 0.022);
        const postTib = [pop, _at(tb, 0.2, sx, 0.06, -0.14), _at(tb, 0.6, sx, 0.09, -0.12), _at(tb, 0.98, sx, 0.13, -0.08)];
        art(postTib, 0.032, 0.022);
        /* foot: dorsalis pedis to the toes */
        if (R.toes && R.toes.length) {
          const ank = antTib[antTib.length - 1];
          const dors = _centroid(R.toes.map(t => t.base)).lerp(ank, 0.5).add(_V(0, 0.05, 0));
          art([ank, dors], 0.022, 0.018);
          R.toes.forEach(t => {
            art([dors, t.base.clone().add(_V(0, 0.03, 0)), t.tip.clone().add(_V(0, 0.02, 0))], 0.012, 0.006);
          });
          /* posterior tibial continues as the plantar artery (sole) */
          const plant = _centroid(R.toes.map(t => t.base)).lerp(postTib[postTib.length - 1], 0.5).add(_V(0, -0.04, 0));
          art([postTib[postTib.length - 1], plant, R.toes[0].base.clone().add(_V(0, -0.03, 0))], 0.02, 0.012);
        }
        /* deep veins: femoral + popliteal + tibial, alongside */
        const v0 = ilV.length ? _argmax(ilV, p => -p.y) : null;
        vein([v0, _at(fm, 0.08, sx, 0.34, 0.18), _at(fm, 0.3, sx, 0.3, 0.08), _at(fm, 0.55, sx, 0.25, -0.02),
              _at(fm, 0.78, sx, 0.18, -0.15), _at(fm, 0.95, sx, 0.07, -0.21), _at(tb, 0.06, sx, 0.05, -0.19),
              _at(tb, 0.2, sx, 0.11, -0.17), _at(tb, 0.6, sx, 0.13, -0.15), _at(tb, 0.98, sx, 0.17, -0.1)], 0.055, 0.03);
        /* great saphenous vein: just under the skin on the inner leg, foot → groin */
        if (R.toes && R.toes.length) {
          const sap = [R.toes[0].base.clone().lerp(R.footC, 0.3).add(_V(0, 0.07, 0)),
                       _at(tb, 0.98, sx, 0.4, 0.25, true, 0.04), _at(tb, 0.6, sx, 0.8, 0.05, true, 0.05), _at(tb, 0.15, sx, 0.8, -0.2, true, 0.05),
                       _at(fm, 0.85, sx, 0.8, -0.15, true, 0.05), _at(fm, 0.5, sx, 0.8, 0.15, true, 0.05), _at(fm, 0.15, sx, 0.4, 0.4, true, 0.08), v0];
          vein(sap, 0.026, 0.034);
        }
        /* small saphenous: lateral ankle → back of the calf → popliteal */
        vein([_at(tb, 0.98, sx, -0.6, -0.3, true, 0.05), _at(tb, 0.55, sx, -0.1, -0.9, true, 0.05), _at(tb, 0.1, sx, 0.0, -0.9, true, 0.06), _at(tb, 0.06, sx, 0.05, -0.19)], 0.02, 0.026);
      }

      /* ── HEAD & NECK (from the real carotid / jugular tops, under the skin) ── */
      const car = _partPts(C, new RegExp('^' + side + ' common carotid artery$', 'i'));
      const jug = _partPts(C, new RegExp('^' + side + ' internal jugular vein$', 'i'));
      const skull = _partPts(GHOST_SYS, /(frontal|parietal|temporal|occipital|sphenoid|zygomatic|maxilla)/i, 3000);
      const mand = _partPts(GHOST_SYS, /^mandible$/i, 1200);
      if (car.length && skull.length) {
        const top = _argmax(car, p => p.y);
        const hc = _centroid(skull);
        const sideMand = mand.filter(p => p.x * sx > 0);
        const angle = sideMand.length ? _argmax(sideMand, p => -p.y - p.z * 0.9) : top.clone().add(_V(sx * 0.3, 0.4, 0));
        const chinTop = mand.length ? _argmax(mand, p => p.z + p.y * 0.3) : angle;
        /* a point on the head's surface, `inset` under the skin, in direction d */
        const head = (dx, dy, dz, inset) => {
          const d = _V(dx * sx, dy, dz).normalize();
          const sd = _skinDist(hc, d);
          return hc.clone().addScaledVector(d, isFinite(sd) ? sd - (inset || 0.05) : 0.9);
        };
        const ext = top.clone().lerp(angle, 0.55).add(_V(0, 0, 0.05));
        art([top, ext, angle.clone().add(_V(-sx * 0.05, 0.05, 0.05))], 0.028, 0.022);
        /* facial artery: over the jaw to the corner of the mouth and the nose */
        const mouth = chinTop.clone().add(_V(sx * 0.2, 0.18, -0.02));
        art([angle.clone().add(_V(0, 0.02, 0.08)), angle.clone().lerp(chinTop, 0.45).add(_V(sx * 0.06, -0.02, 0.02)), mouth, head(0.35, 0.05, 1, 0.05)], 0.018, 0.009);
        /* superficial temporal: in front of the ear onto the temple and scalp */
        const temp = [angle.clone().add(_V(0, 0.08, -0.05)), head(1, -0.1, 0.05, 0.05), head(1, 0.35, 0.25, 0.05), head(0.7, 0.75, 0.35, 0.05), head(0.3, 0.95, 0.2, 0.05)];
        art(temp, 0.018, 0.008);
        art([temp[2], head(0.85, 0.6, -0.35, 0.05), head(0.45, 0.85, -0.5, 0.05)], 0.012, 0.006);
        /* occipital artery: back of the head */
        art([top.clone().lerp(angle, 0.3), head(0.55, -0.15, -0.85, 0.06), head(0.35, 0.45, -0.9, 0.05)], 0.016, 0.008);
        /* veins: external jugular down the side of the neck + facial vein */
        if (jug.length) {
          const jt = _argmax(jug, p => p.y);
          vein([jt, angle.clone().add(_V(sx * 0.04, 0.03, -0.06)), head(1, -0.05, -0.15, 0.06), head(0.85, 0.5, -0.1, 0.05)], 0.03, 0.012);
          vein([angle.clone().add(_V(0, -0.02, 0.06)), angle.clone().lerp(chinTop, 0.5).add(_V(sx * 0.08, 0.04, 0)), head(0.42, 0.1, 1, 0.06), head(0.3, 0.35, 1, 0.06)], 0.02, 0.01);
        }
      }
    }

    /* ── intercostal vessels along the lower edge of ribs 3–9 ── */
    _ribPaths().forEach(r => {
      art(r.path.map(p => p.clone().add(_V(0, -0.025, 0))), 0.014, 0.008);
      vein(r.path.map(p => p.clone().add(_V(0, 0.0, -0.02))), 0.014, 0.008);
    });
  }

  /* Each rib (3rd–9th, both sides) as an ordered path following its lower
     border, from the spine round to the front — for intercostal vessels and
     nerves. */
  function _ribPaths() {
    if (_ribCache) return _ribCache;
    const names = ['third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
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
  function _cordPath() {
    const vert = _partPts(GHOST_SYS, /^(atlas|axis|(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (cervical|thoracic|lumbar) vertebra)$/i, 9000);
    if (vert.length < 100) return null;
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
    return path.map((p, i) => {
      const w = path.slice(Math.max(0, i - 2), i + 3);
      return _V(0, p.y, w.reduce((s, q) => s + q.z, 0) / w.length);
    });
  }

  function _addNerves(grp) {
    if (!_sysGroup[GHOST_SYS]) return;
    const mk = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.8 });
    const Mc = mk(REAL.medula), Mn = mk(REAL.nervos);
    const nerve = (pts, r0, r1) => _tube(grp, pts, r0, r1, Mn, 'nervos', 'nervoso');

    const cord = _cordPath();
    const stem = _keyPts('troncocerebral', 400);
    if (cord && cord.length > 4) {
      const start = stem.length ? _argmax(stem, p => -p.y) : null;
      _tube(grp, [start, ...cord], 0.06, 0.042, Mc, 'medula', 'nervoso');
      /* cauda equina: a fan of roots down to the sacrum */
      const sac = _partPts(GHOST_SYS, /^sacrum$/i, 600);
      const end = cord[cord.length - 1];
      if (sac.length) {
        const sc = _centroid(sac);
        for (let i = -2; i <= 2; i++) nerve([end, end.clone().lerp(sc, 0.5).add(_V(i * 0.025, 0, -0.02)), sc.clone().add(_V(i * 0.05, -0.15, -0.05))], 0.012, 0.008);
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
        const h = R.hum, ra = R.rad, ul = R.uln;
        const root = cordAt(h.a.y + 0.55);
        const axilla = _at(h, 0.08, sx, 0.3, 0.0);
        const plexus = root ? [root, root.clone().lerp(axilla, 0.45).add(_V(0, -0.05, 0.08)), axilla] : [axilla];
        nerve(plexus, 0.04, 0.035);
        /* median: with the brachial artery, then down the middle of the forearm */
        const midFore = t => ra.a.clone().addScaledVector(ra.dir, ra.len * t).lerp(ul.a.clone().addScaledVector(ul.dir, ul.len * t), 0.5).add(_V(0, 0, 0.1));
        const median = [axilla, _at(h, 0.3, sx, 0.2, 0.08), _at(h, 0.65, sx, 0.15, 0.1), _at(h, 1.0, sx, 0.05, 0.17), midFore(0.3), midFore(0.75), midFore(0.99)];
        nerve(median, 0.028, 0.02);
        /* ulnar: behind the medial epicondyle ("funny bone"), along the ulna */
        const ulnar = [axilla, _at(h, 0.35, sx, 0.22, -0.02), _at(h, 0.75, sx, 0.2, -0.08), _at(h, 0.98, sx, 0.17, -0.1), _at(ul, 0.2, sx, 0.08, 0.02), _at(ul, 0.6, sx, 0.08, 0.04), _at(ul, 0.99, sx, 0.06, 0.04)];
        nerve(ulnar, 0.024, 0.018);
        /* radial: spirals behind the humerus, then down the thumb side */
        const radial = [axilla, _at(h, 0.25, sx, 0.05, -0.17), _at(h, 0.5, sx, -0.12, -0.12), _at(h, 0.8, sx, -0.15, 0.06), _at(h, 0.98, sx, -0.1, 0.12), _at(ra, 0.3, sx, -0.08, 0.06), _at(ra, 0.7, sx, -0.08, 0.02), _at(ra, 0.99, sx, -0.1, -0.02)];
        nerve(radial, 0.026, 0.017);
        if (R.fingers) {
          const wristM = median[median.length - 1], wristU = ulnar[ulnar.length - 1];
          R.fingers.forEach((fg, i) => {
            const from = i >= 3 ? wristU : wristM;
            nerve([from, fg.base.clone().add(_V(-0.012 * sx, 0, 0.03)), fg.tip.clone().add(_V(-0.01 * sx, 0.01, 0.01))], 0.011, 0.005);
          });
        }
      }
      /* ── leg: femoral (front) and sciatic (back) ── */
      if (R.fem && R.tib) {
        const fm = R.fem, tb = R.tib, fb = R.fib || R.tib;
        const l1 = cord && cord.length ? cord[cord.length - 1] : null;
        const groin = _at(fm, 0.06, sx, 0.15, 0.28);
        if (l1) {
          const psoas = _V(sx * 0.32, (l1.y + groin.y) / 2, l1.z + 0.15);
          nerve([l1, psoas, groin], 0.034, 0.03);
        }
        nerve([groin, _at(fm, 0.2, sx, 0.15, 0.3), _at(fm, 0.4, sx, 0.05, 0.32)], 0.026, 0.014);
        nerve([groin, _at(fm, 0.18, sx, 0.35, 0.2), _at(fm, 0.6, sx, 0.4, 0.1), _at(tb, 0.3, sx, 0.4, 0.05), _at(tb, 0.95, sx, 0.25, 0.1)], 0.016, 0.01); /* saphenous nerve */
        const sac = _partPts(GHOST_SYS, /^sacrum$/i, 600);
        const sacL = sac.length ? _argmax(sac, p => p.x * sx - Math.abs(p.y - _centroid(sac).y) * 0.6) : null;
        /* sciatic: through the greater sciatic notch, down the back of the thigh */
        const sci = [sacL, _at(fm, 0.0, sx, 0.25, -0.35), _at(fm, 0.12, sx, 0.12, -0.32), _at(fm, 0.45, sx, 0.05, -0.28), _at(fm, 0.82, sx, 0.02, -0.22)];
        nerve(sci, 0.055, 0.045);
        const split = sci[sci.length - 1];
        /* tibial: down the back of the leg to behind the medial malleolus */
        nerve([split, _at(tb, 0.08, sx, 0.0, -0.2), _at(tb, 0.5, sx, 0.05, -0.16), _at(tb, 0.98, sx, 0.15, -0.1)], 0.036, 0.022);
        /* common fibular: round the fibular head to the front of the leg */
        const fibTop = fb.a.clone().add(_V(-sx * 0.06, -0.05, -0.04));
        nerve([split, fibTop, fb.a.clone().addScaledVector(fb.dir, fb.len * 0.2).add(_V(-sx * 0.04, 0, 0.1)), tb.a.clone().addScaledVector(tb.dir, tb.len * 0.6).lerp(fb.a.clone().addScaledVector(fb.dir, fb.len * 0.6), 0.6).add(_V(0, 0, 0.1)), _at(tb, 0.98, sx, -0.05, 0.12)], 0.026, 0.016);
        if (R.toes) R.toes.forEach(t => nerve([_at(tb, 0.98, sx, 0.15, -0.1), t.base.clone().add(_V(0, -0.025, 0)), t.tip.clone().add(_V(0, -0.015, 0))], 0.01, 0.005));
      }
    }
    /* intercostal nerves follow each rib's lower border back to the cord */
    _ribPaths().forEach(r => {
      const p0 = r.path[0];
      const root = cordAt(p0.y + 0.08);
      nerve([root, ...r.path.map(p => p.clone().add(_V(0, -0.045, 0.01)))].filter(Boolean), 0.014, 0.007);
    });
  }

  /* ═══════════════ PROCEDURAL: TONGUE + IRISES (senses) ════════════ */
  function _addTongue(grp) {
    const mand = _keyPts('mandibula', 1500);
    if (mand.length < 20) return;
    const box = new THREE.Box3().setFromPoints(mand);
    const sz = box.getSize(new THREE.Vector3());
    const W = sz.x * 0.5, L = sz.z * 0.66, T = sz.y * 0.3;
    const g = new THREE.SphereGeometry(1, 64, 40);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const front = (z + 1) / 2;                                  // 0 = root (throat), 1 = tip
      x *= 1 - 0.42 * Math.pow(front, 1.7);                       // broad body, rounded tip
      const thick = 1 - 0.55 * Math.pow(front, 1.4);              // thick root, thin blade
      y *= (y > 0 ? 0.7 : 0.9) * thick;
      if (y > 0) y -= 0.1 * Math.exp(-x * x / 0.02) * (0.3 + front * 0.7);   // median sulcus
      y -= 0.35 * Math.pow(1 - front, 3);                         // root curves down into the throat
      y += 0.08 * Math.sin(front * Math.PI);                      // gentle dorsal arch
      p.setXYZ(i, x * W / 2, y * T / 2, z * L / 2);
    }
    g.computeVertexNormals();
    const col = new THREE.Color(REAL.paladar);
    const mesh = new THREE.Mesh(g, null);
    _register(mesh, 'sentidos', 'paladar', col);
    mesh.material.roughness = 0.55; mesh.material.clearcoat = 0.9; mesh.material.clearcoatRoughness = 0.35;
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
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(R * 0.82, R * 0.8, R * 0.07, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function _addIrises(grp) {
    const pts = _partPts('sentidos', /^eyeball$/i, 3000);
    if (pts.length < 40) return;
    const tex = _irisTexture();
    for (const sx of [-1, 1]) {
      const eye = pts.filter(p => p.x * sx > 0);
      if (eye.length < 20) continue;
      const c = _centroid(eye), front = _argmax(eye, p => p.z);
      const r = front.distanceTo(c);
      const dir = front.clone().sub(c).normalize();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.52, 48), new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
      disc.position.copy(c).addScaledVector(dir, r * 0.985);
      disc.lookAt(disc.position.clone().add(dir));
      const col = new THREE.Color(0xffffff);
      disc.userData = { key: 'olhos', sys: 'sentidos', baseColor: col, pickable: true, iris: true };
      (_meshByKey.olhos = _meshByKey.olhos || []).push(disc);
      grp.add(disc);
    }
  }

  function _augmentSystem(sysId) {
    const add = id => {
      if (_augmented.has(id) || !_sysGroup[id]) return;
      if (id === 'circulatorio') _addVessels(_sysGroup[id]);
      else if (id === 'nervoso') _addNerves(_sysGroup[id]);
      else if (id === 'sentidos') { _addTongue(_sysGroup[id]); _addIrises(_sysGroup[id]); }
      else return;
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

    _camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 400);
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
    _distT = Math.max(1.2, Math.max(dH, dW) * pad + Math.max(size.x, size.z) * 0.5);
    if (instant) { _focus.copy(_focusT); _dist = _distT; _az = _azT; _pol = _polT; }
    _dirty = true;
  }

  function _frameStructure(key, instant) {
    const box = key === 'tato' ? _bounds([_shell]) : _bounds(_meshByKey[key] || []);
    _frameBox(box, key === 'tato' ? 1.05 : 2.3, instant);
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
        o.visible = visible;
        if (_xray && _selKey && !selected) _setTransp(mat, true, 0.12, false);
        else _setTransp(mat, !!o.userData.iris, 1, true);
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
    _curSys = sysId; _selKey = null; _isolate = false; _xray = false;
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
      <div class="hb-panel-h">${_t('Structures', 'Estruturas')} <span>${_t('tap to explore', 'toca para explorar')}</span></div>
      ${_structureListHTML(members)}`;
    _wireStructureList();
  }

  function _renderPanelStructure(s) {
    const sys = SYS_BY_ID[s.system];
    const facts = _f(s, 'facts') || [];
    const sib = STRUCT.filter(x => x.system === s.system && x.key !== s.key);
    _panel.style.setProperty('--sys', sys.color);
    _panel.innerHTML = `
      <button class="hb-back" data-back="1">← ${_esc(_sn(sys))}</button>
      <div class="hb-info-hd">${_dot(s.key, s.system).replace('hb-struct-dot', 'hb-struct-dot hb-dot-lg')}
        <div><div class="hb-info-ttl">${_esc(_nm(s))}</div>
        <div class="hb-info-sub">${sys.emoji} ${_esc(_sn(sys))}${_lang() === 'en' ? '' : ` · <i>${_esc(s.en)}</i>`}</div></div></div>
      <div class="hb-info-desc">${_esc(_f(s, 'fn'))}</div>
      <div class="hb-meta-row"><span class="hb-meta-ic" aria-hidden="true">📍</span><span><b>${_t('Where', 'Onde')}:</b> ${_esc(_f(s, 'loc'))}</span></div>
      ${facts.length ? `<div class="hb-panel-h">${_t('Did you know?', 'Sabias que…')}</div><ul class="hb-info-facts">${facts.map(f => `<li>${_esc(f)}</li>`).join('')}</ul>` : ''}
      <div class="hb-struct-actions">
        <button class="hb-act ${_isolate ? 'on' : ''}" data-act="isolate" aria-pressed="${_isolate}">${_t('Isolate', 'Isolar')}</button>
        <button class="hb-act ${_xray ? 'on' : ''}" data-act="xray" aria-pressed="${_xray}">${_t('X-ray', 'Raio-X')}</button>
      </div>
      ${sib.length ? `<div class="hb-panel-h">${_t('Also in this system', 'Também neste sistema')}</div>
        <div class="hb-chips">${sib.map(x => `<button class="hb-chip" data-key="${x.key}">${_dot(x.key, x.system)}${_esc(_nm(x))}</button>`).join('')}</div>` : ''}`;
    _panel.querySelector('[data-back]')?.addEventListener('click', _clearSelection);
    _panel.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => _toggleMode(b.dataset.act)));
    _panel.querySelectorAll('.hb-chip').forEach(b => b.addEventListener('click', () => selectStructure(b.dataset.key)));
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
        if (pinchD) _distT = Math.max(1.2, Math.min(90, _distT * (pinchD / (d || 1))));
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
      _distT = Math.max(1.2, Math.min(90, _distT * (e.deltaY > 0 ? 1.1 : 0.9)));
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
    _dirty = true;
    const box = _bounds(Object.values(_sysGroup).concat(_shell ? [_shell] : []));
    return { box: box ? [box.min.toArray().map(v => +v.toFixed(2)), box.max.toArray().map(v => +v.toFixed(2))] : null,
      focus: _focus.toArray().map(v => +v.toFixed(2)), dist: +_dist.toFixed(2), sys: _curSys, sel: _selKey,
      meshes: Object.fromEntries(Object.entries(_meshByKey).map(([k, v]) => [k, v.length])) };
  }

  return { mount, resume, stop, _dbg };
})();
