/* ══════════════════════════════════════════════════════════════════
   Sudoku — gerador próprio com solução ÚNICA garantida (backtracking
   com máscaras de bits + célula mais restrita primeiro; remove pistas
   aos pares simétricos e só aceita se continuar a haver uma solução).
   Notas a lápis, pistas limitadas, desfazer, limite de erros por
   dificuldade, destaque de linha/coluna/caixa e do mesmo algarismo,
   Sudoku do dia (igual para todos) e partida guardada para continuar.
══════════════════════════════════════════════════════════════════ */
const SudokuGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const ID = 'sudoku';
  const DIFF = {
    easy:   { clues: 40, hints: 5, errors: 0, label: 'Fácil' },
    medium: { clues: 32, hints: 3, errors: 5, label: 'Médio' },
    hard:   { clues: 26, hints: 1, errors: 3, label: 'Difícil' },
  };
  const clock = v => { v = Math.round(v); const m = Math.floor(v / 60), s = v % 60; return m ? m + ':' + String(s).padStart(2, '0') : s + 's'; };
  const store = () => (typeof GameProgress !== 'undefined' ? GameProgress.store(ID) : { getPref: (k, d) => d, setPref: () => {} });
  const BOX = i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9), c = i % 9, b = BOX(i), s = new Set();
    for (let k = 0; k < 81; k++) if (k !== i && (Math.floor(k / 9) === r || k % 9 === c || BOX(k) === b)) s.add(k);
    return [...s];
  });

  /* ── solucionador: conta soluções até `limit`; se `out`, guarda a 1.ª ── */
  function solve(grid, limit, rnd, out) {
    const g = grid.slice(), R = new Array(9).fill(0), C = new Array(9).fill(0), B = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) if (g[i]) { const m = 1 << g[i]; R[Math.floor(i / 9)] |= m; C[i % 9] |= m; B[BOX(i)] |= m; }
    let count = 0;
    const order = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    function rec() {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const used = R[Math.floor(i / 9)] | C[i % 9] | B[BOX(i)];
        let n = 0; for (let d = 1; d <= 9; d++) if (!(used & (1 << d))) n++;
        if (n < bestN) { bestN = n; best = i; bestMask = used; if (n <= 1) break; }
      }
      if (best < 0) { count++; if (out && count === 1) for (let i = 0; i < 81; i++) out[i] = g[i]; return count >= limit; }
      if (bestN === 0) return false;
      const ds = rnd ? order.slice().sort(() => rnd() - .5) : order;
      const r = Math.floor(best / 9), c = best % 9, b = BOX(best);
      for (const d of ds) {
        const m = 1 << d; if (bestMask & m) continue;
        g[best] = d; R[r] |= m; C[c] |= m; B[b] |= m;
        if (rec()) return true;
        g[best] = 0; R[r] &= ~m; C[c] &= ~m; B[b] &= ~m;
      }
      return false;
    }
    rec();
    return count;
  }

  function generate(diff, seed) {
    const rnd = (typeof GameProgress !== 'undefined' && seed != null) ? GameProgress.rng(seed) : Math.random;
    const sol = new Array(81).fill(0);
    solve(new Array(81).fill(0), 1, rnd, sol);
    const puz = sol.slice(), target = DIFF[diff].clues;
    const cells = [...Array(41).keys()].sort(() => rnd() - .5);   /* metade + centro: remoção simétrica */
    let clues = 81;
    for (const i of cells) {
      if (clues <= target) break;
      const j = 80 - i, a = puz[i], b = puz[j];
      puz[i] = 0; puz[j] = 0;
      if (solve(puz, 2) !== 1) { puz[i] = a; puz[j] = b; continue; }
      clues -= i === j ? 1 : 2;
    }
    return { puz, sol };
  }

  /* ── partida ── */
  function setup(api, o) {
    let mode = o.mode || 'classic', saved = null;
    if (mode === 'resume') { saved = store().getPref('save', null); if (saved) { mode = saved.mode; api.setMode(mode, saved.diff); } else mode = 'classic'; }
    const diff = saved ? saved.diff : (o.diff || 'medium');
    const G = { mode, diff, cfg: DIFF[diff] || DIFF.medium, t: 0, err: 0, hints: 0, sel: -1, notes: false, hist: [], over: false, api };
    if (saved) Object.assign(G, { puz: saved.puz, sol: saved.sol, val: saved.val, nts: saved.nts, t: saved.t, err: saved.err, hints: saved.hints });
    else {
      const seed = mode === 'daily' && typeof GameProgress !== 'undefined' ? GameProgress.dailySeed('sudoku-' + diff) : null;
      const g = generate(diff, seed);
      G.puz = g.puz; G.sol = g.sol; G.val = g.puz.slice(); G.nts = new Array(81).fill(0);
    }
    build(G, api);
    return G;
  }

  function save(G) {
    if (G.over) { store().setPref('save', null); return; }
    store().setPref('save', { mode: G.mode, diff: G.diff, puz: G.puz, sol: G.sol, val: G.val, nts: G.nts, t: Math.round(G.t), err: G.err, hints: G.hints, day: typeof GameProgress !== 'undefined' ? GameProgress.todayKey() : '' });
  }

  function build(G, api) {
    injectCSS();
    const L = api.layer;
    L.innerHTML = `
      <div class="sdk">
        <div class="sdk-grid" role="grid" aria-label="Grelha de Sudoku">
          ${Array.from({ length: 81 }, (_, i) => `<div class="sdk-c${i % 9 === 2 || i % 9 === 5 ? ' br' : ''}${Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? ' bb' : ''}" data-i="${i}" role="gridcell"></div>`).join('')}
        </div>
        <div class="sdk-tools">
          <button type="button" data-t="undo">↶<small>Desfazer</small></button>
          <button type="button" data-t="erase">⌫<small>Apagar</small></button>
          <button type="button" data-t="notes">✏️<small>Notas <b>off</b></small></button>
          <button type="button" data-t="hint">💡<small>Pista <b></b></small></button>
        </div>
        <div class="sdk-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button type="button" data-d="${d}">${d}<small></small></button>`).join('')}</div>
      </div>`;
    G.el = { root: L.querySelector('.sdk'), grid: L.querySelector('.sdk-grid'), cells: [...L.querySelectorAll('.sdk-c')], pad: L.querySelector('.sdk-pad'), tools: L.querySelector('.sdk-tools') };
    G.el.grid.addEventListener('pointerdown', e => { const c = e.target.closest('[data-i]'); if (c) { e.preventDefault(); select(G, +c.dataset.i); } });
    G.el.pad.addEventListener('pointerdown', e => { const b = e.target.closest('[data-d]'); if (b) { e.preventDefault(); input(G, api, +b.dataset.d); } });
    G.el.tools.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      ({ undo: () => undo(G, api), erase: () => erase(G, api), notes: () => { G.notes = !G.notes; paint(G); api.sfx.click(); }, hint: () => hint(G, api) })[b.dataset.t]();
    });
    const fit = () => {
      const r = G.el.root.getBoundingClientRect();
      const s = Math.floor(Math.max(240, Math.min(r.width - 24, r.height - 66 - 128, 560)) / 9) * 9;
      G.el.root.style.setProperty('--gs', s + 'px');
    };
    fit();
    if (window.ResizeObserver) { G.ro = new ResizeObserver(fit); G.ro.observe(G.el.root); }
    paint(G);
  }

  function select(G, i) { G.sel = i; paint(G); }

  function input(G, api, d) {
    if (G.over || api.state !== 'play') return;
    const i = G.sel;
    if (i < 0 || G.puz[i]) { api.sfx.tone(160, .05, 'square', .03); return; }
    if (G.notes) {
      if (G.val[i]) return;
      G.hist.push({ i, v: G.val[i], n: G.nts[i] });
      G.nts[i] ^= 1 << d; api.sfx.tone(700, .03, 'triangle', .03);
    } else {
      if (G.val[i] === d) return;
      G.hist.push({ i, v: G.val[i], n: G.nts[i], peers: PEERS[i].filter(k => G.nts[k] & (1 << d)).map(k => [k, G.nts[k]]) });
      G.val[i] = d; G.nts[i] = 0;
      if (d === G.sol[i]) {
        PEERS[i].forEach(k => { G.nts[k] &= ~(1 << d); });
        api.sfx.tone(620 + d * 30, .07, 'sine', .07); api.vibe(6);
        if (G.val.filter((v, k) => v === d && v === G.sol[k]).length === 9) api.sfx.arp([659, 880], .05, .1, 'triangle', .06);
        flashUnits(G, i);
      } else {
        G.err++; api.sfx.tone(180, .15, 'square', .06); api.vibe(60);
        G.el.cells[i].classList.remove('shake'); void G.el.cells[i].offsetWidth; G.el.cells[i].classList.add('shake');
        if (G.cfg.errors && G.err >= G.cfg.errors) { paint(G); lose(G, api); return; }
      }
    }
    paint(G); save(G);
    if (G.val.every((v, k) => v === G.sol[k])) win(G, api);
  }

  /* linha/coluna/caixa acabadas de completar brilham */
  function flashUnits(G, i) {
    const r = Math.floor(i / 9), c = i % 9, b = BOX(i), done = f => { const ks = [...Array(81).keys()].filter(f); return ks.every(k => G.val[k] === G.sol[k]) ? ks : []; };
    const ks = [...done(k => Math.floor(k / 9) === r), ...done(k => k % 9 === c), ...done(k => BOX(k) === b)];
    ks.forEach((k, n) => { const el = G.el.cells[k]; setTimeout(() => { el.classList.remove('wave'); void el.offsetWidth; el.classList.add('wave'); }, n * 18); });
  }

  function erase(G, api) {
    const i = G.sel;
    if (i < 0 || G.puz[i] || (!G.val[i] && !G.nts[i]) || G.over) return;
    G.hist.push({ i, v: G.val[i], n: G.nts[i] });
    G.val[i] = 0; G.nts[i] = 0; paint(G); save(G); api.sfx.tone(400, .04, 'triangle', .04);
  }

  function undo(G, api) {
    const h = G.hist.pop(); if (!h || G.over) return;
    G.val[h.i] = h.v; G.nts[h.i] = h.n; (h.peers || []).forEach(([k, n]) => { G.nts[k] = n; });
    G.sel = h.i; paint(G); save(G); api.sfx.tone(500, .05, 'triangle', .04, 0, 300);
  }

  function hint(G, api) {
    if (G.over || G.hints >= G.cfg.hints) { api.sfx.tone(160, .05, 'square', .03); return; }
    let i = G.sel;
    if (i < 0 || G.puz[i] || G.val[i] === G.sol[i]) {
      const open = [...Array(81).keys()].filter(k => G.val[k] !== G.sol[k]);
      /* a pista mais útil: a célula vazia com menos candidatos */
      open.sort((a, b) => cands(G, a) - cands(G, b));
      i = open[0];
    }
    if (i == null) return;
    G.hist.push({ i, v: G.val[i], n: G.nts[i] });
    G.val[i] = G.sol[i]; G.nts[i] = 0; G.hints++; G.sel = i;
    PEERS[i].forEach(k => { G.nts[k] &= ~(1 << G.sol[i]); });
    G.el.cells[i].classList.add('hinted');
    api.sfx.arp([880, 1175], .05, .1, 'sine', .06);
    paint(G); save(G);
    if (G.val.every((v, k) => v === G.sol[k])) win(G, api);
  }
  function cands(G, i) { let used = 0; PEERS[i].forEach(k => { if (G.val[k]) used |= 1 << G.val[k]; }); let n = 0; for (let d = 1; d <= 9; d++) if (!(used & (1 << d))) n++; return n; }

  function win(G, api) {
    G.over = true; save(G);
    const t = Math.round(G.t);
    api.over({ score: t, won: true, delay: 700, title: G.mode === 'daily' ? 'Sudoku do dia resolvido!' : 'Resolvido!', icon: '🧩',
      stars: G.err === 0 && G.hints === 0 ? 3 : G.err + G.hints <= 2 ? 2 : 1,
      stats: [['Dificuldade', G.cfg.label], ['Erros', G.err], ['Pistas', G.hints]], meta: { diff: G.diff, clean: G.err === 0 && G.hints === 0 } });
    G.el.cells.forEach((el, k) => setTimeout(() => el.classList.add('wave'), (Math.floor(k / 9) + k % 9) * 25));
  }
  function lose(G, api) {
    G.over = true; save(G);
    api.over({ score: null, won: false, record: true, delay: 600, title: `${G.err} erros — fim de jogo`, icon: '🧩',
      sub: 'Dica: usa as notas (✏️) quando não tens a certeza.', stats: [['Tempo', clock(G.t)], ['Preenchidas', G.val.filter((v, k) => v && v === G.sol[k]).length + '/81']] });
  }

  function paint(G) {
    const sv = G.sel >= 0 ? G.val[G.sel] : 0;
    const sr = Math.floor(G.sel / 9), sc = G.sel % 9, sb = G.sel >= 0 ? BOX(G.sel) : -1;
    const counts = new Array(10).fill(0);
    G.val.forEach((v, k) => { if (v && v === G.sol[k]) counts[v]++; });
    G.el.cells.forEach((el, i) => {
      const v = G.val[i], given = !!G.puz[i], wrong = v && v !== G.sol[i];
      const rel = G.sel >= 0 && i !== G.sel && (Math.floor(i / 9) === sr || i % 9 === sc || BOX(i) === sb);
      el.className = 'sdk-c' + (i % 9 === 2 || i % 9 === 5 ? ' br' : '') + (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? ' bb' : '')
        + (given ? ' given' : '') + (wrong ? ' wrong' : '') + (i === G.sel ? ' sel' : '') + (rel ? ' rel' : '')
        + (sv && v === sv && i !== G.sel ? ' same' : '') + (el.classList.contains('hinted') ? ' hinted' : '');
      if (v) el.textContent = v;
      else if (G.nts[i]) el.innerHTML = `<span class="sdk-n">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i>${G.nts[i] & (1 << d) ? d : ''}</i>`).join('')}</span>`;
      else el.textContent = '';
      el.setAttribute('aria-label', `Linha ${Math.floor(i / 9) + 1}, coluna ${i % 9 + 1}: ${v || 'vazia'}`);
    });
    G.el.pad.querySelectorAll('[data-d]').forEach(b => { const d = +b.dataset.d, left = 9 - counts[d]; b.classList.toggle('done', left === 0); b.querySelector('small').textContent = left || ''; });
    const nb = G.el.tools.querySelector('[data-t="notes"]'); nb.classList.toggle('on', G.notes); nb.querySelector('b').textContent = G.notes ? 'on' : 'off';
    const hb = G.el.tools.querySelector('[data-t="hint"]'); hb.querySelector('b').textContent = `${G.cfg.hints - G.hints}`; hb.disabled = G.hints >= G.cfg.hints;
    G.el.tools.querySelector('[data-t="undo"]').disabled = !G.hist.length;
  }

  function injectCSS() {
    if (document.getElementById('sdk-css')) return;
    const s = document.createElement('style'); s.id = 'sdk-css';
    s.textContent = `
.sdk{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:62px 12px 12px;background:linear-gradient(180deg,#101a2e,#0a0f1c);--gs:340px}
.sdk-grid{display:grid;grid-template-columns:repeat(9,1fr);grid-template-rows:repeat(9,1fr);width:var(--gs);height:var(--gs);background:#e8edf6;border:2.5px solid #1e293b;border-radius:10px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.45);user-select:none;touch-action:manipulation}
.sdk-c{display:flex;align-items:center;justify-content:center;border-right:1px solid #b8c3d6;border-bottom:1px solid #b8c3d6;font:700 calc(var(--gs) / 9 * .56) 'Space Grotesk',system-ui,sans-serif;color:#2563eb;cursor:pointer;position:relative;transition:background .1s}
.sdk-c:nth-child(9n){border-right:none}.sdk-c:nth-child(n+73){border-bottom:none}
.sdk-c.br{border-right:2.5px solid #1e293b}.sdk-c.bb{border-bottom:2.5px solid #1e293b}
.sdk-c.given{color:#0f172a}
.sdk-c.rel{background:#d6deec}
.sdk-c.same{background:#bfd2f7}
.sdk-c.sel{background:#93b4f5}
.sdk-c.wrong{color:#dc2626;background:#fde2e2}
.sdk-c.sel.wrong{background:#f9b4b4}
.sdk-c.hinted:not(.given){color:#7c3aed}
.sdk-c.shake{animation:sdkShake .3s}
.sdk-c.wave{animation:sdkWave .5s}
@keyframes sdkShake{25%,75%{transform:translateX(-3px)}50%{transform:translateX(3px)}}
@keyframes sdkWave{40%{background:#fde68a}}
.sdk-n{display:grid;grid-template-columns:repeat(3,1fr);width:100%;height:100%;padding:1px}
.sdk-n i{font-style:normal;font-size:calc(var(--gs) / 9 * .24);font-weight:600;color:#475569;display:flex;align-items:center;justify-content:center;line-height:1}
.sdk-tools,.sdk-pad{width:var(--gs);display:grid;gap:6px}
.sdk-tools{grid-template-columns:repeat(4,1fr)}
.sdk-pad{grid-template-columns:repeat(9,1fr)}
.sdk-tools button{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e2e8f0;font-size:1.05rem;cursor:pointer}
.sdk-tools small{font-size:.64rem;color:#94a3b8}
.sdk-tools small b{color:#fbbf24}
.sdk-tools button.on{border-color:#fbbf24;background:rgba(251,191,36,.14)}
.sdk-tools button:disabled{opacity:.4;cursor:default}
.sdk-pad button{display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(42px,7vh,56px);border-radius:10px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(96,165,250,.2),rgba(96,165,250,.06));color:#fff;font:800 1.3rem 'Space Grotesk',system-ui,sans-serif;cursor:pointer;touch-action:manipulation;padding:0}
.sdk-pad button small{font-size:.58rem;font-weight:600;color:#93c5fd;line-height:1}
.sdk-pad button.done{opacity:.28}
.sdk-pad button:active{transform:scale(.93)}
@media (prefers-reduced-motion:reduce){.sdk-c.shake,.sdk-c.wave{animation:none}}`;
    document.head.appendChild(s);
  }

  const game = ArcadeKit.create({
    id: ID, title: 'Sudoku', icon: '9️⃣',
    accent: '#60a5fa', accent2: '#a78bfa', bg: '#0a0f1c', canvas: false, ready: false,
    lowerIsBetter: true, bestLabel: 'Melhor tempo', scoreFmt: clock,
    tagline: 'O clássico dos números: cada linha, coluna e caixa com 1 a 9, sem repetir.',
    view: { w: 400 },
    modes: () => {
      const sv = store().getPref('save', null);
      const GP = typeof GameProgress !== 'undefined' ? GameProgress : null;
      const done = GP && GP.isDailyDone(ID);
      return [
        ...(sv ? [{ id: 'resume', icon: '▶️', name: 'Continuar', desc: `${sv.mode === 'daily' ? 'Sudoku do dia' : 'Sudoku'} · ${DIFF[sv.diff] ? DIFF[sv.diff].label : ''} · ${Math.floor(sv.t / 60)} min`, noBest: true, note: 'guardado' }] : []),
        { id: 'classic', icon: '🧩', name: 'Novo sudoku', desc: 'Uma grelha nova, sempre com uma única solução.' },
        { id: 'daily', icon: '📅', name: 'Sudoku do dia' + (done ? ' ✓' : ''), desc: 'O mesmo para toda a gente, hoje. Amanhã há outro.' },
      ];
    },
    how: [
      'Toca numa casa e depois num algarismo. Cada linha, coluna e caixa 3×3 tem de ter 1 a 9 sem repetições.',
      '<b>✏️ Notas</b> escreve candidatos pequenos. Ao acertar, as notas desse algarismo à volta apagam-se sozinhas.',
      'Erros ficam a vermelho: em Médio 5 erros acabam o jogo, em Difícil 3. <b>💡 Pista</b> resolve a casa escolhida (ou a mais fácil). A partida fica guardada.',
    ],
    controls: ['🖱️ Clicar', '👆 Tocar', '⌨️ 1–9, setas, N, ⌫'],
    setup, update: (G, dt) => { G.t += dt; if (Math.floor(G.t) % 10 === 0 && Math.floor(G.t - dt) % 10 !== 0) save(G); },
    key: (G, e, api) => {
      if (/^[1-9]$/.test(e.key)) { input(G, api, +e.key); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { erase(G, api); return true; }
      if (e.key === 'n' || e.key === 'N') { G.notes = !G.notes; paint(G); return true; }
      if (e.key === 'z' || e.key === 'Z') { undo(G, api); return true; }
      if (e.key === 'h' || e.key === 'H') { hint(G, api); return true; }
      const mv = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (mv) { const i = G.sel < 0 ? 40 : G.sel; let n = i + mv; if (mv === -1 && i % 9 === 0) n = i + 8; if (mv === 1 && i % 9 === 8) n = i - 8; select(G, (n + 81) % 81); return true; }
    },
    hud: G => [['Tempo', clock(Math.floor(G.t))], ['Erros', G.cfg.errors ? `${G.err}/${G.cfg.errors}` : G.err, G.err ? 'hot' : ''], ['Nível', G.cfg.label]],
    achievements: [
      { id: 'sdk.first', name: 'Primeira Grelha', icon: '🧩', desc: 'Resolve um Sudoku.', test: c => c.result.won === true },
      { id: 'sdk.hard',  name: 'Mestre dos Números', icon: '🧠', desc: 'Resolve um Sudoku difícil.', test: c => c.result.won && (c.result.meta || {}).diff === 'hard' },
      { id: 'sdk.clean', name: 'Sem Borrões', icon: '✨', desc: 'Resolve um Sudoku sem erros nem pistas.', test: c => c.result.won && (c.result.meta || {}).clean },
      { id: 'sdk.daily', name: 'Sudoku Matinal', icon: '📅', desc: 'Resolve o Sudoku do dia.', test: c => c.result.won && /^daily/.test(c.result.mode || '') },
    ],
  });
  game._gen = generate; game._solve = solve;   /* p/ testes */
  return game;
})();
