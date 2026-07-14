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

  let _compView = (() => { try { return localStorage.getItem('ph-comp-view') || 'both'; } catch (_) { return 'both'; } })();
  let _compIdx = 0, _compGenre = null;
  function setCompView(v) { _compView = v; try { localStorage.setItem('ph-comp-view', v); } catch (_) {} }
  // Ilustração da composição no contexto de um género (ex.: comp-retrato-thirds);
  // se não existir, cai na ilustração geral (comp-thirds).
  const compSlug = name => (COMP_ASSET[name] || '').replace(/^comp-/, '');
  const genreCompAsset = (genre, comp) => genre ? assetPath('comp-' + genre + '-' + compSlug(comp.name)) : null;

  function openCompModal(comp, genreId) {
    _compGenre = genreId || null;
    _compIdx = Math.max(0, COMPOSITIONS.indexOf(comp));
    const modal = _openModal('ph-comp-modal', `<div class="ph-modal-box ph-comp2-box" role="dialog" aria-modal="true" aria-label="Composição">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title" data-comp-title></span>
        <div class="seg ph-comp2-seg" role="group" aria-label="Vista">
          <button class="seg-btn" data-view="grid">Grelha</button>
          <button class="seg-btn" data-view="example">Exemplo</button>
          <button class="seg-btn" data-view="both">Ambos</button>
        </div>
        <button class="ph-modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ph-comp2-body"></div>
    </div>`);
    modal.querySelectorAll('.ph-comp2-seg .seg-btn').forEach(b => b.addEventListener('click', () => { setCompView(b.dataset.view); renderCompModal(modal); }));
    document.addEventListener('keydown', function nav(e) {
      if (!document.getElementById('ph-comp-modal')) { document.removeEventListener('keydown', nav); return; }
      if (e.key === 'ArrowLeft') { _compIdx = (_compIdx - 1 + COMPOSITIONS.length) % COMPOSITIONS.length; renderCompModal(modal); }
      else if (e.key === 'ArrowRight') { _compIdx = (_compIdx + 1) % COMPOSITIONS.length; renderCompModal(modal); }
    });
    renderCompModal(modal);
  }
  function renderCompModal(modal) {
    const comp = COMPOSITIONS[_compIdx], gAsset = genreCompAsset(_compGenre, comp), asset = gAsset || compAsset(comp);
    modal.querySelector('[data-comp-title]').textContent = `🖼️ ${comp.name}`;
    modal.querySelectorAll('.ph-comp2-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.view === _compView));
    const slug = COMP_ASSET[comp.name], bad = gAsset ? null : assetPath(slug + '-bad'), why = COMP_WHY[slug] || {};
    const shot = (src, role) => `<figure class="ph-comp2-shot ${role}">
        <div class="ph-comp2-frame">${src ? `<img class="ph-comp2-img" src="${src}" alt="">` : '<div class="ph-comp2-img ph-comp2-noimg"></div>'}<canvas class="ph-comp2-canvas ph-comp2-anim"></canvas></div>
        ${bad ? `<span class="ph-comp2-badge ${role}">${role === 'ok' ? '✓ Correto' : '✗ Incorreto'}</span><figcaption>${role === 'ok' ? (why.ok || '') : (why.bad || '')}</figcaption>` : ''}
      </figure>`;
    modal.querySelector('.ph-comp2-body').innerHTML = `
      <div class="ph-comp2-stage${bad ? ' dual' : ''}" data-view="${_compView}">
        <button class="ph-comp2-nav prev" aria-label="Composição anterior">‹</button>
        <div class="ph-comp2-frames">${shot(asset, 'ok')}${bad ? shot(bad, 'bad') : ''}</div>
        <button class="ph-comp2-nav next" aria-label="Composição seguinte">›</button>
      </div>
      <div class="ph-comp2-count">${_compIdx + 1} / ${COMPOSITIONS.length}</div>
      <div class="ph-comp2-info">
        <p class="ph-comp2-desc">${comp.desc}</p>
        ${comp.tips ? `<div class="ph-modal-tips"><strong>💡 Dica prática:</strong> ${comp.tips}</div>` : ''}
        ${comp.examples ? `<div class="ph-know-sec"><h4>📷 Exemplos</h4><p>${comp.examples}</p></div>` : ''}
      </div>`;
    requestAnimationFrame(() => {
      modal.querySelectorAll('.ph-comp2-canvas').forEach(canvas => {
        const frame = canvas.closest('.ph-comp2-frame'), w = frame.clientWidth || 560, h = Math.round(w * 832 / 1216);
        canvas.width = w; canvas.height = h;
        drawCompOverlay(canvas, comp);
      });
    });
    modal.querySelector('.prev').addEventListener('click', () => { _compIdx = (_compIdx - 1 + COMPOSITIONS.length) % COMPOSITIONS.length; renderCompModal(modal); });
    modal.querySelector('.next').addEventListener('click', () => { _compIdx = (_compIdx + 1) % COMPOSITIONS.length; renderCompModal(modal); });
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

  // ══ EDIÇÃO — modelo de 3 camadas (data-driven) ═══════════════════
  // género → objetivo visual → técnica (conceito) → implementação (software).
  // Conceito e software vivem separados: data/photo/edit-techniques.json (a
  // teoria, que sobrevive à troca de app) e edit-impl.json (o "como fazer" por
  // software). Adicionar um editor = acrescentar uma chave ao edit-impl.json.
  let _EDIT = null, _editP = null;
  function loadEdit() {
    if (_EDIT) return Promise.resolve(_EDIT);
    if (_editP) return _editP;
    const grab = f => fetch('data/photo/' + f).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
    _editP = Promise.all([grab('edit-techniques.json'), grab('edit-impl.json')])
      .then(([t, impl]) => (_EDIT = Object.assign({}, t, { impl })))
      .catch(() => { _editP = null; return null; });
    return _editP;
  }
  function editSoftware() { try { return localStorage.getItem('ph-edit-sw') || 'lightroom'; } catch (_) { return 'lightroom'; } }
  function setEditSoftware(s) { try { localStorage.setItem('ph-edit-sw', s); } catch (_) {} }
  const techById = id => (_EDIT.techniques || []).find(t => t.id === id);
  const objById = id => (_EDIT.objectives || []).find(o => o.id === id);
  let _pendingGoal = null;   // deep-link vindo de um portal de género

  // ── Portrait illustrations (crop guide + poses + editorial tips) ──
  // Poses e "Onde cortar" usam o manequim vetorial paramétrico (Mannequin,
  // js/pages/photo-mannequin.js): figura neutra, sem rosto/roupa/género, foco
  // total na linguagem corporal e nas articulações. Reutilizável entre géneros.
  const POSE_CAPTIONS = {
    'pose-three-quarter': 'Ângulo 3/4 · peso na perna de trás, ombros em ângulo',
    'pose-busy-hands': 'Dá algo às mãos (cabelo, anca, bolso)',
    'pose-s-curve': 'Curva em S · anca e ombros em sentidos opostos',
    'pose-leaning': 'Encostar / apoiar · postura relaxada',
  };
  // Poses: fotos reais (preferência do user) quando existirem no índice; o
  // manequim vetorial é o fallback. O "Onde cortar" usa sempre o manequim.
  function poseFigure(id) { return (typeof Mannequin !== 'undefined') ? `<span class="ph-pose-vis mq">${Mannequin.figure(id)}</span>` : ''; }
  function posesHTML() {
    return Object.keys(POSE_CAPTIONS).map(id => {
      const asset = assetPath(id);
      const inner = asset
        ? `<span class="ph-pose-vis" data-pose="${id}"><img class="ph-pose-img" loading="lazy" decoding="async" alt="${POSE_CAPTIONS[id]}" src="${asset}"></span>`
        : poseFigure(id);
      return `<div class="ph-pose${asset ? ' has-img' : ''}">${inner}<div class="ph-pose-cap">${POSE_CAPTIONS[id]}</div></div>`;
    }).join('');
  }
  function wirePoses(root) {
    root.querySelectorAll('.ph-pose-vis[data-pose] img').forEach(img => img.addEventListener('error', () => {
      const s = img.closest('.ph-pose-vis'); if (!s) return;
      s.parentElement.classList.remove('has-img');
      s.outerHTML = poseFigure(s.dataset.pose);
    }, { once: true }));
  }

  // "Onde cortar" sobre uma personagem estilizada (crop-standing). Linhas
  // calibradas às articulações da imagem (fração da altura). Fallback: manequim.
  const CROP_LINES2 = [
    { f: 0.02, ok: 1, label: 'espaço p/ cabeça' }, { f: 0.20, ok: 0, label: 'pescoço' },
    { f: 0.33, ok: 1, label: 'meio do peito' }, { f: 0.46, ok: 0, label: 'cotovelos' },
    { f: 0.52, ok: 1, label: 'cintura' }, { f: 0.57, ok: 0, label: 'pulsos / mãos' },
    { f: 0.64, ok: 1, label: 'meio da coxa' }, { f: 0.72, ok: 0, label: 'joelhos' },
    { f: 0.90, ok: 0, label: 'tornozelos' },
  ];
  function cropGuidePhoto(asset) {
    const GOOD = '#34d399', BAD = '#f87171', VBW = 470, H = 400, figX = 30, figY = 8, figH = 384, figW = Math.round(figH * 0.684), lineX2 = figX + figW + 16;
    const lines = CROP_LINES2.map(c => {
      const y = +(figY + c.f * figH).toFixed(1), col = c.ok ? GOOD : BAD;
      return `<g class="ph-cropp-line" data-y="${y}" tabindex="0" role="button" aria-label="${c.ok ? 'Bom corte' : 'Mau corte'}: ${c.label}">
        <rect class="ph-cropp-hit" x="0" y="${y - 9}" width="${VBW}" height="18" fill="transparent"/>
        <line class="ph-cropp-rule" x1="14" y1="${y}" x2="${lineX2}" y2="${y}" stroke="${col}" stroke-width="1.8" stroke-dasharray="5 4"/>
        <circle cx="${figX + 16}" cy="${y}" r="6" fill="${col}" stroke="#0a1220" stroke-width="1.3"/>
        <text x="${figX + 16}" y="${y + 2.6}" text-anchor="middle" fill="#04121a" font-size="8" font-weight="800" font-family="var(--font-sans,sans-serif)">${c.ok ? '✓' : '✗'}</text>
        <text x="${lineX2 + 9}" y="${y + 3.6}" fill="${col}" font-size="11" font-family="var(--font-mono,monospace)">${c.label}</text>
      </g>`;
    }).join('');
    return `<svg viewBox="0 0 ${VBW} ${H}" class="mq-svg ph-cropp" role="img" aria-label="Onde cortar num retrato">
      <image href="${asset}" x="${figX}" y="${figY}" height="${figH}" preserveAspectRatio="xMinYMin meet"/>
      <rect class="ph-cropp-dim" x="${figX}" y="0" width="${figW}" height="0" fill="rgba(2,6,14,.55)" style="pointer-events:none"/>
      ${lines}
    </svg>`;
  }
  function wireCropPhoto(root) {
    root.querySelectorAll('.ph-cropp').forEach(svg => {
      const dim = svg.querySelector('.ph-cropp-dim');
      svg.querySelectorAll('.ph-cropp-line').forEach(g => {
        const y = +g.dataset.y;
        const on = () => { if (dim) { dim.setAttribute('y', y); dim.setAttribute('height', 400 - y); } g.classList.add('hot'); };
        const off = () => { if (dim) dim.setAttribute('height', 0); g.classList.remove('hot'); };
        g.addEventListener('mouseenter', on); g.addEventListener('mouseleave', off);
        g.addEventListener('focus', on); g.addEventListener('blur', off);
      });
    });
  }
  // Exemplos práticos: a MESMA personagem recortada a alturas certas vs erradas.
  const CROP_EX = [
    { t: 'Primeiro plano', a: 'crop-standing', ok: 0.31, bad: 0.20, okc: 'Espaço acima da cabeça, corta no peito.', badc: 'Cortar no pescoço.' },
    { t: 'Meio corpo', a: 'crop-standing', ok: 0.55, bad: 0.72, okc: 'Abaixo da cintura ou no meio da coxa.', badc: 'Cortar nos joelhos.' },
    { t: 'Três quartos', a: 'crop-standing', ok: 0.66, bad: 0.72, okc: 'Meio da coxa, acima dos joelhos.', badc: 'Cortar nos joelhos.' },
    { t: 'Corpo inteiro', a: 'crop-standing', ok: 1, bad: 0.90, okc: 'Inclui os pés com um respiro.', badc: 'Cortar nos tornozelos.' },
  ];
  function cropShot(asset, cf) {
    return `<span class="ph-cropex-frame" style="aspect-ratio:${(0.684 / cf).toFixed(3)}"><img loading="lazy" decoding="async" src="${asset}" alt=""></span>`;
  }
  function cropExamplesHTML() {
    const std = assetPath('crop-standing'); if (!std) return '';
    return `<div class="ph-cropex-grid">${CROP_EX.map(e => {
      const a = assetPath(e.a) || std;
      return `<div class="ph-cropex-card"><div class="ph-cropex-title">${e.t}</div>
        <div class="ph-cropex-pair">
          <figure class="ph-cropex-shot ok"><span class="ph-cropex-badge">✓ Correto</span>${cropShot(a, e.ok)}<figcaption>${e.okc}</figcaption></figure>
          <figure class="ph-cropex-shot bad"><span class="ph-cropex-badge">✗ Incorreto</span>${cropShot(a, e.bad)}<figcaption>${e.badc}</figcaption></figure>
        </div></div>`;
    }).join('')}</div>`;
  }

  function portraitExtrasHTML() {
    const cropAsset = assetPath('crop-standing');
    const crop = cropAsset ? cropGuidePhoto(cropAsset) : (typeof Mannequin !== 'undefined' ? Mannequin.cropGuide() : '');
    const examples = cropExamplesHTML();
    return `
      <div class="ph-illus-block">
        <div class="ph-illus-title">✂️ Onde cortar (e onde não)</div>
        <div class="ph-crop-illus">${crop}</div>
        <div class="ph-illus-cap">Passa o rato (ou toca) numa linha para veres o corte. Corta <strong>entre</strong> as articulações (verde), <strong>nunca</strong> numa articulação (vermelho) — dá sensação de membro amputado. E deixa sempre espaço acima da cabeça.</div>
      </div>
      ${examples ? `<div class="ph-illus-block">
        <div class="ph-illus-title">📐 Exemplos práticos de corte</div>
        <div class="ph-illus-cap" style="margin: -.1rem 0 .6rem">A mesma pessoa — cortes certos (verde) vs errados (vermelho).</div>
        ${examples}
      </div>` : ''}
      <div class="ph-illus-block">
        <div class="ph-illus-title">🧍 Poses que funcionam</div>
        <div class="ph-pose-grid">${posesHTML()}</div>
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

  // ── Laboratório de Edição: drill-down objetivo → técnica → software ──
  function swTabsHTML(techId) {
    const impl = (_EDIT.impl || {})[techId] || {};
    const sw = _EDIT.software || [];
    const active = editSoftware();
    const steps = v => Array.isArray(v) ? `<ol class="ph-sw-steps">${v.map(x => `<li>${x}</li>`).join('')}</ol>` : `<p>${v || '—'}</p>`;
    const tabs = sw.map(s => `<button class="ph-sw-tab${s.id === active ? ' active' : ''}" data-sw="${s.id}" style="--sw:${s.color}">${s.name}</button>`).join('');
    const bodies = sw.map(s => `<div class="ph-sw-impl" data-sw="${s.id}"${s.id === active ? '' : ' hidden'}>${steps(impl[s.id])}</div>`).join('');
    return `<div class="ph-sw-tabs">${tabs}</div><div class="ph-sw-bodies">${bodies}</div>`;
  }
  function techDetailHTML(t) {
    const sec = (h, v) => v ? `<div class="ph-know-sec"><h4>${h}</h4><p>${v}</p></div>` : '';
    const secl = (h, a) => (a && a.length) ? `<div class="ph-know-sec"><h4>${h}</h4><ul class="ph-tip-list">${a.map(x => `<li>${x}</li>`).join('')}</ul></div>` : '';
    const related = (t.related || []).map(id => { const r = techById(id); return r ? `<button class="ph-chip ph-chip-link" data-tech="${id}">${r.icon} ${r.name}</button>` : ''; }).join('');
    return `<div class="ph-edit-concept">
        ${sec('O que resolve', t.solves)}
        ${sec('Porque funciona', t.why)}
        <div class="ph-scn-cols">${sec('Quando usar', t.when)}${sec('Quando evitar', t.avoid)}</div>
        ${secl('Erros comuns', t.errors)}
        ${sec('Relação com a cor', t.colorTheory)}
        ${sec('Intensidade recomendada', t.intensity)}
        ${secl('Variantes', t.variants)}
        ${secl('Exemplos de utilização', t.examples)}
      </div>
      <div class="ph-edit-impl"><div class="ph-edit-impl-hd">🛠️ Como fazer no teu editor</div>${swTabsHTML(t.id)}</div>
      ${related ? `<div class="ph-know-sec"><h4>Técnicas relacionadas</h4><div class="ph-chips">${related}</div></div>` : ''}`;
  }
  function editHomeHTML() {
    const cats = (_EDIT.categories || []).map(c => `<div class="ph-edit-cat">
      <div class="ph-edit-cat-hd"><span>${c.icon} ${c.name}</span><small>${c.blurb || ''}</small></div>
      <div class="ph-chips">${(c.objectives || []).map(oid => { const o = objById(oid); return o ? `<button class="ph-goal-chip" data-goal="${oid}">${o.name}</button>` : ''; }).join('')}</div>
    </div>`).join('');
    return `<p class="ph-section-sub">Escolhe um objetivo → depois a técnica → o "como fazer" no teu editor (Lightroom, darktable, Snapseed ou RapidRAW).</p><div class="ph-edit-cats">${cats}</div>`;
  }
  function editObjHTML(o) {
    const techs = (o.techniques || []).map(id => { const t = techById(id); return t ? `<button class="ph-scn-card" data-tech="${id}" data-from="${o.id}">
      <span class="ph-scn-ico">${t.icon}</span><span class="ph-scn-name">${t.name}</span><span class="ph-scn-blurb-sm">${t.solves}</span></button>` : ''; }).join('');
    return `<button class="ph-back" data-back="home">← Objetivos</button>
      <div class="ph-portal-head"><span class="ph-portal-ico">🎯</span><div><h2 class="ph-portal-name">${o.name}</h2><p class="ph-portal-goal">${o.why}</p></div></div>
      <p class="ph-section-sub">Técnicas que servem este objetivo — a teoria primeiro, depois o teu editor:</p>
      <div class="ph-scn-grid">${techs}</div>`;
  }
  function editTechHTML(t, from) {
    const back = from ? `obj:${from}` : 'home';
    return `<button class="ph-back" data-back="${back}">← Voltar</button>
      <div class="ph-portal-head"><span class="ph-portal-ico">${t.icon}</span><div><h2 class="ph-portal-name">${t.name}</h2></div></div>
      ${techDetailHTML(t)}`;
  }
  function renderStage(stage, view) {
    if (view.level === 'obj') stage.innerHTML = editObjHTML(objById(view.id));
    else if (view.level === 'tech') stage.innerHTML = editTechHTML(techById(view.id), view.from);
    else stage.innerHTML = editHomeHTML();
    const go = v => renderStage(stage, v);
    stage.querySelectorAll('[data-editsw]').forEach(b => b.addEventListener('click', () => { setEditSoftware(b.dataset.editsw); go(view); }));
    stage.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => go({ level: 'obj', id: b.dataset.goal })));
    stage.querySelectorAll('[data-tech]').forEach(b => b.addEventListener('click', () => go({ level: 'tech', id: b.dataset.tech, from: b.dataset.from || (view.level === 'obj' ? view.id : null) })));
    stage.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { const d = b.dataset.back; go(d.startsWith('obj:') ? { level: 'obj', id: d.slice(4) } : { level: 'home' }); }));
    stage.querySelectorAll('.ph-sw-tab').forEach(tab => tab.addEventListener('click', () => {
      const sw = tab.dataset.sw; setEditSoftware(sw);
      stage.querySelectorAll('.ph-sw-tab').forEach(x => x.classList.toggle('active', x === tab));
      stage.querySelectorAll('.ph-sw-impl').forEach(x => { x.hidden = x.dataset.sw !== sw; });
    }));
  }
  function buildEditTechniques(root) {
    root.innerHTML = `<div class="ph-section-title">🎞️ Laboratório de Edição</div>
      <p class="ph-section-sub">Organizado por <b>objetivo visual</b>, não por software. A teoria é independente do editor — escolhe o objetivo → a técnica → vê o "como fazer" no teu editor.</p>
      <div class="ph-edit-stage"><p class="ph-section-sub">A carregar…</p></div>`;
    loadEdit().then(db => {
      const stage = root.querySelector('.ph-edit-stage'); if (!stage) return;
      if (!db) { stage.innerHTML = `<p class="ph-section-sub">Não foi possível carregar. <button class="ph-chip ph-chip-link" data-retry>Tentar novamente</button></p>`; wireRetry(stage, () => buildEditTechniques(root)); return; }
      if (_pendingGoal && objById(_pendingGoal)) { const id = _pendingGoal; _pendingGoal = null; renderStage(stage, { level: 'obj', id }); }
      else renderStage(stage, { level: 'home' });
    });
  }
  // Modal de edição — abre a partir dos portais de género SEM sair do portal.
  // É um mini-Laboratório: drill-down objetivo↔técnica dentro do overlay.
  function openEditModal(view) {
    loadEdit().then(db => {
      if (!db) return;
      const modal = _openModal('ph-edit-modal', `<div class="ph-modal-box ph-edit-modal-box" role="dialog" aria-modal="true" aria-label="Edição">
        <div class="ph-modal-hdr"><span class="ph-modal-title">🎞️ Laboratório de Edição</span><button class="ph-modal-close" aria-label="Fechar">✕</button></div>
        <div class="ph-edit-modal-body"><div class="ph-edit-stage"></div></div>
      </div>`);
      renderStage(modal.querySelector('.ph-edit-stage'), view);
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
    Promise.all([loadDB(), loadAssets(), loadEdit()]).then(([db]) => {
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
        <section class="ph-scn-sec"><h4>🖼️ Composição</h4>${compCardsHTML(g.composition, g.id)}</section>
        <div class="ph-scn-cols">
          <section class="ph-scn-sec"><h4>✅ Fazer</h4><ul class="ph-do">${g.dos.map(li).join('')}</ul></section>
          <section class="ph-scn-sec"><h4>⛔ Evitar</h4><ul class="ph-dont">${g.donts.map(li).join('')}</ul></section>
        </div>
        ${g.portrait ? portraitExtrasHTML() : ''}
        <section class="ph-scn-sec"><h4>☑️ Checklist antes de sair</h4>
          <ul class="ph-check">${g.checklist.map(c => `<li><label><input type="checkbox"><span>${c}</span></label></li>`).join('')}</ul>
        </section>
        <section class="ph-scn-sec"><h4>✏️ Objetivos de edição</h4>
          <div class="ph-scn-blurb">${g.edit.intro}</div>
          <div class="ph-goal-list">${(((_EDIT && _EDIT.genreGoals && _EDIT.genreGoals[g.id]) || []).map(oid => {
            const o = objById(oid); return o ? `<button class="ph-goal-row" data-goal="${oid}"><span class="ph-goal-name">✓ ${o.name}</span><span class="ph-goal-why">${o.why}</span><span class="ph-goal-go">→</span></button>` : '';
          }).join('')) || '<p class="ph-section-sub">—</p>'}</div>
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
      panel.querySelectorAll('[data-comp]').forEach(ch => {
        const comp = COMPOSITIONS.find(c => c.name === ch.dataset.comp);
        if (!comp) return;
        const cv = ch.querySelector('.ph-comp-card-cv'); if (cv) requestAnimationFrame(() => drawCompOverlay(cv, comp));
        ch.addEventListener('click', () => openCompModal(comp, g.id));
      });
      panel.querySelectorAll('[data-goal]').forEach(ch => ch.addEventListener('click', () => openEditModal({ level: 'obj', id: ch.dataset.goal })));
      panel.querySelectorAll('[data-tool]').forEach(ch => ch.addEventListener('click', () => {
        _pendingCalc = ch.dataset.tool;
        Nav.go('photography/ferramentas');
      }));
      panel.querySelector('[data-agora]').addEventListener('click', () => Nav.go('photography/agora/' + g.id));
      if (g.portrait) { wirePoses(panel); wireCropPhoto(panel); if (typeof Mannequin !== 'undefined') Mannequin.wireCropGuide(panel); }
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
    /* Rota "nua" #photography é sempre a home de Géneros — não restaurar a última
       tab (isso impedia voltar a Géneros; ver histórico do bug de navegação). */
    _activate(tab || 'generos', arg);
  }

  return { show };
})();
