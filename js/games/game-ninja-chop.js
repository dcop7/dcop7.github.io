/* ══════════════════════════════════════════════════════════════════
   Corte Ninja (Ninja Chop) — fruta atirada ao ar; corta-a com o rasto
   do rato ou do dedo, foge das bombas. Rato: basta mover depressa (ou
   arrastar com o botão premido); toque: deslizar o dedo. Corte =
   interseção segmento-círculo entre dois pontos consecutivos do rasto.
   Modos: Clássico (3 falhas) e Contra-relógio (60 s).
══════════════════════════════════════════════════════════════════ */
const NinjaChopGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const FRUITS = [
    { k: 'melon',  r: 36, skin: ['#4d7c0f', '#166534'], flesh: '#f43f5e', rind: '#bbf7d0', juice: '#fb7185', pts: 1 },
    { k: 'orange', r: 25, skin: ['#fdba74', '#ea580c'], flesh: '#fb923c', rind: '#fed7aa', juice: '#fdba74', pts: 1 },
    { k: 'apple',  r: 25, skin: ['#fca5a5', '#b91c1c'], flesh: '#fef3c7', rind: '#fecaca', juice: '#fde68a', pts: 1 },
    { k: 'kiwi',   r: 22, skin: ['#a16207', '#713f12'], flesh: '#84cc16', rind: '#d9f99d', juice: '#a3e635', pts: 1 },
    { k: 'lemon',  r: 23, skin: ['#fef08a', '#ca8a04'], flesh: '#fde047', rind: '#fef9c3', juice: '#fef08a', pts: 1 },
    { k: 'plum',   r: 21, skin: ['#c084fc', '#6b21a8'], flesh: '#f5d0fe', rind: '#e9d5ff', juice: '#d8b4fe', pts: 1 },
  ];
  const DIFF = {
    easy:   { every: [1.5, .95], bomb: [.05, .14], burst: 3 },
    medium: { every: [1.3, .8],  bomb: [.08, .2],  burst: 4 },
    hard:   { every: [1.15, .65], bomb: [.12, .27], burst: 5 },
  };

  function setup(api, o) {
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { const G = api.G3; if (G && !G.r3) try { build3D(G, api); } catch (e) { console.warn('[ninja] 3D falhou', e); } }).catch(() => {});
    return api.G3 = {
      cfg: DIFF[o.diff] || DIFF.medium, mode: o.mode || 'classic',
      items: [], halves: [], splats: [], trail: [],
      score: 0, sliced: 0, missed: 0, lives: 3, t: 0, spawnT: .6, timeLeft: 60,
      swipeN: 0, swipeT: 0, bestSwipe: 0, slow: 0, over: false, lastP: null, down: false,
    };
  }

  function spawn(G, api) {
    const W = api.W, H = api.H, c = G.cfg;
    const k = Math.min(1, G.t / 90);
    const n = U.randi(1, Math.min(c.burst, 1 + Math.floor(1 + k * c.burst)));
    const pBomb = U.lerp(c.bomb[0], c.bomb[1], k);
    const g = H * 1.3;
    for (let i = 0; i < n; i++) {
      const x = U.rand(W * .15, W * .85);
      const h = U.rand(.48, .82) * H;
      const vy = -Math.sqrt(2 * g * h);
      const vx = (W / 2 - x) * U.rand(.25, .7) + U.rand(-40, 40);
      const bomb = G.t > 4 && Math.random() < pBomb && !(i === 0 && n === 1 && G.t < 8);
      const special = !bomb && Math.random() < .05 ? (G.mode === 'timed' || Math.random() < .5 ? 'gold' : 'ice') : null;
      const f = bomb ? { k: 'bomb', r: 25 } : special === 'gold' ? { k: 'gold', r: 26, skin: ['#fef08a', '#d97706'], flesh: '#fde047', rind: '#fef3c7', juice: '#fde047', pts: 10 } :
        special === 'ice' ? { k: 'ice', r: 26, skin: ['#e0f2fe', '#38bdf8'], flesh: '#bae6fd', rind: '#f0f9ff', juice: '#7dd3fc', pts: 3 } : U.pick(FRUITS);
      G.items.push({ ...f, x, y: H + f.r + 10, vx, vy, g, rot: Math.random() * 6, vr: U.rand(-3, 3), delay: i * U.rand(.05, .22), dead: false });
    }
    api.sfx.noise(.12, .05, 0, 600, 'lowpass');
  }

  function slice(G, api, it, ang) {
    it.dead = true;
    const W = api.W;
    if (it.k === 'bomb') {
      api.shake(16, .5); api.flash('#fff', .35); api.vibe([80, 40, 120]); api.hitstop(.12);
      api.sfx.noise(.6, .25, 0, 300, 'lowpass'); api.sfx.tone(90, .5, 'sawtooth', .08, 0, 40);
      for (let i = 0; i < 40; i++) api.spark({ x: it.x, y: it.y, vx: U.rand(-420, 420), vy: U.rand(-420, 300), color: U.pick(['#fde047', '#fb923c', '#ef4444', '#fff']), size: U.rand(2, 5), life: U.rand(.4, .9), gravity: 300 });
      if (G.mode === 'classic') { end(G, api, 'Cortaste uma bomba!'); }
      else { G.score = Math.max(0, G.score - 10); G.timeLeft = Math.max(0, G.timeLeft - 3); api.float(it.x, it.y, '−10  −3s', '#fca5a5', 22); }
      return;
    }
    G.sliced++; G.swipeN++;
    G.score += it.pts;
    if (it.k === 'ice') { G.slow = 3.5; api.banner('Tempo lento', '3 segundos'); }
    if (it.k === 'gold') { api.float(it.x, it.y - 30, '+10', '#fde047', 24); api.sfx.arp([988, 1319, 1568], .05, .12, 'sine', .08); }
    /* metades a afastarem-se na perpendicular do corte */
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    [-1, 1].forEach(s => G.halves.push({ ...it, x: it.x + nx * s * 4, y: it.y + ny * s * 4, vx: it.vx * .5 + nx * s * 120, vy: Math.min(it.vy, 0) * .3 + ny * s * 120 - 60, rot: ang + (s > 0 ? Math.PI : 0), vr: s * U.rand(2, 5), side: s, life: 2.5 }));
    for (let i = 0; i < 12; i++) api.spark({ x: it.x, y: it.y, vx: U.rand(-220, 220) + Math.cos(ang) * 120, vy: U.rand(-220, 120) + Math.sin(ang) * 120, color: it.juice, size: U.rand(2, 5), life: U.rand(.35, .7), gravity: 700 });
    G.splats.push({ x: it.x, y: it.y, r: it.r * U.rand(1.1, 1.6), c: it.juice, a: .5, rot: Math.random() * 6, k: Array.from({ length: 12 }, () => U.rand(.62, 1)), drops: Array.from({ length: 5 }, () => [U.rand(0, 6.28), U.rand(1.2, 1.9), U.rand(.08, .18)]) });
    if (G.splats.length > 14) G.splats.shift();
    api.sfx.noise(.09, .1, 0, 3200, 'highpass'); api.sfx.tone(520 + G.swipeN * 60, .06, 'triangle', .05);
    api.vibe(8);
  }

  function end(G, api, why) {
    if (G.over) return;
    G.over = true;
    const acc = G.sliced + G.missed ? Math.round(100 * G.sliced / (G.sliced + G.missed)) : 0;
    api.over({ score: G.score, won: G.mode === 'timed', delay: 1000, title: why, icon: G.mode === 'timed' ? '⏱️' : '💣',
      stats: [['Frutas', G.sliced], ['Melhor corte', G.bestSwipe + '×'], ['Precisão', acc + '%']], meta: { bestSwipe: G.bestSwipe } });
  }

  function cutAlong(G, api, ax, ay, bx, by) {
    const ang = Math.atan2(by - ay, bx - ax);
    for (const it of G.items) {
      if (it.dead || it.delay > 0) continue;
      if (U.segDist(it.x, it.y, ax, ay, bx, by) < it.r + 4) slice(G, api, it, ang);
      if (G.over) return;
    }
  }

  function update(G, dt, api) {
    const H = api.H;
    const sdt = G.slow > 0 ? dt * .4 : dt;
    G.slow = Math.max(0, G.slow - dt);
    G.t += dt;
    if (G.mode === 'timed') { G.timeLeft -= dt; if (G.timeLeft <= 0) { G.timeLeft = 0; end(G, api, 'Tempo!'); return; } }
    G.spawnT -= sdt;                    /* o gelo também abranda os lançamentos (senão a fruta acumula) */
    if (G.spawnT <= 0) { spawn(G, api); const k = Math.min(1, G.t / 90); G.spawnT = U.lerp(G.cfg.every[0], G.cfg.every[1], k) * U.rand(.8, 1.2) + (G.items.length > 5 ? .4 : 0); }

    for (const it of G.items) {
      if (it.delay > 0) { it.delay -= sdt; continue; }
      it.vy += it.g * sdt; it.x += it.vx * sdt; it.y += it.vy * sdt; it.rot += it.vr * sdt;
      if (it.k === 'bomb' && Math.random() < .5) api.spark({ x: it.x + Math.cos(it.rot - 1) * 22, y: it.y + Math.sin(it.rot - 1) * 22, vx: U.rand(-40, 40), vy: U.rand(-80, -10), color: '#fde047', size: 1.8, life: .25, gravity: 0 });
      if (it.vy > 0 && it.y > H + it.r + 20 && !it.dead) {
        it.dead = true;
        if (it.k !== 'bomb') {
          G.missed++;
          if (G.mode === 'classic') {
            G.lives--; api.sfx.tone(180, .15, 'square', .05); api.flash('#ef4444', .1);
            api.float(U.clamp(it.x, 30, api.W - 30), H - 40, '✕', '#ef4444', 30);
            if (G.lives <= 0) { end(G, api, 'Deixaste cair 3 frutas'); return; }
          }
        }
      }
    }
    G.items = G.items.filter(i => !i.dead);
    G.halves.forEach(h => { h.vy += h.g * sdt; h.x += h.vx * sdt; h.y += h.vy * sdt; h.rot += h.vr * sdt; h.life -= dt; });
    G.halves = G.halves.filter(h => h.life > 0 && h.y < H + 80);
    G.splats.forEach(s => { s.a = Math.max(0, s.a - dt * .06); });
    /* rasto */
    const now = G.t;
    G.trail = G.trail.filter(p => now - p.t < .14);
    if (G.swipeN && now - G.swipeT > .18) {
      if (G.swipeN >= 3) { const b = G.swipeN; api.slowmo(.35, .35); G.score += b; api.float(api.W / 2, api.H * .3, 'Combo ' + b + '! +' + b, '#fde047', 26); api.sfx.arp([659, 784, 988], .05, .1, 'triangle', .07); }
      G.bestSwipe = Math.max(G.bestSwipe, G.swipeN);
      G.swipeN = 0;
    }
  }

  function onMove(G, x, y, api, e, isDown) {
    /* velocidade medida no relógio real do evento (vários pointermove
       podem cair no mesmo frame) */
    const now = G.t, rt = ((e && e.timeStamp) || performance.now()) / 1000, lp = G.lastP;
    G.lastP = { x, y, t: now, rt };
    if (!lp) return;
    const dt = Math.max(1 / 500, rt - lp.rt), len = Math.hypot(x - lp.x, y - lp.y), spd = len / dt;
    const mouse = e.pointerType === 'mouse';
    const active = (isDown && spd > 220) || (mouse && spd > 1000);
    if (!active || len < 2) return;
    G.trail.push({ x, y, t: now }); if (G.trail.length === 1) G.trail.unshift({ x: lp.x, y: lp.y, t: now });
    G.swipeT = now;
    cutAlong(G, api, lp.x, lp.y, x, y);
  }

  /* ── desenho ── */
  function fruit(ctx, it, half) {
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
    const r = it.r;
    if (it.k === 'bomb') {
      const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, r);
      g.addColorStop(0, '#4b5563'); g.addColorStop(1, '#030712');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, 6.3); ctx.stroke();
      ctx.fillStyle = '#6b7280'; ctx.fillRect(-5, -r - 6, 10, 8);
      ctx.strokeStyle = '#d6b48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r - 6); ctx.quadraticCurveTo(8, -r - 14, 4, -r - 20); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', 0, 1);
      ctx.restore(); return;
    }
    if (half) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = it.skin[1]; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r - 3.5, 0, Math.PI); ctx.closePath(); ctx.fillStyle = it.rind; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r - 7, 0, Math.PI); ctx.closePath(); ctx.fillStyle = it.flesh; ctx.fill();
      if (it.k === 'melon' || it.k === 'kiwi') { ctx.fillStyle = '#111'; for (let i = 0; i < 6; i++) { const a = .3 + i * .45; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .55, Math.sin(a) * r * .55, 1.6, 3, a, 0, 6.3); ctx.fill(); } }
      if (it.k === 'orange' || it.k === 'lemon') { ctx.strokeStyle = it.rind; ctx.lineWidth = 1.5; for (let i = 1; i < 6; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r - 7), Math.sin(a) * (r - 7)); ctx.stroke(); } }
      ctx.restore(); return;
    }
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r);
    g.addColorStop(0, it.skin[0]); g.addColorStop(1, it.skin[1]);
    ctx.fillStyle = g;
    ctx.beginPath(); if (it.k === 'lemon') ctx.ellipse(0, 0, r * 1.15, r * .88, 0, 0, 6.3); else ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
    if (it.k === 'melon') { ctx.strokeStyle = 'rgba(20,83,45,.8)'; ctx.lineWidth = 4; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * r * .32, 0, r * .12, r * .95, 0, 0, 6.3); ctx.stroke(); } }
    if (it.k === 'apple' || it.k === 'plum') { ctx.strokeStyle = '#4b2e12'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -r + 3); ctx.lineTo(2, -r - 7); ctx.stroke(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.ellipse(8, -r - 4, 7, 3, -.4, 0, 6.3); ctx.fill(); }
    if (it.k === 'gold' || it.k === 'ice') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `800 ${r}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.k === 'gold' ? '★' : '❄', 0, 2); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .38, -r * .42, r * .22, r * .12, -.6, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════
     3D — fruta com volume e brilho a rodar no ar; ao cortar, duas
     metades que mostram a polpa (anéis, sementes) e se afastam a girar;
     manchas de sumo na tábua do dojo; bombas com rastilho a faiscar.
     O plano z=0 coincide com o ecrã (os golpes continuam exatos).
  ════════════════════════════════════════════════════════════════ */
  const _tx = {};
  function ctex(key, w, h, paint) {
    if (_tx[key]) return _tx[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.shared = true;
    return (_tx[key] = t);
  }
  function skinTex(f) {
    return ctex('skin:' + f.k, 256, 128, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, f.skin[0]); g.addColorStop(1, f.skin[1]);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      if (f.k === 'melon') { x.fillStyle = 'rgba(20,83,45,.85)'; for (let i = 0; i < 10; i++) { x.beginPath(); for (let y = 0; y <= h; y += 4) x.lineTo(i * w / 10 + Math.sin(y * .15 + i) * 5, y); for (let y = h; y >= 0; y -= 4) x.lineTo(i * w / 10 + 9 + Math.sin(y * .15 + i) * 5, y); x.fill(); } }
      if (f.k === 'orange' || f.k === 'lemon') { for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(0,0,0,.07)'; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1.2, 0, 6.3); x.fill(); } }
      if (f.k === 'kiwi') { for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '60,35,10' : '160,120,60'},.25)`; x.fillRect(Math.random() * w, Math.random() * h, 1, 2); } }
      if (f.k === 'apple' || f.k === 'plum') { for (let i = 0; i < 120; i++) { x.fillStyle = 'rgba(255,240,200,.18)'; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }
    });
  }
  function fleshTex(f) {
    return ctex('flesh:' + f.k, 128, 128, (x, w) => {
      const c = w / 2;
      x.fillStyle = f.skin[1]; x.beginPath(); x.arc(c, c, c, 0, 6.3); x.fill();
      x.fillStyle = f.rind; x.beginPath(); x.arc(c, c, c * .9, 0, 6.3); x.fill();
      const g = x.createRadialGradient(c, c, 2, c, c, c * .8); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, f.flesh); g.addColorStop(1, f.flesh);
      x.fillStyle = g; x.beginPath(); x.arc(c, c, c * .8, 0, 6.3); x.fill();
      if (f.k === 'orange' || f.k === 'lemon') { x.strokeStyle = f.rind; x.lineWidth = 3; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos(a) * c * .8, c + Math.sin(a) * c * .8); x.stroke(); } }
      if (f.k === 'melon' || f.k === 'kiwi') { x.fillStyle = '#111'; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, d = c * (f.k === 'kiwi' ? .38 : .5); x.beginPath(); x.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 2, 4.5, a, 0, 6.3); x.fill(); } if (f.k === 'kiwi') { x.fillStyle = '#f7fee7'; x.beginPath(); x.arc(c, c, c * .2, 0, 6.3); x.fill(); } }
      if (f.k === 'apple') { x.fillStyle = '#78350f'; [[-8, -4], [8, -4], [0, 8]].forEach(([dx, dy]) => { x.beginPath(); x.ellipse(c + dx, c + dy, 3, 5, 0, 0, 6.3); x.fill(); }); }
      if (f.k === 'plum' || f.k === 'gold') { x.fillStyle = f.skin[1]; x.beginPath(); x.ellipse(c, c, 10, 14, 0, 0, 6.3); x.fill(); }
    });
  }
  function splatTex() {
    return ctex('splat', 128, 128, (x) => {
      x.fillStyle = '#fff'; const pts = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * 6.283, r = 36 + Math.random() * 18; return [64 + Math.cos(a) * r, 64 + Math.sin(a) * r]; });
      x.beginPath(); pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; if (!i) x.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2); x.quadraticCurveTo(q[0], q[1], (q[0] + pts[(i + 2) % pts.length][0]) / 2, (q[1] + pts[(i + 2) % pts.length][1]) / 2); }); x.fill();
      for (let i = 0; i < 9; i++) { const a = Math.random() * 6.283, d = 48 + Math.random() * 12; x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + Math.random() * 5, 0, 6.3); x.fill(); }
    });
  }
  function fruitModel(f) {
    const g = new THREE.Group();
    if (f.k === 'bomb') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), Arcade3D.std('#111827', { metalness: .6, roughness: .35 })); b.castShadow = true; g.add(b);
      const band = new THREE.Mesh(new THREE.TorusGeometry(.93, .06, 8, 36), Arcade3D.glowMat('#ef4444')); band.rotation.x = Math.PI / 2 - .3; g.add(band);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.24, .28, .3, 12), Arcade3D.std('#6b7280', { metalness: .7, roughness: .3 })); cap.position.y = 1.02; g.add(cap);
      const fuse = new THREE.Mesh(new THREE.TorusGeometry(.35, .05, 6, 12, Math.PI), Arcade3D.std('#d6b48a')); fuse.position.set(.35, 1.18, 0); g.add(fuse);
      const sp = new THREE.Sprite(Arcade3D.glowSprite('#fde047')); sp.position.set(.7, 1.2, 0); sp.scale.set(.9, .9, 1); g.add(sp); g.userData.spark = sp;
      return g;
    }
    if (f.k === 'ice') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#bae6fd', emissive: '#38bdf8', emissiveIntensity: .35, transparent: true, opacity: .82, roughness: .05, metalness: .1, flatShading: true })); g.add(m); return g; }
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshStandardMaterial({ map: skinTex(f), roughness: f.k === 'apple' || f.k === 'plum' || f.k === 'gold' ? .25 : .55, metalness: f.k === 'gold' ? .8 : .02 }));
    if (f.k === 'lemon') m.scale.set(1.18, .88, .88);
    if (f.k === 'melon') m.scale.set(1.08, 1, 1);
    m.castShadow = true; g.add(m);
    if (f.k === 'apple' || f.k === 'plum' || f.k === 'gold') {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .4, 6), Arcade3D.std('#4b2e12')); st.position.y = 1.05; g.add(st);
      const lf = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), Arcade3D.std('#22c55e')); lf.scale.set(1.6, .35, .8); lf.position.set(.25, 1.12, 0); lf.rotation.z = -.4; g.add(lf);
    }
    if (f.k === 'gold') { const s2 = new THREE.Sprite(Arcade3D.glowSprite('#fde047')); s2.scale.set(3.4, 3.4, 1); g.add(s2); }
    return g;
  }
  function halfModel(f) {
    const g = new THREE.Group();
    const skin = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: skinTex(f), roughness: .5, side: THREE.DoubleSide }));
    skin.castShadow = true; g.add(skin);
    const face = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ map: fleshTex(f), roughness: .4 }));
    face.rotation.x = Math.PI / 2; g.add(face);
    return g;
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#fff7ed', ground: '#2a1a10', hemi: 1.0, sun: '#fff1dc', sunI: 2.4, fillC: '#fdba74', fillI: .4, normalBias: .8 });
    const cam = new THREE.PerspectiveCamera(42, 1, 10, 4000);
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
    for (let i = 0; i < 6; i++) { x.fillStyle = ['#3b2414', '#352012', '#40281a'][i % 3]; x.fillRect(i * 86, 0, 86, 512); x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(i * 86, 0, 3, 512); x.strokeStyle = 'rgba(255,220,180,.05)'; for (let k = 0; k < 7; k++) { x.beginPath(); const xx = i * 86 + 8 + k * 11; x.moveTo(xx, 0); x.bezierCurveTo(xx + 6, 170, xx - 6, 340, xx + 3, 512); x.stroke(); } }
    const wt = new THREE.CanvasTexture(c); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: wt, roughness: .85 }));
    board.position.z = -90; board.receiveShadow = true; scene.add(board);
    G.r3 = { renderer, scene, sun, cam, board, wt, pool: Arcade3D.pool(scene), spin: new WeakMap() };
    api.stage.style.background = '#140c07';
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, P = R.pool;
    Arcade3D.fit(api.stage, R.cam);
    const X = x => x - W / 2, Y = y => H / 2 - y;
    const D = (H / 2) / Math.tan(R.cam.fov * Math.PI / 360), [shx, shy] = api.shakeXY;
    R.cam.position.set(-shx, shy, D); R.cam.lookAt(-shx, shy, 0); R.cam.far = D + 600; R.cam.updateProjectionMatrix();
    const k = (D + 90) / D;
    R.board.scale.set(W * k * 1.05, H * k * 1.05, 1); R.wt.repeat.set(W / 520, 1);
    Arcade3D.sunAt(R.sun, 0, 0, 0, Math.max(W, H) * .7, [-.45, .6, 1]);
    P.begin();
    /* manchas de sumo na tábua */
    G.splats.forEach(sp => { const m = P.get('spl:' + sp.c, () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex(), color: new THREE.Color(sp.c).multiplyScalar(.8), transparent: true, depthWrite: false }))); m.position.set(X(sp.x) * k, Y(sp.y) * k, -89); m.rotation.z = sp.rot; m.scale.set(sp.r * 2.6 * k, sp.r * 2.6 * k, 1); m.material.opacity = Math.min(.85, sp.a * 1.7); });
    /* metades */
    G.halves.forEach(h => {
      const m = P.get('half:' + h.k, () => halfModel(h));
      m.position.set(X(h.x), Y(h.y), 0); m.scale.setScalar(h.r);
      m.rotation.set(h.side * .9, 0, -h.rot);
      m.traverse(o => { if (o.material) { o.material.transparent = h.life < 1; o.material.opacity = Math.min(1, h.life); } });
    });
    /* fruta e bombas inteiras */
    G.items.forEach(it => {
      if (it.delay > 0) return;
      const m = P.get('fruit:' + it.k, () => fruitModel(it));
      m.position.set(X(it.x), Y(it.y), 0); m.scale.setScalar(it.r);
      m.rotation.set(it.rot * .7, it.rot, -it.rot * .4);
      if (m.userData.spark) m.userData.spark.scale.setScalar(.6 + Math.random() * .6);
    });
    P.end();
    R.renderer.render(R.scene, R.cam);
    /* 2D por cima: gelo (câmara lenta), lâmina, vidas/tempo */
    if (G.slow > 0) { ctx.fillStyle = `rgba(125,211,252,${Math.min(.16, G.slow * .05)})`; ctx.fillRect(0, 0, W, H); }
    const tr = G.trail;
    if (tr.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < tr.length; i++) { const kk = i / tr.length; ctx.strokeStyle = `rgba(125,211,252,${kk * .55})`; ctx.lineWidth = 6 + kk * 12; ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke(); }
      ctx.restore();
      for (let i = 1; i < tr.length; i++) { const kk = i / tr.length; ctx.strokeStyle = `rgba(240,253,255,${kk})`; ctx.lineWidth = 1.5 + kk * 4; ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke(); }
    }
    if (G.mode === 'classic') {
      ctx.font = '800 26px system-ui'; ctx.textAlign = 'right';
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < 3 - G.lives ? '#ef4444' : 'rgba(255,255,255,.2)'; ctx.fillText('✕', W - 14 - i * 28, H - 18); }
    } else {
      const kk = G.timeLeft / 60;
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(16, H - 18, W - 32, 6);
      ctx.fillStyle = kk < .2 ? '#ef4444' : '#fbbf24'; ctx.fillRect(16, H - 18, (W - 32) * kk, 6);
    }
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    R.wt.dispose(); Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }
  function draw2D(G, ctx, W, H, api) {
    /* tábua do dojo */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a1a10'); bg.addColorStop(1, '#140c07');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,220,180,.04)'; ctx.lineWidth = 1;
    for (let x = 12; x < W; x += 23) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 6, H * .3, x - 6, H * .6, x + 3, H); ctx.stroke(); }
    const vg = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .3, W / 2, H * .5, Math.max(W, H) * .75);
    vg.addColorStop(0, 'rgba(255,190,120,.06)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    G.splats.forEach(s => {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.globalAlpha = s.a; ctx.fillStyle = s.c;
      /* mancha orgânica: contorno suave por curvas entre raios aleatórios + gotas soltas */
      const pts = s.k.map((k, i) => { const a = i / s.k.length * 6.283; return [Math.cos(a) * s.r * k, Math.sin(a) * s.r * k]; });
      ctx.beginPath(); ctx.moveTo((pts[0][0] + pts[11][0]) / 2, (pts[0][1] + pts[11][1]) / 2);
      pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }); ctx.fill();
      s.drops.forEach(([a, d, r]) => { ctx.beginPath(); ctx.arc(Math.cos(a) * s.r * d, Math.sin(a) * s.r * d, s.r * r, 0, 6.3); ctx.fill(); });
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    if (G.slow > 0) { ctx.fillStyle = `rgba(125,211,252,${Math.min(.18, G.slow * .06)})`; ctx.fillRect(0, 0, W, H); }
    G.halves.forEach(h => { ctx.globalAlpha = Math.min(1, h.life); fruit(ctx, h, true); });
    ctx.globalAlpha = 1;
    G.items.forEach(it => { if (it.delay <= 0) fruit(ctx, it, false); });
    /* lâmina */
    const tr = G.trail;
    if (tr.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        ctx.strokeStyle = `rgba(165,243,252,${k * .9})`; ctx.lineWidth = 2 + k * 7;
        ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tr[0].x, tr[0].y); tr.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    }
    /* vidas (clássico) ou tempo */
    if (G.mode === 'classic') {
      ctx.font = '800 26px system-ui'; ctx.textAlign = 'right';
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < 3 - G.lives ? '#ef4444' : 'rgba(255,255,255,.2)'; ctx.fillText('✕', W - 14 - i * 28, H - 18); }
    } else {
      const k = G.timeLeft / 60;
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(16, H - 18, W - 32, 6);
      ctx.fillStyle = k < .2 ? '#ef4444' : '#fbbf24'; ctx.fillRect(16, H - 18, (W - 32) * k, 6);
    }
  }

  return ArcadeKit.create({
    id: 'ninja-chop', title: 'Corte Ninja', icon: '🥷',
    accent: '#ef4444', accent2: '#fbbf24', bg: '#140c07', aspect: 'wide', transparent: true, destroy,
    tagline: 'Fruta pelo ar, bombas à mistura. Um golpe rápido corta tudo o que apanhar.',
    view: { w: 640 },
    modes: [
      { id: 'classic', icon: '🍉', name: 'Clássico', desc: 'Deixas cair 3 frutas ou cortas uma bomba e acabou.' },
      { id: 'timed', icon: '⏱️', name: 'Contra-relógio', desc: '60 segundos. Bombas tiram 10 pontos e 3 segundos.' },
    ],
    how: [
      '<b>Rato:</b> passa o cursor <b>depressa</b> pela fruta (ou arrasta com o botão premido). <b>Toque:</b> desliza o dedo.',
      'Cortar 3 ou mais frutas no mesmo golpe dá <b>combo</b>. ★ dourada vale 10; ❄ abranda o tempo.',
      'Foge das <b>bombas</b> ✕ — no Clássico acabam logo com o jogo.',
    ],
    controls: ['🖱️ Mover rápido / arrastar', '👆 Deslizar'],
    ready: { title: 'Toca para começar', hint: 'Desliza o dedo ou passa o rato depressa pela fruta.' },
    setup, update, draw,
    down: (G, x, y, api, e) => { G.lastP = { x, y, t: G.t, rt: ((e && e.timeStamp) || performance.now()) / 1000 }; },
    move: onMove,
    up: G => { G.lastP = null; },
    /* as falhas do Clássico já aparecem como ✕ no canto; o HUD mostra a fruta cortada */
    hud: G => [['Pontos', G.score], G.mode === 'timed' ? ['Tempo', Math.ceil(G.timeLeft) + 's', G.timeLeft < 10 ? 'hot' : ''] : ['Frutas', G.sliced]],
    achievements: [
      { id: 'nc.combo5', name: 'Golpe Duplo… Quíntuplo', icon: '🥷', desc: 'Corta 5 frutas num só golpe.', test: c => ((c.result.meta || {}).bestSwipe || 0) >= 5 },
      { id: 'nc.100',    name: 'Mestre da Lâmina',       icon: '🍉', desc: 'Faz 100 pontos no Corte Ninja.', test: c => (c.result.score || 0) >= 100 },
    ],
  });
})();
