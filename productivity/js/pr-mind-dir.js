/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — laboratórios "Dirigir" + revisão pessoal
   ──────────────────────────────────────────────────────────────────
     experimentar/decidir       calibrar estimativas · enquadramento · pré-mortem
     experimentar/motivacao     redesenhar uma tarefa (autonomia, competência…)
     experimentar/prioridades   controlo/influência · armadilha da urgência · de trás para a frente
     aplicar/revisao-pessoal    hábitos, energia, adiamentos e prioridades — 10 min
   Usa os utilitários de PrMind (pr-mind.js). Dados pessoais em 'pr-mind-v1'.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON } = Pr;
  const W = PrWorld, M = PrMind;
  const B = (pt, en) => ({ pt, en });
  const { get, put, head, illu, mine, applyBox, seg, range, chart, median, today } = M;
  const rv = (root, name, v) => { const b = root.querySelector(`[data-rv="${name}"]`); if (b) b.textContent = v; };
  const tabs = (base, cur, list, label) => `<nav class="md-tabs" aria-label="${esc(label)}">${list.map(([id, l]) => `<a href="#${base}${id ? '/' + id : ''}" ${cur === id ? 'aria-current="page"' : ''}>${esc(L(l))}</a>`).join('')}</nav>`;
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  /* "já no mundo" só é verdade enquanto o item criado existir: repor a experiência 'mind' apaga-o */
  const inWorld = id => typeof id === 'string' && (W.state().tasks.some(t => t.id === id) || W.recs('notes').some(n => n.id === id));
  const projects = () => W.recs('projects').filter(p => p.status !== 'done');
  const copyText = async (txt, btn) => {
    try { await navigator.clipboard.writeText(txt); Pr.toast(tx('Copiado.', 'Copied.')); }
    catch (_) { const pre = btn && btn.closest('section, .md-sent, .pr-sheet') && btn.closest('section, .md-sent, .pr-sheet').querySelector('pre'); if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } Pr.toast(tx('Seleccionado — copia com Ctrl+C.', 'Selected — copy with Ctrl+C.')); }
  };

  /* ════════════════ 4 · Decidir ════════════════ */
  const EST_EX = [
    { t: B('Escrever o resumo da reunião', 'Write the meeting summary'), e: 15, a: 25 }, { t: B('Rever o pedido de alteração', 'Review the change request'), e: 30, a: 45 },
    { t: B('Preparar os diapositivos', 'Prepare the slides'), e: 60, a: 110 }, { t: B('Responder aos emails da manhã', 'Answer the morning emails'), e: 20, a: 35 },
    { t: B('Corrigir o erro do relatório', 'Fix the report bug'), e: 45, a: 40 }, { t: B('Planear a semana', 'Plan the week'), e: 20, a: 30 },
  ];
  function decPage(rest, el) {
    PrShell.setArea('experimentar', tx('Laboratório de decisões', 'Decision lab'));
    const cur = ['enquadramento', 'premortem'].includes(rest) ? rest : '';
    el.innerHTML = `<div class="pr-wrap pr-page md-page">
      ${head('experimentar', tx('Laboratório de decisões', 'Decision lab'), tx('Laboratório de decisões', 'Decision lab'),
        tx('Três ferramentas contra erros de julgamento conhecidos: calibrar as tuas estimativas com o teu próprio histórico, ver o efeito do enquadramento em ti, e fazer um pré-mortem a um projeto.', 'Three tools against known judgement errors: calibrate your estimates with your own track record, see the framing effect on yourself, and run a premortem on a project.'), ['res', 'auth'])}
      ${tabs('experimentar/decidir', cur, [['', B('Calibrar estimativas', 'Calibrate estimates')], ['enquadramento', B('Ganho ou perda?', 'Gain or loss?')], ['premortem', B('Pré-mortem', 'Premortem')]], tx('Ferramenta', 'Tool'))}
      <div data-dhost></div>
      ${mine('est,estNext,frame,pm')}
      ${applyBox([
        'Durante duas semanas, anota a estimativa antes e o tempo real depois. O teu multiplicador vale mais do que qualquer regra geral.',
        'Estima antes de ouvires a estimativa de outra pessoa.',
        'Antes de decidir, descreve a escolha como ganho e como perda.',
        'No arranque de um projeto: 10 minutos a imaginar que falhou. Cada razão com ação vira tarefa.'],
        ['For two weeks, write down the estimate before and the real time after. Your multiplier beats any general rule.',
        'Estimate before you hear someone else\'s estimate.',
        'Before deciding, describe the choice as a gain and as a loss.',
        'At a project kick-off: 10 minutes imagining it failed. Every reason with an action becomes a task.'],
        [{ href: '#aprender/decidir', l: B('Capítulo: Como julgamos', 'Chapter: How we judge') }, { href: '#aplicar/hoje', l: B('A capacidade nos Big 3', 'Capacity in the Big 3') }])}
      ${cur === 'premortem' ? `<div class="pr-section">${PrApp.worldBar('mind')}</div>` : ''}
    </div>`;
    const host = $('[data-dhost]', el);
    if (cur === 'enquadramento') return frameLab(host);
    if (cur === 'premortem') return pmLab(host);
    estLab(host);
  }

  function estLab(host) {
    const list = () => get('est', []);
    const stats = l => { const r = l.filter(x => x.e > 0 && x.a > 0).map(x => x.a / x.e); return { n: r.length, mult: median(r), within: r.length ? Math.round(100 * r.filter(x => x <= 1).length / r.length) : 0 }; };
    const draw = (focusSel) => {
      const l = list(), s = stats(l), mx = Math.max(60, ...l.map(x => Math.max(x.e, x.a))) * 1.1;
      const nxt = +(get('estNext', 0)) || 0;
      host.innerHTML = `<div class="md-lab">
        <div class="md-ctl pr-sheet">
          <form data-eadd class="md-eform">
            <label class="md-f"><span>${esc(tx('Tarefa', 'Task'))}</span><input class="md-in" name="t" maxlength="80" required placeholder="${esc(tx('Ex.: Rever o contrato', 'E.g. Review the contract'))}"></label>
            <div class="md-two"><label class="md-f"><span>${esc(tx('Estimativa (min)', 'Estimate (min)'))}</span><input class="md-in md-num" name="e" type="number" min="1" max="2000" required inputmode="numeric"></label>
            <label class="md-f"><span>${esc(tx('Real (min)', 'Actual (min)'))}</span><input class="md-in md-num" name="a" type="number" min="1" max="5000" inputmode="numeric" placeholder="${esc(tx('depois', 'later'))}"></label></div>
            <button class="btn btn-primary" type="submit">${ICON.plus}${esc(tx('Registar', 'Log it'))}</button>
          </form>
          <p class="pr-sub">${esc(tx('Podes registar a estimativa agora e o tempo real depois.', 'You can log the estimate now and the actual time later.'))}</p>
          ${!l.length ? `<button type="button" class="btn btn-sm" data-eex>${esc(tx('Carregar 6 registos de exemplo', 'Load 6 example entries'))}</button>` : ''}
        </div>
        <div class="md-out">
          ${chart({ title: tx('Estimativa contra tempo real', 'Estimate against actual time'), x0: 0, x1: mx, y0: 0, y1: mx, h: 260, w: 420, xt: [0, Math.round(mx / 2), Math.round(mx)], yt: [Math.round(mx / 2), Math.round(mx)],
            series: [{ pts: [[0, 0], [mx, mx]], cls: 'md-sref', label: tx('certo', 'on target'), dy: 14 }].concat(s.mult ? [{ pts: [[0, 0], [mx / Math.max(1, s.mult), mx]], cls: 'md-s2', label: '×' + s.mult.toFixed(1).replace('.', tx(',', '.')), dy: 4 }] : []),
            dots: l.filter(x => x.a).map(x => ({ x: x.e, y: x.a, cls: x.a > x.e ? 'late' : 'ok' })), xl: tx('estimativa (min)', 'estimate (min)'), yl: tx('real (min)', 'actual (min)') })}
          <div class="md-stats" aria-live="polite">
            <div><b class="pr-mono">${s.n}</b><span>${esc(tx('tarefas com tempo real', 'tasks with actual time'))}</span></div>
            <div><b class="pr-mono">${s.mult ? '×' + s.mult.toFixed(2).replace('.', tx(',', '.')) : '—'}</b><span>${esc(tx('o teu multiplicador (mediana real ÷ estimativa)', 'your multiplier (median actual ÷ estimate)'))}</span></div>
            <div><b class="pr-mono">${s.n ? s.within + '%' : '—'}</b><span>${esc(tx('acabadas dentro da estimativa', 'finished within the estimate'))}</span></div>
          </div>
          ${s.n >= 3 ? `<div class="md-sent pr-sheet"><p class="pr-kicker">${esc(tx('A próxima estimativa', 'The next estimate'))} ${Pr.srcTag('est')}</p>
            <div class="pr-row"><label>${esc(tx('A minha intuição:', 'My gut says:'))} <input class="md-in md-num" type="number" min="1" max="2000" data-enext value="${nxt || ''}" inputmode="numeric"> min</label>
            <span data-ecorr class="md-verdict">${nxt ? esc(tx(`Com o teu histórico: cerca de ${Math.round(nxt * s.mult)} min.`, `With your track record: about ${Math.round(nxt * s.mult)} min.`)) : ''}</span></div>
            <p class="pr-sub">${esc(tx('É a "classe de referência" em pequeno: em vez de imaginares os passos, usas o que tarefas parecidas te custaram. Com poucos registos o multiplicador muda muito — e só vale para tarefas parecidas com as registadas.', 'This is the "reference class" in miniature: instead of imagining the steps, you use what similar tasks cost you. With few entries the multiplier swings a lot — and it only applies to tasks like the ones logged.'))}</p></div>`
            : `<p class="pr-sub">${esc(tx(`Com 3 ou mais tarefas com tempo real aparece o teu multiplicador. ${3 - s.n === 1 ? "Falta 1" : "Faltam " + (3 - s.n)}.`, `With 3 or more tasks with actual time your multiplier appears. ${3 - s.n} to go.`))}</p>`}
          ${l.length ? `<table class="pr-table md-etable"><thead><tr><th>${esc(tx('Tarefa', 'Task'))}</th><th>${esc(tx('Est.', 'Est.'))}</th><th>${esc(tx('Real', 'Actual'))}</th><th></th></tr></thead><tbody>
            ${l.map((x, i) => `<tr><td>${esc(x.t)}${x.ex ? ` <small class="pr-sub">(${esc(tx('exemplo', 'example'))})</small>` : ''}</td><td class="pr-mono">${x.e}</td>
              <td>${x.a ? `<span class="pr-mono">${x.a}</span>` : `<input class="md-in md-num md-sm" type="number" min="1" max="5000" data-eact="${i}" aria-label="${esc(tx('Tempo real de', 'Actual time for') + ' ' + x.t)}" placeholder="min">`}</td>
              <td><button type="button" class="btn btn-sm btn-ghost" data-edel="${i}" aria-label="${esc(tx('Apagar', 'Delete') + ': ' + x.t)}">${ICON.x}</button></td></tr>`).join('')}</tbody></table>` : ''}
          <p class="pr-sub">${esc(tx('No estudo de Buehler e colegas (1994), estudantes previram em média 34 dias para a tese e levaram 56. Pensar em casos passados parecidos ajudou.', 'In Buehler and colleagues\' study (1994), students predicted 34 days for their thesis on average and took 56. Thinking about similar past cases helped.'))} ${Pr.srcTag('res')}</p>
        </div></div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('submit', e => {
      const f = e.target.closest('[data-eadd]'); if (!f) return; e.preventDefault();
      const t = f.t.value.trim(), es = +f.e.value, a = +f.a.value || 0; if (!t || !(es > 0)) return;
      put('est', list().concat([{ t, e: es, a: a > 0 ? a : 0 }]).slice(-40)); draw('[data-eadd] input[name=t]');
    });
    host.addEventListener('change', e => {
      const a = e.target.closest('[data-eact]');
      if (a) { const l = list(), v = +a.value; if (v > 0 && l[+a.dataset.eact]) { l[+a.dataset.eact].a = v; put('est', l); draw(); } return; }
    });
    host.addEventListener('input', e => {
      const n = e.target.closest('[data-enext]'); if (!n) return;
      const v = +n.value || 0; put('estNext', v); const s = stats(list()), o = $('[data-ecorr]', host);
      if (o) o.textContent = v && s.mult ? tx(`Com o teu histórico: cerca de ${Math.round(v * s.mult)} min.`, `With your track record: about ${Math.round(v * s.mult)} min.`) : '';
    });
    host.addEventListener('click', e => {
      if (e.target.closest('[data-eex]')) { put('est', EST_EX.map(x => ({ t: L(x.t), e: x.e, a: x.a, ex: true }))); draw(); return; }
      const d = e.target.closest('[data-edel]'); if (d) { const l = list(); l.splice(+d.dataset.edel, 1); put('est', l); draw(); }
    });
  }

  /* enquadramento: o mesmo problema dito de duas formas (história original; estrutura de Tversky & Kahneman, 1981) */
  const FR = {
    gain: { q: B('Um erro de sincronização vai apagar os ficheiros de 600 clientes. Há dois planos.', 'A sync bug is about to wipe the files of 600 customers. There are two plans.'),
      a: B('Plano A: salvam-se os ficheiros de 200 clientes, com certeza.', 'Plan A: the files of 200 customers are saved, for certain.'),
      b: B('Plano B: 1/3 de probabilidade de salvar os 600 e 2/3 de não salvar nenhum.', 'Plan B: a 1/3 chance of saving all 600 and a 2/3 chance of saving none.') },
    loss: { q: B('Outro dia, outra equipa, o mesmo erro com 600 clientes. Outros dois planos.', 'Another day, another team, the same bug with 600 customers. Two other plans.'),
      a: B('Plano C: 400 clientes perdem os ficheiros, com certeza.', 'Plan C: 400 customers lose their files, for certain.'),
      b: B('Plano D: 1/3 de probabilidade de ninguém perder e 2/3 de os 600 perderem.', 'Plan D: a 1/3 chance nobody loses and a 2/3 chance all 600 lose.') },
  };
  function frameLab(host) {
    let f = Object.assign({ gain: null, loss: null }, get('frame', {}));
    const draw = () => {
      const step = f.gain == null ? 'gain' : f.loss == null ? 'loss' : 'done';
      const q = k => `<div class="md-frame pr-sheet"><p class="ap-situ">${esc(L(FR[k].q))}</p><div class="md-choice">
        <button type="button" class="ap-place" data-fr="${k}:a"><b>${esc(L(FR[k].a))}</b></button><button type="button" class="ap-place" data-fr="${k}:b"><b>${esc(L(FR[k].b))}</b></button></div></div>`;
      if (step !== 'done') { host.innerHTML = `<p class="pr-kicker">${esc(step === 'gain' ? tx('Decisão 1 de 2', 'Decision 1 of 2') : tx('Decisão 2 de 2', 'Decision 2 of 2'))}</p>${q(step)}
        <p class="pr-sub">${esc(tx('Escolhe sem pensar demasiado — não há resposta certa.', 'Choose without overthinking — there is no right answer.'))}</p>`; $('[data-fr]', host).focus(); return; }
      const same = (f.gain === 'a') === (f.loss === 'a');
      host.innerHTML = `<div class="md-frame pr-sheet">
        <p class="pr-kicker">${esc(tx('O que escolheste', 'What you chose'))}</p>
        <ul class="md-frl"><li>${esc(L(FR.gain[f.gain]))}</li><li>${esc(L(FR.loss[f.loss]))}</li></ul>
        <p class="md-verdict"><b>${esc(tx('A e C são o mesmo plano: 200 salvos = 400 perdidos. B e D também são o mesmo.', 'A and C are the same plan: 200 saved = 400 lost. B and D are also the same.'))}</b></p>
        <p>${esc(same ? tx('Escolheste de forma coerente nas duas versões. Em média, muitas pessoas mudam de escolha — mas um par de respostas não diz nada de definitivo sobre ti, num sentido ou noutro.', 'You chose consistently across both versions. On average, many people switch — but one pair of answers says nothing definitive about you, either way.')
          : tx('Mudaste de escolha quando o mesmo resultado foi dito como perda — o padrão que o efeito de enquadramento descreve em média: perante ganhos, mais gente prefere o certo; perante perdas, mais gente arrisca. Um par de respostas não prova nada sobre ti.', 'You switched choice when the same outcome was described as a loss — the pattern the framing effect describes on average: facing gains, more people prefer certainty; facing losses, more people gamble. One pair of answers proves nothing about you.'))}</p>
        <p class="pr-sub">${esc(tx('No estudo original (Tversky e Kahneman, 1981, com outra história), 72% escolheram o plano certo quando era dito como ganho e 78% escolheram o arriscado quando era dito como perda. O efeito replicou-se no projeto Many Labs.', 'In the original study (Tversky and Kahneman, 1981, with another story), 72% chose the certain plan when it was framed as a gain and 78% chose the risky one when it was framed as a loss. The effect replicated in the Many Labs project.'))} ${Pr.srcTag('res')}</p>
        <p class="pr-sub">${esc(tx('Na prática: antes de uma decisão importante, escreve-a das duas formas ("salvamos 200" e "perdemos 400") e vê se a tua preferência se aguenta.', 'In practice: before an important decision, write it both ways ("we save 200" and "we lose 400") and see whether your preference holds.'))} ${Pr.srcTag('tip')}</p>
        <button type="button" class="btn" data-fragain>${ICON.reset}${esc(tx('Fazer outra vez', 'Do it again'))}</button></div>`;
    };
    draw();
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-fr]'); if (b) { const [k, v] = b.dataset.fr.split(':'); f[k] = v; put('frame', f); draw(); return; }
      if (e.target.closest('[data-fragain]')) { f = { gain: null, loss: null }; put('frame', null); draw(); }
    });
  }

  /* pré-mortem */
  const PM_ACT = { prev: B('Prevenir', 'Prevent'), watch: B('Vigiar', 'Watch'), ok: B('Aceitar', 'Accept') };
  function pmLab(host) {
    let st = Object.assign({ src: 'world', pid: '', own: '', items: [] }, get('pm', {}));
    const save = () => put('pm', st);
    const pname = () => { if (st.src === 'own') return st.own.trim(); const p = projects().find(x => x.id === st.pid); return p ? W.title('projects', p) : ''; };
    const md = () => [`# ${tx('Pré-mortem', 'Premortem')}: ${pname()}`, '', tx('Daqui a três meses, o projeto falhou. Porquê?', 'Three months from now, the project failed. Why?'), '',
      ...st.items.map(x => `- [${L(PM_ACT[x.k])}] ${x.r}${x.k === 'prev' && x.a ? ` → ${x.a}` : ''}`)].join('\n');
    const draw = (focusSel) => {
      const ps = projects();
      if (st.src === 'world' && !ps.some(p => p.id === st.pid)) st.pid = ps.length ? ps[0].id : '';
      const nPrev = st.items.filter(x => x.k === 'prev' && x.a && x.a.trim() && !inWorld(x.sent)).length, nWatch = st.items.filter(x => x.k === 'watch' && !inWorld(x.sent)).length;
      host.innerHTML = `<div class="md-lab md-lab-1">
        <div class="pr-sheet md-pm">
          <div class="pr-row">${seg('pms', [{ v: 'world', l: B('Projeto do mundo de exemplo', 'Sample-world project') }, { v: 'own', l: B('Um projeto meu', 'A project of mine') }], st.src, tx('Projeto', 'Project'))}
            ${st.src === 'world' ? `<select class="md-in" data-pmsel aria-label="${esc(tx('Projeto', 'Project'))}">${ps.map(p => `<option value="${esc(p.id)}" ${p.id === st.pid ? 'selected' : ''}>${esc(W.title('projects', p))}</option>`).join('')}</select>`
              : `<input class="md-in" data-pmown maxlength="80" value="${esc(st.own)}" placeholder="${esc(tx('Nome do projeto', 'Project name'))}" aria-label="${esc(tx('Nome do projeto', 'Project name'))}">`}</div>
          <p class="ap-situ">${esc(tx(`Imagina: é daqui a três meses e «${pname() || '…'}» correu mal. O que aconteceu?`, `Imagine: it is three months from now and «${pname() || '…'}» went badly. What happened?`))}</p>
          <form class="pr-row" data-pmadd><input class="md-in md-grow" name="r" maxlength="140" required placeholder="${esc(tx('Ex.: O ensaio foi adiado porque ninguém pediu o congelamento a tempo', 'E.g. The rehearsal slipped because nobody asked for the freeze in time'))}" aria-label="${esc(tx('Razão', 'Reason'))}">
            <button class="btn" type="submit" ${st.items.length >= 10 ? 'disabled' : ''}>${ICON.plus}${esc(tx('Juntar razão', 'Add reason'))}</button></form>
          ${st.items.length ? `<ol class="md-pml">${st.items.map((x, i) => `<li data-pmi="${i}"><p>${esc(x.r)}</p>
            <div class="seg md-seg" role="radiogroup" aria-label="${esc(tx('O que fazer', 'What to do'))}">${Object.keys(PM_ACT).map(k => `<button type="button" role="radio" class="seg-btn${x.k === k ? ' active' : ''}" aria-checked="${x.k === k}" data-pmk="${k}">${esc(L(PM_ACT[k]))}</button>`).join('')}</div>
            ${x.k === 'prev' ? `<input class="md-in" data-pma value="${esc(x.a || '')}" maxlength="120" placeholder="${esc(tx('A ação que o previne (começa por um verbo)', 'The action that prevents it (start with a verb)'))}" aria-label="${esc(tx('Ação', 'Action'))}">` : ''}
            ${inWorld(x.sent) ? `<small class="pr-sub">${esc(tx('já no mundo de exemplo', 'already in the sample world'))}</small>` : ''}
            <button type="button" class="btn btn-sm btn-ghost" data-pmdel aria-label="${esc(tx('Apagar razão', 'Delete reason'))}">${ICON.x}</button></li>`).join('')}</ol>`
            : `<p class="pr-sub">${esc(tx('Escreve três a cinco razões. Segundo Gary Klein, imaginar o fracasso como já acontecido ajuda a lembrar razões que um "o que pode correr mal?" deixa escapar.', 'Write three to five reasons. According to Gary Klein, imagining failure as already happened helps surface reasons that "what could go wrong?" misses.'))} ${Pr.srcTag('auth')}</p>`}
          ${st.items.length ? `<div class="pr-row md-pm-out">
            ${st.src === 'world' ? `<button type="button" class="btn btn-primary" data-pmworld ${nPrev + nWatch ? '' : 'disabled'}>${esc(tx(`Levar ao mundo de exemplo: ${pl(nPrev, 'tarefa', 'tarefas')}, ${pl(nWatch, 'nota de risco', 'notas de risco')}`, `Take to the sample world: ${pl(nPrev, 'task', 'tasks')}, ${pl(nWatch, 'risk note', 'risk notes')}`))}</button>` : ''}
            <button type="button" class="btn" data-pmcopy>${esc(tx('Copiar como texto', 'Copy as text'))}</button></div>
            <pre class="md-pre" ${st.src === 'world' ? 'hidden' : ''}>${esc(md())}</pre>` : ''}
          <p class="pr-sub">${esc(tx('O pré-mortem é uma técnica de Gary Klein. As razões que surgem são hipóteses, não previsões: o valor está em agir sobre as que importam.', 'The premortem is Gary Klein\'s technique. The reasons it surfaces are hypotheses, not forecasts: the value is in acting on those that matter.'))} ${Pr.srcTag('auth')}</p>
        </div></div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('submit', e => { const f = e.target.closest('[data-pmadd]'); if (!f) return; e.preventDefault(); const r = f.r.value.trim(); if (!r || st.items.length >= 10) return; st.items.push({ r, k: 'prev', a: '' }); save(); draw('[data-pmadd] input'); });
    host.addEventListener('input', e => {
      if (e.target.matches('[data-pmown]')) { st.own = e.target.value; save(); const s = $('.ap-situ', host); if (s) s.textContent = tx(`Imagina: é daqui a três meses e «${pname() || '…'}» correu mal. O que aconteceu?`, `Imagine: it is three months from now and «${pname() || '…'}» went badly. What happened?`); return; }
      const a = e.target.closest('[data-pma]'); if (a) { st.items[+a.closest('[data-pmi]').dataset.pmi].a = a.value; save(); }
    });
    host.addEventListener('change', e => {
      if (e.target.matches('[data-pmsel]')) { st.pid = e.target.value; save(); draw('[data-pmsel]'); return; }
      if (e.target.matches('[data-pma]')) draw();
    });
    host.addEventListener('click', e => {
      const s = e.target.closest('[data-pms]'); if (s) { st.src = s.dataset.pms; save(); draw(`[data-pms="${st.src}"]`); return; }
      const k = e.target.closest('[data-pmk]'); if (k) { const i = +k.closest('[data-pmi]').dataset.pmi; st.items[i].k = k.dataset.pmk; save(); draw(`[data-pmi="${i}"] [data-pmk="${k.dataset.pmk}"]`); return; }
      const d = e.target.closest('[data-pmdel]'); if (d) { st.items.splice(+d.closest('[data-pmi]').dataset.pmi, 1); save(); draw(); return; }
      if (e.target.closest('[data-pmcopy]')) { copyText(md(), e.target.closest('[data-pmcopy]')); return; }
      if (e.target.closest('[data-pmworld]')) {
        const pn = pname(); let nt = 0, nn = 0;
        st.items.forEach(x => {
          if (inWorld(x.sent)) return;
          if (x.k === 'prev' && x.a && x.a.trim()) { const tid = M.worldTask(`${x.a.trim()} (${pn})`, W.clock() + 2); if (tid) { x.sent = tid; nt++; } }
          else if (x.k === 'watch') { const id = 'nm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); if (W.apply('mind', { o: 'add', db: 'notes', r: { id, name: `${tx('Risco', 'Risk')}: ${x.r} (${pn})`, team: [], tags: [] } })) { x.sent = id; nn++; } }
        });
        save(); draw(); Pr.toast(tx(`${pl(nt, 'tarefa', 'tarefas')} e ${pl(nn, 'nota de risco', 'notas de risco')} no mundo de exemplo.`, `${pl(nt, 'task', 'tasks')} and ${pl(nn, 'risk note', 'risk notes')} in the sample world.`));
      }
    });
  }

  /* ════════════════ 5 · Motivação ════════════════ */
  const MD = [
    { k: 'aut', l: B('Escolha', 'Choice'), sdt: B('autonomia', 'autonomy'), q: B('Escolhi isto, ou pelo menos o como e o quando?', 'Did I choose this, or at least how and when?') },
    { k: 'com', l: B('Capaz e a progredir', 'Capable and progressing'), sdt: B('competência', 'competence'), q: B('Sei fazê-lo, e vejo o progresso?', 'Do I know how to do it, and can I see progress?') },
    { k: 'rel', l: B('Ligação', 'Connection'), sdt: B('relação', 'relatedness'), q: B('Alguém conta com isto, ou faço-o com alguém?', 'Is someone counting on it, or am I doing it with someone?') },
    { k: 'pur', l: B('Porquê', 'Why'), sdt: B('razão / propósito (Pink)', 'rationale / purpose (Pink)'), q: B('Sei porque importa?', 'Do I know why it matters?') },
  ];
  const MOVES = [
    { id: 'how', d: 'aut', v: 1, l: B('Escolher eu o como e o quando', 'Choose the how and the when myself') },
    { id: 'two', d: 'aut', v: 1, l: B('Escolher entre duas formas de a fazer', 'Pick between two ways of doing it') },
    { id: 'steps', d: 'com', v: 2, l: B('Partir em passos com ✓ visível', 'Split it into steps with a visible ✓') },
    { id: 'example', d: 'com', v: 1, l: B('Pedir um exemplo de "bem feito"', 'Ask for an example of "done well"') },
    { id: 'with', d: 'rel', v: 1, l: B('Fazer com alguém, ou dizer a alguém quando acabo', 'Do it with someone, or tell someone when I finish') },
    { id: 'who', d: 'rel', v: 1, l: B('Saber quem usa o resultado', 'Know who uses the result') },
    { id: 'why', d: 'pur', v: 2, l: B('Escrever o porquê numa frase', 'Write the why in one sentence') },
    { id: 'goal', d: 'pur', v: 1, l: B('Ligar ao Objetivo do projeto', 'Link it to the project\'s Objective') },
  ];
  function motPage(rest, el) {
    PrShell.setArea('experimentar', tx('Redesenhar uma tarefa', 'Redesign a task'));
    el.innerHTML = `<div class="pr-wrap pr-page md-page">
      ${head('experimentar', tx('Redesenhar uma tarefa', 'Redesign a task'), tx('Redesenhar uma tarefa', 'Redesign a task'),
        tx('Pega numa tarefa que te custa e avalia-a nas quatro coisas que sustentam a motivação. Depois escolhe mudanças pequenas e vê o perfil mudar — e o que isso pede de ti na prática.', 'Take a task you find hard going and rate it on the four things that sustain motivation. Then pick small changes and see the profile shift — and what each asks of you in practice.'), ['est', 'auth'])}
      <div data-mhost></div>
      <div class="lr-demo" data-mrw></div>
      ${mine('mot')}
      ${applyBox([
        'Na tarefa que mais adias, encontra a dimensão mais fraca e muda só essa.',
        'Para tarefas aborrecidas que importam: o porquê, o reconhecimento de que é aborrecido e alguma escolha no como.',
        'Cuidado com prometer-te prémios por coisas de que já gostas.',
        'Torna o progresso visível: o ✓ no caderno conta.'],
        ['On the task you postpone most, find the weakest dimension and change only that one.',
        'For boring tasks that matter: the why, acknowledging it is boring, and some choice in how.',
        'Be careful promising yourself rewards for things you already enjoy.',
        'Make progress visible: the ✓ in the notebook counts.'],
        [{ href: '#aprender/motivacao', l: B('Capítulo: O que nos move', 'Chapter: What moves us') }])}
    </div>`;
    PrLearn.DEMOS['m-reward']($('[data-mrw]', el));
    const host = $('[data-mhost]', el);
    let m = Object.assign({ task: tx('Preencher o relatório mensal de horas', 'Fill in the monthly timesheet report'), aut: 1, com: 3, rel: 1, pur: 1, mv: [], why: '' }, get('mot', {}));
    const save = () => put('mot', m);
    const after = k => Math.min(4, m[k] + MOVES.filter(x => m.mv.includes(x.id) && x.d === k).reduce((s, x) => s + x.v, 0));
    const outHtml = () => {
      const weak = MD.slice().sort((a, b) => m[a.k] - m[b.k])[0];
      return `<div class="md-prof" role="img" aria-label="${esc(MD.map(d => `${L(d.l)}: ${m[d.k]} → ${after(d.k)}`).join('; '))}">${MD.map(d => `<div class="md-pr"><span>${esc(L(d.l))}<small>${esc(L(d.sdt))}</small></span>
          <div class="md-prb"><i class="b0" style="width:${m[d.k] * 25}%"></i><i class="b1" style="width:${after(d.k) * 25}%"></i></div><b class="pr-mono">${m[d.k]}${after(d.k) !== m[d.k] ? ' → ' + after(d.k) : ''}</b></div>`).join('')}</div>
        <p class="md-legend"><span><i class="md-k0"></i>${esc(tx('agora', 'now'))}</span><span><i class="md-k1"></i>${esc(tx('depois das mudanças', 'after the changes'))}</span></p>
        <div class="md-diag"><p class="pr-kicker">${esc(tx('O mais fraco', 'The weakest'))}: ${esc(L(weak.l))}</p><p>${esc(L(weak.q))}</p></div>
        ${m.mv.length ? `<div class="md-sent pr-sheet"><p class="pr-kicker">${esc(tx('A tarefa, redesenhada', 'The task, redesigned'))}</p><p><b>${esc(m.task)}</b></p>
          <ul>${MOVES.filter(x => m.mv.includes(x.id)).map(x => `<li>${esc(L(x.l))}${x.id === 'why' && m.why ? `: <i>${esc(m.why)}</i>` : ''}</li>`).join('')}</ul></div>` : ''}
        ${illu('O perfil é a tua própria avaliação, não uma medição. As quatro dimensões vêm da teoria da autodeterminação (autonomia, competência, relação) com o "porquê" que Pink chama propósito; quanto cada mudança sobe é uma convenção deste laboratório.', 'The profile is your own rating, not a measurement. The four dimensions come from self-determination theory (autonomy, competence, relatedness) plus the "why" Pink calls purpose; how much each change adds is this lab\'s convention.')}`;
    };
    const draw = (focusSel) => {
      host.innerHTML = `<div class="md-lab">
        <div class="md-ctl pr-sheet">
          <label class="md-f"><span>${esc(tx('A tarefa', 'The task'))}</span><input class="md-in" data-mt maxlength="100" value="${esc(m.task)}"></label>
          ${MD.map(d => range(d.k, L(d.l), m[d.k], 0, 4, L(d.q))).join('')}
          <fieldset class="md-fx"><legend>${esc(tx('Mudanças pequenas', 'Small changes'))}</legend>
            ${MOVES.map(x => `<label class="lr-toggle"><input type="checkbox" data-mv="${x.id}" ${m.mv.includes(x.id) ? 'checked' : ''}> ${esc(L(x.l))} <small class="pr-sub">${esc(L(MD.find(d => d.k === x.d).l))}</small></label>`).join('')}
            ${m.mv.includes('why') ? `<input class="md-in" data-mwhy maxlength="140" value="${esc(m.why)}" placeholder="${esc(tx('Porque importa? Ex.: sem isto a equipa não é paga a horas', 'Why does it matter? E.g. without it the team is not paid on time'))}" aria-label="${esc(tx('O porquê', 'The why'))}">` : ''}
          </fieldset>
        </div>
        <div class="md-out" data-out>${outHtml()}</div></div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('[data-mt]')) { m.task = t.value; save(); return; }
      if (t.matches('[data-mwhy]')) { m.why = t.value; save(); $('[data-out]', host).innerHTML = outHtml(); return; }
      if (t.dataset.r) { m[t.dataset.r] = +t.value; save(); rv(host, t.dataset.r, t.value); $('[data-out]', host).innerHTML = outHtml(); }
    });
    host.addEventListener('change', e => { const k = e.target.dataset.mv; if (!k) return; m.mv = e.target.checked ? m.mv.concat([k]) : m.mv.filter(x => x !== k); save(); draw(`[data-mv="${k}"]`); });
  }

  /* ════════════════ 6 · Prioridades ════════════════ */
  const CIRCLE_EX = [B('A reestruturação anunciada para janeiro', 'The restructuring announced for January'), B('O meu atraso no relatório trimestral', 'My delay on the quarterly report'),
    B('A Ana não responde aos emails', 'Ana does not answer emails'), B('A inflação', 'Inflation'), B('Não ter tempo para formação', 'Not having time for training')];
  const CZ = { ctl: B('Controlo', 'Control'), inf: B('Influência', 'Influence'), out: B('Fora do meu alcance', 'Out of my reach') };
  const URG = [
    { id: 'u1', t: B('Responder ao pedido de inventário de licenças', 'Answer the licence inventory request'), dl: B('hoje, 17h', 'today, 5pm'), v: 2 },
    { id: 'u2', t: B('Escrever a proposta de redução de custos', 'Write the cost-reduction proposal'), dl: null, v: 9 },
    { id: 'u3', t: B('Atualizar a apresentação de sexta', 'Update Friday\'s presentation'), dl: B('sexta', 'Friday'), v: 5 },
    { id: 'u4', t: B('Inscrever-me no webinar de ferramentas', 'Sign up for the tools webinar'), dl: B('inscrições fecham em 2 h!', 'sign-up closes in 2h!'), v: 1 },
    { id: 'u5', t: B('Rever o plano de piquete da Beacon', 'Review the Beacon on-call plan'), dl: B('amanhã', 'tomorrow'), v: 6 },
    { id: 'u6', t: B('Preparar o 1:1 com a Elena', 'Prepare the 1:1 with Elena'), dl: B('quinta', 'Thursday'), v: 4 },
    { id: 'u7', t: B('Limpar a caixa de email', 'Clean up the inbox'), dl: null, v: 2 },
  ];
  const URG_BEST = URG.slice().sort((a, b) => b.v - a.v).slice(0, 3).reduce((s, x) => s + x.v, 0);
  function priPage(rest, el) {
    PrShell.setArea('experimentar', tx('O que depende de mim', 'What is up to me'));
    const cur = ['urgencia', 'tras'].includes(rest) ? rest : '';
    el.innerHTML = `<div class="pr-wrap pr-page md-page">
      ${head('experimentar', tx('O que depende de mim — e o que importa', 'What is up to me — and what matters'), tx('O que depende de mim — e o que importa', 'What is up to me — and what matters'),
        tx('Três exercícios para apontar o sistema: separar o que controlas do que só influencias, cair (ou não) na armadilha da urgência, e planear de trás para a frente até à ação de hoje.', 'Three exercises to aim the system: separate what you control from what you only influence, fall (or not) into the urgency trap, and plan backwards to today\'s action.'), ['auth', 'res'])}
      ${tabs('experimentar/prioridades', cur, [['', B('Controlo e influência', 'Control and influence')], ['urgencia', B('A armadilha da urgência', 'The urgency trap')], ['tras', B('De trás para a frente', 'Backwards planning')]], tx('Exercício', 'Exercise'))}
      <div data-qhost></div>
      ${mine('circle,urg,back')}
      ${applyBox([
        'Para cada preocupação: agir (tarefa), influenciar (falar com alguém) ou largar.',
        'Quando escolheres o que fazer a seguir, diz em voz alta o ganho de cada opção — não só o prazo.',
        'Uma coisa importante por semana, com um bloco marcado na revisão.',
        'Planeia de trás para a frente; só a próxima ação vai para a lista.'],
        ['For each worry: act (task), influence (talk to someone) or let go.',
        'When choosing what to do next, say out loud each option\'s payoff — not just its deadline.',
        'One important thing a week, with a block booked at the review.',
        'Plan backwards; only the next action goes on the list.'],
        [{ href: '#aprender/importante', l: B('Capítulo: O que merece o teu tempo', 'Chapter: What deserves your time') }, { href: '#aplicar/projeto', l: B('Construir um projeto', 'Build a project') }])}
      ${cur !== 'urgencia' ? `<div class="pr-section">${PrApp.worldBar('mind')}</div>` : ''}
    </div>`;
    const host = $('[data-qhost]', el);
    if (cur === 'urgencia') return urgLab(host);
    if (cur === 'tras') return backLab(host);
    circleLab(host);
  }

  function circleLab(host) {
    let items = get('circle', []);
    const save = () => put('circle', items);
    const draw = (focusSel) => {
      const n = k => items.filter(x => x.z === k).length;
      host.innerHTML = `<div class="md-lab">
        <div class="md-ctl pr-sheet">
          <svg class="md-circ" viewBox="0 0 240 240" role="img" aria-label="${esc(tx(`Controlo ${n('ctl')}, influência ${n('inf')}, fora ${n('out')}`, `Control ${n('ctl')}, influence ${n('inf')}, out ${n('out')}`))}">
            <circle cx="120" cy="120" r="112" class="c-out"/><circle cx="120" cy="120" r="76" class="c-inf"/><circle cx="120" cy="120" r="38" class="c-ctl"/>
            <text x="120" y="118" text-anchor="middle" class="c-n">${n('ctl')}</text><text x="120" y="132" text-anchor="middle" class="c-l">${esc(L(CZ.ctl))}</text>
            <text x="120" y="66" text-anchor="middle" class="c-n">${n('inf')}</text><text x="120" y="78" text-anchor="middle" class="c-l">${esc(L(CZ.inf))}</text>
            <text x="120" y="26" text-anchor="middle" class="c-n">${n('out')}</text><text x="120" y="38" text-anchor="middle" class="c-l">${esc(tx('fora', 'out'))}</text></svg>
          <form class="pr-row" data-cadd><input class="md-in md-grow" name="t" maxlength="100" required placeholder="${esc(tx('Uma preocupação', 'A worry'))}" aria-label="${esc(tx('Uma preocupação', 'A worry'))}"><button class="btn" type="submit" ${items.length >= 12 ? 'disabled' : ''}>${ICON.plus}${esc(tx('Juntar', 'Add'))}</button></form>
          ${!items.length ? `<button type="button" class="btn btn-sm" data-cex>${esc(tx('Usar 5 exemplos', 'Use 5 examples'))}</button>` : ''}
          <p class="pr-sub">${esc(tx('Círculo de influência e de preocupação: modelo de Stephen Covey. A distinção entre o que depende de nós e o que não depende é de Epicteto.', 'Circle of influence and of concern: Stephen Covey\'s model. The distinction between what is up to us and what is not is Epictetus\'s.'))} ${Pr.srcTag('auth')}</p>
        </div>
        <div class="md-out">
          ${items.length ? `<ol class="md-cl">${items.map((x, i) => `<li data-ci="${i}" class="z-${x.z || 'none'}"><div class="md-cl-h"><p>${esc(x.t)}</p><button type="button" class="btn btn-sm btn-ghost" data-cdel aria-label="${esc(tx('Apagar', 'Delete') + ': ' + x.t)}">${ICON.x}</button></div>
            <div class="seg md-seg" role="radiogroup" aria-label="${esc(tx('Onde está?', 'Where is it?'))}">${Object.keys(CZ).map(k => `<button type="button" role="radio" class="seg-btn${x.z === k ? ' active' : ''}" aria-checked="${x.z === k}" data-cz="${k}">${esc(L(CZ[k]))}</button>`).join('')}</div>
            ${x.z === 'ctl' ? `<div class="pr-row"><input class="md-in md-grow" data-cn value="${esc(x.n || '')}" maxlength="120" placeholder="${esc(tx('A próxima ação (verbo primeiro)', 'The next action (verb first)'))}" aria-label="${esc(tx('Próxima ação', 'Next action'))}">
              <button type="button" class="btn btn-sm" data-cw ${inWorld(x.sent) ? 'disabled' : ''}>${esc(inWorld(x.sent) ? tx('Na lista ✓', 'On the list ✓') : tx('→ Lista (mundo de exemplo)', '→ List (sample world)'))}</button></div>`
            : x.z === 'inf' ? `<input class="md-in" data-cn value="${esc(x.n || '')}" maxlength="120" placeholder="${esc(tx('Com quem falo, e o que peço? (vira "Insistir com…" ou entra no próximo 1:1)', 'Who do I talk to, and what do I ask? (becomes "Chase…" or goes into the next 1:1)'))}" aria-label="${esc(tx('Com quem falar', 'Who to talk to'))}">`
            : x.z === 'out' ? `<p class="pr-sub">${esc(tx('Larga. Se continuar a pesar: há alguma parte pequena, à volta disto, que dependa de ti (preparar-te, informar-te)? Essa sim, vai para a lista.', 'Let it go. If it still weighs: is there a small part around it that is up to you (preparing, finding out)? That one goes on the list.'))}</p>` : ''}
          </li>`).join('')}</ol>
          <p class="md-verdict">${esc(tx(`Ações: ${n('ctl')} · conversas: ${n('inf')} · fora da lista: ${n('out')}. Sem lugar ainda: ${n(null)}.`, `Actions: ${n('ctl')} · conversations: ${n('inf')} · off the list: ${n('out')}. Not placed yet: ${n(null)}.`))}</p>`
          : `<div class="empty-state"><p class="es-title">${esc(tx('Escreve o que te anda a preocupar', 'Write down what has been worrying you'))}</p><p class="es-hint">${esc(tx('Trabalho ou vida — fica só neste browser.', 'Work or life — it stays only in this browser.'))}</p></div>`}
        </div></div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('submit', e => { const f = e.target.closest('[data-cadd]'); if (!f) return; e.preventDefault(); const t = f.t.value.trim(); if (!t || items.length >= 12) return; items.push({ t, z: null, n: '' }); save(); draw('[data-cadd] input'); });
    host.addEventListener('input', e => { const c = e.target.closest('[data-cn]'); if (c) { items[+c.closest('[data-ci]').dataset.ci].n = c.value; save(); } });
    host.addEventListener('click', e => {
      if (e.target.closest('[data-cex]')) { items = CIRCLE_EX.map(x => ({ t: L(x), z: null, n: '' })); save(); draw(); return; }
      const li = e.target.closest('[data-ci]'); if (!li) return; const i = +li.dataset.ci;
      const z = e.target.closest('[data-cz]'); if (z) { items[i].z = z.dataset.cz; save(); draw(`[data-ci="${i}"] [data-cz="${z.dataset.cz}"]`); return; }
      if (e.target.closest('[data-cdel]')) { items.splice(i, 1); save(); draw(); return; }
      if (e.target.closest('[data-cw]')) {
        const v = (items[i].n || '').trim(); if (!v) { Pr.toast(tx('Escreve primeiro a próxima ação.', 'Write the next action first.')); $(`[data-ci="${i}"] [data-cn]`, host).focus(); return; }
        const tid = M.worldTask(v); if (tid) { items[i].sent = tid; save(); draw(); Pr.toast(tx('Na lista de hoje do mundo de exemplo.', "On the sample world's list for today.")); }
      }
    });
  }

  function urgLab(host) {
    let u = Object.assign({ pick: [], round: 1, done1: null }, get('urg', {}));
    const save = () => put('urg', u);
    const draw = () => {
      const showV = u.round === 2, done = u.pick.length === 3, total = u.pick.reduce((s, id) => s + URG.find(x => x.id === id).v, 0);
      host.innerHTML = `<div class="md-lab md-lab-1"><div class="pr-sheet md-urg">
        <p class="pr-kicker">${esc(u.round === 1 ? tx('Ronda 1', 'Round 1') : tx('Ronda 2 — com o ganho à vista', 'Round 2 — with the payoff in view'))}</p>
        <p class="ap-situ">${esc(tx('Tens a tarde livre e dá para três destas. Quais escolhes?', 'You have the afternoon free and time for three of these. Which do you pick?'))}</p>
        <ul class="md-urgl">${URG.map(x => { const on = u.pick.includes(x.id);
          return `<li><button type="button" class="md-urg-b${on ? ' on' : ''}" data-ug="${x.id}" aria-pressed="${on}" ${done && !on ? 'disabled' : ''}><b>${esc(L(x.t))}</b>
            <span class="md-urg-m">${x.dl ? `<span class="md-dl">${esc(tx('prazo: ', 'due: ') + L(x.dl))}</span>` : `<span class="pr-sub">${esc(tx('sem prazo', 'no deadline'))}</span>`}${showV || done ? `<span class="md-val pr-mono">${esc(tx('ganho', 'payoff'))} ${x.v}</span>` : ''}</span></button></li>`; }).join('')}</ul>
        ${done ? `<p class="md-verdict"><b>${esc(tx(`O teu ganho: ${total} de ${URG_BEST} possíveis.`, `Your payoff: ${total} out of ${URG_BEST} possible.`))}</b>${u.round === 2 && u.done1 != null ? esc(tx(` (ronda 1: ${u.done1})`, ` (round 1: ${u.done1})`)) : ''}</p>
          <p>${esc(total >= URG_BEST ? tx('Escolheste pelo ganho, não pelo prazo. A proposta sem prazo era a que mais valia.', 'You chose by payoff, not deadline. The proposal with no deadline was worth the most.')
            : u.pick.includes('u4') || u.pick.includes('u1') ? (u.round === 1 ? tx('Sem os ganhos à vista, o prazo era a informação mais visível — e puxou-te para tarefas que valiam pouco: a inscrição "fecha em 2 h" era a que menos valia. Na vida real os ganhos raramente vêm escritos; por isso a ronda 2 mostra-os.', 'With no payoffs in view, the deadline was the most visible information — and it pulled you towards low-value tasks: the "closes in 2h" sign-up was worth the least. In real life payoffs are rarely written down; that is why round 2 shows them.')
              : tx('Mesmo com o ganho à vista, o prazo curto pesou na escolha — o padrão que a investigação chama efeito da mera urgência. Uma escolha isolada não prova nada sobre ti.', 'Even with the payoff in view, the short deadline weighed on the choice — the pattern research calls the mere urgency effect. One choice proves nothing about you.'))
            : tx('Perto do máximo. Repara qual ficou de fora e porquê.', 'Close to the maximum. Notice which one was left out and why.'))}</p>
          <p class="pr-sub">${esc(tx('Em cinco experiências de Zhu, Yang e Hsee (2018), as pessoas escolheram mais vezes tarefas com uma urgência ilusória mesmo quando outra pagava objetivamente mais; numa delas, lembrar o ganho de cada tarefa na hora de escolher reduziu o efeito. Este exercício não reproduz essas experiências e os ganhos são inventados.', 'In five experiments by Zhu, Yang and Hsee (2018), people more often chose tasks with illusory urgency even when another paid objectively more; in one, being reminded of each payoff at the moment of choice reduced the effect. This exercise does not reproduce those experiments and the payoffs are made up.'))} ${Pr.srcTag('res')}</p>
          <div class="pr-row">${u.round === 1 ? `<button type="button" class="btn btn-primary" data-ur2>${esc(tx('Ronda 2: escolher com o ganho à vista', 'Round 2: choose with the payoff in view'))}</button>` : ''}<button type="button" class="btn" data-ureset>${ICON.reset}${esc(tx('Recomeçar', 'Start over'))}</button></div>`
          : `<p class="pr-sub" aria-live="polite">${esc(tx(`${u.pick.length} de 3 escolhidas.`, `${u.pick.length} of 3 picked.`))}</p>`}
      </div></div>`;
    };
    draw();
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-ug]');
      if (b) { const id = b.dataset.ug; if (u.pick.length === 3 && !u.pick.includes(id)) return; u.pick = u.pick.includes(id) ? u.pick.filter(x => x !== id) : u.pick.concat([id]); save(); draw(); const nb = $(`[data-ug="${id}"]`, host); if (nb && !nb.disabled) nb.focus(); else { const v = $('.md-verdict', host); if (v) { v.tabIndex = -1; v.focus(); } } return; }
      if (e.target.closest('[data-ur2]')) { u = { pick: [], round: 2, done1: u.pick.reduce((s, id) => s + URG.find(x => x.id === id).v, 0) }; save(); draw(); $('[data-ug]', host).focus(); return; }
      if (e.target.closest('[data-ureset]')) { u = { pick: [], round: 1, done1: null }; put('urg', null); draw(); $('[data-ug]', host).focus(); }
    });
  }

  function backLab(host) {
    let b = Object.assign({ goal: tx('Correr 10 km sem parar', 'Run 10 km without stopping'), when: tx('março', 'March'), ms: [tx('5 km sem parar', '5 km without stopping'), tx('3 treinos por semana durante um mês', '3 runs a week for a month'), tx('Plano de treino escolhido', 'Training plan chosen')], next: tx('Escolher um plano de treino de 8 semanas', 'Pick an 8-week training plan'), sent: false }, get('back', {}));
    const save = () => put('back', b);
    const md = () => [`# ${b.goal} — ${b.when}`, '', ...b.ms.filter(m => m.trim()).map((m, i, a) => `${a.length - i}. ${m}`), '', `${tx('Próxima ação', 'Next action')}: ${b.next}`].join('\n');
    const draw = (focusSel) => {
      host.innerHTML = `<div class="md-lab md-lab-1"><div class="pr-sheet md-back">
        <ol class="md-bk">
          <li class="md-bk-goal"><span class="pr-kicker">${esc(tx('O fim', 'The end'))}</span><div class="md-two"><label class="md-f"><span>${esc(tx('Resultado', 'Outcome'))}</span><input class="md-in" data-bk="goal" maxlength="100" value="${esc(b.goal)}"></label>
            <label class="md-f"><span>${esc(tx('Até quando', 'By when'))}</span><input class="md-in" data-bk="when" maxlength="40" value="${esc(b.when)}"></label></div></li>
          ${b.ms.map((m, i) => `<li><span class="pr-kicker">${esc(tx(`Antes disso (${i + 1})`, `Before that (${i + 1})`))}</span><div class="pr-row"><input class="md-in md-grow" data-bkm="${i}" maxlength="100" value="${esc(m)}" aria-label="${esc(tx('Marco', 'Milestone') + ' ' + (i + 1))}">
            <button type="button" class="btn btn-sm btn-ghost" data-bkdel="${i}" aria-label="${esc(tx('Apagar marco', 'Delete milestone'))}">${ICON.x}</button></div></li>`).join('')}
          ${b.ms.length < 4 ? `<li><button type="button" class="btn btn-sm" data-bkadd>${ICON.plus}${esc(tx('Mais um marco antes', 'One more milestone before'))}</button></li>` : ''}
          <li class="md-bk-now"><span class="pr-kicker">${esc(tx('Hoje', 'Today'))}</span><label class="md-f"><span>${esc(tx('A próxima ação — a única que vai para a lista', 'The next action — the only one that goes on the list'))}</span>
            <input class="md-in" data-bk="next" maxlength="120" value="${esc(b.next)}"></label></li>
        </ol>
        <div class="pr-row"><button type="button" class="btn btn-primary" data-bkw ${inWorld(b.sent) ? 'disabled' : ''}>${esc(inWorld(b.sent) ? tx('Na lista ✓', 'On the list ✓') : tx('Pôr a próxima ação na lista (mundo de exemplo)', 'Put the next action on the list (sample world)'))}</button>
          <button type="button" class="btn" data-bkcopy>${esc(tx('Copiar como texto', 'Copy as text'))}</button></div>
        <pre class="md-pre" hidden>${esc(md())}</pre>
        <p class="pr-sub">${esc(tx('"Começar com o fim em mente" é o segundo hábito de Covey. Se tiver várias sessões de trabalho e um fim, é um projeto: leva-o para o construtor de projetos.', '"Begin with the end in mind" is Covey\'s second habit. If it has several work sessions and an end, it is a project: take it to the project builder.'))} ${Pr.srcTag('auth')} <a href="#aplicar/projeto">${esc(tx('Construir um projeto →', 'Build a project →'))}</a></p>
      </div></div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('input', e => {
      const k = e.target.dataset.bk; if (k) { b[k] = e.target.value; if (k === 'next') b.sent = false; save(); const w = $('[data-bkw]', host); if (w && k === 'next') { w.disabled = false; w.textContent = tx('Pôr a próxima ação na lista (mundo de exemplo)', 'Put the next action on the list (sample world)'); } return; }
      const m = e.target.dataset.bkm; if (m != null) { b.ms[+m] = e.target.value; save(); }
    });
    host.addEventListener('click', e => {
      if (e.target.closest('[data-bkadd]')) { b.ms.push(''); save(); draw(`[data-bkm="${b.ms.length - 1}"]`); return; }
      const d = e.target.closest('[data-bkdel]'); if (d) { b.ms.splice(+d.dataset.bkdel, 1); save(); draw(); return; }
      if (e.target.closest('[data-bkcopy]')) { $('pre', host).textContent = md(); copyText(md(), e.target.closest('[data-bkcopy]')); return; }
      if (e.target.closest('[data-bkw]')) {
        const v = (b.next || '').trim(); if (!v) { $('[data-bk="next"]', host).focus(); return; }
        const tid = M.worldTask(`${v} (${b.goal.trim()})`); if (tid) { b.sent = tid; save(); draw(); Pr.toast(tx('Na lista de hoje do mundo de exemplo.', "On the sample world's list for today.")); }
      }
    });
  }

  /* ════════════════ 7 · Aplicar › revisão pessoal ════════════════ */
  const PR_STEPS = [
    { id: 'hab', n: B('Hábitos', 'Habits') }, { id: 'en', n: B('Energia e foco', 'Energy and focus') }, { id: 'adi', n: B('O que adiei', 'What I put off') },
    { id: 'imp', n: B('O importante', 'The important thing') }, { id: 'fim', n: B('Fechar', 'Close') },
  ];
  const THIEVES = [B('notificações', 'notifications'), B('reuniões', 'meetings'), B('sono', 'sleep'), B('coisas por fechar', 'unfinished things'), B('mudar de tarefa', 'switching tasks'), B('nada de especial', 'nothing in particular')];
  const WHEN = [B('manhã', 'morning'), B('início da tarde', 'early afternoon'), B('fim da tarde', 'late afternoon'), B('noite', 'evening'), B('variou', 'it varied')];
  function persPage(rest, el) {
    PrShell.setArea('aplicar', tx('Revisão pessoal', 'Personal review'));
    el.innerHTML = `<div class="pr-wrap pr-page md-page" style="max-width:920px">
      ${head('aplicar', tx('Revisão pessoal', 'Personal review'), tx('Revisão pessoal', 'Personal review'),
        tx('Dez minutos, logo a seguir à revisão semanal. A revisão semanal olha para as tarefas; esta olha para ti: os hábitos, quando trabalhaste bem, o que evitaste e o que importa a seguir.', 'Ten minutes, right after the weekly review. The weekly review looks at the tasks; this one looks at you: your habits, when you worked well, what you avoided and what matters next.'), ['tip'])}
      <div data-rhost></div>
      ${mine('prev,prevHist')}
      <p class="md-links"><a href="#aplicar/revisao">${esc(tx('Revisão semanal (as tarefas) →', 'Weekly review (the tasks) →'))}</a><a href="#experimentar/habito">${esc(tx('Laboratório de hábitos →', 'Habit lab →'))}</a></p>
    </div>`;
    const host = $('[data-rhost]', el);
    let r = Object.assign({ step: 0, hab: {}, when: null, thief: [], change: '', adi: '', why: null, first: '', imp: '', block: '' }, get('prev', {}));
    const save = () => put('prev', r);
    const habits = () => get('habits', []);
    const last7 = x => { const ds = M.daysBack(7).map(M.isoDay); return ds.filter(d => x.ticks.includes(d)).length; };
    const summary = () => {
      const lines = [];
      habits().forEach(x => { const v = r.hab[x.id]; lines.push(`${x.name}: ${last7(x)}/7${v ? ' → ' + L({ keep: B('manter', 'keep'), shrink: B('encolher', 'shrink'), drop: B('largar', 'drop') }[v]) : ''}`); });
      if (r.when != null) lines.push(`${tx('Trabalho difícil corre melhor', 'Hard work goes best')}: ${L(WHEN[r.when])}`);
      if (r.thief.length) lines.push(`${tx('O que roubou foco', 'What stole focus')}: ${r.thief.map(i => L(THIEVES[i])).join(', ')}`);
      if (r.change) lines.push(`${tx('Mudança para a semana', 'Change for the week')}: ${r.change}`);
      if (r.adi) lines.push(`${tx('Adiei', 'I put off')}: ${r.adi}${r.why ? ` (${L(M.P_F.find(f => f.k === r.why).l).toLowerCase()})` : ''}${r.first ? ` → ${r.first}` : ''}`);
      if (r.imp) lines.push(`${tx('O importante', 'The important thing')}: ${r.imp}${r.block ? ` — ${r.block}` : ''}`);
      return lines;
    };
    const body = () => {
      const s = PR_STEPS[r.step].id;
      if (s === 'hab') { const hs = habits();
        return hs.length ? `<p class="rv-what">${esc(tx('Para cada hábito, os últimos 7 dias. Decide: manter, encolher (uma versão mais pequena) ou largar.', 'For each habit, the last 7 days. Decide: keep, shrink (a smaller version) or drop.'))}</p>
          <ul class="md-rhab">${hs.map(x => `<li><b>${esc(x.name)}</b> <span class="pr-mono">${last7(x)}/7</span>
            <div class="seg md-seg" role="radiogroup" aria-label="${esc(x.name)}">${[['keep', B('Manter', 'Keep')], ['shrink', B('Encolher', 'Shrink')], ['drop', B('Largar', 'Drop')]].map(([k, l]) => `<button type="button" role="radio" class="seg-btn${r.hab[x.id] === k ? ' active' : ''}" aria-checked="${r.hab[x.id] === k}" data-rh="${esc(x.id)}:${k}">${esc(L(l))}</button>`).join('')}</div></li>`).join('')}</ul>
          <p class="pr-sub">${esc(tx('Menos de metade dos dias? Encolher costuma resultar melhor do que prometer mais esforço.', 'Fewer than half the days? Shrinking usually works better than promising more effort.'))} ${Pr.srcTag('auth')}</p>`
          : `<div class="empty-state"><p class="es-title">${esc(tx('Ainda não registas nenhum hábito', 'You are not logging any habits yet'))}</p><p class="es-hint">${esc(tx('Desenha um no laboratório e marca os dias. Podes saltar este passo.', 'Design one in the lab and mark the days. You can skip this step.'))}</p><a class="btn" href="#experimentar/habito">${esc(tx('Laboratório de hábitos', 'Habit lab'))}</a></div>`; }
      if (s === 'en') return `<p class="rv-what">${esc(tx('Quando é que o trabalho difícil correu melhor esta semana?', 'When did hard work go best this week?'))}</p>
        <div class="md-chips" role="radiogroup" aria-label="${esc(tx('Quando', 'When'))}">${WHEN.map((w, i) => `<button type="button" role="radio" class="chip" aria-checked="${r.when === i}" aria-pressed="${r.when === i}" data-rw2="${i}">${esc(L(w))}</button>`).join('')}</div>
        <p class="rv-what">${esc(tx('O que te roubou foco?', 'What stole your focus?'))}</p>
        <div class="md-chips">${THIEVES.map((w, i) => `<button type="button" class="chip" aria-pressed="${r.thief.includes(i)}" data-rt2="${i}">${esc(L(w))}</button>`).join('')}</div>
        <label class="md-f"><span>${esc(tx('Uma mudança para a próxima semana', 'One change for next week'))}</span><input class="md-in" data-rf="change" maxlength="120" value="${esc(r.change)}" placeholder="${esc(tx('Ex.: email só às 11h e às 16h', 'E.g. email only at 11am and 4pm'))}"></label>
        <p class="pr-sub">${esc(tx('Observar o teu próprio padrão vale mais do que regras gerais sobre "horas de ouro".', 'Watching your own pattern is worth more than general rules about "golden hours".'))} ${Pr.srcTag('tip')} <a href="#experimentar/foco/dia">${esc(tx('Desenhar um dia →', 'Design a day →'))}</a></p>`;
      if (s === 'adi') return `<label class="md-f"><span>${esc(tx('Uma coisa que andaste a adiar', 'One thing you kept putting off'))}</span><input class="md-in" data-rf="adi" maxlength="120" value="${esc(r.adi)}"></label>
        <p class="rv-what">${esc(tx('O que mais pesou?', 'What weighed most?'))}</p>
        <div class="md-chips" role="radiogroup" aria-label="${esc(tx('Motivo', 'Reason'))}">${M.P_F.map(f => `<button type="button" role="radio" class="chip" aria-checked="${r.why === f.k}" aria-pressed="${r.why === f.k}" data-ry="${f.k}">${esc(L(f.l))}</button>`).join('')}</div>
        ${r.why ? `<p class="wk-fb ok">${esc(L(M.P_FIX[r.why]))}</p>` : ''}
        <label class="md-f"><span>${esc(tx('O primeiro passo, pequeno e concreto', 'The first step, small and concrete'))}</span><input class="md-in" data-rf="first" maxlength="120" value="${esc(r.first)}"></label>
        <p class="pr-sub"><a href="#experimentar/adiar">${esc(tx('Explorar no laboratório "Porque estou a adiar isto?" →', 'Explore in the "Why am I putting this off?" lab →'))}</a></p>`;
      if (s === 'imp') return `<label class="md-f"><span>${esc(tx('A coisa importante (não urgente) da próxima semana', 'Next week\'s important (not urgent) thing'))}</span><input class="md-in" data-rf="imp" maxlength="120" value="${esc(r.imp)}"></label>
        <label class="md-f"><span>${esc(tx('Quando — o bloco no calendário', 'When — the calendar block'))}</span><input class="md-in" data-rf="block" maxlength="60" value="${esc(r.block)}" placeholder="${esc(tx('Ex.: terça 9:00–11:00', 'E.g. Tuesday 9:00–11:00'))}"></label>
        <p class="pr-sub">${esc(tx('Se não tiver hora marcada, a urgência dos outros vai ganhar-lhe — mesmo quando vale menos.', 'Without a booked time, other people\'s urgency will beat it — even when it is worth less.'))} ${Pr.srcTag('res')} <a href="#experimentar/prioridades/urgencia">${esc(tx('A armadilha da urgência →', 'The urgency trap →'))}</a></p>`;
      const sum = summary();
      return `<p class="rv-what">${esc(tx('A tua revisão desta semana:', 'Your review this week:'))}</p>
        ${sum.length ? `<ul class="md-rsum">${sum.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="pr-sub">${esc(tx('Ainda vazia — volta aos passos anteriores.', 'Still empty — go back to the earlier steps.'))}</p>`}
        <div class="pr-row"><button type="button" class="btn btn-primary" data-rsave ${sum.length ? '' : 'disabled'}>${esc(tx('Guardar e começar a próxima', 'Save and start the next one'))}</button></div>
        ${histHtml()}`;
    };
    const histHtml = () => { const h = get('prevHist', []); return h.length ? `<div class="md-hist"><p class="pr-kicker">${esc(tx('Revisões anteriores', 'Earlier reviews'))}</p>${h.slice().reverse().map(x => `<details><summary>${esc(x.d)}</summary><ul>${x.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>`).join('')}</div>` : ''; };
    const draw = (focusSel) => {
      host.innerHTML = `<div class="pr-sheet rv md-rv">
        <ol class="rv-steps md-rv-steps">${PR_STEPS.map((s, i) => `<li class="${i === r.step ? 'on' : i < r.step ? 'done' : ''}"><button type="button" data-rs="${i}" ${i === r.step ? 'aria-current="step"' : ''}><span class="pr-mono">${i + 1}</span> ${esc(L(s.n))}</button></li>`).join('')}</ol>
        <div class="md-rv-body" aria-live="polite">${body()}</div>
        ${r.step < PR_STEPS.length - 1 ? `<div class="pr-row" style="margin-top:1.2rem">${r.step ? `<button type="button" class="btn" data-rprev>← ${esc(tx('Anterior', 'Previous'))}</button>` : ''}<button type="button" class="btn btn-primary" data-rnext>${esc(tx('Passo seguinte', 'Next step'))} →</button></div>` : ''}
      </div>`;
      if (focusSel) { const f = $(focusSel, host); if (f) f.focus(); }
    };
    draw();
    host.addEventListener('input', e => { const k = e.target.dataset.rf; if (k) { r[k] = e.target.value; save(); } });
    host.addEventListener('click', e => {
      const go = i => { r.step = i; save(); draw(`[data-rs="${i}"]`); };
      const s = e.target.closest('[data-rs]'); if (s) return go(+s.dataset.rs);
      if (e.target.closest('[data-rnext]')) return go(Math.min(PR_STEPS.length - 1, r.step + 1));
      if (e.target.closest('[data-rprev]')) return go(Math.max(0, r.step - 1));
      const h = e.target.closest('[data-rh]'); if (h) { const [id, k] = h.dataset.rh.split(':'); r.hab[id] = k; save(); draw(`[data-rh="${h.dataset.rh}"]`); return; }
      const w = e.target.closest('[data-rw2]'); if (w) { r.when = +w.dataset.rw2; save(); draw(`[data-rw2="${r.when}"]`); return; }
      const t = e.target.closest('[data-rt2]'); if (t) { const i = +t.dataset.rt2; r.thief = r.thief.includes(i) ? r.thief.filter(x => x !== i) : r.thief.concat([i]); save(); draw(`[data-rt2="${i}"]`); return; }
      const y = e.target.closest('[data-ry]'); if (y) { r.why = y.dataset.ry; save(); draw(`[data-ry="${r.why}"]`); return; }
      if (e.target.closest('[data-rsave]')) {
        put('prevHist', get('prevHist', []).concat([{ d: M.fmtD(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }), lines: summary() }]).slice(-12));
        r = { step: 0, hab: {}, when: null, thief: [], change: '', adi: '', why: null, first: '', imp: '', block: '' }; save(); draw('[data-rs="0"]');
        Pr.toast(tx('Revisão guardada neste browser.', 'Review saved in this browser.'));
      }
    });
  }

  Pr.route('experimentar/decidir', decPage);
  Pr.route('experimentar/motivacao', motPage);
  Pr.route('experimentar/prioridades', priPage);
  Pr.route('aplicar/revisao-pessoal', persPage);
})();
