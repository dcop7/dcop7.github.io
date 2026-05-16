const AimTrainerGame = (function () {
  'use strict';

  function init(root) {
    if (!root) return;

    let targets = [], timer = 0, score = 0, misses = 0, running = false, interval, targetInt;
    let difficulty = 'normal';

    const DIFFS = { easy: { r: 36, t: 2000 }, normal: { r: 26, t: 1400 }, hard: { r: 18, t: 900 } };

    root.innerHTML = `
      <div class="game-card">
        <div class="aim-hdr">
          <div class="aim-stats">
            <span>Pontos: <strong id="aim-score">0</strong></span>
            <span>Erros: <strong id="aim-miss">0</strong></span>
            <span>Tempo: <strong id="aim-timer">30s</strong></span>
          </div>
          <div class="tool-seg">
            <button class="tsb active" data-diff="easy">Fácil</button>
            <button class="tsb" data-diff="normal">Normal</button>
            <button class="tsb" data-diff="hard">Difícil</button>
          </div>
        </div>
        <div class="aim-area" id="aim-area"></div>
        <div class="aim-msg" id="aim-msg">
          <button class="hf-new-btn" id="aim-start">🎯 Iniciar</button>
        </div>
      </div>`;

    root.querySelectorAll('[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        difficulty = btn.dataset.diff;
        root.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    const area = root.querySelector('#aim-area');

    function spawnTarget() {
      const cfg = DIFFS[difficulty];
      const r = cfg.r;
      const W = area.clientWidth - r * 2;
      const H = area.clientHeight - r * 2;
      const x = r + Math.random() * W;
      const y = r + Math.random() * H;

      const el = document.createElement('div');
      el.className = 'aim-target';
      el.style.cssText = `left:${x}px;top:${y}px;width:${r*2}px;height:${r*2}px`;
      el.addEventListener('click', () => {
        el.remove();
        score++;
        root.querySelector('#aim-score').textContent = score;
        spawnTarget();
      });

      const deadTimer = setTimeout(() => {
        if (el.parentNode) { el.remove(); misses++; root.querySelector('#aim-miss').textContent = misses; spawnTarget(); }
      }, cfg.t);
      el._dt = deadTimer;

      area.appendChild(el);
    }

    function start() {
      score = 0; misses = 0; timer = 30; running = true;
      root.querySelector('#aim-score').textContent = 0;
      root.querySelector('#aim-miss').textContent = 0;
      root.querySelector('#aim-timer').textContent = '30s';
      root.querySelector('#aim-msg').innerHTML = '';
      area.innerHTML = '';

      spawnTarget();
      interval = setInterval(() => {
        timer--;
        root.querySelector('#aim-timer').textContent = timer + 's';
        if (timer <= 0) end();
      }, 1000);
    }

    function end() {
      running = false;
      clearInterval(interval);
      area.querySelectorAll('.aim-target').forEach(t => { clearTimeout(t._dt); t.remove(); });
      const acc = score + misses > 0 ? Math.round(score / (score + misses) * 100) : 0;
      root.querySelector('#aim-msg').innerHTML = `<div style="text-align:center;padding:1rem">
        <div style="font-size:2rem;margin-bottom:.5rem">🎯</div>
        <div style="font-size:1.1rem;font-weight:700">${score} alvos acertados</div>
        <div style="color:var(--muted);margin:.25rem 0">Erros: ${misses} · Precisão: ${acc}%</div>
        <button class="hf-new-btn" id="aim-start" style="margin-top:.75rem">🔄 Jogar Novamente</button>
      </div>`;
      root.querySelector('#aim-start').addEventListener('click', start);
    }

    root.querySelector('#aim-start').addEventListener('click', start);
    area.addEventListener('click', e => {
      if (running && !e.target.classList.contains('aim-target')) {
        misses++;
        root.querySelector('#aim-miss').textContent = misses;
      }
    });
  }

  return { init };
})();
