const ToolsPage = (function () {
  'use strict';

  // ── Audio ──────────────────────────────────────────────────────────
  function beep(freq, dur, vol = 0.35, type = 'sine') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = type;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  function playDone() { beep(523,.15); setTimeout(()=>beep(659,.15),160); setTimeout(()=>beep(784,.4),320); }

  // ── Countdown state ────────────────────────────────────────────────
  let cdTotal = 300, cdRemaining = 300, cdState = 'idle';
  let cdInterval, cdMode = 'circle', cdColor = '#3b82f6', cdSound = true;
  let _cdAborted = false;
  const CIRC = 2 * Math.PI * 54; // r=54

  function fmtTime(s) {
    const m = Math.floor(Math.abs(s) / 60);
    return `${m.toString().padStart(2,'0')}:${(Math.abs(s) % 60).toString().padStart(2,'0')}`;
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
              <circle class="cd-ring-fill" id="cd-fill" cx="60" cy="60" r="54"
                stroke="${cdColor}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
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
                <linearGradient id="hg-cap" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stop-color="rgba(255,255,255,.22)"/>
                  <stop offset="100%" stop-color="rgba(255,255,255,.06)"/>
                </linearGradient>
                <filter id="hg-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.5" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="hg-neck-glow" x="-300%" y="-300%" width="700%" height="700%">
                  <feGaussianBlur stdDeviation="5" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              <!-- Glass body subtle fill -->
              <polygon points="5,12 95,12 50,110" fill="rgba(148,163,184,.04)"/>
              <polygon points="5,208 95,208 50,110" fill="rgba(148,163,184,.03)"/>

              <!-- Glass edge lines -->
              <line x1="5" y1="12" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="95" y1="12" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="5" y1="208" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="95" y1="208" x2="50" y2="110" stroke="rgba(148,163,184,.30)" stroke-width="1.5" stroke-linecap="round"/>

              <!-- Glass highlight sheen -->
              <line x1="9" y1="13" x2="52" y2="107" stroke="rgba(255,255,255,.16)" stroke-width="1"/>
              <line x1="9" y1="207" x2="52" y2="113" stroke="rgba(255,255,255,.11)" stroke-width="1"/>

              <!-- Sand top (drains toward neck as timer runs) -->
              <polygon id="cd-sand-top" points="5,12 95,12 50,110" fill="url(#hg-gt)" filter="url(#hg-glow)"/>
              <!-- Sand bottom (accumulates at base) -->
              <polygon id="cd-sand-bot" points="50,208 50,208 50,208" fill="url(#hg-gb)" filter="url(#hg-glow)"/>

              <!-- Neck glow dot -->
              <circle cx="50" cy="110" r="5" fill="${cdColor}" filter="url(#hg-neck-glow)" opacity=".45" class="hg-fc"/>

              <!-- SMIL-animated falling grains -->
              <circle cx="50" cy="113" r="2.4" fill="${cdColor}" class="hg-fc">
                <animate attributeName="cy" from="113" to="204" dur="1.5s" begin="-0.0s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;0.85;0" keyTimes="0;0.06;0.72;1" dur="1.5s" begin="-0.0s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2.4;2.1;1.6;0.9" keyTimes="0;0.2;0.65;1" dur="1.5s" begin="-0.0s" repeatCount="indefinite"/>
              </circle>
              <circle cx="50" cy="113" r="2" fill="${cdColor}" class="hg-fc">
                <animate attributeName="cy" from="113" to="204" dur="1.5s" begin="-0.375s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;0.85;0" keyTimes="0;0.06;0.72;1" dur="1.5s" begin="-0.375s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2;1.8;1.3;0.7" keyTimes="0;0.2;0.65;1" dur="1.5s" begin="-0.375s" repeatCount="indefinite"/>
              </circle>
              <circle cx="50" cy="113" r="2.2" fill="${cdColor}" class="hg-fc">
                <animate attributeName="cy" from="113" to="204" dur="1.5s" begin="-0.75s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;0.85;0" keyTimes="0;0.06;0.72;1" dur="1.5s" begin="-0.75s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2.2;1.9;1.4;0.8" keyTimes="0;0.2;0.65;1" dur="1.5s" begin="-0.75s" repeatCount="indefinite"/>
              </circle>
              <circle cx="50" cy="113" r="1.7" fill="${cdColor}" class="hg-fc">
                <animate attributeName="cy" from="113" to="204" dur="1.5s" begin="-1.125s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;0.85;0" keyTimes="0;0.06;0.72;1" dur="1.5s" begin="-1.125s" repeatCount="indefinite"/>
                <animate attributeName="r" values="1.7;1.5;1.1;0.6" keyTimes="0;0.2;0.65;1" dur="1.5s" begin="-1.125s" repeatCount="indefinite"/>
              </circle>

              <!-- Top cap with highlight -->
              <rect x="2" y="2" width="96" height="12" rx="6" fill="url(#hg-cap)" stroke="rgba(200,220,255,.2)" stroke-width=".7"/>
              <rect x="7" y="4" width="52" height="4" rx="2" fill="rgba(255,255,255,.12)"/>

              <!-- Bottom cap -->
              <rect x="2" y="206" width="96" height="12" rx="6" fill="rgba(148,163,184,.15)" stroke="rgba(200,220,255,.15)" stroke-width=".7"/>
              <rect x="7" y="208" width="40" height="4" rx="2" fill="rgba(255,255,255,.09)"/>
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

    // Mode
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      cdMode = b.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      root.querySelector('#cd-cw').style.display  = cdMode==='circle' ? '' : 'none';
      root.querySelector('#cd-hw').style.display  = cdMode==='hourglass' ? '' : 'none';
    }));

    // Color
    root.querySelectorAll('.tcol').forEach(b => b.addEventListener('click', () => {
      cdColor = b.dataset.c;
      root.querySelectorAll('.tcol').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const fill = root.querySelector('#cd-fill');
      if (fill) fill.style.stroke = cdColor;
      // Update SVG gradient stops and grain/neck colors
      ['#hg-gt0','#hg-gt1','#hg-gb0','#hg-gb1'].forEach(id => {
        const s = root.querySelector(id); if (s) s.setAttribute('stop-color', cdColor);
      });
      root.querySelectorAll('.hg-fc').forEach(g => g.setAttribute('fill', cdColor));
    }));

    // Sound
    const soundBtn = root.querySelector('#cd-sound');
    soundBtn.addEventListener('click', () => {
      cdSound = !cdSound;
      soundBtn.classList.toggle('active', cdSound);
      soundBtn.textContent = cdSound ? '🔔' : '🔕';
    });

    // Presets
    root.querySelectorAll('.cdp').forEach(b => b.addEventListener('click', () => {
      root.querySelector('#cd-min').value = b.dataset.m;
      root.querySelector('#cd-sec').value = 0;
      setCD(root);
    }));

    root.querySelector('#cd-set').addEventListener('click', () => setCD(root));
    root.querySelector('#cd-start').addEventListener('click', () => runCD(root));
    root.querySelector('#cd-pause').addEventListener('click', () => pauseCD(root));
    root.querySelector('#cd-reset').addEventListener('click', () => resetCD(root));

    setCD(root);
    // Ensure SMIL grains start paused (timer is idle)
    setTimeout(() => { const s = root.querySelector('#cd-hg-svg'); s?.pauseAnimations?.(); }, 0);
  }

  function setCD(root) {
    clearInterval(cdInterval); cdState = 'idle'; _cdAborted = true;
    const m = Math.max(0,Math.min(99,parseInt(root.querySelector('#cd-min').value)||0));
    const s = Math.max(0,Math.min(59,parseInt(root.querySelector('#cd-sec').value)||0));
    cdTotal = cdRemaining = m*60+s;
    renderCdDisplay(root);
    root.querySelector('#cd-start').style.display = '';
    root.querySelector('#cd-start').textContent = '▶ Iniciar';
    root.querySelector('#cd-pause').style.display = 'none';
    root.querySelector('#cd-done').style.display = 'none';
    root.querySelector('#cd-visual').classList.remove('cd-flash');
  }

  function runCD(root) {
    if (cdState === 'running' || !cdRemaining) return;
    _cdAborted = false;
    cdState = 'running';
    root.querySelector('#cd-start').style.display = 'none';
    root.querySelector('#cd-pause').style.display = '';
    root.querySelector('#cd-pause').textContent = '⏸ Pausar';
    root.querySelector('#cd-done').style.display = 'none';
    cdInterval = setInterval(() => {
      cdRemaining--;
      renderCdDisplay(root);
      if (cdRemaining <= 0) {
        clearInterval(cdInterval); cdState = 'done';
        root.querySelector('#cd-pause').style.display = 'none';
        root.querySelector('#cd-start').textContent = '▶ Iniciar';
        root.querySelector('#cd-start').style.display = '';
        root.querySelector('#cd-done').style.display = '';
        if (cdSound && !_cdAborted) playDone();
        root.querySelector('#cd-visual').classList.add('cd-flash');
        setTimeout(() => root.querySelector('#cd-visual')?.classList.remove('cd-flash'), 3000);
      }
    }, 1000);
  }

  function pauseCD(root) {
    clearInterval(cdInterval); cdState = 'paused'; _cdAborted = true;
    root.querySelector('#cd-pause').style.display = 'none';
    root.querySelector('#cd-start').textContent = '▶ Retomar';
    root.querySelector('#cd-start').style.display = '';
    updateHgGrains(root);
  }

  function resetCD(root) {
    clearInterval(cdInterval); cdState = 'idle'; _cdAborted = true;
    cdRemaining = cdTotal;
    renderCdDisplay(root);
    root.querySelector('#cd-start').textContent = '▶ Iniciar';
    root.querySelector('#cd-start').style.display = '';
    root.querySelector('#cd-pause').style.display = 'none';
    root.querySelector('#cd-done').style.display = 'none';
    root.querySelector('#cd-visual').classList.remove('cd-flash');
  }

  function updateHgGrains(root) {
    const svg = root.querySelector('#cd-hg-svg');
    if (!svg) return;
    const running = cdState === 'running' && cdRemaining > 0;
    if (running) svg.unpauseAnimations?.();
    else svg.pauseAnimations?.();
  }

  function renderCdDisplay(root) {
    const pct = cdTotal > 0 ? Math.max(0, cdRemaining / cdTotal) : 0;
    const tStr = fmtTime(cdRemaining);

    // Circle
    const fill = root.querySelector('#cd-fill');
    if (fill) fill.style.strokeDashoffset = CIRC * (1 - pct);
    const d = root.querySelector('#cd-disp'); if (d) d.textContent = tStr;
    const p = root.querySelector('#cd-pct');  if (p) p.textContent = Math.round(pct*100)+'%';

    // Hourglass SVG polygon — viewBox "0 0 100 220", neck at y=110, top at y=12, base at y=208
    const hd = root.querySelector('#cd-hg-disp'); if (hd) hd.textContent = tStr;
    const st = root.querySelector('#cd-sand-top');
    const sb = root.querySelector('#cd-sand-bot');
    if (st && sb) {
      const NECK = 110, TOP = 12, BOT = 208, HW = 45; // HW = max half-width at rim

      // TOP: flat surface descends toward neck as timer drains
      const topSurfY = TOP + (1 - pct) * (NECK - TOP);
      const tHW = HW * (NECK - topSurfY) / (NECK - TOP);
      const tL = (50 - tHW).toFixed(1), tR = (50 + tHW).toFixed(1);
      st.setAttribute('points', pct <= 0
        ? '50,110 50,110 50,110'
        : `${tL},${topSurfY.toFixed(1)} ${tR},${topSurfY.toFixed(1)} 50,110`);

      // BOTTOM: trapezoid accumulates from base up
      const botFill = 1 - pct;
      const botSurfY = BOT - botFill * (BOT - NECK);
      const bHW = HW * (botSurfY - NECK) / (BOT - NECK);
      const bL = (50 - bHW).toFixed(1), bR = (50 + bHW).toFixed(1);
      sb.setAttribute('points', botFill <= 0
        ? '50,208 50,208 50,208'
        : `${bL},${botSurfY.toFixed(1)} ${bR},${botSurfY.toFixed(1)} 95,208 5,208`);
    }

    updateHgGrains(root);
  }

  // ── Stopwatch ──────────────────────────────────────────────────────
  let swMs = 0, swRunning = false, swInterval, swLaps = [];

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
    const cs = Math.floor((ms % 1000) / 10);
    const s  = Math.floor(ms / 1000) % 60;
    const m  = Math.floor(ms / 60000);
    return { main:`${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`, cs:cs.toString().padStart(2,'0') };
  }

  function toggleSw(root) {
    if (swRunning) {
      clearInterval(swInterval); swRunning = false;
      root.querySelector('#sw-toggle').textContent = '▶ Retomar';
      root.querySelector('#sw-lap').style.display = 'none';
    } else {
      const start = Date.now() - swMs; swRunning = true;
      root.querySelector('#sw-toggle').textContent = '⏸ Parar';
      root.querySelector('#sw-lap').style.display = '';
      swInterval = setInterval(() => {
        swMs = Date.now() - start;
        const f = fmtSw(swMs);
        const d = root.querySelector('#sw-disp');
        if (d) d.innerHTML = `${f.main}<span class="sw-ms">.${f.cs}</span>`;
      }, 33);
    }
  }

  function swLap(root) {
    swLaps.push(swMs);
    const el = root.querySelector('#sw-laps');
    if (!el) return;
    el.innerHTML = swLaps.slice().reverse().map((t, ri) => {
      const idx = swLaps.length - 1 - ri;
      const prev = idx > 0 ? swLaps[idx-1] : 0;
      const lap  = t - prev;
      const fLap = fmtSw(lap), fTot = fmtSw(t);
      return `<div class="sw-lap-row">
        <span class="sw-lap-n">Volta ${idx+1}</span>
        <span class="sw-lap-split">${fLap.main}.${fLap.cs}</span>
        <span class="sw-lap-total">${fTot.main}.${fTot.cs}</span>
      </div>`;
    }).join('');
  }

  function swReset(root) {
    clearInterval(swInterval); swRunning = false; swMs = 0; swLaps = [];
    root.querySelector('#sw-toggle').textContent = '▶ Iniciar';
    root.querySelector('#sw-lap').style.display = 'none';
    const d = root.querySelector('#sw-disp');
    if (d) d.innerHTML = '00:00<span class="sw-ms">.00</span>';
    const l = root.querySelector('#sw-laps'); if (l) l.innerHTML = '';
  }

  // ── Cached tool containers ──────────────────────────────────────────
  let _cdEl = null, _swEl = null;

  // ── Public ─────────────────────────────────────────────────────────
  let _built = false, _activeTool = null;

  function show() {
    const el = document.getElementById('view-tools');
    if (!el) return;

    if (!_built) {
      _built = true;

      // Pre-render both tools into detached containers
      _cdEl = document.createElement('div');
      _swEl = document.createElement('div');
      initCountdown(_cdEl);
      initStopwatch(_swEl);

      el.innerHTML = `
        <div class="view-inner">
          <div class="page-header">
            <h1 class="page-title">🛠️ Ferramentas</h1>
            <p class="page-subtitle">Produtividade e gestão do tempo</p>
          </div>
          <div class="tool-selector">
            <button class="tool-sel-btn" data-tool="cd">⏳ Temporizador</button>
            <button class="tool-sel-btn" data-tool="sw">⏱️ Cronómetro</button>
          </div>
          <div id="tool-host"></div>
        </div>`;

      el.querySelectorAll('.tool-sel-btn').forEach(btn => {
        btn.addEventListener('click', () => selectTool(el, btn.dataset.tool));
      });
    }

    // If coming back to tools view, keep last selection or show selector
    if (_activeTool) selectTool(el, _activeTool);
  }

  function selectTool(el, which) {
    _activeTool = which;
    const host = el.querySelector('#tool-host');
    if (!host) return;

    el.querySelectorAll('.tool-sel-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === which));

    host.innerHTML = '';
    if (which === 'cd') host.appendChild(_cdEl);
    else if (which === 'sw') host.appendChild(_swEl);

    renderCdDisplay(_cdEl);
  }

  return { show };
})();
