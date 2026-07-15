/* ══════════════════════════════════════════════════════════════════
   DobbleGame — "Olho Vivo": encontra o único símbolo comum entre duas
   cartas. Baralho gerado por plano projetivo de ordem prima n (qualquer
   par de cartas partilha EXATAMENTE um símbolo — garantia matemática).

   Dificuldade (redefinida por tamanho/variedade visual, não só nº):
     • Fácil   n=5 → 6 símbolos/carta, TODOS do mesmo tamanho, quase sem
                     rotação  → o olho identifica depressa.
     • Médio   n=5 → 6 símbolos/carta, tamanhos e rotações variados.
     • Difícil n=7 → 8 símbolos/carta, tamanhos e rotações variados (mais
                     amplos) → o clássico, bem mais exigente.

   Símbolos = emoji (offline, zero assets externos). 13 temas de 57
   símbolos cada, num REGISTO fácil de expandir (basta juntar um objeto
   { icon, name, emojis:[57] } a THEMES — nada mais a mexer).

   Modos: Clássico (limpa a pilha, tempo conta), Contra-Relógio (60s,
   combos), Morte Súbita (tempo por ronda encolhe, um erro acaba) e Zen.

   Camada premium (Anime.js, global `anime`, com fallback total sem lib e
   com prefers-reduced-motion): entrada "dealt" das cartas com stagger dos
   símbolos, burst de partículas + anel ao acertar, olho central reativo
   (pisca, dilata, anel de tempo na Morte Súbita, chama de combo no
   Contra-Relógio), parallax/profundidade nas cartas ao mover o ponteiro,
   sons WebAudio mais ricos (acerto em camadas + faísca, fanfarra de combo,
   swoosh de troca) e vinheta de perigo. Tudo transform/opacity, curto e
   auto-limpo — o jogo funciona exatamente igual sem a camada.

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
      difficulty: 'Dificuldade', dEasy: 'Fácil', dMedium: 'Médio', dHard: 'Difícil',
      dHint_easy: 'Símbolos do mesmo tamanho — mais fácil de identificar.',
      dHint_medium: 'Número normal de símbolos, tamanhos e rotações variados.',
      dHint_hard: 'Mais símbolos por carta, tamanhos e rotações variados.',
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
      difficulty: 'Difficulty', dEasy: 'Easy', dMedium: 'Medium', dHard: 'Hard',
      dHint_easy: 'Symbols all the same size — easier to spot.',
      dHint_medium: 'Normal symbol count, varied sizes and rotations.',
      dHint_hard: 'More symbols per card, varied sizes and rotations.',
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
  const LANG = () => (_hasGD ? GameData.lang() : 'pt');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const store = () => (typeof GameProgress !== 'undefined')
    ? GameProgress.store('dobble')
    : { getPref: (k, d) => d, setPref: () => {}, getStats: () => ({}), updateStats: () => {} };

  /* ── motion (Anime.js global) com fallback total ─────────────────── */
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const AOK = () => typeof anime !== 'undefined' && !reduced();

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

  /* ── REGISTO de temas (57 emoji distintos cada — suporta n=7 = 57
     símbolos; para adicionar um tema novo basta juntar aqui um objeto
     { icon, name:{pt,en}, emojis:[57 distintos] }) ─────────────────── */
  const THEMES = {
    mix:       { icon: '🎨', name: { pt: 'Mistura', en: 'Mix' },        emojis: ['⚽','🏀','🎾','🎲','🎯','🎸','🎺','🥁','🎁','🎈','⭐','🌙','☀️','🌈','❄️','🔥','💧','🍀','🌵','🌸','🍄','🌍','🍎','🍌','🍒','🍇','🍉','🥕','🍩','🍕','🐶','🐱','🐭','🦊','🐻','🐼','🐸','🐙','🦋','🐞','🐢','🐬','🦉','🐝','👑','💎','🔑','🔒','✂️','✏️','📌','⏰','🔔','💡','🧲','⚓','🚀'] },
    animals:   { icon: '🐾', name: { pt: 'Animais', en: 'Animals' },    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦀','🐡','🐠','🐟','🐬','🐳','🦈','🐊','🐘','🦏','🐪','🦒','🦓','🦍','🐎','🐑','🐐','🦇'] },
    food:      { icon: '🍔', name: { pt: 'Comida', en: 'Food' },        emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🍍','🥝','🥥','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥒','🥦','🍄','🥜','🌰','🍞','🥐','🥖','🥨','🥞','🧀','🍖','🍗','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🍿','🍳','🍤','🍦','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍯','☕'] },
    space:     { icon: '🚀', name: { pt: 'Espaço', en: 'Space' },       emojis: ['🚀','🛸','🛰️','🌍','🌎','🌏','🌙','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌚','🌝','⭐','🌟','✨','💫','☄️','🪐','🌌','🌠','☀️','🌞','🔭','👨‍🚀','👩‍🚀','👽','👾','🤖','🌈','🌋','⚡','🔥','❄️','💧','🌪️','☁️','⛅','🌡️','🧭','🔋','📡','🎇','🎆','🔦','💡','🧨','🎈','🪂','🕳️','⏳','⌛','🌀'] },
    transport: { icon: '🚗', name: { pt: 'Transportes', en: 'Transport' }, emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🚁','🚤','⛵','🛥️','🛳️','⛴️','🚢','⚓','🛶','🚧','🛺','🚏','🗺️'] },
    sport:     { icon: '⚽', name: { pt: 'Desporto', en: 'Sports' },    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🏋️','🤼','🤸','⛹️','🤺','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚴','🚵','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️'] },
    music:     { icon: '🎵', name: { pt: 'Música', en: 'Music' },       emojis: ['🎵','🎶','🎼','🎤','🎧','🎷','🎸','🎹','🎺','🎻','🪕','🥁','🪘','📻','🎙️','🎚️','🎛️','📀','💿','🔊','🔉','🔈','📢','📣','🔔','🎪','🎭','🩰','💃','🕺','👯','🎊','🎉','🪩','🎫','🎟️','🎬','📺','📱','🎨','🖌️','🎯','🎲','🃏','🎰','🕹️','🎮','🧩','🎳','🎱','🪗','📯','🔕','🎠','🎡','🎢','🤹'] },
    objects:   { icon: '🧰', name: { pt: 'Objetos', en: 'Objects' },    emojis: ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💾','💿','📷','📸','🎥','📞','☎️','📟','📠','📺','📻','🧭','⏰','⏳','🔋','🔌','💡','🔦','🕯️','🧯','🛢️','💸','💵','💳','🧾','✉️','📦','📪','✏️','🖊️','🖍️','📐','📏','📌','📎','✂️','🔒','🔑','🔨','🪓','🔧','🔩','⚙️','🧲','🔫','💣','🧨','🔪','🛎️','🧸'] },
    nature:    { icon: '🌿', name: { pt: 'Natureza', en: 'Nature' },    emojis: ['🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🎍','🌾','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🍁','🍂','🍃','🍄','🐚','🌰','🪨','🪵','🌊','💧','🔥','⛰️','🏔️','🌋','🏕️','🏝️','🏜️','🌅','🌄','🌈','☀️','🌤️','⛅','🌦️','🌧️','⛈️','🌩️','❄️','☃️','⛄','🌬️','🌪️','🌫️','🌙','⭐','🌟','🐝','🦋','🐞'] },
    tech:      { icon: '💻', name: { pt: 'Tecnologia', en: 'Tech' },    emojis: ['💻','🖥️','⌨️','🖱️','🖨️','💾','💿','📀','🕹️','🎮','👾','🤖','📱','📲','☎️','📞','📟','📠','🔋','🔌','💡','🔦','📡','🛰️','🚀','⚙️','🔧','🔩','🪛','🧰','🧲','🔬','🔭','🧪','🧫','🧬','⚗️','🩺','💉','🌡️','⏱️','⏲️','⏰','📷','📹','📽️','🎥','📺','📻','🎙️','🎚️','🎛️','💽','🖲️','🧮','📇','🗜️'] },
    cartoon:   { icon: '🦄', name: { pt: 'Desenhos', en: 'Cartoon' },   emojis: ['🦄','🐲','🐉','🧚','🧚‍♀️','🧜','🧜‍♀️','🧙','🧙‍♂️','🧛','🧟','🧞','👽','👾','🤖','👻','💀','☠️','👹','👺','👿','😈','🤡','🎃','🦸','🦹','🧌','🐸','🐵','🙈','🙉','🙊','🐶','🐱','🐰','🐼','🦊','🦁','🐷','🐨','🦖','🦕','🐙','🦑','🦋','🐝','🌈','⭐','🍄','🔮','🪄','🎩','👑','💎','🧸','🪅','🎈'] },
    hero:      { icon: '🦸', name: { pt: 'Super-heróis', en: 'Heroes' }, emojis: ['🦸','🦹','🦸‍♂️','🦸‍♀️','🦹‍♂️','🦹‍♀️','🥷','🦾','🦿','🛡️','⚔️','🗡️','🏹','🔫','💥','🔥','❄️','⚡','🌪️','☄️','💫','⭐','🌟','👊','✊','🤛','🤜','🦅','🕷️','🕸️','🦇','🐍','🐉','👁️','🧿','💪','🎭','🥽','🥼','👑','💎','🔱','⚜️','🚀','🛸','🧨','💣','🏆','🎯','🧲','🔦','🗿','🌋','🌀','♨️','🆘','⚠️'] },
    faces:     { icon: '😀', name: { pt: 'Emojis', en: 'Emojis' },      emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎'] },
  };
  const THEME_KEYS = Object.keys(THEMES);
  const themeName = k => (THEMES[k] && THEMES[k].name[LANG()]) || (THEMES[k] && THEMES[k].name.pt) || k;

  /* ── dificuldade → ordem do plano + regras visuais ──────────────── */
  function diff() { return _hasGD ? GameData.difficulty() : 'medium'; }
  function setDiff(d) {
    try {
      if (typeof GameHost !== 'undefined' && GameHost.setDifficulty) GameHost.setDifficulty(d);
      else localStorage.setItem('quiz-difficulty', d);
    } catch (e) {}
  }
  /* n = ordem do plano (5→6 símbolos, 7→8); sizeVar 0 = todos iguais;
     rotMax = amplitude de rotação; jitter = deslocamento no slot; surv =
     segundos por carta na Morte Súbita. */
  const DIFF = {
    easy:   { n: 5, sizeVar: 0,    rotMax: 10, jitter: .045, surv: 10 },
    medium: { n: 5, sizeVar: .36,  rotMax: 55, jitter: .07,  surv: 8 },
    hard:   { n: 7, sizeVar: .48,  rotMax: 85, jitter: .085, surv: 8 },
  };
  const cfgDiff = () => DIFF[diff()] || DIFF.medium;

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

  /* ── sons (WebAudio local, curto e discreto) ───────────────────── */
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
  function spark(ctx, when) {                          /* faísca aguda (ruído filtrado) */
    when = when || 0;
    const len = Math.floor(ctx.sampleRate * 0.05);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.05, ctx.currentTime + when);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + when + .06);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime + when);
  }
  const sndHit = combo => snd(c => {
    const k = Math.min(combo, 12) / 12, base = 460 * Math.pow(2, k * .85);
    beep(c, base, .14, 'sine', .13);
    beep(c, base * 1.5, .12, 'triangle', .05, .012);
    spark(c, 0);
  });
  const sndCombo = mult => snd(c => [0, 4, 7, 12].forEach((st, i) => beep(c, 392 * Math.pow(2, (mult + st) / 12), .15, 'sine', .09, i * .06)));
  const sndSwoosh = () => snd(c => { beep(c, 620, .12, 'sine', .05); beep(c, 300, .12, 'sine', .04, .04); });
  const sndMiss = () => snd(c => beep(c, 150, .16, 'square', .08));
  const sndTick = () => snd(c => beep(c, 900, .04, 'sine', .05));
  const sndEnd  = win => snd(c => { const f = win ? [523, 659, 784, 1047] : [330, 262]; f.forEach((q, i) => beep(c, q, .16, 'sine', .12, i * .13)); });
  const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  /* ── estado ─────────────────────────────────────────────────────── */
  let root = null, S = null, _tick = null, _eyeIdle = null;
  const CLASSIC_LEN = 15;
  const RUSH_TIME = 60;
  const RING_CIRC = 2 * Math.PI * 34;                  /* svg do anel do olho */

  function bests(mode) {
    if (typeof GameProgress === 'undefined') return null;
    return GameProgress.bestScore('dobble', mode + '-' + diff());
  }

  /* ── construção de uma partida ─────────────────────────────────── */
  function newGame(mode, opts = {}) {
    const cfg = cfgDiff();
    const seed = opts.seed != null ? opts.seed : ((Math.random() * 0xffffffff) >>> 0);
    const rnd = rng(seed);
    const theme = THEMES[store().getPref('theme', 'mix')] ? store().getPref('theme', 'mix') : 'mix';
    const pool = shuffle(THEMES[theme].emojis.slice(), rnd);   /* símbolo i → emoji */
    const deck = shuffle(genDeck(cfg.n), rnd);
    return {
      mode, n: cfg.n, seed, daily: !!opts.daily,
      pool, deck, di: 2,                     /* deck[0]=mão, deck[1]=mesa, di = próxima */
      hand: deck[0], top: deck[1],
      score: 0, matches: 0, wrongs: 0, combo: 0, bestCombo: 0,
      time: mode === 'rush' ? RUSH_TIME : 0, /* rush conta para baixo; clássico/zen para cima */
      roundMax: cfg.surv,                    /* morte súbita: s por carta */
      roundLeft: 0,
      pairTs: 0, bestReact: null,
      paused: false, over: false, _lock: false, startTs: Date.now(),
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
  function cardHTML(card, deal) {
    const cfg = cfgDiff();
    const slots = shuffle(LAYOUTS[card.length].map(s => s.slice()));
    const syms = card.map((sym, i) => {
      const [x, y, r] = slots[i];
      const jx = (Math.random() - .5) * cfg.jitter, jy = (Math.random() - .5) * cfg.jitter;
      const rot = Math.round((Math.random() - .5) * 2 * cfg.rotMax);
      const sc = cfg.sizeVar ? (1 - cfg.sizeVar / 2) + Math.random() * cfg.sizeVar : 1;
      const fs = (r * sc * 88).toFixed(1);
      const dp = (.4 + Math.random() * .6).toFixed(2);   /* profundidade p/ parallax */
      return `<button class="db-sym" data-sym="${sym}" data-dp="${dp}"
        style="left:${(50 + (x + jx) * 44).toFixed(1)}%;top:${(50 + (y + jy) * 44).toFixed(1)}%;--rot:${rot}deg;--d:${i * 24}ms;font-size:${fs}cqw"
        aria-label="símbolo">${S.pool[sym]}</button>`;
    }).join('');
    return `<div class="db-card${deal ? ' db-deal' : ''}">${syms}</div>`;
  }

  function renderPair(anim) {
    const tw = root.querySelector('#db-top-wrap'), hw = root.querySelector('#db-hand-wrap');
    if (!tw || !hw) return;
    tw.innerHTML = cardHTML(S.top, anim);
    hw.innerHTML = cardHTML(S.hand, anim);
    root.querySelectorAll('.db-sym').forEach(b => b.addEventListener('pointerdown', onSym, { passive: true }));
    if (anim) animCards();
  }

  /* entrada "dealt": containers das cartas animam com Anime.js; os
     símbolos entram em stagger por CSS (classe db-deal) para compor com
     o translate(-50%) que os centra. */
  function animCards() {
    if (!AOK()) return;
    const top = root.querySelector('#db-top-wrap .db-card'), hand = root.querySelector('#db-hand-wrap .db-card');
    [[top, -1], [hand, 1]].forEach(([c, dir]) => {
      if (!c) return;
      anime.remove(c);
      anime({
        targets: c, translateY: [dir * 40, 0], scale: [.74, 1], rotate: [dir * -7, 0], opacity: [0, 1],
        duration: 480, easing: 'cubicBezier(.2,1.05,.3,1)',
        complete: () => { c.style.transform = ''; c.style.opacity = ''; },
      });
    });
  }

  /* ── parallax/profundidade das cartas ao mover o ponteiro ──────── */
  function wireParallax() {
    if (!AOK()) return;
    const table = root.querySelector('.db-table');
    if (!table) return;
    let raf = 0, ev = null;
    const apply = () => {
      raf = 0; if (!ev) return;
      root.querySelectorAll('.db-card-wrap').forEach(wrap => {
        const r = wrap.getBoundingClientRect();
        const dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const k = (Math.abs(dx) < 1.7 && Math.abs(dy) < 1.7) ? 1 : 0;
        const card = wrap.querySelector('.db-card');
        if (card && !card._busy) card.style.transform = `perspective(760px) rotateY(${(-dx * 6 * k).toFixed(2)}deg) rotateX(${(dy * 6 * k).toFixed(2)}deg)`;
        wrap.querySelectorAll('.db-sym').forEach(s => {
          const dp = +s.dataset.dp || .6;
          s.style.setProperty('--px', (-dx * dp * 11 * k).toFixed(1) + 'px');
          s.style.setProperty('--py', (-dy * dp * 11 * k).toFixed(1) + 'px');
        });
      });
    };
    table.addEventListener('pointermove', e => { ev = e; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
    table.addEventListener('pointerleave', () => {
      root.querySelectorAll('.db-card').forEach(c => { c.style.transform = ''; });
      root.querySelectorAll('.db-sym').forEach(s => { s.style.setProperty('--px', '0px'); s.style.setProperty('--py', '0px'); });
    }, { passive: true });
  }

  /* ── burst de partículas + anel ao acertar ─────────────────────── */
  function burst(btn) {
    if (!AOK()) return;
    const wrap = btn.closest('.db-card-wrap'); if (!wrap) return;
    const wr = wrap.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const x = br.left + br.width / 2 - wr.left, y = br.top + br.height / 2 - wr.top;
    const layer = document.createElement('div');
    layer.className = 'db-fx'; layer.style.left = x + 'px'; layer.style.top = y + 'px';
    wrap.appendChild(layer);
    const ring = document.createElement('span'); ring.className = 'db-ring'; layer.appendChild(ring);
    anime({ targets: ring, scale: [0, 2.6], opacity: [.9, 0], duration: 540, easing: 'easeOutQuad' });
    const parts = [];
    for (let i = 0; i < 8; i++) { const p = document.createElement('i'); p.className = 'db-spark'; layer.appendChild(p); parts.push(p); }
    anime({
      targets: parts,
      translateX: () => anime.random(-46, 46), translateY: () => anime.random(-46, 46),
      scale: [1, 0], opacity: [1, 0], rotate: () => anime.random(-140, 140),
      duration: () => anime.random(440, 700), easing: 'easeOutQuad',
      complete: () => layer.remove(),
    });
  }

  /* ── olho central reativo ──────────────────────────────────────── */
  function eyeReact(kind) {
    const eye = root && root.querySelector('#db-eye');
    if (!eye || !AOK()) return;
    const g = eye.querySelector('.db-eye-glyph'); if (!g) return;
    if (kind === 'hit') {
      anime.remove(g); anime({ targets: g, scale: [1, 1.34, 1], duration: 360, easing: 'easeOutQuad' });
      const rip = document.createElement('span'); rip.className = 'db-eye-rip'; eye.appendChild(rip);
      anime({ targets: rip, scale: [0, 3], opacity: [.55, 0], duration: 560, easing: 'easeOutQuad', complete: () => rip.remove() });
    } else if (kind === 'miss') {
      anime.remove(g); anime({ targets: g, translateX: [0, -5, 5, -4, 4, 0], duration: 300, easing: 'easeInOutSine' });
    }
  }
  function startEyeIdle() {
    stopEyeIdle();
    if (!AOK()) return;
    const g = root.querySelector('#db-eye .db-eye-glyph'); if (!g) return;
    _eyeIdle = anime({ targets: g, scaleY: [1, .12, 1], duration: 240, easing: 'easeInOutSine', delay: 2800, endDelay: 2800, loop: true });
  }
  function stopEyeIdle() { if (_eyeIdle) { _eyeIdle.pause(); _eyeIdle = null; } }

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
      <span class="db-hud-cell">✔ <b id="db-score">0</b></span>`;
    return `<span class="db-hud-cell">✔ <b id="db-score">0</b></span>`;
  }
  function barVisible() { return S.mode === 'classic' || S.mode === 'rush'; }
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
      const ec = q('db-eye-combo'); if (ec) { ec.hidden = mult < 2; ec.textContent = '🔥×' + mult; }
    } else if (S.mode === 'survival') {
      const r = q('db-round'); if (r) r.textContent = S.matches + 1;
      const s = q('db-score'); if (s) s.textContent = S.matches;
      const arc = q('db-eye-arc');
      if (arc) {
        const pc = Math.max(0, S.roundLeft / S.roundMax);
        arc.style.strokeDashoffset = (RING_CIRC * (1 - pc)).toFixed(1);
        arc.classList.toggle('db-low', pc < .35);
      }
    } else {
      const s = q('db-score'); if (s) s.textContent = S.matches;
    }
    /* barra de progresso superior */
    const fill = q('db-bar-fill');
    if (fill && barVisible()) {
      const pc = S.mode === 'classic' ? Math.min(1, S.matches / CLASSIC_LEN) : Math.max(0, S.time / RUSH_TIME);
      fill.style.width = (pc * 100).toFixed(1) + '%';
      fill.classList.toggle('db-low', S.mode === 'rush' && S.time <= 8);
    }
    /* vinheta de perigo */
    const table = root.querySelector('.db-table');
    if (table) {
      const dg = (S.mode === 'rush' && S.time <= 5) || (S.mode === 'survival' && (S.roundLeft / S.roundMax) < .3);
      table.classList.toggle('db-danger', !!dg);
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
    startTimer();  /* zen também conta tempo (só para stats) */
  }

  function onSym(e) {
    if (!S || S.over || S.paused || S._lock) return;
    const btn = e.currentTarget;
    const sym = +btn.dataset.sym;
    const target = shared(S.top, S.hand);
    if (sym === target) onCorrect(sym, btn);
    else onWrong(btn);
  }

  function onCorrect(sym, btn) {
    const react = (performance.now() - S.pairTs) / 1000;
    if (S.bestReact == null || react < S.bestReact) S.bestReact = react;
    S.matches++; S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
    const pts = 1 + Math.floor(S.combo / 5);
    if (S.mode === 'rush') S.score += pts;
    sndHit(S.combo); vib(12);
    if (S.combo > 0 && S.combo % 5 === 0) { sndCombo(S.combo / 5); vib([12, 30, 12]); }
    /* pop nos dois símbolos certos + burst + olho */
    root.querySelectorAll(`.db-sym[data-sym="${sym}"]`).forEach(el => { el.classList.add('db-pop'); burst(el); });
    eyeReact('hit');
    const float = document.createElement('span');
    float.className = 'db-float';
    float.textContent = S.mode === 'rush' ? `+${pts}` : '✔';
    btn.appendChild(float);
    updHud();
    if (S.mode === 'classic' && S.matches >= CLASSIC_LEN) { endGame('clear'); return; }
    S._lock = true;
    const delay = AOK() ? 190 : 240;
    setTimeout(() => {
      if (!S || S.over) return;
      animOutThen(() => { if (!S || S.over) return; S._lock = false; nextPair(); renderPair(true); updHud(); });
    }, delay);
  }

  function animOutThen(cb) {
    const cards = root.querySelectorAll('.db-card');
    if (!AOK() || !cards.length) { cb(); return; }
    cards.forEach(c => { c._busy = true; anime.remove(c); });
    sndSwoosh();
    anime({
      targets: cards, scale: .68, opacity: 0,
      translateY: (el, i) => (i ? 30 : -30), rotate: (el, i) => (i ? 7 : -7),
      duration: 200, easing: 'easeInQuad', complete: cb,
    });
  }

  function onWrong(btn) {
    S.wrongs++; S.combo = 0;
    sndMiss(); vib([40, 40, 40]); eyeReact('miss');
    btn.classList.add('db-bad');
    const cardEl = btn.closest('.db-card');
    cardEl && cardEl.classList.add('db-shake');
    setTimeout(() => { btn.classList.remove('db-bad'); cardEl && cardEl.classList.remove('db-shake'); }, 420);
    if (S.mode === 'rush') { S.time = Math.max(0, S.time - 3); if (S.time <= 0) { endGame('timeout'); return; } }
    if (S.mode === 'survival') { endGame('wrong'); return; }
    updHud();
  }

  function endGame(reason) {
    if (!S || S.over) return;
    S.over = true;
    stopTimer(); stopEyeIdle();
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
    const cur = diff();
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
        <div class="db-diff-row">
          <span class="db-opts-lbl">${t('difficulty')}</span>
          ${['easy', 'medium', 'hard'].map(d => `<button class="db-chip db-diff${d === cur ? ' on' : ''}" data-diff="${d}">${t('d' + cap(d))}</button>`).join('')}
        </div>
        <p class="db-diff-hint" id="db-diff-hint">${t('dHint_' + cur)}</p>
        <div class="db-theme-wrap">
          <span class="db-opts-lbl">${t('theme')}</span>
          <div class="db-theme-grid">
            ${THEME_KEYS.map(k => `<button class="db-theme${k === th ? ' on' : ''}" data-theme="${k}"><span class="db-theme-ico">${THEMES[k].icon}</span><small>${themeName(k)}</small></button>`).join('')}
          </div>
        </div>
        <div class="db-opts">
          <label class="db-snd"><input type="checkbox" id="db-snd" ${soundOn() ? 'checked' : ''}> 🔊 ${t('sound')}</label>
          <span class="db-opts-spacer"></span>
          <button class="db-chip db-howto-btn" id="db-howto">${t('howto')}</button>
        </div>
      </div>`;
  }

  function renderMenu() {
    S = null; stopTimer(); stopEyeIdle();
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
    root.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
      setDiff(b.dataset.diff);
      root.querySelectorAll('[data-diff]').forEach(x => x.classList.toggle('on', x === b));
      const hint = root.querySelector('#db-diff-hint');
      if (hint) hint.textContent = t('dHint_' + b.dataset.diff);
    }));
    root.querySelector('#db-snd')?.addEventListener('change', e => store().setPref('sound', e.target.checked));
    root.querySelector('#db-howto')?.addEventListener('click', showHowto);
    /* micro-vida no menu */
    if (window.Motion && Motion.stagger) Motion.stagger(root.querySelectorAll('.db-daily,.db-mode'), { y: 10, step: 34 });
    if (AOK()) {
      const cards = root.querySelector('.db-hero-cards');
      if (cards) anime({ targets: cards, translateY: [-5, 5], direction: 'alternate', loop: true, duration: 2600, easing: 'easeInOutSine' });
    }
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
    const eye = `
      <div class="db-eye" id="db-eye" aria-hidden="true">
        ${S.mode === 'survival' ? `<svg class="db-eye-ring" viewBox="0 0 80 80"><circle class="db-eye-track" cx="40" cy="40" r="34"/><circle class="db-eye-arc" id="db-eye-arc" cx="40" cy="40" r="34" stroke-dasharray="${RING_CIRC.toFixed(1)}" stroke-dashoffset="0"/></svg>` : ''}
        <span class="db-eye-glow"></span>
        <span class="db-eye-glyph">👁️</span>
        ${S.mode === 'rush' ? `<span class="db-eye-combo" id="db-eye-combo" hidden></span>` : ''}
      </div>`;
    root.innerHTML = `
      <div class="db-wrap db-playing">
        <div class="db-hud">
          <button class="db-hud-btn" id="db-quit" aria-label="${t('quit')}">✕</button>
          <div class="db-hud-mid">${hudHTML()}</div>
          <button class="db-hud-btn" id="db-pause" aria-label="${t('pause')}">⏸</button>
        </div>
        <div class="db-bar"${barVisible() ? '' : ' hidden'}><span class="db-bar-fill" id="db-bar-fill"></span></div>
        <div class="db-table">
          <div class="db-card-wrap" id="db-top-wrap"></div>
          ${eye}
          <div class="db-card-wrap" id="db-hand-wrap"></div>
        </div>
        ${S.mode === 'zen' ? `<button class="db-btn db-zen-exit" id="db-zen-exit">${t('zenExit')}</button>` : ''}
      </div>`;
    renderPair(true);
    wireParallax();
    startEyeIdle();
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
    if (AOK()) {
      const sc = root.querySelector('.db-end-score');
      if (sc) anime({ targets: sc, scale: [.6, 1], opacity: [0, 1], duration: 520, easing: 'spring(1,80,10,0)' });
      Motion && Motion.stagger && Motion.stagger(root.querySelectorAll('.db-end-stats>div'), { y: 8, step: 40 });
    }
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
.db-hero-cards{display:flex;justify-content:center;gap:14px;margin-bottom:10px;will-change:transform}
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
.db-diff-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:16px}
.db-diff-hint{margin:6px 2px 0;font-size:.76rem;color:var(--muted,#9aa);min-height:1.1em}
.db-opts{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:16px}
.db-opts-lbl{font-size:.72rem;color:var(--muted,#9aa);text-transform:uppercase;letter-spacing:.08em}
.db-opts-spacer{flex:1}
.db-chip{border:1px solid var(--border,rgba(255,255,255,.12));background:transparent;color:inherit;border-radius:999px;padding:5px 12px;font-size:.8rem;cursor:pointer;transition:all .15s}
.db-chip.on{background:rgba(242,179,68,.16);border-color:var(--db-gold);color:var(--db-gold)}
.db-snd{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:var(--muted,#9aa);cursor:pointer}
/* temas em grelha de ícones */
.db-theme-wrap{margin-top:16px}
.db-theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px;margin-top:8px}
.db-theme{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border:1px solid var(--border,rgba(255,255,255,.1));border-radius:12px;background:var(--card,rgba(255,255,255,.03));color:inherit;cursor:pointer;transition:border-color .15s,transform .15s,background .15s}
.db-theme:hover{transform:translateY(-1px);border-color:rgba(242,179,68,.45)}
.db-theme.on{border-color:var(--db-gold);background:rgba(242,179,68,.14)}
.db-theme-ico{font-size:1.5rem;line-height:1}
.db-theme small{font-size:.66rem;color:var(--muted,#9aa);text-align:center;line-height:1.15}
.db-theme.on small{color:var(--db-gold)}
/* ── jogo ── */
.db-hud{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.db-hud-mid{flex:1;display:flex;justify-content:center;gap:16px;flex-wrap:wrap}
.db-hud-cell{font-size:.95rem;color:var(--muted,#9aa);display:inline-flex;align-items:center;gap:5px}
.db-hud-cell b{color:#fff;font-variant-numeric:tabular-nums;font-size:1.05rem}
[data-theme=light] .db-hud-cell b{color:#111}
.db-hud-cell.db-low b{color:#ef4444;animation:dbBlink .5s steps(2) infinite}
@keyframes dbBlink{50%{opacity:.4}}
.db-combo b{color:var(--db-gold)!important}
.db-hud-btn{width:38px;height:38px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--card,rgba(255,255,255,.04));color:inherit;font-size:1rem;cursor:pointer}
.db-bar{height:6px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:0 2px 8px}
.db-bar-fill{display:block;height:100%;width:100%;border-radius:999px;background:linear-gradient(90deg,#f2b344,#fb923c);transition:width .18s linear}
.db-bar-fill.db-low{background:linear-gradient(90deg,#ef4444,#f97316)}
.db-table{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px}
.db-table::after{content:'';position:absolute;inset:-10px;border-radius:22px;pointer-events:none;box-shadow:0 0 0 0 rgba(239,68,68,0);transition:box-shadow .25s}
.db-table.db-danger::after{animation:dbDanger 1s ease-in-out infinite}
@keyframes dbDanger{0%,100%{box-shadow:inset 0 0 34px 2px rgba(239,68,68,.16)}50%{box-shadow:inset 0 0 54px 6px rgba(239,68,68,.34)}}
/* olho central */
.db-eye{position:relative;width:56px;height:56px;flex:0 0 auto;display:grid;place-items:center}
.db-eye-glyph{font-size:1.7rem;line-height:1;position:relative;z-index:2;will-change:transform}
.db-eye-glow{position:absolute;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,rgba(242,179,68,.30),transparent 65%);animation:dbGlow 3s ease-in-out infinite}
@keyframes dbGlow{0%,100%{opacity:.5;transform:scale(.9)}50%{opacity:1;transform:scale(1.12)}}
.db-eye-ring{position:absolute;width:80px;height:80px;transform:rotate(-90deg)}
.db-eye-track{fill:none;stroke:rgba(255,255,255,.10);stroke-width:5}
.db-eye-arc{fill:none;stroke:var(--db-gold);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .12s linear}
.db-eye-arc.db-low{stroke:#ef4444}
.db-eye-rip{position:absolute;width:56px;height:56px;border-radius:50%;border:2px solid var(--db-gold);pointer-events:none}
.db-eye-combo{position:absolute;bottom:-16px;font-size:.68rem;font-weight:800;color:var(--db-gold);white-space:nowrap}
.db-card-wrap{width:min(86vw,340px,calc((100dvh - 250px)/2));aspect-ratio:1;position:relative}
@media (min-width:760px){
  .db-table{flex-direction:row;justify-content:center;gap:20px}
  .db-card-wrap{width:min(340px,38vw,58vh)}
  .db-eye{width:64px;height:64px}
  .db-eye-glyph{font-size:2rem}
}
/* face de carta física (creme/porcelana) em ambos os temas — os emoji
   contrastam sempre, lê-se como um jogo de tabuleiro e não como web app */
.db-card{position:absolute;inset:0;border-radius:50%;container-type:size;transform-style:preserve-3d;background:
  radial-gradient(circle at 30% 24%,#fffdf7,#f1ede2 72%);
  border:2px solid rgba(242,179,68,.55);box-shadow:0 16px 36px rgba(0,0,0,.5),inset 0 0 0 5px rgba(255,255,255,.6),inset 0 0 26px rgba(180,150,90,.12)}
[data-theme=light] .db-card{box-shadow:0 12px 30px rgba(120,100,50,.28),inset 0 0 0 5px rgba(255,255,255,.7),inset 0 0 26px rgba(180,150,90,.12)}
.db-card.db-shake{animation:dbShake .4s}
@keyframes dbShake{0%,100%{transform:none}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
/* símbolos — transform base compõe parallax(--px/--py) + rotação */
.db-sym{position:absolute;transform:translate(calc(-50% + var(--px,0px)),calc(-50% + var(--py,0px))) rotate(var(--rot,0deg));background:none;border:none;padding:.06em;cursor:pointer;line-height:1;user-select:none;-webkit-tap-highlight-color:transparent;transition:transform .12s}
.db-sym:active{transform:translate(calc(-50% + var(--px,0px)),calc(-50% + var(--py,0px))) rotate(var(--rot,0deg)) scale(1.15)}
.db-card.db-deal .db-sym{animation:dbSymIn .42s var(--d,0ms) both cubic-bezier(.2,1.3,.3,1)}
@keyframes dbSymIn{from{opacity:0;transform:translate(calc(-50% + var(--px,0px)),calc(-50% + var(--py,0px))) rotate(var(--rot,0deg)) scale(.2)}to{opacity:1;transform:translate(calc(-50% + var(--px,0px)),calc(-50% + var(--py,0px))) rotate(var(--rot,0deg)) scale(1)}}
.db-sym.db-pop{animation:dbPop .34s cubic-bezier(.2,1.4,.4,1);filter:drop-shadow(0 0 9px var(--db-gold));z-index:5}
@keyframes dbPop{0%{transform:translate(calc(-50% + var(--px,0px)),calc(-50% + var(--py,0px))) rotate(var(--rot,0deg)) scale(1)}40%{transform:translate(calc(-50% + var(--px,0px)),calc(-50% + var(--py,0px))) rotate(var(--rot,0deg)) scale(1.6)}100%{transform:translate(calc(-50% + var(--px,0px)),calc(-50% + var(--py,0px))) rotate(var(--rot,0deg)) scale(1.2)}}
.db-sym.db-bad{animation:dbBad .35s}
@keyframes dbBad{0%,100%{filter:none}50%{filter:drop-shadow(0 0 10px #ef4444) grayscale(.4)}}
.db-float{position:absolute;left:50%;top:-6px;transform:translateX(-50%);font-size:.5em;font-weight:900;color:var(--db-gold);pointer-events:none;animation:dbFloat .7s forwards}
@keyframes dbFloat{to{transform:translate(-50%,-26px);opacity:0}}
/* burst de partículas */
.db-fx{position:absolute;width:0;height:0;z-index:6;pointer-events:none}
.db-ring{position:absolute;left:-16px;top:-16px;width:32px;height:32px;border-radius:50%;border:2px solid var(--db-gold);opacity:0}
.db-spark{position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;background:var(--db-gold);box-shadow:0 0 6px var(--db-gold)}
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
  .db-hc-match,.db-card.db-shake,.db-sym.db-pop,.db-confetti i,.db-hud-cell.db-low b,.db-card.db-deal .db-sym,.db-eye-glow,.db-table.db-danger::after,.db-float{animation:none!important}
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
        if (!/^games\/dobble/.test(h) && S && !S.over) { stopTimer(); stopEyeIdle(); S = null; renderMenu(); }
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

  return { init, _debug, _tap, _genDeck: genDeck, _themes: THEMES };
})();
window.DobbleGame = DobbleGame;
