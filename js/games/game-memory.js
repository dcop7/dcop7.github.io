const MemoryGame = (function () {
  'use strict';

  const EMOJIS = [
    '🍎','🍌','🍇','🍓','🍒','🍑','🥝','🍍',
    '🥭','🍋','🍊','🍐','🫐','🍉','🥑','🌽',
    '🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨',
    '🐯','🦁','🐮','🐷','🐸','🐵','🦋','🌈'
  ];

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function init(root) {
    if (!root) return;

    let flipped = [], matched = [], moves = 0, locked = false, timer = 0, timerInt = null, started = false;

    function getCards(pairs) {
      const pool = shuffle(EMOJIS).slice(0, pairs);
      return shuffle([...pool, ...pool]);
    }

    function startTimer() {
      if (started) return;
      started = true;
      timerInt = setInterval(() => {
        timer++;
        const el = root.querySelector('#mem-timer');
        if (el) el.textContent = timer + 's';
      }, 1000);
    }

    function stopTimer() { clearInterval(timerInt); }

    function render(pairs = 8) {
      flipped = []; matched = []; moves = 0; timer = 0; locked = false; started = false;
      stopTimer();
      const cards = getCards(pairs);
      const cols = pairs <= 6 ? 3 : pairs <= 8 ? 4 : pairs <= 12 ? 6 : 8;
      const cardW = pairs <= 8 ? 82 : pairs <= 12 ? 72 : pairs <= 16 ? 60 : pairs <= 24 ? 52 : 46;

      root.innerHTML = `
        <div class="game-card">
          <div class="mem-hdr">
            <div class="mem-stat"><span class="mem-lbl">Pares</span><span class="mem-val">${pairs}</span></div>
            <div class="mem-stat"><span class="mem-lbl">Movimentos</span><span class="mem-val" id="mem-moves">0</span></div>
            <div class="mem-stat"><span class="mem-lbl">Tempo</span><span class="mem-val" id="mem-timer">0s</span></div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap">
              <button class="hf-new-btn mem-nb" data-p="6">6 pares</button>
              <button class="hf-new-btn mem-nb" data-p="8">8 pares</button>
              <button class="hf-new-btn mem-nb" data-p="12">12 pares</button>
              <button class="hf-new-btn mem-nb" data-p="16">16 pares</button>
              <button class="hf-new-btn mem-nb" data-p="24">24 pares</button>
              <button class="hf-new-btn mem-nb" data-p="32">32 pares</button>
            </div>
          </div>
          <div class="mem-grid" id="mem-grid" style="grid-template-columns:repeat(${cols},minmax(0,${cardW}px));justify-content:center">
            ${cards.map((e, i) => `<div class="mem-card" data-idx="${i}" data-emoji="${e}"><div class="mem-inner"><div class="mem-front">?</div><div class="mem-back">${e}</div></div></div>`).join('')}
          </div>
          <div class="mem-msg" id="mem-msg"></div>
        </div>`;

      root.querySelectorAll('.mem-nb').forEach(btn => {
        btn.addEventListener('click', () => render(+btn.dataset.p));
      });

      root.querySelector('#mem-grid').addEventListener('click', e => {
        const card = e.target.closest('.mem-card');
        if (!card || locked) return;
        const idx = +card.dataset.idx;
        if (flipped.includes(idx) || matched.includes(idx)) return;

        startTimer();
        card.classList.add('flipped');
        flipped.push(idx);

        if (flipped.length === 2) {
          locked = true;
          moves++;
          root.querySelector('#mem-moves').textContent = moves;
          const [a, b] = flipped;
          const ca = root.querySelector(`[data-idx="${a}"]`);
          const cb = root.querySelector(`[data-idx="${b}"]`);
          if (ca.dataset.emoji === cb.dataset.emoji) {
            ca.classList.add('matched'); cb.classList.add('matched');
            matched.push(a, b);
            flipped = []; locked = false;
            if (matched.length === cards.length) {
              stopTimer();
              const msgEl = root.querySelector('#mem-msg');
              msgEl.innerHTML = `🎉 Parabéns! ${moves} movimentos em ${timer}s<br><button class="hf-new-btn" style="margin-top:.6rem">🔄 Novo Jogo</button>`;
              msgEl.querySelector('button').addEventListener('click', () => render(pairs));
            }
          } else {
            setTimeout(() => {
              ca.classList.remove('flipped'); cb.classList.remove('flipped');
              flipped = []; locked = false;
            }, 900);
          }
        }
      });
    }

    render(8);
  }

  return { init };
})();
