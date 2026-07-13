/* ══════════════════════════════════════════════════════════════════
   INTERNET FUN LAB (#funlab) — laboratório de conteúdo aleatório.
   Independente da secção Humor (que fica intacta). 100% offline: os
   geradores são procedurais/combinatórios sobre data/funlab/packs.json
   (efetivamente infinitos, sem APIs frágeis, sem CORS, sem chaves). O
   gerador de memes desenha em canvas (arte original, texto Impact sobre
   fundos procedurais) e permite descarregar — sem imagens de terceiros.
   "Meme do dia" e "fortuna do dia" usam uma seed diária determinística
   (igual para todos, muda à meia-noite). Foco: apresentação e sensação
   de descoberta, não uma lista de botões.
══════════════════════════════════════════════════════════════════ */
const FunLabPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const T = (en, pt) => (_lang() === 'en' ? en : pt);
  const L = () => (_lang() === 'en' ? 'en' : 'pt');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* seed diária determinística */
  function dayKey(d) { d = d || new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function daily(arr, salt) { if (!arr || !arr.length) return null; return arr[hashStr(dayKey() + (salt || '')) % arr.length]; }

  let _root = null, _built = false, _P = null, _pPromise = null;
  function load() {
    if (_P) return Promise.resolve(_P);
    if (_pPromise) return _pPromise;
    _pPromise = fetch('data/funlab/packs.json').then(r => r.json()).then(p => (_P = p)).catch(() => null);
    return _pPromise;
  }

  /* ── geradores ── */
  const gen = {
    excuse(ctx) { const p = _P.excuses[L()]; return pick(p[ctx] || p.work); },
    fact() { return pick(_P.facts[L()]); },
    fortune() { return pick(_P.fortunes[L()]); },
    roast() { return pick(_P.roasts[L()]); },
    name() { const n = _P.names[L()]; return [pick(n.first), pick(n.adj), pick(n.noun), pick(n.suffix)].join(' '); },
    conspiracy() { const c = _P.conspiracy[L()]; return `${pick(c.subjects)} ${pick(c.actions)} ${pick(c.agents)}. ${pick(c.proofs)}`; },
    meme() { return pick(_P.memes[L()]); },
  };

  /* ── canvas meme (arte original) ── */
  const MEME_BG = [
    ['#1d2b4a', '#0d1526'], ['#3a1c3a', '#160b16'], ['#123027', '#06140f'],
    ['#3a2a12', '#14100a'], ['#2a1030', '#120616'], ['#0f2f3a', '#061419'],
  ];
  function drawMeme(cv, meme, seed) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const s = hashStr((meme.top || '') + (meme.bottom || '') + (seed || ''));
    const bg = MEME_BG[s % MEME_BG.length];
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* geometria procedural de fundo */
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 7; i++) {
      const r = (s >> i) % 90 + 30;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#f2b344';
      ctx.beginPath(); ctx.arc(((s * (i + 3)) % W), ((s * (i + 7)) % H), r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* emoji "sujeito" central */
    const emojis = ['🗿', '🐸', '🤡', '👽', '🐙', '🦖', '🫠', '🗒️', '📎', '🧠'];
    ctx.font = `${Math.round(W * 0.28)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9; ctx.fillText(emojis[s % emojis.length], W / 2, H / 2 + W * 0.02); ctx.globalAlpha = 1;
    /* texto estilo Impact */
    memeText(ctx, (meme.top || '').toUpperCase(), W, H, 'top');
    memeText(ctx, (meme.bottom || '').toUpperCase(), W, H, 'bottom');
    /* marca discreta */
    ctx.font = `600 ${Math.round(W * 0.024)}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText('diogo universe · fun lab', W - 14, H - 12);
  }
  function memeText(ctx, text, W, H, pos) {
    if (!text) return;
    const maxW = W * 0.9;
    let size = Math.round(W * 0.075);
    ctx.textAlign = 'center';
    let lines;
    do {
      ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
      lines = wrap(ctx, text, maxW);
      if (lines.length <= 3 || size <= 18) break;
      size -= 2;
    } while (true);
    const lh = size * 1.05;
    const total = lines.length * lh;
    let y = pos === 'top' ? 18 + size : H - total - 10 + size;
    ctx.textBaseline = 'alphabetic';
    lines.forEach(ln => {
      ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
      ctx.strokeText(ln, W / 2, y);
      ctx.fillStyle = '#fff'; ctx.fillText(ln, W / 2, y);
      y += lh;
    });
  }
  function wrap(ctx, text, maxW) {
    const words = text.split(' '); const lines = []; let cur = '';
    words.forEach(w => {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  let _curMeme = null;
  function renderMeme(meme, seed) {
    _curMeme = meme;
    const cv = _root.querySelector('#fl-meme-cv'); if (!cv) return;
    cv.width = 600; cv.height = 600;
    drawMeme(cv, meme, seed || Math.random());
    if (typeof Motion !== 'undefined') Motion.pop(cv);
  }

  /* ── UI de um gerador (cartão com reveal) ── */
  function card(id, icon, title, sub, btn, cls) {
    return `<div class="fl-card ${cls || ''}" data-gen="${id}">
      <div class="fl-card-head"><span class="fl-card-ico">${icon}</span><div><b>${title}</b><small>${sub}</small></div></div>
      <div class="fl-card-out" data-out></div>
      <button class="btn fl-roll" data-roll>${btn}</button>
    </div>`;
  }

  function reveal(out, text) {
    out.classList.remove('show');
    out.innerHTML = `<span class="fl-out-txt">${esc(text)}</span>`;
    void out.offsetWidth;
    out.classList.add('show');
    if (typeof Motion !== 'undefined') Motion.pop(out.querySelector('.fl-out-txt'));
  }

  function show() {
    const view = document.getElementById('view-funlab');
    if (!view) return;
    if (_built) return;
    _built = true;
    _root = view;
    view.innerHTML = `
      <div class="view-inner fl-wrap">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('funlab', 22)}</span>
          <div class="ph-titles"><h1 class="ph-title">Internet Fun Lab</h1>
            <p class="ph-sub">${T('A laboratory of absurd, useless and delightful randomness — endless and fully offline', 'Um laboratório de aleatoriedade absurda, inútil e deliciosa — infinita e 100% offline')}</p></div>
        </div>
        <div class="fl-daily">
          <div class="fl-daily-tag">✨ ${T('Meme of the day', 'Meme do dia')}</div>
          <div class="fl-meme-stage"><canvas id="fl-meme-cv" aria-label="meme"></canvas></div>
          <div class="fl-meme-btns">
            <button class="btn btn-primary" id="fl-meme-new">🎲 ${T('New meme', 'Novo meme')}</button>
            <button class="btn" id="fl-meme-dl">⬇ ${T('Download', 'Descarregar')}</button>
          </div>
          <div class="fl-fortune"><span>🔮</span><i id="fl-fortune"></i></div>
        </div>
        <div class="fl-grid">
          ${card('fact', '🧠', T('Useless fact', 'Facto inútil'), T('Knowledge you never asked for', 'Conhecimento que ninguém pediu'), T('Enlighten me', 'Ilumina-me'))}
          ${card('excuse', '🙈', T('Random excuse', 'Desculpa aleatória'), T('For work or school', 'Para trabalho ou escola'), T('Give me one', 'Dá-me uma'), 'fl-has-toggle')}
          ${card('name', '🎩', T('Absurd name', 'Nome absurdo'), T('Your alter-ego awaits', 'O teu alter-ego espera'), T('Name me', 'Dá-me um nome'))}
          ${card('conspiracy', '👁️', T('Fake conspiracy', 'Conspiração falsa'), T('100% made up, 0% true', '100% inventada, 0% verdadeira'), T('Reveal the truth', 'Revelar a verdade'))}
          ${card('roast', '🔥', 'Roast Me', T('You asked for it', 'Tu é que pediste'), T('Roast me', 'Faz-me um roast'))}
          ${card('fortune', '🥠', T('Fortune', 'Fortuna'), T('A cookie of dubious wisdom', 'Um biscoito de sabedoria duvidosa'), T('Crack it open', 'Abrir o biscoito'))}
        </div>
      </div>`;

    load().then(() => {
      /* meme do dia + fortuna do dia (determinísticos) */
      renderMeme(daily(_P.memes[L()], 'meme') || _P.memes[L()][0], dayKey());
      const f = view.querySelector('#fl-fortune'); if (f) f.textContent = daily(_P.fortunes[L()], 'fortune');
      view.querySelector('#fl-meme-new').addEventListener('click', () => renderMeme(gen.meme()));
      view.querySelector('#fl-meme-dl').addEventListener('click', downloadMeme);
      /* geradores */
      view.querySelectorAll('.fl-card').forEach(c => {
        const id = c.dataset.gen, out = c.querySelector('[data-out]');
        let ctx = 'work';
        if (id === 'excuse') {
          const tg = document.createElement('div'); tg.className = 'fl-toggle';
          tg.innerHTML = `<button class="fl-tg on" data-ctx="work">${T('Work', 'Trabalho')}</button><button class="fl-tg" data-ctx="school">${T('School', 'Escola')}</button>`;
          c.insertBefore(tg, out);
          tg.querySelectorAll('.fl-tg').forEach(b => b.addEventListener('click', () => {
            ctx = b.dataset.ctx; tg.querySelectorAll('.fl-tg').forEach(x => x.classList.toggle('on', x === b));
            reveal(out, gen.excuse(ctx));
          }));
        }
        c.querySelector('[data-roll]').addEventListener('click', () => reveal(out, id === 'excuse' ? gen.excuse(ctx) : gen[id]()));
      });
      if (typeof Motion !== 'undefined') Motion.stagger(view.querySelectorAll('.fl-card'), { step: 40 });
    });
  }

  function downloadMeme() {
    const cv = _root.querySelector('#fl-meme-cv'); if (!cv) return;
    try {
      const a = document.createElement('a');
      a.download = 'meme-diogo-universe.png';
      a.href = cv.toDataURL('image/png');
      a.click();
    } catch (e) {}
  }

  return { show };
})();
window.FunLabPage = FunLabPage;
