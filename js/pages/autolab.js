/* ══════════════════════════════════════════════════════════════════
   AUTO INTELLIGENCE (#autolab) — fiabilidade automóvel para decisões
   de compra/manutenção, com foco no mercado europeu/português.
   Fonte: base de conhecimento CURADA e offline (data/auto/models.json)
   — avarias comummente reportadas, quilometragens típicas e custos
   médios em € — em vez de APIs frágeis: as bases públicas gratuitas
   (NHTSA) são norte-americanas e desalinhadas com os motores/gamas EU,
   e as europeias (RAPEX/SIR) não têm API utilizável em frontend-only.
   Fluxo: marca → modelo → ano (+ km atuais) → dashboard de decisão:
   score de fiabilidade, risco por quilometragem, custo esperado,
   timeline de desgaste, comparação de motores e de gerações, recalls.
══════════════════════════════════════════════════════════════════ */
const AutoLabPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const T = (en, pt) => (_lang() === 'en' ? en : pt);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = n => n.toLocaleString(_lang() === 'en' ? 'en-GB' : 'pt-PT') + ' €';

  let _root = null, _built = false, _DB = null, _dbP = null;
  let _sel = { model: null, gen: null, engine: null, km: null };

  function load() {
    if (_DB) return Promise.resolve(_DB);
    if (_dbP) return _dbP;
    _dbP = fetch('data/auto/models.json').then(r => r.json()).then(d => (_DB = d)).catch(() => null);
    return _dbP;
  }

  const SEV = {
    low:  { pt: 'Ligeira',  en: 'Minor',    cls: 'low' },
    med:  { pt: 'Moderada', en: 'Moderate', cls: 'med' },
    high: { pt: 'Grave',    en: 'Serious',  cls: 'high' },
  };
  const MAINT = {
    low:  { pt: 'baixo',   en: 'low',    cls: 'good' },
    med:  { pt: 'médio',   en: 'medium', cls: 'warn' },
    high: { pt: 'elevado', en: 'high',   cls: 'bad' },
  };
  const sevLbl = s => (SEV[s] || SEV.med)[_lang() === 'en' ? 'en' : 'pt'];

  function scoreCls(n) { return n >= 82 ? 'good' : n >= 70 ? 'ok' : 'bad'; }
  function scoreWord(n) {
    return n >= 85 ? T('Excellent', 'Excelente') : n >= 75 ? T('Good', 'Boa')
      : n >= 65 ? T('Average', 'Média') : T('Below average', 'Abaixo da média');
  }

  /* custo esperado nos próximos 30 mil km dado o km atual */
  function upcoming(gen, km) {
    if (km == null) return null;
    const soon = gen.failures.filter(f => f.km > km - 15000 && f.km <= km + 30000);
    const min = soon.reduce((a, f) => a + f.cost[0], 0);
    const max = soon.reduce((a, f) => a + f.cost[1], 0);
    return { soon, min, max };
  }

  /* ── selects ── */
  function fillSelectors() {
    const mSel = _root.querySelector('#al-model');
    mSel.innerHTML = `<option value="">${T('Choose model…', 'Escolhe o modelo…')}</option>` +
      _DB.models.map(m => `<option value="${m.id}">${esc(m.brand)} ${esc(m.name)}</option>`).join('');
  }
  function fillYears(model) {
    const ySel = _root.querySelector('#al-year');
    if (!model) { ySel.innerHTML = `<option value="">${T('Year', 'Ano')}</option>`; ySel.disabled = true; return; }
    const years = [];
    model.generations.forEach(g => { for (let y = g.to; y >= g.from; y--) if (!years.includes(y)) years.push(y); });
    years.sort((a, b) => b - a);
    ySel.disabled = false;
    ySel.innerHTML = `<option value="">${T('Year', 'Ano')}</option>` + years.map(y => `<option>${y}</option>`).join('');
  }
  function genForYear(model, year) {
    return model.generations.find(g => year >= g.from && year <= g.to) || model.generations[0];
  }

  /* ── viz helpers ── */
  function gaugeHTML(score, label) {
    const cls = scoreCls(score);
    return `<div class="al-gauge ${cls}" style="--p:${score}">
      <div class="al-gauge-in"><b>${score}</b><small>/100</small></div>
      <span class="al-gauge-lbl">${label}</span>
    </div>`;
  }

  function timelineHTML(gen, km) {
    const MAXK = 200000;
    const marks = gen.failures.map(f => {
      const x = Math.min(97, (f.km / MAXK) * 100);
      const passed = km != null && km >= f.km;
      return `<div class="al-tl-mark ${SEV[f.sev].cls} ${passed ? 'passed' : ''}" style="left:${x}%" title="${esc(f.part)} · ~${Math.round(f.km / 1000)}k km">
        <i></i><span>${Math.round(f.km / 1000)}k</span></div>`;
    }).join('');
    const kmPos = km != null ? Math.min(97, (km / MAXK) * 100) : null;
    return `<div class="al-timeline">
      <div class="al-tl-track">
        ${marks}
        ${kmPos != null ? `<div class="al-tl-you" style="left:${kmPos}%"><span>${T('you', 'tu')} · ${Math.round(km / 1000)}k</span></div>` : ''}
      </div>
      <div class="al-tl-axis"><span>0</span><span>50k</span><span>100k</span><span>150k</span><span>200k km</span></div>
    </div>`;
  }

  /* ── dashboard ── */
  function renderDash() {
    const out = _root.querySelector('#al-out');
    const { model, gen, engine, km } = _sel;
    if (!model || !gen) { out.innerHTML = ''; return; }
    const score = engine ? Math.round((gen.reliability + engine.reliability) / 2) : gen.reliability;
    const up = upcoming(gen, km);
    const mnt = MAINT[gen.maint] || MAINT.med;

    out.innerHTML = `
      <div class="al-dash">
        <div class="al-hero">
          ${gaugeHTML(score, T('Reliability', 'Fiabilidade'))}
          <div class="al-hero-body">
            <h2>${model.icon} ${esc(model.brand)} ${esc(model.name)} <small>${esc(gen.label)}</small></h2>
            <p class="al-verdict"><b class="${scoreCls(score)}">${scoreWord(score)}</b> · ${T('maintenance cost', 'custo de manutenção')} <b class="${mnt.cls}">${mnt[_lang() === 'en' ? 'en' : 'pt']}</b>${engine ? ` · ${esc(engine.name)}` : ''}</p>
            ${engine && engine.note ? `<p class="al-engnote">💡 ${esc(engine.note)}</p>` : ''}
            ${up && up.soon.length ? `<p class="al-upcoming">⚠️ ${T('Around your mileage', 'Perto da tua quilometragem')}: <b>${up.soon.length}</b> ${T('known issue(s)', 'avaria(s) conhecida(s)')} · ${T('expected cost', 'custo esperado')} <b>${eur(up.min)} – ${eur(up.max)}</b></p>` : up ? `<p class="al-upcoming good">✅ ${T('No known failure cluster near your mileage', 'Sem foco de avarias conhecido perto da tua quilometragem')}</p>` : ''}
          </div>
        </div>

        <div class="al-sec"><div class="al-sec-t">📈 ${T('Wear timeline', 'Linha de desgaste')} <small>${T('typical failure mileage', 'quilometragem típica de avaria')}</small></div>
          ${timelineHTML(gen, km)}
        </div>

        <div class="al-sec"><div class="al-sec-t">🔧 ${T('Known problems', 'Avarias conhecidas')}</div>
          <div class="al-fail-list">
            ${gen.failures.map(f => {
              const passed = km != null && km >= f.km - 15000;
              return `<div class="al-fail ${SEV[f.sev].cls}">
                <div class="al-fail-head">
                  <b>${esc(f.part)}</b>
                  <span class="al-sev ${SEV[f.sev].cls}">${sevLbl(f.sev)}</span>
                </div>
                <p>${esc(f.desc)}</p>
                <div class="al-fail-meta">
                  <span>📍 ~${Math.round(f.km / 1000)} ${T('thousand km', 'mil km')}${passed ? ' · <b>' + T('in your risk zone', 'na tua zona de risco') + '</b>' : ''}</span>
                  <span>💶 ${eur(f.cost[0])} – ${eur(f.cost[1])}</span>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        ${gen.engines.length > 1 ? `<div class="al-sec"><div class="al-sec-t">⚙️ ${T('Engine comparison', 'Comparação de motores')}</div>
          <div class="al-eng-grid">
            ${gen.engines.map(e => `<button class="al-eng ${_sel.engine && _sel.engine.id === e.id ? 'on' : ''} ${scoreCls(e.reliability)}" data-eng="${e.id}">
              <b>${esc(e.name)}</b><span class="al-eng-fuel">${esc(e.fuel)}</span>
              <span class="al-eng-score">${e.reliability}<i>/100</i></span>
            </button>`).join('')}
          </div>
          ${_sel.engine ? '' : `<p class="al-hint">${T('Tap an engine for its specific verdict.', 'Toca num motor para o veredicto específico.')}</p>`}
        </div>` : ''}

        ${model.generations.length > 1 ? `<div class="al-sec"><div class="al-sec-t">🔁 ${T('Generations', 'Gerações')}</div>
          <div class="al-gen-grid">
            ${model.generations.map(g => `<button class="al-gen ${g.id === gen.id ? 'on' : ''}" data-gen="${g.id}">
              <b>${esc(g.label)}</b>
              <span class="al-gen-bar"><i style="width:${g.reliability}%" class="${scoreCls(g.reliability)}"></i></span>
              <span class="al-gen-score">${g.reliability}/100</span>
            </button>`).join('')}
          </div>
        </div>` : ''}

        ${gen.recalls && gen.recalls.length ? `<div class="al-sec"><div class="al-sec-t">📋 ${T('Recalls & campaigns', 'Recalls e campanhas')}</div>
          <ul class="al-recalls">${gen.recalls.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>` : ''}
      </div>`;

    out.querySelectorAll('[data-eng]').forEach(b => b.addEventListener('click', () => {
      const e = gen.engines.find(x => x.id === b.dataset.eng);
      _sel.engine = (_sel.engine && _sel.engine.id === e.id) ? null : e;
      renderDash();
    }));
    out.querySelectorAll('[data-gen]').forEach(b => b.addEventListener('click', () => {
      _sel.gen = model.generations.find(g => g.id === b.dataset.gen);
      _sel.engine = null;
      renderDash();
    }));
    if (typeof Motion !== 'undefined') Motion.stagger(out.querySelectorAll('.al-sec'), { step: 45 });
  }

  function show() {
    const view = document.getElementById('view-autolab');
    if (!view) return;
    if (_built) return;
    _built = true;
    _root = view;
    view.innerHTML = `
      <div class="view-inner al-wrap">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('autolab', 22)}</span>
          <div class="ph-titles"><h1 class="ph-title">Auto Intelligence</h1>
            <p class="ph-sub">${T('Reliability, known problems and expected costs — curated for the European market', 'Fiabilidade, avarias conhecidas e custos esperados — curadoria para o mercado europeu')}</p></div>
        </div>
        <div class="al-form">
          <select id="al-model" class="al-sel" aria-label="${T('Model', 'Modelo')}"></select>
          <select id="al-year" class="al-sel" disabled aria-label="${T('Year', 'Ano')}"></select>
          <input id="al-km" class="al-sel al-km" type="number" min="0" step="5000" placeholder="${T('Current km (optional)', 'Km atuais (opcional)')}" aria-label="km">
        </div>
        <div id="al-out"><div class="al-empty">
          <span>🔍</span>
          <p>${T('Pick a model and year to see its reliability profile, common failures by mileage and what they cost to fix.', 'Escolhe um modelo e ano para veres o perfil de fiabilidade, as avarias comuns por quilometragem e quanto custam a reparar.')}</p>
        </div></div>
        <p class="al-foot">${T('Curated knowledge base (community-reported issues, EU market). Averages in € for Portugal — always inspect the specific car and its service history.', 'Base de conhecimento curada (avarias reportadas pela comunidade, mercado UE). Médias em € para Portugal — inspeciona sempre o carro específico e o seu histórico de revisões.')}</p>
      </div>`;

    load().then(db => {
      if (!db) { view.querySelector('#al-out').innerHTML = `<div class="al-empty"><span>⚠️</span><p>${T('Could not load the database.', 'Não foi possível carregar a base de dados.')}</p></div>`; return; }
      fillSelectors();
      const mSel = view.querySelector('#al-model'), ySel = view.querySelector('#al-year'), kmIn = view.querySelector('#al-km');
      mSel.addEventListener('change', () => {
        _sel.model = _DB.models.find(m => m.id === mSel.value) || null;
        _sel.gen = null; _sel.engine = null;
        fillYears(_sel.model);
        renderDash();
      });
      ySel.addEventListener('change', () => {
        if (!_sel.model || !ySel.value) return;
        _sel.gen = genForYear(_sel.model, +ySel.value);
        _sel.engine = null;
        renderDash();
      });
      kmIn.addEventListener('input', () => {
        _sel.km = kmIn.value ? Math.max(0, +kmIn.value) : null;
        if (_sel.gen) renderDash();
      });
    });
  }

  return { show };
})();
window.AutoLabPage = AutoLabPage;
