/* node tools/phototest/touch.mjs [largura] — gestos de toque reais (eventos de toque injetados por CDP) nas duas bancadas */
import puppeteer from 'puppeteer-core';
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const ok = (n, c, g) => { if (!c) fail++; console.log((c ? '  ok  ' : ' FALHA ') + n + (g !== undefined ? '  → ' + (typeof g === 'string' ? g : JSON.stringify(g)) : '')); };
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--force-prefers-reduced-motion'] });
const p = await b.newPage();
await p.emulate({ viewport: { width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' });
await p.evaluateOnNewDocument(() => { navigator.serviceWorker && (navigator.serviceWorker.register = () => Promise.reject('nosw')); });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
const cdp = await p.createCDPSession();
const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x: Math.round(x), y: Math.round(y), id: id || 0, radiusX: 8, radiusY: 8, force: 1 })) });
const idle = async () => { await sleep(300); await p.waitForFunction(() => { const c = typeof PhDesk !== 'undefined' && PhDesk._cur(); return c && c.sizes && !c.busy && !c.next && c.root.dataset.ready === '1'; }, { timeout: 40000 }); await sleep(150); };
const st = () => p.evaluate(() => { const c = PhDesk._cur(); return { z: Math.round(c.z * 100) / 100, px: Math.round(c.px), py: Math.round(c.py), wipe: Math.round(c.wipe * 100), hold: c.root.dataset.hold || '', cmp: c.root.dataset.cmp, focus: c.st ? Math.round(c.st.focus * 10) / 10 : null, ret: c.root.querySelector('.dk-reticle') ? !c.root.querySelector('.dk-reticle').hidden : null }; });
const box = sel => p.evaluate(sel => { const q = document.querySelector(sel).getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height, cx: q.left + q.width / 2, cy: q.top + q.height / 2 }; }, sel);
const hash = () => p.evaluate(() => { const c = document.querySelector('.dk-cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
const drag = async (x0, y0, x1, y1, steps = 8) => { await T('touchStart', [[x0, y0]]); for (let i = 1; i <= steps; i++) { await T('touchMove', [[x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]]); await sleep(16); } await T('touchEnd', []); };
const tapAt = async (x, y) => { await T('touchStart', [[x, y]]); await sleep(40); await T('touchEnd', []); };
const tabTo = id => p.evaluate(id => { const b = document.querySelector(`.dk-tabs button[data-tab="${id}"]`); if (b && b.offsetParent) b.click(); }, id);

console.log(`\n══ toque · ${W}×${H} ══\n── câmara escura ──`);
if (!process.env.SKIPSIM) {
await p.goto('http://127.0.0.1:8321/photography/#laboratorio/camara/lab-retrato', { waitUntil: 'networkidle2' }); await idle();
var v = await box('.dk-view'), fr = await box('.dk-frame-r');
/* um toque = focar */
const f0 = (await st()).focus;
await tapAt(fr.x + fr.w * 0.82, fr.y + fr.h * 0.3); await idle();
var s = await st();
ok('um toque na fotografia muda o foco e mostra a mira', s.focus !== f0 && s.ret === true, { antes: f0, depois: s.focus });
/* beliscar para ampliar */
const pinch = async (d0, d1) => { const cx = v.cx, cy = v.cy; await T('touchStart', [[cx - d0, cy, 0], [cx + d0, cy, 1]]); for (let i = 1; i <= 8; i++) { const d = d0 + (d1 - d0) * i / 8; await T('touchMove', [[cx - d, cy, 0], [cx + d, cy, 1]]); await sleep(16); } };
const fBefore = s.focus;
await pinch(40, 110);
const mid = await st();
/* larga o primeiro dedo e mexe o segundo 2px: a fotografia não pode saltar */
await T('touchMove', [[v.cx + 110, v.cy, 1]]); await sleep(30);   // CDP: a lista sem o ponto 0 = esse dedo levantou
await T('touchMove', [[v.cx + 112, v.cy, 1]]); await sleep(30);
const afterLift = await st();
await T('touchEnd', []); await idle();
s = await st();
ok('beliscar amplia', mid.z > 1.8, { zoom: mid.z });
ok('largar um dedo a meio do beliscar não faz a fotografia saltar', Math.abs(afterLift.px - mid.px) <= 6 && Math.abs(afterLift.py - mid.py) <= 6, { antes: [mid.px, mid.py], depois: [afterLift.px, afterLift.py] });
ok('beliscar não conta como toque (o foco fica onde estava)', s.focus === fBefore, { foco: s.focus });
/* arrastar com um dedo: deslocar a fotografia ampliada */
const p0 = await st(); await drag(v.cx, v.cy, v.cx - 60, v.cy - 40); const p1 = await st();
ok('arrastar com um dedo desloca a fotografia ampliada', p1.px < p0.px - 20 && p1.py < p0.py - 10 && p1.focus === fBefore, { de: [p0.px, p0.py], para: [p1.px, p1.py] });
await pinch(110, 20); await T('touchEnd', []); await sleep(200);
ok('beliscar para dentro volta a ajustar ao ecrã', (await st()).z === 1, await st());
/* cortina */
await p.evaluate(() => document.querySelector('.dk-cmp [data-cmp="wipe"]').click()); await sleep(300);
const wp = await box('.dk-wipe'); fr = await box('.dk-frame-r');
await drag(wp.cx, wp.cy, fr.x + fr.w * 0.2, wp.cy);
s = await st(); ok('a cortina arrasta-se com o dedo', Math.abs(s.wipe - 20) <= 4, { wipe: s.wipe });
/* segurar para ver o original */
const hb = await box('.dk-hold');
await T('touchStart', [[hb.cx, hb.cy]]); await sleep(350);
const held = await st(); await T('touchEnd', []); await sleep(120);
ok('manter o dedo no botão mostra o original e largar repõe', held.hold === '1' && (await st()).hold === '', { premido: held.hold });
await p.evaluate(() => document.querySelector('.dk-cmp [data-cmp="result"]').click());
/* cursor do tempo com o dedo */
await tabTo('camara'); await sleep(250);
await p.evaluate(() => document.querySelector('.dk-secs [data-act="reset"]').click()); await idle();
const h0 = await hash();
const tr = await box('.dk-dial[data-k="t"] input');
const val0 = await p.evaluate(() => +document.querySelector('.dk-dial[data-k="t"] input').value);
await drag(tr.x + tr.w * (val0 / await p.evaluate(() => +document.querySelector('.dk-dial[data-k="t"] input').max)), tr.cy, tr.x + tr.w * 0.92, tr.cy, 12); await idle();
const val1 = await p.evaluate(() => +document.querySelector('.dk-dial[data-k="t"] input').value);
ok('o cursor do tempo arrasta-se com o dedo e a imagem muda', val1 > val0 + 3 && (await hash()) !== h0, { de: val0, para: val1 });
/* o painel desliza na vertical sem mexer nos cursores */
await p.evaluate(() => { document.querySelector('.dk-sec.dk-tab-on').scrollTop = 0; }); const sec = await box('.dk-sec.dk-tab-on'); const before = await p.evaluate(() => [document.querySelector('.dk-sec.dk-tab-on').scrollTop, [...document.querySelectorAll('.dk-dial input')].map(i => i.value).join()]);
await drag(sec.cx, sec.y + sec.h * 0.8, sec.cx, sec.y + sec.h * 0.2, 10); await sleep(400);
const after = await p.evaluate(() => [document.querySelector('.dk-sec.dk-tab-on').scrollTop, [...document.querySelectorAll('.dk-dial input')].map(i => i.value).join()]);
ok('deslizar o painel na vertical faz scroll e não mexe nos cursores', after[0] > before[0] + 30 && after[1] === before[1], { scroll: [before[0], after[0]] });
/* os botões +/− */
await p.evaluate(() => document.querySelector('.dk-dial[data-k="iso"] .dk-step[data-step="1"]').scrollIntoView({ block: 'center' })); await sleep(250);
const pl = await box('.dk-dial[data-k="iso"] .dk-step[data-step="1"]'); const iso0 = await p.evaluate(() => document.querySelector('.dk-dial[data-k="iso"] .dk-dial-v').textContent);
await tapAt(pl.cx, pl.cy); await idle();
ok('o botão + do ISO responde ao toque', (await p.evaluate(() => document.querySelector('.dk-dial[data-k="iso"] .dk-dial-v').textContent)) !== iso0);
}
console.log('── mesa de revelação ──');
/* navegação dentro da app, como um utilizador: depois de um gesto de dois dedos injetado por CDP,
   uma navegação entre documentos deixa a emulação de toque sem entregar eventos (artefacto do DevTools) */
if (process.env.SKIPSIM) await p.goto('http://127.0.0.1:8321/photography/#edicao/mesa/own-18', { waitUntil: 'networkidle2' });
else await p.evaluate(() => { location.hash = '#edicao/mesa/own-18'; });
await sleep(1500); await idle();
await p.evaluate(() => document.querySelector('.dk-secs [data-act="reset"]').click()); await idle();
await tabTo('luz'); await sleep(250);
const u0 = await p.evaluate(() => PhDesk._cur().undo.length);
const e0 = await hash(); const ex = await box('[data-p="exposure"]');
await drag(ex.cx, ex.cy, ex.x + ex.w * 0.85, ex.cy, 10); await idle();
const exv = await p.evaluate(() => +document.querySelector('[data-p="exposure"]').value);
ok('o cursor da exposição arrasta-se com o dedo', exv > 1 && (await hash()) !== e0, { valor: exv });
ok('um gesto = uma entrada no histórico', await p.evaluate(() => PhDesk._cur().undo.length) === u0 + 1, [u0, await p.evaluate(() => PhDesk._cur().undo.length)]);
const ub = await box('[data-act="undo"]'); await tapAt(ub.cx, ub.cy); await idle();
ok('desfazer com o dedo devolve o original', (await hash()) === e0);
/* regressão: deslizar o painel a começar EM CIMA de um cursor não altera o valor nem o histórico */
{
  const q = await box('[data-p="shadows"]'); const u1 = await p.evaluate(() => PhDesk._cur().undo.length); const hb = await hash();
  await drag(q.x + q.w * 0.8, q.cy, q.x + q.w * 0.8, q.cy - 150, 10); await idle();
  const r = await p.evaluate(() => [+document.querySelector('[data-p="shadows"]').value, PhDesk._cur().undo.length, document.querySelector('.dk-sec.dk-tab-on').scrollTop]);
  ok('deslizar a partir de cima de um cursor: faz scroll, o valor e o histórico ficam', r[0] === 0 && r[1] === u1 && r[2] > 0 && (await hash()) === hb, { valor: r[0], historico: [u1, r[1]], scroll: r[2] });
  await p.evaluate(() => { document.querySelector('.dk-sec.dk-tab-on').scrollTop = 0; });
}
/* curva */
await tabTo('curva'); await sleep(300);
const pt = await p.evaluate(() => { const q = document.querySelectorAll('.dk-curve-pt')[2].getBoundingClientRect(); return { cx: q.left + q.width / 2, cy: q.top + q.height / 2 }; });
await drag(pt.cx, pt.cy, pt.cx, pt.cy - 40, 8); await idle();
const cy = await p.evaluate(() => PhDesk._cur().p.curveY[2]);
ok('o ponto da curva arrasta-se com o dedo', cy > 0.6 && (await hash()) !== e0, { y: Math.round(cy * 100) / 100 });
/* exportar com o dedo */
const eb = await box('[data-act="export"]');
const exp = p.evaluate(() => new Promise(res => { const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { HTMLAnchorElement.prototype.click = orig; res(this.download); } else orig.call(this); }; setTimeout(() => res(null), 20000); }));
ok('o botão Exportar está dentro do ecrã', eb.x >= 0 && eb.x + eb.w <= W + 0.5 && eb.w >= 30, { x: Math.round(eb.x), w: Math.round(eb.w), ecra: W });
await tapAt(eb.cx, eb.cy);
ok('tocar em Exportar gera o ficheiro', !!(await exp), await exp);
ok('sem erros de JavaScript', errs.length === 0, errs.slice(0, 3));
console.log(fail ? `\n${fail} FALHAS` : '\ntudo certo');
await b.close();
