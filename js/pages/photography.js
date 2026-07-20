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
      if(ev<0) desc='Expõe corretamente cenas muito escuras — astrofotografia, Via Láctea, light painting.';
      else if(ev<5) desc='Expõe corretamente noite urbana e interiores muito escuros.';
      else if(ev<8) desc='Expõe corretamente interiores com luz artificial.';
      else if(ev<11) desc='Expõe corretamente interiores bem iluminados, montras e palcos.';
      else if(ev<13) desc='Expõe corretamente exterior muito nublado ou sombra fechada.';
      else if(ev<15) desc='Expõe corretamente exterior nublado / sombra aberta.';
      else if(ev<16) desc='Expõe corretamente sol direto (regra Sunny 16: f/16, 1/ISO).';
      else desc='Expõe corretamente luz muito intensa — praia, neve, contraluz solar.';
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
        <div id="dof-result" class="ph-result"></div>
      </div>`;

    function calcDof(){
      const fl=parseFloat(root.querySelector('#dof-fl').value);
      const ap=parseFloat(root.querySelector('#dof-ap').value);
      const d=parseFloat(root.querySelector('#dof-dist').value)*1000;
      const coc=parseFloat(root.querySelector('#dof-coc').value);
      const res=root.querySelector('#dof-result');
      if(!(fl>0)||!(ap>0)||!(d>0)){res.innerHTML='<div class="ph-result-desc">Preenche focal, abertura e distância.</div>';return;}
      const H=(fl*fl)/(ap*coc)+fl;
      const near=d*H/(H+(d-fl));
      const far=d*H/(H-(d-fl));
      const dof=far>0&&H>d-fl?(far-near)/1000:Infinity;
      res.innerHTML=`
        <div class="ph-result-val">DOF: ${dof===Infinity?'∞':`${dof.toFixed(2)} m`}</div>
        <div class="ph-result-desc">
          Plano próximo: ${(near/1000).toFixed(2)} m | Plano distante: ${far>1e6||far<=0?'∞':(far/1000).toFixed(2)+' m'}<br>
          Distância hiperfocal: ${(H/1000).toFixed(2)} m
        </div>`;
    }
    root.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calcDof));
    calcDof();
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
            <input type="number" class="ph-input" id="gh-lat" value="38.72" step="0.01" min="-90" max="90">
          </div>
          <div class="ph-field">
            <label class="ph-label">Longitude</label>
            <input type="number" class="ph-input" id="gh-lon" value="-9.14" step="0.01" min="-180" max="180">
          </div>
        </div>
        <div class="ph-row">
          <div class="ph-field">
            <label class="ph-label">Data</label>
            <input type="date" class="ph-input" id="gh-date">
          </div>
          <div class="ph-field">
            <button class="t-btn t-btn-ghost" id="gh-locate" style="width:100%">📍 Usar a minha localização</button>
          </div>
        </div>
        <div id="gh-result" class="ph-result"></div>
      </div>`;

    root.querySelector('#gh-date').value=new Date().toISOString().split('T')[0];

    function calcGh(){
      const latDeg=+root.querySelector('#gh-lat').value, lonDeg=+root.querySelector('#gh-lon').value;
      const dateStr=root.querySelector('#gh-date').value;
      const res=root.querySelector('#gh-result');
      if(!dateStr||!isFinite(latDeg)||!isFinite(lonDeg)){res.innerHTML='<div class="ph-result-desc">Indica latitude, longitude e data.</div>';return;}
      const lat=latDeg*Math.PI/180;
      const d=new Date(dateStr+'T12:00:00');
      const J=Math.floor((d-new Date(d.getFullYear(),0,0))/86400000);
      const dec=-23.45*Math.PI/180*Math.cos(2*Math.PI/365*(J+10));
      // Equation of time (minutes) + longitude correction → solar noon in local clock time
      const B=2*Math.PI*(J-81)/364;
      const eot=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
      const tzH=-d.getTimezoneOffset()/60;
      const noon=12-lonDeg/15-eot/60+tzH;

      // Hours from solar noon until the sun is at the given altitude (deg)
      function ha(altDeg){
        const a=altDeg*Math.PI/180;
        const cos=(Math.sin(a)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec));
        if(cos<-1||cos>1) return null;
        return Math.acos(cos)*180/Math.PI/15;
      }
      function hhmm(h){if(h==null)return'—';const tot=((h%24)+24)%24;const hr=Math.floor(tot);const mn=Math.round((tot-hr)*60);return `${String(mn===60?hr+1:hr).padStart(2,'0')}:${String(mn===60?0:mn).padStart(2,'0')}`;}
      const range=(h1,h2)=>h1==null||h2==null?'—':`${hhmm(h1)}–${hhmm(h2)}`;

      const hSun=ha(-0.8333), hBlue=ha(-6), hGoldLo=ha(-4), hGoldHi=ha(6);
      const row=(ico,lbl,val,color)=>`<span>${ico} ${lbl}</span><span style="color:${color};font-family:var(--font-mono)">${val}</span>`;
      res.innerHTML=`<div class="ph-result-val">${latDeg.toFixed(2)}°, ${lonDeg.toFixed(2)}° · UTC${tzH>=0?'+':''}${tzH}</div>
        <div class="ph-result-desc ph-gh-grid">
          ${row('🌑','Hora azul manhã:',range(noon-hBlue,noon-hGoldLo),'var(--accent2)')}
          ${row('🌅','Hora dourada manhã:',range(noon-hGoldLo,noon-hGoldHi),'var(--amber)')}
          ${row('☀️','Nascer do sol:',hhmm(hSun==null?null:noon-hSun),'var(--accent)')}
          ${row('🌇','Pôr do sol:',hhmm(hSun==null?null:noon+hSun),'var(--accent)')}
          ${row('🌆','Hora dourada tarde:',range(noon+hGoldHi,noon+hGoldLo),'var(--amber)')}
          ${row('🌑','Hora azul tarde:',range(noon+hGoldLo,noon+hBlue),'var(--accent2)')}
        </div>`;
    }

    root.querySelector('#gh-locate').addEventListener('click',()=>{
      if(!navigator.geolocation) return;
      const btn=root.querySelector('#gh-locate');
      btn.disabled=true;btn.textContent='A localizar…';
      navigator.geolocation.getCurrentPosition(pos=>{
        root.querySelector('#gh-lat').value=pos.coords.latitude.toFixed(2);
        root.querySelector('#gh-lon').value=pos.coords.longitude.toFixed(2);
        btn.disabled=false;btn.textContent='📍 Usar a minha localização';
        calcGh();
      },()=>{btn.disabled=false;btn.textContent='📍 Usar a minha localização';});
    });
    root.querySelectorAll('input').forEach(el=>el.addEventListener('input',calcGh));
    calcGh();
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
      examples:'Estradas e sombras em diagonal, escadarias, braços e olhares em retrato, arquitetura moderna.',
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
      examples:'Carris e pontes, corredores e túneis, avenidas arborizadas, pontões a entrar no mar.',
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
      examples:'Reflexos em lagos e poças, fachadas e claustros, interiores de igrejas, retratos frontais centrados.',
      draw(ctx,W,H){
        ctx.strokeStyle='rgba(239,68,68,.5)';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);
        ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='rgba(239,68,68,.04)';
        ctx.fillRect(0,0,W/2,H/2);ctx.fillRect(W/2,H/2,W/2,H/2);
      }},
    { name:'Enquadramento Natural', desc:'Elementos da cena (arcos, janelas, ramos, portas) funcionam como moldura, dirigindo o olhar ao sujeito e dando contexto e profundidade.',
      tips:'Procura arcos, portas, túneis, copas de árvores. Foca no sujeito dentro da moldura — o enquadramento pode estar desfocado. Dá camadas à imagem.',
      examples:'Portas e arcos, janelas, ramos de árvores em primeiro plano, túneis e pontes a emoldurar o sujeito.',
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
      examples:'Silhueta contra o céu, barco num mar calmo, minimalismo com nevoeiro, retrato contra parede lisa.',
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
      examples:'Estradas de montanha, rios e ribeiras, linha de costa, dunas, caminhos pedonais em jardins.',
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
      examples:'Retratos de grupo (3 pessoas), montanhas, pose com braços na anca, still life com três objetos.',
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

  // Cada composição tem uma ilustração estilizada (ComfyUI) composta para
  // casar com o overlay geométrico. name → asset id (ver tools/photogen).
  const COMP_ASSET = {
    'Regra dos Terços': 'comp-thirds', 'Proporção Áurea (Phi)': 'comp-golden',
    'Espiral Dourada': 'comp-spiral', 'Diagonal Principal': 'comp-diagonal',
    'Linhas Convergentes': 'comp-converging', 'Simetria & Reflexo': 'comp-symmetry',
    'Enquadramento Natural': 'comp-framing', 'Espaço Negativo': 'comp-negative',
    'Curva em S': 'comp-scurve', 'Composição em Triângulo': 'comp-triangle',
  };
  const compAsset = comp => assetPath(COMP_ASSET[comp.name]);
  // Legendas correto/incorreto (quando existe a versão "errada" comp-<slug>-bad).
  const COMP_WHY = {
    'comp-thirds': { ok: 'Farol e horizonte alinhados com os pontos fortes.', bad: 'Sujeito ao centro e horizonte ao meio — estático.' },
    'comp-golden': { ok: 'Sujeito no ponto áureo — equilíbrio natural.', bad: 'Ao centro — previsível e sem tensão.' },
    'comp-spiral': { ok: 'A curva guia o olhar até ao centro.', bad: 'Reta e vazia — nada conduz o olhar.' },
    'comp-diagonal': { ok: 'A diagonal cria movimento e destaca o sujeito.', bad: 'Frontal e estático — sem energia.' },
    'comp-converging': { ok: 'As linhas do cais conduzem o olhar ao ponto focal.', bad: 'Sem direção visual, o olhar não é guiado.' },
    'comp-symmetry': { ok: 'Simetria equilibrada e harmoniosa.', bad: 'Horizonte torto e desequilíbrio.' },
    'comp-framing': { ok: 'A moldura natural dirige o olhar e dá profundidade.', bad: 'Sem moldura, a cena fica plana.' },
    'comp-negative': { ok: 'O vazio destaca o sujeito e dá escala.', bad: 'Cena confusa — o sujeito perde-se.' },
    'comp-scurve': { ok: 'A curva em S conduz o olhar com fluidez.', bad: 'Linha reta rígida — sem dinâmica.' },
    'comp-triangle': { ok: 'Arranjo triangular estável e equilibrado.', bad: 'Disposição aleatória e desequilibrada.' },
  };
  // Desenha só o overlay geométrico (fundo transparente para assentar na imagem);
  // opts.bg preenche um fundo neutro (vista "só grelha" sem imagem).
  function drawCompOverlay(canvas, comp, opts = {}) {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (opts.bg) { ctx.fillStyle = document.body.classList.contains('light') ? '#dbe3ef' : '#0b1020'; ctx.fillRect(0, 0, W, H); }
    ctx.save(); comp.draw(ctx, W, H); ctx.restore();
  }

  /* ══ VISUALIZADOR DE COMPOSIÇÃO ═════════════════════════════════════════
     Substitui os três modos (Grelha/Exemplo/Ambos), que obrigavam a trocar de
     vista para comparar. Agora há uma só cena com duas camadas de leitura:
       • cortina arrastável entre a versão CORRETA e a INCORRETA — a comparação
         acontece no mesmo sítio do ecrã, que é o que torna a diferença óbvia;
       • marcações geométricas por cima, que se ligam e desligam.
     Uma régua de miniaturas permite saltar entre técnicas sem fechar. */
  let _compIdx = 0, _compGenre = null;
  let _compOv = (() => { try { return localStorage.getItem('ph-comp-ov') !== '0'; } catch (_) { return true; } })();
  let _compWipe = 55;
  const setCompOv = v => { _compOv = v; try { localStorage.setItem('ph-comp-ov', v ? '1' : '0'); } catch (_) {} };
  const compSlug = name => (COMP_ASSET[name] || '').replace(/^comp-/, '');
  const genreCompAsset = (genre, comp) => genre ? assetPath('comp-' + genre + '-' + compSlug(comp.name)) : null;

  function openCompModal(comp, genreId) {
    _compGenre = genreId || null;
    _compIdx = Math.max(0, COMPOSITIONS.indexOf(comp));
    const modal = _openModal('ph-comp-modal', `<div class="ph-modal-box ph-cv-box" role="dialog" aria-modal="true" aria-label="Técnica de composição">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title" data-comp-title></span>
        <button class="ph-modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ph-cv-body"></div>
    </div>`);
    document.addEventListener('keydown', function nav(e) {
      if (!document.getElementById('ph-comp-modal')) { document.removeEventListener('keydown', nav); return; }
      if (e.key === 'ArrowLeft') { step(-1); }
      else if (e.key === 'ArrowRight') { step(1); }
      else if (e.key.toLowerCase() === 'g') { setCompOv(!_compOv); renderCompModal(modal); }
    });
    function step(d) { _compIdx = (_compIdx + d + COMPOSITIONS.length) % COMPOSITIONS.length; renderCompModal(modal); }
    modal._step = step;
    renderCompModal(modal);
  }

  function renderCompModal(modal) {
    const comp = COMPOSITIONS[_compIdx];
    const gAsset = genreCompAsset(_compGenre, comp), asset = gAsset || compAsset(comp);
    const slug = COMP_ASSET[comp.name];
    // A versão "incorreta" só existe para as ilustrações gerais.
    const bad = gAsset ? null : assetPath(slug + '-bad');
    const why = COMP_WHY[slug] || {};
    modal.querySelector('[data-comp-title]').textContent = `🖼️ ${comp.name}`;

    const stage = bad ? `
      <div class="ph-cv-frame" data-wipe>
        <img class="ph-cv-layer" src="${bad}" alt="Exemplo incorreto" draggable="false">
        <div class="ph-cv-layer ph-cv-ok" style="clip-path:inset(0 ${100 - _compWipe}% 0 0)">
          <img src="${asset}" alt="Exemplo correto" draggable="false">
        </div>
        <canvas class="ph-cv-ov${_compOv ? '' : ' off'}"></canvas>
        <span class="ph-cv-tag ok">✓ Correto</span>
        <span class="ph-cv-tag bad">✗ Incorreto</span>
        <div class="ph-cv-handle" style="left:${_compWipe}%"><span class="ph-cv-grip">⇔</span></div>
      </div>
      <input class="ph-cv-range" type="range" min="0" max="100" value="${_compWipe}" aria-label="Comparar correto e incorreto">
      <div class="ph-cv-why">
        <span class="ph-cv-why-ok"><b>✓</b> ${why.ok || ''}</span>
        <span class="ph-cv-why-bad"><b>✗</b> ${why.bad || ''}</span>
      </div>`
      : `<div class="ph-cv-frame">
        ${asset ? `<img class="ph-cv-layer" src="${asset}" alt="" draggable="false">` : '<div class="ph-cv-layer ph-cv-noimg"></div>'}
        <canvas class="ph-cv-ov${_compOv ? '' : ' off'}"></canvas>
      </div>`;

    modal.querySelector('.ph-cv-body').innerHTML = `
      <div class="ph-cv-controls">
        <button class="ph-cv-nav" data-step="-1" aria-label="Técnica anterior">‹</button>
        <label class="ph-cv-toggle"><input type="checkbox" ${_compOv ? 'checked' : ''} data-ov>
          <span>Marcações</span></label>
        <span class="ph-cv-count">${_compIdx + 1} / ${COMPOSITIONS.length}</span>
        <button class="ph-cv-nav" data-step="1" aria-label="Técnica seguinte">›</button>
      </div>
      ${stage}
      <div class="ph-cv-info">
        <div class="ph-cv-sec"><b>Como funciona</b><p>${comp.desc}</p></div>
        ${comp.tips ? `<div class="ph-cv-sec apply"><b>🎯 Como aplicar no terreno</b><p>${comp.tips}</p></div>` : ''}
        ${comp.examples ? `<div class="ph-cv-sec"><b>📷 Onde encontrar</b><p>${comp.examples}</p></div>` : ''}
      </div>
      <div class="ph-cv-rail" role="tablist" aria-label="Técnicas de composição">
        ${COMPOSITIONS.map((c, i) => {
          const a = genreCompAsset(_compGenre, c) || compAsset(c);
          return `<button class="ph-cv-thumb${i === _compIdx ? ' active' : ''}" data-jump="${i}" role="tab" aria-selected="${i === _compIdx}" title="${c.name}">
            ${a ? `<img src="${a}" alt="" loading="lazy" draggable="false">` : '<span class="ph-cv-thumb-no"></span>'}
            <span class="ph-cv-thumb-n">${c.name}</span></button>`;
        }).join('')}
      </div>`;

    const drawOv = () => {
      const cv = modal.querySelector('.ph-cv-ov'); if (!cv) return;
      const frame = cv.closest('.ph-cv-frame'), w = frame.clientWidth || 560;
      const h = frame.clientHeight || Math.round(w * 832 / 1216);
      cv.width = w; cv.height = h;
      drawCompOverlay(cv, comp, { bg: !asset });
    };
    requestAnimationFrame(drawOv);

    modal.querySelectorAll('[data-step]').forEach(b =>
      b.addEventListener('click', () => modal._step(+b.dataset.step)));
    modal.querySelectorAll('[data-jump]').forEach(b =>
      b.addEventListener('click', () => { _compIdx = +b.dataset.jump; renderCompModal(modal); }));
    modal.querySelector('[data-ov]')?.addEventListener('change', e => {
      setCompOv(e.target.checked);
      modal.querySelector('.ph-cv-ov')?.classList.toggle('off', !e.target.checked);
    });

    // Cortina: arrastar no próprio enquadramento, ou o range (teclado/leitores).
    const frame = modal.querySelector('[data-wipe]');
    if (frame) {
      const range = modal.querySelector('.ph-cv-range');
      const apply = pct => {
        _compWipe = Math.max(0, Math.min(100, pct));
        frame.querySelector('.ph-cv-ok').style.clipPath = `inset(0 ${100 - _compWipe}% 0 0)`;
        frame.querySelector('.ph-cv-handle').style.left = _compWipe + '%';
        if (range && +range.value !== Math.round(_compWipe)) range.value = Math.round(_compWipe);
      };
      const fromEvent = e => {
        const r = frame.getBoundingClientRect();
        apply(((e.clientX - r.left) / r.width) * 100);
      };
      let dragging = false;
      frame.addEventListener('pointerdown', e => {
        dragging = true; frame.setPointerCapture(e.pointerId); fromEvent(e); e.preventDefault();
      });
      frame.addEventListener('pointermove', e => { if (dragging) fromEvent(e); });
      frame.addEventListener('pointerup', e => { dragging = false; try { frame.releasePointerCapture(e.pointerId); } catch (_) {} });
      frame.addEventListener('pointercancel', () => { dragging = false; });
      range?.addEventListener('input', () => apply(+range.value));
    }
    window.addEventListener('resize', drawOv, { once: true });
  }

  function buildComposition(root) {
    root.innerHTML = `<div class="ph-section-title">🖼️ Guias de Composição</div>
      <p class="ph-section-sub">As regras clássicas para organizar o enquadramento — cada uma com um exemplo ilustrado e a grelha por cima. Toca para explorar.</p>
      <div class="ph-comp-grid2"><p class="ph-section-sub">A carregar…</p></div>`;
    loadAssets().then(() => {
      const grid = root.querySelector('.ph-comp-grid2'); if (!grid) return;
      grid.innerHTML = '';
      COMPOSITIONS.forEach(comp => {
        const asset = compAsset(comp);
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'ph-comp-card';
        card.innerHTML = `<span class="ph-comp-card-frame">
            ${asset ? `<img class="ph-comp-card-img" loading="lazy" decoding="async" src="${asset}" alt="">` : '<span class="ph-comp-card-noimg"></span>'}
            <canvas class="ph-comp-card-cv" width="320" height="219"></canvas>
          </span>
          <span class="ph-comp-card-name">${comp.name}</span>
          <span class="ph-comp-card-desc">${comp.desc}</span>`;
        grid.appendChild(card);
        requestAnimationFrame(() => { const cv = card.querySelector('canvas'); if (cv) drawCompOverlay(cv, comp, { bg: !asset }); });
        card.addEventListener('click', () => openCompModal(comp));
      });
    });
  }

  // ── Color Wheel ───────────────────────────────────────────────────
  function buildColorWheel(root) {
    root.innerHTML=`
      <div>
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

    // Pointer events (mouse + touch). The zone is locked at pointerdown so a
    // drag that starts no anel ou no quadrado não salta para o outro.
    let dragZone=null;
    function handlePointer(e){
      const canvas=root.querySelector('#cw-canvas');
      const rect=canvas.getBoundingClientRect();
      const S=wheelSize,cx=S/2,cy=S/2,outerR=S/2-2,ringW=Math.round(S*0.14),innerR=outerR-ringW;
      // Scale to canvas logical pixels
      const lx=(e.clientX-rect.left)*(S/rect.width), ly=(e.clientY-rect.top)*(S/rect.height);
      const ldx=lx-cx, ldy=ly-cy, ldist=Math.sqrt(ldx*ldx+ldy*ldy);
      if(!dragZone) dragZone = ldist>=innerR && ldist<=outerR+2 ? 'ring' : ldist<innerR ? 'sv' : null;
      if(dragZone==='ring'){
        hue=(Math.atan2(ldy,ldx)*180/Math.PI+90+360)%360;
      } else if(dragZone==='sv'){
        const ix=cx-innerR, iw=innerR*2;
        const iy2=cy-innerR;
        sat=Math.max(0,Math.min(100,(lx-ix)/iw*100));
        lit=Math.max(5,Math.min(95,(1-(ly-iy2)/iw)*100));
      } else return;
      drawWheel();updateInfo();
    }

    const cwCanvas=root.querySelector('#cw-canvas');
    cwCanvas.addEventListener('pointerdown',e=>{
      e.preventDefault();
      dragZone=null;
      try{cwCanvas.setPointerCapture(e.pointerId);}catch(_){}
      handlePointer(e);
    });
    cwCanvas.addEventListener('pointermove',e=>{if(e.buttons&1)handlePointer(e);});
    cwCanvas.addEventListener('pointerup',()=>{dragZone=null;});

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

  // ══ PORTAL DE GÉNEROS ═══════════════════════════════════════════
  // Conteúdo data-driven (data/photo/*.json). A classe de câmara e o perfil
  // adaptam objetiva, definições, formato e edição em todos os portais.
  let _DB = null, _dbPromise = null;
  function loadDB() {
    if (_DB) return Promise.resolve(_DB);
    if (_dbPromise) return _dbPromise;
    const grab = f => fetch('data/photo/' + f).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
    _dbPromise = Promise.all([grab('gear.json'), grab('genres.json'), grab('know.json'),
                              grab('profiles.json'), grab('craft.json'), grab('equipment.json')])
      .then(([g, gen, k, p, c, e]) => (_DB = {
        classes: g.classes, lensClasses: g.lensClasses, mine: g.mine, gearDefault: g.default,
        genres: gen.genres, know: k.topics,
        profiles: p.profiles, profileDefault: p.default, rawAdvice: p.rawAdvice,
        craft: c.modules, equipment: e.categories,
      }))
      .catch(() => { _dbPromise = null; return null; });
    return _dbPromise;
  }
  function dbErrorHTML() {
    return `<div class="ph-section-box"><p class="ph-section-sub">Não foi possível carregar o conteúdo de fotografia. <button class="ph-chip ph-chip-link" data-retry>Tentar novamente</button></p></div>`;
  }
  // Índice opcional de assets foto-reais (gerado localmente por tools/photogen).
  // Ausente por omissão → tudo usa as ilustrações/SVG procedurais como fallback.
  let _assets = null, _assetsP = null;
  function loadAssets() {
    if (_assets) return Promise.resolve(_assets);
    if (_assetsP) return _assetsP;
    _assetsP = fetch('assets/photo/index.json')
      .then(r => (r.ok ? r.json() : {})).then(j => (_assets = j || {})).catch(() => (_assets = {}));
    return _assetsP;
  }
  function assetPath(id) { return (_assets && _assets[id]) ? 'assets/photo/' + _assets[id] : null; }
  function wireRetry(panel, again) {
    panel.querySelector('[data-retry]')?.addEventListener('click', again);
  }
  const li = x => `<li>${x}</li>`;
  const kvHTML = s => `<div class="ph-kv"><span class="ph-kv-k">${s.k}</span><span class="ph-kv-v">${s.v}</span></div>`;

  /* ── Contexto do utilizador: CLASSE de câmara + PERFIL de fotografia ──────
     Duas preferências globais que adaptam todo o portal. A classe traduz as
     focais equivalentes para o que cada tipo de câmara tem; o perfil decide
     formato, profundidade de edição e o tom dos conselhos. Ambas em
     localStorage e ambas com fallback seguro se o DB ainda não carregou. */
  function gearClass() {
    try { const g = localStorage.getItem('ph-class'); if (_DB && _DB.classes.some(c => c.id === g)) return g; } catch (_) {}
    return (_DB && _DB.gearDefault) || 'apsc';
  }
  function setGearClass(c) { try { localStorage.setItem('ph-class', c); } catch (_) {} }
  function classDef(id) { return (_DB && _DB.classes.find(c => c.id === (id || gearClass()))) || null; }

  function profile() {
    try { const p = localStorage.getItem('ph-profile'); if (_DB && _DB.profiles.some(x => x.id === p)) return p; } catch (_) {}
    return (_DB && _DB.profileDefault) || 'entusiasta';
  }
  function setProfile(p) { try { localStorage.setItem('ph-profile', p); } catch (_) {} }
  function profileDef(id) { return (_DB && _DB.profiles.find(p => p.id === (id || profile()))) || null; }

  /* Barra de contexto: aparece no topo de todos os ecrãs que dependem destas
     escolhas, para o utilizador perceber sempre em nome de quem o portal fala. */
  function contextBarHTML() {
    const cls = gearClass(), pr = profile();
    return `<div class="ph-ctx">
      <div class="ph-ctx-grp" role="group" aria-label="Tipo de câmara">
        <span class="ph-ctx-lbl">Câmara</span>
        ${(_DB ? _DB.classes : []).map(c => `<button class="ph-ctx-btn${c.id === cls ? ' active' : ''}" data-class="${c.id}" title="${c.oneLine}">${c.icon} ${c.short}</button>`).join('')}
      </div>
      <div class="ph-ctx-grp" role="group" aria-label="Perfil de fotografia">
        <span class="ph-ctx-lbl">Perfil</span>
        ${(_DB ? _DB.profiles : []).map(p => `<button class="ph-ctx-btn${p.id === pr ? ' active' : ''}" data-profile="${p.id}" title="${p.tagline}">${p.icon} ${p.name}</button>`).join('')}
        <button class="ph-ctx-info" data-profile-info aria-label="O que muda entre perfis">?</button>
      </div>
    </div>`;
  }
  function wireContextBar(panel, rerender) {
    panel.querySelectorAll('[data-class]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.class === gearClass()) return;
      setGearClass(b.dataset.class); rerender();
    }));
    panel.querySelectorAll('[data-profile]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.profile === profile()) return;
      setProfile(b.dataset.profile); rerender();
    }));
    panel.querySelector('[data-profile-info]')?.addEventListener('click', openProfileModal);
  }

  /* Modal comparativo dos perfis — o utilizador tem de perceber o que muda
     antes de escolher, senão o seletor é ruído. */
  function openProfileModal() {
    const cur = profile();
    const modal = _openModal('ph-profile-modal', `<div class="ph-modal-box ph-prof-box" role="dialog" aria-modal="true" aria-label="Perfil de fotografia">
      <div class="ph-modal-hdr"><span class="ph-modal-title">🎯 Perfil de fotografia</span><button class="ph-modal-close" aria-label="Fechar">✕</button></div>
      <p class="ph-section-sub">O portal adapta formato, definições, checklists e edição ao teu objetivo. Não há um perfil certo — há o que corresponde ao que queres das tuas fotografias.</p>
      <div class="ph-prof-grid">
        ${(_DB ? _DB.profiles : []).map(p => `<button class="ph-prof-card${p.id === cur ? ' active' : ''}" data-pick="${p.id}">
          <span class="ph-prof-top"><span class="ph-prof-ico">${p.icon}</span><span class="ph-prof-name">${p.name}</span>${p.id === cur ? '<span class="ph-prof-cur">atual</span>' : ''}</span>
          <span class="ph-prof-tag">${p.tagline}</span>
          <span class="ph-prof-fmt">${p.formatLine}</span>
          <span class="ph-prof-who">${p.who}</span>
          <span class="ph-prof-phil">${p.philosophy}</span>
          <span class="ph-prof-cols">
            <span class="ph-prof-col"><b>✅ A favor</b><ul>${p.pros.map(li).join('')}</ul></span>
            <span class="ph-prof-col"><b>⚠️ Contra</b><ul>${p.cons.map(li).join('')}</ul></span>
          </span>
        </button>`).join('')}
      </div>
    </div>`);
    modal.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      setProfile(b.dataset.pick);
      modal.remove(); document.body.classList.remove('modal-open');
      if (_activate) _activate(_curTab, _curArg);
    }));
  }

  /* Conselho de formato composto: regra do perfil × exigência do género.
     É aqui que "não assumir RAW" deixa de ser um slogan e passa a ser lógica. */
  function formatAdvice(g) {
    const p = profileDef(), lvl = (g.raw && g.raw.value) || 'medium';
    const base = (_DB && _DB.rawAdvice && _DB.rawAdvice[lvl] && _DB.rawAdvice[lvl][p ? p.id : 'entusiasta']) || '';
    return { label: p ? p.formatLine : 'JPG', text: base, why: (g.raw && g.raw.why) || '', level: lvl };
  }
  const RAW_BADGE = { high: { t: 'RAW compensa muito', c: 'hi' }, medium: { t: 'RAW opcional', c: 'md' }, low: { t: 'JPG chega', c: 'lo' } };

  /* Traduz a classe de objetiva do género para o que ESTA câmara tem. */
  function lensLine(g, clsId) {
    const cls = clsId || gearClass();
    const lc = (_DB && _DB.lensClasses.find(l => l.id === g.gear.lensClass)) || null;
    const concrete = lc ? (lc[cls] || lc.eq) : '';
    return { name: lc ? lc.name : '', eq: g.gear.focal, concrete };
  }

  // ── ferramentas: metadados p/ chips contextuais e âncoras ──
  const TOOL_META = {
    exposure: { fn: buildExposure,     label: 'Exposição' },
    dof:      { fn: buildDof,          label: 'Prof. de campo' },
    focal:    { fn: buildFocal,        label: 'Focal & hiperfocal' },
    nd:       { fn: buildNd,           label: 'Filtro ND' },
    flash:    { fn: buildFlash,        label: 'Flash' },
    le:       { fn: buildLongExposure, label: 'Longa exposição' },
    gh:       { fn: buildGoldenHour,   label: 'Hora dourada' },
  };
  let _pendingCalc = null;

  // ── home: grelha de géneros ──
  function buildGeneros(panel) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => buildGeneros(panel)); return; }
      panel.innerHTML = `
        ${contextBarHTML()}
        <button class="ph-field-cta" id="ph-goto-field">
          <span class="ph-field-cta-ico">⚡</span>
          <span class="ph-field-cta-txt"><b>Estou a fotografar agora</b><small>Assistente de bolso: lente, definições e erros a evitar — em segundos</small></span>
          <span class="ph-field-cta-go">→</span>
        </button>
        <div class="ph-section-title" style="margin-top:1rem">🎯 Géneros fotográficos</div>
        <p class="ph-section-sub">Escolhe o que vais fotografar — cada portal junta equipamento, definições, luz, composição, checklist e edição.</p>
        <div class="ph-genre-search">
          <input type="search" id="ph-genre-q" class="ph-genre-q" placeholder="Procurar género (praia, nevoeiro, retrato…)" aria-label="Procurar género" autocomplete="off">
        </div>
        <div id="ph-genre-grid">${genreGroupsHTML(db.genres)}</div>
        <p class="ph-section-sub ph-genre-empty" id="ph-genre-none" hidden>Nenhum género corresponde à procura.</p>`;
      wireContextBar(panel, () => buildGeneros(panel));
      panel.querySelector('#ph-goto-field').addEventListener('click', () => Nav.go('photography/agora'));
      panel.querySelectorAll('[data-genre]').forEach(c =>
        c.addEventListener('click', () => Nav.go('photography/g/' + c.dataset.genre)));
      wireGenreSearch(panel);
    });
  }

  // Ícone do género: miniatura gerada (assets/photo/genre-ico) com o emoji do
  // JSON como fallback — o site continua a funcionar sem os assets.
  function genreIcoHTML(g, cls) {
    const src = assetPath('gico-' + g.id);
    return src
      ? `<span class="${cls} ${cls}-img"><img src="${src}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="${cls}">${g.icon}</span>`;
  }

  // Géneros agrupados por família (28 cartões numa grelha plana era ilegível).
  // A ordem dos grupos segue a 1ª ocorrência no JSON, por isso é controlada nos dados.
  function genreGroupsHTML(genres) {
    const groups = [];
    genres.forEach(g => {
      const key = g.group || 'Outros';
      let grp = groups.find(x => x.key === key);
      if (!grp) groups.push(grp = { key, items: [] });
      grp.items.push(g);
    });
    return groups.map(grp => `<section class="ph-genre-group" data-group="${grp.key}">
      <h3 class="ph-genre-group-title">${grp.key} <span class="ph-genre-group-n">${grp.items.length}</span></h3>
      <div class="ph-scn-grid">
        ${grp.items.map(g => `<button class="ph-scn-card" data-genre="${g.id}" data-search="${(g.name + ' ' + g.blurb + ' ' + grp.key).toLowerCase()}">
          ${genreIcoHTML(g, 'ph-scn-ico')}<span class="ph-scn-name">${g.name}</span>
          <span class="ph-scn-blurb-sm">${g.blurb}</span></button>`).join('')}
      </div>
    </section>`).join('');
  }
  // Filtro por texto: esconde cartões e, quando um grupo fica vazio, o grupo todo.
  function wireGenreSearch(panel) {
    const input = panel.querySelector('#ph-genre-q');
    const none = panel.querySelector('#ph-genre-none');
    if (!input) return;
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    input.addEventListener('input', () => {
      const q = norm(input.value);
      let shown = 0;
      panel.querySelectorAll('.ph-genre-group').forEach(grp => {
        let vis = 0;
        grp.querySelectorAll('[data-genre]').forEach(card => {
          const hit = !q || norm(card.dataset.search).includes(q);
          card.hidden = !hit;
          if (hit) vis++;
        });
        grp.hidden = vis === 0;
        shown += vis;
      });
      none.hidden = shown > 0;
    });
  }

  // ── portal de um género ──
  // Composições do género como cartões ilustrados (ilustração específica do
  // género quando existe, senão a geral) — clicar abre o modal nesse contexto.
  function compCardsHTML(names, genreId) {
    return `<div class="ph-comp-grid2 ph-comp-grid-sm">${names.map(name => {
      const comp = COMPOSITIONS.find(c => c.name === name); if (!comp) return '';
      const asset = (genreId && assetPath('comp-' + genreId + '-' + compSlug(name))) || assetPath(COMP_ASSET[name]);
      return `<button class="ph-comp-card" data-comp="${name}">
        <span class="ph-comp-card-frame">${asset ? `<img class="ph-comp-card-img" loading="lazy" decoding="async" src="${asset}" alt="">` : '<span class="ph-comp-card-noimg"></span>'}<canvas class="ph-comp-card-cv" width="320" height="219"></canvas></span>
        <span class="ph-comp-card-name">${name}</span></button>`;
    }).join('')}</div>`;
  }
  /* ══ PORTAL DE GÉNERO ═══════════════════════════════════════════════════
     Antes era uma página única e muito longa. Agora é um portal com secções
     navegáveis: no terreno consultas "Erros" ou "A cena" sem percorrer tudo.
     As secções são as MESMAS em todos os géneros — a previsibilidade é o que
     torna a consulta rápida. */
  const PORTAL_SECS = [
    { id: 'essencial',  icon: '🎯', label: 'Essencial' },
    { id: 'cena',       icon: '👁️', label: 'A cena' },
    { id: 'luz',        icon: '💡', label: 'Luz' },
    { id: 'composicao', icon: '🖼️', label: 'Composição' },
    { id: 'ideias',     icon: '💭', label: 'Ideias' },
    { id: 'erros',      icon: '⚠️', label: 'Erros' },
    { id: 'praticar',   icon: '🎓', label: 'Praticar' },
    { id: 'edicao',     icon: '✏️', label: 'Edição' },
  ];
  let _portalSec = 'essencial';

  /* Cartão de equipamento: focal equivalente primeiro (universal), depois a
     tradução para a câmara escolhida, e só no fim o exemplo pessoal. */
  function gearCardHTML(g) {
    const cls = classDef(), ll = lensLine(g);
    const note = (g.gear.byClass || {})[gearClass()];
    const noteTxt = typeof note === 'string' ? note : (note && note.note) || '';
    const phone = gearClass() === 'phone' ? (g.gear.byClass || {}).phone : null;
    const pmode = phone && typeof phone === 'object' ? phone.mode : null;
    return `<div class="ph-gear-card">
      <div class="ph-gear-hd">
        <span class="ph-gear-cls">${cls ? cls.icon + ' ' + cls.name : ''}</span>
        <span class="ph-gear-lensname">${ll.name}</span>
      </div>
      <div class="ph-gear-focal">${ll.eq}</div>
      <div class="ph-gear-concrete">${cls ? cls.icon : ''} No teu equipamento: <b>${ll.concrete}</b></div>
      <p class="ph-gear-why">${g.gear.why}</p>
      ${pmode ? `<div class="ph-kit-mode">✨ ${pmode}</div>` : ''}
      ${noteTxt ? `<div class="ph-gear-note">${noteTxt}</div>` : ''}
      <div class="ph-kv-grid">${(g.gear.settings || []).map(kvHTML).join('')}</div>
      ${g.gear.af ? `<div class="ph-kit-af"><b>Foco:</b> ${g.gear.af}</div>` : ''}
      ${g.gear.alt ? `<div class="ph-kit-alt"><b>Alternativa:</b> ${g.gear.alt}</div>` : ''}
      ${(g.gear.limits || []).length ? `<div class="ph-kit-lims"><b>⚠️ Limites reais</b><ul>${g.gear.limits.map(li).join('')}</ul></div>` : ''}
      ${g.gear.mine ? `<div class="ph-gear-mine"><b>🎒 No meu equipamento</b> ${g.gear.mine}</div>` : ''}
    </div>`;
  }

  /* Bloco de formato — a materialização visível do perfil escolhido. */
  function formatBlockHTML(g) {
    const a = formatAdvice(g), b = RAW_BADGE[a.level] || RAW_BADGE.medium, p = profileDef();
    return `<div class="ph-fmt ph-fmt-${b.c}">
      <div class="ph-fmt-hd">
        <span class="ph-fmt-lbl">${p ? p.icon : ''} ${a.label}</span>
        <span class="ph-fmt-badge ${b.c}">${b.t}</span>
      </div>
      <p class="ph-fmt-txt">${a.text}</p>
      ${a.why ? `<p class="ph-fmt-why"><b>Porquê neste género:</b> ${a.why}.</p>` : ''}
    </div>`;
  }

  /* Módulo de ofício + aplicação ao género. O princípio universal vive em
     craft.json e ensina-se uma vez; o género só acrescenta o caso concreto. */
  function craftBlockHTML(mod, applied) {
    if (!mod) return '';
    const vis = (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(mod.visual))
      ? `<div class="ph-craft-vis">${PhotoIllus.svg(mod.visual)}</div>` : '';
    return `<details class="ph-craft" data-craft="${mod.id}">
      <summary class="ph-craft-sum">
        <span class="ph-craft-ico">${mod.icon}</span>
        <span class="ph-craft-ttl">${mod.name}</span>
        <span class="ph-craft-applied">${applied || ''}</span>
      </summary>
      <div class="ph-craft-body">
        ${vis}
        <p class="ph-craft-prin">${mod.principle}</p>
        <div class="ph-craft-opts">${(mod.options || []).map(o => `<div class="ph-craft-opt">
          <b>${o.label}</b><span class="ph-craft-eff">${o.effect}</span><span class="ph-craft-when">${o.when}</span>
        </div>`).join('')}</div>
        ${(mod.mistakes || []).length ? `<div class="ph-craft-mist"><b>⚠️ Erros comuns</b><ul>${mod.mistakes.map(li).join('')}</ul></div>` : ''}
        ${mod.drill ? `<div class="ph-craft-drill"><b>🎓 Exercício</b> ${mod.drill}</div>` : ''}
      </div>
    </details>`;
  }
  const craftMod = id => (_DB && _DB.craft.find(m => m.id === id)) || null;

  function sceneSectionHTML(g) {
    const s = g.scene || {};
    return `
      <div class="ph-scn-grid2">
        <div class="ph-info-card"><b>🔎 O que procurar</b><ul>${(s.look || []).map(li).join('')}</ul></div>
        <div class="ph-info-card"><b>📍 Onde te colocares</b><p>${s.position || ''}</p></div>
      </div>
      <div class="ph-craft-list">
        ${craftBlockHTML(craftMod('height'), s.height)}
        ${craftBlockHTML(craftMod('angle'), (s.angles || []).join(' · '))}
        ${craftBlockHTML(craftMod('distance'), s.approach)}
        ${craftBlockHTML(craftMod('foreground'), (s.foreground || []).join(' · '))}
        ${craftBlockHTML(craftMod('background'), '')}
        ${craftBlockHTML(craftMod('simplify'), '')}
      </div>`;
  }

  function lightSectionHTML(g) {
    const lm = craftMod('lightdir');
    return `
      <div class="ph-light-box">${g.light}</div>
      <div class="ph-lc-grid">${(g.lightConditions || []).map(l => `<div class="ph-lc">
        <span class="ph-lc-when">${l.when}</span><span class="ph-lc-what">${l.what}</span>
      </div>`).join('')}</div>
      <div class="ph-craft-list">${craftBlockHTML(lm, '')}${craftBlockHTML(craftMod('moment'), '')}</div>`;
  }

  function ideasSectionHTML(g) {
    return `
      <div class="ph-info-card ph-ideas"><b>💭 Ideias para experimentar aqui</b><ul>${(g.ideas || []).map(li).join('')}</ul></div>
      <div class="ph-info-card ph-tricks"><b>🎩 Truques de quem já lá esteve</b><ul>${(g.tricks || []).map(li).join('')}</ul></div>`;
  }

  function errorsSectionHTML(g) {
    return `
      <div class="ph-mist-list">${(g.mistakes || []).map(m => `<div class="ph-mist">
        <div class="ph-mist-err"><span class="ph-mist-tag">Erro</span>${m.err}</div>
        <div class="ph-mist-fix"><span class="ph-mist-tag ok">Correção</span>${m.fix}</div>
      </div>`).join('')}</div>
      <div class="ph-scn-cols">
        <section class="ph-scn-sec"><h4>✅ Fazer</h4><ul class="ph-do">${(g.dos || []).map(li).join('')}</ul></section>
        <section class="ph-scn-sec"><h4>⛔ Evitar</h4><ul class="ph-dont">${(g.donts || []).map(li).join('')}</ul></section>
      </div>`;
  }

  function practiceSectionHTML(g) {
    return `
      <div class="ph-info-card"><b>🎓 Objetivos para praticar</b>
        <p class="ph-section-sub">Exercícios concretos para este género. Fazer um de cada vez ensina mais do que ler tudo.</p>
        <ul class="ph-drills">${(g.drills || []).map(li).join('')}</ul></div>
      <section class="ph-scn-sec"><h4>☑️ Checklist antes de sair</h4>
        <ul class="ph-check">${(g.checklist || []).map(c => `<li><label><input type="checkbox"><span>${c}</span></label></li>`).join('')}</ul>
      </section>
      ${(g.tools || []).length ? `<section class="ph-scn-sec"><h4>🧮 Ferramentas para este género</h4>
        <div class="ph-chips">${g.tools.map(tid => TOOL_META[tid] ? `<button class="ph-chip ph-chip-link" data-tool="${tid}">🧮 ${TOOL_META[tid].label}</button>` : '').join('')}</div>
      </section>` : ''}`;
  }

  /* A secção Edição do género diz APENAS a intenção artística — "preservar a
     atmosfera", "não matar o céu". O COMO fazer vive na secção Edição, e cada
     ferramenta mencionada abre lá diretamente. Sem isto, a explicação da mesma
     ferramenta apareceria repetida em 28 páginas. */
  function editSectionHTML(g) {
    const p = profileDef(), depth = p ? p.editDepth : 'selective';
    const goals = (g.edit && g.edit.goals) || [];
    const profNote = p ? `<div class="ph-fmt ph-fmt-${depth === 'minimal' ? 'lo' : 'md'}"><b>${p.icon} ${p.name}:</b> ${p.edit}</div>` : '';
    if (depth === 'minimal') {
      return `${profNote}<div class="ph-scn-blurb">${g.edit.intro}</div>
        <div class="ph-info-card"><b>🎯 O que interessa mesmo aqui</b>
          <ul>${goals.slice(0, 3).map(o => li(o.text)).join('')}</ul></div>
        <button class="ph-goto-edit" data-goedit>🎨 Ver como se faz, na secção Edição →</button>`;
    }
    return `<div class="ph-scn-blurb">${g.edit.intro}</div>${profNote}
      <div class="ph-goal-list">${goals.map(o => `<div class="ph-goal-item">
        <span class="ph-goal-name">✓ ${o.text}</span>
        ${(o.tools || []).length ? `<span class="ph-goal-tools">${o.tools.map(t =>
          `<button class="ph-chip ph-chip-link" data-etool="${t.id}">${t.label} →</button>`).join('')}</span>` : ''}
      </div>`).join('') || '<p class="ph-section-sub">—</p>'}</div>
      <button class="ph-goto-edit" data-goedit>🎨 Aprender edição de raiz, na secção Edição →</button>`;
  }

  function portalSectionHTML(g, sec) {
    if (sec === 'essencial') return `${formatBlockHTML(g)}${gearCardHTML(g)}`;
    if (sec === 'cena') return sceneSectionHTML(g);
    if (sec === 'luz') return lightSectionHTML(g);
    if (sec === 'composicao') return `<p class="ph-section-sub">As composições que melhor funcionam neste género. Toca para ver o exemplo e a grelha.</p>${compCardsHTML(g.composition, g.id)}`;
    if (sec === 'ideias') return ideasSectionHTML(g);
    if (sec === 'erros') return errorsSectionHTML(g);
    if (sec === 'praticar') return practiceSectionHTML(g);
    if (sec === 'edicao') return editSectionHTML(g);
    return '';
  }

  function renderPortal(panel, id) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets(), loadEditDB()]).then(([db]) => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => renderPortal(panel, id)); return; }
      const g = db.genres.find(x => x.id === id);
      if (!g) { Nav.go('photography'); return; }
      if (!PORTAL_SECS.some(s => s.id === _portalSec)) _portalSec = 'essencial';

      panel.innerHTML = `
        <div class="ph-portal-top"><button class="ph-back" id="ph-back">← Géneros</button></div>
        <div class="ph-portal-head">
          ${genreIcoHTML(g, 'ph-portal-ico')}
          <div><h2 class="ph-portal-name">${g.name}</h2><p class="ph-portal-goal">${g.goal}</p></div>
        </div>
        ${contextBarHTML()}
        <div class="ph-secnav" role="tablist" aria-label="Secções do género">
          ${PORTAL_SECS.map(s => `<button class="ph-secnav-btn${s.id === _portalSec ? ' active' : ''}" role="tab" aria-selected="${s.id === _portalSec}" data-sec="${s.id}">${s.icon} ${s.label}</button>`).join('')}
        </div>
        <div class="ph-secbody" id="ph-secbody">${portalSectionHTML(g, _portalSec)}</div>
        <button class="ph-field-cta small" data-agora="${g.id}">
          <span class="ph-field-cta-ico">⚡</span>
          <span class="ph-field-cta-txt"><b>Modo terreno: ${g.name}</b><small>Só o essencial, para consultar com a câmara na mão</small></span>
          <span class="ph-field-cta-go">→</span>
        </button>`;

      const body = panel.querySelector('#ph-secbody');
      const wireBody = () => {
        panel.querySelectorAll('[data-comp]').forEach(ch => {
          const comp = COMPOSITIONS.find(c => c.name === ch.dataset.comp);
          if (!comp) return;
          const cv = ch.querySelector('.ph-comp-card-cv'); if (cv) requestAnimationFrame(() => drawCompOverlay(cv, comp));
          ch.addEventListener('click', () => openCompModal(comp, g.id));
        });
        panel.querySelectorAll('[data-etool]').forEach(ch => ch.addEventListener('click', () => gotoTool(ch.dataset.etool)));
        panel.querySelector('[data-goedit]')?.addEventListener('click', () => Nav.go('photography/edicao'));
        panel.querySelectorAll('[data-tool]').forEach(ch => ch.addEventListener('click', () => {
          _pendingCalc = ch.dataset.tool; Nav.go('photography/ferramentas');
        }));
        if (g.portrait && _portalSec === 'cena') { wirePoses(panel); wireCropPhoto(panel); if (typeof Mannequin !== 'undefined') Mannequin.wireCropGuide(panel); }
      };
      wireBody();

      panel.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => {
        _portalSec = b.dataset.sec;
        panel.querySelectorAll('[data-sec]').forEach(x => {
          const on = x.dataset.sec === _portalSec;
          x.classList.toggle('active', on); x.setAttribute('aria-selected', on);
        });
        body.innerHTML = portalSectionHTML(g, _portalSec);
        wireBody();
        b.scrollIntoView({ inline: 'center', block: 'nearest' });
      }));
      panel.querySelector('#ph-back').addEventListener('click', () => Nav.go('photography'));
      wireContextBar(panel, () => renderPortal(panel, id));
      panel.querySelector('[data-agora]').addEventListener('click', () => Nav.go('photography/agora/' + g.id));
      window.scrollTo({ top: 0 });
    });
  }

  // ── modo No Terreno (assistente de bolso) ──
  /* Cartão de consulta rápida: o mínimo indispensável com a câmara na mão.
     Adapta-se à classe de câmara e ao perfil, tal como o portal completo. */
  function buildAgora(panel, genreId) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    loadDB().then(db => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => buildAgora(panel, genreId)); return; }
      let id = genreId;
      try { id = id || localStorage.getItem('ph-field-genre'); } catch (_) {}
      if (!db.genres.some(g => g.id === id)) id = db.genres[0].id;
      try { localStorage.setItem('ph-field-genre', id); } catch (_) {}
      const g = db.genres.find(x => x.id === id);
      const ll = lensLine(g), fa = formatAdvice(g), badge = RAW_BADGE[fa.level] || RAW_BADGE.medium;
      const firstLight = g.light.split(/(?<=\.)\s/)[0] || g.light;
      const s = g.scene || {};
      panel.innerHTML = `
        <div class="ph-field-pills" role="tablist" aria-label="Género">
          ${db.genres.map(x => `<button class="ph-field-pill${x.id === id ? ' active' : ''}" data-fg="${x.id}" role="tab" aria-selected="${x.id === id}">${x.icon} ${x.name}</button>`).join('')}
        </div>
        ${contextBarHTML()}
        <div class="ph-field-card">
          <div class="ph-field-top">
            <div class="ph-field-title">${g.icon} ${g.name}</div>
            <span class="ph-fmt-badge ${badge.c}" title="${fa.label}">${(profileDef() || {}).format || ''} · ${badge.t}</span>
          </div>
          <div class="ph-field-lens">${ll.concrete}</div>
          <div class="ph-field-mode">${ll.name} · ${ll.eq}</div>
          <div class="ph-kv-grid ph-field-kv">${(g.gear.settings || []).map(kvHTML).join('')}</div>
          ${s.height ? `<div class="ph-field-row">📏 <b>Altura:</b> ${s.height}</div>` : ''}
          ${s.position ? `<div class="ph-field-row">📍 <b>Posição:</b> ${s.position}</div>` : ''}
          <div class="ph-field-row">🔎 <b>Procura:</b> ${(s.look || []).slice(0, 2).join(' · ')}</div>
          <div class="ph-field-row">🖼️ <b>Compõe:</b> ${g.composition.slice(0, 2).join(' · ')}</div>
          <div class="ph-field-row">💡 ${firstLight}</div>
          <div class="ph-field-avoid"><b>⛔ Evita:</b><ul>${(g.mistakes || []).slice(0, 3).map(m => li(m.err)).join('')}</ul></div>
          ${(g.tricks || []).length ? `<div class="ph-field-row ph-field-trick">🎩 <b>Truque:</b> ${g.tricks[0]}</div>` : ''}
          <button class="ph-back ph-field-more" data-portal="${id}">Portal completo de ${g.name} →</button>
        </div>`;
      panel.querySelectorAll('[data-fg]').forEach(p => p.addEventListener('click', () => {
        try { history.replaceState(null, '', '#photography/agora/' + p.dataset.fg); } catch (_) {}
        buildAgora(panel, p.dataset.fg);
      }));
      wireContextBar(panel, () => buildAgora(panel, id));
      panel.querySelector('[data-portal]').addEventListener('click', () => Nav.go('photography/g/' + id));
      panel.querySelector('.ph-field-pill.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  // ── Aprender: fundamentos + composição + edição + cores ──
  // Miniatura visual do conceito: ilustração procedural (PhotoIllus) e, se
  // existir, uma imagem foto-real (gerada localmente via ComfyUI) com fallback.
  // Conceitos que ganham uma comparação foto-real (assets gerados via ComfyUI).
  // Se TODOS os assets existirem no índice, usam-se as fotos; senão, cai no SVG.
  const CONCEPT_GALLERY = {
    luz: [
      { id: 'light-frontal', cap: 'Frontal · suave e plana' },
      { id: 'light-side',    cap: 'Lateral · dá volume' },
      { id: 'light-back',    cap: 'Contraluz · recorta' },
    ],
  };
  function galleryItems(id) {
    const g = CONCEPT_GALLERY[id]; if (!g) return null;
    const items = g.map(x => ({ cap: x.cap, src: assetPath(x.id) }));
    return items.every(x => x.src) ? items : null;
  }
  function galleryHTML(items) {
    return `<div class="ph-photo-gal">${items.map(x =>
      `<figure class="ph-photo-cell"><img loading="lazy" decoding="async" src="${x.src}" alt="${x.cap}"><figcaption>${x.cap}</figcaption></figure>`).join('')}</div>`;
  }
  function svgThumb(id) {
    return (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(id))
      ? `<span class="ph-vis ph-learn-art">${PhotoIllus.svg(id)}</span>` : '';
  }
  const conceptImg = id => assetPath('know-' + id);
  function conceptThumb(id) {
    const img = conceptImg(id);
    if (img) return `<span class="ph-vis ph-photo-thumb"><img loading="lazy" decoding="async" alt="" src="${img}"></span>`;
    const g = galleryItems(id);
    if (g) return `<span class="ph-vis ph-photo-thumb"><img loading="lazy" decoding="async" alt="" src="${g[1].src}"></span>`;
    return svgThumb(id);
  }
  function conceptDetailHTML(t, sections) {
    const img = conceptImg(t.id), g = galleryItems(t.id);
    const art = img ? `<div class="ph-detail-art ph-photo-art"><img loading="lazy" decoding="async" alt="" src="${img}"></div>`
      : g ? `<div class="ph-detail-art ph-photo-art">${galleryHTML(g)}</div>`
      : (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(t.id)) ? `<div class="ph-detail-art">${PhotoIllus.svg(t.id)}</div>` : '';
    return `<button class="ph-detail-close" aria-label="Fechar">✕</button>
      <div class="ph-detail-head"><span class="ph-detail-ico">${t.icon || ''}</span><h3 class="ph-detail-title">${t.name}</h3></div>
      ${art}<div class="ph-detail-body">${sections}</div>`;
  }
  // Grelha expansível reutilizável (mata os modais de Aprender): ao clicar num
  // cartão abre um painel inline em largura total logo a seguir a esse cartão.
  function expandableGrid(box, items, opt) {
    box.innerHTML = `${opt.head || ''}<div class="ph-learn-grid"></div>`;
    const grid = box.querySelector('.ph-learn-grid');
    const detail = document.createElement('div');
    detail.className = 'ph-learn-detail'; detail.hidden = true;
    let sel = null;
    const close = () => {
      sel = null; detail.hidden = true; detail.innerHTML = '';
      grid.querySelectorAll('.ph-learn-card').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-expanded', 'false'); });
    };
    items.forEach(t => {
      const card = document.createElement('button');
      card.type = 'button';
      const th = opt.thumb(t);
      card.className = 'ph-learn-card' + (th ? '' : ' no-art');
      card.setAttribute('aria-expanded', 'false');
      card.innerHTML = `<span class="ph-learn-thumb">${th || `<span class="ph-learn-ico">${t.icon || '📷'}</span>`}</span>
        <span class="ph-learn-info"><span class="ph-learn-name">${t.icon ? t.icon + ' ' : ''}${t.name}</span>
        <span class="ph-scn-blurb-sm">${opt.blurb(t)}</span></span><span class="ph-learn-caret" aria-hidden="true"></span>`;
      card.addEventListener('click', () => {
        if (sel === t) { close(); return; }
        sel = t;
        grid.querySelectorAll('.ph-learn-card').forEach(c => { const on = c === card; c.classList.toggle('active', on); c.setAttribute('aria-expanded', on); });
        detail.innerHTML = opt.detail(t);
        card.after(detail); detail.hidden = false;
        if (typeof PhotoIllus !== 'undefined') PhotoIllus.wire(detail);
        opt.afterOpen && opt.afterOpen(detail, t);
        detail.querySelector('.ph-detail-close')?.addEventListener('click', () => { close(); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
        requestAnimationFrame(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      });
      grid.appendChild(card);
      opt.afterCard && opt.afterCard(card, t);
    });
    return { grid, close };
  }
  /* ══ SECÇÃO EDIÇÃO ══════════════════════════════════════════════════════
     Área própria, separada dos géneros. Os géneros dizem O QUE se pretende
     ("preservar a atmosfera do nevoeiro"); esta secção ensina COMO se lá
     chega, com conceitos que valem em qualquer programa.

     Regra de apresentação de cada ferramenta: conceito primeiro (o que faz,
     que problema resolve, quando usar, quando evitar, erros), demonstração
     interativa a seguir, e só no fim "Nos principais programas". */
  let _EDITDB = null, _editDbP = null;
  function loadEditDB() {
    if (_EDITDB) return Promise.resolve(_EDITDB);
    if (_editDbP) return _editDbP;
    _editDbP = fetch('data/photo/edit.json').then(r => { if (!r.ok) throw 0; return r.json(); })
      .then(j => (_EDITDB = j)).catch(() => { _editDbP = null; return null; });
    return _editDbP;
  }
  // Índice ferramenta → secção, para os atalhos vindos dos géneros.
  function editToolIndex() {
    const m = {};
    (_EDITDB ? _EDITDB.sections : []).forEach(s => (s.tools || []).forEach(t => { m[t.id] = { sec: s.id, tool: t }; }));
    return m;
  }
  // Imagem de exemplo das demonstrações: uma foto com céu, primeiro plano e
  // cor suficiente para todos os ajustes se notarem.
  function demoImage() {
    return assetPath('edit-demo') || assetPath('comp-thirds') || assetPath('comp-golden') || '';
  }
  let _editSec = null, _editTool = null;

  function appsTableHTML(t) {
    const sw = (_EDITDB && _EDITDB.software) || [];
    return `<details class="ph-apps">
      <summary><span>🛠️ Nos principais programas</span><small>o conceito é o mesmo; muda o nome e o sítio</small></summary>
      <div class="ph-apps-grid">${sw.map(s => `<div class="ph-app">
        <span class="ph-app-n">${s.name}</span>
        <span class="ph-app-v">${(t.apps && t.apps[s.id]) || '—'}</span>
      </div>`).join('')}</div>
    </details>`;
  }

  /* Ficha de ferramenta. Deliberadamente NÃO é o mesmo molde para todas: o
     `layout` decide QUAL elemento visual explica melhor a ferramenta e dá-lhe
     o destaque. A fotografia é apoio ao conceito, nunca o elemento principal —
     por isso está sempre limitada em altura, e o que cresce é o gráfico, a
     lupa ou a curva, conforme o que ensina mais.

       tonal  → efeito percebe-se num instante: foto pequena + histograma ao
                vivo à esquerda, orientação (usar/evitar/erros) logo à direita.
                Tudo cabe num ecrã, sem scroll.
       detail → o efeito é invisível ajustado ao ecrã: a lupa 1:1 manda, a foto
                fica reduzida a navegador.
       graph  → a curva / as bandas HSL explicam melhor que ampliar a foto.
       mask   → a máscara é espacial: a foto precisa de área, os controlos vão
                para o lado.
       pair   → comparação de dois parâmetros nos mesmos píxeis. */
  function toolDetailHTML(t) {
    const list = (title, cls, arr) => (arr && arr.length)
      ? `<div class="ph-eq-sec ${cls}"><b>${title}</b><ul>${arr.map(li).join('')}</ul></div>` : '';
    const layout = t.layout || 'split';
    const demoAttr = JSON.stringify(Object.assign({}, t.demo, t.presets ? { presets: t.presets } : null)).replace(/'/g, "&#39;");
    const demo = `<div class="ph-tool-demo" data-demo='${demoAttr}'></div>`;

    // "Em 20 segundos": a ideia inteira numa frase, com um antes/depois
    // gerado a partir do próprio motor — sem imagens extra.
    const quick = t.quick ? `<div class="ph-quick">
      <span class="ph-quick-badge">em 20 segundos</span>
      <p class="ph-quick-txt">${t.quick}</p>
      ${t.quickVis ? `<div class="ph-quick-vis" data-quickvis='${JSON.stringify(t.quickVis)}'></div>` : ''}
    </div>` : '';

    const concept = `<div class="ph-tool-concept">
      <div class="ph-eq-what"><b>O que faz</b><p>${t.what}</p></div>
      <div class="ph-eq-why"><b>Porque existe</b><p>${t.why}</p></div>
      <div class="ph-tool-pe">
        <div class="ph-tool-p"><b>Problema que resolve</b><p>${t.problem}</p></div>
        <div class="ph-tool-p"><b>Efeito na fotografia</b><p>${t.effect}</p></div>
      </div>
    </div>`;

    // Relações: aprender por associação. Cada ligação diz PORQUÊ, senão é
    // só uma lista de nomes.
    const rel = (t.relations || []).length ? `<div class="ph-rel">
      <b class="ph-rel-hd">🔗 Como se liga a outras ferramentas</b>
      <div class="ph-rel-list">${t.relations.map(r => `<button class="ph-rel-item" data-etool="${r.id}">
        <span class="ph-rel-n">${r.id}</span><span class="ph-rel-w">${r.why}</span><span class="ph-rel-go">→</span>
      </button>`).join('')}</div></div>` : '';

    const gen = (t.genres || []).length ? `<div class="ph-tgen">
      <b class="ph-tgen-hd">📷 Onde isto aparece</b>
      <div class="ph-tgen-list">${t.genres.map(g => `<button class="ph-tgen-item" data-genre-link="${g.id}">
        <span class="ph-tgen-n" data-genre-name="${g.id}">${g.id}</span><span class="ph-tgen-w">${g.why}</span>
      </button>`).join('')}</div></div>` : '';

    // Usar / evitar / erros num só bloco: são a orientação prática e devem
    // ler-se ao mesmo tempo que a demonstração, não três ecrãs abaixo.
    const cols = `<div class="ph-guide">
      ${list('✅ Quando usar', 'ok', t.when)}
      ${list('⛔ Quando evitar', 'no', t.avoid)}
      ${list('⚠️ Erros comuns', 'mist', t.mistakes)}
    </div>
    ${t.note ? `<div class="ph-craft-drill"><b>Regra prática</b> ${t.note}</div>` : ''}`;

    const head = `<header class="ph-tool-hd">
      <span class="ph-tool-ico">${t.icon || '🎛️'}</span>
      <div>
        <h3 class="ph-tool-name">${t.name} <span class="ph-tool-en">${t.en}</span></h3>
        <span class="ph-tool-tag">${t.tag || ''}</span>
      </div>
    </header>`;

    // A explicação longa fica sempre recolhida: quem consulta quer ver o efeito
    // e a orientação; quem quer o porquê abre. É o que separa isto de um manual.
    const more = `<details class="ph-tool-more"><summary>Explicação completa</summary>${concept}</details>`;

    const body = layout === 'tonal'
      ? `<div class="ph-tgrid"><div class="ph-tgrid-demo">${demo}</div>
         <div class="ph-tgrid-guide">${cols}</div></div>${more}`
      : `${demo}${cols}${more}`;

    return `<article class="ph-tool ph-tool-${layout}" data-tool-id="${t.id}">
      ${head}${quick}${body}${rel}${gen}${appsTableHTML(t)}
    </article>`;
  }

  function workflowHTML(s) {
    return `<div class="ph-wf">
      ${s.steps.map(st => `<div class="ph-wf-step">
        <span class="ph-wf-n">${st.n}</span>
        <div class="ph-wf-body"><b>${st.name}</b><p class="ph-wf-what">${st.what}</p>
          <p class="ph-wf-why"><span>Porquê aqui:</span> ${st.why}</p></div>
      </div>`).join('')}
    </div>
    <div class="ph-eq-cols">
      <div class="ph-eq-sec mist"><b>⚠️ Erros de ordem</b><ul>${s.mistakes.map(li).join('')}</ul></div>
      <div class="ph-eq-sec ok"><b>✂️ Quando saltar passos</b><ul>${s.skip.map(li).join('')}</ul></div>
    </div>`;
  }

  function exportHTML(s) {
    return `<div class="ph-exp-grid">${s.targets.map(t => `<div class="ph-exp">
      <div class="ph-exp-hd">${t.icon} ${t.name}</div>
      <dl class="ph-exp-dl">
        <dt>Dimensão</dt><dd>${t.size}</dd>
        <dt>Espaço de cor</dt><dd>${t.space}</dd>
        <dt>Qualidade</dt><dd>${t.quality}</dd>
        <dt>Nitidez</dt><dd>${t.sharpen}</dd>
      </dl>
      <ul class="ph-exp-notes">${t.notes.map(li).join('')}</ul>
    </div>`).join('')}</div>
    <div class="ph-eq-sec mist"><b>⚠️ Erros comuns</b><ul>${s.mistakes.map(li).join('')}</ul></div>`;
  }

  function buildEdicao(panel, arg) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadEditDB(), loadAssets()]).then(([db]) => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => buildEdicao(panel, arg)); return; }
      // arg pode ser id de secção OU id de ferramenta (atalho vindo de um género)
      const idx = editToolIndex();
      let secId = _editSec || db.sections[0].id, focusTool = null;
      if (arg) {
        if (db.sections.some(s => s.id === arg)) secId = arg;
        else if (idx[arg]) { secId = idx[arg].sec; focusTool = arg; }
      }
      if (_editTool) { focusTool = _editTool; _editTool = null; }
      _editSec = secId;
      const sec = db.sections.find(s => s.id === secId) || db.sections[0];

      const body = sec.kind === 'workflow' ? workflowHTML(sec)
        : sec.kind === 'export' ? exportHTML(sec)
        : (sec.tools || []).map(toolDetailHTML).join('');

      panel.innerHTML = `
        <div class="ph-section-title">🎨 Edição</div>
        <p class="ph-section-sub">Conceitos de edição que valem em qualquer programa. Primeiro o que a ferramenta faz e porquê; a equivalência em Lightroom, Camera Raw, darktable, RawTherapee, Snapseed e RapidRAW fica no fim de cada ficha.</p>
        <div class="ph-secnav" role="tablist" aria-label="Secções de edição">
          ${db.sections.map(s => `<button class="ph-secnav-btn${s.id === sec.id ? ' active' : ''}" role="tab" aria-selected="${s.id === sec.id}" data-esec="${s.id}">${s.icon} ${s.name}</button>`).join('')}
        </div>
        <p class="ph-eq-intro">${sec.intro}</p>
        <div class="ph-secbody">${body}</div>`;

      panel.querySelectorAll('[data-esec]').forEach(b => b.addEventListener('click', () => {
        _editSec = b.dataset.esec;
        try { history.replaceState(null, '', '#photography/edicao/' + _editSec); } catch (_) {}
        buildEdicao(panel, _editSec);
      }));

      // Demonstrações: montadas só quando entram no ecrã (cada uma processa
      // uma imagem inteira em JS, não vale a pena fazê-lo às cegas).
      const img = demoImage();
      if (typeof EditLab !== 'undefined') EditLab._img = img;
      const hosts = [...panel.querySelectorAll('[data-demo]')];
      if (img && typeof EditLab !== 'undefined' && hosts.length) {
        const mountOne = host => {
          if (host.dataset.mounted) return;
          host.dataset.mounted = '1';
          let demo = null;
          try { demo = JSON.parse(host.dataset.demo.replace(/&#39;/g, "'")); } catch (_) {}
          if (demo) EditLab.mount(host, demo, img);
        };
        if ('IntersectionObserver' in window) {
          const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { mountOne(e.target); io.unobserve(e.target); } }), { rootMargin: '250px' });
          hosts.forEach(h => io.observe(h));
        } else hosts.forEach(mountOne);
      } else {
        hosts.forEach(h => { h.innerHTML = '<p class="el-loading">Demonstração indisponível.</p>'; });
      }

      // Miniaturas "em 20 segundos": antes/depois geradas pelo mesmo motor,
      // para a ideia entrar antes de se ler uma linha.
      const qvs = [...panel.querySelectorAll('[data-quickvis]')];
      if (img && typeof EditLab !== 'undefined' && qvs.length) {
        const mountQ = el => {
          if (el.dataset.mounted) return;
          el.dataset.mounted = '1';
          let v = null;
          try { v = JSON.parse(el.dataset.quickvis); } catch (_) { return; }
          EditLab.beforeAfter(el, v);
        };
        if ('IntersectionObserver' in window) {
          const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { mountQ(e.target); io2.unobserve(e.target); } }), { rootMargin: '300px' });
          qvs.forEach(el => io2.observe(el));
        } else qvs.forEach(mountQ);
      }

      // Ligações entre ferramentas e para os géneros.
      panel.querySelectorAll('[data-etool]').forEach(b => b.addEventListener('click', () => gotoTool(b.dataset.etool)));
      panel.querySelectorAll('[data-genre-link]').forEach(b =>
        b.addEventListener('click', () => Nav.go('photography/g/' + b.dataset.genreLink)));
      // Nomes bonitos dos géneros (o JSON só guarda o id).
      loadDB().then(gdb => {
        if (!gdb) return;
        panel.querySelectorAll('[data-genre-name]').forEach(el => {
          const g = gdb.genres.find(x => x.id === el.dataset.genreName);
          if (g) el.textContent = g.icon + ' ' + g.name;
        });
      });

      if (focusTool) {
        const el = panel.querySelector(`[data-tool-id="${focusTool}"]`);
        if (el) {
          el.classList.add('flash');
          requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          setTimeout(() => el.classList.remove('flash'), 1600);
        }
      } else window.scrollTo({ top: 0 });
    });
  }

  /* Atalho usado pelos géneros: abre a secção Edição já na ferramenta certa. */
  function gotoTool(id) { _editTool = id; Nav.go('photography/edicao/' + id); }

  /* ══ EQUIPAMENTO ════════════════════════════════════════════════════════
     Guia intemporal, deliberadamente sem marcas nem modelos. Cada item
     responde sempre às mesmas perguntas — que problema resolve, quando usar,
     quando NÃO vale a pena, que erros os iniciantes cometem — para que a
     leitura seja previsível. Usa a mesma grelha expansível de Aprender. */
  let _eqCat = null;
  /* Nem todo o item tem esquema próprio: vários partilham o mesmo princípio
     (todo o flash existe para tornar a fonte maior; qualquer apoio resolve
     tremido). O alias evita desenhar dez vezes a mesma lição. */
  const EQ_ILLUS = {
    phone: 'eq-sensors', apsc: 'eq-sensors', ff: 'eq-sensors', mft: 'eq-sensors',
    compact: 'eq-sensors', bridge: 'eq-focal-fov',
    uwa: 'eq-focal-fov', wide: 'eq-focal-fov', normal: 'eq-focal-fov',
    portrait: 'eq-focal-fov', tele: 'eq-focal-fov', supertele: 'eq-focal-fov', macro: 'eq-focal-fov',
    cpl: 'eq-cpl', nd: 'eq-nd', ndvar: 'eq-nd', ndgrad: 'eq-nd', uv: 'eq-cpl',
    tripod: 'eq-tripod', monopod: 'eq-tripod', remote: 'eq-tripod', ois: 'eq-tripod', ibis: 'eq-tripod',
    popup: 'eq-flash', speedlight: 'eq-flash', diffuser: 'eq-flash', reflector: 'eq-flash', continuous: 'eq-flash',
    cards: 'eq-bag', batteries: 'eq-bag', bag: 'eq-bag', cleaning: 'eq-bag',
    'light-tools': 'eq-bag', strap: 'eq-bag', backup: 'eq-bag',
    'phone-lenses': 'eq-focal-fov', 'phone-zoom': 'eq-zoom', 'phone-hdr': 'eq-sensors',
    'phone-pro': 'eq-zoom', 'phone-night': 'eq-tripod',
  };
  const eqIllus = it => {
    const id = EQ_ILLUS[it.id] || ('eq-' + it.id);
    return (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(id)) ? id : null;
  };
  function eqDetailHTML(it) {
    const sec = (t, cls, arr) => (arr && arr.length)
      ? `<div class="ph-eq-sec ${cls}"><b>${t}</b><ul>${arr.map(li).join('')}</ul></div>` : '';
    const vid = eqIllus(it);
    const vis = vid ? `<div class="ph-detail-art">${PhotoIllus.svg(vid)}</div>` : '';
    return `<button class="ph-detail-close" aria-label="Fechar">✕</button>
      <div class="ph-detail-head"><span class="ph-detail-ico">${it.icon || '📷'}</span>
        <h3 class="ph-detail-title">${it.name}</h3><span class="ph-eq-tag">${it.tag || ''}</span></div>
      ${vis}
      <div class="ph-detail-body">
        <div class="ph-eq-what"><b>O que é</b><p>${it.what}</p></div>
        <div class="ph-eq-why"><b>Que problema resolve</b><p>${it.why}</p></div>
        ${it.effect ? `<div class="ph-eq-effect"><b>Efeito na fotografia</b><p>${it.effect}</p></div>` : ''}
        <div class="ph-eq-cols">
          ${sec('✅ Quando usar', 'ok', it.when)}
          ${sec('⛔ Quando não vale a pena', 'no', it.notWhen)}
        </div>
        ${sec('⚠️ Erros de iniciante', 'mist', it.mistakes)}
        ${sec('💡 Na prática', 'tips', it.tips)}
      </div>`;
  }
  function buildEquipamento(panel, sub) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => buildEquipamento(panel, sub)); return; }
      const cats = db.equipment;
      let cat = cats.find(c => c.id === (sub || _eqCat)) || cats[0];
      _eqCat = cat.id;
      panel.innerHTML = `
        <div class="ph-section-title">🎒 Equipamento</div>
        <p class="ph-section-sub">Conceitos que continuam válidos daqui a dez anos, sem marcas nem modelos. Cada item explica o problema que resolve — e quando não vale a pena.</p>
        <div class="ph-secnav" role="tablist" aria-label="Categorias de equipamento">
          ${cats.map(c => `<button class="ph-secnav-btn${c.id === cat.id ? ' active' : ''}" role="tab" aria-selected="${c.id === cat.id}" data-eqcat="${c.id}">${c.icon} ${c.name}</button>`).join('')}
        </div>
        <p class="ph-eq-intro">${cat.intro}</p>
        ${(typeof PhotoIllus !== 'undefined' && PhotoIllus.has(cat.visual))
          ? `<div class="ph-eq-hero">${PhotoIllus.svg(cat.visual)}</div>` : ''}
        <div id="ph-eq-body"></div>
        <div class="ph-eq-mine" id="ph-eq-mine"></div>`;
      const body = panel.querySelector('#ph-eq-body');
      expandableGrid(body, cat.items, {
        thumb: it => { const v = eqIllus(it); return v ? `<span class="ph-vis ph-learn-art">${PhotoIllus.svg(v)}</span>` : ''; },
        blurb: it => it.tag || '',
        detail: eqDetailHTML,
      });
      // O equipamento pessoal fica no fim e claramente separado: é exemplo, não norma.
      if (cat.id === 'cameras' && db.mine) {
        panel.querySelector('#ph-eq-mine').innerHTML = `
          <div class="ph-section-title" style="margin-top:1.5rem">🎒 ${db.mine.label}</div>
          <p class="ph-section-sub">O equipamento com que este portal é escrito. Aparece como exemplo concreto — as recomendações acima aplicam-se a qualquer câmara.</p>
          <div class="ph-mine-grid">${db.mine.bodies.map(b => `<div class="ph-mine-card">
            <div class="ph-mine-hd">${b.icon} ${b.name} <span class="ph-eq-tag">${(db.classes.find(c => c.id === b.class) || {}).name || ''}</span></div>
            <p class="ph-mine-body">${b.body}</p>
            <ul class="ph-mine-lenses">${b.lenses.map(l => `<li><b>${l.name}</b> <span class="ph-mine-eq">${l.eq}</span><span class="ph-mine-tr">${l.traits}</span></li>`).join('')}</ul>
            <ul class="ph-tip-list">${b.notes.map(li).join('')}</ul>
          </div>`).join('')}</div>`;
      }
      panel.querySelectorAll('[data-eqcat]').forEach(b => b.addEventListener('click', () => {
        _eqCat = b.dataset.eqcat;
        buildEquipamento(panel, _eqCat);
      }));
      window.scrollTo({ top: 0 });
    });
  }

  const APR_HEAD = `<div class="ph-section-title">📖 Fundamentos</div>
    <p class="ph-section-sub">O conhecimento transversal a todos os géneros. Cada conceito abre com uma ilustração — percebe a ideia antes de ler.</p>`;
  function buildFundamentos(box) {
    box.innerHTML = `${APR_HEAD}<div class="ph-learn-grid"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      if (!db) { const g = box.querySelector('.ph-learn-grid'); if (g) g.innerHTML = `<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; return; }
      expandableGrid(box, db.know, {
        head: APR_HEAD,
        thumb: t => conceptThumb(t.id),
        blurb: t => t.blurb,
        detail: t => conceptDetailHTML(t, t.body.map(s => `<div class="ph-know-sec"><h4>${s.h}</h4><p>${s.t}</p></div>`).join('')),
      });
    });
  }

  const APR_SEGS = [
    { id: 'fundamentos', label: '📖 Fundamentos' },
    { id: 'composicao',  label: '🖼️ Composição' },
    { id: 'cores',       label: '🌈 Cores' },
  ];
  const APR_BUILDERS = {
    fundamentos(box) { buildFundamentos(box); },
    composicao(box)  { buildComposition(box); },
    cores(box) {
      box.innerHTML = `
        <div class="ph-section-title">🌈 Roda de Cores</div>
        <p class="ph-section-sub">Explora harmonias de cor para planear paletas de cena e color grading. Arrasta no anel para o tom e no quadrado interior para saturação/luminosidade.</p>
        <div id="ph-cw-inner"></div>`;
      buildColorWheel(box.querySelector('#ph-cw-inner'));
    },
  };
  let _aprBuilt = false, _aprActivate = null;
  function buildAprender(panel, seg) {
    if (!_aprBuilt) {
      _aprBuilt = true;
      panel.innerHTML = `
        <div class="seg ph-apr-seg" role="tablist" aria-label="Aprender">
          ${APR_SEGS.map(s => `<button class="seg-btn" data-seg="${s.id}" role="tab">${s.label}</button>`).join('')}
        </div>
        ${APR_SEGS.map(s => `<div class="ph-apr-panel ph-section-box" data-apr="${s.id}" hidden></div>`).join('')}`;
      const done = new Set();
      _aprActivate = (id) => {
        if (!APR_BUILDERS[id]) id = 'fundamentos';
        panel.querySelectorAll('.ph-apr-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.seg === id));
        panel.querySelectorAll('.ph-apr-panel').forEach(p => { p.hidden = p.dataset.apr !== id; });
        if (!done.has(id)) { done.add(id); APR_BUILDERS[id](panel.querySelector(`.ph-apr-panel[data-apr="${id}"]`)); }
        try { localStorage.setItem('ph-apr-seg', id); } catch (_) {}
      };
      panel.querySelectorAll('.ph-apr-seg .seg-btn').forEach(b =>
        b.addEventListener('click', () => _aprActivate(b.dataset.seg)));
    }
    let initial = seg;
    if (!initial) { try { initial = localStorage.getItem('ph-apr-seg'); } catch (_) {} }
    _aprActivate(initial || 'fundamentos');
  }

  // ── Ferramentas (calculadoras) ──
  let _toolsBuilt = false;
  function buildFerramentas(panel) {
    if (!_toolsBuilt) {
      _toolsBuilt = true;
      panel.innerHTML = `
        <p class="ph-section-sub" style="margin:.1rem 0 .9rem">Calculadoras de exposição e ótica — os resultados atualizam automaticamente. Pré-definidas para a Canon M50 Mark II (APS-C 1.6×).</p>
        <div class="ph-grid"></div>`;
      const grid = panel.querySelector('.ph-grid');
      Object.keys(TOOL_META).forEach(key => {
        const wrapper = document.createElement('div');
        wrapper.id = 'ph-calc-' + key;
        TOOL_META[key].fn(wrapper);
        grid.appendChild(wrapper);
      });
    }
    if (_pendingCalc) {
      const target = panel.querySelector('#ph-calc-' + _pendingCalc);
      _pendingCalc = null;
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('ph-calc-flash');
          setTimeout(() => target.classList.remove('ph-calc-flash'), 1800);
        }, 80);
      }
    }
  }

  // ── Main ──────────────────────────────────────────────────────────
  const PH_TABS = [
    { id: 'generos',     label: '🎯 Géneros' },
    { id: 'agora',       label: '⚡ No Terreno' },
    { id: 'equipamento', label: '🎒 Equipamento' },
    { id: 'edicao',      label: '🎨 Edição' },
    { id: 'aprender',    label: '📚 Aprender' },
    { id: 'ferramentas', label: '🧮 Ferramentas' },
  ];
  const TAB_ROUTE = { generos: 'photography', agora: 'photography/agora', equipamento: 'photography/equipamento', edicao: 'photography/edicao', aprender: 'photography/aprender', ferramentas: 'photography/ferramentas' };

  let _activate = null, _curTab = 'generos', _curArg = null;

  function show(sub) {
    const view = document.getElementById('view-photography');
    if (!view) return;

    if (!_built) {
      _built = true;
      view.innerHTML = `
        <div class="view-inner">
          <div class="page-head">
            <span class="ph-ico">${AppIcons.icon('photography', 22)}</span>
            <div class="ph-titles">
              <h1 class="ph-title">Fotografia</h1>
              <p class="ph-sub">Assistente de fotografia: 28 géneros, guia de equipamento, aprendizagem e ferramentas — adaptado à tua câmara e ao teu perfil</p>
            </div>
          </div>
          <div class="ph-nav seg" role="tablist" aria-label="Secções de fotografia">
            ${PH_TABS.map(t => `<button class="ph-nav-btn seg-btn" role="tab" data-tab="${t.id}" aria-selected="false">${t.label}</button>`).join('')}
          </div>
          ${PH_TABS.map(t => `<div class="ph-panel" data-panel="${t.id}" role="tabpanel"></div>`).join('')}
        </div>`;

      _activate = (id, arg) => {
        _curTab = id; _curArg = arg || null;
        view.querySelectorAll('.ph-nav-btn').forEach(b => {
          const on = b.dataset.tab === id;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on);
        });
        view.querySelectorAll('.ph-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === id));
        const panel = view.querySelector(`.ph-panel[data-panel="${id}"]`);
        if (id === 'generos') (arg ? renderPortal(panel, arg) : buildGeneros(panel));
        else if (id === 'agora') buildAgora(panel, arg);
        else if (id === 'equipamento') buildEquipamento(panel, arg);
        else if (id === 'edicao') buildEdicao(panel, arg);
        else if (id === 'aprender') buildAprender(panel, arg);
        else buildFerramentas(panel);
      };

      view.querySelectorAll('.ph-nav-btn').forEach(b =>
        b.addEventListener('click', () => Nav.go(TAB_ROUTE[b.dataset.tab])));
    }

    /* rota → tab/argumento (com mapeamento das rotas antigas) */
    let tab = null, arg = null;
    if (sub) {
      const seg = sub.split('/');
      const a = seg[0], rest = seg.slice(1).join('/');
      if (a === 'g' && rest)                 { tab = 'generos'; arg = rest; }
      else if (a === 'agora')                { tab = 'agora'; arg = rest || null; }
      else if (a === 'aprender')             { tab = 'aprender'; arg = rest || null; }
      else if (a === 'equipamento')          { tab = 'equipamento'; arg = rest || null; }
      else if (a === 'edicao')               { tab = 'edicao'; arg = rest || null; }
      else if (a === 'ferramentas' || a === 'calc') tab = 'ferramentas';
      else if (a === 'cenarios')             tab = 'generos';
      else if (a === 'composicao' || a === 'cores') { tab = 'aprender'; arg = a; }
    }
    /* Rota "nua" #photography é sempre a home de Géneros — não restaurar a última
       tab (isso impedia voltar a Géneros; ver histórico do bug de navegação). */
    _activate(tab || 'generos', arg);
  }

  return { show };
})();
