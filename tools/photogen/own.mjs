/* ══════════════════════════════════════════════════════════════════
   own.mjs — fotografias do AUTOR (pasta my_photos/, fora do git)

   node tools/photogen/own.mjs            # todas
   node tools/photogen/own.mjs --hero     # refaz também o hero e as capas

   Para cada original escreve uma cópia otimizada e SEM metadados
   (o sharp não copia EXIF por omissão → o GPS nunca sai do disco):
     assets/photo/own/own-NN.webp      1600px no lado maior — mesa do laboratório
     assets/photo/own/t/own-NN.webp    520px — tira de cenas, galerias
   e o registo data/photo/own.json com as definições reais de disparo
   (câmara, objetiva, focal, abertura, tempo, ISO, ano), lidas com o mesmo
   leitor que o browser usa (photography/js/ph-exif.js).

   NÃO correr ao mesmo tempo que generate.mjs / thumbs.mjs: todos
   reescrevem assets/photo/index.json.
   ══════════════════════════════════════════════════════════════════ */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'my_photos');
const OUT = path.join(ROOT, 'assets/photo/own');
const PhExif = createRequire(import.meta.url)(path.join(ROOT, 'photography/js/ph-exif.js'));

/* Título e género por ficheiro (a ordem alfabética dos ficheiros dá o número). */
const META = {
  '20160614_184214_HDR-01.jpeg':   { title: 'Estrada na floresta', genre: 'paisagem' },
  '20200926_155517-01.jpeg':       { title: 'Rocha dourada na praia', genre: 'praia' },
  '20211228_164750-01.jpeg':       { title: 'Pôr do sol sobre a costa', genre: 'nascer-por-sol' },
  '20211229_170805-01.jpeg':       { title: 'Vale ao entardecer', genre: 'paisagem' },
  '20211229_173339-01.jpeg':       { title: 'Muro de pedra ao crepúsculo', genre: 'paisagem' },
  '20220101_165002-01.jpeg':       { title: 'Sol baixo sobre as rochas', genre: 'nascer-por-sol' },
  '20220101_165107-01.jpeg':       { title: 'Sol sobre o mar', genre: 'nascer-por-sol' },
  '20220427_181927-01.jpeg':       { title: 'Estrada e nuvens', genre: 'paisagem' },
  '20220427_192229-01.jpeg':       { title: 'Passadiço de madeira', genre: 'paisagem' },
  '20220427_193729-01.jpeg':       { title: 'Farol sobre as falésias', genre: 'paisagem' },
  '20220621_160812-01.jpeg':       { title: 'Praia com algas', genre: 'praia' },
  '20220621_172707-01.jpeg':       { title: 'Debaixo do pontão', genre: 'arquitetura' },
  '20220627_191739-01.jpeg':       { title: 'Nuvens vistas de cima', genre: 'viagem' },
  'IMG_0190-01.jpeg':              { title: 'Rastos de luz na avenida', genre: 'longa-exposicao' },
  'IMG_0845.jpg':                  { title: 'A rebentação vista de cima', genre: 'praia' },
  'IMG_20201225_172758-01.jpeg':   { title: 'Poças de maré ao pôr do sol', genre: 'nascer-por-sol' },
  'IMG_2527_01.jpg':               { title: 'Banco no cais', genre: 'longa-exposicao' },
  'IMG_2600_01.jpg':               { title: 'Rebentação entre rochas', genre: 'praia' },
  'IMG_2825_01.jpg':               { title: 'Pinhal ao pôr do sol', genre: 'nascer-por-sol' },
  'IMG_2828_04.jpg':               { title: 'Sol entre os pinheiros', genre: 'nascer-por-sol' },
  'IMG_3109_copy_copy,JPG_edited.jpg': { title: 'Via Láctea', genre: 'astro' },
};

/* Câmaras: nome legível, classe e fator de crop (o EXIF dos telemóveis traz a
   focal real de cada módulo; a equivalente nem sempre vem). */
const CAMERAS = {
  'Canon EOS M50m2': { name: 'Canon EOS M50 Mark II', cls: 'apsc', crop: 1.6 },
  'SM-G975F':        { name: 'Samsung Galaxy S10+', cls: 'phone', eq: { '1.8': 13, '4.32': 26, '6': 52 } },
  'LG-D855':         { name: 'LG G3', cls: 'phone', eq: { '3.97': 29 } },
};
const LENSES = {
  'EF-M15-45mm f/3.5-6.3 IS STM': 'EF-M 15-45mm f/3.5-6.3 IS STM',
  'EF-M55-200mm f/4.5-6.3 IS STM': 'EF-M 55-200mm f/4.5-6.3 IS STM',
  'EF-M22mm f/2 STM': 'EF-M 22mm f/2 STM',
};
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

fs.mkdirSync(path.join(OUT, 't'), { recursive: true });
const files = fs.readdirSync(SRC).filter(f => /\.jpe?g$/i.test(f)).sort();
const photos = [];
const indexPath = path.join(ROOT, 'assets/photo/index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

let n = 0;
for (const f of files) {
  n++;
  const id = 'own-' + String(n).padStart(2, '0');
  const file = path.join(SRC, f);
  const ex = PhExif.parse(fs.readFileSync(file)) || {};
  const cam = CAMERAS[ex.model] || { name: [ex.make, ex.model].filter(Boolean).join(' ') || 'Câmara desconhecida', cls: 'apsc', crop: 1.6 };
  const focal = ex.focal ? round(ex.focal, 2) : null;
  let focal35 = ex.focal35 || null;
  if (!focal35 && focal) focal35 = cam.crop ? Math.round(focal * cam.crop) : (cam.eq && cam.eq[String(round(focal, 2))]) || null;
  const crop = cam.crop || (focal && focal35 ? round(focal35 / focal, 2) : null);

  const full = await sharp(file).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 5 }).toFile(path.join(OUT, id + '.webp'));
  await sharp(file).rotate().resize({ width: 520, height: 520, fit: 'inside' })
    .webp({ quality: 74, effort: 5 }).toFile(path.join(OUT, 't', id + '.webp'));

  const m = META[f] || { title: 'Sem título', genre: null };
  photos.push({
    id, title: m.title, genre: m.genre, w: full.width, h: full.height,
    camera: cam.name, cls: cam.cls, crop,
    lens: LENSES[ex.lens] || ex.lens || null,
    focal, focal35, f: ex.fnumber ? round(ex.fnumber, 1) : null,
    t: ex.exposure ? +ex.exposure.toPrecision(4) : null, iso: ex.iso || null,
    year: ex.year || null,
  });
  index[id] = `own/${id}.webp`;
  index[id + '-t'] = `own/t/${id}.webp`;
  console.log(id, m.title.padEnd(30), `${full.width}x${full.height}`, Math.round(full.size / 1024) + 'KB',
    `${focal35 || '?'}mm eq · f/${ex.fnumber} · ${PhExif.shutterLabel(ex.exposure)} · ISO ${ex.iso}`);
}

fs.writeFileSync(path.join(ROOT, 'data/photo/own.json'), JSON.stringify({
  _nota: 'Gerado por tools/photogen/own.mjs a partir de my_photos/ (fora do git). Fotografias de Diogo (@dcop7), todos os direitos reservados. Sem GPS.',
  author: { name: 'Diogo', instagram: 'https://www.instagram.com/dcop7', handle: '@dcop7' },
  photos,
}, null, 1) + '\n');

/* ── hero e capas do site, a partir das fotografias do autor ── */
if (process.argv.includes('--hero')) {
  const site = path.join(ROOT, 'assets/photo/site');
  const byTitle = t => path.join(SRC, files[photos.findIndex(p => p.title === t)]);
  const hero = byTitle('Pinhal ao pôr do sol');
  for (const [name, w, q] of [['site-hero-own', 2200, 80], ['site-hero-own-m', 1100, 76]]) {
    const o = await sharp(hero).rotate().resize({ width: w }).webp({ quality: q, effort: 6 }).toFile(path.join(site, name + '.webp'));
    index[name] = `site/${name}.webp`;
    console.log(name, `${o.width}x${o.height}`, Math.round(o.size / 1024) + 'KB');
  }
  const og = await sharp(hero).rotate().resize({ width: 1200, height: 630, fit: 'cover', position: 'south' }).jpeg({ quality: 82 }).toFile(path.join(site, 'og.jpg'));
  console.log('og.jpg', Math.round(og.size / 1024) + 'KB');
}

fs.writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n');
console.log(`\n${photos.length} fotografias → assets/photo/own + data/photo/own.json`);
