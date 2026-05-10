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
  function playTick() { beep(1100,.05,.15); }

  // ── Countdown state ────────────────────────────────────────────────
  let cdTotal = 300, cdRemaining = 300, cdState = 'idle'; // idle|running|paused|done
  let cdInterval, cdMode = 'circle', cdColor = '#3b82f6', cdSound = true;
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
            <div class="cd-hg">
              <div class="cd-hg-frame">
                <div class="cd-hg-top-half">
                  <div class="cd-sand-top" id="cd-sand-top"></div>
                </div>
                <div class="cd-hg-neck">
                  <div class="cd-hg-drip" id="cd-drip"></div>
                </div>
                <div class="cd-hg-bot-half">
                  <div class="cd-sand-bot" id="cd-sand-bot"></div>
                </div>
              </div>
            </div>
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
      root.querySelectorAll('.cd-sand-top,.cd-sand-bot,.cd-hg-drip').forEach(el =>
        el.style.background = cdColor);
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
    clearInterval(cdInterval); cdState = 'idle';
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
    cdState = 'running';
    root.querySelector('#cd-start').style.display = 'none';
    root.querySelector('#cd-pause').style.display = '';
    root.querySelector('#cd-pause').textContent = '⏸ Pausar';
    root.querySelector('#cd-done').style.display = 'none';
    cdInterval = setInterval(() => {
      cdRemaining--;
      renderCdDisplay(root);
      if (cdSound && cdRemaining > 0 && cdRemaining <= 3) playTick();
      if (cdRemaining <= 0) {
        clearInterval(cdInterval); cdState = 'done';
        root.querySelector('#cd-pause').style.display = 'none';
        root.querySelector('#cd-start').textContent = '▶ Iniciar';
        root.querySelector('#cd-start').style.display = '';
        root.querySelector('#cd-done').style.display = '';
        if (cdSound) playDone();
        root.querySelector('#cd-visual').classList.add('cd-flash');
        setTimeout(() => root.querySelector('#cd-visual')?.classList.remove('cd-flash'), 3000);
      }
    }, 1000);
  }

  function pauseCD(root) {
    clearInterval(cdInterval); cdState = 'paused';
    root.querySelector('#cd-pause').style.display = 'none';
    root.querySelector('#cd-start').textContent = '▶ Retomar';
    root.querySelector('#cd-start').style.display = '';
  }

  function resetCD(root) {
    clearInterval(cdInterval); cdState = 'idle';
    cdRemaining = cdTotal;
    renderCdDisplay(root);
    root.querySelector('#cd-start').textContent = '▶ Iniciar';
    root.querySelector('#cd-start').style.display = '';
    root.querySelector('#cd-pause').style.display = 'none';
    root.querySelector('#cd-done').style.display = 'none';
    root.querySelector('#cd-visual').classList.remove('cd-flash');
  }

  function renderCdDisplay(root) {
    const pct = cdTotal > 0 ? Math.max(0, cdRemaining / cdTotal) : 0;
    const tStr = fmtTime(cdRemaining);

    // Circle
    const fill = root.querySelector('#cd-fill');
    if (fill) fill.style.strokeDashoffset = CIRC * (1 - pct);
    const d = root.querySelector('#cd-disp'); if (d) d.textContent = tStr;
    const p = root.querySelector('#cd-pct');  if (p) p.textContent = Math.round(pct*100)+'%';

    // Hourglass
    const hd = root.querySelector('#cd-hg-disp');  if (hd) hd.textContent = tStr;
    const st = root.querySelector('#cd-sand-top');  if (st) st.style.height = (pct*100)+'%';
    const sb = root.querySelector('#cd-sand-bot');  if (sb) sb.style.height = ((1-pct)*100)+'%';
    const dr = root.querySelector('#cd-drip');
    if (dr) dr.style.opacity = (cdState==='running' && cdRemaining>0) ? '1' : '0';
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

  // ── Public ─────────────────────────────────────────────────────────
  let _built = false;
  function show() {
    const el = document.getElementById('view-tools');
    if (!el) return;
    if (_built) return;
    _built = true;
    el.innerHTML = `
      <div class="view-inner">
        <div class="page-header">
          <h1 class="page-title">🛠️ Ferramentas</h1>
          <p class="page-subtitle">Produtividade e gestão do tempo</p>
        </div>
        <div class="tools-grid">
          <div id="tool-cd"></div>
          <div id="tool-sw"></div>
        </div>
      </div>`;
    initCountdown(el.querySelector('#tool-cd'));
    initStopwatch(el.querySelector('#tool-sw'));
  }

  return { show };
})();
