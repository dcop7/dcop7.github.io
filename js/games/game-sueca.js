/* ══════════════════════════════════════════════════════════════════
   SuecaGame — Sueca portuguesa completa, offline, contra IA.
   Regras tradicionais: baralho de 40 cartas, hierarquia A>7>K>J>Q>6…2,
   pontos A=11 7=10 R=4 V=3 D=2 (120 no total), obrigação de assistir,
   trunfo = última carta do distribuidor, jogo ganho com mais de 60,
   >90 vale 2 jogos, 120 vale 4; 4 jogos fazem uma bandeira; empate a
   60 passa um jogo para a mão seguinte. Variante opcional: última
   vazada vale +10 (total 130, ganha quem passar 65).

   Modos: Jogar (tu + parceiro IA vs 2 IA) e Observar (4 IA).
   IA em 4 níveis — nunca vê cartas escondidas, só informação pública:
     • fácil        — carta legal aleatória.
     • médio        — tenta ganhar vazadas com pontos, poupa cartas fortes.
     • difícil      — conta trunfos saídos, não corta ao parceiro,
                      amarra pontos quando o parceiro está a ganhar.
     • especialista — memória das cartas jogadas, inferência de faltas
                      (renúncias vistas) e estimativa probabilística de
                      quem ainda pode cobrir cada carta.
   Integra GameProgress (jogos, vitórias, capotes, bandeiras, conquistas)
   e guarda a partida em curso no localStorage para retomar mais tarde.
══════════════════════════════════════════════════════════════════ */
const SuecaGame = (function () {
  'use strict';

  /* ── constantes do baralho ─────────────────────────────────────── */
  const SUITS  = ['s', 'h', 'd', 'c'];
  const SUIT_G = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_N = { s: 'Espadas', h: 'Copas', d: 'Ouros', c: 'Paus' };
  const RED    = { h: true, d: true };
  /* força decrescente: índice menor = carta mais forte */
  const RANKS  = ['A', '7', 'K', 'J', 'Q', '6', '5', '4', '3', '2'];
  const PTS    = { A: 11, 7: 10, K: 4, J: 3, Q: 2 };
  const RLABEL = { A: 'A', 7: '7', K: 'R', J: 'V', Q: 'D', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };

  const TEAM_OF = p => p % 2;                      /* 0/2 = Nós, 1/3 = Eles */
  const NEXT    = p => (p + 1) % 4;                /* sentido anti-horário no ecrã */
  const cid     = c => c.r + c.s;
  const pts     = c => PTS[c.r] || 0;
  const rank    = c => RANKS.indexOf(c.r);         /* menor = mais forte */

  /* ── i18n (fallback embebido; games/sueca/i18n.json pode sobrepor) ─ */
  const FB_I18N = {
    pt: {
      title: 'Sueca', tagline: 'O clássico jogo de cartas português. 2 contra 2, 120 pontos em disputa.',
      play: '▶ Jogar', watch: '👁 Observar (4 IA)', resume: '⏯ Continuar partida',
      howto: '📖 Como jogar', newMatch: 'Nova partida', nextHand: '▶ Próxima mão',
      backMenu: '⬅ Menu', quit: 'Sair', quitQ: 'Sair da partida? Podes continuá-la mais tarde a partir do menu.',
      quitYes: 'Sair', quitNo: 'Continuar a jogar',
      us: 'Nós', them: 'Eles', you: 'Tu', partner: 'Parceiro',
      trump: 'Trunfo', dealer: 'Dá', games: 'jogos', flags: 'bandeiras',
      yourTurn: 'A tua vez — toca numa carta para a jogar.',
      confirmTap: 'Toca outra vez para confirmar.',
      mustFollow: 'Tens de assistir a {s}.',
      thinking: '{n} está a pensar…',
      trickWon: '{n} leva a vazada (+{p})',
      lastTrick: 'Última vazada +10',
      handTitle: 'Fim da mão', points: 'Pontos', result: 'Resultado',
      tie: 'Empate a {n} — um jogo fica para a próxima mão!',
      win1: '{t} ganham 1 jogo', win2: '{t} ganham 2 jogos (mais de 90)!',
      win4: '{t} levam os 120 pontos — 4 jogos!', carryNote: '+{n} de mãos empatadas',
      matchWin: '🚩 Bandeira para {t}!', matchTitle: 'Fim da partida',
      youWon: 'Ganharam a partida! 🎉', youLost: 'Perderam a partida.',
      diff: 'Dificuldade', dEasy: 'Fácil', dMedium: 'Médio', dHard: 'Difícil', dExpert: 'Especialista',
      var10: 'Última vazada vale +10 (variante)', sound: 'Som',
      statPlays: 'Jogos', statWins: 'Vitórias', statLosses: 'Derrotas',
      statRate: 'Vitórias %', statFlags: 'Bandeiras', statCapotes: 'Capotes',
      history: 'Vazadas', replay: '🔁 Rever a mão', trick: 'Vazada',
      close: 'Fechar', prev: '⟨ Anterior', next: 'Seguinte ⟩',
      speed: 'Velocidade', winner: 'vence',
      tut1T: 'O trunfo', tut1B: 'No início de cada mão, a última carta do distribuidor define o naipe de trunfo. Um trunfo ganha a qualquer carta de outro naipe.',
      tut2T: 'A tua mão', tut2B: 'Recebes 10 cartas. És obrigado a assistir: se tens cartas do naipe jogado, só podes jogar desse naipe. As cartas jogáveis ficam realçadas.',
      tut3T: 'A vazada', tut3B: 'Cada jogador joga uma carta. Ganha o trunfo mais alto — ou, sem trunfos, a carta mais alta do naipe de saída. Quem ganha, sai primeiro na seguinte.',
      tut4T: 'Os pontos', tut4B: 'Ás=11, Sete=10, Rei=4, Valete=3, Dama=2 — 120 pontos por mão. A tua equipa (tu + parceiro em frente) precisa de mais de 60 para ganhar o jogo.',
      tut5T: 'Jogos e bandeiras', tut5B: 'Mais de 90 pontos vale 2 jogos; os 120 valem 4. A primeira equipa a somar 4 jogos conquista a bandeira e vence a partida. Boa sorte!',
      tutDone: 'Começar a jogar', tutNext: 'Seguinte →',
    },
    en: {
      title: 'Sueca', tagline: 'The classic Portuguese card game. 2 vs 2, 120 points at stake.',
      play: '▶ Play', watch: '👁 Watch (4 AI)', resume: '⏯ Resume match',
      howto: '📖 How to play', newMatch: 'New match', nextHand: '▶ Next hand',
      backMenu: '⬅ Menu', quit: 'Quit', quitQ: 'Leave the match? You can resume it later from the menu.',
      quitYes: 'Leave', quitNo: 'Keep playing',
      us: 'Us', them: 'Them', you: 'You', partner: 'Partner',
      trump: 'Trump', dealer: 'Deal', games: 'games', flags: 'flags',
      yourTurn: 'Your turn — tap a card to play it.',
      confirmTap: 'Tap again to confirm.',
      mustFollow: 'You must follow {s}.',
      thinking: '{n} is thinking…',
      trickWon: '{n} takes the trick (+{p})',
      lastTrick: 'Last trick +10',
      handTitle: 'End of hand', points: 'Points', result: 'Result',
      tie: 'Tied at {n} — one game carries to the next hand!',
      win1: '{t} win 1 game', win2: '{t} win 2 games (over 90)!',
      win4: '{t} take all 120 points — 4 games!', carryNote: '+{n} from tied hands',
      matchWin: '🚩 Flag for {t}!', matchTitle: 'Match over',
      youWon: 'You won the match! 🎉', youLost: 'You lost the match.',
      diff: 'Difficulty', dEasy: 'Easy', dMedium: 'Medium', dHard: 'Hard', dExpert: 'Expert',
      var10: 'Last trick worth +10 (variant)', sound: 'Sound',
      statPlays: 'Games', statWins: 'Wins', statLosses: 'Losses',
      statRate: 'Win %', statFlags: 'Flags', statCapotes: 'Capotes',
      history: 'Tricks', replay: '🔁 Review hand', trick: 'Trick',
      close: 'Close', prev: '⟨ Prev', next: 'Next ⟩',
      speed: 'Speed', winner: 'wins',
      tut1T: 'The trump', tut1B: 'At the start of each hand the dealer’s last card sets the trump suit. Any trump beats every card of other suits.',
      tut2T: 'Your hand', tut2B: 'You get 10 cards. You must follow suit: if you hold cards of the led suit you can only play those. Playable cards are highlighted.',
      tut3T: 'The trick', tut3B: 'Each player plays one card. Highest trump wins — or, with no trumps, the highest card of the led suit. The winner leads the next trick.',
      tut4T: 'The points', tut4B: 'Ace=11, Seven=10, King=4, Jack=3, Queen=2 — 120 points per hand. Your team (you + partner across) needs more than 60 to win the game.',
      tut5T: 'Games and flags', tut5B: 'Over 90 points is worth 2 games; all 120 is worth 4. First team to 4 games takes the flag and wins the match. Good luck!',
      tutDone: 'Start playing', tutNext: 'Next →',
    },
  };
  const _hasGD = typeof GameData !== 'undefined';
  const t = _hasGD ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  const fmt = (k, o) => { let s = t(k); for (const x in (o || {})) s = s.replace('{' + x + '}', o[x]); return s; };

  const NAMES_PLAY  = ['Tu', 'Rosa', 'Chico', 'Zé'];
  const NAMES_WATCH = ['Ana', 'Rosa', 'Chico', 'Zé'];
  const AVATARS     = ['🧑', '👩', '👨‍🦳', '🧔'];

  /* ── estado ────────────────────────────────────────────────────── */
  let root = null, S = null, seq = 0;
  const store = () => (typeof GameProgress !== 'undefined')
    ? GameProgress.store('sueca')
    : { getPref: (k, d) => d, setPref: () => {}, getStats: () => ({}), updateStats: () => {} };

  const soundOn = () => store().getPref('sound', true);
  const sfx = name => { try { if (soundOn() && typeof GameAudio !== 'undefined') GameAudio[name](); } catch (e) {} };
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion() ? Math.min(ms, 120) : Math.round(ms / (S && S.speed || 1))));
  const hoverable = () => window.matchMedia && window.matchMedia('(hover:hover)').matches;

  function names() { return S && S.mode === 'watch' ? NAMES_WATCH : NAMES_PLAY; }
  function teamName(tm) { return tm === 0 ? t('us') : t('them'); }

  /* ── baralho / regras ──────────────────────────────────────────── */
  function buildDeck() {
    const d = [];
    SUITS.forEach(s => RANKS.forEach(r => d.push({ s, r })));
    return d;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* b bate a? (a = carta atualmente vencedora, lead = naipe de saída) */
  function beats(b, a, lead) {
    if (b.s === a.s) return rank(b) < rank(a);
    if (b.s === S.trump) return true;              /* a não é trunfo (senão b.s===a.s tratado acima) */
    return false;                                   /* não assistiu nem trunfou */
  }
  function trickWinner(trick) {
    let w = trick[0];
    for (let i = 1; i < trick.length; i++) if (beats(trick[i].card, w.card, trick[0].card.s)) w = trick[i];
    return w;
  }
  function trickPts(trick) { return trick.reduce((n, x) => n + pts(x.card), 0); }
  function legalMoves(hand, lead) {
    if (!lead) return hand.slice();
    const follow = hand.filter(c => c.s === lead);
    return follow.length ? follow : hand.slice();
  }
  function sortHand(hand) {
    const order = [S.trump].concat(SUITS.filter(s => s !== S.trump));
    hand.sort((a, b) => order.indexOf(a.s) - order.indexOf(b.s) || rank(a) - rank(b));
  }

  /* ── memória pública (o que qualquer jogador atento sabe) ──────── */
  function memInit() {
    return { played: {}, voids: [{}, {}, {}, {}], trumpsOut: 0 };
  }
  function memNote(p, card, lead) {
    S.mem.played[cid(card)] = true;
    if (card.s === S.trump) S.mem.trumpsOut++;
    if (lead && card.s !== lead) S.mem.voids[p][lead] = true;
  }
  /* cartas de um naipe ainda por ver, do ponto de vista do jogador p */
  function unseen(p, suit) {
    const out = [];
    RANKS.forEach(r => {
      const c = { s: suit, r };
      if (S.mem.played[cid(c)]) return;
      if (S.hands[p].some(x => x.s === c.s && x.r === c.r)) return;
      /* a carta de trunfo virada é pública: pertence ao distribuidor */
      out.push(c);
    });
    return out;
  }
  /* a carta é a mais forte ainda em jogo do seu naipe, aos olhos de p? */
  function isBoss(p, card) {
    return !unseen(p, card.s).some(c => rank(c) < rank(card));
  }

  /* ── IA ────────────────────────────────────────────────────────── */
  function aiPlay(p) {
    const hand  = S.hands[p];
    const lead  = S.trick.length ? S.trick[0].card.s : null;
    const legal = legalMoves(hand, lead);
    if (legal.length === 1) return legal[0];
    const lvl = S.level;
    if (lvl === 'easy') return legal[Math.floor(Math.random() * legal.length)];
    if (lvl === 'medium') return aiMedium(p, legal, lead);
    return aiSmart(p, legal, lead, lvl === 'expert');
  }

  function currentWin() { return S.trick.length ? trickWinner(S.trick) : null; }
  const lowest  = cards => cards.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  const cheapest = cards => cards.slice().sort((a, b) => pts(a) - pts(b) || rank(b) - rank(a))[0];
  const fattest  = cards => cards.slice().sort((a, b) => pts(b) - pts(a) || rank(a) - rank(b))[0];

  function winners(legal) {
    const w = currentWin();
    if (!w) return legal.slice();
    return legal.filter(c => beats(c, w.card, S.trick[0].card.s));
  }

  function aiMedium(p, legal, lead) {
    const w = currentWin();
    const potPts = trickPts(S.trick);
    if (!lead) {
      /* sair: ás de naipe lateral se o tiver; senão carta baixa sem pontos */
      const ace = legal.find(c => c.r === 'A' && c.s !== S.trump);
      if (ace && Math.random() < 0.7) return ace;
      const junk = legal.filter(c => !pts(c));
      return junk.length ? lowest(junk) : cheapest(legal);
    }
    if (w && TEAM_OF(w.p) === TEAM_OF(p)) {
      /* parceiro a ganhar → amarra pontos */
      return fattest(legal);
    }
    const canWin = winners(legal);
    if (canWin.length && (potPts >= 3 || S.trick.length === 3)) {
      /* ganhar com a carta vencedora mais barata */
      return canWin.sort((a, b) => pts(a) - pts(b) || rank(b) - rank(a))[0];
    }
    /* esparrar: livrar a carta mais fraca e sem pontos */
    const junk = legal.filter(c => !pts(c));
    return junk.length ? lowest(junk) : cheapest(legal);
  }

  /* difícil + especialista partilham a estrutura; o especialista junta
     probabilidade de ainda ser coberto pelos adversários que faltam */
  function aiSmart(p, legal, lead, expert) {
    const w = currentWin();
    const pot = trickPts(S.trick);
    const last = S.trick.length === 3;
    const partnerWinning = w && TEAM_OF(w.p) === TEAM_OF(p);

    /* probabilidade (aprox.) de um adversário que ainda joga cobrir `card` */
    function beatChance(card) {
      if (last) return 0;
      let chance = 0;
      const leadSuit = lead || card.s;
      /* jogadores que ainda vão jogar nesta vazada */
      const toPlay = [];
      let q = NEXT(p);
      while (toPlay.length < 3 - S.trick.length) { toPlay.push(q); q = NEXT(q); }
      const foes = toPlay.filter(x => TEAM_OF(x) !== TEAM_OF(p));
      for (const f of foes) {
        let pf = 0;
        const voidLead = S.mem.voids[f][leadSuit];
        if (!expert) {
          /* difícil: heurística binária — existe carta melhor por ver? */
          const higher = unseen(p, leadSuit).filter(c => beats(c, card, leadSuit));
          const trumps = (card.s !== S.trump) ? unseen(p, S.trump).length : 0;
          pf = (higher.length || (voidLead && trumps)) ? 0.5 : 0;
        } else {
          /* especialista: nº de cartas que cobrem ÷ cartas por ver;
             quem renunciou ao naipe só cobre com trunfo */
          const cover = voidLead
            ? unseen(p, S.trump).filter(c => beats(c, card, leadSuit))
            : unseen(p, leadSuit).filter(c => beats(c, card, leadSuit));
          const slots = S.hands[f].length;
          const totalUnseen = 40 - Object.keys(S.mem.played).length - S.hands[p].length - S.trick.length;
          if (totalUnseen > 0 && cover.length) pf = Math.min(0.95, cover.length * slots / totalUnseen * 1.4);
          /* a carta de trunfo do distribuidor é conhecida */
          if (S.trumpHolder === f && !S.mem.played[cid(S.trumpCard)] &&
              beats(S.trumpCard, card, leadSuit)) pf = Math.max(pf, 0.9);
        }
        chance = Math.max(chance, pf);
      }
      return chance;
    }

    /* ── a sair ── */
    if (!lead) {
      const cands = legal.map(c => {
        let v = 0;
        if (isBoss(p, c) && c.s !== S.trump) v += 8 + pts(c);           /* carta mandona lateral */
        if (isBoss(p, c) && c.s === S.trump) v += 4 + pts(c) * 0.3;     /* puxar trunfo só com força */
        if (c.s === S.trump && !isBoss(p, c)) v -= 6;                    /* não gastar trunfos à toa */
        if (pts(c) && !isBoss(p, c)) v -= pts(c) * (expert ? beatChance(c) : 0.6);
        if (!pts(c) && !isBoss(p, c)) v += 2 - rank(c) * 0.1;            /* saída barata */
        /* especialista: evita naipes onde os adversários já renunciaram */
        if (expert) {
          const foesVoid = [1, 3].map(x => (p + x) % 4).filter(f => TEAM_OF(f) !== TEAM_OF(p) && S.mem.voids[f][c.s]);
          if (foesVoid.length && c.s !== S.trump) v -= 5;
        }
        return { c, v };
      });
      cands.sort((a, b) => b.v - a.v);
      return cands[0].c;
    }

    /* ── a assistir / a responder ── */
    const canWin = winners(legal);
    if (partnerWinning) {
      const partnerHolds = last || (expert ? beatChance(w.card) < 0.35 : isBoss(p, w.card));
      if (partnerHolds) return fattest(legal);                           /* amarrar pontos */
      if (canWin.length) {
        /* reforçar por cima do parceiro só se valer a pena */
        const cheapWin = canWin.sort((a, b) => pts(a) - pts(b) || rank(b) - rank(a))[0];
        if (pot + pts(cheapWin) >= 10 || last) return cheapWin;
      }
      const junk = legal.filter(c => !pts(c));
      return junk.length ? lowest(junk) : cheapest(legal);
    }
    if (canWin.length) {
      const cheapWin = canWin.sort((a, b) => pts(a) - pts(b) || rank(b) - rank(a))[0];
      const gain = pot + pts(cheapWin);
      const risk = expert ? beatChance(cheapWin) : (last ? 0 : 0.4);
      if (last) return gain > 0 || legal.length === canWin.length ? cheapWin : cheapest(legal);
      if (gain >= 10 && risk < 0.55) return cheapWin;
      if (gain >= 4 && risk < 0.3) return cheapWin;
      if (cheapWin.s === S.trump && pts(cheapWin) === 0 && pot >= 4 && risk < 0.6) return cheapWin;
    }
    /* não dá (ou não vale a pena) ganhar → menor perda possível */
    const junk = legal.filter(c => !pts(c) && c.s !== S.trump);
    if (junk.length) return lowest(junk);
    const nonTrump = legal.filter(c => c.s !== S.trump);
    if (nonTrump.length) return cheapest(nonTrump);
    return cheapest(legal);
  }

  /* ── partida / mão ─────────────────────────────────────────────── */
  function totalPts() { return S.var10 ? 130 : 120; }

  function newMatch(mode) {
    S = {
      mode, level: store().getPref('level', defaultLevel()),
      var10: store().getPref('var10', false),
      speed: 1,
      jogos: [0, 0], carry: 0,
      dealer: Math.floor(Math.random() * 4),
      phase: 'idle', seqGuard: 0,
      lastHand: store().getPref('lastHand', null),
    };
    newHand(true);
  }

  function defaultLevel() {
    try {
      const d = (typeof GameHost !== 'undefined') ? GameHost.getDifficulty() : 'medium';
      return { easy: 'easy', medium: 'medium', hard: 'hard' }[d] || 'medium';
    } catch (e) { return 'medium'; }
  }

  function newHand(first) {
    if (!first) S.dealer = NEXT(S.dealer);
    const deck = shuffle(buildDeck());
    /* distribuir: começa à direita do distribuidor, distribuidor recebe por último */
    const order = [NEXT(S.dealer), NEXT(NEXT(S.dealer)), NEXT(NEXT(NEXT(S.dealer))), S.dealer];
    S.hands = [[], [], [], []];
    order.forEach((pl, i) => { S.hands[pl] = deck.slice(i * 10, i * 10 + 10); });
    S.trumpCard   = S.hands[S.dealer][9];          /* última carta do distribuidor */
    S.trump       = S.trumpCard.s;
    S.trumpHolder = S.dealer;
    sortHand(S.hands[0]);
    S.trick = []; S.log = []; S.won = [[], []];
    S.turn = NEXT(S.dealer);                       /* sai o jogador à direita de quem dá */
    S.mem = memInit();
    S.lastWinnerTeam = null;
    S.phase = 'playing';
    saveState();
    renderGame(true);
    const tok = ++seq;
    wait(900 + (reduceMotion() ? 0 : 400)).then(() => { if (tok === seq) nextTurn(); });
  }

  /* ── persistência (retomar partidas) ───────────────────────────── */
  function saveState() {
    if (!S || S.phase === 'idle' || S.mode === 'watch') return;
    try {
      store().setPref('saved', {
        mode: S.mode, level: S.level, var10: S.var10,
        jogos: S.jogos, carry: S.carry, dealer: S.dealer,
        hands: S.hands, trick: S.trick, turn: S.turn,
        trump: S.trump, trumpCard: S.trumpCard, trumpHolder: S.trumpHolder,
        won: S.won, log: S.log, mem: S.mem, phase: S.phase,
        lastWinnerTeam: S.lastWinnerTeam,
      });
    } catch (e) {}
  }
  function clearSaved() { try { store().setPref('saved', null); } catch (e) {} }
  function savedMatch() { const s = store().getPref('saved', null); return (s && s.hands && s.phase) ? s : null; }

  function resumeMatch() {
    const sv = savedMatch();
    if (!sv) return renderMenu();
    S = Object.assign({ speed: 1, lastHand: store().getPref('lastHand', null) }, sv);
    if (S.phase === 'handEnd') { renderGame(false); return endHand(true); }
    const tok = ++seq;
    if (S.trick.length === 4) {           /* gravado entre a 4ª carta e a resolução */
      S.phase = 'trickEnd';
      renderGame(false);
      wait(800).then(() => { if (tok === seq) resolveTrick(); });
      return;
    }
    S.phase = 'playing';
    renderGame(false);
    wait(600).then(() => { if (tok === seq) nextTurn(); });
  }

  /* ── fluxo de jogo ─────────────────────────────────────────────── */
  function nextTurn() {
    if (!S || S.phase !== 'playing') return;
    updateSeats();
    const human = S.mode === 'play' && S.turn === 0;
    if (human) {
      setHint(t('yourTurn'));
      renderHand();
      return;
    }
    setHint(fmt('thinking', { n: names()[S.turn] }));
    const tok = seq;
    const think = 700 + Math.random() * 500;
    wait(think).then(() => {
      if (tok !== seq || !S || S.phase !== 'playing') return;
      const card = aiPlay(S.turn);
      playCard(S.turn, card);
    });
  }

  function humanPlay(card) {
    if (!S || S.phase !== 'playing' || S.turn !== 0 || S.mode !== 'play') return;
    const lead  = S.trick.length ? S.trick[0].card.s : null;
    const legal = legalMoves(S.hands[0], lead);
    if (!legal.some(c => cid(c) === cid(card))) {
      setHint(fmt('mustFollow', { s: SUIT_G[lead] + ' ' + SUIT_N[lead] }));
      sfx('fail');
      return;
    }
    playCard(0, card);
  }

  function playCard(p, card) {
    const lead = S.trick.length ? S.trick[0].card.s : null;
    const hand = S.hands[p];
    const i = hand.findIndex(c => cid(c) === cid(card));
    if (i < 0) return;
    hand.splice(i, 1);
    memNote(p, card, lead);
    S.trick.push({ p, card });
    sfx('click');
    dropCard(p, card);
    if (p === 0) renderHand();
    updateSeats();

    const tok = seq;
    if (S.trick.length === 4) {
      S.phase = 'trickEnd';
      saveState();
      wait(950).then(() => { if (tok === seq) resolveTrick(); });
    } else {
      S.turn = NEXT(S.turn);        /* avançar antes de gravar, para o retomar acertar */
      saveState();
      wait(320).then(() => { if (tok === seq) nextTurn(); });
    }
  }

  function resolveTrick() {
    if (!S) return;
    const w  = trickWinner(S.trick);
    const tm = TEAM_OF(w.p);
    const p  = trickPts(S.trick);
    S.won[tm].push(...S.trick.map(x => x.card));
    S.log.push({ trick: S.trick.slice(), winner: w.p });
    S.lastWinnerTeam = tm;
    flashMsg(fmt('trickWon', { n: seatName(w.p), p }), tm === 0 ? 'good' : 'bad');
    sfx(S.mode === 'play' ? (tm === 0 ? 'success' : 'pop') : 'pop');
    collectTrick(w.p);

    const tok = seq;
    wait(reduceMotion() ? 250 : 750).then(() => {
      if (tok !== seq) return;
      S.trick = [];
      renderTrick();
      updateScores();
      if (S.log.length === 10) { S.phase = 'handEnd'; saveState(); endHand(false); }
      else { S.turn = w.p; S.phase = 'playing'; saveState(); nextTurn(); }
    });
  }

  function teamPts(tm) {
    let n = S.won[tm].reduce((a, c) => a + pts(c), 0);
    if (S.var10 && S.log.length === 10 && S.lastWinnerTeam === tm) n += 10;
    return n;
  }

  function endHand(resumed) {
    const ptsUs = teamPts(0), ptsThem = teamPts(1);
    const half  = totalPts() / 2;
    let winTeam = null, jog = 0, msg;
    if (ptsUs === ptsThem) { msg = fmt('tie', { n: ptsUs }); }
    else {
      winTeam = ptsUs > ptsThem ? 0 : 1;
      const wp = Math.max(ptsUs, ptsThem);
      const lp = Math.min(ptsUs, ptsThem);
      if (lp === 0 && wp === totalPts()) jog = 4;
      else if (wp > half + (totalPts() / 4)) jog = 2;   /* >90 (ou >97,5 na variante) */
      else jog = 1;
      msg = fmt(jog === 4 ? 'win4' : jog === 2 ? 'win2' : 'win1', { t: teamName(winTeam) });
    }

    let carryUsed = 0;
    if (!resumed) {
      if (winTeam === null) S.carry += 1;
      else {
        carryUsed = S.carry; S.carry = 0;
        S.jogos[winTeam] += jog + carryUsed;
      }
      /* guardar a mão para replay */
      S.lastHand = { log: S.log.slice(), trump: S.trump, trumpCard: S.trumpCard, ptsUs, ptsThem, names: names().slice() };
      try { store().setPref('lastHand', S.lastHand); } catch (e) {}

      /* registo de progresso (só no modo jogar) */
      if (S.mode === 'play' && typeof GameProgress !== 'undefined') {
        const meta = {};
        if (winTeam === 0 && jog >= 2) meta.capote = true;
        if (winTeam === 0 && jog === 4) meta.cento20 = true;
        meta.level = S.level;
        const matchOver = winTeam !== null && S.jogos[winTeam] >= 4;
        if (matchOver && winTeam === 0) {
          const st = GameProgress.stats('sueca');
          meta.bandeiraWon = true;
          meta.bandeiras = (st.bandeiras || 0) + 1;
        }
        if (winTeam === 0 && jog >= 2) {
          const st = GameProgress.stats('sueca');
          meta.capotes = (st.capotes || 0) + 1;
        }
        GameProgress.record('sueca', {
          won: winTeam === null ? undefined : winTeam === 0,
          score: ptsUs, mode: 'pontos', meta,
        });
      }
      if (winTeam === 0) sfx('levelUp'); else if (winTeam === 1) sfx('fail');
      saveState();
    }

    const matchOver = winTeam !== null && S.jogos[winTeam] >= 4;
    showHandEnd({ ptsUs, ptsThem, msg, winTeam, jog, carryUsed, matchOver });
    if (matchOver) clearSaved();
  }

  /* ══════════════════ UI ══════════════════ */

  function seatName(p) { return names()[p] + (S.mode === 'play' && p === 2 ? ` (${t('partner')})` : ''); }

  function cardHTML(c, cls = '') {
    const red = RED[c.s] ? ' red' : '';
    return `<div class="sk-card${red} ${cls}" data-cid="${cid(c)}" role="img" aria-label="${RLABEL[c.r]} de ${SUIT_N[c.s]}">
      <span class="sk-cc tl"><b>${RLABEL[c.r]}</b><i>${SUIT_G[c.s]}</i></span>
      <span class="sk-pip">${SUIT_G[c.s]}</span>
      <span class="sk-cc br"><b>${RLABEL[c.r]}</b><i>${SUIT_G[c.s]}</i></span>
    </div>`;
  }
  const backHTML = (cls = '') => `<div class="sk-card sk-back ${cls}"></div>`;

  /* ── menu ── */
  function renderMenu() {
    seq++; S = null;
    const st = (typeof GameProgress !== 'undefined') ? GameProgress.stats('sueca') : { plays: 0, wins: 0, losses: 0 };
    const rate = st.plays ? Math.round(st.wins / st.plays * 100) : 0;
    const lvl = store().getPref('level', defaultLevel());
    const v10 = store().getPref('var10', false);
    const saved = savedMatch();
    const LV = [['easy', t('dEasy')], ['medium', t('dMedium')], ['hard', t('dHard')], ['expert', t('dExpert')]];
    root.innerHTML = `
    <div class="sk-wrap sk-menu-wrap">
      <div class="sk-menu">
        <div class="sk-logo">
          <div class="sk-logo-cards">${cardHTML({ s: 'h', r: 'A' }, 'l1')}${cardHTML({ s: 's', r: '7' }, 'l2')}${cardHTML({ s: 'd', r: 'K' }, 'l3')}</div>
          <h2>${t('title')}</h2>
          <p>${t('tagline')}</p>
        </div>
        ${st.plays ? `<div class="sk-stats">
          <div><b>${st.plays}</b><span>${t('statPlays')}</span></div>
          <div><b>${st.wins}</b><span>${t('statWins')}</span></div>
          <div><b>${st.losses}</b><span>${t('statLosses')}</span></div>
          <div><b>${rate}%</b><span>${t('statRate')}</span></div>
          <div><b>${st.bandeiras || 0}</b><span>${t('statFlags')}</span></div>
          <div><b>${st.capotes || 0}</b><span>${t('statCapotes')}</span></div>
        </div>` : ''}
        <div class="sk-diff-row" role="group" aria-label="${t('diff')}">
          <span class="sk-lbl">${t('diff')}</span>
          <div class="sk-seg">${LV.map(([id, lb]) =>
            `<button class="sk-seg-btn${lvl === id ? ' on' : ''}" data-lvl="${id}">${lb}</button>`).join('')}</div>
        </div>
        <label class="sk-check"><input type="checkbox" id="sk-var10" ${v10 ? 'checked' : ''}> ${t('var10')}</label>
        <label class="sk-check"><input type="checkbox" id="sk-sound" ${soundOn() ? 'checked' : ''}> 🔊 ${t('sound')}</label>
        <div class="sk-menu-btns">
          ${saved ? `<button class="sk-btn primary" id="sk-resume">${t('resume')} <small>(${t('us')} ${saved.jogos[0]}–${saved.jogos[1]} ${t('them')})</small></button>` : ''}
          <button class="sk-btn ${saved ? '' : 'primary'}" id="sk-play">${t('play')}</button>
          <button class="sk-btn" id="sk-watch">${t('watch')}</button>
          <button class="sk-btn ghost" id="sk-howto">${t('howto')}</button>
        </div>
      </div>
    </div>`;
    root.querySelectorAll('[data-lvl]').forEach(b => b.addEventListener('click', () => {
      store().setPref('level', b.dataset.lvl);
      root.querySelectorAll('[data-lvl]').forEach(x => x.classList.toggle('on', x === b));
    }));
    root.querySelector('#sk-var10').addEventListener('change', e => store().setPref('var10', e.target.checked));
    root.querySelector('#sk-sound').addEventListener('change', e => store().setPref('sound', e.target.checked));
    root.querySelector('#sk-play').addEventListener('click', () => {
      clearSaved();
      if (!store().getPref('tutDone', false)) openTutorial(() => newMatch('play'));
      else newMatch('play');
    });
    root.querySelector('#sk-watch').addEventListener('click', () => newMatch('watch'));
    root.querySelector('#sk-resume')?.addEventListener('click', resumeMatch);
    root.querySelector('#sk-howto').addEventListener('click', () => openTutorial());
  }

  /* ── mesa ── */
  function renderGame(deal) {
    const nm = names();
    root.innerHTML = `
    <div class="sk-wrap">
      <div class="sk-top">
        <div class="sk-score" id="sk-score"></div>
        <div class="sk-trump" id="sk-trump" title="${t('trump')}">
          <span class="sk-trump-lbl">${t('trump')}</span>
          ${cardHTML(S.trumpCard, 'mini')}
        </div>
        <div class="sk-topbtns">
          ${S.mode === 'watch' ? `<button class="sk-ibtn" id="sk-speed" aria-label="${t('speed')}">${S.speed}×</button>` : ''}
          <button class="sk-ibtn" id="sk-hist" aria-label="${t('history')}">📜</button>
          <button class="sk-ibtn" id="sk-snd" aria-label="${t('sound')}">${soundOn() ? '🔊' : '🔇'}</button>
          <button class="sk-ibtn" id="sk-exit" aria-label="${t('quit')}">✕</button>
        </div>
      </div>
      <div class="sk-table" id="sk-table">
        <div class="sk-seat sk-seat-n" data-p="2"><div class="sk-avatar">${AVATARS[2]}</div><div class="sk-sname">${nm[2]}</div><div class="sk-scards" id="sk-oc-2"></div></div>
        <div class="sk-seat sk-seat-w" data-p="3"><div class="sk-avatar">${AVATARS[3]}</div><div class="sk-sname">${nm[3]}</div><div class="sk-scards" id="sk-oc-3"></div></div>
        <div class="sk-seat sk-seat-e" data-p="1"><div class="sk-avatar">${AVATARS[1]}</div><div class="sk-sname">${nm[1]}</div><div class="sk-scards" id="sk-oc-1"></div></div>
        <div class="sk-seat sk-seat-s" data-p="0"><div class="sk-avatar">${AVATARS[0]}</div><div class="sk-sname">${nm[0]}</div></div>
        <div class="sk-trickzone" id="sk-trick"></div>
        <div class="sk-flash" id="sk-flash"></div>
      </div>
      <div class="sk-hand-zone"><div class="sk-hand" id="sk-hand"></div></div>
      <div class="sk-hint" id="sk-hint" aria-live="polite"></div>
    </div>`;
    root.querySelector('#sk-exit').addEventListener('click', confirmExit);
    root.querySelector('#sk-hist').addEventListener('click', () => openHistory(S.log, null));
    root.querySelector('#sk-snd').addEventListener('click', e => {
      store().setPref('sound', !soundOn());
      e.currentTarget.textContent = soundOn() ? '🔊' : '🔇';
    });
    root.querySelector('#sk-speed')?.addEventListener('click', e => {
      S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1;
      e.currentTarget.textContent = S.speed + '×';
    });
    updateScores(); updateSeats(); renderTrick(); renderHand(deal);
    if (deal) sfx('pop');
  }

  function updateScores() {
    const el = root.querySelector('#sk-score'); if (!el || !S) return;
    const dots = tm => Array.from({ length: 4 }, (_, i) => `<i class="${i < S.jogos[tm] ? 'on' : ''}"></i>`).join('');
    el.innerHTML = `
      <div class="sk-team us"><span class="sk-tname">${t('us')}</span><b>${teamPts(0)}</b><span class="sk-dots">${dots(0)}</span></div>
      <div class="sk-vs">·</div>
      <div class="sk-team them"><span class="sk-tname">${t('them')}</span><b>${teamPts(1)}</b><span class="sk-dots">${dots(1)}</span></div>
      ${S.carry ? `<span class="sk-carry" title="${fmt('carryNote', { n: S.carry })}">+${S.carry}</span>` : ''}`;
  }

  function updateSeats() {
    if (!S) return;
    [1, 2, 3].forEach(p => {
      const holder = root.querySelector('#sk-oc-' + p);
      if (holder) {
        if (S.mode === 'watch') {
          const cards = S.hands[p].slice().sort((a, b) => SUITS.indexOf(a.s) - SUITS.indexOf(b.s) || rank(a) - rank(b));
          holder.innerHTML = `<div class="sk-open">${cards.map(c => cardHTML(c, 'tiny')).join('')}</div>`;
        } else {
          holder.innerHTML = `<div class="sk-backs">${S.hands[p].map(() => backHTML('tiny')).join('')}</div>`;
        }
      }
    });
    root.querySelectorAll('.sk-seat').forEach(s => {
      const p = +s.dataset.p;
      s.classList.toggle('turn', S.phase === 'playing' && S.turn === p);
      s.classList.toggle('dealer', S.dealer === p);
    });
  }

  function renderHand(deal) {
    const el = root.querySelector('#sk-hand'); if (!el || !S) return;
    const hand = S.hands[0];
    const lead = S.trick.length ? S.trick[0].card.s : null;
    const myTurn = S.mode === 'play' && S.turn === 0 && S.phase === 'playing';
    const legal = myTurn ? legalMoves(hand, lead).map(cid) : [];
    const n = hand.length;
    el.innerHTML = hand.map((c, i) => {
      const ok = legal.includes(cid(c));
      return `<button class="sk-cardbtn${ok ? ' legal' : ''}${myTurn && !ok ? ' dim' : ''}${deal ? ' dealt' : ''}"
        style="--i:${i};--n:${n};${deal ? `animation-delay:${i * 70}ms` : ''}"
        data-cid="${cid(c)}" ${myTurn && !ok ? 'aria-disabled="true"' : ''}
        aria-label="${RLABEL[c.r]} de ${SUIT_N[c.s]}">${cardHTML(c)}</button>`;
    }).join('');
    el.querySelectorAll('.sk-cardbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = S.hands[0].find(c => cid(c) === btn.dataset.cid);
        if (!card) return;
        if (!hoverable()) {                          /* mobile: 2 toques para confirmar */
          if (!btn.classList.contains('sel')) {
            el.querySelectorAll('.sk-cardbtn.sel').forEach(b => b.classList.remove('sel'));
            btn.classList.add('sel');
            setHint(t('confirmTap'));
            return;
          }
        }
        humanPlay(card);
      });
    });
  }

  function dropCard(p, card) {
    const zone = root.querySelector('#sk-trick'); if (!zone) return;
    const seat = ['s', 'e', 'n', 'w'][p];
    const el = document.createElement('div');
    el.className = `sk-slot sk-slot-${seat} sk-from-${seat}`;
    el.innerHTML = cardHTML(card);
    zone.appendChild(el);
  }

  function renderTrick() {
    const zone = root.querySelector('#sk-trick'); if (!zone || !S) return;
    zone.innerHTML = S.trick.map(x => {
      const seat = ['s', 'e', 'n', 'w'][x.p];
      return `<div class="sk-slot sk-slot-${seat}">${cardHTML(x.card)}</div>`;
    }).join('');
  }

  function collectTrick(winner) {
    const zone = root.querySelector('#sk-trick'); if (!zone) return;
    const seat = ['s', 'e', 'n', 'w'][winner];
    zone.querySelectorAll('.sk-slot').forEach(s => s.classList.add('sk-fly-' + seat));
  }

  function setHint(msg) { const h = root.querySelector('#sk-hint'); if (h) h.textContent = msg || ''; }

  function flashMsg(msg, kind) {
    const f = root.querySelector('#sk-flash'); if (!f) return;
    f.textContent = msg;
    f.className = 'sk-flash show ' + (kind || '');
    setTimeout(() => f.classList.remove('show'), 1500);
  }

  /* ── fim de mão / partida ── */
  function showHandEnd(r) {
    const back = overlay();
    const half = totalPts() / 2;
    back.innerHTML = `
      <div class="sk-modal" role="dialog" aria-modal="true">
        <h3>${r.matchOver ? t('matchTitle') : t('handTitle')}</h3>
        <div class="sk-endpts">
          <div class="${r.winTeam === 0 ? 'w' : ''}"><span>${t('us')}</span><b>${r.ptsUs}</b></div>
          <div class="sk-endbar"><i style="width:${Math.round(r.ptsUs / totalPts() * 100)}%"></i></div>
          <div class="${r.winTeam === 1 ? 'w' : ''}"><span>${t('them')}</span><b>${r.ptsThem}</b></div>
        </div>
        ${S.var10 && S.lastWinnerTeam !== null ? `<p class="sk-endnote">${t('lastTrick')} → ${teamName(S.lastWinnerTeam)}</p>` : ''}
        <p class="sk-endmsg">${r.msg}${r.carryUsed ? ` <small>(${fmt('carryNote', { n: r.carryUsed })})</small>` : ''}</p>
        <div class="sk-endjogos">
          <span>${t('us')}: <b>${S.jogos[0]}</b>/4 ${t('games')}</span>
          <span>${t('them')}: <b>${S.jogos[1]}</b>/4 ${t('games')}</span>
        </div>
        ${r.matchOver ? `<p class="sk-endflag">${fmt('matchWin', { t: teamName(r.winTeam) })}<br><b>${S.mode === 'watch' ? '' : (r.winTeam === 0 ? t('youWon') : t('youLost'))}</b></p>` : ''}
        <div class="sk-modal-btns">
          <button class="sk-btn ghost" id="sk-e-replay">${t('replay')}</button>
          <button class="sk-btn ghost" id="sk-e-menu">${t('backMenu')}</button>
          <button class="sk-btn primary" id="sk-e-next">${r.matchOver ? t('newMatch') : t('nextHand')}</button>
        </div>
      </div>`;
    back.querySelector('#sk-e-replay').addEventListener('click', () => openReplay());
    back.querySelector('#sk-e-menu').addEventListener('click', () => { back.remove(); renderMenu(); });
    back.querySelector('#sk-e-next').addEventListener('click', () => {
      back.remove();
      if (r.matchOver) { const m = S.mode; clearSaved(); newMatch(m); }
      else newHand(false);
    });
  }

  function confirmExit() {
    const back = overlay();
    back.innerHTML = `
      <div class="sk-modal" role="dialog" aria-modal="true">
        <h3>${t('quit')}</h3><p class="sk-endmsg">${t('quitQ')}</p>
        <div class="sk-modal-btns">
          <button class="sk-btn ghost" id="sk-q-no">${t('quitNo')}</button>
          <button class="sk-btn primary" id="sk-q-yes">${t('quitYes')}</button>
        </div>
      </div>`;
    back.querySelector('#sk-q-no').addEventListener('click', () => back.remove());
    back.querySelector('#sk-q-yes').addEventListener('click', () => { back.remove(); seq++; saveState(); renderMenu(); });
  }

  /* ── histórico + replay ── */
  function trickRowHTML(entry, i, nm) {
    return `<div class="sk-hrow">
      <span class="sk-hnum">${i + 1}</span>
      <div class="sk-hcards">${entry.trick.map(x =>
        `<div class="sk-hcell${x.p === entry.winner ? ' win' : ''}"><small>${nm[x.p]}</small>${cardHTML(x.card, 'tiny')}</div>`).join('')}</div>
      <span class="sk-hwin">${nm[entry.winner]} ${t('winner')} +${trickPts(entry.trick)}</span>
    </div>`;
  }

  function openHistory(log, title) {
    const back = overlay();
    const nm = names();
    back.innerHTML = `
      <div class="sk-modal sk-modal-wide" role="dialog" aria-modal="true">
        <h3>📜 ${title || t('history')}</h3>
        <div class="sk-hlist">${log.length ? log.map((e, i) => trickRowHTML(e, i, nm)).join('') : '<p class="sk-endmsg">—</p>'}</div>
        <div class="sk-modal-btns"><button class="sk-btn primary" id="sk-h-close">${t('close')}</button></div>
      </div>`;
    back.querySelector('#sk-h-close').addEventListener('click', () => back.remove());
  }

  function openReplay() {
    const lh = (S && S.lastHand) || store().getPref('lastHand', null);
    if (!lh || !lh.log || !lh.log.length) return;
    const back = overlay();
    let i = 0;
    const nm = lh.names || names();
    function draw() {
      const runUs = lh.log.slice(0, i + 1).reduce((n, e) => n + (TEAM_OF(e.winner) === 0 ? trickPts(e.trick) : 0), 0);
      const runThem = lh.log.slice(0, i + 1).reduce((n, e) => n + (TEAM_OF(e.winner) === 1 ? trickPts(e.trick) : 0), 0);
      back.innerHTML = `
        <div class="sk-modal sk-modal-wide" role="dialog" aria-modal="true">
          <h3>🔁 ${t('replay')} — ${t('trick')} ${i + 1}/10 <span class="sk-rep-trump">${t('trump')}: <b class="${RED[lh.trump] ? 'red' : ''}">${SUIT_G[lh.trump]}</b></span></h3>
          <div class="sk-hlist">${trickRowHTML(lh.log[i], i, nm)}</div>
          <p class="sk-endmsg">${t('us')} ${runUs} · ${t('them')} ${runThem}</p>
          <div class="sk-modal-btns">
            <button class="sk-btn ghost" id="sk-r-prev" ${i === 0 ? 'disabled' : ''}>${t('prev')}</button>
            <button class="sk-btn ghost" id="sk-r-next" ${i === 9 ? 'disabled' : ''}>${t('next')}</button>
            <button class="sk-btn primary" id="sk-r-close">${t('close')}</button>
          </div>
        </div>`;
      back.querySelector('#sk-r-prev').addEventListener('click', () => { if (i > 0) { i--; draw(); } });
      back.querySelector('#sk-r-next').addEventListener('click', () => { if (i < lh.log.length - 1) { i++; draw(); } });
      back.querySelector('#sk-r-close').addEventListener('click', () => back.remove());
    }
    draw();
  }

  /* ── tutorial ── */
  function openTutorial(done) {
    const steps = [
      ['tut1T', 'tut1B', '🂠'], ['tut2T', 'tut2B', '🖐'], ['tut3T', 'tut3B', '🎯'],
      ['tut4T', 'tut4B', '💯'], ['tut5T', 'tut5B', '🚩'],
    ];
    const back = overlay();
    let i = 0;
    function draw() {
      const [tt, tb, ic] = steps[i];
      back.innerHTML = `
        <div class="sk-modal" role="dialog" aria-modal="true" aria-label="${t('howto')}">
          <div class="sk-tut-ico">${ic}</div>
          <h3>${i + 1}/${steps.length} · ${t(tt)}</h3>
          <p class="sk-endmsg">${t(tb)}</p>
          <div class="sk-tut-dots">${steps.map((_, x) => `<i class="${x === i ? 'on' : ''}"></i>`).join('')}</div>
          <div class="sk-modal-btns">
            ${i > 0 ? `<button class="sk-btn ghost" id="sk-t-prev">${t('prev')}</button>` : ''}
            <button class="sk-btn primary" id="sk-t-next">${i === steps.length - 1 ? t('tutDone') : t('tutNext')}</button>
          </div>
        </div>`;
      back.querySelector('#sk-t-prev')?.addEventListener('click', () => { i--; draw(); });
      back.querySelector('#sk-t-next').addEventListener('click', () => {
        if (i < steps.length - 1) { i++; draw(); }
        else { store().setPref('tutDone', true); back.remove(); if (typeof done === 'function') done(); }
      });
    }
    draw();
  }

  function overlay() {
    const back = document.createElement('div');
    back.className = 'sk-overlay';
    root.appendChild(back);
    return back;
  }

  /* ── conquistas ── */
  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('sueca', [
      { id: 'sueca.first',    name: 'Primeira Sueca',  icon: '🃏', desc: 'Ganha o teu primeiro jogo de Sueca.',          test: c => c.gameId === 'sueca' && c.stats.wins >= 1 },
      { id: 'sueca.capote',   name: 'Capote!',         icon: '💥', desc: 'Ganha um jogo com mais de 90 pontos.',         test: c => c.gameId === 'sueca' && c.result.meta && c.result.meta.capote },
      { id: 'sueca.cento20',  name: '120!',            icon: '👑', desc: 'Leva os 120 pontos todos numa mão.',           test: c => c.gameId === 'sueca' && c.result.meta && c.result.meta.cento20 },
      { id: 'sueca.bandeira', name: 'Bandeira',        icon: '🚩', desc: 'Conquista uma bandeira (4 jogos).',            test: c => c.gameId === 'sueca' && c.result.meta && c.result.meta.bandeiraWon },
      { id: 'sueca.expert',   name: 'Mestre da Sueca', icon: '🎓', desc: 'Ganha um jogo no nível Especialista.',         test: c => c.gameId === 'sueca' && c.result.won && c.result.meta && c.result.meta.level === 'expert' },
      { id: 'sueca.vet',      name: 'Habitué da Mesa', icon: '🪑', desc: 'Disputa 25 jogos de Sueca.',                   test: c => c.gameId === 'sueca' && c.stats.plays >= 25 },
    ]);
  }

  /* ── css ───────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('sueca-css')) return;
    const s = document.createElement('style'); s.id = 'sueca-css';
    s.textContent = `
.sk-wrap{--sk-felt1:#1d5c3f;--sk-felt2:#0e3a26;--sk-wood:#5b3a24;--sk-gold:#d4af6a;--sk-cardface:#fdfbf4;--sk-cardink:#20242c;--sk-cardred:#c3282f;
  position:relative;display:flex;flex-direction:column;gap:10px;max-width:900px;margin:0 auto;user-select:none;-webkit-user-select:none;touch-action:manipulation}
body.light .sk-wrap{--sk-felt1:#2e7d54;--sk-felt2:#1c5c3a;--sk-gold:#b8860b}

/* ── cartas ── */
.sk-card{position:relative;width:var(--skw,64px);height:calc(var(--skw,64px)*1.45);border-radius:8px;background:linear-gradient(160deg,#fff 0%,var(--sk-cardface) 60%,#f1ecdd 100%);
  color:var(--sk-cardink);box-shadow:0 2px 6px rgba(0,0,0,.35),inset 0 0 0 1px rgba(0,0,0,.08);font-family:var(--font-head,inherit);flex:0 0 auto}
.sk-card.red{color:var(--sk-cardred)}
.sk-cc{position:absolute;display:flex;flex-direction:column;align-items:center;line-height:1;font-size:calc(var(--skw,64px)*.24)}
.sk-cc b{font-weight:800}.sk-cc i{font-style:normal;font-size:.82em}
.sk-cc.tl{top:5px;left:6px}.sk-cc.br{bottom:5px;right:6px;transform:rotate(180deg)}
.sk-pip{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--skw,64px)*.52);opacity:.9}
.sk-card.mini{--skw:38px;border-radius:5px}
.sk-card.tiny{--skw:26px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.sk-card.tiny .sk-cc.br{display:none}
.sk-back{background:linear-gradient(135deg,#274a8f,#16305f);overflow:hidden}
.sk-back::after{content:'';position:absolute;inset:3px;border-radius:5px;border:1px solid rgba(255,255,255,.25);
  background:repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 2px,transparent 2px 7px),repeating-linear-gradient(-45deg,rgba(255,255,255,.14) 0 2px,transparent 2px 7px)}

/* ── topo ── */
.sk-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sk-score{display:flex;align-items:center;gap:8px;background:var(--card,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.1));border-radius:12px;padding:6px 12px;flex:1;min-width:0}
.sk-team{display:flex;align-items:baseline;gap:6px;min-width:0}
.sk-team b{font-size:1.15rem;font-family:var(--font-mono,monospace)}
.sk-team.us b{color:var(--green,#22c55e)}.sk-team.them b{color:var(--red,#ef4444)}
.sk-tname{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#9aa)}
.sk-vs{color:var(--muted,#9aa)}
.sk-dots i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--border,rgba(255,255,255,.15));margin-left:3px}
.sk-dots i.on{background:var(--sk-gold)}
.sk-carry{font-size:.7rem;font-weight:800;color:var(--sk-gold);border:1px dashed var(--sk-gold);border-radius:999px;padding:1px 7px}
.sk-trump{display:flex;align-items:center;gap:7px;background:var(--card,rgba(255,255,255,.05));border:1px solid var(--sk-gold);border-radius:12px;padding:4px 10px}
.sk-trump-lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--sk-gold);font-weight:700}
.sk-topbtns{display:flex;gap:6px}
.sk-ibtn{width:36px;height:36px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--card,rgba(255,255,255,.05));color:var(--text,#eee);cursor:pointer;font-size:.95rem}
.sk-ibtn:hover{border-color:var(--accent,#6366f1)}

/* ── mesa ── */
.sk-table{position:relative;border-radius:26px;height:min(52vh,430px);min-height:300px;
  background:radial-gradient(ellipse at 50% 38%,var(--sk-felt1),var(--sk-felt2) 78%);
  box-shadow:inset 0 0 0 3px rgba(0,0,0,.25),inset 0 0 60px rgba(0,0,0,.45),0 10px 30px rgba(0,0,0,.35);
  border:6px solid var(--sk-wood);overflow:hidden}
.sk-table::before{content:'';position:absolute;inset:10px;border-radius:18px;border:1px solid rgba(212,175,106,.35);pointer-events:none}
.sk-table::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.05;
  background:repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 14px),repeating-linear-gradient(-45deg,#fff 0 1px,transparent 1px 14px)}

.sk-seat{position:absolute;display:flex;flex-direction:column;align-items:center;gap:3px;z-index:2}
.sk-seat-n{top:8px;left:50%;transform:translateX(-50%)}
.sk-seat-s{bottom:6px;left:50%;transform:translateX(-50%)}
.sk-seat-e{right:8px;top:50%;transform:translateY(-50%)}
.sk-seat-w{left:8px;top:50%;transform:translateY(-50%)}
.sk-avatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.25rem;
  background:rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.25);transition:box-shadow .25s,border-color .25s}
.sk-seat.turn .sk-avatar{border-color:var(--sk-gold);box-shadow:0 0 0 3px rgba(212,175,106,.35),0 0 18px rgba(212,175,106,.55);animation:skPulse 1.4s infinite}
@keyframes skPulse{50%{box-shadow:0 0 0 5px rgba(212,175,106,.2),0 0 24px rgba(212,175,106,.7)}}
.sk-sname{font-size:.7rem;font-weight:700;color:#f4efe2;text-shadow:0 1px 3px rgba(0,0,0,.6);display:flex;align-items:center;gap:4px}
.sk-seat.dealer .sk-sname::after{content:'${'D'}';font-size:.58rem;background:var(--sk-gold);color:#241a08;border-radius:50%;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-weight:900}
.sk-backs{display:flex}
.sk-backs .sk-card{margin-left:-18px}.sk-backs .sk-card:first-child{margin-left:0}
.sk-open{display:flex;flex-wrap:wrap;justify-content:center;max-width:280px}
.sk-open .sk-card{margin-left:-10px}.sk-open .sk-card:first-child{margin-left:0}
.sk-seat-e .sk-backs,.sk-seat-w .sk-backs{max-width:110px;flex-wrap:wrap}
.sk-seat-e .sk-open,.sk-seat-w .sk-open{max-width:120px}

/* vazada central */
.sk-trickzone{position:absolute;inset:0;z-index:1}
.sk-slot{position:absolute;--skw:58px}
.sk-slot-s{left:50%;top:58%;transform:translate(-50%,-50%) rotate(-2deg)}
.sk-slot-n{left:50%;top:34%;transform:translate(-50%,-50%) rotate(3deg)}
.sk-slot-e{left:62%;top:46%;transform:translate(-50%,-50%) rotate(8deg)}
.sk-slot-w{left:38%;top:46%;transform:translate(-50%,-50%) rotate(-7deg)}
.sk-from-s{animation:skFromS .35s cubic-bezier(.2,1,.3,1)}
.sk-from-n{animation:skFromN .35s cubic-bezier(.2,1,.3,1)}
.sk-from-e{animation:skFromE .35s cubic-bezier(.2,1,.3,1)}
.sk-from-w{animation:skFromW .35s cubic-bezier(.2,1,.3,1)}
@keyframes skFromS{from{transform:translate(-50%,80%) scale(.9);opacity:.4}}
@keyframes skFromN{from{transform:translate(-50%,-160%) scale(.9);opacity:.4}}
@keyframes skFromE{from{transform:translate(120%,-50%) scale(.9);opacity:.4}}
@keyframes skFromW{from{transform:translate(-220%,-50%) scale(.9);opacity:.4}}
.sk-fly-s{transition:transform .55s ease-in,opacity .55s;transform:translate(-50%,240%) scale(.4)!important;opacity:0}
.sk-fly-n{transition:transform .55s ease-in,opacity .55s;transform:translate(-50%,-300%) scale(.4)!important;opacity:0}
.sk-fly-e{transition:transform .55s ease-in,opacity .55s;transform:translate(320%,-50%) scale(.4)!important;opacity:0}
.sk-fly-w{transition:transform .55s ease-in,opacity .55s;transform:translate(-420%,-50%) scale(.4)!important;opacity:0}

.sk-flash{position:absolute;left:50%;top:14%;transform:translateX(-50%) translateY(-6px);z-index:3;pointer-events:none;
  background:rgba(0,0,0,.72);color:#fff;font-size:.82rem;font-weight:700;border-radius:999px;padding:6px 16px;opacity:0;transition:opacity .3s,transform .3s;white-space:nowrap}
.sk-flash.show{opacity:1;transform:translateX(-50%) translateY(0)}
.sk-flash.good{box-shadow:0 0 16px rgba(34,197,94,.5);border:1px solid rgba(34,197,94,.6)}
.sk-flash.bad{border:1px solid rgba(239,68,68,.5)}

/* ── mão do jogador ── */
.sk-hand-zone{min-height:calc(var(--skw,72px)*1.45 + 26px);display:flex;justify-content:center}
.sk-hand{display:flex;justify-content:center;padding-top:14px}
.sk-cardbtn{--skw:clamp(52px,9.5vw,76px);background:none;border:0;padding:0;margin-left:calc(var(--skw)*-.38);cursor:pointer;
  transform:rotate(calc((var(--i) - (var(--n) - 1)/2)*3.5deg)) translateY(calc(((var(--i) - (var(--n) - 1)/2)*(var(--i) - (var(--n) - 1)/2))*1.2px));
  transform-origin:50% 120%;transition:transform .18s ease,filter .18s}
.sk-cardbtn:first-child{margin-left:0}
.sk-cardbtn .sk-card{width:var(--skw);height:calc(var(--skw)*1.45)}
.sk-cardbtn.legal:hover,.sk-cardbtn.sel{transform:rotate(0) translateY(-16px) scale(1.06);z-index:5;position:relative}
.sk-cardbtn.legal .sk-card{box-shadow:0 4px 14px rgba(0,0,0,.4),0 0 0 2px var(--sk-gold),0 0 14px rgba(212,175,106,.35)}
.sk-cardbtn.sel .sk-card{box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 0 3px var(--sk-gold),0 0 20px rgba(212,175,106,.6)}
.sk-cardbtn.dim{filter:grayscale(.55) brightness(.72);cursor:not-allowed}
.sk-cardbtn.dealt{animation:skDeal .4s backwards cubic-bezier(.2,1,.3,1)}
@keyframes skDeal{from{transform:translateY(-46vh) rotate(0) scale(.7);opacity:0}}

.sk-hint{text-align:center;font-size:.85rem;color:var(--muted,#9aa);min-height:1.3em}

/* ── menu ── */
.sk-menu-wrap{align-items:center}
.sk-menu{width:min(560px,100%);display:flex;flex-direction:column;gap:14px;background:var(--card,rgba(255,255,255,.04));
  border:1px solid var(--border,rgba(255,255,255,.08));border-radius:20px;padding:26px}
.sk-logo{text-align:center}
.sk-logo h2{margin:8px 0 4px;font-size:1.7rem}
.sk-logo p{margin:0;color:var(--muted,#9aa);font-size:.88rem}
.sk-logo-cards{display:flex;justify-content:center;height:74px}
.sk-logo-cards .sk-card{--skw:50px}
.sk-logo-cards .l1{transform:rotate(-14deg) translate(12px,6px)}
.sk-logo-cards .l2{transform:translateY(-2px);z-index:1}
.sk-logo-cards .l3{transform:rotate(14deg) translate(-12px,6px)}
.sk-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:8px;text-align:center}
.sk-stats>div{background:rgba(255,255,255,.04);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:10px;padding:8px 4px}
.sk-stats b{display:block;font-size:1.05rem;color:var(--accent,#8b8bf1)}
.sk-stats span{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#9aa)}
.sk-diff-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sk-lbl{font-size:.78rem;color:var(--muted,#9aa);font-weight:700}
.sk-seg{display:flex;gap:4px;flex-wrap:wrap}
.sk-seg-btn{border:1px solid var(--border,rgba(255,255,255,.12));background:transparent;color:var(--text,#ddd);border-radius:999px;padding:6px 13px;font-size:.8rem;cursor:pointer}
.sk-seg-btn.on{background:var(--accent,#6366f1);border-color:var(--accent,#6366f1);color:#fff;font-weight:700}
.sk-check{display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--text2,#ccc);cursor:pointer}
.sk-menu-btns{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.sk-btn{border-radius:12px;border:1px solid var(--border,rgba(255,255,255,.14));background:var(--card2,rgba(255,255,255,.06));color:var(--text,#eee);
  padding:12px 18px;font-size:.95rem;font-weight:700;cursor:pointer;transition:transform .12s,border-color .2s}
.sk-btn:hover{transform:translateY(-1px);border-color:var(--accent,#6366f1)}
.sk-btn.primary{background:linear-gradient(135deg,var(--accent,#6366f1),var(--accent2,#8b5cf6));border:0;color:#fff}
.sk-btn.ghost{background:transparent}
.sk-btn small{font-weight:500;opacity:.8}
.sk-btn:disabled{opacity:.4;cursor:default;transform:none}

/* ── overlays / modais ── */
.sk-overlay{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:14px;border-radius:14px}
.sk-modal{width:min(430px,100%);max-height:82vh;overflow:auto;background:var(--card-solid,var(--card,#171a2e));border:1px solid var(--border,rgba(255,255,255,.1));border-radius:18px;padding:20px;text-align:center}
.sk-modal-wide{width:min(560px,100%)}
.sk-modal h3{margin:0 0 12px;font-size:1.15rem}
.sk-modal-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}
.sk-endpts{display:flex;align-items:center;gap:12px;justify-content:center;margin:6px 0 10px}
.sk-endpts>div{display:flex;flex-direction:column}
.sk-endpts span{font-size:.7rem;text-transform:uppercase;color:var(--muted,#9aa)}
.sk-endpts b{font-size:1.7rem;font-family:var(--font-mono,monospace)}
.sk-endpts .w b{color:var(--sk-gold)}
.sk-endbar{flex:1;max-width:170px;height:8px;border-radius:99px;background:var(--red,#ef4444);overflow:hidden}
.sk-endbar i{display:block;height:100%;background:var(--green,#22c55e)}
.sk-endmsg{color:var(--text2,#ccc);font-size:.92rem;margin:8px 0}
.sk-endnote{color:var(--muted,#9aa);font-size:.78rem;margin:0}
.sk-endjogos{display:flex;gap:16px;justify-content:center;font-size:.82rem;color:var(--muted,#9aa)}
.sk-endjogos b{color:var(--text,#eee)}
.sk-endflag{font-size:1rem;margin:12px 0 0}
.sk-hlist{display:flex;flex-direction:column;gap:8px;text-align:left}
.sk-hrow{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.03);border:1px solid var(--border,rgba(255,255,255,.06));border-radius:10px;padding:7px 10px;flex-wrap:wrap}
.sk-hnum{font-weight:900;color:var(--muted,#9aa);width:18px;text-align:center;flex:0 0 auto}
.sk-hcards{display:flex;gap:8px}
.sk-hcell{display:flex;flex-direction:column;align-items:center;gap:2px;border-radius:6px;padding:3px}
.sk-hcell small{font-size:.58rem;color:var(--muted,#9aa)}
.sk-hcell.win{background:rgba(212,175,106,.14);box-shadow:inset 0 0 0 1px rgba(212,175,106,.5)}
.sk-hwin{margin-left:auto;font-size:.72rem;color:var(--sk-gold);font-weight:700}
.sk-rep-trump{font-size:.78rem;color:var(--muted,#9aa);margin-left:8px}
.sk-rep-trump b.red{color:var(--sk-cardred)}
.sk-tut-ico{font-size:2.4rem}
.sk-tut-dots{display:flex;gap:6px;justify-content:center;margin-top:10px}
.sk-tut-dots i{width:8px;height:8px;border-radius:50%;background:var(--border,rgba(255,255,255,.15))}
.sk-tut-dots i.on{background:var(--accent,#6366f1)}

/* ── responsivo ── */
@media (max-width:640px){
  .sk-table{height:46vh;min-height:250px;border-width:4px;border-radius:18px}
  .sk-avatar{width:30px;height:30px;font-size:1rem}
  .sk-slot{--skw:46px}
  .sk-card.tiny{--skw:20px}
  .sk-backs .sk-card{margin-left:-14px}
  .sk-seat-e .sk-backs,.sk-seat-w .sk-backs{max-width:64px}
  .sk-seat-e .sk-open,.sk-seat-w .sk-open{max-width:72px}
  .sk-cardbtn{--skw:clamp(46px,10.5vw,60px)}
  .sk-trump .sk-card.mini{--skw:30px}
  .sk-score{padding:4px 9px}
  .sk-team b{font-size:1rem}
}
@media (max-height:520px) and (orientation:landscape){
  .sk-wrap{flex-direction:row;flex-wrap:wrap;gap:8px}
  .sk-top{width:100%}
  .sk-table{flex:1;height:calc(100vh - 190px);min-height:210px}
  .sk-hand-zone{width:100%;min-height:0}
  .sk-cardbtn{--skw:48px}
}
@media (prefers-reduced-motion:reduce){
  .sk-cardbtn.dealt,.sk-from-s,.sk-from-n,.sk-from-e,.sk-from-w{animation:none}
  .sk-fly-s,.sk-fly-n,.sk-fly-e,.sk-fly-w{transition:opacity .2s;opacity:0}
  .sk-seat.turn .sk-avatar{animation:none}
}`;
    document.head.appendChild(s);
  }

  /* ── init ──────────────────────────────────────────────────────── */
  function init(r) {
    root = r; if (!root) return;
    injectCSS();
    if (_hasGD) GameData.load('sueca').then(d => { if (t.use) t.use(d.i18n); renderMenu(); }).catch(() => renderMenu());
    else renderMenu();
  }

  return { init };
})();
