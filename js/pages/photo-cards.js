/* ══════════════════════════════════════════════════════════════════════
   PhotoCard — o vocabulário visual dos Cheatsheets da Fotografia.

   Um cheatsheet aqui é uma INFOGRAFIA de consulta, não um artigo curto:
   quem o abre está com a câmara na mão e tem de perceber o essencial a
   olhar, sem ler parágrafos. Este módulo dá as peças com que essas
   infografias se montam, em três famílias:

     1. PRIMITIVAS VETORIAIS  — câmara, sujeito, luz, raios, sombra,
        diafragma, cunha de campo de visão, plano de foco, escalas…
        Desenhadas por código (SVG), portanto nítidas em qualquer ecrã,
        pesquisáveis, com rótulos que são texto a sério e sem um único
        pedido de rede.

     2. DIAGRAMAS CALCULADOS  — a régua de profundidade de campo usa a
        fórmula real (hiperfocal, planos próximo e distante) com o círculo
        de confusão da câmara escolhida; as cunhas de campo de visão usam
        2·atan(18/f). Não são desenhos "à mão": são a geometria certa.

     3. TIRAS FOTOGRÁFICAS    — progressões (ISO, exposição, temperatura,
        abertura, velocidade) calculadas AO VIVO a partir de UMA fotografia
        do próprio projeto, pelo motor de píxeis do PhotoLab. Isto é
        deliberado: uma progressão feita com cinco fotografias diferentes
        ensina mal, porque muda tudo ao mesmo tempo. Aqui muda a variável
        que se está a ensinar e mais nada — uma fotografia, uma variável.
        As tiras dizem-no ao leitor com o selo "simulado".

   Blocos (o que o JSON dos cheatsheets pode pedir):
     strip · scale · grid · versus · diagram · triangle · table · rules ·
     note · steps

   API:
     PhotoCard.block(b, ctx)   → HTML de um bloco
     PhotoCard.art(id, opts)   → SVG de uma primitiva/diagrama
     PhotoCard.has(id)         → bool
     PhotoCard.wire(root, ctx) → liga tiras (pintura preguiçosa) e abas
   ════════════════════════════════════════════════════════════════════ */
const PhotoCard = (function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = v => Math.round(v * 10) / 10;
  let _uid = 0;
  const uid = p => `${p}${(++_uid).toString(36)}`;

  /* Paleta: a mesma do PhotoIllus, para que um diagrama de um cheatsheet e
     uma ilustração de Aprender se leiam como o mesmo sistema. Fixa (não
     tokens) porque estes desenhos são "fotografias": têm palco escuro
     próprio e têm de ler igual em tema claro e escuro. */
  const C = {
    blue: '#3b82f6', cyan: '#22d3ee', gold: '#f5b74a', warm: '#ffd98a',
    good: '#34d399', bad: '#f87171', ink: '#eaf1fb',
    line: 'rgba(255,255,255,.55)', dim: 'rgba(255,255,255,.3)',
    stage: '#0d1b2c', stage2: '#0a1421',
  };

  /* ══ 1. PRIMITIVAS ═══════════════════════════════════════════════════
     Peças combináveis. A convenção é a mesma em todo o portal: a câmara é
     um trapézio ciano, o sujeito é uma silhueta escura, o dourado marca a
     escolha ou o valor recomendado. */

  // Rótulo em pílula — legível por cima de qualquer fundo do diagrama.
  function tag(x, y, txt, opt = {}) {
    const t = String(txt);
    const w = opt.w != null ? opt.w : t.length * 5.3 + 12;
    const h = opt.h || 15, anchor = opt.anchor || 'start';
    const rx = x - (anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0);
    return `<g><rect x="${n(rx)}" y="${n(y - h + 3)}" width="${n(w)}" height="${h}" rx="4" fill="${opt.bg || 'rgba(6,12,22,.78)'}"/>
      <text x="${n(anchor === 'end' ? x - 6 : anchor === 'middle' ? x : x + 6)}" y="${n(y - 2)}"
        text-anchor="${anchor === 'middle' ? 'middle' : anchor === 'end' ? 'end' : 'start'}"
        font-family="var(--font-sans, sans-serif)" font-size="${opt.fs || 9}" font-weight="700"
        fill="${opt.fg || C.ink}">${esc(t)}</text></g>`;
  }
  const txt = (x, y, s, o = {}) => `<text x="${n(x)}" y="${n(y)}" text-anchor="${o.anchor || 'start'}"
    font-family="var(--font-sans, sans-serif)" font-size="${o.fs || 9}" font-weight="${o.w || 700}"
    fill="${o.fg || C.ink}" opacity="${o.op == null ? 1 : o.op}">${esc(s)}</text>`;

  function arrow(x1, y1, x2, y2, col = C.gold, wgt = 1.8, dash) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 7;
    const hx = x2 - L * Math.cos(a), hy = y2 - L * Math.sin(a), s = L * 0.52;
    return `<g stroke="${col}" stroke-width="${wgt}" fill="none" stroke-linecap="round">
      <line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>
      <path d="M${n(x2)} ${n(y2)} L${n(hx - s * Math.sin(a))} ${n(hy + s * Math.cos(a))} M${n(x2)} ${n(y2)} L${n(hx + s * Math.sin(a))} ${n(hy - s * Math.cos(a))}"/></g>`;
  }

  // Câmara vista de lado/cima, a apontar para a direita antes da rotação.
  function cam(x, y, s = 1, rot = 0, col = C.cyan) {
    return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${s})" fill="${col}">
      <rect x="-10" y="-7" width="17" height="14" rx="2.5"/>
      <path d="M7 -5 L15 -8 L15 8 L7 5 Z"/>
      <circle cx="-1" cy="0" r="3.4" fill="#04121f"/></g>`;
  }

  /* Pessoa de pé, de frente. Um esquema de ângulo de câmara só ensina se
     a figura tiver proporções credíveis: cabeça de ~1/7,5 da altura,
     ombros mais largos que a anca, braços com espessura e pernas
     separadas. A versão anterior era um boneco de palitos e chamava mais
     atenção a si própria do que ao que o diagrama queria mostrar.
     `base` = chão, `h` = altura total. */
  let _subject = null;
  const SUBJ_AR = 832 / 1216;
  function setSubject(url) { _subject = url || null; }
  /* Pessoa de pé. Usa a personagem recortada do portal (`crop-standing`)
     quando existe: um esquema de ângulo de câmara só ensina se o sujeito
     for reconhecível, e um boneco desenhado rouba a atenção ao que o
     diagrama quer mostrar. A silhueta fica como recurso. */
  function figure(x, base, h, col = '#08182a') {
    if (_subject) {
      const w = h * SUBJ_AR;
      return `<image href="${esc(_subject)}" x="${n(x - w / 2)}" y="${n(base - h)}"
        width="${n(w)}" height="${n(h)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    const hr = h * 0.075, hy = base - h + hr;
    return `<g fill="${col}">
      <circle cx="${n(x)}" cy="${n(hy)}" r="${n(hr)}"/>
      <rect x="${n(x - h * 0.1)}" y="${n(base - h * 0.83)}" width="${n(h * 0.2)}" height="${n(h * 0.45)}" rx="${n(h * 0.06)}"/>
      <rect x="${n(x - h * 0.085)}" y="${n(base - h * 0.45)}" width="${n(h * 0.07)}" height="${n(h * 0.45)}" rx="${n(h * 0.03)}"/>
      <rect x="${n(x + h * 0.015)}" y="${n(base - h * 0.45)}" width="${n(h * 0.07)}" height="${n(h * 0.45)}" rx="${n(h * 0.03)}"/></g>`;
  }

  const ground = (w, y, col = C.dim) => `<line x1="0" y1="${n(y)}" x2="${n(w)}" y2="${n(y)}" stroke="${col}" stroke-width="1.5"/>`;
  const stage = (w, h, fill) => `<rect width="${n(w)}" height="${n(h)}" rx="8" fill="${fill || C.stage}"/>`;

  /* Temperatura de cor → cor aproximada do corpo negro (Tanner Helland).
     Serve as amostras da escala Kelvin: 2000 K laranja, 6500 K branco,
     9000 K azulado. */
  function kelvinRGB(k) {
    const t = Math.max(1000, Math.min(12000, k)) / 100;
    let r, g, b;
    if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; }
    else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); }
    if (t >= 66) b = 255;
    else if (t <= 19) b = 0;
    else b = 138.52 * Math.log(t - 10) - 305.04;
    const c = v => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }

  /* ══ 2. DIAGRAMAS ════════════════════════════════════════════════════ */
  const ART = {};

  /* Diafragma: o buraco desenhado à escala certa. O diâmetro útil é
     proporcional a 1/N — por isso f/1.4 é ~16× mais largo que f/22 e a
     área (a luz) muda com o quadrado. É a peça que torna óbvio porque é
     que "número maior = menos luz". */
  ART.iris = (o = {}) => {
    const f = +o.f || 5.6, S = 100, cx = 50, cy = 50, R = 40, N = 7;
    const r = Math.max(2.6, R * 0.93 * (1.4 / f));
    const pts = rad => Array.from({ length: N }, (_, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / N;
      return [n(cx + rad * Math.cos(a)), n(cy + rad * Math.sin(a))];
    });
    const polyStr = rad => pts(rad).map(p => p.join(',')).join(' ');
    const polyPath = rad => pts(rad).map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + ' Z';
    const ring = `M${cx} ${cy - R} A${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} Z ${polyPath(r)}`;
    const col = o.col || C.gold;
    return `<svg viewBox="0 0 ${S} ${S}" class="cc-svg" role="img" aria-label="Diafragma a f/${f}">
      <circle cx="${cx}" cy="${cy}" r="${R + 7}" fill="#0a1421"/>
      <circle cx="${cx}" cy="${cy}" r="${R + 3}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.4"/>
      <circle cx="${cx}" cy="${cy}" r="${n(r)}" fill="${col}" opacity=".95"/>
      <path d="${ring}" fill="#223346" fill-rule="evenodd"/>
      <polygon points="${polyStr(r)}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".9"/>
    </svg>`;
  };

  /* Régua de profundidade de campo — CONTAS REAIS.
     H = f²/(N·c) + f ; próximo = d·H/(H + (d−f)) ; distante = d·H/(H − (d−f)).
     Escala logarítmica porque a profundidade cresce muito mais depressa
     para trás do que para a frente: numa escala linear a zona nítida de
     uma paisagem sairia da folha e a de um macro seria invisível. */
  function dofCalc(focal, N, distM, coc) {
    const f = focal, d = distM * 1000;
    const H = (f * f) / (N * coc) + f;
    const near = d * H / (H + (d - f));
    const far = (H - (d - f)) <= 0 ? Infinity : d * H / (H - (d - f));
    return { H: H / 1000, near: near / 1000, far: far === Infinity ? Infinity : far / 1000 };
  }
  ART.dofband = (o = {}) => {
    const focal = +o.focal || 50, dist = +o.dist || 3, coc = +o.coc || 0.019;
    const rows = (o.rows || [1.8, 5.6, 16]).map(f => Object.assign({ f }, dofCalc(focal, f, dist, coc)));
    const W = 460, gut = 52, right = 52, H = 44 + rows.length * 24 + 22;
    const lo = +o.min || 0.4, hi = +o.max || 40;
    const X = d => gut + (Math.log(Math.max(lo, Math.min(hi, d)) / lo) / Math.log(hi / lo)) * (W - gut - right);
    const y0 = 40, step = 24, yEnd = y0 + rows.length * step - 8;
    const ticks = (o.ticks || [0.5, 1, 2, 5, 10, 20, 40]).filter(t => t >= lo && t <= hi);
    const cols = [C.cyan, C.gold, C.good, C.bad];
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img"
      aria-label="Zona nítida a ${focal}mm focado a ${dist} metros, para várias aberturas">
      ${stage(W, H)}
      ${ticks.map(t => `<line x1="${n(X(t))}" y1="24" x2="${n(X(t))}" y2="${n(yEnd)}" stroke="rgba(255,255,255,.09)" stroke-width="1"/>
        ${txt(X(t), 18, t >= hi ? '∞' : t + ' m', { anchor: 'middle', fs: 8, fg: C.dim, w: 500 })}`).join('')}
      <line x1="${n(X(dist))}" y1="24" x2="${n(X(dist))}" y2="${n(yEnd)}" stroke="${C.ink}" stroke-width="1.3" stroke-dasharray="3 3" opacity=".7"/>
      ${rows.map((r, i) => {
        const y = y0 + i * step, x1 = X(r.near), x2 = X(r.far);
        const span = r.far === Infinity ? 'até ∞'
          : (r.far - r.near) < 1 ? `${Math.round((r.far - r.near) * 100)} cm` : `${(r.far - r.near).toFixed(1)} m`;
        return `<rect x="${n(x1)}" y="${n(y - 7)}" width="${n(Math.max(3, x2 - x1))}" height="13" rx="3" fill="${cols[i % 4]}" opacity=".85"/>
          ${txt(gut - 8, y + 3.5, 'f/' + r.f, { anchor: 'end', fs: 10, fg: cols[i % 4] })}
          ${txt(W - 8, y + 3.5, span, { anchor: 'end', fs: 8.5, fg: C.dim })}`;
      }).join('')}
      ${txt(X(dist), H - 7, `foco a ${dist} m · ${focal}mm`, { anchor: 'middle', fs: 8.5, fg: C.ink, w: 500 })}
    </svg>`;
  };

  /* Campo de visão: meio-ângulo = atan(18/f) na horizontal (equivalente
     35mm). As cunhas são a mesma geometria que a lente faz. */
  ART.fov = (o = {}) => {
    const W = 460, H = 200, ox = 26, oy = H / 2 - 4, legX = 336, L = legX - ox - 24;
    const items = (o.items || [
      { mm: 14, col: C.bad, use: 'interiores, dramático' },
      { mm: 24, col: C.cyan, use: 'paisagem, contexto' },
      { mm: 50, col: C.ink, use: 'o que o olho vê' },
      { mm: 85, col: C.gold, use: 'retrato' },
      { mm: 200, col: C.good, use: 'desporto, aves' },
    ]);
    const top = 12, bottomLim = H - 26;
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Campo de visão por distância focal equivalente">
      ${stage(W, H)}
      ${items.map(it => {
        const half = Math.atan(18 / it.mm);
        const dy = Math.tan(half) * L;
        const maxDy = Math.min(oy - top, bottomLim - oy);
        const xEnd = dy > maxDy ? ox + maxDy / Math.tan(half) : ox + L;
        const d = Math.min(dy, maxDy);
        return `<path d="M${ox} ${oy} L${n(xEnd)} ${n(oy - d)} L${n(xEnd)} ${n(oy + d)} Z" fill="${it.col}" opacity=".09"/>
          <path d="M${ox} ${oy} L${n(xEnd)} ${n(oy - d)} M${ox} ${oy} L${n(xEnd)} ${n(oy + d)}"
            stroke="${it.col}" stroke-width="1.5" fill="none"/>`;
      }).join('')}
      ${cam(ox - 4, oy, 0.9)}
      <line x1="${legX - 12}" y1="14" x2="${legX - 12}" y2="${H - 16}" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
      ${items.map((it, i) => {
        const half = Math.atan(18 / it.mm), deg = Math.round(half * 2 * 180 / Math.PI);
        const y = 30 + i * 32;
        return `<rect x="${legX}" y="${y - 8}" width="10" height="10" rx="2" fill="${it.col}"/>
          ${txt(legX + 16, y, `${it.mm}mm · ${deg}°`, { fs: 10, fg: it.col })}
          ${txt(legX + 16, y + 11, it.use || '', { fs: 8, fg: C.dim, w: 400 })}`;
      }).join('')}
      ${txt(ox + 4, H - 8, 'ângulo horizontal · focal equivalente 35mm', { fs: 8, fg: C.dim, w: 400 })}
    </svg>`;
  };

  /* Triângulo de exposição. O nome promete um triângulo: aqui há mesmo um,
     e cada lado diz o que se troca por quê. O centro é a exposição, que
     não muda — mexer num vértice obriga a devolver o mesmo stop noutro. */
  ART.triangle = () => {
    const W = 460, H = 312, cx = 230, top = 84, bot = 232, halfW = 148;
    const P = { t: [cx, top], l: [cx - halfW, bot], r: [cx + halfW, bot] };
    const node = (p, ico, name, col, gain, cost, ex) => {
      // Acima do vértice de topo o texto lê-se de cima para baixo na mesma
      // ordem que nos de baixo: ganho, custo, exemplo.
      const above = p === P.t;
      const ys = above ? [18, 30, 42] : [p[1] + 46, p[1] + 58, p[1] + 70];
      return `<circle cx="${p[0]}" cy="${p[1]}" r="31" fill="#10233a" stroke="${col}" stroke-width="2"/>
        <text x="${p[0]}" y="${p[1] - 2}" text-anchor="middle" font-size="17">${ico}</text>
        <text x="${p[0]}" y="${p[1] + 15}" text-anchor="middle" font-family="var(--font-head,sans-serif)"
          font-size="9" font-weight="800" fill="${col}">${esc(name)}</text>
        ${txt(p[0], ys[0], gain, { anchor: 'middle', fs: 9, fg: C.ink, w: 400 })}
        ${txt(p[0], ys[1], cost, { anchor: 'middle', fs: 8.5, fg: C.dim, w: 400 })}
        ${txt(p[0], ys[2], ex, { anchor: 'middle', fs: 8.5, fg: col, op: .85, w: 400 })}`;
    };
    const swap = (a, b, label, col, dx, dy) => {
      const mx = (a[0] + b[0]) / 2 + dx, my = (a[1] + b[1]) / 2 + dy;
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width="1.5" opacity=".5"/>
        ${tag(mx, my, label, { anchor: 'middle', fg: col })}`;
    };
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img"
      aria-label="Triângulo de exposição: velocidade, abertura e ISO trocam luz entre si sem mudar a exposição">
      ${stage(W, H)}
      <polygon points="${P.t[0]},${P.t[1]} ${P.l[0]},${P.l[1]} ${P.r[0]},${P.r[1]}" fill="rgba(245,183,74,.05)"/>
      ${swap(P.t, P.l, '−1 ⇄ +1', C.cyan, -30, 2)}
      ${swap(P.t, P.r, '−1 ⇄ +1', C.gold, 30, 2)}
      ${swap(P.l, P.r, '−1 ⇄ +1', C.good, 0, 15)}
      <circle cx="${cx}" cy="${(top + bot) / 2 + 14}" r="48" fill="rgba(6,12,22,.88)" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
      <text x="${cx}" y="${(top + bot) / 2 - 2}" text-anchor="middle" font-family="var(--font-head,sans-serif)"
        font-size="13" font-weight="800" fill="${C.ink}">1 stop</text>
      ${['= o dobro ou metade', 'da luz. Tirado a um,', 'devolve-se a outro.']
        .map((l, i) => txt(cx, (top + bot) / 2 + 13 + i * 11.5, l, { anchor: 'middle', fs: 8.5, w: 600, fg: C.dim })).join('')}
      ${node(P.t, '⏱️', 'Velocidade', C.cyan, 'mais luz = mais lenta', 'custo: tremido e arrasto', '1/500 → 1/250 → 1/125')}
      ${node(P.l, '🔵', 'Abertura', C.gold, 'mais luz = nº menor', 'custo: menos cena nítida', 'f/8 → f/5.6 → f/4')}
      ${node(P.r, '☀️', 'ISO', C.good, 'mais luz = nº maior', 'custo: ruído', '400 → 800 → 1600')}
    </svg>`;
  };

  /* Escala de valores com amostra de cor por passo (Kelvin, EV, sync…). */
  ART.scalebar = (o = {}) => {
    const items = o.items || [];
    const W = 460, H = o.h || 92, pad = 10;
    const cw = (W - pad * 2) / items.length;
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="${esc(o.alt || 'Escala')}">
      ${stage(W, H)}
      ${items.map((it, i) => {
        const x = pad + i * cw;
        const fill = it.k ? kelvinRGB(it.k) : (it.col || C.gold);
        return `<rect x="${n(x + 1.5)}" y="18" width="${n(cw - 3)}" height="34" rx="4" fill="${fill}"
            ${it.mark ? `stroke="${C.gold}" stroke-width="2"` : ''}/>
          ${txt(x + cw / 2, 66, it.v, { anchor: 'middle', fs: 9.5, fg: C.ink })}
          ${it.lab ? txt(x + cw / 2, 79, it.lab, { anchor: 'middle', fs: 8, fg: C.dim, w: 500 }) : ''}`;
      }).join('')}
      ${o.left ? txt(pad + 2, 12, o.left, { fs: 8, fg: C.dim, w: 500 }) : ''}
      ${o.right ? txt(W - pad - 2, 12, o.right, { anchor: 'end', fs: 8, fg: C.dim, w: 500 }) : ''}
    </svg>`;
  };

  /* Altura e ângulo da câmara — esquema de perfil. O sujeito é o mesmo em
     todos; muda só de onde se olha, que é a lição. */
  ART.angle = (o = {}) => {
    const W = 150, H = 130, gy = H - 20, k = o.k || 'eye';
    const fx = W * 0.68, fh = 76;
    const spots = {
      chao: { y: gy - 4, lbl: 'do chão' },
      baixo: { y: gy - 26, lbl: 'abaixo' },
      eye: { y: gy - 62, lbl: 'aos olhos' },
      alto: { y: gy - 96, lbl: 'acima' },
      topo: { y: gy - 112, lbl: 'a pique', top: 1 },
    };
    const s = spots[k] || spots.eye;
    const target = k === 'topo' ? gy - fh * 0.98 : k === 'chao' || k === 'baixo' ? gy - fh * 0.86 : gy - fh * 0.9;
    const col = k === 'eye' ? C.good : C.gold;
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Câmara ${esc(s.lbl)}">
      ${stage(W, H, C.stage2)}
      ${ground(W, gy)}
      ${figure(fx, gy, fh, '#7fb2d9')}
      ${cam(s.top ? fx : 26, s.y, 0.85, s.top ? 90 : Math.atan2(target - s.y, (s.top ? 0.01 : fx - 26)) * 180 / Math.PI, col)}
      ${arrow(s.top ? fx : 40, s.top ? s.y + 12 : s.y + 2, s.top ? fx : fx - 18, s.top ? gy - fh : target, col, 1.3, '4 3')}
    </svg>`;
  };

  /* Ponto e modo de focagem — moldura com a grelha de pontos AF. */
  ART.af = (o = {}) => {
    const W = 160, H = 116, k = o.k || 'single';
    let pts = '';
    for (let a = 0; a < 7; a++) for (let b = 0; b < 5; b++) {
      const x = 18 + a * 21, y = 16 + b * 19;
      pts += `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" rx="1.4" fill="none"
        stroke="rgba(255,255,255,.22)" stroke-width="1.2"/>`;
    }
    const boxes = {
      single: `<rect x="72" y="30" width="16" height="16" rx="2" fill="none" stroke="${C.good}" stroke-width="2.4"/>`,
      zona: `<rect x="52" y="26" width="58" height="44" rx="4" fill="rgba(52,211,153,.12)" stroke="${C.good}" stroke-width="2"/>`,
      seguir: `<rect x="46" y="20" width="70" height="76" rx="5" fill="none" stroke="${C.good}" stroke-width="2.4" stroke-dasharray="10 6"/>`,
      olho: `<circle cx="80" cy="38" r="11" fill="none" stroke="${C.gold}" stroke-width="2.4"/>
             <circle cx="80" cy="38" r="3" fill="${C.gold}"/>`,
      manual: `<rect x="18" y="14" width="124" height="88" rx="4" fill="none" stroke="${C.dim}" stroke-width="1.4" stroke-dasharray="4 4"/>
               <text x="80" y="62" text-anchor="middle" font-family="var(--font-sans,sans-serif)" font-size="11" font-weight="800" fill="${C.gold}">MF</text>`,
    };
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Área de focagem">
      ${stage(W, H, C.stage2)}
      <ellipse cx="80" cy="86" rx="34" ry="26" fill="#12314c"/>
      <circle cx="80" cy="44" r="22" fill="#1b4467"/>
      ${pts}${boxes[k] || boxes.single}
    </svg>`;
  };

  /* Flash: corte da sala. Direto, ricochete e preenchimento ao sol. */
  ART.flash = (o = {}) => {
    const W = 190, H = 132, k = o.k || 'direto', base = H - 18;
    const body = {
      direto: `${arrow(38, base - 52, 108, base - 60, C.bad, 2)}
        <path d="M124 ${base - 56} l26 10 v40 h-26 z" fill="#050d18" opacity=".8"/>
        ${figure(118, base, 64, '#5d8cb3')}`,
      ricochete: `${arrow(38, base - 56, 96, 16, C.gold, 1.8)}${arrow(96, 16, 122, base - 62, C.gold, 1.8)}
        <ellipse cx="96" cy="14" rx="30" ry="6" fill="${C.gold}" opacity=".35"/>
        ${figure(118, base, 64, '#9fcaea')}`,
      preenche: `<circle cx="158" cy="24" r="10" fill="${C.warm}"/>
        ${arrow(150, 32, 126, base - 58, C.warm, 1.6)}
        ${arrow(38, base - 50, 104, base - 56, C.gold, 1.6)}
        ${figure(116, base, 64, '#9fcaea')}`,
    };
    const ceiling = k === 'preenche' ? '' : `<line x1="8" y1="10" x2="${W - 8}" y2="10" stroke="${C.dim}" stroke-width="2"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Esquema de flash">
      ${stage(W, H, C.stage2)}${ceiling}${ground(W, base)}
      ${cam(24, base - 46, 0.85)}
      ${body[k] || body.direto}
    </svg>`;
  };

  /* A luz ao longo do dia: arco do sol com a cor real de cada momento. */
  ART.dayarc = () => {
    const W = 460, H = 150, gy = H - 30;
    const seg = [
      { a: 0.02, b: 0.14, k: 9000, lbl: 'hora azul' },
      { a: 0.14, b: 0.26, k: 2600, lbl: 'hora dourada' },
      { a: 0.26, b: 0.42, k: 4200, lbl: 'manhã' },
      { a: 0.42, b: 0.58, k: 5600, lbl: 'meio-dia' },
      { a: 0.58, b: 0.74, k: 4600, lbl: 'tarde' },
      { a: 0.74, b: 0.86, k: 2800, lbl: 'hora dourada' },
      { a: 0.86, b: 0.98, k: 9000, lbl: 'hora azul' },
    ];
    const X = t => 20 + t * (W - 40);
    const Y = t => gy - Math.sin(Math.max(0, Math.min(1, (t - 0.06) / 0.88)) * Math.PI) * (gy - 40);
    const arc = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40;
      return `${i ? 'L' : 'M'}${n(X(t))} ${n(Y(t))}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="A luz ao longo do dia: cor e altura do sol">
      ${stage(W, H)}
      <path d="${arc}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.2" stroke-dasharray="4 4"/>
      ${ground(W, gy)}
      ${seg.map(s => {
        const mid = (s.a + s.b) / 2;
        return `<rect x="${n(X(s.a))}" y="${n(gy + 5)}" width="${n(X(s.b) - X(s.a) - 2)}" height="10" rx="2" fill="${kelvinRGB(s.k)}"/>
          <circle cx="${n(X(mid))}" cy="${n(Y(mid))}" r="${mid > 0.25 && mid < 0.75 ? 8 : 5.5}" fill="${kelvinRGB(s.k)}" opacity=".95"/>`;
      }).join('')}
      ${['hora azul', 'dourada', 'manhã', 'meio-dia', 'tarde', 'dourada', 'azul'].map((l, i) =>
        txt(X((seg[i].a + seg[i].b) / 2), gy + 27, l, { anchor: 'middle', fs: 8, fg: C.dim, w: 500 })).join('')}
      ${tag(X(0.2), Y(0.2) - 13, 'quente · sombras longas', { anchor: 'middle', fg: C.gold })}
      ${tag(X(0.5), Y(0.5) - 14, 'dura · sombras curtas', { anchor: 'middle', fg: C.cyan })}
      ${tag(X(0.82), Y(0.82) - 13, 'fria · suave', { anchor: 'middle', fg: C.blue })}
    </svg>`;
  };

  /* Roda de modos: quem decide o quê. */
  ART.dial = (o = {}) => {
    const W = 150, H = 150, cx = 75, cy = 75, R = 52;
    const modes = o.modes || ['AUTO', 'P', 'Av', 'Tv', 'M'];
    const on = o.on || 'Av';
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Roda de modos">
      ${stage(W, H, C.stage2)}
      <circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="#12203050"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="#101d2e" stroke="rgba(255,255,255,.16)" stroke-width="1.4"/>
      <circle cx="${cx}" cy="${cy}" r="${R - 16}" fill="#0a1524"/>
      ${modes.map((m, i) => {
        const a = -Math.PI / 2 + (i - (modes.length - 1) / 2) * 0.66;
        const x = cx + Math.cos(a) * (R - 9), y = cy + Math.sin(a) * (R - 9);
        const sel = m === on;
        return `<text x="${n(x)}" y="${n(y + 3.5)}" text-anchor="middle" font-family="var(--font-head,sans-serif)"
          font-size="${sel ? 12 : 10}" font-weight="800" fill="${sel ? C.gold : C.dim}">${esc(m)}</text>`;
      }).join('')}
      <path d="M${cx} ${cy - R - 3} l-5.5 -9 h11 z" fill="${C.gold}"/>
    </svg>`;
  };

  /* Zonas de medição sobre a moldura. */
  ART.metering = (o = {}) => {
    const W = 160, H = 112, k = o.k || 'matricial';
    let cells = '';
    if (k === 'matricial') {
      for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++)
        cells += `<rect x="${12 + a * 27.5}" y="${10 + b * 23}" width="25" height="21" rx="2.5"
          fill="${C.cyan}" opacity="${0.1 + ((a + b) % 3) * 0.06}" stroke="${C.cyan}" stroke-width=".8"/>`;
    } else if (k === 'central') {
      cells = `<ellipse cx="80" cy="56" rx="46" ry="36" fill="${C.gold}" opacity=".2" stroke="${C.gold}" stroke-width="1.6"/>
        <ellipse cx="80" cy="56" rx="26" ry="20" fill="${C.gold}" opacity=".25"/>`;
    } else if (k === 'parcial') {
      cells = `<circle cx="80" cy="52" r="26" fill="${C.gold}" opacity=".26" stroke="${C.gold}" stroke-width="1.8"/>`;
    } else {
      cells = `<circle cx="80" cy="52" r="11" fill="${C.good}" opacity=".35" stroke="${C.good}" stroke-width="2"/>
        <circle cx="80" cy="52" r="2.4" fill="${C.good}"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Zona medida">
      ${stage(W, H, C.stage2)}
      <rect x="8" y="6" width="144" height="100" rx="4" fill="#122a42"/>
      <path d="M8 78 Q60 56 100 74 T152 66 V106 H8 Z" fill="#0b1c2d"/>
      <circle cx="118" cy="30" r="12" fill="#2e4d6b"/>
      ${cells}</svg>`;
  };

  /* Grelhas de composição por cima de uma moldura (ou de uma fotografia,
     quando o bloco lhe passa `over`). */
  /* Grelhas de composição, para sobrepor a uma fotografia.
     REGRA: uma marcação tem de corresponder ao que está na imagem. Uma
     grelha que desenha uma relação inexistente (o ponto de fuga onde ele
     não está, o "vazio" por cima do sujeito) é pior do que marcação
     nenhuma — ensina o observador a desconfiar do portal. Por isso as
     posições são parâmetros e vêm medidas na fotografia:
       sx, sy  — onde está mesmo o assunto (fração do enquadramento)
       ax      — posição do eixo de simetria; `axis` = 'h' ou 'v'
       d       — [x1,y1,x2,y2] da diagonal, em fração */
  ART.guide = (o = {}) => {
    const W = 160, H = 107, k = o.k || 'thirds';
    const sx = (o.sx == null ? 0.66 : o.sx) * W, sy = (o.sy == null ? 0.33 : o.sy) * H;
    const dot = `<circle cx="${n(sx)}" cy="${n(sy)}" r="5.5" fill="${C.gold}" stroke="rgba(0,0,0,.5)" stroke-width="1"/>`;
    const axis = o.axis === 'v' ? 'v' : 'h';
    const ax = (o.ax == null ? 0.5 : o.ax);
    const d = o.d || [0.28, 0.3, 0.93, 0.86];
    const g = {
      thirds: `<g stroke="${C.cyan}" stroke-width="1.3" opacity=".9">
        <line x1="${W / 3}" y1="0" x2="${W / 3}" y2="${H}"/><line x1="${2 * W / 3}" y1="0" x2="${2 * W / 3}" y2="${H}"/>
        <line x1="0" y1="${H / 3}" x2="${W}" y2="${H / 3}"/><line x1="0" y1="${2 * H / 3}" x2="${W}" y2="${2 * H / 3}"/></g>${dot}`,
      centro: (axis === 'h'
        ? `<line x1="0" y1="${n(H * ax)}" x2="${W}" y2="${n(H * ax)}" stroke="${C.cyan}" stroke-width="1.6"/>`
        : `<line x1="${n(W * ax)}" y1="0" x2="${n(W * ax)}" y2="${H}" stroke="${C.cyan}" stroke-width="1.6"/>`) + dot,
      linhas: `<path d="M2 ${H - 2} L${n(sx)} ${n(sy)} M${W - 2} ${H - 2} L${n(sx)} ${n(sy)}"
        stroke="${C.cyan}" stroke-width="1.6" fill="none"/>${dot}`,
      moldura: `<rect x="7" y="5" width="${W - 14}" height="${H - 10}" rx="3" fill="none" stroke="${C.cyan}" stroke-width="7" opacity=".5"/>${dot}`,
      espaco: (() => {
        // O vazio é o lado OPOSTO ao assunto, nunca a área que o contém.
        const left = (o.sx == null ? 0.66 : o.sx) < 0.5;
        const x0 = left ? sx + W * 0.13 : W * 0.02, w = left ? W * 0.85 - sx : sx - W * 0.15;
        return `<rect x="${n(x0)}" y="4" width="${n(Math.max(10, w))}" height="${H - 8}" rx="3" fill="${C.cyan}" opacity=".12"/>
          ${txt(x0 + Math.max(10, w) / 2, H * 0.5, 'vazio', { anchor: 'middle', fs: 8.5, fg: C.ink, w: 500 })}${dot}`;
      })(),
      diagonal: `<line x1="${n(W * d[0])}" y1="${n(H * d[1])}" x2="${n(W * d[2])}" y2="${n(H * d[3])}"
        stroke="${C.cyan}" stroke-width="2"/>${dot}`,
      camadas: `${[0.34, 0.58, 0.86].map((t, i) => `<path d="M0 ${n(H * t)} Q${W / 2} ${n(H * t - 12)} ${W} ${n(H * t)} V${H} H0 Z"
        fill="${C.cyan}" opacity="${0.09 + i * 0.09}"/>`).join('')}`,
    };
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg cc-guide" role="img" aria-label="Grelha de composição" preserveAspectRatio="none">
      ${o.over ? '' : `<rect width="${W}" height="${H}" rx="4" fill="#102438"/>`}
      ${g[k] || g.thirds}</svg>`;
  };

  /* Escala de velocidades com o limite de sincronização do flash. */
  ART.sync = () => {
    const W = 460, H = 84, x0 = 24, x1 = W - 24;
    const stops = ['30s', '1s', '1/30', '1/200', '1/1000', '1/8000'];
    const syncX = x0 + (x1 - x0) * 0.62;
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Limite de sincronização do flash">
      ${stage(W, H)}
      <rect x="${x0}" y="30" width="${n(syncX - x0)}" height="16" rx="3" fill="${C.good}" opacity=".55"/>
      <rect x="${n(syncX)}" y="30" width="${n(x1 - syncX)}" height="16" rx="3" fill="${C.bad}" opacity=".45"/>
      <line x1="${n(syncX)}" y1="22" x2="${n(syncX)}" y2="54" stroke="${C.gold}" stroke-width="2"/>
      ${stops.map((s, i) => txt(x0 + (x1 - x0) * (i / (stops.length - 1)), 66, s,
        { anchor: 'middle', fs: 8.5, fg: C.dim, w: 500 })).join('')}
      ${tag(syncX - 6, 20, 'sincroniza', { anchor: 'end', fg: C.good })}
      ${tag(syncX + 6, 20, 'faixa preta (ou HSS)', { fg: C.bad })}
    </svg>`;
  };

  /* Onde cortar uma pessoa — as linhas seguras e as que doem. */
  /* Onde cortar. Desenhado sobre a personagem fotográfica que o portal já
     tem (`crop-standing`, grupo `crop` do photogen) e não sobre uma
     silhueta: as linhas de corte só ensinam se se vir onde ficam os
     ombros, os pulsos e os joelhos de uma pessoa a sério. A silhueta fica
     como recurso quando o asset não está disponível.
     `t` = fração da altura da IMAGEM, calibrada nessa fotografia. */
  ART.crop = (o = {}) => {
    if (!o.img) return cropSilhouette();
    const W = 268, H = 300, iw = 196, ix = 6;
    const AR = 832 / 1216;                 // proporção real de crop-standing
    const ih = iw / AR, iy = (H - ih) / 2; // banda que a imagem ocupa mesmo
    /* `t` medido na fotografia (fração da altura da imagem): cabeça 4%,
       queixo 14%, ombros 19%, peito 27%, pulsos 44%, anca 47%,
       meia-coxa 58%, joelhos 69%, tornozelos 86%. */
    const lines = [
      { t: 0.02, ok: 1, lbl: 'acima da cabeça' },
      { t: 0.16, ok: 0, lbl: 'pescoço' },
      { t: 0.28, ok: 1, lbl: 'peito' },
      { t: 0.44, ok: 0, lbl: 'cintura / pulsos' },
      { t: 0.58, ok: 1, lbl: 'meia-coxa' },
      { t: 0.69, ok: 0, lbl: 'joelhos' },
      { t: 0.86, ok: 0, lbl: 'tornozelos' },
    ];
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img"
      aria-label="Linhas de corte seguras e a evitar sobre uma figura de corpo inteiro">
      ${stage(W, H, C.stage2)}
      <image href="${esc(o.img)}" x="${ix}" y="${n(iy)}" width="${iw}" height="${n(ih)}" preserveAspectRatio="xMidYMid meet"/>
      ${lines.map(l => {
        const y = iy + l.t * ih;
        const col = l.ok ? C.good : C.bad;
        return `<line x1="6" y1="${n(y)}" x2="${W - 6}" y2="${n(y)}" stroke="${col}" stroke-width="1.8"
          stroke-dasharray="${l.ok ? '' : '6 4'}" opacity=".95"/>
          ${tag(W - 8, y - 3, (l.ok ? '✓ ' : '✗ ') + l.lbl, { anchor: 'end', fg: col, fs: 8.5 })}`;
      }).join('')}
    </svg>`;
  };

  function cropSilhouette() {
    const W = 190, H = 200, cx = 58, base = H - 6, fh = 176;
    /* `t` é a fração da altura da figura, a contar do topo da cabeça —
       calibrada com as articulações da silhueta desenhada em figure(). */
    const lines = [
      { t: -0.04, ok: 1, lbl: 'acima da cabeça' },
      { t: 0.14, ok: 0, lbl: 'pescoço' },
      { t: 0.30, ok: 1, lbl: 'peito' },
      { t: 0.50, ok: 0, lbl: 'cintura / pulsos' },
      { t: 0.64, ok: 1, lbl: 'meia-coxa' },
      { t: 0.78, ok: 0, lbl: 'joelhos' },
    ];
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Onde cortar o enquadramento de uma pessoa">
      ${stage(W, H, C.stage2)}
      ${figure(cx, base, fh, '#5f92bb')}
      ${lines.map(l => {
        const y = base - fh + fh * l.t;
        const col = l.ok ? C.good : C.bad;
        return `<line x1="10" y1="${n(y)}" x2="${W - 10}" y2="${n(y)}" stroke="${col}" stroke-width="1.6"
          stroke-dasharray="${l.ok ? '' : '5 4'}" opacity=".95"/>
          ${txt(W - 12, y - 4, (l.ok ? '✓ ' : '✗ ') + l.lbl, { anchor: 'end', fs: 8, fg: col })}`;
      }).join('')}
    </svg>`;
  }

  /* Planta de luz natural: janela, sujeito e câmara. */
  /* Planta de luz natural: janela, sujeito e câmara vistos de cima.
     `k` = onde está a janela em relação ao eixo da câmara (graus). */
  ART.window = (o = {}) => {
    const W = 180, H = 160, cx = 90, cy = 74;
    const ANG = { frente: 5, lado45: 45, lado: 90, contra: 155 };
    const ang = ANG[o.k] == null ? 45 : ANG[o.k];
    const a = ang * Math.PI / 180, R = 58;
    /* Luz quase frontal cai em cima da câmara (as duas estão no mesmo
       eixo): a janela desvia-se para o lado para os dois rótulos não
       ficarem um por cima do outro. */
    const off = Math.abs(ang) < 25 ? -38 : 0;
    const wx = cx - Math.sin(a) * R + off, wy = cy + Math.cos(a) * R;
    // cone: da largura da janela até ao sujeito
    const px = -Math.cos(a), py = -Math.sin(a);   // perpendicular ao eixo luz→sujeito
    const hw = 20;
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Planta: janela, sujeito e câmara">
      ${stage(W, H, C.stage2)}
      <path d="M${n(wx + px * hw)} ${n(wy + py * hw)} L${n(cx + px * 15)} ${n(cy + py * 15)}
        L${n(cx - px * 15)} ${n(cy - py * 15)} L${n(wx - px * hw)} ${n(wy - py * hw)} Z" fill="#bfe3ff" opacity=".2"/>
      <g transform="translate(${n(wx)} ${n(wy)}) rotate(${n(-ang)})">
        <rect x="-20" y="-4" width="40" height="8" rx="1.5" fill="#bfe3ff" opacity=".92"/>
        <line x1="0" y1="-4" x2="0" y2="4" stroke="#0b1220" stroke-width="1.6"/></g>
      ${txt(wx - Math.sin(a) * 17, wy + Math.cos(a) * 17 + 3, 'janela', { anchor: 'middle', fs: 8.5, fg: '#bfe3ff', w: 400 })}
      <circle cx="${cx}" cy="${cy}" r="13" fill="#e9cdb0"/>
      <path d="M${cx} ${cy + 19} L${cx - 4.5} ${cy + 11} L${cx + 4.5} ${cy + 11} Z" fill="#c9a882"/>
      ${cam(cx, H - 26, 0.85, -90)}
      ${txt(cx, H - 6, 'câmara', { anchor: 'middle', fs: 8.5, fg: C.cyan, w: 400 })}
      ${o.refl ? `<g transform="translate(${n(cx + Math.sin(a) * 46)} ${n(cy - Math.cos(a) * 46)}) rotate(${n(-ang)})">
        <rect x="-16" y="-3" width="32" height="6" rx="2" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 3"/></g>
        ${txt(cx + Math.sin(a) * 46, cy - Math.cos(a) * 46 + (Math.cos(a) > 0 ? -8 : 16), 'refletor', { anchor: 'middle', fs: 8, fg: '#cbd5e1', w: 400 })}` : ''}
    </svg>`;
  };

  /* Rasto de movimento: o comprimento é proporcional ao tempo. */
  ART.motion = (o = {}) => {
    const W = 160, H = 100, t = o.t == null ? 0.4 : o.t;
    const len = 10 + t * 96;
    const ghosts = Math.max(1, Math.round(t * 9));
    let g = '';
    for (let i = ghosts; i >= 1; i--) {
      g += `<rect x="${n(120 - (i / ghosts) * len)}" y="42" width="26" height="16" rx="3"
        fill="${C.cyan}" opacity="${n(0.1 + 0.5 * (1 - i / ghosts))}"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img" aria-label="Rasto de movimento">
      ${stage(W, H, C.stage2)}${g}
      <rect x="120" y="42" width="26" height="16" rx="3" fill="${t > 0.5 ? C.gold : C.cyan}"/>
      <circle cx="126" cy="60" r="4" fill="#081018"/><circle cx="140" cy="60" r="4" fill="#081018"/>
    </svg>`;
  };

  /* Compressão: porque é que a MESMA pessoa, do mesmo tamanho no
     enquadramento, traz fundos completamente diferentes conforme a focal.
     Duas plantas lado a lado — é a distância que muda a perspetiva, não a
     lente; a lente só decide de que distância podes trabalhar. */
  ART.compress = () => {
    const W = 460, H = 190, pw = (W - 10) / 2;
    const half = (x0, mm, dist, lbl, col) => {
      const ox = x0 + 22, oy = H - 34, ang = Math.atan(18 / mm);
      const sy = oy - dist;                    // sujeito, à distância desenhada
      const spread = Math.tan(ang) * dist;
      return `<rect x="${n(x0)}" y="0" width="${n(pw)}" height="${n(H)}" rx="8" fill="${C.stage2}"/>
        <path d="M${n(ox)} ${n(oy)} L${n(ox - spread)} ${n(sy - 46)} L${n(ox + spread)} ${n(sy - 46)} Z"
          fill="${col}" opacity=".12"/>
        <path d="M${n(ox)} ${n(oy)} L${n(ox - spread)} ${n(sy - 46)} M${n(ox)} ${n(oy)} L${n(ox + spread)} ${n(sy - 46)}"
          stroke="${col}" stroke-width="1.4" fill="none"/>
        <line x1="${n(x0 + 8)}" y1="${n(sy - 46)}" x2="${n(x0 + pw - 8)}" y2="${n(sy - 46)}"
          stroke="rgba(255,255,255,.25)" stroke-width="1.5" stroke-dasharray="4 3"/>
        ${txt(x0 + pw - 10, sy - 51, 'fundo', { anchor: 'end', fs: 8, fg: C.dim, w: 400 })}
        <circle cx="${n(ox)}" cy="${n(sy)}" r="9" fill="#e9cdb0"/>
        ${cam(ox, oy, 0.85, -90)}
        ${txt(x0 + pw / 2, 18, lbl, { anchor: 'middle', fs: 9.5, fg: col, w: 400 })}
        ${txt(x0 + pw / 2, 30, `${Math.round(2 * ang * 180 / Math.PI)}° de fundo no enquadramento`,
          { anchor: 'middle', fs: 8, fg: C.dim, w: 400 })}`;
    };
    return `<svg viewBox="0 0 ${W} ${H}" class="cc-svg" role="img"
      aria-label="Mesma pessoa do mesmo tamanho: perto com grande angular apanha muito fundo, longe com tele apanha pouco">
      ${half(0, 24, 40, '24mm · a 1 m', C.cyan)}
      ${half(pw + 10, 85, 118, '85mm · a 3,5 m', C.gold)}
      ${txt(W / 2, H - 8, 'a pessoa ocupa o mesmo no enquadramento — muda o que lhe fica atrás',
        { anchor: 'middle', fs: 8, fg: C.dim, w: 400 })}
    </svg>`;
  };

  /* ══ 3. BLOCOS ═══════════════════════════════════════════════════════
     Cada bloco é uma forma de apresentar informação; um cheatsheet escolhe
     as que servem o seu assunto. Não há template obrigatório — de
     propósito: uma progressão, uma comparação e uma grelha de referência
     não se leem da mesma maneira. */

  const inline = s => String(s == null ? '' : s)
    .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  /* Uma ilustração pedida por id pode viver aqui OU já existir no
     PhotoIllus (as de Aprender e Equipamento). Procurar nos dois evita
     redesenhar o que o portal já sabe desenhar — e mantém o vocabulário
     visual único entre capítulos. */
  function art(id, opts) {
    if (ART[id]) return ART[id](opts || {});
    if (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(id)) return PhotoIllus.svg(id);
    return '';
  }
  const has = id => !!ART[id] || (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(id));

  // Visual de uma célula: SVG, fotografia (do projeto ou calculada ao
  // vivo), amostra de cor ou ícone — com grelha por cima quando pedida.
  function cellVis(c, b, ctx) {
    const ov = c.overlay ? `<span class="cc-ov">${art(c.overlay.art || c.overlay, Object.assign({ over: 1 }, c.overlay.opts))}</span>` : '';
    const ar = c.ar || b.ar;
    const box = (cls, inner) => `<span class="cc-vis ${cls}"${ar ? ` style="aspect-ratio:${ar}"` : ''}>${inner}${ov}</span>`;
    if (c.art) return box('', art(c.art, c.opts));
    if (c.asset) {
      const src = (ctx && ctx.assetPath && ctx.assetPath(c.asset)) || '';
      if (src) return box('cc-vis-photo', `<img loading="lazy" decoding="async" src="${esc(src)}" alt="${esc(c.alt || '')}">`);
      if (c.fallback) return box('', art(c.fallback, c.opts));
      return '';
    }
    if (c.recipe) {
      const src = (ctx && ctx.assetPath && ctx.assetPath(c.base || b.base)) || '';
      if (!src) return c.fallback ? box('', art(c.fallback, c.opts)) : '';
      return box('cc-vis-photo', `<canvas class="cc-canvas" data-src="${esc(src)}" data-recipe='${esc(JSON.stringify(c.recipe))}'
        aria-label="${esc(c.alt || (c.v + ': ' + (c.note || '')))}"></canvas>`);
    }
    if (c.kelvin) return `<span class="cc-vis cc-vis-swatch" style="background:${kelvinRGB(c.kelvin)}"></span>`;
    if (c.ico) return `<span class="cc-vis cc-vis-ico">${c.ico}</span>`;
    return '';
  }

  /* Progressão: a peça central do sistema. Os valores ficam grandes, o
     visual manda, e a nota é uma linha — nunca um parágrafo. */
  /* `mark` marca a escolha recomendada. Tem de se ler como ETIQUETA e não
     como estado selecionado: com moldura dourada e fundo tingido, uma
     célula parecia um botão escolhido e quem lia tentava clicar nas
     outras. Aceita `true` (→ "recomendado") ou um texto próprio. */
  const markTag = m => (m ? `<span class="cc-mark">★ ${esc(m === true ? 'recomendado' : m)}</span>` : '');

  function strip(b, ctx) {
    const cells = b.cells || [];
    const sim = cells.some(c => c.recipe);
    return `<figure class="cc-block cc-strip" data-cells="${cells.length}">
      ${blockHead(b, sim)}
      <div class="cc-track"${b.snap === false ? '' : ' tabindex="0"'} role="list">
        ${cells.map(c => `<div class="cc-cell${c.mark ? ' mark' : ''}" role="listitem">
          ${cellVis(c, b, ctx)}
          <span class="cc-v">${inline(c.v)}</span>
          ${c.lab ? `<span class="cc-lab">${inline(c.lab)}</span>` : ''}
          ${markTag(c.mark)}
          ${c.note ? `<p class="cc-note">${inline(c.note)}</p>` : ''}
        </div>`).join('')}
      </div>
      ${b.axis ? `<div class="cc-axis"><span>← ${esc(b.axis[0])}</span><span>${esc(b.axis[1])} →</span></div>` : ''}
      ${b.foot ? `<figcaption class="cc-foot">${inline(b.foot)}</figcaption>` : ''}
    </figure>`;
  }

  function blockHead(b, sim) {
    if (!b.t && !b.hint && !sim) return '';
    return `<figcaption class="cc-head">
      ${b.t ? `<span class="cc-t">${inline(b.t)}</span>` : ''}
      ${b.hint ? `<span class="cc-hint">${inline(b.hint)}</span>` : ''}
      ${sim ? '<span class="cc-sim" title="A mesma fotografia processada ao vivo: só muda a variável desta tira">simulado</span>' : ''}
    </figcaption>`;
  }

  // Grelha de referência compacta: muitos itens, uma linha cada.
  /* `layout:'cards'` põe o visual em cima e o texto por baixo, à largura
     toda da célula. É preciso quando a IMAGEM é o conteúdo (grelhas de
     composição sobre fotografias): em linha, a miniatura fica com 76px e
     a marcação deixa de se ver. */
  function grid(b, ctx) {
    const items = b.items || [];
    return `<figure class="cc-block cc-grid${b.layout === 'cards' ? ' cards' : ''}" data-cols="${b.cols || 0}">
      ${blockHead(b, items.some(i => i.recipe))}
      <div class="cc-gitems">
        ${items.map(i => `<div class="cc-gitem${i.mark ? ' mark' : ''}">
          ${cellVis(i, b, ctx)}
          <div class="cc-gtxt">
            <span class="cc-gk">${inline(i.k)}</span>
            ${i.v ? `<span class="cc-gv">${inline(i.v)}</span>` : ''}
            ${markTag(i.mark)}
            ${i.note ? `<span class="cc-gn">${inline(i.note)}</span>` : ''}
          </div>
        </div>`).join('')}
      </div>
      ${b.foot ? `<figcaption class="cc-foot">${inline(b.foot)}</figcaption>` : ''}
    </figure>`;
  }

  // Comparação de dois estados. Fotografias reais quando existem.
  function versus(b, ctx) {
    const side = (s, cls) => `<figure class="cc-vs-side ${cls}">
      ${cellVis(s, b, ctx)}
      <figcaption><span class="cc-v">${inline(s.v)}</span>${s.note ? `<p class="cc-note">${inline(s.note)}</p>` : ''}</figcaption>
    </figure>`;
    return `<figure class="cc-block cc-vs">
      ${blockHead(b, !!(b.a && b.a.recipe))}
      <div class="cc-vs-pair">${side(b.a, 'a')}${side(b.b, 'b')}</div>
      ${b.foot ? `<figcaption class="cc-foot">${inline(b.foot)}</figcaption>` : ''}
    </figure>`;
  }

  // Diagrama único, a toda a largura.
  function diagram(b) {
    return `<figure class="cc-block cc-diag">
      ${blockHead(b)}
      <div class="cc-diag-art">${art(b.art, b.opts)}</div>
      ${b.foot ? `<figcaption class="cc-foot">${inline(b.foot)}</figcaption>` : ''}
    </figure>`;
  }

  // Regras de bolso: imperativas, uma linha, sem prosa.
  function rules(b) {
    return `<div class="cc-block cc-rules">
      ${b.t ? `<div class="cc-head"><span class="cc-t">${inline(b.t)}</span></div>` : ''}
      <ul>${(b.items || []).map(i => `<li>${inline(i)}</li>`).join('')}</ul>
    </div>`;
  }

  // Passos numerados (ordem de decisão).
  function steps(b) {
    return `<div class="cc-block cc-steps">
      ${b.t ? `<div class="cc-head"><span class="cc-t">${inline(b.t)}</span></div>` : ''}
      <ol>${(b.items || []).map(i => `<li>${inline(i)}</li>`).join('')}</ol>
    </div>`;
  }

  // Tabela — só quando a informação é mesmo tabular (3+ colunas cruzadas).
  function table(b) {
    return `<figure class="cc-block cc-tablewrap">
      ${blockHead(b)}
      <table class="cc-table">
        <thead><tr>${(b.cols || []).map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${(b.rows || []).map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="cc-td-k"' : ''}>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </figure>`;
  }

  function note(b) {
    return `<p class="cc-block cc-inline-note${b.warn ? ' warn' : ''}">${inline(b.text)}</p>`;
  }

  /* Comparação certo/errado com os três modos do portal (lado a lado ·
     cortina · alternar). Mostrar só o que está bem deixa quem lê a fazer
     o erro sem saber que o está a fazer — por isso, sempre que existe um
     par real de fotografias, é este bloco que se usa e não uma tira.
     Delega no PhotoLearn para não haver dois comparadores no portal. */
  function compare(b, ctx) {
    if (typeof PhotoLearn === 'undefined' || !PhotoLearn.compare) return '';
    const path = id => (ctx && ctx.assetPath && ctx.assetPath(id)) || '';
    const a = path(b.a), bb = path(b.b);
    if (!a || !bb) return '';
    return `<figure class="cc-block cc-cmp">
      ${blockHead(b)}
      ${PhotoLearn.compare({
        fam: b.fam || 'cs', a, b: bb, ar: b.ar || '', modes: b.modes || ['side', 'wipe', 'flip'],
        aTag: b.aTag || 'Aplica', bTag: b.bTag || 'Não aplica',
        aAlt: b.aAlt || b.aTag || '', bAlt: b.bAlt || b.bTag || '',
        aWhy: b.aWhy || '', bWhy: b.bWhy || '',
        neutral: !!b.neutral, q: b.q || '', caption: b.foot || '',
      })}
    </figure>`;
  }

  const KINDS = { strip, grid, versus, diagram, rules, steps, table, note, compare };

  function block(b, ctx) {
    if (!b || !b.kind) return '';
    const fn = KINDS[b.kind];
    return fn ? fn(b, ctx) : '';
  }

  /* ══ 4. LIGAÇÃO ══════════════════════════════════════════════════════
     As tiras fotográficas custam píxeis: cada célula é uma passagem pelo
     motor. São pintadas só quando entram no ecrã, para que abrir um
     cheatsheet com quatro tiras não bloqueie o telemóvel. */
  let _io = null;
  /* A imagem é processada à largura a que vai ser MOSTRADA (arredondada
     para múltiplos de 40 para as células de uma tira partilharem a mesma
     entrada de cache). Sem isto, em ecrã inteiro uma célula de 560px
     mostrava uma imagem calculada a 300px — e a tira que ensina nitidez
     aparecia toda mole. */
  function paint(cv) {
    if (cv.dataset.done) return;
    cv.dataset.done = '1';
    let recipe = {};
    try { recipe = JSON.parse(cv.dataset.recipe || '{}'); } catch (_) {}
    if (typeof PhotoLearn === 'undefined' || !PhotoLearn.paintThumb) return;
    const box = cv.clientWidth || (cv.parentElement && cv.parentElement.clientWidth) || 300;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.min(880, Math.ceil(box * dpr / 40) * 40);
    PhotoLearn.paintThumb(cv, cv.dataset.src, recipe, w);
  }

  function wire(root) {
    if (!root) return;
    const cvs = root.querySelectorAll('canvas.cc-canvas');
    if (!cvs.length) return;
    if (!('IntersectionObserver' in window)) { cvs.forEach(paint); return; }
    if (!_io) {
      _io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { paint(e.target); _io.unobserve(e.target); }
      }), { rootMargin: '240px 0px' });
    }
    cvs.forEach(c => _io.observe(c));
  }

  return { block, art, has, wire, setSubject, kelvinRGB, dofCalc, list: () => Object.keys(ART) };
})();
