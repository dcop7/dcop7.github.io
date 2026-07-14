#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   photogen — gerador de assets estáticos da Fotografia via ComfyUI local.

   DEV-ONLY. Corre na tua máquina, fala com o ComfyUI em 127.0.0.1:8188 e
   escreve ficheiros estáticos otimizados em assets/photo/. NUNCA corre no
   browser nem em produção — o site continua 100% estático e funciona sem
   isto (as ilustrações procedurais em js/pages/photo-illus.js são o fallback).

   Uso:
     node tools/photogen/generate.mjs               # gera o que falta
     node tools/photogen/generate.mjs --force       # regera tudo
     node tools/photogen/generate.mjs --only pose-s-curve
     node tools/photogen/generate.mjs --group poses
     node tools/photogen/generate.mjs --steps 10    # rascunho rápido
     COMFY_HOST=http://127.0.0.1:8188 node tools/photogen/generate.mjs

   Transparência + WebP precisam de `sharp` (npm i sharp, opcional). Sem sharp
   os PNG ficam sobre fundo verde e é só isso que é escrito.
   ════════════════════════════════════════════════════════════════════ */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { listCheckpoints, txt2imgGraph, queue, waitForImages, fetchImage, nodeAvailable, HOST } from './comfy.mjs';
import { greenScreenToWebp, whiteScreenToWebp, toWebp, trySharp } from './matte.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT_RAW = join(HERE, 'out');                 // PNG cru (não versionado)
const OUT_WEB = join(ROOT, 'assets', 'photo');     // assets finais (versionados)
const INDEX = join(OUT_WEB, 'index.json');

const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };

// Corre o recorte @imgly num processo-filho fresco (evita o segfault do
// onnxruntime no processo principal). Devolve o exit code do filho.
function matteChild(inp, out, model, maxWidth) {
  return new Promise(res => {
    const cli = join(dirname(fileURLToPath(import.meta.url)), 'matte-cli.mjs');
    const c = spawn(process.execPath, [cli, inp, out, model, String(maxWidth)], { stdio: ['ignore', 'ignore', 'inherit'] });
    c.on('exit', code => res(code));
    c.on('error', () => res(-1));
  });
}

async function main() {
  const manifest = JSON.parse(await readFile(join(HERE, 'manifest.json'), 'utf8'));
  const cks = await listCheckpoints().catch(e => { console.error('✗', e.message); process.exit(1); });
  let ckpt = manifest.checkpoint;
  if (!cks.includes(ckpt)) {
    console.warn(`! checkpoint "${ckpt}" não encontrado; a usar "${cks[0]}"`);
    ckpt = cks[0];
  }
  const sharp = await trySharp();
  console.log(`▸ ComfyUI: ${HOST}`);
  console.log(`▸ checkpoint: ${ckpt}`);
  console.log(`▸ sharp (transparência+webp): ${sharp ? 'sim' : 'NÃO — npm i sharp em tools/photogen'}`);

  // Recorte de fundo. Dois backends (muito melhores que o key por cor):
  //  • "imgly"      → CPU no Node (onnxruntime); independente de GPU (default).
  //  • "inspyrenet" → nó do ComfyUI (falha em ROCm/MIOpen nalgumas GPUs).
  // Opt: --rembg imgly|inspyrenet  ou  "rembg" no manifesto.
  const wantRembg = opt('rembg') || manifest.rembg || null;
  let rembg = null;
  if (wantRembg === 'inspyrenet') {
    rembg = (await nodeAvailable('InspyrenetRembg').catch(() => false)) ? 'inspyrenet' : null;
    console.log(`▸ rembg: ${rembg ? 'InspyrenetRembg (alpha direto do ComfyUI)' : 'nó não instalado — key por cor'}`);
  } else if (wantRembg === 'imgly' || wantRembg === 'cpu' || wantRembg === 'node') {
    rembg = 'imgly';
    console.log('▸ rembg: @imgly/background-removal-node (CPU, independente da GPU)');
  } else if (wantRembg) {
    console.log(`▸ rembg: "${wantRembg}" desconhecido — key por cor`);
  }

  await mkdir(OUT_RAW, { recursive: true });
  await mkdir(OUT_WEB, { recursive: true });
  const index = existsSync(INDEX) ? JSON.parse(await readFile(INDEX, 'utf8')) : {};

  let list = manifest.assets;
  if (opt('only')) list = list.filter(a => a.id === opt('only'));
  if (opt('group')) list = list.filter(a => a.group === opt('group'));
  if (!list.length) { console.error('Nada a gerar (filtro sem correspondência).'); return; }

  const d = manifest.defaults;
  for (const a of list) {
    const ext = a.matte && sharp ? 'webp' : sharp ? 'webp' : 'png';
    const rel = `${a.group}/${a.id}.${ext}`;
    const dest = join(OUT_WEB, rel);
    if (!flag('force') && existsSync(dest)) { console.log(`• skip ${a.id} (existe)`); index[a.id] = rel; continue; }

    const character = manifest.characters[a.character] || '';
    const style = manifest.styles[a.style] || '';
    const positive = [character, a.prompt, style].filter(Boolean).join(', ');
    const [width, height] = a.size || [832, 1216];
    const steps = +(opt('steps') || a.steps || d.steps);

    process.stdout.write(`• ${a.id} … `);
    const t0 = Date.now();
    const graph = txt2imgGraph({
      ckpt, positive, negative: a.negative || d.negative, seed: a.seed,
      steps, cfg: a.cfg || d.cfg, sampler: a.sampler || d.sampler, scheduler: a.scheduler || d.scheduler,
      width, height, prefix: 'photogen/' + a.id, rembg: a.matte ? rembg : null, rembgJit: opt('jit') || 'default',
    });
    const pid = await queue(graph);
    const imgs = await waitForImages(pid);
    const png = await fetchImage(imgs[imgs.length - 1]);
    const rawPath = join(OUT_RAW, `${a.id}.png`);
    await writeFile(rawPath, png);

    await mkdir(dirname(dest), { recursive: true });
    const mW = (a.matteOpts && a.matteOpts.maxWidth) || 900;
    let done = null; // caminho relativo escrito, ou null
    if (a.matte && rembg === 'inspyrenet') {
      if (await toWebp(png, dest, { maxWidth: mW })) done = rel;  // alpha veio do nó
    } else if (a.matte && rembg === 'imgly') {
      // Processo isolado: o onnxruntime segfaulta se correr neste processo.
      const code = await matteChild(rawPath, dest, (a.matteOpts && a.matteOpts.model) || 'medium', mW);
      if (code === 0 && existsSync(dest)) done = rel;
      else if (code === 10 && existsSync(dest.replace(/\.webp$/, '.png'))) done = `${a.group}/${a.id}.png`;
      else console.warn(`  (rembg falhou code=${code}; mantém SVG)`);
    } else if (a.matte) {
      const fn = a.matte === 'green' ? greenScreenToWebp : whiteScreenToWebp;
      if (await fn(png, dest, a.matteOpts || {})) done = rel;
    } else if (await toWebp(png, dest, {})) done = rel;
    if (!done) { // sem sharp → guarda PNG cru versionável
      await writeFile(dest.replace(/\.webp$/, '.png'), png);
      done = `${a.group}/${a.id}.png`;
    }
    index[a.id] = done;
    console.log(`ok (${((Date.now() - t0) / 1000).toFixed(1)}s → ${done})`);
  }

  await writeFile(INDEX, JSON.stringify(index, null, 2) + '\n');
  console.log(`\n✓ ${list.length} asset(s). Índice: assets/photo/index.json`);
  console.log('  Revê as imagens — a consistência de personagem pode precisar de afinação de prompt/seed.');
}

main().catch(e => { console.error('\n✗', e.stack || e.message); process.exit(1); });
