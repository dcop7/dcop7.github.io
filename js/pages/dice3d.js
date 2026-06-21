/* ══════════════════════════════════════════════════════════════════
   DICE3D — real 3D dice (d4·d6·d8·d10·d12·d20) and a coin, with a proper
   tumbling roll/flip that settles on the result. Uses the vendored three.js
   (js/vendor/three.min.js), loaded on demand — no external assets, offline.
   Used by the Tools page (Dados / Moeda).
   ══════════════════════════════════════════════════════════════════ */
const Dice3D = (function () {
  'use strict';
  const SRC = 'js/vendor/three.min.js';
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const ex = document.querySelector(`script[src="${SRC}"]`);
      if (ex) { ex.addEventListener('load', resolve); ex.addEventListener('error', reject); if (window.THREE) resolve(); return; }
      const s = Object.assign(document.createElement('script'), { src: SRC });
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }

  /* per-die look (size, colour, number scale) */
  const CFG = {
    4:  { color: '#e63946', num: 0.78, geo: () => new THREE.TetrahedronGeometry(1.25) },
    6:  { color: '#3a86ff', num: 0.8,  geo: () => new THREE.BoxGeometry(1.55, 1.55, 1.55) },
    8:  { color: '#2a9d8f', num: 0.7,  geo: () => new THREE.OctahedronGeometry(1.2) },
    10: { color: '#f4a261', num: 0.62, geo: d10Geom },
    12: { color: '#9b5de5', num: 0.56, geo: () => new THREE.DodecahedronGeometry(1.08) },
    20: { color: '#e76f51', num: 0.5,  geo: () => new THREE.IcosahedronGeometry(1.12) },
  };

  /* pentagonal trapezohedron (the classic d10), built explicitly so we know
     each kite's centre + outward normal for numbering and settling. */
  function d10Geom() {
    const N = 5, R = 1.05, zig = 0.32, apex = 1.0;
    const ring = [];
    for (let i = 0; i < 2 * N; i++) { const a = (i / (2 * N)) * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * R, (i % 2 ? -zig : zig), Math.sin(a) * R)); }
    const TOP = new THREE.Vector3(0, apex, 0), BOT = new THREE.Vector3(0, -apex, 0);
    const up = i => ring[(2 * i) % (2 * N)], lo = i => ring[(2 * i + 1) % (2 * N)];
    const tris = [], faces = [];
    const kite = (apexV, a, b, c) => {            // a,b,c,apex roughly planar → 2 tris
      tris.push(apexV, a, b, apexV, b, c);
      const cen = new THREE.Vector3().add(apexV).add(a).add(b).add(c).multiplyScalar(0.25);
      faces.push({ centroid: cen, normal: cen.clone().normalize() });
    };
    for (let i = 0; i < N; i++) kite(TOP, up(i), lo(i), up(i + 1));
    for (let i = 0; i < N; i++) kite(BOT, lo(i), up(i + 1), lo(i + 1));
    const pos = new Float32Array(tris.length * 3);
    tris.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.computeVertexNormals();
    return { geom, faces };
  }

  /* group a geometry's triangles into logical faces (centre + outward normal) */
  function faceList(geom) {
    const p = geom.attributes.position, idx = geom.index;
    const n = idx ? idx.count / 3 : p.count / 3;
    const get = i => new THREE.Vector3().fromBufferAttribute(p, idx ? idx.getX(i) : i);
    const groups = new Map();
    for (let t = 0; t < n; t++) {
      const a = get(t * 3), b = get(t * 3 + 1), c = get(t * 3 + 2);
      const nm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      const key = `${nm.x.toFixed(1)}_${nm.y.toFixed(1)}_${nm.z.toFixed(1)}`;
      let g = groups.get(key); if (!g) { g = { vs: [] }; groups.set(key, g); }
      g.vs.push(a, b, c);
    }
    const faces = [];
    for (const g of groups.values()) {
      const seen = new Set(); const c = new THREE.Vector3(); let cnt = 0;
      for (const v of g.vs) { const k = `${v.x.toFixed(2)}_${v.y.toFixed(2)}_${v.z.toFixed(2)}`; if (seen.has(k)) continue; seen.add(k); c.add(v); cnt++; }
      c.multiplyScalar(1 / cnt);
      faces.push({ centroid: c, normal: c.clone().normalize() });
    }
    return faces;
  }

  /* canvas number/pip texture for a face */
  function numTexture(label, color) {
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.translate(S / 2, S / 2);
    ctx.font = `900 ${label.length > 1 ? 70 : 92}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(label, 0, 4);
    ctx.fillStyle = '#fff'; ctx.fillText(label, 0, 4);
    if (label === '6' || label === '9') { ctx.fillRect(-20, 44, 40, 6); }   // underline ambiguous values
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; return tex;
  }
  function coinTexture(label) {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d'); const r = S / 2;
    const g = ctx.createRadialGradient(r, r * 0.8, 10, r, r, r);
    g.addColorStop(0, '#ffe9a8'); g.addColorStop(.55, '#f2c14e'); g.addColorStop(1, '#b8860b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r, r, r - 4, 0, 7); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(120,80,0,.5)'; ctx.beginPath(); ctx.arc(r, r, r - 18, 0, 7); ctx.stroke();
    ctx.fillStyle = '#6b4a00'; ctx.font = '800 52px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, r, r);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; return tex;
  }

  function create(container) {
    let renderer, scene, camera, group, coin, faces = [], raf = 0, ro = null, three = false, mode = 'dice', dieColor = '#3a86ff';

    function setup() {
      const w = container.clientWidth || 220, h = container.clientHeight || 200;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(w, h); container.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100); camera.position.set(0, 0, 5.2);
      scene.add(new THREE.AmbientLight(0xffffff, 0.72));
      const d1 = new THREE.DirectionalLight(0xffffff, 1.05); d1.position.set(3, 5, 4); scene.add(d1);
      const d2 = new THREE.DirectionalLight(0x88aaff, 0.4); d2.position.set(-4, -2, 2); scene.add(d2);
      ro = new ResizeObserver(() => { if (!renderer) return; const W = container.clientWidth, H = container.clientHeight; if (!W || !H) return; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); render(); });
      ro.observe(container);
    }
    function render() { if (renderer) renderer.render(scene, camera); }
    function clearObj(o) { if (!o) return; scene.remove(o); o.traverse?.(c => { c.geometry?.dispose?.(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); }); }

    function buildDie(sides) {
      clearObj(group); clearObj(coin); coin = null;
      dieColor = CFG[sides].color;
      const built = CFG[sides].geo();
      const geom = built.geom || built;
      faces = built.faces || faceList(geom);
      group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(dieColor), roughness: 0.42, metalness: 0.18, flatShading: true });
      group.add(new THREE.Mesh(geom, mat));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 8), new THREE.LineBasicMaterial({ color: 0x10131c, transparent: true, opacity: 0.5 }));
      group.add(edges);
      const ns = CFG[sides].num;
      faces.forEach((f, i) => {
        const val = i + 1;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(ns, ns), new THREE.MeshBasicMaterial({ map: numTexture(String(val), dieColor), transparent: true, depthWrite: false }));
        plane.position.copy(f.centroid).addScaledVector(f.normal, 0.012);
        plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal.clone().normalize());
        group.add(plane);
        f.value = val;
      });
      // pleasant resting tilt
      group.quaternion.setFromEuler(new THREE.Euler(-0.35, 0.5, 0.1));
      scene.add(group); render();
    }

    function buildCoin() {
      clearObj(group); clearObj(coin); group = null;
      coin = new THREE.Group();
      const g = new THREE.CylinderGeometry(1.25, 1.25, 0.22, 60); g.rotateX(Math.PI / 2);   // faces toward camera (±Z)
      const side = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.35, metalness: 0.7 });
      const heads = new THREE.MeshStandardMaterial({ map: coinTexture('CARA'), roughness: 0.4, metalness: 0.5 });
      const tails = new THREE.MeshStandardMaterial({ map: coinTexture('COROA'), roughness: 0.4, metalness: 0.5 });
      coin.add(new THREE.Mesh(g, [side, heads, tails]));   // [side, +cap→+Z(heads), -cap→tails]
      coin.rotation.set(-0.25, 0, 0);
      scene.add(coin); render();
    }

    function roll(value) {
      if (!three || !group) return Promise.resolve(value);
      cancelAnimationFrame(raf);
      const f = faces.find(x => x.value === value) || faces[0];
      const qT = new THREE.Quaternion().setFromUnitVectors(f.normal.clone().normalize(), new THREE.Vector3(0, 0, 1));
      qT.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - .5) * 0.4));
      const q0 = group.quaternion.clone();
      const axis = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      const turns = 3 + Math.random() * 3, T = 1150, t0 = performance.now(); let mid = null;
      return new Promise(res => {
        (function step(now) {
          const t = Math.min(1, (now - t0) / T);
          if (t < 0.62) { const k = t / 0.62; const q = new THREE.Quaternion().setFromAxisAngle(axis, k * turns * Math.PI * 2); group.quaternion.copy(q0).multiply(q); }
          else { if (!mid) mid = group.quaternion.clone(); const e = 1 - Math.pow(1 - (t - 0.62) / 0.38, 3); group.quaternion.copy(mid).slerp(qT, e); }
          group.position.y = Math.sin(t * Math.PI) * 0.45 * (1 - t * 0.35);
          group.scale.setScalar(1 + Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.05);
          render();
          if (t < 1) raf = requestAnimationFrame(step);
          else { group.position.y = 0; group.scale.setScalar(1); group.quaternion.copy(qT); render(); res(value); }
        })(t0);
      });
    }

    function flip(isHeads) {
      if (!three || !coin) return Promise.resolve(isHeads);
      cancelAnimationFrame(raf);
      const turns = 4 + Math.floor(Math.random() * 3), finalRot = isHeads ? 0 : Math.PI;
      const target = turns * Math.PI * 2 + finalRot, T = 1150, t0 = performance.now();
      coin.rotation.x = 0;
      return new Promise(res => {
        (function step(now) {
          const t = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - t, 3);
          coin.rotation.x = -0.25 + target * e;
          coin.position.y = Math.sin(t * Math.PI) * 0.7;
          coin.rotation.z = Math.sin(t * Math.PI * 3) * 0.25 * (1 - t);
          render();
          if (t < 1) raf = requestAnimationFrame(step);
          else { coin.rotation.x = finalRot; coin.position.y = 0; coin.rotation.z = 0; render(); res(isHeads); }
        })(t0);
      });
    }

    let ready = loadThree().then(() => { three = true; setup(); }).catch(() => { three = false; });

    return {
      whenReady: cb => ready.then(cb),
      die(sides) { ready.then(() => three && buildDie(sides)); },
      coin() { ready.then(() => three && buildCoin()); },
      roll(v) { return ready.then(() => roll(v)); },
      flip(h) { return ready.then(() => flip(h)); },
      ok() { return three; },
      dispose() { cancelAnimationFrame(raf); ro?.disconnect(); clearObj(group); clearObj(coin); renderer?.dispose?.(); renderer?.domElement?.remove(); renderer = null; },
    };
  }

  return { create };
})();
