/* ══════════════════════════════════════════════════════════════════
   F1 TRACK — canvas visualisation of the circuit and the cars moving on
   it, from OpenF1 /location X/Y data. The track outline is traced from a
   lap of location points; the cars are the per-driver position at the
   playback clock (replay of a past race, or live polling during a session).
   2D top-down, mobile-friendly (DPR-aware), no external libs.
   ══════════════════════════════════════════════════════════════════ */
const F1Track = (function () {
  'use strict';

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let track = null;                 // {raw:[{x,y}], tf:fn}
    let drivers = {};                 // num -> {name, code, colour}
    let frames = {};                  // num -> [{t,x,y}] sorted (ms from 0)
    let duration = 0;
    let clock = 0, speed = 6, playing = false, raf = null, last = 0;
    let _bounds = null;
    let onTick = null;
    let labelMode = 'code';            // 'code' (HAM) | 'num' (44)
    let flag = null;                   // null | 'yellow' | 'sc' | 'vsc' | 'red'
    let leaderNum = null;              // highlight the running leader

    /* ── sizing ── */
    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      _buildTransform();
      draw();
    }

    /* fit the track bbox into the canvas (preserve aspect, flip Y, pad). */
    function _buildTransform() {
      if (!_bounds) return;
      const { minx, maxx, miny, maxy } = _bounds;
      const bw = (maxx - minx) || 1, bh = (maxy - miny) || 1;
      const pad = 0.12;
      const s = Math.min(W * (1 - pad) / bw, H * (1 - pad) / bh);
      const ox = (W - bw * s) / 2, oy = (H - bh * s) / 2;
      track && (track.tf = (x, y) => [ox + (x - minx) * s, H - (oy + (y - miny) * s)]);
    }

    function _computeBounds(pts) {
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (const p of pts) { if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x; if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y; }
      return { minx, maxx, miny, maxy };
    }

    /* ── data ── */
    function setTrack(points) {
      const raw = points.filter(p => p && isFinite(p.x) && isFinite(p.y));
      track = { raw, tf: null };
      _bounds = _computeBounds(raw);
      _buildTransform();
      draw();
    }
    function setDrivers(meta) { drivers = meta || {}; }
    function setReplay(perDriver) {
      frames = {};
      duration = 0;
      const all = [];
      for (const num in perDriver) {
        const arr = perDriver[num].filter(p => isFinite(p.x) && isFinite(p.y)).sort((a, b) => a.t - b.t);
        if (arr.length) { frames[num] = arr; duration = Math.max(duration, arr[arr.length - 1].t); all.push(...arr); }
      }
      if (!track && all.length) { _bounds = _computeBounds(all); track = { raw: all, tf: null }; _buildTransform(); }
      clock = 0;
    }

    function _posAt(arr, t) {
      if (t <= arr[0].t) return arr[0];
      const last = arr[arr.length - 1];
      if (t >= last.t) return last;
      let lo = 0, hi = arr.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; (arr[m].t <= t ? lo = m : hi = m); }
      const a = arr[lo], b = arr[hi], f = (t - a.t) / ((b.t - a.t) || 1);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }

    /* ── drawing ── */
    function _roadPath(pts) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < pts.length; i++) {
        const [px, py] = track.tf(pts[i].x, pts[i].y);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
    }

    /* readable text colour over a team-coloured tag */
    function _ink(hex) {
      const h = String(hex || '').replace('#', '');
      if (h.length < 6) return '#fff';
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#06080f' : '#fff';
    }
    function _roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    const FLAG_COL = { yellow: '#ffd60a', sc: '#ffd60a', vsc: '#ffd60a', red: '#ff2d24' };
    function _drawFlag() {
      if (!flag) return;
      const col = FLAG_COL[flag] || '#ffd60a';
      // pulsing edge vignette
      const g = ctx.createLinearGradient(0, 0, 0, H);
      ctx.save();
      ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.globalAlpha = .55;
      ctx.strokeRect(2.5, 2.5, W - 5, H - 5);
      ctx.globalAlpha = 1; ctx.restore();
      // label chip top-left
      const txt = flag === 'sc' ? 'SC' : flag === 'vsc' ? 'VSC' : flag === 'red' ? 'RED FLAG' : 'YELLOW';
      ctx.font = '800 10px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(txt).width + 14;
      ctx.fillStyle = col; _roundRect(8, 8, w, 16, 4); ctx.fill();
      ctx.fillStyle = '#06080f'; ctx.fillText(txt, 15, 17);
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      if (!track || !track.tf) return;
      const pts = track.raw;

      // road casing (dark) + surface (grey) + dashed centre line
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      _roadPath(pts); ctx.strokeStyle = 'rgba(10,12,20,.9)'; ctx.lineWidth = 16; ctx.stroke();
      _roadPath(pts); ctx.strokeStyle = '#3a3f50'; ctx.lineWidth = 11; ctx.stroke();
      _roadPath(pts); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 9]); ctx.stroke(); ctx.setLineDash([]);

      // start/finish
      if (pts.length) {
        const [sx, sy] = track.tf(pts[0].x, pts[0].y);
        ctx.fillStyle = '#fff'; ctx.fillRect(sx - 6, sy - 2.5, 12, 5);
        ctx.fillStyle = '#000'; ctx.fillRect(sx - 6, sy - 2.5, 3, 2.5); ctx.fillRect(sx, sy - 2.5, 3, 2.5);
        ctx.fillRect(sx - 3, sy, 3, 2.5); ctx.fillRect(sx + 3, sy, 3, 2.5);
      }

      // cars at current clock — drawn as team-coloured tags with the driver code
      const order = [];
      for (const num in frames) {
        const p = _posAt(frames[num], clock);
        const [px, py] = track.tf(p.x, p.y);
        order.push({ num, px, py });
      }
      ctx.font = '800 8.5px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const c of order) {
        const d = drivers[c.num] || {};
        const col = d.colour ? '#' + String(d.colour).replace('#', '') : '#bbb';
        const label = labelMode === 'num' ? String(c.num) : (d.code || c.num);
        const isLeader = String(c.num) === String(leaderNum);
        const tw = Math.max(15, ctx.measureText(label).width + 8);
        const th = 13, x = c.px - tw / 2, y = c.py - th / 2;
        ctx.shadowColor = col; ctx.shadowBlur = isLeader ? 11 : 6;
        ctx.fillStyle = col; _roundRect(x, y, tw, th, 3.5); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = isLeader ? 1.6 : 1; ctx.strokeStyle = isLeader ? '#fff' : 'rgba(255,255,255,.55)';
        _roundRect(x, y, tw, th, 3.5); ctx.stroke();
        ctx.fillStyle = _ink(col); ctx.fillText(label, c.px, c.py + .5);
      }

      _drawFlag();
    }

    /* ── playback ── */
    function _loop(ts) {
      raf = requestAnimationFrame(_loop);
      if (!last) last = ts;
      const dt = Math.min(100, ts - last); last = ts;
      if (playing && duration) {
        clock += dt * speed;
        if (clock > duration) clock = 0;          // loop the replay
        onTick && onTick(clock / duration);
      }
      draw();
    }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(_loop); } }
    function play() { playing = true; start(); }
    function pause() { playing = false; }
    function toggle() { playing ? pause() : play(); return playing; }
    function seek(frac) { clock = Math.max(0, Math.min(1, frac)) * duration; draw(); onTick && onTick(clock / (duration || 1)); }
    function setSpeed(s) { speed = s; }
    function setLiveClock(t) { clock = t; draw(); }          // live mode drives the clock externally
    function setOnTick(fn) { onTick = fn; }
    function setLabelMode(m) { labelMode = m === 'num' ? 'num' : 'code'; draw(); }
    function setFlag(f) { flag = f || null; }
    function setLeader(n) { leaderNum = n; }
    function dispose() { if (raf) cancelAnimationFrame(raf); raf = null; playing = false; }

    const ro = new ResizeObserver(resize); ro.observe(canvas);
    resize();

    return { setTrack, setDrivers, setReplay, play, pause, toggle, seek, setSpeed, setLiveClock, setOnTick,
      setLabelMode, setFlag, setLeader, start, dispose, resize,
      get duration() { return duration; }, get playing() { return playing; }, get clock() { return clock; } };
  }

  return { create };
})();
