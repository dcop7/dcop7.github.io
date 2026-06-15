/* ══════════════════════════════════════════════════════════════════
   UnoGame — a complete, offline Uno against 3 AI opponents.
   Self-contained engine (108-card deck, official-ish rules), heuristic
   AI at 3 levels (GameHost easy/medium/hard), and an animated table UI
   with a fanned hand, draw/discard piles, colour picker for wilds, a
   UNO call mechanic, and turn / direction indicators.

   Rules implemented:
     • match the top card by colour OR by number/symbol; Wilds anytime.
     • Wild Draw Four only legal when you hold no card of the active
       colour (enforced for the human, respected by the AI).
     • Skip / Reverse / Draw Two with correct turn flow (no stacking).
     • Draw one when you can't/won't play; a freshly drawn playable card
       may be played immediately or kept.
     • Call UNO when you drop to one card or get caught for +2.

   Difficulty (shared quiz-difficulty key):
     • easy   — plays a random legal card, random colour choice.
     • medium — dumps high-value cards, prefers action cards, picks the
                colour it holds most of.
     • hard   — also hoards Wilds, unloads Draw/Skip on the current
                leader, and only burns a Wild +4 when truly stuck.
   Integrates GameProgress (wins/losses, achievements).
══════════════════════════════════════════════════════════════════ */
const UnoGame = (function () {
  'use strict';

  const COLORS = ['red', 'yellow', 'green', 'blue'];
  const HEX = { red: '#e4322b', yellow: '#f2b417', green: '#2aa24a', blue: '#1b7ce0', wild: '#222' };
  const GLOW = { red: '255,80,70', yellow: '245,190,40', green: '60,200,110', blue: '60,150,240', wild: '180,120,255' };

  /* ── i18n (offline fallback) ───────────────────────────────────── */
  const FB_I18N = {
    pt: {
      title: 'Uno', tagline: 'Despacha as tuas cartas antes dos adversários!',
      you: 'Tu', cpu: 'CPU', play: 'Jogar', start: '▶ Começar', newGame: '🔄 Novo jogo',
      yourTurn: 'A tua vez — joga ou compra uma carta.', drawCard: '🃏 Comprar',
      pass: 'Passar', cantPlay: 'Não tens jogada — compra uma carta.',
      chooseColor: 'Escolhe uma cor', wildPick: 'Carta mágica! Escolhe a cor seguinte.',
      cpuThinking: '{n} está a pensar…', cpuPlayed: '{n} jogou {c}.', cpuDrew: '{n} comprou uma carta.',
      cpuPass: '{n} passou.', youDrew: 'Compraste {c}.', skipped: '{n} ficou sem vez!',
      reversed: 'Sentido invertido! ↺', drawTwo: '{n} compra 2 e perde a vez!', drawFour: '{n} compra 4 e perde a vez!',
      saidUno: '{n} diz UNO! 🔥', callUno: 'UNO!', caughtUno: 'Apanhado! Esqueceste o UNO — compras 2.',
      win: 'Ganhaste! 🎉', lose: '{n} ganhou.', youWon: 'Despachaste todas as cartas!',
      points: '{p} pontos', playAgain: '▶ Jogar de novo', deckEmpty: 'Baralho reposto.',
      cardsLeft: '{n} cartas', oneCard: '1 carta',
      red: 'Vermelho', yellow: 'Amarelo', green: 'Verde', blue: 'Azul',
      diffEasy: 'Fácil', diffMedium: 'Médio', diffHard: 'Difícil',
      rules: 'Combina cor ou número. Mágicas a qualquer momento. Não te esqueças do UNO!',
    },
    en: {
      title: 'Uno', tagline: 'Empty your hand before your rivals do!',
      you: 'You', cpu: 'CPU', play: 'Play', start: '▶ Start', newGame: '🔄 New game',
      yourTurn: 'Your turn — play or draw a card.', drawCard: '🃏 Draw',
      pass: 'Pass', cantPlay: 'No move — draw a card.',
      chooseColor: 'Choose a colour', wildPick: 'Wild card! Pick the next colour.',
      cpuThinking: '{n} is thinking…', cpuPlayed: '{n} played {c}.', cpuDrew: '{n} drew a card.',
      cpuPass: '{n} passed.', youDrew: 'You drew {c}.', skipped: '{n} was skipped!',
      reversed: 'Direction reversed! ↺', drawTwo: '{n} draws 2 and loses a turn!', drawFour: '{n} draws 4 and loses a turn!',
      saidUno: '{n} says UNO! 🔥', callUno: 'UNO!', caughtUno: 'Caught! You forgot UNO — draw 2.',
      win: 'You win! 🎉', lose: '{n} won.', youWon: 'You cleared your whole hand!',
      points: '{p} points', playAgain: '▶ Play again', deckEmpty: 'Deck reshuffled.',
      cardsLeft: '{n} cards', oneCard: '1 card',
      red: 'Red', yellow: 'Yellow', green: 'Green', blue: 'Blue',
      diffEasy: 'Easy', diffMedium: 'Medium', diffHard: 'Hard',
      rules: 'Match colour or number. Wilds anytime. Don\'t forget UNO!',
    },
  };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  const fmt = (k, o) => { let s = t(k); for (const x in (o || {})) s = s.replace('{' + x + '}', o[x]); return s; };

  /* ── module state ──────────────────────────────────────────────── */
  let root, S;
  const CPU_NAMES = ['Rita', 'Bruno', 'Sofia'];

  function diff() {
    try { if (typeof GameHost !== 'undefined' && GameHost.getDifficulty) return GameHost.getDifficulty(); } catch (e) {}
    const d = localStorage.getItem('quiz-difficulty');
    return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion() ? Math.min(ms, 120) : ms));
  /* pacing — CPUs must be slow enough to follow who played what */
  const THINK = 950, HOLD = 850;

  /* ── deck ──────────────────────────────────────────────────────── */
  function buildDeck() {
    const d = [];
    COLORS.forEach(c => {
      d.push({ color: c, type: 'num', value: 0 });
      for (let v = 1; v <= 9; v++) { d.push({ color: c, type: 'num', value: v }); d.push({ color: c, type: 'num', value: v }); }
      ['skip', 'reverse', 'draw2'].forEach(tp => { d.push({ color: c, type: tp }); d.push({ color: c, type: tp }); });
    });
    for (let i = 0; i < 4; i++) { d.push({ color: 'wild', type: 'wild' }); d.push({ color: 'wild', type: 'wild4' }); }
    return d;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function cardPoints(c) { return c.type === 'num' ? c.value : (c.type === 'wild' || c.type === 'wild4') ? 50 : 20; }
  function handPoints(h) { return h.reduce((n, c) => n + cardPoints(c), 0); }

  function isWild(c) { return c.type === 'wild' || c.type === 'wild4'; }
  function top() { return S.discard[S.discard.length - 1]; }

  /* legal if Wild, or colour matches active colour, or same number / same symbol */
  function legal(c) {
    if (c.type === 'wild') return true;
    if (c.type === 'wild4') return !S.hands[0].some(x => x.color === S.color); /* enforced for human */
    if (c.color === S.color) return true;
    const tp = top();
    if (c.type === 'num' && tp.type === 'num') return c.value === tp.value;
    if (c.type !== 'num' && c.type === tp.type) return true;
    return false;
  }
  /* same rule but for an AI hand (wild4 legality depends on that hand) */
  function legalFor(c, hand) {
    if (c.type === 'wild') return true;
    if (c.type === 'wild4') return !hand.some(x => x.color === S.color);
    if (c.color === S.color) return true;
    const tp = top();
    if (c.type === 'num' && tp.type === 'num') return c.value === tp.value;
    if (c.type !== 'num' && c.type === tp.type) return true;
    return false;
  }

  function drawFromDeck() {
    if (!S.deck.length) {
      if (S.discard.length <= 1) return null;        /* nothing to reshuffle */
      const keep = S.discard.pop();
      S.deck = shuffle(S.discard.map(c => isWild(c) ? { color: 'wild', type: c.type } : c));
      S.discard = [keep];
      flash(t('deckEmpty'));
    }
    return S.deck.pop();
  }
  function give(pl, n) { const got = []; for (let i = 0; i < n; i++) { const c = drawFromDeck(); if (c) { pl.hand.push(c); got.push(c); } } return got; }

  /* ══ flow ══════════════════════════════════════════════════════ */
  function init(r) { root = r; if (!root) return; injectCSS(); renderMenu(); }

  function renderMenu() {
    const d = diff();
    const dl = { easy: t('diffEasy'), medium: t('diffMedium'), hard: t('diffHard') }[d] || t('diffMedium');
    root.innerHTML = `
      <div class="uno-menu">
        <div class="uno-logo">${logoSVG()}</div>
        <p class="uno-tag">${t('tagline')}</p>
        <p class="uno-rules">${t('rules')}</p>
        <div class="uno-diff-note">${({easy:'🟢',medium:'🟡',hard:'🔴'})[d]} ${dl}</div>
        <button class="uno-btn primary big" id="uno-start">${t('start')}</button>
      </div>`;
    root.querySelector('#uno-start').addEventListener('click', start);
  }

  function start() {
    S = {
      deck: shuffle(buildDeck()), discard: [], color: null,
      hands: [], names: [], turn: 0, dir: 1,
      phase: 'idle', drawnPlayable: null, unoTimer: null, busy: false,
    };
    const names = [t('you'), ...shuffle(CPU_NAMES.slice())];
    S.hands = [[], [], [], []];
    S.names = names;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 7; k++) S.hands[i].push(S.deck.pop());
    /* first discard: re-draw until a plain number to keep the opening clean */
    let first;
    do { first = S.deck.pop(); if (first.type !== 'num') S.deck.unshift(first); } while (first.type !== 'num');
    S.discard = [first];
    S.color = first.color;
    S.turn = 0; S.dir = 1; S.phase = 'play';
    renderTable();
    setHint(t('yourTurn'));
    setMyTurn(true);
  }

  function next(steps) { S.turn = (S.turn + S.dir * (steps || 1) + 4) % 4; }

  /* central play routine for any player */
  async function playCard(pi, card, chosenColor) {
    const hand = S.hands[pi];
    const idx = hand.indexOf(card);
    if (idx === -1) return;
    S.drawnPlayable = null;                 /* a play ends the "freshly drawn" sub-state */
    hand.splice(idx, 1);
    S.discard.push(card);
    S.color = isWild(card) ? chosenColor : card.color;

    await animatePlay(pi, card);
    renderTable();

    /* UNO check */
    if (hand.length === 1) {
      if (pi === 0) armUnoCall();
      else flash(fmt('saidUno', { n: S.names[pi] }));
    }
    /* win check */
    if (hand.length === 0) { endGame(pi); return; }

    /* effects */
    let skip = 0;
    if (card.type === 'reverse') { S.dir *= -1; flash(t('reversed')); await pulseDir(); }
    else if (card.type === 'skip') { const v = (S.turn + S.dir + 4) % 4; flash(fmt('skipped', { n: S.names[v] })); skip = 1; }
    else if (card.type === 'draw2') {
      const v = (S.turn + S.dir + 4) % 4;
      give(S.hands[v], 2); flash(fmt('drawTwo', { n: S.names[v] })); skip = 1;
    }
    else if (card.type === 'wild4') {
      const v = (S.turn + S.dir + 4) % 4;
      give(S.hands[v], 4); flash(fmt('drawFour', { n: S.names[v] })); skip = 1;
    }
    renderTable();
    next(1 + skip);
    if (pi !== 0) await wait(HOLD);         /* hold so the player can read what a CPU just did */
    await advance();
  }

  async function advance() {
    if (S.phase === 'over') return;
    renderTable();
    if (S.turn === 0) { S.phase = 'play'; setHint(t('yourTurn')); setMyTurn(true); enableHuman(); return; }
    /* CPU turn */
    S.phase = 'cpu';
    setMyTurn(false);
    await cpuTurn(S.turn);
  }

  function setMyTurn(on) { root.querySelector('.uno-board')?.classList.toggle('myturn', !!on); }

  /* ══ human interaction ═════════════════════════════════════════ */
  function enableHuman() { S.busy = false; renderTable(); }

  async function humanPlay(card) {
    if (S.busy || S.phase !== 'play' || S.turn !== 0) return;
    if (!legal(card)) { bump(card); return; }
    S.busy = true;
    if (isWild(card)) {
      const col = await pickColor();
      await playCard(0, card, col);
    } else {
      await playCard(0, card);
    }
  }

  async function humanDraw() {
    if (S.busy || S.phase !== 'play' || S.turn !== 0) return;
    S.busy = true;
    const c = drawFromDeck();
    if (!c) { S.busy = false; return; }
    S.hands[0].push(c);
    renderTable();
    await animateDrawTo(0);
    if (legal(c)) {
      /* offer to play the freshly drawn card */
      setHint(fmt('youDrew', { c: cardName(c) }));
      S.drawnPlayable = c;
      renderTable();
      S.busy = false;
      return;
    }
    flash(fmt('youDrew', { c: cardName(c) }));
    next(1);
    await advance();
  }

  async function humanPass() {
    if (S.busy || S.drawnPlayable == null) return;
    S.busy = true; S.drawnPlayable = null;
    next(1);
    await advance();
  }

  /* ══ AI ════════════════════════════════════════════════════════ */
  async function cpuTurn(pi) {
    S.busy = true;
    setHint(fmt('cpuThinking', { n: S.names[pi] }));
    setActive(pi);
    await wait(THINK + Math.random() * 500);

    const hand = S.hands[pi];
    let playable = hand.filter(c => legalFor(c, hand));
    if (!playable.length) {
      const c = drawFromDeck();
      if (c) { hand.push(c); renderTable(); await animateDrawTo(pi); }
      if (c && legalFor(c, hand)) { playable = [c]; }     /* play what we just drew */
      else { flash(fmt('cpuDrew', { n: S.names[pi] })); next(1); await advance(); return; }
    }
    const choice = aiChoose(pi, playable);
    const col = isWild(choice.card) ? choice.color : null;
    flash(fmt('cpuPlayed', { n: S.names[pi], c: cardName(choice.card) }));
    await playCard(pi, choice.card, col);
  }

  function aiChoose(pi, playable) {
    const level = diff();
    const hand = S.hands[pi];
    const leftColor = bestColor(hand);

    if (level === 'easy') {
      const card = playable[Math.floor(Math.random() * playable.length)];
      return { card, color: isWild(card) ? COLORS[Math.floor(Math.random() * 4)] : null };
    }

    /* score each option */
    const nextIdx = (S.turn + S.dir + 4) % 4;
    const nextCount = S.hands[nextIdx].length;
    const leaderLow = Math.min(...S.hands.map((h, i) => i === pi ? 99 : h.length)) <= 2;

    const scored = playable.map(card => {
      let s = 0;
      if (card.type === 'num') s = 5 + card.value;            /* dump high numbers */
      else if (card.type === 'skip') s = 22;
      else if (card.type === 'reverse') s = 18;
      else if (card.type === 'draw2') s = 26;
      else if (card.type === 'wild') s = (level === 'hard') ? 8 : 30;   /* hard hoards wilds */
      else if (card.type === 'wild4') s = (level === 'hard') ? 4 : 28;

      if (level === 'hard') {
        /* punish a low-card opponent harder */
        if ((card.type === 'draw2' || card.type === 'skip') && nextCount <= 2) s += 30;
        if (card.type === 'wild4' && playable.every(p => isWild(p) || p.type === 'wild4')) s += 40; /* only path */
        if (leaderLow && (card.type === 'draw2' || card.type === 'skip' || card.type === 'reverse')) s += 12;
        /* keep colour we are strong in by matching numbers of our best colour */
        if (card.type === 'num' && card.color === leftColor) s += 4;
      }
      return { card, s };
    }).sort((a, b) => b.s - a.s);

    const card = scored[0].card;
    return { card, color: isWild(card) ? leftColor : null };
  }

  function bestColor(hand) {
    const cnt = { red: 0, yellow: 0, green: 0, blue: 0 };
    hand.forEach(c => { if (c.color !== 'wild') cnt[c.color]++; });
    let best = 'red', n = -1;
    COLORS.forEach(c => { if (cnt[c] > n) { n = cnt[c]; best = c; } });
    return best;
  }

  /* ══ UNO call (human) ══════════════════════════════════════════ */
  function armUnoCall() {
    clearTimeout(S.unoTimer);
    S.unoCalled = false;
    showUnoButton(true);
    S.unoTimer = setTimeout(() => {
      if (!S.unoCalled && S.hands[0].length === 1) {
        give(S.hands[0], 2);
        flash(t('caughtUno'));
        showUnoButton(false);
        renderTable();
      }
    }, 3400);
  }
  function callUno() {
    S.unoCalled = true; clearTimeout(S.unoTimer); showUnoButton(false);
    flash(fmt('saidUno', { n: t('you') }));
    burstUno();
  }

  /* ══ end ═══════════════════════════════════════════════════════ */
  function endGame(winner) {
    S.phase = 'over'; clearTimeout(S.unoTimer);
    const won = winner === 0;
    const pts = S.hands.reduce((n, h, i) => i === winner ? n : n + handPoints(h), 0);
    if (typeof GameProgress !== 'undefined') {
      try { GameProgress.record('uno', { won, mode: diff(), score: won ? pts : 0, meta: { lastPoints: pts } }); } catch (e) {}
    }
    root.querySelector('.uno-overlay')?.remove();
    const ov = document.createElement('div');
    ov.className = 'uno-end';
    ov.innerHTML = `
      <div class="uno-end-card ${won ? 'win' : 'lose'}">
        <div class="uno-end-emo">${won ? '🎉' : '😖'}</div>
        <div class="uno-end-title">${won ? t('win') : fmt('lose', { n: S.names[winner] })}</div>
        <div class="uno-end-sub">${won ? t('youWon') : ''}</div>
        <div class="uno-end-pts">${fmt('points', { p: pts })}</div>
        <button class="uno-btn primary big" id="uno-again">${t('playAgain')}</button>
      </div>`;
    root.appendChild(ov);
    if (won && !reduceMotion()) confetti();
    ov.querySelector('#uno-again').addEventListener('click', () => { ov.remove(); start(); });
  }

  /* ══ rendering ═════════════════════════════════════════════════ */
  function renderTable() {
    if (!root) return;
    let board = root.querySelector('.uno-board');
    if (!board) {
      root.innerHTML = `
        <div class="uno-board">
          <button class="uno-newbtn" id="uno-new" title="${t('newGame')}">${t('newGame')}</button>
          <div class="uno-felt">
            <div class="uno-seat top" data-seat="2"></div>
            <div class="uno-seat left" data-seat="1"></div>
            <div class="uno-seat right" data-seat="3"></div>
            <div class="uno-center">
              <div class="uno-pile draw" id="uno-draw" title="${t('drawCard')}">
                <div class="uno-cardback"></div><div class="uno-cardback b2"></div><div class="uno-cardback b3"></div>
              </div>
              <div class="uno-arrows" id="uno-arrows"></div>
              <div class="uno-pile discard" id="uno-discard"></div>
            </div>
            <div class="uno-flash" id="uno-flash"></div>
          </div>
          <div class="uno-hint" id="uno-hint"></div>
          <div class="uno-hand-wrap"><div class="uno-hand" id="uno-hand"></div></div>
          <div class="uno-controls" id="uno-controls"></div>
        </div>`;
      root.querySelector('#uno-new').addEventListener('click', start);
      root.querySelector('#uno-draw').addEventListener('click', humanDraw);
    }
    drawSeats();
    drawDiscard();
    drawArrows();
    drawHand();
    drawControls();
  }

  function drawSeats() {
    for (let i = 1; i <= 3; i++) {
      const seat = root.querySelector(`.uno-seat[data-seat="${i}"]`); if (!seat) continue;
      const n = S.hands[i].length;
      const active = S.turn === i && S.phase !== 'over';
      const fan = Array.from({ length: Math.min(n, 7) }, (_, k) =>
        `<span class="uno-mini" style="--i:${k};--tot:${Math.min(n, 7)}"></span>`).join('');
      seat.className = `uno-seat ${['', 'left', 'top', 'right'][i]}${active ? ' active' : ''}${n === 1 ? ' uno1' : ''}`;
      seat.innerHTML = `
        <div class="uno-avatar">${['', '🧑‍🦰', '🧔', '👩'][i]}</div>
        <div class="uno-seat-info">
          <span class="uno-seat-name">${S.names[i]}</span>
          <span class="uno-seat-count">${n === 1 ? t('oneCard') : fmt('cardsLeft', { n })}</span>
        </div>
        <div class="uno-minifan">${fan}</div>
        ${n === 1 ? '<div class="uno-saiduno">UNO!</div>' : ''}`;
    }
  }

  function drawDiscard() {
    const el = root.querySelector('#uno-discard'); if (!el) return;
    const c = top();
    el.style.setProperty('--glow', GLOW[S.color] || GLOW.wild);
    el.innerHTML = cardHTML(c, false, S.color);
  }

  function drawArrows() {
    const el = root.querySelector('#uno-arrows'); if (!el) return;
    el.className = 'uno-arrows ' + (S.dir === 1 ? 'cw' : 'ccw');
    el.innerHTML = '<span>↻</span>';
  }

  function drawHand() {
    const hand = root.querySelector('#uno-hand'); if (!hand) return;
    const cards = S.hands[0];
    const yourTurn = S.turn === 0 && S.phase === 'play' && !S.busy;
    hand.innerHTML = cards.map((c, i) => {
      const playableNow = yourTurn && (S.drawnPlayable ? c === S.drawnPlayable : legal(c));
      const dim = yourTurn && S.drawnPlayable && c !== S.drawnPlayable;
      const mid = (cards.length - 1) / 2;
      const rot = (i - mid) * Math.min(5, 30 / cards.length);
      const lift = Math.abs(i - mid) * -2;
      return `<div class="uno-handcard${playableNow ? ' playable' : ''}${dim ? ' dim' : ''}"
        data-i="${i}" style="--rot:${rot}deg;--lift:${lift}px;z-index:${i}">${cardHTML(c, true)}</div>`;
    }).join('');
    hand.querySelectorAll('.uno-handcard').forEach(el => {
      el.addEventListener('click', () => humanPlay(cards[+el.dataset.i]));
    });
  }

  function drawControls() {
    const el = root.querySelector('#uno-controls'); if (!el) return;
    const yourTurn = S.turn === 0 && S.phase === 'play' && !S.busy;
    let html = '';
    if (yourTurn && S.drawnPlayable) html += `<button class="uno-btn" id="uno-pass">${t('pass')}</button>`;
    el.innerHTML = html;
    el.querySelector('#uno-pass')?.addEventListener('click', humanPass);
  }

  /* ══ card visuals ══════════════════════════════════════════════ */
  function symbol(c) {
    if (c.type === 'num') return String(c.value);
    if (c.type === 'skip') return '⊘';
    if (c.type === 'reverse') return '⇄';
    if (c.type === 'draw2') return '+2';
    if (c.type === 'wild') return '★';
    if (c.type === 'wild4') return '+4';
    return '';
  }
  function cardName(c) {
    if (isWild(c)) return c.type === 'wild4' ? 'Wild +4' : 'Wild';
    const col = t(c.color);
    return c.type === 'num' ? `${col} ${c.value}` : `${col} ${symbol(c)}`;
  }
  function cardHTML(c, small, forcedColor) {
    const wild = isWild(c);
    const bg = wild ? '' : HEX[c.color];
    const sym = symbol(c);
    const big = c.type === 'num' ? sym : sym;
    const wildFaces = wild
      ? `<div class="uno-wildquad"><span style="background:${HEX.red}"></span><span style="background:${HEX.yellow}"></span><span style="background:${HEX.blue}"></span><span style="background:${HEX.green}"></span></div>`
      : '';
    const ring = wild && forcedColor && forcedColor !== 'wild' ? `box-shadow:inset 0 0 0 4px ${HEX[forcedColor]};` : '';
    return `<div class="uno-card ${wild ? 'wild' : 'c-' + c.color}${small ? ' sm' : ''}" style="${wild ? '' : 'background:' + bg + ';'}${ring}">
      <div class="uno-card-oval"></div>
      ${wildFaces}
      <span class="uno-card-big ${c.type}">${big}</span>
      <span class="uno-card-corner tl">${sym}</span>
      <span class="uno-card-corner br">${sym}</span>
    </div>`;
  }

  /* ══ animations & fx ═══════════════════════════════════════════ */
  function animatePlay(pi, card) {
    return new Promise(res => {
      if (reduceMotion()) { res(); return; }
      const felt = root.querySelector('.uno-felt');
      const discard = root.querySelector('#uno-discard');
      if (!felt || !discard) { res(); return; }
      const fly = document.createElement('div');
      fly.className = 'uno-fly';
      fly.innerHTML = cardHTML(card, false, isWild(card) ? S.color : null);
      const fr = felt.getBoundingClientRect();
      const dr = discard.getBoundingClientRect();
      const from = seatPoint(pi, fr);
      fly.style.left = (from.x - fr.left) + 'px';
      fly.style.top = (from.y - fr.top) + 'px';
      felt.appendChild(fly);
      requestAnimationFrame(() => {
        fly.style.transform = `translate(${(dr.left + dr.width / 2) - from.x}px,${(dr.top + dr.height / 2) - from.y}px) rotate(${(Math.random()*16-8)|0}deg) scale(1)`;
        fly.style.opacity = '1';
      });
      setTimeout(() => { fly.remove(); res(); }, 340);
    });
  }
  function animateDrawTo(pi) {
    return new Promise(res => {
      if (reduceMotion()) { res(); return; }
      const felt = root.querySelector('.uno-felt');
      const drawPile = root.querySelector('#uno-draw');
      if (!felt || !drawPile) { res(); return; }
      const fr = felt.getBoundingClientRect();
      const sr = drawPile.getBoundingClientRect();
      const to = seatPoint(pi, fr);
      const fly = document.createElement('div');
      fly.className = 'uno-fly';
      fly.innerHTML = `<div class="uno-card wild" style="background:#1c2030"><div class="uno-cardback solo"></div></div>`;
      fly.style.left = (sr.left + sr.width / 2 - fr.left) + 'px';
      fly.style.top = (sr.top + sr.height / 2 - fr.top) + 'px';
      felt.appendChild(fly);
      requestAnimationFrame(() => {
        fly.style.transform = `translate(${to.x - (sr.left + sr.width / 2)}px,${to.y - (sr.top + sr.height / 2)}px) scale(.7)`;
        fly.style.opacity = '.2';
      });
      setTimeout(() => { fly.remove(); res(); }, 300);
    });
  }
  function seatPoint(pi, fr) {
    const sel = ['#uno-hand', '.uno-seat.left', '.uno-seat.top', '.uno-seat.right'][pi];
    const el = root.querySelector(sel);
    if (el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 };
  }
  function setActive() { drawSeats(); }
  function pulseDir() {
    return new Promise(res => {
      const a = root.querySelector('#uno-arrows');
      if (!a || reduceMotion()) { res(); return; }
      a.classList.add('flip'); setTimeout(() => { a.classList.remove('flip'); res(); }, 360);
    });
  }
  function flash(msg) {
    const el = root.querySelector('#uno-flash'); if (!el) { return; }
    const b = document.createElement('div'); b.className = 'uno-flash-msg'; b.textContent = msg;
    el.appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.remove(), 300); }, 1900);
  }
  function setHint(msg) { const h = root.querySelector('#uno-hint'); if (h) h.textContent = msg; }
  function bump(card) {
    const i = S.hands[0].indexOf(card);
    const el = root.querySelector(`.uno-handcard[data-i="${i}"]`);
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  }

  function pickColor() {
    return new Promise(res => {
      const ov = document.createElement('div');
      ov.className = 'uno-overlay';
      ov.innerHTML = `
        <div class="uno-colorbox">
          <div class="uno-colorbox-title">${t('wildPick')}</div>
          <div class="uno-colorgrid">
            ${COLORS.map(c => `<button class="uno-colorbtn" data-c="${c}" style="background:${HEX[c]}"><span>${t(c)}</span></button>`).join('')}
          </div>
        </div>`;
      root.querySelector('.uno-board').appendChild(ov);
      ov.querySelectorAll('.uno-colorbtn').forEach(b =>
        b.addEventListener('click', () => { ov.remove(); res(b.dataset.c); }));
    });
  }

  function showUnoButton(on) {
    let b = root.querySelector('#uno-call');
    if (on) {
      if (b) return;
      b = document.createElement('button');
      b.id = 'uno-call'; b.className = 'uno-call'; b.textContent = t('callUno');
      b.addEventListener('click', callUno);
      root.querySelector('.uno-board')?.appendChild(b);
    } else if (b) b.remove();
  }
  function burstUno() {
    const board = root.querySelector('.uno-board'); if (!board || reduceMotion()) return;
    const big = document.createElement('div'); big.className = 'uno-bigword'; big.textContent = 'UNO!';
    board.appendChild(big); setTimeout(() => big.remove(), 900);
  }
  function confetti() {
    const board = root.querySelector('.uno-board'); if (!board) return;
    const wrap = document.createElement('div'); wrap.className = 'uno-confetti';
    const cols = [HEX.red, HEX.yellow, HEX.green, HEX.blue, '#fff'];
    for (let i = 0; i < 60; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.background = cols[i % cols.length];
      s.style.animationDelay = (Math.random() * .5) + 's';
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      wrap.appendChild(s);
    }
    board.appendChild(wrap); setTimeout(() => wrap.remove(), 2600);
  }

  function logoSVG() {
    return `<svg viewBox="0 0 220 120" class="uno-logosvg" aria-label="UNO">
      <g font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="74" text-anchor="middle">
        <text x="112" y="86" fill="#000" stroke="#000" stroke-width="10" transform="rotate(-8 110 60)">UNO</text>
        <text x="110" y="84" fill="#fff" transform="rotate(-8 110 60)">UNO</text>
        <text x="110" y="84" fill="#f2b417" transform="rotate(-8 110 60)" opacity=".0">UNO</text>
      </g>
    </svg>`;
  }

  /* ══ CSS ═══════════════════════════════════════════════════════ */
  function injectCSS() {
    if (document.getElementById('uno-css')) return;
    const s = document.createElement('style'); s.id = 'uno-css';
    s.textContent = `
.uno-menu{max-width:460px;margin:6vh auto;text-align:center;padding:1rem;display:flex;flex-direction:column;align-items:center;gap:.7rem}
.uno-logo{width:200px;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}
.uno-logosvg{width:100%;height:auto}
.uno-tag{font-size:1rem;color:var(--text,#fff);font-weight:700;margin:0}
.uno-rules{font-size:.82rem;color:var(--muted,#9aa);margin:0;max-width:340px}
.uno-diff-note{font-size:.8rem;font-weight:700;color:var(--text2,#ccd);background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);border-radius:999px;padding:.3rem .9rem}
.uno-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:11px;padding:.6rem 1.1rem;font:inherit;font-weight:800;cursor:pointer;transition:all .15s}
.uno-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.6);color:var(--accent,#a98bff);transform:translateY(-1px)}
.uno-btn.primary{background:linear-gradient(135deg,#e4322b,#f2b417);color:#fff;border:none;box-shadow:0 6px 18px rgba(228,50,43,.35)}
.uno-btn.big{font-size:1.05rem;padding:.8rem 1.8rem}

.uno-board{position:relative;max-width:680px;margin:0 auto;padding:6px}
.uno-newbtn{position:absolute;top:2px;right:4px;z-index:6;background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);color:var(--text2,#ccd);border-radius:9px;padding:.35rem .7rem;font:inherit;font-size:.74rem;font-weight:700;cursor:pointer}
.uno-newbtn:hover{color:var(--accent,#a98bff)}
.uno-felt{position:relative;border-radius:20px;padding:14px;min-height:330px;
  background:radial-gradient(ellipse at 50% 42%,#1f6e4b 0%,#155138 55%,#0c3324 100%);
  box-shadow:inset 0 0 60px rgba(0,0,0,.55),inset 0 0 0 6px rgba(255,255,255,.04),0 12px 36px rgba(0,0,0,.45);
  display:grid;grid-template-columns:1fr auto 1fr;grid-template-rows:auto 1fr auto;gap:6px;overflow:hidden}
.uno-felt::after{content:'';position:absolute;inset:0;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.02) 0deg 10deg,transparent 10deg 20deg);opacity:.5;pointer-events:none}

.uno-seat{display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:12px;background:rgba(0,0,0,.28);
  border:1px solid rgba(255,255,255,.08);align-self:start;justify-self:center;max-width:200px;transition:all .25s;z-index:2}
.uno-seat.top{grid-column:2;grid-row:1}
.uno-seat.left{grid-column:1;grid-row:2;justify-self:start;flex-direction:column;align-items:center;text-align:center}
.uno-seat.right{grid-column:3;grid-row:2;justify-self:end;flex-direction:column;align-items:center;text-align:center}
.uno-seat.active{background:rgba(242,180,23,.22);border-color:#f2b417;transform:scale(1.06);animation:uno-seatpulse 1.2s ease-in-out infinite}
@keyframes uno-seatpulse{0%,100%{box-shadow:0 0 14px rgba(242,180,23,.4)}50%{box-shadow:0 0 26px 4px rgba(242,180,23,.7)}}
.uno-seat.active .uno-avatar{animation:uno-think 1s ease-in-out infinite}
@keyframes uno-think{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.uno-seat.uno1{border-color:#e4322b;box-shadow:0 0 16px rgba(228,50,43,.55)}
.uno-avatar{font-size:1.5rem;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
.uno-seat-info{display:flex;flex-direction:column;min-width:0}
.uno-seat-name{font-size:.78rem;font-weight:800;color:#fff;line-height:1.1}
.uno-seat-count{font-size:.66rem;color:#bfe9cf}
.uno-minifan{display:flex;height:20px;align-items:center}
.uno-mini{width:11px;height:17px;border-radius:2px;margin-left:-5px;background:linear-gradient(135deg,#33405e,#1a2236);border:1px solid rgba(255,255,255,.25);
  transform:rotate(calc((var(--i) - (var(--tot) - 1)/2) * 7deg));box-shadow:0 1px 2px rgba(0,0,0,.4)}
.uno-saiduno{position:absolute;font-size:.62rem;font-weight:900;color:#fff;background:#e4322b;padding:1px 6px;border-radius:6px;transform:translateY(-22px) rotate(-6deg);box-shadow:0 2px 6px rgba(0,0,0,.4);animation:uno-pop .4s ease}
@keyframes uno-pop{from{transform:translateY(-22px) scale(.4) rotate(-6deg)}to{transform:translateY(-22px) scale(1) rotate(-6deg)}}

.uno-center{grid-column:2;grid-row:2;display:flex;align-items:center;justify-content:center;gap:14px;position:relative;z-index:2}
.uno-pile{position:relative;width:62px;height:92px}
.uno-pile.draw{cursor:pointer}
.uno-pile.draw:hover{transform:translateY(-3px)}
.uno-pile.draw{transition:transform .15s}
.uno-cardback{position:absolute;inset:0;border-radius:9px;background:
  radial-gradient(ellipse at 50% 50%,#e4322b 0 38%,#0c1018 39%);
  border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.5);overflow:hidden}
.uno-cardback::after{content:'UNO';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  color:#f2b417;font:900 1rem Arial,sans-serif;transform:rotate(-18deg);text-shadow:0 1px 2px #000}
.uno-cardback.b2{transform:translate(3px,3px) rotate(3deg);z-index:-1}
.uno-cardback.b3{transform:translate(6px,6px) rotate(6deg);z-index:-2}
.uno-cardback.solo{position:absolute;inset:0}
.uno-pile.discard{filter:drop-shadow(0 0 14px rgba(var(--glow),.65))}

.uno-arrows{font-size:1.5rem;color:rgba(255,255,255,.85);text-shadow:0 0 8px rgba(255,255,255,.4)}
.uno-arrows.ccw{transform:scaleX(-1)}
.uno-arrows.flip{animation:uno-spin .36s ease}
@keyframes uno-spin{from{transform:rotate(0) scale(1.4)}to{transform:rotate(360deg) scale(1)}}

/* a card */
.uno-card{position:relative;width:62px;height:92px;border-radius:9px;border:3px solid #fff;
  box-shadow:0 4px 10px rgba(0,0,0,.45);overflow:hidden;flex:0 0 auto}
.uno-card.sm{width:60px;height:88px}
.uno-card.wild{background:#15171f}
.uno-card-oval{position:absolute;left:50%;top:50%;width:130%;height:60%;transform:translate(-50%,-50%) rotate(45deg);
  background:rgba(255,255,255,.9);border-radius:50%}
.uno-card.wild .uno-card-oval{display:none}
.uno-wildquad{position:absolute;left:50%;top:50%;width:62%;height:62%;transform:translate(-50%,-50%) rotate(45deg);
  display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;border-radius:50%;overflow:hidden;box-shadow:0 0 0 3px #fff}
.uno-wildquad span{display:block}
.uno-card-big{position:absolute;left:50%;top:50%;transform:translate(-50%,-52%);font:900 2.55rem/1 Arial Black,Arial,sans-serif;
  color:var(--cc,#333);z-index:2;letter-spacing:-.02em;
  text-shadow:0 0 3px rgba(255,255,255,.95),0 0 1px rgba(255,255,255,.95),0 2px 2px rgba(0,0,0,.3);
  -webkit-text-stroke:1.4px rgba(0,0,0,.32);paint-order:stroke fill}
.uno-card.c-red{--cc:#d22019}.uno-card.c-yellow{--cc:#d98f00}.uno-card.c-green{--cc:#188a39}.uno-card.c-blue{--cc:#1466c2}
.uno-card.wild .uno-card-big{color:#fff;text-shadow:none;-webkit-text-stroke:2px rgba(0,0,0,.45)}
.uno-card-big.reverse,.uno-card-big.skip{font-size:2.2rem}
.uno-card-big.draw2,.uno-card-big.wild4{font-size:1.75rem}
.uno-card-corner{position:absolute;font:900 .82rem/1 Arial Black,Arial,sans-serif;color:#fff;
  text-shadow:0 0 2px rgba(0,0,0,.8),0 1px 1px rgba(0,0,0,.7);z-index:3}
.uno-card-corner.tl{top:4px;left:5px}
.uno-card-corner.br{bottom:4px;right:5px;transform:rotate(180deg)}

.uno-hand-wrap{margin-top:10px;overflow:visible}
.uno-hand{display:flex;justify-content:center;align-items:flex-end;min-height:104px;padding:14px 6px 4px;flex-wrap:wrap;gap:2px}
.uno-handcard{transform:rotate(var(--rot)) translateY(var(--lift));transition:transform .16s ease,filter .16s;cursor:default;margin:0 -10px}
.uno-handcard.playable{cursor:pointer}
.uno-handcard.playable:hover{transform:translateY(-18px) scale(1.06);filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));z-index:50!important}
.uno-handcard.playable .uno-card{box-shadow:0 0 0 2px #fff,0 0 14px rgba(255,255,255,.55),0 4px 10px rgba(0,0,0,.5)}
.uno-handcard.dim{filter:grayscale(.6) brightness(.62)}
.uno-handcard.shake{animation:uno-shake .4s}
@keyframes uno-shake{0%,100%{transform:rotate(var(--rot)) translateY(var(--lift))}25%{transform:translateX(-7px) rotate(var(--rot))}75%{transform:translateX(7px) rotate(var(--rot))}}

.uno-hint{width:fit-content;max-width:92%;margin:10px auto 0;padding:.42rem 1.1rem;border-radius:999px;text-align:center;
  font-size:.85rem;font-weight:800;color:var(--text2,#cdd);background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.1);
  transition:all .25s}
.uno-board.myturn .uno-hint{color:#06250f;background:linear-gradient(135deg,#ffd34d,#34d36a);border-color:rgba(255,255,255,.55);
  box-shadow:0 0 0 0 rgba(52,211,106,.55);animation:uno-turnpulse 1.5s ease-in-out infinite;font-size:.92rem}
@keyframes uno-turnpulse{0%,100%{box-shadow:0 0 0 0 rgba(52,211,106,.5)}50%{box-shadow:0 0 22px 4px rgba(52,211,106,.45)}}
.uno-controls{display:flex;justify-content:center;gap:10px;margin-top:8px;min-height:10px}

/* hand reacts to whose turn it is — unmistakable when it's yours */
.uno-hand-wrap{position:relative;border-radius:18px;transition:all .3s}
.uno-board:not(.myturn) .uno-hand-wrap{opacity:.62;filter:saturate(.7)}
.uno-board.myturn .uno-hand-wrap{background:radial-gradient(ellipse at 50% 120%,rgba(52,211,106,.18),transparent 70%);
  box-shadow:0 -2px 30px rgba(52,211,106,.22)}
.uno-board.myturn .uno-hand-wrap::before{content:'';position:absolute;left:50%;top:-2px;transform:translateX(-50%);
  width:62%;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,#34d36a,transparent);animation:uno-scan 1.6s ease-in-out infinite}
@keyframes uno-scan{0%,100%{opacity:.3;width:40%}50%{opacity:1;width:70%}}

.uno-flash{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5}
.uno-flash-msg{background:rgba(8,12,10,.9);color:#fff;font-weight:800;font-size:1.05rem;padding:.6rem 1.3rem;border-radius:14px;
  border:1px solid rgba(255,255,255,.22);box-shadow:0 10px 30px rgba(0,0,0,.55);opacity:0;transform:translateY(12px) scale(.9);transition:all .25s}
.uno-flash-msg.show{opacity:1;transform:translateY(0) scale(1)}

.uno-fly{position:absolute;z-index:60;transition:transform .32s cubic-bezier(.3,1,.4,1),opacity .32s;pointer-events:none}

.uno-overlay{position:absolute;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(2,6,4,.6);backdrop-filter:blur(3px);border-radius:20px}
.uno-colorbox{background:var(--card,#14162a);border:1px solid var(--border,#2a2c44);border-radius:18px;padding:18px 20px;text-align:center;box-shadow:0 16px 50px rgba(0,0,0,.6)}
.uno-colorbox-title{font-weight:800;color:#fff;margin-bottom:12px;font-size:.95rem}
.uno-colorgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.uno-colorbtn{width:104px;height:64px;border:3px solid #fff;border-radius:12px;cursor:pointer;color:#fff;font-weight:900;font-size:.95rem;
  box-shadow:0 4px 12px rgba(0,0,0,.4);transition:transform .12s}
.uno-colorbtn:hover{transform:scale(1.07)}

.uno-call{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);z-index:70;
  background:linear-gradient(135deg,#e4322b,#ff7a18);color:#fff;border:3px solid #fff;border-radius:999px;
  font:900 1.3rem Arial,sans-serif;padding:.5rem 1.6rem;cursor:pointer;box-shadow:0 0 0 0 rgba(228,50,43,.6);
  animation:uno-callpulse 1s infinite}
@keyframes uno-callpulse{0%{box-shadow:0 0 0 0 rgba(228,50,43,.6);transform:translateX(-50%) scale(1)}
  70%{box-shadow:0 0 0 22px rgba(228,50,43,0);transform:translateX(-50%) scale(1.08)}100%{transform:translateX(-50%) scale(1)}}
.uno-bigword{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:90;font:900 4rem Arial,sans-serif;
  color:#fff;-webkit-text-stroke:4px #e4322b;text-shadow:0 6px 20px rgba(0,0,0,.5);animation:uno-bigword .9s ease forwards;pointer-events:none}
@keyframes uno-bigword{0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-12deg)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.1) rotate(-6deg)}100%{opacity:0;transform:translate(-50%,-60%) scale(1) rotate(-6deg)}}

.uno-end{position:absolute;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;background:rgba(2,6,4,.74);backdrop-filter:blur(4px);border-radius:20px}
.uno-end-card{background:var(--card,#14162a);border:1px solid var(--border,#2a2c44);border-radius:20px;padding:26px 30px;text-align:center;display:flex;flex-direction:column;gap:8px;align-items:center;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.uno-end-card.win{border-color:#f2b417;box-shadow:0 0 40px rgba(242,180,23,.4)}
.uno-end-emo{font-size:3.4rem}
.uno-end-title{font-size:1.5rem;font-weight:900;color:#fff}
.uno-end-sub{font-size:.85rem;color:var(--muted,#9aa)}
.uno-end-pts{font-size:1rem;font-weight:800;color:#f2b417}
.uno-confetti{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:96}
.uno-confetti i{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;animation:uno-fall 2.4s linear forwards}
@keyframes uno-fall{to{transform:translateY(420px) rotate(540deg);opacity:.2}}

@media (max-width:560px){
  .uno-card,.uno-card.sm{width:50px;height:74px}
  .uno-card-big{font-size:1.7rem}
  .uno-pile{width:52px;height:78px}
  .uno-handcard{margin:0 -14px}
  .uno-felt{min-height:300px;padding:10px}
  .uno-seat{max-width:140px;padding:4px 6px}
}
@media (prefers-reduced-motion:reduce){.uno-fly,.uno-handcard,.uno-seat{transition:none!important}.uno-call{animation:none}}
`;
    document.head.appendChild(s);
  }

  /* ── achievements ──────────────────────────────────────────────── */
  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('uno', [
      { id: 'uno.win',  name: 'Uno!',          icon: '🃏', desc: 'Vence uma partida de Uno.',  test: c => c.gameId === 'uno' && c.result.won === true },
      { id: 'uno.hard', name: 'Mão Cheia',     icon: '🏆', desc: 'Vence no nível Difícil.',     test: c => c.gameId === 'uno' && c.result.won === true && c.result.mode === 'hard' },
      { id: 'uno.big',  name: 'Despique',      icon: '💥', desc: 'Vence com 60+ pontos na mesa.', test: c => c.gameId === 'uno' && c.result.won === true && (c.result.score || 0) >= 60 },
    ]);
  }

  /* re-render menu on language change while idle */
  if (_has) {
    GameData.load('uno').then(d => { if (t.use) t.use(d.i18n); if (root && (!S || S.phase === 'idle')) renderMenu(); });
    document.addEventListener('langchange', () => {
      GameData.load('uno').then(d => { if (t.use) t.use(d.i18n); if (root && (!S || S.phase === 'idle' || S.phase === 'over')) renderMenu(); });
    });
  }

  return { init };
})();
