const GameHost = (function () {
  'use strict';

  const registry = {
    hangman:     { initialized: true },
    runner:      { init: () => RunnerGame.init(document.getElementById('pane-runner')),           initialized: false },
    minesweeper: { init: () => MinesweeperGame.init(document.getElementById('pane-minesweeper')), initialized: false },
    bomb:        { init: () => BombGame.init(document.getElementById('pane-bomb')),               initialized: false },
  };

  let current = 'hangman';

  function switchTo(name) {
    if (!registry[name]) return;
    document.querySelectorAll('.game-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sb-game-btn').forEach(b => b.classList.toggle('active', b.dataset.game === name));
    const pane = document.getElementById('pane-' + name);
    if (pane) pane.classList.add('active');
    if (!registry[name].initialized) {
      registry[name].init();
      registry[name].initialized = true;
    }
    current = name;
  }

  function setup() {
    document.querySelectorAll('.sb-game-btn').forEach(b => {
      b.addEventListener('click', () => {
        switchTo(b.dataset.game);
        // close mobile sidebar
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('show');
        document.body.classList.remove('sb-open');
      });
    });
    switchTo('hangman');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  return { switchTo, getActive: () => current };
})();
