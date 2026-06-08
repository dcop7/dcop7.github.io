/* ══════════════════════════════════════════════════════════════════
   build-places.mjs — generates data/events/pt-places.json
   A lookup table { normalised-place-name : [lat, lon] } used by the
   Eventos section to geocode events by concelho/cidade name (radius +
   distance + map pins). Built offline from data already in the repo:
     • data/worlddata/cities.json  (178 PT cities with lat/lon)
     • the 18 mainland district + 2 island-group centroids below
   No network, no API. Run:  node data/events/build-places.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(HERE)) === HERE ? HERE : dirname(HERE) + '/..';
const REPO = HERE + '/../..';

/* Normalise like the runtime does: lower-case, strip accents, collapse spaces. */
const norm = (s) => (s || '')
  .toString().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').trim();

/* District + island-group centroids (Portuguese names — match e-cultura's
   location_distrito). Same values used in ocorrencias.js. */
const DISTRICTS = {
  'Aveiro': [40.64, -8.65], 'Beja': [37.96, -7.87], 'Braga': [41.55, -8.42],
  'Bragança': [40.67, -7.50], 'Castelo Branco': [39.83, -7.49], 'Coimbra': [40.21, -8.43],
  'Évora': [38.57, -7.91], 'Faro': [37.01, -7.93], 'Guarda': [40.53, -7.27],
  'Leiria': [39.74, -8.81], 'Lisboa': [38.72, -9.14], 'Porto': [41.16, -8.62],
  'Portalegre': [39.30, -8.57], 'Setúbal': [38.52, -8.89], 'Santarém': [39.23, -8.69],
  'Viana do Castelo': [41.69, -8.83], 'Viseu': [40.66, -7.91], 'Vila Real': [41.30, -7.74],
  'Madeira': [32.75, -17.00], 'Açores': [37.74, -25.67],
};

/* English/variant → Portuguese aliases for names that differ in cities.json. */
const ALIAS = {
  'lisbon': 'Lisboa',
};

const places = {};
const put = (name, lat, lon) => {
  const k = norm(name);
  if (!k || places[k]) return;
  places[k] = [Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4];
};

/* 1) Cities from cities.json (real coordinates). */
const cities = JSON.parse(readFileSync(REPO + '/data/worlddata/cities.json', 'utf8'));
const arr = Array.isArray(cities) ? cities : (cities.cities || []);
let nCities = 0;
for (const c of arr) {
  if ((c.cc || c.iso2) !== 'PT' && c.iso3 !== 'PRT') continue;
  if (typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
  put(c.name, c.lat, c.lon);
  if (ALIAS[norm(c.name)]) put(ALIAS[norm(c.name)], c.lat, c.lon);
  nCities++;
}

/* 2) District centroids (fallback when only the distrito is known). */
for (const [d, [lat, lon]] of Object.entries(DISTRICTS)) put(d, lat, lon);

/* 3) A few common concelhos absent from cities.json (well-known coords). */
const EXTRA = {
  'Sintra': [38.80, -9.38], 'Mafra': [38.94, -9.33], 'Óbidos': [39.36, -9.16],
  'Nazaré': [39.60, -9.07], 'Batalha': [39.66, -8.82], 'Fátima': [39.63, -8.67],
  'Lagos': [37.10, -8.67], 'Sagres': [37.01, -8.95], 'Sines': [37.95, -8.87],
  'Elvas': [38.88, -7.16], 'Marvão': [39.39, -7.38], 'Monsaraz': [38.44, -7.38],
  'Lamego': [41.10, -7.81], 'Mirandela': [41.49, -7.18], 'Peso da Régua': [41.16, -7.79],
  'Angra do Heroísmo': [38.66, -27.22], 'Horta': [38.53, -28.63], 'Machico': [32.71, -16.77],
  'Vila Nova de Famalicão': [41.41, -8.52], 'Penafiel': [41.20, -8.28], 'Amarante': [41.27, -8.08],
  'Caminha': [41.87, -8.84], 'Lousã': [40.11, -8.24], 'Seia': [40.42, -7.71],
  'Tondela': [40.52, -8.08], 'Estremoz': [38.84, -7.59], 'Reguengos de Monsaraz': [38.42, -7.53],
  'Tavira': [37.13, -7.65], 'Vila Real de Santo António': [37.19, -7.42], 'Lagoa': [37.14, -8.45],
};
for (const [n, [lat, lon]] of Object.entries(EXTRA)) put(n, lat, lon);

mkdirSync(HERE, { recursive: true });
writeFileSync(HERE + '/pt-places.json', JSON.stringify(places));
console.log(`pt-places.json: ${Object.keys(places).length} places (${nCities} cities + ${Object.keys(DISTRICTS).length} districts + ${Object.keys(EXTRA).length} extra)`);
