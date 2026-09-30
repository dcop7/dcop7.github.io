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
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    arrs.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; });
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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
      const head = new THREE.ExtrudeGeometry(sh, { depth: .16, bevelEnabled: true, bevelThickness: .07, bevelSize: .05, bevelSegments: 5, curveSegments: 16 });
      head.translate(0, 0, -.08); head.rotateY(-Math.PI / 2); head.computeVertexNormals();
      const ears = [-1, 1].map(sd => new THREE.ConeGeometry(.045, .13, 10).rotateX(.35).translate(sd * .06, .95, .05));
      body = merge([lathe(base(.33).concat([[.22, .2], [0, .2]])), head, ...ears]);
      const mane = new THREE.BoxGeometry(.06, .52, .07).rotateX(.5).translate(0, .67, .2);
      const eyes = [-1, 1].map(sd => new THREE.SphereGeometry(.03, 10, 8).translate(sd * .145, .77, -.05));
      accent = merge([mane, ...eyes]);
    }
    const top = { p: .66, r: .82, b: 1.07, q: 1.16, k: 1.35, n: .98 }[t];
    return (_geo[t] = { body, accent, top });
  }
  /* veio da madeira: riscas ao longo do perfil (u = à volta da peça, v = ao longo
     do torneado) — o marfim/buxo e o ébano ganham textura sem imagens */
  const _tex = {};
  function grainTex(key, base, dark, light, n) {
    if (_tex[key]) return _tex[key];
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < n; i++) {
      const x0 = rnd() * 256, w = .6 + rnd() * 2.2, amp = 2 + rnd() * 6, fr = 1 + rnd() * 3;
      x.strokeStyle = rnd() < .6 ? dark : light; x.globalAlpha = .08 + rnd() * .22; x.lineWidth = w;
      x.beginPath(); for (let y = 0; y <= 256; y += 8) { const xx = x0 + Math.sin(y / 256 * Math.PI * 2 * fr + i) * amp; if (y) x.lineTo(xx, y); else x.moveTo(xx, y); } x.stroke();
    }
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return (_tex[key] = t);
  }
  /* sombra de contacto (mancha radial suave debaixo de cada peça) */
  function contactTex() {
    if (_tex.contact) return _tex.contact;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(.45, 'rgba(0,0,0,.45)'); g.addColorStop(.75, 'rgba(0,0,0,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (_tex.contact = new THREE.CanvasTexture(c));
  }
  const RAD = { p: .29, r: .34, b: .31, q: .35, k: .36, n: .33 };

  function create(stage, onSquare) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .92;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.className = 'ch3d';
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:3;touch-action:manipulation;cursor:pointer';
    stage.appendChild(cv);
    const scene = new THREE.Scene(); scene.environment = Arcade3D.env(renderer);
    /* três luzes de estúdio: chave quente (sombras), enchimento frio e recorte por trás */
    scene.add(new THREE.HemisphereLight('#fff7ed', '#1e1b18', .45));
    const sun = new THREE.DirectionalLight('#ffe8c7', 2.6); sun.position.set(-5, 11, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0003; sun.shadow.normalBias = .015;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 2, far: 30 }); scene.add(sun);
    const fill = new THREE.DirectionalLight('#c7d7ff', .55); fill.position.set(7, 5, 4); scene.add(fill);
    const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
    /* tabuleiro */
    const sqGeo = new THREE.BoxGeometry(1, .16, 1);
    const sqGrain = grainTex('sq', '#ffffff', '#b8a58a', '#ffffff', 40);
    const lightM = new THREE.MeshStandardMaterial({ map: sqGrain, roughness: .5, metalness: 0, envMapIntensity: .6 }), darkM = new THREE.MeshStandardMaterial({ map: sqGrain, roughness: .5, metalness: 0, envMapIntensity: .6 });
    const squares = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const m = new THREE.Mesh(sqGeo, (r + c) % 2 ? darkM : lightM);
      m.position.set(c - 3.5, -.08, r - 3.5); m.receiveShadow = true;
      m.userData.sq = FILES[c] + (8 - r); scene.add(m); squares.push(m);
    }
    const frameM = new THREE.MeshPhysicalMaterial({ map: grainTex('frame', '#ffffff', '#6b4a2a', '#ffffff', 70), roughness: .45, metalness: 0, clearcoat: .45, clearcoatRoughness: .3, envMapIntensity: .5 });
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
    /* marfim/buxo quente e ébano, ambos envernizados (clearcoat = brilho do verniz
       por cima do veio). Sem contorno "de desenho animado": o contraste vem da luz. */
    const pieceM = {
      w: new THREE.MeshPhysicalMaterial({ color: '#e9d3ad', map: grainTex('w', '#ffffff', '#c9a979', '#ffffff', 55), roughness: .42, metalness: 0, clearcoat: .8, clearcoatRoughness: .18, sheen: .25, sheenColor: '#fff0d0', sheenRoughness: .5, envMapIntensity: .8 }),
      b: new THREE.MeshPhysicalMaterial({ color: '#2b211c', map: grainTex('b', '#ffffff', '#3a2a22', '#b08a6a', 70), roughness: .32, metalness: 0, clearcoat: 1, clearcoatRoughness: .08, sheen: .5, sheenColor: '#8a6a55', sheenRoughness: .4, envMapIntensity: 1.3 }),
    };
    /* detalhes (ranhuras, faixas, cruz, crina): nogueira escura nas brancas, latão nas pretas */
    const accM = { w: new THREE.MeshPhysicalMaterial({ color: '#5b3a1f', roughness: .45, clearcoat: .6, clearcoatRoughness: .2 }), b: new THREE.MeshStandardMaterial({ color: '#c9a14a', metalness: .85, roughness: .28 }) };
    const shM = new THREE.MeshBasicMaterial({ map: contactTex(), transparent: true, depthWrite: false, opacity: .8 });
    const shGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    /* luz de recorte vinda de trás: acende as silhuetas (substitui o contorno) */
    const rim = new THREE.DirectionalLight('#dbeafe', 2.1); rim.position.set(0, 5, -9); scene.add(rim);
    const pieces = [];            /* { mesh, sh, type, color, sq, anim, lift } */
    let flip = false, raf = 0, lastT = performance.now(), dead = false, selSq = null;

    const pos = sq => { const c = FILES.indexOf(sq[0]), r = 8 - (+sq[1]); return [c - 3.5, r - 3.5]; };
    function addPiece(type, color, sq, fadeIn) {
      const G = geoFor(type);
      const m = new THREE.Mesh(G.body, pieceM[color]); m.castShadow = true; m.receiveShadow = true;
      const ac = new THREE.Mesh(G.accent, accM[color]); ac.castShadow = true; m.add(ac);
      /* a sombra de contacto fica no tabuleiro (não sobe com a peça) */
      const sh = new THREE.Mesh(shGeo, shM); sh.renderOrder = 1; scene.add(sh);
      const [x, z] = pos(sq); m.position.set(x, 0, z);
      /* cavalo a ¾ de perfil: de frente era só uma placa */
      if (type === 'n') m.rotation.y = color === 'w' ? 1.15 : Math.PI + 1.15;
      m.scale.setScalar(fadeIn ? .01 : 1);
      scene.add(m);
      const p = { mesh: m, sh, type, color, sq, lift: 0, anim: fadeIn ? { k: 'in', t: 0 } : null };
      pieces.push(p); return p;
    }

    /* estado vindo do jogo */
    function sync(st) {
      flip = st.flip;
      const th = st.theme;
      lightM.color.set(th.light); darkM.color.set(th.dark); frameM.color.set(th.frame);
      /* cores do tema, mas com contraste garantido: brancas claras, pretas escuras mas não negras */
      /* em 3D as peças têm sempre marfim e ébano (a cor do tema confundia-se com as casas) */
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
      free.forEach(p => { p.anim = st.animate ? { k: 'out', t: 0, out: true } : null; if (!st.animate) { scene.remove(p.mesh, p.sh); pieces.splice(pieces.indexOf(p), 1); } });
      selSq = st.selected || null;
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
        const p = pieces[i], a = p.anim;
        /* a peça escolhida levanta-se um pouco (a sombra de contacto alarga e esbate) */
        const lt = !a && p.sq === selSq ? .16 : 0; p.lift += (lt - p.lift) * Math.min(1, dt * 14);
        if (!a) p.mesh.position.y = p.lift;
        const hk = Math.max(0, p.mesh.position.y);
        p.sh.position.set(p.mesh.position.x, .004, p.mesh.position.z);
        p.sh.scale.setScalar(RAD[p.type] * 3.1 * (1 + hk * .9) * Math.min(1, p.mesh.scale.x * 1.2));
        if (!a) continue;
        a.t += dt;
        if (a.k === 'move') {
          const k = Math.min(1, a.t / .32), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          p.mesh.position.set(a.x0 + (a.x1 - a.x0) * e, Math.sin(k * Math.PI) * a.hop, a.z0 + (a.z1 - a.z0) * e);
          if (k >= 1) { p.anim = null; p.mesh.position.y = p.lift = 0; }
        } else if (a.k === 'out') {
          const k = Math.min(1, a.t / .35); p.mesh.position.y = -k * .6; p.mesh.scale.setScalar(1 - k * .6);
          if (k >= 1) { scene.remove(p.mesh, p.sh); pieces.splice(i, 1); }
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
      const keepTex = Object.values(_tex);
      scene.traverse(o => { if (o.geometry && !Object.values(_geo).some(g => g.body === o.geometry || g.accent === o.geometry)) o.geometry.dispose(); if (o.material) { if (o.material.map && !keepTex.includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); } });
      renderer.dispose(); cv.remove();
    }
    return { sync, dispose, canvas: cv };
  }

  return { create };
})();
