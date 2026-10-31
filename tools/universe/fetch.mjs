/* Descarrega os catálogos de origem para _src/ (não versionado).
   Todas as fontes são públicas; ver data/universe/SOURCES.md para licenças.
   uso: node fetch.mjs            (≈ 70 MB; o SDSS demora alguns minutos) */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = path.join(import.meta.dirname, '_src');
fs.mkdirSync(SRC, { recursive: true });

const HEA = t => `https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_${t}.tdat.gz`;
const SDSS = (sql) => 'https://skyserver.sdss.org/dr18/SkyServerWS/SearchTools/SqlSearch?format=csv&cmd=' + encodeURIComponent(sql);
const SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=pdes,name,a,e,i,om,w,ma,epoch,H,class&sb-kind=a&sb-cdata=' +
  encodeURIComponent('{"AND":["H|LT|15.2"]}');
const EXO = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=csv&query=' +
  encodeURIComponent('select pl_name,hostname,ra,dec,sy_dist,pl_rade,pl_bmasse,pl_orbper,pl_orbsmax,disc_year,discoverymethod,st_teff,st_rad,sy_pnum from pscomppars');
const HZ = id => 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&EPHEM_TYPE=VECTORS&VEC_TABLE=2&OUT_UNITS=AU-D&REF_PLANE=ECLIPTIC' +
  `&COMMAND='${id}'&CENTER='500@10'&START_TIME='2026-01-01'&STOP_TIME='2026-01-02'&STEP_SIZE='1 d'`;

const JOBS = [
  ...['cns3', 'bsc5p', 'globclust', 'openclust', 'abellzcat', 'zcat', 'rc3'].map(t => [HEA(t), `heasarc_${t}.tdat.gz`]),
  [SDSS("SELECT ra, dec, z FROM SpecObj WHERE class='GALAXY' AND z BETWEEN 0.003 AND 0.2 AND zWarning=0 AND sciencePrimary=1 AND (fiberID % 3)=0"), 'sdss_near.csv'],
  [SDSS("SELECT ra, dec, z FROM SpecObj WHERE class='GALAXY' AND z BETWEEN 0.2 AND 0.8 AND zWarning=0 AND sciencePrimary=1 AND (fiberID % 14)=0"), 'sdss_far.csv'],
  [SDSS("SELECT ra, dec, z FROM SpecObj WHERE class='QSO' AND z > 0.1 AND zWarning=0 AND sciencePrimary=1 AND (fiberID % 8)=0"), 'sdss_qso.csv'],
  [SBDB, 'ast.json'],
  [EXO, 'exo.csv'],
  ['https://lambda.gsfc.nasa.gov/data/map/dr5/dfp/ilc/wmap_ilc_9yr_v5.fits', 'wmap_ilc.fits'],
  /* McConnachie (2012) atualizado — o site do autor bloqueia pedidos diretos; cópia do Internet Archive */
  ['https://web.archive.org/web/2024id_/https://www.astro.uvic.ca/~alan/Nearby_Dwarf_Database_files/NearbyGalaxies.dat', 'NearbyGalaxies.dat'],
  /* Reid et al. (2019) — fonte LaTeX do arXiv (tabelas de paralaxes de masers e dos braços) */
  ['https://arxiv.org/e-print/1910.03357', 'reid.tgz'],
  ...['-31', '-32', '-98', '-23', '-24'].map(id => [HZ(id), `hz${id}.json`]),
];

for (const [url, file] of JOBS) {
  const out = path.join(SRC, file);
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) { console.log('ok  ', file); continue; }
  console.log('get ', file);
  execFileSync('curl', ['-s', '-L', '-m', '900', '-o', out, url], { stdio: 'inherit' });
}
fs.mkdirSync(path.join(SRC, 'reid'), { recursive: true });
execFileSync('tar', ['-xzf', path.join(SRC, 'reid.tgz'), '-C', path.join(SRC, 'reid')]);
console.log('feito');
