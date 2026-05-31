#!/usr/bin/env node
/* Download national-flag SVGs locally (removes the last runtime hotlink).
   National flag DESIGNS are public domain (government works / not copyrightable);
   flagcdn distributes them as public-domain SVGs. Files go to data/flags/<cca2>.svg
   and countries.json is rewritten to reference the local path.
   Idempotent (skips existing). Run: node data/fetch-flags.mjs */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FLAGS = join(HERE, 'flags');
const FILE = join(HERE, 'countries.json');
await mkdir(FLAGS, { recursive: true });
const exists = p => access(p, constants.F_OK).then(() => true, () => false);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const countries = JSON.parse(await readFile(FILE, 'utf8'));
let ok = 0, skip = 0, miss = 0;

for (const c of countries) {
  const cca2 = (c.cca2 || '').toLowerCase();
  if (!cca2) { miss++; continue; }
  const dest = join(FLAGS, `${cca2}.svg`);
  const localPath = `data/flags/${cca2}.svg`;
  if (await exists(dest)) {
    c.flags = { ...(c.flags || {}), svg: localPath };
    skip++; continue;
  }
  try {
    await sleep(40);
    const r = await fetch(`https://flagcdn.com/${cca2}.svg`, { headers: { 'User-Agent': 'dcop7-flags/1.0 (educational)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const svg = await r.text();
    if (!svg.includes('<svg')) throw new Error('not svg');
    await writeFile(dest, svg, 'utf8');
    c.flags = { ...(c.flags || {}), svg: localPath };
    ok++;
  } catch (e) {
    miss++; console.log(`  ✗ ${cca2} (${e.message}) — keeping existing flag reference`);
  }
}

await writeFile(FILE, JSON.stringify(countries) + '\n', 'utf8');
console.log(`Flags: downloaded ${ok}, skipped(existing) ${skip}, missing ${miss}. countries.json updated to local paths.`);
