/* Descarrega as fontes MakeHuman (CC0 1.0) para _src/ — só o que o build usa.
   - repositório oficial makehumancommunity/makehuman (malha base, targets,
     olhos, rig + pesos)
   - pacote oficial "makehuman_system_assets_cc0.zip" (pele, cabelo,
     sobrancelhas, pestanas, roupa, sapatos)
   Licença: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
   (secção C: "These assets have been released under CC0 1.0 Universal"). */
import fs from 'node:fs';
import path from 'node:path';
import yauzl from 'yauzl';

const SRC = path.resolve('_src');
const RAW = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/';
const ZIP = 'https://mirror1.makehuman.net/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip';
const MAIN = [
  '3dobjs/base.obj', 'rigs/default.mhskel', 'rigs/default_weights.mhw',
  'eyes/high-poly/high-poly.mhclo', 'eyes/high-poly/high-poly.obj',
  'eyes/materials/brown.mhmat', 'eyes/materials/brown_eye.png',
  'targets/macrodetails/universal-female-young-averagemuscle-averageweight.target',
  'targets/macrodetails/caucasian-female-young.target',
];
const SYS = ['skins/young_caucasian_female/', 'hair/ponytail01/', 'eyebrows/eyebrow001/',
  'eyelashes/eyelashes01/', 'clothes/female_casualsuit01/', 'clothes/shoes06/'];

async function get(url, dest) {
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  console.log('ok', path.relative(SRC, dest));
}

for (const f of MAIN) await get(RAW + f, path.join(SRC, 'main', f));
const zipPath = path.join(SRC, 'sys.zip');
await get(ZIP, zipPath);
await new Promise((res, rej) => yauzl.open(zipPath, { lazyEntries: true }, (err, z) => {
  if (err) return rej(err);
  z.readEntry();
  z.on('entry', e => {
    if (e.fileName.endsWith('/') || !SYS.some(p => e.fileName.startsWith(p))) return z.readEntry();
    const dest = path.join(SRC, 'sys', e.fileName);
    if (fs.existsSync(dest)) return z.readEntry();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    z.openReadStream(e, (er, s) => { if (er) return rej(er); s.pipe(fs.createWriteStream(dest)).on('finish', () => z.readEntry()); });
  });
  z.on('end', res);
}));
console.log('fontes prontas em', SRC);
