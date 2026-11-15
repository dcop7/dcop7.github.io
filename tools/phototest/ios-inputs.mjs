/* campos de escrita com letra < 16px: no iOS o Safari amplia a página ao focar */
import { webkit } from 'playwright';
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const routes = ['', 'consulta', 'g/retrato', 'aprender', 'aprender/composicao', 'aprender/equipamento', 'edicao', 'edicao/exposicao', 'edicao/mesa', 'laboratorio', 'laboratorio/camara', 'laboratorio/exposure', 'laboratorio/dof', 'laboratorio/focal', 'laboratorio/hf', 'laboratorio/nd', 'laboratorio/flash', 'laboratorio/le', 'laboratorio/gh', 'estudio'];
let tot = 0;
for (const r of routes) {
  await p.goto('about:blank'); await p.goto('http://127.0.0.1:8321/photography/#' + r, { waitUntil: 'load' }); await p.waitForTimeout(r === 'estudio' ? 9000 : 1800);
  if (r === '') { await p.evaluate(() => { const b = document.querySelector('[data-search], .dp-search, [aria-label*="esquisar"]'); b && b.click(); }); await p.waitForTimeout(400); }
  const res = await p.evaluate(() => {
    const out = new Map();
    document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not([type=button]):not([type=color]), select, textarea').forEach(el => {
      const s = getComputedStyle(el), q = el.getBoundingClientRect(); if (s.display === 'none' || s.visibility === 'hidden' || q.width < 2) return;
      const fs = parseFloat(s.fontSize); if (fs < 16) { const k = el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '') + '.' + (el.className || el.closest('[class]').className).toString().split(' ')[0] + ' ' + fs + 'px'; out.set(k, (out.get(k) || 0) + 1); }
    });
    return [...out.entries()].map(([k, n]) => k + ' ×' + n);
  });
  tot += res.length;
  if (res.length) console.log(('#' + r).padEnd(24), res.join(' | '));
}
console.log('rotas com campos < 16px:', tot ? '' : 'nenhuma', '(tipos distintos: ' + tot + ')');
await b.close();
