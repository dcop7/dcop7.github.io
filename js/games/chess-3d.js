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
  /* Proporções Staunton (rei = referência): peão baixo e redondo, torre
     larga e atarracada, bispo esguio com mitra e ranhura, dama com coroa
     de bolas, rei o mais alto com cruz. Cada tipo devolve { body, accent }:
     o "accent" (ranhura, faixas, cruz) pinta-se com a cor de contraste. */
  const base = R => [[0, 0], [R, 0], [R + .01, .045], [R * .93, .09], [R * .85, .105], [R * .84, .14], [R * .66, .17]];
  const band = (r, y, h) => new THREE.CylinderGeometry(r, r, h, 28).translate(0, y, 0);
  function geoFor(t) {
    if (_geo[t]) return _geo[t];
    let body, accent;
    if (t === 'p') {                    /* altura ≈ .66 */
      body = merge([lathe([...base(.29), [.15, .26], [.1, .36], [.19, .385], [.19, .41], [.09, .43], [0, .43]]), new THREE.SphereGeometry(.13, 24, 16).translate(0, .53, 0)]);
      accent = band(.195, .397, .018);
    } else if (t === 'r') {             /* ≈ .82 */
      const cren = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + Math.PI / 4; return new THREE.BoxGeometry(.13, .12, .11).rotateY(-a).translate(Math.cos(a) * .2, .76, Math.sin(a) * .2); });
      body = merge([lathe([...base(.34), [.24, .22], [.21, .58], [.28, .61], [.28, .7], [.17, .7], [.17, .66], [0, .66]]), ...cren]);
      accent = band(.285, .605, .03);
    } else if (t === 'b') {             /* ≈ 1.07 */
      body = merge([lathe([...base(.31), [.14, .24], [.085, .6], [.18, .63], [.18, .66], [.08, .68], [.12, .72], [.165, .8], [.16, .88], [.11, .95], [.04, .98], [0, .98]]), new THREE.SphereGeometry(.055, 12, 10).translate(0, 1.02, 0)]);
      accent = merge([new THREE.BoxGeometry(.34, .035, .06).rotateZ(-.7).translate(.02, .86, 0), band(.185, .645, .02)]);
    } else if (t === 'q') {             /* ≈ 1.16 */
      const balls = Array.from({ length: 9 }, (_, i) => new THREE.SphereGeometry(.045, 10, 8).translate(Math.cos(i / 9 * Math.PI * 2) * .2, .99, Math.sin(i / 9 * Math.PI * 2) * .2));
      body = merge([lathe([...base(.35), [.2, .24], [.115, .66], [.23, .7], [.23, .73], [.12, .76], [.2, .92], [.23, .97], [.14, .97], [.1, 1.01], [0, 1.01]]), ...balls, new THREE.SphereGeometry(.075, 14, 12).translate(0, 1.08, 0)]);
      accent = merge([band(.235, .715, .03), band(.232, .955, .02)]);
    } else if (t === 'k') {             /* ≈ 1.35 */
      body = merge([lathe([...base(.36), [.21, .24], [.125, .72], [.245, .76], [.245, .79], [.13, .82], [.21, 1.0], [.23, 1.03], [.12, 1.05], [.07, 1.08], [0, 1.08]])]);
      accent = merge([new THREE.BoxGeometry(.075, .26, .075).translate(0, 1.2, 0), new THREE.BoxGeometry(.22, .07, .075).translate(0, 1.22, 0), band(.25, .775, .03)]);
    } else {                            /* cavalo ≈ .98: cabeça em perfil com crina e olhos */
      const sh = new THREE.Shape();
      sh.moveTo(-.19, .18); sh.lineTo(.21, .18); sh.quadraticCurveTo(.2, .42, .07, .55); sh.lineTo(.28, .64); sh.quadraticCurveTo(.35, .72, .27, .83);
      sh.lineTo(.1, .88); sh.quadraticCurveTo(.05, 1.0, -.07, .93); sh.quadraticCurveTo(-.23, .8, -.22, .56); sh.quadraticCurveTo(-.22, .34, -.19, .18);
      const head = new THREE.ExtrudeGeometry(sh, { depth: .2, bevelEnabled: true, bevelThickness: .045, bevelSize: .035, bevelSegments: 3, curveSegments: 12 });
      head.translate(0, 0, -.1); head.rotateY(-Math.PI / 2);
      body = merge([lathe(base(.33).concat([[.22, .2], [0, .2]])), head]);
      const mane = new THREE.BoxGeometry(.05, .5, .26).rotateX(.45).translate(0, .66, .17);
      const eyes = [-1, 1].map(sd => new THREE.SphereGeometry(.035, 8, 6).translate(sd * .13, .76, -.03));
      accent = merge([mane, ...eyes]);
    }
    const top = { p: .66, r: .82, b: 1.07, q: 1.16, k: 1.35, n: .98 }[t];
    return (_geo[t] = { body, accent, top });
  }
  /* emblema com o símbolo da peça (lê-se sempre, de qualquer ângulo) */
  const _badge = {};
  function badgeTex(t, color) {
    const k = t + color; if (_badge[k]) return _badge[k];
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.beginPath(); x.arc(64, 64, 58, 0, 6.3);
    x.fillStyle = color === 'w' ? 'rgba(248,245,236,.96)' : 'rgba(24,27,34,.96)'; x.fill();
    x.lineWidth = 6; x.strokeStyle = color === 'w' ? '#1f2937' : '#f5d98b'; x.stroke();
    x.font = '84px "Segoe UI Symbol","Apple Symbols","Noto Sans Symbols2","DejaVu Sans",sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = color === 'w' ? '#111827' : '#f5d98b';
    x.fillText({ p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }[t], 64, 70);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    return (_badge[k] = tx);
  }

  function create(stage, onSquare) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.className = 'ch3d';
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:3;touch-action:manipulation;cursor:pointer';
    stage.appendChild(cv);
    const scene = new THREE.Scene(); scene.environment = Arcade3D.env(renderer);
    scene.add(new THREE.HemisphereLight('#f8fafc', '#1f2937', .8));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2); sun.position.set(-4, 10, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
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
    const pieceM = { w: new THREE.MeshStandardMaterial({ roughness: .3, metalness: .05 }), b: new THREE.MeshStandardMaterial({ roughness: .2, metalness: .25, envMapIntensity: 1.5 }) };
    /* contorno (casca virada para dentro, um pouco maior): claro nas pretas, escuro nas brancas —
       as peças destacam-se de qualquer casa, mesmo nos temas escuros */
    const outM = { w: new THREE.MeshBasicMaterial({ color: '#111827', side: THREE.BackSide }), b: new THREE.MeshBasicMaterial({ color: '#f8fafc', side: THREE.BackSide }) };
    /* luz de recorte vinda de trás: acende as silhuetas */
    const accM = { w: new THREE.MeshStandardMaterial({ color: '#8a6a2f', metalness: .7, roughness: .3 }), b: new THREE.MeshStandardMaterial({ color: '#d9b25b', metalness: .8, roughness: .25 }) };
    let badges = true;
    const rim = new THREE.DirectionalLight('#dbeafe', 2.4); rim.position.set(0, 6, -9); scene.add(rim);
    const pieces = [];            /* { mesh, type, color, sq, anim } */
    let flip = false, raf = 0, lastT = performance.now(), dead = false;

    const pos = sq => { const c = FILES.indexOf(sq[0]), r = 8 - (+sq[1]); return [c - 3.5, r - 3.5]; };
    function addPiece(type, color, sq, fadeIn) {
      const G = geoFor(type);
      const m = new THREE.Mesh(G.body, pieceM[color]); m.castShadow = true; m.receiveShadow = true;
      const o = new THREE.Mesh(G.body, outM[color]); o.scale.set(1.09, 1.04, 1.09); o.position.y = -.018; m.add(o);
      const ac = new THREE.Mesh(G.accent, accM[color]); ac.castShadow = true; m.add(ac);
      const bd = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex(type, color), depthTest: true, transparent: true }));
      bd.position.y = G.top + .18; bd.scale.set(.42, .42, 1); bd.visible = badges; m.add(bd); m.userData.badge = bd;
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
      /* cores do tema, mas com contraste garantido: brancas claras, pretas escuras mas não negras */
      /* em 3D as peças têm sempre marfim e ébano (a cor do tema confundia-se com as casas) */
      pieceM.w.color.set('#f4efe4'); pieceM.b.color.set('#23262e');
      rim.position.z = st.flip ? 9 : -9;
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
      /* afasta a câmara até os cantos da moldura e o topo das peças do fundo caberem com folga */
      if (fit.s !== s || fit.a !== cam.aspect) {
        fit.s = s; fit.a = cam.aspect;
        /* só a moldura e o topo das peças do fundo têm de caber — o resto é margem desperdiçada */
        const pts = [[-4.55, -.3, 4.55], [4.55, -.3, 4.55], [-4.55, -.3, -4.55], [4.55, -.3, -4.55], [-3.5, 1.6, -3.5], [3.5, 1.6, -3.5], [0, 1.6, -3.5]].map(p => new THREE.Vector3(p[0], p[1], p[2] * s));
        const elev = cam.aspect < .95 ? 1.45 : 1.3;          /* ecrã ao alto: câmara mais a pique */
        let lo = .5, hi = 3;
        for (let i = 0; i < 18; i++) {
          const f = (lo + hi) / 2;
          cam.position.set(0, 11 * f * elev / 1.3, 8.6 * f * s); cam.lookAt(0, 0, .35 * s); cam.updateMatrixWorld();
          /* conta a extensão (não a posição): depois centra-se na vertical com setViewOffset */
          cam.clearViewOffset();
          let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
          pts.forEach(p => { const v = p.clone().project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); });
          const ok = x1 - x0 < 1.96 && y1 - y0 < 1.94 && y0 > -9;
          if (ok) fit.cy = (y0 + y1) / 2;
          if (ok) hi = f; else lo = f;
        }
        fit.f = hi;
      }
      const elev = cam.aspect < .95 ? 1.45 : 1.3;
      cam.position.set(0, 11 * fit.f * elev / 1.3, 8.6 * fit.f * s); cam.lookAt(0, 0, .35 * s);
      cam.setViewOffset(fit.w, fit.h, 0, -(fit.cy || 0) * fit.h / 2, fit.w, fit.h);
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
      scene.traverse(o => { if (o.geometry && !Object.values(_geo).some(g => g.body === o.geometry || g.accent === o.geometry)) o.geometry.dispose(); if (o.material) { if (o.material.map && !Object.values(_badge).includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); } });
      renderer.dispose(); cv.remove();
    }
    return { sync, dispose, canvas: cv, setBadges(on) { badges = on; pieces.forEach(p => { p.mesh.userData.badge.visible = on; }); } };
  }

  return { create };
})();
