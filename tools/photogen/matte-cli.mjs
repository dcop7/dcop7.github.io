#!/usr/bin/env node
/* Recorte de fundo num processo isolado. O onnxruntime do @imgly segfaulta
   quando corre no mesmo processo logo a seguir ao trabalho HTTP do ComfyUI;
   correr num filho fresco (como o standalone) é estável.
   Uso: node matte-cli.mjs <in.png> <out.webp> [model] [maxWidth] */
import { readFile, writeFile } from 'node:fs/promises';
import { imglyToWebp } from './matte.mjs';

const [, , inp, out, model = 'medium', maxWidth = '900'] = process.argv;
if (!inp || !out) { console.error('uso: matte-cli.mjs <in.png> <out.webp> [model] [maxWidth]'); process.exit(64); }

const png = await readFile(inp);
const r = await imglyToWebp(png, out, { model, maxWidth: +maxWidth });
if (r === true) process.exit(0);
if (r && r.png) { await writeFile(out.replace(/\.webp$/, '.png'), r.png); process.exit(10); } // sem sharp → escreveu PNG
process.exit(2);
