/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — laboratórios "Executar" (percurso 2)
   ──────────────────────────────────────────────────────────────────
     experimentar/habito     desenhar / quebrar um hábito + registo
     experimentar/adiar      porque estou a adiar isto? (TMT ilustrativa)
     experimentar/foco       custo de troca medido + dia simulado
   e as demonstrações embutidas nos capítulos (m-loop, m-discount,
   m-sys12, m-reward). Os laboratórios "Dirigir" estão em pr-mind-dir.js.

   Dados pessoais: só em localStorage, chave 'pr-mind-v1', uma parte por
   laboratório (cada um apaga a sua). O mundo de exemplo só muda quando o
   visitante carrega num botão "levar ao mundo" (src 'mind').
   Simulações: modelos de brincar, com a forma tirada da investigação
   citada e parâmetros inventados — dito na página, sempre.
   ══════════════════════════════════════════════════════════════════ */
const PrMind = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, crumbs } = Pr;
  const W = PrWorld;
  const B = (pt, en) => ({ pt, en });

  /* ── guarda pessoal ── */
  const KEY = 'pr-mind-v1';
  const all = () => { const m = Pr.store.get(KEY, {}); return m && typeof m === 'object' ? m : {}; };
  const get = (part, d) => { const v = all()[part]; return v == null ? d : v; };
  const put = (part, v) => { const m = all(); if (v == null) delete m[part]; else m[part] = v; Pr.store.set(KEY, m); };
  const clr = parts => { const m = all(); parts.forEach(p => delete m[p]); Pr.store.set(KEY, m); };

  /* ── datas reais (os registos pessoais usam o calendário verdadeiro) ── */
  const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => isoDay(new Date());
  const daysBack = n => { const out = []; const d = new Date(); for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(x); } return out; };
  const fmtD = (d, o) => { try { return new Intl.DateTimeFormat(Pr.lang() === 'en' ? 'en-GB' : 'pt-PT', o || { day: 'numeric', month: 'short' }).format(d); } catch (_) { return isoDay(d); } };

  /* ── pedaços de página ── */
  const head = (area, crumb, h1, lede, tags) => `${crumbs([{ label: L(PrApp.AREAS[area].name), href: '#' + area }, { label: crumb }])}
    <header class="pr-head"><p class="pr-kicker">${esc(tx('Percurso 2 · Executar e dirigir', 'Track 2 · Executing & directing'))}${tags ? ' ' + tags.map(Pr.srcTag).join(' ') : ''}</p><h1>${esc(h1)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</header>`;
  const illu = (pt, en) => `<p class="md-illu" role="note"><b>${esc(tx('Ilustração, não medição.', 'Illustration, not measurement.'))}</b> ${esc(tx(pt, en))}</p>`;
  const mine = parts => `<div class="md-mine"><span class="md-mine-i" aria-hidden="true">${ICON.local}</span><span>${esc(tx('O que escreves neste laboratório fica só neste browser — não vai para lado nenhum.', 'What you write in this lab stays only in this browser — it goes nowhere.'))}</span>
    <button type="button" class="btn btn-sm" data-mine-clear="${esc(parts)}">${ICON.reset}<span>${esc(tx('Apagar os meus dados deste laboratório', 'Delete my data from this lab'))}</span></button></div>`;
  const applyBox = (pt, en, links) => `<section class="md-apply"><p class="pr-kicker">${esc(tx('Para levar para a vida real', 'To take into real life'))}</p><ul>${(Pr.lang() === 'en' ? en : pt).map(x => `<li>${x}</li>`).join('')}</ul>
    ${links ? `<p class="md-links">${links.map(l => `<a href="${l.href}">${esc(L(l.l))} →</a>`).join('')}</p>` : ''}</section>`;
  const chLink = (id) => { const c = PrLearnContent.CH.find(x => x.id === id); return c ? `<a class="md-chlink" href="#aprender/${id}">${esc(tx('Capítulo', 'Chapter'))}: ${esc(L(c.title))} →</a>` : ''; };
  const seg = (name, opts, cur, label) => `<div class="seg md-seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(o =>
    `<button type="button" role="radio" class="seg-btn${o.v === cur ? ' active' : ''}" aria-checked="${o.v === cur}" data-${name}="${esc(o.v)}">${esc(L(o.l))}</button>`).join('')}</div>`;
  const range = (name, lab, v, min, max, hint) => `<label class="md-range"><span class="md-range-l">${esc(lab)}${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    <input type="range" min="${min}" max="${max}" step="1" value="${v}" data-r="${name}" aria-label="${esc(lab)}"><b class="pr-mono" data-rv="${name}">${v}</b></label>`;

  const rv = (root, name, v) => { const b = root.querySelector(`[data-rv="${name}"]`); if (b) b.textContent = v; };

  /* seed pseudo-aleatório determinístico (as simulações não "tremem" entre redesenhos) */
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ── gráfico de linhas pequeno (SVG, rótulos diretos) ── */
  function chart(o) {
    const w = o.w || 600, h = o.h || 230, pl = 40, pr = o.pr || 18, pt = 24, pb = 34;
    const sx = x => pl + (x - o.x0) / (o.x1 - o.x0) * (w - pl - pr);
    const sy = y => h - pb - (Math.max(o.y0, Math.min(o.y1, y)) - o.y0) / (o.y1 - o.y0) * (h - pt - pb);
    const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
    const xt = (o.xt || []).map(x => `<g><line x1="${sx(x)}" x2="${sx(x)}" y1="${h - pb}" y2="${h - pb + 4}" class="md-ax"/><text x="${sx(x)}" y="${h - pb + 16}" text-anchor="${x === o.x1 ? 'end' : x === o.x0 ? 'start' : 'middle'}">${esc(o.xf ? o.xf(x) : x)}</text></g>`).join('');
    const yt = (o.yt || []).map(y => `<g><line x1="${pl}" x2="${w - pr}" y1="${sy(y)}" y2="${sy(y)}" class="md-grid"/><text x="${pl - 6}" y="${sy(y) + 4}" text-anchor="end">${esc(o.yf ? o.yf(y) : y)}</text></g>`).join('');
    const vl = (o.vlines || []).map(v => `<g class="${v.cls || ''}"><line x1="${sx(v.x)}" x2="${sx(v.x)}" y1="${pt}" y2="${h - pb}" class="md-vl"/>${v.label ? `<text x="${sx(v.x) + (v.end ? -5 : 5)}" y="${v.low ? h - pb - 6 : pt + 11}" text-anchor="${v.end ? 'end' : 'start'}" class="md-vlt">${esc(v.label)}</text>` : ''}</g>`).join('');
    const ss = o.series.map(s => { const last = s.pts[s.pts.length - 1];
      return `<g class="md-s ${s.cls || ''}"><path d="${path(s.pts)}" fill="none"/>${s.label && last ? `<text x="${Math.min(w - 4, sx(last[0]) + 5)}" y="${sy(last[1]) + (s.dy || 4)}" text-anchor="${sx(last[0]) > w - 90 ? 'end' : 'start'}" class="md-sl">${esc(s.label)}</text>` : ''}</g>`; }).join('');
    const dots = (o.dots || []).map(d => `<circle cx="${sx(d.x)}" cy="${sy(d.y)}" r="${d.r || 5}" class="md-dot ${d.cls || ''}"/>`).join('');
    return `<svg class="md-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title)}"><title>${esc(o.title)}</title>
      ${yt}<line x1="${pl}" x2="${w - pr}" y1="${h - pb}" y2="${h - pb}" class="md-ax"/>${xt}${vl}${ss}${dots}
      ${o.xl ? `<text x="${w - pr}" y="${h - 4}" text-anchor="end" class="md-axl">${esc(o.xl)}</text>` : ''}${o.yl ? `<text x="${pl}" y="${pt - 10}" class="md-axl">${esc(o.yl)}</text>` : ''}</svg>`;
  }

  /* apagar dados de um laboratório: dois toques (sem caixas de diálogo) */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mine-clear]'); if (!b) return;
    if (!b.dataset.armed) {
      b.dataset.armed = '1'; const sp = b.querySelector('span'); const was = sp.textContent;
      sp.textContent = tx('Tens a certeza? Toca outra vez', 'Sure? Tap again'); b.classList.add('btn-danger');
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; sp.textContent = was; b.classList.remove('btn-danger'); } }, 4000);
      return;
    }
    clr(b.dataset.mineClear.split(','));
    Pr.toast(tx('Os teus dados deste laboratório foram apagados.', 'Your data from this lab was deleted.'));
    PrNav.refresh();
  });

  /* nova tarefa no mundo de exemplo, sempre com o rótulo da experiência 'mind' */
  function worldTask(text, due) {
    const id = 'tm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    return W.apply('mind', { o: 'add', db: 'tasks', r: { id, t: text, box: 'wg', due: due == null ? W.clock() : due, p: 2 } }) ? id : null;
  }
  const worldTasks = () => W.tasks().slice().sort((a, b) => (a.due == null ? 999 : a.due) - (b.due == null ? 999 : b.due));

  /* ════════════════ demonstrações embutidas nos capítulos ════════════════ */
  const D = PrLearn.DEMOS;
  const demoHead = (t, sub, tags) => `<div class="lr-demo-h"><span class="lr-demo-k">${esc(tx('Demonstração', 'Demo'))}</span><b>${esc(t)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}${tags ? tags.map(Pr.srcTag).join('') : ''}</div>`;

  /* ── o ciclo do hábito e as quatro leis (Clear) ── */
  const LOOP = [
    { n: B('Deixa', 'Cue'), law: B('Torná-lo óbvio', 'Make it obvious'), inv: B('Torná-lo invisível', 'Make it invisible'),
      ex: B('O lembrete "Revisão" às 9h de sexta, com a lista de tarefas já aberta no portátil.', 'A "Review" reminder at 9am on Friday, with the task list already open on the laptop.'),
      exb: B('O telemóvel fica noutra divisão durante o bloco de foco: sem ecrã à vista, menos deixas.', 'The phone stays in another room during the focus block: no screen in sight, fewer cues.') },
    { n: B('Vontade', 'Craving'), law: B('Torná-lo atrativo', 'Make it attractive'), inv: B('Torná-lo pouco atrativo', 'Make it unattractive'),
      ex: B('O café bom fica reservado para a revisão de sexta.', 'The good coffee is saved for the Friday review.'),
      exb: B('Antes de abrir a rede social, lembrar o que custa: "perco o fio à meada e 20 minutos".', 'Before opening social media, recall the cost: "I lose my thread and 20 minutes".') },
    { n: B('Resposta', 'Response'), law: B('Torná-lo fácil', 'Make it easy'), inv: B('Torná-lo difícil', 'Make it difficult'),
      ex: B('A agenda da revisão está escrita; começar é só abrir o passo 1 (menos de 2 minutos).', 'The review agenda is written down; starting is just opening step 1 (under 2 minutes).'),
      exb: B('Terminar a sessão da app depois de cada uso: dez segundos de fricção chegam para quebrar o automático.', 'Log out of the app after each use: ten seconds of friction is enough to break the autopilot.') },
    { n: B('Recompensa', 'Reward'), law: B('Torná-lo satisfatório', 'Make it satisfying'), inv: B('Torná-lo insatisfatório', 'Make it unsatisfying'),
      ex: B('Riscar cada passo e ver a caixa de notas vazia no fim.', 'Tick each step and see the notes inbox empty at the end.'),
      exb: B('Combinar com um colega: quem falhar o bloco de foco paga o café.', 'Agree with a colleague: whoever breaks the focus block buys the coffee.') },
  ];
  D['m-loop'] = el => {
    let mode = 'build', on = 0;
    const draw = () => {
      el.innerHTML = demoHead(tx('O ciclo de um hábito', 'The loop of a habit'), tx('Toca numa fase', 'Tap a stage'), ['auth']) +
        `${seg('lm', [{ v: 'build', l: B('Criar um hábito', 'Build a habit') }, { v: 'break', l: B('Quebrar um hábito', 'Break a habit') }], mode, tx('Modo', 'Mode'))}
        <ol class="md-loop">${LOOP.map((s, i) => `<li><button type="button" class="md-loop-b${i === on ? ' on' : ''}" data-ls="${i}" aria-pressed="${i === on}"><span class="pr-mono">${i + 1}</span><b>${esc(L(s.n))}</b><small>${esc(L(mode === 'build' ? s.law : s.inv))}</small></button></li>`).join('')}</ol>
        <div class="md-loop-out" aria-live="polite"><p><b>${esc(L(mode === 'build' ? LOOP[on].law : LOOP[on].inv))}.</b> ${esc(L(mode === 'build' ? LOOP[on].ex : LOOP[on].exb))}</p></div>
        <p class="pr-sub">${esc(tx('As quatro fases e as quatro leis são o modelo de James Clear (Atomic Habits). Os exemplos são deste site.', 'The four stages and four laws are James Clear\'s model (Atomic Habits). The examples are this site\'s.'))} <a href="#experimentar/habito">${esc(tx('Desenhar o teu hábito →', 'Design your habit →'))}</a></p>`;
    };
    draw();
    el.addEventListener('click', e => {
      const m = e.target.closest('[data-lm]'); if (m) { mode = m.dataset.lm; draw(); $('[data-lm].active', el).focus(); return; }
      const s = e.target.closest('[data-ls]'); if (s) { on = +s.dataset.ls; draw(); $(`[data-ls="${on}"]`, el).focus(); }
    });
  };

  /* ── desconto hiperbólico: a preferência inverte-se ao aproximar ── */
  D['m-discount'] = el => {
    let dd = 20, k = 4;      // dias até à recompensa pequena; impulsividade (×0,05)
    el.innerHTML = demoHead(tx('Agora contra depois', 'Now versus later'), tx('Uma recompensa pequena mais cedo, ou uma maior 7 dias depois?', 'A small reward sooner, or a bigger one 7 days later?'), ['res']) +
      `<div class="md-two">${range('dd', tx('Dias até à recompensa pequena', 'Days to the small reward'), dd, 0, 30)}${range('k', tx('Impulsividade', 'Impulsiveness'), k, 1, 20, tx('quanto pesa a espera', 'how much waiting weighs'))}</div><div data-dout></div>`;
    const out = $('[data-dout]', el);
    const draw = () => {
      const kk = k * 0.05, Vs = d => 6 / (1 + kk * d), Vl = d => 10 / (1 + kk * (d + 7));
      const flip = 10.5 - 1 / kk;               // 6(1+k(d+7)) = 10(1+kd)
      const ptsS = [], ptsL = []; for (let d = 30; d >= 0; d -= .5) { ptsS.push([30 - d, Vs(d)]); ptsL.push([30 - d, Vl(d)]); }
      const pick = Vs(dd) > Vl(dd) ? 's' : 'l';
      out.innerHTML = `${chart({ title: tx('Valor sentido das duas recompensas à medida que o dia se aproxima', 'Felt value of the two rewards as the day approaches'), x0: 0, x1: 30, y0: 0, y1: 10, h: 210,
          xt: [0, 10, 20, 30], xf: x => x === 30 ? tx('o dia', 'the day') : tx(`faltam ${30 - x}`, `${30 - x} left`), yt: [0, 5, 10],
          series: [{ pts: ptsL, cls: 'md-s2', label: tx('grande (10), +7 dias', 'big (10), +7 days'), dy: -6 }, { pts: ptsS, cls: 'md-s1', label: tx('pequena (6)', 'small (6)'), dy: 12 }],
          vlines: [{ x: 30 - dd, label: tx('hoje', 'today'), end: dd < 8 }].concat(flip > 0 && flip < 30 ? [{ x: 30 - flip, cls: 'md-flip', label: tx('inversão', 'flip'), end: flip < 15 }] : []),
          yl: tx('valor sentido', 'felt value') })}
        <p class="md-verdict" aria-live="polite">${pick === 's'
          ? `<b>${esc(tx('Escolhes a pequena.', 'You pick the small one.'))}</b> ${esc(tx('De perto, a recompensa imediata parece maior — mesmo valendo menos.', 'Up close, the immediate reward looks bigger — even though it is worth less.'))}`
          : `<b>${esc(tx('Escolhes a grande.', 'You pick the big one.'))}</b> ${esc(flip > 0 ? tx(`Mas quando faltarem menos de ${Math.max(0, Math.round(flip))} dias, a pequena vai parecer melhor. É assim que "começo amanhã" ganha.`, `But once fewer than ${Math.max(0, Math.round(flip))} days remain, the small one will look better. That is how "I'll start tomorrow" wins.`) : tx('Com impulsividade tão baixa a preferência nunca se inverte.', 'With impulsiveness this low the preference never flips.'))}`}</p>
        ${illu('A forma da curva (hiperbólica) vem da investigação sobre desconto temporal; os números são inventados para mostrar a inversão.', 'The curve shape (hyperbolic) comes from research on temporal discounting; the numbers are made up to show the reversal.')}`;
    };
    draw();
    el.addEventListener('input', e => { const r = e.target.closest('[data-r]'); if (!r) return; if (r.dataset.r === 'dd') dd = +r.value; else k = +r.value; rv(el, r.dataset.r, r.value); draw(); });
  };

  /* ── duas perguntas rápidas (estilo do Teste de Reflexão Cognitiva, originais) ── */
  const S12 = [
    { q: B('Uma tarefa e a sua revisão demoram 50 minutos ao todo. A tarefa demora mais 40 minutos do que a revisão. Quantos minutos demora a revisão?', 'A task and its review take 50 minutes in total. The task takes 40 minutes longer than the review. How many minutes does the review take?'),
      fast: 10, ok: 5, why: B('Se a revisão fosse 10, a tarefa seria 50 e o total 60. Revisão r, tarefa r + 40: 2r + 40 = 50, r = 5.', 'If the review were 10, the task would be 50 and the total 60. Review r, task r + 40: 2r + 40 = 50, r = 5.') },
    { q: B('As mensagens por ler numa caixa duplicam todos os dias. Ao fim de 12 dias a caixa está cheia. Em que dia estava a meio?', 'The unread messages in an inbox double every day. After 12 days the inbox is full. On which day was it half full?'),
      fast: 6, ok: 11, why: B('Se duplica todos os dias, um dia antes de estar cheia estava a meio: dia 11.', 'If it doubles every day, one day before it was full it was half full: day 11.') },
  ];
  D['m-sys12'] = el => {
    const ans = [];
    const draw = () => {
      el.innerHTML = demoHead(tx('Rápido ou devagar?', 'Fast or slow?'), tx('Responde com o primeiro número que te ocorrer — e depois confere', 'Answer with the first number that comes to mind — then check'), ['est']) +
        `<ol class="md-s12">${S12.map((s, i) => { const a = ans[i]; return `<li><p>${esc(L(s.q))}</p>
          ${a == null ? `<form class="pr-row" data-s12="${i}"><input class="md-in md-num" type="number" inputmode="numeric" required aria-label="${esc(tx('Resposta', 'Answer'))}"><button class="btn btn-sm" type="submit">${esc(tx('Responder', 'Answer'))}</button></form>`
            : `<p class="wk-fb ${a === s.ok ? 'ok' : 'no'}"><b>${esc(a === s.ok ? tx('Certo: ', 'Right: ') + s.ok + '.' : a === s.fast ? tx(`${a} é a resposta rápida — e está errada. `, `${a} is the fast answer — and it is wrong. `) : tx(`A resposta é ${s.ok}. `, `The answer is ${s.ok}. `))}</b> ${esc(L(s.why))}</p>`}</li>`; }).join('')}</ol>
        ${ans.length === S12.length ? `<p class="pr-sub">${esc(tx('A resposta errada que salta logo é o Sistema 1 a trabalhar; conferir é o Sistema 2. Estas duas perguntas imitam o Teste de Reflexão Cognitiva (Frederick, 2005) — servem para sentir a diferença, não medem nada sobre ti.', 'The wrong answer that jumps out is System 1 at work; checking is System 2. These two questions imitate the Cognitive Reflection Test (Frederick, 2005) — they let you feel the difference; they measure nothing about you.'))}
          <button type="button" class="btn btn-sm btn-ghost" data-s12-again>${ICON.reset}${esc(tx('Outra vez', 'Again'))}</button></p>` : ''}`;
    };
    draw();
    el.addEventListener('submit', e => { const f = e.target.closest('[data-s12]'); if (!f) return; e.preventDefault(); const v = parseFloat($('input', f).value); if (isNaN(v)) return; ans[+f.dataset.s12] = v; draw(); const nx = $('[data-s12] input', el); if (nx) nx.focus(); });
    el.addEventListener('click', e => { if (e.target.closest('[data-s12-again]')) { ans.length = 0; draw(); } });
  };

  /* ── prémios × tipo de tarefa (direção dos efeitos, com o tipo de evidência) ── */
  const RW = [
    { v: 'none', l: B('Sem prémio', 'No reward') },
    { v: 'fb', l: B('Elogio / feedback sobre o que fizeste', 'Praise / feedback on what you did') },
    { v: 'unexp', l: B('Prémio tangível inesperado', 'Unexpected tangible reward') },
    { v: 'exp', l: B('Prémio tangível prometido por fazer', 'Tangible reward promised for doing it') },
    { v: 'perf', l: B('Prémio prometido por desempenho', 'Reward promised for performance') },
  ];
  const RW_OUT = {
    int: {
      none: ['→', 'res', B('A referência: fazes porque te interessa.', 'The baseline: you do it because it interests you.')],
      fb: ['↑', 'res', B('Feedback positivo e informativo tendeu a aumentar a motivação intrínseca (sobretudo em adultos; em crianças menos claro).', 'Positive, informative feedback tended to increase intrinsic motivation (mostly in adults; less clearly in children).')],
      unexp: ['→', 'res', B('Um prémio que não se esperava não tendeu a estragar: não foi a razão para fazer.', 'A reward nobody expected did not tend to spoil it: it was not the reason for doing it.')],
      exp: ['↓', 'res', B('Prémios tangíveis prometidos por fazer ou acabar tenderam a baixar o interesse depois de o prémio acabar.', 'Tangible rewards promised for doing or finishing tended to lower interest once the reward stopped.')],
      perf: ['↓', 'res', B('Na meta-análise, também baixaram a motivação medida pela escolha livre. É a parte mais discutida: Cameron e Pierce encontraram efeitos mais limitados.', 'In the meta-analysis, they also lowered motivation measured by free choice. This is the most disputed part: Cameron and Pierce found more limited effects.')],
    },
    dull: {
      none: ['→', 'est', B('Pouca motivação intrínseca à partida — e nada a estragar.', 'Little intrinsic motivation to begin with — and nothing to spoil.')],
      fb: ['↑', 'est', B('Reconhecer o esforço ajuda, sobretudo se vier com o porquê da tarefa.', 'Acknowledging the effort helps, especially when it comes with the why of the task.')],
      unexp: ['→', 'est', B('Simpático, mas não muda a próxima vez.', 'Nice, but it does not change the next time.')],
      exp: ['↑', 'est', B('Aqui um prémio pode simplesmente ajudar a fazer: não há gosto para estragar. Durar é outra história.', 'Here a reward may simply help get it done: there is no enjoyment to spoil. Lasting is another story.')],
      perf: ['↑', 'est', B('Pode aumentar o esforço a curto prazo. Para durar, junta-lhe a razão (abaixo).', 'It can raise effort in the short term. To last, add the reason (below).')],
    },
  };
  D['m-reward'] = el => {
    let task = 'int', rw = 'exp', why = false;
    const draw = () => {
      const o = RW_OUT[task][rw];
      el.innerHTML = demoHead(tx('Prémios e motivação', 'Rewards and motivation'), tx('Escolhe o tipo de tarefa e o tipo de prémio', 'Pick the kind of task and the kind of reward')) +
        `${seg('rt', [{ v: 'int', l: B('Tarefa interessante', 'Interesting task') }, { v: 'dull', l: B('Tarefa aborrecida', 'Boring task') }], task, tx('Tipo de tarefa', 'Kind of task'))}
        <div class="md-rw" role="radiogroup" aria-label="${esc(tx('Tipo de prémio', 'Kind of reward'))}">${RW.map(r => `<button type="button" role="radio" class="md-rw-b${r.v === rw ? ' on' : ''}" aria-checked="${r.v === rw}" data-rw="${r.v}">${esc(L(r.l))}</button>`).join('')}</div>
        <div class="md-rw-out" aria-live="polite"><span class="md-arrow md-a-${o[0] === '↑' ? 'up' : o[0] === '↓' ? 'down' : 'flat'}" aria-hidden="true">${o[0]}</span>
          <p><b>${esc(o[0] === '↑' ? tx('Tende a subir.', 'Tends to rise.') : o[0] === '↓' ? tx('Tende a baixar.', 'Tends to drop.') : tx('Sem efeito claro.', 'No clear effect.'))}</b> ${esc(L(o[2]))} ${Pr.srcTag(o[1])}</p></div>
        ${task === 'dull' ? `<label class="lr-toggle"><input type="checkbox" data-why ${why ? 'checked' : ''}> ${esc(tx('Explicar porquê, reconhecer que é aborrecido e dar escolha no como', 'Explain why, acknowledge it is boring and give a choice in how'))}</label>
          ${why ? `<p class="wk-fb ok">${esc(tx('Numa experiência de Deci e colegas (1994), estas três coisas juntas levaram mais pessoas a "interiorizar" uma tarefa aborrecida — a continuar sem ninguém a pedir.', 'In an experiment by Deci and colleagues (1994), these three together led more people to "internalise" a boring task — to keep going without anyone asking.'))} ${Pr.srcTag('res')}</p>` : ''}` : ''}
        <p class="pr-sub">${esc(tx('Direções médias de meta-análises e experiências (Deci, Koestner e Ryan, 1999; Deci et al., 1994), não previsões para ti.', 'Average directions from meta-analyses and experiments (Deci, Koestner & Ryan, 1999; Deci et al., 1994), not predictions for you.'))}</p>`;
    };
    draw();
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-rt]'); if (a) { task = a.dataset.rt; draw(); $('[data-rt].active', el).focus(); return; }
      const b = e.target.closest('[data-rw]'); if (b) { rw = b.dataset.rw; draw(); $(`[data-rw="${rw}"]`, el).focus(); }
    });
    el.addEventListener('change', e => { if (e.target.matches('[data-why]')) { why = e.target.checked; draw(); $('[data-why]', el).focus(); } });
  };

  /* ════════════════ 1 · Laboratório de hábitos ════════════════ */
  const H_PRESETS = [
    { id: 'rev', l: B('Revisão semanal', 'Weekly review'), name: B('Fazer a revisão semanal', 'Do the weekly review'), anchor: B('servir o café de sexta de manhã', 'pouring Friday morning coffee'), where: B('à secretária', 'at my desk'), tiny: B('abrir o passo 1 da revisão', 'open step 1 of the review'), cue: 'act', cx: 'mid', days: 1, fr: 1, rew: 'yes', id2: B('fecha a semana a limpo', 'closes the week cleanly') },
    { id: 'b3', l: B('Big 3 de manhã', 'Morning Big 3'), name: B('Escolher os Big 3', 'Pick the Big 3'), anchor: B('abrir o portátil', 'opening the laptop'), where: B('antes do email', 'before email'), tiny: B('abrir o filtro Hoje', 'open the Today filter'), cue: 'act', cx: 'easy', days: 5, fr: 0, rew: 'yes', id2: B('decide o dia antes de o dia decidir por si', 'decides the day before the day decides for them') },
    { id: 'read', l: B('Ler', 'Reading'), name: B('Ler antes de dormir', 'Read before sleep'), anchor: B('pôr o telemóvel a carregar na sala', 'putting the phone to charge in the living room'), where: B('na cama', 'in bed'), tiny: B('ler uma página', 'read one page'), cue: 'act', cx: 'easy', days: 7, fr: 1, rew: 'yes', id2: B('lê todos os dias', 'reads every day') },
    { id: 'walk', l: B('Caminhar', 'Walking'), name: B('Caminhar 30 minutos', 'Walk for 30 minutes'), anchor: B('almoçar', 'having lunch'), where: B('à volta do quarteirão', 'around the block'), tiny: B('calçar os ténis e sair à porta', 'put my trainers on and step outside'), cue: 'act', cx: 'hard', days: 5, fr: 2, rew: 'no', id2: B('se mexe todos os dias', 'moves every day') },
  ];
  const H_DEF = () => { const p = H_PRESETS[0]; return { name: L(p.name), anchor: L(p.anchor), where: L(p.where), tiny: L(p.tiny), cue: p.cue, cx: p.cx, days: p.days, fr: p.fr, rew: p.rew, ident: L(p.id2), miss: 'none' }; };

  /* modelo de brincar: automatismo sobe por repetição, rumo a um teto (forma assintótica
     como em Lally et al. 2010); a velocidade depende da deixa e da dificuldade. */
  function habitSim(h, missOverride) {
    const cueF = { act: 1.2, time: 1.0, none: 0.55 }[h.cue] || 1, cxF = { easy: 1.3, mid: 1, hard: 0.6 }[h.cx] || 1, rewF = h.rew === 'yes' ? 1.12 : 1;
    const r = 0.045 * cueF * cxF * rewF;
    const pDo = Math.max(0.15, 1 - 0.14 * h.fr);           // fricção → mais dias em que não acontece
    const R = rng(7 + h.days * 31 + h.fr * 7), miss = missOverride || h.miss;
    const plan = d => { const wd = d % 7; return h.days >= 7 || (h.days === 1 ? wd === 4 : [0, 2, 4, 1, 3, 5, 6].slice(0, h.days).includes(wd)); };
    let A = 0, reach = null, reps = 0; const pts = [[0, 0]];
    for (let d = 1; d <= 84; d++) {
      let did = plan(d) && R() < pDo;
      if (miss === 'one' && d === 20) did = false;
      if (miss === 'pause' && d >= 29 && d <= 42) did = false;
      if (did) { A += r * (100 - A); reps++; } else if (plan(d)) A *= 0.995; else A *= 0.999;
      if (reach == null && A >= 90) reach = d;
      pts.push([d, A]);
    }
    return { pts, reach, reps, A, r, pDo };
  }

  function habitPage(rest, el) {
    PrShell.setArea('experimentar', tx('Laboratório de hábitos', 'Habit lab'));
    const mode = rest === 'quebrar' ? 'break' : 'build';
    el.innerHTML = `<div class="pr-wrap pr-page md-page">
      ${head('experimentar', tx('Laboratório de hábitos', 'Habit lab'), tx('Laboratório de hábitos', 'Habit lab'),
        tx('Desenha um hábito teu: a deixa, o sítio, a versão pequena. Mexe nas condições e vê como mudam as repetições necessárias. Depois regista os dias reais.', 'Design a habit of your own: the cue, the place, the small version. Change the conditions and watch how the repetitions needed change. Then log the real days.'), ['res', 'auth'])}
      <nav class="md-tabs" aria-label="${esc(tx('Modo', 'Mode'))}"><a href="#experimentar/habito" ${mode === 'build' ? 'aria-current="page"' : ''}>${esc(tx('Criar um hábito', 'Build a habit'))}</a><a href="#experimentar/habito/quebrar" ${mode === 'break' ? 'aria-current="page"' : ''}>${esc(tx('Quebrar um hábito', 'Break a habit'))}</a></nav>
      <div data-hhost></div>
      ${mine('habit,habits,hbreak')}
      ${applyBox([
        'Escreve a frase "Depois de…, em…, vou…" e põe-na onde a deixa acontece.',
        'Começa pela versão pequena durante duas semanas, mesmo que pareça ridícula.',
        'Falhaste um dia? Retoma no seguinte. O que estraga é a irregularidade longa, não a falha.',
        'Para quebrar um hábito, muda primeiro o ambiente — não contes com força de vontade.'],
        ['Write the sentence "After…, at…, I will…" and put it where the cue happens.',
        'Start with the small version for two weeks, even if it feels silly.',
        'Missed a day? Pick it up the next. Long irregularity breaks a habit, not a single miss.',
        'To break a habit, change the environment first — do not count on willpower.'],
        [{ href: '#aprender/habitos', l: B('Capítulo: Hábitos', 'Chapter: Habits') }, { href: '#aplicar/revisao-pessoal', l: B('Rever os teus hábitos na revisão pessoal', 'Review your habits in the personal review') }])}
    </div>`;
    const host = $('[data-hhost]', el);
    if (mode === 'break') return breakLab(host);
    buildLab(host);
  }

  function buildLab(host) {
    let h = Object.assign(H_DEF(), get('habit', {}));
    const save = () => put('habit', h);
    const sentence = () => `${tx('Depois de', 'After')} ${h.anchor || '…'}, ${h.where || '…'}, ${tx('vou', 'I will')} ${h.tiny || '…'}.`;
    const insights = s => {
      const out = [];
      if (h.cue === 'none') out.push(tx('Sem uma deixa fixa, cada repetição é uma decisão nova. Ancora o hábito a algo que já fazes todos os dias.', 'Without a fixed cue, every repetition is a new decision. Anchor the habit to something you already do every day.'));
      if (h.fr >= 2) out.push(tx(`Com ${h.fr} passos antes de começar, há dias em que simplesmente não acontece (${Math.round((1 - s.pDo) * 100)}% dos dias planeados, neste modelo). Prepara o que precisas na véspera.`, `With ${h.fr} steps before starting, some days it just does not happen (${Math.round((1 - s.pDo) * 100)}% of planned days, in this model). Lay out what you need the day before.`));
      if (h.days <= 2) out.push(tx('Poucas repetições por semana: neste modelo o automatismo sobe por repetição, não por calendário, e um hábito semanal leva meses. O estudo de Lally só testou ações diárias — mas, se há poucas repetições, cada uma precisa de uma deixa muito clara.', 'Few repetitions a week: in this model automaticity grows per repetition, not per calendar, and a weekly habit takes months. Lally\'s study only tested daily actions — but with few repetitions, each one needs a very clear cue.'));
      if (h.cx === 'hard' && !h.tiny) out.push(tx('Ação exigente sem versão pequena: define o mínimo que conta como "feito".', 'Demanding action with no small version: define the minimum that counts as "done".'));
      if (h.miss === 'one') out.push(tx('Uma falha isolada quase não se nota na curva — como no estudo de Lally.', 'A single miss barely shows on the curve — as in Lally\'s study.'));
      if (h.miss === 'pause') out.push(tx('Duas semanas paradas: perde-se algum terreno e é preciso recomeçar a subir. Planeia o regresso (a deixa continua lá).', 'Two weeks off: some ground is lost and the climb restarts. Plan the comeback (the cue is still there).'));
      if (!out.length) out.push(tx('Bom desenho: deixa estável, ação simples, repetições frequentes.', 'Good design: stable cue, simple action, frequent repetitions.'));
      return out;
    };
    const outHtml = () => {
      const s = habitSim(h), ref = habitSim({ cue: 'time', cx: 'mid', rew: 'no', fr: 0, days: 7 }, 'none');
      const habits = get('habits', []);
      return `          ${chart({ title: tx('Automatismo ilustrativo ao longo de 12 semanas', 'Illustrative automaticity over 12 weeks'), x0: 0, x1: 84, y0: 0, y1: 100, xt: [0, 21, 42, 63, 84], xf: x => tx(`dia ${x}`, `day ${x}`), yt: [0, 50, 100],
            series: [{ pts: ref.pts, cls: 'md-sref', label: tx('diário, médio', 'daily, medium'), dy: 14 }, { pts: s.pts, cls: 'md-s1', label: tx('o teu desenho', 'your design'), dy: -6 }],
            vlines: [{ x: 66, cls: 'md-lally', label: tx('estudo: mediana 66 dias (18–254)', 'study: median 66 days (18–254)'), end: true, low: true }], yl: tx('automatismo', 'automaticity') })}
          <div class="md-stats" aria-live="polite">
            <div><b class="pr-mono">${s.reps}</b><span>${esc(tx('repetições em 12 semanas', 'repetitions in 12 weeks'))}</span></div>
            <div><b class="pr-mono">${s.reach ? tx(`dia ${s.reach}`, `day ${s.reach}`) : '> 84'}</b><span>${esc(tx('no modelo, chega a 90% do teto', 'in the model, reaches 90% of the ceiling'))}</span></div>
            <div><b class="pr-mono">${Math.round(s.A)}%</b><span>${esc(tx('ao fim de 12 semanas', 'after 12 weeks'))}</span></div>
          </div>
          <ul class="md-ins">${insights(s).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          ${illu('A forma da curva (sobe depressa e depois abranda) vem do estudo de Lally e colegas (2010); as velocidades que dependem da deixa, da fricção e da recompensa são inventadas para comparar desenhos. No estudo real, cada pessoa teve um ritmo muito diferente: de 18 a 254 dias.', 'The curve shape (rises fast, then slows) comes from Lally and colleagues\' study (2010); the speeds that depend on cue, friction and reward are made up to compare designs. In the real study, each person had a very different pace: from 18 to 254 days.')}
          <div class="md-sent pr-sheet">
            <p class="pr-kicker">${esc(tx('A tua intenção de implementação', 'Your implementation intention'))} ${Pr.srcTag('res')}</p>
            <p class="md-sent-t">${esc(sentence())}</p>
            <label class="md-f"><span>${esc(tx('Identidade (opcional): "Sou alguém que…"', 'Identity (optional): "I am someone who…"'))} ${Pr.srcTag('auth')}</span><input class="md-in" data-h="ident" maxlength="80" value="${esc(h.ident)}"></label>
            <div class="pr-row"><button type="button" class="btn btn-primary" data-hsave ${habits.length >= 8 ? 'disabled' : ''}>${ICON.plus}${esc(tx('Guardar e começar a registar', 'Save and start logging'))}</button>
              ${habits.length >= 8 ? `<span class="pr-sub">${esc(tx('Máximo de 8 hábitos. Apaga um para juntar outro.', 'Maximum of 8 habits. Delete one to add another.'))}</span>` : ''}</div>
          </div>
`;
    };
    const draw = (focusSel) => {
      const habits = get('habits', []);
      host.innerHTML = `
      <div class="md-presets"><span class="pr-kicker">${esc(tx('Começar de um exemplo', 'Start from an example'))}</span>${H_PRESETS.map(p => `<button type="button" class="chip" data-hp="${p.id}">${esc(L(p.l))}</button>`).join('')}</div>
      <div class="md-lab">
        <div class="md-ctl pr-sheet">
          <label class="md-f"><span>${esc(tx('O hábito', 'The habit'))}</span><input class="md-in" data-h="name" maxlength="80" value="${esc(h.name)}"></label>
          <label class="md-f"><span>${esc(tx('Depois de… (a âncora)', 'After… (the anchor)'))}</span><input class="md-in" data-h="anchor" maxlength="80" value="${esc(h.anchor)}" placeholder="${esc(tx('servir o café', 'pouring my coffee'))}"></label>
          <label class="md-f"><span>${esc(tx('Onde / quando', 'Where / when'))}</span><input class="md-in" data-h="where" maxlength="60" value="${esc(h.where)}"></label>
          <label class="md-f"><span>${esc(tx('Versão pequena (o mínimo que conta)', 'Small version (the minimum that counts)'))}</span><input class="md-in" data-h="tiny" maxlength="80" value="${esc(h.tiny)}"></label>
          <div class="md-f"><span>${esc(tx('Que deixa o dispara?', 'What cue triggers it?'))}</span>${seg('hc', [{ v: 'act', l: B('Uma ação de sempre', 'A routine action') }, { v: 'time', l: B('Hora ou sítio fixo', 'Fixed time or place') }, { v: 'none', l: B('Quando me lembrar', 'When I remember') }], h.cue, tx('Deixa', 'Cue'))}</div>
          <div class="md-f"><span>${esc(tx('Quão exigente é a ação?', 'How demanding is the action?'))}</span>${seg('hx', [{ v: 'easy', l: B('Simples', 'Simple') }, { v: 'mid', l: B('Média', 'Medium') }, { v: 'hard', l: B('Exigente', 'Demanding') }], h.cx, tx('Exigência', 'Demand'))}</div>
          ${range('days', tx('Vezes por semana', 'Times a week'), h.days, 1, 7)}
          ${range('fr', tx('Passos antes de começar (fricção)', 'Steps before starting (friction)'), h.fr, 0, 4)}
          <div class="md-f"><span>${esc(tx('Há uma satisfação imediata?', 'Is there an immediate satisfaction?'))}</span>${seg('hr', [{ v: 'yes', l: B('Sim', 'Yes') }, { v: 'no', l: B('Não', 'No') }], h.rew, tx('Recompensa', 'Reward'))}</div>
          <div class="md-f"><span>${esc(tx('E se falhares?', 'And if you miss?'))}</span>${seg('hm', [{ v: 'none', l: B('Sem falhas', 'No misses') }, { v: 'one', l: B('Falhar o dia 20', 'Miss day 20') }, { v: 'pause', l: B('Parar 2 semanas', 'Stop for 2 weeks') }], h.miss, tx('Falhas', 'Misses'))}</div>
        </div>
        <div class="md-out" data-out>${outHtml()}</div>
      </div>
      <div data-trk>${trackerHtml(habits)}</div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) { f.focus(); if (f.setSelectionRange && f.type === 'text') { const n = f.value.length; f.setSelectionRange(n, n); } } }
    };
    draw();
    host.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.h) { h[t.dataset.h] = t.value; save(); $('.md-sent-t', host).textContent = sentence(); return; }
      if (t.dataset.r) { h[t.dataset.r] = +t.value; save(); rv(host, t.dataset.r, t.value); $('[data-out]', host).innerHTML = outHtml(); }
    });
    host.addEventListener('click', e => {
      const p = e.target.closest('[data-hp]');
      if (p) { const x = H_PRESETS.find(q => q.id === p.dataset.hp); h = { name: L(x.name), anchor: L(x.anchor), where: L(x.where), tiny: L(x.tiny), cue: x.cue, cx: x.cx, days: x.days, fr: x.fr, rew: x.rew, ident: L(x.id2), miss: 'none' }; save(); draw(`[data-hp="${x.id}"]`); return; }
      for (const [a, k] of [['hc', 'cue'], ['hx', 'cx'], ['hr', 'rew'], ['hm', 'miss']]) {
        const b = e.target.closest(`[data-${a}]`); if (b) { h[k] = b.dataset[a]; save(); draw(`[data-${a}="${b.dataset[a]}"]`); return; }
      }
      if (e.target.closest('[data-hsave]')) {
        const list = get('habits', []); if (list.length >= 8) return;
        if (!h.tiny.trim() && !h.name.trim()) { Pr.toast(tx('Escreve pelo menos o hábito.', 'Write at least the habit.')); return; }
        list.push({ id: Pr.uid('h'), name: h.name.trim() || h.tiny.trim(), sent: sentence(), ident: h.ident.trim(), start: today(), ticks: [] });
        put('habits', list); draw(); Pr.toast(tx('Guardado. Marca os dias em que aconteceu.', 'Saved. Mark the days it happened.'));
        const tr = $('.md-track', host); if (tr) tr.scrollIntoView({ block: 'nearest', behavior: Pr.motionOk() ? 'smooth' : 'auto' });
        return;
      }
      trackerClick(e, host, () => { $('[data-trk]', host).innerHTML = trackerHtml(get('habits', [])); });
    });
  }

  /* registo de dias reais (últimos 14), por hábito guardado */
  function trackerHtml(habits) {
    if (!habits.length) return `<section class="pr-section md-track"><h2 class="pr-h3">${esc(tx('Os teus hábitos', 'Your habits'))}</h2><p class="pr-sub">${esc(tx('Ainda nenhum. Guarda o desenho acima para começares a marcar os dias reais.', 'None yet. Save the design above to start marking real days.'))}</p></section>`;
    const days = daysBack(14);
    return `<section class="pr-section md-track"><h2 class="pr-h3">${esc(tx('Os teus hábitos — últimos 14 dias', 'Your habits — last 14 days'))}</h2>
      <p class="pr-sub">${esc(tx('Marca os dias em que aconteceu (calendário real, neste browser).', 'Mark the days it happened (real calendar, in this browser).'))}</p>
      ${habits.map(x => { const n = days.filter(d => x.ticks.includes(isoDay(d))).length;
        return `<article class="md-hab" data-hid="${esc(x.id)}"><div class="md-hab-h"><b>${esc(x.name)}</b><span class="pr-mono">${n}/14</span>
          <button type="button" class="btn btn-sm btn-ghost" data-hdel="${esc(x.id)}" aria-label="${esc(tx('Apagar', 'Delete') + ': ' + x.name)}">${ICON.x}</button></div>
          <p class="md-hab-s">${esc(x.sent)}${x.ident ? ` · <i>${esc(tx('Sou alguém que', 'I am someone who'))} ${esc(x.ident)}</i>` : ''}</p>
          <div class="md-days" role="group" aria-label="${esc(tx('Dias', 'Days'))}">${days.map(d => { const k = isoDay(d), on = x.ticks.includes(k);
            return `<button type="button" class="md-day${on ? ' on' : ''}${k === today() ? ' today' : ''}" data-tick="${k}" aria-pressed="${on}" aria-label="${esc(fmtD(d, { weekday: 'long', day: 'numeric', month: 'long' }))}"><small>${esc(fmtD(d, { weekday: 'narrow' }))}</small>${d.getDate()}</button>`; }).join('')}</div></article>`; }).join('')}
    </section>`;
  }
  function trackerClick(e, host, redraw) {
    const t = e.target.closest('[data-tick]');
    if (t) {
      const id = t.closest('[data-hid]').dataset.hid, list = get('habits', []), x = list.find(q => q.id === id); if (!x) return;
      const k = t.dataset.tick; x.ticks = x.ticks.includes(k) ? x.ticks.filter(q => q !== k) : x.ticks.concat([k]).slice(-120);
      put('habits', list); redraw(); const again = $(`[data-hid="${id}"] [data-tick="${k}"]`, host); if (again) again.focus();
      return true;
    }
    const d = e.target.closest('[data-hdel]');
    if (d) { put('habits', get('habits', []).filter(q => q.id !== d.dataset.hdel)); redraw(); Pr.toast(tx('Hábito apagado.', 'Habit deleted.')); return true; }
    return false;
  }

  /* quebrar: as quatro leis ao contrário + substituição */
  const BRK = [
    { law: B('Torná-lo invisível', 'Make it invisible'), opts: [B('Tirar a deixa do caminho (app fora do ecrã inicial, doces fora da vista)', 'Move the cue out of the way (app off the home screen, sweets out of sight)'), B('Desligar as notificações que o disparam', 'Turn off the notifications that trigger it')] },
    { law: B('Torná-lo pouco atrativo', 'Make it unattractive'), opts: [B('Escrever o custo real numa frase e tê-la à vista', 'Write the real cost in one sentence and keep it visible'), B('Juntar-me a quem não o faz', 'Spend time with people who do not do it')] },
    { law: B('Torná-lo difícil', 'Make it difficult'), opts: [B('Acrescentar passos: terminar a sessão, guardar noutra divisão', 'Add steps: log out, keep it in another room'), B('Usar um bloqueador com horário', 'Use a scheduled blocker')] },
    { law: B('Torná-lo insatisfatório', 'Make it unsatisfying'), opts: [B('Combinar uma consequência com alguém', 'Agree a consequence with someone'), B('Registar cada vez que acontece (ver o padrão incomoda)', 'Log each time it happens (seeing the pattern stings)')] },
  ];
  function breakLab(host) {
    let b = Object.assign({ name: tx('Abrir o email logo ao acordar', 'Opening email as soon as I wake up'), cue: tx('pegar no telemóvel na cama', 'picking up the phone in bed'), sub: tx('ler os Big 3 de ontem no caderno', 'read yesterday\'s Big 3 in the notebook'), pick: [] }, get('hbreak', {}));
    const save = () => put('hbreak', b);
    const plan = () => [`${tx('Hábito a quebrar', 'Habit to break')}: ${b.name}`, `${tx('Deixa', 'Cue')}: ${b.cue}`,
      ...b.pick.map(k => { const [i, j] = k.split('.').map(Number); return `• ${L(BRK[i].law)}: ${L(BRK[i].opts[j])}`; }),
      `${tx('Mesma deixa, nova resposta', 'Same cue, new response')}: ${tx('quando', 'when')} ${b.cue}, ${tx('vou', 'I will')} ${b.sub}.`].join('\n');
    const draw = () => {
      host.innerHTML = `<div class="md-lab">
        <div class="md-ctl pr-sheet">
          <label class="md-f"><span>${esc(tx('O hábito que queres largar', 'The habit you want to drop'))}</span><input class="md-in" data-b="name" maxlength="80" value="${esc(b.name)}"></label>
          <label class="md-f"><span>${esc(tx('O que o dispara (a deixa)', 'What triggers it (the cue)'))}</span><input class="md-in" data-b="cue" maxlength="80" value="${esc(b.cue)}"></label>
          <label class="md-f"><span>${esc(tx('Em vez disso, vou… (mesma deixa)', 'Instead, I will… (same cue)'))}</span><input class="md-in" data-b="sub" maxlength="80" value="${esc(b.sub)}"></label>
          <p class="pr-sub">${esc(tx('Hábitos antigos não se apagam: a deixa continua a disparar. Por isso funciona melhor afastar a deixa ou pôr outra resposta no lugar.', 'Old habits do not get erased: the cue keeps firing. That is why moving the cue away or putting another response in its place works better.'))} ${Pr.srcTag('res')}</p>
        </div>
        <div class="md-out">
          ${BRK.map((x, i) => `<fieldset class="md-brk"><legend>${esc(L(x.law))} ${Pr.srcTag('auth')}</legend>${x.opts.map((o, j) => `<label class="lr-toggle"><input type="checkbox" data-bk="${i}.${j}" ${b.pick.includes(`${i}.${j}`) ? 'checked' : ''}> ${esc(L(o))}</label>`).join('')}</fieldset>`).join('')}
          <div class="md-sent pr-sheet"><p class="pr-kicker">${esc(tx('O teu plano', 'Your plan'))}</p><pre class="md-pre" data-bplan>${esc(plan())}</pre>
            <p class="pr-sub">${esc(b.pick.length ? tx(`${b.pick.length === 1 ? '1 mudança escolhida' : b.pick.length + ' mudanças escolhidas'}. Começa pela de ambiente: é a que menos depende de ti no momento.`, `${b.pick.length === 1 ? '1 change' : b.pick.length + ' changes'} chosen. Start with the environmental one: it relies on you least in the moment.`) : tx('Escolhe pelo menos uma mudança de ambiente.', 'Pick at least one environmental change.'))}</p></div>
        </div></div>`;
    };
    draw();
    host.addEventListener('input', e => { const k = e.target.dataset.b; if (!k) return; b[k] = e.target.value; save(); $('[data-bplan]', host).textContent = plan(); });
    host.addEventListener('change', e => { const k = e.target.dataset.bk; if (!k) return; b.pick = e.target.checked ? b.pick.concat([k]) : b.pick.filter(x => x !== k); save(); draw(); $(`[data-bk="${k}"]`, host).focus(); });
  }

  /* ════════════════ 2 · Porque estou a adiar isto? ════════════════ */
  const P_F = [
    { k: 'avers', l: B('Desconforto ao começar', 'Discomfort in starting'), h: B('aborrecido, frustrante, ansioso', 'boring, frustrating, anxious') },
    { k: 'unc', l: B('Incerteza', 'Uncertainty'), h: B('1 = sei o primeiro passo · 5 = não faço ideia', '1 = I know the first step · 5 = no idea') },
    { k: 'conf', l: B('Confiança em conseguir', 'Confidence I can do it'), h: B('expectativa', 'expectancy') },
    { k: 'val', l: B('Quanto me importa o resultado', 'How much the outcome matters'), h: B('valor', 'value') },
    { k: 'imp', l: B('Distraio-me facilmente', 'I get distracted easily'), h: B('impulsividade', 'impulsiveness') },
  ];
  const P_FIX = {
    avers: B('Quando o que pesa é o desconforto, fugir alivia o humor só por agora: começa por 10 minutos com hora marcada e dá nome ao que sentes ("é aborrecido", "tenho medo de que fique mal").', 'When discomfort is what weighs, escaping only eases the mood for now: start with 10 minutes at a set time and name what you feel ("it is boring", "I fear it will be bad").'),
    unc: B('Quando não sabes por onde começar, escreve a próxima ação física — o verbo e o objeto (GTD). Se não consegues, a próxima ação é "decidir…" ou "perguntar a…".', 'When you do not know where to start, write the next physical action — the verb and the object (GTD). If you cannot, the next action is "decide…" or "ask…".'),
    conf: B('Quando falta confiança em conseguir, parte em passos que sabes fazer, pede um exemplo de "bem feito", ou faz primeiro a parte mais fácil para ganhar balanço.', 'When you lack confidence you can do it, split it into steps you know how to do, ask for an example of "done well", or do the easiest part first to build momentum.'),
    val: B('Quando o resultado te importa pouco, liga a tarefa a um porquê que te diga algo — ou admite que não importa e larga, delega ou faz a versão mínima.', 'When the outcome matters little to you, link the task to a why that means something — or admit it does not matter and drop, delegate or do the minimum version.'),
    imp: B('Quando a distração ganha, não lutes com ela no momento: tira a tentação do ambiente antes de começar (telemóvel noutra divisão, separadores fechados).', 'When distraction wins, do not fight it in the moment: remove the temptation from the environment before starting (phone in another room, tabs closed).'),
  };
  const P_DEF = () => ({ src: 'mine', own: tx('Escrever o relatório trimestral', 'Write the quarterly report'), wid: '', avers: 3, unc: 4, conf: 3, val: 3, imp: 3, days: 14, fx: [], step: '' });

  /* TMT (Steel & König 2006), forma ilustrativa: M = E·V / (1 + Γ·D) contra uma alternativa imediata */
  function procSim(p) {
    const fx = p.fx || [];
    const unc = fx.includes('step') ? 1 : p.unc, avers = Math.max(1, p.avers - (fx.includes('step') ? 1 : 0));
    const E = (p.conf / 5) * (1 - 0.12 * (unc - 1));
    const V = Math.min(1, (p.val / 5) * (1 - 0.12 * (avers - 1)) + (fx.includes('bundle') ? 0.06 : 0));
    const G = 0.25 + 0.3 * (p.imp - 1);
    const alt = 0.16 * (fx.includes('away') ? 0.55 : 1);
    const N = p.days, seg = fx.includes('mile') ? Math.max(1, Math.ceil(N / 3)) : N;
    const M = left => { const toNext = fx.includes('mile') ? (left % seg) : left; return (E * V) / (1 + G * toNext); };
    const pts = []; let start = null;
    for (let d = 0; d <= N; d++) { const left = N - d, m = M(left); pts.push([d, m]); if (start == null && m >= alt) start = d; }
    return { pts, start, alt, E, V, G, N };
  }
  function procWorst(p) { const sc = { avers: p.avers - 1, unc: p.unc - 1, conf: 5 - p.conf, val: 5 - p.val, imp: p.imp - 1 }; return Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0]; }

  function procPage(rest, el) {
    PrShell.setArea('experimentar', tx('Porque estou a adiar isto?', 'Why am I putting this off?'));
    el.innerHTML = `<div class="pr-wrap pr-page md-page">
      ${head('experimentar', tx('Porque estou a adiar isto?', 'Why am I putting this off?'), tx('Porque estou a adiar isto?', 'Why am I putting this off?'),
        tx('Escolhe uma tarefa que andas a empurrar — tua ou do mundo de exemplo. Diz o que sentes em relação a ela e vê, num modelo simples, quando é que a vontade de a fazer passa a vencer a alternativa. Depois experimenta as intervenções.', 'Pick a task you keep pushing back — yours or from the sample world. Say how you feel about it and see, in a simple model, when the urge to do it starts beating the alternative. Then try the interventions.'), ['res', 'est'])}
      <div data-phost></div>
      ${mine('proc')}
      ${applyBox([
        'Antes de "me organizar melhor", pergunta: o que é que esta tarefa me faz sentir?',
        'Escreve a próxima ação física. Se não sabes qual é, essa é a primeira tarefa.',
        'Parte prazos longos em prazos intermédios com alguém à espera de cada parte.',
        'Muda o ambiente antes de começar; não negoceies com a tentação a meio.'],
        ['Before "getting more organised", ask: what does this task make me feel?',
        'Write the next physical action. If you do not know what it is, that is the first task.',
        'Split long deadlines into intermediate ones with someone waiting for each part.',
        'Change the environment before starting; do not negotiate with temptation halfway.'],
        [{ href: '#aprender/adiar', l: B('Capítulo: Agora contra depois', 'Chapter: Now versus later') }, { href: '#aplicar/hoje', l: B('Pôr nos Big 3 de hoje', 'Put it in today\'s Big 3') }])}
      <div class="pr-section">${PrApp.worldBar('mind')}</div>
    </div>`;
    const host = $('[data-phost]', el);
    let p = Object.assign(P_DEF(), get('proc', {}));
    const save = () => put('proc', p);
    const taskName = () => { if (p.src === 'world') { const t = W.tasks().find(x => x.id === p.wid); return t ? L(t.t) : ''; } return p.own; };
    const outHtml = () => {
      const s = procSim(p), base = procSim(Object.assign({}, p, { fx: [] })), worst = procWorst(p);
      const startTxt = st => st == null ? tx('não começas antes do prazo', 'you do not start before the deadline') : st === s.N ? tx('só começas no próprio dia', 'you only start on the day itself') : tx(`começas a ${s.N - st} dias do prazo`, `you start ${s.N - st} days before the deadline`);
      return `          ${chart({ title: tx('Vontade de fazer a tarefa ao longo dos dias, contra a alternativa', 'Urge to do the task over the days, against the alternative'), x0: 0, x1: s.N, y0: 0, y1: Math.max(s.alt * 1.5, ...s.pts.map(q => q[1]), ...base.pts.map(q => q[1])) * 1.12,
            xt: [0, Math.round(s.N / 2), s.N], xf: x => x === s.N ? tx('prazo', 'deadline') : x === 0 ? tx('hoje', 'today') : tx(`dia ${x}`, `day ${x}`), yt: [],
            series: [{ pts: [[s.N, s.alt], [0, s.alt]], cls: 'md-salt', label: tx('a alternativa (ver séries, redes…)', 'the alternative (shows, social media…)'), dy: -7 }].concat(p.fx.length ? [{ pts: base.pts, cls: 'md-sref', label: '' }] : []).concat([{ pts: s.pts, cls: 'md-s1', label: tx('esta tarefa', 'this task'), dy: -8 }]),
            vlines: s.start != null ? [{ x: s.start, cls: 'md-start', label: tx('começas', 'you start'), end: s.start > s.N * 0.7 }] : [], yl: tx('vontade', 'urge'), pr: 70 })}
          <p class="md-verdict" aria-live="polite"><b>${esc(taskName() || tx('Esta tarefa', 'This task'))}</b> — ${esc(tx('neste modelo,', 'in this model,'))} <b>${esc(startTxt(s.start))}</b>${p.fx.length && base.start !== s.start ? esc(tx(` (sem intervenções: ${startTxt(base.start)})`, ` (without interventions: ${startTxt(base.start)})`)) : ''}.</p>
          <div class="md-diag"><p class="pr-kicker">${esc(tx('Pela tua avaliação, o que mais pesa', 'By your own rating, what weighs most'))}: ${esc(L(P_F.find(f => f.k === worst).l))}</p><p>${esc(L(P_FIX[worst]))}</p></div>
          <fieldset class="md-fx"><legend>${esc(tx('Experimenta intervenções', 'Try interventions'))}</legend>
            ${[['step', B('Primeiro passo de 10 minutos, concreto', 'A concrete 10-minute first step'), 'est'], ['mile', B('Dois prazos intermédios', 'Two intermediate deadlines'), 'res'], ['bundle', B('Juntar a algo de que gosto', 'Pair it with something I enjoy'), 'res'], ['away', B('Afastar a tentação antes de começar', 'Remove the temptation before starting'), 'tip']]
              .map(([k, l, t]) => `<label class="lr-toggle"><input type="checkbox" data-fx="${k}" ${p.fx.includes(k) ? 'checked' : ''}> ${esc(L(l))} ${Pr.srcTag(t)}</label>`).join('')}
            ${p.fx.includes('bundle') ? `<p class="pr-sub">${esc(tx('Efeito pequeno de propósito: num ensaio grande, juntar a tarefa a um prazer ajudou pouco.', 'Small effect on purpose: in a large trial, pairing the task with a treat helped only a little.'))}</p>` : ''}
          </fieldset>
          ${illu('A estrutura vem da teoria da motivação temporal de Steel e König: a vontade sobe com a expectativa e o valor e desce com a impulsividade e o atraso. Este modelo usa expectativa × valor ÷ (1 + impulsividade × atraso) — o "1 +" é uma escolha nossa para o último dia não dividir por zero —, e o efeito de cada intervenção é inventado. Serve para ver as alavancas, não para prever o teu dia nem provar que uma intervenção funciona contigo.', 'The structure comes from Steel and König\'s temporal motivation theory: the urge rises with expectancy and value and falls with impulsiveness and delay. This model uses expectancy × value ÷ (1 + impulsiveness × delay) — the "1 +" is our choice so the last day does not divide by zero — and the effect of each intervention is made up. It shows the levers; it neither predicts your day nor proves an intervention works for you.')}
          <div class="md-sent pr-sheet"><p class="pr-kicker">${esc(tx('O primeiro passo (começa por um verbo)', 'The first step (start with a verb)'))}</p>
            <div class="pr-row"><input class="md-in" data-p="step" maxlength="120" value="${esc(p.step)}" placeholder="${esc(tx('Ex.: Abrir o relatório do ano passado e copiar a estrutura', "E.g. Open last year's report and copy the structure"))}" aria-label="${esc(tx('Primeiro passo', 'First step'))}">
              <button type="button" class="btn btn-primary" data-pworld>${ICON.plus}${esc(tx('Pôr na lista de hoje (mundo de exemplo)', 'Add to today\'s list (sample world)'))}</button></div>
            <p class="pr-sub">${esc(tx('Fica no mundo de exemplo, marcado como deste laboratório; repões em baixo.', 'It goes into the sample world, tagged as from this lab; reset it below.'))}</p></div>
`;
    };
    const draw = (focusSel) => {
      const wt = worldTasks().slice(0, 14);
      if (p.src === 'world' && !wt.some(t => t.id === p.wid)) p.wid = wt.length ? wt[0].id : '';
      host.innerHTML = `<div class="md-lab">
        <div class="md-ctl pr-sheet">
          <div class="md-f"><span>${esc(tx('A tarefa', 'The task'))}</span>${seg('ps', [{ v: 'mine', l: B('Uma minha', 'One of mine') }, { v: 'world', l: B('Do mundo de exemplo', 'From the sample world') }], p.src, tx('Origem', 'Source'))}</div>
          ${p.src === 'mine' ? `<label class="md-f"><span class="pr-vh">${esc(tx('A tua tarefa', 'Your task'))}</span><input class="md-in" data-p="own" maxlength="100" value="${esc(p.own)}"></label>`
            : wt.length ? `<label class="md-f"><span class="pr-vh">${esc(tx('Tarefa do mundo de exemplo', 'Sample-world task'))}</span><select class="md-in" data-psel>${wt.map(t => `<option value="${esc(t.id)}" ${t.id === p.wid ? 'selected' : ''}>${esc(L(t.t))}${t.due != null && t.due < W.clock() ? ' · ' + tx('atrasada', 'overdue') : ''}</option>`).join('')}</select></label>`
            : `<p class="pr-sub">${esc(tx('O mundo de exemplo não tem tarefas abertas.', 'The sample world has no open tasks.'))}</p>`}
          ${range('days', tx('Dias até ao prazo', 'Days until the deadline'), p.days, 2, 28)}
          ${P_F.map(f => range(f.k, L(f.l), p[f.k], 1, 5, L(f.h))).join('')}
        </div>
        <div class="md-out" data-out>${outHtml()}</div></div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.p) { p[t.dataset.p] = t.value; save(); if (t.dataset.p === 'own') { const v = $('.md-verdict b', host); if (v) v.textContent = t.value || tx('Esta tarefa', 'This task'); } return; }
      if (t.dataset.r) { p[t.dataset.r] = +t.value; save(); rv(host, t.dataset.r, t.value); $('[data-out]', host).innerHTML = outHtml(); }
    });
    host.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-psel]')) { p.wid = t.value; save(); draw('[data-psel]'); return; }
      if (t.dataset.fx) { p.fx = t.checked ? p.fx.concat([t.dataset.fx]) : p.fx.filter(x => x !== t.dataset.fx); save(); draw(`[data-fx="${t.dataset.fx}"]`); }
    });
    host.addEventListener('click', e => {
      const s = e.target.closest('[data-ps]'); if (s) { p.src = s.dataset.ps; save(); draw(`[data-ps="${p.src}"]`); return; }
      if (e.target.closest('[data-pworld]')) {
        const v = (p.step || '').trim();
        if (!v) { Pr.toast(tx('Escreve primeiro o passo.', 'Write the step first.')); $('[data-p="step"]', host).focus(); return; }
        if (!PrCapture.VERB_RX.test(v.split(/\s+/)[0])) Pr.toast(tx('Dica: começa por um verbo ("Abrir…", "Ligar…").', 'Tip: start with a verb ("Open…", "Call…").'));
        if (worldTask(v)) { p.step = ''; save(); draw(); Pr.toast(tx('Na lista de hoje do mundo de exemplo.', "On the sample world's list for today."), { label: tx('Ver os Big 3', 'See the Big 3'), run: () => { location.hash = '#aplicar/hoje'; } }); }
      }
    });
  }

  /* ════════════════ 3 · Foco ════════════════ */
  /* 3a · custo de troca: paridade vs. tamanho (paradigma clássico de task switching, versão curta) */
  const DIG = [1, 2, 3, 4, 6, 7, 8, 9];
  const RULE = {
    par: { l: B('Par ou ímpar?', 'Odd or even?'), a: B('Par', 'Even'), b: B('Ímpar', 'Odd'), left: n => n % 2 === 0, cls: 'k-info' },
    big: { l: B('Menor ou maior que 5?', 'Smaller or bigger than 5?'), a: B('Menor', 'Smaller'), b: B('Maior', 'Bigger'), left: n => n < 5, cls: 'k-act' },
  };
  function makeTrials() {
    const R = rng(Date.now() & 0xffff), pick = () => DIG[Math.floor(R() * DIG.length)], out = [];
    for (let i = 0; i < 12; i++) out.push({ blk: 'pure', rule: 'par', n: pick() });
    for (let i = 0; i < 12; i++) out.push({ blk: 'pure', rule: 'big', n: pick() });
    let prev = 'par';
    for (let i = 0; i < 28; i++) { const r = i === 0 ? 'par' : (R() < 0.5 ? (prev === 'par' ? 'big' : 'par') : prev); out.push({ blk: 'mix', rule: r, n: pick(), sw: i > 0 && r !== prev }); prev = r; }
    return out;
  }
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function focusPage(rest, el) {
    PrShell.setArea('experimentar', tx('Laboratório de foco', 'Focus lab'));
    el.innerHTML = `<div class="pr-wrap pr-page md-page">
      ${head('experimentar', tx('Laboratório de foco', 'Focus lab'), tx('Laboratório de foco', 'Focus lab'),
        tx('Duas experiências: medir, em ti, quanto custa trocar de regra; e desenhar um dia de trabalho para ver o que as interrupções e as reuniões fazem aos blocos de concentração.', 'Two experiments: measure, on yourself, what switching rules costs; and design a workday to see what interruptions and meetings do to blocks of concentration.'), ['res'])}
      <nav class="md-tabs" aria-label="${esc(tx('Experiência', 'Experiment'))}"><a href="#experimentar/foco" ${rest !== 'dia' ? 'aria-current="page"' : ''}>${esc(tx('Custo de troca', 'Switch cost'))}</a><a href="#experimentar/foco/dia" ${rest === 'dia' ? 'aria-current="page"' : ''}>${esc(tx('Desenhar um dia', 'Design a day'))}</a></nav>
      <div data-fhost></div>
      ${mine('focus,switch')}
      ${applyBox([
        'Agrupa o que é parecido (emails, chamadas, revisões) e trata cada grupo de uma vez.',
        'Antes de mudares de tarefa, escreve onde ficaste e a próxima ação — fecha o ciclo.',
        'Marca um bloco de foco por semana na revisão e protege-o como uma reunião.',
        'Pausas curtas ajudam a energia; trabalho exigente pode pedir pausas maiores. E dorme.'],
        ['Group similar things (email, calls, reviews) and handle each group in one go.',
        'Before switching tasks, write down where you stopped and the next action — close the loop.',
        'Book one focus block a week at the review and protect it like a meeting.',
        'Short breaks help energy; demanding work may need longer ones. And sleep.'],
        [{ href: '#aprender/foco', l: B('Capítulo: Foco, interrupções e energia', 'Chapter: Focus, interruptions and energy') }, { href: '#aplicar/revisao', l: B('O bloco de foco na revisão semanal', 'The focus block in the weekly review') }])}
    </div>`;
    const host = $('[data-fhost]', el);
    if (rest === 'dia') return dayLab(host);
    switchLab(host);
  }

  function switchLab(host) {
    let trials = null, i = 0, t0 = 0, res = [], wait = 0, phase = 'intro';
    const hist = () => get('switch', []);
    const finish = () => {
      const ok = r => r.ok && r.rt > 150 && r.rt < 4000;
      const pure = res.filter((r, j) => r.blk === 'pure' && ok(r) && j !== 0 && j !== 12).map(r => r.rt);
      const rep = res.filter((r, j) => r.blk === 'mix' && !r.sw && ok(r) && j !== 24).map(r => r.rt);
      const sw = res.filter(r => r.blk === 'mix' && r.sw && ok(r)).map(r => r.rt);
      const err = k => { const a = res.filter(k); return a.length ? Math.round(100 * a.filter(r => !r.ok).length / a.length) : 0; };
      const out = { d: today(), pure: median(pure), rep: median(rep), sw: median(sw), ePure: err(r => r.blk === 'pure'), eSw: err(r => r.blk === 'mix' && r.sw), eRep: err(r => r.blk === 'mix' && !r.sw), n: res.length };
      if (out.pure && out.sw) put('switch', hist().concat([out]).slice(-6));
      phase = 'done'; draw(out);
    };
    const next = () => {
      if (i >= trials.length) return finish();
      const tr = trials[i];
      if (i === 0 || i === 12 || i === 24) { phase = 'pause'; draw(); return; }
      show(tr);
    };
    const show = tr => {
      phase = 'run'; const R = RULE[tr.rule];
      const stage = $('[data-stage]', host); if (!stage) return;
      stage.innerHTML = `<p class="md-rule ${R.cls}">${esc(L(R.l))}</p><p class="md-digit" aria-live="assertive">${tr.n}</p>
        <div class="md-keys"><button type="button" class="btn" data-ans="a"><kbd>F</kbd> ${esc(L(R.a))}</button><button type="button" class="btn" data-ans="b">${esc(L(R.b))} <kbd>J</kbd></button></div>
        <p class="pr-sub pr-mono">${i + 1} / ${trials.length}</p>`;
      t0 = performance.now();
    };
    const answer = side => {
      if (phase !== 'run' || !trials) return;
      const tr = trials[i], rt = performance.now() - t0, ok = (side === 'a') === RULE[tr.rule].left(tr.n);
      res.push(Object.assign({}, tr, { rt, ok })); i++;
      phase = 'gap';
      const stage = $('[data-stage]', host);
      if (stage) { const d = $('.md-digit', stage); if (d) { d.textContent = ok ? '·' : '✕'; d.classList.toggle('bad', !ok); } }
      clearTimeout(wait); wait = setTimeout(next, ok ? 350 : 700);
    };
    const blockIntro = () => {
      const b = i === 0 ? { t: tx('Bloco 1 de 3 — só par ou ímpar', 'Block 1 of 3 — odd or even only'), d: tx('12 números. Esquerda (F) = par, direita (J) = ímpar.', '12 numbers. Left (F) = even, right (J) = odd.') }
        : i === 12 ? { t: tx('Bloco 2 de 3 — só menor ou maior que 5', 'Block 2 of 3 — smaller or bigger than 5 only'), d: tx('12 números. Esquerda (F) = menor, direita (J) = maior.', '12 numbers. Left (F) = smaller, right (J) = bigger.') }
        : { t: tx('Bloco 3 de 3 — misturado', 'Block 3 of 3 — mixed'), d: tx('28 números. A pergunta muda sem aviso — lê a cor e a pergunta antes de responder.', '28 numbers. The question changes without warning — read the colour and question before answering.') };
      return `<p class="pr-kicker">${esc(b.t)}</p><p>${esc(b.d)}</p><button type="button" class="btn btn-primary" data-go>${esc(tx('Começar o bloco', 'Start the block'))}</button>`;
    };
    function draw(out) {
      const h = hist();
      host.innerHTML = `<div class="md-lab md-lab-1">
        <div class="md-switch pr-sheet" data-stage tabindex="-1">${phase === 'intro' ? `
          <p class="pr-kicker">${esc(tx('Cerca de 2 minutos', 'About 2 minutes'))}</p>
          <p>${esc(tx('Vais ver números de 1 a 9. Por cima de cada um, uma pergunta: "par ou ímpar?" ou "menor ou maior que 5?". Responde o mais depressa que conseguires sem errar, com as teclas F e J (ou os botões). Primeiro dois blocos com uma só pergunta, depois um bloco misturado.',
            'You will see numbers from 1 to 9. Above each, a question: "odd or even?" or "smaller or bigger than 5?". Answer as fast as you can without mistakes, with the F and J keys (or the buttons). First two blocks with a single question, then a mixed block.'))}</p>
          <button type="button" class="btn btn-primary" data-start>${esc(tx('Começar', 'Start'))}</button>`
          : phase === 'pause' ? blockIntro()
          : phase === 'done' && out ? resultHtml(out) : ''}</div>
        ${h.length ? `<div class="md-hist"><p class="pr-kicker">${esc(tx('As tuas tentativas', 'Your attempts'))}</p><table class="pr-table"><thead><tr><th>${esc(tx('Dia', 'Day'))}</th><th>${esc(tx('Uma regra', 'One rule'))}</th><th>${esc(tx('Misto, repetir', 'Mixed, repeat'))}</th><th>${esc(tx('Misto, trocar', 'Mixed, switch'))}</th></tr></thead>
          <tbody>${h.slice().reverse().map(r => `<tr><td>${esc(r.d)}</td><td class="pr-mono">${Math.round(r.pure)} ms</td><td class="pr-mono">${r.rep ? Math.round(r.rep) + ' ms' : '—'}</td><td class="pr-mono">${Math.round(r.sw)} ms</td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>`;
    }
    const resultHtml = o => {
      const mx = Math.max(o.pure || 0, o.rep || 0, o.sw || 0) || 1, bar = (l, v, e, cls) => `<div class="md-bar"><span>${esc(l)}</span><i class="${cls}" style="width:${v ? Math.round(100 * v / mx) : 0}%"></i><b class="pr-mono">${v ? Math.round(v) + ' ms' : '—'}</b><small>${esc(tx(`${e}% erros`, `${e}% errors`))}</small></div>`;
      const cost = o.sw && o.rep ? Math.round(o.sw - o.rep) : null, mix = o.rep && o.pure ? Math.round(o.rep - o.pure) : null;
      return `<p class="pr-kicker">${esc(tx('O teu resultado (medianas)', 'Your result (medians)'))}</p>
        <div class="md-bars">${bar(tx('Uma só regra', 'One rule only'), o.pure, o.ePure, 'b1')}${bar(tx('Misto — mesma regra', 'Mixed — same rule'), o.rep, o.eRep, 'b2')}${bar(tx('Misto — regra trocou', 'Mixed — rule switched'), o.sw, o.eSw, 'b3')}</div>
        <p class="md-verdict">${cost != null ? `${esc(tx('Custo de troca:', 'Switch cost:'))} <b>${cost > 0 ? '+' : ''}${cost} ms</b>${mix != null ? ` · ${esc(tx('custo de ter duas regras em mente:', 'cost of holding two rules:'))} <b>${mix > 0 ? '+' : ''}${mix} ms</b>` : ''}` : esc(tx('Poucas respostas certas para calcular.', 'Too few correct answers to calculate.'))}</p>
        <p class="pr-sub">${esc(cost != null && cost > 0 ? tx('Neste teste, trocar de regra custou-te frações de segundo. Não dá para multiplicar este número pelas trocas de um dia de trabalho: tarefas reais são diferentes e somam outros custos, como o resíduo de atenção.', 'In this test, switching rules cost you fractions of a second. This number cannot be multiplied by a workday\'s switches: real tasks are different and add other costs, such as attention residue.') : tx('Desta vez a troca quase não custou — com tão poucas tentativas é normal variar muito. Repete e compara.', 'This time switching barely cost anything — with so few trials big swings are normal. Repeat and compare.'))}</p>
        ${illu('Esta é uma medição informal e curta (52 respostas, sem treino). Os laboratórios usam centenas de tentativas por pessoa; aqui o número serve para sentires o efeito, não para te comparares com ninguém.', 'This is a short, informal measurement (52 answers, no practice). Labs use hundreds of trials per person; here the number lets you feel the effect, not compare yourself with anyone.')}
        <button type="button" class="btn" data-start>${ICON.reset}${esc(tx('Repetir', 'Repeat'))}</button>`;
    };
    draw();
    host.addEventListener('click', e => {
      if (e.target.closest('[data-start]')) { trials = makeTrials(); i = 0; res = []; phase = 'pause'; draw(); $('[data-go]', host).focus(); return; }
      if (e.target.closest('[data-go]')) { const st = $('[data-stage]', host); show(trials[i]); st.focus(); return; }
      const a = e.target.closest('[data-ans]'); if (a) answer(a.dataset.ans);
    });
    const onKey = e => {
      if (!host.isConnected) { document.removeEventListener('keydown', onKey); clearTimeout(wait); return; }
      if (phase !== 'run' || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f' || e.key === 'ArrowLeft') { e.preventDefault(); answer('a'); }
      else if (k === 'j' || e.key === 'ArrowRight') { e.preventDefault(); answer('b'); }
    };
    document.addEventListener('keydown', onKey);
  }

  /* 3b · um dia de trabalho desenhado */
  const DAY_DEF = { notif: 4, mode: 'now', meet: 2, block: false, resume: 10 };
  function daySim(o) {
    const START = 9 * 60, END = 18 * 60, LUNCH = [13 * 60, 14 * 60];
    const ev = [];                                   // [ini, fim, tipo]
    ev.push([LUNCH[0], LUNCH[1], 'lunch']);
    const MEET = [[10 * 60 + 30, 60], [15 * 60, 30], [11 * 60 + 45, 45], [16 * 60 + 30, 30], [14 * 60 + 15, 30]];
    const block = o.block ? [9 * 60, 11 * 60] : null;
    MEET.slice(0, o.meet).forEach(([s, d]) => { let a = s; if (block && a < block[1]) a = block[1] + 15; ev.push([a, a + d, 'meet']); });
    const R = rng(11 + o.notif * 13);
    const notes = [];
    for (let m = START; m < END; m += 60) for (let k = 0; k < o.notif; k++) notes.push(m + Math.floor(R() * 60));
    const busy = t => ev.some(([a, b]) => t >= a && t < b);
    let handled = 0;
    if (o.mode === 'now') {
      notes.sort((a, b) => a - b).forEach(t => {
        if (busy(t) || (block && t >= block[0] && t < block[1])) return;      // em reunião / bloco: fica para depois
        ev.push([t, t + 2, 'int']); handled++;
        if (o.resume > 0) ev.push([t + 2, t + 2 + o.resume, 'res']);
      });
      if (block) { ev.push([block[1], block[1] + 6, 'int']); }               // o que se acumulou no bloco
    } else {
      [11 * 60 + 30, 14 * 60, 17 * 60 + 15].forEach(t => { let a = t; while (busy(a)) a += 15; ev.push([a, a + 12, 'int']); if (o.resume > 0) ev.push([a + 12, a + 12 + Math.round(o.resume / 2), 'res']); });
      handled = notes.length;
    }
    /* linha do tempo: o que não é ocupado é foco */
    const occ = new Array(END - START).fill('focus');
    ev.sort((a, b) => (a[2] === 'res') - (b[2] === 'res')).forEach(([a, b, k]) => { for (let t = Math.max(START, a); t < Math.min(END, b); t++) { const i = t - START; if (k === 'res' && occ[i] !== 'focus') continue; occ[i] = k; } });
    const segs = []; occ.forEach((k, i) => { const l = segs[segs.length - 1]; if (l && l.k === k) l.n++; else segs.push({ k, s: START + i, n: 1 }); });
    const focus = segs.filter(s => s.k === 'focus');
    return { segs, START, END, focusMin: focus.reduce((x, s) => x + s.n, 0), longest: Math.max(0, ...focus.map(s => s.n)), deep: focus.filter(s => s.n >= 60).length,
      lost: occ.filter(k => k === 'res').length, intMin: occ.filter(k => k === 'int').length, notes: notes.length, handled };
  }
  function dayLab(host) {
    let o = Object.assign({}, DAY_DEF, get('focus', {}));
    const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const NAMES = { focus: B('foco', 'focus'), meet: B('reunião', 'meeting'), int: B('interrupção', 'interruption'), res: B('a retomar', 'resuming'), lunch: B('almoço', 'lunch') };
    const outHtml = () => {
      const s = daySim(o), alt = daySim(Object.assign({}, o, { mode: o.mode === 'now' ? 'batch' : 'now' }));
      const span = s.END - s.START;
      return `          <div class="md-day-line" role="img" aria-label="${esc(tx(`Dia das 9:00 às 18:00: ${s.focusMin} minutos de foco, bloco mais longo ${s.longest} minutos.`, `Day from 9:00 to 18:00: ${s.focusMin} minutes of focus, longest block ${s.longest} minutes.`))}">
            ${s.segs.map(g => `<i class="md-dl-${g.k}" style="flex:${g.n}" title="${esc(hhmm(g.s) + ' · ' + L(NAMES[g.k]) + ' · ' + g.n + ' min')}"></i>`).join('')}</div>
          <div class="md-day-ax pr-mono" aria-hidden="true">${[9, 11, 13, 15, 17].map(hh => `<span style="left:${(hh * 60 - s.START) / span * 100}%${hh === 9 ? ';transform:none' : ''}">${hh}:00</span>`).join('')}</div>
          <p class="md-legend">${['focus', 'meet', 'int', 'res', 'lunch'].map(k => `<span><i class="md-dl-${k}"></i>${esc(L(NAMES[k]))}</span>`).join('')}</p>
          <div class="md-stats" aria-live="polite">
            <div><b class="pr-mono">${Math.floor(s.focusMin / 60)}h${String(s.focusMin % 60).padStart(2, '0')}</b><span>${esc(tx('de foco no dia', 'of focus in the day'))}</span></div>
            <div><b class="pr-mono">${s.longest} min</b><span>${esc(tx('bloco mais longo', 'longest block'))}</span></div>
            <div><b class="pr-mono">${s.deep}</b><span>${esc(tx('blocos de 1 h ou mais', 'blocks of 1h or more'))}</span></div>
            <div><b class="pr-mono">${s.lost} min</b><span>${esc(tx('a retomar (suposição)', 'resuming (assumption)'))}</span></div>
          </div>
          <ul class="md-ins">
            <li>${esc(o.mode === 'now' ? tx(`Respondendo em lotes, o mesmo dia teria ${alt.longest} min de bloco mais longo e ${alt.deep} blocos de 1 h ou mais.`, `Answering in batches, the same day would have a ${alt.longest}-min longest block and ${alt.deep} blocks of 1h or more.`) : tx(`Respondendo logo, o bloco mais longo cairia para ${alt.longest} min.`, `Answering right away, the longest block would drop to ${alt.longest} min.`))}</li>
            ${o.meet >= 3 ? `<li>${esc(tx('Reuniões espalhadas cortam a tarde em pedaços. Juntá-las seguidas deixa outra parte do dia inteira.', 'Scattered meetings cut the afternoon into pieces. Putting them back to back leaves another part of the day whole.'))}</li>` : ''}
            ${!o.block ? `<li>${esc(tx('Experimenta o bloco protegido: duas horas sem notificações, com o que se acumulou tratado no fim.', 'Try the protected block: two hours with no notifications, with whatever piled up handled at the end.'))}</li>` : ''}
            <li>${esc(tx('O que esta simulação não mostra: no estudo de Gloria Mark, quem era interrompido compensava trabalhando mais depressa — e pagava em stress e frustração.', 'What this simulation does not show: in Gloria Mark\'s study, interrupted people compensated by working faster — and paid in stress and frustration.'))} ${Pr.srcTag('res')}</li>
          </ul>
          ${illu('A agenda é inventada e as notificações caem ao acaso (sempre o mesmo acaso, para poderes comparar). O tempo para retomar é uma suposição tua: a investigação mostra que existe um custo, mas ele varia muito com a tarefa e a pessoa.', 'The schedule is made up and notifications fall at random (always the same randomness, so you can compare). The time to get back is your assumption: research shows a cost exists, but it varies a lot by task and person.')}
`;
    };
    const draw = (focusSel) => {
      host.innerHTML = `<div class="md-lab">
        <div class="md-ctl pr-sheet">
          ${range('notif', tx('Notificações por hora', 'Notifications per hour'), o.notif, 0, 12)}
          <div class="md-f"><span>${esc(tx('Quando lhes respondes', 'When you answer them'))}</span>${seg('dm', [{ v: 'now', l: B('Logo que chegam', 'As they arrive') }, { v: 'batch', l: B('Em 3 lotes por dia', 'In 3 batches a day') }], o.mode, tx('Resposta', 'Response'))}</div>
          ${range('meet', tx('Reuniões', 'Meetings'), o.meet, 0, 5)}
          <label class="lr-toggle"><input type="checkbox" data-dblock ${o.block ? 'checked' : ''}> ${esc(tx('Bloco de foco protegido 9:00–11:00', 'Protected focus block 9:00–11:00'))}</label>
          ${range('resume', tx('Minutos para retomar depois de cada interrupção', 'Minutes to get back after each interruption'), o.resume, 0, 25, tx('uma suposição tua — não é um número medido', 'your assumption — not a measured number'))}
        </div>
        <div class="md-out" data-out>${outHtml()}</div></div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('input', e => { const r = e.target.dataset.r; if (!r) return; o[r] = +e.target.value; put('focus', o); rv(host, r, e.target.value); $('[data-out]', host).innerHTML = outHtml(); });
    host.addEventListener('change', e => { if (e.target.matches('[data-dblock]')) { o.block = e.target.checked; put('focus', o); draw('[data-dblock]'); } });
    host.addEventListener('click', e => { const m = e.target.closest('[data-dm]'); if (m) { o.mode = m.dataset.dm; put('focus', o); draw(`[data-dm="${o.mode}"]`); } });
  }

  Pr.route('experimentar/habito', habitPage);
  Pr.route('experimentar/adiar', procPage);
  Pr.route('experimentar/foco', focusPage);

  return { get, put, clr, head, illu, mine, applyBox, chLink, seg, range, chart, rng, isoDay, today, daysBack, fmtD, worldTask, worldTasks, median, habitSim, procWorst, P_F, P_FIX, trackerHtml, trackerClick };
})();
