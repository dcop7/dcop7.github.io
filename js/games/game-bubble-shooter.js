/* ══════════════════════════════════════════════════════════════════
   Bolhas (Bubble Shooter) — grelha hexagonal de bolhas; aponta, dispara
   (com ressalto nas paredes) e junta 3+ da mesma cor. O que ficar sem
   ligação ao teto cai (e vale o dobro). Falhar várias vezes seguidas
   faz o teto descer (Aventura) ou nascer uma fila nova (Infinito).
   Bolhas especiais: bomba (rebenta à volta) e arco-íris (serve a
   qualquer cor). Mira com linha de ressalto (mais curta nas difíceis).
══════════════════════════════════════════════════════════════════ */
const BubbleShooterGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const R = 19, D = R * 2, RH = R * Math.sqrt(3), LEFT = 10, TOP = 66, SPEED = 1150;
  const PAL = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316'];
  const DIFF = {
    easy:   { colors: 4, miss: 7, guide: 'full' },
    medium: { colors: 5, miss: 5, guide: 'bounce' },
    hard:   { colors: 6, miss: 4, guide: 'short' },
  };

  const odd = (G, r) => (r + G.shift) % 2 === 1;
  const rowLen = (G, r) => (odd(G, r) ? 9 : 10);
  const cx = (G, r, c) => LEFT + R + c * D + (odd(G, r) ? R : 0);
  const cy = (G, r) => TOP + (r + G.ceil) * RH + R;
  function nbrs(G, r, c) {
    const o = odd(G, r);
    return [[r, c - 1], [r, c + 1], [r - 1, o ? c : c - 1], [r - 1, o ? c + 1 : c], [r + 1, o ? c : c - 1], [r + 1, o ? c + 1 : c]]
      .filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < rowLen(G, rr));
  }
  const at = (G, r, c) => (G.grid[r] ? G.grid[r][c] : null);
  function set(G, r, c, v) { while (G.grid.length <= r) G.grid.push([]); G.grid[r][c] = v; }

  /* só verifica as células perto do ponto (mira + bolha em voo correm isto muitas vezes) */
  function hitsGrid(G, x, y) {
    if (y <= cy(G, 0)) return true;
    const r0 = Math.round((y - TOP - R) / RH - G.ceil);
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) {
      const row = G.grid[r]; if (!row) continue;
      const c0 = Math.round((x - LEFT - R - (odd(G, r) ? R : 0)) / D);
      for (let c = c0 - 1; c <= c0 + 1; c++) if (row[c] && Math.hypot(cx(G, r, c) - x, cy(G, r) - y) < D * .86) return true;
    }
    return false;
  }

  function colorsInGrid(G) { const s = new Set(); G.grid.forEach(row => row && row.forEach(b => b && b.c >= 0 && s.add(b.c))); return [...s]; }
  function nextColor(G) {
    const inG = colorsInGrid(G);
    const pool = inG.length ? inG : [...Array(G.ncol).keys()];
    return U.pick(pool);
  }
  function makeShot(G) {
    const r = Math.random();
    if (G.shots > 6 && r < .045) return { c: -1, sp: 'bomb' };
    if (G.shots > 6 && r < .09) return { c: -2, sp: 'rainbow' };
    return { c: nextColor(G) };
  }

  function buildLevel(G, n) {
    G.grid = []; G.shift = 0; G.ceil = 0; G.miss = 0;
    G.ncol = Math.min(G.cfg.colors, 3 + Math.floor((n + 1) / 2));
    const rows = Math.min(11, 4 + n);
    const pat = n % 4;
    for (let r = 0; r < rows; r++) {
      const L = rowLen(G, r);
      for (let c = 0; c < L; c++) {
        let col;
        if (pat === 0) col = Math.floor(Math.random() * G.ncol);
        else if (pat === 1) col = Math.floor(r / 2) % G.ncol;                           /* faixas */
        else if (pat === 2) col = Math.floor((c + (r % 2)) / 2) % G.ncol;               /* colunas */
        else col = (Math.abs(c - 4.5) + r) % G.ncol | 0;                              /* losangos */
        if (Math.random() < .25) col = Math.floor(Math.random() * G.ncol);
        if (pat === 3 && Math.abs(c - 4.5) > 3.5 + r * .6) continue;
        set(G, r, c, { c: col });
      }
    }
    G.cur = { c: nextColor(G) }; G.next = { c: nextColor(G) };
  }

  function setup(api, o) {
    const mode = o.mode || 'levels';
    const G = { mode, cfg: DIFF[o.diff] || DIFF.medium, level: 1, score: 0, popped: 0, dropped: 0, shots: 0, aim: -Math.PI / 2, aiming: false, fly: null, fx: [], falling: [], t: 0, bestChain: 0 };
    if (mode === 'endless') { G.cfg = { ...G.cfg }; buildLevel(G, 3); }
    else buildLevel(G, 1);
    return G;
  }

  const shooter = api => ({ x: api.W / 2, y: api.H - 70 });

  function setAim(G, api, x, y) {
    const s = shooter(api);
    let a = Math.atan2(y - s.y, x - s.x);
    if (a > 0) a = x < s.x ? -Math.PI + .12 : -.12;
    G.aim = U.clamp(a, -Math.PI + .12, -.12);
  }

  function fire(G, api) {
    if (G.fly || G.over || G.lock) return;
    const s = shooter(api);
    G.fly = { x: s.x, y: s.y, vx: Math.cos(G.aim) * SPEED, vy: Math.sin(G.aim) * SPEED, b: G.cur };
    G.cur = G.next; G.next = makeShot(G); G.shots++;
    api.sfx.tone(520, .06, 'triangle', .06, 0, 820);
  }

  function swap(G, api) { if (G.fly || G.over) return; [G.cur, G.next] = [G.next, G.cur]; api.sfx.tone(700, .04, 'sine', .05); }

  /* célula livre mais próxima do ponto de impacto (e agarrada a algo) */
  function snap(G, x, y) {
    const rApprox = Math.round((y - TOP - R) / RH - G.ceil);
    let best = null, bd = Infinity;
    for (let r = Math.max(0, rApprox - 1); r <= rApprox + 1; r++) {
      for (let c = 0; c < rowLen(G, r); c++) {
        if (at(G, r, c)) continue;
        const attached = r === 0 || nbrs(G, r, c).some(([rr, cc]) => at(G, rr, cc));
        if (!attached) continue;
        const d = Math.hypot(cx(G, r, c) - x, cy(G, r) - y);
        if (d < bd) { bd = d; best = [r, c]; }
      }
    }
    return best;
  }

  function flood(G, r, c, test) {
    const seen = new Set([r + ',' + c]), out = [[r, c]], st = [[r, c]];
    while (st.length) { const [a, b] = st.pop(); nbrs(G, a, b).forEach(([rr, cc]) => { const k = rr + ',' + cc, v = at(G, rr, cc); if (!seen.has(k) && v && test(v)) { seen.add(k); out.push([rr, cc]); st.push([rr, cc]); } }); }
    return out;
  }

  function land(G, api, r, c, b) {
    const W = api.W;
    if (b.sp === 'rainbow') {
      /* escolhe a cor vizinha que faz o maior grupo */
      let best = null, bn = 0;
      new Set(nbrs(G, r, c).map(([rr, cc]) => at(G, rr, cc)).filter(v => v && v.c >= 0).map(v => v.c)).forEach(col => {
        set(G, r, c, { c: col }); const n = flood(G, r, c, v => v.c === col).length; if (n > bn) { bn = n; best = col; }
      });
      b = { c: best != null ? best : nextColor(G) };
    }
    set(G, r, c, b);
    let popped = [];
    if (b.sp === 'bomb') {
      popped = [[r, c]];
      for (let rr = r - 2; rr <= r + 2; rr++) for (let cc = 0; cc < rowLen(G, rr); cc++) if (at(G, rr, cc) && Math.hypot(cx(G, rr, cc) - cx(G, r, c), cy(G, rr) - cy(G, r)) < D * 1.9 && !(rr === r && cc === c)) popped.push([rr, cc]);
      api.shake(8, .25); api.sfx.noise(.3, .15, 0, 500, 'lowpass');
    } else {
      const grp = flood(G, r, c, v => v.c === b.c);
      if (grp.length >= 3) popped = grp;
    }
    if (popped.length) {
      G.miss = 0;
      popped.forEach(([rr, cc], i) => {
        const v = at(G, rr, cc); G.grid[rr][cc] = null;
        G.fx.push({ x: cx(G, rr, cc), y: cy(G, rr), c: v.c, t: -i * .025 });
      });
      G.popped += popped.length;
      const pts = popped.length * 10 + Math.max(0, popped.length - 3) * 10;
      G.score += pts;
      api.sfx.arp(popped.slice(0, 6).map((_, i) => 520 + i * 80), .035, .07, 'sine', .06); api.vibe(10);
      /* tudo o que já não chega ao teto cai */
      const anchored = new Set();
      (G.grid[0] || []).forEach((v, cc) => { if (v) flood(G, 0, cc, () => true).forEach(([a, bb]) => anchored.add(a + ',' + bb)); });
      let drops = 0;
      G.grid.forEach((row, rr) => row && row.forEach((v, cc) => {
        if (v && !anchored.has(rr + ',' + cc)) { G.falling.push({ x: cx(G, rr, cc), y: cy(G, rr), vx: U.rand(-60, 60), vy: U.rand(-80, 0), c: v.c }); row[cc] = null; drops++; }
      }));
      if (drops) { G.dropped += drops; G.score += drops * 20; api.float(W / 2, cy(G, r) + 30, `+${drops * 20} a cair!`, '#fde047', 18); api.sfx.arp([784, 988, 1175], .05, .1, 'triangle', .06); }
      G.bestChain = Math.max(G.bestChain, popped.length + drops);
      api.float(cx(G, r, c), cy(G, r), '+' + pts, '#fff', 16);
    } else {
      G.miss++;
      api.sfx.tone(260, .06, 'triangle', .05);
      if (G.miss >= G.cfg.miss) {
        G.miss = 0;
        if (G.mode === 'endless') pushRow(G, api); else { G.ceil++; api.shake(5, .2); api.sfx.noise(.2, .08, 0, 300, 'lowpass'); }
      }
    }
    trimRows(G);
    /* a bolha carregada nunca fica com uma cor que já não existe */
    const cols = colorsInGrid(G);
    [G.cur, G.next].forEach(q => { if (q.c >= 0 && cols.length && !cols.includes(q.c)) q.c = U.pick(cols); });
    checkEnd(G, api);
  }

  function pushRow(G, api) {
    G.shift ^= 1; G.grid.unshift([]);
    for (let c = 0; c < rowLen(G, 0); c++) G.grid[0][c] = { c: Math.floor(Math.random() * G.ncol) };
    api.shake(4, .2); api.sfx.noise(.2, .08, 0, 300, 'lowpass');
  }
  function trimRows(G) { while (G.grid.length && !(G.grid[G.grid.length - 1] || []).some(Boolean)) G.grid.pop(); }

  function checkEnd(G, api) {
    const s = shooter(api), limit = s.y - 46;
    const lowest = G.grid.reduce((m, row, r) => (row && row.some(Boolean) ? r : m), -1);
    if (lowest >= 0 && cy(G, lowest) + R > limit) {
      G.over = true;
      api.over({ score: G.score, won: false, delay: 700, title: 'As bolhas chegaram cá abaixo', icon: '🫧', stats: [['Nível', G.mode === 'levels' ? G.level : '∞'], ['Rebentadas', G.popped], ['Caídas', G.dropped]], meta: { level: G.level } });
      return;
    }
    if (lowest < 0) {
      if (G.mode === 'endless') { for (let i = 0; i < 4; i++) pushRow(G, api); return; }
      G.lock = true;
      const bonus = 200 + G.level * 50;
      G.score += bonus;
      api.sfx.win();
      setTimeout(() => api.panel({ icon: '🫧', title: `Nível ${G.level} limpo!`, big: '+' + bonus, sub: `Pontuação: ${G.score}`,
        buttons: [{ label: '▶ Nível ' + (G.level + 1), primary: true, fn: () => { G.level++; buildLevel(G, G.level); G.lock = false; api.resume(); api.banner('Nível ' + G.level, G.ncol + ' cores'); } },
          { label: 'Terminar aqui', fn: () => api.over({ score: G.score, won: true, delay: 0, title: 'Boa partida!', icon: '🫧', stats: [['Níveis', G.level], ['Rebentadas', G.popped], ['Caídas', G.dropped]], meta: { level: G.level } }) }] }), 500);
    }
  }

  function update(G, dt, api) {
    const W = api.W;
    G.t += dt;
    const f = G.fly;
    if (f) {
      const sub = 6, sdt = dt / sub;
      for (let k = 0; k < sub && G.fly; k++) {
        f.x += f.vx * sdt; f.y += f.vy * sdt;
        if (f.x < LEFT + R) { f.x = LEFT + R; f.vx = Math.abs(f.vx); api.sfx.tone(400, .02, 'sine', .03); }
        if (f.x > W - LEFT - R + 2) { f.x = W - LEFT - R + 2; f.vx = -Math.abs(f.vx); api.sfx.tone(400, .02, 'sine', .03); }
        if (hitsGrid(G, f.x, f.y)) {
          const cell = snap(G, f.x, f.y);
          G.fly = null;
          if (cell) land(G, api, cell[0], cell[1], f.b);
        }
      }
    }
    G.fx.forEach(p => { p.t += dt; }); G.fx = G.fx.filter(p => p.t < .35);
    G.falling.forEach(p => { p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    G.falling = G.falling.filter(p => p.y < api.H + 40);
  }

  /* trajetória prevista da mira (ressaltos nas paredes) */
  function aimPath(G, api) {
    const s = shooter(api), pts = [[s.x, s.y]];
    let x = s.x, y = s.y, vx = Math.cos(G.aim), vy = Math.sin(G.aim);
    const maxLen = G.cfg.guide === 'short' ? 150 : 2000, maxB = G.cfg.guide === 'full' ? 3 : 1;
    let len = 0, bounces = 0, landing = null;
    for (let i = 0; i < 400 && len < maxLen; i++) {
      x += vx * 6; y += vy * 6; len += 6;
      if (x < LEFT + R || x > api.W - LEFT - R + 2) { if (bounces >= maxB) break; vx = -vx; bounces++; pts.push([x, y]); }
      if (hitsGrid(G, x, y)) { landing = snap(G, x, y); break; }
    }
    pts.push([x, y]);
    return { pts, landing: G.cfg.guide === 'short' ? null : landing };
  }

  function bubble(ctx, x, y, c, r, a) {
    ctx.globalAlpha = a == null ? 1 : a;
    if (c === -1) { /* bomba */
      const g = ctx.createRadialGradient(x - r * .35, y - r * .35, 1, x, y, r); g.addColorStop(0, '#6b7280'); g.addColorStop(1, '#030712');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fde047'; ctx.font = `800 ${r}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✸', x, y + 1);
    } else if (c === -2) { /* arco-íris */
      const g = ctx.createConicGradient ? ctx.createConicGradient(0, x, y) : null;
      if (g) { PAL.forEach((p, i) => g.addColorStop(i / PAL.length, p)); g.addColorStop(1, PAL[0]); ctx.fillStyle = g; } else ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
    } else {
      const g = ctx.createRadialGradient(x - r * .38, y - r * .42, r * .1, x, y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.25, PAL[c]); g.addColorStop(1, shade(PAL[c]));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - r * .35, y - r * .45, r * .28, r * .16, -.6, 0, 6.3); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const shade = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * .45 | 0},${(n >> 8 & 255) * .45 | 0},${(n & 255) * .45 | 0})`; };

  function draw(G, ctx, W, H, api) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0b0a1f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(167,139,250,${.03 + (i % 3) * .015})`; ctx.beginPath(); ctx.arc((i * 131 + G.t * 6) % W, (i * 197) % H, 20 + (i % 4) * 14, 0, 6.3); ctx.fill(); }
    /* teto (desce na Aventura) */
    const ceilY = TOP + G.ceil * RH;
    ctx.fillStyle = '#312e81'; ctx.fillRect(0, 0, W, ceilY);
    ctx.fillStyle = '#6366f1'; ctx.fillRect(0, ceilY - 4, W, 4);
    /* linha de perigo */
    const s = shooter(api), lim = s.y - 46;
    ctx.strokeStyle = 'rgba(248,113,113,.4)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, lim); ctx.lineTo(W, lim); ctx.stroke(); ctx.setLineDash([]);
    G.grid.forEach((row, r) => row && row.forEach((v, c) => { if (v) bubble(ctx, cx(G, r, c), cy(G, r), v.c, R - 1); }));
    G.fx.forEach(p => { if (p.t < 0) { bubble(ctx, p.x, p.y, p.c, R - 1); return; } const k = p.t / .35; ctx.strokeStyle = p.c >= 0 ? PAL[p.c] : '#fde047'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R * (1 + k), 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; });
    G.falling.forEach(p => bubble(ctx, p.x, p.y, p.c, R - 1, .9));
    /* mira */
    if (!G.fly && !G.over) {
      const ap = aimPath(G, api);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([2, 10]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ap.pts[0][0], ap.pts[0][1]); ap.pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
      if (ap.landing) { const [lr, lc] = ap.landing; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx(G, lr, lc), cy(G, lr), R - 3, 0, 6.3); ctx.stroke(); }
    }
    /* canhão */
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(G.aim + Math.PI / 2);
    ctx.fillStyle = '#4338ca'; U.rr(ctx, -9, -44, 18, 40, 6); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#312e81'; ctx.beginPath(); ctx.arc(s.x, s.y + 6, 32, Math.PI, 0); ctx.fill();
    if (G.fly) bubble(ctx, G.fly.x, G.fly.y, G.fly.b.c, R - 1);
    else bubble(ctx, s.x, s.y, G.cur.c, R - 1);
    /* próxima (toca para trocar) */
    const nx = s.x - 78, ny = s.y + 16;
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(nx, ny, R + 4, 0, 6.3); ctx.fill();
    bubble(ctx, nx, ny, G.next.c, R - 5);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('trocar', nx, ny + R + 12);
    /* falhas até o teto descer */
    for (let i = 0; i < G.cfg.miss; i++) { ctx.fillStyle = i < G.cfg.miss - G.miss ? '#a5b4fc' : 'rgba(165,180,252,.18)'; ctx.beginPath(); ctx.arc(s.x + 60 + i * 11, s.y + 20, 4, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'left'; ctx.fillText(G.mode === 'endless' ? 'nova fila' : 'teto desce', s.x + 56, s.y + 38);
  }

  const onNext = (G, api, x, y) => { const s = shooter(api); return Math.hypot(x - (s.x - 78), y - (s.y + 16)) < R + 12; };

  return ArcadeKit.create({
    id: 'bubble-shooter', title: 'Bolhas', icon: '🫧',
    accent: '#a78bfa', accent2: '#f472b6', bg: '#0b0a1f',
    tagline: 'Aponta, ressalta nas paredes e junta três da mesma cor. O que ficar pendurado cai.',
    view: { w: 400 },
    modes: [
      { id: 'levels', icon: '🗺️', name: 'Aventura', desc: 'Limpa a grelha para passar de nível. Falhar muito faz o teto descer.' },
      { id: 'endless', icon: '♾️', name: 'Infinito', desc: 'Nascem filas novas lá em cima. Aguenta o máximo possível.' },
    ],
    how: [
      '<b>Rato:</b> aponta com o cursor e clica para disparar. <b>Toque:</b> arrasta para apontar e larga para disparar. A linha mostra o ressalto.',
      'Junta 3 ou mais da mesma cor para rebentar. As que ficarem sem ligação ao teto caem e valem o dobro.',
      'Toca na bolha pequena para a trocar. ✸ é uma bomba; a de arco-íris serve a qualquer cor. Não deixes as bolhas passar a linha vermelha.',
    ],
    controls: ['🖱️ Apontar + clicar', '👆 Arrastar + largar', '⌨️ ← → + Espaço'],
    ready: { title: 'Toca para começar', hint: 'Aponta e dispara — junta 3 da mesma cor.' },
    setup, update, draw,
    down: (G, x, y, api, e) => {
      if (onNext(G, api, x, y)) { swap(G, api); G.aiming = false; return; }
      setAim(G, api, x, y);
      if (e.pointerType === 'mouse') fire(G, api); else G.aiming = true;
    },
    move: (G, x, y, api, e, isDown) => { if (e.pointerType === 'mouse' || (isDown && G.aiming)) setAim(G, api, x, y); },
    up: (G, x, y, api, e) => { if (e.pointerType !== 'mouse' && G.aiming) { G.aiming = false; if (y < shooter(api).y - 10) fire(G, api); } },
    key: (G, e, api) => {
      if (e.key === 'ArrowLeft') { G.aim = U.clamp(G.aim - .06, -Math.PI + .12, -.12); return true; }
      if (e.key === 'ArrowRight') { G.aim = U.clamp(G.aim + .06, -Math.PI + .12, -.12); return true; }
      if (e.key === ' ' || e.key === 'ArrowUp') { fire(G, api); return true; }
      if (e.key === 'x' || e.key === 'Shift') { swap(G, api); return true; }
    },
    hud: G => [['Pontos', G.score], G.mode === 'levels' ? ['Nível', G.level] : ['Rebentadas', G.popped]],
    achievements: [
      { id: 'bs.l5',   name: 'Borbulhante',     icon: '🫧', desc: 'Chega ao nível 5 das Bolhas.', test: c => ((c.result.meta || {}).level || 0) >= 5 },
      { id: 'bs.3k',   name: 'Chuva de Bolhas', icon: '🌧️', desc: 'Faz 3000 pontos nas Bolhas.', test: c => (c.result.score || 0) >= 3000 },
    ],
  });
})();
