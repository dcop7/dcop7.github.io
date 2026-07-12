/* ══════════════════════════════════════════════════════════════════
   ArcheryGame — tiro ao arco em primeira pessoa, offline, canvas 2D.
   Projeção perspetiva própria (sem three.js — fluidez em mobile) com
   física 3D real das setas: gravidade, queda com a distância e vento
   lateral com rajadas. Controlo físico e igual em desktop/mobile:
     premir  = armar a seta (a força sobe ~0.9s),
     mover   = apontar (a mira segue o dedo/rato),
     soltar  = disparar. Segurar demasiado tempo cansa o braço (sway).
   Modos: Campanha (18 níveis, 5 cenários, estrelas) e Sem Fim
   (alvos aleatórios, 3 falhas termina; dificuldade global do GameHost
   escala vento/fadiga/tamanho). Integra GameProgress (níveis, estrelas,
   recordes, conquistas) e CanvasEngine/Particles partilhados. Sons de
   arco sintetizados localmente (WebAudio, silenciados por GameAudio).
══════════════════════════════════════════════════════════════════ */
const ArcheryGame = (function () {
  'use strict';

  /* ── i18n ──────────────────────────────────────────────────────── */
  const FB_I18N = {
    pt: {
      title: 'Tiro ao Arco', tagline: 'Primeira pessoa. Vento, distância e um braço que treme. Fácil de aprender, difícil de dominar.',
      campaign: '🎯 Campanha', endless: '♾️ Sem Fim', howto: '📖 Como jogar',
      level: 'Nível', arrows: 'Setas', wind: 'Vento', dist: 'Distância', score: 'Pontos',
      best: 'Recorde', hits: 'alvos', back: '⬅ Menu', pause: 'Pausa', resume: '▶ Continuar',
      retry: '🔄 Repetir', next: '▶ Seguinte', menu: 'Menu',
      lvlDone: 'Nível concluído!', lvlFail: 'Pontos insuficientes…', endOver: 'Fim da corrida!',
      goal: 'Objetivo', newBest: '🏆 Novo recorde!',
      bullseye: 'NA MOSCA!', perfect: 'PERFEITA', miss: 'Falhou…', balloon: 'Balão! +5',
      draw: 'Prime e segura para armar · move para apontar · solta para disparar',
      tut1: 'Prime e segura (rato ou dedo): a seta arma e a força sobe.',
      tut2: 'Enquanto seguras, move para apontar. A mira é o teu ponto de partida — a seta CAI com a distância e o VENTO empurra-a.',
      tut3: 'Solta para disparar. Aponta acima do alvo ao longe e contra o vento (vê a bandeira).',
      tut4: 'Não demores: o braço cansa e a mira começa a tremer.',
      lvls: ['O primeiro alvo', 'Um passo atrás', 'Brisa ligeira', 'Confiança', 'Entre as árvores', 'Vento na clareira', 'Alvo esquivo', 'Mestria verde', 'Calor do deserto', 'Miragem', 'Vento do deserto', 'Sol poente', 'Ar gelado', 'Nevão', 'Gelo e vento', 'Luz das tochas', 'Meia-noite', 'A prova final'],
      sceneNames: ['Prado', 'Floresta', 'Deserto', 'Neve', 'Noite'],
      stars: 'estrelas', pass: 'passar',
    },
    en: {
      title: 'Archery', tagline: 'First person. Wind, distance and a trembling arm. Easy to learn, hard to master.',
      campaign: '🎯 Campaign', endless: '♾️ Endless', howto: '📖 How to play',
      level: 'Level', arrows: 'Arrows', wind: 'Wind', dist: 'Distance', score: 'Score',
      best: 'Best', hits: 'targets', back: '⬅ Menu', pause: 'Pause', resume: '▶ Resume',
      retry: '🔄 Retry', next: '▶ Next', menu: 'Menu',
      lvlDone: 'Level complete!', lvlFail: 'Not enough points…', endOver: 'Run over!',
      goal: 'Goal', newBest: '🏆 New best!',
      bullseye: 'BULLSEYE!', perfect: 'PERFECT', miss: 'Missed…', balloon: 'Balloon! +5',
      draw: 'Press and hold to draw · move to aim · release to shoot',
      tut1: 'Press and hold (mouse or finger): the arrow nocks and power builds.',
      tut2: 'While holding, move to aim. The pin is your start point — arrows DROP with distance and WIND pushes them.',
      tut3: 'Release to shoot. Aim above far targets and into the wind (watch the flag).',
      tut4: 'Don’t hold too long: your arm tires and the aim starts to shake.',
      lvls: ['First target', 'A step back', 'Light breeze', 'Confidence', 'Between the trees', 'Wind in the clearing', 'Elusive target', 'Green mastery', 'Desert heat', 'Mirage', 'Desert wind', 'Setting sun', 'Frozen air', 'Snowstorm', 'Ice and wind', 'Torchlight', 'Midnight', 'The final trial'],
      sceneNames: ['Meadow', 'Forest', 'Desert', 'Snow', 'Night'],
      stars: 'stars', pass: 'pass',
    },
  };
  const _hasGD = typeof GameData !== 'undefined';
  const t = _hasGD ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] !== undefined ? FB_I18N.pt[k] : k));

  /* ── cenários (paletas desenhadas proceduralmente) ─────────────── */
  const SCENES = [
    { sky: ['#8ec9f0', '#cfe9fb'], ground: ['#7fb069', '#4d7c3a'], far: '#5a8f6e', sun: '#fff3b0', flag: '#e05252', night: false },
    { sky: ['#a7d3e8', '#e4f2d8'], ground: ['#4e7d3f', '#2f5426'], far: '#2c4a2e', sun: '#fdf6c9', flag: '#e0a252', night: false, trees: true },
    { sky: ['#f7b267', '#f4845f'], ground: ['#d9a066', '#a8683a'], far: '#b3562e', sun: '#ffe082', flag: '#7a3b2e', night: false, sunset: true },
    { sky: ['#b8cfe0', '#e9f1f7'], ground: ['#eef4f8', '#c6d6e2'], far: '#8ca7bd', sun: '#f2f7fb', flag: '#3a6ea5', night: false, snow: true },
    { sky: ['#0b1030', '#1d2a55'], ground: ['#22304a', '#101b30'], far: '#0e1a33', sun: '#e8ecf5', flag: '#f2b344', night: true },
  ];

  /* ── campanha: 18 níveis (dist m, vento máx m/s, setas, movimento,
        escala do alvo, metas de estrelas, cenário, balões) ─────────── */
  const LEVELS = [
    { d: 12, w: 0,   n: 6, mv: 0,   sz: 1,    s: [30, 42, 52], sc: 0 },
    { d: 18, w: 0,   n: 6, mv: 0,   sz: 1,    s: [32, 44, 54], sc: 0 },
    { d: 18, w: 2,   n: 6, mv: 0,   sz: 1,    s: [32, 44, 54], sc: 0, bal: 1 },
    { d: 25, w: 2.5, n: 6, mv: 0,   sz: 1,    s: [34, 46, 55], sc: 0 },
    { d: 22, w: 1.5, n: 6, mv: 0,   sz: 0.85, s: [34, 46, 55], sc: 1 },
    { d: 28, w: 3.5, n: 6, mv: 0,   sz: 0.85, s: [34, 46, 56], sc: 1, bal: 1 },
    { d: 25, w: 2,   n: 7, mv: 0.7, sz: 0.85, s: [38, 52, 63], sc: 1 },
    { d: 34, w: 4,   n: 7, mv: 0,   sz: 0.8,  s: [40, 54, 64], sc: 1 },
    { d: 30, w: 2.5, n: 6, mv: 0,   sz: 0.8,  s: [36, 48, 57], sc: 2, bal: 2 },
    { d: 38, w: 3,   n: 7, mv: 0.9, sz: 0.8,  s: [40, 54, 65], sc: 2 },
    { d: 42, w: 5,   n: 7, mv: 0,   sz: 0.75, s: [40, 54, 66], sc: 2 },
    { d: 46, w: 4,   n: 7, mv: 1,   sz: 0.75, s: [42, 56, 67], sc: 2, bal: 1 },
    { d: 40, w: 3.5, n: 7, mv: 0,   sz: 0.7,  s: [42, 56, 67], sc: 3 },
    { d: 48, w: 5.5, n: 8, mv: 0,   sz: 0.7,  s: [48, 63, 76], sc: 3, bal: 2 },
    { d: 52, w: 6,   n: 8, mv: 1.1, sz: 0.7,  s: [48, 64, 77], sc: 3 },
    { d: 45, w: 4,   n: 7, mv: 1,   sz: 0.65, s: [44, 58, 69], sc: 4 },
    { d: 55, w: 5,   n: 8, mv: 0,   sz: 0.65, s: [48, 64, 78], sc: 4, bal: 2 },
    { d: 60, w: 6.5, n: 8, mv: 1.2, sz: 0.65, s: [50, 66, 80], sc: 4 },
  ];

  /* ── constantes físicas / render ───────────────────────────────── */
  const CAM_H = 1.55;                 /* altura da câmara (m) */
  const TGT_H = 1.3;                  /* centro do alvo (m)   */
  const TGT_R = 0.61;                 /* raio alvo 122cm FITA */
  const G = 9.8;
  const V_MIN = 26, V_MAX = 68;       /* velocidade da seta conforme a força */

  /* ── estado do módulo ──────────────────────────────────────────── */
  let root = null, S = null, eng = null, parts = null, seq = 0;
  const store = () => (typeof GameProgress !== 'undefined')
    ? GameProgress.store('archery')
    : { getPref: (k, d) => d, setPref: () => {}, getStats: () => ({}) };

  function diff() {
    try { if (typeof GameHost !== 'undefined' && GameHost.getDifficulty) return GameHost.getDifficulty(); } catch (e) {}
    return 'medium';
  }
  const DIFF_MOD = { easy: { wind: 0.6, sway: 0.55, size: 1.15 }, medium: { wind: 1, sway: 1, size: 1 }, hard: { wind: 1.35, sway: 1.45, size: 0.85 } };

  /* ── sons de arco (WebAudio local, respeita GameAudio.muted) ───── */
  let _ac = null;
  function ac() {
    if (typeof GameAudio !== 'undefined' && GameAudio.muted) return null;
    try { _ac = _ac || new (window.AudioContext || window.webkitAudioContext)(); if (_ac.state === 'suspended') _ac.resume(); return _ac; }
    catch (e) { return null; }
  }
  function tone(f0, f1, dur, type, vol) {
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  }
  function noise(dur, vol, fLow) {
    const a = ac(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const g = a.createGain(); g.gain.value = vol || 0.15;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fLow || 900;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  }
  const sfx = {
    nock:  () => { noise(0.06, 0.06, 1800); },
    creak: () => { tone(140, 180, 0.35, 'triangle', 0.03); },
    twang: () => { tone(190, 70, 0.18, 'sawtooth', 0.16); noise(0.1, 0.1, 2400); },
    thunk: () => { tone(95, 55, 0.14, 'sine', 0.3); noise(0.05, 0.18, 700); },
    miss:  () => { noise(0.2, 0.1, 500); },
    bull:  () => { try { typeof GameAudio !== 'undefined' && GameAudio.coin(); } catch (e) {} },
    pop:   () => { try { typeof GameAudio !== 'undefined' && GameAudio.pop(); } catch (e) {} },
  };

  /* ── progressão persistida ─────────────────────────────────────── */
  function progress() { return store().getPref('camp', { unlocked: 0, stars: {} }); }
  function saveProgress(p) { try { store().setPref('camp', p); } catch (e) {} }

  /* ══ JOGO ══════════════════════════════════════════════════════ */
  function newGame(mode, lvlIdx) {
    seq++;
    const dm = DIFF_MOD[diff()];
    const L = mode === 'camp' ? LEVELS[lvlIdx] : null;
    S = {
      mode, lvlIdx, dm,
      scene: SCENES[L ? L.sc : Math.floor(Math.random() * SCENES.length)],
      sceneIdx: L ? L.sc : 0,
      dist: L ? L.d : 15,
      windMax: (L ? L.w : 1.5) * dm.wind,
      wind: 0, gust: Math.random() * 1000,
      size: (L ? L.sz : 1) * dm.size,
      move: L ? L.mv : 0, movP: Math.random() * 6,
      arrowsLeft: L ? L.n : Infinity,
      misses: 0, hitsRow: 0, targets: 0,
      score: 0, best: 0,
      state: 'aim',                       /* aim | draw | fly | done */
      power: 0, holdT: 0,
      aimX: 0, aimY: 0, px: 0, py: 0,
      arrow: null, stuck: [], balloons: [],
      lastHit: null, msg: null, msgT: 0,
      shake: 0, slow: 0, time: 0,
      zoomF: 0,
    };
    if (mode === 'endless') {
      S.best = (typeof GameProgress !== 'undefined' ? (GameProgress.bestScore('archery', 'endless-' + diff()) || 0) : 0);
      nextEndlessTarget(true);
    }
    rollWind();
    spawnBalloons(L ? (L.bal || 0) : 0);
    renderGame();
  }

  function rollWind() {
    const dir = Math.random() < 0.5 ? -1 : 1;
    S.wind = dir * (S.windMax * (0.55 + Math.random() * 0.45));
    if (Math.abs(S.wind) < 0.15) S.wind = 0;
  }

  function nextEndlessTarget(first) {
    const n = S.targets;
    S.dist = 12 + Math.min(50, n * 2.2) * (0.7 + Math.random() * 0.5);
    S.windMax = Math.min(7, n * 0.45) * S.dm.wind;
    S.size = Math.max(0.55, 1 - n * 0.02) * S.dm.size;
    S.move = n > 6 && Math.random() < 0.4 ? Math.min(1.3, 0.5 + n * 0.04) : 0;
    S.movP = Math.random() * 6;
    S.scene = SCENES[Math.floor(n / 5) % SCENES.length];
    S.stuck = [];
    rollWind();
    if (!first && Math.random() < 0.3) spawnBalloons(1); else if (!first) S.balloons = [];
  }

  function spawnBalloons(k) {
    S.balloons = [];
    for (let i = 0; i < k; i++) {
      S.balloons.push({
        x: (Math.random() * 2 - 1) * 2.2, y: TGT_H + 0.8 + Math.random() * 1.2,
        z: S.dist * (0.85 + Math.random() * 0.3), r: 0.22,
        ph: Math.random() * 6, col: ['#ef4444', '#f2b344', '#22d3ee', '#a855f7'][i % 4],
      });
    }
  }

  /* ── disparo ── */
  function fire() {
    if (S.power < 0.15) { S.state = 'aim'; S.power = 0; return; }
    const v = V_MIN + S.power * (V_MAX - V_MIN);
    const f = focal();
    const yaw = (S.aimX - eng.width / 2) / f;
    const pitch = (eng.height * hor() - S.aimY) / f;
    S.arrow = { t: 0, v, yaw, pitch, x: 0.12, y: CAM_H - 0.12, z: 0.4, px: null, py: null, trail: [] };
    S.state = 'fly';
    S.shake = 1;
    S.arrowsLeft--; S.power = 0;
    sfx.twang();
    setHint('');
    updateHUD();
  }

  function arrowPos(a, dt) {
    a.t += dt;
    const T = a.t;
    a.x = 0.12 + a.v * a.yaw * T + 0.5 * (S.wind * 0.9) * T * T;
    a.y = (CAM_H - 0.12) + a.v * a.pitch * T - 0.5 * G * T * T;
    a.z = 0.4 + a.v * T;
  }

  function resolveArrow() {
    const a = S.arrow;
    /* balões primeiro (podem estar antes/depois do plano do alvo) */
    for (const b of S.balloons) {
      if (b.hit) continue;
      const T = (b.z - 0.4) / a.v;
      const ax = 0.12 + a.v * a.yaw * T + 0.5 * (S.wind * 0.9) * T * T;
      const ay = (CAM_H - 0.12) + a.v * a.pitch * T - 0.5 * G * T * T;
      const bx = b.x + Math.sin(S.time * 0.7 + b.ph) * 0.25;
      const by = b.y + Math.sin(S.time * 1.1 + b.ph) * 0.15;
      if (Math.hypot(ax - bx, ay - by) < b.r + 0.06) {
        b.hit = true; addScore(5, t('balloon'), '#f2b344');
        sfx.pop(); burstAt(project(bx, by, b.z), b.col);
        return null;                    /* seta continua? não — pop e some */
      }
    }
    /* plano do alvo */
    const T = (S.dist - 0.4) / a.v;
    const ax = 0.12 + a.v * a.yaw * T + 0.5 * (S.wind * 0.9) * T * T;
    const ay = (CAM_H - 0.12) + a.v * a.pitch * T - 0.5 * G * T * T;
    const tx = targetX(), ty = TGT_H;
    const r = TGT_R * S.size;
    const off = Math.hypot(ax - tx, ay - ty) / r;
    if (off <= 1.05) {
      const ring = off <= 0.1 ? 10 : off <= 0.22 ? 10 : off <= 0.38 ? 9 : off <= 0.56 ? 8 : off <= 0.76 ? 7 : off <= 0.92 ? 6 : 5;
      const isX = off <= 0.1;
      S.stuck.push({ ox: (ax - tx) / r, oy: (ay - ty) / r });
      return { ring, isX, sx: project(ax, ay, S.dist) };
    }
    if (ay <= 0.05) return { ring: 0, ground: true, sx: project(ax, Math.max(ay, 0.02), S.dist) };
    return { ring: 0, sx: project(ax, ay, S.dist) };
  }

  function addScore(n, msg, col) {
    S.score += n;
    S.msg = msg; S.msgCol = col || '#fff'; S.msgT = 1.4;
    updateHUD();
  }

  function onArrowDone(hit) {
    S.arrow = null;
    if (hit && hit.ring > 0) {
      S.hitsRow++;
      const label = hit.isX ? t('bullseye') : String(hit.ring);
      addScore(hit.ring, label, hit.isX ? '#f2b344' : hit.ring >= 9 ? '#22d3ee' : '#fff');
      sfx.thunk();
      if (hit.isX) { S.slow = 0.55; sfx.bull(); burstAt(hit.sx, '#f2b344', 22); S.flags = S.flags || {}; S.flags.bull = true; if (S.dist >= 50) S.flags.farBull = true; if (Math.abs(S.wind) >= 4 && S.mode === 'camp') S.flags.windBull = true; }
      else burstAt(hit.sx, '#e6e9f0', 8);
      if (hit.ring === 10 && Math.abs(S.wind) >= 4) { S.flags = S.flags || {}; S.flags.windBull = true; }
      if (S.mode === 'endless') { S.targets++; S.hitsRow >= 0 && setTimeout(() => { if (S && S.state !== 'done') { nextEndlessTarget(); updateHUD(); } }, 550); }
    } else {
      S.hitsRow = 0;
      S.msg = t('miss'); S.msgCol = '#8b93a7'; S.msgT = 1.1;
      sfx.miss();
      if (hit && hit.sx) burstAt(hit.sx, '#9c8a6e', 6);
      if (S.mode === 'endless') { S.misses++; if (S.misses >= 3) return endRun(); setTimeout(() => { if (S && S.state !== 'done') { nextEndlessTarget(); updateHUD(); } }, 550); }
    }
    updateHUD();
    if (S.mode === 'camp' && S.arrowsLeft <= 0) return endLevel();
    if (S.mode === 'camp') rollWind();
    S.state = 'aim';
    updateHUD();
  }

  /* ── fim de nível / corrida ── */
  function endLevel() {
    S.state = 'done';
    const L = LEVELS[S.lvlIdx];
    const stars = S.score >= L.s[2] ? 3 : S.score >= L.s[1] ? 2 : S.score >= L.s[0] ? 1 : 0;
    const p = progress();
    if (stars > 0) {
      p.stars[S.lvlIdx] = Math.max(p.stars[S.lvlIdx] || 0, stars);
      p.unlocked = Math.max(p.unlocked, S.lvlIdx + 1);
      saveProgress(p);
    }
    const campDone = p.unlocked >= LEVELS.length;
    if (typeof GameProgress !== 'undefined') {
      const meta = Object.assign({}, S.flags || {});
      if (stars === 3) meta.threeStars = true;
      if (campDone) meta.campaignDone = true;
      GameProgress.record('archery', { won: stars > 0, score: S.score, mode: 'lvl' + (S.lvlIdx + 1), meta });
    }
    showEnd({
      title: stars > 0 ? t('lvlDone') : t('lvlFail'),
      stars, score: S.score, goal: L.s,
      canNext: stars > 0 && S.lvlIdx + 1 < LEVELS.length,
    });
  }

  function endRun() {
    S.state = 'done';
    S.arrow = null;
    let newBest = false;
    if (typeof GameProgress !== 'undefined') {
      const meta = Object.assign({ endless: true, targetsHit: S.targets }, S.flags || {});
      const res = GameProgress.record('archery', { score: S.score, mode: 'endless-' + diff(), meta });
      newBest = res.newBest;
    }
    showEnd({ title: t('endOver'), score: S.score, targets: S.targets, newBest, endless: true });
  }

  /* ══ RENDER (projeção + cena) ══════════════════════════════════ */
  const hor = () => 0.46;                                  /* linha do horizonte (fração da altura) */
  const focal = () => eng.height * 1.15 * (1 + S.zoomF * 0.08);
  function project(x, y, z) {
    const f = focal();
    return { x: eng.width / 2 + (x / z) * f, y: eng.height * hor() + ((CAM_H - y) / z) * f, s: f / z };
  }
  function targetX() { return S.move ? Math.sin(S.time * S.move * 0.9 + S.movP) * 1.6 : 0; }

  function drawScene(ctx, w, h) {
    const sc = S.scene;
    const hy = h * hor();
    /* céu */
    let g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, sc.sky[0]); g.addColorStop(1, sc.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy + 1);
    /* sol / lua + estrelas */
    ctx.globalAlpha = sc.night ? 0.9 : 0.85;
    ctx.fillStyle = sc.sun;
    ctx.beginPath(); ctx.arc(w * (sc.sunset ? 0.5 : 0.78), hy * (sc.sunset ? 0.82 : 0.3), sc.sunset ? 34 : 20, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    if (sc.night) {
      ctx.fillStyle = '#cfe3ff';
      for (let i = 0; i < 26; i++) {
        const sx = ((i * 137.5) % w), sy = ((i * 89.7) % (hy * 0.85));
        ctx.globalAlpha = 0.25 + ((i * 37) % 60) / 100 * 0.5;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
    /* nuvens a andar com o vento */
    if (!sc.night) {
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 3; i++) {
        const cx = ((S.time * (6 + S.wind * 4) + i * w / 3 + i * 60) % (w + 200)) - 100;
        const cy = hy * (0.18 + i * 0.16);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 46, 11, 0, 0, 7); ctx.ellipse(cx + 26, cy - 7, 26, 9, 0, 0, 7); ctx.ellipse(cx - 28, cy - 5, 22, 8, 0, 0, 7);
        ctx.fill();
      }
    }
    /* linha distante (montanhas / árvores) */
    ctx.fillStyle = sc.far;
    ctx.beginPath(); ctx.moveTo(0, hy);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, hy - 12 - 18 * Math.abs(Math.sin(x * 0.013 + 2)));
    ctx.lineTo(w, hy); ctx.closePath(); ctx.fill();
    if (sc.trees) {
      for (let i = 0; i < 8; i++) {
        const tx = (i * 0.131 % 1) * w, s2 = 10 + (i * 53 % 26);
        ctx.beginPath(); ctx.moveTo(tx, hy); ctx.lineTo(tx - s2 * 0.5, hy); ctx.lineTo(tx, hy - s2 * 1.7); ctx.lineTo(tx + s2 * 0.5, hy); ctx.fill();
      }
    }
    /* chão em perspetiva */
    g = ctx.createLinearGradient(0, hy, 0, h);
    g.addColorStop(0, sc.ground[0]); g.addColorStop(1, sc.ground[1]);
    ctx.fillStyle = g; ctx.fillRect(0, hy, w, h - hy);
    /* marcas de distância no chão */
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
    for (let dz = 10; dz <= 60; dz += 10) {
      if (dz > S.dist + 12) break;
      const p = project(0, 0, dz);
      if (p.y > hy + 2 && p.y < h) {
        ctx.beginPath(); ctx.moveTo(w / 2 - p.s * 2.2, p.y); ctx.lineTo(w / 2 + p.s * 2.2, p.y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `${Math.max(9, p.s * 0.16)}px ${getComputedStyle(document.body).getPropertyValue('--font-mono') || 'monospace'}`;
        ctx.textAlign = 'left';
        ctx.fillText(dz + 'm', w / 2 + p.s * 2.3, p.y - 2);
      }
    }
  }

  function drawTarget(ctx) {
    const tx = targetX();
    const base = project(tx, 0, S.dist);
    const c = project(tx, TGT_H, S.dist);
    const r = TGT_R * S.size * c.s;
    /* tripé */
    ctx.strokeStyle = '#6b5236'; ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(c.x - r * 0.75, base.y); ctx.lineTo(c.x, c.y);
    ctx.moveTo(c.x + r * 0.75, base.y); ctx.lineTo(c.x, c.y);
    ctx.stroke();
    /* sombra */
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(c.x, base.y + 2, r * 1.05, r * 0.16, 0, 0, 7); ctx.fill();
    /* face do alvo */
    const rings = [[1, '#f4f1e6'], [0.92, '#2b2f3a'], [0.76, '#2b2f3a'], [0.56, '#66c2e8'], [0.38, '#e05252'], [0.22, '#f2c14e'], [0.1, '#f2c14e']];
    rings.forEach(([f, col], i) => {
      ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(0.5, r * f), 0, 7);
      ctx.fillStyle = col; ctx.fill();
      if (i === 0) { ctx.lineWidth = Math.max(1, r * 0.03); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke(); }
    });
    ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(0.4, r * 0.02), 0, 7); ctx.fillStyle = '#7a3b2e'; ctx.fill();
    /* setas espetadas */
    for (const a of S.stuck) {
      const ax = c.x + a.ox * r, ay = c.y + a.oy * r;
      ctx.strokeStyle = '#3d3428'; ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + r * 0.13, ay + r * 0.13); ctx.stroke();
      ctx.fillStyle = '#e05252';
      ctx.beginPath(); ctx.arc(ax + r * 0.13, ay + r * 0.13, Math.max(1, r * 0.045), 0, 7); ctx.fill();
    }
    /* bandeira do vento junto ao alvo */
    const pole = project(tx - TGT_R * S.size - 0.55, 0, S.dist);
    const top = project(tx - TGT_R * S.size - 0.55, 2.3, S.dist);
    ctx.strokeStyle = '#8a7a5f'; ctx.lineWidth = Math.max(1, c.s * 0.012);
    ctx.beginPath(); ctx.moveTo(pole.x, pole.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    const wmag = Math.abs(S.wind) / 7, wdir = Math.sign(S.wind) || 1;
    const flap = Math.sin(S.time * (2 + wmag * 9)) * 0.15;
    const fl = c.s * (0.28 + wmag * 0.45) * wdir;
    ctx.fillStyle = S.scene.flag;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(top.x + fl, top.y + c.s * (0.1 + flap));
    ctx.lineTo(top.x + fl * 0.9, top.y + c.s * (0.24 + flap));
    ctx.lineTo(top.x, top.y + c.s * 0.2);
    ctx.closePath(); ctx.fill();
    /* balões */
    for (const b of S.balloons) {
      if (b.hit) continue;
      const bx = b.x + Math.sin(S.time * 0.7 + b.ph) * 0.25;
      const by = b.y + Math.sin(S.time * 1.1 + b.ph) * 0.15;
      const p = project(bx, by, b.z);
      const br = b.r * p.s;
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + br); ctx.lineTo(p.x, p.y + br * 2.4); ctx.stroke();
      ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, br * 0.82, br, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.ellipse(p.x - br * 0.3, p.y - br * 0.35, br * 0.2, br * 0.28, -0.5, 0, 7); ctx.fill();
    }
  }

  function drawArrow3D(ctx) {
    const a = S.arrow; if (!a) return;
    const p = project(a.x, a.y, a.z);
    a.trail.push([p.x, p.y]);
    if (a.trail.length > 7) a.trail.shift();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    a.trail.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
    const s = Math.max(2, p.s * 0.055);
    ctx.save(); ctx.translate(p.x, p.y);
    const prev = a.trail.length > 1 ? a.trail[a.trail.length - 2] : [p.x - 1, p.y - 1];
    ctx.rotate(Math.atan2(p.y - prev[1], p.x - prev[0]));
    ctx.strokeStyle = '#4a3f2e'; ctx.lineWidth = Math.max(1.4, s * 0.28);
    ctx.beginPath(); ctx.moveTo(-s * 2.4, 0); ctx.lineTo(s * 0.8, 0); ctx.stroke();
    ctx.fillStyle = '#d9dee8';
    ctx.beginPath(); ctx.moveTo(s * 1.5, 0); ctx.lineTo(s * 0.5, -s * 0.42); ctx.lineTo(s * 0.5, s * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e05252';
    ctx.beginPath(); ctx.moveTo(-s * 2.4, 0); ctx.lineTo(-s * 1.7, -s * 0.5); ctx.lineTo(-s * 1.4, 0); ctx.lineTo(-s * 1.7, s * 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawBow(ctx, w, h) {
    /* arco em primeira pessoa, ancorado em baixo, roda ligeiramente com a mira */
    const bx = w * 0.56 + (S.aimX - w / 2) * 0.1;
    const by = h * 1.18;
    const lean = (S.aimX - w / 2) / w * 0.3;
    const drawLen = S.power * h * 0.075;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(lean);
    const R = h * 0.34;                   /* raio dos braços do arco */
    /* braços (arco estreito, visto por trás) */
    ctx.strokeStyle = '#6e4f2f';
    ctx.lineWidth = Math.max(5, h * 0.013);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI * 0.72, -Math.PI * 0.28); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = Math.max(2, h * 0.004);
    ctx.beginPath(); ctx.arc(0, 0, R - h * 0.006, -Math.PI * 0.7, -Math.PI * 0.3); ctx.stroke();
    /* pontas + corda puxada até ao ponto de encaixe */
    const tipL = [Math.cos(-Math.PI * 0.72) * R, Math.sin(-Math.PI * 0.72) * R];
    const tipR = [Math.cos(-Math.PI * 0.28) * R, Math.sin(-Math.PI * 0.28) * R];
    const nock = [0, -R * 0.7 + drawLen];
    ctx.strokeStyle = 'rgba(230,235,245,.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tipL[0], tipL[1]); ctx.lineTo(nock[0], nock[1]); ctx.lineTo(tipR[0], tipR[1]); ctx.stroke();
    /* seta encaixada */
    if (S.state === 'draw' || S.state === 'aim') {
      const al = R * 0.72;
      ctx.strokeStyle = '#4a3f2e'; ctx.lineWidth = Math.max(3, h * 0.008);
      ctx.beginPath(); ctx.moveTo(nock[0], nock[1]); ctx.lineTo(nock[0], nock[1] - al + drawLen * 0.3); ctx.stroke();
      ctx.fillStyle = '#d9dee8';
      const ay = nock[1] - al + drawLen * 0.3;
      ctx.beginPath(); ctx.moveTo(0, ay - h * 0.018); ctx.lineTo(-h * 0.008, ay); ctx.lineTo(h * 0.008, ay); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e05252';
      ctx.beginPath(); ctx.moveTo(-h * 0.01, nock[1]); ctx.lineTo(h * 0.01, nock[1]); ctx.lineTo(0, nock[1] - h * 0.03); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    /* barra de força */
    if (S.state === 'draw') {
      const bw = Math.min(200, w * 0.4), bh2 = 7;
      const x0 = w / 2 - bw / 2, y0 = h - 22;
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.roundRect(x0, y0, bw, bh2, 4); ctx.fill();
      const grad = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
      grad.addColorStop(0, '#22d3ee'); grad.addColorStop(0.7, '#f2b344'); grad.addColorStop(1, '#ef4444');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(x0, y0, bw * S.power, bh2, 4); ctx.fill();
    }
  }

  function drawSight(ctx) {
    if (S.state !== 'draw' && S.state !== 'aim') return;
    const x = S.aimX, y = S.aimY;
    const r = 9 + (1 - S.power) * 7;
    ctx.strokeStyle = S.state === 'draw' ? 'rgba(242,179,68,.95)' : 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7);
    ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    ctx.beginPath();
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
      ctx.moveTo(x + dx * (r + 2), y + dy * (r + 2));
      ctx.lineTo(x + dx * (r + 7), y + dy * (r + 7));
    });
    ctx.stroke();
  }

  function burstAt(p, col, n) {
    if (!parts || !p) return;
    parts.spawnBurst(p.x, p.y, n || 10, { color: col, speed: 90, life: 0.6, size: 3, gravity: 260 });
  }

  /* ── loop ── */
  function update(dt) {
    if (!S) return;
    const ts = S.slow > 0 ? 0.35 : 1;
    if (S.slow > 0) S.slow -= dt;
    const d = dt * ts;
    S.time += d;
    S.shake = Math.max(0, S.shake - dt * 4);
    if (S.msgT > 0) S.msgT -= dt;
    /* rajadas */
    if (S.windMax > 0 && S.state !== 'done') {
      S.gust += d;
      const base = S.wind;
      S.windNow = base * (1 + Math.sin(S.gust * 0.9) * 0.18);
    } else S.windNow = S.wind;
    S.zoomF += ((S.state === 'draw' ? 1 : 0) - S.zoomF) * Math.min(1, dt * 6);

    if (S.state === 'draw') {
      S.power = Math.min(1, S.power + dt / 0.9);
      S.holdT += dt;
      /* fadiga: tremer crescente depois de 1.6s em força máxima */
      const fat = Math.max(0, S.holdT - 1.6) * S.dm.sway;
      const amp = Math.min(26, fat * 7);
      S.aimX = S.px + Math.sin(S.time * 5.1) * amp + Math.sin(S.time * 8.7) * amp * 0.4;
      S.aimY = S.py + Math.cos(S.time * 4.3) * amp * 0.8 + Math.sin(S.time * 7.1) * amp * 0.35;
      if (S.holdT > 1.2) sfxCreak(dt);
    } else if (S.state === 'aim') {
      S.aimX = S.px; S.aimY = S.py;
    }

    if (S.state === 'fly' && S.arrow) {
      const a = S.arrow;
      arrowPos(a, d);
      if (a.z >= S.dist || a.y <= 0) {
        const hit = resolveArrow();
        if (hit === null) { /* balão: a seta desaparece no pop */ S.arrow = null; S.state = 'aim'; if (S.mode === 'camp' && S.arrowsLeft <= 0) endLevel(); else updateHUD(); }
        else onArrowDone(hit);
      }
    }
    if (parts) parts.update(dt);
  }
  let _creakT = 0;
  function sfxCreak(dt) { _creakT += dt; if (_creakT > 0.7) { _creakT = 0; sfx.creak(); } }

  function draw(ctx, w, h) {
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 7, (Math.random() - 0.5) * S.shake * 7);
    drawScene(ctx, w, h);
    drawTarget(ctx);
    drawArrow3D(ctx);
    if (parts) parts.draw(ctx);
    drawBow(ctx, w, h);
    drawSight(ctx);
    /* mensagem central */
    if (S.msgT > 0 && S.msg) {
      ctx.globalAlpha = Math.min(1, S.msgT * 2);
      ctx.font = `800 ${Math.min(34, w * 0.06)}px ${getComputedStyle(document.body).getPropertyValue('--font-head') || 'sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = S.msgCol || '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10;
      ctx.fillText(S.msg, w / 2, h * 0.3);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ══ UI / DOM ══════════════════════════════════════════════════ */
  function starsHTML(n, tot) { return '★'.repeat(n) + '<span class="arch-star-off">' + '★'.repeat((tot || 3) - n) + '</span>'; }

  function renderMenu() {
    seq++;
    stopEngine();
    S = null;
    const p = progress();
    const st = (typeof GameProgress !== 'undefined') ? GameProgress.stats('archery') : { plays: 0 };
    const bestE = (typeof GameProgress !== 'undefined') ? (GameProgress.bestScore('archery', 'endless-' + diff()) || 0) : 0;
    const totStars = Object.values(p.stars).reduce((a, b) => a + b, 0);
    root.innerHTML = `
    <div class="arch-wrap">
      <div class="arch-menu">
        <div class="arch-logo"><span class="arch-logo-ico">🏹</span>
          <h2>${t('title')}</h2><p>${t('tagline')}</p></div>
        ${st.plays ? `<div class="arch-stats">
          <div><b>${totStars}</b><span>★ / ${LEVELS.length * 3}</span></div>
          <div><b>${p.unlocked}/${LEVELS.length}</b><span>${t('level')}</span></div>
          <div><b>${bestE}</b><span>${t('endless').replace(/^\S+\s/, '')} · ${t('best')}</span></div>
        </div>` : ''}
        <div class="arch-menu-sec">${t('campaign')}</div>
        <div class="arch-lvl-grid">
          ${LEVELS.map((L, i) => {
            const locked = i > p.unlocked;
            const s = p.stars[i] || 0;
            return `<button class="arch-lvl${locked ? ' locked' : ''}" data-lvl="${i}" ${locked ? 'disabled' : ''}>
              <span class="arch-lvl-n">${locked ? '🔒' : i + 1}</span>
              <span class="arch-lvl-stars">${locked ? '' : starsHTML(s)}</span>
              <span class="arch-lvl-meta">${L.d}m${L.w ? ' · 💨' : ''}${L.mv ? ' · ↔' : ''}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="arch-menu-btns">
          <button class="arch-btn primary" id="arch-endless">${t('endless')} <small>${bestE ? `· ${t('best')}: ${bestE}` : ''}</small></button>
          <button class="arch-btn ghost" id="arch-howto">${t('howto')}</button>
        </div>
      </div>
    </div>`;
    root.querySelectorAll('[data-lvl]').forEach(b => b.addEventListener('click', () => newGame('camp', +b.dataset.lvl)));
    root.querySelector('#arch-endless').addEventListener('click', () => newGame('endless'));
    root.querySelector('#arch-howto').addEventListener('click', openHowto);
  }

  function openHowto() {
    const back = document.createElement('div');
    back.className = 'arch-overlay';
    back.innerHTML = `<div class="arch-modal">
      <h3>🏹 ${t('howto')}</h3>
      <ol class="arch-tut">
        <li>${t('tut1')}</li><li>${t('tut2')}</li><li>${t('tut3')}</li><li>${t('tut4')}</li>
      </ol>
      <div class="arch-modal-btns"><button class="arch-btn primary" id="arch-t-ok">OK</button></div>
    </div>`;
    root.appendChild(back);
    back.querySelector('#arch-t-ok').addEventListener('click', () => back.remove());
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
  }

  function renderGame() {
    root.innerHTML = `
    <div class="arch-wrap">
      <div class="arch-hud">
        <button class="arch-ibtn" id="arch-back" aria-label="${t('back')}">✕</button>
        <div class="arch-hud-item"><span class="arch-hud-k">${t('score')}</span><b id="arch-score">0</b></div>
        <div class="arch-hud-item"><span class="arch-hud-k">${S.mode === 'camp' ? t('arrows') : t('hits')}</span><b id="arch-arrows"></b></div>
        <div class="arch-hud-item"><span class="arch-hud-k">${t('dist')}</span><b id="arch-dist"></b></div>
        <div class="arch-hud-item arch-wind"><span class="arch-hud-k">${t('wind')}</span><b id="arch-wind"></b></div>
        ${S.mode === 'camp' ? `<div class="arch-hud-item"><span class="arch-hud-k">${t('level')}</span><b>${S.lvlIdx + 1} · ${t('lvls')[S.lvlIdx] || ''}</b></div>` : ''}
      </div>
      <div class="arch-stage"><canvas id="arch-cv" aria-label="${t('title')}"></canvas></div>
      <div class="arch-hint" id="arch-hint">${t('draw')}</div>
    </div>`;
    root.querySelector('#arch-back').addEventListener('click', renderMenu);
    const cv = root.querySelector('#arch-cv');
    startEngine(cv);
    wireInput(cv);
    updateHUD();
  }

  function setHint(msg) { const el = root.querySelector('#arch-hint'); if (el) el.textContent = msg || ''; }

  function updateHUD() {
    if (!S || !root) return;
    const $ = id => root.querySelector(id);
    $('#arch-score') && ($('#arch-score').textContent = S.score);
    if ($('#arch-arrows')) $('#arch-arrows').textContent = S.mode === 'camp'
      ? '➳'.repeat(Math.max(0, S.arrowsLeft)) || '0'
      : `${S.targets} · ${'♥'.repeat(Math.max(0, 3 - S.misses))}`;
    $('#arch-dist') && ($('#arch-dist').textContent = Math.round(S.dist) + 'm');
    if ($('#arch-wind')) {
      const wv = Math.abs(S.wind).toFixed(1);
      $('#arch-wind').textContent = S.wind === 0 ? '—' : `${S.wind < 0 ? '←' : '→'} ${wv} m/s`;
      $('#arch-wind').style.color = Math.abs(S.wind) >= 4 ? 'var(--red,#ef4444)' : Math.abs(S.wind) >= 2 ? 'var(--amber,#f2b344)' : '';
    }
  }

  /* ── input (pointer events: rato + touch iguais) ── */
  function wireInput(cv) {
    const pos = e => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    cv.addEventListener('pointerdown', e => {
      if (!S || S.state !== 'aim') return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      [S.px, S.py] = pos(e);
      S.aimX = S.px; S.aimY = S.py;
      S.state = 'draw'; S.power = 0; S.holdT = 0;
      sfx.nock();
    });
    cv.addEventListener('pointermove', e => {
      if (!S) return;
      [S.px, S.py] = pos(e);
    });
    const release = e => {
      if (!S || S.state !== 'draw') return;
      e.preventDefault();
      fire();
    };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', () => { if (S && S.state === 'draw') { S.state = 'aim'; S.power = 0; } });
  }

  /* ── fim (overlay) ── */
  function showEnd(r) {
    const back = document.createElement('div');
    back.className = 'arch-overlay';
    back.innerHTML = `<div class="arch-modal">
      <h3>${r.title}</h3>
      ${r.stars !== undefined ? `<div class="arch-end-stars">${starsHTML(r.stars)}</div>` : ''}
      <div class="arch-end-score">${r.score} ${t('score').toLowerCase()}${r.targets !== undefined ? ` · ${r.targets} ${t('hits')}` : ''}</div>
      ${r.goal ? `<div class="arch-end-goal">${t('goal')}: ★ ${r.goal[0]} · ★★ ${r.goal[1]} · ★★★ ${r.goal[2]}</div>` : ''}
      ${r.newBest ? `<div class="arch-end-best">${t('newBest')}</div>` : ''}
      <div class="arch-modal-btns">
        <button class="arch-btn ghost" id="arch-e-menu">${t('menu')}</button>
        <button class="arch-btn ghost" id="arch-e-retry">${t('retry')}</button>
        ${r.canNext ? `<button class="arch-btn primary" id="arch-e-next">${t('next')}</button>` : ''}
      </div>
    </div>`;
    root.appendChild(back);
    back.querySelector('#arch-e-menu').addEventListener('click', renderMenu);
    back.querySelector('#arch-e-retry').addEventListener('click', () => { back.remove(); newGame(S.mode, S.lvlIdx); });
    back.querySelector('#arch-e-next')?.addEventListener('click', () => { back.remove(); newGame('camp', S.lvlIdx + 1); });
  }

  /* ── engine lifecycle ── */
  function startEngine(cv) {
    stopEngine();
    parts = (typeof Particles !== 'undefined') ? Particles.create() : null;
    eng = CanvasEngine.create(cv, { update, draw });
    eng.start();
  }
  function stopEngine() {
    if (eng) { eng.destroy(); eng = null; }
    parts = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (!eng) return;
    if (document.hidden) eng.stop(); else eng.start();
  });
  document.addEventListener('routechange', e => {
    const h = (e.detail || '');
    /* ao sair da rota, volta ao menu (para o RAF e evita um canvas morto
       quando o utilizador regressar — o GameHost só chama init uma vez) */
    if (S && root && h !== 'games/archery') renderMenu();
  });

  /* ── conquistas ── */
  if (typeof GameProgress !== 'undefined') {
    GameProgress.defineAchievements('archery', [
      { id: 'arch.bull',   name: 'Na Mosca',        icon: '🎯', desc: 'Acerta em cheio no centro do alvo.',            test: c => c.gameId === 'archery' && c.result.meta && c.result.meta.bull },
      { id: 'arch.three',  name: 'Perfecionista',   icon: '⭐', desc: 'Consegue 3 estrelas num nível.',                test: c => c.gameId === 'archery' && c.result.meta && c.result.meta.threeStars },
      { id: 'arch.wind',   name: 'Contra o Vento',  icon: '💨', desc: 'Um 10 com vento de 4 m/s ou mais.',             test: c => c.gameId === 'archery' && c.result.meta && c.result.meta.windBull },
      { id: 'arch.far',    name: 'Olho de Falcão',  icon: '🦅', desc: 'Uma mosca a 50 metros ou mais.',                test: c => c.gameId === 'archery' && c.result.meta && c.result.meta.farBull },
      { id: 'arch.camp',   name: 'Arqueiro Mestre', icon: '🏹', desc: 'Termina a campanha completa.',                  test: c => c.gameId === 'archery' && c.result.meta && c.result.meta.campaignDone },
      { id: 'arch.run15',  name: 'Sangue Frio',     icon: '🧊', desc: 'Atinge 15 alvos numa corrida Sem Fim.',         test: c => c.gameId === 'archery' && c.result.meta && c.result.meta.endless && c.result.meta.targetsHit >= 15 },
    ]);
  }

  /* ── css ── */
  function injectCSS() {
    if (document.getElementById('archery-css')) return;
    const s = document.createElement('style'); s.id = 'archery-css';
    s.textContent = `
.arch-wrap{display:flex;flex-direction:column;gap:10px;max-width:960px;margin:0 auto;user-select:none;-webkit-user-select:none}
.arch-stage{position:relative;border-radius:16px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,.1));box-shadow:0 10px 30px rgba(0,0,0,.35)}
.arch-stage canvas{display:block;width:100%;height:min(58vh,520px);min-height:300px;touch-action:none;cursor:crosshair}
.arch-hud{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--card,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.1));border-radius:12px;padding:7px 12px}
.arch-hud-item{display:flex;flex-direction:column;min-width:0}
.arch-hud-k{font-size:.6rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted,#9aa);font-weight:700}
.arch-hud-item b{font-family:var(--font-mono,monospace);font-size:.95rem;white-space:nowrap}
.arch-ibtn{width:34px;height:34px;border-radius:9px;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--card2,rgba(255,255,255,.05));color:var(--text,#eee);cursor:pointer}
.arch-ibtn:hover{border-color:var(--accent,#6366f1)}
.arch-hint{text-align:center;font-size:.82rem;color:var(--muted,#9aa);min-height:1.2em}

.arch-menu{width:min(680px,100%);margin:0 auto;display:flex;flex-direction:column;gap:14px;background:var(--card,rgba(255,255,255,.04));border:1px solid var(--border,rgba(255,255,255,.08));border-radius:20px;padding:24px}
.arch-logo{text-align:center}
.arch-logo-ico{font-size:2.6rem;display:block;filter:drop-shadow(0 4px 14px rgba(242,179,68,.35))}
.arch-logo h2{margin:6px 0 4px;font-size:1.6rem}
.arch-logo p{margin:0;color:var(--muted,#9aa);font-size:.86rem}
.arch-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}
.arch-stats>div{background:rgba(255,255,255,.04);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:10px;padding:8px 4px}
.arch-stats b{display:block;font-size:1.05rem;color:var(--accent,#8b8bf1)}
.arch-stats span{font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#9aa)}
.arch-menu-sec{font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#9aa)}
.arch-lvl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}
.arch-lvl{display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;color:var(--text,#eee);background:var(--card2,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.1));border-radius:12px;padding:9px 4px;cursor:pointer;transition:all .15s}
.arch-lvl:not(.locked):hover{transform:translateY(-2px);border-color:var(--accent,#6366f1)}
.arch-lvl.locked{opacity:.45;cursor:default}
.arch-lvl-n{font-family:var(--font-head,inherit);font-weight:800;font-size:1.05rem}
.arch-lvl-stars{font-size:.72rem;color:#f2b344;letter-spacing:.05em;min-height:1em}
.arch-star-off{color:rgba(255,255,255,.18)}
.arch-lvl-meta{font-size:.6rem;color:var(--muted,#9aa)}
.arch-menu-btns{display:flex;flex-direction:column;gap:8px}
.arch-btn{border-radius:12px;border:1px solid var(--border,rgba(255,255,255,.14));background:var(--card2,rgba(255,255,255,.06));color:var(--text,#eee);padding:12px 18px;font-size:.95rem;font-weight:700;cursor:pointer;transition:transform .12s,border-color .2s;font-family:inherit}
.arch-btn:hover{transform:translateY(-1px);border-color:var(--accent,#6366f1)}
.arch-btn.primary{background:linear-gradient(135deg,var(--accent,#6366f1),var(--accent2,#8b5cf6));border:0;color:#fff}
.arch-btn.ghost{background:transparent}
.arch-btn small{font-weight:500;opacity:.8}

.arch-overlay{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:14px;border-radius:14px}
.arch-modal{width:min(420px,100%);background:var(--card-solid,var(--card,#171a2e));border:1px solid var(--border,rgba(255,255,255,.1));border-radius:18px;padding:22px;text-align:center}
.arch-modal h3{margin:0 0 10px;font-size:1.15rem}
.arch-modal-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}
.arch-end-stars{font-size:2rem;color:#f2b344;letter-spacing:.12em;margin:4px 0}
.arch-end-score{font-family:var(--font-mono,monospace);font-size:1.3rem;font-weight:800}
.arch-end-goal{font-size:.75rem;color:var(--muted,#9aa);margin-top:6px}
.arch-end-best{margin-top:8px;font-weight:800;color:#f2b344}
.arch-tut{text-align:left;margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:.55rem;font-size:.86rem;line-height:1.55;color:var(--text2,#ccc)}

.arch-wrap{position:relative}
@media (max-width:640px){
  .arch-stage canvas{height:52vh;min-height:280px}
  .arch-hud{gap:8px;padding:6px 9px}
  .arch-hud-item b{font-size:.85rem}
  .arch-lvl-grid{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
}
@media (max-height:520px) and (orientation:landscape){
  .arch-stage canvas{height:calc(100vh - 150px);min-height:220px}
}`;
    document.head.appendChild(s);
  }

  /* ── init ── */
  function init(r) {
    root = r; if (!root) return;
    injectCSS();
    if (_hasGD) GameData.load('archery').then(d => { if (t.use) t.use(d.i18n); renderMenu(); }).catch(() => renderMenu());
    else renderMenu();
  }

  /* hooks mínimos para o harness (_archery_harness.html): o virtual-time
     do headless-Chrome avança timers mas NÃO intercala rAF, por isso o
     harness usa _step como relógio do loop em vez do CanvasEngine */
  function _debug() { return S ? { state: S.state, power: +S.power.toFixed(2), arrows: S.arrowsLeft, score: S.score, dist: S.dist } : null; }
  function _step(dt) { if (S && eng) update(dt); }

  return { init, _debug, _step };
})();
