/* ══════════════════════════════════════════════════════════════════
   BattleshipGame — classic 10×10 Batalha Naval, fully offline.
   Placement phase (tap + rotate + auto) then alternating fire.
   Visuals: your own fleet is drawn as real ship hulls (SVG) on the
   grid; firing plays a falling-bomb → splash (miss) / explosion (hit)
   animation. Equal-size cells via an explicit square grid. Mobile-first.
   AI difficulty (unified GameHost easy/medium/hard):
     • easy   — random untried cells
     • medium — random until a hit, then hunt adjacent cells (target mode)
     • hard   — probability-density targeting: for every way the remaining
                ships can still fit, tally each cell; shoot the most likely,
                biased heavily toward explaining existing hits.
   Integrates GameProgress (wins, accuracy) + achievements.
══════════════════════════════════════════════════════════════════ */
const BattleshipGame = (function () {
  'use strict';

  const N = 10;
  const FLEET = [
    { name: 'Porta-aviões', size: 5, kind: 'carrier' },
    { name: 'Couraçado',    size: 4, kind: 'battleship' },
    { name: 'Cruzador',     size: 3, kind: 'cruiser' },
    { name: 'Submarino',    size: 3, kind: 'submarine' },
    { name: 'Lancha',       size: 2, kind: 'patrol' },
  ];

  let root, phase, player, enemy, turn, placeIdx, placeOri, ai, shotsFired, hitsLanded, locked;

  function diff() {
    try { if (typeof GameHost !== 'undefined' && GameHost.getDifficulty) return GameHost.getDifficulty(); } catch (e) {}
    const d = localStorage.getItem('quiz-difficulty');
    return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ── board model ────────────────────────────────────────────────── */
  function newBoard() {
    return {
      occ: Array.from({ length: N }, () => Array(N).fill(-1)),   /* ship index or -1 */
      shot: Array.from({ length: N }, () => Array(N).fill(false)),
      ships: [],   /* {name,size,kind,cells:[{r,c}],ori,hits} */
    };
  }
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  function canPlace(board, r, c, size, ori) {
    for (let k = 0; k < size; k++) {
      const rr = ori === 'v' ? r + k : r, cc = ori === 'h' ? c + k : c;
      if (!inB(rr, cc) || board.occ[rr][cc] !== -1) return false;
    }
    return true;
  }
  function placeShip(board, r, c, size, ori, ship) {
    const cells = [];
    for (let k = 0; k < size; k++) {
      const rr = ori === 'v' ? r + k : r, cc = ori === 'h' ? c + k : c;
      board.occ[rr][cc] = board.ships.length;
      cells.push({ r: rr, c: cc });
    }
    board.ships.push({ name: ship.name, size, kind: ship.kind, cells, ori, hits: 0 });
  }
  function randomFleet(board) {
    board.occ = Array.from({ length: N }, () => Array(N).fill(-1));
    board.ships = [];
    FLEET.forEach(sh => {
      let placed = false, guard = 0;
      while (!placed && guard++ < 1000) {
        const ori = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
        if (canPlace(board, r, c, sh.size, ori)) { placeShip(board, r, c, sh.size, ori, sh); placed = true; }
      }
    });
  }

  /* ── geometry helpers (percent of board) ────────────────────────── */
  const pct = n => (n / N) * 100;

  /* Top-down ship hull as an SVG string, stretched to fill its cell rect.
     `p(along, across)` lets the same code draw horizontal or vertical hulls. */
  function hullSVG(ship) {
    const { size, kind, ori } = ship;
    const A = size * 100;                               /* "along" length in vb units */
    const p = (a, x) => (ori === 'h' ? `${a} ${x}` : `${x} ${a}`);
    const vb = ori === 'h' ? `0 0 ${A} 100` : `0 0 100 ${A}`;
    const bowBase = A - 30, bend = A - 6, tip = A - 1;
    const hull = `M ${p(15, 30)} L ${p(bowBase, 30)} Q ${p(bend, 34)} ${p(tip, 50)} `
               + `Q ${p(bend, 66)} ${p(bowBase, 70)} L ${p(15, 70)} Q ${p(2, 50)} ${p(15, 30)} Z`;
    /* deck = inset lighter shape */
    const deck = `M ${p(20, 40)} L ${p(bowBase - 4, 40)} Q ${p(bend - 6, 42)} ${p(tip - 8, 50)} `
               + `Q ${p(bend - 6, 58)} ${p(bowBase - 4, 60)} L ${p(20, 60)} Q ${p(12, 50)} ${p(20, 40)} Z`;
    const rect = (a0, x0, aL, xL) => ori === 'h'
      ? `x="${a0}" y="${x0}" width="${aL}" height="${xL}"`
      : `x="${x0}" y="${a0}" width="${xL}" height="${aL}"`;
    const circ = (a, x, rr) => ori === 'h' ? `cx="${a}" cy="${x}" r="${rr}"` : `cx="${x}" cy="${a}" r="${rr}"`;

    let details = '';
    if (kind === 'carrier') {
      details = `<rect ${rect(24, 42, A - 64, 16)} rx="3" fill="rgba(255,255,255,.10)"/>`
              + `<line ${ori === 'h' ? `x1="26" y1="50" x2="${A - 36}" y2="50"` : `x1="50" y1="26" x2="50" y2="${A - 36}"`} stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-dasharray="7 7"/>`
              + `<rect ${rect(A - 30, 33, 12, 34)} rx="2" fill="#33485e"/>`;
    } else if (kind === 'submarine') {
      details = `<circle ${circ(A * 0.42, 50, 9)} fill="#33485e"/>`
              + `<rect ${rect(A * 0.42 - 3, 47, 6, 6)} fill="#22323f"/>`;
    } else {
      const bridge = ori === 'h' ? rect(A * 0.30, 38, Math.min(26, A * 0.22), 24)
                                 : rect(A * 0.30, 38, Math.min(26, A * 0.22), 24);
      details = `<rect ${bridge} rx="3" fill="#33485e"/>`;
      if (size >= 3) details += `<circle ${circ(A * 0.62, 50, 6)} fill="#2b3d4f"/>`;
      if (size >= 4) details += `<circle ${circ(A * 0.14, 50, 6)} fill="#2b3d4f"/>`;
    }
    return `<svg class="bs-hull-svg" viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${hull}" fill="#48637f" stroke="#2b3d50" stroke-width="2"/>
      <path d="${deck}" fill="#5d7c9c"/>${details}</svg>`;
  }

  /* ── CSS ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('bs-css')) return;
    const s = document.createElement('style'); s.id = 'bs-css';
    s.textContent = `
.bs-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0}
.bs-title{font-family:var(--font-head,inherit);font-size:1.4rem;font-weight:900;color:var(--text,#fff);text-align:center}
.bs-hint{font-size:.82rem;color:var(--muted,#9aa);text-align:center;max-width:440px;min-height:18px}
.bs-board-lbl{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9aa);margin-bottom:4px}
.bs-board{position:relative;display:grid;grid-template-columns:repeat(${N},1fr);grid-template-rows:repeat(${N},1fr);
  width:min(94vw,400px);aspect-ratio:1;gap:0;padding:0;border-radius:8px;overflow:hidden;
  background:linear-gradient(160deg,#0c2034,#0a1a2b);box-shadow:0 8px 30px rgba(0,0,0,.4),inset 0 0 0 1px rgba(120,150,190,.18);touch-action:manipulation}
.bs-cell{position:relative;background:transparent;display:flex;align-items:center;justify-content:center;
  border:none;padding:0;margin:0;color:#cfe;box-shadow:inset 0 0 0 .5px rgba(120,150,190,.13);-webkit-tap-highlight-color:transparent}
.bs-board.enemy.armed .bs-cell:not(.shot){cursor:crosshair}
.bs-board.enemy.armed .bs-cell:not(.shot):hover{background:rgba(124,160,210,.16);box-shadow:inset 0 0 0 1.5px rgba(160,200,255,.5)}
.bs-cell.miss::after{content:'';position:absolute;width:24%;height:24%;border-radius:50%;
  background:radial-gradient(circle at 40% 35%,#aecbe6,#5b7da0);box-shadow:0 0 6px rgba(140,180,220,.5)}
.bs-layer{position:absolute;inset:0;pointer-events:none}
.bs-hull-layer .bs-hull{position:absolute;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.bs-hull-svg{width:100%;height:100%;display:block}
.bs-hull.sunk{filter:grayscale(.6) brightness(.62) drop-shadow(0 1px 2px rgba(0,0,0,.5))}
.bs-hull.enter{animation:bs-reveal .45s ease both}
@keyframes bs-reveal{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
.bs-dmg{position:absolute;display:flex;align-items:center;justify-content:center;font-size:clamp(10px,2.9vw,17px);line-height:1}
.bs-dmg.hit::after{content:'🔥';filter:drop-shadow(0 0 4px rgba(255,140,40,.8))}
.bs-dmg.sunk::after{content:'✖';color:#ff7a5c;font-weight:900;text-shadow:0 0 6px rgba(255,90,50,.9)}
/* firing FX */
.bs-fx{position:absolute;pointer-events:none;display:flex;align-items:center;justify-content:center}
.bs-fx .bomb{width:42%;height:42%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#5a6470,#1b2026);
  box-shadow:0 3px 6px rgba(0,0,0,.5);animation:bs-drop .34s cubic-bezier(.55,0,.85,.5) forwards}
@keyframes bs-drop{0%{transform:translateY(-820%) scale(.7);opacity:0}15%{opacity:1}100%{transform:translateY(0) scale(1)}}
.bs-fx .splash{position:absolute;width:14%;height:14%;border-radius:50%;border:3px solid rgba(180,215,245,.95);
  animation:bs-splash .5s ease-out forwards}
@keyframes bs-splash{0%{width:8%;height:8%;opacity:0}25%{opacity:1}100%{width:150%;height:150%;opacity:0;border-width:1px}}
.bs-fx .boom{position:absolute;width:30%;height:30%;border-radius:50%;
  background:radial-gradient(circle,#fff 0%,#ffd24a 28%,#ff7b2e 55%,rgba(255,80,30,0) 72%);
  animation:bs-boom .5s ease-out forwards}
@keyframes bs-boom{0%{transform:scale(.2);opacity:1}60%{opacity:1}100%{transform:scale(2.6);opacity:0}}
.bs-fx .ring{position:absolute;width:20%;height:20%;border-radius:50%;border:3px solid rgba(255,170,70,.9);
  animation:bs-ring .55s ease-out forwards}
@keyframes bs-ring{0%{transform:scale(.3);opacity:.9}100%{transform:scale(3);opacity:0}}
.bs-fx .spark{position:absolute;width:7%;height:7%;border-radius:50%;background:#ffd98a;
  animation:bs-spark .5s ease-out forwards}
@keyframes bs-spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}
.bs-fleet{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:.7rem;margin-top:6px}
.bs-fleet-item{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd)}
.bs-fleet-item.sunk{opacity:.5;text-decoration:line-through}
.bs-ctrls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.bs-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:9px;padding:9px 16px;font:inherit;font-size:.84rem;font-weight:700;cursor:pointer;transition:all .15s}
.bs-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5);color:var(--accent,#a98bff)}
.bs-btn.primary{background:linear-gradient(135deg,var(--accent,#7c5cff),#a855f7);color:#fff;border:none}
.bs-btn:disabled{opacity:.4;cursor:default}
.bs-end{text-align:center;padding:18px;display:flex;flex-direction:column;gap:12px;align-items:center}
.bs-end-emo{font-size:3rem}
.bs-end-title{font-size:1.5rem;font-weight:900;color:var(--text,#fff)}
.bs-grids{display:flex;flex-direction:column;gap:16px;align-items:center;width:100%}
@media (min-width:760px){.bs-grids{flex-direction:row;justify-content:center;align-items:flex-start;gap:26px}}
@media (prefers-reduced-motion:reduce){.bs-fx *,.bs-hull.enter{animation-duration:.01ms!important}}`;
    document.head.appendChild(s);
  }

  /* ── init / placement ───────────────────────────────────────────── */
  function init(r) { root = r; if (!root) return; injectCSS(); startPlacement(); }

  function startPlacement() {
    phase = 'place'; placeIdx = 0; placeOri = 'h';
    player = newBoard(); enemy = newBoard();
    shotsFired = 0; hitsLanded = 0; locked = false;
    renderPlacement();
  }

  function renderPlacement() {
    const ship = FLEET[placeIdx];
    root.innerHTML = `
      <div class="bs-wrap">
        <div class="bs-title">🚢 Posiciona a tua frota</div>
        <div class="bs-hint" id="bs-hint">${ship
          ? `Coloca: <strong>${ship.name}</strong> (${ship.size}) · orientação ${placeOri === 'h' ? 'horizontal ↔' : 'vertical ↕'}`
          : 'Frota completa! Pronto para a batalha.'}</div>
        <div class="bs-board-lbl">A tua água</div>
        <div class="bs-board" id="bs-place"></div>
        <div class="bs-ctrls">
          <button class="bs-btn" id="bs-rotate">🔄 Rodar</button>
          <button class="bs-btn" id="bs-random">🎲 Aleatório</button>
          <button class="bs-btn" id="bs-clear">🗑 Limpar</button>
          <button class="bs-btn primary" id="bs-start" ${placeIdx < FLEET.length ? 'disabled' : ''}>⚔ Começar</button>
        </div>
      </div>`;
    drawPlaceBoard();
    root.querySelector('#bs-rotate').addEventListener('click', () => { placeOri = placeOri === 'h' ? 'v' : 'h'; renderPlacement(); });
    root.querySelector('#bs-random').addEventListener('click', () => { randomFleet(player); placeIdx = FLEET.length; renderPlacement(); });
    root.querySelector('#bs-clear').addEventListener('click', () => { player = newBoard(); placeIdx = 0; renderPlacement(); });
    root.querySelector('#bs-start').addEventListener('click', beginBattle);
  }

  function cellsHTML(interactive) {
    let html = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      html += `<button class="bs-cell" data-r="${r}" data-c="${c}" aria-label="${String.fromCharCode(65 + c)}${r + 1}"${interactive ? '' : ' tabindex="-1"'}></button>`;
    }
    return html + '<div class="bs-layer bs-hull-layer"></div><div class="bs-layer bs-fx-layer"></div>';
  }

  function drawPlaceBoard() {
    const bd = root.querySelector('#bs-place'); if (!bd) return;
    bd.innerHTML = cellsHTML(true);
    drawOverlays(bd, player, () => true, false);
    bd.querySelectorAll('.bs-cell').forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c;
      el.addEventListener('click', () => onPlace(r, c));
      el.addEventListener('mouseenter', () => previewPlace(r, c));
      el.addEventListener('mouseleave', clearPreview);
    });
  }

  function previewPlace(r, c) {
    if (placeIdx >= FLEET.length) return;
    const layer = root.querySelector('#bs-place .bs-fx-layer'); if (!layer) return;
    clearPreview();
    const ship = FLEET[placeIdx];
    const ok = canPlace(player, r, c, ship.size, placeOri);
    const ghost = document.createElement('div');
    ghost.className = 'bs-preview';
    Object.assign(ghost.style, rectStyle(r, c, ship.size, placeOri));
    ghost.style.background = ok ? 'rgba(110,150,200,.4)' : 'rgba(190,70,70,.5)';
    ghost.style.borderRadius = '6px';
    ghost.style.outline = '2px solid ' + (ok ? 'rgba(150,200,255,.8)' : 'rgba(255,120,120,.8)');
    layer.appendChild(ghost);
  }
  function clearPreview() {
    root.querySelectorAll('#bs-place .bs-preview').forEach(el => el.remove());
  }

  function onPlace(r, c) {
    if (placeIdx >= FLEET.length) return;
    const ship = FLEET[placeIdx];
    if (!canPlace(player, r, c, ship.size, placeOri)) {
      const h = root.querySelector('#bs-hint'); if (h) h.textContent = 'Posição inválida — sai do tabuleiro ou sobrepõe outro navio.';
      return;
    }
    placeShip(player, r, c, ship.size, placeOri, ship);
    placeIdx++;
    renderPlacement();
  }

  /* ── battle ─────────────────────────────────────────────────────── */
  function beginBattle() {
    if (player.ships.length < FLEET.length) return;
    randomFleet(enemy);
    phase = 'battle'; turn = 'player'; locked = false;
    ai = { view: Array.from({ length: N }, () => Array(N).fill('unknown')), activeHits: [], remaining: FLEET.map(s => s.size) };
    renderBattle();
  }

  function shipsLeft(board) { return board.ships.filter(s => s.hits < s.size).length; }

  function renderBattle() {
    root.innerHTML = `
      <div class="bs-wrap">
        <div class="bs-title">⚔ Batalha Naval</div>
        <div class="bs-hint" id="bs-hint">A tua vez — dispara no tabuleiro inimigo.</div>
        <div class="bs-grids">
          <div style="display:flex;flex-direction:column;align-items:center">
            <div class="bs-board-lbl">Inimigo</div>
            <div class="bs-board enemy armed" id="bs-enemy"></div>
            <div class="bs-fleet" id="bs-enemy-fleet"></div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center">
            <div class="bs-board-lbl">A tua frota</div>
            <div class="bs-board" id="bs-self"></div>
            <div class="bs-fleet" id="bs-self-fleet"></div>
          </div>
        </div>
        <div class="bs-ctrls">
          <button class="bs-btn" id="bs-new">🔄 Novo jogo</button>
        </div>
      </div>`;
    root.querySelector('#bs-new').addEventListener('click', startPlacement);
    drawEnemyBoard();
    drawSelfBoard();
    drawFleets();
  }

  /* Position helpers for absolutely-placed hulls / markers / FX. */
  function rectStyle(r, c, span, ori) {
    return {
      position: 'absolute',
      left: pct(c) + '%', top: pct(r) + '%',
      width: pct(ori === 'h' ? span : 1) + '%',
      height: pct(ori === 'h' ? 1 : span) + '%',
    };
  }
  function cellStyle(r, c) {
    return { position: 'absolute', left: pct(c) + '%', top: pct(r) + '%', width: pct(1) + '%', height: pct(1) + '%' };
  }

  /* Draw ship hulls (filtered by `reveal`) + persistent hit/sunk markers. */
  function drawOverlays(bd, board, reveal, animateReveal) {
    const hl = bd.querySelector('.bs-hull-layer'), fx = bd.querySelector('.bs-fx-layer');
    if (!hl) return;
    hl.innerHTML = '';
    board.ships.forEach(ship => {
      const sunk = ship.hits >= ship.size;
      if (reveal(ship)) {
        const first = ship.cells[0];
        const el = document.createElement('div');
        el.className = 'bs-hull' + (sunk ? ' sunk' : '') + (animateReveal ? ' enter' : '');
        Object.assign(el.style, rectStyle(first.r, first.c, ship.size, ship.ori));
        el.innerHTML = hullSVG(ship);
        hl.appendChild(el);
      }
      /* hit / sunk markers (always above hull) */
      ship.cells.forEach(cell => {
        if (!board.shot[cell.r][cell.c]) return;
        const m = document.createElement('div');
        m.className = 'bs-dmg ' + (sunk ? 'sunk' : 'hit');
        Object.assign(m.style, cellStyle(cell.r, cell.c));
        fx.appendChild(m);
      });
    });
  }

  function drawEnemyBoard() {
    const bd = root.querySelector('#bs-enemy'); if (!bd) return;
    bd.innerHTML = cellsHTML(true);
    bd.querySelectorAll('.bs-cell').forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c;
      if (enemy.shot[r][c]) { el.classList.add('shot'); if (enemy.occ[r][c] === -1) el.classList.add('miss'); }
      el.addEventListener('click', () => playerFire(r, c));
    });
    /* only reveal sunk enemy ships */
    drawOverlays(bd, enemy, ship => ship.hits >= ship.size, false);
  }

  function drawSelfBoard() {
    const bd = root.querySelector('#bs-self'); if (!bd) return;
    bd.innerHTML = cellsHTML(false);
    bd.querySelectorAll('.bs-cell').forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c;
      if (player.shot[r][c]) { el.classList.add('shot'); if (player.occ[r][c] === -1) el.classList.add('miss'); }
    });
    drawOverlays(bd, player, () => true, false);   /* always show your whole fleet */
  }

  function drawFleets() {
    const ef = root.querySelector('#bs-enemy-fleet'), sf = root.querySelector('#bs-self-fleet');
    const mk = b => b.ships.map(s => `<span class="bs-fleet-item${s.hits >= s.size ? ' sunk' : ''}">${s.size}</span>`).join('');
    if (ef) ef.innerHTML = mk(enemy);
    if (sf) sf.innerHTML = mk(player);
  }

  function setHint(t) { const h = root.querySelector('#bs-hint'); if (h) h.innerHTML = t; }
  function setArmed(on) { const e = root.querySelector('#bs-enemy'); if (e) e.classList.toggle('armed', on); }

  /* ── firing FX ──────────────────────────────────────────────────── */
  function playFireFX(bd, r, c, hit, sunk, cb) {
    const fx = bd.querySelector('.bs-fx-layer');
    if (!fx || reduceMotion()) { cb(); return; }
    const wrap = document.createElement('div');
    wrap.className = 'bs-fx';
    Object.assign(wrap.style, cellStyle(r, c));
    wrap.innerHTML = '<div class="bomb"></div>';
    fx.appendChild(wrap);
    setTimeout(() => {
      wrap.querySelector('.bomb')?.remove();
      if (hit) {
        wrap.insertAdjacentHTML('beforeend', '<div class="boom"></div><div class="ring"></div>');
        for (let i = 0; i < 6; i++) {
          const sp = document.createElement('div'); sp.className = 'spark';
          const ang = Math.random() * Math.PI * 2, d = 60 + Math.random() * 80;
          sp.style.setProperty('--dx', Math.cos(ang) * d + '%');
          sp.style.setProperty('--dy', Math.sin(ang) * d + '%');
          wrap.appendChild(sp);
        }
      } else {
        wrap.insertAdjacentHTML('beforeend', '<div class="splash"></div>');
      }
      /* let the splash/explosion play out before redrawing the board (which
         wipes the FX layer); cb advances the game state. */
      setTimeout(() => { wrap.remove(); cb(); }, 520);
    }, 340);
  }

  function playerFire(r, c) {
    if (phase !== 'battle' || turn !== 'player' || locked || enemy.shot[r][c]) return;
    locked = true; setArmed(false);
    const bd = root.querySelector('#bs-enemy');
    enemy.shot[r][c] = true;
    shotsFired++;
    const idx = enemy.occ[r][c];
    let sunk = false, hit = idx !== -1;
    if (hit) {
      hitsLanded++;
      const ship = enemy.ships[idx]; ship.hits++;
      if (ship.hits >= ship.size) sunk = true;
    }
    playFireFX(bd, r, c, hit, sunk, () => {
      drawEnemyBoard(); drawFleets();
      if (shipsLeft(enemy) === 0) return endGame(true);
      setHint(hit ? (sunk ? '💥 Afundaste um navio!' : '🎯 Acertaste! Vez do inimigo…') : '💧 Água. Vez do inimigo…');
      turn = 'enemy';
      setTimeout(enemyFire, hit ? 520 : 360);
    });
  }

  /* ── AI ─────────────────────────────────────────────────────────── */
  function neighbors(p) { return [{ r: p.r - 1, c: p.c }, { r: p.r + 1, c: p.c }, { r: p.r, c: p.c - 1 }, { r: p.r, c: p.c + 1 }]; }
  function randomUnknown() {
    const list = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (ai.view[r][c] === 'unknown') list.push({ r, c });
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  function mediumTarget() {
    const hits = ai.activeHits;
    let cand = [];
    if (hits.length >= 2) {
      const sameRow = hits.every(h => h.r === hits[0].r);
      const sameCol = hits.every(h => h.c === hits[0].c);
      if (sameRow) { const r = hits[0].r, cs = hits.map(h => h.c); cand.push({ r, c: Math.min(...cs) - 1 }, { r, c: Math.max(...cs) + 1 }); }
      else if (sameCol) { const c = hits[0].c, rs = hits.map(h => h.r); cand.push({ r: Math.min(...rs) - 1, c }, { r: Math.max(...rs) + 1, c }); }
      else hits.forEach(h => cand.push(...neighbors(h)));
    } else if (hits.length === 1) cand = neighbors(hits[0]);
    cand = cand.filter(p => inB(p.r, p.c) && ai.view[p.r][p.c] === 'unknown');
    return cand.length ? cand[Math.floor(Math.random() * cand.length)] : randomUnknown();
  }

  function hardDensity() {
    const counts = Array.from({ length: N }, () => Array(N).fill(0));
    const hasHits = ai.activeHits.length > 0;
    for (const size of ai.remaining) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        for (const ori of ['h', 'v']) {
          const cells = [];
          let ok = true, coversHit = false;
          for (let k = 0; k < size; k++) {
            const rr = ori === 'v' ? r + k : r, cc = ori === 'h' ? c + k : c;
            if (!inB(rr, cc)) { ok = false; break; }
            const v = ai.view[rr][cc];
            if (v === 'miss' || v === 'sunk') { ok = false; break; }
            if (v === 'hit') coversHit = true;
            cells.push({ r: rr, c: cc });
          }
          if (!ok) continue;
          const w = coversHit ? 60 : 1;
          if (hasHits && !coversHit) continue;
          for (const cell of cells) if (ai.view[cell.r][cell.c] === 'unknown') counts[cell.r][cell.c] += w;
        }
      }
    }
    let best = -1, pick = null;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (ai.view[r][c] !== 'unknown') continue;
      if (counts[r][c] > best) { best = counts[r][c]; pick = { r, c }; }
      else if (counts[r][c] === best && best > 0 && Math.random() < 0.3) pick = { r, c };
    }
    return pick || randomUnknown();
  }

  function aiChoose() {
    const d = diff();
    if (d === 'easy') return randomUnknown();
    if (d === 'medium') return ai.activeHits.length ? mediumTarget() : randomUnknown();
    return hardDensity();   /* hard */
  }

  function enemyFire() {
    if (phase !== 'battle') return;
    const shot = aiChoose();
    if (!shot) return;
    const { r, c } = shot;
    const bd = root.querySelector('#bs-self');
    player.shot[r][c] = true;
    const idx = player.occ[r][c];
    let sunk = false, hit = idx !== -1;
    if (hit) {
      ai.view[r][c] = 'hit';
      ai.activeHits.push({ r, c });
      const ship = player.ships[idx]; ship.hits++;
      if (ship.hits >= ship.size) {
        sunk = true;
        ship.cells.forEach(cell => { ai.view[cell.r][cell.c] = 'sunk'; });
        ai.activeHits = ai.activeHits.filter(h => player.occ[h.r][h.c] !== idx);
        const i = ai.remaining.indexOf(ship.size); if (i !== -1) ai.remaining.splice(i, 1);
      }
    } else {
      ai.view[r][c] = 'miss';
    }
    playFireFX(bd, r, c, hit, sunk, () => {
      drawSelfBoard(); drawFleets();
      if (shipsLeft(player) === 0) return endGame(false);
      if (hit) { setHint(sunk ? '🛟 O inimigo afundou um navio teu!' : '🔥 O inimigo acertou! Continua a disparar…'); turn = 'player'; locked = false; setArmed(true); }
      else { setHint('A tua vez — dispara no tabuleiro inimigo.'); turn = 'player'; locked = false; setArmed(true); }
    });
  }

  function endGame(playerWon) {
    phase = 'over'; locked = false;
    const acc = shotsFired ? Math.round((hitsLanded / shotsFired) * 100) : 0;
    if (typeof GameProgress !== 'undefined') {
      try { GameProgress.record('battleship', { won: playerWon, mode: diff(), score: shotsFired, lowerIsBetter: true, meta: { accuracy: acc } }); } catch (e) {}
    }
    root.innerHTML = `
      <div class="bs-wrap"><div class="bs-end">
        <div class="bs-end-emo">${playerWon ? '🏆' : '💥'}</div>
        <div class="bs-end-title">${playerWon ? 'Vitória!' : 'Derrota'}</div>
        <div class="bs-hint">${playerWon ? 'Afundaste toda a frota inimiga.' : 'A tua frota foi afundada.'}<br>
          Tiros: <strong>${shotsFired}</strong> · Precisão: <strong>${acc}%</strong></div>
        <div class="bs-ctrls">
          <button class="bs-btn primary" id="bs-again">🔄 Jogar de novo</button>
        </div>
      </div></div>`;
    root.querySelector('#bs-again').addEventListener('click', startPlacement);
  }

  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('battleship', [
      { id: 'bs.win',  name: 'Almirante',     icon: '🚢', desc: 'Vence uma Batalha Naval.',         test: c => c.gameId === 'battleship' && c.result.won === true },
      { id: 'bs.hard', name: 'Lobo do Mar',   icon: '⚓', desc: 'Vence no nível Difícil.',           test: c => c.gameId === 'battleship' && c.result.won === true && c.result.mode === 'hard' },
      { id: 'bs.sharp', name: 'Pontaria de Elite', icon: '🎯', desc: 'Vence com 50%+ de precisão.', test: c => c.gameId === 'battleship' && c.result.won === true && c.result.meta && c.result.meta.accuracy >= 50 },
    ]);
  }

  return { init };
})();
