const PhotographyPage = (function () {
  'use strict';

  let _built = false;

  // ── Exposure Triangle ──────────────────────────────────────────────
  const SHUTTER_STOPS = ['1/8000','1/4000','1/2000','1/1000','1/500','1/250','1/125','1/60','1/30','1/15','1/8','1/4','1/2','1s','2s','4s','8s','15s','30s'];
  const APERTURE_STOPS = ['f/1.0','f/1.4','f/2.0','f/2.8','f/4','f/5.6','f/8','f/11','f/16','f/22','f/32'];
  const ISO_STOPS = ['50','100','200','400','800','1600','3200','6400','12800','25600','51200'];

  function shutterSec(s) {
    if (s.endsWith('s')) return parseFloat(s);
    const p = s.split('/'); return p.length===2 ? parseFloat(p[0])/parseFloat(p[1]) : parseFloat(s);
  }
  function evFromSettings(ss, ap, iso) {
    return Math.log2(ap*ap/shutterSec(ss)) - Math.log2(iso/100);
  }

  function buildExposure(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">📐 Triângulo de Exposição</div>
        <div class="ph-exp-triangle">
          <div class="ph-exp-cell">
            <div class="ph-exp-icon">⏱</div>
            <div class="ph-exp-name">Velocidade</div>
            <select class="ph-select" id="et-ss">
              ${SHUTTER_STOPS.map(s=>`<option${s==='1/125'?' selected':''}>${s}</option>`).join('')}
            </select>
            <div class="ph-exp-val" id="et-ss-val">1/125s</div>
          </div>
          <div class="ph-exp-cell">
            <div class="ph-exp-icon">🔵</div>
            <div class="ph-exp-name">Abertura</div>
            <select class="ph-select" id="et-ap">
              ${APERTURE_STOPS.map(s=>`<option${s==='f/8'?' selected':''}>${s}</option>`).join('')}
            </select>
            <div class="ph-exp-val" id="et-ap-val">f/8</div>
          </div>
          <div class="ph-exp-cell">
            <div class="ph-exp-icon">☀️</div>
            <div class="ph-exp-name">ISO</div>
            <select class="ph-select" id="et-iso">
              ${ISO_STOPS.map(s=>`<option${s==='100'?' selected':''}>${s}</option>`).join('')}
            </select>
            <div class="ph-exp-val" id="et-iso-val">ISO 100</div>
          </div>
        </div>
        <div class="ph-result">
          <div class="ph-result-val" id="et-ev">EV —</div>
          <div class="ph-result-desc" id="et-desc">Seleciona velocidade, abertura e ISO para calcular o valor de exposição.</div>
        </div>
      </div>`;

    function update() {
      const ss=root.querySelector('#et-ss').value, ap=root.querySelector('#et-ap').value, iso=root.querySelector('#et-iso').value;
      root.querySelector('#et-ss-val').textContent=ss;
      root.querySelector('#et-ap-val').textContent=ap;
      root.querySelector('#et-iso-val').textContent='ISO '+iso;
      const apN=parseFloat(ap.replace('f/',''));
      const ev=evFromSettings(ss,apN,+iso);
      root.querySelector('#et-ev').textContent=`EV ${ev.toFixed(1)}`;
      let desc='';
      if(ev<0) desc='Sobreexposto. Aumenta a velocidade, reduz ISO, ou aumenta f-stop.';
      else if(ev<5) desc='Exposição adequada para interior com pouca luz.';
      else if(ev<10) desc='Exposição para interior com luz artificial.';
      else if(ev<14) desc='Exposição para exterior nublado / interior brilhante.';
      else if(ev<16) desc='Exposição para exterior em sol difuso.';
      else desc='Exposição para luz solar directa intensa.';
      root.querySelector('#et-desc').textContent=desc;
    }
    root.querySelectorAll('select').forEach(s=>s.addEventListener('change',update));
    update();
  }

  // ── DOF Calculator ────────────────────────────────────────────────
  function buildDof(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">🔭 Profundidade de Campo</div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Distância focal (mm)</label>
            <input type="number" class="ph-input" id="dof-fl" value="50" min="1" max="2000">
          </div>
          <div class="ph-field">
            <label class="ph-label">Abertura (f/)</label>
            <input type="number" class="ph-input" id="dof-ap" value="1.8" min="0.7" max="64" step="0.1">
          </div>
        </div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Distância ao sujeito (m)</label>
            <input type="number" class="ph-input" id="dof-dist" value="3" min="0.1" max="10000" step="0.1">
          </div>
          <div class="ph-field">
            <label class="ph-label">Sensor (círculo de confusão, mm)</label>
            <select class="ph-select" id="dof-coc">
              <option value="0.029">Full Frame 35mm (0.029mm)</option>
              <option value="0.019" selected>APS-C (0.019mm)</option>
              <option value="0.015">MFT (0.015mm)</option>
              <option value="0.010">1" sensor (0.010mm)</option>
              <option value="0.005">1/2.3" (0.005mm)</option>
            </select>
          </div>
        </div>
        <button class="t-btn" id="dof-calc" style="margin-bottom:.5rem">Calcular</button>
        <div id="dof-result" class="ph-result" style="display:none"></div>
      </div>`;

    root.querySelector('#dof-calc').addEventListener('click',()=>{
      const fl=parseFloat(root.querySelector('#dof-fl').value);
      const ap=parseFloat(root.querySelector('#dof-ap').value);
      const d=parseFloat(root.querySelector('#dof-dist').value)*1000;
      const coc=parseFloat(root.querySelector('#dof-coc').value);
      const H=(fl*fl)/(ap*coc)+fl;
      const near=d*H/(H+(d-fl));
      const far=d*H/(H-(d-fl));
      const dof=far>0&&H>d-fl?(far-near)/1000:Infinity;
      const res=root.querySelector('#dof-result');
      res.style.display='';
      res.innerHTML=`
        <div class="ph-result-val">DOF: ${dof===Infinity?'∞':(dof<1?dof.toFixed(2)+'m':`${dof.toFixed(2)} m`)}</div>
        <div class="ph-result-desc">
          Plano próximo: ${(near/1000).toFixed(2)} m | Plano distante: ${far>1e6?'∞':(far/1000).toFixed(2)+' m'}<br>
          Distância hiperfocal: ${(H/1000).toFixed(2)} m
        </div>`;
    });
  }

  // ── Focal Length & Crop Factor ────────────────────────────────────
  function buildFocal(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">📷 Focal + Crop Factor</div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Focal real (mm)</label>
            <input type="number" class="ph-input" id="fc-fl" value="35" min="1">
          </div>
          <div class="ph-field">
            <label class="ph-label">Crop factor</label>
            <select class="ph-select" id="fc-crop">
              <option value="1">Full Frame (1×)</option>
              <option value="1.5" selected>APS-C Nikon (1.5×)</option>
              <option value="1.6">APS-C Canon (1.6×)</option>
              <option value="2">Micro 4/3 (2×)</option>
              <option value="2.7">1" sensor (2.7×)</option>
              <option value="5.6">1/2.3" (5.6×)</option>
            </select>
          </div>
        </div>
        <div id="fc-result" class="ph-result"></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:.85rem 0">
        <div class="ph-card-title" style="font-size:.82rem;margin-bottom:.5rem">Distância Hiperfocal</div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Focal (mm)</label>
            <input type="number" class="ph-input" id="hf-fl" value="35" min="1">
          </div>
          <div class="ph-field">
            <label class="ph-label">f/</label>
            <input type="number" class="ph-input" id="hf-ap" value="8" min="0.7" max="64" step="0.1">
          </div>
          <div class="ph-field">
            <label class="ph-label">CoC (mm)</label>
            <input type="number" class="ph-input" id="hf-coc" value="0.019" step="0.001" min="0.001">
          </div>
        </div>
        <div id="hf-result" class="ph-result"></div>
      </div>`;

    function calcFc() {
      const fl=+root.querySelector('#fc-fl').value, crop=+root.querySelector('#fc-crop').value;
      const eq=fl*crop;
      root.querySelector('#fc-result').innerHTML=`
        <div class="ph-result-val">${eq.toFixed(0)} mm equivalente FF</div>
        <div class="ph-result-desc">Ângulo de visão como ${eq.toFixed(0)}mm numa câmara full frame. Factor de crop: ${crop}×</div>`;
    }
    function calcHf() {
      const fl=+root.querySelector('#hf-fl').value, ap=+root.querySelector('#hf-ap').value, coc=+root.querySelector('#hf-coc').value;
      const H=(fl*fl)/(ap*coc)/1000;
      root.querySelector('#hf-result').innerHTML=`
        <div class="ph-result-val">${H.toFixed(2)} m</div>
        <div class="ph-result-desc">Foca a ${H.toFixed(2)} m → tudo de ${(H/2).toFixed(2)} m ao infinito em foco.</div>`;
    }
    root.querySelectorAll('#fc-fl,#fc-crop').forEach(el=>el.addEventListener('input',calcFc));
    root.querySelectorAll('#hf-fl,#hf-ap,#hf-coc').forEach(el=>el.addEventListener('input',calcHf));
    calcFc(); calcHf();
  }

  // ── ND Filter ─────────────────────────────────────────────────────
  function buildNd(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">⬛ Filtro ND</div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Velocidade sem ND</label>
            <select class="ph-select" id="nd-ss">
              ${SHUTTER_STOPS.map(s=>`<option${s==='1/250'?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="ph-field">
            <label class="ph-label">Filtro ND</label>
            <select class="ph-select" id="nd-filter">
              ${[[2,1,'ND2'],[4,2,'ND4'],[8,3,'ND8'],[16,4,'ND16'],[32,5,'ND32'],[64,6,'ND64'],[128,7,'ND128'],[256,8,'ND256'],[512,9,'ND512'],[1000,10,'ND1000'],[4000,12,'ND4000'],[64000,16,'ND64000']].map(([n,s,l])=>`<option value="${s}">${l} (${n}×, −${s} stops)</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="nd-result" class="ph-result"></div>
      </div>`;

    function calcNd() {
      const ss=root.querySelector('#nd-ss').value, stops=+root.querySelector('#nd-filter').value;
      const baseSec=shutterSec(ss);
      const newSec=baseSec*Math.pow(2,stops);
      let display='';
      if(newSec<1) display=`1/${Math.round(1/newSec)}s`;
      else if(newSec<60) display=`${newSec.toFixed(1)}s`;
      else if(newSec<3600) display=`${(newSec/60).toFixed(1)} min`;
      else display=`${(newSec/3600).toFixed(2)} h`;
      root.querySelector('#nd-result').innerHTML=`<div class="ph-result-val">${display}</div><div class="ph-result-desc">De ${ss} → ${display} com o filtro aplicado</div>`;
    }
    root.querySelectorAll('select').forEach(s=>s.addEventListener('change',calcNd));
    calcNd();
  }

  // ── Flash GN ──────────────────────────────────────────────────────
  function buildFlash(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">⚡ Flash — Número Guia</div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Número Guia (GN)</label>
            <input type="number" class="ph-input" id="fl-gn" value="58" min="1">
          </div>
          <div class="ph-field">
            <label class="ph-label">Abertura (f/)</label>
            <input type="number" class="ph-input" id="fl-ap" value="5.6" step="0.1" min="0.7">
          </div>
          <div class="ph-field">
            <label class="ph-label">Distância (m)</label>
            <input type="number" class="ph-input" id="fl-d" value="3" step="0.1" min="0.1">
          </div>
        </div>
        <div class="t-row" style="gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem">
          <button class="t-btn t-btn-ghost" id="fl-calc-d">→ Calcular distância</button>
          <button class="t-btn t-btn-ghost" id="fl-calc-ap">→ Calcular abertura</button>
          <button class="t-btn t-btn-ghost" id="fl-calc-gn">→ Calcular GN</button>
        </div>
        <div id="fl-result" class="ph-result" style="display:none"></div>
      </div>`;

    function show(val,desc){const r=root.querySelector('#fl-result');r.style.display='';r.innerHTML=`<div class="ph-result-val">${val}</div><div class="ph-result-desc">${desc}</div>`;}
    const gn=()=>+root.querySelector('#fl-gn').value, ap=()=>+root.querySelector('#fl-ap').value, d=()=>+root.querySelector('#fl-d').value;
    root.querySelector('#fl-calc-d').addEventListener('click',()=>show(`${(gn()/ap()).toFixed(2)} m`,`GN(${gn()}) ÷ f/${ap()} = distância máxima`));
    root.querySelector('#fl-calc-ap').addEventListener('click',()=>show(`f/${(gn()/d()).toFixed(1)}`,`GN(${gn()}) ÷ ${d()}m = abertura necessária`));
    root.querySelector('#fl-calc-gn').addEventListener('click',()=>show(`GN ${(ap()*d()).toFixed(0)}`,`f/${ap()} × ${d()}m = Número Guia`));
  }

  // ── Long Exposure ─────────────────────────────────────────────────
  function buildLongExposure(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">🌊 Longa Exposição</div>
        <p style="font-size:.75rem;color:var(--muted);margin-bottom:.65rem">Estima o tempo de exposição com base no efeito desejado.</p>
        <div class="ph-field">
          <label class="ph-label">Efeito desejado</label>
          <select class="ph-select" id="le-effect">
            <option value="60">Água sedosa suave (rio lento) — ~60s</option>
            <option value="120">Água sedosa intensa (cascata) — ~2 min</option>
            <option value="10">Nuvens em movimento — ~10s</option>
            <option value="300">Trilhos de luz (carros) — ~5 min</option>
            <option value="900">Trilhos de estrelas (Polaris) — 15 min</option>
            <option value="3600">Light painting — 1h</option>
          </select>
        </div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Velocidade actual (sem ND)</label>
            <select class="ph-select" id="le-base">
              ${SHUTTER_STOPS.filter(s=>shutterSec(s)<=1/30).map(s=>`<option${s==='1/250'?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="le-result" class="ph-result"></div>
      </div>`;

    function calcLe(){
      const target=+root.querySelector('#le-effect').value, base=shutterSec(root.querySelector('#le-base').value);
      const ratio=target/base;
      const stops=Math.log2(ratio);
      const nd=Math.round(stops);
      let ndLabel='';
      const ndMap={1:'ND2',2:'ND4',3:'ND8',4:'ND16',5:'ND32',6:'ND64',7:'ND128',8:'ND256',9:'ND512',10:'ND1000',12:'ND4000'};
      for(let s=nd;s<=nd+2;s++){if(ndMap[s]){ndLabel=ndMap[s]+` (−${s} stops)`;break;}}
      let timeStr=target<60?`${target}s`:target<3600?`${(target/60).toFixed(0)} min`:`${(target/3600).toFixed(1)} h`;
      root.querySelector('#le-result').innerHTML=`
        <div class="ph-result-val">${timeStr}</div>
        <div class="ph-result-desc">Filtro recomendado: ${ndLabel||'ND'+Math.round(Math.pow(2,nd))}<br>Reduza a apertura e ISO ao máximo antes de usar ND.</div>`;
    }
    root.querySelectorAll('select').forEach(s=>s.addEventListener('change',calcLe));
    calcLe();
  }

  // ── Golden Hour ───────────────────────────────────────────────────
  function buildGoldenHour(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">🌅 Hora Dourada & Azul</div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Latitude</label>
            <input type="number" class="ph-input" id="gh-lat" value="38.7" step="0.01" min="-90" max="90">
          </div>
          <div class="ph-field">
            <label class="ph-label">Data</label>
            <input type="date" class="ph-input" id="gh-date">
          </div>
        </div>
        <button class="t-btn" id="gh-calc">Calcular</button>
        <div id="gh-result" class="ph-result" style="display:none"></div>
      </div>`;

    const today=new Date().toISOString().split('T')[0];
    root.querySelector('#gh-date').value=today;

    root.querySelector('#gh-calc').addEventListener('click',()=>{
      const lat=+root.querySelector('#gh-lat').value*Math.PI/180;
      const dateStr=root.querySelector('#gh-date').value;
      const d=new Date(dateStr);
      const J=Math.floor((d-new Date(d.getFullYear(),0,0))/(86400000));
      const dec=-23.45*Math.PI/180*Math.cos(2*Math.PI/365*(J+10));

      function hourAngle(angle){
        const cos=(-Math.sin(angle)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec));
        if(cos<-1||cos>1) return null;
        return Math.acos(cos)*180/Math.PI/15;
      }
      function hhmm(h){const tot=12+(h||0);const hr=Math.floor(tot)%24;const mn=Math.round((tot%1)*60);return `${hr.toString().padStart(2,'0')}:${mn.toString().padStart(2,'0')}`;}

      const sunrise=hourAngle(-0.8333*Math.PI/180), sunset=hourAngle(-0.8333*Math.PI/180);
      const blueHourMorn=hourAngle(-6*Math.PI/180), blueHourEve=hourAngle(-6*Math.PI/180);
      const goldenMorn=hourAngle(-4*Math.PI/180), goldenEve=hourAngle(-4*Math.PI/180);

      const sr=sunrise?hhmm(-sunrise):'—', ss=sunrise?hhmm(sunrise):'—';
      const bhm=blueHourMorn?hhmm(-blueHourMorn):'—', bhe=blueHourEve?hhmm(blueHourEve):'—';
      const ghm=goldenMorn?hhmm(-goldenMorn):'—', ghe=goldenEve?hhmm(goldenEve):'—';

      const res=root.querySelector('#gh-result');
      res.style.display='';
      res.innerHTML=`<div class="ph-result-val">Lat ${(lat*180/Math.PI).toFixed(2)}°</div>
        <div class="ph-result-desc" style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-top:.4rem">
          <span>🌑 Hora azul manhã:</span><span style="color:var(--accent2);font-family:var(--font-mono)">${bhm}</span>
          <span>🌅 Hora dourada manhã:</span><span style="color:var(--amber);font-family:var(--font-mono)">${ghm}</span>
          <span>☀️ Nascer do sol:</span><span style="color:var(--accent);font-family:var(--font-mono)">${sr}</span>
          <span>🌇 Pôr do sol:</span><span style="color:var(--accent);font-family:var(--font-mono)">${ss}</span>
          <span>🌆 Hora dourada tarde:</span><span style="color:var(--amber);font-family:var(--font-mono)">${ghe}</span>
          <span>🌑 Hora azul tarde:</span><span style="color:var(--accent2);font-family:var(--font-mono)">${bhe}</span>
        </div>`;
    });
  }

  // ── Composition Guides ────────────────────────────────────────────
  const COMPOSITIONS = [
    { name:'Regra dos Terços', desc:'Coloca pontos de interesse nos cruzamentos das linhas de 1/3.',
      draw(ctx,W,H){ctx.strokeStyle='rgba(99,102,241,.6)';ctx.lineWidth=1;[1/3,2/3].forEach(f=>{ctx.beginPath();ctx.moveTo(W*f,0);ctx.lineTo(W*f,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,H*f);ctx.lineTo(W,H*f);ctx.stroke();});[1/3,2/3].forEach(x=>[1/3,2/3].forEach(y=>{ctx.beginPath();ctx.arc(W*x,H*y,5,0,2*Math.PI);ctx.fillStyle='rgba(99,102,241,.8)';ctx.fill();}));}},
    { name:'Regra do Ouro (Phi)', desc:'Proporção 1:1.618 — mais harmoniosa que os terços.',
      draw(ctx,W,H){const phi=1.618;const a=W/phi,b=H/phi;ctx.strokeStyle='rgba(245,158,11,.6)';ctx.lineWidth=1;[W-a,a].forEach(x=>{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();});[H-b,b].forEach(y=>{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();});}},
    { name:'Espiral Dourada', desc:'Guia o olhar em espiral para o ponto de interesse.',
      draw(ctx,W,H){ctx.strokeStyle='rgba(245,158,11,.7)';ctx.lineWidth=1.5;const phi=1.618;let rw=W,rh=H,x=0,y=0;for(let i=0;i<8;i++){const sq=Math.min(rw,rh)/phi;ctx.strokeRect(x+(i%4===0?0:i%4===2?rw-sq:0),y+(i%4===1?0:i%4===3?rh-sq:0),sq,sq);if(i%4===0){rw-=sq;}else if(i%4===1){x+=rw;rh-=sq;}else if(i%4===2){x-=sq;rw=sq;}else{y+=sq-rh+sq;rh=sq;}}}},
    { name:'Diagonal Principal', desc:'Posiciona elementos na diagonal de canto a canto.',
      draw(ctx,W,H){ctx.strokeStyle='rgba(34,197,94,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,H);ctx.stroke();ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(0,H);ctx.stroke();}},
    { name:'Linhas Convergentes', desc:'Linhas que convergem para um ponto criam perspectiva e profundidade.',
      draw(ctx,W,H){ctx.strokeStyle='rgba(99,102,241,.5)';ctx.lineWidth=1;const vx=W/2,vy=H*0.4;[[0,H],[W,H],[0,H*0.6],[W,H*0.6],[W*0.2,0],[W*0.8,0]].forEach(([px,py])=>{ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(vx,vy);ctx.stroke();});ctx.beginPath();ctx.arc(vx,vy,5,0,2*Math.PI);ctx.fillStyle='rgba(99,102,241,.9)';ctx.fill();}},
    { name:'Simetria', desc:'A simetria cria equilíbrio e ordem visual.',
      draw(ctx,W,H){ctx.strokeStyle='rgba(239,68,68,.5)';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.setLineDash([]);}},
    { name:'Enquadramento Natural', desc:'Usa elementos da cena (arcos, janelas, ramos) para enquadrar o sujeito.',
      draw(ctx,W,H){ctx.strokeStyle='rgba(34,197,94,.55)';ctx.lineWidth=2;const m=W*0.18;ctx.strokeRect(m,m,W-m*2,H-m*2);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(m,m);ctx.moveTo(W,0);ctx.lineTo(W-m,m);ctx.moveTo(0,H);ctx.lineTo(m,H-m);ctx.moveTo(W,H);ctx.lineTo(W-m,H-m);ctx.stroke();}},
    { name:'Espaço Negativo', desc:'Deixa espaço vazio à frente do sujeito para criar tensão ou movimento.',
      draw(ctx,W,H){ctx.fillStyle='rgba(99,102,241,.08)';ctx.fillRect(W*0.05,H*0.05,W*0.55,H*0.9);ctx.strokeStyle='rgba(99,102,241,.4)';ctx.lineWidth=1;ctx.strokeRect(W*0.05,H*0.05,W*0.55,H*0.9);ctx.fillStyle='rgba(99,102,241,.25)';ctx.beginPath();ctx.arc(W*0.72,H/2,W*0.1,0,2*Math.PI);ctx.fill();ctx.strokeStyle='rgba(99,102,241,.6)';ctx.stroke();}},
  ];

  function buildComposition(root) {
    root.innerHTML=`
      <div>
        <p style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">Exemplos de composições fotográficas. Clica num para ampliar.</p>
        <div class="ph-comp-grid" id="ph-comp-grid"></div>
      </div>`;

    const grid=root.querySelector('#ph-comp-grid');
    COMPOSITIONS.forEach((comp,idx)=>{
      const item=document.createElement('div');
      item.className='ph-comp-item';
      item.innerHTML=`
        <div class="ph-comp-canvas-wrap"><canvas class="ph-comp-canvas" id="ph-comp-${idx}" width="300" height="200"></canvas></div>
        <div class="ph-comp-name">${comp.name}</div>
        <div class="ph-comp-desc">${comp.desc}</div>`;
      grid.appendChild(item);

      requestAnimationFrame(()=>{
        const canvas=item.querySelector('canvas'), ctx2=canvas.getContext('2d');
        const W=300, H=200;
        ctx2.fillStyle=document.body.classList.contains('light')?'#f1f5f9':'#0b1020';
        ctx2.fillRect(0,0,W,H);
        ctx2.save();
        comp.draw(ctx2,W,H);
        ctx2.restore();
      });
    });
  }

  // ── Main ──────────────────────────────────────────────────────────
  function show() {
    const view = document.getElementById('view-photography');
    if (!view) return;

    if (!_built) {
      _built = true;

      const sections = [
        { id:'exposure',     fn:buildExposure,     title:'Exposição' },
        { id:'dof',          fn:buildDof,           title:'Profundidade de Campo' },
        { id:'focal',        fn:buildFocal,         title:'Focal & Crop' },
        { id:'nd',           fn:buildNd,            title:'Filtros ND' },
        { id:'flash',        fn:buildFlash,         title:'Flash' },
        { id:'longexp',      fn:buildLongExposure,  title:'Longa Exposição' },
        { id:'goldenhour',   fn:buildGoldenHour,    title:'Hora Dourada' },
        { id:'composition',  fn:buildComposition,   title:'Composição' },
      ];

      view.innerHTML=`
        <div class="view-inner">
          <div class="page-header">
            <h1 class="page-title">📸 Fotografia</h1>
            <p class="page-subtitle">Calculadoras e referências técnicas</p>
          </div>
          <div class="ph-grid" id="ph-grid"></div>
        </div>`;

      const grid = view.querySelector('#ph-grid');
      const compWrap = document.createElement('div');
      compWrap.style.cssText='grid-column:1/-1';

      sections.forEach(s=>{
        const wrapper = document.createElement('div');
        if (s.id==='composition') { buildComposition(compWrap); grid.appendChild(compWrap); }
        else { s.fn(wrapper); grid.appendChild(wrapper); }
      });
    }
  }

  return { show };
})();
