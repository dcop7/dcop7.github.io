const GameHost = (function () {
  'use strict';

  const GAMES = [
    { id: 'hangman',     name: 'Jogo da Forca',  icon: '🪢', color: '#3b82f6',
      desc: 'Adivinha a palavra letra a letra. Quantas tentativas precisas?' },
    { id: 'snake',       name: 'Snake',           icon: '🐍', color: '#22c55e',
      desc: 'Guia a cobra, come as maçãs e não batas nas paredes. Clássico viciante!' },
    { id: 'minesweeper', name: 'Campo de Minas',  icon: '💣', color: '#10b981',
      desc: 'Encontra as minas sem as detonar. O clássico que nunca enjoa.' },
    { id: 'bomb',        name: 'Desarmar Bomba',  icon: '💥', color: '#ef4444',
      desc: '3 desafios, 90 segundos. Consegues desarmar a bomba a tempo?' },
  ];

  const registry = {
    hangman:     { initialized: true },
    snake:       { init: () => SnakeGame.init(document.getElementById('pane-snake')),             initialized: false },
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
      <div class="games-hub-grid">
        ${GAMES.map(g => `
          <button class="game-hub-card" data-game="${g.id}">
            <div class="game-hub-card-icon">${g.icon}</div>
            <div class="game-hub-card-name">${g.name}</div>
            <div class="game-hub-card-desc">${g.desc}</div>
          </button>`).join('')}
      </div>`;

    hub.querySelectorAll('.game-hub-card').forEach(btn => {
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
