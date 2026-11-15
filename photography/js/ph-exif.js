/* ══════════════════════════════════════════════════════════════════
   PhExif — leitor mínimo de EXIF (JPEG), sem dependências.

   Serve duas coisas: o laboratório mostra as definições REAIS com que uma
   fotografia foi tirada (as do autor e as que o utilizador abrir), e a
   ferramenta tools/photogen/own.mjs usa o mesmo código em Node para gerar
   data/photo/own.json. Lê só o que interessa a quem fotografa — câmara,
   objetiva, focal, abertura, tempo, ISO, data, orientação — e NUNCA o GPS:
   a localização não sai do ficheiro.

   API:  PhExif.parse(ArrayBuffer|Uint8Array) → objeto ou null
         PhExif.shutterLabel(seg) → "1/250" · "8 s"
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const TAGS0 = { 0x010F: 'make', 0x0110: 'model', 0x0112: 'orientation', 0x0131: 'software' };
  const TAGSX = {
    0x829A: 'exposure', 0x829D: 'fnumber', 0x8827: 'iso', 0x9003: 'date', 0x9204: 'bias',
    0x920A: 'focal', 0xA405: 'focal35', 0xA434: 'lens',
  };
  const SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

  function parse(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (u8.length < 4 || u8[0] !== 0xFF || u8[1] !== 0xD8) return null;      // só JPEG
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = 2;
    while (p + 4 < u8.length) {
      if (u8[p] !== 0xFF) return null;
      const marker = u8[p + 1], len = dv.getUint16(p + 2);
      if (marker === 0xDA) return null;                                        // começou a imagem
      if (marker === 0xE1 && dv.getUint32(p + 4) === 0x45786966 && dv.getUint16(p + 8) === 0) {
        try { return readTiff(dv, p + 10, p + 2 + len); } catch (_) { return null; }
      }
      p += 2 + len;
    }
    return null;
  }

  function readTiff(dv, base, end) {
    const le = dv.getUint16(base) === 0x4949;
    const u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le), i32 = o => dv.getInt32(o, le);
    const out = {};

    function value(entry) {
      const type = u16(entry + 2), n = u32(entry + 4);
      const bytes = (SIZE[type] || 1) * n;
      const at = bytes <= 4 ? entry + 8 : base + u32(entry + 8);
      if (at + bytes > end) return undefined;
      if (type === 2) {                                   // ASCII
        let s = '';
        for (let i = 0; i < n; i++) { const c = dv.getUint8(at + i); if (!c) break; s += String.fromCharCode(c); }
        return s.trim();
      }
      if (type === 3) return u16(at);
      if (type === 4) return u32(at);
      if (type === 5) { const d = u32(at + 4); return d ? u32(at) / d : 0; }
      if (type === 10) { const d = i32(at + 4); return d ? i32(at) / d : 0; }
      return undefined;
    }
    function ifd(off, map) {
      const n = u16(off);
      let sub = 0;
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        if (e + 12 > end) break;
        const tag = u16(e);
        if (tag === 0x8769) sub = base + u32(e + 8);
        else if (map[tag]) { const v = value(e); if (v !== undefined && v !== '') out[map[tag]] = v; }
      }
      return sub;
    }
    const exifIfd = ifd(base + u32(base + 4), TAGS0);
    if (exifIfd) ifd(exifIfd, TAGSX);
    if (out.date) out.year = +String(out.date).slice(0, 4) || undefined;
    return Object.keys(out).length ? out : null;
  }

  /* 0.004 → "1/250" · 8 → "8 s" · 0.5 → "1/2" */
  function shutterLabel(sec) {
    if (!(sec > 0)) return '—';
    if (sec >= 1) return (sec >= 10 ? Math.round(sec) : Math.round(sec * 10) / 10) + ' s';
    const d = 1 / sec;
    const std = [2, 3, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800,
      1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000];
    let best = std[0];
    for (const s of std) if (Math.abs(Math.log(s / d)) < Math.abs(Math.log(best / d))) best = s;
    return '1/' + (Math.abs(Math.log(best / d)) < 0.12 ? best : Math.round(d));
  }

  const api = { parse, shutterLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhExif = api;
})(typeof self !== 'undefined' ? self : this);
