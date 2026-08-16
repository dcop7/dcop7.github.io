/* ══════════════════════════════════════════════════════════════════════
   PhotoCheats — a secção "Cheatsheets" da Fotografia.

   Um cheatsheet aqui é um cartão de CONSULTA RÁPIDA, para ler de relance
   com a câmara na mão. A lição correspondente vive em Aprender e as
   contas em Ferramentas; este módulo nunca as repete, aponta-lhes.

   Quatro famílias:
     • básicos      — cinco cartões, o essencial (data/photo/cheats.json)
     • avançados    — ISO, abertura, WB, medição, flash (mesmo ficheiro)
     • específicos  — os dois que precisam de motor próprio:
                        luz-retrato → PhotoLightArt (20 esquemas)
                        velocidade  → calculadora de obturador
     • por género   — 28 cartões derivados de genres.json, sem conteúdo
                      novo: é a mesma verdade, comprimida numa grelha

   Recebe um `ctx` da photography.js (assetPath, gearClass, go, barra de
   contexto…) para não duplicar estado nem conhecer rotas.
   ════════════════════════════════════════════════════════════════════ */
const PhotoCheats = (function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const li = x => `<li>${x}</li>`;

  let _ctx = null;
  let _data = null, _dataP = null;

  function loadCheats() {
    if (_data) return Promise.resolve(_data);
    if (_dataP) return _dataP;
    _dataP = fetch('data/photo/cheats.json')
      .then(r => { if (!r.ok) throw new Error('cheats'); return r.json(); })
      .then(j => (_data = j.sheets))
      .catch(() => { _dataP = null; return null; });
    return _dataP;
  }

  /* ══ Velocidade de obturador ════════════════════════════════════════
     A pergunta "que velocidade uso?" tem SEMPRE duas respostas e quem
     começa só conhece uma:

       1. o tremido das MINHAS mãos  → regra do inverso da focal
       2. o movimento do SUJEITO     → tabela, e nada a ver com a lente

     Vale a mais rápida das duas. A regra do "dobro da focal" que corre
     por aí é só a primeira com margem de segurança — e é por isso que
     falha redondamente com uma criança a saltar: uma criança move-se ao
     mesmo ritmo quer estejas aos 22mm quer aos 200mm. */

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
    { g: 'Desporto', id: 'carro',    ico: '🚗', name: 'Carro a passar',            min: 1 / 1000, blur: 1 / 30, note: 'Congelado um carro parece estacionado. O panning é quase sempre melhor.' },
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
    { id: '1', name: '1× (regra clássica)', mul: 1, hint: 'O que dava jeito no tempo do filme' },
    { id: '2', name: '2× (recomendado)',    mul: 2, hint: 'Sensores de hoje mostram tremido que o filme escondia' },
    { id: '4', name: '4× (paranóico)',      mul: 4, hint: 'Alta resolução, para ampliar ou ver a 100%' },
  ];

  const st = {
    subject: 'salto', focal: 22, stab: 'lens', margin: '2',
  };
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
    // 2) sujeito
    const subject = subj.min;
    // 3) astro tem regra própria (500 ÷ focal equivalente)
    const astro = subj.astro ? 500 / eq : null;

    let need, driver;
    if (astro != null) { need = astro; driver = 'astro'; }
    else if (subject == null) { need = subj.blur; driver = 'blur'; }
    else if (subject <= shake) { need = subject; driver = 'subject'; }
    else { need = shake; driver = 'shake'; }

    return {
      subj, eq, crop: c, stab, mul,
      shake: snapFaster(shake), shakeRaw: shake,
      baseShake: snapFaster(baseShake),
      subject: subject == null ? null : snapFaster(subject),
      astro, blur: subj.blur || null,
      need: snapFaster(need), driver,
    };
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
      ${r.blur ? `<p class="cs-note cs-note-alt">🌀 A brincar ao contrário: <b>${fmtShutter(r.blur)}</b> para mostrar o movimento em vez de o congelar.</p>` : ''}
      <p class="cs-shot-ctx">A contar com <b>${esc((cls && cls.name) || 'APS-C')}</b> (crop ${r.crop}×): ${st.focal}mm reais = <b>${r.eq.toFixed(0)}mm equivalentes</b>.
        ${r.driver === 'subject' ? 'Repara: mudar de lente não muda esta resposta.' : ''}</p>
      <p class="cs-shot-next">Não tens luz para esta velocidade? Abre a abertura primeiro, sobe o ISO depois — por esta ordem. Nunca desças a velocidade abaixo do valor acima: ruído corrige-se, tremido não.</p>`;
  }

  function shutterSheetHTML() {
    const groups = [...new Set(SUBJECTS.map(s => s.g))];
    return `
      <div class="cs-sheet">
        <p class="cs-lead">Há sempre <b>duas</b> respostas para "que velocidade uso?" — o teu tremido e o movimento do sujeito — e vale a mais rápida das duas. A regra do inverso da focal só responde à primeira.</p>
        ${_ctx.contextBarHTML ? _ctx.contextBarHTML() : ''}

        <div class="cs-block cs-shot">
          <div class="cs-shot-controls">
            <label class="cs-field">
              <span class="cs-lbl">O que estás a fotografar</span>
              <select class="ph-select" id="cs-subj">
                ${groups.map(g => `<optgroup label="${esc(g)}">${SUBJECTS.filter(s => s.g === g)
                  .map(s => `<option value="${s.id}"${s.id === st.subject ? ' selected' : ''}>${s.ico} ${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}
              </select>
            </label>
            <label class="cs-field cs-field-sm">
              <span class="cs-lbl">Focal da lente <small>(mm reais)</small></span>
              <input type="number" class="ph-input" id="cs-focal" min="4" max="1200" step="1" value="${st.focal}">
            </label>
            <label class="cs-field cs-field-sm">
              <span class="cs-lbl">Estabilização</span>
              <select class="ph-select" id="cs-stab">
                ${STAB.map(s => `<option value="${s.id}"${s.id === st.stab ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
              </select>
            </label>
            <label class="cs-field cs-field-sm">
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
        </div>

        <div class="cs-block">
          <h3 class="cs-block-t">A regra do inverso da focal — e onde ela mente</h3>
          <ul class="cs-list">
            <li><b>A regra:</b> não desças abaixo de 1/focal <i>equivalente</i>. Aos 22mm em APS-C isso são 35mm eq → 1/35, portanto 1/40 no seletor.</li>
            <li><b>Porquê o "dobro" que leste algures:</b> a regra vem do tempo do filme, em que ninguém via a imagem a 100%. Os sensores de hoje mostram tremido que o filme escondia — daí ×2 (ou ×4 se ampliares muito). É margem, não é lei.</li>
            <li><b>A estabilização entra aqui e só aqui:</b> ganha 2 a 5 stops <i>ao teu tremido</i>. Não trava nada do que está à tua frente.</li>
            <li><b>Onde a regra mente:</b> ela não sabe nada do sujeito. Uma criança a saltar move-se ao mesmo ritmo aos 22mm e aos 200mm — 1/44 dá-te uma criança desfocada com uma paisagem nítida por trás.</li>
          </ul>
        </div>

        <div class="cs-block">
          <h3 class="cs-block-t">Tabela de bolso — mínimo para congelar</h3>
          <div class="cs-tablewrap">
            <table class="cs-table">
              <thead><tr><th>Sujeito</th><th>Congelar</th><th>Arrastar de propósito</th></tr></thead>
              <tbody>
                ${SUBJECTS.map(s => `<tr>
                  <td>${s.ico} ${esc(s.name)}</td>
                  <td><b>${s.min ? fmtShutter(s.min) : (s.astro ? '500 ÷ focal eq' : '—')}</b></td>
                  <td>${s.blur ? fmtShutter(s.blur) : '<span class="cs-dim">—</span>'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="cs-rule">⚡ Se tiveres de escolher entre ruído e tremido, escolhe sempre ruído. O ruído edita-se; o tremido não.</div>
      </div>`;
  }

  function wireShutter(box) {
    const out = box.querySelector('#cs-shot-result');
    if (!out) return;
    const render = () => { out.innerHTML = shutterResultHTML(); };
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

  /* ══ Luz de retrato ═════════════════════════════════════════════════ */

  function lightSheetHTML() {
    const fams = PhotoLightArt.FAMILIES;
    return `
      <div class="cs-sheet">
        <p class="cs-lead">Vinte esquemas de luz para retrato. Em cada um: a <b>planta</b> (onde pôr a luz) e o <b>resultado</b> (a sombra que isso desenha na cara). O nome do padrão é sempre o nome da sombra — se souberes ler a sombra, sabes montar o esquema.</p>
        <p class="cs-lead cs-lead-sm">Os quatro últimos são luz natural, sem equipamento nenhum — e esses trazem fotografia real.</p>
        ${fams.map(f => `
          <div class="cs-block">
            <h3 class="cs-block-t">${esc(f.name)} <small>${esc(f.hint)}</small></h3>
            <div class="cs-lgrid">
              ${PhotoLightArt.PATTERNS.filter(p => p.family === f.id).map(patternCellHTML).join('')}
            </div>
          </div>`).join('')}
        <div class="cs-rule">💡 Uma luz e um refletor fazem 80% do que está nesta página. O que muda o retrato é a posição, não o número de flashes.</div>
      </div>`;
  }

  function patternCellHTML(p) {
    const photo = p.photo && _ctx && _ctx.assetPath ? _ctx.assetPath(p.photo) : null;
    return `<figure class="cs-lcell${p.star ? ' star' : ''}">
      <figcaption class="cs-lcell-h">${esc(p.name)}${p.star ? '<span class="cs-star" title="Começa por este">★</span>' : ''}</figcaption>
      <div class="cs-lpair">
        <div class="cs-lart">${PhotoLightArt.setup(p)}</div>
        <div class="cs-lart">${photo
          ? `<img class="plt-photo" loading="lazy" decoding="async" src="${photo}" alt="Exemplo fotográfico: ${esc(p.name)}">`
          : PhotoLightArt.face(p)}</div>
      </div>
      <div class="cs-lbody">
        <p class="cs-lkit">🎒 ${esc(p.kit)}</p>
        <p class="cs-lrow"><b>Monta:</b> ${esc(p.how)}</p>
        <p class="cs-lrow"><b>Reconhece-se por:</b> ${esc(p.tell)}</p>
        <p class="cs-lrow"><b>Serve para:</b> ${esc(p.why)}</p>
        <p class="cs-lrow cs-lwatch"><b>⚠️</b> ${esc(p.watch)}</p>
      </div>
    </figure>`;
  }

  /* ══ Cartões genéricos (JSON) ═══════════════════════════════════════ */

  function sheetHTML(s) {
    const art = s.art && typeof PhotoIllus !== 'undefined' && PhotoIllus.has(s.art)
      ? `<div class="cs-art">${PhotoIllus.svg(s.art)}</div>` : '';
    const table = s.table ? `
      <div class="cs-tablewrap">
        <table class="cs-table">
          <thead><tr>${s.table.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${s.table.rows.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="cs-td-k"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>` : '';
    const blocks = (s.blocks || []).map(b => `
      <div class="cs-block">
        <h3 class="cs-block-t">${esc(b.t)}</h3>
        <ul class="cs-list">${b.items.map(x => li(esc(x))).join('')}</ul>
      </div>`).join('');
    const go = (s.go || []).length
      ? `<div class="cs-go">${s.go.map(g => `<button class="ph-chip ph-chip-link" data-go="${esc(g.t)}">${esc(g.label)} →</button>`).join('')}</div>` : '';
    return `<div class="cs-sheet">
      ${s.lead ? `<p class="cs-lead">${esc(s.lead)}</p>` : ''}
      ${art}${table}${blocks}
      ${s.rule ? `<div class="cs-rule">⭐ ${esc(s.rule)}</div>` : ''}
      ${go}
    </div>`;
  }

  /* ══ Cartões por género ═════════════════════════════════════════════
     Derivados de genres.json: comprimem o que o portal já diz. Não há
     conteúdo novo aqui de propósito — o cartão é o atalho, o portal do
     género continua a ser a fonte. */

  /* Onde é que os dois cartões específicos são mesmo úteis — para eles
     aparecerem no fim do cartão do género em vez de só no hub. */
  const PEOPLE = new Set(['retrato', 'familia', 'autorretrato', 'eventos', 'produto', 'gastronomia']);
  const MOTION = new Set(['desporto', 'familia', 'vida-selvagem', 'animais', 'eventos', 'rua',
    'praia', 'longa-exposicao', 'astro', 'automovel', 'noturna', 'chuva']);

  function genreSheetHTML(g) {
    const ll = _ctx && _ctx.lensLine ? _ctx.lensLine(g) : null;
    const kv = (g.gear.settings || []).map(s =>
      `<div class="cs-kv"><span class="cs-kv-k">${esc(s.k)}</span><span class="cs-kv-v">${esc(s.v)}</span></div>`).join('');
    const s = g.scene || {};
    return `<div class="cs-sheet cs-genre">
      <p class="cs-lead">${esc(g.goal || g.blurb)}</p>
      <div class="cs-gcols">
        <div class="cs-gcol">
          <h3 class="cs-block-t">📷 Definições</h3>
          <div class="cs-kvgrid">${kv}</div>
          ${ll ? `<p class="cs-note">🔭 <b>${esc(ll.name)}</b> · ${esc(ll.eq)}${ll.concrete ? ` — ${esc(ll.concrete)}` : ''}</p>` : ''}
          ${g.gear.af ? `<p class="cs-note">🎯 ${esc(g.gear.af)}</p>` : ''}
        </div>
        <div class="cs-gcol">
          <h3 class="cs-block-t">👁️ Na cena</h3>
          <ul class="cs-list">${(s.look || []).slice(0, 4).map(x => li(esc(x))).join('')}</ul>
          ${s.position ? `<p class="cs-note">📍 ${esc(s.position)}</p>` : ''}
        </div>
        <div class="cs-gcol">
          <h3 class="cs-block-t">🖼️ Compõe</h3>
          <ul class="cs-list">${(g.composition || []).slice(0, 4).map(x => li(esc(x))).join('')}</ul>
        </div>
        <div class="cs-gcol cs-gcol-warn">
          <h3 class="cs-block-t">⛔ Evita</h3>
          <ul class="cs-list">${(g.mistakes || []).slice(0, 4).map(m => li(esc(m.err))).join('')}</ul>
        </div>
      </div>
      ${(g.tricks || []).length ? `<div class="cs-rule">🎩 ${esc(g.tricks[0])}</div>` : ''}
      <div class="cs-go">
        <button class="ph-chip ph-chip-link" data-go="g:${esc(g.id)}">Portal completo de ${esc(g.name)} →</button>
        <button class="ph-chip ph-chip-link" data-go="agora:${esc(g.id)}">Levar para o terreno ⚡</button>
        ${PEOPLE.has(g.id) ? '<button class="ph-chip ph-chip-link" data-go="cs:luz-retrato">Esquemas de luz 💡</button>' : ''}
        ${MOTION.has(g.id) ? '<button class="ph-chip ph-chip-link" data-go="cs:velocidade">Que velocidade usar ⏱️</button>' : ''}
      </div>
    </div>`;
  }

  /* ══ Hub + navegação ════════════════════════════════════════════════ */

  const SPECIALS = [
    { id: 'luz-retrato', icon: '💡', name: 'Luz de retrato', level: 'especifico',
      blurb: '20 esquemas de luz, com planta e resultado.' },
    { id: 'velocidade', icon: '⏱️', name: 'Que velocidade usar', level: 'especifico',
      blurb: 'Calculadora: o teu tremido vs o movimento do sujeito.' },
  ];

  const GROUPS = [
    { id: 'especifico', name: '🎯 Específicos', hint: 'Os dois que resolvem uma dúvida concreta, com motor próprio.' },
    { id: 'basico',     name: '🌱 Básicos',     hint: 'O essencial. Se só leres cinco, lê estes.' },
    { id: 'avancado',   name: '🔬 Avançados',   hint: 'Quando já sabes o essencial e queres o detalhe.' },
    { id: 'genero',     name: '📸 Por género',  hint: 'Um cartão de bolso para cada um dos 28 géneros.' },
  ];

  function cardHTML(c, kind) {
    return `<button class="cs-card" data-open="${kind}:${esc(c.id)}">
      <span class="cs-card-ico">${c.icon}</span>
      <span class="cs-card-txt">
        <span class="cs-card-name">${esc(c.name)}</span>
        <span class="cs-card-blurb">${esc(c.blurb || '')}</span>
      </span>
      <span class="cs-card-caret" aria-hidden="true">›</span>
    </button>`;
  }

  function hubHTML(sheets, genres) {
    return `
      <p class="ph-section-sub">Cartões de consulta rápida — para ver de relance com a câmara na mão. Cada um aponta para a lição completa em <b>Aprender</b> e para as contas em <b>Ferramentas</b>.</p>
      ${GROUPS.map(gr => {
        let cards;
        if (gr.id === 'especifico') cards = SPECIALS.map(c => cardHTML(c, 'cs'));
        else if (gr.id === 'genero') cards = genres.map(g => cardHTML({ id: g.id, icon: g.icon, name: g.name, blurb: g.blurb }, 'gen'));
        else cards = sheets.filter(s => s.level === gr.id).map(c => cardHTML(c, 'cs'));
        return `<div class="cs-group">
          <h2 class="cs-group-t">${gr.name}<small>${esc(gr.hint)}</small></h2>
          <div class="cs-grid${gr.id === 'genero' ? ' cs-grid-sm' : ''}">${cards.join('')}</div>
        </div>`;
      }).join('')}`;
  }

  function detailHTML(title, icon, body) {
    return `
      <button class="ph-back cs-back" data-back>← Todos os cheatsheets</button>
      <div class="cs-head"><span class="cs-head-ico">${icon}</span><h1 class="cs-head-t">${esc(title)}</h1></div>
      ${body}`;
  }

  /* `arg` = null (hub) | "<id>" (cartão) | "g/<id>" (género) */
  function build(panel, arg, ctx) {
    _ctx = ctx || _ctx;
    restore();
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadCheats(), _ctx.loadDB(), _ctx.loadAssets()]).then(([sheets, db]) => {
      if (!sheets || !db) {
        panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">Não foi possível carregar os cheatsheets. <button class="ph-chip ph-chip-link" data-retry>Tentar novamente</button></p></div>`;
        panel.querySelector('[data-retry]')?.addEventListener('click', () => build(panel, arg, ctx));
        return;
      }
      const genres = db.genres;
      let html, after = null;

      if (arg && arg.startsWith('g/')) {
        const g = genres.find(x => x.id === arg.slice(2));
        html = g ? detailHTML(g.name, g.icon, genreSheetHTML(g)) : hubHTML(sheets, genres);
      } else if (arg === 'luz-retrato') {
        html = detailHTML('Luz de retrato', '💡', lightSheetHTML());
      } else if (arg === 'velocidade') {
        html = detailHTML('Que velocidade usar', '⏱️', shutterSheetHTML());
        // A conta depende do crop da câmara escolhida: a barra de contexto
        // tem de estar aqui e tem de re-renderizar tudo ao mudar.
        after = box => {
          wireShutter(box);
          _ctx.wireContextBar && _ctx.wireContextBar(box, () => build(panel, arg, ctx));
        };
      } else if (arg) {
        const s = sheets.find(x => x.id === arg);
        html = s ? detailHTML(s.name, s.icon, sheetHTML(s)) : hubHTML(sheets, genres);
      } else {
        html = hubHTML(sheets, genres);
      }

      panel.innerHTML = `<div class="cs-wrap">${html}</div>`;
      if (after) after(panel);

      panel.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
        const [kind, id] = b.dataset.open.split(':');
        _ctx.go(kind === 'gen' ? 'cs:g/' + id : 'cs:' + id);
      }));
      panel.querySelector('[data-back]')?.addEventListener('click', () => _ctx.go('cs:'));
      panel.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => _ctx.go(b.dataset.go)));
      if (typeof PhotoIllus !== 'undefined') PhotoIllus.wire(panel);
      // Só ao ABRIR um cartão: no hub, subir a página rouba a posição a
      // quem acabou de voltar de um cartão a meio da lista.
      if (arg) panel.querySelector('.cs-wrap')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  return { build, SUBJECTS };
})();
