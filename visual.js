const VisualPage = (function () {
  'use strict';

  let _built = false;
  let _activeTab = 'eisenhower';

  const TABS = [
    { id:'eisenhower', label:'📊 Matriz de Eisenhower' },
    { id:'swot',       label:'🔷 Análise SWOT' },
    { id:'mindmap',    label:'🧠 Mapa Mental' },
    { id:'whiteboard', label:'✏️ Quadro Branco' },
  ];

  // ── Eisenhower Matrix ──────────────────────────────────────────────
  const EIS_QUADS = [
    { id:'q1', dot:'#ef4444', title:'Urgente & Importante',     sub:'Fazer agora',     placeholder:'Ex: Reunião urgente, prazo hoje' },
    { id:'q2', dot:'#3b82f6', title:'Não Urgente & Importante', sub:'Agendar',         placeholder:'Ex: Planear futuro, aprender' },
    { id:'q3', dot:'#f59e0b', title:'Urgente & Não Importante', sub:'Delegar',         placeholder:'Ex: Interrupções, pedidos menores' },
    { id:'q4', dot:'#6b7280', title:'Não Urgente & Não Importante', sub:'Eliminar',    placeholder:'Ex: Distracções, baixa prioridade' },
  ];

  function buildEisenhower(root) {
    function getItems(qid) {
      try { return JSON.parse(localStorage.getItem('eis-'+qid)||'[]'); } catch { return []; }
    }
    function saveItems(qid, items) { localStorage.setItem('eis-'+qid, JSON.stringify(items)); }

    function renderQuad(q) {
      const items = getItems(q.id);
      return `<div class="eis-q" data-qid="${q.id}">
        <div class="eis-q-hdr">
          <span class="eis-q-dot" style="background:${q.dot}"></span>
          <span class="eis-q-title">${q.title}</span>
          <span class="eis-q-sub">${q.sub}</span>
        </div>
        <div class="eis-items" id="eis-items-${q.id}">
          ${items.map((item,i)=>`<div class="eis-item">
            <span class="eis-q-dot" style="background:${q.dot};opacity:.5;width:6px;height:6px;flex-shrink:0"></span>
            <span style="flex:1">${item.replace(/</g,'&lt;')}</span>
            <button class="eis-item-del" data-qid="${q.id}" data-idx="${i}" title="Remover">✕</button>
          </div>`).join('')}
        </div>
        <div class="eis-add-row">
          <input class="eis-add-inp" data-qid="${q.id}" placeholder="${q.placeholder}" maxlength="120">
          <button class="eis-add-btn" data-qid="${q.id}" style="border-color:${q.dot}50;color:${q.dot}">+</button>
        </div>
      </div>`;
    }

    root.innerHTML = `
      <div>
        <div class="t-row" style="margin-bottom:.75rem;flex-wrap:wrap;gap:.4rem">
          <p style="font-size:.78rem;color:var(--muted);flex:1">Organiza as tuas tarefas pela urgência e importância.</p>
          <button class="t-btn t-btn-ghost" id="eis-clear-all" style="font-size:.7rem">🗑 Limpar tudo</button>
          <button class="t-btn t-btn-ghost" id="eis-export" style="font-size:.7rem">📋 Copiar</button>
        </div>
        <div class="eis-matrix">
          ${EIS_QUADS.map(renderQuad).join('')}
        </div>
      </div>`;

    function wireQuad() {
      root.querySelectorAll('.eis-add-btn').forEach(btn => {
        btn.addEventListener('click', () => addItem(btn.dataset.qid, root));
      });
      root.querySelectorAll('.eis-add-inp').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key==='Enter') addItem(inp.dataset.qid, root); });
      });
      root.querySelectorAll('.eis-item-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const items = getItems(btn.dataset.qid);
          items.splice(+btn.dataset.idx, 1);
          saveItems(btn.dataset.qid, items);
          refreshQuad(btn.dataset.qid);
        });
      });
    }

    function addItem(qid, root) {
      const inp = root.querySelector(`.eis-add-inp[data-qid="${qid}"]`);
      const val = inp?.value.trim(); if (!val) return;
      const items = getItems(qid); items.push(val);
      saveItems(qid, items); inp.value='';
      refreshQuad(qid);
    }

    function refreshQuad(qid) {
      const q = EIS_QUADS.find(x=>x.id===qid);
      const container = root.querySelector(`#eis-items-${qid}`);
      if (!container) return;
      const items = getItems(qid);
      container.innerHTML = items.map((item,i)=>`<div class="eis-item">
        <span class="eis-q-dot" style="background:${q.dot};opacity:.5;width:6px;height:6px;flex-shrink:0"></span>
        <span style="flex:1">${item.replace(/</g,'&lt;')}</span>
        <button class="eis-item-del" data-qid="${qid}" data-idx="${i}" title="Remover">✕</button>
      </div>`).join('');
      root.querySelectorAll('.eis-item-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const its = getItems(btn.dataset.qid); its.splice(+btn.dataset.idx, 1);
          saveItems(btn.dataset.qid, its); refreshQuad(btn.dataset.qid);
        });
      });
    }

    root.querySelector('#eis-clear-all')?.addEventListener('click', () => {
      if (!confirm('Limpar todas as tarefas?')) return;
      EIS_QUADS.forEach(q => saveItems(q.id, []));
      EIS_QUADS.forEach(q => refreshQuad(q.id));
    });

    root.querySelector('#eis-export')?.addEventListener('click', () => {
      const text = EIS_QUADS.map(q => `## ${q.title}\n${getItems(q.id).map(i=>'- '+i).join('\n')||'(vazio)'}`).join('\n\n');
      navigator.clipboard.writeText(text).catch(()=>{});
    });

    wireQuad();
  }

  // ── SWOT Analysis ──────────────────────────────────────────────────
  const SWOT_QUADS = [
    { id:'s', label:'💪 Forças (Strengths)',       color:'#22c55e', placeholder:'Vantagens internas, pontos fortes…' },
    { id:'w', label:'⚠️ Fraquezas (Weaknesses)',   color:'#ef4444', placeholder:'Limitações internas, pontos fracos…' },
    { id:'o', label:'🚀 Oportunidades',             color:'#3b82f6', placeholder:'Tendências externas favoráveis…' },
    { id:'t', label:'⚡ Ameaças (Threats)',         color:'#f59e0b', placeholder:'Riscos externos, desafios…' },
  ];

  function buildSwot(root) {
    function getSwot() {
      try { return JSON.parse(localStorage.getItem('swot-data')||'{}'); } catch { return {}; }
    }
    function saveSwot(data) { localStorage.setItem('swot-data', JSON.stringify(data)); }

    const data = getSwot();
    root.innerHTML = `
      <div>
        <div class="t-row" style="margin-bottom:.75rem;flex-wrap:wrap;gap:.4rem">
          <input class="t-input" id="swot-title" placeholder="Análise de: produto, projeto, empresa…" style="flex:1;max-width:400px" value="${(data.title||'').replace(/"/g,'&quot;')}">
          <button class="t-btn t-btn-ghost" id="swot-export" style="font-size:.7rem">📋 Copiar</button>
          <button class="t-btn t-btn-ghost" id="swot-clear" style="font-size:.7rem">🗑 Limpar</button>
        </div>
        <div class="swot-grid">
          ${SWOT_QUADS.map(q=>`
            <div class="swot-q">
              <div class="swot-label" style="color:${q.color}">${q.label}</div>
              <textarea class="swot-textarea" id="swot-${q.id}" placeholder="${q.placeholder}" style="border-color:${q.color}25">${(data[q.id]||'').replace(/</g,'&lt;')}</textarea>
            </div>`).join('')}
        </div>
      </div>`;

    function autosave() {
      const d = { title: root.querySelector('#swot-title').value };
      SWOT_QUADS.forEach(q => d[q.id] = root.querySelector('#swot-'+q.id).value);
      saveSwot(d);
    }

    root.querySelectorAll('textarea,#swot-title').forEach(el => el.addEventListener('input', autosave));

    root.querySelector('#swot-export')?.addEventListener('click', () => {
      const d = getSwot();
      const text = `# Análise SWOT${d.title?': '+d.title:''}\n\n`+SWOT_QUADS.map(q=>`## ${q.label}\n${d[q.id]||'(vazio)'}`).join('\n\n');
      navigator.clipboard.writeText(text).catch(()=>{});
    });

    root.querySelector('#swot-clear')?.addEventListener('click', () => {
      if (!confirm('Limpar a análise SWOT?')) return;
      saveSwot({});
      root.querySelector('#swot-title').value='';
      SWOT_QUADS.forEach(q => { root.querySelector('#swot-'+q.id).value=''; });
    });
  }

  // ── Mind Map (Markmap/Excalidraw embed) ───────────────────────────
  function buildMindmap(root) {
    root.innerHTML = `
      <div>
        <p style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">Escreve a tua estrutura em Markdown para gerar um mapa mental.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;min-height:500px">
          <div style="display:flex;flex-direction:column;gap:.5rem">
            <label class="t-label">Markdown (usa # ## ### para níveis)</label>
            <textarea class="t-textarea" id="mm-in" style="flex:1;min-height:400px;font-size:.8rem" placeholder="# Projecto Principal&#10;## Fase 1&#10;### Tarefa A&#10;### Tarefa B&#10;## Fase 2&#10;### Tarefa C">
# Projecto Principal
## Fase 1
### Tarefa A
### Tarefa B
## Fase 2
### Tarefa C
### Tarefa D
## Fase 3
### Documentação
### Testes</textarea>
          </div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            <label class="t-label">Mapa visual</label>
            <canvas id="mm-canvas" style="background:var(--card2);border:1px solid var(--border);border-radius:var(--radius);flex:1;min-height:400px"></canvas>
          </div>
        </div>
        <div class="t-row" style="margin-top:.65rem;gap:.4rem">
          <button class="t-btn" id="mm-render">Atualizar mapa</button>
          <button class="t-btn t-btn-ghost" id="mm-dl">💾 Descarregar PNG</button>
          <a href="https://excalidraw.com" target="_blank" rel="noopener" class="t-btn t-btn-ghost">↗ Abrir Excalidraw</a>
        </div>
      </div>`;

    const inp = root.querySelector('#mm-in'), canvas = root.querySelector('#mm-canvas');
    function renderMap() {
      const text = inp.value;
      const lines = text.split('\n').filter(l=>l.trim());
      const nodes = lines.map(l => {
        const m = l.match(/^(#+)\s+(.+)/);
        if (!m) return null;
        return { level: m[1].length, label: m[2] };
      }).filter(Boolean);

      const ctx = canvas.getContext('2d');
      const W = canvas.parentElement.clientWidth - 2 || 500;
      const H = 440;
      canvas.width = W; canvas.height = H;

      const isDark = !document.body.classList.contains('light');
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = isDark ? '#0b1020' : '#f8fafc';
      ctx.fillRect(0,0,W,H);

      if (!nodes.length) return;

      const colors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#a855f7','#ec4899'];
      const textColor = isDark ? '#e2e8f0' : '#0f172a';
      const mutedColor = isDark ? '#64748b' : '#94a3b8';

      const root_ = nodes[0];
      const rootX = W/2, rootY = 50;
      const R = 26;

      ctx.beginPath(); ctx.arc(rootX,rootY,R,0,2*Math.PI);
      ctx.fillStyle='#6366f1'; ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 11px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      const rootLabel = root_.label.length>16 ? root_.label.slice(0,14)+'…' : root_.label;
      ctx.fillText(rootLabel, rootX, rootY);

      const l2 = nodes.filter(n=>n.level===2);
      const l2Count = l2.length || 1;
      l2.forEach((n2,i) => {
        const angle = (i/(l2Count)) * 2*Math.PI - Math.PI/2;
        const r2 = Math.min(W*0.38, H*0.55);
        const x2 = rootX + Math.cos(angle)*r2, y2 = rootY + 70 + Math.sin(angle)*(r2*0.55);
        const col = colors[i % colors.length];

        ctx.beginPath(); ctx.moveTo(rootX,rootY+R); ctx.lineTo(x2,y2-18);
        ctx.strokeStyle=col+'99'; ctx.lineWidth=1.5; ctx.stroke();

        ctx.beginPath(); ctx.roundRect?.(x2-45,y2-15,90,28,6) || ctx.rect(x2-45,y2-15,90,28);
        ctx.fillStyle=col+'22'; ctx.fill();
        ctx.strokeStyle=col+'66'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle=col; ctx.font='bold 10px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        const l2label = n2.label.length>16 ? n2.label.slice(0,14)+'…' : n2.label;
        ctx.fillText(l2label, x2, y2);

        const idx2 = nodes.indexOf(n2);
        const children = [];
        for(let k=idx2+1;k<nodes.length&&nodes[k].level>2;k++) { if(nodes[k].level===3) children.push(nodes[k]); }
        children.forEach((ch,ci) => {
          const offset = (ci-(children.length-1)/2)*38;
          const cx = x2 + offset, cy = y2 + 55;
          ctx.beginPath(); ctx.moveTo(x2,y2+14); ctx.lineTo(cx,cy-10);
          ctx.strokeStyle=mutedColor+'80'; ctx.lineWidth=1; ctx.stroke();
          ctx.beginPath(); ctx.roundRect?.(cx-38,cy-10,76,20,4) || ctx.rect(cx-38,cy-10,76,20);
          ctx.fillStyle=isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.04)'; ctx.fill();
          ctx.strokeStyle=mutedColor+'40'; ctx.stroke();
          ctx.fillStyle=textColor; ctx.font='9px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
          const chlabel = ch.label.length>14 ? ch.label.slice(0,12)+'…' : ch.label;
          ctx.fillText(chlabel, cx, cy);
        });
      });
    }

    root.querySelector('#mm-render').addEventListener('click', renderMap);
    root.querySelector('#mm-dl').addEventListener('click', () => {
      renderMap();
      const a = document.createElement('a');
      a.download = 'mindmap.png'; a.href = canvas.toDataURL(); a.click();
    });
    inp.addEventListener('input', () => clearTimeout(inp._t) || (inp._t = setTimeout(renderMap, 600)));
    setTimeout(renderMap, 100);
  }

  // ── Whiteboard ────────────────────────────────────────────────────
  function buildWhiteboard(root) {
    root.innerHTML=`
      <div>
        <div class="t-row" style="margin-bottom:.5rem;flex-wrap:wrap;gap:.4rem">
          <div class="tool-seg">
            <button class="tsb active" data-tool="pen">✏️ Caneta</button>
            <button class="tsb" data-tool="rect">▭ Rect</button>
            <button class="tsb" data-tool="circle">○ Círculo</button>
            <button class="tsb" data-tool="triangle">△ Triângulo</button>
            <button class="tsb" data-tool="line">/ Linha</button>
            <button class="tsb" data-tool="eraser">⬜ Borracha</button>
          </div>
          <div class="tool-opts-grp">
            <span class="tool-opts-lbl">Cor</span>
            <div class="tool-colors" id="wb-colors">
              ${['#6366f1','#ef4444','#22c55e','#f59e0b','#e2e8f0','#0f172a'].map((c,i)=>`<button class="tcol${i===0?' active':''}" data-c="${c}" style="--tc:${c}"></button>`).join('')}
            </div>
          </div>
          <div class="tool-opts-grp">
            <span class="tool-opts-lbl">Espessura</span>
            <div class="tool-seg" id="wb-size">
              ${[1,2,4,8,14].map((s,i)=>`<button class="tsb${i===2?' active':''}" data-s="${s}">${s}</button>`).join('')}
            </div>
          </div>
          <button class="t-btn t-btn-ghost" id="wb-clear">🗑 Limpar</button>
          <button class="t-btn t-btn-ghost" id="wb-dl">💾 PNG</button>
        </div>
        <canvas id="wb-canvas" style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);cursor:crosshair;display:block;width:100%;touch-action:none"></canvas>
      </div>`;

    const canvas=root.querySelector('#wb-canvas');
    const ctx=canvas.getContext('2d');
    let drawing=false, tool='pen', color='#6366f1', size=4;
    let startX=0, startY=0, snapshot=null;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.parentElement.clientWidth - 2;
      const cssH = Math.max(450, window.innerHeight * 0.55);
      const prevImg = canvas.toDataURL();
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cssW, cssH);
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cssW, cssH);
      img.src = prevImg;
    }
    resize();

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - r.left), y: (src.clientY - r.top) };
    }

    function down(e) {
      e.preventDefault();
      drawing = true;
      const p = pos(e);
      startX = p.x; startY = p.y;
      if (tool === 'pen' || tool === 'eraser') {
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
      } else {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    }

    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      if (tool === 'pen' || tool === 'eraser') {
        ctx.lineTo(p.x, p.y); ctx.stroke();
      } else {
        ctx.putImageData(snapshot, 0, 0);
        applyStyle();
        const dx = p.x - startX, dy = p.y - startY;
        ctx.beginPath();
        if (tool === 'rect') { ctx.strokeRect(startX, startY, dx, dy); }
        else if (tool === 'circle') { ctx.ellipse(startX + dx/2, startY + dy/2, Math.abs(dx)/2, Math.abs(dy)/2, 0, 0, 2*Math.PI); ctx.stroke(); }
        else if (tool === 'triangle') {
          ctx.moveTo(startX + dx/2, startY);
          ctx.lineTo(startX + dx, startY + dy);
          ctx.lineTo(startX, startY + dy);
          ctx.closePath(); ctx.stroke();
        }
        else if (tool === 'line') { ctx.moveTo(startX, startY); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      }
    }

    function up() { drawing = false; snapshot = null; if (tool === 'pen' || tool === 'eraser') ctx.beginPath(); }

    function applyStyle() {
      ctx.strokeStyle = tool === 'eraser' ? '#fff' : color;
      ctx.lineWidth = tool === 'eraser' ? size * 4 : size;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
    applyStyle();

    canvas.addEventListener('mousedown', down); canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', up); canvas.addEventListener('mouseleave', up);
    canvas.addEventListener('touchstart', down, {passive:false}); canvas.addEventListener('touchmove', move, {passive:false});
    canvas.addEventListener('touchend', up);

    root.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      tool = b.dataset.tool;
      root.querySelectorAll('[data-tool]').forEach(x => x.classList.remove('active')); b.classList.add('active');
      applyStyle();
    }));
    root.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
      color = b.dataset.c;
      if (tool === 'eraser') { tool = 'pen'; root.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('active', x.dataset.tool === 'pen')); }
      root.querySelectorAll('[data-c]').forEach(x => x.classList.remove('active')); b.classList.add('active');
      applyStyle();
    }));
    root.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
      size = +b.dataset.s; root.querySelectorAll('[data-s]').forEach(x => x.classList.remove('active')); b.classList.add('active'); applyStyle();
    }));
    root.querySelector('#wb-clear').addEventListener('click', () => { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width/((window.devicePixelRatio||1)),canvas.height/((window.devicePixelRatio||1))); });
    root.querySelector('#wb-dl').addEventListener('click', () => { const a=document.createElement('a'); a.download='whiteboard.png'; a.href=canvas.toDataURL(); a.click(); });
    window.addEventListener('resize', resize);
  }

  // ── Main ──────────────────────────────────────────────────────────
  const _tabContent = {};

  function show() {
    const view = document.getElementById('view-visual');
    if (!view) return;

    if (!_built) {
      _built = true;
      view.innerHTML = `
        <div class="view-inner">
          <div class="page-header">
            <h1 class="page-title">🧩 Ferramentas Visuais</h1>
            <p class="page-subtitle">Planeamento visual, mapas mentais e análise</p>
          </div>
          <div class="vt-tabs">
            ${TABS.map(t=>`<button class="vt-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
          </div>
          <div id="vt-content"></div>
        </div>`;
      view.querySelectorAll('.vt-tab').forEach(btn=>btn.addEventListener('click',()=>selectTab(btn.dataset.tab)));
    }
    selectTab(_activeTab);
  }

  function selectTab(id) {
    _activeTab = id;
    const view = document.getElementById('view-visual');
    view?.querySelectorAll('.vt-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
    const content = document.getElementById('vt-content');
    if (!content) return;

    if (!_tabContent[id]) {
      _tabContent[id] = document.createElement('div');
      switch(id) {
        case 'eisenhower': buildEisenhower(_tabContent[id]); break;
        case 'swot':       buildSwot(_tabContent[id]); break;
        case 'mindmap':    buildMindmap(_tabContent[id]); break;
        case 'whiteboard': buildWhiteboard(_tabContent[id]); break;
      }
    }
    content.innerHTML='';
    content.appendChild(_tabContent[id]);
    if (id==='mindmap') setTimeout(()=>_tabContent[id].querySelector('#mm-canvas') && _tabContent[id].querySelector('#mm-render')?.click(), 100);
  }

  return { show };
})();
