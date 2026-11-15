/* node tools/phototest/suite.mjs <chromium|firefox|webkit> [largura] [secções,separadas,por,vírgula]
   Auditoria multi-motor da Fotografia: rotas, mesa de revelação, ficheiros, câmara escura,
   corridas, falha do worker, estúdio 3D. Usa Playwright (Chrome do sistema, Firefox e WebKit). */
import { chromium, firefox, webkit } from 'playwright';
import os from 'node:os';
const TMP = (process.env.PHOTOTEST_TMP || os.tmpdir() + '/dcop7-phototest').replace(/\\/g, '/');
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const sharp = createRequire(new URL('../photogen/', import.meta.url))('sharp');
const [ENG = 'chromium', WARG = '1440', ONLY = ''] = process.argv.slice(2);
const W = +WARG, MOBILE = W < 600, B = (process.env.XB_BASE || 'http://127.0.0.1:8321') + '/photography/';
const SCR = TMP;
const FILES = SCR + '/audit-files', DL = SCR + '/audit-dl'; fs.mkdirSync(DL, { recursive: true });
const want = s => !ONLY || ONLY.split(',').includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await ({ chromium, firefox, webkit })[ENG].launch(ENG === 'chromium' ? { channel: 'chrome' } : {});
const ctxOpt = { viewport: { width: W, height: MOBILE ? 844 : 900 }, acceptDownloads: true, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'pt-PT' };
if (MOBILE) { ctxOpt.hasTouch = true; if (ENG !== 'firefox') ctxOpt.isMobile = true; ctxOpt.deviceScaleFactor = 2; }
const ctx = await browser.newContext(ctxOpt);
let page = await ctx.newPage();
let errs = [], fail = 0, total = 0;
const hook = p => {
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 200)); });
  p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().slice(-80)); });
  p.on('requestfailed', r => { const f = r.failure(); if (f && !/abort|cancel/i.test(f.errorText) && !p.__expectFail) errs.push('REQFAIL ' + r.url().slice(-70) + ' ' + f.errorText); });
};
hook(page);
const ok = (name, cond, got) => {
  total++; if (!cond) fail++;
  console.log((cond ? '  ok  ' : ' FALHA ') + name + (got !== undefined ? '  → ' + (typeof got === 'string' ? got : JSON.stringify(got)) : ''));
  if (errs.length) { console.log('        ERROS ' + [...new Set(errs)].slice(0, 6).join(' | ')); fail++; errs = []; }
};
const go = async (h, wait = 1500) => {
  await page.goto('about:blank');
  await page.goto(B + (h ? '#' + h : ''), { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await sleep(wait);
};
/* a mesa está pronta e parada (sem render pendente) */
const idle = async (max = 60000) => {
  const t0 = Date.now(); await sleep(280);
  let calm = 0;
  while (Date.now() - t0 < max) {
    const s = await page.evaluate(() => { const c = typeof PhDesk !== 'undefined' && PhDesk._cur(); return c ? { busy: c.busy, next: !!c.next, ready: c.root.dataset.ready, sizes: !!c.sizes } : null; });
    if (s && !s.busy && !s.next && s.ready === '1' && s.sizes) { if (++calm >= 2) return Date.now() - t0; } else calm = 0;
    await sleep(90);
  }
  return -1;
};
const cv = () => page.evaluate(() => {
  const c = document.querySelector('.dk-cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261, lum = 0, n = 0, bad = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] !== 255) bad++; if (i % 64 === 0) { h = Math.imul(h ^ d[i], 16777619); h = Math.imul(h ^ d[i + 1], 16777619); h = Math.imul(h ^ d[i + 2], 16777619); lum += d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722; n++; } }
  /* canto superior esquerdo (5% do lado menor para dentro) */
  const q = Math.round(Math.min(c.width, c.height) * 0.05), k = (q * c.width + q) * 4;
  return { w: c.width, h: c.height, hash: h >>> 0, lum: Math.round(lum / n * 10) / 10, alphaBad: bad, tl: [d[k], d[k + 1], d[k + 2]] };
});
const setRange = (sel, v, change = true) => page.evaluate(([sel, v, change]) => {
  const i = document.querySelector(sel); if (!i) return false;
  i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); if (change) i.dispatchEvent(new Event('change', { bubbles: true })); return true;
}, [sel, v, change]);
const click = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; e.click(); return true; }, sel);
const toastTxt = () => page.evaluate(() => { const t = document.querySelector('#dp-toast'); return t && !t.hidden ? t.textContent : ''; });
/* batimento da thread principal: maior intervalo entre ticks de 16 ms */
const beatStart = () => page.evaluate(() => { window.__gap = 0; let last = performance.now(); clearInterval(window.__beat); window.__beat = setInterval(() => { const n = performance.now(); if (n - last > window.__gap) window.__gap = n - last; last = n; }, 16); });
const beatMax = () => page.evaluate(() => Math.round(window.__gap));
const exportDL = async name => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), click('[data-act="export"]')]);
  const f = path.join(DL, `${ENG}-${W}-${name}.jpg`); await dl.saveAs(f);
  const m = await sharp(f).metadata();
  return { file: f, name: dl.suggestedFilename(), w: m.width, h: m.height, fmt: m.format, exif: !!m.exif, kb: Math.round(fs.statSync(f).size / 1024) };
};

const fidelity = async (label, params, tol) => {
  await click('.dk-secs [data-act="reset"]'); await idle();
  for (const [s, v] of params) await setRange(s, v);
  await idle();
  const prev = await page.evaluate(() => { const c = document.querySelector('.dk-cv'); return { w: c.width, h: c.height, url: c.toDataURL('image/png') }; });
  const ex = await exportDL('fid-' + label);
  const a = await sharp(Buffer.from(prev.url.split(',')[1], 'base64')).removeAlpha().resize(320, null).raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(ex.file).resize(a.info.width, a.info.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  let d = 0; for (let i = 0; i < a.data.length; i++) d += Math.abs(a.data[i] - b[i]);
  /* e o detalhe: energia de alta frequência à escala 1:1 do ecrã */
  const hf = async buf => { const g = await sharp(buf).greyscale().resize(prev.w, prev.h, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer(); let s = 0, n = 0; for (let y = 1; y < prev.h - 1; y += 2) for (let x = 1; x < prev.w - 1; x += 2) { const i = y * prev.w + x; s += Math.abs(4 * g[i] - g[i - 1] - g[i + 1] - g[i - prev.w] - g[i + prev.w]); n++; } return s / n; };
  const hp = await hf(Buffer.from(prev.url.split(',')[1], 'base64')), he = await hf(fs.readFileSync(ex.file));
  const mean = Math.round(d / a.data.length * 100) / 100;
  /* critério: o detalhe fino chega ao ficheiro com força parecida à do ecrã — abaixo de 0,6 é o
     defeito antigo (efeito a metade). A diferença média píxel a píxel só serve de rede: com o raio
     arredondado a píxeis inteiros os halos da nitidez nunca coincidem ao píxel (≈7 em 255 com tudo
     no máximo a 960 px), e o grão é aleatório, por isso aí nem conta. */
  const ratio = he / hp;
  ok(`exportação = ecrã (${label})`, ratio > 0.6 && ratio < 1.4 && (/grao/.test(label) || mean < Math.max(tol, 9)), { difMedia: mean, detalheEcra: Math.round(hp * 10) / 10, detalheExport: Math.round(he * 10) / 10, razao: Math.round(he / hp * 100) / 100 });
};

console.log(`\n════ ${ENG} ${browser.version()} · ${W}px${MOBILE ? ' (toque)' : ''} ════`);

/* ── 1. rotas ─────────────────────────────────────────────────────── */
if (want('smoke')) {
  console.log('── rotas ──');
  const routes = ['', 'g/retrato', 'g/paisagem', 'consulta', 'aprender', 'aprender/composicao', 'aprender/estilos/noir', 'aprender/equipamento', 'edicao', 'edicao/exposicao', 'edicao/curve',
    'edicao/mesa', 'laboratorio', 'laboratorio/camara', 'laboratorio/exposure', 'laboratorio/dof', 'laboratorio/focal', 'laboratorio/hf', 'laboratorio/nd', 'laboratorio/flash', 'laboratorio/le', 'laboratorio/gh'];
  for (const r of routes) {
    await go(r, r.includes('mesa') || r.includes('camara') ? 2500 : 900);
    const s = await page.evaluate(() => {
      const v = document.querySelector('#view-photography'), p = v && v.querySelector('.ph-panel.active');
      const imgs = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && i.offsetParent);
      return { title: document.title, len: (p ? p.innerText : document.body.innerText).trim().length, broken: imgs.map(i => i.getAttribute('src').slice(-40)), over: document.documentElement.scrollWidth > innerWidth + 1,
        serif: document.fonts.check('16px "Instrument Serif"'), mono: document.fonts.check('12px "IBM Plex Mono"') };
    });
    ok('#' + (r || '(home)'), s.len > 150 && !s.broken.length && !s.over && s.serif && s.mono, s.broken.length || s.over || !s.serif ? s : s.title);
  }
  /* histórico: para trás e para a frente */
  await go('laboratorio', 800);
  await click('a[href="#laboratorio/camara"], a[href^="#laboratorio/camara"]'); await sleep(1500); await idle();
  const h1 = await page.evaluate(() => location.hash);
  await page.evaluate(() => { const b = [...document.querySelectorAll('.dk-scene')][3]; b && b.click(); }); await idle();
  const h2 = await page.evaluate(() => location.hash);
  await page.goBack(); await sleep(900);
  const h3 = await page.evaluate(() => [location.hash, document.body.classList.contains('dk-on'), document.title]);
  await page.goForward(); await sleep(1200); await idle();
  const h4 = await page.evaluate(() => [location.hash, document.body.classList.contains('dk-on'), document.querySelector('.dk-title-s').textContent, document.title]);
  ok('histórico: hub → câmara → trocar cena → atrás → à frente', h3[0] === '#laboratorio' && !h3[1] && h4[0] === h2 && h4[1], { h1, h2, back: h3, fwd: h4 });
}

/* ── 2. mesa de revelação: fluxo completo ─────────────────────────── */
if (want('dev')) {
  console.log('── mesa de revelação ──');
  await go('edicao/mesa/own-18', 1500);
  await page.evaluate(() => { try { localStorage.removeItem('ph-dev-edit'); } catch (_) {} });
  await go('edicao/mesa/own-18', 1500);
  const tIdle = await idle();
  const o = await cv();
  ok('abre e fica pronta', tIdle >= 0 && o.lum > 10 && o.alphaBad === 0, { ms: tIdle, w: o.w, h: o.h });
  /* 6 gestos → 6 entradas; desfazer tudo = original exato; refazer tudo = final exato */
  const steps = [['[data-p="exposure"]', 0.6], ['[data-p="contrast"]', 35], ['[data-p="temp"]', 40], ['[data-p="shadows"]', 50], ['[data-p="clarity"]', 45], ['[data-p="vignette"]', -40]];
  const hashes = [o.hash];
  for (const [s, v] of steps) { await setRange(s, v); await idle(); hashes.push((await cv()).hash); }
  ok('cada ajuste muda a imagem', new Set(hashes).size === hashes.length, hashes.length);
  const back = [];
  for (let i = 0; i < steps.length; i++) { await click('[data-act="undo"]'); await idle(); back.push((await cv()).hash); }
  ok('desfazer passo a passo devolve cada estado exato', back.every((h, i) => h === hashes[hashes.length - 2 - i]), back.map((h, i) => h === hashes[hashes.length - 2 - i]));
  ok('desfazer fica inativo no início', await page.evaluate(() => document.querySelector('[data-act="undo"]').disabled && !document.querySelector('[data-act="redo"]').disabled));
  for (let i = 0; i < steps.length; i++) { await click('[data-act="redo"]'); await idle(); }
  ok('refazer tudo devolve o estado final exato', (await cv()).hash === hashes[hashes.length - 1]);
  /* teclado */
  await page.locator('.dk-view').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+z'); await idle();
  ok('Ctrl+Z desfaz', (await cv()).hash === hashes[hashes.length - 2]);
  await page.keyboard.press('Control+Shift+z'); await idle();
  ok('Ctrl+Shift+Z refaz', (await cv()).hash === hashes[hashes.length - 1]);
  /* comparação */
  for (const m of ['wipe', 'side', 'result']) {
    await click(`.dk-cmp [data-cmp="${m}"]`); await sleep(350);
    const s = await page.evaluate(() => {
      const r = document.querySelector('.dk'), vis = e => { const b = e.getBoundingClientRect(), s = getComputedStyle(e); return b.width > 2 && b.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0; };
      const view = document.querySelector('.dk-view').getBoundingClientRect(), fr = document.querySelector('.dk-frame-r').getBoundingClientRect(), fo = document.querySelector('.dk-frame-o').getBoundingClientRect();
      const inside = b => b.left >= view.left - 1 && b.right <= view.right + 1 && b.top >= view.top - 1 && b.bottom <= view.bottom + 1;
      return { cmp: r.dataset.cmp, wipe: vis(document.querySelector('.dk-wipe')), orig: vis(document.querySelector('.dk-orig')), side: vis(document.querySelector('.dk-frame-o')), rIn: inside(fr), oIn: !vis(document.querySelector('.dk-frame-o')) || inside(fo),
        ar: Math.round(fr.width / fr.height * 100) / 100, sideLoaded: document.querySelector('.dk-side-img').naturalWidth > 0 };
    });
    ok('comparação: ' + m, s.cmp === m && s.rIn && s.oIn && (m === 'wipe' ? s.wipe && s.orig : m === 'side' ? s.side && s.sideLoaded : !s.wipe && !s.side), s);
  }
  /* segurar para ver o original */
  await page.keyboard.down('o'); await sleep(200);
  const held = await page.evaluate(() => [document.querySelector('.dk').dataset.hold, getComputedStyle(document.querySelector('.dk-orig')).opacity]);
  await page.keyboard.up('o'); await sleep(200);
  ok('segurar "O" mostra o original e larga', held[0] === '1' && held[1] === '1' && await page.evaluate(() => !document.querySelector('.dk').dataset.hold), held);
  /* persistência */
  const before = (await cv()).hash;
  await page.reload({ waitUntil: 'load' }); await sleep(1500); await idle();
  ok('a edição volta depois de recarregar', (await cv()).hash === before);
  /* exportação: ficheiro real */
  const e1 = await exportDL('own-18-edit');
  ok('exporta JPEG à resolução da fotografia, sem metadados', e1.fmt === 'jpeg' && Math.max(e1.w, e1.h) === 1600 && !e1.exif && /-revelada\.jpg$/.test(e1.name), e1);
  ok('aviso de exportação e botão livre', /Exportada/.test(await toastTxt()) && await page.evaluate(() => !document.querySelector('[data-act="export"]').classList.contains('is-busy')), await toastTxt());
  /* fidelidade: a exportação reduzida ao tamanho do ecrã deve ser a mesma imagem */
  await fidelity('tons', [['[data-p="exposure"]', 0.5], ['[data-p="contrast"]', 40], ['[data-p="saturation"]', 30], ['[data-p="temp"]', -30], ['[data-p="vignette"]', -60]], 2.5);
  await fidelity('detalhe', [['[data-p="sharpen"]', 100], ['[data-p="texture"]', 80], ['[data-p="clarity"]', 60]], 4);
  await fidelity('grao', [['[data-p="grain"]', 70], ['[data-p="denoise"]', 80]], 4);
  await click('.dk-secs [data-act="reset"]'); await idle();
  /* estilos */
  const looks = await page.evaluate(() => [...document.querySelectorAll('.dk-look')].map(b => b.dataset.look));
  let lookFail = [];
  const base = (await cv()).hash;
  for (const id of looks.filter(Boolean)) { await click(`.dk-look[data-look="${id}"]`); await idle(); const c = await cv(); if (c.hash === base || c.alphaBad) lookFail.push(id); }
  ok(`os ${looks.length - 1} estilos aplicam-se e mudam a imagem`, !lookFail.length, lookFail);
  await click('.dk-look[data-look=""]'); await idle();
  ok('"Sem estilo" devolve o original', (await cv()).hash === o.hash);
}

/* ── 2b. fidelidade da exportação com um ficheiro grande ───────────── */
if (want('fid')) {
  console.log('── exportação = ecrã, ficheiro de 2400 px ──');
  await go('edicao/mesa/own-18', 1500); await idle();
  await page.setInputFiles('.dk-file', path.join(FILES, 'exif-land.jpg')); await sleep(2500); await idle();
  const pv = await cv();
  console.log('     ecrã ' + pv.w + '×' + pv.h + ' → exportação 2400×1600 (×' + (2400 / pv.w).toFixed(2) + ')');
  await fidelity('f-tons', [['[data-p="exposure"]', 0.5], ['[data-p="contrast"]', 40], ['[data-p="vignette"]', -60]], 2.5);
  await fidelity('f-nitidez', [['[data-p="sharpen"]', 100]], 4);
  await fidelity('f-textura', [['[data-p="texture"]', 80]], 4);
  await fidelity('f-grao', [['[data-p="grain"]', 70]], 4);
  await fidelity('f-ruido', [['[data-p="denoise"]', 100]], 4);
}

/* ── 3. ficheiros do utilizador ───────────────────────────────────── */
if (want('files')) {
  console.log('── abrir ficheiros (mesa de revelação) ──');
  await go('edicao/mesa/own-18', 1500); await idle();
  const cases = [
    ['exif-rot6.jpg', { ar: 2 / 3, long: 2400, red: true }], ['exif-land.jpg', { ar: 3 / 2, long: 2400, red: true }], ['noexif.jpg', { ar: 4 / 3, long: 1600, red: true }],
    ['photo.webp', { ar: 1600 / 1067, long: 1600, red: true }], ['alpha.png', { ar: 1.5, long: 1200, white: true }], ['tiny.jpg', { ar: 16 / 12, long: 16 }],
    ['pano.jpg', { ar: 12000 / 1800, long: 2400, red: true }], ['tall.jpg', { ar: 1500 / 7000, long: 2400, red: true }], ['big-48mp.jpg', { ar: 4 / 3, long: 2400, red: true }],
    ['big-108mp.jpg', { ar: 4 / 3, long: 2400, red: true }], ['fake.jpg', { fail: true }], ['broken-exif.jpg', { fail: true }],
  ];
  for (const [f, exp] of cases) {
    const prevTitle = await page.evaluate(() => document.querySelector('.dk-title-s').textContent);
    await page.evaluate(() => { const t = document.querySelector('#dp-toast'); if (t) t.hidden = true; });
    await beatStart();
    const t0 = Date.now();
    await page.setInputFiles('.dk-file', path.join(FILES, f));
    const name = f.replace(/\.[^.]+$/, '');
    let res = null;
    while (Date.now() - t0 < 90000) {
      const s = await page.evaluate(() => ({ t: document.querySelector('.dk-title-s').textContent, r: document.querySelector('.dk').dataset.ready, toast: (() => { const t = document.querySelector('#dp-toast'); return t && !t.hidden ? t.textContent : ''; })() }));
      if (s.t === name && s.r === '1') { res = 'aberta'; break; }
      if (s.toast) { res = 'aviso: ' + s.toast; break; }
      await sleep(120);
    }
    const ms = Date.now() - t0;
    if (exp.fail) {
      const st = await page.evaluate(() => ({ t: document.querySelector('.dk-title-s').textContent, r: document.querySelector('.dk').dataset.ready }));
      ok(`${f}: recusada com aviso, mesa intacta`, res && res.startsWith('aviso') && st.t === prevTitle && st.r === '1', res || 'sem resposta em 90 s');
      continue;
    }
    if (res !== 'aberta') { ok(`${f}: abre`, false, res || 'sem resposta em 90 s'); continue; }
    await idle();
    const c = await cv(), gap = await beatMax();
    const ar = c.w / c.h, red = c.tl[0] > 180 && c.tl[1] < 90 && c.tl[2] < 90;
    const tr = await page.evaluate(() => { const c = document.querySelector('.dk-cv'), d = c.getContext('2d').getImageData(c.width - 6, 6, 1, 1).data; return [...d]; });
    ok(`${f}: abre com a orientação certa`, Math.abs(ar - exp.ar) / exp.ar < 0.02 && (!exp.red || red) && c.alphaBad === 0 && (!exp.white || (tr[0] > 250 && tr[3] === 255)), { canvas: c.w + '×' + c.h, cantoVermelho: red, ms, maiorPausa: gap });
    /* ajustar + exportar */
    await setRange('[data-p="exposure"]', 0.4); await idle(); const c2 = await cv();
    await beatStart();
    const t1 = Date.now(); const e = await exportDL('file-' + name); const ems = Date.now() - t1;
    const ex = await sharp(e.file).raw().toBuffer({ resolveWithObject: true });
    const q = Math.round(Math.min(e.w, e.h) * 0.05), k = (q * e.w + q) * ex.info.channels;
    const ered = ex.data[k] > 180 && ex.data[k + 1] < 110 && ex.data[k + 2] < 110;
    ok(`${f}: ajusta e exporta`, c2.hash !== c.hash && Math.max(e.w, e.h) === exp.long && Math.abs(e.w / e.h - exp.ar) / exp.ar < 0.02 && (!exp.red || ered) && !e.exif,
      { export: e.w + '×' + e.h, kb: e.kb, cantoVermelho: ered, ms: ems, maiorPausa: await beatMax() });
    await click('[data-act="undo"]'); await idle();
  }
  /* estado final coerente */
  const fin = await page.evaluate(() => { const c = PhDesk._cur(); return { busy: c.busy, exporting: !!c.exporting, ready: c.root.dataset.ready }; });
  ok('no fim a mesa não ficou presa', !fin.busy && !fin.exporting && fin.ready === '1', fin);

  console.log('── abrir ficheiros (câmara escura) ──');
  await go('laboratorio/camara/own-18', 1500); await idle();
  for (const [f, good] of [['exif-land.jpg', true], ['exif-rot6.jpg', true], ['noexif.jpg', false], ['alpha.png', false]]) {
    await page.evaluate(() => { const t = document.querySelector('#dp-toast'); if (t) t.hidden = true; });
    await page.setInputFiles('.dk-file', path.join(FILES, f)); await sleep(2500); await idle();
    const s = await page.evaluate(() => ({ t: document.querySelector('.dk-title-s').textContent, hud: document.querySelector('.dk-hud-read').innerText.replace(/\s+/g, ' '), cam: document.querySelector('.dk-hud-cam').textContent,
      reads: document.querySelector('.dk-reads').innerText, cap: document.querySelector('.dk-cap').innerText, toast: (() => { const t = document.querySelector('#dp-toast'); return t && !t.hidden ? t.textContent : ''; })() }));
    if (good) ok(`${f}: lê o EXIF e simula`, s.t === f.replace(/\.[^.]+$/, '') && /f\/2[.,]8/.test(s.hud) && /1\/250/.test(s.hud) && /ISO 200/.test(s.hud) && !/NaN|undefined|Infinity/.test(s.reads + s.hud), { hud: s.hud, cam: s.cam, legenda: s.cap.slice(0, 90) });
    else ok(`${f}: sem EXIF → aviso claro e a cena anterior fica`, /EXIF/.test(s.toast) && s.t !== f.replace(/\.[^.]+$/, ''), s.toast);
  }
  /* "Revelar esta fotografia" com um ficheiro do utilizador aberto */
  await page.setInputFiles('.dk-file', path.join(FILES, 'exif-land.jpg')); await sleep(2500); await idle();
  await click('[data-act="todev"]'); await sleep(2000); await idle();
  const td = await page.evaluate(() => ({ hash: location.hash, t: document.querySelector('.dk-title-s').textContent, mode: document.querySelector('.dk').dataset.mode }));
  ok('"Revelar esta fotografia" leva a fotografia aberta para a mesa', td.mode === 'dev' && td.t === 'exif-land', td);
}

/* ── 4. câmara escura: todas as cenas nos extremos ────────────────── */
if (want('sim')) {
  console.log('── câmara escura ──');
  await go('laboratorio/camara', 1500); await idle();
  const ids = await page.evaluate(() => [...document.querySelectorAll('.dk-scene')].map(b => b.dataset.id));
  const BAD = /NaN|undefined|Infinity|null|\[object|−−|--/;
  const read = () => page.evaluate(() => ({ reads: document.querySelector('.dk-reads').innerText, meter: document.querySelector('.dk-meter-t').textContent, hud: document.querySelector('.dk-hud-read').innerText.replace(/\s+/g, ' '),
    focus: document.querySelector('.dk-focus-v').textContent, n: document.querySelectorAll('.dk-read').length }));
  const dialMax = k => page.evaluate(k => +document.querySelector(`.dk-dial[data-k="${k}"] input`).max, k);
  const bad = []; let slow = 0, nStates = 0, worst = 0;
  for (const id of ids) {
    await click(`.dk-scene[data-id="${id}"]`); const t = await idle();
    if (t < 0) { bad.push(id + ': não ficou pronta'); continue; }
    const c0 = await cv();
    const r0 = await read();
    if (BAD.test(r0.reads + r0.meter + r0.hud + r0.focus) || !/mesma exposição/i.test(r0.meter)) bad.push(id + ': estado inicial ' + r0.meter);
    const mN = await dialMax('N'), mT = await dialMax('t'), mI = await dialMax('iso');
    const states = [['N', 0], ['N', mN], ['t', 0], ['t', mT], ['iso', 0], ['iso', mI]];
    for (const [k, v] of states) {
      await click('.dk-secs [data-act="reset"]');
      await setRange(`.dk-dial[data-k="${k}"] input`, v);
      const tm = await idle(); nStates++; if (tm > worst) worst = tm; if (tm > 2500) slow++;
      const r = await read(), c = await cv();
      if (BAD.test(r.reads + r.meter + r.hud + r.focus) || r.n < 4 || c.alphaBad || tm < 0) bad.push(`${id} ${k}=${v}: ${(r.reads + r.meter).match(BAD) || 'render'} `);
    }
    /* tudo ao mesmo tempo: o pior caso */
    await click('.dk-secs [data-act="reset"]');
    await setRange('.dk-dial[data-k="N"] input', mN, false); await setRange('.dk-dial[data-k="t"] input', mT, false); await setRange('.dk-dial[data-k="iso"] input', mI);
    await click('[data-seg="nd"] [data-v="15"]');
    const tm = await idle(); if (tm > worst) worst = tm;
    const r = await read(); if (BAD.test(r.reads + r.meter + r.hud) || tm < 0) bad.push(id + ' extremos juntos');
    /* modos A e S: a exposição mantém-se dentro de ⅓ de stop enquanto houver margem */
    await click('.dk-secs [data-act="reset"]'); await click('[data-seg="mode"] [data-v="A"]');
    await setRange('.dk-dial[data-k="N"] input', Math.round(mN / 2)); await idle();
    const ra = await read(), ca = await cv();
    const tAuto = await page.evaluate(() => document.querySelector('.dk-dial[data-k="t"] input').disabled);
    if (!tAuto || BAD.test(ra.reads + ra.meter)) bad.push(id + ' modo A');
    await click('[data-seg="mode"] [data-v="S"]'); await idle();
    const nAuto = await page.evaluate(() => document.querySelector('.dk-dial[data-k="N"] input').disabled);
    if (!nAuto) bad.push(id + ' modo S');
    await click('[data-seg="mode"] [data-v="M"]');
    await click('.dk-secs [data-act="reset"]'); await idle();
    const c1 = await cv();
    if (c1.hash !== c0.hash) bad.push(id + ': "Como foi tirada" não devolve o original exato');
  }
  ok(`${ids.length} cenas × extremos: sem NaN/undefined, sempre com leitura, repor = original`, !bad.length, bad.length ? bad.slice(0, 8) : { estados: nStates, piorEsperaMs: worst, acimaDe2500ms: slow });

  /* coerência nos píxeis, na cena de retrato */
  await click('.dk-scene[data-id="lab-retrato"]'); await idle();
  const lumAt = async (k, v) => { await click('.dk-secs [data-act="reset"]'); await setRange(`.dk-dial[data-k="${k}"] input`, v); await idle(); return (await cv()).lum; };
  const mT = await dialMax('t'), iT = await page.evaluate(() => +document.querySelector('.dk-dial[data-k="t"] input').value);
  await click('.dk-secs [data-act="reset"]'); await idle();
  const iT0 = await page.evaluate(() => +document.querySelector('.dk-dial[data-k="t"] input').value);
  const ls = []; for (const d of [-6, -3, 0, 3, 6]) ls.push(await lumAt('t', Math.max(0, Math.min(mT, iT0 + d))));
  ok('mais tempo = mais luz (monótono, ±2 stops)', ls.every((v, i) => i === 0 || v > ls[i - 1]), ls);
  /* detalhe do fundo: abrir a abertura desfoca, fechar não */
  const hfBg = () => page.evaluate(() => { const c = document.querySelector('.dk-cv'), w = c.width, h = c.height, d = c.getContext('2d').getImageData(Math.round(w * .62), Math.round(h * .12), Math.round(w * .34), Math.round(h * .5)), W = d.width, H = d.height, D = d.data; let s = 0, n = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4, g = j => D[j] * .3 + D[j + 1] * .59 + D[j + 2] * .11; s += Math.abs(4 * g(i) - g(i - 4) - g(i + 4) - g(i - W * 4) - g(i + W * 4)); n++; } return Math.round(s / n * 100) / 100; });
  await click('.dk-secs [data-act="reset"]'); await click('[data-seg="mode"] [data-v="A"]');
  const mN = await dialMax('N');
  /* entre f/11 e f/2,2 (fora da difração e do limite de 1/8000) */
  const hf = []; for (const v of [6, 10, 14, 18, 20]) { await setRange('.dk-dial[data-k="N"] input', v); await idle(); hf.push(await hfBg()); }
  ok('abrir a abertura tira detalhe ao fundo (monótono, f/11 → f/2,2)', hf.every((v, i) => i === 0 || v < hf[i - 1]) && hf[hf.length - 1] < hf[0] * 0.5, hf);
  await setRange('.dk-dial[data-k="N"] input', mN); await idle();
  const lim = await page.evaluate(() => [document.querySelector('.dk-hud-read').innerText.replace(/\s+/g, ' '), document.querySelector('.dk-meter-t').textContent]);
  ok('modo A no limite do obturador: o fotómetro avisa da sobre-exposição', /1\/8000/.test(lim[0]) && /mais clara/.test(lim[1]), lim);
  const la = []; for (const v of [8, 16]) { await setRange('.dk-dial[data-k="N"] input', v); await idle(); la.push((await cv()).lum); }
  ok('modo A: a luminância mantém-se ao mudar a abertura', Math.abs(la[0] - la[1]) < 6, la);
  await click('[data-seg="mode"] [data-v="M"]');
  /* tocar para focar */
  await click('.dk-secs [data-act="reset"]'); await idle();
  const box = await page.locator('.dk-frame-r').boundingBox();
  const f0 = await page.evaluate(() => document.querySelector('.dk-focus-v').textContent);
  if (MOBILE) await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height * 0.3); else await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.3);
  await idle();
  const f1 = await page.evaluate(() => [document.querySelector('.dk-focus-v').textContent, !document.querySelector('.dk-reticle').hidden]);
  ok((MOBILE ? 'toque' : 'clique') + ' na fotografia muda o plano de foco e mostra a mira', f1[0] !== f0 && f1[1], [f0, ...f1]);
  /* experiências */
  const tries = await page.evaluate(() => document.querySelectorAll('.dk-try .dk-chip').length);
  let tr = [];
  for (let i = 0; i < tries; i++) { await click(`.dk-try .dk-chip[data-i="${i}"]`); await idle(); tr.push(await page.evaluate(() => [document.querySelector('.dk-try .dk-chip[aria-pressed="true"]') ? 1 : 0, document.querySelector('.dk-try-why').hidden ? 0 : document.querySelector('.dk-try-why').textContent.length])); }
  ok(`as ${tries} experiências da cena aplicam-se e explicam-se`, tries > 0 && tr.every(t => t[0] && t[1] > 20), tr.length);
}

/* ── 5. corridas e estados inconsistentes ─────────────────────────── */
if (want('race')) {
  console.log('── corridas ──');
  await go('edicao/mesa/own-15', 1500);
  await page.evaluate(() => { try { localStorage.removeItem('ph-dev-edit'); } catch (_) {} });
  await go('edicao/mesa/own-15', 1500); await idle();
  await beatStart();
  /* 160 movimentos de cursor em 1,6 s, em três cursores */
  await page.evaluate(() => new Promise(res => {
    const S = ['[data-p="exposure"]', '[data-p="contrast"]', '[data-p="clarity"]'].map(s => document.querySelector(s)); let n = 0;
    const iv = setInterval(() => {
      const i = S[n % 3]; i.value = n % 3 === 0 ? (Math.sin(n / 9) * 2).toFixed(2) : Math.round(Math.sin(n / 7) * 80); i.dispatchEvent(new Event('input', { bubbles: true }));
      if (++n >= 160) { clearInterval(iv); S[0].value = 0.75; S[1].value = 30; S[2].value = 55; S.forEach(i => { i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); res(); }
    }, 10);
  }));
  const tS = await idle(); const a = await cv(), gap = await beatMax();
  await page.reload({ waitUntil: 'load' }); await sleep(1500); await idle();
  const b = await cv();
  ok('160 movimentos seguidos: a imagem final é a dos valores finais', tS >= 0 && a.hash === b.hash, { esperaMs: tS, maiorPausaMs: gap, igual: a.hash === b.hash });
  await click('.dk-secs [data-act="reset"]'); await idle();
  /* trocar de fotografia 8 vezes de seguida */
  const ids = await page.evaluate(() => [...document.querySelectorAll('.dk-scene')].map(b => b.dataset.id).slice(0, 9));
  await page.evaluate(ids => { ids.forEach((id, i) => setTimeout(() => document.querySelector(`.dk-scene[data-id="${id}"]`).click(), i * 25)); }, ids);
  await sleep(600); await idle();
  const last = ids[ids.length - 1];
  const s1 = await page.evaluate(() => ({ t: document.querySelector('.dk-title-s').textContent, hash: location.hash, pressed: document.querySelector('.dk-scene[aria-pressed="true"]').dataset.id }));
  const h1 = await cv();
  await go('edicao/mesa/' + last, 1500); await idle(); const h2 = await cv();
  ok('trocar de fotografia 9× seguidas: fica a última, com a imagem dela', s1.pressed === last && s1.hash.endsWith(last) && h1.hash === h2.hash && h1.w === h2.w, { ...s1, igual: h1.hash === h2.hash });
  /* sair a meio de um render e voltar */
  await setRange('[data-p="clarity"]', 80, false); await page.evaluate(() => { location.hash = '#aprender'; }); await sleep(700);
  const out = await page.evaluate(() => [document.body.classList.contains('dk-on'), document.querySelector('.ph-panel.active').dataset.panel]);
  await page.goBack(); await sleep(900); await idle();
  const inn = await page.evaluate(() => { const c = PhDesk._cur(); return [document.body.classList.contains('dk-on'), c.busy, c.root.dataset.ready, c.root.offsetParent !== null || getComputedStyle(c.root).position === 'fixed']; });
  ok('sair a meio de um render e voltar', !out[0] && inn[0] && !inn[1] && inn[2] === '1', { fora: out, dentro: inn });
  await click('.dk-secs [data-act="reset"]'); await idle();

  /* resultado atrasado de uma bancada pintado na outra (sim → dev) */
  let stale = 0, tries = 0;
  for (let k = 0; k < 6; k++) {
    await go('laboratorio/camara/lab-ciclista', 1200); await idle();
    const mT = await page.evaluate(() => +document.querySelector('.dk-dial[data-k="t"] input').max);
    await page.evaluate(() => {
      window.__stale = 0;
      const pi = CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData = function (im, ...r) {
        const cvs = this.canvas, dk = cvs.closest && cvs.closest('.dk');
        /* na mesa de revelação, antes de a fotografia estar carregada, só a própria carga pode pintar: marca-se o que chega do worker */
        if (dk && cvs.classList.contains('dk-cv') && dk.dataset.mode === 'dev') { const c = PhDesk._cur(); if (!c.sizes || window.__expectStale) { if (new Error().stack.includes('paint')) window.__stale++; } }
        return pi.call(this, im, ...r);
      };
    });
    await setRange('.dk-dial[data-k="t"] input', mT - k, false);
    await page.evaluate(() => { window.__expectStale = true; document.querySelector('[data-act="todev"]').click(); setTimeout(() => { window.__expectStale = false; }, 0); });
    /* observa: algum resultado do worker chegou à mesa nova antes de ela pedir o seu? */
    const seen = await page.evaluate(() => new Promise(res => { let hit = 0; const t0 = performance.now(); const iv = setInterval(() => { const c = PhDesk._cur(); if (c && c.mode === 'dev' && c.hist && c.rid === 0) hit++; if (c && c.mode === 'dev' && c.hist && !c.sizes) hit++; if (performance.now() - t0 > 2500) { clearInterval(iv); res(hit + window.__stale); } }, 4); }));
    tries++; if (seen) stale++;
    await idle();
  }
  ok('um render pendente da câmara escura não é pintado na mesa de revelação', stale === 0, { tentativas: tries, comResultadoAtrasado: stale });
}

/* ── 6. o worker falha a carregar ─────────────────────────────────── */
if (want('wfail')) {
  console.log('── falha do worker ──');
  let blocked = 0, allow = false;
  page.__expectFail = true;
  await page.route('**/ph-lab-worker.js', r => { if (!allow) { blocked++; return r.abort('connectionfailed'); } return r.continue(); });
  await go('edicao/mesa/own-18', 2500);
  const s0 = await page.evaluate(() => { const c = PhDesk._cur(); return { ready: c.root.dataset.ready, busy: c.busy, cvw: document.querySelector('.dk-cv').width }; });
  errs = [];
  allow = true;                                   // a rede "volta"
  const h0 = (await cv()).hash;
  await setRange('[data-p="exposure"]', 1); await sleep(3500);
  const h1 = (await cv()).hash;
  const s1 = await page.evaluate(() => { const c = PhDesk._cur(); return { busy: c.busy, msg: (document.querySelector('#dp-toast') || {}).hidden === false ? document.querySelector('#dp-toast').textContent : '' }; });
  errs = errs.filter(e => !/worker|ERR_FAILED|connection/i.test(e));
  ok('worker falhou à primeira: a fotografia aparece e a mesa recupera quando a rede volta', blocked > 0 && s0.ready === '1' && h1 !== h0, { bloqueios: blocked, antes: s0, depois: s1, recuperou: h1 !== h0 });
  await click('.dk-secs [data-act="reset"]');
  /* o mesmo numa cena com recorte do sujeito (a recuperação tem de voltar a entregar o recorte) */
  allow = false; blocked = 0;
  await go('laboratorio/camara/lab-retrato', 2500);
  allow = true; errs = [];
  const g0 = (await cv()).hash;
  await setRange('.dk-dial[data-k="N"] input', 20); await sleep(1600);
  await setRange('.dk-dial[data-k="N"] input', 22); await sleep(3500);
  const g1 = (await cv()).hash, st = await page.evaluate(() => { const c = PhDesk._cur(); return { busy: c.busy, wdead: !!c.wdead, leitura: document.querySelectorAll('.dk-read').length }; });
  errs = errs.filter(e => !/worker|ERR_FAILED|connection/i.test(e));
  ok('worker falhou numa cena com recorte: recupera e volta a simular', blocked > 0 && g1 !== g0 && !st.busy && !st.wdead && st.leitura >= 4, { bloqueios: blocked, ...st, recuperou: g1 !== g0 });
  await page.unroute('**/ph-lab-worker.js'); page.__expectFail = false;
}

/* ── 7. estúdio 3D ────────────────────────────────────────────────── */
if (want('studio')) {
  console.log('── estúdio 3D ──');
  await go('estudio', 9000);
  const s = await page.evaluate(() => { const c = document.querySelector('#view-photography canvas'); const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    return { canvas: !!c, w: c ? c.width : 0, webgl: !!gl, txt: document.querySelector('.ph-panel.active').innerText.slice(0, 140).replace(/\s+/g, ' ') }; });
  ok('o estúdio monta um canvas WebGL', s.canvas && s.w > 100, s);
}

console.log(`\n${ENG} ${W}px: ${total} verificações, ${fail ? fail + ' FALHAS' : 'tudo certo'}`);
await browser.close();
process.exit(fail ? 1 : 0);
