/* ══════════════════════════════════════════════════════════════════
   EXPLORER · CORPO HUMANO — system-first 3D anatomy atlas
   ----------------------------------------------------------------------
   Real, co-registered anatomy from BodyParts3D (CC-BY-SA): every structure
   is its own named, pickable mesh — so navigation, search, isolate, x-ray
   and highlight come straight from the data (no manual alignment).

   Navigation:  Corpo → Sistema → Estrutura → Detalhes
   Data:        assets/models/anatomy/<system>.glb  +  data/anatomy/manifest.json
   Engine:      three.js (ESM via esm.sh, module-scoped so it won't clash with
                the other explorers' UMD THREE).
   ══════════════════════════════════════════════════════════════════ */
const HumanBodyExplorer = (function () {
  'use strict';

  const ESM = {
    three:  'https://esm.sh/three@0.160.0',
    gltf:   'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
    meshopt:'https://esm.sh/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js',
  };
  const MODEL_BASE = 'assets/models/anatomy/';
  const MANIFEST_URL = 'data/anatomy/manifest.json';

  let THREE = null, _GLTFLoader = null, _MeshoptDecoder = null;

  /* ── i18n ── */
  function _lang() { return (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'); }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }
  const _f = (s, field) => s[field + '_' + _lang()] ?? s[field + '_pt'];   // localized manifest field
  const _nm = (s) => (_lang() === 'en' ? s.en : s.pt);

  /* ── manifest ── */
  let MANIFEST = null, SYS = [], SYS_BY_ID = {}, STRUCT = [], STRUCT_BY_KEY = {};

  /* ── DOM / scene ── */
  let _host = null, _vp = null, _panel = null, _crumb = null, _searchInput = null;
  let _renderer = null, _scene = null, _camera = null, _raf = null;
  let _mounted = false, _built = false;

  /* ── loaded model state ── */
  const _sysGroup = {};        // sysId → THREE.Group
  const _meshByKey = {};       // structureKey → [mesh, …]
  const _loaded = new Set();   // sysIds whose GLB is in the scene
  const _loading = new Set();

  /* ── view state ── */
  let _curSys = null;          // active system id, or '__all'
  let _selKey = null;          // selected structure key
  let _isolate = false, _xray = false;

  /* ── camera (spherical around a focus point) ── */
  let _az = 0.6, _pol = 1.3, _dist = 34;
  let _azT = 0.6, _polT = 1.3, _distT = 34;
  let _focus = null, _focusT = null;     // THREE.Vector3
  let _autoSpin = true;

  /* ════════════════════════════ LOADERS ════════════════════════════ */
  async function _loadThree() {
    try {
      const [T, G, M] = await Promise.all([import(ESM.three), import(ESM.gltf), import(ESM.meshopt)]);
      THREE = T; _GLTFLoader = G.GLTFLoader; _MeshoptDecoder = M.MeshoptDecoder;
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
      /* Taste & touch have no mesh in BodyParts3D — add them as marker-only
         structures so all five senses are represented (markers built at runtime). */
      STRUCT.push(
        { key:'paladar', system:'sentidos', node:'paladar', marker:[0.5,0.905,0.62], pt:'Paladar', en:'Taste',
          fn_pt:'A língua deteta cinco sabores: doce, salgado, ácido, amargo e umami.', fn_en:'The tongue senses five tastes: sweet, salty, sour, bitter and umami.',
          loc_pt:'Boca', loc_en:'Mouth', facts_pt:['Grande parte do "sabor" é, na verdade, olfato.'], facts_en:['Most of what we call "flavour" is actually smell.'] },
        { key:'tato', system:'sentidos', node:'tato', marker:[0.595,0.93,0.55], pt:'Tato', en:'Touch',
          fn_pt:'A pele sente toque, pressão, calor, frio e dor por toda a superfície do corpo.', fn_en:'The skin senses touch, pressure, heat, cold and pain across the whole body.',
          loc_pt:'Pele (todo o corpo)', loc_en:'Skin (whole body)', facts_pt:['As pontas dos dedos estão entre as zonas mais sensíveis.'], facts_en:['The fingertips are among the most sensitive areas.'] },
      );
      SYS.forEach(s => SYS_BY_ID[s.id] = s);
      STRUCT.forEach(s => STRUCT_BY_KEY[s.key] = s);
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

  /* Load one system's GLB, recolour its meshes and index them by structure key. */
  async function _ensureSystem(sysId) {
    if (_loaded.has(sysId) || _loading.has(sysId)) return;
    _loading.add(sysId);
    try {
      const root = await _loadGLB(MODEL_BASE + sysId + '.glb');
      const sys = SYS_BY_ID[sysId];
      const baseColor = new THREE.Color(sys.color);
      const grp = new THREE.Group();
      grp.name = sysId;
      // Each top-level named node = one structure (key). Recolour + tag every mesh.
      root.traverse(o => {
        if (!o.isMesh) return;
        const key = _structureKeyOf(o);
        const col = _structureColor(sysId, key, baseColor);
        const mat = new THREE.MeshStandardMaterial({
          color: col.clone(), roughness: 0.62, metalness: 0.02,
          transparent: true, opacity: 1, emissive: col.clone().multiplyScalar(0.05),
        });
        o.material = mat;
        o.userData.key = key;
        o.userData.sys = sysId;
        o.userData.baseColor = col.clone();
        if (key) (_meshByKey[key] = _meshByKey[key] || []).push(o);
      });
      grp.add(root);
      _sysGroup[sysId] = grp;
      _scene.add(grp);
      _loaded.add(sysId);
    } catch (e) {
      console.warn('anatomy: failed to load system', sysId, e);
    } finally {
      _loading.delete(sysId);
    }
  }

  /* Per-structure colour. In the circulatory view arteries read red and veins
     blue so the two trees are distinguishable; everything else uses the system
     colour. */
  const ARTERY = 0xd83a3a, VEIN = 0x3f74d6;
  function _structureColor(sysId, key, baseColor) {
    if (sysId === 'circulatorio') return new THREE.Color(key === 'veias' ? VEIN : ARTERY);
    return baseColor.clone();
  }

  /* ── procedural augmentation ──────────────────────────────────────
     BodyParts3D has no distal limb/head vessels and no taste/touch organ,
     so we add those procedurally, scaled to the skeleton's bounds, when the
     relevant system is shown (once). Fractions: y 0=feet→1=head, x 0.5=centre. */
  const _augmented = new Set();
  function _frac(b, fx, fy, fz) {
    return new THREE.Vector3(
      b.min.x + fx * (b.max.x - b.min.x),
      b.min.y + fy * (b.max.y - b.min.y),
      b.min.z + fz * (b.max.z - b.min.z));
  }
  /* Sample world-space vertices of a structure's meshes (decimated). */
  function _structurePoints(key) {
    const out = [];
    const v = new THREE.Vector3();
    (_meshByKey[key] || []).forEach(m => {
      const pos = m.geometry && m.geometry.attributes && m.geometry.attributes.position;
      if (!pos) return;
      m.updateWorldMatrix(true, false);
      const step = Math.max(1, Math.ceil(pos.count / 500));
      for (let i = 0; i < pos.count; i += step) out.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
    });
    return out;
  }
  /* Custom tapered tube (radius r0→r1 along the path) — TubeGeometry can't taper. */
  function _taperedMesh(grp, pts, r0, r1, mat, key) {
    pts = pts.filter(Boolean);
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = Math.max(20, pts.length * 11), rad = 9;
    const fr = curve.computeFrenetFrames(seg, false);
    const pos = [], idx = [], P = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      curve.getPointAt(i / seg, P);
      const r = r0 + (r1 - r0) * (i / seg);
      const N = fr.normals[i], B = fr.binormals[i];
      for (let j = 0; j < rad; j++) {
        const a = j / rad * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        pos.push(P.x + ca * N.x + sa * B.x, P.y + ca * N.y + sa * B.y, P.z + ca * N.z + sa * B.z);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * rad + j, b = i * rad + (j + 1) % rad, c = (i + 1) * rad + (j + 1) % rad, d = (i + 1) * rad + j;
      idx.push(a, b, d, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.userData.key = key; m.userData.sys = 'circulatorio'; m.userData.baseColor = new THREE.Color(mat.color.getHex());
    grp.add(m); (_meshByKey[key] = _meshByKey[key] || []).push(m);
  }

  /* From a point cloud (a hand/foot), pick n spread "fingertip/toe" targets:
     the most distal points across the lateral spread, relative to a base joint. */
  function _tips(pts, base, n) {
    if (!pts || pts.length < n) return [];
    const cen = pts.reduce((a, p) => a.add(p.clone()), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const dir = cen.clone().sub(base); if (dir.lengthSq() < 1e-6) return []; dir.normalize();
    let lat = new THREE.Vector3(0, 1, 0).cross(dir); if (lat.lengthSq() < 1e-4) lat = new THREE.Vector3(1, 0, 0).cross(dir); lat.normalize();
    const sc = pts.map(p => { const rel = p.clone().sub(base); return { p, d: rel.dot(dir), l: rel.dot(lat) }; });
    const maxd = Math.max(...sc.map(s => s.d));
    const distal = sc.filter(s => s.d > maxd * 0.6).sort((a, b) => a.l - b.l);
    const tips = [];
    for (let k = 0; k < n; k++) {
      const s = distal.slice(Math.floor(k * distal.length / n), Math.floor((k + 1) * distal.length / n));
      if (s.length) tips.push(s.reduce((m, x) => x.d > m.d ? x : m, s[0]).p);
    }
    return tips;
  }

  /* Build a detailed, organic, branching vessel network routed through the real
     skeleton. Veins hug the arteries (offset perpendicular to the local path so
     they stay aligned through every joint), the head/trunk get branch networks,
     and the limbs taper down to an artery + vein in every finger and toe. */
  function _addVessels(grp, box) {
    if (!_sysGroup[GHOST_SYS]) return;
    const cx = (box.min.x + box.max.x) / 2, H = box.max.y - box.min.y;
    const ext = (arr, side, top) => {
      let best = null;
      for (const p of arr) { const on = side < 0 ? p.x < cx : p.x >= cx; if (on && (!best || (top ? p.y > best.y : p.y < best.y))) best = p; }
      return best;
    };
    const cen = (arr, side) => {
      const s = new THREE.Vector3(); let n = 0;
      for (const p of arr) if (side < 0 ? p.x < cx : p.x >= cx) { s.add(p); n++; }
      return n ? s.multiplyScalar(1 / n) : null;
    };
    const cenAll = arr => { if (!arr.length) return null; const s = new THREE.Vector3(); arr.forEach(p => s.add(p)); return s.multiplyScalar(1 / arr.length); };
    const onSide = (arr, side) => arr.filter(p => side < 0 ? p.x < cx : p.x >= cx);
    const xtreme = (arr, key, max) => arr.length ? arr.reduce((m, p) => (max ? key(p) > key(m) : key(p) < key(m)) ? p : m, arr[0]) : null;
    const P = k => _structurePoints(k);
    const umero = P('umero'), radio = P('radio_ulna'), mao = P('mao'),
          femur = P('femur'), tibia = P('tibia_fibula'), pe = P('pe'),
          pelve = P('pelve'), cranio = P('cranio'), costelas = P('costelas');
    const chest = cenAll(P('coracao')) || _frac(box, 0.5, 0.66, 0.55);
    const pelvisC = cenAll(pelve) || _frac(box, 0.5, 0.34, 0.5);

    const mk = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.0,
      emissive: new THREE.Color(c).multiplyScalar(0.22), transparent: true, opacity: 1 });
    const matA = mk(ARTERY), matV = mk(VEIN);
    /* vein path: offset perpendicular to the LOCAL direction (so it bends WITH
       the artery and stays aligned at joints), nudged slightly behind. */
    const amt = H * 0.0072;
    const veinPath = pts => {
      const a = pts.filter(Boolean);
      return a.map((p, i) => {
        const u = a[Math.max(0, i - 1)], v = a[Math.min(a.length - 1, i + 1)];
        const tan = v.clone().sub(u); if (tan.lengthSq() < 1e-9) tan.set(0, 1, 0); tan.normalize();
        let off = new THREE.Vector3(0, 1, 0).cross(tan); if (off.lengthSq() < 1e-6) off = new THREE.Vector3(1, 0, 0).cross(tan); off.normalize();
        return p.clone().addScaledVector(off, amt).add(new THREE.Vector3(0, 0, -amt * 0.7));
      });
    };
    const pair = (pts, r0, r1) => { _taperedMesh(grp, pts, r0, r1, matA, 'arterias'); _taperedMesh(grp, veinPath(pts), r0, r1, matV, 'veias'); };
    const onlyA = (pts, r0, r1) => _taperedMesh(grp, pts, r0, r1, matA, 'arterias');
    const perp = (a, b, d) => new THREE.Vector3(0, 0, 1).cross(a.clone().sub(b)).normalize().multiplyScalar(d);
    const mid = (a, b, t = 0.5) => a.clone().lerp(b, t);

    /* ── trunk (aorta + vena cava) ── */
    pair([chest, mid(chest, pelvisC), pelvisC], H * 0.0085, H * 0.0058);

    /* ── head: a small network fanning over the skull, not one tube ── */
    if (cranio.length) {
      const ny = xtreme(cranio, p => p.y, false).y;            // skull base
      const neck = new THREE.Vector3(chest.x, (chest.y + ny) / 2, chest.z + H * 0.004);
      pair([chest, neck], H * 0.006, H * 0.0042);
      const targets = [
        xtreme(cranio, p => p.y, true),                        // crown
        xtreme(cranio, p => p.z, true),                        // forehead/face
        xtreme(cranio, p => p.z, false),                       // occiput
        xtreme(onSide(cranio, -1), p => p.x, false),           // left temple
        xtreme(onSide(cranio, 1), p => p.x, true),             // right temple
      ].filter(Boolean);
      for (const t of targets) {
        const bend = new THREE.Vector3((neck.x + t.x) / 2, (neck.y + t.y) / 2, (neck.z + t.z) / 2 + H * 0.006);
        pair([neck, bend, t], H * 0.0030, H * 0.0010);
      }
    }

    /* ── intercostal branches off the trunk toward the ribs (richness) ── */
    if (costelas.length) {
      for (const side of [-1, 1]) {
        const sc = onSide(costelas, side);
        for (const fy of [0.62, 0.55, 0.48]) {
          const yt = box.min.y + fy * H;
          let best = null, bd = Infinity;
          for (const p of sc) { const d = Math.abs(p.y - yt); if (d < bd) { bd = d; best = p; } }
          if (best) { const s = new THREE.Vector3(chest.x, best.y, chest.z); onlyA([s, mid(s, best), best], H * 0.0022, H * 0.0007); }
        }
      }
    }

    for (const side of [-1, 1]) {
      /* ── arm: brachial → (radial + ulnar) → palm → 5 fingers ── */
      const shoulder = ext(umero, side, true), elbow = ext(umero, side, false), wrist = ext(radio, side, false), handCen = cen(mao, side);
      if (shoulder && elbow) {
        pair([chest, shoulder, elbow], H * 0.0058, H * 0.0042);
        const m = mid(shoulder, elbow); onlyA([m, m.clone().add(perp(shoulder, elbow, H * 0.022))], H * 0.0018, H * 0.0006);
      }
      if (elbow && wrist) {
        const off = perp(elbow, wrist, H * 0.009);
        pair([elbow, wrist], H * 0.0042, H * 0.0028);
        pair([elbow.clone().add(off), mid(elbow, wrist).add(off), wrist.clone().add(off)], H * 0.0034, H * 0.0022);
      }
      if (wrist && handCen) {
        pair([wrist, handCen], H * 0.0030, H * 0.0022);
        const tips = _tips(onSide(mao, side), wrist, 5);
        for (const t of tips) pair([handCen, t], H * 0.0020, H * 0.0006);
      }
      /* ── leg: femoral → (anterior + posterior tibial) → foot → 5 toes ── */
      const hip = ext(femur, side, true), knee = ext(femur, side, false), ankle = ext(tibia, side, false), footCen = cen(pe, side);
      if (hip && knee) {
        pair([pelvisC, hip, knee], H * 0.0078, H * 0.0052);
        const m = mid(hip, knee); onlyA([m, m.clone().add(perp(hip, knee, H * 0.020))], H * 0.0020, H * 0.0007);
      }
      if (knee && ankle) {
        const off = perp(knee, ankle, H * 0.009);
        pair([knee, ankle], H * 0.0052, H * 0.0034);
        pair([knee.clone().add(off), mid(knee, ankle).add(off), ankle.clone().add(off)], H * 0.0040, H * 0.0026);
      }
      if (ankle && footCen) {
        pair([ankle, footCen], H * 0.0034, H * 0.0024);
        const tips = _tips(onSide(pe, side), ankle, 5);
        for (const t of tips) pair([footCen, t], H * 0.0022, H * 0.0007);
      }
    }
  }
  function _addSenseMarkers(grp, box) {
    const col = new THREE.Color(SYS_BY_ID.sentidos.color);
    const r = (box.max.y - box.min.y) * 0.010;
    STRUCT.filter(s => s.system === 'sentidos' && s.marker).forEach(s => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20),
        new THREE.MeshStandardMaterial({ color: col.clone(), emissive: col.clone().multiplyScalar(0.5), roughness: 0.3, transparent: true, opacity: 1 }));
      m.position.copy(_frac(box, s.marker[0], s.marker[1], s.marker[2]));
      m.userData.key = s.key; m.userData.sys = 'sentidos'; m.userData.baseColor = col.clone();
      grp.add(m); (_meshByKey[s.key] = _meshByKey[s.key] || []).push(m);
    });
  }
  function _augmentSystem(sysId) {
    const box = _bounds([_sysGroup[GHOST_SYS]]);
    if (!box) return;
    const add = id => {
      if (_augmented.has(id) || !_sysGroup[id]) return;
      if (id === 'circulatorio') _addVessels(_sysGroup[id], box);
      else if (id === 'sentidos') _addSenseMarkers(_sysGroup[id], box);
      else return;
      _augmented.add(id);
    };
    if (sysId === '__all') { add('circulatorio'); add('sentidos'); } else add(sysId);
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

  /* ════════════════════════════ SCENE ══════════════════════════════ */
  function _bgTexture() {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0c1020'); g.addColorStop(0.55, '#070a13'); g.addColorStop(1, '#04050b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
    return new THREE.CanvasTexture(c);
  }

  function _buildScene() {
    const W = _vp.clientWidth || 800, H = _vp.clientHeight || 600;
    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    _renderer.setSize(W, H);
    if (THREE.SRGBColorSpace) _renderer.outputColorSpace = THREE.SRGBColorSpace;
    _vp.appendChild(_renderer.domElement);

    _scene = new THREE.Scene();
    _scene.background = _bgTexture();
    _camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000);
    _focus = new THREE.Vector3(0, 8, 0);
    _focusT = _focus.clone();

    _scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xfff1e6, 1.45); key.position.set(8, 18, 16); _scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fc0ff, 0.65); fill.position.set(-14, 8, 10); _scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff9fb0, 0.7); rim.position.set(0, 10, -16); _scene.add(rim);

    // soft ground shadow
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; _scene.add(disc);

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

  function _frameBox(box, pad = 1.35, instant = false) {
    if (!box) return;
    const size = new THREE.Vector3(), ctr = new THREE.Vector3();
    box.getSize(size); box.getCenter(ctr);
    const r = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const fov = _camera.fov * Math.PI / 180;
    const d = (r / Math.sin(fov / 2)) * pad;
    _focusT.copy(ctr);
    _distT = Math.max(4, d);
    if (instant) { _focus.copy(_focusT); _dist = _distT; _az = _azT; _pol = _polT; }
  }

  function _frameStructure(key, instant) {
    const box = _bounds(_meshByKey[key] || []);
    _frameBox(box, 2.4, instant);
    _azT = 0.5; _polT = 1.25; _autoSpin = false;
  }

  function _frameSystem(sysId, instant) {
    const box = sysId === '__all'
      ? _bounds(Object.values(_sysGroup))
      : _bounds([_sysGroup[sysId]]);
    _frameBox(box, 1.4, instant);
    _azT = 0.5; _polT = 1.3; _autoSpin = true;
  }

  /* ════════════════════════════ VISIBILITY ═════════════════════════ */
  const GHOST_SYS = 'esqueletico';   // skeleton doubles as the spatial context

  /* Apply current system / isolate / x-ray to every loaded mesh. When a single
     non-skeletal system is active, the skeleton is shown as a faint, non-pickable
     "ghost" so organs/vessels/eyes have a body to sit in (Visible-Body style). */
  function _applyView() {
    const ghostOn = _curSys !== GHOST_SYS && _curSys !== '__all';
    Object.entries(_sysGroup).forEach(([sysId, grp]) => {
      const sysActive = _curSys === '__all' || _curSys === sysId;
      const ghost = sysId === GHOST_SYS && ghostOn;
      grp.traverse(o => {
        if (!o.isMesh) return;
        const key = o.userData.key;
        const selected = _selKey && key === _selKey;
        const mat = o.material;

        if (ghost) {                       // faint context skeleton
          o.visible = true;
          o.userData.pickable = false;
          mat.transparent = true; mat.opacity = 0.055; mat.depthWrite = false;
          mat.emissive.copy(o.userData.baseColor).multiplyScalar(0.02);
          mat.needsUpdate = true;
          return;
        }

        o.userData.pickable = true;
        let visible = sysActive;
        if (_isolate && _selKey) visible = selected;
        o.visible = visible;
        if (_xray && _selKey) { mat.transparent = true; mat.opacity = selected ? 1 : 0.14; mat.depthWrite = selected; }
        else { mat.opacity = 1; mat.depthWrite = true; mat.transparent = false; }
        mat.emissive.copy(o.userData.baseColor).multiplyScalar(selected ? 0.55 : 0.05);
        mat.needsUpdate = true;
      });
    });
  }

  /* ════════════════════════════ SELECTION ══════════════════════════ */
  async function selectSystem(sysId, instant) {
    _curSys = sysId; _selKey = null;
    _highlightRail();
    if (sysId === '__all') { for (const s of SYS) await _ensureSystem(s.id); }
    else {
      await _ensureSystem(sysId);
      await _ensureSystem(GHOST_SYS);   // skeleton = spatial context for every system
    }
    _augmentSystem(sysId);              // procedural limb/head vessels + taste/touch markers
    _applyView();
    _frameSystem(sysId, instant);
    _renderPanelSystem(sysId);
    _updateCrumb();
  }

  function selectStructure(key) {
    const s = STRUCT_BY_KEY[key]; if (!s) return;
    if (_curSys !== '__all' && s.system !== _curSys) { _curSys = s.system; _highlightRail(); }
    _selKey = key;
    _ensureSystem(s.system).then(() => { _applyView(); _frameStructure(key); });
    _applyView();
    _frameStructure(key);
    _renderPanelStructure(s);
    _updateCrumb();
  }

  /* ════════════════════════════ PANEL ══════════════════════════════ */
  function _renderPanelSystem(sysId) {
    if (sysId === '__all') {
      _panel.innerHTML = `
        <div class="hb-info-hd"><span class="hb-info-emoji">🧍</span>
          <div><div class="hb-info-ttl">${_t('Whole body', 'Corpo completo')}</div>
          <div class="hb-info-sub">${_t('All systems together', 'Todos os sistemas juntos')}</div></div></div>
        <div class="hb-info-desc">${_t('Every system overlaid in one co-registered body. Pick a structure, or choose a single system on the left to study it on its own.', 'Todos os sistemas sobrepostos num corpo co-registado. Toca numa estrutura, ou escolhe um sistema à esquerda para o estudar isolado.')}</div>
        ${_structureListHTML(STRUCT)}`;
      return;
    }
    const sys = SYS_BY_ID[sysId];
    const members = STRUCT.filter(s => s.system === sysId);
    _panel.innerHTML = `
      <div class="hb-info-hd"><span class="hb-info-emoji">${sys.emoji}</span>
        <div><div class="hb-info-ttl">${_lang() === 'en' ? sys.en : sys.pt}</div>
        <div class="hb-info-sub">${members.length} ${_t('structures', 'estruturas')}</div></div></div>
      <div class="hb-info-desc">${_lang() === 'en' ? sys.desc_en : sys.desc_pt}</div>
      <div class="hb-panel-h">${_t('Structures', 'Estruturas')}</div>
      ${_structureListHTML(members)}`;
    _wireStructureList();
  }

  function _renderPanelStructure(s) {
    const sys = SYS_BY_ID[s.system];
    const facts = _f(s, 'facts') || [];
    _panel.innerHTML = `
      <button class="hb-back" data-back="1">← ${_lang() === 'en' ? sys.en : sys.pt}</button>
      <div class="hb-info-hd"><span class="hb-info-emoji">${sys.emoji}</span>
        <div><div class="hb-info-ttl">${_nm(s)}</div>
        <div class="hb-info-sub">${_lang() === 'en' ? sys.en : sys.pt}</div></div></div>
      <div class="hb-info-desc">${_f(s, 'fn')}</div>
      <div class="hb-meta-row"><span class="hb-meta-ic">📍</span><span>${_f(s, 'loc')}</span></div>
      ${facts.length ? `<ul class="hb-info-facts">${facts.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
      <div class="hb-struct-actions">
        <button class="hb-act ${_isolate ? 'on' : ''}" data-act="isolate">🔍 ${_t('Isolate', 'Isolar')}</button>
        <button class="hb-act ${_xray ? 'on' : ''}" data-act="xray">👻 ${_t('X-ray', 'Raio-X')}</button>
      </div>`;
    _panel.querySelector('[data-back]')?.addEventListener('click', () => selectSystem(s.system));
    _panel.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.act === 'isolate') _isolate = !_isolate;
      if (b.dataset.act === 'xray') _xray = !_xray;
      b.classList.toggle('on');
      _applyView();
    }));
  }

  function _structureListHTML(list) {
    return `<div class="hb-struct-list">${list.map(s =>
      `<button class="hb-struct-item" data-key="${s.key}">
         <span class="hb-struct-dot" style="background:${SYS_BY_ID[s.system].color}"></span>
         <span class="hb-struct-name">${_nm(s)}</span>
         <span class="hb-struct-sys">${SYS_BY_ID[s.system].emoji}</span>
       </button>`).join('')}</div>`;
  }

  function _wireStructureList() {
    _panel.querySelectorAll('.hb-struct-item').forEach(b =>
      b.addEventListener('click', () => selectStructure(b.dataset.key)));
  }

  /* ════════════════════════════ SEARCH ═════════════════════════════ */
  function _runSearch(q) {
    q = (q || '').trim().toLowerCase();
    const box = _host.querySelector('#hb-results');
    if (!q) { box.innerHTML = ''; box.classList.remove('on'); return; }
    const hits = STRUCT.filter(s =>
      _nm(s).toLowerCase().includes(q) || s.pt.toLowerCase().includes(q) ||
      s.en.toLowerCase().includes(q) || _f(s, 'fn').toLowerCase().includes(q)
    ).slice(0, 8);
    box.classList.add('on');
    box.innerHTML = hits.length ? hits.map(s =>
      `<button class="hb-result" data-key="${s.key}">
         <span class="hb-struct-dot" style="background:${SYS_BY_ID[s.system].color}"></span>
         <b>${_nm(s)}</b><span class="hb-result-sys">${_lang() === 'en' ? SYS_BY_ID[s.system].en : SYS_BY_ID[s.system].pt}</span>
       </button>`).join('') : `<div class="hb-result-empty">${_t('No match', 'Sem resultados')}</div>`;
    box.querySelectorAll('.hb-result').forEach(b => b.addEventListener('click', () => {
      selectStructure(b.dataset.key);
      _searchInput.value = ''; box.innerHTML = ''; box.classList.remove('on');
    }));
  }

  /* ════════════════════════════ RAIL / CRUMB ═══════════════════════ */
  function _highlightRail() {
    _host.querySelectorAll('.hb-sys').forEach(b =>
      b.classList.toggle('on', b.dataset.sys === _curSys));
  }
  function _updateCrumb() {
    const parts = [`<button class="hb-cr" data-cr="__all">${_t('Body', 'Corpo')}</button>`];
    if (_curSys && _curSys !== '__all') {
      const sys = SYS_BY_ID[_curSys];
      parts.push(`<span class="hb-cr-sep">›</span><button class="hb-cr" data-cr="sys">${sys.emoji} ${_lang() === 'en' ? sys.en : sys.pt}</button>`);
    }
    if (_selKey) {
      parts.push(`<span class="hb-cr-sep">›</span><span class="hb-cr on">${_nm(STRUCT_BY_KEY[_selKey])}</span>`);
    }
    _crumb.innerHTML = parts.join('');
    _crumb.querySelectorAll('[data-cr]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.cr === '__all') selectSystem('__all');
      else selectSystem(_curSys);
    }));
  }

  /* ════════════════════════════ CONTROLS ═══════════════════════════ */
  function _pinchDist(pts) { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }

  function _wireControls() {
    const pts = new Map();
    let lx = 0, ly = 0, moved = 0, pinchD = 0, ptype = 'mouse';
    _vp.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      ptype = e.pointerType; moved = 0; lx = e.clientX; ly = e.clientY; _autoSpin = false;
      if (pts.size === 2) pinchD = _pinchDist(pts);
      _vp.classList.add('grabbing'); _vp.setPointerCapture?.(e.pointerId);
    });
    _vp.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const d = _pinchDist(pts);
        if (pinchD) _distT = Math.max(4, Math.min(120, _distT * (pinchD / (d || 1))));
        pinchD = d; return;
      }
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      const k = ptype === 'touch' ? 0.016 : 0.01;
      _azT -= dx * k;
      _polT = Math.max(0.2, Math.min(Math.PI - 0.2, _polT - dy * k));
    });
    const end = e => {
      const had = pts.has(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchD = 0;
      if (!had) return;
      if (pts.size === 0) { _vp.classList.remove('grabbing'); if (moved < 8) _pick(e); }
      else { const p = pts.values().next().value; lx = p.x; ly = p.y; }
    };
    _vp.addEventListener('pointerup', end);
    _vp.addEventListener('pointercancel', end);
    _vp.addEventListener('wheel', e => {
      e.preventDefault();
      _distT = Math.max(4, Math.min(120, _distT * (e.deltaY > 0 ? 1.1 : 0.9)));
    }, { passive: false });
  }

  function _pick(e) {
    if (!_camera) return;
    const r = _vp.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, _camera);
    const targets = [];
    Object.values(_sysGroup).forEach(g => g.traverse(o => { if (o.isMesh && o.visible && o.userData.pickable !== false) targets.push(o); }));
    const hit = ray.intersectObjects(targets, false)[0];
    if (hit && hit.object.userData.key) selectStructure(hit.object.userData.key);
  }

  /* ════════════════════════════ ANIMATION ══════════════════════════ */
  function _updateCamera() {
    const sp = Math.sin(_pol), cp = Math.cos(_pol);
    _camera.position.set(
      _focus.x + _dist * sp * Math.sin(_az),
      _focus.y + _dist * cp,
      _focus.z + _dist * sp * Math.cos(_az)
    );
    _camera.lookAt(_focus);
  }

  function _resize() {
    if (!_renderer || !_camera || !_vp) return;
    const W = _vp.clientWidth, H = _vp.clientHeight;
    if (!W || !H) return;
    _renderer.setSize(W, H); _camera.aspect = W / H; _camera.updateProjectionMatrix();
  }

  let _t0 = 0;
  function _tick(ts) {
    _raf = requestAnimationFrame(_tick);
    const t = ts * 0.001; if (!_t0) _t0 = t; const dt = Math.min(0.05, t - _t0); _t0 = t;
    const lf = 1 - Math.pow(0.0008, dt);
    if (_autoSpin) _azT += dt * 0.12;
    _az += (_azT - _az) * lf; _pol += (_polT - _pol) * lf;
    _dist += (_distT - _dist) * lf;
    _focus.lerp(_focusT, lf);
    _updateCamera();
    _renderer.render(_scene, _camera);
  }
  function _start() { if (!_raf) { _t0 = 0; _tick(performance.now()); } }

  /* ════════════════════════════ PUBLIC ═════════════════════════════ */
  async function mount(host) {
    _mounted = true;
    // initial loading placeholder (manifest + engine must load before we can
    // build the systems rail, which is data-driven)
    host.innerHTML = `<div class="hb-wrap"><div class="hb3d-loading" style="position:static;flex:1">
      <div class="ex-loading-spinner"></div><div>${_t('Loading the 3D atlas…', 'A carregar o atlas 3D…')}</div></div></div>`;

    if (!(await _loadThree()) || !(await _loadManifest())) {
      host.innerHTML = `<div class="hb-wrap"><div class="hb3d-loading" style="position:static;flex:1">
        <div class="ex-error-icon">⚠</div><div>${_t('Could not load the 3D atlas.', 'Não foi possível carregar o atlas 3D.')}</div></div></div>`;
      return;
    }

    host.innerHTML = `
      <div class="hb-wrap hb2">
        <div class="hb-top">
          <nav class="hb-crumb" id="hb-crumb"></nav>
          <div class="hb-search">
            <input id="hb-search-input" type="search" placeholder="${_t('Search a bone, muscle, organ…', 'Procurar osso, músculo, órgão…')}" autocomplete="off">
            <div class="hb-results" id="hb-results"></div>
          </div>
        </div>
        <div class="hb-body">
          <nav class="hb-rail2" id="hb-rail" aria-label="${_t('Body systems', 'Sistemas do corpo')}">
            <button class="hb-sys" data-sys="__all"><span class="hb-sys-ic">🧍</span><span class="hb-sys-lbl">${_t('Body', 'Corpo')}</span></button>
            ${SYS.map(s => `<button class="hb-sys" data-sys="${s.id}"><span class="hb-sys-ic">${s.emoji}</span><span class="hb-sys-lbl">${_lang() === 'en' ? s.en : s.pt}</span></button>`).join('')}
          </nav>
          <div class="hb-stage2">
            <div class="hb3d-viewport" id="hb3d-vp"></div>
            <div class="hb3d-foot">
              <span class="hb3d-hint">${_t('Drag to rotate · pinch/scroll to zoom · tap a part', 'Arrasta para rodar · pinça/scroll para zoom · toca numa parte')}</span>
              <button class="hb3d-reset" id="hb3d-reset">↺ ${_t('Reset', 'Repor')}</button>
            </div>
            <div class="hb3d-loading" id="hb3d-loading">
              <div class="ex-loading-spinner"></div>
              <div>${_t('Loading the 3D atlas…', 'A carregar o atlas 3D…')}</div>
            </div>
          </div>
          <aside class="hb-info hb-info2" id="hb-info"></aside>
        </div>
      </div>`;

    _host = host.querySelector('.hb-wrap');
    _vp = host.querySelector('#hb3d-vp');
    _panel = host.querySelector('#hb-info');
    _crumb = host.querySelector('#hb-crumb');
    _searchInput = host.querySelector('#hb-search-input');

    _host.querySelector('#hb-rail').addEventListener('click', e => {
      const b = e.target.closest('.hb-sys'); if (b) selectSystem(b.dataset.sys);
    });
    _host.querySelector('#hb3d-reset').addEventListener('click', () => {
      if (_selKey) _frameStructure(_selKey); else _frameSystem(_curSys);
      _autoSpin = true;
    });
    _searchInput.addEventListener('input', () => _runSearch(_searchInput.value));
    _searchInput.addEventListener('focus', () => _runSearch(_searchInput.value));
    document.addEventListener('click', e => {
      if (!e.target.closest('.hb-search')) _host.querySelector('#hb-results')?.classList.remove('on');
    });

    _buildScene();
    _wireControls();
    _start();
    host.querySelector('#hb3d-loading')?.remove();

    // default landing: the skeletal system (iconic, light), framed
    await selectSystem(SYS[0]?.id || '__all', true);
  }

  function resume() { if (_mounted && _built && !_raf) _start(); setTimeout(_resize, 60); }
  function stop() { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } }

  return { mount, resume, stop };
})();
