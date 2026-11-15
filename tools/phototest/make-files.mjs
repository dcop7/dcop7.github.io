/* Ficheiros de teste da mesa: orientações EXIF, 48 e 108 MP, panorâmica, PNG com
   transparência, WebP, ficheiros estragados. Saem de uma fotografia do próprio site.
   node tools/phototest/make-files.mjs [pasta de saída]   (por omissão: pasta temporária) */
import { createRequire } from 'node:module';
import os from 'node:os';
const sharp = createRequire(new URL('../photogen/', import.meta.url))('sharp');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.argv[2] || (process.env.PHOTOTEST_TMP || os.tmpdir() + '/dcop7-phototest').replace(/\\/g, '/') + '/audit-files'; fs.mkdirSync(OUT, { recursive: true });
const base = path.join(ROOT, 'assets/photo/own/own-15.webp');
const corner = (w, h) => ({ input: { create: { width: Math.round(w * 0.2), height: Math.round(h * 0.2), channels: 3, background: '#ff0000' } }, left: 0, top: 0 });
const exif = { IFD0: { Make: 'TestCam', Model: 'TC-1' }, IFD2: { ExposureTime: '1/250', FNumber: '28/10', ISOSpeedRatings: '200', FocalLength: '50/1', FocalLengthIn35mmFilm: '75', DateTimeOriginal: '2024:05:01 10:00:00' } };
const mk = async (name, w, h, fn) => {
  let img = sharp(base).resize(w, h, { fit: 'cover' }).composite([corner(w, h)]);
  const buf = await img.png({ compressionLevel: 1 }).toBuffer();
  await fn(sharp(buf, { limitInputPixels: false })).toFile(path.join(OUT, name));
  const st = fs.statSync(path.join(OUT, name));
  console.log(name.padEnd(18), `${w}x${h}`, (st.size / 1048576).toFixed(1) + ' MB');
};
/* retrato 2000×3000 guardado deitado (3000×2000) com orientação 6 */
{
  const disp = await sharp(base).resize(2000, 3000, { fit: 'cover' }).composite([corner(2000, 3000)]).png({ compressionLevel: 1 }).toBuffer();
  await sharp(disp).rotate(-90).jpeg({ quality: 88 }).withExif(exif).withMetadata({ orientation: 6 }).toFile(path.join(OUT, 'exif-rot6.jpg'));
  const m = await sharp(path.join(OUT, 'exif-rot6.jpg')).metadata();
  console.log('exif-rot6.jpg'.padEnd(18), `${m.width}x${m.height} orientação ${m.orientation} exif ${m.exif ? 'sim' : 'não'}`);
}
await mk('exif-land.jpg', 3000, 2000, s => s.jpeg({ quality: 88 }).withExif(exif));
await mk('noexif.jpg', 1600, 1200, s => s.jpeg({ quality: 88 }));
await mk('photo.webp', 1600, 1067, s => s.webp({ quality: 82 }));
await mk('tiny.jpg', 16, 12, s => s.jpeg());
await mk('pano.jpg', 12000, 1800, s => s.jpeg({ quality: 85 }));
await mk('tall.jpg', 1500, 7000, s => s.jpeg({ quality: 85 }));
await mk('big-48mp.jpg', 8000, 6000, s => s.jpeg({ quality: 85 }).withExif(exif));
await mk('big-108mp.jpg', 12000, 9000, s => s.jpeg({ quality: 80 }));
/* PNG com transparência: metade direita transparente */
{
  const a = await sharp(base).resize(1200, 800, { fit: 'cover' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < 800; y++) for (let x = 600; x < 1200; x++) a.data[(y * 1200 + x) * 4 + 3] = 0;
  await sharp(a.data, { raw: a.info }).png().toFile(path.join(OUT, 'alpha.png'));
  console.log('alpha.png'.padEnd(18), '1200x800');
}
fs.writeFileSync(path.join(OUT, 'fake.jpg'), 'isto não é uma imagem\n'.repeat(200));
/* JPEG com o bloco EXIF truncado (tamanho declarado maior do que o ficheiro) */
{
  const b = fs.readFileSync(path.join(OUT, 'exif-land.jpg'));
  const cut = Buffer.concat([b.subarray(0, 40), b.subarray(b.length - 2000)]);
  fs.writeFileSync(path.join(OUT, 'broken-exif.jpg'), cut);
}
console.log('ok →', OUT);
