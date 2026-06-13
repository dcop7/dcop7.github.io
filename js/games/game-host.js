const GameHost = (function () {
  'use strict';

  const GAMES = [
    { id: 'hangman',       name: 'Jogo da Forca',       icon: '🪢', color: '#3b82f6', group: 'Clássicos',
      desc: 'Adivinha a palavra letra a letra. Quantas tentativas precisas?' },
    { id: 'minesweeper',   name: 'Campo de Minas',       icon: '💣', color: '#10b981', group: 'Clássicos',
      desc: 'Encontra as minas sem as detonar. O clássico que nunca enjoa.' },
    { id: 'memory',        name: 'Memória',              icon: '🃏', color: '#a855f7', group: 'Clássicos',
      desc: 'Encontra todos os pares de cartas. Até 32 pares!' },
    { id: 'wordle',        name: 'Palavra do Dia',       icon: '📝', color: '#10b981', group: 'Clássicos',
      desc: 'Descobre a palavra de 5 letras em 6 tentativas. Estilo Wordle!' },
    { id: 'reaction',      name: 'Teste de Reação',      icon: '⚡', color: '#22d3ee', group: 'Clássicos',
      desc: 'Quanto tempo demoras a reagir? Testa os teus reflexos.' },
    { id: 'chess',         name: 'Xadrez',               icon: '♟️', color: '#f59e0b', group: 'Tabuleiro & Estratégia',
      desc: 'O rei dos jogos de estratégia. Enfrenta a IA em 3 níveis ou joga a 2.' },
    { id: 'battleship',    name: 'Batalha Naval',        icon: '🚢', color: '#0ea5e9', group: 'Tabuleiro & Estratégia',
      desc: 'Afunda a frota inimiga. IA cada vez mais esperta em 3 níveis.' },
    { id: 'bomb',          name: 'Desarmar Bomba',       icon: '💥', color: '#ef4444', group: 'Puzzle & Lógica',
      desc: '5–7 desafios, conta decrescente. Consegues desarmar a bomba a tempo?' },
    { id: 'gravity-lab',   name: 'Gravity Lab',          icon: '🔬', color: '#22d3ee', group: 'Puzzle & Lógica',
      desc: 'Muda a direção da gravidade para guiar a bola até à saída.' },
    { id: 'uno',           name: 'Uno',                  icon: '🃏', color: '#ef4444', group: 'Tabuleiro & Estratégia',
      desc: 'O clássico jogo de cartas. Enfrenta 3 adversários com IA. Não te esqueças do UNO!' },
    { id: 'neon-shooter',  name: 'Neon Space Shooter',   icon: '🛸', color: '#a855f7', group: 'Arcade',
      desc: 'Move a nave, dispara automático, derrota chefes e acumula combos neon!' },
  ];

  const GROUP_ORDER = ['Clássicos', 'Tabuleiro & Estratégia', 'Puzzle & Lógica', 'Arcade'];
  const GROUP_ICONS = { 'Clássicos': '🎲', 'Tabuleiro & Estratégia': '♟️', 'Puzzle & Lógica': '🧩', 'Arcade': '⚡' };

  const registry = {
    hangman:        { initialized: true },
    minesweeper:    { init: () => MinesweeperGame.init(document.getElementById('pane-minesweeper')),   initialized: false },
    bomb:           { init: () => BombGame.init(document.getElementById('pane-bomb')),                 initialized: false },
    memory:         { init: () => MemoryGame.init(document.getElementById('pane-memory')),             initialized: false },
    wordle:         { init: () => WordleGame.init(document.getElementById('pane-wordle')),             initialized: false },
    reaction:       { init: () => ReactionGame.init(document.getElementById('pane-reaction')),         initialized: false },
    chess:          { init: () => ChessGame.init(document.getElementById('pane-chess')),               initialized: false },
    battleship:     { init: () => BattleshipGame.init(document.getElementById('pane-battleship')),     initialized: false },
    uno:            { init: () => UnoGame.init(document.getElementById('pane-uno')),                   initialized: false },
    'neon-shooter':  { init: () => NeonShooterGame.init(document.getElementById('pane-neon-shooter')),   initialized: false },
    'gravity-lab':   { init: () => GravityLabGame.init(document.getElementById('pane-gravity-lab')),     initialized: false },
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

    const GP = (typeof GameProgress !== 'undefined') ? GameProgress : null;
    if (GP) GP.registerIds(GAMES.map(g => g.id));

    /* Daily challenge: a deterministic game-of-the-day from a daily-friendly pool */
    const dailyPool = ['wordle', 'minesweeper', 'memory', 'bomb', 'reaction'].filter(id => GAMES.some(g => g.id === id));
    let dailyGame = null, dailyDone = false;
    if (dailyPool.length) {
      const idx = GP ? Math.floor(GP.rng(GP.dailySeed('hub'))() * dailyPool.length) : 0;
      dailyGame = GAMES.find(g => g.id === dailyPool[idx]);
      dailyDone = GP ? GP.isDailyDone(dailyGame.id) : false;
    }

    hub.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🎮 Jogos</h1>
        <p class="page-subtitle">Escolhe um jogo para começar a jogar</p>
      </div>
      ${dailyGame ? `
      <button class="gh-daily${dailyDone ? ' done' : ''}" id="gh-daily" data-game="${dailyGame.id}">
        <div class="gh-daily-ico">${dailyGame.icon}</div>
        <div class="gh-daily-body">
          <div class="gh-daily-kicker">⭐ Desafio Diário${dailyDone ? ' · concluído ✓' : ''}</div>
          <div class="gh-daily-name">${dailyGame.name}</div>
          <div class="gh-daily-desc">${dailyGame.desc}</div>
        </div>
        <span class="gh-daily-go">Jogar →</span>
      </button>` : ''}
      <div class="gh-settings-bar">
        <span class="gh-settings-lbl">Dificuldade</span>
        <div class="gh-diff-seg" id="gh-diff-seg">
          ${DIFFS.map(d =>
            `<button class="gh-diff-btn gh-diff-${d.id}${diff===d.id?' active':''}" data-diff="${d.id}">${d.dot} ${d.label}</button>`
          ).join('')}
        </div>
        <span class="gh-bar-spacer"></span>
        <input class="gh-search" id="gh-search" type="search" placeholder="🔍 Procurar…" aria-label="Procurar jogo">
        <button class="gh-stats-btn" id="gh-stats" aria-label="Ver estatísticas e conquistas">
          📊 <span>${GP ? GP.streak() : 0}🔥 · ${GP ? GP.achievementCount() : 0}🏅</span>
        </button>
      </div>
      <div id="gh-noresults" class="gh-noresults" hidden>Nenhum jogo encontrado.</div>
      ${GROUP_ORDER.filter(g => groups[g]).map(gName => `
        <div class="games-group" data-group>
          <div class="games-group-title">${GROUP_ICONS[gName]} ${gName}</div>
          <div class="games-hub-grid">
            ${groups[gName].map(g => `
              <button class="game-hub-card" data-game="${g.id}" data-name="${g.name.toLowerCase()}">
                <img class="game-hub-card-img" src="assets/games/${g.id}.jpg" alt="" loading="lazy" onerror="this.remove()">
                <div class="game-hub-card-icon">${g.icon}</div>
                <div class="game-hub-card-name">${g.name}</div>
                <div class="game-hub-card-desc">${g.desc}</div>
                ${GP ? GP.badgesHTML(g.id) : ''}
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
    hub.querySelector('#gh-daily')?.addEventListener('click', () => Nav.go('games/' + dailyGame.id));
    hub.querySelector('#gh-stats')?.addEventListener('click', () => GP && GP.openStats());

    /* Live search across cards */
    const search = hub.querySelector('#gh-search');
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      hub.querySelectorAll('.games-group[data-group]').forEach(grp => {
        let groupHas = false;
        grp.querySelectorAll('.game-hub-card').forEach(card => {
          const match = !q || card.dataset.name.includes(q) || (card.querySelector('.game-hub-card-desc')?.textContent.toLowerCase().includes(q));
          card.hidden = !match;
          if (match) { groupHas = true; any = true; }
        });
        grp.hidden = !groupHas;
      });
      hub.querySelector('#gh-noresults').hidden = any;
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

  return { show, getDifficulty, setDifficulty };
})();
