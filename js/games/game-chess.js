/* ══════════════════════════════════════════════════════════════════
   ChessGame — full browser chess, no backend.
   Rules/move-generation: vendored chess.js (global `Chess`, BSD).
   AI: own negamax + alpha-beta with material + piece-square tables.
   Board: real 3D rendering via lazily-loaded three.js (procedural,
   lathe-turned pieces, animated moves, tap-to-move with raycasting).
   Gracefully falls back to a flat 2D board if WebGL/three is unavailable.
   Optional move hints (off by default). Promotion picker, undo,
   3 AI levels + local 2-player. Integrates GameProgress.
══════════════════════════════════════════════════════════════════ */
const ChessGame = (function () {
  'use strict';

  const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
  const VAL   = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE  = 1000000;

  /* Piece-square tables, written a8 (top-left) … h1, i.e. board() order for
     White; mirrored vertically for Black. Classic mid-game values. */
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

  let root, game, mode = 'ai', diffKey = 'medium', humanColor = 'w';
  let selected = null, legalDests = [], lastMove = null, busy = false;
  let showHints = (() => { try { return localStorage.getItem('chess-hints') === '1'; } catch (e) { return false; } })();
  let use3D = true, board3d = null;

  /* ── evaluation ─────────────────────────────────────────────────── */
  function evaluate(g) {
    const board = g.board();
    let white = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const pc = board[row][col];
        if (!pc) continue;
        const idx = row * 8 + col;
        const base = VAL[pc.type] + PST[pc.type][pc.color === 'w' ? idx : (7 - row) * 8 + col];
        white += pc.color === 'w' ? base : -base;
      }
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
    const moves = orderMoves(g.moves({ verbose: true }));
    for (const m of moves) {
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

  /* Lathe profiles: [radius, height] pairs revolved around Y. */
  const PROFILES = {
    p: [[0,0],[.30,0],[.30,.05],[.21,.07],[.16,.10],[.125,.18],[.115,.26],[.175,.29],[.10,.33],[.135,.41],[.15,.49],[.125,.56],[.08,.61],[0,.64]],
    r: [[0,0],[.32,0],[.32,.05],[.23,.08],[.185,.12],[.175,.42],[.235,.46],[.235,.52],[.255,.54],[.255,.62],[0,.62]],
    b: [[0,0],[.31,0],[.31,.05],[.22,.08],[.16,.12],[.135,.34],[.185,.38],[.115,.42],[.12,.47],[.165,.55],[.145,.63],[.085,.70],[0,.73]],
    n: [[0,0],[.32,0],[.32,.05],[.23,.08],[.19,.13],[.18,.30],[.22,.34],[0,.34]],
    q: [[0,0],[.33,0],[.33,.05],[.24,.08],[.17,.13],[.14,.45],[.135,.50],[.205,.55],[.225,.61],[.13,.63],[.205,.67],[.215,.71],[0,.71]],
    k: [[0,0],[.33,0],[.33,.05],[.24,.08],[.17,.13],[.14,.47],[.135,.53],[.205,.58],[.225,.63],[.135,.65],[.205,.69],[.215,.74],[.12,.75],[0,.75]],
  };

  function createBoard3D(container, onPick) {
    const T = THREE;
    const W = container.clientWidth || 380, H = container.clientHeight || W;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(42, W / H, 0.1, 100);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;border-radius:10px;touch-action:manipulation';

    /* lights */
    scene.add(new T.AmbientLight(0xffffff, 0.62));
    const key = new T.DirectionalLight(0xffffff, 0.95);
    key.position.set(4.5, 9, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0008;
    scene.add(key);
    const fill = new T.DirectionalLight(0x9fbcff, 0.28);
    fill.position.set(-5, 4, -4); scene.add(fill);

    /* frame */
    const frameMat = new T.MeshStandardMaterial({ color: 0x2c2f3e, roughness: 0.6, metalness: 0.25 });
    const frame = new T.Mesh(new T.BoxGeometry(9.4, 0.5, 9.4), frameMat);
    frame.position.y = -0.34; frame.receiveShadow = true; scene.add(frame);

    /* squares */
    const lightMat = () => new T.MeshStandardMaterial({ color: 0xe9edf4, roughness: 0.75, metalness: 0.05 });
    const darkMat  = () => new T.MeshStandardMaterial({ color: 0x5d769a, roughness: 0.7, metalness: 0.08 });
    const sqGeo = new T.BoxGeometry(1, 0.18, 1);
    const sqMesh = {};                     /* square name -> mesh */
    const files = ['a','b','c','d','e','f','g','h'];
    for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) {
      const dark = (f + r) % 2 === 0;
      const m = new T.Mesh(sqGeo, dark ? darkMat() : lightMat());
      const name = files[f] + r;
      m.position.set(f - 3.5, -0.09, r - 4.5);
      m.receiveShadow = true;
      m.userData = { square: name, base: m.material.color.getHex() };
      scene.add(m); sqMesh[name] = m;
    }

    /* piece materials + cached geometry */
    const matWhite = new T.MeshStandardMaterial({ color: 0xf2ede1, roughness: 0.38, metalness: 0.16 });
    const matBlack = new T.MeshStandardMaterial({ color: 0x26293a, roughness: 0.42, metalness: 0.22 });
    const geoCache = {};
    function lathe(type) {
      if (!geoCache[type]) {
        const pts = PROFILES[type].map(p => new T.Vector2(p[0], p[1]));
        geoCache[type] = new T.LatheGeometry(pts, 28);
      }
      return geoCache[type];
    }
    function buildPiece(type, color) {
      const mat = color === 'w' ? matWhite : matBlack;
      const g = new T.Group();
      const body = new T.Mesh(lathe(type === 'n' ? 'n' : type), mat);
      body.castShadow = true; g.add(body);
      if (type === 'r') {                                   /* crenellations */
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const c = new T.Mesh(new T.BoxGeometry(0.08, 0.12, 0.08), mat);
          c.position.set(Math.cos(a) * 0.21, 0.66, Math.sin(a) * 0.21);
          c.castShadow = true; g.add(c);
        }
      } else if (type === 'b') {                            /* finial */
        const f = new T.Mesh(new T.SphereGeometry(0.06, 12, 10), mat);
        f.position.y = 0.77; f.castShadow = true; g.add(f);
      } else if (type === 'q') {                            /* crown of beads */
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const s = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), mat);
          s.position.set(Math.cos(a) * 0.18, 0.73, Math.sin(a) * 0.18);
          s.castShadow = true; g.add(s);
        }
        const top = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), mat);
        top.position.y = 0.77; top.castShadow = true; g.add(top);
      } else if (type === 'k') {                            /* cross */
        const v = new T.Mesh(new T.BoxGeometry(0.045, 0.2, 0.045), mat);
        v.position.y = 0.86; v.castShadow = true; g.add(v);
        const h = new T.Mesh(new T.BoxGeometry(0.14, 0.045, 0.045), mat);
        h.position.y = 0.85; h.castShadow = true; g.add(h);
      } else if (type === 'n') {                            /* stylised horse head */
        const neck = new T.Mesh(new T.BoxGeometry(0.18, 0.30, 0.16), mat);
        neck.position.set(0, 0.46, -0.02); neck.rotation.x = -0.32; neck.castShadow = true; g.add(neck);
        const muzzle = new T.Mesh(new T.BoxGeometry(0.15, 0.13, 0.24), mat);
        muzzle.position.set(0, 0.55, 0.12); muzzle.rotation.x = -0.32; muzzle.castShadow = true; g.add(muzzle);
        for (const dx of [-0.05, 0.05]) {
          const ear = new T.Mesh(new T.BoxGeometry(0.04, 0.11, 0.04), mat);
          ear.position.set(dx, 0.64, -0.06); ear.castShadow = true; g.add(ear);
        }
      }
      return g;
    }

    /* camera */
    let flip = false;
    function placeCamera() {
      const z = flip ? 8.4 : -8.4;
      camera.position.set(0, 8.2, z);
      camera.lookAt(0, 0, 0);
    }
    placeCamera();

    /* raycasting */
    const ray = new T.Raycaster();
    const ndc = new T.Vector2();
    let interactive = true;
    function pick(ev) {
      if (!interactive) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
      const py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
      ndc.x = (px / rect.width) * 2 - 1;
      ndc.y = -(py / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !(o.userData && o.userData.square)) o = o.parent;
        if (o && o.userData.square) { onPick(o.userData.square); return; }
      }
    }
    renderer.domElement.addEventListener('pointerdown', pick);

    /* pieces + highlight state */
    const pieceMap = {};                   /* square -> group */
    const fxGroup = new T.Group(); scene.add(fxGroup);
    const discGeo = new T.CircleGeometry(0.16, 20);
    const ringGeo = new T.RingGeometry(0.34, 0.42, 24);
    const discMat = new T.MeshBasicMaterial({ color: 0x39d98a, transparent: true, opacity: 0.65 });
    const ringMat = new T.MeshBasicMaterial({ color: 0x39d98a, transparent: true, opacity: 0.7, side: T.DoubleSide });

    function worldOf(sq) { return { x: sq.charCodeAt(0) - 97 - 3.5, z: (+sq[1]) - 4.5 }; }

    function clearPieces() {
      Object.values(pieceMap).forEach(g => scene.remove(g));
      for (const k in pieceMap) delete pieceMap[k];
    }
    function rebuild(boardArr) {
      clearPieces();
      const flipRanks = boardArr;          /* board()[0] = rank 8 */
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const pc = flipRanks[row][col]; if (!pc) continue;
        const sq = files[col] + (8 - row);
        const g = buildPiece(pc.type, pc.color);
        const w = worldOf(sq);
        g.position.set(w.x, 0, w.z);
        if (pc.color === 'b') g.rotation.y = Math.PI;
        g.userData = { square: sq, baseY: 0 };
        scene.add(g); pieceMap[sq] = g;
      }
    }

    function highlight(hi) {
      /* squares */
      for (const name in sqMesh) {
        const m = sqMesh[name];
        let emis = 0x000000, inten = 0;
        if (hi.checkSq === name) { emis = 0xff2e2e; inten = 0.85; }
        else if (hi.selected === name) { emis = 0xf5c842; inten = 0.6; }
        else if (hi.lastMove && (hi.lastMove.from === name || hi.lastMove.to === name)) { emis = 0xe0a93a; inten = 0.32; }
        m.material.emissive.setHex(emis); m.material.emissiveIntensity = inten;
      }
      /* lift selected piece */
      Object.values(pieceMap).forEach(g => { g.position.y = g.userData.baseY; });
      const selG = hi.selected && pieceMap[hi.selected];
      if (selG) selG.position.y = 0.18;
      /* dest hints */
      while (fxGroup.children.length) fxGroup.remove(fxGroup.children[0]);
      if (hi.showHints) (hi.legalDests || []).forEach(sq => {
        const w = worldOf(sq);
        const occupied = !!pieceMap[sq];
        const mk = new T.Mesh(occupied ? ringGeo : discGeo, occupied ? ringMat : discMat);
        mk.rotation.x = -Math.PI / 2; mk.position.set(w.x, 0.11, w.z);
        fxGroup.add(mk);
      });
      requestRender();
    }

    /* ── tween / render loop ──────────────────────────────────────── */
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
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    function applyMove(from, to, opts, cb) {
      const g = pieceMap[from];
      const capG = opts && opts.capture ? pieceMap[to] : null;
      if (!g) { cb && cb(); return; }
      const a = worldOf(from), b = worldOf(to);
      const hop = 0.5;
      tweens.push({
        start: performance.now(), dur: 280, ease: easeOut,
        step: t => {
          g.position.x = a.x + (b.x - a.x) * t;
          g.position.z = a.z + (b.z - a.z) * t;
          g.position.y = Math.sin(Math.PI * t) * hop;
        },
        done: cb,
      });
      if (capG) tweens.push({
        start: performance.now(), dur: 240,
        step: t => { capG.scale.setScalar(1 - t); capG.position.y = -t * 0.4; },
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
      rebuild, highlight, applyMove, resize, dispose,
      setFlip: f => { flip = f; placeCamera(); requestRender(); },
      setInteractive: v => { interactive = v; },
    };
  }

  /* ── CSS ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('ch-css')) return;
    const s = document.createElement('style'); s.id = 'ch-css';
    s.textContent = `
.ch-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0}
.ch-menu{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 16px;text-align:center}
.ch-logo{font-size:3rem;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}
.ch-title{font-family:var(--font-head,inherit);font-size:1.7rem;font-weight:900;color:var(--text,#fff)}
.ch-sub{font-size:.8rem;color:var(--muted,#9aa);letter-spacing:.08em;text-transform:uppercase}
.ch-opts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:340px}
.ch-opt{background:var(--card2,#1b1d33);border:1.5px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:10px;padding:9px 16px;font:inherit;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-opt:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5)}
.ch-opt.active{background:var(--accent-soft,rgba(124,92,255,.16));border-color:rgba(var(--accent-rgb,124,92,255),.7);color:var(--accent,#a98bff)}
.ch-toggle{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--text2,#ccd);background:var(--card2,#1b1d33);border:1.5px solid var(--border,#2a2c44);border-radius:10px;padding:8px 14px;cursor:pointer;user-select:none}
.ch-toggle .ch-sw{width:34px;height:19px;border-radius:999px;background:#3a3d55;position:relative;transition:background .15s;flex:none}
.ch-toggle .ch-sw::after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:transform .15s}
.ch-toggle.on .ch-sw{background:var(--accent,#7c5cff)}
.ch-toggle.on .ch-sw::after{transform:translateX(15px)}
.ch-play{background:linear-gradient(135deg,var(--accent,#7c5cff),#a855f7);color:#fff;border:none;border-radius:12px;padding:13px 44px;font:inherit;font-size:1.05rem;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(124,92,255,.35);transition:transform .15s}
.ch-play:hover{transform:scale(1.04)}

.ch-status{display:flex;align-items:center;gap:8px;font-size:.9rem;font-weight:700;color:var(--text,#fff);min-height:24px;text-align:center}
.ch-turn-dot{width:13px;height:13px;border-radius:50%;border:1.5px solid #888}
.ch-turn-w{background:#f1f1f1}.ch-turn-b{background:#222}
.ch-stage{width:min(94vw,460px);aspect-ratio:1;position:relative;border-radius:10px}
.ch-stage canvas{box-shadow:0 14px 44px rgba(0,0,0,.5)}
/* 2D fallback board */
.ch-board{width:min(94vw,460px);aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border-radius:8px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.45);touch-action:manipulation;border:2px solid #20222e}
.ch-sq{position:relative;display:flex;align-items:center;justify-content:center;border:none;padding:0;cursor:pointer;font-size:clamp(22px,7.5vw,40px);line-height:1;user-select:none;-webkit-tap-highlight-color:transparent}
.ch-light{background:#e8edf4}.ch-dark{background:#7b91b0}
.ch-pc{position:relative;z-index:2;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
.ch-w{color:#fff;text-shadow:0 0 1px #000,0 1px 2px rgba(0,0,0,.5)}
.ch-b{color:#1a1a1a}
.ch-sq.sel{box-shadow:inset 0 0 0 4px rgba(245,200,66,.9)}
.ch-sq.last::before{content:'';position:absolute;inset:0;background:rgba(245,200,66,.32);z-index:1}
.ch-sq.check::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(239,68,68,.7),transparent 70%);z-index:1}
.ch-dest::after{content:'';position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(40,40,40,.32);z-index:1}
.ch-dest.cap::after{width:84%;height:84%;background:transparent;border:4px solid rgba(40,40,40,.32);box-sizing:border-box}
.ch-coord{position:absolute;font-size:9px;font-weight:700;opacity:.6;z-index:1}
.ch-coord.f{right:2px;bottom:1px}.ch-coord.r{left:2px;top:1px}
.ch-light .ch-coord{color:#5a6b86}.ch-dark .ch-coord{color:#e8edf4}

.ch-ctrls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.ch-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:9px;padding:8px 16px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s}
.ch-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5);color:var(--accent,#a98bff)}
.ch-btn.on{background:var(--accent-soft,rgba(124,92,255,.16));border-color:rgba(var(--accent-rgb,124,92,255),.7);color:var(--accent,#a98bff)}
.ch-btn:disabled{opacity:.4;cursor:default}

.ch-promo-back{position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
.ch-promo{background:var(--card,#14162a);border:1px solid var(--border,#2a2c44);border-radius:16px;padding:18px;display:flex;gap:10px}
.ch-promo button{font-size:2.6rem;background:#e8edf4;border:2px solid transparent;border-radius:10px;width:64px;height:64px;cursor:pointer;color:#1a1a1a;transition:all .12s}
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
        <div class="ch-sub">Escolhe o adversário</div>
        <div class="ch-opts" id="ch-opp">
          ${opp.map(o => `<button class="ch-opt${o.k === cur ? ' active' : ''}" data-k="${o.k}">${o.t}</button>`).join('')}
        </div>
        <div class="ch-sub" style="margin-top:6px">Jogas com</div>
        <div class="ch-opts" id="ch-color">
          <button class="ch-opt${humanColor === 'w' ? ' active' : ''}" data-c="w">⚪ Brancas</button>
          <button class="ch-opt${humanColor === 'b' ? ' active' : ''}" data-c="b">⚫ Pretas</button>
          <button class="ch-opt" data-c="rand">🎲 Aleatório</button>
        </div>
        <div class="ch-toggle${showHints ? ' on' : ''}" id="ch-hint-toggle" role="switch" aria-checked="${showHints}">
          <span class="ch-sw"></span><span>💡 Mostrar movimentos possíveis</span>
        </div>
        <button class="ch-play" id="ch-play">▶ Jogar</button>
      </div>`;

    root.querySelectorAll('#ch-opp .ch-opt').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === '2p') mode = '2p'; else { mode = 'ai'; diffKey = k.split('-')[1]; }
      root.querySelectorAll('#ch-opp .ch-opt').forEach(x => x.classList.toggle('active', x === b));
    }));
    root.querySelectorAll('#ch-color .ch-opt').forEach(b => b.addEventListener('click', () => {
      humanColor = b.dataset.c === 'rand' ? (Math.random() < 0.5 ? 'w' : 'b') : b.dataset.c;
      root.querySelectorAll('#ch-color .ch-opt').forEach(x => x.classList.toggle('active', x.dataset.c === humanColor));
    }));
    root.querySelector('#ch-hint-toggle').addEventListener('click', () => setHints(!showHints));
    root.querySelector('#ch-play').addEventListener('click', startGame);
  }

  function setHints(on) {
    showHints = on;
    try { localStorage.setItem('chess-hints', on ? '1' : '0'); } catch (e) {}
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

  /* ── render ─────────────────────────────────────────────────────── */
  function renderGame() {
    root.innerHTML = `
      <div class="ch-wrap">
        <div class="ch-status" id="ch-status"></div>
        <div class="ch-stage" id="ch-stage"></div>
        <div class="ch-ctrls">
          <button class="ch-btn${showHints ? ' on' : ''}" id="ch-hint-btn">💡 Dicas</button>
          <button class="ch-btn" id="ch-undo">↩ Desfazer</button>
          <button class="ch-btn" id="ch-new">🔄 Novo</button>
          <button class="ch-btn" id="ch-menu">☰ Menu</button>
        </div>
      </div>`;
    root.querySelector('#ch-hint-btn').addEventListener('click', () => setHints(!showHints));
    root.querySelector('#ch-new').addEventListener('click', startGame);
    root.querySelector('#ch-menu').addEventListener('click', showMenu);
    root.querySelector('#ch-undo').addEventListener('click', undo);
    mountBoard();
    updateStatus();
  }

  function mountBoard() {
    const stage = root.querySelector('#ch-stage');
    if (!stage) return;
    if (!use3D) { draw2D(); afterInitialMove(); return; }
    ensureThree().then(() => {
      if (!root.querySelector('#ch-stage')) return;        /* navigated away */
      board3d = createBoard3D(stage, onSquare);
      board3d.setFlip(mode === 'ai' && humanColor === 'b');
      board3d.rebuild(game.board());
      refreshHighlight();
      afterInitialMove();
    }).catch(() => {
      use3D = false;
      draw2D();
      afterInitialMove();
    });
  }

  function afterInitialMove() {
    /* If the human is Black against the AI, let White (AI) open. */
    if (mode === 'ai' && humanColor === 'b') aiTurn();
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

  /* 2D fallback renderer (also used if WebGL unavailable). */
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
      if (game.in_checkmate()) {
        const winner = game.turn() === 'w' ? 'Pretas' : 'Brancas';
        msg = `♚ Xeque-mate — ${winner} ganham!`;
      } else if (game.in_stalemate()) msg = '🤝 Empate (afogamento)';
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

  /* Animate (3D) or redraw (2D), then continue the game flow. */
  function commitMove(res) {
    const cont = () => {
      updateStatus();
      if (game.game_over()) { finish(); return; }
      if (mode === 'ai' && game.turn() !== humanColor) aiTurn();
    };
    if (use3D && board3d) {
      const capture = !!res.captured || (res.flags && res.flags.includes('e'));
      board3d.applyMove(res.from, res.to, { capture }, () => {
        board3d.rebuild(game.board());
        refreshHighlight();
        cont();
      });
    } else {
      draw2D();
      cont();
    }
  }

  function promptPromotion(from, to) {
    const color = game.turn();
    const back = document.createElement('div');
    back.className = 'ch-promo-back';
    back.innerHTML = `<div class="ch-promo" role="dialog" aria-label="Escolhe a promoção">
      ${['q','r','b','n'].map(t => `<button data-t="${t}" aria-label="${pieceName(t)}"><span class="ch-${color}">${GLYPH[t]}</span></button>`).join('')}
    </div>`;
    document.body.appendChild(back);
    back.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      back.remove(); applyMove({ from, to, promotion: b.dataset.t });
    }));
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
    updateStatus();
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
