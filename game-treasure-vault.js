const TreasureVaultGame = (function () {
  'use strict';

  function _t(en, pt) { try { return I18n.getLang() === 'pt' ? pt : en; } catch { return en; } }
  function tierFor(age) { const a = +age; if (a <= 8) return 'easy'; if (a <= 11) return 'med'; return 'hard'; }

  const PUZZLES = {
    easy: [
      { story: _t => _t('Vault 1: The treasure chest holds 6 coins in each of 4 rows.', 'Cofre 1: O baú tem 6 moedas em cada uma de 4 filas.'),
        question: _t => _t('Total gold coins?', 'Total de moedas de ouro?'),
        viz: { type:'grid', rows:4, cols:6, icon:'🪙' }, answer:'24', input:'keypad',
        hint: _t => _t('4 rows × 6 coins each.', '4 filas × 6 moedas cada.') },
      { story: _t => _t('Ancient lock: 15 + 8 − 6 = ?', 'Fechadura antiga: 15 + 8 − 6 = ?'),
        question: _t => _t('Open the vault?', 'Abrir o cofre?'),
        viz: { type:'formula', expr:'15 + 8 − 6 = ?' }, answer:'17', input:'keypad',
        hint: _t => _t('Add first, then subtract.', 'Adiciona primeiro, depois subtrai.') },
      { story: _t => _t('Treasure map sequence: 3, 6, 9, 12, ?', 'Sequência do mapa: 3, 6, 9, 12, ?'),
        question: _t => _t('Next location?', 'Próxima localização?'),
        viz: { type:'seq', vals:[3,6,9,12,'?'] }, answer:'15', input:'keypad',
        hint: _t => _t('Add 3 each time.', 'Adiciona 3 de cada vez.') },
      { story: _t => _t('Gems split equally: 28 gems for 4 explorers.', 'Gemas divididas igualmente: 28 gemas para 4 exploradores.'),
        question: _t => _t('Gems per explorer?', 'Gemas por explorador?'),
        viz: { type:'formula', expr:'28 ÷ 4 = ?' }, answer:'7', input:'keypad',
        hint: _t => _t('28 divided by 4.', '28 a dividir por 4.') },
      { story: _t => _t('Vault code: half of 30 plus 8.', 'Código do cofre: metade de 30 mais 8.'),
        question: _t => _t('Enter the code?', 'Introduz o código?'),
        viz: { type:'formula', expr:'(30 ÷ 2) + 8 = ?' }, answer:'23', input:'keypad',
        hint: _t => _t('Half of 30 is 15, then add 8.', 'Metade de 30 é 15, depois adiciona 8.') },
    ],
    med: [
      { story: _t => _t('Double lock: 4y − 6 = 22. Find y.', 'Fechadura dupla: 4y − 6 = 22. Encontra y.'),
        question: _t => _t('Value of y?', 'Valor de y?'),
        viz: { type:'equation', expr:'4y − 6 = 22' }, answer:'7', input:'keypad',
        hint: _t => _t('22 + 6 = 28, then 28 ÷ 4.', '22 + 6 = 28, depois 28 ÷ 4.') },
      { story: _t => _t('Fibonacci vault: 1, 1, 2, 3, 5, 8, 13, ?', 'Cofre Fibonacci: 1, 1, 2, 3, 5, 8, 13, ?'),
        question: _t => _t('Next code number?', 'Próximo número do código?'),
        viz: { type:'seq', vals:[1,1,2,3,5,8,13,'?'] }, answer:'21', input:'keypad',
        hint: _t => _t('Each number = sum of the two before it.', 'Cada número = soma dos dois anteriores.') },
      { story: _t => _t('40% of 90 jewels are rubies.', '40% de 90 joias são rubis.'),
        question: _t => _t('How many rubies?', 'Quantos rubis?'),
        viz: { type:'percent', total:90, pct:40, icon:'💎' }, answer:'36', input:'keypad',
        hint: _t => _t('40% of 90 = 0.4 × 90.', '40% de 90 = 0.4 × 90.') },
      { story: _t => _t('Two treasure chests: P + Q = 80, P = 3Q. Find Q.', 'Dois baús: P + Q = 80, P = 3Q. Encontra Q.'),
        question: _t => _t('Value of Q?', 'Valor de Q?'),
        viz: { type:'system', eq1:'P + Q = 80', eq2:'P = 3Q' }, answer:'20', input:'keypad',
        hint: _t => _t('3Q + Q = 80, so 4Q = 80.', '3Q + Q = 80, logo 4Q = 80.') },
      { story: _t => _t('Which number is NOT a perfect square?', 'Qual número NÃO é um quadrado perfeito?'),
        question: _t => _t('Pick the odd one out:', 'Escolhe o intruso:'),
        viz: { type:'choice-info', options:['16','25','36','42'] }, answer:'42', input:'choice',
        hint: _t => _t('4²=16, 5²=25, 6²=36, what about 42?', '4²=16, 5²=25, 6²=36, e 42?') },
    ],
    hard: [
      { story: _t => _t('Ancient formula: f(n) = n³ − 2n. Find f(5).', 'Fórmula antiga: f(n) = n³ − 2n. Calcula f(5).'),
        question: _t => _t('Value of f(5)?', 'Valor de f(5)?'),
        viz: { type:'var-formula', expr:'n³ − 2n', n:5, result:115 }, answer:'115', input:'keypad',
        hint: _t => _t('5³ = 125, 2×5 = 10, 125−10.', '5³ = 125, 2×5 = 10, 125−10.') },
      { story: _t => _t('Vault cipher: 233 mod 7 = ?', 'Cifra do cofre: 233 mod 7 = ?'),
        question: _t => _t('Remainder?', 'Resto?'),
        viz: { type:'modular', dividend:233, divisor:7 }, answer:'2', input:'keypad',
        hint: _t => _t('233 ÷ 7 = 33 remainder ?', '233 ÷ 7 = 33 resto ?') },
      { story: _t => _t('Power combination: 5² + 2⁶ = ?', 'Combinação de potências: 5² + 2⁶ = ?'),
        question: _t => _t('Total?', 'Total?'),
        viz: { type:'powers', terms:['5²','2⁶'], vals:[25,64] }, answer:'89', input:'keypad',
        hint: _t => _t('5²=25 and 2⁶=64.', '5²=25 e 2⁶=64.') },
      { story: _t => _t('Two locks: m + n = 45, m − n = 9. Find m.', 'Duas fechaduras: m + n = 45, m − n = 9. Encontra m.'),
        question: _t => _t('Value of m?', 'Valor de m?'),
        viz: { type:'system', eq1:'m + n = 45', eq2:'m − n = 9' }, answer:'27', input:'keypad',
        hint: _t => _t('Add both: 2m = 54.', 'Soma as duas: 2m = 54.') },
      { story: _t => _t('Treasure prime: next prime after 67?', 'Primo do tesouro: próximo primo após 67?'),
        question: _t => _t('Next prime?', 'Próximo primo?'),
        viz: { type:'primes', shown:[59,61,67,'?'] }, answer:'71', input:'keypad',
        hint: _t => _t('Check 68(even),69(÷3),70(even),71.', 'Verifica 68,69,70,71.') },
    ],
  };

  let _root, _kh, _st;

  function defSt() { const dfAge = parseInt(localStorage.getItem('game-age-default') || '0') || null; return { age: dfAge, step: 0, score: 0, totalHints: 0, startTime: null, bests: {} }; }
  function saveSt() { try { localStorage.setItem('tv-st', JSON.stringify({ bests: _st.bests })); } catch {} }
  function loadSt() { try { const d = JSON.parse(localStorage.getItem('tv-st') || '{}'); if (d.bests) _st.bests = d.bests; } catch {} }

  function injectCSS() {
    if (document.getElementById('tv-css')) return;
    const s = document.createElement('style');
    s.id = 'tv-css';
    s.textContent = `
.tv-wrap { background:#0d0a00; min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:24px 16px; font-family:'Segoe UI',sans-serif; color:#fef3c7; }
.tv-title { font-size:2rem; font-weight:900; text-align:center; margin-bottom:6px; color:#fbbf24;
  text-shadow:0 0 18px #f59e0b,0 0 36px #d97706; letter-spacing:2px; }
.tv-subtitle { font-size:.95rem; color:#d97706; margin-bottom:24px; text-align:center; }
.tv-menu { width:100%; max-width:480px; }
.tv-menu h2 { font-size:1.1rem; color:#fbbf24; margin-bottom:12px; text-align:center; }
.tv-age-grid { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:16px; }
.tv-age-btn { width:54px; height:40px; border:1.5px solid #92400e; background:#1a0e00; color:#fef3c7; border-radius:8px; cursor:pointer; font-size:.95rem; transition:all .15s; }
.tv-age-btn:hover { background:#2d1a00; border-color:#fbbf24; }
.tv-age-btn.active { background:#d97706; border-color:#fbbf24; color:#fff; box-shadow:0 0 12px #fbbf24; }
.tv-tier-hint { text-align:center; font-size:.85rem; color:#d97706; margin-bottom:14px; min-height:20px; }
.tv-start-btn { display:block; width:100%; padding:14px; background:linear-gradient(135deg,#d97706,#fbbf24); color:#0d0a00; border:none; border-radius:12px; font-size:1.1rem; font-weight:700; cursor:pointer; margin-bottom:20px; transition:opacity .2s; }
.tv-start-btn:hover { opacity:.85; }
.tv-bests { background:#1a0e00; border:1px solid #92400e; border-radius:10px; padding:12px 16px; }
.tv-bests h3 { font-size:.85rem; color:#d97706; margin:0 0 8px; text-transform:uppercase; letter-spacing:1px; }
.tv-best-row { display:flex; justify-content:space-between; font-size:.85rem; color:#fbbf24; padding:3px 0; border-bottom:1px solid #2d1a00; }
.tv-best-row:last-child { border-bottom:none; }
.tv-game { width:100%; max-width:540px; }
.tv-progress { display:flex; gap:8px; justify-content:center; margin-bottom:18px; }
.tv-dot { width:12px; height:12px; border-radius:50%; background:#2d1a00; border:1.5px solid #92400e; transition:all .3s; }
.tv-dot.dn { background:#d97706; border-color:#fbbf24; }
.tv-dot.cr { background:#fbbf24; border-color:#fef3c7; box-shadow:0 0 8px #fbbf24; animation:tv-pulse .8s infinite alternate; }
@keyframes tv-pulse { from{transform:scale(1)} to{transform:scale(1.3)} }
.tv-card { background:#1a0e00; border:1.5px solid #2d1a00; border-radius:14px; padding:20px; margin-bottom:14px; }
.tv-story { font-size:1rem; color:#fef3c7; line-height:1.5; margin-bottom:12px; }
.tv-viz { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center; min-height:60px; margin:12px 0 16px; padding:12px; background:#0d0a00; border-radius:10px; border:1px solid #2d1a00; }
.tv-viz-seq { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center; }
.tv-viz-box { padding:8px 14px; background:#2d1a00; border-radius:8px; font-size:1.15rem; font-weight:700; color:#fef3c7; border:1.5px solid #92400e; }
.tv-viz-box.q { background:#d97706; color:#fff; animation:tv-pulse .8s infinite alternate; }
.tv-viz-eq { font-size:1.1rem; font-weight:700; color:#fbbf24; text-align:center; letter-spacing:1px; }
.tv-viz-grid { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.tv-viz-icon { font-size:1.5rem; }
.tv-question { font-size:1rem; font-weight:600; color:#fbbf24; margin-bottom:14px; }
.tv-kp { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; max-width:240px; margin:0 auto 10px; }
.tv-kp-btn { padding:12px; background:#1a0e00; border:1.5px solid #92400e; color:#fef3c7; border-radius:8px; font-size:1.1rem; cursor:pointer; transition:all .15s; }
.tv-kp-btn:hover { background:#2d1a00; border-color:#fbbf24; }
.tv-kp-display { grid-column:1/4; padding:10px; background:#0d0a00; border:1.5px solid #d97706; border-radius:8px; text-align:center; font-size:1.3rem; font-weight:700; color:#fbbf24; min-height:44px; letter-spacing:2px; }
.tv-choices { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
.tv-choice-btn { padding:14px; background:#1a0e00; border:1.5px solid #92400e; color:#fef3c7; border-radius:10px; font-size:1.05rem; font-weight:600; cursor:pointer; transition:all .15s; }
.tv-choice-btn:hover { background:#2d1a00; border-color:#fbbf24; }
.tv-choice-btn.correct { background:#14532d; border-color:#22c55e; color:#bbf7d0; }
.tv-choice-btn.wrong { background:#450a0a; border-color:#ef4444; color:#fca5a5; }
.tv-hint-btn { display:block; margin:0 auto 8px; padding:6px 18px; background:transparent; border:1.5px solid #92400e; color:#fbbf24; border-radius:20px; font-size:.85rem; cursor:pointer; }
.tv-hint-btn:hover { background:#2d1a00; }
.tv-hint-text { font-size:.85rem; color:#d97706; text-align:center; margin-bottom:8px; padding:8px; background:#1a0e00; border-radius:8px; }
.tv-feedback { text-align:center; padding:14px; border-radius:10px; margin-bottom:10px; font-size:1rem; font-weight:600; }
.tv-feedback.ok { background:#1a2e1a; color:#86efac; border:1px solid #22c55e; }
.tv-feedback.err { background:#2e1a1a; color:#fca5a5; border:1px solid #ef4444; }
.tv-next-btn { display:block; width:100%; padding:12px; background:linear-gradient(135deg,#d97706,#fbbf24); color:#0d0a00; border:none; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; margin-top:8px; }
.tv-score-bar { display:flex; justify-content:space-between; font-size:.8rem; color:#d97706; margin-bottom:4px; }
.tv-complete { text-align:center; padding:30px 20px; }
.tv-complete h2 { font-size:1.8rem; color:#fbbf24; margin-bottom:8px; text-shadow:0 0 16px #d97706; }
.tv-complete .tv-final-score { font-size:2.5rem; font-weight:900; color:#fef3c7; margin:10px 0; }
.tv-complete p { color:#d97706; margin-bottom:20px; }
.tv-replay-btn { padding:12px 32px; background:linear-gradient(135deg,#d97706,#fbbf24); color:#0d0a00; border:none; border-radius:12px; font-size:1.05rem; font-weight:700; cursor:pointer; }
.tv-part { position:absolute; border-radius:50%; pointer-events:none; animation:tv-fly .8s ease-out forwards; }
@keyframes tv-fly { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-60px) scale(0.3)} }
.tv-sys { display:flex; flex-direction:column; gap:8px; align-items:center; }
.tv-sys-eq { padding:8px 20px; background:#2d1a00; border-radius:8px; font-size:1rem; color:#fef3c7; border:1px solid #92400e; }
.tv-primes { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.tv-prime-box { padding:8px 14px; background:#2d1a00; border-radius:8px; font-size:1.1rem; color:#fef3c7; border:1.5px solid #92400e; }
.tv-prime-box.q { background:#d97706; color:#fff; animation:tv-pulse .8s infinite alternate; }
.tv-pows { display:flex; gap:14px; align-items:center; font-size:1.2rem; color:#fef3c7; }
.tv-pow-term { padding:8px 12px; background:#2d1a00; border-radius:8px; border:1px solid #92400e; }
.tv-mod { display:flex; align-items:center; gap:10px; font-size:1.3rem; color:#fef3c7; }
.tv-pct-bar { width:100%; max-width:260px; height:22px; background:#2d1a00; border-radius:11px; overflow:hidden; }
.tv-pct-fill { height:100%; background:linear-gradient(90deg,#d97706,#fbbf24); border-radius:11px; transition:width .5s; }
.tv-pct-label { font-size:.85rem; color:#fbbf24; margin-top:4px; text-align:center; }
.tv-vf { font-size:1rem; color:#fef3c7; text-align:center; }
`;
    document.head.appendChild(s);
  }

  function showMenu() {
    const tier = _st.age ? tierFor(_st.age) : null;
    const tierLabel = tier === 'easy'
      ? _t('Beginner (ages 6–8)', 'Iniciante (idades 6–8)')
      : tier === 'med'
        ? _t('Intermediate (ages 9–11)', 'Intermédio (idades 9–11)')
        : tier === 'hard'
          ? _t('Advanced (ages 12–14+)', 'Avançado (idades 12–14+)')
          : '';

    const bestRows = Object.entries(_st.bests).map(([t, scores]) => {
      const label = t === 'easy' ? _t('Beginner', 'Iniciante') : t === 'med' ? _t('Intermediate', 'Intermédio') : _t('Advanced', 'Avançado');
      return scores.map(s => `<div class="tv-best-row"><span>${label}</span><span>${s} pts</span></div>`).join('');
    }).join('');

    _root.innerHTML = `<div class="tv-wrap">
      <div class="tv-title">🏺 ${_t('Treasure Vault', 'Cofre do Tesouro')}</div>
      <div class="tv-subtitle">${_t('Unlock ancient vaults with math!', 'Abre cofres antigos com matemática!')}</div>
      <div class="tv-menu">
        <h2>${_t('Select your age:', 'Seleciona a tua idade:')}</h2>
        <div class="tv-age-grid">
          ${[6,7,8,9,10,11,12,13,14].map(a => `
            <button class="tv-age-btn${_st.age==a?' active':''}" data-age="${a}">${a}${a===14?'+':''}</button>
          `).join('')}
        </div>
        <div class="tv-tier-hint">${tierLabel}</div>
        <button class="tv-start-btn"${!_st.age?' disabled':''}>🏺 ${_t('Open the Vault!', 'Abrir o Cofre!')}</button>
        ${bestRows ? `<div class="tv-bests"><h3>🏆 ${_t('Best Scores','Melhores Pontuações')}</h3>${bestRows}</div>` : ''}
      </div>
    </div>`;

    _root.querySelectorAll('.tv-age-btn').forEach(b => b.addEventListener('click', () => {
      _st.age = +b.dataset.age; showMenu();
    }));
    _root.querySelector('.tv-start-btn')?.addEventListener('click', () => {
      if (_st.age) startGame(_st.age);
    });
  }

  function startGame(age) {
    _st.age = age; _st.step = 0; _st.score = 0; _st.totalHints = 0;
    _st.startTime = Date.now();
    showStep(0);
  }

  function showStep(idx) {
    const tier = tierFor(_st.age);
    const puzzles = PUZZLES[tier];
    const p = puzzles[idx];
    const total = puzzles.length;
    let localHints = 0, localAttempts = 0, hintShown = false;

    const dots = Array.from({length: total}, (_, i) =>
      `<div class="tv-dot ${i < idx ? 'dn' : i === idx ? 'cr' : ''}"></div>`).join('');

    _root.innerHTML = `<div class="tv-wrap">
      <div class="tv-title">🏺 ${_t('Treasure Vault', 'Cofre do Tesouro')}</div>
      <div class="tv-game">
        <div class="tv-score-bar">
          <span>${_t('Vault', 'Cofre')} ${idx+1}/${total}</span>
          <span>${_t('Score', 'Pontuação')}: ${_st.score}</span>
        </div>
        <div class="tv-progress">${dots}</div>
        <div class="tv-card">
          <div class="tv-story">${p.story(_t)}</div>
          <div class="tv-viz">${vizHTML(p)}</div>
          <div class="tv-question">${p.question(_t)}</div>
          ${inputHTML(p)}
          <button class="tv-hint-btn">💡 ${_t('Hint', 'Dica')}</button>
          <div class="tv-hint-text" style="display:none">${p.hint(_t)}</div>
          <div class="tv-feedback" style="display:none"></div>
        </div>
      </div>
    </div>`;

    const hintBtn = _root.querySelector('.tv-hint-btn');
    const hintText = _root.querySelector('.tv-hint-text');
    hintBtn.addEventListener('click', () => {
      hintText.style.display = 'block'; hintBtn.style.display = 'none';
      if (!hintShown) { localHints++; _st.totalHints++; hintShown = true; }
    });

    const onAns = (val) => {
      localAttempts++;
      const fb = _root.querySelector('.tv-feedback');
      if (String(val).trim() === String(p.answer)) {
        const pts = Math.max(10, 100 - localHints * 20 - (localAttempts - 1) * 10);
        _st.score += pts;
        fb.className = 'tv-feedback ok';
        fb.textContent = `✅ ${_t('Vault Opened!', 'Cofre Aberto!')} +${pts} pts`;
        fb.style.display = 'block';
        spawnParts();
        cleanKH();
        const next = document.createElement('button');
        next.className = 'tv-next-btn';
        next.textContent = idx + 1 < total ? `▶ ${_t('Next Vault', 'Próximo Cofre')}` : `🏆 ${_t('Finish', 'Terminar')}`;
        fb.after(next);
        next.addEventListener('click', () => {
          if (idx + 1 < total) showStep(idx + 1);
          else showComplete();
        });
        _root.querySelectorAll('.tv-kp-btn,.tv-choice-btn').forEach(b => b.disabled = true);
      } else {
        fb.className = 'tv-feedback err';
        fb.textContent = `❌ ${_t('Wrong combination! Try again.', 'Combinação errada! Tenta outra vez.')}`;
        fb.style.display = 'block';
        if (p.input === 'keypad') {
          const disp = _root.querySelector('.tv-kp-display');
          if (disp) { disp.textContent = ''; disp.dataset.val = ''; }
        }
      }
    };

    if (p.input === 'keypad') wireKP(onAns);
    else wireChoices(p, onAns);
  }

  function vizHTML(p) {
    const v = p.viz;
    if (!v) return '';
    if (v.type === 'seq') {
      return `<div class="tv-viz-seq">${v.vals.map(x =>
        `<div class="tv-viz-box${x==='?'?' q':''}">${x}</div>`).join('<span style="color:#fbbf24">→</span>')}</div>`;
    }
    if (v.type === 'formula' || v.type === 'equation') {
      return `<div class="tv-viz-eq">${v.expr}</div>`;
    }
    if (v.type === 'grid') {
      return `<div class="tv-viz-grid">${Array(v.rows * v.cols).fill(v.icon).map(ic =>
        `<span class="tv-viz-icon">${ic}</span>`).join('')}</div>`;
    }
    if (v.type === 'choice-info') {
      return `<div class="tv-viz-seq">${v.options.map(o => `<div class="tv-viz-box">${o}</div>`).join('')}</div>`;
    }
    if (v.type === 'percent') {
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%">
        <div class="tv-pct-bar"><div class="tv-pct-fill" style="width:${v.pct}%"></div></div>
        <div class="tv-pct-label">${v.pct}% ${_t('of','de')} ${v.total} ${v.icon}</div>
      </div>`;
    }
    if (v.type === 'system') {
      return `<div class="tv-sys"><div class="tv-sys-eq">${v.eq1}</div><div class="tv-sys-eq">${v.eq2}</div></div>`;
    }
    if (v.type === 'var-formula') {
      return `<div class="tv-vf">${v.expr}<br><span style="color:#fbbf24">n = ${v.n}</span></div>`;
    }
    if (v.type === 'modular') {
      return `<div class="tv-mod"><span>${v.dividend}</span><span style="color:#fbbf24">mod</span><span>${v.divisor}</span><span style="color:#fbbf24">=</span><div class="tv-viz-box q">?</div></div>`;
    }
    if (v.type === 'powers') {
      return `<div class="tv-pows">${v.terms.map((t,i) =>
        `<div class="tv-pow-term">${t} = ${v.vals[i]}</div>`).join('<span style="color:#fbbf24">+</span>')}</div>`;
    }
    if (v.type === 'primes') {
      return `<div class="tv-primes">${v.shown.map(x =>
        `<div class="tv-prime-box${x==='?'?' q':''}">${x}</div>`).join('')}</div>`;
    }
    return '';
  }

  function inputHTML(p) {
    if (p.input === 'keypad') {
      return `<div class="tv-kp">
        <div class="tv-kp-display" data-val=""></div>
        ${[7,8,9,4,5,6,1,2,3].map(n=>`<button class="tv-kp-btn" data-n="${n}">${n}</button>`).join('')}
        <button class="tv-kp-btn" data-n="0">0</button>
        <button class="tv-kp-btn" data-n="del">⌫</button>
        <button class="tv-kp-btn" data-n="ok">✓</button>
      </div>`;
    }
    if (p.input === 'choice') {
      return `<div class="tv-choices">${p.viz.options.map(o =>
        `<button class="tv-choice-btn" data-val="${o}">${o}</button>`).join('')}</div>`;
    }
    return '';
  }

  function wireKP(onAns) {
    const disp = _root.querySelector('.tv-kp-display');
    _root.querySelectorAll('.tv-kp-btn').forEach(b => {
      b.addEventListener('click', () => {
        const n = b.dataset.n;
        if (n === 'del') { disp.dataset.val = (disp.dataset.val || '').slice(0,-1); }
        else if (n === 'ok') { if (disp.dataset.val) onAns(disp.dataset.val); }
        else { disp.dataset.val = (disp.dataset.val || '') + n; }
        disp.textContent = disp.dataset.val || '';
      });
    });
    cleanKH();
    _kh = e => {
      if (e.key >= '0' && e.key <= '9') { disp.dataset.val = (disp.dataset.val || '') + e.key; disp.textContent = disp.dataset.val; }
      else if (e.key === 'Backspace') { disp.dataset.val = (disp.dataset.val || '').slice(0,-1); disp.textContent = disp.dataset.val; }
      else if (e.key === 'Enter') { if (disp.dataset.val) onAns(disp.dataset.val); }
    };
    document.addEventListener('keydown', _kh);
  }

  function wireChoices(p, onAns) {
    _root.querySelectorAll('.tv-choice-btn').forEach(b => {
      b.addEventListener('click', () => {
        _root.querySelectorAll('.tv-choice-btn').forEach(x => x.disabled = true);
        if (b.dataset.val === p.answer) b.classList.add('correct');
        else {
          b.classList.add('wrong');
          _root.querySelectorAll('.tv-choice-btn').forEach(x => { if (x.dataset.val === p.answer) x.classList.add('correct'); });
        }
        onAns(b.dataset.val);
      });
    });
  }

  function showComplete() {
    const tier = tierFor(_st.age);
    const elapsed = Math.round((Date.now() - _st.startTime) / 1000);
    if (!_st.bests[tier]) _st.bests[tier] = [];
    _st.bests[tier] = [..._st.bests[tier], _st.score].sort((a,b)=>b-a).slice(0,3);
    saveSt();
    _root.innerHTML = `<div class="tv-wrap"><div class="tv-complete">
      <h2>🏺 ${_t('All Vaults Unlocked!', 'Todos os Cofres Abertos!')}</h2>
      <div class="tv-final-score">${_st.score}</div>
      <p>${_t('points', 'pontos')} · ${elapsed}s · ${_st.totalHints} ${_t('hints', 'dicas')}</p>
      <button class="tv-replay-btn">🔄 ${_t('Try Again', 'Tentar Novamente')}</button>
    </div></div>`;
    spawnParts(); spawnParts(); spawnParts();
    _root.querySelector('.tv-replay-btn').addEventListener('click', () => { _st = defSt(); loadSt(); showMenu(); });
  }

  function spawnParts() {
    const wrap = _root.querySelector('.tv-wrap');
    if (!wrap) return;
    const colors = ['#fbbf24','#d97706','#f59e0b','#fef3c7','#fde68a'];
    for (let i = 0; i < 14; i++) {
      const d = document.createElement('div');
      d.className = 'tv-part';
      d.style.cssText = `width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;background:${colors[i%colors.length]};
        left:${10+Math.random()*80}%;top:${40+Math.random()*40}%;`;
      wrap.style.position = 'relative';
      wrap.appendChild(d);
      setTimeout(() => d.remove(), 850);
    }
  }

  function cleanKH() { if (_kh) { document.removeEventListener('keydown', _kh); _kh = null; } }

  function init(root) {
    _root = root;
    _st = defSt();
    injectCSS();
    loadSt();
    showMenu();
    document.addEventListener('langchange', () => {
      if (_root?.querySelector('.tv-menu')) showMenu();
    });
  }

  return { init };
})();
