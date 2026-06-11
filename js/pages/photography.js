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
              <option value="0.018" selected>Canon APS-C — M50 Mark II (0.018mm)</option>
              <option value="0.019">APS-C Nikon/Sony (0.019mm)</option>
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
              <option value="1.5">APS-C Nikon/Sony (1.5×)</option>
              <option value="1.6" selected>APS-C Canon (1.6×) — M50 Mark II</option>
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
            <input type="number" class="ph-input" id="hf-coc" value="0.018" step="0.001" min="0.001">
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
    { name:'Regra dos Terços', desc:'Divide o enquadramento em 9 partes iguais com 2 linhas horizontais e 2 verticais. Os 4 pontos de cruzamento são os pontos focais ideais — o olho humano navega naturalmente por eles, tornando a imagem mais dinâmica e equilibrada do que colocar o sujeito ao centro.',
      tips:'Horizontes: coloca na linha 1/3 superior (céu dramático) ou inferior (terra/água em destaque). Rostos: olho mais próximo no cruzamento superior. Sujeitos em movimento: posiciona-os no terço oposto à direção do movimento — dá espaço de respiração.',
      examples:'Fotografia de paisagem (horizonte a 1/3), retratos (olhos no cruzamento superior), fotografia de street (sujeito no terço lateral).',
      draw(ctx,W,H){
        ctx.strokeStyle='rgba(99,102,241,.55)';ctx.lineWidth=1;
        [1/3,2/3].forEach(f=>{
          ctx.beginPath();ctx.moveTo(W*f,0);ctx.lineTo(W*f,H);ctx.stroke();
          ctx.beginPath();ctx.moveTo(0,H*f);ctx.lineTo(W,H*f);ctx.stroke();
        });
        [1/3,2/3].forEach(x=>[1/3,2/3].forEach(y=>{
          ctx.beginPath();ctx.arc(W*x,H*y,6,0,2*Math.PI);
          ctx.fillStyle='rgba(99,102,241,.75)';ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
          ctx.strokeStyle='rgba(99,102,241,.55)';ctx.lineWidth=1;
        }));
      }},
    { name:'Proporção Áurea (Phi)', desc:'Proporção 1:1.618 (número phi) — ligeiramente diferente dos terços mas considerada a mais harmoniosa pela natureza. As linhas divisórias criam a mesma proporção entre os segmentos que se encontra em conchas, galáxias e flores. Os 4 pontos de cruzamento são mais precisos e naturais que os dos terços.',
      tips:'Mais subtil e elegante que os terços. Ideal para retratos formais, fotografia de produto e composições arquitetónicas. A divisão phi não está a 1/3 (33.3%) mas a 38.2% e 61.8% do lado — note a diferença subtil mas importante.',
      examples:'Retratos clássicos (estilo Rembrandt, Caravaggio), fotografia de produto de luxo, arquitetura com proporções geométricas.',
      draw(ctx,W,H){
        const phi=1.618;const gx=W/phi,gy=H/phi;
        ctx.strokeStyle='rgba(245,158,11,.55)';ctx.lineWidth=1;
        [gx,W-gx].forEach(x=>{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();});
        [gy,H-gy].forEach(y=>{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();});
        [gx,W-gx].forEach(x=>[gy,H-gy].forEach(y=>{
          ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);ctx.fillStyle='rgba(245,158,11,.8)';ctx.fill();
        }));
      }},
    { name:'Espiral Dourada', desc:'Espiral logarítmica baseada na proporção áurea — o olhar segue naturalmente a curva até ao ponto focal no centro. O raio cresce por um fator de φ=1.618 a cada 90°. É a mesma proporção que se encontra em conchas de nautilus, galáxias espirais e em obras de Da Vinci.',
      tips:'Roda o enquadramento (ou o telemóvel/câmara) para que o elemento principal coincida com o centro apertado da espiral. O movimento da curva deve guiar o olhar. Funciona melhor quando há uma linha natural em curva (estrada, rio, braço, silhueta).',
      examples:'Retratos de beleza (rosto no centro da espiral), paisagens com rios sinuosos, macro de flores, composições arquitetónicas com escadas em espiral.',
      draw(ctx,W,H){
        const phi=1.618033988749895,b=Math.log(phi)/(Math.PI/2);
        // Focal point at the phi-division intersection (upper-left quadrant anchor)
        const cx=W/phi, cy=H/phi;
        // Subtle phi grid
        ctx.strokeStyle='rgba(245,158,11,.18)';ctx.lineWidth=0.7;
        [W/phi,W-W/phi].forEach(gx=>{ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();});
        [H/phi,H-H/phi].forEach(gy=>{ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();});
        // Compute max r such that spiral stays in canvas over 3 turns (tMax = 3π)
        // At t=3π the spiral points left: need r*1 ≤ cx
        // At t=5π/2 (down): r*1 ≤ H-cy
        // At t=2π (right): r*1 ≤ W-cx
        // At t=3π/2 (up): r*1 ≤ cy
        const tMax=Math.PI*3;
        const r0=Math.min(
          (W-cx) / Math.exp(b*Math.PI*2),
          (H-cy) / Math.exp(b*Math.PI*5/2),
          cx      / Math.exp(b*Math.PI*3),
          cy      / Math.exp(b*Math.PI*3/2)
        )*0.88;
        // Draw spiral from center outward
        ctx.strokeStyle='rgba(245,158,11,.9)';ctx.lineWidth=2;ctx.beginPath();
        for(let i=0;i<=800;i++){
          const t=(i/800)*tMax;
          const r=r0*Math.exp(b*t);
          const x=cx+r*Math.cos(t),y=cy+r*Math.sin(t);
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
        // Focal point dot
        ctx.fillStyle='rgba(245,158,11,.9)';ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
      }},
    { name:'Diagonal Principal', desc:'Elementos ao longo da diagonal criam tensão, energia e movimento — muito mais dinâmicos que horizontais ou verticais.',
      tips:'Diagonal ↗: lida como movimento natural no sentido de leitura. Diagonal ↙: tensão e drama. Estradas, rios, sombras e braços funcionam bem.',
      draw(ctx,W,H){
        ctx.strokeStyle='rgba(34,197,94,.7)';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,H);ctx.stroke();
        ctx.strokeStyle='rgba(34,197,94,.2)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(0,H);ctx.stroke();
        ctx.fillStyle='rgba(34,197,94,.06)';
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.lineTo(W,H);ctx.closePath();ctx.fill();
      }},
    { name:'Linhas Convergentes', desc:'Linhas que convergem num ponto de fuga criam profundidade, escala e perspetiva muito fortes. O olhar é irresistivelmente atraído.',
      tips:'Estradas, carris, corredores, árvores em linha. O sujeito fica no ou perto do ponto de convergência. O ponto de fuga pode estar fora do enquadramento.',
      draw(ctx,W,H){
        const vx=W/2,vy=H*0.38;
        ctx.strokeStyle='rgba(99,102,241,.4)';ctx.lineWidth=1;
        [[0,H],[W*0.22,H],[W*0.44,H],[W*0.56,H],[W*0.78,H],[W,H],[0,H*0.7],[W,H*0.7]].forEach(([px,py])=>{
          ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(vx,vy);ctx.stroke();
        });
        ctx.fillStyle='rgba(99,102,241,.85)';ctx.beginPath();ctx.arc(vx,vy,6,0,2*Math.PI);ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
        ctx.strokeStyle='rgba(99,102,241,.2)';ctx.lineWidth=0.8;ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.moveTo(0,vy);ctx.lineTo(W,vy);ctx.stroke();ctx.setLineDash([]);
      }},
    { name:'Simetria & Reflexo', desc:'Simetria perfeita cria equilíbrio e harmonia. Reflexos em água duplicam o sujeito. Quebrar a simetria com um elemento cria interesse.',
      tips:'Superfícies de água, espelhos, janelas. Assimetria deliberada (60/40) é mais interessante que perfeição (50/50). Inclina ligeiramente para dinamismo.',
      draw(ctx,W,H){
        ctx.strokeStyle='rgba(239,68,68,.5)';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);
        ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='rgba(239,68,68,.04)';
        ctx.fillRect(0,0,W/2,H/2);ctx.fillRect(W/2,H/2,W/2,H/2);
      }},
    { name:'Enquadramento Natural', desc:'Elementos da cena (arcos, janelas, ramos, portas) funcionam como moldura, dirigindo o olhar ao sujeito e dando contexto e profundidade.',
      tips:'Procura arcos, portas, túneis, copas de árvores. Foca no sujeito dentro da moldura — o enquadramento pode estar desfocado. Dá camadas à imagem.',
      draw(ctx,W,H){
        const m=W*0.16,mt=H*0.14;
        ctx.strokeStyle='rgba(34,197,94,.55)';ctx.lineWidth=2;
        ctx.strokeRect(m,mt,W-m*2,H-mt*2);
        ctx.strokeStyle='rgba(34,197,94,.35)';ctx.lineWidth=1.5;
        [[0,0,m,mt],[W,0,W-m,mt],[0,H,m,H-mt],[W,H,W-m,H-mt]].forEach(([x1,y1,x2,y2])=>{
          ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        });
        ctx.fillStyle='rgba(34,197,94,.12)';ctx.fillRect(m,mt,W-m*2,H-mt*2);
        ctx.fillStyle='rgba(34,197,94,.3)';ctx.beginPath();ctx.arc(W/2,H/2,W*0.09,0,Math.PI*2);ctx.fill();
      }},
    { name:'Espaço Negativo', desc:'Espaço vazio intencional em torno do sujeito. O vazio define o sujeito, cria respiração visual e reforça emoção (solidão, imensidão).',
      tips:'Quanto mais pequeno o sujeito no espaço, maior a sensação de vastidão. Deixa espaço à frente do sujeito (espaço de movimento). Fundos limpos são essenciais.',
      draw(ctx,W,H){
        ctx.fillStyle='rgba(99,102,241,.06)';ctx.fillRect(W*0.04,H*0.08,W*0.58,H*0.84);
        ctx.strokeStyle='rgba(99,102,241,.3)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
        ctx.strokeRect(W*0.04,H*0.08,W*0.58,H*0.84);ctx.setLineDash([]);
        ctx.fillStyle='rgba(99,102,241,.35)';ctx.beginPath();ctx.arc(W*0.74,H/2,W*0.09,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(99,102,241,.65)';ctx.lineWidth=1.5;ctx.stroke();
        ctx.strokeStyle='rgba(99,102,241,.4)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(W*0.64,H/2);ctx.lineTo(W*0.28,H/2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(W*0.32,H/2-6);ctx.lineTo(W*0.26,H/2);ctx.lineTo(W*0.32,H/2+6);ctx.stroke();
      }},
    { name:'Curva em S', desc:'Linhas sinuosas em forma de S (ou C) guiam o olhar suavemente pelo enquadramento, criando fluidez, elegância e profundidade.',
      tips:'Estradas sinuosas, rios, caminhos, postura do corpo, praias. A curva S divide o espaço e dá profundidade — especialmente eficaz em paisagens.',
      draw(ctx,W,H){
        ctx.strokeStyle='rgba(168,85,247,.15)';ctx.lineWidth=12;
        ctx.beginPath();ctx.moveTo(W*0.2,H);ctx.bezierCurveTo(W*0.2,H*0.6,W*0.8,H*0.4,W*0.8,0);ctx.stroke();
        ctx.strokeStyle='rgba(168,85,247,.8)';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(W*0.2,H);ctx.bezierCurveTo(W*0.2,H*0.6,W*0.8,H*0.4,W*0.8,0);ctx.stroke();
        ctx.fillStyle='rgba(168,85,247,.6)';
        [[W*0.22,H*0.85],[W*0.35,H*0.65],[W*0.5,H*0.5],[W*0.65,H*0.35],[W*0.78,H*0.15]].forEach(([x,y])=>{
          ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
        });
      }},
    { name:'Composição em Triângulo', desc:'Três pontos ou elementos formam um triângulo visual — estável, equilibrado e harmonioso. Guia o olhar em ciclo pelos três vértices.',
      tips:'Não precisa ser explícito: três objetos, olhares ou linhas imaginárias formam o triângulo. Triângulo invertido cria instabilidade intencional e tensão.',
      draw(ctx,W,H){
        const pts=[[W/2,H*0.12],[W*0.82,H*0.82],[W*0.18,H*0.82]];
        ctx.strokeStyle='rgba(251,146,60,.65)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(...pts[0]);ctx.lineTo(...pts[1]);ctx.lineTo(...pts[2]);ctx.closePath();ctx.stroke();
        ctx.fillStyle='rgba(251,146,60,.06)';ctx.fill();
        pts.forEach(([x,y])=>{
          ctx.fillStyle='rgba(251,146,60,.8)';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1.5;ctx.stroke();
        });
      }},
  ];

  function drawCompCanvas(canvas, comp) {
    const ctx2 = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx2.fillStyle = document.body.classList.contains('light') ? '#f1f5f9' : '#0b1020';
    ctx2.fillRect(0, 0, W, H);
    ctx2.save();
    comp.draw(ctx2, W, H);
    ctx2.restore();
  }

  function openCompModal(comp) {
    let modal = document.getElementById('ph-comp-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ph-comp-modal';
      modal.className = 'ph-modal-overlay';
      modal.innerHTML = `<div class="ph-modal-box" style="max-width:820px">
        <div class="ph-modal-hdr">
          <span class="ph-modal-title" id="ph-modal-title"></span>
          <button class="ph-modal-close" id="ph-modal-close">✕</button>
        </div>
        <div class="ph-comp-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:0">
          <canvas class="ph-modal-canvas" id="ph-modal-canvas" style="aspect-ratio:4/3;border-right:1px solid var(--border)"></canvas>
          <div style="padding:1rem;overflow-y:auto;max-height:420px;display:flex;flex-direction:column;gap:.75rem">
            <div id="ph-modal-desc" style="font-size:.82rem;color:var(--text2);line-height:1.6"></div>
            <div id="ph-modal-tips" style="padding:.65rem .75rem;background:var(--accent-soft);border-radius:var(--radius-sm);font-size:.78rem;color:var(--text2);line-height:1.6"></div>
            <div id="ph-modal-examples" style="font-size:.78rem;color:var(--muted);line-height:1.6"></div>
          </div>
        </div>
      </div>`;
      document.body.appendChild(modal);
      document.getElementById('ph-modal-close').addEventListener('click', () => { modal.hidden = true; });
      modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
    }
    modal.hidden = false;
    document.getElementById('ph-modal-title').textContent = comp.name;
    document.getElementById('ph-modal-desc').innerHTML = comp.desc;
    const tipsEl = document.getElementById('ph-modal-tips');
    if (comp.tips) {
      tipsEl.innerHTML = `<strong>💡 Dica prática:</strong> ${comp.tips}`;
      tipsEl.style.display = '';
    } else {
      tipsEl.style.display = 'none';
    }
    const examplesEl = document.getElementById('ph-modal-examples');
    if (comp.examples) {
      examplesEl.innerHTML = `<strong>📷 Exemplos:</strong> ${comp.examples}`;
    } else {
      examplesEl.textContent = '';
    }
    const canvas = document.getElementById('ph-modal-canvas');
    canvas.width = 560; canvas.height = 420;
    requestAnimationFrame(() => drawCompCanvas(canvas, comp));
  }

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
      item.style.cursor='pointer';
      item.title='Clica para ampliar';
      item.innerHTML=`
        <div class="ph-comp-canvas-wrap"><canvas class="ph-comp-canvas" id="ph-comp-${idx}" width="300" height="200"></canvas></div>
        <div class="ph-comp-name">${comp.name}</div>
        <div class="ph-comp-desc">${comp.desc}</div>`;
      grid.appendChild(item);

      requestAnimationFrame(()=>{
        const canvas=item.querySelector('canvas');
        drawCompCanvas(canvas, comp);
      });

      item.addEventListener('click', () => openCompModal(comp));
    });
  }

  // ── Color Wheel ───────────────────────────────────────────────────
  function buildColorWheel(root) {
    root.innerHTML=`
      <div>
        <p style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">Roda de cores interativa. Clica na roda para escolher o tom, e no interior para ajustar a luminosidade.</p>
        <div class="cw-root">
          <div class="cw-canvas-col">
            <div class="cw-size-row">
              <div class="tool-seg" id="cw-size-seg">
                <button class="tsb" data-s="160">S</button>
                <button class="tsb active" data-s="220">M</button>
                <button class="tsb" data-s="280">L</button>
              </div>
            </div>
            <canvas id="cw-canvas" class="cw-canvas" width="220" height="220"></canvas>
          </div>
          <div class="cw-info-col">
            <div class="tool-opts-grp">
              <span class="tool-opts-lbl">Modo de Harmonia</span>
              <div class="tool-seg" id="cw-harm-seg" style="flex-wrap:wrap;gap:.25rem">
                <button class="tsb" data-h="none">Nenhum</button>
                <button class="tsb active" data-h="complement">Complementar</button>
                <button class="tsb" data-h="triad">Triádico</button>
                <button class="tsb" data-h="split">Split</button>
                <button class="tsb" data-h="analog">Análogo</button>
                <button class="tsb" data-h="square">Tetrádico</button>
              </div>
            </div>
            <div class="cw-preview-row">
              <div class="cw-preview" id="cw-preview"></div>
              <div class="cw-color-info">
                <div class="cw-color-name" id="cw-color-name">Índigo</div>
                <div class="cw-color-val" id="cw-color-hex">#6366f1</div>
                <div class="cw-color-val2" id="cw-color-hsl">H:239 S:84% L:67%</div>
                <div class="cw-color-val2" id="cw-color-rgb">rgb(99,102,241)</div>
              </div>
            </div>
            <div>
              <div class="tool-opts-lbl" style="margin-bottom:.35rem">Cores da harmonia</div>
              <div class="cw-harmony-swatches" id="cw-harm-swatches"></div>
            </div>
            <div class="cw-copy-row">
              <button class="t-copy-btn" id="cw-copy-hex">HEX</button>
              <button class="t-copy-btn" id="cw-copy-hsl">HSL</button>
              <button class="t-copy-btn" id="cw-copy-rgb">RGB</button>
            </div>
          </div>
        </div>
      </div>`;

    let hue=239, sat=84, lit=67, wheelSize=220, harmMode='complement';

    function hslToRgb(h,s,l){
      s/=100;l/=100;const k=n=>(n+h/30)%12;const a=s*Math.min(l,1-l);
      const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
      return [Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255)];
    }
    function hslToHex(h,s,l){
      const [r,g,b]=hslToRgb(h,s,l);
      return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
    }
    function getColorName(h,s,l){
      if(l<8)return'Preto';if(l>92)return'Branco';if(s<12)return'Cinzento';
      const n=[[0,15,'Vermelho'],[15,30,'Laranja'],[30,65,'Amarelo'],[65,150,'Verde'],
               [150,185,'Verde-azulado'],[185,215,'Ciano'],[215,255,'Azul'],
               [255,290,'Índigo'],[290,325,'Violeta'],[325,345,'Rosa'],[345,360,'Vermelho']];
      return(n.find(([a,b])=>h>=a&&h<b)||['','','Desconhecido'])[2];
    }
    function harmAngles(mode){
      return{none:[],complement:[180],triad:[120,240],split:[150,210],analog:[-30,30],square:[90,180,270]}[mode]||[];
    }

    function drawWheel(){
      const canvas=root.querySelector('#cw-canvas');if(!canvas)return;
      const ctx=canvas.getContext('2d');
      const S=wheelSize;canvas.width=S;canvas.height=S;
      const cx=S/2,cy=S/2,outerR=S/2-2,ringW=Math.round(S*0.14),innerR=outerR-ringW;

      // Hue ring (360 thin wedges)
      for(let a=0;a<360;a++){
        const s1=(a-90)*Math.PI/180,s2=(a-89)*Math.PI/180;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,outerR,s1,s2);ctx.closePath();
        ctx.fillStyle=`hsl(${a},100%,50%)`;ctx.fill();
      }
      // Knock out center
      ctx.globalCompositeOperation='destination-out';
      ctx.beginPath();ctx.arc(cx,cy,innerR,0,Math.PI*2);ctx.fill();
      ctx.globalCompositeOperation='source-over';

      // Inner SV square clipped to circle
      const ix=cx-innerR,iy=cy-innerR,iw=innerR*2;
      ctx.save();
      ctx.beginPath();ctx.arc(cx,cy,innerR-1,0,Math.PI*2);ctx.clip();
      const g1=ctx.createLinearGradient(ix,0,ix+iw,0);
      g1.addColorStop(0,'#ffffff');g1.addColorStop(1,`hsl(${hue},100%,50%)`);
      ctx.fillStyle=g1;ctx.fillRect(ix,iy,iw,iw);
      const g2=ctx.createLinearGradient(0,iy,0,iy+iw);
      g2.addColorStop(0,'rgba(0,0,0,0)');g2.addColorStop(1,'rgba(0,0,0,1)');
      ctx.fillStyle=g2;ctx.fillRect(ix,iy,iw,iw);
      ctx.restore();

      // Hue ring selector dot
      const ha=(hue-90)*Math.PI/180,hr=innerR+ringW/2;
      ctx.beginPath();ctx.arc(cx+hr*Math.cos(ha),cy+hr*Math.sin(ha),6,0,Math.PI*2);
      ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1;ctx.stroke();

      // Inner SV selector dot (sat→X, lit→Y mapped directly)
      const dotX=ix+(sat/100)*iw, dotY=iy+(1-lit/100)*iw;
      ctx.beginPath();ctx.arc(dotX,dotY,7,0,Math.PI*2);
      ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1;ctx.stroke();

      // Harmony dots on ring
      const angles=harmAngles(harmMode);
      angles.forEach(offset=>{
        const ha2=((hue+offset)%360-90)*Math.PI/180;
        ctx.beginPath();ctx.arc(cx+hr*Math.cos(ha2),cy+hr*Math.sin(ha2),5,0,Math.PI*2);
        ctx.fillStyle=`hsl(${(hue+offset)%360},100%,50%)`;ctx.fill();
        ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
      });
    }

    function updateInfo(){
      const hex=hslToHex(hue,sat,lit);
      const [r,g,b]=hslToRgb(hue,sat,lit);
      root.querySelector('#cw-preview').style.background=hex;
      root.querySelector('#cw-color-name').textContent=getColorName(hue,sat,lit);
      root.querySelector('#cw-color-hex').textContent=hex;
      root.querySelector('#cw-color-hsl').textContent=`H:${Math.round(hue)} S:${Math.round(sat)}% L:${Math.round(lit)}%`;
      root.querySelector('#cw-color-rgb').textContent=`rgb(${r},${g},${b})`;
      // Harmony swatches
      const angles=harmAngles(harmMode);
      const swEl=root.querySelector('#cw-harm-swatches');
      swEl.innerHTML=[hue,...angles.map(a=>(hue+a+360)%360)].map(h=>{
        const hx=hslToHex(h,sat,lit);
        return`<div class="cw-swatch" style="background:${hx}" title="${hx}" data-h="${Math.round(h)}"></div>`;
      }).join('');
      swEl.querySelectorAll('.cw-swatch').forEach(sw=>sw.addEventListener('click',()=>{
        hue=+sw.dataset.h;
        drawWheel();updateInfo();
      }));
      // Copy buttons
      root.querySelector('#cw-copy-hex').onclick=()=>navigator.clipboard.writeText(hex).catch(()=>{});
      root.querySelector('#cw-copy-hsl').onclick=()=>navigator.clipboard.writeText(`hsl(${Math.round(hue)},${Math.round(sat)}%,${Math.round(lit)}%)`).catch(()=>{});
      root.querySelector('#cw-copy-rgb').onclick=()=>navigator.clipboard.writeText(`rgb(${r},${g},${b})`).catch(()=>{});
    }

    function handleCanvasClick(e){
      const canvas=root.querySelector('#cw-canvas');
      const rect=canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const S=wheelSize,cx=S/2,cy=S/2,outerR=S/2-2,ringW=Math.round(S*0.14),innerR=outerR-ringW;
      const dx=mx-cx, dy=my-cy, dist=Math.sqrt(dx*dx+dy*dy);
      // Scale to canvas logical pixels
      const scaleX=S/rect.width, scaleY=S/rect.height;
      const lx=(mx)*scaleX, ly=(my)*scaleY;
      const ldx=lx-cx, ldy=ly-cy, ldist=Math.sqrt(ldx*ldx+ldy*ldy);
      if(ldist>=innerR && ldist<=outerR+2){
        hue=(Math.atan2(ldy,ldx)*180/Math.PI+90+360)%360;
      } else if(ldist<innerR){
        const ix=cx-innerR, iw=innerR*2;
        const iy2=cy-innerR;
        sat=Math.max(0,Math.min(100,(lx-ix)/iw*100));
        lit=Math.max(5,Math.min(95,(1-(ly-iy2)/iw)*100));
      }
      drawWheel();updateInfo();
    }

    root.querySelector('#cw-canvas').addEventListener('click',handleCanvasClick);
    root.querySelector('#cw-canvas').addEventListener('mousemove',e=>{if(e.buttons===1)handleCanvasClick(e);});

    root.querySelectorAll('#cw-size-seg .tsb').forEach(btn=>btn.addEventListener('click',()=>{
      wheelSize=+btn.dataset.s;
      root.querySelectorAll('#cw-size-seg .tsb').forEach(b=>b.classList.toggle('active',b===btn));
      drawWheel();
    }));
    root.querySelectorAll('#cw-harm-seg .tsb').forEach(btn=>btn.addEventListener('click',()=>{
      harmMode=btn.dataset.h;
      root.querySelectorAll('#cw-harm-seg .tsb').forEach(b=>b.classList.toggle('active',b===btn));
      drawWheel();updateInfo();
    }));

    drawWheel();updateInfo();
  }

  // ── Edit steps (idea + how-to in 3 apps) ──────────────────────────
  function swRowsHTML(s) {
    return `<div class="ph-estep-rows">
      <div class="ph-estep-row"><span class="ph-sw ph-sw-rr">RapidRAW</span><span>${s.rr}</span></div>
      <div class="ph-estep-row"><span class="ph-sw ph-sw-dt">darktable</span><span>${s.dt}</span></div>
      <div class="ph-estep-row"><span class="ph-sw ph-sw-sg">Snapseed</span><span>${s.sg}</span></div>
    </div>`;
  }
  function editStepHTML(s) {
    return `<div class="ph-estep"><div class="ph-estep-idea">${s.idea}</div>${swRowsHTML(s)}</div>`;
  }

  // ── General editing techniques ────────────────────────────────────
  const EDIT_TECHNIQUES = [
    { id:'teal-orange', name:'Teal & Orange', icon:'🎨',
      idea:'Empurra sombras/fundo para teal (azul-esverdeado) e tons de pele/realces para laranja. Cria separação e o look cinematográfico clássico.',
      rr:'Painel Color Grading (rodas de cor): roda das Sombras → teal/azul, roda dos Realces/Médios → laranja. Afina no HSL (Azul/Ciano = teal; Laranja = pele).',
      dt:'Módulo «color balance rgb»: nas 4-vias dá hue+chroma teal às Shadows e laranja aos Highlights; ajusta a pele em «color zones».',
      sg:'Curvas: canal Azul levanta as sombras (+teal) e baixa os realces; canal Vermelho faz o inverso. Reforça com Balanço de Brancos (Calor) no Seletivo sobre a pele.' },
    { id:'contraste', name:'Contraste (e reduzir)', icon:'◐',
      idea:'Mais contraste = punch e drama. Menos contraste = look suave, mate, editorial e cores pastel. Reduz para retrato suave ou estética film.',
      rr:'Slider Contrast; controlo fino na Tone Curve (S = mais; levantar os pretos = menos). «Tone Mapping/AgX» para rolloff suave dos realces.',
      dt:'«color balance rgb» (contrast + pivot) ou «rgb curve». Para look mate, levanta o ponto preto na curva.',
      sg:'Ajustar imagem → Contraste. Para look mate, em Curvas levanta o canto inferior-esquerdo (pretos) e baixa um pouco os brancos.' },
    { id:'clareza', name:'Clareza / Estrutura', icon:'▦',
      idea:'Clareza = contraste local nos médios (dá punch e volume). Estrutura/Textura = micro-detalhe (rochas, folhas, pele). Usa com moderação na pele.',
      rr:'Sliders Clarity e Structure. Em retrato aplica Structure só numa máscara que evite a pele.',
      dt:'Módulo «local contrast» (clarity) e «diffuse or sharpen» (preset texture); afina com «contrast equalizer».',
      sg:'Detalhes → Estrutura; «Ambiente» (Ajustar imagem) dá contraste local. Aplica localmente com o Pincel se for pele.' },
    { id:'sat-vib', name:'Saturação vs Vibração', icon:'🌈',
      idea:'Vibração sobe só as cores menos saturadas e protege os tons de pele — mais natural. Saturação sobe tudo por igual — cuidado com o excesso.',
      rr:'Sobe Vibrance primeiro; Saturation com parcimónia. Usa o HSL para cores específicas.',
      dt:'«color balance rgb» (global chroma / vibrance) ou módulo «velvia» (satura protegendo a pele); «color zones» por cor.',
      sg:'Ajustar imagem → Saturação (global); «Ambiente» dá um efeito tipo vibração. Para cores específicas usa o Seletivo.' },
    { id:'realces-sombras', name:'Realces & Sombras', icon:'☀️',
      idea:'Trazer detalhe das nuvens (realces) e abrir as sombras escuras sem achatar a imagem. Base de quase toda a edição RAW.',
      rr:'Highlights (−) e Shadows (+); depois Whites/Blacks para fixar os pontos. «Dehaze» se houver bruma.',
      dt:'«filmic rgb» (latitude) ou «tone equalizer» para abrir sombras/segurar realces; «exposure» para a base.',
      sg:'Ajustar imagem → Realces (−) e Sombras (+). Afina com Curvas.' },
    { id:'wb', name:'Balanço de Brancos', icon:'🌡️',
      idea:'Definir a temperatura neutra — ou usá-la de forma criativa (mais quente ao pôr do sol, mais fria para frio/noite).',
      rr:'Temperature/Tint; usa o conta-gotas num cinzento neutro. Dispara em RAW para liberdade total.',
      dt:'«white balance» (ou «color calibration» com iluminante); conta-gotas numa zona neutra.',
      sg:'Balanço de Brancos (Temperatura/Tonalidade); Auto e depois ajusta a gosto.' },
    { id:'curvas', name:'Curva de Tons', icon:'〰️',
      idea:'Controlo preciso de luminância e cor por zona — base do look mate, do contraste em S e do teal&orange por canal.',
      rr:'Tone Curve (Luma + RGB): pontos para S-curve; canais R/G/B para cor.',
      dt:'«rgb curve» (modo RGB ou por canal); «tone curve» em modo manual.',
      sg:'Curvas: curva Luminosidade para contraste; troca para os canais Vermelho/Verde/Azul para cor.' },
    { id:'dodge-burn', name:'Dodge & Burn', icon:'🔦',
      idea:'Clarear (dodge) o sujeito/olhos e escurecer (burn) distrações e bordas — guia o olhar e dá volume.',
      rr:'Máscaras (Brush/Radial ou AI «subject») com Exposure +/−. A AI «subject» isola a pessoa automaticamente.',
      dt:'«exposure» com máscara desenhada (brush), ou «tone equalizer» com máscara.',
      sg:'Pincel → Exposição/Brilho (clarear/escurecer com o dedo); Seletivo para zonas; Vinheta para as bordas.' },
    { id:'nitidez-ruido', name:'Nitidez & Ruído', icon:'🔪',
      idea:'Afiar o detalhe importante e limpar o ruído (sobretudo ISO alto/noite). Ruído primeiro, nitidez por último.',
      rr:'Noise Reduction (luminância + cor) primeiro; Sharpening depois, com máscara para não afiar céu/pele.',
      dt:'«denoise (profiled)» primeiro; «sharpen» ou «diffuse or sharpen» depois.',
      sg:'Detalhes → Nitidez (pouco). Sem denoise dedicado forte: evita exagerar Estrutura/Sombras (amplificam ruído).' },
    { id:'vinheta', name:'Vinheta', icon:'⭕',
      idea:'Escurecer suavemente as bordas para concentrar o olhar no sujeito. Subtil — não deve notar-se.',
      rr:'Effects → Vignette (amount/feather), ou máscara radial invertida com Exposure −.',
      dt:'Módulo «vignetting» (subtil), ou «exposure» com máscara radial invertida.',
      sg:'Ferramenta «Vinheta» (brilho exterior −, e tamanho).' },
    { id:'pb', name:'Conversão Preto & Branco', icon:'⬛',
      idea:'Converter pensando em tons: controlar como cada cor vira cinzento (céu mais escuro, pele mais clara) e dar contraste/estrutura.',
      rr:'Conversão B&W + HSL/luminância por cor (baixar Azul = céu dramático); sobe Clarity/Structure e contraste.',
      dt:'«color calibration» (cinza / channel mixer) ou «monochrome»; afina a luminância por cor; «contrast equalizer».',
      sg:'Filtro «Preto e branco» (filtro Vermelho/Amarelo escurece o céu); «Tom dramático» e Estrutura para punch.' },
    { id:'dehaze', name:'Dehaze / Atmosfera', icon:'🌫️',
      idea:'Cortar a bruma e recuperar contraste/cor em paisagens distantes — ou adicionar glow/atmosfera para um look sonhador.',
      rr:'Effects → Dehaze (+ limpa, − adiciona atmosfera); Glow/Halation para sonho.',
      dt:'Módulo «haze removal»; ou contraste local para reforçar.',
      sg:'Sem dehaze dedicado: Contraste + Estrutura + Sombras (−); «Tom dramático» ajuda.' },
  ];

  // ── Scenario cheat sheets ─────────────────────────────────────────
  const SCENARIOS = [
    { id:'paisagem', name:'Paisagem', icon:'🏔️',
      blurb:'Nitidez de ponta a ponta, céu dramático e profundidade.',
      settings:[
        {k:'Modo',v:'Av / Prioridade à abertura (ou M)'},
        {k:'ISO',v:'Mínimo (100) — tripé se preciso'},
        {k:'Abertura',v:'f/8 – f/11 (nitidez máxima)'},
        {k:'Velocidade',v:'Conforme a luz — tripé se < 1/60'},
        {k:'Foco',v:'A ~1/3 da cena, ou hiperfocal'},
        {k:'WB',v:'Luz do dia / Nublado'},
      ],
      composition:['Regra dos Terços','Linhas Convergentes','Curva em S','Espaço Negativo'],
      light:'Hora dourada e hora azul dão a melhor luz; a luz lateral revela textura e relevo. Evita o sol a pino (céu lavado, sombras duras). Usa a calculadora de Hora Dourada aqui em baixo para planear.',
      dos:['Tripé + temporizador/disparador para máxima nitidez','Foca a ~1/3 (ou usa a distância hiperfocal)','Polarizador para céu mais azul e tirar reflexos','Inclui um primeiro plano forte para dar profundidade','Mantém o horizonte direito'],
      donts:['ISO alto sem necessidade (ruído)','Horizonte ao centro (exceto reflexo simétrico)','Abrir demais (f/1.8 perde nitidez nas pontas)','Esquecer o primeiro plano (imagem "vazia")','Disparar tudo ao meio-dia'],
      edit:{ intro:'Maximiza a gama dinâmica e a profundidade: céu com detalhe, primeiro plano nítido, cor rica mas natural.',
        steps:[
          {idea:'Recuperar o céu e abrir as sombras (alta gama dinâmica)', rr:'Highlights −, Shadows +, Dehaze leve; Whites/Blacks a fixar os pontos.', dt:'«filmic rgb» + «tone equalizer» para equilibrar céu e terra.', sg:'Realces −, Sombras +, depois afina nas Curvas.'},
          {idea:'Profundidade e textura (rochas, folhagem)', rr:'Clarity + Structure moderados; Sharpening com máscara.', dt:'«local contrast» + «diffuse or sharpen».', sg:'Detalhes → Estrutura; «Ambiente».'},
          {idea:'Cor natural e rica (céu e vegetação)', rr:'Vibrance primeiro; HSL: Azul −luminância (céu mais fundo).', dt:'«velvia» + «color zones» para o verde.', sg:'Saturação leve + «Ambiente»; Seletivo no céu.'},
        ] } },
    { id:'retrato', name:'Retrato', icon:'👤', portrait:true,
      blurb:'Fundo desfocado, foco no olho, pose e luz que favorecem.',
      settings:[
        {k:'Modo',v:'Av ou M'},
        {k:'Abertura',v:'f/1.8 – f/2.8 (fundo cremoso); f/4–f/5.6 p/ grupos'},
        {k:'ISO',v:'Base; sobe só o necessário'},
        {k:'Velocidade',v:'≥ 1/200 (e ≥ distância focal)'},
        {k:'Foco',v:'AF no olho (Eye AF) — olho mais próximo'},
        {k:'Focal',v:'50–135mm (85mm ideal) evita distorção'},
      ],
      composition:['Regra dos Terços','Proporção Áurea (Phi)','Enquadramento Natural','Espaço Negativo'],
      light:'Janela suave a 45°, sombra aberta ou hora dourada. Observa os catchlights nos olhos e a sombra suave a descer pela face. Evita o sol a pino (olhos-de-guaxinim).',
      dos:['Foca sempre no olho mais próximo','Deixa espaço na direção do olhar','Dá direção e poses ao sujeito (vê os diagramas)','Dispara à altura dos olhos do sujeito','Separa o sujeito do fundo (distância + abertura)'],
      donts:['Cortar nas articulações (joelhos, cotovelos, pulsos, tornozelos, pescoço)','Grande angular perto do rosto (distorce o nariz)','Postes/árvores a "sair" da cabeça','Flash frontal direto e duro','Focar no nariz em vez do olho'],
      edit:{ intro:'Pele natural e agradável, olhos com vida e um fundo que não compete. Edição subtil — menos é mais.',
        steps:[
          {idea:'Pele natural — NÃO exagerar clareza/saturação na pele', rr:'Reduz Clarity/Texture na pele (máscara AI «subject»); Vibrance baixo.', dt:'«diffuse or sharpen» com máscara para suavizar; vibrance comedida.', sg:'Pincel: baixa Estrutura na pele; evita Saturação global alta.'},
          {idea:'Teal & Orange para separar do fundo', rr:'Rodas de cor: sombras → teal, realces → laranja; HSL afina o Laranja (pele).', dt:'«color balance rgb» (4-vias).', sg:'Curvas (Azul/Vermelho) + Balanço de Brancos no Seletivo sobre a pele.'},
          {idea:'Realçar os olhos (dodge) e escurecer distrações (burn)', rr:'Máscara Brush nos olhos: Exposure/Clarity +; Vinheta subtil.', dt:'«exposure» +/− com máscaras desenhadas.', sg:'Pincel → Exposição + nos olhos; Vinheta nas bordas.'},
        ] } },
    { id:'pb', name:'Preto & Branco', icon:'⬛',
      blurb:'Pensar em luz, tom, contraste, forma e textura — não em cor.',
      settings:[
        {k:'Ficheiro',v:'RAW (converte na edição)'},
        {k:'Pré-visualização',v:'Picture Style Monocromático (só para ver)'},
        {k:'Exposição',v:'Expor à direita (proteger realces)'},
        {k:'ISO',v:'Conforme — o grão pode ser estético'},
        {k:'Procura',v:'Contraste, linhas, formas e texturas'},
      ],
      composition:['Diagonal Principal','Linhas Convergentes','Simetria & Reflexo','Composição em Triângulo'],
      light:'Luz dura e lateral cria sombras profundas e drama. Nevoeiro e céus carregados funcionam muito bem. Pensa em como cada cor se traduz em cinzento.',
      dos:['Procurar contraste, textura e formas fortes','Usar linhas e luz direcional','Converter de RAW e ajustar os canais de cor','Aumentar contraste e clareza','Escolher cenas onde a cor não acrescenta nada'],
      donts:['Limitar-te ao JPEG P&B da câmara (perdes controlo)','Usar P&B para "salvar" uma foto fraca','Ignorar que cores diferentes podem virar o mesmo cinzento','Esquecer o ruído de cor antes de converter','Contraste a zero (imagem cinzenta e morta)'],
      edit:{ intro:'Controla como cada cor vira cinzento e dá-lhe contraste e estrutura. A conversão é uma decisão criativa, não um botão.',
        steps:[
          {idea:'Conversão controlada por cor', rr:'B&W + HSL/luminância: baixar Azul = céu dramático; subir Laranja = pele clara.', dt:'«color calibration» (channel mixer cinza) ou «monochrome».', sg:'Filtro «Preto e branco» → filtro Vermelho/Amarelo escurece o céu.'},
          {idea:'Contraste e estrutura para punch', rr:'Tone Curve em S; Clarity/Structure.', dt:'«contrast equalizer» / «tone curve».', sg:'«Tom dramático» + Estrutura + Contraste.'},
          {idea:'Granulado film (opcional)', rr:'Effects → Film Grain.', dt:'Módulo «grain».', sg:'Ferramenta «Granulado».'},
        ] } },
    { id:'rua', name:'Rua / Urbano', icon:'🚶',
      blurb:'Rápido e discreto: captar o momento e a luz da cidade.',
      settings:[
        {k:'Modo',v:'Av f/8 (zona de foco) ou Auto-ISO + M'},
        {k:'Velocidade',v:'≥ 1/250 (congelar pessoas)'},
        {k:'ISO',v:'Auto (até ~3200)'},
        {k:'Foco',v:'Zona/hiperfocal ou AF contínuo'},
        {k:'Focal',v:'28–50mm, lente discreta'},
      ],
      composition:['Linhas Convergentes','Enquadramento Natural','Regra dos Terços','Diagonal Principal'],
      light:'A luz dura cria sombras e contraste interessantes; à noite usa néons e reflexos. Contraluz para silhuetas. Encontra uma boa luz + fundo e espera o sujeito entrar.',
      dos:['Pré-focar (zone focusing) para disparar rápido','Lente discreta e leve','Antecipar e esperar pelo momento','Compor primeiro, esperar o sujeito depois','Respeitar as pessoas e o espaço'],
      donts:['Hesitar — perde-se o momento','Usar flash na cara das pessoas','Abertura muito aberta (difícil acertar foco em movimento)','Invadir a privacidade ou fotografar onde é proibido','Olhar só para o ecrã (perde o contexto à volta)'],
      edit:{ intro:'Carácter urbano: contraste, atmosfera e, muitas vezes, um look mate ou de film.',
        steps:[
          {idea:'Look mate / film (sombras levantadas)', rr:'Tone Curve: levanta o ponto preto; Color Grading subtil.', dt:'«rgb curve» (lift dos pretos) + «color balance rgb».', sg:'Curvas: levanta os pretos; reduz a Saturação levemente.'},
          {idea:'Contraste local e atmosfera', rr:'Clarity +, Dehaze a gosto.', dt:'«local contrast» / «haze removal».', sg:'«Ambiente» + Estrutura.'},
          {idea:'Cor coesa (teal&orange ou dessaturado)', rr:'Rodas de cor, ou baixa a Saturation para mood.', dt:'«color balance rgb».', sg:'Curvas por canal, ou Saturação −.'},
        ] } },
    { id:'noturna', name:'Noturna & Astro', icon:'🌌',
      blurb:'Tripé, ISO alto, foco manual no infinito e estrelas pontuais.',
      settings:[
        {k:'Modo',v:'M + Tripé (obrigatório)'},
        {k:'ISO',v:'1600–6400 (astro); baixo p/ cidade com tripé'},
        {k:'Abertura',v:'Máxima (f/1.4 – f/2.8) para estrelas'},
        {k:'Velocidade',v:'Regra dos 500 ÷ focal (ex.: 500/35 ≈ 14s)'},
        {k:'Foco',v:'Manual, no infinito (live view numa estrela)'},
        {k:'WB',v:'~3800K; RAW'},
      ],
      composition:['Espaço Negativo','Regra dos Terços','Linhas Convergentes','Simetria & Reflexo'],
      light:'Foge da poluição luminosa; lua nova para a Via Láctea. Hora azul para a cidade. Acrescenta um primeiro plano (silhueta, árvore) e ilumina-o com light painting.',
      dos:['Tripé + disparador/temporizador de 2s','Foco manual numa estrela brilhante (live view com zoom)','Desligar a estabilização no tripé','RAW + bateria extra (o frio gasta)','Primeiro plano interessante'],
      donts:['ISO no máximo sem necessidade (ruído)','Exposição longa demais (estrelas viram traços — usa 500/focal)','Confiar no AF no escuro','Tocar no tripé durante a exposição','Disparar em JPEG'],
      edit:{ intro:'Limpa o ruído, revela estrelas e luzes sem queimar, e controla a cor do céu.',
        steps:[
          {idea:'Reduzir ruído primeiro (ISO alto)', rr:'Noise Reduction (luminância + cor) antes de afiar.', dt:'«denoise (profiled)» — essencial.', sg:'Evita puxar Sombras/Estrutura ao máximo (amplifica o ruído).'},
          {idea:'Revelar a Via Láctea / as luzes', rr:'Shadows +, Whites +, Dehaze; Clarity localizada (máscara).', dt:'«tone equalizer» + «local contrast» com máscara.', sg:'Sombras +; Estrutura local com o Pincel; Curvas.'},
          {idea:'Cor do céu noturno', rr:'Temperature mais fria; HSL tira a dominante laranja da poluição luminosa.', dt:'«white balance» + «color zones» no laranja.', sg:'Balanço de Brancos mais frio; Seletivo.'},
        ] } },
    { id:'macro', name:'Macro / Close-up', icon:'🔬',
      blurb:'Profundidade de campo minúscula — foco preciso e fundo limpo.',
      settings:[
        {k:'Modo',v:'M ou Av'},
        {k:'Abertura',v:'f/8 – f/16 (DOF mínima)'},
        {k:'Foco',v:'Manual + focus stacking'},
        {k:'Velocidade',v:'Alta ou flash (o tremor é amplificado)'},
        {k:'Apoio',v:'Tripé / trilho de foco'},
      ],
      composition:['Espaço Negativo','Regra dos Terços','Simetria & Reflexo','Proporção Áurea (Phi)'],
      light:'Luz difusa (difusor no flash) evita reflexos e sombras duras. A luz lateral revela textura. De manhã cedo os insetos estão lentos e há menos vento.',
      dos:['Foco manual (o AF "caça" no macro)','Focus stacking para nitidez total','Difusor no flash','Tripé ou trilho de foco','Disparar de manhã cedo, sem vento'],
      donts:['Abrir muito (f/2.8 → quase nada em foco)','Confiar no autofoco','Disparar com vento','Flash direto sem difusão','Fundo atravancado'],
      edit:{ intro:'Nitidez no plano focado, fundo limpo e suave, cor e textura do sujeito.',
        steps:[
          {idea:'Nitidez seletiva no sujeito', rr:'Sharpening + Structure só no plano nítido (máscara).', dt:'«diffuse or sharpen» / «sharpen» com máscara.', sg:'Detalhes → Nitidez; Pincel para localizar.'},
          {idea:'Fundo limpo e suave', rr:'Máscara no fundo: Exposure/Saturation −; Vignette.', dt:'Máscara + «exposure» / «color balance rgb».', sg:'Seletivo no fundo (Saturação/Brilho −); Vinheta.'},
          {idea:'Cor e textura do sujeito', rr:'Vibrance; Clarity/Structure no sujeito.', dt:'«velvia» + «local contrast».', sg:'Saturação leve; Estrutura local.'},
        ] } },
    { id:'vida-selvagem', name:'Vida Selvagem', icon:'🦅',
      blurb:'Teleobjetiva, velocidade alta, foco no olho e paciência.',
      settings:[
        {k:'Modo',v:'Tv/S ou M + Auto-ISO'},
        {k:'Velocidade',v:'≥ 1/1000 (aves em voo ≥ 1/2000)'},
        {k:'Abertura',v:'Máxima (f/4 – f/6.3)'},
        {k:'Foco',v:'AF contínuo + tracking / olho-animal'},
        {k:'Disparo',v:'Rajada; teleobjetiva'},
      ],
      composition:['Espaço Negativo','Regra dos Terços','Diagonal Principal','Enquadramento Natural'],
      light:'Hora dourada com a luz por trás de ti (frontal no animal). Contraluz para silhuetas. Mantém-te ao nível dos olhos do animal.',
      dos:['Velocidade alta para congelar','AF contínuo + rajada no pico da ação','Apoiar (monopé) a teleobjetiva','Ficar ao nível dos olhos do animal','Paciência e distância de respeito'],
      donts:['Velocidade baixa (tudo tremido)','Aproximar-te ou molestar o animal','Foco único estático num sujeito a mover-se','Cortar o espaço de movimento à frente','Flash em animais selvagens'],
      edit:{ intro:'Destacar o animal, olho nítido, fundo desfocado e cor natural.',
        steps:[
          {idea:'Sujeito em destaque (dodge + nitidez)', rr:'Máscara AI «subject»: Exposure +, Sharpening, Clarity; fundo Exposure −.', dt:'Máscara («exposure» / «sharpen»).', sg:'Seletivo/Pincel no animal; Vinheta.'},
          {idea:'Olho nítido e com vida', rr:'Máscara Brush no olho: Clarity/Sharpening +.', dt:'Máscara desenhada + «sharpen».', sg:'Pincel: Estrutura/Exposição no olho.'},
          {idea:'Ruído + cor natural', rr:'Noise Reduction; Vibrance comedida.', dt:'«denoise (profiled)»; «velvia» leve.', sg:'Não exagerar; Saturação leve.'},
        ] } },
    { id:'desporto', name:'Desporto / Ação', icon:'⚽',
      blurb:'Congelar (1/1000+) ou panning (1/30–1/125) a seguir o sujeito.',
      settings:[
        {k:'Modo',v:'Tv/S ou M + Auto-ISO'},
        {k:'Congelar',v:'1/1000 – 1/2000'},
        {k:'Panning',v:'1/30 – 1/125, a acompanhar o sujeito'},
        {k:'Abertura',v:'f/2.8 – f/4'},
        {k:'Foco',v:'AF contínuo + zona; rajada'},
      ],
      composition:['Diagonal Principal','Espaço Negativo','Regra dos Terços','Linhas Convergentes'],
      light:'Exterior de dia é ideal. Interior → ISO alto + abertura máxima. Conhece a modalidade para antecipar o pico da ação.',
      dos:['AF contínuo + tracking','Rajada no pico da ação','Pré-focar no ponto onde a ação vai acontecer','Panning para dar sensação de velocidade','Deixar espaço na direção do movimento'],
      donts:['Velocidade baixa ao tentar congelar','Foco único (single AF)','Disparo único (perde o instante)','Abertura fechada com pouca luz (tremido)','Encher tanto o enquadramento que cortas o movimento'],
      edit:{ intro:'Energia e clareza: atleta nítido, cores vivas e recortes dinâmicos.',
        steps:[
          {idea:'Punch e clareza no atleta', rr:'Clarity/Structure; Contrast; Sharpening com máscara.', dt:'«local contrast» + «contrast equalizer».', sg:'Estrutura + Contraste; Nitidez.'},
          {idea:'Cores vivas (equipa, relva)', rr:'Vibrance + HSL por cor.', dt:'«velvia» / «color zones».', sg:'Saturação/«Ambiente»; Seletivo.'},
          {idea:'Ruído (interior) + recorte dinâmico', rr:'Noise Reduction; crop diagonal.', dt:'«denoise (profiled)»; «crop».', sg:'Recortar para reforçar o movimento.'},
        ] } },
    { id:'viagem', name:'Viagem', icon:'🧳',
      blurb:'Versátil e leve: sentido de lugar, do geral ao detalhe.',
      settings:[
        {k:'Modo',v:'Av f/8 versátil, ou Auto-ISO'},
        {k:'Lente',v:'Zoom versátil (18–135 / 24–70)'},
        {k:'Ficheiro',v:'RAW; cartões e baterias extra'},
        {k:'Horário',v:'Cedo (luz boa, sem multidões)'},
      ],
      composition:['Enquadramento Natural','Regra dos Terços','Linhas Convergentes','Curva em S'],
      light:'Hora dourada e azul. Cedo evita multidões e a luz dura do meio-dia. Planeia o horário dos locais.',
      dos:['Misturar planos: geral, médio e detalhe','Incluir pessoas para dar escala e história','Acordar cedo (luz + sem gente)','Proteger e limpar o equipamento','Fazer backups dos cartões'],
      donts:['Repetir só os postais clichés','Carregar equipamento a mais','Fotografar pessoas sem respeito/permissão','Esquecer baterias e cartões','Fotografar tudo ao meio-dia'],
      edit:{ intro:'Cor rica e fiel ao local, com um look coerente entre as fotos da viagem.',
        steps:[
          {idea:'Look coerente (preset / copiar definições)', rr:'Cria um Preset e aplica à pasta/lote.', dt:'Guarda um «style» e aplica em lote.', sg:'«Copiar/Colar look» entre fotos (QR).'},
          {idea:'Cor e luz do local', rr:'WB criativa (quente ao pôr do sol); Vibrance; Dehaze.', dt:'«white balance» + «color balance rgb» + «haze removal».', sg:'Balanço de Brancos; «Ambiente»; Saturação.'},
          {idea:'Endireitar e corrigir perspetiva (arquitetura)', rr:'Transform: rotation / perspective.', dt:'«rotate and perspective».', sg:'Ferramenta «Perspetiva» + «Rodar».'},
        ] } },
    { id:'eventos', name:'Eventos / Concertos', icon:'🎤',
      blurb:'Luz difícil e em mudança: abertura máxima, ISO alto, sem flash.',
      settings:[
        {k:'Modo',v:'M ou Av'},
        {k:'Abertura',v:'Máxima (f/1.8 – f/2.8)'},
        {k:'ISO',v:'Alto (3200–12800) — aceita ruído'},
        {k:'Velocidade',v:'≥ 1/200 (os artistas mexem-se)'},
        {k:'Foco',v:'AF contínuo; WB conforme palco (RAW)'},
      ],
      composition:['Regra dos Terços','Espaço Negativo','Diagonal Principal','Enquadramento Natural'],
      light:'Usa as luzes do palco e espera os picos de luz branca/quente. Evita expor pelas luzes coloridas saturadas. O fumo e o contraluz criam atmosfera.',
      dos:['Abertura máxima + ISO alto','Disparar nos picos de luz','AF contínuo','RAW (o WB de palco é difícil)','Antecipar os momentos e expressões'],
      donts:['Flash (geralmente proibido e de alcance curto)','Velocidade baixa (artista tremido)','Sobre-expor as luzes coloridas','Bloquear a vista dos outros','Tripé em pé no meio do público'],
      edit:{ intro:'Salvar luz de palco difícil, manter a atmosfera e controlar cor e ruído.',
        steps:[
          {idea:'Recuperar realces das luzes e abrir o artista', rr:'Highlights −, Shadows +; máscara «subject» Exposure +.', dt:'«tone equalizer» / «filmic rgb»; máscara.', sg:'Realces −, Sombras +; Seletivo no artista.'},
          {idea:'Controlar cores de palco saturadas', rr:'HSL: baixa saturação/luminância da cor dominante; WB.', dt:'«color zones» / «color calibration».', sg:'Curvas por canal; Saturação − no Seletivo.'},
          {idea:'Reduzir ruído (ISO muito alto)', rr:'Noise Reduction (luminância + cor).', dt:'«denoise (profiled)».', sg:'Evita puxar as sombras ao limite.'},
        ] } },
  ];

  // ── Portrait illustrations (crop guide + poses + editorial tips) ──
  function svgCropGuide() {
    const g = '#34d399', r = '#f87171';
    const line = (y, c, t, ok) =>
      `<line x1="14" y1="${y}" x2="200" y2="${y}" stroke="${c}" stroke-width="2" stroke-dasharray="5 4"/>`
      + `<text x="204" y="${y + 3.5}" fill="${c}" font-size="9" font-family="monospace">${ok ? '✓' : '✗'} ${t}</text>`;
    return `<svg viewBox="0 0 360 336" width="100%" style="max-width:340px" role="img" aria-label="Onde cortar um retrato">
      <g fill="#5b6478">
        <circle cx="120" cy="44" r="22"/>
        <rect x="112" y="64" width="16" height="12"/>
        <path d="M92 78 Q120 70 148 78 L142 168 Q120 176 98 168 Z"/>
      </g>
      <g stroke="#5b6478" stroke-linecap="round" fill="none">
        <line x1="98" y1="84" x2="84" y2="150" stroke-width="13"/>
        <line x1="142" y1="84" x2="156" y2="150" stroke-width="13"/>
        <line x1="110" y1="166" x2="104" y2="312" stroke-width="17"/>
        <line x1="130" y1="166" x2="136" y2="312" stroke-width="17"/>
      </g>
      ${line(16, g, 'espaço p/ cabeça', 1)}
      ${line(70, r, 'pescoço', 0)}
      ${line(104, g, 'meio do peito', 1)}
      ${line(138, r, 'cotovelos', 0)}
      ${line(160, g, 'cintura', 1)}
      ${line(188, r, 'pulsos / mãos', 0)}
      ${line(238, g, 'meio da coxa', 1)}
      ${line(266, r, 'joelhos', 0)}
      ${line(312, r, 'tornozelos', 0)}
    </svg>`;
  }

  function svgPoses() {
    const C = '#a78bff';
    const fig = d => `<svg viewBox="0 0 90 130" width="100%"><path d="${d}" fill="none" stroke="${C}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>__HEAD__</svg>`;
    const head = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${C}" stroke-width="4"/>`;
    const poses = [
      { d:'M46 32 L45 78 M45 48 L34 66 M45 48 L58 62 M45 78 L38 116 M45 78 L56 100 L52 116', h:[46,22], cap:'Ângulo 3/4 · peso na perna de trás, ombros em ângulo' },
      { d:'M46 34 L46 78 M46 50 L33 34 L40 20 M46 50 L58 64 L54 72 M46 78 L39 116 M46 78 L53 116', h:[46,24], cap:'Dá algo às mãos (cabelo, anca, bolso)' },
      { d:'M48 32 C42 48 54 58 49 78 M47 48 L36 64 M51 50 L61 64 M49 78 L40 116 M49 78 L57 110 L54 116', h:[48,22], cap:'Curva em S · anca e ombros em sentidos opostos' },
      { d:'M40 34 L54 78 M42 50 L34 66 M48 52 L70 60 M54 78 L47 116 M54 78 L60 104 L52 116 M74 12 L74 122', h:[40,24], cap:'Encostar / apoiar · postura relaxada' },
    ];
    return poses.map(p =>
      `<div class="ph-pose">${fig(p.d).replace('__HEAD__', head(p.h[0], p.h[1]))}<div class="ph-pose-cap">${p.cap}</div></div>`
    ).join('');
  }

  function portraitExtrasHTML() {
    return `
      <div class="ph-illus-block">
        <div class="ph-illus-title">✂️ Onde cortar (e onde não)</div>
        <div class="ph-illus">${svgCropGuide()}</div>
        <div class="ph-illus-cap">Corta <strong>entre</strong> as articulações (verde). <strong>Nunca</strong> numa articulação (vermelho) — dá sensação de membro amputado. E deixa sempre espaço acima da cabeça.</div>
      </div>
      <div class="ph-illus-block">
        <div class="ph-illus-title">🧍 Poses que funcionam</div>
        <div class="ph-pose-grid">${svgPoses()}</div>
      </div>
      <div class="ph-illus-block">
        <div class="ph-illus-title">😌 Olhar editorial / "cara de modelo"</div>
        <ul class="ph-tip-list">
          <li><strong>Sorri só com os olhos (smize):</strong> contrai ligeiramente as pálpebras inferiores em vez da boca.</li>
          <li><strong>Sobrancelhas:</strong> levanta-as muito ligeiramente e relaxa — "abre" e desperta o olhar.</li>
          <li><strong>Maxilar:</strong> ponta da língua atrás dos dentes de cima define a linha do queixo.</li>
          <li><strong>Queixo:</strong> para a frente e ligeiramente para baixo (evita papada e o olhar "de cima").</li>
          <li><strong>Respira:</strong> expira no momento do disparo — os ombros descem e a expressão relaxa.</li>
        </ul>
      </div>
      <div class="ph-illus-block">
        <div class="ph-illus-title">💡 Confirmar a melhor luz</div>
        <ul class="ph-tip-list">
          <li>Roda o sujeito devagar e observa os <strong>catchlights</strong> (reflexos) nos olhos — escolhe o ângulo com brilho vivo.</li>
          <li>Procura uma sombra suave a descer pela face (padrão <strong>loop</strong> ou <strong>Rembrandt</strong>) — dá volume.</li>
          <li>Sol a pino faz <strong>olhos-de-guaxinim</strong> → muda para sombra aberta, junto a uma janela a 45°, ou hora dourada.</li>
        </ul>
      </div>`;
  }

  // ── Scenario + technique UI ───────────────────────────────────────
  function scnCaptureHTML(scn) {
    const kv = scn.settings.map(s => `<div class="ph-kv"><span class="ph-kv-k">${s.k}</span><span class="ph-kv-v">${s.v}</span></div>`).join('');
    const comps = scn.composition.map(name => {
      const known = COMPOSITIONS.some(c => c.name === name);
      return `<button class="ph-chip${known ? ' ph-chip-link' : ''}"${known ? ` data-comp="${name}"` : ' disabled'}>${name}</button>`;
    }).join('');
    return `
      <div class="ph-scn-blurb">${scn.blurb}</div>
      <section class="ph-scn-sec"><h4>⚙️ Definições</h4><div class="ph-kv-grid">${kv}</div></section>
      <section class="ph-scn-sec"><h4>🎯 Composição</h4><div class="ph-chips">${comps}</div></section>
      <section class="ph-scn-sec"><h4>💡 Luz</h4><div class="ph-light-box">${scn.light}</div></section>
      <div class="ph-scn-cols">
        <section class="ph-scn-sec"><h4>✅ Fazer</h4><ul class="ph-do">${scn.dos.map(d => `<li>${d}</li>`).join('')}</ul></section>
        <section class="ph-scn-sec"><h4>⛔ Não fazer</h4><ul class="ph-dont">${scn.donts.map(d => `<li>${d}</li>`).join('')}</ul></section>
      </div>
      ${scn.portrait ? portraitExtrasHTML() : ''}`;
  }
  function scnEditHTML(scn) {
    return `<div class="ph-scn-blurb">${scn.edit.intro}</div>${scn.edit.steps.map(editStepHTML).join('')}
      <div class="ph-edit-note">Aplica-se a ficheiros RAW. Vê o menu <strong>🎨 Técnicas de Edição</strong> para o detalhe de cada técnica.</div>`;
  }

  function _bindModalClose(modal) {
    const close = () => { modal.hidden = true; document.removeEventListener('keydown', esc); };
    function esc(e) { if (e.key === 'Escape') close(); }
    modal.querySelector('.ph-modal-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', esc);
  }

  function openScenarioModal(scn) {
    let modal = document.getElementById('ph-scn-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'ph-scn-modal'; modal.className = 'ph-modal-overlay'; document.body.appendChild(modal); }
    modal.innerHTML = `<div class="ph-modal-box ph-scn-box" role="dialog" aria-modal="true" aria-label="${scn.name}">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">${scn.icon} ${scn.name}</span>
        <button class="ph-modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ph-scn-tabs">
        <button class="ph-tab active" data-tab="cap">📷 Captura</button>
        <button class="ph-tab" data-tab="edit">✏️ Edição</button>
      </div>
      <div class="ph-scn-modal-body">
        <div class="ph-tabpane" data-pane="cap">${scnCaptureHTML(scn)}</div>
        <div class="ph-tabpane" data-pane="edit" hidden>${scnEditHTML(scn)}</div>
      </div>
    </div>`;
    modal.hidden = false;
    _bindModalClose(modal);
    modal.querySelectorAll('.ph-tab').forEach(tab => tab.addEventListener('click', () => {
      modal.querySelectorAll('.ph-tab').forEach(x => x.classList.toggle('active', x === tab));
      modal.querySelectorAll('.ph-tabpane').forEach(p => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
      modal.querySelector('.ph-scn-modal-body').scrollTop = 0;
    }));
    modal.querySelectorAll('.ph-chip-link').forEach(ch => ch.addEventListener('click', () => {
      const comp = COMPOSITIONS.find(c => c.name === ch.dataset.comp);
      if (comp) openCompModal(comp);
    }));
  }

  function openTechModal(t) {
    let modal = document.getElementById('ph-tech-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'ph-tech-modal'; modal.className = 'ph-modal-overlay'; document.body.appendChild(modal); }
    modal.innerHTML = `<div class="ph-modal-box ph-scn-box" role="dialog" aria-modal="true" aria-label="${t.name}">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">${t.icon} ${t.name}</span>
        <button class="ph-modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ph-scn-modal-body">
        <div class="ph-light-box">${t.idea}</div>
        ${swRowsHTML(t)}
      </div>
    </div>`;
    modal.hidden = false;
    _bindModalClose(modal);
  }

  function buildScenarios(root) {
    root.innerHTML = `
      <div class="ph-section-title">🎯 Cheat Sheet por Cenário</div>
      <p class="ph-section-sub">Escolhe o tipo de fotografia para ver definições, composição, luz, o que fazer/evitar e como editar.</p>
      <div class="ph-scn-grid" id="ph-scn-grid"></div>`;
    const grid = root.querySelector('#ph-scn-grid');
    SCENARIOS.forEach(scn => {
      const card = document.createElement('button');
      card.className = 'ph-scn-card';
      card.innerHTML = `<span class="ph-scn-ico">${scn.icon}</span><span class="ph-scn-name">${scn.name}</span><span class="ph-scn-blurb-sm">${scn.blurb}</span>`;
      card.addEventListener('click', () => openScenarioModal(scn));
      grid.appendChild(card);
    });
  }

  function buildEditTechniques(root) {
    root.innerHTML = `
      <div class="ph-section-title">🎨 Técnicas de Edição</div>
      <p class="ph-section-sub">Conceitos de pós-processamento e como aplicá-los em RapidRAW, darktable e Snapseed.</p>
      <div class="ph-scn-grid" id="ph-edit-grid"></div>`;
    const grid = root.querySelector('#ph-edit-grid');
    EDIT_TECHNIQUES.forEach(t => {
      const card = document.createElement('button');
      card.className = 'ph-scn-card';
      card.innerHTML = `<span class="ph-scn-ico">${t.icon}</span><span class="ph-scn-name">${t.name}</span><span class="ph-scn-blurb-sm">${t.idea}</span>`;
      card.addEventListener('click', () => openTechModal(t));
      grid.appendChild(card);
    });
  }

  // ── Main ──────────────────────────────────────────────────────────
  function show() {
    const view = document.getElementById('view-photography');
    if (!view) return;

    if (!_built) {
      _built = true;

      const calcSections = [
        { id:'exposure',     fn:buildExposure,     title:'Exposição' },
        { id:'dof',          fn:buildDof,           title:'Profundidade de Campo' },
        { id:'focal',        fn:buildFocal,         title:'Focal & Crop' },
        { id:'nd',           fn:buildNd,            title:'Filtros ND' },
        { id:'flash',        fn:buildFlash,         title:'Flash' },
        { id:'longexp',      fn:buildLongExposure,  title:'Longa Exposição' },
        { id:'goldenhour',   fn:buildGoldenHour,    title:'Hora Dourada' },
      ];

      view.innerHTML=`
        <div class="view-inner">
          <div class="page-header">
            <h1 class="page-title">📸 Fotografia</h1>
            <p class="page-subtitle">Cheat sheet de captura e edição, composições, roda de cores e calculadoras · Canon M50 Mark II (APS-C 1.6×)</p>
          </div>
          <div id="ph-comp-section" style="margin-bottom:2rem"></div>
          <div id="ph-scn-section" style="margin-bottom:2rem"></div>
          <div id="ph-edit-section" style="margin-bottom:2rem"></div>
          <div id="ph-cw-section" style="margin-bottom:2rem"></div>
          <div class="ph-grid" id="ph-grid"></div>
        </div>`;

      const compSection = view.querySelector('#ph-comp-section');
      buildComposition(compSection);

      const scnBox = document.createElement('div');
      scnBox.className = 'ph-section-box';
      view.querySelector('#ph-scn-section').appendChild(scnBox);
      buildScenarios(scnBox);

      const editBox = document.createElement('div');
      editBox.className = 'ph-section-box';
      view.querySelector('#ph-edit-section').appendChild(editBox);
      buildEditTechniques(editBox);

      const cwSection = view.querySelector('#ph-cw-section');
      const cwWrapper = document.createElement('div');
      cwWrapper.className = 'ph-section-box';
      cwWrapper.innerHTML = '<div class="ph-section-title">🎨 Roda de Cores</div><div id="ph-cw-inner"></div>';
      cwSection.appendChild(cwWrapper);
      buildColorWheel(cwWrapper.querySelector('#ph-cw-inner'));

      const grid = view.querySelector('#ph-grid');
      calcSections.forEach(s=>{
        const wrapper = document.createElement('div');
        s.fn(wrapper);
        grid.appendChild(wrapper);
      });
    }
  }

  return { show };
})();
