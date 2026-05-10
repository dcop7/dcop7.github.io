const BombGame = (function () {
  'use strict';

  let container, timerInt, timeLeft, stage, gameState;
  const TOTAL_TIME = 90;

  function init(cont) {
    container = cont;
    render();
  }

  function render() {
    container.innerHTML = `
      <div class="hf-card bomb-card">
        <div class="hf-top">
          <span class="hf-title">💣 Desarmar a Bomba</span>
          <span style="font-size:.65rem;color:var(--muted)">3 desafios • 90 segundos</span>
        </div>
        <div class="bomb-hud">
          <div class="bomb-timer-wrap">
            <div class="bomb-timer" id="bomb-timer">1:30</div>
            <div class="bomb-timer-lbl">TEMPO RESTANTE</div>
          </div>
        </div>
        <div class="bomb-stage" id="bomb-stage">
          <div class="bomb-idle">
            <div style="font-size:3rem;margin-bottom:.5rem">💣</div>
            <div style="font-size:1.1rem;color:var(--muted);margin-bottom:1.2rem">A bomba está ativa.<br>Tens 90 segundos para a desarmar.</div>
            <button class="hf-new-btn bomb-start-btn" id="bomb-start">▶ Começar</button>
          </div>
        </div>
        <div class="bomb-progress" id="bomb-progress"></div>
      </div>`;

    container.querySelector('#bomb-start').addEventListener('click', startGame);
  }

  function startGame() {
    stage = 0;
    gameState = 'running';
    timeLeft = TOTAL_TIME;
    clearInterval(timerInt);
    timerInt = setInterval(tick, 1000);
    updateTimerDisplay();
    showStage(0);
  }

  function tick() {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) { clearInterval(timerInt); explode(); }
  }

  function updateTimerDisplay() {
    const el = container.querySelector('#bomb-timer');
    if (!el) return;
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    el.className = 'bomb-timer' + (timeLeft <= 15 ? ' bomb-urgent' : '');
  }

  function showStage(n) {
    updateProgress(n);
    if (n === 0) renderWires();
    else if (n === 1) renderCode();
    else if (n === 2) renderSequence();
  }

  function updateProgress(n) {
    const el = container.querySelector('#bomb-progress');
    if (!el) return;
    const labels = ['Fios', 'Código', 'Sequência'];
    el.innerHTML = labels.map((l, i) =>
      `<span class="bp-dot ${i < n ? 'done' : i === n ? 'active' : ''}">${i < n ? '✓' : i + 1} ${l}</span>`
    ).join('');
  }

  // Stage 0: Cut the correct wire
  const WIRE_COLORS = ['#ef4444','#3b82f6','#22c55e','#facc15','#a855f7'];
  const WIRE_NAMES  = ['Vermelho','Azul','Verde','Amarelo','Roxo'];

  function renderWires() {
    let correctIdx;
    const stageEl = container.querySelector('#bomb-stage');
    const shuffled = [...WIRE_COLORS.keys()].sort(() => Math.random() - .5).slice(0, 4);
    correctIdx = shuffled[Math.floor(Math.random() * shuffled.length)];

    const clue = `Corta o fio ${WIRE_NAMES[correctIdx].toUpperCase()}.`;
    stageEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">Desafio 1 — Cortar o Fio</div>
        <div class="bc-clue">${clue}</div>
        <div class="bc-wires" id="bc-wires">
          ${shuffled.map(i => `
            <div class="bc-wire-row" data-idx="${i}">
              <div class="bc-wire-line" style="background:${WIRE_COLORS[i]}"></div>
              <button class="bc-cut-btn" data-idx="${i}" style="border-color:${WIRE_COLORS[i]};color:${WIRE_COLORS[i]}">Cortar</button>
            </div>`).join('')}
        </div>
      </div>`;

    stageEl.querySelectorAll('.bc-cut-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        if (idx === correctIdx) { nextStage(); }
        else { showError(stageEl, 'Fio errado! A bomba ficou instável.'); explode(); }
      });
    });
  }

  // Stage 1: Memorize code
  function renderCode() {
    const code = Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('');
    const stageEl = container.querySelector('#bomb-stage');
    stageEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">Desafio 2 — Memorizar o Código</div>
        <div class="bc-clue">Memoriza este código e introduz-o abaixo:</div>
        <div class="bc-code-display" id="bc-code">${code}</div>
        <div id="bc-code-phase2" style="display:none">
          <input class="bc-code-input" id="bc-code-inp" maxlength="4" inputmode="numeric" placeholder="Código">
          <button class="hf-new-btn" id="bc-code-submit" style="margin-top:.6rem">Confirmar</button>
        </div>
      </div>`;

    setTimeout(() => {
      const d = stageEl.querySelector('#bc-code');
      if (d) d.textContent = '????';
      const p2 = stageEl.querySelector('#bc-code-phase2');
      if (p2) p2.style.display = 'block';
    }, 4000);

    stageEl.querySelector('#bc-code-submit').addEventListener('click', () => {
      const val = stageEl.querySelector('#bc-code-inp').value.trim();
      if (val === code) { nextStage(); }
      else { showError(stageEl, 'Código errado! A bomba ficou instável.'); explode(); }
    });

    stageEl.querySelector('#bc-code-inp').addEventListener('keydown', e => {
      if (e.key === 'Enter') stageEl.querySelector('#bc-code-submit').click();
    });
  }

  // Stage 2: Press buttons in correct order
  function renderSequence() {
    const stageEl = container.querySelector('#bomb-stage');
    const labels = ['A','B','C','D'];
    const order = [...labels].sort(() => Math.random() - .5);
    let step = 0;

    stageEl.innerHTML = `
      <div class="bomb-challenge">
        <div class="bc-title">Desafio 3 — Sequência Correta</div>
        <div class="bc-clue">Carrega nos botões nesta ordem: <strong>${order.join(' → ')}</strong></div>
        <div class="bc-seq-btns" id="bc-seq-btns">
          ${labels.map(l => `<button class="bc-seq-btn" data-l="${l}">${l}</button>`).join('')}
        </div>
        <div class="bc-seq-progress" id="bc-seq-prog"></div>
      </div>`;

    stageEl.querySelectorAll('.bc-seq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const l = btn.dataset.l;
        if (l === order[step]) {
          step++;
          const prog = stageEl.querySelector('#bc-seq-prog');
          if (prog) prog.textContent = order.slice(0, step).join(' → ');
          btn.classList.add('bc-seq-done');
          if (step === order.length) { setTimeout(win, 300); }
        } else {
          showError(stageEl, 'Sequência errada!'); explode();
        }
      });
    });
  }

  function nextStage() {
    stage++;
    if (stage >= 3) { win(); return; }
    showStage(stage);
  }

  function win() {
    clearInterval(timerInt);
    gameState = 'won';
    const stageEl = container.querySelector('#bomb-stage');
    if (stageEl) stageEl.innerHTML = `
      <div class="bomb-win">
        <div style="font-size:3rem">🎉</div>
        <div style="font-size:1.3rem;font-weight:700;color:#4ade80;margin:.4rem 0">Bomba desarmada!</div>
        <div style="color:var(--muted);margin-bottom:1rem">Sobraram ${timeLeft}s — missão cumprida.</div>
        <button class="hf-new-btn" id="bomb-again">▶ Jogar de Novo</button>
      </div>`;
    container.querySelector('#bomb-again').addEventListener('click', startGame);
    updateProgress(3);
  }

  function explode() {
    clearInterval(timerInt);
    gameState = 'lost';
    const stageEl = container.querySelector('#bomb-stage');
    if (stageEl) stageEl.innerHTML = `
      <div class="bomb-dead">
        <div style="font-size:3rem">💥</div>
        <div style="font-size:1.3rem;font-weight:700;color:#f87171;margin:.4rem 0">KABOOM!</div>
        <div style="color:var(--muted);margin-bottom:1rem">A bomba explodiu. Tenta outra vez.</div>
        <button class="hf-new-btn" id="bomb-again">↺ Tentar de Novo</button>
      </div>`;
    container.querySelector('#bomb-again').addEventListener('click', startGame);
  }

  function showError(parent, msg) {
    const e = document.createElement('div');
    e.className = 'bc-error'; e.textContent = msg;
    parent.appendChild(e);
  }

  return { init };
})();
