/* ── GameAudio — Web Audio API sound primitives ── */
const GameAudio = (function () {
  let _ctx = null;
  let _muted = false;

  function _ac() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  }

  function _tone(freq, type, duration, volume = 0.3, attack = 0.005, decay = 0.05) {
    if (_muted) return;
    const ac = _ac();
    if (!ac) return;
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + attack + duration - decay);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + attack + duration);
  }

  function _noise(duration, volume = 0.15) {
    if (_muted) return;
    const ac = _ac();
    if (!ac) return;
    const bufSize = ac.sampleRate * duration;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src  = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = buf;
    src.connect(gain);
    gain.connect(ac.destination);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    src.start();
  }

  return {
    get muted() { return _muted; },
    setMuted(v) { _muted = v; },

    beep()      { _tone(440, 'sine',     0.08, 0.25); },
    success()   { _tone(523, 'sine',     0.12, 0.3); setTimeout(() => _tone(659, 'sine', 0.18, 0.3), 80); },
    fail()      { _tone(220, 'sawtooth', 0.18, 0.2); setTimeout(() => _tone(180, 'sawtooth', 0.25, 0.15), 100); },
    pop()       { _tone(600, 'sine',     0.06, 0.2); },
    click()     { _tone(800, 'square',   0.04, 0.1); },
    levelUp()   { [523, 659, 784].forEach((f, i) => setTimeout(() => _tone(f, 'sine', 0.15, 0.3), i * 90)); },
    explosion() { _noise(0.3, 0.2); _tone(120, 'sawtooth', 0.2, 0.1); },
    shoot()     { _tone(880, 'sawtooth', 0.05, 0.12, 0.002, 0.04); },
    coin()      { _tone(988, 'sine', 0.07, 0.3); setTimeout(() => _tone(1319, 'sine', 0.1, 0.2), 60); },
  };
})();
