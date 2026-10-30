/* ══════════════════════════════════════════════════════════════════
   EXPLICAÇÕES INTERATIVAS — Explorar ▸ #explorer/explain[/<id>]
   ──────────────────────────────────────────────────────────────────
   Ideias difíceis explicadas a mexer: texto curto + um "brinquedo" que
   se manipula. Cada explicação é um objeto { id, icon, title, lead,
   mins, render(el), stop?() } em EXPLAINERS; o hub e a navegação
   são genéricos.

   Tudo é calculado no browser (nenhum número de prémio, taxa ou
   estatística é copiado de fora): probabilidades exatas por
   combinatória, juros mês a mês, epidemia por simulação de agentes.

   Rotas: o explorer só passa o 1.º segmento ("explain"); o id da
   explicação lê-se do próprio hash, por isso o botão "voltar" do
   browser funciona entre explicações.
   ══════════════════════════════════════════════════════════════════ */
const ExplainExplorer = (function () {
  'use strict';

  let _root = null, _body = null, _cur = null;

  /* ── formatação ─────────────────────────────────────────────────── */
  const nf = (d = 0) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt = (n, d = 0) => nf(d).format(n);
  const eur = n => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
  const pct = (p, d = 1) => fmt(p * 100, d) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* "1 em 139 838 160" — com espaço fino como separador de milhares */
  const oneIn = p => p > 0 ? '1 em ' + fmt(Math.round(1 / p)) : '—';

  /* ── controlos ─────────────────────────────────────────────────── */
  function slider(id, label, min, max, step, value, unit) {
    return `<label class="xp-sl" for="${id}">
      <span class="xp-sl-top"><span>${label}</span><output id="${id}-o"></output></span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
      ${unit ? `<span class="xp-sl-unit" hidden>${unit}</span>` : ''}
    </label>`;
  }
  const val = (el, id) => +el.querySelector('#' + id).value;
  function out(el, id, text) { const o = el.querySelector('#' + id + '-o'); if (o) o.textContent = text; }
  function onInputs(el, fn) { el.querySelectorAll('input').forEach(i => i.addEventListener('input', fn)); fn(); }

  /* ── gráfico de linhas/áreas em SVG (com leitura ao passar o rato) ──
     opts: { xs:[], series:[{name,color,values,area?}], stacked?, yFmt, xFmt,
             marker?:{x,label}, yMax?, h? } */
  function chart(host, opts) {
    const W = 640, H = opts.h || 260, L = 54, R = 14, T = 14, B = 30;
    const xs = opts.xs, n = xs.length;
    const ser = opts.series;
    const stackTop = i => opts.stacked ? ser.reduce((s, se) => s + (se.values[i] || 0), 0) : Math.max(...ser.map(se => se.values[i] || 0));
    let yMax = opts.yMax || Math.max(1e-9, ...xs.map((_, i) => stackTop(i)));
    const mag = Math.pow(10, Math.floor(Math.log10(yMax)));
    const nice = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => v * 4 >= yMax) || yMax;
    yMax = Math.ceil(yMax / nice) * nice;
    const X = i => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
    const Y = v => T + (1 - v / yMax) * (H - T - B);
    const yFmt = opts.yFmt || (v => fmt(v)), xFmt = opts.xFmt || (v => v);
    let g = '';
    for (let v = 0; v <= yMax + 1e-9; v += nice) {
      g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="xp-grid"/>
            <text x="${L - 6}" y="${Y(v) + 3.5}" class="xp-ax" text-anchor="end">${yFmt(v)}</text>`;
    }
    const ticks = Math.min(n, 7);
    for (let k = 0; k < ticks; k++) {
      const i = Math.round(k * (n - 1) / Math.max(1, ticks - 1));
      g += `<text x="${X(i)}" y="${H - 9}" class="xp-ax" text-anchor="middle">${xFmt(xs[i])}</text>`;
    }
    const base = xs.map(() => 0);
    let paths = '';
    ser.forEach(se => {
      const top = xs.map((_, i) => (opts.stacked ? base[i] : 0) + (se.values[i] || 0));
      const line = top.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
      if (se.area !== false && (opts.stacked || se.area)) {
        const bottom = xs.map((_, i) => (opts.stacked ? base[i] : 0)).map((v, i) => `L${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse().join('');
        paths += `<path d="${line}${bottom}Z" fill="${se.color}" fill-opacity="${se.fillOpacity || .28}"/>`;
      }
      paths += `<path d="${line}" fill="none" stroke="${se.color}" stroke-width="2.2" stroke-linejoin="round" ${se.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
      if (opts.stacked) top.forEach((v, i) => { base[i] = v; });
    });
    let mk = '';
    if (opts.marker) {
      const i = xs.indexOf(opts.marker.x);
      if (i >= 0) {
        const v = stackTop(i);
        mk = `<line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H - B}" class="xp-mk"/>
              <circle cx="${X(i)}" cy="${Y(v)}" r="4.5" class="xp-mk-dot"/>
              ${opts.marker.label ? `<text x="${Math.min(W - R - 4, Math.max(L + 4, X(i) + 6))}" y="${T + 12}" class="xp-mk-lbl" text-anchor="${X(i) > W * .7 ? 'end' : 'start'}">${esc(opts.marker.label)}</text>` : ''}`;
      }
    }
    host.innerHTML = `
      <div class="xp-chart">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(opts.label || 'Gráfico')}">
          ${g}${paths}${mk}<line class="xp-hover" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
        </svg>
        <div class="xp-tip" hidden></div>
        ${ser.length > 1 ? `<div class="xp-legend">${ser.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>` : ''}
      </div>`;
    const svg = host.querySelector('svg'), tip = host.querySelector('.xp-tip'), hl = host.querySelector('.xp-hover');
    const move = e => {
      const r = svg.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width * W;
      const i = Math.max(0, Math.min(n - 1, Math.round((fx - L) / (W - L - R) * (n - 1))));
      hl.setAttribute('x1', X(i)); hl.setAttribute('x2', X(i)); hl.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(xFmt(xs[i], true))}</b>` + ser.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}: ${yFmt(se.values[i] || 0, true)}</span>`).join('');
      const px = X(i) / W * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, px + 12)) + 'px';
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); });
  }

  /* ═════════════════════════════ 1 · JUROS COMPOSTOS ═════════════════ */
  /* Saldo mês a mês: o juro de cada mês soma-se ao capital (capitalização
     mensal, taxa anual nominal / 12) e o reforço entra no fim do mês. */
  function grow(initial, monthly, rate, years, startYear = 0, stopYear = Infinity) {
    const r = rate / 100 / 12, out = [{ bal: initial, dep: initial }];
    let bal = initial, dep = initial;
    for (let m = 1; m <= years * 12; m++) {
      bal *= 1 + r;
      const y = (m - 1) / 12;
      if (y >= startYear && y < stopYear) { bal += monthly; dep += monthly; }
      if (m % 12 === 0) out.push({ bal, dep });
    }
    return out;
  }

  const JUROS = {
    id: 'juros', icon: '📈', mins: 5, color: '#22c55e',
    title: 'O poder dos juros compostos',
    lead: 'Porque é que começar cedo vale mais do que pôr muito — e a regra dos 72 para fazer contas de cabeça.',
    render(el) {
      el.innerHTML = `
        <p>Quando o dinheiro rende juros e esses juros ficam lá, no ano seguinte <strong>os próprios juros também rendem</strong>. É uma bola de neve: devagar no início, depressa no fim. Mexe nos valores e repara como a parte verde (os juros) acaba por ser maior do que tudo o que lá puseste.</p>
        <div class="xp-box">
          <div class="xp-controls">
            ${slider('j-ini', 'Depósito inicial', 0, 20000, 500, 1000)}
            ${slider('j-mon', 'Reforço mensal', 0, 1000, 10, 100)}
            ${slider('j-rate', 'Rendimento anual', 0, 10, .25, 4)}
            ${slider('j-yrs', 'Anos', 1, 50, 1, 30)}
          </div>
          <label class="xp-check"><input type="checkbox" id="j-infl"> Descontar a inflação (2% ao ano) — mostra o valor em dinheiro de hoje</label>
          <div class="xp-stats" id="j-stats"></div>
          <div id="j-chart"></div>
        </div>
        <h3>A Ana e o Bruno</h3>
        <p>A Ana põe <strong>100 € por mês dos 25 aos 35 anos</strong> e depois pára. O Bruno só começa aos 35 e põe os mesmos 100 € por mês <strong>até aos 65</strong> — três vezes mais tempo, três vezes mais dinheiro. Quem tem mais aos 65? Depende do rendimento — arrasta a taxa e vê a vantagem mudar de lado.</p>
        <div class="xp-box">
          <div class="xp-controls xp-controls-1">${slider('ab-rate', 'Rendimento anual', 1, 10, .5, 7)}</div>
          <div class="xp-stats" id="ab-stats"></div>
          <div id="ab-chart"></div>
        </div>
        <h3>A regra dos 72</h3>
        <p>Para saber em quantos anos o dinheiro <strong>duplica</strong>, divide 72 pela taxa. A 6% ao ano, 72 ÷ 6 = 12 anos. Funciona ao contrário com a inflação: a 3%, os preços duplicam em cerca de 24 anos.</p>
        <div class="xp-box">
          <div class="xp-controls xp-controls-1">${slider('r72', 'Taxa anual', 1, 15, .5, 6)}</div>
          <div class="xp-stats" id="r72-stats"></div>
        </div>
        <p class="xp-note">Os valores são ilustrativos: rendimentos reais variam, têm impostos e comissões, e nenhum investimento com rendimento garante o capital. A matemática da bola de neve, essa, é sempre a mesma.</p>`;

      const yrFmt = (v, full) => full ? `Ano ${v}` : String(v);
      onInputs(el, () => {
        const ini = val(el, 'j-ini'), mon = val(el, 'j-mon'), rate = val(el, 'j-rate'), yrs = val(el, 'j-yrs');
        out(el, 'j-ini', eur(ini)); out(el, 'j-mon', eur(mon)); out(el, 'j-rate', fmt(rate, 2).replace(/,?0+$/, '') + '%'); out(el, 'j-yrs', yrs + (yrs === 1 ? ' ano' : ' anos'));
        const infl = el.querySelector('#j-infl').checked;
        const rows = grow(ini, mon, rate, yrs).map((r, y) => {
          const k = infl ? Math.pow(1.02, y) : 1;
          return { bal: r.bal / k, dep: r.dep / k };
        });
        const last = rows[rows.length - 1];
        const gain = Math.max(0, last.bal - last.dep);
        el.querySelector('#j-stats').innerHTML = `
          <div><small>No fim${infl ? ' (em € de hoje)' : ''}</small><strong>${eur(last.bal)}</strong></div>
          <div><small>Tu puseste</small><strong>${eur(last.dep)}</strong></div>
          <div class="xp-good"><small>Os juros puseram</small><strong>${eur(gain)}</strong></div>`;
        chart(el.querySelector('#j-chart'), {
          label: 'Evolução do saldo', stacked: true,
          xs: rows.map((_, i) => i), xFmt: yrFmt, yFmt: v => v >= 1000 ? fmt(v / 1000, v >= 10000 ? 0 : 1) + ' mil €' : fmt(v) + ' €',
          series: [
            { name: 'O que puseste', color: '#60a5fa', values: rows.map(r => Math.min(r.dep, r.bal)) },
            { name: 'Juros', color: '#22c55e', values: rows.map(r => Math.max(0, r.bal - r.dep)) },
          ],
        });
      });

      const ab = () => {
        const rate = val(el, 'ab-rate');
        out(el, 'ab-rate', fmt(rate, 1).replace(',0', '') + '%');
        const ana = grow(0, 100, rate, 40, 0, 10), bruno = grow(0, 100, rate, 40, 10, 40);
        const A = ana[40].bal, Bv = bruno[40].bal;
        el.querySelector('#ab-stats').innerHTML = `
          <div class="${A >= Bv ? 'xp-good' : ''}"><small>Ana · pôs ${eur(ana[40].dep)}</small><strong>${eur(A)}</strong></div>
          <div class="${Bv > A ? 'xp-good' : ''}"><small>Bruno · pôs ${eur(bruno[40].dep)}</small><strong>${eur(Bv)}</strong></div>
          <div><small>Quem ganha</small><strong>${A >= Bv ? 'A Ana 🎉' : 'O Bruno'}</strong></div>`;
        chart(el.querySelector('#ab-chart'), {
          label: 'Ana contra Bruno', xs: ana.map((_, i) => 25 + i), xFmt: (v, full) => full ? `${v} anos` : String(v),
          yFmt: v => v >= 1000 ? fmt(v / 1000, 0) + ' mil €' : fmt(v) + ' €',
          series: [
            { name: 'Ana (25–35)', color: '#f472b6', values: ana.map(r => r.bal) },
            { name: 'Bruno (35–65)', color: '#60a5fa', values: bruno.map(r => r.bal) },
          ],
        });
      };
      el.querySelector('#ab-rate').addEventListener('input', ab); ab();

      const r72 = () => {
        const r = val(el, 'r72');
        out(el, 'r72', fmt(r, 1).replace(',0', '') + '%');
        const exact = Math.log(2) / Math.log(1 + r / 100);
        el.querySelector('#r72-stats').innerHTML = `
          <div><small>Regra dos 72</small><strong>${fmt(72 / r, 1)} anos</strong></div>
          <div><small>Conta exata</small><strong>${fmt(exact, 1)} anos</strong></div>
          <div><small>Diferença</small><strong>${(m => m < 1 ? 'menos de 1 mês' : m === 1 ? '1 mês' : m + ' meses')(Math.round(Math.abs(72 / r - exact) * 12))}</strong></div>`;
      };
      el.querySelector('#r72').addEventListener('input', r72); r72();
    },
  };

  /* ═════════════════════════════ 2 · EUROMILHÕES ════════════════════ */
  const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
  const TOTAL = C(50, 5) * C(12, 2);                              /* 139 838 160 */
  /* As 13 categorias de prémio, da 1.ª à 13.ª (números + estrelas). */
  const TIERS = [[5, 2], [5, 1], [5, 0], [4, 2], [4, 1], [3, 2], [4, 0], [2, 2], [3, 1], [3, 0], [1, 2], [2, 1], [2, 0]];
  const pTier = (k, s) => (C(5, k) * C(45, 5 - k) / C(50, 5)) * (C(2, s) * C(10, 2 - s) / C(12, 2));
  const P_ANY = TIERS.reduce((a, [k, s]) => a + pTier(k, s), 0);

  function drawSet(n, k) {
    const a = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = 0; i < k; i++) { const j = i + Math.floor(Math.random() * (n - i)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }

  const EURO = {
    id: 'euromilhoes', icon: '🎟️', mins: 4, color: '#f2b344',
    title: 'Euromilhões: quão difícil é ganhar?',
    lead: '139 milhões de combinações postas em perspetiva — e uma máquina para jogares mil anos em segundos.',
    render(el) {
      const years = TOTAL / 104;          /* 2 sorteios por semana, 52 semanas */
      const secsYears = TOTAL / (365.25 * 86400);
      el.innerHTML = `
        <p>No Euromilhões escolhes <strong>5 números de 1 a 50</strong> e <strong>2 estrelas de 1 a 12</strong>. Só há uma forma de acertar em tudo, entre <strong>${fmt(TOTAL)}</strong> combinações possíveis. Um número tão grande que não diz nada à cabeça — por isso, eis algumas maneiras de o ver:</p>
        <div class="xp-facts">
          <div><span>🗓️</span><p>Jogando <strong>uma aposta em cada sorteio</strong> (dois por semana), esperarias em média <strong>${fmt(years / 1e6, 2)} milhões de anos</strong> pelo primeiro prémio.</p></div>
          <div><span>⏱️</span><p>Se escrevesses <strong>uma combinação por segundo</strong>, dia e noite, sem parar, levavas <strong>${fmt(secsYears, 1)} anos</strong> a escrevê-las todas.</p></div>
          <div><span>📄</span><p>Um boletim por combinação, com 0,1 mm cada, faria uma pilha de <strong>${fmt(TOTAL * 0.1 / 1e6, 1)} km</strong> de altura.</p></div>
          <div><span>🎯</span><p>Ganhar <em>algum</em> prémio é bem mais fácil: cerca de <strong>${oneIn(P_ANY)}</strong> apostas — quase sempre a 13.ª categoria.</p></div>
        </div>
        <h3>A máquina do tempo</h3>
        <p>Escolhe os teus números (ou deixa a sorte escolher) e joga-os em todos os sorteios durante anos — tudo simulado aqui, com sorteios aleatórios a sério.</p>
        <div class="xp-box">
          <div class="xp-picker">
            <div class="xp-pk-lbl">Números <small id="em-nc">0/5</small></div>
            <div class="xp-balls" id="em-nums">${Array.from({ length: 50 }, (_, i) => `<button class="xp-ball" data-n="${i + 1}">${i + 1}</button>`).join('')}</div>
            <div class="xp-pk-lbl">Estrelas <small id="em-sc">0/2</small></div>
            <div class="xp-balls xp-stars" id="em-stars">${Array.from({ length: 12 }, (_, i) => `<button class="xp-ball xp-star" data-s="${i + 1}">${i + 1}</button>`).join('')}</div>
            <div class="xp-row">
              <button class="btn btn-sm" id="em-rand">🎲 Escolher por mim</button>
              <label class="xp-inline">Custo por aposta <input type="number" id="em-cost" min="0" step="0.1" value="2.5"> €</label>
            </div>
          </div>
          <div class="xp-row xp-row-wrap">
            <span class="xp-pk-lbl">Jogar durante</span>
            <button class="btn btn-sm" data-y="1">1 ano</button>
            <button class="btn btn-sm" data-y="10">10 anos</button>
            <button class="btn btn-sm" data-y="50">50 anos</button>
            <button class="btn btn-sm btn-primary" data-y="1000">1000 anos</button>
          </div>
          <div id="em-out" class="xp-sim-out"><p class="xp-muted">Escolhe 5 números e 2 estrelas e carrega num dos botões.</p></div>
        </div>
        <h3>As 13 categorias</h3>
        <p>Probabilidade exata de cada categoria numa aposta, calculada por combinatória (quantas combinações dão exatamente aquele acerto, a dividir pelo total).</p>
        <div class="xp-table-wrap"><table class="xp-table">
          <thead><tr><th>Categoria</th><th>Acertos</th><th>Probabilidade</th></tr></thead>
          <tbody>${TIERS.map(([k, s], i) => `<tr><td>${i + 1}.ª</td><td>${k} + ${s} ${s === 1 ? 'estrela' : 'estrelas'}</td><td>${oneIn(pTier(k, s))}</td></tr>`).join('')}</tbody>
        </table></div>
        <h3>Mitos rápidos</h3>
        <ul class="xp-list">
          <li><strong>«1 2 3 4 5» nunca sai.</strong> Tem exatamente a mesma probabilidade que qualquer outra chave. O que muda é que, se sair, há muita gente a dividir o prémio.</li>
          <li><strong>«Este número está atrasado».</strong> As bolas não têm memória: cada sorteio é independente do anterior.</li>
          <li><strong>«Jogar sempre os mesmos aumenta as hipóteses».</strong> Não aumenta nem diminui — ${oneIn(1 / TOTAL)} em cada sorteio, sempre.</li>
        </ul>
        <p class="xp-note">O valor dos prémios varia de sorteio para sorteio (depende das apostas e do número de vencedores), por isso a simulação conta categorias ganhas e o dinheiro gasto, não o dinheiro ganho.</p>`;

      const nums = new Set(), stars = new Set();
      const sync = () => {
        el.querySelectorAll('[data-n]').forEach(b => b.classList.toggle('on', nums.has(+b.dataset.n)));
        el.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', stars.has(+b.dataset.s)));
        el.querySelector('#em-nc').textContent = nums.size + '/5';
        el.querySelector('#em-sc').textContent = stars.size + '/2';
      };
      el.querySelector('#em-nums').addEventListener('click', e => {
        const b = e.target.closest('[data-n]'); if (!b) return;
        const n = +b.dataset.n;
        if (nums.has(n)) nums.delete(n); else if (nums.size < 5) nums.add(n);
        sync();
      });
      el.querySelector('#em-stars').addEventListener('click', e => {
        const b = e.target.closest('[data-s]'); if (!b) return;
        const s = +b.dataset.s;
        if (stars.has(s)) stars.delete(s); else if (stars.size < 2) stars.add(s);
        sync();
      });
      el.querySelector('#em-rand').addEventListener('click', () => {
        nums.clear(); stars.clear();
        drawSet(50, 5).forEach(n => nums.add(n)); drawSet(12, 2).forEach(s => stars.add(s));
        sync();
      });
      el.querySelectorAll('[data-y]').forEach(b => b.addEventListener('click', () => {
        if (nums.size < 5 || stars.size < 2) el.querySelector('#em-rand').click();   /* chave incompleta → a sorte escolhe */
        simulate(+b.dataset.y);
      }));

      function simulate(yrs) {
        const draws = yrs * 104, counts = TIERS.map(() => 0);
        let best = -1;
        for (let d = 0; d < draws; d++) {
          const dn = drawSet(50, 5), ds = drawSet(12, 2);
          let k = 0, s = 0;
          for (const x of dn) if (nums.has(x)) k++;
          for (const x of ds) if (stars.has(x)) s++;
          const t = TIERS.findIndex(([a, b]) => a === k && b === s);
          if (t >= 0) { counts[t]++; if (best < 0 || t < best) best = t; }
        }
        const cost = Math.max(0, +el.querySelector('#em-cost').value || 0);
        const won = counts.reduce((a, b) => a + b, 0);
        const rows = counts.map((c, i) => c ? `<li><span>${i + 1}.ª categoria · ${TIERS[i][0]}+${TIERS[i][1]}</span><b>${fmt(c)}×</b></li>` : '').join('');
        el.querySelector('#em-out').innerHTML = `
          <div class="xp-stats">
            <div><small>Sorteios jogados</small><strong>${fmt(draws)}</strong></div>
            <div><small>Gasto em apostas</small><strong>${eur(draws * cost)}</strong></div>
            <div class="${best === 0 ? 'xp-good' : ''}"><small>Melhor resultado</small><strong>${best < 0 ? 'nenhum prémio' : (best + 1) + '.ª categoria'}</strong></div>
          </div>
          <p class="xp-sim-msg">${best === 0 ? '🤯 Ganhaste o primeiro prémio! Isto acontece numa simulação de mil anos menos de uma vez em cada mil — guarda o print.' : `Em ${fmt(yrs)} ${yrs === 1 ? 'ano' : 'anos'} ganhaste ${fmt(won)} ${won === 1 ? 'prémio menor' : 'prémios menores'} — e ${best < 0 ? 'nem um' : 'nenhum'} primeiro prémio. Esperado em ${fmt(yrs)} ${yrs === 1 ? 'ano' : 'anos'}: ${fmt(draws / TOTAL, 5)} primeiros prémios.`}</p>
          ${rows ? `<ul class="xp-tiers">${rows}</ul>` : ''}`;
      }
    },
  };

  /* ═════════════════════════════ 3 · EPIDEMIA ═══════════════════════ */
  const EPI_COL = { S: '#60a5fa', I: '#ef4444', R: '#94a3b8', V: '#22c55e' };
  const EPI = {
    id: 'epidemia', icon: '🦠', mins: 6, color: '#ef4444',
    title: 'Como se espalha uma epidemia',
    lead: 'Uma cidade de 300 pontinhos, um doente e três alavancas: ficar em casa, vacinar e lavar as mãos.',
    _raf: 0,
    render(el) {
      el.innerHTML = `
        <p>Cada ponto é uma pessoa. <span class="xp-key" style="--k:${EPI_COL.S}">Azul</span> ainda pode apanhar a doença, <span class="xp-key" style="--k:${EPI_COL.I}">vermelho</span> está doente e contagia quem toca, <span class="xp-key" style="--k:${EPI_COL.R}">cinzento</span> já recuperou e <span class="xp-key" style="--k:${EPI_COL.V}">verde</span> foi vacinado. Começa só com um doente. Experimenta pôr metade da cidade em casa e vê o que acontece ao pico.</p>
        <div class="xp-box">
          <div class="xp-controls">
            ${slider('ep-home', 'Pessoas em casa', 0, 90, 5, 0)}
            ${slider('ep-vac', 'Vacinados', 0, 90, 5, 0)}
            ${slider('ep-p', 'Contágio por contacto', 10, 100, 5, 60)}
          </div>
          <div class="xp-epi">
            <canvas id="ep-cv" width="640" height="360" aria-label="Simulação de epidemia"></canvas>
            <div class="xp-epi-side">
              <div class="xp-stats xp-stats-col" id="ep-stats"></div>
              <div class="xp-row"><button class="btn btn-sm btn-primary" id="ep-go">↻ Recomeçar</button><button class="btn btn-sm" id="ep-pause">⏸ Pausa</button></div>
            </div>
          </div>
          <div id="ep-chart"></div>
        </div>
        <h3>O número mágico: R</h3>
        <p><strong>R</strong> é quantas pessoas, em média, cada doente contagia. Se R for maior que 1, a doença cresce; se for menor, apaga-se sozinha. Ficar em casa e lavar as mãos baixam o R; a vacina tira pessoas do jogo.</p>
        <p>Quando há imunes suficientes, o vírus deixa de encontrar quem contagiar — é a <strong>imunidade de grupo</strong>. A percentagem necessária é <code>1 − 1/R₀</code>:</p>
        <div class="xp-box">
          <div class="xp-controls xp-controls-1">${slider('r0', 'R₀ (contágio sem medidas)', 1.1, 18, .1, 3)}</div>
          <div class="xp-stats" id="r0-stats"></div>
        </div>
        <p class="xp-note">É um modelo de brincar — pessoas a ressaltar numa caixa. Epidemias reais dependem de muito mais coisas (idades, redes de contacto, viagens). Mas as ideias de pico, de "achatar a curva" e de imunidade de grupo são exatamente estas.</p>`;

      const cv = el.querySelector('#ep-cv'), ctx = cv.getContext('2d');
      const N = 300, RAD = 4, SICK_T = 250;              /* passos doente (afinado: pico ~45% sem medidas, ~9% com 80% em casa) */
      let pts = [], hist = [], t = 0, paused = false;
      const self = this;

      function reset() {
        const home = val(el, 'ep-home') / 100, vac = val(el, 'ep-vac') / 100;
        pts = Array.from({ length: N }, (_, i) => {
          const still = Math.random() < home, a = Math.random() * Math.PI * 2, sp = still ? 0 : 1;
          return { x: RAD + Math.random() * (cv.width - 2 * RAD), y: RAD + Math.random() * (cv.height - 2 * RAD), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            st: Math.random() < vac ? 'V' : 'S', t: 0 };
        });
        /* o doente zero anda sempre na rua, senão nada acontecia */
        const z = pts.find(p => p.st === 'S') || pts[0];
        const a = Math.random() * Math.PI * 2;
        z.st = 'I'; z.vx = Math.cos(a); z.vy = Math.sin(a);
        hist = []; t = 0;
      }

      function step() {
        const pInf = val(el, 'ep-p') / 100 * 0.2;
        for (const p of pts) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < RAD || p.x > cv.width - RAD) { p.vx *= -1; p.x = Math.max(RAD, Math.min(cv.width - RAD, p.x)); }
          if (p.y < RAD || p.y > cv.height - RAD) { p.vy *= -1; p.y = Math.max(RAD, Math.min(cv.height - RAD, p.y)); }
          if (p.st === 'I' && ++p.t > SICK_T) p.st = 'R';
        }
        /* contactos: grelha espacial para não comparar todos com todos */
        const cell = RAD * 3, grid = new Map();
        pts.forEach((p, i) => { const k = ((p.x / cell) | 0) + ',' + ((p.y / cell) | 0); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
        for (const p of pts) {
          if (p.st !== 'I') continue;
          const cx = (p.x / cell) | 0, cy = (p.y / cell) | 0;
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            for (const j of grid.get((cx + dx) + ',' + (cy + dy)) || []) {
              const q = pts[j];
              if (q.st !== 'S') continue;
              if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < (RAD * 2.2) ** 2 && Math.random() < pInf) { q.st = 'I'; q.t = 0; }
            }
          }
        }
        if (t % 6 === 0) {
          const c = { S: 0, I: 0, R: 0, V: 0 };
          pts.forEach(p => c[p.st]++);
          hist.push(c);
        }
        t++;
      }

      function draw() {
        ctx.clearRect(0, 0, cv.width, cv.height);
        for (const p of pts) {
          ctx.beginPath(); ctx.arc(p.x, p.y, RAD, 0, Math.PI * 2);
          ctx.fillStyle = EPI_COL[p.st]; ctx.globalAlpha = p.st === 'R' ? .55 : 1; ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function stats() {
        const last = hist[hist.length - 1] || { S: 0, I: 0, R: 0, V: 0 };
        const peak = hist.reduce((m, c) => Math.max(m, c.I), 0);
        const ever = last.I + last.R;
        el.querySelector('#ep-stats').innerHTML = `
          <div><small>Doentes agora</small><strong style="color:${EPI_COL.I}">${last.I}</strong></div>
          <div><small>Pico de doentes</small><strong>${peak}</strong></div>
          <div><small>Apanharam a doença</small><strong>${pct(ever / N, 0)}</strong></div>
          <div><small>Nunca apanharam</small><strong style="color:${EPI_COL.S}">${pct((last.S + last.V) / N, 0)}</strong></div>`;
      }

      function plot() {
        const h = hist.length ? hist : [{ S: N, I: 0, R: 0, V: 0 }];
        chart(el.querySelector('#ep-chart'), {
          label: 'Evolução da epidemia', stacked: true, h: 180, yMax: N,
          xs: h.map((_, i) => i), xFmt: (v, full) => full ? `Instante ${v}` : '',
          yFmt: (v, full) => full ? fmt(v) : (v === N ? '100%' : v === 0 ? '0' : ''),
          series: [
            { name: 'Doentes', color: EPI_COL.I, values: h.map(c => c.I), fillOpacity: .55 },
            { name: 'Recuperados', color: EPI_COL.R, values: h.map(c => c.R) },
            { name: 'Vacinados', color: EPI_COL.V, values: h.map(c => c.V) },
            { name: 'Ainda podem apanhar', color: EPI_COL.S, values: h.map(c => c.S), fillOpacity: .14 },
          ],
        });
      }

      let lastPlot = 0;
      function loop() {
        if (!paused) {
          const active = pts.some(p => p.st === 'I');
          if (active) { step(); step(); }
          draw();
          const nowT = performance.now();
          if (nowT - lastPlot > 400 || !active) { stats(); plot(); lastPlot = nowT; }
          if (!active) {                                  /* acabou — regista o fim e pára de gastar CPU */
            const c = { S: 0, I: 0, R: 0, V: 0 }; pts.forEach(p => c[p.st]++); hist.push(c);
            stats(); plot(); self._raf = 0; return;
          }
        }
        self._raf = requestAnimationFrame(loop);
      }
      const restart = () => {
        reset(); paused = false; el.querySelector('#ep-pause').textContent = '⏸ Pausa';
        if (reduced()) { while (pts.some(p => p.st === 'I') && t < 20000) step(); draw(); stats(); plot(); return; }
        if (!self._raf) self._raf = requestAnimationFrame(loop);
      };
      self._restart = restart;
      el.querySelector('#ep-go').addEventListener('click', restart);
      el.querySelector('#ep-pause').addEventListener('click', e => {
        paused = !paused; e.currentTarget.textContent = paused ? '▶ Continuar' : '⏸ Pausa';
        if (!paused && !self._raf) self._raf = requestAnimationFrame(loop);
      });
      ['ep-home', 'ep-vac', 'ep-p'].forEach(id => {
        const i = el.querySelector('#' + id);
        const lab = () => out(el, id, i.value + '%');
        lab();
        i.addEventListener('input', lab);
        /* casa/vacina mudam a cidade → recomeça; o contágio muda em andamento */
        if (id !== 'ep-p') i.addEventListener('change', restart);
      });
      restart();

      const r0 = () => {
        const R = val(el, 'r0');
        out(el, 'r0', fmt(R, 1));
        el.querySelector('#r0-stats').innerHTML = `
          <div><small>Imunes necessários</small><strong>${pct(1 - 1 / R, 0)}</strong></div>
          <div><small>Cada doente contagia</small><strong>${fmt(R, 1)} pessoas</strong></div>
          <div><small>Ao fim de 5 "gerações"</small><strong>${fmt(Math.round(Math.pow(R, 5)))} casos</strong></div>`;
      };
      el.querySelector('#r0').addEventListener('input', r0); r0();
    },
    stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; },
    resume() { if (this._restart && !this._raf) this._restart(); },
  };

  /* ═════════════════════════════ 4 · MONTY HALL ═════════════════════ */
  const MONTY = {
    id: 'monty-hall', icon: '🚪', mins: 4, color: '#a78bfa',
    title: 'O problema de Monty Hall',
    lead: 'Três portas, um carro, duas cabras. Trocar ou ficar? A intuição de quase toda a gente está errada.',
    render(el) {
      el.innerHTML = `
        <p>Num concurso há três portas. Atrás de uma está um carro; atrás das outras, cabras. Escolhes uma porta. O apresentador — que <strong>sabe</strong> onde está o carro — abre uma das outras e mostra uma cabra. Depois pergunta: <em>queres trocar para a porta que falta?</em></p>
        <p>Parece 50/50. Não é. Joga algumas vezes e depois deixa a máquina jogar mil.</p>
        <div class="xp-box">
          <div class="xp-doors" id="mh-doors">${[0, 1, 2].map(i => `<button class="xp-door" data-d="${i}" aria-label="Porta ${i + 1}"><span class="xp-door-n">${i + 1}</span><span class="xp-door-in"></span></button>`).join('')}</div>
          <p class="xp-mh-msg" id="mh-msg" aria-live="polite">Escolhe uma porta.</p>
          <div class="xp-row" id="mh-act"></div>
          <div class="xp-stats" id="mh-score"></div>
        </div>
        <h3>Mil concursos num segundo</h3>
        <div class="xp-box">
          <div class="xp-row"><button class="btn btn-sm btn-primary" id="mh-sim">▶ Jogar 1000 vezes de cada maneira</button></div>
          <div class="xp-bars" id="mh-bars">
            <div class="xp-bar"><span>Ficar sempre</span><div><i id="mh-b-stay"></i></div><b id="mh-v-stay">—</b></div>
            <div class="xp-bar"><span>Trocar sempre</span><div><i id="mh-b-sw" class="xp-good-bg"></i></div><b id="mh-v-sw">—</b></div>
          </div>
        </div>
        <h3>Porque é que trocar ganha 2 em cada 3 vezes?</h3>
        <p>Quando escolheste, tinhas <strong>1/3</strong> de hipóteses de acertar no carro — e isso não muda por o apresentador abrir uma porta. Os outros <strong>2/3</strong> estavam nas duas portas que não escolheste. O apresentador nunca abre a do carro, por isso "arruma" esses 2/3 todos na única porta que deixa fechada.</p>
        <p>Imagina com <strong>100 portas</strong>: escolhes uma, e o apresentador abre 98 com cabras, deixando fechada só a tua e mais uma. Ficavas com a tua (1 em 100) ou trocavas para aquela que ele evitou abrir?</p>
        <div class="xp-hundred" id="mh-100" aria-hidden="true"></div>
        <p class="xp-note">O truque só funciona porque o apresentador sabe onde está o carro e abre sempre uma porta com cabra. Se abrisse ao acaso (e por sorte calhasse uma cabra), aí sim seria 50/50.</p>`;

      let car, pick, opened, phase = 'pick';
      const score = { stay: [0, 0], sw: [0, 0] };          /* [vitórias, jogos] */
      const doors = [...el.querySelectorAll('.xp-door')];
      const msg = el.querySelector('#mh-msg'), act = el.querySelector('#mh-act');

      function newRound() {
        car = Math.floor(Math.random() * 3); pick = null; opened = null; phase = 'pick';
        doors.forEach(d => { d.className = 'xp-door'; d.querySelector('.xp-door-in').textContent = ''; d.disabled = false; });
        msg.textContent = 'Escolhe uma porta.'; act.innerHTML = '';
      }
      function paintScore() {
        const r = ([w, n]) => n ? `${w}/${n} · ${pct(w / n, 0)}` : '—';
        el.querySelector('#mh-score').innerHTML = `
          <div><small>Quando ficaste</small><strong>${r(score.stay)}</strong></div>
          <div class="xp-good"><small>Quando trocaste</small><strong>${r(score.sw)}</strong></div>`;
      }
      el.querySelector('#mh-doors').addEventListener('click', e => {
        const d = e.target.closest('.xp-door'); if (!d || phase !== 'pick') return;
        pick = +d.dataset.d;
        const goats = [0, 1, 2].filter(i => i !== pick && i !== car);
        opened = goats[Math.floor(Math.random() * goats.length)];
        doors[pick].classList.add('picked');
        doors[opened].classList.add('open', 'goat'); doors[opened].querySelector('.xp-door-in').textContent = '🐐'; doors[opened].disabled = true;
        phase = 'decide';
        msg.innerHTML = `Escolheste a porta ${pick + 1}. O apresentador abriu a porta ${opened + 1}: <strong>uma cabra</strong>. Trocas?`;
        const other = [0, 1, 2].find(i => i !== pick && i !== opened);
        act.innerHTML = `<button class="btn btn-sm" id="mh-stay">Fico com a ${pick + 1}</button><button class="btn btn-sm btn-primary" id="mh-sw">Troco para a ${other + 1}</button>`;
        act.querySelector('#mh-stay').onclick = () => finish(false, other);
        act.querySelector('#mh-sw').onclick = () => finish(true, other);
      });
      function finish(sw, other) {
        const final = sw ? other : pick, win = final === car;
        const k = sw ? 'sw' : 'stay'; score[k][1]++; if (win) score[k][0]++;
        doors.forEach((d, i) => {
          d.disabled = true;
          d.classList.add('open', i === car ? 'car' : 'goat');
          d.querySelector('.xp-door-in').textContent = i === car ? '🚗' : '🐐';
          d.classList.remove('picked');
          d.classList.toggle('final', i === final);
        });
        msg.innerHTML = win ? `<strong>Ganhaste o carro!</strong> ${sw ? 'Trocar compensou.' : 'Desta vez ficar compensou.'}` : `<strong>Cabra.</strong> O carro estava na porta ${car + 1}.`;
        act.innerHTML = `<button class="btn btn-sm btn-primary" id="mh-again">Jogar outra vez</button>`;
        act.querySelector('#mh-again').onclick = newRound;
        paintScore();
      }
      newRound(); paintScore();

      el.querySelector('#mh-sim').addEventListener('click', () => {
        const N = 1000; let stay = 0, sw = 0;
        for (let i = 0; i < N; i++) {
          const c = Math.floor(Math.random() * 3), p = Math.floor(Math.random() * 3);
          if (p === c) stay++; else sw++;          /* trocar ganha exatamente quando a 1.ª escolha falhou */
        }
        const set = (id, v) => { el.querySelector('#mh-b-' + id).style.width = (v / N * 100) + '%'; el.querySelector('#mh-v-' + id).textContent = `${fmt(v)} vitórias · ${pct(v / N, 1)}`; };
        set('stay', stay); set('sw', sw);
      });

      el.querySelector('#mh-100').innerHTML = Array.from({ length: 100 }, (_, i) =>
        `<span class="${i === 0 ? 'mine' : i === 73 ? 'other' : 'goat'}"></span>`).join('');
    },
  };

  /* ═════════════════════════════ 5 · ANIVERSÁRIOS ═══════════════════ */
  const pShared = n => { let q = 1; for (let i = 0; i < n; i++) q *= (365 - i) / 365; return 1 - q; };
  const BDAY = {
    id: 'aniversarios', icon: '🎂', mins: 3, color: '#38bdf8',
    title: 'O paradoxo do aniversário',
    lead: 'Numa turma de 23 alunos, é mais provável haver dois com o mesmo aniversário do que não haver.',
    render(el) {
      const xs = Array.from({ length: 80 }, (_, i) => i + 1);
      el.innerHTML = `
        <p>Quantas pessoas são precisas numa sala para ser <strong>mais provável do que não</strong> haver duas que fazem anos no mesmo dia? A maioria das pessoas responde "umas 180" — metade de 365. A resposta certa é <strong>23</strong>.</p>
        <div class="xp-box">
          <div class="xp-controls xp-controls-1">${slider('bd-n', 'Pessoas na sala', 2, 80, 1, 23)}</div>
          <div class="xp-stats" id="bd-stats"></div>
          <div id="bd-chart"></div>
        </div>
        <h3>Experimenta com turmas a sério</h3>
        <p>Gera turmas com aniversários aleatórios e vê o calendário. Os dias repetidos ficam em destaque.</p>
        <div class="xp-box">
          <div class="xp-row">
            <button class="btn btn-sm btn-primary" id="bd-gen">🎲 Nova turma</button>
            <button class="btn btn-sm" id="bd-100">Gerar 100 turmas</button>
            <span class="xp-muted" id="bd-tally"></span>
          </div>
          <div class="xp-cal" id="bd-cal"></div>
          <p class="xp-mh-msg" id="bd-msg"></p>
        </div>
        <h3>Porque é que é tão pouco?</h3>
        <p>O truque é que não estás a procurar alguém que faça anos no <em>teu</em> dia — qualquer par serve. Com 23 pessoas há <strong>${fmt(23 * 22 / 2)} pares</strong> diferentes, e cada um tem uma pequena hipótese de coincidir. Muitas hipóteses pequenas somam depressa.</p>
        <p class="xp-note">As contas supõem que todos os dias do ano são igualmente prováveis e ignoram o 29 de fevereiro. Na vida real os nascimentos não são uniformes, o que torna as coincidências ainda um pouco mais prováveis.</p>`;

      const upd = () => {
        const n = val(el, 'bd-n'), p = pShared(n);
        out(el, 'bd-n', n + ' pessoas');
        el.querySelector('#bd-stats').innerHTML = `
          <div class="${p >= .5 ? 'xp-good' : ''}"><small>Hipótese de haver um par</small><strong>${pct(p, 1)}</strong></div>
          <div><small>Pares possíveis</small><strong>${fmt(n * (n - 1) / 2)}</strong></div>
          <div><small>Para teres 99%</small><strong>57 pessoas</strong></div>`;
        chart(el.querySelector('#bd-chart'), {
          label: 'Probabilidade de partilhar aniversário', xs, yMax: 1, h: 220,
          xFmt: (v, full) => full ? `${v} pessoas` : String(v), yFmt: (v, full) => pct(v, full ? 1 : 0),
          marker: { x: n, label: `${n} → ${pct(p, 0)}` },
          series: [{ name: 'Probabilidade', color: '#38bdf8', values: xs.map(pShared), area: true }],
        });
      };
      el.querySelector('#bd-n').addEventListener('input', () => { upd(); });
      upd();

      const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let classes = 0, withPair = 0;
      const one = n => { const days = Array.from({ length: n }, () => Math.floor(Math.random() * 365)); return days; };
      const hasPair = days => new Set(days).size < days.length;
      function gen() {
        const n = val(el, 'bd-n'), days = one(n);
        classes++; if (hasPair(days)) withPair++;
        const count = new Map(); days.forEach(d => count.set(d, (count.get(d) || 0) + 1));
        let doy = 0, html = '';
        MONTHS.forEach((m, mi) => {
          html += `<div class="xp-cal-row"><b>${m}</b>`;
          for (let d = 0; d < 31; d++) {
            if (d >= DIM[mi]) { html += '<i class="x"></i>'; continue; }
            const c = count.get(doy) || 0;
            html += `<i class="${c > 1 ? 'dup' : c ? 'one' : ''}"${c ? ` title="${d + 1}/${mi + 1}: ${c} ${c > 1 ? 'pessoas' : 'pessoa'}"` : ''}></i>`;
            doy++;
          }
          html += '</div>';
        });
        el.querySelector('#bd-cal').innerHTML = html;
        const dups = [...count.values()].filter(c => c > 1).length;
        el.querySelector('#bd-msg').innerHTML = dups ? `<strong>Há ${dups} ${dups === 1 ? 'dia repetido' : 'dias repetidos'}</strong> nesta turma de ${n}.` : `Nesta turma de ${n} ninguém faz anos no mesmo dia.`;
        tally();
      }
      const tally = () => { el.querySelector('#bd-tally').textContent = !classes ? '' : classes === 1 ? (withPair ? 'Esta turma tem um par' : 'Esta turma não tem nenhum par') : `${withPair} de ${classes} turmas tinham um par (${pct(withPair / classes, 0)})`; };
      el.querySelector('#bd-gen').addEventListener('click', gen);
      el.querySelector('#bd-100').addEventListener('click', () => {
        const n = val(el, 'bd-n');
        for (let i = 0; i < 99; i++) { classes++; if (hasPair(one(n))) withPair++; }
        gen();
      });
      el.querySelector('#bd-n').addEventListener('change', () => { classes = 0; withPair = 0; gen(); });
      gen();
    },
  };

  const EXPLAINERS = [JUROS, EURO, EPI, MONTY, BDAY];

  /* ── navegação ─────────────────────────────────────────────────── */
  const idFromHash = () => (location.hash.slice(1).split('/')[2] || '').split('?')[0];

  function renderHub() {
    _body.innerHTML = `
      <div class="xp-hub">
        <header class="xp-hero">
          <h1>Explicações interativas</h1>
          <p>Ideias que parecem difíceis, explicadas a mexer: muda os valores, carrega nos botões e vê o que acontece.</p>
        </header>
        <div class="xp-cards">
          ${EXPLAINERS.map(x => `
            <a class="xp-card" href="#explorer/explain/${x.id}" style="--xc:${x.color}">
              <span class="xp-card-ico" aria-hidden="true">${x.icon}</span>
              <span class="xp-card-ttl">${esc(x.title)}</span>
              <span class="xp-card-lead">${esc(x.lead)}</span>
              <span class="xp-card-meta">${x.mins} min · interativo →</span>
            </a>`).join('')}
        </div>
      </div>`;
  }

  function renderOne(x) {
    const i = EXPLAINERS.indexOf(x), next = EXPLAINERS[(i + 1) % EXPLAINERS.length];
    _body.innerHTML = `
      <article class="xp-art" style="--xc:${x.color}">
        <a class="xp-back" href="#explorer/explain">← Todas as explicações</a>
        <header class="xp-art-head">
          <span class="xp-art-ico" aria-hidden="true">${x.icon}</span>
          <div><h1>${esc(x.title)}</h1><p>${esc(x.lead)}</p></div>
        </header>
        <div class="xp-art-body" id="xp-art-body"></div>
        <a class="xp-next" href="#explorer/explain/${next.id}">
          <small>Próxima explicação</small><span>${next.icon} ${esc(next.title)} →</span>
        </a>
      </article>`;
    x.render(_body.querySelector('#xp-art-body'));
  }

  function route() {
    const id = idFromHash();
    const x = EXPLAINERS.find(e => e.id === id) || null;
    if (x === _cur && _body.children.length) { if (x && x.resume) x.resume(); return; }
    if (_cur && _cur.stop) _cur.stop();
    _cur = x;
    if (x) renderOne(x); else renderHub();
    _body.scrollTop = 0;
  }

  function mount(sub) {
    _root = sub;
    sub.innerHTML = `<div class="xp-wrap"><div class="xp-body" id="xp-body"></div></div>`;
    _body = sub.querySelector('#xp-body');
    route();
  }
  function resume() { if (_body) route(); }
  function stop() { if (_cur && _cur.stop) _cur.stop(); }
  function discoverRandom() { location.hash = 'explorer/explain/' + EXPLAINERS[Math.floor(Math.random() * EXPLAINERS.length)].id; }

  return { mount, resume, stop, discoverRandom, list: () => EXPLAINERS.map(({ id, icon, title }) => ({ id, icon, title })) };
})();
