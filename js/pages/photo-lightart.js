/* ══════════════════════════════════════════════════════════════════════
   PhotoLightArt — motor de desenho dos padrões de luz de retrato.

   Cada padrão rende DUAS ilustrações, como nos posters de estúdio:

     setup(p)  → planta vista de cima: sujeito, câmara, fundo e cada luz
                 no seu ângulo/altura, com o modificador desenhado.
     face(p)   → o RESULTADO: um rosto de frente com a sombra exata do
                 padrão (triângulo de Rembrandt, borboleta sob o nariz,
                 linha dura do split, laço do loop…).

   Como se chegou aqui (medido, não assumido — ver `_test-lp` no
   manifesto): pedir os padrões a um modelo de imagem dá 1 acerto em 6.
   O Rembrandt sai mesmo bem (o termo está muito representado no treino);
   split, butterfly, contraluz e luz de baixo saem todos como o mesmo
   retrato escuro e macio. E há um problema independente: a personagem
   muda a cada geração — cabelo, roupa, enquadramento — por isso mesmo
   que todos acertassem, a grelha deixaria de ser uma comparação, que é
   todo o argumento deste cartão. Daí a inversão: gerou-se de propósito UM retrato com luz
   perfeitamente plana (`lb-face-a`) e é o código que desenha a luz por
   cima dele. Fica pele real E sombra geométrica — sempre certa, sempre
   consistente entre células, e offline. A luz NATURAL é o único caso em
   que o modelo acerta sozinho, e essa vem fotografada (grupo `lightpat`).

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
      /* O cone tinha 20% de opacidade e desaparecia sobre o fundo escuro:
         numa planta, o que se tem de ver primeiro é POR ONDE a luz vai. */
      return `<path d="M${n(ax)} ${n(ay)} L${n(bx)} ${n(by)} L${n(cx2)} ${n(cy2)} Z"
        fill="${col}" opacity="${l.role === 'fill' ? 0.18 : l.role === 'rim' ? 0.26 : 0.34}"/>`;
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
      <!-- Sujeito visto de cima. Antes era um círculo cor de pele com um
           bico: à escala da grelha lia-se como um balão, não como uma
           pessoa. Agora tem ombros, cabelo em volta e só a FRENTE da cara
           em tom de pele — vê-se de imediato para onde está virado. -->
      <g>
        <ellipse cx="${D.cx}" cy="${D.cy + 9}" rx="27" ry="13" fill="#2c4059"/>
        <circle cx="${D.cx}" cy="${D.cy}" r="15" fill="#2f2016"/>
        <path d="M${D.cx - 13.6} ${D.cy + 2.5} A13.8 13.8 0 0 0 ${D.cx + 13.6} ${D.cy + 2.5} Z" fill="#e9cdb0"/>
        <path d="M${D.cx} ${D.cy + 15.5} L${D.cx - 3.4} ${D.cy + 9.5} L${D.cx + 3.4} ${D.cy + 9.5} Z" fill="#c9a882"/>
      </g>
      ${heads}
      <!-- Câmara: corpo, pentaprisma e objetiva a apontar ao sujeito. -->
      <g transform="translate(${D.cx} ${D.cam})">
        <rect x="-13" y="-6" width="26" height="15" rx="3" fill="#8fd3ea"/>
        <path d="M-6 -6 L-4 -11 L4 -11 L6 -6 Z" fill="#8fd3ea"/>
        <path d="M-7 -6 L-5.5 -14 L5.5 -14 L7 -6 Z" fill="#6fb9d4"/>
        <circle cx="0" cy="-11" r="3.6" fill="#08121e"/>
        <circle cx="9" cy="-2" r="1.7" fill="#08121e" opacity=".7"/>
      </g>
    </svg>`;
  }

  /* ══ 2. ROSTO (resultado) ════════════════════════════════════════════
     A base é uma FOTOGRAFIA de estúdio com luz deliberadamente PLANA
     (`lb-face-a` frontal, `lb-face-c` de três-quartos — geradas de
     propósito, porque luz plana é a única coisa que este modelo faz
     sempre bem) e é o código que desenha a luz por cima. Ganha-se pele
     real e mantém-se o que fazia o desenho valer a pena: a sombra é
     geometria, portanto está certa e é igual em todas as células.

     TRÊS CAMADAS, todas dentro de UM grupo `multiply` isolado — e é essa
     a diferença para a versão anterior:
       1. sombra de forma  — gradiente com o terminador DENTRO da cara;
       2. sombra do nariz  — um TRAÇO estreito ancorado na asa da narina;
       3. triângulo de Rembrandt — branco, a DEVOLVER luz dentro da sombra.
     A versão anterior pintava o triângulo em `screen` por cima de tudo e
     lia-se como um foco colado à bochecha; e desenhava a sombra do nariz
     como uma mancha cheia de 10px que lia como sujidade por cima do
     lábio. Um triângulo de Rembrandt é a AUSÊNCIA de sombra, não luz
     acrescentada — por isso agora é branco DENTRO do grupo multiply.

     Marcas MEDIDAS em cada base, já convertidas para o viewBox 160×200
     (a imagem entra com `slice`: escala 160/896, sobra vertical centrada).
     Se a fotografia-base mudar, estas marcas TÊM de ser medidas outra vez —
     é delas que depende a sombra cair no sítio certo. */

  const F = { W: 160, H: 200 };

  const BASES = {
    // frontal — estúdio, tonalidade, multi-luz e luz natural
    a: {
      src: null, cx: 80, eye: 74, nose: 102, noseBase: 105, mouth: 118, chin: 143,
      faceL: 40, faceR: 121, wingL: 71, wingR: 89, cornerL: 66, cornerR: 94,
      eyeOutL: 48, eyeOutR: 112, headCx: 80, headCy: 74, headRx: 48, headRy: 71,
    },
    // três-quartos — só Short e Broad, que não existem num rosto de frente
    /* Tres-quartos: a cabeca esta virada para a DIREITA de quem ve, por isso
       o lado LARGO (perto da camara, 46 unidades do nariz ao ouvido) fica a
       esquerda e o lado CURTO (longe, 20 unidades) fica a direita. E dessa
       assimetria que o terminador tira a diferenca entre Short e Broad. */
    c: {
      src: null, cx: 98, eye: 73, nose: 100, noseBase: 106, mouth: 118, chin: 140,
      faceL: 52, faceR: 118, wingL: 90, wingR: 104, cornerL: 88, cornerR: 112,
      eyeOutL: 64, eyeOutR: 110, headCx: 71, headCy: 72, headRx: 51, headRy: 68,
    },
  };

  function setFace(url, id) { BASES[id || 'a'].src = url || null; }

  const hex = v => '#' + Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').repeat(3);

  /* Sombra de forma. O terminador vive em COORDENADAS DA CARA e não numa
     fração da imagem: com a luz a 45° tem de cair logo a seguir ao nariz,
     e a versão anterior punha-o em x=0.67 da imagem — fora da bochecha —
     por isso o rosto aparecia quase todo iluminado em metade dos cartões.
       amt = 1 (luz a 90°)     → terminador no eixo do nariz
       amt = 0 (luz de frente) → terminador fora da cara, sem sombra */
  function formStops(B, amt, edge, fill, right) {
    const dir = right ? 1 : -1;
    const far = right ? B.faceR : B.faceL;
    const tx = B.cx + dir * (1 - amt) * Math.abs(far - B.cx) * 0.98;
    const half = 3 + edge * 26;
    const floor = Math.min(1, 0.2 + fill * 0.66);
    const dk = hex(255 * floor);
    const md = hex(255 * (floor + (1 - floor) * 0.5));
    // 3 casas: `n()` arredonda a 0.1 e uma parada de gradiente a 0.1 da
    // saltos de 16px na transicao — visiveis como um degrau na bochecha.
    const o = x => (Math.max(0, Math.min(1, x / F.W))).toFixed(3);
    return right
      ? `<stop offset="0" stop-color="#ffffff"/>
         <stop offset="${o(tx - half)}" stop-color="#ffffff"/>
         <stop offset="${o(tx)}" stop-color="${md}"/>
         <stop offset="${o(tx + half)}" stop-color="${dk}"/>
         <stop offset="1" stop-color="${dk}"/>`
      : `<stop offset="0" stop-color="${dk}"/>
         <stop offset="${o(tx - half)}" stop-color="${dk}"/>
         <stop offset="${o(tx)}" stop-color="${md}"/>
         <stop offset="${o(tx + half)}" stop-color="#ffffff"/>
         <stop offset="1" stop-color="#ffffff"/>`;
  }

  /* Sombra própria do nariz — a ASSINATURA de cada esquema, e por isso a
     única forma desenhada à mão.

     A primeira versão era um `stroke` de 5 a 6 unidades com ponta redonda.
     Num nariz que mede 18 unidades de ponta a ponta, isso não é uma sombra:
     é um caroço cinzento de densidade constante colado à narina — que foi
     exatamente o que se viu no portal ("parece que sai alguma coisa do
     nariz"). Uma sombra projetada não se comporta assim. Nasce colada à asa
     do nariz, é densa aí, e vai perdendo forma e densidade até desaparecer.

     Daí o desenho atual: uma FORMA fechada em folha (larga onde nasce,
     afilada na ponta) preenchida com um gradiente ao longo do próprio eixo.
     `taper()` constrói a folha a partir de uma espinha; `leaf()` junta-lhe
     o gradiente. A opacidade máxima desceu de .58–.68 para .38–.48: a
     sombra do nariz é um detalhe que se lê, não a mancha principal do
     cartão — essa é a sombra de forma da bochecha. */
  let _nsId = 0;

  /* Folha afilada: espinha (x0,y0)→(x1,y1), meia-largura w na origem,
     `bow` empurra a barriga para fora do eixo (a sombra do nariz curva
     para o canto da boca em vez de descer a direito). */
  function taper(x0, y0, x1, y1, w, bow) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const mx = (x0 + x1) / 2 + px * (bow || 0), my = (y0 + y1) / 2 + py * (bow || 0);
    return `M${n(x0 + px * w)} ${n(y0 + py * w)}
      Q${n(mx + px * w * 1.15)} ${n(my + py * w * 1.15)} ${n(x1)} ${n(y1)}
      Q${n(mx - px * w * 1.15)} ${n(my - py * w * 1.15)} ${n(x0 - px * w)} ${n(y0 - py * w)} Z`
      .replace(/\s+/g, ' ');
  }

  /* Forma + gradiente longitudinal. `#0b0b0e` com alfa (e não branco) para
     que, dentro do grupo `multiply`, o que não é sombra deixe passar a
     sombra de forma que está por baixo em vez de a apagar. */
  function leaf(d, x0, y0, x1, y1, o0, fid) {
    const id = 'nsg' + (++_nsId);
    return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse"
        x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y1)}">
        <stop offset="0" stop-color="#0b0b0e" stop-opacity="${o0}"/>
        <stop offset="0.5" stop-color="#0b0b0e" stop-opacity="${(o0 * 0.62).toFixed(3)}"/>
        <stop offset="1" stop-color="#0b0b0e" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${d}" fill="url(#${id})" filter="url(#${fid})"/>`;
  }

  function noseShadow(kind, B, right, fid) {
    const s = right ? 1 : -1;
    const wing = right ? B.wingR : B.wingL;
    const corner = right ? B.cornerR : B.cornerL;
    /* A sombra nasce na ASA da narina (B.nose), não no sulco do lábio
       (B.noseBase): dois pontos separados por 3 unidades, mas começar no
       segundo descolava a sombra do nariz e era metade do efeito de caroço. */
    const y0 = B.nose - 2;
    switch (kind) {
      case 'loop': {
        // pequena e oval, virada ao canto da boca sem lá chegar
        const x0 = wing + s * 0.2, x1 = wing + s * 3.4, y1 = y0 + 9.5;
        return leaf(taper(x0, y0, x1, y1, 1.9, s * 0.9), x0, y0, x1, y1, 0.46, fid);
      }
      case 'rembrandt': {
        // desce até ao canto da boca, onde encontra a sombra da bochecha
        const x0 = wing + s * 0.2, x1 = corner - s * 0.6, y1 = B.mouth - 2.5;
        return leaf(taper(x0, y0, x1, y1, 2.1, s * 1.4), x0, y0, x1, y1, 0.48, fid);
      }
      case 'butterfly': {
        /* Crescente simétrico sob o septo. Nunca chega ao lábio: uma
           borboleta que toca na boca quer dizer luz alta demais. */
        const yt = y0 + 0.5, dep = yt + 8;
        const d = `M${n(B.wingL + 1.2)} ${n(yt)} Q${n(B.cx)} ${n(dep)} ${n(B.wingR - 1.2)} ${n(yt)}
          Q${n(B.cx)} ${n(yt - 1.2)} ${n(B.wingL + 1.2)} ${n(yt)} Z`.replace(/\s+/g, ' ');
        /* A borboleta é o SINAL do esquema: se se esbate como a sombra do
           loop deixa de haver cartão. Mais densa, e o desvanecimento só
           começa depois de metade da forma. */
        return leaf(d, B.cx, yt - 1, B.cx, dep, 0.6, fid);
      }
      case 'under': {
        // luz de baixo: a sombra sobe pela cana do nariz até à testa
        const yt = y0 - 1, top = yt - 9;
        const d = `M${n(B.wingL + 1.8)} ${n(yt)} Q${n(B.cx)} ${n(top)} ${n(B.wingR - 1.8)} ${n(yt)}
          Q${n(B.cx)} ${n(yt - 2.4)} ${n(B.wingL + 1.8)} ${n(yt)} Z`.replace(/\s+/g, ' ');
        return leaf(d, B.cx, yt, B.cx, top, 0.3, fid);
      }
      default: return '';
    }
  }

  /* Triângulo de Rembrandt: uma nesga de luz na maçã do lado ESCURO, entre
     a sombra do nariz e a sombra da bochecha, do tamanho de um olho. Vai
     dentro do grupo `multiply` e é BRANCO: onde é branco não há
     escurecimento, ou seja, devolve a luz que a sombra tinha tirado. */
  function rembrandtTriangle(B, right, fid) {
    const s = right ? 1 : -1;
    const inner = (right ? B.wingR : B.wingL) + s * 5;
    const outer = right ? B.eyeOutR : B.eyeOutL;
    return `<path d="M${n(inner)} ${n(B.eye + 9)} L${n(outer - s * 3)} ${n(B.eye + 13)} L${n(inner + s * 3)} ${n(B.noseBase - 1)} Z"
      fill="#ffffff" opacity="0.95" filter="url(#${fid})"/>`;
  }

  function face(p) {
    const g = uid('fc');
    const B = BASES[p.base || 'a'];
    if (!B || !B.src) {
      return `<svg class="plt-face" viewBox="0 0 ${F.W} ${F.H}" role="img" aria-label="Resultado indisponível">
        <rect width="${F.W}" height="${F.H}" rx="10" fill="#16202e"/></svg>`;
    }

    const az = p.faceAz != null ? p.faceAz : (p.lights && p.lights[0] ? p.lights[0].az : 0);
    const elev = p.faceElev != null ? p.faceElev : (p.lights && p.lights[0] ? (p.lights[0].elev || 0) : 0);
    const right = az > 0;                    // luz da esquerda → sombra à direita
    const amt = Math.min(1, Math.abs(az) / 90);
    const edge = p.edge == null ? 0.5 : p.edge;
    const fill = p.fill == null ? 0 : p.fill;
    const hard = p.nose === 'split';

    const fSoft = g + 'sf';
    const fNose = g + 'sn';

    /* Split: o terminador é uma FORMA que desce pela linha do meio da cara
       (testa, crista do nariz, sulco do lábio, queixo). Um gradiente linear
       dava uma navalha vertical de alto a baixo da IMAGEM e lia-se como uma
       fotografia cortada ao meio no editor, não como luz. */
    const splitPath = (() => {
      const x = B.cx;
      return `M${x + 4} 0 C${x + 1} ${n(B.eye * 0.6)} ${x + 1} ${n(B.eye * 0.85)} ${x + 2} ${B.eye}
        C${x + 4} ${B.nose - 9} ${x + 7} ${B.nose - 2} ${x + 6} ${B.noseBase}
        C${x + 5} ${B.mouth - 5} ${x + 1} ${B.mouth + 1} ${x + 2} ${B.chin}
        C${x + 3} ${F.H - 22} ${x + 3} ${F.H - 10} ${x + 4} ${F.H} L${F.W} ${F.H} L${F.W} 0 Z`
        .replace(/\s+/g, ' ');
    })();
    const splitTone = hex(255 * Math.min(1, 0.16 + fill * 0.62));

    const vAmt = Math.min(1, Math.abs(elev));
    const vOn = vAmt > 0.4;

    /* A camada de sombra inteira num só grupo isolado: dentro dele as formas
       compõem-se normalmente (o branco do triângulo apaga o cinzento por
       baixo) e só o resultado é multiplicado pela fotografia. */
    const shadow = `<g style="mix-blend-mode:multiply">
      ${hard
        ? `<g${right ? '' : ` transform="translate(${F.W} 0) scale(-1 1)"`}>
             <rect width="${F.W}" height="${F.H}" fill="#fff"/>
             <path d="${splitPath}" fill="${splitTone}" filter="url(#${g}sp)"/>
           </g>`
        : `<rect width="${F.W}" height="${F.H}" fill="url(#${g}h)"/>`}
      ${vOn ? `<rect width="${F.W}" height="${F.H}" fill="url(#${g}v)" style="mix-blend-mode:multiply"/>` : ''}
      ${noseShadow(p.nose, B, right, fNose)}
      ${p.tri ? rembrandtTriangle(B, right, fSoft) : ''}
    </g>`;

    const hGrad = hard ? '' : `<linearGradient id="${g}h" x1="0" y1="0" x2="1" y2="0">
      ${formStops(B, amt, edge, fill, right)}
    </linearGradient>`;
    const vGrad = vOn ? `<linearGradient id="${g}v" x1="0" y1="${elev > 0 ? 0 : 1}" x2="0" y2="${elev > 0 ? 1 : 0}">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${hex(255 * (1 - vAmt * 0.3 * (1 - fill * 0.6)))}"/>
    </linearGradient>` : '';

    /* Luz de recorte. Antes eram duas faixas coladas às MARGENS DA IMAGEM,
       a 40 unidades da cara: liam-se como duas cortinas a brilhar e nao como
       luz. Agora os gradientes arrancam na aresta da CARA (`faceL`/`faceR`) e
       apagam-se para dentro em 16 unidades — e o contorno da maçã do rosto,
       do queixo e do ombro que acende, que e o que o cartao promete. */
    /* Luz de recorte = o CONTORNO da cabeca a acender. Duas tentativas
       falhadas ficam aqui registadas porque a licao vale: faixas coladas as
       margens da imagem liam-se como cortinas a brilhar, e faixas coladas a
       aresta da cara liam-se como duas barras verticais a cortar o rosto.
       Uma luz de recorte segue a SILHUETA — logo e um traco eliptico com o
       tamanho da cabeca, desfocado, em `screen`. */
    const rimC = p.rimTint || '#ffe9c0';
    const rim = p.rim ? `<g mask="url(#${g}rm)" style="mix-blend-mode:screen">
      <ellipse cx="${B.headCx}" cy="${B.headCy}" rx="${B.headRx}" ry="${B.headRy}"
        fill="none" stroke="${rimC}" stroke-width="${p.rim === 2 ? 6 : 5}"
        opacity="${p.rim === 2 ? 0.85 : 0.66}" filter="url(#${g}rb)"/></g>` : '';
    const rimGrads = '';

    /* Luz de cabelo: uma mancha em cima da COROA, nao uma faixa a atravessar
       a imagem toda — essa levantava tambem o fundo e a testa e lia-se como
       sobre-exposicao. */
    const hairLight = p.hairLight
      ? `<ellipse cx="${B.cx}" cy="${B.eye - 46}" rx="46" ry="34" fill="url(#${g}top)" style="mix-blend-mode:screen"/>` : '';
    const hairGrad = p.hairLight
      ? `<radialGradient id="${g}top" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#ffeccb" stop-opacity=".7"/>
          <stop offset="1" stop-color="#ffeccb" stop-opacity="0"/></radialGradient>` : '';

    const gels = p.gels ? `
      <rect x="0" width="${F.W / 2}" height="${F.H}" fill="${p.gels[0]}" opacity=".42" style="mix-blend-mode:multiply"/>
      <rect x="${F.W / 2}" width="${F.W / 2}" height="${F.H}" fill="${p.gels[1]}" opacity=".42" style="mix-blend-mode:multiply"/>` : '';

    const dark = p.faceBg === '#080b10' || p.faceBg === '#0a0f16';
    const bg = p.bgPool
      ? `<ellipse cx="${B.cx}" cy="${B.eye + 4}" rx="86" ry="96" fill="url(#${g}pool)" style="mix-blend-mode:screen"/>`
      : (p.bgLit && p.faceBg === '#f2f5f8')
        ? `<rect width="${F.W}" height="${F.H}" fill="#fff" opacity=".3" style="mix-blend-mode:screen"/>`
        : dark
          ? `<ellipse cx="${B.cx}" cy="${B.eye + 10}" rx="${F.W * 0.6}" ry="${F.H * 0.56}" fill="url(#${g}vig)"/>`
          : '';
    const bgGrads = `
      ${p.bgPool ? `<radialGradient id="${g}pool" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#cfe0f2" stop-opacity=".55"/><stop offset="1" stop-color="#cfe0f2" stop-opacity="0"/></radialGradient>` : ''}
      ${dark ? `<radialGradient id="${g}vig" cx="50%" cy="50%" r="50%">
        <stop offset="0.42" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".93"/></radialGradient>` : ''}`;

    const tint = p.bgTint
      ? `<rect width="${F.W}" height="${F.H}" fill="${p.bgTint}" opacity=".18" style="mix-blend-mode:screen"/>` : '';

    return `<svg class="plt-face" viewBox="0 0 ${F.W} ${F.H}" role="img"
      aria-label="O que este esquema faz ao rosto">
      <defs>
        ${hGrad}${vGrad}${rimGrads}${hairGrad}${bgGrads}
        <!-- userSpaceOnUse e nao a caixa do objeto: a sombra do nariz e um
             traco quase vertical, logo a sua bounding box tem 3 unidades de
             largura e uma regiao de filtro de 220% dessa caixa CORTAVA o
             contorno esbatido — o resultado era um rectangulo cinzento de
             arestas duras ao lado do nariz, que foi o que se viu no portal. -->
        <filter id="${fSoft}" filterUnits="userSpaceOnUse" x="0" y="0" width="${F.W}" height="${F.H}">
          <feGaussianBlur stdDeviation="${n(1.3 + edge * 1.6)}"/></filter>
        <!-- O desfoque da sombra do nariz nao pode escalar como o da sombra
             de forma: a forma cobre meia cara e aguenta 2+ unidades de
             desfoque, a sombra do nariz tem 3 ou 4 unidades de largura e
             com esse valor desaparecia (era o que acontecia a borboleta,
             que e justamente o unico sinal do cartao Paramount). -->
        <filter id="${fNose}" filterUnits="userSpaceOnUse" x="0" y="0" width="${F.W}" height="${F.H}">
          <feGaussianBlur stdDeviation="${n(0.6 + edge * 0.9)}"/></filter>
        ${hard ? `<filter id="${g}sp" filterUnits="userSpaceOnUse" x="0" y="0" width="${F.W}" height="${F.H}">
          <feGaussianBlur stdDeviation="${n(1 + edge * 7)}"/></filter>` : ''}
        ${p.rim ? `<filter id="${g}rb" filterUnits="userSpaceOnUse" x="0" y="0" width="${F.W}" height="${F.H}">
          <feGaussianBlur stdDeviation="2.6"/></filter>
          <!-- So os DOIS ARCOS laterais: um recorte vem de tras e de lado, e
               um anel fechado a volta da cara lia-se como uma auréola. -->
          <linearGradient id="${g}rmg" gradientUnits="userSpaceOnUse" x1="0" x2="${F.W}" y1="0" y2="0">
            <stop offset="0" stop-color="#fff"/>
            <stop offset="${((B.headCx - B.headRx * 0.94) / F.W).toFixed(3)}" stop-color="#fff"/>
            <stop offset="${((B.headCx - B.headRx * (p.rim === 2 ? 0.6 : 0.32)) / F.W).toFixed(3)}" stop-color="#000"/>
            <stop offset="${((B.headCx + B.headRx * (p.rim === 2 ? 0.6 : 0.32)) / F.W).toFixed(3)}" stop-color="#000"/>
            <stop offset="${((B.headCx + B.headRx * 0.94) / F.W).toFixed(3)}" stop-color="#fff"/>
            <stop offset="1" stop-color="#fff"/></linearGradient>
          <mask id="${g}rm"><rect width="${F.W}" height="${F.H}" fill="url(#${g}rmg)"/></mask>` : ''}
        <clipPath id="${g}clip"><rect width="${F.W}" height="${F.H}" rx="10"/></clipPath>
      </defs>
      <g clip-path="url(#${g}clip)">
        <image href="${esc(B.src)}" x="0" y="0" width="${F.W}" height="${F.H}" preserveAspectRatio="xMidYMid slice"/>
        ${shadow}
        ${bg}${tint}${hairLight}${rim}${gels}
      </g>
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
      /* Short e Broad nao existem num rosto de frente: o que muda e o LADO
         para onde a cabeca esta virada. Por isso estes dois (e so estes) usam
         a base de tres-quartos `lb-face-c`. Nela o nariz esta a esquerda do
         centro, logo o lado LARGO (perto da camara) e o da direita e o lado
         CURTO (longe) e o da esquerda. Short = luz no lado curto = luz da
         esquerda; Broad = luz no lado largo = luz da direita. */
      base: 'c',
      lights: [{ az: -55, elev: 0.5, kind: 'softbox', tag: 'lado curto' }],
      nose: 'rembrandt', tri: 1, edge: 0.4, fill: 0.15,
    },
    {
      id: 'broad', name: 'Broad (luz larga)', family: 'forma',
      kit: '1 flash · 1 tripé · softbox 60cm',
      how: 'O mesmo, mas com o rosto voltado AO CONTRÁRIO da luz: iluminado o lado mais perto da câmara.',
      tell: 'O lado grande do rosto, o que está virado à câmara, é o que está aceso.',
      why: 'Alarga e abre o rosto — bom para rostos muito magros ou para um tom mais aberto e simpático.',
      watch: 'Num rosto já cheio engorda. É o erro mais comum de quem posiciona a luz sem pensar.',
      base: 'c',
      lights: [{ az: 45, elev: 0.5, kind: 'softbox', tag: 'lado largo' }],
      nose: 'loop', edge: 0.55, fill: 0.3,
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
      nose: 'loop', edge: 0.6, fill: 0.5,
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
      nose: 'loop', edge: 0.6, fill: 0.45, hairLight: 1,
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
      nose: 'loop', edge: 0.5, fill: 0.02, rim: 2, faceBg: '#0a0f16',
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
      nose: 'loop', edge: 0.6, fill: 0.3, bgPool: 1, bgLit: 1,
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
      nose: 'loop', edge: 0.7, fill: 0.18,
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
      nose: 'loop', edge: 0.8, fill: 0.62,
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

  return { setup, face, setFace, PATTERNS, FAMILIES, byId };
})();
