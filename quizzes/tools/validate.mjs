#!/usr/bin/env node
/* Validation pipeline — run before shipping quiz content.
   Verifies, for every question in quizzes/{easy,medium,hard}/*.json:
     - well-formed: q, a, exactly 4 options, a ∈ opts, options unique
     - any local image (quizzes/assets/...) actually exists on disk
   Exits non-zero if any problem is found, so broken assets never ship.
   Run: node quizzes/tools/validate.mjs */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TIERS = ['easy', 'medium', 'hard'];

let items = 0, errors = 0, withImg = 0, missImg = 0;
const problems = [];

for (const tier of TIERS) {
  const dir = join(ROOT, 'quizzes', tier);
  let files = [];
  try { files = (await readdir(dir)).filter(f => f.endsWith('.json')); } catch { continue; }
  for (const f of files) {
    const rel = `${tier}/${f}`;
    let arr;
    try { arr = JSON.parse(await readFile(join(dir, f), 'utf8')); }
    catch (e) { problems.push(`${rel}: JSON parse failed — ${e.message}`); errors++; continue; }
    if (!Array.isArray(arr)) { problems.push(`${rel}: not an array`); errors++; continue; }
    arr.forEach((it, i) => {
      items++;
      const at = `${rel}#${i}`;
      if (!it || typeof it.q !== 'string' || !it.q) { problems.push(`${at}: missing q`); errors++; }
      if (it.a == null || it.a === '') { problems.push(`${at}: missing a`); errors++; }
      if (!Array.isArray(it.opts) || it.opts.length !== 4) { problems.push(`${at}: opts must be exactly 4 (got ${it.opts?.length})`); errors++; }
      else {
        if (!it.opts.includes(it.a)) { problems.push(`${at}: answer not in opts`); errors++; }
        if (new Set(it.opts).size !== it.opts.length) { problems.push(`${at}: duplicate opts`); errors++; }
      }
      if (it.img) {
        withImg++;
        if (it.img.startsWith('quizzes/assets/')) {
          if (!existsSync(join(ROOT, it.img))) { problems.push(`${at}: missing local image ${it.img}`); missImg++; errors++; }
        }
      }
    });
  }
}

console.log(`Validated ${items} questions — images referenced: ${withImg}, missing: ${missImg}`);
if (problems.length) {
  console.log(`\n✗ ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 50)) console.log('  - ' + p);
  if (problems.length > 50) console.log(`  …and ${problems.length - 50} more`);
  process.exit(1);
}
console.log('✓ All quiz content valid; all local images present.');
