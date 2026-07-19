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


  /* ══ OFÍCIO (craft.json) ═════════════════════════════════════════════
     Esquemas de vista lateral / planta: ensinam POSIÇÃO, que é o que o
     texto explica pior. Todos com o mesmo vocabulário visual: a câmara é
     um trapézio ciano, o sujeito é uma silhueta escura, o dourado marca a
     escolha recomendada. */

  // Câmara estilizada apontada para a direita (ou rodada por `rot`).
  function cam(x, y, s = 1, rot = 0, col = C.cyan) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${col}">
      <rect x="-9" y="-6" width="16" height="12" rx="2"/>
      <path d="M7 -4 L14 -7 L14 7 L7 4 Z"/>
      <circle cx="-1" cy="0" r="3" fill="#04121f"/></g>`;
  }
  // Pessoa de pé, vista de lado.
  function figure(x, base, h, col = '#0a1725') {
    return `<g fill="${col}">
      <circle cx="${x}" cy="${base - h}" r="${h * 0.15}"/>
      <path d="M${x - h * 0.11} ${base - h * 0.82} Q${x} ${base - h * 0.95} ${x + h * 0.11} ${base - h * 0.82}
        L${x + h * 0.14} ${base - h * 0.34} L${x + h * 0.09} ${base} L${x} ${base - h * 0.36}
        L${x - h * 0.09} ${base} L${x - h * 0.14} ${base - h * 0.34} Z"/></g>`;
  }
  const ground = (w, y) => `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${C.dim}" stroke-width="1.5"/>`;

  // Altura da câmara — três alturas, mesma cena, resultado diferente.
  ART['craft-height'] = () => {
    const W = 430, H = 210, gy = H - 30;
    const rows = [
      { y: gy - 6, lbl: 'Baixa · dá grandeza', col: C.gold },
      { y: gy - 52, lbl: 'Ao nível dos olhos · ligação', col: C.good },
      { y: gy - 96, lbl: 'Alta · diminui o sujeito', col: C.dim },
    ];
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Efeito da altura da câmara">
      ${ground(W, gy)}
      ${figure(W * 0.72, gy, 96)}
      ${rows.map(r => `${cam(60, r.y, 1, 0, r.col)}
        ${arrow(78, r.y, W * 0.66, r.y + (gy - 46 - r.y) * 0.28, r.col, 1.4)}
        ${tag(96, r.y - 8, r.lbl, { fg: r.col })}`).join('')}
      ${tag(W * 0.72, H - 8, 'mesmo sujeito', { anchor: 'middle', fg: C.dim })}
    </svg>`;
  };

  // Ângulo — planta vista de cima: mover-te lateralmente muda o FUNDO.
  ART['craft-angle'] = () => {
    const W = 430, H = 200, cx = W * 0.5, cy = H * 0.56, R = 74;
    const pos = [
      { a: 180, lbl: 'Frontal', col: C.dim },
      { a: 138, lbl: 'Três-quartos', col: C.gold },
      { a: 90, lbl: 'Perfil', col: C.cyan },
      { a: 0, lbl: 'Por trás', col: C.dim },
    ];
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Ângulos à volta do sujeito">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.dim}" stroke-width="1" stroke-dasharray="3 4"/>
      <circle cx="${cx}" cy="${cy}" r="13" fill="#0a1725"/>
      <path d="M${cx - 5} ${cy - 14} h10 v-4 h-10 z" fill="${C.ink}" opacity=".5"/>
      ${tag(cx, cy + 34, 'sujeito', { anchor: 'middle', fg: C.dim })}
      ${pos.map(p => {
        const rad = p.a * Math.PI / 180;
        const x = cx + Math.cos(rad) * R, y = cy - Math.sin(rad) * R;
        const rot = -p.a + 180;
        return `${cam(x, y, 0.85, rot, p.col)}${tag(x, y - 16, p.lbl, { anchor: 'middle', fg: p.col })}`;
      }).join('')}
      ${tag(10, H - 8, 'Um passo ao lado troca o fundo todo', { fg: C.gold })}
    </svg>`;
  };

  // Distância — o mesmo sujeito em quatro planos.
  ART['craft-distance'] = () => {
    const W = 430, H = 180, gap = 5, pw = (W - gap * 3) / 4;
    const cells = [
      { s: 0.30, lbl: 'Geral' }, { s: 0.55, lbl: 'Médio' },
      { s: 0.95, lbl: 'Grande plano' }, { s: 1.7, lbl: 'Pormenor' },
    ];
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Planos por distância ao sujeito">
      ${cells.map((c, i) => panel(i * (pw + gap), pw, H, `
        <rect x="0" y="0" width="${pw}" height="${H - 22}" rx="4" fill="#0d2135"/>
        <g clip-path="inset(0 0 ${22}px 0)">${figure(pw / 2, (H - 22) * 0.5 + 88 * c.s * 0.5, 88 * c.s, '#7fb2d9')}</g>
        ${tag(pw / 2, H - 6, c.lbl, { anchor: 'middle', fg: i === 1 ? C.gold : C.dim })}`)).join('')}
    </svg>`;
  };

  // Primeiro plano — com e sem. A comparação que mais convence.
  ART['craft-foreground'] = () => {
    const W = 430, H = 190, gap = 8, pw = (W - gap) / 2;
    const body = (withFg) => `
      ${scene(pw, H - 20, { subject: 'tree' })}
      ${withFg ? `<path d="M0 ${H - 20} Q${pw * 0.22} ${H - 62} ${pw * 0.46} ${H - 26} T${pw} ${H - 34} V${H - 20} Z" fill="#04101c"/>
        <ellipse cx="${pw * 0.2}" cy="${H - 40}" rx="16" ry="10" fill="#061726"/>` : ''}`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Com e sem primeiro plano">
      ${panel(0, pw, H, `${body(false)}${tag(pw / 2, H - 4, '✗ sem primeiro plano', { anchor: 'middle', fg: C.bad })}`)}
      ${panel(pw + gap, pw, H, `${body(true)}${tag(pw / 2, H - 4, '✓ com primeiro plano', { anchor: 'middle', fg: C.good })}`)}
    </svg>`;
  };

  // Direção da luz — planta com o sol em quatro posições.
  ART['craft-lightdir'] = () => {
    const W = 430, H = 200, gap = 5, pw = (W - gap * 3) / 4;
    const cell = (sunSide, lbl, col) => {
      // sunSide: -1 atrás do fotógrafo, 0 lateral, 1 contraluz, 2 difusa
      const face = sunSide === 1 ? '#04101c' : sunSide === 0 ? '#274b6b' : '#4d7ea8';
      const rim = sunSide === 1 ? `<path d="M${pw / 2 - 13} ${H - 88} a13 13 0 0 1 26 0" fill="none" stroke="${C.gold}" stroke-width="2.5"/>` : '';
      const side = sunSide === 0 ? `<path d="M${pw / 2} ${H - 101} a13 13 0 0 1 0 26 z" fill="#8fc0e4"/>` : '';
      const sun = sunSide === 2
        ? `<rect x="6" y="8" width="${pw - 12}" height="16" rx="8" fill="#7aa8c9" opacity=".5"/>`
        : `<circle cx="${sunSide === 1 ? pw / 2 : sunSide === 0 ? pw - 14 : pw / 2}" cy="${sunSide === 1 ? 22 : 20}" r="8" fill="#ffd98a"/>`;
      return `<rect x="0" y="0" width="${pw}" height="${H - 22}" rx="4" fill="#0d2135"/>
        ${sun}${rim}
        <circle cx="${pw / 2}" cy="${H - 88}" r="13" fill="${face}"/>
        <path d="M${pw / 2 - 12} ${H - 72} h24 v${34} h-24 z" fill="${face}"/>
        ${side}
        ${tag(pw / 2, H - 6, lbl, { anchor: 'middle', fg: col })}`;
    };
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Direções da luz">
      ${panel(0, pw, H, cell(-1, 'Frontal', C.dim))}
      ${panel(pw + gap, pw, H, cell(0, 'Lateral', C.gold))}
      ${panel((pw + gap) * 2, pw, H, cell(1, 'Contraluz', C.cyan))}
      ${panel((pw + gap) * 3, pw, H, cell(2, 'Difusa', C.good))}
    </svg>`;
  };

  // Ler o fundo — poste atrás da cabeça vs. um passo ao lado.
  ART['craft-background'] = () => {
    const W = 430, H = 185, gap = 8, pw = (W - gap) / 2;
    const base = H - 26, fh = 96;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Fundo limpo e fundo desarrumado">
      ${panel(0, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>
        <rect x="${pw * 0.47}" y="14" width="5" height="${base - 14}" fill="#3d5a73"/>
        <rect x="${pw * 0.2}" y="${base - 26}" width="20" height="26" fill="#33506a"/>
        ${figure(pw * 0.5, base, fh, '#7fb2d9')}
        <circle cx="${pw * 0.5}" cy="${base - fh}" r="${fh * 0.24}" fill="none" stroke="${C.bad}" stroke-width="2"/>
        ${tag(pw / 2, H - 4, '✗ poste a sair da cabeça', { anchor: 'middle', fg: C.bad })}`)}
      ${panel(pw + gap, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>
        <rect x="${pw * 0.86}" y="14" width="5" height="${base - 14}" fill="#22384c"/>
        ${figure(pw * 0.42, base, fh, '#7fb2d9')}
        ${tag(pw / 2, H - 4, '✓ um passo ao lado', { anchor: 'middle', fg: C.good })}`)}
    </svg>`;
  };

  // Esperar o momento — cena composta, sujeito entra.
  ART['craft-moment'] = () => {
    const W = 430, H = 175, gap = 8, pw = (W - gap) / 2;
    const base = H - 26;
    const box = (inner, lbl, col) => `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>
      <rect x="${pw * 0.14}" y="18" width="${pw * 0.34}" height="${base - 18}" fill="#16334d"/>
      <rect x="${pw * 0.55}" y="34" width="${pw * 0.3}" height="${base - 34}" fill="#12293f"/>
      <path d="M${pw * 0.48} ${base} l${pw * 0.09} -${base - 18} h${pw * 0.05} l-${pw * 0.07} ${base - 18} z" fill="#f3d9a0" opacity=".28"/>
      ${inner}${tag(pw / 2, H - 4, lbl, { anchor: 'middle', fg: col })}`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Compor primeiro, esperar depois">
      ${panel(0, pw, H, box(`${thirds(pw, base, 'rgba(34,211,238,.35)')}`, '1. compõe e espera', C.cyan))}
      ${panel(pw + gap, pw, H, box(`${thirds(pw, base, 'rgba(34,211,238,.2)')}${figure(pw * 0.52, base, 74, '#04101c')}`, '2. o sujeito entra', C.gold))}
    </svg>`;
  };

  // Simplificar — cena cheia vs. um assunto só.
  ART['craft-simplify'] = () => {
    const W = 430, H = 175, gap = 8, pw = (W - gap) / 2;
    const base = H - 26;
    const clutter = Array.from({ length: 7 }, (_, i) =>
      `<rect x="${8 + i * (pw - 24) / 6}" y="${base - 20 - (i % 3) * 16}" width="14" height="${20 + (i % 3) * 16}" fill="#2b4761"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Cena cheia e cena simplificada">
      ${panel(0, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>${clutter}
        ${figure(pw * 0.5, base, 66, '#7fb2d9')}
        ${tag(pw / 2, H - 4, '✗ qual é o assunto?', { anchor: 'middle', fg: C.bad })}`)}
      ${panel(pw + gap, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>
        ${figure(pw * 0.5, base, 66, '#7fb2d9')}
        ${tag(pw / 2, H - 4, '✓ um assunto só', { anchor: 'middle', fg: C.good })}`)}
    </svg>`;
  };

  /* ══ EQUIPAMENTO (equipment.json) ════════════════════════════════════ */

  // Tamanhos de sensor, à escala relativa real.
  ART['eq-sensors'] = () => {
    const W = 430, H = 190, cx = W / 2, cy = H / 2 - 6;
    const boxes = [
      { w: 36, h: 24, lbl: 'FF 36×24', col: C.gold },
      { w: 23.6, h: 15.7, lbl: 'APS-C', col: C.cyan },
      { w: 17.3, h: 13, lbl: 'M4/3', col: C.good },
      { w: 9.6, h: 7.2, lbl: 'telemóvel', col: C.dim },
    ];
    const k = 4.2;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Tamanhos de sensor comparados">
      ${boxes.map(b => `<rect x="${cx - b.w * k / 2}" y="${cy - b.h * k / 2}" width="${b.w * k}" height="${b.h * k}"
        fill="none" stroke="${b.col}" stroke-width="1.8" rx="2"/>`).join('')}
      ${boxes.map((b, i) => tag(cx + b.w * k / 2 + 4, cy - b.h * k / 2 + 12 + i * 0, b.lbl, { fg: b.col })).join('')}
      ${tag(cx, H - 6, 'mais área = mais luz e menos ruído', { anchor: 'middle', fg: C.ink })}
    </svg>`;
  };

  // Campo de visão por focal equivalente.
  ART['eq-focal-fov'] = () => {
    const W = 430, H = 200, ox = 40, oy = H - 26, L = 300;
    const fovs = [
      { a: 100, lbl: '14mm', col: C.dim },
      { a: 63, lbl: '35mm', col: C.cyan },
      { a: 40, lbl: '50mm', col: C.good },
      { a: 24, lbl: '85mm', col: C.gold },
      { a: 8, lbl: '300mm', col: C.bad },
    ];
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Campo de visão por distância focal">
      ${fovs.map(f => {
        const r = (f.a / 2) * Math.PI / 180;
        const x = ox + Math.cos(r) * 0, y = 0;
        const x1 = ox + L, y1 = oy - Math.tan(r) * L, y2 = oy + Math.tan(r) * L;
        return `<path d="M${ox} ${oy} L${x1} ${Math.max(6, y1)} M${ox} ${oy} L${x1} ${Math.min(H - 6, y2)}"
          stroke="${f.col}" stroke-width="1.4" fill="none" opacity=".85"/>
          ${tag(x1 + 2, Math.max(14, y1) + 4, f.lbl, { fg: f.col })}`;
      }).join('')}
      ${cam(ox - 6, oy, 1, 0)}
      ${tag(ox + 6, 16, 'ângulo de visão (equivalente 35mm)', { fg: C.ink })}
    </svg>`;
  };

  // Polarizador ligado / desligado.
  ART['eq-cpl'] = () => {
    const W = 430, H = 180, gap = 8, pw = (W - gap) / 2;
    const water = (pol) => `
      <rect width="${pw}" height="${H - 20}" rx="4" fill="${pol ? '#0a2c4a' : '#12405f'}"/>
      <rect y="0" width="${pw}" height="${(H - 20) * 0.42}" fill="${pol ? '#12508a' : '#4d86ad'}"/>
      ${pol ? '' : `<ellipse cx="${pw * 0.38}" cy="${(H - 20) * 0.68}" rx="${pw * 0.3}" ry="12" fill="#cfe6f5" opacity=".55"/>
        <ellipse cx="${pw * 0.7}" cy="${(H - 20) * 0.8}" rx="${pw * 0.2}" ry="8" fill="#cfe6f5" opacity=".4"/>`}
      ${pol ? `<path d="M${pw * 0.3} ${(H - 20) * 0.74} q14 -8 28 0 t28 0" stroke="#2f6b52" stroke-width="3" fill="none" opacity=".8"/>` : ''}`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Polarizador ligado e desligado">
      ${panel(0, pw, H, `${water(false)}${tag(pw / 2, H - 4, 'sem polarizador · reflexos', { anchor: 'middle', fg: C.dim })}`)}
      ${panel(pw + gap, pw, H, `${water(true)}${tag(pw / 2, H - 4, 'com polarizador · vê-se o fundo', { anchor: 'middle', fg: C.gold })}`)}
    </svg>`;
  };

  // Filtro ND: velocidade curta vs longa sobre água.
  ART['eq-nd'] = () => {
    const W = 430, H = 180, gap = 8, pw = (W - gap) / 2;
    const rock = `<path d="M${pw * 0.3} ${H - 46} q14 -22 30 0 z" fill="#0a1725"/>`;
    const drops = Array.from({ length: 26 }, (_, i) =>
      `<circle cx="${10 + (i * 37) % (pw - 20)}" cy="${60 + (i * 23) % 70}" r="2.4" fill="#cfe6f5" opacity=".8"/>`).join('');
    const silk = Array.from({ length: 6 }, (_, i) =>
      `<path d="M6 ${66 + i * 12} q${pw / 2} ${i % 2 ? 8 : -8} ${pw - 12} 0" stroke="#dbeaf6" stroke-width="${5 - i * 0.5}" fill="none" opacity=".4"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Efeito de um filtro ND">
      ${panel(0, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>${drops}${rock}
        ${tag(pw / 2, H - 4, '1/500 s · gotas paradas', { anchor: 'middle', fg: C.dim })}`)}
      ${panel(pw + gap, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>${silk}${rock}
        ${tag(pw / 2, H - 4, 'ND + 8 s · água sedosa', { anchor: 'middle', fg: C.gold })}`)}
    </svg>`;
  };

  // Tripé: mesma exposição, à mão e apoiada.
  ART['eq-tripod'] = () => {
    const W = 430, H = 180, gap = 8, pw = (W - gap) / 2;
    const star = (x, y, blur) => blur
      ? `<ellipse cx="${x}" cy="${y}" rx="9" ry="2.4" fill="${C.ink}" opacity=".55" transform="rotate(-18 ${x} ${y})"/>`
      : `<circle cx="${x}" cy="${y}" r="2.6" fill="${C.ink}"/>`;
    const pts = [[0.22, 0.3], [0.44, 0.5], [0.66, 0.26], [0.8, 0.6], [0.34, 0.68], [0.56, 0.8]];
    const field = (blur) => `<rect width="${pw}" height="${H - 20}" rx="4" fill="#08192b"/>
      ${pts.map(p => star(pw * p[0], (H - 20) * p[1], blur)).join('')}`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="À mão e com tripé">
      ${panel(0, pw, H, `${field(true)}${tag(pw / 2, H - 4, 'à mão · tremido', { anchor: 'middle', fg: C.bad })}`)}
      ${panel(pw + gap, pw, H, `${field(false)}${tag(pw / 2, H - 4, 'com tripé · nítido', { anchor: 'middle', fg: C.good })}`)}
    </svg>`;
  };

  // Flash: direto vs rebatido no teto.
  ART['eq-flash'] = () => {
    const W = 430, H = 190, gap = 8, pw = (W - gap) / 2;
    const base = H - 30;
    const room = (bounce) => `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>
      <line x1="6" y1="14" x2="${pw - 6}" y2="14" stroke="${C.dim}" stroke-width="2"/>
      ${cam(24, base - 30, 0.9)}
      ${bounce
        ? `${arrow(34, base - 34, pw * 0.5, 18, C.gold, 1.6)}${arrow(pw * 0.5, 18, pw * 0.66, base - 44, C.gold, 1.6)}
           <ellipse cx="${pw * 0.5}" cy="16" rx="26" ry="5" fill="${C.gold}" opacity=".35"/>`
        : `${arrow(36, base - 32, pw * 0.6, base - 44, C.bad, 1.8)}
           <path d="M${pw * 0.72} ${base - 40} l22 8 v34 h-22 z" fill="#04101c" opacity=".75"/>`}
      ${figure(pw * 0.66, base, 62, bounce ? '#8fc0e4' : '#5d8cb3')}`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Flash direto e rebatido">
      ${panel(0, pw, H, `${room(false)}${tag(pw / 2, H - 4, 'direto · sombra dura', { anchor: 'middle', fg: C.bad })}`)}
      ${panel(pw + gap, pw, H, `${room(true)}${tag(pw / 2, H - 4, 'rebatido · luz suave', { anchor: 'middle', fg: C.good })}`)}
    </svg>`;
  };

  // Zoom ótico vs digital.
  ART['eq-zoom'] = () => {
    const W = 430, H = 180, gap = 8, pw = (W - gap) / 2;
    const sub = (crisp) => crisp
      ? figure(pw / 2, H - 44, 84, '#8fc0e4')
      : `<g opacity=".85">${figure(pw / 2, H - 44, 84, '#6b93b8')}</g>
         <g fill="#0d2135" opacity=".55">${Array.from({ length: 60 }, (_, i) =>
            `<rect x="${(i * 13) % pw}" y="${((i * 29) % (H - 40))}" width="7" height="7"/>`).join('')}</g>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="Zoom ótico e zoom digital">
      ${panel(0, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>${sub(true)}
        ${tag(pw / 2, H - 4, 'ótico · detalhe real', { anchor: 'middle', fg: C.good })}`)}
      ${panel(pw + gap, pw, H, `<rect width="${pw}" height="${H - 20}" rx="4" fill="#0d2135"/>${sub(false)}
        ${tag(pw / 2, H - 4, 'digital · é só corte', { anchor: 'middle', fg: C.bad })}`)}
    </svg>`;
  };

  // Mochila: o que levar mesmo.
  ART['eq-bag'] = () => {
    const W = 430, H = 175;
    const items = [
      { lbl: 'corpo', w: 54 }, { lbl: '1–2 objetivas', w: 76 }, { lbl: 'bateria', w: 48 },
      { lbl: 'cartão', w: 44 }, { lbl: 'pano', w: 38 },
    ];
    let x = 16;
    return `<svg viewBox="0 0 ${W} ${H}" class="ph-illus" role="img" aria-label="O essencial de uma saída">
      <rect x="8" y="24" width="${W - 16}" height="${H - 58}" rx="10" fill="#0d2135" stroke="${C.dim}" stroke-width="1.2"/>
      <path d="M${W / 2 - 26} 24 q26 -18 52 0" fill="none" stroke="${C.dim}" stroke-width="3"/>
      ${items.map(it => { const r = `<g><rect x="${x}" y="52" width="${it.w}" height="34" rx="5" fill="#17395a" stroke="${C.cyan}" stroke-width="1"/>${tag(x + it.w / 2, 106, it.lbl, { anchor: 'middle', fg: C.ink })}</g>`; x += it.w + 10; return r; }).join('')}
      ${tag(W / 2, H - 10, 'mais do que isto é quase sempre peso morto', { anchor: 'middle', fg: C.gold })}
    </svg>`;
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
