/* ══════════════════════════════════════════════════════════════════
   Contas Rápidas (Quick Maths) — contas cada vez mais difíceis contra
   o relógio. Teclado numérico no ecrã (e o do computador); a resposta
   é verificada sozinha quando tem os algarismos todos. 9 níveis: de
   somas simples a a×b+c, quadrados e percentagens. Sem negativos nem
   decimais — é cálculo mental, não uma calculadora.
══════════════════════════════════════════════════════════════════ */
const QuickMathsGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const R = U.randi;
  const DIFF = {
    easy:   { lv0: 1, every: 6, surv: [10, 5.5] },
    medium: { lv0: 2, every: 5, surv: [8, 4.2] },
    hard:   { lv0: 3, every: 4, surv: [6.5, 3.2] },
  };

  /* gerador por nível → { q: 'texto', a: número } */
  function gen(lv) {
    let a, b, c;
    switch (Math.min(9, lv)) {
      case 1: a = R(1, 9); b = R(1, 9); return { q: `${a} + ${b}`, a: a + b };
      case 2: if (Math.random() < .5) { a = R(5, 15); b = R(2, 9); return { q: `${a} + ${b}`, a: a + b }; } a = R(10, 20); b = R(2, a - 1); return { q: `${a} − ${b}`, a: a - b };
      case 3: a = R(2, 9); b = R(2, 9); return { q: `${a} × ${b}`, a: a * b };
      case 4: if (Math.random() < .5) { a = R(12, 68); b = R(11, 39); return { q: `${a} + ${b}`, a: a + b }; } a = R(30, 99); b = R(11, a - 5); return { q: `${a} − ${b}`, a: a - b };
      case 5: if (Math.random() < .5) { b = R(2, 10); a = R(2, 10); return { q: `${a * b} ÷ ${b}`, a }; } a = R(2, 12); b = R(3, 9); return { q: `${a} × ${b}`, a: a * b };
      case 6: a = R(11, 19); b = R(2, 9); return Math.random() < .6 ? { q: `${a} × ${b}`, a: a * b } : { q: `${a * b} ÷ ${a}`, a: b };
      case 7: a = R(2, 9); b = R(2, 9); c = R(2, 25); return Math.random() < .5 ? { q: `${a} × ${b} + ${c}`, a: a * b + c } : (a * b > c ? { q: `${a} × ${b} − ${c}`, a: a * b - c } : { q: `${a} × ${b} + ${c}`, a: a * b + c });
      case 8: if (Math.random() < .5) { a = R(4, 16); return { q: `${a}²`, a: a * a }; } a = R(2, 9); b = R(2, 9); c = R(2, 6); return { q: `(${a} + ${b}) × ${c}`, a: (a + b) * c };
      default: {
        const p = U.pick([10, 20, 25, 50, 75]);
        const base = p === 25 || p === 75 ? R(1, 12) * 4 : p === 20 ? R(1, 15) * 5 : R(1, 18) * 10;
        return Math.random() < .5 ? { q: `${p}% de ${base}`, a: base * p / 100 } : (() => { a = R(12, 25); b = R(3, 9); return { q: `${a} × ${b}`, a: a * b }; })();
      }
    }
  }

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    const mode = o.mode || 'rush';
    const G = { cfg, mode, lv: cfg.lv0, ok: 0, bad: 0, score: 0, streak: 0, best: 0, lives: 3, time: mode === 'rush' ? 60 : 0, left: 0, max: 1, cur: null, typed: '', times: [], t0: 0, started: false, over: false };
    build(G, api);
    return G;
  }

  function build(G, api) {
    const L = api.layer;
    L.innerHTML = `
      <div class="qm">
        <div class="qm-bar"><span class="qm-bar-fill"></span></div>
        <div class="qm-card">
          <div class="qm-lv">Nível <b>${G.lv}</b></div>
          <div class="qm-q">?</div>
          <div class="qm-a"><span class="qm-eq">=</span><span class="qm-typed">&nbsp;</span></div>
          <div class="qm-fb" aria-live="polite"></div>
        </div>
        <div class="qm-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button type="button" data-k="${d}">${d}</button>`).join('')}
          <button type="button" data-k="skip" class="qm-alt" aria-label="Passar">Passar</button>
          <button type="button" data-k="0">0</button>
          <button type="button" data-k="back" class="qm-alt" aria-label="Apagar">⌫</button>
        </div>
      </div>`;
    if (!document.getElementById('qm-css')) {
      const s = document.createElement('style'); s.id = 'qm-css';
      s.textContent = `
.qm{position:absolute;inset:0;display:flex;flex-direction:column;padding:66px 16px 16px;gap:12px;background:radial-gradient(ellipse at 50% 20%,#15254d,#070b19 70%);color:#eef2ff}
.qm-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;flex:0 0 auto}
.qm-bar-fill{display:block;height:100%;width:100%;border-radius:99px;background:linear-gradient(90deg,#60a5fa,#fbbf24);transition:width .1s linear}
.qm-bar-fill.low{background:linear-gradient(90deg,#ef4444,#f97316)}
.qm-card{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:20px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);position:relative;overflow:hidden}
.qm-card.ok{animation:qmOk .35s}.qm-card.bad{animation:qmBad .4s}
@keyframes qmOk{0%{box-shadow:inset 0 0 0 0 rgba(34,197,94,.0)}30%{box-shadow:inset 0 0 0 3px rgba(34,197,94,.9),0 0 30px rgba(34,197,94,.35)}100%{box-shadow:inset 0 0 0 0 rgba(34,197,94,0)}}
@keyframes qmBad{0%,100%{transform:none}20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}
.qm-lv{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#93c5fd}
.qm-lv b{color:#fbbf24}
.qm-q{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:800;font-size:clamp(2.2rem,11vw,3.6rem);line-height:1.1;text-align:center;font-variant-numeric:tabular-nums;animation:qmIn .25s cubic-bezier(.2,1.3,.4,1)}
@keyframes qmIn{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}
.qm-a{display:flex;align-items:baseline;gap:12px;font-family:'Space Grotesk',system-ui,sans-serif;font-size:clamp(1.8rem,9vw,2.8rem);font-weight:800}
.qm-eq{color:#64748b}
.qm-typed{min-width:2.6ch;padding:0 .3ch;text-align:center;border-bottom:3px solid #60a5fa;color:#fff;font-variant-numeric:tabular-nums}
.qm-fb{min-height:1.3em;font-size:.9rem;font-weight:700;color:#86efac}
.qm-fb.bad{color:#fca5a5}
.qm-pad{flex:0 0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.qm-pad button{height:clamp(48px,8.5vh,64px);border-radius:14px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.04));color:#fff;font:800 1.45rem 'Space Grotesk',system-ui,sans-serif;cursor:pointer;touch-action:manipulation;transition:transform .08s,background .15s}
.qm-pad button:hover{background:rgba(255,255,255,.14)}
.qm-pad button:active,.qm-pad button.hit{transform:scale(.94);background:rgba(96,165,250,.3)}
.qm-pad .qm-alt{font-size:.95rem;color:#cbd5e1}
@media (prefers-reduced-motion:reduce){.qm-card.ok,.qm-card.bad,.qm-q{animation:none}}`;
      document.head.appendChild(s);
    }
    L.querySelector('.qm-pad').addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      e.preventDefault();
      b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 110);
      press(G, api, b.dataset.k);
    });
    G.el = { q: L.querySelector('.qm-q'), typed: L.querySelector('.qm-typed'), fb: L.querySelector('.qm-fb'), card: L.querySelector('.qm-card'), bar: L.querySelector('.qm-bar-fill'), lv: L.querySelector('.qm-lv b') };
  }

  function next(G, api) {
    let p; do { p = gen(G.lv); } while (G.cur && p.q === G.cur.q);
    G.cur = p; G.typed = ''; G.t0 = G.clock || 0;
    if (G.mode === 'survival') { const k = Math.min(1, G.ok / 40); G.max = U.lerp(G.cfg.surv[0], G.cfg.surv[1], k) + (G.lv >= 7 ? 1.5 : 0); G.left = G.max; }
    G.el.q.textContent = p.q;
    G.el.q.style.animation = 'none'; void G.el.q.offsetWidth; G.el.q.style.animation = '';
    G.el.typed.innerHTML = '&nbsp;';
    G.el.lv.textContent = G.lv;
  }

  function flashCard(G, cls) { const c = G.el.card; c.classList.remove('ok', 'bad'); void c.offsetWidth; c.classList.add(cls); }

  function press(G, api, k) {
    if (G.over || !G.started || api.state !== 'play') return;
    if (k === 'back') { G.typed = G.typed.slice(0, -1); api.sfx.tone(500, .03, 'square', .03); }
    else if (k === 'skip') { wrong(G, api, 'skip'); return; }
    else if (/^\d$/.test(k)) {
      if (G.typed.length >= 5) return;
      G.typed += k; api.sfx.tone(700 + (+k) * 30, .04, 'triangle', .04);
    }
    G.el.typed.textContent = G.typed || ' ';
    const ans = String(G.cur.a);
    if (G.typed.length >= ans.length) { if (G.typed === ans) right(G, api); else wrong(G, api); }
  }

  function right(G, api) {
    G.ok++; G.streak++; G.best = Math.max(G.best, G.streak);
    const pts = G.lv + (G.streak >= 5 ? 2 : 0);
    G.score += pts;
    G.times.push((G.clock || 0) - G.t0);
    G.el.fb.className = 'qm-fb'; G.el.fb.textContent = G.streak >= 5 ? `Certo! Série ×${G.streak} (+${pts})` : `Certo! +${pts}`;
    flashCard(G, 'ok');
    api.sfx.tone(880 + Math.min(G.streak, 12) * 40, .1, 'sine', .08); api.vibe(8);
    if (G.mode === 'rush' && G.streak % 5 === 0) { G.time += 2; G.el.fb.textContent += ' · +2s'; }
    const nl = G.cfg.lv0 + Math.floor(G.ok / G.cfg.every);
    if (nl > G.lv && G.lv < 9) { G.lv = Math.min(9, nl); api.banner('Nível ' + G.lv, levelName(G.lv)); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .07); }
    next(G, api);
  }

  function levelName(lv) { return ['', 'Somas', 'Somas e subtrações', 'Tabuada', 'Dois algarismos', 'Divisões', 'Tabuada grande', 'Contas em dois passos', 'Quadrados e parênteses', 'Percentagens'][lv] || ''; }

  function wrong(G, api, why) {
    G.bad++; G.streak = 0;
    G.el.fb.className = 'qm-fb bad'; G.el.fb.textContent = (why === 'skip' ? 'Passaste' : why === 'time' ? 'Acabou o tempo' : 'Errado') + ` — era ${G.cur.a}`;
    flashCard(G, 'bad'); api.vibe(60);
    api.sfx.tone(200, .15, 'square', .06);
    if (G.mode === 'rush') { G.time = Math.max(0, G.time - 3); }
    else { G.lives--; if (G.lives <= 0) { end(G, api); return; } }
    next(G, api);
  }

  function end(G, api) {
    if (G.over) return;
    G.over = true;
    const acc = G.ok + G.bad ? Math.round(100 * G.ok / (G.ok + G.bad)) : 0;
    const avg = G.times.length ? (G.times.reduce((a, b) => a + b, 0) / G.times.length).toFixed(1) + 's' : '—';
    api.over({ score: G.score, won: G.mode === 'rush', delay: 400, title: G.mode === 'rush' ? 'Tempo!' : 'Sem vidas', icon: '🧮',
      stats: [['Certas', G.ok], ['Precisão', acc + '%'], ['Nível', G.lv], ['Tempo médio', avg], ['Melhor série', G.best]],
      meta: { ok: G.ok, lv: G.lv } });
  }

  function update(G, dt, api) {
    G.clock = (G.clock || 0) + dt;
    if (G.mode === 'rush') {
      G.time -= dt;
      const k = Math.max(0, G.time / 60);
      G.el.bar.style.width = (k * 100) + '%'; G.el.bar.classList.toggle('low', G.time < 10);
      if (G.time <= 0) { G.time = 0; end(G, api); }
    } else {
      G.left -= dt;
      const k = Math.max(0, G.left / G.max);
      G.el.bar.style.width = (k * 100) + '%'; G.el.bar.classList.toggle('low', k < .3);
      if (G.left <= 0) wrong(G, api, 'time');
    }
  }

  return ArcadeKit.create({
    id: 'quick-maths', title: 'Contas Rápidas', icon: '➗',
    accent: '#60a5fa', accent2: '#fbbf24', bg: '#070b19', canvas: false,
    tagline: 'Cálculo mental contra o relógio. Começa fácil e não fica fácil por muito tempo.',
    view: { w: 400 },
    modes: [
      { id: 'rush', icon: '⏱️', name: 'Contra-relógio', desc: '60 segundos. Errar tira 3 s; cada 5 certas seguidas dá +2 s.' },
      { id: 'survival', icon: '❤️', name: 'Sobrevivência', desc: 'Cada conta tem o seu tempo, cada vez mais curto. 3 vidas.' },
    ],
    how: [
      'Escreve a resposta no teclado do ecrã (ou no do computador). Assim que tiver os algarismos todos, é verificada.',
      'A cada poucas contas certas sobes de nível: somas, tabuada, divisões, contas em dois passos, quadrados, percentagens.',
      'Níveis mais altos valem mais pontos; séries de 5 dão bónus. <b>Passar</b> conta como erro.',
    ],
    controls: ['🖱️ Teclado no ecrã', '👆 Toque', '⌨️ Algarismos + Backspace'],
    ready: { title: 'Toca para começar', hint: 'A primeira conta aparece logo a seguir.' },
    setup, update,
    begin: (G, api) => { G.started = true; next(G, api); },
    key: (G, e, api) => {
      if (/^\d$/.test(e.key)) { press(G, api, e.key); return true; }
      if (e.key === 'Backspace') { press(G, api, 'back'); return true; }
    },
    hud: G => [['Pontos', G.score], G.mode === 'rush' ? ['Tempo', Math.ceil(G.time) + 's', G.time < 10 ? 'hot' : ''] : ['Vidas', '❤'.repeat(Math.max(0, G.lives)) || '—'], ['Série', G.streak, G.streak >= 5 ? 'hot' : '']],
    achievements: [
      { id: 'qm.30',  name: 'Calculadora Humana', icon: '🧮', desc: '30 contas certas numa só partida.', test: c => ((c.result.meta || {}).ok || 0) >= 30 },
      { id: 'qm.lv9', name: 'Mestre das Percentagens', icon: '💯', desc: 'Chega ao nível 9 nas Contas Rápidas.', test: c => ((c.result.meta || {}).lv || 0) >= 9 },
    ],
  });
})();
