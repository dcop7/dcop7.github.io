const BombGame = (function () {
  'use strict';

  let container, timerInt, timeLeft, stageIdx, stages, diff, gameState;

  const DIFFS = {
    easy:    { label:'Fácil',   emoji:'🟢', time:180, wires:3, codeLen:3, codeShow:6, seqLen:3, seqShow:5,
               stages:['wires','code','sequence','wires','code'] },
    medium:  { label:'Médio',   emoji:'🟡', time:150, wires:4, codeLen:4, codeShow:4, seqLen:4, seqShow:4,
               stages:['wires','code','sequence','math','wires'] },
    hard:    { label:'Difícil', emoji:'🟠', time:130, wires:4, codeLen:5, codeShow:3, seqLen:5, seqShow:3,
               stages:['wires','code','math','sequence','wires','code'] },
    extreme: { label:'Extremo', emoji:'🔴', time:105, wires:5, codeLen:6, codeShow:2, seqLen:6, seqShow:2,
               stages:['wires','code','math','pattern','sequence','wires','math'] },
  };

  /* UI strings live in games/bomb/i18n.json (offline fallback below). */
  const FB_I18N = {
    pt: { title:'💣 Desarmar a Bomba', chooseDiff:'Escolhe o nível de dificuldade', easy:'Fácil', medium:'Médio', hard:'Difícil', extreme:'Extremo', challenges:'desafios', timeLeft:'TEMPO RESTANTE', stage_wires:'Fios', stage_code:'Código', stage_sequence:'Sequência', stage_math:'Cálculo', stage_pattern:'Padrão', wire_red:'Vermelho', wire_blue:'Azul', wire_green:'Verde', wire_yellow:'Amarelo', wire_purple:'Roxo', wire_orange:'Laranja', cutWireMulti:'Corta o fio {w}. Não te enganes — há {n} fios.', cutWire:'Corta o fio {w}.', challenge:'Desafio', st_wires:'Cortar o Fio', st_code:'Código Secreto', st_sequence:'Sequência', st_math:'Cálculo Rápido', st_pattern:'Padrão de Cores', enterCode:'Introduz o código:', memoCode:'Memoriza. Desaparece em {s}s.', memoSeq:'Memoriza a ordem. Esconde em {s}s.', seqHidden:'Sequência oculta — confia na memória!', solveMentally:'Resolve mentalmente:', memoPattern:'Memoriza o padrão. Esconde em {s}s.', defused:'Bomba desarmada!', timeSpared:'Sobraram {s}s — missão cumprida!', level:'Nível', playAgain:'▶ Jogar de Novo', kaboom:'KABOOM!', exploded:'A bomba explodiu. Tenta outra vez.', tryAgain:'↺ Tentar de Novo' },
    en: { title:'💣 Defuse the Bomb', chooseDiff:'Choose the difficulty', easy:'Easy', medium:'Medium', hard:'Hard', extreme:'Extreme', challenges:'challenges', timeLeft:'TIME LEFT', stage_wires:'Wires', stage_code:'Code', stage_sequence:'Sequence', stage_math:'Maths', stage_pattern:'Pattern', wire_red:'Red', wire_blue:'Blue', wire_green:'Green', wire_yellow:'Yellow', wire_purple:'Purple', wire_orange:'Orange', cutWireMulti:'Cut the {w} wire. Be careful — there are {n} wires.', cutWire:'Cut the {w} wire.', challenge:'Challenge', st_wires:'Cut the Wire', st_code:'Secret Code', st_sequence:'Sequence', st_math:'Quick Maths', st_pattern:'Colour Pattern', enterCode:'Enter the code:', memoCode:'Memorise. Disappears in {s}s.', memoSeq:'Memorise the order. Hides in {s}s.', seqHidden:'Sequence hidden — trust your memory!', solveMentally:'Solve in your head:', memoPattern:'Memorise the pattern. Hides in {s}s.', defused:'Bomb defused!', timeSpared:'{s}s to spare — mission complete!', level:'Level', playAgain:'▶ Play Again', kaboom:'KABOOM!', exploded:'The bomb exploded. Try again.', tryAgain:'↺ Try Again' },
  };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  let diffKeyCur = 'easy';

  function init(cont) {
    container = cont;
    renderMenu();
    if (_has) {
      const apply = () => GameData.load('bomb').then(d => {
        if (t.use) t.use(d.i18n);
        /* Only re-render the menu when idle, so a defuse in progress isn't reset. */
        if (container && (gameState === undefined || gameState === 'won' || gameState === 'lost')) renderMenu();
      });
      apply();
      if (!init._wired) { init._wired = true; document.addEventListener('langchange', apply); }
    }
  }

  function renderMenu() {
    container.innerHTML = `
      <div class="hf-card bomb-card">
        <div class="hf-top"><span class="hf-title">${t('title')}</span></div>
        <div class="bomb-stage" id="bomb-stage">
          <div class="bomb-idle">
            <div style="font-size:2.8rem;margin-bottom:.7rem">💣</div>
            <div style="font-size:.95rem;color:var(--muted);margin-bottom:1.4rem">${t('chooseDiff')}</div>
            <div class="bomb-diff-grid">
              ${Object.entries(DIFFS).map(([k,d]) => `
                <button class="bomb-diff-btn" data-diff="${k}">
                  <span class="bdb-emoji">${d.emoji}</span>
                  <span class="bdb-label">${t(k)}</span>
                  <span class="bdb-info">${d.stages.length} ${t('challenges')} · ${d.time}s</span>
                </button>`).join('')}
            </div>
          </div>
        </div>
        <div class="bomb-hud" id="bomb-hud" style="display:none">
          <div class="bomb-timer-wrap">
            <div class="bomb-timer" id="bomb-timer">—</div>
            <div class="bomb-timer-lbl">${t('timeLeft')}</div>
          </div>
        </div>
        <div class="bomb-progress" id="bomb-progress"></div>
      </div>`;
    container.querySelectorAll('.bomb-diff-btn').forEach(btn =>
      btn.addEventListener('click', () => startGame(btn.dataset.diff)));
  }

  function startGame(diffKey) {
    diffKeyCur = DIFFS[diffKey] ? diffKey : 'medium';
    diff = DIFFS[diffKey] || DIFFS.medium;
    stages = diff.stages;
    stageIdx = 0;
    gameState = 'running';
    timeLeft = diff.time;
    clearInterval(timerInt);
    container.querySelector('#bomb-hud').style.display = '';
    timerInt = setInterval(tick, 1000);
    updateTimer();
    showStage(0);
  }

  function tick() {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) { clearInterval(timerInt); explode(); }
  }

  function updateTimer() {
    const el = container.querySelector('#bomb-timer');
    if (!el) return;
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    el.className = 'bomb-timer' + (timeLeft <= 15 ? ' bomb-urgent' : '');
  }

  function showStage(n) {
    updateProgress(n);
    const name = stages[n];
    if      (name === 'wires')    renderWires();
    else if (name === 'code')     renderCode();
    else if (name === 'sequence') renderSequence();
    else if (name === 'math')     renderMath();
    else if (name === 'pattern')  renderPattern();
  }

  function updateProgress(n) {
    const el = container.querySelector('#bomb-progress');
    if (!el) return;
    el.innerHTML = stages.map((s, i) =>
      `<span class="bp-dot ${i < n ? 'done' : i === n ? 'active' : ''}">${i < n ? '✓' : i+1} ${t('stage_' + s)}</span>`
    ).join('');
  }

  // ── Stage: Wire cut ────────────────────────────────────────────────
  const WIRE_COLORS = ['#ef4444','#3b82f6','#22c55e','#facc15','#a855f7','#f97316'];
  const WIRE_KEYS   = ['wire_red','wire_blue','wire_green','wire_yellow','wire_purple','wire_orange'];

  function renderWires() {
    const stEl = container.querySelector('#bomb-stage');
    const count = diff.wires;
    const pool = [...Array(WIRE_COLORS.length).keys()].sort(() => Math.random() - .5).slice(0, count);
    const correct = pool[Math.floor(Math.random() * pool.length)];
    const wireName = t(WIRE_KEYS[correct]).toUpperCase();
    const clue = diff === DIFFS.extreme
      ? t('cutWireMulti').replace('{w}', wireName).replace('{n}', count)
      : t('cutWire').replace('{w}', wireName);

    stEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">${t('challenge')} ${stageIdx+1} — ${t('st_wires')}</div>
        <div class="bc-clue">${clue}</div>
        <div class="bc-wires">
          ${pool.map(i => `
            <div class="bc-wire-row">
              <div class="bc-wire-line" style="background:${WIRE_COLORS[i]}"></div>
              <button class="bc-cut-btn" data-idx="${i}" style="border-color:${WIRE_COLORS[i]};color:${WIRE_COLORS[i]}">Cortar</button>
            </div>`).join('')}
        </div>
      </div>`;

    stEl.querySelectorAll('.bc-cut-btn').forEach(btn =>
      btn.addEventListener('click', () =>
        +btn.dataset.idx === correct ? nextStage() : explode()));
  }

  // ── Stage: Memorize code ───────────────────────────────────────────
  function renderCode() {
    const len = diff.codeLen, showFor = diff.codeShow;
    const code = Array.from({length:len}, () => Math.floor(Math.random()*10)).join('');
    const stEl = container.querySelector('#bomb-stage');

    stEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">${t('challenge')} ${stageIdx+1} — ${t('st_code')}</div>
        <div class="bc-clue">${t('memoCode').replace('{s}', `<span id="bc-cd">${showFor}</span>`)}</div>
        <div class="bc-code-display" id="bc-code">${code}</div>
        <div id="bc-phase2" style="display:none">
          <div class="bc-clue" style="margin-bottom:.5rem">${t('enterCode')}</div>
          <input class="bc-code-input" id="bc-inp" maxlength="${len}" inputmode="numeric" placeholder="${'•'.repeat(len)}">
          <button class="hf-new-btn" id="bc-ok" style="margin-top:.6rem">Confirmar</button>
        </div>
      </div>`;

    let cd = showFor;
    const cdInt = setInterval(() => {
      cd--;
      const cdEl = stEl.querySelector('#bc-cd');
      if (cdEl) cdEl.textContent = cd;
      if (cd <= 0) {
        clearInterval(cdInt);
        const d = stEl.querySelector('#bc-code');
        if (d) d.textContent = '?'.repeat(len);
        const p2 = stEl.querySelector('#bc-phase2');
        if (p2) p2.style.display = 'block';
        stEl.querySelector('#bc-inp')?.focus();
      }
    }, 1000);

    stEl.querySelector('#bc-ok').addEventListener('click', () => {
      clearInterval(cdInt);
      stEl.querySelector('#bc-inp').value.trim() === code ? nextStage() : explode();
    });
    stEl.querySelector('#bc-inp').addEventListener('keydown', e => {
      if (e.key === 'Enter') stEl.querySelector('#bc-ok').click();
    });
  }

  // ── Stage: Sequence (memory) ───────────────────────────────────────
  function renderSequence() {
    const stEl = container.querySelector('#bomb-stage');
    const len = diff.seqLen, showFor = diff.seqShow;
    const pool = ['A','B','C','D','E','F'].slice(0, Math.max(4, len));
    const order = [...pool].sort(() => Math.random() - .5).slice(0, len);
    let step = 0;

    stEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">${t('challenge')} ${stageIdx+1} — ${t('st_sequence')}</div>
        <div class="bc-clue">${t('memoSeq').replace('{s}', `<span id="bc-scd">${showFor}</span>`)}</div>
        <div class="bc-seq-reveal" id="bc-seq-reveal">${order.join(' → ')}</div>
        <div class="bc-seq-btns" id="bc-seq-btns">
          ${pool.map(l => `<button class="bc-seq-btn" data-l="${l}">${l}</button>`).join('')}
        </div>
        <div class="bc-seq-progress" id="bc-seq-prog"></div>
      </div>`;

    let cd = showFor;
    const revEl = stEl.querySelector('#bc-seq-reveal');
    const cluEl = stEl.querySelector('.bc-clue');
    const cdInt = setInterval(() => {
      cd--;
      const cdEl = stEl.querySelector('#bc-scd');
      if (cdEl) cdEl.textContent = cd;
      if (cd <= 0) {
        clearInterval(cdInt);
        if (revEl) { revEl.style.filter = 'blur(8px)'; revEl.style.userSelect = 'none'; }
        if (cluEl) cluEl.textContent = t('seqHidden');
      }
    }, 1000);

    stEl.querySelectorAll('.bc-seq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const l = btn.dataset.l;
        if (l !== order[step]) { clearInterval(cdInt); explode(); return; }
        step++;
        btn.classList.add('bc-seq-done');
        const prog = stEl.querySelector('#bc-seq-prog');
        if (prog) prog.textContent = order.slice(0, step).join(' → ');
        if (step === order.length) { clearInterval(cdInt); setTimeout(nextStage, 300); }
      });
    });
  }

  // ── Stage: Math ────────────────────────────────────────────────────
  function renderMath() {
    const stEl = container.querySelector('#bomb-stage');
    let question, answer;

    if (diff === DIFFS.extreme) {
      const a = Math.floor(Math.random()*12)+3, b = Math.floor(Math.random()*9)+2, c = Math.floor(Math.random()*8)+1;
      answer = String(a * b - c);
      question = `${a} × ${b} − ${c} = ?`;
    } else {
      const a = Math.floor(Math.random()*20)+10, b = Math.floor(Math.random()*12)+3;
      const plus = Math.random() > .4;
      answer = String(plus ? a + b : a - b);
      question = `${a} ${plus ? '+' : '−'} ${b} = ?`;
    }

    stEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">${t('challenge')} ${stageIdx+1} — ${t('st_math')}</div>
        <div class="bc-clue">${t('solveMentally')}</div>
        <div class="bc-code-display">${question}</div>
        <input class="bc-code-input" id="bc-math" type="number" placeholder="Resposta" style="margin-top:.8rem">
        <button class="hf-new-btn" id="bc-math-ok" style="margin-top:.6rem">Confirmar</button>
      </div>`;

    stEl.querySelector('#bc-math-ok').addEventListener('click', () =>
      stEl.querySelector('#bc-math').value.trim() === answer ? nextStage() : explode());
    stEl.querySelector('#bc-math').addEventListener('keydown', e => {
      if (e.key === 'Enter') stEl.querySelector('#bc-math-ok').click();
    });
    stEl.querySelector('#bc-math').focus();
  }

  // ── Stage: Color pattern (extreme) ────────────────────────────────
  function renderPattern() {
    const stEl = container.querySelector('#bomb-stage');
    const PCOLORS = ['🔴','🟡','🟢','🔵'];
    const len = 5, showFor = diff.seqShow;
    const pattern = Array.from({length:len}, () => PCOLORS[Math.floor(Math.random()*PCOLORS.length)]);
    let answer = [];

    stEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">${t('challenge')} ${stageIdx+1} — ${t('st_pattern')}</div>
        <div class="bc-clue">${t('memoPattern').replace('{s}', `<span id="bc-pcd">${showFor}</span>`)}</div>
        <div class="bc-pattern-disp" id="bc-pat-disp">${pattern.map(c=>`<span class="bc-pat-c">${c}</span>`).join('')}</div>
        <div id="bc-pat-phase2" style="display:none">
          <div class="bc-clue" style="margin-bottom:.4rem">Recria os ${len} círculos em ordem:</div>
          <div class="bc-pat-btns">${PCOLORS.map(c=>`<button class="bc-pat-pick" data-c="${c}">${c}</button>`).join('')}</div>
          <div class="bc-pat-ans" id="bc-pat-ans"></div>
          <div style="display:flex;gap:.5rem;justify-content:center;margin-top:.5rem">
            <button class="hf-new-btn bc-ctrl-sm" id="bc-pat-undo">↩ Apagar</button>
            <button class="hf-new-btn" id="bc-pat-ok">Confirmar</button>
          </div>
        </div>
      </div>`;

    let cd = showFor;
    const cdInt = setInterval(() => {
      cd--;
      const cdEl = stEl.querySelector('#bc-pcd');
      if (cdEl) cdEl.textContent = cd;
      if (cd <= 0) {
        clearInterval(cdInt);
        const d = stEl.querySelector('#bc-pat-disp');
        if (d) d.style.filter = 'blur(10px)';
        const p2 = stEl.querySelector('#bc-pat-phase2');
        if (p2) p2.style.display = 'block';
      }
    }, 1000);

    function refreshAns() {
      const el = stEl.querySelector('#bc-pat-ans');
      if (el) el.textContent = answer.length ? answer.join(' ') : '—';
    }
    refreshAns();

    stEl.querySelectorAll('.bc-pat-pick').forEach(btn =>
      btn.addEventListener('click', () => {
        if (answer.length < len) { answer.push(btn.dataset.c); refreshAns(); }
      }));
    stEl.querySelector('#bc-pat-undo').addEventListener('click', () => { answer.pop(); refreshAns(); });
    stEl.querySelector('#bc-pat-ok').addEventListener('click', () => {
      clearInterval(cdInt);
      answer.join(',') === pattern.join(',') ? nextStage() : explode();
    });
  }

  // ── Flow ───────────────────────────────────────────────────────────
  function nextStage() {
    stageIdx++;
    if (stageIdx >= stages.length) { win(); return; }
    showStage(stageIdx);
  }

  function win() {
    clearInterval(timerInt); gameState = 'won';
    container.querySelector('#bomb-hud').style.display = 'none';
    const stEl = container.querySelector('#bomb-stage');
    if (stEl) stEl.innerHTML = `
      <div class="bomb-win">
        <div style="font-size:3rem">🎉</div>
        <div style="font-size:1.3rem;font-weight:700;color:#4ade80;margin:.4rem 0">${t('defused')}</div>
        <div style="color:var(--muted);margin-bottom:.4rem">${t('timeSpared').replace('{s}', timeLeft)}</div>
        <div style="font-size:.8rem;color:var(--accent);margin-bottom:1rem">${t('level')}: ${t(diffKeyCur)} ${diff.emoji}</div>
        <button class="hf-new-btn" id="bomb-again">${t('playAgain')}</button>
      </div>`;
    updateProgress(stages.length);
    container.querySelector('#bomb-again').addEventListener('click', renderMenu);
  }

  function explode() {
    clearInterval(timerInt); gameState = 'lost';
    container.querySelector('#bomb-hud').style.display = 'none';
    const stEl = container.querySelector('#bomb-stage');
    if (stEl) stEl.innerHTML = `
      <div class="bomb-dead">
        <div style="font-size:3rem">💥</div>
        <div style="font-size:1.3rem;font-weight:700;color:#f87171;margin:.4rem 0">${t('kaboom')}</div>
        <div style="color:var(--muted);margin-bottom:1rem">${t('exploded')}</div>
        <button class="hf-new-btn" id="bomb-again">${t('tryAgain')}</button>
      </div>`;
    container.querySelector('#bomb-again').addEventListener('click', renderMenu);
  }

  return { init };
})();
