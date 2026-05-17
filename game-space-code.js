const SpaceCodeGame = (function () {
  'use strict';

  function _t(en, pt) { try { return I18n.getLang() === 'pt' ? pt : en; } catch { return en; } }
  function tierFor(age) { const a = +age; if (a <= 8) return 'easy'; if (a <= 11) return 'med'; return 'hard'; }

  const PUZZLES = {
    easy: [
      { story: _t => _t('Alien ship sends: ★★★ + ★★ = ?','Nave alienígena envia: ★★★ + ★★ = ?'),
        question: _t => _t('How many ★ total?','Quantas ★ no total?'),
        viz: { type:'stars', groups:[3,2] }, answer:'5', input:'keypad',
        hint: _t => _t('Count all stars together.','Conta todas as estrelas juntas.') },
      { story: _t => _t('Space frequency: 2, 4, 6, 8, ?','Frequência espacial: 2, 4, 6, 8, ?'),
        question: _t => _t('Next number in sequence?','Próximo número na sequência?'),
        viz: { type:'seq', vals:[2,4,6,8,'?'] }, answer:'10', input:'keypad',
        hint: _t => _t('Each number increases by 2.','Cada número aumenta 2.') },
      { story: _t => _t('Aliens have 3 ships. Each ship has 4 crew.','Alienígenas têm 3 naves. Cada nave tem 4 tripulantes.'),
        question: _t => _t('Total crew members?','Total de tripulantes?'),
        viz: { type:'grid', rows:3, cols:4, icon:'👾' }, answer:'12', input:'keypad',
        hint: _t => _t('3 groups of 4.','3 grupos de 4.') },
      { story: _t => _t('Signal code: 20 − 7 = ?','Código do sinal: 20 − 7 = ?'),
        question: _t => _t('Decode the signal?','Decifra o sinal?'),
        viz: { type:'formula', expr:'20 − 7 = ?' }, answer:'13', input:'keypad',
        hint: _t => _t('Start at 20, remove 7.','Começa em 20, retira 7.') },
      { story: _t => _t('Planet has 16 moons. Half are hidden. How many visible?','Planeta tem 16 luas. Metade estão escondidas. Quantas são visíveis?'),
        question: _t => _t('Visible moons?','Luas visíveis?'),
        viz: { type:'fraction', total:16, shown:8, icon:'🌙' }, answer:'8', input:'keypad',
        hint: _t => _t('Half of 16.','Metade de 16.') },
    ],
    med: [
      { story: _t => _t('Alien code doubles each step: 3, 6, 12, 24, ?','Código alienígena dobra a cada passo: 3, 6, 12, 24, ?'),
        question: _t => _t('Next transmission value?','Próximo valor da transmissão?'),
        viz: { type:'seq', vals:[3,6,12,24,'?'] }, answer:'48', input:'keypad',
        hint: _t => _t('Multiply each term by 2.','Multiplica cada termo por 2.') },
      { story: _t => _t('Space antenna boost: x + 15 = 34. Find x.','Antena espacial: x + 15 = 34. Encontra x.'),
        question: _t => _t('Value of x?','Valor de x?'),
        viz: { type:'equation', expr:'x + 15 = 34' }, answer:'19', input:'keypad',
        hint: _t => _t('34 minus 15.','34 menos 15.') },
      { story: _t => _t('Warp speed: 7 × 8 − 12 = ?','Velocidade warp: 7 × 8 − 12 = ?'),
        question: _t => _t('Calculate the result?','Calcula o resultado?'),
        viz: { type:'formula', expr:'7 × 8 − 12 = ?' }, answer:'44', input:'keypad',
        hint: _t => _t('Multiply first, then subtract.','Multiplica primeiro, depois subtrai.') },
      { story: _t => _t('Alien fleet: 60% of 80 ships are active.','Frota alienígena: 60% de 80 naves estão ativas.'),
        question: _t => _t('Active ships?','Naves ativas?'),
        viz: { type:'percent', total:80, pct:60, icon:'🚀' }, answer:'48', input:'keypad',
        hint: _t => _t('60% of 80 = 0.6 × 80.','60% de 80 = 0.6 × 80.') },
      { story: _t => _t('Transmission repeats every 11 seconds. Which is NOT a transmission time?','Transmissão repete a cada 11 segundos. Qual NÃO é um tempo de transmissão?'),
        question: _t => _t('Pick the non-multiple of 11:','Escolhe o não-múltiplo de 11:'),
        viz: { type:'choice-info', options:['33','44','55','62'] }, answer:'62', input:'choice',
        hint: _t => _t('Check: 33÷11=3, 44÷11=4, 55÷11=5, 62÷11=?','Verifica: 33÷11=3, 44÷11=4, 55÷11=5, 62÷11=?') },
    ],
    hard: [
      { story: _t => _t('Orbital period formula: T = 2n² + 5. Find T when n = 6.','Fórmula do período orbital: T = 2n² + 5. Calcula T para n = 6.'),
        question: _t => _t('Value of T?','Valor de T?'),
        viz: { type:'var-formula', expr:'T = 2n² + 5', n:6, result:77 }, answer:'77', input:'keypad',
        hint: _t => _t('2×36 + 5 = 72 + 5.','2×36 + 5 = 72 + 5.') },
      { story: _t => _t('Two alien fleets: A + B = 100, A − B = 36. Find A.','Duas frotas: A + B = 100, A − B = 36. Encontra A.'),
        question: _t => _t('Fleet A size?','Tamanho da frota A?'),
        viz: { type:'system', eq1:'A + B = 100', eq2:'A − B = 36' }, answer:'68', input:'keypad',
        hint: _t => _t('Add both equations: 2A = 136.','Soma as equações: 2A = 136.') },
      { story: _t => _t('Alien prime cipher: what is the next prime after 41?','Cifra de números primos: qual é o próximo primo após 41?'),
        question: _t => _t('Next prime?','Próximo primo?'),
        viz: { type:'primes', shown:[31,37,41,'?'] }, answer:'43', input:'keypad',
        hint: _t => _t('Check 42 (even), then 43.','Verifica 42 (par), depois 43.') },
      { story: _t => _t('Hyperdrive uses 3³ + 4² energy units.','Hiperdrive usa 3³ + 4² unidades de energia.'),
        question: _t => _t('Total energy units?','Total de unidades de energia?'),
        viz: { type:'powers', terms:['3³','4²'], vals:[27,16] }, answer:'43', input:'keypad',
        hint: _t => _t('3³=27 and 4²=16.','3³=27 e 4²=16.') },
      { story: _t => _t('Black hole signal: 127 mod 9 = ?','Sinal do buraco negro: 127 mod 9 = ?'),
        question: _t => _t('Remainder after dividing by 9?','Resto após dividir por 9?'),
        viz: { type:'modular', dividend:127, divisor:9 }, answer:'1', input:'keypad',
        hint: _t => _t('127 ÷ 9 = 14 remainder ?','127 ÷ 9 = 14 resto ?') },
    ],
  };

  let _root, _kh, _st;

  function defSt() { return { age: null, step: 0, score: 0, totalHints: 0, startTime: null, bests: {} }; }

  function saveSt() { try { localStorage.setItem('sc-st', JSON.stringify({ bests: _st.bests })); } catch {} }
  function loadSt() { try { const d = JSON.parse(localStorage.getItem('sc-st') || '{}'); if (d.bests) _st.bests = d.bests; } catch {} }

  function injectCSS() {
    if (document.getElementById('sc-css')) return;
    const s = document.createElement('style');
    s.id = 'sc-css';
    s.textContent = `
.sc-wrap { background:#06071a; min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:24px 16px; font-family:'Segoe UI',sans-serif; color:#c7d2fe; }
.sc-title { font-size:2rem; font-weight:900; text-align:center; margin-bottom:6px; color:#818cf8;
  text-shadow:0 0 18px #6366f1,0 0 36px #4f46e5; letter-spacing:2px; }
.sc-subtitle { font-size:.95rem; color:#6366f1; margin-bottom:24px; text-align:center; }
.sc-menu { width:100%; max-width:480px; }
.sc-menu h2 { font-size:1.1rem; color:#818cf8; margin-bottom:12px; text-align:center; }
.sc-age-grid { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:16px; }
.sc-age-btn { width:54px; height:40px; border:1.5px solid #4338ca; background:#0f1033; color:#c7d2fe; border-radius:8px; cursor:pointer; font-size:.95rem; transition:all .15s; }
.sc-age-btn:hover { background:#1e1b4b; border-color:#818cf8; }
.sc-age-btn.active { background:#4f46e5; border-color:#818cf8; color:#fff; box-shadow:0 0 12px #6366f1; }
.sc-tier-hint { text-align:center; font-size:.85rem; color:#6366f1; margin-bottom:14px; min-height:20px; }
.sc-start-btn { display:block; width:100%; padding:14px; background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; border:none; border-radius:12px; font-size:1.1rem; font-weight:700; cursor:pointer; margin-bottom:20px; transition:opacity .2s; }
.sc-start-btn:hover { opacity:.85; }
.sc-bests { background:#0a0b24; border:1px solid #1e1b4b; border-radius:10px; padding:12px 16px; }
.sc-bests h3 { font-size:.85rem; color:#6366f1; margin:0 0 8px; text-transform:uppercase; letter-spacing:1px; }
.sc-best-row { display:flex; justify-content:space-between; font-size:.85rem; color:#a5b4fc; padding:3px 0; border-bottom:1px solid #1e1b4b; }
.sc-best-row:last-child { border-bottom:none; }
.sc-game { width:100%; max-width:540px; }
.sc-progress { display:flex; gap:8px; justify-content:center; margin-bottom:18px; }
.sc-dot { width:12px; height:12px; border-radius:50%; background:#1e1b4b; border:1.5px solid #4338ca; transition:all .3s; }
.sc-dot.dn { background:#4f46e5; border-color:#818cf8; }
.sc-dot.cr { background:#818cf8; border-color:#c7d2fe; box-shadow:0 0 8px #818cf8; animation:sc-pulse .8s infinite alternate; }
@keyframes sc-pulse { from{transform:scale(1)} to{transform:scale(1.3)} }
.sc-card { background:#0a0b24; border:1.5px solid #1e1b4b; border-radius:14px; padding:20px; margin-bottom:14px; }
.sc-story { font-size:1rem; color:#c7d2fe; line-height:1.5; margin-bottom:12px; }
.sc-viz { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center; min-height:60px; margin:12px 0 16px; padding:12px; background:#06071a; border-radius:10px; border:1px solid #1e1b4b; }
.sc-viz-seq { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center; }
.sc-viz-box { padding:8px 14px; background:#1e1b4b; border-radius:8px; font-size:1.15rem; font-weight:700; color:#c7d2fe; border:1.5px solid #4338ca; }
.sc-viz-box.q { background:#4f46e5; color:#fff; animation:sc-pulse .8s infinite alternate; }
.sc-viz-eq { font-size:1.1rem; font-weight:700; color:#818cf8; text-align:center; letter-spacing:1px; }
.sc-viz-grid { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.sc-viz-icon { font-size:1.5rem; }
.sc-viz-stars { display:flex; gap:12px; align-items:center; font-size:1.8rem; }
.sc-viz-star-grp { display:flex; gap:3px; }
.sc-question { font-size:1rem; font-weight:600; color:#818cf8; margin-bottom:14px; }
.sc-kp { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; max-width:240px; margin:0 auto 10px; }
.sc-kp-btn { padding:12px; background:#0f1033; border:1.5px solid #4338ca; color:#c7d2fe; border-radius:8px; font-size:1.1rem; cursor:pointer; transition:all .15s; }
.sc-kp-btn:hover { background:#1e1b4b; border-color:#818cf8; }
.sc-kp-display { grid-column:1/4; padding:10px; background:#06071a; border:1.5px solid #6366f1; border-radius:8px; text-align:center; font-size:1.3rem; font-weight:700; color:#818cf8; min-height:44px; letter-spacing:2px; }
.sc-choices { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
.sc-choice-btn { padding:14px; background:#0f1033; border:1.5px solid #4338ca; color:#c7d2fe; border-radius:10px; font-size:1.05rem; font-weight:600; cursor:pointer; transition:all .15s; }
.sc-choice-btn:hover { background:#1e1b4b; border-color:#818cf8; }
.sc-choice-btn.correct { background:#14532d; border-color:#22c55e; color:#bbf7d0; }
.sc-choice-btn.wrong { background:#450a0a; border-color:#ef4444; color:#fca5a5; }
.sc-hint-btn { display:block; margin:0 auto 8px; padding:6px 18px; background:transparent; border:1.5px solid #4338ca; color:#818cf8; border-radius:20px; font-size:.85rem; cursor:pointer; }
.sc-hint-btn:hover { background:#1e1b4b; }
.sc-hint-text { font-size:.85rem; color:#6366f1; text-align:center; margin-bottom:8px; padding:8px; background:#0a0b24; border-radius:8px; }
.sc-feedback { text-align:center; padding:14px; border-radius:10px; margin-bottom:10px; font-size:1rem; font-weight:600; }
.sc-feedback.ok { background:#1a2e1a; color:#86efac; border:1px solid #22c55e; }
.sc-feedback.err { background:#2e1a1a; color:#fca5a5; border:1px solid #ef4444; }
.sc-next-btn { display:block; width:100%; padding:12px; background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; border:none; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; margin-top:8px; }
.sc-score-bar { display:flex; justify-content:space-between; font-size:.8rem; color:#6366f1; margin-bottom:4px; }
.sc-complete { text-align:center; padding:30px 20px; }
.sc-complete h2 { font-size:1.8rem; color:#818cf8; margin-bottom:8px; text-shadow:0 0 16px #6366f1; }
.sc-complete .sc-final-score { font-size:2.5rem; font-weight:900; color:#c7d2fe; margin:10px 0; }
.sc-complete p { color:#6366f1; margin-bottom:20px; }
.sc-replay-btn { padding:12px 32px; background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; border:none; border-radius:12px; font-size:1.05rem; font-weight:700; cursor:pointer; }
.sc-part { position:absolute; border-radius:50%; pointer-events:none; animation:sc-fly .8s ease-out forwards; }
@keyframes sc-fly { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-60px) scale(0.3)} }
.sc-primes { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.sc-prime-box { padding:8px 14px; background:#1e1b4b; border-radius:8px; font-size:1.1rem; color:#c7d2fe; border:1.5px solid #4338ca; }
.sc-prime-box.q { background:#4f46e5; color:#fff; animation:sc-pulse .8s infinite alternate; }
.sc-sys { display:flex; flex-direction:column; gap:8px; align-items:center; }
.sc-sys-eq { padding:8px 20px; background:#1e1b4b; border-radius:8px; font-size:1rem; color:#c7d2fe; border:1px solid #4338ca; letter-spacing:1px; }
.sc-pows { display:flex; gap:14px; align-items:center; font-size:1.2rem; color:#c7d2fe; }
.sc-pow-term { padding:8px 12px; background:#1e1b4b; border-radius:8px; border:1px solid #4338ca; }
.sc-mod { display:flex; align-items:center; gap:10px; font-size:1.3rem; color:#c7d2fe; }
.sc-pct-bar { width:100%; max-width:260px; height:22px; background:#1e1b4b; border-radius:11px; overflow:hidden; }
.sc-pct-fill { height:100%; background:linear-gradient(90deg,#4f46e5,#818cf8); border-radius:11px; transition:width .5s; }
.sc-pct-label { font-size:.85rem; color:#818cf8; margin-top:4px; text-align:center; }
.sc-vf { font-size:1rem; color:#c7d2fe; text-align:center; }
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
      return scores.map(s => `<div class="sc-best-row"><span>${label}</span><span>${s} pts</span></div>`).join('');
    }).join('');

    _root.innerHTML = `<div class="sc-wrap">
      <div class="sc-title">🛸 ${_t('Space Code Academy', 'Academia do Código Espacial')}</div>
      <div class="sc-subtitle">${_t('Decode alien transmissions with math!', 'Decifra transmissões alienígenas com matemática!')}</div>
      <div class="sc-menu">
        <h2>${_t('Select your age:', 'Seleciona a tua idade:')}</h2>
        <div class="sc-age-grid">
          ${[6,7,8,9,10,11,12,13,14].map(a => `
            <button class="sc-age-btn${_st.age==a?' active':''}" data-age="${a}">${a}${a===14?'+':''}</button>
          `).join('')}
        </div>
        <div class="sc-tier-hint">${tierLabel}</div>
        <button class="sc-start-btn"${!_st.age?' disabled':''}>🚀 ${_t('Start Mission', 'Iniciar Missão')}</button>
        ${bestRows ? `<div class="sc-bests"><h3>🏆 ${_t('Best Scores','Melhores Pontuações')}</h3>${bestRows}</div>` : ''}
      </div>
    </div>`;

    _root.querySelectorAll('.sc-age-btn').forEach(b => b.addEventListener('click', () => {
      _st.age = +b.dataset.age; showMenu();
    }));
    _root.querySelector('.sc-start-btn')?.addEventListener('click', () => {
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
      `<div class="sc-dot ${i < idx ? 'dn' : i === idx ? 'cr' : ''}"></div>`).join('');

    _root.innerHTML = `<div class="sc-wrap">
      <div class="sc-title">🛸 ${_t('Space Code Academy', 'Academia do Código Espacial')}</div>
      <div class="sc-game">
        <div class="sc-score-bar">
          <span>${_t('Mission', 'Missão')} ${idx+1}/${total}</span>
          <span>${_t('Score', 'Pontuação')}: ${_st.score}</span>
        </div>
        <div class="sc-progress">${dots}</div>
        <div class="sc-card">
          <div class="sc-story">${p.story(_t)}</div>
          <div class="sc-viz">${vizHTML(p)}</div>
          <div class="sc-question">${p.question(_t)}</div>
          ${inputHTML(p)}
          <button class="sc-hint-btn">💡 ${_t('Hint', 'Dica')}</button>
          <div class="sc-hint-text" style="display:none">${p.hint(_t)}</div>
          <div class="sc-feedback" style="display:none"></div>
        </div>
      </div>
    </div>`;

    const hintBtn = _root.querySelector('.sc-hint-btn');
    const hintText = _root.querySelector('.sc-hint-text');
    hintBtn.addEventListener('click', () => {
      hintText.style.display = 'block'; hintBtn.style.display = 'none';
      if (!hintShown) { localHints++; _st.totalHints++; hintShown = true; }
    });

    const onAns = (val) => {
      localAttempts++;
      const fb = _root.querySelector('.sc-feedback');
      if (String(val).trim() === String(p.answer)) {
        const pts = Math.max(10, 100 - localHints * 20 - (localAttempts - 1) * 10);
        _st.score += pts;
        fb.className = 'sc-feedback ok';
        fb.textContent = `✅ ${_t('Correct!', 'Correto!')} +${pts} pts`;
        fb.style.display = 'block';
        spawnParts();
        cleanKH();
        const next = document.createElement('button');
        next.className = 'sc-next-btn';
        next.textContent = idx + 1 < total ? `▶ ${_t('Next', 'Seguinte')}` : `🏆 ${_t('Finish', 'Terminar')}`;
        fb.after(next);
        next.addEventListener('click', () => {
          if (idx + 1 < total) showStep(idx + 1);
          else showComplete();
        });
        _root.querySelectorAll('.sc-kp-btn,.sc-choice-btn').forEach(b => b.disabled = true);
      } else {
        fb.className = 'sc-feedback err';
        fb.textContent = `❌ ${_t('Try again!', 'Tenta outra vez!')}`;
        fb.style.display = 'block';
        if (p.input === 'keypad') {
          const disp = _root.querySelector('.sc-kp-display');
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
      return `<div class="sc-viz-seq">${v.vals.map(x =>
        `<div class="sc-viz-box${x==='?'?' q':''}">${x}</div>`).join('<span style="color:#6366f1">→</span>')}</div>`;
    }
    if (v.type === 'formula' || v.type === 'equation') {
      return `<div class="sc-viz-eq">${v.expr}</div>`;
    }
    if (v.type === 'grid') {
      const icons = Array(v.rows * v.cols).fill(v.icon);
      return `<div class="sc-viz-grid">${icons.map(ic => `<span class="sc-viz-icon">${ic}</span>`).join('')}</div>`;
    }
    if (v.type === 'stars') {
      const groups = v.groups.map(n => `<div class="sc-viz-star-grp">${'★'.repeat(n)}</div>`).join('<span style="font-size:1.4rem;color:#6366f1">+</span>');
      return `<div class="sc-viz-stars">${groups}</div>`;
    }
    if (v.type === 'fraction') {
      const total = v.total, shown = v.shown;
      return `<div class="sc-viz-grid">${Array(total).fill(0).map((_,i) =>
        `<span class="sc-viz-icon" style="${i<shown?'':'opacity:.2'}">${v.icon}</span>`).join('')}</div>`;
    }
    if (v.type === 'choice-info') {
      return `<div class="sc-viz-seq">${v.options.map(o => `<div class="sc-viz-box">${o}</div>`).join('')}</div>`;
    }
    if (v.type === 'var-formula') {
      return `<div class="sc-vf">${v.expr}<br><span style="color:#6366f1">n = ${v.n}</span></div>`;
    }
    if (v.type === 'system') {
      return `<div class="sc-sys"><div class="sc-sys-eq">${v.eq1}</div><div class="sc-sys-eq">${v.eq2}</div></div>`;
    }
    if (v.type === 'primes') {
      return `<div class="sc-primes">${v.shown.map(x =>
        `<div class="sc-prime-box${x==='?'?' q':''}">${x}</div>`).join('')}</div>`;
    }
    if (v.type === 'powers') {
      return `<div class="sc-pows">${v.terms.map((t,i) =>
        `<div class="sc-pow-term">${t} = ${v.vals[i]}</div>`).join('<span style="color:#6366f1">+</span>')}</div>`;
    }
    if (v.type === 'modular') {
      return `<div class="sc-mod"><span>${v.dividend}</span><span style="color:#6366f1">mod</span><span>${v.divisor}</span><span style="color:#6366f1">=</span><span class="sc-viz-box q">?</span></div>`;
    }
    if (v.type === 'percent') {
      const fill = v.pct;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%">
        <div class="sc-pct-bar"><div class="sc-pct-fill" style="width:${fill}%"></div></div>
        <div class="sc-pct-label">${v.pct}% ${_t('of','de')} ${v.total} ${v.icon}</div>
      </div>`;
    }
    return '';
  }

  function inputHTML(p) {
    if (p.input === 'keypad') {
      return `<div class="sc-kp">
        <div class="sc-kp-display" data-val=""></div>
        ${[7,8,9,4,5,6,1,2,3].map(n=>`<button class="sc-kp-btn" data-n="${n}">${n}</button>`).join('')}
        <button class="sc-kp-btn" data-n="0">0</button>
        <button class="sc-kp-btn" data-n="del">⌫</button>
        <button class="sc-kp-btn" data-n="ok">✓</button>
      </div>`;
    }
    if (p.input === 'choice') {
      return `<div class="sc-choices">${p.viz.options.map(o =>
        `<button class="sc-choice-btn" data-val="${o}">${o}</button>`).join('')}</div>`;
    }
    return '';
  }

  function wireKP(onAns) {
    const disp = _root.querySelector('.sc-kp-display');
    _root.querySelectorAll('.sc-kp-btn').forEach(b => {
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
    _root.querySelectorAll('.sc-choice-btn').forEach(b => {
      b.addEventListener('click', () => {
        _root.querySelectorAll('.sc-choice-btn').forEach(x => x.disabled = true);
        if (b.dataset.val === p.answer) b.classList.add('correct');
        else {
          b.classList.add('wrong');
          _root.querySelectorAll('.sc-choice-btn').forEach(x => { if (x.dataset.val === p.answer) x.classList.add('correct'); });
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
    _root.innerHTML = `<div class="sc-wrap"><div class="sc-complete">
      <h2>🛸 ${_t('Mission Complete!', 'Missão Completa!')}</h2>
      <div class="sc-final-score">${_st.score}</div>
      <p>${_t('points', 'pontos')} · ${elapsed}s · ${_st.totalHints} ${_t('hints', 'dicas')}</p>
      <button class="sc-replay-btn">🔄 ${_t('New Mission', 'Nova Missão')}</button>
    </div></div>`;
    spawnParts(); spawnParts(); spawnParts();
    _root.querySelector('.sc-replay-btn').addEventListener('click', () => { _st = defSt(); loadSt(); showMenu(); });
  }

  function spawnParts() {
    const wrap = _root.querySelector('.sc-wrap');
    if (!wrap) return;
    const colors = ['#818cf8','#6366f1','#4f46e5','#c7d2fe','#a5b4fc'];
    for (let i = 0; i < 14; i++) {
      const d = document.createElement('div');
      d.className = 'sc-part';
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
      if (_root?.querySelector('.sc-menu')) showMenu();
    });
  }

  return { init };
})();
