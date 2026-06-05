const MemoryGame = (function () {
  'use strict';

  const EMOJIS = [
    '🍎','🍌','🍇','🍓','🍒','🍑','🥝','🍍',
    '🥭','🍋','🍊','🍐','🫐','🍉','🥑','🌽',
    '🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨',
    '🐯','🦁','🐮','🐷','🐸','🐵','🦋','🌈'
  ];

  /* UI strings + difficulty config live in games/memory/{i18n,config}.json,
     loaded at runtime; these are the offline fallback. */
  const FB_I18N = {
    pt: { pairs:'Pares', moves:'Movimentos', time:'Tempo', pairsBtn:'{n} pares', win:'🎉 Parabéns! {moves} movimentos em {time}s', newGame:'🔄 Novo Jogo' },
    en: { pairs:'Pairs', moves:'Moves', time:'Time', pairsBtn:'{n} pairs', win:'🎉 Well done! {moves} moves in {time}s', newGame:'🔄 New Game' },
  };
  const FB_DEF = { easy: 6, medium: 12, hard: 24 };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  let _defaultPairs = FB_DEF, _pairOptions = [6, 8, 12, 16, 24, 32];

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
            <div class="mem-stat"><span class="mem-lbl">${t('pairs')}</span><span class="mem-val">${pairs}</span></div>
            <div class="mem-stat"><span class="mem-lbl">${t('moves')}</span><span class="mem-val" id="mem-moves">0</span></div>
            <div class="mem-stat"><span class="mem-lbl">${t('time')}</span><span class="mem-val" id="mem-timer">0s</span></div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap">
              ${_pairOptions.map(p => `<button class="hf-new-btn mem-nb" data-p="${p}">${t('pairsBtn').replace('{n}', p)}</button>`).join('')}
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
              msgEl.innerHTML = `${t('win').replace('{moves}', moves).replace('{time}', timer)}<br><button class="hf-new-btn" style="margin-top:.6rem">${t('newGame')}</button>`;
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

    const _start = () => render(_defaultPairs[_has ? GameData.difficulty() : 'medium'] || 8);
    _start();

    if (_has) {
      const apply = () => GameData.load('memory').then(d => {
        if (t.use) t.use(d.i18n);
        if (d.config) { if (d.config.defaultPairs) _defaultPairs = d.config.defaultPairs; if (d.config.pairOptions) _pairOptions = d.config.pairOptions; }
        _start();
      });
      apply();
      document.addEventListener('langchange', apply);
    }
  }

  return { init };
})();
