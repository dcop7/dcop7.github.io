const GameHost = (function () {
  'use strict';

  const GAMES = [
    { id: 'hangman',       name: 'Jogo da Forca',       icon: '🪢', color: '#3b82f6', group: 'Clássicos',
      desc: 'Adivinha a palavra letra a letra. Quantas tentativas precisas?' },
    { id: 'minesweeper',   name: 'Campo de Minas',       icon: '💣', color: '#10b981', group: 'Clássicos',
      desc: 'Encontra as minas sem as detonar. O clássico que nunca enjoa.' },
    { id: 'bomb',          name: 'Desarmar Bomba',       icon: '💥', color: '#ef4444', group: 'Clássicos',
      desc: '5–7 desafios, conta decrescente. Consegues desarmar a bomba a tempo?' },
    { id: 'memory',        name: 'Memória',              icon: '🃏', color: '#a855f7', group: 'Clássicos',
      desc: 'Encontra todos os pares de cartas. Até 32 pares!' },
    { id: 'wordle',        name: 'Palavra do Dia',       icon: '📝', color: '#10b981', group: 'Clássicos',
      desc: 'Descobre a palavra de 5 letras em 6 tentativas. Estilo Wordle!' },
    { id: 'tictactoe',     name: 'Jogo do Galo',         icon: '⭕', color: '#f59e0b', group: 'Clássicos',
      desc: 'O clássico X e O contra a IA. Consegues ganhar?' },
    { id: 'reaction',      name: 'Teste de Reação',      icon: '⚡', color: '#22d3ee', group: 'Clássicos',
      desc: 'Quanto tempo demoras a reagir? Testa os teus reflexos.' },
    { id: 'shooting',      name: 'Space Shooter',        icon: '🚀', color: '#6366f1', group: 'Ação',
      desc: 'Elimina ondas de inimigos! Move o rato, esquiva e destrói tudo.' },
    { id: 'neon-shooter',  name: 'Neon Space Shooter',   icon: '🛸', color: '#a855f7', group: 'Ação',
      desc: 'Move a nave, dispara automático, derrota chefes e acumula combos neon!' },
    { id: 'sky-hopper',    name: 'Sky Hopper',           icon: '🌟', color: '#06b6d4', group: 'Ação',
      desc: 'Toca para voar, desvia dos obstáculos e apanha orbes de energia!' },
    { id: 'gravity-lab',   name: 'Gravity Lab',          icon: '🔬', color: '#22d3ee', group: 'Puzzle',
      desc: 'Muda a direção da gravidade para guiar a bola até à saída. 8 níveis!' },
    { id: 'chain-reaction',name: 'Chain Reaction',       icon: '⚙️', color: '#6366f1', group: 'Puzzle',
      desc: 'Coloca peças no tabuleiro para criar reações em cadeia explosivas!' },
    { id: 'bridge-builder',name: 'Bridge Builder',       icon: '🌉', color: '#38bdf8', group: 'Puzzle',
      desc: 'Constrói pontes para os robôs atravessarem. Triângulos são a chave!' },
    { id: 'escape-lab',    name: 'Math Escape Lab',      icon: '🧪', color: '#00cc70', group: 'Educativo',
      desc: 'Foge do laboratório resolvendo puzzles matemáticos.' },
    { id: 'cipher-grid',   name: 'Cipher Grid',          icon: '🔷', color: '#22d3ee', group: 'Educativo',
      desc: 'Decifra padrões, sequências e grelhas misteriosas.' },
    { id: 'robot-repair',  name: 'Robot Repair Lab',     icon: '🤖', color: '#7c3aed', group: 'Educativo',
      desc: 'Repara robôs resolvendo puzzles de lógica.' },
    { id: 'space-code',    name: 'Space Code Academy',   icon: '🛸', color: '#1d4ed8', group: 'Educativo',
      desc: 'Decifra transmissões alienígenas com matemática espacial.' },
    { id: 'math-detective',name: 'Math Detective',       icon: '🔍', color: '#b45309', group: 'Educativo',
      desc: 'Resolve mistérios usando pistas matemáticas.' },
    { id: 'treasure-vault',name: 'Treasure Vault',       icon: '🏺', color: '#d97706', group: 'Educativo',
      desc: 'Abre cofres antigos com combinações matemáticas.' },
    { id: 'cyber-maze',    name: 'Cyber Maze',           icon: '🌀', color: '#db2777', group: 'Educativo',
      desc: 'Navega num labirinto cibernético resolvendo puzzles.' },
    { id: 'neon',          name: 'Neon Drawing',         icon: '✨', color: '#a855f7', group: 'Criativo',
      desc: 'Desenha com efeito neon brilhante. Arte digital!' },
  ];

  const GROUP_ORDER = ['Clássicos', 'Ação', 'Puzzle', 'Educativo', 'Criativo'];
  const GROUP_ICONS = { 'Clássicos': '🎲', 'Ação': '⚡', 'Puzzle': '🧩', 'Educativo': '📚', 'Criativo': '🎨' };

  const registry = {
    hangman:        { initialized: true },
    minesweeper:    { init: () => MinesweeperGame.init(document.getElementById('pane-minesweeper')),   initialized: false },
    bomb:           { init: () => BombGame.init(document.getElementById('pane-bomb')),                 initialized: false },
    memory:         { init: () => MemoryGame.init(document.getElementById('pane-memory')),             initialized: false },
    wordle:         { init: () => WordleGame.init(document.getElementById('pane-wordle')),             initialized: false },
    tictactoe:      { init: () => TicTacToeGame.init(document.getElementById('pane-tictactoe')),       initialized: false },
    shooting:       { init: () => ShootingGame.init(document.getElementById('pane-shooting')),         initialized: false },
    reaction:       { init: () => ReactionGame.init(document.getElementById('pane-reaction')),         initialized: false },
    neon:           { init: () => NeonGame.init(document.getElementById('pane-neon')),                 initialized: false },
    'escape-lab':   { init: () => EscapeLabGame.init(document.getElementById('pane-escape-lab')),      initialized: false },
    'cipher-grid':  { init: () => CipherGridGame.init(document.getElementById('pane-cipher-grid')),    initialized: false },
    'robot-repair': { init: () => RobotRepairGame.init(document.getElementById('pane-robot-repair')),  initialized: false },
    'space-code':   { init: () => SpaceCodeGame.init(document.getElementById('pane-space-code')),      initialized: false },
    'math-detective':{ init: () => MathDetectiveGame.init(document.getElementById('pane-math-detective')), initialized: false },
    'treasure-vault':{ init: () => TreasureVaultGame.init(document.getElementById('pane-treasure-vault')), initialized: false },
    'cyber-maze':    { init: () => CyberMazeGame.init(document.getElementById('pane-cyber-maze')),       initialized: false },
    'neon-shooter':  { init: () => NeonShooterGame.init(document.getElementById('pane-neon-shooter')),   initialized: false },
    'sky-hopper':    { init: () => SkyHopperGame.init(document.getElementById('pane-sky-hopper')),       initialized: false },
    'gravity-lab':   { init: () => GravityLabGame.init(document.getElementById('pane-gravity-lab')),     initialized: false },
    'chain-reaction':{ init: () => ChainReactionGame.init(document.getElementById('pane-chain-reaction')), initialized: false },
    'bridge-builder':{ init: () => BridgeBuilderGame.init(document.getElementById('pane-bridge-builder')), initialized: false },
  };

  /* Unified difficulty model — same as Quizzes (Fácil / Médio / Difícil).
     Shared with quizzes via the 'quiz-difficulty' key so the whole site uses
     one progression the user learns once. */
  const DIFFS = [
    { id: 'easy',   label: 'Fácil',   dot: '🟢' },
    { id: 'medium', label: 'Médio',   dot: '🟡' },
    { id: 'hard',   label: 'Difícil', dot: '🔴' },
  ];
  /* Representative age fed to each game's existing age-based scaling, so every
     game genuinely adapts at 3 distinct levels without per-game rewrites. */
  const DIFF_AGE = { easy: 7, medium: 10, hard: 14 };

  function getDifficulty() {
    const d = localStorage.getItem('quiz-difficulty');
    return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
  }
  /* Keep the legacy per-game key in sync so all games scale to the chosen
     difficulty (Fácil→7, Médio→10, Difícil→14). */
  function _syncGameAge() {
    try { localStorage.setItem('game-age-default', String(DIFF_AGE[getDifficulty()])); } catch (e) {}
  }
  function setDifficulty(d) {
    if (!DIFF_AGE[d]) return;
    try { localStorage.setItem('quiz-difficulty', d); } catch (e) {}
    _syncGameAge();
  }
  function getGameAge() { return String(DIFF_AGE[getDifficulty()]); }

  function renderHub() {
    const hub = document.getElementById('games-hub');
    if (!hub) return;

    _syncGameAge();              /* make sure games reflect the current difficulty */
    const diff   = getDifficulty();
    const groups = {};
    GAMES.forEach(g => {
      if (!groups[g.group]) groups[g.group] = [];
      groups[g.group].push(g);
    });

    hub.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🎮 Jogos</h1>
        <p class="page-subtitle">Escolhe um jogo para começar a jogar</p>
      </div>
      <div class="gh-settings-bar">
        <span class="gh-settings-lbl">Dificuldade</span>
        <div class="gh-diff-seg" id="gh-diff-seg">
          ${DIFFS.map(d =>
            `<button class="gh-diff-btn gh-diff-${d.id}${diff===d.id?' active':''}" data-diff="${d.id}">${d.dot} ${d.label}</button>`
          ).join('')}
        </div>
      </div>
      ${GROUP_ORDER.filter(g => groups[g]).map(gName => `
        <div class="games-group">
          <div class="games-group-title">${GROUP_ICONS[gName]} ${gName}</div>
          <div class="games-hub-grid">
            ${groups[gName].map(g => `
              <button class="game-hub-card" data-game="${g.id}">
                <div class="game-hub-card-icon">${g.icon}</div>
                <div class="game-hub-card-name">${g.name}</div>
                <div class="game-hub-card-desc">${g.desc}</div>
              </button>`).join('')}
          </div>
        </div>`).join('')}`;

    /* Difficulty selector (unified Fácil/Médio/Difícil) */
    hub.querySelectorAll('#gh-diff-seg .gh-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setDifficulty(btn.dataset.diff);
        hub.querySelectorAll('#gh-diff-seg .gh-diff-btn').forEach(b => b.classList.toggle('active', b === btn));
        /* Note: Hangman has its own in-game age selector (independent of this
           global difficulty); nothing to sync here. */
      });
    });

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

    const entry = registry[gameId];
    if (!entry) {
      /* Unknown id (stale favourite or bad hash) — fall back to the hub */
      hub.hidden  = false;
      area.hidden = true;
      Nav.go('games');
      return;
    }

    const g = GAMES.find(x => x.id === gameId);
    const bcName = document.getElementById('game-bc-name');
    if (bcName) bcName.textContent = g?.name || gameId;

    document.querySelectorAll('.game-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('pane-' + gameId)?.classList.add('active');

    if (!entry.initialized) {
      entry.init();
      entry.initialized = true;
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
