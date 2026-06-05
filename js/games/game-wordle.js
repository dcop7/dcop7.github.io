const WordleGame = (function () {
  'use strict';

  /* Word lists live in games/wordle/<lang>/words.json (bucketed by length) and
     config + UI strings in games/wordle/config.json — loaded at runtime so the
     engine stays data-free and scales without code changes. The difficulty
     (GameHost: easy/medium/hard) picks the word length (4/5/6). A small embedded
     set + default config keep the game fully playable offline. */
  const FALLBACK = {
    4: ['CASA','BOLA','GATO','PATO','MESA','VELA','ROSA','NOTA','GELO','LAGO'],
    5: ['CARRO','BARCO','PEDRA','LIVRO','PORTA','CAMPO','PRAIA','VENTO','MONTE','NOITE'],
    6: ['ESCOLA','JANELA','CIDADE','MULHER','PLANTA','CAVALO','COELHO','BANANA','FLORES','JARDIM'],
  };
  const STR = {
    pt: { title:'📝 Palavra do Dia', played:'Jogados', wins:'Ganhos', streak:'Sequência', newWord:'🔄 Nova Palavra', win:'🎉 Excelente! Palavra correta!', loss:'A palavra era: {word}' },
    en: { title:'📝 Word of the Day', played:'Played', wins:'Wins', streak:'Streak', newWord:'🔄 New Word', win:'🎉 Excellent! Correct word!', loss:'The word was: {word}' },
  };
  const DIFF_LEN = { easy: 4, medium: 5, hard: 6 };

  let _cfg = { rows: 6, difficultyLen: DIFF_LEN };
  let _words = null;          /* { lang: {4:[],5:[],6:[]} } cache */
  let _i18n = STR.pt;
  let _loadedLang = null;

  function _lang() { return (typeof I18n !== 'undefined' && I18n.getLang() === 'en') ? 'en' : 'pt'; }
  function _t(k) { return (_i18n && _i18n[k] != null) ? _i18n[k] : (STR[_lang()][k] || k); }
  function _difficulty() {
    try {
      if (typeof GameHost !== 'undefined' && GameHost.getDifficulty) return GameHost.getDifficulty();
      const d = localStorage.getItem('quiz-difficulty');
      return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
    } catch (e) { return 'medium'; }
  }
  function _len() { return (_cfg.difficultyLen || DIFF_LEN)[_difficulty()] || 5; }

  async function _loadData(lang) {
    _i18n = STR[lang];
    try {
      const [cfgR, wR] = await Promise.all([
        fetch('games/wordle/config.json', { cache: 'force-cache' }),
        fetch(`games/wordle/${lang}/words.json`, { cache: 'force-cache' }),
      ]);
      if (cfgR.ok) {
        const c = await cfgR.json();
        if (c.rows) _cfg.rows = c.rows;
        if (c.difficultyLen) _cfg.difficultyLen = c.difficultyLen;
        if (c.i18n && c.i18n[lang]) _i18n = c.i18n[lang];
      }
      if (wR.ok) {
        const w = await wR.json();
        _words = _words || {};
        _words[lang] = w;
      }
    } catch (e) { /* keep fallback */ }
    _loadedLang = lang;
  }

  /* Words for the active length, filtered to the exact length for safety. */
  function _pool() {
    const lang = _lang();
    const len = _len();
    const src = (_words && _words[lang] && _words[lang][len]) || FALLBACK[len] || FALLBACK[5];
    const list = src.filter(w => [...w].length === len);
    return list.length ? list : (FALLBACK[len] || FALLBACK[5]);
  }
  function pickWord() { const p = _pool(); return p[Math.floor(Math.random() * p.length)]; }

  function init(root) {
    if (!root) return;

    let secret, guesses, current, gameOver, LEN = _len(), ROWS = _cfg.rows || 6;
    let stats = { wins: 0, played: 0, streak: 0 };

    function render() {
      root.innerHTML = `
        <div class="game-card wrd-wrap">
          <div class="wrd-hdr">
            <span class="wrd-title">${_t('title')}</span>
            <div class="wrd-stats">
              <span>${_t('played')}: <strong id="wrd-played">${stats.played}</strong></span>
              <span>${_t('wins')}: <strong id="wrd-wins">${stats.wins}</strong></span>
              <span>${_t('streak')}: <strong id="wrd-streak">${stats.streak}</strong></span>
            </div>
          </div>
          <div class="wrd-grid" id="wrd-grid"></div>
          <div class="wrd-msg" id="wrd-msg"></div>
          <div class="wrd-keyboard" id="wrd-kb"></div>
          <button class="hf-new-btn" id="wrd-new" style="margin-top:.75rem">${_t('newWord')}</button>
        </div>`;
      root.querySelector('#wrd-new').addEventListener('click', startGame);
      buildKeyboard();
    }

    function buildGrid() {
      const grid = root.querySelector('#wrd-grid');
      grid.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        const row = document.createElement('div');
        row.className = 'wrd-row'; row.dataset.row = r;
        for (let c = 0; c < LEN; c++) {
          const cell = document.createElement('div');
          cell.className = 'wrd-cell'; cell.dataset.row = r; cell.dataset.col = c;
          row.appendChild(cell);
        }
        grid.appendChild(row);
      }
    }

    function buildKeyboard() {
      const rows = [['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['↵','Z','X','C','V','B','N','M','⌫']];
      const kb = root.querySelector('#wrd-kb');
      kb.innerHTML = rows.map(row =>
        `<div class="wrd-kb-row">${row.map(k => `<button class="wrd-key" data-key="${k}">${k}</button>`).join('')}</div>`
      ).join('');
      kb.addEventListener('click', e => {
        const key = e.target.closest('.wrd-key');
        if (key) handleKey(key.dataset.key);
      });
      document.addEventListener('keydown', handleKeydown);
    }

    function handleKeydown(e) {
      if (!root.closest('#view-games')?.classList.contains('active')) return;
      if (e.key === 'Enter') handleKey('↵');
      else if (e.key === 'Backspace') handleKey('⌫');
      else if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) handleKey(e.key.toUpperCase());
    }

    function handleKey(k) {
      if (gameOver) return;
      if (k === '⌫') { if (current.length > 0) { current = current.slice(0, -1); updateRow(); } }
      else if (k === '↵') { if (current.length === LEN) submitGuess(); }
      else if (current.length < LEN && /^[A-ZÀ-Ÿ]$/.test(k)) { current += k; updateRow(); }
    }

    function updateRow() {
      const row = guesses.length;
      root.querySelectorAll(`[data-row="${row}"] .wrd-cell`).forEach((cell, i) => {
        cell.textContent = current[i] || '';
        cell.className = 'wrd-cell' + (current[i] ? ' wrd-filled' : '');
      });
    }

    function submitGuess() {
      const guess = current;
      const result = Array(LEN).fill('absent');
      const secArr = secret.split('');
      const gArr = guess.split('');

      gArr.forEach((l, i) => { if (l === secArr[i]) { result[i] = 'correct'; secArr[i] = null; gArr[i] = null; } });
      gArr.forEach((l, i) => {
        if (!l) return;
        const idx = secArr.indexOf(l);
        if (idx !== -1) { result[i] = 'present'; secArr[idx] = null; }
      });

      const row = guesses.length;
      root.querySelectorAll(`[data-row="${row}"] .wrd-cell`).forEach((cell, i) => {
        setTimeout(() => {
          cell.textContent = guess[i];
          cell.className = 'wrd-cell wrd-' + result[i];
        }, i * 120);
      });

      updateKeys(guess, result);
      guesses.push({ guess, result });
      current = '';

      setTimeout(() => {
        if (result.every(r => r === 'correct')) {
          stats.wins++; stats.played++; stats.streak++;
          setMsg(_t('win'), 'correct');
          gameOver = true; updateStats();
        } else if (guesses.length === ROWS) {
          stats.played++; stats.streak = 0;
          setMsg(_t('loss').replace('{word}', secret), 'absent');
          gameOver = true; updateStats();
        }
      }, 700);
    }

    function updateKeys(guess, result) {
      const priority = { correct: 3, present: 2, absent: 1 };
      guess.split('').forEach((l, i) => {
        const key = root.querySelector(`[data-key="${l}"]`);
        if (!key) return;
        const cur = key.dataset.state || '';
        if ((priority[result[i]] || 0) > (priority[cur] || 0)) {
          key.dataset.state = result[i];
          key.className = 'wrd-key wrd-' + result[i];
        }
      });
    }

    function setMsg(msg, type) {
      const el = root.querySelector('#wrd-msg');
      if (el) { el.textContent = msg; el.className = 'wrd-msg wrd-' + type; }
    }

    function updateStats() {
      root.querySelector('#wrd-played').textContent = stats.played;
      root.querySelector('#wrd-wins').textContent = stats.wins;
      root.querySelector('#wrd-streak').textContent = stats.streak;
    }

    function startGame() {
      document.removeEventListener('keydown', handleKeydown);
      LEN = _len(); ROWS = _cfg.rows || 6;
      secret = pickWord(); guesses = []; current = ''; gameOver = false;
      render(); buildGrid();
      setMsg('', '');
    }

    /* Render immediately (fallback), then load external data and restart so the
       full word list + current language/difficulty take effect. */
    startGame();
    _loadData(_lang()).then(startGame);

    document.addEventListener('langchange', () => {
      if (_lang() === _loadedLang) { startGame(); return; }
      _loadData(_lang()).then(startGame);
    });
  }

  return { init };
})();
