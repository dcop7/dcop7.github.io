/* ══════════════════════════════════════════════════════════════════
   DobbleGame — "Olho Vivo": encontra o único símbolo comum entre duas
   cartas. Baralho gerado por plano projetivo de ordem prima n (qualquer
   par de cartas partilha EXATAMENTE um símbolo — garantia matemática):
     • Fácil   n=3 → 4 símbolos/carta (13 cartas)
     • Médio   n=5 → 6 símbolos/carta (31 cartas)
     • Difícil n=7 → 8 símbolos/carta (57 cartas — o clássico)
   Símbolos = emoji (offline, zero assets externos), 3 temas de 57.
   Modos: Clássico (limpa a pilha, tempo conta), Contra-Relógio (60s,
   combos), Morte Súbita (tempo por ronda encolhe, um erro acaba) e Zen.
   Mobile-first: toques simples, alvos grandes, haptics, sons WebAudio.
   Integra GameProgress (recordes por modo+dificuldade, conquistas).
══════════════════════════════════════════════════════════════════ */
const DobbleGame = (function () {
  'use strict';

  /* ── i18n (fallback embebido; games/dobble/i18n.json pode sobrepor) ─ */
  const FB_I18N = {
    pt: {
      title: 'Olho Vivo', tagline: 'Há sempre um — e só um — símbolo igual nas duas cartas. Encontra-o primeiro.',
      mClassic: 'Clássico', mClassicD: 'Limpa a pilha de {n} cartas o mais depressa possível.',
      mRush: 'Contra-Relógio', mRushD: '60 segundos. Cada acerto vale mais em combo; errar custa 3s.',
      mSurvival: 'Morte Súbita', mSurvivalD: 'O tempo por carta encolhe. Um erro ou hesitação e acabou.',
      mZen: 'Zen', mZenD: 'Sem relógio, sem pressão. Treina o olho ao teu ritmo.',
      daily: 'Desafio do dia', dailyD: 'Contra-relógio com o baralho do dia — igual para todos.',
      dailyDone: 'concluído ✓',
      theme: 'Tema', tMix: 'Mistura', tAnimals: 'Animais', tFood: 'Comida',
      best: 'Recorde', noBest: '—',
      howto: '📖 Como jogar', howtoT: 'Como jogar',
      how1: 'Entre quaisquer duas cartas existe sempre exatamente um símbolo repetido — pode mudar de tamanho e rotação, mas é o mesmo desenho.',
      how2: 'Toca nesse símbolo em qualquer uma das cartas. Acertaste? Vem já outra carta.',
      how3: 'Erros custam caro: tempo no Contra-Relógio, a partida na Morte Súbita. Confia no primeiro olhar!',
      gotIt: 'Percebi!',
      score: 'Pontos', timeLbl: 'Tempo', cards: 'Cartas', round: 'Ronda', combo: 'Combo',
      pause: 'Pausa', resume: 'Retomar', quit: 'Sair', paused: 'Jogo em pausa',
      over: 'Fim de jogo', clear: 'Pilha limpa!', newRecord: '🏆 Novo recorde!',
      matches: 'Acertos', accuracy: 'Precisão', bestReaction: 'Reação mais rápida',
      timeout: '⏰ O tempo esgotou-se…', wrongEnd: '✖ Símbolo errado…',
      playAgain: '↻ Jogar outra vez', otherModes: 'Modos', backMenu: '⬅ Menu',
      sound: 'Som', zenExit: 'Terminar sessão',
      s: 's',
    },
    en: {
      title: 'Sharp Eye', tagline: 'There is always one — and only one — matching symbol between the two cards. Spot it first.',
      mClassic: 'Classic', mClassicD: 'Clear the pile of {n} cards as fast as you can.',
      mRush: 'Time Attack', mRushD: '60 seconds. Combos multiply your score; a miss costs 3s.',
      mSurvival: 'Sudden Death', mSurvivalD: 'The clock per card keeps shrinking. One mistake and it\'s over.',
      mZen: 'Zen', mZenD: 'No clock, no pressure. Train your eye at your own pace.',
      daily: 'Daily challenge', dailyD: 'Time attack with today\'s deck — same for everyone.',
      dailyDone: 'done ✓',
      theme: 'Theme', tMix: 'Mix', tAnimals: 'Animals', tFood: 'Food',
      best: 'Best', noBest: '—',
      howto: '📖 How to play', howtoT: 'How to play',
      how1: 'Any two cards always share exactly one symbol — size and rotation may differ, but it\'s the same drawing.',
      how2: 'Tap that symbol on either card. Got it? The next card slides right in.',
      how3: 'Mistakes are costly: time in Time Attack, the whole run in Sudden Death. Trust your first glance!',
      gotIt: 'Got it!',
      score: 'Score', timeLbl: 'Time', cards: 'Cards', round: 'Round', combo: 'Combo',
      pause: 'Pause', resume: 'Resume', quit: 'Quit', paused: 'Game paused',
      over: 'Game over', clear: 'Pile cleared!', newRecord: '🏆 New record!',
      matches: 'Matches', accuracy: 'Accuracy', bestReaction: 'Fastest reaction',
      timeout: '⏰ Time ran out…', wrongEnd: '✖ Wrong symbol…',
      playAgain: '↻ Play again', otherModes: 'Modes', backMenu: '⬅ Menu',
      sound: 'Sound', zenExit: 'End session',
      s: 's',
    },
  };
  const _hasGD = typeof GameData !== 'undefined';
  const t = _hasGD ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  const fmt = (k, o) => { let s = t(k); for (const x in (o || {})) s = s.replace('{' + x + '}', o[x]); return s; };

  const store = () => (typeof GameProgress !== 'undefined')
    ? GameProgress.store('dobble')
    : { getPref: (k, d) => d, setPref: () => {}, getStats: () => ({}), updateStats: () => {} };

  /* ── matemática do baralho (plano projetivo de ordem prima n) ──── */
  function genDeck(n) {
    const cards = [];
    for (let m = 0; m < n; m++)                       /* retas de declive m */
      for (let b = 0; b < n; b++) {
        const c = [];
        for (let x = 0; x < n; x++) c.push(x * n + ((m * x + b) % n));
        c.push(n * n + m);
        cards.push(c);
      }
    for (let x0 = 0; x0 < n; x0++) {                  /* retas verticais */
      const c = [];
      for (let y = 0; y < n; y++) c.push(x0 * n + y);
      c.push(n * n + n);
      cards.push(c);
    }
    cards.push(Array.from({ length: n + 1 }, (_, i) => n * n + i)); /* reta no infinito */
    return cards;                                      /* n²+n+1 cartas */
  }
  const shared = (a, b) => a.find(s => b.includes(s));

  /* ── temas de símbolos (57 emoji cada — offline, sem licenças) ─── */
  const THEMES = {
    mix: ['⚽','🏀','🎾','🎲','🎯','🎸','🎺','🥁','🎁','🎈','⭐','🌙','☀️','🌈','❄️','🔥','💧','🍀','🌵','🌸','🍄','🌍','🍎','🍌','🍒','🍇','🍉','🥕','🍩','🍕','🐶','🐱','🐭','🦊','🐻','🐼','🐸','🐙','🦋','🐞','🐢','🐬','🦉','🐝','👑','💎','🔑','🔒','✂️','✏️','📌','⏰','🔔','💡','🧲','⚓','🚀'],
    animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦀','🐡','🐠','🐟','🐬','🐳','🦈','🐊','🐘','🦏','🐪','🦒','🦓','🦍','🐎','🐑','🐐','🦇'],
    food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🍍','🥝','🥥','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥒','🥦','🍄','🥜','🌰','🍞','🥐','🥖','🥨','🥞','🧀','🍖','🍗','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🍿','🍳','🍤','🍦','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍯','☕'],
  };
  const THEME_LABEL = () => ({ mix: t('tMix'), animals: t('tAnimals'), food: t('tFood') });

  /* ── dificuldade → ordem do plano ──────────────────────────────── */
  function diff() { return _hasGD ? GameData.difficulty() : 'medium'; }
  const DIFF_N = { easy: 3, medium: 5, hard: 7 };

  /* ── RNG com seed (para desafio diário determinístico) ─────────── */
  function rng(seed) {
    if (typeof GameProgress !== 'undefined') return GameProgress.rng(seed);
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ── layout orgânico das cartas (slots sem sobreposição) ───────── */
  /* [x, y, r] em fração do raio da carta; r = raio máximo do símbolo */
  const LAYOUTS = {
    4: [[0, 0, .36], [0, -.58, .32], [-.52, .31, .32], [.52, .31, .32]],
    6: [[0, 0, .32], [0, -.62, .27], [.59, -.19, .27], [.37, .51, .27], [-.37, .51, .27], [-.59, -.19, .27]],
    8: [[0, .02, .26], [0, -.66, .235], [.52, -.42, .235], [.65, .16, .235], [.29, .62, .235], [-.29, .62, .235], [-.65, .16, .235], [-.52, -.42, .235]],
  };

  /* ── sons (WebAudio local, curto e discreto — padrão bomb) ─────── */
  const soundOn = () => store().getPref('sound', true);
  let _actx = null;
  function snd(fn) {
    if (!soundOn()) return;
    try {
      _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
      if (_actx.state === 'suspended') _actx.resume();
      fn(_actx);
    } catch (e) {}
  }
  function beep(ctx, freq, dur, type, gain, when) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain || .12, ctx.currentTime + (when || 0));
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + (when || 0) + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime + (when || 0)); o.stop(ctx.currentTime + (when || 0) + dur + .02);
  }
  const sndHit  = combo => snd(c => beep(c, 480 * Math.pow(2, Math.min(combo, 12) / 12), .12, 'sine', .14));
  const sndMiss = () => snd(c => beep(c, 150, .16, 'square', .08));
  const sndTick = () => snd(c => beep(c, 900, .04, 'sine', .05));
  const sndEnd  = win => snd(c => { const f = win ? [523, 659, 784, 1047] : [330, 262]; f.forEach((q, i) => beep(c, q, .16, 'sine', .12, i * .13)); });
  const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  /* ── estado ─────────────────────────────────────────────────────── */
  let root = null, S = null, _tick = null;
  const CLASSIC_LEN = 15;
  const RUSH_TIME = 60;

  function bests(mode) {
    if (typeof GameProgress === 'undefined') return null;
    return GameProgress.bestScore('dobble', mode + '-' + diff());
  }

  /* ── construção de uma partida ─────────────────────────────────── */
  function newGame(mode, opts = {}) {
    const n = DIFF_N[diff()] || 5;
    const seed = opts.seed != null ? opts.seed : ((Math.random() * 0xffffffff) >>> 0);
    const rnd = rng(seed);
    const theme = store().getPref('theme', 'mix');
    const pool = shuffle(THEMES[theme].slice(), rnd);   /* símbolo i → emoji */
    const deck = shuffle(genDeck(n), rnd);
    return {
      mode, n, seed, daily: !!opts.daily,
      pool, deck, di: 2,                     /* deck[0]=mão, deck[1]=mesa, di = próxima */
      hand: deck[0], top: deck[1],
      score: 0, matches: 0, wrongs: 0, combo: 0, bestCombo: 0,
      time: mode === 'rush' ? RUSH_TIME : 0, /* rush conta para baixo; clássico/zen para cima */
      roundMax: diff() === 'easy' ? 10 : 8,  /* morte súbita: s por carta */
      roundLeft: 0,
      pairTs: 0, bestReact: null,
      paused: false, over: false, startTs: Date.now(),
    };
  }
  function nextPair() {
    S.hand = S.top;
    if (S.di >= S.deck.length) {             /* recircula (nunca no clássico) */
      const cur = S.hand;
      S.deck = shuffle(S.deck.filter(c => c !== cur));
      S.deck.unshift(cur);
      S.di = 1;
    }
    S.top = S.deck[S.di++];
    S.pairTs = performance.now();
    if (S.mode === 'survival') S.roundLeft = S.roundMax;
  }

  /* ── render: carta ──────────────────────────────────────────────── */
  function cardHTML(card, cls) {
    const slots = shuffle(LAYOUTS[card.length].map(s => s.slice()));
    const syms = card.map((sym, i) => {
      const [x, y, r] = slots[i];
      const jx = (Math.random() - .5) * .07, jy = (Math.random() - .5) * .07;
      const rot = Math.round((Math.random() - .5) * 70);
      const sc = .82 + Math.random() * .32;
      /* fs em cqw: r é fração do raio ⇒ diâmetro do glifo ≈ r*sc do lado */
      const fs = (r * sc * 88).toFixed(1);
      return `<button class="db-sym" data-sym="${sym}"
        style="left:${(50 + (x + jx) * 44).toFixed(1)}%;top:${(50 + (y + jy) * 44).toFixed(1)}%;--rot:${rot}deg;font-size:${fs}cqw"
        aria-label="símbolo">${S.pool[sym]}</button>`;
    }).join('');
    return `<div class="db-card ${cls || ''}">${syms}</div>`;
  }

  function renderPair(anim) {
    const tw = root.querySelector('#db-top-wrap'), hw = root.querySelector('#db-hand-wrap');
    if (!tw || !hw) return;
    tw.innerHTML = cardHTML(S.top, anim ? 'db-in' : '');
    hw.innerHTML = cardHTML(S.hand, anim ? 'db-in2' : '');
    root.querySelectorAll('.db-sym').forEach(b => b.addEventListener('pointerdown', onSym, { passive: true }));
  }

  /* ── HUD ────────────────────────────────────────────────────────── */
  function hudHTML() {
    if (S.mode === 'classic') return `
      <span class="db-hud-cell">⏱ <b id="db-time">0.0</b>${t('s')}</span>
      <span class="db-hud-cell">🃏 <b id="db-prog">1/${CLASSIC_LEN}</b></span>`;
    if (S.mode === 'rush') return `
      <span class="db-hud-cell">⏱ <b id="db-time">${RUSH_TIME}</b>${t('s')}</span>
      <span class="db-hud-cell">✨ <b id="db-score">0</b></span>
      <span class="db-hud-cell db-combo" id="db-combo-w" hidden>🔥 <b id="db-combo">×1</b></span>`;
    if (S.mode === 'survival') return `
      <span class="db-hud-cell">${t('round')} <b id="db-round">1</b></span>
      <span class="db-hud-cell db-surv-w"><span class="db-surv"><span class="db-surv-fill" id="db-surv"></span></span></span>`;
    return `<span class="db-hud-cell">✔ <b id="db-score">0</b></span>`;
  }
  function updHud() {
    const q = id => root.querySelector('#' + id);
    if (S.mode === 'classic') {
      const el = q('db-time'); if (el) el.textContent = (S.time).toFixed(1);
      const p = q('db-prog'); if (p) p.textContent = `${Math.min(S.matches + 1, CLASSIC_LEN)}/${CLASSIC_LEN}`;
    } else if (S.mode === 'rush') {
      const el = q('db-time'); if (el) { el.textContent = Math.ceil(S.time); el.parentElement.classList.toggle('db-low', S.time <= 10); }
      const s = q('db-score'); if (s) s.textContent = S.score;
      const cw = q('db-combo-w'), c = q('db-combo');
      const mult = 1 + Math.floor(S.combo / 5);
      if (cw) cw.hidden = mult < 2;
      if (c) c.textContent = '×' + mult;
    } else if (S.mode === 'survival') {
      const r = q('db-round'); if (r) r.textContent = S.matches + 1;
      const f = q('db-surv'); if (f) {
        const pc = Math.max(0, S.roundLeft / S.roundMax);
        f.style.width = (pc * 100).toFixed(1) + '%';
        f.classList.toggle('db-low', pc < .35);
      }
    } else {
      const s = q('db-score'); if (s) s.textContent = S.matches;
    }
  }

  /* ── ciclo de jogo ──────────────────────────────────────────────── */
  function startTimer() {
    stopTimer();
    let last = performance.now(), lastTickS = -1;
    _tick = setInterval(() => {
      if (!S || S.paused || S.over) { last = performance.now(); return; }
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      if (S.mode === 'classic' || S.mode === 'zen') S.time += dt;
      else if (S.mode === 'rush') {
        S.time -= dt;
        if (S.time <= 5 && Math.ceil(S.time) !== lastTickS) { lastTickS = Math.ceil(S.time); sndTick(); }
        if (S.time <= 0) { S.time = 0; endGame('timeout'); return; }
      } else if (S.mode === 'survival') {
        S.roundLeft -= dt;
        if (S.roundLeft <= 0) { endGame('timeout'); return; }
      }
      updHud();
    }, 100);
  }
  function stopTimer() { if (_tick) { clearInterval(_tick); _tick = null; } }

  function startGame(mode, opts = {}) {
    S = newGame(mode, opts);
    if (mode === 'survival') S.roundLeft = S.roundMax;
    S.pairTs = performance.now();
    renderGame();
    if (mode !== 'zen') startTimer();
    else startTimer(); /* zen também conta tempo (só para stats) */
  }

  function onSym(e) {
    if (!S || S.over || S.paused || S._lock) return;
    const btn = e.currentTarget;
    const sym = +btn.dataset.sym;
    const target = shared(S.top, S.hand);
    if (sym === target) {
      const react = (performance.now() - S.pairTs) / 1000;
      if (S.bestReact == null || react < S.bestReact) S.bestReact = react;
      S.matches++; S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
      const pts = 1 + Math.floor(S.combo / 5);
      if (S.mode === 'rush') S.score += pts;
      sndHit(S.combo); vib(12);
      /* pop nos dois símbolos certos */
      root.querySelectorAll(`.db-sym[data-sym="${sym}"]`).forEach(el => el.classList.add('db-pop'));
      const float = document.createElement('span');
      float.className = 'db-float';
      float.textContent = S.mode === 'rush' ? `+${pts}` : '✔';
      btn.appendChild(float);
      updHud();
      if (S.mode === 'classic' && S.matches >= CLASSIC_LEN) { endGame('clear'); return; }
      S._lock = true;
      setTimeout(() => { if (!S || S.over) return; S._lock = false; nextPair(); renderPair(true); updHud(); }, 240);
    } else {
      S.wrongs++; S.combo = 0;
      sndMiss(); vib([40, 40, 40]);
      btn.classList.add('db-bad');
      const cardEl = btn.closest('.db-card');
      cardEl && cardEl.classList.add('db-shake');
      setTimeout(() => { btn.classList.remove('db-bad'); cardEl && cardEl.classList.remove('db-shake'); }, 420);
      if (S.mode === 'rush') { S.time = Math.max(0, S.time - 3); if (S.time <= 0) { endGame('timeout'); return; } }
      if (S.mode === 'survival') { endGame('wrong'); return; }
      updHud();
    }
  }

  function endGame(reason) {
    if (!S || S.over) return;
    S.over = true;
    stopTimer();
    const win = reason === 'clear' || (S.mode === 'rush' && S.matches > 0) || (S.mode === 'survival' && S.matches >= 5);
    sndEnd(win); vib(win ? [30, 40, 30, 40, 80] : 60);

    /* pontuação por modo */
    let score = null, lower = false, modeKey = S.mode + '-' + diff();
    if (S.mode === 'classic') { score = Math.round(S.time * 10) / 10; lower = true; }
    else if (S.mode === 'rush') score = S.score;
    else if (S.mode === 'survival') score = S.matches;
    if (S.daily) modeKey = 'daily';

    let rec = null;
    if (typeof GameProgress !== 'undefined' && S.matches + S.wrongs > 0) {
      rec = GameProgress.record('dobble', {
        won: S.mode === 'zen' ? undefined : win,
        score: score == null ? undefined : score,
        mode: modeKey, lowerIsBetter: lower,
        meta: { bestCombo: Math.max(S.bestCombo, (store().getStats() || {}).bestCombo || 0) },
        daily: S.daily,
        reaction: S.bestReact,
      });
    }
    renderEnd(reason, score, rec && rec.newBest);
  }

  /* ── ecrãs ──────────────────────────────────────────────────────── */
  function menuHTML() {
    const th = store().getPref('theme', 'mix');
    const labels = THEME_LABEL();
    const GP = typeof GameProgress !== 'undefined' ? GameProgress : null;
    const dailyDone = GP ? GP.isDailyDone('dobble') : false;
    const bc = bests('classic'), br = bests('rush'), bs = bests('survival');
    const modeCard = (id, icon, name, desc, best, bestFmt) => `
      <button class="db-mode" data-mode="${id}">
        <span class="db-mode-ico">${icon}</span>
        <span class="db-mode-body"><b>${name}</b><small>${desc}</small></span>
        <span class="db-mode-best">${t('best')}<b>${best != null ? bestFmt(best) : t('noBest')}</b></span>
      </button>`;
    return `
      <div class="db-menu">
        <div class="db-hero">
          <div class="db-hero-cards" aria-hidden="true">
            <span class="db-hc db-hc1"><i>🐸</i><i>⭐</i><i class="db-hc-match">🍕</i><i>🔑</i></span>
            <span class="db-hc db-hc2"><i class="db-hc-match">🍕</i><i>🐙</i><i>🎲</i><i>❄️</i></span>
          </div>
          <h2 class="db-title">${t('title')}</h2>
          <p class="db-tag">${t('tagline')}</p>
        </div>
        <button class="db-daily${dailyDone ? ' done' : ''}" data-mode="daily">
          <span class="db-mode-ico">📅</span>
          <span class="db-mode-body"><b>${t('daily')}${dailyDone ? ` · ${t('dailyDone')}` : ''}</b><small>${t('dailyD')}</small></span>
          <span class="db-mode-best">${t('best')}<b>${GP && GP.bestScore('dobble', 'daily') != null ? GP.bestScore('dobble', 'daily') : t('noBest')}</b></span>
        </button>
        <div class="db-modes">
          ${modeCard('classic', '🃏', t('mClassic'), fmt('mClassicD', { n: CLASSIC_LEN }), bc, v => v + t('s'))}
          ${modeCard('rush', '⚡', t('mRush'), t('mRushD'), br, v => v)}
          ${modeCard('survival', '💀', t('mSurvival'), t('mSurvivalD'), bs, v => v)}
          ${modeCard('zen', '🧘', t('mZen'), t('mZenD'), null, v => v)}
        </div>
        <div class="db-opts">
          <span class="db-opts-lbl">${t('theme')}</span>
          ${Object.keys(THEMES).map(k => `<button class="db-chip${k === th ? ' on' : ''}" data-theme="${k}">${labels[k]}</button>`).join('')}
          <span class="db-opts-spacer"></span>
          <label class="db-snd"><input type="checkbox" id="db-snd" ${soundOn() ? 'checked' : ''}> 🔊 ${t('sound')}</label>
          <button class="db-chip db-howto-btn" id="db-howto">${t('howto')}</button>
        </div>
      </div>`;
  }

  function renderMenu() {
    S = null; stopTimer();
    root.innerHTML = `<div class="db-wrap">${menuHTML()}</div>`;
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if (m === 'daily') {
        const seed = typeof GameProgress !== 'undefined' ? GameProgress.dailySeed('dobble') : 1234;
        startGame('rush', { seed, daily: true });
      } else startGame(m);
    }));
    root.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => {
      store().setPref('theme', b.dataset.theme);
      root.querySelectorAll('[data-theme]').forEach(x => x.classList.toggle('on', x === b));
    }));
    root.querySelector('#db-snd')?.addEventListener('change', e => store().setPref('sound', e.target.checked));
    root.querySelector('#db-howto')?.addEventListener('click', showHowto);
  }

  function showHowto() {
    const ov = document.createElement('div');
    ov.className = 'db-overlay';
    ov.innerHTML = `
      <div class="db-modal">
        <h3>${t('howtoT')}</h3>
        <div class="db-how-step"><span>1️⃣</span><p>${t('how1')}</p></div>
        <div class="db-how-step"><span>2️⃣</span><p>${t('how2')}</p></div>
        <div class="db-how-step"><span>3️⃣</span><p>${t('how3')}</p></div>
        <div class="db-how-demo" aria-hidden="true">
          <span class="db-hc"><i>🦊</i><i class="db-hc-match">🎯</i><i>🍩</i><i>💧</i></span>
          <span class="db-hc"><i>⏰</i><i>🐢</i><i class="db-hc-match">🎯</i><i>🌵</i></span>
        </div>
        <button class="db-btn db-btn-primary" data-close>${t('gotIt')}</button>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) ov.remove(); });
    root.appendChild(ov);
  }

  function renderGame() {
    root.innerHTML = `
      <div class="db-wrap db-playing">
        <div class="db-hud">
          <button class="db-hud-btn" id="db-quit" aria-label="${t('quit')}">✕</button>
          <div class="db-hud-mid">${hudHTML()}</div>
          <button class="db-hud-btn" id="db-pause" aria-label="${t('pause')}">⏸</button>
        </div>
        <div class="db-table">
          <div class="db-card-wrap" id="db-top-wrap"></div>
          <div class="db-vs" aria-hidden="true">👁️</div>
          <div class="db-card-wrap" id="db-hand-wrap"></div>
        </div>
        ${S.mode === 'zen' ? `<button class="db-btn db-zen-exit" id="db-zen-exit">${t('zenExit')}</button>` : ''}
      </div>`;
    renderPair(true);
    updHud();
    root.querySelector('#db-quit').addEventListener('click', () => {
      if (S.mode === 'zen' && S.matches > 0) { endGame('zen'); return; }
      renderMenu();
    });
    root.querySelector('#db-pause').addEventListener('click', pauseGame);
    root.querySelector('#db-zen-exit')?.addEventListener('click', () => endGame('zen'));
  }

  function pauseGame() {
    if (!S || S.over || S.paused) return;
    S.paused = true;
    const ov = document.createElement('div');
    ov.className = 'db-overlay';
    ov.id = 'db-pause-ov';
    ov.innerHTML = `
      <div class="db-modal">
        <h3>${t('paused')}</h3>
        <button class="db-btn db-btn-primary" data-resume>▶ ${t('resume')}</button>
        <button class="db-btn" data-quit>${t('quit')}</button>
      </div>`;
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-resume]')) { S.paused = false; S.pairTs = performance.now(); ov.remove(); }
      else if (e.target.closest('[data-quit]')) { ov.remove(); renderMenu(); }
    });
    root.appendChild(ov);
  }

  function renderEnd(reason, score, newBest) {
    const acc = S.matches + S.wrongs > 0 ? Math.round(100 * S.matches / (S.matches + S.wrongs)) : 100;
    const big = S.mode === 'classic' ? (reason === 'clear' ? score + t('s') : '—')
      : S.mode === 'rush' ? S.score
      : S.mode === 'survival' ? S.matches
      : S.matches;
    const head = reason === 'clear' ? t('clear') : reason === 'timeout' ? t('timeout') : reason === 'wrong' ? t('wrongEnd') : t('over');
    root.innerHTML = `
      <div class="db-wrap">
        <div class="db-end">
          ${newBest ? `<div class="db-confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>` : ''}
          <div class="db-end-head">${head}</div>
          <div class="db-end-score${newBest ? ' rec' : ''}">${big}</div>
          ${newBest ? `<div class="db-end-rec">${t('newRecord')}</div>` : ''}
          <div class="db-end-stats">
            <div><b>${S.matches}</b><small>${t('matches')}</small></div>
            <div><b>${acc}%</b><small>${t('accuracy')}</small></div>
            <div><b>${S.bestReact != null ? S.bestReact.toFixed(2) + t('s') : '—'}</b><small>${t('bestReaction')}</small></div>
            ${S.bestCombo >= 2 ? `<div><b>×${S.bestCombo}</b><small>${t('combo')}</small></div>` : ''}
          </div>
          <div class="db-end-btns">
            <button class="db-btn db-btn-primary" id="db-again">${t('playAgain')}</button>
            <button class="db-btn" id="db-menu">${t('backMenu')}</button>
          </div>
        </div>
      </div>`;
    const mode = S.mode, daily = S.daily;
    root.querySelector('#db-again').addEventListener('click', () => {
      if (daily) { const seed = typeof GameProgress !== 'undefined' ? GameProgress.dailySeed('dobble') : 1234; startGame('rush', { seed, daily: true }); }
      else startGame(mode);
    });
    root.querySelector('#db-menu').addEventListener('click', renderMenu);
  }

  /* ── conquistas ─────────────────────────────────────────────────── */
  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('dobble', [
      { id: 'db.first',   name: 'Olho Aberto',     icon: '👁️', desc: 'Joga a tua primeira partida de Olho Vivo.', test: c => c.stats.plays >= 1 },
      { id: 'db.rush25',  name: 'Ritmo Frenético', icon: '⚡', desc: '25+ pontos num Contra-Relógio.',           test: c => /^(rush|daily)/.test(c.result.mode || '') && (c.result.score || 0) >= 25 },
      { id: 'db.combo10', name: 'Em Chamas',       icon: '🔥', desc: 'Combo de 10 acertos seguidos.',            test: c => ((c.result.meta || {}).bestCombo || 0) >= 10 },
      { id: 'db.classic', name: 'Relâmpago',       icon: '🌩️', desc: 'Clássico completo em menos de 45s.',      test: c => /^classic/.test(c.result.mode || '') && c.result.won && (c.result.score || 999) < 45 },
      { id: 'db.surv15',  name: 'Sobrevivente',    icon: '💀', desc: '15 rondas na Morte Súbita.',               test: c => /^survival/.test(c.result.mode || '') && (c.result.score || 0) >= 15 },
      { id: 'db.snap',    name: 'Reflexo Felino',  icon: '🐈', desc: 'Encontra um símbolo em menos de 1 segundo.', test: c => (c.result.reaction || 99) < 1 },
      { id: 'db.daily',   name: 'Ritual Diário',   icon: '📅', desc: 'Completa o desafio do dia.',               test: c => c.result.mode === 'daily' },
    ]);
  }

  /* ── CSS ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('dobble-css')) return;
    const s = document.createElement('style'); s.id = 'dobble-css';
    s.textContent = `
#pane-dobble{--db-gold:#f2b344;--db-ink:#0d1020}
.db-wrap{max-width:860px;margin:0 auto;padding:6px 4px 20px}
/* ── menu ── */
.db-hero{text-align:center;padding:14px 8px 4px}
.db-hero-cards{display:flex;justify-content:center;gap:14px;margin-bottom:10px}
.db-hc{position:relative;width:92px;height:92px;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.10),rgba(255,255,255,.02) 60%),var(--card,#14162a);border:2px solid rgba(242,179,68,.35);box-shadow:0 8px 24px rgba(0,0,0,.35);display:grid;grid-template-columns:1fr 1fr;place-items:center;font-size:1.5rem}
.db-hc i{font-style:normal;transform:rotate(var(--r,0deg))}
.db-hc i:nth-child(1){--r:-15deg}.db-hc i:nth-child(2){--r:20deg}.db-hc i:nth-child(3){--r:8deg}.db-hc i:nth-child(4){--r:-24deg}
.db-hc1{transform:rotate(-7deg)}.db-hc2{transform:rotate(6deg)}
.db-hc-match{animation:dbPulse 1.6s ease-in-out infinite;filter:drop-shadow(0 0 6px var(--db-gold))}
@keyframes dbPulse{0%,100%{transform:scale(1) rotate(var(--r,0deg))}50%{transform:scale(1.28) rotate(var(--r,0deg))}}
.db-title{font-family:'Space Grotesk',sans-serif;font-size:1.7rem;font-weight:800;margin:2px 0;background:linear-gradient(120deg,#fbc75f,#f2b344 45%,#fb923c);-webkit-background-clip:text;background-clip:text;color:transparent}
.db-tag{color:var(--muted,#9aa);font-size:.9rem;max-width:460px;margin:0 auto 14px}
.db-daily,.db-mode{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--card,rgba(255,255,255,.03));border:1px solid var(--border,rgba(255,255,255,.08));border-radius:14px;padding:12px 14px;cursor:pointer;color:inherit;transition:border-color .18s,transform .18s,box-shadow .18s}
.db-daily:hover,.db-mode:hover{border-color:rgba(242,179,68,.5);transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.25)}
.db-daily{margin-bottom:12px;border-color:rgba(242,179,68,.35);background:linear-gradient(120deg,rgba(242,179,68,.10),rgba(251,146,60,.05)),var(--card,rgba(255,255,255,.03))}
.db-daily.done{opacity:.75}
.db-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.db-mode-ico{font-size:1.7rem;flex:0 0 auto}
.db-mode-body{min-width:0;flex:1}
.db-mode-body b{display:block;font-size:.95rem}
.db-mode-body small{color:var(--muted,#9aa);font-size:.74rem;line-height:1.3;display:block;margin-top:2px}
.db-mode-best{flex:0 0 auto;text-align:right;font-size:.62rem;color:var(--muted,#9aa);text-transform:uppercase;letter-spacing:.06em}
.db-mode-best b{display:block;font-size:.95rem;color:var(--db-gold);letter-spacing:0}
.db-opts{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:16px}
.db-opts-lbl{font-size:.72rem;color:var(--muted,#9aa);text-transform:uppercase;letter-spacing:.08em}
.db-opts-spacer{flex:1}
.db-chip{border:1px solid var(--border,rgba(255,255,255,.12));background:transparent;color:inherit;border-radius:999px;padding:5px 12px;font-size:.8rem;cursor:pointer;transition:all .15s}
.db-chip.on{background:rgba(242,179,68,.16);border-color:var(--db-gold);color:var(--db-gold)}
.db-snd{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:var(--muted,#9aa);cursor:pointer}
/* ── jogo ── */
.db-hud{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.db-hud-mid{flex:1;display:flex;justify-content:center;gap:16px;flex-wrap:wrap}
.db-hud-cell{font-size:.95rem;color:var(--muted,#9aa);display:inline-flex;align-items:center;gap:5px}
.db-hud-cell b{color:inherit;font-variant-numeric:tabular-nums;color:#fff;font-size:1.05rem}
[data-theme=light] .db-hud-cell b{color:#111}
.db-hud-cell.db-low b{color:#ef4444;animation:dbBlink .5s steps(2) infinite}
@keyframes dbBlink{50%{opacity:.4}}
.db-combo b{color:var(--db-gold)!important}
.db-hud-btn{width:38px;height:38px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--card,rgba(255,255,255,.04));color:inherit;font-size:1rem;cursor:pointer}
.db-surv-w{flex:1;min-width:120px;max-width:260px}
.db-surv{display:block;width:100%;height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.db-surv-fill{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#f2b344,#fb923c);transition:width .1s linear}
.db-surv-fill.db-low{background:linear-gradient(90deg,#ef4444,#f97316)}
.db-table{display:flex;flex-direction:column;align-items:center;gap:6px}
.db-vs{font-size:1.2rem;opacity:.5;line-height:1}
.db-card-wrap{width:min(86vw,340px,calc((100dvh - 235px)/2));aspect-ratio:1;position:relative}
@media (min-width:760px){
  .db-table{flex-direction:row;justify-content:center;gap:18px}
  .db-card-wrap{width:min(340px,38vw,58vh)}
  .db-vs{font-size:1.5rem}
}
.db-card{position:absolute;inset:0;border-radius:50%;container-type:size;background:
  radial-gradient(circle at 30% 25%,rgba(255,255,255,.10),rgba(255,255,255,0) 55%),
  radial-gradient(circle at 70% 80%,rgba(242,179,68,.06),rgba(242,179,68,0) 50%),
  var(--card,#14162a);
  border:2px solid rgba(242,179,68,.28);box-shadow:0 14px 34px rgba(0,0,0,.4),inset 0 0 0 6px rgba(255,255,255,.025)}
[data-theme=light] .db-card{background:radial-gradient(circle at 30% 25%,#fff,#f2f0ea 70%);border-color:rgba(200,140,30,.4)}
.db-card.db-in{animation:dbIn .26s cubic-bezier(.2,1,.3,1)}
.db-card.db-in2{animation:dbIn2 .26s cubic-bezier(.2,1,.3,1)}
@keyframes dbIn{from{transform:scale(.6) rotate(14deg);opacity:0}to{transform:none;opacity:1}}
@keyframes dbIn2{from{transform:scale(.85);opacity:.4}to{transform:none;opacity:1}}
.db-card.db-shake{animation:dbShake .4s}
@keyframes dbShake{0%,100%{transform:none}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
.db-sym{position:absolute;transform:translate(-50%,-50%) rotate(var(--rot,0deg));background:none;border:none;padding:.06em;cursor:pointer;line-height:1;user-select:none;-webkit-tap-highlight-color:transparent;transition:transform .12s}
.db-sym:active{transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.15)}
.db-sym.db-pop{animation:dbPop .3s cubic-bezier(.2,1.4,.4,1)}
@keyframes dbPop{40%{transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.55)}100%{transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.2)}}
.db-sym.db-bad{animation:dbBad .35s}
@keyframes dbBad{0%,100%{filter:none}50%{filter:drop-shadow(0 0 10px #ef4444) grayscale(.4)}}
.db-float{position:absolute;left:50%;top:-6px;transform:translateX(-50%);font-size:.5em;font-weight:900;color:var(--db-gold);pointer-events:none;animation:dbFloat .7s forwards}
@keyframes dbFloat{to{transform:translate(-50%,-26px);opacity:0}}
.db-zen-exit{margin:14px auto 0;display:block}
/* ── overlay/modal ── */
.db-overlay{position:absolute;inset:0;z-index:30;background:rgba(6,8,18,.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:16px;border-radius:inherit}
.db-modal{width:min(430px,94%);background:var(--card,#14162a);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 22px 60px rgba(0,0,0,.5)}
.db-modal h3{margin:0;font-size:1.15rem}
.db-how-step{display:flex;gap:10px;align-items:flex-start}
.db-how-step span{font-size:1.1rem}
.db-how-step p{margin:0;font-size:.86rem;color:var(--muted,#bbc);line-height:1.45}
.db-how-demo{display:flex;justify-content:center;gap:12px;padding:4px 0}
.db-how-demo .db-hc{width:76px;height:76px;font-size:1.2rem}
.db-btn{border:1px solid var(--border,rgba(255,255,255,.14));background:var(--card,rgba(255,255,255,.05));color:inherit;border-radius:11px;padding:10px 16px;font-size:.92rem;font-weight:600;cursor:pointer;transition:all .15s}
.db-btn:hover{border-color:rgba(242,179,68,.5)}
.db-btn-primary{background:linear-gradient(120deg,#f2b344,#fb923c);border:none;color:#1a1206}
/* ── fim ── */
.db-end{position:relative;text-align:center;padding:34px 12px;overflow:hidden}
.db-end-head{font-size:1.05rem;color:var(--muted,#9aa)}
.db-end-score{font-family:'Space Grotesk',sans-serif;font-size:3.4rem;font-weight:800;line-height:1.1;margin:6px 0}
.db-end-score.rec{background:linear-gradient(120deg,#fbc75f,#f2b344,#fb923c);-webkit-background-clip:text;background-clip:text;color:transparent}
.db-end-rec{color:var(--db-gold);font-weight:700;margin-bottom:6px}
.db-end-stats{display:flex;justify-content:center;gap:22px;flex-wrap:wrap;margin:16px 0 20px}
.db-end-stats>div b{display:block;font-size:1.15rem}
.db-end-stats>div small{color:var(--muted,#9aa);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}
.db-end-btns{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.db-confetti{position:absolute;inset:0;pointer-events:none}
.db-confetti i{position:absolute;top:-12px;left:calc(var(--i)*5.5%);width:8px;height:12px;border-radius:2px;background:hsl(calc(var(--i)*47),85%,60%);animation:dbConf 1.9s calc(var(--i)*.09s) ease-in forwards}
@keyframes dbConf{to{transform:translateY(115vh) rotate(720deg);opacity:.4}}
@media (prefers-reduced-motion:reduce){
  .db-hc-match,.db-card.db-in,.db-card.db-in2,.db-card.db-shake,.db-sym.db-pop,.db-confetti i,.db-hud-cell.db-low b{animation:none!important}
}`;
    document.head.appendChild(s);
  }

  /* ── init ───────────────────────────────────────────────────────── */
  let _wired = false;
  function init(paneEl) {
    root = paneEl;
    if (!root) return;
    root.style.position = 'relative';
    injectCSS();
    if (_hasGD) GameData.load('dobble').then(d => { t.use(d.i18n); if (!S) renderMenu(); });
    renderMenu();
    if (!_wired) {
      _wired = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && S && !S.over && !S.paused && S.mode !== 'zen') pauseGame();
      });
      document.addEventListener('routechange', e => {
        const h = (e.detail || '');
        if (!/^games\/dobble/.test(h) && S && !S.over) { stopTimer(); S = null; renderMenu(); }
      });
      document.addEventListener('langchange', () => { if (!S) renderMenu(); });
    }
  }

  /* hooks de teste (headless não corre timers de jogo de forma fiável) */
  function _debug() {
    return S ? { mode: S.mode, n: S.n, top: S.top, hand: S.hand, shared: shared(S.top, S.hand), score: S.score, matches: S.matches, time: S.time, over: S.over } : null;
  }
  function _tap(sym) {
    const btn = root && root.querySelector(`.db-sym[data-sym="${sym}"]`);
    if (btn) btn.dispatchEvent(new Event('pointerdown'));
    return _debug();
  }

  return { init, _debug, _tap, _genDeck: genDeck };
})();
window.DobbleGame = DobbleGame;
