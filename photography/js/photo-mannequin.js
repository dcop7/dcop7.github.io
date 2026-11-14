/* ══════════════════════════════════════════════════════════════════════
   Mannequin — figura vetorial paramétrica (manequim de artista).

   Neutra: sem rosto, sem roupa, sem género. O foco é a LINGUAGEM CORPORAL —
   posição de pernas, ombros, peso, orientação, braços e mãos. As articulações
   (ombro, cotovelo, pulso, anca, joelho, tornozelo) são visíveis, o que a torna
   ideal também para o guia "Onde cortar".

   Uma pose = um mapa de articulações (posições 2D num viewBox 200×380). O mesmo
   rig serve retrato, moda, casal, eventos, desporto, dança… (reutilização máx).

   API:
     Mannequin.figure(poseId | jointsMap, {crop}) → string SVG
     Mannequin.cropGuide()                        → string SVG do guia de corte
     Mannequin.wireCropGuide(rootEl)              → liga hover/tooltips
     Mannequin.POSES                              → biblioteca de poses
   ════════════════════════════════════════════════════════════════════ */
const Mannequin = (function () {
  'use strict';

  const W = 200, H = 380;
  let _uid = 0; const uid = p => `${p}${(++_uid).toString(36)}`;

  // ── geometria ─────────────────────────────────────────────────────
  // Segmento cónico (capsula) entre a e b, com meia-largura w1→w2.
  function seg(a, b, w1, w2) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const P = (pt, w, s) => `${(pt[0] + nx * w * s).toFixed(1)},${(pt[1] + ny * w * s).toFixed(1)}`;
    return `<polygon points="${P(a, w1, 1)} ${P(b, w2, 1)} ${P(b, w2, -1)} ${P(a, w1, -1)}"/>`;
  }
  const disc = (p, r) => `<circle cx="${p[0]}" cy="${p[1]}" r="${r}"/>`;

  // Torso como caminho suave (ombros → cintura → ancas).
  function torso(J) {
    const [slx, sly] = J.shoulderL, [srx, sry] = J.shoulderR;
    const [hlx, hly] = J.hipL, [hrx, hry] = J.hipR;
    const waistY = (sly + hly) / 2;
    const wl = Math.min(slx, hlx) - 2, wr = Math.max(srx, hrx) + 2;
    return `<path d="M${slx} ${sly}
      C${slx - 4} ${sly + 12} ${wl} ${waistY - 14} ${wl + 1} ${waistY}
      C${wl} ${waistY + 12} ${hlx - 3} ${hly - 8} ${hlx} ${hly}
      L${hrx} ${hry}
      C${hrx + 3} ${hry - 8} ${wr} ${waistY + 12} ${wr - 1} ${waistY}
      C${wr} ${waistY - 14} ${srx + 4} ${sry + 12} ${srx} ${sry} Z"/>`;
  }

  // ── render da figura ──────────────────────────────────────────────
  function figureSVG(J, opts = {}) {
    const g = uid('mq'), extra = opts.overlay || '';
    // segmentos (membros) — larguras afinadas para leitura de manequim
    const limbs = [
      seg(J.shoulderL, J.elbowL, 8.5, 6), seg(J.elbowL, J.wristL, 6, 4.2),
      seg(J.shoulderR, J.elbowR, 8.5, 6), seg(J.elbowR, J.wristR, 6, 4.2),
      seg(J.hipL, J.kneeL, 12, 8.5), seg(J.kneeL, J.ankleL, 8.5, 5.5),
      seg(J.hipR, J.kneeR, 12, 8.5), seg(J.kneeR, J.ankleR, 8.5, 5.5),
    ].join('');
    const neckMid = [(J.shoulderL[0] + J.shoulderR[0]) / 2, (J.shoulderL[1] + J.shoulderR[1]) / 2];
    const body = torso(J) + seg(J.neck, neckMid, 6.5, 8);
    // articulações + extremidades
    const joints = [J.shoulderL, J.shoulderR, J.elbowL, J.elbowR, J.hipL, J.hipR, J.kneeL, J.kneeR]
      .map(p => disc(p, 3.2)).join('');
    const hands = disc(J.wristL, 5) + disc(J.wristR, 5);
    const feet = footShape(J.kneeL, J.ankleL) + footShape(J.kneeR, J.ankleR);
    const headR = J.headR || 21;
    const head = `<ellipse cx="${J.head[0]}" cy="${J.head[1]}" rx="${headR * 0.86}" ry="${headR}"/>`;

    return `<svg viewBox="0 0 ${W} ${H}" class="mq-svg" role="img" aria-label="Manequim de pose">
      <defs>
        <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--mq-hi,#c3cee0)"/>
          <stop offset="1" stop-color="var(--mq-lo,#7a879f)"/>
        </linearGradient>
      </defs>
      <g fill="url(#${g})" stroke="var(--mq-edge,rgba(10,16,28,.28))" stroke-width="1" stroke-linejoin="round">
        ${feet}${limbs}${body}${hands}${head}
      </g>
      <g fill="var(--mq-joint,rgba(20,28,44,.4))" stroke="none">${joints}</g>
      ${extra}
    </svg>`;
  }

  // Pé simples: pequeno oval na direção perna→tornozelo, virado para a frente.
  function footShape(knee, ankle) {
    const dir = ankle[0] >= knee[0] ? 1 : -1;
    return `<ellipse cx="${ankle[0] + dir * 3}" cy="${ankle[1] + 2}" rx="8" ry="4.5"/>`;
  }

  // ── biblioteca de poses (posições de articulações) ────────────────
  // x centrado ~100. Poses "de frente" com assimetrias que sugerem 3/4, etc.
  const NEUTRAL = {
    head: [100, 40], headR: 21, neck: [100, 64],
    shoulderL: [80, 82], shoulderR: [120, 82],
    elbowL: [74, 140], elbowR: [126, 140],
    wristL: [71, 196], wristR: [129, 196],
    hipL: [88, 192], hipR: [112, 192],
    kneeL: [91, 274], kneeR: [109, 274],
    ankleL: [92, 354], ankleR: [108, 354],
  };

  const POSES = {
    'pose-three-quarter': {
      head: [104, 40], headR: 20, neck: [102, 64],
      shoulderL: [86, 80], shoulderR: [120, 84],
      elbowL: [80, 138], elbowR: [128, 138],
      wristL: [82, 192], wristR: [126, 190],
      hipL: [92, 190], hipR: [114, 194],
      kneeL: [96, 272], kneeR: [116, 272],
      ankleL: [96, 354], ankleR: [120, 352],
    },
    'pose-busy-hands': {
      head: [100, 42], headR: 20, neck: [100, 66],
      shoulderL: [80, 84], shoulderR: [120, 84],
      elbowL: [72, 120], elbowR: [128, 120],
      wristL: [88, 74], wristR: [112, 74],           // mãos até ao cabelo
      hipL: [88, 194], hipR: [112, 194],
      kneeL: [90, 276], kneeR: [110, 276],
      ankleL: [91, 356], ankleR: [109, 356],
    },
    'pose-s-curve': {
      head: [96, 40], headR: 20, neck: [98, 64],
      shoulderL: [78, 82], shoulderR: [116, 80],     // ombros p/ um lado
      elbowL: [74, 138], elbowR: [122, 140],
      wristL: [78, 190], wristR: [118, 192],
      hipL: [92, 190], hipR: [116, 190],             // anca p/ o outro
      kneeL: [96, 274], kneeR: [110, 276],
      ankleL: [98, 354], ankleR: [104, 356],
    },
    'pose-leaning': {
      head: [110, 44], headR: 20, neck: [106, 66],
      shoulderL: [88, 84], shoulderR: [124, 86],
      elbowL: [82, 140], elbowR: [130, 138],
      wristL: [92, 186], wristR: [120, 186],         // mãos nos bolsos
      hipL: [92, 194], hipR: [116, 196],
      kneeL: [96, 276], kneeR: [112, 278],
      ankleL: [104, 356], ankleR: [116, 352],        // tornozelos cruzados
    },
  };

  function figure(pose, opts) {
    const J = typeof pose === 'string' ? (POSES[pose] || NEUTRAL) : pose;
    return figureSVG(J, opts);
  }

  // ── guia "Onde cortar" ────────────────────────────────────────────
  // Linhas alinhadas às articulações da figura neutra. ok:1 verde (cortar aqui),
  // ok:0 vermelho (nunca cortar numa articulação).
  const CROP_LINES = [
    { y: 16, ok: 1, label: 'espaço p/ cabeça' },
    { y: 64, ok: 0, label: 'pescoço' },
    { y: 112, ok: 1, label: 'meio do peito' },
    { y: 140, ok: 0, label: 'cotovelos' },
    { y: 170, ok: 1, label: 'cintura' },
    { y: 196, ok: 0, label: 'pulsos / mãos' },
    { y: 233, ok: 1, label: 'meio da coxa' },
    { y: 274, ok: 0, label: 'joelhos' },
    { y: 354, ok: 0, label: 'tornozelos' },
  ];
  // Articulações a assinalar (anel), sem texto — as linhas já rotulam.
  const CROP_JOINTS = [NEUTRAL.shoulderL, NEUTRAL.shoulderR, NEUTRAL.elbowL, NEUTRAL.elbowR,
    NEUTRAL.wristL, NEUTRAL.wristR, NEUTRAL.hipL, NEUTRAL.hipR, NEUTRAL.kneeL, NEUTRAL.kneeR, NEUTRAL.ankleL, NEUTRAL.ankleR];
  const VBW = 320;   // viewBox largo: figura à esquerda, rótulos à direita

  function cropGuide() {
    const GOOD = '#34d399', BAD = '#f87171', figW = 152;
    const lines = CROP_LINES.map((c, i) => {
      const col = c.ok ? GOOD : BAD;
      return `<g class="mq-crop-line" data-i="${i}" tabindex="0" role="button"
          aria-label="${c.ok ? 'Bom corte' : 'Mau corte'}: ${c.label}">
        <rect class="mq-hit" x="0" y="${c.y - 8}" width="${VBW}" height="16" fill="transparent"/>
        <line class="mq-line" x1="12" y1="${c.y}" x2="${figW}" y2="${c.y}" stroke="${col}" stroke-width="1.7" stroke-dasharray="5 4"/>
        <circle cx="${figW}" cy="${c.y}" r="2.6" fill="${col}"/>
        <text x="${figW + 9}" y="${c.y + 3.4}" fill="${col}" font-size="10" font-family="var(--font-mono,monospace)">${c.ok ? '✓' : '✗'} ${c.label}</text>
      </g>`;
    }).join('');
    const jointMarks = CROP_JOINTS.map(p =>
      `<circle cx="${p[0]}" cy="${p[1]}" r="4.4" fill="none" stroke="#eab308" stroke-width="1.5" opacity=".85"/>`).join('');
    const dim = `<rect class="mq-crop-dim" x="0" y="0" width="${VBW}" height="0" fill="rgba(2,6,14,.58)" style="pointer-events:none"/>`;

    return `<svg viewBox="0 0 ${VBW} ${H}" class="mq-svg mq-crop" role="img" aria-label="Onde cortar um retrato">
      ${figureNeutralInner()}
      ${dim}
      <g class="mq-joints">${jointMarks}</g>
      ${lines}
    </svg>`;
  }

  // Figura neutra sem <svg> wrapper (para embeber no guia).
  function figureNeutralInner() {
    const full = figureSVG(NEUTRAL);
    return full.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  }

  function wireCropGuide(root) {
    if (!root) return;
    const dimEl = root.querySelector('.mq-crop-dim');
    root.querySelectorAll('.mq-crop-line').forEach(g => {
      const i = +g.dataset.i, c = CROP_LINES[i];
      const on = () => { if (dimEl) { dimEl.setAttribute('y', c.y); dimEl.setAttribute('height', H - c.y); } g.classList.add('hot'); };
      const off = () => { if (dimEl) dimEl.setAttribute('height', 0); g.classList.remove('hot'); };
      g.addEventListener('mouseenter', on); g.addEventListener('mouseleave', off);
      g.addEventListener('focus', on); g.addEventListener('blur', off);
    });
  }

  return { figure, cropGuide, wireCropGuide, POSES, NEUTRAL };
})();
