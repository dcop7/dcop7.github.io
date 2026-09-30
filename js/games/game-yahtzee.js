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
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { if (G.el.root.isConnected) try { build3D(G, api); } catch (e) { console.warn('[general] 3D falhou', e); } }).catch(() => {});
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
    if (G.r3) {
      /* 3D: os valores decidem-se já; os dados voam, rodam, batem e param nessa face */
      idx.forEach(i => { G.dice[i] = U.randi(1, 6); });
      paint(G);
      return throw3D(G, api, idx).then(() => {
        G.busy = false;
        if (Math.max(...counts(G.dice)) === 5) { api.banner('General!', cur(G).ai ? 'o computador' : '5 iguais'); api.sfx.win(); }
        paint(G);
      });
    }
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

  /* ════════════════════════════════════════════════════════════════
     3D — cinco dados de verdade num tabuleiro de feltro: lançam-se do
     fundo, dão voltas, ressaltam duas vezes e param com a face certa.
     Guardados sobem e ficam com aura dourada. Câmara ortográfica
     inclinada: os botões dos dados (transparentes) ficam por cima de cada
     dado, por isso tocar/clicar e o teclado continuam iguais.
  ════════════════════════════════════════════════════════════════ */
  const FACE_Q = {};
  function faceTex(v) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e2e8f0');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(148,163,184,.55)'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
    const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] }[v];
    P.forEach(([px, py]) => { const r = v === 1 ? 15 : 11; const rg = x.createRadialGradient(px - 3, py - 3, 1, px, py, r); rg.addColorStop(0, v === 1 ? '#ef4444' : '#334155'); rg.addColorStop(1, v === 1 ? '#991b1b' : '#0f172a'); x.fillStyle = rg; x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function build3D(G, api) {
    const box = G.el.root.querySelector('.yz-dice');
    const host = document.createElement('div'); host.className = 'yz-3d'; box.prepend(host);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    host.appendChild(renderer.domElement);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#fefce8', ground: '#14532d', hemi: 1.2, sunI: 2.1, fillI: .35, normalBias: .02 });
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.ShadowMaterial({ opacity: .35 }));
    felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; scene.add(felt);
    const mats = [3, 4, 1, 6, 2, 5].map(v => new THREE.MeshStandardMaterial({ map: faceTex(v), roughness: .32, metalness: .02 }));
    const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    const E = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    Object.assign(FACE_Q, { 1: E(0, 0, 0), 6: E(Math.PI, 0, 0), 3: E(0, 0, Math.PI / 2), 4: E(0, 0, -Math.PI / 2), 2: E(-Math.PI / 2, 0, 0), 5: E(Math.PI / 2, 0, 0) });
    const dice = G.dice.map((v, i) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, mats); m.castShadow = true; m.scale.setScalar(.8); g.add(m);
      const aura = new THREE.Sprite(Arcade3D.glowSprite('#fbbf24')); aura.scale.set(2.4, 2.4, 1); aura.visible = false; g.add(aura);
      g.userData = { die: m, aura, q: FACE_Q[v].clone(), yaw: (Math.random() - .5) * .5, anim: null };
      m.quaternion.copy(g.userData.q);
      scene.add(g); return g;
    });
    G.r3 = { renderer, scene, sun, cam, dice, host, box, mats, geo, t: 0 };
    G.el.root.classList.add('yz3d');
    G.api3 = api;
  }
  function slotX(G, i) {
    /* x do centro do botão i, em unidades do mundo (1 dado = 1 unidade) */
    const R = G.r3, br = R.box.getBoundingClientRect(), b = G.el.dice[i].getBoundingClientRect();
    return ((b.left + b.width / 2 - br.left) / br.width - .5) * (R.hw * 2);
  }
  function throw3D(G, api, idx) {
    const R = G.r3, dur = .95;
    idx.forEach((i, k) => {
      const d = R.dice[i].userData, spinAx = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      const endQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - .5) * .6).multiply(FACE_Q[G.dice[i]]);
      d.anim = { t: -k * .05, dur, x0: slotX(G, i) + (Math.random() - .5) * 3, z0: -3.2 - Math.random(), spinAx, turns: 2 + Math.random() * 2, endQ, startQ: R.dice[i].userData.die.quaternion.clone() };
    });
    return new Promise(res => { R.onDone = res; R.pending = idx.length; });
  }
  const ease = t => 1 - Math.pow(1 - t, 3);
  function tick3D(G, dt) {
    const R = G.r3; if (!R || !R.host.isConnected) return;
    const w = R.host.clientWidth, h = R.host.clientHeight; if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (R.w !== w || R.h !== h) { R.w = w; R.h = h; R.renderer.setPixelRatio(dpr); R.renderer.setSize(w, h, false); }
    /* câmara: 1 dado ≈ largura de um botão */
    const bw = G.el.dice[0].getBoundingClientRect().width || 56, unit = bw * 1.02;
    R.hw = w / 2 / unit; const hh = h / 2 / unit;
    R.cam.left = -R.hw; R.cam.right = R.hw; R.cam.top = hh; R.cam.bottom = -hh; R.cam.updateProjectionMatrix();
    R.cam.position.set(0, 10.8, 7.2); R.cam.lookAt(0, 1.05, 0);
    Arcade3D.sunAt(R.sun, 0, 0, 0, 7, [-.5, 1, .4]);
    R.t += dt;
    R.dice.forEach((g, i) => {
      const d = g.userData, held = G.hold[i];
      const x = slotX(G, i);
      if (d.anim) {
        const a = d.anim; a.t += dt;
        const k = Math.max(0, Math.min(1, a.t / a.dur));
        /* trajetória: do fundo para a ranhura, com dois ressaltos que diminuem */
        const px = a.x0 + (x - a.x0) * ease(k), pz = a.z0 * (1 - ease(k));
        const hop = k < .55 ? Math.sin(k / .55 * Math.PI) * 2.2 : k < .85 ? Math.sin((k - .55) / .3 * Math.PI) * .55 : Math.sin((k - .85) / .15 * Math.PI) * .12;
        g.position.set(px, .4 + hop, pz);
        const spin = new THREE.Quaternion().setFromAxisAngle(a.spinAx, (1 - ease(k)) * a.turns * Math.PI * 2);
        d.die.quaternion.copy(a.endQ).premultiply(spin);
        if (k >= 1) {
          d.anim = null; d.die.quaternion.copy(a.endQ);
          if (G.api3) G.api3.sfx.tone(180 + i * 30, .05, 'triangle', .05);
          if (--R.pending <= 0 && R.onDone) { const f = R.onDone; R.onDone = null; f(); }
        }
      } else {
        const ty = .4 + (held ? .5 : 0);
        g.position.x += (x - g.position.x) * Math.min(1, dt * 12);
        g.position.y += (ty - g.position.y) * Math.min(1, dt * 12);
        g.position.z += (0 - g.position.z) * Math.min(1, dt * 12);
        if (!d.anim && d.die.quaternion.angleTo(FACE_Q[G.dice[i]]) > 1.2 && !G.busy) d.die.quaternion.copy(FACE_Q[G.dice[i]]);   /* retomada/estado novo */
      }
      d.aura.visible = held; d.aura.material.opacity = .55 + Math.sin(R.t * 5) * .15;
      d.die.material.forEach ? null : null;
    });
    R.renderer.render(R.scene, R.cam);
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
.yz-row{display:grid;grid-template-columns:1fr 42px;gap:4px;align-items:center;flex:1;min-height:26px;max-height:50px;padding:0 8px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:inherit;font:600 .8rem system-ui;text-align:left;cursor:pointer;transition:background .12s,border-color .12s}
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
.yz-dice{position:relative}
.yz-3d{position:absolute;left:-10px;right:-10px;top:-46px;bottom:-12px;pointer-events:none}
.yz.yz3d .yz-dice{padding:18px 0 4px}
.yz.yz3d .yz-die .yz-face{opacity:0!important}
.yz.yz3d .yz-die{transform:none!important}
.yz.yz3d .yz-die.held::after{bottom:-12px}
.yz.yz3d .yz-die.rolling{animation:none}
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
    setup, update: (G, dt) => { if (G.r3) tick3D(G, dt); },
    destroy: G => { const R = G.r3; if (!R) return; R.mats.forEach(m => { m.map.dispose(); m.dispose(); }); R.geo.dispose(); Arcade3D.disposeOwn(R.scene); R.renderer.dispose(); R.host.remove(); G.r3 = null; },
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
