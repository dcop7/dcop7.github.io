/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — o mundo partilhado (global `PrWorld`)
   ──────────────────────────────────────────────────────────────────
   Todas as experiências leem e escrevem o MESMO mundo de exemplo, por
   isso uma nota triada na revisão semanal aparece na página da equipa
   no playground, uma tarefa capturada aparece nos filtros, etc.

   Reposição previsível = registo de operações (event sourcing):
     estado = semente do cenário + operações guardadas, por ordem.
   Cada operação leva a experiência que a fez (`src`). Repor UMA
   experiência é voltar a calcular o mundo sem as operações dela; repor
   TUDO é apagar o registo. Uma operação que já não se aplica (porque o
   registo de que dependia veio de uma experiência reposta) é ignorada.

   Operações:
     add  {db, r}           set {db, id, k, v}       del {db, id}
     body+{db, id, blocks}  prop+{db, p}  prop- {db, pid}  propset {db, pid, patch}
     view+{db, v}  viewset {db, vid, v}  view- {db, vid}
     db+  {db}     clock {d}             day {day, patch}
   ══════════════════════════════════════════════════════════════════ */
const PrWorld = (function () {
  'use strict';
  const { L, clone, tx } = Pr;
  const KEY = 'pr-world-v1:';
  const SC_KEY = 'pr-scenario';
  const RECORD_DBS = ['teams', 'notes', 'projects', 'persons', 'oneonones', 'meetings', 'decisions'];

  const SOURCES = {
    nb:   { pt: 'Playground de bases de dados', en: 'Database playground', href: '#experimentar/notion' },
    cap:  { pt: 'Laboratório de captura', en: 'Capture lab', href: '#experimentar/captura' },
    week: { pt: 'Uma semana no sistema', en: 'A week in the system', href: '#aplicar/semana' },
    hoje: { pt: 'Hoje e os Big 3', en: 'Today and the Big 3', href: '#aplicar/hoje' },
    rev:  { pt: 'Revisão semanal', en: 'Weekly review', href: '#aplicar/revisao' },
    proj: { pt: 'Construir um projeto', en: 'Build a project', href: '#aplicar/projeto' },
    lad:  { pt: 'Escada da graduação', en: 'Graduation ladder', href: '#experimentar/pagina-ou-base' },
    mind: { pt: 'Laboratórios de execução e direção', en: 'Executing & directing labs', href: '#experimentar' },
  };

  let _sc = Pr.store.get(SC_KEY, 'work');
  if (!PrSeed[_sc] || !PrSeed[_sc].records) _sc = 'work';
  let _log = load();
  let _st = null;

  function load() { const v = Pr.store.get(KEY + _sc, null); return v && Array.isArray(v.log) ? v.log : []; }
  function save() { Pr.store.set(KEY + _sc, { v: 1, log: _log }); }

  /* ── construir o estado ── */
  function seedState() {
    const S = PrSeed[_sc];
    const st = {
      sc: _sc, clock: 0,
      schema: clone(S.schema), views: clone(S.views),
      rec: {}, tasks: clone(S.records.tasks).map(t => Object.assign({ done: false, sub: [] }, t)),
      cal: clone(S.records.cal), days: {}, marks: {}, resources: clone(S.records.resources),
      dbs: Object.keys(S.schema),
    };
    st.dbs.forEach(db => {
      st.rec[db] = clone(S.records[db] || []).map(r => Object.assign({ body: [] }, r, { ed: r.ed != null ? r.ed : r.cr }));
    });
    return st;
  }

  const findRec = (st, db, id) => db === 'tasks' ? st.tasks.find(t => t.id === id) : db === 'cal' ? st.cal.find(c => c.id === id) : (st.rec[db] || []).find(r => r.id === id);
  const listOf = (st, db) => db === 'tasks' ? st.tasks : db === 'cal' ? st.cal : st.rec[db];

  function addBackProp(st, db, p) {
    if (p.type !== 'rel' || !p.rel || !p.rel.two || !p.rel.back) return;
    const tgt = st.schema[p.rel.db]; if (!tgt) return;
    if (tgt.props.some(x => x.id === p.rel.back)) return;
    tgt.props.push({ id: p.rel.back, type: 'rel', back: { db, via: p.id }, name: p.rel.backName || st.schema[db].name, added: true });
  }
  function dropBackProp(st, db, p) {
    if (p.type !== 'rel' || !p.rel || !p.rel.back) return;
    const tgt = st.schema[p.rel.db]; if (!tgt) return;
    /* rollups que dependiam do lado de volta também saem */
    tgt.props = tgt.props.filter(x => x.id !== p.rel.back && !(x.type === 'rollup' && x.roll && x.roll.rel === p.rel.back));
  }

  function applyOp(st, op) {
    const d = op.o;
    if (d === 'clock') { st.clock += op.d; return true; }
    if (d === 'mark') { st.marks[op.k] = clone(op.v); return true; }
    if (d === 'day') { st.days[op.day] = Object.assign({ big3: [], marks: {}, draft: '' }, st.days[op.day], op.patch); return true; }
    if (d === 'db+') {
      const def = PrSeed.OPTIONAL[op.db]; if (!def || st.schema[op.db]) return false;
      const c = clone(def);
      st.schema[op.db] = { name: c.name, icon: c.icon, fav: c.fav, folder: c.folder, q: c.q, template: c.template, props: c.props, optional: true };
      st.views[op.db] = c.views; st.rec[op.db] = []; st.dbs.push(op.db);
      return true;
    }
    if (d === 'add') {
      const list = listOf(st, op.db); if (!list) return false;
      if (list.some(r => r.id === op.r.id)) return false;
      const r = clone(op.r);
      if (op.db === 'tasks') list.push(Object.assign({ done: false, sub: [] }, r));
      else if (op.db === 'cal') list.push(r);
      else list.push(Object.assign({ body: [] }, r, { cr: r.cr != null ? r.cr : st.clock, ed: st.clock }));
      return true;
    }
    if (d === 'set') {
      const r = findRec(st, op.db, op.id); if (!r) return false;
      r[op.k] = clone(op.v);
      if (op.db !== 'tasks' && op.db !== 'cal') r.ed = st.clock;
      return true;
    }
    if (d === 'del') {
      const list = listOf(st, op.db); if (!list) return false;
      const i = list.findIndex(r => r.id === op.id); if (i < 0) return false;
      list.splice(i, 1);
      return true;
    }
    if (d === 'body+') {
      const r = findRec(st, op.db, op.id); if (!r) return false;
      r.body = (r.body || []).concat(clone(op.blocks)); r.ed = st.clock;
      return true;
    }
    const sch = st.schema[op.db];
    if (!sch) return false;
    if (d === 'prop+') {
      if (sch.props.some(p => p.id === op.p.id)) return false;
      sch.props.push(clone(op.p)); addBackProp(st, op.db, op.p); return true;
    }
    if (d === 'prop-') {
      const p = sch.props.find(x => x.id === op.pid); if (!p || p.type === 'title') return false;
      dropBackProp(st, op.db, p);
      sch.props = sch.props.filter(x => x.id !== op.pid && !(x.type === 'rollup' && x.roll && x.roll.rel === op.pid));
      (st.views[op.db] || []).forEach(v => {
        v.filter = (v.filter || []).filter(f => f.p !== op.pid); v.sort = (v.sort || []).filter(s => s.p !== op.pid);
        if (v.group === op.pid) { v.group = null; v.layout = 'table'; }
      });
      return true;
    }
    if (d === 'propset') {
      const p = sch.props.find(x => x.id === op.pid); if (!p) return false;
      const was2 = p.rel && p.rel.two;
      Object.keys(op.patch).forEach(k => { if (k === 'rel') p.rel = Object.assign({}, p.rel, op.patch.rel); else p[k] = clone(op.patch[k]); });
      if (p.type === 'rel' && p.rel) {
        if (was2 && !p.rel.two) dropBackProp(st, op.db, p);
        if (!was2 && p.rel.two) addBackProp(st, op.db, p);
      }
      return true;
    }
    const vs = st.views[op.db];
    if (d === 'view+') { if (vs.some(v => v.id === op.v.id)) return false; vs.push(clone(op.v)); return true; }
    if (d === 'viewset') { const i = vs.findIndex(v => v.id === op.vid); if (i < 0) return false; vs[i] = clone(op.v); return true; }
    if (d === 'view-') { const i = vs.findIndex(v => v.id === op.vid); if (i < 0 || vs.length < 2) return false; vs.splice(i, 1); return true; }
    return false;
  }

  function build(skipSrc) {
    const st = seedState();
    _log.forEach(op => { if (op.src !== skipSrc) { try { applyOp(st, op); } catch (e) { /* operação órfã */ } } });
    return st;
  }
  function state() { if (!_st) _st = build(); return _st; }

  function emit(src, reset) { document.dispatchEvent(new CustomEvent('pr:world', { detail: { src, reset: !!reset } })); }

  function apply(src, ops) {
    ops = Array.isArray(ops) ? ops : [ops];
    const st = state();
    const ok = [];
    ops.forEach(op => { const o = Object.assign({ src }, op); if (applyOp(st, o)) ok.push(o); });
    if (!ok.length) return false;
    _log = _log.concat(ok);
    if (_log.length > 4000) _log = _log.slice(-4000);
    save(); emit(src);
    return true;
  }
  function count(src) { return _log.filter(o => o.src === src).length; }
  function sourcesUsed() { const s = new Set(_log.map(o => o.src)); return Object.keys(SOURCES).filter(k => s.has(k)); }
  function resetSrc(src) {
    _log = _log.filter(o => o.src !== src); save(); _st = null; emit(src, true);
  }
  function resetAll() { _log = []; save(); _st = null; emit('*', true); }
  function setScenario(id) {
    if (!PrSeed[id] || id === _sc) return;
    _sc = id; Pr.store.set(SC_KEY, id); _log = load(); _st = null; emit('*', true);
  }

  /* ════════════════ leitura ════════════════ */
  const schemaOf = db => state().schema[db];
  const recs = db => (state().rec[db] || []);
  const rec = (db, id) => findRec(state(), db, id);
  const prop = (db, pid) => (schemaOf(db) ? schemaOf(db).props.find(p => p.id === pid) : null);
  const titleProp = db => schemaOf(db).props.find(p => p.type === 'title');
  const title = (db, r) => r ? L(r.name) : '';
  const relTarget = (db, p) => p.back ? p.back.db : (p.rel ? p.rel.db : null);
  const exists = (db, id) => !!rec(db, id);

  /* valor calculado de uma propriedade */
  function val(db, r, p) {
    if (!r || !p) return null;
    const st = state();
    switch (p.type) {
      case 'title': return L(r.name);
      case 'text': case 'url': return L(r[p.id]);
      case 'select': return r[p.id] || null;
      case 'multi': return (r[p.id] || []).slice();
      case 'check': return !!r[p.id];
      case 'created': return r.cr;
      case 'edited': return r.ed != null ? r.ed : r.cr;
      case 'date': return r[p.id] != null ? r[p.id] : null;
      case 'rel':
        if (p.back) return (st.rec[p.back.db] || []).filter(x => (x[p.back.via] || []).includes(r.id)).map(x => x.id);
        return (r[p.id] || []).filter(id => exists(p.rel.db, id));
      case 'rollup': return rollup(db, r, p);
    }
    return r[p.id];
  }

  const ROLL_FNS = {
    original: { pt: 'Mostrar original', en: 'Show original' },
    count: { pt: 'Contar tudo', en: 'Count all' },
    count_values: { pt: 'Contar valores', en: 'Count values' },
    checked: { pt: 'Marcadas', en: 'Checked' },
    unchecked: { pt: 'Por marcar', en: 'Unchecked' },
    pct_checked: { pt: '% marcadas', en: 'Percent checked' },
    latest: { pt: 'Data mais recente', en: 'Latest date' },
    earliest: { pt: 'Data mais antiga', en: 'Earliest date' },
  };
  function rollup(db, r, p) {
    const rp = prop(db, p.roll.rel); if (!rp) return null;
    const tdb = relTarget(db, rp);
    const ids = val(db, r, rp) || [];
    const tp = prop(tdb, p.roll.prop);
    const items = ids.map(id => rec(tdb, id)).filter(Boolean);
    const vals = tp ? items.map(x => val(tdb, x, tp)) : [];
    switch (p.roll.fn) {
      case 'count': return items.length;
      case 'count_values': return vals.filter(v => v != null && v !== '' && !(Array.isArray(v) && !v.length)).length;
      case 'checked': return vals.filter(Boolean).length;
      case 'unchecked': return vals.filter(v => !v).length;
      case 'pct_checked': return items.length ? Math.round(100 * vals.filter(Boolean).length / items.length) : 0;
      case 'latest': { const n = vals.filter(v => typeof v === 'number'); return n.length ? Math.max(...n) : null; }
      case 'earliest': { const n = vals.filter(v => typeof v === 'number'); return n.length ? Math.min(...n) : null; }
      default: return { orig: vals, tdb, tp };
    }
  }
  const rollKind = p => ['latest', 'earliest'].includes(p.roll.fn) ? 'date' : p.roll.fn === 'original' ? 'list' : 'num';

  /* ── filtros ── */
  const OPS = {
    title: ['contains', 'not_contains', 'empty', 'not_empty'],
    text: ['contains', 'not_contains', 'empty', 'not_empty'],
    url: ['empty', 'not_empty'],
    select: ['is', 'is_not', 'empty', 'not_empty'],
    multi: ['has', 'not_has', 'empty', 'not_empty'],
    check: ['checked', 'unchecked'],
    rel: ['has', 'not_has', 'empty', 'not_empty'],
    created: ['past', 'older', 'between'],
    edited: ['past', 'older', 'between'],
    num: ['eq', 'gt', 'lt'],
    date: ['past', 'older'],
  };
  const opsFor = p => p.type === 'rollup' ? (rollKind(p) === 'date' ? OPS.date : rollKind(p) === 'num' ? OPS.num : []) : (OPS[p.type] || []);
  const needsVal = op => !['empty', 'not_empty', 'checked', 'unchecked'].includes(op);

  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function test(db, r, f) {
    const p = prop(db, f.p); if (!p) return true;
    const v = val(db, r, p), now = state().clock;
    const ago = typeof v === 'number' ? now - v : null;
    switch (f.op) {
      case 'contains': return fold(v).includes(fold(f.v));
      case 'not_contains': return !fold(v).includes(fold(f.v));
      case 'empty': return v == null || v === '' || (Array.isArray(v) && !v.length);
      case 'not_empty': return !(v == null || v === '' || (Array.isArray(v) && !v.length));
      case 'is': return v === f.v;
      case 'is_not': return v !== f.v;
      case 'has': return Array.isArray(v) && v.includes(f.v);
      case 'not_has': return !(Array.isArray(v) && v.includes(f.v));
      case 'checked': return !!v;
      case 'unchecked': return !v;
      case 'past': return ago != null && ago >= 0 && ago <= +f.v;
      case 'older': return ago != null && ago > +f.v;
      case 'between': return ago != null && ago >= +f.v[0] && ago <= +f.v[1];
      case 'eq': return +v === +f.v;
      case 'gt': return +v > +f.v;
      case 'lt': return +v < +f.v;
    }
    return true;
  }

  function sortKey(db, r, p) {
    const v = val(db, r, p);
    if (p.type === 'select') { const i = (p.opts || []).findIndex(o => o.id === v); return i < 0 ? 999 : i; }
    if (p.type === 'rel') return v.length ? fold(title(relTarget(db, p), rec(relTarget(db, p), v[0]))) : '￿';
    if (p.type === 'check') return v ? 1 : 0;
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === 'object') return 0;
    return typeof v === 'number' ? v : fold(v);
  }

  function query(db, view) {
    let rows = recs(db).filter(r => (view.filter || []).every(f => test(db, r, f)));
    (view.sort || []).slice().reverse().forEach(s => {
      const p = prop(db, s.p); if (!p) return;
      rows = rows.slice().sort((a, b) => { const x = sortKey(db, a, p), y = sortKey(db, b, p); return (x < y ? -1 : x > y ? 1 : 0) * (s.dir === 'desc' ? -1 : 1); });
    });
    let groups = null;
    if (view.layout === 'board' && view.group) {
      const gp = prop(db, view.group);
      if (gp) {
        const keys = [];
        if (gp.type === 'select' || gp.type === 'multi') (gp.opts || []).forEach(o => keys.push({ id: o.id, label: L(o.l), c: o.c }));
        else if (gp.type === 'rel') recs(relTarget(db, gp)).forEach(x => keys.push({ id: x.id, label: title(relTarget(db, gp), x) }));
        else if (gp.type === 'check') { keys.push({ id: true, label: tx('Marcado', 'Checked') }); keys.push({ id: false, label: tx('Por marcar', 'Unchecked') }); }
        keys.push({ id: '__none', label: tx('Sem valor', 'No value'), none: true });
        groups = keys.map(k => ({ key: k, rows: rows.filter(r => {
          const v = val(db, r, gp);
          if (k.none) return v == null || v === '' || (Array.isArray(v) && !v.length);
          return Array.isArray(v) ? v.includes(k.id) : v === k.id;
        }) }));
      }
    }
    return { rows, groups, total: recs(db).length };
  }

  /* ── leitura humana dos filtros ── */
  function optLabel(p, id) { const o = (p.opts || []).find(x => x.id === id); return o ? L(o.l) : id; }
  function filterText(db, f) {
    const p = prop(db, f.p); if (!p) return '';
    const n = `«${L(p.name)}»`;
    let v = f.v;
    if (p.type === 'select' || p.type === 'multi') v = `«${optLabel(p, f.v)}»`;
    if (p.type === 'rel') v = `«${title(relTarget(db, p), rec(relTarget(db, p), f.v)) || '?'}»`;
    const T = {
      contains: tx(`${n} contém "${v}"`, `${n} contains "${v}"`), not_contains: tx(`${n} não contém "${v}"`, `${n} does not contain "${v}"`),
      empty: tx(`${n} está vazio`, `${n} is empty`), not_empty: tx(`${n} não está vazio`, `${n} is not empty`),
      is: tx(`${n} é ${v}`, `${n} is ${v}`), is_not: tx(`${n} não é ${v}`, `${n} is not ${v}`),
      has: tx(`${n} inclui ${v}`, `${n} contains ${v}`), not_has: tx(`${n} não inclui ${v}`, `${n} does not contain ${v}`),
      checked: tx(`${n} está marcada`, `${n} is checked`), unchecked: tx(`${n} não está marcada`, `${n} is unchecked`),
      past: tx(`${n} nos últimos ${f.v} dias`, `${n} within the last ${f.v} days`), older: tx(`${n} há mais de ${f.v} dias`, `${n} more than ${f.v} days ago`),
      between: Array.isArray(f.v) ? tx(`${n} entre há ${f.v[0]} e há ${f.v[1]} dias`, `${n} between ${f.v[0]} and ${f.v[1]} days ago`) : '',
      eq: tx(`${n} = ${f.v}`, `${n} = ${f.v}`), gt: tx(`${n} > ${f.v}`, `${n} > ${f.v}`), lt: tx(`${n} < ${f.v}`, `${n} < ${f.v}`),
    };
    return T[f.op] || '';
  }

  /* ── tarefas (o lado "lista de tarefas") ── */
  const tasks = () => state().tasks.filter(t => !t.done);
  const isChase = t => /^(insistir|chase)\b/i.test(L(t.t).trim());
  const TASK_FILTERS = {
    today: { name: { pt: 'Hoje', en: 'Today' }, q: 'overdue | today', test: (t, c) => t.due != null && t.due <= c },
    due7: { name: { pt: 'Próximos 7 dias', en: 'Due in 7 days' }, q: 'due before: in 7 days', test: (t, c) => t.due != null && t.due < c + 7 },
    follow: { name: { pt: 'Seguimentos', en: 'Follow-ups' }, q: { pt: 'search: Insistir', en: 'search: Chase' }, test: t => isChase(t) },
  };
  function filterTasks(fid) {
    const c = state().clock, f = TASK_FILTERS[fid];
    return tasks().filter(t => f.test(t, c)).sort((a, b) => (a.due == null ? 999 : a.due) - (b.due == null ? 999 : b.due) || (a.p || 4) - (b.p || 4));
  }
  function completeOps(t) {
    if (t.rec) return [{ o: 'set', db: 'tasks', id: t.id, k: 'due', v: (t.due != null ? t.due : state().clock) + t.rec }];
    return [{ o: 'set', db: 'tasks', id: t.id, k: 'done', v: true }];
  }
  /* "(Nome do projeto)" no fim do título — o elo de texto entre tudo */
  const projOf = s => { const m = String(s || '').match(/\(([^()]+)\)\s*$/); return m ? m[1].trim() : null; };

  /* ── pesquisa por palavras inteiras (como o documento observou no Notion) ── */
  const words = s => fold(s).match(/[\p{L}\p{N}]+/gu) || [];
  function search(q) {
    const want = words(q); if (!want.length) return [];
    const hit = s => { const w = new Set(words(s)); return want.every(x => w.has(x)); };
    const out = [];
    state().tasks.forEach(t => { if (!t.done && hit(L(t.t))) out.push({ kind: 'task', id: t.id, label: L(t.t), t }); });
    state().dbs.forEach(db => recs(db).forEach(r => {
      if (hit(title(db, r))) out.push({ kind: 'rec', db, id: r.id, label: title(db, r), archived: !!r.archived });
    }));
    return out;
  }
  const partial = q => { const want = fold(q).trim(); if (want.length < 2) return 0; let n = 0;
    state().tasks.forEach(t => { if (!t.done && fold(L(t.t)).includes(want)) n++; });
    state().dbs.forEach(db => recs(db).forEach(r => { if (fold(title(db, r)).includes(want)) n++; })); return n; };

  const seed = () => PrSeed[_sc];
  const hub = () => PrSeed[_sc].hub;
  const boxes = () => PrSeed[_sc].boxes;
  const box = id => boxes().find(b => b.id === id);

  return {
    SOURCES, ROLL_FNS, OPS, TASK_FILTERS, RECORD_DBS,
    state, apply, count, sourcesUsed, resetSrc, resetAll, setScenario, scenario: () => _sc,
    schemaOf, recs, rec, prop, titleProp, title, relTarget, val, rollKind, opsFor, needsVal, test, query, filterText, optLabel,
    tasks, filterTasks, completeOps, isChase, projOf, search, partial, fold, seed, hub, boxes, box,
    clock: () => state().clock,
  };
})();
