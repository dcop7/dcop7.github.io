(function () {
  'use strict';

  /* ── WORD BANK — each word tagged with a difficulty d (1 = easiest … 9 =
       hardest). The age selector maps to a difficulty window, so every age gets
       genuinely age-appropriate words. Big bank per level → low repetition. ── */
  /* Word banks now live in games/hangman/<lang>/words.json and are loaded at
     runtime (see loader below). This small embedded set is only an offline
     safety net so the game never breaks if the JSON is momentarily unavailable. */
  const _FALLBACK = [
    {w:"GATO",c:"Animal",d:1},{w:"BOLA",c:"Objeto",d:1},{w:"SOL",c:"Natureza",d:1},
    {w:"CASA",c:"Lugar",d:2},{w:"GELO",c:"Natureza",d:2},{w:"FLOR",c:"Natureza",d:2},
    {w:"ESCOLA",c:"Lugar",d:3},{w:"PLANETA",c:"Espaço",d:3},{w:"FAMÍLIA",c:"Sociedade",d:3},
    {w:"MONTANHA",c:"Natureza",d:4},{w:"COMPUTADOR",c:"Tecnologia",d:4},{w:"HOSPITAL",c:"Lugar",d:4},
    {w:"AVENTURA",c:"Conceito",d:5},{w:"PAISAGEM",c:"Natureza",d:5},{w:"VULCÃO",c:"Natureza",d:5},
    {w:"TERRITÓRIO",c:"Geografia",d:6},{w:"POPULAÇÃO",c:"Sociedade",d:6},{w:"DEMOCRACIA",c:"Política",d:6},
    {w:"PERCENTAGEM",c:"Matemática",d:7},{w:"ESTATÍSTICA",c:"Matemática",d:7},{w:"ATMOSFERA",c:"Ciência",d:7},
    {w:"FOTOSSÍNTESE",c:"Biologia",d:8},{w:"ELETRICIDADE",c:"Ciência",d:8},{w:"INDEPENDÊNCIA",c:"História",d:8},
    {w:"HIDROELÉTRICA",c:"Energia",d:9},{w:"GEOTÉRMICA",c:"Energia",d:9},{w:"OBESIDADE",c:"Medicina",d:9}
  ];
  let BANK = _FALLBACK;

  /* Each supported age (6…14) maps to a window of difficulties to draw from, so
     words feel right for that age while still varying. 14 = "14+". These are
     defaults; games/hangman/config.json overrides them at runtime. */
  let AGE_WINDOW = {
    6:  [1, 2],
    7:  [1, 2, 3],
    8:  [2, 3, 4],
    9:  [3, 4, 5],
    10: [4, 5, 6],
    11: [5, 6, 7],
    12: [6, 7, 8],
    13: [7, 8, 9],
    14: [8, 9],
  };
  function poolFor(age) {
    const win = AGE_WINDOW[age] || AGE_WINDOW[8];
    return BANK.filter(item => win.includes(item.d));
  }

  // ── GALLOWS PARTS ─────────────────────────────────────────────────
  const PARTS = ['hf-head','hf-body-line','hf-arm-l','hf-arm-r','hf-leg-l','hf-leg-r'];
  const MAX_WRONG = 6;

  // ── STATE ─────────────────────────────────────────────────────────
  let currentWord = '';
  let currentCat = '';
  let guessed = new Set();
  let wrongCount = 0;
  let gameOver = false;
  /* Hangman has its OWN age (6–14), independent of the global game difficulty
     that drives the other games. Persisted under 'hangman-age'. */
  const AGES = [6, 7, 8, 9, 10, 11, 12, 13, 14];
  function _loadAge() {
    const a = parseInt(localStorage.getItem('hangman-age'), 10);
    return AGES.includes(a) ? a : 8;
  }
  let currentAge = _loadAge();

  /* Anti-repeat: remember recently-played words (persisted) and avoid them until
     most of the current age's pool has been used. Dynamic, not repetitive. */
  let _recentWords = [];
  try { _recentWords = JSON.parse(localStorage.getItem('hangman-recent') || '[]') || []; } catch (e) {}

  /* ── i18n + external data ──────────────────────────────────────────
     UI strings and the difficulty windows live in games/hangman/config.json;
     the word banks live in games/hangman/<lang>/words.json. Both load at
     runtime (cached by the service worker), so the engine stays data-free and
     the word list scales without touching code. Embedded defaults below keep
     the game fully playable offline if a file is momentarily unavailable. */
  const _STR = {
    pt: { age:'Idade:', category:'Categoria:', letters:'Letras:', wrong:'Letras erradas:', newWord:'🔄 Nova Palavra', lettersWord:'letras', win:'🎉 Parabéns! Acertaste!', loss:'😢 Perdeste! A palavra era: {word}' },
    en: { age:'Age:', category:'Category:', letters:'Letters:', wrong:'Wrong letters:', newWord:'🔄 New Word', lettersWord:'letters', win:'🎉 Well done! You got it!', loss:'😢 You lost! The word was: {word}' },
  };
  let _i18n = {};
  function _lang() { return (typeof I18n !== 'undefined' && I18n.getLang() === 'en') ? 'en' : 'pt'; }
  function _t(key) { return (_i18n[key] != null) ? _i18n[key] : (_STR[_lang()][key] || key); }
  let _loadedLang = null;

  async function _loadData() {
    const lang = _lang();
    _i18n = _STR[lang];
    try {
      const [cfgR, wordsR] = await Promise.all([
        fetch('games/hangman/config.json', { cache: 'force-cache' }),
        fetch(`games/hangman/${lang}/words.json`, { cache: 'force-cache' }),
      ]);
      if (cfgR.ok) {
        const cfg = await cfgR.json();
        if (cfg.ageWindow) AGE_WINDOW = cfg.ageWindow;
        if (cfg.i18n && cfg.i18n[lang]) _i18n = cfg.i18n[lang];
      }
      if (wordsR.ok) {
        const words = await wordsR.json();
        if (Array.isArray(words) && words.length) BANK = words;
      }
    } catch (e) { /* keep embedded fallback + defaults */ }
    _loadedLang = lang;
    _applyLabels();
  }

  /* Localise the static labels rendered in index.html. */
  function _applyLabels() {
    const card = document.querySelector('#pane-hangman .hf-card');
    if (!card) return;
    const setTxt = (sel, txt) => { const el = card.querySelector(sel); if (el) el.textContent = txt; };
    setTxt('.hf-age-lbl', _t('age'));
    const catLbls = card.querySelectorAll('.hf-cat-lbl');
    if (catLbls[0]) catLbls[0].textContent = _t('category');
    if (catLbls[1]) catLbls[1].textContent = _t('letters');
    setTxt('.hf-wrong-lbl', _t('wrong'));
    if (newBtn) newBtn.textContent = _t('newWord');
  }

  // ── DOM REFS ──────────────────────────────────────────────────────
  const wordRow   = document.getElementById('hf-word-row');
  const keyboard  = document.getElementById('hf-keyboard');
  const livesEl   = document.getElementById('hf-lives');
  const catEl     = document.getElementById('hf-category');
  const wrongEl   = document.getElementById('hf-wrong-letters');
  const msgEl     = document.getElementById('hf-msg');
  const newBtn    = document.getElementById('hf-new-btn');

  // ── HELPERS ───────────────────────────────────────────────────────
  function norm(ch) {
    return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }

  function normWord(w) { return [...w].map(norm); }

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── GALLOWS RENDER ────────────────────────────────────────────────
  function renderGallows() {
    PARTS.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (i < wrongCount) { if (!el.classList.contains('hf-show')) el.classList.add('hf-show'); }
      else el.classList.remove('hf-show');
    });
  }

  function renderLives() {
    const rem = MAX_WRONG - wrongCount;
    livesEl.innerHTML = '❤️'.repeat(rem) + '<span style="opacity:.25">🖤</span>'.repeat(wrongCount);
  }

  function isLetter(n) { return n >= 'A' && n <= 'Z'; }

  function renderWord(revealAll) {
    const norm_letters = normWord(currentWord);
    wordRow.innerHTML = [...currentWord].map((ch, i) => {
      const n = norm_letters[i];
      if (ch === ' ') return '<span class="hf-space"></span>';
      if (!isLetter(n)) return `<span class="hf-letter hf-revealed" style="animation:none">${ch}</span>`;
      const revealed = guessed.has(n);
      const showLoss = revealAll && !revealed;
      let cls = 'hf-letter';
      if (revealed) cls += ' hf-revealed';
      else if (showLoss) cls += ' hf-reveal-loss';
      return `<span class="${cls}">${revealed || showLoss ? ch : ''}</span>`;
    }).join('');
  }

  function renderWrong() {
    const norm_letters = normWord(currentWord).filter(isLetter);
    const wrongs = [...guessed].filter(g => !norm_letters.includes(g)).sort();
    wrongEl.textContent = wrongs.length ? wrongs.join('  ') : '—';
  }

  function renderKeyboard() {
    const norm_letters = normWord(currentWord);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    keyboard.innerHTML = [...letters].map(l => {
      let cls = 'hf-key', disabled = '';
      if (guessed.has(l)) {
        cls += normWord(currentWord).includes(l) ? ' hf-correct' : ' hf-wrong-key';
        disabled = 'disabled';
      }
      if (gameOver) disabled = 'disabled';
      return `<button class="${cls}" data-letter="${l}" ${disabled}>${l}</button>`;
    }).join('');
  }

  function checkWin() {
    return normWord(currentWord).filter(isLetter).every(c => guessed.has(c));
  }

  function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = 'hf-msg hf-show ' + (type === 'win' ? 'hf-win' : 'hf-lose');
  }

  function hideMsg() { msgEl.className = 'hf-msg'; msgEl.textContent = ''; }

  function handleGuess(letter) {
    if (gameOver || guessed.has(letter)) return;
    guessed.add(letter);
    if (!normWord(currentWord).includes(letter)) wrongCount++;
    renderGallows(); renderLives(); renderWord(false); renderWrong(); renderKeyboard();
    if (checkWin()) {
      gameOver = true; renderKeyboard();
      showMsg(_t('win'), 'win');
      celebrateWin();
    } else if (wrongCount >= MAX_WRONG) {
      gameOver = true; renderWord(true); renderKeyboard();
      showMsg(_t('loss').replace('{word}', currentWord), 'lose');
    }
  }

  function celebrateWin() {
    wordRow.querySelectorAll('.hf-letter.hf-revealed').forEach((el, i) => {
      setTimeout(() => {
        el.style.animation = 'none'; el.offsetHeight;
        el.style.animation = 'hf-pop .4s cubic-bezier(.34,1.56,.64,1)';
      }, i * 60);
    });
  }

  function newGame() {
    currentAge = _loadAge();
    const sel = document.getElementById('hf-age-sel');
    if (sel && +sel.value !== currentAge) sel.value = String(currentAge);

    const pool = poolFor(currentAge);
    /* Keep the avoid-list shorter than the pool so there's always real choice,
       but large enough that words don't recur for a long time. */
    const avoidMax = Math.max(0, pool.length - 4);
    let available = pool.filter(item => !_recentWords.includes(item.w));
    if (available.length === 0) { _recentWords = []; available = pool; }
    const entry = rand(available);
    _recentWords.push(entry.w);
    while (_recentWords.length > avoidMax) _recentWords.shift();
    try { localStorage.setItem('hangman-recent', JSON.stringify(_recentWords)); } catch (e) {}

    currentWord = entry.w.toUpperCase();
    currentCat  = entry.c;
    guessed     = new Set();
    wrongCount  = 0;
    gameOver    = false;

    catEl.textContent = currentCat;
    const countEl = document.getElementById('hf-letter-count');
    if (countEl) {
      const words = currentWord.split(' ').filter(w => w.length > 0);
      countEl.textContent = words.length > 1
        ? words.map(w => w.length).join(' + ') + ' = ' + words.reduce((s, w) => s + w.length, 0) + ' ' + _t('lettersWord')
        : currentWord.replace(/\s/g, '').length + ' ' + _t('lettersWord');
    }
    hideMsg();
    renderGallows(); renderLives(); renderWord(false); renderWrong(); renderKeyboard();
  }

  keyboard.addEventListener('click', e => {
    const btn = e.target.closest('.hf-key');
    if (!btn || btn.disabled) return;
    handleGuess(btn.dataset.letter);
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const pane = document.getElementById('pane-hangman');
    if (pane && !pane.classList.contains('active')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const l = norm(e.key);
    if (l.length === 1 && l >= 'A' && l <= 'Z') handleGuess(l);
  });

  newBtn.addEventListener('click', newGame);

  /* In-game age selector — only this game. Changing it starts a fresh word at
     the new age and persists the choice (does NOT touch other games). */
  const ageSel = document.getElementById('hf-age-sel');
  if (ageSel) {
    ageSel.value = String(currentAge);
    ageSel.addEventListener('change', () => {
      const a = parseInt(ageSel.value, 10);
      if (!AGES.includes(a)) return;
      currentAge = a;
      try { localStorage.setItem('hangman-age', String(a)); } catch (e) {}
      _recentWords = [];   /* reset avoid-list so the new age pool is fully fresh */
      newGame();
    });
  }

  /* Render immediately with the embedded fallback, then swap in the full
     external bank for the current language once it loads. */
  newGame();
  _loadData().then(() => newGame());

  /* Follow the site language: reload the word bank + labels and start fresh. */
  document.addEventListener('langchange', () => {
    if (_lang() === _loadedLang) return;
    _recentWords = [];
    _loadData().then(() => newGame());
  });
})();
