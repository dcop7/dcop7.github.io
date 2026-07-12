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
    const modal = _openModal('ph-comp-modal', `<div class="ph-modal-box ph-comp-box" role="dialog" aria-modal="true" aria-label="${comp.name}">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">🖼️ ${comp.name}</span>
        <button class="ph-modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ph-comp-modal-grid">
        <div class="ph-comp-modal-canvas-wrap"><canvas class="ph-modal-canvas" id="ph-modal-canvas"></canvas></div>
        <div class="ph-comp-modal-info">
          <div class="ph-comp-modal-desc">${comp.desc}</div>
          ${comp.tips ? `<div class="ph-modal-tips"><strong>💡 Dica prática:</strong> ${comp.tips}</div>` : ''}
          ${comp.examples ? `<div class="ph-comp-modal-examples"><strong>📷 Exemplos:</strong> ${comp.examples}</div>` : ''}
        </div>
      </div>
    </div>`);
    const canvas = modal.querySelector('#ph-modal-canvas');
    canvas.width = 560; canvas.height = 420;
    requestAnimationFrame(() => drawCompCanvas(canvas, comp));
  }

  function buildComposition(root) {
    root.innerHTML=`
      <div class="ph-section-title">🖼️ Guias de Composição</div>
      <p class="ph-section-sub">As regras clássicas para organizar os elementos no enquadramento. Toca num cartão para ver a explicação completa, dicas práticas e exemplos.</p>
      <div class="ph-comp-grid" id="ph-comp-grid"></div>`;

    const grid=root.querySelector('#ph-comp-grid');
    COMPOSITIONS.forEach((comp,idx)=>{
      const item=document.createElement('button');
      item.type='button';
      item.className='ph-comp-item';
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

  // Unified modal open/close: fresh overlay each time (no stale listeners),
  // Escape closes only the topmost overlay, body scroll locked while any is open.
  function _openModal(id, boxHTML) {
    const old = document.getElementById(id);
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'ph-modal-overlay';
    modal.innerHTML = boxHTML;
    document.body.appendChild(modal);
    document.body.classList.add('ph-modal-open');
    _bindModalClose(modal);
    return modal;
  }

  function _bindModalClose(modal) {
    const close = () => {
      modal.hidden = true;
      document.removeEventListener('keydown', esc);
      if (!document.querySelector('.ph-modal-overlay:not([hidden])')) document.body.classList.remove('ph-modal-open');
    };
    function esc(e) {
      if (e.key !== 'Escape') return;
      const open = document.querySelectorAll('.ph-modal-overlay:not([hidden])');
      if (open[open.length - 1] === modal) close();
    }
    modal.querySelector('.ph-modal-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', esc);
  }

  function openTechModal(t) {
    _openModal('ph-tech-modal', `<div class="ph-modal-box ph-scn-box" role="dialog" aria-modal="true" aria-label="${t.name}">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">${t.icon} ${t.name}</span>
        <button class="ph-modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ph-scn-modal-body">
        <div class="ph-light-box">${t.idea}</div>
        ${swRowsHTML(t)}
      </div>
    </div>`);
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

  // ══ PORTAL DE GÉNEROS ═══════════════════════════════════════════
  // Conteúdo data-driven (data/photo/{gear,genres,know}.json). O seletor
  // de equipamento (M50 II / S23+ / Ambos) adapta lentes, definições,
  // limites e dicas em todos os portais e no modo No Terreno.
  let _DB = null, _dbPromise = null;
  function loadDB() {
    if (_DB) return Promise.resolve(_DB);
    if (_dbPromise) return _dbPromise;
    const grab = f => fetch('data/photo/' + f).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
    _dbPromise = Promise.all([grab('gear.json'), grab('genres.json'), grab('know.json')])
      .then(([g, gen, k]) => (_DB = { profiles: g.profiles, genres: gen.genres, know: k.topics }))
      .catch(() => { _dbPromise = null; return null; });
    return _dbPromise;
  }
  function dbErrorHTML() {
    return `<div class="ph-section-box"><p class="ph-section-sub">Não foi possível carregar o conteúdo de fotografia. <button class="ph-chip ph-chip-link" data-retry>Tentar novamente</button></p></div>`;
  }
  function wireRetry(panel, again) {
    panel.querySelector('[data-retry]')?.addEventListener('click', again);
  }
  const li = x => `<li>${x}</li>`;
  const kvHTML = s => `<div class="ph-kv"><span class="ph-kv-k">${s.k}</span><span class="ph-kv-v">${s.v}</span></div>`;

  // ── seletor de equipamento ──
  const GEAR_OPTS = [
    { id: 'canon', label: '📷 M50 II' },
    { id: 's23',   label: '📱 S23+' },
    { id: 'all',   label: '🎒 Ambos' },
  ];
  function gear() { try { const g = localStorage.getItem('ph-gear'); return GEAR_OPTS.some(o => o.id === g) ? g : 'canon'; } catch (_) { return 'canon'; } }
  function setGear(g) { try { localStorage.setItem('ph-gear', g); } catch (_) {} }
  function gearBarHTML(opts) {
    const g = gear();
    const list = (opts && opts.noAll) ? GEAR_OPTS.filter(o => o.id !== 'all') : GEAR_OPTS;
    return `<div class="ph-gearbar" role="group" aria-label="Equipamento">
      <span class="ph-gearbar-lbl">Equipamento</span>
      ${list.map(o => `<button class="ph-gear-btn${o.id === g ? ' active' : ''}" data-gear="${o.id}">${o.label}</button>`).join('')}
    </div>`;
  }
  function wireGearBar(panel, rerender) {
    panel.querySelectorAll('.ph-gear-btn').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.gear === gear()) return;
      setGear(b.dataset.gear);
      rerender();
    }));
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
    loadDB().then(db => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => buildGeneros(panel)); return; }
      panel.innerHTML = `
        ${gearBarHTML()}
        <button class="ph-field-cta" id="ph-goto-field">
          <span class="ph-field-cta-ico">⚡</span>
          <span class="ph-field-cta-txt"><b>Estou a fotografar agora</b><small>Assistente de bolso: lente, definições e erros a evitar — em segundos</small></span>
          <span class="ph-field-cta-go">→</span>
        </button>
        <div class="ph-section-title" style="margin-top:1rem">🎯 Géneros fotográficos</div>
        <p class="ph-section-sub">Escolhe o que vais fotografar — cada portal junta equipamento, definições, luz, composição, checklist e edição.</p>
        <div class="ph-scn-grid" id="ph-genre-grid">
          ${db.genres.map(g => `<button class="ph-scn-card" data-genre="${g.id}">
            <span class="ph-scn-ico">${g.icon}</span><span class="ph-scn-name">${g.name}</span>
            <span class="ph-scn-blurb-sm">${g.blurb}</span></button>`).join('')}
        </div>`;
      wireGearBar(panel, () => buildGeneros(panel));
      panel.querySelector('#ph-goto-field').addEventListener('click', () => Nav.go('photography/agora'));
      panel.querySelectorAll('[data-genre]').forEach(c =>
        c.addEventListener('click', () => Nav.go('photography/g/' + c.dataset.genre)));
    });
  }

  // ── portal de um género ──
  function compChipsHTML(names) {
    return names.map(name => {
      const known = COMPOSITIONS.some(c => c.name === name);
      return `<button class="ph-chip${known ? ' ph-chip-link' : ''}"${known ? ` data-comp="${name}"` : ' disabled'}>${name}</button>`;
    }).join('');
  }
  function kitCardHTML(db, g, k) {
    const kit = g[k];
    const prof = db.profiles.find(p => p.id === k) || { icon: '', short: k };
    if (!kit) return '';
    return `<div class="ph-kit ph-kit-${k}">
      <div class="ph-kit-head">${prof.icon} ${prof.short}</div>
      <div class="ph-kit-lens">${kit.lens}</div>
      <div class="ph-kit-why">${kit.why}</div>
      ${kit.mode ? `<div class="ph-kit-mode">✨ ${kit.mode}</div>` : ''}
      <div class="ph-kv-grid">${kit.settings.map(kvHTML).join('')}</div>
      ${kit.af ? `<div class="ph-kit-af"><b>Foco:</b> ${kit.af}</div>` : ''}
      ${kit.alt ? `<div class="ph-kit-alt"><b>Alternativa:</b> ${kit.alt}</div>` : ''}
      ${kit.limits && kit.limits.length ? `<div class="ph-kit-lims"><b>⚠️ Limites reais</b><ul>${kit.limits.map(li).join('')}</ul></div>` : ''}
      ${kit.tips && kit.tips.length ? `<ul class="ph-tip-list">${kit.tips.map(li).join('')}</ul>` : ''}
    </div>`;
  }
  function renderPortal(panel, id) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    loadDB().then(db => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => renderPortal(panel, id)); return; }
      const g = db.genres.find(x => x.id === id);
      if (!g) { Nav.go('photography'); return; }
      const kits = gear() === 'all' ? ['canon', 's23'] : [gear()];
      panel.innerHTML = `
        <div class="ph-portal-top">
          <button class="ph-back" id="ph-back">← Géneros</button>
          ${gearBarHTML()}
        </div>
        <div class="ph-portal-head">
          <span class="ph-portal-ico">${g.icon}</span>
          <div><h2 class="ph-portal-name">${g.name}</h2><p class="ph-portal-goal">${g.goal}</p></div>
        </div>
        <div class="ph-kit-wrap${kits.length > 1 ? ' both' : ''}">${kits.map(k => kitCardHTML(db, g, k)).join('')}</div>
        <section class="ph-scn-sec"><h4>💡 Luz</h4><div class="ph-light-box">${g.light}</div></section>
        <section class="ph-scn-sec"><h4>🖼️ Composição</h4><div class="ph-chips">${compChipsHTML(g.composition)}</div></section>
        <div class="ph-scn-cols">
          <section class="ph-scn-sec"><h4>✅ Fazer</h4><ul class="ph-do">${g.dos.map(li).join('')}</ul></section>
          <section class="ph-scn-sec"><h4>⛔ Evitar</h4><ul class="ph-dont">${g.donts.map(li).join('')}</ul></section>
        </div>
        ${g.portrait ? portraitExtrasHTML() : ''}
        <section class="ph-scn-sec"><h4>☑️ Checklist antes de sair</h4>
          <ul class="ph-check">${g.checklist.map(c => `<li><label><input type="checkbox"><span>${c}</span></label></li>`).join('')}</ul>
        </section>
        <section class="ph-scn-sec"><h4>✏️ Edição deste género</h4>
          <div class="ph-scn-blurb">${g.edit.intro}</div>
          ${g.edit.steps.map(editStepHTML).join('')}
          <div class="ph-chips" style="margin-top:.7rem">${(g.techniques || []).map(tid => {
            const t = EDIT_TECHNIQUES.find(x => x.id === tid);
            return t ? `<button class="ph-chip ph-chip-link" data-tech="${t.id}">${t.icon} ${t.name}</button>` : '';
          }).join('')}</div>
        </section>
        ${(g.tools || []).length ? `<section class="ph-scn-sec"><h4>🧮 Ferramentas para este género</h4>
          <div class="ph-chips">${g.tools.map(tid => TOOL_META[tid] ? `<button class="ph-chip ph-chip-link" data-tool="${tid}">🧮 ${TOOL_META[tid].label}</button>` : '').join('')}</div>
        </section>` : ''}
        <button class="ph-field-cta small" data-agora="${g.id}">
          <span class="ph-field-cta-ico">⚡</span>
          <span class="ph-field-cta-txt"><b>Modo terreno: ${g.name}</b><small>Só o essencial, para consultar com a câmara na mão</small></span>
          <span class="ph-field-cta-go">→</span>
        </button>`;
      panel.querySelector('#ph-back').addEventListener('click', () => Nav.go('photography'));
      wireGearBar(panel, () => renderPortal(panel, id));
      panel.querySelectorAll('[data-comp]').forEach(ch => ch.addEventListener('click', () => {
        const comp = COMPOSITIONS.find(c => c.name === ch.dataset.comp);
        if (comp) openCompModal(comp);
      }));
      panel.querySelectorAll('[data-tech]').forEach(ch => ch.addEventListener('click', () => {
        const t = EDIT_TECHNIQUES.find(x => x.id === ch.dataset.tech);
        if (t) openTechModal(t);
      }));
      panel.querySelectorAll('[data-tool]').forEach(ch => ch.addEventListener('click', () => {
        _pendingCalc = ch.dataset.tool;
        Nav.go('photography/ferramentas');
      }));
      panel.querySelector('[data-agora]').addEventListener('click', () => Nav.go('photography/agora/' + g.id));
      window.scrollTo({ top: 0 });
    });
  }

  // ── modo No Terreno (assistente de bolso) ──
  let _fieldGear = null;   // escolha efémera; não força quem prefere "Ambos"
  function buildAgora(panel, genreId) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    loadDB().then(db => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => buildAgora(panel, genreId)); return; }
      let id = genreId;
      try { id = id || localStorage.getItem('ph-field-genre'); } catch (_) {}
      if (!db.genres.some(g => g.id === id)) id = db.genres[0].id;
      try { localStorage.setItem('ph-field-genre', id); } catch (_) {}
      const g = db.genres.find(x => x.id === id);
      if (!_fieldGear) _fieldGear = gear() === 'all' ? 'canon' : gear();
      const kit = g[_fieldGear];
      const firstLight = g.light.split(/(?<=\.)\s/)[0] || g.light;
      panel.innerHTML = `
        <div class="ph-field-pills" role="tablist" aria-label="Género">
          ${db.genres.map(x => `<button class="ph-field-pill${x.id === id ? ' active' : ''}" data-fg="${x.id}" role="tab" aria-selected="${x.id === id}">${x.icon} ${x.name}</button>`).join('')}
        </div>
        <div class="ph-field-card">
          <div class="ph-field-top">
            <div class="ph-field-title">${g.icon} ${g.name}</div>
            <div class="ph-field-gear" role="group" aria-label="Equipamento">
              ${GEAR_OPTS.filter(o => o.id !== 'all').map(o => `<button class="ph-gear-btn${o.id === _fieldGear ? ' active' : ''}" data-fgear="${o.id}">${o.label}</button>`).join('')}
            </div>
          </div>
          <div class="ph-field-lens">${kit.lens}</div>
          ${kit.mode ? `<div class="ph-field-mode">✨ ${kit.mode}</div>` : ''}
          <div class="ph-kv-grid ph-field-kv">${kit.settings.map(kvHTML).join('')}</div>
          <div class="ph-field-row">🖼️ <b>Compõe:</b> ${g.composition.slice(0, 2).join(' · ')}</div>
          <div class="ph-field-row">💡 ${firstLight}</div>
          <div class="ph-field-avoid"><b>⛔ Evita:</b><ul>${g.donts.slice(0, 3).map(li).join('')}</ul></div>
          <div class="ph-field-row ph-field-edit">✏️ <b>Depois:</b> ${g.edit.intro}</div>
          <button class="ph-back ph-field-more" data-portal="${id}">Portal completo de ${g.name} →</button>
        </div>`;
      panel.querySelectorAll('[data-fg]').forEach(p => p.addEventListener('click', () => {
        try { history.replaceState(null, '', '#photography/agora/' + p.dataset.fg); } catch (_) {}
        buildAgora(panel, p.dataset.fg);
      }));
      panel.querySelectorAll('[data-fgear]').forEach(b => b.addEventListener('click', () => {
        _fieldGear = b.dataset.fgear;
        buildAgora(panel, id);
      }));
      panel.querySelector('[data-portal]').addEventListener('click', () => Nav.go('photography/g/' + id));
      panel.querySelector('.ph-field-pill.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  // ── Aprender: fundamentos + composição + edição + cores ──
  function openKnowModal(t) {
    _openModal('ph-know-modal', `<div class="ph-modal-box ph-scn-box" role="dialog" aria-modal="true" aria-label="${t.name}">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">${t.icon} ${t.name}</span>
        <button class="ph-modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ph-scn-modal-body">
        ${t.body.map(s => `<div class="ph-know-sec"><h4>${s.h}</h4><p>${s.t}</p></div>`).join('')}
      </div>
    </div>`);
  }
  function buildFundamentos(box) {
    box.innerHTML = `
      <div class="ph-section-title">📖 Fundamentos</div>
      <p class="ph-section-sub">O conhecimento transversal a todos os géneros — exposição, foco, luz, ficheiros e o vocabulário da fotografia.</p>
      <div class="ph-scn-grid" id="ph-know-grid"><p class="ph-section-sub">A carregar…</p></div>`;
    loadDB().then(db => {
      const grid = box.querySelector('#ph-know-grid');
      if (!grid) return;
      if (!db) { grid.innerHTML = `<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; return; }
      grid.innerHTML = '';
      db.know.forEach(t => {
        const card = document.createElement('button');
        card.className = 'ph-scn-card';
        card.innerHTML = `<span class="ph-scn-ico">${t.icon}</span><span class="ph-scn-name">${t.name}</span><span class="ph-scn-blurb-sm">${t.blurb}</span>`;
        card.addEventListener('click', () => openKnowModal(t));
        grid.appendChild(card);
      });
    });
  }

  const APR_SEGS = [
    { id: 'fundamentos', label: '📖 Fundamentos' },
    { id: 'composicao',  label: '🖼️ Composição' },
    { id: 'edicao',      label: '🎨 Edição' },
    { id: 'cores',       label: '🌈 Cores' },
  ];
  const APR_BUILDERS = {
    fundamentos(box) { buildFundamentos(box); },
    composicao(box)  { buildComposition(box); },
    edicao(box)      { buildEditTechniques(box); },
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
    { id: 'aprender',    label: '📚 Aprender' },
    { id: 'ferramentas', label: '🧮 Ferramentas' },
  ];
  const TAB_ROUTE = { generos: 'photography', agora: 'photography/agora', aprender: 'photography/aprender', ferramentas: 'photography/ferramentas' };

  let _activate = null;

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
              <p class="ph-sub">Portais por género, assistente de terreno, aprendizagem e ferramentas · Canon M50 II & Galaxy S23+</p>
            </div>
          </div>
          <div class="ph-nav seg" role="tablist" aria-label="Secções de fotografia">
            ${PH_TABS.map(t => `<button class="ph-nav-btn seg-btn" role="tab" data-tab="${t.id}" aria-selected="false">${t.label}</button>`).join('')}
          </div>
          ${PH_TABS.map(t => `<div class="ph-panel" data-panel="${t.id}" role="tabpanel"></div>`).join('')}
        </div>`;

      _activate = (id, arg) => {
        view.querySelectorAll('.ph-nav-btn').forEach(b => {
          const on = b.dataset.tab === id;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on);
        });
        view.querySelectorAll('.ph-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === id));
        const panel = view.querySelector(`.ph-panel[data-panel="${id}"]`);
        if (id === 'generos') (arg ? renderPortal(panel, arg) : buildGeneros(panel));
        else if (id === 'agora') buildAgora(panel, arg);
        else if (id === 'aprender') buildAprender(panel, arg);
        else buildFerramentas(panel);
        try { localStorage.setItem('ph-tab', id); } catch (_) {}
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
      else if (a === 'ferramentas' || a === 'calc') tab = 'ferramentas';
      else if (a === 'cenarios')             tab = 'generos';
      else if (a === 'composicao' || a === 'edicao' || a === 'cores') { tab = 'aprender'; arg = a; }
    }
    if (!tab) {
      try { const saved = localStorage.getItem('ph-tab'); if (PH_TABS.some(t => t.id === saved)) tab = saved; } catch (_) {}
    }
    _activate(tab || 'generos', arg);
  }

  return { show };
})();
