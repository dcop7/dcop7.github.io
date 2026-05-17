const MathDetectiveGame = (function () {
  'use strict';

  function _t(en, pt) { try { return I18n.getLang() === 'pt' ? pt : en; } catch { return en; } }
  function tierFor(age) { const a = +age; if (a <= 8) return 'easy'; if (a <= 11) return 'med'; return 'hard'; }

  const PUZZLES = {
    easy: [
      { story: _t => _t('Detective finds 8 clues on Monday and 5 on Tuesday.', 'Detetive encontra 8 pistas na segunda e 5 na terça.'),
        question: _t => _t('Total clues found?', 'Total de pistas encontradas?'),
        viz: { type:'formula', expr:'8 + 5 = ?' }, answer:'13', input:'keypad',
        hint: _t => _t('Add the two days together.', 'Adiciona os dois dias.') },
      { story: _t => _t('A thief left 4 footprints per room in 3 rooms.', 'Um ladrão deixou 4 pegadas em cada um dos 3 quartos.'),
        question: _t => _t('Total footprints?', 'Total de pegadas?'),
        viz: { type:'grid', rows:3, cols:4, icon:'👣' }, answer:'12', input:'keypad',
        hint: _t => _t('3 groups of 4 footprints.', '3 grupos de 4 pegadas.') },
      { story: _t => _t('Evidence bag holds 20 items. 7 have been analyzed.', 'Saco de evidências tem 20 itens. 7 foram analisados.'),
        question: _t => _t('Items left to analyze?', 'Itens que faltam analisar?'),
        viz: { type:'formula', expr:'20 − 7 = ?' }, answer:'13', input:'keypad',
        hint: _t => _t('Subtract analyzed from total.', 'Subtrai os analisados do total.') },
      { story: _t => _t('Mystery sequence: 5, 10, 15, 20, ?', 'Sequência misteriosa: 5, 10, 15, 20, ?'),
        question: _t => _t('Next clue number?', 'Próximo número de pista?'),
        viz: { type:'seq', vals:[5,10,15,20,'?'] }, answer:'25', input:'keypad',
        hint: _t => _t('Add 5 each time.', 'Adiciona 5 de cada vez.') },
      { story: _t => _t('Detective split 18 photos equally between 3 suspects.', 'Detetive dividiu 18 fotos igualmente por 3 suspeitos.'),
        question: _t => _t('Photos per suspect?', 'Fotos por suspeito?'),
        viz: { type:'division', total:18, groups:3, icon:'📷' }, answer:'6', input:'keypad',
        hint: _t => _t('18 divided by 3.', '18 a dividir por 3.') },
    ],
    med: [
      { story: _t => _t('Crime scene code: 3x + 7 = 31. Find x.', 'Código da cena do crime: 3x + 7 = 31. Encontra x.'),
        question: _t => _t('Value of x?', 'Valor de x?'),
        viz: { type:'equation', expr:'3x + 7 = 31' }, answer:'8', input:'keypad',
        hint: _t => _t('31 − 7 = 24, then 24 ÷ 3.', '31 − 7 = 24, depois 24 ÷ 3.') },
      { story: _t => _t('Clue sequence triples: 2, 6, 18, 54, ?', 'Sequência de pistas triplica: 2, 6, 18, 54, ?'),
        question: _t => _t('Next value?', 'Próximo valor?'),
        viz: { type:'seq', vals:[2,6,18,54,'?'] }, answer:'162', input:'keypad',
        hint: _t => _t('Multiply each term by 3.', 'Multiplica cada termo por 3.') },
      { story: _t => _t('75% of 60 witness reports are reliable.', '75% de 60 relatórios de testemunhas são fiáveis.'),
        question: _t => _t('Reliable reports?', 'Relatórios fiáveis?'),
        viz: { type:'percent', total:60, pct:75, icon:'📋' }, answer:'45', input:'keypad',
        hint: _t => _t('75% of 60 = 0.75 × 60.', '75% de 60 = 0.75 × 60.') },
      { story: _t => _t('Two detectives: A solved 3 more cases than B. Together 19 cases.', 'Dois detetives: A resolveu 3 mais do que B. Juntos 19 casos.'),
        question: _t => _t('Cases solved by B?', 'Casos resolvidos por B?'),
        viz: { type:'system', eq1:'A + B = 19', eq2:'A = B + 3' }, answer:'8', input:'keypad',
        hint: _t => _t('B+3+B=19, so 2B=16.', 'B+3+B=19, logo 2B=16.') },
      { story: _t => _t('Safe code: what is the LCM of 4 and 6?', 'Código do cofre: qual é o MMC de 4 e 6?'),
        question: _t => _t('Least common multiple?', 'Mínimo múltiplo comum?'),
        viz: { type:'choice-info', options:['8','10','12','16'] }, answer:'12', input:'choice',
        hint: _t => _t('Multiples of 4: 4,8,12… Multiples of 6: 6,12…', 'Múltiplos de 4: 4,8,12… Múltiplos de 6: 6,12…') },
    ],
    hard: [
      { story: _t => _t('Cipher: n² − 3n + 2 at n = 7.', 'Cifra: n² − 3n + 2 para n = 7.'),
        question: _t => _t('Value of the expression?', 'Valor da expressão?'),
        viz: { type:'var-formula', expr:'n² − 3n + 2', n:7, result:30 }, answer:'30', input:'keypad',
        hint: _t => _t('49 − 21 + 2.', '49 − 21 + 2.') },
      { story: _t => _t('Vault lock: 191 mod 11 = ?', 'Fechadura do cofre: 191 mod 11 = ?'),
        question: _t => _t('Remainder?', 'Resto?'),
        viz: { type:'modular', dividend:191, divisor:11 }, answer:'4', input:'keypad',
        hint: _t => _t('191 ÷ 11 = 17 remainder ?', '191 ÷ 11 = 17 resto ?') },
      { story: _t => _t('Case files: 2⁵ + 3³ = ?', 'Ficheiros do caso: 2⁵ + 3³ = ?'),
        question: _t => _t('Total?', 'Total?'),
        viz: { type:'powers', terms:['2⁵','3³'], vals:[32,27] }, answer:'59', input:'keypad',
        hint: _t => _t('2⁵=32 and 3³=27.', '2⁵=32 e 3³=27.') },
      { story: _t => _t('Two suspects: X + Y = 50, 2X − Y = 10. Find X.', 'Dois suspeitos: X + Y = 50, 2X − Y = 10. Encontra X.'),
        question: _t => _t('Value of X?', 'Valor de X?'),
        viz: { type:'system', eq1:'X + Y = 50', eq2:'2X − Y = 10' }, answer:'20', input:'keypad',
        hint: _t => _t('Add both equations: 3X = 60.', 'Soma as equações: 3X = 60.') },
      { story: _t => _t('Next prime after 53?', 'Próximo número primo após 53?'),
        question: _t => _t('Next prime?', 'Próximo primo?'),
        viz: { type:'primes', shown:[43,47,53,'?'] }, answer:'59', input:'keypad',
        hint: _t => _t('Check 54(even), 55(÷5), 56(even), 57(÷3), 58(even), 59.', 'Verifica 54,55,56,57,58,59.') },
    ],
  };

  let _root, _kh, _st;

  function defSt() { return { age: null, step: 0, score: 0, totalHints: 0, startTime: null, bests: {} }; }
  function saveSt() { try { localStorage.setItem('dt-st', JSON.stringify({ bests: _st.bests })); } catch {} }
  function loadSt() { try { const d = JSON.parse(localStorage.getItem('dt-st') || '{}'); if (d.bests) _st.bests = d.bests; } catch {} }

  function injectCSS() {
    if (document.getElementById('dt-css')) return;
    const s = document.createElement('style');
    s.id = 'dt-css';
    s.textContent = `
.dt-wrap { background:#0d0800; min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:24px 16px; font-family:'Segoe UI',sans-serif; color:#fde68a; }
.dt-title { font-size:2rem; font-weight:900; text-align:center; margin-bottom:6px; color:#f59e0b;
  text-shadow:0 0 18px #d97706,0 0 36px #b45309; letter-spacing:2px; }
.dt-subtitle { font-size:.95rem; color:#b45309; margin-bottom:24px; text-align:center; }
.dt-menu { width:100%; max-width:480px; }
.dt-menu h2 { font-size:1.1rem; color:#f59e0b; margin-bottom:12px; text-align:center; }
.dt-age-grid { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:16px; }
.dt-age-btn { width:54px; height:40px; border:1.5px solid #92400e; background:#1c0f00; color:#fde68a; border-radius:8px; cursor:pointer; font-size:.95rem; transition:all .15s; }
.dt-age-btn:hover { background:#2c1800; border-color:#f59e0b; }
.dt-age-btn.active { background:#d97706; border-color:#f59e0b; color:#fff; box-shadow:0 0 12px #f59e0b; }
.dt-tier-hint { text-align:center; font-size:.85rem; color:#b45309; margin-bottom:14px; min-height:20px; }
.dt-start-btn { display:block; width:100%; padding:14px; background:linear-gradient(135deg,#d97706,#f59e0b); color:#fff; border:none; border-radius:12px; font-size:1.1rem; font-weight:700; cursor:pointer; margin-bottom:20px; transition:opacity .2s; }
.dt-start-btn:hover { opacity:.85; }
.dt-bests { background:#1c0f00; border:1px solid #92400e; border-radius:10px; padding:12px 16px; }
.dt-bests h3 { font-size:.85rem; color:#b45309; margin:0 0 8px; text-transform:uppercase; letter-spacing:1px; }
.dt-best-row { display:flex; justify-content:space-between; font-size:.85rem; color:#fbbf24; padding:3px 0; border-bottom:1px solid #2c1800; }
.dt-best-row:last-child { border-bottom:none; }
.dt-game { width:100%; max-width:540px; }
.dt-progress { display:flex; gap:8px; justify-content:center; margin-bottom:18px; }
.dt-dot { width:12px; height:12px; border-radius:50%; background:#2c1800; border:1.5px solid #92400e; transition:all .3s; }
.dt-dot.dn { background:#d97706; border-color:#f59e0b; }
.dt-dot.cr { background:#f59e0b; border-color:#fde68a; box-shadow:0 0 8px #f59e0b; animation:dt-pulse .8s infinite alternate; }
@keyframes dt-pulse { from{transform:scale(1)} to{transform:scale(1.3)} }
.dt-card { background:#1c0f00; border:1.5px solid #2c1800; border-radius:14px; padding:20px; margin-bottom:14px; }
.dt-story { font-size:1rem; color:#fde68a; line-height:1.5; margin-bottom:12px; }
.dt-viz { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center; min-height:60px; margin:12px 0 16px; padding:12px; background:#0d0800; border-radius:10px; border:1px solid #2c1800; }
.dt-viz-seq { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center; }
.dt-viz-box { padding:8px 14px; background:#2c1800; border-radius:8px; font-size:1.15rem; font-weight:700; color:#fde68a; border:1.5px solid #92400e; }
.dt-viz-box.q { background:#d97706; color:#fff; animation:dt-pulse .8s infinite alternate; }
.dt-viz-eq { font-size:1.1rem; font-weight:700; color:#f59e0b; text-align:center; letter-spacing:1px; }
.dt-viz-grid { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.dt-viz-icon { font-size:1.5rem; }
.dt-question { font-size:1rem; font-weight:600; color:#f59e0b; margin-bottom:14px; }
.dt-kp { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; max-width:240px; margin:0 auto 10px; }
.dt-kp-btn { padding:12px; background:#1c0f00; border:1.5px solid #92400e; color:#fde68a; border-radius:8px; font-size:1.1rem; cursor:pointer; transition:all .15s; }
.dt-kp-btn:hover { background:#2c1800; border-color:#f59e0b; }
.dt-kp-display { grid-column:1/4; padding:10px; background:#0d0800; border:1.5px solid #d97706; border-radius:8px; text-align:center; font-size:1.3rem; font-weight:700; color:#f59e0b; min-height:44px; letter-spacing:2px; }
.dt-choices { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
.dt-choice-btn { padding:14px; background:#1c0f00; border:1.5px solid #92400e; color:#fde68a; border-radius:10px; font-size:1.05rem; font-weight:600; cursor:pointer; transition:all .15s; }
.dt-choice-btn:hover { background:#2c1800; border-color:#f59e0b; }
.dt-choice-btn.correct { background:#14532d; border-color:#22c55e; color:#bbf7d0; }
.dt-choice-btn.wrong { background:#450a0a; border-color:#ef4444; color:#fca5a5; }
.dt-hint-btn { display:block; margin:0 auto 8px; padding:6px 18px; background:transparent; border:1.5px solid #92400e; color:#f59e0b; border-radius:20px; font-size:.85rem; cursor:pointer; }
.dt-hint-btn:hover { background:#2c1800; }
.dt-hint-text { font-size:.85rem; color:#b45309; text-align:center; margin-bottom:8px; padding:8px; background:#1c0f00; border-radius:8px; }
.dt-feedback { text-align:center; padding:14px; border-radius:10px; margin-bottom:10px; font-size:1rem; font-weight:600; }
.dt-feedback.ok { background:#1a2e1a; color:#86efac; border:1px solid #22c55e; }
.dt-feedback.err { background:#2e1a1a; color:#fca5a5; border:1px solid #ef4444; }
.dt-next-btn { display:block; width:100%; padding:12px; background:linear-gradient(135deg,#d97706,#f59e0b); color:#fff; border:none; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; margin-top:8px; }
.dt-score-bar { display:flex; justify-content:space-between; font-size:.8rem; color:#b45309; margin-bottom:4px; }
.dt-complete { text-align:center; padding:30px 20px; }
.dt-complete h2 { font-size:1.8rem; color:#f59e0b; margin-bottom:8px; text-shadow:0 0 16px #d97706; }
.dt-complete .dt-final-score { font-size:2.5rem; font-weight:900; color:#fde68a; margin:10px 0; }
.dt-complete p { color:#b45309; margin-bottom:20px; }
.dt-replay-btn { padding:12px 32px; background:linear-gradient(135deg,#d97706,#f59e0b); color:#fff; border:none; border-radius:12px; font-size:1.05rem; font-weight:700; cursor:pointer; }
.dt-part { position:absolute; border-radius:50%; pointer-events:none; animation:dt-fly .8s ease-out forwards; }
@keyframes dt-fly { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-60px) scale(0.3)} }
.dt-sys { display:flex; flex-direction:column; gap:8px; align-items:center; }
.dt-sys-eq { padding:8px 20px; background:#2c1800; border-radius:8px; font-size:1rem; color:#fde68a; border:1px solid #92400e; }
.dt-primes { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.dt-prime-box { padding:8px 14px; background:#2c1800; border-radius:8px; font-size:1.1rem; color:#fde68a; border:1.5px solid #92400e; }
.dt-prime-box.q { background:#d97706; color:#fff; animation:dt-pulse .8s infinite alternate; }
.dt-pows { display:flex; gap:14px; align-items:center; font-size:1.2rem; color:#fde68a; }
.dt-pow-term { padding:8px 12px; background:#2c1800; border-radius:8px; border:1px solid #92400e; }
.dt-mod { display:flex; align-items:center; gap:10px; font-size:1.3rem; color:#fde68a; }
.dt-pct-bar { width:100%; max-width:260px; height:22px; background:#2c1800; border-radius:11px; overflow:hidden; }
.dt-pct-fill { height:100%; background:linear-gradient(90deg,#d97706,#f59e0b); border-radius:11px; transition:width .5s; }
.dt-pct-label { font-size:.85rem; color:#f59e0b; margin-top:4px; text-align:center; }
.dt-div { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; }
.dt-vf { font-size:1rem; color:#fde68a; text-align:center; }
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
      return scores.map(s => `<div class="dt-best-row"><span>${label}</span><span>${s} pts</span></div>`).join('');
    }).join('');

    _root.innerHTML = `<div class="dt-wrap">
      <div class="dt-title">🔍 ${_t('Math Detective', 'Detetive Matemático')}</div>
      <div class="dt-subtitle">${_t('Solve mysteries using math clues!', 'Resolve mistérios usando pistas matemáticas!')}</div>
      <div class="dt-menu">
        <h2>${_t('Select your age:', 'Seleciona a tua idade:')}</h2>
        <div class="dt-age-grid">
          ${[6,7,8,9,10,11,12,13,14].map(a => `
            <button class="dt-age-btn${_st.age==a?' active':''}" data-age="${a}">${a}${a===14?'+':''}</button>
          `).join('')}
        </div>
        <div class="dt-tier-hint">${tierLabel}</div>
        <button class="dt-start-btn"${!_st.age?' disabled':''}>🔍 ${_t('Investigate!', 'Investigar!')}</button>
        ${bestRows ? `<div class="dt-bests"><h3>🏆 ${_t('Best Scores','Melhores Pontuações')}</h3>${bestRows}</div>` : ''}
      </div>
    </div>`;

    _root.querySelectorAll('.dt-age-btn').forEach(b => b.addEventListener('click', () => {
      _st.age = +b.dataset.age; showMenu();
    }));
    _root.querySelector('.dt-start-btn')?.addEventListener('click', () => {
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
      `<div class="dt-dot ${i < idx ? 'dn' : i === idx ? 'cr' : ''}"></div>`).join('');

    _root.innerHTML = `<div class="dt-wrap">
      <div class="dt-title">🔍 ${_t('Math Detective', 'Detetive Matemático')}</div>
      <div class="dt-game">
        <div class="dt-score-bar">
          <span>${_t('Case', 'Caso')} ${idx+1}/${total}</span>
          <span>${_t('Score', 'Pontuação')}: ${_st.score}</span>
        </div>
        <div class="dt-progress">${dots}</div>
        <div class="dt-card">
          <div class="dt-story">${p.story(_t)}</div>
          <div class="dt-viz">${vizHTML(p)}</div>
          <div class="dt-question">${p.question(_t)}</div>
          ${inputHTML(p)}
          <button class="dt-hint-btn">💡 ${_t('Hint', 'Dica')}</button>
          <div class="dt-hint-text" style="display:none">${p.hint(_t)}</div>
          <div class="dt-feedback" style="display:none"></div>
        </div>
      </div>
    </div>`;

    const hintBtn = _root.querySelector('.dt-hint-btn');
    const hintText = _root.querySelector('.dt-hint-text');
    hintBtn.addEventListener('click', () => {
      hintText.style.display = 'block'; hintBtn.style.display = 'none';
      if (!hintShown) { localHints++; _st.totalHints++; hintShown = true; }
    });

    const onAns = (val) => {
      localAttempts++;
      const fb = _root.querySelector('.dt-feedback');
      if (String(val).trim() === String(p.answer)) {
        const pts = Math.max(10, 100 - localHints * 20 - (localAttempts - 1) * 10);
        _st.score += pts;
        fb.className = 'dt-feedback ok';
        fb.textContent = `✅ ${_t('Case solved!', 'Caso resolvido!')} +${pts} pts`;
        fb.style.display = 'block';
        spawnParts();
        cleanKH();
        const next = document.createElement('button');
        next.className = 'dt-next-btn';
        next.textContent = idx + 1 < total ? `▶ ${_t('Next Case', 'Próximo Caso')}` : `🏆 ${_t('Finish', 'Terminar')}`;
        fb.after(next);
        next.addEventListener('click', () => {
          if (idx + 1 < total) showStep(idx + 1);
          else showComplete();
        });
        _root.querySelectorAll('.dt-kp-btn,.dt-choice-btn').forEach(b => b.disabled = true);
      } else {
        fb.className = 'dt-feedback err';
        fb.textContent = `❌ ${_t('Wrong lead! Try again.', 'Pista errada! Tenta outra vez.')}`;
        fb.style.display = 'block';
        if (p.input === 'keypad') {
          const disp = _root.querySelector('.dt-kp-display');
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
      return `<div class="dt-viz-seq">${v.vals.map(x =>
        `<div class="dt-viz-box${x==='?'?' q':''}">${x}</div>`).join('<span style="color:#f59e0b">→</span>')}</div>`;
    }
    if (v.type === 'formula' || v.type === 'equation') {
      return `<div class="dt-viz-eq">${v.expr}</div>`;
    }
    if (v.type === 'grid') {
      return `<div class="dt-viz-grid">${Array(v.rows * v.cols).fill(v.icon).map(ic =>
        `<span class="dt-viz-icon">${ic}</span>`).join('')}</div>`;
    }
    if (v.type === 'division') {
      return `<div class="dt-div">${Array(v.total).fill(v.icon).map(ic =>
        `<span class="dt-viz-icon">${ic}</span>`).join('')}</div>`;
    }
    if (v.type === 'choice-info') {
      return `<div class="dt-viz-seq">${v.options.map(o => `<div class="dt-viz-box">${o}</div>`).join('')}</div>`;
    }
    if (v.type === 'percent') {
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%">
        <div class="dt-pct-bar"><div class="dt-pct-fill" style="width:${v.pct}%"></div></div>
        <div class="dt-pct-label">${v.pct}% ${_t('of','de')} ${v.total} ${v.icon}</div>
      </div>`;
    }
    if (v.type === 'system') {
      return `<div class="dt-sys"><div class="dt-sys-eq">${v.eq1}</div><div class="dt-sys-eq">${v.eq2}</div></div>`;
    }
    if (v.type === 'var-formula') {
      return `<div class="dt-vf">${v.expr}<br><span style="color:#f59e0b">n = ${v.n}</span></div>`;
    }
    if (v.type === 'modular') {
      return `<div class="dt-mod"><span>${v.dividend}</span><span style="color:#f59e0b">mod</span><span>${v.divisor}</span><span style="color:#f59e0b">=</span><div class="dt-viz-box q">?</div></div>`;
    }
    if (v.type === 'powers') {
      return `<div class="dt-pows">${v.terms.map((t,i) =>
        `<div class="dt-pow-term">${t} = ${v.vals[i]}</div>`).join('<span style="color:#f59e0b">+</span>')}</div>`;
    }
    if (v.type === 'primes') {
      return `<div class="dt-primes">${v.shown.map(x =>
        `<div class="dt-prime-box${x==='?'?' q':''}">${x}</div>`).join('')}</div>`;
    }
    return '';
  }

  function inputHTML(p) {
    if (p.input === 'keypad') {
      return `<div class="dt-kp">
        <div class="dt-kp-display" data-val=""></div>
        ${[7,8,9,4,5,6,1,2,3].map(n=>`<button class="dt-kp-btn" data-n="${n}">${n}</button>`).join('')}
        <button class="dt-kp-btn" data-n="0">0</button>
        <button class="dt-kp-btn" data-n="del">⌫</button>
        <button class="dt-kp-btn" data-n="ok">✓</button>
      </div>`;
    }
    if (p.input === 'choice') {
      return `<div class="dt-choices">${p.viz.options.map(o =>
        `<button class="dt-choice-btn" data-val="${o}">${o}</button>`).join('')}</div>`;
    }
    return '';
  }

  function wireKP(onAns) {
    const disp = _root.querySelector('.dt-kp-display');
    _root.querySelectorAll('.dt-kp-btn').forEach(b => {
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
    _root.querySelectorAll('.dt-choice-btn').forEach(b => {
      b.addEventListener('click', () => {
        _root.querySelectorAll('.dt-choice-btn').forEach(x => x.disabled = true);
        if (b.dataset.val === p.answer) b.classList.add('correct');
        else {
          b.classList.add('wrong');
          _root.querySelectorAll('.dt-choice-btn').forEach(x => { if (x.dataset.val === p.answer) x.classList.add('correct'); });
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
    _root.innerHTML = `<div class="dt-wrap"><div class="dt-complete">
      <h2>🔍 ${_t('Case Closed!', 'Caso Fechado!')}</h2>
      <div class="dt-final-score">${_st.score}</div>
      <p>${_t('points', 'pontos')} · ${elapsed}s · ${_st.totalHints} ${_t('hints', 'dicas')}</p>
      <button class="dt-replay-btn">🔄 ${_t('New Case', 'Novo Caso')}</button>
    </div></div>`;
    spawnParts(); spawnParts(); spawnParts();
    _root.querySelector('.dt-replay-btn').addEventListener('click', () => { _st = defSt(); loadSt(); showMenu(); });
  }

  function spawnParts() {
    const wrap = _root.querySelector('.dt-wrap');
    if (!wrap) return;
    const colors = ['#f59e0b','#d97706','#fbbf24','#fde68a','#b45309'];
    for (let i = 0; i < 14; i++) {
      const d = document.createElement('div');
      d.className = 'dt-part';
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
      if (_root?.querySelector('.dt-menu')) showMenu();
    });
  }

  return { init };
})();
