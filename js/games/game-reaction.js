const ReactionGame = (function () {
  'use strict';

  function init(root) {
    if (!root) return;

    let state = 'idle', startTime = 0, results = [], timer;

    root.innerHTML = `
      <div class="game-card" style="max-width:500px;margin:0 auto">
        <h2 style="text-align:center;margin-bottom:1rem">⚡ Teste de Reação</h2>
        <div class="react-box" id="react-box">
          <div class="react-msg" id="react-msg">Clica para começar</div>
          <div class="react-hint" id="react-hint">Aguarda o sinal verde e clica o mais rápido possível!</div>
        </div>
        <div class="react-stats" id="react-stats"></div>
      </div>`;

    const box = root.querySelector('#react-box');
    const msg = root.querySelector('#react-msg');
    const hint = root.querySelector('#react-hint');

    function setIdle() {
      state = 'idle';
      box.className = 'react-box react-idle';
      msg.textContent = 'Clica para começar';
      hint.textContent = 'Aguarda o sinal verde e clica o mais rápido possível!';
    }

    function setWait() {
      state = 'waiting';
      box.className = 'react-box react-wait';
      msg.textContent = 'Aguarda…';
      hint.textContent = '';
      const delay = 1500 + Math.random() * 3000;
      timer = setTimeout(setGo, delay);
    }

    function setGo() {
      state = 'go';
      startTime = performance.now();
      box.className = 'react-box react-go';
      msg.textContent = 'CLICA!';
    }

    function setResult(ms) {
      state = 'result';
      results.push(ms);
      box.className = 'react-box react-idle';
      msg.textContent = ms + ' ms';

      let rating = ms < 150 ? '🚀 Incrível!' : ms < 200 ? '⚡ Excelente!' : ms < 250 ? '✅ Bom!' : ms < 350 ? '👍 Ok' : '🐢 Lento';
      hint.textContent = rating;

      if (results.length >= 1) {
        const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
        const best = Math.min(...results);
        root.querySelector('#react-stats').innerHTML = `
          <div class="react-stat-row">
            <span>Tentativas: <strong>${results.length}</strong></span>
            <span>Melhor: <strong>${best} ms</strong></span>
            <span>Média: <strong>${avg} ms</strong></span>
            <button class="hf-new-btn" id="react-reset">↺ Reset</button>
          </div>`;
        root.querySelector('#react-reset').addEventListener('click', () => {
          results = [];
          root.querySelector('#react-stats').innerHTML = '';
          setIdle();
        });
      }
    }

    box.addEventListener('click', () => {
      if (state === 'idle') {
        setWait();
      } else if (state === 'waiting') {
        clearTimeout(timer);
        box.className = 'react-box react-too-early';
        msg.textContent = '😬 Cedo demais!';
        hint.textContent = 'Aguarda o verde antes de clicar!';
        setTimeout(setIdle, 1200);
      } else if (state === 'go') {
        const ms = Math.round(performance.now() - startTime);
        setResult(ms);
      } else if (state === 'result') {
        setWait();
      }
    });

    setIdle();
  }

  return { init };
})();
