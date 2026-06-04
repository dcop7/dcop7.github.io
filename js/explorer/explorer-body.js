/* ══════════════════════════════════════════════════════════════════
   EXPLORER · CORPO HUMANO  (Human Body Explorer)
   8 interactive systems + a semantic-zoom journey:
   Humano → Órgão → Tecido → Célula → DNA
   Pure SVG/CSS — no external assets, works offline.
══════════════════════════════════════════════════════════════════ */
const HumanBodyExplorer = (function () {
  'use strict';

  let _root   = null;   /* the .hb-wrap element */
  let _topic  = 'anatomia';
  let _level  = 0;      /* zoom-journey depth 0..4 */
  let _wheelLock = false;

  /* ── i18n (mirrors the site's I18n) ── */
  function _lang() { return (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'); }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }

  /* ════════════════════════════════ SVG ART ════════════════════════ */
  /* All scenes share a soft, shaded, theme-agnostic vector style. */

  function _defs() {
    return `
      <defs>
        <radialGradient id="hbSkin" cx="42%" cy="32%" r="80%">
          <stop offset="0%" stop-color="#fed7aa"/><stop offset="55%" stop-color="#fdba74"/><stop offset="100%" stop-color="#ea9b63"/>
        </radialGradient>
        <linearGradient id="hbHeart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#be123c"/>
        </linearGradient>
        <linearGradient id="hbLung" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fda4af"/><stop offset="100%" stop-color="#fb7185"/>
        </linearGradient>
        <linearGradient id="hbBone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#cbd5e1"/>
        </linearGradient>
        <radialGradient id="hbCell" cx="45%" cy="40%" r="70%">
          <stop offset="0%" stop-color="rgba(168,85,247,.32)"/><stop offset="100%" stop-color="rgba(99,102,241,.18)"/>
        </radialGradient>
        <radialGradient id="hbNuc" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#7e22ce"/>
        </radialGradient>
        <linearGradient id="hbBrain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f9a8d4"/><stop offset="100%" stop-color="#e879a8"/>
        </linearGradient>
      </defs>`;
  }

  /* Reusable body silhouette (front), arms slightly out. */
  function _bodyPath(fill) {
    return `
      <path fill="${fill}" stroke="rgba(0,0,0,.12)" stroke-width="1.2" d="
        M100 16 c-13 0-22 10-22 23 0 9 4 15 10 19 -8 3-16 8-20 16 -5 11-6 28-7 40
        -1 9-4 22-7 31 -2 6 6 9 8 3 3-9 5-18 7-25 0 18-1 40-3 56 -1 9-3 24-3 33
        0 7 10 7 11 1 2-12 5-30 7-44 1 13 1 30 2 44 0 7 11 7 11 0 0-14 0-31 1-44
        2 14 5 32 7 44 1 6 11 6 11-1 0-9-2-24-3-33 -2-16-3-38-3-56 2 7 4 16 7 25
        2 6 10 3 8-3 -3-9-6-22-7-31 -1-12-2-29-7-40 -4-8-12-13-20-16 6-4 10-10 10-19
        0-13-9-23-22-23 z"/>`;
  }

  /* — L0 Humano — */
  function _svgHuman() {
    return `<svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg">${_defs()}
      ${_bodyPath('url(#hbSkin)')}
      <g opacity=".9">
        <ellipse cx="93" cy="120" rx="20" ry="22" fill="url(#hbHeart)" class="hb-beat"/>
        <path d="M84 116 q-2-8 5-9 q7 0 5 8" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>
      </g>
      <circle cx="93" cy="120" r="34" fill="none" stroke="#fb7185" stroke-width="1.5" stroke-dasharray="3 4" opacity=".7"/>
      <text x="100" y="305" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.4)" font-family="sans-serif">${_t('A body of ~37 trillion cells','Um corpo de ~37 biliões de células')}</text>
    </svg>`;
  }

  /* — L1 Órgão (heart) — */
  function _svgHeart() {
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${_defs()}
      <g class="hb-beat" transform-origin="100 105">
        <path fill="url(#hbHeart)" stroke="#7f1d1d" stroke-width="2" d="
          M100 58 C92 30 50 30 46 66 C42 100 78 128 100 158 C122 128 158 100 154 66 C150 30 108 30 100 58 Z"/>
        <path d="M70 60 q8 30 22 50" stroke="#fda4af" stroke-width="5" fill="none" opacity=".55"/>
        <path d="M128 60 q-6 28 -18 46" stroke="#fda4af" stroke-width="5" fill="none" opacity=".55"/>
        <path d="M86 70 q14 18 28 0" stroke="#7f1d1d" stroke-width="2.5" fill="none" opacity=".4"/>
        <g stroke="#be123c" stroke-width="6" fill="none" opacity=".7">
          <path d="M88 40 q-6-14 4-22"/><path d="M104 40 q4-12 -2-22"/><path d="M116 44 q12-10 6-22"/>
        </g>
      </g>
    </svg>`;
  }

  /* — L2 Tecido (cardiac muscle) — */
  function _svgTissue() {
    let fibers = '';
    for (let i = 0; i < 7; i++) {
      const y = 28 + i * 22;
      fibers += `<path d="M10 ${y} q40 ${i%2?8:-8} 90 0 q50 ${i%2?-8:8} 90 0" fill="none" stroke="url(#hbHeart)" stroke-width="13" opacity=".85"/>`;
      fibers += `<path d="M10 ${y} q40 ${i%2?8:-8} 90 0 q50 ${i%2?-8:8} 90 0" fill="none" stroke="#7f1d1d" stroke-width="1" stroke-dasharray="2 9" opacity=".5"/>`;
    }
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${_defs()}
      <rect x="0" y="0" width="200" height="200" rx="10" fill="rgba(190,18,60,.06)"/>
      ${fibers}
      ${[42,86,130].map(x=>`<circle cx="${x}" cy="100" r="4" fill="#fff" opacity=".7"/>`).join('')}
    </svg>`;
  }

  /* — L3 Célula (cardiomyocyte) — */
  function _svgCell() {
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${_defs()}
      <ellipse cx="100" cy="100" rx="86" ry="70" fill="url(#hbCell)" stroke="rgba(168,85,247,.6)" stroke-width="2.5"/>
      <ellipse cx="86" cy="92" rx="26" ry="22" fill="url(#hbNuc)"/>
      <ellipse cx="80" cy="86" rx="9" ry="7" fill="#581c87" opacity=".7"/>
      <g fill="#f97316" class="hb-organelle">
        <ellipse cx="135" cy="78" rx="13" ry="7" transform="rotate(20 135 78)"/>
        <ellipse cx="128" cy="120" rx="13" ry="7" transform="rotate(-15 128 120)"/>
        <ellipse cx="150" cy="110" rx="11" ry="6" transform="rotate(35 150 110)"/>
      </g>
      <g stroke="#a855f7" stroke-width="2" fill="none" opacity=".5">
        <path d="M60 130 q10-8 22 0 q12 8 24 0"/><path d="M58 140 q12-7 24 0 q12 7 24 0"/>
      </g>
      <circle cx="118" cy="150" r="5" fill="#22d3ee" opacity=".8"/>
      <circle cx="64" cy="60" r="4" fill="#22d3ee" opacity=".8"/>
    </svg>`;
  }

  /* — L4 DNA — */
  function _svgDNA() {
    let rungs = '';
    const cols = ['#f43f5e','#22d3ee','#a855f7','#22c55e'];
    for (let i = 0; i < 11; i++) {
      const y = 16 + i * 16;
      const w = Math.sin(i / 11 * Math.PI * 2) * 34;
      rungs += `<line x1="${100-w}" y1="${y}" x2="${100+w}" y2="${y}" stroke="${cols[i%4]}" stroke-width="4" opacity=".85"/>
                <circle cx="${100-w}" cy="${y}" r="4.5" fill="#e2e8f0"/><circle cx="${100+w}" cy="${y}" r="4.5" fill="#94a3b8"/>`;
    }
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${_defs()}
      <g style="animation:hb-helix 3s ease-in-out infinite;transform-origin:100px 100px">
        ${rungs}
      </g>
    </svg>`;
  }

  /* ════════════════════════════════ ZOOM JOURNEY ═══════════════════ */
  const ZOOM = [
    { key:'human',  emoji:'🧍', scale:'~1.7 m',
      title:_=>_t('Human','Humano'),
      desc:_=>_t('You: a single organism built from ~37 trillion cells, organised into organs and systems that keep you alive every second.',
                 'Tu: um único organismo feito de ~37 biliões de células, organizadas em órgãos e sistemas que te mantêm vivo a cada segundo.'),
      svg:_svgHuman },
    { key:'organ',  emoji:'❤️', scale:'~12 cm',
      title:_=>_t('Organ — the heart','Órgão — o coração'),
      desc:_=>_t('Zoom into one organ. The heart beats ~100 000 times a day, pumping blood through 100 000 km of vessels.',
                 'Mergulha num órgão. O coração bate ~100 000 vezes por dia, bombeando sangue por 100 000 km de vasos.'),
      svg:_svgHeart },
    { key:'tissue', emoji:'🥩', scale:'~1 mm',
      title:_=>_t('Tissue — cardiac muscle','Tecido — músculo cardíaco'),
      desc:_=>_t('The organ is woven from tissue: bundles of muscle fibres that contract together in perfect rhythm.',
                 'O órgão é tecido a partir de tecido: feixes de fibras musculares que se contraem juntas em ritmo perfeito.'),
      svg:_svgTissue },
    { key:'cell',   emoji:'🔬', scale:'~25 µm',
      title:_=>_t('Cell — cardiomyocyte','Célula — cardiomiócito'),
      desc:_=>_t('Each fibre is made of cells. Inside: a nucleus, energy-making mitochondria and machinery that turns food into motion.',
                 'Cada fibra é feita de células. Dentro: um núcleo, mitocôndrias que produzem energia e maquinaria que transforma comida em movimento.'),
      svg:_svgCell },
    { key:'dna',    emoji:'🧬', scale:'~2 nm',
      title:_=>_t('DNA','DNA'),
      desc:_=>_t('In the nucleus, 2 metres of DNA coil up. Its 3 billion base pairs are the recipe for everything you just zoomed through.',
                 'No núcleo, 2 metros de DNA enrolam-se. Os seus 3 mil milhões de pares de bases são a receita de tudo aquilo por onde acabaste de mergulhar.'),
      svg:_svgDNA },
  ];

  function _renderZoom(host) {
    host.innerHTML = `
      <div class="hb-zoom" data-level="0">
        <div class="hb-hint">${_t('Scroll, click the scene or use the buttons to dive deeper','Faz scroll, clica na cena ou usa os botões para mergulhar')}</div>
        <div class="hb-zoom-stage">
          ${ZOOM.map((z,i)=>`<div class="hb-zlayer ${i===0?'active':'next'}" data-l="${i}">${z.svg()}</div>`).join('')}
        </div>
        <nav class="hb-rail">
          ${ZOOM.map((z,i)=>`<button class="hb-rail-step ${i===0?'on':''}" data-go="${i}">
            <span>${z.title()}</span><span class="hb-rail-dot"></span></button>`).join('')}
        </nav>
        <div class="hb-zoom-foot">
          <div class="hb-cap">
            <div class="hb-cap-step">${_t('LEVEL','NÍVEL')} <span id="hb-cap-n">1</span>/5</div>
            <div class="hb-cap-title" id="hb-cap-t"></div>
            <div class="hb-cap-desc" id="hb-cap-d"></div>
            <div class="hb-cap-scale" id="hb-cap-s"></div>
          </div>
          <div class="hb-zctrl">
            <button class="hb-zbtn hb-zbtn--ghost" id="hb-zout" disabled>− ${_t('Out','Recuar')}</button>
            <button class="hb-zbtn hb-zbtn--primary" id="hb-zin">${_t('Dive in','Mergulhar')} →</button>
          </div>
        </div>
      </div>`;

    const zoom  = host.querySelector('.hb-zoom');
    const stage = host.querySelector('.hb-zoom-stage');
    const hint  = host.querySelector('.hb-hint');

    const go = (lvl, ev) => {
      lvl = Math.max(0, Math.min(ZOOM.length - 1, lvl));
      if (lvl === _level) return;
      /* transform-origin = where the user clicked, so we "fly into" that point */
      if (ev && stage) {
        const r = stage.getBoundingClientRect();
        const layer = zoom.querySelector('.hb-zlayer.active');
        if (layer) {
          layer.style.setProperty('--ox', `${((ev.clientX - r.left) / r.width * 100).toFixed(1)}%`);
          layer.style.setProperty('--oy', `${((ev.clientY - r.top) / r.height * 100).toFixed(1)}%`);
        }
      }
      _level = lvl;
      zoom.dataset.level = lvl;
      zoom.querySelectorAll('.hb-zlayer').forEach((el, i) => {
        el.classList.toggle('active', i === lvl);
        el.classList.toggle('prev', i < lvl);
        el.classList.toggle('next', i > lvl);
      });
      zoom.querySelectorAll('.hb-rail-step').forEach((b, i) => {
        b.classList.toggle('on', i === lvl);
        b.classList.toggle('done', i < lvl);
      });
      _syncCaption(zoom);
      if (hint) hint.style.opacity = '0';
    };

    zoom.querySelector('#hb-zin').onclick  = () => go(_level + 1);
    zoom.querySelector('#hb-zout').onclick = () => go(_level - 1);
    zoom.querySelectorAll('.hb-rail-step').forEach(b => b.onclick = () => go(+b.dataset.go));
    stage.onclick = (e) => { if (_level < ZOOM.length - 1) go(_level + 1, e); };

    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (_wheelLock) return;
      _wheelLock = true;
      setTimeout(() => { _wheelLock = false; }, 520);
      go(_level + (e.deltaY > 0 ? 1 : -1), e.deltaY > 0 ? e : null);
    }, { passive: false });

    _syncCaption(zoom);
  }

  function _syncCaption(zoom) {
    const z = ZOOM[_level];
    zoom.querySelector('#hb-cap-n').textContent = _level + 1;
    zoom.querySelector('#hb-cap-t').textContent = `${z.emoji} ${z.title()}`;
    zoom.querySelector('#hb-cap-d').textContent = z.desc();
    zoom.querySelector('#hb-cap-s').textContent = `${_t('scale','escala')} ≈ ${z.scale}`;
    zoom.querySelector('#hb-zout').disabled = _level === 0;
    const zin = zoom.querySelector('#hb-zin');
    zin.disabled = _level === ZOOM.length - 1;
    zin.textContent = _level === ZOOM.length - 1 ? _t('Deepest level','Nível mais profundo') : `${_t('Dive in','Mergulhar')} →`;
  }

  /* ════════════════════════════════ DIAGRAM TOPICS ═════════════════ */
  /* Each: svg (with .hb-hot[data-h] hotspots) + parts[] info objects. */

  const DIAGRAMS = {
    esqueleto: {
      svg: () => `<svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg">${_defs()}
        <g fill="url(#hbBone)" stroke="#94a3b8" stroke-width="1.2">
          <ellipse class="hb-hot" data-h="cranio" cx="100" cy="34" rx="20" ry="23"/>
          <rect class="hb-hot" data-h="coluna" x="95" y="56" width="10" height="130" rx="4"/>
          <g class="hb-hot" data-h="costelas">
            ${[0,1,2,3,4].map(i=>`<path d="M100 ${72+i*13} q-34 6 -36 22" fill="none" stroke="#cbd5e1" stroke-width="4"/><path d="M100 ${72+i*13} q34 6 36 22" fill="none" stroke="#cbd5e1" stroke-width="4"/>`).join('')}
          </g>
          <path class="hb-hot" data-h="bacia" d="M70 188 q30 22 60 0 q-6 26 -30 26 q-24 0 -30-26 z"/>
          <g class="hb-hot" data-h="bracos">
            <rect x="58" y="74" width="8" height="70" rx="4" transform="rotate(12 62 74)"/>
            <rect x="134" y="74" width="8" height="70" rx="4" transform="rotate(-12 138 74)"/>
          </g>
          <g class="hb-hot" data-h="femur">
            <rect x="82" y="216" width="9" height="84" rx="4"/>
            <rect x="109" y="216" width="9" height="84" rx="4"/>
          </g>
        </g></svg>`,
      parts: {
        cranio:  { emoji:'💀', name:_=>_t('Skull','Crânio'), sub:_=>_t('22 bones','22 ossos'),
          desc:_=>_t('Protects the brain and shapes the face. Most of its bones are fused at rigid joints called sutures.','Protege o cérebro e dá forma ao rosto. A maioria dos ossos está fundida em juntas rígidas chamadas suturas.'),
          stats:[['22',_=>_t('bones','ossos')],['8',_=>_t('protect brain','protegem o cérebro')]],
          facts:[_=>_t('The only movable skull bone is the jaw (mandible).','O único osso móvel do crânio é a mandíbula.'),_=>_t('A baby is born with soft spots — fontanelles.','Um bebé nasce com pontos moles — fontanelas.')] },
        coluna:  { emoji:'🦴', name:_=>_t('Spine','Coluna'), sub:_=>_t('33 vertebrae','33 vértebras'),
          desc:_=>_t('A flexible column that holds you upright and shields the spinal cord, the body’s main nerve highway.','Uma coluna flexível que te mantém de pé e protege a medula espinal, a principal autoestrada de nervos do corpo.'),
          stats:[['33',_=>_t('vertebrae','vértebras')],['5',_=>_t('regions','regiões')]],
          facts:[_=>_t('Discs between vertebrae act as shock absorbers.','Os discos entre vértebras funcionam como amortecedores.')] },
        costelas:{ emoji:'🫁', name:_=>_t('Rib cage','Caixa torácica'), sub:_=>_t('24 ribs','24 costelas'),
          desc:_=>_t('Twelve pairs of ribs form a protective cage around the heart and lungs, moving as you breathe.','Doze pares de costelas formam uma jaula protetora à volta do coração e dos pulmões, movendo-se quando respiras.'),
          stats:[['12',_=>_t('pairs','pares')],['2',_=>_t('float freely','flutuantes')]],
          facts:[_=>_t('The lowest two pairs attach only to the spine.','Os dois pares mais baixos ligam-se só à coluna.')] },
        bacia:   { emoji:'🦴', name:_=>_t('Pelvis','Bacia'), sub:_=>_t('Hip girdle','Cintura pélvica'),
          desc:_=>_t('A bowl of fused bones that bears your weight when standing and connects the spine to the legs.','Uma taça de ossos fundidos que suporta o teu peso de pé e liga a coluna às pernas.'),
          stats:[['3',_=>_t('fused bones','ossos fundidos')]],
          facts:[_=>_t('It differs between male and female skeletons.','Difere entre esqueletos masculinos e femininos.')] },
        bracos:  { emoji:'💪', name:_=>_t('Arms','Braços'), sub:_=>_t('Upper limb','Membro superior'),
          desc:_=>_t('Humerus, radius and ulna give your arms a huge range of motion — and the hand alone has 27 bones.','Úmero, rádio e cúbito dão aos braços uma enorme amplitude de movimento — e só a mão tem 27 ossos.'),
          stats:[['27',_=>_t('bones / hand','ossos / mão')],['3',_=>_t('long bones','ossos longos')]],
          facts:[_=>_t('Over half your bones are in your hands and feet.','Mais de metade dos teus ossos estão nas mãos e pés.')] },
        femur:   { emoji:'🦵', name:_=>_t('Femur','Fémur'), sub:_=>_t('Thigh bone','Osso da coxa'),
          desc:_=>_t('The longest, strongest bone in the body — it can support up to 30× your body weight.','O osso mais longo e forte do corpo — pode suportar até 30× o teu peso.'),
          stats:[['~46 cm',_=>_t('length','comprimento')],['30×',_=>_t('body weight','o teu peso')]],
          facts:[_=>_t('Bone is stronger than steel by weight.','O osso é, por peso, mais forte que o aço.')] },
      },
      intro:{ emoji:'🦴', name:_=>_t('Skeleton','Esqueleto'), sub:_=>_t('206 bones','206 ossos'),
        desc:_=>_t('The frame that supports and protects you, lets you move and makes blood inside its marrow. Tap a bone to learn more.','A estrutura que te suporta, protege, te deixa mover e fabrica sangue na sua medula. Toca num osso para saber mais.'),
        stats:[['206',_=>_t('bones','ossos')],['~15%',_=>_t('of body weight','do peso')]],
        facts:[_=>_t('Babies are born with ~300 bones; many fuse with age.','Os bebés nascem com ~300 ossos; muitos fundem-se com a idade.'),_=>_t('The smallest bone, the stapes, sits in your ear.','O osso mais pequeno, o estribo, está no ouvido.')] },
    },

    circulacao: {
      svg: () => `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">${_defs()}
        <path class="hb-flow" d="M70 70 C40 110 40 200 84 250" fill="none" stroke="#3b82f6" stroke-width="6" stroke-linecap="round"/>
        <path class="hb-flow" d="M130 70 C160 110 160 200 116 250" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
        <path class="hb-flow" d="M84 250 C90 270 110 270 116 250" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
        <g class="hb-hot" data-h="coracao">
          <path fill="url(#hbHeart)" stroke="#7f1d1d" stroke-width="2" class="hb-beat" transform-origin="100 78" d="
            M100 56 C94 40 66 40 64 64 C62 88 86 104 100 120 C114 104 138 88 136 64 C134 40 106 40 100 56 Z"/>
        </g>
        <g class="hb-hot" data-h="arterias"><circle cx="148" cy="150" r="11" fill="#ef4444"/></g>
        <g class="hb-hot" data-h="veias"><circle cx="52" cy="150" r="11" fill="#3b82f6"/></g>
        <g class="hb-hot" data-h="sangue"><circle cx="100" cy="262" r="11" fill="#dc2626"/></g>
      </svg>`,
      parts:{
        coracao:{ emoji:'❤️', name:_=>_t('Heart','Coração'), sub:_=>_t('The pump','A bomba'),
          desc:_=>_t('A muscle the size of your fist with four chambers. It beats ~100 000 times a day without ever resting.','Um músculo do tamanho do teu punho com quatro câmaras. Bate ~100 000 vezes por dia sem nunca descansar.'),
          stats:[['~70',_=>_t('beats / min','batimentos / min')],['4',_=>_t('chambers','câmaras')]],
          facts:[_=>_t('It pumps about 7 500 L of blood a day.','Bombeia cerca de 7 500 L de sangue por dia.')] },
        arterias:{ emoji:'🔴', name:_=>_t('Arteries','Artérias'), sub:_=>_t('Away from heart','Saem do coração'),
          desc:_=>_t('Thick, muscular vessels that carry oxygen-rich blood away from the heart at high pressure.','Vasos espessos e musculares que levam sangue rico em oxigénio para longe do coração, a alta pressão.'),
          stats:[['O₂',_=>_t('rich','rico')]],
          facts:[_=>_t('The aorta is the body’s largest artery.','A aorta é a maior artéria do corpo.')] },
        veias:{ emoji:'🔵', name:_=>_t('Veins','Veias'), sub:_=>_t('Back to heart','Voltam ao coração'),
          desc:_=>_t('Carry oxygen-poor blood back to the heart. Tiny valves stop the blood from flowing backwards.','Levam sangue pobre em oxigénio de volta ao coração. Válvulas minúsculas impedem o sangue de recuar.'),
          facts:[_=>_t('Veins look blue through the skin but blood is always red.','As veias parecem azuis através da pele, mas o sangue é sempre vermelho.')] },
        sangue:{ emoji:'🩸', name:_=>_t('Blood','Sangue'), sub:_=>_t('~5 litres','~5 litros'),
          desc:_=>_t('Red cells carry oxygen, white cells fight infection and platelets seal wounds — all floating in plasma.','Os glóbulos vermelhos transportam oxigénio, os brancos combatem infeções e as plaquetas selam feridas — tudo a flutuar no plasma.'),
          stats:[['~5 L',_=>_t('volume','volume')],['100 000 km',_=>_t('of vessels','de vasos')]],
          facts:[_=>_t('One drop holds ~5 million red blood cells.','Uma gota tem ~5 milhões de glóbulos vermelhos.')] },
      },
      intro:{ emoji:'🫀', name:_=>_t('Circulation','Circulação'), sub:_=>_t('Cardiovascular system','Sistema cardiovascular'),
        desc:_=>_t('The heart and a 100 000 km network of vessels deliver oxygen and food to every cell. Tap a part to explore.','O coração e uma rede de 100 000 km de vasos entregam oxigénio e alimento a cada célula. Toca numa parte para explorar.'),
        stats:[['100 000 km',_=>_t('of vessels','de vasos')],['~5 L',_=>_t('of blood','de sangue')]],
        facts:[_=>_t('Blood completes a full lap of the body in ~1 minute.','O sangue dá uma volta completa ao corpo em ~1 minuto.')] },
    },

    respiracao: {
      svg: () => `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">${_defs()}
        <g class="hb-hot" data-h="traqueia"><rect x="94" y="40" width="12" height="70" rx="6" fill="#fca5a5"/>
          ${[0,1,2,3,4].map(i=>`<line x1="94" y1="${50+i*12}" x2="106" y2="${50+i*12}" stroke="#7f1d1d" stroke-width="1.5" opacity=".4"/>`).join('')}</g>
        <g class="hb-lung" transform-origin="100 110">
          <path class="hb-hot" data-h="pulmoes" fill="url(#hbLung)" stroke="#9f1239" stroke-width="1.5" d="M96 108 C70 104 48 130 46 170 C45 210 60 232 84 230 C96 229 96 210 96 190 Z"/>
          <path class="hb-hot" data-h="pulmoes" fill="url(#hbLung)" stroke="#9f1239" stroke-width="1.5" d="M104 108 C130 104 152 130 154 170 C155 210 140 232 116 230 C104 229 104 210 104 190 Z"/>
        </g>
        <g class="hb-hot" data-h="bronquios" stroke="#fff" stroke-width="2.5" fill="none" opacity=".6">
          <path d="M100 110 q-18 18 -34 40"/><path d="M100 110 q18 18 34 40"/></g>
        <path class="hb-hot" data-h="diafragma" d="M50 244 q50 22 100 0" fill="none" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
      </svg>`,
      parts:{
        pulmoes:{ emoji:'🫁', name:_=>_t('Lungs','Pulmões'), sub:_=>_t('Gas exchange','Trocas gasosas'),
          desc:_=>_t('A pair of spongy organs. Inside are ~300 million tiny air sacs (alveoli) where oxygen enters the blood.','Um par de órgãos esponjosos. Dentro há ~300 milhões de sacos de ar minúsculos (alvéolos) onde o oxigénio entra no sangue.'),
          stats:[['~300M',_=>_t('alveoli','alvéolos')],['~6 L',_=>_t('capacity','capacidade')]],
          facts:[_=>_t('Unfolded, the alveoli would cover a tennis court.','Desdobrados, os alvéolos cobririam um campo de ténis.')] },
        traqueia:{ emoji:'🌬️', name:_=>_t('Trachea','Traqueia'), sub:_=>_t('Windpipe','Tubo de ar'),
          desc:_=>_t('The tube that carries air from your throat to the lungs, kept open by C-shaped rings of cartilage.','O tubo que leva o ar da garganta aos pulmões, mantido aberto por anéis de cartilagem em forma de C.'),
          facts:[_=>_t('Tiny hairs (cilia) sweep dust back up and out.','Pelos minúsculos (cílios) varrem o pó de volta para cima.')] },
        bronquios:{ emoji:'🌳', name:_=>_t('Bronchi','Brônquios'), sub:_=>_t('Airways','Vias aéreas'),
          desc:_=>_t('The trachea splits into two bronchi that branch like an upside-down tree into thousands of tiny tubes.','A traqueia divide-se em dois brônquios que se ramificam como uma árvore invertida em milhares de tubos minúsculos.'),
          facts:[_=>_t('This "tree" has about 23 levels of branching.','Esta "árvore" tem cerca de 23 níveis de ramificação.')] },
        diafragma:{ emoji:'⬇️', name:_=>_t('Diaphragm','Diafragma'), sub:_=>_t('Breathing muscle','Músculo da respiração'),
          desc:_=>_t('A dome-shaped muscle below the lungs. It flattens to pull air in and relaxes to push it out — automatically.','Um músculo em forma de cúpula sob os pulmões. Achata-se para puxar o ar e relaxa para o expulsar — automaticamente.'),
          facts:[_=>_t('A spasm of it causes hiccups.','Um espasmo dele causa soluços.')] },
      },
      intro:{ emoji:'🫁', name:_=>_t('Breathing','Respiração'), sub:_=>_t('Respiratory system','Sistema respiratório'),
        desc:_=>_t('You breathe ~20 000 times a day, swapping carbon dioxide for the oxygen every cell needs. Tap a part to explore.','Respiras ~20 000 vezes por dia, trocando dióxido de carbono pelo oxigénio que cada célula precisa. Toca numa parte para explorar.'),
        stats:[['~20 000',_=>_t('breaths / day','respirações / dia')],['~6 L',_=>_t('lung capacity','capacidade pulmonar')]],
        facts:[_=>_t('You breathe more through one nostril at a time, alternating.','Respiras mais por uma narina de cada vez, alternando.')] },
    },

    digestao: {
      svg: () => `<svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg">${_defs()}
        <path id="hbGut" d="M100 30 L100 92 C100 120 150 120 148 150 C146 180 100 175 100 196 C100 230 150 230 140 270" fill="none" stroke="rgba(251,146,60,.25)" stroke-width="20" stroke-linecap="round"/>
        <circle r="6" fill="#f59e0b" style="offset-path:path('M100 30 L100 92 C100 120 150 120 148 150 C146 180 100 175 100 196 C100 230 150 230 140 270');animation:hb-bolus 6s linear infinite"/>
        <g class="hb-hot" data-h="boca"><ellipse cx="100" cy="28" rx="16" ry="9" fill="#fb7185"/></g>
        <g class="hb-hot" data-h="esofago"><rect x="95" y="40" width="10" height="48" rx="5" fill="#fca5a5"/></g>
        <g class="hb-hot" data-h="estomago"><path d="M100 92 C78 96 74 130 96 134 C124 138 132 112 120 100 C114 94 108 92 100 92 Z" fill="#f97316" stroke="#9a3412" stroke-width="1.5"/></g>
        <g class="hb-hot" data-h="intestino"><path d="M120 150 C150 152 150 200 100 196 C140 230 150 250 134 268" fill="none" stroke="#fb923c" stroke-width="13" stroke-linecap="round"/>
          <path d="M86 200 q-20 4 -22 26 q-2 22 18 24" fill="none" stroke="#fdba74" stroke-width="16" stroke-linecap="round"/></g>
        <g class="hb-hot" data-h="figado"><path d="M54 110 q40-12 50 6 q-26 14 -50 8 z" fill="#9a3412"/></g>
      </svg>`,
      parts:{
        boca:{ emoji:'👄', name:_=>_t('Mouth','Boca'), sub:_=>_t('Step 1','Passo 1'),
          desc:_=>_t('Digestion starts here. Teeth grind food while saliva begins breaking down starches with enzymes.','A digestão começa aqui. Os dentes trituram a comida enquanto a saliva começa a decompor os amidos com enzimas.'),
          facts:[_=>_t('You make ~1.5 litres of saliva a day.','Produzes ~1,5 litros de saliva por dia.')] },
        esofago:{ emoji:'⬇️', name:_=>_t('Oesophagus','Esófago'), sub:_=>_t('Step 2','Passo 2'),
          desc:_=>_t('A muscular tube that squeezes food down to the stomach in waves — it works even upside down.','Um tubo muscular que empurra a comida para o estômago em ondas — funciona mesmo de cabeça para baixo.'),
          facts:[_=>_t('These muscle waves are called peristalsis.','Estas ondas musculares chamam-se peristaltismo.')] },
        estomago:{ emoji:'🫙', name:_=>_t('Stomach','Estômago'), sub:_=>_t('Step 3','Passo 3'),
          desc:_=>_t('A muscular bag that churns food and bathes it in acid strong enough to dissolve metal, killing most germs.','Um saco muscular que mistura a comida e a banha em ácido forte o suficiente para dissolver metal, matando a maioria dos germes.'),
          stats:[['pH ~2',_=>_t('acidity','acidez')]],
          facts:[_=>_t('Its lining is replaced every few days so it doesn’t digest itself.','O seu revestimento é substituído a cada poucos dias para não se digerir a si próprio.')] },
        intestino:{ emoji:'🌀', name:_=>_t('Intestines','Intestinos'), sub:_=>_t('Step 4','Passo 4'),
          desc:_=>_t('The small intestine absorbs nutrients across millions of tiny folds; the large intestine reclaims water.','O intestino delgado absorve nutrientes através de milhões de pregas minúsculas; o intestino grosso recupera a água.'),
          stats:[['~7.5 m',_=>_t('total length','comprimento')]],
          facts:[_=>_t('It hosts trillions of helpful bacteria — your microbiome.','Alberga biliões de bactérias úteis — o teu microbioma.')] },
        figado:{ emoji:'🟤', name:_=>_t('Liver','Fígado'), sub:_=>_t('The chemist','O químico'),
          desc:_=>_t('Your largest internal organ. It filters toxins, stores energy and makes bile to help digest fats.','O teu maior órgão interno. Filtra toxinas, armazena energia e produz bílis para ajudar a digerir gorduras.'),
          stats:[['500+',_=>_t('jobs','funções')]],
          facts:[_=>_t('It can regrow from as little as 25% of itself.','Consegue regenerar a partir de apenas 25% de si mesmo.')] },
      },
      intro:{ emoji:'🍎', name:_=>_t('Digestion','Digestão'), sub:_=>_t('Digestive system','Sistema digestivo'),
        desc:_=>_t('A 9-metre journey that turns food into the fuel and building blocks every cell needs. Follow the path or tap an organ.','Uma viagem de 9 metros que transforma comida no combustível e nos blocos de construção que cada célula precisa. Segue o trajeto ou toca num órgão.'),
        stats:[['~9 m',_=>_t('total length','comprimento total')],['~24–72 h',_=>_t('to digest','para digerir')]],
        facts:[_=>_t('Most digestion happens in the small intestine, not the stomach.','A maior parte da digestão acontece no intestino delgado, não no estômago.')] },
    },

    cerebro: {
      svg: () => `<svg viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg">${_defs()}
        <path d="M40 120 C30 60 90 28 130 40 C175 30 200 70 184 104 C196 130 170 150 150 146 C140 168 96 172 84 150 C50 158 36 140 40 120 Z" fill="url(#hbBrain)" stroke="#9d174d" stroke-width="2"/>
        <g class="hb-hot" data-h="frontal"><path d="M50 110 C42 64 96 38 128 48 C120 70 110 96 96 120 C80 130 58 130 50 110 Z" fill="#f472b6" opacity=".0"/></g>
        <g class="hb-hot" data-h="parietal"><path d="M128 48 C168 40 190 74 176 102 C156 100 132 92 120 72 C124 62 126 54 128 48 Z" fill="#ec4899" opacity=".0"/></g>
        <g class="hb-hot" data-h="temporal"><path d="M84 150 C70 158 50 150 50 128 C66 134 84 134 96 124 C94 138 90 146 84 150 Z" fill="#db2777" opacity=".0"/></g>
        <g class="hb-hot" data-h="occipital"><path d="M150 146 C170 150 192 132 180 108 C166 116 148 122 136 120 C140 132 146 142 150 146 Z" fill="#be185d" opacity=".0"/></g>
        <g class="hb-hot" data-h="cerebelo"><ellipse cx="150" cy="160" rx="26" ry="18" fill="#9d174d"/>
          ${[0,1,2,3].map(i=>`<path d="M128 ${150+i*5} q22 6 44 0" fill="none" stroke="#fbcfe8" stroke-width="1.2" opacity=".6"/>`).join('')}</g>
        <g stroke="#9d174d" stroke-width="1.5" fill="none" opacity=".4">
          <path d="M70 70 q14 10 6 30"/><path d="M100 56 q10 16 0 34"/><path d="M132 64 q12 14 2 32"/><path d="M158 86 q8 12 -2 26"/></g>
      </svg>`,
      parts:{
        frontal:{ emoji:'🧠', name:_=>_t('Frontal lobe','Lobo frontal'), sub:_=>_t('Think & decide','Pensar e decidir'),
          desc:_=>_t('Home of planning, decisions, personality and voluntary movement. The last brain region to fully mature (~age 25).','Sede do planeamento, decisões, personalidade e movimento voluntário. A última região a amadurecer (~aos 25 anos).'),
          facts:[_=>_t('It controls the muscles on the opposite side of the body.','Controla os músculos do lado oposto do corpo.')] },
        parietal:{ emoji:'✋', name:_=>_t('Parietal lobe','Lobo parietal'), sub:_=>_t('Touch & space','Tato e espaço'),
          desc:_=>_t('Processes touch, temperature and where your body is in space, building a map of the world around you.','Processa o tato, a temperatura e onde o teu corpo está no espaço, construindo um mapa do mundo à tua volta.'),
          facts:[_=>_t('It helps you do maths and read.','Ajuda-te a fazer contas e a ler.')] },
        temporal:{ emoji:'👂', name:_=>_t('Temporal lobe','Lobo temporal'), sub:_=>_t('Hearing & memory','Audição e memória'),
          desc:_=>_t('Handles hearing, language and long-term memory. The hippocampus inside it turns experiences into memories.','Trata da audição, linguagem e memória de longo prazo. O hipocampo no seu interior transforma experiências em memórias.'),
          facts:[_=>_t('Damage here can cause trouble recognising faces.','Lesões aqui podem dificultar reconhecer rostos.')] },
        occipital:{ emoji:'👁️', name:_=>_t('Occipital lobe','Lobo occipital'), sub:_=>_t('Vision','Visão'),
          desc:_=>_t('The brain’s vision centre at the very back. It turns signals from your eyes into the images you "see".','O centro da visão, mesmo atrás. Transforma os sinais dos olhos nas imagens que "vês".'),
          facts:[_=>_t('You actually see with your brain, not your eyes.','Na verdade vês com o cérebro, não com os olhos.')] },
        cerebelo:{ emoji:'⚖️', name:_=>_t('Cerebellum','Cerebelo'), sub:_=>_t('Balance','Equilíbrio'),
          desc:_=>_t('The "little brain" that fine-tunes movement, balance and coordination. It holds over half your neurons.','O "pequeno cérebro" que afina o movimento, o equilíbrio e a coordenação. Contém mais de metade dos teus neurónios.'),
          stats:[['50%+',_=>_t('of neurons','dos neurónios')]],
          facts:[_=>_t('It lets you walk without thinking about each step.','Permite-te andar sem pensar em cada passo.')] },
      },
      intro:{ emoji:'🧠', name:_=>_t('Brain','Cérebro'), sub:_=>_t('~86 billion neurons','~86 mil milhões de neurónios'),
        desc:_=>_t('A 1.4 kg organ that controls everything you think, feel and do, using less power than a light bulb. Tap a region.','Um órgão de 1,4 kg que controla tudo o que pensas, sentes e fazes, usando menos energia que uma lâmpada. Toca numa região.'),
        stats:[['~86 mil M',_=>_t('neurons','neurónios')],['~20 W',_=>_t('power use','consumo')]],
        facts:[_=>_t('Neurons fire signals at up to 430 km/h.','Os neurónios disparam sinais até 430 km/h.'),_=>_t('It’s ~73% water.','É ~73% água.')] },
    },
  };

  /* — Senses (card grid) — */
  const SENSES = [
    { emoji:'👁️', name:_=>_t('Sight','Visão'), organ:_=>_t('Eyes','Olhos'),
      desc:_=>_t('Eyes catch light and the brain builds it into images — about 80% of what we learn comes through vision.','Os olhos captam a luz e o cérebro transforma-a em imagens — cerca de 80% do que aprendemos entra pela visão.'),
      svg:`<svg viewBox="0 0 100 70">${_defs()}<ellipse cx="50" cy="35" rx="42" ry="24" fill="#fff" stroke="#94a3b8" stroke-width="2"/><circle cx="50" cy="35" r="16" fill="#0891b2"/><circle cx="50" cy="35" r="7" fill="#0f172a"/><circle cx="45" cy="30" r="3" fill="#fff"/></svg>` },
    { emoji:'👂', name:_=>_t('Hearing','Audição'), organ:_=>_t('Ears','Ouvidos'),
      desc:_=>_t('Ears turn vibrations in the air into sound, and also keep you balanced through fluid-filled loops inside.','Os ouvidos transformam vibrações do ar em som e mantêm-te equilibrado através de canais cheios de líquido.'),
      svg:`<svg viewBox="0 0 100 70"><path d="M62 12 C40 8 26 28 30 46 C32 58 44 62 46 52 C48 44 40 40 46 32 C52 24 66 26 66 38 C66 50 56 52 58 60" fill="none" stroke="#fdba74" stroke-width="6" stroke-linecap="round"/></svg>` },
    { emoji:'👃', name:_=>_t('Smell','Olfato'), organ:_=>_t('Nose','Nariz'),
      desc:_=>_t('The nose detects thousands of chemicals in the air. Smell is tightly wired to memory and emotion.','O nariz deteta milhares de químicos no ar. O olfato está fortemente ligado à memória e à emoção.'),
      svg:`<svg viewBox="0 0 100 70"><path d="M50 10 C44 30 36 44 40 54 C44 62 56 62 60 54 C64 44 56 30 50 10 Z" fill="#fdba74" stroke="#ea9b63" stroke-width="2"/><circle cx="44" cy="54" r="3" fill="#9a3412"/><circle cx="56" cy="54" r="3" fill="#9a3412"/></svg>` },
    { emoji:'👅', name:_=>_t('Taste','Paladar'), organ:_=>_t('Tongue','Língua'),
      desc:_=>_t('Taste buds sense five basics — sweet, salty, sour, bitter and umami. Most "flavour" is actually smell.','As papilas sentem cinco sabores — doce, salgado, ácido, amargo e umami. Grande parte do "sabor" é, na verdade, olfato.'),
      svg:`<svg viewBox="0 0 100 70"><path d="M30 20 C30 50 70 50 70 20 C70 40 60 60 50 60 C40 60 30 40 30 20 Z" fill="#fb7185" stroke="#be123c" stroke-width="2"/>${[40,50,60].map(x=>`<circle cx="${x}" cy="34" r="2.5" fill="#9f1239"/>`).join('')}</svg>` },
    { emoji:'✋', name:_=>_t('Touch','Tato'), organ:_=>_t('Skin','Pele'),
      desc:_=>_t('Skin is the largest organ, packed with receptors for pressure, pain, heat and cold across ~2 m².','A pele é o maior órgão, repleta de recetores de pressão, dor, calor e frio ao longo de ~2 m².'),
      svg:`<svg viewBox="0 0 100 70"><path d="M30 50 L30 30 Q34 18 40 30 L40 24 Q44 14 48 24 L48 26 Q52 16 56 26 L56 30 Q62 26 60 38 L60 50 Z" fill="url(#hbSkin)" stroke="#ea9b63" stroke-width="2"/>${_defs()}</svg>` },
  ];

  /* — Células e DNA — reuse the cell & DNA scenes with hotspots — */
  const CELL = {
    svg: () => `<svg viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg">${_defs()}
      <ellipse cx="110" cy="100" rx="100" ry="82" fill="url(#hbCell)" stroke="rgba(168,85,247,.6)" stroke-width="3"/>
      <g class="hb-hot" data-h="nucleo"><ellipse cx="92" cy="90" rx="34" ry="30" fill="url(#hbNuc)"/>
        <g style="animation:hb-spin 18s linear infinite;transform-origin:92px 90px"><path d="M76 90 q16-14 32 0 q-16 14 -32 0" fill="none" stroke="#f0abfc" stroke-width="2" opacity=".7"/></g></g>
      <g class="hb-hot hb-organelle" data-h="mitocondria" fill="#f97316">
        <ellipse cx="165" cy="74" rx="18" ry="9" transform="rotate(18 165 74)"/>
        <path d="M150 74 q15-6 30 0" stroke="#fff" stroke-width="1.5" fill="none" opacity=".5"/></g>
      <g class="hb-hot" data-h="membrana"><ellipse cx="110" cy="100" rx="100" ry="82" fill="none" stroke="#a855f7" stroke-width="6" opacity=".5"/></g>
      <g class="hb-hot" data-h="reticulo" stroke="#22d3ee" stroke-width="3" fill="none" opacity=".7">
        <path d="M120 140 q14-10 28 0 q14 10 28 0"/><path d="M118 152 q15-9 30 0 q15 9 30 0"/></g>
      <g class="hb-hot" data-h="dna2"><circle cx="92" cy="90" r="6" fill="#22d3ee"/></g>
    </svg>`,
    parts:{
      nucleo:{ emoji:'🧬', name:_=>_t('Nucleus','Núcleo'), sub:_=>_t('Control centre','Centro de comando'),
        desc:_=>_t('The cell’s brain. It guards your DNA and decides which genes to switch on, controlling everything the cell does.','O cérebro da célula. Guarda o teu DNA e decide que genes ligar, controlando tudo o que a célula faz.'),
        facts:[_=>_t('Almost every cell holds a full copy of your DNA.','Quase todas as células têm uma cópia completa do teu DNA.')] },
      mitocondria:{ emoji:'🔋', name:_=>_t('Mitochondria','Mitocôndrias'), sub:_=>_t('Power plants','Centrais de energia'),
        desc:_=>_t('They burn sugar with oxygen to make ATP, the cell’s energy currency. Busy cells hold thousands of them.','Queimam açúcar com oxigénio para produzir ATP, a moeda de energia da célula. Células ativas têm milhares delas.'),
        facts:[_=>_t('They have their own tiny DNA, inherited only from your mother.','Têm o seu próprio DNA minúsculo, herdado só da mãe.')] },
      membrana:{ emoji:'🛡️', name:_=>_t('Membrane','Membrana'), sub:_=>_t('The border','A fronteira'),
        desc:_=>_t('A flexible skin that wraps the cell, choosing exactly what gets in and out.','Uma pele flexível que envolve a célula, escolhendo exatamente o que entra e sai.'),
        facts:[_=>_t('It is only two molecules thick.','Tem apenas duas moléculas de espessura.')] },
      reticulo:{ emoji:'🏭', name:_=>_t('ER & ribosomes','Retículo e ribossomas'), sub:_=>_t('Factory','Fábrica'),
        desc:_=>_t('A folded network where proteins — the cell’s workers and building blocks — are assembled and packaged.','Uma rede dobrada onde as proteínas — os operários e blocos da célula — são montadas e embaladas.'),
        facts:[_=>_t('A cell can make thousands of proteins per second.','Uma célula pode fazer milhares de proteínas por segundo.')] },
      dna2:{ emoji:'🧬', name:_=>_t('DNA','DNA'), sub:_=>_t('The recipe','A receita'),
        desc:_=>_t('Coiled inside the nucleus: 2 metres of DNA carrying 3 billion base pairs — the instructions to build and run you.','Enrolado dentro do núcleo: 2 metros de DNA com 3 mil milhões de pares de bases — as instruções para te construir e fazer funcionar.'),
        stats:[['2 m',_=>_t('per cell','por célula')],['3 mil M',_=>_t('base pairs','pares de bases')]],
        facts:[_=>_t('All your DNA uncoiled would reach the Sun and back ~300 times.','Todo o teu DNA esticado iria ao Sol e voltava ~300 vezes.'),_=>_t('Humans share ~99.9% of their DNA with each other.','Os humanos partilham ~99,9% do DNA entre si.')] },
    },
    intro:{ emoji:'🧬', name:_=>_t('Cells & DNA','Células e DNA'), sub:_=>_t('The building blocks','Os blocos da vida'),
      desc:_=>_t('Every part of you is built from cells, and every cell runs on instructions written in DNA. Tap a structure to explore.','Tudo em ti é feito de células, e cada célula funciona com instruções escritas no DNA. Toca numa estrutura para explorar.'),
      stats:[['~37 bi',_=>_t('cells','células')],['~200',_=>_t('cell types','tipos de célula')]],
      facts:[_=>_t('You make ~3.8 million new cells every second.','Produzes ~3,8 milhões de células novas a cada segundo.')] },
  };

  /* ════════════════════════════════ TOPICS ═════════════════════════ */
  const TOPICS = [
    { id:'anatomia',   ic:'🧍', name:_=>_t('Anatomy','Anatomia') },
    { id:'esqueleto',  ic:'🦴', name:_=>_t('Skeleton','Esqueleto') },
    { id:'circulacao', ic:'🫀', name:_=>_t('Circulation','Circulação') },
    { id:'respiracao', ic:'🫁', name:_=>_t('Breathing','Respiração') },
    { id:'digestao',   ic:'🍎', name:_=>_t('Digestion','Digestão') },
    { id:'cerebro',    ic:'🧠', name:_=>_t('Brain','Cérebro') },
    { id:'sentidos',   ic:'👁️', name:_=>_t('Senses','Sentidos') },
    { id:'celulas',    ic:'🧬', name:_=>_t('Cells & DNA','Células e DNA') },
  ];

  /* ════════════════════════════════ RENDER ═════════════════════════ */
  function _renderTopic(id) {
    const panel = _root.querySelector('#hb-panel');
    if (!panel) return;
    _topic = id;
    _root.querySelectorAll('.hb-topic').forEach(b => b.classList.toggle('active', b.dataset.id === id));

    if (id === 'anatomia') { _level = 0; _renderZoom(panel); return; }
    if (id === 'sentidos') { _renderSenses(panel); return; }
    const data = id === 'celulas' ? CELL : DIAGRAMS[id];
    if (data) { _renderDiagram(panel, data); return; }
  }

  function _renderSenses(panel) {
    panel.innerHTML = `<div class="hb-senses">
      ${SENSES.map(s => `<div class="hb-sense-card">
        <div class="hb-sense-svg">${s.svg}</div>
        <div class="hb-sense-name">${s.emoji} ${s.name()}</div>
        <div class="hb-sense-organ">${s.organ()}</div>
        <div class="hb-sense-desc">${s.desc()}</div>
      </div>`).join('')}
    </div>`;
  }

  function _infoHTML(p) {
    const stats = (p.stats || []).map(([v, l]) => `<div class="hb-stat"><div class="hb-stat-v">${v}</div><div class="hb-stat-l">${l()}</div></div>`).join('');
    const facts = (p.facts || []).map(f => `<li>${f()}</li>`).join('');
    return `
      <div class="hb-info-hd"><span class="hb-info-emoji">${p.emoji}</span>
        <div><div class="hb-info-ttl">${p.name()}</div><div class="hb-info-sub">${p.sub()}</div></div></div>
      <div class="hb-info-desc">${p.desc()}</div>
      ${stats ? `<div class="hb-info-stats">${stats}</div>` : ''}
      ${facts ? `<ul class="hb-info-facts">${facts}</ul>` : ''}`;
  }

  function _renderDiagram(panel, data) {
    const keys = Object.keys(data.parts);
    panel.innerHTML = `
      <div class="hb-diagram">
        <div class="hb-canvas">${data.svg()}
          <div class="hb-chips">
            ${keys.map(k => `<button class="hb-chip" data-h="${k}">${data.parts[k].name()}</button>`).join('')}
          </div>
        </div>
        <aside class="hb-info" id="hb-info">${_infoHTML(data.intro)}</aside>
      </div>`;

    /* position the chips row at the bottom of the canvas */
    const chips = panel.querySelector('.hb-chips');
    if (chips) Object.assign(chips.style, { position:'absolute', left:'0', right:'0', bottom:'.6rem', justifyContent:'center', padding:'0 1rem' });

    const info = panel.querySelector('#hb-info');
    const select = (k, srcEl) => {
      const p = data.parts[k];
      if (!p) return;
      info.innerHTML = _infoHTML(p);
      panel.querySelectorAll('.hb-hot').forEach(h => h.classList.toggle('sel', h.dataset.h === k));
      panel.querySelectorAll('.hb-chip').forEach(c => c.classList.toggle('on', c.dataset.h === k));
    };
    panel.querySelectorAll('.hb-hot').forEach(h => h.addEventListener('click', () => select(h.dataset.h)));
    panel.querySelectorAll('.hb-chip').forEach(c => c.addEventListener('click', () => select(c.dataset.h)));
  }

  /* ════════════════════════════════ PUBLIC ═════════════════════════ */
  function mount(host) {
    host.innerHTML = `
      <div class="hb-wrap">
        <nav class="hb-topics">
          ${TOPICS.map(t => `<button class="hb-topic ${t.id==='anatomia'?'active':''}" data-id="${t.id}">
            <span class="hb-topic-ic">${t.ic}</span>${t.name()}</button>`).join('')}
        </nav>
        <div class="hb-stage"><div class="hb-panel active" id="hb-panel"></div></div>
      </div>`;
    _root = host.querySelector('.hb-wrap');
    _root.querySelector('.hb-topics').addEventListener('click', e => {
      const b = e.target.closest('.hb-topic');
      if (b) _renderTopic(b.dataset.id);
    });
    _renderTopic(_topic || 'anatomia');
  }

  function resume() { /* static SVG/CSS — nothing to restart */ }
  function stop()   { /* no timers/RAF to tear down */ }

  return { mount, resume, stop };
})();
