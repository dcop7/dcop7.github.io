/* ══════════════════════════════════════════════════════════════════
   ArcadeKit — casca comum dos jogos arcade em canvas (set/2026).

   Não é um motor novo: junta as peças que já existiam
     • CanvasEngine (src/games/engine/canvas.js) → canvas + ciclo rAF
     • Particles    (src/games/engine/particles.js) → explosões/faíscas
     • GameProgress (js/games/game-progress.js) → recordes, conquistas
     • GameHost.diffSeg → seletor de dificuldade por jogo
   e dá a todos o mesmo menu, HUD, pausa, ecrã de fim e som, para que os
   15 jogos arcade se comportem igual (e igual aos que já lá estavam).

   Cada jogo descreve-se com um objeto `spec` e implementa só a jogabilidade:
     setup(api, {mode, diff})       → estado novo G (cada partida)
     update(G, dt, api)             → lógica (só corre a jogar)
     draw(G, ctx, W, H, api)        → pintura em coordenadas lógicas
     down/move/up(G, x, y, api, e)  → ponteiro (rato e toque iguais)
     hud(G)                         → [[rótulo, valor], …]
   e chama api.over({score, won, stats}) quando a partida acaba.

   Coordenadas lógicas: spec.view = {w} → largura fixa, altura variável
   (jogos verticais); {w, h} → caixa fixa com letterbox.
══════════════════════════════════════════════════════════════════ */
const ArcadeKit = (function () {
  'use strict';

  /* ── som e vibração (partilhados pelos jogos arcade; OFF por defeito,
     como no Olho Vivo) ─────────────────────────────────────────────── */
  const pref = (k, d) => { try { const v = localStorage.getItem('arcade:' + k); return v == null ? d : v === '1'; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('arcade:' + k, v ? '1' : '0'); } catch (e) {} };
  const soundOn = () => pref('sound', false) && !(typeof GameAudio !== 'undefined' && GameAudio.muted);
  const vibeOn = () => pref('vibe', false);
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  let _ac = null;
  function audio() {
    if (!soundOn()) return null;
    try {
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
      if (_ac.state === 'suspended') _ac.resume();
      return _ac;
    } catch (e) { return null; }
  }
  const sfx = {
    /* tom simples com envelope; slide = frequência final (glissando) */
    tone(freq, dur = .1, type = 'sine', vol = .12, when = 0, slide = 0) {
      const c = audio(); if (!c) return;
      const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + .006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .03);
    },
    /* ruído filtrado (impactos, whoosh, explosões) */
    noise(dur = .15, vol = .1, when = 0, freq = 1200, type = 'bandpass') {
      const c = audio(); if (!c) return;
      const t = c.currentTime + when, n = Math.max(1, Math.floor(c.sampleRate * dur));
      const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(); s.buffer = b;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
    },
    arp(freqs, step = .07, dur = .12, type = 'sine', vol = .1) { freqs.forEach((f, i) => sfx.tone(f, dur, type, vol, i * step)); },
    win()  { sfx.arp([523, 659, 784, 1047], .09, .16, 'triangle', .11); },
    lose() { sfx.tone(330, .22, 'sawtooth', .07, 0, 160); sfx.tone(196, .35, 'triangle', .08, .16, 90); },
    click() { sfx.tone(900, .04, 'square', .04); },
  };
  function vibe(p) { if (!vibeOn()) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  const GP = () => (typeof GameProgress !== 'undefined' ? GameProgress : null);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ── CSS (injetado uma vez; prefixo ak-) ───────────────────────── */
  function injectCSS() {
    if (document.getElementById('ak-css')) return;
    const s = document.createElement('style'); s.id = 'ak-css';
    s.textContent = `
.ak-wrap{max-width:1000px;margin:0 auto;padding:2px 0 18px}
.ak-wrap.portrait{max-width:560px}
/* ── menu ── */
.ak-hero{position:relative;border-radius:18px;overflow:hidden;min-height:170px;display:flex;flex-direction:column;justify-content:flex-end;padding:18px 18px 16px;background:var(--ak-bg);border:1px solid rgba(255,255,255,.08);box-shadow:0 14px 40px rgba(0,0,0,.35);isolation:isolate}
.ak-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transform:scale(1.02)}
.ak-hero::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(6,8,16,.05) 0%,rgba(6,8,16,.55) 55%,rgba(6,8,16,.94) 100%)}
.ak-hero-ico{font-size:2.1rem;line-height:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))}
.ak-hero h2{margin:6px 0 2px;font-family:var(--font-head,sans-serif);font-size:1.75rem;font-weight:800;color:#fff;letter-spacing:-.01em;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.ak-hero p{margin:0;color:rgba(255,255,255,.86);font-size:.9rem;max-width:520px;line-height:1.4}
.ak-bests{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.ak-best{background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 11px;font-size:.74rem;color:rgba(255,255,255,.8);backdrop-filter:blur(4px)}
.ak-best b{color:var(--ak);font-weight:800}
.ak-play{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin:14px 0 0;padding:15px 18px;border:none;border-radius:14px;font:inherit;font-size:1.08rem;font-weight:800;color:#0b0d16;cursor:pointer;background:linear-gradient(120deg,var(--ak),var(--ak2));box-shadow:0 10px 26px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.08) inset;transition:transform .15s,box-shadow .15s}
.ak-play:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(0,0,0,.34)}
.ak-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:14px}
.ak-mode{display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border-radius:14px;border:1px solid var(--border,rgba(255,255,255,.1));background:var(--card,rgba(255,255,255,.03));color:inherit;font:inherit;cursor:pointer;transition:border-color .15s,transform .15s,box-shadow .15s}
.ak-mode:hover{border-color:var(--ak);transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.22)}
.ak-mode.on{border-color:var(--ak);box-shadow:0 0 0 1px var(--ak) inset;background:color-mix(in srgb,var(--ak) 10%,transparent)}
.ak-chip:disabled{opacity:.4;cursor:not-allowed}
.ak-mode-ico{font-size:1.6rem;flex:0 0 auto}
.ak-mode-body{flex:1;min-width:0}
.ak-mode-body b{display:block;font-size:.95rem}
.ak-mode-body small{display:block;color:var(--muted,#9aa);font-size:.74rem;line-height:1.3;margin-top:2px}
.ak-mode-best{flex:0 0 auto;text-align:right;font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#9aa)}
.ak-mode-best b{display:block;font-size:.95rem;color:var(--ak);letter-spacing:0}
.ak-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:16px}
.ak-spacer{flex:1}
.ak-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border,rgba(255,255,255,.14));background:transparent;color:inherit;border-radius:999px;padding:6px 12px;font:inherit;font-size:.8rem;cursor:pointer;transition:all .15s}
.ak-chip:hover{border-color:var(--ak)}
.ak-chip.on{background:color-mix(in srgb,var(--ak) 18%,transparent);border-color:var(--ak);color:var(--ak)}
.ak-how{margin-top:16px;display:grid;gap:8px}
.ak-how-step{display:flex;gap:10px;align-items:flex-start;font-size:.86rem;color:var(--text2,#c5cad6);line-height:1.45}
.ak-how-step i{font-style:normal;flex:0 0 26px;height:26px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--ak) 16%,transparent);color:var(--ak);font-weight:800;font-size:.8rem}
.ak-ctrl{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.ak-ctrl span{font-size:.74rem;color:var(--muted,#9aa);border:1px dashed var(--border,rgba(255,255,255,.14));border-radius:8px;padding:4px 9px}
.ak-extra{margin-top:14px}
.ak-h3{margin:18px 0 0;font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted,#9aa);font-weight:700}
/* ── palco ── */
.ak-stage{position:relative;margin:0 auto;height:min(760px,calc(100dvh - 176px));min-height:400px;border-radius:18px;overflow:hidden;background:var(--ak-bg);user-select:none;-webkit-user-select:none;touch-action:none;overscroll-behavior:contain;box-shadow:0 18px 50px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.07);-webkit-tap-highlight-color:transparent}
.ak-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.ak-stage{animation:akStageIn .38s cubic-bezier(.2,.9,.3,1) both}
@keyframes akStageIn{from{opacity:0;transform:scale(.965) translateY(6px)}to{opacity:1;transform:none}}
.ak-cell b{display:inline-block;transition:color .2s}
.ak-cell.bump b{animation:akBump .32s cubic-bezier(.3,1.6,.5,1)}
@keyframes akBump{0%{transform:scale(1)}40%{transform:scale(1.28)}100%{transform:scale(1)}}
.ak-layer{position:absolute;inset:0;overflow:hidden}
.ak-hud{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;gap:8px;padding:10px 10px 18px;background:linear-gradient(180deg,rgba(0,0,0,.5),transparent);pointer-events:none}
.ak-hud-mid{flex:1;display:flex;justify-content:center;gap:14px;flex-wrap:nowrap;min-width:0;overflow:hidden}
.ak-cell{display:flex;flex-direction:column;align-items:center;line-height:1.05;min-width:44px}
.ak-cell small{font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.62);font-weight:700}
.ak-cell b{font-size:1.18rem;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.ak-cell.hot b{color:var(--ak)}
.ak-hbtn{pointer-events:auto;width:40px;height:40px;flex:0 0 auto;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(10,12,22,.55);color:#fff;font-size:1rem;cursor:pointer;display:grid;place-items:center;backdrop-filter:blur(6px);transition:background .15s}
.ak-hbtn:hover{background:rgba(255,255,255,.14)}
.ak-ov{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,7,14,.62);backdrop-filter:blur(5px);animation:akFade .22s ease both}
.ak-ov.ready{z-index:4;background:linear-gradient(180deg,rgba(5,7,14,.25),rgba(5,7,14,.55));backdrop-filter:none;cursor:pointer}   /* por baixo do HUD: ✕/pausa/som continuam a funcionar */
@keyframes akFade{from{opacity:0}to{opacity:1}}
.ak-panel{width:min(400px,100%);max-height:100%;overflow:auto;text-align:center;background:rgba(18,20,34,.94);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:22px 20px;box-shadow:0 24px 70px rgba(0,0,0,.55);color:#eef0f7;animation:akPop .32s cubic-bezier(.2,1.3,.4,1) both;position:relative;overflow:hidden}
@keyframes akPop{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
.ak-panel-ico{font-size:2.4rem;line-height:1}
.ak-panel h3{margin:8px 0 2px;font-size:1.25rem;font-family:var(--font-head,sans-serif)}
.ak-panel p{margin:4px 0 0;color:rgba(238,240,247,.7);font-size:.88rem;line-height:1.4}
.ak-big{font-family:var(--font-head,sans-serif);font-size:3.2rem;font-weight:800;line-height:1.05;margin:8px 0 0;color:#fff;font-variant-numeric:tabular-nums}
.ak-big.rec{background:linear-gradient(120deg,var(--ak),var(--ak2));-webkit-background-clip:text;background-clip:text;color:transparent}
.ak-rec{color:var(--ak);font-weight:800;font-size:.9rem;margin-top:2px}
.ak-stars{font-size:1.7rem;letter-spacing:4px;margin-top:6px}
.ak-stars .off{opacity:.22;filter:grayscale(1)}
.ak-stats{display:flex;justify-content:center;flex-wrap:wrap;gap:8px 18px;margin:14px 0 4px}
.ak-stats div b{display:block;font-size:1.05rem;font-variant-numeric:tabular-nums}
.ak-stats div small{font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;color:rgba(238,240,247,.55)}
.ak-btns{display:flex;flex-direction:column;gap:8px;margin-top:16px}
.ak-btn{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#eef0f7;border-radius:12px;padding:12px 16px;font:inherit;font-size:.95rem;font-weight:700;cursor:pointer;transition:background .15s,transform .15s}
.ak-btn:hover{background:rgba(255,255,255,.12)}
.ak-btn.primary{border:none;color:#0b0d16;background:linear-gradient(120deg,var(--ak),var(--ak2))}
.ak-btn.primary:hover{transform:translateY(-1px)}
.ak-ready{text-align:center;color:#fff;pointer-events:none;padding:16px}
.ak-ready b{display:block;font-family:var(--font-head,sans-serif);font-size:1.5rem;font-weight:800;text-shadow:0 3px 14px rgba(0,0,0,.7)}
.ak-ready span{display:block;margin-top:6px;font-size:.9rem;color:rgba(255,255,255,.85);text-shadow:0 2px 8px rgba(0,0,0,.8);max-width:320px}
.ak-ready .ak-tap{margin:14px auto 0;width:54px;height:54px;border-radius:50%;border:2px solid rgba(255,255,255,.8);animation:akTap 1.3s ease-in-out infinite}
@keyframes akTap{0%,100%{transform:scale(.8);opacity:.45}50%{transform:scale(1.05);opacity:1}}
.ak-banner{position:absolute;left:50%;top:22%;z-index:8;transform:translateX(-50%);pointer-events:none;white-space:nowrap;font-family:var(--font-head,sans-serif);font-weight:800;font-size:1.5rem;color:#fff;text-shadow:0 3px 16px rgba(0,0,0,.7),0 0 22px var(--ak);animation:akBanner 1.5s ease forwards}
.ak-banner small{display:block;text-align:center;font-size:.8rem;font-weight:700;color:var(--ak);text-shadow:0 2px 8px rgba(0,0,0,.8)}
@keyframes akBanner{0%{opacity:0;transform:translate(-50%,10px) scale(.85)}15%{opacity:1;transform:translate(-50%,0) scale(1.04)}25%{transform:translate(-50%,0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px)}}
.ak-conf{position:absolute;inset:0;pointer-events:none}
.ak-conf i{position:absolute;top:-14px;left:calc(var(--i)*5.4%);width:7px;height:11px;border-radius:2px;background:hsl(calc(var(--i)*41),90%,62%);animation:akConf 1.8s calc(var(--i)*.07s) ease-in forwards}
@keyframes akConf{to{transform:translateY(560px) rotate(640deg);opacity:.3}}
@media (max-width:600px){
  .ak-stage{height:calc(100dvh - 172px);min-height:380px;border-radius:14px}
  .ak-hero{min-height:150px}
  .ak-hero h2{font-size:1.45rem}
}
@media (max-width:440px){
  .ak-hud{gap:6px;padding:8px 8px 16px}
  .ak-hud-mid{gap:8px}
  .ak-cell{min-width:34px}
  .ak-cell b{font-size:1.02rem}
  .ak-hbtn{width:36px;height:36px;border-radius:10px}
}
@media (prefers-reduced-motion:reduce){.ak-panel,.ak-ov,.ak-banner,.ak-conf i,.ak-ready .ak-tap,.ak-stage,.ak-cell.bump b{animation:none!important}}`;
    document.head.appendChild(s);
  }

  /* ════════════════════════════════════════════════════════════════
     create(spec) → { init(paneEl) } — o formato que o GameHost espera
  ════════════════════════════════════════════════════════════════ */
  function create(spec) {
    const id = spec.id;
    const portrait = spec.aspect !== 'wide';
    let root = null, S = null, _wired = false;

    const diffOf = () => (spec.diff === false ? null
      : (typeof GameHost !== 'undefined' && GameHost.diffGet ? GameHost.diffGet(id, spec.defDiff || 'medium') : 'medium'));
    /* chave do recorde: modo + dificuldade (a da sessão, se já houver uma) */
    const modeList = () => (typeof spec.modes === 'function' ? spec.modes() : spec.modes) || [];
    const modeKey = (mode, diff) => {
      /* modos com noDiff (ex.: General a solo) têm um só recorde, seja qual for a dificuldade */
      const d = (spec.noDiff ? spec.noDiff(mode) : modeList().some(m => m.id === mode && m.noDiff)) ? null : diff !== undefined ? diff : diffOf();
      return [mode, d].filter(Boolean).join('-') || 'default';
    };
    const fmtScore = v => (spec.scoreFmt ? spec.scoreFmt(v) : String(v));
    const bestOf = mode => { const g = GP(); return g ? g.bestScore(id, modeKey(mode)) : null; };

    if (GP() && spec.achievements) GP().defineAchievements(id, spec.achievements);

    /* ── menu ─────────────────────────────────────────────────────── */
    function renderMenu() {
      stop();
      const st = GP() ? GP().stats(id) : { plays: 0 };
      const modes = (typeof spec.modes === 'function' ? spec.modes() : spec.modes) || null;   /* função = modos dinâmicos (ex.: "Continuar") */
      const b0 = modes ? null : bestOf(null);
      root.innerHTML = `
        <div class="ak-wrap ${portrait ? 'portrait' : 'wide'}" style="--ak:${spec.accent};--ak2:${spec.accent2 || spec.accent};--ak-bg:${spec.bg || '#0b0e1a'}">
          <div class="ak-hero">
            <img src="assets/games/${id}.jpg" alt="" onerror="this.remove()">
            <div class="ak-hero-ico">${spec.icon}</div>
            <h2>${esc(spec.title)}</h2>
            <p>${esc(spec.tagline)}</p>
            <div class="ak-bests">
              ${!modes && !spec.picker ? `<span class="ak-best">${spec.bestLabel || 'Recorde'}: <b>${b0 != null ? esc(fmtScore(b0)) : '—'}</b></span>` : ''}
              <span class="ak-best">Partidas: <b>${st.plays || 0}</b></span>
            </div>
          </div>
          ${spec.picker ? `<div class="ak-picker">${spec.picker.html(bestOf)}</div>` : modes ? `<div class="ak-modes">${modes.map(m => {
            const b = m.noBest ? null : bestOf(m.id);
            return `<button class="ak-mode" data-mode="${m.id}">
              <span class="ak-mode-ico">${m.icon}</span>
              <span class="ak-mode-body"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></span>
              ${m.noBest ? (m.note ? `<span class="ak-mode-best">${esc(m.note)}</span>` : '') : `<span class="ak-mode-best">${m.bestLabel || spec.bestLabel || 'Recorde'}<b>${b != null ? esc(fmtScore(b)) : '—'}</b></span>`}
            </button>`; }).join('')}</div>`
          : `<button class="ak-play" data-mode="">▶ Jogar</button>`}
          ${spec.menuHTML ? `<div class="ak-extra">${spec.menuHTML()}</div>` : ''}
          <div class="ak-row">
            <span id="ak-diff"></span>
            <span class="ak-spacer"></span>
            <button class="ak-chip${pref('sound', false) ? ' on' : ''}" id="ak-snd" aria-pressed="${pref('sound', false)}">🔊 Som</button>
            ${'vibrate' in navigator ? `<button class="ak-chip${vibeOn() ? ' on' : ''}" id="ak-vib" aria-pressed="${vibeOn()}">📳 Vibração</button>` : ''}
          </div>
          <div class="ak-h3">Como jogar</div>
          <div class="ak-how">${(spec.how || []).map((h, i) => `<div class="ak-how-step"><i>${i + 1}</i><span>${h}</span></div>`).join('')}</div>
          ${spec.controls ? `<div class="ak-ctrl">${spec.controls.map(c => `<span>${c}</span>`).join('')}</div>` : ''}
        </div>`;
      if (spec.diff !== false && typeof GameHost !== 'undefined' && GameHost.diffSeg) {
        root.querySelector('#ak-diff').appendChild(GameHost.diffSeg(id, {
          def: spec.defDiff || 'medium', levels: spec.diffLevels,
          onChange: () => renderMenu(),
        }));
      }
      root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => start(b.dataset.mode || null)));
      const snd = root.querySelector('#ak-snd');
      snd.addEventListener('click', () => { const v = !pref('sound', false); setPref('sound', v); snd.classList.toggle('on', v); snd.setAttribute('aria-pressed', v); if (v) sfx.click(); });
      const vib = root.querySelector('#ak-vib');
      vib && vib.addEventListener('click', () => { const v = !vibeOn(); setPref('vibe', v); vib.classList.toggle('on', v); vib.setAttribute('aria-pressed', v); vibe(20); });
      /* bloco extra do jogo (ex.: escolha de personagem) */
      if (spec.menuWire) spec.menuWire(root.querySelector('.ak-extra'), renderMenu);
      /* seletor próprio do jogo (ex.: cenário → tamanho → modo) */
      if (spec.picker) spec.picker.wire(root.querySelector('.ak-picker'), m => start(m), bestOf);
      if (window.Motion && Motion.stagger) Motion.stagger(root.querySelectorAll('.ak-mode,.ak-play,.ak-how-step'), { y: 8, step: 30 });
    }

    /* ── sessão de jogo ───────────────────────────────────────────── */
    function stop() {
      if (!S) return;
      /* recursos do próprio jogo (ex.: cena WebGL) */
      if (spec.destroy && S.G) { try { spec.destroy(S.G); } catch (e) {} }
      S.dead = true;
      if (S.eng) S.eng.destroy();
      if (S.raf) cancelAnimationFrame(S.raf);
      window.removeEventListener('keydown', S.onKey);
      window.removeEventListener('keyup', S.onKeyUp);
      window.removeEventListener('blur', S.onBlur);
      S = null;
    }

    function start(mode) {
      stop();
      const diff = diffOf();
      root.innerHTML = `
        <div class="ak-wrap ${portrait ? 'portrait' : 'wide'}" style="--ak:${spec.accent};--ak2:${spec.accent2 || spec.accent};--ak-bg:${spec.bg || '#0b0e1a'}">
          <div class="ak-stage ${portrait ? 'portrait' : 'wide'}" style="${portrait ? 'max-width:520px' : ''}">
            ${spec.canvas === false ? '<div class="ak-layer"></div>' : '<canvas class="ak-cv" tabindex="0" aria-label="' + esc(spec.title) + '"></canvas>'}
            <div class="ak-hud">
              <button class="ak-hbtn" data-a="quit" aria-label="Sair">✕</button>
              <div class="ak-hud-mid"></div>
              <button class="ak-hbtn" data-a="snd" aria-label="Som">${soundOn() ? '🔊' : '🔇'}</button>
              <button class="ak-hbtn" data-a="pause" aria-label="Pausa">⏸</button>
            </div>
          </div>
        </div>`;
      const stage = root.querySelector('.ak-stage');
      const cv = root.querySelector('.ak-cv');
      const hudMid = root.querySelector('.ak-hud-mid');

      const sess = S = {
        mode, diff, state: 'ready', G: null, eng: null, dead: false,
        W: spec.view.w, H: spec.view.h || 600, s: 1, ox: 0, oy: 0, cssW: 0, cssH: 0,
        parts: (typeof Particles !== 'undefined') ? Particles.create() : null,
        floats: [], shakeT: 0, shakeM: 0, shakeD: .25, shakeP: 0, flashT: 0, flashC: '#fff', t: 0, hudStr: '', hudVals: [],
        stopT: 0, slowT: 0, slowK: 1,
        ptrs: new Map(), onKey: null,
      };

      function fit(cssW, cssH) {
        sess.cssW = cssW; sess.cssH = cssH;
        const v = spec.view;
        if (v.h) {
          sess.s = Math.min(cssW / v.w, cssH / v.h);
          sess.W = v.w; sess.H = v.h;
          sess.ox = (cssW - v.w * sess.s) / 2; sess.oy = (cssH - v.h * sess.s) / 2;
        } else {
          sess.s = cssW / v.w; sess.W = v.w; sess.H = cssH / sess.s; sess.ox = 0; sess.oy = 0;
        }
        if (sess.G && spec.resize) spec.resize(sess.G, sess.W, sess.H, api);
      }

      /* API entregue ao jogo */
      const api = {
        sfx, vibe, reduced: reduced(),
        get W() { return sess.W; }, get H() { return sess.H; },
        get t() { return sess.t; },
        get mode() { return sess.mode; }, get diff() { return sess.diff; },
        get state() { return sess.state; },
        get ptrs() { return sess.ptrs; },
        /* deslocamento atual do tremor (px lógicos) — para jogos 3D abanarem a câmara */
        get shakeXY() { return [sess.sx || 0, sess.sy || 0]; },
        get layer() { return root.querySelector('.ak-layer'); },
        get stage() { return stage; },
        get best() { return GP() ? GP().bestScore(id, modeKey(sess.mode, sess.diff)) : null; },
        /* retomar uma partida guardada noutro modo/dificuldade */
        setMode(m, d) { sess.mode = m; if (d !== undefined) sess.diff = d; },
        parts: sess.parts,
        burst(x, y, n, o) { if (sess.parts) sess.parts.spawnBurst(x, y, n, o || {}); },
        spark(o) { if (sess.parts) sess.parts.spawn(o); },
        float(x, y, text, color, size) { const m = Math.min(sess.W / 2, String(text).length * (size || 20) * .3 + 8); x = Math.max(m, Math.min(sess.W - m, x)); sess.floats.push({ x, y, y0: y, text, color: color || '#fff', size: size || 20, life: 1, max: 1 }); },
        /* tremor amortecido (onda com fase aleatória), não ruído branco a cada frame */
        shake(m, d) { if (reduced()) return; if (m >= sess.shakeM * (sess.shakeT / sess.shakeD || 0)) { sess.shakeM = m; sess.shakeD = sess.shakeT = d || .25; sess.shakeP = Math.random() * 6.28; } },
        /* "hit-stop": congela a lógica uns milissegundos num impacto forte */
        hitstop(sec) { if (!reduced()) sess.stopT = Math.max(sess.stopT, sec || .06); },
        /* câmara lenta: fator k durante d segundos */
        slowmo(k, d) { sess.slowK = k; sess.slowT = d; },
        flash(c, d) { sess.flashC = c || '#fff'; sess.flashT = d || .15; },
        banner(text, sub) {
          if (sess.dead) return;
          const b = document.createElement('div'); b.className = 'ak-banner';
          b.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
          stage.appendChild(b); setTimeout(() => b.remove(), 1600);
        },
        /* painel intermédio (nível concluído…) — pausa o update */
        panel(o) { if (!sess.dead) showPanel(o); },
        resume() { closeOverlay(); sess.state = 'play'; },
        over(res) { if (!sess.dead) endRun(res); },
        restart() { start(sess.mode); },
        menu() { renderMenu(); },
      };

      /* coordenadas: evento → lógicas */
      function toLogical(e) {
        const r = (cv || stage).getBoundingClientRect();
        return { x: (e.clientX - r.left - sess.ox) / sess.s, y: (e.clientY - r.top - sess.oy) / sess.s };
      }

      function begin() {
        if (sess.state !== 'ready') return;
        closeOverlay();
        sess.state = 'play';
        spec.begin && spec.begin(sess.G, api);
      }

      /* ── overlays ── */
      function closeOverlay() { stage.querySelectorAll('.ak-ov').forEach(o => o.remove()); }
      function overlay(html, cls) {
        closeOverlay();
        const ov = document.createElement('div'); ov.className = 'ak-ov' + (cls ? ' ' + cls : '');
        ov.innerHTML = html; stage.appendChild(ov); return ov;
      }
      function showReady() {
        const r = spec.ready || {};
        const ov = overlay(`<div class="ak-ready"><b>${esc(r.title || 'Toca para começar')}</b>${r.hint ? `<span>${r.hint}</span>` : ''}<div class="ak-tap"></div></div>`, 'ready');
        ov.addEventListener('pointerdown', e => {
          e.preventDefault();
          begin();
          if (spec.tapStarts && cv) {   /* o 1.º toque também é jogada */
            const p = toLogical(e);
            spec.down && spec.down(sess.G, p.x, p.y, api, e);
          }
        });
      }
      function showPanel(o) {
        if (sess.state !== 'over') sess.state = 'panel';
        const ov = overlay(`<div class="ak-panel">
          ${o.icon ? `<div class="ak-panel-ico">${o.icon}</div>` : ''}
          <h3>${esc(o.title || '')}</h3>
          ${o.big != null ? `<div class="ak-big">${esc(o.big)}</div>` : ''}
          ${o.stars != null ? `<div class="ak-stars">${[1, 2, 3].map(i => `<span class="${i <= o.stars ? '' : 'off'}">⭐</span>`).join('')}</div>` : ''}
          ${o.sub ? `<p>${o.sub}</p>` : ''}
          ${o.html || ''}
          ${o.stats ? `<div class="ak-stats">${o.stats.map(([l, v]) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>` : ''}
          <div class="ak-btns">${(o.buttons || []).map((b, i) => `<button class="ak-btn${b.primary ? ' primary' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
        </div>`);
        ov.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { sfx.click(); o.buttons[+b.dataset.i].fn(); }));
        const first = ov.querySelector('.ak-btn.primary'); first && setTimeout(() => first.focus({ preventScroll: true }), 50);
      }
      function pause() {
        if (sess.state !== 'play') return;
        sess.state = 'pause';
        sess.ptrs.clear();
        showPanel({ icon: '⏸', title: 'Pausa', buttons: [
          { label: '▶ Continuar', primary: true, fn: () => { closeOverlay(); sess.state = 'play'; } },
          { label: '↺ Recomeçar', fn: () => start(sess.mode) },
          ...(spec.pauseButtons ? spec.pauseButtons(sess.G, api) : []),
          { label: 'Sair para o menu', fn: renderMenu },
        ] });
        sess.state = 'pause';
      }
      sess.pause = pause;

      function endRun(res) {
        if (sess.state === 'over') return;
        sess.state = 'over';
        sess.ptrs.clear();
        res = res || {};
        let rec = null;
        if (GP() && res.record !== false) {
          try {
            rec = GP().record(id, { won: res.won, score: res.score, mode: modeKey(sess.mode, sess.diff),
              lowerIsBetter: !!spec.lowerIsBetter, meta: res.meta });
          } catch (e) {}
        }
        const newBest = !!(rec && rec.newBest && res.score != null && (rec.stats.plays > 1 || spec.lowerIsBetter || res.score > 0));
        if (res.won) sfx.win(); else sfx.lose();
        vibe(res.won ? [30, 40, 60] : 90);
        const best = GP() ? GP().bestScore(id, modeKey(sess.mode, sess.diff)) : null;
        setTimeout(() => {
          if (sess.dead) return;
          showPanel({
            icon: res.icon || (res.won ? '🏆' : '💥'),
            title: res.title || (res.won ? 'Conseguiste!' : 'Fim de jogo'),
            big: res.score != null ? fmtScore(res.score) : null,
            stars: res.stars,
            sub: (newBest ? `<div class="ak-rec">★ Novo recorde!</div>` : (best != null ? `${spec.bestLabel || 'Recorde'}: <b>${esc(fmtScore(best))}</b>` : '')) + (res.sub ? `<br>${res.sub}` : ''),
            html: res.html,
            stats: res.stats,
            buttons: [
              { label: '↺ Jogar de novo', primary: true, fn: () => start(sess.mode) },
              { label: 'Menu', fn: renderMenu },
            ],
          });
          if (newBest) {
            const p = stage.querySelector('.ak-panel .ak-big'); p && p.classList.add('rec');
            if (!reduced()) {
              const c = document.createElement('div'); c.className = 'ak-conf';
              c.innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
              stage.querySelector('.ak-panel')?.appendChild(c);
            }
          }
        }, res.delay != null ? res.delay : 750);
      }

      /* ── HUD ── */
      function drawHud() {
        if (!spec.hud || !sess.G) return;
        const cells = spec.hud(sess.G, api) || [];
        const str = cells.map(c => c.join('\u0001')).join('\u0002');
        if (str === sess.hudStr) return;
        sess.hudStr = str;
        const prev = sess.hudVals;
        hudMid.innerHTML = cells.map((c, i) => `<div class="ak-cell${c[2] ? ' ' + c[2] : ''}${prev.length && prev[i] !== undefined && prev[i] !== String(c[1]) ? ' bump' : ''}"><small>${esc(c[0])}</small><b>${esc(c[1])}</b></div>`).join('');
        sess.hudVals = cells.map(c => String(c[1]));
      }
      stage.querySelector('.ak-hud').addEventListener('click', e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'quit') renderMenu();
        else if (a.dataset.a === 'pause') { if (sess.state === 'play') pause(); }
        else if (a.dataset.a === 'snd') { const v = !pref('sound', false); setPref('sound', v); a.textContent = soundOn() ? '🔊' : '🔇'; if (v) sfx.click(); }
      });

      /* ── ciclo ── */
      function frame(dt) {
        if (sess.dead) return;
        sess.t += dt;
        const frozen = sess.stopT > 0;
        if (frozen) sess.stopT -= dt;
        else if (sess.slowT > 0) { sess.slowT -= dt; dt *= sess.slowK; }
        if (sess.state === 'play' && !frozen) spec.update(sess.G, dt, api);
        else if (spec.idle && sess.state === 'ready') spec.idle(sess.G, dt, api);
        else if (spec.after && sess.state === 'over') spec.after(sess.G, dt, api);   /* animação pós-derrota */
        if (sess.state === 'play' || sess.state === 'ready' || sess.state === 'over') {
          if (sess.parts) sess.parts.update(dt);
          for (let i = sess.floats.length - 1; i >= 0; i--) {
            const f = sess.floats[i]; f.life -= dt;
            const k = 1 - f.life / f.max; f.y = f.y0 - 52 * (1 - (1 - k) * (1 - k));   /* sobe depressa e abranda */
            if (f.life <= 0) sess.floats.splice(i, 1);
          }
          if (sess.shakeT > 0) sess.shakeT = Math.max(0, sess.shakeT - (dt || 1 / 60));
          if (sess.flashT > 0) sess.flashT = Math.max(0, sess.flashT - dt);
        }
        drawHud();
      }
      function paint(ctx, cw, ch) {
        if (sess.dead || !sess.G) return;
        const k = cv.width / cw;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        /* transparent: o jogo pinta noutra camada (WebGL) e o canvas 2D só leva sobreposições */
        if (spec.transparent) ctx.clearRect(0, 0, cw, ch);
        else { ctx.fillStyle = spec.bg || '#0b0e1a'; ctx.fillRect(0, 0, cw, ch); }
        let sx = 0, sy = 0;
        if (sess.shakeT > 0) {
          const k = sess.shakeT / sess.shakeD, m = sess.shakeM * k * k, w = sess.t * 55 + sess.shakeP;
          sx = Math.sin(w) * m * .6; sy = Math.cos(w * 1.31) * m * .6;
        } else sess.shakeM = 0;
        sess.sx = sx; sess.sy = sy;
        const s = sess.s;
        ctx.setTransform(k * s, 0, 0, k * s, k * (sess.ox + sx), k * (sess.oy + sy));
        ctx.save();
        if (spec.view.h) { ctx.beginPath(); ctx.rect(0, 0, sess.W, sess.H); ctx.clip(); }
        spec.draw(sess.G, ctx, sess.W, sess.H, api);
        ctx.restore();
        if (sess.parts) sess.parts.draw(ctx);
        if (sess.floats.length) {
          ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          sess.floats.forEach(f => {
            const k = 1 - f.life / f.max;
            /* entra com "pop" (1.35 → 1) e só desvanece no fim */
            const sc = k < .14 ? 1.35 - (k / .14) * .35 : 1;
            ctx.globalAlpha = Math.min(1, f.life / f.max * 2.4);
            ctx.save(); ctx.translate(f.x, f.y); ctx.scale(sc, sc);
            ctx.font = `800 ${f.size}px 'Space Grotesk', system-ui, sans-serif`;
            ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(f.text, 0, 0);
            ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
            ctx.restore();
          });
          ctx.restore();
        }
        if (sess.flashT > 0) {
          ctx.setTransform(k, 0, 0, k, 0, 0);
          ctx.globalAlpha = Math.min(.55, sess.flashT * 3); ctx.fillStyle = sess.flashC; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1;
        }
      }

      sess.api = api; sess.frame = frame; sess.begin = begin;

      if (cv) {
        if (spec.cursor) cv.style.cursor = spec.cursor;
        const r0 = cv.getBoundingClientRect(); fit(r0.width || 360, r0.height || 600);
        sess.G = spec.setup(api, { mode, diff });
        sess.eng = CanvasEngine.create(cv, { maxDpr: 2, update: frame, draw: paint, onResize: (w, h) => fit(w, h) });
        sess.eng.start();

        /* ponteiro: rato, toque e caneta pelo mesmo caminho */
        cv.addEventListener('pointerdown', e => {
          e.preventDefault();
          try { cv.setPointerCapture(e.pointerId); } catch (err) {}
          try { cv.focus({ preventScroll: true }); } catch (err) {}
          const p = toLogical(e); sess.ptrs.set(e.pointerId, p);
          if (sess.state === 'play' && spec.down) spec.down(sess.G, p.x, p.y, api, e);
        });
        cv.addEventListener('pointermove', e => {
          const p = toLogical(e);
          if (sess.ptrs.has(e.pointerId)) sess.ptrs.set(e.pointerId, p);
          if (sess.state === 'play' && spec.move) spec.move(sess.G, p.x, p.y, api, e, sess.ptrs.has(e.pointerId));
        });
        const up = e => {
          const had = sess.ptrs.delete(e.pointerId);
          if (had && sess.state === 'play' && spec.up) { const p = toLogical(e); spec.up(sess.G, p.x, p.y, api, e); }
        };
        cv.addEventListener('pointerup', up);
        cv.addEventListener('pointercancel', up);
        cv.addEventListener('contextmenu', e => e.preventDefault());
      } else {
        /* jogos em DOM (Contas Rápidas): mesmo ciclo, sem canvas */
        const r0 = stage.getBoundingClientRect(); fit(r0.width || 360, r0.height || 600);
        sess.G = spec.setup(api, { mode, diff });
        let last = performance.now();
        const loop = now => {
          if (sess.dead) return;
          const dt = Math.min(.05, (now - last) / 1000); last = now;
          frame(dt);
          sess.raf = requestAnimationFrame(loop);
        };
        sess.raf = requestAnimationFrame(loop);
      }

      sess.onKey = e => {
        if (sess.dead || !root.isConnected || !root.classList.contains('active')) return;
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && sess.state === 'play') { e.preventDefault(); pause(); return; }
        if (sess.state === 'ready' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); begin(); if (!spec.tapStarts) return; }
        if (sess.state === 'play' && spec.key && spec.key(sess.G, e, api) === true) e.preventDefault();
      };
      window.addEventListener('keydown', sess.onKey);
      /* keyup só para os jogos que o pedem (movimento contínuo). Chega também em
         pausa (largar a tecla durante a pausa não a pode deixar "presa"), e ao
         perder o foco da janela solta-se tudo (o keyup nunca chegaria). */
      sess.onKeyUp = e => { if (!sess.dead && sess.G && spec.keyup) spec.keyup(sess.G, e, api); };
      window.addEventListener('keyup', sess.onKeyUp);
      sess.onBlur = () => {
        if (sess.dead || !sess.G || !spec.keyup) return;
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'A', 'D', 'W', 'S', ' ', 'Shift']
          .forEach(key => { try { spec.keyup(sess.G, { key, code: '', preventDefault() {} }, api); } catch (err) {} });
      };
      window.addEventListener('blur', sess.onBlur);

      drawHud();
      if (spec.ready !== false) showReady(); else begin();
    }

    function init(paneEl) {
      root = paneEl;
      if (!root) return;
      injectCSS();
      renderMenu();
      if (_wired) return;
      _wired = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && S && S.state === 'play' && S.pause) S.pause();
      });
      document.addEventListener('routechange', e => {
        const h = String(e.detail || '');
        if (S && h !== 'games/' + id && !h.startsWith('games/' + id + '?')) renderMenu();
      });
    }

    /* hooks de teste (harness headless: o rAF não avança com virtual time) */
    const _test = {
      state: () => (S ? S.state : null),
      G: () => (S ? S.G : null),
      api: () => (S ? S.api : null),
      start: m => start(m || null),
      begin: () => S && S.begin(),
      step: (dt, n) => { for (let i = 0; i < (n || 1) && S; i++) S.frame(dt); },
      down: (x, y) => S && S.state === 'play' && spec.down && spec.down(S.G, x, y, S.api, { pointerType: 'touch', pointerId: 1 }),
      move: (x, y, d) => S && S.state === 'play' && spec.move && spec.move(S.G, x, y, S.api, { pointerType: 'touch', pointerId: 1 }, d !== false),
      up: (x, y) => S && S.state === 'play' && spec.up && spec.up(S.G, x, y, S.api, { pointerType: 'touch', pointerId: 1 }),
    };

    return { init, _test };
  }

  /* utilitários partilhados pelos jogos */
  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    ease: t => t * t * (3 - 2 * t),
    angDiff: (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; },
    /* retângulo de cantos redondos (roundRect ainda falta nalguns Safari) */
    rr(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    },
    /* distância de um ponto a um segmento */
    segDist(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    },
    fmtTime: s => { const m = Math.floor(s / 60), r = s - m * 60; return (m ? m + ':' + (r < 10 ? '0' : '') : '') + r.toFixed(2) + (m ? '' : 's'); },
  };

  return { create, sfx, vibe, U, soundOn };
})();
