/* ══════════════════════════════════════════════════════════════════════
   PhotoIllus — biblioteca de ilustrações procedurais para a Fotografia.

   Cada conceito de "Aprender" ganha uma ilustração SVG inline, consistente
   e legível (linguagem visual azul / ciano / dourado, dark-first). São
   desenhadas por código — sem assets externos — por isso funcionam offline
   e são o *fallback* quando ainda não existe um asset foto-realista.

   API:
     PhotoIllus.svg(id)                 → string SVG do conceito (ou '')
     PhotoIllus.has(id)                 → bool
     PhotoIllus.visual(id, {asset,alt}) → HTML: <img> foto-real (se asset)
                                          com fallback ao SVG, senão o SVG
     PhotoIllus.wire(rootEl)            → liga os onerror de fallback

   O asset foto-real (opcional, gerado localmente via ComfyUI — ver
   tools/photogen) nunca é obrigatório: se faltar, mostra-se o SVG.
   ════════════════════════════════════════════════════════════════════ */
const PhotoIllus = (function () {
  'use strict';

  // Paleta fixa — lê bem sobre "fotografias" escuras em tema claro e escuro.
  const C = {
    blue: '#3b82f6', cyan: '#22d3ee', gold: '#f5b74a',
    good: '#34d399', bad: '#f87171', ink: '#eaf1fb',
    line: 'rgba(255,255,255,.6)', dim: 'rgba(255,255,255,.32)',
  };

  let _uid = 0;
  const uid = p => `${p}${(++_uid).toString(36)}`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── primitivas de cena ────────────────────────────────────────────
  // Rótulo em pílula (canto da ilustração ou anotação).
  function tag(x, y, txt, opt = {}) {
    const w = (opt.w != null) ? opt.w : (String(txt).length * 5.4 + 12);
    const h = opt.h || 15, anchor = opt.anchor || 'start';
    const rx = x - (anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0);
    const bg = opt.bg || 'rgba(6,12,22,.72)';
    const fg = opt.fg || C.ink;
    return `<g>
      <rect x="${rx}" y="${y - h + 3}" width="${w}" height="${h}" rx="4" fill="${bg}"/>
      <text x="${anchor === 'end' ? x - 6 : anchor === 'middle' ? x : x + 6}" y="${y - 2}"
        text-anchor="${anchor === 'middle' ? 'middle' : anchor === 'end' ? 'end' : 'start'}"
        font-family="var(--font-sans, sans-serif)" font-size="9" font-weight="700" fill="${fg}">${esc(txt)}</text>
    </g>`;
  }

  function arrow(x1, y1, x2, y2, col = C.gold, wgt = 2) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 7;
    const hx = x2 - L * Math.cos(a), hy = y2 - L * Math.sin(a), s = L * 0.5;
    return `<g stroke="${col}" stroke-width="${wgt}" fill="none" stroke-linecap="round">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <path d="M${x2} ${y2} L${(hx - s * Math.sin(a)).toFixed(1)} ${(hy + s * Math.cos(a)).toFixed(1)} M${x2} ${y2} L${(hx + s * Math.sin(a)).toFixed(1)} ${(hy - s * Math.cos(a)).toFixed(1)}"/>
    </g>`;
  }

  // Cena base estilizada (paisagem com sol, colinas e um sujeito).
  // Reutilizada por exposição, DOF, focal, movimento, medição, etc.
  // opts: { expose:0..2 (1=correto), blurBg:bool, sun:bool, subject:'person'|'tree'|'none' }
  function scene(w, h, opts = {}) {
    const g = uid('sky'), fb = uid('blur');
    const sunX = w * 0.72, sunY = h * 0.26, sunR = Math.min(w, h) * 0.09;
    const horizon = h * 0.62;
    const subj = opts.subject === undefined ? 'person' : opts.subject;
    const blur = opts.blurBg ? ` filter="url(#${fb})"` : '';
    const expose = opts.expose == null ? 1 : opts.expose;

    const bgFar = `
      ${opts.sun === false ? '' : `<circle cx="${sunX}" cy="${sunY}" r="${sunR * 2.4}" fill="url(#${g}glow)"/>
      <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="#ffd98a"/>`}
      <path d="M0 ${horizon} Q${w * 0.28} ${horizon - h * 0.13} ${w * 0.5} ${horizon - h * 0.04} T${w} ${horizon - h * 0.02} V${h} H0 Z" fill="#14304a"/>
      <path d="M0 ${horizon + h * 0.06} Q${w * 0.4} ${horizon - h * 0.04} ${w * 0.7} ${horizon + h * 0.05} T${w} ${horizon + h * 0.04} V${h} H0 Z" fill="#0e2136"/>`;

    let subject = '';
    if (subj === 'person') {
      const px = w * 0.3, base = h * 0.9, ph = h * 0.42;
      subject = `<g fill="#050b14">
        <circle cx="${px}" cy="${base - ph}" r="${ph * 0.15}"/>
        <path d="M${px - ph * 0.12} ${base - ph * 0.82} Q${px} ${base - ph * 0.95} ${px + ph * 0.12} ${base - ph * 0.82}
          L${px + ph * 0.16} ${base - ph * 0.32} L${px + ph * 0.1} ${base} L${px} ${base - ph * 0.35}
          L${px - ph * 0.1} ${base} L${px - ph * 0.16} ${base - ph * 0.32} Z"/></g>`;
    } else if (subj === 'tree') {
      const px = w * 0.32, base = h * 0.92, th = h * 0.5;
      subject = `<g fill="#050b14">
        <rect x="${px - 2}" y="${base - th * 0.4}" width="4" height="${th * 0.4}"/>
        <circle cx="${px}" cy="${base - th * 0.55}" r="${th * 0.28}"/>
        <circle cx="${px - th * 0.16}" cy="${base - th * 0.42}" r="${th * 0.2}"/>
        <circle cx="${px + th * 0.16}" cy="${base - th * 0.44}" r="${th * 0.21}"/></g>`;
    }

    const overlay = expose < 1
      ? `<rect x="0" y="0" width="${w}" height="${h}" fill="#03060c" opacity="${(1 - expose) * 0.62}"/>`
      : expose > 1
        ? `<rect x="0" y="0" width="${w}" height="${h}" fill="#fff" opacity="${(expose - 1) * 0.5}"/>`
        : '';

    return `<defs>
        <linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0c2a49"/><stop offset=".55" stop-color="#1d5279"/><stop offset="1" stop-color="#e79a5c"/>
        </linearGradient>
        <radialGradient id="${g}glow"><stop offset="0" stop-color="#ffe6ad" stop-opacity=".9"/><stop offset="1" stop-color="#ffe6ad" stop-opacity="0"/></radialGradient>
        ${opts.blurBg ? `<filter id="${fb}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${opts.blurBg === true ? 3.4 : opts.blurBg}"/></filter>` : ''}
      </defs>
      <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${g})"/>
      <g${blur}>${bgFar}</g>
      ${subject}
      ${overlay}`;
  }

  // Painel (svg aninhado → recorta e cria coordenadas locais 0..w).
  const panel = (x, w, h, inner, y = 0) =>
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

  // Grelha de terços (overlay pedagógico).
  const thirds = (w, h, col = C.cyan) => `<g stroke="${col}" stroke-width="1" opacity=".85">
    <line x1="${w / 3}" y1="0" x2="${w / 3}" y2="${h}"/><line x1="${2 * w / 3}" y1="0" x2="${2 * w / 3}" y2="${h}"/>
    <line x1="0" y1="${h / 3}" x2="${w}" y2="${h / 3}"/><line x1="0" y1="${2 * h / 3}" x2="${w}" y2="${2 * h / 3}"/></g>`;

  // ── conceitos ─────────────────────────────────────────────────────
  const ART = {};

  // Exposição — escuro / correto / claro (mesma cena, brilho diferente)
  ART.exposicao = () => {
    const W = 420, H = 200, gap = 6, pw = (W - gap * 2) / 3;
    const cell = (i, ex, lbl, col) => panel(i * (pw + gap), pw, H,
      `${scene(pw, H, { expose: ex })}${tag(pw / 2, H - 8, lbl, { anchor: 'middle', fg: col })}`);
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Sub, correta e sobre-exposição">
      ${cell(0, 0.45, 'Subexposta', C.bad)}${cell(1, 1, 'Correta', C.good)}${cell(2, 1.7, 'Sobre-exposta', C.bad)}</svg>`;
  };

  // Histograma — 4 estados clássicos
  ART.histograma = () => {
    const W = 420, H = 200, gap = 8, pw = (W - gap * 3) / 4;
    // gera barras a partir de uma função de distribuição
    const hist = (fn, clipLo, clipHi) => {
      const n = 34, bars = [];
      for (let i = 0; i < n; i++) {
        const v = Math.max(0.02, Math.min(1, fn(i / (n - 1))));
        bars.push(`<rect x="${(i * pw / n).toFixed(1)}" y="${(H - 34 - v * (H - 74)).toFixed(1)}" width="${(pw / n - 1).toFixed(1)}" height="${(v * (H - 74)).toFixed(1)}" rx="1" fill="${C.cyan}" opacity=".9"/>`);
      }
      const marks = (clipLo ? `<rect x="0" y="30" width="7" height="${H - 64}" fill="${C.bad}" opacity=".5"/>` : '')
        + (clipHi ? `<rect x="${pw - 7}" y="30" width="7" height="${H - 64}" fill="${C.bad}" opacity=".5"/>` : '');
      // barra tonal por baixo
      const bar = `<defs><linearGradient id="${uid('tb')}h${clipLo}${clipHi}"></linearGradient></defs>`;
      return `<rect x="0" y="0" width="${pw}" height="${H}" rx="6" fill="#0a1524"/>${bars.join('')}${marks}
        <rect x="0" y="${H - 26}" width="${pw}" height="10" fill="url(#gtone)"/>`;
    };
    const gauss = (c, s) => x => Math.exp(-((x - c) ** 2) / (2 * s * s));
    const cell = (i, fn, lo, hi, lbl, col) => panel(i * (pw + gap), pw, H,
      `${hist(fn, lo, hi)}${tag(pw / 2, H - 4, lbl, { anchor: 'middle', fg: col, w: pw - 6 })}`);
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Estados de histograma">
      <defs><linearGradient id="gtone" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
      ${cell(0, gauss(0.5, 0.2), 0, 0, 'Equilibrado', C.good)}
      ${cell(1, x => gauss(0.12, 0.13)(x) + 0.25, 1, 0, 'Sombras cortadas', C.bad)}
      ${cell(2, x => gauss(0.9, 0.14)(x) + 0.22, 0, 1, 'Realces queimados', C.bad)}
      ${cell(3, gauss(0.72, 0.22), 0, 0, 'ETTR (à direita)', C.gold)}</svg>`;
  };

  // Distância focal — mesmo sujeito, ângulos de visão diferentes
  ART['focal-crop'] = () => {
    const W = 420, H = 210;
    const boxes = [[24, 0.92, C.cyan], [50, 0.55, C.gold], [135, 0.24, C.good]];
    let inner = `${scene(W, H, { subject: 'person', sun: true })}`;
    inner += boxes.map(([mm, f, col]) => {
      const bw = W * f, bh = H * f, bx = W * 0.3 - bw * 0.3, by = H * 0.9 - bh * 0.86;
      return `<rect x="${bx.toFixed(0)}" y="${by.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" rx="3"
        fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="6 4"/>
        ${tag(bx + 5, by + 16, mm + 'mm', { fg: col })}`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Comparação de distâncias focais">${inner}
      ${tag(W - 6, H - 8, 'mais mm = campo mais estreito', { anchor: 'end', fg: C.ink })}</svg>`;
  };

  // Abertura & profundidade de campo — f/1.8 vs f/5.6 vs f/16
  ART['abertura-dof'] = () => {
    const W = 420, H = 200, gap = 6, pw = (W - gap * 2) / 3;
    // fundo = fila de "árvores" (círculos) que desfoca conforme a abertura
    const dots = blur => {
      const d = [];
      for (let i = 0; i < 6; i++) {
        const x = pw * (0.16 + i * 0.14), y = H * 0.52 + (i % 2) * 6, r = 9 - i;
        d.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${Math.max(3, r)}" fill="#0a1a2c"/>`);
      }
      return `<g${blur ? ` filter="url(#dofb${blur})"` : ''}>${d.join('')}</g>`;
    };
    const iris = (x, y, r, f) => {
      // hexágono de lâminas — maior = mais aberto
      const pts = [];
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; pts.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`); }
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="${C.gold}" stroke-width="1.6"/>
        <circle cx="${x}" cy="${y}" r="${r * (f / 16)}" fill="${C.gold}" opacity=".28"/>`;
    };
    const cell = (i, f, blur, col) => {
      const px = pw * 0.32, base = H * 0.86, ph = H * 0.4;
      const person = `<g fill="#040a12"><circle cx="${px}" cy="${base - ph}" r="${ph * 0.16}"/>
        <path d="M${px - ph * 0.13} ${base - ph * 0.78} Q${px} ${base - ph * 0.92} ${px + ph * 0.13} ${base - ph * 0.78} L${px + ph * 0.16} ${base} L${px - ph * 0.16} ${base} Z"/></g>`;
      return panel(i * (pw + gap), pw, H,
        `<rect width="${pw}" height="${H}" rx="6" fill="url(#dofsky)"/>${dots(blur)}${person}${iris(pw - 22, 22, 13, f)}
         ${tag(pw / 2, H - 6, 'f/' + f, { anchor: 'middle', fg: col })}`);
    };
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Abertura e profundidade de campo">
      <defs>
        <linearGradient id="dofsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#123353"/><stop offset="1" stop-color="#1f4a2f"/></linearGradient>
        <filter id="dofb5"><feGaussianBlur stdDeviation="5"/></filter><filter id="dofb2"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      ${cell(0, 1.8, 5, C.cyan)}${cell(1, 5.6, 2, C.gold)}${cell(2, 16, 0, C.good)}</svg>`;
  };

  // Velocidade & movimento — congelar / motion blur / longa exp / panning
  ART.velocidade = () => {
    const W = 420, H = 200, gap = 6, pw = (W - gap) / 2, ph = (H - gap) / 2;
    const car = (x, y, s, col, ghost) => {
      let g = '';
      if (ghost) for (let k = 1; k <= 3; k++) g += `<g opacity="${0.14 * (4 - k)}"><rect x="${x - k * 9 * s}" y="${y}" width="${26 * s}" height="${11 * s}" rx="3" fill="${col}"/></g>`;
      return g + `<rect x="${x}" y="${y}" width="${26 * s}" height="${11 * s}" rx="3" fill="${col}"/>
        <circle cx="${x + 6 * s}" cy="${y + 11 * s}" r="${3 * s}" fill="#081018"/><circle cx="${x + 20 * s}" cy="${y + 11 * s}" r="${3 * s}" fill="#081018"/>`;
    };
    const streaks = (n, col, o) => { let s = ''; for (let i = 0; i < n; i++) { const y = 20 + i * (ph - 40) / n; s += `<line x1="6" y1="${y}" x2="${pw - 6}" y2="${y}" stroke="${col}" stroke-width="2" opacity="${o}"/>`; } return s; };
    const bg = `<rect width="${pw}" height="${ph}" rx="6" fill="#0c1c30"/>`;
    const freeze = panel(0, pw, ph, `${bg}${car(pw * 0.36, ph * 0.5, 1.5, C.cyan, 0)}${tag(pw / 2, ph - 6, 'Congelar 1/1000s', { anchor: 'middle', fg: C.good })}`);
    const mblur = panel(pw + gap, pw, ph, `${bg}${car(pw * 0.5, ph * 0.5, 1.5, C.gold, 1)}${tag(pw / 2, ph - 6, 'Motion blur 1/30s', { anchor: 'middle', fg: C.gold })}`);
    const longe = panel(0, pw, ph, `<rect width="${pw}" height="${ph}" rx="6" fill="#0a1424"/>${streaks(7, C.cyan, .5)}<path d="M0 ${ph * 0.62} Q${pw / 2} ${ph * 0.5} ${pw} ${ph * 0.62} V${ph} H0 Z" fill="#123a4d" opacity=".7"/>${tag(pw / 2, ph - 6, 'Longa exposição', { anchor: 'middle', fg: C.cyan })}`, ph + gap);
    const pan = panel(pw + gap, pw, ph, `<rect width="${pw}" height="${ph}" rx="6" fill="#0c1c30"/>${streaks(6, C.dim, .6)}${car(pw * 0.36, ph * 0.5, 1.5, C.gold, 0)}${tag(pw / 2, ph - 6, 'Panning — sujeito nítido', { anchor: 'middle', fg: C.gold })}`, ph + gap);
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Velocidade e movimento">${freeze}${mblur}${longe}${pan}</svg>`;
  };

  // ISO & ruído — faixa de ISO com grão crescente (feTurbulence)
  ART['iso-ruido'] = () => {
    const W = 420, H = 170, steps = [100, 400, 1600, 6400, 25600], sw = W / steps.length;
    const cells = steps.map((iso, i) => {
      const noise = i === 0 ? '' : `<rect x="${i * sw}" y="0" width="${sw}" height="${H}" fill="url(#isoNoise)" opacity="${0.08 + i * 0.12}"/>`;
      const col = i < 2 ? C.good : i < 4 ? C.gold : C.bad;
      return `<rect x="${i * sw}" y="0" width="${sw}" height="${H}" fill="url(#isoSky)"/>${noise}
        <line x1="${i * sw}" y1="0" x2="${i * sw}" y2="${H}" stroke="#02060c" stroke-width="1"/>
        ${tag(i * sw + sw / 2, H - 8, 'ISO ' + iso, { anchor: 'middle', fg: col })}`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="ISO e ruído">
      <defs>
        <linearGradient id="isoSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10243c"/><stop offset="1" stop-color="#040a14"/></linearGradient>
        <filter id="isoNoiseF"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>
        <pattern id="isoNoise" width="${W}" height="${H}" patternUnits="userSpaceOnUse"><rect width="${W}" height="${H}" filter="url(#isoNoiseF)"/></pattern>
      </defs>${cells}
      ${arrow(20, 24, W - 20, 24, C.ink, 1.5)}${tag(W / 2, 20, 'mais luz captada  ·  mais grão', { anchor: 'middle', fg: C.ink })}</svg>`;
  };

  // Medição — matricial / central / spot (zonas sobre a mesma cena)
  ART.medicao = () => {
    const W = 420, H = 200, gap = 6, pw = (W - gap * 2) / 3;
    const base = `${scene(pw, H, { subject: 'person' })}`;
    const matrix = () => { let g = ''; for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) g += `<rect x="${a * pw / 4 + 2}" y="${b * H / 3 + 2}" width="${pw / 4 - 4}" height="${H / 3 - 4}" fill="none" stroke="${C.cyan}" stroke-width="1" opacity=".7"/>`; return g; };
    const center = () => `<ellipse cx="${pw / 2}" cy="${H / 2}" rx="${pw * 0.34}" ry="${H * 0.34}" fill="${C.gold}" opacity=".14" stroke="${C.gold}" stroke-width="1.5"/>`;
    const spot = () => `<circle cx="${pw * 0.3}" cy="${H * 0.42}" r="12" fill="none" stroke="${C.good}" stroke-width="2"/><circle cx="${pw * 0.3}" cy="${H * 0.42}" r="2.5" fill="${C.good}"/>`;
    const cell = (i, ov, lbl, col) => panel(i * (pw + gap), pw, H, `${base}${ov()}${tag(pw / 2, H - 8, lbl, { anchor: 'middle', fg: col })}`);
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Modos de medição">
      ${cell(0, matrix, 'Matricial', C.cyan)}${cell(1, center, 'Central', C.gold)}${cell(2, spot, 'Spot', C.good)}</svg>`;
  };

  // Qualidade & direção da luz — esfera iluminada de vários ângulos
  ART.luz = () => {
    const W = 420, H = 200, gap = 6, pw = (W - gap * 2) / 3;
    // 3 esferas iluminadas de direções diferentes
    const ball = (i, gx, gy, edge, lbl, col) => {
      const gid = uid('lit');
      return panel(i * (pw + gap), pw, H,
        `<rect width="${pw}" height="${H}" rx="6" fill="#0a1420"/>
         <defs><radialGradient id="${gid}" cx="${gx}" cy="${gy}" r="0.9">
           <stop offset="0" stop-color="#fff"/><stop offset="${edge}" stop-color="#5b6d84"/><stop offset="1" stop-color="#0a121e"/></radialGradient></defs>
         <circle cx="${pw / 2}" cy="${H * 0.42}" r="${Math.min(pw, H) * 0.28}" fill="url(#${gid})"/>
         ${arrow(pw / 2 + (gx - 0.5) * pw * 0.7, H * 0.42 + (gy - 0.5) * H * 0.5, pw / 2 + (gx - 0.5) * pw * 0.34, H * 0.42 + (gy - 0.5) * H * 0.28, C.gold, 1.6)}
         ${tag(pw / 2, H - 8, lbl, { anchor: 'middle', fg: col })}`);
    };
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Direção e qualidade da luz">
      ${ball(0, 0.5, 0.15, 0.5, 'Frontal / suave', C.cyan)}
      ${ball(1, 0.12, 0.4, 0.62, 'Lateral / volume', C.gold)}
      ${ball(2, 0.85, 0.2, 0.75, 'Contraluz / recorte', C.good)}</svg>`;
  };

  // Foco & autofocus — pontos AF + caixa de seguimento + Eye-AF
  ART['foco-af'] = () => {
    const W = 420, H = 210;
    let pts = '';
    for (let a = 0; a < 7; a++) for (let b = 0; b < 5; b++) {
      const x = W * (0.1 + a * 0.13), y = H * (0.14 + b * 0.16);
      pts += `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="1.5" fill="none" stroke="${C.dim}" stroke-width="1.4"/>`;
    }
    const fx = W * 0.3, fy = H * 0.42;
    const trackBox = `<rect x="${fx - 34}" y="${fy - 44}" width="68" height="88" rx="4" fill="none" stroke="${C.good}" stroke-width="2.4"/>
      ${[[fx - 34, fy - 44, 1, 1], [fx + 34, fy - 44, -1, 1], [fx - 34, fy + 44, 1, -1], [fx + 34, fy + 44, -1, -1]].map(([cx, cy, sx, sy]) => `<path d="M${cx} ${cy + 10 * sy} V${cy} H${cx + 12 * sx}" stroke="${C.good}" stroke-width="3" fill="none"/>`).join('')}`;
    const eye = `<circle cx="${fx + 6}" cy="${fy - 20}" r="7" fill="none" stroke="${C.gold}" stroke-width="2"/><circle cx="${fx + 6}" cy="${fy - 20}" r="2" fill="${C.gold}"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Autofocus e zonas de foco">
      ${scene(W, H, { subject: 'person', blurBg: 2.4 })}${pts}${trackBox}${eye}
      ${tag(fx, fy + 60, 'Servo + Eye-AF a seguir o sujeito', { anchor: 'middle', fg: C.good })}</svg>`;
  };

  // RAW vs JPEG — recuperação de sombras/realces (antes/depois)
  ART['raw-jpeg'] = () => {
    const W = 420, H = 200, half = W / 2;
    const defs = `<defs>
      <linearGradient id="rjBlown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="rjCrush" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".82"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>`;
    // JPEG: céu queimado (banda branca) + sombras esmagadas (banda preta) — sem detalhe
    const left = panel(0, half, H, `${scene(half, H, { expose: 1 })}
      <rect x="0" y="0" width="${half}" height="${H * 0.5}" fill="url(#rjBlown)"/>
      <rect x="0" y="${H * 0.5}" width="${half}" height="${H * 0.5}" fill="url(#rjCrush)"/>
      ${tag(half / 2, H - 8, 'JPEG — sem margem', { anchor: 'middle', fg: C.bad })}`);
    // RAW: mesma cena com detalhe recuperado nas duas pontas
    const right = panel(half, half, H, `${scene(half, H, { expose: 1 })}
      <rect x="0" y="0" width="${half}" height="${H * 0.5}" fill="url(#rjBlown)" opacity=".18"/>
      <rect x="0" y="${H * 0.5}" width="${half}" height="${H * 0.5}" fill="url(#rjCrush)" opacity=".2"/>
      ${arrow(half * 0.18, 30, half * 0.18, 12, C.good, 1.5)}${arrow(half * 0.82, H - 34, half * 0.82, H - 16, C.good, 1.5)}
      ${tag(half / 2, H - 8, 'RAW — realces e sombras recuperados', { anchor: 'middle', fg: C.good, w: half - 8 })}`);
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="RAW vs JPEG">${defs}${left}${right}
      <line x1="${half}" y1="0" x2="${half}" y2="${H}" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="4 4"/></svg>`;
  };

  // Filtros — CPL (corta reflexo / céu) & ND (longa exposição)
  ART.filtros = () => {
    const W = 420, H = 200, gap = 6, pw = (W - gap) / 2;
    const cpl = panel(0, pw, H, `${scene(pw, H, { subject: 'none' })}
      <rect x="0" y="0" width="${pw / 2}" height="${H * 0.6}" fill="#0a2f4d" opacity=".55"/>
      ${tag(pw * 0.25, 22, 'com CPL', { anchor: 'middle', fg: C.cyan })}${tag(pw * 0.75, 22, 'sem', { anchor: 'middle', fg: C.dim })}
      ${tag(pw / 2, H - 8, 'CPL — céu mais denso, sem reflexos', { anchor: 'middle', fg: C.cyan, w: pw - 8 })}`);
    let str = ''; for (let i = 0; i < 6; i++) str += `<line x1="6" y1="${40 + i * 16}" x2="${pw - 6}" y2="${40 + i * 16}" stroke="${C.cyan}" stroke-width="2" opacity=".4"/>`;
    const nd = panel(pw + gap, pw, H, `<rect width="${pw}" height="${H}" rx="6" fill="#0a1424"/>${str}
      <path d="M0 ${H * 0.64} Q${pw / 2} ${H * 0.54} ${pw} ${H * 0.64} V${H} H0 Z" fill="#123a4d" opacity=".7"/>
      ${tag(pw / 2, H - 8, 'ND — água/nuvens sedosas', { anchor: 'middle', fg: C.gold })}`);
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-svg" role="img" aria-label="Filtros CPL e ND">${cpl}${nd}</svg>`;
  };

  // ── API pública ───────────────────────────────────────────────────
  function svg(id) { return ART[id] ? ART[id]() : ''; }
  function has(id) { return !!ART[id]; }

  function visual(id, opts = {}) {
    if (opts.asset) {
      return `<span class="ph-vis" data-ph-fb="${esc(id)}"><img class="ph-vis-img" loading="lazy" decoding="async"${opts.ar ? ` style="aspect-ratio:${opts.ar}"` : ''} alt="${esc(opts.alt || '')}" src="${esc(opts.asset)}"></span>`;
    }
    const s = svg(id);
    return s ? `<span class="ph-vis">${s}</span>` : '';
  }

  // Liga o fallback: se a imagem foto-real falhar, injecta o SVG procedural.
  function wire(root) {
    if (!root) return;
    root.querySelectorAll('.ph-vis[data-ph-fb] img').forEach(img => {
      img.addEventListener('error', () => {
        const host = img.closest('.ph-vis'); if (!host) return;
        host.innerHTML = svg(host.dataset.phFb) || '';
      }, { once: true });
    });
  }

  return { svg, has, visual, wire, list: () => Object.keys(ART) };
})();
