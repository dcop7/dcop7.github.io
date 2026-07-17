#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   BUILD OCORRÊNCIAS — server-side snapshot of ANEPC active incidents
   fogos.pt stopped sending CORS headers to third-party origins, so the
   browser can no longer call api.fogos.pt directly from GitHub Pages.
   This script runs in a GitHub Action (Node has no CORS), fetches the
   active incidents and commits a same-origin JSON snapshot the client
   can always read. Users with an API Aberta key still get live data
   in the browser; this snapshot is the zero-config fallback.
══════════════════════════════════════════════════════════════════ */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'ocorrencias.json');

const SOURCES = [
  'https://api.fogos.pt/v2/incidents/active',
  'https://api.fogos.pt/new/fires',
];

async function fetchJson(url) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'dcop7.github.io ocorrencias-snapshot (github action)' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(tid);
  }
}

function extractList(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.incidents)) return json.incidents;
  return null;
}

let list = null;
let source = null;
for (const url of SOURCES) {
  try {
    const json = await fetchJson(url);
    const l = extractList(json);
    if (l) { list = l; source = url; break; }
    console.error(`Unexpected shape from ${url}`);
  } catch (e) {
    console.error(`Failed ${url}: ${e.message}`);
  }
}

if (!list) {
  /* Keep the previous snapshot rather than committing an empty file —
     stale data with an honest timestamp beats no data. */
  try {
    const prev = JSON.parse(readFileSync(OUT, 'utf8'));
    console.error(`All sources failed — keeping previous snapshot of ${prev.updated}`);
    process.exit(0);
  } catch {
    console.error('All sources failed and no previous snapshot exists.');
    process.exit(1);
  }
}

/* Pass the incidents through untouched: the client already normalises the
   raw fogos.pt field names (lng, comma decimals, {sec} timestamps), and
   keeping the shape identical means one parser for live + snapshot data. */
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  updated: new Date().toISOString(),
  source,
  count: list.length,
  data: list,
}));
console.log(`Wrote ${list.length} incidents from ${source}`);
