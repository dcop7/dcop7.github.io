const CyberMazeGame = (function () {
  'use strict';

  function _t(en, pt) { try { return I18n.getLang() === 'pt' ? pt : en; } catch { return en; } }
  function tierFor(age) { const a = +age; if (a <= 8) return 'easy'; if (a <= 11) return 'med'; return 'hard'; }

  const PUZZLES = {
    easy: [
      { story: _t => _t('Maze node A: 9 + 7 = ? Pass through!', 'Nó A do labirinto: 9 + 7 = ? Passa!'),
        question: _t => _t('Enter the node code:', 'Introduz o código do nó:'),
        viz: { type:'formula', expr:'9 + 7 = ?' }, answer:'16', input:'keypad',
        hint: _t => _t('Count up from 9 seven times.', 'Conta 7 a partir de 9.') },
      { story: _t => _t('Firewall gate: 4 × 5 = ? Crack it!', 'Porta de firewall: 4 × 5 = ? Decifra!'),
        question: _t => _t('Enter access code:', 'Introduz o código de acesso:'),
        viz: { type:'grid', rows:4, cols:5, icon:'🔷' }, answer:'20', input:'keypad',
        hint: _t => _t('4 rows of 5 nodes.', '4 filas de 5 nós.') },
      { story: _t => _t('Cyber path: 30 − 14 = ? Unlock!', 'Caminho cibernético: 30 − 14 = ? Desbloqueia!'),
        question: _t => _t('Path code?', 'Código do caminho?'),
        viz: { type:'formula', expr:'30 − 14 = ?' }, answer:'16', input:'keypad',
        hint: _t => _t('Start at 30, remove 14.', 'Começa em 30, tira 14.') },
      { story: _t => _t('Neon route: 4, 8, 12, 16, ?', 'Rota neon: 4, 8, 12, 16, ?'),
        question: _t => _t('Next node?', 'Próximo nó?'),
        viz: { type:'seq', vals:[4,8,12,16,'?'] }, answer:'20', input:'keypad',
        hint: _t => _t('Add 4 each step.', 'Adiciona 4 em cada passo.') },
      { story: _t => _t('Exit portal: 45 ÷ 5 = ? Enter!', 'Portal de saída: 45 ÷ 5 = ? Entra!'),
        question: _t => _t('Portal code?', 'Código do portal?'),
        viz: { type:'formula', expr:'45 ÷ 5 = ?' }, answer:'9', input:'keypad',
        hint: _t => _t('How many 5s fit into 45?', 'Quantos 5s cabem em 45?') },
    ],
    med: [
      { story: _t => _t('Encrypted node: 6x + 4 = 46. Find x.', 'Nó encriptado: 6x + 4 = 46. Encontra x.'),
        question: _t => _t('Value of x?', 'Valor de x?'),
        viz: { type:'equation', expr:'6x + 4 = 46' }, answer:'7', input:'keypad',
        hint: _t => _t('46 − 4 = 42, then 42 ÷ 6.', '46 − 4 = 42, depois 42 ÷ 6.') },
      { story: _t => _t('Maze multiplier: 5, 15, 45, 135, ?', 'Multiplicador do labirinto: 5, 15, 45, 135, ?'),
        question: _t => _t('Next value?', 'Próximo valor?'),
        viz: { type:'seq', vals:[5,15,45,135,'?'] }, answer:'405', input:'keypad',
        hint: _t => _t('Multiply by 3 each time.', 'Multiplica por 3 de cada vez.') },
      { story: _t => _t('Cyber bridge: 55% of 80 data packets pass through.', 'Ponte cibernética: 55% de 80 pacotes de dados passam.'),
        question: _t => _t('Packets passing?', 'Pacotes que passam?'),
        viz: { type:'percent', total:80, pct:55, icon:'📦' }, answer:'44', input:'keypad',
        hint: _t => _t('55% of 80 = 0.55 × 80.', '55% de 80 = 0.55 × 80.') },
      { story: _t => _t('Split maze: R + S = 70, R − S = 14. Find R.', 'Labirinto dividido: R + S = 70, R − S = 14. Encontra R.'),
        question: _t => _t('Value of R?', 'Valor de R?'),
        viz: { type:'system', eq1:'R + S = 70', eq2:'R − S = 14' }, answer:'42', input:'keypad',
        hint: _t => _t('Add both equations: 2R = 84.', 'Soma as equações: 2R = 84.') },
      { story: _t => _t('Lock bypass: which IS a multiple of both 4 and 6?', 'Contornar fechadura: qual É múltiplo de 4 e de 6?'),
        question: _t => _t('Pick the common multiple:', 'Escolhe o múltiplo comum:'),
        viz: { type:'choice-info', options:['14','20','24','30'] }, answer:'24', input:'choice',
        hint: _t => _t('LCM of 4 and 6 is 12 — check multiples of 12.', 'MMC de 4 e 6 é 12 — verifica os múltiplos de 12.') },
    ],
    hard: [
      { story: _t => _t('Quantum gate: g(x) = 3x² − 2x + 1 at x = 4.', 'Porta quântica: g(x) = 3x² − 2x + 1 para x = 4.'),
        question: _t => _t('Value of g(4)?', 'Valor de g(4)?'),
        viz: { type:'var-formula', expr:'3x² − 2x + 1', n:4, result:41 }, answer:'41', input:'keypad',
        hint: _t => _t('3×16 − 8 + 1 = 48 − 8 + 1.', '3×16 − 8 + 1 = 48 − 8 + 1.') },
      { story: _t => _t('Digital cipher: 317 mod 13 = ?', 'Cifra digital: 317 mod 13 = ?'),
        question: _t => _t('Remainder?', 'Resto?'),
        viz: { type:'modular', dividend:317, divisor:13 }, answer:'5', input:'keypad',
        hint: _t => _t('317 ÷ 13 = 24 remainder ?', '317 ÷ 13 = 24 resto ?') },
      { story: _t => _t('Power boost: 4³ + 5² = ?', 'Impulso de energia: 4³ + 5² = ?'),
        question: _t => _t('Total power?', 'Energia total?'),
        viz: { type:'powers', terms:['4³','5²'], vals:[64,25] }, answer:'89', input:'keypad',
        hint: _t => _t('4³=64 and 5²=25.', '4³=64 e 5²=25.') },
      { story: _t => _t('Two firewall layers: C + D = 60, 3C − D = 20. Find C.', 'Duas camadas de firewall: C + D = 60, 3C − D = 20. Encontra C.'),
        question: _t => _t('Value of C?', 'Valor de C?'),
        viz: { type:'system', eq1:'C + D = 60', eq2:'3C − D = 20' }, answer:'20', input:'keypad',
        hint: _t => _t('Add both: 4C = 80.', 'Soma as duas: 4C = 80.') },
      { story: _t => _t('Maze prime lock: next prime after 79?', 'Fechadura prima do labirinto: próximo primo após 79?'),
        question: _t => _t('Next prime?', 'Próximo primo?'),
        viz: { type:'primes', shown:[71,73,79,'?'] }, answer:'83', input:'keypad',
        hint: _t => _t('Check 80(even),81(÷3),82(even),83.', 'Verifica 80,81,82,83.') },
    ],
  };

  let _root, _kh, _st;

  function defSt() { const dfAge = parseInt(localStorage.getItem('game-age-default') || '0') || null; return { age: dfAge, step: 0, score: 0, totalHints: 0, startTime: null, bests: {} }; }
  function saveSt() { try { localStorage.setItem('cm-st', JSON.stringify({ bests: _st.bests })); } catch {} }
  function loadSt() { try { const d = JSON.parse(localStorage.getItem('cm-st') || '{}'); if (d.bests) _st.bests = d.bests; } catch {} }

  function injectCSS() {
    if (document.getElementById('cm-css')) return;
    const s = document.createElement('style');
    s.id = 'cm-css';
    s.textContent = `
.cm-wrap { background:#0d0010; min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:24px 16px; font-family:'Segoe UI',sans-serif; color:#fce7f3; }
.cm-title { font-size:2rem; font-weight:900; text-align:center; margin-bottom:6px; color:#ec4899;
  text-shadow:0 0 18px #db2777,0 0 36px #be185d; letter-spacing:2px; }
.cm-subtitle { font-size:.95rem; color:#be185d; margin-bottom:24px; text-align:center; }
.cm-menu { width:100%; max-width:480px; }
.cm-menu h2 { font-size:1.1rem; color:#ec4899; margin-bottom:12px; text-align:center; }
.cm-age-grid { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:16px; }
.cm-age-btn { width:54px; height:40px; border:1.5px solid #831843; background:#1a0015; color:#fce7f3; border-radius:8px; cursor:pointer; font-size:.95rem; transition:all .15s; }
.cm-age-btn:hover { background:#2d0024; border-color:#ec4899; }
.cm-age-btn.active { background:#db2777; border-color:#ec4899; color:#fff; box-shadow:0 0 12px #ec4899; }
.cm-tier-hint { text-align:center; font-size:.85rem; color:#be185d; margin-bottom:14px; min-height:20px; }
.cm-start-btn { display:block; width:100%; padding:14px; background:linear-gradient(135deg,#db2777,#ec4899); color:#fff; border:none; border-radius:12px; font-size:1.1rem; font-weight:700; cursor:pointer; margin-bottom:20px; transition:opacity .2s; }
.cm-start-btn:hover { opacity:.85; }
.cm-bests { background:#1a0015; border:1px solid #831843; border-radius:10px; padding:12px 16px; }
.cm-bests h3 { font-size:.85rem; color:#be185d; margin:0 0 8px; text-transform:uppercase; letter-spacing:1px; }
.cm-best-row { display:flex; justify-content:space-between; font-size:.85rem; color:#f9a8d4; padding:3px 0; border-bottom:1px solid #2d0024; }
.cm-best-row:last-child { border-bottom:none; }
.cm-game { width:100%; max-width:540px; }
.cm-progress { display:flex; gap:8px; justify-content:center; margin-bottom:18px; }
.cm-dot { width:12px; height:12px; border-radius:50%; background:#2d0024; border:1.5px solid #831843; transition:all .3s; }
.cm-dot.dn { background:#db2777; border-color:#ec4899; }
.cm-dot.cr { background:#ec4899; border-color:#fce7f3; box-shadow:0 0 8px #ec4899; animation:cm-pulse .8s infinite alternate; }
@keyframes cm-pulse { from{transform:scale(1)} to{transform:scale(1.3)} }
.cm-card { background:#1a0015; border:1.5px solid #2d0024; border-radius:14px; padding:20px; margin-bottom:14px; }
.cm-story { font-size:1rem; color:#fce7f3; line-height:1.5; margin-bottom:12px; }
.cm-viz { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center; min-height:60px; margin:12px 0 16px; padding:12px; background:#0d0010; border-radius:10px; border:1px solid #2d0024; }
.cm-viz-seq { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center; }
.cm-viz-box { padding:8px 14px; background:#2d0024; border-radius:8px; font-size:1.15rem; font-weight:700; color:#fce7f3; border:1.5px solid #831843; }
.cm-viz-box.q { background:#db2777; color:#fff; animation:cm-pulse .8s infinite alternate; }
.cm-viz-eq { font-size:1.1rem; font-weight:700; color:#ec4899; text-align:center; letter-spacing:1px; }
.cm-viz-grid { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.cm-viz-icon { font-size:1.5rem; }
.cm-question { font-size:1rem; font-weight:600; color:#ec4899; margin-bottom:14px; }
.cm-kp { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; max-width:240px; margin:0 auto 10px; }
.cm-kp-btn { padding:12px; background:#1a0015; border:1.5px solid #831843; color:#fce7f3; border-radius:8px; font-size:1.1rem; cursor:pointer; transition:all .15s; }
.cm-kp-btn:hover { background:#2d0024; border-color:#ec4899; }
.cm-kp-display { grid-column:1/4; padding:10px; background:#0d0010; border:1.5px solid #db2777; border-radius:8px; text-align:center; font-size:1.3rem; font-weight:700; color:#ec4899; min-height:44px; letter-spacing:2px; }
.cm-choices { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
.cm-choice-btn { padding:14px; background:#1a0015; border:1.5px solid #831843; color:#fce7f3; border-radius:10px; font-size:1.05rem; font-weight:600; cursor:pointer; transition:all .15s; }
.cm-choice-btn:hover { background:#2d0024; border-color:#ec4899; }
.cm-choice-btn.correct { background:#14532d; border-color:#22c55e; color:#bbf7d0; }
.cm-choice-btn.wrong { background:#450a0a; border-color:#ef4444; color:#fca5a5; }
.cm-hint-btn { display:block; margin:0 auto 8px; padding:6px 18px; background:transparent; border:1.5px solid #831843; color:#ec4899; border-radius:20px; font-size:.85rem; cursor:pointer; }
.cm-hint-btn:hover { background:#2d0024; }
.cm-hint-text { font-size:.85rem; color:#be185d; text-align:center; margin-bottom:8px; padding:8px; background:#1a0015; border-radius:8px; }
.cm-feedback { text-align:center; padding:14px; border-radius:10px; margin-bottom:10px; font-size:1rem; font-weight:600; }
.cm-feedback.ok { background:#1a2e1a; color:#86efac; border:1px solid #22c55e; }
.cm-feedback.err { background:#2e1a1a; color:#fca5a5; border:1px solid #ef4444; }
.cm-next-btn { display:block; width:100%; padding:12px; background:linear-gradient(135deg,#db2777,#ec4899); color:#fff; border:none; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; margin-top:8px; }
.cm-score-bar { display:flex; justify-content:space-between; font-size:.8rem; color:#be185d; margin-bottom:4px; }
.cm-complete { text-align:center; padding:30px 20px; }
.cm-complete h2 { font-size:1.8rem; color:#ec4899; margin-bottom:8px; text-shadow:0 0 16px #db2777; }
.cm-complete .cm-final-score { font-size:2.5rem; font-weight:900; color:#fce7f3; margin:10px 0; }
.cm-complete p { color:#be185d; margin-bottom:20px; }
.cm-replay-btn { padding:12px 32px; background:linear-gradient(135deg,#db2777,#ec4899); color:#fff; border:none; border-radius:12px; font-size:1.05rem; font-weight:700; cursor:pointer; }
.cm-part { position:absolute; border-radius:50%; pointer-events:none; animation:cm-fly .8s ease-out forwards; }
@keyframes cm-fly { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-60px) scale(0.3)} }
.cm-sys { display:flex; flex-direction:column; gap:8px; align-items:center; }
.cm-sys-eq { padding:8px 20px; background:#2d0024; border-radius:8px; font-size:1rem; color:#fce7f3; border:1px solid #831843; }
.cm-primes { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.cm-prime-box { padding:8px 14px; background:#2d0024; border-radius:8px; font-size:1.1rem; color:#fce7f3; border:1.5px solid #831843; }
.cm-prime-box.q { background:#db2777; color:#fff; animation:cm-pulse .8s infinite alternate; }
.cm-pows { display:flex; gap:14px; align-items:center; font-size:1.2rem; color:#fce7f3; }
.cm-pow-term { padding:8px 12px; background:#2d0024; border-radius:8px; border:1px solid #831843; }
.cm-mod { display:flex; align-items:center; gap:10px; font-size:1.3rem; color:#fce7f3; }
.cm-pct-bar { width:100%; max-width:260px; height:22px; background:#2d0024; border-radius:11px; overflow:hidden; }
.cm-pct-fill { height:100%; background:linear-gradient(90deg,#db2777,#ec4899); border-radius:11px; transition:width .5s; }
.cm-pct-label { font-size:.85rem; color:#ec4899; margin-top:4px; text-align:center; }
.cm-vf { font-size:1rem; color:#fce7f3; text-align:center; }
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
      return scores.map(s => `<div class="cm-best-row"><span>${label}</span><span>${s} pts</span></div>`).join('');
    }).join('');

    _root.innerHTML = `<div class="cm-wrap">
      <div class="cm-title">🌀 ${_t('Cyber Maze', 'Labirinto Cibernético')}</div>
      <div class="cm-subtitle">${_t('Navigate the neon maze with math!', 'Navega no labirinto neon com matemática!')}</div>
      <div class="cm-menu">
        <h2>${_t('Select your age:', 'Seleciona a tua idade:')}</h2>
        <div class="cm-age-grid">
          ${[6,7,8,9,10,11,12,13,14].map(a => `
            <button class="cm-age-btn${_st.age==a?' active':''}" data-age="${a}">${a}${a===14?'+':''}</button>
          `).join('')}
        </div>
        <div class="cm-tier-hint">${tierLabel}</div>
        <button class="cm-start-btn"${!_st.age?' disabled':''}>🌀 ${_t('Enter the Maze!', 'Entrar no Labirinto!')}</button>
        ${bestRows ? `<div class="cm-bests"><h3>🏆 ${_t('Best Scores','Melhores Pontuações')}</h3>${bestRows}</div>` : ''}
      </div>
    </div>`;

    _root.querySelectorAll('.cm-age-btn').forEach(b => b.addEventListener('click', () => {
      _st.age = +b.dataset.age; showMenu();
    }));
    _root.querySelector('.cm-start-btn')?.addEventListener('click', () => {
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
      `<div class="cm-dot ${i < idx ? 'dn' : i === idx ? 'cr' : ''}"></div>`).join('');

    _root.innerHTML = `<div class="cm-wrap">
      <div class="cm-title">🌀 ${_t('Cyber Maze', 'Labirinto Cibernético')}</div>
      <div class="cm-game">
        <div class="cm-score-bar">
          <span>${_t('Node', 'Nó')} ${idx+1}/${total}</span>
          <span>${_t('Score', 'Pontuação')}: ${_st.score}</span>
        </div>
        <div class="cm-progress">${dots}</div>
        <div class="cm-card">
          <div class="cm-story">${p.story(_t)}</div>
          <div class="cm-viz">${vizHTML(p)}</div>
          <div class="cm-question">${p.question(_t)}</div>
          ${inputHTML(p)}
          <button class="cm-hint-btn">💡 ${_t('Hint', 'Dica')}</button>
          <div class="cm-hint-text" style="display:none">${p.hint(_t)}</div>
          <div class="cm-feedback" style="display:none"></div>
        </div>
      </div>
    </div>`;

    const hintBtn = _root.querySelector('.cm-hint-btn');
    const hintText = _root.querySelector('.cm-hint-text');
    hintBtn.addEventListener('click', () => {
      hintText.style.display = 'block'; hintBtn.style.display = 'none';
      if (!hintShown) { localHints++; _st.totalHints++; hintShown = true; }
    });

    const onAns = (val) => {
      localAttempts++;
      const fb = _root.querySelector('.cm-feedback');
      if (String(val).trim() === String(p.answer)) {
        const pts = Math.max(10, 100 - localHints * 20 - (localAttempts - 1) * 10);
        _st.score += pts;
        fb.className = 'cm-feedback ok';
        fb.textContent = `✅ ${_t('Node cleared!', 'Nó desbloqueado!')} +${pts} pts`;
        fb.style.display = 'block';
        spawnParts();
        cleanKH();
        const next = document.createElement('button');
        next.className = 'cm-next-btn';
        next.textContent = idx + 1 < total ? `▶ ${_t('Next Node', 'Próximo Nó')}` : `🏆 ${_t('Finish', 'Terminar')}`;
        fb.after(next);
        next.addEventListener('click', () => {
          if (idx + 1 < total) showStep(idx + 1);
          else showComplete();
        });
        _root.querySelectorAll('.cm-kp-btn,.cm-choice-btn').forEach(b => b.disabled = true);
      } else {
        fb.className = 'cm-feedback err';
        fb.textContent = `❌ ${_t('Access denied! Try again.', 'Acesso negado! Tenta outra vez.')}`;
        fb.style.display = 'block';
        if (p.input === 'keypad') {
          const disp = _root.querySelector('.cm-kp-display');
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
      return `<div class="cm-viz-seq">${v.vals.map(x =>
        `<div class="cm-viz-box${x==='?'?' q':''}">${x}</div>`).join('<span style="color:#ec4899">→</span>')}</div>`;
    }
    if (v.type === 'formula' || v.type === 'equation') {
      return `<div class="cm-viz-eq">${v.expr}</div>`;
    }
    if (v.type === 'grid') {
      return `<div class="cm-viz-grid">${Array(v.rows * v.cols).fill(v.icon).map(ic =>
        `<span class="cm-viz-icon">${ic}</span>`).join('')}</div>`;
    }
    if (v.type === 'choice-info') {
      return `<div class="cm-viz-seq">${v.options.map(o => `<div class="cm-viz-box">${o}</div>`).join('')}</div>`;
    }
    if (v.type === 'percent') {
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%">
        <div class="cm-pct-bar"><div class="cm-pct-fill" style="width:${v.pct}%"></div></div>
        <div class="cm-pct-label">${v.pct}% ${_t('of','de')} ${v.total} ${v.icon}</div>
      </div>`;
    }
    if (v.type === 'system') {
      return `<div class="cm-sys"><div class="cm-sys-eq">${v.eq1}</div><div class="cm-sys-eq">${v.eq2}</div></div>`;
    }
    if (v.type === 'var-formula') {
      return `<div class="cm-vf">${v.expr}<br><span style="color:#ec4899">x = ${v.n}</span></div>`;
    }
    if (v.type === 'modular') {
      return `<div class="cm-mod"><span>${v.dividend}</span><span style="color:#ec4899">mod</span><span>${v.divisor}</span><span style="color:#ec4899">=</span><div class="cm-viz-box q">?</div></div>`;
    }
    if (v.type === 'powers') {
      return `<div class="cm-pows">${v.terms.map((t,i) =>
        `<div class="cm-pow-term">${t} = ${v.vals[i]}</div>`).join('<span style="color:#ec4899">+</span>')}</div>`;
    }
    if (v.type === 'primes') {
      return `<div class="cm-primes">${v.shown.map(x =>
        `<div class="cm-prime-box${x==='?'?' q':''}">${x}</div>`).join('')}</div>`;
    }
    return '';
  }

  function inputHTML(p) {
    if (p.input === 'keypad') {
      return `<div class="cm-kp">
        <div class="cm-kp-display" data-val=""></div>
        ${[7,8,9,4,5,6,1,2,3].map(n=>`<button class="cm-kp-btn" data-n="${n}">${n}</button>`).join('')}
        <button class="cm-kp-btn" data-n="0">0</button>
        <button class="cm-kp-btn" data-n="del">⌫</button>
        <button class="cm-kp-btn" data-n="ok">✓</button>
      </div>`;
    }
    if (p.input === 'choice') {
      return `<div class="cm-choices">${p.viz.options.map(o =>
        `<button class="cm-choice-btn" data-val="${o}">${o}</button>`).join('')}</div>`;
    }
    return '';
  }

  function wireKP(onAns) {
    const disp = _root.querySelector('.cm-kp-display');
    _root.querySelectorAll('.cm-kp-btn').forEach(b => {
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
    _root.querySelectorAll('.cm-choice-btn').forEach(b => {
      b.addEventListener('click', () => {
        _root.querySelectorAll('.cm-choice-btn').forEach(x => x.disabled = true);
        if (b.dataset.val === p.answer) b.classList.add('correct');
        else {
          b.classList.add('wrong');
          _root.querySelectorAll('.cm-choice-btn').forEach(x => { if (x.dataset.val === p.answer) x.classList.add('correct'); });
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
    _root.innerHTML = `<div class="cm-wrap"><div class="cm-complete">
      <h2>🌀 ${_t('Maze Escaped!', 'Labirinto Escapado!')}</h2>
      <div class="cm-final-score">${_st.score}</div>
      <p>${_t('points', 'pontos')} · ${elapsed}s · ${_st.totalHints} ${_t('hints', 'dicas')}</p>
      <button class="cm-replay-btn">🔄 ${_t('New Maze', 'Novo Labirinto')}</button>
    </div></div>`;
    spawnParts(); spawnParts(); spawnParts();
    _root.querySelector('.cm-replay-btn').addEventListener('click', () => { _st = defSt(); loadSt(); showMenu(); });
  }

  function spawnParts() {
    const wrap = _root.querySelector('.cm-wrap');
    if (!wrap) return;
    const colors = ['#ec4899','#db2777','#be185d','#f9a8d4','#fce7f3'];
    for (let i = 0; i < 14; i++) {
      const d = document.createElement('div');
      d.className = 'cm-part';
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
      if (_root?.querySelector('.cm-menu')) showMenu();
    });
  }

  return { init };
})();
