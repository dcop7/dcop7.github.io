/* node tools/phototest/routes.mjs [largura] — TODAS as rotas do índice de pesquisa: erros, pedidos falhados, imagens partidas, página mais larga do que o ecrã */
import puppeteer from 'puppeteer-core';
const W = +(process.argv[2] || 360);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
const p = await b.newPage();
if (W < 900) await p.emulate({ viewport: { width: W, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' });
else await p.setViewport({ width: W, height: 900 });
await p.evaluateOnNewDocument(() => { navigator.serviceWorker && (navigator.serviceWorker.register = () => Promise.reject('nosw')); });
let errs = [];
p.on('pageerror', e => errs.push('JS ' + e.message.slice(0, 120)));
p.on('console', m => { if (m.type() === 'error' && !/nosw|ServiceWorker/.test(m.text())) errs.push('console ' + m.text().slice(0, 120)); });
p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().slice(-70)); });
await p.goto('http://127.0.0.1:8321/photography/', { waitUntil: 'networkidle2' }); await new Promise(x => setTimeout(x, 1500));
const routes = await p.evaluate(async () => { const ix = await PhotographyPage.searchIndex(); return [...new Set(ix.map(i => i.r))]; });
console.log('rotas no índice:', routes.length);
let bad = 0, n = 0; errs = [];
for (const r of routes) {
  if (r === 'estudio') continue;
  await p.evaluate(r => { location.hash = '#' + r; }, r);
  await new Promise(x => setTimeout(x, /mesa|camara/.test(r) ? 1500 : 450));
  try { await p.waitForNetworkIdle({ idleTime: 250, timeout: 8000 }); } catch (_) {}
  const s = await p.evaluate(W => {
    const v = document.querySelector('#view-photography .ph-panel.active'), txt = (v ? v.innerText : '').trim();
    const brk = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && i.offsetParent).map(i => i.getAttribute('src').slice(-36));
    return { wide: innerWidth > W + 1 ? innerWidth : document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth : 0, len: txt.length, brk, hash: location.hash.slice(1), title: document.title, emoji: /undefined|NaN|\[object/.test(txt) };
  }, W);
  n++;
  const probs = [];
  if (s.wide) probs.push('largura ' + s.wide); if (s.len < 80) probs.push('vazia (' + s.len + ')'); if (s.brk.length) probs.push('imagens partidas ' + s.brk.slice(0, 3).join(',')); if (s.emoji) probs.push('texto com undefined/NaN');
  if (errs.length) probs.push([...new Set(errs)].slice(0, 3).join(' | '));
  if (probs.length) { bad++; console.log(('#' + r).padEnd(44), probs.join(' · ')); }
  errs = [];
}
console.log(`${W}px: ${n} rotas visitadas, ${bad} com problemas`);
await b.close();
