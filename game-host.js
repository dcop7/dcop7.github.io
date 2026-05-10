const GameHost = (function () {
  'use strict';

  const GAMES = [
    { id: 'hangman',     name: 'Jogo da Forca',    icon: '🪢', color: '#3b82f6',
      desc: 'Adivinha a palavra letra a letra. Quantas tentativas precisas?' },
    { id: 'runner',      name: 'Corredor Infinito', icon: '🦊', color: '#f97316',
      desc: 'Corre pela floresta e desvia os obstáculos que aparecem pela frente.' },
    { id: 'minesweeper', name: 'Campo de Minas',    icon: '💣', color: '#10b981',
      desc: 'Encontra as minas sem as detonar. O clássico que nunca enjoa.' },
    { id: 'bomb',        name: 'Desarmar Bomba',    icon: '💥', color: '#ef4444',
      desc: '3 desafios, 90 segundos. Consegues desarmar a bomba a tempo?' },
  ];

  const registry = {
    hangman:     { initialized: true },
    runner:      { init: () => RunnerGame.init(document.getElementById('pane-runner')),           initialized: false },
    minesweeper: { init: () => MinesweeperGame.init(document.getElementById('pane-minesweeper')), initialized: false },
    bomb:        { init: () => BombGame.init(document.getElementById('pane-bomb')),               initialized: false },
  };

  function renderHub() {
    const hub = document.getElementById('games-hub');
    if (!hub) return;
    hub.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🎮 Jogos</h1>
        <p class="page-subtitle">Escolhe um jogo para começar a jogar</p>
      </div>
      <div class="games-grid">
        ${GAMES.map(g => `
          <button class="game-card" data-game="${g.id}" style="--gc:${g.color}">
            <div class="game-card-glow"></div>
            <div class="game-card-icon">${g.icon}</div>
            <div class="game-card-info">
              <div class="game-card-name">${g.name}</div>
              <div class="game-card-desc">${g.desc}</div>
            </div>
            <div class="game-card-cta">
              Jogar
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </button>`).join('')}
      </div>`;

    hub.querySelectorAll('.game-card').forEach(btn => {
      btn.addEventListener('click', () => Nav.go('games/' + btn.dataset.game));
    });
  }

  function show(gameId) {
    const hub  = document.getElementById('games-hub');
    const area = document.getElementById('games-area');
    if (!hub || !area) return;

    if (!gameId) {
      hub.hidden  = false;
      area.hidden = true;
      return;
    }

    hub.hidden  = true;
    area.hidden = false;

    const g = GAMES.find(x => x.id === gameId);
    const bcName = document.getElementById('game-bc-name');
    if (bcName) bcName.textContent = g?.name || gameId;

    document.querySelectorAll('.game-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('pane-' + gameId)?.classList.add('active');

    if (!registry[gameId].initialized) {
      registry[gameId].init();
      registry[gameId].initialized = true;
    }

    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  }

  function setup() {
    renderHub();
    document.getElementById('game-bc-back')?.addEventListener('click', () => Nav.go('games'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  return { show };
})();
