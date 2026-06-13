/* ══════════════════════════════════════════════════════════════════
   WorkoutRig — 3D exercise figure using a real rigged humanoid.
   Loads a CC0 mannequin (Quaternius, via Mesh2Motion) and plays either
   (a) CC0 motion-capture clips (Mesh2Motion, public-domain — see
   assets/models/workout/CREDITS.md) or (b) ORIGINAL clips we author on
   the same skeleton (for exercises with no free mocap — plank, lunge,
   crunch, …). Both run through one Three.js AnimationMixer; one model is
   reused for every exercise. three.js is lazy-loaded from a CDN (cached
   by the service worker); the .glb assets are bundled locally for offline.

   Public API:
     WorkoutRig.setAuthored(defs)            — register original pose-clips
     WorkoutRig.create(canvas, opts) -> {
       setClip(name), play(), pause(), setPlaying(b), setSpeed(m),
       setView(azDeg, elDeg), setPhase(0..1), getPhase(), onPhase(cb),
       orbitFrom(el), resize(), isReduced(), dispose()
     }
   Authored def: { dur, view?:[az,el,distMult], ground?:'feet'|'all',
       keys:[{ t, b:{ boneName:[ex,ey,ez] (local-axis deltas, radians) } }] }
══════════════════════════════════════════════════════════════════ */
const WorkoutRig = (function () {
  'use strict';

  const ESM = {
    three: 'https://esm.sh/three@0.160.0',
    gltf:  'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
    skel:  'https://esm.sh/three@0.160.0/examples/jsm/utils/SkeletonUtils.js',
  };
  const BASE = 'assets/models/workout/';
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const FEET_BONES = ['ball_l', 'ball_r', 'foot_l', 'foot_r', 'toe_l', 'toe_r'];

  let _authored = {};
  function setAuthored(defs) { _authored = defs || {}; }

  let _libP = null, _assetP = null;
  function lib() {
    if (!_libP) _libP = (async () => {
      const THREE = await import(ESM.three);
      const { GLTFLoader } = await import(ESM.gltf);
      const SkeletonUtils = await import(ESM.skel);
      return { THREE, GLTFLoader, SkeletonUtils };
    })();
    return _libP;
  }

  /* build an original AnimationClip from authored local-axis deltas, using
     the mannequin's bind pose quaternions. */
  function buildAuthored(THREE, skeleton, name, def) {
    const bind = {};
    skeleton.bones.forEach(b => { bind[b.name] = b.quaternion.clone(); });
    const used = new Set();
    def.keys.forEach(k => Object.keys(k.b || {}).forEach(n => used.add(n)));
    const dur = def.dur || 2.4;
    const times = def.keys.map(k => k.t * dur);
    const tracks = [];
    const tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion();
    used.forEach(bn => {
      if (!bind[bn]) return;
      const vals = [];
      def.keys.forEach(k => {
        const d = (k.b && k.b[bn]) || [0, 0, 0];
        tmpE.set(d[0], d[1], d[2], 'XYZ'); tmpQ.setFromEuler(tmpE);
        const q = bind[bn].clone().multiply(tmpQ);
        vals.push(q.x, q.y, q.z, q.w);
      });
      tracks.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times.slice(), vals));
    });
    return new THREE.AnimationClip(name, dur, tracks);
  }

  function assets() {
    if (!_assetP) _assetP = (async () => {
      const { THREE, GLTFLoader } = await lib();
      const loader = new GLTFLoader();
      const [m, a1, a2] = await Promise.all([
        loader.loadAsync(BASE + 'mannequin.glb'),
        loader.loadAsync(BASE + 'base-anim.glb'),
        loader.loadAsync(BASE + 'addon-anim.glb'),
      ]);
      const clips = {};
      [...a1.animations, ...a2.animations].forEach(c => { clips[c.name] = c; });
      /* authored clips, bound to the mannequin's real skeleton */
      let skeleton = null;
      m.scene.traverse(o => { if (o.isSkinnedMesh) skeleton = o.skeleton; });
      if (skeleton) {
        for (const name in _authored) {
          try { clips[name] = buildAuthored(THREE, skeleton, name, _authored[name]); } catch (e) {}
        }
      }
      return { THREE, scene: m.scene, clips };
    })();
    return _assetP;
  }

  function create(canvas, opts) {
    opts = opts || {};
    let THREE, renderer, scene, camera, model, mixer, action, skeleton, hipBone, pelvisBone;
    let raf = null, ready = false, disposed = false;
    let azT = (opts.view && opts.view[0]) || 0.5, elT = (opts.view && opts.view[1]) || 0.06;
    let az = azT, el = elT, pivot;
    let pendingClip = null, speed = 1, playing = !reduce();
    let phaseCb = null, lastT = 0, baseDist = 4, distMult = 1, reground = false, groundFeet = true;
    let _cx = 0, _cy = 0.9, _cz = 0, _shadow = null;   /* figure centre (mean of bones) the camera follows */
    let footBones = [], allBones = [];
    const TARGET = 1.7;

    async function init() {
      try {
        const a = await assets();
        if (disposed) return;
        THREE = a.THREE;
        const L = await lib();
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x222a3a, 1.15));
        const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2.5, 5, 3.5); scene.add(key);
        const rim = new THREE.DirectionalLight(0x88a0d0, 0.6); rim.position.set(-3, 2, -3); scene.add(rim);

        pivot = new THREE.Group(); scene.add(pivot);
        model = L.SkeletonUtils.clone(a.scene);
        const mat = new THREE.MeshStandardMaterial({ color: 0xc3cee0, roughness: 0.82, metalness: 0.05 });
        model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.material = mat; o.frustumCulled = false; if (o.isSkinnedMesh) skeleton = o.skeleton; } });

        pivot.add(model);
        model.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        const measure = (bones) => {
          let ymin = Infinity, ymax = -Infinity, xs = 0, zs = 0, n = 0;
          const list = bones || (skeleton ? skeleton.bones : []);
          if (list.length) list.forEach(b => { b.getWorldPosition(v); ymin = Math.min(ymin, v.y); ymax = Math.max(ymax, v.y); xs += v.x; zs += v.z; n++; });
          else { const bb = new THREE.Box3().setFromObject(model); ymin = bb.min.y; ymax = bb.max.y; n = 1; }
          return { ymin, ymax, h: (ymax - ymin) || 1, cx: xs / (n || 1), cz: zs / (n || 1) };
        };
        let mz = measure();
        model.scale.multiplyScalar(TARGET / mz.h);
        model.updateMatrixWorld(true);
        mz = measure();
        model.position.x -= mz.cx; model.position.z -= mz.cz; model.position.y -= mz.ymin;
        model.updateMatrixWorld(true);
        baseDist = TARGET * 2.05;

        const sg = new THREE.CircleGeometry(TARGET * 0.22, 32);
        _shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24 }));
        _shadow.rotation.x = -Math.PI / 2; _shadow.position.y = 0.002; pivot.add(_shadow);

        if (skeleton) {
          hipBone = skeleton.bones.find(b => b.parent && !b.parent.isBone) || skeleton.bones[0];
          pelvisBone = skeleton.getBoneByName('pelvis') || skeleton.getBoneByName('hips') || hipBone;
          footBones = FEET_BONES.map(n => skeleton.getBoneByName(n)).filter(Boolean);
          allBones = skeleton.bones;
          updateCenter();
        }

        mixer = new THREE.AnimationMixer(model);
        ready = true;
        if (pendingClip) _apply(pendingClip);
        resize();
        if (canvas && canvas.parentElement) canvas.parentElement.classList.add('wk-fig-ready');
        lastT = performance.now();
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (canvas && canvas.parentElement) canvas.parentElement.classList.add('wk-fig-failed');
        console.warn('WorkoutRig: 3D unavailable —', e && e.message);
      }
    }

    function _apply(name) {
      assets().then(a => {
        if (disposed || !mixer) return;
        const isAuth = !!_authored[name];
        const clip = a.clips[name] || a.clips['Idle_Loop'] || Object.values(a.clips)[0];
        if (!clip) return;
        /* authored exercises: keep the figure grounded (contact point on floor) */
        reground = isAuth;
        groundFeet = !(isAuth && _authored[name].ground === 'all');
        const dm = (opts.view && opts.view[2]) || (isAuth && _authored[name].view && _authored[name].view[2]) || 1;
        distMult = dm;
        const next = mixer.clipAction(clip);
        next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.play();
        if (action && action !== next) action.crossFadeTo(next, 0.3, false);
        action = next;
        if (reduce()) { mixer.setTime(clip.duration * 0.5); playing = false; if (reground) doGround(); updateCenter(); render(); }
      });
    }

    function doGround() {
      if (!skeleton) return;
      model.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      const feet = (groundFeet && footBones.length) ? footBones : allBones;
      let ymin = Infinity; feet.forEach(b => { b.getWorldPosition(v); ymin = Math.min(ymin, v.y); });
      model.position.y -= ymin;
    }
    /* figure centre (mean of all bones) — the camera looks here, so the
       figure stays framed for any pose/orientation incl. locomotion. */
    function updateCenter() {
      if (!skeleton || !allBones.length) return;
      model.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      let xs = 0, ys = 0, zs = 0; allBones.forEach(b => { b.getWorldPosition(v); xs += v.x; ys += v.y; zs += v.z; });
      const n = allBones.length;
      _cx = xs / n; _cy = ys / n; _cz = zs / n;
      if (_shadow) { _shadow.position.x = _cx; _shadow.position.z = _cz; }
    }

    function resize() {
      if (!renderer || !camera) return;
      const r = canvas.getBoundingClientRect();
      const w = Math.max(40, r.width), h = Math.max(40, r.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      render();
    }
    function placeCamera() {
      const dist = baseDist * distMult;
      camera.position.set(_cx + Math.sin(az) * Math.cos(el) * dist, _cy + Math.sin(el) * dist, _cz + Math.cos(az) * Math.cos(el) * dist);
      camera.lookAt(_cx, _cy, _cz);
    }
    function render() { if (renderer && scene && camera) { placeCamera(); renderer.render(scene, camera); } }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
      az += (azT - az) * Math.min(1, dt * 8);
      el += (elT - el) * Math.min(1, dt * 8);
      if (mixer && playing && !reduce()) mixer.update(dt * speed);
      if (reground) doGround();
      updateCenter();
      if (phaseCb && action && action.getClip()) phaseCb((action.time % action.getClip().duration) / action.getClip().duration);
      render();
    }

    function orbitFrom(target) {
      let down = false, lx = 0, ly = 0;
      const pt = e => { const s = e.touches ? e.touches[0] : e; return { x: s.clientX, y: s.clientY }; };
      const d = e => { down = true; const p = pt(e); lx = p.x; ly = p.y; };
      const m = e => { if (!down) return; const p = pt(e); azT += (p.x - lx) * 0.011; elT = Math.max(-0.5, Math.min(0.9, elT + (p.y - ly) * 0.006)); lx = p.x; ly = p.y; if (e.cancelable) e.preventDefault(); };
      const u = () => { down = false; };
      target.addEventListener('pointerdown', d);
      window.addEventListener('pointermove', m, { passive: false });
      window.addEventListener('pointerup', u);
      api._off = () => { target.removeEventListener('pointerdown', d); window.removeEventListener('pointermove', m); window.removeEventListener('pointerup', u); };
    }

    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(canvas);

    const api = {
      setClip(name) { pendingClip = name; if (ready) _apply(name); return api; },
      play() { playing = true; return api; },
      pause() { playing = false; return api; },
      setPlaying(b) { playing = !!b; return api; },
      setSpeed(m) { speed = m; return api; },
      setView(azDeg, elDeg) { azT = azDeg * Math.PI / 180; elT = elDeg * Math.PI / 180; return api; },
      setPhase(p) { if (action && action.getClip()) { action.time = Math.max(0, Math.min(1, p)) * action.getClip().duration; if (mixer) mixer.update(0); if (reground) doGround(); updateCenter(); render(); } return api; },
      getPhase() { return action && action.getClip() ? (action.time / action.getClip().duration) : 0; },
      onPhase(cb) { phaseCb = cb; return api; },
      orbitFrom, resize,
      isReduced() { return reduce(); },
      dispose() {
        disposed = true; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (api._off) api._off();
        try { if (mixer) mixer.stopAllAction(); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } } catch (e) {}
        renderer = scene = camera = model = mixer = null;
      },
    };

    init();
    return api;
  }

  return { create, preload: assets, setAuthored };
})();
