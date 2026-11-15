/* ══════════════════════════════════════════════════════════════════
   PhDesk — a mesa de trabalho do microsite (câmara escura digital).

   Um só shell, duas bancadas:
     'sim'  Laboratório › Câmara escura  — "e se tivesse disparado de outra
            maneira?" sobre fotografias com as definições reais (ph-sim.js)
     'dev'  Editar › Mesa de revelação   — todos os ajustes das lições
            combinados numa fotografia, com estilos, histórico e exportação

   A fotografia é o centro: o palco ocupa o que sobra, os painéis laterais
   recolhem, e no telemóvel a fotografia fica presa em cima com os
   controlos por separadores ao alcance do polegar.

   Os píxeis correm num Worker (ph-lab-worker.js) com o motor das lições
   (photo-lab.js): enquanto se arrasta um cursor rende-se uma versão a
   meia resolução, e a inteira assim que o dedo pára.
   ══════════════════════════════════════════════════════════════════ */
const PhDesk = (function () {
  'use strict';

  const I = (n, o) => PhIcon.svg(n, o);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const S = PhSim;
  const mobile = () => matchMedia('(max-width: 900px)').matches;

  let _data = null, _worker = null, cur = null, _go = null;

  /* ── dados: fotografias do autor + cenas do laboratório + estilos ── */
  function loadData() {
    if (_data) return _data;
    const j = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    _data = Promise.all([j('/data/photo/own.json'), j('/data/photo/lab.json'), j('/data/photo/looks.json')]).then(([own, lab, looks]) => {
      const photos = new Map(own.photos.map(p => [p.id, p]));
      const scenes = lab.scenes.map(sc => {
        const ph = photos.get(sc.id) || {};
        const id = sc.id;
        return Object.assign({}, ph, sc, {
          src: sc.src || `/assets/photo/own/${id}.webp`, thumb: sc.thumb || `/assets/photo/own/t/${id}.webp`,
          generated: sc.group !== 'own',
        });
      });
      return { own, scenes, groups: lab.groups, looks: looks.looks, byId: new Map(scenes.map(s => [s.id, s])) };
    }).catch(e => { _data = null; throw e; });
    return _data;
  }

  function worker() {
    if (_worker) return _worker;
    _worker = new Worker('/photography/js/ph-lab-worker.js');
    _worker.onmessage = e => {
      const m = e.data, c = cur;
      if (!c) return;
      c.busy = false;
      if (m.gen === c.gen) { if (m.error) console.warn('[desk]', m.error); else paint(c, m); }
      if (c.next) { const n = c.next; c.next = null; c.busy = true; _worker.postMessage(n); }
    };
    _worker.onerror = e => { console.error('[desk worker]', e.message); if (cur) cur.busy = false; };
    return _worker;
  }

  /* ══ definições dos painéis ═══════════════════════════════════════ */
  /* Mesa de revelação: os mesmos cursores das lições, pela ordem do fluxo. */
  const DEV_GROUPS = [
    { id: 'luz', label: 'Luz', icon: 'sun', ctl: [
      ['exposure', 'Exposição', -3, 3, 0.05, 'exposure'], ['contrast', 'Contraste', -100, 100, 1, 'contrast'],
      ['highlights', 'Realces', -100, 100, 1, 'highlights'], ['shadows', 'Sombras', -100, 100, 1, 'shadows'],
      ['whites', 'Brancos', -100, 100, 1, 'whites'], ['blacks', 'Pretos', -100, 100, 1, 'blacks']] },
    { id: 'cor', label: 'Cor', icon: 'palette', ctl: [
      ['temp', 'Temperatura', -100, 100, 1, 'temp'], ['tint', 'Matiz', -100, 100, 1, 'tint'],
      ['vibrance', 'Vibrância', -100, 100, 1, 'vibrance'], ['saturation', 'Saturação', -100, 100, 1, 'saturation']] },
    { id: 'curva', label: 'Curva', icon: 'curve', custom: 'curve', lesson: 'curve' },
    { id: 'hsl', label: 'Cor por banda', icon: 'layers', custom: 'hsl', lesson: 'hsl' },
    { id: 'grad', label: 'Gradação', icon: 'wand', custom: 'grading', lesson: 'grading' },
    { id: 'detalhe', label: 'Detalhe', icon: 'detail', ctl: [
      ['texture', 'Textura', -100, 100, 1, 'texture'], ['clarity', 'Claridade', -100, 100, 1, 'clarity'],
      ['dehaze', 'Neblina', -100, 100, 1, 'dehaze'], ['sharpen', 'Nitidez', 0, 100, 1, 'sharpen'],
      ['denoise', 'Redução de ruído', 0, 100, 1, 'noise']] },
    { id: 'efeitos', label: 'Efeitos', icon: 'grain', ctl: [
      ['vignette', 'Vinheta', -100, 100, 1], ['grain', 'Grão', 0, 100, 1], ['fade', 'Pretos levantados', 0, 100, 1],
      ['bloom', 'Brilho difuso', 0, 100, 1], ['halation', 'Halação', 0, 100, 1]] },
  ];
  const HSL_BANDS = [['red', 'Vermelho', '#e0483c'], ['orange', 'Laranja', '#e8903a'], ['yellow', 'Amarelo', '#e2c644'], ['green', 'Verde', '#5fae58'],
    ['aqua', 'Ciano', '#4fb8b0'], ['blue', 'Azul', '#4a7fd4'], ['purple', 'Roxo', '#8a62c9'], ['magenta', 'Magenta', '#c95aa8']];
  const CURVE_X = [0, 0.25, 0.5, 0.75, 1];
  const CURVE_PRESETS = [['Linear', [0, .25, .5, .75, 1]], ['Contraste', [0, .19, .5, .82, 1]], ['Suave', [.05, .29, .5, .71, .95]],
    ['Matte', [.1, .27, .5, .75, .94]], ['Sombras abertas', [0, .33, .56, .78, 1]]];
  const devNeutral = () => ({ exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temp: 0, tint: 0, saturation: 0, vibrance: 0,
    clarity: 0, texture: 0, dehaze: 0, sharpen: 0, denoise: 0, vignette: 0, grain: 0, grainSize: 1, fade: 0, bloom: 0, halation: 0,
    curveY: CURVE_X.slice(), hsl: {}, gs: { h: 220, a: 0 }, gh: { h: 40, a: 0 }, look: null, lookK: 100 });

  /* hue (0..360) + dose (0..100) ⇄ vetor de tinta [-1..1]³ que o motor usa */
  function hueVec(h, a) {
    const f = n => { const k = (n + h / 30) % 12; return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    const c = [f(0), f(8), f(4)], m = (c[0] + c[1] + c[2]) / 3;
    const v = c.map(x => x - m), mx = Math.max(...v.map(Math.abs)) || 1;
    return v.map(x => x / mx * (a / 100) * 0.5);
  }
  function vecHue(v) {
    const a = Math.max(...v.map(Math.abs));
    if (a < 0.01) return null;
    const mn = Math.min(...v), c = v.map(x => x - mn), mx = Math.max(...c) || 1;
    const [r, g, b] = c.map(x => x / mx);
    let h = r >= g && r >= b ? ((g - b) / 1) % 6 : g >= b ? (b - r) / 1 + 2 : (r - g) / 1 + 4;
    h = (h * 60 + 360) % 360;
    return { h: Math.round(h), a: Math.round(clamp(a / 0.5 * 100, 0, 100)) };
  }
  /* estado da mesa → parâmetros do motor */
  function devParams(p) {
    const o = {};
    for (const g of DEV_GROUPS) if (g.ctl) for (const c of g.ctl) if (p[c[0]]) o[c[0]] = p[c[0]];
    if (p.grain) o.grainSize = p.grainSize || 1;
    if (p.curveY.some((y, i) => Math.abs(y - CURVE_X[i]) > 0.004)) o.curvePts = CURVE_X.map((x, i) => [x, p.curveY[i]]);
    if (Object.keys(p.hsl).some(k => p.hsl[k])) o.hsl = p.hsl;
    if (p.gs.a) o.splitShadow = hueVec(p.gs.h, p.gs.a);
    if (p.gh.a) o.splitHigh = hueVec(p.gh.h, p.gh.a);
    return o;
  }
  /* receita de um estilo (looks.json) → estado da mesa, com dose */
  function lookToDev(rec, k) {
    const r = PhotoLearn.scaleRecipe(Object.assign({}, rec, { curvePts: undefined }), k);
    const p = devNeutral();
    for (const key in r) if (key in p && typeof r[key] === 'number') p[key] = Math.round(r[key] * 100) / 100;
    if (rec.grainSize) p.grainSize = rec.grainSize;
    if (rec.curvePts) {
      const lut = PhotoLab.curveLUT(rec.curvePts.map(([x, y]) => [x, x + (y - x) * k]));
      p.curveY = CURVE_X.map(x => lut[Math.round(x * 255)] / 255);
    }
    if (r.hsl) for (const j in r.hsl) p.hsl[j] = Math.round(r.hsl[j]);
    if (r.splitShadow) p.gs = vecHue(r.splitShadow) || p.gs;
    if (r.splitHigh) p.gh = vecHue(r.splitHigh) || p.gh;
    return p;
  }

  /* ══ HTML ═════════════════════════════════════════════════════════ */
  function shellHTML(mode) {
    const sim = mode === 'sim';
    return `
<div class="dk" data-mode="${mode}" data-cmp="result" data-tab="${sim ? 'camara' : 'luz'}">
  <header class="dk-bar">
    <a class="dk-back" href="#${sim ? 'laboratorio' : 'edicao'}">${I('back')}<span>${sim ? 'Laboratório' : 'Editar'}</span></a>
    <div class="dk-title"><b>${sim ? 'Câmara escura' : 'Mesa de revelação'}</b><span class="dk-title-s"></span></div>
    <div class="dk-bar-mid">
      <div class="dk-seg dk-cmp" role="group" aria-label="Comparação">
        <button type="button" data-cmp="result" aria-pressed="true" title="Só o resultado (1)">${I('single')}<span>Resultado</span></button>
        <button type="button" data-cmp="wipe" aria-pressed="false" title="Cortina: original | resultado (2)">${I('split')}<span>Cortina</span></button>
        <button type="button" data-cmp="side" aria-pressed="false" title="Lado a lado (3)">${I('side')}<span>Lado a lado</span></button>
      </div>
      <button type="button" class="dk-btn dk-hold" title="Manter premido para ver o original (\\)">${I('eye')}<span>Original</span></button>
    </div>
    <div class="dk-bar-end">
      ${sim ? '' : `<button type="button" class="dk-btn dk-ico" data-act="undo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled>${I('undo')}</button>
      <button type="button" class="dk-btn dk-ico" data-act="redo" title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer" disabled>${I('redo')}</button>`}
      <button type="button" class="dk-btn dk-ico" data-act="clip" aria-pressed="false" title="Avisos de recorte: realces queimados a vermelho, sombras fechadas a azul (J)" aria-label="Avisos de recorte">${I('clip')}</button>
      <button type="button" class="dk-btn dk-ico" data-act="zoom" title="Ampliar / ajustar (Z, ou duplo clique na fotografia)" aria-label="Ampliar ou ajustar ao ecrã">${I('zoom')}</button>
      <span class="dk-sep"></span>
      <button type="button" class="dk-btn dk-ico dk-only-d" data-act="left" aria-pressed="true" title="Painel esquerdo ([)" aria-label="Mostrar ou esconder o painel esquerdo">${I('panelL')}</button>
      <button type="button" class="dk-btn dk-ico dk-only-d" data-act="right" aria-pressed="true" title="Painel direito (])" aria-label="Mostrar ou esconder o painel direito">${I('panelR')}</button>
      <button type="button" class="dk-btn dk-ico dk-only-d" data-act="zen" aria-pressed="false" title="Ecrã inteiro (F)" aria-label="Ecrã inteiro">${I('expand')}</button>
      ${sim ? '' : `<button type="button" class="dk-btn dk-primary" data-act="export">${I('download')}<span>Exportar</span></button>`}
    </div>
  </header>

  <div class="dk-body">
    <aside class="dk-left" aria-label="${sim ? 'Cenas' : 'Estilos e fotografias'}"></aside>

    <section class="dk-stage" aria-label="Fotografia">
      <div class="dk-view">
        <div class="dk-zoomer">
          <figure class="dk-frame dk-frame-o" aria-hidden="true"><img class="dk-side-img" alt="" draggable="false"/><figcaption>${sim ? 'Como foi tirada' : 'Original'}</figcaption></figure>
          <figure class="dk-frame dk-frame-r">
            <canvas class="dk-cv"></canvas>
            <canvas class="dk-clip" aria-hidden="true"></canvas>
            <img class="dk-orig" alt="" draggable="false"/>
            <span class="dk-tag dk-tag-o">${sim ? 'Como foi tirada' : 'Original'}</span>
            <span class="dk-tag dk-tag-r">${sim ? 'A tua versão' : 'Revelada'}</span>
            <span class="dk-wipe" role="slider" tabindex="0" aria-label="Posição da cortina" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><i></i></span>
            <span class="dk-reticle" hidden></span>
          </figure>
        </div>
        <p class="dk-loading">A carregar a fotografia…</p>
        <span class="dk-zoomlvl" hidden></span>
      </div>
      <div class="dk-hud">
        <div class="dk-hud-meta"><b class="dk-hud-cam"></b><span class="dk-hud-lens"></span></div>
        <div class="dk-hud-read" aria-live="off"></div>
      </div>
      <p class="dk-cap"></p>
    </section>

    <aside class="dk-right" aria-label="${sim ? 'Câmara' : 'Ajustes'}">
      <div class="dk-histo">
        <canvas class="dk-histo-cv" width="320" height="96" role="img" aria-label="Histograma"></canvas>
        <div class="dk-histo-leg"><span>sombras</span><span class="dk-histo-msg"></span><span>altas luzes</span></div>
      </div>
      <div class="dk-secs"></div>
    </aside>
  </div>

  <nav class="dk-tabs" aria-label="Painéis"></nav>
  <input type="file" class="dk-file" accept="image/jpeg,image/png,image/webp" hidden/>
</div>`;
  }

  const secHTML = (id, label, icon, body, extra) => `
    <section class="dk-sec" data-sec="${id}" data-open="1">
      <h3 class="dk-sec-h"><button type="button" aria-expanded="true">${I(icon)}<span>${label}</span>${extra || ''}${I('down', { cls: 'dk-chev' })}</button></h3>
      <div class="dk-sec-b">${body}</div>
    </section>`;

  /* ── bancada 'sim': a câmara ── */
  function dialHTML(k, label, icon, lo, hi) {
    return `<div class="dk-dial" data-k="${k}">
      <div class="dk-dial-h"><span class="dk-dial-l">${I(icon)}${label}</span><span class="dk-dial-auto" hidden>auto</span><output class="dk-dial-v"></output></div>
      <div class="dk-dial-c">
        <button type="button" class="dk-step" data-step="-1" aria-label="${label}: menos um terço de stop">${I('minus')}</button>
        <div class="dk-track"><input type="range" min="0" max="10" step="1" aria-label="${label}"/><i class="dk-shot" title="Como foi tirada"></i></div>
        <button type="button" class="dk-step" data-step="1" aria-label="${label}: mais um terço de stop">${I('plus')}</button>
      </div>
      <div class="dk-dial-e"><span>${lo}</span><span>${hi}</span></div>
    </div>`;
  }
  function simSecs(scene) {
    const sensors = [['own', 'Original']].concat(Object.keys(S.SENSORS).filter(k => k !== (scene.cls || 'apsc')).map(k => [k, S.SENSORS[k].name]));
    return secHTML('camara', 'Câmara', 'camera', `
      <div class="dk-row dk-modes">
        <div class="dk-seg dk-seg-fill" role="group" aria-label="Modo de exposição" data-seg="mode">
          <button type="button" data-v="M" title="Manual: escolhes os três, a exposição muda">M</button>
          <button type="button" data-v="A" title="Prioridade à abertura: a câmara ajusta o tempo">A</button>
          <button type="button" data-v="S" title="Prioridade ao obturador: a câmara ajusta a abertura">S</button>
        </div>
        <p class="dk-mode-n"></p>
      </div>
      ${dialHTML('N', 'Abertura', 'aperture', 'tudo nítido', 'fundo desfocado')}
      ${dialHTML('t', 'Tempo', 'shutter', 'congela', 'arrasta')}
      ${dialHTML('iso', 'ISO', 'iso', 'limpo', 'ruído')}
      ${dialHTML('comp', 'Compensação', 'ev', 'mais escuro', 'mais claro')}
      <div class="dk-meter" role="img" aria-label="Fotómetro">
        <div class="dk-meter-s"><i class="dk-meter-n"></i>${[-3, -2, -1, 0, 1, 2, 3].map(v => `<span style="left:${(v + 3) / 6 * 100}%">${v > 0 ? '+' + v : v === 0 ? '0' : '−' + (-v)}</span>`).join('')}</div>
        <p class="dk-meter-t"></p>
      </div>`)
    + secHTML('extra', 'Suporte e ótica', 'tripod', `
      <div class="dk-field"><span class="dk-field-l">Apoio</span>
        <div class="dk-seg dk-seg-fill" role="group" aria-label="Apoio" data-seg="tripod">
          <button type="button" data-v="0">${I('hand')}À mão</button><button type="button" data-v="1">${I('tripod')}Tripé</button></div></div>
      ${(scene.motion || []).some(m => m.mask === 'matte') ? `<div class="dk-field"><span class="dk-field-l">Câmara</span>
        <div class="dk-seg dk-seg-fill" role="group" aria-label="Movimento da câmara" data-seg="pan">
          <button type="button" data-v="0" title="A câmara fica parada e o sujeito atravessa o enquadramento">Parada</button><button type="button" data-v="1" title="Panning: a câmara acompanha o sujeito">A acompanhar</button></div></div>` : ''}
      <div class="dk-field"><span class="dk-field-l">Filtro ND</span>
        <div class="dk-seg dk-seg-fill" role="group" aria-label="Filtro de densidade neutra" data-seg="nd">
          ${[[0, 'Sem'], [3, 'ND8'], [6, 'ND64'], [10, 'ND1000'], [15, 'ND32k']].map(([v, l]) => `<button type="button" data-v="${v}" title="${v ? '−' + v + ' stops de luz' : 'Sem filtro'}">${l}</button>`).join('')}</div></div>
      <div class="dk-field"><span class="dk-field-l">Sensor <small>mesmo enquadramento</small></span>
        <div class="dk-seg dk-seg-fill dk-seg-wrap" role="group" aria-label="Sensor" data-seg="sensor">
          ${sensors.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="dk-field dk-focus"><span class="dk-field-l">Foco <output class="dk-focus-v"></output></span>
        <div class="dk-track"><input type="range" min="0" max="100" step="1" data-focus aria-label="Distância de foco"/></div>
        <p class="dk-hint">${I('focus')}Ou toca na fotografia no sítio onde queres focar.</p></div>`)
    + secHTML('leitura', 'Leitura', 'meter', `<ul class="dk-reads"></ul>`)
    + secHTML('exp', 'Experiências', 'flask', `<div class="dk-try"></div><p class="dk-try-why" hidden></p>
      <div class="dk-actions">
        <button type="button" class="dk-btn dk-wide" data-act="reset">${I('reset')}<span>Como foi tirada</span></button>
        <button type="button" class="dk-btn dk-wide" data-act="todev">${I('sliders')}<span>Revelar esta fotografia</span></button>
      </div>`);
  }

  /* ── bancada 'dev': os ajustes ── */
  const sliderHTML = ([k, label, min, max, step, lesson]) => `
    <label class="dk-sl" data-k="${k}"><span class="dk-sl-l">${label}${lesson ? `<a class="dk-why" href="#edicao/${lesson}" title="O que faz este ajuste" aria-label="Lição: ${label}">${I('help')}</a>` : ''}</span>
      <output class="dk-sl-v">0</output>
      <input type="range" min="${min}" max="${max}" step="${step}" value="0" data-p="${k}"/></label>`;
  function devSecs() {
    return DEV_GROUPS.map(g => {
      let body;
      if (g.ctl) body = g.ctl.map(sliderHTML).join('');
      else if (g.custom === 'curve') body = `
        <div class="dk-curve"><svg viewBox="0 0 200 200" class="dk-curve-svg" role="img" aria-label="Curva de tons">
          <path class="dk-curve-grid" d="M50 0V200M100 0V200M150 0V200M0 50H200M0 100H200M0 150H200"/><path class="dk-curve-diag" d="M0 200L200 0"/>
          <path class="dk-curve-line" d=""/>${CURVE_X.map((x, i) => `<circle class="dk-curve-pt" r="6" data-i="${i}" tabindex="0" role="slider" aria-label="Ponto ${i + 1} da curva" aria-valuemin="0" aria-valuemax="100"/>`).join('')}</svg></div>
        <div class="dk-chips" data-curve-presets>${CURVE_PRESETS.map(([n], i) => `<button type="button" class="dk-chip" data-i="${i}">${n}</button>`).join('')}</div>
        <p class="dk-hint">Arrasta os pontos. Esquerda = sombras, direita = altas luzes. <a href="#edicao/curve">Como ler a curva</a></p>`;
      else if (g.custom === 'hsl') body = `
        <div class="dk-bands" role="group" aria-label="Banda de cor">${HSL_BANDS.map(([id, n, c], i) => `<button type="button" class="dk-band" data-b="${id}" style="--c:${c}" aria-pressed="${i === 1}" title="${n}" aria-label="${n}"><i></i></button>`).join('')}</div>
        <p class="dk-band-n"></p>
        ${[['Hue', 'Matiz', -40, 40], ['Sat', 'Saturação', -100, 100], ['Lum', 'Luminância', -100, 100]].map(([s, l, a, b]) => `
        <label class="dk-sl"><span class="dk-sl-l">${l}</span><output class="dk-sl-v">0</output><input type="range" min="${a}" max="${b}" step="1" value="0" data-hsl="${s}"/></label>`).join('')}
        <p class="dk-hint"><a href="#edicao/hsl">Quando mexer numa cor só</a></p>`;
      else body = `
        ${[['gs', 'Sombras'], ['gh', 'Altas luzes']].map(([k, l]) => `<div class="dk-grad" data-g="${k}"><span class="dk-field-l">${l}<i class="dk-grad-sw"></i></span>
          <label class="dk-sl dk-sl-hue"><span class="dk-sl-l">Tom</span><output class="dk-sl-v"></output><input type="range" min="0" max="359" step="1" data-gk="h"/></label>
          <label class="dk-sl"><span class="dk-sl-l">Dose</span><output class="dk-sl-v">0</output><input type="range" min="0" max="100" step="1" value="0" data-gk="a"/></label></div>`).join('')}
        <p class="dk-hint"><a href="#edicao/grading">O que é gradação de cor</a></p>`;
      return secHTML(g.id, g.label, g.icon, body, `<i class="dk-dot" hidden title="Com alterações"></i>`);
    }).join('')
    + `<div class="dk-actions dk-actions-end">
        <button type="button" class="dk-btn dk-wide" data-act="reset">${I('reset')}<span>Repor tudo</span></button>
        <button type="button" class="dk-btn dk-wide" data-act="tosim" hidden>${I('camera')}<span>Simular o disparo</span></button>
      </div>`;
  }

  /* ══ montar ═══════════════════════════════════════════════════════ */
  function mount(host, mode, arg, go) {
    _go = go || _go;
    if (cur && cur.host === host && cur.mode === mode) { if (arg && cur.scene && cur.scene.id !== arg) select(cur, arg); return; }
    if (cur) unmount();
    host.innerHTML = shellHTML(mode);
    const root = host.querySelector('.dk');
    const prefs = store.get('ph-desk', {});
    const c = cur = { host, root, mode, gen: 0, rid: 0, busy: false, next: null, z: 1, px: 0, py: 0, wipe: 0.5, clip: false,
      prefs, hist: null, scene: null, st: null, p: devNeutral(), undo: [], redo: [], band: 'orange', data: null };
    root.dataset.left = prefs.left === false ? '0' : '1';
    root.dataset.right = prefs.right === false ? '0' : '1';
    setCmp(c, prefs.cmp && prefs.cmp !== 'side' ? prefs.cmp : 'result', true);
    wireShell(c);
    document.body.classList.add('dk-on');
    loadData().then(d => {
      if (cur !== c) return;
      c.data = d;
      buildLeft(c);
      const want = arg || (mode === 'sim' ? prefs.sim : prefs.dev);
      select(c, d.byId.has(want) ? want : d.scenes[0].id, true);
    }).catch(err => {
      console.error(err);
      host.querySelector('.dk-loading').textContent = 'Não foi possível carregar as fotografias. Verifica a ligação e volta a tentar.';
    });
  }
  function unmount() {
    if (!cur) return;
    document.body.classList.remove('dk-on', 'dk-zen');
    window.removeEventListener('keydown', cur.onKey);
    window.removeEventListener('keyup', cur.onKeyUp);
    if (cur.ro) cur.ro.disconnect();
    cur.host.innerHTML = '';
    cur = null;
  }
  /* a rota saiu da mesa: o DOM fica (voltar é instantâneo), o corpo solta-se */
  function leave() { document.body.classList.remove('dk-on', 'dk-zen'); }
  function enter() { if (cur) { document.body.classList.add('dk-on'); if (cur.root.dataset.zen === '1') document.body.classList.add('dk-zen'); } }

  /* ── painel esquerdo ── */
  const exifLine = s => s.f ? `${S.fmtAperture(s.f)} · ${S.fmtShutter(s.t)} · ISO ${s.iso}` : 'sem EXIF';
  function buildLeft(c) {
    const d = c.data, left = c.root.querySelector('.dk-left');
    const item = s => `<button type="button" class="dk-scene" data-id="${s.id}" aria-pressed="false">
        <img src="${s.thumb}" alt="" loading="lazy" decoding="async" width="104" height="78"/>
        <span class="dk-scene-t"><b>${esc(s.title)}</b><small>${esc(exifLine(s))}</small></span></button>`;
    const scenes = d.groups.map(g => {
      const list = d.scenes.filter(s => s.group === g.id);
      return list.length ? `<div class="dk-grp"><p class="dk-grp-t">${esc(g.label)}<small>${esc(g.sub)}</small></p>${list.map(item).join('')}</div>` : '';
    }).join('');
    const open = `<button type="button" class="dk-btn dk-wide dk-open" data-act="open">${I('upload')}<span>Abrir uma fotografia tua</span></button>
      <p class="dk-hint">Fica no teu browser: não é enviada para lado nenhum.${c.mode === 'sim' ? ' Precisa de EXIF (JPEG da câmara).' : ''}</p>`;
    if (c.mode === 'sim') {
      left.innerHTML = secHTML('cenas', 'Cenas', 'film', scenes + open);
    } else {
      const looks = d.looks.map(l => `<button type="button" class="dk-look" data-look="${l.id}" aria-pressed="false">
          <canvas width="132" height="88" aria-hidden="true"></canvas><span>${esc(l.name)}</span></button>`).join('');
      left.innerHTML = secHTML('estilos', 'Estilos', 'wand', `
          <div class="dk-looks"><button type="button" class="dk-look" data-look="" aria-pressed="true"><canvas width="132" height="88" aria-hidden="true"></canvas><span>Sem estilo</span></button>${looks}</div>
          <label class="dk-sl dk-look-k"><span class="dk-sl-l">Dose do estilo</span><output class="dk-sl-v">100%</output><input type="range" min="0" max="150" step="5" value="100" data-lookk/></label>
          <p class="dk-hint">Um estilo é um ponto de partida: depois de aplicado, todos os cursores continuam teus. <a href="#aprender/estilos">O que diz cada estilo</a></p>`)
        + secHTML('fotos', 'Fotografias', 'film', scenes + open);
    }
    buildTabs(c);
  }
  function buildTabs(c) {
    const tabs = [...c.root.querySelectorAll('.dk-sec')].map(s => {
      const b = s.querySelector('.dk-sec-h button');
      return `<button type="button" data-tab="${s.dataset.sec}">${b.querySelector('.ic').outerHTML}<span>${b.querySelector('span').textContent}</span></button>`;
    });
    c.root.querySelector('.dk-tabs').innerHTML = tabs.join('');
    setTab(c, c.root.dataset.tab);
  }
  function setTab(c, id) {
    if (!c.root.querySelector(`.dk-sec[data-sec="${id}"]`)) id = c.mode === 'sim' ? 'camara' : 'luz';
    c.root.dataset.tab = id;
    c.root.querySelectorAll('.dk-sec').forEach(s => s.classList.toggle('dk-tab-on', s.dataset.sec === id));
    c.root.querySelectorAll('.dk-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === id));
    c.root.dataset.tabside = c.root.querySelector(`.dk-left .dk-sec[data-sec="${id}"]`) ? 'left' : 'right';
  }

  /* ══ escolher a fotografia ════════════════════════════════════════ */
  function select(c, id, first) {
    const scene = id === 'user' ? c.user : c.data.byId.get(id);
    if (!scene) return;
    c.scene = scene;
    c.gen++; c.next = null; c.matte = null;
    c.root.querySelectorAll('.dk-scene').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
    c.root.querySelector('.dk-title-s').textContent = scene.title;
    c.root.querySelector('.dk-hud-cam').textContent = scene.camera || 'Fotografia sem EXIF';
    c.root.querySelector('.dk-hud-lens').textContent = (scene.generated ? ['cena de treino', scene.light, 'imagem gerada']
      : [scene.lens, scene.focal35 ? scene.focal35 + ' mm eq.' : null, scene.light, scene.year]).filter(Boolean).join(' · ');
    c.root.querySelector('.dk-cap').innerHTML = scene.lesson ? esc(scene.lesson) + (scene.baked ? ` <span class="dk-cap-n">${esc(scene.baked)}</span>` : '') : '';
    if (id !== 'user') {
      c.prefs[c.mode] = id; store.set('ph-desk', c.prefs);
      const route = (c.mode === 'sim' ? 'laboratorio/camara/' : 'edicao/mesa/') + id;
      if (!first || location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
    }
    resetView(c);
    if (c.mode === 'sim') {
      c.st = S.shotOf(scene);
      c.focusPt = null;
      c.root.querySelector('.dk-secs').innerHTML = simSecs(scene);
      wireSim(c);
    } else {
      const saved = store.get('ph-dev-edit', null);
      c.p = saved && saved.id === id && saved.p ? Object.assign(devNeutral(), saved.p) : devNeutral();
      c.undo = []; c.redo = [];
      if (!c.root.querySelector('.dk-secs .dk-sec')) { c.root.querySelector('.dk-secs').innerHTML = devSecs(); wireDev(c); }
      c.root.querySelector('[data-act="tosim"]').hidden = !(scene.f && id !== 'user');
      syncDev(c);
    }
    restoreSecs(c);
    buildTabs(c);
    loadImage(c, scene);
  }

  function loadImage(c, scene) {
    const gen = c.gen, root = c.root;
    root.dataset.ready = '0';
    const done = img => {
      if (cur !== c || c.gen !== gen) return;
      const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
      c.ar = W0 / H0;
      root.style.setProperty('--ar', c.ar);
      const long = Math.min(Math.max(W0, H0), mobile() ? 960 : 1280);
      const w = worker(), sizes = {};
      for (const [key, L] of [['hi', long], ['lo', Math.max(360, Math.round(long / 2))]]) {
        const k = L / Math.max(W0, H0), cw = Math.round(W0 * k), ch = Math.round(H0 * k);
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        const x = cv.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, cw, ch);
        const id = x.getImageData(0, 0, cw, ch);
        if (key === 'hi') { c.orig = id; c.origHist = PhotoLab.histogram(id); }
        sizes[key] = [cw, ch];
        const buf = id.data.buffer.slice(0);
        w.postMessage({ type: 'image', key, w: cw, h: ch, buf }, [buf]);
      }
      c.sizes = sizes;
      const cv = root.querySelector('.dk-cv');
      cv.width = sizes.hi[0]; cv.height = sizes.hi[1];
      cv.getContext('2d').putImageData(c.orig, 0, 0);
      const src = scene.blob || scene.src;
      root.querySelector('.dk-orig').src = src; root.querySelector('.dk-side-img').src = src;
      c.img = img;
      root.dataset.ready = '1';
      if (scene.matte) loadMatte(c, scene, gen);
      if (c.mode === 'dev') paintLooks(c);
      render(c, false);
    };
    if (scene.bitmap) return done(scene.bitmap);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => done(img);
    img.onerror = () => { if (cur === c && c.gen === gen) root.querySelector('.dk-loading').textContent = 'Não foi possível carregar esta fotografia.'; };
    img.src = scene.src;
  }
  /* recorte do sujeito (cenas de treino): canal vermelho de um PNG/WebP → Float32 */
  function loadMatte(c, scene, gen) {
    const im = new Image();
    im.onload = () => {
      if (cur !== c || c.gen !== gen) return;
      for (const key of ['hi', 'lo']) {
        const [w, h] = c.sizes[key];
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data, f = new Float32Array(w * h);
        for (let i = 0; i < f.length; i++) f[i] = d[i * 4] / 255;
        if (key === 'hi') c.matte = { w, h, data: f.slice() };       // para o toque-para-focar
        worker().postMessage({ type: 'matte', key, buf: f.buffer }, [f.buffer]);
      }
      render(c, false);
    };
    im.src = scene.matte;
  }

  /* ══ render ═══════════════════════════════════════════════════════ */
  const scenePlain = s => ({ id: s.id, f: s.f, t: s.t, iso: s.iso, focal35: s.focal35, crop: s.crop, cls: s.cls, is: s.is, camera: s.camera,
    depth: s.depth || null, motion: s.motion || null });
  function simState(c) {
    const st = Object.assign({}, c.st);
    if (st.sensor === 'own') st.sensor = c.scene.cls || 'apsc';
    return S.settle(c.scene, st);
  }
  function render(c, fast) {
    if (!c.sizes) return;
    const msg = { type: 'render', id: ++c.rid, gen: c.gen, key: fast ? 'lo' : 'hi', mode: c.mode };
    if (c.mode === 'sim') { msg.scene = scenePlain(c.scene); msg.st = simState(c); }
    else msg.params = devParams(c.p);
    if (c.busy) { c.next = msg; return; }
    c.busy = true; worker().postMessage(msg);
  }
  /* cursor a mexer: meia resolução já, inteira quando parar */
  function live(c) {
    render(c, true);
    clearTimeout(c.settleT);
    c.settleT = setTimeout(() => { if (cur === c) render(c, false); }, 170);
  }
  function paint(c, m) {
    const cv = c.root.querySelector('.dk-cv'), ctx = cv.getContext('2d');
    const im = new ImageData(new Uint8ClampedArray(m.buf), m.w, m.h);
    if (m.w === cv.width) { ctx.putImageData(im, 0, 0); c.result = im; }
    else {
      const t = c.tmp || (c.tmp = document.createElement('canvas'));
      t.width = m.w; t.height = m.h; t.getContext('2d').putImageData(im, 0, 0);
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(t, 0, 0, cv.width, cv.height);
    }
    c.hist = m.hist;
    PhotoLab.drawHistogram(c.root.querySelector('.dk-histo-cv'), m.hist, c.origHist);
    const hi = m.hist.clipHigh, lo = m.hist.clipLow;
    c.root.querySelector('.dk-histo-msg').textContent = hi > 0.01 ? Math.round(hi * 100) + '% queimado' : lo > 0.04 ? Math.round(lo * 100) + '% fechado' : '';
    c.root.querySelector('.dk-histo').dataset.warn = hi > 0.01 ? 'hi' : lo > 0.04 ? 'lo' : '';
    if (c.clip && m.w === cv.width) drawClip(c);
    if (c.mode === 'sim') syncReads(c);
  }
  function drawClip(c) {
    const o = c.root.querySelector('.dk-clip');
    if (!c.clip || !c.result) { o.hidden = true; return; }
    const r = c.result, x = o.getContext('2d');
    o.hidden = false; o.width = r.width; o.height = r.height;
    const out = x.createImageData(r.width, r.height), D = r.data, O = out.data;
    for (let i = 0; i < D.length; i += 4) {
      if (D[i] > 251 && D[i + 1] > 251 && D[i + 2] > 251) { O[i] = 235; O[i + 1] = 60; O[i + 2] = 50; O[i + 3] = 215; }
      else if (D[i] < 4 && D[i + 1] < 4 && D[i + 2] < 4) { O[i] = 60; O[i + 1] = 120; O[i + 2] = 240; O[i + 3] = 215; }
    }
    x.putImageData(out, 0, 0);
  }

  /* ══ palco: comparação, zoom, foco ════════════════════════════════ */
  function setCmp(c, m, quiet) {
    c.root.dataset.cmp = m;
    c.root.querySelectorAll('.dk-cmp button').forEach(b => b.setAttribute('aria-pressed', b.dataset.cmp === m));
    if (!quiet) { c.prefs.cmp = m; store.set('ph-desk', c.prefs); }
    if (m === 'wipe') setWipe(c, c.wipe);
    fitStack(c);
  }
  function setWipe(c, v) {
    c.wipe = clamp(v, 0.02, 0.98);
    c.root.style.setProperty('--wipe', (c.wipe * 100) + '%');
    c.root.querySelector('.dk-wipe').setAttribute('aria-valuenow', Math.round(c.wipe * 100));
  }
  /* lado a lado: em fila quando o palco é largo, em coluna quando é alto */
  function fitStack(c) {
    const v = c.root.querySelector('.dk-view');
    if (!v || !c.ar) return;
    const W = v.clientWidth, H = v.clientHeight;
    const row = Math.min(W / 2, H * c.ar), col = Math.min(W, (H / 2) * c.ar);
    c.root.dataset.stack = col > row ? 'col' : 'row';
  }
  function resetView(c) { c.z = 1; c.px = 0; c.py = 0; applyView(c); }
  function applyView(c) {
    const zr = c.root.querySelector('.dk-zoomer');
    zr.style.transform = c.z === 1 ? '' : `translate(${c.px}px, ${c.py}px) scale(${c.z})`;
    c.root.dataset.zoomed = c.z > 1 ? '1' : '0';
    const l = c.root.querySelector('.dk-zoomlvl');
    l.hidden = c.z === 1; l.textContent = Math.round(c.z * 100) + '%';
  }
  function zoomAt(c, z, cx, cy) {
    const v = c.root.querySelector('.dk-view').getBoundingClientRect();
    const ox = (cx == null ? v.left + v.width / 2 : cx) - v.left - v.width / 2, oy = (cy == null ? v.top + v.height / 2 : cy) - v.top - v.height / 2;
    z = clamp(z, 1, 6);
    const k = z / c.z;
    c.px = ox - (ox - c.px) * k; c.py = oy - (oy - c.py) * k; c.z = z;
    if (z === 1) { c.px = 0; c.py = 0; }
    const mx = v.width * (z - 1) / 2, my = v.height * (z - 1) / 2;
    c.px = clamp(c.px, -mx, mx); c.py = clamp(c.py, -my, my);
    applyView(c);
  }

  function wireShell(c) {
    const root = c.root, $ = s => root.querySelector(s);
    const view = $('.dk-view');
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a) return act(c, a.dataset.act, a);
      const cm = e.target.closest('.dk-cmp button'); if (cm) return setCmp(c, cm.dataset.cmp);
      const sc = e.target.closest('.dk-scene'); if (sc) { select(c, sc.dataset.id); if (mobile()) setTab(c, c.mode === 'sim' ? 'camara' : 'luz'); return; }
      const tb = e.target.closest('.dk-tabs button'); if (tb) return setTab(c, tb.dataset.tab);
      const sh = e.target.closest('.dk-sec-h button');
      if (sh && !e.target.closest('.dk-why')) {
        const sec = sh.closest('.dk-sec'), open = sec.dataset.open !== '1';
        sec.dataset.open = open ? '1' : '0'; sh.setAttribute('aria-expanded', open);
        (c.prefs.sec = c.prefs.sec || {})[c.mode + ':' + sec.dataset.sec] = open; store.set('ph-desk', c.prefs);
      }
    });
    /* manter premido: original */
    const hold = $('.dk-hold');
    const on = () => { root.dataset.hold = '1'; }, off = () => { delete root.dataset.hold; };
    hold.addEventListener('pointerdown', e => { e.preventDefault(); on(); hold.setPointerCapture(e.pointerId); });
    hold.addEventListener('pointerup', off); hold.addEventListener('pointercancel', off);
    hold.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); on(); } });
    hold.addEventListener('keyup', off); hold.addEventListener('blur', off);

    /* cortina */
    const wipe = $('.dk-wipe'), frame = $('.dk-frame-r');
    wipe.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); wipe.setPointerCapture(e.pointerId); wipe.dataset.drag = '1'; });
    wipe.addEventListener('pointermove', e => { if (!wipe.dataset.drag) return; const r = frame.getBoundingClientRect(); setWipe(c, (e.clientX - r.left) / r.width); });
    const wend = () => { delete wipe.dataset.drag; };
    wipe.addEventListener('pointerup', wend); wipe.addEventListener('pointercancel', wend);
    wipe.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') setWipe(c, c.wipe - 0.04); else if (e.key === 'ArrowRight') setWipe(c, c.wipe + 0.04); else return;
      e.preventDefault();
    });

    /* palco: arrastar (zoom), beliscar, roda, toque = foco */
    const pts = new Map(); let start = null, pinch = 0;
    view.addEventListener('pointerdown', e => {
      if (e.target.closest('.dk-wipe')) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, px: c.px, py: c.py, moved: false, t: e.timeStamp };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]) / c.z; }
      try { view.setPointerCapture(e.pointerId); } catch (_) {}
    });
    view.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        zoomAt(c, Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        if (start) start.moved = true;
      } else if (start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) > 6) start.moved = true;
        if (c.z > 1 && start.moved) {
          const v = view.getBoundingClientRect(), mx = v.width * (c.z - 1) / 2, my = v.height * (c.z - 1) / 2;
          c.px = clamp(start.px + dx, -mx, mx); c.py = clamp(start.py + dy, -my, my); applyView(c);
        }
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0 && start && !start.moved && e.type === 'pointerup' && e.timeStamp - start.t < 500) tap(c, e);
      if (pts.size === 0) start = null;
    };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    view.addEventListener('wheel', e => { e.preventDefault(); zoomAt(c, c.z * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY); }, { passive: false });
    view.addEventListener('dblclick', e => { zoomAt(c, c.z > 1 ? 1 : 2.5, e.clientX, e.clientY); });

    /* abrir ficheiro, também por arrastar para cima do palco */
    $('.dk-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(c, f); });
    view.addEventListener('dragover', e => { e.preventDefault(); root.dataset.drop = '1'; });
    view.addEventListener('dragleave', () => { delete root.dataset.drop; });
    view.addEventListener('drop', e => { e.preventDefault(); delete root.dataset.drop; const f = e.dataTransfer.files[0]; if (f) openFile(c, f); });

    c.ro = new ResizeObserver(() => { fitStack(c); if (c.z > 1) zoomAt(c, c.z); });
    c.ro.observe(view);

    c.onKey = e => {
      if (cur !== c || !root.offsetParent || e.target.closest('input:not([type=range]),textarea,select,[contenteditable]') || document.querySelector('.ps-open')) return;
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z' && c.mode === 'dev') { e.preventDefault(); return act(c, e.shiftKey ? 'redo' : 'undo'); }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === '\\' || k === 'o' || k === 'O') { root.dataset.hold = '1'; }
      else if (k === '1') setCmp(c, 'result'); else if (k === '2') setCmp(c, 'wipe'); else if (k === '3') setCmp(c, 'side');
      else if (k === '[') act(c, 'left'); else if (k === ']') act(c, 'right');
      else if (k === 'f' || k === 'F') act(c, 'zen'); else if (k === 'j' || k === 'J') act(c, 'clip');
      else if (k === 'z' || k === 'Z') act(c, 'zoom');
      else if (k === 'Escape' && root.dataset.zen === '1') act(c, 'zen');
    };
    c.onKeyUp = e => { if (e.key === '\\' || e.key === 'o' || e.key === 'O') delete root.dataset.hold; };
    window.addEventListener('keydown', c.onKey); window.addEventListener('keyup', c.onKeyUp);
  }

  function act(c, a, el) {
    const root = c.root;
    if (a === 'left' || a === 'right') {
      const v = root.dataset[a] === '1' ? '0' : '1';
      root.dataset[a] = v; c.prefs[a] = v === '1'; store.set('ph-desk', c.prefs);
      root.querySelector(`[data-act="${a}"]`).setAttribute('aria-pressed', v === '1');
    } else if (a === 'zen') {
      const v = root.dataset.zen === '1' ? '0' : '1';
      root.dataset.zen = v; document.body.classList.toggle('dk-zen', v === '1');
      root.querySelector('[data-act="zen"]').setAttribute('aria-pressed', v === '1');
    } else if (a === 'clip') {
      c.clip = !c.clip; root.querySelector('[data-act="clip"]').setAttribute('aria-pressed', c.clip);
      if (c.clip) render(c, false); else drawClip(c);
    } else if (a === 'zoom') zoomAt(c, c.z > 1 ? 1 : 2.5);
    else if (a === 'open') root.querySelector('.dk-file').click();
    else if (a === 'reset') {
      if (c.mode === 'sim') { c.st = S.shotOf(c.scene); c.focusPt = null; root.querySelector('.dk-reticle').hidden = true; clearTry(c); syncSim(c); render(c, false); }
      else { commit(c); c.p = devNeutral(); syncDev(c); saveDev(c); render(c, false); }
    } else if (a === 'todev') _go && _go('edicao/mesa/' + (c.scene.id === 'user' ? '' : c.scene.id));
    else if (a === 'tosim') _go && _go('laboratorio/camara/' + c.scene.id);
    else if (a === 'undo' || a === 'redo') {
      const from = a === 'undo' ? c.undo : c.redo, to = a === 'undo' ? c.redo : c.undo;
      if (!from.length) return;
      to.push(JSON.stringify(c.p)); c.p = JSON.parse(from.pop());
      syncDev(c); saveDev(c); render(c, false);
    } else if (a === 'export') exportJPEG(c, el);
  }

  /* toque na fotografia: focar nesse ponto (bancada da câmara) */
  function tap(c, e) {
    if (c.mode !== 'sim' || !c.scene.depth || c.root.dataset.cmp === 'side' || e.target.closest('.dk-frame-o')) return;
    const r = c.root.querySelector('.dk-frame-r').getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    let d = S.depthFn(c.scene)(x, y);
    const sd = c.scene.depth.subject, mt = c.matte;
    if (sd != null && mt && mt.data[Math.min(mt.h - 1, Math.floor(y * mt.h)) * mt.w + Math.min(mt.w - 1, Math.floor(x * mt.w))] > 0.5) d = sd;
    c.st.focus = clamp(isFinite(d) ? d : 5000, 0.3, 5000);
    c.focusPt = [x, y];
    const rt = c.root.querySelector('.dk-reticle');
    rt.hidden = false; rt.style.left = (x * 100) + '%'; rt.style.top = (y * 100) + '%';
    rt.classList.remove('dk-reticle-in'); void rt.offsetWidth; rt.classList.add('dk-reticle-in');
    clearTry(c); syncSim(c); render(c, false);
  }

  /* ══ bancada da câmara ════════════════════════════════════════════ */
  const COMP = Array.from({ length: 19 }, (_, i) => Math.round((i - 9) / 3 * 100) / 100);
  /* as escalas vão sempre de "menos luz" (esquerda) para "mais luz" (direita) */
  const SCALE = { N: S.APERTURES.slice().reverse(), t: S.SHUTTERS, iso: S.ISOS, comp: COMP };
  const fmtK = { N: S.fmtAperture, t: S.fmtShutter, iso: v => 'ISO ' + v, comp: S.fmtEV };
  const FOCUS_LO = Math.log(0.3), FOCUS_HI = Math.log(5000);

  function wireSim(c) {
    const secs = c.root.querySelector('.dk-secs');
    secs.querySelectorAll('.dk-dial').forEach(d => {
      const k = d.dataset.k, list = SCALE[k], inp = d.querySelector('input');
      inp.max = list.length - 1;
      const shotV = k === 'comp' ? 0 : c.scene[k === 'N' ? 'f' : k];
      d.querySelector('.dk-shot').style.left = (S.idx(list, shotV === 0 ? 1e-9 : shotV) / (list.length - 1) * 100) + '%';
      if (k === 'comp') d.querySelector('.dk-shot').style.left = '50%';
      const set = i => { c.st[k] = list[clamp(i, 0, list.length - 1)]; clearTry(c); syncSim(c); };
      inp.addEventListener('input', () => { set(+inp.value); live(c); });
      d.querySelectorAll('.dk-step').forEach(b => b.addEventListener('click', () => { set(+inp.value + +b.dataset.step); render(c, false); }));
    });
    secs.querySelectorAll('[data-seg]').forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = seg.dataset.seg, v = b.dataset.v;
      if (k === 'mode') { const s = simState(c); c.st.N = s.N; c.st.t = s.t; c.st.mode = v; c.st.comp = v === 'M' ? 0 : Math.round(S.deltaEV(c.scene, s) * 3) / 3; c.st.comp = clamp(c.st.comp, -3, 3); }
      else if (k === 'tripod') c.st.tripod = v === '1';
      else if (k === 'nd') c.st.nd = +v;
      else if (k === 'pan') c.st.pan = v === '1';
      else c.st.sensor = v;
      clearTry(c); syncSim(c); render(c, false);
    }));
    const fo = secs.querySelector('[data-focus]');
    fo.addEventListener('input', () => {
      c.st.focus = Math.exp(FOCUS_LO + (+fo.value / 100) * (FOCUS_HI - FOCUS_LO));
      c.root.querySelector('.dk-reticle').hidden = true; c.focusPt = null;
      clearTry(c); syncSim(c); live(c);
    });
    const tryBox = secs.querySelector('.dk-try');
    tryBox.innerHTML = (c.scene.try || []).map((t, i) => `<button type="button" class="dk-chip" data-i="${i}" aria-pressed="false">${esc(t.label)}</button>`).join('')
      || '<p class="dk-hint">Mexe na abertura, no tempo e no ISO: a leitura acima diz o que cada escolha custa.</p>';
    tryBox.addEventListener('click', e => {
      const b = e.target.closest('.dk-chip'); if (!b) return;
      applyTry(c, c.scene.try[+b.dataset.i], b);
    });
    secs.querySelector('.dk-focus').hidden = !c.scene.depth;
    syncSim(c);
  }
  function clearTry(c) {
    c.root.querySelectorAll('.dk-try .dk-chip').forEach(b => b.setAttribute('aria-pressed', 'false'));
    const w = c.root.querySelector('.dk-try-why'); if (w) w.hidden = true;
  }
  function applyTry(c, t, btn) {
    const st = Object.assign(S.shotOf(c.scene), t.set, { mode: 'M', comp: 0 });
    if (t.set.sensor) st.sensor = t.set.sensor;
    if (t.balance) {                       // a câmara acerta a exposição na variável indicada
      const real = Object.assign({}, st, { sensor: st.sensor === 'own' ? c.scene.cls : st.sensor });
      const d = S.deltaEV(c.scene, real);
      if (t.balance === 't') st.t = S.nearest(S.SHUTTERS, st.t / Math.pow(2, d));
      else if (t.balance === 'N') st.N = S.nearest(S.APERTURES, st.N * Math.pow(2, d / 2));
      else st.iso = S.nearest(S.ISOS, st.iso / Math.pow(2, d));
    }
    if (st.sensor === (c.scene.cls || 'apsc')) st.sensor = 'own';
    c.st = st;
    c.root.querySelector('.dk-reticle').hidden = true; c.focusPt = null;
    clearTry(c);
    btn.setAttribute('aria-pressed', 'true');
    const w = c.root.querySelector('.dk-try-why'); w.textContent = t.why; w.hidden = false;
    syncSim(c); render(c, false);
  }

  function syncSim(c) {
    const root = c.root, sc = c.scene, st = simState(c);
    if (!c.st.sensor || c.st.sensor === (sc.cls || 'apsc')) c.st.sensor = 'own';
    const auto = c.st.mode === 'A' ? 't' : c.st.mode === 'S' ? 'N' : null;
    root.querySelectorAll('.dk-dial').forEach(d => {
      const k = d.dataset.k, list = SCALE[k], v = k === 'comp' ? c.st.comp : st[k];
      const inp = d.querySelector('input');
      inp.value = S.idx(list, v === 0 ? 1e-9 : v);
      if (k === 'comp') inp.value = COMP.findIndex(x => Math.abs(x - v) < 0.01);
      d.querySelector('.dk-dial-v').textContent = fmtK[k](v);
      const isAuto = k === auto;
      d.classList.toggle('is-auto', isAuto);
      d.querySelector('.dk-dial-auto').hidden = !isAuto;
      inp.disabled = isAuto; d.querySelectorAll('.dk-step').forEach(b => b.disabled = isAuto);
      if (k === 'comp') d.hidden = c.st.mode === 'M';
      const shotV = k === 'comp' ? 0 : sc[k === 'N' ? 'f' : k];
      d.classList.toggle('is-shot', k !== 'comp' && Math.abs(Math.log2(v / shotV)) < 0.05);
    });
    const segv = { mode: c.st.mode, tripod: c.st.tripod ? '1' : '0', nd: String(c.st.nd || 0), sensor: c.st.sensor, pan: c.st.pan ? '1' : '0' };
    root.querySelectorAll('[data-seg]').forEach(seg => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === segv[seg.dataset.seg])));
    root.querySelector('.dk-mode-n').textContent = { M: 'Manual: a exposição é o que escolheres.', A: 'Prioridade à abertura: a câmara acerta o tempo.', S: 'Prioridade ao obturador: a câmara acerta a abertura.' }[c.st.mode];
    const fo = root.querySelector('[data-focus]');
    fo.value = Math.round((Math.log(c.st.focus) - FOCUS_LO) / (FOCUS_HI - FOCUS_LO) * 100);
    root.querySelector('.dk-focus-v').textContent = S.fmtDist(c.st.focus);

    /* fotómetro e leitura do visor */
    const d = S.deltaEV(sc, st);
    const n = root.querySelector('.dk-meter-n');
    n.style.left = (clamp(d, -3, 3) + 3) / 6 * 100 + '%';
    n.dataset.out = Math.abs(d) > 3 ? (d > 0 ? 'hi' : 'lo') : '';
    const ad = Math.abs(d), stops = (Math.round(ad * 10) / 10).toString().replace('.', ',');
    root.querySelector('.dk-meter').dataset.tone = ad < 0.2 ? 'ok' : ad < 1.05 ? 'warn' : 'bad';
    root.querySelector('.dk-meter-t').textContent = ad < 0.2 ? 'A mesma exposição da fotografia original.'
      : `${stops} ${ad >= 1.95 ? 'stops' : 'stop'} ${d > 0 ? 'mais clara' : 'mais escura'} do que a original.`;
    const same = ad < 0.05 && Math.abs(Math.log2(st.N / sc.f)) < 0.05 && Math.abs(Math.log2(st.iso / sc.iso)) < 0.05 && st.nd === 0
      && st.tripod === !!sc.tripod && !st.pan && c.st.sensor === 'own' && Math.abs(Math.log(st.focus / (sc.focus || 20))) < 0.02;
    root.dataset.pristine = same ? '1' : '0';
    root.querySelector('.dk-hud-read').innerHTML =
      `<span class="${auto === 'N' ? 'is-auto' : ''}">${S.fmtAperture(st.N)}</span><span class="${auto === 't' ? 'is-auto' : ''}">${S.fmtShutter(st.t)}</span><span>ISO ${st.iso}</span>`
      + (st.nd ? `<span class="dk-hud-x">ND −${st.nd}</span>` : '')
      + `<span class="dk-hud-ev" data-tone="${ad < 0.2 ? 'ok' : ad < 1.05 ? 'warn' : 'bad'}">${S.fmtEV(d)}</span>`;
    c.simNow = st;
    syncReads(c);
  }

  /* ── leitura: o que cada escolha custa ── */
  function syncReads(c) {
    const ul = c.root.querySelector('.dk-reads'); if (!ul || !c.simNow) return;
    const sc = c.scene, st = c.simNow, cam = S.camera(sc, st), out = [];
    const row = (tone, icon, title, text, extra) => out.push(`<li class="dk-read" data-tone="${tone}">${I(icon)}<div><b>${title}</b><p>${text}</p>${extra || ''}</div></li>`);
    const d = S.deltaEV(sc, st), ad = Math.abs(d);
    const hi = c.hist ? c.hist.clipHigh : 0, lo = c.hist ? c.hist.clipLow : 0;

    if (ad < 0.2) row('ok', 'meter', 'Exposição', 'Igual à original.');
    else if (d > 0) row(ad < 1.05 ? 'warn' : 'bad', 'meter', 'Sobre-exposta', hi > 0.01 ? `${Math.round(hi * 100)}% da imagem queimou: essa informação não volta na edição.` : 'Mais clara do que a original; as altas luzes ainda aguentam.');
    else row(ad < 1.05 ? 'warn' : 'bad', 'meter', 'Subexposta', lo > 0.25 ? `${Math.round(lo * 100)}% da imagem fechou a preto.` : 'Mais escura do que a original. Recuperar na edição traz ruído nas sombras.');

    const lim = S.handheldLimit(sc, st);
    if (st.tripod) row('ok', 'tripod', 'Em tripé', st.t >= 1 ? `${S.fmtShutter(st.t)} sem tremer: só o que se move na cena fica arrastado.` : 'A câmara está parada; o tempo só conta para o que se mexe.');
    else if (st.t <= lim * 1.01) row('ok', 'hand', 'À mão, seguro', `${S.fmtShutter(st.t)} chega para ${cam.f35} mm eq. (limite ≈ ${S.fmtShutter(S.nearest(S.SHUTTERS, lim))}${cam.is ? `, com ${cam.is} stops de estabilização` : ''}).`);
    else if (st.t <= lim * 4) row('warn', 'hand', 'À mão, no limite', `Abaixo de ${S.fmtShutter(S.nearest(S.SHUTTERS, lim))} a ${cam.f35} mm eq. já há risco de tremido.`);
    else row('bad', 'hand', 'Tremida', `${S.fmtShutter(st.t)} à mão a ${cam.f35} mm eq.: precisas de tripé ou de ${S.fmtShutter(S.nearest(S.SHUTTERS, lim))} ou mais rápido.`);

    (sc.motion || []).forEach(m => {
      const frac = m.speed * st.t, pct = frac * 100;
      const shotPct = m.speed * sc.t * 100;
      const p = pct < 0.1 ? 'menos de 0,1' : pct < 10 ? (Math.round(pct * 10) / 10).toString().replace('.', ',') : Math.round(pct);
      const title = 'Movimento: ' + m.what;
      if (st.pan && m.mask === 'matte') row(pct < 0.2 ? 'ok' : 'info', 'wave', 'Panning: ' + m.what, pct < 0.2
        ? 'Acompanhas o sujeito, mas o tempo é tão curto que o fundo também fica parado.'
        : `Acompanhas o sujeito: ele fica nítido e é o fundo que percorre ${p}% do enquadramento.`);
      else if (pct < 0.2) row('ok', 'wave', title, `Percorre ${p}% do enquadramento durante a exposição: fica parado.`);
      else if (pct < 1.5) row('info', 'wave', title, `Percorre ${p}% do enquadramento: começa a arrastar.`);
      else row('info', 'wave', title, `Percorre ${p}% do enquadramento: ${m.silk ? 'vira seda' : 'vira traço'}.${st.t < sc.t && shotPct > 1.5 ? ' (O arrasto do original não se consegue apagar.)' : ''}`);
    });

    if (sc.depth) {
      const f = S.dof(sc, st);
      const farTxt = S.fmtDist(f.far);
      const flat = sc.depth.type === 'far' && !(sc.depth.objects || []).length && !sc.depth.subject;
      row('info', 'ruler', 'Profundidade de campo',
        flat ? `O motivo está todo longe: nítido de ${S.fmtDist(f.near)} ao infinito, a abertura quase não muda a nitidez.`
          : `Focado a ${S.fmtDist(st.focus)}: nítido de ${S.fmtDist(f.near)} a ${farTxt}. Hiperfocal: ${S.fmtDist(f.H)}.`,
        dofRuler(f, st.focus) + `<p class="dk-read-n">${cam.name} · focal real ${(Math.round(cam.f * 10) / 10).toString().replace('.', ',')} mm · ${S.fmtAperture(st.N)}</p>`);
    } else row('info', 'ruler', 'Profundidade de campo', 'Esta fotografia não tem modelo de profundidade: a abertura só muda a exposição e a difração.');

    const nz = S.noise(sc, st);
    if (st.iso < sc.iso && S.SENSORS[sc.cls || 'apsc'].noise * (Math.sqrt(sc.iso / 100) - 1) > 4) row('info', 'grain', 'Ruído', `A ISO ${st.iso} haveria menos ruído do que no original, mas a simulação não o consegue retirar.`);
    else if (nz < 4) row('ok', 'grain', 'Ruído', `ISO ${st.iso} neste sensor: limpo.`);
    else if (nz < 18) row('warn', 'grain', 'Ruído visível', `ISO ${st.iso} em ${cam.name === sc.camera ? 'este sensor' : cam.name}: nota-se primeiro nas sombras e nos céus lisos.`);
    else row('bad', 'grain', 'Ruído forte', `ISO ${st.iso}: o detalhe fino desaparece debaixo do grão.`);

    const df = S.diffraction(sc, st);
    if (df.soft) row('warn', 'aperture', 'Difração', `A ${S.fmtAperture(st.N)} o disco de difração já é maior do que o detalhe que este sensor resolve (a partir de ≈ ${S.fmtAperture(S.nearest(S.APERTURES, df.limitN))}): fechar mais tira nitidez em vez de a dar.`);
    ul.innerHTML = out.join('');
  }
  /* régua de DOF em escala logarítmica, 0,3 m … ∞ */
  function dofRuler(f, focus) {
    const X = m => clamp((Math.log(Math.min(m, 3000)) - Math.log(0.3)) / (Math.log(3000) - Math.log(0.3)), 0, 1) * 100;
    const a = X(f.near), b = isFinite(f.far) ? X(f.far) : 100;
    return `<div class="dk-ruler" aria-hidden="true"><i class="dk-ruler-band" style="left:${a}%;width:${Math.max(1.5, b - a)}%"></i><i class="dk-ruler-f" style="left:${X(focus)}%"></i>
      ${[[0.5, '0,5'], [1, '1'], [2, '2'], [5, '5'], [10, '10'], [30, '30'], [100, '100'], [3000, '∞']].map(([m, l]) => `<span style="left:${X(m)}%">${l}</span>`).join('')}</div>`;
  }

  /* ══ mesa de revelação ════════════════════════════════════════════ */
  function commit(c) { c.undo.push(JSON.stringify(c.p)); if (c.undo.length > 60) c.undo.shift(); c.redo = []; syncHistory(c); }
  function syncHistory(c) {
    const u = c.root.querySelector('[data-act="undo"]'), r = c.root.querySelector('[data-act="redo"]');
    if (u) u.disabled = !c.undo.length; if (r) r.disabled = !c.redo.length;
  }
  function saveDev(c) { if (c.scene && c.scene.id !== 'user') store.set('ph-dev-edit', { id: c.scene.id, p: c.p }); syncHistory(c); }

  function wireDev(c) {
    const secs = c.root.querySelector('.dk-secs'), left = c.root.querySelector('.dk-left');
    let armed = false;                                  // um gesto = uma entrada no histórico
    const arm = () => { if (!armed) { commit(c); armed = true; } };
    const disarm = () => { armed = false; saveDev(c); };
    secs.addEventListener('change', disarm);
    secs.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.p) { arm(); c.p[t.dataset.p] = +t.value; c.p.look = null; }
      else if (t.dataset.hsl) { arm(); c.p.hsl[c.band + t.dataset.hsl] = +t.value; }
      else if (t.dataset.gk) { arm(); c.p[t.closest('.dk-grad').dataset.g][t.dataset.gk] = +t.value; }
      else return;
      syncDev(c, true); live(c);
    });
    /* duplo clique num cursor: volta a zero */
    secs.addEventListener('dblclick', e => {
      const t = e.target.closest('input[type=range]'); if (!t) return;
      commit(c);
      if (t.dataset.p) c.p[t.dataset.p] = 0; else if (t.dataset.hsl) c.p.hsl[c.band + t.dataset.hsl] = 0; else if (t.dataset.gk === 'a') c.p[t.closest('.dk-grad').dataset.g].a = 0;
      syncDev(c); saveDev(c); render(c, false);
    });
    secs.addEventListener('click', e => {
      const b = e.target.closest('.dk-band'); if (b) { c.band = b.dataset.b; return syncDev(c); }
      const cp = e.target.closest('[data-curve-presets] .dk-chip');
      if (cp) { commit(c); c.p.curveY = CURVE_PRESETS[+cp.dataset.i][1].slice(); syncDev(c); saveDev(c); render(c, false); }
    });
    /* curva: arrastar pontos (só em altura; as pontas também) */
    const svg = secs.querySelector('.dk-curve-svg');
    let drag = -1;
    svg.addEventListener('pointerdown', e => {
      const p = e.target.closest('.dk-curve-pt'); if (!p) return;
      drag = +p.dataset.i; arm(); svg.setPointerCapture(e.pointerId); e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      if (drag < 0) return;
      const r = svg.getBoundingClientRect();
      c.p.curveY[drag] = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); c.p.look = null;
      syncDev(c, true); live(c);
    });
    const cend = () => { if (drag >= 0) { drag = -1; disarm(); } };
    svg.addEventListener('pointerup', cend); svg.addEventListener('pointercancel', cend);
    svg.addEventListener('keydown', e => {
      const p = e.target.closest('.dk-curve-pt'); if (!p) return;
      const dy = e.key === 'ArrowUp' ? 0.02 : e.key === 'ArrowDown' ? -0.02 : 0; if (!dy) return;
      e.preventDefault(); commit(c); const i = +p.dataset.i;
      c.p.curveY[i] = clamp(c.p.curveY[i] + dy, 0, 1); syncDev(c); saveDev(c); render(c, false);
    });
    /* estilos */
    left.addEventListener('click', e => {
      const b = e.target.closest('.dk-look'); if (!b) return;
      commit(c);
      const id = b.dataset.look, look = c.data.looks.find(l => l.id === id);
      const k = c.p.lookK;
      c.p = look ? lookToDev(look.recipe, k / 100) : devNeutral();
      c.p.look = id || null; c.p.lookK = k;
      syncDev(c); saveDev(c); render(c, false);
    });
    left.addEventListener('input', e => {
      if (!e.target.matches('[data-lookk]')) return;
      const k = +e.target.value, look = c.data.looks.find(l => l.id === c.p.look);
      arm();
      if (look) { c.p = lookToDev(look.recipe, k / 100); c.p.look = look.id; }
      c.p.lookK = k; syncDev(c, true); live(c);
    });
    left.addEventListener('change', e => { if (e.target.matches('[data-lookk]')) disarm(); });
  }

  function syncDev(c, light) {
    const root = c.root, p = c.p;
    root.querySelectorAll('[data-p]').forEach(i => {
      const v = p[i.dataset.p] || 0;
      if (+i.value !== v) i.value = v;
      const o = i.closest('.dk-sl').querySelector('.dk-sl-v');
      o.textContent = i.dataset.p === 'exposure' ? (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',') : (v > 0 ? '+' : '') + Math.round(v);
      i.closest('.dk-sl').classList.toggle('is-set', v !== 0);
    });
    /* curva */
    const pts = CURVE_X.map((x, i) => [x * 200, (1 - p.curveY[i]) * 200]);
    const lut = PhotoLab.curveLUT(CURVE_X.map((x, i) => [x, p.curveY[i]]));
    let dPath = '';
    for (let i = 0; i <= 64; i++) { const x = i / 64; dPath += (i ? 'L' : 'M') + (x * 200).toFixed(1) + ' ' + ((1 - lut[Math.round(x * 255)] / 255) * 200).toFixed(1); }
    root.querySelector('.dk-curve-line').setAttribute('d', dPath);
    root.querySelectorAll('.dk-curve-pt').forEach((el, i) => { el.setAttribute('cx', pts[i][0]); el.setAttribute('cy', pts[i][1]); el.setAttribute('aria-valuenow', Math.round(p.curveY[i] * 100)); });
    /* HSL */
    root.querySelectorAll('.dk-band').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.b === c.band);
      b.classList.toggle('is-set', ['Hue', 'Sat', 'Lum'].some(s => p.hsl[b.dataset.b + s]));
    });
    root.querySelector('.dk-band-n').textContent = HSL_BANDS.find(b => b[0] === c.band)[1];
    root.querySelectorAll('[data-hsl]').forEach(i => {
      const v = p.hsl[c.band + i.dataset.hsl] || 0; i.value = v;
      i.closest('.dk-sl').querySelector('.dk-sl-v').textContent = (v > 0 ? '+' : '') + v;
    });
    /* gradação */
    root.querySelectorAll('.dk-grad').forEach(g => {
      const v = p[g.dataset.g];
      g.querySelector('[data-gk="h"]').value = v.h; g.querySelector('[data-gk="a"]').value = v.a;
      const outs = g.querySelectorAll('.dk-sl-v'); outs[0].textContent = v.h + '°'; outs[1].textContent = v.a;
      g.querySelector('.dk-grad-sw').style.background = `hsl(${v.h} ${Math.min(90, 20 + v.a)}% 50%)`;
      g.querySelector('.dk-grad-sw').style.opacity = v.a ? 1 : .25;
    });
    /* marca nos grupos com alterações */
    const changed = {
      curva: p.curveY.some((y, i) => Math.abs(y - CURVE_X[i]) > 0.004), hsl: Object.keys(p.hsl).some(k => p.hsl[k]), grad: p.gs.a || p.gh.a,
    };
    DEV_GROUPS.forEach(g => {
      const on = g.ctl ? g.ctl.some(x => p[x[0]]) : changed[g.id];
      const dot = root.querySelector(`.dk-sec[data-sec="${g.id}"] .dk-dot`); if (dot) dot.hidden = !on;
    });
    root.dataset.pristine = DEV_GROUPS.some(g => g.ctl ? g.ctl.some(x => p[x[0]]) : changed[g.id]) ? '0' : '1';
    if (light) return;
    root.querySelectorAll('.dk-look').forEach(b => b.setAttribute('aria-pressed', (b.dataset.look || null) === (p.look || null)));
    const lk = root.querySelector('[data-lookk]');
    if (lk) { lk.value = p.lookK; lk.closest('.dk-sl').querySelector('.dk-sl-v').textContent = p.lookK + '%'; lk.disabled = !p.look; }
    syncHistory(c);
  }
  /* miniaturas dos estilos: a fotografia aberta passada por cada receita */
  function paintLooks(c) {
    if (!c.img) return;
    const base = document.createElement('canvas'); base.width = 132; base.height = 88;
    const bx = base.getContext('2d', { willReadFrequently: true });
    const iw = c.img.naturalWidth || c.img.width, ih = c.img.naturalHeight || c.img.height;
    const k = Math.max(132 / iw, 88 / ih), w = iw * k, h = ih * k;
    bx.drawImage(c.img, (132 - w) / 2, (88 - h) / 2, w, h);
    const src = bx.getImageData(0, 0, 132, 88);
    c.root.querySelectorAll('.dk-look').forEach(b => {
      const look = c.data.looks.find(l => l.id === b.dataset.look), cv = b.querySelector('canvas'), x = cv.getContext('2d');
      if (!look) return x.putImageData(src, 0, 0);
      const dst = x.createImageData(132, 88);
      PhotoLab.process(src, dst, PhotoLearn.scaleRecipe(look.recipe, 1));
      x.putImageData(dst, 0, 0);
    });
  }

  function restoreSecs(c) {
    const sv = c.prefs.sec || {};
    c.root.querySelectorAll('.dk-sec').forEach(s => {
      const k = c.mode + ':' + s.dataset.sec;
      const open = k in sv ? sv[k] : !(c.mode === 'dev' && ['hsl', 'grad', 'efeitos', 'fotos'].includes(s.dataset.sec));
      s.dataset.open = open ? '1' : '0'; s.querySelector('.dk-sec-h button').setAttribute('aria-expanded', open);
    });
  }

  /* ══ ficheiro do utilizador ═══════════════════════════════════════ */
  async function openFile(c, file) {
    if (!/^image\//.test(file.type)) return toast('Esse ficheiro não é uma imagem.');
    let ex = null, bmp;
    try {
      ex = PhExif.parse(await file.arrayBuffer());
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) { return toast('Não foi possível abrir essa imagem.'); }
    if (c.mode === 'sim' && !(ex && ex.fnumber && ex.exposure && ex.iso)) {
      toast('Esta fotografia não traz as definições de disparo (EXIF). Abre-a na mesa de revelação.');
      return;
    }
    /* reduzir para trabalhar (e exportar) a um tamanho razoável */
    const L = Math.min(Math.max(bmp.width, bmp.height), 2400), k = L / Math.max(bmp.width, bmp.height);
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    if (c.user && c.user.blob) URL.revokeObjectURL(c.user.blob);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    let cls = 'apsc'; try { cls = localStorage.getItem('ph-class') || 'apsc'; } catch (_) {}
    const f35 = ex && (ex.focal35 || (ex.focal ? Math.round(ex.focal * (S.SENSORS[cls] || S.SENSORS.apsc).crop) : null));
    c.user = {
      id: 'user', group: 'user', title: file.name.replace(/\.[^.]+$/, ''), bitmap: cv, blob: URL.createObjectURL(blob), src: null,
      camera: ex ? [ex.make, ex.model].filter(Boolean).join(' ').replace(/^(\w+) \1/i, '$1') : null, lens: ex && ex.lens, year: ex && ex.year,
      f: ex && ex.fnumber, t: ex && ex.exposure, iso: ex && ex.iso, focal35: f35, cls, depth: null,
      lesson: c.mode === 'sim' ? 'Fotografia tua, com as definições lidas do ficheiro. Sem modelo de profundidade, a simulação mostra exposição, tremido e ruído.' : '',
    };
    c.user.bitmap.naturalWidth = cv.width; c.user.bitmap.naturalHeight = cv.height;
    select(c, 'user');
    if (mobile()) setTab(c, c.mode === 'sim' ? 'camara' : 'luz');
  }

  /* ══ exportar ═════════════════════════════════════════════════════ */
  function exportJPEG(c, btn) {
    if (!c.img || c.exporting) return;
    c.exporting = true;
    if (btn) btn.classList.add('is-busy');
    const img = c.img, W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
    const cv = document.createElement('canvas'); cv.width = W0; cv.height = H0;
    const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const src = x.getImageData(0, 0, W0, H0);
    /* fora do caminho do render ao vivo: um worker só para a exportação */
    const w = new Worker('/photography/js/ph-lab-worker.js');
    const end = msg => { c.exporting = false; if (btn) btn.classList.remove('is-busy'); w.terminate(); if (msg) toast(msg); };
    w.onerror = () => end('A exportação falhou.');
    w.onmessage = e => {
      const m = e.data; if (m.error) return end('A exportação falhou.');
      x.putImageData(new ImageData(new Uint8ClampedArray(m.buf), m.w, m.h), 0, 0);
      cv.toBlob(b => {
        const a = document.createElement('a'), url = URL.createObjectURL(b);
        a.href = url; a.download = (c.scene.title || 'fotografia').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-revelada.jpg';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        end(`Exportada: ${W0} × ${H0} px, JPEG.`);
      }, 'image/jpeg', 0.92);
    };
    w.postMessage({ type: 'image', key: 'x', w: W0, h: H0, buf: src.data.buffer }, [src.data.buffer]);
    w.postMessage({ type: 'render', id: 1, gen: 0, key: 'x', mode: 'dev', params: devParams(c.p) });
  }

  function toast(msg) { if (typeof PhShell !== 'undefined') PhShell.toast(msg, 4200); }

  return { mount, unmount, leave, enter, loadData, _cur: () => cur };
})();
