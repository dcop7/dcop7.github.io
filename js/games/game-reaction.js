const ReactionGame = (function () {
  'use strict';

  /* UI strings + delay config live in games/reaction/{i18n,config}.json,
     loaded at runtime; these are the offline fallback. */
  const FB_I18N = {
    pt: { title:'⚡ Teste de Reação', clickToStart:'Clica para começar', instr:'Aguarda o sinal verde e clica o mais rápido possível!', waiting:'Aguarda…', click:'CLICA!', tooEarly:'😬 Cedo demais!', waitGreen:'Aguarda o verde antes de clicar!', attempts:'Tentativas', best:'Melhor', avg:'Média', reset:'↺ Reiniciar', r1:'🚀 Incrível!', r2:'⚡ Excelente!', r3:'✅ Bom!', r4:'👍 Ok', r5:'🐢 Lento' },
    en: { title:'⚡ Reaction Test', clickToStart:'Click to start', instr:'Wait for the green signal and click as fast as you can!', waiting:'Wait…', click:'CLICK!', tooEarly:'😬 Too early!', waitGreen:'Wait for green before clicking!', attempts:'Attempts', best:'Best', avg:'Average', reset:'↺ Reset', r1:'🚀 Incredible!', r2:'⚡ Excellent!', r3:'✅ Good!', r4:'👍 Ok', r5:'🐢 Slow' },
  };
  const FB_DELAY = { easy:{min:1500,max:3500}, medium:{min:1200,max:4000}, hard:{min:800,max:5000} };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  let _delay = FB_DELAY, _ratings = [150, 200, 250, 350];

  function init(root) {
    if (!root) return;

    let state = 'idle', startTime = 0, results = [], timer;

    function build() {
      root.innerHTML = `
        <div class="game-card" style="max-width:500px;margin:0 auto">
          <h2 style="text-align:center;margin-bottom:1rem">${t('title')}</h2>
          <div class="react-box" id="react-box">
            <div class="react-msg" id="react-msg">${t('clickToStart')}</div>
            <div class="react-hint" id="react-hint">${t('instr')}</div>
          </div>
          <div class="react-stats" id="react-stats"></div>
        </div>`;
      wire();
      setIdle();
    }

    let box, msg, hint;

    function setIdle() {
      state = 'idle';
      box.className = 'react-box react-idle';
      msg.textContent = t('clickToStart');
      hint.textContent = t('instr');
    }

    function setWait() {
      state = 'waiting';
      box.className = 'react-box react-wait';
      msg.textContent = t('waiting');
      hint.textContent = '';
      const d = _delay[_has ? GameData.difficulty() : 'medium'] || _delay.medium;
      const delay = d.min + Math.random() * (d.max - d.min);
      timer = setTimeout(setGo, delay);
    }

    function setGo() {
      state = 'go';
      startTime = performance.now();
      box.className = 'react-box react-go';
      msg.textContent = t('click');
    }

    function setResult(ms) {
      state = 'result';
      results.push(ms);
      box.className = 'react-box react-idle';
      msg.textContent = ms + ' ms';

      const [a, b, c, e] = _ratings;
      hint.textContent = ms < a ? t('r1') : ms < b ? t('r2') : ms < c ? t('r3') : ms < e ? t('r4') : t('r5');

      let allTimeBest = null;
      if (typeof GameProgress !== 'undefined') {
        try { GameProgress.record('reaction', { score: ms, lowerIsBetter: true }); allTimeBest = GameProgress.bestScore('reaction'); } catch (err) {}
      }
      const avg = Math.round(results.reduce((s, x) => s + x, 0) / results.length);
      const best = allTimeBest != null ? allTimeBest : Math.min(...results);
      root.querySelector('#react-stats').innerHTML = `
        <div class="react-stat-row">
          <span>${t('attempts')}: <strong>${results.length}</strong></span>
          <span>${t('best')}: <strong>${best} ms</strong></span>
          <span>${t('avg')}: <strong>${avg} ms</strong></span>
          <button class="hf-new-btn" id="react-reset">${t('reset')}</button>
        </div>`;
      root.querySelector('#react-reset').addEventListener('click', () => {
        results = [];
        root.querySelector('#react-stats').innerHTML = '';
        setIdle();
      });
    }

    function wire() {
      box = root.querySelector('#react-box');
      msg = root.querySelector('#react-msg');
      hint = root.querySelector('#react-hint');
      box.addEventListener('click', () => {
        if (state === 'idle') {
          setWait();
        } else if (state === 'waiting') {
          clearTimeout(timer);
          box.className = 'react-box react-too-early';
          msg.textContent = t('tooEarly');
          hint.textContent = t('waitGreen');
          setTimeout(setIdle, 1200);
        } else if (state === 'go') {
          setResult(Math.round(performance.now() - startTime));
        } else if (state === 'result') {
          setWait();
        }
      });
    }

    build();

    if (_has) {
      const apply = () => GameData.load('reaction').then(d => {
        if (t.use) t.use(d.i18n);
        if (d.config) { if (d.config.delay) _delay = d.config.delay; if (d.config.ratings) _ratings = d.config.ratings; }
        results = []; build();
      });
      apply();
      document.addEventListener('langchange', apply);
    }
  }

  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('reaction', [
      { id: 'react.fast',  name: 'Reflexos Rápidos', icon: '⚡', desc: 'Reage em menos de 250 ms.', test: c => c.gameId === 'reaction' && c.result.score < 250 },
      { id: 'react.flash', name: 'Velocidade da Luz', icon: '🚀', desc: 'Reage em menos de 180 ms.', test: c => c.gameId === 'reaction' && c.result.score < 180 },
    ]);
  }

  return { init };
})();
