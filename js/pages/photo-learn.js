/* ══════════════════════════════════════════════════════════════════════
   PhotoLearn — componentes de aprendizagem VISUAL da secção Fotografia.

   Porque existe
   ─────────────
   O portal ensinava sobretudo a ler. Cada conceito novo trazia mais um
   parágrafo, e o utilizador acabava a percorrer texto em vez de a olhar
   para fotografias. Estes componentes invertem isso: a lição acontece na
   imagem, e o texto passa a ser a confirmação do que já se viu.

   Todos partilham o mesmo contrato:
     1. devolvem HTML (string) — encaixam em qualquer innerHTML existente;
     2. marcam-se com data-pl="<tipo>" e ficam inertes até alguém chamar
        PhotoLearn.wire(scope). Uma só chamada liga tudo o que está dentro,
        o que importa porque as secções do portal re-renderizam inteiras.
     3. sobrevivem à ausência de imagens (o site é estático e os assets são
        opcionais): sem `src` mostram o lugar vazio, nunca partem.

   Componentes
   ───────────
     compare(o)   comparação A/B em três modos (lado a lado, cortina, alternar)
     hotspots(o)  fotografia anotada — os pontos revelam-se ao toque
     pick(o)      "qual é a mais forte?" — escolher antes de saber a resposta
     look(o)      laboratório de estilo ao vivo (PhotoLab) com dose e base
     crop(o)      escolher o corte de uma fotografia e ver o veredicto
     reveal(o)    linha que esconde a resposta até ser tocada
     lesson(o)    o esqueleto de uma lição curta (ideia → ver → levar → treinar)
     chips(o)     ligações cruzadas entre géneros, estilos e técnicas

   Depende de PhotoLab só no look(); tudo o resto é autónomo.
   ════════════════════════════════════════════════════════════════════ */
const PhotoLearn = (function () {
  'use strict';

  let _uid = 0;
  const uid = p => `${p}-${(++_uid).toString(36)}`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  /* ══ COMPARAÇÃO A/B ═══════════════════════════════════════════════════
     A cortina arrastável era o único modo disponível e estava a ser usada
     para tudo. Só que uma cortina só ensina quando os dois lados estão
     ALINHADOS — antes/depois de edição, mesma moldura, mesmos píxeis. Nos
     pares em que muda a própria fotografia (intenção × banalidade,
     composição certa × errada) a cortina mostra metade de cada imagem e
     nunca a decisão inteira: exactamente a parte que interessa fica tapada.
     Por isso o modo passa a ser escolha, com omissão por contexto:

       side  (lado a lado) — cenas diferentes. Vê-se a decisão inteira.
       wipe  (cortina)     — pares alinhados. A diferença aparece no sítio.
       flip  (alternar)    — quase alinhados. A troca no mesmo sítio do ecrã
                             é o que torna visível uma diferença subtil.

     A preferência fica guardada por família (`fam`), não globalmente: quem
     gosta de cortina na edição continua a preferir lado a lado na visão. */
  const CMP_MODES = {
    side: { icon: '▥', label: 'Lado a lado' },
    wipe: { icon: '⇔', label: 'Cortina' },
    flip: { icon: '⇄', label: 'Alternar' },
  };

  function cmpMode(o) {
    const allowed = o.modes || ['side', 'wipe', 'flip'];
    const saved = o.fam ? store.get('ph-cmp-' + o.fam, null) : null;
    if (saved && allowed.includes(saved)) return saved;
    return allowed.includes(o.mode) ? o.mode : allowed[0];
  }

  function frameHTML(src, alt, tag, cls, extra) {
    return `<div class="pl-frame ${cls || ''}">
      ${src ? `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async" draggable="false">`
            : '<span class="pl-frame-empty" aria-hidden="true"></span>'}
      ${extra || ''}
      ${tag ? `<span class="pl-tag ${cls || ''}">${tag}</span>` : ''}
    </div>`;
  }

  /* `neutral` existe porque nem toda a comparação tem um lado melhor.
     Complementares × análogas, ou dois enquadramentos honestos do mesmo
     acontecimento, são escolhas — pintá-las de verde e vermelho ensinaria
     precisamente o contrário do que a lição diz. */
  function cmpStageHTML(o, mode) {
    const aTag = o.aTag || '✓ Melhor', bTag = o.bTag || '✗ Mais fraca';
    const kA = o.neutral ? 'info' : 'ok', kB = o.neutral ? 'info' : 'bad';
    if (mode === 'side') {
      return `<div class="pl-cmp-side">
        ${frameHTML(o.a, o.aAlt, aTag, kA, o.extraA)}
        ${frameHTML(o.b, o.bAlt, bTag, kB, o.extraB)}
      </div>`;
    }
    if (mode === 'flip') {
      return `<div class="pl-cmp-flip">
        ${frameHTML(o.b, o.bAlt, '', kB + ' pl-flip-b', o.extraB)}
        <div class="pl-flip-a">${frameHTML(o.a, o.aAlt, '', kA, o.extraA)}</div>
        <span class="pl-tag ${kA} pl-flip-tag" data-flip-tag>${aTag}</span>
        <button type="button" class="pl-flip-btn" data-flip title="Manter premido para ver a outra" aria-label="Manter premido para ver a outra">✋ ver a outra</button>
      </div>`;
    }
    const pct = o.pct == null ? 52 : o.pct;
    return `<div class="pl-cmp-wipe">
      <div class="pl-frame" data-wipe>
        ${o.b ? `<img class="pl-wipe-b" src="${esc(o.b)}" alt="${esc(o.bAlt || '')}" draggable="false">` : '<span class="pl-frame-empty"></span>'}
        <div class="pl-wipe-a" style="clip-path:inset(0 ${100 - pct}% 0 0)">
          ${o.a ? `<img src="${esc(o.a)}" alt="${esc(o.aAlt || '')}" draggable="false">` : ''}
        </div>
        ${o.extraA || ''}
        <span class="pl-tag ${kA}">${aTag}</span>
        <span class="pl-tag ${kB}">${bTag}</span>
        <div class="pl-wipe-handle" style="left:${pct}%"><span>⇔</span></div>
      </div>
      <input class="pl-wipe-range" type="range" min="0" max="100" value="${pct}"
             aria-label="${esc(o.label || 'Comparar as duas versões')}">
    </div>`;
  }

  function compare(o) {
    const allowed = o.modes || ['side', 'wipe', 'flip'];
    const mode = cmpMode(o);
    const mk = o.neutral ? ['◆', '◆'] : ['✓', '✗'];
    const wk = o.neutral ? ['info', 'info'] : ['ok', 'bad'];
    const why = (o.aWhy || o.bWhy) ? `<div class="pl-cmp-why">
      <span class="pl-why ${wk[0]}"><b>${mk[0]}</b> ${o.aWhy || ''}</span>
      <span class="pl-why ${wk[1]}"><b>${mk[1]}</b> ${o.bWhy || ''}</span>
    </div>` : '';
    const sw = allowed.length > 1 ? `<div class="pl-modes" role="group" aria-label="Modo de comparação">
      ${allowed.map(m => `<button type="button" class="pl-mode${m === mode ? ' active' : ''}" data-mode="${m}"
        title="${CMP_MODES[m].label}" aria-pressed="${m === mode}"><span aria-hidden="true">${CMP_MODES[m].icon}</span> ${CMP_MODES[m].label}</button>`).join('')}
    </div>` : '';
    /* `ar` — pares em retrato (rostos, corpo inteiro) ficavam decapitados
       dentro de uma moldura fixa 3:2. O rácio vive numa variável CSS na
       figura, por isso sobrevive à troca de modo (lado a lado / cortina /
       alternar), que volta a desenhar só o palco. */
    /* Um rácio próprio é sempre mais alto do que o 3:2 de origem, e à
       largura total da coluna isso dá uma moldura de 700px que empurra o
       texto todo para fora do ecrã. `--pl-w` estreita a figura para que a
       ALTURA fique em meia dobra; `o.w` permite afinar caso a caso. */
    const arStyle = o.ar ? ` style="--pl-ar:${esc(o.ar)};--pl-w:${esc(o.w || '520px')}"` : '';
    return `<figure class="pl-cmp" data-pl="compare"${arStyle} data-fam="${esc(o.fam || '')}"
              data-opts="${esc(JSON.stringify({
                a: o.a || '', b: o.b || '', aAlt: o.aAlt || '', bAlt: o.bAlt || '',
                aTag: o.aTag || '', bTag: o.bTag || '', label: o.label || '',
                modes: allowed, extraA: o.extraA || '', extraB: o.extraB || '',
                neutral: !!o.neutral,
              }))}">
      ${o.q ? `<figcaption class="pl-ask">${o.q}</figcaption>` : ''}
      ${sw}
      <div class="pl-cmp-stage" data-stage>${cmpStageHTML(o, mode)}</div>
      ${why}
      ${o.caption ? `<figcaption class="pl-cap">${o.caption}</figcaption>` : ''}
    </figure>`;
  }

  function wireCompare(fig) {
    let o; try { o = JSON.parse(fig.dataset.opts); } catch (_) { return; }
    const fam = fig.dataset.fam;
    const stage = fig.querySelector('[data-stage]');
    let pct = 52;

    const wireStage = () => {
      // cortina: arrastar no próprio enquadramento + range (teclado/leitores)
      const frame = stage.querySelector('[data-wipe]');
      if (frame) {
        const range = stage.querySelector('.pl-wipe-range');
        const apply = p => {
          pct = Math.max(0, Math.min(100, p));
          frame.querySelector('.pl-wipe-a').style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
          frame.querySelector('.pl-wipe-handle').style.left = pct + '%';
          if (range && +range.value !== Math.round(pct)) range.value = Math.round(pct);
        };
        const fromEvent = e => { const r = frame.getBoundingClientRect(); apply(((e.clientX - r.left) / r.width) * 100); };
        let drag = false;
        frame.addEventListener('pointerdown', e => { drag = true; frame.setPointerCapture(e.pointerId); fromEvent(e); e.preventDefault(); });
        frame.addEventListener('pointermove', e => { if (drag) fromEvent(e); });
        frame.addEventListener('pointerup', e => { drag = false; try { frame.releasePointerCapture(e.pointerId); } catch (_) {} });
        frame.addEventListener('pointercancel', () => { drag = false; });
        range?.addEventListener('input', () => apply(+range.value));
      }
      // alternar: premido mostra a versão fraca; largar volta à forte
      const flip = stage.querySelector('[data-flip]');
      if (flip) {
        const box = stage.querySelector('.pl-cmp-flip');
        const tag = stage.querySelector('[data-flip-tag]');
        const set = on => {
          box.classList.toggle('showing-b', on);
          if (!tag) return;
          tag.textContent = on ? (o.bTag || '✗ Mais fraca') : (o.aTag || '✓ Melhor');
          tag.classList.toggle('bad', on); tag.classList.toggle('ok', !on);
        };
        ['pointerdown', 'touchstart'].forEach(ev => flip.addEventListener(ev, e => { e.preventDefault(); set(true); }));
        ['pointerup', 'pointerleave', 'pointercancel', 'touchend'].forEach(ev => flip.addEventListener(ev, () => set(false)));
        // teclado: alternar é um estado, não um gesto
        flip.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(!box.classList.contains('showing-b')); } });
        flip.addEventListener('blur', () => set(false));
      }
    };
    wireStage();

    fig.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if (fam) store.set('ph-cmp-' + fam, m);
      fig.querySelectorAll('[data-mode]').forEach(x => {
        const on = x.dataset.mode === m;
        x.classList.toggle('active', on); x.setAttribute('aria-pressed', on);
      });
      stage.innerHTML = cmpStageHTML(Object.assign({}, o, { pct }), m);
      wireStage();
      fig.dispatchEvent(new CustomEvent('pl:mode', { detail: { mode: m }, bubbles: true }));
    }));
  }

  /* ══ FOTOGRAFIA ANOTADA ═══════════════════════════════════════════════
     Ensinar a LER uma fotografia não se faz com um parágrafo a descrevê-la:
     faz-se a apontar. Os pontos estão numerados mas mudos — a nota só
     aparece depois do toque, para que o olho procure primeiro e leia
     depois. É a mesma razão pela qual a pergunta vem antes da imagem. */
  const PIN_TONE = { ok: 'ok', bad: 'bad', info: 'info' };
  function hotspots(o) {
    const pins = o.pins || [];
    return `<figure class="pl-hs" data-pl="hotspots">
      ${o.q ? `<figcaption class="pl-ask">${o.q}</figcaption>` : ''}
      <div class="pl-hs-frame">
        ${o.src ? `<img src="${esc(o.src)}" alt="${esc(o.alt || '')}" loading="lazy" decoding="async">`
                : '<span class="pl-frame-empty"></span>'}
        ${pins.map((p, i) => `<button type="button" class="pl-pin ${PIN_TONE[p.tone] || 'info'}"
            style="left:${p.x}%;top:${p.y}%" data-pin="${i}"
            aria-label="Ponto ${i + 1}: ${esc(p.label || '')}">${i + 1}</button>`).join('')}
      </div>
      <div class="pl-hs-notes" data-notes>
        ${pins.map((p, i) => `<div class="pl-hs-note ${PIN_TONE[p.tone] || 'info'}" data-note="${i}" hidden>
          <b>${i + 1}. ${p.label || ''}</b><span>${p.t || ''}</span></div>`).join('')}
        <p class="pl-hs-hint" data-hint>Toca nos pontos da fotografia — ${pins.length} decisões para encontrar.</p>
      </div>
      ${o.caption ? `<figcaption class="pl-cap">${o.caption}</figcaption>` : ''}
    </figure>`;
  }

  function wireHotspots(fig) {
    const hint = fig.querySelector('[data-hint]');
    const seen = new Set();
    fig.querySelectorAll('[data-pin]').forEach(pin => pin.addEventListener('click', () => {
      const i = pin.dataset.pin;
      const note = fig.querySelector(`[data-note="${i}"]`);
      const open = !note.hidden;
      fig.querySelectorAll('[data-note]').forEach(n => { n.hidden = true; });
      fig.querySelectorAll('[data-pin]').forEach(p => p.classList.toggle('active', false));
      if (!open) {
        note.hidden = false; pin.classList.add('active'); pin.classList.add('seen');
        seen.add(i);
        if (hint) hint.hidden = true;
      } else if (hint) { hint.hidden = false; }
      if (hint && seen.size === fig.querySelectorAll('[data-pin]').length) {
        hint.textContent = '✓ Viste todas as decisões desta fotografia.';
        hint.classList.add('done');
      }
    }));
  }

  /* ══ ESCOLHER ANTES DE SABER ═══════════════════════════════════════════
     Uma comparação legendada resolve-se sozinha: lê-se o ✓ e passa-se à
     frente. Aqui a resposta está escondida até haver uma escolha — é o
     compromisso que faz o olho procurar mesmo a diferença. Errar ensina
     mais do que ler a explicação certa. */
  function pick(o) {
    const opts = o.options || [];
    return `<div class="pl-pick" data-pl="pick">
      <p class="pl-ask">${o.q || 'Qual é a mais forte?'}</p>
      <div class="pl-pick-grid">
        ${opts.map((op, i) => `<button type="button" class="pl-pick-opt" data-opt="${i}" data-ok="${op.ok ? 1 : 0}">
          <span class="pl-frame">
            ${op.src ? `<img src="${esc(op.src)}" alt="${esc(op.alt || 'Opção ' + (i + 1))}" loading="lazy" decoding="async">`
                     : '<span class="pl-frame-empty"></span>'}
            <span class="pl-pick-mark" aria-hidden="true"></span>
          </span>
          <span class="pl-pick-label">${op.label || String.fromCharCode(65 + i)}</span>
          <span class="pl-pick-why" hidden>${op.why || ''}</span>
        </button>`).join('')}
      </div>
      <p class="pl-pick-verdict" data-verdict hidden></p>
      ${o.after ? `<div class="pl-pick-after" data-after hidden>${o.after}</div>` : ''}
    </div>`;
  }

  function wirePick(box) {
    const verdict = box.querySelector('[data-verdict]');
    const after = box.querySelector('[data-after]');
    box.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => {
      if (box.classList.contains('answered')) return;
      box.classList.add('answered');
      const right = b.dataset.ok === '1';
      box.querySelectorAll('[data-opt]').forEach(x => {
        x.classList.add(x.dataset.ok === '1' ? 'is-ok' : 'is-bad');
        const w = x.querySelector('.pl-pick-why'); if (w) w.hidden = false;
      });
      b.classList.add('chosen');
      if (verdict) {
        verdict.hidden = false;
        verdict.className = 'pl-pick-verdict ' + (right ? 'ok' : 'bad');
        verdict.innerHTML = right ? '✓ Certo — e agora a razão importa mais do que o acerto.'
                                  : '✗ Não é essa. Lê o porquê nas duas: é aí que está a lição.';
      }
      if (after) after.hidden = false;
    }));
  }

  /* ══ LABORATÓRIO DE ESTILO ═════════════════════════════════════════════
     Um estilo visual explicado por escrito é uma lista de adjetivos. Aqui a
     receita é aplicada AOS PÍXEIS pelo PhotoLab, com um cursor de dose e a
     possibilidade de trocar a fotografia de base. Trocar a base é a parte
     que ensina de facto "onde funciona" e "quando se torna gasto": aplicar
     Noir a uma praia ao meio-dia mostra o limite melhor do que qualquer
     aviso escrito. */
  const LOOK_MAXW = 520;
  /* O tom de uma tonalidade separada é um desvio (-1..1) somado a cinzento
     médio. Reconstruí-lo em CSS dá o quadrado de cor que o utilizador vai
     mesmo ver aplicado às sombras ou às luzes. */
  const tintCSS = v => `rgb(${v.map(x => Math.round(128 + x * 110)).join(',')})`;
  function look(o) {
    const bases = o.bases || [];
    return `<div class="pl-look" data-pl="look" data-recipe="${esc(JSON.stringify(o.recipe || {}))}">
      <div class="pl-look-stage">
        <div class="pl-look-frame">
          <canvas class="pl-look-cv" role="img" aria-label="Fotografia com o estilo aplicado"></canvas>
          <img class="pl-look-orig" alt="" hidden>
          <span class="pl-tag ok" data-look-tag>${esc(o.name || 'Estilo')}</span>
          <button type="button" class="pl-look-hold" data-hold title="Manter premido para ver o original" aria-label="Manter premido para ver o original">✋ ver o original</button>
        </div>
        <div class="pl-look-ctl">
          <label class="pl-slider">
            <span class="pl-slider-lbl">Dose <b data-dose>100%</b></span>
            <input type="range" min="0" max="130" value="100" data-dose-range
                   aria-label="Intensidade do estilo">
          </label>
          ${bases.length > 1 ? `<div class="pl-look-bases" role="group" aria-label="Fotografia de base">
            ${bases.map((b, i) => `<button type="button" class="pl-look-base${i === 0 ? ' active' : ''}"
              data-base="${esc(b.src)}" data-i="${i}">${esc(b.label)}</button>`).join('')}
          </div><p class="pl-look-basehint">Troca a fotografia: um estilo que resolve uma cena costuma estragar outra.</p>` : ''}
        </div>
      </div>
      ${(o.ingredients || []).length ? `<div class="pl-ingr">
        <b class="pl-ingr-h">🎛️ A receita, ao vivo</b>
        <div class="pl-ingr-list">${o.ingredients.map(g => `<div class="pl-ingr-row">
          <span class="pl-ingr-n">${g.label}</span>
          <span class="pl-ingr-v" data-ingr="${esc(g.k)}"></span>
          <span class="pl-ingr-t">${g.note || ''}</span>
        </div>`).join('')}</div>
      </div>` : ''}
    </div>`;
  }

  /* Escala uma receita pela dose. Só os campos numéricos escalam; a curva e
     o HSL escalam pelo desvio ao neutro, para que dose 0 devolva mesmo o
     original e não uma versão "quase" original. */
  function scaleRecipe(rec, k) {
    const out = {};
    for (const key in rec) {
      const v = rec[key];
      if (typeof v === 'number') out[key] = key === 'grainSize' ? v : v * k;
      else if (Array.isArray(v)) out[key] = v.map(x => (typeof x === 'number' ? x * k : x));
      else if (v && typeof v === 'object') {
        const o2 = {}; for (const j in v) o2[j] = typeof v[j] === 'number' ? v[j] * k : v[j];
        out[key] = o2;
      } else out[key] = v;
    }
    if (rec.curvePts) {
      // interpola cada ponto de controlo contra a diagonal (a curva neutra)
      out.curve = (typeof PhotoLab !== 'undefined')
        ? PhotoLab.curveLUT(rec.curvePts.map(([x, y]) => [x, x + (y - x) * k])) : null;
      delete out.curvePts;
    }
    return out;
  }

  function wireLook(box) {
    if (typeof PhotoLab === 'undefined') { box.classList.add('pl-look-off'); return; }
    let recipe; try { recipe = JSON.parse(box.dataset.recipe); } catch (_) { recipe = {}; }
    const cv = box.querySelector('.pl-look-cv');
    const orig = box.querySelector('.pl-look-orig');
    const doseOut = box.querySelector('[data-dose]');
    const range = box.querySelector('[data-dose-range]');
    const firstBase = box.querySelector('[data-base]');
    const src = box.dataset.src || (firstBase ? firstBase.dataset.base : null) || box.getAttribute('data-fallback');
    let state = null, raf = 0;

    const paint = () => {
      if (!state) return;
      const k = (+range.value) / 100;
      doseOut.textContent = Math.round(k * 100) + '%';
      const p = scaleRecipe(recipe, k);
      PhotoLab.process(state.src, state.dst, p);
      state.ctx.putImageData(state.dst, 0, 0);
      box.querySelectorAll('[data-ingr]').forEach(el => {
        const v = p[el.dataset.ingr];
        if (v == null) { el.textContent = '—'; return; }
        if (typeof v === 'number') {
          const n = Math.round(v * 10) / 10;
          el.textContent = (n > 0 ? '+' : '') + n;
          return;
        }
        // Uma tonalidade é uma COR: mostrá-la como "✓" escondia justamente a
        // única informação útil. O quadrado dá o tom e a intensidade de uma vez.
        if (Array.isArray(v)) { el.innerHTML = `<i class="pl-swatch" style="background:${tintCSS(v)}"></i>`; return; }
        el.textContent = '✓';
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };

    const load = url => {
      if (!url) { box.classList.add('pl-look-off'); return; }
      const img = new Image();
      img.onload = () => {
        const w = Math.min(LOOK_MAXW, img.naturalWidth);
        const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        state = { ctx, src: ctx.getImageData(0, 0, w, h), dst: ctx.createImageData(w, h) };
        orig.src = url;
        paint();
      };
      img.onerror = () => box.classList.add('pl-look-off');
      img.src = url;
    };
    load(src);

    range.addEventListener('input', schedule);
    box.querySelectorAll('[data-base]').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('[data-base]').forEach(x => x.classList.toggle('active', x === b));
      state = null; load(b.dataset.base);
    }));
    const hold = box.querySelector('[data-hold]');
    const show = on => { orig.hidden = !on; cv.style.visibility = on ? 'hidden' : ''; box.querySelector('[data-look-tag]').textContent = on ? 'Original' : (box.dataset.name || 'Estilo'); };
    ['pointerdown', 'touchstart'].forEach(ev => hold.addEventListener(ev, e => { e.preventDefault(); show(true); }));
    ['pointerup', 'pointerleave', 'pointercancel', 'touchend'].forEach(ev => hold.addEventListener(ev, () => show(false)));
    hold.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show(orig.hidden); } });
    hold.addEventListener('blur', () => show(false));
  }

  /* ── miniatura já graduada ────────────────────────────────────────────────
     Uma grelha de estilos com a mesma fotografia crua em todos os cartões não
     ensina nada: são treze miniaturas iguais e o utilizador tem de abrir cada
     uma para descobrir o que a distingue. Passando a MESMA base pelo motor
     com a receita de cada um, a grelha torna-se ela própria a comparação —
     vê-se o catálogo inteiro de estilos de uma vez, sobre o mesmo material,
     que é a única forma de os comparar a sério.
     A base é partilhada de propósito: se cada cartão usasse a sua melhor
     fotografia, a diferença entre cartões seria a fotografia e não o estilo. */
  /* `w` = largura a que a imagem é REALMENTE processada. Ficava fixa em
     300px, o que chegava para as miniaturas dos Estilos mas deixava as
     tiras dos Cheatsheets visivelmente moles em ecrã grande (em modo de
     ecrã inteiro cada célula passa dos 500px e a imagem era esticada a
     partir de 300). Quem chama pede a largura que vai mostrar; a cache é
     por origem E largura, senão a primeira largura pedida ficava a servir
     todas as outras. */
  const _thumbCache = new Map();
  function paintThumb(canvas, src, recipe, w) {
    if (!canvas || !src || typeof PhotoLab === 'undefined') return;
    const W = Math.max(120, Math.min(900, Math.round(w || 300)));
    const key = src + '@' + W;
    const draw = base => {
      if (!base) return;
      canvas.width = base.width; canvas.height = base.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const dst = ctx.createImageData(base.width, base.height);
      PhotoLab.process(base.data, dst, recipe && recipe.curvePts ? scaleRecipe(recipe, 1) : (recipe || {}));
      ctx.putImageData(dst, 0, 0);
    };
    const cached = _thumbCache.get(key);
    if (cached) { if (cached.then) cached.then(draw); else draw(cached); return; }
    const p = new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const h = Math.round(img.naturalHeight * (W / img.naturalWidth));
        const c = document.createElement('canvas');
        c.width = W; c.height = h;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, W, h);
        const base = { data: cx.getImageData(0, 0, W, h), width: W, height: h };
        _thumbCache.set(key, base);
        res(base);
      };
      img.onerror = () => res(null);
      img.src = src;
    });
    _thumbCache.set(key, p);
    p.then(b => { if (b) draw(b); });
  }

  /* ══ ESCOLHER O CORTE ══════════════════════════════════════════════════
     O corte é a decisão mais barata de experimentar e a mais difícil de
     explicar por escrito. Em vez de descrever o corte certo, mostram-se
     vários sobre a MESMA fotografia — o mesmo material, várias leituras.
     Os dois painéis são deliberados: à esquerda vê-se ONDE se corta, à
     direita o que a fotografia PASSA A SER. Só a moldura não convence
     (parece geometria); só o resultado não ensina (não se percebe o que se
     deitou fora). O veredicto fica escondido até haver uma escolha.
     `rect` é [x, y, largura, altura] em % da imagem original. */
  function crop(o) {
    const opts = o.options || [];
    return `<div class="pl-crop" data-pl="crop" data-src="${esc(o.src || '')}">
      <p class="pl-ask">${o.q || 'Qual destes cortes conta melhor a história?'}</p>
      <div class="pl-crop-stage">
        <figure class="pl-crop-pane">
          <div class="pl-crop-frame">
            ${o.src ? `<img src="${esc(o.src)}" alt="${esc(o.alt || '')}" loading="lazy">` : '<span class="pl-frame-empty"></span>'}
            <div class="pl-crop-box" data-crop-box hidden></div>
          </div>
          <figcaption>Onde cortas</figcaption>
        </figure>
        <figure class="pl-crop-pane">
          <div class="pl-crop-out" data-crop-out>
            ${o.src ? `<img src="${esc(o.src)}" alt="Resultado do corte" data-crop-img loading="lazy">` : ''}
            <span class="pl-crop-idle" data-idle>Escolhe um corte →</span>
          </div>
          <figcaption>O que fica</figcaption>
        </figure>
      </div>
      <div class="pl-crop-opts">
        ${opts.map((c, i) => `<button type="button" class="pl-crop-opt" data-crop="${i}"
          data-rect="${c.rect.join(',')}" data-ok="${c.ok ? 1 : 0}">
          <b>${c.label}</b><span>${c.hint || ''}</span></button>`).join('')}
      </div>
      <p class="pl-crop-verdict" data-verdict hidden></p>
    </div>`;
  }

  function wireCrop(box) {
    const rect = box.querySelector('[data-crop-box]');
    const out = box.querySelector('[data-crop-out]');
    const img = box.querySelector('[data-crop-img]');
    const idle = box.querySelector('[data-idle]');
    const verdict = box.querySelector('[data-verdict]');
    const opts = box.querySelectorAll('[data-crop]');
    // proporção da imagem inteira, para que o painel do resultado ganhe a
    // proporção REAL do corte (um corte vertical tem de parecer vertical)
    let ratio = 1216 / 832;
    if (img) img.addEventListener('load', () => { if (img.naturalWidth) ratio = img.naturalWidth / img.naturalHeight; }, { once: true });

    opts.forEach(b => b.addEventListener('click', () => {
      opts.forEach(x => x.classList.toggle('active', x === b));
      box.classList.add('chosen');
      const [x, y, w, h] = b.dataset.rect.split(',').map(Number);
      const ok = b.dataset.ok === '1';

      rect.hidden = false;
      rect.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
      rect.classList.toggle('ok', ok); rect.classList.toggle('bad', !ok);

      if (idle) idle.hidden = true;
      if (img) {
        out.style.aspectRatio = `${ratio * (w / h)}`;
        img.style.width = (100 / w) * 100 + '%';
        img.style.height = 'auto';
        // left é % da largura do painel e top % da altura; como o painel tem
        // exactamente w% × h% da imagem, os dois reduzem-se à mesma forma.
        img.style.left = -(x / w) * 100 + '%';
        img.style.top = -(y / h) * 100 + '%';
      }
      verdict.hidden = false;
      verdict.className = 'pl-crop-verdict ' + (ok ? 'ok' : 'bad');
      verdict.innerHTML = (ok ? '✓ ' : '✗ ') + (b.querySelector('span').textContent || '');
    }));
  }

  /* ══ SEQUÊNCIA ═════════════════════════════════════════════════════════
     O único componente novo desta ronda, e só porque há lições que DUAS
     imagens não conseguem carregar:

       • ambiguidade — o significado muda quando entra mais contexto. É um
         processo de três passos, não uma oposição; com um par ficava
         "esta contra aquela", que é precisamente a leitura errada.
       • série — o que se ensina é a RELAÇÃO entre fotografias. Tem de se
         ver o conjunto ao mesmo tempo; mostradas duas a duas, a repetição
         e a variação (que são a lição) desaparecem.

     Daí os dois modos, com a mesma marcação:
       steps — avança-se uma de cada vez, e cada passo reescreve a anterior
       strip — todas juntas, porque é o conjunto que significa

     Honestidade NÃO usa isto: dois enquadramentos do mesmo acontecimento são
     exactamente o que o `compare` já faz bem. */
  function sequence(o) {
    const items = o.items || [];
    const mode = o.mode === 'strip' ? 'strip' : 'steps';
    const frames = items.map((it, i) => `<figure class="pl-seq-item" data-seq-i="${i}"${mode === 'steps' && i ? ' hidden' : ''}>
        <div class="pl-frame">
          ${it.src ? `<img src="${esc(it.src)}" alt="${esc(it.alt || '')}" loading="lazy" decoding="async">`
                   : '<span class="pl-frame-empty"></span>'}
          ${it.tag ? `<span class="pl-tag info">${it.tag}</span>` : ''}
        </div>
        ${it.cap ? `<figcaption>${it.cap}</figcaption>` : ''}
      </figure>`).join('');

    return `<div class="pl-seq pl-seq-${mode}" data-pl="sequence" data-mode="${mode}">
      ${o.q ? `<p class="pl-ask">${o.q}</p>` : ''}
      <div class="pl-seq-track">${frames}</div>
      ${mode === 'steps' ? `<div class="pl-seq-ctl">
        <button type="button" class="pl-seq-btn" data-seq-prev disabled>‹ Anterior</button>
        <span class="pl-seq-dots">${items.map((_, i) =>
          `<span class="pl-seq-dot${i ? '' : ' on'}" data-seq-dot="${i}"></span>`).join('')}</span>
        <button type="button" class="pl-seq-btn primary" data-seq-next>${esc(o.nextLabel || 'Mostrar mais contexto')} ›</button>
      </div>` : ''}
      ${o.after ? `<div class="pl-seq-after" data-seq-after${mode === 'steps' ? ' hidden' : ''}>${o.after}</div>` : ''}
    </div>`;
  }

  function wireSequence(box) {
    if (box.dataset.mode !== 'steps') return;
    const items = [...box.querySelectorAll('[data-seq-i]')];
    const dots = [...box.querySelectorAll('[data-seq-dot]')];
    const prev = box.querySelector('[data-seq-prev]');
    const next = box.querySelector('[data-seq-next]');
    const after = box.querySelector('[data-seq-after]');
    let i = 0;
    const show = n => {
      i = Math.max(0, Math.min(items.length - 1, n));
      // as anteriores ficam visíveis: ver o que se pensava antes ao lado do
      // que se sabe agora é metade da lição da ambiguidade
      items.forEach((el, k) => { el.hidden = k > i; });
      dots.forEach((d, k) => d.classList.toggle('on', k <= i));
      prev.disabled = i === 0;
      next.disabled = i === items.length - 1;
      next.textContent = i === items.length - 1 ? 'É tudo' : (box.dataset.nextLabel || next.dataset.lbl || 'Mostrar mais contexto') + ' ›';
      if (after) after.hidden = i < items.length - 1;
    };
    next.dataset.lbl = next.textContent.replace(/\s*›$/, '');
    prev.addEventListener('click', () => show(i - 1));
    next.addEventListener('click', () => show(i + 1));
    show(0);
  }

  /* ══ REVELAR ═══════════════════════════════════════════════════════════
     Uma tabela de duas colunas ("banal → memorável") lê-se de uma vez e
     não se fixa. Escondendo o lado direito, cada linha vira uma pergunta
     de um segundo — e a resposta passa a ser lembrada por ter sido
     antecipada. */
  function reveal(o) {
    return `<button type="button" class="pl-rev" data-pl="reveal">
      <span class="pl-rev-q">${o.q}</span>
      <span class="pl-rev-go" aria-hidden="true">?</span>
      <span class="pl-rev-a" hidden>${o.a}</span>
    </button>`;
  }
  function wireReveal(b) {
    b.addEventListener('click', () => {
      const a = b.querySelector('.pl-rev-a'), go = b.querySelector('.pl-rev-go');
      const open = !a.hidden;
      a.hidden = open; b.classList.toggle('open', !open);
      if (go) go.textContent = open ? '?' : '✓';
    });
  }

  /* ══ LISTA DE TAREFAS ══════════════════════════════════════════════════
     Um exercício só conta quando é feito. O estado fica em localStorage por
     `key`, para que voltar à lição mostre o que já foi treinado. */
  function drill(o) {
    const k = 'ph-drill-' + o.key;
    const done = store.get(k, '') === '1';
    return `<label class="pl-drill${done ? ' done' : ''}" data-pl="drill" data-key="${esc(k)}">
      <input type="checkbox" ${done ? 'checked' : ''}>
      <span class="pl-drill-body"><b>🎓 ${o.title || 'Exercício'}</b><span>${o.t}</span></span>
    </label>`;
  }
  function wireDrill(el) {
    const cb = el.querySelector('input');
    cb.addEventListener('change', () => {
      el.classList.toggle('done', cb.checked);
      store.set(el.dataset.key, cb.checked ? '1' : '0');
    });
  }

  /* ══ LIGAÇÕES CRUZADAS ═════════════════════════════════════════════════
     O portal só se lê como um sistema se cada lição disser onde é que a
     mesma ideia volta a aparecer. Os chips são sempre botões com um
     `data-go` — quem monta a página decide para onde navegam. */
  function chips(items, head) {
    if (!(items || []).length) return '';
    return `<div class="pl-links">
      ${head ? `<b class="pl-links-h">${head}</b>` : ''}
      <div class="pl-links-row">${items.map(i =>
        `<button type="button" class="ph-chip ph-chip-link" data-go="${esc(i.go)}">${i.icon || ''} ${i.label} →</button>`).join('')}</div>
    </div>`;
  }

  /* ══ ESQUELETO DE LIÇÃO ════════════════════════════════════════════════
     A forma que o portal passa a repetir em Visão, Estilos, Técnicas e
     Ler: uma ideia, uma coisa para ver, uma frase para levar, um exercício
     e para onde ir a seguir. A previsibilidade é o que permite encurtar o
     texto sem que a lição fique incompleta — quem chega sabe onde está
     cada peça e deixa de ter de as procurar dentro de um artigo. */
  function lesson(o) {
    return `<article class="pl-lesson">
      ${o.kicker ? `<p class="pl-kicker">${o.kicker}</p>` : ''}
      ${o.hook ? `<h3 class="pl-hook">${o.hook}</h3>` : ''}
      ${o.idea ? `<p class="pl-idea">${o.idea}</p>` : ''}
      ${o.visual || ''}
      ${o.more ? `<details class="pl-more"><summary>${o.moreLabel || 'Porquê é que isto acontece'}</summary><div>${o.more}</div></details>` : ''}
      ${o.body || ''}
      ${o.takeaway ? `<p class="pl-takeaway"><b>Para levar</b> ${o.takeaway}</p>` : ''}
      ${o.drill || ''}
      ${o.links || ''}
    </article>`;
  }

  /* ══ LIGAR TUDO ════════════════════════════════════════════════════════ */
  const WIRERS = {
    compare: wireCompare, hotspots: wireHotspots, pick: wirePick,
    look: wireLook, crop: wireCrop, reveal: wireReveal, drill: wireDrill,
    sequence: wireSequence,
  };
  function wire(scope, onGo) {
    if (!scope) return;
    scope.querySelectorAll('[data-pl]').forEach(el => {
      if (el.dataset.plWired) return;
      el.dataset.plWired = '1';
      const fn = WIRERS[el.dataset.pl];
      if (fn) fn(el);
    });
    if (onGo) scope.querySelectorAll('[data-go]').forEach(b => {
      if (b.dataset.goWired) return;
      b.dataset.goWired = '1';
      b.addEventListener('click', () => onGo(b.dataset.go));
    });
  }

  return { compare, hotspots, pick, look, crop, reveal, drill, chips, lesson, sequence, wire, esc, scaleRecipe, paintThumb };
})();
