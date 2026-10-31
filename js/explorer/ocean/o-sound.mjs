/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — som ambiente gerado (Web Audio, sem ficheiros):
   rumor da água filtrado, ondas perto da superfície, sonar do
   submersível, estalidos do casco com a pressão e o ronco das fontes
   hidrotermais. Desligado por omissão; só arranca com um clique.
   ══════════════════════════════════════════════════════════════════════ */
export class Sound {
  constructor() { this.on = false; this.ctx = null; }
  _init() {
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const noise = () => { const b = C.createBuffer(1, C.sampleRate * 4, C.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } const s = C.createBufferSource(); s.buffer = b; s.loop = true; return s; };
    this.master = C.createGain(); this.master.gain.value = 0; this.master.connect(C.destination);
    /* rumor grave */
    const n1 = noise(); this.lp = C.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 400;
    this.amb = C.createGain(); this.amb.gain.value = 0.5; n1.connect(this.lp).connect(this.amb).connect(this.master); n1.start();
    /* ondas (só perto da superfície) */
    const n2 = noise(); this.bp = C.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.frequency.value = 900; this.bp.Q.value = 0.6;
    this.surf = C.createGain(); this.surf.gain.value = 0; n2.connect(this.bp).connect(this.surf).connect(this.master); n2.start();
    /* fontes hidrotermais */
    const n3 = noise(); const vf = C.createBiquadFilter(); vf.type = 'lowpass'; vf.frequency.value = 160;
    this.vent = C.createGain(); this.vent.gain.value = 0; n3.connect(vf).connect(this.vent).connect(this.master); n3.start();
    this.tPing = 2; this.tCreak = 6;
  }
  toggle() {
    if (!this.ctx) this._init();
    this.on = !this.on; this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, this.ctx.currentTime, 0.4);
    return this.on;
  }
  mute(m) { if (this.ctx && m) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); else if (this.ctx && this.on) this.master.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.4); }
  ping() {
    const C = this.ctx, t = C.currentTime, o = C.createOscillator(), g = C.createGain();
    o.frequency.value = 1650; o.type = 'sine';
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    const dl = C.createDelay(); dl.delayTime.value = 0.42; const fb = C.createGain(); fb.gain.value = 0.32;
    o.connect(g); g.connect(this.master); g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.master);
    o.start(t); o.stop(t + 2);
  }
  creak(k) {
    const C = this.ctx, t = C.currentTime, o = C.createOscillator(), g = C.createGain(), f = C.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70 + Math.random() * 60, t); o.frequency.linearRampToValueAtTime(40 + Math.random() * 30, t + 0.6);
    f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * k, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 0.8);
  }
  update(depth, ventDist, speed) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime, dt = 0.016;
    this.lp.frequency.setTargetAtTime(Math.max(120, 600 - depth * 0.05) + speed * 2, t, 0.5);
    this.amb.gain.setTargetAtTime(0.35 + Math.min(0.4, speed * 0.004), t, 0.5);
    this.surf.gain.setTargetAtTime(Math.max(0, 1 - depth / 30) * 0.35, t, 0.5);
    this.vent.gain.setTargetAtTime(ventDist < 60 ? (1 - ventDist / 60) * 0.9 : 0, t, 0.5);
    this.tPing -= dt; if (this.tPing <= 0) { this.ping(); this.tPing = 9 + Math.random() * 4; }
    this.tCreak -= dt * Math.min(1, depth / 3000); if (this.tCreak <= 0 && depth > 1500) { this.creak(Math.min(1, depth / 8000)); this.tCreak = 5 + Math.random() * 10; }
  }
  dispose() { try { this.ctx?.close(); } catch { /* já fechado */ } }
}
