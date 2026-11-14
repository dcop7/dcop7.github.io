/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — o ciclo em prática (global `PrWeek`)
   ──────────────────────────────────────────────────────────────────
   Três componentes que escrevem no mundo de exemplo, cada um com o src
   de quem o usa (a semana guiada passa 'week'; as páginas soltas usam
   'hoje' e 'rev'), por isso cada experiência repõe-se sozinha:

     big3(el, src, opts)     — manhã (capacidade + escolher três) e
                               noite (✓ → ✕ + rascunho de amanhã)
     review(el, src, opts)   — a revisão semanal em sete passos
     a semana guiada         — segunda a sexta: Big 3, o que chega
                               durante o dia, o fecho, e a revisão
   ══════════════════════════════════════════════════════════════════ */
const PrWeek = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, crumbs } = Pr;
  const W = PrWorld;
  const B = (pt, en) => ({ pt, en });
  const CAP = 15;

  const day = d => W.state().days[d] || { big3: [], marks: {}, draft: '' };
  const taskById = id => W.state().tasks.find(t => t.id === id);

  /* ════════════════ Big 3 ════════════════ */
  function big3(el, src, opts) {
    opts = opts || {};
    const now = W.clock(), d = day(now);
    const phase = opts.phase || (d.big3.length ? 'evening' : 'morning');
    const prevDraft = (W.state().days[now - 1] || {}).draft;
    if (phase === 'morning') {
      const list = W.filterTasks('due7');
      const picked = d.big3.slice();
      el.innerHTML = `<div class="wk-b3">
        <div class="wk-b3-h"><p class="pr-kicker">${esc(tx('Manhã · 2 min', 'Morning · 2 min'))}</p><h3 class="pr-h3">${esc(tx('Abre "Próximos 7 dias" e escolhe três', 'Open "Due in 7 days" and pick three'))}</h3>
          ${capBar(list.length)}${prevDraft ? `<p class="wk-draft">✎ ${esc(tx('Rascunho de ontem: ', "Yesterday's draft: "))}<i>${esc(prevDraft)}</i></p>` : ''}</div>
        <ul class="wk-pick">${list.map(t => `<li><label><input type="checkbox" data-b3="${t.id}" ${picked.includes(t.id) ? 'checked' : ''} ${!picked.includes(t.id) && picked.length >= 3 ? 'disabled' : ''}>
          ${PrLearn.taskLi(t, now).replace(/^<li>|<\/li>$/g, '')}</label></li>`).join('') || `<li class="pr-sub">${esc(tx('A lista dos próximos 7 dias está vazia.', 'The next-7-days list is empty.'))}</li>`}</ul>
        <div class="pr-row"><button type="button" class="btn btn-primary" data-b3-go ${picked.length ? '' : 'disabled'}>${esc(tx(`Escrever no caderno (${picked.length}/3)`, `Write in the notebook (${picked.length}/3)`))}</button>
          <span class="pr-sub">${esc(tx('Três, não mais. É uma lista curta: as tarefas continuam na lista.', 'Three, no more. It is a shortlist: the tasks stay on the list.'))}</span></div></div>`;
      el.onchange = e => {
        const c = e.target.closest('[data-b3]'); if (!c) return;
        const ids = $$('[data-b3]:checked', el).map(x => x.dataset.b3).slice(0, 3);
        d.big3 = ids;
        W.apply(src, { o: 'day', day: now, patch: { big3: ids } });
        big3(el, src, Object.assign({}, opts, { phase: 'morning' }));
      };
      el.onclick = e => { if (e.target.closest('[data-b3-go]')) { if (opts.onPicked) opts.onPicked(); else big3(el, src, Object.assign({}, opts, { phase: 'day' })); } };
      return;
    }
    /* página do caderno: durante o dia (só ver) e à noite (fechar) */
    const items = d.big3.map(id => taskById(id)).filter(Boolean);
    const marks = d.marks || {};
    const evening = phase === 'evening';
    el.innerHTML = `<div class="wk-nb">
      <div class="lr-page wk-page"><p class="lr-page-d">${esc(Pr.fmtDay(now, 'long'))}</p><p class="lr-page-h">BIG 3</p>
        ${items.map(t => `<div class="wk-nb-it"><span class="lr-sym">${marks[t.id] || '□'}</span><span>${esc(L(t.t))}</span>
          ${evening ? `<span class="wk-sy" role="group">${['✓', '→', '✕'].map(s => `<button type="button" data-mk="${t.id}" data-s="${s}" aria-pressed="${marks[t.id] === s}" title="${esc(symName(s))}">${s}</button>`).join('')}</span>` : ''}</div>`).join('')
          || `<p class="lr-page-tm">${esc(tx('(nada escolhido hoje)', '(nothing picked today)'))}</p>`}
        ${evening ? `<p class="lr-page-tm"><label>${esc(tx('Amanhã, talvez:', 'Tomorrow, maybe:'))} <input type="text" data-draft maxlength="80" value="${esc(d.draft || '')}" placeholder="${esc(tx('opcional', 'optional'))}"></label></p>` : ''}
      </div>
      <div class="wk-nb-side">${evening ? `<p class="pr-kicker">${esc(tx('Noite · 2 min', 'Evening · 2 min'))}</p><p class="pr-sub">${esc(tx('Fecha cada item. O que acontece na lista de tarefas:', 'Close each item. What happens on the task list:'))}</p>
        <ul class="wk-legend"><li><b>✓</b> ${esc(tx('concluída na lista também', 'checked off on the list too'))}</li><li><b>→</b> ${esc(tx('fica na lista, tal como está', 'stays on the list as it is'))}</li><li><b>✕</b> ${esc(tx('apagada da lista também', 'cleared from the list too'))}</li></ul>
        <button type="button" class="btn btn-primary" data-close ${items.every(t => marks[t.id]) ? '' : 'disabled'}>${esc(opts.closeLabel || tx('Fechar o dia', 'Close the day'))}</button>`
        : `<p class="pr-kicker">${esc(tx('Durante o dia', 'During the day'))}</p><p class="pr-sub">${esc(tx('O caderno fica aberto para pensar. O que chegar vai para a lista ou para as Notas — nunca para esta página.', 'The notebook stays open for thinking. Anything that arrives goes to the list or Notes — never onto this page.'))}</p>
        ${opts.noEvening ? '' : `<button type="button" class="btn" data-to-evening>${esc(tx('Passar à noite', 'Go to the evening'))} ${ICON.arrow}</button>`}`}</div></div>`;
    el.onclick = e => {
      const m = e.target.closest('[data-mk]');
      if (m) { const nm = Object.assign({}, marks, { [m.dataset.mk]: m.dataset.s }); W.apply(src, { o: 'day', day: now, patch: { marks: nm } }); big3(el, src, opts); return; }
      if (e.target.closest('[data-to-evening]')) { big3(el, src, Object.assign({}, opts, { phase: 'evening' })); return; }
      if (e.target.closest('[data-close]')) {
        const ops = [];
        items.forEach(t => { const s = marks[t.id]; if (s === '✓') ops.push(...W.completeOps(t)); if (s === '✕') ops.push({ o: 'del', db: 'tasks', id: t.id }); });
        const dr = $('[data-draft]', el); if (dr) ops.push({ o: 'day', day: now, patch: { draft: dr.value.trim(), closed: true } });
        W.apply(src, ops);
        const n1 = items.filter(t => marks[t.id] === '✓').length, n3 = items.filter(t => marks[t.id] === '✕').length;
        Pr.toast(tx(`Dia fechado: ${n1} concluída(s), ${n3} apagada(s) da lista.`, `Day closed: ${n1} completed, ${n3} cleared from the list.`));
        if (opts.onClosed) opts.onClosed(); else big3(el, src, Object.assign({}, opts, { phase: 'evening' }));
      }
    };
    el.onchange = e => { if (e.target.matches('[data-draft]')) W.apply(src, { o: 'day', day: now, patch: { draft: e.target.value.trim() } }); };
  }
  const symName = s => ({ '✓': tx('Feita', 'Done'), '→': tx('Ainda aberta', 'Still open'), '✕': tx('Já não é precisa', 'No longer needed') }[s]);
  function capBar(n) {
    const over = n > CAP;
    return `<div class="wk-cap ${over ? 'over' : ''}"><div class="wk-cap-bar"><i style="width:${Math.min(100, n / CAP * 100)}%"></i></div>
      <span>${esc(tx(`${n} tarefas nos próximos 7 dias`, `${n} tasks in the next 7 days`))}${over ? ' — ' + esc(tx(`mais de ~${CAP}: empurra as menos importantes antes de acrescentar`, `more than ~${CAP}: push the least important out before adding`)) : ''}</span></div>`;
  }

  /* ════════════════ revisão semanal ════════════════ */
  const STEPS = [
    { id: 'tasks', n: B('Tarefas', 'Tasks'), m: 3 }, { id: 'follow', n: B('Seguimentos', 'Follow-ups'), m: 2 }, { id: 'projects', n: B('Projetos', 'Projects'), m: 3 },
    { id: 'new', n: B('Notas novas', 'New notes'), m: 4 }, { id: 'old', n: B('Notas antigas', 'Old notes'), m: 3 }, { id: 'next', n: B('Próxima semana', 'Next week'), m: 3 }, { id: 'close', n: B('Fechar', 'Close'), m: 1 },
  ];
  /* sugestões para as notas do mundo de exemplo (só aparecem depois de escolheres) */
  const HINT = {
    n4: ['keep', 'atlas', B('Vale a pena encontrar depois: guarda-se com a equipa Atlas. Quando houver três riscos, gradua para uma base Riscos e dívida.', 'Worth finding later: keep it with team Atlas. Once there are three risks, it graduates into a Risks and Debt database.')],
    n6: ['keep', 'cobalt', B('Uma leitura de métrica: guarda-se com a Cobalt (e a etiqueta "metric").', 'A metric reading: keep it with Cobalt (and the "metric" tag).')],
    n8: ['keep', 'org', B('Um facto de fornecedor que serve a todos: Toda a organização.', 'A vendor fact that serves everyone: Org-wide.')],
    n11: ['keep', 'atlas', B('Informação para a migração: guarda-se com a Atlas.', 'Information for the migration: keep it with Atlas.')],
    n14: ['act', null, B('Esconde uma ação: "Verificar se a cache recuperou (Renovação do CI)". A nota apaga-se.', 'It hides an action: "Verify the build cache recovered (CI revamp)". The note is deleted.')],
    n15: ['toss', null, B('Ninguém vai perceber isto daqui a uma semana. Fora.', 'Nobody will understand this in a week. Out.')],
    s7: ['keep', 'geral', B('Um facto útil: guarda-se em Geral.', 'A useful fact: keep it in General.')],
    s8: ['act', null, B('É uma ação: "Comprar marcadores" na lista #Geral. A nota apaga-se.', 'It is an action: "Buy highlighters" on #General. The note is deleted.')],
    s9: ['toss', null, B('Ilegível daqui a uma semana. Fora.', 'Illegible in a week. Out.')],
    s10: ['keep', 'casa', B('Informação para a mudança: área Casa.', 'Information for the move: the Home area.')],
    we1: ['grad', 'atlas', B('É a terceira decisão: pede uma base Decisões (ou guarda-se com a Atlas até a criares).', 'It is the third decision: it asks for a Decisions database (or keep it with Atlas until you create it).')],
    we6: ['keep', 'org', B('Facto transversal: Toda a organização.', 'Cross-team fact: Org-wide.')],
    se3: ['keep', 'geral', B('Facto: Geral.', 'Fact: General.')],
    n16: ['file', 'o_elena', B('Uma preferência sobre uma pessoa vive na página de 1:1 dela (o bloco "Próximo").', "A preference about a person lives on that person's 1:1 page (the \"Next\" block).")],
    n17: ['file', 'atlas', B('Como a equipa trabalha: página da equipa Atlas.', 'How the team works: the Atlas team page.')],
    n18: ['archive', null, B('O URL mudou e já está nos favoritos de todos: já não faz sentido. Arquiva-se.', 'The URL changed and everyone has bookmarked it: it no longer makes sense. Archive.')],
    n19: ['leave', null, B('Ainda útil, sem sítio melhor: deixa-se.', 'Still useful, nowhere better yet: leave it.')],
    n20: ['leave', null, B('Ainda vale até 1 dez. Deixa-se — e na próxima passagem arquiva-se.', 'Still valid until 1 Dec. Leave it — archive it next time.')],
    s11: ['file', 'saude', B('Uma regra da área Saúde: página da área.', 'A rule of the Health area: the area page.')],
    s12: ['archive', null, B('Já mudou: arquiva-se.', 'It already changed: archive.')],
    s13: ['file', 'ines', B('Sobre uma pessoa: página da Inês em Pessoas.', "About a person: Inês's page in People.")],
  };

  const hintOf = id => { const r = W.rec('notes', id); return HINT[id] || (r && r.wk && HINT[(W.scenario() === 'study' ? 's' : 'w') + r.wk]); };

  function review(el, src, opts) {
    opts = opts || {};
    const S = { step: 0, bad: !!opts.bad, log: [], hintShown: {} };
    const steps = () => S.bad ? [STEPS[0], STEPS[1], STEPS[6]] : STEPS;
    const now = () => W.clock();
    const ap = (ops, msg) => { if (W.apply(src, ops) && msg) S.log.push(msg); };

    function draw() {
      const st = steps(), cur = st[S.step];
      const total = st.reduce((s, x) => s + x.m, 0);
      el.innerHTML = `<div class="rv">
        <div class="rv-top"><label class="lr-toggle"><input type="checkbox" data-bad ${S.bad ? 'checked' : ''}> ${esc(tx('Semana má — só 1, 2 e fechar (5 min)', 'Bad week — only 1, 2 and close (5 min)'))}</label>
          <span class="pr-sub">${esc(tx(`Orçamento: ${total} min · ${Pr.fmtDay(now(), 'long')}`, `Budget: ${total} min · ${Pr.fmtDay(now(), 'long')}`))}</span></div>
        <ol class="rv-steps">${st.map((x, i) => `<li class="${i === S.step ? 'on' : i < S.step ? 'done' : ''}"><button type="button" data-step="${i}"><span class="pr-mono">${STEPS.indexOf(x) + 1}</span>${esc(L(x.n))}<small>${x.m}′</small></button></li>`).join('')}</ol>
        <div class="rv-body" data-rvb>${body(cur.id)}</div>
        <div class="rv-nav">${S.step > 0 ? `<button type="button" class="btn btn-ghost" data-prev>← ${esc(tx('Anterior', 'Previous'))}</button>` : '<span></span>'}
          ${cur.id === 'close' ? `<button type="button" class="btn btn-primary" data-finish>${esc(tx('Terminar a revisão', 'Finish the review'))}</button>` : `<button type="button" class="btn btn-primary" data-next>${esc(tx('Passo seguinte', 'Next step'))} →</button>`}</div>
      </div>`;
      const on = $('.rv-steps li.on', el), ol = on && on.parentElement;
      if (ol && ol.scrollWidth > ol.clientWidth) ol.scrollLeft = on.offsetLeft - 16;
    }

    function body(id) {
      const n = now();
      if (id === 'tasks') {
        const list = W.filterTasks('due7');
        return `<p class="rv-what">${esc(tx('"Próximos 7 dias". Atrasadas: fazer, reagendar ou apagar. Mais de ~15? Empurra as menos importantes ANTES de acrescentar o que quer que seja.', '"Due in 7 days". Overdue: do, reschedule or delete. More than ~15? Push the least important out BEFORE adding anything.'))}</p>
          ${capBar(list.length)}
          <ul class="rv-list">${list.map(t => { const od = t.due < n; return `<li class="${od ? 'od' : ''}"><div>${esc(L(t.t))}<small>${esc(Pr.relDay(t.due, n))} · ${esc(L(W.box(t.box).l))}</small></div>
            <span class="rv-acts"><button type="button" class="btn btn-sm" data-t-do="${t.id}">✓ ${esc(tx('Feita', 'Done'))}</button><button type="button" class="btn btn-sm" data-t-push="${t.id}">+7 ${esc(tx('dias', 'days'))}</button>${od ? `<button type="button" class="btn btn-sm btn-ghost btn-danger" data-t-del="${t.id}">${esc(tx('Apagar', 'Delete'))}</button>` : ''}</span></li>`; }).join('')}</ul>`;
      }
      if (id === 'follow') {
        const list = W.filterTasks('follow');
        return `<p class="rv-what">${esc(tx('"Seguimentos": todas as tarefas que começam por "Insistir". Envia os lembretes devidos e dá-lhes nova data; fecha o que já chegou.', '"Follow-ups": every task starting with "Chase". Send the nudges that are due and set a new date; close what has arrived.'))}</p>
          <ul class="rv-list">${list.map(t => `<li class="${t.due != null && t.due <= n ? 'od' : ''}"><div>${esc(L(t.t))}<small>${esc(t.due != null ? (t.due <= n ? tx('lembrete devido: ', 'nudge due: ') : tx('próximo lembrete: ', 'next nudge: ')) + Pr.relDay(t.due, n) : tx('sem data', 'no date'))}</small></div>
            <span class="rv-acts"><button type="button" class="btn btn-sm" data-f-nudge="${t.id}">${esc(tx('Enviei → +3 dias', 'Sent → +3 days'))}</button><button type="button" class="btn btn-sm" data-t-do="${t.id}">✓ ${esc(tx('Chegou', 'Arrived'))}</button></span></li>`).join('') || `<li class="pr-sub">${esc(tx('Ninguém por quem esperar.', 'Nobody to wait for.'))}</li>`}</ul>`;
      }
      if (id === 'projects') {
        const projs = W.recs('projects').filter(p => p.status === 'now');
        return `<p class="rv-what">${esc(tx('Cada projeto "Now": pesquisa o nome dele na lista de tarefas. Há pelo menos uma tarefa aberta? Se não: a próxima ação, ou On Hold / Done.', 'Each "Now" project: search its name in the task list. Is there at least one open task? If not: the next action, or On Hold / Done.'))}</p>
          <ul class="rv-list rv-proj">${projs.map(p => { const nm = W.title('projects', p); const open = W.tasks().filter(t => W.fold(W.projOf(L(t.t)) || '') === W.fold(nm));
            return `<li class="${open.length ? '' : 'od'}"><div><b>${esc(nm)}</b><small class="pr-mono">search: ${esc(nm)} → ${open.length}</small>
              ${open.length ? `<ul class="rv-sub">${open.slice(0, 3).map(t => `<li>${esc(L(t.t))}</li>`).join('')}</ul>` : `<div class="rv-na"><input type="text" maxlength="90" data-na-in="${p.id}" placeholder="${esc(tx('Próxima ação, começada por um verbo…', 'Next action, starting with a verb…'))}"><button type="button" class="btn btn-sm" data-na="${p.id}">${esc(tx('Criar tarefa', 'Create task'))}</button></div>`}</div>
              <span class="rv-acts">${open.length ? `<span class="rv-ok">${ICON.check} ${esc(tx('tem próxima ação', 'has a next action'))}</span>` : `<button type="button" class="btn btn-sm" data-p-st="${p.id}" data-v="hold">On Hold</button><button type="button" class="btn btn-sm" data-p-st="${p.id}" data-v="done">Done</button>`}</span></li>`; }).join('')}</ul>`;
      }
      if (id === 'new') {
        const rows = W.recs('notes').filter(r => !(r.team || []).length);
        const hubRecs = W.recs('teams');
        const hasDec = !!W.schemaOf('decisions');
        return `<p class="rv-what">${esc(tx('Vista "Sem equipa". Um destino por linha: Guardar (dar-lhe equipa), Agir (vira tarefa), Deitar fora, Graduar (para uma base).', '"No team" view. One fate per row: Keep (give it a team), Act (it becomes a task), Toss, Graduate (into a database).'))}</p>
          <ul class="rv-list rv-notes">${rows.map(r => { const h = hintOf(r.id); return `<li data-row="${r.id}"><div>${esc(W.title('notes', r))}<small>${esc(Pr.relDay(r.cr, n))}</small>${S.hintShown[r.id] && h ? `<p class="rv-hint">${esc(L(h[2]))}</p>` : ''}</div>
            <span class="rv-acts rv-fates"><span class="rv-keep"><select data-keep-sel="${r.id}" aria-label="${esc(L(W.hub().prop))}"><option value="">${esc(L(W.hub().prop))}…</option>${hubRecs.map(x => `<option value="${x.id}" ${h && h[0] === 'keep' && h[1] === x.id && S.hintShown[r.id] ? 'selected' : ''}>${esc(W.title('teams', x))}</option>`).join('')}</select><button type="button" class="btn btn-sm" data-keep="${r.id}">${esc(tx('Guardar', 'Keep'))}</button></span>
              <button type="button" class="btn btn-sm" data-act-n="${r.id}">${esc(tx('Agir', 'Act'))}</button><button type="button" class="btn btn-sm" data-toss="${r.id}">${esc(tx('Deitar fora', 'Toss'))}</button>
              <button type="button" class="btn btn-sm" data-grad="${r.id}" title="${esc(hasDec ? tx('Para a base Decisões', 'Into the Decisions database') : tx('Para uma linha nova em Projetos', 'Into a new Projects row'))}">${esc(tx('Graduar', 'Graduate'))}${hasDec ? ' ⚖️' : ' 🗂️'}</button>
              ${h && !S.hintShown[r.id] ? `<button type="button" class="btn btn-sm btn-ghost" data-hint="${r.id}">${esc(tx('Sugestão', 'Hint'))}</button>` : ''}</span></li>`; }).join('') || `<li class="pr-sub">${esc(tx('Fila vazia. Triagem em dia.', 'Empty queue. Triage up to date.'))}</li>`}</ul>
          ${rows.length > 30 ? `<p class="cp-warn">${esc(tx('Mais de ~30 linhas: esta semana, faz a triagem duas vezes.', 'More than ~30 rows: triage twice this week.'))}</p>` : ''}`;
      }
      if (id === 'old') {
        const v = (W.state().views.notes || []).find(x => x.id === 'review');
        const rows = v ? W.query('notes', v).rows : [];
        const targets = fileTargets();
        return `<p class="rv-what">${esc(tx('Vista "Revisão": notas guardadas há 30–37 dias. Cada uma aparece uma vez. Arquivar no sítio (copiar a linha para a página a que pertence e arquivar), Deixar, ou Arquivar.', '"Review" view: notes kept 30–37 days ago. Each one comes up once. File (copy the line into the page it belongs to and archive), Leave, or Archive.'))}</p>
          <ul class="rv-list">${rows.map(r => { const h = HINT[r.id]; return `<li><div>${esc(W.title('notes', r))}<small>${esc(Pr.relDay(r.cr, n))}</small>${S.hintShown[r.id] && h ? `<p class="rv-hint">${esc(L(h[2]))}</p>` : ''}</div>
            <span class="rv-acts rv-fates"><span class="rv-keep"><select data-file-sel="${r.id}" aria-label="${esc(tx('Página de destino', 'Target page'))}"><option value="">${esc(tx('Página…', 'Page…'))}</option>${targets.map(g => `<optgroup label="${esc(g.label)}">${g.items.map(x => `<option value="${g.db}:${x.id}">${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}</select><button type="button" class="btn btn-sm" data-file="${r.id}">${esc(tx('Arquivar no sítio', 'File'))}</button></span>
              <button type="button" class="btn btn-sm" data-leave="${r.id}">${esc(tx('Deixar', 'Leave'))}</button><button type="button" class="btn btn-sm" data-arch="${r.id}">${esc(tx('Arquivar', 'Archive'))}</button>
              ${h && !S.hintShown[r.id] ? `<button type="button" class="btn btn-sm btn-ghost" data-hint="${r.id}">${esc(tx('Sugestão', 'Hint'))}</button>` : ''}</span></li>`; }).join('') || `<li class="pr-sub">${esc(tx('Nenhuma nota na janela de 30–37 dias. (No playground, "Avançar 1 semana" faz entrar notas novas.)', 'No notes in the 30–37-day window. (In the playground, "Forward 1 week" brings new notes in.)'))}</li>`}</ul>`;
      }
      if (id === 'next') {
        const wd = Pr.weekday(n), mon = n + (((8 - wd) % 7) || 7);
        const days = [0, 1, 2, 3, 4].map(i => mon + i);
        const cal = W.state().cal;
        const cand = W.filterTasks('due7').concat(W.tasks().filter(t => t.due != null && t.due >= n + 7 && t.due < n + 14)).filter((t, i, a) => a.indexOf(t) === i).slice(0, 10);
        const focus = cal.find(c => c.kind === 'focus' && days.includes(c.day));
        return `<p class="rv-what">${esc(tx('Olha para o calendário e para "Próximos 7 dias". Escolhe UMA coisa para um bloco protegido de 30+ minutos e marca-o.', 'Look at the calendar and "Due in 7 days". Choose ONE thing for a protected focus block of 30+ minutes and book it.'))}</p>
          <div class="rv-cal">${days.map(d => `<div class="rv-day"><p class="pr-kicker">${esc(Pr.fmtDay(d))}</p>${cal.filter(c => c.day === d).sort((a, b) => a.h - b.h).map(c => `<div class="rv-ev ${c.kind}"><span class="pr-mono">${String(Math.floor(c.h)).padStart(2, '0')}:${c.h % 1 ? '30' : '00'}</span> ${esc(L(c.t))}</div>`).join('')}
            ${focus ? '' : `<button type="button" class="rv-slot" data-slot="${d}">${ICON.plus} ${esc(tx('bloco aqui', 'block here'))}</button>`}</div>`).join('')}</div>
          ${focus ? `<p class="rv-done">${ICON.check} ${esc(tx('Bloco marcado: ', 'Block booked: '))}<b>${esc(L(focus.t))}</b> — ${esc(Pr.fmtDay(focus.day, 'long'))}. <button type="button" class="btn btn-sm btn-ghost" data-unslot="${focus.id}">${esc(tx('Desmarcar', 'Unbook'))}</button></p>`
            : `<label class="rv-focus">${esc(tx('A coisa mais importante:', 'The most important thing:'))} <select data-focus-t>${cand.map(t => `<option value="${t.id}">${esc(L(t.t))}</option>`).join('')}</select></label>
              <p class="pr-sub">${esc(tx('Depois toca num dia para marcar o bloco (10:00–11:00 se estiver livre, senão à tarde). Um empréstimo leve do time blocking — não é agendar todas as horas.', 'Then tap a day to book the block (10:00–11:00 if free, otherwise in the afternoon). A light borrow from time blocking — not scheduling every hour.'))}</p>`}`;
      }
      if (id === 'close') {
        return `<p class="rv-what">${esc(tx('O que estiver solto — em papel, na cabeça — vai para a lista de tarefas ou para as Notas. Depois, acabou.', 'Anything loose — on paper, in your head — goes to the task list or Notes. Then you are done.'))}</p>
          <div class="rv-loose"><input type="text" maxlength="160" data-loose placeholder="${esc(tx('Ex.: Enviar a ata ao Rui #Trabalho-Geral segunda', 'E.g. Send the minutes to Rui #Work-General mon'))}">
          <button type="button" class="btn btn-sm" data-loose-t>${esc(tx('→ Tarefa', '→ Task'))}</button><button type="button" class="btn btn-sm" data-loose-n>${esc(tx('→ Nota', '→ Note'))}</button></div>
          <div class="rv-sum"><p class="pr-kicker">${esc(tx('Nesta revisão', 'In this review'))}</p>${S.log.length ? `<ul>${S.log.slice(-12).map(x => `<li>${esc(x)}</li>`).join('')}</ul>${S.log.length > 12 ? `<p class="pr-sub">+${S.log.length - 12}</p>` : ''}` : `<p class="pr-sub">${esc(tx('Ainda nada mudou.', 'Nothing changed yet.'))}</p>`}</div>`;
      }
      return '';
    }
    function fileTargets() {
      const g = [{ db: 'teams', label: L(W.hub().db), items: W.recs('teams').map(x => ({ id: x.id, label: W.title('teams', x) })) },
        { db: 'projects', label: tx('Projetos', 'Projects'), items: W.recs('projects').filter(p => p.status !== 'done').map(x => ({ id: x.id, label: W.title('projects', x) })) }];
      if (W.schemaOf('oneonones')) g.push({ db: 'oneonones', label: '1:1', items: W.recs('oneonones').map(x => ({ id: x.id, label: W.title('oneonones', x) })) });
      else g.push({ db: 'persons', label: L(W.hub().persons), items: W.recs('persons').map(x => ({ id: x.id, label: W.title('persons', x) })) });
      g.push({ db: 'meetings', label: L(W.hub().meetings), items: W.recs('meetings').map(x => ({ id: x.id, label: W.title('meetings', x) })) });
      return g;
    }
    function judge(id, fate, target) {
      const h = hintOf(id); if (!h) return '';
      const ok = h[0] === fate && (!h[1] || !target || h[1] === target);
      return ok ? tx(' — boa escolha.', ' — good call.') : tx(' — a sugestão era outra: ', ' — the hint was different: ') + L(h[2]);
    }
    const verbFix = s => { const t = String(s).replace(/^[^:]{2,30}:\s*/, '').trim(); return PrCapture.VERB_RX.test(t) ? t : tx('Verificar: ', 'Verify: ') + t; };

    el.onclick = e => {
      const t = e.target;
      const q = sel => t.closest(sel);
      let b;
      if ((b = q('[data-step]'))) { S.step = +b.dataset.step; draw(); return; }
      if (q('[data-next]')) { S.step = Math.min(steps().length - 1, S.step + 1); draw(); el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
      if (q('[data-prev]')) { S.step = Math.max(0, S.step - 1); draw(); return; }
      if (q('[data-finish]')) { if (opts.onDone) opts.onDone(S.log); return; }
      if ((b = q('[data-hint]'))) { S.hintShown[b.dataset.hint] = 1; draw(); return; }
      if ((b = q('[data-t-do]'))) { const tk = taskById(b.dataset.tDo); ap(W.completeOps(tk), tx('Concluída: ', 'Done: ') + L(tk.t)); draw(); return; }
      if ((b = q('[data-t-push]'))) { const tk = taskById(b.dataset.tPush); ap({ o: 'set', db: 'tasks', id: tk.id, k: 'due', v: Math.max(tk.due, now()) + 7 }, tx('Adiada 7 dias: ', 'Pushed 7 days: ') + L(tk.t)); draw(); return; }
      if ((b = q('[data-t-del]'))) { const tk = taskById(b.dataset.tDel); ap({ o: 'del', db: 'tasks', id: tk.id }, tx('Apagada: ', 'Deleted: ') + L(tk.t)); draw(); return; }
      if ((b = q('[data-f-nudge]'))) { const tk = taskById(b.dataset.fNudge); ap({ o: 'set', db: 'tasks', id: tk.id, k: 'due', v: now() + 3 }, tx('Lembrete enviado: ', 'Nudge sent: ') + L(tk.t)); draw(); return; }
      if ((b = q('[data-na]'))) {
        const p = W.rec('projects', b.dataset.na), inp = $(`[data-na-in="${p.id}"]`, el), s = (inp.value || '').trim(); if (!s) { inp.focus(); return; }
        const title = `${s} (${W.title('projects', p)})`;
        if (!PrCapture.VERB_RX.test(s)) Pr.toast(tx('Dica: começa por um verbo.', 'Tip: start with a verb.'));
        ap(PrCapture.taskOp({ title, box: 'wp', due: null, p: null }), tx('Próxima ação: ', 'Next action: ') + title); draw(); return;
      }
      if ((b = q('[data-p-st]'))) { const p = W.rec('projects', b.dataset.pSt); ap({ o: 'set', db: 'projects', id: p.id, k: 'status', v: b.dataset.v }, `${W.title('projects', p)} → ${b.dataset.v === 'hold' ? 'On Hold' : 'Done'}`); draw(); return; }
      if ((b = q('[data-keep]'))) {
        const id = b.dataset.keep, sel = $(`[data-keep-sel="${id}"]`, el); if (!sel.value) { sel.focus(); Pr.toast(tx('Escolhe primeiro a ' + L(W.hub().oneLower) + '.', 'Pick the ' + L(W.hub().oneLower) + ' first.')); return; }
        const r = W.rec('notes', id); const nm = W.title('notes', r);
        rowOut(id, sel, () => ap({ o: 'set', db: 'notes', id, k: 'team', v: [sel.value] }, tx('Guardada: ', 'Kept: ') + nm + judge(id, 'keep', sel.value)), $('[data-step="0"]', el) ); return;
      }
      if ((b = q('[data-act-n]'))) { const id = b.dataset.actN, r = W.rec('notes', id), nm = W.title('notes', r);
        rowOut(id, null, () => ap([PrCapture.taskOp({ title: verbFix(nm), box: 'wg', due: null, p: null }), { o: 'del', db: 'notes', id }], tx('Virou tarefa: ', 'Became a task: ') + verbFix(nm) + judge(id, 'act'))); return; }
      if ((b = q('[data-toss]'))) { const id = b.dataset.toss, nm = W.title('notes', W.rec('notes', id)); rowOut(id, null, () => ap({ o: 'del', db: 'notes', id }, tx('Fora: ', 'Tossed: ') + nm + judge(id, 'toss'))); return; }
      if ((b = q('[data-grad]'))) {
        const id = b.dataset.grad, r = W.rec('notes', id), nm = W.title('notes', r);
        if (W.schemaOf('decisions')) {
          rowOut(id, null, () => ap([{ o: 'add', db: 'decisions', r: { id: 'd_' + id, name: nm.replace(/^(decis[aã]o|decision)\s*:\s*/i, ''), dstatus: 'acc', team: (r.team || []).slice(), conf: 'md', cr: r.cr, body: PrSeed.TEMPLATES.adr.body } }, { o: 'del', db: 'notes', id }], tx('Graduada para Decisões: ', 'Graduated to Decisions: ') + nm + judge(id, 'grad')));
        } else {
          rowOut(id, null, () => ap([{ o: 'add', db: 'projects', r: { id: 'p_' + id, name: nm.replace(/^[^:]{2,30}:\s*/, '').replace(/\s*\([^()]*\)\s*$/, ''), status: 'later', team: (r.team || []).slice(), body: PrSeed.TEMPLATES.project.body } }, { o: 'del', db: 'notes', id }], tx('Graduada para Projetos (Later): ', 'Graduated to Projects (Later): ') + nm + (hintOf(id) && hintOf(id)[0] === 'grad' ? tx(' — e se fosse a base Decisões? Cria-a no playground (passa o teste).', ' — what about a Decisions database? Create it in the playground (it passes the test).') : judge(id, 'grad'))));
        }
        return;
      }
      if ((b = q('[data-file]'))) {
        const id = b.dataset.file, sel = $(`[data-file-sel="${id}"]`, el); if (!sel.value) { sel.focus(); Pr.toast(tx('Escolhe a página de destino.', 'Pick the target page.')); return; }
        const [db, tid] = sel.value.split(':'), r = W.rec('notes', id), nm = W.title('notes', r);
        rowOut(id, null, () => ap([{ o: 'body+', db, id: tid, blocks: [{ k: 'p', t: `${Pr.fmtDay(now(), 'short')}: ${nm}` }] }, { o: 'set', db: 'notes', id, k: 'archived', v: true }],
          tx(`Arquivada no sítio (${W.title(db, W.rec(db, tid))}): `, `Filed (${W.title(db, W.rec(db, tid))}): `) + nm + judge(id, 'file', tid))); return;
      }
      if ((b = q('[data-leave]'))) { const id = b.dataset.leave, nm = W.title('notes', W.rec('notes', id)); S.log.push(tx('Deixada: ', 'Left: ') + nm + judge(id, 'leave')); const li = b.closest('li'); li.classList.add('rv-left'); li.querySelector('.rv-acts').innerHTML = `<span class="rv-ok">${esc(tx('deixada', 'left'))}</span>`; return; }
      if ((b = q('[data-arch]'))) { const id = b.dataset.arch, nm = W.title('notes', W.rec('notes', id)); rowOut(id, null, () => ap({ o: 'set', db: 'notes', id, k: 'archived', v: true }, tx('Arquivada: ', 'Archived: ') + nm + judge(id, 'archive'))); return; }
      if ((b = q('[data-slot]'))) {
        const d = +b.dataset.slot, sel = $('[data-focus-t]', el); const tk = sel && taskById(sel.value); if (!tk) return;
        const busy = W.state().cal.filter(c => c.day === d);
        const h = busy.some(c => c.h < 11 && c.h + c.len > 10) ? 15 : 10;
        ap({ o: 'add', db: 'cal', r: { id: 'f' + Date.now().toString(36), t: tx('Foco: ', 'Focus: ') + L(tk.t), day: d, h, len: 1, kind: 'focus' } }, tx('Bloco protegido: ', 'Focus block: ') + L(tk.t) + ' · ' + Pr.fmtDay(d)); draw(); return;
      }
      if ((b = q('[data-unslot]'))) { ap({ o: 'del', db: 'cal', id: b.dataset.unslot }); draw(); return; }
      if (q('[data-loose-t]') || q('[data-loose-n]')) {
        const inp = $('[data-loose]', el), s = inp.value.trim(); if (!s) { inp.focus(); return; }
        if (q('[data-loose-t]')) { const p = PrCapture.parse(s); ap(PrCapture.taskOp(p), tx('Tarefa: ', 'Task: ') + p.title); }
        else ap({ o: 'add', db: 'notes', r: { id: 'n' + Date.now().toString(36), name: s, team: [], tags: [] } }, tx('Nota: ', 'Note: ') + s);
        draw(); return;
      }
    };
    el.onchange = e => { if (e.target.matches('[data-bad]')) { S.bad = e.target.checked; S.step = 0; draw(); } };
    function rowOut(id, _sel, fn) {
      const li = $(`[data-row="${id}"]`, el) || $(`[data-leave="${id}"], [data-arch="${id}"], [data-file="${id}"]`, el)?.closest('li');
      if (li && Pr.motionOk()) { anime({ targets: li, opacity: [1, 0], translateX: [0, 30], duration: 260, easing: 'easeInQuad', complete: () => { fn(); draw(); } }); }
      else { fn(); draw(); }
    }
    draw();
    return { setBad: v => { S.bad = v; S.step = 0; draw(); } };
  }

  /* ════════════════ páginas soltas: Hoje e Revisão ════════════════ */
  function hojePage(rest, el) {
    PrShell.setArea('aplicar', tx('Hoje e os Big 3', 'Today and the Big 3'));
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:980px">
      ${crumbs([{ label: tx('Aplicar', 'Apply'), href: '#aplicar' }, { label: tx('Hoje e os Big 3', 'Today and the Big 3') }])}
      <header class="pr-head"><p class="pr-kicker">${Pr.kindTag('today')}</p><h1>${esc(tx('Hoje: três coisas, numa página que morre à noite', 'Today: three things, on a page that dies tonight'))}</h1>
        <p class="lede">${esc(tx('De manhã escolhes três da lista; à noite fechas cada uma. O caderno nunca guarda uma tarefa que a lista não tenha.', 'In the morning you pick three from the list; in the evening you close each one. The notebook never holds a task the list does not have.'))}</p></header>
      ${PrApp.worldBar('hoje')}
      <div class="pr-sheet wk-card" data-b3host></div>
      <div class="pr-row" style="margin-top:1rem"><button type="button" class="btn" data-tomorrow>${esc(tx('Avançar para amanhã', 'Move to tomorrow'))} →</button><a class="btn btn-ghost" href="#aprender/hoje">${esc(tx('Ler o capítulo', 'Read the chapter'))}</a></div>
      ${Pr.localNote()}</div>`;
    const host = $('[data-b3host]', el);
    const run = (phase) => big3(host, 'hoje', { phase, onPicked: () => run('day') });
    run();
    $('[data-tomorrow]', el).onclick = () => { W.apply('hoje', { o: 'clock', d: 1 }); run('morning'); Pr.toast(Pr.fmtDay(W.clock(), 'long')); };
  }
  function revPage(rest, el) {
    PrShell.setArea('aplicar', tx('Revisão semanal', 'Weekly review'));
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:1060px">
      ${crumbs([{ label: tx('Aplicar', 'Apply'), href: '#aplicar' }, { label: tx('Revisão semanal', 'Weekly review') }])}
      <header class="pr-head"><p class="pr-kicker">${Pr.kindTag('act')} ${Pr.kindTag('info')} ${Pr.kindTag('str')}</p><h1>${esc(tx('Uma reunião contigo, com agenda', 'One meeting with yourself, with an agenda'))}</h1>
        <p class="lede">${esc(tx('Sete passos sobre o estado atual do mundo de exemplo. O que fizeres aqui fica: as notas triadas aparecem nas equipas do playground, as tarefas mudam nos filtros.', 'Seven steps over the current state of the sample world. What you do here sticks: triaged notes show up on the playground teams, tasks change in the filters.'))}</p></header>
      ${PrApp.worldBar('rev')}
      <div class="pr-sheet wk-card" data-rvhost></div>${Pr.localNote()}</div>`;
    review($('[data-rvhost]', el), 'rev', { onDone: log => { Pr.toast(tx(`Revisão feita: ${log.length} alterações.`, `Review done: ${log.length} changes.`)); PrNav.go('experimentar/notion/teams/all'); } });
  }

  /* ════════════════ a semana guiada ════════════════ */
  const DESTS = {
    task: { l: B('Tarefa', 'Task'), d: B('lista de tarefas', 'task list'), k: 'act' },
    note: { l: B('Nota', 'Note'), d: B('caixa de Notas', 'Notes inbox'), k: 'info' },
    today: { l: B('Big 3 de hoje', "Today's Big 3"), d: B('caderno', 'notebook'), k: 'today' },
    meeting: { l: B('Página da reunião', 'Meeting page'), d: B('Reuniões', 'Meetings'), k: 'info' },
    project: { l: B('Projeto', 'Project'), d: B('base Projetos', 'Projects database'), k: 'str' },
  };
  const M = () => W.state().marks;
  const wk = () => M()['wk'] || null;
  const evs = () => PrSeed.WEEK[W.scenario()] || [];

  function weekPage(rest, el) {
    PrShell.setArea('aplicar', tx('Uma semana no sistema', 'A week in the system'));
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:1080px">
      ${crumbs([{ label: tx('Aplicar', 'Apply'), href: '#aplicar' }, { label: tx('Uma semana no sistema', 'A week in the system') }])}
      <header class="pr-head"><p class="pr-kicker">${['act', 'info', 'today', 'str'].map(Pr.kindTag).join(' ')}</p><h1>${esc(tx('Uma semana no sistema', 'A week in the system'))}</h1>
        <p class="lede">${esc(tx('Cinco dias, contados. Cada manhã escolhes os Big 3; durante o dia chegam coisas e decides para onde vão e como se escrevem; à noite fechas o dia; na sexta fazes a revisão. Tudo fica no mundo de exemplo — abre o playground no fim para ver o que a semana deixou.',
          'Five days, compressed. Each morning you pick the Big 3; during the day things arrive and you decide where they go and how to write them; in the evening you close the day; on Friday you run the review. Everything lands in the sample world — open the playground at the end to see what the week left behind.'))}</p></header>
      ${PrApp.worldBar('week')}
      <div data-wkhost></div>${Pr.localNote()}</div>`;
    drawWeek($('[data-wkhost]', el));
  }
  function setWk(patch) { W.apply('week', { o: 'mark', k: 'wk', v: Object.assign({}, wk(), patch) }); }

  function drawWeek(host) {
    const s = wk();
    if (!s) {
      const wd = Pr.weekday(W.clock()), toMon = wd === 1 ? 0 : ((8 - wd) % 7);
      host.innerHTML = `<div class="pr-sheet wk-card wk-start"><h2 class="pr-h2">${esc(tx('Pronto para segunda-feira?', 'Ready for Monday?'))}</h2>
        <p>${esc(tx(`Cenário: ${L(W.seed().label)}. ${evs().length} coisas vão chegar ao longo da semana.`, `Scenario: ${L(W.seed().label)}. ${evs().length} things will arrive during the week.`))}</p>
        ${toMon ? `<p class="pr-sub">${esc(tx(`O relógio do mundo está em ${Pr.fmtDay(W.clock(), 'long')}; a semana começa na segunda seguinte.`, `The world clock is at ${Pr.fmtDay(W.clock(), 'long')}; the week starts next Monday.`))}</p>` : ''}
        <button type="button" class="btn btn-primary" data-wk-start>${esc(tx('Começar a semana', 'Start the week'))} →</button></div>`;
      host.querySelector('[data-wk-start]').onclick = () => { const ops = []; if (toMon) ops.push({ o: 'clock', d: toMon }); W.apply('week', ops.concat([{ o: 'mark', k: 'wk', v: { start: W.clock() + toMon, d: 0, ph: 'morning', ev: 0 } }])); drawWeek(host); };
      return;
    }
    const dIdx = s.d, today = s.start + dIdx;
    const dayEv = evs().filter(e => e.day === dIdx);
    host.innerHTML = `<ol class="wk-days">${[0, 1, 2, 3, 4].map(i => `<li class="${i === dIdx && s.ph !== 'done' ? 'on' : i < dIdx || s.ph === 'done' ? 'done' : ''}"><b>${esc(Pr.fmtDay(s.start + i).split(' ')[0])}</b><span>${esc(Pr.fmtDay(s.start + i, 'short'))}</span></li>`).join('')}</ol>
      <div class="wk-phase"><span class="wk-ph ${s.ph === 'morning' ? 'on' : ''}">${esc(tx('Manhã', 'Morning'))}</span><span class="wk-ph ${s.ph === 'day' ? 'on' : ''}">${esc(tx('Dia', 'Day'))}</span><span class="wk-ph ${s.ph === 'evening' ? 'on' : ''}">${esc(tx('Noite', 'Evening'))}</span>${dIdx === 4 ? `<span class="wk-ph ${s.ph === 'review' ? 'on' : ''}">${esc(tx('Revisão', 'Review'))}</span>` : ''}</div>
      <div class="wk-stage" data-stage></div>`;
    const stage = $('[data-stage]', host);
    if (s.ph === 'morning') {
      stage.innerHTML = `<div class="pr-sheet wk-card" data-b3host></div>`;
      big3($('[data-b3host]', stage), 'week', { phase: 'morning', onPicked: () => { setWk({ ph: 'day', ev: 0 }); drawWeek(host); } });
    } else if (s.ph === 'day') {
      const e = dayEv[s.ev];
      if (!e) { setWk({ ph: dIdx === 4 ? 'review' : 'evening' }); drawWeek(host); return; }
      stage.innerHTML = `<div class="wk-split"><div class="pr-sheet wk-card" data-ev></div><div class="pr-sheet wk-card wk-mini" data-b3host></div></div>`;
      big3($('[data-b3host]', stage), 'week', { phase: 'day', noEvening: true });
      eventCard($('[data-ev]', stage), e, today, s, () => { setWk({ ev: s.ev + 1 }); drawWeek(host); });
    } else if (s.ph === 'evening') {
      stage.innerHTML = `<div class="pr-sheet wk-card" data-b3host></div>`;
      big3($('[data-b3host]', stage), 'week', { phase: 'evening', closeLabel: tx('Fechar o dia e ir para amanhã', 'Close the day and go to tomorrow'),
        onClosed: () => { W.apply('week', [{ o: 'clock', d: 1 }, { o: 'mark', k: 'wk', v: Object.assign({}, wk(), { d: dIdx + 1, ph: 'morning', ev: 0 }) }]); drawWeek(host); host.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
    } else if (s.ph === 'review') {
      stage.innerHTML = `<div class="pr-sheet wk-card"><p class="pr-kicker">${esc(tx('Sexta à tarde · 20 min · telemóvel longe', 'Friday afternoon · 20 min · phone away'))}</p><h2 class="pr-h2">${esc(tx('A revisão semanal', 'The weekly review'))}</h2><div data-rv></div></div>`;
      review($('[data-rv]', stage), 'week', { onDone: log => { setWk({ ph: 'done', log: log.slice(-30) }); drawWeek(host); } });
    } else if (s.ph === 'done') {
      stage.innerHTML = summary(s);
      const again = $('[data-wk-again]', stage);
      if (again) again.onclick = () => { W.resetSrc('week'); };
    }
  }

  function eventCard(el, e, today, s, next) {
    const st = { dest: null, title: null, first: true };
    const draw = () => {
      const ok = st.dest === e.dest;
      el.innerHTML = `<p class="pr-kicker">${esc(tx(`Chegou isto · ${s.ev + 1} de ${evs().filter(x => x.day === s.d).length} hoje`, `This arrived · ${s.ev + 1} of ${evs().filter(x => x.day === s.d).length} today`))}</p>
        <p class="wk-situ">${esc(L(e.situ))}</p>
        <p class="wk-q">${esc(tx('1. Para onde vai?', '1. Where does it go?'))}</p>
        <div class="wk-dests">${Object.keys(DESTS).map(k => `<button type="button" class="wk-dest ${Pr.KINDS[DESTS[k].k].cls} ${st.dest === k ? (ok ? 'right' : 'wrong') : ''} ${st.dest && k === e.dest ? 'right' : ''}" data-dest="${k}" ${st.dest && ok ? 'disabled' : ''}><b>${esc(L(DESTS[k].l))}</b><small>${esc(L(DESTS[k].d))}</small></button>`).join('')}</div>
        ${st.dest ? `<p class="wk-fb ${ok ? 'ok' : 'no'}">${ok ? '' : `<b>${esc(tx('Não é bem. ', 'Not quite. '))}</b>`}${esc(L(e.why))}</p>` : ''}
        ${ok && e.titles ? `<p class="wk-q">${esc(tx('2. Como se escreve?', '2. How do you write it?'))}</p>
          <div class="wk-titles">${e.titles.map((t, i) => `<button type="button" class="wk-title ${st.title === i ? (i === e.good ? 'right' : 'wrong') : ''} ${st.title != null && i === e.good ? 'right' : ''}" data-ti="${i}" ${st.title === e.good ? 'disabled' : ''}>${esc(L(t))}</button>`).join('')}</div>
          ${st.title != null && st.title !== e.good ? `<p class="wk-fb no">${esc(titleWhy(e, st.title))}</p>` : ''}` : ''}
        ${ok && (!e.titles || st.title === e.good) ? `<div class="wk-cap-do">${previewHtml(e, today)}<button type="button" class="btn btn-primary" data-cap>${esc(captureLabel(e))}</button></div>` : ''}`;
    };
    el.onclick = ev => {
      const d = ev.target.closest('[data-dest]'); if (d && !d.disabled) { st.dest = d.dataset.dest; if (st.dest !== e.dest) st.first = false; st.title = null; draw(); return; }
      const ti = ev.target.closest('[data-ti]'); if (ti && !ti.disabled) { st.title = +ti.dataset.ti; if (st.title !== e.good) st.first = false; draw(); return; }
      if (ev.target.closest('[data-cap]')) {
        const ops = captureOps(e, today);
        ops.push({ o: 'mark', k: 'wk.ev.' + e.id, v: { day: today, first: st.first } });
        W.apply('week', ops);
        Pr.toast(captureToast(e));
        next();
      }
    };
    draw();
  }
  const titleWhy = (e, i) => {
    const t = L(e.titles[i]);
    if (/[?!]{2,}/.test(t) || t.split(/\s+/).length <= 2) return tx('Curto demais: daqui a uns dias já não sabes o que era.', 'Too short: in a few days you will not know what it was.');
    if (/^(à espera|waiting)/i.test(t)) return tx('"À espera" não é uma ação. "Insistir com…" é: tem verbo e data de seguimento.', '"Waiting for" is not an action. "Chase…" is: it has a verb and a follow-up date.');
    if (e.dest === 'note' && PrCapture.VERB_RX.test(t)) return tx('Isso é uma ação disfarçada — e não há nada para fazer.', 'That is a disguised action — and there is nothing to do.');
    return tx('Vago: falta o quê, quem ou o projeto. Um título tem de se perceber sozinho daqui a três meses.', 'Vague: it lacks the what, who or the project. A title must stand alone in three months.');
  };
  function captureLabel(e) { return { task: tx('Capturar na lista', 'Capture to the list'), note: tx('Capturar nas Notas', 'Capture to Notes'), today: tx('Pôr nos Big 3 de hoje', "Put it in today's Big 3"), meeting: tx('Escrever na página da reunião', 'Write on the meeting page'), project: e.existing ? tx('Mudar o projeto para Next', 'Move the project to Next') : tx('Criar a linha em Projetos', 'Create the Projects row') }[e.dest]; }
  function captureToast(e) { return { task: tx('Na lista de tarefas.', 'On the task list.'), note: tx('Nas Notas, sem equipa — triagem na sexta.', 'In Notes, no team — triage on Friday.'), today: tx('Nos Big 3 de hoje.', "In today's Big 3."), meeting: tx('Entrada datada na página da reunião.', 'Dated entry on the meeting page.'), project: tx('Projeto atualizado.', 'Project updated.') }[e.dest]; }
  function previewHtml(e, today) {
    if (e.dest === 'task') { const box = W.box(e.box); const line = `${L(e.titles[e.good])} ${L(box.l)}${e.due != null ? ' ' + Pr.fmtDay(wk().start + e.due).split(' ')[0] : ''}`;
      return `<p class="wk-prev"><span class="pr-kicker">quick-add</span><code>${esc(line)}</code></p>`; }
    if (e.dest === 'note') return `<p class="wk-prev"><span class="pr-kicker">${esc(tx('Notas', 'Notes'))}</span><code>${esc(L(e.titles[e.good]))}</code></p>`;
    if (e.dest === 'meeting') { const m = W.rec('meetings', e.meeting); return `<p class="wk-prev"><span class="pr-kicker">${esc(m ? W.title('meetings', m) : '')}</span><code>${esc(Pr.fmtDay(today, 'short'))}: ${esc(L(e.situ)).slice(0, 90)}</code></p>`; }
    if (e.dest === 'project') return `<p class="wk-prev"><span class="pr-kicker">${esc(tx('Projetos', 'Projects'))}</span><code>${esc(L(e.project.name))} · Status: Next</code></p>`;
    return '';
  }
  function captureOps(e, today) {
    const start = wk().start;
    if (e.dest === 'task') return [{ o: 'add', db: 'tasks', r: { id: 'tw_' + e.id, t: e.titles[e.good], box: e.box, due: e.due == null ? null : start + e.due, p: 4 } }];
    if (e.dest === 'note') return [{ o: 'add', db: 'notes', r: { id: 'nw_' + e.id, name: e.titles[e.good], team: [], tags: e.tags || [], wk: e.id, cr: today } }];
    if (e.dest === 'meeting') return [{ o: 'body+', db: 'meetings', id: e.meeting, blocks: [{ k: 'p', t: { pt: Pr.fmtDay(today, 'short') + ': ' + e.situ.pt, en: Pr.fmtDay(today, 'short') + ': ' + e.situ.en } }] }];
    if (e.dest === 'today') { const d = day(today); const b3 = d.big3.slice(); if (!b3.includes(e.task)) { if (b3.length >= 3) b3.pop(); b3.push(e.task); } return [{ o: 'day', day: today, patch: { big3: b3 } }]; }
    if (e.dest === 'project') {
      if (e.existing && W.rec('projects', e.existing)) return [{ o: 'set', db: 'projects', id: e.existing, k: 'status', v: 'next' }, { o: 'set', db: 'projects', id: e.existing, k: 'target', v: e.project.target }];
      return [{ o: 'add', db: 'projects', r: { id: 'pw_' + e.id, name: e.project.name, status: e.project.status, team: e.project.team, target: e.project.target, cr: today, body: PrSeed.TEMPLATES.project.body } }];
    }
    return [];
  }
  function summary(s) {
    const caught = evs().filter(e => M()['wk.ev.' + e.id]).length, first = evs().filter(e => (M()['wk.ev.' + e.id] || {}).first).length;
    const days = [0, 1, 2, 3, 4].map(i => W.state().days[s.start + i]).filter(Boolean);
    const done = days.reduce((n, d) => n + Object.values(d.marks || {}).filter(x => x === '✓').length, 0);
    return `<div class="pr-sheet wk-card wk-done"><p class="pr-kicker">${esc(tx('Semana fechada', 'Week closed'))}</p><h2 class="pr-h2">${esc(tx('O que a semana deixou', 'What the week left behind'))}</h2>
      <ul class="wk-stats"><li><b>${first}<small>/${caught}</small></b>${esc(tx('chegadas arrumadas à primeira (sítio e título)', 'arrivals filed right first time (place and title)'))}</li><li><b>${done}</b>${esc(tx('itens dos Big 3 concluídos', 'Big 3 items completed'))}</li><li><b>${(s.log || []).length}</b>${esc(tx('alterações na revisão', 'changes at the review'))}</li></ul>
      ${(s.log || []).length ? `<details><summary>${esc(tx('Registo da revisão', 'Review log'))}</summary><ul class="wk-log">${s.log.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
      <p class="pr-kicker" style="margin-top:1.2rem">${esc(tx('Vai ver', 'Go and see'))}</p>
      <div class="pr-row"><a class="btn" href="#experimentar/notion/teams/all">${esc(tx('As equipas no playground (notas ligadas, rollups)', 'Teams in the playground (linked notes, rollups)'))}</a>
        <a class="btn" href="#experimentar/notion/notes/byteam">${esc(tx('Notas por equipa', 'Notes by team'))}</a><a class="btn" href="#experimentar/notion">${esc(tx('A base opcional Decisões', 'The optional Decisions database'))}</a>
        <a class="btn" href="#experimentar/captura">${esc(tx('Os filtros de tarefas', 'The task filters'))}</a></div>
      <p class="pr-sub" style="margin-top:1rem">${esc(tx('Queres repetir? "Repor esta experiência" (acima) devolve o mundo ao estado de antes da semana — o resto fica.', 'Want to go again? "Reset this experiment" (above) takes the world back to before the week — the rest stays.'))}</p></div>`;
  }

  Pr.route('aplicar/semana', weekPage);
  Pr.route('aplicar/hoje', hojePage);
  Pr.route('aplicar/revisao', revPage);
  return { big3, review };
})();
