/* node tools/phototest/safe-area.mjs — emula as margens seguras do iPhone (CDP) e mede o que fica debaixo delas */
import puppeteer from 'puppeteer-core';
import os from 'node:os';
const TMP = (process.env.PHOTOTEST_TMP || os.tmpdir() + '/dcop7-phototest').replace(/\\/g, '/');
const OUT = TMP + '/';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
const run = async (label, vp, insets, routes) => {
  const p = await b.newPage();
  await p.emulate({ viewport: { ...vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
  const cdp = await p.createCDPSession();
  let supported = true;
  try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets }); } catch (e) { supported = false; console.log('CDP sem setSafeAreaInsetsOverride:', e.message.slice(0, 80)); }
  await p.evaluateOnNewDocument(() => { navigator.serviceWorker && (navigator.serviceWorker.register = () => Promise.reject('nosw')); });
  for (const r of routes) {
    await p.goto('about:blank'); await p.goto('http://127.0.0.1:8321/photography/#' + r, { waitUntil: 'networkidle2' }); await new Promise(x => setTimeout(x, 2500));
    const res = await p.evaluate(ins => {
      const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;left:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe);
      const cs = getComputedStyle(probe), env = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]; probe.remove();
      const under = [];
      document.querySelectorAll('button, a[href], input, select, [role=slider]').forEach(el => {
        if (el.closest('.dk-tabs, .gp-toc, .cs-jump, .in-tabs, .ph-panel:not(.active)') && !el.closest('.dk-tabs[style]')) { const sc = el.closest('.dk-tabs, .gp-toc, .cs-jump, .in-tabs'); if (sc && (sc.scrollWidth > sc.clientWidth + 2 || sc.scrollHeight > sc.clientHeight + 2)) return; }
        const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return; const q = el.getBoundingClientRect(); if (q.width < 2 || q.height < 2 || q.bottom < 0 || q.top > innerHeight) return;
        const name = (el.getAttribute('aria-label') || el.title || el.textContent || el.className || '').trim().slice(0, 28);
        if (q.top < (ins.top || 0) - 1) under.push('cima: ' + name); else if (q.left < (ins.left || 0) - 1) under.push('esq: ' + name); else if (q.right > innerWidth - (ins.right || 0) + 1) under.push('dir: ' + name); else if (q.bottom > innerHeight - (ins.bottom || 0) + 1 && s.position !== 'static' && q.bottom <= innerHeight + 1) under.push('baixo: ' + name);
      });
      return { env, n: under.length, under: [...new Set(under)].slice(0, 8) };
    }, insets);
    console.log(label.padEnd(10), ('#' + r).padEnd(20), 'env=' + res.env.join(' '), '· controlos debaixo das margens:', res.n, res.under.join(' | '));
    await p.screenshot({ path: OUT + `safe-${label}-${r.replace(/\//g, '_') || 'home'}.png` });
  }
  await p.close();
  return supported;
};
const routes = (process.argv[2] || ',laboratorio/camara,edicao/mesa,g/retrato').split(',');
await run('retrato', { width: 390, height: 844 }, { top: 47, bottom: 34 }, routes);
await run('deitado', { width: 844, height: 390 }, { left: 47, right: 47, bottom: 21 }, routes);
await run('deitado932', { width: 932, height: 430 }, { left: 59, right: 59, bottom: 21 }, routes);
await b.close();
