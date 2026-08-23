#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   optimize-covers.mjs — recomprime as capas geradas (Explorar / Jogos /
   Quizzes) para o tamanho a que são realmente pintadas.

   DEV-ONLY, idempotente, corre na raiz do repo:
       node tools/photogen/optimize-covers.mjs            # aplica
       node tools/photogen/optimize-covers.mjs --dry      # só relata

   Porquê: o lote de capas de jun/2026 foi escrito em JPEG quase sem
   compressão — 768×512 a ~650 KB cada, quando os cartões que as mostram têm
   ~200-290 px de largura e ainda lhes põem por cima 55% de opacidade e um
   gradiente. Eram ~33 MB de imagens para pintar miniaturas.

   Regras por pasta (a largura de origem nunca fica abaixo de ~2× a largura
   pintada, para os ecrãs de alta densidade):
     assets/explorer  cartão ~290 px  → mantém 768, recomprime
     assets/games     cartão ~205 px  → mantém 768, recomprime
     assets/quiz      cartão ~115 px  → 448 chega e sobra

   Só escreve quando o resultado é mais pequeno que o original, por isso pode
   voltar a correr sempre que forem geradas capas novas.
   ════════════════════════════════════════════════════════════════════ */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRY = process.argv.includes('--dry');
const QUALITY = 78;

const TARGETS = [
  { dir: 'assets/explorer', maxWidth: 768 },
  { dir: 'assets/games',    maxWidth: 768 },
  { dir: 'assets/quiz',     maxWidth: 448 },
];

const kb = n => (n / 1024).toFixed(0).padStart(4) + ' KB';
let before = 0, after = 0, touched = 0;

for (const t of TARGETS) {
  const abs = join(ROOT, t.dir);
  const files = (await readdir(abs)).filter(f => /\.jpe?g$/i.test(f));
  for (const f of files.sort()) {
    const p = join(abs, f);
    /* Read into memory first: sharp keeps the source file open lazily, and on
       Windows that blocks writing the optimised bytes back to the same path. */
    const src = await readFile(p);
    const orig = src.length;
    const meta = await sharp(src).metadata();
    const buf = await sharp(src)
      .resize({ width: Math.min(meta.width, t.maxWidth), withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();
    before += orig;
    if (buf.length < orig * 0.95) {
      after += buf.length; touched++;
      console.log(`${DRY ? 'would' : '     '} ${t.dir}/${f}  ${kb(orig)} → ${kb(buf.length)}`);
      if (!DRY) await writeFile(p, buf);
    } else {
      after += orig;
    }
  }
}
console.log(`\n${touched} files ${DRY ? 'would shrink' : 'rewritten'} · ${kb(before)} → ${kb(after)} (${(100 - after / before * 100).toFixed(0)}% smaller)`);
