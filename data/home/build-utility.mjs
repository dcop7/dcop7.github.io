/* ══════════════════════════════════════════════════════════════════
   build-utility.mjs — generates data/home/utility.json for the homepage
   "Útil hoje" section: fuel prices (DGEG), electricity (OMIE), and a
   weather fallback (Open-Meteo for the default city, Leiria). Runs in a
   daily GitHub Action so the browser reads one small local JSON.
   3-tier: live fetch → committed utility.json (cache) → previous values.
       node data/home/build-utility.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));

const UA = 'dcop7.github.io utility builder';
async function getJSON(url) { try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }); return r.ok ? await r.json() : null; } catch (e) { console.warn('  ! json', e.message); return null; } }
async function getText(url) { try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); return r.ok ? await r.text() : null; } catch (e) { console.warn('  ! text', e.message); return null; } }

let prev = {};
try { prev = JSON.parse(readFileSync(join(HERE, 'utility.json'), 'utf8')); } catch (e) {}
const out = { generated: new Date().toISOString() };

/* ── ⛽ Combustíveis (DGEG, média nacional ponderada — Continental) ── */
console.log('Fuel (DGEG)…');
{
  const CONT = new Set(['Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Faro', 'Guarda', 'Leiria', 'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu', 'Évora']);
  const TARGET = { 'Gasolina simples 95': 'gasolina95', 'Gasóleo simples': 'gasoleo', 'GPL Auto': 'gpl' };
  const acc = { gasolina95: { s: 0, w: 0, n: 0 }, gasoleo: { s: 0, w: 0, n: 0 }, gpl: { s: 0, w: 0, n: 0 } };
  const parsePrice = p => parseFloat(String(p).replace(/[^0-9,.-]/g, '').replace(',', '.'));
  let pages = 0;
  for (let p = 1; p <= 90; p++) {
    const r = await getJSON('https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos?f=json&pagina=' + p);
    const rows = r && r.resultado; if (!rows || !rows.length) break;
    pages = p;
    for (const x of rows) {
      const key = TARGET[x.Combustivel]; if (!key) continue;
      if (!CONT.has(x.Distrito)) continue;
      const price = parsePrice(x.Preco); const qty = Math.max(1, Number(x.Quantidade) || 1);
      if (!isFinite(price) || price <= 0 || price > 5) continue;
      acc[key].s += price * qty; acc[key].w += qty; acc[key].n++;
    }
    /* stop early once we have a solid sample of all three */
    if (acc.gasolina95.n > 250 && acc.gasoleo.n > 250 && acc.gpl.n > 250) break;
  }
  const round3 = v => Math.round(v * 1000) / 1000;
  const fuel = { date: new Date().toISOString().slice(0, 10), samples: {} };
  for (const k of ['gasolina95', 'gasoleo', 'gpl']) {
    const a = acc[k]; const avg = a.w ? round3(a.s / a.w) : null;
    const pv = prev.fuel && prev.fuel[k] ? prev.fuel[k].price : null;
    fuel[k] = { price: avg, prev: pv, delta: (avg != null && pv != null) ? round3(avg - pv) : null };
    fuel.samples[k] = a.n;
  }
  out.fuel = (fuel.gasolina95.price || fuel.gasoleo.price || fuel.gpl.price) ? fuel : (prev.fuel || null);
  console.log(`  pages=${pages} g95=${fuel.gasolina95.price} (n${fuel.samples.gasolina95}) diesel=${fuel.gasoleo.price} (n${fuel.samples.gasoleo}) gpl=${fuel.gpl.price} (n${fuel.samples.gpl})`);
}

/* ── ⚡ Eletricidade (OMIE day-ahead → estimativa na fatura) ──────── */
console.log('Electricity (OMIE)…');
{
  const ymd = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  async function omieAvg(date) {
    const t = await getText(`https://www.omie.es/pt/file-download?parents=marginalpdbcpt&filename=marginalpdbcpt_${ymd(date)}.1`);
    if (!t || !/MARGINALPDBCPT/i.test(t)) return null;
    const vals = t.split('\n').map(l => l.split(';')).filter(c => c.length >= 5 && /^\d{4}$/.test(c[0])).map(c => parseFloat(c[4])).filter(v => isFinite(v));
    if (!vals.length) return null;
    return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
  }
  const today = new Date(); const yest = new Date(Date.now() - 86400000);
  let cur = await omieAvg(today); let base = await omieAvg(yest);
  if (!cur) { cur = base; base = await omieAvg(new Date(Date.now() - 2 * 86400000)); }   /* today not published yet */
  if (cur) {
    /* estimated indexed-tariff energy price on the bill (c€/kWh, incl. VAT).
       Transparent rough model: (OMIE €/kWh × losses + grid access + extras) × (1+VAT). */
    const LOSSES = 1.10, TAR = 0.04, EXTRA = 0.012, IVA = 0.23;
    const omieC = +(cur.avg / 10).toFixed(2);                       /* €/MWh → c€/kWh */
    const bill = +(((cur.avg / 1000) * LOSSES + TAR + EXTRA) * (1 + IVA) * 100).toFixed(1);
    const prevBill = base ? +(((base.avg / 1000) * LOSSES + TAR + EXTRA) * (1 + IVA) * 100).toFixed(1) : null;
    out.electricity = {
      date: new Date().toISOString().slice(0, 10),
      omie: omieC, bill, prevBill,
      min: +(cur.min / 10).toFixed(1), max: +(cur.max / 10).toFixed(1),
      trend: prevBill == null ? 'flat' : (bill > prevBill + 0.1 ? 'up' : bill < prevBill - 0.1 ? 'down' : 'flat'),
    };
    console.log(`  OMIE avg=${cur.avg.toFixed(1)} €/MWh → ${omieC} c/kWh · bill≈${bill} c/kWh (${out.electricity.trend})`);
  } else { out.electricity = prev.electricity || null; console.log('  ! OMIE unavailable, kept previous'); }
}

/* ── 🌤️ Meteo (Open-Meteo, Leiria — fallback for offline / default city) ── */
console.log('Weather (Leiria fallback)…');
{
  const LAT = 39.7436, LON = -8.8071;
  const w = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&timezone=Europe%2FLisbon&forecast_days=4`);
  if (w && w.current) {
    out.weather = {
      city: 'Leiria', lat: LAT, lon: LON,
      temp: Math.round(w.current.temperature_2m), code: w.current.weather_code, isDay: w.current.is_day,
      sunrise: w.daily.sunrise[0], sunset: w.daily.sunset[0],
      days: w.daily.time.map((t, i) => ({ date: t, min: Math.round(w.daily.temperature_2m_min[i]), max: Math.round(w.daily.temperature_2m_max[i]), code: w.daily.weather_code[i] })),
    };
    console.log(`  Leiria ${out.weather.temp}° code ${out.weather.code}`);
  } else { out.weather = prev.weather || null; console.log('  ! weather unavailable'); }
}

writeFileSync(join(HERE, 'utility.json'), JSON.stringify(out));
console.log('\nutility.json written.');
