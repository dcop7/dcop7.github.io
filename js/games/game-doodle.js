/* ══════════════════════════════════════════════════════════════════
   Traço a Traço (id doodle) — puzzles de física desenhada (out/2026).

   Desenha com o dedo (ou o rato): cada traço ganha peso e cai, rola e
   choca com o resto. Leva a Bolota até à estrela, junta-a à Lua, enche
   o cesto, protege o ovo… com o lápis, pinos e cordas.

   Camadas: um canvas em cache com o papel e o cenário fixo (refeito só
   quando muda o tamanho ou abre uma porta) + o canvas do kit com tudo o
   que mexe. A física corre a passo fixo (DoodleSim, 60 Hz) e o desenho
   interpola entre os dois últimos passos — fica suave a 120/144 Hz.
══════════════════════════════════════════════════════════════════ */
const DoodleGame = (function () {
  'use strict';
  const ID = 'doodle';
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  const LV = () => DoodleLevels.LEVELS;
  const VW = 480, VH = 720;
  const INK = ['#2f6bff', '#ff4f6d', '#13a77a', '#ff9f1c', '#8b5cf6', '#00a6c8'];
  const INK_D = ['#1a3fa8', '#b8243f', '#0b6e50', '#c26f00', '#5b33b8', '#00708a'];
  const TERR = [
    { a: '#3b4150', b: '#262a35', e: '#171a22' },
    { a: '#2f4a52', b: '#1d3138', e: '#0f1d22' },
    { a: '#4a3b52', b: '#302438', e: '#1c1422' },
    { a: '#4f4433', b: '#342b1f', e: '#1e1810' },
    { a: '#2f4a3a', b: '#1d3226', e: '#0f1f16' },
    { a: '#523b3b', b: '#382424', e: '#221414' },
  ];

  const SKEY = 'doodle:save';
  const save = () => { try { return Object.assign({ s: {} }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { s: {} }; } };
  const putSave = v => { try { localStorage.setItem(SKEY, JSON.stringify(v)); } catch (e) {} };
  const unlocked = (sv, i) => i === 0 || sv.s[LV()[i - 1].id] != null || sv.s[LV()[i].id] != null;

  function hash(n) { n = Math.imul(n ^ 0x27d4eb2d, 0x165667b1); n ^= n >>> 15; return ((Math.imul(n, 0x2c1b3c6d) >>> 0) % 10000) / 10000; }
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpA = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
  const backOut = t => { const c = 1.9; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; };
  /* entrada dos objetos no início do nível: "pop" escalonado */
  const appear = (G, d) => G.api.reduced ? 1 : backOut(clamp((G.t - .1 - (d || 0)) / .45, 0, 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* caminho suave por pontos médios (traços e pré-visualização) */
  function smoothPath(ctx, P, closed) {
    if (!P.length) return;
    if (P.length < 3) { ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); if (closed) ctx.closePath(); return; }
    if (closed) {
      const n = P.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let s = m(P[n - 1], P[0]); ctx.moveTo(s[0], s[1]);
      for (let i = 0; i < n; i++) { const q = m(P[i], P[(i + 1) % n]); ctx.quadraticCurveTo(P[i][0], P[i][1], q[0], q[1]); }
      ctx.closePath(); return;
    }
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
  }
  function starPath(ctx, r, ri) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
  /* salpicos multicolores (o sistema de partículas só aceita uma cor por rajada); sem brilho aditivo — no papel claro não se via */
  function pop(api, x, y, n, o) {
    const cs = o.colors || [o.color || '#fff'];
    cs.forEach(c => api.burst(x, y, Math.max(1, Math.round(n / cs.length)), Object.assign({ glow: false, gravity: 380, drag: 2 }, o, { color: c, colors: undefined })));
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  /* ════════════════════════════════════════════════════════════════
     sessão
  ════════════════════════════════════════════════════════════════ */
  function setup(api, o) {
    const li = clamp(parseInt(o.mode, 10) || 0, 0, LV().length - 1);
    const L = LV()[li];
    const G = { api, li, L, S: null, acts: [], tool: 'pen', pen: null, rope: null, freeze: false, acc: 0, alpha: 1, t: 0,
      fx: [], hfx: new Map(), cache: null, cacheK: 0, hintT: 0, hintN: 1, endT: 0, ended: false, settleT: 0, lastBlock: null, scribT: 0, look: {} };
    build(G, [], !!L.plan);
    return G;
  }
  /* (re)constrói o mundo e repõe ações gravadas (desfazer / ajustar o desenho) */
  function build(G, acts, frozen) {
    G.S = DoodleSim.create(G.L);
    G.acts = [];
    acts.forEach(a => { if (DoodleSim.apply(G.S, a)) G.acts.push(a); });
    G.S.ev.length = 0;
    G.S.items.forEach(it => { if (it.k === 'stroke') it.born = -9; });
    G.freeze = !!frozen; G.acc = 0; G.alpha = 1; G.ended = false; G.endT = 0; G.settleT = 0; G.settledTip = false;
    G.hfx.clear(); G.fx.length = 0; G.cache = null;
    if (G.ui) syncUI(G);
  }

  /* ── camadas e botões ── */
  function stageUI(G, api) {
    const st = api.stage;
    if (!document.getElementById('dd-css')) {
      const s = document.createElement('style'); s.id = 'dd-css';
      s.textContent = `.dd-bar{position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;justify-content:space-between;align-items:flex-end;padding:10px;pointer-events:none}
.dd-g{display:flex;gap:clamp(4px,1.6vw,7px);pointer-events:auto}
.dd-b{position:relative;width:clamp(38px,10.6vw,46px);height:clamp(38px,10.6vw,46px);border-radius:15px;border:2px solid #23202b;background:#fffdf6;color:#23202b;font-size:1.15rem;cursor:pointer;display:grid;place-items:center;box-shadow:0 3px 0 #23202b;transition:transform .12s cubic-bezier(.3,1.6,.5,1),box-shadow .12s,background .15s;padding:0}
.dd-b:active{transform:translateY(3px);box-shadow:0 0 0 #23202b}
.dd-b.on{background:var(--dd-ink,#2f6bff);color:#fff;transform:translateY(-3px);box-shadow:0 6px 0 #23202b}
.dd-b[disabled]{opacity:.35;cursor:not-allowed}
.dd-b[hidden]{display:none}
.dd-b svg{width:24px;height:24px}
.dd-b em{position:absolute;top:-7px;right:-7px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;background:#23202b;color:#fff;font:800 .68rem/19px ${FONT};font-style:normal}
.dd-b.go{background:#ffd23f}
.dd-tip{position:absolute;left:50%;transform:translateX(-50%);z-index:4;max-width:min(86%,380px);background:#23202b;color:#fffdf6;border-radius:14px;padding:7px 14px;font:600 .78rem/1.35 ${FONT};text-align:center;pointer-events:none;transition:opacity .35s,transform .35s;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.dd-tip.off{opacity:0;transform:translateX(-50%) translateY(6px)}
@media (prefers-reduced-motion:reduce){.dd-b,.dd-tip{transition:none}}`;
      document.head.appendChild(s);
    }
    const ico = {
      pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M14.5 6.2l3.3 3.3"/></svg>',
      pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="5"/><path d="M12 13v8"/></svg>',
      rope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M6.6 7.6c3 5 7.5 1.8 10.8 8.8" stroke-dasharray="3 2.4"/></svg>',
      undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/></svg>',
      pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
      play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
      hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
      reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>',
      fast: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6.2v11.6a.9.9 0 0 0 1.4.75L12 13.4v4.4a.9.9 0 0 0 1.4.75l8.3-5.8a.9.9 0 0 0 0-1.5l-8.3-5.8A.9.9 0 0 0 12 6.2v4.4L4.4 5.45A.9.9 0 0 0 3 6.2z"/></svg>',
    };
    G.ico = ico;
    const L = G.L;
    const ui = document.createElement('div'); ui.className = 'dd-bar';
    ui.innerHTML = `<div class="dd-g">
        <button class="dd-b on" data-t="pen" aria-label="Lápis" title="Lápis: desenha formas">${ico.pen}</button>
        ${L.pins ? `<button class="dd-b" data-t="pin" aria-label="Pino" title="Pino: prende uma peça ao fundo ou duas peças entre si">${ico.pin}<em></em></button>` : ''}
        ${L.ropes ? `<button class="dd-b" data-t="rope" aria-label="Corda" title="Corda: arrasta de um ponto a outro">${ico.rope}<em></em></button>` : ''}
      </div><div class="dd-g">
        <button class="dd-b" data-a="undo" aria-label="Desfazer" title="Desfazer (antes de o mundo se mexer ou em pausa)">${ico.undo}</button>
        <button class="dd-b" data-a="freeze" aria-label="Pausa da física" title="Parar o tempo para desenhar com calma">${ico.pause}</button>
        <button class="dd-b" data-a="fast" aria-label="Acelerar" title="Acelerar o tempo (2×)">${ico.fast}</button>
        <button class="dd-b" data-a="hint" aria-label="Dica" title="Dica">${ico.hint}</button>
        <button class="dd-b" data-a="reset" aria-label="Recomeçar o nível" title="Recomeçar">${ico.reset}</button>
      </div>`;
    st.appendChild(ui); G.ui = ui;
    ui.addEventListener('pointerdown', e => e.stopPropagation());
    ui.addEventListener('click', e => {
      const t = e.target.closest('[data-t]'), a = e.target.closest('[data-a]');
      if (t) { G.tool = t.dataset.t; G.pen = G.rope = null; api.sfx.tone(t.dataset.t === 'pen' ? 660 : t.dataset.t === 'pin' ? 880 : 520, .06, 'triangle', .04); syncUI(G); return; }
      if (!a) return;
      const k = a.dataset.a;
      if (k === 'reset') { api.sfx.tone(300, .1, 'triangle', .04, 0, 200); build(G, [], !!L.plan); swoosh(G); }
      else if (k === 'undo') undo(G);
      else if (k === 'freeze') toggleFreeze(G);
      else if (k === 'fast') { G.fast = G.fast === 2 ? 1 : 2; api.sfx.tone(G.fast === 2 ? 880 : 440, .08, 'triangle', .04, 0, G.fast === 2 ? 1320 : 330); syncUI(G); }
      else if (k === 'hint') { G.hintT = 0.001; G.hintN = Math.min((L.sol || []).length, G.hintN + (G.hintShown ? 1 : 0)); G.hintShown = true; api.sfx.tone(988, .08, 'sine', .05); api.sfx.tone(1318, .1, 'sine', .04, .07); }
    });
    syncUI(G);
    if (L.tip) tip(G, L.tip, 7);
  }
  function syncUI(G) {
    const ui = G.ui, S = G.S; if (!ui) return;
    ui.style.setProperty('--dd-ink', INK[S.strokes % INK.length]);
    ui.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === G.tool));
    const pin = ui.querySelector('[data-t="pin"] em'); if (pin) pin.textContent = S.pinsMax - S.pins.filter(p => !p.pre).length;
    const rope = ui.querySelector('[data-t="rope"] em'); if (rope) rope.textContent = S.ropesMax - S.ropes.length;
    const canUndo = G.acts.length > 0 && (!S.started || G.freeze);
    ui.querySelector('[data-a="undo"]').disabled = !canUndo;
    const fb = ui.querySelector('[data-a="freeze"]');
    const playing = S.started && !G.freeze;
    fb.innerHTML = playing ? G.ico.pause : G.ico.play;
    fb.classList.toggle('go', !playing && (G.freeze || G.acts.length > 0));
    fb.setAttribute('aria-label', playing ? 'Parar o tempo' : 'Pôr o mundo a mexer');
    fb.title = playing ? 'Parar o tempo para desenhar com calma' : 'Pôr o mundo a mexer';
    ui.querySelector('[data-a="fast"]').classList.toggle('on', G.fast === 2);
  }
  function tip(G, text, dur) {
    const st = G.api.stage;
    let el = st.querySelector('.dd-tip');
    if (!el) { el = document.createElement('div'); el.className = 'dd-tip off'; st.appendChild(el); }
    el.innerHTML = text;
    const m = G.map || { s: Math.min(st.clientWidth / VW, st.clientHeight / VH), oy: 0 };
    el.style.bottom = Math.round(Math.max(0, st.clientHeight - (m.oy + VH * m.s)) + 70 * m.s) + 'px';
    requestAnimationFrame(() => el.classList.remove('off'));
    clearTimeout(G._tip); G._tip = setTimeout(() => el.classList.add('off'), (dur || 4) * 1000);
  }
  function hideTip(G, ms) { clearTimeout(G._tip); G._tip = setTimeout(() => { const el = G.api.stage.querySelector('.dd-tip'); el && el.classList.add('off'); }, ms || 0); }

  function undo(G) {
    const S = G.S;
    if (!G.acts.length || (S.started && !G.freeze)) return;
    const keep = G.acts.slice(0, -1);
    const wasStarted = S.started;
    /* antes de começar: reconstrói e repõe; em pausa a meio, só dá para tirar o que se fez durante a pausa */
    if (wasStarted) {
      const last = G.acts[G.acts.length - 1];
      if (!last.paused) { tip(G, 'Só dá para desfazer o que desenhaste nesta pausa.', 3); return; }
      removeLast(G); return;
    }
    build(G, keep, G.freeze);
    G.api.sfx.tone(520, .07, 'triangle', .04, 0, 300);
  }
  /* desfazer em pausa a meio da corrida: tira o último corpo/junta sem mexer no resto */
  function removeLast(G) {
    const S = G.S, a = G.acts.pop();
    if (a.it && a.it.b) { S.w.destroyBody(a.it.b); a.it.gone = true; a.it.b = null; S.items.splice(S.items.indexOf(a.it), 1); S.ink -= a.ink || 0; S.strokes--; S.pins.forEach(p => { if (p.on === a.it) { p.on = null; p.free = true; } }); S.ropes = S.ropes.filter(r => { if (r.A === a.it || r.B === a.it) { r.dead = true; return false; } return true; }); }
    else if (a.pn) { destroyJointAt(S, a.pn.joint); S.pins.splice(S.pins.indexOf(a.pn), 1); }
    else if (a.r) { S.w.destroyJoint(a.r.j); S.ropes.splice(S.ropes.indexOf(a.r), 1); S.ink -= a.r.len; S.strokes--; }
    G.api.sfx.tone(520, .07, 'triangle', .04, 0, 300);
    syncUI(G);
  }
  function destroyJointAt(S, j) { if (j) try { S.w.destroyJoint(j); } catch (e) {} }
  function toggleFreeze(G) {
    const S = G.S;
    if (S.started && !G.freeze) { G.freeze = true; G.api.sfx.tone(440, .12, 'sine', .05, 0, 220); }
    else { G.freeze = false; G.acts.forEach(a => a.paused = false); if (!S.started) DoodleSim.start(S); G.api.sfx.tone(330, .12, 'sine', .05, 0, 660); swoosh(G); }
    hideTip(G, 300);
    syncUI(G);
  }
  function swoosh(G) { G.api.sfx.noise(.25, .04, 0, 1800, 'bandpass'); }

  /* ════════════════════════════════════════════════════════════════
     entrada
  ════════════════════════════════════════════════════════════════ */
  const live = G => !G.S.won && !G.S.lost && !G.ended;
  /* ecrã → lógico com o MESMO mapeamento do kit (lido da transformação do desenho) */
  function toLog(G, e) {
    const m = G.map, cv = G.api.stage.querySelector('.ak-cv');
    if (!m || !cv) return [0, 0];
    const r = cv.getBoundingClientRect(), fx = cv.clientWidth / r.width || 1, fy = cv.clientHeight / r.height || 1;
    return [((e.clientX - r.left) * fx - m.ox) / m.s, ((e.clientY - r.top) * fy - m.oy) / m.s];
  }
  function down(G, x, y, api) {
    if (!live(G)) return;
    hideTip(G, 600);
    const S = G.S;
    if (G.tool === 'pin') {
      const pn = DoodleSim.addPin(S, x, y);
      if (!pn) { refuse(G, x, y, S.pins.filter(p => !p.pre).length >= S.pinsMax ? 'Já não tens pinos.' : 'Aí não dá para pôr um pino.'); return; }
      pn.born = G.t;
      const a = { pin: [x, y], pn, paused: S.started };
      G.acts.push(a);
      api.sfx.tone(1400, .04, 'square', .05); api.sfx.tone(700, .08, 'triangle', .05, .03); api.vibe(12);
      G.fx.push({ k: 'ring', x, y, t: 0, life: .4, c: '#e23b3b' });
      committed(G);
      return;
    }
    if (G.tool === 'rope') { G.rope = { a: [x, y], b: [x, y] }; api.sfx.tone(400, .05, 'triangle', .03); return; }
    const why = DoodleSim.blocked(S, x, y);
    if (why) { refuse(G, x, y, why === 'zone' ? 'Não podes desenhar na zona riscada.' : null); return; }
    if (DoodleSim.inkLeft(S) < 4) { refuse(G, x, y, 'Acabou a tinta! Recomeça ↻ ou desfaz ↶.'); return; }
    G.pen = { pts: [[x, y]], sm: [x, y], len: 0, dead: false, col: S.strokes % INK.length };
  }
  function penAdd(G, x, y) {
    const P = G.pen, S = G.S;
    /* estabilizador leve: o traço fica limpo mesmo com o dedo a tremer */
    P.sm[0] = lerp(P.sm[0], x, .6); P.sm[1] = lerp(P.sm[1], y, .6);
    const q = P.pts[P.pts.length - 1], d = Math.hypot(P.sm[0] - q[0], P.sm[1] - q[1]);
    if (d < 3) return;
    const n = Math.ceil(d / 4), left = DoodleSim.inkLeft(S);
    for (let k = 1; k <= n; k++) {
      const px = q[0] + (P.sm[0] - q[0]) * k / n, py = q[1] + (P.sm[1] - q[1]) * k / n;
      const l = Math.hypot(px - P.pts[P.pts.length - 1][0], py - P.pts[P.pts.length - 1][1]);
      if (P.len + l > left) { P.dead = 'ink'; break; }
      const bl = DoodleSim.blocked(S, px, py);
      if (bl) { P.dead = bl; G.lastBlock = { x: px, y: py, t: 0, zone: bl === 'zone' }; break; }
      P.len += l; P.pts.push([px, py]);
    }
    /* risco do lápis: ruído curto a cada ~14 px */
    G.scribT += d;
    if (G.scribT > 14) { G.scribT = 0; G.api.sfx.noise(.035, .025, 0, 2400 + Math.random() * 1600, 'bandpass'); }
    if (P.dead) commitPen(G);
  }
  function move(G, x, y, api, e, pressed) {
    G.cursor = [x, y]; G.mouse = !e || e.pointerType === 'mouse';
    if (!pressed || !live(G)) return;
    if (G.rope) { G.rope.b = [x, y]; return; }
    if (!G.pen || G.pen.dead) return;
    const evs = e && e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (evs && evs.length > 1) evs.forEach(ev => { if (G.pen && !G.pen.dead) { const p = toLog(G, ev); penAdd(G, p[0], p[1]); } });
    else penAdd(G, x, y);
  }
  function up(G, x, y, api) {
    if (G.rope) {
      const R = G.rope; G.rope = null;
      if (!live(G)) return;
      const r = DoodleSim.addRope(G.S, R.a, R.b);
      if (!r) { refuse(G, R.b[0], R.b[1], G.S.ropes.length >= G.S.ropesMax ? 'Já não tens cordas.' : 'A corda tem de prender pelo menos uma peça que se mexe.'); return; }
      r.born = G.t;
      G.acts.push({ rope: [R.a, R.b], r, paused: G.S.started });
      api.sfx.tone(196, .25, 'triangle', .06, 0, 230); api.sfx.tone(392, .12, 'sine', .03, .02); api.vibe(10);
      committed(G);
      return;
    }
    if (G.pen && !G.pen.dead) { penAdd(G, x, y); commitPen(G); }
    G.pen = null;
  }
  function commitPen(G) {
    const P = G.pen; if (!P) return;
    P.dead = P.dead || 'up';
    const S = G.S, api = G.api;
    if (!P.pts.length) { G.pen = null; return; }
    const it = DoodleSim.addStroke(S, P.pts, { col: P.col });
    if (!it) { G.pen = null; return; }
    it.born = G.t;
    G.acts.push({ d: P.pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]), it, ink: it.dot ? 12 : DoodleSim.pathLen(P.pts), paused: S.started });
    /* som e salpicos: forma fechada soa mais "cheia" */
    if (it.poly) { api.sfx.tone(260, .16, 'sine', .07, 0, 180); api.sfx.tone(520, .1, 'triangle', .04, .02); }
    else if (it.dot) api.sfx.tone(880, .07, 'sine', .05, 0, 660);
    else api.sfx.tone(560 + Math.min(300, P.len), .09, 'triangle', .05, 0, 420);
    api.vibe(8);
    const e = P.pts[P.pts.length - 1];
    pop(api, e[0], e[1], 7, { colors: [INK[P.col], INK_D[P.col], '#ffffff'], speed: 90, life: .45, size: 3 });
    if (P.dead === 'ink') { refuse(G, e[0], e[1], 'Acabou a tinta!'); }
    G.pen = null;
    committed(G);
  }
  function committed(G) {
    const S = G.S;
    if (!S.started && !G.freeze) { DoodleSim.start(S); swoosh(G); }
    syncUI(G);
  }
  function refuse(G, x, y, msg) {
    G.fx.push({ k: 'no', x, y, t: 0, life: .5 });
    G.api.sfx.tone(180, .1, 'square', .035, 0, 140); G.api.vibe(25);
    if (msg) tip(G, msg, 2.4);
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt;
    if (!G.ui) stageUI(G, api);
    const S = G.S, DT = DoodleSim.DT;
    if (S.started && !G.freeze && !S.done) {
      G.acc = Math.min(G.acc + dt * (G.fast || 1), .1 * (G.fast || 1));
      while (G.acc >= DT && !S.done) { DoodleSim.step(S); heroFx(G); G.acc -= DT; }
      G.alpha = clamp(G.acc / DT, 0, 1);
    } else G.alpha = 1;
    events(G, api);
    /* molas visuais dos heróis (esmagar e esticar) */
    G.hfx.forEach(h => { const a = -260 * h.v - 15 * h.vv; h.vv += a * dt; h.v += h.vv * dt; h.v = clamp(h.v, -.3, .35); h.blink = (h.blink || 0) - dt; if (h.blink < -.14) h.blink = 1.5 + Math.random() * 3.5; });
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; if (f.t >= f.life) G.fx.splice(i, 1); }
    if (G.lastBlock) { G.lastBlock.t += dt; if (G.lastBlock.t > .5) G.lastBlock = null; }
    if (G.hintT) { G.hintT += dt; if (G.hintT > 7) G.hintT = 0; }
    /* fim */
    if (!G.ended && S.won && (S.done || S.t - S.winT > 1.2)) { G.ended = true; finish(G, api, true); }
    if (!G.ended && S.lost) { G.endT += dt; if (G.endT > 1) { G.ended = true; finish(G, api, false); } }
    /* tudo parado sem ganhar: sugere continuar a desenhar */
    if (S.started && !G.freeze && !S.won && !S.lost) {
      if (S.frame % 15 === 0) G.settleT = DoodleSim.settled(S) ? G.settleT + .25 : 0;
      if (G.settleT > 2.5 && !G.settledTip) { G.settledTip = true; tip(G, 'Tudo parado… desenha mais qualquer coisa ou recomeça ↻.', 4); }
    }
  }
  /* impacto nos heróis: variação brusca de velocidade → esmaga + pó + som */
  function heroFx(G) {
    const S = G.S;
    S.items.forEach(it => {
      if (!it.b || it.gone || (it.role !== 'hero' && it.role !== 'hero2' && it.role !== 'egg' && it.role !== 'ball')) return;
      let h = G.hfx.get(it); if (!h) { h = { v: 0, vv: 0, dir: 0, pv: null, blink: 1 + Math.random() * 2 }; G.hfx.set(it, h); }
      const lv = it.b.getLinearVelocity(), vx = lv.x * 30, vy = lv.y * 30;
      if (h.pv) {
        const dx = vx - h.pv[0], dy = vy - h.pv[1] - 300 / 60, dv = Math.hypot(dx, dy);
        if (dv > 110) {
          const k = Math.min(.3, dv / 1400);
          if (k > h.v * .6) { h.vv = -k * 22; h.dir = Math.atan2(dy, dx); }
          const p = it.b.getPosition(), r = it.r || 14, nx = -dx / dv, ny = -dy / dv;
          if (dv > 180) pop(G.api, p.x * 30 + nx * r, p.y * 30 + ny * r, Math.min(10, dv / 60 | 0), { colors: ['#d8cfbf', '#bfb4a2', '#fffdf6'], speed: 60 + dv * .15, life: .45, size: 2.5 });
          if (G.S.frame - (h.snd || -99) > 6) { h.snd = G.S.frame; G.api.sfx.tone(it.role === 'ball' ? 900 + Math.random() * 300 : 140 + Math.random() * 40, .08, it.role === 'ball' ? 'sine' : 'triangle', Math.min(.08, dv / 4000), 0, it.role === 'ball' ? 700 : 90); }
        }
      }
      h.pv = [vx, vy];
      h.sp = Math.hypot(vx, vy); h.vy = vy;
      /* rasto quando vai depressa */
      if (it.role !== 'ball') { const p = it.b.getPosition(); (h.trail || (h.trail = [])).push([p.x * 30, p.y * 30]); if (h.trail.length > 12) h.trail.shift(); }
    });
  }
  function events(G, api) {
    const S = G.S;
    for (const e of S.ev) {
      if (e.t === 'star') { pop(api, e.st.x, e.st.y, 26, { colors: ['#ffd23f', '#ffb000', '#fff3b0', '#ffffff'], speed: 230, life: .8, size: 4 }); api.sfx.arp([784, 988, 1175, 1568], .06, .12, 'triangle', .06); G.fx.push({ k: 'ring', x: e.st.x, y: e.st.y, t: 0, life: .6, c: '#ffc21a', r: 60 }); }
      else if (e.t === 'win') {
        api.slowmo(.35, .9); api.vibe([20, 40, 30]);
        const at = e.at || { x: VW / 2, y: VH / 2 };
        G.winAt = [at.x, at.y]; G.winT = G.t;
        if (S.L.goal === 'touch') { for (let i = 0; i < 8; i++) G.fx.push({ k: 'heart', x: at.x + (Math.random() - .5) * 30, y: at.y, vx: (Math.random() - .5) * 120, vy: -90 - Math.random() * 120, t: 0, life: 1.4 + Math.random() * .4 }); api.sfx.arp([659, 784, 988, 1319], .07, .14, 'sine', .07); }
        else api.sfx.arp([523, 659, 784, 1046], .06, .14, 'triangle', .06);
        pop(api, at.x, at.y, 34, { colors: INK.concat(['#ffd23f']), speed: 260, life: 1, size: 4 });
      }
      else if (e.t === 'fail') {
        api.sfx.tone(330, .18, 'triangle', .06, 0, 160); api.sfx.tone(160, .3, 'sawtooth', .03, .12, 80); api.shake(6, .3); api.vibe(60);
        if (e.it && e.it.b) { const p = e.it.b.getPosition(); pop(api, clamp(p.x * 30, 10, VW - 10), clamp(p.y * 30, 10, VH - 10), 18, { colors: ['#ffffff', '#ff6b6b', '#23202b'], speed: 200, life: .6 }); }
      }
      else if (e.t === 'gate') { api.sfx.tone(220, .1, 'square', .04); api.sfx.noise(.4, .05, .05, 700); G.cache = null; G.fx.push({ k: 'ring', x: e.g.btn.x, y: e.g.btn.y, t: 0, life: .5, c: '#13a77a' }); }
      else if (e.t === 'rocks') { api.sfx.noise(.6, .05, 0, 400, 'lowpass'); api.shake(3, .4); }
      else if (e.t === 'start') { G.startT = G.t; }
    }
    S.ev.length = 0;
  }

  function finish(G, api, won) {
    const S = G.S, L = G.L, par = L.par || [99, 1e9];
    const stars = won ? DoodleSim.stars(S) : 0;
    if (won) {
      const sv = save(); const prev = sv.s[L.id] != null ? sv.s[L.id] : 0; sv.s[L.id] = Math.max(prev, stars); putSave(sv);
      try { if (typeof GameProgress !== 'undefined') GameProgress.record(ID, { won: true, score: stars * 1000 + Math.max(0, 900 - Math.round(S.ink)), mode: L.id, meta: { stars, level: G.li + 1, strokes: S.strokes } }); } catch (e) {}
    } else { try { if (typeof GameProgress !== 'undefined') GameProgress.record(ID, { won: false, score: 0, mode: L.id }); } catch (e) {} }
    const next = LV()[G.li + 1];
    const plan = G.acts.map(a => a.d ? { d: a.d } : a.pin ? { pin: a.pin } : { rope: a.rope });
    const goals = `<div class="dd-goals" style="display:grid;gap:4px;margin:6px auto 0;max-width:260px;text-align:left;font-size:.82rem">
      <div>${won ? '⭐' : '☆'} Resolver o puzzle</div>
      <div>${won && S.strokes <= par[0] ? '⭐' : '☆'} No máximo ${par[0]} ${par[0] === 1 ? 'traço' : 'traços'} <small style="opacity:.7">(usaste ${S.strokes})</small></div>
      <div>${won && S.ink <= par[1] ? '⭐' : '☆'} Pouca tinta: até ${par[1]} <small style="opacity:.7">(usaste ${Math.round(S.ink)})</small></div></div>`;
    api.panel({
      icon: won ? (stars === 3 ? '🏆' : '✏️') : '💥', title: won ? (stars === 3 ? 'Traço perfeito!' : 'Resolvido!') : 'Quase…',
      stars: won ? stars : null,
      sub: won ? L.name : S.failWhy,
      html: goals,
      buttons: [
        ...(won && next ? [{ label: '▶ Próximo nível', primary: true, fn: () => api.play(String(G.li + 1)) }] : []),
        ...(!won && plan.length ? [{ label: '✏️ Ajustar o desenho', primary: true, fn: () => { api.resume(); build(G, plan, true); tip(G, 'O teu desenho voltou, com o tempo parado. Desfaz ↶, acrescenta e carrega ▶.', 5); } }] : []),
        { label: won ? '↺ Repetir' : '↺ Recomeçar', primary: !won && !plan.length, fn: () => api.restart() },
        { label: 'Escolher nível', fn: () => api.menu() },
      ],
    });
  }

  /* ════════════════════════════════════════════════════════════════
     cenário fixo (cache)
  ════════════════════════════════════════════════════════════════ */
  function paintCache(G, k) {
    const c = G.cache || document.createElement('canvas');
    c.width = Math.round(VW * k); c.height = Math.round(VH * k);
    const x = c.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0);
    const S = G.S, T = TERR[(G.L.chapter || 0) % TERR.length];
    /* papel quadriculado */
    x.fillStyle = '#fbf7ec'; x.fillRect(0, 0, VW, VH);
    x.strokeStyle = 'rgba(70,120,210,.13)'; x.lineWidth = 1;
    x.beginPath(); for (let gx = 12; gx < VW; gx += 24) { x.moveTo(gx, 0); x.lineTo(gx, VH); } for (let gy = 12; gy < VH; gy += 24) { x.moveTo(0, gy); x.lineTo(VW, gy); } x.stroke();
    x.strokeStyle = 'rgba(70,120,210,.07)';
    x.beginPath(); for (let gx = 0; gx < VW; gx += 6) { if (gx % 24 === 12) continue; x.moveTo(gx, 0); x.lineTo(gx, VH); } x.stroke();
    x.strokeStyle = 'rgba(232,90,90,.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(30, 0); x.lineTo(30, VH); x.stroke();
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${hash(i) < .5 ? '120,100,70' : '255,255,255'},${.04 + hash(i + 7) * .06})`; x.fillRect(hash(i + 1) * VW, hash(i + 2) * VH, 1.2, 1.2); }
    const vg = x.createRadialGradient(VW / 2, VH * .45, VH * .3, VW / 2, VH * .5, VH * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,70,40,.16)');
    x.fillStyle = vg; x.fillRect(0, 0, VW, VH);
    /* linha do objetivo "abaixo de" */
    S.items.forEach(it => {
      if (it.k !== 'line') return;
      x.save(); x.setLineDash([10, 8]); x.strokeStyle = 'rgba(226,59,59,.7)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, it.y); x.lineTo(VW, it.y); x.stroke(); x.restore();
      x.fillStyle = 'rgba(226,59,59,.85)'; x.font = `700 11px ${FONT}`; x.fillText(it.label || 'deita abaixo desta linha', 38, it.y - 6);
    });
    /* terreno e blocos fixos */
    const fillMat = (mat, path) => {
      /* orla branca de recorte de papel (autocolante) por baixo de tudo */
      x.save(); path(); x.lineJoin = 'round'; x.strokeStyle = '#fffdf6'; x.lineWidth = 9; x.shadowColor = 'rgba(40,30,20,.22)'; x.shadowBlur = 8; x.shadowOffsetY = 4; x.stroke(); x.restore();
      x.save();
      x.shadowColor = 'rgba(40,30,20,.28)'; x.shadowBlur = 10; x.shadowOffsetY = 5;
      if (mat === 'ice') { const g = x.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#d9f4ff'); g.addColorStop(1, '#94d4f2'); x.fillStyle = g; }
      else if (mat === 'rubber') { x.fillStyle = '#ff6f9f'; }
      else if (mat === 'metal') { const g = x.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, '#a3aebb'); g.addColorStop(1, '#6d7886'); x.fillStyle = g; }
      else { const g = x.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, T.a); g.addColorStop(1, T.b); x.fillStyle = g; }
      path(); x.fill(); x.restore();
      x.save(); path(); x.clip();
      if (mat === 'ground' || !mat) { x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 1.4; x.beginPath(); for (let d = -VH; d < VW + VH; d += 9) { x.moveTo(d, 0); x.lineTo(d + VH, VH); } x.stroke(); x.strokeStyle = 'rgba(0,0,0,.08)'; x.beginPath(); for (let d = -VH; d < VW + VH; d += 23) { x.moveTo(d, VH); x.lineTo(d + VH, 0); } x.stroke(); }
      else if (mat === 'ice') { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); for (let d = -VH; d < VW + VH; d += 38) { x.moveTo(d, 0); x.lineTo(d + 60, 60); } x.stroke(); }
      else if (mat === 'rubber') { x.fillStyle = 'rgba(255,255,255,.22)'; for (let yy = 4; yy < VH; yy += 12) for (let xx = (yy / 12 % 2) * 6; xx < VW; xx += 12) { x.beginPath(); x.arc(xx, yy, 2, 0, 7); x.fill(); } }
      else if (mat === 'metal') { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 0, VW, VH); }
      x.restore();
      x.save(); path(); x.lineJoin = 'round';
      x.strokeStyle = mat === 'ice' ? '#3f8db3' : mat === 'rubber' ? '#b83468' : mat === 'metal' ? '#3c4552' : T.e; x.lineWidth = 3; x.stroke();
      x.restore();
    };
    S.items.forEach(it => {
      if (it.k === 'ground') {
        const P = it.pts;
        fillMat(it.mat, () => { x.beginPath(); P.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); });
        /* luz na aresta de cima (só nos troços virados para cima) */
        if (!it.mat || it.mat === 'ground') { x.save(); x.beginPath(); P.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.clip(); x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); const ccw = DoodleSim.earclip && (P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) > 0); P.forEach((p, i) => { const q = P[(i + 1) % P.length], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, ny = (ccw ? -dx : dx) / l; if (ny < -.5 && !(p[1] > VH - 2 && q[1] > VH - 2)) { x.moveTo(p[0], p[1] + 3); x.lineTo(q[0], q[1] + 3); } }); x.stroke(); x.restore(); }
        /* traço de lápis por cima da orla (à mão) */
        x.save(); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1.2; x.beginPath();
        P.forEach((p, i) => { const q = P[(i + 1) % P.length]; if (q[1] > VH - 2 && p[1] > VH - 2) return; x.moveTo(p[0] + 1, p[1] + 2); x.lineTo(q[0] + 1, q[1] + 2); }); x.stroke(); x.restore();
      } else if (it.k === 'rect') {
        fillMat(it.mat, () => { x.save(); x.translate(it.x, it.y); x.rotate(it.a); rr(x, -it.w / 2, -it.h / 2, it.w, it.h, Math.min(5, it.h / 3)); x.restore(); });
      } else if (it.k === 'spikes') {
        const n = Math.max(1, Math.round(it.w / 14)), sw = it.w / n, up = it.dir !== 'down';
        x.save();
        for (let i = 0; i < n; i++) {
          const x0 = it.x + i * sw; x.beginPath();
          if (up) { x.moveTo(x0, it.y); x.lineTo(x0 + sw / 2, it.y - 15); x.lineTo(x0 + sw, it.y); } else { x.moveTo(x0, it.y); x.lineTo(x0 + sw / 2, it.y + 15); x.lineTo(x0 + sw, it.y); }
          x.closePath(); const g = x.createLinearGradient(x0, 0, x0 + sw, 0); g.addColorStop(0, '#e9edf2'); g.addColorStop(.5, '#a5afbb'); g.addColorStop(1, '#6b7582'); x.fillStyle = g; x.fill();
          x.strokeStyle = '#2b2f38'; x.lineWidth = 1.5; x.stroke();
        }
        x.restore();
      } else if (it.k === 'cup') {
        const t = 8, l = it.x - it.w / 2, top = it.y - it.h;
        x.save(); x.shadowColor = 'rgba(40,30,20,.25)'; x.shadowBlur = 8; x.shadowOffsetY = 4;
        x.fillStyle = '#ffffff'; rr(x, l, top, t, it.h, 3); x.fill(); rr(x, l + it.w - t, top, t, it.h, 3); x.fill(); rr(x, l, it.y - t, it.w, t, 3); x.fill();
        x.restore();
        x.fillStyle = 'rgba(255,210,63,.18)'; x.fillRect(l + t, top + 4, it.w - 2 * t, it.h - t - 4);
        x.strokeStyle = '#23202b'; x.lineWidth = 2.5;
        rr(x, l, top, t, it.h, 3); x.stroke(); rr(x, l + it.w - t, top, t, it.h, 3); x.stroke(); rr(x, l, it.y - t, it.w, t, 3); x.stroke();
        x.fillStyle = '#ffd23f'; x.fillRect(l + 1.5, top + it.h * .45, t - 3, 6); x.fillRect(l + it.w - t + 1.5, top + it.h * .45, t - 3, 6);
      }
    });
    /* botões e portas fechadas */
    S.gates.forEach(g => {
      const bw = g.btn.w || 44;
      x.fillStyle = '#3c4552'; rr(x, g.btn.x - bw / 2, g.btn.y, bw, 5, 2); x.fill();
      if (!g.open) {
        fillMat('metal', () => { rr(x, g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, 3); });
        x.save(); rr(x, g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, 3); x.clip(); x.strokeStyle = 'rgba(255,210,63,.85)'; x.lineWidth = 5; x.beginPath(); for (let d = -60; d < g.h + 60; d += 16) { x.moveTo(g.x - g.w / 2 - 10, g.y - g.h / 2 + d); x.lineTo(g.x + g.w / 2 + 10, g.y - g.h / 2 + d - 20); } x.stroke(); x.restore();
      }
    });
    G.cache = c; G.cacheK = k;
  }

  /* ════════════════════════════════════════════════════════════════
     desenho
  ════════════════════════════════════════════════════════════════ */
  function tf(G, it) {
    const b = it.b, p = b.getPosition(), a = b.getAngle(), q = it.p0, al = G.alpha;
    if (!q || al >= 1) return [p.x * 30, p.y * 30, a];
    return [lerp(q[0], p.x * 30, al), lerp(q[1], p.y * 30, al), lerpA(q[2], a, al)];
  }
  function draw(G, ctx, W, H, api) {
    const S = G.S;
    const tr = ctx.getTransform(), k = tr.a;
    if (!G.cache || Math.abs(G.cacheK - k) > .01) paintCache(G, k);
    const cvEl = api.stage.querySelector('.ak-cv');
    if (cvEl) { const kd = cvEl.width / (cvEl.clientWidth || 1), sh = api.shakeXY; G.map = { s: tr.a / kd, ox: tr.e / kd - sh[0], oy: tr.f / kd - sh[1] }; }
    ctx.drawImage(G.cache, 0, 0, VW, VH);
    /* câmara: leve aproximação ao ponto da vitória */
    let zoomed = false;
    if (G.winAt && !api.reduced) {
      const u = easeOut(clamp((G.t - G.winT) / .6, 0, 1)) * .06;
      if (u > 0) { zoomed = true; ctx.save(); ctx.translate(G.winAt[0], G.winAt[1]); ctx.scale(1 + u, 1 + u); ctx.translate(-G.winAt[0], -G.winAt[1]); ctx.drawImage(G.cache, 0, 0, VW, VH); }
    }
    const frozen = !S.started || G.freeze;
    drawZones(G, ctx);
    S.gates.forEach(g => drawGate(G, ctx, g));
    S.ropes.forEach(r => drawRope(G, ctx, r));
    if (G.alpha < 1 || S.started) S.items.forEach(it => { if (it.b && !it.gone) it.tf = tf(G, it); });
    else S.items.forEach(it => { if (it.b && !it.gone) { const p = it.b.getPosition(); it.tf = [p.x * 30, p.y * 30, it.b.getAngle()]; } });
    /* pivôs dos baloiços por trás das tábuas */
    S.items.forEach(it => { if (it.pivot) drawPivot(ctx, it.pivot, it.post); });
    S.items.forEach(it => { if (!it.b || it.gone) return; if (it.k === 'crate' || it.k === 'plank' || it.k === 'mover') drawBox(G, ctx, it); });
    S.items.forEach(it => { if (it.pivot) drawAxle(ctx, it.pivot); });
    S.items.forEach(it => { if (it.k === 'stroke' && !it.gone && it.b) drawStroke(G, ctx, it); });
    S.items.forEach(it => { if (it.k === 'rock' && !it.gone && it.b) drawRock(ctx, it); });
    S.items.forEach(it => { if (!it.b || it.gone) return; if (it.role === 'hero' || it.role === 'hero2') drawHero(G, ctx, it); else if (it.role === 'egg') drawEgg(G, ctx, it); else if (it.k === 'ball') drawMarble(G, ctx, it); });
    S.pins.forEach(pn => drawPin(G, ctx, pn));
    S.stars.forEach(st => drawStar(G, ctx, st));
    S.cups.forEach(cp => drawCupCount(G, ctx, cp));
    drawFx(G, ctx);
    if (zoomed) ctx.restore();
    drawHint(G, ctx);
    drawPen(G, ctx);
    drawInk(G, ctx);
    if (frozen && !S.won && !S.lost) drawFrozen(G, ctx);
  }
  function drawZones(G, ctx) {
    G.S.nodraw.forEach(z => {
      const pulse = G.lastBlock && G.lastBlock.zone && Math.abs(G.lastBlock.x - z.x) < z.w && Math.abs(G.lastBlock.y - z.y) < z.h ? 1 - G.lastBlock.t / .5 : 0;
      const x0 = z.x - z.w / 2, y0 = z.y - z.h / 2;
      ctx.save(); rr(ctx, x0, y0, z.w, z.h, 10); ctx.fillStyle = `rgba(255,79,109,${.08 + pulse * .2})`; ctx.fill(); ctx.clip();
      ctx.strokeStyle = `rgba(226,59,59,${.35 + pulse * .4})`; ctx.lineWidth = 2;
      const off = (G.t * 10) % 14;
      ctx.beginPath(); for (let d = -z.h - 14; d < z.w + z.h; d += 14) { ctx.moveTo(x0 + d + off, y0); ctx.lineTo(x0 + d + off - z.h, y0 + z.h); } ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.setLineDash([7, 5]); ctx.strokeStyle = `rgba(226,59,59,${.6 + pulse * .4})`; ctx.lineWidth = 2; rr(ctx, x0, y0, z.w, z.h, 10); ctx.stroke(); ctx.restore();
      const cx = z.x, cy = z.y; ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = .65 + pulse * .35;
      ctx.fillStyle = '#fbf7ec'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#e23b3b'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(4, -4); ctx.moveTo(-3, -6); ctx.lineTo(6, 3); ctx.stroke(); ctx.restore();
    });
  }
  function drawGate(G, ctx, g) {
    const bw = g.btn.w || 44, pressed = g.open ? 1 : 0;
    ctx.save(); ctx.fillStyle = g.open ? '#13a77a' : '#ff4f6d'; ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2;
    rr(ctx, g.btn.x - bw / 2 + 4, g.btn.y - 7 + pressed * 5, bw - 8, 8 - pressed * 4, 3); ctx.fill(); ctx.stroke(); ctx.restore();
    if (g.open) {
      /* a porta sobe e desaparece */
      const u = clamp((G.S.t - g.open) / .5, 0, 1); if (u >= 1) return;
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.translate(0, -u * g.h);
      ctx.fillStyle = '#8d99a6'; rr(ctx, g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, 3); ctx.fill(); ctx.strokeStyle = '#3c4552'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
  }
  /* suporte do baloiço: poste até ao chão + eixo */
  function drawPivot(ctx, p, post) {
    const h = post || 26;
    ctx.save(); ctx.fillStyle = '#5b6170'; ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(p[0] - 5, p[1]); ctx.lineTo(p[0] + 5, p[1]); ctx.lineTo(p[0] + 16, p[1] + h); ctx.lineTo(p[0] - 16, p[1] + h); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); for (let y = p[1] + 12; y < p[1] + h - 4; y += 12) { const k = (y - p[1]) / h * 11 + 5; ctx.moveTo(p[0] - k + 3, y); ctx.lineTo(p[0] + k - 3, y + 6); } ctx.stroke();
    ctx.restore();
  }
  function drawAxle(ctx, p) {
    ctx.save(); ctx.fillStyle = '#d7dde5'; ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 4.5, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function drawBox(G, ctx, it) {
    const [x, y, a] = it.k === 'mover' ? [it.b.getPosition().x * 30, it.b.getPosition().y * 30, 0] : it.tf;
    if (it.k === 'mover') {
      ctx.save(); ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(35,32,43,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(it.x0 - it.dx / 2, it.y0 - it.dy / 2); ctx.lineTo(it.x0 + it.dx / 2, it.y0 + it.dy / 2); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const w = it.w, h = it.h;
    ctx.shadowColor = 'rgba(40,30,20,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    const ice = it.mat === 'ice', metal = it.mat === 'metal', rub = it.mat === 'rubber';
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    if (ice) { g.addColorStop(0, '#e6f8ff'); g.addColorStop(1, '#9fd8f4'); } else if (metal) { g.addColorStop(0, '#b4bec9'); g.addColorStop(1, '#6d7886'); } else if (rub) { g.addColorStop(0, '#ff8db4'); g.addColorStop(1, '#e8558a'); } else { g.addColorStop(0, it.role === 'target' ? '#ffb347' : '#d9a066'); g.addColorStop(1, it.role === 'target' ? '#e07b1f' : '#a86d3a'); }
    ctx.fillStyle = g; rr(ctx, -w / 2, -h / 2, w, h, Math.min(5, h / 3)); ctx.fill();
    ctx.shadowColor = 'transparent';
    if (!ice && !metal && !rub) {
      ctx.strokeStyle = 'rgba(90,50,20,.35)'; ctx.lineWidth = 1.3;
      if (it.k === 'crate' && w > 26 && h > 26) { ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10); ctx.beginPath(); ctx.moveTo(-w / 2 + 5, -h / 2 + 5); ctx.lineTo(w / 2 - 5, h / 2 - 5); ctx.stroke(); }
      else { ctx.beginPath(); for (let yy = -h / 2 + 5; yy < h / 2 - 2; yy += 6) { ctx.moveTo(-w / 2 + 4, yy); ctx.bezierCurveTo(-w / 6, yy + 2, w / 6, yy - 2, w / 2 - 4, yy); } ctx.stroke(); }
    }
    ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2.5; rr(ctx, -w / 2, -h / 2, w, h, Math.min(5, h / 3)); ctx.stroke();
    if (it.lip) { ctx.fillStyle = '#a86d3a'; ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2; if (it.lip.includes('l')) { rr(ctx, -w / 2, -h / 2 - 16, 6, 18, 2); ctx.fill(); ctx.stroke(); } if (it.lip.includes('r')) { rr(ctx, w / 2 - 6, -h / 2 - 16, 6, 18, 2); ctx.fill(); ctx.stroke(); } }
    if (it.role === 'target') { ctx.fillStyle = '#23202b'; ctx.font = `800 ${Math.min(16, h * .5)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 1); }
    ctx.restore();
  }
  function drawStroke(G, ctx, it) {
    const [x, y, a] = it.tf, col = INK[it.col % INK.length], dk = INK_D[it.col % INK.length];
    const age = G.t - (it.born || -9), pop = age < .35 ? 1 + Math.sin(age / .35 * Math.PI) * .45 : 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (it.dot) {
      const r = it.dot * pop;
      ctx.fillStyle = 'rgba(40,30,20,.18)'; ctx.beginPath(); ctx.arc(1.5, 3, r, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-r * .35, -r * .35, r * .3, 0, 7); ctx.fill();
    } else if (it.poly) {
      const P = it.poly;
      ctx.save(); ctx.translate(2, 4); ctx.fillStyle = 'rgba(40,30,20,.16)'; ctx.beginPath(); smoothPath(ctx, P, true); ctx.fill(); ctx.restore();
      ctx.fillStyle = col; ctx.beginPath(); smoothPath(ctx, P, true); ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; P.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      ctx.beginPath(); for (let d = x0 - (y1 - y0); d < x1; d += 8) { ctx.moveTo(d, y1); ctx.lineTo(d + (y1 - y0), y0); } ctx.stroke(); ctx.restore();
      ctx.strokeStyle = dk; ctx.lineWidth = 3 * pop; ctx.beginPath(); smoothPath(ctx, P, true); ctx.stroke();
    } else {
      const P = it.line, w = DoodleSim.THICK * pop;
      ctx.save(); ctx.translate(1.5, 3.5); ctx.strokeStyle = 'rgba(40,30,20,.16)'; ctx.lineWidth = w; ctx.beginPath(); smoothPath(ctx, P); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = dk; ctx.lineWidth = w + 2.5; ctx.beginPath(); smoothPath(ctx, P); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = w - .5; ctx.stroke();
      ctx.save(); ctx.translate(-.8, -1.6); ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = Math.max(1.4, w * .24); ctx.beginPath(); smoothPath(ctx, P); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function drawRock(ctx, it) {
    const [x, y, a] = it.tf;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.beginPath(); it.poly.forEach((p, i) => i ? ctx.lineTo(p[0] + 2, p[1] + 3) : ctx.moveTo(p[0] + 2, p[1] + 3)); ctx.fill();
    const g = ctx.createLinearGradient(-10, -10, 10, 10); g.addColorStop(0, '#a4a09a'); g.addColorStop(1, '#5f5b57');
    ctx.fillStyle = g; ctx.beginPath(); it.poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-3, -3, 2.5, 0, 7); ctx.fill();
    ctx.restore();
  }
  /* olhos que seguem o objetivo, piscam e reagem à queda */
  function lookTarget(G, it, x, y) {
    const S = G.S;
    if (S.L.goal === 'touch') { const o = S.items.find(o => o !== it && (o.role === 'hero' || o.role === 'hero2') && o.tf); if (o) return [o.tf[0], o.tf[1]]; }
    const st = S.stars.find(s => !s.got); if (st) return [st.x, st.y];
    if (S.cups[0]) return [S.cups[0].x, S.cups[0].y - 30];
    const rk = S.items.find(o => o.k === 'rock' && o.tf && o.tf[1] < y); if (rk) return [rk.tf[0], rk.tf[1]];
    return G.cursor || [x + 40, y];
  }
  function squash(ctx, h) {
    if (!h || Math.abs(h.v) < .005) return;
    ctx.rotate(h.dir); ctx.scale(1 - h.v, 1 + h.v * .8); ctx.rotate(-h.dir);
  }
  function drawHero(G, ctx, it) {
    const [x, y, a] = it.tf, r = it.r, h = G.hfx.get(it), S = G.S, two = it.role === 'hero2';
    const c1 = two ? '#8fd6ff' : '#ffc04d', c2 = two ? '#2f86e0' : '#f0701f', ol = two ? '#123a66' : '#4a2208';
    /* rasto */
    if (h && h.trail && h.sp > 260) {
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 1; i < h.trail.length; i++) { const u = i / h.trail.length; ctx.strokeStyle = `rgba(${two ? '47,134,224' : '240,112,31'},${u * .22})`; ctx.lineWidth = r * 2 * u * .8; ctx.beginPath(); ctx.moveTo(h.trail[i - 1][0], h.trail[i - 1][1]); ctx.lineTo(h.trail[i][0], h.trail[i][1]); ctx.stroke(); }
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); squash(ctx, h);
    const ap = appear(G, two ? .12 : 0); if (ap < 1) ctx.scale(ap, ap);
    ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.beginPath(); ctx.ellipse(1.5, 4, r, r * .95, 0, 0, 7); ctx.fill();
    /* corpo (roda com a física: manchas e o rebento mostram o rolar) */
    ctx.save(); ctx.rotate(a);
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.1); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = two ? 'rgba(255,255,255,.18)' : 'rgba(255,240,200,.25)';
    [[.45, -.2, .18], [-.5, .35, .14], [.1, .6, .12]].forEach(([u, v2, s]) => { ctx.beginPath(); ctx.arc(u * r, v2 * r, s * r, 0, 7); ctx.fill(); });
    if (two) { ctx.strokeStyle = ol; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(3, -r - 7); ctx.stroke(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(3, -r - 8, 3.2, 0, 7); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = '#4fbf5a'; ctx.strokeStyle = '#1f5a26'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -r + 1); ctx.quadraticCurveTo(9, -r - 10, 13, -r - 3); ctx.quadraticCurveTo(6, -r + 2, 0, -r + 1); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = ol; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    /* cara direita */
    const [tx, ty] = lookTarget(G, it, x, y), la = Math.atan2(ty - y, tx - x);
    const won = S.won, lost = S.lost, fast = h && h.vy > 380 && !won;
    const lx = Math.cos(la) * 2.2, ly = Math.sin(la) * 1.8;
    const blink = h && h.blink < 0 && !fast ? .15 : 1;
    ctx.translate(lx * .6, ly * .6 - 1);
    [-r * .36, r * .36].forEach(ex => {
      if (won) { ctx.strokeStyle = ol; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, -r * .1, r * .17, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); return; }
      if (lost) { ctx.strokeStyle = ol; ctx.lineWidth = 2; ctx.beginPath(); const s = r * .13; ctx.moveTo(ex - s, -r * .22 - s); ctx.lineTo(ex + s, -r * .22 + s); ctx.moveTo(ex + s, -r * .22 - s); ctx.lineTo(ex - s, -r * .22 + s); ctx.stroke(); return; }
      const ew = r * (fast ? .25 : .21), eh = r * (fast ? .3 : .26) * blink;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, -r * .18, ew, eh, 0, 0, 7); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1.4; ctx.stroke();
      if (blink > .5) { ctx.fillStyle = '#1b1420'; ctx.beginPath(); ctx.arc(ex + lx, -r * .18 + ly, r * (fast ? .1 : .12), 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + lx - 1.3, -r * .18 + ly - 1.4, 1.3, 0, 7); ctx.fill(); }
    });
    ctx.fillStyle = 'rgba(255,90,110,.35)'; ctx.beginPath(); ctx.ellipse(-r * .58, r * .16, r * .15, r * .09, 0, 0, 7); ctx.ellipse(r * .58, r * .16, r * .15, r * .09, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = ol; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    if (fast || lost) { ctx.fillStyle = '#5a1a1a'; ctx.ellipse(0, r * .32, r * .13, r * .16, 0, 0, 7); ctx.fill(); }
    else ctx.arc(0, r * .14, r * (won ? .3 : .2), Math.PI * .15, Math.PI * .85), ctx.stroke();
    ctx.restore();
  }
  function drawMarble(G, ctx, it) {
    const [x, y, a] = it.tf, r = it.r, h = G.hfx.get(it);
    const hue = [200, 340, 150, 40, 270, 10][G.S.items.indexOf(it) % 6];
    ctx.save(); ctx.translate(x, y); squash(ctx, h);
    const ap = appear(G, .05 + (G.S.items.indexOf(it) % 6) * .05); if (ap < 1) ctx.scale(ap, ap);
    ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.beginPath(); ctx.arc(1.5, 3.5, r, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(-r * .4, -r * .45, r * .05, 0, 0, r); g.addColorStop(0, `hsl(${hue},90%,82%)`); g.addColorStop(.6, `hsl(${hue},75%,55%)`); g.addColorStop(1, `hsl(${hue},70%,38%)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.save(); ctx.rotate(a); ctx.strokeStyle = `hsla(${hue},90%,92%,.7)`; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, r * .55, .3, 2.3); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-r * .38, -r * .42, r * .22, r * .14, -.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    ctx.restore();
  }
  function drawEgg(G, ctx, it) {
    const [x, y, a] = it.tf, h = G.hfx.get(it), S = G.S;
    ctx.save(); ctx.translate(x, y); squash(ctx, h); ctx.rotate(a);
    const ap = appear(G, 0); if (ap < 1) ctx.scale(ap, ap);
    ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.beginPath(); ctx.ellipse(2, 4, 13, 16, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.bezierCurveTo(10, -17, 13.5, 4, 12.5, 6); ctx.bezierCurveTo(11, 15, -11, 15, -12.5, 6); ctx.bezierCurveTo(-13.5, 4, -10, -17, 0, -17); ctx.closePath();
    const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, 18); g.addColorStop(0, '#fffdf4'); g.addColorStop(1, '#ead9b8'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = 'rgba(160,120,70,.45)'; [[5, -6, 2], [-6, 2, 1.6], [7, 6, 1.4], [-3, -10, 1.3]].forEach(([u, v2, s]) => { ctx.beginPath(); ctx.arc(u, v2, s, 0, 7); ctx.fill(); });
    const scared = S.items.some(o => o.k === 'rock' && o.tf && o.tf[1] < y && Math.abs(o.tf[0] - x) < 120) && !S.won;
    ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    if (S.lost) { ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(-3, 2); ctx.moveTo(-3, -2); ctx.lineTo(-7, 2); ctx.moveTo(3, -2); ctx.lineTo(7, 2); ctx.moveTo(7, -2); ctx.lineTo(3, 2); ctx.stroke(); }
    else if (scared) { ctx.fillStyle = '#fff'; [-5, 5].forEach(ex => { ctx.beginPath(); ctx.arc(ex, 0, 3.4, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1b1420'; ctx.beginPath(); ctx.arc(ex, -1, 1.5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; }); ctx.beginPath(); ctx.ellipse(0, 7, 2.2, 2.8, 0, 0, 7); ctx.stroke(); }
    else { [-5, 5].forEach(ex => { ctx.beginPath(); ctx.arc(ex, 0, 2.6, S.won ? Math.PI : .2, S.won ? Math.PI * 2 : Math.PI - .2); ctx.stroke(); }); ctx.beginPath(); ctx.arc(0, 5, 3, .3, Math.PI - .3); ctx.stroke(); }
    ctx.restore();
    if (!scared && !S.won && !S.lost) { ctx.save(); ctx.fillStyle = 'rgba(35,32,43,.45)'; ctx.font = `700 ${9 + Math.sin(G.t * 2) * 1}px ${FONT}`; ctx.fillText('z', x + 14, y - 16 - (G.t * 8 % 8)); ctx.restore(); }
  }
  function drawPin(G, ctx, pn) {
    const [x, y] = DoodleSim.pinPos(pn), age = G.t - (pn.born || -9), drop = age < .2 ? (1 - age / .2) * 14 : 0;
    ctx.save(); ctx.translate(x, y - drop);
    ctx.fillStyle = 'rgba(40,30,20,.25)'; ctx.beginPath(); ctx.ellipse(3 + drop * .3, 4 + drop, 6.5, 4, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(-2, -2.5, .5, 0, 0, 7.5); g.addColorStop(0, pn.free ? '#ffb0b0' : '#ff7272'); g.addColorStop(1, '#c41e1e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#4a0f0f'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(-2, -2.2, 1.8, 0, 7); ctx.fill();
    if (pn.free) { ctx.globalAlpha = .45 + Math.sin(G.t * 5) * .25; ctx.strokeStyle = '#c41e1e'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  function drawRope(G, ctx, r) {
    const [a, c] = DoodleSim.ropeEnds(r), d = Math.hypot(c[0] - a[0], c[1] - a[1]), slack = Math.max(0, r.len - d);
    const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2 + slack * .55;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,30,20,.18)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a[0] + 2, a[1] + 3); ctx.quadraticCurveTo(mx + 2, my + 3, c[0] + 2, c[1] + 3); ctx.stroke();
    ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, c[0], c[1]); ctx.stroke();
    ctx.strokeStyle = '#d9a35c'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -r.len * .1; ctx.stroke();
    ctx.setLineDash([]);
    [a, c].forEach((p, i) => { const free = i ? !r.B : !r.A; ctx.fillStyle = free ? '#5b6170' : '#7a4a1e'; ctx.beginPath(); ctx.arc(p[0], p[1], free ? 4.5 : 3.2, 0, 7); ctx.fill(); ctx.strokeStyle = '#23202b'; ctx.lineWidth = 1.5; ctx.stroke(); });
    ctx.restore();
  }
  function drawStar(G, ctx, st) {
    if (st.got) return;
    const bob = Math.sin(G.t * 2.2 + st.x) * 3, rot = Math.sin(G.t * 1.3) * .18, pul = 1 + Math.sin(G.t * 4) * .05;
    ctx.save(); ctx.translate(st.x, st.y + bob);
    const ap = appear(G, .25); if (ap < 1) ctx.scale(ap, ap);
    const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, st.r * 2.2); gl.addColorStop(0, 'rgba(255,210,63,.45)'); gl.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, st.r * 2.2, 0, 7); ctx.fill();
    ctx.rotate(rot); ctx.scale(pul, pul);
    starPath(ctx, st.r, st.r * .48);
    const g = ctx.createLinearGradient(0, -st.r, 0, st.r); g.addColorStop(0, '#fff09a'); g.addColorStop(1, '#ffb000');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-st.r * .22, -st.r * .3, st.r * .16, st.r * .1, -.5, 0, 7); ctx.fill();
    ctx.restore();
    /* brilhos a orbitar */
    for (let i = 0; i < 3; i++) { const a = G.t * 1.6 + i * 2.1, rx = st.x + Math.cos(a) * st.r * 1.7, ry = st.y + bob + Math.sin(a) * st.r * 1.2; ctx.fillStyle = `rgba(255,190,30,${.5 + Math.sin(G.t * 6 + i) * .3})`; ctx.save(); ctx.translate(rx, ry); ctx.rotate(G.t * 3); ctx.fillRect(-1.5, -4, 3, 8); ctx.fillRect(-4, -1.5, 8, 3); ctx.restore(); }
  }
  function drawCupCount(G, ctx, cp) {
    const need = G.L.need || 1, n = cp.n || 0, done = n >= need;
    const x = cp.x, y = cp.y - cp.h - 18;
    ctx.save(); ctx.translate(x, y); const s = done ? 1 + Math.sin(G.t * 10) * .05 : 1; ctx.scale(s, s);
    ctx.fillStyle = done ? '#13a77a' : '#23202b'; rr(ctx, -22, -11, 44, 22, 11); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${n}/${need}`, 0, 1);
    ctx.restore();
  }
  function drawFx(G, ctx) {
    G.fx.forEach(f => {
      const u = f.t / f.life;
      if (f.k === 'ring') { ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = f.c || '#23202b'; ctx.lineWidth = 3 * (1 - u) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + easeOut(u) * (f.r || 26), 0, 7); ctx.stroke(); ctx.restore(); }
      else if (f.k === 'no') { ctx.save(); ctx.globalAlpha = 1 - u; ctx.translate(f.x, f.y); ctx.rotate(Math.sin(u * 20) * .2 * (1 - u)); ctx.strokeStyle = '#e23b3b'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(7, -7); ctx.lineTo(-7, 7); ctx.stroke(); ctx.restore(); }
      else if (f.k === 'heart') {
        const t = f.t, x = f.x + f.vx * t, y = f.y + f.vy * t + 60 * t * t;
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - u) * 2); ctx.translate(x, y); const s = .8 + Math.sin(t * 9) * .12; ctx.scale(s, s);
        ctx.fillStyle = '#ff4f6d'; ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-10, -2, -6, -11, 0, -5); ctx.bezierCurveTo(6, -11, 10, -2, 0, 6); ctx.fill(); ctx.strokeStyle = '#7a1428'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      }
    });
  }
  function drawPen(G, ctx) {
    const P = G.pen, S = G.S;
    /* cursor do lápis (rato): anel da cor da próxima tinta; vermelho onde não se pode desenhar */
    if (!P && !G.rope && G.cursor && G.mouse && live(G) && G.tool === 'pen') {
      const [cx, cy] = G.cursor, bad = DoodleSim.blocked(S, cx, cy);
      ctx.save(); ctx.globalAlpha = .85; ctx.strokeStyle = bad ? '#e23b3b' : INK[S.strokes % INK.length]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, DoodleSim.THICK / 2 + 2, 0, 7); ctx.stroke();
      if (bad) { ctx.beginPath(); ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3); ctx.stroke(); }
      ctx.restore();
    }
    if (P && P.pts.length) {
      const col = INK[P.col], dk = INK_D[P.col];
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const closing = P.pts.length > 10 && P.len > 70 && Math.hypot(P.pts[0][0] - P.pts[P.pts.length - 1][0], P.pts[0][1] - P.pts[P.pts.length - 1][1]) < 24;
      if (closing) { ctx.fillStyle = col + '44'; ctx.beginPath(); smoothPath(ctx, P.pts, true); ctx.fill(); }
      ctx.strokeStyle = dk; ctx.lineWidth = DoodleSim.THICK + 2.5; ctx.beginPath(); smoothPath(ctx, P.pts); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = DoodleSim.THICK - .5; ctx.stroke();
      const e = P.pts[P.pts.length - 1];
      ctx.fillStyle = '#fff'; ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e[0], e[1], 5, 0, 7); ctx.fill(); ctx.stroke();
      if (closing) { ctx.strokeStyle = col; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(P.pts[0][0], P.pts[0][1], 12 + Math.sin(G.t * 12) * 2, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
    if (G.rope) {
      const R = G.rope, ok = (DoodleSim.blocked(S, R.a[0], R.a[1]) === 'body' || DoodleSim.blocked(S, R.b[0], R.b[1]) === 'body');
      ctx.save(); ctx.setLineDash([6, 5]); ctx.lineDashOffset = -G.t * 30; ctx.strokeStyle = ok ? '#7a4a1e' : '#e23b3b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(R.a[0], R.a[1]); ctx.lineTo(R.b[0], R.b[1]); ctx.stroke(); ctx.setLineDash([]);
      [R.a, R.b].forEach(p => { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.restore();
    }
  }
  /* dica: a solução desenha-se sozinha a tracejado, com um lápis a percorrê-la */
  function drawHint(G, ctx) {
    if (!G.hintT) return;
    const sol = (G.L.sol || []).slice(0, G.hintN), t = G.hintT;
    const fade = t > 6 ? 1 - (t - 6) : Math.min(1, t * 3);
    ctx.save(); ctx.globalAlpha = fade * .85; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    sol.forEach((a, i) => {
      const u = clamp((t - i * .9) / 1.2, 0, 1); if (u <= 0) return;
      const col = '#23202b';
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.setLineDash([7, 6]); ctx.lineWidth = 3;
      let tipP = null;
      if (a.d) {
        const P = a.d, L = DoodleSim.pathLen(P), want = L * easeOut(u); let acc = 0;
        ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); tipP = P[0];
        for (let k = 1; k < P.length; k++) { const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); if (acc + l >= want) { const f = (want - acc) / (l || 1); tipP = [lerp(P[k - 1][0], P[k][0], f), lerp(P[k - 1][1], P[k][1], f)]; ctx.lineTo(tipP[0], tipP[1]); break; } acc += l; ctx.lineTo(P[k][0], P[k][1]); tipP = P[k]; }
        ctx.stroke();
      } else if (a.pin) { ctx.setLineDash([]); ctx.beginPath(); ctx.arc(a.pin[0], a.pin[1], 9 * u, 0, 7); ctx.stroke(); tipP = a.pin; }
      else if (a.rope) { const [p, q] = a.rope, e = [lerp(p[0], q[0], u), lerp(p[1], q[1], u)]; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); tipP = e; }
      ctx.setLineDash([]);
      const s0 = a.d ? a.d[0] : a.pin ? a.pin : a.rope[0];
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(s0[0] - 14, s0[1] - 14, 10, 0, 7); ctx.fill(); ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#23202b'; ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(a.t ? '⏱' : String(i + 1), s0[0] - 14, s0[1] - 13.5);
      if (tipP && u < 1) { ctx.save(); ctx.translate(tipP[0], tipP[1]); ctx.rotate(-.7); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#23202b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -6); ctx.lineTo(5, -26); ctx.lineTo(-5, -26); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    });
    if (sol.some(a => a.t)) { ctx.fillStyle = '#23202b'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('⏱ = desenha já com o mundo a mexer', VW / 2, 92); }
    ctx.restore();
  }
  function drawInk(G, ctx) {
    const S = G.S, par = G.L.par || [99, 1e9];
    const used = S.ink + (G.pen ? G.pen.len : 0), frac = clamp(1 - used / S.inkMax, 0, 1);
    const x0 = 132, x1 = VW - 132, y = 66, w = x1 - x0;
    ctx.save();
    ctx.fillStyle = 'rgba(35,32,43,.12)'; rr(ctx, x0, y - 6, w, 12, 6); ctx.fill();
    const col = INK[(G.pen ? G.pen.col : S.strokes) % INK.length];
    ctx.fillStyle = col; rr(ctx, x0, y - 6, Math.max(12, w * frac), 12, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, x0 + 3, y - 4.5, Math.max(6, w * frac - 6), 3.5, 2); ctx.fill();
    ctx.strokeStyle = '#23202b'; ctx.lineWidth = 2; rr(ctx, x0, y - 6, w, 12, 6); ctx.stroke();
    /* marca da 3.ª estrela (pouca tinta) */
    if (par[1] < S.inkMax) {
      const mx = x0 + w * (1 - par[1] / S.inkMax), ok = used <= par[1];
      ctx.save(); ctx.translate(mx, y - 12); starPath(ctx, 6, 2.8); ctx.fillStyle = ok ? '#ffd23f' : '#c9c3b5'; ctx.fill(); ctx.strokeStyle = '#23202b'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#23202b'; ctx.font = `700 10px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('TINTA', x0 - 8, y + 1);
    ctx.textAlign = 'left';
    const n = S.strokes + (G.pen ? 1 : 0); ctx.fillStyle = n <= par[0] ? '#23202b' : '#b8243f';
    ctx.fillText(`✏ ${n}/${par[0]}`, x1 + 8, y + 1);
    ctx.restore();
  }
  function drawFrozen(G, ctx) {
    const S = G.S;
    ctx.save();
    ctx.fillStyle = 'rgba(70,120,210,.05)'; ctx.fillRect(0, 0, VW, VH);
    const msg = G.freeze ? (S.started ? '⏸ Tempo parado — desenha à vontade e carrega ▶' : '⏸ Planeia tudo e carrega ▶ para começar') : 'O mundo começa a mexer quando levantares o lápis';
    ctx.font = `700 11px ${FONT}`; const w = ctx.measureText(msg).width + 24;
    ctx.globalAlpha = .9; ctx.fillStyle = '#23202b'; rr(ctx, VW / 2 - w / 2, 82, w, 22, 11); ctx.fill();
    ctx.fillStyle = '#fffdf6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, VW / 2, 93.5);
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════
     menu (capítulos × níveis)
  ════════════════════════════════════════════════════════════════ */
  const picker = {
    html() {
      const sv = save(), CHS = DoodleLevels.CHAPTERS;
      const tot = LV().reduce((s, l) => s + (sv.s[l.id] || 0), 0);
      return `<style>
.dd-m{display:grid;gap:14px}
.dd-c{border-radius:18px;padding:12px 12px 14px;color:#fff;border:2px solid #23202b;box-shadow:0 4px 0 #23202b}
.dd-c h4{margin:0 0 8px;font:800 1rem ${FONT};display:flex;gap:8px;align-items:center}
.dd-c h4 small{margin-left:auto;font-size:.72rem;opacity:.9}
.dd-c p{margin:-4px 0 8px;font-size:.76rem;opacity:.92}
.dd-ls{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:7px}
.dd-l{aspect-ratio:1;border:2px solid #23202b;background:#fffdf6;border-radius:13px;color:#23202b;font:800 1rem ${FONT};cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 3px 0 #23202b;transition:transform .14s cubic-bezier(.3,1.6,.5,1)}
.dd-l:hover:not([disabled]){transform:translateY(-3px) rotate(-2deg)}
.dd-l[disabled]{opacity:.5;cursor:not-allowed;background:rgba(255,255,255,.4)}
.dd-l i{font-style:normal;font-size:.56rem;letter-spacing:.5px;color:#e09b00}
.dd-tot{font:700 .82rem ${FONT};color:var(--muted,#9aa)}
</style><div class="dd-m"><div class="dd-tot">⭐ ${tot} / ${LV().length * 3} estrelas</div>${CHS.map((c, ci) => {
        const ls = LV().map((l, i) => ({ l, i })).filter(o => o.l.chapter === ci);
        if (!ls.length) return '';
        const cs = ls.reduce((s, o) => s + (sv.s[o.l.id] || 0), 0);
        return `<div class="dd-c" style="background:linear-gradient(140deg,${c.grad[0]},${c.grad[1]})"><h4>${c.icon} ${c.name}<small>⭐ ${cs}/${ls.length * 3}</small></h4><p>${c.desc}</p><div class="dd-ls">${ls.map(({ l, i }) => {
          const lock = !unlocked(sv, i), st = sv.s[l.id];
          return `<button class="dd-l" data-m="${i}" ${lock ? 'disabled' : ''} title="${l.name}">${lock ? '🔒' : i + 1}<i>${lock ? '' : st == null ? '·' : '★'.repeat(st) + '<span style="opacity:.3;color:#23202b">' + '★'.repeat(3 - st) + '</span>'}</i></button>`;
        }).join('')}</div></div>`;
      }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) start(b.dataset.m); })); },
  };

  let CUR = null;
  const GOALS = { star: 'Leva a Bolota até à estrela', touch: 'Junta a Bolota e a Lua', cup: 'Enche o cesto', off: 'Deita a caixa abaixo da linha', protect: 'Protege o ovo das pedras' };
  const spec = {
    id: ID, title: 'Traço a Traço', icon: '✏️', accent: '#2f6bff', accent2: '#ff4f6d', bg: '#e9e1cf', diff: false,
    tagline: 'Desenha e a física faz o resto. Pontes, rampas, alavancas, baloiços e cordas — cada puzzle tem muitas soluções, a tua imaginação é o limite.',
    view: { w: VW, h: VH }, picker, cursor: 'crosshair',
    get ready() { const L = CUR || LV()[0]; return { title: `Nível ${LV().indexOf(L) + 1} · ${L.name}`, hint: `${GOALS[L.goal] || ''}. ${L.tip || ''}` }; },
    how: [
      'Desenha com o dedo ou o rato: cada traço <b>ganha peso</b> e cai, rola e choca. Uma <b>forma fechada</b> fica cheia e mais pesada; um toque faz uma bolinha.',
      'O mundo começa a mexer quando levantas o lápis. Usa <b>⏸</b> para parar o tempo e planear vários traços com calma.',
      'Em alguns níveis tens <b>pinos</b> (prendem uma peça ao fundo ou duas peças entre si — fazem dobradiças e baloiços) e <b>cordas</b>.',
      'Não se desenha por cima de objetos nem nas <b>zonas riscadas</b>. Estrelas: resolver, poucos traços e pouca tinta.',
    ],
    controls: ['✏️ arrastar = desenhar', '📌 tocar = pino', '🪢 arrastar = corda', '⏸ parar o tempo · ↶ desfazer · 💡 dica'],
    setup: (api, o) => { const G = setup(api, o); CUR = G.L; return G; },
    update, draw, down, move, up,
    destroy: G => { G.dead = 1; clearTimeout(G._tip); if (G.ui) G.ui.remove(); const t = G.api && G.api.stage.querySelector('.dd-tip'); if (t) t.remove(); },
    hud: G => [['Nível', (G.li + 1) + '/' + LV().length], ['Objetivo', ({ star: '⭐', touch: '💞', cup: '🧺 ' + ((G.S.cups[0] && G.S.cups[0].n) || 0) + '/' + (G.L.need || 1), off: '📦', protect: '🥚 ' + Math.max(0, Math.ceil((G.L.hold || 6) - G.S.t)) + ' s' })[G.L.goal] || '']],
    pauseButtons: (G, api) => [{ label: 'Escolher nível', fn: () => api.menu() }],
    achievements: [
      { id: 'doodle.first', name: 'Primeiro Traço', icon: '✏️', desc: 'Resolve o primeiro puzzle do Traço a Traço.', test: c => c.result.won },
      { id: 'doodle.perfect', name: 'Traço Perfeito', icon: '🏆', desc: 'Ganha ★★★ num nível do Traço a Traço.', test: c => c.result.won && (c.result.meta && c.result.meta.stars) === 3 },
      { id: 'doodle.one', name: 'Um Só Gesto', icon: '☝️', desc: 'Resolve um nível do Traço a Traço com um único traço.', test: c => c.result.won && (c.result.meta && c.result.meta.strokes) === 1 },
    ],
  };
  const KIT = ArcadeKit.create(spec);
  KIT._dbg = {
    LV,
    /* aplica a solução do nível (testes): ações sem t antes de começar */
    apply(G) { (G.L.sol || []).forEach(a => { if (a.t) return; const it = DoodleSim.apply(G.S, a); if (it) { it.born = G.t; G.acts.push(Object.assign({}, a)); } }); committed(G); },
  };
  return KIT;
})();
