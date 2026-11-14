/* thumbs.mjs — miniaturas derivadas (sem ComfyUI) para o microsite /photography/.
   A folha de contactos da home mostra 30 fotografias de uma vez; os originais
   `vis-<género>` têm 1100px (~95 KB) e a 280px no ecrã seria desperdício.
   Lê assets/photo/index.json, escreve assets/photo/thumbs/<id>.webp (560px,
   2× do tamanho mostrado) e regista `thumb-<id>` no índice.

   node tools/photogen/thumbs.mjs            # vis-* sem miniatura
   node tools/photogen/thumbs.mjs --force    # refaz todas
*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = join(ROOT, 'assets', 'photo');
const INDEX = join(ASSETS, 'index.json');
const force = process.argv.includes('--force');
const W = 560;

const index = JSON.parse(await readFile(INDEX, 'utf8'));
await mkdir(join(ASSETS, 'thumbs'), { recursive: true });

const ids = Object.keys(index).filter(k => /^vis-[a-z-]+$/.test(k) && !k.endsWith('-flat'));
let made = 0;
for (const id of ids) {
  const rel = `thumbs/${id}.webp`;
  const dest = join(ASSETS, rel);
  if (force || !existsSync(dest)) {
    await sharp(join(ASSETS, index[id])).resize({ width: W, withoutEnlargement: true })
      .webp({ quality: 74, effort: 6 }).toFile(dest);
    made++;
  }
  index['thumb-' + id] = rel;
}
await writeFile(INDEX, JSON.stringify(index, null, 2) + '\n');
console.log(`✓ ${made} miniatura(s) novas · ${ids.length} no índice`);
