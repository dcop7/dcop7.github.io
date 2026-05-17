const EscapeLabGame = (function () {
  'use strict';

  function _t(en, pt) {
    try { return (I18n.getLang() === 'pt') ? pt : en; } catch { return en; }
  }

  function tierFor(age) {
    const a = +age;
    if (a <= 8) return '7';
    if (a <= 11) return '10';
    return '13';
  }

  // ══ CSS ══════════════════════════════════════════════════════════════
  function injectCSS() {
    if (document.getElementById('el-css')) return;
    const s = document.createElement('style');
    s.id = 'el-css';
    s.textContent = `
.el-wrap{position:relative;background:linear-gradient(160deg,#030c18 0%,#041020 60%,#060d18 100%);border-radius:14px;overflow:hidden;font-family:var(--font-mono,'JetBrains Mono',monospace);color:#e2e8f0;min-height:580px;display:flex;flex-direction:column}
.el-wrap *{box-sizing:border-box}
.el-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,136,.01) 3px,rgba(0,255,136,.01) 4px);pointer-events:none;z-index:0}
.el-cx{position:absolute;width:16px;height:16px;border-color:rgba(0,255,136,.28);border-style:solid;z-index:1}
.el-cx.tl{top:9px;left:9px;border-width:2px 0 0 2px}
.el-cx.tr{top:9px;right:9px;border-width:2px 2px 0 0}
.el-cx.bl{bottom:9px;left:9px;border-width:0 0 2px 2px}
.el-cx.br{bottom:9px;right:9px;border-width:0 2px 2px 0}
.el-inner{position:relative;z-index:2;flex:1;display:flex;flex-direction:column}
.el-menu{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.1rem;padding:2rem}
.el-logo-em{font-size:3rem;text-align:center;filter:drop-shadow(0 0 16px rgba(0,255,136,.55));animation:el-float 3s ease-in-out infinite}
@keyframes el-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.el-logo-t{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.9rem;font-weight:800;text-align:center;background:linear-gradient(120deg,#00ff88,#00aaff,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-.02em;line-height:1.1}
.el-logo-s{font-size:.68rem;color:#475569;letter-spacing:.18em;text-transform:uppercase;text-align:center}
.el-age-lbl{font-size:.68rem;color:#475569;letter-spacing:.12em;text-transform:uppercase;text-align:center}
.el-age-grid{display:flex;flex-wrap:wrap;gap:.42rem;justify-content:center;max-width:310px}
.el-ab{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:.55rem .85rem;cursor:pointer;transition:all .18s;font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.85rem;font-weight:700;color:#94a3b8;min-width:52px;text-align:center}
.el-ab:hover{border-color:rgba(0,255,136,.4);background:rgba(0,255,136,.07);color:#00ff88;transform:translateY(-1px)}
.el-ab.sel{border-color:#00ff88;background:rgba(0,255,136,.12);color:#00ff88}
.el-age-hint{font-size:.62rem;color:#334155;text-align:center;max-width:280px}
.el-start-btn{background:linear-gradient(135deg,#00cc6e,#0077cc);color:#020c14;border:none;border-radius:9px;padding:.7rem 2rem;font-size:.95rem;font-weight:700;cursor:pointer;transition:transform .13s;font-family:var(--font-head,'Space Grotesk',sans-serif)}
.el-start-btn:hover{transform:scale(1.04)}
.el-bests{font-size:.64rem;color:#1e293b;text-align:center}
.el-game-layout{flex:1;display:flex;flex-direction:column;gap:.85rem;padding:1.1rem}
.el-ghdr{display:flex;align-items:center;gap:.65rem;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.05);border-radius:9px;padding:.55rem .9rem;flex-wrap:wrap;flex-shrink:0}
.el-prog{display:flex;align-items:center;gap:.42rem;flex:1}
.el-d{width:8px;height:8px;border-radius:50%;background:#090f1c;border:1.5px solid #1a2540;transition:all .4s}
.el-d.dn{background:#00ff88;border-color:#00ff88;box-shadow:0 0 6px rgba(0,255,136,.5)}
.el-d.cr{border-color:#00ff88;background:rgba(0,255,136,.14);animation:el-dp .85s ease-in-out infinite alternate}
@keyframes el-dp{from{box-shadow:0 0 3px rgba(0,255,136,.3)}to{box-shadow:0 0 9px rgba(0,255,136,.7)}}
.el-sc-val{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.82rem;font-weight:700;color:#00ff88;min-width:68px;text-align:center}
.el-hbtn{background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.22);color:#ca8a04;border-radius:6px;padding:.28rem .6rem;font-size:.66rem;cursor:pointer;transition:all .18s;white-space:nowrap;font-family:var(--font-mono,'JetBrains Mono',monospace)}
.el-hbtn:hover:not(:disabled){background:rgba(251,191,36,.15);color:#fbbf24;border-color:rgba(251,191,36,.45)}
.el-hbtn:disabled{opacity:.3;cursor:default}
.el-room{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:11px;flex:1;display:flex;flex-direction:column;gap:.85rem;padding:1.1rem}
.el-bdg{display:inline-flex;align-items:center;font-size:.6rem;color:#00cc70;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(0,255,136,.2);border-radius:20px;padding:.22rem .62rem;background:rgba(0,255,136,.04);align-self:flex-start}
.el-story{font-size:.78rem;color:#94a3b8;line-height:1.65;padding-left:.65rem;border-left:2px solid rgba(0,255,136,.2)}
.el-puz{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.04);border-radius:9px;padding:.95rem;display:flex;flex-direction:column;align-items:center;gap:.65rem;justify-content:center;flex-shrink:0}
.el-qq{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.95rem;font-weight:600;text-align:center;color:#e2e8f0}
.el-ia{display:flex;flex-direction:column;align-items:center;gap:.6rem;flex-shrink:0}
.el-kd{background:rgba(0,0,0,.45);border:1px solid rgba(0,255,136,.28);border-radius:7px;padding:.4rem .9rem;font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:1.55rem;color:#00ff88;text-align:center;min-width:140px;text-shadow:0 0 7px rgba(0,255,136,.35);user-select:none;letter-spacing:.07em}
.el-kp{display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;width:100%;max-width:200px}
.el-kk{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;border-radius:7px;padding:.55rem;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .12s;font-family:var(--font-mono,'JetBrains Mono',monospace);aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.el-kk:hover{background:rgba(0,255,136,.11);border-color:rgba(0,255,136,.36);color:#00ff88;box-shadow:0 0 6px rgba(0,255,136,.1)}
.el-kk:active{transform:scale(.91)}
.el-kk.kd{color:#f87171;border-color:rgba(239,68,68,.18);background:rgba(239,68,68,.04)}
.el-kk.kd:hover{background:rgba(239,68,68,.12)!important;border-color:rgba(239,68,68,.44)!important;color:#ef4444!important}
.el-kk.ke{color:#00ff88;border-color:rgba(0,255,136,.28);background:rgba(0,255,136,.07);grid-column:span 3;aspect-ratio:unset;padding:.45rem;font-size:.75rem;letter-spacing:.08em}
.el-kk.ke:hover{background:rgba(0,255,136,.2)!important;box-shadow:0 0 12px rgba(0,255,136,.2)!important}
.el-chs{display:grid;grid-template-columns:repeat(2,1fr);gap:.45rem;width:100%;max-width:280px}
.el-ch{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:.68rem;font-size:1rem;cursor:pointer;transition:all .16s;font-family:var(--font-mono,'JetBrains Mono',monospace);color:#e2e8f0;font-weight:600;text-align:center}
.el-ch:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.4);color:#a5b4fc}
.el-ch.cok{background:rgba(0,255,136,.12)!important;border-color:#00ff88!important;color:#00ff88!important;animation:el-glow .38s ease}
.el-ch.cbad{background:rgba(239,68,68,.1)!important;border-color:rgba(239,68,68,.44)!important;color:#f87171!important;animation:el-shk .32s ease}
@keyframes el-glow{0%,100%{box-shadow:none}50%{box-shadow:0 0 18px rgba(0,255,136,.44)}}
@keyframes el-shk{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.el-fb{min-height:1.7rem;text-align:center;font-size:.76rem;border-radius:6px;padding:.3rem .6rem;transition:all .22s}
.el-fb.ok{color:#00ff88;background:rgba(0,255,136,.07);border:1px solid rgba(0,255,136,.22)}
.el-fb.err{color:#f87171;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22)}
.el-hint{background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.22);border-radius:8px;padding:.8rem;color:#ca8a04;font-size:.75rem;line-height:1.6;display:none}
.el-hint.on{display:block}
.el-ht{font-weight:700;color:#fbbf24;margin-bottom:.25rem;font-size:.72rem}
.el-cviz{display:flex;flex-wrap:wrap;gap:.35rem;justify-content:center;max-width:270px}
.el-ci{font-size:1.25rem;animation:el-pop .18s ease backwards}
@keyframes el-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
.el-seqv{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;justify-content:center}
.el-sn{background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.36);border-radius:6px;padding:.35rem .7rem;font-size:1.05rem;font-weight:700;color:#a5b4fc;font-family:var(--font-mono,'JetBrains Mono',monospace);animation:el-pop .22s ease backwards}
.el-sq{background:rgba(0,255,136,.07);border:2px dashed rgba(0,255,136,.45);border-radius:6px;padding:.35rem .7rem;font-size:1.05rem;color:#00ff88;font-family:var(--font-mono,'JetBrains Mono',monospace);animation:el-sqp .9s ease-in-out infinite alternate}
@keyframes el-sqp{from{border-color:rgba(0,255,136,.25)}to{border-color:rgba(0,255,136,.75)}}
.el-sa{color:#334155;font-size:.72rem}
.el-mviz{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;justify-content:center}
.el-mg{display:flex;flex-wrap:wrap;gap:.2rem;background:rgba(0,0,0,.18);border-radius:6px;padding:.3rem;border:1px solid rgba(255,255,255,.04);max-width:110px;justify-content:center}
.el-mop{color:#fbbf24;font-size:1.3rem;font-weight:800}
.el-meq{color:#475569;font-size:1.1rem}
.el-gvis{display:flex;flex-direction:column;gap:.25rem;align-items:center}
.el-gr{display:flex;gap:.25rem}
.el-gc{width:26px;height:26px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;font-size:.95rem}
.el-ov{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(3,10,20,.9);border-radius:14px;gap:.8rem;animation:el-fi .28s ease;padding:1.5rem;text-align:center}
@keyframes el-fi{from{opacity:0}to{opacity:1}}
.el-ov-em{font-size:3.3rem;animation:el-bounce .52s ease;filter:drop-shadow(0 0 22px rgba(0,255,136,.65))}
@keyframes el-bounce{0%{transform:scale(0)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
.el-ov-t{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.6rem;font-weight:800;color:#00ff88;text-shadow:0 0 18px rgba(0,255,136,.4)}
.el-ov-s{color:#94a3b8;font-size:.79rem;max-width:240px;line-height:1.5}
.el-ov-p{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.05rem;font-weight:700;color:#fbbf24}
.el-cntbtn{background:linear-gradient(135deg,#00cc6e,#0077cc);color:#020c14;border:none;border-radius:9px;padding:.65rem 1.7rem;font-size:.9rem;font-weight:700;cursor:pointer;transition:transform .13s;font-family:var(--font-head,'Space Grotesk',sans-serif)}
.el-cntbtn:hover{transform:scale(1.04)}
.el-fin{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.3rem;padding:2rem;text-align:center}
.el-trph{font-size:4.2rem;filter:drop-shadow(0 0 16px rgba(251,191,36,.65));animation:el-spin .75s ease}
@keyframes el-spin{0%{transform:scale(0) rotate(-25deg)}70%{transform:scale(1.08) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
.el-ft{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.el-fs{color:#94a3b8;font-size:.79rem;line-height:1.55;max-width:280px}
.el-stts{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;width:100%;max-width:280px}
.el-st{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:.65rem;text-align:center}
.el-stv{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.3rem;font-weight:800;color:#00ff88;display:block}
.el-stl{font-size:.6rem;color:#64748b;text-transform:uppercase;letter-spacing:.1em}
.el-rabtn{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);color:#818cf8;border-radius:9px;padding:.65rem 1.7rem;font-size:.88rem;font-weight:700;cursor:pointer;transition:all .2s;font-family:var(--font-head,'Space Grotesk',sans-serif)}
.el-rabtn:hover{background:rgba(99,102,241,.22);transform:translateY(-2px)}
.el-pt{position:absolute;border-radius:50%;pointer-events:none;z-index:15}
@keyframes el-rshk{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.el-shk{animation:el-rshk .32s ease}
@media(max-width:480px){
  .el-menu,.el-fin{padding:1rem}
  .el-logo-t{font-size:1.45rem}
  .el-game-layout{padding:.85rem;gap:.65rem}
  .el-room{padding:.85rem;gap:.65rem}
  .el-puz{padding:.75rem}
  .el-kp{max-width:185px}
  .el-chs{max-width:250px}
  .el-qq{font-size:.85rem}
  .el-story{font-size:.72rem}
}`;
    document.head.appendChild(s);
  }

  // ══ PUZZLE DATA ═══════════════════════════════════════════════════════
  const ROOMS = {
    '7': [
      {
        badge:'LAB-01 · Reactor Core', icon:'⚡',
        story:_t('The reactor has gone offline! Count the active power cells to restore emergency power.',
                 'O reator desligou! Conta as células de energia ativas para restaurar a corrente.'),
        type:'keypad', viz:'count', countEmoji:'⚡', countN:13,
        question:_t('How many ⚡ power cells are active?','Quantas células ⚡ estão ativas?'), answer:13,
        hints:[_t('Count one at a time from left to right','Conta uma a uma da esquerda para a direita'),
               _t('Try counting row by row','Conta fila a fila'),
               _t('There are more than 10 but fewer than 15','Há mais de 10 mas menos de 15')]
      },
      {
        badge:'LAB-02 · Entry Hall', icon:'🚪',
        story:_t('The security door is locked! The code equals the total number of robots on both panels.',
                 'A porta de segurança está bloqueada! O código é o total de robôs nos dois painéis.'),
        type:'keypad', viz:'math-vis',
        mleft:['🤖','🤖','🤖','🤖','🤖','🤖','🤖','🤖'],
        mright:['🤖','🤖','🤖','🤖','🤖','🤖','🤖'],
        mop:'+',
        question:'8 + 7 = ?', answer:15,
        hints:[_t('Count the robots on the left — that is 8','Conta os robôs à esquerda — são 8'),
               _t('Count the robots on the right — that is 7','Conta os robôs à direita — são 7'),
               _t('Think: 8 + 7 = 8 + 2 + 5','Pensa: 8 + 7 = 10 + 5')]
      },
      {
        badge:'LAB-03 · AI Core', icon:'🔵',
        story:_t('The AI detected a pattern in the power sequence. Find the next number!',
                 'A IA detetou um padrão na sequência. Descobre o próximo número!'),
        type:'choice', viz:'seq-display',
        seq:[2,4,6,8], choices:[9,10,11,12], answer:10,
        question:_t('What number comes next?','Que número vem a seguir?'),
        hints:[_t('Look at the gap between each number','Olha para a diferença entre cada número'),
               _t('The numbers count by 2s','Os números avançam de 2 em 2'),
               _t('2, 4, 6, 8... add 2 to the last','2, 4, 6, 8... adiciona 2 ao último')]
      },
      {
        badge:'LAB-04 · Power Grid', icon:'🔋',
        story:_t('The power grid has 3 rows of energy modules with 4 units each. Calculate the total!',
                 'A grelha de energia tem 3 filas com 4 módulos cada. Calcula o total!'),
        type:'keypad', viz:'emoji-grid',
        gRows:3, gCols:4, gEmoji:'🔋',
        question:'3 × 4 = ?', answer:12,
        hints:[_t('Count all the batteries in the grid','Conta todas as baterias na grelha'),
               _t('3 groups of 4 is the same as 4 + 4 + 4','3 grupos de 4 é igual a 4 + 4 + 4'),
               _t('4 + 4 + 4 = 12','4 + 4 + 4 = 12')]
      },
      {
        badge:'LAB-05 · Command Hub', icon:'🏆',
        story:_t('The master vault code is locked behind a formula. Solve it step by step!',
                 'O código do cofre mestre está bloqueado por uma fórmula. Resolve passo a passo!'),
        type:'keypad', viz:'formula',
        formula:'(20 − 8) + 5',
        question:'(20 − 8) + 5 = ?', answer:17,
        hints:[_t('Solve the brackets first: 20 − 8','Resolve os parênteses primeiro: 20 − 8'),
               _t('20 − 8 = 12','20 − 8 = 12'),
               _t('Now add 5: 12 + 5 = ?','Agora adiciona 5: 12 + 5 = ?')]
      }
    ],
    '10': [
      {
        badge:'LAB-01 · Crypto Core', icon:'🌀',
        story:_t('The encryption key follows the Fibonacci sequence. Each number is the sum of the two before it!',
                 'A chave de encriptação segue a sequência de Fibonacci. Cada número é a soma dos dois anteriores!'),
        type:'keypad', viz:'seq-display',
        seq:[1,1,2,3,5,8,13],
        question:_t('What is the next Fibonacci number?','Qual é o próximo número de Fibonacci?'), answer:21,
        hints:[_t('Each number = sum of the two before it','Cada número = soma dos dois anteriores'),
               _t('The last two are 8 and 13','Os últimos dois são 8 e 13'),
               _t('8 + 13 = ?','8 + 13 = ?')]
      },
      {
        badge:'LAB-02 · Data Vault', icon:'📊',
        story:_t('The vault opens to exactly 2/3 of the master code value. The full code is 18.',
                 'O cofre abre para exatamente 2/3 do valor do código mestre. O código completo é 18.'),
        type:'keypad', viz:'fraction',
        num:2, den:3, total:18,
        question:'2/3 × 18 = ?', answer:12,
        hints:[_t('Find one-third of 18 by dividing by 3','Divide 18 por 3 para encontrar um terço'),
               _t('18 ÷ 3 = 6','18 ÷ 3 = 6'),
               _t('Multiply by 2: 6 × 2 = ?','Multiplica por 2: 6 × 2 = ?')]
      },
      {
        badge:'LAB-03 · Quantum Hall', icon:'🔑',
        story:_t('The quantum gate only activates on prime numbers! What is the next prime after 11?',
                 'O portal quântico só ativa com números primos! Qual é o próximo primo após 11?'),
        type:'keypad', viz:'seq-display',
        seq:[2,3,5,7,11],
        question:_t('What is the next prime number after 11?','Qual é o próximo número primo após 11?'), answer:13,
        hints:[_t('A prime is only divisible by 1 and itself','Um primo só é divisível por 1 e por si mesmo'),
               _t('Is 12 prime? No — 12 = 2 × 6','12 é primo? Não — 12 = 2 × 6'),
               _t('Test 13: no integer from 2–12 divides it','Testa 13: nenhum inteiro de 2 a 12 o divide')]
      },
      {
        badge:'LAB-04 · Chrono Bay', icon:'⏰',
        story:_t('The time portal activates at 14:05. It is currently 09:15. How many minutes until it opens?',
                 'O portal temporal ativa às 14:05. Agora são 09:15. Quantos minutos faltam?'),
        type:'keypad', viz:'time-vis',
        t1:'09:15', t2:'14:05',
        question:_t('Minutes from 09:15 to 14:05?','Minutos de 09:15 até 14:05?'), answer:290,
        hints:[_t('Count hours first: 09:15 to 14:15 = 5 hours','Conta as horas: das 09:15 às 14:15 = 5 horas'),
               _t('5 hours = 5 × 60 = 300 minutes','5 horas = 5 × 60 = 300 minutos'),
               _t('14:05 is 10 min before 14:15, so 300 − 10','14:05 é 10 min antes das 14:15, logo 300 − 10')]
      },
      {
        badge:'LAB-05 · Neural Net', icon:'🧮',
        story:_t('The neural network formula uses variables. Given A = 4 and B = 7, calculate the result.',
                 'A fórmula da rede neural usa variáveis. Com A = 4 e B = 7, calcula o resultado.'),
        type:'keypad', viz:'var-formula',
        vars:{A:4,B:7}, formula:'A² + B',
        question:'A = 4, B = 7  →  A² + B = ?', answer:23,
        hints:[_t('A² means A multiplied by itself','A² significa A multiplicado por si mesmo'),
               _t('4 × 4 = 16','4 × 4 = 16'),
               _t('Now add B: 16 + 7 = ?','Agora adiciona B: 16 + 7 = ?')]
      }
    ],
    '13': [
      {
        badge:'LAB-01 · Math Core', icon:'⚗️',
        story:_t('Solve the algebraic expression to unlock the fusion containment field.',
                 'Resolve a expressão algébrica para desbloquear o campo de contenção de fusão.'),
        type:'keypad', viz:'equation',
        eq:'3x + 12 = 27',
        question:'3x + 12 = 27  →  x = ?', answer:5,
        hints:[_t('Subtract 12 from both sides','Subtrai 12 de ambos os membros'),
               _t('3x = 15','3x = 15'),
               _t('Divide by 3: x = 5','Divide por 3: x = 5')]
      },
      {
        badge:'LAB-02 · Power Core', icon:'💥',
        story:_t('The energy chamber uses exponential power sources. Compute the total output.',
                 'A câmara de energia usa fontes exponenciais. Calcula a potência total.'),
        type:'keypad', viz:'powers',
        expr:'2⁵ + 2³',
        question:'2⁵ + 2³ = ?', answer:40,
        hints:[_t('2⁵ = 2×2×2×2×2','2⁵ = 2×2×2×2×2'),
               _t('2⁵ = 32 and 2³ = 8','2⁵ = 32 e 2³ = 8'),
               _t('32 + 8 = ?','32 + 8 = ?')]
      },
      {
        badge:'LAB-03 · Crypto Vault', icon:'🔐',
        story:_t('The vault uses modular arithmetic — the cornerstone of modern cryptography.',
                 'O cofre usa aritmética modular — a base da criptografia moderna.'),
        type:'keypad', viz:'modular',
        a:47, b:6,
        question:'47 mod 6 = ?', answer:5,
        hints:[_t('Modulo = remainder after integer division','Módulo = resto da divisão inteira'),
               _t('6 × 7 = 42','6 × 7 = 42'),
               _t('47 − 42 = ?','47 − 42 = ?')]
      },
      {
        badge:'LAB-04 · Logic Hub', icon:'🔄',
        story:_t('Solve this system of linear equations and find the value of x.',
                 'Resolve este sistema de equações lineares e encontra o valor de x.'),
        type:'keypad', viz:'system',
        e1:'x + y = 14', e2:'x − y = 6',
        question:'x + y = 14  and  x − y = 6  →  x = ?', answer:10,
        hints:[_t('Add both equations to eliminate y','Soma as duas equações para eliminar y'),
               _t('Adding them: 2x = 20','Somando: 2x = 20'),
               _t('Divide by 2: x = 10','Divide por 2: x = 10')]
      },
      {
        badge:'LAB-05 · Void Gate', icon:'🌌',
        story:_t('Solve for n, then compute n factorial.',
                 'Resolve para n, depois calcula o fatorial de n.'),
        type:'keypad', viz:'factorial',
        s1:'2n + 2 = 8', s2:_t('Calculate n!','Calcula n!'),
        question:_t('If 2n + 2 = 8, what is n! ?','Se 2n + 2 = 8, qual é n! ?'), answer:6,
        hints:[_t('2n + 2 = 8 → 2n = 6 → n = 3','2n + 2 = 8 → 2n = 6 → n = 3'),
               _t('n! means n × (n−1) × … × 1','n! significa n × (n−1) × … × 1'),
               _t('3! = 3 × 2 × 1 = ?','3! = 3 × 2 × 1 = ?')]
      }
    ]
  };

  // ══ STATE ══════════════════════════════════════════════════════════════
  let _root, _kh;

  function defSt() {
    const dfAge = parseInt(localStorage.getItem('game-age-default') || '0') || null;
    return { age: dfAge, room: 0, score: 0, totalHints: 0, startTime: null, bests: {} };
  }

  let _st = defSt();

  function loadSt() {
    try { const s = JSON.parse(localStorage.getItem('el-st')); if (s) _st = { ...defSt(), ...s }; } catch {}
  }

  function saveSt() {
    try { localStorage.setItem('el-st', JSON.stringify(_st)); } catch {}
  }

  // ══ ENTRY POINT ══════════════════════════════════════════════════════
  function init(root) {
    _root = root;
    if (!root) return;
    injectCSS();
    loadSt();
    showMenu();
    document.addEventListener('langchange', () => {
      if (_root?.querySelector('.el-menu')) showMenu();
    });
  }

  // ══ AGE BUTTON LABELS ═════════════════════════════════════════════
  function ageTierLabel(age) {
    const a = +age;
    if (a <= 8)  return _t('Explorer','Explorador');
    if (a <= 11) return _t('Scientist','Cientista');
    return _t('Genius','Génio');
  }

  // ══ MENU ══════════════════════════════════════════════════════════════
  function showMenu() {
    const tierLabels = {
      '7':  _t('Explorer','Explorador'),
      '10': _t('Scientist','Cientista'),
      '13': _t('Genius','Génio')
    };
    const bestStr = Object.keys(_st.bests).length
      ? '💾 Best: ' + Object.entries(_st.bests).map(([t, v]) => tierLabels[t] + ': ' + v + 'pts').join(' | ')
      : '';

    const ages = [6,7,8,9,10,11,12,13,14];
    const ageHints = {
      '7':  _t('Counting · Patterns · Arithmetic','Contagem · Padrões · Aritmética'),
      '10': _t('Sequences · Fractions · Algebra intro','Sequências · Frações · Álgebra'),
      '13': _t('Algebra · Modular arithmetic · Systems','Álgebra · Aritmética modular · Sistemas')
    };
    const selectedAge = _st.age || 9;
    const currentTier = tierFor(selectedAge);

    _root.innerHTML = `
<div class="game-card el-wrap" style="padding:0" id="el-root">
  <div class="el-scan"></div>
  <div class="el-cx tl"></div><div class="el-cx tr"></div>
  <div class="el-cx bl"></div><div class="el-cx br"></div>
  <div class="el-inner">
    <div class="el-menu">
      <div class="el-logo-em">🧪</div>
      <div class="el-logo-t">Math Escape Lab</div>
      <div class="el-logo-s">${_t('Interactive Puzzle Adventure','Aventura de Puzzles')}</div>
      <div class="el-age-lbl">${_t('Choose your age','Escolhe a tua idade')}</div>
      <div class="el-age-grid">
        ${ages.map(a => `<button class="el-ab${a === selectedAge ? ' sel' : ''}" data-age="${a}">${a === 14 ? '14+' : a}</button>`).join('')}
      </div>
      <div class="el-age-hint" id="el-age-hint">${ageHints[currentTier]}</div>
      <button class="el-start-btn" id="el-start">▶ ${_t('Start','Começar')}</button>
      ${bestStr ? `<div class="el-bests">${bestStr}</div>` : ''}
    </div>
  </div>
</div>`;

    let selAge = selectedAge;
    _root.querySelectorAll('.el-ab').forEach(b => {
      b.addEventListener('click', () => {
        _root.querySelectorAll('.el-ab').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        selAge = +b.dataset.age;
        const hint = _root.querySelector('#el-age-hint');
        if (hint) hint.textContent = ageHints[tierFor(selAge)];
      });
    });
    _root.querySelector('#el-start').addEventListener('click', () => startGame(selAge));
  }

  // ══ START GAME ══════════════════════════════════════════════════════
  function startGame(age) {
    _st = { ...defSt(), bests: _st.bests };
    _st.age = +age;
    _st.startTime = Date.now();
    saveSt();
    showRoom(0);
  }

  // ══ SHOW ROOM ════════════════════════════════════════════════════════
  function showRoom(idx) {
    cleanKH();
    _st.room = idx;
    saveSt();

    const tier = tierFor(_st.age);
    const rooms = ROOMS[tier];
    const room = rooms[idx];
    let hintsLeft = 3, hintIdx = 0, localHints = 0, localAttempts = 0;

    _root.innerHTML = `
<div class="game-card el-wrap" style="padding:0" id="el-root">
  <div class="el-scan"></div>
  <div class="el-cx tl"></div><div class="el-cx tr"></div>
  <div class="el-cx bl"></div><div class="el-cx br"></div>
  <div class="el-inner">
    <div class="el-game-layout">
      <div class="el-ghdr">
        <div class="el-prog" id="el-prog"></div>
        <div class="el-sc-val">⚡ ${_st.score}</div>
        <button class="el-hbtn" id="el-hbtn">💡 ${_t('Hint','Dica')} (${hintsLeft})</button>
      </div>
      <div class="el-room" id="el-room">
        <div class="el-bdg">${room.badge}</div>
        <div class="el-story">${room.story}</div>
        <div class="el-puz">${vizHTML(room)}</div>
        <div class="el-qq">${room.question}</div>
        <div class="el-ia">${inputHTML(room)}</div>
        <div class="el-fb" id="el-fb"></div>
        <div class="el-hint" id="el-hint"><div class="el-ht">💡 ${_t('Hint','Dica')}</div><div id="el-hint-txt"></div></div>
      </div>
    </div>
  </div>
</div>`;

    const prog = _root.querySelector('#el-prog');
    prog.innerHTML = rooms.map((_, i) => `<div class="el-d ${i < idx ? 'dn' : i === idx ? 'cr' : ''}"></div>`).join('');

    const hbtn = _root.querySelector('#el-hbtn');
    const hintEl = _root.querySelector('#el-hint');
    const hintTxt = _root.querySelector('#el-hint-txt');
    hbtn.addEventListener('click', () => {
      if (hintsLeft <= 0) return;
      hintsLeft--; localHints++;
      _st.totalHints = (_st.totalHints || 0) + 1;
      hintTxt.textContent = room.hints[Math.min(hintIdx, room.hints.length - 1)];
      hintIdx++;
      hintEl.classList.add('on');
      hbtn.textContent = `💡 ${_t('Hint','Dica')} (${hintsLeft})`;
      if (hintsLeft === 0) hbtn.disabled = true;
    });

    function tryAns(val) {
      localAttempts++;
      if (val === room.answer) {
        const pts = Math.max(10, 100 - localHints * 20 - (localAttempts - 1) * 10);
        _st.score += pts;
        saveSt();
        showSuccess(room, pts);
      } else {
        const fb = _root.querySelector('#el-fb');
        fb.textContent = _t('✖ Access Denied — Try again!','✖ Acesso Negado — Tenta de novo!');
        fb.className = 'el-fb err';
        const panel = _root.querySelector('#el-room');
        panel?.classList.add('el-shk');
        setTimeout(() => { panel?.classList.remove('el-shk'); fb.className = 'el-fb'; fb.textContent = ''; }, 800);
      }
    }

    if (room.type === 'keypad') wireKP(tryAns);
    else wireChoices(room, tryAns);
  }

  // ══ VISUAL HTML ════════════════════════════════════════════════════
  function vizHTML(room) {
    switch (room.viz) {
      case 'count': {
        const items = Array.from({ length: room.countN }, (_, i) =>
          `<span class="el-ci" style="animation-delay:${i * 38}ms">${room.countEmoji}</span>`).join('');
        return `<div style="font-size:.66rem;color:#64748b;margin-bottom:.2rem">${_t('Count carefully:','Conta com cuidado:')}</div><div class="el-cviz">${items}</div>`;
      }
      case 'math-vis': {
        const L = room.mleft.map(e => `<span>${e}</span>`).join('');
        const R = room.mright.map(e => `<span>${e}</span>`).join('');
        return `<div class="el-mviz"><div class="el-mg">${L}</div><span class="el-mop">${room.mop}</span><div class="el-mg">${R}</div><span class="el-meq">=</span><span style="color:#00ff88;font-size:1.4rem;font-weight:700">?</span></div>`;
      }
      case 'seq-display': {
        const nums = room.seq.map((n, i) =>
          `<span class="el-sn" style="animation-delay:${i * 80}ms">${n}</span><span class="el-sa">→</span>`).join('');
        return `<div class="el-seqv">${nums}<span class="el-sq">?</span></div>`;
      }
      case 'emoji-grid': {
        let rows = '';
        for (let r = 0; r < room.gRows; r++) {
          let cols = '';
          for (let c = 0; c < room.gCols; c++) cols += `<span style="font-size:1.2rem">${room.gEmoji}</span>`;
          rows += `<div style="display:flex;gap:.25rem">${cols}</div>`;
        }
        return `<div style="font-size:.66rem;color:#64748b;margin-bottom:.25rem">${room.gRows} ${_t('rows','linhas')} × ${room.gCols} ${_t('columns','colunas')}</div><div class="el-gvis">${rows}</div>`;
      }
      case 'formula':
        return `<div style="font-size:1.65rem;font-weight:700;font-family:var(--font-mono);color:#00ff88;text-shadow:0 0 8px rgba(0,255,136,.35)">${room.formula} = <span>?</span></div>`;
      case 'fraction': {
        const hi = Math.round(room.total * room.num / room.den);
        const cells = Array.from({ length: room.total }, (_, i) =>
          `<div style="width:19px;height:19px;border-radius:3px;background:${i < hi ? '#00cc70' : 'rgba(255,255,255,.06)'};border:1px solid rgba(255,255,255,.08);animation:el-pop .15s ease ${i * 28}ms backwards"></div>`).join('');
        return `<div style="font-size:.66rem;color:#64748b;margin-bottom:.25rem">${room.num}/${room.den} ${_t('of','de')} ${room.total} ${_t('items highlighted:','itens marcados:')}</div><div style="display:flex;flex-wrap:wrap;gap:.22rem;justify-content:center;max-width:260px">${cells}</div>`;
      }
      case 'time-vis':
        return `<div style="display:flex;align-items:center;gap:1.2rem;font-family:var(--font-mono)">
          <div style="text-align:center"><div style="font-size:1.75rem;font-weight:700;color:#00aaff">${room.t1}</div><div style="font-size:.6rem;color:#64748b;margin-top:.15rem">${_t('START','INÍCIO')}</div></div>
          <div style="color:#fbbf24;font-size:1.2rem">→</div>
          <div style="text-align:center"><div style="font-size:1.75rem;font-weight:700;color:#00ff88">${room.t2}</div><div style="font-size:.6rem;color:#64748b;margin-top:.15rem">${_t('END','FIM')}</div></div>
        </div><div style="font-size:.72rem;color:#94a3b8;margin-top:.35rem">${_t('How many minutes between these times?','Quantos minutos entre estes horários?')}</div>`;
      case 'var-formula': {
        const varHTML = Object.entries(room.vars).map(([k, v]) =>
          `<span><span style="color:#fbbf24;font-weight:700">${k}</span><span style="color:#475569"> = </span><span style="color:#00ff88;font-weight:700">${v}</span></span>`).join('<span style="color:#334155;margin:0 .5rem">|</span>');
        return `<div style="font-size:.88rem;margin-bottom:.35rem;font-family:var(--font-mono)">${varHTML}</div><div style="font-size:1.45rem;font-weight:700;color:#a78bfa;font-family:var(--font-mono)">${room.formula} = <span style="color:#00ff88">?</span></div>`;
      }
      case 'equation':
        return `<div style="font-size:1.4rem;font-weight:700;font-family:var(--font-mono);color:#a78bfa">${room.eq}</div><div style="font-size:.7rem;color:#64748b;margin-top:.3rem">${_t('Solve for x','Resolve para x')}</div>`;
      case 'powers':
        return `<div style="font-size:1.7rem;font-weight:700;font-family:var(--font-mono);color:#a78bfa">${room.expr} = <span style="color:#00ff88">?</span></div><div style="font-size:.68rem;color:#64748b;margin-top:.3rem">2ⁿ = 2 ${_t('multiplied by itself n times','multiplicado por si mesmo n vezes')}</div>`;
      case 'modular':
        return `<div style="display:flex;align-items:center;gap:.6rem;font-family:var(--font-mono);font-size:1.3rem;font-weight:700;flex-wrap:wrap;justify-content:center">
          <span>${room.a}</span><span style="color:#fbbf24;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:5px;padding:.15rem .45rem;font-size:.85rem">mod</span><span>${room.b}</span><span style="color:#475569">=</span><span style="color:#00ff88">?</span>
        </div><div style="font-size:.7rem;color:#94a3b8;margin-top:.3rem">mod = ${_t('remainder after integer division','resto da divisão inteira')}</div>`;
      case 'system':
        return `<div style="display:flex;flex-direction:column;gap:.38rem;font-family:var(--font-mono);font-size:1rem;font-weight:600;text-align:center">
          <div style="color:#a78bfa">${room.e1}</div>
          <div style="color:#a78bfa">${room.e2}</div>
        </div><div style="font-size:.7rem;color:#64748b;margin-top:.35rem">${_t('Find the value of x','Encontra o valor de x')}</div>`;
      case 'factorial':
        return `<div style="display:flex;flex-direction:column;gap:.4rem;font-family:var(--font-mono);font-size:.95rem;text-align:center">
          <div><span style="color:#64748b">${_t('Step 1:','Passo 1:')} </span><span style="color:#a78bfa">${room.s1}</span></div>
          <div><span style="color:#64748b">${_t('Step 2:','Passo 2:')} </span><span style="color:#00ff88">${room.s2}</span></div>
        </div><div style="font-size:.68rem;color:#64748b;margin-top:.3rem">n! = n × (n−1) × (n−2) × … × 1</div>`;
      default:
        return `<div style="font-size:1.1rem;color:#00ff88;font-family:var(--font-mono)">${room.question}</div>`;
    }
  }

  function inputHTML(room) {
    if (room.type === 'choice') {
      return `<div class="el-chs">${room.choices.map(c => `<button class="el-ch" data-v="${c}">${c}</button>`).join('')}</div>`;
    }
    return `<div class="el-kd" id="el-kd">_</div>
<div class="el-kp">
  ${[7,8,9,4,5,6,1,2,3].map(n => `<button class="el-kk" data-k="${n}">${n}</button>`).join('')}
  <button class="el-kk kd" data-k="del">⌫</button>
  <button class="el-kk" data-k="0">0</button>
  <button class="el-kk ke" data-k="ok">ENTER</button>
</div>`;
  }

  function wireKP(onAnswer) {
    let val = '';
    const disp = _root.querySelector('#el-kd');
    function press(k) {
      if (k === 'del') { val = val.slice(0, -1); disp.textContent = val || '_'; }
      else if (k === 'ok') { if (!val) return; onAnswer(+val); val = ''; disp.textContent = '_'; }
      else if (val.length < 6) { val += k; disp.textContent = val; }
    }
    _root.querySelector('.el-kp')?.addEventListener('click', e => {
      const k = e.target.closest('.el-kk')?.dataset.k;
      if (k) press(k);
    });
    _kh = e => {
      if (!_root?.classList.contains('active')) return;
      if (e.key >= '0' && e.key <= '9' && val.length < 6) { val += e.key; disp.textContent = val; }
      else if (e.key === 'Backspace') { val = val.slice(0, -1); disp.textContent = val || '_'; }
      else if (e.key === 'Enter') press('ok');
    };
    document.addEventListener('keydown', _kh);
  }

  function wireChoices(room, onAnswer) {
    _root.querySelector('.el-chs')?.addEventListener('click', e => {
      const btn = e.target.closest('.el-ch');
      if (!btn || btn.disabled) return;
      const v = +btn.dataset.v;
      _root.querySelectorAll('.el-ch').forEach(b => b.disabled = true);
      if (v === room.answer) {
        btn.classList.add('cok');
        setTimeout(() => onAnswer(v), 350);
      } else {
        btn.classList.add('cbad');
        setTimeout(() => {
          btn.classList.remove('cbad');
          _root.querySelectorAll('.el-ch').forEach(b => b.disabled = false);
          onAnswer(v);
        }, 400);
      }
    });
  }

  function showSuccess(room, pts) {
    const tier = tierFor(_st.age);
    const rooms = ROOMS[tier];
    const isLast = _st.room >= rooms.length - 1;
    const ov = document.createElement('div');
    ov.className = 'el-ov';
    ov.innerHTML = `
      <div class="el-ov-em">${isLast ? '🏆' : '🔓'}</div>
      <div class="el-ov-t">${isLast ? _t('Lab Escaped!','Laboratório Escapado!') : _t('Door Unlocked!','Porta Aberta!')}</div>
      <div class="el-ov-s">${isLast ? _t('You solved all 5 puzzles and escaped!','Resolveste todos os 5 puzzles e escapaste!') : _t('Excellent! The security door slides open.','Excelente! A porta de segurança abre.')}</div>
      <div class="el-ov-p">+${pts} pts</div>
      <button class="el-cntbtn" id="el-cnt">${isLast ? _t('🏆 See Results','🏆 Ver Resultados') : _t('Next Room →','Sala Seguinte →')}</button>`;
    _root.querySelector('#el-root')?.appendChild(ov);
    spawnParts();
    ov.querySelector('#el-cnt').addEventListener('click', () => {
      if (isLast) showComplete();
      else { cleanKH(); showRoom(_st.room + 1); }
    });
  }

  function showComplete() {
    const elapsed = Math.round((Date.now() - _st.startTime) / 1000);
    const m = Math.floor(elapsed / 60), sc = elapsed % 60;
    const tStr = m > 0 ? `${m}m ${sc}s` : `${sc}s`;
    const tier = tierFor(_st.age);
    const lbl = { '7': _t('Explorer','Explorador'), '10': _t('Scientist','Cientista'), '13': _t('Genius','Génio') }[tier];
    if (!_st.bests[tier] || _st.score > _st.bests[tier]) _st.bests[tier] = _st.score;
    saveSt();

    _root.innerHTML = `
<div class="game-card el-wrap" style="padding:0" id="el-root">
  <div class="el-scan"></div>
  <div class="el-cx tl"></div><div class="el-cx tr"></div>
  <div class="el-cx bl"></div><div class="el-cx br"></div>
  <div class="el-inner">
    <div class="el-fin">
      <div class="el-trph">🏆</div>
      <div class="el-ft">${_t('Lab Escaped!','Laboratório Escapado!')}</div>
      <div class="el-fs">${_t('You are a','És um')} <strong style="color:#00ff88">${lbl}</strong>!<br>${_t('All 5 puzzles solved. You are a genius.','Todos os 5 puzzles resolvidos. És um génio.')}</div>
      <div class="el-stts">
        <div class="el-st"><span class="el-stv">${_st.score}</span><span class="el-stl">${_t('Score','Pontos')}</span></div>
        <div class="el-st"><span class="el-stv">${tStr}</span><span class="el-stl">${_t('Time','Tempo')}</span></div>
        <div class="el-st"><span class="el-stv">${_st.totalHints}</span><span class="el-stl">${_t('Hints','Dicas')}</span></div>
      </div>
      <button class="el-rabtn" id="el-ra">🔄 ${_t('Play Again','Jogar de Novo')}</button>
    </div>
  </div>
</div>`;
    spawnParts();
    _root.querySelector('#el-ra').addEventListener('click', () => { cleanKH(); showMenu(); });
  }

  function spawnParts() {
    const c = _root.querySelector('#el-root') || _root.querySelector('.el-wrap');
    if (!c) return;
    const cols = ['#00ff88', '#00bfff', '#fbbf24', '#a855f7', '#f43f5e'];
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'el-pt';
        const sz = 4 + Math.random() * 8;
        p.style.cssText = `width:${sz}px;height:${sz}px;background:${cols[Math.floor(Math.random() * cols.length)]};left:${15 + Math.random() * 70}%;top:${5 + Math.random() * 45}%;`;
        c.appendChild(p);
        requestAnimationFrame(() => {
          p.style.transition = 'transform 1.15s ease-out, opacity 1.15s';
          p.style.transform = `translate(${(Math.random() - .5) * 190}px,${60 + Math.random() * 170}px) rotate(${Math.random() * 720}deg)`;
          p.style.opacity = '0';
        });
        setTimeout(() => p.remove(), 1250);
      }, i * 30);
    }
  }

  function cleanKH() {
    if (_kh) { document.removeEventListener('keydown', _kh); _kh = null; }
  }

  return { init };
})();
