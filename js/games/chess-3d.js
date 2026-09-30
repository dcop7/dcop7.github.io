/* ══════════════════════════════════════════════════════════════════
   Chess3D — tabuleiro de xadrez em 3D (opcional; o 2D é o padrão).
   Peças torneadas (LatheGeometry) com o cavalo recortado em perfil,
   tabuleiro com moldura, reflexos de estúdio e sombras. As jogadas
   animam-se: a peça desliza (o cavalo salta em arco), as capturadas
   afundam e desaparecem, o roque move as duas peças.
   Recebe o estado do game-chess.js a cada desenho (sync) e devolve os
   cliques como casas ('e4') — as regras continuam todas no chess.js.
══════════════════════════════════════════════════════════════════ */
const Chess3D = (function () {
  'use strict';
  const FILES = 'abcdefgh';
  const _geo = {};

  /* perfis (raio, altura) das peças, rodados à volta do eixo y */
  function lathe(pts, seg) { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg || 28); g.computeVertexNormals(); return g; }
  function merge(parts) {
    /* junta geometrias simples (todas não indexadas) numa só */
    const arrs = parts.map(g => (g.index ? g.toNonIndexed() : g));
    let n = 0; arrs.forEach(g => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    arrs.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return m;
  }
  const BASE = [[0, 0], [.36, 0], [.37, .04], [.34, .09], [.3, .1], [.29, .14], [.24, .16]];
  function geoFor(t) {
    if (_geo[t]) return _geo[t];
    let g;
    if (t === 'p') g = merge([lathe([...BASE, [.17, .22], [.12, .42], [.2, .45], [.2, .48], [.1, .5], [0, .5]]), new THREE.SphereGeometry(.15, 20, 14).translate(0, .62, 0)]);
    else if (t === 'r') g = merge([lathe([...BASE, [.22, .22], [.2, .58], [.27, .6], [.27, .76], [.2, .76], [.2, .7], [0, .7]]),
      ...[0, 1, 2, 3].map(i => new THREE.BoxGeometry(.1, .1, .14).translate(Math.cos(i * Math.PI / 2 + Math.PI / 4) * .21, .81, Math.sin(i * Math.PI / 2 + Math.PI / 4) * .21).rotateY(0))]);
    else if (t === 'b') g = merge([lathe([...BASE, [.17, .22], [.11, .56], [.2, .6], [.2, .63], [.12, .66], [.17, .74], [.16, .84], [.09, .93], [0, .96]]), new THREE.SphereGeometry(.05, 10, 8).translate(0, 1.0, 0)]);
    else if (t === 'q') g = merge([lathe([...BASE, [.2, .22], [.12, .62], [.23, .68], [.23, .71], [.14, .74], [.22, .9], [.2, .96], [.1, .98], [0, .98]]),
      ...Array.from({ length: 8 }, (_, i) => new THREE.SphereGeometry(.045, 8, 6).translate(Math.cos(i / 8 * Math.PI * 2) * .2, .99, Math.sin(i / 8 * Math.PI * 2) * .2)), new THREE.SphereGeometry(.07, 12, 10).translate(0, 1.06, 0)]);
    else if (t === 'k') g = merge([lathe([...BASE, [.21, .22], [.13, .66], [.24, .72], [.24, .75], [.15, .78], [.21, .96], [.12, 1.0], [0, 1.0]]),
      new THREE.BoxGeometry(.06, .26, .06).translate(0, 1.13, 0), new THREE.BoxGeometry(.2, .06, .06).translate(0, 1.16, 0)]);
    else { /* cavalo: base torneada + cabeça em perfil extrudido */
      const s = new THREE.Shape();
      s.moveTo(-.17, .2); s.lineTo(.2, .2); s.quadraticCurveTo(.2, .44, .06, .56); s.lineTo(.26, .64); s.quadraticCurveTo(.32, .72, .24, .82);
      s.lineTo(.08, .86); s.quadraticCurveTo(.02, .98, -.08, .9); s.quadraticCurveTo(-.2, .78, -.2, .56); s.quadraticCurveTo(-.2, .36, -.17, .2);
      const head = new THREE.ExtrudeGeometry(s, { depth: .18, bevelEnabled: true, bevelThickness: .04, bevelSize: .03, bevelSegments: 2, curveSegments: 10 });
      head.translate(0, 0, -.09); head.rotateY(-Math.PI / 2); head.computeVertexNormals();
      g = merge([lathe(BASE.concat([[.2, .2], [0, .2]])), head]);
    }
    g.computeBoundingSphere();
    return (_geo[t] = g);
  }

  function create(stage, onSquare) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.className = 'ch3d';
    cv.style.cssText = 'position:absolute;inset:-8% -4% 0 -4%;width:108%;height:108%;display:block;z-index:3;touch-action:manipulation;cursor:pointer';
    stage.appendChild(cv);
    const scene = new THREE.Scene(); scene.environment = Arcade3D.env(renderer);
    scene.add(new THREE.HemisphereLight('#f8fafc', '#1f2937', .8));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2); sun.position.set(-4, 10, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(38, 1, .1, 100);
    /* tabuleiro */
    const sqGeo = new THREE.BoxGeometry(1, .16, 1);
    const lightM = new THREE.MeshStandardMaterial({ roughness: .45, metalness: .05 }), darkM = new THREE.MeshStandardMaterial({ roughness: .45, metalness: .05 });
    const squares = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const m = new THREE.Mesh(sqGeo, (r + c) % 2 ? darkM : lightM);
      m.position.set(c - 3.5, -.08, r - 3.5); m.receiveShadow = true;
      m.userData.sq = FILES[c] + (8 - r); scene.add(m); squares.push(m);
    }
    const frameM = new THREE.MeshStandardMaterial({ roughness: .35, metalness: .15 });
    const frame = new THREE.Mesh(Arcade3D.roundBox(.06), frameM); frame.scale.set(9, .3, 9); frame.position.y = -.2; frame.receiveShadow = true; scene.add(frame);
    /* coordenadas (a..h, 1..8) na moldura */
    const lbl = (ch) => { const c2 = document.createElement('canvas'); c2.width = c2.height = 64; const x = c2.getContext('2d'); x.font = '700 40px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(ch, 32, 34); const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return new THREE.Mesh(new THREE.PlaneGeometry(.34, .34), new THREE.MeshBasicMaterial({ map: t, transparent: true })); };
    const labels = [];
    for (let i = 0; i < 8; i++) { const a = lbl(FILES[i]); a.rotation.x = -Math.PI / 2; a.position.set(i - 3.5, -.04, 4.25); scene.add(a); labels.push(a); const b = lbl(String(8 - i)); b.rotation.x = -Math.PI / 2; b.position.set(-4.25, -.04, i - 3.5); scene.add(b); labels.push(b); }
    /* marcadores */
    const mk = (geo, color, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m; };
    const selM = mk(new THREE.RingGeometry(.38, .48, 32), '#4ade80', .95);
    const lastA = mk(new THREE.PlaneGeometry(1, 1), '#f5cd50', .4), lastB = mk(new THREE.PlaneGeometry(1, 1), '#f5cd50', .4);
    const checkM = mk(new THREE.CircleGeometry(.5, 32), '#ef4444', .6);
    const dots = [], rings = [];
    for (let i = 0; i < 28; i++) { dots.push(mk(new THREE.CircleGeometry(.14, 20), '#22c55e', .75)); rings.push(mk(new THREE.RingGeometry(.4, .47, 28), '#22c55e', .8)); }
    const pieceM = { w: new THREE.MeshStandardMaterial({ roughness: .28, metalness: .08 }), b: new THREE.MeshStandardMaterial({ roughness: .28, metalness: .08 }) };
    const pieces = [];            /* { mesh, type, color, sq, anim } */
    let flip = false, raf = 0, lastT = performance.now(), dead = false;

    const pos = sq => { const c = FILES.indexOf(sq[0]), r = 8 - (+sq[1]); return [c - 3.5, r - 3.5]; };
    function addPiece(type, color, sq, fadeIn) {
      const m = new THREE.Mesh(geoFor(type), pieceM[color]); m.castShadow = true; m.receiveShadow = true;
      const [x, z] = pos(sq); m.position.set(x, 0, z);
      if (type === 'n') m.rotation.y = color === 'w' ? 0 : Math.PI;
      m.scale.setScalar(fadeIn ? .01 : 1);
      scene.add(m);
      const p = { mesh: m, type, color, sq, anim: fadeIn ? { k: 'in', t: 0 } : null };
      pieces.push(p); return p;
    }

    /* estado vindo do jogo */
    function sync(st) {
      flip = st.flip;
      const th = st.theme;
      lightM.color.set(th.light); darkM.color.set(th.dark); frameM.color.set(th.frame);
      pieceM.w.color.set(th.pcLight); pieceM.b.color.set(th.pcDark);
      /* peças: emparelha o que existe com o novo tabuleiro e anima as diferenças */
      const want = new Map();
      st.board.forEach((row, r) => row.forEach((pc, c) => { if (pc) want.set(FILES[c] + (8 - r), pc); }));
      const keep = new Set();
      pieces.forEach(p => { const w = want.get(p.sq); if (w && w.type === p.type && w.color === p.color && !p.anim?.out) { keep.add(p); want.delete(p.sq); } });
      const free = pieces.filter(p => !keep.has(p) && !(p.anim && p.anim.out));
      want.forEach((pc, sq) => {
        /* de onde veio? a mesma peça que ficou sem casa (preferência: a do lance animado) */
        let src = free.find(p => p.type === pc.type && p.color === pc.color && st.anim && p.sq === st.anim.from)
          || free.find(p => p.type === pc.type && p.color === pc.color);
        if (src) {
          free.splice(free.indexOf(src), 1);
          const [x0, z0] = pos(src.sq), [x1, z1] = pos(sq);
          src.anim = st.animate ? { k: 'move', t: 0, x0, z0, x1, z1, hop: src.type === 'n' ? .9 : .25 } : null;
          if (!st.animate) src.mesh.position.set(x1, 0, z1);
          src.sq = sq; keep.add(src);
        } else addPiece(pc.type, pc.color, sq, st.animate);     /* promoção / começo */
      });
      free.forEach(p => { p.anim = st.animate ? { k: 'out', t: 0, out: true } : null; if (!st.animate) { scene.remove(p.mesh); pieces.splice(pieces.indexOf(p), 1); } });
      /* marcadores */
      const at = (m, sq, y) => { if (!sq) { m.visible = false; return; } const [x, z] = pos(sq); m.position.set(x, y || .005, z); m.visible = true; };
      at(selM, st.selected, .01);
      at(lastA, st.lastMove && st.lastMove.from); at(lastB, st.lastMove && st.lastMove.to);
      at(checkM, st.checkSq, .012);
      dots.forEach(d => { d.visible = false; }); rings.forEach(d => { d.visible = false; });
      if (st.hints) st.dests.forEach((sq, i) => { if (i >= dots.length) return; const occ = st.board[8 - (+sq[1])][FILES.indexOf(sq[0])]; at(occ ? rings[i] : dots[i], sq, .015); });
      if (!raf) loop();
    }

    function fit() {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w !== fit.w || h !== fit.h) { fit.w = w; fit.h = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    }
    function loop() {
      raf = 0; if (dead || !cv.isConnected || !cv.getClientRects().length) return;   /* fora do ecrã pára; o próximo sync volta a ligar */
      const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
      fit();
      const s = flip ? -1 : 1;
      const far = cam.aspect < .95 ? 1.18 : 1;   /* ecrãs estreitos: afasta para caber a largura */
      cam.position.set(0, 11.4 * far, 9.2 * far * s); cam.lookAt(0, -.5, .45 * s);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i], a = p.anim; if (!a) continue;
        a.t += dt;
        if (a.k === 'move') {
          const k = Math.min(1, a.t / .32), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          p.mesh.position.set(a.x0 + (a.x1 - a.x0) * e, Math.sin(k * Math.PI) * a.hop, a.z0 + (a.z1 - a.z0) * e);
          if (k >= 1) { p.anim = null; p.mesh.position.y = 0; }
        } else if (a.k === 'out') {
          const k = Math.min(1, a.t / .35); p.mesh.position.y = -k * .6; p.mesh.scale.setScalar(1 - k * .6);
          if (k >= 1) { scene.remove(p.mesh); pieces.splice(i, 1); }
        } else if (a.k === 'in') {
          const k = Math.min(1, a.t / .3); p.mesh.scale.setScalar(.01 + k * .99 * (1 + Math.sin(k * Math.PI) * .15));
          if (k >= 1) { p.anim = null; p.mesh.scale.setScalar(1); }
        }
      }
      selM.material.opacity = .7 + Math.sin(now / 180) * .25;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    }

    /* clique → casa */
    const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect();
      v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v2, cam);
      const hit = ray.intersectObjects(squares, false)[0]
        || (() => { const ph = ray.intersectObjects(pieces.map(p => p.mesh), false)[0]; if (!ph) return null; const pc = pieces.find(p => p.mesh === ph.object); return pc ? { object: { userData: { sq: pc.sq } } } : null; })();
      if (hit) { e.preventDefault(); onSquare(hit.object.userData.sq); }
    });

    function dispose() {
      dead = true; cancelAnimationFrame(raf);
      scene.traverse(o => { if (o.geometry && !Object.values(_geo).includes(o.geometry)) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      renderer.dispose(); cv.remove();
    }
    return { sync, dispose, canvas: cv };
  }

  return { create };
})();
