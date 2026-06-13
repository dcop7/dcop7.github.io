/* ══════════════════════════════════════════════════════════════════
   WorkoutRig — a dependency-free 3D articulated mannequin for the
   Exercise section. A real forward-kinematics skeleton (joint hierarchy
   + rest pose) is posed from authored keyframe "clips", projected to a
   <canvas> with painter-sorted, depth-shaded capsule limbs and ball
   joints. One mannequin is reused for every exercise; each exercise is
   just a small set of joint-rotation keyframes (the "single model, many
   animations" design) — so it is tiny, fully offline and mobile-fast.

   Public API:
     WorkoutRig.create(canvas, opts) -> {
       setClip(clip), play(), pause(), setPlaying(b),
       setSpeed(mult), setView(azDeg, elDeg), orbitFrom(canvas),
       setPhase(0..1), getPhase(), onPhase(cb), resize(), dispose()
     }
   A "clip" = { fps?, loop?, view?:[az,el], keys:[{t, root?, rootRot?, j:{joint:[rx,ry,rz]}}] }
   Angles are radians; missing joints fall back to the rest pose.
══════════════════════════════════════════════════════════════════ */
const WorkoutRig = (function () {
  'use strict';

  /* ── skeleton: parent before child; off = bone vector from parent (cm),
        r = radius of the capsule drawn parent→joint (0 = no limb). ──── */
  const BONES = [
    { name: 'pelvis',   parent: null,      off: [0, 0, 0],     r: 0 },
    { name: 'spine1',   parent: 'pelvis',  off: [0, 13, 0],    r: 9.8, noBall: 1 },
    { name: 'spine2',   parent: 'spine1',  off: [0, 13, 0],    r: 10,  noBall: 1 },
    { name: 'chest',    parent: 'spine2',  off: [0, 12, 0],    r: 10.5, noBall: 1 },
    { name: 'neck',     parent: 'chest',   off: [0, 7, 0],     r: 4,   noBall: 1 },
    { name: 'head',     parent: 'neck',    off: [0, 5, 0],     r: 5, head: 7.6 },

    { name: 'shoulderL', parent: 'chest',  off: [-16, 3, 0],   r: 0 },
    { name: 'elbowL',    parent: 'shoulderL', off: [-4, -29, 0], r: 5 },
    { name: 'wristL',    parent: 'elbowL', off: [-2, -27, 0],   r: 4.2 },
    { name: 'handL',     parent: 'wristL', off: [-1, -12, 0],   r: 3.6 },

    { name: 'shoulderR', parent: 'chest',  off: [16, 3, 0],    r: 0 },
    { name: 'elbowR',    parent: 'shoulderR', off: [4, -29, 0], r: 5 },
    { name: 'wristR',    parent: 'elbowR', off: [2, -27, 0],   r: 4.2 },
    { name: 'handR',     parent: 'wristR', off: [1, -12, 0],   r: 3.6 },

    { name: 'hipL',   parent: 'pelvis', off: [-9, -2, 0],   r: 0 },
    { name: 'kneeL',  parent: 'hipL',   off: [0, -44, 0],   r: 7 },
    { name: 'ankleL', parent: 'kneeL',  off: [0, -42, 0],   r: 5.5 },
    { name: 'footL',  parent: 'ankleL', off: [0, -5, 13],   r: 4 },

    { name: 'hipR',   parent: 'pelvis', off: [9, -2, 0],    r: 0 },
    { name: 'kneeR',  parent: 'hipR',   off: [0, -44, 0],   r: 7 },
    { name: 'ankleR', parent: 'kneeR',  off: [0, -42, 0],   r: 5.5 },
    { name: 'footR',  parent: 'ankleR', off: [0, -5, 13],   r: 4 },
  ];
  const BY = {}; BONES.forEach((b, i) => { b.idx = i; BY[b.name] = b; });
  /* default pelvis height so feet rest near the ground plane (y=0). */
  const REST_ROOT_Y = 95;
  const GROUND_Y = 0;

  /* ── tiny 3×3 matrix / vector math ─────────────────────────────── */
  function matFromEuler(x, y, z) {
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    /* R = Rz * Ry * Rx  (apply X then Y then Z) */
    return [
      cy * cz, cz * sx * sy - cx * sz, cx * cz * sy + sx * sz,
      cy * sz, cx * cz + sx * sy * sz, cx * sy * sz - cz * sx,
      -sy,     cy * sx,                cx * cy,
    ];
  }
  function matMul(a, b) {
    const m = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
      m[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    return m;
  }
  function matVec(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }

  /* ── rest pose (all local rotations 0) ─────────────────────────── */
  const ZERO = [0, 0, 0];

  function create(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let clip = null, phase = 0, playing = true, speed = 1, last = 0, raf = null;
    let az = Math.PI / 2, el = 0.12;          /* camera: side view by default */
    let azTarget = az, elTarget = el;
    let phaseCb = null;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    /* world transforms, recomputed each frame */
    const wRot = {}, wPos = {};

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(40, rect.width), h = Math.max(40, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      draw();
    }

    /* smootherstep easing */
    const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

    /* interpolate the clip at the current phase → {root,rootRot,jointEuler{}} */
    function sample() {
      if (!clip || !clip.keys.length) return { root: [0, REST_ROOT_Y, 0], rootRot: ZERO, j: {} };
      const keys = clip.keys;
      if (keys.length === 1) return normKey(keys[0]);
      /* find surrounding keys by t */
      let a = keys[0], b = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (phase >= keys[i].t && phase <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
      }
      const span = (b.t - a.t) || 1;
      const f = ease(Math.max(0, Math.min(1, (phase - a.t) / span)));
      const ka = normKey(a), kb = normKey(b);
      const out = { root: lerp3(ka.root, kb.root, f), rootRot: lerp3(ka.rootRot, kb.rootRot, f), j: {} };
      const names = new Set([...Object.keys(ka.j), ...Object.keys(kb.j)]);
      names.forEach(n => { out.j[n] = lerp3(ka.j[n] || ZERO, kb.j[n] || ZERO, f); });
      return out;
    }
    function normKey(k) {
      return { root: k.root || [0, REST_ROOT_Y, 0], rootRot: k.rootRot || ZERO, j: k.j || {} };
    }
    function lerp3(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }

    /* forward kinematics → fill wRot/wPos */
    function solve(pose) {
      for (const bn of BONES) {
        if (bn.parent === null) {
          wRot[bn.name] = matFromEuler(pose.rootRot[0], pose.rootRot[1], pose.rootRot[2]);
          wPos[bn.name] = pose.root.slice();
        } else {
          const pr = wRot[bn.parent], pp = wPos[bn.parent];
          const o = matVec(pr, bn.off);
          wPos[bn.name] = [pp[0] + o[0], pp[1] + o[1], pp[2] + o[2]];
          const lr = pose.j[bn.name] || ZERO;
          wRot[bn.name] = matMul(pr, matFromEuler(lr[0], lr[1], lr[2]));
        }
      }
    }

    /* camera transform + perspective, scale-independent unit coords */
    function unit(p) {
      const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
      let x = p[0] * ca - p[2] * sa;
      let z = p[0] * sa + p[2] * ca;
      let y = p[1] * ce - z * se;
      let zz = p[1] * se + z * ce;
      const persp = 520 / (520 + zz);
      return { ux: x * persp, uy: -y * persp, depth: zz, s: persp };
    }
    let _sc = 1, _cx = 0, _cy = 0;
    function project(p) {
      const u = unit(p);
      return { x: _cx + u.ux * _sc, y: _cy + u.uy * _sc, depth: u.depth, s: u.s };
    }

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const pose = sample();
      solve(pose);

      /* auto-fit: project every joint at scale 1, derive scale+centre so the
         whole figure always fits whatever the pose (squat, horizontal push-up…). */
      let uxmin = Infinity, uxmax = -Infinity, uymin = Infinity, uymax = -Infinity;
      for (const bn of BONES) {
        const u = unit(wPos[bn.name]);
        const pad = (bn.head ? bn.head : bn.r || 6) * u.s;
        uxmin = Math.min(uxmin, u.ux - pad); uxmax = Math.max(uxmax, u.ux + pad);
        uymin = Math.min(uymin, u.uy - pad); uymax = Math.max(uymax, u.uy + pad);
      }
      const bw = (uxmax - uxmin) || 1, bh = (uymax - uymin) || 1;
      _sc = 0.9 * Math.min(W / bw, H / bh);
      _cx = W / 2 - _sc * (uxmin + uxmax) / 2;
      _cy = H / 2 - _sc * (uymin + uymax) / 2;
      const scale = _sc;
      const cx = _cx, cy = _cy;

      /* ground contact shadow: under the lowest support joints */
      let minY = Infinity;
      for (const n in wPos) minY = Math.min(minY, wPos[n][1]);
      const supports = ['footL', 'footR', 'handL', 'handR', 'wristL', 'wristR', 'kneeL', 'kneeR', 'pelvis', 'chest', 'elbowL', 'elbowR'];
      ctx.save();
      supports.forEach(n => {
        const p = wPos[n]; if (!p) return;
        if (p[1] > minY + 16) return;           /* only near-ground points */
        const sp = project([p[0], GROUND_Y, p[2]], cx, cy, scale);
        const rad = 16 * scale * sp.s;
        const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, rad);
        g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(sp.x, sp.y, rad, rad * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      /* build draw list (bones + head) with depth */
      const items = [];
      for (const bn of BONES) {
        if (!bn.parent) continue;
        if (bn.r <= 0 && !bn.head) continue;
        const p1 = wPos[bn.parent], p2 = wPos[bn.name];
        const a = project(p1, cx, cy, scale), b = project(p2, cx, cy, scale);
        const depth = (a.depth + b.depth) / 2;
        items.push({ bn, a, b, depth });
      }
      items.sort((u, v) => u.depth - v.depth);   /* far → near */

      const COL = opts.color || { base: '#cdd6e6', hi: '#f3f7ff', lo: '#7c8aa6', joint: '#5b6b88', skin: '#e9b48c' };
      const dmax = 120, dmin = -120;
      for (const it of items) {
        const { bn, a, b, depth } = it;
        const shade = Math.max(0, Math.min(1, (depth - dmin) / (dmax - dmin)));  /* 0 far .. 1 near */
        if (bn.head) {
          /* head sphere */
          const r = bn.head * scale * b.s;
          const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.4, r * 0.2, b.x, b.y, r);
          g.addColorStop(0, COL.hiSkin || '#ffe1c4'); g.addColorStop(0.6, COL.skin || '#e9b48c'); g.addColorStop(1, '#b07a4e');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
          continue;
        }
        const r1 = (BY[bn.parent].r || bn.r) * scale * a.s;
        const r2 = bn.r * scale * b.s;
        drawCapsule(a.x, a.y, r1, b.x, b.y, r2, shade, COL, bn);
      }
    }

    function drawCapsule(x1, y1, r1, x2, y2, r2, shade, COL, bn) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 0.001;
      const nx = -dy / len, ny = dx / len;
      /* shade: blend lo→base→hi by depth */
      const baseC = mix(COL.lo, COL.hi, shade * 0.9 + 0.05);
      ctx.save();
      /* body outline (rounded) */
      ctx.beginPath();
      ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
      ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
      ctx.arc(x2, y2, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
      ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
      ctx.arc(x1, y1, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
      ctx.closePath();
      /* cross-cylinder gradient (lit upper-left edge) */
      const gx1 = (x1 + x2) / 2 + nx * Math.max(r1, r2), gy1 = (y1 + y2) / 2 + ny * Math.max(r1, r2);
      const gx2 = (x1 + x2) / 2 - nx * Math.max(r1, r2), gy2 = (y1 + y2) / 2 - ny * Math.max(r1, r2);
      const g = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
      g.addColorStop(0, mix(baseC, '#ffffff', 0.32));
      g.addColorStop(0.45, baseC);
      g.addColorStop(1, mix(baseC, '#0a1020', 0.34));
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(10,16,32,.35)'; ctx.lineWidth = Math.max(0.6, r2 * 0.12);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      /* rounded joint cap at the distal end (skip on the torso/neck) */
      if (bn.noBall) return;
      const jr = r2 * 0.98;
      const jg = ctx.createRadialGradient(x2 - jr * 0.3, y2 - jr * 0.35, jr * 0.2, x2, y2, jr);
      jg.addColorStop(0, mix(baseC, '#ffffff', 0.30)); jg.addColorStop(0.7, baseC); jg.addColorStop(1, mix(baseC, '#0a1020', 0.3));
      ctx.fillStyle = jg;
      ctx.beginPath(); ctx.arc(x2, y2, jr, 0, Math.PI * 2); ctx.fill();
    }

    function mix(a, b, t) {
      const ca = hex(a), cb = hex(b);
      const r = Math.round(ca[0] + (cb[0] - ca[0]) * t), g = Math.round(ca[1] + (cb[1] - ca[1]) * t), bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
      return `rgb(${r},${g},${bl})`;
    }
    function hex(c) {
      if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      const m = c.match(/\d+/g); return m ? m.map(Number) : [200, 200, 200];
    }

    /* ── loop ──────────────────────────────────────────────────────── */
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      /* ease camera toward target */
      az += (azTarget - az) * Math.min(1, dt * 8);
      el += (elTarget - el) * Math.min(1, dt * 8);
      if (playing && clip && !reduce) {
        const dur = (clip.dur || 2.4) / Math.max(0.1, speed);
        phase += dt / dur;
        if (phase >= 1) phase = clip.loop === false ? 1 : phase % 1;
        if (phaseCb) phaseCb(phase);
      }
      draw();
    }

    /* ── camera drag ──────────────────────────────────────────────── */
    function orbitFrom(target) {
      let dragging = false, lx = 0, ly = 0;
      target.style.touchAction = 'pan-y';
      const down = e => { dragging = true; const p = pt(e); lx = p.x; ly = p.y; };
      const move = e => {
        if (!dragging) return;
        const p = pt(e); const dx = p.x - lx, dy = p.y - ly; lx = p.x; ly = p.y;
        azTarget += dx * 0.012; elTarget = Math.max(-0.7, Math.min(0.9, elTarget + dy * 0.008));
        if (e.cancelable) e.preventDefault();
      };
      const up = () => { dragging = false; };
      const pt = e => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
      target.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      api._off = () => { target.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    }

    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(canvas);

    const api = {
      setClip(c) { clip = c; phase = 0; last = 0; if (c && c.view) { azTarget = c.view[0]; elTarget = c.view[1]; } draw(); return api; },
      play() { playing = true; return api; },
      pause() { playing = false; return api; },
      setPlaying(b) { playing = !!b; return api; },
      setSpeed(m) { speed = m; return api; },
      setView(azDeg, elDeg) { azTarget = azDeg * Math.PI / 180; elTarget = elDeg * Math.PI / 180; return api; },
      setPhase(p) { phase = Math.max(0, Math.min(1, p)); draw(); if (phaseCb) phaseCb(phase); return api; },
      getPhase() { return phase; },
      onPhase(cb) { phaseCb = cb; return api; },
      orbitFrom,
      resize,
      isReduced() { return reduce; },
      dispose() { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (api._off) api._off(); },
    };

    resize();
    raf = requestAnimationFrame(frame);
    return api;
  }

  return { create, BONES };
})();
