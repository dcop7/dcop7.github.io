/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — planta (vista de cima), sincronizada com a cena.

   É o "diagrama de luz" dos fotógrafos, mas vivo: arrastar uma luz muda
   o azimute e a distância (a altura mantém-se); a pega na ponta do feixe
   faz feathering; a câmara arrasta-se em órbita; a pega no nariz roda o
   sujeito. Desenhado a partir do MESMO estado que a cena 3D.
   ══════════════════════════════════════════════════════════════════════ */
import { MODIFIERS } from './st-gear.mjs';
import { DEG } from './st-core.mjs';

export const ROLE_COLOR = { key: '#f2b344', fill: '#6fa8ff', rim: '#c58cff', hair: '#7fdc9a', bg: '#3fd0c9', accent: '#ff7aa8', bounce: '#c9ced6' };

export class Plan {
  constructor(canvas, studio, { onSelect, onChange } = {}) {
    this.c = canvas; this.st = studio; this.onSelect = onSelect; this.onChange = onChange;
    this.g = canvas.getContext('2d');
    this.sel = null; this.hover = null; this.drag = null;
    this.bind();
  }

  size() {
    const r = this.c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    if (this.c.width !== Math.round(r.width * d) || this.c.height !== Math.round(r.height * d)) {
      this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d);
    }
    this.W = r.width; this.H = r.height; this.dpr = d;
  }

  /* mundo (x,z) ↔ ecrã: câmara em baixo, fundo em cima */
  fit() {
    const st = this.st;
    let x0 = -2.4, x1 = 2.4, z0 = -st.bdDist - 0.35, z1 = st.cam.dist + 0.45;
    for (const l of st.lights) if (l.pos) { x0 = Math.min(x0, l.pos.x - 0.5); x1 = Math.max(x1, l.pos.x + 0.5); z0 = Math.min(z0, l.pos.z - 0.5); z1 = Math.max(z1, l.pos.z + 0.5); }
    const pad = 14, s = Math.min((this.W - pad * 2) / (x1 - x0), (this.H - pad * 2) / (z1 - z0));
    this.s = s;
    this.ox = this.W / 2 - (x0 + x1) / 2 * s;
    this.oz = this.H / 2 - (z0 + z1) / 2 * s;
  }
  P(x, z) { return [this.ox + x * this.s, this.oz + z * this.s]; }
  W2(px, py) { return [(px - this.ox) / this.s, (py - this.oz) / this.s]; }

  draw() {
    if (!this.c.isConnected || !this.c.offsetParent) return;
    this.size(); this.fit();
    const g = this.g, st = this.st, s = this.s;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    /* grelha de 0,5 m */
    g.lineWidth = 1;
    const [gx0, gz0] = this.W2(0, 0), [gx1, gz1] = this.W2(this.W, this.H);
    for (let x = Math.ceil(gx0 * 2) / 2; x <= gx1; x += 0.5) { const [px] = this.P(x, 0); g.strokeStyle = Math.abs(x % 1) < 0.01 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.035)'; g.beginPath(); g.moveTo(px + 0.5, 0); g.lineTo(px + 0.5, this.H); g.stroke(); }
    for (let z = Math.ceil(gz0 * 2) / 2; z <= gz1; z += 0.5) { const [, pz] = this.P(0, z); g.strokeStyle = Math.abs(z % 1) < 0.01 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.035)'; g.beginPath(); g.moveTo(0, pz + 0.5); g.lineTo(this.W, pz + 0.5); g.stroke(); }

    /* fundo de papel */
    const [bx0, bz] = this.P(-1.36, -st.bdDist), [bx1] = this.P(1.36, -st.bdDist);
    g.fillStyle = st.paperHex || '#777'; g.globalAlpha = 0.9;
    g.fillRect(bx0, bz - 4, bx1 - bx0, 5); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '10px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('fundo · ' + st.bdDist.toFixed(1).replace('.', ',') + ' m', (bx0 + bx1) / 2, bz - 8);

    /* feixes primeiro (por baixo de tudo) */
    for (const l of st.lights) if (l.pos) this.beam(l);
    /* câmara + campo de visão */
    this.camera();
    /* sujeito */
    this.subject();
    /* luzes */
    for (const l of st.lights) if (l.pos) this.glyph(l);
  }

  beam(l) {
    const g = this.g, col = ROLE_COLOR[l.s.role] || '#fff';
    const [px, pz] = this.P(l.pos.x, l.pos.z);
    const yaw = Math.atan2(l.dir.x, l.dir.z);
    const half = Math.min(80, (l.def.beam || 40)) * DEG * (l.def.share > 0.5 ? 0.85 : 1);
    const len = Math.min(4.2, l.pos.distanceTo(l.aimPoint) * 1.25) * this.s;
    const on = l.live;
    const grd = g.createRadialGradient(px, pz, 2, px, pz, len);
    grd.addColorStop(0, hexA(col, on ? 0.34 : 0.08)); grd.addColorStop(1, hexA(col, 0));
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(px, pz);
    const a0 = Math.PI / 2 - yaw - half, a1 = Math.PI / 2 - yaw + half;
    g.arc(px, pz, len, a0, a1); g.closePath(); g.fill();
    /* eixo do feixe + pega de feathering */
    g.strokeStyle = hexA(col, on ? 0.75 : 0.25); g.setLineDash([3, 4]); g.lineWidth = 1;
    const ax = px + Math.sin(yaw) * len * 0.62, az = pz + Math.cos(yaw) * len * 0.62;
    g.beginPath(); g.moveTo(px, pz); g.lineTo(ax, az); g.stroke(); g.setLineDash([]);
    if (this.sel === l) {
      g.fillStyle = col; g.beginPath(); g.arc(ax, az, 4.5, 0, Math.PI * 2); g.fill();
      l._planAim = [ax, az];
    } else l._planAim = null;
  }

  glyph(l) {
    const g = this.g, col = ROLE_COLOR[l.s.role] || '#fff', s = this.s;
    const [px, pz] = this.P(l.pos.x, l.pos.z);
    const yaw = Math.atan2(l.dir.x, l.dir.z);
    const d = l.passive ? { w: 0.8 } : MODIFIERS[l.s.mod];
    const sel = this.sel === l, hov = this.hover === l;
    g.save(); g.translate(px, pz); g.rotate(-yaw);
    const w = Math.max(10, d.w * s), depth = Math.max(5, (l.passive ? 0.03 : (l.s.mod === 'bare' || l.s.mod === 'grid' || l.s.mod === 'snoot') ? 0.14 : 0.35) * s);
    g.fillStyle = l.live ? '#1b1d22' : '#121316';
    g.strokeStyle = sel ? '#fff' : hexA(col, l.live ? 0.95 : 0.4); g.lineWidth = sel ? 2 : 1.4;
    g.beginPath();
    if (l.passive) { g.ellipse(0, 0, w / 2, 3, 0, 0, Math.PI * 2); }
    else if (l.s.mod === 'umbrella' || l.s.mod === 'through') { g.arc(0, l.s.mod === 'through' ? -w * 0.2 : w * 0.25, w / 2, l.s.mod === 'through' ? Math.PI * 0.15 : Math.PI * 1.15, l.s.mod === 'through' ? Math.PI * 0.85 : Math.PI * 1.85); }
    else if (l.s.mod === 'dish') { g.moveTo(-w / 2, 0); g.quadraticCurveTo(0, -depth * 0.9, w / 2, 0); g.closePath(); }
    else { g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(Math.min(w / 2, 6), -depth); g.lineTo(-Math.min(w / 2, 6), -depth); g.closePath(); }
    g.fill(); g.stroke();
    /* face emissora */
    if (!l.passive && l.live) { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-w / 2 + 1, 0.5); g.lineTo(w / 2 - 1, 0.5); g.stroke(); }
    g.restore();
    /* etiqueta */
    const lab = l.label || '';
    g.font = (sel ? '600 ' : '') + '11px system-ui, sans-serif'; g.textAlign = 'center';
    const ty = pz + (Math.cos(yaw) > 0 ? -14 : 20);
    g.fillStyle = 'rgba(10,11,13,.75)';
    const tw = g.measureText(lab).width + 8;
    g.fillRect(px - tw / 2, ty - 10, tw, 14);
    g.fillStyle = sel || hov ? '#fff' : hexA(col, l.live ? 1 : 0.5);
    g.fillText(lab, px, ty + 1);
  }

  camera() {
    const g = this.g, st = this.st, cam = st.photoCam;
    const p = st.cameraRig.position;
    const [px, pz] = this.P(p.x, p.z);
    const f = st.facePoint();
    const yaw = Math.atan2(f.x - p.x, f.z - p.z);
    const hf = Math.atan(Math.tan(cam.fov * DEG / 2) * cam.aspect);
    const len = (p.distanceTo(f) + st.bdDist) * this.s;
    g.fillStyle = 'rgba(255,196,107,.06)'; g.strokeStyle = 'rgba(255,196,107,.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(px, pz);
    g.lineTo(px + Math.sin(yaw - hf) * len, pz + Math.cos(yaw - hf) * len);
    g.lineTo(px + Math.sin(yaw + hf) * len, pz + Math.cos(yaw + hf) * len);
    g.closePath(); g.fill(); g.stroke();
    g.save(); g.translate(px, pz); g.rotate(-yaw);
    g.fillStyle = '#2a2c31'; g.strokeStyle = this.hover === 'camera' || this.drag?.kind === 'camera' ? '#fff' : '#ffc46b'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(-9, -7, 18, 11, 2); g.fill(); g.stroke();
    g.fillRect(-4.5, 4, 9, 7); g.strokeRect(-4.5, 4, 9, 7);
    g.restore();
    g.fillStyle = 'rgba(255,196,107,.9)'; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(st.cam.focal + ' mm', px, pz + 24);
  }

  subject() {
    const g = this.g, st = this.st, s = this.s;
    const [px, pz] = this.P(0, 0);
    const yaw = st.subj.yaw * DEG;
    g.save(); g.translate(px, pz); g.rotate(-yaw);
    g.fillStyle = '#3a3d44'; g.strokeStyle = '#8b919c'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, 0, 0.21 * s, 0.11 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#d8b9a3';
    g.beginPath(); g.ellipse(0, 0.01 * s, 0.085 * s, 0.1 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-0.025 * s, 0.1 * s); g.lineTo(0, 0.14 * s); g.lineTo(0.025 * s, 0.1 * s); g.fill();
    /* pega de rotação */
    g.strokeStyle = this.hover === 'subject' || this.drag?.kind === 'subject' ? '#fff' : 'rgba(255,255,255,.35)';
    g.setLineDash([2, 3]); g.beginPath(); g.moveTo(0, 0.14 * s); g.lineTo(0, 0.32 * s); g.stroke(); g.setLineDash([]);
    g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(0, 0.32 * s, 3.5, 0, Math.PI * 2); g.fill();
    g.restore();
    this._yawHandle = [px + Math.sin(yaw) * 0.32 * s, pz + Math.cos(yaw) * 0.32 * s];
  }

  /* ── interação ─────────────────────────────────────────────────────── */
  hit(x, y) {
    const near = (p, r = 12) => p && Math.hypot(p[0] - x, p[1] - y) < r;
    for (const l of this.st.lights) if (near(l._planAim, 9)) return { kind: 'aim', light: l };
    if (near(this._yawHandle, 9)) return { kind: 'subject' };
    let best = null, bd = 16;
    for (const l of this.st.lights) {
      if (!l.pos) continue;
      const [px, pz] = this.P(l.pos.x, l.pos.z), d = Math.hypot(px - x, pz - y);
      if (d < bd) { bd = d; best = { kind: 'light', light: l }; }
    }
    if (best) return best;
    const c = this.st.cameraRig.position, [cx, cz] = this.P(c.x, c.z);
    if (Math.hypot(cx - x, cz - y) < 14) return { kind: 'camera' };
    return null;
  }

  bind() {
    const c = this.c;
    const xy = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', e => {
      const [x, y] = xy(e), h = this.hit(x, y);
      if (!h) { this.onSelect?.(null); return; }
      if (h.light) this.onSelect?.(h.light);
      this.drag = h; c.setPointerCapture(e.pointerId); e.preventDefault();
    });
    c.addEventListener('pointermove', e => {
      const [x, y] = xy(e);
      if (!this.drag) {
        const h = this.hit(x, y);
        const hv = h ? (h.light || h.kind) : null;
        if (hv !== this.hover) { this.hover = hv; c.style.cursor = h ? (h.kind === 'aim' || h.kind === 'subject' ? 'crosshair' : 'grab') : 'default'; this.draw(); }
        return;
      }
      const st = this.st, [wx, wz] = this.W2(x, y), f = st.facePoint();
      const d = this.drag;
      if (d.kind === 'light') {
        const l = d.light, dh = Math.max(0.35, Math.hypot(wx - f.x, wz - f.z));
        l.s.az = Math.round(Math.atan2(wx - f.x, wz - f.z) / DEG);
        l.s.dist = +Math.min(6, dh / Math.max(0.2, Math.cos(l.s.el * DEG))).toFixed(2);
      } else if (d.kind === 'aim') {
        const l = d.light;
        const want = Math.atan2(wx - l.pos.x, wz - l.pos.z);
        const base = Math.atan2(l.aimPoint.x - l.pos.x, l.aimPoint.z - l.pos.z) - l.s.feather * DEG;
        let fe = (want - base) / DEG; fe = ((fe + 540) % 360) - 180;
        l.s.feather = Math.round(Math.max(-75, Math.min(75, fe)));
      } else if (d.kind === 'camera') {
        st.cam.az = Math.round(Math.max(-80, Math.min(80, Math.atan2(wx - f.x, wz - f.z) / DEG)));
        st.cam.dist = +Math.max(0.6, Math.min(6, Math.hypot(wx - f.x, wz - f.z))).toFixed(2);
      } else if (d.kind === 'subject') {
        st.subj.yaw = Math.round(Math.max(-90, Math.min(90, Math.atan2(wx, wz) / DEG)));
      }
      st.invalidate(d.kind === 'camera' ? 'camera' : 'lights', { from: 'plan', light: d.light });
      this.onChange?.(d);
    });
    const end = () => { this.drag = null; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
