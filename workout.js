const WorkoutPage = (function () {
  'use strict';

  // ── Audio ──────────────────────────────────────────────────────────
  function beep(freq, dur, vol = 0.3) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  function chime() { beep(784,.15); setTimeout(()=>beep(1047,.25),170); }
  function gong()  { beep(523,.3,.5); }
  function tick()  { beep(1200,.06,.15); }
  function done()  { beep(523,.12); setTimeout(()=>beep(659,.12),130); setTimeout(()=>beep(784,.12),260); setTimeout(()=>beep(1047,.4),390); }

  // ── Exercise database ──────────────────────────────────────────────
  const DB = {
    strength: [
      { name:'Flexões',           desc:'Mãos na largura dos ombros. Desce o peito ao chão e sobe com controlo.',        work:40,rest:20,anim:'pushup',   muscle:'Peito · Triceps · Ombros' },
      { name:'Agachamentos',      desc:'Pés na largura dos ombros. Desce até à paralela mantendo as costas direitas.',   work:40,rest:20,anim:'squat',    muscle:'Pernas · Glúteos · Core' },
      { name:'Afundos Alternados',desc:'Passo à frente, dobra o joelho traseiro quase ao chão. Alterna as pernas.',      work:35,rest:20,anim:'lunge',    muscle:'Quadriceps · Glúteos' },
      { name:'Prancha',           desc:'Corpo em linha reta sobre antebraços. Contrai o abdómen e respira.',             work:45,rest:15,anim:'plank',    muscle:'Core · Ombros · Glúteos' },
      { name:'Ponte de Glúteos',  desc:'Deitado, joelhos dobrados. Levanta os quadris até ao alinhamento com o tronco.',work:40,rest:15,anim:'bridge',   muscle:'Glúteos · Isquiotibiais' },
      { name:'Superman',          desc:'Deitado de bruços. Levanta braços e pernas simultaneamente. Segura 2 segundos.', work:35,rest:15,anim:'superman', muscle:'Eretores da Coluna · Glúteos' },
      { name:'Dips de Triceps',   desc:'Usa uma cadeira sólida. Dobra os cotovelos até 90° e empurra de volta.',         work:35,rest:20,anim:'dip',      muscle:'Triceps · Ombros' },
      { name:'Pike Push-ups',     desc:'Corpo em V invertido. Dobra os cotovelos descendo a cabeça ao chão.',            work:35,rest:20,anim:'pushup',   muscle:'Ombros · Triceps' },
    ],
    cardio: [
      { name:'Jumping Jacks',     desc:'Salta abrindo pernas e braços em simultâneo. Mantém ritmo constante.',          work:40,rest:15,anim:'jumpjack', muscle:'Todo o corpo · Cardio' },
      { name:'High Knees',        desc:'Corre no lugar levantando os joelhos à altura da anca. Braços em movimento.',    work:35,rest:15,anim:'highknees',muscle:'Pernas · Core · Cardio' },
      { name:'Burpees',           desc:'Agacha, apoia mãos, estende pernas, faz flexão, volta e salta com força.',       work:30,rest:25,anim:'burpee',   muscle:'Corpo completo · Cardio' },
      { name:'Mountain Climbers', desc:'Em prancha, alterna joelhos em direção ao peito o mais rápido possível.',        work:35,rest:15,anim:'climber',  muscle:'Core · Ombros · Cardio' },
      { name:'Saltos de Agachamento',desc:'Agachamento completo. No topo, salta explosivamente e aterra suave.',         work:35,rest:20,anim:'jumpsquat',muscle:'Pernas · Glúteos · Cardio' },
      { name:'Skater Jumps',      desc:'Salta de lado, aterrando num pé. Imita o movimento de patinador.',               work:35,rest:20,anim:'skater',   muscle:'Pernas · Equilíbrio · Cardio' },
      { name:'Corrida no Lugar',  desc:'Corre no lugar o mais rápido possível. Eleva os joelhos.',                       work:30,rest:15,anim:'highknees',muscle:'Todo o corpo · Cardio' },
      { name:'Box Steps',         desc:'Sobe e desce num degrau ou plataforma baixa. Mantém ritmo constante.',           work:45,rest:15,anim:'boxstep',  muscle:'Pernas · Cardio' },
    ],
    core: [
      { name:'Prancha',           desc:'Corpo em linha reta sobre antebraços. Contrai forte o abdómen.',                 work:45,rest:15,anim:'plank',    muscle:'Core profundo · Ombros' },
      { name:'Abdominais',        desc:'Deitado, joelhos dobrados. Sobe apenas o tronco superior. Não puxes o pescoço.', work:40,rest:15,anim:'crunch',   muscle:'Reto abdominal' },
      { name:'Torção Russa',      desc:'Sentado inclinado a 45°. Torce o tronco de lado a lado. Podes segurar peso.',    work:35,rest:15,anim:'twist',    muscle:'Oblíquos · Core' },
      { name:'Prancha Lateral',   desc:'Suporta o corpo num antebraço. Corpo em linha reta. Alterna lados.',             work:30,rest:15,anim:'sideplank', muscle:'Oblíquos · Core lateral' },
      { name:'Bicicleta',         desc:'Cotovelo toca no joelho oposto alternando. Movimento controlado e lento.',       work:40,rest:15,anim:'bicycle',  muscle:'Abdominais · Oblíquos' },
      { name:'Leg Raises',        desc:'Deitado, pernas juntas. Levanta até à vertical mantendo os lombos no chão.',     work:35,rest:15,anim:'legraise', muscle:'Abdominais inferiores' },
      { name:'Dead Bug',          desc:'Deitado, costas na chão. Estende braço e perna opostos alternadamente.',         work:35,rest:15,anim:'deadbug',  muscle:'Core profundo · Estabilidade' },
      { name:'Superman',          desc:'Levanta simultaneamente braços e pernas deitado de bruços. Segura 2s.',           work:35,rest:15,anim:'superman', muscle:'Eretores · Glúteos' },
    ],
  };

  const ANIM_MAP = {
    pushup:   {e:'🤸',css:'wk-bounce'},   squat:    {e:'🏋️',css:'wk-squat'},
    lunge:    {e:'🚶',css:'wk-step'},     plank:    {e:'😤',css:'wk-hold'},
    bridge:   {e:'🌉',css:'wk-pulse'},    superman: {e:'🦸',css:'wk-tilt'},
    dip:      {e:'💺',css:'wk-pulse'},    jumpjack: {e:'🙆',css:'wk-bounce'},
    highknees:{e:'🏃',css:'wk-run'},      burpee:   {e:'💪',css:'wk-bounce'},
    climber:  {e:'🧗',css:'wk-run'},      jumpsquat:{e:'⬆️',css:'wk-bounce'},
    skater:   {e:'⛸️',css:'wk-step'},    boxstep:  {e:'📦',css:'wk-step'},
    crunch:   {e:'💪',css:'wk-pulse'},    twist:    {e:'🌀',css:'wk-tilt'},
    sideplank:{e:'💪',css:'wk-hold'},     bicycle:  {e:'🚴',css:'wk-run'},
    legraise: {e:'🦵',css:'wk-pulse'},    deadbug:  {e:'🐛',css:'wk-breathe'},
    warmup:   {e:'🙌',css:'wk-bounce'},   cooldown: {e:'🧘',css:'wk-breathe'},
  };

  function buildWorkout(type, totalMin) {
    const totalSec = totalMin * 60;
    let pool = type === 'mixed'
      ? [...DB.strength, ...DB.cardio, ...DB.core].sort(() => Math.random()-.5)
      : (DB[type] || DB.strength).slice().sort(() => Math.random()-.5);

    const list = [{ name:'Aquecimento', desc:'Marcha no lugar, rotações articulares e mobilidade.', work:60, rest:0, anim:'warmup', muscle:'Aquecimento geral', isSpecial:true }];
    let elapsed = 60;
    let i = 0;
    while (elapsed < totalSec - 60) {
      const ex = pool[i % pool.length];
      list.push({ ...ex, isSpecial:false });
      elapsed += ex.work + ex.rest;
      i++;
      if (i > pool.length * 4) break;
    }
    list.push({ name:'Relaxamento', desc:'Respiração profunda e alongamentos suaves. Excelente trabalho!', work:60, rest:0, anim:'cooldown', muscle:'Recuperação ativa', isSpecial:true });
    return list;
  }

  // ── State ──────────────────────────────────────────────────────────
  let _built = false, _workout = null, _idx = 0, _phase = 'work', _timer = 0, _wkInt = null;

  function show() {
    const el = document.getElementById('view-workout');
    if (!el) return;
    if (!_built) { _built = true; renderConfig(el); }
  }

  // ── Config screen ──────────────────────────────────────────────────
  function renderConfig(el) {
    _workout = null; _idx = 0;
    clearInterval(_wkInt);
    el.innerHTML = `
      <div class="view-inner">
        <div class="page-header">
          <h1 class="page-title">💪 Treino em Casa</h1>
          <p class="page-subtitle">Sem equipamento, sem desculpas</p>
        </div>
        <div class="wk-cfg">
          <div class="wk-sec-lbl">Tipo de Treino</div>
          <div class="wk-type-grid">
            ${[
              {id:'strength',icon:'🏋️',name:'Força',       desc:'Fortalecimento muscular e resistência'},
              {id:'cardio',  icon:'🏃',name:'Cardio',       desc:'Alta intensidade e queima calórica'},
              {id:'core',    icon:'⚡',name:'Core',         desc:'Abdominais, lombar e equilíbrio'},
              {id:'mixed',   icon:'🔥',name:'Misto',        desc:'Combinação equilibrada de força e cardio'},
            ].map(t=>`
              <button class="wk-type-btn" data-type="${t.id}">
                <div class="wk-type-icon">${t.icon}</div>
                <div class="wk-type-name">${t.name}</div>
                <div class="wk-type-desc">${t.desc}</div>
              </button>`).join('')}
          </div>
          <div class="wk-sec-lbl">Duração</div>
          <div class="wk-dur-grid">
            ${[10,15,20,30,45,60].map(d=>`<button class="wk-dur-btn" data-dur="${d}">${d} min</button>`).join('')}
          </div>
          <button class="wk-start-btn" id="wk-go" disabled>▶ Começar Treino</button>
        </div>
      </div>`;

    let selType = null, selDur = null;
    function check() { el.querySelector('#wk-go').disabled = !(selType && selDur); }

    el.querySelectorAll('.wk-type-btn').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('.wk-type-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); selType = b.dataset.type; check();
    }));
    el.querySelectorAll('.wk-dur-btn').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('.wk-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); selDur = +b.dataset.dur; check();
    }));
    el.querySelector('#wk-go').addEventListener('click', () => {
      if (!selType || !selDur) return;
      _workout = buildWorkout(selType, selDur);
      _idx = 0; _phase = 'work'; _timer = _workout[0].work;
      renderPlayer(el);
    });
  }

  // ── Player ─────────────────────────────────────────────────────────
  function renderPlayer(el) {
    clearInterval(_wkInt);
    const ex = _workout[_idx];
    const total = _workout.length;
    const isRest = _phase === 'rest';
    const a = ANIM_MAP[ex.anim] || ANIM_MAP.warmup;
    const nextName = getNext();

    el.innerHTML = `
      <div class="view-inner">
        <div class="wk-player">
          <div class="wk-topbar">
            <div class="wk-prog-wrap">
              <div class="wk-prog-fill" style="width:${(_idx/total)*100}%"></div>
            </div>
            <div class="wk-prog-lbl">${_idx+1} / ${total}</div>
          </div>

          <div class="wk-phase-badge ${isRest?'wk-rest':'wk-work'}">${isRest?'😮‍💨 Descanso':'💪 Exercício'}</div>

          <div class="wk-fig-wrap">
            <div class="wk-fig-emoji ${a.css}">${isRest ? '😮‍💨' : a.e}</div>
          </div>

          <div class="wk-ex-name">${isRest ? 'Descansa!' : ex.name}</div>
          <div class="wk-ex-desc">${isRest ? 'Recupera para o próximo exercício.' : ex.desc}</div>
          ${!isRest && ex.muscle ? `<div class="wk-muscle">🎯 ${ex.muscle}</div>` : ''}

          <div class="wk-timer-big" id="wk-timer">${_timer}</div>

          <div class="wk-next-row">
            <span class="wk-next-lbl">A seguir:</span>
            <span class="wk-next-name">${nextName}</span>
          </div>

          <div class="wk-controls">
            <button class="tool-btn tool-btn-sec" id="wk-skip">⏭ Saltar</button>
            <button class="tool-btn" style="background:#ef4444" id="wk-stop">✕ Parar</button>
          </div>
        </div>
      </div>`;

    el.querySelector('#wk-skip').addEventListener('click', () => advance(el));
    el.querySelector('#wk-stop').addEventListener('click', () => {
      clearInterval(_wkInt);
      _built = false;
      renderConfig(el);
    });

    _wkInt = setInterval(() => tickWk(el), 1000);
  }

  function getNext() {
    const ex = _workout[_idx];
    if (_phase === 'work' && ex.rest > 0) return `Descanso (${ex.rest}s)`;
    const nex = _workout[_idx + 1];
    return nex ? nex.name : '🏁 Fim do treino!';
  }

  function tickWk(el) {
    _timer--;
    const t = el.querySelector('#wk-timer');
    if (t) t.textContent = _timer;
    if (_timer <= 3 && _timer > 0) tick();
    if (_timer <= 0) advance(el);
  }

  function advance(el) {
    clearInterval(_wkInt);
    const ex = _workout[_idx];
    if (_phase === 'work' && ex.rest > 0) {
      _phase = 'rest'; _timer = ex.rest; chime();
    } else {
      _idx++; _phase = 'work';
      if (_idx >= _workout.length) { renderDone(el); return; }
      _timer = _workout[_idx].work; gong();
    }
    renderPlayer(el);
  }

  function renderDone(el) {
    clearInterval(_wkInt);
    el.innerHTML = `
      <div class="view-inner">
        <div class="wk-done-screen">
          <div class="wk-done-emoji">🎉</div>
          <div class="wk-done-title">Treino Concluído!</div>
          <div class="wk-done-sub">Excelente trabalho! Recupera bem e bebe água.</div>
          <button class="wk-start-btn" id="wk-again">↺ Novo Treino</button>
        </div>
      </div>`;
    done();
    el.querySelector('#wk-again').addEventListener('click', () => {
      _built = false;
      renderConfig(el);
    });
  }

  return { show };
})();
