/* Promove um PNG cru (out/) a asset final, com recorte opcional.
     node tools/photogen/finalize.mjs spec.json
   spec = [{ from: "out/_tb-x.png", id: "idea-bebes-4", dir: "bebes",
             crop: [left, top, width, height]?  (píxeis do PNG cru),
             trim: 0.03?  (apara esta fração de cada borda — p.ex. marcas
                           de água inventadas pelo modelo nos cantos),
             flop: true?  (espelho horizontal antes do recorte),
             maxWidth: 1100? }]
   Serve para os casos em que o modelo não acerta o enquadramento e a lição
   se resolve com um recorte da MESMA imagem (ver derive-crops.cjs), ou em
   que se escolhe um candidato gerado com outro id. Atualiza index.json. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_WEB = resolve(HERE, '..', '..', 'assets', 'photo');
const INDEX = join(OUT_WEB, 'index.json');
const spec = JSON.parse(await readFile(process.argv[2], 'utf8'));
const index = JSON.parse(await readFile(INDEX, 'utf8'));

for (const s of spec) {
  const src = resolve(HERE, s.from);
  let img = sharp(src);
  if (s.flop) img = sharp(await img.flop().toBuffer()); // espelho horizontal (vista de cima: sem "cima")
  const meta = await img.metadata();
  let crop = s.crop;
  if (!crop && s.trim) {
    const dx = Math.round(meta.width * s.trim), dy = Math.round(meta.height * s.trim);
    crop = [dx, dy, meta.width - 2 * dx, meta.height - 2 * dy];
  }
  if (crop) img = sharp(await img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] }).toBuffer());
  const rel = `${s.dir}/${s.id}.webp`;
  await mkdir(join(OUT_WEB, s.dir), { recursive: true });
  await img.resize({ width: s.maxWidth || 1100, withoutEnlargement: false }).webp({ quality: 86, effort: 5 }).toFile(join(OUT_WEB, rel));
  index[s.id] = rel;
  console.log('ok', s.id, '←', s.from, crop ? 'crop ' + crop.join(',') : '');
}
await writeFile(INDEX, JSON.stringify(index, null, 2) + '\n');
