/* ══════════════════════════════════════════════════════════════════
   BombGame — "Desarmar a Bomba", reimagined as a tense defusal device.
   A real bomb chassis (LED countdown, serial number, strike lights, a
   blinking status LED and a sound toggle) houses a sequence of
   interactive modules you must disarm before the clock hits zero:

     • Wires   — deductive cut rules (count / colour / serial parity).
     • Button  — tap or press-and-hold, releasing on the right digit.
     • Simon   — watch the colour flashes and repeat them.
     • Code    — memorise a code on the LED, key it back in.
     • Maths   — solve a quick sum on the keypad.

   Tension: ticking accelerates and rises in pitch as time drains, a red
   "heartbeat" vignette pulses faster near the end, mistakes cost a
   strike + time and shake the whole device. Run out of time OR out of
   strikes → KABOOM. Fully offline; self-contained CSS + WebAudio.
══════════════════════════════════════════════════════════════════ */
const BombGame = (function () {
  'use strict';

  let container, S;

  const DIFFS = {
    easy:    { label: 'easy',    emoji: '🟢', time: 200, strikes: 3, wires: 3, simon: 3, code: 3,
               modules: ['wires', 'simon', 'button', 'code'] },
    medium:  { label: 'medium',  emoji: '🟡', time: 170, strikes: 2, wires: 4, simon: 4, code: 4,
               modules: ['wires', 'button', 'simon', 'maths', 'code'] },
    hard:    { label: 'hard',    emoji: '🟠', time: 150, strikes: 1, wires: 5, simon: 5, code: 5,
               modules: ['wires', 'simon', 'button', 'code', 'maths', 'wires'] },
    extreme: { label: 'extreme', emoji: '🔴', time: 120, strikes: 0, wires: 6, simon: 6, code: 6,
               modules: ['wires', 'button', 'simon', 'maths', 'code', 'wires', 'simon'] },
  };
  const STRIKE_PENALTY = 12;   /* seconds lost per mistake */

  /* ── i18n (offline fallback; games/bomb/i18n.json layers on top) ── */
  const FB_I18N = {
    pt: {
      title: '💣 Desarmar a Bomba', tagline: 'Mantém a calma. Corta certo. Não rebentes.',
      chooseDiff: 'Escolhe o nível de dificuldade', start: '▶ Começar',
      easy: 'Fácil', medium: 'Médio', hard: 'Difícil', extreme: 'Extremo',
      modules: 'módulos', strikesWord: 'erros', noStrikes: 'sem margem',
      hud_time: 'TEMPO', hud_serial: 'SÉRIE', hud_strikes: 'ERROS', module: 'Módulo',
      mod_wires: 'Fios', mod_button: 'Botão', mod_simon: 'Simon', mod_code: 'Código', mod_maths: 'Cálculo',
      c_red: 'vermelho', c_blue: 'azul', c_green: 'verde', c_yellow: 'amarelo', c_white: 'branco', c_black: 'preto',
      wires_cut: 'Cortar fios — segue a regra:',
      wr_single: 'Se houver exatamente um fio {color}, corta esse. Caso contrário, corta o {n}º fio.',
      wr_last: 'Corta o último fio {color} a contar de cima.',
      wr_count: 'Se houver mais de {k} fios, corta o último {color}. Senão, corta o primeiro {color}.',
      wr_serial: 'Se o último dígito da série for ímpar, corta o primeiro fio {color}. Senão, corta o {n}º fio.',
      btn_press: 'PRESSIONAR', btn_hold: 'MANTER', btn_abort: 'ABORTAR', btn_detonate: 'DETONAR',
      btn_rule_red: 'Se o botão for vermelho, mantém-no premido. Caso contrário, toca e larga já.',
      btn_rule_abort: 'Se o botão disser ABORTAR, toca e larga já. Caso contrário, mantém premido.',
      btn_rule_hold: 'Mantém o botão premido e larga no momento certo.',
      btn_holding: 'Mantém premido…  solta quando o TEMPO mostrar um {d}.',
      btn_tapNow: 'Toca e larga rapidamente.', btn_tooSoon: 'Largaste cedo de mais!', btn_tooLong: 'Seguraste tempo de mais!',
      sim_watch: 'Observa a sequência…', sim_repeat: 'Repete a sequência  ({k}/{n})',
      code_memo: 'Memoriza o código…  ({s}s)', code_enter: 'Introduz o código de desativação.',
      maths_solve: 'Resolve e introduz o resultado.',
      fb_moduleDone: 'MÓDULO OK', fb_strike: 'ERRO', defusing: 'A desarmar…',
      defused: 'BOMBA DESARMADA', timeSpared: 'Sobraram {m} — trabalho de profissional!',
      kaboom: 'KABOOM!', exploded: 'A bomba explodiu.', strikeOut: 'Demasiados erros — boom!',
      level: 'Nível', playAgain: '▶ Jogar de novo', tryAgain: '↺ Tentar de novo',
      ok: 'OK', clr: '⌫', sound: 'Som',
    },
    en: {
      title: '💣 Defuse the Bomb', tagline: 'Stay calm. Cut right. Don\'t blow up.',
      chooseDiff: 'Choose the difficulty', start: '▶ Start',
      easy: 'Easy', medium: 'Medium', hard: 'Hard', extreme: 'Extreme',
      modules: 'modules', strikesWord: 'strikes', noStrikes: 'no margin',
      hud_time: 'TIME', hud_serial: 'SERIAL', hud_strikes: 'STRIKES', module: 'Module',
      mod_wires: 'Wires', mod_button: 'Button', mod_simon: 'Simon', mod_code: 'Code', mod_maths: 'Maths',
      c_red: 'red', c_blue: 'blue', c_green: 'green', c_yellow: 'yellow', c_white: 'white', c_black: 'black',
      wires_cut: 'Cut the wires — follow the rule:',
      wr_single: 'If there is exactly one {color} wire, cut it. Otherwise cut the {n}th wire.',
      wr_last: 'Cut the last {color} wire from the top.',
      wr_count: 'If there are more than {k} wires, cut the last {color}. Otherwise cut the first {color}.',
      wr_serial: 'If the last serial digit is odd, cut the first {color} wire. Otherwise cut the {n}th wire.',
      btn_press: 'PRESS', btn_hold: 'HOLD', btn_abort: 'ABORT', btn_detonate: 'DETONATE',
      btn_rule_red: 'If the button is red, hold it down. Otherwise tap and release now.',
      btn_rule_abort: 'If the button says ABORT, tap and release now. Otherwise hold it down.',
      btn_rule_hold: 'Hold the button down and release at the right moment.',
      btn_holding: 'Hold it…  release when the TIME shows a {d}.',
      btn_tapNow: 'Tap and release quickly.', btn_tooSoon: 'Released too soon!', btn_tooLong: 'Held too long!',
      sim_watch: 'Watch the sequence…', sim_repeat: 'Repeat the sequence  ({k}/{n})',
      code_memo: 'Memorise the code…  ({s}s)', code_enter: 'Enter the disarm code.',
      maths_solve: 'Solve it and enter the result.',
      fb_moduleDone: 'MODULE OK', fb_strike: 'STRIKE', defusing: 'Disarming…',
      defused: 'BOMB DEFUSED', timeSpared: '{m} to spare — true professional!',
      kaboom: 'KABOOM!', exploded: 'The bomb exploded.', strikeOut: 'Too many strikes — boom!',
      level: 'Level', playAgain: '▶ Play again', tryAgain: '↺ Try again',
      ok: 'OK', clr: '⌫', sound: 'Sound',
    },
  };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  const fmt = (k, o) => { let s = t(k); for (const x in (o || {})) s = String(s).replace('{' + x + '}', o[x]); return s; };

  /* ── audio (local tones, respect GameAudio mute) ───────────────── */
  let _ac = null;
  function ac() { try { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); if (_ac.state === 'suspended') _ac.resume(); } catch (e) { _ac = null; } return _ac; }
  function muted() { return typeof GameAudio !== 'undefined' && GameAudio.muted; }
  function tone(freq, type, dur, vol) {
    if (muted()) return;
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(vol || 0.2, c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  }
  const sfx = {
    tick: () => tone(S && S.timeLeft <= 10 ? 1500 : 950, 'square', 0.04, 0.10),
    tock: () => tone(700, 'square', 0.05, 0.08),
    good: () => { tone(660, 'sine', 0.12, 0.25); setTimeout(() => tone(880, 'sine', 0.16, 0.25), 90); },
    bad:  () => { tone(160, 'sawtooth', 0.28, 0.3); setTimeout(() => tone(120, 'sawtooth', 0.3, 0.25), 90); },
    cut:  () => tone(300, 'square', 0.06, 0.18),
    boom: () => { if (typeof GameAudio !== 'undefined') GameAudio.explosion(); tone(70, 'sawtooth', 0.5, 0.35); },
  };

  /* ── lifecycle ─────────────────────────────────────────────────── */
  function init(cont) {
    container = cont;
    injectCSS();
    renderMenu();
    if (_has) {
      const apply = () => GameData.load('bomb').then(d => {
        if (t.use) t.use(d.i18n);
        if (container && (!S || S.state === 'menu' || S.state === 'won' || S.state === 'lost')) renderMenu();
      });
      apply();
      if (!init._wired) { init._wired = true; document.addEventListener('langchange', apply); }
    }
  }

  function clearTimers() { if (S) { clearInterval(S.timer); (S.modTimers || []).forEach(clearTimeout); S.modTimers = []; } }
  function later(fn, ms) { const id = setTimeout(fn, ms); S.modTimers.push(id); return id; }

  /* ── menu ──────────────────────────────────────────────────────── */
  function renderMenu() {
    S = { state: 'menu', modTimers: [] };
    container.innerHTML = `
      <div class="bmb-wrap">
        <div class="bmb-menu">
          <div class="bmb-menu-icon">💣</div>
          <h2 class="bmb-menu-title">${t('title').replace('💣 ', '')}</h2>
          <p class="bmb-menu-tag">${t('tagline')}</p>
          <p class="bmb-menu-sub">${t('chooseDiff')}</p>
          <div class="bmb-diff-grid">
            ${Object.entries(DIFFS).map(([k, d]) => `
              <button class="bmb-diff-btn d-${k}" data-diff="${k}">
                <span class="bmb-diff-emoji">${d.emoji}</span>
                <span class="bmb-diff-label">${t(k)}</span>
                <span class="bmb-diff-info">${d.modules.length} ${t('modules')} · ${d.time}s</span>
                <span class="bmb-diff-info2">${d.strikes > 0 ? d.strikes + ' ' + t('strikesWord') : t('noStrikes')}</span>
              </button>`).join('')}
          </div>
        </div>
      </div>`;
    container.querySelectorAll('.bmb-diff-btn').forEach(b => b.addEventListener('click', () => startGame(b.dataset.diff)));
  }

  /* ── game start ────────────────────────────────────────────────── */
  function randSerial() {
    const L = 'ABCDEFGHJKLMNPRSTUVWXZ', D = '0123456789';
    const r = s => s[Math.floor(Math.random() * s.length)];
    return r(L) + r(D) + r(L) + r(D);
  }

  function startGame(key) {
    const diff = DIFFS[key] || DIFFS.medium;
    S = {
      state: 'running', key: DIFFS[key] ? key : 'medium', diff,
      timeLeft: diff.time, modules: diff.modules.slice(), modIdx: 0,
      strikes: 0, maxStrikes: diff.strikes, serial: randSerial(),
      timer: null, modTimers: [], busy: false,
    };
    renderDevice();
    S.timer = setInterval(tick, 1000);
    updateTimer();
    showModule(0);
  }

  function tick() {
    S.timeLeft--;
    updateTimer();
    if (S.timeLeft <= 0) { S.timeLeft = 0; updateTimer(); explode('exploded'); return; }
    if (S.timeLeft <= 10) { sfx.tick(); } else { (S.timeLeft % 2 ? sfx.tock : sfx.tick)(); }
  }

  function updateTimer() {
    const el = container.querySelector('#bmb-time'); if (!el) return;
    const m = Math.floor(S.timeLeft / 60), s = S.timeLeft % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const dev = container.querySelector('.bmb-device');
    if (dev) {
      dev.classList.toggle('warn', S.timeLeft <= 30);
      dev.classList.toggle('crit', S.timeLeft <= 10);
    }
  }

  /* ── device chassis ────────────────────────────────────────────── */
  function renderDevice() {
    container.innerHTML = `
      <div class="bmb-wrap">
        <div class="bmb-device" id="bmb-device">
          <div class="bmb-heartbeat"></div>
          <div class="bmb-topbar">
            <div class="bmb-led-screen">
              <span class="bmb-led-lbl">${t('hud_time')}</span>
              <span class="bmb-time" id="bmb-time">--:--</span>
            </div>
            <div class="bmb-status"><span class="bmb-status-dot"></span></div>
            <button class="bmb-sound" id="bmb-sound" title="${t('sound')}">${muted() ? '🔇' : '🔊'}</button>
          </div>
          <div class="bmb-meta">
            <span class="bmb-serial">${t('hud_serial')} <b>${S.serial}</b></span>
            <span class="bmb-strikes" id="bmb-strikes">${strikeDots()}</span>
          </div>
          <div class="bmb-progress" id="bmb-progress"></div>
          <div class="bmb-module" id="bmb-module"></div>
          <div class="bmb-hint" id="bmb-hint"></div>
        </div>
      </div>`;
    const snd = container.querySelector('#bmb-sound');
    snd.addEventListener('click', () => {
      if (typeof GameAudio !== 'undefined') GameAudio.setMuted(!GameAudio.muted);
      snd.textContent = muted() ? '🔇' : '🔊';
    });
    updateProgress();
  }

  function strikeDots() {
    const max = S.maxStrikes;
    if (max <= 0) return `<span class="bmb-strike-x ${S.strikes > 0 ? 'lit' : ''}">✖</span>`;
    let out = '';
    for (let i = 0; i < max + 1; i++) out += `<span class="bmb-strike-x ${i < S.strikes ? 'lit' : ''}">✖</span>`;
    return out;
  }
  function updateStrikes() { const el = container.querySelector('#bmb-strikes'); if (el) el.innerHTML = strikeDots(); }

  function updateProgress() {
    const el = container.querySelector('#bmb-progress'); if (!el) return;
    el.innerHTML = S.modules.map((m, i) =>
      `<span class="bmb-dot ${i < S.modIdx ? 'done' : i === S.modIdx ? 'active' : ''}">${i < S.modIdx ? '✓' : ''}</span>`
    ).join('');
  }

  function setHint(html) { const h = container.querySelector('#bmb-hint'); if (h) h.innerHTML = html; }

  /* ── strike / shake / flow ─────────────────────────────────────── */
  function shake() {
    const d = container.querySelector('.bmb-device'); if (!d) return;
    d.classList.remove('bmb-shake'); void d.offsetWidth; d.classList.add('bmb-shake');
  }
  function flashFX(kind) {
    const d = container.querySelector('.bmb-device'); if (!d) return;
    const f = document.createElement('div'); f.className = 'bmb-flash ' + kind; d.appendChild(f);
    setTimeout(() => f.remove(), 500);
  }

  function strike(reasonKey) {
    if (S.state !== 'running') return;
    sfx.bad(); shake(); flashFX('red');
    S.strikes++;
    S.timeLeft = Math.max(1, S.timeLeft - STRIKE_PENALTY);
    updateTimer(); updateStrikes();
    setHint(`<span class="bmb-fb strike">${t('fb_strike')} · −${STRIKE_PENALTY}s${reasonKey ? ' · ' + t(reasonKey) : ''}</span>`);
    if (S.strikes > S.maxStrikes) { explode('strikeOut'); }
  }

  function solveModule() {
    if (S.state !== 'running') return;
    sfx.good(); flashFX('green');
    setHint(`<span class="bmb-fb ok">✔ ${t('fb_moduleDone')}</span>`);
    S.modIdx++;
    updateProgress();
    if (S.modIdx >= S.modules.length) { later(win, 500); return; }
    later(() => showModule(S.modIdx), 650);
  }

  function showModule(i) {
    clearTimersExceptMain();
    S.busy = false;
    const name = S.modules[i];
    updateProgress();
    if (name === 'wires') renderWires();
    else if (name === 'button') renderButton();
    else if (name === 'simon') renderSimon();
    else if (name === 'code') renderCode();
    else if (name === 'maths') renderMaths();
  }
  function clearTimersExceptMain() { (S.modTimers || []).forEach(clearTimeout); S.modTimers = []; }

  function moduleHead(name) {
    return `<div class="bmb-mod-head"><span class="bmb-mod-tag">${t('module')} ${S.modIdx + 1}/${S.modules.length}</span>
      <span class="bmb-mod-name">${t('mod_' + name)}</span></div>`;
  }

  /* ════ MODULE: WIRES ═══════════════════════════════════════════ */
  const WIRES = {
    red: '#e23b32', blue: '#2f7ff0', green: '#27ae53', yellow: '#f1c40f', white: '#e8edf2', black: '#2b3340',
  };
  function renderWires() {
    const m = container.querySelector('#bmb-module'); if (!m) return;
    const n = S.diff.wires;
    const cols = Object.keys(WIRES);
    const wires = Array.from({ length: n }, () => cols[Math.floor(Math.random() * cols.length)]);
    const rule = chooseWireRule(wires);

    m.innerHTML = `
      ${moduleHead('wires')}
      <div class="bmb-wire-rule">📋 ${rule.clue}</div>
      <div class="bmb-wires">
        ${wires.map((c, i) => `
          <button class="bmb-wire" data-i="${i}" aria-label="wire ${i + 1}">
            <span class="bmb-wire-num">${i + 1}</span>
            <span class="bmb-wire-line" style="--wc:${WIRES[c]}"></span>
            <span class="bmb-wire-screw"></span>
          </button>`).join('')}
      </div>`;
    setHint(t('wires_cut'));
    m.querySelectorAll('.bmb-wire').forEach(btn => btn.addEventListener('click', () => {
      if (S.busy || btn.classList.contains('cut')) return;
      sfx.cut();
      btn.classList.add('cut');
      const i = +btn.dataset.i;
      if (i === rule.answer) { S.busy = true; solveModule(); }
      else strike();
    }));
  }
  function chooseWireRule(wires) {
    const present = [...new Set(wires)];
    const c = present[Math.floor(Math.random() * present.length)];
    const cn = t('c_' + c);
    const first = wires.indexOf(c), last = wires.lastIndexOf(c), count = wires.filter(x => x === c).length;
    const n = Math.floor(Math.random() * wires.length) + 1;
    const lastDigit = +S.serial.replace(/\D/g, '').slice(-1) || 0;
    const rules = [
      () => ({ clue: fmt('wr_single', { color: cn, n }), answer: count === 1 ? first : n - 1 }),
      () => ({ clue: fmt('wr_last', { color: cn }), answer: last }),
      () => ({ clue: fmt('wr_count', { color: cn, k: 3 }), answer: wires.length > 3 ? last : first }),
      () => ({ clue: fmt('wr_serial', { color: cn, n }), answer: (lastDigit % 2 === 1) ? first : n - 1 }),
    ];
    return rules[Math.floor(Math.random() * rules.length)]();
  }

  /* ════ MODULE: BUTTON (tap / hold) ═════════════════════════════ */
  function renderButton() {
    const m = container.querySelector('#bmb-module'); if (!m) return;
    const colors = ['red', 'blue', 'yellow', 'white'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const words = ['btn_press', 'btn_hold', 'btn_abort', 'btn_detonate'];
    const wordKey = words[Math.floor(Math.random() * words.length)];

    const ruleType = Math.floor(Math.random() * 3);
    let expectHold, ruleText;
    if (ruleType === 0) { expectHold = (color === 'red'); ruleText = t('btn_rule_red'); }
    else if (ruleType === 1) { expectHold = (wordKey !== 'btn_abort'); ruleText = t('btn_rule_abort'); }
    else { expectHold = true; ruleText = t('btn_rule_hold'); }

    const releaseDigit = Math.floor(Math.random() * 6) + 1;   /* for hold: release when a TIME digit == this */

    m.innerHTML = `
      ${moduleHead('button')}
      <div class="bmb-wire-rule">📋 ${ruleText}</div>
      <div class="bmb-btn-stage">
        <button class="bmb-bigbtn c-${color}" id="bmb-bigbtn">${t(wordKey)}</button>
        <div class="bmb-btn-strip" id="bmb-strip"></div>
      </div>`;
    setHint(expectHold ? '' : t('btn_tapNow'));

    const btn = m.querySelector('#bmb-bigbtn');
    const strip = m.querySelector('#bmb-strip');
    let downAt = 0, held = false;

    const onDown = e => {
      if (S.busy) return; e.preventDefault();
      downAt = performance.now(); held = true;
      btn.classList.add('pressed');
      if (expectHold) {
        later(() => {
          if (!held) return;
          strip.classList.add('on');
          setHint(fmt('btn_holding', { d: releaseDigit }));
        }, 350);
      }
    };
    const onUp = () => {
      if (S.busy || !held) return; held = false;
      btn.classList.remove('pressed'); strip.classList.remove('on');
      const dur = performance.now() - downAt;
      if (!expectHold) {
        if (dur < 500) { S.busy = true; solveModule(); }
        else strike('btn_tooLong');
      } else {
        if (dur < 600) { strike('btn_tooSoon'); return; }
        const digits = String(Math.floor(S.timeLeft / 60)).padStart(2, '0') + String(S.timeLeft % 60).padStart(2, '0');
        if (digits.includes(String(releaseDigit))) { S.busy = true; solveModule(); }
        else strike();
      }
    };
    btn.addEventListener('pointerdown', onDown);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointerleave', () => { if (held) onUp(); });
  }

  /* ════ MODULE: SIMON ═══════════════════════════════════════════ */
  const SIMON = [
    { c: 'red', hex: '#e23b32', f: 392 }, { c: 'blue', hex: '#2f7ff0', f: 523 },
    { c: 'green', hex: '#27ae53', f: 659 }, { c: 'yellow', hex: '#f1c40f', f: 784 },
  ];
  function renderSimon() {
    const m = container.querySelector('#bmb-module'); if (!m) return;
    const len = S.diff.simon;
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    let step = 0, accepting = false;

    m.innerHTML = `
      ${moduleHead('simon')}
      <div class="bmb-simon">
        ${SIMON.map((p, i) => `<button class="bmb-simon-pad" data-i="${i}" style="--sc:${p.hex}"></button>`).join('')}
        <div class="bmb-simon-core" id="bmb-simon-core"></div>
      </div>`;
    const pads = [...m.querySelectorAll('.bmb-simon-pad')];

    function flash(i, ms) {
      const pad = pads[i]; if (!pad) return;
      pad.classList.add('lit'); tone(SIMON[i].f, 'sine', 0.18, 0.25);
      later(() => pad.classList.remove('lit'), ms);
    }
    function playback() {
      accepting = false; setHint(t('sim_watch'));
      seq.forEach((i, k) => later(() => {
        flash(i, 320);
        if (k === seq.length - 1) later(() => { accepting = true; step = 0; setHint(fmt('sim_repeat', { k: 0, n: len })); }, 460);
      }, 500 + k * 560));
    }
    pads.forEach(pad => pad.addEventListener('click', () => {
      if (S.busy || !accepting) return;
      const i = +pad.dataset.i;
      flash(i, 200);
      if (i === seq[step]) {
        step++;
        setHint(fmt('sim_repeat', { k: step, n: len }));
        if (step === seq.length) { accepting = false; S.busy = true; solveModule(); }
      } else { accepting = false; strike(); later(playback, 600); }
    }));
    later(playback, 350);
  }

  /* ════ keypad (shared by code + maths) ═════════════════════════ */
  function keypadHTML(len) {
    return `
      <div class="bmb-led-input"><span id="bmb-input" data-len="${len}">${'·'.repeat(len)}</span></div>
      <div class="bmb-keypad">
        ${[1,2,3,4,5,6,7,8,9].map(d => `<button class="bmb-key" data-k="${d}">${d}</button>`).join('')}
        <button class="bmb-key wide" data-k="clr">${t('clr')}</button>
        <button class="bmb-key" data-k="0">0</button>
        <button class="bmb-key wide go" data-k="ok">${t('ok')}</button>
      </div>`;
  }
  function wireKeypad(m, maxLen, onSubmit) {
    let val = '';
    const disp = m.querySelector('#bmb-input');
    const paint = () => { disp.textContent = (val + '·'.repeat(maxLen)).slice(0, maxLen); };
    m.querySelectorAll('.bmb-key').forEach(b => b.addEventListener('click', () => {
      if (S.busy) return;
      const k = b.dataset.k;
      if (k === 'clr') { val = val.slice(0, -1); }
      else if (k === 'ok') { onSubmit(val); return; }
      else if (val.length < maxLen) { val += k; tone(800, 'square', 0.03, 0.08); }
      paint();
    }));
    paint();
  }

  /* ════ MODULE: CODE (memorise) ═════════════════════════════════ */
  function renderCode() {
    const m = container.querySelector('#bmb-module'); if (!m) return;
    const len = S.diff.code, showFor = Math.max(2, 7 - len);
    const code = Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
    m.innerHTML = `
      ${moduleHead('code')}
      <div class="bmb-code-show" id="bmb-code-show">${code}</div>
      <div class="bmb-code-input" id="bmb-code-input" style="display:none">${keypadHTML(len)}</div>`;
    let cd = showFor;
    setHint(fmt('code_memo', { s: cd }));
    const cdInt = setInterval(() => {
      cd--; setHint(fmt('code_memo', { s: Math.max(0, cd) })); tone(500, 'sine', 0.04, 0.1);
      if (cd <= 0) {
        clearInterval(cdInt);
        const show = m.querySelector('#bmb-code-show'); if (show) { show.textContent = '·'.repeat(len); show.classList.add('hidden'); }
        const inp = m.querySelector('#bmb-code-input'); if (inp) inp.style.display = '';
        setHint(t('code_enter'));
        wireKeypad(m, len, val => { if (val === code) { S.busy = true; solveModule(); } else strike(); });
      }
    }, 1000);
    S.modTimers.push(cdInt);
  }

  /* ════ MODULE: MATHS ═══════════════════════════════════════════ */
  function renderMaths() {
    const m = container.querySelector('#bmb-module'); if (!m) return;
    let q, a;
    if (S.key === 'extreme' || S.key === 'hard') {
      const x = Math.floor(Math.random() * 11) + 4, y = Math.floor(Math.random() * 8) + 2, z = Math.floor(Math.random() * 9) + 1;
      a = x * y - z; q = `${x} × ${y} − ${z}`;
    } else {
      const x = Math.floor(Math.random() * 40) + 12, y = Math.floor(Math.random() * 18) + 5, plus = Math.random() > 0.4;
      a = plus ? x + y : x - y; q = `${x} ${plus ? '+' : '−'} ${y}`;
    }
    const ans = String(a), len = ans.length;
    m.innerHTML = `
      ${moduleHead('maths')}
      <div class="bmb-maths-q">${q} =</div>
      <div class="bmb-code-input">${keypadHTML(Math.max(2, len))}</div>`;
    setHint(t('maths_solve'));
    wireKeypad(m, Math.max(2, len), val => { if (+val === a) { S.busy = true; solveModule(); } else strike(); });
  }

  /* ── win / lose ────────────────────────────────────────────────── */
  function fmtTime(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

  function win() {
    if (S.state !== 'running') return;
    S.state = 'won'; clearTimers();
    if (typeof GameProgress !== 'undefined') {
      try { GameProgress.record('bomb', { won: true, score: S.timeLeft, mode: S.key }); } catch (e) {}
    }
    const dev = container.querySelector('.bmb-device');
    if (dev) dev.classList.add('defused');
    if (typeof GameAudio !== 'undefined') GameAudio.levelUp();
    container.querySelector('#bmb-module').innerHTML = `
      <div class="bmb-end win">
        <div class="bmb-end-emo">✅</div>
        <div class="bmb-end-title ok">${t('defused')}</div>
        <div class="bmb-end-sub">${fmt('timeSpared', { m: fmtTime(S.timeLeft) })}</div>
        <div class="bmb-end-lvl">${t('level')}: ${t(S.key)} ${S.diff.emoji}</div>
        <button class="bmb-end-btn" id="bmb-again">${t('playAgain')}</button>
      </div>`;
    setHint('');
    container.querySelector('#bmb-again').addEventListener('click', renderMenu);
  }

  function explode(reasonKey) {
    if (S.state !== 'running') return;
    S.state = 'lost'; clearTimers();
    if (typeof GameProgress !== 'undefined') {
      try { GameProgress.record('bomb', { won: false, mode: S.key }); } catch (e) {}
    }
    sfx.boom(); shake(); flashFX('boom');
    const dev = container.querySelector('.bmb-device'); if (dev) dev.classList.add('exploded');
    setTimeout(() => {
      const m = container.querySelector('#bmb-module');
      if (m) m.innerHTML = `
        <div class="bmb-end lose">
          <div class="bmb-end-emo">💥</div>
          <div class="bmb-end-title bad">${t('kaboom')}</div>
          <div class="bmb-end-sub">${t(reasonKey || 'exploded')}</div>
          <button class="bmb-end-btn" id="bmb-again">${t('tryAgain')}</button>
        </div>`;
      setHint('');
      container.querySelector('#bmb-again')?.addEventListener('click', renderMenu);
    }, 420);
  }

  /* ── achievements ──────────────────────────────────────────────── */
  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('bomb', [
      { id: 'bomb.win', name: 'Esquadrão Anti-Bomba', icon: '💣', desc: 'Desarma uma bomba.',        test: c => c.gameId === 'bomb' && c.result.won === true },
      { id: 'bomb.ext', name: 'Nervos de Aço',        icon: '🧨', desc: 'Desarma no nível Extremo.', test: c => c.gameId === 'bomb' && c.result.won === true && c.result.mode === 'extreme' },
      { id: 'bomb.fast', name: 'Mão Firme',           icon: '⏱️', desc: 'Desarma com 60s+ de sobra.', test: c => c.gameId === 'bomb' && c.result.won === true && (c.result.score || 0) >= 60 },
    ]);
  }

  /* ── CSS ───────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('bmb-css')) return;
    const s = document.createElement('style'); s.id = 'bmb-css';
    s.textContent = `
.bmb-wrap{display:flex;justify-content:center;padding:8px 0}
.bmb-menu{max-width:440px;text-align:center;padding:1rem}
.bmb-menu-icon{font-size:3rem;animation:bmb-bob 2s ease-in-out infinite}
@keyframes bmb-bob{50%{transform:translateY(-6px)}}
.bmb-menu-title{font-family:var(--font-head,inherit);font-size:1.5rem;font-weight:900;margin:.3rem 0 .1rem}
.bmb-menu-tag{color:var(--accent,#a98bff);font-weight:700;font-size:.9rem;margin:.1rem 0 1rem}
.bmb-menu-sub{color:var(--muted,#9aa);font-size:.85rem;margin-bottom:1rem}
.bmb-diff-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
.bmb-diff-btn{background:var(--card2,#1b1d33);border:1px solid var(--border,#2a2c44);border-radius:14px;padding:.85rem .5rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:.2rem;font-family:inherit;transition:all .15s}
.bmb-diff-btn:hover{border-color:rgba(var(--accent-rgb,124,92,255),.5);transform:translateY(-2px);background:var(--accent-soft,rgba(124,92,255,.08))}
.bmb-diff-emoji{font-size:1.5rem}
.bmb-diff-label{font-size:.92rem;font-weight:800;color:var(--text,#fff)}
.bmb-diff-info{font-size:.66rem;color:var(--muted,#9aa)}
.bmb-diff-info2{font-size:.62rem;color:var(--text2,#bcd);opacity:.8}

.bmb-device{position:relative;width:min(95vw,440px);border-radius:20px;padding:16px 16px 18px;
  background:linear-gradient(165deg,#2a2f38,#171a20 60%,#0f1116);
  box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.07),inset 0 0 0 2px rgba(0,0,0,.4);
  border:1px solid #3a4150;overflow:hidden}
.bmb-device::before{content:'';position:absolute;inset:0;border-radius:20px;pointer-events:none;
  background:repeating-linear-gradient(135deg,rgba(255,255,255,.015) 0 6px,transparent 6px 12px)}
.bmb-device.warn{box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 30px rgba(240,90,60,.25),inset 0 0 0 2px rgba(0,0,0,.4)}
.bmb-device.crit{animation:bmb-critpulse .6s ease-in-out infinite}
@keyframes bmb-critpulse{50%{box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 46px rgba(240,60,40,.6),inset 0 0 0 2px rgba(0,0,0,.4)}}
.bmb-heartbeat{position:absolute;inset:0;pointer-events:none;border-radius:20px;opacity:0;
  background:radial-gradient(ellipse at 50% 60%,rgba(230,50,40,.0),rgba(230,40,30,.45));z-index:0}
.bmb-device.warn .bmb-heartbeat{animation:bmb-beat 1.1s ease-in-out infinite}
.bmb-device.crit .bmb-heartbeat{animation:bmb-beat .5s ease-in-out infinite}
@keyframes bmb-beat{0%,100%{opacity:0}50%{opacity:1}}
.bmb-device>*{position:relative;z-index:1}

.bmb-topbar{display:flex;align-items:center;gap:10px}
.bmb-led-screen{flex:1;background:#0a0d0a;border-radius:10px;padding:6px 12px;border:1px solid #1d241d;
  box-shadow:inset 0 2px 8px rgba(0,0,0,.7);display:flex;flex-direction:column}
.bmb-led-lbl{font-size:.56rem;letter-spacing:.2em;color:#3c5a3c}
.bmb-time{font-family:var(--font-mono,monospace);font-size:2.3rem;font-weight:700;line-height:1;color:#ff4632;
  text-shadow:0 0 8px rgba(255,70,50,.8),0 0 18px rgba(255,40,30,.5);letter-spacing:.06em}
.bmb-device.warn .bmb-time{color:#ff6a32;text-shadow:0 0 10px rgba(255,110,50,.9)}
.bmb-device.crit .bmb-time{animation:bmb-timeblink .5s steps(1) infinite}
@keyframes bmb-timeblink{50%{opacity:.45}}
.bmb-status{width:14px;height:14px;border-radius:50%;background:#23d160;box-shadow:0 0 8px #23d160;animation:bmb-blink 1.4s infinite}
.bmb-device.warn .bmb-status{background:#f5a623;box-shadow:0 0 8px #f5a623}
.bmb-device.crit .bmb-status{background:#ff3b30;box-shadow:0 0 10px #ff3b30;animation:bmb-blink .5s infinite}
@keyframes bmb-blink{0%,45%{opacity:1}55%,100%{opacity:.25}}
.bmb-sound{background:#11141a;border:1px solid #2a3140;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:.95rem;color:#cdd}
.bmb-sound:hover{border-color:#3d4659}

.bmb-meta{display:flex;justify-content:space-between;align-items:center;margin-top:9px;font-size:.66rem;color:#7d8898;letter-spacing:.08em}
.bmb-serial b{color:#aeb8c6;font-family:var(--font-mono,monospace);letter-spacing:.1em}
.bmb-strikes{display:flex;gap:4px}
.bmb-strike-x{color:#39414f;font-size:.8rem;transition:all .2s}
.bmb-strike-x.lit{color:#ff3b30;text-shadow:0 0 8px rgba(255,59,48,.9);transform:scale(1.2)}

.bmb-progress{display:flex;gap:6px;justify-content:center;margin:11px 0 4px}
.bmb-dot{width:13px;height:13px;border-radius:50%;background:#222833;border:1px solid #39414f;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#23d160}
.bmb-dot.active{background:rgba(245,166,35,.25);border-color:#f5a623;box-shadow:0 0 8px rgba(245,166,35,.5)}
.bmb-dot.done{background:rgba(35,209,96,.2);border-color:#23d160}

.bmb-module{background:#14171e;border:1px solid #2a3140;border-radius:14px;padding:14px;margin-top:8px;min-height:210px;
  box-shadow:inset 0 2px 10px rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px}
.bmb-mod-head{width:100%;display:flex;justify-content:space-between;align-items:center}
.bmb-mod-tag{font-size:.62rem;letter-spacing:.12em;color:#6b7686;text-transform:uppercase}
.bmb-mod-name{font-size:.8rem;font-weight:800;color:#cdd6e2}
.bmb-wire-rule{width:100%;background:#0e1117;border:1px dashed #313a4a;border-radius:9px;padding:8px 10px;font-size:.8rem;color:#dbe2ec;line-height:1.35}
.bmb-hint{text-align:center;font-size:.8rem;color:#9aa6b6;min-height:1.3em;margin-top:8px}
.bmb-fb{font-weight:800}.bmb-fb.ok{color:#23d160}.bmb-fb.strike{color:#ff5a45}

/* wires */
.bmb-wires{width:100%;display:flex;flex-direction:column;gap:8px;padding:2px 0}
.bmb-wire{display:flex;align-items:center;gap:10px;background:transparent;border:none;cursor:pointer;padding:3px 0;font-family:inherit}
.bmb-wire-num{width:18px;font-size:.72rem;color:#6b7686;font-weight:700}
.bmb-wire-line{flex:1;height:9px;border-radius:5px;background:linear-gradient(180deg,color-mix(in srgb,var(--wc) 70%,#fff) 0%,var(--wc) 45%,color-mix(in srgb,var(--wc) 70%,#000) 100%);
  box-shadow:0 1px 3px rgba(0,0,0,.5);position:relative;transition:all .2s}
.bmb-wire-screw{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#aeb8c6,#4a525f);box-shadow:0 1px 2px rgba(0,0,0,.6)}
.bmb-wire:hover .bmb-wire-line{filter:brightness(1.15);box-shadow:0 0 8px rgba(255,255,255,.3),0 1px 3px rgba(0,0,0,.5)}
.bmb-wire.cut .bmb-wire-line{background:#222833!important;box-shadow:inset 0 0 4px #000}
.bmb-wire.cut .bmb-wire-line::after{content:'✂';position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:.7rem;color:#8a93a3}

/* button */
.bmb-btn-stage{display:flex;flex-direction:column;align-items:center;gap:12px;padding:10px 0 4px}
.bmb-bigbtn{width:130px;height:130px;border-radius:50%;border:6px solid rgba(0,0,0,.35);cursor:pointer;
  font-family:inherit;font-weight:900;font-size:1.05rem;letter-spacing:.04em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);
  box-shadow:0 8px 0 rgba(0,0,0,.4),0 12px 22px rgba(0,0,0,.5),inset 0 3px 8px rgba(255,255,255,.3);transition:transform .06s,box-shadow .06s;user-select:none;-webkit-user-select:none;touch-action:none}
.bmb-bigbtn.pressed{transform:translateY(6px);box-shadow:0 2px 0 rgba(0,0,0,.4),0 5px 12px rgba(0,0,0,.5),inset 0 3px 10px rgba(0,0,0,.3)}
.bmb-bigbtn.c-red{background:radial-gradient(circle at 40% 32%,#ff6a5e,#d6291e)}
.bmb-bigbtn.c-blue{background:radial-gradient(circle at 40% 32%,#5aa8ff,#1b63d6)}
.bmb-bigbtn.c-yellow{background:radial-gradient(circle at 40% 32%,#ffe07a,#e0a915);color:#5a4500;text-shadow:0 1px 1px rgba(255,255,255,.4)}
.bmb-bigbtn.c-white{background:radial-gradient(circle at 40% 32%,#fff,#c4ccd6);color:#2a3140;text-shadow:none}
.bmb-btn-strip{width:90px;height:12px;border-radius:6px;background:#10131a;border:1px solid #2a3140;transition:all .2s}
.bmb-btn-strip.on{background:linear-gradient(90deg,#5aa8ff,#a0e9ff);box-shadow:0 0 12px rgba(90,168,255,.8)}

/* simon */
.bmb-simon{position:relative;width:200px;height:200px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;margin:6px auto}
.bmb-simon-pad{border:none;cursor:pointer;background:var(--sc);opacity:.42;border-radius:12px;transition:opacity .08s,box-shadow .08s;filter:saturate(.8)}
.bmb-simon-pad:nth-child(1){border-top-left-radius:90px}
.bmb-simon-pad:nth-child(2){border-top-right-radius:90px}
.bmb-simon-pad:nth-child(3){border-bottom-left-radius:90px}
.bmb-simon-pad:nth-child(4){border-bottom-right-radius:90px}
.bmb-simon-pad.lit{opacity:1;filter:saturate(1.4) brightness(1.3);box-shadow:0 0 24px var(--sc)}
.bmb-simon-core{position:absolute;left:50%;top:50%;width:58px;height:58px;border-radius:50%;transform:translate(-50%,-50%);
  background:radial-gradient(circle at 40% 35%,#2a2f38,#0e1116);border:3px solid #1a1e26;box-shadow:inset 0 2px 6px rgba(0,0,0,.6)}

/* keypad / led input */
.bmb-code-show{font-family:var(--font-mono,monospace);font-size:2.4rem;font-weight:700;letter-spacing:.35em;color:#ff4632;
  text-shadow:0 0 10px rgba(255,70,50,.7);background:#0a0d0a;border:1px solid #1d241d;border-radius:10px;padding:.5rem 1.2rem;margin:.3rem 0}
.bmb-code-show.hidden{color:#33403a;text-shadow:none}
.bmb-maths-q{font-family:var(--font-mono,monospace);font-size:1.7rem;font-weight:700;color:#7fe9ff;text-shadow:0 0 8px rgba(127,233,255,.5);margin:.2rem 0}
.bmb-led-input{background:#0a0d0a;border:1px solid #1d241d;border-radius:8px;padding:.35rem 1rem;margin:.2rem 0 .5rem}
.bmb-led-input span{font-family:var(--font-mono,monospace);font-size:1.6rem;font-weight:700;letter-spacing:.3em;color:#43d17a;text-shadow:0 0 8px rgba(67,209,122,.6)}
.bmb-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;width:100%;max-width:230px}
.bmb-key{background:linear-gradient(180deg,#2a3140,#1a1f29);border:1px solid #39414f;border-radius:9px;color:#dbe2ec;font:inherit;font-size:1.05rem;font-weight:700;padding:.55rem 0;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.4);transition:all .08s}
.bmb-key:hover{border-color:#4d5872}
.bmb-key:active{transform:translateY(2px);box-shadow:none}
.bmb-key.wide{font-size:.9rem}
.bmb-key.go{background:linear-gradient(180deg,#1f7a44,#155532);border-color:#2a9d56;color:#eafff2}

/* fx */
.bmb-shake{animation:bmb-shake .42s cubic-bezier(.36,.07,.19,.97)}
@keyframes bmb-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
.bmb-flash{position:absolute;inset:0;z-index:5;pointer-events:none;border-radius:20px;animation:bmb-fade .5s ease-out forwards}
.bmb-flash.red{background:radial-gradient(circle,rgba(255,60,40,.5),transparent 70%)}
.bmb-flash.green{background:radial-gradient(circle,rgba(40,220,110,.4),transparent 70%)}
.bmb-flash.boom{background:radial-gradient(circle,rgba(255,230,150,.95),rgba(255,120,40,.7) 40%,transparent 75%)}
@keyframes bmb-fade{from{opacity:1}to{opacity:0}}
.bmb-device.exploded{animation:bmb-explode .4s ease-out forwards}
@keyframes bmb-explode{0%{transform:scale(1)}30%{transform:scale(1.03)}100%{transform:scale(1);filter:brightness(.7) saturate(.6)}}
.bmb-device.defused{box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 36px rgba(35,209,96,.45),inset 0 0 0 2px rgba(0,0,0,.4)}

.bmb-end{text-align:center;padding:1rem;display:flex;flex-direction:column;align-items:center;gap:.4rem}
.bmb-end-emo{font-size:3rem}
.bmb-end-title{font-size:1.4rem;font-weight:900}
.bmb-end-title.ok{color:#23d160}.bmb-end-title.bad{color:#ff5a45}
.bmb-end-sub{color:#9aa6b6;font-size:.85rem}
.bmb-end-lvl{font-size:.75rem;color:#7fe9ff}
.bmb-end-btn{margin-top:.5rem;background:linear-gradient(135deg,#7c5cff,#a855f7);border:none;color:#fff;border-radius:11px;padding:.6rem 1.4rem;font:inherit;font-weight:800;cursor:pointer}
.bmb-end-btn:hover{filter:brightness(1.08)}
@media (prefers-reduced-motion:reduce){.bmb-device,.bmb-time,.bmb-status,.bmb-heartbeat,.bmb-flash,.bmb-shake{animation:none!important}}`;
    document.head.appendChild(s);
  }

  return { init };
})();
