const ToolsPage = (function () {
  'use strict';

  // ── Audio ──────────────────────────────────────────────────────────
  function beep(freq, dur, vol=0.35, type='sine') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = type;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  function playDone() { beep(523,.15); setTimeout(()=>beep(659,.15),160); setTimeout(()=>beep(784,.4),320); }
  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const prev = btn.textContent; btn.textContent = '✓';
      btn.classList.add('ok'); setTimeout(() => { btn.textContent = prev; btn.classList.remove('ok'); }, 1500);
    }).catch(() => {});
  }

  // ── Tool registry ──────────────────────────────────────────────────
  const TOOLS = [
    { id:'countdown', cat:'time',  icon:'⏳', label:'Temporizador' },
    { id:'stopwatch', cat:'time',  icon:'⏱️', label:'Cronómetro' },
    { id:'pomodoro',  cat:'time',  icon:'🍅', label:'Pomodoro' },
    { id:'age',       cat:'time',  icon:'🎂', label:'Calc. de Idades' },
    { id:'json',      cat:'text',  icon:'{ }', label:'JSON' },
    { id:'base64',    cat:'text',  icon:'⌗', label:'Base64' },
    { id:'markdown',  cat:'text',  icon:'M↓', label:'Markdown' },
    { id:'sort',      cat:'text',  icon:'↕', label:'Ordenar Linhas' },
    { id:'diff',      cat:'text',  icon:'⬌', label:'Diff' },
    { id:'regex',     cat:'dev',   icon:'.*', label:'Regex' },
    { id:'uuid',      cat:'dev',   icon:'#', label:'UUID' },
    { id:'timestamp', cat:'dev',   icon:'🕐', label:'Timestamp' },
    { id:'calculator',cat:'math',  icon:'🔢', label:'Calculadora' },
    { id:'percentage',cat:'math',  icon:'%', label:'Percentagem' },
    { id:'unitconv',  cat:'math',  icon:'⟷', label:'Conversor' },
    { id:'colors',    cat:'fun',   icon:'🎨', label:'Paleta de Cores' },
    { id:'dice',      cat:'fun',   icon:'🎲', label:'Dados' },
    { id:'coin',      cat:'fun',   icon:'🪙', label:'Moeda' },
  ];
  const CAT_LABELS = { time:'⏱ Tempo & Datas', text:'📝 Texto', dev:'💻 Dev & Código', math:'🔢 Cálculo', fun:'🎲 Diversão' };
  const CATS = ['time','text','dev','math','fun'];

  // ── State ──────────────────────────────────────────────────────────
  let _built = false;
  let _activeTool = 'countdown';
  const _cache = {};

  // ============================================================
  // COUNTDOWN
  // ============================================================
  const CIRC = 2 * Math.PI * 54;
  let cdTotal=300, cdRemaining=300, cdState='idle', cdInterval, cdMode='circle', cdColor='#3b82f6', cdSound=true, _cdAborted=false;

  function fmtTime(s) {
    const m = Math.floor(Math.abs(s)/60);
    return `${m.toString().padStart(2,'0')}:${(Math.abs(s)%60).toString().padStart(2,'0')}`;
  }

  function initCountdown(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">⏳ Temporizador</div>
        <div class="tool-opts-row">
          <div class="tool-opts-grp">
            <span class="tool-opts-lbl">Visual</span>
            <div class="tool-seg" id="cd-mode-seg">
              <button class="tsb active" data-mode="circle">🔵 Círculo</button>
              <button class="tsb" data-mode="hourglass">⌛ Ampulheta</button>
            </div>
          </div>
          <div class="tool-opts-grp">
            <span class="tool-opts-lbl">Cor</span>
            <div class="tool-colors" id="cd-colors">
              ${['#3b82f6','#10b981','#ef4444','#a855f7','#f97316'].map((c,i)=>
                `<button class="tcol${i===0?' active':''}" data-c="${c}" style="--tc:${c}"></button>`).join('')}
            </div>
          </div>
          <div class="tool-opts-grp">
            <span class="tool-opts-lbl">Som</span>
            <button class="tool-sound active" id="cd-sound">🔔</button>
          </div>
        </div>
        <div class="cd-presets">
          ${[['1','1 min'],['5','5 min'],['10','10 min'],['25','25 ⏱'],['30','30 min'],['60','1h']].map(([v,l])=>
            `<button class="cdp" data-m="${v}">${l}</button>`).join('')}
        </div>
        <div class="cd-custom-row">
          <input class="cd-inp" id="cd-min" type="number" min="0" max="99" value="5">
          <span class="cd-sep">:</span>
          <input class="cd-inp" id="cd-sec" type="number" min="0" max="59" value="0">
          <button class="cd-set-btn" id="cd-set">Definir</button>
        </div>
        <div class="cd-visual" id="cd-visual">
          <div class="cd-circle-wrap" id="cd-cw">
            <svg class="cd-ring" viewBox="0 0 120 120">
              <circle class="cd-ring-bg" cx="60" cy="60" r="54"/>
              <circle class="cd-ring-fill" id="cd-fill" cx="60" cy="60" r="54" stroke="${cdColor}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
            </svg>
            <div class="cd-ring-inner">
              <div class="cd-time-big" id="cd-disp">05:00</div>
              <div class="cd-time-pct" id="cd-pct">100%</div>
            </div>
          </div>
          <div class="cd-hg-wrap" id="cd-hw" style="display:none">
            <svg class="cd-hg-svg" id="cd-hg-svg" viewBox="0 0 100 220" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hg-gt" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stop-color="${cdColor}" stop-opacity="1" id="hg-gt0"/>
                  <stop offset="100%" stop-color="${cdColor}" stop-opacity="0.4" id="hg-gt1"/>
                </linearGradient>
                <linearGradient id="hg-gb" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stop-color="${cdColor}" stop-opacity="0.5" id="hg-gb0"/>
                  <stop offset="100%" stop-color="${cdColor}" stop-opacity="1" id="hg-gb1"/>
                </linearGradient>
                <filter id="hg-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <polygon points="5,12 95,12 50,110" fill="rgba(148,163,184,.04)"/>
              <polygon points="5,208 95,208 50,110" fill="rgba(148,163,184,.03)"/>
              <line x1="5" y1="12" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="95" y1="12" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="5" y1="208" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="95" y1="208" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>
              <polygon id="cd-sand-top" points="5,12 95,12 50,110" fill="url(#hg-gt)" filter="url(#hg-glow)"/>
              <polygon id="cd-sand-bot" points="50,208 50,208 50,208" fill="url(#hg-gb)" filter="url(#hg-glow)"/>
              <circle cx="50" cy="110" r="5" fill="${cdColor}" opacity=".45" class="hg-fc"/>
              <circle cx="50" cy="113" r="2.4" fill="${cdColor}" class="hg-fc">
                <animate attributeName="cy" from="113" to="204" dur="1.5s" begin="-0.0s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;0.85;0" keyTimes="0;0.06;0.72;1" dur="1.5s" begin="-0.0s" repeatCount="indefinite"/>
              </circle>
              <circle cx="50" cy="113" r="2" fill="${cdColor}" class="hg-fc">
                <animate attributeName="cy" from="113" to="204" dur="1.5s" begin="-0.75s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;0.85;0" keyTimes="0;0.06;0.72;1" dur="1.5s" begin="-0.75s" repeatCount="indefinite"/>
              </circle>
              <rect x="2" y="2" width="96" height="12" rx="6" fill="rgba(200,220,255,.15)" stroke="rgba(200,220,255,.2)" stroke-width=".7"/>
              <rect x="2" y="206" width="96" height="12" rx="6" fill="rgba(148,163,184,.15)" stroke="rgba(200,220,255,.15)" stroke-width=".7"/>
            </svg>
            <div class="cd-time-big" id="cd-hg-disp" style="margin-top:.8rem">05:00</div>
          </div>
        </div>
        <div class="cd-done-msg" id="cd-done" style="display:none">⏰ Tempo esgotado!</div>
        <div class="cd-controls">
          <button class="tool-btn" id="cd-start">▶ Iniciar</button>
          <button class="tool-btn tool-btn-sec" id="cd-pause" style="display:none">⏸ Pausar</button>
          <button class="tool-btn tool-btn-sec" id="cd-reset">↺ Repor</button>
        </div>
      </div>`;

    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      cdMode = b.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      root.querySelector('#cd-cw').style.display = cdMode==='circle' ? '' : 'none';
      root.querySelector('#cd-hw').style.display = cdMode==='hourglass' ? '' : 'none';
    }));
    root.querySelectorAll('.tcol').forEach(b => b.addEventListener('click', () => {
      cdColor = b.dataset.c;
      root.querySelectorAll('.tcol').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const fill = root.querySelector('#cd-fill'); if (fill) fill.style.stroke = cdColor;
      ['#hg-gt0','#hg-gt1','#hg-gb0','#hg-gb1'].forEach(id => { const s = root.querySelector(id); if (s) s.setAttribute('stop-color', cdColor); });
      root.querySelectorAll('.hg-fc').forEach(g => g.setAttribute('fill', cdColor));
    }));
    const sBtn = root.querySelector('#cd-sound');
    sBtn.addEventListener('click', () => { cdSound = !cdSound; sBtn.classList.toggle('active', cdSound); sBtn.textContent = cdSound ? '🔔' : '🔕'; });
    root.querySelectorAll('.cdp').forEach(b => b.addEventListener('click', () => { root.querySelector('#cd-min').value = b.dataset.m; root.querySelector('#cd-sec').value = 0; setCD(root); }));
    root.querySelector('#cd-set').addEventListener('click', () => setCD(root));
    root.querySelector('#cd-start').addEventListener('click', () => runCD(root));
    root.querySelector('#cd-pause').addEventListener('click', () => pauseCD(root));
    root.querySelector('#cd-reset').addEventListener('click', () => resetCD(root));
    setCD(root);
    setTimeout(() => { root.querySelector('#cd-hg-svg')?.pauseAnimations?.(); }, 0);
  }

  function setCD(root) {
    clearInterval(cdInterval); cdState='idle'; _cdAborted=true;
    const m = Math.max(0,Math.min(99,parseInt(root.querySelector('#cd-min').value)||0));
    const s = Math.max(0,Math.min(59,parseInt(root.querySelector('#cd-sec').value)||0));
    cdTotal = cdRemaining = m*60+s; renderCdDisplay(root);
    root.querySelector('#cd-start').style.display=''; root.querySelector('#cd-start').textContent='▶ Iniciar';
    root.querySelector('#cd-pause').style.display='none'; root.querySelector('#cd-done').style.display='none';
    root.querySelector('#cd-visual').classList.remove('cd-flash');
  }
  function runCD(root) {
    if (cdState==='running'||!cdRemaining) return; _cdAborted=false; cdState='running';
    root.querySelector('#cd-start').style.display='none'; root.querySelector('#cd-pause').style.display='';
    root.querySelector('#cd-done').style.display='none';
    cdInterval = setInterval(() => {
      cdRemaining--; renderCdDisplay(root);
      if (cdRemaining<=0) {
        clearInterval(cdInterval); cdState='done';
        root.querySelector('#cd-pause').style.display='none';
        root.querySelector('#cd-start').textContent='▶ Iniciar'; root.querySelector('#cd-start').style.display='';
        root.querySelector('#cd-done').style.display='';
        if (cdSound&&!_cdAborted) playDone();
        root.querySelector('#cd-visual').classList.add('cd-flash');
        setTimeout(() => root.querySelector('#cd-visual')?.classList.remove('cd-flash'),3000);
      }
    },1000);
  }
  function pauseCD(root) {
    clearInterval(cdInterval); cdState='paused'; _cdAborted=true;
    root.querySelector('#cd-pause').style.display='none';
    root.querySelector('#cd-start').textContent='▶ Retomar'; root.querySelector('#cd-start').style.display='';
    updateHgGrains(root);
  }
  function resetCD(root) {
    clearInterval(cdInterval); cdState='idle'; _cdAborted=true;
    cdRemaining=cdTotal; renderCdDisplay(root);
    root.querySelector('#cd-start').textContent='▶ Iniciar'; root.querySelector('#cd-start').style.display='';
    root.querySelector('#cd-pause').style.display='none'; root.querySelector('#cd-done').style.display='none';
    root.querySelector('#cd-visual').classList.remove('cd-flash');
  }
  function updateHgGrains(root) {
    const svg = root.querySelector('#cd-hg-svg'); if (!svg) return;
    const running = cdState==='running' && cdRemaining>0;
    if (running) svg.unpauseAnimations?.(); else svg.pauseAnimations?.();
  }
  function renderCdDisplay(root) {
    const pct = cdTotal>0 ? Math.max(0,cdRemaining/cdTotal) : 0;
    const tStr = fmtTime(cdRemaining);
    const fill = root.querySelector('#cd-fill'); if (fill) fill.style.strokeDashoffset = CIRC*(1-pct);
    const d = root.querySelector('#cd-disp'); if (d) d.textContent = tStr;
    const p = root.querySelector('#cd-pct');  if (p) p.textContent = Math.round(pct*100)+'%';
    const hd = root.querySelector('#cd-hg-disp'); if (hd) hd.textContent = tStr;
    const st = root.querySelector('#cd-sand-top'), sb = root.querySelector('#cd-sand-bot');
    if (st&&sb) {
      const NECK=110,TOP=12,BOT=208,HW=45;
      const topSurfY = TOP+(1-pct)*(NECK-TOP); const tHW = HW*(NECK-topSurfY)/(NECK-TOP);
      st.setAttribute('points', pct<=0 ? '50,110 50,110 50,110' : `${(50-tHW).toFixed(1)},${topSurfY.toFixed(1)} ${(50+tHW).toFixed(1)},${topSurfY.toFixed(1)} 50,110`);
      const botFill=1-pct; const botSurfY=BOT-botFill*(BOT-NECK); const bHW=HW*(botSurfY-NECK)/(BOT-NECK);
      sb.setAttribute('points', botFill<=0 ? '50,208 50,208 50,208' : `${(50-bHW).toFixed(1)},${botSurfY.toFixed(1)} ${(50+bHW).toFixed(1)},${botSurfY.toFixed(1)} 95,208 5,208`);
    }
    updateHgGrains(root);
  }

  // ============================================================
  // STOPWATCH
  // ============================================================
  let swMs=0, swRunning=false, swInterval, swLaps=[];
  function initStopwatch(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">⏱️ Cronómetro</div>
        <div class="sw-display" id="sw-disp">00:00<span class="sw-ms">.00</span></div>
        <div class="cd-controls">
          <button class="tool-btn" id="sw-toggle">▶ Iniciar</button>
          <button class="tool-btn tool-btn-sec" id="sw-lap" style="display:none">🏁 Volta</button>
          <button class="tool-btn tool-btn-sec" id="sw-reset">↺ Repor</button>
        </div>
        <div class="sw-laps" id="sw-laps"></div>
      </div>`;
    root.querySelector('#sw-toggle').addEventListener('click', () => toggleSw(root));
    root.querySelector('#sw-lap').addEventListener('click', () => swLap(root));
    root.querySelector('#sw-reset').addEventListener('click', () => swReset(root));
  }
  function fmtSw(ms) {
    const cs=Math.floor((ms%1000)/10), s=Math.floor(ms/1000)%60, m=Math.floor(ms/60000);
    return { main:`${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`, cs:cs.toString().padStart(2,'0') };
  }
  function toggleSw(root) {
    if (swRunning) {
      clearInterval(swInterval); swRunning=false;
      root.querySelector('#sw-toggle').textContent='▶ Retomar'; root.querySelector('#sw-lap').style.display='none';
    } else {
      const start=Date.now()-swMs; swRunning=true;
      root.querySelector('#sw-toggle').textContent='⏸ Parar'; root.querySelector('#sw-lap').style.display='';
      swInterval=setInterval(() => { swMs=Date.now()-start; const f=fmtSw(swMs); const d=root.querySelector('#sw-disp'); if (d) d.innerHTML=`${f.main}<span class="sw-ms">.${f.cs}</span>`; },33);
    }
  }
  function swLap(root) {
    swLaps.push(swMs);
    const el=root.querySelector('#sw-laps'); if (!el) return;
    el.innerHTML=swLaps.slice().reverse().map((t,ri) => {
      const idx=swLaps.length-1-ri, prev=idx>0?swLaps[idx-1]:0, lap=t-prev;
      const fL=fmtSw(lap),fT=fmtSw(t);
      return `<div class="sw-lap-row"><span class="sw-lap-n">Volta ${idx+1}</span><span class="sw-lap-split">${fL.main}.${fL.cs}</span><span class="sw-lap-total">${fT.main}.${fT.cs}</span></div>`;
    }).join('');
  }
  function swReset(root) {
    clearInterval(swInterval); swRunning=false; swMs=0; swLaps=[];
    root.querySelector('#sw-toggle').textContent='▶ Iniciar'; root.querySelector('#sw-lap').style.display='none';
    const d=root.querySelector('#sw-disp'); if (d) d.innerHTML='00:00<span class="sw-ms">.00</span>';
    const l=root.querySelector('#sw-laps'); if (l) l.innerHTML='';
  }

  // ============================================================
  // POMODORO
  // ============================================================
  const POMO_PHASES = [{name:'Foco',dur:25*60,color:'#6366f1'},{name:'Pausa Curta',dur:5*60,color:'#22c55e'},{name:'Pausa Longa',dur:15*60,color:'#f59e0b'}];
  let pomoPhase=0, pomoRem=POMO_PHASES[0].dur, pomoRunning=false, pomoInterval, pomoCycles=0;
  const POMO_CIRC = 2*Math.PI*68;

  function initPomodoro(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">🍅 Pomodoro</div>
        <div class="pomo-wrap">
          <div class="pomo-ring-wrap">
            <svg class="pomo-ring" viewBox="0 0 150 150">
              <circle class="pomo-ring-bg" cx="75" cy="75" r="68"/>
              <circle class="pomo-ring-fg" id="pomo-fg" cx="75" cy="75" r="68" stroke="${POMO_PHASES[0].color}" stroke-dasharray="${POMO_CIRC}" stroke-dashoffset="0"/>
            </svg>
            <div class="pomo-ring-inner">
              <div class="pomo-time" id="pomo-time">25:00</div>
              <div class="pomo-phase" id="pomo-phase">Foco</div>
            </div>
          </div>
          <div class="pomo-cycles" id="pomo-cycles">
            ${[0,1,2,3].map(i=>`<div class="pomo-dot" data-c="${i}"></div>`).join('')}
          </div>
          <div class="pomo-btns">
            <button class="tool-btn" id="pomo-start">▶ Iniciar</button>
            <button class="tool-btn tool-btn-sec" id="pomo-skip">⏭ Saltar</button>
            <button class="tool-btn tool-btn-sec" id="pomo-reset">↺ Repor</button>
          </div>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:center;margin-top:.4rem">
            ${POMO_PHASES.map((p,i)=>`<button class="tsb" data-pi="${i}" style="border-color:${p.color}30">${p.name}</button>`).join('')}
          </div>
        </div>
      </div>`;
    root.querySelector('#pomo-start').addEventListener('click', () => togglePomo(root));
    root.querySelector('#pomo-skip').addEventListener('click', () => skipPomo(root));
    root.querySelector('#pomo-reset').addEventListener('click', () => resetPomo(root));
    root.querySelectorAll('[data-pi]').forEach(b => b.addEventListener('click', () => {
      clearInterval(pomoInterval); pomoRunning=false; pomoPhase=+b.dataset.pi;
      pomoRem=POMO_PHASES[pomoPhase].dur; renderPomo(root);
      root.querySelector('#pomo-start').textContent='▶ Iniciar';
    }));
    renderPomo(root);
  }
  function togglePomo(root) {
    pomoRunning = !pomoRunning;
    root.querySelector('#pomo-start').textContent = pomoRunning ? '⏸ Pausar' : '▶ Retomar';
    if (pomoRunning) {
      pomoInterval = setInterval(() => {
        pomoRem--;
        if (pomoRem<=0) {
          playDone(); pomoCycles++;
          pomoPhase = pomoCycles%4===0 ? 2 : (pomoPhase===0 ? 1 : 0);
          pomoRem = POMO_PHASES[pomoPhase].dur;
        }
        renderPomo(root);
      },1000);
    } else { clearInterval(pomoInterval); }
  }
  function skipPomo(root) {
    clearInterval(pomoInterval); pomoRunning=false;
    if (pomoPhase===0) { pomoCycles++; pomoPhase=pomoCycles%4===0?2:1; } else { pomoPhase=0; }
    pomoRem=POMO_PHASES[pomoPhase].dur; renderPomo(root);
    root.querySelector('#pomo-start').textContent='▶ Iniciar';
  }
  function resetPomo(root) {
    clearInterval(pomoInterval); pomoRunning=false; pomoPhase=0; pomoRem=POMO_PHASES[0].dur; pomoCycles=0;
    renderPomo(root); root.querySelector('#pomo-start').textContent='▶ Iniciar';
  }
  function renderPomo(root) {
    const ph = POMO_PHASES[pomoPhase];
    const pct = pomoRem/ph.dur;
    root.querySelector('#pomo-time').textContent = fmtTime(pomoRem);
    root.querySelector('#pomo-phase').textContent = ph.name;
    const fg = root.querySelector('#pomo-fg');
    if (fg) { fg.style.stroke=ph.color; fg.style.strokeDashoffset=POMO_CIRC*(1-pct); }
    root.querySelectorAll('.pomo-dot').forEach((d,i) => d.classList.toggle('done', i < pomoCycles%4 + (pomoCycles>=4&&pomoPhase===0?0:0)));
    root.querySelectorAll('[data-pi]').forEach((b,i) => b.classList.toggle('active',i===pomoPhase));
  }

  // ============================================================
  // AGE CALCULATOR
  // ============================================================
  function initAge(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">🎂 Calculadora de Idades</div>
        <div class="t-row">
          <div class="t-group">
            <label class="t-label">Data de nascimento</label>
            <input type="date" class="t-input" id="age-dob">
          </div>
          <div class="t-group">
            <label class="t-label">Data de referência</label>
            <input type="date" class="t-input" id="age-ref">
          </div>
        </div>
        <button class="t-btn" id="age-calc" style="margin-top:.5rem">Calcular</button>
        <div id="age-result" class="age-result" style="display:none"></div>
      </div>`;
    const today = new Date().toISOString().split('T')[0];
    root.querySelector('#age-ref').value = today;
    root.querySelector('#age-calc').addEventListener('click', () => calcAge(root));
  }
  function calcAge(root) {
    const dob = new Date(root.querySelector('#age-dob').value);
    const ref = new Date(root.querySelector('#age-ref').value);
    const res = root.querySelector('#age-result');
    if (isNaN(dob)||isNaN(ref)||dob>=ref) { res.style.display='none'; return; }
    const diffMs = ref-dob;
    const years = ref.getFullYear()-dob.getFullYear() - (ref<new Date(ref.getFullYear(),dob.getMonth(),dob.getDate())?1:0);
    const months = Math.floor(diffMs/(1000*60*60*24*30.4375));
    const days   = Math.floor(diffMs/(1000*60*60*24));
    const hours  = Math.floor(diffMs/(1000*60*60));
    const weeks  = Math.floor(days/7);
    res.style.display='grid';
    res.innerHTML = [
      {v:years, l:'Anos'},{v:months, l:'Meses'},{v:weeks, l:'Semanas'},
      {v:days, l:'Dias'},{v:hours, l:'Horas'},
      {v:Math.floor(diffMs/(1000*60)), l:'Minutos'},
    ].map(x=>`<div class="age-block"><div class="age-block-val">${x.v.toLocaleString()}</div><div class="age-block-lbl">${x.l}</div></div>`).join('');
  }

  // ============================================================
  // JSON FORMATTER
  // ============================================================
  function initJson(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">{ } JSON</div>
        <div class="t-row" style="margin-bottom:.5rem">
          <button class="t-btn" id="json-fmt">Formatar</button>
          <button class="t-btn t-btn-ghost" id="json-min">Minificar</button>
          <button class="t-btn t-btn-ghost" id="json-clr">Limpar</button>
          <button class="t-copy-btn" id="json-cp">Copiar</button>
        </div>
        <label class="t-label">Input JSON</label>
        <textarea class="t-textarea" id="json-in" rows="8" placeholder='{"key": "value"}'></textarea>
        <label class="t-label" style="margin-top:.5rem">Output</label>
        <div class="t-output" id="json-out" style="min-height:120px;max-height:300px;overflow-y:auto"></div>
        <div class="t-result-row"><div id="json-badge"></div></div>
      </div>`;
    const inp = root.querySelector('#json-in'), out = root.querySelector('#json-out');
    root.querySelector('#json-fmt').addEventListener('click', () => {
      try {
        const parsed = JSON.parse(inp.value);
        out.textContent = JSON.stringify(parsed,null,2);
        root.querySelector('#json-badge').innerHTML='<span class="t-badge t-badge-green">✓ Válido</span>';
      } catch(e) { out.textContent=''; root.querySelector('#json-badge').innerHTML=`<span class="t-badge t-badge-red">✕ ${e.message}</span>`; }
    });
    root.querySelector('#json-min').addEventListener('click', () => {
      try { out.textContent=JSON.stringify(JSON.parse(inp.value)); root.querySelector('#json-badge').innerHTML='<span class="t-badge t-badge-green">✓ Minificado</span>'; }
      catch(e) { root.querySelector('#json-badge').innerHTML=`<span class="t-badge t-badge-red">✕ ${e.message}</span>`; }
    });
    root.querySelector('#json-clr').addEventListener('click', () => { inp.value=''; out.textContent=''; root.querySelector('#json-badge').innerHTML=''; });
    root.querySelector('#json-cp').addEventListener('click', () => copyText(out.textContent, root.querySelector('#json-cp')));
  }

  // ============================================================
  // BASE64
  // ============================================================
  function initBase64(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">⌗ Base64</div>
        <label class="t-label">Texto / Base64</label>
        <textarea class="t-textarea" id="b64-in" rows="5" placeholder="Introduz texto ou Base64…"></textarea>
        <div class="t-row" style="margin-top:.5rem;gap:.5rem">
          <button class="t-btn" id="b64-enc">Encode →</button>
          <button class="t-btn t-btn-ghost" id="b64-dec">← Decode</button>
          <button class="t-copy-btn" id="b64-cp">Copiar</button>
        </div>
        <label class="t-label" style="margin-top:.5rem">Output</label>
        <div class="t-output" id="b64-out" style="min-height:80px;max-height:300px;overflow-y:auto"></div>
        <div id="b64-badge" class="t-result-row"></div>
      </div>`;
    const inp=root.querySelector('#b64-in'), out=root.querySelector('#b64-out');
    root.querySelector('#b64-enc').addEventListener('click', () => {
      try { out.textContent=btoa(unescape(encodeURIComponent(inp.value))); root.querySelector('#b64-badge').innerHTML='<span class="t-badge">Encoded</span>'; }
      catch { out.textContent=''; root.querySelector('#b64-badge').innerHTML='<span class="t-badge t-badge-red">Erro</span>'; }
    });
    root.querySelector('#b64-dec').addEventListener('click', () => {
      try { out.textContent=decodeURIComponent(escape(atob(inp.value.trim()))); root.querySelector('#b64-badge').innerHTML='<span class="t-badge">Decoded</span>'; }
      catch { out.textContent=''; root.querySelector('#b64-badge').innerHTML='<span class="t-badge t-badge-red">Base64 inválido</span>'; }
    });
    root.querySelector('#b64-cp').addEventListener('click', () => copyText(out.textContent, root.querySelector('#b64-cp')));
  }

  // ============================================================
  // MARKDOWN PREVIEW
  // ============================================================
  function initMarkdown(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">M↓ Markdown Preview</div>
        <div class="md-preview-wrap">
          <div>
            <label class="t-label">Editor</label>
            <textarea class="t-textarea" id="md-in" rows="16" style="height:320px" placeholder="# Título&#10;&#10;Escreve **Markdown** aqui…"></textarea>
          </div>
          <div>
            <label class="t-label">Preview</label>
            <div class="t-output md-rendered" id="md-out" style="height:320px;overflow-y:auto;padding:.75rem 1rem"></div>
          </div>
        </div>
      </div>`;
    const inp=root.querySelector('#md-in'), out=root.querySelector('#md-out');
    function renderMd() { out.innerHTML=mdToHtml(inp.value); }
    inp.addEventListener('input', renderMd);
    inp.value=`# Bem-vindo ao Markdown Preview\n\nEscreve **negrito**, *itálico*, e \`código inline\`.\n\n## Lista\n- Item 1\n- Item 2\n- Item 3\n\n> Bloco de citação\n\n\`\`\`js\nconsole.log('Hello!');\n\`\`\``;
    renderMd();
  }
  function mdToHtml(md) {
    return md
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g,(_,lang,code)=>`<pre><code class="lang-${lang}">${code.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/^#{3} (.+)$/gm,'<h3>$1</h3>').replace(/^#{2} (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
      .replace(/^---$/gm,'<hr>')
      .replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/(<li>[\s\S]+?<\/li>)(?!\n<li>)/g,'<ul>$&</ul>')
      .replace(/^\d+\. (.+)$/gm,'<li>$1</li>')
      .replace(/\n\n+/g,'</p><p>').replace(/^(?!<[hup]|<li|<pre|<bloc|<hr)/gm,'').replace(/(.+)/g,s=>s.startsWith('<')?s:`<p>${s}</p>`);
  }

  // ============================================================
  // SORT LINES
  // ============================================================
  function initSort(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">↕ Ordenar Linhas</div>
        <label class="t-label">Texto (uma linha por entrada)</label>
        <textarea class="t-textarea" id="sort-in" rows="8" placeholder="banana&#10;apple&#10;cherry"></textarea>
        <div class="sort-opts" style="margin-top:.5rem">
          <button class="sort-btn" data-op="az">A→Z</button>
          <button class="sort-btn" data-op="za">Z→A</button>
          <button class="sort-btn" data-op="num">Numérico</button>
          <button class="sort-btn" data-op="len">Por comprimento</button>
          <button class="sort-btn" data-op="shuffle">Aleatório</button>
          <button class="sort-btn" data-op="dedup">Remover duplicados</button>
          <button class="sort-btn" data-op="trim">Trim</button>
          <button class="sort-btn" data-op="rev">Inverter</button>
        </div>
        <div class="t-row" style="margin-bottom:.5rem;gap:.4rem">
          <label style="font-size:.72rem;color:var(--muted)">Case</label>
          <button class="sort-btn" data-op="upper">UPPER</button>
          <button class="sort-btn" data-op="lower">lower</button>
          <button class="t-copy-btn" id="sort-cp" style="margin-left:auto">Copiar</button>
        </div>
        <label class="t-label">Output</label>
        <div class="t-output sort-result" id="sort-out" style="min-height:100px;max-height:260px;overflow-y:auto"></div>
        <div class="t-result-row"><span id="sort-count" style="font-size:.7rem;color:var(--muted)"></span></div>
      </div>`;
    const inp=root.querySelector('#sort-in'), out=root.querySelector('#sort-out');
    root.querySelectorAll('.sort-btn[data-op]').forEach(b => b.addEventListener('click', () => {
      let lines=inp.value.split('\n');
      switch(b.dataset.op) {
        case 'az': lines.sort((a,z)=>a.localeCompare(z,'pt',{sensitivity:'base'})); break;
        case 'za': lines.sort((a,z)=>z.localeCompare(a,'pt',{sensitivity:'base'})); break;
        case 'num': lines.sort((a,b)=>parseFloat(a)-parseFloat(b)); break;
        case 'len': lines.sort((a,b)=>a.length-b.length); break;
        case 'shuffle': for(let i=lines.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[lines[i],lines[j]]=[lines[j],lines[i]];} break;
        case 'dedup': lines=[...new Set(lines)]; break;
        case 'trim': lines=lines.map(l=>l.trim()); break;
        case 'rev': lines.reverse(); break;
        case 'upper': lines=lines.map(l=>l.toUpperCase()); break;
        case 'lower': lines=lines.map(l=>l.toLowerCase()); break;
      }
      const result=lines.join('\n'); out.textContent=result;
      root.querySelector('#sort-count').textContent=`${lines.length} linha${lines.length!==1?'s':''}`;
    }));
    root.querySelector('#sort-cp').addEventListener('click', () => copyText(out.textContent, root.querySelector('#sort-cp')));
  }

  // ============================================================
  // DIFF CHECKER
  // ============================================================
  function initDiff(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">⬌ Diferenças (Diff)</div>
        <div class="diff-wrap">
          <div>
            <label class="t-label">Texto A (original)</label>
            <textarea class="t-textarea" id="diff-a" rows="10" placeholder="Texto original…"></textarea>
          </div>
          <div>
            <label class="t-label">Texto B (novo)</label>
            <textarea class="t-textarea" id="diff-b" rows="10" placeholder="Texto modificado…"></textarea>
          </div>
        </div>
        <button class="t-btn" id="diff-run" style="margin-top:.5rem">Comparar</button>
        <label class="t-label" style="margin-top:.75rem">Resultado</label>
        <div class="t-output diff-output" id="diff-out" style="min-height:120px;max-height:360px;overflow-y:auto;white-space:pre"></div>
      </div>`;
    root.querySelector('#diff-run').addEventListener('click', () => {
      const aLines=root.querySelector('#diff-a').value.split('\n');
      const bLines=root.querySelector('#diff-b').value.split('\n');
      root.querySelector('#diff-out').innerHTML=computeDiff(aLines,bLines);
    });
  }
  function computeDiff(a,b) {
    const lines=[];
    const m=a.length, n=b.length;
    const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
    const trace=[];
    let i=m,j=n;
    while(i>0||j>0){
      if(i>0&&j>0&&a[i-1]===b[j-1]){trace.unshift({t:'eq',v:a[i-1]});i--;j--;}
      else if(j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])){trace.unshift({t:'add',v:b[j-1]});j--;}
      else{trace.unshift({t:'del',v:a[i-1]});i--;}
    }
    return trace.map(l=>{
      const esc=l.v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if(l.t==='add') return `<span class="diff-add">+ ${esc}</span>`;
      if(l.t==='del') return `<span class="diff-del">- ${esc}</span>`;
      return `  ${esc}`;
    }).join('\n');
  }

  // ============================================================
  // REGEX TESTER
  // ============================================================
  function initRegex(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">.* Regex Tester</div>
        <label class="t-label">Padrão</label>
        <div class="t-row" style="gap:.4rem;margin-bottom:.4rem">
          <input class="t-input" id="rx-pat" placeholder="(\\w+)@(\\w+)" style="font-family:var(--font-mono)">
          <span style="font-size:.7rem;color:var(--muted);align-self:center">/</span>
          <div class="rx-flags">
            ${['g','i','m','s'].map(f=>`<button class="rx-flag-btn ${f==='g'?'on':''}" data-f="${f}">${f}</button>`).join('')}
          </div>
        </div>
        <label class="t-label">Texto de teste</label>
        <textarea class="t-textarea" id="rx-test" rows="6" placeholder="Escreve o texto aqui para testar o padrão…"></textarea>
        <div id="rx-info" class="cs-regex-matches" style="margin-top:.5rem"></div>
        <div id="rx-match-list" class="cs-regex-match-list"></div>
      </div>`;
    let flags='g';
    root.querySelectorAll('.rx-flag-btn').forEach(b=>b.addEventListener('click',()=>{
      b.classList.toggle('on');
      flags=Array.from(root.querySelectorAll('.rx-flag-btn.on')).map(x=>x.dataset.f).join('');
      runRx(root,flags);
    }));
    const pat=root.querySelector('#rx-pat'), test=root.querySelector('#rx-test');
    pat.addEventListener('input',()=>runRx(root,flags));
    test.addEventListener('input',()=>runRx(root,flags));
  }
  function runRx(root,flags) {
    const patVal=root.querySelector('#rx-pat').value;
    const testVal=root.querySelector('#rx-test').value;
    const info=root.querySelector('#rx-info'), ml=root.querySelector('#rx-match-list');
    if (!patVal) { info.innerHTML=''; ml.innerHTML=''; return; }
    try {
      const re=new RegExp(patVal, flags.includes('g')?flags:flags+'g');
      const matches=[...testVal.matchAll(re)];
      info.innerHTML=`<span class="cs-regex-match-count">${matches.length} correspondência${matches.length!==1?'s':''}</span>`;
      ml.innerHTML=matches.slice(0,20).map(m=>`<span class="cs-regex-match-tag">${m[0].replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`).join('');
    } catch(e) {
      info.innerHTML=`<span style="color:var(--red);font-size:.72rem">✕ ${e.message}</span>`;
      ml.innerHTML='';
    }
  }

  // ============================================================
  // UUID GENERATOR
  // ============================================================
  function initUuid(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr"># UUID Generator</div>
        <div class="t-row" style="margin-bottom:.65rem">
          <label class="t-label" style="margin:0;align-self:center">Quantidade:</label>
          <input type="number" class="t-input" id="uuid-n" value="5" min="1" max="50" style="width:80px">
          <button class="t-btn" id="uuid-gen">Gerar</button>
        </div>
        <div id="uuid-list" class="uuid-list"></div>
        <button class="t-btn t-btn-ghost" id="uuid-cp-all" style="margin-top:.5rem">Copiar todos</button>
      </div>`;
    function genUuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
        const r=crypto.getRandomValues(new Uint8Array(1))[0]%16;
        return (c==='x'?r:(r&0x3|0x8)).toString(16);
      });
    }
    function renderUuids() {
      const n=Math.min(50,Math.max(1,+root.querySelector('#uuid-n').value||5));
      const uuids=Array.from({length:n},genUuid);
      root.querySelector('#uuid-list').innerHTML=uuids.map(u=>`
        <div class="uuid-row">
          <span class="uuid-val">${u}</span>
          <button class="t-copy-btn uuid-cp-one">Copiar</button>
        </div>`).join('');
      root.querySelectorAll('.uuid-cp-one').forEach((btn,i)=>btn.addEventListener('click',()=>copyText(uuids[i],btn)));
      root._uuids=uuids;
    }
    root.querySelector('#uuid-gen').addEventListener('click', renderUuids);
    root.querySelector('#uuid-cp-all').addEventListener('click',()=>copyText((root._uuids||[]).join('\n'),root.querySelector('#uuid-cp-all')));
    renderUuids();
  }

  // ============================================================
  // TIMESTAMP CONVERTER
  // ============================================================
  function initTimestamp(root) {
    root.innerHTML = `
      <div class="tool-card">
        <div class="tool-hdr">🕐 Timestamp</div>
        <div class="t-row" style="margin-bottom:.5rem">
          <div class="t-group">
            <label class="t-label">Unix timestamp (ms ou s)</label>
            <input type="number" class="t-input" id="ts-unix" placeholder="ex: 1700000000">
          </div>
          <button class="t-btn" id="ts-from-unix">→ Converter</button>
        </div>
        <div class="ts-results" id="ts-from-res"></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">
        <div class="t-row" style="margin-bottom:.5rem">
          <div class="t-group">
            <label class="t-label">Data e hora</label>
            <input type="datetime-local" class="t-input" id="ts-dt">
          </div>
          <button class="t-btn" id="ts-to-unix">→ Unix</button>
        </div>
        <div id="ts-to-res"></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">
        <div class="t-row">
          <div class="t-group">
            <label class="t-label">Agora</label>
            <div class="ts-block"><div class="ts-block-lbl">Unix (s)</div><div class="ts-block-val" id="ts-now-s"></div></div>
          </div>
          <div class="t-group">
            <div class="ts-block" style="margin-top:1.3rem"><div class="ts-block-lbl">Unix (ms)</div><div class="ts-block-val" id="ts-now-ms"></div></div>
          </div>
          <button class="t-btn t-btn-ghost" id="ts-refresh" style="align-self:flex-end">↺</button>
        </div>
      </div>`;
    function refreshNow() {
      const n=Date.now();
      root.querySelector('#ts-now-s').textContent=Math.floor(n/1000);
      root.querySelector('#ts-now-ms').textContent=n;
    }
    refreshNow();
    root.querySelector('#ts-refresh').addEventListener('click', refreshNow);
    root.querySelector('#ts-from-unix').addEventListener('click', () => {
      let v=parseInt(root.querySelector('#ts-unix').value);
      if(isNaN(v)) return;
      if(v>1e10) v=Math.floor(v); else v*=1000;
      const d=new Date(v);
      const res=root.querySelector('#ts-from-res');
      res.innerHTML=[
        {l:'ISO 8601', v:d.toISOString()},
        {l:'Local', v:d.toLocaleString('pt-PT')},
        {l:'UTC', v:d.toUTCString()},
        {l:'Data', v:d.toLocaleDateString('pt-PT')},
        {l:'Hora', v:d.toLocaleTimeString('pt-PT')},
        {l:'Epoch (ms)', v:v},
      ].map(x=>`<div class="ts-block"><div class="ts-block-lbl">${x.l}</div><div class="ts-block-val">${x.v}</div></div>`).join('');
    });
    root.querySelector('#ts-to-unix').addEventListener('click', () => {
      const v=root.querySelector('#ts-dt').value;
      if(!v) return;
      const d=new Date(v); const ms=d.getTime();
      root.querySelector('#ts-to-res').innerHTML=`
        <div class="ts-results">
          <div class="ts-block"><div class="ts-block-lbl">Unix (s)</div><div class="ts-block-val">${Math.floor(ms/1000)}</div></div>
          <div class="ts-block"><div class="ts-block-lbl">Unix (ms)</div><div class="ts-block-val">${ms}</div></div>
        </div>`;
    });
    const n=new Date(); root.querySelector('#ts-dt').value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}T${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }

  // ============================================================
  // CALCULATOR
  // ============================================================
  function initCalculator(root) {
    let expr='', val='0', hasRes=false;
    root.innerHTML=`
      <div class="tool-card">
        <div class="tool-hdr">🔢 Calculadora</div>
        <div class="calc-wrap">
          <div class="calc-screen">
            <div class="calc-expr" id="calc-expr"></div>
            <div class="calc-val" id="calc-val">0</div>
          </div>
          ${[
            ['C','clr',''],['±','pm',''],['%','pct','op'],['÷','/',  'op'],
            ['7','7',  ''],['8','8',  ''],['9','9',  ''],['×','*',  'op'],
            ['4','4',  ''],['5','5',  ''],['6','6',  ''],['−','-',  'op'],
            ['1','1',  ''],['2','2',  ''],['3','3',  ''],['＋','+', 'op'],
            ['0','0','wide'],['.','.',''],['=','=','eq'],
          ].map(([l,v,cls])=>`<button class="calc-btn ${cls}" data-v="${v}">${l}</button>`).join('')}
        </div>
      </div>`;
    function render() {
      root.querySelector('#calc-val').textContent=val;
      root.querySelector('#calc-expr').textContent=expr;
    }
    root.querySelectorAll('.calc-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const v=btn.dataset.v;
        if(v==='clr'){expr='';val='0';hasRes=false;}
        else if(v==='='){
          try{expr=expr||val;val=String(eval(expr.replace(/×/g,'*').replace(/÷/g,'/')));hasRes=true;expr=val;}
          catch{val='Erro';expr='';}
        }
        else if(v==='pm'){val=val.startsWith('-')?val.slice(1):'-'+val;}
        else if(v==='pct'){val=String(parseFloat(val)/100);}
        else if(['+','-','*','/'].includes(v)){
          if(hasRes){expr=val+v;hasRes=false;}else{expr=(expr||val)+v;}
          val='0';
        }
        else {
          if(v==='.'&&val.includes('.')) return;
          if(hasRes){val=v;expr='';hasRes=false;}
          else{val=val==='0'&&v!=='.'?v:val+v;}
        }
        render();
      });
    });
    document.addEventListener('keydown', function calcKey(e){
      if(!root.closest('#view-tools')?.classList.contains('active')) return;
      const map={'Enter':'=','Backspace':'clr','Escape':'clr'};
      const v=map[e.key]||e.key;
      const btn=root.querySelector(`[data-v="${v}"]`);
      if(btn){e.preventDefault();btn.click();}
    });
  }

  // ============================================================
  // PERCENTAGE CALCULATOR
  // ============================================================
  function initPercentage(root) {
    root.innerHTML=`
      <div class="tool-card">
        <div class="tool-hdr">% Percentagem</div>
        <div class="tool-card" style="margin-bottom:.75rem">
          <div style="font-size:.75rem;font-weight:600;margin-bottom:.65rem;color:var(--muted)">X% de Y =</div>
          <div class="t-row"><input type="number" class="t-input" id="pct-x" placeholder="X %"><span style="align-self:center;color:var(--muted)">% de</span><input type="number" class="t-input" id="pct-y" placeholder="Y"></div>
          <div class="t-result-row"><div class="t-badge" id="pct-r1">—</div></div>
        </div>
        <div class="tool-card" style="margin-bottom:.75rem">
          <div style="font-size:.75rem;font-weight:600;margin-bottom:.65rem;color:var(--muted)">X é qual % de Y?</div>
          <div class="t-row"><input type="number" class="t-input" id="pct-a" placeholder="X"><span style="align-self:center;color:var(--muted)">é</span><span style="align-self:center;font-weight:700;color:var(--accent)" id="pct-r2">—</span><span style="align-self:center;color:var(--muted)">% de</span><input type="number" class="t-input" id="pct-b" placeholder="Y"></div>
        </div>
        <div class="tool-card">
          <div style="font-size:.75rem;font-weight:600;margin-bottom:.65rem;color:var(--muted)">Variação percentual (de X para Y)</div>
          <div class="t-row"><input type="number" class="t-input" id="pct-f" placeholder="De"><input type="number" class="t-input" id="pct-t" placeholder="Para"></div>
          <div class="t-result-row"><div class="t-badge" id="pct-r3">—</div></div>
        </div>
      </div>`;
    function upd() {
      const x=parseFloat(root.querySelector('#pct-x').value), y=parseFloat(root.querySelector('#pct-y').value);
      if(!isNaN(x)&&!isNaN(y)) root.querySelector('#pct-r1').textContent=((x/100)*y).toFixed(4).replace(/\.?0+$/,'');
      const a=parseFloat(root.querySelector('#pct-a').value), b=parseFloat(root.querySelector('#pct-b').value);
      if(!isNaN(a)&&!isNaN(b)&&b!==0) root.querySelector('#pct-r2').textContent=((a/b)*100).toFixed(2)+'%';
      const f=parseFloat(root.querySelector('#pct-f').value), t=parseFloat(root.querySelector('#pct-t').value);
      if(!isNaN(f)&&!isNaN(t)&&f!==0) { const pct=((t-f)/Math.abs(f)*100); root.querySelector('#pct-r3').innerHTML=`<span style="color:${pct>=0?'var(--green)':'var(--red)'}">${pct>=0?'+':''}${pct.toFixed(2)}%</span>`; }
    }
    root.querySelectorAll('input').forEach(i=>i.addEventListener('input',upd));
  }

  // ============================================================
  // UNIT CONVERTER
  // ============================================================
  const UC_CATS = {
    'Comprimento': {base:'m', units:{'mm':0.001,'cm':0.01,'m':1,'km':1000,'in':0.0254,'ft':0.3048,'yd':0.9144,'mi':1609.344,'nmi':1852}},
    'Peso':  {base:'kg', units:{'mg':1e-6,'g':0.001,'kg':1,'t':1000,'lb':0.453592,'oz':0.0283495,'st':6.35029}},
    'Volume':{base:'L',  units:{'mL':0.001,'cL':0.01,'dL':0.1,'L':1,'m³':1000,'fl oz':0.0295735,'cup':0.236588,'pt':0.473176,'qt':0.946353,'gal':3.78541}},
    'Temperatura':{base:'C', units:{'°C':null,'°F':null,'K':null}},
    'Velocidade':{base:'m/s', units:{'m/s':1,'km/h':1/3.6,'mph':0.44704,'knot':0.514444,'ft/s':0.3048}},
    'Área':{base:'m²', units:{'mm²':1e-6,'cm²':1e-4,'m²':1,'km²':1e6,'in²':6.4516e-4,'ft²':0.092903,'ac':4046.86,'ha':10000}},
    'Dados':{base:'B', units:{'B':1,'KB':1024,'MB':1048576,'GB':1073741824,'TB':1099511627776}},
  };
  function initUnitConv(root) {
    let cat='Comprimento';
    root.innerHTML=`
      <div class="tool-card">
        <div class="tool-hdr">⟷ Conversor de Unidades</div>
        <div class="uc-cat-btns" id="uc-cats">
          ${Object.keys(UC_CATS).map(c=>`<button class="uc-cat-btn${c===cat?' active':''}" data-cat="${c}">${c}</button>`).join('')}
        </div>
        <div class="t-row" style="flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem">
          <div class="t-group"><label class="t-label">Valor</label><input type="number" class="t-input" id="uc-val" placeholder="0"></div>
          <div class="t-group"><label class="t-label">De</label><select class="t-input t-select" id="uc-from"></select></div>
          <div class="t-group"><label class="t-label">Para</label><select class="t-input t-select" id="uc-to"></select></div>
        </div>
        <div class="uc-result" id="uc-res">—</div>
      </div>`;
    function populateCat() {
      const units=Object.keys(UC_CATS[cat].units);
      ['uc-from','uc-to'].forEach((id,fi)=>{
        const sel=root.querySelector('#'+id); sel.innerHTML=units.map(u=>`<option>${u}</option>`).join('');
        if(fi===1&&units.length>1) sel.selectedIndex=1;
      });
    }
    function convert() {
      const val=parseFloat(root.querySelector('#uc-val').value);
      const from=root.querySelector('#uc-from').value, to=root.querySelector('#uc-to').value;
      const data=UC_CATS[cat];
      let result;
      if(cat==='Temperatura') {
        let c;
        if(from==='°C') c=val; else if(from==='°F') c=(val-32)*5/9; else c=val-273.15;
        if(to==='°C') result=c; else if(to==='°F') result=c*9/5+32; else result=c+273.15;
      } else {
        result=val*(data.units[from]/data.units[to]);
      }
      root.querySelector('#uc-res').textContent=isNaN(result)?'—':`${result.toLocaleString('pt-PT',{maximumSignificantDigits:8})} ${to}`;
    }
    root.querySelectorAll('.uc-cat-btn').forEach(b=>b.addEventListener('click',()=>{
      cat=b.dataset.cat;
      root.querySelectorAll('.uc-cat-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      populateCat(); convert();
    }));
    root.querySelectorAll('#uc-val,#uc-from,#uc-to').forEach(el=>el.addEventListener('input',convert));
    populateCat();
  }

  // ============================================================
  // COLOR PALETTE
  // ============================================================
  function initColors(root) {
    root.innerHTML=`
      <div class="tool-card">
        <div class="tool-hdr">🎨 Paleta de Cores</div>
        <div class="t-row" style="margin-bottom:.5rem">
          <div class="t-group"><label class="t-label">Cor base</label><input type="color" class="t-input" id="cp-base" value="#6366f1" style="height:40px;padding:.2rem;cursor:pointer"></div>
          <div class="t-group"><label class="t-label">Modo</label>
            <select class="t-input t-select" id="cp-mode">
              <option>Monocromático</option><option>Complementar</option><option>Análogo</option>
              <option>Triádico</option><option>Tetrádico</option><option>Split-complementar</option>
            </select>
          </div>
          <button class="t-btn" id="cp-gen" style="align-self:flex-end">Gerar</button>
        </div>
        <div id="cp-swatches" class="color-swatches"></div>
        <div id="cp-info" class="t-result-row" style="flex-wrap:wrap;gap:.4rem;margin-top:.5rem"></div>
      </div>`;
    function hexToHsl(h){
      let r=parseInt(h.slice(1,3),16)/255, g=parseInt(h.slice(3,5),16)/255, b=parseInt(h.slice(5,7),16)/255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b); let hue,s,l=(max+min)/2;
      if(max===min){hue=s=0;}else{const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);switch(max){case r:hue=(g-b)/d+(g<b?6:0);break;case g:hue=(b-r)/d+2;break;default:hue=(r-g)/d+4;break;}hue/=6;}
      return [Math.round(hue*360),Math.round(s*100),Math.round(l*100)];
    }
    function hslToHex(h,s,l){
      s/=100;l/=100;const k=n=>(n+h/30)%12;const a=s*Math.min(l,1-l);const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
      return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
    }
    function genPalette(base,mode){
      const [h,s,l]=hexToHsl(base);
      switch(mode){
        case 'Monocromático': return [0,30,-30,20,-20].map(d=>hslToHex(h,s,Math.max(5,Math.min(95,l+d))));
        case 'Complementar':  return [0,180].map(d=>hslToHex((h+d)%360,s,l)).concat([0,180].map(d=>hslToHex((h+d)%360,s,Math.max(20,l-25))));
        case 'Análogo':       return [-30,-15,0,15,30].map(d=>hslToHex((h+d+360)%360,s,l));
        case 'Triádico':      return [0,120,240].map(d=>hslToHex((h+d)%360,s,l)).concat([0,120].map(d=>hslToHex((h+d)%360,s,Math.max(20,l-15))));
        case 'Tetrádico':     return [0,90,180,270].map(d=>hslToHex((h+d)%360,s,l));
        case 'Split-complementar': return [0,150,210].map(d=>hslToHex((h+d)%360,s,l)).concat([0,150].map(d=>hslToHex((h+d)%360,s,Math.max(20,l-20))));
        default: return [base];
      }
    }
    function render(){
      const base=root.querySelector('#cp-base').value, mode=root.querySelector('#cp-mode').value;
      const palette=genPalette(base,mode);
      root.querySelector('#cp-swatches').innerHTML=palette.map(c=>`
        <div class="color-swatch" style="background:${c}" title="${c}" data-c="${c}">
          <span style="text-shadow:0 1px 3px rgba(0,0,0,.8)">${c}</span>
        </div>`).join('');
      root.querySelector('#cp-info').innerHTML=palette.map(c=>`<button class="t-copy-btn" data-c="${c}">${c}</button>`).join('');
      root.querySelectorAll('.color-swatch,.t-copy-btn').forEach(el=>el.addEventListener('click',()=>copyText(el.dataset.c,el)));
    }
    root.querySelector('#cp-gen').addEventListener('click',render);
    root.querySelector('#cp-base').addEventListener('input',render);
    root.querySelector('#cp-mode').addEventListener('change',render);
    render();
  }

  // ============================================================
  // DICE ROLLER
  // ============================================================
  const DICE_FACES=['⚀','⚁','⚂','⚃','⚄','⚅'];
  function initDice(root) {
    root.innerHTML=`
      <div class="tool-card">
        <div class="tool-hdr">🎲 Dados</div>
        <div class="dice-wrap">
          <div class="tool-opts-row">
            <div class="tool-opts-grp">
              <span class="tool-opts-lbl">Tipo de dado</span>
              <div class="tool-seg">
                ${[4,6,8,10,12,20,100].map((d,i)=>`<button class="tsb${i===1?' active':''}" data-d="${d}">D${d}</button>`).join('')}
              </div>
            </div>
            <div class="tool-opts-grp">
              <span class="tool-opts-lbl">Quantidade</span>
              <input type="number" class="cd-inp" id="dice-n" value="1" min="1" max="20" style="width:52px">
            </div>
          </div>
          <div class="dice-display" id="dice-face">🎲</div>
          <div class="dice-result-row" id="dice-vals"></div>
          <div class="dice-total" id="dice-total"></div>
          <button class="tool-btn" id="dice-roll" style="margin-top:.35rem">🎲 Lançar</button>
        </div>
      </div>`;
    let sides=6;
    root.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>{
      sides=+b.dataset.d;
      root.querySelectorAll('[data-d]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
    }));
    root.querySelector('#dice-roll').addEventListener('click',()=>{
      const n=Math.min(20,Math.max(1,+root.querySelector('#dice-n').value||1));
      const vals=Array.from({length:n},()=>Math.floor(Math.random()*sides)+1);
      const face=root.querySelector('#dice-face');
      face.textContent=sides===6?DICE_FACES[vals[0]-1]:vals[0];
      face.style.transform='scale(1.2)'; setTimeout(()=>face.style.transform='',150);
      root.querySelector('#dice-vals').innerHTML=n>1?vals.map(v=>`<div class="dice-val">${v}</div>`).join(''):'';
      root.querySelector('#dice-total').textContent=n>1?`Total: ${vals.reduce((a,b)=>a+b,0)}`:'';
    });
  }

  // ============================================================
  // COIN FLIP
  // ============================================================
  function initCoin(root) {
    root.innerHTML=`
      <div class="tool-card">
        <div class="tool-hdr">🪙 Moeda</div>
        <div class="dice-wrap">
          <div class="coin-display" id="coin-face">🪙</div>
          <div class="coin-result" id="coin-res"></div>
          <button class="tool-btn" id="coin-flip">🪙 Lançar</button>
          <div style="font-size:.7rem;color:var(--muted);margin-top:.25rem" id="coin-stats"></div>
        </div>
      </div>`;
    let heads=0,tails=0;
    root.querySelector('#coin-flip').addEventListener('click',()=>{
      const h=Math.random()<0.5;
      const face=root.querySelector('#coin-face');
      face.textContent=h?'🌕':'🌑';
      face.style.transform='rotateY(360deg)'; setTimeout(()=>face.style.transform='',300);
      if(h) heads++; else tails++;
      root.querySelector('#coin-res').textContent=h?'Cara':'Coroa';
      root.querySelector('#coin-res').style.color=h?'var(--accent)':'var(--amber)';
      root.querySelector('#coin-stats').textContent=`Cara: ${heads} | Coroa: ${tails} | Total: ${heads+tails}`;
    });
  }

  // ============================================================
  // BUILD & SHOW
  // ============================================================
  function _buildTool(id) {
    if (_cache[id]) return _cache[id];
    const el = document.createElement('div');
    const map = {
      countdown:initCountdown, stopwatch:initStopwatch, pomodoro:initPomodoro,
      age:initAge, json:initJson, base64:initBase64, markdown:initMarkdown,
      sort:initSort, diff:initDiff, regex:initRegex, uuid:initUuid,
      timestamp:initTimestamp, calculator:initCalculator, percentage:initPercentage,
      unitconv:initUnitConv, colors:initColors, dice:initDice, coin:initCoin,
    };
    (map[id] || ((r)=>{r.innerHTML='<div class="tool-card">Em breve</div>';}))(el);
    _cache[id] = el;
    return el;
  }

  function show() {
    const view = document.getElementById('view-tools');
    if (!view) return;

    if (!_built) {
      _built = true;
      const cats = CATS;
      const sidebar = `<div class="tools-sidebar">${
        cats.map(cat => {
          const items = TOOLS.filter(t=>t.cat===cat);
          return `<div class="tools-sidebar-cat">${CAT_LABELS[cat]}</div>${
            items.map(t=>`<button class="tool-nav-btn" data-tid="${t.id}">${t.icon} ${t.label}</button>`).join('')
          }`;
        }).join('')
      }</div>`;
      view.innerHTML = `<div class="tools-layout">${sidebar}<div class="tools-content" id="tool-host"></div></div>`;
      view.querySelectorAll('.tool-nav-btn').forEach(btn=>btn.addEventListener('click',()=>_select(btn.dataset.tid)));
    }

    _select(_activeTool);
  }

  function _select(id) {
    _activeTool = id;
    const host = document.getElementById('tool-host');
    if (!host) return;
    document.querySelectorAll('.tool-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tid===id));
    host.innerHTML='';
    host.appendChild(_buildTool(id));
    if(id==='countdown') renderCdDisplay(_cache[id]);
  }

  return { show };
})();
