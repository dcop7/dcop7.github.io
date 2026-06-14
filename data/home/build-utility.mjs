/* ══════════════════════════════════════════════════════════════════
   build-utility.mjs — generates data/home/utility.json for the homepage
   "Útil hoje" section: fuel prices (DGEG), electricity (OMIE) + regulated
   natural gas (ERSE), IPMA weather warnings, and a weather fallback
   (Open-Meteo for the default city, Leiria). Runs in a GitHub Action a
   couple of times a day so the browser reads one small local JSON.
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
const todayISO = new Date().toISOString().slice(0, 10);

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
    if (acc.gasolina95.n > 250 && acc.gasoleo.n > 250 && acc.gpl.n > 250) break;
  }
  const round3 = v => Math.round(v * 1000) / 1000;
  const fuel = { date: todayISO, samples: {} };
  for (const k of ['gasolina95', 'gasoleo', 'gpl']) {
    const a = acc[k]; const avg = a.w ? round3(a.s / a.w) : null;
    const pv = prev.fuel && prev.fuel[k] ? prev.fuel[k].price : null;
    fuel[k] = { price: avg, prev: pv, delta: (avg != null && pv != null) ? round3(avg - pv) : null };
    fuel.samples[k] = a.n;
  }
  const ok = fuel.gasolina95.price || fuel.gasoleo.price || fuel.gpl.price;
  if (!ok) { out.fuel = prev.fuel || null; }
  else {
    /* daily history (one point per day) for the week-over-week comparison */
    let hist = (prev.fuel && prev.fuel.history) || [];
    hist = hist.filter(h => h.date !== todayISO);
    hist.push({ date: todayISO, gasolina95: fuel.gasolina95.price, gasoleo: fuel.gasoleo.price, gpl: fuel.gpl.price });
    hist.sort((a, b) => a.date < b.date ? -1 : 1);
    hist = hist.slice(-16);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const past = [...hist].reverse().find(h => h.date <= weekAgo) || hist[0];
    fuel.week = {};
    for (const k of ['gasolina95', 'gasoleo', 'gpl']) {
      fuel.week[k] = (fuel[k].price != null && past && past[k] != null && past.date !== todayISO) ? round3(fuel[k].price - past[k]) : null;
    }
    fuel.weekFrom = (past && past.date !== todayISO) ? past.date : null;
    fuel.history = hist;
    out.fuel = fuel;
  }
  console.log(`  pages=${pages} g95=${fuel.gasolina95.price} diesel=${fuel.gasoleo.price} gpl=${fuel.gpl.price} weekFrom=${fuel.weekFrom}`);
}

/* ── ⚡ Eletricidade (OMIE day-ahead → estimativa na fatura) + 🔥 Gás ── */
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
  if (!cur) { cur = base; base = await omieAvg(new Date(Date.now() - 2 * 86400000)); }
  if (cur) {
    const LOSSES = 1.10, TAR = 0.04, EXTRA = 0.012, IVA = 0.23;
    const omieC = +(cur.avg / 10).toFixed(2);
    const bill = +(((cur.avg / 1000) * LOSSES + TAR + EXTRA) * (1 + IVA) * 100).toFixed(1);
    const prevBill = base ? +(((base.avg / 1000) * LOSSES + TAR + EXTRA) * (1 + IVA) * 100).toFixed(1) : null;
    out.electricity = {
      date: todayISO, omie: omieC, bill, prevBill,
      min: +(cur.min / 10).toFixed(1), max: +(cur.max / 10).toFixed(1),
      trend: prevBill == null ? 'flat' : (bill > prevBill + 0.1 ? 'up' : bill < prevBill - 0.1 ? 'down' : 'flat'),
    };
    console.log(`  OMIE avg=${cur.avg.toFixed(1)} €/MWh → bill≈${bill} c/kWh (${out.electricity.trend})`);
  } else { out.electricity = prev.electricity || null; console.log('  ! OMIE unavailable, kept previous'); }

  /* Natural gas: ERSE regulated variable term (escalão 1) — stable, "na fatura".
     Updated annually by ERSE; far closer to a real bill than volatile MIBGAS spot.
     Source: ERSE / tudoluzegas — 0,0647 €/kWh (ano-gás 2025/26). */
  out.gas = { price: 6.47, period: '2025/26', label: 'Tarifa regulada · escalão 1', src: 'ERSE' };
}

/* ── ⚠️ Avisos IPMA (por área/distrito) ───────────────────────────── */
console.log('IPMA warnings…');
{
  const warns = await getJSON('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json');
  const distr = await getJSON('https://api.ipma.pt/open-data/distrits-islands.json');
  if (Array.isArray(warns)) {
    const now = Date.now();
    const byCode = {};
    for (const w of warns) {
      if (!w.idAreaAviso || w.awarenessLevelID === 'green') continue;
      if (w.endTime && new Date(w.endTime).getTime() < now) continue;   /* expired */
      (byCode[w.idAreaAviso] ||= []).push({ type: w.awarenessTypeName, level: w.awarenessLevelID, start: w.startTime, end: w.endTime, text: (w.text || '').trim() });
    }
    const areas = [];
    const seen = new Set();
    for (const d of (distr && distr.data) || []) {
      if (seen.has(d.idAreaAviso)) continue; seen.add(d.idAreaAviso);
      areas.push({ code: d.idAreaAviso, name: d.local, lat: +d.latitude, lon: +d.longitude });
    }
    out.ipma = { warnings: byCode, areas };
    console.log(`  ${Object.keys(byCode).length} áreas com avisos · ${areas.length} áreas`);
  } else { out.ipma = prev.ipma || null; console.log('  ! IPMA unavailable'); }
}

/* ── 🌤️ Meteo (Open-Meteo, Leiria — fallback / default city) ──────── */
console.log('Weather (Leiria fallback)…');
{
  const LAT = 39.7436, LON = -8.8071;
  const w = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max,sunrise,sunset&timezone=Europe%2FLisbon&forecast_days=6`);
  if (w && w.current) {
    out.weather = {
      city: 'Leiria', lat: LAT, lon: LON, area: 'LRA',
      temp: Math.round(w.current.temperature_2m), feels: Math.round(w.current.apparent_temperature),
      humidity: Math.round(w.current.relative_humidity_2m), wind: Math.round(w.current.wind_speed_10m),
      code: w.current.weather_code, isDay: w.current.is_day,
      uv: w.daily.uv_index_max[0] != null ? Math.round(w.daily.uv_index_max[0]) : null,
      sunrise: w.daily.sunrise[0], sunset: w.daily.sunset[0],
      days: w.daily.time.map((t, i) => ({ date: t, min: Math.round(w.daily.temperature_2m_min[i]), max: Math.round(w.daily.temperature_2m_max[i]), code: w.daily.weather_code[i], pop: w.daily.precipitation_probability_max[i], uv: w.daily.uv_index_max[i] != null ? Math.round(w.daily.uv_index_max[i]) : null })),
    };
    console.log(`  Leiria ${out.weather.temp}° code ${out.weather.code} uv${out.weather.uv}`);
  } else { out.weather = prev.weather || null; console.log('  ! weather unavailable'); }
}

writeFileSync(join(HERE, 'utility.json'), JSON.stringify(out));
console.log('\nutility.json written.');
