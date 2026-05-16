const WordleGame = (function () {
  'use strict';

  const WORDS = ['CARRO','BARCO','PEDRA','FORCA','LIVRO','PORTA','CAMPO','LARGO','PRAIA','VENTO',
    'FUNDO','MONTE','NOITE','TARDE','CIDADE','HOTEL','PAPEL','FOGAO','CHUVA','SAIDA',
    'MUNDO','VERDE','BRAVO','TEMPO','LUGAR','FORÇA','HOMEM','MULHER','FILHO','FILHA',
    'AMIGO','AMIGA','PRETO','BRUTO','SANTO','LEITE','PEIXE','FRUTA','BOLAS','CANOS',
    'PALCO','PARCO','BAIXO','FLOCO','BOLSO','PINGO','GANHO','GARFO','BOITE','RAIVA'].filter(w=>w.length===5);

  function pickWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

  function init(root) {
    if (!root) return;

    let secret, guesses, current, gameOver, stats = {wins:0, played:0, streak:0};

    function render() {
      root.innerHTML = `
        <div class="game-card wrd-wrap">
          <div class="wrd-hdr">
            <span class="wrd-title">📝 Palavra do Dia</span>
            <div class="wrd-stats">
              <span>Jogados: <strong id="wrd-played">${stats.played}</strong></span>
              <span>Ganhos: <strong id="wrd-wins">${stats.wins}</strong></span>
              <span>Sequência: <strong id="wrd-streak">${stats.streak}</strong></span>
            </div>
          </div>
          <div class="wrd-grid" id="wrd-grid"></div>
          <div class="wrd-msg" id="wrd-msg"></div>
          <div class="wrd-keyboard" id="wrd-kb"></div>
          <button class="hf-new-btn" id="wrd-new" style="margin-top:.75rem">🔄 Nova Palavra</button>
        </div>`;

      root.querySelector('#wrd-new').addEventListener('click', startGame);
      buildKeyboard();
    }

    function buildGrid() {
      const grid = root.querySelector('#wrd-grid');
      grid.innerHTML = '';
      for (let r = 0; r < 6; r++) {
        const row = document.createElement('div');
        row.className = 'wrd-row'; row.dataset.row = r;
        for (let c = 0; c < 5; c++) {
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
      else if (k === '↵') { if (current.length === 5) submitGuess(); }
      else if (current.length < 5 && /^[A-ZÀ-Ÿ]$/.test(k)) { current += k; updateRow(); }
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
      const result = Array(5).fill('absent');
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
          setMsg('🎉 Excelente! Palavra correta!', 'correct');
          gameOver = true; updateStats();
        } else if (guesses.length === 6) {
          stats.played++; stats.streak = 0;
          setMsg(`A palavra era: ${secret}`, 'absent');
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
      secret = pickWord(); guesses = []; current = ''; gameOver = false;
      buildGrid(); buildKeyboard();
      setMsg('', '');
    }

    render();
    startGame();
  }

  return { init };
})();
