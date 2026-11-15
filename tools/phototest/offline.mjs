/* node tools/phototest/offline.mjs — atualização do SW (publicado → atual), instalabilidade, bancada e estúdio offline */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const B = 'http://127.0.0.1:8321', SW = 'photography/sw.js';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const ok = (n, c, g) => { if (!c) fail++; console.log((c ? '  ok  ' : ' FALHA ') + n + (g !== undefined ? '  → ' + (typeof g === 'string' ? g : JSON.stringify(g)) : '')); };
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 800 });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
const cachesInfo = () => p.evaluate(async () => { const o = {}; for (const k of await caches.keys()) o[k] = (await (await caches.open(k)).keys()).length; return { ctrl: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.split('/').slice(-2).join('/'), caches: o }; });
const idle = async () => { await sleep(300); await p.waitForFunction(() => { const c = typeof PhDesk !== 'undefined' && PhDesk._cur(); return c && c.sizes && !c.busy && !c.next && c.root.dataset.ready === '1'; }, { timeout: 30000 }); await sleep(150); };
const hash = () => p.evaluate(() => { const c = document.querySelector('.dk-cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
const set = (sel, v) => p.evaluate(([sel, v]) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

/* Offline A SÉRIO. page.setOfflineMode só corta a rede da página: os pedidos feitos
   pelo service worker continuavam a sair (e o teste offline passava por engano).
   Aqui corta-se também a rede de cada service worker, e uma sonda confirma-o. */
const swSessions = new Map();
async function offline(on) {
  await p.setOfflineMode(on);
  for (const t of b.targets().filter(t => t.type() === 'service_worker')) {
    let s = swSessions.get(t); if (!s) { s = await t.createCDPSession(); await s.send('Network.enable'); swSessions.set(t, s); }
    await s.send('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  const probe = [];
  for (const [t, s] of swSessions) {
    try { const r = await s.send('Runtime.evaluate', { expression: "fetch('/photography/icon.svg?sonda=' + Date.now(), { cache: 'no-store' }).then(() => 'rede', () => 'sem rede')", awaitPromise: true }); probe.push(t.url().split('/').slice(-2).join('/') + ': ' + r.result.value); } catch (_) {}
  }
  const page = await p.evaluate(() => fetch('https://esm.sh/three@0.160.0?sonda=' + Date.now(), { cache: 'no-store' }).then(() => 'rede', () => 'sem rede')).catch(() => 'sem rede');
  return { sw: probe, pagina: page };
}

/* 1. quem já tem a versão publicada (HEAD) recebe a nova */
const cur = fs.readFileSync(SW, 'utf8'), old = execSync('git show HEAD:' + SW, { encoding: 'utf8' });
const vOld = old.match(/const CACHE = '([^']+)'/)[1], vNew = cur.match(/const CACHE = '([^']+)'/)[1];
console.log(`── atualização do service worker (${vOld} → ${vNew}) ──`);
try {
  fs.writeFileSync(SW, old);
  await p.goto(B + '/photography/', { waitUntil: 'networkidle2' }); await p.evaluate(() => navigator.serviceWorker.ready); await sleep(5000);
  await p.reload({ waitUntil: 'networkidle2' }); await sleep(1000);
  const a = await cachesInfo(); ok('versão publicada instalada', !!a.caches[vOld] && a.ctrl === 'photography/sw.js', a);
} finally { fs.writeFileSync(SW, cur); }
await p.reload({ waitUntil: 'networkidle2' }); await sleep(7000);          // o browser vê o sw.js novo, instala e ativa
await p.reload({ waitUntil: 'networkidle2' }); await sleep(1500);
const u = await cachesInfo();
ok('a versão nova substitui a antiga sem intervenção', vOld === vNew || (!!u.caches[vNew] && !u.caches[vOld] && u.ctrl === 'photography/sw.js'), u);
const fresh = await p.evaluate(async () => { const r = await fetch('/photography/css/ph-desk.css'); const t = await r.text(); return t.includes('barra em ecrãs estreitos'); });
ok('a página recebe o código novo (CSS da barra estreita)', fresh);

/* 2. instalável */
console.log('── instalação ──');
const cdp = await p.createCDPSession();
const inst = await cdp.send('Page.getInstallabilityErrors'); const man = await cdp.send('Page.getAppManifest');
ok('sem erros de instalabilidade (Chrome)', inst.installabilityErrors.length === 0 && man.errors.length === 0, { erros: inst.installabilityErrors.map(e => e.errorId), manifesto: man.errors.map(e => e.message) });
const icons = await p.evaluate(async () => {
  const m = await (await fetch('/photography/manifest.webmanifest')).json(); const out = [];
  for (const i of m.icons) { const r = await fetch(i.src); const bl = await r.blob(); let dim = ''; if (i.type !== 'image/svg+xml') { const bm = await createImageBitmap(bl); dim = bm.width + 'x' + bm.height; } out.push([i.src.split('/').pop(), r.status, i.sizes, dim, i.purpose]); }
  return { icons: out, start: m.start_url, scope: m.scope, display: m.display, shortcuts: m.shortcuts.map(s => s.url) };
});
ok('ícones do manifesto existem e têm o tamanho declarado', icons.icons.every(i => i[1] === 200 && (!i[3] || i[3] === i[2])), icons.icons);

/* 3. estúdio 3D: nunca aberto + sem rede → mensagem; aberto uma vez → fica offline */
console.log('── estúdio 3D offline ──');
const off = await offline(true);
ok('controlo: a rede está mesmo cortada, na página e no service worker', off.sw.length > 0 && off.sw.every(x => /sem rede/.test(x)) && off.pagina === 'sem rede', off);
await p.goto('about:blank'); await p.goto(B + '/photography/#estudio', { waitUntil: 'load' }).catch(() => {}); await sleep(6000);
const s0 = await p.evaluate(() => ({ canvas: !!document.querySelector('.ph-studio-host canvas'), msg: (document.querySelector('.ph-studio-host .empty-state') || {}).innerText || '' }));
ok('nunca aberto e sem rede: mensagem clara, com botão para tentar de novo', !s0.canvas && /primeira vez/.test(s0.msg) && /Tentar de novo/.test(s0.msg), s0.msg.replace(/\s+/g, ' ').slice(0, 170));
await offline(false);
await p.evaluate(() => { const b = document.querySelector('.ph-studio-host .empty-state button'); b && b.click(); });
await p.waitForFunction(() => document.querySelector('.ph-studio-host canvas'), { timeout: 60000 }).catch(() => {}); await sleep(9000);
const s1 = await p.evaluate(async () => ({ canvas: !!document.querySelector('.ph-studio-host canvas'), libs: (await caches.keys()).includes('foto-libs-v1') ? (await (await caches.open('foto-libs-v1')).keys()).map(r => r.url.replace('https://esm.sh', '')) : [] }));
ok('"Tentar de novo" com rede: o estúdio abre e o three.js fica em cache', s1.canvas && s1.libs.length >= 7, { ficheiros: s1.libs.length, ex: s1.libs.slice(0, 3) });
/* visitar um género com rede, para as imagens dele ficarem em cache */
await p.goto(B + '/photography/#g/retrato', { waitUntil: 'networkidle2' }); await sleep(2500);
await offline(true);
/* as rotas do site sem rede */
for (const h of ['', 'g/retrato', 'consulta', 'aprender', 'aprender/composicao', 'edicao', 'edicao/exposicao', 'laboratorio', 'laboratorio/dof', 'laboratorio/gh']) {
  await p.goto('about:blank'); let navErr = '';
  try { await p.goto(B + '/photography/' + (h ? '#' + h : ''), { waitUntil: 'load', timeout: 20000 }); } catch (e) { navErr = e.message.slice(0, 60); }
  await sleep(1800);
  const r = await p.evaluate(() => { const v = document.querySelector('.ph-panel.active'); return { len: (v ? v.innerText : document.body.innerText).trim().length, serif: document.fonts.check('1rem "Instrument Serif"'), css: getComputedStyle(document.body).backgroundColor,
    brk: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.offsetParent && i.getAttribute('src')).length, imgs: [...document.images].filter(i => i.offsetParent).length }; }).catch(e => ({ err: e.message.slice(0, 80) }));
  ok('offline #' + (h || '(home)'), !navErr && r.len > 150 && r.serif, navErr || r);
}
await p.goto('about:blank'); await p.goto(B + '/photography/#estudio', { waitUntil: 'load' }).catch(() => {});
await p.waitForFunction(() => document.querySelector('.ph-studio-host canvas'), { timeout: 40000 }).catch(() => {}); await sleep(6000);
const s2 = await p.evaluate(() => { const c = document.querySelector('.ph-studio-host canvas'); return { canvas: !!c, w: c ? c.width : 0, vazio: !!document.querySelector('.ph-studio-host .empty-state') }; });
ok('depois de aberto uma vez, o estúdio abre sem rede', s2.canvas && s2.w > 100 && !s2.vazio, s2);
await p.evaluate(() => { const b = document.querySelector('.ph-sm[data-sm="ext"]'); b && b.click(); }); await sleep(9000);
const s3 = await p.evaluate(() => ({ canvas: !!document.querySelector('.ph-studio-host canvas'), vazio: !!document.querySelector('.ph-studio-host .empty-state') }));
ok('"Na rua" sem rede (mesmo motor, cidade procedural)', s3.canvas && !s3.vazio, s3);

/* 4. a bancada sem rede */
console.log('── bancada offline ──');
await p.goto('about:blank'); await p.goto(B + '/photography/#edicao/mesa/own-18', { waitUntil: 'load' }).catch(() => {}); await idle().catch(() => {});
const h0 = await hash(); await set('[data-p="exposure"]', 0.8); await idle(); const h1 = await hash();
ok('mesa de revelação offline: abre, o worker carrega da cache e os ajustes aplicam-se', h0 !== h1);
const exp = await p.evaluate(() => new Promise(res => {
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) { HTMLAnchorElement.prototype.click = orig; fetch(this.href).then(r => r.blob()).then(bl => createImageBitmap(bl)).then(bm => res(bm.width + 'x' + bm.height)); } else orig.call(this); };
  document.querySelector('[data-act="export"]').click(); setTimeout(() => res(null), 20000);
}));
ok('exporta offline', !!exp, exp);
/* fotografia que nunca foi vista: aviso, e a mesa continua a funcionar */
const un = await p.evaluate(async () => {
  const c = await caches.open((await caches.keys()).find(k => /^foto-v/.test(k))); const have = new Set((await c.keys()).map(r => new URL(r.url).pathname));
  const b = [...document.querySelectorAll('.dk-scene')].find(b => !have.has('/assets/photo/own/' + b.dataset.id + '.webp') && !b.dataset.id.startsWith('lab-')); return b ? b.dataset.id : null;
});
if (un) {
  await p.evaluate(id => document.querySelector(`.dk-scene[data-id="${id}"]`).click(), un); await sleep(3000);
  const m = await p.evaluate(() => ({ ready: document.querySelector('.dk').dataset.ready, msg: document.querySelector('.dk-loading').textContent, vis: getComputedStyle(document.querySelector('.dk-loading')).display !== 'none' }));
  ok(`fotografia nunca vista (${un}) sem rede: diz que não a conseguiu carregar`, m.ready === '0' && /Não foi possível/.test(m.msg) && m.vis, m);
  await p.evaluate(() => document.querySelector('.dk-scene[data-id="own-18"]').click()); await idle().catch(() => {});
  const back = await p.evaluate(() => ({ ready: document.querySelector('.dk').dataset.ready, t: document.querySelector('.dk-title-s').textContent }));
  await set('[data-p="contrast"]', 40); await idle();
  ok('voltar a uma fotografia em cache: a mesa recupera', back.ready === '1' && (await hash()) !== h1, back);
} else console.log('     (todas as fotografias já estavam em cache)');
await p.goto('about:blank'); await p.goto(B + '/photography/#laboratorio/camara/own-18', { waitUntil: 'load' }).catch(() => {}); await idle().catch(() => {});
const c0 = await hash(); await set('.dk-dial[data-k="t"] input', 30); await idle();
ok('câmara escura offline: abre e simula', c0 !== (await hash()));
await offline(false);
ok('sem erros de JavaScript em todo o percurso', errs.length === 0, errs.slice(0, 4));
console.log(fail ? `\n${fail} FALHAS` : '\ntudo certo');
await b.close();
