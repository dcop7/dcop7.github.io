const CipherGridGame = (function () {
  'use strict';

  // ══ CSS ══════════════════════════════════════════════════════════════
  function injectCSS() {
    if (document.getElementById('cg-css')) return;
    const s = document.createElement('style');
    s.id = 'cg-css';
    s.textContent = `
.cg-wrap{position:relative;background:linear-gradient(160deg,#020b12 0%,#030f1a 55%,#020c14 100%);border-radius:14px;overflow:hidden;font-family:var(--font-mono,'JetBrains Mono',monospace);color:#e2e8f0;min-height:580px;display:flex;flex-direction:column}
.cg-wrap *{box-sizing:border-box}
.cg-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(6,182,212,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,.04) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0}
.cg-cx{position:absolute;width:16px;height:16px;border-color:rgba(6,182,212,.3);border-style:solid;z-index:1}
.cg-cx.tl{top:9px;left:9px;border-width:2px 0 0 2px}
.cg-cx.tr{top:9px;right:9px;border-width:2px 2px 0 0}
.cg-cx.bl{bottom:9px;left:9px;border-width:0 0 2px 2px}
.cg-cx.br{bottom:9px;right:9px;border-width:0 2px 2px 0}
.cg-inner{position:relative;z-index:2;flex:1;display:flex;flex-direction:column}

/* ─── MENU ─── */
.cg-menu{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.3rem;padding:2rem}
.cg-logo-em{font-size:3rem;text-align:center;filter:drop-shadow(0 0 16px rgba(6,182,212,.6));animation:cg-float 3s ease-in-out infinite}
@keyframes cg-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.cg-logo-t{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.9rem;font-weight:800;text-align:center;background:linear-gradient(120deg,#22d3ee,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-.02em;line-height:1.1}
.cg-logo-s{font-size:.68rem;color:#475569;letter-spacing:.18em;text-transform:uppercase;text-align:center}
.cg-age-lbl{font-size:.68rem;color:#475569;letter-spacing:.12em;text-transform:uppercase;text-align:center}
.cg-ages{display:flex;flex-direction:column;gap:.55rem;width:100%;max-width:295px}
.cg-ab{background:rgba(255,255,255,.032);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:.82rem 1rem;display:flex;align-items:center;gap:.8rem;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;text-align:left;width:100%}
.cg-ab::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#22d3ee;opacity:0;transition:opacity .2s;border-radius:0 2px 2px 0}
.cg-ab:hover{border-color:rgba(6,182,212,.35);background:rgba(6,182,212,.04);transform:translateX(3px)}
.cg-ab:hover::before{opacity:1}
.cg-ab-em{font-size:1.5rem;flex-shrink:0}
.cg-ab-info{flex:1}
.cg-ab-name{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.85rem;font-weight:700;color:#e2e8f0}
.cg-ab-desc{font-size:.66rem;color:#64748b;margin-top:.1rem}
.cg-ab-arr{color:#22d3ee;opacity:0;transition:opacity .2s;font-size:.9rem}
.cg-ab:hover .cg-ab-arr{opacity:1}
.cg-bests{font-size:.64rem;color:#1e293b;text-align:center}

/* ─── GAME HEADER ─── */
.cg-game-layout{flex:1;display:flex;flex-direction:column;gap:.85rem;padding:1.1rem}
.cg-ghdr{display:flex;align-items:center;gap:.65rem;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.05);border-radius:9px;padding:.55rem .9rem;flex-wrap:wrap;flex-shrink:0}
.cg-prog{display:flex;align-items:center;gap:.42rem;flex:1}
.cg-d{width:8px;height:8px;border-radius:50%;background:#070f16;border:1.5px solid #102030;transition:all .4s}
.cg-d.dn{background:#22d3ee;border-color:#22d3ee;box-shadow:0 0 6px rgba(6,182,212,.5)}
.cg-d.cr{border-color:#22d3ee;background:rgba(6,182,212,.14);animation:cg-dp .85s ease-in-out infinite alternate}
@keyframes cg-dp{from{box-shadow:0 0 3px rgba(6,182,212,.3)}to{box-shadow:0 0 9px rgba(6,182,212,.7)}}
.cg-score-area{display:flex;align-items:center;gap:.5rem}
.cg-sc{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.82rem;font-weight:700;color:#22d3ee}
.cg-streak{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.22);color:#fbbf24;border-radius:6px;padding:.22rem .5rem;font-size:.68rem;font-weight:700;display:none}
.cg-streak.on{display:block}
.cg-hbtn{background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.22);color:#ca8a04;border-radius:6px;padding:.28rem .6rem;font-size:.66rem;cursor:pointer;transition:all .18s;white-space:nowrap;font-family:var(--font-mono,'JetBrains Mono',monospace)}
.cg-hbtn:hover:not(:disabled){background:rgba(251,191,36,.15);color:#fbbf24;border-color:rgba(251,191,36,.45)}
.cg-hbtn:disabled{opacity:.3;cursor:default}

/* ─── LEVEL PANEL ─── */
.cg-panel{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:11px;flex:1;display:flex;flex-direction:column;gap:.85rem;padding:1.1rem}
.cg-bdg{display:inline-flex;align-items:center;font-size:.6rem;color:#0891b2;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(6,182,212,.2);border-radius:20px;padding:.22rem .62rem;background:rgba(6,182,212,.04);align-self:flex-start}
.cg-story{font-size:.78rem;color:#94a3b8;line-height:1.65;padding-left:.65rem;border-left:2px solid rgba(6,182,212,.2)}
.cg-puz{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.04);border-radius:9px;padding:.95rem;display:flex;flex-direction:column;align-items:center;gap:.65rem;justify-content:center;flex-shrink:0}
.cg-qq{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:.95rem;font-weight:600;text-align:center;color:#e2e8f0}
.cg-ia{display:flex;flex-direction:column;align-items:center;gap:.6rem;flex-shrink:0}

/* ─── KEYPAD ─── */
.cg-kd{background:rgba(0,0,0,.45);border:1px solid rgba(6,182,212,.28);border-radius:7px;padding:.4rem .9rem;font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:1.55rem;color:#22d3ee;text-align:center;min-width:140px;text-shadow:0 0 7px rgba(6,182,212,.35);user-select:none;letter-spacing:.07em}
.cg-kp{display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;width:100%;max-width:200px}
.cg-kk{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;border-radius:7px;padding:.55rem;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .12s;font-family:var(--font-mono,'JetBrains Mono',monospace);aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.cg-kk:hover{background:rgba(6,182,212,.11);border-color:rgba(6,182,212,.36);color:#22d3ee;box-shadow:0 0 6px rgba(6,182,212,.1)}
.cg-kk:active{transform:scale(.91)}
.cg-kk.kd{color:#f87171;border-color:rgba(239,68,68,.18);background:rgba(239,68,68,.04)}
.cg-kk.kd:hover{background:rgba(239,68,68,.12)!important;border-color:rgba(239,68,68,.44)!important;color:#ef4444!important}
.cg-kk.ke{color:#22d3ee;border-color:rgba(6,182,212,.28);background:rgba(6,182,212,.07);grid-column:span 3;aspect-ratio:unset;padding:.45rem;font-size:.75rem;letter-spacing:.08em}
.cg-kk.ke:hover{background:rgba(6,182,212,.2)!important;box-shadow:0 0 12px rgba(6,182,212,.2)!important}

/* ─── CHOICES ─── */
.cg-chs{display:grid;grid-template-columns:repeat(2,1fr);gap:.45rem;width:100%;max-width:280px}
.cg-ch{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:.68rem;font-size:1rem;cursor:pointer;transition:all .16s;font-family:var(--font-mono,'JetBrains Mono',monospace);color:#e2e8f0;font-weight:600;text-align:center}
.cg-ch:hover{background:rgba(6,182,212,.09);border-color:rgba(6,182,212,.4);color:#22d3ee}
.cg-ch.cok{background:rgba(6,182,212,.14)!important;border-color:#22d3ee!important;color:#22d3ee!important;animation:cg-glow .38s ease}
.cg-ch.cbad{background:rgba(239,68,68,.1)!important;border-color:rgba(239,68,68,.44)!important;color:#f87171!important;animation:cg-shk .32s ease}
@keyframes cg-glow{0%,100%{box-shadow:none}50%{box-shadow:0 0 18px rgba(6,182,212,.44)}}
@keyframes cg-shk{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}

/* ─── FEEDBACK ─── */
.cg-fb{min-height:1.7rem;text-align:center;font-size:.76rem;border-radius:6px;padding:.3rem .6rem;transition:all .22s}
.cg-fb.ok{color:#22d3ee;background:rgba(6,182,212,.07);border:1px solid rgba(6,182,212,.22)}
.cg-fb.err{color:#f87171;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22)}

/* ─── HINT ─── */
.cg-hint{background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.22);border-radius:8px;padding:.8rem;color:#ca8a04;font-size:.75rem;line-height:1.6;display:none}
.cg-hint.on{display:block}
.cg-ht{font-weight:700;color:#fbbf24;margin-bottom:.25rem;font-size:.72rem}

/* ─── SEQUENCE VISUAL ─── */
.cg-seqv{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;justify-content:center}
.cg-sn{background:rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.35);border-radius:6px;padding:.35rem .7rem;font-size:1.05rem;font-weight:700;color:#67e8f9;font-family:var(--font-mono,'JetBrains Mono',monospace);animation:cg-pop .22s ease backwards}
@keyframes cg-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
.cg-sq{background:rgba(6,182,212,.07);border:2px dashed rgba(6,182,212,.45);border-radius:6px;padding:.35rem .7rem;font-size:1.05rem;color:#22d3ee;font-family:var(--font-mono,'JetBrains Mono',monospace);animation:cg-sqp .9s ease-in-out infinite alternate}
@keyframes cg-sqp{from{border-color:rgba(6,182,212,.25)}to{border-color:rgba(6,182,212,.75)}}
.cg-sa{color:#334155;font-size:.72rem}

/* ─── GRID VISUAL ─── */
.cg-grid-vis{display:flex;flex-direction:column;gap:.3rem;align-items:center}
.cg-grid-row-v{display:flex;gap:.28rem;align-items:center}
.cg-cell{min-width:38px;height:38px;border-radius:6px;background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.2);display:flex;align-items:center;justify-content:center;font-size:.95rem;font-weight:700;font-family:var(--font-mono,'JetBrains Mono',monospace);color:#a5f3fc;animation:cg-pop .18s ease backwards}
.cg-cell.miss{background:rgba(6,182,212,.04);border:2px dashed rgba(6,182,212,.5);color:#22d3ee;animation:cg-sqp .9s ease-in-out infinite alternate}
.cg-cell.sum{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);color:#a5b4fc;font-size:.8rem;min-width:48px}

/* ─── BINARY VISUAL ─── */
.cg-bin-wrap{display:flex;flex-direction:column;align-items:center;gap:.5rem}
.cg-bin-bits{display:flex;gap:.35rem}
.cg-bit{width:40px;height:40px;border-radius:7px;border:1.5px solid rgba(6,182,212,.35);background:rgba(6,182,212,.08);display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#22d3ee;font-family:var(--font-mono,'JetBrains Mono',monospace);animation:cg-pop .18s ease backwards}
.cg-bit.b1{background:rgba(6,182,212,.2);border-color:rgba(6,182,212,.6);box-shadow:0 0 8px rgba(6,182,212,.2)}
.cg-bit-pos{display:flex;gap:.35rem}
.cg-bpos{width:40px;text-align:center;font-size:.68rem;color:#64748b;font-family:var(--font-mono,'JetBrains Mono',monospace)}

/* ─── CIPHER VISUAL ─── */
.cg-cipher-wrap{display:flex;flex-direction:column;align-items:center;gap:.7rem;width:100%}
.cg-codebook{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:.6rem .9rem}
.cg-sym-def{display:flex;align-items:center;gap:.3rem;font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:.95rem}
.cg-sym-key{color:#fbbf24;font-size:1.1rem}
.cg-sym-eq{color:#475569;font-size:.85rem}
.cg-sym-val{color:#22d3ee;font-weight:700}
.cg-cipher-divider{width:60%;height:1px;background:rgba(255,255,255,.06)}
.cg-cipher-expr{font-size:1.45rem;font-weight:700;font-family:var(--font-mono,'JetBrains Mono',monospace);color:#a78bfa;text-align:center}

/* ─── MAGIC SQUARE VISUAL ─── */
.cg-magic-wrap{display:flex;flex-direction:column;align-items:center;gap:.4rem}
.cg-magic-info{font-size:.7rem;color:#64748b;text-align:center}

/* ─── SUCCESS OVERLAY ─── */
.cg-ov{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(2,11,18,.9);border-radius:14px;gap:.8rem;animation:cg-fi .28s ease;padding:1.5rem;text-align:center}
@keyframes cg-fi{from{opacity:0}to{opacity:1}}
.cg-ov-em{font-size:3.3rem;animation:cg-bounce .52s ease;filter:drop-shadow(0 0 22px rgba(6,182,212,.65))}
@keyframes cg-bounce{0%{transform:scale(0)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
.cg-ov-t{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.6rem;font-weight:800;color:#22d3ee;text-shadow:0 0 18px rgba(6,182,212,.4)}
.cg-ov-s{color:#94a3b8;font-size:.79rem;max-width:240px;line-height:1.5}
.cg-ov-p{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.05rem;font-weight:700;color:#fbbf24}
.cg-cntbtn{background:linear-gradient(135deg,#0891b2,#4f46e5);color:#020b12;border:none;border-radius:9px;padding:.65rem 1.7rem;font-size:.9rem;font-weight:700;cursor:pointer;transition:transform .13s;font-family:var(--font-head,'Space Grotesk',sans-serif)}
.cg-cntbtn:hover{transform:scale(1.04)}

/* ─── COMPLETE ─── */
.cg-fin{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.3rem;padding:2rem;text-align:center}
.cg-trph{font-size:4.2rem;filter:drop-shadow(0 0 16px rgba(34,211,238,.55));animation:cg-spin .75s ease}
@keyframes cg-spin{0%{transform:scale(0) rotate(-25deg)}70%{transform:scale(1.08) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
.cg-ft{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#22d3ee,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.cg-fs{color:#94a3b8;font-size:.79rem;line-height:1.55;max-width:280px}
.cg-stts{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;width:100%;max-width:280px}
.cg-st{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:.65rem;text-align:center}
.cg-stv{font-family:var(--font-head,'Space Grotesk',sans-serif);font-size:1.3rem;font-weight:800;color:#22d3ee;display:block}
.cg-stl{font-size:.6rem;color:#64748b;text-transform:uppercase;letter-spacing:.1em}
.cg-rabtn{background:rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.3);color:#22d3ee;border-radius:9px;padding:.65rem 1.7rem;font-size:.88rem;font-weight:700;cursor:pointer;transition:all .2s;font-family:var(--font-head,'Space Grotesk',sans-serif)}
.cg-rabtn:hover{background:rgba(6,182,212,.22);transform:translateY(-2px)}

/* ─── MISC ─── */
.cg-pt{position:absolute;border-radius:50%;pointer-events:none;z-index:15}
@keyframes cg-rshk{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.cg-shk{animation:cg-rshk .32s ease}
@media(max-width:480px){
  .cg-menu,.cg-fin{padding:1rem}
  .cg-logo-t{font-size:1.45rem}
  .cg-game-layout{padding:.85rem;gap:.65rem}
  .cg-panel{padding:.85rem;gap:.65rem}
  .cg-puz{padding:.75rem}
  .cg-kp{max-width:185px}
  .cg-chs{max-width:250px}
  .cg-qq{font-size:.85rem}
  .cg-story{font-size:.72rem}
  .cg-cell{min-width:32px;height:32px;font-size:.82rem}
  .cg-bit{width:34px;height:34px;font-size:1.1rem}
  .cg-bpos{width:34px}
}`;
    document.head.appendChild(s);
  }

  // ══ LEVEL DATA ════════════════════════════════════════════════════════
  const LEVELS = {
    '7': [
      {
        title:'Start-Up Sequence', badge:'LEVEL 01 · Boot Sequence',
        story:'The system is initializing! Complete the start-up sequence to power the grid.',
        type:'sequence', seq:[1,2,3,4], answer:5,
        question:'What number completes the sequence?',
        hints:['Look at the difference between each number','Each number is 1 more than the previous','1, 2, 3, 4... the next is 5']
      },
      {
        title:'Skip Signal', badge:'LEVEL 02 · Signal Relay',
        story:'The relay transmits signals in intervals. Predict the next transmission value!',
        type:'sequence', seq:[5,10,15,20], answer:25,
        question:'What is the next value in the pattern?',
        hints:['Count how much is added each time','The signal jumps by the same amount','5, 10, 15, 20... add 5 to get?']
      },
      {
        title:'Power Boost', badge:'LEVEL 03 · Energy Core',
        story:'Each cycle the power output doubles! Calculate the next energy level.',
        type:'sequence', seq:[2,4,8,16], answer:32,
        question:'What comes next if the value keeps doubling?',
        hints:['Compare each number to the one before it','Each value is exactly twice the previous one','16 \xd7 2 = ?']
      },
      {
        title:'Shape Scanner', badge:'LEVEL 04 · Pattern Lab',
        story:'The scanner has detected a repeating shape pattern in the data stream. What comes next?',
        type:'choice-emoji',
        pattern:['⭐','🔵','⭐','🔵','⭐'],
        choices:['⭐','🔵','🔴','⭐⭐'],
        answer:'🔵',
        question:'Which shape comes next in the pattern?',
        hints:['The pattern repeats two shapes alternately','The sequence is ⭐ then 🔵 then ⭐ then 🔵...','After ⭐ comes 🔵']
      },
      {
        title:'Sum Grid', badge:'LEVEL 05 · Data Matrix',
        story:'Every row in this data matrix sums to exactly 12. Find the missing value!',
        type:'grid-sum',
        grid:[[5,4,3],[6,2,4],[3,null,5]],
        rowSum:12,
        answer:4,
        question:'What value completes the row so it sums to 12?',
        hints:['Each row must add up to exactly 12','Look at the last row: 3 + ? + 5 must equal 12','3 + 5 = 8, and 12 − 8 = ?']
      },
      {
        title:'Square Numbers', badge:'LEVEL 06 · Quad Matrix',
        story:'This sequence contains perfect square numbers — each is a number times itself. What is next?',
        type:'sequence', seq:[1,4,9,16], answer:25,
        question:'What is the next perfect square?',
        hints:['1=1×1, 4=2×2, 9=3×3, 16=4×4','These are 1², 2², 3², 4²...','5² = 5 \xd7 5 = ?']
      }
    ],
    '10': [
      {
        title:'Prime Detector', badge:'LEVEL 01 · Prime Filter',
        story:'The prime detector has isolated a sequence of prime numbers. What is the next one?',
        type:'sequence', seq:[2,3,5,7,11], answer:13,
        question:'What is the next prime number?',
        hints:['Primes are only divisible by 1 and themselves','Is 12 prime? No — 12 = 2 \xd7 6','Test 13: no number from 2–12 divides it evenly']
      },
      {
        title:'Times Table Grid', badge:'LEVEL 02 · Multiply Matrix',
        story:'Each cell equals its row number times its column number. Find the missing value!',
        type:'grid-mul',
        grid:[[1,2,3],[2,4,6],[3,6,null]],
        answer:9,
        question:'What value fills the missing cell?',
        hints:['Each cell = row number × column number','Look at the pattern: row 3, col 3','3 \xd7 3 = ?']
      },
      {
        title:'Division Chain', badge:'LEVEL 03 · Halving Relay',
        story:'Each cycle the signal strength is cut in half. Predict the next value!',
        type:'sequence', seq:[256,128,64,32], answer:16,
        question:'What is the next value in the halving sequence?',
        hints:['Each number is half the one before it','Compare 256→128→64→32...','32 \xf7 2 = ?']
      },
      {
        title:'Symbol Decode', badge:'LEVEL 04 · Cipher Lab',
        story:'Each symbol has a secret numerical value. Use the codebook to evaluate the expression!',
        type:'cipher',
        defs:{ '■': 3, '▲': 5, '●': 7 },
        expr:'■ \xd7 ▲ + ●',
        answer:22,
        question:'What is the value of ■ \xd7 ▲ + ●?',
        hints:['Look up each symbol\'s value in the codebook','■=3, ▲=5, ●=7','3 \xd7 5 + 7 = 15 + 7 = ?']
      },
      {
        title:'Fibonacci Field', badge:'LEVEL 05 · Nature Sequence',
        story:'The Fibonacci sequence appears everywhere in nature! Each number is the sum of the two before it.',
        type:'sequence', seq:[1,1,2,3,5,8], answer:13,
        question:'What is the next Fibonacci number?',
        hints:['Each number = sum of the two numbers before it','3 + 5 = 8, and 5 + 8 = ?','The answer is 13']
      },
      {
        title:'Cross Sum Matrix', badge:'LEVEL 06 · Sum Grid',
        story:'In this matrix every row sums to exactly 20. What is the missing value?',
        type:'grid-sum',
        grid:[[8,5,4,3],[2,7,6,5],[4,3,8,5],[6,5,2,null]],
        rowSum:20,
        answer:7,
        question:'What value makes the last row sum to 20?',
        hints:['Each row must total exactly 20','Add up the known values in the last row: 6 + 5 + 2 = 13','20 − 13 = ?']
      }
    ],
    '13': [
      {
        title:'Binary Decode', badge:'LEVEL 01 · Binary Lab',
        story:'Computers think in binary! Convert this binary number to its decimal equivalent.',
        type:'binary',
        binary:'1101',
        answer:13,
        question:'What is 1101₂ in decimal?',
        hints:['Binary positions from right: 1, 2, 4, 8','1×8 + 1×4 + 0×2 + 1×1','8 + 4 + 0 + 1 = ?']
      },
      {
        title:'Power Sequence', badge:'LEVEL 02 · Formula Core',
        story:'A hidden mathematical formula generates this sequence. Decode the pattern and predict the next value!',
        type:'sequence', seq:[2,5,10,17,26], answer:37,
        question:'What is the next number in this sequence?',
        hints:['Try computing n² + 1 for n = 1, 2, 3...','1²+1=2, 2²+1=5, 3²+1=10, 4²+1=17, 5²+1=26','n=6: 6² + 1 = 36 + 1 = ?']
      },
      {
        title:'Mod Matrix', badge:'LEVEL 03 · Modular Grid',
        story:'Each cell equals (row × column) mod 7. Modular arithmetic is the key!',
        type:'grid-mod',
        grid:[[1,2,3],[2,4,6],[3,6,null]],
        mod:7,
        answer:2,
        question:'What is (3 \xd7 3) mod 7?',
        hints:['Modulo = remainder after integer division','3 \xd7 3 = 9','9 mod 7: 9 \xf7 7 = 1 remainder ?']
      },
      {
        title:'Variable Grid', badge:'LEVEL 04 · Symbol Algebra',
        story:'Decode the symbol values from the equations — then evaluate the expression!',
        type:'cipher-algebra',
        eqs:['■ + ■ = 12', '■ + ▲ = 9'],
        expr:'▲ × ▲ + ■',
        answer:15,
        question:'What is ▲ \xd7 ▲ + ■?',
        hints:['From ■ + ■ = 12, divide by 2 to find ■','■ = 6. Substitute into ■ + ▲ = 9: ▲ = 3','▲² + ■ = 9 + 6 = ?']
      },
      {
        title:'Alternating Cipher', badge:'LEVEL 05 · Double Sequence',
        story:'This sequence hides a powerful formula. Each value is derived from the previous by a simple rule.',
        type:'sequence', seq:[3,7,15,31,63], answer:127,
        question:'What is the next number in the sequence?',
        hints:['Try doubling each number and adding 1','3×2+1=7, 7×2+1=15, 15×2+1=31, 31×2+1=63','63 \xd7 2 + 1 = ?']
      },
      {
        title:'Magic Square', badge:'LEVEL 06 · Final Cipher',
        story:'In a magic square every row, column, and diagonal sums to the same number. Find the missing value!',
        type:'magic-square',
        grid:[[2,7,6],[9,5,1],[4,3,null]],
        magicSum:15,
        answer:8,
        question:'What value completes the magic square?',
        hints:['Every row, column and diagonal must sum to 15','The third row: 4 + 3 + ? = 15','4 + 3 = 7, so ? = 8. Verify: column 3 is 6+1+8=15 ✓']
      }
    ]
  };

  // ══ STATE ══════════════════════════════════════════════════════════════
  let _root, _kh;

  function defSt() {
    return { age: null, level: 0, score: 0, streak: 0, totalHints: 0, startTime: null, bests: {} };
  }

  let _st = defSt();

  function loadSt() {
    try { const s = JSON.parse(localStorage.getItem('cg-st')); if (s) _st = { ...defSt(), ...s }; } catch {}
  }

  function saveSt() {
    try { localStorage.setItem('cg-st', JSON.stringify(_st)); } catch {}
  }

  // ══ ENTRY POINT ════════════════════════════════════════════════════
  function init(root) {
    _root = root;
    if (!root) return;
    injectCSS();
    loadSt();
    showMenu();
  }

  // ══ MENU ════════════════════════════════════════════════════════════
  function showMenu() {
    const bestStr = Object.keys(_st.bests).length
      ? '💾 Best: ' + Object.entries(_st.bests).map(([a, v]) => ({ 7: 'Explorer', 10: 'Scientist', 13: 'Genius' }[a] + ': ' + v + 'pts')).join(' | ')
      : '';
    _root.innerHTML = `
<div class="game-card cg-wrap" style="padding:0" id="cg-root">
  <div class="cg-grid-bg"></div>
  <div class="cg-cx tl"></div><div class="cg-cx tr"></div>
  <div class="cg-cx bl"></div><div class="cg-cx br"></div>
  <div class="cg-inner">
    <div class="cg-menu">
      <div class="cg-logo-em">🔷</div>
      <div class="cg-logo-t">Cipher Grid</div>
      <div class="cg-logo-s">Code-Breaking Mystery</div>
      <div class="cg-age-lbl">Choose your difficulty</div>
      <div class="cg-ages">
        <button class="cg-ab" data-age="7">
          <span class="cg-ab-em">🌟</span>
          <div class="cg-ab-info">
            <div class="cg-ab-name">Ages 7–9 · Decoder</div>
            <div class="cg-ab-desc">Sequences, patterns, sum grids</div>
          </div>
          <span class="cg-ab-arr">▶</span>
        </button>
        <button class="cg-ab" data-age="10">
          <span class="cg-ab-em">🔬</span>
          <div class="cg-ab-info">
            <div class="cg-ab-name">Ages 10–12 · Analyst</div>
            <div class="cg-ab-desc">Primes, symbol ciphers, logic grids</div>
          </div>
          <span class="cg-ab-arr">▶</span>
        </button>
        <button class="cg-ab" data-age="13">
          <span class="cg-ab-em">🚀</span>
          <div class="cg-ab-info">
            <div class="cg-ab-name">Ages 13+ · Cryptographer</div>
            <div class="cg-ab-desc">Binary, modular math, algebra ciphers</div>
          </div>
          <span class="cg-ab-arr">▶</span>
        </button>
      </div>
      ${bestStr ? `<div class="cg-bests">${bestStr}</div>` : ''}
    </div>
  </div>
</div>`;
    _root.querySelectorAll('.cg-ab').forEach(b => b.addEventListener('click', () => startGame(b.dataset.age)));
  }

  // ══ START GAME ════════════════════════════════════════════════════
  function startGame(age) {
    _st = { ...defSt(), bests: _st.bests };
    _st.age = age;
    _st.startTime = Date.now();
    saveSt();
    showLevel(0);
  }

  // ══ SHOW LEVEL ════════════════════════════════════════════════════
  function showLevel(idx) {
    cleanKH();
    _st.level = idx;
    saveSt();

    const levels = LEVELS[_st.age];
    const level = levels[idx];
    let hintsLeft = 3, hintIdx = 0, localHints = 0, localAttempts = 0;

    const streakDisplay = _st.streak >= 2 ? `🔥 ${_st.streak}×` : '';

    _root.innerHTML = `
<div class="game-card cg-wrap" style="padding:0" id="cg-root">
  <div class="cg-grid-bg"></div>
  <div class="cg-cx tl"></div><div class="cg-cx tr"></div>
  <div class="cg-cx bl"></div><div class="cg-cx br"></div>
  <div class="cg-inner">
    <div class="cg-game-layout">
      <div class="cg-ghdr">
        <div class="cg-prog" id="cg-prog"></div>
        <div class="cg-score-area">
          <div class="cg-sc">◆ <span id="cg-sc-val">${_st.score}</span></div>
          <div class="cg-streak ${_st.streak >= 2 ? 'on' : ''}" id="cg-streak">${streakDisplay}</div>
        </div>
        <button class="cg-hbtn" id="cg-hbtn">💡 Hint (${hintsLeft})</button>
      </div>
      <div class="cg-panel" id="cg-panel">
        <div class="cg-bdg">${level.badge}</div>
        <div class="cg-story">${level.story}</div>
        <div class="cg-puz">${vizHTML(level)}</div>
        <div class="cg-qq">${level.question}</div>
        <div class="cg-ia">${inputHTML(level)}</div>
        <div class="cg-fb" id="cg-fb"></div>
        <div class="cg-hint" id="cg-hint"><div class="cg-ht">💡 Hint</div><div id="cg-hint-txt"></div></div>
      </div>
    </div>
  </div>
</div>`;

    // Progress dots
    const prog = _root.querySelector('#cg-prog');
    prog.innerHTML = levels.map((_, i) => `<div class="cg-d ${i < idx ? 'dn' : i === idx ? 'cr' : ''}"></div>`).join('');

    // Hint button
    const hbtn = _root.querySelector('#cg-hbtn');
    const hintEl = _root.querySelector('#cg-hint');
    const hintTxt = _root.querySelector('#cg-hint-txt');
    hbtn.addEventListener('click', () => {
      if (hintsLeft <= 0) return;
      hintsLeft--;
      localHints++;
      _st.totalHints = (_st.totalHints || 0) + 1;
      _st.streak = 0;
      hintTxt.textContent = level.hints[Math.min(hintIdx, level.hints.length - 1)];
      hintIdx++;
      hintEl.classList.add('on');
      hbtn.textContent = `💡 Hint (${hintsLeft})`;
      if (hintsLeft === 0) hbtn.disabled = true;
      updateStreakDisplay();
    });

    function updateStreakDisplay() {
      const el = _root.querySelector('#cg-streak');
      if (!el) return;
      if (_st.streak >= 2) { el.textContent = `🔥 ${_st.streak}×`; el.classList.add('on'); }
      else { el.classList.remove('on'); }
    }

    // Answer callback
    function tryAns(val) {
      localAttempts++;
      const isCorrect = (level.type === 'choice-emoji') ? (val === level.answer) : (+val === level.answer);
      if (isCorrect) {
        _st.streak++;
        const mult = Math.min(_st.streak, 3);
        const pts = Math.max(10, (150 - localHints * 25 - (localAttempts - 1) * 12) * mult);
        _st.score += pts;
        saveSt();
        showSuccess(level, pts, mult);
      } else {
        _st.streak = 0;
        updateStreakDisplay();
        const fb = _root.querySelector('#cg-fb');
        fb.textContent = '✖ Incorrect — Analyse the pattern again!';
        fb.className = 'cg-fb err';
        const panel = _root.querySelector('#cg-panel');
        panel?.classList.add('cg-shk');
        setTimeout(() => { panel?.classList.remove('cg-shk'); fb.className = 'cg-fb'; fb.textContent = ''; }, 800);
      }
    }

    if (level.type === 'choice-emoji') wireChoices(level, tryAns);
    else wireKP(tryAns);
  }

  // ══ VISUAL HTML ════════════════════════════════════════════════════
  function vizHTML(level) {
    switch (level.type) {
      case 'sequence': {
        const nums = level.seq.map((n, i) =>
          `<span class="cg-sn" style="animation-delay:${i * 80}ms">${n}</span><span class="cg-sa">→</span>`).join('');
        return `<div class="cg-seqv">${nums}<span class="cg-sq">?</span></div>`;
      }
      case 'choice-emoji': {
        const pattern = level.pattern.map(s => `<span style="font-size:1.3rem">${s}</span>`).join('<span style="color:#334155;font-size:.75rem;margin:0 .15rem">→</span>');
        return `<div style="display:flex;align-items:center;gap:.25rem;flex-wrap:wrap;justify-content:center">${pattern}<span style="color:#64748b;margin:0 .2rem">→</span><span style="font-size:1.3rem;border:2px dashed rgba(6,182,212,.4);border-radius:6px;padding:.15rem .4rem;color:#22d3ee;animation:cg-sqp .9s ease-in-out infinite alternate">?</span></div>`;
      }
      case 'grid-sum': {
        const rows = level.grid.map(row => {
          const cells = row.map(v => `<div class="cg-cell ${v === null ? 'miss' : ''}">${v === null ? '?' : v}</div>`).join('');
          return `<div class="cg-grid-row-v">${cells}<div class="cg-cell sum">= ${level.rowSum}</div></div>`;
        }).join('');
        return `<div class="cg-grid-vis">${rows}</div><div style="font-size:.68rem;color:#64748b;margin-top:.3rem">Every row sums to ${level.rowSum}</div>`;
      }
      case 'grid-mul': {
        const rows = level.grid.map((row, ri) => {
          const cells = row.map((v, ci) => `<div class="cg-cell ${v === null ? 'miss' : ''}" style="animation-delay:${(ri*row.length+ci)*40}ms">${v === null ? '?' : v}</div>`).join('');
          return `<div class="cg-grid-row-v">${cells}</div>`;
        }).join('');
        return `<div class="cg-grid-vis">${rows}</div><div style="font-size:.68rem;color:#64748b;margin-top:.3rem">Rule: cell = row × column</div>`;
      }
      case 'grid-mod': {
        const rows = level.grid.map((row, ri) => {
          const cells = row.map((v, ci) => `<div class="cg-cell ${v === null ? 'miss' : ''}" style="animation-delay:${(ri*row.length+ci)*40}ms">${v === null ? '?' : v}</div>`).join('');
          return `<div class="cg-grid-row-v">${cells}</div>`;
        }).join('');
        return `<div class="cg-grid-vis">${rows}</div><div style="font-size:.68rem;color:#64748b;margin-top:.3rem">Rule: cell = (row \xd7 col) mod ${level.mod}</div>`;
      }
      case 'cipher': {
        const defs = Object.entries(level.defs).map(([k, v]) =>
          `<div class="cg-sym-def"><span class="cg-sym-key">${k}</span><span class="cg-sym-eq"> = </span><span class="cg-sym-val">${v}</span></div>`).join('');
        return `<div class="cg-cipher-wrap">
          <div style="font-size:.66rem;color:#64748b;margin-bottom:.15rem">Codebook:</div>
          <div class="cg-codebook">${defs}</div>
          <div class="cg-cipher-divider"></div>
          <div class="cg-cipher-expr">${level.expr} = <span style="color:#22d3ee">?</span></div>
        </div>`;
      }
      case 'cipher-algebra': {
        const eqs = level.eqs.map(eq => `<div style="color:#a78bfa;font-family:var(--font-mono);font-size:.95rem">${eq}</div>`).join('');
        return `<div class="cg-cipher-wrap">
          <div style="font-size:.66rem;color:#64748b;margin-bottom:.15rem">Find the symbol values:</div>
          <div class="cg-codebook" style="flex-direction:column;align-items:center;gap:.3rem">${eqs}</div>
          <div class="cg-cipher-divider"></div>
          <div class="cg-cipher-expr">${level.expr} = <span style="color:#22d3ee">?</span></div>
        </div>`;
      }
      case 'binary': {
        const bits = level.binary.split('').map((b, i) =>
          `<div class="cg-bit ${b === '1' ? 'b1' : ''}" style="animation-delay:${i * 80}ms">${b}</div>`).join('');
        const positions = level.binary.split('').map((_, i) => {
          const pos = Math.pow(2, level.binary.length - 1 - i);
          return `<div class="cg-bpos">${pos}</div>`;
        }).join('');
        return `<div class="cg-bin-wrap">
          <div style="font-size:.68rem;color:#64748b">Binary number (base 2):</div>
          <div class="cg-bin-bits">${bits}</div>
          <div class="cg-bit-pos">${positions}</div>
          <div style="font-size:.68rem;color:#64748b">↑ position values (powers of 2)</div>
        </div>`;
      }
      case 'magic-square': {
        const rows = level.grid.map((row, ri) => {
          const cells = row.map((v, ci) => `<div class="cg-cell ${v === null ? 'miss' : ''}" style="animation-delay:${(ri*row.length+ci)*45}ms">${v === null ? '?' : v}</div>`).join('');
          return `<div class="cg-grid-row-v">${cells}</div>`;
        }).join('');
        return `<div class="cg-magic-wrap">
          <div class="cg-grid-vis">${rows}</div>
          <div class="cg-magic-info">Every row, column and diagonal sums to <strong style="color:#22d3ee">${level.magicSum}</strong></div>
        </div>`;
      }
      default:
        return `<div style="font-size:1.1rem;color:#22d3ee;font-family:var(--font-mono)">${level.question}</div>`;
    }
  }

  // ══ INPUT HTML ═════════════════════════════════════════════════════
  function inputHTML(level) {
    if (level.type === 'choice-emoji') {
      return `<div class="cg-chs">${level.choices.map(c => `<button class="cg-ch" data-v="${c}">${c}</button>`).join('')}</div>`;
    }
    return `<div class="cg-kd" id="cg-kd">_</div>
<div class="cg-kp">
  ${[7,8,9,4,5,6,1,2,3].map(n => `<button class="cg-kk" data-k="${n}">${n}</button>`).join('')}
  <button class="cg-kk kd" data-k="del">⌫</button>
  <button class="cg-kk" data-k="0">0</button>
  <button class="cg-kk ke" data-k="ok">ENTER</button>
</div>`;
  }

  // ══ KEYPAD WIRING ══════════════════════════════════════════════════
  function wireKP(onAnswer) {
    let val = '';
    const disp = _root.querySelector('#cg-kd');

    function press(k) {
      if (k === 'del') { val = val.slice(0, -1); disp.textContent = val || '_'; }
      else if (k === 'ok') { if (!val) return; onAnswer(+val); val = ''; disp.textContent = '_'; }
      else if (val.length < 6) { val += k; disp.textContent = val; }
    }

    _root.querySelector('.cg-kp')?.addEventListener('click', e => {
      const k = e.target.closest('.cg-kk')?.dataset.k;
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

  // ══ CHOICE WIRING ══════════════════════════════════════════════════
  function wireChoices(level, onAnswer) {
    _root.querySelector('.cg-chs')?.addEventListener('click', e => {
      const btn = e.target.closest('.cg-ch');
      if (!btn || btn.disabled) return;
      const v = btn.dataset.v;
      _root.querySelectorAll('.cg-ch').forEach(b => b.disabled = true);
      if (v === level.answer) {
        btn.classList.add('cok');
        setTimeout(() => onAnswer(v), 350);
      } else {
        btn.classList.add('cbad');
        setTimeout(() => {
          btn.classList.remove('cbad');
          _root.querySelectorAll('.cg-ch').forEach(b => b.disabled = false);
          onAnswer(v);
        }, 400);
      }
    });
  }

  // ══ SUCCESS OVERLAY ════════════════════════════════════════════════
  function showSuccess(level, pts, mult) {
    const levels = LEVELS[_st.age];
    const isLast = _st.level >= levels.length - 1;
    const multMsg = mult >= 2 ? ` 🔥 ${mult}× streak bonus!` : '';

    const ov = document.createElement('div');
    ov.className = 'cg-ov';
    ov.innerHTML = `
      <div class="cg-ov-em">${isLast ? '🏆' : '✅'}</div>
      <div class="cg-ov-t">${isLast ? 'Grid Decoded!' : 'Code Cracked!'}</div>
      <div class="cg-ov-s">${isLast ? 'You decoded all 6 cipher levels!' : 'Excellent analysis! The pattern is revealed.'}${multMsg}</div>
      <div class="cg-ov-p">+${pts} pts</div>
      <button class="cg-cntbtn" id="cg-cnt">${isLast ? '🏆 See Results' : 'Next Level →'}</button>`;

    _root.querySelector('#cg-root')?.appendChild(ov);
    spawnParts();

    ov.querySelector('#cg-cnt').addEventListener('click', () => {
      if (isLast) showComplete();
      else { cleanKH(); showLevel(_st.level + 1); }
    });
  }

  // ══ COMPLETE SCREEN ════════════════════════════════════════════════
  function showComplete() {
    const elapsed = Math.round((Date.now() - _st.startTime) / 1000);
    const m = Math.floor(elapsed / 60), sc = elapsed % 60;
    const tStr = m > 0 ? `${m}m ${sc}s` : `${sc}s`;
    const lbl = { 7: 'Decoder', 10: 'Analyst', 13: 'Cryptographer' }[_st.age];
    if (!_st.bests[_st.age] || _st.score > _st.bests[_st.age]) _st.bests[_st.age] = _st.score;
    saveSt();

    _root.innerHTML = `
<div class="game-card cg-wrap" style="padding:0" id="cg-root">
  <div class="cg-grid-bg"></div>
  <div class="cg-cx tl"></div><div class="cg-cx tr"></div>
  <div class="cg-cx bl"></div><div class="cg-cx br"></div>
  <div class="cg-inner">
    <div class="cg-fin">
      <div class="cg-trph">🔷</div>
      <div class="cg-ft">Grid Decoded!</div>
      <div class="cg-fs">Elite <strong style="color:#22d3ee">${lbl}</strong> status achieved!<br>All 6 cipher puzzles cracked. The grid is yours.</div>
      <div class="cg-stts">
        <div class="cg-st"><span class="cg-stv">${_st.score}</span><span class="cg-stl">Score</span></div>
        <div class="cg-st"><span class="cg-stv">${tStr}</span><span class="cg-stl">Time</span></div>
        <div class="cg-st"><span class="cg-stv">${_st.totalHints}</span><span class="cg-stl">Hints</span></div>
      </div>
      <button class="cg-rabtn" id="cg-ra">🔄 Play Again</button>
    </div>
  </div>
</div>`;
    spawnParts();
    _root.querySelector('#cg-ra').addEventListener('click', () => { cleanKH(); showMenu(); });
  }

  // ══ PARTICLES ════════════════════════════════════════════════════
  function spawnParts() {
    const c = _root.querySelector('#cg-root') || _root.querySelector('.cg-wrap');
    if (!c) return;
    const cols = ['#22d3ee', '#60a5fa', '#fbbf24', '#a855f7', '#34d399'];
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'cg-pt';
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

  // ══ CLEANUP ════════════════════════════════════════════════════════
  function cleanKH() {
    if (_kh) { document.removeEventListener('keydown', _kh); _kh = null; }
  }

  return { init };
})();
