/* ══════════════════════════════════════════════════════════════════
   build-concelhos-stats.mjs — Censos 2021 por concelho → data/pt-concelhos-stats.json
   ──────────────────────────────────────────────────────────────────
   Fonte: INE, indicador 0011609 «População residente por local de
   residência, sexo e grupo etário — Censos 2021» (dados abertos, reutilização
   livre com indicação da fonte). Descarregar com:

     curl "https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0011609&Dim1=S7A2021&Dim3=T&lang=PT" -o ine-age.json
     node tools/pt/build-concelhos-stats.mjs ine-age.json

   Os códigos de concelho do INE são DDCC (DD = distrito por ordem alfabética,
   01 Aveiro … 18 Viseu — a mesma ordem dos ids do explorador). A ligação ao
   data/pt-concelhos.geojson faz-se por distrito + nome normalizado.

   Saída: { c:   { "<distrito>|<nome normalizado>": [pop, %0-14, %65+], … },
            isl: { madeira: […], acores: […] } }   — totais das regiões autónomas
                                                       (códigos NUTS 30 e 20)
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('uso: node tools/pt/build-concelhos-stats.mjs <ine-age.json>'); process.exit(1); }
const all = JSON.parse(fs.readFileSync(src, 'utf8'))[0].Dados['2021'];
const rows = all.filter(r => r.geocod.length === 4 && /^\d{4}$/.test(r.geocod));
const DIST = ['aveiro', 'beja', 'braga', 'braganca', 'castelo-branco', 'coimbra', 'evora', 'faro', 'guarda', 'leiria', 'lisboa',
  'portalegre', 'porto', 'santarem', 'setubal', 'viana-do-castelo', 'vila-real', 'viseu'];
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const by = {};
for (const r of rows) {
  const dd = +r.geocod.slice(0, 2);
  if (dd < 1 || dd > 18) continue;                       /* 2x/3x = ilhas (fora do mapa do continente) */
  const k = DIST[dd - 1] + '|' + norm(r.geodsg);
  (by[k] = by[k] || {})[r.dim_4] = +r.valor;
}

const gj = JSON.parse(fs.readFileSync('data/pt-concelhos.geojson', 'utf8'));
const out = {}, miss = [];
for (const f of gj.features) {
  const k = f.properties.d + '|' + norm(f.properties.c);
  const v = by[k];
  if (!v || !v.T) { miss.push(k); continue; }
  out[k] = [v.T, +(v['1'] / v.T * 100).toFixed(1), +(v['4'] / v.T * 100).toFixed(1)];
}
if (miss.length) { console.error('sem correspondência:', miss); process.exit(1); }

const isl = {};
for (const [id, code] of [['madeira', '30'], ['acores', '20']]) {
  const v = {}; all.filter(r => r.geocod === code).forEach(r => { v[r.dim_4] = +r.valor; });
  if (!v.T) { console.error('sem totais para', id); process.exit(1); }
  isl[id] = [v.T, +(v['1'] / v.T * 100).toFixed(1), +(v['4'] / v.T * 100).toFixed(1)];
}
fs.writeFileSync('data/pt-concelhos-stats.json', JSON.stringify({ _src: 'INE, Censos 2021 (indicador 0011609)', c: out, isl }));
console.log(`${Object.keys(out).length} concelhos → data/pt-concelhos-stats.json`);
