/* ══════════════════════════════════════════════════════════════════
   ChessGame — full browser chess, no backend.
   Rules/move-generation: vendored chess.js (global `Chess`, BSD).
   AI: own negamax + alpha-beta with material + piece-square tables.
   Render: switchable 3D (lazily-loaded three.js, procedural high-detail
   pieces, animated moves, raycast tap-to-move) or 2D (better for local
   2-player). Selectable board+piece themes (wood by default). Optional
   live move hints. Captured-piece trays. Promotion picker, undo,
   3 AI levels + local 2-player. Integrates GameProgress.
══════════════════════════════════════════════════════════════════ */
const ChessGame = (function () {
  'use strict';

  const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
  const VAL   = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE  = 1000000;

  const PST = {
    p: [ 0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
         5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
         5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0 ],
    n: [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
         -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
         -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
    b: [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
         -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
         -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
    r: [ 0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
         -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
    q: [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
         -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
         -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
    k: [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
         -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
         20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ],
  };

  const LEVELS = {
    easy:   { depth: 1, blunder: 0.45, label: 'Fácil',   dot: '🟢' },
    medium: { depth: 2, blunder: 0.10, label: 'Médio',   dot: '🟡' },
    hard:   { depth: 3, blunder: 0.0,  label: 'Difícil', dot: '🔴' },
  };

  /* Board + piece themes. light/dark = squares, pcLight/pcDark = pieces,
     frame = 3D border. 2D uses the same colours via CSS variables. */
  const THEMES = {
    wood:   { name: 'Madeira', emoji: '🪵', light: '#f0d9b5', dark: '#b58863', frame: '#5b3d28', pcLight: '#f2e3c6', pcDark: '#5a3a22' },
    green:  { name: 'Torneio', emoji: '🌿', light: '#eeeed2', dark: '#769656', frame: '#34432c', pcLight: '#f7f4ea', pcDark: '#2c2c2c' },
    blue:   { name: 'Oceano',  emoji: '🌊', light: '#dde7ef', dark: '#7a9bb8', frame: '#2b3c4d', pcLight: '#f4f7fa', pcDark: '#27323d' },
    marble: { name: 'Mármore', emoji: '🏛️', light: '#e8e6e0', dark: '#9a958a', frame: '#46423a', pcLight: '#f6f4ef', pcDark: '#3a342e' },
    night:  { name: 'Noturno', emoji: '🌙', light: '#a6adba', dark: '#4c5366', frame: '#21242e', pcLight: '#e7eaf0', pcDark: '#1a1c26' },
    coral:  { name: 'Coral',   emoji: '🪸', light: '#f3ddd0', dark: '#c08267', frame: '#5a3a2c', pcLight: '#f6e9df', pcDark: '#4a2c20' },
  };

  let root, game, mode = 'ai', diffKey = 'medium', humanColor = 'w';
  let selected = null, legalDests = [], lastMove = null, busy = false;
  function loadPref(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function savePref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  let showHints  = loadPref('chess-hints', '0') === '1';
  let renderMode = loadPref('chess-render', '3d');                 /* '3d' | '2d' */
  let themeKey   = (THEMES[loadPref('chess-theme', 'wood')] ? loadPref('chess-theme', 'wood') : 'wood');
  let use3D = false, board3d = null;
  function theme() { return THEMES[themeKey] || THEMES.wood; }

  /* ── evaluation / search ────────────────────────────────────────── */
  function evaluate(g) {
    const board = g.board();
    let white = 0;
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const pc = board[row][col]; if (!pc) continue;
      const idx = row * 8 + col;
      const base = VAL[pc.type] + PST[pc.type][pc.color === 'w' ? idx : (7 - row) * 8 + col];
      white += pc.color === 'w' ? base : -base;
    }
    return g.turn() === 'w' ? white : -white;
  }
  function orderMoves(moves) {
    return moves.sort((a, b) => {
      const av = (a.captured ? VAL[a.captured] : 0) + (a.promotion ? 800 : 0);
      const bv = (b.captured ? VAL[b.captured] : 0) + (b.promotion ? 800 : 0);
      return bv - av;
    });
  }
  function negamax(g, depth, alpha, beta, ply) {
    if (g.in_checkmate()) return -MATE + ply;
    if (g.in_draw() || g.in_stalemate() || g.in_threefold_repetition() || g.insufficient_material()) return 0;
    if (depth === 0) return evaluate(g);
    let best = -Infinity;
    for (const m of orderMoves(g.moves({ verbose: true }))) {
      g.move(m);
      const score = -negamax(g, depth - 1, -beta, -alpha, ply + 1);
      g.undo();
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function chooseAIMove() {
    const lvl = LEVELS[diffKey] || LEVELS.medium;
    const moves = g_moves();
    if (!moves.length) return null;
    if (lvl.blunder && Math.random() < lvl.blunder) return moves[Math.floor(Math.random() * moves.length)];
    let best = -Infinity, bestMoves = [];
    for (const m of orderMoves(moves)) {
      game.move(m);
      const score = -negamax(game, lvl.depth - 1, -Infinity, Infinity, 1);
      game.undo();
      if (score > best) { best = score; bestMoves = [m]; }
      else if (score === best) bestMoves.push(m);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }
  function g_moves() { return game.moves({ verbose: true }); }

  /* ════════════════════════════════════════════════════════════════
     3D board (three.js) — lazily loaded; falls back to 2D on failure.
  ════════════════════════════════════════════════════════════════ */
  let threePromise = null;
  function ensureThree() {
    if (typeof THREE !== 'undefined') return Promise.resolve(THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/games/vendor/three.min.js';
      s.onload = () => (typeof THREE !== 'undefined' ? resolve(THREE) : reject(new Error('THREE missing')));
      s.onerror = () => reject(new Error('three.js load failed'));
      document.head.appendChild(s);
    });
    return threePromise;
  }

  /* High-detail lathe profiles: [radius, height] revolved around Y. */
  const PROFILES = {
    p: [[0,0],[.26,0],[.26,.045],[.225,.065],[.155,.10],[.122,.135],[.115,.175],[.168,.205],[.168,.235],[.10,.255],[.088,.31],[.135,.375],[.152,.44],[.142,.50],[.10,.55],[.052,.575],[0,.59]],
    r: [[0,0],[.29,0],[.29,.05],[.245,.075],[.165,.115],[.155,.155],[.152,.40],[.135,.42],[.205,.45],[.21,.50],[.228,.52],[.228,.58],[.20,.585],[0,.585]],
    b: [[0,0],[.285,0],[.285,.05],[.24,.075],[.155,.115],[.13,.16],[.125,.345],[.178,.375],[.182,.405],[.10,.425],[.095,.46],[.132,.525],[.158,.59],[.138,.65],[.108,.69],[.062,.725],[0,.748]],
    n: [[0,0],[.29,0],[.29,.05],[.245,.075],[.165,.115],[.155,.155],[.152,.30],[.135,.32],[.205,.345],[0,.345]],
    q: [[0,0],[.30,0],[.30,.05],[.255,.08],[.17,.125],[.138,.17],[.132,.45],[.182,.49],[.188,.525],[.115,.55],[.10,.585],[.156,.625],[.20,.66],[.208,.69],[.138,.70],[0,.70]],
    k: [[0,0],[.30,0],[.30,.05],[.255,.08],[.17,.125],[.138,.17],[.132,.47],[.182,.51],[.188,.545],[.115,.57],[.10,.605],[.156,.645],[.20,.68],[.208,.71],[.152,.722],[.132,.748],[0,.748]],
  };

  function createBoard3D(container, onPick, th) {
    const T = THREE;
    const W = container.clientWidth || 380, H = container.clientHeight || W;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(32, W / H, 0.1, 100);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:manipulation';

    /* lights */
    scene.add(new T.AmbientLight(0xffffff, 0.66));
    const key = new T.DirectionalLight(0xffffff, 0.9);
    key.position.set(3.5, 10, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 34;
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0007; key.shadow.radius = 3;
    scene.add(key);
    const fill = new T.DirectionalLight(0xbcd2ff, 0.22);
    fill.position.set(-5, 4, -5); scene.add(fill);

    /* materials (theme-driven, kept for live re-theming) */
    const frameMat = new T.MeshStandardMaterial({ roughness: 0.65, metalness: 0.15 });
    const lightMats = [], darkMats = [];
    const matWhite = new T.MeshStandardMaterial({ roughness: 0.45, metalness: 0.08 });
    const matBlack = new T.MeshStandardMaterial({ roughness: 0.5, metalness: 0.12 });

    /* frame */
    const frame = new T.Mesh(new T.BoxGeometry(9.5, 0.5, 9.5), frameMat);
    frame.position.y = -0.34; frame.receiveShadow = true; scene.add(frame);
    const inlay = new T.Mesh(new T.BoxGeometry(8.3, 0.12, 8.3), new T.MeshStandardMaterial({ color: 0x000000, roughness: 1 }));
    inlay.position.y = -0.06; scene.add(inlay);

    /* squares */
    const sqGeo = new T.BoxGeometry(1, 0.18, 1);
    const sqMesh = {};
    const files = ['a','b','c','d','e','f','g','h'];
    for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) {
      const dark = (f + r) % 2 === 0;
      const mat = new T.MeshStandardMaterial({ roughness: 0.8, metalness: 0.04 });
      (dark ? darkMats : lightMats).push(mat);
      const m = new T.Mesh(sqGeo, mat);
      const name = files[f] + r;
      m.position.set(f - 3.5, -0.09, r - 4.5);
      m.receiveShadow = true;
      m.userData = { square: name };
      scene.add(m); sqMesh[name] = m;
    }

    /* cached geometry */
    const geoCache = {};
    function lathe(type) {
      if (!geoCache[type]) {
        const pts = PROFILES[type].map(p => new T.Vector2(Math.max(p[0], 0.0001), p[1]));
        const g = new T.LatheGeometry(pts, 44);
        g.computeVertexNormals();
        geoCache[type] = g;
      }
      return geoCache[type];
    }
    function buildPiece(type, color) {
      const mat = color === 'w' ? matWhite : matBlack;
      const g = new T.Group();
      const body = new T.Mesh(lathe(type), mat); body.castShadow = true; body.receiveShadow = true; g.add(body);
      const add = (geo, x, y, z, rot) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.x = rot; m.castShadow = true; g.add(m); return m; };
      if (type === 'r') {
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new T.BoxGeometry(0.09, 0.12, 0.09), Math.cos(a) * 0.17, 0.60, Math.sin(a) * 0.17); }
      } else if (type === 'b') {
        add(new T.SphereGeometry(0.055, 16, 12), 0, 0.78, 0);
        const slit = new T.Mesh(new T.BoxGeometry(0.34, 0.05, 0.05), new T.MeshStandardMaterial({ color: 0x000000, roughness: 1 }));
        slit.position.set(0, 0.66, 0); slit.rotation.y = 0.0; g.add(slit);
      } else if (type === 'q') {
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; add(new T.SphereGeometry(0.045, 12, 10), Math.cos(a) * 0.175, 0.72, Math.sin(a) * 0.175); }
        add(new T.SphereGeometry(0.062, 14, 12), 0, 0.77, 0);
      } else if (type === 'k') {
        add(new T.BoxGeometry(0.05, 0.22, 0.05), 0, 0.86, 0);
        add(new T.BoxGeometry(0.16, 0.05, 0.05), 0, 0.85, 0);
      } else if (type === 'n') {
        const neck = add(new T.BoxGeometry(0.19, 0.32, 0.17), 0, 0.47, -0.03, -0.30); neck.geometry = roundBox(0.19, 0.32, 0.17);
        const head = add(new T.BoxGeometry(0.17, 0.16, 0.20), 0, 0.60, 0.06, -0.30); head.geometry = roundBox(0.17, 0.16, 0.20);
        const muzzle = add(new T.BoxGeometry(0.135, 0.12, 0.20), 0, 0.55, 0.16, -0.55); muzzle.geometry = roundBox(0.135, 0.12, 0.20);
        const mane = add(new T.BoxGeometry(0.07, 0.34, 0.10), 0, 0.50, -0.13, -0.10); mane.geometry = roundBox(0.07, 0.34, 0.10);
        for (const dx of [-0.055, 0.055]) add(new T.BoxGeometry(0.045, 0.12, 0.045), dx, 0.70, -0.05, -0.25);
        const eyeMat = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        for (const dx of [-0.07, 0.07]) { const e = new T.Mesh(new T.SphereGeometry(0.022, 8, 8), eyeMat); e.position.set(dx, 0.63, 0.13); g.add(e); }
      }
      return g;
    }
    /* small rounded box (chamfered) for the knight — nicer than hard cubes */
    function roundBox(w, h, d) {
      try { return new T.BoxGeometry(w, h, d, 2, 2, 2); } catch (e) { return new T.BoxGeometry(w, h, d); }
    }

    /* theme */
    function setTheme(t) {
      frameMat.color.set(t.frame);
      lightMats.forEach(m => m.color.set(t.light));
      darkMats.forEach(m => m.color.set(t.dark));
      matWhite.color.set(t.pcLight);
      matBlack.color.set(t.pcDark);
      requestRender();
    }
    setTheme(th);

    /* camera (gentle top-down 3D, fits the whole board) */
    let flip = false;
    function placeCamera() {
      const z = flip ? 8.6 : -8.6;
      camera.position.set(0, 8.7, z);
      camera.lookAt(0, -0.35, 0);
    }
    placeCamera();

    /* raycasting */
    const ray = new T.Raycaster();
    const ndc = new T.Vector2();
    let interactive = true;
    let downXY = null;
    function evXY(ev) { return ev.touches && ev.touches[0] ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : { x: ev.clientX, y: ev.clientY }; }
    function pick(ev) {
      if (!interactive) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const xy = evXY(ev);
      ndc.x = ((xy.x - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((xy.y - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !(o.userData && o.userData.square)) o = o.parent;
        if (o && o.userData.square) { onPick(o.userData.square); return; }
      }
    }
    renderer.domElement.addEventListener('pointerdown', e => { downXY = { x: e.clientX, y: e.clientY }; });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!downXY) return pick(e);
      const moved = Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y);
      downXY = null;
      if (moved < 10) pick(e);                       /* tap, not a drag/scroll */
    });

    /* pieces + fx */
    const pieceMap = {};
    const fxGroup = new T.Group(); scene.add(fxGroup);
    const discGeo = new T.CircleGeometry(0.17, 24);
    const ringGeo = new T.RingGeometry(0.36, 0.45, 28);
    const discMat = new T.MeshBasicMaterial({ color: 0x2fcf72, transparent: true, opacity: 0.55 });
    const ringMat = new T.MeshBasicMaterial({ color: 0x2fcf72, transparent: true, opacity: 0.7, side: T.DoubleSide });
    function worldOf(sq) { return { x: sq.charCodeAt(0) - 97 - 3.5, z: (+sq[1]) - 4.5 }; }
    function clearPieces() { Object.values(pieceMap).forEach(g => scene.remove(g)); for (const k in pieceMap) delete pieceMap[k]; }
    function rebuild(boardArr) {
      clearPieces();
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const pc = boardArr[row][col]; if (!pc) continue;
        const sq = files[col] + (8 - row);
        const g = buildPiece(pc.type, pc.color);
        const w = worldOf(sq);
        g.position.set(w.x, 0, w.z);
        if (pc.color === 'b') g.rotation.y = Math.PI;
        g.userData = { square: sq, baseY: 0 };
        scene.add(g); pieceMap[sq] = g;
      }
      requestRender();
    }

    function highlight(hi) {
      for (const name in sqMesh) {
        const m = sqMesh[name].material;
        let emis = 0x000000, inten = 0;
        if (hi.checkSq === name) { emis = 0xff2e2e; inten = 0.9; }
        else if (hi.selected === name) { emis = 0x5ad17a; inten = 0.55; }
        else if (hi.lastMove && (hi.lastMove.from === name || hi.lastMove.to === name)) { emis = 0xf2c14e; inten = 0.30; }
        m.emissive.setHex(emis); m.emissiveIntensity = inten;
      }
      Object.values(pieceMap).forEach(g => { g.position.y = g.userData.baseY; });
      const selG = hi.selected && pieceMap[hi.selected];
      if (selG) selG.position.y = 0.16;
      while (fxGroup.children.length) fxGroup.remove(fxGroup.children[0]);
      if (hi.showHints) (hi.legalDests || []).forEach(sq => {
        const w = worldOf(sq); const occ = !!pieceMap[sq];
        const mk = new T.Mesh(occ ? ringGeo : discGeo, occ ? ringMat : discMat);
        mk.rotation.x = -Math.PI / 2; mk.position.set(w.x, 0.105, w.z);
        fxGroup.add(mk);
      });
      requestRender();
    }

    /* tween / render loop */
    const tweens = [];
    let rafId = null, dirty = true;
    function requestRender() { dirty = true; if (!rafId) loop(); }
    function loop() {
      rafId = requestAnimationFrame(loop);
      const now = performance.now();
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        const t = Math.min(1, (now - tw.start) / tw.dur);
        tw.step(t < 1 ? (tw.ease ? tw.ease(t) : t) : 1);
        if (t >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
        dirty = true;
      }
      if (dirty) { renderer.render(scene, camera); dirty = false; }
      if (!tweens.length && !dirty) { cancelAnimationFrame(rafId); rafId = null; }
    }
    const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    function applyMove(from, to, opts, cb) {
      const g = pieceMap[from];
      const capG = opts && opts.capture ? pieceMap[to] : null;
      if (!g) { cb && cb(); return; }
      const a = worldOf(from), b = worldOf(to);
      const arc = opts && opts.knight ? 0.85 : 0.34;
      tweens.push({
        start: performance.now(), dur: 360, ease: easeInOut,
        step: t => {
          g.position.x = a.x + (b.x - a.x) * t;
          g.position.z = a.z + (b.z - a.z) * t;
          g.position.y = Math.sin(Math.PI * t) * arc;
        },
        done: cb,
      });
      if (capG) tweens.push({
        start: performance.now() + 80, dur: 300,
        step: t => { const e = 1 - t; capG.scale.setScalar(Math.max(0.001, e)); capG.position.y = -t * 0.5; capG.rotation.z = t * 1.4; },
      });
      requestRender();
    }

    function resize() {
      const w = container.clientWidth || W, h = container.clientHeight || w;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      requestRender();
    }
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(container);
    window.addEventListener('resize', resize);

    function dispose() {
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', resize);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }

    return {
      rebuild, highlight, applyMove, resize, dispose, setTheme,
      setFlip: f => { flip = f; placeCamera(); requestRender(); },
      setInteractive: v => { interactive = v; },
    };
  }

  /* ── CSS ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('ch-css')) return;
    const s = document.createElement('style'); s.id = 'ch-css';
    s.textContent = `
.ch-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0;--sql:#f0d9b5;--sqd:#b58863;--pcl:#f2e3c6;--pcd:#5a3a22}
.ch-menu{display:flex;flex-direction:column;align-items:center;gap:13px;padding:22px 16px;text-align:center}
.ch-logo{font-size:3rem;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}
.ch-title{font-family:var(--font-head,inherit);font-size:1.7rem;font-weight:900;color:var(--text,#fff)}
.ch-sub{font-size:.8rem;color:var(--muted,#9aa);letter-spacing:.08em;text-transform:uppercase}
.ch-opts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:360px}
.ch-opt{background:var(--card2,#1b1d33);border:1.5px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:10px;padding:9px 15px;font:inherit;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-opt:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5)}
.ch-opt.active{background:var(--accent-soft,rgba(124,92,255,.16));border-color:rgba(var(--accent-rgb,124,92,255),.7);color:var(--accent,#a98bff)}
.ch-themes{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;max-width:360px}
.ch-theme{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;border:2px solid transparent;border-radius:12px;padding:5px 6px;transition:all .15s}
.ch-theme.active{border-color:var(--accent,#7c5cff);background:var(--accent-soft,rgba(124,92,255,.12))}
.ch-sw{width:46px;height:30px;border-radius:7px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.ch-theme-lbl{font-size:.66rem;color:var(--text2,#ccd);font-weight:700}
.ch-toggle{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--text2,#ccd);background:var(--card2,#1b1d33);border:1.5px solid var(--border,#2a2c44);border-radius:10px;padding:8px 14px;cursor:pointer;user-select:none}
.ch-toggle .ch-tg{width:34px;height:19px;border-radius:999px;background:#3a3d55;position:relative;transition:background .15s;flex:none}
.ch-toggle .ch-tg::after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:transform .15s}
.ch-toggle.on .ch-tg{background:var(--accent,#7c5cff)}
.ch-toggle.on .ch-tg::after{transform:translateX(15px)}
.ch-play{background:linear-gradient(135deg,var(--accent,#7c5cff),#a855f7);color:#fff;border:none;border-radius:12px;padding:13px 44px;font:inherit;font-size:1.05rem;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(124,92,255,.35);transition:transform .15s}
.ch-play:hover{transform:scale(1.04)}

.ch-status{display:flex;align-items:center;gap:8px;font-size:.9rem;font-weight:700;color:var(--text,#fff);min-height:24px;text-align:center}
.ch-turn-dot{width:13px;height:13px;border-radius:50%;border:1.5px solid #888}
.ch-turn-w{background:#f1f1f1}.ch-turn-b{background:#222}
.ch-tray{display:flex;align-items:center;gap:1px;flex-wrap:wrap;justify-content:center;min-height:26px;width:min(94vw,460px);font-size:1.35rem;line-height:1}
.ch-cap{filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.ch-cap.ch-w{color:var(--pcl)}.ch-cap.ch-b{color:var(--pcd)}
.ch-adv{font-size:.78rem;font-weight:800;color:var(--muted,#9aa);margin-left:6px}
.ch-stage{width:min(94vw,460px);aspect-ratio:1;position:relative;border-radius:12px}
.ch-stage canvas{filter:drop-shadow(0 16px 40px rgba(0,0,0,.5))}
.ch-board{width:min(94vw,460px);aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border-radius:8px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45);touch-action:manipulation;border:3px solid var(--sqd,#7b91b0)}
.ch-sq{position:relative;display:flex;align-items:center;justify-content:center;border:none;padding:0;cursor:pointer;font-size:clamp(22px,7.5vw,40px);line-height:1;user-select:none;-webkit-tap-highlight-color:transparent}
.ch-light{background:var(--sql,#e8edf4)}.ch-dark{background:var(--sqd,#7b91b0)}
.ch-pc{position:relative;z-index:2;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));transition:transform .12s}
.ch-w{color:var(--pcl,#fff);text-shadow:0 0 1px rgba(0,0,0,.6),0 1px 2px rgba(0,0,0,.4)}
.ch-b{color:var(--pcd,#1a1a1a)}
.ch-sq.sel{box-shadow:inset 0 0 0 4px rgba(90,209,122,.95)}
.ch-sq.last::before{content:'';position:absolute;inset:0;background:rgba(242,193,78,.32);z-index:1}
.ch-sq.check::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(239,68,68,.7),transparent 70%);z-index:1}
.ch-dest::after{content:'';position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(47,207,114,.55);z-index:1}
.ch-dest.cap::after{width:84%;height:84%;background:transparent;border:4px solid rgba(47,207,114,.6);box-sizing:border-box}
.ch-coord{position:absolute;font-size:9px;font-weight:700;opacity:.55;z-index:1}
.ch-coord.f{right:2px;bottom:1px}.ch-coord.r{left:2px;top:1px}
.ch-light .ch-coord{color:rgba(0,0,0,.5)}.ch-dark .ch-coord{color:rgba(255,255,255,.7)}

.ch-ctrls{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;max-width:480px}
.ch-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:9px;padding:8px 13px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5);color:var(--accent,#a98bff)}
.ch-btn.on{background:var(--accent-soft,rgba(124,92,255,.16));border-color:rgba(var(--accent-rgb,124,92,255),.7);color:var(--accent,#a98bff)}
.ch-btn:disabled{opacity:.4;cursor:default}

.ch-promo-back{position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
.ch-promo{background:var(--card,#14162a);border:1px solid var(--border,#2a2c44);border-radius:16px;padding:18px;display:flex;gap:10px}
.ch-promo button{font-size:2.6rem;background:var(--sql,#e8edf4);border:2px solid transparent;border-radius:10px;width:64px;height:64px;cursor:pointer;color:var(--pcd,#1a1a1a);transition:all .12s}
.ch-promo button:hover{border-color:var(--accent,#7c5cff);transform:scale(1.06)}
@media (prefers-reduced-motion:reduce){.ch-play,.ch-promo button{transition:none}}`;
    document.head.appendChild(s);
  }

  /* ── init / menu ────────────────────────────────────────────────── */
  function init(r) {
    root = r; if (!root) return;
    if (typeof Chess === 'undefined') { root.innerHTML = '<p style="padding:1rem;color:#f87171">Motor de xadrez indisponível.</p>'; return; }
    injectCSS();
    showMenu();
  }

  function themeSwatch(t) {
    return `<span class="ch-sw"><i style="background:${t.light}"></i><i style="background:${t.dark}"></i><i style="background:${t.dark}"></i><i style="background:${t.light}"></i></span>`;
  }

  function showMenu() {
    disposeBoard();
    const opp = [
      { k: 'ai-easy',   t: '🟢 IA Fácil' }, { k: 'ai-medium', t: '🟡 IA Médio' },
      { k: 'ai-hard',   t: '🔴 IA Difícil' }, { k: '2p',       t: '👥 2 Jogadores' },
    ];
    const cur = mode === '2p' ? '2p' : 'ai-' + diffKey;
    root.innerHTML = `
      <div class="ch-menu">
        <div class="ch-logo">♟️</div>
        <div class="ch-title">Xadrez</div>
        <div class="ch-sub">Adversário</div>
        <div class="ch-opts" id="ch-opp">
          ${opp.map(o => `<button class="ch-opt${o.k === cur ? ' active' : ''}" data-k="${o.k}">${o.t}</button>`).join('')}
        </div>
        <div class="ch-sub">Jogas com</div>
        <div class="ch-opts" id="ch-color">
          <button class="ch-opt${humanColor === 'w' ? ' active' : ''}" data-c="w">⚪ Brancas</button>
          <button class="ch-opt${humanColor === 'b' ? ' active' : ''}" data-c="b">⚫ Pretas</button>
          <button class="ch-opt" data-c="rand">🎲 Aleatório</button>
        </div>
        <div class="ch-sub">Tabuleiro</div>
        <div class="ch-opts" id="ch-render">
          <button class="ch-opt${renderMode === '3d' ? ' active' : ''}" data-m="3d">🧊 3D</button>
          <button class="ch-opt${renderMode === '2d' ? ' active' : ''}" data-m="2d">⬛ 2D <span style="opacity:.7;font-weight:600">(ideal p/ 2 jog.)</span></button>
        </div>
        <div class="ch-sub">Tema</div>
        <div class="ch-themes" id="ch-theme">
          ${Object.keys(THEMES).map(k => `
            <div class="ch-theme${themeKey === k ? ' active' : ''}" data-t="${k}" role="button" aria-label="${THEMES[k].name}">
              ${themeSwatch(THEMES[k])}<span class="ch-theme-lbl">${THEMES[k].emoji} ${THEMES[k].name}</span>
            </div>`).join('')}
        </div>
        <div class="ch-toggle${showHints ? ' on' : ''}" id="ch-hint-toggle" role="switch" aria-checked="${showHints}">
          <span class="ch-tg"></span><span>💡 Mostrar movimentos possíveis</span>
        </div>
        <button class="ch-play" id="ch-play">▶ Jogar</button>
      </div>`;

    root.querySelectorAll('#ch-opp .ch-opt').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === '2p') {
        mode = '2p';
        /* 3D shares one screen and only faces one side — 2D is better for hot-seat. */
        renderMode = '2d'; savePref('chess-render', renderMode);
        root.querySelectorAll('#ch-render .ch-opt').forEach(x => x.classList.toggle('active', x.dataset.m === '2d'));
      } else { mode = 'ai'; diffKey = k.split('-')[1]; }
      root.querySelectorAll('#ch-opp .ch-opt').forEach(x => x.classList.toggle('active', x === b));
    }));
    root.querySelectorAll('#ch-color .ch-opt').forEach(b => b.addEventListener('click', () => {
      humanColor = b.dataset.c === 'rand' ? (Math.random() < 0.5 ? 'w' : 'b') : b.dataset.c;
      root.querySelectorAll('#ch-color .ch-opt').forEach(x => x.classList.toggle('active', x.dataset.c === humanColor));
    }));
    root.querySelectorAll('#ch-render .ch-opt').forEach(b => b.addEventListener('click', () => {
      renderMode = b.dataset.m; savePref('chess-render', renderMode);
      root.querySelectorAll('#ch-render .ch-opt').forEach(x => x.classList.toggle('active', x === b));
    }));
    root.querySelectorAll('#ch-theme .ch-theme').forEach(b => b.addEventListener('click', () => {
      themeKey = b.dataset.t; savePref('chess-theme', themeKey);
      root.querySelectorAll('#ch-theme .ch-theme').forEach(x => x.classList.toggle('active', x === b));
    }));
    root.querySelector('#ch-hint-toggle').addEventListener('click', () => setHints(!showHints));
    root.querySelector('#ch-play').addEventListener('click', startGame);
  }

  function setHints(on) {
    showHints = on; savePref('chess-hints', on ? '1' : '0');
    document.querySelectorAll('#ch-hint-toggle').forEach(el => { el.classList.toggle('on', on); el.setAttribute('aria-checked', on); });
    const btn = root.querySelector('#ch-hint-btn'); if (btn) btn.classList.toggle('on', on);
    refreshHighlight();
  }

  function disposeBoard() { if (board3d) { try { board3d.dispose(); } catch (e) {} board3d = null; } }

  function startGame() {
    disposeBoard();
    game = new Chess();
    selected = null; legalDests = []; lastMove = null; busy = false;
    renderGame();
  }

  /* ── render shell ───────────────────────────────────────────────── */
  function applyThemeVars() {
    const wrap = root.querySelector('.ch-wrap'); if (!wrap) return;
    const t = theme();
    wrap.style.setProperty('--sql', t.light); wrap.style.setProperty('--sqd', t.dark);
    wrap.style.setProperty('--pcl', t.pcLight); wrap.style.setProperty('--pcd', t.pcDark);
  }

  function renderGame() {
    const is3D = renderMode === '3d';
    root.innerHTML = `
      <div class="ch-wrap">
        <div class="ch-status" id="ch-status"></div>
        <div class="ch-tray" id="ch-tray-top"></div>
        <div class="ch-stage" id="ch-stage"></div>
        <div class="ch-tray" id="ch-tray-bot"></div>
        <div class="ch-ctrls">
          <button class="ch-btn${showHints ? ' on' : ''}" id="ch-hint-btn">💡 Dicas</button>
          <button class="ch-btn" id="ch-render-btn">${is3D ? '⬛ 2D' : '🧊 3D'}</button>
          <button class="ch-btn" id="ch-theme-btn">🎨 Tema</button>
          <button class="ch-btn" id="ch-undo">↩ Desfazer</button>
          <button class="ch-btn" id="ch-new">🔄 Novo</button>
          <button class="ch-btn" id="ch-menu">☰ Menu</button>
        </div>
      </div>`;
    applyThemeVars();
    root.querySelector('#ch-hint-btn').addEventListener('click', () => setHints(!showHints));
    root.querySelector('#ch-render-btn').addEventListener('click', toggleRender);
    root.querySelector('#ch-theme-btn').addEventListener('click', cycleTheme);
    root.querySelector('#ch-new').addEventListener('click', startGame);
    root.querySelector('#ch-menu').addEventListener('click', showMenu);
    root.querySelector('#ch-undo').addEventListener('click', undo);
    mountBoard();
    updateStatus();
    renderTrays();
  }

  function toggleRender() {
    if (busy) return;
    renderMode = renderMode === '3d' ? '2d' : '3d';
    savePref('chess-render', renderMode);
    disposeBoard();
    renderGame();                                    /* re-mount, game state preserved */
  }

  function cycleTheme() {
    const keys = Object.keys(THEMES);
    themeKey = keys[(keys.indexOf(themeKey) + 1) % keys.length];
    savePref('chess-theme', themeKey);
    applyThemeVars();
    if (use3D && board3d) board3d.setTheme(theme());
    else draw2D();
    renderTrays();
    const st = root.querySelector('#ch-status');     /* brief theme name flash (single) */
    if (st) { st.querySelector('.ch-flash')?.remove(); const tag = document.createElement('span'); tag.className = 'ch-flash'; tag.textContent = ' · ' + theme().emoji + ' ' + theme().name; tag.style.cssText = 'opacity:.7;font-weight:600'; st.appendChild(tag); setTimeout(() => tag.remove(), 1200); }
  }

  function mountBoard() {
    const stage = root.querySelector('#ch-stage');
    if (!stage) return;
    if (renderMode !== '3d') { use3D = false; draw2D(); afterInitialMove(); return; }
    ensureThree().then(() => {
      if (!root.querySelector('#ch-stage')) return;
      use3D = true;
      board3d = createBoard3D(stage, onSquare, theme());
      board3d.setFlip(mode === 'ai' && humanColor === 'b');
      board3d.rebuild(game.board());
      refreshHighlight();
      afterInitialMove();
    }).catch(() => { use3D = false; draw2D(); afterInitialMove(); });
  }

  function afterInitialMove() {
    /* Only auto-open when the AI plays White from the very start. */
    if (mode === 'ai' && game.history().length === 0 && game.turn() !== humanColor) aiTurn();
  }

  function hiState() {
    let checkSq = null;
    if (game.in_check()) {
      const turn = game.turn(), board = game.board(), files = ['a','b','c','d','e','f','g','h'];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const pc = board[r][c]; if (pc && pc.type === 'k' && pc.color === turn) checkSq = files[c] + (8 - r);
      }
    }
    return { selected, legalDests, lastMove, checkSq, showHints };
  }
  function refreshHighlight() {
    if (use3D && board3d) board3d.highlight(hiState());
    else draw2D();
  }

  /* captured pieces (derived from history → robust to undo) */
  function capturedState() {
    const cap = { w: [], b: [] };
    if (game) game.history({ verbose: true }).forEach(m => { if (m.captured) cap[m.color].push(m.captured); });
    return cap;
  }
  function renderTrays() {
    const top = root.querySelector('#ch-tray-top'), bot = root.querySelector('#ch-tray-bot');
    if (!top || !bot) return;
    const cap = capturedState();
    const sortV = a => a.slice().sort((x, y) => VAL[y] - VAL[x]);
    const sumV = a => a.reduce((s, t) => s + VAL[t], 0);
    const bottomColor = (mode === 'ai') ? humanColor : 'w';
    const topColor = bottomColor === 'w' ? 'b' : 'w';
    const whiteLead = sumV(cap.w) - sumV(cap.b);
    const lead = { w: whiteLead, b: -whiteLead };
    const trayHTML = (capturerColor) => {
      const victims = sortV(cap[capturerColor]);                /* pieces the capturer took */
      const victimColor = capturerColor === 'w' ? 'b' : 'w';
      const pts = lead[capturerColor];
      return victims.map(t => `<span class="ch-cap ch-${victimColor}">${GLYPH[t]}</span>`).join('')
        + (pts > 0 ? `<span class="ch-adv">+${Math.round(pts / 100)}</span>` : '');
    };
    top.innerHTML = trayHTML(topColor);
    bot.innerHTML = trayHTML(bottomColor);
  }

  /* ── 2D renderer ────────────────────────────────────────────────── */
  function draw2D() {
    const stage = root.querySelector('#ch-stage'); if (!stage) return;
    let bd = stage.querySelector('#ch-board');
    if (!bd) { stage.innerHTML = '<div class="ch-board" id="ch-board" role="grid" aria-label="Tabuleiro de xadrez"></div>'; bd = stage.querySelector('#ch-board'); }
    const flip = (mode === 'ai' && humanColor === 'b');
    const files = ['a','b','c','d','e','f','g','h'];
    const board = game.board();
    const hi = hiState();
    const rowOrder = flip ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
    const colOrder = flip ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
    let html = '';
    rowOrder.forEach(r => {
      colOrder.forEach(c => {
        const sq = files[c] + (8 - r);
        const pc = board[r][c];
        const dark = (r + c) % 2 === 1;
        const cls = ['ch-sq', dark ? 'ch-dark' : 'ch-light'];
        if (selected === sq) cls.push('sel');
        if (lastMove && (lastMove.from === sq || lastMove.to === sq)) cls.push('last');
        if (hi.checkSq === sq) cls.push('check');
        if (showHints && legalDests.includes(sq)) { cls.push('ch-dest'); if (pc) cls.push('cap'); }
        const label = sq + (pc ? ', ' + (pc.color === 'w' ? 'branca' : 'preta') + ' ' + pieceName(pc.type) : ' vazio');
        const showFile = (flip ? r === 0 : r === 7);
        const showRank = (flip ? c === 7 : c === 0);
        html += `<button class="${cls.join(' ')}" data-sq="${sq}" role="gridcell" aria-label="${label}">
          ${pc ? `<span class="ch-pc ch-${pc.color}">${GLYPH[pc.type]}</span>` : ''}
          ${showFile ? `<span class="ch-coord f">${files[c]}</span>` : ''}
          ${showRank ? `<span class="ch-coord r">${8 - r}</span>` : ''}
        </button>`;
      });
    });
    bd.innerHTML = html;
    bd.querySelectorAll('.ch-sq').forEach(el => el.addEventListener('click', () => onSquare(el.dataset.sq)));
  }

  function pieceName(t) { return ({ p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' })[t] || t; }

  function updateStatus() {
    const el = root.querySelector('#ch-status'); if (!el) return;
    const undoBtn = root.querySelector('#ch-undo');
    if (undoBtn) undoBtn.disabled = busy || game.history().length === 0;
    if (game.game_over()) {
      let msg;
      if (game.in_checkmate()) { const winner = game.turn() === 'w' ? 'Pretas' : 'Brancas'; msg = `♚ Xeque-mate — ${winner} ganham!`; }
      else if (game.in_stalemate()) msg = '🤝 Empate (afogamento)';
      else if (game.in_threefold_repetition()) msg = '🤝 Empate (repetição)';
      else if (game.insufficient_material()) msg = '🤝 Empate (material insuficiente)';
      else msg = '🤝 Empate';
      el.innerHTML = `<span>${msg}</span>`;
      return;
    }
    const turn = game.turn();
    let who;
    if (mode === '2p') who = turn === 'w' ? 'Vez das Brancas' : 'Vez das Pretas';
    else who = busy ? 'IA a pensar…' : (turn === humanColor ? 'A tua vez' : 'IA a pensar…');
    const check = game.in_check() ? ' · Xeque!' : '';
    el.innerHTML = `<span class="ch-turn-dot ch-turn-${turn}"></span><span>${who}${check}</span>`;
  }

  /* ── interaction ────────────────────────────────────────────────── */
  function onSquare(sq) {
    if (busy || game.game_over()) return;
    const turn = game.turn();
    if (mode === 'ai' && turn !== humanColor) return;
    const pc = game.get(sq);
    if (selected) {
      if (legalDests.includes(sq)) { tryMove(selected, sq); return; }
      if (pc && pc.color === turn) { selectSquare(sq); return; }
      selected = null; legalDests = []; refreshHighlight(); return;
    }
    if (pc && pc.color === turn) selectSquare(sq);
  }
  function selectSquare(sq) {
    selected = sq;
    legalDests = game.moves({ square: sq, verbose: true }).map(m => m.to);
    refreshHighlight();
  }
  function tryMove(from, to) {
    const isPromo = game.moves({ square: from, verbose: true }).some(m => m.to === to && m.flags.includes('p'));
    if (isPromo) { promptPromotion(from, to); return; }
    applyMove({ from, to });
  }
  function applyMove(mv) {
    const res = game.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
    if (!res) { selected = null; legalDests = []; refreshHighlight(); return; }
    lastMove = { from: res.from, to: res.to };
    selected = null; legalDests = [];
    commitMove(res);
  }

  function commitMove(res) {
    const cont = () => {
      updateStatus(); renderTrays();
      if (game.game_over()) { finish(); return; }
      if (mode === 'ai' && game.turn() !== humanColor) aiTurn();
    };
    if (use3D && board3d) {
      const capture = !!res.captured || (res.flags && res.flags.includes('e'));
      board3d.applyMove(res.from, res.to, { capture, knight: res.piece === 'n' }, () => {
        board3d.rebuild(game.board());
        refreshHighlight();
        cont();
      });
    } else { draw2D(); cont(); }
  }

  function promptPromotion(from, to) {
    const color = game.turn();
    const back = document.createElement('div');
    back.className = 'ch-promo-back';
    back.style.setProperty('--sql', theme().light); back.style.setProperty('--pcd', theme().pcDark); back.style.setProperty('--pcl', theme().pcLight);
    back.innerHTML = `<div class="ch-promo" role="dialog" aria-label="Escolhe a promoção">
      ${['q','r','b','n'].map(t => `<button data-t="${t}" aria-label="${pieceName(t)}"><span class="ch-${color}">${GLYPH[t]}</span></button>`).join('')}
    </div>`;
    document.body.appendChild(back);
    back.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { back.remove(); applyMove({ from, to, promotion: b.dataset.t }); }));
    back.addEventListener('click', e => { if (e.target === back) { back.remove(); selected = null; legalDests = []; refreshHighlight(); } });
  }

  function aiTurn() {
    busy = true; updateStatus();
    if (board3d) board3d.setInteractive(false);
    setTimeout(() => {
      const mv = chooseAIMove();
      busy = false;
      if (board3d) board3d.setInteractive(true);
      if (!mv) { updateStatus(); return; }
      const res = game.move(mv);
      lastMove = { from: res.from, to: res.to };
      selected = null; legalDests = [];
      commitMove(res);
    }, 240);
  }

  function undo() {
    if (busy || !game.history().length) return;
    game.undo();
    if (mode === 'ai' && game.history().length && game.turn() !== humanColor) game.undo();
    selected = null; legalDests = [];
    const h = game.history({ verbose: true });
    lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
    if (use3D && board3d) { board3d.rebuild(game.board()); refreshHighlight(); }
    else draw2D();
    updateStatus(); renderTrays();
  }

  function finish() {
    if (typeof GameProgress === 'undefined') return;
    let won = null;
    if (mode === 'ai' && game.in_checkmate()) won = (game.turn() !== humanColor);
    else if (mode === 'ai') won = false;
    try {
      GameProgress.record('chess', {
        won: mode === 'ai' ? won : undefined,
        mode: mode === 'ai' ? diffKey : '2p',
        meta: { checkmate: game.in_checkmate(), draw: game.in_draw() },
      });
    } catch (e) {}
  }

  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('chess', [
      { id: 'ch.win',  name: 'Xeque-mate!',   icon: '♟️', desc: 'Ganha uma partida contra a IA.', test: c => c.gameId === 'chess' && c.result.won === true },
      { id: 'ch.hard', name: 'Grande Mestre', icon: '👑', desc: 'Ganha a IA no nível Difícil.',    test: c => c.gameId === 'chess' && c.result.won === true && c.result.mode === 'hard' },
    ]);
  }

  return { init };
})();
