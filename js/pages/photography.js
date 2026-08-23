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
              ${[['0.03', 'Full Frame 35mm (0.03mm)'], ['0.019', 'APS-C (0.019mm)'],
                 ['0.015', 'Micro 4/3 (0.015mm)'], ['0.010', '1" sensor (0.010mm)'],
                 ['0.006', 'Telemóvel 1/1.5" (0.006mm)'], ['0.005', 'Telemóvel 1/2.3" (0.005mm)']]
                .map(([v, t]) => `<option value="${v}"${v === classCoC() ? ' selected' : ''}>${t}</option>`).join('')}
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
              ${[['1', 'Full Frame (1×)'], ['1.5', 'APS-C Nikon/Sony (1.5×)'],
                 ['1.6', 'APS-C Canon (1.6×)'], ['2', 'Micro 4/3 (2×)'],
                 ['2.7', '1" sensor (2.7×)'], ['4.7', 'Telemóvel 1/1.5" (4.7×)'],
                 ['5.6', 'Telemóvel 1/2.3" (5.6×)']]
                .map(([v, t]) => `<option value="${v}"${v === classCrop() ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="fc-result" class="ph-result"></div>
      </div>`;

    function calcFc() {
      const fl=+root.querySelector('#fc-fl').value, crop=+root.querySelector('#fc-crop').value;
      const eq=fl*crop;
      root.querySelector('#fc-result').innerHTML=`
        <div class="ph-result-val">${eq.toFixed(0)} mm equivalente FF</div>
        <div class="ph-result-desc">Ângulo de visão como ${eq.toFixed(0)}mm numa câmara full frame. Factor de crop: ${crop}×</div>`;
    }
    root.querySelectorAll('#fc-fl,#fc-crop').forEach(el=>el.addEventListener('input',calcFc));
    calcFc();
  }

  /* ── Distância Hiperfocal ──────────────────────────────────────────
     Cartão próprio. Vivia dentro do Focal + Crop, e era a única ficha com
     duas calculadoras: ficava o dobro da altura das vizinhas e desalinhava
     a grelha toda. O CoC vem da classe de câmara, como o crop. */
  function buildHyperfocal(root) {
    root.innerHTML=`
      <div class="ph-card">
        <div class="ph-card-title">🎯 Distância Hiperfocal</div>
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
            <input type="number" class="ph-input" id="hf-coc" value="${classCoC()}" step="0.001" min="0.001">
          </div>
        </div>
        <div id="hf-result" class="ph-result"></div>
      </div>`;

    function calcHf() {
      const fl=+root.querySelector('#hf-fl').value, ap=+root.querySelector('#hf-ap').value, coc=+root.querySelector('#hf-coc').value;
      const H=(fl*fl)/(ap*coc)/1000;
      root.querySelector('#hf-result').innerHTML=`
        <div class="ph-result-val">${H.toFixed(2)} m</div>
        <div class="ph-result-desc">Foca a ${H.toFixed(2)} m → tudo de ${(H/2).toFixed(2)} m ao infinito em foco.</div>`;
    }
    root.querySelectorAll('#hf-fl,#hf-ap,#hf-coc').forEach(el=>el.addEventListener('input',calcHf));
    calcHf();
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
          ${row('☀️','Nascer do sol:',hhmm(hSun==null?null:noon-hSun),'var(--accent-txt)')}
          ${row('🌇','Pôr do sol:',hhmm(hSun==null?null:noon+hSun),'var(--accent-txt)')}
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
    { name:'Regra dos Terços', anchor:[1/3,1/3], short:'Assunto num dos quatro cruzamentos, nunca ao centro.', desc:'Divide o enquadramento em 9 partes iguais com 2 linhas horizontais e 2 verticais. Os 4 pontos de cruzamento são os pontos focais ideais — o olho humano navega naturalmente por eles, tornando a imagem mais dinâmica e equilibrada do que colocar o sujeito ao centro.',
      tips:'Horizontes: coloca na linha 1/3 superior (céu dramático) ou inferior (terra/água em destaque). Rostos: olho mais próximo no cruzamento superior. Sujeitos em movimento: posiciona-os no terço oposto à direção do movimento — dá espaço de respiração.',
      examples:'Fotografia de paisagem (horizonte a 1/3), retratos (olhos no cruzamento superior), fotografia de street (sujeito no terço lateral).',
      draw(ctx,W,H){
        ctx.strokeStyle='rgba(99,102,241,.55)';ctx.lineWidth=1;
        [1/3,2/3].forEach(f=>{
          ctx.beginPath();ctx.moveTo(W*f,0);ctx.lineTo(W*f,H);ctx.stroke();
          ctx.beginPath();ctx.moveTo(0,H*f);ctx.lineTo(W,H*f);ctx.stroke();
        });
        // O cruzamento ONDE O ASSUNTO ESTA fica cheio; os outros ficam vazios.
        // Quatro pontos iguais nao dizem qual e que a fotografia usou.
        /* Os quatro pontos sao IGUAIS: um deles maior lia-se como defeito, nao
           como destaque. Quem indica onde o assunto esta e um anel solto por
           cima do cruzamento usado. */
        const a=(this.anchor||[1/3,1/3]);
        [1/3,2/3].forEach(x=>[1/3,2/3].forEach(y=>{
          ctx.beginPath();ctx.arc(W*x,H*y,4.5,0,2*Math.PI);
          ctx.fillStyle='rgba(99,102,241,.7)';ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1.4;ctx.stroke();
        }));
        ctx.strokeStyle='rgba(99,102,241,.95)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(W*a[0],H*a[1],13,0,2*Math.PI);ctx.stroke();
        ctx.strokeStyle='rgba(99,102,241,.55)';ctx.lineWidth=1;
      }},
    { name:'Proporção Áurea (Phi)', anchor:[0.618,0.618], short:'Como os terços, com as linhas mais chegadas ao centro.', desc:'Proporção 1:1.618 (número phi) — ligeiramente diferente dos terços mas considerada a mais harmoniosa pela natureza. As linhas divisórias criam a mesma proporção entre os segmentos que se encontra em conchas, galáxias e flores. Os 4 pontos de cruzamento são mais precisos e naturais que os dos terços.',
      tips:'Mais subtil e elegante que os terços. Ideal para retratos formais, fotografia de produto e composições arquitetónicas. A divisão phi não está a 1/3 (33.3%) mas a 38.2% e 61.8% do lado — note a diferença subtil mas importante.',
      examples:'Retratos clássicos (estilo Rembrandt, Caravaggio), fotografia de produto de luxo, arquitetura com proporções geométricas.',
      draw(ctx,W,H){
        const phi=1.618;const gx=W/phi,gy=H/phi;
        ctx.strokeStyle='rgba(245,158,11,.55)';ctx.lineWidth=1;
        [gx,W-gx].forEach(x=>{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();});
        [gy,H-gy].forEach(y=>{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();});
        const a=this.anchor||[1-1/phi,1/phi];
        [gx,W-gx].forEach(x=>[gy,H-gy].forEach(y=>{
          const on=Math.abs(x-W*a[0])<2&&Math.abs(y-H*a[1])<2;
          ctx.beginPath();ctx.arc(x,y,on?7:4,0,2*Math.PI);
          ctx.fillStyle=on?'rgba(245,158,11,.9)':'rgba(245,158,11,.25)';ctx.fill();
          if(on){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();}
        }));
      }},
    { name:'Espiral Dourada', traced:1, short:'A curva da própria cena leva o olho até ao assunto.', focal:[0.49,0.66], desc:'Espiral logarítmica baseada na proporção áurea — o olhar segue naturalmente a curva até ao ponto focal no centro. O raio cresce por um fator de φ=1.618 a cada 90°. É a mesma proporção que se encontra em conchas de nautilus, galáxias espirais e em obras de Da Vinci.',
      tips:'Roda o enquadramento (ou o telemóvel/câmara) para que o elemento principal coincida com o centro apertado da espiral. O movimento da curva deve guiar o olhar. Funciona melhor quando há uma linha natural em curva (estrada, rio, braço, silhueta).',
      examples:'Retratos de beleza (rosto no centro da espiral), paisagens com rios sinuosos, macro de flores, composições arquitetónicas com escadas em espiral.',
      draw(ctx,W,H){
        const phi=1.618033988749895,b=Math.log(phi)/(Math.PI/2);
        /* O centro da espiral tem de cair onde o assunto está NA fotografia.
           Estava fixo na divisão phi e a ilustração tinha o barco noutro
           sítio — a espiral desenhava uma relação que a imagem não tinha,
           que é exactamente o erro que uma marcação nunca pode cometer. */
        const cx=W*(this.focal ? this.focal[0] : 1/phi), cy=H*(this.focal ? this.focal[1] : 1/phi);
        // Subtle phi grid
        ctx.strokeStyle='rgba(245,158,11,.18)';ctx.lineWidth=0.7;
        [W/phi,W-W/phi].forEach(gx=>{ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();});
        [H/phi,H-H/phi].forEach(gy=>{ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();});
        // Compute max r such that spiral stays in canvas over 3 turns (tMax = 3π)
        // At t=3π the spiral points left: need r*1 ≤ cx
        // At t=5π/2 (down): r*1 ≤ H-cy
        // At t=2π (right): r*1 ≤ W-cx
        // At t=3π/2 (up): r*1 ≤ cy
        /* Duas voltas e meia e nao tres: com tres, a condicao de caber tudo
           dentro da moldura obrigava o raio inicial a ser tao pequeno que a
           espiral ficava do tamanho de uma moeda no meio de uma escadaria que
           ocupa a imagem toda — desenhava a regra, nao a fotografia. Com duas
           voltas e meia (e a ultima a poder sair pela margem, como acontece em
           qualquer sobreposicao de espiral aurea) a curva acompanha mesmo a
           escadaria. */
        const tMax=Math.PI*2.5;
        const r0=Math.min(
          (W-cx) / Math.exp(b*Math.PI*2),
          (H-cy) * 2.4 / Math.exp(b*Math.PI*5/2),
          cx      / Math.exp(b*Math.PI),
          cy      / Math.exp(b*Math.PI*3/2)
        )*0.95;
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
    { name:'Diagonal Principal', traced:1, short:'Uma linha inclinada dá movimento onde a horizontal dá calma.', desc:'Elementos ao longo da diagonal criam tensão, energia e movimento — muito mais dinâmicos que horizontais ou verticais.',
      tips:'Diagonal ↗: lida como movimento natural no sentido de leitura. Diagonal ↙: tensão e drama. Estradas, rios, sombras e braços funcionam bem.',
      examples:'Estradas e sombras em diagonal, escadarias, braços e olhares em retrato, arquitetura moderna.',
      /* A diagonal desta fotografia e a guarda da estrada: entra a 0.62 da
         altura, a esquerda, e sobe ate 0.28 a direita. A diagonal exacta do
         rectangulo (canto a canto) passava a 20% de distancia dela. */
      line:[[0,0.58],[1,0.27]],
      draw(ctx,W,H){
        const L=this.line||[[0,1],[1,0]];
        const x1=W*L[0][0],y1=H*L[0][1],x2=W*L[1][0],y2=H*L[1][1];
        ctx.strokeStyle='rgba(34,197,94,.22)';ctx.lineWidth=14;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.strokeStyle='rgba(34,197,94,.85)';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        // horizontal de referencia: e contra ela que a diagonal ganha energia
        ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1;ctx.setLineDash([5,5]);
        ctx.beginPath();ctx.moveTo(0,(y1+y2)/2);ctx.lineTo(W,(y1+y2)/2);ctx.stroke();ctx.setLineDash([]);
      }},
    { name:'Linhas Convergentes', traced:1, short:'Tudo aponta para o mesmo ponto de fuga.', desc:'Linhas que convergem num ponto de fuga criam profundidade, escala e perspetiva muito fortes. O olhar é irresistivelmente atraído.',
      tips:'Estradas, carris, corredores, árvores em linha. O sujeito fica no ou perto do ponto de convergência. O ponto de fuga pode estar fora do enquadramento.',
      examples:'Carris e pontes, corredores e túneis, avenidas arborizadas, pontões a entrar no mar.',
      /* Ponto de fuga MEDIDO: e a porta iluminada ao fundo da arcada. */
      vp:[0.505,0.555],
      draw(ctx,W,H){
        const v=this.vp||[0.5,0.38];const vx=W*v[0],vy=H*v[1];
        ctx.strokeStyle='rgba(99,102,241,.6)';ctx.lineWidth=1.4;
        [[0,H],[W*0.22,H],[W*0.44,H],[W*0.56,H],[W*0.78,H],[W,H],[0,H*0.7],[W,H*0.7]].forEach(([px,py])=>{
          ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(vx,vy);ctx.stroke();
        });
        ctx.fillStyle='rgba(99,102,241,.85)';ctx.beginPath();ctx.arc(vx,vy,6,0,2*Math.PI);ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
        ctx.strokeStyle='rgba(99,102,241,.2)';ctx.lineWidth=0.8;ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.moveTo(0,vy);ctx.lineTo(W,vy);ctx.stroke();ctx.setLineDash([]);
      }},
    { name:'Simetria & Reflexo', traced:1, short:'Eixo exato — ou é rigorosa, ou lê-se como descuido.', desc:'Simetria perfeita cria equilíbrio e harmonia. Reflexos em água duplicam o sujeito. Quebrar a simetria com um elemento cria interesse.',
      tips:'Superfícies de água, espelhos, janelas. Assimetria deliberada (60/40) é mais interessante que perfeição (50/50). Inclina ligeiramente para dinamismo.',
      examples:'Reflexos em lagos e poças, fachadas e claustros, interiores de igrejas, retratos frontais centrados.',
      /* Um eixo, o que a fotografia tem: aqui e a linha de agua, a 0.575 da
         altura. Desenhar tambem um eixo vertical num reflexo horizontal
         dizia que havia uma simetria que a imagem nao tem. */
      axis:['h',0.575],
      draw(ctx,W,H){
        const ax=this.axis||['h',0.5];
        ctx.strokeStyle='rgba(239,68,68,.75)';ctx.lineWidth=2;ctx.setLineDash([7,5]);
        ctx.beginPath();
        if(ax[0]==='h'){ctx.moveTo(0,H*ax[1]);ctx.lineTo(W,H*ax[1]);}
        else{ctx.moveTo(W*ax[1],0);ctx.lineTo(W*ax[1],H);}
        ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='rgba(239,68,68,.07)';
        if(ax[0]==='h') ctx.fillRect(0,H*ax[1],W,H-H*ax[1]);
        else ctx.fillRect(W*ax[1],0,W-W*ax[1],H);
      }},
    { name:'Enquadramento Natural', traced:1, short:'Algo na cena faz de moldura e fecha as bordas.', desc:'Elementos da cena (arcos, janelas, ramos, portas) funcionam como moldura, dirigindo o olhar ao sujeito e dando contexto e profundidade.',
      tips:'Procura arcos, portas, túneis, copas de árvores. Foca no sujeito dentro da moldura — o enquadramento pode estar desfocado. Dá camadas à imagem.',
      examples:'Portas e arcos, janelas, ramos de árvores em primeiro plano, túneis e pontes a emoldurar o sujeito.',
      /* A abertura do arco desta fotografia (medida) e o caminhante que ela
         emoldura. A moldura estava centrada no rectangulo e nao no arco. */
      hole:[0.356,0.125,0.70,0.93], subj:[0.53,0.74],
      draw(ctx,W,H){
        const k=this.hole||[0.2,0.15,0.8,0.9], s2=this.subj||[0.5,0.6];
        const x=W*k[0],y=H*k[1],w2=W*(k[2]-k[0]),h2=H*(k[3]-k[1]);
        // escurece TUDO menos a abertura: e o que a moldura faz ao olhar
        ctx.fillStyle='rgba(4,10,20,.4)';
        ctx.fillRect(0,0,x,H); ctx.fillRect(x+w2,0,W-x-w2,H);
        ctx.fillRect(x,0,w2,y); ctx.fillRect(x,y+h2,w2,H-y-h2);
        ctx.strokeStyle='rgba(34,197,94,.8)';ctx.lineWidth=2;ctx.strokeRect(x,y,w2,h2);
        ctx.strokeStyle='rgba(34,197,94,.85)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(W*s2[0],H*s2[1],Math.min(W,H)*0.055,0,Math.PI*2);ctx.stroke();
      }},
    { name:'Espaço Negativo', traced:1, short:'Muito vazio à volta de pouco assunto.', desc:'Espaço vazio intencional em torno do sujeito. O vazio define o sujeito, cria respiração visual e reforça emoção (solidão, imensidão).',
      tips:'Quanto mais pequeno o sujeito no espaço, maior a sensação de vastidão. Deixa espaço à frente do sujeito (espaço de movimento). Fundos limpos são essenciais.',
      examples:'Silhueta contra o céu, barco num mar calmo, minimalismo com nevoeiro, retrato contra parede lisa.',
      /* O "vazio" era um rectangulo fixo que CONTINHA o sujeito — dizia
         exactamente o contrario da licao. Agora o vazio e tudo menos um disco
         a volta da figura, medida na fotografia. */
      subj:[0.35,0.66],
      draw(ctx,W,H){
        const s2=this.subj||[0.5,0.6], r=Math.min(W,H)*0.13;
        ctx.save();
        ctx.fillStyle='rgba(99,102,241,.13)';
        ctx.beginPath();ctx.rect(0,0,W,H);
        ctx.arc(W*s2[0],H*s2[1],r,0,Math.PI*2,true);
        ctx.fill('evenodd');
        ctx.restore();
        ctx.strokeStyle='rgba(99,102,241,.8)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(W*s2[0],H*s2[1],r,0,Math.PI*2);ctx.stroke();
      }},
    { name:'Curva em S', traced:1, short:'O olho percorre a cena a passear, não a correr.', desc:'Linhas sinuosas em forma de S (ou C) guiam o olhar suavemente pelo enquadramento, criando fluidez, elegância e profundidade.',
      tips:'Estradas sinuosas, rios, caminhos, postura do corpo, praias. A curva S divide o espaço e dá profundidade — especialmente eficaz em paisagens.',
      examples:'Estradas de montanha, rios e ribeiras, linha de costa, dunas, caminhos pedonais em jardins.',
      /* O S DESTA fotografia: o rio entra a 0.53 em baixo, faz bojo a direita
         a meia altura e sai a 0.37 ao fundo do vale. O S generico de canto a
         canto que estava aqui nao passava por cima da agua em lado nenhum. */
      path:[[0.51,1.00],[0.51,0.72,0.575,0.57,0.615,0.50],[0.645,0.44,0.60,0.36,0.52,0.30],[0.46,0.25,0.40,0.20,0.365,0.16]],
      draw(ctx,W,H){
        const P=this.path;
        const trace=()=>{ctx.beginPath();ctx.moveTo(W*P[0][0],H*P[0][1]);
          for(let i=1;i<P.length;i++){const c=P[i];
            ctx.bezierCurveTo(W*c[0],H*c[1],W*c[2],H*c[3],W*c[4],H*c[5]);}};
        ctx.strokeStyle='rgba(168,85,247,.18)';ctx.lineWidth=14;trace();ctx.stroke();
        ctx.strokeStyle='rgba(168,85,247,.9)';ctx.lineWidth=2.5;trace();ctx.stroke();
        ctx.fillStyle='rgba(168,85,247,.75)';
        [[0.51,0.97],[0.55,0.75],[0.615,0.50],[0.56,0.35],[0.40,0.20]].forEach(([x,y])=>{
          ctx.beginPath();ctx.arc(W*x,H*y,3.4,0,Math.PI*2);ctx.fill();
        });
      }},
    { name:'Composição em Triângulo', traced:1, short:'Três pontos que se sustentam entre si.', desc:'Três pontos ou elementos formam um triângulo visual — estável, equilibrado e harmonioso. Guia o olhar em ciclo pelos três vértices.',
      tips:'Não precisa ser explícito: três objetos, olhares ou linhas imaginárias formam o triângulo. Triângulo invertido cria instabilidade intencional e tensão.',
      examples:'Retratos de grupo (3 pessoas), montanhas, pose com braços na anca, still life com três objetos.',
      /* Os TRES objectos desta natureza-morta, medidos: espigas no alto do
         jarro, taca de barro a esquerda, taca branca a direita. O triangulo
         generico (centro-baixo-esquerda-baixo-direita) caia no vazio. */
      pts:[[0.59,0.10],[0.24,0.70],[0.78,0.76]],
      draw(ctx,W,H){
        const pts=(this.pts||[[0.5,0.12],[0.82,0.82],[0.18,0.82]]).map(([x,y])=>[W*x,H*y]);
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
  /* O que cada arranjo COMUNICA e quando falha.
     Isto viveu durante uma versão em Técnicas, como fichas próprias («espaço
     negativo», «moldura no primeiro plano»). Estava no sítio errado: uma
     técnica é um procedimento que produz um resultado que de outra maneira
     não se obtinha (panning, longa exposição, dupla exposição); estes são
     ARRANJOS do enquadramento, que é exactamente o que a Composição ensina.
     O resultado eram duas lições para o mesmo conceito, com palavras
     diferentes. O que as fichas tinham de próprio — o significado, o limite
     e o exercício — passou para aqui, onde já estava o exemplo e a grelha. */
  const COMP_MEANING = {
    'Espaço Negativo': {
      says: 'Isolamento, escala, silêncio. Também confiança: uma fotografia que se permite estar quase vazia anuncia que sabe o que está a fazer.',
      avoid: 'Quando o vazio não é uniforme. Um céu com nuvens desiguais e cabos elétricos não é espaço negativo — é fundo desarrumado com pouco lá dentro.',
      drill: 'Fotografa o mesmo assunto a ocupar 50%, 20% e 5% do enquadramento. A de 5% costuma ser a que ninguém teria tentado — e muitas vezes a melhor.',
    },
    'Enquadramento Natural': {
      says: 'Profundidade e ponto de vista. E sobretudo presença: uma moldura diz que havia alguém num sítio concreto a olhar dali, o que uma vista limpa nunca diz.',
      avoid: 'Quando a moldura é mais interessante do que o assunto, ou quando fica desfocada de forma indecisa — nem nítida nem claramente fora de foco.',
      drill: 'Numa saída, obriga-te a que TODAS as fotografias tenham alguma coisa no primeiro plano. É desconfortável ao início e muda a forma de andar.',
    },
    'Linhas Convergentes': {
      says: 'Direção e distância: as linhas dizem ao olhar por onde entrar e quanto caminho há até ao fundo.',
      avoid: 'Quando convergem para um sítio onde não está nada, e quando o ponto de fuga fica fora do enquadramento — aí as linhas continuam lá e deixam de conduzir.',
      drill: 'Fotografa a mesma linha de fuga à altura dos olhos e depois quase encostado ao chão. A segunda quase sempre puxa mais.',
    },
    'Regra dos Terços': {
      says: 'Que houve uma decisão. Um assunto ao centro lê-se como apontar a câmara; fora do centro lê-se como escolher.',
      avoid: 'Como obrigação. Simetria, retratos frontais e minimalismo pedem centro — a regra descreve um hábito do olhar, não uma lei.',
      drill: 'Fotografa a mesma cena com o assunto ao centro e num ponto forte. Fica com a que te obriga a percorrer o enquadramento.',
    },
  };
  // Legendas correto/incorreto (quando existe a versão "errada" comp-<slug>-bad).
  /* Descrevem a DECISÃO, não a qualidade. O lado direito diz o que a segunda
     versão faz em vez do princípio — nunca que está errada. */
  const COMP_WHY = {
    'comp-thirds': { ok: 'Farol num ponto forte e horizonte na linha de cima: o olho percorre o enquadramento.', bad: 'Mesma cena, farol ao centro e horizonte ao meio — o enquadramento fica simétrico e parado.' },
    'comp-golden': { ok: 'A figura cai na divisão áurea, um pouco mais fora do centro do que nos terços.', bad: 'Mesma cena com a figura ao centro: o equilíbrio passa a ser simétrico em vez de proporcional.' },
    'comp-spiral': { ok: 'De cima, os degraus apertam volta após volta e entregam o olhar à luz no centro.', bad: 'A mesma escadaria vista de baixo: a curva achata-se em corrimãos sobrepostos e o centro sai do enquadramento.' },
    'comp-diagonal': { ok: 'A estrada atravessa o enquadramento na diagonal e leva o olho com ela.', bad: 'Mesmo carro e mesma estrada vistos de lado: a linha fica horizontal e a cena perde direção.' },
    'comp-converging': { ok: 'Visto pelo eixo, as duas filas de arcos fecham num ponto de fuga e criam profundidade.', bad: 'A mesma parede de arcos fotografada de frente: todas as linhas ficam paralelas às margens, não há ponto de fuga nenhum e a imagem perde a profundidade.' },
    'comp-symmetry': { ok: 'Horizonte no eixo e reflexo inteiro: a simetria é a decisão da fotografia.', bad: 'Mesma montanha com o horizonte alto e o reflexo partido pelo vento — a simetria deixa de existir.' },
    'comp-framing': { ok: 'O arco escuro rodeia o vale e aponta ao caminhante.', bad: 'Mesmo vale e mesmo caminhante sem nada em primeiro plano — a cena fica aberta e plana.' },
    'comp-negative': { ok: 'Muito vazio à volta de uma figura pequena: o espaço dá escala e isolamento.', bad: 'A mesma figura num enquadramento cheio de ponta a ponta: sem vazio nenhum à volta, deixa de haver escala e de se saber para onde olhar.' },
    'comp-scurve': { ok: 'O rio desenha um S e conduz o olhar de baixo até ao fundo do vale.', bad: 'Mesmo tipo de vale com o curso de água a direito: o olhar atravessa sem percurso.' },
    'comp-triangle': { ok: 'Três alturas diferentes: os topos fecham um triângulo estável.', bad: 'Os mesmos três rochedos alinhados e à mesma altura — ficam uma fila, não um triângulo.' },
  };
  // Desenha só o overlay geométrico (fundo transparente para assentar na imagem);
  // opts.bg preenche um fundo neutro (vista "só grelha" sem imagem).
  function drawCompOverlay(canvas, comp, opts = {}) {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (opts.bg) { ctx.fillStyle = document.body.classList.contains('light') ? '#dbe3ef' : '#0b1020'; ctx.fillRect(0, 0, W, H); }
    ctx.save();
    /* Halo escuro por baixo de cada traço. Sem ele, uma linha âmbar de 1px
       sobre areia clara ou céu queimado é invisível — e uma marcação que
       não se vê não é marcação. Uma linha aqui resolve as dez. */
    ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 4;
    comp.draw(ctx, W, H);
    ctx.restore();
  }

  /* ══ VISUALIZADOR DE COMPOSIÇÃO ═════════════════════════════════════════
     Uma cena com duas camadas de leitura: a comparação entre a versão
     CORRETA e a INCORRETA, e as marcações geométricas por cima, que se
     ligam e desligam. Uma régua de miniaturas salta entre técnicas sem
     fechar o modal.

     A comparação em si passou a ser o PhotoLearn.compare (lado a lado por
     omissão, cortina à distância de um toque) — a cortina local que aqui
     existia era a mesma coisa sem os outros modos e sem o seletor. */
  let _compIdx = 0, _compGenre = null;
  let _compOv = (() => { try { return localStorage.getItem('ph-comp-ov') !== '0'; } catch (_) { return true; } })();
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
    const why = COMP_WHY[slug] || {}, mean = COMP_MEANING[comp.name] || {};
    modal.querySelector('[data-comp-title]').textContent = `🖼️ ${comp.name}`;

    /* Parte 3 — a cortina deixou de ser o único modo aqui.
       O par correto/incorreto de uma composição são DUAS CENAS diferentes:
       com a cortina via-se metade de cada uma, e a geometria que se está a
       ensinar (onde cai o assunto, para onde vão as linhas) fica cortada ao
       meio precisamente onde interessa. Lado a lado mostra as duas decisões
       inteiras, cada uma com a sua grelha por cima — que é a comparação que
       esta secção sempre quis fazer. A cortina continua a um toque, porque
       para quem já percebeu a diferença ela é mais rápida. */
    const ovHTML = () => `<canvas class="ph-cv-ov${_compOv ? '' : ' off'}"></canvas>`;
    /* Os rótulos eram "✓ Correto" e "✗ Incorreto", e isso era falso: as duas
       fotografias são válidas — só uma delas usa o princípio. Chamar má a uma
       fotografia centrada e simétrica ensina o aluno a desconfiar do portal,
       não a compor. O par passa a dizer o que realmente o separa. */
    const stage = bad
      ? PhotoLearn.compare({
          fam: 'composicao', mode: 'side', a: asset, b: bad,
          aAlt: 'Enquadramento que aplica o princípio',
          bAlt: 'Mesma cena sem aplicar o princípio',
          aTag: '✓ Aplica', bTag: '↔ Não aplica',
          aWhy: why.ok || '', bWhy: why.bad || '',
          label: 'Comparar os dois enquadramentos',
          /* As marcacoes que SEGUEM um elemento (a linha da estrada, o rio, o
             ponto de fuga, o arco, os tres objectos) foram MEDIDAS na
             fotografia que aplica o principio. Desenha-las por cima da outra
             fotografia era garantir que caiam ao lado do que existe la — e
             foi isso que aconteceu com a diagonal. As grelhas (tercos, phi),
             que nao dependem do conteudo, continuam nas duas. */
          extraA: ovHTML(), extraB: comp.traced ? '' : ovHTML(),
        })
      : `<div class="pl-frame">
        ${asset ? `<img src="${asset}" alt="" draggable="false">` : '<div class="ph-cv-noimg"></div>'}
        ${ovHTML()}
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
        ${mean.says ? `<div class="ph-cv-sec says"><b>🗣️ O que comunica</b><p>${mean.says}</p></div>` : ''}
        ${comp.tips ? `<div class="ph-cv-sec apply"><b>🎯 Como aplicar no terreno</b><p>${comp.tips}</p></div>` : ''}
        ${mean.avoid ? `<div class="ph-cv-sec over"><b>🪤 Quando falha</b><p>${mean.avoid}</p></div>` : ''}
        ${comp.examples ? `<div class="ph-cv-sec"><b>📷 Onde encontrar</b><p>${comp.examples}</p></div>` : ''}
        ${mean.drill ? PhotoLearn.drill({ key: 'comp-' + slug, t: mean.drill }) : ''}
      </div>
      <div class="ph-cv-rail" role="tablist" aria-label="Técnicas de composição">
        ${COMPOSITIONS.map((c, i) => {
          const a = genreCompAsset(_compGenre, c) || compAsset(c);
          return `<button class="ph-cv-thumb${i === _compIdx ? ' active' : ''}" data-jump="${i}" role="tab" aria-selected="${i === _compIdx}" title="${c.name}">
            ${a ? `<img src="${a}" alt="" loading="lazy" draggable="false">` : '<span class="ph-cv-thumb-no"></span>'}
            <span class="ph-cv-thumb-n">${c.name}</span></button>`;
        }).join('')}
      </div>`;

    /* Em lado a lado há DUAS grelhas: a do exemplo correto mostra onde as
       linhas caem, e a do incorreto mostra que não caem em lado nenhum. É
       essa segunda que faltava enquanto só havia uma cena de cada vez. */
    const drawOv = () => {
      modal.querySelectorAll('.ph-cv-ov').forEach(cv => {
        const frame = cv.closest('.pl-frame') || cv.parentElement;
        const w = frame.clientWidth || 560;
        const h = frame.clientHeight || Math.round(w * 832 / 1216);
        cv.width = w; cv.height = h;
        drawCompOverlay(cv, comp, { bg: !asset });
      });
    };
    requestAnimationFrame(drawOv);

    modal.querySelectorAll('[data-step]').forEach(b =>
      b.addEventListener('click', () => modal._step(+b.dataset.step)));
    modal.querySelectorAll('[data-jump]').forEach(b =>
      b.addEventListener('click', () => { _compIdx = +b.dataset.jump; renderCompModal(modal); }));
    modal.querySelector('[data-ov]')?.addEventListener('change', e => {
      setCompOv(e.target.checked);
      modal.querySelectorAll('.ph-cv-ov').forEach(cv => cv.classList.toggle('off', !e.target.checked));
    });

    PhotoLearn.wire(modal, plGo);
    // trocar de modo recria as molduras: as grelhas têm de ser repintadas
    modal.querySelector('.pl-cmp')?.addEventListener('pl:mode', () => requestAnimationFrame(drawOv));
    window.addEventListener('resize', drawOv, { once: true });
  }

  /* ── Composição ▸ as decisões ─────────────────────────────────────────────
     Os 8 módulos de craft.json (altura, ângulo, distância, primeiro plano,
     fundo, momento, direção da luz, simplificar) só eram alcançáveis abrindo
     um género e encontrando a secção certa — 8 lições ilustradas escondidas
     atrás de dois cliques e do conhecimento de que ali estavam.

     São a camada que responde a "como decido", e ficam aqui por duas razões:
     Composição é onde vive a organização do enquadramento (a mesma fronteira
     que já tinha as regras geométricas), e é a página mais curta do Aprender.
     Não é um separador novo: as regras dizem ONDE pôr as coisas, as decisões
     dizem DE ONDE fotografar. São as duas metades da mesma pergunta.
     O género continua a mostrá-las, com a sua aplicação concreta — é o mesmo
     `craftBlockHTML`, e por isso não há duas versões do texto para manter. */
  function compDecisionsHTML(db) {
    const mods = (db && db.craft) || [];
    if (!mods.length) return '';
    return `<h3 class="ph-section-title sub">🎚️ As decisões</h3>
      <p class="ph-section-sub">As regras acima dizem <b>onde</b> pôr as coisas no enquadramento. Estas dizem <b>de onde</b> fotografar — e mudam a fotografia mais do que qualquer definição da câmara. Cada uma reaparece aplicada dentro de cada género.</p>
      <div class="ph-craft-list">${mods.map(m => craftBlockHTML(m, '')).join('')}</div>`;
  }

  function buildComposition(root) {
    /* Dito uma vez, aqui em cima, e não repetido dentro de cada comparação:
       sem esta ressalva os pares leem-se como um julgamento de qualidade, que
       é exactamente o que não são. */
    root.innerHTML = `<h2 class="ph-section-title">🖼️ Composição</h2>
      <p class="ph-section-sub">Como se organizam os elementos dentro do enquadramento — as regras clássicas, cada uma com exemplo, grelha e o que comunica. Toca para explorar.</p>
      <p class="ph-comp-note">⚖️ <b>Isto são ferramentas, não leis.</b> Em cada par, as duas fotografias são válidas: uma usa o princípio e a outra, na mesma cena, não o usa. Muita fotografia excelente ignora estas regras de propósito — saber usá-las é também saber quando as deixar de lado.</p>
      <div class="ph-comp-grid2"><p class="ph-section-sub">A carregar…</p></div>
      <div data-comp-decisions></div>`;
    Promise.all([loadAssets(), loadDB()]).then(([, db]) => {
      const dec = root.querySelector('[data-comp-decisions]');
      if (dec) { dec.innerHTML = compDecisionsHTML(db); if (typeof PhotoIllus !== 'undefined') PhotoIllus.wire(dec); }
      const grid = root.querySelector('.ph-comp-grid2'); if (!grid) return;
      grid.innerHTML = '';
      COMPOSITIONS.forEach(comp => {
        const asset = compAsset(comp);
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'ph-comp-card';
        card.innerHTML = `<span class="ph-comp-card-frame">
            ${asset ? `<img class="ph-comp-card-img" loading="lazy" decoding="async" src="${asset}" alt="">` : '<span class="ph-comp-card-noimg"></span>'}
            <canvas class="ph-comp-card-cv" width="320" height="219" role="img" aria-label="Marcações da composição sobre o exemplo"></canvas>
          </span>
          <span class="ph-comp-card-name">${comp.name}</span>
          <span class="ph-comp-card-desc">${comp.short || comp.desc}</span>`;
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
            <canvas id="cw-canvas" class="cw-canvas" width="220" height="220" role="img" aria-label="Roda de cores: anel de tonalidade e quadrado de saturacao e luminosidade"></canvas>
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
                              grab('profiles.json'), grab('craft.json'), grab('equipment.json'),
                              grab('vision.json'), grab('looks.json'), grab('techniques.json'),
                              grab('read.json'), grab('colour.json')])
      .then(([g, gen, k, p, c, e, v, lk, tc, rd, cl]) => (_DB = {
        classes: g.classes, lensClasses: g.lensClasses, mine: g.mine, gearDefault: g.default,
        genres: gen.genres, know: k.topics,
        profiles: p.profiles, profileDefault: p.default, rawAdvice: p.rawAdvice,
        craft: c.modules, equipment: e.categories,
        vision: v.genres, principles: v.principles,
        looks: lk.looks, lookBases: lk.bases, techniques: tc.techniques,
        readMethod: rd.method, readAnalyses: rd.analyses, readCrops: rd.crops,
        colour: cl.lessons, colourChain: cl.chain,
      }))
      .catch(() => { _dbPromise = null; return null; });
    return _dbPromise;
  }
  function dbErrorHTML() {
    return `<div class="ph-section-box"><p class="ph-section-sub">Não foi possível carregar o conteúdo de fotografia. <button class="ph-chip ph-chip-link" data-retry>Tentar novamente</button></p></div>`;
  }

  /* ── Modais do portal ─────────────────────────────────────────────────────
     Overlay novo em cada abertura (sem listeners velhos), Escape só fecha o de
     cima, e o scroll do corpo fica travado enquanto houver algum aberto. */
  function _openModal(id, boxHTML) {
    document.getElementById(id)?.remove();
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'ph-modal-overlay';
    modal.innerHTML = boxHTML;
    document.body.appendChild(modal);
    document.body.classList.add('ph-modal-open');
    _bindModalClose(modal);
    return modal;
  }

  function _closeModal(modal) {
    modal.remove();
    if (!document.querySelector('.ph-modal-overlay')) document.body.classList.remove('ph-modal-open');
  }

  function _bindModalClose(modal) {
    const close = () => { document.removeEventListener('keydown', esc); _closeModal(modal); };
    function esc(e) {
      if (e.key !== 'Escape') return;
      const open = document.querySelectorAll('.ph-modal-overlay');
      if (open[open.length - 1] === modal) close();
    }
    modal.querySelector('.ph-modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', esc);
  }
  // Índice opcional de assets foto-reais (gerado localmente por tools/photogen).
  // Ausente por omissão → tudo usa as ilustrações/SVG procedurais como fallback.
  let _assets = null, _assetsP = null;
  function loadAssets() {
    if (_assets) return Promise.resolve(_assets);
    if (_assetsP) return _assetsP;
    _assetsP = fetch('assets/photo/index.json')
      .then(r => (r.ok ? r.json() : {}))
      .then(j => { _assets = j || {}; shareSubject(); return _assets; })
      .catch(() => (_assets = {}));
    return _assetsP;
  }
  function assetPath(id) { return (_assets && _assets[id]) ? 'assets/photo/' + _assets[id] : null; }
  /* Os motores de ilustração desenham pessoas. Em vez de um boneco
     vetorial, usam a personagem recortada do portal — é entregue uma vez,
     assim que os assets existem, para nenhum deles precisar de saber o
     caminho dos ficheiros. */
  function shareSubject() {
    const url = assetPath('crop-standing');
    if (url) {
      if (typeof PhotoIllus !== 'undefined' && PhotoIllus.setSubject) PhotoIllus.setSubject(url);
      if (typeof PhotoCard !== 'undefined' && PhotoCard.setSubject) PhotoCard.setSubject(url);
    }
    /* O motor dos padroes de luz compoe a sombra sobre uma fotografia de
       rosto com luz plana, gerada de proposito para servir de tela. Duas
       telas: `a` de frente para tudo, `c` de tres-quartos para o par
       Short/Broad, que so existe se a cabeca estiver virada. */
    if (typeof PhotoLightArt === 'undefined' || !PhotoLightArt.setFace) return;
    const fa = assetPath('lb-face-a'); if (fa) PhotoLightArt.setFace(fa, 'a');
    const fcq = assetPath('lb-face-c'); if (fcq) PhotoLightArt.setFace(fcq, 'c');
  }
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
  /* Crop pré-selecionado nas calculadoras. Antes vinha fixo na M50 do autor, o
     que contradizia o seletor de câmara que manda em todo o resto do portal. */
  const CLASS_CROP = { phone: '4.7', apsc: '1.6', ff: '1', mft: '2' };
  const classCrop = () => CLASS_CROP[gearClass()] || '1.6';
  /* Círculo de confusão: 0.03mm em full frame, dividido pelo crop da classe. */
  const CLASS_COC = { phone: '0.006', apsc: '0.019', ff: '0.03', mft: '0.015' };
  const classCoC = () => CLASS_COC[gearClass()] || '0.019';
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
      _closeModal(modal);
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
    focal:    { fn: buildFocal,        label: 'Focal & crop' },
    hf:       { fn: buildHyperfocal,   label: 'Hiperfocal' },
    nd:       { fn: buildNd,           label: 'Filtro ND' },
    flash:    { fn: buildFlash,        label: 'Flash' },
    le:       { fn: buildLongExposure, label: 'Longa exposição' },
    gh:       { fn: buildGoldenHour,   label: 'Hora dourada' },
  };
  let _pendingCalc = null;

  /* ── router das ligações cruzadas ─────────────────────────────────────────
     Todos os componentes do PhotoLearn emitem chips com data-go="<alvo>", e é
     aqui que um alvo vira navegação. Existe para que uma lição possa apontar
     para outra sem saber nada sobre rotas — sem isto, cada secção nova teria
     de reimplementar a mesma tabela e o portal voltava a ser um conjunto de
     páginas isoladas em vez de um sistema. */
  let _pendingLearn = null;   // {seg, id} — cartão a abrir ao chegar a Aprender
  function plGo(target) {
    const [kind, arg] = String(target || '').split(':');
    if (kind === 'g' && arg) { _portalSec = 'visao'; return Nav.go('photography/g/' + arg); }
    if (kind === 'gsec' && arg) {                    // g:<id>/<secção>
      const [gid, sec] = arg.split('/');
      if (sec) _portalSec = sec;
      return Nav.go('photography/g/' + gid);
    }
    if (kind === 'look' || kind === 'tec' || kind === 'ler' || kind === 'know') {
      const seg = kind === 'look' ? 'estilos' : kind === 'tec' ? 'tecnicas'
        : kind === 'know' ? 'fundamentos' : 'ler';
      _pendingLearn = { seg, id: arg };
      return Nav.go('photography/aprender/' + seg);
    }
    if (kind === 'apr') return Nav.go('photography/aprender/' + arg);
    // cs:            → hub dos cheatsheets
    // cs:<id>        → cartão
    // cs:g/<genero>  → cartão de um género
    if (kind === 'cs') return Nav.go('photography/cheatsheets' + (arg ? '/' + arg : ''));
    // rota histórica: agora:<género> → cheatsheet do género
    if (kind === 'agora') return Nav.go('photography/cheatsheets' + (arg ? '/g/' + arg : ''));
    if (kind === 'comp' && arg) {
      const comp = COMPOSITIONS.find(c => c.name === arg);
      if (comp) return openCompModal(comp);
      return Nav.go('photography/aprender/composicao');
    }
    if (kind === 'tool' && arg) { _pendingCalc = arg; return Nav.go('photography/ferramentas'); }
    if (kind === 'etool' && arg) return gotoTool(arg);
    if (kind === 'edicao') return Nav.go('photography/edicao');
  }

  // ── home: grelha de géneros ──
  function buildGeneros(panel) {
    panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      if (!db) { panel.innerHTML = dbErrorHTML(); wireRetry(panel, () => buildGeneros(panel)); return; }
      panel.innerHTML = `
        ${contextBarHTML()}
        <button class="ph-field-cta" id="ph-goto-field">
          <span class="ph-field-cta-ico">📋</span>
          <span class="ph-field-cta-txt"><b>Estou a fotografar agora</b><small>Cheatsheets: lente, definições e erros a evitar — numa página, a olhar</small></span>
          <span class="ph-field-cta-go">→</span>
        </button>
        <h2 class="ph-section-title" style="margin-top:1rem">🎯 Géneros fotográficos</h2>
        <p class="ph-section-sub">Escolhe o que vais fotografar — cada portal junta equipamento, definições, luz, composição, checklist e edição.</p>
        <div class="ph-genre-search">
          <input type="search" id="ph-genre-q" class="ph-genre-q" placeholder="Procurar género (praia, nevoeiro, retrato…)" aria-label="Procurar género" autocomplete="off">
        </div>
        <div id="ph-genre-grid">${genreGroupsHTML(db.genres)}</div>
        <p class="ph-section-sub ph-genre-empty" id="ph-genre-none" hidden>Nenhum género corresponde à procura.</p>`;
      wireContextBar(panel, () => buildGeneros(panel));
      panel.querySelector('#ph-goto-field').addEventListener('click', () => Nav.go('photography/cheatsheets'));
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
        ${grp.items.map(g => {
          // O gancho da Visão vem antes do resumo técnico: ao escolher um género
          // interessa primeiro porque é que vale a pena, e só depois o que é.
          const hook = (visionOf(g) || {}).hook || '';
          return `<button class="ph-scn-card" data-genre="${g.id}" data-search="${(g.name + ' ' + g.blurb + ' ' + hook + ' ' + grp.key).toLowerCase()}">
            ${genreIcoHTML(g, 'ph-scn-ico')}<span class="ph-scn-name">${g.name}</span>
            ${hook ? `<span class="ph-scn-hook">${hook}</span>` : ''}
            <span class="ph-scn-blurb-sm">${g.blurb}</span></button>`;
        }).join('')}
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
        <span class="ph-comp-card-frame">${asset ? `<img class="ph-comp-card-img" loading="lazy" decoding="async" src="${asset}" alt="">` : '<span class="ph-comp-card-noimg"></span>'}<canvas class="ph-comp-card-cv" width="320" height="219" role="img" aria-label="Marcacoes da composicao sobre o exemplo"></canvas></span>
        <span class="ph-comp-card-name">${name}</span></button>`;
    }).join('')}</div>`;
  }
  /* ══ PORTAL DE GÉNERO ═══════════════════════════════════════════════════
     Antes era uma página única e muito longa. Agora é um portal com secções
     navegáveis: consultas "Erros" ou "A cena" sem percorrer tudo.
     As secções são as MESMAS em todos os géneros — a previsibilidade é o que
     torna a consulta rápida. */
  const PORTAL_SECS = [
    { id: 'visao',      icon: '🧠', label: 'Visão' },
    { id: 'essencial',  icon: '🎯', label: 'Essencial' },
    { id: 'cena',       icon: '👁️', label: 'A cena' },
    { id: 'luz',        icon: '💡', label: 'Luz' },
    { id: 'composicao', icon: '🖼️', label: 'Composição' },
    { id: 'ideias',     icon: '💭', label: 'Ideias' },
    { id: 'erros',      icon: '⚠️', label: 'Erros' },
    { id: 'praticar',   icon: '🎓', label: 'Praticar' },
    { id: 'edicao',     icon: '✏️', label: 'Edição' },
  ];
  /* Visão é a secção inicial de propósito: a intenção antes das definições.
     Quem quer só os números tem o cheatsheet do género a um toque. */
  let _portalSec = 'visao';

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
  /* Índice inverso: estilos e técnicas que declaram este género. Sem ele as
     ligações só existiam num sentido — um estilo sabia onde se aplica, mas o
     género não sabia que estilos lhe assentam, e quem entra por um género
     nunca descobria a secção Estilos (Parte 8). */
  function genreCross(gid, kind, max = 4) {
    const list = (_DB && _DB[kind === 'look' ? 'looks' : 'techniques']) || [];
    return list.filter(x => (x.genres || []).includes(gid)).slice(0, max)
      .map(x => ({ go: kind + ':' + x.id, icon: x.icon, label: x.name }));
  }

  function editSectionHTML(g) {
    const p = profileDef(), depth = p ? p.editDepth : 'selective';
    const goals = (g.edit && g.edit.goals) || [];
    const profNote = p ? `<div class="ph-fmt ph-fmt-${depth === 'minimal' ? 'lo' : 'md'}"><b>${p.icon} ${p.name}:</b> ${p.edit}</div>` : '';
    /* O estilo é a camada acima do "como se faz": a secção Edição ensina os
       controlos, e estes chips dizem que aspeto vale a pena procurar aqui. */
    const styles = PhotoLearn.chips(genreCross(g.id, 'look'), '🎨 Estilos que assentam neste género');
    if (depth === 'minimal') {
      return `${profNote}<div class="ph-scn-blurb">${g.edit.intro}</div>
        <div class="ph-info-card"><b>🎯 O que interessa mesmo aqui</b>
          <ul>${goals.slice(0, 3).map(o => li(o.text)).join('')}</ul></div>
        ${styles}
        <button class="ph-goto-edit" data-goedit>🎨 Ver como se faz, na secção Edição →</button>`;
    }
    return `<div class="ph-scn-blurb">${g.edit.intro}</div>${profNote}
      <div class="ph-goal-list">${goals.map(o => `<div class="ph-goal-item">
        <span class="ph-goal-name">✓ ${o.text}</span>
        ${(o.tools || []).length ? `<span class="ph-goal-tools">${o.tools.map(t =>
          `<button class="ph-chip ph-chip-link" data-etool="${t.id}">${t.label} →</button>`).join('')}</span>` : ''}
      </div>`).join('') || '<p class="ph-section-sub">—</p>'}</div>
      ${styles}
      <button class="ph-goto-edit" data-goedit>🎨 Aprender edição de raiz, na secção Edição →</button>`;
  }

  /* ══ VISÃO ══════════════════════════════════════════════════════════════
     A camada criativa do género: porque é que se fotografa aquilo e o que se
     está a tentar dizer. Deliberadamente NÃO fala de equipamento, exposição,
     grelhas nem edição — isso já existe nas outras secções.

     Reescrita para deixar de se ler como artigo. O conteúdo é o mesmo; o que
     mudou foi a ORDEM e o estado inicial de cada peça:

       • o par de fotografias sobe para primeiro lugar (antes vinha depois de
         um parágrafo de quatro linhas, e quem lê num telemóvel raramente
         chegava lá);
       • o "porquê" passa a `<details>` — continua inteiro, mas fechado, para
         quem quer o argumento e não a explicação;
       • o quadro banal→memorável vira toca-para-revelar: a mesma informação,
         mas com uma pergunta de um segundo antes da resposta;
       • o vocabulário visual esconde o significado até ao toque, pela mesma
         razão — uma lista de definições lê-se de enfiada e não se fixa;
       • armadilha, ética e série passam a acordeões: uma linha visível cada.

     Resultado: o ecrã inicial de uma Visão passou de ~15 linhas de texto para
     uma pergunta, duas fotografias e três frases.

     A comparação usa PhotoLearn.compare em modo LADO A LADO por omissão. A
     cortina antiga mostrava metade de cada fotografia, e nestes pares as duas
     imagens não estão alinhadas — a decisão que se quer comparar ficava
     precisamente tapada. A cortina continua disponível no seletor.
     Todos os campos são opcionais — é assim que cada género tem voz própria
     em vez de 28 páginas com o mesmo esqueleto. */
  const visionOf = g => (_DB && _DB.vision && _DB.vision[g.id]) || null;

  /* Géneros que partilham um princípio criativo com este — a ponte para o
     capítulo geral funcionar nos dois sentidos (Parte 8). */
  function visionSiblings(gid, max = 4) {
    if (!_DB || !_DB.principles) return [];
    const seen = new Set([gid]), out = [];
    _DB.principles.forEach(p => {
      if (!(p.genres || []).includes(gid)) return;
      (p.genres || []).forEach(id => {
        if (seen.has(id) || out.length >= max) return;
        const g = _DB.genres.find(x => x.id === id);
        if (!g) return;
        seen.add(id);
        out.push({ go: 'g:' + id, icon: g.icon, label: `${g.name} · ${p.name.toLowerCase()}` });
      });
    });
    return out;
  }

  function visionSectionHTML(g) {
    const v = visionOf(g);
    if (!v) return `<p class="ph-section-sub">A camada de visão deste género ainda não está escrita.</p>`;
    const strong = assetPath('vis-' + g.id), flat = assetPath('vis-' + g.id + '-flat');
    const cmp = v.compare || {};

    const visual = (strong && flat)
      ? PhotoLearn.compare({
          fam: 'visao', mode: 'side', a: strong, b: flat,
          aAlt: 'Exemplo com intenção', bAlt: 'Exemplo tecnicamente correto mas sem intenção',
          /* `neutral` porque as duas fotografias são competentes: marcar a
             segunda com um ✗ vermelho contradiz a legenda logo abaixo
             ("nenhuma diferença aqui é técnica") e ensina o observador a
             ler isto como um erro de execução, que não é. A diferença é
             de DECISÃO, e os marcadores têm de o dizer. */
          neutral: true,
          aTag: 'Com intenção', bTag: 'Sem intenção',
          aWhy: cmp.strong || '', bWhy: cmp.flat || '',
          q: 'Antes de leres: as duas estão bem expostas e focadas. O que é que separa uma da outra?',
          caption: 'Nenhuma diferença aqui é técnica. Todas são decisões.',
          label: 'Comparar a versão com intenção e a versão banal',
        })
      : (strong ? `<figure class="pl-cmp"><div class="pl-frame"><img src="${strong}" alt=""></div></figure>` : '');

    const body = `
      ${v.subject ? `<div class="ph-vis-subject"><b>🎯 Qual é o verdadeiro assunto</b><p>${v.subject}</p></div>` : ''}
      ${(v.gap || []).length ? `<section class="ph-vis-sec">
        <h4>↗️ De banal a memorável</h4>
        <p class="ph-section-sub">Cada linha mostra o hábito. Toca para ver o que se faz em vez disso.</p>
        <div class="pl-revs">${v.gap.map(x => PhotoLearn.reveal({ q: x.ord, a: x.mem })).join('')}</div>
      </section>` : ''}
      ${(v.ask || []).length ? `<section class="ph-vis-sec">
        <h4>❓ Antes de disparar, pergunta</h4>
        <ol class="ph-vis-ask">${v.ask.map(li).join('')}</ol>
      </section>` : ''}
      ${(v.language || []).length ? `<section class="ph-vis-sec">
        <h4>🗣️ Vocabulário visual deste género</h4>
        <p class="ph-section-sub">Cada escolha diz alguma coisa a quem vê. Toca para saber o quê.</p>
        <div class="pl-revs">${v.language.map(x => PhotoLearn.reveal({ q: `<b>${x.n}</b>`, a: x.m })).join('')}</div>
      </section>` : ''}
      ${v.trap ? `<details class="ph-vis-acc trap"><summary><b>🪤 A armadilha deste género</b></summary><p>${v.trap}</p></details>` : ''}
      ${v.ethic ? `<details class="ph-vis-acc ethic"><summary><b>⚖️ A responsabilidade de quem fotografa</b></summary><p>${v.ethic}</p></details>` : ''}
      ${v.series ? `<details class="ph-vis-acc series"><summary><b>🎞️ Pensar em série, não em fotografia</b></summary><p>${v.series}</p></details>` : ''}`;

    const sib = visionSiblings(g.id);
    return PhotoLearn.lesson({
      kicker: v.hook || 'Visão',
      hook: v.lead || '',
      visual,
      more: v.why || '',
      moreLabel: 'Porquê é que isto acontece neste género',
      body,
      /* Um exercício fecha a lição. O primeiro drill do género já existia na
         secção Praticar, mas lá chega-se depois de percorrer tudo — aqui
         aparece no momento em que a intenção acabou de ser explicada, que é
         quando faz diferença. Continua a ser o mesmo texto, não outro. */
      drill: (g.drills || []).length ? PhotoLearn.drill({ key: 'vis-' + g.id, t: g.drills[0] }) : '',
      links: `${PhotoLearn.chips(sib, '🔗 A mesma ideia treina-se também em')}
        <p class="ph-vis-foot">Percebida a intenção, o <b>como</b> está nas secções seguintes: 🎯 Essencial, 👁️ A cena, 💡 Luz, 🖼️ Composição.
          <button class="ph-chip ph-chip-link" data-goprinc>🧠 Princípios transversais a todos os géneros →</button></p>`,
    });
  }

  function portalSectionHTML(g, sec) {
    if (sec === 'visao') return visionSectionHTML(g);
    if (sec === 'essencial') return `${formatBlockHTML(g)}${gearCardHTML(g)}`;
    if (sec === 'cena') return sceneSectionHTML(g);
    if (sec === 'luz') return lightSectionHTML(g);
    if (sec === 'composicao') return `<p class="ph-section-sub">As composições que melhor funcionam neste género. Toca para ver o exemplo e a grelha.</p>${compCardsHTML(g.composition, g.id)}
      ${PhotoLearn.chips(genreCross(g.id, 'tec'), '🧪 Técnicas criativas que costumam entrar aqui')}`;
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
        <button class="ph-field-cta small" data-cscta="${g.id}">
          <span class="ph-field-cta-ico">📋</span>
          <span class="ph-field-cta-txt"><b>Cheatsheet: ${g.name}</b><small>Definições, cena e erros numa página — para consultar com a câmara na mão</small></span>
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
        PhotoLearn.wire(body, plGo);
        panel.querySelector('[data-goprinc]')?.addEventListener('click', () => Nav.go('photography/aprender/visao'));
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
      panel.querySelector('[data-cscta]').addEventListener('click', () => Nav.go('photography/cheatsheets/g/' + g.id));
      window.scrollTo({ top: 0 });
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
  /* Duas imagens diferentes para dois trabalhos diferentes:
       conceptCover — CAPA do cartão. Serve para identificar e para a
                      grelha ler como um sistema; pode ser decorativa.
       conceptImg   — ILUSTRAÇÃO da ficha aberta. Só entra se ENSINAR;
                      caso contrário manda o diagrama procedural, que é
                      o que explica o conceito. Uma capa decorativa a
                      abrir a ficha empurra o conteúdo para fora do ecrã
                      e não acrescenta nada. */
  const conceptCover = id => assetPath('know-' + id) || assetPath('api-k-' + id);
  const conceptImg = id => assetPath('know-' + id);
  function conceptThumb(id) {
    const img = conceptCover(id);
    if (img) return `<span class="ph-vis ph-photo-thumb"><img loading="lazy" decoding="async" alt="" src="${img}"></span>`;
    const g = galleryItems(id);
    if (g) return `<span class="ph-vis ph-photo-thumb"><img loading="lazy" decoding="async" alt="" src="${g[1].src}"></span>`;
    return svgThumb(id);
  }
  function conceptDetailHTML(t, sections) {
    const img = conceptImg(t.id), g = galleryItems(t.id);
    const diagram = (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(t.id))
      ? `<div class="ph-detail-art">${PhotoIllus.svg(t.id)}</div>` : '';
    // O diagrama vem à frente da fotografia decorativa: aqui o que se
    // quer é a explicação, não a capa.
    const art = diagram
      || (img ? `<div class="ph-detail-art ph-photo-art"><img loading="lazy" decoding="async" alt="" src="${img}"></div>` : '')
      || (g ? `<div class="ph-detail-art ph-photo-art">${galleryHTML(g)}</div>` : '');
    return `<button class="ph-detail-close" aria-label="Fechar">✕</button>
      <div class="ph-detail-head"><span class="ph-detail-ico">${t.icon || ''}</span><h3 class="ph-detail-title">${t.name}</h3></div>
      ${art}<div class="ph-detail-body">${sections}</div>`;
  }
  // Grelha expansível reutilizável (mata os modais de Aprender): ao clicar num
  // cartão abre um painel inline em largura total logo a seguir a esse cartão.
  /* `opt.split` — em ecrã largo, lista à esquerda e ficha à direita, com a
     ficha colada ao topo. O padrão anterior (ficha inserida a seguir ao
     cartão) empurrava os restantes itens para baixo da ficha inteira: com
     seis câmaras na grelha, abrir a primeira escondia as outras cinco.
     Em ecrã estreito não há espaço para duas colunas e mantém-se o
     acordeão, que aí é o comportamento certo. */
  const SPLIT_MQ = '(min-width: 1000px)';
  function expandableGrid(box, items, opt) {
    const split = !!opt.split;
    box.innerHTML = `${opt.head || ''}${split
      ? `<div class="ph-md"><div class="ph-md-list"><div class="ph-learn-grid${opt.compact ? ' compact' : ''}"></div></div><div class="ph-md-detail"></div></div>`
      : `<div class="ph-learn-grid${opt.compact ? ' compact' : ''}"></div>`}`;
    const grid = box.querySelector('.ph-learn-grid');
    const host = box.querySelector('.ph-md-detail');
    const wide = () => split && window.matchMedia(SPLIT_MQ).matches;
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
      const th = opt.compact ? '' : opt.thumb(t);
      card.className = 'ph-learn-card' + (opt.compact ? ' compact' : th ? '' : ' no-art');
      card.setAttribute('aria-expanded', 'false');
      // `compact` omite o bloco da miniatura em vez de o deixar vazio: reservar
      // um 21:10 só para centrar um emoji dava cartões altos e ocos.
      card.innerHTML = `${opt.compact ? '' : `<span class="ph-learn-thumb">${th || `<span class="ph-learn-ico">${t.icon || '📷'}</span>`}</span>`}
        <span class="ph-learn-info"><span class="ph-learn-name">${t.icon ? t.icon + ' ' : ''}${t.name}</span>
        <span class="ph-scn-blurb-sm">${opt.blurb(t)}</span></span><span class="ph-learn-caret" aria-hidden="true"></span>`;
      card.addEventListener('click', () => {
        if (sel === t) { close(); return; }
        sel = t;
        grid.querySelectorAll('.ph-learn-card').forEach(c => { const on = c === card; c.classList.toggle('active', on); c.setAttribute('aria-expanded', on); });
        detail.innerHTML = opt.detail(t);
        if (wide()) host.appendChild(detail); else card.after(detail);
        detail.hidden = false;
        if (typeof PhotoIllus !== 'undefined') PhotoIllus.wire(detail);
        opt.afterOpen && opt.afterOpen(detail, t);
        detail.querySelector('.ph-detail-close')?.addEventListener('click', () => { close(); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
        // Em coluna dupla a ficha já está à vista: rolar até ela salta a página sem razão.
        if (!wide()) requestAnimationFrame(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
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
  let _editSec = null, _editTool = null, _fitBound = false;

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

    // Duas colunas em todas as famílias menos "pair" (essa já são três
    // miniaturas lado a lado — encolhê-las para meia largura não ensinava
    // nada). A demonstração e a orientação prática lêem-se em conjunto.
    const body = layout !== 'pair'
      ? `<div class="ph-tgrid"><div class="ph-tgrid-demo">${demo}</div>
         <div class="ph-tgrid-guide">${cols}</div></div>${more}`
      : `${demo}${cols}${more}`;

    return `<article class="ph-tool ph-tool-${layout}" data-tool-id="${t.id}">
      ${head}${quick}${body}${rel}${gen}${appsTableHTML(t)}
    </article>`;
  }

  /* ── ocupar a folga vertical ─────────────────────────────────────────
     A ficha são duas colunas de alturas diferentes, e a mais curta é quase
     sempre a da demonstração: sobrava uma goteira vazia por baixo da
     fotografia enquanto a orientação continuava ao lado.

     Em vez de afinar mais um número à mão por família, a fotografia cresce
     até consumir a folga — limitada ao dobro do valor da família, senão as
     fichas de orientação longa voltavam a virar um ecrã inteiro de foto.
     Converge em passagens porque, ao crescer em altura, a imagem também
     cresce em largura e pode bater no limite da coluna antes de fechar a
     folga — nesse caso pára onde estiver, sem ciclo infinito. */
  function fitStage(article) {
    const grid = article && article.querySelector('.ph-tgrid');
    if (!grid) return;
    const demo = grid.querySelector('.ph-tgrid-demo');
    const guide = grid.querySelector('.ph-tgrid-guide');
    // A coluna da demonstração é esticada pela grelha, por isso a folga não se
    // mede entre colunas: mede-se entre a coluna e o que está lá dentro.
    const inner = demo && demo.querySelector('.ph-tool-demo');
    if (!demo || !guide || !inner || !demo.querySelector('.el-canvas')) return;

    if (!article.dataset.stageBase) {
      article.dataset.stageBase =
        parseFloat(getComputedStyle(article).getPropertyValue('--stage-h')) || 200;
    }
    const base = +article.dataset.stageBase;
    article.style.setProperty('--stage-h', base + 'px');
    // empilhado (ecrã estreito): as colunas partilham a esquerda, não há folga
    if (Math.abs(demo.offsetLeft - guide.offsetLeft) < 2) return;

    let h = base;
    for (let i = 0; i < 4; i++) {
      const slack = demo.offsetHeight - inner.offsetHeight;
      if (slack < 16) break;
      const next = Math.min(base * 2, h + slack);
      if (next - h < 1) break;
      h = next;
      article.style.setProperty('--stage-h', Math.round(h) + 'px');
    }

    // A largura do histograma acompanha a coluna; um "input" falso põe a
    // demonstração a redesenhar-se na resolução nova, sem mexer nos valores.
    const cv = article.querySelector('.el-histo-cv');
    if (cv) {
      const r = cv.getBoundingClientRect();
      if (Math.round(r.width) !== cv.width || Math.round(r.height) !== cv.height)
        article.querySelectorAll('.el-range').forEach(x => x.dispatchEvent(new Event('input')));
    }
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
        <h2 class="ph-section-title">🎨 Edição</h2>
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
          // A folga só se mede depois de a fotografia estar pintada e de o
          // navegador ter feito o layout com ela lá dentro. Reajusta-se a
          // ficha inteira porque a primeira de cada secção chega a ser
          // medida antes de a página assentar (tipos de letra, miniaturas).
          if (demo) EditLab.mount(host, demo, img)
            .then(() => requestAnimationFrame(() =>
              panel.querySelectorAll('.ph-tool').forEach(fitStage)));
        };
        if ('IntersectionObserver' in window) {
          const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { mountOne(e.target); io.unobserve(e.target); } }), { rootMargin: '250px' });
          hosts.forEach(h => io.observe(h));
        } else hosts.forEach(mountOne);
      } else {
        hosts.forEach(h => { h.innerHTML = '<p class="el-loading">Demonstração indisponível.</p>'; });
      }

      // A folga depende da largura: ao redimensionar, as colunas mudam de
      // altura (e abaixo de 900px empilham, onde não há folga nenhuma).
      if (!_fitBound) {
        _fitBound = true;
        let t = 0;
        window.addEventListener('resize', () => {
          clearTimeout(t);
          t = setTimeout(() => document.querySelectorAll('.ph-tool').forEach(fitStage), 160);
        });
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
  /* Qual dos sensores da comparação é o do item aberto. Sem isto a mesma
     ilustração aparecia em cinco fichas sem dizer qual delas era. */
  const EQ_SENSOR_HL = { phone: 'phone', 'phone-hdr': 'phone', apsc: 'apsc', ff: 'ff', mft: 'mft', compact: 'one' };
  const eqIllus = it => {
    const id = EQ_ILLUS[it.id] || ('eq-' + it.id);
    if (typeof PhotoIllus === 'undefined' || !PhotoIllus.has(id)) return null;
    return { id, opts: id === 'eq-sensors' ? { hl: EQ_SENSOR_HL[it.id] || null } : null };
  };
  function eqDetailHTML(it) {
    const sec = (t, cls, arr) => (arr && arr.length)
      ? `<div class="ph-eq-sec ${cls}"><b>${t}</b><ul>${arr.map(li).join('')}</ul></div>` : '';
    const vid = eqIllus(it);
    const vis = vid ? `<div class="ph-detail-art">${PhotoIllus.svg(vid.id, vid.opts)}</div>` : '';
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
        ${resolveLinks(it.links, '🔗 Onde é que isto se usa')}
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
        <h2 class="ph-section-title">🎒 Equipamento</h2>
        <p class="ph-section-sub">Conceitos que continuam válidos daqui a dez anos, sem marcas nem modelos. Cada item explica o problema que resolve — e quando não vale a pena.</p>
        <div class="ph-secnav" role="tablist" aria-label="Categorias de equipamento">
          ${cats.map(c => `<button class="ph-secnav-btn${c.id === cat.id ? ' active' : ''}" role="tab" aria-selected="${c.id === cat.id}" data-eqcat="${c.id}">${c.icon} ${c.name}</button>`).join('')}
        </div>
        <p class="ph-eq-intro">${cat.intro}</p>
        ${assetPath('eqi-' + cat.id)
          ? `<div class="ph-eq-hero ph-eq-hero-img"><img loading="lazy" decoding="async" alt="" src="${assetPath('eqi-' + cat.id)}"></div>`
          : (typeof PhotoIllus !== 'undefined' && PhotoIllus.has(cat.visual))
            ? `<div class="ph-eq-hero">${PhotoIllus.svg(cat.visual)}</div>` : ''}
        <div id="ph-eq-body"></div>
        <div class="ph-eq-mine" id="ph-eq-mine"></div>`;
      const body = panel.querySelector('#ph-eq-body');
      expandableGrid(body, cat.items, {
        // Cartões compactos de propósito. As ilustrações são por FAMÍLIA, não
        // por item: em 4 das 7 categorias os cartões mostravam todos exatamente
        // a ilustração do hero que está logo acima, e a 275×130 as legendas nem
        // se leem. A ilustração continua onde ensina — grande no hero e grande
        // na ficha aberta; a grelha passa a caber de uma vez no ecrã.
        compact: true,
        split: true,
        thumb: () => '',
        blurb: it => it.tag || '',
        detail: eqDetailHTML,
        afterOpen: detail => PhotoLearn.wire(detail, plGo),
      });
      // O equipamento pessoal fica no fim e claramente separado: é exemplo, não norma.
      if (cat.id === 'cameras' && db.mine) {
        panel.querySelector('#ph-eq-mine').innerHTML = `
          <h2 class="ph-section-title" style="margin-top:1.5rem">🎒 ${db.mine.label}</h2>
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

  /* Resolve uma lista de alvos ("tool:dof", "tec:movimento", "g:retrato") em
     chips com o nome certo, procurado no DB em runtime. Os dados guardam só o
     id — assim renomear uma técnica não obriga a caçar strings pelos JSON. */
  const LINK_ICO = { edicao: '🎨', etool: '🎨', tool: '🧮', know: '📖', apr: '📚', comp: '🖼️' };
  function resolveLinks(list, head) {
    if (!(list || []).length || !_DB) return '';
    const out = [];
    list.forEach(spec => {
      const i = String(spec).indexOf(':');
      const kind = spec.slice(0, i), id = spec.slice(i + 1);
      let label = null, icon = LINK_ICO[kind] || '';
      if (kind === 'g') { const g = (_DB.genres || []).find(x => x.id === id); if (g) { label = g.name; icon = g.icon; } }
      else if (kind === 'look') { const l = (_DB.looks || []).find(x => x.id === id); if (l) { label = l.name; icon = l.icon; } }
      else if (kind === 'tec') { const t = (_DB.techniques || []).find(x => x.id === id); if (t) { label = t.name; icon = t.icon; } }
      else if (kind === 'know') { const k = (_DB.know || []).find(x => x.id === id); if (k) { label = k.name; icon = k.icon || '📖'; } }
      else if (kind === 'tool') { label = TOOL_META[id] && TOOL_META[id].label; }
      else if (kind === 'etool') { const t = editToolIndex()[id]; label = t ? 'Edição · ' + t.tool.name : null; }
      else if (kind === 'edicao') { label = 'Secção Edição'; }
      else if (kind === 'comp') { label = id; }
      if (label) out.push({ go: kind === 'edicao' ? 'edicao' : spec, icon, label });
    });
    return PhotoLearn.chips(out, head);
  }

  /* O fator de crop dependia de um corpo concreto (1.6×) apesar de existir um
     seletor de câmara que o resto do portal respeita: quem escolhia Full Frame
     continuava a ler a matemática de um APS-C. Agora o bloco é escrito a
     partir da classe escolhida, com os dados que o gear.json já tinha. */
  function cropSectionHTML() {
    const c = classDef();
    if (!c) return '';
    return `<div class="ph-know-sec"><h4>${c.icon} Fator de crop — ${c.name}</h4>
      <p><b>${c.crop}</b> · ${c.focals}</p>
      <p class="ph-know-scope">Estás a ver os números de <b>${c.name}</b>. Troca a câmara acima para os do teu sistema — a focal equivalente é a única linguagem que se traduz entre formatos.</p></div>`;
  }

  /* ── princípios que não cabem num par ────────────────────────────────────
     Ambiguidade, série e honestidade resistiam a A/B, e forçá-los a um par
     ensinaria o contrário do que dizem: que há um lado certo. Cada um recebe
     a forma que a lição pede.
       steps   — ambiguidade: o significado só muda porque entra mais contexto,
                 e isso é um percurso, não uma oposição.
       strip   — série: o que se ensina é a relação entre as fotografias, e ela
                 desaparece se elas forem vistas uma de cada vez.
       compare — honestidade: dois enquadramentos honestos do mesmo
                 acontecimento. É um par, mas NEUTRO: nenhum dos dois mente. */
  function principleSequenceHTML(sq) {
    if (sq.mode === 'compare') {
      const a = assetPath(sq.a), b = assetPath(sq.b);
      if (!a || !b) return '';
      return PhotoLearn.compare({
        fam: 'principio', mode: 'side', modes: ['side', 'flip'], neutral: !!sq.neutral,
        a, b, aTag: sq.aTag, bTag: sq.bTag, aWhy: sq.aWhy, bWhy: sq.bWhy,
        aAlt: sq.aTag, bAlt: sq.bTag, q: sq.q, caption: sq.caption,
      }) + (sq.after ? `<div class="pl-seq-after">${sq.after}</div>` : '');
    }
    const items = (sq.items || []).map(it => Object.assign({}, it, { src: assetPath(it.src) }))
      .filter(it => it.src);
    if (!items.length) return '';
    return PhotoLearn.sequence({ mode: sq.mode, q: sq.q, nextLabel: sq.nextLabel, items, after: sq.after });
  }

  const APR_HEAD = `<h2 class="ph-section-title">📖 Fundamentos</h2>
    <p class="ph-section-sub">Como a fotografia funciona tecnicamente. Cada conceito abre com uma ilustração e termina com onde o vais usar.</p>`;
  function buildFundamentos(box) {
    box.innerHTML = `${APR_HEAD}<div class="ph-learn-grid"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      if (!db) { const g = box.querySelector('.ph-learn-grid'); if (g) g.innerHTML = `<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; return; }
      const head = `${APR_HEAD}${contextBarHTML()}`;
      const secHTML = s => (s.dyn === 'crop' ? cropSectionHTML()
        : `<div class="ph-know-sec"><h4>${s.h}</h4><p>${s.t}</p></div>`);
      const grid = expandableGrid(box, db.know, {
        head, split: true,
        thumb: t => conceptThumb(t.id),
        blurb: t => t.blurb,
        detail: t => conceptDetailHTML(t,
          t.body.map(secHTML).join('') + resolveLinks(t.links, '🔗 E agora — onde é que isto se usa')),
        afterOpen: detail => PhotoLearn.wire(detail, plGo),
      });
      wireContextBar(box, () => buildFundamentos(box));
      openPending(box, 'fundamentos', db.know, grid);
    });
  }

  /* ── Aprender ▸ Visão: os princípios criativos transversais ───────────────
     A Visão de cada género responde "porque é que se fotografa ISTO". Estes
     princípios são a camada acima: as decisões que se repetem em todos os
     géneros (intenção, subtração, escala, momento, ambiguidade, série…).
     Cada princípio liga aos géneros onde mais se treina — é a ponte entre o
     capítulo geral e a prática concreta. */
  const APR_VIS_HEAD = `<h2 class="ph-section-title">🧠 Visão</h2>
    <p class="ph-section-sub">Os princípios criativos que valem em qualquer género — o que se decide antes de haver definições. Cada um liga aos géneros onde melhor se treina.</p>`;
  function buildVisaoAprender(box) {
    box.innerHTML = `${APR_VIS_HEAD}<div class="ph-learn-grid"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      const fail = () => { const g = box.querySelector('.ph-learn-grid'); if (g) g.innerHTML = `<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; };
      if (!db || !(db.principles || []).length) return fail();
      const named = id => (db.genres.find(x => x.id === id) || {});
      expandableGrid(box, db.principles, {
        head: APR_VIS_HEAD, split: true,
        thumb: p => { const src = assetPath(p.thumb); return src ? `<span class="ph-vis ph-learn-art"><img loading="lazy" decoding="async" alt="" src="${src}"></span>` : ''; },
        blurb: p => p.blurb,
        detail: p => {
          const src = assetPath(p.thumb);
          const chips = (p.genres || []).map(id => {
            const g = named(id);
            return g.name ? `<button class="ph-chip ph-chip-link" data-vgenre="${id}">${g.icon} ${g.name} →</button>` : '';
          }).join('');
          /* Cada princípio ganhou o SEU par de fotografias (Parte 2). Antes
             havia só a imagem do género que servia de exemplo, e o princípio
             ficava por explicar em texto; agora a diferença que ele descreve
             está lá para ser vista antes de ser lida. Quem não tem par
             (série, ética, ambiguidade — ideias que não cabem em duas
             imagens) mantém a fotografia única. */
          const c = p.compare, a = c && assetPath(c.a), b = c && assetPath(c.b);
          const art = p.sequence ? principleSequenceHTML(p.sequence)
            : (a && b)
            ? PhotoLearn.compare({
                fam: 'principio', mode: c.mode || 'side', a, b, ar: c.ar,
                aTag: c.aTag, bTag: c.bTag, aWhy: c.aWhy, bWhy: c.bWhy,
                caption: c.caption, aAlt: c.aTag, bAlt: c.bTag,
              })
            : (src ? `<div class="ph-detail-art ph-photo-art"><img loading="lazy" decoding="async" alt="" src="${src}"></div>` : '');
          return `<button class="ph-detail-close" aria-label="Fechar">✕</button>
            <div class="ph-detail-head"><span class="ph-detail-ico">${p.icon}</span><h3 class="ph-detail-title">${p.name}</h3></div>
            ${art}
            <div class="ph-detail-body">
              ${p.body.map(x => `<div class="ph-know-sec"><h4>${x.h}</h4><p>${x.t}</p></div>`).join('')}
              ${chips ? `<div class="ph-know-sec"><h4>🎯 Treina-se sobretudo em</h4><div class="ph-chips">${chips}</div></div>` : ''}
            </div>`;
        },
        afterOpen: detail => {
          PhotoLearn.wire(detail, plGo);
          detail.querySelectorAll('[data-vgenre]').forEach(b =>
            b.addEventListener('click', () => { _portalSec = 'visao'; Nav.go('photography/g/' + b.dataset.vgenre); }));
        },
      });
    });
  }

  /* ══ APRENDER ▸ ESTILOS ══════════════════════════════════════════════════
     Um estilo visual descrito por escrito é uma lista de adjetivos ("quente",
     "contrastado", "cinematográfico") que não ensina nada — cada leitor
     imagina uma imagem diferente. Aqui a receita é aplicada AOS PÍXEIS pelo
     PhotoLab: mexe-se na dose e vê-se o estilo a nascer.

     A troca da fotografia de base é a parte deliberadamente educativa: os
     campos "onde funciona" e "quando se gasta" deixam de ser avisos escritos
     e passam a ser demonstráveis — aplicar Noir a uma praia ao meio-dia
     explica o limite melhor do que qualquer parágrafo. */
  const APR_LOOK_HEAD = `<h2 class="ph-section-title">🎨 Estilos</h2>
    <p class="ph-section-sub">Os looks que se reconhecem à distância — porque existem, o que dizem a quem vê e que decisões os criam. Cada um aplica-se ao vivo: mexe na dose e troca a fotografia para ver onde funciona e onde falha.</p>`;

  function lookBases(item, db) {
    const wanted = (item.bases || []).length ? item.bases : (db.lookBases || []).map(b => b.id);
    const label = id => ((db.lookBases || []).find(b => b.id === id) || {}).label || id;
    return wanted.map(id => ({ src: assetPath(id), label: label(id) })).filter(b => b.src);
  }

  function buildEstilos(box) {
    box.innerHTML = `${APR_LOOK_HEAD}<div class="ph-learn-grid"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      const fail = () => { const g = box.querySelector('.ph-learn-grid'); if (g) g.innerHTML = `<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; };
      if (!db || !(db.looks || []).length) return fail();
      // uma base comum para todas as miniaturas: assim a grelha compara
      // estilos e não fotografias (ver PhotoLearn.paintThumb)
      const swatch = assetPath('look-retrato') || (lookBases(db.looks[0], db)[0] || {}).src;
      const grid = expandableGrid(box, db.looks, {
        head: APR_LOOK_HEAD, split: true,
        thumb: () => (swatch ? `<span class="ph-vis ph-photo-thumb"><canvas class="ph-look-thumb"></canvas></span>` : ''),
        blurb: l => l.blurb,
        detail: l => lookDetailHTML(l, db),
        afterCard: (card, l) => PhotoLearn.paintThumb(card.querySelector('.ph-look-thumb'), swatch, l.recipe),
        afterOpen: detail => PhotoLearn.wire(detail, plGo),
      });
      openPending(box, 'estilos', db.looks, grid);
    });
  }

  /* O mesmo esqueleto serve estilos e técnicas: as duas respondem às mesmas
     perguntas (o que diz, quando usar, quando evitar) e só mudam na
     demonstração. Manter uma função é o que garante que continuam a
     responder às mesmas perguntas quando alguém acrescentar entradas. */
  function lookDetailHTML(l, db) {
    const bases = lookBases(l, db);
    const demo = bases.length
      ? PhotoLearn.look({ name: l.name, recipe: l.recipe, ingredients: l.ingredients, bases })
      : '<p class="ph-section-sub">Sem fotografia de base para demonstrar este estilo.</p>';
    return `<button class="ph-detail-close" aria-label="Fechar">✕</button>
      <div class="ph-detail-head"><span class="ph-detail-ico">${l.icon}</span><h3 class="ph-detail-title">${l.name}</h3></div>
      ${PhotoLearn.lesson({
        kicker: 'Estilo',
        hook: l.hook,
        idea: l.idea,
        visual: demo,
        more: l.why,
        moreLabel: 'De onde é que este estilo veio',
        body: `<div class="ph-look-grid">
            <div class="ph-info-card says"><b>🗣️ O que comunica</b><p>${l.says}</p></div>
            <div class="ph-info-card works"><b>✅ Onde resulta</b><p>${l.works}</p></div>
            <div class="ph-info-card over"><b>🪤 Quando se gasta</b><p>${l.overused}</p></div>
          </div>
          <section class="ph-vis-sec"><h4>🔧 As decisões que o criam</h4>
            <ul class="ph-do">${(l.decisions || []).map(li).join('')}</ul></section>`,
        links: crossChips(l, db),
      })}`;
  }

  /* ══ APRENDER ▸ TÉCNICAS ═════════════════════════════════════════════════
     Duas famílias com demonstrações diferentes, e é essa a razão de existir
     a distinção: uma técnica de revelação prova-se a mexer nos píxeis, uma
     técnica de captação só se prova com duas fotografias, porque a decisão
     foi tomada antes de haver ficheiro. Todas respondem a "o que é que isto
     comunica" antes de dizerem como se faz — é o que separa esta secção da
     secção Edição, que ensina os controlos. */
  const APR_TEC_HEAD = `<h2 class="ph-section-title">🧪 Técnicas</h2>
    <p class="ph-section-sub">O que cada técnica DIZ a quem vê, e não só que cursor a produz. As de revelação aplicam-se aqui mesmo; as de captação comparam-se com o par de fotografias que as separa.</p>`;

  function buildTecnicas(box) {
    box.innerHTML = `${APR_TEC_HEAD}<div class="ph-learn-grid"><p class="ph-section-sub">A carregar…</p></div>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      const fail = () => { const g = box.querySelector('.ph-learn-grid'); if (g) g.innerHTML = `<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; };
      if (!db || !(db.techniques || []).length) return fail();
      /* As de captação já têm a sua fotografia; as de revelação não têm nada
         para mostrar sem passar pelo motor — a miniatura é gerada com a
         receita, senão a grelha mostrava a mesma imagem crua sete vezes. */
      const swatch = assetPath('look-retrato');
      const capSrc = t => (t.compare && assetPath(t.compare.a)) || (t.single && assetPath(t.single.src));
      const grid = expandableGrid(box, db.techniques, {
        head: APR_TEC_HEAD, split: true,
        thumb: t => {
          if (t.kind === 'revelacao') return swatch ? `<span class="ph-vis ph-photo-thumb"><canvas class="ph-look-thumb"></canvas></span>` : '';
          const s = capSrc(t);
          return s ? `<span class="ph-vis ph-photo-thumb"><img loading="lazy" decoding="async" alt="" src="${s}"></span>` : '';
        },
        blurb: t => t.blurb,
        detail: t => tecDetailHTML(t, db),
        afterCard: (card, t) => {
          if (t.kind !== 'revelacao') return;
          const src = (lookBases(t, db)[0] || {}).src || swatch;
          PhotoLearn.paintThumb(card.querySelector('.ph-look-thumb'), src, t.recipe);
        },
        afterOpen: detail => PhotoLearn.wire(detail, plGo),
      });
      openPending(box, 'tecnicas', db.techniques, grid);
    });
  }

  function tecDetailHTML(t, db) {
    let demo = '';
    if (t.kind === 'revelacao') {
      const bases = lookBases(t, db);
      demo = bases.length
        ? PhotoLearn.look({ name: t.name, recipe: t.recipe, ingredients: t.ingredients, bases })
        : '';
    } else if (t.compare) {
      const a = assetPath(t.compare.a), b = assetPath(t.compare.b);
      if (a && b) demo = PhotoLearn.compare({
        fam: 'tecnica', mode: t.compare.mode || 'side', a, b,
        aTag: t.compare.aTag, bTag: t.compare.bTag,
        aWhy: t.compare.aWhy, bWhy: t.compare.bWhy,
        aAlt: t.compare.aTag, bAlt: t.compare.bTag,
        caption: t.compare.caption,
      });
    }
    if (!demo && t.single) {
      const s = assetPath(t.single.src);
      if (s) demo = `<figure class="pl-cmp"><div class="pl-frame"><img src="${s}" alt="" loading="lazy"></div>
        <figcaption class="pl-cap">${t.single.caption || ''}</figcaption></figure>`;
    }
    return `<button class="ph-detail-close" aria-label="Fechar">✕</button>
      <div class="ph-detail-head"><span class="ph-detail-ico">${t.icon}</span><h3 class="ph-detail-title">${t.name}</h3>
        <span class="ph-eq-tag">${t.kind === 'revelacao' ? 'revelação' : 'captação'}</span></div>
      ${PhotoLearn.lesson({
        kicker: 'Técnica',
        hook: t.hook,
        idea: t.idea,
        visual: demo,
        body: `<div class="ph-look-grid">
            <div class="ph-info-card says"><b>🗣️ O que comunica</b><p>${t.says}</p></div>
            <div class="ph-info-card works"><b>✅ Quando usar</b><p>${t.when}</p></div>
            <div class="ph-info-card over"><b>🪤 Quando falha</b><p>${t.avoid}</p></div>
          </div>`,
        drill: t.drill ? PhotoLearn.drill({ key: 'tec-' + t.id, t: t.drill }) : '',
        links: crossChips(t, db),
      })}`;
  }

  /* ══ APRENDER ▸ LER FOTOGRAFIAS ══════════════════════════════════════════
     O portal ensinava a fazer e nunca a olhar, e são coisas diferentes: quem
     não sabe dizer porque é que uma fotografia funciona repete o que resultou
     por acaso. Aqui a leitura é feita a apontar (fotografia anotada), a
     escolher (qual é a mais forte) e a cortar — nunca a ler uma análise
     escrita, que seria exactamente o erro que esta secção quer corrigir.

     Os exercícios de escolha são GERADOS a partir dos pares de vision.json:
     28 géneros já têm o par memorável/banal e a explicação de cada lado, por
     isso duplicá-los aqui só criaria duas versões da mesma frase para manter. */
  const APR_LER_HEAD = `<h2 class="ph-section-title">🔍 Ler fotografias</h2>
    <p class="ph-section-sub">Perceber porque é que uma fotografia funciona ensina mais depressa do que tirar outra. Aqui aponta-se, escolhe-se e corta-se — não se lê uma análise.</p>`;

  let _lerSeed = 0;
  function buildLer(box) {
    box.innerHTML = `${APR_LER_HEAD}<p class="ph-section-sub">A carregar…</p>`;
    Promise.all([loadDB(), loadAssets()]).then(([db]) => {
      if (!db || !db.readMethod) { box.innerHTML = `${APR_LER_HEAD}<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; return; }
      const m = db.readMethod, demo = m.demo || {}, dsrc = assetPath(demo.src);
      /* O método era enunciado antes de haver uma fotografia no ecrã: ~470
         palavras de leitura corrida a abrir precisamente a secção cujo
         argumento é «não leias uma análise, olha». Passa a ser demonstrado —
         as mesmas cinco perguntas, feitas sobre uma imagem concreta, com a
         resposta escondida até ao toque. A lista genérica continua completa,
         mas fechada: é referência, não introdução. */
      const walk = dsrc ? `<div class="ph-read-walk">
          <figure class="ph-read-walk-img">
            <img src="${dsrc}" alt="${demo.alt || ''}" loading="lazy" decoding="async">
            <figcaption>${demo.intro || ''}</figcaption>
          </figure>
          <div class="ph-read-walk-qs">
            <div class="pl-revs">${(demo.answers || []).map((a, i) =>
              PhotoLearn.reveal({ q: `<b>${i + 1}.</b> ${a.q}`, a: a.a })).join('')}</div>
            ${demo.close ? `<p class="ph-read-walk-close">${demo.close}</p>` : ''}
          </div>
        </div>` : '';
      box.innerHTML = `${APR_LER_HEAD}
        <section class="ph-read-method">
          ${PhotoLearn.lesson({
            kicker: 'O método',
            hook: m.hook,
            visual: walk,
            body: `<details class="pl-more"><summary>As cinco perguntas, por extenso</summary><div>
              <p>${m.idea}</p>
              <ol class="ph-read-steps">${m.steps.map(s =>
                `<li><b>${s.q}</b><span>${s.t}</span></li>`).join('')}</ol></div></details>`,
            takeaway: m.takeaway,
            drill: PhotoLearn.drill({ key: 'ler-metodo', t: m.drill }),
          })}
        </section>
        <h3 class="ph-section-title sub">🔬 Fotografias para analisar</h3>
        <p class="ph-section-sub">Cada uma esconde as suas decisões atrás de pontos. Responde à pergunta antes de os tocar.</p>
        <div class="ph-learn-grid" data-analyses></div>
        <h3 class="ph-section-title sub">✂️ Treinar o corte</h3>
        <p class="ph-section-sub">A mesma fotografia com cortes diferentes é outra fotografia. Escolhe e vê o que fica.</p>
        <div data-crops></div>
        <h3 class="ph-section-title sub">👁️ Treinar o olho</h3>
        <p class="ph-section-sub">Duas fotografias do mesmo género: uma com intenção, outra tecnicamente correta. Escolhe antes de ver a resposta.</p>
        <div data-eye></div>`;

      buildAnalyses(box, db);
      box.querySelector('[data-crops]').innerHTML = (db.readCrops || []).map(c => {
        const src = assetPath(c.src);
        return src ? `<div class="ph-read-crop"><h4>${c.name}</h4>${PhotoLearn.crop({ src, q: c.q, options: c.options })}</div>` : '';
      }).join('');
      buildEyeTrainer(box, db);
      PhotoLearn.wire(box, plGo);
    });
  }

  /* As análises usam a mesma grelha expansível do resto do Aprender: abrir
     uma de cada vez é o que impede a secção de virar uma parede de imagens. */
  function buildAnalyses(box, db) {
    const host = box.querySelector('[data-analyses]');
    if (!host) return;
    const holder = document.createElement('div');
    host.replaceWith(holder);
    expandableGrid(holder, (db.readAnalyses || []).filter(a => assetPath(a.src)), {
      head: '', split: true,
      thumb: a => `<span class="ph-vis ph-photo-thumb"><img loading="lazy" decoding="async" alt="" src="${assetPath(a.src)}"></span>`,
      blurb: a => a.blurb,
      detail: a => `<button class="ph-detail-close" aria-label="Fechar">✕</button>
        <div class="ph-detail-head"><span class="ph-detail-ico">${a.icon}</span><h3 class="ph-detail-title">${a.name}</h3>
          <span class="ph-eq-tag">${a.lesson}</span></div>
        ${PhotoLearn.hotspots({ src: assetPath(a.src), alt: a.name, q: a.q, pins: a.pins })}
        <p class="pl-takeaway"><b>O que isto ensina</b> ${a.verdict}</p>
        ${crossChips(a, db)}`,
      afterOpen: detail => PhotoLearn.wire(detail, plGo),
    });
  }

  /* Treinar o olho: um par por vez, sorteado entre os géneros que têm as duas
     imagens. O botão "outra" é o que transforma isto num treino em vez de
     um exemplo — a repetição é a única coisa que educa o olho. */
  function buildEyeTrainer(box, db) {
    const host = box.querySelector('[data-eye]');
    if (!host) return;
    const pool = (db.genres || []).filter(g => {
      const v = (db.vision || {})[g.id];
      return v && v.compare && assetPath('vis-' + g.id) && assetPath('vis-' + g.id + '-flat');
    });
    if (!pool.length) { host.remove(); return; }
    const render = () => {
      const g = pool[_lerSeed++ % pool.length];
      const v = db.vision[g.id];
      // a ordem alterna para a resposta não ser sempre a da esquerda
      const strong = { src: assetPath('vis-' + g.id), label: 'A', ok: true, why: v.compare.strong, alt: 'Opção A' };
      const flat = { src: assetPath('vis-' + g.id + '-flat'), label: 'B', ok: false, why: v.compare.flat, alt: 'Opção B' };
      const opts = (_lerSeed % 2) ? [flat, strong] : [strong, flat];
      opts.forEach((o, i) => { o.label = String.fromCharCode(65 + i); });
      host.innerHTML = `<div class="ph-eye-card">
          <p class="ph-eye-genre">${g.icon} ${g.name}</p>
          ${PhotoLearn.pick({
            q: 'Qual destas tem uma ideia por trás?',
            options: opts,
            after: `${v.hook ? `<b>${v.hook}.</b> ` : ''}${v.subject || ''}`,
          })}
          <div class="ph-eye-actions">
            <button type="button" class="ph-chip ph-chip-link" data-again>🔁 Outro par</button>
            <button type="button" class="ph-chip ph-chip-link" data-go="g:${g.id}">${g.icon} Ver a Visão de ${g.name} →</button>
          </div>
        </div>`;
      PhotoLearn.wire(host, plGo);
      host.querySelector('[data-again]').addEventListener('click', render);
    };
    render();
  }

  /* Chips de ligação partilhados por estilos, técnicas e análises: cada
     lição diz sempre onde é que a mesma ideia volta a aparecer. */
  function crossChips(item, db) {
    const out = [];
    (item.genres || []).forEach(id => {
      const g = (db.genres || []).find(x => x.id === id);
      if (g) out.push({ go: 'g:' + id, icon: g.icon, label: g.name });
    });
    (item.looks || []).forEach(id => {
      const l = (db.looks || []).find(x => x.id === id);
      if (l) out.push({ go: 'look:' + id, icon: l.icon, label: l.name });
    });
    (item.techniques || []).forEach(id => {
      const t = (db.techniques || []).find(x => x.id === id);
      if (t) out.push({ go: 'tec:' + id, icon: t.icon, label: t.name });
    });
    if (item.comp) out.push({ go: 'comp:' + item.comp, icon: '🖼️', label: item.comp });
    /* `know` aponta para a explicação canónica em Fundamentos. Existe para que
       uma técnica possa dizer "a teoria disto está ali" em vez de a repetir —
       foi assim que a profundidade deixou de ser ensinada em dois sítios. */
    if (item.know) {
      const k = (db.know || []).find(x => x.id === item.know);
      if (k) out.push({ go: 'know:' + item.know, icon: '📖', label: 'Fundamentos · ' + k.name });
    }
    if (item.cores) out.push({ go: 'apr:cores', icon: '🌈', label: 'Roda de cores' });
    (item.tools || []).forEach(id => {
      if (TOOL_META[id]) out.push({ go: 'tool:' + id, icon: '🧮', label: TOOL_META[id].label });
    });
    return PhotoLearn.chips(out, '🔗 Onde isto volta a aparecer');
  }

  /* Um chip noutra secção pediu um cartão concreto: abre-o e leva-o ao ecrã.
     Sem isto, "ver a técnica X" deixava o utilizador numa grelha de vinte
     cartões à procura do que tinha acabado de pedir. */
  function openPending(box, seg, items, grid) {
    if (!_pendingLearn || _pendingLearn.seg !== seg) return;
    const id = _pendingLearn.id; _pendingLearn = null;
    if (!id) return;
    const i = items.findIndex(x => x.id === id);
    if (i < 0) return;
    const card = (grid && grid.grid ? grid.grid : box).querySelectorAll('.ph-learn-card')[i];
    if (!card) return;
    setTimeout(() => { card.click(); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }

  /* ══ APRENDER ▸ CORES ════════════════════════════════════════════════════
     A roda já existia e mostra RELAÇÕES; a Edição ensina os controlos (temp,
     saturação, HSL, gradação) e os Estilos são receitas prontas. Faltava a
     camada do meio, que é a única coisa que esta secção acrescenta: o que uma
     decisão de cor FAZ a quem vê, e porque é que se escolheria uma relação em
     vez de outra. Nada aqui explica um cursor — se explicasse, seria Edição
     escrita duas vezes.

     Duas formas de demonstrar, escolhidas pelo que a lição precisa:
       lab  — temperatura e saturação vivem nos MESMOS píxeis. Duas fotografias
              diferentes provariam nada; o cursor sobre a mesma imagem prova tudo.
       pair — dominante, ponto de atenção, relação e paleta são propriedades da
              CENA. Não se demonstram com um cursor, porque não se resolvem com um. */
  const APR_COR_HEAD = `<h2 class="ph-section-title">🌈 Cores</h2>
    <p class="ph-section-sub">O que a cor faz a quem vê — e porque é que um fotógrafo escolhe uma relação de cor em vez de outra. Os controlos que produzem estes resultados vivem na secção Edição; aqui trata-se de decidir.</p>`;

  function colourLessonHTML(l, db) {
    let demo = '';
    if (l.kind === 'seq' && l.sequence) demo = principleSequenceHTML(l.sequence);
    else if (l.kind === 'lab') {
      const bases = lookBases(l, db);
      if (bases.length) demo = PhotoLearn.look({ name: l.name, recipe: l.recipe, ingredients: l.ingredients, bases });
    } else if (l.compare) {
      const a = assetPath(l.compare.a), b = assetPath(l.compare.b);
      if (a && b) demo = PhotoLearn.compare({
        fam: 'cores', mode: 'side', neutral: !!l.compare.neutral,
        a, b, aTag: l.compare.aTag, bTag: l.compare.bTag,
        aWhy: l.compare.aWhy, bWhy: l.compare.bWhy,
        aAlt: l.compare.aTag, bAlt: l.compare.bTag, caption: l.compare.caption,
      });
    }
    const links = [];
    (l.genres || []).forEach(id => links.push('g:' + id));
    (l.looks || []).forEach(id => links.push('look:' + id));
    (l.techniques || []).forEach(id => links.push('tec:' + id));
    (l.etools || []).forEach(id => links.push('etool:' + id));
    if (l.cores) links.push('apr:cores');
    return `<button class="ph-detail-close" aria-label="Fechar">✕</button>
      <div class="ph-detail-head"><span class="ph-detail-ico">${l.icon}</span><h3 class="ph-detail-title">${l.name}</h3></div>
      ${PhotoLearn.lesson({
        kicker: 'Cor',
        hook: l.hook,
        idea: l.idea,
        visual: demo,
        body: `<div class="ph-look-grid">
            <div class="ph-info-card says"><b>🗣️ O que comunica</b><p>${l.says}</p></div>
            ${l.ressalva ? `<div class="ph-info-card over"><b>⚖️ Com que ressalva</b><p>${l.ressalva}</p></div>` : ''}
          </div>`,
        drill: l.drill ? PhotoLearn.drill({ key: 'cor-' + l.id, t: l.drill }) : '',
        links: resolveLinks(links, '🔗 Onde isto continua'),
      })}`;
  }

  /* A cadeia intenção → cor → estilo → edição existe porque era a pergunta que
     ficava por responder: percebi a cor, e agora? Mostra a ordem sem a impor —
     cada linha é um exemplo navegável, não um fluxo obrigatório. */
  function colourChainHTML(ch, db) {
    if (!ch) return '';
    const look = id => (db.looks || []).find(x => x.id === id);
    const et = id => editToolIndex()[id];
    return `<h3 class="ph-section-title sub">🔗 ${ch.title}</h3>
      <p class="ph-section-sub">${ch.sub}</p>
      <div class="ph-chain">${(ch.rows || []).map(r => {
        const l = look(r.look), t = (et(r.etool) || {}).tool;
        return `<div class="ph-chain-row">
          <span class="ph-chain-step want"><b>Visão</b>${r.want}</span>
          <span class="ph-chain-arrow" aria-hidden="true">→</span>
          <span class="ph-chain-step"><b>Cor</b>${r.colour}</span>
          <span class="ph-chain-arrow" aria-hidden="true">→</span>
          ${l ? `<button class="ph-chain-step go" data-go="look:${l.id}"><b>Estilo</b>${l.icon} ${l.name} →</button>` : ''}
          ${t ? `<button class="ph-chain-step go" data-go="etool:${r.etool}"><b>Edição</b>${t.name} →</button>` : ''}
        </div>`;
      }).join('')}</div>`;
  }

  function buildCores(box) {
    box.innerHTML = `${APR_COR_HEAD}<p class="ph-section-sub">A carregar…</p>`;
    Promise.all([loadDB(), loadAssets(), loadEditDB()]).then(([db]) => {
      if (!db || !(db.colour || []).length) { box.innerHTML = `${APR_COR_HEAD}<p class="ph-section-sub">Sem ligação — tenta novamente mais tarde.</p>`; return; }
      const grid = expandableGrid(box, db.colour, {
        head: APR_COR_HEAD, split: true,
        thumb: l => {
          // a lição de laboratório mostra-se já tratada; a de par mostra o lado
          // que a demonstra — a miniatura tem de ser a própria lição
          if (l.kind === 'lab') return `<span class="ph-vis ph-photo-thumb"><canvas class="ph-look-thumb"></canvas></span>`;
          const src = (l.compare && assetPath(l.compare.a))
            || (l.sequence && l.sequence.items && assetPath(l.sequence.items[0].src));
          return src ? `<span class="ph-vis ph-photo-thumb"><img loading="lazy" decoding="async" alt="" src="${src}"></span>` : '';
        },
        blurb: l => l.blurb,
        detail: l => colourLessonHTML(l, db),
        afterCard: (card, l) => {
          if (l.kind !== 'lab') return;
          const b = lookBases(l, db)[0];
          if (b) PhotoLearn.paintThumb(card.querySelector('.ph-look-thumb'), b.src, l.recipe);
        },
        afterOpen: detail => PhotoLearn.wire(detail, plGo),
      });
      const extra = document.createElement('div');
      extra.innerHTML = `${colourChainHTML(db.colourChain, db)}
        <h3 class="ph-section-title sub">🎡 Roda de cores</h3>
        <p class="ph-section-sub">A ferramenta para experimentar as relações acima: arrasta no anel para o tom e no quadrado interior para saturação e luminosidade.</p>
        <div id="ph-cw-inner"></div>`;
      box.appendChild(extra);
      buildColorWheel(extra.querySelector('#ph-cw-inner'));
      PhotoLearn.wire(extra, plGo);
      openPending(box, 'cores', db.colour, grid);
    });
  }

  const APR_SEGS = [
    { id: 'visao',       label: '🧠 Visão' },
    { id: 'ler',         label: '🔍 Ler' },
    { id: 'fundamentos', label: '📖 Fundamentos' },
    { id: 'composicao',  label: '🖼️ Composição' },
    { id: 'estilos',     label: '🎨 Estilos' },
    { id: 'tecnicas',    label: '🧪 Técnicas' },
    { id: 'cores',       label: '🌈 Cores' },
  ];
  const APR_BUILDERS = {
    visao(box) { buildVisaoAprender(box); },
    ler(box) { buildLer(box); },
    fundamentos(box) { buildFundamentos(box); },
    composicao(box)  { buildComposition(box); },
    estilos(box) { buildEstilos(box); },
    tecnicas(box) { buildTecnicas(box); },
    cores(box) { buildCores(box); },
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
        if (!APR_BUILDERS[id]) id = 'visao';
        panel.querySelectorAll('.ph-apr-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.seg === id));
        panel.querySelectorAll('.ph-apr-panel').forEach(p => { p.hidden = p.dataset.apr !== id; });
        if (!done.has(id)) { done.add(id); APR_BUILDERS[id](panel.querySelector(`.ph-apr-panel[data-apr="${id}"]`)); }
        // com 7 segmentos, o ativo pode estar fora do ecrã num telemóvel
        panel.querySelector(`.ph-apr-seg .seg-btn[data-seg="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
        try { localStorage.setItem('ph-apr-seg', id); } catch (_) {}
      };
      panel.querySelectorAll('.ph-apr-seg .seg-btn').forEach(b =>
        b.addEventListener('click', () => _aprActivate(b.dataset.seg)));
    }
    let initial = seg;
    if (!initial) { try { initial = localStorage.getItem('ph-apr-seg'); } catch (_) {} }
    _aprActivate(initial || 'visao');
  }

  // ── Ferramentas (calculadoras) ──
  let _toolsBuilt = false;
  function buildFerramentas(panel) {
    // O crop pré-selecionado depende da classe de câmara, e gearClass() só a
    // sabe validar depois do DB carregar — sem esperar, quem tem Full Frame
    // escolhido apanhava o valor de omissão numa carga fria desta secção.
    // (E os assets têm de estar carregados também, senão as capas das
    // calculadoras não existem ainda quando as fichas se desenham.)
    if (!_toolsBuilt && (!_DB || !_assets)) {
      panel.innerHTML = `<div class="ph-section-box"><p class="ph-section-sub">A carregar…</p></div>`;
      Promise.all([loadDB(), loadAssets()]).then(() => buildFerramentas(panel));
      return;
    }
    if (!_toolsBuilt) {
      _toolsBuilt = true;
      panel.innerHTML = `
        <p class="ph-section-sub" style="margin:.1rem 0 .9rem">Calculadoras de exposição e ótica — os resultados atualizam automaticamente. O crop vem pré-selecionado a partir do tipo de câmara que escolheste (${(classDef() || {}).name || 'APS-C'}); podes trocá-lo em qualquer campo.</p>
        <div class="ph-grid"></div>`;
      const grid = panel.querySelector('.ph-grid');
      Object.keys(TOOL_META).forEach(key => {
        const wrapper = document.createElement('div');
        wrapper.id = 'ph-calc-' + key;
        TOOL_META[key].fn(wrapper);
        /* Capa gráfica da calculadora (grupo `tool-ico`): a grelha era só
           texto e números e não se distinguia uma ficha da outra de
           relance. A capa é injetada depois de a ficha se desenhar para
           as calculadoras não precisarem de saber que ela existe. */
        const cover = assetPath('tli-' + key);
        const title = cover && wrapper.querySelector('.ph-card-title');
        if (title) title.insertAdjacentHTML('beforebegin',
          `<span class="ph-tool-cover"><img loading="lazy" decoding="async" alt="" src="${cover}"></span>`);
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
    { id: 'cheats',      label: '📋 Cheatsheets' },
    { id: 'equipamento', label: '🎒 Equipamento' },
    { id: 'edicao',      label: '🎨 Edição' },
    { id: 'aprender',    label: '📚 Aprender' },
    { id: 'ferramentas', label: '🧮 Ferramentas' },
  ];
  const TAB_ROUTE = { generos: 'photography', cheats: 'photography/cheatsheets', equipamento: 'photography/equipamento', edicao: 'photography/edicao', aprender: 'photography/aprender', ferramentas: 'photography/ferramentas' };

  /* Contexto entregue ao PhotoCheats: dá-lhe acesso ao DB, aos assets, à
     classe de câmara e ao router de ligações cruzadas sem que ele precise
     de conhecer rotas nem de duplicar estado. */
  const cheatsCtx = () => ({
    loadDB, loadAssets, assetPath, lensLine, classDef, classCrop, gearClass, go: plGo,
    contextBarHTML, wireContextBar,
  });

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
              <p class="ph-sub">Escola de fotografia: 28 géneros, estilos e técnicas aplicados ao vivo, cheatsheets de consulta rápida, exercícios de leitura de imagem e ferramentas — adaptado à tua câmara e ao teu perfil</p>
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
          else if (id === 'cheats') PhotoCheats.build(panel, arg, cheatsCtx());
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
      /* "No Terreno" foi absorvido pelos Cheatsheets: a página de um género já
         abre com o cartão de bolso (Definições · Na cena · Compõe · Evita) e
         com as fichas visuais por baixo. As rotas antigas continuam a valer. */
      else if (a === 'agora')                { tab = 'cheats'; arg = rest ? 'g/' + rest : null; }
      else if (a === 'aprender')             { tab = 'aprender'; arg = rest || null; }
      else if (a === 'equipamento')          { tab = 'equipamento'; arg = rest || null; }
      else if (a === 'edicao')               { tab = 'edicao'; arg = rest || null; }
      else if (a === 'cheatsheets' || a === 'cs') { tab = 'cheats'; arg = rest || null; }
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
