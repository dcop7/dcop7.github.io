const BridgeBuilderGame = (function () {
  'use strict';

  let root, cv, cx, raf, W, H, G;

  const LEVELS = [
    { title:'Level 1 — First Bridge', hint:'Connect anchor points with beams to build a bridge',
      anchors:[{x:.1,y:.55},{x:.3,y:.55},{x:.5,y:.55},{x:.7,y:.55},{x:.9,y:.55}],
      startAnchor:0, endAnchor:4, gap:[{x:.3,y:.55},{x:.7,y:.55}],
      maxBeams:8, robotSpeed:70 },
    { title:'Level 2 — The Chasm', hint:'Long spans need support beams beneath',
      anchors:[{x:.08,y:.5},{x:.25,y:.5},{x:.42,y:.5},{x:.58,y:.5},{x:.75,y:.5},{x:.92,y:.5},
               {x:.25,y:.7},{x:.42,y:.7},{x:.58,y:.7},{x:.75,y:.7}],
      startAnchor:0, endAnchor:5, gap:[{x:.25,y:.5},{x:.75,y:.5}],
      maxBeams:12, robotSpeed:60 },
    { title:'Level 3 — Cross the Valley', hint:'Use the lower anchors to form triangular trusses',
      anchors:[{x:.1,y:.45},{x:.3,y:.45},{x:.5,y:.45},{x:.7,y:.45},{x:.9,y:.45},
               {x:.2,y:.65},{x:.4,y:.65},{x:.6,y:.65},{x:.8,y:.65}],
      startAnchor:0, endAnchor:4, gap:[{x:.3,y:.45},{x:.7,y:.45}],
      maxBeams:14, robotSpeed:55 },
    { title:'Level 4 — Advanced Structure', hint:'Triangular trusses spread the load — flat bridges will collapse',
      anchors:[{x:.05,y:.42},{x:.22,y:.42},{x:.39,y:.42},{x:.56,y:.42},{x:.73,y:.42},{x:.9,y:.42},
               {x:.14,y:.62},{x:.31,y:.62},{x:.48,y:.62},{x:.65,y:.62},{x:.82,y:.62}],
      startAnchor:0, endAnchor:5, gap:[{x:.22,y:.42},{x:.73,y:.42}],
      maxBeams:18, robotSpeed:50 },
  ];

  /* UI strings + per-level titles/hints live in games/bridge-builder/i18n.json
     (offline fallback below; `levels` is an array indexed by level). */
  const FB_I18N = {
    pt: { play:'Jogar', continue:'Continuar', startOver:'↺ Recomeçar', tip:'Clica nos pontos de ancoragem para ligar vigas<br>Vigas longas e planas colapsam — usa triângulos!<br>Depois testa se a ponte aguenta o robô.', beamsInit:'Vigas: {n}', beamsLeft:'Vigas: {n} restantes', build:'🔧 Construir', del:'🗑 Apagar', clear:'Limpar', test:'🤖 Testar!', collapsed:'A ponte colapsou! Tenta treliças triangulares.', beamTooLong:'Viga demasiado longa — adiciona ancoragens intermédias!', buildPath:'Constrói um caminho de 🚀 a 🏁 primeiro!', bridgeHolds:'A Ponte Aguenta!', beamsUsed:'Vigas usadas: {u} / {n}', nextLevel:'▶ Próximo Nível', allDoneBtn:'🏆 Tudo Concluído!', replay:'↺ Repetir', menu:'☰ Menu', masterBuilder:'Construtor Mestre!', playAgain:'▶ Jogar de Novo',
      levels:[ {title:'Nível 1 — Primeira Ponte',hint:'Liga os pontos de ancoragem com vigas para construir uma ponte'}, {title:'Nível 2 — O Abismo',hint:'Vãos longos precisam de vigas de apoio por baixo'}, {title:'Nível 3 — Atravessar o Vale',hint:'Usa as ancoragens inferiores para formar treliças triangulares'}, {title:'Nível 4 — Estrutura Avançada',hint:'As treliças triangulares distribuem a carga — pontes planas colapsam'} ] },
    en: { play:'Play', continue:'Continue', startOver:'↺ Start Over', tip:'Click anchor points to connect beams<br>Long flat beams collapse — use triangles!<br>Then test if your bridge holds the robot.', beamsInit:'Beams: {n}', beamsLeft:'Beams: {n} left', build:'🔧 Build', del:'🗑 Delete', clear:'Clear', test:'🤖 Test!', collapsed:'Bridge collapsed! Try triangular trusses.', beamTooLong:'Beam too long — add intermediate anchors!', buildPath:'Build a path from 🚀 to 🏁 first!', bridgeHolds:'Bridge Holds!', beamsUsed:'Beams used: {u} / {n}', nextLevel:'▶ Next Level', allDoneBtn:'🏆 All Done!', replay:'↺ Replay', menu:'☰ Menu', masterBuilder:'Master Builder!', playAgain:'▶ Play Again',
      levels:[ {title:'Level 1 — First Bridge',hint:'Connect anchor points with beams to build a bridge'}, {title:'Level 2 — The Chasm',hint:'Long spans need support beams beneath'}, {title:'Level 3 — Cross the Valley',hint:'Use the lower anchors to form triangular trusses'}, {title:'Level 4 — Advanced Structure',hint:'Triangular trusses spread the load — flat bridges will collapse'} ] },
  };
  const _has = typeof GameData !== 'undefined';
  const t = _has ? GameData.translator(FB_I18N) : (k => (FB_I18N.pt[k] || k));
  const _lvl = idx => { const L = t('levels'); return (L && L[idx]) || LEVELS[idx] || {}; };

  const BEAM_MAX_STRESS = 1.6;
  const ROBOT_RADIUS = 16;
  // Beams longer than this fraction of screen width will be extra weak
  const MAX_BEAM_FRACTION = 0.55;

  function injectCSS() {
    if (document.getElementById('bb-css')) return;
    const s = document.createElement('style'); s.id = 'bb-css';
    s.textContent = `
.bb-host{position:relative;width:100%;min-height:500px;background:#040d18;overflow:hidden;display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;color:#bae6fd}
.bb-cv{display:block;width:100%;flex:1;min-height:0;touch-action:none}
.bb-hud{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,.55);flex-shrink:0;flex-wrap:wrap}
.bb-hud-title{font-size:.82rem;font-weight:700;color:#38bdf8;flex:1}
.bb-beams-left{font-size:.8rem;color:#7dd3fc;white-space:nowrap}
.bb-btn{background:linear-gradient(135deg,#0284c7,#38bdf8);color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:.85rem;font-weight:700;cursor:pointer;transition:transform .15s}
.bb-btn:hover{transform:scale(1.04)}
.bb-btn-clear{background:transparent;border:1.5px solid #0369a1;color:#38bdf8;border-radius:8px;padding:8px 14px;font-size:.85rem;cursor:pointer;transition:all .15s}
.bb-btn-clear:hover{background:rgba(3,105,161,.2)}
.bb-btn-new{background:transparent;border:1.5px solid #334155;color:#64748b;border-radius:8px;padding:8px 14px;font-size:.85rem;cursor:pointer;transition:all .15s}
.bb-btn-new:hover{border-color:#38bdf8;color:#38bdf8}
.bb-mode-row{display:flex;gap:6px;align-items:center}
.bb-mode-btn{padding:6px 12px;border-radius:6px;font-size:.78rem;font-weight:600;cursor:pointer;border:1.5px solid;transition:all .15s}
.bb-mode-btn.active{box-shadow:0 0 10px currentColor}
.bb-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 40%,#030e1e 0%,#000 80%);z-index:10}
.bb-title{font-size:2rem;font-weight:900;background:linear-gradient(120deg,#38bdf8,#0ea5e9,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center}
.bb-main-btn{background:linear-gradient(135deg,#0284c7,#38bdf8);color:#fff;border:none;border-radius:12px;padding:13px 36px;font-size:1.05rem;font-weight:700;cursor:pointer;box-shadow:0 0 20px rgba(56,189,248,.35);transition:transform .15s}
.bb-main-btn:hover{transform:scale(1.05)}
.bb-sm-btn{background:transparent;border:1.5px solid #38bdf8;color:#38bdf8;border-radius:10px;padding:9px 22px;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .15s}
.bb-sm-btn:hover{background:rgba(56,189,248,.12)}
.bb-tip{font-size:.75rem;color:#1e3a5f;text-align:center;max-width:260px;font-style:italic;line-height:1.5}
.bb-prog{display:flex;gap:5px}
.bb-pd{width:9px;height:9px;border-radius:50%;background:#1e3a5f;border:1.5px solid #1e40af}
.bb-pd.done{background:#38bdf8;box-shadow:0 0 6px #38bdf8}`;
    document.head.appendChild(s);
  }

  function init(r) { root = r; if (!r) return; injectCSS(); showMenu(); }

  function showMenu() {
    const saved = +localStorage.getItem('bb-lvl') || 0;
    root.innerHTML = `<div class="bb-host"><div class="bb-overlay">
      <div style="font-size:3rem;filter:drop-shadow(0 0 18px #38bdf8)">🌉</div>
      <div class="bb-title">Bridge Builder<br>Future</div>
      <div class="bb-prog">${LEVELS.map((_,i)=>`<div class="bb-pd ${i<saved?'done':''}"></div>`).join('')}</div>
      <button class="bb-main-btn" id="bb-play">▶ ${saved>0?t('continue'):t('play')}</button>
      ${saved>0?`<button class="bb-sm-btn" id="bb-reset">${t('startOver')}</button>`:''}
      <div class="bb-tip">${t('tip')}</div>
    </div></div>`;
    root.querySelector('#bb-play').addEventListener('click', () => playLevel(saved));
    root.querySelector('#bb-reset')?.addEventListener('click', () => { localStorage.removeItem('bb-lvl'); showMenu(); });
  }

  function playLevel(idx) {
    if (idx >= LEVELS.length) { showAllDone(); return; }
    const lvl = LEVELS[idx];

    root.innerHTML = `<div class="bb-host">
      <div class="bb-hud">
        <div class="bb-hud-title">${_lvl(idx).title}</div>
        <div class="bb-beams-left" id="bb-bl">${t('beamsInit').replace('{n}', lvl.maxBeams)}</div>
        <div class="bb-mode-row">
          <button class="bb-mode-btn active" id="bb-m-build" style="color:#38bdf8;border-color:#38bdf8">${t('build')}</button>
          <button class="bb-mode-btn" id="bb-m-del" style="color:#f87171;border-color:#f87171">${t('del')}</button>
        </div>
        <button class="bb-btn-clear" id="bb-clear">${t('clear')}</button>
        <button class="bb-btn" id="bb-test">${t('test')}</button>
        <button class="bb-btn-new" id="bb-new">☰</button>
      </div>
      <canvas class="bb-cv" id="bb-cv"></canvas>
    </div>`;

    cv = root.querySelector('#bb-cv');
    cx = cv.getContext('2d');
    resize(); window.addEventListener('resize', resize);
    G = buildLevel(idx, lvl);

    cv.addEventListener('click', onCanvasClick);
    cv.addEventListener('touchstart', e => { e.preventDefault(); const t=e.touches[0]; const r=cv.getBoundingClientRect(); onCanvasClickAt(t.clientX-r.left, t.clientY-r.top); }, {passive:false});
    cv.addEventListener('mousemove', onMouseMove);

    root.querySelector('#bb-test').addEventListener('click', testBridge);
    root.querySelector('#bb-clear').addEventListener('click', () => { G.beams=[]; G.selectedAnchor=-1; G.beamsUsed=0; updateBeamHUD(); });
    root.querySelector('#bb-m-build').addEventListener('click', () => { G.mode='build'; setModeUI(); });
    root.querySelector('#bb-m-del').addEventListener('click', () => { G.mode='delete'; setModeUI(); });
    root.querySelector('#bb-new').addEventListener('click', () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      showMenu();
    });

    raf = requestAnimationFrame(loop);
  }

  function setModeUI() {
    root.querySelector('#bb-m-build').classList.toggle('active', G.mode==='build');
    root.querySelector('#bb-m-del').classList.toggle('active', G.mode==='delete');
  }

  function resize() {
    W = cv.offsetWidth || 380; H = cv.offsetHeight || 420;
    cv.width = W; cv.height = H;
    if (G) recalcAnchors();
  }

  function buildLevel(idx, lvl) {
    const g = { idx, lvl, beams:[], selectedAnchor:-1, beamsUsed:0, mode:'build',
                state:'build', robot:null, particles:[],
                hoverAnchor:-1, mouseX:0, mouseY:0 };
    g.anchors = lvl.anchors.map(a => ({ px: a.x*W, py: a.y*H, fixed: true }));
    return g;
  }

  function recalcAnchors() {
    G.anchors = G.lvl.anchors.map(a => ({ px: a.x*W, py: a.y*H, fixed: true }));
  }

  function onCanvasClick(e) {
    const r = cv.getBoundingClientRect();
    onCanvasClickAt(e.clientX - r.left, e.clientY - r.top);
  }

  function onCanvasClickAt(px, py) {
    if (G.state !== 'build') return;
    const ai = nearestAnchor(px, py);
    if (ai === -1) { G.selectedAnchor = -1; return; }

    if (G.mode === 'delete') {
      const before = G.beams.length;
      G.beams = G.beams.filter(b => b.a !== ai && b.b !== ai);
      G.beamsUsed -= before - G.beams.length;
      updateBeamHUD(); return;
    }

    if (G.selectedAnchor === -1) { G.selectedAnchor = ai; return; }
    if (G.selectedAnchor === ai) { G.selectedAnchor = -1; return; }

    const a1 = G.selectedAnchor, a2 = ai;
    const pa = G.anchors[a1], pb = G.anchors[a2];
    const beamLen = Math.sqrt((pa.px-pb.px)**2+(pa.py-pb.py)**2);
    if (beamLen > W * MAX_BEAM_FRACTION) {
      flashMsg(t('beamTooLong'), '#fbbf24');
      G.selectedAnchor = -1; return;
    }

    if (!G.beams.some(b => (b.a===a1&&b.b===a2)||(b.a===a2&&b.b===a1))) {
      if (G.beamsUsed < G.lvl.maxBeams) {
        G.beams.push({ a:a1, b:a2, stress:0, broken:false });
        G.beamsUsed++;
        updateBeamHUD();
      }
    }
    G.selectedAnchor = a2;
  }

  function onMouseMove(e) {
    const r = cv.getBoundingClientRect();
    G.mouseX = e.clientX - r.left; G.mouseY = e.clientY - r.top;
    G.hoverAnchor = nearestAnchor(G.mouseX, G.mouseY);
  }

  function nearestAnchor(px, py) {
    let best = -1, bd = 999;
    G.anchors.forEach((a, i) => {
      const d = Math.sqrt((px-a.px)**2+(py-a.py)**2);
      if (d < 28 && d < bd) { bd = d; best = i; }
    });
    return best;
  }

  function updateBeamHUD() {
    const bl = root.querySelector('#bb-bl');
    if (bl) bl.textContent = t('beamsLeft').replace('{n}', G.lvl.maxBeams - G.beamsUsed);
  }

  function testBridge() {
    if (G.state !== 'build') return;
    const start = G.lvl.startAnchor, end = G.lvl.endAnchor;
    const connected = isConnected(start, end);
    if (!connected) {
      flashMsg(t('buildPath'), '#f87171'); return;
    }
    G.state = 'testing';
    const sa = G.anchors[start];
    G.robot = { x: sa.px - ROBOT_RADIUS*2, y: sa.py - ROBOT_RADIUS, vx: G.lvl.robotSpeed * 0.016, vy:0, alive:true, crossed:false };
    G.beams.forEach(b => { b.stress = 0; b.broken = false; });
    root.querySelector('#bb-test').disabled = true;
  }

  function isConnected(a, b) {
    const visited = new Set([a]);
    const queue = [a];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === b) return true;
      G.beams.forEach(beam => {
        if (beam.a === cur && !visited.has(beam.b)) { visited.add(beam.b); queue.push(beam.b); }
        if (beam.b === cur && !visited.has(beam.a)) { visited.add(beam.a); queue.push(beam.a); }
      });
    }
    return false;
  }

  function flashMsg(msg, color) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.8);color:${color};padding:10px 20px;border-radius:10px;font-weight:700;font-size:.9rem;z-index:20;pointer-events:none`;
    el.textContent = msg; root.querySelector('.bb-host').appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  let lastTs = 0;
  function loop(ts) {
    const dt = Math.min((ts-lastTs)/1000, 0.05); lastTs = ts;
    if (G.state === 'testing') updateRobot(dt);
    updateParticles(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function updateRobot(dt) {
    const rob = G.robot;
    if (!rob || !rob.alive) return;

    rob.vy += 320 * dt;
    rob.x += rob.vx * W * dt;
    rob.y += rob.vy * dt;

    let supported = false;
    G.beams.forEach(b => {
      if (b.broken) return;
      const a = G.anchors[b.a], bpt = G.anchors[b.b];
      const minX = Math.min(a.px, bpt.px), maxX = Math.max(a.px, bpt.px);
      if (rob.x + ROBOT_RADIUS > minX && rob.x - ROBOT_RADIUS < maxX) {
        const t = (rob.x - a.px) / (bpt.px - a.px || 1);
        const beamY = a.py + t * (bpt.py - a.py);
        if (rob.y + ROBOT_RADIUS > beamY - 4 && rob.y + ROBOT_RADIUS < beamY + 18 && rob.vy >= 0) {
          rob.y = beamY - ROBOT_RADIUS; rob.vy = 0;
          supported = true;
          // Stress scales with beam length — long horizontal beams fail quickly
          const beamLen = Math.sqrt((bpt.px-a.px)**2+(bpt.py-a.py)**2);
          b.stress += (beamLen / 70) * dt * 3.0;
          if (b.stress > BEAM_MAX_STRESS) {
            b.broken = true;
            spawnBreak(a.px+(bpt.px-a.px)/2, a.py+(bpt.py-a.py)/2);
          }
        }
      }
    });

    if (rob.y > H + 60 && !rob.crossed) {
      rob.alive = false; spawnExplode(rob.x, rob.y - 40, '#f87171');
      setTimeout(() => failTest(), 600);
      return;
    }

    const ea = G.anchors[G.lvl.endAnchor];
    if (rob.x > ea.px - ROBOT_RADIUS*2 && !rob.crossed) {
      rob.crossed = true; spawnWin(ea.px, ea.py);
      setTimeout(() => winLevel(), 900);
    }
  }

  function spawnBreak(x, y) {
    for (let i=0;i<14;i++){const a=Math.random()*Math.PI*2,sp=60+Math.random()*80;G.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.5+Math.random()*.4,color:'#f87171',size:3+Math.random()*3});}
  }
  function spawnExplode(x, y, c) {
    for (let i=0;i<18;i++){const a=Math.random()*Math.PI*2,sp=50+Math.random()*100;G.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.5+Math.random()*.4,color:c,size:3+Math.random()*4});}
  }
  function spawnWin(x, y) {
    for (let i=0;i<28;i++){const a=i/28*Math.PI*2,sp=100+Math.random()*80;const cs=['#38bdf8','#fbbf24','#22c55e','#a855f7'];G.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.7+Math.random()*.5,color:cs[i%4],size:4+Math.random()*4});}
  }
  function updateParticles(dt) {
    G.particles=G.particles.filter(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.life-=dt;return p.life>0;});
  }

  function failTest() {
    G.state = 'build';
    root.querySelector('#bb-test').disabled = false;
    G.beams.forEach(b => b.stress = 0);
    flashMsg(t('collapsed'), '#f87171');
    G.robot = null;
  }

  function winLevel() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    const next = G.idx + 1;
    if (next > +localStorage.getItem('bb-lvl')||0) localStorage.setItem('bb-lvl', next);
    root.innerHTML = `<div class="bb-host"><div class="bb-overlay">
      <div style="font-size:2.8rem">✅</div>
      <div class="bb-title" style="font-size:1.6rem">${t('bridgeHolds')}</div>
      <div style="font-size:.85rem;color:#1e3a5f">${t('beamsUsed').replace('{u}', G.beamsUsed).replace('{n}', G.lvl.maxBeams)}</div>
      <div class="bb-prog">${LEVELS.map((_,i)=>`<div class="bb-pd ${i<next?'done':''}"></div>`).join('')}</div>
      ${next < LEVELS.length
        ? `<button class="bb-main-btn" id="bb-next">${t('nextLevel')}</button>`
        : `<button class="bb-main-btn" id="bb-next">${t('allDoneBtn')}</button>`}
      <button class="bb-sm-btn" id="bb-re">${t('replay')}</button>
      <button class="bb-sm-btn" id="bb-men">${t('menu')}</button>
    </div></div>`;
    root.querySelector('#bb-next').addEventListener('click', () => playLevel(next));
    root.querySelector('#bb-re').addEventListener('click', () => playLevel(G.idx));
    root.querySelector('#bb-men').addEventListener('click', showMenu);
  }

  function showAllDone() {
    root.innerHTML = `<div class="bb-host"><div class="bb-overlay">
      <div style="font-size:3rem">🏆</div>
      <div class="bb-title">${t('masterBuilder')}</div>
      <button class="bb-main-btn" id="bb-ag">${t('playAgain')}</button>
    </div></div>`;
    root.querySelector('#bb-ag').addEventListener('click', () => { localStorage.removeItem('bb-lvl'); showMenu(); });
  }

  /* ── RENDER ───────────────────────────── */
  function render() {
    if (!cx) return;
    const bg = cx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#040d18'); bg.addColorStop(1,'#061828');
    cx.fillStyle = bg; cx.fillRect(0,0,W,H);
    drawGround(); drawBeams(); drawAnchors();
    if (G.robot) drawRobot();
    drawParticles(); drawHoverPreview();
    drawHint();
  }

  function glow(color, blur) { cx.shadowColor=color; cx.shadowBlur=blur; }
  function noGlow() { cx.shadowBlur=0; }

  function drawGround() {
    const sa = G.anchors[G.lvl.startAnchor], ea = G.anchors[G.lvl.endAnchor];
    glow('#0284c7', 4);
    cx.fillStyle = '#0c1a30'; cx.strokeStyle = '#0369a1'; cx.lineWidth = 2;
    cx.fillRect(0, sa.py, sa.px + 10, H - sa.py);
    cx.beginPath(); cx.moveTo(0, sa.py); cx.lineTo(sa.px+10, sa.py); cx.stroke();
    cx.fillRect(ea.px - 10, ea.py, W - ea.px + 10, H - ea.py);
    cx.beginPath(); cx.moveTo(ea.px-10, ea.py); cx.lineTo(W, ea.py); cx.stroke();
    noGlow();
    const wg = cx.createLinearGradient(0, sa.py+20, 0, H);
    wg.addColorStop(0,'rgba(2,132,199,.15)'); wg.addColorStop(1,'rgba(2,132,199,.04)');
    cx.fillStyle = wg;
    cx.fillRect(sa.px+10, sa.py+20, ea.px-sa.px-20, H-sa.py-20);
    const t = performance.now()/1000;
    for (let i=0;i<3;i++) {
      const ly = sa.py + 30 + i*20 + Math.sin(t+i)*6;
      cx.strokeStyle = `rgba(56,189,248,${0.08+i*.03})`; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(sa.px+10, ly); cx.lineTo(ea.px-10, ly); cx.stroke();
    }
  }

  function drawBeams() {
    G.beams.forEach(b => {
      if (b.broken) return;
      const a = G.anchors[b.a], bpt = G.anchors[b.b];
      const stress = Math.min(1, b.stress / BEAM_MAX_STRESS);
      const color = stress < 0.4 ? '#38bdf8' : stress < 0.75 ? '#fbbf24' : '#f87171';
      glow(color, 4 + stress * 12);
      cx.strokeStyle = color; cx.lineWidth = 2.5 + stress * 1.5;
      cx.beginPath(); cx.moveTo(a.px, a.py); cx.lineTo(bpt.px, bpt.py); cx.stroke();
      noGlow();
    });
    G.beams.filter(b=>b.broken).forEach(b => {
      const a = G.anchors[b.a], bpt = G.anchors[b.b];
      cx.strokeStyle = 'rgba(248,113,113,.2)'; cx.lineWidth = 1.5;
      cx.setLineDash([4,4]); cx.beginPath(); cx.moveTo(a.px,a.py); cx.lineTo(bpt.px,bpt.py); cx.stroke();
      cx.setLineDash([]);
    });
  }

  function drawAnchors() {
    G.anchors.forEach((a, i) => {
      const isStart = i === G.lvl.startAnchor, isEnd = i === G.lvl.endAnchor;
      const isSel = i === G.selectedAnchor, isHov = i === G.hoverAnchor;
      const color = isStart ? '#22c55e' : isEnd ? '#f59e0b' : isSel ? '#38bdf8' : isHov ? '#7dd3fc' : '#1e4e6b';
      glow(color, isSel||isHov ? 16 : 6);
      cx.fillStyle = color;
      cx.beginPath(); cx.arc(a.px, a.py, isStart||isEnd ? 10 : 7, 0, Math.PI*2); cx.fill();
      if (isStart) { cx.font='14px serif'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText('🚀', a.px, a.py-22); }
      if (isEnd)   { cx.font='14px serif'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText('🏁', a.px, a.py-22); }
      noGlow();
    });
  }

  function drawRobot() {
    const rob = G.robot;
    cx.save(); cx.translate(rob.x, rob.y);
    glow('#38bdf8', 14);
    cx.fillStyle = '#38bdf8';
    cx.fillRect(-ROBOT_RADIUS, -ROBOT_RADIUS, ROBOT_RADIUS*2, ROBOT_RADIUS*1.5);
    cx.fillStyle = '#0ea5e9';
    cx.fillRect(-ROBOT_RADIUS*.6, -ROBOT_RADIUS*1.7, ROBOT_RADIUS*1.2, ROBOT_RADIUS*.8);
    cx.fillStyle = '#fff';
    cx.fillRect(-ROBOT_RADIUS*.45, -ROBOT_RADIUS*1.6, ROBOT_RADIUS*.35, ROBOT_RADIUS*.35);
    cx.fillRect(ROBOT_RADIUS*.1, -ROBOT_RADIUS*1.6, ROBOT_RADIUS*.35, ROBOT_RADIUS*.35);
    cx.fillStyle = '#0284c7';
    cx.beginPath(); cx.arc(-ROBOT_RADIUS*.5, ROBOT_RADIUS*.5+2, ROBOT_RADIUS*.4, 0, Math.PI*2); cx.fill();
    cx.beginPath(); cx.arc(ROBOT_RADIUS*.5, ROBOT_RADIUS*.5+2, ROBOT_RADIUS*.4, 0, Math.PI*2); cx.fill();
    noGlow(); cx.restore();
  }

  function drawHoverPreview() {
    if (G.state !== 'build' || G.mode !== 'build') return;
    if (G.selectedAnchor !== -1 && G.hoverAnchor !== -1 && G.hoverAnchor !== G.selectedAnchor) {
      const a = G.anchors[G.selectedAnchor], b = G.anchors[G.hoverAnchor];
      const beamLen = Math.sqrt((a.px-b.px)**2+(a.py-b.py)**2);
      const tooLong = beamLen > W * MAX_BEAM_FRACTION;
      cx.strokeStyle = tooLong ? 'rgba(248,113,113,.4)' : 'rgba(56,189,248,.35)';
      cx.lineWidth = 2; cx.setLineDash([6,6]);
      cx.beginPath(); cx.moveTo(a.px,a.py); cx.lineTo(b.px,b.py); cx.stroke();
      cx.setLineDash([]);
    } else if (G.selectedAnchor !== -1) {
      const a = G.anchors[G.selectedAnchor];
      cx.strokeStyle = 'rgba(56,189,248,.3)'; cx.lineWidth = 1.5; cx.setLineDash([4,4]);
      cx.beginPath(); cx.moveTo(a.px,a.py); cx.lineTo(G.mouseX,G.mouseY); cx.stroke();
      cx.setLineDash([]);
    }
  }

  function drawParticles() {
    G.particles.forEach(p => {
      const a = p.life / 0.5;
      glow(p.color, 8); cx.globalAlpha = Math.min(1, a);
      cx.fillStyle = p.color; cx.beginPath(); cx.arc(p.x, p.y, p.size*Math.min(1,a), 0, Math.PI*2); cx.fill();
    });
    cx.globalAlpha = 1; noGlow();
  }

  function drawHint() {
    const t = performance.now()/1000;
    if (t < 4) {
      cx.globalAlpha = Math.min(1, Math.min(t*.8, (4-t)*2));
      cx.fillStyle = '#1e3a5f'; cx.font = '13px sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'top';
      cx.fillText(_lvl(G.idx).hint || G.lvl.hint, W/2, 46);
      cx.globalAlpha = 1;
    }
  }

  if (_has) {
    const apply = () => GameData.load('bridge-builder').then(d => {
      if (t.use) t.use(d.i18n);
      if (root) { try { cancelAnimationFrame(raf); } catch (e) {} showMenu(); }
    });
    apply();
    document.addEventListener('langchange', apply);
  }

  return { init };
})();
