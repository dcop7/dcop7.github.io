(function () {
  'use strict';

  // ── WORD LISTS BY DIFFICULTY TIER ─────────────────────────────────────
  const WORDS = {
    easy: [
      {w:'GATO',c:'Animal'},{w:'CÃO',c:'Animal'},{w:'SOL',c:'Natureza'},
      {w:'LUA',c:'Natureza'},{w:'MAR',c:'Natureza'},{w:'PÃO',c:'Comida'},
      {w:'RIO',c:'Natureza'},{w:'BOLA',c:'Brinquedo'},{w:'CASA',c:'Lugar'},
      {w:'MESA',c:'Mobília'},{w:'CAMA',c:'Mobília'},{w:'LEÃO',c:'Animal'},
      {w:'PATO',c:'Animal'},{w:'SAPO',c:'Animal'},{w:'RATO',c:'Animal'},
      {w:'VACA',c:'Animal'},{w:'URSO',c:'Animal'},{w:'PEIXE',c:'Animal'},
      {w:'PORTA',c:'Objeto'},{w:'ESCOLA',c:'Lugar'},{w:'AMIGO',c:'Pessoa'},
      {w:'LIVRO',c:'Objeto'},{w:'COPO',c:'Objeto'},{w:'FLOR',c:'Planta'},
      {w:'ÁRVORE',c:'Planta'},{w:'PERA',c:'Fruta'},{w:'MAÇÃ',c:'Fruta'},
      {w:'UVA',c:'Fruta'},{w:'LARANJA',c:'Fruta'},{w:'LÁPIS',c:'Objeto'},
      {w:'COELHO',c:'Animal'},{w:'BOLO',c:'Comida'},{w:'SUMO',c:'Bebida'},
      {w:'ÁGUA',c:'Bebida'},{w:'CHUVA',c:'Tempo'},{w:'NUVEM',c:'Tempo'},
      {w:'NEVE',c:'Tempo'},{w:'VENTO',c:'Tempo'},{w:'PRAIA',c:'Lugar'},
      {w:'CAMPO',c:'Lugar'},{w:'MOTA',c:'Transporte'},{w:'TREM',c:'Transporte'},
    ],
    medium: [
      {w:'JARDIM',c:'Lugar'},{w:'BARCO',c:'Transporte'},{w:'CARRO',c:'Transporte'},
      {w:'PONTE',c:'Estrutura'},{w:'MONTE',c:'Natureza'},{w:'JANELA',c:'Objeto'},
      {w:'CANETA',c:'Objeto'},{w:'MOCHILA',c:'Objeto'},{w:'CHAPÉU',c:'Roupa'},
      {w:'GELADO',c:'Comida'},{w:'PISCINA',c:'Lugar'},{w:'FUTEBOL',c:'Desporto'},
      {w:'MÚSICA',c:'Arte'},{w:'TEATRO',c:'Arte'},{w:'BORBOLETA',c:'Animal'},
      {w:'CARACOL',c:'Animal'},{w:'TARTARUGA',c:'Animal'},{w:'CAVALO',c:'Animal'},
      {w:'ELEFANTE',c:'Animal'},{w:'GIRAFA',c:'Animal'},{w:'GOLFINHO',c:'Animal'},
      {w:'PINGUIM',c:'Animal'},{w:'FAMÍLIA',c:'Pessoas'},{w:'CIDADE',c:'Lugar'},
      {w:'FLORESTA',c:'Natureza'},{w:'CASTELO',c:'Construção'},{w:'BICICLETA',c:'Transporte'},
      {w:'COMBOIO',c:'Transporte'},{w:'AVIÃO',c:'Transporte'},{w:'FOGUETE',c:'Transporte'},
      {w:'BALÃO',c:'Objeto'},{w:'ARCO-ÍRIS',c:'Natureza'},{w:'ESTRELA',c:'Astronomia'},
      {w:'PLANETA',c:'Astronomia'},{w:'OCEANO',c:'Natureza'},{w:'DESERTO',c:'Natureza'},
      {w:'VULCÃO',c:'Natureza'},{w:'CASCATA',c:'Natureza'},{w:'ILHA',c:'Lugar'},
      {w:'MONTANHA',c:'Natureza'},{w:'CIRCO',c:'Espetáculo'},{w:'PALHAÇO',c:'Pessoa'},
    ],
    hard: [
      {w:'AVENTURA',c:'Conceito'},{w:'MISTÉRIO',c:'Conceito'},{w:'VIAGEM',c:'Atividade'},
      {w:'CIÊNCIA',c:'Área'},{w:'PINTURA',c:'Arte'},{w:'COMPUTADOR',c:'Tecnologia'},
      {w:'PROGRAMA',c:'Tecnologia'},{w:'INTERNET',c:'Tecnologia'},{w:'FOTOGRAFIA',c:'Arte'},
      {w:'DINOSSAURO',c:'Animal pré-histórico'},{w:'MAMÍFERO',c:'Biologia'},
      {w:'EXPEDIÇÃO',c:'Aventura'},{w:'AEROPORTO',c:'Lugar'},
      {w:'HELICÓPTERO',c:'Transporte'},{w:'SUBMARINO',c:'Transporte'},
      {w:'PIRÂMIDE',c:'Estrutura'},{w:'TRIÂNGULO',c:'Geometria'},
      {w:'PORTUGAL',c:'País'},{w:'ESPANHA',c:'País'},{w:'EUROPA',c:'Continente'},
      {w:'TELESCÓPIO',c:'Instrumento'},{w:'MICROSCÓPIO',c:'Instrumento'},
      {w:'FOTOSSÍNTESE',c:'Biologia'},{w:'METAMORFOSE',c:'Biologia'},
      {w:'GEOLOGIA',c:'Ciência'},{w:'BIOLOGIA',c:'Ciência'},
      {w:'QUÍMICA',c:'Ciência'},{w:'HISTÓRIA',c:'Disciplina'},
      {w:'MATEMÁTICA',c:'Disciplina'},{w:'DEMOCRACIA',c:'Política'},
      {w:'MONARQUIA',c:'Política'},{w:'CONTINENTE',c:'Geografia'},
      {w:'ARQUIPÉLAGO',c:'Geografia'},{w:'PRECIPITAÇÃO',c:'Meteorologia'},
      {w:'ATMOSFERA',c:'Ciência'},{w:'GRAVIDADE',c:'Física'},
      {w:'ELECTRICIDADE',c:'Física'},{w:'MAGNETISMO',c:'Física'},
    ],
    expert: [
      {w:'FOTOSSÍNTESE',c:'Biologia'},{w:'METAMORFOSE',c:'Biologia'},
      {w:'HIBERNAÇÃO',c:'Biologia'},{w:'BIODIVERSIDADE',c:'Ambiente'},
      {w:'ECOSSISTEMA',c:'Ambiente'},{w:'SUSTENTABILIDADE',c:'Ambiente'},
      {w:'ARQUITECTURA',c:'Arte'},{w:'ESCULTURA',c:'Arte'},
      {w:'LITERATURA',c:'Arte'},{w:'FILOSOFIA',c:'Ciência'},
      {w:'ALGORITMO',c:'Tecnologia'},{w:'PROGRAMAÇÃO',c:'Tecnologia'},
      {w:'INTELIGÊNCIA',c:'Conceito'},{w:'TECNOLOGIA',c:'Área'},
      {w:'DEMOCRACIA',c:'Política'},{w:'REVOLUÇÃO',c:'História'},
      {w:'INDEPENDÊNCIA',c:'História'},{w:'CONSTITUIÇÃO',c:'Direito'},
      {w:'RENASCIMENTO',c:'História'},{w:'ILUMINISMO',c:'História'},
      {w:'ROMANTISMO',c:'Arte'},{w:'ELETROMAGNETISMO',c:'Física'},
      {w:'TERMODINÂMICA',c:'Física'},{w:'RADIOATIVIDADE',c:'Física'},
      {w:'PSICOLOGIA',c:'Ciência'},{w:'SOCIOLOGIA',c:'Ciência'},
      {w:'ANTROPOLOGIA',c:'Ciência'},{w:'GLOBALIZAÇÃO',c:'Sociedade'},
      {w:'CAPITALISMO',c:'Economia'},{w:'PARLAMENTARISMO',c:'Política'},
      {w:'IMPERIALISMO',c:'História'},{w:'COLONIALISMO',c:'História'},
      {w:'PROBABILIDADE',c:'Matemática'},{w:'RELATIVIDADE',c:'Física'},
      {w:'CONSCIÊNCIA',c:'Filosofia'},{w:'NEUROCIÊNCIA',c:'Ciência'},
    ],
  };

  function tierFor(age) {
    const a = +age;
    if (a <= 7)  return 'easy';
    if (a <= 9)  return 'medium';
    if (a <= 12) return 'hard';
    return 'expert';
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
  let currentAge = parseInt(localStorage.getItem('game-age-default') || localStorage.getItem('hangman-age') || '8', 10);

  const _recentWords = { easy: [], medium: [], hard: [], expert: [] };
  const AVOID_REPEAT = 8;

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
    const tier = tierFor(currentAge);
    const pool = WORDS[tier];
    const recent = _recentWords[tier] || [];
    let available = pool.filter(item => !recent.includes(item.w));
    if (available.length === 0) available = pool;
    const entry = rand(available);
    recent.push(entry.w);
    if (recent.length > AVOID_REPEAT) recent.shift();
    _recentWords[tier] = recent;

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

  // ── AGE BUTTONS ───────────────────────────────────────────────────
  document.querySelectorAll('.hf-age-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hf-age-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAge = parseInt(btn.dataset.age, 10);
      newGame();
    });
  });

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
  newGame();
})();
