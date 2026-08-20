/* ══════════════════════════════════════════════════════════════════════
   PhotoCheats — a secção "Cheatsheets" da Fotografia.

   Um cheatsheet aqui é uma INFOGRAFIA de consulta rápida: quem o abre
   está com a câmara na mão e tem de perceber o essencial a OLHAR. Por
   isso o conteúdo é uma lista de blocos visuais (js/pages/photo-cards.js)
   e não prosa — a lição vive em Aprender e as contas em Ferramentas, e
   este módulo aponta-lhes em vez de as repetir.

     Cheatsheets  → "preciso desta resposta agora"
     Aprender     → "quero perceber isto"
     Ferramentas  → "quero calcular isto"

   Duas famílias, e a diferença entre elas está à vista no hub:
     • gerais       — conceitos que valem em toda a fotografia
                      (data/photo/cheats.json, agrupados em Câmara e Luz)
     • por género   — o MESMO conceito aplicado, quando a resposta muda
                      (data/photo/cheats-genre.json: 8 géneros com fichas
                      próprias; os outros 20 têm o cartão de bolso
                      derivado de genres.json)

   Dois cartões têm motor próprio e ficam no seu grupo temático com o
   selo "interativo": a calculadora de velocidade e os 20 esquemas de luz
   de retrato (PhotoLightArt).

   Recebe um `ctx` da photography.js (assetPath, classe de câmara, go…)
   para não duplicar estado nem conhecer rotas.
   ════════════════════════════════════════════════════════════════════ */
const PhotoCheats = (function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = s => String(s == null ? '' : s)
    .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let _ctx = null;
  let _data = null, _gen = null, _p = null;

  function loadAll() {
    if (_data && _gen) return Promise.resolve({ data: _data, gen: _gen });
    if (_p) return _p;
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
    _p = Promise.all([get('data/photo/cheats.json'), get('data/photo/cheats-genre.json')])
      .then(([a, b]) => { _data = a; _gen = b; return { data: a, gen: b }; })
      .catch(() => { _p = null; return null; });
    return _p;
  }

  /* ══ Velocidade de obturador (motor próprio) ════════════════════════
     A pergunta "que velocidade uso?" tem SEMPRE duas respostas e quem
     começa só conhece uma:

       1. o tremido das MINHAS mãos  → regra do inverso da focal
       2. o movimento do SUJEITO     → tabela, e nada a ver com a lente

     Vale a mais rápida das duas. A regra do inverso com margem de
     segurança só responde à primeira — e é por isso que falha com uma
     criança a saltar: ela move-se ao mesmo ritmo aos 22mm e aos 200mm. */

  const SHUTTERS = [
    1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600, 1 / 1250,
    1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250, 1 / 200, 1 / 160,
    1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20, 1 / 15,
    1 / 13, 1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.3, 1.6, 2,
    2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30,
  ];
  const fmtShutter = s => (s >= 1 ? `${(+s.toFixed(1))}s` : `1/${Math.round(1 / s)}`);
  /* Arredonda para o valor REAL do disparador mais próximo (e sempre para
     o lado seguro, o mais rápido) — dizer "1/44" a quem só tem 1/50 no
     seletor é dar uma resposta que não existe na câmara. */
  function snapFaster(sec) {
    for (let i = SHUTTERS.length - 1; i >= 0; i--) if (SHUTTERS[i] <= sec) return SHUTTERS[i];
    return SHUTTERS[0];
  }

  /* min = velocidade mínima para CONGELAR; blur = velocidade que dá
     arrasto de propósito (null quando não faz sentido). */
  const SUBJECTS = [
    { g: 'Pessoas', id: 'retrato',   ico: '🧍', name: 'Retrato, pessoa parada',    min: 1 / 125,  note: 'Chega 1/125 — abaixo disso já se nota a respiração e o micro-movimento.' },
    { g: 'Pessoas', id: 'andar',     ico: '🚶', name: 'Pessoa a andar',            min: 1 / 250,  note: 'A cara congela a 1/125, mas os pés e as mãos arrastam.' },
    { g: 'Pessoas', id: 'grupo',     ico: '👨‍👩‍👧', name: 'Grupo, foto de família',  min: 1 / 160,  note: 'Há sempre alguém a mexer-se. Não desças de 1/160 num grupo.' },
    { g: 'Pessoas', id: 'crianca',   ico: '🧒', name: 'Criança a brincar',         min: 1 / 500,  note: 'Uma criança muda de direção sem aviso — 1/500 é o mínimo honesto.' },
    { g: 'Pessoas', id: 'salto',     ico: '🤸', name: 'Criança a saltar / correr', min: 1 / 800,  note: 'Mãos e cabelo em pleno salto exigem 1/800 a 1/1000.' },
    { g: 'Pessoas', id: 'danca',     ico: '💃', name: 'Dança, palco em movimento', min: 1 / 500,  blur: 1 / 15, note: 'A 1/15 com panning fica o movimento; a 1/500 fica a pose.' },
    { g: 'Pessoas', id: 'concerto',  ico: '🎤', name: 'Concerto, músico',          min: 1 / 250,  note: 'O braço do baterista precisa de 1/500; o vocalista chega-lhe 1/250.' },

    { g: 'Animais', id: 'gato',      ico: '🐈', name: 'Animal parado ou a andar',  min: 1 / 250,  note: 'Os bigodes e as orelhas mexem sempre mais do que parece.' },
    { g: 'Animais', id: 'cao',       ico: '🐕', name: 'Cão a correr',              min: 1 / 1000, note: 'A correr na tua direção perdoa mais; a passar de lado, não.' },
    { g: 'Animais', id: 'ave-pousada', ico: '🐦', name: 'Ave pousada',             min: 1 / 500,  note: 'Parece parada e não está — a cabeça faz microssacadas.' },
    { g: 'Animais', id: 'ave-voo',   ico: '🦅', name: 'Ave em voo',                min: 1 / 2000, note: 'Para congelar as pontas das asas: 1/2500 a 1/4000.' },
    { g: 'Animais', id: 'insecto',   ico: '🐝', name: 'Inseto em voo',            min: 1 / 4000, note: 'Sem flash é quase impossível — a asa bate mais depressa que qualquer obturador acessível.' },

    { g: 'Desporto', id: 'futebol',  ico: '⚽', name: 'Futebol, andebol, râguebi', min: 1 / 1000, note: 'A bola no pé é a parte mais rápida do enquadramento.' },
    { g: 'Desporto', id: 'corrida',  ico: '🏃', name: 'Atletismo, corrida',        min: 1 / 800,  note: 'De frente 1/640 chega; de perfil sobe para 1/1250.' },
    { g: 'Desporto', id: 'ciclismo', ico: '🚴', name: 'Ciclismo, skate, BMX',      min: 1 / 1000, blur: 1 / 60, note: 'A 1/60 com panning: sujeito nítido e fundo arrastado.' },
    { g: 'Desporto', id: 'carro',    ico: '🚗', name: 'Carro a passar',            min: 1 / 1000, blur: 1 / 30, note: 'Congelado, um carro parece estacionado. O panning é quase sempre melhor.' },
    { g: 'Desporto', id: 'motor',    ico: '🏍️', name: 'Motociclismo, automobilismo', min: 1 / 1600, blur: 1 / 125, note: 'Nas rodas, se estiverem congeladas, a foto parece falsa.' },

    { g: 'Natureza', id: 'folhas',   ico: '🍃', name: 'Folhas, ramos ao vento',    min: 1 / 250,  note: 'Numa paisagem com vento é isto que estraga a nitidez, não o tripé.' },
    { g: 'Natureza', id: 'ondas',    ico: '🌊', name: 'Ondas a rebentar',          min: 1 / 500,  blur: 1, note: 'A 1/500 fica a espuma suspensa; a 1s a 30s fica névoa.' },
    { g: 'Natureza', id: 'cascata',  ico: '💧', name: 'Cascata, ribeiro',          min: 1 / 1000, blur: 0.5, note: 'Água sedosa começa em 1/2s. Acima de 2s deixa de mudar muito.' },
    { g: 'Natureza', id: 'chuva',    ico: '🌧️', name: 'Chuva, pingos',             min: 1 / 1000, blur: 1 / 30, note: 'A 1/1000 ficam gotas; a 1/30 ficam riscos.' },
    { g: 'Natureza', id: 'estrelas', ico: '🌌', name: 'Estrelas como pontos',      min: null, astro: 1, note: 'Aqui a regra é outra: 500 ÷ focal equivalente, senão as estrelas viram tracinhos.' },

    { g: 'Cidade & objetos', id: 'rua',      ico: '🚶‍♂️', name: 'Rua, gente a passar', min: 1 / 250, note: 'Zona de foco a f/8 e 1/250: dispara sem pensar.' },
    { g: 'Cidade & objetos', id: 'trafego',  ico: '🌃', name: 'Rastos de trânsito',   min: null, blur: 8, note: 'Precisa de tripé. 8 a 30 segundos, conforme o trânsito.' },
    { g: 'Cidade & objetos', id: 'fogo',     ico: '🎆', name: 'Fogo de artifício',    min: null, blur: 3, note: 'Tripé, modo Bulb ou 2–5s, f/11, ISO 100.' },
    { g: 'Cidade & objetos', id: 'produto',  ico: '📦', name: 'Produto, comida, tripé', min: 1 / 60, note: 'Com tripé e temporizador, a velocidade deixa de ser um problema.' },
  ];

  const STAB = [
    { id: 'none',  name: 'Sem estabilização', stops: 0,   hint: 'Lente e corpo sem IS/IBIS' },
    { id: 'lens',  name: 'IS na lente',       stops: 2.5, hint: 'A maioria das lentes de kit' },
    { id: 'ibis',  name: 'IBIS no corpo',     stops: 3.5, hint: 'Estabilização no sensor' },
    { id: 'both',  name: 'IS + IBIS',         stops: 5,   hint: 'Corpo e lente a trabalhar juntos' },
  ];

  /* Margem: com quantos "×" da regra do inverso se trabalha. */
  const MARGIN = [
    { id: '1', name: '1× (regra clássica)', mul: 1, hint: 'Herdada do tempo do filme' },
    { id: '2', name: '2× (recomendado)',    mul: 2, hint: 'Sensores de hoje mostram tremido que o filme escondia' },
    { id: '4', name: '4× (exigente)',       mul: 4, hint: 'Alta resolução, para ampliar ou ver a 100%' },
  ];

  const st = { subject: 'salto', focal: 22, stab: 'lens', margin: '2' };
  function restore() {
    try {
      const raw = JSON.parse(localStorage.getItem('ph-shutter') || 'null');
      if (raw && typeof raw === 'object') Object.assign(st, raw);
    } catch (_) {}
    if (!SUBJECTS.some(s => s.id === st.subject)) st.subject = 'salto';
  }
  const save = () => { try { localStorage.setItem('ph-shutter', JSON.stringify(st)); } catch (_) {} };

  function crop() { return parseFloat((_ctx && _ctx.classCrop && _ctx.classCrop()) || '1.6') || 1.6; }

  function compute() {
    const subj = SUBJECTS.find(s => s.id === st.subject) || SUBJECTS[0];
    const c = crop();
    const eq = st.focal * c;
    const stab = STAB.find(s => s.id === st.stab) || STAB[0];
    const mul = (MARGIN.find(m => m.id === st.margin) || MARGIN[1]).mul;

    // 1) tremido: 1/(focal eq × margem), depois aliviado pelos stops de IS
    const baseShake = 1 / (eq * mul);
    const shake = baseShake * Math.pow(2, stab.stops);
    const subject = subj.min;
    const astro = subj.astro ? 500 / eq : null;

    let need, driver;
    if (astro != null) { need = astro; driver = 'astro'; }
    else if (subject == null) { need = subj.blur; driver = 'blur'; }
    else if (subject <= shake) { need = subject; driver = 'subject'; }
    else { need = shake; driver = 'shake'; }

    return {
      subj, eq, crop: c, stab, mul,
      shake: snapFaster(shake), shakeRaw: shake, baseShake: snapFaster(baseShake),
      subject: subject == null ? null : snapFaster(subject),
      astro, blur: subj.blur || null,
      need: snapFaster(need), driver,
    };
  }

  /* Pré-visualização do resultado: um número sozinho ("1/800") não diz a
     ninguém o que acontece se o ignorar. A tira mostra a MESMA fotografia
     à velocidade calculada e a dois e quatro stops abaixo dela — e o
     arrasto duplica a cada stop, que é a relação real.
     A fotografia acompanha o que o utilizador disse estar a fotografar. */
  const PREVIEW_BASE = {
    'Pessoas': 'vis-retrato', 'Animais': 'vis-vida-selvagem', 'Desporto': 'vis-desporto',
    'Natureza': 'vis-paisagem', 'Cidade & objetos': 'vis-rua',
  };
  const PREVIEW_ID = { estrelas: 'vis-astro', trafego: 'look-cidade', fogo: 'look-cidade', produto: 'vis-produto' };

  function shutterPreviewHTML(r) {
    if (typeof PhotoCard === 'undefined') return '';
    const base = PREVIEW_ID[r.subj.id] || PREVIEW_BASE[r.subj.g] || 'vis-desporto';
    if (!(_ctx && _ctx.assetPath && _ctx.assetPath(base))) return '';
    // Nas situações em que o arrasto É a fotografia, a referência nítida
    // deixa de fazer sentido — mostra-se a escala do arrasto pretendido.
    const ref = r.driver === 'blur' ? r.blur : r.need;
    /* k=1 é o valor calculado tal e qual: passá-lo pelo snap devolvia o
       degrau seguinte (1/800 aparecia como 1/1000) e a tira contradizia
       o número grande logo acima. */
    const steps = [1, 4, 16].map(k => ({
      t: k === 1 ? ref : snapFaster(ref * k),
      motion: Math.min(100, 1.6 * k),
    }));
    const notes = [
      'À velocidade calculada: o sujeito fica nítido.',
      'Dois stops abaixo: já se nota, sobretudo nas extremidades.',
      'Quatro stops abaixo: a fotografia deixa de ser aproveitável.',
    ];
    return PhotoCard.block({
      kind: 'strip', t: 'O que acontece se descer daqui', ar: '3/2', base,
      hint: 'A mesma cena, dois e quatro stops abaixo do valor calculado.',
      axis: ['nítido', 'arrastado'],
      cells: steps.map((s, i) => ({
        v: fmtShutter(s.t), recipe: { motion: s.motion },
        mark: i === 0 ? 'o teu valor' : 0, note: notes[i],
      })),
    }, _ctx);
  }

  function shutterResultHTML() {
    const r = compute();
    const cls = _ctx && _ctx.classDef && _ctx.classDef();
    const driverTxt = {
      subject: `Manda o <b>movimento do sujeito</b>. A tua lente já estaria segura a ${fmtShutter(r.shake)} — é ${r.subj.name.toLowerCase()} que obriga a ir até aqui.`,
      shake: `Manda o <b>tremido das tuas mãos</b>. Para o sujeito bastava ${r.subject ? fmtShutter(r.subject) : '—'}, mas a esta focal a lente não aguenta mais lento.`,
      astro: `Manda a <b>rotação da Terra</b>: acima disto as estrelas deixam de ser pontos e viram traços.`,
      blur: `Aqui não se congela nada — o arrasto <b>é</b> a fotografia.`,
    }[r.driver];

    const rows = [
      ['🤝 Limite do teu tremido',
        `1/(${r.eq.toFixed(0)}mm × ${r.mul}) ${r.stab.stops ? `+ ${r.stab.stops} stops de ${r.stab.name}` : 'sem estabilização'}`,
        fmtShutter(r.shake), r.driver === 'shake'],
      ['🏃 Exigido pelo sujeito',
        r.subj.name, r.subject ? fmtShutter(r.subject) : (r.astro ? `500 ÷ ${r.eq.toFixed(0)} = ${fmtShutter(r.astro)}` : 'não se congela'),
        r.driver === 'subject' || r.driver === 'astro'],
    ];

    return `
      <div class="cs-shot-out">
        <div class="cs-shot-big">
          <span class="cs-shot-val">${fmtShutter(r.need)}</span>
          <span class="cs-shot-cap">ou mais rápido</span>
        </div>
        <p class="cs-shot-driver">${driverTxt}</p>
      </div>
      <div class="cs-shot-rows">
        ${rows.map(([k, sub, v, on]) => `
          <div class="cs-shot-row${on ? ' on' : ''}">
            <span class="cs-shot-k">${k}<small>${esc(sub)}</small></span>
            <span class="cs-shot-v">${v}</span>
          </div>`).join('')}
      </div>
      <p class="cs-note">💡 ${esc(r.subj.note)}</p>
      ${r.blur ? `<p class="cs-note">🌀 A brincar ao contrário: <b>${fmtShutter(r.blur)}</b> para mostrar o movimento em vez de o congelar.</p>` : ''}
      <p class="cs-shot-ctx">A contar com <b>${esc((cls && cls.name) || 'APS-C')}</b> (crop ${r.crop}×): ${st.focal}mm reais = <b>${r.eq.toFixed(0)}mm equivalentes</b>.
        ${r.driver === 'subject' ? 'Repara: mudar de lente não muda esta resposta.' : ''}</p>
      <p class="cs-shot-next">Não tens luz para esta velocidade? Abre a abertura primeiro, sobe o ISO depois — por esta ordem. Nunca desças a velocidade abaixo do valor acima: ruído corrige-se, tremido não.</p>
      ${shutterPreviewHTML(r)}`;
  }

  function shutterCalcHTML() {
    const groups = [...new Set(SUBJECTS.map(s => s.g))];
    return `
      <div class="cs-block cs-shot">
        <h3 class="cs-block-t">🧮 A velocidade mínima para o teu caso <small>interativo</small></h3>
        ${_ctx.contextBarHTML ? _ctx.contextBarHTML() : ''}
        <div class="cs-shot-controls">
          <label class="cs-field">
            <span class="cs-lbl">O que estás a fotografar</span>
            <select class="ph-select" id="cs-subj">
              ${groups.map(g => `<optgroup label="${esc(g)}">${SUBJECTS.filter(s => s.g === g)
                .map(s => `<option value="${s.id}"${s.id === st.subject ? ' selected' : ''}>${s.ico} ${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}
            </select>
          </label>
          <label class="cs-field">
            <span class="cs-lbl">Focal da lente <small>(mm reais)</small></span>
            <input type="number" class="ph-input" id="cs-focal" min="4" max="1200" step="1" value="${st.focal}">
          </label>
          <label class="cs-field">
            <span class="cs-lbl">Estabilização</span>
            <select class="ph-select" id="cs-stab">
              ${STAB.map(s => `<option value="${s.id}"${s.id === st.stab ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select>
          </label>
          <label class="cs-field">
            <span class="cs-lbl">Margem de segurança</span>
            <select class="ph-select" id="cs-margin">
              ${MARGIN.map(m => `<option value="${m.id}"${m.id === st.margin ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="cs-quick">
          <span class="cs-quick-lbl">Atalhos:</span>
          ${[['22', '22mm'], ['50', '50mm'], ['135', '135mm'], ['200', '200mm'], ['5.6', 'telemóvel 1×']]
            .map(([v, l]) => `<button class="ph-chip cs-quick-btn" data-focal="${v}">${l}</button>`).join('')}
        </div>
        <div id="cs-shot-result"></div>
      </div>`;
  }

  // Tabela de bolso — a grelha visual com o mínimo de cada sujeito.
  function shutterTableHTML() {
    const groups = [...new Set(SUBJECTS.map(s => s.g))];
    return groups.map(g => PhotoCard.block({
      kind: 'grid', t: g, cols: 2,
      items: SUBJECTS.filter(s => s.g === g).map(s => ({
        ico: s.ico, k: s.name,
        v: s.min ? fmtShutter(s.min) : (s.astro ? '500 ÷ focal eq' : 'não se congela'),
        note: s.note + (s.blur ? ` <b>Arrastar de propósito: ${fmtShutter(s.blur)}.</b>` : ''),
      })),
    }, _ctx)).join('');
  }

  function wireShutter(box) {
    const out = box.querySelector('#cs-shot-result');
    if (!out) return;
    // A tira de pré-visualização é recriada a cada mudança: as telas novas
    // têm de voltar a ser ligadas, senão ficam em branco.
    const render = () => {
      out.innerHTML = shutterResultHTML();
      if (typeof PhotoCard !== 'undefined') PhotoCard.wire(out);
    };
    const q = s => box.querySelector(s);
    q('#cs-subj').addEventListener('change', e => { st.subject = e.target.value; save(); render(); });
    q('#cs-stab').addEventListener('change', e => { st.stab = e.target.value; save(); render(); });
    q('#cs-margin').addEventListener('change', e => { st.margin = e.target.value; save(); render(); });
    const focal = q('#cs-focal');
    focal.addEventListener('input', () => {
      const v = parseFloat(focal.value);
      if (v > 0) { st.focal = v; save(); render(); }
    });
    box.querySelectorAll('[data-focal]').forEach(b => b.addEventListener('click', () => {
      st.focal = parseFloat(b.dataset.focal); focal.value = st.focal; save(); render();
    }));
    render();
  }

  /* ══ Luz de retrato (motor próprio) ═════════════════════════════════ */

  /* A grelha e UMA comparacao controlada: o mesmo rosto, a mesma moldura,
     so muda a luz. Misturar aqui fotografias reais de outra pessoa, com
     outro enquadramento, partia exactamente isso — as ultimas quatro
     celulas deixavam de se poder comparar com as de cima. As fotografias
     nao se perdem: vao para uma tira propria no fim, com o seu titulo. */
  function lightArtHTML() {
    const fams = PhotoLightArt.FAMILIES;
    const grid = fams.map(f => `
      <div class="cc-block">
        <div class="cc-head"><span class="cc-t">${esc(f.name)}</span><span class="cc-hint">${esc(f.hint)}</span></div>
        <div class="cs-lgrid">
          ${PhotoLightArt.PATTERNS.filter(p => p.family === f.id).map(patternCellHTML).join('')}
        </div>
      </div>`).join('');
    return grid + realLightHTML();
  }

  /* As quatro luzes naturais, em fotografia — fora da grelha, porque sao
     outra pessoa e outro enquadramento e nao se comparam com o resto. */
  function realLightHTML() {
    const path = id => (_ctx && _ctx.assetPath && _ctx.assetPath(id)) || '';
    const cells = PhotoLightArt.PATTERNS
      .filter(p => p.photo && path(p.photo))
      .map(p => ({ src: path(p.photo), v: p.name, note: p.tell }));
    if (!cells.length || typeof PhotoCard === 'undefined') return '';
    return PhotoCard.block({
      kind: 'strip', t: 'As mesmas luzes naturais, fotografadas', ar: '7/9',
      hint: 'Aqui e outra pessoa e outra sessao: servem para reconhecer a luz no mundo, nao para comparar com a grelha acima.',
      cells,
    }, _ctx);
  }

  /* Cada célula é um par: à esquerda ONDE se põe a luz, à direita a
     SOMBRA que isso desenha. O texto que sobra (porquê, cuidados) fica
     fechado — a grelha tem de se poder ler de relance. */
  function patternCellHTML(p) {
    return `<figure class="cs-lcell${p.star ? ' star' : ''}">
      <figcaption class="cs-lcell-h">${esc(p.name)}${p.star ? '<span class="cs-star" title="Começa por este">★</span>' : ''}</figcaption>
      <div class="cs-lpair">
        <div class="cs-lart">${PhotoLightArt.setup(p)}</div>
        <div class="cs-lart">${PhotoLightArt.face(p)}</div>
      </div>
      <p class="cs-lrow"><b>Monta:</b> ${esc(p.how)}</p>
      <p class="cs-lrow"><b>Vê-se por:</b> ${esc(p.tell)}</p>
      <details class="cs-lmore"><summary>Para que serve e o que correr mal</summary>
        <p>${esc(p.why)}</p>
        <p>⚠️ ${esc(p.watch)}</p>
        <p class="cs-lkit">🎒 ${esc(p.kit)}</p>
      </details>
    </figure>`;
  }

  /* ══ Renderização de um cheatsheet ══════════════════════════════════ */

  // `coc: "auto"` num diagrama = círculo de confusão da câmara escolhida.
  const CLASS_COC = { phone: 0.006, apsc: 0.019, ff: 0.03, mft: 0.015 };
  function resolveOpts(b) {
    if (!b || !b.opts) return b;
    const o = b.opts;
    if (o.coc !== 'auto' && !o.img) return b;
    const next = Object.assign({}, o);
    if (o.coc === 'auto') {
      const id = _ctx && _ctx.gearClass ? _ctx.gearClass() : 'apsc';
      next.coc = CLASS_COC[id] || 0.019;
    }
    // `img` é um id de asset; se não existir, o diagrama usa o seu recurso.
    if (o.img) next.img = (_ctx && _ctx.assetPath && _ctx.assetPath(o.img)) || '';
    return Object.assign({}, b, { opts: next });
  }

  /* Blocos estreitos emparelham-se. Um cheatsheet inteiro numa coluna
     desperdiçava metade de um ecrã de 1400px em margem: uma lista de regras,
     uma nota ou um diagrama são objectos de ~300–600px de largura natural e
     ficavam a ocupar 1160. Emparelhar DOIS seguidos (nunca reordenar — a
     ordem é o discurso) encurta a página sem partir o fio condutor. As
     tiras, grelhas e comparações continuam à largura toda: é nelas que a
     imagem ensina. Um bloco pode forçar o contrário com `span`. */
  const NARROW = { rules: 1, steps: 1, table: 1, versus: 1, note: 1, diagram: 1 };
  function blocksHTML(list) {
    const out = [];
    let buf = [];
    const flush = () => {
      if (!buf.length) return;
      out.push(buf.length > 1 ? `<div class="cs-row">${buf.join('')}</div>` : buf[0]);
      buf = [];
    };
    (list || []).forEach(b => {
      const html = PhotoCard.block(resolveOpts(b), _ctx);
      if (!html) return;
      const narrow = b.span === 'narrow' || (NARROW[b.kind] && b.span !== 'wide');
      if (!narrow) { flush(); out.push(html); return; }
      buf.push(html);
      if (buf.length === 2) flush();
    });
    flush();
    return out.join('');
  }

  function goHTML(go) {
    if (!(go || []).length) return '';
    return `<div class="cs-go"><span class="cs-go-t">A seguir:</span>
      ${go.map(g => `<button class="ph-chip ph-chip-link" data-go="${esc(g.t)}">${esc(g.label)} →</button>`).join('')}</div>`;
  }

  function sheetHTML(s, extra) {
    return `<div class="cs-sheet">
      ${s.answer ? `<p class="cs-answer"><span class="cs-answer-ico">⚡</span><span>${inline(s.answer)}</span></p>` : ''}
      ${blocksHTML(s.blocks)}
      ${extra || ''}
      ${s.rule ? `<div class="cs-rule">⭐ ${inline(s.rule)}</div>` : ''}
      ${goHTML(s.go)}
    </div>`;
  }

  function headHTML(s, crumb) {
    return `
      <button class="ph-back cs-back" data-back>← Todos os cheatsheets</button>
      ${crumb ? `<p class="cs-crumb">${crumb}</p>` : ''}
      <div class="cs-head">
        <span class="cs-head-ico">${s.icon || '📋'}</span>
        <div>
          <h1 class="cs-head-t">${esc(s.name)}</h1>
          ${s.q ? `<p class="cs-head-sub">${esc(s.q)}</p>` : ''}
          ${s.alias ? `<p class="cs-head-sub">também conhecido por: <i>${esc(s.alias)}</i></p>` : ''}
        </div>
      </div>`;
  }

  /* ══ Cartão de bolso de um género ═══════════════════════════════════
     Derivado de genres.json: comprime o que o portal já diz, para servir
     de índice às fichas específicas (quando existem) e de resposta rápida
     quando não existem. Não há conteúdo novo aqui de propósito. */

  const PEOPLE = new Set(['retrato', 'familia', 'autorretrato', 'eventos', 'produto', 'gastronomia']);
  const MOTION = new Set(['desporto', 'familia', 'vida-selvagem', 'animais', 'eventos', 'rua',
    'praia', 'longa-exposicao', 'astro', 'automovel', 'noturna', 'chuva']);

  /* Um género é UMA página. Ter de clicar em "Retrato" e depois em "Luz
     natural" e depois voltar atrás é o contrário de consulta rápida: as
     fichas todas vêm empilhadas e a barra de saltos leva a qualquer uma
     sem sair da página. As rotas cs:g/<género>/<ficha> continuam a
     funcionar — passam a levar ao sítio certo desta página. */
  function genreSheetHTML(g, pack) {
    const ll = _ctx && _ctx.lensLine ? _ctx.lensLine(g) : null;
    const kv = (g.gear.settings || []).map(s =>
      `<div class="cs-kv"><span class="cs-kv-k">${esc(s.k)}</span><span class="cs-kv-v">${esc(s.v)}</span></div>`).join('');
    const sc = g.scene || {};
    const list = (pack && pack.sheets) || [];
    /* A fotografia do género entra aqui e não como decoração: ocupa a faixa
       que a frase de intenção deixava vazia e mostra, antes de qualquer
       palavra, com que se parece o resultado deste cheatsheet. */
    const hero = (_ctx && _ctx.assetPath && _ctx.assetPath('vis-' + g.id)) || '';
    const jump = list.length ? `
      <nav class="cs-jump" aria-label="Fichas de ${esc(g.name)}">
        <a class="cs-jump-b" href="#" data-jump="cs-g-top">📷 Essencial</a>
        ${list.map(s => `<a class="cs-jump-b" href="#" data-jump="cs-f-${esc(s.id)}">${s.icon} ${esc(s.name)}</a>`).join('')}
      </nav>` : '';
    const fichas = list.map(s => `
      <section class="cs-ficha" id="cs-f-${esc(s.id)}">
        <div class="cs-ficha-h">
          <span class="cs-ficha-ico">${s.icon || '📋'}</span>
          <div><h2 class="cs-ficha-t">${esc(s.name)}</h2>
            ${s.q ? `<p class="cs-ficha-q">${esc(s.q)}</p>` : ''}</div>
        </div>
        ${sheetHTML(s)}
      </section>`).join('');
    return `<div class="cs-sheet cs-genre">
      ${jump}
      <div class="cs-ghead" id="cs-g-top">
        ${hero ? `<img class="cs-ghero" loading="lazy" decoding="async" src="${esc(hero)}" alt="Exemplo de ${esc(g.name)}">` : ''}
        <div class="cs-ghead-txt">
          <p class="cs-answer cs-answer-flat"><span class="cs-answer-ico">⚡</span><span>${inline(g.goal || g.blurb)}</span></p>
          ${(g.tricks || []).length ? `<p class="cs-rule cs-rule-flat">🎩 ${esc(g.tricks[0])}</p>` : ''}
        </div>
      </div>
      <div class="cs-gcols">
        <div class="cs-gcol">
          <h3 class="cs-block-t">📷 Definições</h3>
          <div class="cs-kvgrid">${kv}</div>
          ${ll ? `<p class="cs-note">🔭 <b>${esc(ll.name)}</b> · ${esc(ll.eq)}${ll.concrete ? ` — ${esc(ll.concrete)}` : ''}</p>` : ''}
          ${g.gear.af ? `<p class="cs-note">🎯 ${esc(g.gear.af)}</p>` : ''}
        </div>
        <div class="cs-gcol">
          <h3 class="cs-block-t">👁️ Na cena</h3>
          <ul class="cs-list">${(sc.look || []).slice(0, 4).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          ${sc.position ? `<p class="cs-note">📍 ${esc(sc.position)}</p>` : ''}
        </div>
        <div class="cs-gcol">
          <h3 class="cs-block-t">🖼️ Compõe</h3>
          <ul class="cs-list">${(g.composition || []).slice(0, 4).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
        <div class="cs-gcol cs-gcol-warn">
          <h3 class="cs-block-t">⛔ Evita</h3>
          <ul class="cs-list">${(g.mistakes || []).slice(0, 4).map(m => `<li>${esc(m.err)}</li>`).join('')}</ul>
        </div>
      </div>
      ${fichas}
      <div class="cs-go">
        <span class="cs-go-t">A seguir:</span>
        <button class="ph-chip ph-chip-link" data-go="g:${esc(g.id)}">Portal completo de ${esc(g.name)} →</button>
        
        ${PEOPLE.has(g.id) ? '<button class="ph-chip ph-chip-link" data-go="cs:luz-retrato">Esquemas de luz 💡</button>' : ''}
        ${MOTION.has(g.id) ? '<button class="ph-chip ph-chip-link" data-go="cs:velocidade">Velocidade do obturador ⏱️</button>' : ''}
      </div>
    </div>`;
  }

  /* ══ Hub ════════════════════════════════════════════════════════════ */

  // A miniatura é o próprio visual do cheatsheet em pequeno: é o que diz,
  // antes de qualquer palavra, que estes cartões se consultam a olhar.
  function thumbHTML(t) {
    if (!t) return '';
    if (t.asset) {
      const src = _ctx && _ctx.assetPath ? _ctx.assetPath(t.asset) : null;
      if (src) {
        const ov = t.overlay ? `<span class="cc-ov">${PhotoCard.art(t.overlay.art, Object.assign({ over: 1 }, t.overlay.opts))}</span>` : '';
        return `<span class="cs-card-vis"><img loading="lazy" decoding="async" src="${esc(src)}" alt="">${ov}</span>`;
      }
    }
    if (t.art) return `<span class="cs-card-vis">${PhotoCard.art(t.art, t.opts)}</span>`;
    return '';
  }

  function cardHTML(c, kind) {
    const vis = thumbHTML(c.thumb);
    return `<button class="cs-card" data-open="${kind}:${esc(c.id)}" data-search="${esc(norm([c.name, c.blurb, c.q, c.alias, c.tags].join(' ')))}">
      ${vis}
      <span class="cs-card-body">
        ${vis ? '' : `<span class="cs-card-ico">${c.icon || '📋'}</span>`}
        <span class="cs-card-txt">
          <span class="cs-card-name">${esc(c.name)}</span>
          <span class="cs-card-blurb">${esc(c.blurb || '')}</span>
        </span>
        ${c.badge ? `<span class="cs-card-badge">${esc(c.badge)}</span>` : ''}
      </span>
    </button>`;
  }

  function hubHTML(data, gen, genres) {
    const groups = data.groups || [];
    const packs = gen.genres || {};
    // Géneros com fichas próprias primeiro: é a diferença que interessa ver.
    const withSheets = genres.filter(g => packs[g.id]);
    const rest = genres.filter(g => !packs[g.id]);

    return `
      <div class="cs-intro">
        <p class="cs-intro-lead">Cartões de <b>consulta rápida</b>: uma imagem, um valor e uma linha. Feitos para se abrirem com a câmara na mão e se perceberem num relance — não para se lerem.</p>
        <p class="cs-intro-map"><b>📋 Aqui:</b> “preciso desta resposta agora”<span>·</span><b>📚 Aprender:</b> “quero perceber isto a fundo”<span>·</span><b>🧮 Ferramentas:</b> “quero calcular isto”</p>
      </div>

      <div class="cs-search">
        <input type="search" id="cs-q" placeholder="Procurar (abertura, shutter speed, ISO, retrato…)" aria-label="Procurar cheatsheet" autocomplete="off">
      </div>
      <p class="cs-empty" id="cs-none" hidden>Nenhum cheatsheet corresponde à procura.</p>

      ${groups.map(gr => {
        const cards = data.sheets.filter(s => s.level === gr.id).map(s => cardHTML({
          id: s.id, icon: s.icon, name: s.name, blurb: s.q || s.blurb, q: s.blurb,
          alias: s.alias, thumb: s.thumb, badge: s.special ? 'interativo' : '',
        }, 'cs'));
        return `<div class="cs-group" data-group>
          <h2 class="cs-group-t">${gr.name}<small>${esc(gr.hint)}</small></h2>
          <div class="cs-grid">${cards.join('')}</div>
        </div>`;
      }).join('')}

      <div class="cs-group" data-group>
        <h2 class="cs-group-t">📸 Por género<small>O mesmo conceito, aplicado — com os valores que mudam nesta prática.</small></h2>
        <div class="cs-grid">
          ${withSheets.map(g => cardHTML({
            id: g.id, icon: g.icon, name: g.name,
            blurb: `${packs[g.id].sheets.length} fichas visuais · ${g.blurb}`,
            tags: packs[g.id].sheets.map(s => s.name).join(' '),
            thumb: { asset: 'gico-' + g.id }, badge: packs[g.id].sheets.length + ' fichas',
          }, 'gen')).join('')}
        </div>
      </div>

      <div class="cs-group" data-group>
        <h2 class="cs-group-t">🗂️ Cartão de bolso dos restantes géneros<small>Resumo de uma página, derivado do portal de cada género.</small></h2>
        <div class="cs-grid cs-grid-sm">
          ${rest.map(g => cardHTML({
            id: g.id, icon: g.icon, name: g.name, blurb: g.blurb, thumb: { asset: 'gico-' + g.id },
          }, 'gen')).join('')}
        </div>
      </div>`;
  }

  function wireSearch(panel) {
    const input = panel.querySelector('#cs-q');
    const none = panel.querySelector('#cs-none');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = norm(input.value.trim());
      let shown = 0;
      panel.querySelectorAll('[data-group]').forEach(grp => {
        let vis = 0;
        grp.querySelectorAll('.cs-card').forEach(c => {
          const hit = !q || (c.dataset.search || '').includes(q);
          c.hidden = !hit;
          if (hit) vis++;
        });
        grp.hidden = vis === 0;
        shown += vis;
      });
      if (none) none.hidden = shown > 0;
    });
  }

  /* Salto dentro da página do género. `scrollIntoView` puro encosta o
     título ao topo e a barra de tabs (sticky) tapa-o — daí o offset. */
  function jumpTo(root, id) {
    const el = root.querySelector('#' + CSS.escape(id));
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.add('cs-flash');
    setTimeout(() => el.classList.remove('cs-flash'), 1400);
  }

  /* ══ Build ══════════════════════════════════════════════════════════
     `arg` = null (hub) | "<id>" | "g/<genero>" | "g/<genero>/<ficha>" */
  function build(panel, arg, ctx) {
    _ctx = ctx || _ctx;
    restore();
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadAll(), _ctx.loadDB(), _ctx.loadAssets()]).then(([all, db]) => {
      if (!all || !db) {
        panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">Não foi possível carregar os cheatsheets. <button class="ph-chip ph-chip-link" data-retry>Tentar novamente</button></p></div>`;
        panel.querySelector('[data-retry]')?.addEventListener('click', () => build(panel, arg, ctx));
        return;
      }
      const { data, gen } = all;
      const genres = db.genres;
      let html, after = null;

      if (arg && arg.startsWith('g/')) {
        const [gid, sid] = arg.slice(2).split('/');
        const g = genres.find(x => x.id === gid);
        const pack = gen.genres[gid];
        if (g) {
          const nf = pack && pack.sheets ? pack.sheets.length : 0;
          html = headHTML({
            icon: g.icon, name: g.name,
            q: nf ? `${nf} fichas visuais numa página — usa a barra de saltos` : 'Cartão de bolso do género',
          }) + genreSheetHTML(g, pack);
          // Um link direto para uma ficha leva à página do género e salta
          // para lá: mantém-se o contexto todo e não se perde um clique.
          if (sid) after = box => jumpTo(box, 'cs-f-' + sid);
        } else {
          html = hubHTML(data, gen, genres);
        }
      } else if (arg) {
        const s = data.sheets.find(x => x.id === arg);
        if (!s) html = hubHTML(data, gen, genres);
        else if (s.special === 'shutter') {
          html = headHTML(s) + sheetHTML(s, shutterCalcHTML()
            + `<div class="cc-block"><div class="cc-head"><span class="cc-t">Tabela de bolso — mínimo para congelar</span>
                 <span class="cc-hint">Só o movimento do sujeito; o teu tremido entra na calculadora acima.</span></div></div>`
            + shutterTableHTML());
          after = box => {
            wireShutter(box);
            _ctx.wireContextBar && _ctx.wireContextBar(box, () => build(panel, arg, ctx));
          };
        } else if (s.special === 'lightart') {
          html = headHTML(s) + sheetHTML(s, lightArtHTML());
        } else {
          html = headHTML(s) + sheetHTML(s);
        }
      } else {
        html = hubHTML(data, gen, genres);
      }

      panel.innerHTML = `<div class="cs-wrap">${html}</div>`;
      /* A barra de saltos cola-se por baixo das tabs da Fotografia, que
         são elas próprias sticky e mudam de altura (embrulham em ecrãs
         estreitos). A altura medida vira variável CSS. */
      const nav = document.querySelector('#view-photography .ph-nav');
      if (nav) panel.style.setProperty('--cs-navh', nav.offsetHeight + 'px');
      if (after) after(panel);

      /* data-open = "cs:<id>" | "gen:<genero>" | "gs:<genero>:<ficha>" */
      panel.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
        const p = String(b.dataset.open).split(':');
        if (p[0] === 'gen') _ctx.go('cs:g/' + p[1]);
        else if (p[0] === 'gs') _ctx.go('cs:g/' + p[1] + '/' + p[2]);
        else _ctx.go('cs:' + p[1]);
      }));
      panel.querySelector('[data-back]')?.addEventListener('click', () => _ctx.go('cs:'));
      panel.querySelectorAll('[data-jump]').forEach(a => a.addEventListener('click', e => {
        e.preventDefault(); jumpTo(panel, a.dataset.jump);
      }));
      panel.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => _ctx.go(b.dataset.go)));
      wireSearch(panel);
      if (typeof PhotoCard !== 'undefined') PhotoCard.wire(panel);
      if (typeof PhotoIllus !== 'undefined') PhotoIllus.wire(panel);
      // Os comparadores (lado a lado · cortina · alternar) ficam inertes
      // até serem ligados — uma chamada por render chega para todos.
      if (typeof PhotoLearn !== 'undefined') PhotoLearn.wire(panel, t => _ctx.go(t));
      // Só ao ABRIR um cartão: no hub, subir a página rouba a posição a
      // quem acabou de voltar de um cartão a meio da lista.
      if (arg) panel.querySelector('.cs-wrap')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  return { build, SUBJECTS };
})();
