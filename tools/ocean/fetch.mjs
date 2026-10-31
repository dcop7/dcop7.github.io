/* Descarrega os dados de origem do Oceano profundo para _src/ (não versionado).
   Fontes (ver data/ocean/SOURCES.md):
     • GMRT GridServer (Lamont-Doherty, CC BY 4.0) — batimetria local e regional
     • World Ocean Atlas 2023 (NOAA NCEI, domínio público) — perfis T, S, O₂ via THREDDS NCSS
     • WoRMS REST (CC BY 4.0) — taxonomia
     • OBIS API v3 — estatísticas de registos de ocorrência
   uso: node fetch.mjs   (≈ 15 MB; repete só o que falta) */
import fs from 'node:fs';
import path from 'node:path';
import { SITES, SPECIES, ZONES } from '../../js/explorer/ocean/o-content.mjs';

const SRC = path.join(import.meta.dirname, '_src');
fs.mkdirSync(SRC, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, file, { text = true } = {}) {
  const out = path.join(SRC, file);
  if (fs.existsSync(out) && fs.statSync(out).size > 20) return text ? fs.readFileSync(out, 'utf8') : null;
  for (let k = 0; k < 4; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'dcop7.github.io ocean pipeline' } });
      if (!r.ok) throw new Error(r.status + ' ' + url);
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(out, b);
      console.log('get ', file, (b.length / 1024).toFixed(0) + ' kB');
      return text ? b.toString('utf8') : null;
    } catch (e) { console.warn('retry', file, e.message); await sleep(1500 * (k + 1)); }
  }
  throw new Error('falhou ' + url);
}

const GMRT = b => `https://www.gmrt.org/services/GridServer?north=${b.n}&west=${b.w}&east=${b.e}&south=${b.s}&layer=topo&format=esriascii&resolution=${b.res}`;
const WOA = (v, set) => `https://www.ncei.noaa.gov/thredds-ocean/ncss/grid/woa23/DATA/${v.dir}/netcdf/${set}/1.00/woa23_${set}_${v.k}00_01.nc`;
const WOAV = [{ dir: 'temperature', k: 't', set: 'decav' }, { dir: 'salinity', k: 's', set: 'decav' }, { dir: 'oxygen', k: 'o', set: 'all' }];
const obis = (p, q) => 'https://api.obis.org/v3/' + p + '?' + new URLSearchParams(q);

for (const s of SITES) {
  await get(GMRT(s.local), `${s.id}-local.asc`);
  await get(GMRT(s.region), `${s.id}-region.asc`);
  for (const v of WOAV) await get(`${WOA(v, v.set)}?var=${v.k}_an&latitude=${s.lat}&longitude=${s.lon}&accept=csv`, `${s.id}-woa-${v.k}.csv`);
  /* espécies registadas no OBIS por zona, numa caixa à volta do local */
  for (const z of ZONES) await get(obis('checklist', { geometry: s.basin, startdepth: z.from, enddepth: z.to, size: 12 }), `${s.id}-obis-${z.id}.json`);
}
for (const sp of SPECIES) {
  const q = encodeURIComponent(sp.sci);
  await get(`https://www.marinespecies.org/rest/AphiaRecordsByName/${q}?like=false&marine_only=true`, `worms-${sp.id}.json`);
  const rec = JSON.parse(fs.readFileSync(path.join(SRC, `worms-${sp.id}.json`), 'utf8'))[0];
  if (rec) await get(`https://www.marinespecies.org/rest/AphiaClassificationByAphiaID/${rec.valid_AphiaID || rec.AphiaID}`, `wormsc-${sp.id}.json`);
  await get(obis('statistics', { scientificname: sp.sci }), `obis-stat-${sp.id}.json`);
  await get(obis('statistics/env', { scientificname: sp.sci }), `obis-env-${sp.id}.json`);
  const sites = sp.sites === '*' ? SITES : SITES.filter(s => sp.sites.includes(s.id));
  for (const s of sites) await get(obis('occurrence', { scientificname: sp.sci, geometry: s.basin, size: 0 }), `obis-occ-${sp.id}-${s.id}.json`);
}
console.log('feito');
