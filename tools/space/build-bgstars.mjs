/* Estrelas do fundo do Sistema Solar → assets/space/bgstars.bin
   Fonte: data/universe/stars.bin (CNS3 + Yale BSC5, ver data/universe/SOURCES.md),
   em pc, galáctico heliocêntrico (x → centro galáctico, z → polo norte galáctico).
   Saída: por estrela 8 bytes — Int16 ×3 direção unitária (×32767), Uint8 V×20+40, Uint8 (B−V+0.5)×100.
   Só as estrelas até V 7 (o céu a olho nu muito escuro), ordenadas da mais brilhante.
   uso: node tools/space/build-bgstars.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = path.join(import.meta.dirname, '../..');
const buf = fs.readFileSync(path.join(root, 'data/universe/stars.bin'));
const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const out = [];
for (let i = 0; i < f.length / 5; i++) {
  const x = f[i * 5], y = f[i * 5 + 1], z = f[i * 5 + 2], Mv = f[i * 5 + 3], bv = f[i * 5 + 4];
  const d = Math.hypot(x, y, z); if (!(d > 0)) continue;
  const V = Mv + 5 * Math.log10(d) - 5; if (!(V <= 7)) continue;
  out.push({ x: x / d, y: y / d, z: z / d, V, bv: Number.isFinite(bv) ? bv : 0.6 });
}
out.sort((a, b) => a.V - b.V);
const b = Buffer.alloc(out.length * 8);
out.forEach((s, i) => {
  b.writeInt16LE(Math.round(s.x * 32767), i * 8); b.writeInt16LE(Math.round(s.y * 32767), i * 8 + 2); b.writeInt16LE(Math.round(s.z * 32767), i * 8 + 4);
  b.writeUInt8(Math.max(0, Math.min(255, Math.round(s.V * 20 + 40))), i * 8 + 6);
  b.writeUInt8(Math.max(0, Math.min(255, Math.round((s.bv + 0.5) * 100))), i * 8 + 7);
});
fs.writeFileSync(path.join(root, 'assets/space/bgstars.bin'), b);
console.log('estrelas', out.length, 'mais brilhante V', out[0].V.toFixed(2), (b.length / 1024).toFixed(0) + ' kB');
