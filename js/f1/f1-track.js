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
    let markers = [];                  // incident markers [{x,y,t,icon,type}]
    let showMarkers = true;
    let corners = [];                  // [{x,y,num}] turn markers
    let showCorners = false;
    let sectorSplit = null;            // [i1,i2] outline indices splitting S1/S2/S3
    let showSectors = false;
    let heat = [];                     // [{x,y,v}] speed-coloured trace (v 0..1)
    let showHeat = false;
    let flagZones = [], maxSector = 1, showZones = false;  // [{t0,t1,type,sector}]
    let highlightNum = null;           // a car to ring (hovered)

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

    /* optional whole-track rotation (radians), about the track centroid — used to
       turn the telemetry frame north-up so a satellite layer lines up. */
    let _rot = 0, _cx = 0, _cy = 0;
    function _rotPt(x, y) { if (!_rot) return [x, y]; const dx = x - _cx, dy = y - _cy, c = Math.cos(_rot), s = Math.sin(_rot); return [_cx + dx * c - dy * s, _cy + dx * s + dy * c]; }

    /* fit the track bbox into the canvas (preserve aspect, flip Y, pad). */
    function _buildTransform() {
      if (!_bounds) return;
      const { minx, maxx, miny, maxy } = _bounds;
      const bw = (maxx - minx) || 1, bh = (maxy - miny) || 1;
      const pad = 0.12;
      const s = Math.min(W * (1 - pad) / bw, H * (1 - pad) / bh);
      const ox = (W - bw * s) / 2, oy = (H - bh * s) / 2;
      track && (track.tf = (x, y) => { const [rx, ry] = _rotPt(x, y); return [ox + (rx - minx) * s, H - (oy + (ry - miny) * s)]; });
    }

    function _computeBounds(pts) {
      _cx = 0; _cy = 0; for (const p of pts) { _cx += p.x; _cy += p.y; } if (pts.length) { _cx /= pts.length; _cy /= pts.length; }
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (const p of pts) { const [x, y] = _rotPt(p.x, p.y); if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      return { minx, maxx, miny, maxy };
    }
    function setRotation(rad) { _rot = rad || 0; if (track) { _bounds = _computeBounds(track.raw); _buildTransform(); draw(); } }

    /* ── data ── */
    function setTrack(points) {
      const raw = points.filter(p => p && isFinite(p.x) && isFinite(p.y));
      track = { raw, tf: null };
      _bounds = _computeBounds(raw);
      _buildTransform();
      draw();
    }
    function setDrivers(meta) { drivers = meta || {}; }
    function setReplay(perDriver, keepClock) {
      frames = {};
      duration = 0;
      const all = [];
      for (const num in perDriver) {
        const arr = perDriver[num].filter(p => isFinite(p.x) && isFinite(p.y)).sort((a, b) => a.t - b.t);
        if (arr.length) { frames[num] = arr; duration = Math.max(duration, arr[arr.length - 1].t); all.push(...arr); }
      }
      if (!track && all.length) { _bounds = _computeBounds(all); track = { raw: all, tf: null }; _buildTransform(); }
      if (!keepClock) clock = 0;   // swap which cars are shown mid-replay without restarting
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
    function _heatColor(v) { v = Math.max(0, Math.min(1, v)); const r = v < 0.5 ? 255 : Math.round(255 * (1 - (v - 0.5) * 2)), g = v < 0.5 ? Math.round(255 * v * 2) : 255; return `rgb(${r},${g},70)`; }
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

      // road casing (dark) + surface (grey / sectors / speed heatmap) + dashed centre line
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      _roadPath(pts); ctx.strokeStyle = 'rgba(10,12,20,.9)'; ctx.lineWidth = 16; ctx.stroke();
      const N = pts.length;
      if (showHeat && heat.length >= 8) {
        ctx.lineWidth = 11;
        for (let i = 0; i < heat.length - 1; i++) {
          const a = heat[i], b = heat[i + 1], [ax, ay] = track.tf(a.x, a.y), [bx, by] = track.tf(b.x, b.y);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.strokeStyle = _heatColor((a.v + b.v) / 2); ctx.stroke();
        }
      } else if (showSectors && sectorSplit) {
        const SC = ['#c026d3', '#06b6d4', '#f59e0b'];
        const seg = (from, to, col) => { ctx.beginPath(); let st = false; for (let k = from; k <= to; k++) { const [px, py] = track.tf(pts[k % N].x, pts[k % N].y); st ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), st = true); } ctx.strokeStyle = col; ctx.lineWidth = 11; ctx.stroke(); };
        seg(0, sectorSplit[0], SC[0]); seg(sectorSplit[0], sectorSplit[1], SC[1]); seg(sectorSplit[1], N - 1, SC[2]); seg(N - 1, N, SC[2]);
      } else {
        _roadPath(pts); ctx.strokeStyle = '#3a3f50'; ctx.lineWidth = 11; ctx.stroke();
      }
      _roadPath(pts); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 9]); ctx.stroke(); ctx.setLineDash([]);

      // live flag zones — colour the track segment under a yellow flag / whole track under SC
      if (showZones && flagZones.length) {
        ctx.save(); ctx.lineCap = 'round';
        for (const z of flagZones) {
          if (clock < z.t0 - 200 || clock > z.t1) continue;
          const col = z.type === 'red' ? 'rgba(255,45,36,.6)' : (z.type === 'sc' || z.type === 'vsc') ? 'rgba(255,140,40,.55)' : 'rgba(255,214,10,.6)';
          ctx.strokeStyle = col; ctx.lineWidth = 13;
          if (z.sector && maxSector > 1) {
            const a = Math.floor((z.sector - 1) / maxSector * N), b = Math.ceil(z.sector / maxSector * N);
            ctx.beginPath(); let st = false; for (let k = a; k <= b; k++) { const [px, py] = track.tf(pts[k % N].x, pts[k % N].y); st ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), st = true); } ctx.stroke();
          } else { _roadPath(pts); ctx.stroke(); }
        }
        ctx.restore();
      }

      // corner numbers
      if (showCorners && corners.length) {
        ctx.font = '700 9px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const c of corners) {
          const [cx, cy] = track.tf(c.x, c.y);
          ctx.beginPath(); ctx.arc(cx, cy, 7.5, 0, 7); ctx.fillStyle = 'rgba(225,6,0,.92)'; ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillText(String(c.num), cx, cy + .5);
        }
      }

      // start/finish
      if (pts.length) {
        const [sx, sy] = track.tf(pts[0].x, pts[0].y);
        ctx.fillStyle = '#fff'; ctx.fillRect(sx - 6, sy - 2.5, 12, 5);
        ctx.fillStyle = '#000'; ctx.fillRect(sx - 6, sy - 2.5, 3, 2.5); ctx.fillRect(sx, sy - 2.5, 3, 2.5);
        ctx.fillRect(sx - 3, sy, 3, 2.5); ctx.fillRect(sx + 3, sy, 3, 2.5);
      }

      // incident markers — shown only while ACTIVE (between the event and its
      // clear), like on TV: a yellow flag appears when waved and goes once green.
      if (showMarkers && markers.length && track.tf) {
        for (const mk of markers) {
          const dur = mk.dur || 12000;
          if (duration && (clock < mk.t - 250 || clock > mk.t + dur)) continue;
          const [mx, my] = track.tf(mk.x, mk.y);
          ctx.save();
          ctx.shadowColor = mk.col || '#ffd60a'; ctx.shadowBlur = 9;
          ctx.beginPath(); ctx.arc(mx, my, 10, 0, 7);
          ctx.fillStyle = 'rgba(8,11,18,.92)'; ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1.8; ctx.strokeStyle = mk.col || 'rgba(255,255,255,.6)'; ctx.stroke();
          ctx.font = '11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(mk.icon, mx, my + .5);
          ctx.restore();
        }
      }

      // cars at current clock — drawn as team-coloured tags with the driver code
      const order = [];
      for (const num in frames) {
        const arr = frames[num];
        // hide cars that are out (no data past this point = retired/finished)
        if (clock > arr[arr.length - 1].t + 2000) continue;
        const p = _posAt(arr, clock);
        const [px, py] = track.tf(p.x, p.y);
        order.push({ num, px, py });
      }
      ctx.font = '800 8.5px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const c of order) {
        const d = drivers[c.num] || {};
        const col = d.colour ? '#' + String(d.colour).replace('#', '') : '#bbb';
        const label = labelMode === 'num' ? String(c.num) : (d.code || c.num);
        const isLeader = String(c.num) === String(leaderNum);
        const isHi = highlightNum != null && String(c.num) === String(highlightNum);
        if (isHi) { ctx.save(); ctx.beginPath(); ctx.arc(c.px, c.py, 14, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.stroke(); ctx.restore(); }
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
    function setSpeedData(arr) { heat = Array.isArray(arr) ? arr : []; draw(); }
    function setShowSpeed(b) { showHeat = !!b; draw(); }
    function setFlagZones(arr, max) { flagZones = Array.isArray(arr) ? arr : []; maxSector = max || 1; draw(); }
    function setShowFlagZones(b) { showZones = !!b; draw(); }
    function setHighlightCar(n) { highlightNum = n; draw(); }
    function setMarkers(arr) { markers = Array.isArray(arr) ? arr : []; draw(); }
    function setShowMarkers(b) { showMarkers = !!b; draw(); }
    function setCorners(arr) { corners = Array.isArray(arr) ? arr : []; draw(); }
    function setShowCorners(b) { showCorners = !!b; draw(); }
    function setSectorSplit(s) { sectorSplit = s; draw(); }
    function setShowSectors(b) { showSectors = !!b; draw(); }
    function dispose() { if (raf) cancelAnimationFrame(raf); raf = null; playing = false; }

    const ro = new ResizeObserver(resize); ro.observe(canvas);
    resize();

    return { setTrack, setDrivers, setReplay, play, pause, toggle, seek, setSpeed, setLiveClock, setOnTick,
      setLabelMode, setFlag, setLeader, setMarkers, setShowMarkers, setRotation,
      setCorners, setShowCorners, setSectorSplit, setShowSectors,
      setSpeedData, setShowSpeed, setFlagZones, setShowFlagZones, setHighlightCar, start, dispose, resize,
      get duration() { return duration; }, get playing() { return playing; }, get clock() { return clock; } };
  }

  return { create };
})();
