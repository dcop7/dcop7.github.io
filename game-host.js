const GameHost = (function () {
  'use strict';

  const GAMES = [
    { id: 'hangman',     name: 'Jogo da Forca',   icon: '🪢', color: '#3b82f6',
      desc: 'Adivinha a palavra letra a letra. Quantas tentativas precisas?' },
    { id: 'minesweeper', name: 'Campo de Minas',   icon: '💣', color: '#10b981',
      desc: 'Encontra as minas sem as detonar. O clássico que nunca enjoa.' },
    { id: 'bomb',        name: 'Desarmar Bomba',   icon: '💥', color: '#ef4444',
      desc: '3 desafios, 90 segundos. Consegues desarmar a bomba a tempo?' },
    { id: 'memory',      name: 'Memória',          icon: '🃏', color: '#a855f7',
      desc: 'Encontra todos os pares de cartas. Treina a memória!' },
    { id: 'tictactoe',   name: 'Jogo do Galo',     icon: '⭕', color: '#f59e0b',
      desc: 'O clássico X e O contra a IA. Consegues ganhar?' },
    { id: 'wordle',      name: 'Palavra do Dia',   icon: '📝', color: '#22c55e',
      desc: 'Adivinha a palavra de 5 letras em 6 tentativas.' },
    { id: 'shooting',    name: 'Space Shooter',    icon: '🚀', color: '#6366f1',
      desc: 'Elimina ondas de inimigos! Move o rato, esquiva e destrói tudo.' },
    { id: 'reaction',    name: 'Teste de Reação',  icon: '⚡', color: '#22d3ee',
      desc: 'Quanto tempo demoras a reagir? Testa os teus reflexos.' },
    { id: 'neon',        name: 'Neon Drawing',     icon: '✨', color: '#a855f7',
      desc: 'Desenha com efeito neon brilhante. Arte digital!' },
    { id: 'escape-lab',  name: 'Math Escape Lab',  icon: '🧪', color: '#00cc70',
      desc: 'Foge do laboratório resolvendo puzzles matemáticos. Idades 7–13+.' },
    { id: 'cipher-grid', name: 'Cipher Grid',      icon: '🔷', color: '#22d3ee',
      desc: 'Decifra padrões, sequências e grelhas misteriosas. Idades 7–13+.' },
  ];

  const registry = {
    hangman:     { initialized: true },
    minesweeper: { init: () => MinesweeperGame.init(document.getElementById('pane-minesweeper')), initialized: false },
    bomb:        { init: () => BombGame.init(document.getElementById('pane-bomb')),               initialized: false },
    memory:      { init: () => MemoryGame.init(document.getElementById('pane-memory')),           initialized: false },
    tictactoe:   { init: () => TicTacToeGame.init(document.getElementById('pane-tictactoe')),    initialized: false },
    wordle:      { init: () => WordleGame.init(document.getElementById('pane-wordle')),           initialized: false },
    shooting:    { init: () => ShootingGame.init(document.getElementById('pane-shooting')),       initialized: false },
    reaction:    { init: () => ReactionGame.init(document.getElementById('pane-reaction')),       initialized: false },
    neon:        { init: () => NeonGame.init(document.getElementById('pane-neon')),               initialized: false },
    'escape-lab':  { init: () => EscapeLabGame.init(document.getElementById('pane-escape-lab')),  initialized: false },
    'cipher-grid': { init: () => CipherGridGame.init(document.getElementById('pane-cipher-grid')),initialized: false },
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
