const RobotRepairGame = (function () {
  'use strict';

  function _t(en, pt) { try { return I18n.getLang() === 'pt' ? pt : en; } catch { return en; } }
  function tierFor(age) { const a = +age; if (a <= 8) return 'easy'; if (a <= 11) return 'med'; return 'hard'; }

  function injectCSS() {
    if (document.getElementById('rr-css')) return;
    const s = document.createElement('style'); s.id = 'rr-css';
    s.textContent = `
.rr-wrap{background:#0a0415;min-height:100%;display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;color:#e2e8f0;user-select:none}
.rr-menu{display:flex;flex-direction:column;align-items:center;gap:14px;padding:28px 20px}
.rr-logo{font-size:3.5rem;filter:drop-shadow(0 0 20px rgba(167,139,250,.8));animation:rr-float 3s ease-in-out infinite}
@keyframes rr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.rr-title{font-size:1.8rem;font-weight:900;background:linear-gradient(120deg,#a78bfa,#f0abfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center}
.rr-sub{font-size:.85rem;color:#7c3aed;text-align:center}
.rr-age-lbl{font-size:.75rem;color:#6b21a8;letter-spacing:.15em;text-transform:uppercase;margin-top:4px}
.rr-age-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px}
.rr-ab{background:rgba(124,58,237,.08);border:1.5px solid rgba(124,58,237,.25);border-radius:10px;padding:8px 14px;cursor:pointer;font-size:.9rem;font-weight:700;color:#7c3aed;min-width:54px;text-align:center;transition:all .15s}
.rr-ab:hover,.rr-ab.sel{border-color:#a78bfa;background:rgba(124,58,237,.2);color:#c4b5fd;transform:translateY(-2px);box-shadow:0 0 12px rgba(124,58,237,.3)}
.rr-tier-hint{font-size:.8rem;color:#581c87;text-align:center;min-height:18px}
.rr-start-btn{background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:1.1rem;font-weight:700;cursor:pointer;transition:transform .15s;box-shadow:0 4px 20px rgba(124,58,237,.4)}
.rr-start-btn:hover{transform:scale(1.04)}
.rr-start-btn:disabled{opacity:.4;cursor:default;transform:none}
.rr-bests{font-size:.75rem;color:#4c1d95;text-align:center}
.rr-game{display:flex;flex-direction:column;padding:14px;gap:12px}
.rr-robot-bay{background:rgba(124,58,237,.04);border:1.5px solid rgba(124,58,237,.12);border-radius:14px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px}
.rr-bay-title{font-size:.65rem;color:#6b21a8;letter-spacing:.15em;text-transform:uppercase}
.rr-robot-svg{width:180px;height:160px;flex-shrink:0}
.rr-repair-prog{display:flex;gap:6px;align-items:center}
.rr-mod-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid #2d1060;background:#0a0415;transition:all .3s}
.rr-mod-dot.done{background:#22c55e;border-color:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.6)}
.rr-mod-dot.curr{background:rgba(167,139,250,.2);border-color:#a78bfa;animation:rr-dp .85s ease-in-out infinite alternate}
@keyframes rr-dp{from{box-shadow:0 0 3px rgba(167,139,250,.3)}to{box-shadow:0 0 12px rgba(167,139,250,.8)}}
.rr-score-row{display:flex;justify-content:space-between;font-size:.75rem;color:#7c3aed;padding:0 4px}
.rr-card{background:rgba(124,58,237,.04);border:1.5px solid rgba(124,58,237,.12);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px}
.rr-badge{display:inline-flex;font-size:.6rem;color:#9333ea;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(124,58,237,.3);border-radius:20px;padding:4px 12px;background:rgba(124,58,237,.08);align-self:flex-start}
.rr-story{font-size:.8rem;color:#94a3b8;line-height:1.6;border-left:2px solid rgba(124,58,237,.3);padding-left:10px}
.rr-viz-box{background:rgba(0,0,0,.35);border:1px solid rgba(124,58,237,.1);border-radius:10px;padding:14px;min-height:72px;display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center}
.rr-viz-emoji{font-size:1.4rem;animation:rr-pop .18s ease backwards;line-height:1}
@keyframes rr-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.rr-viz-label{font-size:.65rem;color:#64748b;text-align:center;width:100%;margin-bottom:2px}
.rr-seq-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center}
.rr-seq-num{background:rgba(124,58,237,.15);border:1.5px solid rgba(167,139,250,.35);border-radius:8px;padding:6px 12px;font-size:1.05rem;font-weight:700;color:#c4b5fd;animation:rr-pop .2s ease backwards}
.rr-seq-q{background:rgba(124,58,237,.06);border:2px dashed rgba(167,139,250,.5);border-radius:8px;padding:6px 14px;font-size:1.1rem;color:#a78bfa;animation:rr-pulse 1s ease-in-out infinite alternate}
@keyframes rr-pulse{from{border-color:rgba(167,139,250,.3)}to{border-color:rgba(167,139,250,.8)}}
.rr-seq-arrow{color:#4c1d95;font-size:.85rem}
.rr-eq-text{font-size:1.5rem;font-weight:700;color:#c4b5fd;font-family:monospace;text-align:center}
.rr-grid-rows{display:flex;flex-direction:column;gap:4px;align-items:center}
.rr-grid-row{display:flex;gap:4px}
.rr-question{font-size:.95rem;font-weight:600;color:#e2e8f0;text-align:center}
.rr-choices{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rr-ch{background:rgba(124,58,237,.06);border:1.5px solid rgba(124,58,237,.2);border-radius:10px;padding:14px;font-size:1.05rem;font-weight:700;cursor:pointer;color:#e2e8f0;text-align:center;transition:all .15s}
.rr-ch:hover{background:rgba(167,139,250,.15);border-color:rgba(167,139,250,.5);color:#c4b5fd;transform:translateY(-1px)}
.rr-ch.ok{background:rgba(34,197,94,.12)!important;border-color:#22c55e!important;color:#86efac!important;animation:rr-glow .4s ease}
.rr-ch.bad{background:rgba(239,68,68,.1)!important;border-color:rgba(239,68,68,.4)!important;color:#fca5a5!important;animation:rr-shk .3s ease}
@keyframes rr-glow{0%,100%{box-shadow:none}50%{box-shadow:0 0 18px rgba(34,197,94,.4)}}
@keyframes rr-shk{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.rr-kp-wrap{display:flex;flex-direction:column;align-items:center;gap:8px}
.rr-kp-display{background:rgba(0,0,0,.5);border:1.5px solid rgba(167,139,250,.4);border-radius:8px;padding:10px 20px;font-size:1.5rem;font-weight:700;color:#a78bfa;text-align:center;min-width:140px;font-family:monospace;letter-spacing:.05em}
.rr-kp{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;width:100%;max-width:210px}
.rr-kk{background:rgba(255,255,255,.04);border:1.5px solid rgba(124,58,237,.15);color:#cbd5e1;border-radius:8px;padding:12px;font-size:.95rem;font-weight:600;cursor:pointer;transition:all .12s;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.rr-kk:hover{background:rgba(167,139,250,.12);border-color:rgba(167,139,250,.4);color:#a78bfa}
.rr-kk:active{transform:scale(.88)}
.rr-kk.del{color:#f87171;border-color:rgba(239,68,68,.2)}
.rr-kk.ok-key{color:#a78bfa;border-color:rgba(167,139,250,.3);background:rgba(167,139,250,.08);grid-column:span 3;aspect-ratio:unset;padding:11px;font-size:.8rem;letter-spacing:.1em}
.rr-hint-btn{background:transparent;border:1.5px solid rgba(251,191,36,.25);color:#ca8a04;border-radius:20px;padding:5px 16px;font-size:.8rem;cursor:pointer;transition:all .15s}
.rr-hint-btn:hover:not(:disabled){background:rgba(251,191,36,.12);color:#fbbf24}
.rr-hint-btn:disabled{opacity:.3;cursor:default}
.rr-hint-box{background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.2);border-radius:8px;padding:10px 14px;color:#ca8a04;font-size:.78rem;line-height:1.6;display:none}
.rr-hint-box.on{display:block}
.rr-feedback{text-align:center;font-size:.8rem;min-height:22px;border-radius:6px;padding:4px 8px}
.rr-feedback.err{color:#f87171;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2)}
.rr-complete{display:flex;flex-direction:column;align-items:center;gap:16px;padding:30px 20px;text-align:center}
.rr-trophy{font-size:4rem;filter:drop-shadow(0 0 20px rgba(167,139,250,.7));animation:rr-bounce .6s ease}
@keyframes rr-bounce{0%{transform:scale(0) rotate(-20deg)}65%{transform:scale(1.12) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
.rr-complete-title{font-size:1.8rem;font-weight:900;background:linear-gradient(135deg,#a78bfa,#f0abfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.rr-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;max-width:280px}
.rr-stat{background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.15);border-radius:10px;padding:12px;text-align:center}
.rr-stat-val{font-size:1.35rem;font-weight:800;color:#a78bfa;display:block}
.rr-stat-lbl{font-size:.6rem;color:#64748b;text-transform:uppercase;letter-spacing:.1em}
.rr-play-again{background:rgba(124,58,237,.12);border:1.5px solid rgba(124,58,237,.3);color:#a78bfa;border-radius:10px;padding:12px 28px;font-size:.95rem;font-weight:700;cursor:pointer;transition:all .2s}
.rr-play-again:hover{background:rgba(124,58,237,.25);transform:translateY(-2px)}
.rr-success-ov{position:fixed;inset:0;z-index:100;background:rgba(5,2,15,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;animation:rr-fi .25s ease;padding:20px;text-align:center}
@keyframes rr-fi{from{opacity:0}to{opacity:1}}
.rr-success-em{font-size:3.5rem;filter:drop-shadow(0 0 22px rgba(167,139,250,.65));animation:rr-bounce .5s ease}
.rr-success-title{font-size:1.6rem;font-weight:800;color:#a78bfa}
.rr-success-sub{color:#94a3b8;font-size:.82rem;max-width:240px;line-height:1.5}
.rr-success-pts{font-size:1.1rem;font-weight:700;color:#fbbf24}
.rr-success-btn{background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:.95rem;font-weight:700;cursor:pointer;margin-top:6px}
.rr-part{position:fixed;border-radius:50%;pointer-events:none;z-index:101;animation:rr-fly .8s ease-out forwards}
@keyframes rr-fly{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-70px) scale(.2)}}
.rr-frac-cells{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;max-width:260px}
.rr-frac-cell{width:20px;height:20px;border-radius:3px;border:1px solid rgba(255,255,255,.07);animation:rr-pop .15s ease backwards}
.rr-sys-eq{display:flex;flex-direction:column;gap:6px;align-items:center}
.rr-sys-line{font-size:1rem;font-weight:700;color:#c4b5fd;font-family:monospace;background:rgba(167,139,250,.08);padding:6px 16px;border-radius:6px;border:1px solid rgba(167,139,250,.2)}
.rr-mul-grid{display:flex;flex-direction:column;gap:4px;align-items:center}
.rr-mul-row{display:flex;gap:4px}
.rr-mul-cell{min-width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700}
.rr-pows-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
.rr-pow-term{font-size:1.5rem;font-weight:700;color:#c4b5fd;font-family:monospace;background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);padding:6px 14px;border-radius:8px}
@media(max-width:480px){.rr-menu{padding:20px 14px}.rr-title{font-size:1.5rem}.rr-game{padding:10px}.rr-card{padding:12px}.rr-choices{gap:8px}.rr-ch{padding:12px;font-size:.95rem}}`;
    document.head.appendChild(s);
  }

  /* ── Robot SVG ─────────────────────────────────── */
  function robotSVG(doneCount, currentIdx) {
    // 5 modules: 0=head, 1=leftArm, 2=chest, 3=rightArm, 4=legs
    function modColor(i) {
      if (i < doneCount) return '#22c55e';
      if (i === currentIdx) return '#a78bfa';
      return '#3b1d6e';
    }
    function modGlow(i) {
      if (i < doneCount) return 'rgba(34,197,94,.7)';
      if (i === currentIdx) return 'rgba(167,139,250,.8)';
      return 'none';
    }
    const mods = [0,1,2,3,4].map(i => ({c: modColor(i), g: modGlow(i)}));
    return `<svg class="rr-robot-svg" viewBox="0 0 180 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="rr-gf0"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        ${mods.map((m,i) => m.g!=='none'?`<filter id="rr-gf${i+1}"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`:``).join('')}
      </defs>
      <!-- Body -->
      <rect x="60" y="70" width="60" height="50" rx="6" fill="#1e1040" stroke="#4c1d95" stroke-width="1.5"/>
      <!-- Chest module -->
      <rect x="74" y="82" width="32" height="22" rx="5" fill="${mods[2].c}" opacity=".9" filter="${mods[2].g!=='none'?'url(#rr-gf3)':'none'}"/>
      <rect x="82" y="87" width="5" height="5" rx="1" fill="#fff" opacity=".5"/>
      <rect x="90" y="87" width="5" height="5" rx="1" fill="#fff" opacity=".5"/>
      <rect x="82" y="95" width="16" height="3" rx="1.5" fill="#fff" opacity=".3"/>
      <!-- Head -->
      <rect x="65" y="40" width="50" height="28" rx="8" fill="#1e1040" stroke="#4c1d95" stroke-width="1.5"/>
      <!-- Head module (eyes area) -->
      <rect x="70" y="44" width="40" height="20" rx="5" fill="${mods[0].c}" opacity=".8" filter="${mods[0].g!=='none'?'url(#rr-gf1)':'none'}"/>
      <ellipse cx="82" cy="54" rx="6" ry="6" fill="#fff" opacity=".9"/>
      <ellipse cx="98" cy="54" rx="6" ry="6" fill="#fff" opacity=".9"/>
      <ellipse cx="83" cy="54" rx="3" ry="3" fill="#0a0415"/>
      <ellipse cx="99" cy="54" rx="3" ry="3" fill="#0a0415"/>
      <!-- Neck -->
      <rect x="82" y="68" width="16" height="4" rx="2" fill="#2d1060"/>
      <!-- Left arm -->
      <rect x="32" y="72" width="26" height="12" rx="5" fill="#1e1040" stroke="#4c1d95" stroke-width="1.5"/>
      <rect x="34" y="74" width="22" height="8" rx="3" fill="${mods[1].c}" opacity=".9" filter="${mods[1].g!=='none'?'url(#rr-gf2)':'none'}"/>
      <!-- Left hand -->
      <rect x="24" y="74" width="10" height="10" rx="3" fill="#1e1040" stroke="#3b1d6e" stroke-width="1.5"/>
      <!-- Right arm -->
      <rect x="122" y="72" width="26" height="12" rx="5" fill="#1e1040" stroke="#4c1d95" stroke-width="1.5"/>
      <rect x="124" y="74" width="22" height="8" rx="3" fill="${mods[3].c}" opacity=".9" filter="${mods[3].g!=='none'?'url(#rr-gf4)':'none'}"/>
      <!-- Right hand -->
      <rect x="146" y="74" width="10" height="10" rx="3" fill="#1e1040" stroke="#3b1d6e" stroke-width="1.5"/>
      <!-- Legs -->
      <rect x="67" y="122" width="20" height="24" rx="5" fill="#1e1040" stroke="#4c1d95" stroke-width="1.5"/>
      <rect x="93" y="122" width="20" height="24" rx="5" fill="#1e1040" stroke="#4c1d95" stroke-width="1.5"/>
      <!-- Legs module overlay -->
      <rect x="67" y="122" width="46" height="16" rx="5" fill="${mods[4].c}" opacity=".8" filter="${mods[4].g!=='none'?'url(#rr-gf5)':'none'}"/>
      <!-- Feet -->
      <rect x="63" y="144" width="26" height="8" rx="4" fill="#1e1040" stroke="#2d1060" stroke-width="1.5"/>
      <rect x="91" y="144" width="26" height="8" rx="4" fill="#1e1040" stroke="#2d1060" stroke-width="1.5"/>
      <!-- Antenna -->
      <line x1="90" y1="40" x2="90" y2="28" stroke="#4c1d95" stroke-width="2"/>
      <circle cx="90" cy="24" r="5" fill="${currentIdx >= 0 ? '#a78bfa' : '#2d1060'}" ${currentIdx >= 0 ? 'filter="url(#rr-gf0)"' : ''}/>
    </svg>`;
  }

  const PUZZLES = {
    easy: [
      { badge:'BOT-01 · Sensor Array', icon:'👁️',
        story: _t => _t('Robot ARIA-7 has a broken sensor array! Count the active sensors below.',
                        'O robô ARIA-7 tem o sistema de sensores avariado! Conta os sensores ativos abaixo.'),
        viz:{ type:'count', emoji:'🔦', n:11, label: _t => _t('Count the sensors:', 'Conta os sensores:') },
        question: _t => _t('How many 🔦 sensors are there?','Quantas 🔦 sensores existem?'),
        choices:[9, 10, 11, 12], answer:11,
        hints:[ _t => _t('Count from left to right.','Conta da esquerda para a direita.'),
                _t => _t('Try grouping them in 5s.','Tenta agrupá-los em grupos de 5.'),
                _t => _t('There are 11 sensors.','Há 11 sensores.') ]
      },
      { badge:'BOT-02 · Arm Factory', icon:'🦾',
        story: _t => _t('Each robot gets 2 arms. Watch the pattern below — how many arms for 7 robots?',
                        'Cada robô recebe 2 braços. Vê o padrão abaixo — quantos braços para 7 robôs?'),
        viz:{ type:'seq', nums:[2,4,6,8,10,12], label: _t => _t('2 arms per robot:','2 braços por robô:') },
        question: _t => _t('7 × 2 = ?','7 × 2 = ?'),
        choices:[12, 14, 16, 18], answer:14,
        hints:[ _t => _t('The sequence skips by 2.','A sequência avança de 2 em 2.'),
                _t => _t('2, 4, 6, 8, 10, 12, 14…','2, 4, 6, 8, 10, 12, 14…'),
                _t => _t('7 × 2 = 14.','7 × 2 = 14.') ]
      },
      { badge:'BOT-03 · Power Cell', icon:'🔋',
        story: _t => _t('Robot BOLT needs power! The sequence shows the charging steps. What comes next?',
                        'O robô BOLT precisa de energia! A sequência mostra os passos de carga. O que vem a seguir?'),
        viz:{ type:'seq', nums:[3,6,9,12], label: _t => _t('Charging sequence:','Sequência de carga:') },
        question: _t => _t('What is the next number?','Qual é o próximo número?'),
        choices:[13, 14, 15, 16], answer:15,
        hints:[ _t => _t('The sequence adds 3 each time.','A sequência aumenta 3 de cada vez.'),
                _t => _t('3, 6, 9, 12… add 3.','3, 6, 9, 12… adiciona 3.'),
                _t => _t('12 + 3 = 15.','12 + 3 = 15.') ]
      },
      { badge:'BOT-04 · Gear System', icon:'⚙️',
        story: _t => _t('The gear system has 4 rows of 5 cogs each. Count the total cogs in the grid!',
                        'O sistema tem 4 filas de 5 engrenagens cada. Conta o total de engrenagens!'),
        viz:{ type:'grid', rows:4, cols:5, emoji:'⚙️', label: _t => _t('Gear grid:','Grelha de engrenagens:') },
        question: _t => _t('4 × 5 = ?','4 × 5 = ?'),
        choices:[16, 18, 20, 22], answer:20,
        hints:[ _t => _t('Count row by row.','Conta linha por linha.'),
                _t => _t('4 rows × 5 cogs each.','4 filas × 5 engrenagens cada.'),
                _t => _t('5 + 5 + 5 + 5 = 20.','5 + 5 + 5 + 5 = 20.') ]
      },
      { badge:'BOT-05 · Master Circuit', icon:'🤖',
        story: _t => _t('Final repair! Solve the formula shown below to restart Robot TITAN.',
                        'Reparação final! Resolve a fórmula abaixo para reiniciar o robô TITAN.'),
        viz:{ type:'formula', expr:'(15 + 9) − 8', label: _t => _t('Calculate:','Calcula:') },
        question: _t => _t('(15 + 9) − 8 = ?','(15 + 9) − 8 = ?'),
        choices:[14, 16, 18, 20], answer:16,
        hints:[ _t => _t('Solve the brackets first: 15 + 9.','Resolve os parênteses primeiro: 15 + 9.'),
                _t => _t('15 + 9 = 24.','15 + 9 = 24.'),
                _t => _t('24 − 8 = 16.','24 − 8 = 16.') ]
      }
    ],
    med: [
      { badge:'BOT-01 · Logic Core', icon:'🧠',
        story: _t => _t('Robot NEXUS has a scrambled logic core! The sequence doubles each step.',
                        'O robô NEXUS tem o núcleo lógico baralhado! A sequência dobra em cada passo.'),
        viz:{ type:'seq', nums:[3,6,12,24], label: _t => _t('Doubling sequence:','Sequência de duplicação:') },
        question: _t => _t('What comes next?','O que vem a seguir?'),
        choices:[36, 42, 48, 54], answer:48,
        hints:[ _t => _t('Each value is doubled.','Cada valor é duplicado.'),
                _t => _t('3×2=6, 6×2=12, 12×2=24…','3×2=6, 6×2=12, 12×2=24…'),
                _t => _t('24 × 2 = 48.','24 × 2 = 48.') ]
      },
      { badge:'BOT-02 · Fuel Tank', icon:'⛽',
        story: _t => _t('NOVA needs exactly 3/4 of the tank. The tank holds 32 units. The bar shows 3/4 filled.',
                        'NOVA precisa de 3/4 do tanque. O tanque tem 32 unidades. A barra mostra 3/4 cheio.'),
        viz:{ type:'fraction', num:3, den:4, total:32, label: _t => _t('3/4 of 32 units:','3/4 de 32 unidades:') },
        question: _t => _t('3/4 × 32 = ?','3/4 × 32 = ?'),
        choices:[20, 22, 24, 28], answer:24,
        hints:[ _t => _t('Find one quarter: 32 ÷ 4 = 8.','Encontra um quarto: 32 ÷ 4 = 8.'),
                _t => _t('One quarter = 8.','Um quarto = 8.'),
                _t => _t('Three quarters = 8 × 3 = 24.','Três quartos = 8 × 3 = 24.') ]
      },
      { badge:'BOT-03 · Speed Unit', icon:'⚡',
        story: _t => _t('Robot FLASH processes prime numbers! The sequence shows primes. What comes next?',
                        'O robô FLASH processa números primos! A sequência mostra primos. Qual vem a seguir?'),
        viz:{ type:'seq', nums:[2,3,5,7,11,13], label: _t => _t('Prime numbers:','Números primos:') },
        question: _t => _t('Next prime after 13?','Próximo primo após 13?'),
        choices:[14, 15, 16, 17], answer:17,
        hints:[ _t => _t('Primes: only divisible by 1 and themselves.','Primos: divisíveis só por 1 e por si.'),
                _t => _t('14=2×7, 15=3×5, 16=2×8 — not primes.','14,15,16 não são primos.'),
                _t => _t('17 has no divisors — it is prime!','17 não tem divisores — é primo!') ]
      },
      { badge:'BOT-04 · Memory Bank', icon:'💾',
        story: _t => _t('OMEGA stores data in a multiplication grid. Each cell = row × col. Find the missing value!',
                        'OMEGA guarda dados numa grelha de multiplicação. Cada célula = linha × coluna. Encontra o valor!'),
        viz:{ type:'mulgrid', grid:[[1,2,3],[2,4,6],[3,6,null]], label: _t => _t('Row × Column grid:','Grelha linha × coluna:') },
        question: _t => _t('What is 3 × 3?','Quanto é 3 × 3?'),
        choices:[6, 7, 8, 9], answer:9,
        hints:[ _t => _t('Cell = row number × column number.','Célula = nº linha × nº coluna.'),
                _t => _t('Row 3, Column 3.','Linha 3, Coluna 3.'),
                _t => _t('3 × 3 = 9.','3 × 3 = 9.') ]
      },
      { badge:'BOT-05 · AI Equation', icon:'🤖',
        story: _t => _t('The AI needs an equation solved to restart. The equation is shown below. Find x!',
                        'A IA precisa de uma equação resolvida para reiniciar. A equação está abaixo. Encontra x!'),
        viz:{ type:'formula', expr:'4x − 3 = 17', label: _t => _t('Solve for x:','Resolve para x:') },
        question: _t => _t('4x − 3 = 17 → x = ?','4x − 3 = 17 → x = ?'),
        choices:[4, 5, 6, 7], answer:5,
        hints:[ _t => _t('Add 3 to both sides: 4x = 20.','Adiciona 3 a ambos os membros: 4x = 20.'),
                _t => _t('4x = 20.','4x = 20.'),
                _t => _t('20 ÷ 4 = 5.','20 ÷ 4 = 5.') ]
      }
    ],
    hard: [
      { badge:'BOT-01 · Crypto Module', icon:'🔐',
        story: _t => _t('CIPHER-9 encrypts data using modular arithmetic. Modulo = remainder after division.',
                        'CIPHER-9 encripta dados com aritmética modular. Módulo = resto da divisão.'),
        viz:{ type:'modular', a:53, b:9, label: _t => _t('Modular arithmetic:','Aritmética modular:') },
        question: _t => _t('53 mod 9 = ?','53 mod 9 = ?'),
        choices:[5, 6, 7, 8], answer:8,
        hints:[ _t => _t('Modulo = remainder after dividing.','Módulo = resto após dividir.'),
                _t => _t('9 × 5 = 45.','9 × 5 = 45.'),
                _t => _t('53 − 45 = 8.','53 − 45 = 8.') ]
      },
      { badge:'BOT-02 · Power Array', icon:'💥',
        story: _t => _t('TITAN uses exponential power. Calculate the total energy from the power terms below.',
                        'TITAN usa energia exponencial. Calcula a energia total dos termos abaixo.'),
        viz:{ type:'powers', terms:['3³','2⁴'], vals:[27,16], label: _t => _t('Power terms:','Termos de potência:') },
        question: _t => _t('3³ + 2⁴ = ?','3³ + 2⁴ = ?'),
        choices:[39, 41, 43, 45], answer:43,
        hints:[ _t => _t('3³ = 3 × 3 × 3.','3³ = 3 × 3 × 3.'),
                _t => _t('3³ = 27 and 2⁴ = 16.','3³ = 27 e 2⁴ = 16.'),
                _t => _t('27 + 16 = 43.','27 + 16 = 43.') ]
      },
      { badge:'BOT-03 · Dual Link', icon:'🔗',
        story: _t => _t('Two robots share a frequency. The system of equations is shown below. Find x.',
                        'Dois robôs partilham uma frequência. O sistema de equações está abaixo. Encontra x.'),
        viz:{ type:'system', e1:'x + y = 20', e2:'x − y = 8', label: _t => _t('System of equations:','Sistema de equações:') },
        question: _t => _t('x + y = 20 and x − y = 8 → x = ?','x + y = 20 e x − y = 8 → x = ?'),
        choices:[12, 13, 14, 15], answer:14,
        hints:[ _t => _t('Add both equations to eliminate y.','Soma as duas equações para eliminar y.'),
                _t => _t('2x = 28.','2x = 28.'),
                _t => _t('x = 14.','x = 14.') ]
      },
      { badge:'BOT-04 · Sequence Core', icon:'🧬',
        story: _t => _t('NEXUS runs on the formula n² + n. The values for n are shown. Evaluate at n = 7.',
                        'NEXUS usa a fórmula n² + n. Os valores de n são mostrados. Avalia para n = 7.'),
        viz:{ type:'varformula', expr:'n² + n', n:7, label: _t => _t('Substitute n = 7:','Substitui n = 7:') },
        question: _t => _t('n = 7 → n² + n = ?','n = 7 → n² + n = ?'),
        choices:[52, 54, 56, 58], answer:56,
        hints:[ _t => _t('n² = n × n.','n² = n × n.'),
                _t => _t('7² = 49.','7² = 49.'),
                _t => _t('49 + 7 = 56.','49 + 7 = 56.') ]
      },
      { badge:'BOT-05 · Master AI', icon:'🤖',
        story: _t => _t('Final repair: the master AI solves its own equation to unlock robot consciousness.',
                        'Reparação final: a IA mestre resolve a própria equação para desbloquear a consciência.'),
        viz:{ type:'formula', expr:'5x + 7 = 42', label: _t => _t('Solve for x:','Resolve para x:') },
        question: _t => _t('5x + 7 = 42 → x = ?','5x + 7 = 42 → x = ?'),
        choices:[5, 6, 7, 8], answer:7,
        hints:[ _t => _t('Subtract 7 from both sides.','Subtrai 7 de ambos os membros.'),
                _t => _t('5x = 35.','5x = 35.'),
                _t => _t('35 ÷ 5 = 7.','35 ÷ 5 = 7.') ]
      }
    ]
  };

  let _root, _st;
  function defSt() { const dfAge = parseInt(localStorage.getItem('game-age-default') || '0') || null; return { age: dfAge, step: 0, score: 0, totalHints: 0, startTime: null, bests: {} }; }
  function loadSt() { try { const s = JSON.parse(localStorage.getItem('rr-st')); if (s?.bests) _st.bests = s.bests; } catch {} }
  function saveSt() { try { localStorage.setItem('rr-st', JSON.stringify({ bests: _st.bests })); } catch {} }

  function init(root) {
    _root = root; if (!root) return;
    _st = defSt(); injectCSS(); loadSt(); showMenu();
    document.addEventListener('langchange', () => { if (_root?.querySelector('.rr-menu')) showMenu(); });
  }

  function showMenu() {
    const tier = _st.age ? tierFor(_st.age) : null;
    const tierLabel = tier === 'easy' ? _t('Beginner · Basic counting & patterns','Iniciante · Contagem e padrões básicos')
      : tier === 'med' ? _t('Engineer · Algebra & fractions','Engenheiro · Álgebra e frações')
      : tier === 'hard' ? _t('Master · Powers & systems','Mestre · Potências e sistemas') : '';

    const bestStr = Object.entries(_st.bests).map(([t,v]) => {
      const lbl = t === 'easy' ? _t('Beginner','Iniciante') : t === 'med' ? _t('Engineer','Engenheiro') : _t('Master','Mestre');
      return `${lbl}: <strong style="color:#a78bfa">${v}</strong> pts`;
    }).join(' · ');

    _root.innerHTML = `<div class="rr-wrap"><div class="rr-menu">
      <div class="rr-logo">🤖</div>
      <div class="rr-title">Robot Repair Lab</div>
      <div class="rr-sub">${_t('Fix broken robots using math!','Repara robôs avariados usando matemática!')}</div>
      <div class="rr-age-lbl">${_t('Your age','A tua idade')}</div>
      <div class="rr-age-grid">
        ${[6,7,8,9,10,11,12,13,14].map(a =>
          `<button class="rr-ab${_st.age==a?' sel':''}" data-age="${a}">${a===14?'14+':a}</button>`).join('')}
      </div>
      <div class="rr-tier-hint" id="rr-th">${tierLabel}</div>
      <button class="rr-start-btn" id="rr-go"${!_st.age?' disabled':''}>▶ ${_t('Start Repairs','Iniciar Reparações')}</button>
      ${bestStr ? `<div class="rr-bests">🏆 ${bestStr}</div>` : ''}
    </div></div>`;

    const th = _root.querySelector('#rr-th');
    _root.querySelectorAll('.rr-ab').forEach(b => b.addEventListener('click', () => {
      _root.querySelectorAll('.rr-ab').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); _st.age = +b.dataset.age;
      const t2 = tierFor(_st.age);
      th.textContent = t2 === 'easy' ? _t('Beginner · Basic counting & patterns','Iniciante · Contagem e padrões básicos')
        : t2 === 'med' ? _t('Engineer · Algebra & fractions','Engenheiro · Álgebra e frações')
        : _t('Master · Powers & systems','Mestre · Potências e sistemas');
      const btn = _root.querySelector('#rr-go'); if (btn) btn.disabled = false;
    }));
    _root.querySelector('#rr-go')?.addEventListener('click', () => { if (_st.age) startGame(_st.age); });
  }

  function startGame(age) {
    _st.age = +age; _st.step = 0; _st.score = 0; _st.totalHints = 0;
    _st.startTime = Date.now(); showStep(0);
  }

  function showStep(idx) {
    const tier = tierFor(_st.age);
    const puzzles = PUZZLES[tier];
    const p = puzzles[idx];
    const total = puzzles.length;
    let hintIdx = 0, hintsUsed = 0, hintShown = false;

    _root.innerHTML = `<div class="rr-wrap"><div class="rr-game">
      <div class="rr-robot-bay">
        <div class="rr-bay-title">🔧 ${_t('Repair Bay','Baía de Reparação')}</div>
        ${robotSVG(idx, idx)}
        <div class="rr-repair-prog">
          ${Array.from({length:total}, (_,i) => `<div class="rr-mod-dot ${i<idx?'done':i===idx?'curr':''}"></div>`).join('')}
        </div>
      </div>
      <div class="rr-score-row">
        <span>${_t('Module','Módulo')} ${idx+1}/${total}</span>
        <span>⭐ ${_st.score} pts</span>
      </div>
      <div class="rr-card">
        <div class="rr-badge">${p.badge}</div>
        <div class="rr-story">${p.story(_t)}</div>
        <div class="rr-viz-box" id="rr-viz">${vizHTML(p)}</div>
        <div class="rr-question">${p.question(_t)}</div>
        <div class="rr-choices" id="rr-choices">
          ${p.choices.map(c => `<button class="rr-ch" data-v="${c}">${c}</button>`).join('')}
        </div>
        <div style="display:flex;justify-content:center">
          <button class="rr-hint-btn" id="rr-hb">💡 ${_t('Hint','Dica')} (${p.hints.length})</button>
        </div>
        <div class="rr-hint-box" id="rr-hint"></div>
        <div class="rr-feedback" id="rr-fb"></div>
      </div>
    </div></div>`;

    const hb = _root.querySelector('#rr-hb');
    const hintBox = _root.querySelector('#rr-hint');
    hb.addEventListener('click', () => {
      if (hintIdx >= p.hints.length) return;
      if (!hintShown) { hintsUsed++; _st.totalHints++; hintShown = true; }
      hintBox.textContent = p.hints[hintIdx](_t);
      hintBox.classList.add('on'); hintIdx++;
      if (hintIdx >= p.hints.length) hb.disabled = true;
      else hb.textContent = `💡 ${_t('Hint','Dica')} (${p.hints.length - hintIdx})`;
    });

    let localAttempts = 0;
    _root.querySelector('#rr-choices').addEventListener('click', e => {
      const btn = e.target.closest('.rr-ch'); if (!btn || btn.disabled) return;
      localAttempts++;
      const v = +btn.dataset.v;
      _root.querySelectorAll('.rr-ch').forEach(b => b.disabled = true);
      if (v === p.answer) {
        btn.classList.add('ok');
        const pts = Math.max(10, 100 - hintsUsed * 20 - (localAttempts - 1) * 10);
        _st.score += pts; saveSt();
        setTimeout(() => showSuccess(idx, pts, total), 500);
      } else {
        btn.classList.add('bad');
        _root.querySelector('#rr-fb').textContent = `✖ ${_t('Not quite — try again!','Não foi — tenta de novo!')}`;
        _root.querySelector('#rr-fb').className = 'rr-feedback err';
        setTimeout(() => {
          btn.classList.remove('bad');
          _root.querySelectorAll('.rr-ch').forEach(b => b.disabled = false);
          _root.querySelector('#rr-fb').className = 'rr-feedback';
          _root.querySelector('#rr-fb').textContent = '';
        }, 600);
      }
    });
  }

  function vizHTML(p) {
    const v = p.viz;
    const lbl = `<div class="rr-viz-label">${v.label(_t)}</div>`;
    if (v.type === 'count') {
      const items = Array.from({length:v.n}, (_,i) =>
        `<span class="rr-viz-emoji" style="animation-delay:${i*30}ms">${v.emoji}</span>`).join('');
      return `${lbl}<div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;max-width:260px">${items}</div>`;
    }
    if (v.type === 'seq') {
      const nums = v.nums.map((n,i) => `<span class="rr-seq-num" style="animation-delay:${i*60}ms">${n}</span><span class="rr-seq-arrow">→</span>`).join('');
      return `${lbl}<div class="rr-seq-row">${nums}<span class="rr-seq-q">?</span></div>`;
    }
    if (v.type === 'grid') {
      let rows = '';
      for (let r=0; r<v.rows; r++) {
        let cells = '';
        for (let c=0; c<v.cols; c++) cells += `<span class="rr-viz-emoji" style="animation-delay:${(r*v.cols+c)*20}ms">${v.emoji}</span>`;
        rows += `<div class="rr-grid-row">${cells}</div>`;
      }
      return `${lbl}<div class="rr-grid-rows">${rows}</div>`;
    }
    if (v.type === 'fraction') {
      const hi = Math.round(v.total * v.num / v.den);
      const cells = Array.from({length:v.total}, (_,i) =>
        `<div class="rr-frac-cell" style="background:${i<hi?'#a78bfa':'rgba(255,255,255,.05)'};animation-delay:${i*20}ms"></div>`).join('');
      return `${lbl}<div class="rr-frac-cells">${cells}</div><div style="font-size:.7rem;color:#7c3aed;margin-top:4px">${v.num}/${v.den} = ${hi} / ${v.total}</div>`;
    }
    if (v.type === 'formula') {
      return `${lbl}<div class="rr-eq-text">${v.expr} = <span style="color:#a78bfa">?</span></div>`;
    }
    if (v.type === 'mulgrid') {
      const rows = v.grid.map((row,ri) => {
        const cells = row.map((val,ci) => {
          const missing = val === null;
          return `<div class="rr-mul-cell" style="background:${missing?'rgba(167,139,250,.06)':'rgba(167,139,250,.1)'};border:${missing?'2px dashed rgba(167,139,250,.5)':'1px solid rgba(167,139,250,.2)'};color:${missing?'#a78bfa':'#c4b5fd'}">${missing?'?':val}</div>`;
        }).join('');
        return `<div class="rr-mul-row">${cells}</div>`;
      }).join('');
      return `${lbl}<div class="rr-mul-grid">${rows}</div><div style="font-size:.65rem;color:#64748b;margin-top:4px">${_t('cell = row × col','célula = linha × col')}</div>`;
    }
    if (v.type === 'modular') {
      return `${lbl}<div style="display:flex;align-items:center;gap:10px;font-size:1.6rem;font-weight:700;font-family:monospace;flex-wrap:wrap;justify-content:center">
        <span style="color:#c4b5fd">${v.a}</span>
        <span style="color:#fbbf24;font-size:1rem;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);padding:3px 10px;border-radius:6px">mod</span>
        <span style="color:#c4b5fd">${v.b}</span>
        <span style="color:#475569">=</span>
        <span style="color:#a78bfa">?</span>
      </div><div style="font-size:.65rem;color:#64748b;margin-top:4px">${_t('Remainder after division','Resto após divisão')}</div>`;
    }
    if (v.type === 'powers') {
      const terms = v.terms.map((t,i) =>
        `<div class="rr-pow-term">${t} = <span style="color:#a78bfa">${v.vals[i]}</span></div>`).join(`<span style="color:#475569;font-size:1.4rem">+</span>`);
      return `${lbl}<div class="rr-pows-row">${terms}</div><div style="font-size:.65rem;color:#64748b;margin-top:4px">${v.terms[0]} + ${v.terms[1]} = ?</div>`;
    }
    if (v.type === 'system') {
      return `${lbl}<div class="rr-sys-eq"><div class="rr-sys-line">${v.e1}</div><div class="rr-sys-line">${v.e2}</div></div>`;
    }
    if (v.type === 'varformula') {
      return `${lbl}<div style="text-align:center"><div style="font-size:.85rem;color:#fbbf24;margin-bottom:6px">n = <strong>${v.n}</strong></div><div class="rr-eq-text">${v.expr} = <span style="color:#a78bfa">?</span></div></div>`;
    }
    return '';
  }

  function showSuccess(idx, pts, total) {
    spawnParts();
    const isLast = idx >= total - 1;
    const ov = document.createElement('div'); ov.className = 'rr-success-ov';
    ov.innerHTML = `
      <div class="rr-success-em">${isLast ? '🏆' : '🔧'}</div>
      <div class="rr-success-title">${isLast ? _t('All Fixed!','Tudo Reparado!') : _t('Module Repaired!','Módulo Reparado!')}</div>
      <div class="rr-success-sub">${isLast ? _t('All 5 modules back online!','Todos os 5 módulos de volta!') : _t('Great work, engineer!','Ótimo trabalho, engenheiro!')}</div>
      <div class="rr-success-pts">+${pts} pts</div>
      <button class="rr-success-btn">${isLast ? `🏆 ${_t('See Results','Ver Resultados')}` : `▶ ${_t('Next Module','Próximo Módulo')}`}</button>`;
    document.body.appendChild(ov);
    ov.querySelector('button').addEventListener('click', () => {
      ov.remove();
      if (isLast) showComplete();
      else showStep(idx + 1);
    });
  }

  function showComplete() {
    const elapsed = Math.round((Date.now() - _st.startTime) / 1000);
    const m = Math.floor(elapsed / 60), sc = elapsed % 60;
    const tier = tierFor(_st.age);
    const lbl = {easy:_t('Beginner','Iniciante'),med:_t('Engineer','Engenheiro'),hard:_t('Master','Mestre')}[tier];
    if (!_st.bests[tier] || _st.score > _st.bests[tier]) _st.bests[tier] = _st.score;
    saveSt();

    _root.innerHTML = `<div class="rr-wrap"><div class="rr-complete">
      <div class="rr-trophy">🤖</div>
      <div class="rr-complete-title">${_t('Lab Complete!','Laboratório Concluído!')}</div>
      <div style="font-size:.85rem;color:#94a3b8">${_t('Certified','Certificado')} <strong style="color:#a78bfa">${lbl}</strong>${_t(' — all robots back online!','— todos os robôs de volta!')}</div>
      <div class="rr-stats">
        <div class="rr-stat"><span class="rr-stat-val">${_st.score}</span><span class="rr-stat-lbl">${_t('Score','Pontos')}</span></div>
        <div class="rr-stat"><span class="rr-stat-val">${m>0?`${m}m${sc}s`:`${sc}s`}</span><span class="rr-stat-lbl">${_t('Time','Tempo')}</span></div>
        <div class="rr-stat"><span class="rr-stat-val">${_st.totalHints}</span><span class="rr-stat-lbl">${_t('Hints','Dicas')}</span></div>
      </div>
      <button class="rr-play-again">🔄 ${_t('Play Again','Jogar de Novo')}</button>
    </div></div>`;
    spawnParts();
    _root.querySelector('.rr-play-again').addEventListener('click', () => { _st = defSt(); loadSt(); showMenu(); });
  }

  function spawnParts() {
    const cols = ['#a78bfa','#c084fc','#f0abfc','#fbbf24','#818cf8'];
    for (let i = 0; i < 24; i++) {
      setTimeout(() => {
        const d = document.createElement('div'); d.className = 'rr-part';
        const sz = 5 + Math.random() * 8;
        d.style.cssText = `width:${sz}px;height:${sz}px;background:${cols[i%cols.length]};left:${10+Math.random()*80}%;top:${20+Math.random()*50}%`;
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 900);
      }, i * 30);
    }
  }

  return { init };
})();
