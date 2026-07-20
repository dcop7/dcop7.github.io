/* ══════════════════════════════════════════════════════════════════════
   EditLab — componentes interativos da secção Edição.

   Cada demonstração carrega uma fotografia real para um canvas, guarda os
   píxeis originais e volta a processá-los a cada movimento do cursor com o
   PhotoLab. Nada é pré-renderizado: o que se vê é mesmo o ajuste a ser
   aplicado. É por isso que a comparação Saturação vs Vibrância convence —
   são os mesmos píxeis, tratados de duas maneiras.

   API:  EditLab.mount(hostEl, demo, imgSrc)   // demo = objeto "demo" do edit.json
         EditLab.TYPES                          // tipos suportados

   Requer PhotoLab (js/pages/photo-lab.js), carregado antes.
   ════════════════════════════════════════════════════════════════════ */
const EditLab = (function () {
  'use strict';

  const MAXW = 560;                 // largura de trabalho: nítido e rápido
  const fmt = (v, u) => (Math.round(v * 100) / 100) + (u || '');

  /* Carrega a imagem e devolve {canvas, ctx, src(ImageData), dst(ImageData)} */
  function prepare(imgSrc) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = Math.min(MAXW, img.naturalWidth);
        const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const src = ctx.getImageData(0, 0, w, h);
        const dst = ctx.createImageData(w, h);
        resolve({ canvas: c, ctx, src, dst, w, h });
      };
      img.onerror = reject;
      img.src = imgSrc;
    });
  }

  /* Pinta o resultado de `params` no canvas visível. */
  function render(state, params) {
    PhotoLab.process(state.src, state.dst, params);
    state.ctx.putImageData(state.dst, 0, 0);
  }

  /* Canvas visível + rótulo "antes/depois" opcional. */
  function stageHTML(cls) {
    return `<div class="el-stage ${cls || ''}"><canvas class="el-canvas"></canvas></div>`;
  }

  /* ── histograma ao vivo ────────────────────────────────────────────
     Encostado à demonstração: mostra o que o ajuste faz à distribuição
     tonal, que é onde o efeito se percebe antes de se ver na imagem. */
  function histoHTML() {
    return `<figure class="el-histo">
      <canvas class="el-histo-cv" width="256" height="74"></canvas>
      <figcaption><span class="el-histo-lo">pretos</span><span>histograma ao vivo</span><span class="el-histo-hi">brancos</span></figcaption>
    </figure>`;
  }
  function attachHisto(host, state) {
    const cv = host.querySelector('.el-histo-cv');
    if (!cv) return () => {};
    const ref = PhotoLab.histogram(state.src);
    return img => {
      PhotoLab.drawHistogram(cv, PhotoLab.histogram(img || state.dst), ref);
    };
  }

  /* ── lupa 1:1 ──────────────────────────────────────────────────────
     Nitidez, textura e ruído são invisíveis com a imagem ajustada ao ecrã.
     Sem um recorte a 100% estas ferramentas não se conseguem ensinar. */
  function loupeHTML() {
    return `<div class="el-loupe">
      <figure><canvas class="el-loupe-a" width="190" height="190"></canvas><figcaption>antes · 1:1</figcaption></figure>
      <figure><canvas class="el-loupe-b" width="190" height="190"></canvas><figcaption>depois · 1:1</figcaption></figure>
      <p class="el-loupe-hint">Passa o rato sobre a fotografia para mover a lupa.</p>
    </div>`;
  }
  function attachLoupe(host, state) {
    const a = host.querySelector('.el-loupe-a'), b = host.querySelector('.el-loupe-b');
    if (!a || !b) return () => {};
    const S = 190, ca = a.getContext('2d'), cb = b.getContext('2d');
    ca.imageSmoothingEnabled = cb.imageSmoothingEnabled = false;
    // ponto de partida: zona com detalhe (terço inferior esquerdo)
    let cx = Math.round(state.w * 0.3), cy = Math.round(state.h * 0.72);
    const tmp = document.createElement('canvas');
    tmp.width = state.w; tmp.height = state.h;
    const tctx = tmp.getContext('2d');
    const src = document.createElement('canvas');
    src.width = state.w; src.height = state.h;
    src.getContext('2d').putImageData(state.src, 0, 0);

    const paint = () => {
      const x = Math.max(0, Math.min(state.w - S / 2, cx - S / 4));
      const y = Math.max(0, Math.min(state.h - S / 2, cy - S / 4));
      ca.clearRect(0, 0, S, S); cb.clearRect(0, 0, S, S);
      ca.drawImage(src, x, y, S / 2, S / 2, 0, 0, S, S);
      tctx.putImageData(state.dst, 0, 0);
      cb.drawImage(tmp, x, y, S / 2, S / 2, 0, 0, S, S);
    };
    // Mapeia sobre o CANVAS, não sobre o palco: o palco pode ser mais alto ou
    // mais largo que a imagem (é ele que centra), e aí as coordenadas fugiam.
    const stage = host.querySelector('.el-stage');
    if (stage) stage.addEventListener('pointermove', e => {
      const cv = stage.querySelector('.el-canvas');
      const r = (cv || stage).getBoundingClientRect();
      cx = Math.max(0, Math.min(state.w, ((e.clientX - r.left) / r.width) * state.w));
      cy = Math.max(0, Math.min(state.h, ((e.clientY - r.top) / r.height) * state.h));
      paint();
    });
    return paint;
  }
  function rangeRow(id, label, min, max, step, val, unit) {
    return `<div class="el-row">
      <label class="el-lbl" for="${id}">${label}</label>
      <input class="el-range" id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}">
      <output class="el-val" for="${id}">${fmt(val, unit)}</output>
    </div>`;
  }

  /* ── 1. cursor único: um parâmetro, ao vivo ───────────────────────── */
  function mountSlider(host, demo, state) {
    const id = 'el-' + demo.param;
    const wantHisto = demo.histogram !== false;
    const wantLoupe = !!demo.loupe;
    // O cursor vive ao lado da imagem, não por baixo: quem está a aprender tem
    // de ver o ajuste e o efeito no mesmo golpe de vista, sem scroll.
    // Quando há lupa é ela que ocupa a coluna lateral (é o que ensina), por
    // isso os controlos acompanham a fotografia na coluna principal.
    const controls = `<div class="el-controls">
      ${rangeRow(id, demo.label || 'Ajuste', demo.min, demo.max, demo.step, 0, demo.unit)}
      ${demo.marks ? `<div class="el-marks">${demo.marks.map(m =>
        `<button class="el-chip" data-mark="${m.v}">${m.label}</button>`).join('')}</div>` : ''}
      <div class="el-actions">
        <button class="el-btn" data-reset>Repor</button>
        <button class="el-btn" data-hold>Ver original</button>
      </div>
    </div>`;
    host.innerHTML = `
      <div class="el-lab${wantLoupe ? ' has-loupe' : ''}">
        <div class="el-lab-main">${stageHTML()}${wantLoupe ? controls : ''}</div>
        <aside class="el-lab-side">
          ${wantHisto ? histoHTML() : ''}
          ${wantLoupe ? loupeHTML() : controls}
        </aside>
      </div>`;
    host.querySelector('.el-stage').appendChild(state.canvas);
    host.querySelector('.el-canvas').remove();
    const range = host.querySelector('.el-range'), out = host.querySelector('.el-val');
    const histo = wantHisto ? attachHisto(host, state) : () => {};
    const loupe = wantLoupe ? attachLoupe(host, state) : () => {};
    const draw = () => {
      const v = +range.value;
      out.textContent = fmt(v, demo.unit);
      render(state, { [demo.param]: v });
      histo(); loupe();
    };
    range.addEventListener('input', draw);
    host.querySelectorAll('[data-mark]').forEach(b => b.addEventListener('click', () => {
      range.value = b.dataset.mark; draw();
      host.querySelectorAll('[data-mark]').forEach(x => x.classList.toggle('active', x === b));
    }));
    host.querySelector('[data-reset]').addEventListener('click', () => {
      range.value = 0; draw();
      host.querySelectorAll('[data-mark]').forEach(x => x.classList.remove('active'));
    });
    const hold = host.querySelector('[data-hold]');
    const showOrig = () => { state.ctx.putImageData(state.src, 0, 0); histo(state.src); };
    ['pointerdown', 'touchstart'].forEach(e => hold.addEventListener(e, ev => { ev.preventDefault(); showOrig(); }));
    ['pointerup', 'pointerleave', 'touchend'].forEach(e => hold.addEventListener(e, draw));
    draw();
  }

  /* ── 2. comparação: o mesmo valor em dois parâmetros ──────────────── */
  function mountCompare(host, demo, state) {
    host.innerHTML = `
      <div class="el-compare">
        <figure class="el-cmp"><div class="el-stage" data-slot="orig"></div><figcaption>Original</figcaption></figure>
        ${demo.params.map((p, i) => `<figure class="el-cmp"><div class="el-stage" data-slot="${i}"></div>
          <figcaption>${p.label} <b>+${p.value}</b></figcaption></figure>`).join('')}
      </div>
      <div class="el-controls">
        ${rangeRow('el-cmp-amt', 'Intensidade nos dois', 0, 100, 1, demo.params[0].value)}
      </div>
      ${demo.note ? `<p class="el-note">${demo.note}</p>` : ''}`;
    const slots = {};
    host.querySelectorAll('[data-slot]').forEach(s => {
      const c = document.createElement('canvas');
      c.width = state.w; c.height = state.h; c.className = 'el-canvas';
      s.appendChild(c);
      slots[s.dataset.slot] = c.getContext('2d', { willReadFrequently: true });
    });
    slots.orig.putImageData(state.src, 0, 0);
    const range = host.querySelector('.el-range'), out = host.querySelector('.el-val');
    const draw = () => {
      const amt = +range.value;
      out.textContent = amt;
      demo.params.forEach((p, i) => {
        PhotoLab.process(state.src, state.dst, { [p.param]: amt });
        slots[i].putImageData(state.dst, 0, 0);
      });
      host.querySelectorAll('.el-cmp figcaption b').forEach(b => { b.textContent = '+' + amt; });
    };
    range.addEventListener('input', draw);
    draw();
  }

  /* ── 3. curva de tons interativa ──────────────────────────────────── */
  function mountCurve(host, demo, state) {
    host.innerHTML = `
      <div class="el-curve-wrap">
        <div class="el-curve-side">
          <canvas class="el-curve" width="240" height="240" aria-label="Curva de tons"></canvas>
          <div class="el-presets">${(demo.presets || []).map((p, i) =>
            `<button class="el-chip${i === 0 ? ' active' : ''}" data-preset="${p.id}">${p.name}</button>`).join('')}
            <button class="el-chip" data-preset="linear">Neutra</button></div>
        </div>
        <div class="el-curve-main">
          ${stageHTML()}
          ${histoHTML()}
          <p class="el-note" data-why></p>
        </div>
      </div>`;
    host.querySelector('.el-stage').appendChild(state.canvas);
    host.querySelector('.el-stage .el-canvas').remove();

    const cv = host.querySelector('.el-curve'), cx = cv.getContext('2d');
    const why = host.querySelector('[data-why]');
    const histo = attachHisto(host, state);
    const LINEAR = [[0, 0], [1, 1]];
    let pts = (demo.presets && demo.presets[0] ? demo.presets[0].points : LINEAR).map(p => p.slice());

    const px = v => 12 + v * (cv.width - 24);
    const py = v => cv.height - 12 - v * (cv.height - 24);
    const drawCurve = () => {
      const css = getComputedStyle(document.body);
      const grid = css.getPropertyValue('--border').trim() || '#334';
      const accent = css.getPropertyValue('--accent').trim() || '#6366f1';
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.strokeStyle = grid; cx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        cx.beginPath(); cx.moveTo(px(i / 4), py(0)); cx.lineTo(px(i / 4), py(1)); cx.stroke();
        cx.beginPath(); cx.moveTo(px(0), py(i / 4)); cx.lineTo(px(1), py(i / 4)); cx.stroke();
      }
      cx.setLineDash([3, 3]); cx.beginPath(); cx.moveTo(px(0), py(0)); cx.lineTo(px(1), py(1)); cx.stroke(); cx.setLineDash([]);
      const lut = PhotoLab.curveLUT(pts);
      cx.strokeStyle = accent; cx.lineWidth = 2.4; cx.beginPath();
      for (let i = 0; i < 256; i++) {
        const x = px(i / 255), y = py(lut[i] / 255);
        i ? cx.lineTo(x, y) : cx.moveTo(x, y);
      }
      cx.stroke();
      cx.fillStyle = accent;
      pts.forEach(p => { cx.beginPath(); cx.arc(px(p[0]), py(p[1]), 4.5, 0, 7); cx.fill(); });
      render(state, { curve: lut });
      histo();
    };
    host.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      host.querySelectorAll('[data-preset]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const pr = (demo.presets || []).find(p => p.id === b.dataset.preset);
      pts = (pr ? pr.points : LINEAR).map(p => p.slice());
      why.textContent = pr ? pr.why : 'Diagonal: a imagem fica exatamente como estava.';
      drawCurve();
    }));
    // arrastar pontos (excepto os das pontas, que só se movem na vertical)
    let drag = -1;
    const at = e => {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left - 12) / (cv.width - 24), 1 - (e.clientY - r.top - 12) / (cv.height - 24)];
    };
    cv.addEventListener('pointerdown', e => {
      const [x, y] = at(e);
      let best = -1, bd = 1e9;
      pts.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } });
      if (bd < 0.09) { drag = best; cv.setPointerCapture(e.pointerId); }
    });
    cv.addEventListener('pointermove', e => {
      if (drag < 0) return;
      const [x, y] = at(e);
      const p = pts[drag];
      if (drag > 0 && drag < pts.length - 1) {
        p[0] = Math.max(pts[drag - 1][0] + 0.02, Math.min(pts[drag + 1][0] - 0.02, x));
      }
      p[1] = Math.max(0, Math.min(1, y));
      drawCurve();
    });
    cv.addEventListener('pointerup', () => { drag = -1; });
    why.textContent = (demo.presets && demo.presets[0]) ? demo.presets[0].why : '';
    drawCurve();
  }

  /* ── 4. HSL por banda de cor ──────────────────────────────────────── */
  function mountHSL(host, demo, state) {
    const bands = [
      { id: 'red', name: 'Vermelho', c: '#ef4444' }, { id: 'orange', name: 'Laranja', c: '#f97316' },
      { id: 'yellow', name: 'Amarelo', c: '#eab308' }, { id: 'green', name: 'Verde', c: '#22c55e' },
      { id: 'aqua', name: 'Ciano', c: '#06b6d4' }, { id: 'blue', name: 'Azul', c: '#3b82f6' },
      { id: 'purple', name: 'Roxo', c: '#8b5cf6' }, { id: 'magenta', name: 'Magenta', c: '#ec4899' },
    ];
    let band = 'blue';
    const vals = {};
    host.innerHTML = `
      <div class="el-lab"><div class="el-lab-main">${stageHTML()}${histoHTML()}</div>
        <aside class="el-lab-side">
          <div class="el-bands">${bands.map(b => `<button class="el-band${b.id === band ? ' active' : ''}" data-band="${b.id}"
            style="--bc:${b.c}" title="${b.name}"><span></span>${b.name}</button>`).join('')}</div>
          <div class="el-controls">
            ${rangeRow('el-h', 'Matiz', -40, 40, 1, 0)}
            ${rangeRow('el-s', 'Saturação', -100, 100, 1, 0)}
            ${rangeRow('el-l', 'Luminância', -100, 100, 1, 0)}
            <div class="el-actions"><button class="el-btn" data-reset>Repor tudo</button></div>
          </div>
          <p class="el-note">Escolhe uma cor e mexe só nela: o resto da imagem fica intacto. É isto que distingue o HSL da saturação global.</p>
        </aside></div>`;
    host.querySelector('.el-stage').appendChild(state.canvas);
    host.querySelector('.el-stage .el-canvas').remove();
    const histo = attachHisto(host, state);
    const [rh, rs, rl] = ['el-h', 'el-s', 'el-l'].map(i => host.querySelector('#' + i));
    const outs = host.querySelectorAll('.el-val');
    const draw = () => {
      vals[band] = { h: +rh.value, s: +rs.value, l: +rl.value };
      outs[0].textContent = rh.value; outs[1].textContent = rs.value; outs[2].textContent = rl.value;
      const hsl = {};
      Object.keys(vals).forEach(b => {
        hsl[b + 'Hue'] = vals[b].h; hsl[b + 'Sat'] = vals[b].s; hsl[b + 'Lum'] = vals[b].l;
      });
      render(state, { hsl });
      histo();
    };
    [rh, rs, rl].forEach(r => r.addEventListener('input', draw));
    host.querySelectorAll('[data-band]').forEach(b => b.addEventListener('click', () => {
      band = b.dataset.band;
      host.querySelectorAll('[data-band]').forEach(x => x.classList.toggle('active', x === b));
      const v = vals[band] || { h: 0, s: 0, l: 0 };
      rh.value = v.h; rs.value = v.s; rl.value = v.l;
      draw();
    }));
    host.querySelector('[data-reset]').addEventListener('click', () => {
      Object.keys(vals).forEach(k => delete vals[k]);
      rh.value = rs.value = rl.value = 0; draw();
    });
    draw();
  }

  /* ── 5. máscaras: mostra a seleção e o ajuste só lá dentro ────────── */
  function maskField(shape, w, h) {
    const m = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        if (shape === 'linear') {
          v = 1 - Math.min(1, Math.max(0, (y / h - 0.18) / 0.42));       // forte em cima
        } else if (shape === 'radial') {
          const dx = (x / w - 0.5) / 0.34, dy = (y / h - 0.55) / 0.42;
          v = Math.max(0, 1 - Math.pow(dx * dx + dy * dy, 0.7));
        } else { // "sky": tudo o que é claro e está na metade de cima
          v = 1 - Math.min(1, Math.max(0, (y / h - 0.1) / 0.5));
        }
        m[y * w + x] = v;
      }
    }
    return m;
  }
  function mountMask(host, demo, state) {
    host.innerHTML = `
      <div class="el-lab"><div class="el-lab-main">${stageHTML()}</div>
        <aside class="el-lab-side">
          <div class="el-controls">
            ${rangeRow('el-mk', 'Intensidade', 0, 100, 1, 100, '%')}
            <div class="el-actions">
              <label class="el-check"><input type="checkbox" data-showmask> Ver a máscara</label>
              <button class="el-btn" data-hold>Comparar</button>
            </div>
          </div>
          <p class="el-note">A vermelho está a zona selecionada. O ajuste só acontece lá dentro — e desvanece-se nas bordas, que é o que o torna invisível.</p>
        </aside></div>`;
    host.querySelector('.el-stage').appendChild(state.canvas);
    host.querySelector('.el-stage .el-canvas').remove();
    const field = maskField(demo.shape, state.w, state.h);
    const range = host.querySelector('.el-range'), out = host.querySelector('.el-val');
    const chk = host.querySelector('[data-showmask]');
    const full = state.ctx.createImageData(state.w, state.h);

    const draw = () => {
      const k = +range.value / 100;
      out.textContent = range.value + '%';
      const scaled = {};
      Object.keys(demo.params).forEach(p => { scaled[p] = demo.params[p] * k; });
      PhotoLab.process(state.src, full, scaled);
      const S = state.src.data, F = full.data, D = state.dst.data;
      for (let i = 0, px = 0; i < S.length; i += 4, px++) {
        const m = field[px];
        D[i] = S[i] + (F[i] - S[i]) * m;
        D[i + 1] = S[i + 1] + (F[i + 1] - S[i + 1]) * m;
        D[i + 2] = S[i + 2] + (F[i + 2] - S[i + 2]) * m;
        D[i + 3] = 255;
        if (chk.checked) { D[i] = D[i] * (1 - m * 0.55) + 255 * m * 0.55; D[i + 1] *= (1 - m * 0.5); D[i + 2] *= (1 - m * 0.5); }
      }
      state.ctx.putImageData(state.dst, 0, 0);
    };
    range.addEventListener('input', draw);
    chk.addEventListener('change', draw);
    const hold = host.querySelector('[data-hold]');
    ['pointerdown', 'touchstart'].forEach(e => hold.addEventListener(e, ev => { ev.preventDefault(); state.ctx.putImageData(state.src, 0, 0); }));
    ['pointerup', 'pointerleave', 'touchend'].forEach(e => hold.addEventListener(e, draw));
    draw();
  }

  /* ── 6. ruído: simula ISO e depois reduz ──────────────────────────── */
  function mountNoise(host, demo, state) {
    host.innerHTML = `
      <div class="el-lab has-loupe"><div class="el-lab-main">${stageHTML()}
          <div class="el-controls">
            ${rangeRow('el-iso', 'Ruído (ISO alto)', 0, 100, 1, 55)}
            ${rangeRow('el-dn', 'Redução de ruído', 0, 100, 1, 0)}
            ${rangeRow('el-sh', 'Nitidez depois', 0, 100, 1, 0)}
          </div>
        </div>
        <aside class="el-lab-side">${loupeHTML()}
          <p class="el-note">Sobe o ruído, depois reduz. Repara no ponto em que o grão desaparece mas a textura também — é aí o limite útil. Experimenta afiar ANTES de reduzir: vais ver o ruído a ser afiado.</p>
        </aside></div>`;
    host.querySelector('.el-stage').appendChild(state.canvas);
    host.querySelector('.el-stage .el-canvas').remove();
    const rs = host.querySelectorAll('.el-range'), outs = host.querySelectorAll('.el-val');
    // O ruído é gerado uma vez e fixado, senão cintila a cada movimento.
    let noisy = state.ctx.createImageData(state.w, state.h), lastISO = -1;
    const loupe = attachLoupe(host, state);
    const draw = () => {
      const iso = +rs[0].value, dn = +rs[1].value, sh = +rs[2].value;
      outs[0].textContent = iso; outs[1].textContent = dn; outs[2].textContent = sh;
      if (iso !== lastISO) { PhotoLab.process(state.src, noisy, { noise: iso }); lastISO = iso; }
      PhotoLab.process(noisy, state.dst, { denoise: dn, sharpen: sh });
      state.ctx.putImageData(state.dst, 0, 0);
      loupe();
    };
    rs.forEach(r => r.addEventListener('input', draw));
    draw();
  }

  /* ── 7. gradação de cor: sombras e altas luzes ────────────────────── */
  function mountGrading(host, demo, state) {
    const PRE = [
      { id: 'teal', name: 'Teal & Orange', s: [-0.45, 0.05, 0.55], h: [0.5, 0.12, -0.35] },
      { id: 'warm', name: 'Quente', s: [0.15, 0.02, -0.2], h: [0.45, 0.15, -0.3] },
      { id: 'cold', name: 'Frio', s: [-0.35, -0.05, 0.45], h: [-0.15, 0.0, 0.3] },
      { id: 'film', name: 'Film verde', s: [-0.2, 0.3, -0.1], h: [0.25, 0.1, -0.15] },
      { id: 'none', name: 'Nenhum', s: [0, 0, 0], h: [0, 0, 0] },
    ];
    let cur = PRE[0];
    host.innerHTML = `
      <div class="el-lab"><div class="el-lab-main">${stageHTML()}</div>
        <aside class="el-lab-side">
          ${histoHTML()}
          <div class="el-presets">${PRE.map((p, i) => `<button class="el-chip${i === 0 ? ' active' : ''}" data-g="${p.id}">${p.name}</button>`).join('')}</div>
          <div class="el-controls">${rangeRow('el-gi', 'Intensidade', 0, 100, 1, 70, '%')}</div>
          <p class="el-note">Sombras e altas luzes recebem cores diferentes — é isto que dá identidade a uma série. Nota como perde o efeito acima dos 70%.</p>
        </aside></div>`;
    host.querySelector('.el-stage').appendChild(state.canvas);
    host.querySelector('.el-stage .el-canvas').remove();
    const histo = attachHisto(host, state);
    const range = host.querySelector('.el-range'), out = host.querySelector('.el-val');
    const draw = () => {
      const k = +range.value / 100;
      out.textContent = range.value + '%';
      render(state, { splitShadow: cur.s.map(v => v * k), splitHigh: cur.h.map(v => v * k) });
      histo();
    };
    host.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
      host.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('active', x === b));
      cur = PRE.find(p => p.id === b.dataset.g); draw();
    }));
    range.addEventListener('input', draw);
    draw();
  }

  const MOUNTS = {
    slider: mountSlider, compare: mountCompare, curve: mountCurve,
    hsl: mountHSL, mask: mountMask, noise: mountNoise, grading: mountGrading,
  };

  /* Antes/depois compacto para o resumo "em 20 segundos". Usa uma cópia
     pequena da imagem: é só para dar a ideia, não para inspecionar. */
  let _thumbP = null;
  function thumbState(imgSrc) {
    if (_thumbP) return _thumbP;
    _thumbP = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const w = 220, h = Math.round(img.naturalHeight * (w / img.naturalWidth));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        res({ src: ctx.getImageData(0, 0, w, h), w, h });
      };
      img.onerror = rej; img.src = imgSrc;
    }).catch(() => null);
    return _thumbP;
  }
  function beforeAfter(host, vis) {
    return thumbState(host.closest('[data-demo-img]')?.dataset.demoImg || EditLab._img).then(st => {
      if (!st) return false;
      const mk = (params, cap, cls) => {
        const c = document.createElement('canvas');
        c.width = st.w; c.height = st.h;
        const ctx = c.getContext('2d');
        if (params) {
          const out = ctx.createImageData(st.w, st.h);
          PhotoLab.process(st.src, out, params);
          ctx.putImageData(out, 0, 0);
        } else ctx.putImageData(st.src, 0, 0);
        const f = document.createElement('figure');
        f.className = 'ph-qv ' + cls;
        f.appendChild(c);
        const fc = document.createElement('figcaption'); fc.textContent = cap;
        f.appendChild(fc);
        return f;
      };
      host.innerHTML = '';
      host.appendChild(mk(null, 'antes', 'a'));
      const label = (vis.value > 0 ? '+' : '') + vis.value;
      host.appendChild(mk({ [vis.param]: vis.value }, `${vis.param} ${label}`, 'b'));
      return true;
    });
  }

  function mount(host, demo, imgSrc) {
    EditLab._img = imgSrc;
    if (!host || !demo || !MOUNTS[demo.type]) return Promise.resolve(false);
    if (typeof PhotoLab === 'undefined') return Promise.resolve(false);
    host.innerHTML = `<p class="el-loading">A preparar a demonstração…</p>`;
    return prepare(imgSrc).then(state => {
      state.canvas.className = 'el-canvas';
      MOUNTS[demo.type](host, demo, state);
      return true;
    }).catch(() => {
      host.innerHTML = `<p class="el-loading">Demonstração indisponível (a imagem de exemplo não carregou).</p>`;
      return false;
    });
  }

  return { mount, beforeAfter, TYPES: Object.keys(MOUNTS), _img: null };
})();
