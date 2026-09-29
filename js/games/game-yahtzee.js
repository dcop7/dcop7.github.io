/* ══════════════════════════════════════════════════════════════════
   General (Yahtzee) — 5 dados, até 3 lançamentos por vez, 13 casas.
   Solitário (bate o teu recorde) ou Contra o computador, com 3 níveis
   de IA: fácil guarda a face mais comum; médio persegue sequências e
   pesa o custo de oportunidade de cada casa; difícil avalia as 32
   formas de guardar dados por Monte-Carlo. Bónus de 35 na parte de
   cima (≥63) e +100 por cada General extra (com joker nas sequências
   e no full).
══════════════════════════════════════════════════════════════════ */
const YahtzeeGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const CATS = [
    { id: 'n1', name: 'Uns', up: 1 }, { id: 'n2', name: 'Dois', up: 2 }, { id: 'n3', name: 'Três', up: 3 },
    { id: 'n4', name: 'Quatros', up: 4 }, { id: 'n5', name: 'Cincos', up: 5 }, { id: 'n6', name: 'Seis', up: 6 },
    { id: 'three', name: 'Trio', tip: '3 iguais: soma de todos' }, { id: 'four', name: 'Quadra', tip: '4 iguais: soma de todos' },
    { id: 'full', name: 'Full', tip: '3 + 2 iguais: 25' }, { id: 'sm', name: 'Seq. pequena', tip: '4 seguidos: 30' },
    { id: 'lg', name: 'Seq. grande', tip: '5 seguidos: 40' }, { id: 'yz', name: 'General', tip: '5 iguais: 50' },
    { id: 'ch', name: 'Chance', tip: 'Soma de todos' },
  ];
  /* média de pontos de cada casa em jogo bom — base do "custo de oportunidade" */
  const BASE = { n1: 2.1, n2: 5.3, n3: 8.6, n4: 12.2, n5: 15.7, n6: 19.2, three: 21.7, four: 13.1, full: 22.6, sm: 29.5, lg: 32.7, yz: 16.9, ch: 22 };

  const counts = d => { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach(v => c[v]++); return c; };
  const sum = d => d.reduce((a, b) => a + b, 0);
  function straight(d, n) { const s = new Set(d); for (let a = 1; a + n - 1 <= 6; a++) { let ok = true; for (let k = 0; k < n; k++) if (!s.has(a + k)) ok = false; if (ok) return true; } return false; }
  function scoreOf(cat, d, card) {
    const c = counts(d), mx = Math.max(...c);
    const joker = mx === 5 && card && card.yz === 50;           /* General extra funciona como joker */
    switch (cat) {
      case 'three': return mx >= 3 ? sum(d) : 0;
      case 'four': return mx >= 4 ? sum(d) : 0;
      case 'full': return (c.includes(3) && c.includes(2)) || joker ? 25 : 0;
      case 'sm': return straight(d, 4) || joker ? 30 : 0;
      case 'lg': return straight(d, 5) || joker ? 40 : 0;
      case 'yz': return mx === 5 ? 50 : 0;
      case 'ch': return sum(d);
      default: { const f = +cat[1]; return c[f] * f; }
    }
  }
  const upperSum = card => CATS.filter(k => k.up).reduce((a, k) => a + (card[k.id] || 0), 0);
  const total = p => upperSum(p.card) + (upperSum(p.card) >= 63 ? 35 : 0) + CATS.filter(k => !k.up).reduce((a, k) => a + (p.card[k.id] || 0), 0) + p.ybonus;

  /* ── IA ── */
  function catValue(p, cat, d, lvl) {
    const s = scoreOf(cat, d, p.card);
    let v = s - (lvl === 'easy' ? 0 : BASE[cat] * .75);
    const up = CATS.find(k => k.id === cat).up;
    if (up && lvl !== 'easy') { const need = 3 * up; v += (s >= need ? 6 : 0) + (s - need) * .6; }
    if (cat === 'yz' && s === 0) v -= lvl === 'hard' ? 14 : 8;           /* não queimar o General cedo */
    if (cat === 'ch' && lvl !== 'easy') v -= 4;
    return v;
  }
  function bestCat(p, d, lvl) {
    let best = null, bv = -Infinity;
    CATS.forEach(k => { if (p.card[k.id] != null) return; const v = catValue(p, k.id, d, lvl); if (v > bv) { bv = v; best = k.id; } });
    return { cat: best, v: bv };
  }
  function chooseHold(p, d, lvl, rollsLeft) {
    if (lvl === 'easy') {
      const c = counts(d); let f = 6; for (let k = 6; k >= 1; k--) if (c[k] > c[f]) f = k;
      return d.map(v => v === f);
    }
    if (lvl === 'medium') {
      const c = counts(d), mx = Math.max(...c), s = new Set(d);
      /* sequência a meio caminho? */
      for (const run of [[2, 3, 4, 5], [1, 2, 3, 4], [3, 4, 5, 6]]) {
        const have = run.filter(v => s.has(v)).length;
        if (have >= 3 && mx < 3 && (p.card.sm == null || p.card.lg == null)) { const used = new Set(); return d.map(v => (run.includes(v) && !used.has(v) ? (used.add(v), true) : false)); }
      }
      let f = 1; for (let k = 1; k <= 6; k++) if (c[k] > c[f] || (c[k] === c[f] && k > f)) f = k;
      if (mx === 2 && c.filter(x => x === 2).length === 2 && p.card.full == null) return d.map(v => c[v] === 2);
      return d.map(v => v === f);
    }
    /* difícil: Monte-Carlo sobre os 32 subconjuntos */
    let best = null, bv = -Infinity;
    for (let m = 0; m < 32; m++) {
      const hold = d.map((_, i) => !!(m & (1 << i)));
      let acc = 0; const N = 70;
      for (let s = 0; s < N; s++) {
        let dd = d.map((v, i) => (hold[i] ? v : U.randi(1, 6)));
        if (rollsLeft > 1) { const h2 = chooseHold(p, dd, 'medium', 1); dd = dd.map((v, i) => (h2[i] ? v : U.randi(1, 6))); }
        acc += bestCat(p, dd, 'hard').v;
      }
      if (acc / N > bv) { bv = acc / N; best = hold; }
    }
    return best;
  }

  /* ── partida ── */
  function newPlayer(name, ai) { return { name, ai, card: {}, ybonus: 0, gens: 0 }; }
  function setup(api, o) {
    const mode = o.mode || 'solo';
    const G = { mode, lvl: o.diff || 'medium', players: [newPlayer('Tu', false)], turn: 0, round: 1, dice: [1, 2, 3, 4, 5], hold: [false, false, false, false, false], rolls: 0, busy: false, over: false, api };
    if (mode === 'ai') G.players.push(newPlayer('Computador', true));
    build(G, api);
    return G;
  }

  const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieHTML = v => `<span class="yz-face">${Array.from({ length: 9 }, (_, i) => `<i${pips[v].includes(i) ? ' class="on"' : ''}></i>`).join('')}</span>`;

  function build(G, api) {
    injectCSS();
    const L = api.layer, vs = G.players.length > 1;
    const row = k => `<button type="button" class="yz-row" data-cat="${k.id}" title="${k.tip || 'Soma dos ' + k.name.toLowerCase()}"><span class="yz-cn">${k.up ? `<em>${dieHTML(k.up)}</em>` : ''}${k.name}</span><b class="yz-me"></b>${vs ? '<span class="yz-ai"></span>' : ''}</button>`;
    L.innerHTML = `
      <div class="yz${vs ? ' vs' : ''}">
        <div class="yz-card">
          <div class="yz-col">
            <div class="yz-head"><span>Parte de cima</span><b>Tu</b>${vs ? '<span>CPU</span>' : ''}</div>
            ${CATS.filter(k => k.up).map(row).join('')}
            <div class="yz-row sub"><span class="yz-cn">Bónus (≥63)</span><b class="yz-bonus"></b>${vs ? '<span class="yz-bonus-ai"></span>' : ''}</div>
          </div>
          <div class="yz-col">
            <div class="yz-head"><span>Parte de baixo</span><b>Tu</b>${vs ? '<span>CPU</span>' : ''}</div>
            ${CATS.filter(k => !k.up).map(row).join('')}
          </div>
        </div>
        <div class="yz-status" aria-live="polite"></div>
        <div class="yz-dice">${G.dice.map((v, i) => `<button type="button" class="yz-die" data-d="${i}" aria-label="Dado ${i + 1}">${dieHTML(v)}</button>`).join('')}</div>
        <button type="button" class="yz-roll">🎲 Lançar <small></small></button>
      </div>`;
    G.el = { root: L.querySelector('.yz'), dice: [...L.querySelectorAll('.yz-die')], roll: L.querySelector('.yz-roll'), status: L.querySelector('.yz-status'), rows: [...L.querySelectorAll('.yz-row[data-cat]')] };
    G.el.dice.forEach(b => b.addEventListener('click', () => toggleHold(G, api, +b.dataset.d)));
    G.el.roll.addEventListener('click', () => roll(G, api));
    G.el.rows.forEach(b => b.addEventListener('click', () => pick(G, api, b.dataset.cat)));
    paint(G);
  }

  const cur = G => G.players[G.turn];

  function toggleHold(G, api, i) {
    if (G.busy || G.over || cur(G).ai || G.rolls === 0 || G.rolls >= 3 || api.state !== 'play') return;
    G.hold[i] = !G.hold[i]; api.sfx.tone(G.hold[i] ? 700 : 500, .04, 'triangle', .05); paint(G);
  }

  function roll(G, api, forAI) {
    if (G.busy || G.over || G.rolls >= 3 || (cur(G).ai && !forAI) || (!forAI && api.state !== 'play')) return Promise.resolve();
    G.busy = true; G.rolls++;
    api.sfx.noise(.25, .08, 0, 1800); api.sfx.noise(.18, .06, .12, 1200);
    const idx = [0, 1, 2, 3, 4].filter(i => !G.hold[i]);
    idx.forEach(i => G.el.dice[i].classList.add('rolling'));
    return new Promise(res => {
      let k = 0;
      const tick = setInterval(() => {
        idx.forEach(i => { G.el.dice[i].innerHTML = dieHTML(U.randi(1, 6)); });
        if (++k >= 7) {
          clearInterval(tick);
          idx.forEach(i => { G.dice[i] = U.randi(1, 6); G.el.dice[i].classList.remove('rolling'); });
          G.busy = false;
          if (Math.max(...counts(G.dice)) === 5) { api.banner('General!', cur(G).ai ? 'o computador' : '5 iguais'); api.sfx.win(); }
          paint(G); res();
        }
      }, 55);
    });
  }

  function pick(G, api, cat, forAI) {
    const p = cur(G);
    if (G.busy || G.over || G.rolls === 0 || p.card[cat] != null || (p.ai && !forAI) || (!forAI && api.state !== 'play')) return;
    const isY = Math.max(...counts(G.dice)) === 5;
    if (isY && p.card.yz === 50) { p.ybonus += 100; api.float(api.W / 2, api.H * .45, '+100 General extra!', '#fde047', 20); }
    const s = scoreOf(cat, G.dice, p.card);
    p.card[cat] = s; if (cat === 'yz' && s) p.gens++;
    if (isY && cat !== 'yz') p.gens++;
    if (!p.ai) { api.sfx.tone(s ? 880 : 220, .1, s ? 'sine' : 'triangle', .07); if (s) api.vibe(10); }
    const row = G.el.rows.find(r => r.dataset.cat === cat);
    row && (row.classList.remove('flash'), void row.offsetWidth, row.classList.add('flash'));
    nextTurn(G, api);
  }

  function nextTurn(G, api) {
    G.rolls = 0; G.hold = [false, false, false, false, false];
    if (G.turn === G.players.length - 1) G.round++;
    G.turn = (G.turn + 1) % G.players.length;
    paint(G);
    if (G.round > 13) return finish(G, api);
    if (cur(G).ai) aiTurn(G, api);
  }

  async function aiTurn(G, api) {
    const p = cur(G), wait = ms => new Promise(r => setTimeout(r, ms));
    G.aiRunning = true; paint(G);
    await wait(650);
    for (let r = 0; r < 3; r++) {
      if (G.over || !G.el.root.isConnected) return;
      while (api.state !== 'play') { await wait(200); if (!G.el.root.isConnected) return; }
      await roll(G, api, true);
      await wait(520);
      const bc = bestCat(p, G.dice, G.lvl);
      /* pára cedo se já tem algo muito bom */
      if (r < 2 && (bc.v > (G.lvl === 'easy' ? 25 : 12) || scoreOf('yz', G.dice) === 50)) break;
      if (r < 2) {
        G.hold = chooseHold(p, G.dice, G.lvl, 2 - r);
        paint(G); await wait(560);
      }
    }
    while (api.state !== 'play') { await wait(200); if (!G.el.root.isConnected) return; }
    const bc = bestCat(p, G.dice, G.lvl);
    G.aiRunning = false;
    pick(G, api, bc.cat, true);
  }

  function finish(G, api) {
    G.over = true;
    const me = G.players[0], myT = total(me);
    const vs = G.players[1], aiT = vs ? total(vs) : 0;
    const won = vs ? myT > aiT : true;
    const bonus = upperSum(me.card) >= 63;
    api.over({ score: myT, won, delay: 500, icon: vs ? (won ? '🏆' : myT === aiT ? '🤝' : '🤖') : '🎲',
      title: vs ? (won ? 'Ganhaste ao computador!' : myT === aiT ? 'Empate!' : 'O computador ganhou') : 'Fim da partida',
      sub: vs ? `Tu ${myT} · Computador ${aiT}` : '',
      stats: [['Parte de cima', upperSum(me.card) + (bonus ? ' +35' : '')], ['Generais', me.gens], ['Bónus extra', me.ybonus]],
      meta: { bonus, gens: me.gens, beatAI: !!vs && won, lvl: G.lvl } });
  }

  function paint(G) {
    const p = cur(G), me = G.players[0], ai = G.players[1];
    G.el.dice.forEach((b, i) => {
      if (!b.classList.contains('rolling')) b.innerHTML = dieHTML(G.dice[i]);
      b.classList.toggle('held', G.hold[i]); b.classList.toggle('idle', G.rolls === 0);
      b.setAttribute('aria-pressed', G.hold[i]); b.disabled = p.ai;
    });
    const canPick = G.rolls > 0 && !p.ai && !G.busy;
    G.el.rows.forEach(r => {
      const c = r.dataset.cat, v = me.card[c];
      const b = r.querySelector('.yz-me');
      r.classList.toggle('used', v != null);
      if (v != null) { b.textContent = v; b.className = 'yz-me done'; }
      else if (canPick) { const s = scoreOf(c, G.dice, me.card); b.textContent = s; b.className = 'yz-me prev' + (s ? '' : ' zero'); }
      else { b.textContent = ''; b.className = 'yz-me'; }
      r.disabled = !canPick || v != null;
      if (ai) { const a = r.querySelector('.yz-ai'); a.textContent = ai.card[c] != null ? ai.card[c] : ''; a.classList.toggle('done', ai.card[c] != null); }
    });
    const us = upperSum(me.card);
    G.el.root.querySelector('.yz-bonus').textContent = us >= 63 ? '+35' : `${us}/63`;
    if (ai) { const ua = upperSum(ai.card); G.el.root.querySelector('.yz-bonus-ai').textContent = ua >= 63 ? '+35' : ua; }
    const left = 3 - G.rolls;
    G.el.roll.disabled = p.ai || G.busy || left <= 0;
    G.el.roll.querySelector('small').textContent = p.ai ? '' : `(${left})`;
    G.el.roll.classList.toggle('pulse', !p.ai && G.rolls === 0);
    G.el.status.textContent = G.over ? '' : p.ai ? '🤖 Vez do computador…'
      : G.rolls === 0 ? `Ronda ${Math.min(G.round, 13)}/13 — lança os dados`
      : left > 0 ? 'Toca nos dados para os guardar, lança outra vez ou escolhe uma casa' : 'Escolhe uma casa no quadro';
    G.el.root.classList.toggle('ai-turn', !!p.ai);
  }

  function injectCSS() {
    if (document.getElementById('yz-css')) return;
    const s = document.createElement('style'); s.id = 'yz-css';
    s.textContent = `
.yz{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:62px 10px 10px;background:radial-gradient(ellipse at 50% 100%,#14532d,#07170e 75%);color:#ecfdf5}
.yz-card{display:grid;grid-template-columns:1fr 1fr;gap:6px;flex:1;min-height:0}
.yz-col{display:flex;flex-direction:column;gap:3px;min-height:0}
.yz-head{display:grid;grid-template-columns:1fr 42px;gap:4px;font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:#86efac;padding:0 6px}
.yz.vs .yz-head,.yz.vs .yz-row{grid-template-columns:1fr 36px 30px}
.yz-head b,.yz-head span:last-child{text-align:center}
.yz-row{display:grid;grid-template-columns:1fr 42px;gap:4px;align-items:center;flex:1;min-height:26px;max-height:40px;padding:0 6px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:inherit;font:600 .8rem system-ui;text-align:left;cursor:pointer;transition:background .12s,border-color .12s}
.yz-row:not(:disabled):hover{border-color:#fbbf24;background:rgba(251,191,36,.1)}
.yz-row:disabled{cursor:default}
.yz-row.sub{cursor:default;background:transparent;border-style:dashed}
.yz-row.used .yz-cn{opacity:.55}
.yz-row.flash{animation:yzFlash .6s}
@keyframes yzFlash{30%{background:rgba(251,191,36,.35)}}
.yz-cn{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.yz-cn em{display:inline-block;width:15px;height:15px;flex:0 0 auto}
.yz-cn em .yz-face{width:15px;height:15px;padding:1.5px;border-radius:3px;gap:0}
.yz-cn em .yz-face i{width:3px;height:3px}
.yz-me,.yz-ai,.yz-bonus,.yz-bonus-ai{text-align:center;font-variant-numeric:tabular-nums;font-weight:800}
.yz-me.prev{color:#fde68a;opacity:.85}.yz-me.prev.zero{color:#64748b}
.yz-me.done{color:#fff}
.yz-ai{color:#93c5fd;font-weight:700;font-size:.78rem}
.yz-bonus,.yz-bonus-ai{font-size:.72rem;color:#86efac}
.yz-status{text-align:center;font-size:.78rem;color:#bbf7d0;min-height:1.2em}
.yz-dice{display:flex;justify-content:center;gap:clamp(6px,2.5vw,12px)}
.yz-die{width:clamp(48px,14vw,62px);aspect-ratio:1;border:none;padding:0;background:none;cursor:pointer;position:relative;transition:transform .15s}
.yz-die .yz-face{width:100%;height:100%}
.yz-face{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);place-items:center;gap:1px;padding:16%;box-sizing:border-box;border-radius:18%;background:linear-gradient(145deg,#ffffff,#e5e7eb);box-shadow:inset 0 -4px 0 #cbd5e1,0 6px 14px rgba(0,0,0,.35)}
.yz-face i{width:62%;aspect-ratio:1;border-radius:50%}
.yz-face i.on{background:#111827}
.yz-die.held{transform:translateY(-8px)}
.yz-die.held .yz-face{background:linear-gradient(145deg,#fef3c7,#fcd34d);box-shadow:inset 0 -4px 0 #d97706,0 0 0 3px #fbbf24,0 10px 18px rgba(0,0,0,.35)}
.yz-die.held::after{content:'guardado';position:absolute;left:50%;bottom:-17px;transform:translateX(-50%);font-size:.56rem;letter-spacing:.06em;text-transform:uppercase;color:#fde68a}
.yz-die.idle .yz-face{opacity:.45}
.yz-die.rolling{animation:yzRoll .12s linear infinite}
@keyframes yzRoll{0%{transform:rotate(-12deg) translateY(-3px)}50%{transform:rotate(10deg) translateY(2px)}100%{transform:rotate(-12deg) translateY(-3px)}}
.yz-die:disabled{cursor:default}
.yz-roll{margin-top:10px;padding:13px;border:none;border-radius:14px;font:800 1.05rem system-ui;color:#052e16;background:linear-gradient(120deg,#4ade80,#fde047);cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.3)}
.yz-roll small{font-weight:700;opacity:.7}
.yz-roll:disabled{opacity:.4;cursor:default}
.yz-roll.pulse{animation:yzPulse 1.4s ease-in-out infinite}
@keyframes yzPulse{50%{box-shadow:0 0 0 6px rgba(74,222,128,.25),0 8px 20px rgba(0,0,0,.3)}}
.yz.ai-turn .yz-dice{filter:drop-shadow(0 0 10px rgba(147,197,253,.35))}
@media (max-width:400px){.yz-row{font-size:.72rem;padding:0 4px}.yz-cn em{display:none}}
@media (prefers-reduced-motion:reduce){.yz-die.rolling,.yz-roll.pulse,.yz-row.flash{animation:none}}`;
    document.head.appendChild(s);
  }

  return ArcadeKit.create({
    id: 'yahtzee', title: 'General', icon: '🎲',
    accent: '#4ade80', accent2: '#fde047', bg: '#07170e', canvas: false, ready: false,
    tagline: 'Cinco dados, três lançamentos, treze casas para preencher. O clássico dos dados (tipo Yahtzee).',
    view: { w: 400 },
    modes: [
      { id: 'solo', icon: '🎲', name: 'Solitário', desc: 'Faz a maior pontuação possível nas 13 rondas.', noDiff: true },
      { id: 'ai', icon: '🤖', name: 'Contra o computador', desc: 'Alternam jogadas. A dificuldade define a esperteza do computador.' },
    ],
    how: [
      'Lança os dados até 3 vezes por ronda. Entre lançamentos, <b>toca num dado para o guardar</b> (fica dourado).',
      'Depois escolhe uma casa do quadro — a pontuação que vais ganhar aparece a amarelo. Cada casa só se usa uma vez.',
      'Soma 63+ na parte de cima e ganhas +35. General = 5 iguais (50); cada General extra vale +100 e serve de joker no Full e nas sequências.',
    ],
    controls: ['🖱️ Clicar', '👆 Tocar', '⌨️ Espaço lança, 1–5 guarda'],
    setup, update: () => {},
    key: (G, e, api) => {
      if (e.key === ' ' || e.key === 'r') { roll(G, api); return true; }
      if (/^[1-5]$/.test(e.key)) { toggleHold(G, api, +e.key - 1); return true; }
    },
    hud: G => {
      const me = G.players[0], ai = G.players[1];
      return [['Ronda', Math.min(G.round, 13) + '/13'], ['Tu', total(me)], ...(ai ? [['CPU', total(ai), total(ai) > total(me) ? 'hot' : '']] : [])];
    },
    achievements: [
      { id: 'yz.gen',   name: 'General!',       icon: '🎲', desc: 'Faz um General (5 dados iguais).', test: c => ((c.result.meta || {}).gens || 0) >= 1 },
      { id: 'yz.bonus', name: 'Parte de Cima',  icon: '➕', desc: 'Ganha o bónus de 35 na parte de cima.', test: c => !!(c.result.meta || {}).bonus },
      { id: 'yz.250',   name: 'Mão de Ouro',    icon: '💰', desc: 'Faz 250 pontos numa partida de General.', test: c => (c.result.score || 0) >= 250 },
      { id: 'yz.beat',  name: 'Mais Esperto que a Máquina', icon: '🤖', desc: 'Ganha ao computador no Difícil.', test: c => (c.result.meta || {}).beatAI && (c.result.meta || {}).lvl === 'hard' },
    ],
  });
})();
