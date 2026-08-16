/* ══════════════════════════════════════════════════════════════════════
   PhotoLightArt — motor de desenho dos padrões de luz de retrato.

   Cada padrão rende DUAS ilustrações, como nos posters de estúdio:

     setup(p)  → planta vista de cima: sujeito, câmara, fundo e cada luz
                 no seu ângulo/altura, com o modificador desenhado.
     face(p)   → o RESULTADO: um rosto de frente com a sombra exata do
                 padrão (triângulo de Rembrandt, borboleta sob o nariz,
                 linha dura do split, laço do loop…).

   Porquê desenhado por código e não fotografado por IA: os padrões de
   estúdio foram testados no ComfyUI local (SDXL/Juggernaut) e o modelo
   devolve sempre luz de beleza plana — as 16 imagens sairiam iguais e a
   lição morria. Aqui a sombra é geometria, portanto está sempre certa,
   é consistente entre células e funciona offline. A luz NATURAL é o
   contrário (o modelo acerta), e essa vem em fotografia real via
   tools/photogen (grupo `lightpat`).

   Convenção de ângulos: `az` = graus a partir do eixo da câmara.
   Positivo = luz do lado ESQUERDO da imagem (ilumina o lado esquerdo do
   rosto de quem vê). `elev`: 1 = muito acima, 0 = à altura dos olhos,
   -1 = abaixo do queixo.
   ════════════════════════════════════════════════════════════════════ */
const PhotoLightArt = (function () {
  'use strict';

  let _uid = 0;
  const uid = p => `${p}${(++_uid).toString(36)}`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const R = d => (d * Math.PI) / 180;
  const n = v => Math.round(v * 10) / 10;

  /* ══ 1. PLANTA (vista de cima) ═══════════════════════════════════════
     Sujeito no centro, câmara em baixo, fundo em cima. Cada luz é
     colocada num círculo à volta do sujeito e desenhada com o seu
     modificador — o mesmo vocabulário do rodapé dos posters. */

  const D = { w: 210, h: 208, cx: 105, cy: 94, ring: 62, cam: 190 };

  function lightPos(l) {
    const az = R(l.az || 0);
    let r = D.ring * (l.dist === 'far' ? 1.18 : l.dist === 'close' ? 0.78 : 1);
    // Luz quase frontal cai em cima da câmara: encurta-se o raio para
    // sobrar espaço entre o modificador, o rótulo e o corpo da câmara.
    if (Math.abs(l.az || 0) < 28) r *= 0.86;
    return { x: D.cx - Math.sin(az) * r, y: D.cy + Math.cos(az) * r };
  }

  /* Modificadores: desenhados a apontar para o sujeito (rodados pelo az). */
  function modifier(kind, col) {
    const c = col || '#f5b74a';
    switch (kind) {
      case 'softbox':   // retângulo grande = luz suave
        return `<rect x="-13" y="-7" width="26" height="14" rx="2" fill="${c}" opacity=".9"/>
                <rect x="-13" y="-7" width="26" height="14" rx="2" fill="none" stroke="${c}" stroke-width="1.5"/>`;
      case 'strobe':    // refletor nu = luz dura
        return `<path d="M-6 -6 L6 -9 L6 9 L-6 6 Z" fill="${c}" opacity=".9"/>`;
      case 'honeycomb': // grelha = feixe estreito
        return `<path d="M-6 -6 L6 -8 L6 8 L-6 6 Z" fill="${c}" opacity=".9"/>
                <path d="M6 -8 L6 8" stroke="#0b1220" stroke-width="3"/>`;
      case 'brolly':    // guarda-chuva
        return `<path d="M-11 4 A11 11 0 0 1 11 4 Z" fill="${c}" opacity=".9"/>
                <path d="M0 4 L0 10" stroke="${c}" stroke-width="2"/>`;
      case 'reflector': // refletor prateado = superfície passiva
        return `<rect x="-12" y="-4" width="24" height="8" rx="2" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-dasharray="4 3"/>`;
      case 'window':
        return `<rect x="-16" y="-5" width="32" height="10" rx="1" fill="#bfe3ff" opacity=".85"/>
                <path d="M0 -5 L0 5" stroke="#0b1220" stroke-width="1.5"/>`;
      case 'sun':
        return `<circle r="8" fill="#ffd98a"/>
                <g stroke="#ffd98a" stroke-width="1.6" stroke-linecap="round">
                  <path d="M0 -13 L0 -10 M0 10 L0 13 M-13 0 L-10 0 M10 0 L13 0"/>
                </g>`;
      default:
        return `<circle r="7" fill="${c}"/>`;
    }
  }

  const ELEV_TAG = { 1: '▲ alta', 0.5: '▲ acima', 0: '● olhos', '-0.5': '▼ baixa', '-1': '▼ chão' };

  function setup(p) {
    const g = uid('sg');
    const lights = p.lights || [];
    const beams = lights.map(l => {
      const q = lightPos(l);
      const dx = D.cx - q.x, dy = D.cy - q.y, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      // Cone de luz: largo se o modificador for grande (suave), estreito se duro.
      const spread = l.kind === 'softbox' || l.kind === 'brolly' || l.kind === 'window' ? 15
        : l.kind === 'honeycomb' ? 5 : 10;
      const s = R(spread), px = -uy, py = ux;
      const tip = 26;
      const ax = q.x + ux * tip, ay = q.y + uy * tip;
      const half = Math.tan(s) * (len - tip);
      const bx = D.cx + px * half, by = D.cy + py * half;
      const cx2 = D.cx - px * half, cy2 = D.cy - py * half;
      const col = l.tint || '#f5b74a';
      return `<path d="M${n(ax)} ${n(ay)} L${n(bx)} ${n(by)} L${n(cx2)} ${n(cy2)} Z"
        fill="${col}" opacity="${l.role === 'fill' ? 0.1 : l.role === 'rim' ? 0.16 : 0.2}"/>`;
    }).join('');

    const heads = lights.map(l => {
      const q = lightPos(l);
      const rot = -(l.az || 0) + 180; // aponta para o sujeito
      const col = l.tint || (l.role === 'fill' ? '#8fb6e8' : '#f5b74a');
      const tag = l.tag || (l.elev != null ? ELEV_TAG[l.elev] : null);
      /* Colocação do rótulo: acima se a luz estiver atrás do sujeito, ao
         LADO se estiver na zona baixa — em baixo ao centro fica por cima
         do ícone da câmara e as duas legendas colidem. */
      let tx = q.x, ty = q.y + 21, anchor = 'middle';
      if (q.y < D.cy - 18) { ty = q.y - 15; }
      else if (q.y > D.cy + 28 && Math.abs(q.x - D.cx) > 14) {
        const right = q.x >= D.cx;
        tx = q.x + (right ? 21 : -21); ty = q.y + 3; anchor = right ? 'start' : 'end';
      }
      // Rótulo lateral que sai da tela volta para baixo da luz e é preso
      // à margem: cortado a meio não serve de rótulo nenhum.
      const tw = String(tag || '').length * 4.4;
      const l0 = anchor === 'end' ? tx - tw : anchor === 'start' ? tx : tx - tw / 2;
      if (tag && (l0 < 3 || l0 + tw > D.w - 3)) {
        anchor = 'middle'; ty = q.y + 21;
        tx = Math.min(D.w - tw / 2 - 3, Math.max(tw / 2 + 3, q.x));
      }
      return `<g transform="translate(${n(q.x)} ${n(q.y)}) rotate(${n(rot)})">${modifier(l.kind, col)}</g>
        ${tag ? `<text x="${n(tx)}" y="${n(ty)}" text-anchor="${anchor}"
          font-size="8" font-weight="700" fill="${col}" font-family="var(--font-sans,sans-serif)">${esc(tag)}</text>` : ''}`;
    }).join('');

    return `<svg class="plt-setup" viewBox="0 0 ${D.w} ${D.h}" role="img" aria-label="Planta do esquema de luz">
      <defs>
        <radialGradient id="${g}bg" cx="50%" cy="45%" r="70%">
          <stop offset="0" stop-color="#16283f"/><stop offset="1" stop-color="#0a1220"/>
        </radialGradient>
      </defs>
      <rect width="${D.w}" height="${D.h}" rx="10" fill="url(#${g}bg)"/>
      <!-- fundo do estúdio -->
      <rect x="26" y="7" width="158" height="8" rx="2" fill="${p.bgLit ? '#dbe6f2' : '#31445c'}"/>
      ${beams}
      <!-- sujeito: cabeça vista de cima, nariz a apontar à câmara -->
      <circle cx="${D.cx}" cy="${D.cy}" r="13" fill="#e9cdb0"/>
      <path d="M${D.cx} ${D.cy + 18} L${D.cx - 4} ${D.cy + 11} L${D.cx + 4} ${D.cy + 11} Z" fill="#c9a882"/>
      ${heads}
      <!-- câmara -->
      <g transform="translate(${D.cx} ${D.cam})">
        <rect x="-11" y="-7" width="22" height="14" rx="3" fill="#cbd5e1"/>
        <circle cx="0" cy="0" r="4.5" fill="#0b1220"/>
        <path d="M-11 -7 L-4 -11 L4 -11 L11 -7" fill="#cbd5e1"/>
      </g>
    </svg>`;
  }

  /* ══ 2. ROSTO (resultado) ════════════════════════════════════════════
     Cabeça de frente, viewBox 160×200, desenhada por camadas:

       1. fundo (liso, pool de luz, high/low key)
       2. cabelo, rosto e ombros em pele/cabelo neutros
       3. feições (olhos, nariz, boca)
       4. SOMBRA por cima de tudo, em `multiply`

     A ordem importa: a sombra tem de vir DEPOIS das feições. Quando ela
     ficava por baixo, o olho e o lábio do lado escuro continuavam a
     brilhar dentro da sombra e o split parecia um erro de desenho.

     A sombra tem duas componentes multiplicadas:
       horizontal — vem do `az` (de que lado está a luz) e do `edge`
       vertical   — vem da altura da luz (`elev`): luz alta escurece o
                    maxilar, luz baixa escurece a testa.
     Por cima, as sombras próprias do padrão (nariz, queixo, maçãs) e o
     triângulo iluminado do Rembrandt, esse em `screen`. */

  const FACE_PATH = 'M80 40 C57 40 50 56 50 80 C50 92 52 102 56 110 C62 124 70 134 80 134 C90 134 98 124 104 110 C108 102 110 92 110 80 C110 56 103 40 80 40 Z';
  const HAIR_PATH = 'M80 24 C45 24 34 52 36 92 C37 114 42 130 47 142 L61 142 C52 124 47 106 48 86 C50 64 61 52 80 52 C99 52 110 64 112 86 C113 106 108 124 99 142 L113 142 C118 130 123 114 124 92 C126 52 115 24 80 24 Z';
  const NECK_PATH = 'M68 122 L92 122 L92 150 L68 150 Z';
  const BODY_PATH = 'M62 138 L98 138 L98 148 C120 154 134 168 138 200 L22 200 C26 168 40 154 62 148 Z';

  const SKIN = { base: '#e6c09a', hair: '#3b2a1e', lips: '#b4705d', shirt: '#9aa4b0' };

  /* Rampa de multiplicação: branco = intocado, escuro = sombra.
     `fill` levanta o fundo da rampa (refletor, preenchimento, sombra aberta). */
  function shadeStops(edge, fill, amt) {
    const floor = 0.16 + fill * 0.72;                    // luminância mínima
    const lo = Math.round(255 * Math.min(1, floor));
    const mi = Math.round(255 * Math.min(1, floor + (1 - floor) * 0.45));
    const hex = v => '#' + v.toString(16).padStart(2, '0').repeat(3);
    const mid = 0.5 + (1 - amt) * 0.4;
    const half = Math.max(0.015, edge * 0.4);
    return `
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="${n(Math.max(0, mid - half))}" stop-color="#ffffff"/>
      <stop offset="${n(mid)}" stop-color="${hex(mi)}"/>
      <stop offset="${n(Math.min(1, mid + half))}" stop-color="${hex(lo)}"/>
      <stop offset="1" stop-color="${hex(lo)}"/>`;
  }

  /* Sombra do nariz — a assinatura de cada padrão. */
  function noseShadow(kind, left) {
    const m = (d, o) => `<path d="${d}" fill="#000" opacity="${o || 0.42}"/>`;
    const flip = s => (left ? s : `<g transform="translate(160 0) scale(-1 1)">${s}</g>`);
    switch (kind) {
      case 'butterfly':   // simétrica, mesmo por baixo do nariz
        return m('M69 103 Q80 120 91 103 Q80 109 69 103 Z', 0.52);
      case 'loop':        // laço curto virado ao canto da boca, sem tocar na maçã
        return flip(m('M83 100 Q93 105 91 113 Q86 115 83 107 Z'));
      case 'rembrandt':   // desce ao canto do lábio e junta-se à sombra da face
        return flip(m('M83 98 Q97 105 96 117 Q91 123 84 117 Q81 108 83 98 Z'));
      case 'split':       // metade do rosto É a sombra: não há sombra própria
        return '';
      case 'under':       // luz de baixo: a sombra sobe
        return m('M71 96 Q80 86 89 96 Q80 92 71 96 Z', 0.35);
      default:
        return '';
    }
  }

  function face(p) {
    const g = uid('fc');
    const az = p.faceAz != null ? p.faceAz : (p.lights && p.lights[0] ? p.lights[0].az : 0);
    const elev = p.faceElev != null ? p.faceElev : (p.lights && p.lights[0] ? (p.lights[0].elev || 0) : 0);
    const left = az > 0;
    const amt = Math.min(1, Math.abs(az) / 90);
    const edge = p.edge == null ? 0.5 : p.edge;
    const fill = p.fill == null ? 0 : p.fill;
    const hard = p.nose === 'split';

    /* Sombras próprias: queixo sempre, maçãs só quando a luz vem de cima. */
    const chin = `<path d="M63 124 Q80 141 97 124 Q80 132 63 124 Z" fill="#000" opacity="${elev > 0.6 ? 0.34 : 0.2}"/>`;
    const cheeks = elev > 0.8 && Math.abs(az) < 20
      ? `<path d="M51 92 Q61 107 64 121 Q53 112 51 92 Z" fill="#000" opacity="${p.fill > 0.7 ? 0.2 : 0.34}"/>
         <path d="M109 92 Q99 107 96 121 Q107 112 109 92 Z" fill="#000" opacity="${p.fill > 0.7 ? 0.2 : 0.34}"/>
         <path d="M64 72 Q80 66 96 72 Q80 76 64 72 Z" fill="#000" opacity=".18"/>` : '';
    /* O triângulo iluminado sob o olho do lado escuro é o que faz um
       Rembrandt ser um Rembrandt — vem depois da sombra, em `screen`. */
    const tri = p.tri
      ? (left
        ? '<path d="M95 95 L107 93 L99 111 Z" fill="#dfba91" opacity=".9"/>'
        : '<path d="M65 95 L53 93 L61 111 Z" fill="#dfba91" opacity=".9"/>')
      : '';

    const eye = cx => `<g>
      <path d="M${cx - 8} 86 Q${cx} 79 ${cx + 8} 86 Q${cx} 93 ${cx - 8} 86 Z" fill="#f7f2ea"/>
      <circle cx="${cx}" cy="86" r="3.6" fill="#4a3524"/>
      <circle cx="${cx}" cy="86" r="1.7" fill="#150e08"/>
      <circle cx="${cx + (left ? -1.6 : 1.6)}" cy="84.4" r="1.3" fill="#fff" opacity=".95"/>
      <path d="M${cx - 9} 86 Q${cx} 78 ${cx + 9} 86" fill="none" stroke="#3a2a1c" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M${cx - 9.5} 75 Q${cx} 70 ${cx + 9.5} 75" fill="none" stroke="#4a3524" stroke-width="2.6" stroke-linecap="round"/>
    </g>`;

    const features = `${eye(64)}${eye(96)}
      <path d="M79 82 Q77 94 74 102" fill="none" stroke="#b08a63" stroke-width="1.2" opacity=".7" stroke-linecap="round"/>
      <path d="M73 104 Q80 108 87 104" fill="none" stroke="#a97f57" stroke-width="1.4" opacity=".75" stroke-linecap="round"/>
      <path d="M69 116 Q80 111 91 116 Q80 125 69 116 Z" fill="${SKIN.lips}"/>
      <path d="M69 116 Q80 118 91 116" fill="none" stroke="#7a4234" stroke-width=".9" opacity=".85"/>`;

    /* Recorte e luz de cabelo: luz ACRESCENTADA, por isso vão por cima de
       tudo — inclusive da sombra — em traço claro e sem blend (um <g> com
       clip-path isola o grupo e mataria qualquer mix-blend-mode aqui). */
    const rimC = p.rimTint || '#ffe9c0';
    const rw = p.rim === 2 ? 7 : 5;
    /* Só as ARESTAS EXTERIORES da silhueta: contornar o cabelo todo dava um
       tubo luminoso à volta da cara, que é o oposto de uma luz de recorte. */
    const rim = p.rim
      ? `<g fill="none" stroke="${rimC}" stroke-linecap="round" clip-path="url(#${g}clipAll)">
          <path d="M47 142 C39 118 36 96 37 86 C39 50 54 24 80 24" stroke-width="${rw}" opacity=".8"/>
          <path d="M113 142 C121 118 124 96 123 86 C121 50 106 24 80 24" stroke-width="${rw}" opacity=".8"/>
          <path d="M22 200 C26 168 40 154 62 148" stroke-width="${rw - 1}" opacity=".55"/>
          <path d="M138 200 C134 168 120 154 98 148" stroke-width="${rw - 1}" opacity=".55"/>
         </g>
         <path d="${FACE_PATH}" fill="none" stroke="${rimC}" stroke-width="${rw - 1.5}"
           opacity=".6" clip-path="url(#${g}clipFace)" transform="translate(${left ? 4 : -4} 0)"/>` : '';
    const hairLight = p.hairLight
      ? `<path d="M50 58 Q80 26 110 58" fill="none" stroke="#ffeccb" stroke-width="7"
           opacity=".5" stroke-linecap="round" clip-path="url(#${g}clipAll)"/>` : '';

    const gelWash = p.gels
      ? `<rect x="0" width="80" height="200" fill="${p.gels[0]}" opacity=".5"
           clip-path="url(#${g}clipAll)" style="mix-blend-mode:multiply"/>
         <rect x="80" width="80" height="200" fill="${p.gels[1]}" opacity=".5"
           clip-path="url(#${g}clipAll)" style="mix-blend-mode:multiply"/>` : '';

    /* Componente vertical da sombra: só existe quando a luz é claramente
       alta ou claramente baixa. */
    const vAmt = Math.min(1, Math.abs(elev));
    const vgrad = vAmt > 0.4 && !hard
      ? `<linearGradient id="${g}v" x1="0" y1="${elev > 0 ? 0 : 1}" x2="0" y2="${elev > 0 ? 1 : 0}">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.55" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#${Math.round(255 * (1 - vAmt * 0.3 * (1 - fill * 0.7))).toString(16).padStart(2, '0').repeat(3)}"/>
        </linearGradient>` : '';

    return `<svg class="plt-face" viewBox="0 0 160 200" role="img" aria-label="O que este esquema faz ao rosto">
      <defs>
        <linearGradient id="${g}h" x1="${left ? 0 : 1}" y1="0" x2="${left ? 1 : 0}" y2="0">
          ${hard
        ? `<stop offset="0" stop-color="#ffffff"/><stop offset="0.497" stop-color="#ffffff"/>
             <stop offset="0.503" stop-color="#${Math.round(255 * (0.1 + fill * 0.7)).toString(16).padStart(2, '0').repeat(3)}"/>
             <stop offset="1" stop-color="#${Math.round(255 * (0.1 + fill * 0.7)).toString(16).padStart(2, '0').repeat(3)}"/>`
        : shadeStops(edge, fill, amt)}
        </linearGradient>
        ${vgrad}
        ${p.bgPool ? `<radialGradient id="${g}pool" cx="50%" cy="40%" r="62%">
          <stop offset="0" stop-color="#a8bbd1"/><stop offset="1" stop-color="#0f1824"/></radialGradient>` : ''}
        <clipPath id="${g}clipFace"><path d="${FACE_PATH}"/></clipPath>
        <clipPath id="${g}clipAll">
          <path d="${HAIR_PATH}"/><path d="${FACE_PATH}"/><path d="${NECK_PATH}"/><path d="${BODY_PATH}"/>
        </clipPath>
      </defs>
      <rect width="160" height="200" rx="10" fill="${p.bgPool ? `url(#${g}pool)` : (p.faceBg || '#1b2635')}"/>
      ${p.bgTint ? `<rect width="160" height="200" rx="10" fill="${p.bgTint}" opacity=".55"/>` : ''}

      <!-- 2. matéria: cabelo, pescoço, ombros, rosto -->
      <path d="${HAIR_PATH}" fill="${SKIN.hair}"/>
      <path d="${NECK_PATH}" fill="${SKIN.base}"/>
      <path d="${BODY_PATH}" fill="${SKIN.shirt}"/>
      <path d="${FACE_PATH}" fill="${SKIN.base}"/>
      <!-- 3. feições -->
      <g clip-path="url(#${g}clipFace)">${features}</g>
      <!-- 4. sombra por cima de tudo.
           clip-path e mix-blend-mode TÊM de estar no mesmo elemento: um <g>
           com clip-path à volta isola o grupo e o multiply passa a compor
           contra vazio — o desenho todo saía branco. -->
      <rect width="160" height="200" fill="url(#${g}h)" clip-path="url(#${g}clipAll)" style="mix-blend-mode:multiply"/>
      ${vgrad ? `<rect width="160" height="200" fill="url(#${g}v)" clip-path="url(#${g}clipAll)" style="mix-blend-mode:multiply"/>` : ''}
      <g clip-path="url(#${g}clipFace)">${cheeks}${chin}${noseShadow(p.nose, left)}${tri}</g>
      ${hairLight}${rim}${gelWash}
    </svg>`;
  }

  /* ══ 3. Os padrões ═══════════════════════════════════════════════════
     `kit` e `how` são o texto do cartão; `lights`, `nose`, `edge`, `fill`
     e `tri` alimentam os dois desenhos. */

  const PATTERNS = [
    /* ── um só foco ── */
    {
      id: 'rembrandt', name: 'Rembrandt', family: 'estudio', star: 1,
      kit: '1 flash · 1 tripé · softbox 60cm',
      how: 'Luz a 45° do sujeito e bem acima da altura dos olhos, a apontar ligeiramente para baixo.',
      tell: 'Um triângulo de luz na bochecha do lado escuro, logo abaixo do olho — nem maior que o olho, nem a chegar ao queixo.',
      why: 'Dá volume ao rosto sem o partir ao meio. É o retrato «sério» por omissão.',
      watch: 'Se o triângulo desaparece, a luz está baixa demais; se escorre pela cara abaixo, está alta demais.',
      lights: [{ az: 45, elev: 1, kind: 'softbox', tag: '45° · alta' }],
      nose: 'rembrandt', tri: 1, edge: 0.45, fill: 0.15,
    },
    {
      id: 'loop', name: 'Loop', family: 'estudio', star: 1,
      kit: '1 flash · 1 tripé · softbox 60cm',
      how: 'Luz a 30° e só um pouco acima dos olhos. É o Rembrandt «mais fechado».',
      tell: 'Uma sombra pequena e oval do nariz, virada para o canto da boca — sem tocar na sombra da bochecha.',
      why: 'O padrão mais universal: favorece quase toda a gente e perdoa erros de posição.',
      watch: 'Se a sombra do nariz encosta à bochecha, já andaste para o Rembrandt.',
      lights: [{ az: 30, elev: 0.5, kind: 'softbox', tag: '30° · acima' }],
      nose: 'loop', edge: 0.6, fill: 0.35,
    },
    {
      id: 'split', name: 'Split', family: 'estudio',
      kit: '1 flash · 1 tripé · refletor nu (luz dura)',
      how: 'Luz exatamente a 90°, à altura dos olhos. Nada do outro lado.',
      tell: 'Metade do rosto acesa, metade em sombra, com a linha a cair a direito pelo nariz.',
      why: 'Drama imediato: tensão, mistério, força. Funciona bem em rostos angulosos.',
      watch: 'É implacável com a pele. Se for demais, passa ao Split com preenchimento.',
      lights: [{ az: 90, elev: 0, kind: 'strobe', tag: '90° · olhos' }],
      nose: 'split', edge: 0.05, fill: 0,
    },
    {
      id: 'split-fill', name: 'Split com preenchimento', family: 'estudio',
      kit: '1 flash · 1 tripé · 1 refletor prateado',
      how: 'O mesmo Split, mas com um refletor do lado escuro a devolver luz ao rosto.',
      tell: 'A divisão mantém-se, mas o lado escuro já tem detalhe em vez de ser preto.',
      why: 'Guarda o drama e devolve a informação. É o Split «utilizável» num retrato de encomenda.',
      watch: 'Aproxima ou afasta o refletor — é assim que se dosea o contraste, não com a potência do flash.',
      lights: [
        { az: 90, elev: 0, kind: 'strobe', tag: '90°' },
        { az: -75, elev: 0, kind: 'reflector', role: 'fill', tag: 'refletor' },
      ],
      nose: 'split', edge: 0.05, fill: 0.45,
    },
    {
      id: 'butterfly', name: 'Butterfly (Paramount)', family: 'estudio', star: 1,
      kit: '1 flash · 1 girafa · softbox ou beauty dish por cima',
      how: 'Luz mesmo em cima e à frente do rosto, na vertical do nariz, a apontar para baixo.',
      tell: 'Uma sombra pequena e simétrica em forma de borboleta, mesmo por baixo do nariz.',
      why: 'Esculpe as maçãs do rosto e limpa a pele. É o padrão clássico de beleza e de Hollywood.',
      watch: 'Se a sombra do nariz chega ao lábio, a luz está alta demais — baixa-a.',
      lights: [{ az: 0, elev: 1, kind: 'softbox', tag: 'topo · frente' }],
      faceAz: 0, nose: 'butterfly', edge: 0.9, fill: 0.5,
    },
    {
      id: 'clamshell', name: 'Clamshell', family: 'estudio',
      kit: '2 fontes · softbox em cima + refletor (ou 2.º flash) por baixo',
      how: 'Butterfly com uma segunda fonte por baixo do queixo, virada para cima e mais fraca.',
      tell: 'Quase sem sombras, pele luminosa e dois brilhos empilhados em cada olho.',
      why: 'O padrão de beleza e de capa: limpa rugas e olheiras sem retoque.',
      watch: 'Se a de baixo ficar mais forte que a de cima, o retrato vira filme de terror.',
      lights: [
        { az: 0, elev: 1, kind: 'softbox', tag: 'topo' },
        { az: 0, elev: -1, kind: 'reflector', role: 'fill', dist: 'close', tag: 'baixo' },
      ],
      faceAz: 0, nose: 'butterfly', edge: 1, fill: 0.85, bgTint: '#c9d6e6',
    },
    /* ── largo vs curto ── */
    {
      id: 'short', name: 'Short (luz curta)', family: 'forma', star: 1,
      kit: '1 flash · 1 tripé · softbox 60cm',
      how: 'Qualquer padrão + o rosto voltado PARA a luz: fica iluminado o lado que está mais longe da câmara.',
      tell: 'O lado do rosto virado à câmara está em sombra; a luz cai no lado estreito.',
      why: 'Afina o rosto. É a escolha por omissão para rostos redondos ou largos.',
      watch: 'Precisa de fundo escuro para ler bem — em fundo claro perde-se a sombra.',
      lights: [{ az: 55, elev: 0.5, kind: 'softbox', tag: 'lado curto' }],
      nose: 'rembrandt', tri: 1, edge: 0.35, fill: 0.1,
    },
    {
      id: 'broad', name: 'Broad (luz larga)', family: 'forma',
      kit: '1 flash · 1 tripé · softbox 60cm',
      how: 'O mesmo, mas com o rosto voltado AO CONTRÁRIO da luz: iluminado o lado mais perto da câmara.',
      tell: 'O lado grande do rosto, o que está virado à câmara, é o que está aceso.',
      why: 'Alarga e abre o rosto — bom para rostos muito magros ou para um tom mais aberto e simpático.',
      watch: 'Num rosto já cheio engorda. É o erro mais comum de quem posiciona a luz sem pensar.',
      lights: [{ az: 35, elev: 0.5, kind: 'softbox', tag: 'lado largo' }],
      nose: 'loop', edge: 0.7, fill: 0.5,
    },
    /* ── multi-luz ── */
    {
      id: 'key-fill', name: 'Principal + preenchimento', family: 'multi', star: 1,
      kit: '2 flashes · 2 tripés · 2 softboxes',
      how: 'Chave a 45°, preenchimento do lado oposto a metade da potência (ou mais longe).',
      tell: 'Sombra suave e legível: há um lado mais claro, mas o escuro nunca fecha.',
      why: 'O cavalo de batalha do retrato corporativo e de família. Controlas o contraste com a razão entre as duas.',
      watch: 'Preenchimento à mesma potência = luz plana. Mantém-no 1 a 2 stops abaixo.',
      lights: [
        { az: 45, elev: 0.5, kind: 'softbox', tag: 'chave' },
        { az: -50, elev: 0, kind: 'softbox', role: 'fill', dist: 'far', tag: 'fill −1EV' },
      ],
      nose: 'loop', edge: 0.7, fill: 0.6,
    },
    {
      id: 'three-point', name: 'Chave + fill + cabelo', family: 'multi',
      kit: '3 flashes · 3 tripés · 2 softboxes + 1 grelha',
      how: 'Ao esquema anterior junta-se uma luz alta atrás da cabeça, apontada ao cabelo.',
      tell: 'Um fio de luz no alto do cabelo e nos ombros, que descola o sujeito do fundo.',
      why: 'Sem ela, cabelo escuro em fundo escuro funde-se. É o que faz o retrato parecer «profissional».',
      watch: 'Não deixes o feixe bater na testa: usa grelha e vê o retorno pelo lado.',
      lights: [
        { az: 45, elev: 0.5, kind: 'softbox', tag: 'chave' },
        { az: -50, elev: 0, kind: 'softbox', role: 'fill', dist: 'far', tag: 'fill' },
        { az: 155, elev: 1, kind: 'honeycomb', role: 'rim', tag: 'cabelo' },
      ],
      nose: 'loop', edge: 0.7, fill: 0.55, hairLight: 1,
    },
    {
      id: 'rim', name: 'Contraluz / recorte', family: 'multi',
      kit: '2–3 flashes · grelhas ou snoots atrás do sujeito',
      how: 'Luzes atrás do sujeito, viradas para a câmara mas fora de enquadramento. Chave fraca à frente (ou nenhuma).',
      tell: 'Uma linha de luz a desenhar a maçã do rosto, o queixo e o ombro, contra um fundo quase preto.',
      why: 'Separa e dramatiza. É o retrato de música, desporto e cinema.',
      watch: 'Aponta a luz para fora do eixo da lente ou apanhas flare — e usa para-sol sempre.',
      lights: [
        { az: 145, elev: 0.5, kind: 'honeycomb', role: 'rim', tag: 'recorte' },
        { az: -145, elev: 0.5, kind: 'honeycomb', role: 'rim', tag: 'recorte' },
        { az: 20, elev: 0.5, kind: 'softbox', role: 'fill', dist: 'far', tag: 'chave fraca' },
      ],
      nose: 'loop', edge: 0.5, fill: 0.05, rim: 2, faceBg: '#0a0f16',
    },
    {
      id: 'bg-light', name: 'Luz no fundo', family: 'multi',
      kit: '2 flashes · 1 softbox + 1 refletor virado ao fundo',
      how: 'Chave normal no rosto; a segunda luz atrás do sujeito, apontada ao fundo e não a ele.',
      tell: 'Uma mancha de luz no fundo atrás da cabeça, que escurece para os cantos.',
      why: 'Cria profundidade e separação sem tocar no sujeito. Controla-se com a distância ao fundo.',
      watch: 'Aproximar a luz do fundo torna a mancha pequena e dura; afastar torna-a ampla e suave.',
      lights: [
        { az: 45, elev: 0.5, kind: 'softbox', tag: 'chave' },
        { az: 180, elev: 0, kind: 'strobe', role: 'fill', dist: 'close', tag: '→ fundo' },
      ],
      nose: 'loop', edge: 0.65, fill: 0.4, bgPool: 1, bgLit: 1,
    },
    /* ── tonalidade ── */
    {
      id: 'flat', name: 'Luz plana', family: 'tom',
      kit: '2 flashes · 2 softboxes iguais aos lados da câmara',
      how: 'Duas fontes iguais, simétricas, ambas na linha da câmara.',
      tell: 'Nenhuma sombra em lado nenhum. O rosto lê-se como uma superfície, não como um volume.',
      why: 'Útil quando queres informação e não interpretação: catálogo, documentos, «antes e depois».',
      watch: 'Como retrato é a escolha mais fraca que há — sem sombra não há forma.',
      lights: [
        { az: 25, elev: 0, kind: 'softbox', tag: 'igual' },
        { az: -25, elev: 0, kind: 'softbox', tag: 'igual' },
      ],
      faceAz: 0, nose: 'none', edge: 1, fill: 1,
    },
    {
      id: 'high-key', name: 'High key', family: 'tom',
      kit: '3–4 flashes · 2 no fundo + 1 softbox grande à frente',
      how: 'Ilumina o fundo 1,5–2 stops ACIMA do sujeito para o queimar a branco puro; à frente, luz ampla e envolvente.',
      tell: 'Fundo branco sem textura, sombras quase inexistentes, imagem clara e leve.',
      why: 'Leveza, otimismo, publicidade e retrato de recém-nascidos.',
      watch: 'Mais de 2 stops e a luz do fundo contamina o cabelo e come-lhe o contorno.',
      lights: [
        { az: 20, elev: 0.5, kind: 'softbox', dist: 'close', tag: 'chave' },
        { az: 150, elev: 0, kind: 'strobe', role: 'fill', tag: '→ fundo' },
        { az: -150, elev: 0, kind: 'strobe', role: 'fill', tag: '→ fundo' },
      ],
      faceAz: 15, nose: 'none', edge: 1, fill: 1, bgLit: 1, faceBg: '#f2f5f8',
    },
    {
      id: 'low-key', name: 'Low key', family: 'tom',
      kit: '1 flash · 1 grelha ou snoot · fundo preto',
      how: 'Uma única fonte pequena e dura, longe do fundo. Bandeiras (ou paredes escuras) para matar o ressalto.',
      tell: 'A imagem é quase toda preta e só uma parte do rosto emerge.',
      why: 'Intimidade e drama. É o retrato que se lê como um pedaço, não como um todo.',
      watch: 'O fundo tem de ficar a metros do sujeito, senão apanha luz e deixa de ser preto.',
      lights: [{ az: 70, elev: 0.5, kind: 'honeycomb', tag: 'grelha' }],
      nose: 'rembrandt', edge: 0.15, fill: 0, faceBg: '#080b10',
    },
    {
      id: 'gels', name: 'Géis de cor', family: 'tom',
      kit: '2–4 flashes · géis de cor + 1 luz limpa no rosto',
      how: 'Um gel quente de um lado, um frio do outro. Se quiseres a pele natural, mantém uma fonte sem gel na cara.',
      tell: 'Dois lados do rosto com temperaturas opostas e o fundo pintado por uma terceira cor.',
      why: 'Editorial, música, noite. A cor passa a ser o assunto.',
      watch: 'Cores complementares (laranja/azul, magenta/verde) leem melhor do que duas cores vizinhas.',
      lights: [
        { az: 70, elev: 0.3, kind: 'strobe', tint: '#ff6b6b', tag: 'gel quente' },
        { az: -70, elev: 0.3, kind: 'strobe', tint: '#5b8dff', tag: 'gel frio' },
      ],
      faceAz: 40, nose: 'loop', edge: 0.5, fill: 0.4,
      gels: ['#ff5f6d', '#4f7dff'], faceBg: '#160f26',
    },
    /* ── luz natural: aqui há fotografia real (grupo lightpat) ── */
    {
      id: 'window', name: 'Janela lateral', family: 'natural', star: 1, photo: 'lp-window',
      kit: '0 flashes · uma janela grande e sem sol direto',
      how: 'Sujeito a 1–1,5 m da janela, ombro virado a ela. Quanto mais perto, mais suave e mais rápida a queda.',
      tell: 'Luz direcional macia que atravessa o rosto e cai suavemente para o lado oposto.',
      why: 'É o softbox que já tens em casa. Metade dos retratos publicados são isto.',
      watch: 'Desliga a luz do teto: misturar tungsténio com luz de dia dá dois brancos na mesma cara.',
      lights: [{ az: 60, elev: 0.3, kind: 'window', tag: 'janela' }],
      nose: 'loop', edge: 0.75, fill: 0.3,
    },
    {
      id: 'window-fill', name: 'Janela + refletor', family: 'natural', photo: 'lp-window-reflector',
      kit: '0 flashes · janela + cartão branco (ou um lençol)',
      how: 'O mesmo, com um refletor branco do lado da sombra, a menos de um metro do rosto.',
      tell: 'Continua a haver direção, mas o lado escuro abre e mostra detalhe.',
      why: 'É a forma mais barata de controlar contraste — e a única sem custo nenhum.',
      watch: 'Branco preenche natural; prateado é mais forte mas pode dar brilho na pele oleosa.',
      lights: [
        { az: 60, elev: 0.3, kind: 'window', tag: 'janela' },
        { az: -60, elev: 0, kind: 'reflector', role: 'fill', dist: 'close', tag: 'cartão' },
      ],
      nose: 'loop', edge: 0.85, fill: 0.75,
    },
    {
      id: 'golden-back', name: 'Contraluz de hora dourada', family: 'natural', star: 1, photo: 'lp-golden-back',
      kit: '0 flashes · sol baixo + refletor (ou uma parede clara)',
      how: 'Põe o sol ATRÁS da cabeça. Mede a exposição no rosto e devolve-lhe luz com refletor ou flash fraco.',
      tell: 'Halo quente a contornar o cabelo, fundo com bokeh dourado, rosto em luz suave.',
      why: 'A luz mais fácil de amar. Funciona em famílias, casais e retrato solto.',
      watch: 'Sem refletor o rosto fica 2 stops abaixo. E usa para-sol, ou o contraste desaparece em véu.',
      lights: [
        { az: 165, elev: 0.3, kind: 'sun', role: 'rim', dist: 'far', tag: 'sol' },
        { az: -20, elev: 0, kind: 'reflector', role: 'fill', dist: 'close', tag: 'refletor' },
      ],
      faceAz: -20, nose: 'loop', edge: 0.9, fill: 0.7, rim: 1, rimTint: '#ffcf7a', faceBg: '#3a2c1c',
    },
    {
      id: 'open-shade', name: 'Sombra aberta', family: 'natural', photo: 'lp-open-shade',
      kit: '0 flashes · a aresta de um prédio, um alpendre, um túnel',
      how: 'Põe o sujeito à sombra, mas com o céu aberto à frente dele — nunca no meio da sombra fechada.',
      tell: 'Luz uniforme, sem sombras duras, com brilhos grandes e suaves nos olhos.',
      why: 'Salva um retrato ao meio-dia, quando o sol direto é impossível.',
      watch: 'À sombra a luz fica azulada: corrige o balanço de brancos ou fica tudo frio.',
      lights: [{ az: 15, elev: 0.6, kind: 'window', dist: 'far', tag: 'céu aberto' }],
      faceAz: 15, nose: 'none', edge: 1, fill: 0.9, faceBg: '#20303a',
    },
  ];

  const FAMILIES = [
    { id: 'estudio', name: 'Um só foco', hint: 'Uma luz e um refletor chegam para tudo isto.' },
    { id: 'forma',   name: 'Largo vs curto', hint: 'A mesma luz, o rosto virado ao contrário — muda a forma da cara.' },
    { id: 'multi',   name: 'Duas e três luzes', hint: 'Preenchimento, cabelo, recorte e fundo.' },
    { id: 'tom',     name: 'Tonalidade', hint: 'Onde vive a imagem: nos claros, nos escuros ou na cor.' },
    { id: 'natural', name: 'Luz natural', hint: 'Sem equipamento nenhum — e com fotografia real.' },
  ];

  const byId = id => PATTERNS.find(p => p.id === id) || null;

  return { setup, face, PATTERNS, FAMILIES, byId };
})();
