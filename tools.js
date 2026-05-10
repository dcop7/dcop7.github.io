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
            <svg class="cd-hg-svg" id="cd-hg-svg" viewBox="0 0 80 165" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hg-gt" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stop-color="${cdColor}" stop-opacity="1" id="hg-gt0"/>
                  <stop offset="100%" stop-color="${cdColor}" stop-opacity="0.65" id="hg-gt1"/>
                </linearGradient>
                <linearGradient id="hg-gb" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stop-color="${cdColor}" stop-opacity="0.65" id="hg-gb0"/>
                  <stop offset="100%" stop-color="${cdColor}" stop-opacity="1" id="hg-gb1"/>
                </linearGradient>
                <filter id="hg-glow">
                  <feGaussianBlur stdDeviation="1.5" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <!-- Glass frame bars -->
              <rect x="5" y="2" width="70" height="6" rx="3" fill="rgba(148,163,184,.22)"/>
              <rect x="5" y="157" width="70" height="6" rx="3" fill="rgba(148,163,184,.22)"/>
              <!-- Glass sides -->
              <line x1="8" y1="5" x2="40" y2="82" stroke="rgba(148,163,184,.18)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="72" y1="5" x2="40" y2="82" stroke="rgba(148,163,184,.18)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="160" x2="40" y2="82" stroke="rgba(148,163,184,.18)" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="72" y1="160" x2="40" y2="82" stroke="rgba(148,163,184,.18)" stroke-width="1.5" stroke-linecap="round"/>
              <!-- Sand top (drains from full triangle to empty) -->
              <polygon id="cd-sand-top" points="8,8 72,8 40,82" fill="url(#hg-gt)" filter="url(#hg-glow)"/>
              <!-- Sand bottom (fills from empty to full triangle) -->
              <polygon id="cd-sand-bot" points="40,160 40,160 40,160" fill="url(#hg-gb)" filter="url(#hg-glow)"/>
              <!-- Sand grain drip particles at neck -->
              <circle class="hg-grain" cx="40" cy="83" r="2" fill="${cdColor}" opacity="0"/>
              <circle class="hg-grain" cx="40" cy="88" r="1.5" fill="${cdColor}" opacity="0"/>
              <circle class="hg-grain" cx="40" cy="93" r="1.5" fill="${cdColor}" opacity="0"/>
              <circle class="hg-grain" cx="40" cy="98" r="1" fill="${cdColor}" opacity="0"/>
              <circle class="hg-grain" cx="40" cy="103" r="1" fill="${cdColor}" opacity="0"/>
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
      // Update SVG gradient stops and grain colors
      ['#hg-gt0','#hg-gt1','#hg-gb0','#hg-gb1'].forEach(id => {
        const s = root.querySelector(id); if (s) s.setAttribute('stop-color', cdColor);
      });
      root.querySelectorAll('.hg-grain').forEach(g => g.setAttribute('fill', cdColor));
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
    if (svg) svg.classList.toggle('hg-running', cdState === 'running' && cdRemaining > 0);
  }

  function renderCdDisplay(root) {
    const pct = cdTotal > 0 ? Math.max(0, cdRemaining / cdTotal) : 0;
    const tStr = fmtTime(cdRemaining);

    // Circle
    const fill = root.querySelector('#cd-fill');
    if (fill) fill.style.strokeDashoffset = CIRC * (1 - pct);
    const d = root.querySelector('#cd-disp'); if (d) d.textContent = tStr;
    const p = root.querySelector('#cd-pct');  if (p) p.textContent = Math.round(pct*100)+'%';

    // Hourglass SVG polygon — viewBox "0 0 80 165", neck at y=82, base at y=160
    const hd = root.querySelector('#cd-hg-disp'); if (hd) hd.textContent = tStr;
    const st = root.querySelector('#cd-sand-top');
    const sb = root.querySelector('#cd-sand-bot');
    if (st && sb) {
      const NECK = 82, TOP = 8, BOT = 160;
      const topSpan = NECK - TOP;   // 74
      const botSpan = BOT - NECK;   // 78
      const halfW = 32;             // x=8..72 → halfW each side from center(40)

      // TOP: sand surface descends as pct drops (triangle shrinks toward neck)
      const topSurfY = TOP + (1 - pct) * topSpan;
      const tRatio = (topSurfY - TOP) / topSpan; // 0=full, 1=empty
      const tL = (8  + halfW * tRatio).toFixed(1);
      const tR = (72 - halfW * tRatio).toFixed(1);
      st.setAttribute('points', pct <= 0
        ? '40,82 40,82 40,82'
        : `${tL},${topSurfY.toFixed(1)} ${tR},${topSurfY.toFixed(1)} 40,82`);

      // BOTTOM: sand surface rises from base as pct drops
      // botFill = 1-pct: how much bottom chamber is filled
      const botFill = 1 - pct;
      const botSurfY = BOT - botFill * botSpan;  // 160 (empty) → 82 (full)
      const bRatio = (BOT - botSurfY) / botSpan; // 0=empty, 1=full
      const bL = (40 - halfW * bRatio).toFixed(1);
      const bR = (40 + halfW * bRatio).toFixed(1);
      // Polygon: surface → base-right → base-left (trapezoid from surface to bottom)
      sb.setAttribute('points', botFill <= 0
        ? '40,160 40,160 40,160'
        : `${bL},${botSurfY.toFixed(1)} ${bR},${botSurfY.toFixed(1)} 72,160 8,160`);
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
