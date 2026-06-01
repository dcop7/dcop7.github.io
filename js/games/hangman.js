(function () {
  'use strict';

  /* ── WORD BANK — each word tagged with a difficulty d (1 = easiest … 9 =
       hardest). The age selector maps to a difficulty window, so every age gets
       genuinely age-appropriate words. Big bank per level → low repetition. ── */
  const BANK = [
    /* d1 — 3–4 letters, very common (≈6 anos) */
    {w:'GATO',c:'Animal',d:1},{w:'CÃO',c:'Animal',d:1},{w:'SOL',c:'Natureza',d:1},
    {w:'LUA',c:'Natureza',d:1},{w:'MAR',c:'Natureza',d:1},{w:'PÃO',c:'Comida',d:1},
    {w:'RIO',c:'Natureza',d:1},{w:'BOLA',c:'Brinquedo',d:1},{w:'CASA',c:'Lugar',d:1},
    {w:'MESA',c:'Mobília',d:1},{w:'CAMA',c:'Mobília',d:1},{w:'PATO',c:'Animal',d:1},
    {w:'SAPO',c:'Animal',d:1},{w:'RATO',c:'Animal',d:1},{w:'VACA',c:'Animal',d:1},
    {w:'URSO',c:'Animal',d:1},{w:'COPO',c:'Objeto',d:1},{w:'FLOR',c:'Planta',d:1},
    {w:'UVA',c:'Fruta',d:1},{w:'BOLO',c:'Comida',d:1},{w:'SUMO',c:'Bebida',d:1},
    {w:'NEVE',c:'Tempo',d:1},{w:'PERA',c:'Fruta',d:1},{w:'DEDO',c:'Corpo',d:1},
    {w:'OVO',c:'Comida',d:1},{w:'PÉ',c:'Corpo',d:1},{w:'MÃO',c:'Corpo',d:1},
    /* d2 — 4–5 letters, common (≈7 anos) */
    {w:'LEÃO',c:'Animal',d:2},{w:'PEIXE',c:'Animal',d:2},{w:'PORTA',c:'Objeto',d:2},
    {w:'LIVRO',c:'Objeto',d:2},{w:'ÁGUA',c:'Bebida',d:2},{w:'CHUVA',c:'Tempo',d:2},
    {w:'NUVEM',c:'Tempo',d:2},{w:'VENTO',c:'Tempo',d:2},{w:'PRAIA',c:'Lugar',d:2},
    {w:'CAMPO',c:'Lugar',d:2},{w:'MOTA',c:'Transporte',d:2},{w:'MAÇÃ',c:'Fruta',d:2},
    {w:'LÁPIS',c:'Objeto',d:2},{w:'AMIGO',c:'Pessoa',d:2},{w:'BARCO',c:'Transporte',d:2},
    {w:'CARRO',c:'Transporte',d:2},{w:'MONTE',c:'Natureza',d:2},{w:'PONTE',c:'Estrutura',d:2},
    {w:'QUEIJO',c:'Comida',d:2},{w:'GALO',c:'Animal',d:2},{w:'PORCO',c:'Animal',d:2},
    {w:'NARIZ',c:'Corpo',d:2},{w:'BOCA',c:'Corpo',d:2},{w:'CÉU',c:'Natureza',d:2},
    /* d3 — 5–6 letters (≈8 anos) */
    {w:'ESCOLA',c:'Lugar',d:3},{w:'ÁRVORE',c:'Planta',d:3},{w:'COELHO',c:'Animal',d:3},
    {w:'LARANJA',c:'Fruta',d:3},{w:'JARDIM',c:'Lugar',d:3},{w:'JANELA',c:'Objeto',d:3},
    {w:'CANETA',c:'Objeto',d:3},{w:'GELADO',c:'Comida',d:3},{w:'CAVALO',c:'Animal',d:3},
    {w:'CIDADE',c:'Lugar',d:3},{w:'BALÃO',c:'Objeto',d:3},{w:'ILHA',c:'Lugar',d:3},
    {w:'CIRCO',c:'Espetáculo',d:3},{w:'CHAPÉU',c:'Roupa',d:3},{w:'CARACOL',c:'Animal',d:3},
    {w:'BANANA',c:'Fruta',d:3},{w:'SAPATO',c:'Roupa',d:3},{w:'CEBOLA',c:'Comida',d:3},
    {w:'COMETA',c:'Astronomia',d:3},{w:'ABELHA',c:'Animal',d:3},{w:'CABRA',c:'Animal',d:3},
    /* d4 — 6–7 letters (≈9 anos) */
    {w:'MOCHILA',c:'Objeto',d:4},{w:'PISCINA',c:'Lugar',d:4},{w:'FUTEBOL',c:'Desporto',d:4},
    {w:'MÚSICA',c:'Arte',d:4},{w:'TEATRO',c:'Arte',d:4},{w:'GIRAFA',c:'Animal',d:4},
    {w:'PINGUIM',c:'Animal',d:4},{w:'FAMÍLIA',c:'Pessoas',d:4},{w:'CASTELO',c:'Construção',d:4},
    {w:'COMBOIO',c:'Transporte',d:4},{w:'AVIÃO',c:'Transporte',d:4},{w:'FOGUETE',c:'Transporte',d:4},
    {w:'ESTRELA',c:'Astronomia',d:4},{w:'PLANETA',c:'Astronomia',d:4},{w:'OCEANO',c:'Natureza',d:4},
    {w:'DESERTO',c:'Natureza',d:4},{w:'VULCÃO',c:'Natureza',d:4},{w:'CASCATA',c:'Natureza',d:4},
    {w:'PALHAÇO',c:'Pessoa',d:4},{w:'GUITARRA',c:'Instrumento',d:4},{w:'JANEIRO',c:'Mês',d:4},
    /* d5 — 7–9 letters (≈10 anos) */
    {w:'BORBOLETA',c:'Animal',d:5},{w:'TARTARUGA',c:'Animal',d:5},{w:'ELEFANTE',c:'Animal',d:5},
    {w:'GOLFINHO',c:'Animal',d:5},{w:'FLORESTA',c:'Natureza',d:5},{w:'BICICLETA',c:'Transporte',d:5},
    {w:'MONTANHA',c:'Natureza',d:5},{w:'AVENTURA',c:'Conceito',d:5},{w:'VIAGEM',c:'Atividade',d:5},
    {w:'PINTURA',c:'Arte',d:5},{w:'PORTUGAL',c:'País',d:5},{w:'ESPANHA',c:'País',d:5},
    {w:'EUROPA',c:'Continente',d:5},{w:'BIBLIOTECA',c:'Lugar',d:5},{w:'CALENDÁRIO',c:'Objeto',d:5},
    {w:'ESQUELETO',c:'Corpo',d:5},{w:'RELÂMPAGO',c:'Tempo',d:5},{w:'TEMPESTADE',c:'Tempo',d:5},
    /* d6 — harder vocab (≈11 anos) */
    {w:'MISTÉRIO',c:'Conceito',d:6},{w:'CIÊNCIA',c:'Área',d:6},{w:'COMPUTADOR',c:'Tecnologia',d:6},
    {w:'PROGRAMA',c:'Tecnologia',d:6},{w:'INTERNET',c:'Tecnologia',d:6},{w:'FOTOGRAFIA',c:'Arte',d:6},
    {w:'DINOSSAURO',c:'Pré-história',d:6},{w:'MAMÍFERO',c:'Biologia',d:6},{w:'AEROPORTO',c:'Lugar',d:6},
    {w:'SUBMARINO',c:'Transporte',d:6},{w:'PIRÂMIDE',c:'Estrutura',d:6},{w:'TRIÂNGULO',c:'Geometria',d:6},
    {w:'GEOLOGIA',c:'Ciência',d:6},{w:'BIOLOGIA',c:'Ciência',d:6},{w:'QUÍMICA',c:'Ciência',d:6},
    {w:'HISTÓRIA',c:'Disciplina',d:6},{w:'ORQUESTRA',c:'Música',d:6},{w:'CONTINENTE',c:'Geografia',d:6},
    /* d7 — (≈12 anos) */
    {w:'EXPEDIÇÃO',c:'Aventura',d:7},{w:'HELICÓPTERO',c:'Transporte',d:7},{w:'TELESCÓPIO',c:'Instrumento',d:7},
    {w:'MICROSCÓPIO',c:'Instrumento',d:7},{w:'FOTOSSÍNTESE',c:'Biologia',d:7},{w:'METAMORFOSE',c:'Biologia',d:7},
    {w:'MATEMÁTICA',c:'Disciplina',d:7},{w:'DEMOCRACIA',c:'Política',d:7},{w:'MONARQUIA',c:'Política',d:7},
    {w:'ARQUIPÉLAGO',c:'Geografia',d:7},{w:'ATMOSFERA',c:'Ciência',d:7},{w:'GRAVIDADE',c:'Física',d:7},
    {w:'MAGNETISMO',c:'Física',d:7},{w:'HIBERNAÇÃO',c:'Biologia',d:7},{w:'ECOSSISTEMA',c:'Ambiente',d:7},
    {w:'ESCULTURA',c:'Arte',d:7},{w:'ALGORITMO',c:'Tecnologia',d:7},{w:'LITERATURA',c:'Arte',d:7},
    /* d8 — (≈13 anos) */
    {w:'PRECIPITAÇÃO',c:'Meteorologia',d:8},{w:'ELECTRICIDADE',c:'Física',d:8},{w:'BIODIVERSIDADE',c:'Ambiente',d:8},
    {w:'SUSTENTABILIDADE',c:'Ambiente',d:8},{w:'ARQUITECTURA',c:'Arte',d:8},{w:'FILOSOFIA',c:'Ciência',d:8},
    {w:'PROGRAMAÇÃO',c:'Tecnologia',d:8},{w:'INTELIGÊNCIA',c:'Conceito',d:8},{w:'REVOLUÇÃO',c:'História',d:8},
    {w:'INDEPENDÊNCIA',c:'História',d:8},{w:'CONSTITUIÇÃO',c:'Direito',d:8},{w:'RENASCIMENTO',c:'História',d:8},
    {w:'PROBABILIDADE',c:'Matemática',d:8},{w:'PSICOLOGIA',c:'Ciência',d:8},{w:'SOCIOLOGIA',c:'Ciência',d:8},
    /* d9 — most demanding (≈14+) */
    {w:'ILUMINISMO',c:'História',d:9},{w:'ROMANTISMO',c:'Arte',d:9},{w:'ELETROMAGNETISMO',c:'Física',d:9},
    {w:'TERMODINÂMICA',c:'Física',d:9},{w:'RADIOATIVIDADE',c:'Física',d:9},{w:'ANTROPOLOGIA',c:'Ciência',d:9},
    {w:'GLOBALIZAÇÃO',c:'Sociedade',d:9},{w:'CAPITALISMO',c:'Economia',d:9},{w:'PARLAMENTARISMO',c:'Política',d:9},
    {w:'IMPERIALISMO',c:'História',d:9},{w:'COLONIALISMO',c:'História',d:9},{w:'RELATIVIDADE',c:'Física',d:9},
    {w:'CONSCIÊNCIA',c:'Filosofia',d:9},{w:'NEUROCIÊNCIA',c:'Ciência',d:9},{w:'PALEONTOLOGIA',c:'Ciência',d:9},
  ];

  /* Each supported age (6…14) maps to a window of difficulties to draw from, so
     words feel right for that age while still varying. 14 = "14+". */
  const AGE_WINDOW = {
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
      showMsg('🎉 Parabéns! Acertaste!', 'win');
      celebrateWin();
    } else if (wrongCount >= MAX_WRONG) {
      gameOver = true; renderWord(true); renderKeyboard();
      showMsg(`😢 Perdeste! A palavra era: ${currentWord}`, 'lose');
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
        ? words.map(w => w.length).join(' + ') + ' = ' + words.reduce((s, w) => s + w.length, 0) + ' letras'
        : currentWord.replace(/\s/g, '').length + ' letras';
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

  newGame();
})();
