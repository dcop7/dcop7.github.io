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
    { id: 'sueca',         name: 'Sueca',                icon: '♠️', color: '#1a7a4a', group: 'Tabuleiro & Estratégia',
      desc: 'A sueca portuguesa: tu e o teu parceiro contra 2 IA. 120 pontos, trunfos e bandeiras.' },
    { id: 'neon-shooter',  name: 'Neon Space Shooter',   icon: '🛸', color: '#a855f7', group: 'Arcade',
      desc: 'Move a nave, dispara automático, derrota chefes e acumula combos neon!' },
    { id: 'dobble',        name: 'Olho Vivo',            icon: '👁️', color: '#f2b344', group: 'Arcade',
      desc: 'Encontra o único símbolo em comum entre as duas cartas. Rápido, o tempo não perdoa!' },
    /* ── arcade (set/2026) — todos sobre o ArcadeKit ── */
    { id: 'target',        name: 'Alvo',                 icon: '🎯', color: '#14b8a6', group: 'Clássicos',
      desc: 'Acerta nos alvos que aparecem, o mais depressa e o mais ao centro que conseguires.' },
    { id: 'golf',          name: 'Minigolfe',            icon: '⛳', color: '#22c55e', group: 'Clássicos',
      desc: '9 buracos compactos: aponta, doseia a força e tenta fazer o par.' },
    { id: 'arrow-wall',    name: 'Muro das Setas',       icon: '🧱', color: '#22c55e', group: 'Puzzle & Lógica',
      desc: 'Segue a seta verde, contraria a vermelha, fica no azul — antes de a parede chegar.' },
    { id: 'quick-maths',   name: 'Contas Rápidas',       icon: '➗', color: '#3b82f6', group: 'Puzzle & Lógica',
      desc: 'Resolve contas cada vez mais difíceis contra o relógio.' },
    { id: 'knife-throw',   name: 'Lança-Facas',          icon: '🔪', color: '#fb923c', group: 'Arcade',
      desc: 'Crava facas num tronco que gira sem tocar nas que já lá estão.' },
    { id: 'stack',         name: 'Torre',                icon: '🏗️', color: '#2dd4bf', group: 'Arcade',
      desc: 'Empilha os blocos em movimento. O que ficar de fora é cortado.' },
    { id: 'lane-rush',     name: 'Faixa Rápida',         icon: '🏎️', color: '#f472b6', group: 'Arcade',
      desc: 'Troca de faixa para fugir aos obstáculos — cada vez mais depressa.' },
    { id: 'ninja-chop',    name: 'Corte Ninja',          icon: '🥷', color: '#ef4444', group: 'Arcade',
      desc: 'Corta a fruta com o rato ou com o dedo, mas foge às bombas.' },
    { id: 'dangerwall',    name: 'Parede Mortal',        icon: '🚀', color: '#ef4444', group: 'Arcade',
      desc: 'Guia a nave pelos buracos das paredes que vêm a toda a velocidade.' },
    { id: 'jumpy',         name: 'Saltitão',             icon: '🦘', color: '#a855f7', group: 'Arcade',
      desc: 'Salta de plataforma em plataforma e sobe o mais alto possível.' },
    { id: 'chicken-up',    name: 'Galinha Acima',        icon: '🐔', color: '#f59e0b', group: 'Arcade',
      desc: 'Salta no momento certo para as tábuas que deslizam e não pares de subir.' },
    { id: 'drift',         name: 'Drift',                icon: '🚗', color: '#ef4444', group: 'Arcade',
      desc: 'Derrapa em pistas compactas e bate o teu melhor tempo por volta.' },
    { id: 'ballracer',     name: 'Bola Veloz',           icon: '🔵', color: '#f97316', group: 'Arcade',
      desc: 'Guia a bola por pistas suspensas sem cair nos buracos nem bater.' },
    { id: 'balldrop',      name: 'Queda Livre',          icon: '🟡', color: '#a855f7', group: 'Arcade',
      desc: 'Conduz a bola em queda pelos obstáculos até à zona de aterragem.' },
    /* ── lote 2 (set/2026) ── */
    { id: 'bubble-shooter', name: 'Bolhas', icon: '🫧', color: '#a78bfa', group: 'Clássicos',
      desc: 'Aponta, ressalta nas paredes e junta 3 bolhas da mesma cor.' },
    { id: 'brick-breaker', name: 'Parte-Tijolos', icon: '🟦', color: '#60a5fa', group: 'Clássicos',
      desc: 'Raquete, bola e uma parede de tijolos. 12 níveis e cápsulas de poder.' },
    { id: 'sudoku', name: 'Sudoku', icon: '9️⃣', color: '#60a5fa', group: 'Puzzle & Lógica',
      desc: 'Grelhas com solução única, notas, pistas e o Sudoku do dia.' },
    { id: '2048', name: '2048', icon: '🔢', color: '#edc22e', group: 'Puzzle & Lógica',
      desc: 'Desliza e junta peças iguais até chegares a 2048.' },
    { id: 'yahtzee', name: 'General', icon: '🎲', color: '#4ade80', group: 'Tabuleiro & Estratégia',
      desc: '5 dados, 3 lançamentos, 13 casas. Sozinho ou contra o computador.' },
    { id: 'crossy-road', name: 'Travessia', icon: '🐸', color: '#84cc16', group: 'Arcade',
      desc: 'Atravessa estradas, rios e comboios sem fim. Não fiques para trás.' },
    { id: 'hole', name: 'Buraco Guloso', icon: '🕳️', color: '#22c55e', group: 'Arcade',
      desc: 'Engole a cidade — ou aspira a casa — e cresce. Contra buracos rivais.' },
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
    sueca:          { init: () => SuecaGame.init(document.getElementById('pane-sueca')),               initialized: false },
    'neon-shooter':  { init: () => NeonShooterGame.init(document.getElementById('pane-neon-shooter')),   initialized: false },
    'gravity-lab':   { init: () => GravityLabGame.init(document.getElementById('pane-gravity-lab')),     initialized: false },
    dobble:          { init: () => DobbleGame.init(document.getElementById('pane-dobble')),              initialized: false },
  };
  /* jogos arcade: pane criado aqui (não no index.html) e init pelo ArcadeKit */
  const ARCADE = {
    'knife-throw': () => KnifeThrowGame, stack: () => StackGame, 'lane-rush': () => LaneRushGame,
    'arrow-wall': () => ArrowWallGame, jumpy: () => JumpyGame, 'ninja-chop': () => NinjaChopGame,
    dangerwall: () => DangerwallGame, drift: () => DriftGame, target: () => TargetGame,
    'quick-maths': () => QuickMathsGame, golf: () => GolfGame, ballracer: () => BallracerGame,
    'chicken-up': () => ChickenUpGame, balldrop: () => BalldropGame,
    'bubble-shooter': () => BubbleShooterGame,
    'brick-breaker': () => BrickBreakerGame,
    'sudoku': () => SudokuGame,
    '2048': () => Game2048,
    'yahtzee': () => YahtzeeGame,
    'crossy-road': () => CrossyRoadGame,
    'hole': () => HoleGame,
  };
  Object.keys(ARCADE).forEach(id => {
    registry[id] = { initialized: false, init: () => ARCADE[id]().init(document.getElementById('pane-' + id)) };
  });

  /* ── Dificuldade POR JOGO ──────────────────────────────────────────
     Já não há um seletor global no hub: cada jogo tem a sua dificuldade,
     guardada em 'gamediff:<id>', e mostra o seu próprio controlo (alguns
     com esquemas próprios — ex.: a Forca é por idade). Este helper serve
     os jogos que só querem o clássico Fácil/Médio/Difícil. */
  const DIFF_LABELS = {
    pt: { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', title: 'Dificuldade' },
    en: { easy: 'Easy',  medium: 'Medium', hard: 'Hard',   title: 'Difficulty' },
  };
  function _lang() { try { return (typeof I18n !== 'undefined' && I18n.getLang && I18n.getLang() === 'en') ? 'en' : 'pt'; } catch (e) { return 'pt'; } }

  function diffGet(id, def) {
    try { const v = localStorage.getItem('gamediff:' + id); return (v === 'easy' || v === 'medium' || v === 'hard') ? v : (def || 'medium'); }
    catch (e) { return def || 'medium'; }
  }
  function diffSet(id, v) {
    if (!/^(easy|medium|hard)$/.test(v)) return;
    try { localStorage.setItem('gamediff:' + id, v); } catch (e) {}
  }
  /* legado: mantido para compat (Quizzes usam a sua própria chave) */
  function getDifficulty() {
    const d = localStorage.getItem('quiz-difficulty');
    return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
  }
  function setDifficulty(d) {
    if (!/^(easy|medium|hard)$/.test(d)) return;
    try { localStorage.setItem('quiz-difficulty', d); } catch (e) {}
  }

  /* Controlo de dificuldade partilhado (elemento DOM pronto a inserir no
     menu de um jogo). levels opcional p/ esquemas próprios. */
  let _segCSS = false;
  function _injectSegCSS() {
    if (_segCSS) return; _segCSS = true;
    const s = document.createElement('style'); s.id = 'gh-seg-css';
    s.textContent = `
.ghseg{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center}
.ghseg-lbl{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#9aa)}
.ghseg-btn{border:1px solid var(--border,rgba(255,255,255,.16));background:var(--card,rgba(255,255,255,.05));color:inherit;border-radius:999px;padding:5px 13px;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s}
.ghseg-btn:hover{border-color:var(--accent,#6366f1)}
.ghseg-btn.on{background:var(--accent,#6366f1);border-color:var(--accent,#6366f1);color:#fff}`;
    document.head.appendChild(s);
  }
  function diffSeg(id, opts) {
    opts = opts || {}; _injectSegCSS();
    const L = DIFF_LABELS[_lang()];
    const levels = opts.levels || [{ id: 'easy', label: L.easy }, { id: 'medium', label: L.medium }, { id: 'hard', label: L.hard }];
    const def = opts.def || 'medium';
    const wrap = document.createElement('div'); wrap.className = 'ghseg';
    if (opts.label !== false) { const l = document.createElement('span'); l.className = 'ghseg-lbl'; l.textContent = (opts.label || L.title); wrap.appendChild(l); }
    const cur = diffGet(id, def);
    levels.forEach(lv => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'ghseg-btn' + (lv.id === cur ? ' on' : ''); b.textContent = lv.label; b.dataset.d = lv.id;
      b.addEventListener('click', () => {
        diffSet(id, lv.id);
        wrap.querySelectorAll('.ghseg-btn').forEach(x => x.classList.toggle('on', x === b));
        opts.onChange && opts.onChange(lv.id);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  /* ── Favoritos (até 5, guardados pelo GameProgress) ─────────────── */
  const GPx = () => (typeof GameProgress !== 'undefined' ? GameProgress : null);
  const favList = () => (GPx() && GPx().favorites ? GPx().favorites() : []);
  const MAXF = () => (GPx() && GPx().MAX_FAVS) || 5;

  function starBtn(id, on, extra) {
    const g = GAMES.find(x => x.id === id);
    return `<button type="button" class="gh-fav-btn${on ? ' on' : ''}${extra ? ' ' + extra : ''}" data-fav="${id}" aria-pressed="${on}"
      aria-label="${on ? 'Remover' : 'Adicionar'} ${g ? g.name : ''} ${on ? 'dos' : 'aos'} favoritos" title="${on ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">${on ? '★' : '☆'}</button>`;
  }

  function cardHTML(g, favs, GP) {
    const on = favs.includes(g.id);
    return `
      <div class="gh-card" data-card="${g.id}">
        <button class="game-hub-card" data-game="${g.id}" data-name="${g.name.toLowerCase()}">
          <img class="game-hub-card-img" src="assets/games/${g.id}.jpg" alt="" loading="lazy" onerror="this.remove()">
          <div class="game-hub-card-icon">${g.icon}</div>
          <div class="game-hub-card-name">${g.name}</div>
          <div class="game-hub-card-desc">${g.desc}</div>
          ${GP ? GP.badgesHTML(g.id) : ''}
        </button>
        ${GP && GP.toggleFavorite ? starBtn(g.id, on) : ''}
      </div>`;
  }

  function favSectionHTML(favs, GP) {
    const items = favs.map(id => GAMES.find(g => g.id === id)).filter(Boolean);
    return `
      <div class="games-group-title">★ Favoritos <span class="gh-fav-count">${items.length}/${MAXF()}</span></div>
      ${items.length
        ? `<div class="games-hub-grid">${items.map(g => cardHTML(g, favs, GP)).join('')}</div>`
        : `<div class="gh-fav-empty"><span class="gh-fav-empty-star" aria-hidden="true">☆</span><span>Ainda não tens favoritos. Toca na <b>☆</b> de um jogo para o fixares aqui — até ${MAXF()} jogos.</span></div>`}`;
  }

  /* Liga/desliga um favorito a partir de qualquer estrela (hub ou jogo). */
  function toggleFav(id, anchorEl) {
    const GP = GPx(); if (!GP || !GP.toggleFavorite) return;
    const r = GP.toggleFavorite(id);
    if (r.full) {
      GP.toast({ icon: '★', name: `Já tens ${MAXF()} favoritos`, desc: 'Tira a estrela a um deles para adicionares este.' }, 'info');
      anchorEl && anchorEl.classList.add('gh-fav-deny');
      anchorEl && setTimeout(() => anchorEl.classList.remove('gh-fav-deny'), 450);
      return;
    }
    refreshFavs(anchorEl);
    syncBcFav();
  }

  /* Re-pinta só a secção de favoritos e as estrelas, compensando o
     scroll para o cartão clicado não "fugir" quando a secção cresce. */
  function refreshFavs(anchorEl) {
    const hub = document.getElementById('games-hub');
    const sec = hub && hub.querySelector('#gh-favs');
    if (!sec) return;
    const GP = GPx(), favs = favList();
    const anchorId = anchorEl && anchorEl.dataset.fav;
    const inFavSec = anchorEl && sec.contains(anchorEl);
    const before = anchorEl && !inFavSec ? anchorEl.getBoundingClientRect().top : null;
    sec.innerHTML = favSectionHTML(favs, GP);
    hub.querySelectorAll('.gh-fav-btn[data-fav]').forEach(b => {
      const on = favs.includes(b.dataset.fav), g = GAMES.find(x => x.id === b.dataset.fav);
      b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on);
      b.title = on ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
      b.setAttribute('aria-label', `${on ? 'Remover' : 'Adicionar'} ${g ? g.name : ''} ${on ? 'dos' : 'aos'} favoritos`);
    });
    if (before != null && anchorEl.isConnected) window.scrollBy(0, anchorEl.getBoundingClientRect().top - before);
    const nowOn = favs.includes(anchorId);
    const pop = hub.querySelectorAll(`.gh-fav-btn[data-fav="${anchorId}"]`);
    if (nowOn) pop.forEach(b => b.classList.add('gh-fav-pop'));
    applySearch();
  }

  function applySearch() {
    const hub = document.getElementById('games-hub');
    const search = hub && hub.querySelector('#gh-search');
    if (!search) return;
    const q = search.value.trim().toLowerCase();
    let any = false;
    const favSec = hub.querySelector('#gh-favs');
    if (favSec) favSec.hidden = !!q;
    hub.querySelectorAll('.games-group[data-group]').forEach(grp => {
      let groupHas = false;
      grp.querySelectorAll('.gh-card').forEach(card => {
        const btn = card.querySelector('.game-hub-card');
        const match = !q || btn.dataset.name.includes(q) || (btn.querySelector('.game-hub-card-desc')?.textContent.toLowerCase().includes(q));
        card.hidden = !match;
        if (match) { groupHas = true; any = true; }
      });
      grp.hidden = !groupHas;
    });
    hub.querySelector('#gh-noresults').hidden = any;
  }

  function renderHub() {
    const hub = document.getElementById('games-hub');
    if (!hub) return;
    const prevQ = hub.querySelector('#gh-search')?.value || '';

    const groups = {};
    GAMES.forEach(g => {
      if (!groups[g.group]) groups[g.group] = [];
      groups[g.group].push(g);
    });

    const GP = GPx();
    if (GP) GP.registerIds(GAMES.map(g => g.id));
    const favs = favList();

    /* Daily challenge: a deterministic game-of-the-day from a daily-friendly pool */
    const dailyPool = ['wordle', 'minesweeper', 'memory', 'bomb', 'reaction', 'sudoku'].filter(id => GAMES.some(g => g.id === id));
    let dailyGame = null, dailyDone = false;
    if (dailyPool.length) {
      const idx = GP ? Math.floor(GP.rng(GP.dailySeed('hub'))() * dailyPool.length) : 0;
      dailyGame = GAMES.find(g => g.id === dailyPool[idx]);
      dailyDone = GP ? GP.isDailyDone(dailyGame.id) : false;
    }

    hub.innerHTML = `
      <div class="page-head">
        <span class="ph-ico">${AppIcons.icon('games', 22)}</span>
        <div class="ph-titles">
          <h1 class="ph-title">Jogos</h1>
          <p class="ph-sub">Escolhe um jogo para começar a jogar</p>
        </div>
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
        <input class="gh-search" id="gh-search" type="search" placeholder="🔍 Procurar…" aria-label="Procurar jogo">
        <span class="gh-bar-spacer"></span>
        <button class="gh-stats-btn" id="gh-stats" aria-label="Ver estatísticas e conquistas">
          📊 <span>${GP ? GP.streak() : 0}🔥 · ${GP ? GP.achievementCount() : 0}🏅</span>
        </button>
      </div>
      <div id="gh-noresults" class="gh-noresults" hidden>Nenhum jogo encontrado.</div>
      ${GP && GP.toggleFavorite ? `<div class="games-group gh-favs" id="gh-favs">${favSectionHTML(favs, GP)}</div>` : ''}
      ${GROUP_ORDER.filter(g => groups[g]).map(gName => `
        <div class="games-group" data-group>
          <div class="games-group-title">${GROUP_ICONS[gName]} ${gName}</div>
          <div class="games-hub-grid">
            ${groups[gName].map(g => cardHTML(g, favs, GP)).join('')}
          </div>
        </div>`).join('')}`;

    /* delegação: os cartões da secção de favoritos são re-pintados */
    hub.onclick = e => {
      const star = e.target.closest('.gh-fav-btn[data-fav]');
      if (star) { e.preventDefault(); toggleFav(star.dataset.fav, star); return; }
      const card = e.target.closest('.game-hub-card[data-game]');
      if (card) Nav.go('games/' + card.dataset.game);
    };
    hub.querySelector('#gh-daily')?.addEventListener('click', () => Nav.go('games/' + dailyGame.id));
    hub.querySelector('#gh-stats')?.addEventListener('click', () => GP && GP.openStats());

    const search = hub.querySelector('#gh-search');
    if (prevQ) { search.value = prevQ; applySearch(); }
    search?.addEventListener('input', applySearch);
  }

  /* Estrela no breadcrumb do jogo aberto */
  let _curGame = null;
  function syncBcFav() {
    const b = document.getElementById('game-bc-fav');
    if (!b) return;
    const GP = GPx();
    if (!_curGame || !GP || !GP.toggleFavorite) { b.hidden = true; return; }
    const on = favList().includes(_curGame);
    b.hidden = false; b.dataset.fav = _curGame;
    b.classList.toggle('on', on); b.textContent = on ? '★' : '☆';
    b.setAttribute('aria-pressed', on);
    b.title = on ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    b.setAttribute('aria-label', on ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
  }

  function show(gameId) {
    const hub  = document.getElementById('games-hub');
    const area = document.getElementById('games-area');
    if (!hub || !area) return;

    if (!gameId) {
      /* ao voltar de um jogo, re-pinta: recordes/estrelas podem ter mudado */
      if (hub.hidden) renderHub();
      hub.hidden  = false;
      area.hidden = true;
      _curGame = null; syncBcFav();
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
    _curGame = gameId; syncBcFav();

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
    const bf = document.getElementById('game-bc-fav');
    bf?.addEventListener('click', () => { if (_curGame) { toggleFav(_curGame, bf); syncBcFav(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  return { show, getDifficulty, setDifficulty, diffGet, diffSet, diffSeg };
})();
