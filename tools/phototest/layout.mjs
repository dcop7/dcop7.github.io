/* node tools/phototest/layout.mjs — as duas bancadas em vários ecrãs: capturas + verificações de layout */
import puppeteer from 'puppeteer-core';
import os from 'node:os';
const TMP = (process.env.PHOTOTEST_TMP || os.tmpdir() + '/dcop7-phototest').replace(/\\/g, '/');
const OUT = TMP + '/vp/';
import fs from 'node:fs'; fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
const VPS = [[320, 568], [360, 740], [390, 844], [430, 932], [568, 320], [667, 375], [844, 390], [932, 430], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1280, 720], [1920, 1080]];
const only = process.argv[2];
let bad = 0;
for (const [w, h] of VPS) {
  if (only && only !== w + 'x' + h) continue;
  const p = await b.newPage();
  const touch = w < 1200;
  await p.emulate({ viewport: { width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch }, userAgent: touch ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' : await b.userAgent() });
  await p.evaluateOnNewDocument(() => { navigator.serviceWorker && (navigator.serviceWorker.register = () => Promise.reject('nosw')); });
  for (const [r, tabs] of [['laboratorio/camara/lab-retrato', ['camara', 'extra', 'leitura', 'exp', 'cenas']], ['edicao/mesa/own-18', ['luz', 'curva', 'hsl', 'estilos']]]) {
    await p.goto('about:blank'); await p.goto('http://127.0.0.1:8321/photography/#' + r, { waitUntil: 'networkidle2' }); await new Promise(x => setTimeout(x, 2200));
    for (const cmp of ['result', 'side']) {
      await p.evaluate(c => document.querySelector(`.dk-cmp [data-cmp="${c}"]`).click(), cmp); await new Promise(x => setTimeout(x, 300));
      for (const tab of (cmp === 'result' ? tabs : [tabs[0]])) {
        await p.evaluate(t => { const b = document.querySelector(`.dk-tabs button[data-tab="${t}"]`); if (b && b.offsetParent) b.click(); }, tab); await new Promise(x => setTimeout(x, 200));
        const res = await p.evaluate(W => {
          const out = [], dk = document.querySelector('.dk'), vis = e => { const s = getComputedStyle(e), q = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && q.width > 1 && q.height > 1; };
          const R = e => e.getBoundingClientRect(), name = e => (e.getAttribute('aria-label') || e.title || e.textContent || e.className).trim().slice(0, 22);
          if (document.documentElement.scrollWidth > innerWidth + 1) out.push('scroll horizontal da página');
          if (innerWidth > W + 1) out.push('a página alargou para ' + innerWidth + 'px (conteúdo mais largo do que o ecrã de ' + W + 'px)');
          const dq = R(dk); if (dq.bottom > innerHeight + 1 || dq.right > innerWidth + 1) out.push('bancada maior do que o ecrã ' + Math.round(dq.width) + '×' + Math.round(dq.height));
          /* barra: nada cortado nem sobreposto */
          const bar = [...dk.querySelectorAll('.dk-bar button, .dk-bar a')].filter(vis);
          bar.forEach(e => { const q = R(e); if (q.right > innerWidth + 1 || q.left < -1) out.push('barra: fora do ecrã → ' + name(e)); });
          for (let i = 0; i < bar.length; i++) for (let j = i + 1; j < bar.length; j++) { const a = R(bar[i]), c = R(bar[j]); if (bar[i].contains(bar[j]) || bar[j].contains(bar[i])) continue; if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 3 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 3) out.push('barra: sobrepostos → ' + name(bar[i]) + ' / ' + name(bar[j])); }
          const ts = dk.querySelector('.dk-title-s'); if (ts && vis(ts) && R(ts).width < 24 && ts.textContent) out.push('título esmagado (' + Math.round(R(ts).width) + 'px)');
          /* histograma por cima de controlos */
          const hq = R(dk.querySelector('.dk-histo-cv'));
          [...dk.querySelectorAll('.dk-secs button, .dk-secs input, .dk-left button, .dk-bar button')].filter(vis).forEach(e => { const q = R(e); if (Math.min(q.right, hq.right) - Math.max(q.left, hq.left) > 4 && Math.min(q.bottom, hq.bottom) - Math.max(q.top, hq.top) > 4 && getComputedStyle(dk.querySelector('.dk-histo')).position === 'absolute') out.push('histograma tapa → ' + name(e)); });
          /* separadores com o nome cortado */
          [...dk.querySelectorAll('.dk-tabs button')].filter(vis).forEach(e => { const s = e.querySelector('span'); if (s && (s.scrollWidth > e.clientWidth + 1 || R(s).left < R(e).left - 1 || R(s).right > R(e).right + 1)) out.push('separador cortado → ' + s.textContent); });
          /* a fotografia vê-se */
          const fr = R(dk.querySelector('.dk-frame-r')); if (fr.width < 120 || fr.height < 90) out.push('fotografia demasiado pequena ' + Math.round(fr.width) + '×' + Math.round(fr.height));
          const vw = R(dk.querySelector('.dk-view')); if (fr.left < vw.left - 1 || fr.right > vw.right + 1 || fr.top < vw.top - 1 || fr.bottom > vw.bottom + 1) out.push('fotografia sai do palco');
          /* controlos do painel visível dentro do ecrã, na horizontal */
          [...dk.querySelectorAll('.dk-sec button, .dk-sec input, .dk-sec output')].filter(vis).forEach(e => { const q = R(e); if (q.right > innerWidth + 1 || q.left < -1) out.push('painel: fora do ecrã → ' + name(e)); });
          return [...new Set(out)];
        }, w);
        const mode = r.startsWith('lab') ? 'sim' : 'dev';
        if (res.length) { bad += res.length; console.log(`${w}×${h} ${mode} ${cmp}/${tab}:`, res.slice(0, 5).join(' | ')); }
        if (cmp === 'side' || tab === tabs[0] || tab === 'curva' || tab === 'leitura') await p.screenshot({ path: `${OUT}${w}x${h}-${mode}-${cmp}-${tab}.png` });
      }
    }
  }
  await p.close();
}
console.log('problemas de layout:', bad);
await b.close();
