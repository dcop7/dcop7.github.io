/* ══════════════════════════════════════════════════════════════════
   BattleshipGame — classic 10×10 Batalha Naval, fully offline.
   Placement phase (tap + rotate + auto) then alternating fire.
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
    { name: 'Porta-aviões', size: 5 },
    { name: 'Couraçado',    size: 4 },
    { name: 'Cruzador',     size: 3 },
    { name: 'Submarino',    size: 3 },
    { name: 'Lancha',       size: 2 },
  ];

  let root, phase, player, enemy, turn, placeIdx, placeOri, ai, shotsFired, hitsLanded;

  function diff() {
    try { if (typeof GameHost !== 'undefined' && GameHost.getDifficulty) return GameHost.getDifficulty(); } catch (e) {}
    const d = localStorage.getItem('quiz-difficulty');
    return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
  }

  /* ── board model ────────────────────────────────────────────────── */
  function newBoard() {
    return {
      occ: Array.from({ length: N }, () => Array(N).fill(-1)),   /* ship index or -1 */
      shot: Array.from({ length: N }, () => Array(N).fill(false)),
      ships: [],   /* {name,size,cells:[{r,c}],hits} */
    };
  }
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
  function key(r, c) { return r + ',' + c; }

  function canPlace(board, r, c, size, ori) {
    for (let k = 0; k < size; k++) {
      const rr = ori === 'v' ? r + k : r, cc = ori === 'h' ? c + k : c;
      if (!inB(rr, cc) || board.occ[rr][cc] !== -1) return false;
    }
    return true;
  }
  function placeShip(board, r, c, size, ori, name) {
    const cells = [];
    for (let k = 0; k < size; k++) {
      const rr = ori === 'v' ? r + k : r, cc = ori === 'h' ? c + k : c;
      board.occ[rr][cc] = board.ships.length;
      cells.push({ r: rr, c: cc });
    }
    board.ships.push({ name, size, cells, hits: 0 });
  }
  function randomFleet(board) {
    board.occ = Array.from({ length: N }, () => Array(N).fill(-1));
    board.ships = [];
    FLEET.forEach(sh => {
      let placed = false, guard = 0;
      while (!placed && guard++ < 1000) {
        const ori = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
        if (canPlace(board, r, c, sh.size, ori)) { placeShip(board, r, c, sh.size, ori, sh.name); placed = true; }
      }
    });
  }

  /* ── CSS ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('bs-css')) return;
    const s = document.createElement('style'); s.id = 'bs-css';
    s.textContent = `
.bs-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0}
.bs-title{font-family:var(--font-head,inherit);font-size:1.4rem;font-weight:900;color:var(--text,#fff);text-align:center}
.bs-hint{font-size:.82rem;color:var(--muted,#9aa);text-align:center;max-width:440px;min-height:18px}
.bs-board-lbl{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9aa);margin-bottom:2px}
.bs-board{display:grid;grid-template-columns:repeat(${N},1fr);width:min(94vw,400px);aspect-ratio:1;gap:2px;background:rgba(120,140,180,.22);padding:2px;border-radius:8px;touch-action:manipulation}
.bs-board.enemy.armed .bs-cell:not(.shot){cursor:crosshair}
.bs-cell{position:relative;background:#0e2236;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:clamp(11px,3vw,17px);border:none;padding:0;color:#cfe;-webkit-tap-highlight-color:transparent}
.bs-cell.water{background:#10314e}
.bs-cell.ship{background:#43597a}
.bs-cell.preview{background:#5b7aa8}
.bs-cell.invalid{background:#7a3a3a}
.bs-cell.miss::after{content:'';width:26%;height:26%;border-radius:50%;background:#6c89a8}
.bs-cell.hit{background:#b3402f}
.bs-cell.hit::after{content:'✸';color:#ffe3c2}
.bs-cell.sunk{background:#5a1d16}
.bs-cell.sunk::after{content:'✸';color:#ff8a6a}
.bs-fleet{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:.7rem}
.bs-fleet-item{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd)}
.bs-fleet-item.sunk{opacity:.5;text-decoration:line-through}
.bs-ctrls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.bs-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:9px;padding:9px 16px;font:inherit;font-size:.84rem;font-weight:700;cursor:pointer;transition:all .15s}
.bs-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5);color:var(--accent,#a98bff)}
.bs-btn.primary{background:linear-gradient(135deg,var(--accent,#7c5cff),#a855f7);color:#fff;border:none}
.bs-btn:disabled{opacity:.4;cursor:default}
.bs-end{text-align:center;padding:18px;display:flex;flex-direction:column;gap:12px;align-items:center}
.bs-end-emo{font-size:3rem}
.bs-end-title{font-size:1.5rem;font-weight:900;color:var(--text,#fff)}
.bs-grids{display:flex;flex-direction:column;gap:14px;align-items:center;width:100%}
@media (min-width:720px){.bs-grids{flex-direction:row;justify-content:center;align-items:flex-start;gap:24px}}`;
    document.head.appendChild(s);
  }

  /* ── init / placement ───────────────────────────────────────────── */
  function init(r) { root = r; if (!root) return; injectCSS(); startPlacement(); }

  function startPlacement() {
    phase = 'place'; placeIdx = 0; placeOri = 'h';
    player = newBoard(); enemy = newBoard();
    shotsFired = 0; hitsLanded = 0;
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

  function drawPlaceBoard() {
    const bd = root.querySelector('#bs-place'); if (!bd) return;
    let html = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const occ = player.occ[r][c] !== -1;
      html += `<button class="bs-cell ${occ ? 'ship' : 'water'}" data-r="${r}" data-c="${c}" aria-label="${String.fromCharCode(65 + c)}${r + 1}"></button>`;
    }
    bd.innerHTML = html;
    bd.querySelectorAll('.bs-cell').forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c;
      el.addEventListener('click', () => onPlace(r, c));
      el.addEventListener('mouseenter', () => previewPlace(r, c));
      el.addEventListener('mouseleave', clearPreview);
    });
  }

  function previewPlace(r, c) {
    if (placeIdx >= FLEET.length) return;
    const ship = FLEET[placeIdx];
    const ok = canPlace(player, r, c, ship.size, placeOri);
    for (let k = 0; k < ship.size; k++) {
      const rr = placeOri === 'v' ? r + k : r, cc = placeOri === 'h' ? c + k : c;
      if (!inB(rr, cc)) continue;
      const el = root.querySelector(`#bs-place .bs-cell[data-r="${rr}"][data-c="${cc}"]`);
      if (el && !el.classList.contains('ship')) el.classList.add(ok ? 'preview' : 'invalid');
    }
  }
  function clearPreview() {
    root.querySelectorAll('#bs-place .bs-cell.preview,#bs-place .bs-cell.invalid')
      .forEach(el => el.classList.remove('preview', 'invalid'));
  }

  function onPlace(r, c) {
    if (placeIdx >= FLEET.length) return;
    const ship = FLEET[placeIdx];
    if (!canPlace(player, r, c, ship.size, placeOri)) {
      const h = root.querySelector('#bs-hint'); if (h) { h.textContent = 'Posição inválida — sai do tabuleiro ou sobrepõe outro navio.'; }
      return;
    }
    placeShip(player, r, c, ship.size, placeOri, ship.name);
    placeIdx++;
    renderPlacement();
  }

  /* ── battle ─────────────────────────────────────────────────────── */
  function beginBattle() {
    if (player.ships.length < FLEET.length) return;
    randomFleet(enemy);
    phase = 'battle'; turn = 'player';
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

  function drawEnemyBoard() {
    const bd = root.querySelector('#bs-enemy'); if (!bd) return;
    let html = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const sh = enemy.shot[r][c];
      const idx = enemy.occ[r][c];
      let cls = 'bs-cell', extra = '';
      if (sh) {
        if (idx !== -1) { cls += enemy.ships[idx].hits >= enemy.ships[idx].size ? ' sunk' : ' hit'; }
        else cls += ' miss';
      }
      html += `<button class="${cls}" data-r="${r}" data-c="${c}" aria-label="${String.fromCharCode(65 + c)}${r + 1}${sh ? (idx !== -1 ? ' acerto' : ' água') : ''}"></button>`;
    }
    bd.innerHTML = html;
    bd.querySelectorAll('.bs-cell').forEach(el => el.addEventListener('click', () => playerFire(+el.dataset.r, +el.dataset.c)));
  }

  function drawSelfBoard() {
    const bd = root.querySelector('#bs-self'); if (!bd) return;
    let html = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const idx = player.occ[r][c];
      const sh = player.shot[r][c];
      let cls = 'bs-cell ' + (idx !== -1 ? 'ship' : 'water');
      if (sh) cls = 'bs-cell ' + (idx !== -1 ? (player.ships[idx].hits >= player.ships[idx].size ? 'sunk' : 'hit') : 'miss');
      html += `<div class="${cls}"></div>`;
    }
    bd.innerHTML = html;
  }

  function drawFleets() {
    const ef = root.querySelector('#bs-enemy-fleet'), sf = root.querySelector('#bs-self-fleet');
    const mk = b => b.ships.map(s => `<span class="bs-fleet-item${s.hits >= s.size ? ' sunk' : ''}">${s.size}</span>`).join('');
    if (ef) ef.innerHTML = mk(enemy);
    if (sf) sf.innerHTML = mk(player);
  }

  function setHint(t) { const h = root.querySelector('#bs-hint'); if (h) h.innerHTML = t; }
  function setArmed(on) { const e = root.querySelector('#bs-enemy'); if (e) e.classList.toggle('armed', on); }

  function playerFire(r, c) {
    if (phase !== 'battle' || turn !== 'player' || enemy.shot[r][c]) return;
    enemy.shot[r][c] = true;
    shotsFired++;
    const idx = enemy.occ[r][c];
    let sunk = false, hit = idx !== -1;
    if (hit) {
      hitsLanded++;
      const ship = enemy.ships[idx]; ship.hits++;
      if (ship.hits >= ship.size) sunk = true;
    }
    drawEnemyBoard(); drawFleets();
    if (shipsLeft(enemy) === 0) return endGame(true);
    setHint(hit ? (sunk ? `💥 Afundaste um navio!` : '🎯 Acertaste! Continua.') : '💧 Água. Vez do inimigo…');
    /* strict alternation */
    turn = 'enemy'; setArmed(false);
    setTimeout(enemyFire, hit ? 650 : 450);
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
          /* When we have live hits, only reward placements that explain them. */
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
    player.shot[r][c] = true;
    const idx = player.occ[r][c];
    if (idx !== -1) {
      ai.view[r][c] = 'hit';
      ai.activeHits.push({ r, c });
      const ship = player.ships[idx]; ship.hits++;
      if (ship.hits >= ship.size) {
        ship.cells.forEach(cell => { ai.view[cell.r][cell.c] = 'sunk'; });
        ai.activeHits = ai.activeHits.filter(h => player.occ[h.r][h.c] !== idx);
        const i = ai.remaining.indexOf(ship.size); if (i !== -1) ai.remaining.splice(i, 1);
      }
    } else {
      ai.view[r][c] = 'miss';
    }
    drawSelfBoard(); drawFleets();
    if (shipsLeft(player) === 0) return endGame(false);
    turn = 'player'; setArmed(true);
    setHint('A tua vez — dispara no tabuleiro inimigo.');
  }

  function endGame(playerWon) {
    phase = 'over';
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
