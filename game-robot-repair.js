const RobotRepairGame = (function () {
  'use strict';

  function _t(en, pt) { try { return I18n.getLang() === 'pt' ? pt : en; } catch { return en; } }
  function tierFor(age) { const a = +age; if (a <= 8) return 'easy'; if (a <= 11) return 'med'; return 'hard'; }

  function injectCSS() {
    if (document.getElementById('rr-css')) return;
    const s = document.createElement('style'); s.id = 'rr-css';
    s.textContent = `
.rr-wrap{position:relative;background:linear-gradient(160deg,#0d0720 0%,#130929 55%,#0b051a 100%);border-radius:14px;overflow:hidden;font-family:var(--font-mono,'JetBrains Mono',monospace);color:#e2e8f0;min-height:580px;display:flex;flex-direction:column}
.rr-wrap *{box-sizing:border-box}
.rr-dots-bg{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(124,58,237,.08) 1px,transparent 1px);background-size:28px 28px;pointer-events:none;z-index:0}
.rr-cx{position:absolute;width:14px;height:14px;border-color:rgba(167,139,250,.3);border-style:solid;z-index:1}
.rr-cx.tl{top:8px;left:8px;border-width:2px 0 0 2px}.rr-cx.tr{top:8px;right:8px;border-width:2px 2px 0 0}
.rr-cx.bl{bottom:8px;left:8px;border-width:0 0 2px 2px}.rr-cx.br{bottom:8px;right:8px;border-width:0 2px 2px 0}
.rr-inner{position:relative;z-index:2;flex:1;display:flex;flex-direction:column}
.rr-menu{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.1rem;padding:2rem}
.rr-logo-em{font-size:3rem;filter:drop-shadow(0 0 18px rgba(124,58,237,.7));animation:rr-float 3s ease-in-out infinite}
@keyframes rr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.rr-logo-t{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.9rem;font-weight:800;background:linear-gradient(120deg,#a78bfa,#c084fc,#f0abfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center;line-height:1.1}
.rr-logo-s{font-size:.68rem;color:#475569;letter-spacing:.18em;text-transform:uppercase;text-align:center}
.rr-age-lbl{font-size:.68rem;color:#6b21a8;letter-spacing:.12em;text-transform:uppercase}
.rr-age-grid{display:flex;flex-wrap:wrap;gap:.42rem;justify-content:center;max-width:300px}
.rr-ab{background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.2);border-radius:9px;padding:.55rem .85rem;cursor:pointer;transition:all .18s;font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.85rem;font-weight:700;color:#7c3aed;min-width:52px;text-align:center}
.rr-ab:hover,.rr-ab.sel{border-color:#a78bfa;background:rgba(124,58,237,.15);color:#c4b5fd;transform:translateY(-1px)}
.rr-age-hint{font-size:.62rem;color:#334155;text-align:center}
.rr-start-btn{background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;border:none;border-radius:9px;padding:.7rem 2rem;font-size:.95rem;font-weight:700;cursor:pointer;transition:transform .13s;font-family:var(--font-head,'Space Grotesk',sans-serif)}
.rr-start-btn:hover{transform:scale(1.04)}
.rr-bests{font-size:.64rem;color:#1e1030;text-align:center}
.rr-layout{flex:1;display:flex;flex-direction:column;gap:.85rem;padding:1.1rem}
.rr-hdr{display:flex;align-items:center;gap:.65rem;background:rgba(0,0,0,.25);border:1px solid rgba(124,58,237,.12);border-radius:9px;padding:.55rem .9rem;flex-wrap:wrap;flex-shrink:0}
.rr-prog{display:flex;align-items:center;gap:.42rem;flex:1}
.rr-d{width:8px;height:8px;border-radius:50%;background:#0d0720;border:1.5px solid #2d1060}
.rr-d.dn{background:#a78bfa;border-color:#a78bfa;box-shadow:0 0 6px rgba(167,139,250,.5)}
.rr-d.cr{border-color:#a78bfa;background:rgba(167,139,250,.14);animation:rr-dp .85s ease-in-out infinite alternate}
@keyframes rr-dp{from{box-shadow:0 0 3px rgba(167,139,250,.3)}to{box-shadow:0 0 9px rgba(167,139,250,.7)}}
.rr-sc{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.82rem;font-weight:700;color:#a78bfa}
.rr-hbtn{background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.22);color:#ca8a04;border-radius:6px;padding:.28rem .6rem;font-size:.66rem;cursor:pointer;transition:all .18s;white-space:nowrap}
.rr-hbtn:hover:not(:disabled){background:rgba(251,191,36,.15);color:#fbbf24}
.rr-hbtn:disabled{opacity:.3;cursor:default}
.rr-panel{background:rgba(124,58,237,.03);border:1px solid rgba(124,58,237,.12);border-radius:11px;flex:1;display:flex;flex-direction:column;gap:.85rem;padding:1.1rem}
.rr-bdg{display:inline-flex;font-size:.6rem;color:#9333ea;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(124,58,237,.25);border-radius:20px;padding:.22rem .62rem;background:rgba(124,58,237,.06);align-self:flex-start}
.rr-story{font-size:.78rem;color:#94a3b8;line-height:1.65;padding-left:.65rem;border-left:2px solid rgba(124,58,237,.25)}
.rr-puz{background:rgba(0,0,0,.25);border:1px solid rgba(124,58,237,.08);border-radius:9px;padding:.95rem;display:flex;flex-direction:column;align-items:center;gap:.65rem;justify-content:center;flex-shrink:0}
.rr-qq{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.95rem;font-weight:600;text-align:center;color:#e2e8f0}
.rr-ia{display:flex;flex-direction:column;align-items:center;gap:.6rem;flex-shrink:0}
.rr-kd{background:rgba(0,0,0,.5);border:1px solid rgba(167,139,250,.35);border-radius:7px;padding:.4rem .9rem;font-size:1.55rem;color:#a78bfa;text-align:center;min-width:140px;text-shadow:0 0 7px rgba(167,139,250,.4);user-select:none;letter-spacing:.07em}
.rr-kp{display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;width:100%;max-width:200px}
.rr-kk{background:rgba(255,255,255,.04);border:1px solid rgba(124,58,237,.15);color:#cbd5e1;border-radius:7px;padding:.55rem;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .12s;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.rr-kk:hover{background:rgba(167,139,250,.12);border-color:rgba(167,139,250,.4);color:#a78bfa}
.rr-kk:active{transform:scale(.91)}
.rr-kk.del{color:#f87171;border-color:rgba(239,68,68,.18)}
.rr-kk.del:hover{background:rgba(239,68,68,.12)!important;color:#ef4444!important}
.rr-kk.ok{color:#a78bfa;border-color:rgba(167,139,250,.28);background:rgba(167,139,250,.07);grid-column:span 3;aspect-ratio:unset;padding:.45rem;font-size:.75rem;letter-spacing:.08em}
.rr-kk.ok:hover{background:rgba(167,139,250,.2)!important}
.rr-chs{display:grid;grid-template-columns:repeat(2,1fr);gap:.45rem;width:100%;max-width:280px}
.rr-ch{background:rgba(124,58,237,.05);border:1px solid rgba(124,58,237,.15);border-radius:8px;padding:.68rem;font-size:1rem;cursor:pointer;transition:all .16s;color:#e2e8f0;font-weight:600;text-align:center}
.rr-ch:hover{background:rgba(167,139,250,.12);border-color:rgba(167,139,250,.4);color:#c4b5fd}
.rr-ch.cok{background:rgba(167,139,250,.15)!important;border-color:#a78bfa!important;color:#a78bfa!important;animation:rr-glow .38s ease}
.rr-ch.cbad{background:rgba(239,68,68,.1)!important;border-color:rgba(239,68,68,.44)!important;color:#f87171!important;animation:rr-shk .32s ease}
@keyframes rr-glow{0%,100%{box-shadow:none}50%{box-shadow:0 0 18px rgba(167,139,250,.44)}}
@keyframes rr-shk{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.rr-fb{min-height:1.7rem;text-align:center;font-size:.76rem;border-radius:6px;padding:.3rem .6rem;transition:all .22s}
.rr-fb.err{color:#f87171;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22)}
.rr-hint{background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.22);border-radius:8px;padding:.8rem;color:#ca8a04;font-size:.75rem;line-height:1.6;display:none}
.rr-hint.on{display:block}
.rr-ht{font-weight:700;color:#fbbf24;margin-bottom:.25rem;font-size:.72rem}
.rr-seqv{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;justify-content:center}
.rr-sn{background:rgba(124,58,237,.12);border:1px solid rgba(167,139,250,.35);border-radius:6px;padding:.35rem .7rem;font-size:1.05rem;font-weight:700;color:#c4b5fd;animation:rr-pop .22s ease backwards}
@keyframes rr-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
.rr-sq{background:rgba(124,58,237,.07);border:2px dashed rgba(167,139,250,.5);border-radius:6px;padding:.35rem .7rem;font-size:1.05rem;color:#a78bfa;animation:rr-sqp .9s ease-in-out infinite alternate}
@keyframes rr-sqp{from{border-color:rgba(167,139,250,.25)}to{border-color:rgba(167,139,250,.75)}}
.rr-sa{color:#334155;font-size:.72rem}
.rr-cviz{display:flex;flex-wrap:wrap;gap:.35rem;justify-content:center;max-width:270px}
.rr-ci{font-size:1.25rem;animation:rr-pop .18s ease backwards}
.rr-ov{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,2,15,.9);border-radius:14px;gap:.8rem;animation:rr-fi .28s ease;padding:1.5rem;text-align:center}
@keyframes rr-fi{from{opacity:0}to{opacity:1}}
.rr-ov-em{font-size:3.3rem;animation:rr-bounce .52s ease;filter:drop-shadow(0 0 22px rgba(167,139,250,.65))}
@keyframes rr-bounce{0%{transform:scale(0)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
.rr-ov-t{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.6rem;font-weight:800;color:#a78bfa}
.rr-ov-s{color:#94a3b8;font-size:.79rem;max-width:240px;line-height:1.5}
.rr-ov-p{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.05rem;font-weight:700;color:#fbbf24}
.rr-cntbtn{background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;border:none;border-radius:9px;padding:.65rem 1.7rem;font-size:.9rem;font-weight:700;cursor:pointer;transition:transform .13s}
.rr-cntbtn:hover{transform:scale(1.04)}
.rr-fin{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.3rem;padding:2rem;text-align:center}
.rr-trph{font-size:4.2rem;filter:drop-shadow(0 0 16px rgba(167,139,250,.6));animation:rr-spin .75s ease}
@keyframes rr-spin{0%{transform:scale(0) rotate(-25deg)}70%{transform:scale(1.08) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
.rr-ft{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#a78bfa,#f0abfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.rr-fs{color:#94a3b8;font-size:.79rem;line-height:1.55;max-width:280px}
.rr-stts{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;width:100%;max-width:280px}
.rr-st{background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.15);border-radius:8px;padding:.65rem;text-align:center}
.rr-stv{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.3rem;font-weight:800;color:#a78bfa;display:block}
.rr-stl{font-size:.6rem;color:#64748b;text-transform:uppercase;letter-spacing:.1em}
.rr-rabtn{background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.3);color:#a78bfa;border-radius:9px;padding:.65rem 1.7rem;font-size:.88rem;font-weight:700;cursor:pointer;transition:all .2s}
.rr-rabtn:hover{background:rgba(124,58,237,.22);transform:translateY(-2px)}
.rr-pt{position:absolute;border-radius:50%;pointer-events:none;z-index:15}
@keyframes rr-rshk{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.rr-shk{animation:rr-rshk .32s ease}
@media(max-width:480px){.rr-menu,.rr-fin{padding:1rem}.rr-logo-t{font-size:1.45rem}.rr-layout{padding:.85rem}.rr-panel{padding:.85rem}.rr-kp{max-width:185px}}`;
    document.head.appendChild(s);
  }

  const PUZZLES = {
    easy: [
      { badge:'BOT-01 · Sensor Array', icon:'👁️',
        story:_t('Robot ARIA-7 has a broken sensor array! Count the active sensors to restore its vision.',
                 'O robô ARIA-7 tem o sistema de sensores avariado! Conta os sensores ativos para restaurar a visão.'),
        type:'count', countEmoji:'🔦', countN:11,
        question:_t('How many 🔦 sensors are active?','Quantos sensores 🔦 estão ativos?'), answer:11,
        hints:[_t('Count carefully from left to right','Conta cuidadosamente da esquerda para a direita'),
               _t('Try grouping them in fives','Tenta agrupá-los em grupos de 5'),
               _t('There are 11 sensors','Há 11 sensores')]
      },
      { badge:'BOT-02 · Arm Factory', icon:'🦾',
        story:_t('The arm assembly line needs math! Each robot gets 2 arms. How many arms for 7 robots?',
                 'A linha de montagem precisa de matemática! Cada robô recebe 2 braços. Quantos braços para 7 robôs?'),
        type:'keypad', viz:'seq-display', seq:[2,4,6,8,10,12], missingNext:true,
        question:'7 × 2 = ?', answer:14,
        hints:[_t('Skip count by 2s','Conta de 2 em 2'),
               _t('2, 4, 6, 8, 10, 12, ...','2, 4, 6, 8, 10, 12, ...'),
               _t('7 × 2 = 14','7 × 2 = 14')]
      },
      { badge:'BOT-03 · Power Cell', icon:'🔋',
        story:_t('Robot BOLT needs power! The energy display shows a sequence. What is the missing value?',
                 'O robô BOLT precisa de energia! O ecrã mostra uma sequência. Qual é o valor em falta?'),
        type:'choice', viz:'seq', seq:[3,6,9,12], choices:[13,14,15,16], answer:15,
        question:_t('What is the next number in the sequence?','Qual é o próximo número na sequência?'),
        hints:[_t('The sequence counts by 3s','A sequência avança de 3 em 3'),
               _t('3, 6, 9, 12... add 3','3, 6, 9, 12... adiciona 3'),
               _t('12 + 3 = 15','12 + 3 = 15')]
      },
      { badge:'BOT-04 · Gear System', icon:'⚙️',
        story:_t('The gear system has 4 rows of 5 cogs each. How many cogs total?',
                 'O sistema de engrenagens tem 4 filas de 5 rodas dentadas cada. Quantas rodas no total?'),
        type:'keypad', viz:'grid', gRows:4, gCols:5, gEmoji:'⚙️',
        question:'4 × 5 = ?', answer:20,
        hints:[_t('Count all gears in the display','Conta todas as engrenagens no ecrã'),
               _t('4 groups of 5 = 5 + 5 + 5 + 5','4 grupos de 5 = 5 + 5 + 5 + 5'),
               _t('5 + 5 + 5 + 5 = 20','5 + 5 + 5 + 5 = 20')]
      },
      { badge:'BOT-05 · Master Circuit', icon:'🤖',
        story:_t('Final circuit repair! Solve the formula to restart Robot TITAN.',
                 'Reparação do circuito principal! Resolve a fórmula para reiniciar o robô TITAN.'),
        type:'keypad', viz:'formula', formula:'(15 + 9) − 8',
        question:'(15 + 9) − 8 = ?', answer:16,
        hints:[_t('Solve brackets first: 15 + 9','Resolve os parênteses primeiro: 15 + 9'),
               _t('15 + 9 = 24','15 + 9 = 24'),
               _t('24 − 8 = ?','24 − 8 = ?')]
      }
    ],
    med: [
      { badge:'BOT-01 · Logic Core', icon:'🧠',
        story:_t('Robot NEXUS has a scrambled logic core! Find the next value in the doubling sequence.',
                 'O robô NEXUS tem o núcleo lógico baralhado! Encontra o próximo valor na sequência de duplicação.'),
        type:'choice', viz:'seq', seq:[3,6,12,24], choices:[36,42,48,54], answer:48,
        question:_t('What comes next in the sequence?','O que vem a seguir na sequência?'),
        hints:[_t('Each value is doubled','Cada valor é duplicado'),
               _t('3, 6, 12, 24... multiply by 2','3, 6, 12, 24... multiplica por 2'),
               _t('24 × 2 = 48','24 × 2 = 48')]
      },
      { badge:'BOT-02 · Fuel Tank', icon:'⛽',
        story:_t('NOVA needs exactly 3/4 of the fuel tank filled. The tank holds 32 units. How many units?',
                 'NOVA precisa de 3/4 do tanque cheio. O tanque tem 32 unidades. Quantas unidades?'),
        type:'keypad', viz:'fraction', num:3, den:4, total:32,
        question:'3/4 × 32 = ?', answer:24,
        hints:[_t('Find one quarter first: 32 ÷ 4','Encontra um quarto primeiro: 32 ÷ 4'),
               _t('32 ÷ 4 = 8','32 ÷ 4 = 8'),
               _t('Multiply by 3: 8 × 3 = ?','Multiplica por 3: 8 × 3 = ?')]
      },
      { badge:'BOT-03 · Speed Unit', icon:'⚡',
        story:_t('Robot FLASH can process prime numbers at top speed! What is the next prime after 13?',
                 'O robô FLASH processa números primos à velocidade máxima! Qual é o próximo primo após 13?'),
        type:'choice', viz:'seq', seq:[2,3,5,7,11,13], choices:[14,15,16,17], answer:17,
        question:_t('What is the next prime number after 13?','Qual é o próximo número primo após 13?'),
        hints:[_t('Primes: only divisible by 1 and themselves','Primos: divisíveis apenas por 1 e por si mesmos'),
               _t('14 = 2×7, 15 = 3×5, 16 = 2×8... are not prime','14, 15, 16 não são primos'),
               _t('17 has no divisors — it is prime!','17 não tem divisores — é primo!')]
      },
      { badge:'BOT-04 · Memory Bank', icon:'💾',
        story:_t('OMEGA stores memories in a grid. Each cell = row × col. Find the missing value!',
                 'OMEGA armazena memórias numa grelha. Cada célula = linha × coluna. Encontra o valor em falta!'),
        type:'keypad', viz:'grid-mul', grid:[[1,2,3],[2,4,6],[3,6,null]],
        question:_t('What is the missing cell value (3 × 3)?','Qual é o valor da célula em falta (3 × 3)?'), answer:9,
        hints:[_t('Cell = row number × column number','Célula = nº linha × nº coluna'),
               _t('Look at position row 3, column 3','Posição: linha 3, coluna 3'),
               _t('3 × 3 = ?','3 × 3 = ?')]
      },
      { badge:'BOT-05 · AI Equation', icon:'🤖',
        story:_t('The AI needs an equation solved to restart. Find x!',
                 'A IA precisa de uma equação resolvida para reiniciar. Encontra x!'),
        type:'keypad', viz:'equation', eq:'4x − 3 = 17',
        question:'4x − 3 = 17  →  x = ?', answer:5,
        hints:[_t('Add 3 to both sides: 4x = 20','Adiciona 3 a ambos os membros: 4x = 20'),
               _t('4x = 20','4x = 20'),
               _t('Divide by 4: x = 5','Divide por 4: x = 5')]
      }
    ],
    hard: [
      { badge:'BOT-01 · Crypto Module', icon:'🔐',
        story:_t('CIPHER-9 encrypts data using modular arithmetic. Compute the encryption key.',
                 'CIPHER-9 encripta dados com aritmética modular. Calcula a chave de encriptação.'),
        type:'keypad', viz:'modular', a:53, b:9,
        question:'53 mod 9 = ?', answer:8,
        hints:[_t('Modulo = remainder after division','Módulo = resto da divisão'),
               _t('9 × 5 = 45','9 × 5 = 45'),
               _t('53 − 45 = ?','53 − 45 = ?')]
      },
      { badge:'BOT-02 · Power Array', icon:'💥',
        story:_t('TITAN uses exponential power. Calculate the energy output.',
                 'TITAN usa energia exponencial. Calcula a potência de saída.'),
        type:'keypad', viz:'powers', expr:'3³ + 2⁴',
        question:'3³ + 2⁴ = ?', answer:43,
        hints:[_t('3³ = 3 × 3 × 3','3³ = 3 × 3 × 3'),
               _t('3³ = 27 and 2⁴ = 16','3³ = 27 e 2⁴ = 16'),
               _t('27 + 16 = ?','27 + 16 = ?')]
      },
      { badge:'BOT-03 · Dual Link', icon:'🔗',
        story:_t('Two robots share a signal. Solve the system to find the shared frequency x.',
                 'Dois robôs partilham um sinal. Resolve o sistema para encontrar a frequência x.'),
        type:'keypad', viz:'system', e1:'x + y = 20', e2:'x − y = 8',
        question:'x + y = 20  and  x − y = 8  →  x = ?', answer:14,
        hints:[_t('Add both equations to eliminate y','Soma as duas equações para eliminar y'),
               _t('2x = 28','2x = 28'),
               _t('x = 14','x = 14')]
      },
      { badge:'BOT-04 · Sequence Core', icon:'🧬',
        story:_t('NEXUS runs on n² + n formula. What is the value when n = 7?',
                 'NEXUS funciona com a fórmula n² + n. Qual é o valor quando n = 7?'),
        type:'keypad', viz:'var-formula', vars:{n:7}, formula:'n² + n',
        question:'n = 7  →  n² + n = ?', answer:56,
        hints:[_t('n² = n × n','n² = n × n'),
               _t('7² = 49','7² = 49'),
               _t('49 + 7 = ?','49 + 7 = ?')]
      },
      { badge:'BOT-05 · Master AI', icon:'🤖',
        story:_t('Final repair: the master AI solves its own equation to unlock robot consciousness.',
                 'Reparação final: a IA mestre resolve a própria equação para desbloquear a consciência robótica.'),
        type:'keypad', viz:'equation', eq:'5x + 7 = 42',
        question:'5x + 7 = 42  →  x = ?', answer:7,
        hints:[_t('Subtract 7 from both sides','Subtrai 7 de ambos os membros'),
               _t('5x = 35','5x = 35'),
               _t('35 ÷ 5 = ?','35 ÷ 5 = ?')]
      }
    ]
  };

  let _root, _kh, _st;
  function defSt() { return { age: null, step: 0, score: 0, totalHints: 0, startTime: null, bests: {} }; }

  function loadSt() { try { const s = JSON.parse(localStorage.getItem('rr-st')); if (s) _st = { ...defSt(), ...s }; } catch {} }
  function saveSt() { try { localStorage.setItem('rr-st', JSON.stringify(_st)); } catch {} }

  function init(root) {
    _root = root; if (!root) return;
    _st = defSt();
    injectCSS(); loadSt(); showMenu();
    document.addEventListener('langchange', () => { if (_root?.querySelector('.rr-menu')) showMenu(); });
  }

  function showMenu() {
    const tierLabels = { easy:_t('Apprentice','Aprendiz'), med:_t('Engineer','Engenheiro'), hard:_t('Master','Mestre') };
    const bestStr = Object.keys(_st.bests).length
      ? '💾 Best: ' + Object.entries(_st.bests).map(([t, v]) => tierLabels[t] + ': ' + v + 'pts').join(' | ') : '';
    const hints = { easy:_t('Counting · Basic math · Patterns','Contagem · Matemática básica · Padrões'),
                    med:_t('Sequences · Fractions · Algebra','Sequências · Frações · Álgebra'),
                    hard:_t('Modular · Powers · Systems','Modular · Potências · Sistemas') };
    const selAge = _st.age || 9;

    _root.innerHTML = `
<div class="game-card rr-wrap" style="padding:0" id="rr-root">
  <div class="rr-dots-bg"></div><div class="rr-cx tl"></div><div class="rr-cx tr"></div><div class="rr-cx bl"></div><div class="rr-cx br"></div>
  <div class="rr-inner"><div class="rr-menu">
    <div class="rr-logo-em">🤖</div>
    <div class="rr-logo-t">Robot Repair Lab</div>
    <div class="rr-logo-s">${_t('Fix Robots with Math!','Repara Robôs com Matemática!')}</div>
    <div class="rr-age-lbl">${_t('Your age','A tua idade')}</div>
    <div class="rr-age-grid">${[6,7,8,9,10,11,12,13,14].map(a=>`<button class="rr-ab${a===selAge?' sel':''}" data-age="${a}">${a===14?'14+':a}</button>`).join('')}</div>
    <div class="rr-age-hint" id="rr-ah">${hints[tierFor(selAge)]}</div>
    <button class="rr-start-btn" id="rr-st">▶ ${_t('Start Repairs','Iniciar Reparações')}</button>
    ${bestStr ? `<div class="rr-bests">${bestStr}</div>` : ''}
  </div></div>
</div>`;

    let sa = selAge;
    _root.querySelectorAll('.rr-ab').forEach(b => {
      b.addEventListener('click', () => {
        _root.querySelectorAll('.rr-ab').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel'); sa = +b.dataset.age;
        const el = _root.querySelector('#rr-ah'); if (el) el.textContent = hints[tierFor(sa)];
      });
    });
    _root.querySelector('#rr-st').addEventListener('click', () => startGame(sa));
  }

  function startGame(age) {
    _st = { ...defSt(), bests: _st.bests }; _st.age = +age; _st.startTime = Date.now(); saveSt(); showStep(0);
  }

  function showStep(idx) {
    cleanKH(); _st.step = idx; saveSt();
    const tier = tierFor(_st.age);
    const puzzles = PUZZLES[tier];
    const p = puzzles[idx];
    let hintsLeft = 3, hintIdx = 0, localHints = 0, localAttempts = 0;

    _root.innerHTML = `
<div class="game-card rr-wrap" style="padding:0" id="rr-root">
  <div class="rr-dots-bg"></div><div class="rr-cx tl"></div><div class="rr-cx tr"></div><div class="rr-cx bl"></div><div class="rr-cx br"></div>
  <div class="rr-inner"><div class="rr-layout">
    <div class="rr-hdr">
      <div class="rr-prog" id="rr-prog"></div>
      <div class="rr-sc">🤖 ${_st.score}</div>
      <button class="rr-hbtn" id="rr-hbtn">💡 ${_t('Hint','Dica')} (${hintsLeft})</button>
    </div>
    <div class="rr-panel" id="rr-panel">
      <div class="rr-bdg">${p.badge}</div>
      <div class="rr-story">${p.story}</div>
      <div class="rr-puz">${vizHTML(p)}</div>
      <div class="rr-qq">${p.question}</div>
      <div class="rr-ia">${inputHTML(p)}</div>
      <div class="rr-fb" id="rr-fb"></div>
      <div class="rr-hint" id="rr-hint"><div class="rr-ht">💡 ${_t('Hint','Dica')}</div><div id="rr-hint-txt"></div></div>
    </div>
  </div></div>
</div>`;

    const prog = _root.querySelector('#rr-prog');
    prog.innerHTML = puzzles.map((_, i) => `<div class="rr-d ${i<idx?'dn':i===idx?'cr':''}"></div>`).join('');

    const hbtn = _root.querySelector('#rr-hbtn');
    hbtn.addEventListener('click', () => {
      if (hintsLeft <= 0) return;
      hintsLeft--; localHints++; _st.totalHints = (_st.totalHints||0) + 1;
      _root.querySelector('#rr-hint-txt').textContent = p.hints[Math.min(hintIdx, p.hints.length-1)];
      hintIdx++; _root.querySelector('#rr-hint').classList.add('on');
      hbtn.textContent = `💡 ${_t('Hint','Dica')} (${hintsLeft})`;
      if (hintsLeft === 0) hbtn.disabled = true;
    });

    function tryAns(val) {
      localAttempts++;
      const correct = p.type === 'choice' ? (val === p.answer) : (+val === p.answer);
      if (correct) {
        const pts = Math.max(10, 100 - localHints*20 - (localAttempts-1)*10);
        _st.score += pts; saveSt(); showSuccess(p, pts);
      } else {
        const fb = _root.querySelector('#rr-fb');
        fb.textContent = _t('✖ Incorrect — Try again!','✖ Errado — Tenta de novo!');
        fb.className = 'rr-fb err';
        _root.querySelector('#rr-panel')?.classList.add('rr-shk');
        setTimeout(() => { _root.querySelector('#rr-panel')?.classList.remove('rr-shk'); fb.className = 'rr-fb'; fb.textContent = ''; }, 800);
      }
    }

    if (p.type === 'choice') wireChoices(p, tryAns);
    else wireKP(tryAns);
  }

  function vizHTML(p) {
    if (p.viz === 'seq' || p.viz === 'seq-display') {
      const nums = p.seq.map((n, i) => `<span class="rr-sn" style="animation-delay:${i*80}ms">${n}</span><span class="rr-sa">→</span>`).join('');
      return `<div class="rr-seqv">${nums}<span class="rr-sq">?</span></div>`;
    }
    if (p.viz === 'count') {
      const items = Array.from({length:p.countN}, (_, i) => `<span class="rr-ci" style="animation-delay:${i*38}ms">${p.countEmoji}</span>`).join('');
      return `<div style="font-size:.66rem;color:#64748b;margin-bottom:.2rem">${_t('Count:','Conta:')}</div><div class="rr-cviz">${items}</div>`;
    }
    if (p.viz === 'grid') {
      let rows = '';
      for (let r=0; r<p.gRows; r++) {
        let cols = ''; for (let c=0; c<p.gCols; c++) cols += `<span style="font-size:1.1rem">${p.gEmoji}</span>`;
        rows += `<div style="display:flex;gap:.2rem">${cols}</div>`;
      }
      return `<div style="font-size:.66rem;color:#64748b;margin-bottom:.2rem">${p.gRows}×${p.gCols}</div><div style="display:flex;flex-direction:column;gap:.2rem;align-items:center">${rows}</div>`;
    }
    if (p.viz === 'fraction') {
      const hi = Math.round(p.total * p.num / p.den);
      const cells = Array.from({length:p.total}, (_,i) => `<div style="width:18px;height:18px;border-radius:3px;background:${i<hi?'#a78bfa':'rgba(255,255,255,.06)'};border:1px solid rgba(255,255,255,.08);animation:rr-pop .15s ease ${i*25}ms backwards"></div>`).join('');
      return `<div style="font-size:.66rem;color:#64748b;margin-bottom:.2rem">${p.num}/${p.den} of ${p.total}</div><div style="display:flex;flex-wrap:wrap;gap:.2rem;justify-content:center;max-width:260px">${cells}</div>`;
    }
    if (p.viz === 'formula')
      return `<div style="font-size:1.6rem;font-weight:700;font-family:var(--font-mono);color:#a78bfa;text-shadow:0 0 8px rgba(167,139,250,.35)">${p.formula} = <span>?</span></div>`;
    if (p.viz === 'grid-mul') {
      const rows = p.grid.map((row,ri) => {
        const cells = row.map((v,ci) => `<div style="min-width:36px;height:36px;border-radius:6px;background:${v===null?'rgba(167,139,250,.04)':'rgba(167,139,250,.08)'};border:${v===null?'2px dashed rgba(167,139,250,.5)':'1px solid rgba(167,139,250,.2)'};display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:${v===null?'#a78bfa':'#c4b5fd'}">${v===null?'?':v}</div>`).join('');
        return `<div style="display:flex;gap:.28rem">${cells}</div>`;
      }).join('');
      return `<div style="display:flex;flex-direction:column;gap:.28rem;align-items:center">${rows}</div><div style="font-size:.66rem;color:#64748b;margin-top:.3rem">${_t('cell = row × col','célula = linha × col')}</div>`;
    }
    if (p.viz === 'equation')
      return `<div style="font-size:1.4rem;font-weight:700;font-family:var(--font-mono);color:#c4b5fd">${p.eq}</div><div style="font-size:.7rem;color:#64748b;margin-top:.3rem">${_t('Solve for x','Resolve para x')}</div>`;
    if (p.viz === 'modular')
      return `<div style="display:flex;align-items:center;gap:.6rem;font-family:var(--font-mono);font-size:1.3rem;font-weight:700;flex-wrap:wrap;justify-content:center">
        <span>${p.a}</span><span style="color:#fbbf24;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:5px;padding:.15rem .4rem;font-size:.85rem">mod</span><span>${p.b}</span><span style="color:#475569">=</span><span style="color:#a78bfa">?</span>
      </div><div style="font-size:.7rem;color:#94a3b8;margin-top:.3rem">mod = ${_t('remainder','resto')}</div>`;
    if (p.viz === 'powers')
      return `<div style="font-size:1.7rem;font-weight:700;font-family:var(--font-mono);color:#c4b5fd">${p.expr} = <span style="color:#a78bfa">?</span></div>`;
    if (p.viz === 'system')
      return `<div style="display:flex;flex-direction:column;gap:.38rem;font-family:var(--font-mono);font-size:1rem;font-weight:600;text-align:center">
        <div style="color:#c4b5fd">${p.e1}</div><div style="color:#c4b5fd">${p.e2}</div>
      </div><div style="font-size:.7rem;color:#64748b;margin-top:.35rem">${_t('Find x','Encontra x')}</div>`;
    if (p.viz === 'var-formula') {
      const vars = Object.entries(p.vars).map(([k,v]) => `<span><span style="color:#fbbf24;font-weight:700">${k}</span><span style="color:#475569"> = </span><span style="color:#a78bfa;font-weight:700">${v}</span></span>`).join('<span style="color:#334155;margin:0 .4rem">|</span>');
      return `<div style="font-size:.88rem;margin-bottom:.3rem;font-family:var(--font-mono)">${vars}</div><div style="font-size:1.45rem;font-weight:700;color:#c4b5fd;font-family:var(--font-mono)">${p.formula} = <span style="color:#a78bfa">?</span></div>`;
    }
    return `<div style="font-size:1.1rem;color:#a78bfa">${p.question}</div>`;
  }

  function inputHTML(p) {
    if (p.type === 'choice') return `<div class="rr-chs">${p.choices.map(c=>`<button class="rr-ch" data-v="${c}">${c}</button>`).join('')}</div>`;
    return `<div class="rr-kd" id="rr-kd">_</div><div class="rr-kp">
      ${[7,8,9,4,5,6,1,2,3].map(n=>`<button class="rr-kk" data-k="${n}">${n}</button>`).join('')}
      <button class="rr-kk del" data-k="del">⌫</button>
      <button class="rr-kk" data-k="0">0</button>
      <button class="rr-kk ok" data-k="ok">ENTER</button>
    </div>`;
  }

  function wireKP(onAns) {
    let val = ''; const disp = _root.querySelector('#rr-kd');
    function press(k) {
      if (k==='del') { val=val.slice(0,-1); disp.textContent=val||'_'; }
      else if (k==='ok') { if (!val) return; onAns(+val); val=''; disp.textContent='_'; }
      else if (val.length<6) { val+=k; disp.textContent=val; }
    }
    _root.querySelector('.rr-kp')?.addEventListener('click', e => { const k=e.target.closest('.rr-kk')?.dataset.k; if(k) press(k); });
    _kh = e => {
      if (!_root?.classList.contains('active')) return;
      if (e.key>='0'&&e.key<='9'&&val.length<6) { val+=e.key; disp.textContent=val; }
      else if (e.key==='Backspace') { val=val.slice(0,-1); disp.textContent=val||'_'; }
      else if (e.key==='Enter') press('ok');
    };
    document.addEventListener('keydown', _kh);
  }

  function wireChoices(p, onAns) {
    _root.querySelector('.rr-chs')?.addEventListener('click', e => {
      const btn = e.target.closest('.rr-ch'); if (!btn||btn.disabled) return;
      const v = +btn.dataset.v;
      _root.querySelectorAll('.rr-ch').forEach(b => b.disabled=true);
      if (v === p.answer) { btn.classList.add('cok'); setTimeout(() => onAns(v), 350); }
      else { btn.classList.add('cbad'); setTimeout(() => { btn.classList.remove('cbad'); _root.querySelectorAll('.rr-ch').forEach(b=>b.disabled=false); onAns(v); }, 400); }
    });
  }

  function showSuccess(p, pts) {
    const puzzles = PUZZLES[tierFor(_st.age)];
    const isLast = _st.step >= puzzles.length - 1;
    const ov = document.createElement('div'); ov.className = 'rr-ov';
    ov.innerHTML = `
      <div class="rr-ov-em">${isLast?'🏆':'🔧'}</div>
      <div class="rr-ov-t">${isLast?_t('All Robots Fixed!','Todos os Robôs Reparados!'):_t('Robot Repaired!','Robô Reparado!')}</div>
      <div class="rr-ov-s">${isLast?_t('You repaired all 5 robots!','Reparaste todos os 5 robôs!'):_t('Excellent work, engineer!','Excelente trabalho, engenheiro!')}</div>
      <div class="rr-ov-p">+${pts} pts</div>
      <button class="rr-cntbtn" id="rr-cnt">${isLast?_t('🏆 Results','🏆 Resultados'):_t('Next Robot →','Próximo Robô →')}</button>`;
    _root.querySelector('#rr-root')?.appendChild(ov);
    spawnParts();
    ov.querySelector('#rr-cnt').addEventListener('click', () => { if (isLast) showComplete(); else { cleanKH(); showStep(_st.step+1); } });
  }

  function showComplete() {
    const elapsed = Math.round((Date.now()-_st.startTime)/1000);
    const m = Math.floor(elapsed/60), sc = elapsed%60;
    const tStr = m>0?`${m}m ${sc}s`:`${sc}s`;
    const tier = tierFor(_st.age);
    const lbl = {easy:_t('Apprentice','Aprendiz'),med:_t('Engineer','Engenheiro'),hard:_t('Master','Mestre')}[tier];
    if (!_st.bests[tier]||_st.score>_st.bests[tier]) _st.bests[tier]=_st.score;
    saveSt();
    _root.innerHTML = `
<div class="game-card rr-wrap" style="padding:0" id="rr-root">
  <div class="rr-dots-bg"></div><div class="rr-cx tl"></div><div class="rr-cx tr"></div><div class="rr-cx bl"></div><div class="rr-cx br"></div>
  <div class="rr-inner"><div class="rr-fin">
    <div class="rr-trph">🤖</div>
    <div class="rr-ft">${_t('Lab Complete!','Laboratório Concluído!')}</div>
    <div class="rr-fs">${_t('Certified','Certificado')} <strong style="color:#a78bfa">${lbl}</strong>${_t(' — all robots back online!','— todos os robôs de volta!')}</div>
    <div class="rr-stts">
      <div class="rr-st"><span class="rr-stv">${_st.score}</span><span class="rr-stl">${_t('Score','Pontos')}</span></div>
      <div class="rr-st"><span class="rr-stv">${tStr}</span><span class="rr-stl">${_t('Time','Tempo')}</span></div>
      <div class="rr-st"><span class="rr-stv">${_st.totalHints}</span><span class="rr-stl">${_t('Hints','Dicas')}</span></div>
    </div>
    <button class="rr-rabtn" id="rr-ra">🔄 ${_t('Play Again','Jogar de Novo')}</button>
  </div></div>
</div>`;
    spawnParts();
    _root.querySelector('#rr-ra').addEventListener('click', () => { cleanKH(); showMenu(); });
  }

  function spawnParts() {
    const c = _root.querySelector('#rr-root') || _root.querySelector('.rr-wrap');
    if (!c) return;
    const cols = ['#a78bfa','#c084fc','#f0abfc','#fbbf24','#818cf8'];
    for (let i=0; i<28; i++) {
      setTimeout(() => {
        const p = document.createElement('div'); p.className='rr-pt';
        const sz = 4+Math.random()*8;
        p.style.cssText=`width:${sz}px;height:${sz}px;background:${cols[Math.floor(Math.random()*cols.length)]};left:${15+Math.random()*70}%;top:${5+Math.random()*45}%;`;
        c.appendChild(p);
        requestAnimationFrame(() => { p.style.transition='transform 1.1s ease-out,opacity 1.1s'; p.style.transform=`translate(${(Math.random()-.5)*180}px,${55+Math.random()*160}px) rotate(${Math.random()*720}deg)`; p.style.opacity='0'; });
        setTimeout(() => p.remove(), 1200);
      }, i*32);
    }
  }

  function cleanKH() { if (_kh) { document.removeEventListener('keydown', _kh); _kh=null; } }

  return { init };
})();
