/* ══════════════════════════════════════════════════════════════════
   BattleshipGame — classic 10×10 Batalha Naval, fully offline.
   Placement is now drag-and-drop: drag each ship from the side tray onto
   your water (mouse or touch), rotate while dragging, and pick placed
   ships back up to reposition. An animated sea shimmers behind the
   boards; firing plays a cannon-whistle → splash (miss) / explosion +
   sinking animation (hit) with WebAudio sound.
   AI difficulty (unified GameHost easy/medium/hard):
     • easy   — random untried cells
     • medium — random until a hit, then hunt adjacent cells (target mode)
     • hard   — probability-density targeting biased toward existing hits.
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

  let root, phase, player, enemy, turn, placeOri, ai, shotsFired, hitsLanded, locked, drag, justSunk;

  function diff() {
    try { if (typeof GameData !== 'undefined' && GameData.difficulty) return GameData.difficulty('battleship', 'medium'); } catch (e) {}
    const d = localStorage.getItem('gamediff:battleship');
    return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ── audio ──────────────────────────────────────────────────────── */
  let _ac = null;
  function ac() { try { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); if (_ac.state === 'suspended') _ac.resume(); } catch (e) { _ac = null; } return _ac; }
  function muted() { return typeof GameAudio !== 'undefined' && GameAudio.muted; }
  function tone(freq, type, dur, vol, slideTo) {
    if (muted()) return;
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(vol || 0.2, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  }
  const sfx = {
    launch: () => tone(900, 'sawtooth', 0.32, 0.12, 240),
    splash: () => { tone(380, 'sine', 0.18, 0.18, 160); if (typeof GameAudio !== 'undefined') GameAudio.pop(); },
    hit:    () => { if (typeof GameAudio !== 'undefined') GameAudio.explosion(); tone(90, 'sawtooth', 0.3, 0.25); },
    sunk:   () => { [330, 262, 196, 147].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.22, 0.2), i * 110)); },
    place:  () => tone(520, 'sine', 0.08, 0.18),
    rotate: () => tone(700, 'square', 0.05, 0.12),
  };

  /* ── board model ────────────────────────────────────────────────── */
  function newBoard() {
    return {
      occ: Array.from({ length: N }, () => Array(N).fill(-1)),
      shot: Array.from({ length: N }, () => Array(N).fill(false)),
      ships: [],
    };
  }
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  function canPlace(board, r, c, size, ori, ignoreIdx) {
    for (let k = 0; k < size; k++) {
      const rr = ori === 'v' ? r + k : r, cc = ori === 'h' ? c + k : c;
      if (!inB(rr, cc)) return false;
      if (board.occ[rr][cc] !== -1 && board.occ[rr][cc] !== ignoreIdx) return false;
    }
    return true;
  }
  function placeShip(board, r, c, size, ori, ship) {
    const cells = [];
    const idx = board.ships.length;
    for (let k = 0; k < size; k++) {
      const rr = ori === 'v' ? r + k : r, cc = ori === 'h' ? c + k : c;
      board.occ[rr][cc] = idx;
      cells.push({ r: rr, c: cc });
    }
    board.ships.push({ name: ship.name, size, kind: ship.kind, cells, ori, hits: 0, fleetIdx: ship.fleetIdx });
  }
  function randomFleet(board) {
    board.occ = Array.from({ length: N }, () => Array(N).fill(-1));
    board.ships = [];
    FLEET.forEach((sh, fi) => {
      let placed = false, guard = 0;
      while (!placed && guard++ < 1000) {
        const ori = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
        if (canPlace(board, r, c, sh.size, ori)) { placeShip(board, r, c, sh.size, ori, Object.assign({ fleetIdx: fi }, sh)); placed = true; }
      }
    });
  }
  function placedFleetIdxs() { return new Set(player.ships.map(s => s.fleetIdx)); }
  function allPlaced() { return player.ships.length >= FLEET.length; }

  /* ── geometry ────────────────────────────────────────────────────── */
  const pct = n => (n / N) * 100;

  function hullSVG(ship) {
    const { size, kind, ori } = ship;
    const A = size * 100;
    const p = (a, x) => (ori === 'h' ? `${a} ${x}` : `${x} ${a}`);
    const vb = ori === 'h' ? `0 0 ${A} 100` : `0 0 100 ${A}`;
    const bowBase = A - 30, bend = A - 6, tip = A - 1;
    const hull = `M ${p(15, 30)} L ${p(bowBase, 30)} Q ${p(bend, 34)} ${p(tip, 50)} `
               + `Q ${p(bend, 66)} ${p(bowBase, 70)} L ${p(15, 70)} Q ${p(2, 50)} ${p(15, 30)} Z`;
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
      const bridge = rect(A * 0.30, 38, Math.min(26, A * 0.22), 24);
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
.bs-wrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;padding:14px 8px;overflow:hidden;border-radius:18px}
.bs-ocean{position:absolute;inset:0;z-index:0;overflow:hidden;border-radius:18px;
  background:linear-gradient(180deg,#0c3450 0%,#0a2c46 45%,#072134 100%)}
.bs-ocean::before,.bs-ocean::after{content:'';position:absolute;inset:-30%;
  background:
   radial-gradient(ellipse 40% 18% at 20% 30%,rgba(120,190,235,.10),transparent 60%),
   radial-gradient(ellipse 45% 16% at 75% 55%,rgba(120,190,235,.08),transparent 60%),
   repeating-linear-gradient(100deg,rgba(255,255,255,.025) 0 2px,transparent 2px 26px);
  animation:bs-drift 16s linear infinite}
.bs-ocean::after{animation-duration:26s;animation-direction:reverse;opacity:.6}
@keyframes bs-drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(-60px,18px,0)}}
.bs-wrap>*:not(.bs-ocean){position:relative;z-index:1}
.bs-title{font-family:var(--font-head,inherit);font-size:1.4rem;font-weight:900;color:#fff;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,.5)}
.bs-hint{font-size:.82rem;color:#bcd6ea;text-align:center;max-width:460px;min-height:18px}
.bs-board-lbl{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9fc0d8;margin-bottom:4px;text-align:center}
.bs-board{position:relative;display:grid;grid-template-columns:repeat(${N},1fr);grid-template-rows:repeat(${N},1fr);
  width:min(92vw,392px);aspect-ratio:1;gap:0;padding:0;border-radius:8px;overflow:hidden;
  background:linear-gradient(160deg,rgba(10,34,54,.65),rgba(8,26,43,.65));
  box-shadow:0 10px 34px rgba(0,0,0,.45),inset 0 0 0 1px rgba(140,180,220,.22);touch-action:none}
.bs-board.glow{box-shadow:0 10px 34px rgba(0,0,0,.45),inset 0 0 0 1px rgba(140,180,220,.22),0 0 0 2px rgba(120,200,255,.35),0 0 22px rgba(80,160,240,.35)}
.bs-cell{position:relative;background:transparent;display:flex;align-items:center;justify-content:center;
  border:none;padding:0;margin:0;color:#cfe;box-shadow:inset 0 0 0 .5px rgba(120,150,190,.14);-webkit-tap-highlight-color:transparent}
.bs-board.enemy.armed .bs-cell:not(.shot){cursor:crosshair}
.bs-board.enemy.armed .bs-cell:not(.shot):hover{background:rgba(124,160,210,.18);box-shadow:inset 0 0 0 1.5px rgba(160,200,255,.55)}
.bs-cell.miss::after{content:'';position:absolute;width:24%;height:24%;border-radius:50%;
  background:radial-gradient(circle at 40% 35%,#aecbe6,#5b7da0);box-shadow:0 0 6px rgba(140,180,220,.5)}
.bs-layer{position:absolute;inset:0;pointer-events:none}
.bs-hull-layer .bs-hull{position:absolute;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.bs-hull-svg{width:100%;height:100%;display:block}
.bs-hull.sunk{filter:grayscale(.6) brightness(.6) drop-shadow(0 1px 2px rgba(0,0,0,.5))}
.bs-hull.enter{animation:bs-reveal .4s ease both}
@keyframes bs-reveal{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
.bs-hull.bs-sink{animation:bs-sink 1.1s ease-in forwards}
@keyframes bs-sink{0%{transform:rotate(0) translateY(0)}35%{transform:rotate(-4deg) translateY(1px)}100%{transform:rotate(7deg) translateY(7px);opacity:.55;filter:grayscale(.7) brightness(.45)}}
.bs-dmg{position:absolute;display:flex;align-items:center;justify-content:center;font-size:clamp(10px,2.9vw,17px);line-height:1}
.bs-dmg.hit::after{content:'🔥';filter:drop-shadow(0 0 4px rgba(255,140,40,.8))}
.bs-dmg.sunk::after{content:'✖';color:#ff7a5c;font-weight:900;text-shadow:0 0 6px rgba(255,90,50,.9)}
/* firing FX */
.bs-fx{position:absolute;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:3}
.bs-fx .bomb{width:42%;height:42%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#5a6470,#1b2026);
  box-shadow:0 3px 6px rgba(0,0,0,.5);animation:bs-drop .34s cubic-bezier(.55,0,.85,.5) forwards}
@keyframes bs-drop{0%{transform:translateY(-820%) scale(.7);opacity:0}15%{opacity:1}100%{transform:translateY(0) scale(1)}}
.bs-fx .splash{position:absolute;width:14%;height:14%;border-radius:50%;border:3px solid rgba(180,215,245,.95);animation:bs-splash .5s ease-out forwards}
.bs-fx .splash.s2{animation-delay:.08s}
@keyframes bs-splash{0%{width:8%;height:8%;opacity:0}25%{opacity:1}100%{width:170%;height:170%;opacity:0;border-width:1px}}
.bs-fx .boom{position:absolute;width:34%;height:34%;border-radius:50%;
  background:radial-gradient(circle,#fff 0%,#ffd24a 28%,#ff7b2e 55%,rgba(255,80,30,0) 72%);animation:bs-boom .5s ease-out forwards}
@keyframes bs-boom{0%{transform:scale(.2);opacity:1}60%{opacity:1}100%{transform:scale(2.8);opacity:0}}
.bs-fx .ring{position:absolute;width:20%;height:20%;border-radius:50%;border:3px solid rgba(255,170,70,.9);animation:bs-ring .55s ease-out forwards}
@keyframes bs-ring{0%{transform:scale(.3);opacity:.9}100%{transform:scale(3.4);opacity:0}}
.bs-fx .spark{position:absolute;width:7%;height:7%;border-radius:50%;background:#ffd98a;animation:bs-spark .5s ease-out forwards}
@keyframes bs-spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}
/* placement tray + drag */
.bs-place-layout{display:flex;gap:16px;align-items:flex-start;justify-content:center;flex-wrap:wrap}
.bs-tray{display:flex;flex-direction:column;gap:9px;min-width:140px;background:rgba(6,22,36,.5);border:1px solid rgba(140,180,220,.16);border-radius:12px;padding:10px}
.bs-tray-title{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:#9fc0d8;text-align:center}
.bs-tray-ship{display:flex;align-items:center;gap:8px;cursor:grab;padding:5px 7px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(140,180,220,.14);transition:background .15s,transform .1s;touch-action:none}
.bs-tray-ship:hover{background:rgba(120,180,235,.14)}
.bs-tray-ship:active{cursor:grabbing}
.bs-tray-ship.placed{opacity:.32;pointer-events:none;filter:grayscale(.6)}
.bs-tray-hull{position:relative;height:18px;flex:0 0 auto}
.bs-tray-meta{display:flex;flex-direction:column;line-height:1.1}
.bs-tray-name{font-size:.74rem;font-weight:700;color:#dceaf6}
.bs-tray-size{font-size:.62rem;color:#9fc0d8}
.bs-drag-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.92;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5));transition:none}
.bs-preview{border-radius:6px}
.bs-board .bs-cell.pickable{cursor:grab}
/* fleet chips, controls, end */
.bs-fleet{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:.7rem;margin-top:6px}
.bs-fleet-item{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;background:rgba(8,26,43,.6);border:1px solid rgba(140,180,220,.2);color:#cfe1f0}
.bs-fleet-item.sunk{opacity:.5;text-decoration:line-through}
.bs-ctrls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.bs-btn{background:rgba(8,26,43,.7);border:1px solid rgba(140,180,220,.25);color:#dceaf6;border-radius:9px;padding:9px 16px;font:inherit;font-size:.84rem;font-weight:700;cursor:pointer;transition:all .15s}
.bs-btn:hover{border-color:rgba(120,200,255,.6);color:#fff}
.bs-btn.primary{background:linear-gradient(135deg,#1b7ce0,#0ea5e9);color:#fff;border:none}
.bs-btn.primary:hover{filter:brightness(1.08)}
.bs-btn:disabled{opacity:.4;cursor:default}
.bs-iconbtn{background:rgba(8,26,43,.7);border:1px solid rgba(140,180,220,.25);color:#dceaf6;border-radius:9px;width:38px;height:38px;cursor:pointer;font-size:1rem}
.bs-end{text-align:center;padding:18px;display:flex;flex-direction:column;gap:12px;align-items:center}
.bs-end-emo{font-size:3rem}
.bs-end-title{font-size:1.5rem;font-weight:900;color:#fff}
.bs-grids{display:flex;flex-direction:column;gap:16px;align-items:center;width:100%}
@media (min-width:760px){.bs-grids{flex-direction:row;justify-content:center;align-items:flex-start;gap:26px}}
@media (prefers-reduced-motion:reduce){.bs-fx *,.bs-hull.enter,.bs-hull.bs-sink,.bs-ocean::before,.bs-ocean::after{animation:none!important}}`;
    document.head.appendChild(s);
  }

  /* ── init / placement ───────────────────────────────────────────── */
  function init(r) { root = r; if (!root) return; injectCSS(); startPlacement(); }

  function startPlacement() {
    phase = 'place'; placeOri = 'h'; drag = null; justSunk = null;
    player = newBoard(); enemy = newBoard();
    shotsFired = 0; hitsLanded = 0; locked = false;
    renderPlacement();
  }

  function renderPlacement() {
    const placedSet = placedFleetIdxs();
    root.innerHTML = `
      <div class="bs-wrap">
        <div class="bs-ocean"></div>
        <div class="bs-title">🚢 Posiciona a tua frota</div>
        <div class="bs-hint" id="bs-hint">Arrasta os navios para a tua água. Botão <b>Rodar</b> (ou duplo-clique) para virar; clica num navio já colocado para o mover.</div>
        <div id="bs-diff" style="display:flex;justify-content:center;margin:0 0 .6rem"></div>
        <div class="bs-place-layout">
          <div style="display:flex;flex-direction:column;align-items:center">
            <div class="bs-board-lbl">A tua água</div>
            <div class="bs-board" id="bs-place"></div>
          </div>
          <div class="bs-tray" id="bs-tray">
            <div class="bs-tray-title">Frota</div>
            ${FLEET.map((sh, fi) => `
              <div class="bs-tray-ship${placedSet.has(fi) ? ' placed' : ''}" data-fleet="${fi}">
                <div class="bs-tray-hull" style="width:${sh.size * 18}px">${hullSVG({ size: sh.size, kind: sh.kind, ori: 'h' })}</div>
                <div class="bs-tray-meta"><span class="bs-tray-name">${sh.name}</span><span class="bs-tray-size">${sh.size} células</span></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="bs-ctrls">
          <button class="bs-btn" id="bs-rotate">🔄 Rodar: ${placeOri === 'h' ? 'horizontal ↔' : 'vertical ↕'}</button>
          <button class="bs-btn" id="bs-random">🎲 Aleatório</button>
          <button class="bs-btn" id="bs-clear">🗑 Limpar</button>
          <button class="bs-btn primary" id="bs-start" ${allPlaced() ? '' : 'disabled'}>⚔ Começar</button>
        </div>
      </div>`;
    if (typeof GameHost !== 'undefined' && GameHost.diffSeg)
      root.querySelector('#bs-diff').appendChild(GameHost.diffSeg('battleship'));
    drawPlaceBoard();
    root.querySelector('#bs-rotate').addEventListener('click', () => {
      placeOri = placeOri === 'h' ? 'v' : 'h'; sfx.rotate(); renderPlacement();
    });
    root.querySelector('#bs-random').addEventListener('click', () => { randomFleet(player); sfx.place(); renderPlacement(); });
    root.querySelector('#bs-clear').addEventListener('click', () => { player = newBoard(); renderPlacement(); });
    root.querySelector('#bs-start').addEventListener('click', beginBattle);

    /* tray drag starts */
    root.querySelectorAll('.bs-tray-ship:not(.placed)').forEach(el => {
      el.addEventListener('pointerdown', e => startDrag(e, +el.dataset.fleet, placeOri, false));
    });
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
    /* pick a placed ship back up by pressing on its hull */
    bd.querySelectorAll('.bs-cell').forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c;
      el.addEventListener('pointerdown', e => {
        const idx = player.occ[r][c];
        if (idx === -1 || drag) return;
        const ship = player.ships[idx];
        liftShip(idx);
        startDrag(e, ship.fleetIdx, ship.ori, true);
      });
    });
  }

  function liftShip(idx) {
    const ship = player.ships[idx];
    if (!ship) return;
    ship.cells.forEach(cell => { player.occ[cell.r][cell.c] = -1; });
    player.ships.splice(idx, 1);
    /* reindex occ for ships after the removed one */
    player.occ = Array.from({ length: N }, () => Array(N).fill(-1));
    player.ships.forEach((s, i) => s.cells.forEach(cell => { player.occ[cell.r][cell.c] = i; }));
    drawPlaceBoard();
    refreshTray();
  }

  function refreshTray() {
    const placedSet = placedFleetIdxs();
    root.querySelectorAll('.bs-tray-ship').forEach(el => {
      const fi = +el.dataset.fleet;
      el.classList.toggle('placed', placedSet.has(fi));
    });
    const startBtn = root.querySelector('#bs-start');
    if (startBtn) startBtn.disabled = !allPlaced();
  }

  /* ── drag & drop ────────────────────────────────────────────────── */
  function startDrag(e, fleetIdx, ori, fromBoard) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const sh = FLEET[fleetIdx];
    drag = { fleetIdx, ori, fromBoard, size: sh.size, kind: sh.kind, ghost: null };
    const ghost = document.createElement('div');
    ghost.className = 'bs-drag-ghost';
    drag.ghost = ghost;
    document.body.appendChild(ghost);
    sizeGhost();
    moveGhost(e.clientX, e.clientY);
    const bd = root.querySelector('#bs-place'); if (bd) bd.classList.add('glow');

    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    setHint('A posicionar… solta sobre a tua água. Botão Rodar para virar.');
  }
  function cellPx() { const bd = root.querySelector('#bs-place'); return bd ? bd.getBoundingClientRect().width / N : 30; }
  function sizeGhost() {
    if (!drag || !drag.ghost) return;
    const cp = cellPx();
    const w = (drag.ori === 'h' ? drag.size : 1) * cp;
    const h = (drag.ori === 'h' ? 1 : drag.size) * cp;
    drag.ghost.style.width = w + 'px';
    drag.ghost.style.height = h + 'px';
    drag.ghost.innerHTML = hullSVG({ size: drag.size, kind: drag.kind, ori: drag.ori });
  }
  function moveGhost(x, y) {
    if (!drag || !drag.ghost) return;
    const cp = cellPx();
    drag.ghost.style.left = (x - cp / 2) + 'px';
    drag.ghost.style.top = (y - cp / 2) + 'px';
  }
  function boardCellAt(x, y) {
    const bd = root.querySelector('#bs-place'); if (!bd) return null;
    const r = bd.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    const c = Math.floor((x - r.left) / r.width * N);
    const row = Math.floor((y - r.top) / r.height * N);
    return { r: Math.max(0, Math.min(N - 1, row)), c: Math.max(0, Math.min(N - 1, c)) };
  }
  function onDragMove(e) {
    if (!drag) return;
    moveGhost(e.clientX, e.clientY);
    const fx = root.querySelector('#bs-place .bs-fx-layer'); if (fx) clearPreview();
    const cell = boardCellAt(e.clientX, e.clientY);
    if (cell && fx) {
      const ok = canPlace(player, cell.r, cell.c, drag.size, drag.ori);
      const ghost = document.createElement('div');
      ghost.className = 'bs-preview';
      Object.assign(ghost.style, rectStyle(cell.r, cell.c, drag.size, drag.ori));
      ghost.style.background = ok ? 'rgba(110,200,150,.45)' : 'rgba(220,80,80,.5)';
      ghost.style.outline = '2px solid ' + (ok ? 'rgba(150,255,200,.85)' : 'rgba(255,120,120,.85)');
      fx.appendChild(ghost);
    }
  }
  function onDragUp(e) {
    if (!drag) return;
    const cell = boardCellAt(e.clientX, e.clientY);
    const d = drag;
    endDrag();
    if (cell && canPlace(player, cell.r, cell.c, d.size, d.ori)) {
      const sh = FLEET[d.fleetIdx];
      placeShip(player, cell.r, cell.c, d.size, d.ori, Object.assign({ fleetIdx: d.fleetIdx }, sh));
      sfx.place();
    }
    renderPlacement();
  }
  function endDrag() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    if (drag && drag.ghost) drag.ghost.remove();
    const bd = root.querySelector('#bs-place'); if (bd) bd.classList.remove('glow');
    clearPreview();
    drag = null;
  }
  function clearPreview() { root.querySelectorAll('#bs-place .bs-preview').forEach(el => el.remove()); }

  /* keyboard rotate while dragging */
  document.addEventListener('keydown', e => {
    if (drag && (e.key === 'r' || e.key === 'R')) { drag.ori = drag.ori === 'h' ? 'v' : 'h'; placeOri = drag.ori; sizeGhost(); sfx.rotate(); }
  });

  /* ── battle ─────────────────────────────────────────────────────── */
  function beginBattle() {
    if (!allPlaced()) return;
    randomFleet(enemy);
    phase = 'battle'; turn = 'player'; locked = false; justSunk = null;
    ai = { view: Array.from({ length: N }, () => Array(N).fill('unknown')), activeHits: [], remaining: FLEET.map(s => s.size) };
    renderBattle();
  }

  function shipsLeft(board) { return board.ships.filter(s => s.hits < s.size).length; }

  function renderBattle() {
    root.innerHTML = `
      <div class="bs-wrap">
        <div class="bs-ocean"></div>
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
          <button class="bs-iconbtn" id="bs-sound" title="Som">${muted() ? '🔇' : '🔊'}</button>
        </div>
      </div>`;
    root.querySelector('#bs-new').addEventListener('click', startPlacement);
    const snd = root.querySelector('#bs-sound');
    snd.addEventListener('click', () => { if (typeof GameAudio !== 'undefined') GameAudio.setMuted(!GameAudio.muted); snd.textContent = muted() ? '🔇' : '🔊'; });
    drawEnemyBoard();
    drawSelfBoard();
    drawFleets();
  }

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

  function drawOverlays(bd, board, reveal, animateReveal) {
    const hl = bd.querySelector('.bs-hull-layer'), fx = bd.querySelector('.bs-fx-layer');
    if (!hl) return;
    hl.innerHTML = '';
    board.ships.forEach(ship => {
      const sunk = ship.hits >= ship.size;
      if (reveal(ship)) {
        const first = ship.cells[0];
        const el = document.createElement('div');
        el.className = 'bs-hull' + (sunk ? ' sunk' : '') + (animateReveal ? ' enter' : '') + (ship === justSunk ? ' bs-sink' : '');
        Object.assign(el.style, rectStyle(first.r, first.c, ship.size, ship.ori));
        el.innerHTML = hullSVG(ship);
        hl.appendChild(el);
      }
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
    drawOverlays(bd, enemy, ship => ship.hits >= ship.size, false);
  }

  function drawSelfBoard() {
    const bd = root.querySelector('#bs-self'); if (!bd) return;
    bd.innerHTML = cellsHTML(false);
    bd.querySelectorAll('.bs-cell').forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c;
      if (player.shot[r][c]) { el.classList.add('shot'); if (player.occ[r][c] === -1) el.classList.add('miss'); }
    });
    drawOverlays(bd, player, () => true, false);
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
    sfx.launch();
    if (!fx || reduceMotion()) { if (hit) sfx.hit(); else sfx.splash(); if (sunk) sfx.sunk(); cb(); return; }
    const wrap = document.createElement('div');
    wrap.className = 'bs-fx';
    Object.assign(wrap.style, cellStyle(r, c));
    wrap.innerHTML = '<div class="bomb"></div>';
    fx.appendChild(wrap);
    setTimeout(() => {
      wrap.querySelector('.bomb')?.remove();
      if (hit) {
        sfx.hit();
        wrap.insertAdjacentHTML('beforeend', '<div class="boom"></div><div class="ring"></div>');
        for (let i = 0; i < 7; i++) {
          const sp = document.createElement('div'); sp.className = 'spark';
          const ang = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
          sp.style.setProperty('--dx', Math.cos(ang) * d + '%');
          sp.style.setProperty('--dy', Math.sin(ang) * d + '%');
          wrap.appendChild(sp);
        }
      } else {
        sfx.splash();
        wrap.insertAdjacentHTML('beforeend', '<div class="splash"></div><div class="splash s2"></div>');
      }
      if (sunk) sfx.sunk();
      setTimeout(() => { wrap.remove(); cb(); }, 540);
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
      if (ship.hits >= ship.size) { sunk = true; justSunk = ship; }
    }
    playFireFX(bd, r, c, hit, sunk, () => {
      drawEnemyBoard(); drawFleets(); justSunk = null;
      if (shipsLeft(enemy) === 0) return endGame(true);
      setHint(hit ? (sunk ? '💥 Afundaste um navio!' : '🎯 Acertaste! Vez do inimigo…') : '💧 Água. Vez do inimigo…');
      turn = 'enemy';
      setTimeout(enemyFire, hit ? 560 : 380);
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
    return hardDensity();
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
        sunk = true; justSunk = ship;
        ship.cells.forEach(cell => { ai.view[cell.r][cell.c] = 'sunk'; });
        ai.activeHits = ai.activeHits.filter(h => player.occ[h.r][h.c] !== idx);
        const i = ai.remaining.indexOf(ship.size); if (i !== -1) ai.remaining.splice(i, 1);
      }
    } else {
      ai.view[r][c] = 'miss';
    }
    playFireFX(bd, r, c, hit, sunk, () => {
      drawSelfBoard(); drawFleets(); justSunk = null;
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
      <div class="bs-wrap"><div class="bs-ocean"></div><div class="bs-end">
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
